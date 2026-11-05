-- Plays farm_online_21.sql (the Town Raid) as signed-in players on the local Postgres (test/sql/run.sh). Its own
-- players: 1 to 5 (made straight in farm.players), and 6 (signed in, never joined online play). The clock is moved by
-- hand: farm.raid_now() is replaced here (as postgres, in this throwaway database only) by one that reads test.now.
\set ON_ERROR_STOP 1
set role postgres;
create or replace function farm.raid_now() returns timestamptz
language sql stable set search_path = '' as $$ select coalesce(nullif(current_setting('test.now', true), '')::timestamptz, now()) $$;
create function pg_temp.id(n int) returns uuid language sql as $$ select ('00000000-0000-4000-f000-' || lpad(n::text, 12, '0'))::uuid $$;
insert into auth.users select pg_temp.id(n) from generate_series(1, 6) n;
insert into farm.players (user_id, farm_name, friend_code)
  select pg_temp.id(n), 'Raid ' || n, translate(lpad((n + 50)::text, 8, '0'), '0123456789', 'ABCDEFGHJK') from generate_series(1, 5) n;
grant execute on function pg_temp.id(int) to authenticated;
create function pg_temp.hits(n int) returns int language sql security definer as $$
  select coalesce(sum(hits), 0)::int from farm.raid_players where user_id = pg_temp.id(n) $$;
