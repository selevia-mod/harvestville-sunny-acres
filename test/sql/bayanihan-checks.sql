-- Plays farm_online_20.sql (Bayanihan Projects: the whole server builds the town together) as signed-in players on the
-- local Postgres (test/sql/run.sh). Its own players: 1 to 6 (made straight in farm.players; 1 and 2 in a barangay, 5 a
-- guest, 6 banned) and 7 (signed in, never joined online play). The projects' numbers are made small first, as postgres.
\set ON_ERROR_STOP 1
set role postgres;
create function pg_temp.id(n int) returns uuid language sql as $$ select ('00000000-0000-4000-b000-' || lpad(n::text, 12, '0'))::uuid $$;
insert into auth.users select pg_temp.id(n) from generate_series(1, 7) n;
insert into farm.players (user_id, farm_name, friend_code)
  select pg_temp.id(n), 'Bayani ' || n, translate(lpad((n + 500)::text, 8, '0'), '0123456789', 'PQRSTUVWXY') from generate_series(1, 6) n;
insert into public.profiles (auth_user_id, is_banned, is_guest) values (pg_temp.id(5), false, true), (pg_temp.id(6), true, false);
insert into farm.hoods (name, badge, open, code, leader, made_by) values ('Bayan Uno', 'carabao', true, 'BYNUNQ', pg_temp.id(1), pg_temp.id(1));
insert into farm.hood_members (user_id, hood_id) select pg_temp.id(n), h.id from generate_series(1, 2) n, farm.hoods h where h.name = 'Bayan Uno';
-- small numbers: the bridge needs 10 lumber (1 point each, 6 a day) and 4 copper (2 points, 3 a day); cap 12 points
update farm.bh_needs set goal = 10, day_max = 6 where project = 'bridge' and item = 'lumber';
update farm.bh_needs set goal = 4, day_max = 3 where project = 'bridge' and item = 'ore_copper';
delete from farm.bh_needs where project = 'bridge' and item not in ('lumber', 'ore_copper');
update farm.bh_projects set cap = 12, tier2 = 6, tier3 = 10 where key = 'bridge';
grant execute on function pg_temp.id(int) to authenticated;
create function pg_temp.next_day() returns void language sql security definer as $$ update farm.bh_gifts set day = day - 1 $$;
create function pg_temp.bh(p text) returns farm.bh_projects language sql security definer as $$ select * from farm.bh_projects where key = p $$;
grant execute on function pg_temp.next_day(), pg_temp.bh(text) to authenticated;
set role authenticated;
create function pg_temp.as_(n int) returns void language sql as $$ select set_config('request.uid', case when n = 0 then '' else pg_temp.id(n)::text end, false) $$;
create function pg_temp.ok(c boolean, what text) returns void language plpgsql as $$ begin if not coalesce(c, false) then raise exception 'FAILED: %', what; end if; raise notice 'ok: %', what; end $$;
create function pg_temp.rid(n int) returns uuid language sql as $$ select ('00000000-0000-4000-a000-' || lpad(n::text, 12, '0'))::uuid $$;

-- 1. the board: the first project, nothing given yet
do $$ declare r jsonb; begin
  perform pg_temp.as_(1); r := farm_project_state_v1();
  perform pg_temp.ok((r ->> 'ok')::boolean and r -> 'current' ->> 'key' = 'bridge', 'the Old Bridge is on first');
  perform pg_temp.ok(r -> 'current' -> 'needs' = '[{"pts": 1, "goal": 10, "have": 0, "item": "lumber", "today": 0, "day_max": 6}, {"pts": 2, "goal": 4, "have": 0, "item": "ore_copper", "today": 0, "day_max": 3}]', 'its needs, in order');
  perform pg_temp.ok(r -> 'current' -> 'hood' = '{"name": "Bayan Uno", "pts": 0}', 'my barangay, with no points yet');
  perform pg_temp.ok(r -> 'current' -> 'tiers' = '[1, 6, 10]' and r -> 'current' -> 'gold' = '[300, 1000, 2500]', 'the reward tiers, as the owner set them');
  perform pg_temp.ok(r -> 'done' = '[]' and (r ->> 'can_give')::boolean, 'nothing done; I may give');
  perform pg_temp.as_(3); perform pg_temp.ok(farm_project_state_v1() -> 'current' -> 'hood' = 'null', 'no barangay: no barangay row');
  perform pg_temp.as_(7); perform pg_temp.ok(farm_project_state_v1() = '{"ok": false, "code": "not-player"}', 'not a player');
