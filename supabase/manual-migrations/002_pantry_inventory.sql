-- MANUAL ONLY. Independent of 001; no existing tables or data are changed.
begin;
do $$
begin
  if to_regclass('public.household_members') is null then
    raise exception 'Existing household_members is required. Inspect live schema first.';
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='household_members' and column_name='household_id' and udt_name='uuid')
     or not exists (select 1 from information_schema.columns where table_schema='public' and table_name='household_members' and column_name='user_id' and udt_name='uuid') then
    raise exception 'Expected uuid household_members.household_id and user_id; adapt to verified schema.';
  end if;
  if to_regclass('public.pantry_items') is not null then
    raise exception 'pantry_items already exists; inspect it instead of overwriting.';
  end if;
end $$;
create table public.pantry_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null,
  created_by uuid not null references auth.users(id),
  name text not null check (length(trim(name)) between 1 and 200),
  location text not null check (location in ('Pantry','Fridge','Freezer')),
  quantity numeric not null default 1 check (quantity >= 0 and quantity < 1000000000),
  unit text not null default 'pcs' check (length(trim(unit)) between 1 and 40),
  expiry_date date,
  low_stock_threshold numeric not null default 1 check (low_stock_threshold >= 0 and low_stock_threshold < 1000000000),
  created_at timestamptz not null default now()
);
create index pantry_items_household_name_idx on public.pantry_items(household_id,name);
alter table public.pantry_items enable row level security;
create policy pantry_select on public.pantry_items for select to authenticated using (
  exists (select 1 from public.household_members m where m.user_id=(select auth.uid()) and m.household_id=pantry_items.household_id)
);
create policy pantry_insert on public.pantry_items for insert to authenticated with check (
  created_by=(select auth.uid()) and exists (select 1 from public.household_members m where m.user_id=(select auth.uid()) and m.household_id=pantry_items.household_id)
);
create policy pantry_update on public.pantry_items for update to authenticated using (
  exists (select 1 from public.household_members m where m.user_id=(select auth.uid()) and m.household_id=pantry_items.household_id)
) with check (
  exists (select 1 from public.household_members m where m.user_id=(select auth.uid()) and m.household_id=pantry_items.household_id)
);
create policy pantry_delete on public.pantry_items for delete to authenticated using (
  exists (select 1 from public.household_members m where m.user_id=(select auth.uid()) and m.household_id=pantry_items.household_id)
);
revoke all on public.pantry_items from anon, authenticated;
grant select,insert,update,delete on public.pantry_items to authenticated;
do $$
begin
  if exists (select 1 from pg_publication where pubname='supabase_realtime') then
    alter publication supabase_realtime add table public.pantry_items;
  end if;
end $$;
commit;
