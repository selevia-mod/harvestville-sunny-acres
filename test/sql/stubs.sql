-- Stand-ins for the Supabase pieces farm_online.sql uses (auth, realtime, profiles), for a local Postgres check.
create role anon; create role authenticated;
create schema auth; create table auth.users (id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.uid', true), '')::uuid $$;
create schema realtime; create table realtime.messages (id bigint, topic text, extension text); alter table realtime.messages enable row level security;
grant select, insert on realtime.messages to authenticated; grant usage on schema realtime, auth to authenticated;
create function realtime.topic() returns text language sql stable as $$ select current_setting('realtime.topic', true) $$;
grant execute on function realtime.topic() to authenticated;
create table public.profiles (auth_user_id uuid, is_banned boolean, suspended_until timestamptz, display_name text, username text);
