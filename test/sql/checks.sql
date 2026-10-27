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
-- (they played on 2 days last week; player 2 did not play at all)
insert into farm.play_days (user_id, day, opens, minutes)
select p.user_id, farm.week_of(now()) - 7 + d, 1, 30 from farm.players p, generate_series(0, 1) d where p.user_id <> pg_temp.id(2);
set role authenticated;
do $$ declare n int; g int; begin
  perform pg_temp.as_(2);
  perform pg_temp.ok((select count(*) from farm_prizes_v1()) = 0, 'no prizes for a farm that did not play that week');
  perform pg_temp.as_(1);
  select count(*), coalesce(sum(gold), 0) into n, g from farm_prizes_v1();
  perform pg_temp.ok(n = 2 and g > 0, 'last week''s prizes on 2 boards (quests were 0)');
  perform pg_temp.ok((select count(*) from farm_prizes_v1()) = 0, 'prizes only once');
end $$;
-- Selebox alerts for farm friends
reset role;
delete from public.notifications;
set role authenticated;
do $$ begin
  perform pg_temp.as_(1); perform farm_block_v1(pg_temp.id(5), false);
  perform pg_temp.as_(5); perform farm_visit_v1(pg_temp.id(1)); perform farm_visit_v1(pg_temp.id(1)); perform farm_gift_v1(pg_temp.id(1), 'gold');
end $$;
reset role;
do $$ begin
  perform pg_temp.ok((select count(*) from public.notifications where type = 'farm_alert' and metadata->>'kind' = 'visit') = 1, 'a visit alerts the host once a day');
  perform pg_temp.ok((select count(*) from public.notifications where type = 'farm_alert' and metadata->>'kind' = 'gift') = 1, 'a gift alerts the host');
  perform pg_temp.ok((select metadata->>'push_body' from public.notifications where metadata->>'kind' = 'visit') = 'Eve visited your farm in Harvest Ville', 'the push says who and what');
  perform pg_temp.ok((select count(*) from public.notification_push_copy_v1(array(select id from public.notifications)) c where c.title = 'Harvest Ville') = 2, 'the push text function knows farm alerts');
  perform pg_temp.ok((select push_enabled from public.notification_push_policy where type = 'farm_alert'), 'farm alerts may push');
end $$;
insert into public.app_config values ('sunny_acres_alerts', 'off');
set role authenticated;
do $$ begin perform pg_temp.as_(3); perform farm_join_v1(); perform farm_publish_v1('{}'::jsonb, 1, 1, 0, 0); perform pg_temp.as_(5); perform farm_visit_v1(pg_temp.id(3)); end $$;
reset role;
do $$ begin perform pg_temp.ok((select count(*) from public.notifications where metadata->>'kind' = 'visit') = 1, 'switched off: no alert'); end $$;
delete from public.app_config where key = 'sunny_acres_alerts';
set role authenticated;
do $$ declare code text; begin
  perform pg_temp.as_(5); select friend_code into code from codes where user_id = pg_temp.id(3); perform farm_friend_add_v1(code);
  perform pg_temp.as_(3); select friend_code into code from codes where user_id = pg_temp.id(5); perform farm_friend_add_v1(code);
  perform farm_message_send_v1(pg_temp.id(5), 'hi'); perform farm_message_send_v1(pg_temp.id(5), 'hi again');
end $$;
reset role;
do $$ begin
  perform pg_temp.ok((select count(*) from public.notifications where metadata->>'kind' = 'friend') = 2, 'a friend request and its acceptance alert');
  perform pg_temp.ok((select count(*) from public.notifications where metadata->>'kind' = 'message') = 1, 'messages alert once per 30 minutes');
  perform pg_temp.ok((select count(*) from public.notifications where message ilike '%hi%') = 0, 'message text never goes into an alert');
