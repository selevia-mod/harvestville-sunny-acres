-- Plays farm_online_22.sql (Town Rank and the Hall of Fame) as signed-in players on the local Postgres (test/sql/run.sh).
-- Its own players: 1 (Ana), 2 (Ben), 3 (Cara: blocks Ana), 4 (Dino: hidden after reports), 5 (Ella). Old months and
-- Derby rows are put in by hand as postgres.
\set ON_ERROR_STOP 1
set role postgres;
create function pg_temp.id(n int) returns uuid language sql as $$ select ('00000000-0000-4000-d000-' || lpad(n::text, 12, '0'))::uuid $$;
insert into auth.users select pg_temp.id(n) from generate_series(1, 5) n;
insert into farm.players (user_id, farm_name, friend_code)
  select pg_temp.id(n), (array['Ana', 'Ben', 'Cara', 'Dino', 'Ella'])[n], translate(lpad(n::text, 8, '0'), '0123456789', 'ABCDEFGHJK') from generate_series(1, 5) n;
update farm.players set hidden = true where user_id = pg_temp.id(4);
insert into farm.blocks (blocker, blocked) values (pg_temp.id(3), pg_temp.id(1));
-- last month: Ben was a Champion, Ella too (less); two months ago Ben again
insert into farm.rank_months (user_id, month, points, at) values
  (pg_temp.id(2), (farm.rank_month(now()) - interval '1 month')::date, 25000, now() - interval '20 days'),
  (pg_temp.id(5), (farm.rank_month(now()) - interval '1 month')::date, 21000, now() - interval '19 days'),
  (pg_temp.id(1), (farm.rank_month(now()) - interval '1 month')::date, 9000, now() - interval '19 days'),
  (pg_temp.id(2), (farm.rank_month(now()) - interval '2 months')::date, 30000, now() - interval '50 days');
-- the Derby's biggest (part 15), and Biggest catches by hand from older weeks
insert into farm.derby (user_id, monday, kind, g) values (pg_temp.id(1), '2026-10-26', 'fish_s', 450), (pg_temp.id(2), '2026-11-02', 'fish_s', 400),
  (pg_temp.id(4), '2026-11-02', 'fish_m', 1900);
insert into farm.catches (user_id, week, kind, kg10) values (pg_temp.id(2), '2026-10-19', 'wolf', 500), (pg_temp.id(4), '2026-10-19', 'deer', 800);
grant execute on function pg_temp.id(int) to authenticated;
create function pg_temp.months(n int) returns int language sql security definer as $$ select coalesce(sum(points), 0)::int from farm.rank_months where user_id = pg_temp.id(n) and month = farm.rank_month(now()) $$;
grant execute on function pg_temp.months(int) to authenticated;
set role authenticated;
create function pg_temp.as_(n int) returns void language sql as $$ select set_config('request.uid', case when n = 0 then '' else pg_temp.id(n)::text end, false) $$;
create function pg_temp.ok(c boolean, what text) returns void language plpgsql as $$ begin if not coalesce(c, false) then raise exception 'FAILED: %', what; end if; raise notice 'ok: %', what; end $$;

-- 1. points, capped per kind per day; an id counts once
do $$ declare r jsonb; a uuid := gen_random_uuid(); begin
  perform pg_temp.as_(1);
  r := farm_rank_add_v1('farm', 120, a);
  perform pg_temp.ok((r->>'ok')::boolean and (r->>'added')::int = 120 and (r->>'points')::int = 120 and (r->>'tier')::int = 0, 'farming points count');
  r := farm_rank_add_v1('farm', 120, a);
  perform pg_temp.ok((r->>'added')::int = 0 and (r->>'again')::boolean and (r->>'points')::int = 120, 'the same send again adds nothing');
  r := farm_rank_add_v1('farm', 500, gen_random_uuid());
  perform pg_temp.ok((r->>'added')::int = 180 and (r->>'points')::int = 300, 'only up to the daily cap (300 for farming)');
  perform pg_temp.ok((r->>'tier')::int = 1 and (r->>'rank')::int = 1, 'Bronze at 300, first in town');
  r := farm_rank_add_v1('farm', 5, gen_random_uuid());
  perform pg_temp.ok((r->>'added')::int = 0 and (r->>'points')::int = 300, 'the cap is full for today');
  r := farm_rank_add_v1('hunt', 40, gen_random_uuid());
  perform pg_temp.ok((r->>'added')::int = 40 and (r->>'points')::int = 340, 'another kind has its own cap');
  perform pg_temp.ok(farm_rank_add_v1('gold', 10, gen_random_uuid())->>'code' = 'bad-source', 'only the kinds there are');
  perform pg_temp.ok(farm_rank_add_v1('fish', 0, gen_random_uuid())->>'code' = 'bad', 'no zero');
  perform pg_temp.ok(farm_rank_add_v1('fish', -5, gen_random_uuid())->>'code' = 'bad', 'no taking away');
  perform pg_temp.ok(farm_rank_add_v1('fish', 3, null)->>'code' = 'bad', 'a send needs its id');
  perform pg_temp.ok(pg_temp.months(1) = 340, 'the month holds 340');
  perform pg_temp.ok((farm_rank_add_v1('help', 1, gen_random_uuid())->>'best')::int = 3, 'best ever: Gold, from last month');
  -- someone else's id: counts nothing for anyone
  perform pg_temp.as_(5);
  perform pg_temp.ok((farm_rank_add_v1('farm', 50, a)->>'added')::int = 0, 'an id already used by another adds nothing');
  perform pg_temp.ok((farm_rank_add_v1('farm', 50, gen_random_uuid())->>'added')::int = 50, 'Ella earns too');
