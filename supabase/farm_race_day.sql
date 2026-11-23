-- Harvest Ville: Race Day on the server (owner, 24 Nov 2026: "Approve"). NOT APPLIED: the owner applies it in the
-- Supabase SQL editor. (The game plays Race Day the old way until these functions are there: shipping the game first is
-- safe.)
--
-- Why: each race's winner came from its number alone, worked out on the phone. Anyone who read the game could know
-- every winner ahead, and a phone clock set back opened bets again on a race already run.
-- Now:
--   - the server keeps a secret, and from it a number for each race (farm.race_seed). It tells a race's number only once
--     that race has started (farm_race_v1). The game mixes it into the result, so nobody knows a winner before the start.
--   - a bet goes to the server first (farm_race_bet_v1). It takes it only while that race's bets are open by the
--     SERVER's clock: never after they closed, whatever the phone's clock says. One bet a race, the daily limit kept.
--   - a bet is paid only by the server's word (farm_race_settle_v1), once.
--   - so betting needs the internet (the game says so).
-- Gold stays the game's own money: nothing here touches Selebox Coins or Stars, and nothing is bought with real money.
--
-- The numbers below must match the game's C.RACE_DAY (src/00-zzzzzzzzzzzzzzzzzzzzzzzzzzzz-manila-cup.js; checked by
-- test/race-day-sql.test.js): 96 races a day, the first at 6:00 AM Manila, one every 10 minutes; bets open 10 minutes
-- before a start and close 30 s before it; the result is out 32 s after it; 100 to 50,000 Gold a bet; 200,000 a day.
--
-- STEP 1, read-only, run first (changes nothing):
--   select to_regclass('farm.race_bets') bets, to_regclass('farm.race_secret') secret,                 -- expect null, null
--          (select count(*) from pg_proc where proname in ('farm_race_v1', 'farm_race_bet_v1', 'farm_race_settle_v1')) fns, -- expect 0
--          (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--             where n.nspname = 'extensions' and p.proname = 'hmac') hmac;                            -- expect 2
--
-- STEP 2: run everything below (one transaction). Safe to run twice. The undo is at the bottom.

begin;
set local lock_timeout = '5s';

-- the secret (one row; nobody but the database reads it)
create table if not exists farm.race_secret (
  id smallint primary key check (id = 1),
  secret bytea not null
);
alter table farm.race_secret enable row level security;
revoke all on table farm.race_secret from public, anon, authenticated;
insert into farm.race_secret (id, secret) values (1, extensions.gen_random_bytes(32)) on conflict (id) do nothing;

-- the bets the server took
create table if not exists farm.race_bets (
  user_id uuid not null,
  n bigint not null,
  h smallint not null check (h between 0 and 5),
  a integer not null check (a between 100 and 50000),
  made_at timestamptz not null default now(),
  settled_at timestamptz,
  primary key (user_id, n)
);
alter table farm.race_bets enable row level security;
revoke all on table farm.race_bets from public, anon, authenticated;

-- a race's start (ms since 1970), as the game's L.rdStart: Manila's day x 96 + its place in the day
create or replace function farm.race_start_ms(p_n bigint)
 returns bigint language sql immutable set search_path = ''
as $function$
  select (p_n / 96) * 86400000 + (360 + (p_n % 96) * 10) * 60000 - 28800000
$function$;

-- a race's secret number: 0 to 2^31 - 1
create or replace function farm.race_seed(p_n bigint)
 returns integer language sql stable security definer set search_path = ''
as $function$
  select ((('x' || substr(encode(extensions.hmac(convert_to(p_n::text, 'UTF8'), s.secret, 'sha256'), 'hex'), 1, 8))::bit(32)::bigint) & 2147483647)::integer
  from farm.race_secret s where s.id = 1
$function$;
revoke all on function farm.race_start_ms(bigint) from public, anon, authenticated;
revoke all on function farm.race_seed(bigint) from public, anon, authenticated;

-- The numbers of races p_from..p_to (at most the last 21) that have started by the server's clock: { now, seeds }
create or replace function public.farm_race_v1(p_from bigint, p_to bigint)
 returns jsonb language plpgsql stable security definer set search_path = ''
as $function$
declare t bigint := (extract(epoch from clock_timestamp()) * 1000)::bigint; out jsonb := '{}'::jsonb; k bigint;
begin
  if auth.uid() is null then raise exception 'not signed in' using errcode = '28000'; end if;
  if p_from is not null and p_to is not null then
    for k in greatest(p_from, p_to - 20, 0) .. p_to loop
      if farm.race_start_ms(k) <= t then out := out || jsonb_build_object(k::text, farm.race_seed(k)); end if;
    end loop;
  end if;
  return jsonb_build_object('now', t, 'seeds', out);
end $function$;

-- A bet of p_a Gold on lane p_h of race p_n: { ok } or { ok: false, why: 'closed' | 'horse' | 'min' | 'max' | 'one' | 'day' }
-- (the same bet sent again, an answer lost: { ok, duplicate })
create or replace function public.farm_race_bet_v1(p_n bigint, p_h integer, p_a integer)
 returns jsonb language plpgsql volatile security definer set search_path = ''
