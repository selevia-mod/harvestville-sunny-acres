-- Harvest Ville online, part 21 (6 Nov 2026). Run AFTER part 20 (it does not need anything from part 20, only part 1's
-- farm.players and farm.me(); parts 2-20 can be there or not).
-- Town Raid (owner, 6 Nov 2026: "Town Raid, yes agree, it will replace the world boss"). Twice a week (Monday and
-- Thursday, 8:00 to 8:30 PM Philippine time) something attacks the fields. Each player fights it on their OWN farm, in
-- their own game: there is no shared live room. The game sends the hits it landed every 10 seconds (one small call), and
-- they add to ONE goal the whole town shares. Everyone who landed 10 or more hits gets a chest after the raid; if the
-- town reached the goal, everyone gets a bonus day (the game turns on Double Drops until midnight the next day).
--   * The raid on now (or the next one) is worked out from the server's clock, the same way the game does it: no job
--     has to start it. Its id is its Manila date ('20261109'); its kind takes turns (sparks, typhoon, boars, crows).
--   * Fair play: no Coins or Stars are involved anywhere. Each player: at most 300 hits a raid, at most 60 in one call,
--     and no more than about 2 a second since the raid began (plus 30). A call carries a request id: the same call sent
--     twice (a phone on a bad line trying again) counts once.
--   * The goal grows with the town: the bigger of 500 hits and 80 for every farmer who landed a hit.
--   * The town's count is kept in 16 small rows per raid (not one), so thousands of phones adding hits at the same
--     moment don't all wait for one row.
-- Additive: three new tables (rules, the town's count, each player's hits) and six new functions. Nothing that exists
-- changes. Safe to run twice. Runs fine as ONE transaction in the SQL editor.
--   farm_raid_state_v1()                           { ok, raid, kind, on, starts_in, ends_in, total, goal, defenders, mine, cap, last }
--   farm_raid_hit_v1(p_raid, p_hits, p_request_id)  the same, plus { added, dup } | { ok: false, code: 'bad' | 'early' | 'over' }
--   farm_raid_claim_v1(p_raid)                      { ok, won, hits, tier, total, goal, defenders }
--                                                   | { ok: false, code: 'none' | 'claimed' (with the town's result) | 'early' | 'old' | 'bad' }
-- The numbers (when, how long, the caps, the goal, the chest tiers) are one row in farm.raid_rules: change them there
-- (and in the game's src/00-zzzzzzzzzzz-raid.js, so the countdown and the bar agree).
set local lock_timeout = '5s';

create table if not exists farm.raid_rules (
  id int primary key default 1 check (id = 1),
  days int[] not null default '{1,4}', -- Philippine weekdays (0 = Sunday): Monday and Thursday
  start_min int not null default 1200, -- 8:00 PM
  mins int not null default 30, -- how long a raid lasts
  late_min int not null default 3, -- a last batch of hits is still taken this long after the end
  kinds text[] not null default '{spark,typhoon,boar,crow}', -- in turn (so the first raid, Monday 9 Nov 2026, is the boars)
  cap int not null default 300, -- hits per player per raid
  rate numeric not null default 2, -- hits a second since the start, at most (plus burst)
  burst int not null default 30,
  batch_most int not null default 60, -- hits in one call
  min_goal int not null default 500,
  per_defender int not null default 80,
  tiers int[] not null default '{10,80,200}', -- the chests: Helper's, Defender's, Hero's
  claim_days int not null default 7 -- the results can be asked for this long after a raid
);
insert into farm.raid_rules default values on conflict do nothing;

create table if not exists farm.raid_shards (
  raid text not null check (raid ~ '^[0-9]{8}$'),
  shard smallint not null check (shard between 0 and 15),
  total bigint not null default 0,
  defenders int not null default 0,
  primary key (raid, shard)
);

create table if not exists farm.raid_players (
  raid text not null check (raid ~ '^[0-9]{8}$'),
  user_id uuid not null references farm.players (user_id) on delete cascade,
  hits int not null default 0 check (hits >= 0),
  recent uuid[] not null default '{}', -- the last few request ids (a call sent again counts once)
  claimed boolean not null default false,
  first_at timestamptz not null default now(),
  last_at timestamptz not null default now(),
  primary key (raid, user_id)
);
create index if not exists raid_players_user on farm.raid_players (user_id, first_at);

alter table farm.raid_rules enable row level security; -- (no policies: only the functions below read or write them)
alter table farm.raid_shards enable row level security;
alter table farm.raid_players enable row level security;
revoke all on table farm.raid_rules, farm.raid_shards, farm.raid_players from public, anon, authenticated;

-- ---------- helpers (not callable by clients) ----------

-- The clock (one place, so the local checks can move it).
create or replace function farm.raid_now() returns timestamptz
language sql stable set search_path = '' as $$ select now() $$;

-- The raid on Manila date d (null if no raid that day): its id, kind, start and end. Manila is UTC+8 all year.
create or replace function farm.raid_on_day(d date, out id text, out kind text, out starts_at timestamptz, out ends_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
declare r farm.raid_rules; wd int := extract(dow from d)::int; si int; n bigint;
begin
  select * into r from farm.raid_rules where farm.raid_rules.id = 1;
  si := array_position(r.days, wd);
  if si is null then id := null; return; end if;
  -- (raid number: weeks from Monday since 1 Jan 1970, a Thursday, times the raid days, plus which raid day of the week)
  n := floor(((d - date '1970-01-01') + 3) / 7.0)::bigint * cardinality(r.days) + (si - 1);
  id := to_char(d, 'YYYYMMDD');
  kind := r.kinds[(n % cardinality(r.kinds))::int + 1];
  starts_at := ((d + make_interval(mins => r.start_min)) - interval '8 hours') at time zone 'UTC';
  ends_at := starts_at + make_interval(mins => r.mins);
end $$;

-- The raid on at t, or the next one to start.
create or replace function farm.raid_next(t timestamptz, out id text, out kind text, out starts_at timestamptz, out ends_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
declare d0 date := ((t at time zone 'UTC') + interval '8 hours')::date; x record;
begin
  for k in -1 .. 14 loop
    select * into x from farm.raid_on_day(d0 + k);
    if x.id is not null and x.ends_at > t then id := x.id; kind := x.kind; starts_at := x.starts_at; ends_at := x.ends_at; return; end if;
  end loop;
end $$;

-- The last raid that ended by t (for its bonus day).
create or replace function farm.raid_last(t timestamptz, out id text, out kind text, out starts_at timestamptz, out ends_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
declare d0 date := ((t at time zone 'UTC') + interval '8 hours')::date; x record;
begin
  for k in 0 .. 14 loop
    select * into x from farm.raid_on_day(d0 - k);
    if x.id is not null and x.ends_at <= t then id := x.id; kind := x.kind; starts_at := x.starts_at; ends_at := x.ends_at; return; end if;
  end loop;
end $$;

-- The raid with this id ('20261109'), or nulls.
create or replace function farm.raid_by_id(p_raid text, out id text, out kind text, out starts_at timestamptz, out ends_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
declare d date; x record;
begin
  if p_raid is null or p_raid !~ '^20[0-9]{6}$' then return; end if;
  begin d := to_date(p_raid, 'YYYYMMDD'); exception when others then return; end;
  if to_char(d, 'YYYYMMDD') <> p_raid then return; end if; -- (no 31 February)
  select * into x from farm.raid_on_day(d);
  id := x.id; kind := x.kind; starts_at := x.starts_at; ends_at := x.ends_at;
end $$;

-- The town's count for a raid: hits, farmers who landed one, and the goal.
create or replace function farm.raid_town(p_raid text, out total bigint, out defenders int, out goal bigint)
language plpgsql stable security definer set search_path = '' as $$
declare r farm.raid_rules;
begin
  select * into r from farm.raid_rules where id = 1;
  select coalesce(sum(s.total), 0), coalesce(sum(s.defenders), 0) into total, defenders from farm.raid_shards s where s.raid = p_raid;
  goal := greatest(r.min_goal, defenders::bigint * r.per_defender);
end $$;

-- The answer the game reads: the raid on now (or next; or p_raid, the one just hit), the town's count, my hits, and
-- the last raid's result.
create or replace function farm.raid_answer(uid uuid, t timestamptz, p_raid text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare r farm.raid_rules; x record; l record; town record; ltown record; mine int;
begin
  select * into r from farm.raid_rules where id = 1;
  if p_raid is null then select * into x from farm.raid_next(t); else select * into x from farm.raid_by_id(p_raid); end if;
  select * into town from farm.raid_town(x.id);
  select coalesce((select p.hits from farm.raid_players p where p.raid = x.id and p.user_id = uid), 0) into mine;
  select * into l from farm.raid_last(t);
  if l.id is not null then select * into ltown from farm.raid_town(l.id); end if;
  return jsonb_build_object('ok', true, 'raid', x.id, 'kind', x.kind, 'on', x.starts_at <= t and t < x.ends_at,
    'starts_in', greatest(0, ceil(extract(epoch from x.starts_at - t)))::int, 'ends_in', greatest(0, ceil(extract(epoch from x.ends_at - t)))::int,
    'total', town.total, 'goal', town.goal, 'defenders', town.defenders, 'mine', mine, 'cap', r.cap,
    'last', case when l.id is null then null else jsonb_build_object('raid', l.id, 'kind', l.kind, 'won', ltown.total >= ltown.goal) end);
end $$;

revoke all on function farm.raid_now(), farm.raid_on_day(date), farm.raid_next(timestamptz), farm.raid_last(timestamptz), farm.raid_by_id(text),
  farm.raid_town(text), farm.raid_answer(uuid, timestamptz, text) from public, anon, authenticated;

-- ---------- the functions the game calls ----------

-- Where things stand: the raid on now or next, the town's count, my hits, and the last raid (won: its bonus day).
create or replace function public.farm_raid_state_v1()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare uid uuid := farm.me(); -- (signed in, a player, not banned: raises otherwise)
begin
  return farm.raid_answer(uid, farm.raid_now(), null);
end $$;

-- Hits landed (a batch, every 10 s): they count up to the caps; the same request id again counts once.
create or replace function public.farm_raid_hit_v1(p_raid text, p_hits int, p_request_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare uid uuid := farm.me(); t timestamptz := farm.raid_now(); r farm.raid_rules; x record; me farm.raid_players; allowed int; added int;
begin
  select * into r from farm.raid_rules where id = 1;
  if p_hits is null or p_hits < 1 or p_hits > r.batch_most or p_request_id is null then return jsonb_build_object('ok', false, 'code', 'bad'); end if;
  select * into x from farm.raid_by_id(p_raid);
  if x.id is null then return jsonb_build_object('ok', false, 'code', 'bad'); end if;
  if t < x.starts_at then return jsonb_build_object('ok', false, 'code', 'early'); end if;
  if t > x.ends_at + make_interval(mins => r.late_min) then return jsonb_build_object('ok', false, 'code', 'over'); end if;
  insert into farm.raid_players (raid, user_id) values (x.id, uid) on conflict do nothing;
  select * into me from farm.raid_players where raid = x.id and user_id = uid for update; -- (one call at a time per player)
  if p_request_id = any (me.recent) then
    return farm.raid_answer(uid, t, x.id) || jsonb_build_object('added', 0, 'dup', true);
  end if;
  allowed := least(r.cap, floor(greatest(0, extract(epoch from least(t, x.ends_at) - x.starts_at)) * r.rate)::int + r.burst);
  added := greatest(0, least(p_hits, r.cap - me.hits, allowed - me.hits));
  update farm.raid_players set hits = hits + added, recent = (array[p_request_id] || recent)[1:4], last_at = t
  where raid = x.id and user_id = uid;
  if added > 0 then
    insert into farm.raid_shards as s (raid, shard, total, defenders)
    values (x.id, (hashtext(uid::text) & 15)::smallint, added, case when me.hits = 0 then 1 else 0 end)
    on conflict (raid, shard) do update set total = s.total + excluded.total, defenders = s.defenders + excluded.defenders;
  end if;
  return farm.raid_answer(uid, t, x.id) || jsonb_build_object('added', added, 'dup', false);
end $$;

-- After a raid: did the town win, how many hits I landed, which chest (0 = none: fewer than 10). Once per player.
create or replace function public.farm_raid_claim_v1(p_raid text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare uid uuid := farm.me(); t timestamptz := farm.raid_now(); r farm.raid_rules; x record; town record; me farm.raid_players; won boolean; tier int; res jsonb;
begin
  select * into r from farm.raid_rules where id = 1;
  select * into x from farm.raid_by_id(p_raid);
  if x.id is null then return jsonb_build_object('ok', false, 'code', 'bad'); end if;
  if t < x.ends_at then return jsonb_build_object('ok', false, 'code', 'early'); end if;
  if t > x.ends_at + make_interval(days => r.claim_days) then return jsonb_build_object('ok', false, 'code', 'old'); end if;
  select * into town from farm.raid_town(x.id);
  won := town.total >= town.goal;
  res := jsonb_build_object('won', won, 'total', town.total, 'goal', town.goal, 'defenders', town.defenders);
  select * into me from farm.raid_players where raid = x.id and user_id = uid for update;
  if not found or me.hits = 0 then return res || jsonb_build_object('ok', false, 'code', 'none', 'hits', 0, 'tier', 0); end if;
  if me.claimed then return res || jsonb_build_object('ok', false, 'code', 'claimed', 'hits', me.hits, 'tier', 0); end if;
  update farm.raid_players set claimed = true where raid = x.id and user_id = uid;
  select count(*) into tier from unnest(r.tiers) m where me.hits >= m;
  delete from farm.raid_players where user_id = uid and first_at < t - interval '60 days'; -- (my old raids: the table stays small)
  return res || jsonb_build_object('ok', true, 'hits', me.hits, 'tier', tier);
end $$;

revoke all on function public.farm_raid_state_v1(), public.farm_raid_hit_v1(text, int, uuid), public.farm_raid_claim_v1(text) from public, anon, authenticated;
grant execute on function public.farm_raid_state_v1(), public.farm_raid_hit_v1(text, int, uuid), public.farm_raid_claim_v1(text) to authenticated;

reset lock_timeout;
notify pgrst, 'reload schema';

-- ---------- to undo part 21 ----------
-- (first an app without the Town Raid's server: without these the game fights raids alone, quietly)
-- drop function if exists public.farm_raid_state_v1(), public.farm_raid_hit_v1(text, int, uuid), public.farm_raid_claim_v1(text),
--   farm.raid_answer(uuid, timestamptz, text), farm.raid_town(text), farm.raid_by_id(text), farm.raid_last(timestamptz), farm.raid_next(timestamptz),
--   farm.raid_on_day(date), farm.raid_now();
-- drop table if exists farm.raid_players, farm.raid_shards, farm.raid_rules;
-- notify pgrst, 'reload schema';
