-- MANUAL ONLY. Do not run from the frontend or a deployment script.
-- Additive transaction; existing application tables, policies and data are untouched.
-- Prerequisite: inspect the live schema/RLS using docs/V1_2_DATABASE_REVIEW.sql first.
begin;
do $$
begin
  if to_regclass('public.household_members') is null then
    raise exception 'Existing household_members table is required; stop and inspect the live schema.';
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='household_members' and column_name='household_id' and udt_name='uuid')
     or not exists (select 1 from information_schema.columns where table_schema='public' and table_name='household_members' and column_name='user_id' and udt_name='uuid') then
    raise exception 'Expected uuid household_members.household_id and user_id. Adapt this file to the verified schema.';
  end if;
  if to_regclass('public.user_preferences') is not null or to_regclass('public.notification_states') is not null then
    raise exception 'A proposed table already exists. Inspect it; this migration will not overwrite it.';
  end if;
end $$;

create table public.user_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  appearance text not null default 'light' check (appearance in ('light','dark')),
  quiet_enabled boolean not null default false,
  quiet_start time not null default '22:00',
  quiet_end time not null default '07:00',
  timezone text not null default 'UTC' check (length(timezone) between 1 and 100)
);
create table public.notification_states (
  user_id uuid not null references auth.users(id) on delete cascade,
  household_id uuid not null,
  event_key text not null check (length(event_key) between 1 and 200),
  read_at timestamptz,
  snoozed_until timestamptz,
  primary key (user_id, household_id, event_key)
);
-- No household FK is guessed: the repository does not define the households table.
-- Membership is checked for every operation, including both sides of UPDATE.
alter table public.user_preferences enable row level security;
alter table public.notification_states enable row level security;
create policy own_preferences on public.user_preferences for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy own_household_notification_states on public.notification_states for all to authenticated
  using (user_id = (select auth.uid()) and exists (
    select 1 from public.household_members m where m.user_id=(select auth.uid()) and m.household_id=notification_states.household_id
  ))
  with check (user_id = (select auth.uid()) and exists (
    select 1 from public.household_members m where m.user_id=(select auth.uid()) and m.household_id=notification_states.household_id
  ));
revoke all on public.user_preferences, public.notification_states from anon, authenticated;
grant select, insert, update, delete on public.user_preferences, public.notification_states to authenticated;
grant select on public.user_preferences, public.notification_states to service_role;
do $$
begin
  if exists (select 1 from pg_publication where pubname='supabase_realtime') then
    alter publication supabase_realtime add table public.user_preferences, public.notification_states;
  end if;
end $$;
commit;
