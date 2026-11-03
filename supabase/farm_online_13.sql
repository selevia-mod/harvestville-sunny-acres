-- Harvest Ville online, part 13 (3 Nov 2026). Run AFTER parts 1-12.
-- Looks at Tita Luz's Tailor Shop (owner, 2 Nov: "Spring Festival 100 Coins or 150 Stars, Santa Claus 150 Coins only,
-- Barrio Fiesta 150 or 200, Bunny Hop 150 or 200"; one purchase dresses the boy and the girl). The Gold looks and the
-- free Christmas Elf stay in the game. The server holds these prices (farm.look_offers), takes the payment from the
-- player's Selebox wallet the same way the energy refills do (part 4), and remembers who owns which look
-- (farm.looks_owned), so a look bought on one phone is yours on every phone, and it can never be bought twice.
-- Touches Selebox's ledgers in one way only: 'farm_look' joins the list of allowed types on coin_transactions and
-- star_transactions (as 'farm_energy' did in part 4); every existing type stays.
set lock_timeout = '5s';

-- ---------- the ledgers learn 'farm_look' ----------
do $$
declare ledger text; old_expression text; constraint_name text;
begin
  foreach ledger in array array['coin_transactions', 'star_transactions'] loop
    constraint_name := ledger || '_type_check';
    select pg_get_expr(conbin, conrelid) into old_expression from pg_constraint
    where conrelid = ('public.' || ledger)::regclass and conname = constraint_name and contype = 'c';
    if found and position('farm_look' in old_expression) = 0 then
      execute format('alter table public.%I drop constraint %I', ledger, constraint_name);
      execute format('alter table public.%I add constraint %I check ((%s) or type = %L)', ledger, constraint_name, old_expression, 'farm_look');
    end if;
  end loop;
end $$;

-- ---------- prices ----------
-- One row per look and currency. Change a price with an update (and version + 1, so an open shop asks again).
create table farm.look_offers (
  look text not null check (look in ('flower', 'santa', 'fiesta', 'bunny')),
  currency text not null check (currency in ('coins', 'stars')),
  price int not null check (price between 1 and 100000),
  version int not null default 1 check (version > 0),
  enabled boolean not null default true,
  primary key (look, currency)
);
insert into farm.look_offers (look, currency, price) values
  ('flower', 'coins', 100), ('flower', 'stars', 150),
  ('santa', 'coins', 150),
  ('fiesta', 'coins', 150), ('fiesta', 'stars', 200),
  ('bunny', 'coins', 150), ('bunny', 'stars', 200);

-- ---------- who owns what ----------
-- One row per player and look: the receipt too (request_id), so a tap retried after a lost answer gets its look back.
create table farm.looks_owned (
  user_id uuid not null,
  look text not null,
  currency text not null,
  price int not null,
  request_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (user_id, look),
  unique (user_id, request_id)
);
alter table farm.look_offers enable row level security;
alter table farm.looks_owned enable row level security;
revoke all on farm.look_offers, farm.looks_owned from public, anon, authenticated;

-- ---------- the shop ----------
-- { wallet: { coins, stars }, offers: [{ look, currency, price, version }], owned: [look] }
create function public.farm_looks_v1()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare uid uuid := auth.uid(); me uuid := public.current_profile_id();
begin
  if uid is null then raise exception 'not signed in' using errcode = '28000'; end if;
  return jsonb_build_object(
    'wallet', (select jsonb_build_object('coins', w.coin_balance, 'stars', w.star_balance) from public.wallets w where w.user_id = me),
    'offers', coalesce((select jsonb_agg(jsonb_build_object('look', o.look, 'currency', o.currency, 'price', o.price, 'version', o.version) order by o.look, o.currency)
                        from farm.look_offers o where o.enabled), '[]'::jsonb),
    'owned', coalesce((select jsonb_agg(l.look order by l.created_at) from farm.looks_owned l where l.user_id = uid), '[]'::jsonb));
end $$;

-- Buys a look. The price and version must match what the shop showed ('offer-changed' if not). A look already owned
-- costs nothing ('owned'). Returns { ok, look, currency, price, balance } or { ok: false, code }.
create function public.farm_look_buy_v1(p_look text, p_currency text, p_price int, p_version int, p_request_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); me uuid; o farm.look_offers; done farm.looks_owned; balance_after int;
begin
  if uid is null then raise exception 'not signed in' using errcode = '28000'; end if;
  -- one purchase at a time per player (the same lock as the energy refills)
  perform pg_advisory_xact_lock(hashtext('farm_buy'), hashtext(uid::text));
  if p_request_id is null then return jsonb_build_object('ok', false, 'code', 'request-required'); end if;
  -- the same tap again (its answer was lost): the look is already theirs, the payment already taken
  select * into done from farm.looks_owned where user_id = uid and request_id = p_request_id;
  if found then return jsonb_build_object('ok', true, 'duplicate', true, 'look', done.look, 'currency', done.currency, 'price', done.price); end if;
  if exists (select 1 from farm.looks_owned where user_id = uid and look = p_look) then
    return jsonb_build_object('ok', false, 'code', 'owned', 'look', p_look);
  end if;
  me := public.current_profile_id();
  if me is null or not exists (select 1 from public.profiles where id = me and not coalesce(is_guest, false) and not coalesce(is_banned, false)
      and deleted_at is null and (suspended_until is null or suspended_until <= now())) then
    return jsonb_build_object('ok', false, 'code', 'account-unavailable');
  end if;
  select * into o from farm.look_offers where look = p_look and currency = p_currency;
  if not found or not o.enabled then return jsonb_build_object('ok', false, 'code', 'offer-unavailable'); end if;
  if p_price is distinct from o.price or p_version is distinct from o.version then
    return jsonb_build_object('ok', false, 'code', 'offer-changed');
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
    values (me, -o.price, balance_after, 'farm_look', 'farm_look', p_request_id::text,
            jsonb_build_object('game', 'harvest_ville', 'look', o.look, 'offer_version', o.version));
  else
    insert into public.star_transactions (user_id, delta, balance_after, type, reference_type, reference_id, metadata)
    values (me, -o.price, balance_after, 'farm_look', 'farm_look', p_request_id::text,
            jsonb_build_object('game', 'harvest_ville', 'look', o.look, 'offer_version', o.version));
  end if;
  -- a second copy of the same tap racing this one fails here and rolls back its payment
  insert into farm.looks_owned (user_id, look, currency, price, request_id) values (uid, o.look, o.currency, o.price, p_request_id);
  return jsonb_build_object('ok', true, 'look', o.look, 'currency', o.currency, 'price', o.price, 'balance', balance_after);
end $$;

revoke all on function public.farm_looks_v1(), public.farm_look_buy_v1(text, text, int, int, uuid) from public, anon;
grant execute on function public.farm_looks_v1(), public.farm_look_buy_v1(text, text, int, int, uuid) to authenticated;

-- ---------- to undo ----------
-- drop function if exists public.farm_look_buy_v1(text, text, int, int, uuid), public.farm_looks_v1();
-- drop table if exists farm.looks_owned, farm.look_offers;
-- (the 'farm_look' ledger type can stay: no row uses it once the shop is gone)
