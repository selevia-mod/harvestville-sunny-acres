-- Harvest Ville online, part 5 (27 Oct 2026): fixes from the code review. Run AFTER parts 1-4.
-- Replaces functions with corrected versions and adds indexes; drops nothing, touches no Selebox table.
--   1. Leaving online play no longer deletes the player row, so the blocks other players placed on you, reports and
--      a moderator's hide survive leaving and joining again (before: leave + join undid them all).
--   2. Friend-request pushes at most once a day per pair (request, cancel, request again was unlimited pushes).
--   3. A hidden farm (Hide, or hidden after reports) can be visited by friends only, even with its id in hand.
--   4. Guest accounts can't report (three throwaway guests could hide any farm).
--   5. Faster lists at scale: farm_list_v1 without a function call per player row; indexes for the likes count,
--      unread messages and the staff play numbers.
--   6. farm_buy_v1: one purchase at a time per player (a double tap gets the first one's receipt; the daily cap holds).
set lock_timeout = '5s';

-- ---------- 1. leaving online play ----------
create or replace function public.farm_leave_v1()
returns void language plpgsql security definer set search_path = '' as $$
declare uid uuid := farm.me();
begin
  -- your online farm, ranks, friends, messages and visits go; who you are (name, code) and what others decided
  -- about you (their blocks, reports, a moderator's hide) stay
  delete from farm.snapshots where user_id = uid;
  delete from farm.scores where user_id = uid;
  delete from farm.friends where uid in (user_a, user_b);
  delete from farm.messages where uid in (sender, recipient);
  delete from farm.visits where uid in (host, visitor);
end $$;

-- ---------- 2. friend-request pushes ----------
create or replace function farm.alert(p_to uuid, p_from uuid, p_kind text, p_what text) returns void
language plpgsql security definer set search_path = '' as $$
declare rcp uuid; act uuid; who text;
begin
  if p_to is null or p_from is null or p_to = p_from then return; end if;
  if coalesce((select lower(btrim(value)) from public.app_config where key = 'sunny_acres_alerts'), 'on') = 'off' then return; end if;
  select id into rcp from public.profiles where auth_user_id = p_to limit 1;
  select id, left(coalesce(nullif(btrim(display_name), ''), username, 'A farmer'), 40) into act, who from public.profiles where auth_user_id = p_from limit 1;
  if rcp is null or act is null then return; end if;
  -- a friend request at most once a day per pair (asking, cancelling and asking again sent a push each time)
  if p_kind = 'friend' and exists (select 1 from public.notifications n where n.recipient_id = rcp and n.actor_id = act
      and n.type = 'farm_alert' and n.metadata->>'kind' = 'friend' and n.created_at > now() - interval '1 day') then return; end if;
  if p_kind = 'message' and exists (select 1 from public.notifications n where n.recipient_id = rcp and n.actor_id = act
      and n.type = 'farm_alert' and n.metadata->>'kind' = 'message' and n.created_at > now() - interval '30 minutes') then return; end if;
  insert into public.notifications (recipient_id, actor_id, type, target_type, message, metadata)
  values (rcp, act, 'farm_alert', 'farm', p_what,
          jsonb_build_object('kind', p_kind, 'push_title', 'Harvest Ville', 'push_body', who || ' ' || p_what));
exception when others then
  return; -- an alert never stops the farm action
end $$;
revoke all on function farm.alert(uuid, uuid, text, text) from public, anon, authenticated;

-- ---------- 3. visiting a hidden farm ----------
create or replace function public.farm_visit_v1(p_host uuid)
returns json language plpgsql security definer set search_path = '' as $$
declare uid uuid := farm.me(); out json;
begin
  if p_host = uid then raise exception 'that is your own farm' using errcode = '22023'; end if;
  -- a hidden farm (Hide in Me, or hidden after reports) is open to friends only, however its id was found
  if not exists (select 1 from farm.snapshots where user_id = p_host) or farm.blocked(uid, p_host)
     or not exists (select 1 from farm.players p where p.user_id = p_host and ((p.listed and not p.hidden) or farm.are_friends(uid, p_host))) then
    raise exception 'no such farm' using errcode = 'P0002';
  end if;
  insert into farm.visits (host, visitor) values (p_host, uid) on conflict do nothing;
  select json_build_object(
    'id', pl.user_id, 'farm_name', pl.farm_name, 'online', pl.last_seen_at > now() - interval '2 minutes',
    'data', sn.data, 'beauty', sn.beauty, 'house_level', sn.house_level,
    'likes', (select count(*) from farm.visits v where v.host = p_host and v.liked),
    'friend', farm.are_friends(uid, p_host),
    'liked', vi.liked, 'gift', vi.gift)
  into out
  from farm.players pl join farm.snapshots sn on sn.user_id = pl.user_id
  join farm.visits vi on vi.host = p_host and vi.visitor = uid and vi.day = (now() at time zone 'utc')::date
  where pl.user_id = p_host;
  return out;
end $$;

-- ---------- 4. reports ----------
create or replace function public.farm_report_v1(p_target uuid, p_reason text, p_note text default null)
returns text language plpgsql security definer set search_path = '' as $$
declare uid uuid := farm.me(); ev jsonb;
begin
  if p_target = uid then return 'self'; end if;
  -- guest accounts can't report (three throwaway guests could hide anyone's farm)
  if exists (select 1 from public.profiles p where p.auth_user_id = uid and coalesce(p.is_guest, false)) then return 'guest'; end if;
  if p_reason not in ('name', 'messages', 'other') then return 'bad'; end if;
  if not exists (select 1 from farm.players where user_id = p_target) then return 'none'; end if;
  if exists (select 1 from farm.reports where reporter = uid and target = p_target and created_at > now() - interval '1 day') then return 'already'; end if;
  if (select count(*) from farm.reports where reporter = uid and created_at > now() - interval '1 day') >= 20 then return 'limit'; end if;
  select jsonb_build_object(
    'farm_name', (select farm_name from farm.players where user_id = p_target),
    'messages', coalesce((select jsonb_agg(jsonb_build_object('body', m.body, 'at', m.created_at) order by m.created_at desc)
      from (select body, created_at from farm.messages where sender = p_target and recipient = uid order by created_at desc limit 10) m), '[]'::jsonb))
  into ev;
  insert into farm.reports (reporter, target, reason, note, evidence) values (uid, p_target, p_reason, left(btrim(p_note), 200), ev);
  if (select count(distinct reporter) from farm.reports where target = p_target and status = 'open' and created_at > now() - interval '7 days') >= 3 then
    update farm.players set hidden = true where user_id = p_target;
  end if;
  return 'ok';
end $$;

-- ---------- 5. lists at scale ----------
-- Same lists as before (popular, recent, friends, following), with the blocks and friendships joined once instead of
-- asked per player row, and the likes counted only for the farms shown.
create or replace function public.farm_list_v1(p_kind text default 'popular', p_limit int default 30)
returns table (id uuid, farm_name text, beauty int, house_level int, online boolean, likes_week bigint)
language plpgsql stable security definer set search_path = '' as $$
declare uid uuid := farm.me(); mine uuid := farm.profile_of(uid);
begin
  return query
  with fr as ( -- my friends: an accepted code, or following each other on Selebox
    select case when f.user_a = uid then f.user_b else f.user_a end as fid
    from farm.friends f where uid in (f.user_a, f.user_b) and f.accepted_at is not null
    union
    select po.auth_user_id from public.follows f1
    join public.follows f2 on f2.follower_id = f1.following_id and f2.following_id = f1.follower_id
    join public.profiles po on po.id = f1.following_id
    where mine is not null and f1.follower_id = mine and po.auth_user_id is not null),
  fo as ( -- people I follow on Selebox
    select po.auth_user_id as fid from public.follows f1 join public.profiles po on po.id = f1.following_id
    where mine is not null and f1.follower_id = mine and po.auth_user_id is not null),
  pick as (
    select pl.user_id, pl.farm_name, pl.last_seen_at, sn.beauty, sn.house_level, sn.updated_at
    from farm.players pl join farm.snapshots sn on sn.user_id = pl.user_id
    where pl.user_id <> uid
      and not exists (select 1 from farm.blocks b where (b.blocker = uid and b.blocked = pl.user_id) or (b.blocker = pl.user_id and b.blocked = uid))
      and (case when p_kind = 'friends' then pl.user_id in (select fr.fid from fr)
                when p_kind = 'following' then pl.user_id in (select fo.fid from fo) and ((pl.listed and not pl.hidden) or pl.user_id in (select fr.fid from fr))
                else pl.listed and not pl.hidden end)
    order by case when p_kind = 'recent' then extract(epoch from sn.updated_at) else sn.beauty end desc
    limit greatest(1, least(p_limit, 50)))
  select p.user_id, p.farm_name, p.beauty, p.house_level, p.last_seen_at > now() - interval '2 minutes',
    (select count(*) from farm.visits v where v.host = p.user_id and v.liked and v.day >= farm.week_of(now()))
  from pick p
  order by case when p_kind = 'recent' then extract(epoch from p.updated_at) else p.beauty end desc;
end $$;

create index if not exists visits_liked on farm.visits (host, day) where liked;
create index if not exists messages_unread on farm.messages (recipient, sender) where read_at is null;
create index if not exists play_days_day on farm.play_days (day);

-- ---------- 6. one purchase at a time ----------
create or replace function public.farm_buy_v1(p_item text, p_currency text, p_price int, p_version int, p_request_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
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

reset lock_timeout;

-- ---------- to undo part 5 ----------
-- Re-run the earlier definitions: farm_leave_v1, farm_visit_v1, farm_report_v1 from farm_online.sql; farm.alert from
-- farm_online_2.sql; farm_list_v1 from farm_online_3.sql; farm_buy_v1 from farm_online_4.sql. Then:
-- drop index if exists farm.visits_liked, farm.messages_unread, farm.play_days_day;
