-- Harvest Ville online, part 22 (6 Nov 2026). Run AFTER part 21. It needs only part 1 (farm.players, farm.me,
-- farm.blocked), part 14 (farm.catch_kinds, farm.catches: the Biggest catch records) and part 15 (farm.derby: the
-- Fishing Derby); nothing from parts 20 or 21.
-- Town Rank and the Hall of Fame (owner, 6 Nov 2026).
--   Town Rank ("Town Rank is better than Hunter ranking"): one ranking each month of how much a player did for Harvest
--   Ville: farming, cooking and goods, fishing, mining, hunting, helping the town (and the Bayanihan Project when it
--   comes). The game sends its points about once a minute, one kind at a time, each send with its own id: an id is
--   counted once, so a send tried again never counts twice. Each kind has a daily cap (farm.rank_sources, by Manila's
--   day): a changed game cannot send more than an honest one could earn. Nothing bought gives points. Ranks by points
--   this month: Bronze 300, Silver 2,000, Gold 8,000, Champion 20,000 (farm.rank_tiers). A month is Manila's month: the
--   board starts over on the 1st, Philippine time. Old months are kept (one small row per player per month): they make
--   your best rank ever and the Hall's champions.
--   The Hall of Fame (Central Park's museum): the record holder for each animal (the biggest ever, from part 14's
--   weekly catches) and each Derby fish (part 15), the first player ever to beat each boss in farm.hall_first_keys
--   (first come wins, once), last month's Champions and who has been Champion most often, and this month's top 10.
--   farm.hall_more() is a hook for later parts (the Bayanihan Project's top givers): it gives extra plaques; this part
--   makes it (empty) only if it is not there yet, so a part that made it first keeps its own.
-- Additive: six new tables, one new index on part 14's farm.catches and one on part 15's farm.derby, new functions.
-- Nothing that exists changes. Safe to run twice.
--   farm_rank_add_v1(p_source, p_points, p_request_id)  { ok, added, month, points, tier, rank, best } | { ok: false, code }
--   farm_rank_board_v1()                                { month, top: [{ rank, id, name, points, tier }] (100), me }
--   farm_hall_v1()                                      { catches, fish, firsts, champs, top, more }
--   farm_hall_first_v1(p_key)                           { ok, first (true: it is yours), id, name } | { ok: false, code }
set local lock_timeout = '5s';

-- ---------- the rules ----------
-- Each kind of point and the most of it that counts in one Manila day (the game's own caps: src/00-zzzzzzzzzzz-rank.js).
-- A new kind is one more row. (Changing a cap: update farm.rank_sources set day_cap = ... where source = '...'.)
create table if not exists farm.rank_sources (
  source text primary key check (source ~ '^[a-z_]{1,20}$'),
  day_cap int not null check (day_cap between 1 and 100000)
);
insert into farm.rank_sources (source, day_cap) values
  ('farm', 300), ('goods', 150), ('fish', 150), ('mine', 150), ('hunt', 150), ('help', 300), ('bayanihan', 200)
on conflict (source) do nothing;
alter table farm.rank_sources enable row level security;
revoke all on table farm.rank_sources from public, anon, authenticated;

-- Points for each rank: Bronze, Silver, Gold, Champion (the game's C.RANK.tiers).
create or replace function farm.rank_tiers() returns int[]
language sql immutable set search_path = '' as $$ select array[300, 2000, 8000, 20000] $$;
-- 0 = no rank yet, 1 Bronze, 2 Silver, 3 Gold, 4 Champion
create or replace function farm.rank_tier(p int) returns int
language sql immutable set search_path = '' as $$ select count(*)::int from unnest(farm.rank_tiers()) t where coalesce(p, 0) >= t $$;
-- Manila's date now, and the 1st of the Manila month a moment falls in
create or replace function farm.manila_day() returns date
language sql stable set search_path = '' as $$ select (now() at time zone 'Asia/Manila')::date $$;
create or replace function farm.rank_month(t timestamptz) returns date
language sql stable set search_path = '' as $$ select date_trunc('month', t at time zone 'Asia/Manila')::date $$;

-- ---------- the tables ----------
-- Today's points of each kind (only the last few days are kept: they are only for the caps)
create table if not exists farm.rank_days (
  user_id uuid not null references farm.players (user_id) on delete cascade,
  day date not null, -- (Manila's date)
  source text not null references farm.rank_sources (source),
  points int not null default 0 check (points >= 0),
  primary key (user_id, day, source)
);
-- Each player's points in each month. at: when they last went up (a tie goes to whoever got there first).
create table if not exists farm.rank_months (
  user_id uuid not null references farm.players (user_id) on delete cascade,
  month date not null, -- (the 1st, Manila)
  points int not null default 0 check (points >= 0),
  at timestamptz not null default now(),
  primary key (month, user_id)
);
create index if not exists rank_months_board on farm.rank_months (month, points desc, at);
create index if not exists rank_months_user on farm.rank_months (user_id, month);
-- The ids of sends already counted (kept 3 days: a phone tries an unanswered send again within minutes)
create table if not exists farm.rank_requests (
  id uuid primary key,
  user_id uuid not null references farm.players (user_id) on delete cascade,
  at timestamptz not null default now()
);
create index if not exists rank_requests_user on farm.rank_requests (user_id, at);

-- The firsts there are (the allow-list: a key not here is refused). A new boss: one more row.
create table if not exists farm.hall_first_keys (
  key text primary key check (key ~ '^[a-z0-9_]{1,30}$'),
  what text not null
);
insert into farm.hall_first_keys (key, what) values
  ('bakunawa', 'the Bakunawa'),
  ('lair_10', 'the guard of floor 10 of the Lair'), ('lair_20', 'the guard of floor 20 of the Lair'),
  ('lair_30', 'the guard of floor 30 of the Lair'), ('lair_40', 'the guard of floor 40 of the Lair'),
  ('greatmammoth', 'the Great Mammoth')
on conflict (key) do nothing;
-- Who was first. (Leaving online play takes your name off: the first is free again.)
create table if not exists farm.hall_firsts (
  key text primary key references farm.hall_first_keys (key),
  user_id uuid not null references farm.players (user_id) on delete cascade,
  at timestamptz not null default now()
);
alter table farm.rank_days enable row level security; -- (no policies: only the functions below read or write them)
alter table farm.rank_months enable row level security;
alter table farm.rank_requests enable row level security;
alter table farm.hall_first_keys enable row level security;
alter table farm.hall_firsts enable row level security;
revoke all on table farm.rank_days, farm.rank_months, farm.rank_requests, farm.hall_first_keys, farm.hall_firsts from public, anon, authenticated;

-- the Hall's records: the biggest of each kind ever, quickly
create index if not exists catches_record on farm.catches (kind, kg10 desc, at);
create index if not exists derby_record on farm.derby (kind, g desc, at);

-- ---------- helpers (not callable by clients) ----------

-- A player's month: { month, points, tier, rank (null: no points yet), best (their best rank in any month) }.
-- Hidden players (after reports) are not on the board, so they do not push others down.
create or replace function farm.rank_me(p_user uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare mon date := farm.rank_month(now()); pts int; t timestamptz; place int; top int;
begin
  select points, at into pts, t from farm.rank_months where user_id = p_user and month = mon;
  pts := coalesce(pts, 0);
  if pts > 0 then
    select 1 + count(*) into place from farm.rank_months m join farm.players pl on pl.user_id = m.user_id
    where m.month = mon and not pl.hidden and m.user_id <> p_user and (m.points > pts or (m.points = pts and m.at < t));
  end if;
  select coalesce(max(points), 0) into top from farm.rank_months where user_id = p_user;
  return jsonb_build_object('month', to_char(mon, 'YYYY-MM'), 'points', pts, 'tier', farm.rank_tier(pts), 'rank', place,
    'best', farm.rank_tier(top));
end $$;

-- The month's board, best first: rank (among players not hidden), id, name, points, tier.
create or replace function farm.rank_top(p_month date, p_n int) returns table (rank int, user_id uuid, farm_name text, points int, tier int)
language sql stable security definer set search_path = '' as $$
  select (row_number() over (order by m.points desc, m.at))::int, m.user_id, pl.farm_name, m.points, farm.rank_tier(m.points)
  from farm.rank_months m join farm.players pl on pl.user_id = m.user_id
  where m.month = p_month and m.points > 0 and not pl.hidden
  order by m.points desc, m.at
  limit p_n;
$$;

-- Extra plaques for the Hall from later parts: [{ key, title, rows: [{ id, name, text }] }]. Made here only if no part
-- made it before (the Bayanihan Project's part replaces it with its top givers: key 'bayanihan').
do $do$
begin
  if to_regprocedure('farm.hall_more()') is null then
    execute $f$create function farm.hall_more() returns jsonb language sql stable set search_path = '' as $b$ select '[]'::jsonb $b$$f$;
  end if;
end $do$;

revoke all on function farm.rank_tiers(), farm.rank_tier(int), farm.manila_day(), farm.rank_month(timestamptz), farm.rank_me(uuid),
  farm.rank_top(date, int), farm.hall_more() from public, anon, authenticated;

-- ---------- the functions the game calls ----------

-- Points of one kind. Counted up to what is left of today's cap for that kind; an id already counted adds nothing.
-- One send at a time for each player (a lock), so two sends at once can never both fill the same cap.
create or replace function public.farm_rank_add_v1(p_source text, p_points int, p_request_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare uid uuid := farm.me(); cap int; today date := farm.manila_day(); mon date := farm.rank_month(now()); have int; got int := 0; fresh boolean;
begin
  select day_cap into cap from farm.rank_sources where source = p_source;
  if cap is null then return jsonb_build_object('ok', false, 'code', 'bad-source'); end if;
  if p_request_id is null or p_points is null or p_points < 1 or p_points > 100000 then return jsonb_build_object('ok', false, 'code', 'bad'); end if;
  perform pg_advisory_xact_lock(hashtextextended('farm_rank:' || uid::text, 0));
  delete from farm.rank_requests where user_id = uid and at < now() - interval '3 days'; -- (each player's own old ids: the table stays small)
  delete from farm.rank_days where user_id = uid and day < today - 3;
  insert into farm.rank_requests (id, user_id) values (p_request_id, uid) on conflict (id) do nothing;
  fresh := found;
  if fresh then
    insert into farm.rank_days (user_id, day, source) values (uid, today, p_source) on conflict do nothing;
    select points into have from farm.rank_days where user_id = uid and day = today and source = p_source;
    got := greatest(0, least(p_points, cap - have));
    if got > 0 then
      update farm.rank_days set points = points + got where user_id = uid and day = today and source = p_source;
      insert into farm.rank_months (user_id, month, points, at) values (uid, mon, got, now())
      on conflict (month, user_id) do update set points = farm.rank_months.points + excluded.points, at = now();
    end if;
  end if;
  return farm.rank_me(uid) || jsonb_build_object('ok', true, 'added', got, 'again', not fresh);
end $$;

-- The Top 100 this month (without players you blocked or who blocked you), and your own month.
create or replace function public.farm_rank_board_v1()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare uid uuid := farm.me(); mon date := farm.rank_month(now());
begin
  return jsonb_build_object('month', to_char(mon, 'YYYY-MM'), 'me', farm.rank_me(uid), 'top', coalesce((
    select jsonb_agg(jsonb_build_object('rank', t.rank, 'id', t.user_id, 'name', t.farm_name, 'points', t.points, 'tier', t.tier) order by t.rank)
    from farm.rank_top(mon, 100) t where not farm.blocked(uid, t.user_id)), '[]'::jsonb));
end $$;

-- Everything the Hall of Fame's plaques show. A name is null for a player you blocked (or who blocked you), or one
-- hidden after reports (the game shows "Farmer"); hidden players hold no records.
create or replace function public.farm_hall_v1()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare uid uuid := farm.me(); mon date := farm.rank_month(now()); prev date := (farm.rank_month(now()) - interval '1 month')::date;
  champ int := (farm.rank_tiers())[4];
begin
  return jsonb_build_object(
    'catches', coalesce((select jsonb_agg(jsonb_build_object('kind', r.kind, 'kg10', r.kg10, 'id', r.user_id,
        'name', case when farm.blocked(uid, r.user_id) then null else r.farm_name end) order by r.kind)
      from (select distinct on (c.kind) c.kind, c.kg10, c.user_id, pl.farm_name
            from farm.catches c join farm.players pl on pl.user_id = c.user_id where not pl.hidden
            order by c.kind, c.kg10 desc, c.at) r), '[]'::jsonb),
    'fish', coalesce((select jsonb_agg(jsonb_build_object('kind', r.kind, 'g', r.g, 'id', r.user_id,
        'name', case when farm.blocked(uid, r.user_id) then null else r.farm_name end) order by r.kind)
      from (select distinct on (d.kind) d.kind, d.g, d.user_id, pl.farm_name
            from farm.derby d join farm.players pl on pl.user_id = d.user_id where not pl.hidden
            order by d.kind, d.g desc, d.at) r), '[]'::jsonb),
    'firsts', coalesce((select jsonb_agg(jsonb_build_object('key', f.key, 'id', f.user_id, 'at', f.at,
        'name', case when pl.hidden or farm.blocked(uid, f.user_id) then null else pl.farm_name end) order by f.at)
      from farm.hall_firsts f join farm.players pl on pl.user_id = f.user_id), '[]'::jsonb),
    'champs', jsonb_build_object('month', to_char(prev, 'YYYY-MM'),
      'last', coalesce((select jsonb_agg(jsonb_build_object('id', t.user_id, 'name', case when farm.blocked(uid, t.user_id) then null else t.farm_name end,
          'points', t.points) order by t.rank) from farm.rank_top(prev, 3) t where t.points >= champ), '[]'::jsonb),
      'most', coalesce((select jsonb_agg(jsonb_build_object('id', c.user_id, 'name', case when farm.blocked(uid, c.user_id) then null else c.farm_name end,
          'months', c.n) order by c.n desc, c.first)
        from (select m.user_id, pl.farm_name, count(*)::int as n, min(m.month) as first
              from farm.rank_months m join farm.players pl on pl.user_id = m.user_id
              where m.month < mon and m.points >= champ and not pl.hidden
              group by m.user_id, pl.farm_name order by count(*) desc, min(m.month) limit 3) c), '[]'::jsonb)),
    'top', coalesce((select jsonb_agg(jsonb_build_object('rank', t.rank, 'id', t.user_id, 'name', t.farm_name, 'points', t.points, 'tier', t.tier) order by t.rank)
      from farm.rank_top(mon, 10) t where not farm.blocked(uid, t.user_id)), '[]'::jsonb),
    'more', coalesce(farm.hall_more(), '[]'::jsonb));
end $$;

-- Claims a first (the game asks when you have a share in beating a boss). The first to ask wins it, for good; asking
-- again is harmless and says the same. Only keys in farm.hall_first_keys.
create or replace function public.farm_hall_first_v1(p_key text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare uid uuid := farm.me(); holder uuid; nm text;
begin
  if p_key is null or not exists (select 1 from farm.hall_first_keys where key = p_key) then
    return jsonb_build_object('ok', false, 'code', 'bad-key');
  end if;
  insert into farm.hall_firsts (key, user_id) values (p_key, uid) on conflict (key) do nothing;
  select f.user_id, case when pl.hidden or farm.blocked(uid, f.user_id) then null else pl.farm_name end into holder, nm
  from farm.hall_firsts f join farm.players pl on pl.user_id = f.user_id where f.key = p_key;
  return jsonb_build_object('ok', true, 'first', holder = uid, 'id', holder, 'name', nm);
end $$;

revoke all on function public.farm_rank_add_v1(text, int, uuid), public.farm_rank_board_v1(), public.farm_hall_v1(), public.farm_hall_first_v1(text)
  from public, anon, authenticated;
grant execute on function public.farm_rank_add_v1(text, int, uuid), public.farm_rank_board_v1(), public.farm_hall_v1(), public.farm_hall_first_v1(text)
  to authenticated;

reset lock_timeout;
notify pgrst, 'reload schema';

-- ---------- to undo part 22 ----------
-- (first an app without Town Rank and the Hall: their game calls fail quietly without these, and the points wait)
-- drop function if exists public.farm_rank_add_v1(text, int, uuid), public.farm_rank_board_v1(), public.farm_hall_v1(),
--   public.farm_hall_first_v1(text), farm.rank_me(uuid), farm.rank_top(date, int), farm.rank_tier(int), farm.rank_tiers(),
--   farm.manila_day(), farm.rank_month(timestamptz);
-- drop function if exists farm.hall_more(); -- (only if no later part uses it: the Bayanihan Project's may)
-- drop index if exists farm.catches_record, farm.derby_record;
-- drop table if exists farm.hall_firsts, farm.hall_first_keys, farm.rank_requests, farm.rank_months, farm.rank_days, farm.rank_sources;
-- notify pgrst, 'reload schema';