end $$;

-- 2. giving: the caps, the receipt, the barangay
do $$ declare r jsonb; begin
  perform pg_temp.as_(1);
  r := farm_project_give_v1('lumber', 4, pg_temp.rid(1), 'bridge');
  perform pg_temp.ok(r = '{"n": 4, "ok": true, "done": false, "goal": 10, "have": 4, "item": "lumber", "mine": 4, "today": 4, "project": "bridge"}', 'a gift counts for the town');
  r := farm_project_give_v1('lumber', 4, pg_temp.rid(1), 'bridge');
  perform pg_temp.ok((r ->> 'again')::boolean and r ->> 'n' = '4' and r ->> 'have' = '4', 'the same request again: its first answer, counted once');
  r := farm_project_give_v1('lumber', 5, pg_temp.rid(2), 'bridge');
  perform pg_temp.ok(r ->> 'n' = '2' and r ->> 'today' = '6', 'the day allows 2 more lumber: 2 taken, not 5');
  perform pg_temp.ok(farm_project_give_v1('lumber', 1, pg_temp.rid(3)) ->> 'code' = 'day', 'then the day is full for lumber');
  perform pg_temp.ok(farm_project_give_v1('stone', 1, pg_temp.rid(4)) ->> 'code' = 'closed', 'a thing the project does not need');
  perform pg_temp.ok(farm_project_give_v1('lumber', 1, pg_temp.rid(5), 'market') = '{"ok": false, "code": "moved", "project": "bridge"}', 'a gift meant for another project');
  perform pg_temp.ok(farm_project_give_v1('lumber', 0, pg_temp.rid(6)) ->> 'code' = 'bad', 'none is no gift');
  perform pg_temp.ok(farm_project_give_v1('lumber', 1, null) ->> 'code' = 'request-required', 'a gift needs its request id');
  r := farm_project_give_v1('ore_copper', 3, pg_temp.rid(7));
  perform pg_temp.ok(r ->> 'n' = '3' and r ->> 'mine' = '12', 'copper: 2 points each, my 12');
  perform pg_temp.next_day();
  perform pg_temp.ok(farm_project_give_v1('lumber', 1, pg_temp.rid(8)) ->> 'code' = 'cap', 'the next day: my 12 points for this project are given');
  perform pg_temp.ok(farm_project_state_v1() -> 'current' -> 'hood' ->> 'pts' = '12', 'my barangay has my points');
  perform pg_temp.as_(5); perform pg_temp.ok(farm_project_give_v1('lumber', 1, pg_temp.rid(9)) ->> 'code' = 'guest', 'a guest cannot give');
  perform pg_temp.ok(not (farm_project_state_v1() ->> 'can_give')::boolean, 'and the board says so');
  perform pg_temp.as_(6);
  begin perform farm_project_give_v1('lumber', 1, pg_temp.rid(10)); perform pg_temp.ok(false, 'x');
  exception when others then perform pg_temp.ok(sqlerrm = 'account suspended', 'a banned account cannot give'); end;
  perform pg_temp.as_(0);
  begin perform farm_project_give_v1('lumber', 1, pg_temp.rid(11)); perform pg_temp.ok(false, 'x');
  exception when others then perform pg_temp.ok(sqlerrm = 'not signed in', 'not signed in: refused'); end;
end $$;

