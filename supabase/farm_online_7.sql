-- Harvest Ville online, part 7 (27 Oct 2026): the Market, where farms sell to each other. Run AFTER parts 1-6.
-- Adds one table (farm.market) and seven functions; replaces nothing, touches no Selebox table.
-- What it is for (owner, 27 Oct): buying from another farm what you need but can't make yet (out of season, or
-- before you own the animal or reach the mine floor) to finish an order, a villager's request or a workshop recipe.
--   farm_market_list_v1(item, qty, price)  put up a lot at your stall (4 at a time, up to 10 of one item, for 2 days)
--   farm_market_cancel_v1(id)               take an unsold lot back
--   farm_market_mine_v1()                   your stall: open, sold (and to whom) or expired
--   farm_market_collect_v1()                the gold for what sold, and expired lots back (taken once)
--   farm_market_of_v1(host)                 what a farm you can visit has for sale
--   farm_market_find_v1(item)               who sells an item: friends first, then the cheapest
--   farm_market_buy_v1(id)                  buy a lot (first come, first served; 10 a day; never your own)
-- Gold and the bag live in each player's game: the game checks you can pay before buying and pays the seller when
-- they collect; this table decides who got a lot, once.
set lock_timeout = '5s';

create table farm.market (
  id bigint generated always as identity primary key,
  seller uuid not null references farm.players (user_id) on delete cascade,
  item text not null check (item ~ '^[a-z][a-z_]{0,23}$'),
  qty int not null check (qty between 1 and 10),
  price int not null check (price between 1 and 100000),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '2 days'),
  buyer uuid references farm.players (user_id) on delete set null,
  sold_at timestamptz,
  claimed boolean not null default false,
  check (buyer is null or buyer <> seller)
);
create index market_mine on farm.market (seller) where not claimed;
create index market_open on farm.market (item, price) where buyer is null;
create index market_bought on farm.market (buyer, sold_at) where buyer is not null;
alter table farm.market enable row level security;
revoke all on farm.market from public, anon, authenticated;

