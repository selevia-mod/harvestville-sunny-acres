-- Part 24: energy refills in bulk (farm_buy_many_v1), played on the local Postgres (test/sql/run.sh).
\set ON_ERROR_STOP 1
set role authenticated;
create function pg_temp.as_(n int) returns void language sql as $$ select set_config('request.uid', '00000000-0000-4000-8000-00000000000' || n, false) $$;
create function pg_temp.ok(c boolean, what text) returns void language plpgsql as $$ begin if not coalesce(c, false) then raise exception 'FAILED: %', what; end if; raise notice 'ok: %', what; end $$;
reset role;
update public.wallets set coin_balance = 100, star_balance = 0 where user_id = (select id from public.profiles where auth_user_id = '00000000-0000-4000-8000-000000000005');
insert into public.wallets (user_id, coin_balance, star_balance) select id, 100, 0 from public.profiles where auth_user_id = '00000000-0000-4000-8000-000000000005' on conflict do nothing;
set role authenticated;
do $$ declare r jsonb; rid uuid := gen_random_uuid(); before int; coins int; begin
  perform pg_temp.as_(5);
  perform pg_temp.ok((farm_shop_v1() ->> 'bulk')::boolean, 'the shop says bulk refills are on');
  before := (farm_shop_v1() ->> 'left')::int;
  r := farm_buy_many_v1('energy', 'coins', 5, 1, rid, 10);
  perform pg_temp.ok(r ->> 'ok' = 'true' and (r ->> 'amount')::int = 1000 and (r ->> 'price')::int = 50 and (r ->> 'qty')::int = 10, 'ten refills: +1000 energy for 50 Coins, in one payment (' || r::text || ')');
  perform pg_temp.ok((r ->> 'balance')::int = 50, 'the wallet lost exactly 50');
  r := farm_buy_many_v1('energy', 'coins', 5, 1, rid, 10);
  perform pg_temp.ok(r ->> 'duplicate' = 'true' and (r ->> 'amount')::int = 1000, 'the same tap again: its receipt, not a second payment');
  perform pg_temp.ok((farm_shop_v1() ->> 'left')::int = before - 10, 'the day''s limit counts ten refills');
  perform pg_temp.ok((farm_shop_v1() -> 'wallet' ->> 'coins')::int = 50, 'still 50 Coins');
  perform pg_temp.ok(farm_buy_many_v1('energy', 'coins', 5, 1, gen_random_uuid(), 101) ->> 'code' = 'qty', 'at most 100 at once');
  perform pg_temp.ok(farm_buy_many_v1('energy', 'coins', 5, 1, gen_random_uuid(), 0) ->> 'code' = 'qty', 'at least one');
  perform pg_temp.ok(farm_buy_many_v1('energy', 'coins', 5, 1, gen_random_uuid(), 20) ->> 'code' = 'insufficient-coins', 'twenty need 100: nothing taken');
  perform pg_temp.ok((farm_shop_v1() -> 'wallet' ->> 'coins')::int = 50, 'nothing was taken');
  perform pg_temp.ok(farm_buy_many_v1('energy', 'coins', 4, 1, gen_random_uuid(), 2) ->> 'code' = 'offer-changed', 'the price is the server''s');
  r := farm_buy_v1('energy', 'coins', 5, 1, gen_random_uuid());
  perform pg_temp.ok(r ->> 'ok' = 'true' and (farm_shop_v1() ->> 'left')::int = before - 11, 'one more the old way counts one');
end $$;
-- the day's limit: 1,000 refills, counted by qty
reset role;
insert into farm.purchases (user_id, request_id, item, currency, price, amount, qty)
  select '00000000-0000-4000-8000-000000000005', gen_random_uuid(), 'energy', 'coins', 0, 0, 100 from generate_series(1, 9);
set role authenticated;
do $$ declare r jsonb; begin
  perform pg_temp.as_(5);
  perform pg_temp.ok((farm_shop_v1() ->> 'left')::int = 1000 - 911, 'left today: 89 (' || (farm_shop_v1() ->> 'left')::text || ')');
  perform pg_temp.ok(farm_buy_many_v1('energy', 'coins', 5, 1, gen_random_uuid(), 90) ->> 'code' = 'limit', 'ninety more is past the 1,000');
  r := farm_buy_many_v1('energy', 'coins', 5, 1, gen_random_uuid(), 9);
  perform pg_temp.ok(r ->> 'ok' = 'true', 'nine more fit (' || r::text || ')');
end $$;