-- 3. the top givers, and the project done by its last gift
do $$ declare r jsonb; begin
  perform pg_temp.as_(2); perform farm_project_give_v1('lumber', 3, pg_temp.rid(1), 'bridge'); -- (another player's request ids are their own)
  perform pg_temp.as_(3); perform farm_project_give_v1('lumber', 1, pg_temp.rid(20));
  perform pg_temp.as_(3); r := farm_project_state_v1() -> 'current';
  perform pg_temp.ok(r -> 'top' = jsonb_build_array(jsonb_build_object('id', pg_temp.id(1), 'me', false, 'pts', 12, 'name', 'Bayani 1'),
    jsonb_build_object('id', pg_temp.id(2), 'me', false, 'pts', 3, 'name', 'Bayani 2'), jsonb_build_object('id', pg_temp.id(3), 'me', true, 'pts', 1, 'name', 'Bayani 3')), 'the top givers');
  perform pg_temp.ok(r ->> 'givers' = '3' and r -> 'needs' -> 0 ->> 'have' = '10', 'lumber is all in (4 + 2 + 3 + 1)');
  perform pg_temp.ok(farm_project_give_v1('lumber', 1, pg_temp.rid(21)) ->> 'code' = 'met', 'a full need takes no more');
  perform pg_temp.as_(1); perform pg_temp.ok(farm_project_state_v1() -> 'current' -> 'hood' ->> 'pts' = '15', 'two members count for the barangay');
  perform pg_temp.as_(4); r := farm_project_give_v1('ore_copper', 5, pg_temp.rid(30), 'bridge');
  perform pg_temp.ok(r ->> 'n' = '1' and (r ->> 'done')::boolean, 'the last copper: the Old Bridge is done');
  r := farm_project_state_v1();
  perform pg_temp.ok(r -> 'current' ->> 'key' = 'market', 'the Market Hall is on now');
  perform pg_temp.ok(r -> 'done' -> 0 ->> 'key' = 'bridge' and r -> 'done' -> 0 ->> 'tier' = '1' and r -> 'done' -> 0 ->> 'mine' = '2', 'the bridge is done; my 2 points: Helper');
  perform pg_temp.ok((pg_temp.bh('market')).started_at is not null, 'and the market started');
  perform pg_temp.ok((farm_project_give_v1('ore_copper', 5, pg_temp.rid(30), 'bridge') ->> 'done')::boolean, 'a retry of the last gift still says done');
end $$;

-- 4. rewards: by tier, once
do $$ declare r jsonb; begin
  perform pg_temp.as_(1); r := farm_project_claim_v1('bridge');
  perform pg_temp.ok(r = '{"ok": true, "gold": 2500, "tier": 3, "project": "bridge"}', '12 points: Hero, 2,500G');
  r := farm_project_claim_v1('bridge');
  perform pg_temp.ok((r ->> 'again')::boolean and r ->> 'gold' = '2500', 'a second claim: the first one''s answer, marked again');
  perform pg_temp.ok((farm_project_state_v1() -> 'done' -> 0 ->> 'claimed')::boolean, 'the board says claimed');
  perform pg_temp.as_(2); perform pg_temp.ok(farm_project_claim_v1('bridge') ->> 'gold' = '300', '3 points: Helper, 300G');
  perform pg_temp.as_(5); perform pg_temp.ok(farm_project_claim_v1('bridge') ->> 'code' = 'guest', 'a guest claims nothing');
  perform pg_temp.as_(7); perform pg_temp.ok(farm_project_claim_v1('bridge') ->> 'code' = 'not-player', 'not a player');
  perform pg_temp.as_(3); perform pg_temp.ok(farm_project_claim_v1('market') ->> 'code' = 'not-done', 'the market is not done');
  perform pg_temp.ok(farm_project_claim_v1('castle') ->> 'code' = 'bad', 'no such project');
end $$;
set role postgres;
insert into farm.players (user_id, farm_name, friend_code) values (pg_temp.id(7), 'Late', 'ZZZZZZZZ');
set role authenticated;
do $$ begin
  perform pg_temp.as_(7); perform pg_temp.ok(farm_project_claim_v1('bridge') ->> 'code' = 'none', 'gave nothing: no reward');
end $$;

-- 5. who may call what
set role postgres;
do $$ declare f text; begin
  foreach f in array array['farm_project_state_v1()', 'farm_project_give_v1(text, int, uuid, text)', 'farm_project_claim_v1(text)'] loop
    perform pg_temp.ok(not has_function_privilege('anon', 'public.' || f, 'execute') and has_function_privilege('authenticated', 'public.' || f, 'execute'), f || ': players only');
  end loop;
  perform pg_temp.ok(not has_function_privilege('authenticated', 'farm.bh_today(uuid, text, text)', 'execute'), 'the helpers stay on the server');
  foreach f in array array['bh_projects', 'bh_needs', 'bh_gifts', 'bh_givers', 'bh_hoods', 'bh_claims'] loop
    perform pg_temp.ok(not has_table_privilege('authenticated', 'farm.' || f, 'select') and not has_table_privilege('anon', 'farm.' || f, 'select'), 'farm.' || f || ' stays on the server');
  end loop;
  perform pg_temp.ok((select count(*) from farm.bh_projects) = 5 and (select count(*) from farm.bh_needs where project <> 'bridge') = 20, 'five projects, run twice: no doubles');
end $$;