-- May this player see that farm's stall? (Like visiting it: not blocked, and listed or a friend.)
create function farm.can_see(p_me uuid, p_host uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select p_me = p_host or (not farm.blocked(p_me, p_host) and exists (
    select 1 from farm.players pl where pl.user_id = p_host and (pl.listed and not pl.hidden or farm.are_friends(p_me, p_host))));
$$;
revoke all on function farm.can_see(uuid, uuid) from public, anon, authenticated;

create function public.farm_market_list_v1(p_item text, p_qty int, p_price int)
returns json language plpgsql security definer set search_path = '' as $$
declare uid uuid := farm.me(); new_id bigint;
begin
  if p_item is null or p_item !~ '^[a-z][a-z_]{0,23}$' or p_qty is null or p_qty not between 1 and 10 or p_price is null or p_price not between 1 and 100000 then
    return json_build_object('ok', false, 'code', 'bad');
  end if;
  perform pg_advisory_xact_lock(hashtextextended('farm_market:' || uid::text, 0));
  if (select count(*) from farm.market where seller = uid and not claimed) >= 4 then return json_build_object('ok', false, 'code', 'full'); end if;
  insert into farm.market (seller, item, qty, price) values (uid, p_item, p_qty, p_price) returning id into new_id;
  return json_build_object('ok', true, 'id', new_id);
end $$;

create function public.farm_market_cancel_v1(p_id bigint)
returns json language plpgsql security definer set search_path = '' as $$
declare uid uuid := farm.me(); r record;
begin
  delete from farm.market where id = p_id and seller = uid and buyer is null returning item, qty into r;
  if not found then return json_build_object('ok', false, 'code', 'gone'); end if;
  return json_build_object('ok', true, 'item', r.item, 'qty', r.qty);
end $$;

create function public.farm_market_mine_v1()
returns table (id bigint, item text, qty int, price int, status text, buyer_name text, expires_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select m.id, m.item, m.qty, m.price,
    case when m.buyer is not null then 'sold' when m.expires_at <= now() then 'expired' else 'open' end,
    (select pl.farm_name from farm.players pl where pl.user_id = m.buyer), m.expires_at
  from farm.market m where m.seller = farm.me() and not m.claimed order by m.id;
$$;

create function public.farm_market_collect_v1()
returns json language plpgsql security definer set search_path = '' as $$
declare uid uuid := farm.me(); sold json; back json;
begin
  with taken as (
    update farm.market m set claimed = true where m.seller = uid and m.buyer is not null and not m.claimed
    returning m.item, m.qty, m.price, m.buyer)
  select coalesce(json_agg(json_build_object('item', t.item, 'qty', t.qty, 'price', t.price, 'buyer', pl.farm_name)), '[]'::json)
  into sold from taken t left join farm.players pl on pl.user_id = t.buyer;
  with gone as (
    delete from farm.market m where m.seller = uid and m.buyer is null and m.expires_at <= now() returning m.item, m.qty)
  select coalesce(json_agg(json_build_object('item', g.item, 'qty', g.qty)), '[]'::json) into back from gone g;
  return json_build_object('sold', sold, 'returned', back);
end $$;

create function public.farm_market_of_v1(p_host uuid)
returns table (id bigint, item text, qty int, price int, expires_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select m.id, m.item, m.qty, m.price, m.expires_at from farm.market m
  where m.seller = p_host and m.buyer is null and m.expires_at > now() and farm.can_see(farm.me(), p_host)
  order by m.id;
$$;

create function public.farm_market_find_v1(p_item text)
returns table (id bigint, seller uuid, farm_name text, friend boolean, qty int, price int)
language sql stable security definer set search_path = '' as $$
  with me as (select farm.me() as uid)
  select m.id, m.seller, pl.farm_name, farm.are_friends(me.uid, m.seller), m.qty, m.price
  from me, farm.market m join farm.players pl on pl.user_id = m.seller
  where m.item = p_item and m.buyer is null and m.expires_at > now() and m.seller <> me.uid and farm.can_see(me.uid, m.seller)
  order by farm.are_friends(me.uid, m.seller) desc, m.price::numeric / m.qty, m.id
  limit 10;
$$;

create function public.farm_market_buy_v1(p_id bigint)
returns json language plpgsql security definer set search_path = '' as $$
declare uid uuid := farm.me(); r record; today_start timestamptz := (now() at time zone 'utc')::date::timestamp at time zone 'utc'; first boolean;
begin
  perform pg_advisory_xact_lock(hashtextextended('farm_market_buy:' || uid::text, 0));
  if (select count(*) from farm.market where buyer = uid and sold_at >= today_start) >= 10 then return json_build_object('ok', false, 'code', 'limit'); end if;
  select m.seller into r from farm.market m where m.id = p_id;
  if not found then return json_build_object('ok', false, 'code', 'gone'); end if;
  if r.seller = uid then return json_build_object('ok', false, 'code', 'self'); end if;
  if not farm.can_see(uid, r.seller) then return json_build_object('ok', false, 'code', 'gone'); end if;
  first := not exists (select 1 from farm.market where seller = r.seller and buyer = uid and sold_at >= today_start);
  update farm.market m set buyer = uid, sold_at = now()
  where m.id = p_id and m.buyer is null and m.expires_at > now()
  returning m.item, m.qty, m.price, m.seller into r;
  if not found then return json_build_object('ok', false, 'code', 'gone'); end if;
  if first then perform farm.alert(r.seller, uid, 'sale', 'bought from your Market stall'); end if;
  return json_build_object('ok', true, 'item', r.item, 'qty', r.qty, 'price', r.price,
    'seller', (select farm_name from farm.players where user_id = r.seller));
end $$;

revoke all on function public.farm_market_list_v1(text, int, int), public.farm_market_cancel_v1(bigint), public.farm_market_mine_v1(),
  public.farm_market_collect_v1(), public.farm_market_of_v1(uuid), public.farm_market_find_v1(text), public.farm_market_buy_v1(bigint) from public, anon;
grant execute on function public.farm_market_list_v1(text, int, int), public.farm_market_cancel_v1(bigint), public.farm_market_mine_v1(),
  public.farm_market_collect_v1(), public.farm_market_of_v1(uuid), public.farm_market_find_v1(text), public.farm_market_buy_v1(bigint) to authenticated;
reset lock_timeout;

-- ---------- to undo part 7 ----------
-- drop function if exists public.farm_market_list_v1(text, int, int), public.farm_market_cancel_v1(bigint), public.farm_market_mine_v1(),
--   public.farm_market_collect_v1(), public.farm_market_of_v1(uuid), public.farm_market_find_v1(text), public.farm_market_buy_v1(bigint),
--   farm.can_see(uuid, uuid);
-- drop table if exists farm.market;
