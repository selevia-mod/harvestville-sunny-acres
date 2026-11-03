-- Plays farm_online_16.sql (barangays and the Bayanihan Cup) and farm_online_17.sql (the Market board) as signed-in
-- players on the local Postgres (test/sql/run.sh). Its own players: 10 to 45 (10 Ana, 11 Ben, 12 Cara, 13 Dan (a guest),
-- 14 Eli; 15 to 45 fill a barangay to its limit). Time is moved by hand (picked_at, week) as postgres.
\set ON_ERROR_STOP 1
set role postgres;
create function pg_temp.id(n int) returns uuid language sql as $$ select ('00000000-0000-4000-a000-0000000000' || lpad(n::text, 2, '0'))::uuid $$;
insert into auth.users select pg_temp.id(n) from generate_series(10, 45) n;
insert into public.profiles (auth_user_id, is_banned, suspended_until, display_name, username)
  select pg_temp.id(n), false, null, 'Farmer ' || n, 'f' || n from generate_series(10, 45) n;
update public.profiles set is_guest = true where auth_user_id = pg_temp.id(13);
grant execute on function pg_temp.id(int) to authenticated;
-- (a task's least time, passed)
create function pg_temp.later() returns void language sql security definer as $$ update farm.cup_picks set picked_at = picked_at - interval '2 hours' $$;
grant execute on function pg_temp.later() to authenticated;
create function pg_temp.code(n int) returns text language sql security definer as $$ select friend_code from farm.players where user_id = pg_temp.id(n) $$;
grant execute on function pg_temp.code(int) to authenticated;
set role authenticated;
create function pg_temp.as_(n int) returns void language sql as $$ select set_config('request.uid', '00000000-0000-4000-a000-0000000000' || lpad(n::text, 2, '0'), false) $$;
create function pg_temp.ok(c boolean, what text) returns void language plpgsql as $$ begin if not coalesce(c, false) then raise exception 'FAILED: %', what; end if; raise notice 'ok: %', what; end $$;

do $$ declare r json; n int; begin
  for n in 10..45 loop perform pg_temp.as_(n); perform farm_join_v1('Farm ' || n); end loop;

  -- ---------- making a barangay ----------
  perform pg_temp.as_(10);
  r := farm_nb_v1();
  perform pg_temp.ok(r -> 'hood' is null or json_typeof(r -> 'hood') = 'null', 'no barangay yet');
  perform pg_temp.ok(json_array_length(r -> 'tasks') = 8, 'this week: 8 tasks');
  perform pg_temp.ok((select count(distinct t ->> 'kind') from json_array_elements(r -> 'tasks') t) = 8, '8 different ones');
  perform pg_temp.ok(farm_nb_create_v1('Sh1t Town', 'mango', true) ->> 'code' = 'word', 'a rude name is refused (look-alike letters)');
  perform pg_temp.ok(farm_nb_create_v1('ab', 'mango', true) ->> 'code' = 'bad', 'too short');
  perform pg_temp.ok(farm_nb_create_v1('Good Name', 'pizza', true) ->> 'code' = 'bad', 'only the 8 badges');
  r := farm_nb_create_v1('  Barangay   Mabuhay ', 'carabao', true);
  perform pg_temp.ok((r ->> 'ok')::boolean and r ->> 'name' = 'Barangay Mabuhay', 'made, the spaces tidied');
  perform pg_temp.ok(farm_nb_create_v1('Another', 'mango', true) ->> 'code' = 'in', 'one barangay at a time');
  perform pg_temp.as_(11);
  perform pg_temp.ok(farm_nb_create_v1('barangay MABUHAY', 'mango', true) ->> 'code' = 'taken', 'names are one of a kind, whatever the case');
  perform pg_temp.ok((farm_nb_create_v1('Ilog Riverside', 'fish_k', false) ->> 'ok')::boolean, 'a closed one: only with its code');
  r := farm_nb_v1();
  perform pg_temp.ok((r -> 'hood' ->> 'leader')::boolean and not (r -> 'hood' ->> 'open')::boolean and (r -> 'hood' ->> 'members')::int = 1, 'its maker leads it');
end $$;

do $$ declare r json; hm bigint; hi bigint; code text; begin
  select id into hm from farm_nb_find_v1('mabuhay');
  perform pg_temp.as_(12);
  perform pg_temp.ok((select count(*) from farm_nb_find_v1(null)) = 2, 'both show in Find');
  perform pg_temp.ok((select id from farm_nb_find_v1('MABU')) = hm, 'found by a part of its name');
  select id into hi from farm_nb_find_v1('ilog');
  perform pg_temp.ok(farm_nb_join_v1(hi, null) ->> 'code' = 'code', 'a closed one needs its code');
  perform pg_temp.ok(farm_nb_join_v1(null, 'ZZZZZZ') ->> 'code' = 'gone', 'a wrong code');
  perform pg_temp.as_(11); code := farm_nb_v1() -> 'hood' ->> 'code';
  perform pg_temp.as_(12);
  perform pg_temp.ok((farm_nb_join_v1(null, lower(code)) ->> 'ok')::boolean, 'joined with the code (any case)');
  perform pg_temp.ok(farm_nb_leave_v1() = 'ok', 'left');
  perform pg_temp.ok((farm_nb_join_v1(hm, null) ->> 'ok')::boolean, 'joined an open one');
  perform pg_temp.as_(14); perform farm_friend_add_v1(pg_temp.code(12));
  perform pg_temp.as_(12); perform farm_friend_add_v1(pg_temp.code(14));
  perform pg_temp.as_(14);
  perform pg_temp.ok((select friends from farm_nb_find_v1(null) where id = hm) = 1, 'Find says a friend is in it');
  perform pg_temp.ok((select id from farm_nb_find_v1(null) limit 1) = hm, 'friends'' barangays first');
  -- a leader who blocked you: their barangay is not there for you
  perform pg_temp.as_(11); perform farm_block_v1(pg_temp.id(14), true);
  perform pg_temp.as_(14);
  perform pg_temp.ok((select count(*) from farm_nb_find_v1(null) where id = hi) = 0, 'not in Find');
  perform pg_temp.ok(farm_nb_join_v1(null, code) ->> 'code' = 'gone', 'not even with the code');
  perform pg_temp.as_(11); perform farm_block_v1(pg_temp.id(14), false);
end $$;

-- ---------- 30 at most ----------
do $$ declare hm bigint; n int; r json; begin
  perform pg_temp.as_(10); hm := (farm_nb_v1() -> 'hood' ->> 'id')::bigint;
  for n in 15..42 loop perform pg_temp.as_(n); perform farm_nb_join_v1(hm, null); end loop;
  perform pg_temp.as_(10);
  perform pg_temp.ok((farm_nb_v1() -> 'hood' ->> 'members')::int = 30, '30 members');
  perform pg_temp.as_(43);
  perform pg_temp.ok(farm_nb_join_v1(hm, null) ->> 'code' = 'full', 'the 31st is turned away');
  perform pg_temp.ok((select count(*) from farm_nb_find_v1('mabuhay')) = 0, 'a full one is not in Find');
  for n in 15..42 loop perform pg_temp.as_(n); perform farm_nb_leave_v1(); end loop;
  perform pg_temp.as_(10);
  perform pg_temp.ok((select count(*) from farm_nb_members_v1()) = 2, 'members: back to 2');
  perform pg_temp.as_(15); perform farm_nb_join_v1(hm, null); perform farm_nb_leave_v1();
  perform pg_temp.as_(10);
  perform pg_temp.ok((select count(*) from farm_nb_posts_v1() where who = pg_temp.id(15)) = 1, 'joining and leaving again the same day: no new lines on the board');
end $$;

-- ---------- the news board ----------
do $$ declare n int; begin
  perform pg_temp.as_(12);
  perform pg_temp.ok(farm_nb_post_v1('Magandang umaga, mga kapitbahay!') = 'ok', 'a line on the board');
  perform pg_temp.ok(farm_nb_post_v1('putangina') = 'word', 'a rude one is refused');
  perform pg_temp.ok(farm_nb_post_v1('   ') = 'empty', 'an empty one');
  perform pg_temp.as_(10);
  perform pg_temp.ok((select body from farm_nb_posts_v1() where kind = 'say' limit 1) = 'Magandang umaga, mga kapitbahay!', 'members read it');
  perform pg_temp.ok((select count(*) from farm_nb_posts_v1() where kind = 'left' and who = pg_temp.id(42)) = 1 and (select count(*) from farm_nb_posts_v1()) = 40, 'and who joined and left (the newest 40)');
  perform farm_block_v1(pg_temp.id(12), true);
  perform pg_temp.ok((select count(*) from farm_nb_posts_v1() where who = pg_temp.id(12)) = 0, 'a blocked member''s lines are hidden');
  perform pg_temp.ok((select count(*) from farm_nb_members_v1() where id = pg_temp.id(12)) = 0, 'and so are they in the members');
  perform farm_block_v1(pg_temp.id(12), false);
  perform pg_temp.as_(14);
  perform pg_temp.ok(farm_nb_post_v1('hi') = 'out', 'only members write');
  perform pg_temp.ok((select count(*) from farm_nb_posts_v1()) = 0, 'and only members read');
  perform pg_temp.as_(12);
  for n in 2..30 loop perform farm_nb_post_v1('line ' || n); end loop;
  perform pg_temp.ok(farm_nb_post_v1('one too many') = 'limit', '30 lines a day');
end $$;

-- ---------- the Cup ----------
do $$ declare r json; t1 text; t2 text; t3 text; t4 text; kinds text[]; begin
  perform pg_temp.as_(12);
  select array_agg(t ->> 'kind') into kinds from json_array_elements(farm_nb_v1() -> 'tasks') t;
  t1 := kinds[1]; t2 := kinds[2]; t3 := kinds[3]; t4 := kinds[4];
  perform pg_temp.ok(farm_cup_pick_v1('dance') ->> 'code' = 'bad', 'only this week''s tasks');
  perform pg_temp.ok(farm_cup_done_v1() ->> 'code' = 'none', 'nothing to turn in');
  r := farm_cup_pick_v1(t1);
  perform pg_temp.ok((r ->> 'ok')::boolean and (r ->> 'goal')::int > 0, 'picked a task');
  perform pg_temp.ok(farm_cup_pick_v1(t2) ->> 'code' = 'busy', 'one at a time');
  perform pg_temp.ok(farm_nb_v1() -> 'pick' ->> 'kind' = t1, 'the panel shows it');
  r := farm_cup_done_v1();
  perform pg_temp.ok(r ->> 'code' = 'soon' and (r ->> 'wait')::int > 0, 'not done the moment it is picked: the server''s clock');
  perform pg_temp.later();
  r := farm_cup_done_v1();
  perform pg_temp.ok((r ->> 'ok')::boolean and (r ->> 'score')::int = (r ->> 'points')::int and (r ->> 'place')::int = 1, 'done: the points go to the barangay');
  perform pg_temp.ok(farm_cup_pick_v1(t1) ->> 'code' = 'done', 'each task once a week');
  perform farm_cup_pick_v1(t2); perform pg_temp.later(); perform farm_cup_done_v1();
  perform farm_cup_pick_v1(t3); perform pg_temp.later(); perform farm_cup_done_v1();
  perform pg_temp.ok(farm_cup_pick_v1(t4) ->> 'code' = 'day', '3 a day');
  perform pg_temp.ok((select points from farm_nb_members_v1() where me) > 0 and (select tasks from farm_nb_members_v1() where me) = 3, 'members: what each did');
  perform pg_temp.ok((select count(*) from farm_nb_posts_v1() where kind = 'task') = 3, 'the board says so');
end $$;
set role postgres;
do $$ begin update farm.cup_done set day = day - 1 where user_id = pg_temp.id(12); raise notice 'ok: (those 3 moved to yesterday)'; end $$;
set role authenticated;
do $$ declare kinds text[]; i int; begin
  perform pg_temp.as_(12);
  select array_agg(t ->> 'kind') into kinds from json_array_elements(farm_nb_v1() -> 'tasks') t;
  for i in 4..6 loop perform farm_cup_pick_v1(kinds[i]); perform pg_temp.later(); perform pg_temp.ok((farm_cup_done_v1() ->> 'ok')::boolean, 'task ' || i || ' the next day'); end loop;
  perform pg_temp.ok(farm_cup_pick_v1(kinds[7]) ->> 'code' = 'week', '6 a week');
  perform pg_temp.ok((farm_nb_v1() ->> 'done_week')::int = 6, 'the panel counts them');
  -- a task picked, then leaving: it goes
  perform pg_temp.as_(10); perform farm_cup_pick_v1(kinds[1]);
  perform pg_temp.ok(farm_cup_drop_v1() = 'ok', 'a task can be dropped');
  perform pg_temp.ok((farm_cup_pick_v1(kinds[1]) ->> 'ok')::boolean, 'and picked again');
end $$;

-- ---------- leagues ----------
-- Ana's barangay (2 members) is in the small league. A 6-member one goes in the middle league; 10 small ones fill a group.
do $$ declare n int; hid bigint; kinds text[]; r json; begin
  perform pg_temp.as_(14); perform farm_nb_create_v1('Gitna', 'star', true);
  hid := (farm_nb_v1() -> 'hood' ->> 'id')::bigint;
  for n in 15..19 loop perform pg_temp.as_(n); perform farm_nb_join_v1(hid, null); end loop;
  perform pg_temp.as_(14);
  select array_agg(t ->> 'kind') into kinds from json_array_elements(farm_nb_v1() -> 'tasks') t;
  perform farm_cup_pick_v1(kinds[1]); perform pg_temp.later(); perform farm_cup_done_v1();
  r := farm_nb_v1() -> 'cup';
  perform pg_temp.ok(r ->> 'league' = 'm' and json_array_length(r -> 'group') = 1, '6 members: the middle league, a group of its own');
  for n in 20..30 loop
    perform pg_temp.as_(n); perform farm_nb_create_v1('Small ' || n, 'heart', true);
    perform farm_cup_pick_v1(kinds[1]); perform pg_temp.later(); perform farm_cup_done_v1();
  end loop;
  perform pg_temp.as_(12);
  r := farm_nb_v1() -> 'cup';
  perform pg_temp.ok(r ->> 'league' = 's' and json_array_length(r -> 'group') = 10, 'small ones: 10 in a group');
  perform pg_temp.ok((r ->> 'place')::int = 1 and ((r -> 'group' -> 0) ->> 'me')::boolean, 'Mabuhay leads its group');
  perform pg_temp.as_(30);
  perform pg_temp.ok(json_array_length(farm_nb_v1() -> 'cup' -> 'group') = 2, 'the 11th starts the next group');
  perform pg_temp.as_(28);
  perform pg_temp.ok((farm_nb_v1() -> 'cup' ->> 'place')::int = 10, 'a tie goes to who got there first: the 10th to get there');
  perform pg_temp.as_(29);
  perform pg_temp.ok((farm_nb_v1() -> 'cup' ->> 'place')::int = 1, 'first of the next group');
end $$;

-- ---------- the leader goes ----------
do $$ declare hid bigint; begin
  perform pg_temp.as_(14); hid := (farm_nb_v1() -> 'hood' ->> 'id')::bigint;
  perform pg_temp.as_(15); perform pg_temp.ok(farm_nb_set_v1(false) = 'leader', 'only the leader opens or closes it');
  perform pg_temp.ok(farm_nb_kick_v1(pg_temp.id(16)) = 'leader', 'or takes a member out');
  perform pg_temp.as_(14);
  perform pg_temp.ok(farm_nb_kick_v1(pg_temp.id(19)) = 'ok', 'the leader takes a member out');
  perform pg_temp.as_(19); perform pg_temp.ok(farm_nb_v1() -> 'hood' is null or json_typeof(farm_nb_v1() -> 'hood') = 'null', 'they are out');
  perform pg_temp.as_(14); perform farm_nb_leave_v1();
  perform pg_temp.as_(15);
  perform pg_temp.ok((farm_nb_v1() -> 'hood' ->> 'leader')::boolean, 'the longest member leads now');
  perform farm_publish_v1('{}'::jsonb, 1, 1, 0, 0); perform farm_leave_v1(); -- (leaves online play altogether: its farm goes)
  perform pg_temp.as_(16);
  perform pg_temp.ok((farm_nb_v1() -> 'hood' ->> 'leader')::boolean, 'and the next, when the leader leaves online play');
  perform farm_nb_leave_v1();
  perform pg_temp.as_(17); perform farm_nb_leave_v1();
  perform pg_temp.as_(18); perform farm_nb_leave_v1();
  perform pg_temp.ok((select count(*) from farm_nb_find_v1('gitna')) = 0, 'the last one out: it is gone');
end $$;
set role postgres;
do $$ begin
  perform pg_temp.ok(not exists (select 1 from farm.hoods where name = 'Gitna'), '(gone from the table, its name free)');
  perform pg_temp.ok(exists (select 1 from farm.cup_hoods where name = 'Gitna'), '(its week in the Cup stays)');
end $$;
set role authenticated;

-- ---------- prizes ----------
-- Push Ana's group past 400 points: 12 (6 tasks) is in; Ana did 1. Then the week ends.
set role postgres;
do $$ begin
  update farm.cup_hoods set score = greatest(score, 450) where name = 'Barangay Mabuhay'; -- (past 400 points: a place prize)
  update farm.cup_done set week = week - 7; update farm.cup_hoods set week = week - 7; delete from farm.cup_picks;
  raise notice 'ok: (the week is over)';
end $$;
set role authenticated;
do $$ declare r json; begin
  perform pg_temp.as_(12);
  r := farm_nb_v1();
  perform pg_temp.ok(r -> 'cup' is null or json_typeof(r -> 'cup') = 'null', 'a new week: a new Cup');
  r := farm_cup_claim_v1();
  perform pg_temp.ok(json_array_length(r) = 1 and (r -> 0 ->> 'place')::int = 1 and r -> 0 ->> 'name' = 'Barangay Mabuhay', 'the prize for last week: 1st');
  perform pg_temp.ok((r -> 0 ->> 'gold')::int = 3000 and (r -> 0 ->> 'stars')::int = 3, '1st with 400 points or more: 3,000G + 3 Sunbeams');
  perform pg_temp.ok(json_array_length(farm_cup_claim_v1()) = 0, 'claimed once');
  perform pg_temp.as_(10);
  perform pg_temp.ok(json_array_length(farm_cup_claim_v1()) = 0, 'a member who did nothing gets nothing');
  perform pg_temp.as_(28);
  r := farm_cup_claim_v1();
  perform pg_temp.ok((r -> 0 ->> 'place')::int = 10 and (r -> 0 ->> 'gold')::int = 500 and (r -> 0 ->> 'stars')::int = 0, '10th: 500G for taking part');
  perform pg_temp.as_(29);
  r := farm_cup_claim_v1();
  perform pg_temp.ok((r -> 0 ->> 'place')::int = 1 and (r -> 0 ->> 'gold')::int = 500, '1st with under 400 points: 500G');
  perform pg_temp.as_(13); perform farm_nb_create_v1('Guest Grove', 'cow', true);
end $$;
set role postgres;
do $$ begin
  insert into farm.cup_done (user_id, week, kind, hood_id, points, day)
    select pg_temp.id(13), farm.nb_week(now()) - 7, 'fish', h.id, 100, current_date - 7 from farm.hoods h where h.name = 'Guest Grove';
  insert into farm.cup_hoods (week, hood_id, name, badge, league, grp, score)
    select farm.nb_week(now()) - 7, h.id, h.name, h.badge, 's', 5, 100 from farm.hoods h where h.name = 'Guest Grove';
  raise notice 'ok: (a guest took part last week)';
end $$;
set role authenticated;
do $$ begin
  perform pg_temp.as_(13);
  perform pg_temp.ok(json_array_length(farm_cup_claim_v1()) = 0, 'a guest wins no prizes');
end $$;
set role postgres;
do $$ begin
  perform pg_temp.ok(farm.nb_prize(2, 400) = row(2000, 2), '2nd: 2,000G + 2');
  perform pg_temp.ok(farm.nb_prize(3, 999) = row(1200, 1), '3rd: 1,200G + 1');
  perform pg_temp.ok(farm.nb_prize(1, 399) = row(500, 0), 'a place needs 400 points');
  perform pg_temp.ok(farm.nb_week(timestamptz '2026-11-08 15:59:00+00') = date '2026-11-02' and farm.nb_week(timestamptz '2026-11-08 16:00:00+00') = date '2026-11-09',
    'weeks end Sunday midnight in the Philippines');
end $$;

-- ---------- part 17: the Market board ----------
set role authenticated;
do $$ declare r json; begin
  perform pg_temp.as_(10);
  perform pg_temp.ok(farm_market_ad_v1() ->> 'code' = 'empty', 'nothing for sale: nothing to show');
  perform farm_market_list_v1('turnip', 10, 300);
  perform farm_market_list_v1('egg', 5, 150);
  perform farm_market_list_v1('milk', 2, 400);
  perform farm_market_list_v1('corn', 1, 60);
  r := farm_market_ad_v1();
  perform pg_temp.ok((r ->> 'ok')::boolean and (r ->> 'until_s')::int = 4 * 3600, 'on the board for 4 hours');
  r := farm_market_ad_v1();
  perform pg_temp.ok(r ->> 'code' = 'used' and (r ->> 'until_s')::int > 0 and (r ->> 'next_s')::int > 0, 'once a day');
  perform pg_temp.ok((farm_market_ads_v1() -> 'mine' ->> 'on')::boolean and json_array_length(farm_market_ads_v1() -> 'ads') = 0, 'my own is not on my board, but I know it is up');
  perform pg_temp.as_(11);
  r := farm_market_ads_v1();
  perform pg_temp.ok(json_array_length(r -> 'ads') = 1 and (r -> 'ads' -> 0 ->> 'lots')::int = 4, 'others see it, with how many lots');
  perform pg_temp.ok(json_array_length(r -> 'ads' -> 0 -> 'items') = 3 and r -> 'ads' -> 0 -> 'items' -> 0 ->> 'item' = 'turnip', 'the 3 cheapest (each), cheapest first');
  perform pg_temp.ok(not (r -> 'mine' ->> 'used')::boolean, 'theirs is not used');
  -- a blocked farm, or one hidden from the lists, is not on the board (a friend still sees a hidden one)
  perform pg_temp.as_(10); perform farm_block_v1(pg_temp.id(11), true);
  perform pg_temp.as_(11); perform pg_temp.ok(json_array_length(farm_market_ads_v1() -> 'ads') = 0, 'not for a blocked player');
  perform pg_temp.as_(10); perform farm_block_v1(pg_temp.id(11), false); perform farm_set_listed_v1(false);
  perform pg_temp.as_(11); perform pg_temp.ok(json_array_length(farm_market_ads_v1() -> 'ads') = 0, 'a hidden farm is not on the board');
  perform pg_temp.as_(10); perform farm_set_listed_v1(true);
end $$;
set role postgres;
do $$ begin
  update farm.market set buyer = pg_temp.id(12), sold_at = now() where seller = pg_temp.id(10);
  raise notice 'ok: (everything at the stall sold)';
end $$;
set role authenticated;
do $$ begin
  perform pg_temp.as_(11);
  perform pg_temp.ok(json_array_length(farm_market_ads_v1() -> 'ads') = 0, 'a stall with nothing left is off the board');
end $$;
set role postgres;
do $$ begin
  update farm.market_ads set day = day - 1, until = now() - interval '1 minute';
  update farm.market set buyer = null, sold_at = null where seller = pg_temp.id(10);
  raise notice 'ok: (the next day)';
end $$;
set role authenticated;
do $$ begin
  perform pg_temp.as_(11);
  perform pg_temp.ok(json_array_length(farm_market_ads_v1() -> 'ads') = 0, 'yesterday''s ad has ended');
  perform pg_temp.as_(10);
  perform pg_temp.ok((farm_market_ad_v1() ->> 'ok')::boolean, 'a new day: a new free one');
end $$;

-- ---------- who can reach what ----------
set role anon;
do $$ begin
  begin perform farm_nb_v1(); raise exception 'FAILED: anon can call it'; exception when insufficient_privilege then raise notice 'ok: anon cannot call farm_nb_v1'; end;
  begin perform farm_market_ads_v1(); raise exception 'FAILED: anon can call it'; exception when insufficient_privilege then raise notice 'ok: anon cannot call farm_market_ads_v1'; end;
end $$;
set role authenticated;
do $$ begin
  begin perform 1 from farm.hoods; raise exception 'FAILED: readable'; exception when insufficient_privilege then raise notice 'ok: the tables are not readable directly'; end;
  begin perform 1 from farm.market_ads; raise exception 'FAILED: readable'; exception when insufficient_privilege then raise notice 'ok: nor the board'; end;
  begin perform farm.cup_place(current_date, 1); raise exception 'FAILED: helper callable'; exception when insufficient_privilege then raise notice 'ok: the helpers are not callable'; end;
end $$;
