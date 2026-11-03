-- Harvest Ville online, part 17 (4 Nov 2026). Run AFTER part 7 (the Market: farm.market, farm.can_see). The Market
-- board (owner, 4 Nov: "ads for your market stall"): from your stall, Advertise puts it on a public board for 4 hours,
-- free once a day (a Philippine day), showing what you sell. Others open the board in their Market tab and look at your
-- stall to buy, with the Market's own buying (farm_market_of_v1, farm_market_buy_v1: nothing about buying changes).
-- Additive: one new table and two new functions; nothing that exists changes. Safe to run twice.
--   farm_market_ad_v1()    put my stall on the board. 'empty' (nothing up for sale) | 'used' (today's is used)
--   farm_market_ads_v1()   the board: stalls on it now (friends first, then the newest), and how mine stands
-- The board shows a stall only while it has something for sale, and only to players who may see that farm's stall
-- (farm.can_see: not blocked, and listed or a friend), as its More menu does.
set lock_timeout = '5s';

create table if not exists farm.market_ads (
  seller uuid primary key references farm.players (user_id) on delete cascade,
  day date not null, -- the Philippine day of the last one
  posted_at timestamptz not null default now(),
  until timestamptz not null
);
create index if not exists market_ads_until on farm.market_ads (until);
alter table farm.market_ads enable row level security;
revoke all on farm.market_ads from public, anon, authenticated;

-- How long an ad stays up (hours).
create or replace function farm.ad_hours() returns int language sql immutable set search_path = '' as $$ select 4 $$;
revoke all on function farm.ad_hours() from public, anon, authenticated;

create or replace function public.farm_market_ad_v1()
returns json language plpgsql security definer set search_path = '' as $$
declare uid uuid := farm.me(); today date := (now() at time zone 'Asia/Manila')::date; a farm.market_ads;
  next_s int := extract(epoch from ((today + 1)::timestamp at time zone 'Asia/Manila') - now())::int;
begin
  perform pg_advisory_xact_lock(hashtextextended('farm_ad:' || uid::text, 0));
  if not exists (select 1 from farm.market m where m.seller = uid and m.buyer is null and m.expires_at > now()) then
    return json_build_object('ok', false, 'code', 'empty');
  end if;
  select * into a from farm.market_ads where seller = uid;
  if found and a.day = today then
    return json_build_object('ok', false, 'code', 'used', 'until_s', greatest(0, extract(epoch from a.until - now())::int), 'next_s', next_s);
  end if;
  insert into farm.market_ads (seller, day, posted_at, until) values (uid, today, now(), now() + make_interval(hours => farm.ad_hours()))
  on conflict (seller) do update set day = excluded.day, posted_at = excluded.posted_at, until = excluded.until;
  return json_build_object('ok', true, 'until_s', farm.ad_hours() * 3600, 'next_s', next_s);
end $$;

-- The board: up to 30 stalls, each with its 3 cheapest lots (by the each price) and how many it has up.
create or replace function public.farm_market_ads_v1()
returns json language plpgsql stable security definer set search_path = '' as $$
declare uid uuid := farm.me(); today date := (now() at time zone 'Asia/Manila')::date; a farm.market_ads; ads json;
begin
  select coalesce(json_agg(json_build_object('id', x.seller, 'farm_name', x.farm_name, 'friend', x.friend, 'left_s', x.left_s,
    'lots', x.lots, 'items', x.items) order by x.friend desc, x.posted_at desc), '[]'::json)
  into ads from (
    select ad.seller, pl.farm_name, farm.are_friends(uid, ad.seller) as friend, ad.posted_at,
      extract(epoch from ad.until - now())::int as left_s,
      (select count(*)::int from farm.market m where m.seller = ad.seller and m.buyer is null and m.expires_at > now()) as lots,
      (select coalesce(json_agg(json_build_object('item', l.item, 'qty', l.qty, 'price', l.price)), '[]'::json) from (
        select m.item, m.qty, m.price from farm.market m where m.seller = ad.seller and m.buyer is null and m.expires_at > now()
        order by m.price::numeric / m.qty, m.id limit 3) l) as items
    from farm.market_ads ad join farm.players pl on pl.user_id = ad.seller
    where ad.until > now() and ad.seller <> uid and farm.can_see(uid, ad.seller)
      and exists (select 1 from farm.market m where m.seller = ad.seller and m.buyer is null and m.expires_at > now())
    order by farm.are_friends(uid, ad.seller) desc, ad.posted_at desc
    limit 30) x;
  select * into a from farm.market_ads where seller = uid;
  return json_build_object('ads', ads, 'mine', json_build_object(
    'on', found and a.until > now(), 'until_s', case when found then greatest(0, extract(epoch from a.until - now())::int) else 0 end,
    'used', found and a.day = today, 'hours', farm.ad_hours(),
    'next_s', extract(epoch from ((today + 1)::timestamp at time zone 'Asia/Manila') - now())::int));
end $$;

revoke all on function public.farm_market_ad_v1(), public.farm_market_ads_v1() from public, anon, authenticated;
grant execute on function public.farm_market_ad_v1(), public.farm_market_ads_v1() to authenticated;
reset lock_timeout;

-- ---------- to undo part 17 ----------
-- drop function if exists public.farm_market_ad_v1(), public.farm_market_ads_v1(), farm.ad_hours();
-- drop table if exists farm.market_ads;
