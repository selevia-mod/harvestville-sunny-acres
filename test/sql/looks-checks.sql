-- Plays farm_online_13.sql (looks at the Tailor Shop) as signed-in players on the local Postgres (test/sql/run.sh).
\set ON_ERROR_STOP 1
set role postgres;
insert into public.wallets (user_id, coin_balance, star_balance) select id, 300, 150 from public.profiles where auth_user_id = '00000000-0000-4000-8000-000000000005'
  on conflict (user_id) do update set coin_balance = 300, star_balance = 150;
set role authenticated;
create function pg_temp.as_(n int) returns void language sql as $$ select set_config('request.uid', '00000000-0000-4000-8000-00000000000' || n, false) $$;
create function pg_temp.ok(c boolean, what text) returns void language plpgsql as $$ begin if not coalesce(c, false) then raise exception 'FAILED: %', what; end if; raise notice 'ok: %', what; end $$;
do $$ declare r jsonb; s jsonb; rid uuid := gen_random_uuid(); begin
  perform pg_temp.as_(5);
  s := farm_looks_v1();
  perform pg_temp.ok(jsonb_array_length(s -> 'offers') = 7, 'seven prices: Spring 2, Santa 1, Fiesta 2, Bunny 2');
  perform pg_temp.ok((s -> 'owned') = '[]'::jsonb, 'nothing owned yet');
  perform pg_temp.ok((s -> 'wallet' ->> 'coins')::int = 300, 'the wallet');
  r := farm_look_buy_v1('santa', 'stars', 150, 1, gen_random_uuid());
  perform pg_temp.ok(r ->> 'code' = 'offer-unavailable', 'Santa is Coins only');
  r := farm_look_buy_v1('santa', 'coins', 100, 1, gen_random_uuid());
  perform pg_temp.ok(r ->> 'code' = 'offer-changed', 'a price the shop no longer shows is refused');
  r := farm_look_buy_v1('santa', 'coins', 150, 1, rid);
  perform pg_temp.ok((r ->> 'ok')::boolean and (r ->> 'balance')::int = 150, 'Santa for 150 Coins');
  r := farm_look_buy_v1('santa', 'coins', 150, 1, rid);
  perform pg_temp.ok((r ->> 'duplicate')::boolean, 'the same tap again: its receipt, no second payment');
  r := farm_look_buy_v1('santa', 'coins', 150, 1, gen_random_uuid());
  perform pg_temp.ok(r ->> 'code' = 'owned', 'never twice');
  perform pg_temp.ok((farm_looks_v1() -> 'wallet' ->> 'coins')::int = 150, 'paid once');
  r := farm_look_buy_v1('bunny', 'stars', 200, 1, gen_random_uuid());
  perform pg_temp.ok(r ->> 'code' = 'insufficient-stars', 'not enough Stars: nothing taken');
  r := farm_look_buy_v1('flower', 'stars', 150, 1, gen_random_uuid());
  perform pg_temp.ok((r ->> 'ok')::boolean and (r ->> 'balance')::int = 0, 'Spring Festival for 150 Stars');
  perform pg_temp.ok((farm_looks_v1() -> 'owned') = '["santa", "flower"]'::jsonb, 'owned: Santa and Spring Festival');
  r := farm_look_buy_v1('straw', 'coins', 1, 1, gen_random_uuid());
  perform pg_temp.ok(r ->> 'code' = 'offer-unavailable', 'a Gold look is not sold here');
  perform pg_temp.as_(4);
  r := farm_look_buy_v1('fiesta', 'coins', 150, 1, gen_random_uuid());
  perform pg_temp.ok(r ->> 'code' = 'account-unavailable', 'a banned account cannot shop');
end $$;
set role postgres;
do $$ begin
  if (select count(*) from public.coin_transactions where type = 'farm_look') <> 1 or (select count(*) from public.star_transactions where type = 'farm_look') <> 1 then
    raise exception 'FAILED: one ledger row per purchase';
  end if;
  raise notice 'ok: one ledger row per purchase';
end $$;
set role anon;
do $$ begin
  begin perform farm_looks_v1(); raise exception 'FAILED: anon can call farm_looks_v1'; exception when insufficient_privilege then raise notice 'ok: anon cannot call it'; end;
end $$;
set role authenticated;
do $$ begin
  begin perform 1 from farm.looks_owned; raise exception 'FAILED: the table is readable'; exception when insufficient_privilege then raise notice 'ok: the tables are not readable directly'; end;
end $$;
