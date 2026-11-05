-- Plays farm_online_19.sql (Central Park: three parks of 30, park:1 to park:3) as signed-in players on the local
-- Postgres (test/sql/run.sh). Its own players: 1 to 40 (made straight in farm.players), and 41 (signed in, never
-- joined online play). Time is moved by hand (seen_at) as postgres.
\set ON_ERROR_STOP 1
set role postgres;
create function pg_temp.id(n int) returns uuid language sql as $$ select ('00000000-0000-4000-e000-' || lpad(n::text, 12, '0'))::uuid $$;
insert into auth.users select pg_temp.id(n) from generate_series(1, 41) n;
insert into farm.players (user_id, farm_name, friend_code)
  select pg_temp.id(n), 'Park ' || n, translate(lpad(n::text, 8, '0'), '0123456789', 'PQRSTUVWXY') from generate_series(1, 40) n;
insert into realtime.messages values (19, 'park:1', 'broadcast');
grant execute on function pg_temp.id(int) to authenticated;
-- (a seat last seen s seconds ago; two players made friends)
create function pg_temp.age(n int, s int) returns void language sql security definer as $$
  update farm.park_seats set seen_at = now() - make_interval(secs => s) where user_id = pg_temp.id(n) $$;
create function pg_temp.friends(a int, b int) returns void language sql security definer as $$
  insert into farm.friends (user_a, user_b, requested_by, accepted_at)
  values (least(pg_temp.id(a), pg_temp.id(b)), greatest(pg_temp.id(a), pg_temp.id(b)), pg_temp.id(a), now()) $$;
create function pg_temp.block(a int, b int) returns void language sql security definer as $$
  insert into farm.blocks (blocker, blocked) values (pg_temp.id(a), pg_temp.id(b)) $$;
create function pg_temp.seats() returns bigint language sql security definer as $$ select count(*) from farm.park_seats $$;
create function pg_temp.drop_player(n int) returns void language sql security definer as $$ delete from farm.players where user_id = pg_temp.id(n) $$;
grant execute on function pg_temp.age(int, int), pg_temp.friends(int, int), pg_temp.block(int, int), pg_temp.seats(), pg_temp.drop_player(int) to authenticated;
set role authenticated;
create function pg_temp.as_(n int) returns void language sql as $$ select set_config('request.uid', case when n = 0 then '' else pg_temp.id(n)::text end, false) $$;
create function pg_temp.ok(c boolean, what text) returns void language plpgsql as $$ begin if not coalesce(c, false) then raise exception 'FAILED: %', what; end if; raise notice 'ok: %', what; end $$;

-- 1. pick for me fills Park 1 first; full; pick by hand
do $$ declare r jsonb; begin
  perform pg_temp.as_(1); perform pg_temp.ok(farm_park_counts_v1() = '{"counts": [0, 0, 0]}', 'nobody in the parks yet');
  for n in 1 .. 30 loop
    perform pg_temp.as_(n); r := farm_park_join_v1(null);
    if (r ->> 'park')::int <> 1 or not (r ->> 'ok')::boolean then raise exception 'FAILED: player % went to %', n, r; end if;
  end loop;
  raise notice 'ok: the first 30 all go to Park 1';
  perform pg_temp.as_(31);
  perform pg_temp.ok(farm_park_join_v1(1) = '{"ok": false, "code": "full", "counts": [30, 0, 0]}', 'Park 1 is full, with the counts');
  perform pg_temp.ok(farm_park_join_v1() = '{"ok": true, "park": 2, "counts": [30, 1, 0]}', 'pick for me: Park 2 (no park named)');
  perform pg_temp.as_(32); perform pg_temp.ok(farm_park_join_v1(3) ->> 'counts' = '[30, 1, 1]', 'a park picked by hand');
  perform pg_temp.as_(5); perform pg_temp.ok(farm_park_join_v1(1) ->> 'park' = '1', 'a full park still has my own seat');
  perform pg_temp.ok(farm_park_join_v1(null) ->> 'park' = '1', 'pick for me keeps my fresh seat');
end $$;

-- 2. friends first, if there is room
do $$ begin
  perform pg_temp.friends(33, 32); perform pg_temp.friends(34, 31); perform pg_temp.friends(34, 1);
  perform pg_temp.as_(33); perform pg_temp.ok(farm_park_join_v1() ->> 'park' = '3', 'to my friend in Park 3 (not Park 2)');
  perform pg_temp.friends(35, 32); perform pg_temp.friends(35, 33); perform pg_temp.friends(35, 31);
  perform pg_temp.as_(35); perform pg_temp.ok(farm_park_join_v1() ->> 'park' = '3', 'to the park with the most friends');
  perform pg_temp.as_(34); perform pg_temp.ok(farm_park_join_v1() ->> 'park' = '2', 'a friend in full Park 1 and one in Park 2: Park 2');
  perform pg_temp.block(36, 32); perform pg_temp.friends(36, 32);
  perform pg_temp.as_(36); perform pg_temp.ok(farm_park_join_v1() ->> 'park' = '2', 'a blocked "friend" draws nobody (the lowest with room)');
end $$;