as $function$
declare uid uuid := auth.uid(); t bigint := (extract(epoch from clock_timestamp()) * 1000)::bigint; st bigint; had record; staked bigint;
begin
  if uid is null then raise exception 'not signed in' using errcode = '28000'; end if;
  if p_n is null or p_n < 0 then return jsonb_build_object('ok', false, 'why', 'closed'); end if;
  st := farm.race_start_ms(p_n);
  if t >= st - 30000 or t < st - 600000 then return jsonb_build_object('ok', false, 'why', 'closed'); end if;
  if p_h is null or p_h < 0 or p_h > 5 then return jsonb_build_object('ok', false, 'why', 'horse'); end if;
  if p_a is null or p_a < 100 then return jsonb_build_object('ok', false, 'why', 'min'); end if;
  if p_a > 50000 then return jsonb_build_object('ok', false, 'why', 'max'); end if;
  perform pg_advisory_xact_lock(hashtextextended('farm_race:' || uid::text, 0));
  select b.h, b.a into had from farm.race_bets b where b.user_id = uid and b.n = p_n;
  if found then
    if had.h = p_h and had.a = p_a then return jsonb_build_object('ok', true, 'duplicate', true); end if;
    return jsonb_build_object('ok', false, 'why', 'one');
  end if;
  select coalesce(sum(b.a), 0) into staked from farm.race_bets b where b.user_id = uid and b.n / 96 = p_n / 96;
  if staked + p_a > 200000 then return jsonb_build_object('ok', false, 'why', 'day'); end if;
  insert into farm.race_bets (user_id, n, h, a) values (uid, p_n, p_h, p_a);
  return jsonb_build_object('ok', true);
end $function$;

-- The server's word on the bet this player made on race p_n, once its result is out:
-- { ok, h, a, seed } (paid now, once), { ok: false, why: 'settled' | 'none', seed } or { ok: false, why: 'early' }
create or replace function public.farm_race_settle_v1(p_n bigint)
 returns jsonb language plpgsql volatile security definer set search_path = ''
as $function$
declare uid uuid := auth.uid(); t bigint := (extract(epoch from clock_timestamp()) * 1000)::bigint; got record;
begin
  if uid is null then raise exception 'not signed in' using errcode = '28000'; end if;
  if p_n is null or p_n < 0 or t < farm.race_start_ms(p_n) + 32000 then return jsonb_build_object('ok', false, 'why', 'early'); end if;
  update farm.race_bets b set settled_at = now() where b.user_id = uid and b.n = p_n and b.settled_at is null returning b.h, b.a into got;
  if found then return jsonb_build_object('ok', true, 'h', got.h, 'a', got.a, 'seed', farm.race_seed(p_n)); end if;
  if exists (select 1 from farm.race_bets b where b.user_id = uid and b.n = p_n) then
    return jsonb_build_object('ok', false, 'why', 'settled', 'seed', farm.race_seed(p_n));
  end if;
  return jsonb_build_object('ok', false, 'why', 'none', 'seed', farm.race_seed(p_n));
end $function$;

revoke all on function public.farm_race_v1(bigint, bigint) from public, anon;
revoke all on function public.farm_race_bet_v1(bigint, integer, integer) from public, anon;
revoke all on function public.farm_race_settle_v1(bigint) from public, anon;
grant execute on function public.farm_race_v1(bigint, bigint) to authenticated;
grant execute on function public.farm_race_bet_v1(bigint, integer, integer) to authenticated;
grant execute on function public.farm_race_settle_v1(bigint) to authenticated;

-- bets older than 30 days are cleared every night
do $cron$ begin
  if exists (select 1 from cron.job where jobname = 'hv-race-bets-clean') then perform cron.unschedule('hv-race-bets-clean'); end if;
  perform cron.schedule('hv-race-bets-clean', '29 3 * * *', $$delete from farm.race_bets where made_at < now() - interval '30 days'$$);
end $cron$;

notify pgrst, 'reload schema';
commit;

-- STEP 3, read-only, after applying (expect: 2 tables, 3 functions for players only, the secret unreadable, a race
-- not started yet has no number, one that started has one, the cleaner there):
--   select to_regclass('farm.race_bets') bets, to_regclass('farm.race_secret') secret,
--          (select count(*) from pg_proc where proname in ('farm_race_v1', 'farm_race_bet_v1', 'farm_race_settle_v1')) fns,
--          has_function_privilege('anon', 'public.farm_race_bet_v1(bigint, integer, integer)', 'execute') anon_bet,
--          has_function_privilege('authenticated', 'public.farm_race_bet_v1(bigint, integer, integer)', 'execute') player_bet,
--          has_table_privilege('authenticated', 'farm.race_secret', 'select') secret_read,
--          farm.race_seed(1) between 0 and 2147483647 seed_ok,
--          farm.race_start_ms(((extract(epoch from now()) * 1000)::bigint + 28800000) / 86400000 * 96) % 86400000 = 79200000 first_race_6am,
--          (select count(*) from cron.job where jobname = 'hv-race-bets-clean') cleaner;

-- ---------- to undo (only if something is wrong; the game then plays Race Day the old way again) ----------
--   begin;
--   select cron.unschedule('hv-race-bets-clean');
--   drop function if exists public.farm_race_settle_v1(bigint);
--   drop function if exists public.farm_race_bet_v1(bigint, integer, integer);
--   drop function if exists public.farm_race_v1(bigint, bigint);
--   drop function if exists farm.race_seed(bigint);
--   drop function if exists farm.race_start_ms(bigint);
--   drop table if exists farm.race_bets;
--   drop table if exists farm.race_secret;
--   commit;
