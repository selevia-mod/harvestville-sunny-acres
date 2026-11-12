-- Plays supabase/farm_tower_board.sql (The Lost Tower's weekly board and First in Selebox) as signed-in players on the
-- local Postgres (test/sql/run.sh). Its own players: 1 Ana, 2 Ben, 3 Cara (blocks Ana), 4 Dino (hidden after reports),
-- 5 Ella, 6-12 seven more, 13 Nilo; 14 is signed in but never joined online play. Last week's board is put in by hand.
\set ON_ERROR_STOP 1
set role postgres;
create function pg_temp.id(n int) returns uuid language sql as $$ select ('00000000-0000-4000-e100-' || lpad(n::text, 12, '0'))::uuid $$;
insert into auth.users select pg_temp.id(n) from generate_series(1, 14) n;
insert into farm.players (user_id, farm_name, friend_code)
  select pg_temp.id(n), (array['Ana', 'Ben', 'Cara', 'Dino', 'Ella', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12', 'Nilo'])[n],
    translate(lpad((n + 170)::text, 8, '0'), '0123456789', 'ABCDEFGHJK') from generate_series(1, 13) n;
update farm.players set hidden = true where user_id = pg_temp.id(4);
insert into farm.blocks (blocker, blocked) values (pg_temp.id(3), pg_temp.id(1));
-- last week: Dino (hidden) 50, Ana 40, Ben 30, Cara 20, 6-12: 19 down to 13, Ella 12, Nilo 9
insert into farm.tower_weeks (user_id, week, floors, at)
  select pg_temp.id(n), farm.tower_week(now()) - 7, f, now() - interval '8 days' + n * interval '1 minute'
  from (values (4, 50), (1, 40), (2, 30), (3, 20), (6, 19), (7, 18), (8, 17), (9, 16), (10, 15), (11, 14), (12, 13), (5, 12), (13, 9)) v (n, f);
grant execute on function pg_temp.id(int) to authenticated;
create function pg_temp.clears(n int) returns int language sql security definer as $$ select count(*)::int from farm.tower_clears where user_id = pg_temp.id(n) $$;
grant execute on function pg_temp.clears(int) to authenticated;
create function pg_temp.wk(back int) returns text language sql security definer as $$ select to_char(farm.tower_week(now()) - back, 'YYYY-MM-DD') $$;
grant execute on function pg_temp.wk(int) to authenticated;
create function pg_temp.ok(c boolean, what text) returns void language plpgsql as $$ begin if not coalesce(c, false) then raise exception 'FAILED: %', what; end if; raise notice 'ok: %', what; end $$;
grant execute on function pg_temp.ok(boolean, text) to authenticated;

-- 0. Manila's week: Monday 00:00 Asia/Manila (the helpers, as postgres: players can't call them)
do $$ begin
  perform pg_temp.ok(farm.tower_week('2026-11-16 00:00+08') = '2026-11-16' and farm.tower_week('2026-11-15 23:59+08') = '2026-11-09'
    and farm.tower_week('2026-11-15 16:30Z') = '2026-11-16' and farm.tower_week('2026-11-12 12:00+08') = '2026-11-09', 'the week starts Monday 00:00 in Manila');
  perform pg_temp.ok((select count(*) from farm.hall_first_keys where key ~ '^tower_[0-9]+$') = 10, 'ten big bosses on the firsts list');
  perform pg_temp.ok(not has_function_privilege('anon', 'public.farm_tower_floor_v1(int[], uuid)', 'execute')
    and not has_function_privilege('anon', 'public.farm_tower_week_prize_v1()', 'execute')
    and has_function_privilege('authenticated', 'public.farm_tower_board_v1()', 'execute')
    and not has_function_privilege('authenticated', 'farm.tower_top(date, int)', 'execute'), 'grants: players only, helpers for nobody');
  perform pg_temp.ok(not has_table_privilege('authenticated', 'farm.tower_clears', 'select') and not has_table_privilege('authenticated', 'farm.tower_week_claims', 'insert'), 'tables only through the functions');
end $$;
set role authenticated;
create function pg_temp.as_(n int) returns void language sql as $$ select set_config('request.uid', case when n = 0 then '' else pg_temp.id(n)::text end, false) $$;

-- 1. new floors: each counts once, a send tried again counts once, bad sends
do $$ declare r jsonb; a uuid := gen_random_uuid(); begin
  perform pg_temp.as_(1);
  r := farm_tower_floor_v1(array[1, 2, 3], a);
  perform pg_temp.ok((r->>'ok')::boolean and (r->>'added')::int = 3 and r->'took' = '[1, 2, 3]' and (r->>'floors')::int = 3 and (r->>'rank')::int = 1
    and r->>'week' = pg_temp.wk(0), 'three new floors, first on the board');
  r := farm_tower_floor_v1(array[1, 2, 3], a);
  perform pg_temp.ok((r->>'added')::int = 0 and (r->>'again')::boolean and r->'took' = '[1, 2, 3]' and (r->>'floors')::int = 3, 'the same send again: nothing more, the same floors taken');
  r := farm_tower_floor_v1(array[3, 4, 4, 0, 1001], gen_random_uuid());
  perform pg_temp.ok((r->>'added')::int = 1 and r->'took' = '[3, 4]' and (r->>'floors')::int = 4, 'a floor counts once ever; 0 and 1001 are no floors');
  perform pg_temp.ok(farm_tower_floor_v1(array[5], null)->>'code' = 'bad' and farm_tower_floor_v1('{}', gen_random_uuid())->>'code' = 'bad'
    and farm_tower_floor_v1((select array_agg(x) from generate_series(1, 51) x), gen_random_uuid())->>'code' = 'bad', 'no id, no floors, or more than 50: bad');
  perform pg_temp.ok(pg_temp.clears(1) = 4, 'four floors in all');
end $$;

-- 2. the day's cap: 100 new floors a Manila day
do $$ declare r jsonb; begin
  perform pg_temp.as_(2);
  r := farm_tower_floor_v1((select array_agg(x) from generate_series(1, 50) x), gen_random_uuid());
  r := farm_tower_floor_v1((select array_agg(x) from generate_series(51, 100) x), gen_random_uuid());
  perform pg_temp.ok((r->>'added')::int = 50 and (r->>'floors')::int = 100 and (r->>'left')::int = 0, '100 floors today');
  r := farm_tower_floor_v1(array[99, 100, 101, 102], gen_random_uuid());
  perform pg_temp.ok((r->>'added')::int = 0 and r->'took' = '[99, 100]' and (r->>'floors')::int = 100, 'the cap is full: 101 and 102 wait (not taken)');
  perform pg_temp.as_(4);
  r := farm_tower_floor_v1(array[1, 2, 3, 4, 5, 6, 7, 8, 9, 10], gen_random_uuid());
  perform pg_temp.ok((r->>'added')::int = 10 and r->'rank' = 'null', 'a hidden player''s floors count, but they are not ranked');
  perform pg_temp.as_(14);
  begin
    perform farm_tower_floor_v1(array[1], gen_random_uuid());
    perform pg_temp.ok(false, 'not joined: refused');
  exception when sqlstate 'P0002' then perform pg_temp.ok(true, 'not joined online play: refused');
  end;
end $$;

-- 3. the board: the top 10 this week, blocks and hidden players left out, last week's Champion
do $$ declare r jsonb; begin
  perform pg_temp.as_(5);
  r := farm_tower_board_v1();
  perform pg_temp.ok(jsonb_array_length(r->'top') = 2 and r->'top'->0->>'name' = 'Ben' and (r->'top'->0->>'floors')::int = 100
    and r->'top'->1->>'name' = 'Ana' and (r->'top'->1->>'rank')::int = 2, 'Ben 100, Ana 4; hidden Dino is not on it');
  perform pg_temp.ok((r->'me'->>'floors')::int = 0 and r->'me'->'rank' = 'null', 'Ella: no new floors yet');
  perform pg_temp.ok(r->'champ'->>'name' = 'Ana' and (r->'champ'->>'floors')::int = 40 and (r->'prizes'->>0)::int = 300, 'last week''s Champion: Ana (hidden Dino had more)');
  perform pg_temp.as_(3);
  r := farm_tower_board_v1();
  perform pg_temp.ok(jsonb_array_length(r->'top') = 1 and r->'top'->0->>'name' = 'Ben' and r->'champ'->'name' = 'null'
    and r->'champ'->>'id' = pg_temp.id(1)::text, 'Cara blocked Ana: not on her board, the banner without the name');
end $$;

-- 4. last week's prizes, once each, the same claim when asked again
do $$ declare r jsonb; r2 jsonb; begin
  perform pg_temp.as_(1);
  r := farm_tower_week_prize_v1();
  perform pg_temp.ok((r->>'ok')::boolean and (r->>'rank')::int = 1 and (r->>'pearls')::int = 300 and r->>'frame' = 'gold' and r->>'title' = 'Lighthouse Champion'
    and (r->>'floors')::int = 40 and not (r->>'again')::boolean and r->>'week' = pg_temp.wk(7), 'Ana: 1st, 300 Pearls, the gold frame and the title');
  r2 := farm_tower_week_prize_v1();
  perform pg_temp.ok(r2->>'id' = r->>'id' and (r2->>'again')::boolean and (r2->>'pearls')::int = 300, 'asked again: the same claim (the game pays its id once)');
  perform pg_temp.as_(2);
  r := farm_tower_week_prize_v1();
  perform pg_temp.ok((r->>'rank')::int = 2 and (r->>'pearls')::int = 200 and r->>'frame' = 'silver' and r->'title' = 'null', 'Ben: 2nd, 200 and silver');
  perform pg_temp.as_(3);
  perform pg_temp.ok((farm_tower_week_prize_v1()->>'pearls')::int = 150, 'Cara: 3rd, 150');
  perform pg_temp.as_(12);
  r := farm_tower_week_prize_v1();
  perform pg_temp.ok((r->>'rank')::int = 10 and (r->>'pearls')::int = 50 and r->'frame' = 'null', '10th: 50');
  perform pg_temp.as_(5);
  r := farm_tower_week_prize_v1();
  perform pg_temp.ok(r->'rank' = 'null' and (r->>'pearls')::int = 10, 'Ella, 11th with 12 new floors: 10 Pearls');
  perform pg_temp.as_(13);
  perform pg_temp.ok(farm_tower_week_prize_v1() = '{"ok": false, "code": "none"}', 'Nilo, 9 new floors: nothing');
  perform pg_temp.as_(4);
  perform pg_temp.ok(farm_tower_week_prize_v1() = '{"ok": false, "code": "none"}', 'hidden Dino: nothing');
end $$;

-- 5. First in Selebox: the Hall's own claim and plaque names take the new keys
do $$ declare r jsonb; begin
  perform pg_temp.as_(2);
  perform pg_temp.ok((farm_hall_first_v1('tower_100')->>'first')::boolean, 'Ben is the first to beat Tambanakua');
  perform pg_temp.as_(1);
  r := farm_hall_first_v1('tower_100');
  perform pg_temp.ok(not (r->>'first')::boolean and r->>'name' = 'Ben', 'Ana is second: Ben keeps it');
  perform pg_temp.ok(farm_hall_first_v1('tower_150')->>'code' = 'bad-key', 'a mini boss is not on the list');
  perform pg_temp.ok(exists (select 1 from jsonb_array_elements(farm_hall_v1()->'firsts') f where f->>'key' = 'tower_100' and f->>'name' = 'Ben'), 'the Hall''s answer has it (the lighthouse wall)');
end $$;

-- 6. no board last week: no Champion
set role postgres;
delete from farm.tower_weeks where week = farm.tower_week(now()) - 7;
set role authenticated;
do $$ begin
  perform pg_temp.as_(5);
  perform pg_temp.ok(farm_tower_board_v1()->'champ' = 'null', 'nobody last week: no Champion, no banner');
end $$;