end $$;
-- part 3: Selebox follows count as farm friends
reset role;
insert into public.follows (follower_id, following_id)
select a.id, b.id from public.profiles a, public.profiles b, (values (1, 5), (5, 1), (3, 1), (1, 2), (2, 1)) f(x, y)
where a.auth_user_id = pg_temp.id(f.x) and b.auth_user_id = pg_temp.id(f.y);
set role authenticated;
do $$ begin
  perform pg_temp.as_(1);
  perform pg_temp.ok((select via from farm_friends_v1() where id = pg_temp.id(5)) = 'selebox', 'following each other on Selebox = farm friends');
  perform pg_temp.ok((select count(*) from farm_friends_v1() where id = pg_temp.id(2)) = 0, 'a blocked follow is not a friend');
  perform pg_temp.as_(5); perform pg_temp.ok(farm_message_send_v1(pg_temp.id(1), 'hello from Selebox') = 'ok', 'Selebox friends can write');
  perform pg_temp.ok((select via from farm_friends_v1() where id = pg_temp.id(3)) = 'code', 'friend-code friends stay');
  perform pg_temp.as_(3);
  perform pg_temp.ok((select count(*) from farm_list_v1('following') where id = pg_temp.id(1)) = 1, 'farms of people I follow');
  perform pg_temp.ok((select count(*) from farm_friends_v1() where id = pg_temp.id(1)) = 0, 'a one-way follow is not a friend');
  perform pg_temp.ok(farm_message_send_v1(pg_temp.id(1), 'hi') = 'notfriends', 'a one-way follow cannot write');
end $$;
-- part 3: staff tools
do $$ begin
  perform pg_temp.as_(1);
  begin perform farm_reports_v1(); perform pg_temp.ok(false, 'x'); exception when insufficient_privilege then perform pg_temp.ok(true, 'reports are staff only'); end;
  begin perform farm_moderate_v1(pg_temp.id(2), 'clear'); perform pg_temp.ok(false, 'x'); exception when insufficient_privilege then perform pg_temp.ok(true, 'decisions are staff only'); end;
end $$;
reset role; update public.profiles set role = 'moderator' where auth_user_id = pg_temp.id(5); set role authenticated;
do $$ declare r record; begin
  perform pg_temp.as_(5);
  select * into r from farm_reports_v1() where id = pg_temp.id(2);
  perform pg_temp.ok(r.reporters = 3 and r.hidden and r.reasons like '%messages%' and r.evidence ->> 'farm_name' is not null, 'staff see the reported farm with reasons and evidence');
  perform pg_temp.ok(farm_moderate_v1(pg_temp.id(2), 'nuke') = 'bad', 'unknown decision refused');
  perform pg_temp.ok(farm_moderate_v1(pg_temp.id(2), 'rename') = 'ok', 'reset a rude name');
  perform pg_temp.ok((select count(*) from farm_reports_v1()) = 0, 'its reports are closed');
end $$;
reset role;
do $$ begin
  perform pg_temp.ok((select farm_name like 'Farm %' and not hidden from farm.players where user_id = pg_temp.id(2)), 'renamed and shown again');
  perform pg_temp.ok((select bool_and(status = 'actioned') from farm.reports where target = pg_temp.id(2)), 'reports marked actioned');
