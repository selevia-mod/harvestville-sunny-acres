-- Harvest Ville online, part 24 (8 Nov 2026). Run AFTER parts 1-23. Energy refills in bulk (owner, 8 Nov: "Allow
-- users to refill multiplied by what they want, for example x10"):
--   1. farm.purchases.qty: how many refills one purchase was (1 for every purchase so far).
--   2. farm_buy_many_v1(..., p_qty): qty refills (1 to 100) in ONE payment and ONE receipt: the price and the energy times
--      qty, all or nothing (the balance is rechecked in the same conditional update as v1; a lost answer is settled by
--      the same request id, as v1).
--   3. The daily limit (1,000 refills) counts refills, not purchases: farm_buy_v1, farm_buy_many_v1 and farm_shop_v1 all sum
--      qty. farm_shop_v1 also says 'bulk': true, so the game shows x10 / x50 / Max only once this part is in.
-- Additive: one column with a default, one new function, two functions with the same arguments and grants. Safe to run
-- twice.
set local lock_timeout = '5s';

-- ---------- 1. how many refills a purchase was ----------
alter table farm.purchases add column if not exists qty integer not null default 1;
alter table farm.purchases drop constraint if exists purchases_qty_check;
alter table farm.purchases add constraint purchases_qty_check check (qty between 1 and 100);

-- refills bought today (Philippine days), counted by qty
create or replace function farm.refills_today(p_uid uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum(p.qty), 0)::integer from farm.purchases p
  where p.user_id = p_uid
    and p.created_at >= ((now() at time zone 'Asia/Manila')::date::timestamp at time zone 'Asia/Manila');
$$;
revoke all on function farm.refills_today(uuid) from public, anon, authenticated;

-- ---------- 2. qty refills in one payment ----------
create or replace function public.farm_buy_many_v1(p_item text, p_currency text, p_price integer, p_version integer, p_request_id uuid, p_qty integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare uid uuid := auth.uid(); me uuid; o farm.offers; done farm.purchases; balance_after int; total int; amount int;
begin
  if uid is null then raise exception 'not signed in' using errcode = '28000'; end if;
  perform pg_advisory_xact_lock(hashtext('farm_buy'), hashtext(uid::text));
  if p_request_id is null then return jsonb_build_object('ok', false, 'code', 'request-required'); end if;
  if p_qty is null or p_qty < 1 or p_qty > 100 then return jsonb_build_object('ok', false, 'code', 'qty'); end if;
  -- the same tap again (its answer was lost): the energy is owed, the payment was already taken
  select * into done from farm.purchases where user_id = uid and request_id = p_request_id;
  if found then
    return jsonb_build_object('ok', true, 'duplicate', true, 'item', done.item, 'amount', done.amount, 'currency', done.currency, 'price', done.price, 'qty', done.qty);
  end if;
  me := public.current_profile_id();
  if me is null or not exists (select 1 from public.profiles where id = me and not coalesce(is_guest, false) and not coalesce(is_banned, false)
      and deleted_at is null and (suspended_until is null or suspended_until <= now())) then
    return jsonb_build_object('ok', false, 'code', 'account-unavailable');
  end if;
  select * into o from farm.offers where item = p_item and currency = p_currency;
  if not found or not o.enabled then return jsonb_build_object('ok', false, 'code', 'offer-unavailable'); end if;
  if p_price is distinct from o.price or p_version is distinct from o.version then
    return jsonb_build_object('ok', false, 'code', 'offer-changed');
  end if;
  if farm.refills_today(uid) + p_qty > 1000 then
    return jsonb_build_object('ok', false, 'code', 'limit');
  end if;
  total := o.price * p_qty;
  amount := o.amount * p_qty;
  if o.currency = 'coins' then
    update public.wallets set coin_balance = coin_balance - total, updated_at = clock_timestamp()
    where user_id = me and coin_balance >= total returning coin_balance into balance_after;
  else
    update public.wallets set star_balance = star_balance - total, updated_at = clock_timestamp()
    where user_id = me and star_balance >= total returning star_balance into balance_after;
  end if;
  if not found then
    return jsonb_build_object('ok', false, 'code', case when exists (select 1 from public.wallets where user_id = me) then 'insufficient-' || o.currency else 'wallet-unavailable' end);
  end if;
  if o.currency = 'coins' then
    insert into public.coin_transactions (user_id, delta, balance_after, type, reference_type, reference_id, metadata)
    values (me, -total, balance_after, 'farm_energy', 'farm_energy', p_request_id::text,
            jsonb_build_object('game', 'harvest_ville', 'item', o.item, 'amount', amount, 'qty', p_qty, 'offer_version', o.version));
  else
    insert into public.star_transactions (user_id, delta, balance_after, type, reference_type, reference_id, metadata)
    values (me, -total, balance_after, 'farm_energy', 'farm_energy', p_request_id::text,
            jsonb_build_object('game', 'harvest_ville', 'item', o.item, 'amount', amount, 'qty', p_qty, 'offer_version', o.version));
  end if;
  -- a second copy of the same tap racing this one fails here and rolls back its payment
  insert into farm.purchases (user_id, request_id, item, currency, price, amount, qty) values (uid, p_request_id, o.item, o.currency, total, amount, p_qty);
  return jsonb_build_object('ok', true, 'item', o.item, 'amount', amount, 'currency', o.currency, 'price', total, 'qty', p_qty, 'balance', balance_after);
end $function$;
revoke all on function public.farm_buy_many_v1(text, text, integer, integer, uuid, integer) from public, anon;
grant execute on function public.farm_buy_many_v1(text, text, integer, integer, uuid, integer) to authenticated;

-- ---------- 3. v1 and the shop count refills (sum of qty), not purchases ----------
create or replace function public.farm_buy_v1(p_item text, p_currency text, p_price integer, p_version integer, p_request_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare uid uuid := auth.uid(); me uuid; o farm.offers; done farm.purchases; balance_after int;
begin
  if uid is null then raise exception 'not signed in' using errcode = '28000'; end if;
  -- one purchase at a time per player: a double tap waits for the first, then gets its receipt; the daily cap holds
  perform pg_advisory_xact_lock(hashtext('farm_buy'), hashtext(uid::text));
  if p_request_id is null then return jsonb_build_object('ok', false, 'code', 'request-required'); end if;
  -- the same tap again (its answer was lost): the energy is owed, the payment was already taken
  select * into done from farm.purchases where user_id = uid and request_id = p_request_id;
  if found then
    return jsonb_build_object('ok', true, 'duplicate', true, 'item', done.item, 'amount', done.amount, 'currency', done.currency, 'price', done.price);
  end if;
  me := public.current_profile_id();
  if me is null or not exists (select 1 from public.profiles where id = me and not coalesce(is_guest, false) and not coalesce(is_banned, false)
      and deleted_at is null and (suspended_until is null or suspended_until <= now())) then
    return jsonb_build_object('ok', false, 'code', 'account-unavailable');
  end if;
  select * into o from farm.offers where item = p_item and currency = p_currency;
  if not found or not o.enabled then return jsonb_build_object('ok', false, 'code', 'offer-unavailable'); end if;
  if p_price is distinct from o.price or p_version is distinct from o.version then
    return jsonb_build_object('ok', false, 'code', 'offer-changed');
  end if;
  if farm.refills_today(uid) >= 1000 then
    return jsonb_build_object('ok', false, 'code', 'limit');
  end if;
  -- the conditional update rechecks the balance against every other spender, so it can never go below zero
  if o.currency = 'coins' then
    update public.wallets set coin_balance = coin_balance - o.price, updated_at = clock_timestamp()
    where user_id = me and coin_balance >= o.price returning coin_balance into balance_after;
  else
    update public.wallets set star_balance = star_balance - o.price, updated_at = clock_timestamp()
    where user_id = me and star_balance >= o.price returning star_balance into balance_after;
  end if;
  if not found then
    return jsonb_build_object('ok', false, 'code', case when exists (select 1 from public.wallets where user_id = me) then 'insufficient-' || o.currency else 'wallet-unavailable' end);
  end if;
  if o.currency = 'coins' then
    insert into public.coin_transactions (user_id, delta, balance_after, type, reference_type, reference_id, metadata)
    values (me, -o.price, balance_after, 'farm_energy', 'farm_energy', p_request_id::text,
            jsonb_build_object('game', 'harvest_ville', 'item', o.item, 'amount', o.amount, 'offer_version', o.version));
  else
    insert into public.star_transactions (user_id, delta, balance_after, type, reference_type, reference_id, metadata)
    values (me, -o.price, balance_after, 'farm_energy', 'farm_energy', p_request_id::text,
            jsonb_build_object('game', 'harvest_ville', 'item', o.item, 'amount', o.amount, 'offer_version', o.version));
  end if;
  -- a second copy of the same tap racing this one fails here and rolls back its payment
  insert into farm.purchases (user_id, request_id, item, currency, price, amount) values (uid, p_request_id, o.item, o.currency, o.price, o.amount);
  return jsonb_build_object('ok', true, 'item', o.item, 'amount', o.amount, 'currency', o.currency, 'price', o.price, 'balance', balance_after);
end $function$;

create or replace function public.farm_shop_v1()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare uid uuid := auth.uid(); me uuid := public.current_profile_id();
begin
  if uid is null then raise exception 'not signed in' using errcode = '28000'; end if;
  return jsonb_build_object(
    'wallet', (select jsonb_build_object('coins', w.coin_balance, 'stars', w.star_balance) from public.wallets w where w.user_id = me),
    'offers', coalesce((select jsonb_agg(jsonb_build_object('item', o.item, 'currency', o.currency, 'price', o.price, 'amount', o.amount, 'version', o.version) order by o.currency)
                        from farm.offers o where o.enabled), '[]'::jsonb),
    'left', greatest(0, 1000 - farm.refills_today(uid)),
    'bulk', true);
end $function$;
