-- Harvest Ville online, part 6 (27 Oct 2026): helping a friend's farm. Run AFTER parts 1-5.
-- Adds one table (farm.helps) and two functions; replaces nothing, touches no Selebox table.
--   farm_help_v1(host, tile): on a friend's farm you visited today, you water one of their growing crops. Up to 5 tiles
--     per friend a day and 25 a day in all (the game pays the helper 20G a tile). The first help of the day sends the
--     friend a push ("<name> watered your crops").
--   farm_helps_v1(): at home, the tiles friends watered for you since you last looked (taken once), and who it was.
set lock_timeout = '5s';

create table farm.helps (
  host uuid not null references farm.players (user_id) on delete cascade,
  helper uuid not null references farm.players (user_id) on delete cascade,
  day date not null default ((now() at time zone 'utc')::date),
  tile int not null check (tile between 0 and 100000),
  claimed boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (host, helper, day, tile),
  check (host <> helper)
);
create index helps_waiting on farm.helps (host) where not claimed;
create index helps_by_helper on farm.helps (helper, day);
alter table farm.helps enable row level security;
revoke all on farm.helps from public, anon, authenticated;

create function public.farm_help_v1(p_host uuid, p_tile int)
returns json language plpgsql security definer set search_path = '' as $$
declare uid uuid := farm.me(); today date := (now() at time zone 'utc')::date; mine int; total int;
begin
  if p_host is null or p_host = uid then return json_build_object('ok', false, 'code', 'self'); end if;
  if p_tile is null or p_tile < 0 or p_tile > 100000 then return json_build_object('ok', false, 'code', 'bad'); end if;
  if farm.blocked(uid, p_host) or not farm.are_friends(uid, p_host) then return json_build_object('ok', false, 'code', 'friends'); end if;
  if not exists (select 1 from farm.visits where host = p_host and visitor = uid and day = today) then
    return json_build_object('ok', false, 'code', 'visit');
  end if;
  perform pg_advisory_xact_lock(hashtextextended('farm_help:' || uid::text, 0)); -- two taps at once count once
  select count(*) filter (where host = p_host), count(*) into mine, total from farm.helps where helper = uid and day = today;
  if mine >= 5 or total >= 25 then return json_build_object('ok', false, 'code', 'limit', 'left', 0); end if;
  insert into farm.helps (host, helper, tile) values (p_host, uid, p_tile) on conflict do nothing;
  if not found then return json_build_object('ok', false, 'code', 'done', 'left', 5 - mine); end if;
  if mine = 0 then perform farm.alert(p_host, uid, 'help', 'watered your crops'); end if;
  return json_build_object('ok', true, 'left', 4 - mine);
end $$;

create function public.farm_helps_v1()
returns json language plpgsql security definer set search_path = '' as $$
declare uid uuid := farm.me(); out json;
begin
  with taken as (
    update farm.helps h set claimed = true
    where h.ctid in (select ctid from farm.helps where host = uid and not claimed limit 500)
    returning h.tile, h.helper)
  select json_build_object(
    'tiles', coalesce(json_agg(distinct t.tile), '[]'::json),
    'from', coalesce(json_agg(distinct pl.farm_name), '[]'::json))
  into out from taken t join farm.players pl on pl.user_id = t.helper;
  return out;
end $$;

revoke all on function public.farm_help_v1(uuid, int), public.farm_helps_v1() from public, anon;
grant execute on function public.farm_help_v1(uuid, int), public.farm_helps_v1() to authenticated;
reset lock_timeout;

-- ---------- to undo part 6 ----------
-- drop function if exists public.farm_help_v1(uuid, int), public.farm_helps_v1();
-- drop table if exists farm.helps;
