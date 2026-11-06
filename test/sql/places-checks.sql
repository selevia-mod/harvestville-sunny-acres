-- Plays farm_online_23.sql (every hunting place on the server) as signed-in players on the local Postgres
-- (test/sql/run.sh). Its own players: 1 (Ana) and 2 (Ben), friends-free but listed.
\set ON_ERROR_STOP 1
set role postgres;
create function pg_temp.id(n int) returns uuid language sql as $$ select ('00000000-0000-4000-c100-' || lpad(n::text, 12, '0'))::uuid $$;
insert into auth.users select pg_temp.id(n) from generate_series(1, 2) n;
insert into farm.players (user_id, farm_name, friend_code, listed, last_seen_at)
  select pg_temp.id(n), (array['Ana', 'Ben'])[n], translate(lpad((n + 40)::text, 8, '0'), '0123456789', 'ABCDEFGHJK'), true, now() from generate_series(1, 2) n;
grant execute on function pg_temp.id(int) to authenticated;
set role authenticated;
create function pg_temp.as_(n int) returns void language sql as $$ select set_config('request.uid', case when n = 0 then '' else pg_temp.id(n)::text end, false) $$;
create function pg_temp.ok(c boolean, what text) returns void language plpgsql as $$ begin if not coalesce(c, false) then raise exception 'FAILED: %', what; end if; raise notice 'ok: %', what; end $$;

-- 1. Hunting now: a new place, by its own name; a bad name is refused
do $$ declare m text; begin
  perform pg_temp.as_(1);
  perform farm_hunt_here_v1('banaue');
  perform pg_temp.as_(2);
  select h.map into m from farm_hunting_v1() h where h.id = pg_temp.id(1);
  perform pg_temp.ok(m = 'banaue', 'a hunter in Banaue shows in Banaue, not Pulag');
  perform pg_temp.as_(1);
  perform farm_hunt_here_v1('pulag');
  perform pg_temp.as_(2);
  select h.map into m from farm_hunting_v1() h where h.id = pg_temp.id(1);
  perform pg_temp.ok(m = 'pulag', 'and the places from before still work');
  begin
    perform pg_temp.as_(1);
    perform farm_hunt_here_v1('Not A Map!');
    perform pg_temp.ok(false, 'a bad name is refused');
  exception when sqlstate '22023' then perform pg_temp.ok(true, 'a bad name is refused');
  end;
end $$;

-- 2. Biggest catch: the new places' animals, with their weights checked; not their dungeons' creatures
do $$ declare r jsonb; begin
  perform pg_temp.as_(1);
  r := farm_catch_v1('bayawak', 190);
  perform pg_temp.ok((r->>'ok')::boolean and (r->>'best')::int = 190 and (r->>'rank')::int = 1, 'a Bayawak of 19 kg: on the board');
  r := farm_catch_v1('bayawak', 900);
  perform pg_temp.ok(not (r->>'ok')::boolean and r->>'code' = 'bad-weight', 'a Bayawak no Bayawak can be: refused');
  r := farm_catch_v1('golden_sawa', 800);
  perform pg_temp.ok((r->>'ok')::boolean, 'Palawan''s rare one too');
  r := farm_catch_v1('kibaan', 20);
  perform pg_temp.ok(not (r->>'ok')::boolean and r->>'code' = 'bad-kind', 'a dungeon creature is not a catch');
  perform pg_temp.ok((select count(*) from farm_catch_board_v1('bayawak')) = 1, 'the Bayawak board');
end $$;

-- 3. The Hall of Fame: the first to beat each new boss, once
do $$ declare r jsonb; begin
  perform pg_temp.as_(1);
  r := farm_hall_first_v1('sierra_boss');
  perform pg_temp.ok((r->>'ok')::boolean and (r->>'first')::boolean, 'Ana beats the Kapre first');
  perform pg_temp.as_(2);
  r := farm_hall_first_v1('sierra_boss');
  perform pg_temp.ok((r->>'ok')::boolean and not (r->>'first')::boolean and r->>'name' = 'Ana', 'Ben after her: it stays hers');
  r := farm_hall_first_v1('banaue_boss');
  perform pg_temp.ok((r->>'first')::boolean, 'Ben the Amomongo');
  r := farm_hall_first_v1('nowhere_boss');
  perform pg_temp.ok(r->>'code' = 'bad-key', 'a boss the server does not know: refused');
  perform pg_temp.ok((select count(*) from jsonb_array_elements(farm_hall_v1()->'firsts') f where f->>'key' in ('sierra_boss', 'banaue_boss')) = 2, 'both on the Hall''s list');
end $$;