grant execute on function pg_temp.hits(int) to authenticated;
set role authenticated;
create function pg_temp.as_(n int) returns void language sql as $$ select set_config('request.uid', case when n = 0 then '' else pg_temp.id(n)::text end, false) $$;
create function pg_temp.at(t text) returns void language sql as $$ select set_config('test.now', t, false) $$;
create function pg_temp.ok(c boolean, what text) returns void language plpgsql as $$ begin if not coalesce(c, false) then raise exception 'FAILED: %', what; end if; raise notice 'ok: %', what; end $$;
create function pg_temp.req(n int) returns uuid language sql as $$ select ('00000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid $$;

-- 1. the schedule: Monday and Thursday 8:00-8:30 PM Philippine time; the kinds take turns like the game's (the helpers,
-- as postgres: players can't call them)
set role postgres;
do $$ declare x record; begin
  select * into x from farm.raid_next('2026-11-09 19:00+08');
  perform pg_temp.ok(x.id = '20261109' and x.kind = 'boar' and x.starts_at = '2026-11-09 20:00+08' and x.ends_at = '2026-11-09 20:30+08', 'Monday 9 Nov: the boars, 8:00 to 8:30 PM');
  select * into x from farm.raid_next('2026-11-09 20:30+08');
  perform pg_temp.ok(x.id = '20261112' and x.kind = 'crow', 'then Thursday: the crows');
  perform pg_temp.ok((select kind from farm.raid_on_day('2026-11-16')) = 'spark' and (select kind from farm.raid_on_day('2026-11-19')) = 'typhoon'
    and (select kind from farm.raid_on_day('2026-11-23')) = 'boar', 'sparks, the typhoon, and round again');
  perform pg_temp.ok((select id from farm.raid_on_day('2026-11-10')) is null and (select id from farm.raid_on_day('2026-11-11')) is null, 'no raid on Tuesday or Wednesday');
  perform pg_temp.ok((select id from farm.raid_by_id('20261110')) is null and (select id from farm.raid_by_id('20260231')) is null
    and (select id from farm.raid_by_id('x')) is null and (select id from farm.raid_by_id(null)) is null, 'no raid on a wrong id');
  select * into x from farm.raid_last('2026-11-12 08:00+08');
  perform pg_temp.ok(x.id = '20261109', 'the last raid that ended');
end $$;
set role authenticated;

-- 2. before it starts
do $$ declare r jsonb; begin
  perform pg_temp.as_(1); perform pg_temp.at('2026-11-09 19:00+08');
  r := farm_raid_state_v1();
  perform pg_temp.ok(r ->> 'raid' = '20261109' and not (r ->> 'on')::boolean and (r ->> 'starts_in')::int = 3600 and (r ->> 'goal')::int = 500
    and (r ->> 'total')::int = 0 and (r ->> 'mine')::int = 0 and (r ->> 'cap')::int = 300, 'an hour before: the next raid, nothing counted yet');
  perform pg_temp.ok(farm_raid_hit_v1('20261109', 5, pg_temp.req(1)) = '{"ok": false, "code": "early"}', 'hits before the start do not count');
end $$;

-- 3. hits: the rate, a request sent twice, bad calls
do $$ declare r jsonb; begin
  perform pg_temp.as_(1); perform pg_temp.at('2026-11-09 20:00:30+08');
  r := farm_raid_hit_v1('20261109', 60, pg_temp.req(2));
  perform pg_temp.ok((r ->> 'added')::int = 60 and (r ->> 'mine')::int = 60 and (r ->> 'total')::int = 60 and (r ->> 'defenders')::int = 1 and (r ->> 'on')::boolean, '60 hits in the first half minute');
  r := farm_raid_hit_v1('20261109', 60, pg_temp.req(3));
  perform pg_temp.ok((r ->> 'added')::int = 30 and (r ->> 'mine')::int = 90, 'the rate: about 2 a second plus 30 (90 by now)');
  r := farm_raid_hit_v1('20261109', 60, pg_temp.req(3));
  perform pg_temp.ok((r ->> 'added')::int = 0 and (r ->> 'dup')::boolean and (r ->> 'mine')::int = 90, 'the same request again counts once');
  perform pg_temp.ok(farm_raid_hit_v1('20261109', 61, pg_temp.req(4)) ->> 'code' = 'bad', 'more than 60 in one call: no');
  perform pg_temp.ok(farm_raid_hit_v1('20261109', 0, pg_temp.req(4)) ->> 'code' = 'bad', '0: no');
  perform pg_temp.ok(farm_raid_hit_v1('20261109', 5, null) ->> 'code' = 'bad', 'no request id: no');
  perform pg_temp.ok(farm_raid_hit_v1('20261112', 5, pg_temp.req(4)) ->> 'code' = 'early', 'not Thursday''s raid yet');
  perform pg_temp.ok(farm_raid_hit_v1('20261110', 5, pg_temp.req(4)) ->> 'code' = 'bad', 'no raid on Tuesday');
  perform pg_temp.ok(pg_temp.hits(1) = 90, 'nothing else counted');
end $$;

-- 4. the cap; the town's count with more farmers; the goal grows with them
do $$ declare r jsonb; begin
  perform pg_temp.as_(1); perform pg_temp.at('2026-11-09 20:29+08');
  for k in 10 .. 20 loop r := farm_raid_hit_v1('20261109', 60, pg_temp.req(k)); end loop;
  perform pg_temp.ok((r ->> 'mine')::int = 300 and (r ->> 'added')::int = 0 and pg_temp.hits(1) = 300, 'no more than 300 a raid');
  perform pg_temp.as_(2); r := farm_raid_hit_v1('20261109', 60, pg_temp.req(30)); r := farm_raid_hit_v1('20261109', 40, pg_temp.req(31));
  perform pg_temp.as_(3); r := farm_raid_hit_v1('20261109', 50, pg_temp.req(30)); -- (another player's request ids are their own)
  perform pg_temp.ok((r ->> 'total')::int = 450 and (r ->> 'defenders')::int = 3 and (r ->> 'goal')::int = 500 and (r ->> 'mine')::int = 50, 'three farmers, 450 of 500');
  perform pg_temp.as_(4); perform pg_temp.at('2026-11-09 20:32+08'); -- (after the end, within the 3 late minutes)
  r := farm_raid_hit_v1('20261109', 49, pg_temp.req(40));
  perform pg_temp.ok((r ->> 'added')::int = 49 and (r ->> 'total')::int = 499 and (r ->> 'goal')::int = 500 and not (r ->> 'on')::boolean, 'a last batch a little late still counts');
  perform pg_temp.as_(5); perform pg_temp.at('2026-11-09 20:34+08');
  perform pg_temp.ok(farm_raid_hit_v1('20261109', 5, pg_temp.req(41)) = '{"ok": false, "code": "over"}', 'too late: over');
end $$;

-- 5. the results: one hit short, so the town did not win; then a raid it wins
do $$ declare r jsonb; begin
  perform pg_temp.as_(1); perform pg_temp.at('2026-11-09 20:20+08');
  perform pg_temp.ok(farm_raid_claim_v1('20261109') = '{"ok": false, "code": "early"}', 'no results before the end');
  perform pg_temp.at('2026-11-09 20:31+08');
  r := farm_raid_claim_v1('20261109');
  perform pg_temp.ok((r ->> 'ok')::boolean and not (r ->> 'won')::boolean and (r ->> 'hits')::int = 300 and (r ->> 'tier')::int = 3 and (r ->> 'total')::int = 499 and (r ->> 'defenders')::int = 4,
    '300 hits: the Hero''s chest; 499 of 500: the town did not win');
  perform pg_temp.ok(farm_raid_claim_v1('20261109') ->> 'code' = 'claimed', 'once');
  perform pg_temp.as_(3); perform pg_temp.ok(farm_raid_claim_v1('20261109') ->> 'tier' = '1', '50 hits: the Helper''s chest');
  perform pg_temp.as_(5); r := farm_raid_claim_v1('20261109');
  perform pg_temp.ok(r ->> 'code' = 'none' and not (r ->> 'ok')::boolean and r ? 'won' and r ? 'defenders', 'no hits: no chest, but the town''s result');
  perform pg_temp.ok(farm_raid_state_v1() -> 'last' = '{"raid": "20261109", "kind": "boar", "won": false}', 'the state says how the last raid went');
  -- Thursday: four farmers, 320 to go (the goal is 500 until there are 7 farmers)
  perform pg_temp.at('2026-11-12 20:25+08');
  for n in 1 .. 4 loop perform pg_temp.as_(n); perform farm_raid_hit_v1('20261112', 60, pg_temp.req(100 + n)); perform farm_raid_hit_v1('20261112', 60, pg_temp.req(200 + n)); end loop;
  perform pg_temp.as_(1); r := farm_raid_state_v1();
  perform pg_temp.ok((r ->> 'total')::int = 480 and (r ->> 'kind') = 'crow', '480 for the crows');
  perform pg_temp.as_(5); perform farm_raid_hit_v1('20261112', 20, pg_temp.req(300));
  perform pg_temp.at('2026-11-13 09:00+08');
  r := farm_raid_claim_v1('20261112');
  perform pg_temp.ok((r ->> 'ok')::boolean and (r ->> 'won')::boolean and (r ->> 'tier')::int = 1 and (r ->> 'total')::int = 500, 'the town won: everyone''s bonus day');
  perform pg_temp.ok((farm_raid_state_v1() -> 'last' ->> 'won')::boolean, 'the next morning the state says the town won');
  perform pg_temp.as_(2); perform pg_temp.at('2026-11-20 20:31+08');
  perform pg_temp.ok(farm_raid_claim_v1('20261112') = '{"ok": false, "code": "old"}', 'results wait a week, then they are gone');
end $$;

-- 6. who may call it
do $$ begin
  perform pg_temp.as_(6);
  begin perform farm_raid_state_v1(); perform pg_temp.ok(false, 'x'); exception when others then perform pg_temp.ok(sqlerrm = 'join first', 'not a player: join first'); end;
  begin perform farm_raid_hit_v1('20261112', 5, pg_temp.req(500)); perform pg_temp.ok(false, 'x'); exception when others then perform pg_temp.ok(sqlerrm = 'join first', 'not a player: no hits'); end;
  perform pg_temp.as_(0);
  begin perform farm_raid_state_v1(); perform pg_temp.ok(false, 'x'); exception when others then perform pg_temp.ok(sqlerrm = 'not signed in', 'not signed in: nothing'); end;
end $$;
set role postgres;
do $$ declare f text; begin
  foreach f in array array['farm_raid_state_v1()', 'farm_raid_hit_v1(text, int, uuid)', 'farm_raid_claim_v1(text)'] loop
    perform pg_temp.ok(not has_function_privilege('anon', 'public.' || f, 'execute') and has_function_privilege('authenticated', 'public.' || f, 'execute'), f || ': players only');
  end loop;
  perform pg_temp.ok(not has_function_privilege('authenticated', 'farm.raid_answer(uuid, timestamptz, text)', 'execute') and not has_function_privilege('authenticated', 'farm.raid_next(timestamptz)', 'execute'), 'the helpers stay on the server');
  perform pg_temp.ok(not has_table_privilege('authenticated', 'farm.raid_players', 'select') and not has_table_privilege('anon', 'farm.raid_shards', 'select')
    and not has_table_privilege('authenticated', 'farm.raid_rules', 'update'), 'the tables stay on the server');
  perform pg_temp.ok((select count(*) from farm.raid_rules) = 1, 'one rules row, after running the part twice');
end $$;
