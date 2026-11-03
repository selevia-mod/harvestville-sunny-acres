-- Plays farm_online_15.sql (the Fishing Derby) as signed-in players on the local Postgres (test/sql/run.sh). Uses
-- hunt-checks.sql's players 6, 7 and 8 (8 blocked 6). Whether it is Monday is set here (farm.derby_open).
\set ON_ERROR_STOP 1
set role postgres;
create or replace function farm.derby_open() returns boolean language sql stable set search_path = '' as $$ select false $$;
set role authenticated;
create function pg_temp.as_(n int) returns void language sql as $$ select set_config('request.uid', '00000000-0000-4000-9000-00000000000' || n, false) $$;
create function pg_temp.id(n int) returns uuid language sql as $$ select ('00000000-0000-4000-9000-00000000000' || n)::uuid $$;
create function pg_temp.ok(c boolean, what text) returns void language plpgsql as $$ begin if not coalesce(c, false) then raise exception 'FAILED: %', what; end if; raise notice 'ok: %', what; end $$;
do $$ begin
  perform pg_temp.as_(6);
  perform pg_temp.ok(farm_derby_v1('fish_l', 3600) ->> 'code' = 'not-monday', 'not on other days');
end $$;
set role postgres;
create or replace function farm.derby_open() returns boolean language sql stable set search_path = '' as $$ select true $$;
set role authenticated;
do $$ declare r jsonb; begin
  perform pg_temp.as_(6);
  r := farm_derby_v1('fish_l', 3600);
  perform pg_temp.ok((r ->> 'ok')::boolean and (r ->> 'best')::int = 3600 and (r ->> 'rank')::int = 1, 'a 3.6 kg Large Fish: first');
  perform pg_temp.ok((farm_derby_v1('fish_l', 3000) ->> 'best')::int = 3600, 'a smaller one keeps the biggest');
  perform pg_temp.ok(farm_derby_v1('fish_l', 5700) ->> 'code' = 'bad-weight', 'no Large Fish weighs 5.7 kg');
  perform pg_temp.ok(farm_derby_v1('fish_l', 2700) ->> 'code' = 'bad-weight', 'or 2.7 kg');
  perform pg_temp.ok(farm_derby_v1('shark', 100) ->> 'code' = 'bad-kind', 'only the game''s fish');
  perform pg_temp.ok((farm_derby_v1('fish_k', 19000) ->> 'ok')::boolean, 'a giant King Trout');
  perform pg_temp.as_(7); r := farm_derby_v1('fish_l', 5500);
  perform pg_temp.ok((r ->> 'rank')::int = 1, 'a giant takes first place');
  perform pg_temp.as_(8); perform farm_derby_v1('fish_l', 4000);
  perform pg_temp.as_(6);
  perform pg_temp.ok((select string_agg(rank || ':' || g, ',' order by rank) from farm_derby_board_v1('fish_l')) = '1:5500,3:3600', 'the board: biggest first, the blocked player left out');
  perform pg_temp.ok((select me from farm_derby_board_v1('fish_l') where g = 3600), 'your own row says so');
  perform pg_temp.ok((select count(*) from farm_derby_board_v1('fish_s')) = 0, 'a fish nobody caught: empty');
end $$;
set role postgres;
do $$ begin
  update farm.derby set monday = monday - 7 where user_id = '00000000-0000-4000-9000-000000000007';
  raise notice 'ok: (one catch moved to last week''s Derby)';
end $$;
set role authenticated;
do $$ begin
  perform pg_temp.as_(6);
  perform pg_temp.ok((select string_agg(rank || ':' || g, ',' order by rank) from farm_derby_board_v1('fish_l')) = '2:3600', 'last week''s Derby is not on this week''s board');
end $$;
set role postgres;
do $$ declare m date := farm.derby_monday(); begin
  if extract(isodow from m) <> 1 or m > (now() at time zone 'Asia/Manila')::date or m <= (now() at time zone 'Asia/Manila')::date - 7 then raise exception 'FAILED: derby_monday is this week''s Monday'; end if;
  raise notice 'ok: derby_monday is this week''s Monday in Manila (%)', m;
end $$;
set role anon;
do $$ begin
  begin perform farm_derby_board_v1('fish_l'); raise exception 'FAILED: anon can call it'; exception when insufficient_privilege then raise notice 'ok: anon cannot call it'; end;
end $$;
set role authenticated;
do $$ begin
  begin perform 1 from farm.derby; raise exception 'FAILED: the table is readable'; exception when insufficient_privilege then raise notice 'ok: the tables are not readable directly'; end;
end $$;
