-- Harvest Ville online, part 12 (2 Nov 2026): the Town Goal and Best Farm of the Week. Run AFTER parts 1-11.
-- Adds tables and functions, and one trigger on farm.visits; replaces nothing and needs no app update (an older app
-- never calls these). Safe to run twice. Runs fine as ONE transaction in the SQL editor.
-- Weeks run Monday 00:00 to Sunday 24:00 Philippine time: farm.week_ph() gives that week's Monday.
--   TOWN GOAL. One target a week that all players add to, crops one week and ore the next.
--     farm_town_goal_v1(): the week's target, the shared total, what I gave, the prize.
--     farm_town_give_v1(n): I give n things. The game takes them out of the bag only after this answers, and only as many
--       as it says. The server keeps the sum and takes at most 40 a day from a player, whatever is asked, so a modified
--       game can add at most 280 a week, and a target of 1,000 takes real players.
--     farm_town_claim_v1(): if the target was reached and I gave at least 10, the prize, once a week.
--   BEST FARM OF THE WEEK. The farm with the most likes in a week. A like is counted here at the moment it is given, by a
--     trigger on farm.visits, because farm.visits keeps a UTC day and the week ends at Philippine midnight. farm_like_v1
--     already allows one like a day from one visitor to one farm, and a guest's like does not count.
--     Winner: most likes; a tie goes to the farm that reached that number first, then to the lower id. Only farms that
--     really played that week (2+ days), never hidden, guest, banned or suspended ones, as with the rank prizes.
--     The winner is written once and stays.
--     farm_best_v1(): last week's winner (the game draws a crown by that farm) and this week's likes.
--     farm_best_claim_v1(): the winner's prize, once.
--   Prizes: the amounts are here, the game never sends one. A claim is a row with (player, week) as its key, so a second
--   claim, at the same moment or later, finds the row and pays nothing. Claims stay open for the 4 weeks after a week ends.
--   To change the target of a week: update farm.town_weeks set target = 1500 where week = '2026-11-09';
set lock_timeout = '5s';

-- ---------- helpers (not callable by clients) ----------
-- The numbers of this part, in one place.
create or replace function farm.town_rules(out day_cap int, out min_give int, out crop_target int, out ore_target int,
  out gold int, out stars int, out best_gold int, out best_stars int)
language sql immutable set search_path = '' as $$
  select 40, 10, 1000, 400, 1000, 1, 5000, 5;
$$;

create or replace function farm.week_ph(t timestamptz) returns date
language sql stable set search_path = '' as $$
  select (t at time zone 'Asia/Manila')::date - (extract(isodow from (t at time zone 'Asia/Manila'))::int - 1);
$$;

