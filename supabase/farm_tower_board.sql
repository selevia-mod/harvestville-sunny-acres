-- Harvest Ville online: The Lost Tower's weekly board and First in Selebox (12 Nov 2026). Run AFTER part 22 (Town Rank
-- and the Hall of Fame). It needs only part 1 (farm.players, farm.me, farm.blocked) and part 22 (farm.hall_first_keys).
-- (The same file as ~/Downloads/tower-board-SQL/APPLY-tower-board.sql; the game's side: src/*tower-board*.js.)
--   First in Selebox (owner, 12 Nov 2026): the first player ever to beat each of the Tower's ten big bosses (floors 100,
--   200 ... 1000). Ten more rows in farm.hall_first_keys: the game claims them with farm_hall_first_v1 as the Hall's other
--   firsts (first come wins, once), and farm_hall_v1 already gives their names (the game shows them on the lighthouse wall).
--   The weekly board ("Manila's Hall of Fame"): ranked by NEW Tower floors cleared this week, Manila's week (Monday 00:00
--   Asia/Manila to the next Monday). The game reports each floor the first time a player clears it, each send with its
--   own id. Each floor (1 to 1000) counts once per player, ever; at most day_cap new floors (100) a Manila day count, so a
--   changed game cannot climb the board faster than an honest one could. Ties go to whoever got there first.
--   Last week's prizes, claimed by the game once (one claim a player a week, made by the server from last week's final
--   board): 1st 300 Pearls (and the gold frame and "Lighthouse Champion" title for the week, kept in the claim for when
--   the game shows frames), 2nd 200 (silver frame), 3rd 150 (bronze frame), 4th-10th 50, everyone else with 10+ new
--   floors 10. A claim asked again gives the same claim (the same id): the game pays each id once, so an answer lost on the
--   way is paid on the next ask, never twice. Every number is in farm.tower_board_config.
--   Hidden players (after reports) are not on the board and win nothing; blocked players' names are not shown.
-- Additive: five new tables, new functions, ten rows in farm.hall_first_keys. Nothing that exists changes. Safe to run twice.
--   farm_tower_floor_v1(p_floors int[], p_request_id uuid)  { ok, added, took: [floors it has], again, left, week, floors, rank } | { ok: false, code }
--   farm_tower_board_v1()                                   { week, top: [{ rank, id, name, floors }] (10), me: { floors, rank }, champ, prizes }
--   farm_tower_week_prize_v1()                              { ok, id, week, rank, floors, pearls, frame, title, again } | { ok: false, code }
set local lock_timeout = '5s';

-- ---------- the numbers ----------
create table if not exists farm.tower_board_config (
  id int primary key default 1 check (id = 1),
  cfg jsonb not null
);
insert into farm.tower_board_config (id, cfg) values (1, jsonb_build_object(
  'day_cap', 100,        -- new floors that count for one player in one Manila day
  'per_call', 50,        -- floors in one send
  'prizes', jsonb_build_array(300, 200, 150, 50, 50, 50, 50, 50, 50, 50), -- Pearls for places 1 to 10
  'every_floors', 10,    -- everyone else with at least this many new floors last week ...
  'every_pearls', 10,    -- ... gets this many Pearls
  'frames', jsonb_build_array('gold', 'silver', 'bronze'), -- places 1 to 3, for the week
  'title', 'Lighthouse Champion' -- place 1, for the week (and the lighthouse banner)
)) on conflict (id) do nothing;
alter table farm.tower_board_config enable row level security;
revoke all on table farm.tower_board_config from public, anon, authenticated;

