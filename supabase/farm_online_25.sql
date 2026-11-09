-- Harvest Ville online, part 25 (9 Nov 2026). Run AFTER parts 1-24. Farm Raids step 2: real raids between players
-- (owner, 9 Nov 2026: "make the harvest ville like clash clan", "Finish the step 2"; docs/raids.md, docs/raids-step2.md).
--   1. farm.fraid_config: every number in one row (owner: "every number lives on the server").
--   2. farm.fraid_copies: each farm's raid copy (walls, defenses, the loot out in the open, its power), sent by its own
--      phone when it saves. A farm with nothing to take is never listed (owner, 9 Nov: skipped).
--   3. farm.fraid_raids: each raid (the frozen copy, the army, the seed, the result), farm.fraid_points (weekly points),
--      farm.fraid_secret (the game server's key: only a result the game server replayed is recorded).
--   4. Functions for the phone (signed in): copy_put, find, start, inbox, claim, seen, board. Two for the game server
--      (fraid_raid_v1: the raid it checks; fraid_settle_v1: the result, with the attacker's token AND the server's key).
-- Additive: new tables and new functions only; nothing that exists changes. Safe to run twice.
set local lock_timeout = '5s';
create extension if not exists pgcrypto with schema extensions;

-- ---------- 1. the numbers ----------
create table if not exists farm.fraid_config (
  id int primary key default 1 check (id = 1),
  cfg jsonb not null
);
insert into farm.fraid_config (id, cfg) values (1, jsonb_build_object(
  'on', true,
  'daily', 5,              -- raids a day (Philippine days); Revenge does not count
  'lock_secs', 180,        -- a farm is locked this long while it is raided (the battle is 2 minutes)
  'shield_hours', 8,       -- a farm raided is safe this long after
  'new_days', 7,           -- new farms are safe this many days
  'copy_days', 3,          -- a farm whose copy is older than this (not played) is not listed
  'next_gold', 50,         -- Gold for "Next" (the phone takes it)
  'energy', 10,            -- energy a raid costs (the phone takes it)
  'cap_low', 0.10, 'cap_mid', 0.20, 'cap_high', 0.30, 'stronger', 1.5, 'weaker', 0.6667,
  'points', jsonb_build_array(2, 10, 25, 50),  -- Raid Points for 0, 1, 2, 3 stars
  'list', 8,               -- farms in the list
  'week_prizes', jsonb_build_array(20000, 10000, 5000)  -- Gold for the week's top 3 (claimed in the game)
)) on conflict (id) do nothing;
alter table farm.fraid_config enable row level security;
revoke all on table farm.fraid_config from public, anon, authenticated;

create or replace function farm.fraid_cfg() returns jsonb
language sql stable security definer set search_path = '' as $$ select cfg from farm.fraid_config where id = 1 $$;
revoke all on function farm.fraid_cfg() from public, anon, authenticated;

-- ---------- 2. each farm's raid copy ----------
create table if not exists farm.fraid_copies (
  user_id uuid primary key references auth.users (id) on delete cascade,
  copy jsonb not null,             -- { w, h, solid, defs, loot, drop } (the game's L.frFarm shape)
  power int not null default 0,    -- Farm Power (L.farmPower)
  loot int not null default 0,     -- what is out in the open, in Gold
  shield_until timestamptz,        -- the Farm Shield used from the bag (the phone says; a real raid breaks it)
  raided_until timestamptz,        -- safe after being raided (shield_hours)
  updated_at timestamptz not null default now()
);
create index if not exists fraid_copies_find on farm.fraid_copies (power) where loot > 0;
alter table farm.fraid_copies enable row level security;
revoke all on table farm.fraid_copies from public, anon, authenticated;

-- ---------- 3. raids, points, the game server's key ----------
create table if not exists farm.fraid_raids (
  id uuid primary key default gen_random_uuid(),
  attacker uuid not null references auth.users (id) on delete cascade,
  defender uuid not null references auth.users (id) on delete cascade,
  request_id uuid not null,
  copy jsonb not null,             -- the defender's farm as it was (frozen)
  army jsonb not null,             -- { goat: 4, crow: 3, ... } and levels { lv: { goat: 2 } }
  seed int not null,
  cap numeric not null,            -- the share of the loot this raid may take (by power)
  revenge_of uuid references farm.fraid_raids (id) on delete set null,
  started_at timestamptz not null default now(),
  expires_at timestamptz not null,
  state text not null default 'open' check (state in ('open', 'done')),
  stars int check (stars between 0 and 3),
  taken jsonb,                     -- { cells: [loot index, ...], crops, produce, stall, gold, value }
  moves jsonb,                     -- the drops the game server replayed (for Replay)
  prize int,                       -- Gold for the attacker
  points int,
  settled_at timestamptz,
  claimed_at timestamptz,          -- the attacker's game took the prize
  seen_at timestamptz,             -- the defender's game showed the card (and took the loss)
  revenged_at timestamptz,         -- the defender used Revenge for it
  unique (attacker, request_id)
);
create index if not exists fraid_raids_attacker on farm.fraid_raids (attacker, started_at desc);
create index if not exists fraid_raids_defender on farm.fraid_raids (defender, started_at desc);
create index if not exists fraid_raids_open on farm.fraid_raids (defender) where state = 'open';
alter table farm.fraid_raids enable row level security;
revoke all on table farm.fraid_raids from public, anon, authenticated;

create table if not exists farm.fraid_points (
  user_id uuid not null references auth.users (id) on delete cascade,
  week date not null,              -- the Monday (Philippine time)
  points int not null default 0,
  primary key (user_id, week)
);
create index if not exists fraid_points_week on farm.fraid_points (week, points desc);
alter table farm.fraid_points enable row level security;
revoke all on table farm.fraid_points from public, anon, authenticated;

create table if not exists farm.fraid_secret (
  id int primary key default 1 check (id = 1),
  secret text not null default encode(extensions.gen_random_bytes(24), 'hex')
);
insert into farm.fraid_secret default values on conflict do nothing;
alter table farm.fraid_secret enable row level security;
revoke all on table farm.fraid_secret from public, anon, authenticated;

-- ---------- helpers ----------
create or replace function farm.fraid_week(t timestamptz) returns date
language sql immutable set search_path = '' as $$ select date_trunc('week', t at time zone 'Asia/Manila')::date $$;
create or replace function farm.fraid_today_start() returns timestamptz
language sql stable set search_path = '' as $$ select ((now() at time zone 'Asia/Manila')::date::timestamp at time zone 'Asia/Manila') $$;

-- a player who may play (not a guest, not banned or suspended)
create or replace function farm.fraid_player_ok(p_uid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles p where p.auth_user_id = p_uid and not coalesce(p.is_guest, false)
    and not coalesce(p.is_banned, false) and p.deleted_at is null and (p.suspended_until is null or p.suspended_until <= now()))
$$;

-- the share of a farm's loot a raid may take: by the two farms' power (L.frLootCap)
create or replace function farm.fraid_cap(p_mine int, p_theirs int) returns numeric
language plpgsql stable security definer set search_path = '' as $$
declare c jsonb := farm.fraid_cfg(); r numeric; lo numeric := (c->>'cap_low')::numeric; mid numeric := (c->>'cap_mid')::numeric;
  hi numeric := (c->>'cap_high')::numeric; st numeric := (c->>'stronger')::numeric; wk numeric := (c->>'weaker')::numeric;
begin
  r := greatest(p_theirs, 1)::numeric / greatest(p_mine, 1);
  if r >= st then return hi; end if;
  if r <= wk then return lo; end if;
  if r >= 1 then return mid + (hi - mid) * (r - 1) / (st - 1); end if;
  return lo + (mid - lo) * (r - wk) / (1 - wk);
end $$;

-- may this farm be raided now (by p_by)? the reason, or null
create or replace function farm.fraid_why_not(p_target uuid, p_by uuid) returns text
language plpgsql stable security definer set search_path = '' as $$
declare c jsonb := farm.fraid_cfg(); fc farm.fraid_copies; pl farm.players;
begin
  if p_target = p_by then return 'self'; end if;
  select * into fc from farm.fraid_copies where user_id = p_target;
  if not found or fc.loot <= 0 then return 'empty'; end if;
  if fc.updated_at < now() - make_interval(days => (c->>'copy_days')::int) then return 'away'; end if;
  select * into pl from farm.players where user_id = p_target;
  if not found or pl.hidden then return 'gone'; end if;
  if not exists (select 1 from farm.snapshots where user_id = p_target) then return 'gone'; end if; -- (nothing to draw it from)
  if pl.created_at > now() - make_interval(days => (c->>'new_days')::int) then return 'new'; end if;
  if coalesce(fc.shield_until, '-infinity') > now() or coalesce(fc.raided_until, '-infinity') > now() then return 'shield'; end if;
  if exists (select 1 from farm.fraid_raids where defender = p_target and state = 'open' and expires_at > now()) then return 'busy'; end if;
  if farm.blocked(p_target, p_by) then return 'blocked'; end if;
  if not farm.fraid_player_ok(p_target) then return 'gone'; end if;
  return null;
end $$;

revoke all on function farm.fraid_week(timestamptz), farm.fraid_today_start(), farm.fraid_player_ok(uuid), farm.fraid_cap(int, int),
  farm.fraid_why_not(uuid, uuid) from public, anon, authenticated;

-- ---------- 4. the phone's functions ----------

-- My farm's raid copy, after a save (at most once a minute from the phone). p_shield_until: my Farm Shield (bag), if on.
create or replace function public.farm_fraid_copy_put_v1(p_copy jsonb, p_power int, p_loot int, p_shield_until timestamptz)
returns text language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not signed in' using errcode = '28000'; end if;
  if p_copy is null or jsonb_typeof(p_copy) <> 'object' or octet_length(p_copy::text) > 24576 then return 'bad'; end if;
  if jsonb_typeof(p_copy->'defs') <> 'array' or jsonb_array_length(p_copy->'defs') > 80
    or jsonb_typeof(p_copy->'loot') <> 'array' or jsonb_array_length(p_copy->'loot') > 400 then return 'bad'; end if;
  insert into farm.fraid_copies (user_id, copy, power, loot, shield_until, updated_at)
  values (uid, p_copy, greatest(0, least(coalesce(p_power, 0), 100000)), greatest(0, least(coalesce(p_loot, 0), 10000000)),
    case when p_shield_until > now() then least(p_shield_until, now() + interval '25 hours') end, now())
  on conflict (user_id) do update set copy = excluded.copy, power = excluded.power, loot = excluded.loot,
    shield_until = excluded.shield_until, updated_at = now();
  return 'ok';
end $$;

-- Farms to raid: p_mode 'list' (up to cfg.list near my power, a stronger one first if there is one) or 'random' (one);
-- p_skip: farms already shown (Next). [{ id, name, power, loot, cap }]
create or replace function public.farm_fraid_find_v1(p_mode text, p_skip uuid[])
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare uid uuid := auth.uid(); c jsonb := farm.fraid_cfg(); mine int; n int; out jsonb;
begin
  if uid is null then raise exception 'not signed in' using errcode = '28000'; end if;
  if not coalesce((c->>'on')::boolean, false) then return jsonb_build_object('ok', false, 'code', 'off'); end if;
  select power into mine from farm.fraid_copies where user_id = uid;
  if mine is null then return jsonb_build_object('ok', false, 'code', 'no-copy'); end if;
  n := case when p_mode = 'random' then 1 else (c->>'list')::int end;
  select coalesce(jsonb_agg(x order by x->>'o'), '[]') into out from (
    select jsonb_build_object('id', f.user_id, 'name', coalesce(pl.farm_name, 'A farm'), 'power', f.power, 'loot', f.loot,
      'cap', round(farm.fraid_cap(mine, f.power), 3), 'o', lpad(rn::text, 4, '0')) x
    from (
      select f.*, row_number() over (order by abs(f.power - mine) + (random() * greatest(mine, 10) * 0.3)) rn
      from farm.fraid_copies f
      where f.loot > 0 and f.user_id <> uid and not (f.user_id = any (coalesce(p_skip, '{}')))
        and f.power between mine * 0.5 and mine * 2 + 20
        and farm.fraid_why_not(f.user_id, uid) is null
      limit 200
    ) f join farm.players pl on pl.user_id = f.user_id
    where f.rn <= n
  ) t;
  return jsonb_build_object('ok', true, 'farms', out, 'next_gold', c->'next_gold', 'energy', c->'energy');
end $$;

-- Start a raid on p_target (or Revenge: p_revenge, the raid they made on me). p_army { goat: 4, ..., lv: { goat: 2 } }.
-- Checks the day's raids, locks the farm, freezes its copy, breaks my own Farm Shield. A lost answer: same request id.
create or replace function public.farm_fraid_start_v1(p_target uuid, p_army jsonb, p_request_id uuid, p_revenge uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); c jsonb := farm.fraid_cfg(); r farm.fraid_raids; rv farm.fraid_raids; fc farm.fraid_copies;
  mine int; why text; done_today int; target uuid := p_target;
begin
  if uid is null then raise exception 'not signed in' using errcode = '28000'; end if;
  if not coalesce((c->>'on')::boolean, false) then return jsonb_build_object('ok', false, 'code', 'off'); end if;
  if p_request_id is null then return jsonb_build_object('ok', false, 'code', 'request-required'); end if;
  if not farm.fraid_player_ok(uid) then return jsonb_build_object('ok', false, 'code', 'account-unavailable'); end if;
  select * into r from farm.fraid_raids where attacker = uid and request_id = p_request_id;
  if found then
    return jsonb_build_object('ok', true, 'duplicate', true, 'raid', r.id, 'copy', r.copy, 'seed', r.seed, 'cap', r.cap, 'expires_at', r.expires_at);
  end if;
  if p_army is null or jsonb_typeof(p_army) <> 'object' or octet_length(p_army::text) > 2048 then return jsonb_build_object('ok', false, 'code', 'army'); end if;
  if p_revenge is not null then
    select * into rv from farm.fraid_raids where id = p_revenge and defender = uid and state = 'done' and revenged_at is null;
    if not found then return jsonb_build_object('ok', false, 'code', 'no-revenge'); end if;
    target := rv.attacker;
  end if;
  if target is null then return jsonb_build_object('ok', false, 'code', 'target'); end if;
  perform pg_advisory_xact_lock(hashtext('farm_fraid'), hashtext(target::text)); -- one raid at a time on a farm
  if exists (select 1 from farm.fraid_raids where attacker = uid and state = 'open' and expires_at > now()) then
    return jsonb_build_object('ok', false, 'code', 'in-raid');
  end if;
  if p_revenge is null then
    select count(*) into done_today from farm.fraid_raids where attacker = uid and revenge_of is null and started_at >= farm.fraid_today_start();
    if done_today >= (c->>'daily')::int then return jsonb_build_object('ok', false, 'code', 'daily', 'daily', c->'daily'); end if;
  end if;
  why := farm.fraid_why_not(target, uid);
  -- Revenge: their own new raid broke their shields, so only a farm that is busy, gone or empty is refused
  if why is not null and not (p_revenge is not null and why in ('shield', 'new')) then
    return jsonb_build_object('ok', false, 'code', why);
  end if;
  select * into fc from farm.fraid_copies where user_id = target;
  select power into mine from farm.fraid_copies where user_id = uid;
  insert into farm.fraid_raids (attacker, defender, request_id, copy, army, seed, cap, revenge_of, expires_at)
  values (uid, target, p_request_id, fc.copy, p_army, (floor(random() * 2147483646) + 1)::int,
    farm.fraid_cap(coalesce(mine, fc.power), fc.power), p_revenge, now() + make_interval(secs => (c->>'lock_secs')::int))
  returning * into r;
  if p_revenge is not null then update farm.fraid_raids set revenged_at = now() where id = p_revenge; end if;
  -- raiding another player breaks my own shields (owner: "it breaks when you raid another player's farm")
  update farm.fraid_copies set shield_until = null, raided_until = null where user_id = uid;
  return jsonb_build_object('ok', true, 'raid', r.id, 'name', (select farm_name from farm.players where user_id = target),
    'copy', r.copy, 'seed', r.seed, 'cap', r.cap, 'expires_at', r.expires_at, 'shield_broken', true,
    'look', (select data from farm.snapshots where user_id = target)); -- (the farm as a visit draws it)
end $$;

-- What waits for me: my raids' prizes not yet taken, and raids on my farm not yet seen.
create or replace function public.farm_fraid_inbox_v1()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not signed in' using errcode = '28000'; end if;
  return jsonb_build_object(
    'won', coalesce((select jsonb_agg(jsonb_build_object('raid', r.id, 'name', pl.farm_name, 'stars', r.stars, 'prize', r.prize,
      'points', r.points, 'taken', r.taken) order by r.settled_at) from farm.fraid_raids r left join farm.players pl on pl.user_id = r.defender
      where r.attacker = uid and r.state = 'done' and r.claimed_at is null), '[]'),
    'lost', coalesce((select jsonb_agg(jsonb_build_object('raid', r.id, 'by', r.attacker, 'name', pl.farm_name, 'stars', r.stars,
      'taken', r.taken, 'at', r.settled_at, 'revenge', r.revenged_at is null, 'copy', r.copy, 'army', r.army, 'seed', r.seed, 'cap', r.cap,
      'moves', r.moves) order by r.settled_at) from farm.fraid_raids r left join farm.players pl on pl.user_id = r.attacker
      where r.defender = uid and r.state = 'done' and r.seen_at is null and r.settled_at > now() - interval '30 days'), '[]'),
    'shield_until', (select raided_until from farm.fraid_copies where user_id = uid));
end $$;

-- My game took a raid's prize (once): 'ok' | 'already' | 'none'
create or replace function public.farm_fraid_claim_v1(p_raid uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not signed in' using errcode = '28000'; end if;
  update farm.fraid_raids set claimed_at = now() where id = p_raid and attacker = uid and state = 'done' and claimed_at is null;
  if found then return 'ok'; end if;
  return case when exists (select 1 from farm.fraid_raids where id = p_raid and attacker = uid and claimed_at is not null) then 'already' else 'none' end;
end $$;

-- My game showed a raid on my farm and took the loss (once): 'ok' | 'already' | 'none'
create or replace function public.farm_fraid_seen_v1(p_raid uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not signed in' using errcode = '28000'; end if;
  update farm.fraid_raids set seen_at = now() where id = p_raid and defender = uid and state = 'done' and seen_at is null;
  if found then return 'ok'; end if;
  return case when exists (select 1 from farm.fraid_raids where id = p_raid and defender = uid and seen_at is not null) then 'already' else 'none' end;
end $$;

-- This week's Raid Points: the top 50, and mine. { week, top: [{ id, name, points }], me, prizes }
create or replace function public.farm_fraid_board_v1()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare uid uuid := auth.uid(); wk date := farm.fraid_week(now());
begin
  if uid is null then raise exception 'not signed in' using errcode = '28000'; end if;
  return jsonb_build_object('week', wk,
    'top', coalesce((select jsonb_agg(jsonb_build_object('id', t.user_id, 'name', t.farm_name, 'points', t.points) order by t.points desc, t.user_id)
      from (select p.user_id, pl.farm_name, p.points from farm.fraid_points p join farm.players pl on pl.user_id = p.user_id
        where p.week = wk and not pl.hidden order by p.points desc, p.user_id limit 50) t), '[]'),
    'me', coalesce((select points from farm.fraid_points where user_id = uid and week = wk), 0),
    'prizes', farm.fraid_cfg()->'week_prizes');
end $$;

-- The game server reads the raid it checks (as the attacker: their own raid only): the frozen copy, the army, the seed.
create or replace function public.farm_fraid_raid_v1(p_raid uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare uid uuid := auth.uid(); r farm.fraid_raids;
begin
  if uid is null then raise exception 'not signed in' using errcode = '28000'; end if;
  select * into r from farm.fraid_raids where id = p_raid and attacker = uid;
  if not found then return null; end if;
  return jsonb_build_object('raid', r.id, 'copy', r.copy, 'army', r.army, 'seed', r.seed, 'cap', r.cap, 'state', r.state, 'expires_at', r.expires_at);
end $$;

-- ---------- 5. the game server's function ----------
-- The game server replayed the attacker's drops on the frozen copy (the game's own L.frReplay) and sends the result.
-- Called with the attacker's own token (the server has it from the phone's connection) AND the server's key.
-- p_taken: { cells: [loot index, ...], crops, produce, stall, gold, value }; each is capped here by the copy and the cap.
create or replace function public.farm_fraid_settle_v1(p_key text, p_raid uuid, p_stars int, p_taken jsonb, p_moves jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); c jsonb := farm.fraid_cfg(); r farm.fraid_raids; v_total int; v_value int; v_prize int; v_pts int; v_stars int;
begin
  if uid is null then raise exception 'not signed in' using errcode = '28000'; end if;
  if p_key is null or p_key is distinct from (select secret from farm.fraid_secret where id = 1) then
    return jsonb_build_object('ok', false, 'code', 'key');
  end if;
  select * into r from farm.fraid_raids where id = p_raid and attacker = uid for update;
  if not found then return jsonb_build_object('ok', false, 'code', 'none'); end if;
  if r.state = 'done' then return jsonb_build_object('ok', true, 'duplicate', true, 'stars', r.stars, 'prize', r.prize, 'points', r.points); end if;
  if now() > r.expires_at + interval '2 minutes' then return jsonb_build_object('ok', false, 'code', 'late'); end if;
  if p_taken is null or jsonb_typeof(p_taken) <> 'object' or octet_length(p_taken::text) > 8192
    or (p_moves is not null and octet_length(p_moves::text) > 16384) then return jsonb_build_object('ok', false, 'code', 'bad'); end if;
  v_stars := greatest(0, least(3, coalesce(p_stars, 0)));
  -- what was out in the open, in Gold, when the raid started; the prize is never more than its share of that
  select coalesce(loot, 0) into v_total from farm.fraid_copies where user_id = r.defender;
  v_total := greatest(coalesce((r.copy->>'value')::int, v_total, 0), 0);
  v_value := greatest(0, least(coalesce((p_taken->>'value')::int, 0), ceil(v_total * r.cap)::int));
  v_prize := v_value;
  v_pts := coalesce((c->'points'->>v_stars)::int, 0);
  update farm.fraid_raids set state = 'done', stars = v_stars, taken = p_taken || jsonb_build_object('value', v_value),
    moves = p_moves, prize = v_prize, points = v_pts, settled_at = now() where id = r.id;
  insert into farm.fraid_points (user_id, week, points) values (uid, farm.fraid_week(now()), v_pts)
  on conflict (user_id, week) do update set points = farm.fraid_points.points + excluded.points;
  update farm.fraid_copies set raided_until = now() + make_interval(hours => (c->>'shield_hours')::int) where user_id = r.defender;
  return jsonb_build_object('ok', true, 'stars', v_stars, 'prize', v_prize, 'points', v_pts);
end $$;

revoke all on function public.farm_fraid_copy_put_v1(jsonb, int, int, timestamptz), public.farm_fraid_find_v1(text, uuid[]),
  public.farm_fraid_start_v1(uuid, jsonb, uuid, uuid), public.farm_fraid_inbox_v1(), public.farm_fraid_claim_v1(uuid),
  public.farm_fraid_seen_v1(uuid), public.farm_fraid_board_v1(), public.farm_fraid_settle_v1(text, uuid, int, jsonb, jsonb),
  public.farm_fraid_raid_v1(uuid)
  from public, anon, authenticated;
grant execute on function public.farm_fraid_copy_put_v1(jsonb, int, int, timestamptz), public.farm_fraid_find_v1(text, uuid[]),
  public.farm_fraid_start_v1(uuid, jsonb, uuid, uuid), public.farm_fraid_inbox_v1(), public.farm_fraid_claim_v1(uuid),
  public.farm_fraid_seen_v1(uuid), public.farm_fraid_board_v1(), public.farm_fraid_settle_v1(text, uuid, int, jsonb, jsonb),
  public.farm_fraid_raid_v1(uuid)
  to authenticated;
reset lock_timeout;
notify pgrst, 'reload schema';