-- A guest, or an account closed to prizes?
create or replace function farm.prize_ok(p_user uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select not exists (select 1 from public.profiles p where p.auth_user_id = p_user
    and (coalesce(p.is_guest, false) or p.is_banned or p.suspended_until > now() or p.deleted_at is not null));
$$;

-- ---------- tables ----------
create table if not exists farm.town_weeks (
  week date primary key,
  kind text not null check (kind in ('crop', 'ore')),
  target int not null check (target > 0),
  created_at timestamptz not null default now()
);
-- what a player gave, one row a day (the sum is the shared total)
create table if not exists farm.town_gives (
  week date not null references farm.town_weeks (week) on delete cascade,
  user_id uuid not null references farm.players (user_id) on delete cascade,
  day date not null,
  n int not null check (n between 1 and 40),
  primary key (week, user_id, day)
);
create index if not exists town_gives_by_user on farm.town_gives (user_id, week);
create table if not exists farm.town_claims (
  user_id uuid not null references farm.players (user_id) on delete cascade,
  week date not null,
  gold int not null,
  stars int not null,
  created_at timestamptz not null default now(),
  primary key (user_id, week)
);
-- likes a farm got in a Philippine week, and when it got the last one (a tie's first-come)
create table if not exists farm.week_likes (
  week date not null,
  host uuid not null references farm.players (user_id) on delete cascade,
  likes int not null default 0 check (likes >= 0),
  last_at timestamptz not null default now(),
  primary key (week, host)
);
-- the week's winner, written once (winner null: nobody qualified)
create table if not exists farm.best_weeks (
  week date primary key,
  winner uuid references farm.players (user_id) on delete set null,
  likes int not null default 0,
  decided_at timestamptz not null default now()
);
create table if not exists farm.best_claims (
  user_id uuid not null references farm.players (user_id) on delete cascade,
  week date not null,
  gold int not null,
  stars int not null,
  created_at timestamptz not null default now(),
  primary key (user_id, week)
);
alter table farm.town_weeks enable row level security;
alter table farm.town_gives enable row level security;
alter table farm.town_claims enable row level security;
alter table farm.week_likes enable row level security;
alter table farm.best_weeks enable row level security;
alter table farm.best_claims enable row level security;
revoke all on farm.town_weeks, farm.town_gives, farm.town_claims, farm.week_likes, farm.best_weeks, farm.best_claims from public, anon, authenticated;

-- ---------- the town goal ----------
-- This week's row, made by the first one to ask: crops on even weeks, ore on odd ones.
create or replace function farm.town_week(p_week date) returns farm.town_weeks
language plpgsql security definer set search_path = '' as $$
declare w farm.town_weeks; r record := farm.town_rules();
begin
  insert into farm.town_weeks (week, kind, target)
  select p_week, k, case k when 'crop' then r.crop_target else r.ore_target end
  from (select case when ((p_week - date '2026-01-05') / 7) % 2 = 0 then 'crop' else 'ore' end as k) x
  on conflict (week) do nothing;
  select * into w from farm.town_weeks where week = p_week;
  return w;
end $$;

create or replace function public.farm_town_goal_v1()
returns json language plpgsql security definer set search_path = '' as $$
declare uid uuid := farm.me(); wk date := farm.week_ph(now()); today date := (now() at time zone 'Asia/Manila')::date;
  w farm.town_weeks := farm.town_week(wk); r record := farm.town_rules(); total bigint; givers bigint; mine bigint; done_today int;
begin
  select coalesce(sum(g.n), 0), count(distinct g.user_id), coalesce(sum(g.n) filter (where g.user_id = uid), 0),
    coalesce(sum(g.n) filter (where g.user_id = uid and g.day = today), 0)
  into total, givers, mine, done_today from farm.town_gives g where g.week = wk;
  return json_build_object('week', wk, 'kind', w.kind, 'target', w.target, 'total', total, 'givers', givers, 'mine', mine,
    'left_today', r.day_cap - done_today, 'day_cap', r.day_cap, 'min', r.min_give, 'gold', r.gold, 'stars', r.stars,
    'ends_in', extract(epoch from ((wk + 7)::timestamp at time zone 'Asia/Manila') - now())::int, 'can_give', farm.prize_ok(uid));
end $$;

-- Gives up to p_n. 'given' is what the server took: the game removes that many from the bag, no more.
create or replace function public.farm_town_give_v1(p_n int)
returns json language plpgsql security definer set search_path = '' as $$
declare uid uuid := farm.me(); wk date := farm.week_ph(now()); today date := (now() at time zone 'Asia/Manila')::date;
  r record := farm.town_rules(); had int; took int;
begin
  if p_n is null or p_n < 1 then return json_build_object('ok', false, 'code', 'bad', 'given', 0); end if;
  if not farm.prize_ok(uid) then return json_build_object('ok', false, 'code', 'guest', 'given', 0); end if;
  perform farm.town_week(wk);
  perform pg_advisory_xact_lock(hashtextextended('farm_town:' || uid::text, 0)); -- two taps at once count once
  select coalesce(sum(g.n), 0) into had from farm.town_gives g where g.week = wk and g.user_id = uid and g.day = today;
  took := least(p_n, r.day_cap - had);
  if took <= 0 then return json_build_object('ok', false, 'code', 'limit', 'given', 0, 'left_today', 0); end if;
  insert into farm.town_gives (week, user_id, day, n) values (wk, uid, today, took)
  on conflict (week, user_id, day) do update set n = farm.town_gives.n + excluded.n;
  return json_build_object('ok', true, 'given', took, 'left_today', r.day_cap - had - took);
end $$;

-- My prizes from finished weeks: the target was reached and I gave enough. The insert decides: one row, one payment.
create or replace function public.farm_town_claim_v1()
returns json language plpgsql security definer set search_path = '' as $$
declare uid uuid := farm.me(); wk date := farm.week_ph(now()); r record := farm.town_rules(); out json;
begin
  if not farm.prize_ok(uid) then return '[]'::json; end if;
  with won as (
    insert into farm.town_claims (user_id, week, gold, stars)
    select uid, w.week, r.gold, r.stars from farm.town_weeks w
    where w.week < wk and w.week >= wk - 28
      and (select sum(g.n) from farm.town_gives g where g.week = w.week) >= w.target
      and (select sum(g.n) from farm.town_gives g where g.week = w.week and g.user_id = uid) >= r.min_give
    on conflict (user_id, week) do nothing
    returning week, gold, stars)
  select coalesce(json_agg(json_build_object('week', won.week, 'gold', won.gold, 'stars', won.stars)), '[]'::json) into out from won;
  return out;
end $$;

-- ---------- best farm of the week ----------
-- Counts a like the moment it is given. A problem here never stops the like.
create or replace function farm.visits_week_like()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.profiles p where p.auth_user_id = new.visitor and coalesce(p.is_guest, false)) then return new; end if;
  insert into farm.week_likes (week, host, likes, last_at) values (farm.week_ph(now()), new.host, 1, now())
  on conflict (week, host) do update set likes = farm.week_likes.likes + 1, last_at = excluded.last_at;
  return new;
exception
  when query_canceled then raise;
  when others then return new;
end $$;

drop trigger if exists visits_week_like on farm.visits;
create trigger visits_week_like after update of liked on farm.visits
  for each row when (new.liked and not old.liked)
  execute function farm.visits_week_like();

-- The winner of a finished week, worked out the first time it is asked for, then kept. (null for a week not over yet)
create or replace function farm.best_of(p_week date) returns farm.best_weeks
language plpgsql security definer set search_path = '' as $$
declare b farm.best_weeks;
begin
  if p_week >= farm.week_ph(now()) then return null; end if;
  select * into b from farm.best_weeks where week = p_week;
  if found then return b; end if;
  perform pg_advisory_xact_lock(hashtextextended('farm_best:' || p_week::text, 0));
  insert into farm.best_weeks (week, winner, likes)
  select p_week, top.host, coalesce(top.likes, 0) from (select 1) one
  left join lateral (
    select wl.host, wl.likes from farm.week_likes wl
    join farm.players pl on pl.user_id = wl.host
    where wl.week = p_week and wl.likes > 0 and not pl.hidden and farm.prize_ok(wl.host)
      and (select count(*) from farm.play_days pd where pd.user_id = wl.host and pd.day >= p_week and pd.day < p_week + 7) >= 2
    order by wl.likes desc, wl.last_at, wl.host limit 1) top on true
  on conflict (week) do nothing;
  select * into b from farm.best_weeks where week = p_week;
  return b;
end $$;

create or replace function public.farm_best_v1()
returns json language plpgsql security definer set search_path = '' as $$
declare uid uuid := farm.me(); wk date := farm.week_ph(now()); b farm.best_weeks := farm.best_of(wk - 7); r record := farm.town_rules(); who json; top int;
begin
  select json_build_object('id', pl.user_id, 'farm_name', pl.farm_name, 'likes', b.likes, 'week', b.week) into who
  from farm.players pl where pl.user_id = b.winner and not pl.hidden and not farm.blocked(uid, pl.user_id);
  select max(wl.likes) into top from farm.week_likes wl where wl.week = wk;
  return json_build_object('last', who, 'top', coalesce(top, 0),
    'mine', coalesce((select wl.likes from farm.week_likes wl where wl.week = wk and wl.host = uid), 0),
    'gold', r.best_gold, 'stars', r.best_stars);
end $$;

-- The winner's prize. As with the town goal, the insert decides.
create or replace function public.farm_best_claim_v1()
returns json language plpgsql security definer set search_path = '' as $$
declare uid uuid := farm.me(); wk date := farm.week_ph(now()); r record := farm.town_rules(); b farm.best_weeks; n int; paid json[] := '{}';
begin
  if not farm.prize_ok(uid) then return '[]'::json; end if;
  for n in 1 .. 4 loop
    b := farm.best_of(wk - 7 * n);
    if b.winner is distinct from uid then continue; end if;
    insert into farm.best_claims (user_id, week, gold, stars) values (uid, b.week, r.best_gold, r.best_stars) on conflict (user_id, week) do nothing;
    if found then paid := paid || json_build_object('week', b.week, 'likes', b.likes, 'gold', r.best_gold, 'stars', r.best_stars); end if;
  end loop;
  return array_to_json(paid);
end $$;

-- ---------- who may call what (restated on every run: a recreated function comes back open) ----------
revoke all on function farm.town_rules(), farm.week_ph(timestamptz), farm.prize_ok(uuid), farm.town_week(date), farm.visits_week_like(), farm.best_of(date)
  from public, anon, authenticated;
do $$
declare f text;
begin
  foreach f in array array['farm_town_goal_v1()', 'farm_town_give_v1(int)', 'farm_town_claim_v1()', 'farm_best_v1()', 'farm_best_claim_v1()']
  loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
reset lock_timeout;

-- ---------- to undo part 12 ----------
-- drop trigger if exists visits_week_like on farm.visits;
-- drop function if exists public.farm_town_goal_v1(), public.farm_town_give_v1(int), public.farm_town_claim_v1(), public.farm_best_v1(), public.farm_best_claim_v1(),
--   farm.visits_week_like(), farm.best_of(date), farm.town_week(date), farm.prize_ok(uuid), farm.week_ph(timestamptz), farm.town_rules();
-- drop table if exists farm.best_claims, farm.best_weeks, farm.week_likes, farm.town_claims, farm.town_gives, farm.town_weeks;
