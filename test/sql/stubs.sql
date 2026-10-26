-- Stand-ins for the Supabase pieces farm_online.sql uses (auth, realtime, profiles), for a local Postgres check.
create role anon; create role authenticated;
create schema auth; create table auth.users (id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.uid', true), '')::uuid $$;
create schema realtime; create table realtime.messages (id bigint, topic text, extension text); alter table realtime.messages enable row level security;
grant select, insert on realtime.messages to authenticated; grant usage on schema realtime, auth to authenticated;
create function realtime.topic() returns text language sql stable as $$ select current_setting('realtime.topic', true) $$;
grant execute on function realtime.topic() to authenticated;
create table public.profiles (auth_user_id uuid, is_banned boolean, suspended_until timestamptz, display_name text, username text);
-- Selebox's notifications, push policy and push text (only what farm_online_2.sql touches)
create table public.app_config (key text primary key, value text, description text, updated_at timestamptz not null default now());
create table public.notifications (id uuid primary key default gen_random_uuid(), recipient_id uuid not null, actor_id uuid, type text not null,
  target_type text, message text, metadata jsonb not null default '{}'::jsonb, created_at timestamptz not null default now());
create table public.notification_push_policy (type text primary key, push_enabled boolean, note text, updated_at timestamptz not null default now());
alter table public.profiles add column id uuid default gen_random_uuid();
create function public.notification_push_copy_v1(p_ids uuid[]) returns table (notification_id uuid, title text, body text)
language plpgsql stable as $$
begin
  return query with t as (select n.id, n.type, n.metadata as m from public.notifications n where n.id = any (p_ids))
  select t.id,
    case t.type
        when 'book_suggestion' then t.m->>'push_title'
    end,
    case t.type
        when 'book_suggestion' then t.m->>'push_body'
    end
  from t;
end $$;
-- Selebox follows and moderators (only what farm_online_3.sql touches)
create table public.follows (follower_id uuid not null, following_id uuid not null, created_at timestamptz not null default now(), primary key (follower_id, following_id));
alter table public.profiles add column role text not null default 'user';
create function public.is_moderator() returns boolean language sql stable security definer set search_path = 'public' as $$
  select exists (select 1 from public.profiles p where p.auth_user_id = auth.uid() and p.role in ('moderator', 'admin') and not p.is_banned);
$$;
-- Selebox wallets and ledgers (only what farm_online_4.sql touches), with type lists like live's
alter table public.profiles add column is_guest boolean default false, add column deleted_at timestamptz;
create function public.current_profile_id() returns uuid language sql stable security definer set search_path = 'public' as $$
  select id from public.profiles where auth_user_id = auth.uid() limit 1;
$$;
grant execute on function public.current_profile_id() to authenticated;
create table public.wallets (user_id uuid primary key, coin_balance int not null default 0 check (coin_balance >= 0),
  star_balance int not null default 0 check (star_balance >= 0), updated_at timestamptz);
create table public.coin_transactions (id uuid primary key default gen_random_uuid(), user_id uuid not null, delta int not null,
  balance_after int not null check (balance_after >= 0), type text not null, reference_type text, reference_id text, metadata jsonb,
  created_at timestamptz not null default now(), constraint coin_transactions_type_check check (type = any (array['purchase', 'unlock_chapter']) or type = 'pet_meals'));
create table public.star_transactions (id uuid primary key default gen_random_uuid(), user_id uuid not null, delta int not null,
  balance_after int not null check (balance_after >= 0), type text not null, reference_type text, reference_id text, metadata jsonb,
  created_at timestamptz not null default now(), constraint star_transactions_type_check check (type = any (array['ad_watch', 'unlock_chapter']) or type = 'pet_meals'));
