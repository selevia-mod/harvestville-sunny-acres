-- Harvest Ville online, part 4 (26 Oct 2026). Run AFTER parts 1-3.
-- Energy refills for Selebox Coins or Stars (owner, 26 Oct: "5 coins for energy refill and 10 for stars ... make it
-- 100 energy"). The server holds the prices (farm.offers), takes the payment from the player's Selebox wallet in the
-- same way the pet shop does (a conditional wallet update, a coin_transactions / star_transactions row of type
-- 'farm_energy'), and keeps a receipt per request so a retried tap never pays twice. The game then adds the energy.
-- Touches Selebox's ledgers in one way only: 'farm_energy' joins the list of allowed types on coin_transactions and
-- star_transactions (as 'pet_meals' did on 9 Oct); every existing type stays.
set lock_timeout = '5s';

-- ---------- the ledgers learn 'farm_energy' ----------
do $$
declare ledger text; old_expression text; constraint_name text;
begin
  foreach ledger in array array['coin_transactions', 'star_transactions'] loop
    constraint_name := ledger || '_type_check';
    select pg_get_expr(conbin, conrelid) into old_expression from pg_constraint
    where conrelid = ('public.' || ledger)::regclass and conname = constraint_name and contype = 'c';
    if found and position('farm_energy' in old_expression) = 0 then
      execute format('alter table public.%I drop constraint %I', ledger, constraint_name);
      execute format('alter table public.%I add constraint %I check ((%s) or type = %L)', ledger, constraint_name, old_expression, 'farm_energy');
    end if;
  end loop;
end $$;
create unique index coin_transactions_farm_energy_receipt on public.coin_transactions (user_id, reference_id) where reference_type = 'farm_energy';
create unique index star_transactions_farm_energy_receipt on public.star_transactions (user_id, reference_id) where reference_type = 'farm_energy';

-- ---------- prices ----------
-- One row per thing and currency. Change a price with an update (and version + 1, so an open game asks again).
create table farm.offers (
  item text not null check (item in ('energy')),
  currency text not null check (currency in ('coins', 'stars')),
  price int not null check (price between 1 and 100000),
  amount int not null check (amount between 1 and 1000),
  version int not null default 1 check (version > 0),
  enabled boolean not null default true,
  primary key (item, currency)
);
insert into farm.offers (item, currency, price, amount) values ('energy', 'coins', 5, 100), ('energy', 'stars', 10, 100);
alter table farm.offers enable row level security;
revoke all on farm.offers from public, anon, authenticated;

-- Receipts: one per tap (the game's request id), so a retry after a lost answer is not charged again.
create table farm.purchases (
  user_id uuid not null references auth.users (id) on delete cascade,
  request_id uuid not null,
  item text not null,
  currency text not null,
  price int not null,
  amount int not null,
  created_at timestamptz not null default now(),
  primary key (user_id, request_id)
);
create index purchases_day on farm.purchases (user_id, created_at desc);
alter table farm.purchases enable row level security;
revoke all on farm.purchases from public, anon, authenticated;

-- ---------- the shop ----------
-- The player's own Coins and Stars, today's prices, and how many refills are left today (20 a day).
create function public.farm_shop_v1()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare uid uuid := auth.uid(); me uuid := public.current_profile_id();
begin
  if uid is null then raise exception 'not signed in' using errcode = '28000'; end if;
  return jsonb_build_object(
    'wallet', (select jsonb_build_object('coins', w.coin_balance, 'stars', w.star_balance) from public.wallets w where w.user_id = me),
    'offers', coalesce((select jsonb_agg(jsonb_build_object('item', o.item, 'currency', o.currency, 'price', o.price, 'amount', o.amount, 'version', o.version) order by o.currency)
                        from farm.offers o where o.enabled), '[]'::jsonb),
    'left', greatest(0, 20 - (select count(*) from farm.purchases p where p.user_id = uid
                              and p.created_at >= ((now() at time zone 'Asia/Manila')::date::timestamp at time zone 'Asia/Manila'))));
end $$;

-- Buys one refill. p_price / p_version are what the game showed: if the price changed since, nothing is charged
-- ('offer-changed'). Returns { ok, amount, currency, price, balance } or { ok: false, code }.
create function public.farm_buy_v1(p_item text, p_currency text, p_price int, p_version int, p_request_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); me uuid; o farm.offers; done farm.purchases; balance_after int;
begin
  if uid is null then raise exception 'not signed in' using errcode = '28000'; end if;
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
  if (select count(*) from farm.purchases p where p.user_id = uid
      and p.created_at >= ((now() at time zone 'Asia/Manila')::date::timestamp at time zone 'Asia/Manila')) >= 20 then
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
end $$;

revoke all on function public.farm_shop_v1(), public.farm_buy_v1(text, text, int, int, uuid) from public, anon;
grant execute on function public.farm_shop_v1(), public.farm_buy_v1(text, text, int, int, uuid) to authenticated;

reset lock_timeout;

-- ---------- to change a price ----------
-- update farm.offers set price = 8, version = version + 1 where item = 'energy' and currency = 'coins';
-- (to stop selling: update farm.offers set enabled = false;)

-- ---------- to undo part 4 ----------
-- drop function if exists public.farm_buy_v1(text, text, int, int, uuid), public.farm_shop_v1();
-- drop table if exists farm.purchases, farm.offers;
-- drop index if exists public.coin_transactions_farm_energy_receipt, public.star_transactions_farm_energy_receipt;
--   (the ledgers keep 'farm_energy' as an allowed type: harmless, and their old rows may use it)