-- ---------- the tables ----------
-- Each floor a player has cleared since the board came (once ever: the primary key), with the Manila day and week it counted in
create table if not exists farm.tower_clears (
  user_id uuid not null references farm.players (user_id) on delete cascade,
  floor int not null check (floor between 1 and 1000),
  day date not null,   -- (Manila's date)
  week date not null,  -- (the Monday, Manila)
  at timestamptz not null default now(),
  primary key (user_id, floor)
);
create index if not exists tower_clears_day on farm.tower_clears (user_id, day);
-- New floors each week. at: when they last went up (a tie goes to whoever got there first).
create table if not exists farm.tower_weeks (
  user_id uuid not null references farm.players (user_id) on delete cascade,
  week date not null,
  floors int not null default 0 check (floors >= 0),
  at timestamptz not null default now(),
  primary key (week, user_id)
);
create index if not exists tower_weeks_board on farm.tower_weeks (week, floors desc, at);
-- The ids of sends already seen (kept 3 days: a phone tries an unanswered send again within minutes)
create table if not exists farm.tower_requests (
  id uuid primary key,
  user_id uuid not null references farm.players (user_id) on delete cascade,
  at timestamptz not null default now()
);
create index if not exists tower_requests_user on farm.tower_requests (user_id, at);
-- Last week's prizes, one a player a week. id: what the game pays by (once).
create table if not exists farm.tower_week_claims (
  user_id uuid not null references farm.players (user_id) on delete cascade,
  week date not null,
  id uuid not null unique default gen_random_uuid(),
  rank int,            -- (null: not in the top 10)
  floors int not null,
  pearls int not null check (pearls >= 0),
  frame text,          -- 'gold' | 'silver' | 'bronze' | null, for the week after
  title text,          -- 'Lighthouse Champion' | null, for the week after
  claimed_at timestamptz not null default now(),
  primary key (user_id, week)
);
alter table farm.tower_clears enable row level security; -- (no policies: only the functions below read or write them)
alter table farm.tower_weeks enable row level security;
alter table farm.tower_requests enable row level security;
alter table farm.tower_week_claims enable row level security;
revoke all on table farm.tower_clears, farm.tower_weeks, farm.tower_requests, farm.tower_week_claims from public, anon, authenticated;

-- First in Selebox: the ten big bosses (the game's C.HALL.FIRSTS, src/00-zzzzzzzzzzzzzzzzzzzzzzzz-tower-board.js)
insert into farm.hall_first_keys (key, what) values
  ('tower_100', 'Tambanakua, floor 100 of The Lost Tower'), ('tower_200', 'Pugita, floor 200 of The Lost Tower'),
  ('tower_300', 'Berberoka, floor 300 of The Lost Tower'), ('tower_400', 'Magindara, floor 400 of The Lost Tower'),
  ('tower_500', 'Galura, floor 500 of The Lost Tower'), ('tower_600', 'Kataw King, floor 600 of The Lost Tower'),
  ('tower_700', 'Great Santelmo, floor 700 of The Lost Tower'), ('tower_800', 'Minokawa, floor 800 of The Lost Tower'),
  ('tower_900', 'Star Keeper, floor 900 of The Lost Tower'), ('tower_1000', 'Bakunawa of the Bay, floor 1000 of The Lost Tower')
on conflict (key) do nothing;

-- ---------- helpers (not callable by clients) ----------
create or replace function farm.tower_cfg() returns jsonb
language sql stable security definer set search_path = '' as $$ select cfg from farm.tower_board_config where id = 1 $$;
-- the Monday (Manila) of the week a moment falls in
create or replace function farm.tower_week(t timestamptz) returns date
language sql stable set search_path = '' as $$ select date_trunc('week', t at time zone 'Asia/Manila')::date $$;

-- A week's board, best first: rank (among players not hidden), id, name, new floors.
create or replace function farm.tower_top(p_week date, p_n int) returns table (rank int, user_id uuid, farm_name text, floors int)
language sql stable security definer set search_path = '' as $$
  select (row_number() over (order by w.floors desc, w.at, w.user_id))::int, w.user_id, pl.farm_name, w.floors
  from farm.tower_weeks w join farm.players pl on pl.user_id = w.user_id
  where w.week = p_week and w.floors > 0 and not pl.hidden
  order by w.floors desc, w.at, w.user_id
  limit p_n;
$$;
-- A player's week: { week, floors, rank (null: no new floors yet, or hidden) }
create or replace function farm.tower_me(p_user uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare wk date := farm.tower_week(now()); n int; t timestamptz; place int; hid boolean;
begin
  select w.floors, w.at into n, t from farm.tower_weeks w where w.user_id = p_user and w.week = wk;
  select pl.hidden into hid from farm.players pl where pl.user_id = p_user;
  n := coalesce(n, 0);
  if n > 0 and not coalesce(hid, false) then
    select 1 + count(*) into place from farm.tower_weeks w join farm.players pl on pl.user_id = w.user_id
    where w.week = wk and not pl.hidden and w.user_id <> p_user
      and (w.floors > n or (w.floors = n and (w.at < t or (w.at = t and w.user_id < p_user))));
  end if;
  return jsonb_build_object('week', to_char(wk, 'YYYY-MM-DD'), 'floors', n, 'rank', place);
end $$;

revoke all on function farm.tower_cfg(), farm.tower_week(timestamptz), farm.tower_top(date, int), farm.tower_me(uuid)
  from public, anon, authenticated;

-- ---------- the functions the game calls ----------

-- New floors cleared (the first time). Each floor 1-1000 counts once per player ever, at most day_cap a Manila day; a
-- floor already counted is in `took` again (the game drops it from its list), a floor over today's cap is not (it waits).
-- An id already seen counts nothing new (a send tried again). One send at a time for each player (a lock).
create or replace function public.farm_tower_floor_v1(p_floors int[], p_request_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare uid uuid := farm.me(); c jsonb := farm.tower_cfg(); today date := (now() at time zone 'Asia/Manila')::date;
  wk date := farm.tower_week(now()); room int; f int; took int[] := '{}'; got int := 0; fresh boolean;
begin
  if p_request_id is null or p_floors is null or coalesce(cardinality(p_floors), 0) < 1
     or cardinality(p_floors) > coalesce((c->>'per_call')::int, 50) then
    return jsonb_build_object('ok', false, 'code', 'bad');
  end if;
  perform pg_advisory_xact_lock(hashtextextended('farm_tower:' || uid::text, 0));
  delete from farm.tower_requests where user_id = uid and at < now() - interval '3 days'; -- (each player's own old ids)
  insert into farm.tower_requests (id, user_id) values (p_request_id, uid) on conflict (id) do nothing;
  fresh := found;
  select greatest(0, coalesce((c->>'day_cap')::int, 100) - count(*)::int) into room from farm.tower_clears where user_id = uid and day = today;
  for f in select distinct x from unnest(p_floors) x where x between 1 and 1000 order by x loop
    if exists (select 1 from farm.tower_clears where user_id = uid and floor = f) then
      took := took || f;
    elsif fresh and room > 0 then
      insert into farm.tower_clears (user_id, floor, day, week) values (uid, f, today, wk);
      took := took || f;
      got := got + 1;
      room := room - 1;
    end if;
  end loop;
  if got > 0 then
    insert into farm.tower_weeks (user_id, week, floors, at) values (uid, wk, got, now())
    on conflict (week, user_id) do update set floors = farm.tower_weeks.floors + excluded.floors, at = now();
  end if;
  return farm.tower_me(uid) || jsonb_build_object('ok', true, 'added', got, 'took', to_jsonb(took), 'again', not fresh, 'left', room);
end $$;

-- This week's top 10 (without players you blocked or who blocked you), your week, and last week's first (the Lighthouse
-- Champion: the banner).
create or replace function public.farm_tower_board_v1()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare uid uuid := farm.me(); wk date := farm.tower_week(now()); ch record;
begin
  select t.user_id, t.farm_name, t.floors into ch from farm.tower_top(wk - 7, 1) t;
  return jsonb_build_object('week', to_char(wk, 'YYYY-MM-DD'), 'me', farm.tower_me(uid),
    'top', coalesce((select jsonb_agg(jsonb_build_object('rank', t.rank, 'id', t.user_id, 'name', t.farm_name, 'floors', t.floors) order by t.rank)
      from farm.tower_top(wk, 10) t where not farm.blocked(uid, t.user_id)), '[]'::jsonb),
    'champ', case when ch.user_id is null then null else jsonb_build_object('id', ch.user_id, 'floors', ch.floors,
      'name', case when farm.blocked(uid, ch.user_id) then null else ch.farm_name end) end,
    'prizes', farm.tower_cfg()->'prizes');
end $$;

-- Last week's prize, made once from last week's final board and kept: asked again, the same claim (the same id; the game
-- pays each id once). { ok: false, code: 'none' }: nothing won last week.
create or replace function public.farm_tower_week_prize_v1()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare uid uuid := farm.me(); c jsonb := farm.tower_cfg(); wk date := farm.tower_week(now()) - 7; rk int; n int; prize int;
  cl farm.tower_week_claims; fresh boolean := false;
begin
  perform pg_advisory_xact_lock(hashtextextended('farm_tower:' || uid::text, 0));
  select * into cl from farm.tower_week_claims where user_id = uid and week = wk;
  if not found then
    select w.floors into n from farm.tower_weeks w join farm.players pl on pl.user_id = w.user_id
    where w.user_id = uid and w.week = wk and not pl.hidden;
    if coalesce(n, 0) < 1 then return jsonb_build_object('ok', false, 'code', 'none'); end if;
    select t.rank into rk from farm.tower_top(wk, 10) t where t.user_id = uid;
    prize := case when rk is not null then coalesce((c->'prizes'->>(rk - 1))::int, 0)
                  when n >= coalesce((c->>'every_floors')::int, 10) then coalesce((c->>'every_pearls')::int, 10) else 0 end;
    if prize <= 0 then return jsonb_build_object('ok', false, 'code', 'none'); end if;
    insert into farm.tower_week_claims (user_id, week, rank, floors, pearls, frame, title)
    values (uid, wk, rk, n, prize, case when rk between 1 and 3 then c->'frames'->>(rk - 1) end, case when rk = 1 then c->>'title' end)
    on conflict (user_id, week) do nothing;
    fresh := found;
    select * into cl from farm.tower_week_claims where user_id = uid and week = wk;
  end if;
  return jsonb_build_object('ok', true, 'id', cl.id, 'week', to_char(cl.week, 'YYYY-MM-DD'), 'rank', cl.rank, 'floors', cl.floors,
    'pearls', cl.pearls, 'frame', cl.frame, 'title', cl.title, 'again', not fresh);
end $$;

revoke all on function public.farm_tower_floor_v1(int[], uuid), public.farm_tower_board_v1(), public.farm_tower_week_prize_v1()
  from public, anon, authenticated;
grant execute on function public.farm_tower_floor_v1(int[], uuid), public.farm_tower_board_v1(), public.farm_tower_week_prize_v1()
  to authenticated;

reset lock_timeout;
notify pgrst, 'reload schema';

-- ---------- to undo ----------
-- (first an app without the board: its game calls fail quietly without these, and the floors wait in the save)
-- drop function if exists public.farm_tower_floor_v1(int[], uuid), public.farm_tower_board_v1(), public.farm_tower_week_prize_v1(),
--   farm.tower_me(uuid), farm.tower_top(date, int), farm.tower_week(timestamptz), farm.tower_cfg();
-- drop table if exists farm.tower_week_claims, farm.tower_requests, farm.tower_weeks, farm.tower_clears, farm.tower_board_config;
-- delete from farm.hall_firsts where key like 'tower\_%';
-- delete from farm.hall_first_keys where key like 'tower\_%';
-- notify pgrst, 'reload schema';
