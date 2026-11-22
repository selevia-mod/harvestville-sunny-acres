-- Harvest Ville: error reports from players' games (owner, 22 Nov 2026: "Yes proceed to 1 and 2").
-- When the game breaks on a player's phone it sends one short note (src/02-report-errors.js): what broke, on which
-- map and screen, which build. The player sees nothing. Nothing personal is kept: farm.errors has no user id;
-- farm.error_users only counts how many phones had each error (and stops one phone from flooding it).
--
--   farm_error_v1(msg, stack, map, screen, build, version, platform): adds one; never fails a game.
--   One phone: at most 20 different errors a day, each counted up to 50 times.
--
-- Read it with:
--   select day, build, version, platform, map, screen, msg, n, users from farm.errors order by day desc, n desc;
-- Clear old days (any time):
--   delete from farm.error_users where day < current_date - 60; delete from farm.errors where day < current_date - 60;
set lock_timeout = '5s';

create table farm.errors (
  day date not null,                       -- Manila date
  sig text not null,                       -- md5(build | message | first stack line): one row per error per day
  build text not null default '',          -- the page's build (8 letters, F.BUILD)
  version text not null default '',        -- What's new version, e.g. 2.15
  platform text not null default 'other' check (platform in ('ios', 'android', 'other')),
  map text not null default '',            -- where the farmer was (farm, town, manila, ...)
  screen text not null default '',         -- the panel on top, if any
  msg text not null default '',
  stack text not null default '',
  n int not null default 0 check (n >= 0),         -- how many times
  users int not null default 0 check (users >= 0), -- how many phones
  first_at timestamptz not null default now(),
  last_at timestamptz not null default now(),
  primary key (day, sig)
);
alter table farm.errors enable row level security;
revoke all on farm.errors from public, anon, authenticated;

create table farm.error_users (
  day date not null,
  sig text not null,
  user_id uuid not null,
  n int not null default 0 check (n >= 0),
  primary key (day, sig, user_id)
);
create index error_users_day_user on farm.error_users (day, user_id);
alter table farm.error_users enable row level security;
revoke all on farm.error_users from public, anon, authenticated;

create function public.farm_error_v1(p_msg text, p_stack text default '', p_map text default '', p_screen text default '',
  p_build text default '', p_version text default '', p_platform text default 'other')
returns void language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  today date := (now() at time zone 'Asia/Manila')::date;
  m text := left(coalesce(p_msg, ''), 300);
  st text := left(coalesce(p_stack, ''), 1500);
  b text := left(coalesce(p_build, ''), 16);
  phone text := case when p_platform in ('ios', 'android') then p_platform else 'other' end;
  s text;
  mine int;
  kinds int;
begin
  if uid is null then raise exception 'not signed in' using errcode = '28000'; end if;
  if m = '' then return; end if;
  s := md5(b || '|' || m || '|' || split_part(st, E'\n', 1));
  select n into mine from farm.error_users where day = today and sig = s and user_id = uid;
  if mine is null then
    select count(*) into kinds from farm.error_users where day = today and user_id = uid;
    if kinds >= 20 then return; end if;
    insert into farm.error_users (day, sig, user_id, n) values (today, s, uid, 1) on conflict do nothing;
  elsif mine >= 50 then
    return;
  else
    update farm.error_users set n = n + 1 where day = today and sig = s and user_id = uid;
  end if;
  insert into farm.errors (day, sig, build, version, platform, map, screen, msg, stack, n, users)
  values (today, s, b, left(coalesce(p_version, ''), 16), phone, left(coalesce(p_map, ''), 40), left(coalesce(p_screen, ''), 80), m, st, 1, 1)
  on conflict (day, sig) do update set
    n = farm.errors.n + 1,
    users = farm.errors.users + (case when mine is null then 1 else 0 end),
    last_at = now();
end $$;
revoke all on function public.farm_error_v1(text, text, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.farm_error_v1(text, text, text, text, text, text, text) to authenticated;
reset lock_timeout;

-- ---------- to undo ----------
-- drop function if exists public.farm_error_v1(text, text, text, text, text, text, text);
-- drop table if exists farm.error_users;
-- drop table if exists farm.errors;