-- 3. a seat lasts 75 s without a beat
do $$ begin
  perform pg_temp.as_(2); perform pg_temp.age(2, 60);
  perform pg_temp.ok(farm_park_beat_v1() = '{"ok": true, "park": 1, "counts": [30, 3, 3]}', 'a beat within 75 s keeps the seat');
  perform pg_temp.age(2, 76);
  perform pg_temp.ok(farm_park_counts_v1() -> 'counts' -> 0 = '29', 'a stale seat does not count');
  perform pg_temp.as_(37); perform pg_temp.ok(farm_park_join_v1(1) ->> 'park' = '1', 'so someone else takes it');
  perform pg_temp.as_(2); perform pg_temp.ok(farm_park_beat_v1() = '{"ok": true, "park": null, "counts": [30, 3, 3]}', 'the late one is out, not the 31st');
  perform pg_temp.as_(37); perform farm_park_leave_v1();
  perform pg_temp.as_(3); perform pg_temp.age(3, 80);
  perform pg_temp.ok(farm_park_beat_v1() ->> 'park' = '1', 'a stale seat with room comes back');
  perform pg_temp.as_(38); perform pg_temp.ok(farm_park_beat_v1() = '{"ok": true, "park": null, "counts": [29, 3, 3]}', 'no seat: park null');
end $$;

-- 4. moving, leaving, odd calls
do $$ begin
  perform pg_temp.as_(31); perform pg_temp.ok(farm_park_join_v1(3) ->> 'counts' = '[29, 2, 4]', 'moved: in one park only');
  perform farm_park_leave_v1(); perform pg_temp.ok(farm_park_counts_v1() ->> 'counts' = '[29, 2, 3]', 'leave frees the seat at once');
  perform farm_park_leave_v1(); perform pg_temp.ok(true, 'leaving twice is fine');
  perform pg_temp.ok(farm_park_join_v1(4) ->> 'code' = 'bad', 'no Park 4');
  perform pg_temp.ok(farm_park_join_v1(0) ->> 'code' = 'bad', 'no Park 0');
  perform pg_temp.as_(41); perform pg_temp.ok(farm_park_join_v1() = '{"ok": false, "code": "not-player"}', 'not a player');
  perform pg_temp.ok(farm_park_beat_v1() ->> 'park' is null, 'not a player: no seat to keep');
  perform pg_temp.as_(0);
  begin perform farm_park_join_v1(); perform pg_temp.ok(false, 'x'); exception when others then perform pg_temp.ok(sqlerrm = 'not signed in', 'not signed in: join refused'); end;
  begin perform farm_park_counts_v1(); perform pg_temp.ok(false, 'x'); exception when others then perform pg_temp.ok(sqlerrm = 'not signed in', 'not signed in: no counts'); end;
  perform pg_temp.as_(33); perform pg_temp.drop_player(33);
  perform pg_temp.ok(farm_park_counts_v1() ->> 'counts' = '[29, 2, 2]', 'leaving online play leaves the park');
end $$;

-- 5. the park channels: any player; the farm channels as before (checks.sql plays those after this part too)
do $$ begin
  perform pg_temp.as_(1);
  perform pg_temp.ok(farm_topic_ok_v1('park:1') and farm_topic_ok_v1('park:2') and farm_topic_ok_v1('park:3'), 'a player may use the three parks');
  perform pg_temp.ok(not farm_topic_ok_v1('park:4') and not farm_topic_ok_v1('park:0') and not farm_topic_ok_v1('park:12')
    and not farm_topic_ok_v1('park:1 ') and not farm_topic_ok_v1('park:') and not farm_topic_ok_v1(null), 'and no other park');
  perform pg_temp.ok(farm_topic_ok_v1('farm:' || pg_temp.id(2)), 'farm channels still work');
  perform set_config('realtime.topic', 'park:1', false);
  perform pg_temp.ok((select count(*) from realtime.messages where topic = 'park:1') = 1, 'a player reads the park channel');
  insert into realtime.messages values (20, 'park:1', 'broadcast');
  perform pg_temp.ok(true, 'and sends on it');
  perform pg_temp.as_(41); perform pg_temp.ok(not farm_topic_ok_v1('park:1'), 'not a player: no park channel');
  perform pg_temp.ok((select count(*) from realtime.messages) = 0, 'not a player reads nothing');
  begin insert into realtime.messages values (21, 'park:1', 'broadcast'); perform pg_temp.ok(false, 'x');
  exception when insufficient_privilege then perform pg_temp.ok(true, 'not a player sends nothing'); end;
  perform set_config('realtime.topic', 'park:9', false);
  perform pg_temp.as_(1); perform pg_temp.ok((select count(*) from realtime.messages) = 0, 'park:9 is no channel');
  perform pg_temp.as_(0); perform set_config('realtime.topic', 'park:1', false);
  perform pg_temp.ok(not farm_topic_ok_v1('park:1') and (select count(*) from realtime.messages) = 0, 'not signed in: nothing');
  perform set_config('realtime.topic', '', false);
end $$;

-- 6. who may call what
set role postgres;
do $$ declare f text; begin
  foreach f in array array['farm_park_join_v1(int)', 'farm_park_beat_v1()', 'farm_park_leave_v1()', 'farm_park_counts_v1()'] loop
    perform pg_temp.ok(not has_function_privilege('anon', 'public.' || f, 'execute') and has_function_privilege('authenticated', 'public.' || f, 'execute'), f || ': players only');
  end loop;
  perform pg_temp.ok(not has_function_privilege('anon', 'public.farm_topic_ok_v1(text)', 'execute'), 'farm_topic_ok_v1 still closed to anon');
  perform pg_temp.ok(not has_function_privilege('authenticated', 'farm.park_counts()', 'execute'), 'the helpers stay on the server');
  perform pg_temp.ok(not has_table_privilege('authenticated', 'farm.park_seats', 'select') and not has_table_privilege('anon', 'farm.park_seats', 'select'), 'the seats stay on the server');
  perform pg_temp.ok((select count(*) from pg_policies where schemaname = 'realtime' and policyname in ('farm_park_recv', 'farm_park_send')) = 2, 'two park policies, after running the part twice');
  perform pg_temp.ok((select count(*) from pg_policies where schemaname = 'realtime' and policyname in ('farm_topic_recv', 'farm_topic_send')) = 2, 'the farm policies are untouched');
end $$;
