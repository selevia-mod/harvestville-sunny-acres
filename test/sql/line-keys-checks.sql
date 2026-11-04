-- Plays farm_online_18.sql (signed live messages: each pair's key) on the local Postgres (test/sql/run.sh). Uses
-- hunt-checks.sql's players 6, 7 and 8 (8 blocked 6; 6's farm is listed).
\set ON_ERROR_STOP 1
set role authenticated;
create function pg_temp.as_(n int) returns void language sql as $$ select set_config('request.uid', case when n = 0 then '' else '00000000-0000-4000-9000-00000000000' || n end, false) $$;
create function pg_temp.id(n int) returns uuid language sql as $$ select ('00000000-0000-4000-9000-00000000000' || n)::uuid $$;
create function pg_temp.ok(c boolean, what text) returns void language plpgsql as $$ begin if not coalesce(c, false) then raise exception 'FAILED: %', what; end if; raise notice 'ok: %', what; end $$;
do $$ declare t text := 'farm:' || pg_temp.id(6); k7 jsonb; k6 jsonb; k8 jsonb; begin
  perform pg_temp.as_(7); k7 := farm_line_keys_v1(t, array[pg_temp.id(6), pg_temp.id(8), pg_temp.id(7)]);
  perform pg_temp.ok(k7 ->> pg_temp.id(6)::text ~ '^[0-9a-f]{64}$' and k7 ->> pg_temp.id(8)::text ~ '^[0-9a-f]{64}$', 'a key with each player named');
  perform pg_temp.ok(not k7 ? pg_temp.id(7)::text, 'none with yourself');
  perform pg_temp.ok(k7 ->> pg_temp.id(6)::text <> k7 ->> pg_temp.id(8)::text, 'a different key with each');
  perform pg_temp.as_(6); k6 := farm_line_keys_v1(t, array[pg_temp.id(7), pg_temp.id(8)]);
  perform pg_temp.ok(k6 ->> pg_temp.id(7)::text = k7 ->> pg_temp.id(6)::text, 'the two of a pair get the same key');
  perform pg_temp.ok(not k6 ? pg_temp.id(8)::text, 'no key between players who blocked each other');
  perform pg_temp.as_(8);
  perform pg_temp.ok(farm_line_keys_v1(t, array[pg_temp.id(7)]) is null, 'a player who blocked the farmer gets nothing on that farm');
  k8 := farm_line_keys_v1('farm:' || pg_temp.id(8), array[pg_temp.id(7)]);
  perform pg_temp.as_(7);
  perform pg_temp.ok(farm_line_keys_v1('farm:' || pg_temp.id(8), array[pg_temp.id(8)]) ->> pg_temp.id(8)::text = k8 ->> pg_temp.id(7)::text, 'on another farm the pair share a key too');
  perform pg_temp.ok(k8 ->> pg_temp.id(7)::text <> k7 ->> pg_temp.id(8)::text, 'another farm, another key');
  perform pg_temp.as_(7);
  perform pg_temp.ok(farm_line_keys_v1(t, (select array_agg(gen_random_uuid()) from generate_series(1, 41))) is null, 'at most 40 at a time');
  perform pg_temp.ok(farm_line_keys_v1('chat:everyone', array[pg_temp.id(6)]) is null, 'only farm channels');
  perform pg_temp.ok(farm_line_keys_v1(t, null) is null, 'a list is needed');
  perform pg_temp.as_(9); perform pg_temp.ok(farm_line_keys_v1(t, array[pg_temp.id(6)]) is null, 'not a player: nothing');
  perform pg_temp.as_(0); perform pg_temp.ok(farm_line_keys_v1(t, array[pg_temp.id(6)]) is null, 'not signed in: nothing');
end $$;
set role postgres;
do $$ begin
  perform pg_temp.ok(not has_function_privilege('anon', 'public.farm_line_keys_v1(text, uuid[])', 'execute'), 'not for anon');
  perform pg_temp.ok(has_function_privilege('authenticated', 'public.farm_line_keys_v1(text, uuid[])', 'execute'), 'for signed-in players');
  perform pg_temp.ok(not has_table_privilege('authenticated', 'farm.line_secret', 'select'), 'the secret stays on the server');
  perform pg_temp.ok((select count(*) from farm.line_secret) = 1, 'one secret, after running the part twice');
end $$;
