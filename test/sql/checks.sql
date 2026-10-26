-- Plays farm_online.sql as signed-in players on a local Postgres (test/sql/run.sh). Each check raises on failure.
\set ON_ERROR_STOP 1
insert into auth.users select ('00000000-0000-4000-8000-00000000000' || n)::uuid from generate_series(1, 5) n;
insert into public.profiles values
  ('00000000-0000-4000-8000-000000000001', false, null, 'Dear Jen', 'dearjen'),
  ('00000000-0000-4000-8000-000000000002', false, null, null, 'bob'),
  ('00000000-0000-4000-8000-000000000003', false, null, 'Fuck Farm', 'c3'),
  ('00000000-0000-4000-8000-000000000004', true, null, 'Banned', 'd4'),
  ('00000000-0000-4000-8000-000000000005', false, null, 'Eve', 'e5');
insert into realtime.messages values (1, 'farm:00000000-0000-4000-8000-000000000001', 'broadcast');
set role authenticated;
create function pg_temp.as_(n int) returns void language sql as $$ select set_config('request.uid', '00000000-0000-4000-8000-00000000000' || n, false) $$;
create function pg_temp.id(n int) returns uuid language sql as $$ select ('00000000-0000-4000-8000-00000000000' || n)::uuid $$;
create function pg_temp.ok(c boolean, what text) returns void language plpgsql as $$ begin if not coalesce(c, false) then raise exception 'FAILED: %', what; end if; raise notice 'ok: %', what; end $$;
do $$ begin
  perform pg_temp.as_(1); perform pg_temp.ok(farm_join_v1() ->> 'farm_name' = 'Dear Jen', 'join takes the Selebox name');
  perform pg_temp.ok(farm_publish_v1('{"h":1}'::jsonb, 120, 2, 999999999, 9999), 'publish');
  perform pg_temp.as_(2); perform pg_temp.ok(farm_join_v1() ->> 'farm_name' = 'bob', 'join falls back to the username');
  perform farm_publish_v1('{"h":2}'::jsonb, 50, 1, 100, 1);
  perform pg_temp.as_(3); perform pg_temp.ok(farm_join_v1() ->> 'farm_name' = 'Sunny Acres', 'a rude Selebox name is not used');
  perform farm_publish_v1('{"h":3}'::jsonb, 10, 1, 0, 0);
  perform pg_temp.as_(5); perform farm_join_v1(); perform farm_publish_v1('{"h":5}'::jsonb, 5, 1, 0, 0);
end $$;
-- ranks are capped by the time since Monday
do $$ declare e bigint; q int; hrs numeric := extract(epoch from (now() - (date_trunc('week', now() at time zone 'utc') at time zone 'utc'))) / 3600; begin
  perform pg_temp.as_(1);
  select score into e from farm_leaderboard_v1('earned') where me;
  perform pg_temp.ok(e <= 10000 + 2500 * hrs + 1 and e < 999999999, 'gold earned capped (' || e || ')');
  select score into q from farm_leaderboard_v1('quests') where me;
  perform pg_temp.ok(q <= 10 * ceil(greatest(hrs, 1) / 24), 'daily quests capped (' || q || ')');
end $$;
-- the word list
do $$ begin
  perform pg_temp.as_(2);
  begin perform farm_join_v1('Sh1t Farm'); perform pg_temp.ok(false, 'x'); exception when others then perform pg_temp.ok(sqlerrm = 'name not allowed', 'rude name refused (look-alike letters)'); end;
  begin perform farm_join_v1('Tanga Farm'); perform pg_temp.ok(false, 'x'); exception when others then perform pg_temp.ok(sqlerrm = 'name not allowed', 'Filipino whole word refused'); end;
  perform pg_temp.ok(farm_join_v1('Rooster Cock-a-doodle Farm') ->> 'farm_name' like 'Rooster%', 'farm words are fine');
  perform pg_temp.ok(farm_join_v1('Push It Farm') ->> 'farm_name' = 'Push It Farm', 'no false alarm across words');
end $$;
-- friends, messages, words in messages
do $$ declare code text; begin
  perform pg_temp.as_(1); select friend_code into code from farm.players where user_id = pg_temp.id(2);
  perform pg_temp.ok(false, 'farm schema is closed to players');
exception when insufficient_privilege then perform pg_temp.ok(true, 'farm schema is closed to players');
end $$;
reset role; create temp table codes as select user_id, friend_code from farm.players; grant select on codes to authenticated; set role authenticated;
do $$ begin
  perform pg_temp.as_(1); perform pg_temp.ok(farm_friend_add_v1((select friend_code from codes where user_id = pg_temp.id(2))) = 'requested', 'friend request');
  perform pg_temp.as_(2); perform pg_temp.ok(farm_friend_add_v1((select friend_code from codes where user_id = pg_temp.id(1))) = 'friends', 'friends');
  perform pg_temp.ok(farm_message_send_v1(pg_temp.id(1), 'hello neighbour!') = 'ok', 'message sent');
  perform pg_temp.ok(farm_message_send_v1(pg_temp.id(1), 'you are a gago') = 'word', 'rude message refused');
  perform pg_temp.ok(farm_message_send_v1(pg_temp.id(1), 'leche flan for you, my rooster says hi') = 'ok', 'food words are fine');
