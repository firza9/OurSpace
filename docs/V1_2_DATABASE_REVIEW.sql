-- OPTIONAL READ-ONLY REVIEW for the project owner. This is NOT a migration.
-- Run in the Supabase SQL editor and inspect results before applying either migration.
select table_name,column_name,data_type,udt_name,is_nullable,column_default
from information_schema.columns where table_schema='public' order by table_name,ordinal_position;
select tablename,policyname,roles,cmd,qual,with_check from pg_policies
where schemaname='public' order by tablename,policyname;
select c.relname,c.relrowsecurity,c.relforcerowsecurity from pg_class c
join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r';
select conrelid::regclass as table_name,conname,pg_get_constraintdef(oid) as definition
from pg_constraint where connamespace='public'::regnamespace;
select pubname,schemaname,tablename from pg_publication_tables where pubname='supabase_realtime';
-- Verify authenticated members can see their own household_members membership without
-- recursive policies, and that non-members cannot access any household data.
-- Do not paste private rows, database credentials or tokens into chat.
