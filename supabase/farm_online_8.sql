-- Harvest Ville online, part 8 (29 Oct 2026): picking a friend's ripe crops into their basket. Run AFTER parts 1-7.
-- Adds one table (farm.picks) and two functions; replaces nothing, touches no Selebox table.
--   farm_pick_v1(host, tile, crop): on a friend's farm you visited today, you pick one of their ripe crops; it waits in
--     their Harvest Basket. Up to 5 per friend a day and 25 a day in all (the game pays the picker 20G a crop). A tile
--     waits once (two friends can't pick the same crop). The first pick of the day sends the friend a push.
--   farm_picks_v1(): at home, the crops friends picked for you since you last looked (taken once), and who it was. The
--     game puts a crop in the basket only if that tile is still ripe with that crop, so nothing is picked twice.
set lock_timeout = '5s';

create table farm.picks (
  host uuid not null references farm.players (user_id) on delete cascade,
  picker uuid not null references farm.players (user_id) on delete cascade,
  day date not null default ((now() at time zone 'utc')::date),
  tile int not null check (tile between 0 and 100000),
  crop text not null check (crop ~ '^[a-z][a-z_]{0,23}$'),
  claimed boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (host, picker, day, tile),
  check (host <> picker)
);
create unique index picks_one_waiting on farm.picks (host, tile) where not claimed;
create index picks_by_picker on farm.picks (picker, day);
alter table farm.picks enable row level security;
revoke all on farm.picks from public, anon, authenticated;

create function public.farm_pick_v1(p_host uuid, p_tile int, p_crop text)
returns json language plpgsql security definer set search_path = '' as $$
declare uid uuid := farm.me(); today date := (now() at time zone 'utc')::date; mine int; total int;
begin
  if p_host is null or p_host = uid then return json_build_object('ok', false, 'code', 'self'); end if;
  if p_tile is null or p_tile < 0 or p_tile > 100000 or p_crop is null or p_crop !~ '^[a-z][a-z_]{0,23}$' then
    return json_build_object('ok', false, 'code', 'bad');
  end if;
  if farm.blocked(uid, p_host) or not farm.are_friends(uid, p_host) then return json_build_object('ok', false, 'code', 'friends'); end if;
  if not exists (select 1 from farm.visits where host = p_host and visitor = uid and day = today) then
    return json_build_object('ok', false, 'code', 'visit');
  end if;
  perform pg_advisory_xact_lock(hashtextextended('farm_pick:' || uid::text, 0)); -- two taps at once count once
  perform pg_advisory_xact_lock(hashtextextended('farm_pick_tile:' || p_host::text || ':' || p_tile, 0)); -- two friends, one crop
  select count(*) filter (where host = p_host), count(*) into mine, total from farm.picks where picker = uid and day = today;
  if mine >= 5 or total >= 25 then return json_build_object('ok', false, 'code', 'limit', 'left', 0); end if;
  insert into farm.picks (host, picker, tile, crop) values (p_host, uid, p_tile, p_crop) on conflict do nothing;
  if not found then return json_build_object('ok', false, 'code', 'done', 'left', 5 - mine); end if;
  if mine = 0 then perform farm.alert(p_host, uid, 'pick', 'picked your ripe crops into your basket'); end if;
  return json_build_object('ok', true, 'left', 4 - mine);
end $$;

create function public.farm_picks_v1()
returns json language plpgsql security definer set search_path = '' as $$
declare uid uuid := farm.me(); out json;
begin
  with taken as (
    update farm.picks p set claimed = true
    where p.ctid in (select ctid from farm.picks where host = uid and not claimed limit 200)
    returning p.tile, p.crop, p.picker)
  select json_build_object(
    'picks', coalesce(json_agg(json_build_array(t.tile, t.crop)), '[]'::json),
    'from', coalesce((select json_agg(distinct pl.farm_name) from taken t2 join farm.players pl on pl.user_id = t2.picker), '[]'::json))
  into out from taken t;
  return out;
end $$;

revoke all on function public.farm_pick_v1(uuid, int, text), public.farm_picks_v1() from public, anon;
grant execute on function public.farm_pick_v1(uuid, int, text), public.farm_picks_v1() to authenticated;
reset lock_timeout;

-- ---------- to undo part 8 ----------
-- drop function if exists public.farm_pick_v1(uuid, int, text), public.farm_picks_v1();
-- drop table if exists farm.picks;