end $$;
-- part 3: play tracking (the prize checks' play days from last week are cleared first)
reset role; delete from farm.play_days; set role authenticated;
do $$ declare s record; begin
  perform pg_temp.as_(1); perform farm_track_v1(1, 0); perform farm_track_v1(0, 5); perform farm_track_v1(9, 9999);
  perform pg_temp.as_(3); perform farm_track_v1(1, 3);
  begin perform farm_stats_v1(); perform pg_temp.ok(false, 'x'); exception when insufficient_privilege then perform pg_temp.ok(true, 'stats are staff only'); end;
  perform pg_temp.as_(5);
  select * into s from farm_stats_v1(7) order by day desc limit 1;
  perform pg_temp.ok(s.players = 2 and s.new_players = 2 and s.minutes = 248, 'today: 2 players, 2 new, minutes capped per call (' || s.minutes || ')');
  perform pg_temp.ok((select count(*) from farm_stats_v1(7)) = 7, 'one row a day');
end $$;
reset role;
do $$ begin perform pg_temp.ok((select opens from farm.play_days where user_id = pg_temp.id(1)) = 2, 'an open counts once per call'); end $$;
set role anon;
do $$ begin perform farm_track_v1(1, 1); perform pg_temp.ok(false, 'x'); exception when insufficient_privilege then perform pg_temp.ok(true, 'signed-out users cannot track'); end $$;
-- part 4: energy refills for Selebox Coins or Stars
reset role;
insert into public.wallets (user_id, coin_balance, star_balance) select id, 12, 15 from public.profiles where auth_user_id = pg_temp.id(1);
insert into public.wallets (user_id, coin_balance, star_balance) select id, 0, 0 from public.profiles where auth_user_id = pg_temp.id(2);
set role authenticated;
do $$ declare shop jsonb; r jsonb; rid uuid := gen_random_uuid(); begin
  perform pg_temp.as_(1);
  shop := farm_shop_v1();
  perform pg_temp.ok(shop -> 'wallet' = '{"coins": 12, "stars": 15}'::jsonb and (shop ->> 'left')::int = 20, 'the shop shows my own Coins and Stars');
  perform pg_temp.ok(shop -> 'offers' @> '[{"currency": "coins", "price": 5, "amount": 100}, {"currency": "stars", "price": 10, "amount": 100}]'::jsonb, 'refill: 5 Coins or 10 Stars for 100 energy');
  r := farm_buy_v1('energy', 'coins', 5, 1, rid);
  perform pg_temp.ok((r ->> 'ok')::boolean and (r ->> 'amount')::int = 100 and (r ->> 'balance')::int = 7, 'paid 5 Coins (' || r::text || ')');
  r := farm_buy_v1('energy', 'coins', 5, 1, rid);
  perform pg_temp.ok((r ->> 'duplicate')::boolean and (r ->> 'amount')::int = 100, 'the same tap again is not charged again');
  r := farm_buy_v1('energy', 'stars', 10, 1, gen_random_uuid());
  perform pg_temp.ok((r ->> 'balance')::int = 5, 'paid 10 Stars');
  r := farm_buy_v1('energy', 'stars', 10, 1, gen_random_uuid());
  perform pg_temp.ok(r ->> 'code' = 'insufficient-stars', 'not enough Stars: nothing taken');
  r := farm_buy_v1('energy', 'coins', 1, 1, gen_random_uuid());
  perform pg_temp.ok(r ->> 'code' = 'offer-changed', 'a price the server does not have is refused');
  perform pg_temp.ok(farm_buy_v1('gold', 'coins', 5, 1, gen_random_uuid()) ->> 'code' = 'offer-unavailable', 'only what is on sale');
  perform pg_temp.as_(2);
  perform pg_temp.ok(farm_buy_v1('energy', 'coins', 5, 1, gen_random_uuid()) ->> 'code' = 'insufficient-coins', 'an empty wallet');
  perform pg_temp.as_(4);
  perform pg_temp.ok(farm_buy_v1('energy', 'coins', 5, 1, gen_random_uuid()) ->> 'code' = 'account-unavailable', 'banned accounts cannot buy');
end $$;
reset role;
do $$ begin
  perform pg_temp.ok((select coin_balance = 7 and star_balance = 5 from public.wallets w join public.profiles p on p.id = w.user_id where p.auth_user_id = pg_temp.id(1)), 'the wallet lost exactly 5 Coins and 10 Stars');
  perform pg_temp.ok((select count(*) from public.coin_transactions where type = 'farm_energy' and delta = -5 and balance_after = 7) = 1
    and (select count(*) from public.star_transactions where type = 'farm_energy' and delta = -10 and balance_after = 5) = 1, 'each payment is in Selebox''s coin / star history');
  perform pg_temp.ok((select count(*) from farm.purchases) = 2, 'two receipts');
  perform pg_temp.ok((select pg_get_constraintdef(oid) like '%pet_meals%farm_energy%' from pg_constraint where conname = 'coin_transactions_type_check'), 'the ledgers keep their old types');
end $$;
update public.wallets set coin_balance = 500;
insert into farm.purchases (user_id, request_id, item, currency, price, amount) select pg_temp.id(1), gen_random_uuid(), 'energy', 'coins', 5, 100 from generate_series(1, 18);
set role authenticated;
do $$ begin
  perform pg_temp.as_(1);
  perform pg_temp.ok((farm_shop_v1() ->> 'left')::int = 0, '20 refills a day');
  perform pg_temp.ok(farm_buy_v1('energy', 'coins', 5, 1, gen_random_uuid()) ->> 'code' = 'limit', 'the 21st is refused');
end $$;
set role anon;
do $$ begin perform farm_buy_v1('energy', 'coins', 5, 1, gen_random_uuid()); perform pg_temp.ok(false, 'x'); exception when insufficient_privilege then perform pg_temp.ok(true, 'signed-out users cannot buy'); end $$;
-- part 5: review fixes
reset role;
insert into auth.users select ('00000000-0000-4000-8000-00000000000' || n)::uuid from generate_series(6, 9) n;
insert into public.profiles (auth_user_id, is_banned, suspended_until, display_name, username)
select ('00000000-0000-4000-8000-00000000000' || n)::uuid, false, null, 'P' || n, 'p' || n from generate_series(6, 9) n;
set role authenticated;
do $$ begin
  perform pg_temp.as_(6); perform farm_join_v1(); perform farm_publish_v1('{}'::jsonb, 1, 1, 0, 0);
  perform pg_temp.as_(7); perform farm_join_v1(); perform farm_publish_v1('{}'::jsonb, 1, 1, 0, 0);
  perform farm_block_v1(pg_temp.id(6), true);
end $$;
reset role; update farm.players set hidden = true where user_id = pg_temp.id(6); set role authenticated;
do $$ begin
  perform pg_temp.as_(6); perform farm_leave_v1(); perform farm_join_v1(); perform farm_publish_v1('{}'::jsonb, 1, 1, 0, 0);
  perform pg_temp.as_(7);
  perform pg_temp.ok((select count(*) from farm_blocked_v1() where id = pg_temp.id(6)) = 1, 'leaving and joining again does not undo a block');
end $$;
reset role;
do $$ begin
  perform pg_temp.ok((select hidden from farm.players where user_id = pg_temp.id(6)), 'nor a moderator''s hide');
end $$;
-- friend request, cancel, request again: one push
set role authenticated;
do $$ begin
  perform pg_temp.as_(9); perform farm_join_v1(); perform farm_publish_v1('{}'::jsonb, 1, 1, 0, 0); perform farm_set_listed_v1(false);
  perform pg_temp.as_(8); perform farm_join_v1(); perform farm_publish_v1('{}'::jsonb, 1, 1, 0, 0);
end $$;
reset role; create temp table codes5 as select user_id, friend_code from farm.players; grant select on codes5 to authenticated;
set role authenticated;
do $$ declare c9 text; begin
  perform pg_temp.as_(8);
  select friend_code into c9 from codes5 where user_id = pg_temp.id(9);
  for i in 1..4 loop perform farm_friend_add_v1(c9); perform farm_friend_answer_v1(pg_temp.id(9), false); end loop;
  perform farm_friend_add_v1(c9);
end $$;
reset role;
do $$ begin
  perform pg_temp.ok((select count(*) from public.notifications n join public.profiles p on p.id = n.recipient_id
    where p.auth_user_id = pg_temp.id(9) and n.metadata->>'kind' = 'friend') = 1, 'asking again and again pushes once a day (' || (select count(*) from public.notifications n join public.profiles p on p.id = n.recipient_id where p.auth_user_id = pg_temp.id(9) and n.metadata->>'kind' = 'friend') || ')');
end $$;
set role authenticated;
-- a hidden farm: friends only
do $$ declare c8 text; begin
  perform pg_temp.as_(7);
  begin perform farm_visit_v1(pg_temp.id(9)); perform pg_temp.ok(false, 'x'); exception when others then perform pg_temp.ok(sqlerrm = 'no such farm', 'a hidden farm turns strangers away'); end;
  perform pg_temp.as_(9); select friend_code into c8 from codes5 where user_id = pg_temp.id(8); perform farm_friend_add_v1(c8);
  perform pg_temp.as_(8);
  perform pg_temp.ok((farm_visit_v1(pg_temp.id(9)) ->> 'friend')::boolean, 'friends can still visit it');
end $$;
-- guests can't report
reset role; update public.profiles set is_guest = true where auth_user_id = pg_temp.id(7); set role authenticated;
do $$ begin
  perform pg_temp.as_(7);
  perform pg_temp.ok(farm_report_v1(pg_temp.id(8), 'name') = 'guest', 'guest accounts cannot report');
end $$;
-- part 5: weekly ranks
reset role; update farm.snapshots set updated_at = now() - interval '1 minute'; set role authenticated;
do $$ declare b int; begin
  perform pg_temp.as_(8);
  perform pg_temp.ok(farm_publish_v1('{}'::jsonb, 100000, 1, 0, 0), 'publish');
end $$;
reset role;
do $$ begin
  perform pg_temp.ok((select beauty from farm.scores where user_id = pg_temp.id(8) and week = farm.week_of(now())) = 1000, 'a first ranked week counts 1,000 beauty at most');
  perform pg_temp.ok((select beauty from farm.snapshots where user_id = pg_temp.id(8)) = 1000, 'and the Visit list shows the same');
end $$;
insert into farm.scores (user_id, week, beauty, earned, quests) values (pg_temp.id(9), farm.week_of(now()) - 7, 2000, 0, 0);
update farm.snapshots set updated_at = now() - interval '1 minute' where user_id = pg_temp.id(9);
set role authenticated;
do $$ begin
  perform pg_temp.as_(9); perform farm_publish_v1('{}'::jsonb, 99999, 1, 0, 0);
end $$;
reset role;
do $$ begin
  perform pg_temp.ok((select beauty from farm.scores where user_id = pg_temp.id(9) and week = farm.week_of(now())) = 3500, 'then at most 1,500 more than the best earlier week');
end $$;
-- ties: one winner per place
reset role;
delete from farm.prizes;
insert into farm.scores (user_id, week, beauty, earned, quests)
select ('00000000-0000-4000-8000-00000000000' || n)::uuid, farm.week_of(now()) - 7, 0, 0, 5 from generate_series(6, 9) n
on conflict (user_id, week) do update set quests = 5;
update farm.scores set quests = 5 where week = farm.week_of(now()) - 7;
insert into farm.play_days (user_id, day, opens, minutes)
select ('00000000-0000-4000-8000-00000000000' || n)::uuid, farm.week_of(now()) - 7 + d, 1, 30 from generate_series(6, 9) n, generate_series(0, 1) d
on conflict do nothing;
update public.profiles set is_guest = false;
create temp table ranks5 (n int, rk int); grant all on ranks5 to authenticated;
set role authenticated;
do $$ declare r record; begin
  for i in 1..9 loop
    if i = 4 then continue; end if;
    perform pg_temp.as_(i);
    for r in select * from farm_prizes_v1() where kind = 'quests' loop insert into ranks5 values (i, r.rank); end loop;
  end loop;
end $$;
reset role;
do $$ begin
  perform pg_temp.ok((select count(distinct rk) = count(*) from ranks5), 'tied scores get different places (' || (select string_agg(n || ':' || rk, ' ') from ranks5) || ')');
end $$;
-- part 6: helping a friend's farm
reset role;
insert into farm.friends (user_a, user_b, requested_by, accepted_at)
values (least(pg_temp.id(6), pg_temp.id(7)), greatest(pg_temp.id(6), pg_temp.id(7)), pg_temp.id(6), now())
on conflict (user_a, user_b) do update set accepted_at = now();
insert into farm.snapshots (user_id, data, beauty, house_level) values (pg_temp.id(6), '{}', 1, 1), (pg_temp.id(7), '{}', 1, 1) on conflict do nothing;
update farm.players set hidden = false, listed = true where user_id in (pg_temp.id(6), pg_temp.id(7), pg_temp.id(8));
delete from farm.blocks where pg_temp.id(6) in (blocker, blocked) or pg_temp.id(7) in (blocker, blocked);
set role authenticated;
do $$ declare r json; begin
  perform pg_temp.as_(7);
  perform pg_temp.ok(farm_help_v1(pg_temp.id(6), 10) ->> 'code' = 'visit', 'help only on a farm you visited today');
  perform farm_visit_v1(pg_temp.id(6));
  r := farm_help_v1(pg_temp.id(6), 10);
  perform pg_temp.ok((r ->> 'ok')::boolean and (r ->> 'left')::int = 4, 'a friend waters a crop (' || r || ')');
  perform pg_temp.ok(farm_help_v1(pg_temp.id(6), 10) ->> 'code' = 'done', 'the same tile once a day');
  for t in 11..14 loop perform farm_help_v1(pg_temp.id(6), t); end loop;
  perform pg_temp.ok(farm_help_v1(pg_temp.id(6), 15) ->> 'code' = 'limit', '5 tiles per friend a day');
  perform pg_temp.ok(farm_help_v1(pg_temp.id(7), 1) ->> 'code' = 'self', 'not your own farm');
  perform pg_temp.ok(farm_help_v1(pg_temp.id(8), 1) ->> 'code' = 'friends', 'friends only');
  perform pg_temp.ok(farm_help_v1(pg_temp.id(6), -1) ->> 'code' = 'bad', 'a real tile');
  perform pg_temp.as_(6);
  r := farm_helps_v1();
  perform pg_temp.ok(json_array_length(r -> 'tiles') = 5 and json_array_length(r -> 'from') = 1, 'the friend sees the 5 watered tiles and who (' || r || ')');
  perform pg_temp.ok(json_array_length(farm_helps_v1() -> 'tiles') = 0, 'taken once');
end $$;
reset role;
do $$ begin
  perform pg_temp.ok(not has_function_privilege('anon', 'public.farm_help_v1(uuid, int)', 'execute') and not has_function_privilege('anon', 'public.farm_helps_v1()', 'execute'), 'not for signed-out users');
  perform pg_temp.ok(has_function_privilege('authenticated', 'public.farm_help_v1(uuid, int)', 'execute'), 'players can call it');
  perform pg_temp.ok((select count(*) from public.notifications where type = 'farm_alert' and metadata ->> 'kind' = 'help') <= 1, 'one push a day per pair');
end $$;
-- part 7: the Market
set role authenticated;
do $$ declare r json; lot bigint; lot2 bigint; begin
  perform pg_temp.as_(6);
  perform pg_temp.ok(farm_market_list_v1('milk', 11, 100) ->> 'code' = 'bad', 'up to 10 in a lot');
  perform pg_temp.ok(farm_market_list_v1('Milk!', 1, 100) ->> 'code' = 'bad', 'an item id, nothing else');
  lot := (farm_market_list_v1('milk', 3, 280) ->> 'id')::bigint;
  perform pg_temp.ok(lot is not null, 'a lot at the stall');
  lot2 := (farm_market_list_v1('mango', 3, 120) ->> 'id')::bigint;
  perform farm_market_list_v1('cheese', 1, 500); perform farm_market_list_v1('egg', 2, 90);
  perform pg_temp.ok(farm_market_list_v1('egg', 1, 45) ->> 'code' = 'full', '4 lots at a time');
  perform pg_temp.ok((select count(*) from farm_market_mine_v1() where status = 'open') = 4, 'my stall shows them');
  perform pg_temp.ok(farm_market_buy_v1(lot) ->> 'code' = 'self', 'not your own lot');
  r := farm_market_cancel_v1((select id from farm_market_mine_v1() where item = 'egg'));
  perform pg_temp.ok((r ->> 'ok')::boolean and r ->> 'item' = 'egg', 'take a lot back');
  perform pg_temp.as_(7);
  perform pg_temp.ok((select count(*) from farm_market_of_v1(pg_temp.id(6))) = 3, 'a friend sees the stall');
  perform pg_temp.ok((select friend from farm_market_find_v1('milk') limit 1) and (select price from farm_market_find_v1('milk') limit 1) = 280, 'find: friends first');
  r := farm_market_buy_v1(lot);
  perform pg_temp.ok((r ->> 'ok')::boolean and r ->> 'item' = 'milk' and (r ->> 'qty')::int = 3 and (r ->> 'price')::int = 280, 'bought (' || r || ')');
  perform pg_temp.as_(8);
  perform pg_temp.ok(farm_market_buy_v1(lot) ->> 'code' = 'gone', 'sold once only');
  perform pg_temp.ok((select count(*) from farm_market_find_v1('milk')) = 0, 'a sold lot is off the market');
  perform pg_temp.as_(6);
  perform pg_temp.ok((select buyer_name from farm_market_mine_v1() where id = lot) is not null, 'the seller sees who bought it');
  r := farm_market_collect_v1();
  perform pg_temp.ok(json_array_length(r -> 'sold') = 1 and (r -> 'sold' -> 0 ->> 'price')::int = 280, 'the seller collects the gold (' || r || ')');
  perform pg_temp.ok(json_array_length(farm_market_collect_v1() -> 'sold') = 0, 'once');
end $$;
-- blocked: no stall, no finding, no buying; an expired lot comes back
reset role;
insert into farm.blocks (blocker, blocked) values (pg_temp.id(6), pg_temp.id(8)) on conflict do nothing;
update farm.market set expires_at = now() - interval '1 minute' where item = 'cheese';
create temp table mango_lot as select id from farm.market where item = 'mango'; grant select on mango_lot to authenticated;
set role authenticated;
do $$ declare r json; begin
  perform pg_temp.as_(8);
  perform pg_temp.ok((select count(*) from farm_market_of_v1(pg_temp.id(6))) = 0 and (select count(*) from farm_market_find_v1('mango')) = 0, 'a blocked player sees nothing');
  perform pg_temp.ok(farm_market_buy_v1((select id from mango_lot)) ->> 'code' = 'gone', 'nor buys from them');
  perform pg_temp.as_(7);
  perform pg_temp.ok((select count(*) from farm_market_find_v1('cheese')) = 0, 'an expired lot is off the market');
  perform pg_temp.as_(6);
  r := farm_market_collect_v1();
  perform pg_temp.ok(json_array_length(r -> 'returned') = 1 and r -> 'returned' -> 0 ->> 'item' = 'cheese', 'and back to the seller (' || r || ')');
end $$;
reset role;
do $$ begin
  perform pg_temp.ok(not has_function_privilege('anon', 'public.farm_market_buy_v1(bigint)', 'execute') and not has_function_privilege('anon', 'public.farm_market_find_v1(text)', 'execute'), 'market: not for signed-out users');
  perform pg_temp.ok(not has_function_privilege('authenticated', 'farm.can_see(uuid, uuid)', 'execute'), 'helpers stay private');
end $$;
