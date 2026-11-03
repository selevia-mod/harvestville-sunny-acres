-- Harvest Ville online, part 17 (4 Nov 2026). Run AFTER part 7 (the Market: farm.market) and part 3 (farm.profile_of,
-- Selebox follows). The Market board (owner, 4 Nov: "ads for your market stall"): from your stall, Advertise puts it on a public board for 4 hours,
-- free once a day (a Philippine day), showing what you sell. Others open the board in their Market tab and look at your
-- stall to buy, with the Market's own buying (farm_market_of_v1, farm_market_buy_v1: nothing about buying changes).
-- Additive: one new table, two new functions, and one index on the existing farm.market (open lots by seller, for the
-- board: a plain CREATE INDEX, so writes to farm.market wait while it builds, a moment for a table its size; the
-- lock_timeout below gives up rather than queue behind a long write). Nothing that exists changes. Safe to run twice.
--   farm_market_ad_v1()    put my stall on the board. 'empty' (nothing up for sale) | 'used' (today's is used)
--   farm_market_ads_v1()   the board: stalls on it now (friends first, then the newest), and how mine stands
-- The board shows a stall only while it has something for sale, and only to players who may see that farm's stall
-- (as farm.can_see: not blocked, and listed or a friend), as its More menu does; never a farm hidden after reports or
-- whose account is banned, suspended or deleted (a friend can still open a hidden one's stall from its More menu).
set lock_timeout = '5s';

create table if not exists farm.market_ads (
  seller uuid primary key references farm.players (user_id) on delete cascade,
  day date not null, -- the Philippine day of the last one
  posted_at timestamptz not null default now(),
  until timestamptz not null
);
create index if not exists market_ads_until on farm.market_ads (until);
create index if not exists market_open_seller on farm.market (seller) where buyer is null;
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

-- The board: up to 30 stalls, each with its 3 cheapest lots (by the each price) and how many it has up. The ads up now
-- with something for sale are narrowed first, with my friends, blocks and the sellers' standing joined once (not
-- asked per ad), and only the 30 shown are counted and priced.
create or replace function public.farm_market_ads_v1()
returns json language plpgsql stable security definer set search_path = '' as $$
declare uid uuid := farm.me(); mine uuid := farm.profile_of(uid); today date := (now() at time zone 'Asia/Manila')::date; a farm.market_ads; ads json;
begin
  with fr as ( -- my friends: an accepted code, or following each other on Selebox (as farm.are_friends)
    select case when f.user_a = uid then f.user_b else f.user_a end as fid
    from farm.friends f where uid in (f.user_a, f.user_b) and f.accepted_at is not null
    union
    select po.auth_user_id from public.follows f1
    join public.follows f2 on f2.follower_id = f1.following_id and f2.following_id = f1.follower_id
    join public.profiles po on po.id = f1.following_id
    where mine is not null and f1.follower_id = mine and po.auth_user_id is not null),
  bl as ( -- blocked either way
    select b.blocked as bid from farm.blocks b where b.blocker = uid
    union
    select b.blocker from farm.blocks b where b.blocked = uid),
  shown as (
    select ad.seller, pl.farm_name, ad.posted_at, ad.until, fr.fid is not null as friend
    from farm.market_ads ad
    join farm.players pl on pl.user_id = ad.seller
    left join fr on fr.fid = ad.seller
    where ad.until > now() and ad.seller <> uid and not pl.hidden and (pl.listed or fr.fid is not null)
      and not exists (select 1 from bl where bl.bid = ad.seller)
      and not exists (select 1 from public.profiles p where p.auth_user_id = ad.seller
        and (coalesce(p.is_banned, false) or p.suspended_until > now() or p.deleted_at is not null))
      and exists (select 1 from farm.market m where m.seller = ad.seller and m.buyer is null and m.expires_at > now())
    order by fr.fid is not null desc, ad.posted_at desc
    limit 30)
  select coalesce(json_agg(json_build_object('id', x.seller, 'farm_name', x.farm_name, 'friend', x.friend, 'left_s', extract(epoch from x.until - now())::int,
    'lots', (select count(*)::int from farm.market m where m.seller = x.seller and m.buyer is null and m.expires_at > now()),
    'items', (select coalesce(json_agg(json_build_object('item', l.item, 'qty', l.qty, 'price', l.price)), '[]'::json) from (
        select m.item, m.qty, m.price from farm.market m where m.seller = x.seller and m.buyer is null and m.expires_at > now()
        order by m.price::numeric / m.qty, m.id limit 3) l)) order by x.friend desc, x.posted_at desc), '[]'::json)
  into ads from shown x;
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
-- drop index if exists farm.market_open_seller;
-- drop table if exists farm.market_ads;