end $$;
-- report: evidence copied, 3 reporters hide the farm
do $$ begin
  perform pg_temp.as_(1); perform pg_temp.ok(farm_report_v1(pg_temp.id(2), 'messages', 'mean') = 'ok', 'report');
  perform pg_temp.ok(farm_report_v1(pg_temp.id(2), 'messages') = 'already', 'one report a day per player');
  perform pg_temp.ok(farm_report_v1(pg_temp.id(1), 'name') = 'self', 'no self report');
  perform pg_temp.as_(3); perform farm_report_v1(pg_temp.id(2), 'name');
  perform pg_temp.as_(5); perform pg_temp.ok((select count(*) from farm_list_v1() where id = pg_temp.id(2)) = 1, 'listed before 3 reports');
  perform farm_report_v1(pg_temp.id(2), 'other', 'spam');
  perform pg_temp.ok((select count(*) from farm_list_v1() where id = pg_temp.id(2)) = 0, '3 reporters hide the farm');
  perform pg_temp.ok((select count(*) from farm_leaderboard_v1('beauty') where id = pg_temp.id(2)) = 0, 'and its ranks');
  perform pg_temp.as_(2); perform pg_temp.ok((select count(*) from farm_leaderboard_v1('beauty') where me) = 1, 'the owner still sees their own rank');
end $$;
reset role;
do $$ begin
  perform pg_temp.ok((select evidence -> 'messages' @> '[{"body": "leche flan for you, my rooster says hi"}]'::jsonb and evidence ->> 'farm_name' = 'Push It Farm' from farm.reports where reporter = pg_temp.id(1)), 'report keeps the name and messages as evidence');
end $$;
set role authenticated;
-- block: no list, visit, message, channel, friendship
do $$ begin
  perform pg_temp.as_(1); perform pg_temp.ok(farm_block_v1(pg_temp.id(5), true) = 'blocked', 'block');
  perform pg_temp.ok((select count(*) from farm_blocked_v1()) = 1, 'blocked list');
  perform pg_temp.as_(5);
  perform pg_temp.ok((select count(*) from farm_list_v1() where id = pg_temp.id(1)) = 0, 'blocked: not in lists');
  begin perform farm_visit_v1(pg_temp.id(1)); perform pg_temp.ok(false, 'x'); exception when others then perform pg_temp.ok(sqlerrm = 'no such farm', 'blocked: cannot visit'); end;
  perform pg_temp.ok(farm_friend_add_v1((select friend_code from codes where user_id = pg_temp.id(1))) = 'nocode', 'blocked: cannot add as friend');
  perform set_config('realtime.topic', 'farm:00000000-0000-4000-8000-000000000001', false);
  perform pg_temp.ok((select count(*) from realtime.messages) = 0, 'blocked: cannot join the farm channel');
  perform pg_temp.as_(2); perform pg_temp.ok((select count(*) from realtime.messages) = 1, 'others still can');
  perform pg_temp.as_(1); perform pg_temp.ok(farm_block_v1(pg_temp.id(2), true) = 'blocked', 'block a friend');
  perform pg_temp.ok((select count(*) from farm_friends_v1()) = 0, 'blocking ends the friendship');
  perform pg_temp.as_(2); perform pg_temp.ok(farm_message_send_v1(pg_temp.id(1), 'hi?') = 'notfriends', 'blocked: cannot message');
  perform pg_temp.as_(1); perform pg_temp.ok(farm_block_v1(pg_temp.id(5), false) = 'unblocked', 'unblock');
  perform pg_temp.as_(5); perform pg_temp.ok((select count(*) from farm_list_v1() where id = pg_temp.id(1)) = 1, 'unblocked: back in lists');
end $$;
-- cloud saves and the clock
do $$ begin
  perform pg_temp.as_(4); perform pg_temp.ok(farm_save_put_v1('{"s0":1,"g":5}'::jsonb, now()) = 'ok', 'cloud save without online play (even a banned account keeps its own save)');
  perform pg_temp.ok((farm_save_get_v1() -> 'data' ->> 'g') = '5', 'cloud load');
  perform pg_temp.ok(farm_save_put_v1('{"s0":1,"g":1}'::jsonb, now() - interval '1 hour') = 'older', 'an older copy never replaces a newer one');
  perform pg_temp.ok(farm_save_put_v1(jsonb_build_object('x', repeat('y', 21000)), now()) = 'big', 'too big');
  perform pg_temp.as_(5); perform pg_temp.ok(farm_save_get_v1() is null, 'each player sees only their own');
  perform pg_temp.ok(abs(farm_clock_v1() - extract(epoch from clock_timestamp()) * 1000) < 5000, 'server clock');
  begin perform farm_join_v1(); exception when others then null; end;
  perform pg_temp.as_(4); begin perform farm_join_v1(); perform pg_temp.ok(false, 'x'); exception when others then perform pg_temp.ok(sqlerrm = 'account suspended', 'banned accounts cannot go online'); end;
end $$;
reset role; set role anon;
do $$ begin perform farm_clock_v1(); perform pg_temp.ok(false, 'x'); exception when insufficient_privilege then perform pg_temp.ok(true, 'signed-out users are refused'); end $$;
-- weekly prizes: last week's top 10 per board, once
reset role;
insert into farm.scores (user_id, week, beauty, earned, quests)
select p.user_id, farm.week_of(now()) - 7, k, k * 100, 0 from farm.players p, (select row_number() over () as k, user_id from farm.players) r where r.user_id = p.user_id;
set role authenticated;
do $$ declare n int; g int; begin
  perform pg_temp.as_(1);
  select count(*), coalesce(sum(gold), 0) into n, g from farm_prizes_v1();
  perform pg_temp.ok(n = 2 and g > 0, 'last week''s prizes on 2 boards (quests were 0)');
  perform pg_temp.ok((select count(*) from farm_prizes_v1()) = 0, 'prizes only once');
end $$;