end $$;

-- 2. the board: best first, ties to whoever got there first, hidden players and blocks left out
do $$ declare r jsonb; begin
  perform pg_temp.as_(2); perform farm_rank_add_v1('goods', 150, gen_random_uuid()); perform farm_rank_add_v1('fish', 150, gen_random_uuid());
  perform farm_rank_add_v1('help', 41, gen_random_uuid()); -- (Ben 341: past Ana's 341? Ana has 341 too: Ana first)
  perform pg_temp.as_(4); perform farm_rank_add_v1('farm', 300, gen_random_uuid()); perform farm_rank_add_v1('mine', 150, gen_random_uuid());
  perform pg_temp.as_(1);
  r := farm_rank_board_v1();
  perform pg_temp.ok(r->>'month' = to_char(now() at time zone 'Asia/Manila', 'YYYY-MM'), 'the month (Manila''s), as YYYY-MM');
  perform pg_temp.ok(jsonb_array_length(r->'top') = 3, 'three on the board (Dino is hidden): ' || (r->'top')::text);
  perform pg_temp.ok(r->'top'->0->>'name' = 'Ana' and r->'top'->1->>'name' = 'Ben' and r->'top'->2->>'name' = 'Ella', 'a tie goes to whoever got there first');
  perform pg_temp.ok((r->'top'->0->>'rank')::int = 1 and (r->'top'->2->>'points')::int = 50 and (r->'top'->0->>'tier')::int = 1, 'ranks, points, tiers');
  perform pg_temp.ok((r->'me'->>'rank')::int = 1 and (r->'me'->>'points')::int = 341, 'and my own month');
  perform pg_temp.as_(3);
  r := farm_rank_board_v1();
  perform pg_temp.ok(not exists (select 1 from jsonb_array_elements(r->'top') x where x->>'name' = 'Ana'), 'Cara blocked Ana: not on her board');
  perform pg_temp.ok((r->'me'->>'rank') is null and (r->'me'->>'points')::int = 0, 'no points: no rank yet');
  perform pg_temp.as_(4);
  perform pg_temp.ok((farm_rank_board_v1()->'me'->>'rank')::int = 1, 'a hidden player still sees their own month');
end $$;

-- 3. firsts: the first to claim wins, once; only keys on the list
do $$ declare r jsonb; begin
  perform pg_temp.as_(2);
  r := farm_hall_first_v1('bakunawa');
  perform pg_temp.ok((r->>'ok')::boolean and (r->>'first')::boolean and r->>'name' = 'Ben', 'Ben is the first to beat the Bakunawa');
  perform pg_temp.ok((farm_hall_first_v1('bakunawa')->>'first')::boolean, 'asking again says the same');
  perform pg_temp.as_(1);
  r := farm_hall_first_v1('bakunawa');
  perform pg_temp.ok((r->>'ok')::boolean and not (r->>'first')::boolean and (r->>'id')::uuid = pg_temp.id(2), 'Ana was too late: Ben has it');
  perform pg_temp.ok((farm_hall_first_v1('lair_10')->>'first')::boolean, 'Ana is first on floor 10');
  perform pg_temp.ok(farm_hall_first_v1('anything')->>'code' = 'bad-key', 'only firsts on the list');
  perform pg_temp.ok(farm_hall_first_v1(null)->>'code' = 'bad-key', 'not none');
  perform pg_temp.as_(3);
  perform pg_temp.ok(farm_hall_first_v1('lair_10')->>'name' is null, 'a blocked player''s name is not shown');
end $$;

-- 4. the Hall of Fame
do $$ declare r jsonb; begin
  perform pg_temp.as_(1); perform farm_catch_v1('wolf', 520); -- (this week, bigger than Ben's old one)
  perform pg_temp.as_(5); perform farm_catch_v1('rabbit', 25);
  perform pg_temp.as_(5);
  r := farm_hall_v1();
  perform pg_temp.ok((select x->>'name' from jsonb_array_elements(r->'catches') x where x->>'kind' = 'wolf') = 'Ana', 'the biggest wolf ever: Ana''s 52 kg');
  perform pg_temp.ok((select (x->>'kg10')::int from jsonb_array_elements(r->'catches') x where x->>'kind' = 'wolf') = 520, 'its weight');
  perform pg_temp.ok((select x->>'name' from jsonb_array_elements(r->'catches') x where x->>'kind' = 'rabbit') = 'Ella', 'the rabbit: Ella');
  perform pg_temp.ok(not exists (select 1 from jsonb_array_elements(r->'catches') x where x->>'kind' = 'deer'), 'a hidden player holds no record');
  perform pg_temp.ok((select x->>'name' from jsonb_array_elements(r->'fish') x where x->>'kind' = 'fish_s') = 'Ana' and
    (select (x->>'g')::int from jsonb_array_elements(r->'fish') x where x->>'kind' = 'fish_s') = 450, 'the Derby''s biggest Small Fish of any Monday');
  perform pg_temp.ok(not exists (select 1 from jsonb_array_elements(r->'fish') x where x->>'kind' = 'fish_m'), 'the hidden player''s fish is not a record');
  perform pg_temp.ok(jsonb_array_length(r->'firsts') = 2 and r->'firsts'->0->>'key' = 'bakunawa' and r->'firsts'->0->>'name' = 'Ben', 'the firsts, oldest first');
  perform pg_temp.ok(r->'champs'->>'month' = to_char(date_trunc('month', now() at time zone 'Asia/Manila') - interval '1 month', 'YYYY-MM'), 'champions of last month');
  perform pg_temp.ok(jsonb_array_length(r->'champs'->'last') = 2 and r->'champs'->'last'->0->>'name' = 'Ben' and r->'champs'->'last'->1->>'name' = 'Ella', 'Ben and Ella were Champions (Ana''s Gold was not)');
  perform pg_temp.ok(r->'champs'->'most'->0->>'name' = 'Ben' and (r->'champs'->'most'->0->>'months')::int = 2, 'most Champion months: Ben, 2');
  perform pg_temp.ok(jsonb_array_length(r->'top') = 3 and r->'top'->0->>'name' = 'Ana', 'this month''s top 10');
  perform pg_temp.ok(r->'more' = '[]'::jsonb, 'no extra plaques yet');
  perform pg_temp.as_(3);
  r := farm_hall_v1();
  perform pg_temp.ok((select x->>'name' from jsonb_array_elements(r->'catches') x where x->>'kind' = 'wolf') is null and
    (select x->>'id' from jsonb_array_elements(r->'catches') x where x->>'kind' = 'wolf')::uuid = pg_temp.id(1), 'blocked: the record stands, without the name');
end $$;

-- 5. who may call what
do $$ begin
  perform pg_temp.as_(0);
  begin perform farm_rank_board_v1(); perform pg_temp.ok(false, 'x'); exception when others then perform pg_temp.ok(sqlerrm = 'not signed in', 'signed in only'); end;
  begin perform farm.rank_me(pg_temp.id(1)); perform pg_temp.ok(false, 'x'); exception when insufficient_privilege then perform pg_temp.ok(true, 'the helpers are not for the game'); end;
  begin perform farm.hall_more(); perform pg_temp.ok(false, 'x'); exception when insufficient_privilege then perform pg_temp.ok(true, 'nor the Hall''s hook'); end;
  begin perform count(*) from farm.rank_months; perform pg_temp.ok(false, 'x'); exception when insufficient_privilege then perform pg_temp.ok(true, 'the tables are not readable'); end;
end $$;
set role anon;
do $$ begin
  begin perform farm_hall_v1(); raise exception 'FAILED: anon ran farm_hall_v1'; exception when insufficient_privilege then raise notice 'ok: not for anon'; end;
end $$;

-- 6. the Hall's hook: a later part's extra plaques show, and running part 22 again keeps them
set role postgres;
create or replace function farm.hall_more() returns jsonb language sql stable set search_path = '' as $$
  select jsonb_build_array(jsonb_build_object('key', 'bayanihan', 'title', 'Top givers', 'rows', jsonb_build_array(jsonb_build_object('id', null, 'name', 'Ella', 'text', '12 gifts')))) $$;
\ir ../../supabase/farm_online_22.sql
set role authenticated;
do $$ declare r jsonb; begin
  perform pg_temp.as_(1);
  r := farm_hall_v1();
  perform pg_temp.ok(r->'more'->0->>'key' = 'bayanihan' and r->'more'->0->'rows'->0->>'name' = 'Ella', 'part 22 run again keeps a later part''s plaques');
  perform pg_temp.ok((farm_rank_board_v1()->'me'->>'points')::int = 341, 'and every point');
end $$;
