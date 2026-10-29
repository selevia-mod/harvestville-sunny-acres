-- Harvest Ville online, part 9 (30 Oct 2026): giving items to a friend you play with (players asked: "give your friend
-- food in the mine when they are tired"). Run AFTER parts 1-8.
-- Adds one table (farm.gives) and two functions; replaces nothing, touches no Selebox table.
--   farm_give_v1(to, item, n): you give a friend up to 99 of one item from your bag. It waits for them on the server
--     until their game takes it (at once while they play). Friends only; up to 30 gives a day in all and 10 a day to
--     the same friend. The first give of the day to a friend sends them a push.
--   farm_gives_v1(): the items friends gave you since you last looked (taken once), and who it was.
set lock_timeout = '5s';

create table farm.gives (
  id bigint generated always as identity primary key,
  giver uuid not null references farm.players (user_id) on delete cascade,
  taker uuid not null references farm.players (user_id) on delete cascade,
  day date not null default ((now() at time zone 'utc')::date),
  item text not null check (item ~ '^[a-z][a-z0-9_]{0,23}$'),
  n int not null check (n between 1 and 99),
  claimed boolean not null default false,
  created_at timestamptz not null default now(),
  check (giver <> taker)
);
create index gives_waiting on farm.gives (taker) where not claimed;
create index gives_by_giver on farm.gives (giver, day);
alter table farm.gives enable row level security;
revoke all on farm.gives from public, anon, authenticated;

create function public.farm_give_v1(p_to uuid, p_item text, p_n int)
returns json language plpgsql security definer set search_path = '' as $$
declare uid uuid := farm.me(); today date := (now() at time zone 'utc')::date; them int; total int;
begin
  if p_to is null or p_to = uid then return json_build_object('ok', false, 'code', 'self'); end if;
  if p_item is null or p_item !~ '^[a-z][a-z0-9_]{0,23}$' or p_n is null or p_n < 1 or p_n > 99 then
    return json_build_object('ok', false, 'code', 'bad');
  end if;
  if farm.blocked(uid, p_to) or not farm.are_friends(uid, p_to) then return json_build_object('ok', false, 'code', 'friends'); end if;
  perform pg_advisory_xact_lock(hashtextextended('farm_give:' || uid::text, 0)); -- two taps at once count once
  select count(*) filter (where taker = p_to), count(*) into them, total from farm.gives where giver = uid and day = today;
  if them >= 10 or total >= 30 then return json_build_object('ok', false, 'code', 'limit'); end if;
  insert into farm.gives (giver, taker, item, n) values (uid, p_to, p_item, p_n);
  if them = 0 then perform farm.alert(p_to, uid, 'give', 'gave you something in Harvest Ville'); end if;
  return json_build_object('ok', true, 'left', least(9 - them, 29 - total));
end $$;

create function public.farm_gives_v1()
returns json language plpgsql security definer set search_path = '' as $$
declare uid uuid := farm.me(); out json;
begin
  with taken as (
    update farm.gives g set claimed = true
    where g.id in (select id from farm.gives where taker = uid and not claimed order by id limit 100)
    returning g.item, g.n, g.giver)
  select json_build_object(
    'gives', coalesce(json_agg(json_build_array(t.item, t.n)), '[]'::json),
    'from', coalesce((select json_agg(distinct pl.farm_name) from taken t2 join farm.players pl on pl.user_id = t2.giver), '[]'::json))
  into out from taken t;
  return out;
end $$;

revoke all on function public.farm_give_v1(uuid, text, int), public.farm_gives_v1() from public, anon;
grant execute on function public.farm_give_v1(uuid, text, int), public.farm_gives_v1() to authenticated;
reset lock_timeout;

-- ---------- to undo part 9 ----------
-- drop function if exists public.farm_give_v1(uuid, text, int), public.farm_gives_v1();
-- drop table if exists farm.gives;
