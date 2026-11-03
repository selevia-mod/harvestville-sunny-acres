-- Plays farm_online_14.sql (hunting together) as signed-in players on the local Postgres (test/sql/run.sh).
-- Its own players: 6 (Ana), 7 (Ben) and 8 (Cara); 7 hides their farm, 8 blocks 6.
\set ON_ERROR_STOP 1
set role postgres;
insert into auth.users select ('00000000-0000-4000-9000-00000000000' || n)::uuid from generate_series(6, 8) n;
insert into public.profiles values
  ('00000000-0000-4000-9000-000000000006', false, null, 'Ana', 'ana6'),
  ('00000000-0000-4000-9000-000000000007', false, null, 'Ben', 'ben7'),
  ('00000000-0000-4000-9000-000000000008', false, null, 'Cara', 'cara8');
set role authenticated;
create function pg_temp.as_(n int) returns void language sql as $$ select set_config('request.uid', '00000000-0000-4000-9000-00000000000' || n, false) $$;
create function pg_temp.id(n int) returns uuid language sql as $$ select ('00000000-0000-4000-9000-00000000000' || n)::uuid $$;
create function pg_temp.ok(c boolean, what text) returns void language plpgsql as $$ begin if not coalesce(c, false) then raise exception 'FAILED: %', what; end if; raise notice 'ok: %', what; end $$;
do $$ declare r jsonb; begin
  perform pg_temp.as_(6); perform farm_join_v1(); perform farm_publish_v1('{}'::jsonb, 1, 1, 0, 0);
  perform pg_temp.as_(7); perform farm_join_v1(); perform farm_set_listed_v1(false);
  perform pg_temp.as_(8); perform farm_join_v1();

  -- who is hunting now
  perform pg_temp.as_(7); perform farm_hunt_here_v1('magayon');
  perform pg_temp.as_(8); perform farm_hunt_here_v1('pulag');
  perform pg_temp.as_(6);
  perform pg_temp.ok((select count(*) from farm_hunting_v1() where id = pg_temp.id(8) and map = 'pulag' and not friend) = 1, 'a listed farm out hunting shows to anyone');
  perform pg_temp.ok((select count(*) from farm_hunting_v1() where id = pg_temp.id(7)) = 0, 'a hidden farm does not');
  perform pg_temp.ok((select count(*) from farm_hunting_v1() where id = pg_temp.id(6)) = 0, 'never yourself');
  begin perform farm_hunt_here_v1('farm'); perform pg_temp.ok(false, 'x'); exception when others then perform pg_temp.ok(sqlerrm = 'bad map', 'only the Wild Lands'); end;

  -- a friend request to someone you hunted with
  perform pg_temp.ok(farm_friend_ask_v1(pg_temp.id(7)) = 'requested', 'a friend request by id');
  perform pg_temp.ok(farm_friend_ask_v1(pg_temp.id(7)) = 'waiting', 'asked once');
  perform pg_temp.ok(farm_friend_ask_v1(gen_random_uuid()) = 'nocode', 'nobody there');
  perform pg_temp.ok(farm_friend_ask_v1(pg_temp.id(6)) = 'self', 'not yourself');
  perform pg_temp.as_(7); perform pg_temp.ok(farm_friend_ask_v1(pg_temp.id(6)) = 'friends', 'asked back: friends');
  perform pg_temp.as_(6);
  perform pg_temp.ok((select count(*) from farm_hunting_v1() where id = pg_temp.id(7) and map = 'magayon' and friend) = 1, 'a friend shows even with a hidden farm');
  perform pg_temp.ok((select id from farm_hunting_v1() limit 1) = pg_temp.id(7), 'friends first');

  -- offline or home again: gone from the list
  perform pg_temp.as_(7); perform farm_hunt_here_v1(null);
  perform pg_temp.as_(6); perform pg_temp.ok((select count(*) from farm_hunting_v1() where id = pg_temp.id(7)) = 0, 'home again: off the list');
  set role postgres; update farm.players set last_seen_at = now() - interval '5 minutes' where user_id = pg_temp.id(8); set role authenticated;
  perform pg_temp.ok((select count(*) from farm_hunting_v1() where id = pg_temp.id(8)) = 0, 'not online: off the list');

  -- blocked: off the list, and no friend request
  perform pg_temp.as_(8); perform farm_hunt_here_v1('pulag'); perform farm_block_v1(pg_temp.id(6), true);
  perform pg_temp.as_(6);
  perform pg_temp.ok((select count(*) from farm_hunting_v1() where id = pg_temp.id(8)) = 0, 'blocked: off the list');
  perform pg_temp.ok(farm_friend_ask_v1(pg_temp.id(8)) = 'nocode', 'blocked: no friend request');

  -- the biggest catch of the week
  r := farm_catch_v1('boar', 950);
  perform pg_temp.ok((r ->> 'ok')::boolean and (r ->> 'best')::int = 950 and (r ->> 'rank')::int = 1, 'a 95 kg boar: first place');
  r := farm_catch_v1('boar', 900);
  perform pg_temp.ok((r ->> 'best')::int = 950, 'a smaller one keeps the biggest');
  perform pg_temp.ok(farm_catch_v1('boar', 1300) ->> 'code' = 'bad-weight', 'no boar weighs 130 kg');
  perform pg_temp.ok(farm_catch_v1('boar', 700) ->> 'code' = 'bad-weight', 'or 70 kg');
  perform pg_temp.ok(farm_catch_v1('dragon', 10) ->> 'code' = 'bad-kind', 'only real animals');
  perform pg_temp.ok((farm_catch_v1('greatmammoth', 90000) ->> 'ok')::boolean, 'a Giant Great Mammoth');
  perform pg_temp.as_(7); r := farm_catch_v1('boar', 1210);
  perform pg_temp.ok((r ->> 'rank')::int = 1, 'a Giant Boar takes first place');
  perform pg_temp.as_(8); perform farm_catch_v1('boar', 1000);
  perform pg_temp.as_(6);
  perform pg_temp.ok((select string_agg(rank || ':' || kg10, ',' order by rank) from farm_catch_board_v1('boar')) = '1:1210,3:950', 'the board: biggest first, the blocked player left out (' ||
    coalesce((select string_agg(rank || ':' || kg10, ',' order by rank) from farm_catch_board_v1('boar')), '') || ')');
  perform pg_temp.ok((select me from farm_catch_board_v1('boar') where kg10 = 950), 'your own row says so');
  perform pg_temp.ok((select count(*) from farm_catch_board_v1('deer')) = 0, 'an animal nobody hunted this week: empty');
end $$;
set role postgres;
do $$ begin
  update farm.catches set week = week - 7 where kind = 'boar' and user_id = '00000000-0000-4000-9000-000000000007';
  raise notice 'ok: (last week''s boar)';
end $$;
set role authenticated;
do $$ begin
  perform pg_temp.as_(6);
  perform pg_temp.ok((select string_agg(rank || ':' || kg10, ',' order by rank) from farm_catch_board_v1('boar')) = '2:950', 'last week''s catch is not on this week''s board');
end $$;
set role anon;
do $$ begin
  begin perform farm_hunting_v1(); raise exception 'FAILED: anon can call farm_hunting_v1'; exception when insufficient_privilege then raise notice 'ok: anon cannot call it'; end;
end $$;
set role authenticated;
do $$ begin
  begin perform 1 from farm.catches; raise exception 'FAILED: the table is readable'; exception when insufficient_privilege then raise notice 'ok: the tables are not readable directly'; end;
end $$;
