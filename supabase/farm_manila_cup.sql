-- Harvest Ville online: The Manila Cup's weekly board (18 Nov 2026; docs/superpowers/specs/2026-11-18-manila-cup-and-betting-design.md).
-- NOT APPLIED: the owner applies it. Run AFTER part 1 (farm.players, farm.me, farm.blocked). The game's side:
-- src/*manila-cup.js (until this is applied the game shows the player's own best time and "Results open soon").
--   The Manila Cup: a time trial on the oval in Manila, 3 laps and 6 hurdles, open all week, Monday 8 AM to Sunday 7 PM
--   (Manila time). The game sends a player's best ride of the week (its three lap times and its knocked hurdles), each send
--   with its own id. The server checks it against a perfect ride: no lap under floor_lap_ms (95% of the fastest lap the
--   track allows: its inner edge at the horse's top speed, the whole sprint bar every lap), the time is the laps plus
--   1.5 s a knocked hurdle. Only the best time of the week counts; ties go to whoever got there first.
--   Results at Sunday 7 PM. Prizes, claimed by the game once (one claim a player a week, from that week's final board):
--   1st 150,000 Gold and the Gold Horseshoe Cup and "Manila Cup Champion" on Manila's Hall of Fame for the week, 2nd
--   80,000 and the Silver Cup, 3rd 50,000 and the Bronze Cup, 4th-10th 20,000 and a ribbon. A claim asked again gives the
--   same claim (the same id): the game pays each id once, so an answer lost on the way is paid on the next ask, never twice.
--   (Everyone with 3 runs in a week gets 3,000 Gold and 3 oats from the game itself: no server needed.) Gold is the game's
--   own money: it cannot be bought with real money and cannot be traded between players. Every number is in
--   farm.mcup_config.
--   Hidden players (after reports) are not on the board and win nothing; blocked players' names are not shown.
-- Additive: four new tables, new functions. Nothing that exists changes. Safe to run twice.
--   farm_mcup_run_v1(p_request_id uuid, p_week date, p_laps int[], p_knocks int)  { ok, ms, best, rank, again } | { ok: false, code }
--   farm_mcup_board_v1()                                                       { week, open, top: [{ rank, id, name, ms }] (10), me: { ms, rank, runs }, champ, prizes }
--   farm_mcup_prize_v1()                                                       { ok, id, week, rank, ms, gold, cup, title, again } | { ok: false, code }
set local lock_timeout = '5s';

-- ---------- the numbers (the game's C.MANILA_CUP: src/00-zzzzzzzzzzzzzzzzzzzzzzzzzzzz-manila-cup.js) ----------
create table if not exists farm.mcup_config (
  id int primary key default 1 check (id = 1),
  cfg jsonb not null
);
insert into farm.mcup_config (id, cfg) values (1, jsonb_build_object(
  'laps', 3,              -- laps a ride
  'perfect_lap_ms', 8996, -- the fastest lap the track allows (the game's L.mcPerfect)
  'floor_lap_ms', 8546,   -- no lap under this counts (95% of a perfect lap)
  'knock_ms', 1500,       -- a knocked hurdle
  'max_knocks', 18,       -- 6 hurdles, 3 laps
  'open_min', 480,        -- Monday 8 AM (minutes after Monday midnight, Manila)
  'close_min', 1140,      -- Sunday 7 PM (minutes after Sunday midnight, Manila)
  'grace_min', 10,        -- a ride finished just after the close still counts when it arrives within this
  'prizes', jsonb_build_array(150000, 80000, 50000, 20000, 20000, 20000, 20000, 20000, 20000, 20000), -- Gold for places 1 to 10
  'cups', jsonb_build_array('gold', 'silver', 'bronze'), -- places 1 to 3 (4 to 10: 'ribbon')
  'title', 'Manila Cup Champion' -- place 1, on Manila's Hall of Fame for the week
)) on conflict (id) do nothing;
alter table farm.mcup_config enable row level security;
revoke all on table farm.mcup_config from public, anon, authenticated;

-- ---------- the tables ----------
-- Each player's best ride of each week (the Monday, Manila). at: when the best was set (a tie goes to the first).
create table if not exists farm.mcup_weeks (
  user_id uuid not null references farm.players (user_id) on delete cascade,
  week date not null,
  best_ms int not null check (best_ms > 0),
  laps int[] not null,
  knocks int not null default 0 check (knocks >= 0),
  runs int not null default 1 check (runs >= 0), -- (bests sent this week)
  at timestamptz not null default now(),
  primary key (week, user_id)
);
create index if not exists mcup_weeks_board on farm.mcup_weeks (week, best_ms, at);
-- The ids of sends already seen (kept 3 days: a phone tries an unanswered send again within minutes)
create table if not exists farm.mcup_requests (
  id uuid primary key,
  user_id uuid not null references farm.players (user_id) on delete cascade,
  at timestamptz not null default now()
);
create index if not exists mcup_requests_user on farm.mcup_requests (user_id, at);
-- A finished week's prizes, one a player a week. id: what the game pays by (once).
create table if not exists farm.mcup_claims (
  user_id uuid not null references farm.players (user_id) on delete cascade,
  week date not null,
  id uuid not null unique default gen_random_uuid(),
  rank int not null check (rank between 1 and 10),
  ms int not null,
  gold int not null check (gold >= 0),
  cup text not null,   -- 'gold' | 'silver' | 'bronze' | 'ribbon'
  title text,          -- 'Manila Cup Champion' | null
  claimed_at timestamptz not null default now(),
  primary key (user_id, week)
);
alter table farm.mcup_weeks enable row level security; -- (no policies: only the functions below read or write them)
alter table farm.mcup_requests enable row level security;
alter table farm.mcup_claims enable row level security;
revoke all on table farm.mcup_weeks, farm.mcup_requests, farm.mcup_claims from public, anon, authenticated;

-- ---------- helpers (not callable by clients) ----------
create or replace function farm.mcup_cfg() returns jsonb
language sql stable security definer set search_path = '' as $$ select cfg from farm.mcup_config where id = 1 $$;
-- the Monday (Manila) of the week a moment falls in
create or replace function farm.mcup_week(t timestamptz) returns date
language sql stable set search_path = '' as $$ select date_trunc('week', t at time zone 'Asia/Manila')::date $$;
-- when a week's cup closes (Sunday 7 PM, Manila), as Manila's wall clock
create or replace function farm.mcup_close(p_week date) returns timestamp
language sql stable security definer set search_path = '' as $$
  select p_week + 6 + make_interval(mins => coalesce((farm.mcup_cfg()->>'close_min')::int, 1140)) $$;
-- the Monday of the latest week whose results are out (its Sunday 7 PM has passed)
create or replace function farm.mcup_done(t timestamptz) returns date
language sql stable security definer set search_path = '' as $$
  select case when (t at time zone 'Asia/Manila') >= farm.mcup_close(farm.mcup_week(t)) then farm.mcup_week(t) else farm.mcup_week(t) - 7 end $$;

-- A week's board, best first: rank (among players not hidden), id, name, best time.
create or replace function farm.mcup_top(p_week date, p_n int) returns table (rank int, user_id uuid, farm_name text, best_ms int)
language sql stable security definer set search_path = '' as $$
  select (row_number() over (order by w.best_ms, w.at, w.user_id))::int, w.user_id, pl.farm_name, w.best_ms
  from farm.mcup_weeks w join farm.players pl on pl.user_id = w.user_id
  where w.week = p_week and not pl.hidden
  order by w.best_ms, w.at, w.user_id
  limit p_n;
$$;
-- A player's week: { week, ms, runs, rank (null: no ride yet, or hidden) }
create or replace function farm.mcup_me(p_user uuid, p_week date) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare n int; t timestamptz; r int; place int; hid boolean;
begin
  select w.best_ms, w.at, w.runs into n, t, r from farm.mcup_weeks w where w.user_id = p_user and w.week = p_week;
  select pl.hidden into hid from farm.players pl where pl.user_id = p_user;
  if n is not null and not coalesce(hid, false) then
    select 1 + count(*) into place from farm.mcup_weeks w join farm.players pl on pl.user_id = w.user_id
    where w.week = p_week and not pl.hidden and w.user_id <> p_user
      and (w.best_ms < n or (w.best_ms = n and (w.at < t or (w.at = t and w.user_id < p_user))));
  end if;
  return jsonb_build_object('week', to_char(p_week, 'YYYY-MM-DD'), 'ms', n, 'runs', coalesce(r, 0), 'rank', place);
end $$;

revoke all on function farm.mcup_cfg(), farm.mcup_week(timestamptz), farm.mcup_close(date), farm.mcup_done(timestamptz),
  farm.mcup_top(date, int), farm.mcup_me(uuid, date) from public, anon, authenticated;

-- ---------- the functions the game calls ----------

-- A ride: the week's best so far on this phone. Checked: this week's, sent while the cup is open (or within the grace
-- after the close), 3 laps none under the floor, the knocks in range. Kept only when it beats the player's best. An id
-- already seen changes nothing (a send tried again). One send at a time for each player (a lock).
create or replace function public.farm_mcup_run_v1(p_request_id uuid, p_week date, p_laps int[], p_knocks int)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare uid uuid := farm.me(); c jsonb := farm.mcup_cfg(); wk date := farm.mcup_week(now());
  here timestamp := now() at time zone 'Asia/Manila'; lap int; total int := 0; fresh boolean; old int;
begin
  if p_request_id is null or p_week is null or p_laps is null or p_knocks is null
     or coalesce(cardinality(p_laps), 0) <> coalesce((c->>'laps')::int, 3)
     or p_knocks < 0 or p_knocks > coalesce((c->>'max_knocks')::int, 18) then
    return jsonb_build_object('ok', false, 'code', 'bad');
  end if;
  if p_week <> wk or here < wk + make_interval(mins => coalesce((c->>'open_min')::int, 480))
     or here > farm.mcup_close(wk) + make_interval(mins => coalesce((c->>'grace_min')::int, 10)) then
    return jsonb_build_object('ok', false, 'code', 'week');
  end if;
  foreach lap in array p_laps loop
    if lap is null or lap < coalesce((c->>'floor_lap_ms')::int, 8546) or lap >= 600000 then
      return jsonb_build_object('ok', false, 'code', 'fast');
    end if;
    total := total + lap;
  end loop;
  total := total + p_knocks * coalesce((c->>'knock_ms')::int, 1500);
  perform pg_advisory_xact_lock(hashtextextended('farm_mcup:' || uid::text, 0));
  delete from farm.mcup_requests where user_id = uid and at < now() - interval '3 days'; -- (each player's own old ids)
  insert into farm.mcup_requests (id, user_id) values (p_request_id, uid) on conflict (id) do nothing;
  fresh := found;
  if fresh then
    select w.best_ms into old from farm.mcup_weeks w where w.user_id = uid and w.week = wk;
    if old is null then
      insert into farm.mcup_weeks (user_id, week, best_ms, laps, knocks, runs, at) values (uid, wk, total, p_laps, p_knocks, 1, now());
    elsif total < old then
      update farm.mcup_weeks set best_ms = total, laps = p_laps, knocks = p_knocks, runs = runs + 1, at = now() where user_id = uid and week = wk;
    else
      update farm.mcup_weeks set runs = runs + 1 where user_id = uid and week = wk;
    end if;
  end if;
  return farm.mcup_me(uid, wk) || jsonb_build_object('ok', true, 'again', not fresh, 'best', (select w.best_ms from farm.mcup_weeks w where w.user_id = uid and w.week = wk));
end $$;

-- This week's top 10 (without players you blocked or who blocked you), your week, and the champion of the latest finished
-- week (Manila's Hall of Fame).
create or replace function public.farm_mcup_board_v1()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare uid uuid := farm.me(); c jsonb := farm.mcup_cfg(); wk date := farm.mcup_week(now()); here timestamp := now() at time zone 'Asia/Manila'; ch record;
begin
  select t.user_id, t.farm_name, t.best_ms into ch from farm.mcup_top(farm.mcup_done(now()), 1) t;
  return jsonb_build_object('week', to_char(wk, 'YYYY-MM-DD'), 'me', farm.mcup_me(uid, wk),
    'open', here >= wk + make_interval(mins => coalesce((c->>'open_min')::int, 480)) and here < farm.mcup_close(wk),
    'top', coalesce((select jsonb_agg(jsonb_build_object('rank', t.rank, 'id', t.user_id, 'name', t.farm_name, 'ms', t.best_ms) order by t.rank)
      from farm.mcup_top(wk, 10) t where not farm.blocked(uid, t.user_id)), '[]'::jsonb),
    'champ', case when ch.user_id is null then null else jsonb_build_object('id', ch.user_id, 'ms', ch.best_ms,
      'name', case when farm.blocked(uid, ch.user_id) then null else ch.farm_name end) end,
    'prizes', c->'prizes');
end $$;

-- The latest finished week's prize, made once from that week's final board and kept: asked again, the same claim (the
-- same id; the game pays each id once). { ok: false, code: 'none' }: not in that week's top 10.
create or replace function public.farm_mcup_prize_v1()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare uid uuid := farm.me(); c jsonb := farm.mcup_cfg(); wk date := farm.mcup_done(now()); rk int; n int;
  cl farm.mcup_claims; fresh boolean := false;
begin
  perform pg_advisory_xact_lock(hashtextextended('farm_mcup:' || uid::text, 0));
  select * into cl from farm.mcup_claims where user_id = uid and week = wk;
  if not found then
    select t.rank, t.best_ms into rk, n from farm.mcup_top(wk, 10) t where t.user_id = uid;
    if rk is null then return jsonb_build_object('ok', false, 'code', 'none'); end if;
    insert into farm.mcup_claims (user_id, week, rank, ms, gold, cup, title)
    values (uid, wk, rk, n, coalesce((c->'prizes'->>(rk - 1))::int, 0), coalesce(c->'cups'->>(rk - 1), 'ribbon'), case when rk = 1 then c->>'title' end)
    on conflict (user_id, week) do nothing;
    fresh := found;
    select * into cl from farm.mcup_claims where user_id = uid and week = wk;
  end if;
  return jsonb_build_object('ok', true, 'id', cl.id, 'week', to_char(cl.week, 'YYYY-MM-DD'), 'rank', cl.rank, 'ms', cl.ms,
    'gold', cl.gold, 'cup', cl.cup, 'title', cl.title, 'again', not fresh);
end $$;

revoke all on function public.farm_mcup_run_v1(uuid, date, int[], int), public.farm_mcup_board_v1(), public.farm_mcup_prize_v1()
  from public, anon, authenticated;
grant execute on function public.farm_mcup_run_v1(uuid, date, int[], int), public.farm_mcup_board_v1(), public.farm_mcup_prize_v1()
  to authenticated;

reset lock_timeout;
notify pgrst, 'reload schema';

-- ---------- to undo ----------
-- (first an app without the cup's board: its game calls fail quietly without these, and the best time waits in the save)
-- drop function if exists public.farm_mcup_run_v1(uuid, date, int[], int), public.farm_mcup_board_v1(), public.farm_mcup_prize_v1(),
--   farm.mcup_me(uuid, date), farm.mcup_top(date, int), farm.mcup_done(timestamptz), farm.mcup_close(date), farm.mcup_week(timestamptz), farm.mcup_cfg();
-- drop table if exists farm.mcup_claims, farm.mcup_requests, farm.mcup_weeks, farm.mcup_config;
-- notify pgrst, 'reload schema';
