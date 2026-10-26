-- Harvest Ville online, part 3 (26 Oct 2026). Run AFTER farm_online.sql and farm_online_2.sql.
--   * Selebox follows: people you follow on Selebox who play show up to visit; a mutual follow counts as a farm
--     friend (chat, visits to hidden farms), just like an accepted friend code.
--   * Staff tools: moderators (public.is_moderator()) list the reported farms with the evidence, and clear one,
--     keep it hidden, or reset a rude farm name.
--   * Play tracking: opens and minutes played per player per day (farm_track_v1, sent by the app), and a staff view
--     of players, minutes, new players and how many come back (farm_stats_v1).
-- Additive except farm.are_friends, farm_friends_v1 and farm_list_v1, which are replaced (same rules plus follows).
set lock_timeout = '5s';

-- ---------- Selebox follows ----------
-- The Selebox profile of a farm player (auth id -> profiles.id).
create function farm.profile_of(p_uid uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  select id from public.profiles where auth_user_id = p_uid limit 1;
$$;

-- a follows b on Selebox
create function farm.follows(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.follows f where f.follower_id = farm.profile_of(a) and f.following_id = farm.profile_of(b));
$$;

-- Friends: an accepted friend code, or following each other on Selebox.
create or replace function farm.are_friends(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from farm.friends where user_a = least(a, b) and user_b = greatest(a, b) and accepted_at is not null)
      or (farm.follows(a, b) and farm.follows(b, a));
$$;
revoke all on function farm.profile_of(uuid), farm.follows(uuid, uuid), farm.are_friends(uuid, uuid) from public, anon, authenticated;

-- Friends now also lists mutual Selebox follows (via 'selebox'; no request to answer or friendship to end there).
drop function public.farm_friends_v1();
create function public.farm_friends_v1()
returns table (id uuid, farm_name text, status text, online boolean, unread bigint, via text)
language sql stable security definer set search_path = '' as $$
  with me as (select farm.me() as uid),
  coded as (
    select pl.user_id, pl.farm_name,
      case when f.accepted_at is not null then 'friend' when f.requested_by = me.uid then 'sent' else 'request' end as status,
      pl.last_seen_at, 'code'::text as via, (f.accepted_at is null) as pending
    from me join farm.friends f on me.uid in (f.user_a, f.user_b)
    join farm.players pl on pl.user_id = case when f.user_a = me.uid then f.user_b else f.user_a end),
  followed as (
    select pl.user_id, pl.farm_name, 'friend'::text, pl.last_seen_at, 'selebox'::text, false
    from me, public.follows f1
    join public.profiles po on po.id = f1.following_id
    join farm.players pl on pl.user_id = po.auth_user_id
    where f1.follower_id = farm.profile_of(me.uid)
      and exists (select 1 from public.follows f2 where f2.follower_id = f1.following_id and f2.following_id = f1.follower_id)
      and pl.user_id <> me.uid
      and not exists (select 1 from coded c where c.user_id = pl.user_id)
    limit 200)
  select x.user_id, x.farm_name, x.status, x.last_seen_at > now() - interval '2 minutes',
    (select count(*) from farm.messages m, me where m.recipient = me.uid and m.sender = x.user_id and m.read_at is null), x.via
  from (select user_id, farm_name, status, last_seen_at, via, pending from coded union all select * from followed) x, me
  where not farm.blocked(me.uid, x.user_id)
  order by x.pending desc, x.last_seen_at desc;
$$;
revoke all on function public.farm_friends_v1() from public, anon;
grant execute on function public.farm_friends_v1() to authenticated;

-- Farms to visit: 'popular', 'recent', 'friends', or 'following' (people you follow on Selebox who play).
create or replace function public.farm_list_v1(p_kind text default 'popular', p_limit int default 30)
returns table (id uuid, farm_name text, beauty int, house_level int, online boolean, likes_week bigint)
language plpgsql stable security definer set search_path = '' as $$
declare uid uuid := farm.me();
begin
  return query
  select pl.user_id, pl.farm_name, sn.beauty, sn.house_level, pl.last_seen_at > now() - interval '2 minutes',
    (select count(*) from farm.visits v where v.host = pl.user_id and v.liked and v.day >= farm.week_of(now()))
  from farm.players pl join farm.snapshots sn on sn.user_id = pl.user_id
  where pl.user_id <> uid and not farm.blocked(uid, pl.user_id)
    and (case when p_kind = 'friends' then farm.are_friends(uid, pl.user_id)
              when p_kind = 'following' then farm.follows(uid, pl.user_id) and (pl.listed and not pl.hidden or farm.are_friends(uid, pl.user_id))
              else pl.listed and not pl.hidden end)
  order by case when p_kind = 'recent' then extract(epoch from sn.updated_at) else sn.beauty end desc
  limit greatest(1, least(p_limit, 50));
end $$;

-- ---------- staff tools ----------
-- The farms with open reports: who, how many people reported them, why, and what the server saw (name, messages).
create function public.farm_reports_v1()
returns table (id uuid, farm_name text, hidden boolean, reporters bigint, reasons text, notes text, evidence jsonb, last_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_moderator() then raise exception 'staff only' using errcode = '42501'; end if;
  return query
  select pl.user_id, pl.farm_name, pl.hidden, count(distinct r.reporter),
    string_agg(distinct r.reason, ', '), string_agg(r.note, ' | ') filter (where r.note is not null),
    (array_agg(r.evidence order by r.created_at desc))[1], max(r.created_at)
  from farm.reports r join farm.players pl on pl.user_id = r.target
  where r.status = 'open'
  group by pl.user_id, pl.farm_name, pl.hidden
  order by pl.hidden desc, count(distinct r.reporter) desc, max(r.created_at) desc
  limit 100;
end $$;

-- A moderator's decision on a reported farm: 'clear' (show it again, the reports were wrong), 'keep' (keep it
-- hidden), 'rename' (give it a plain name and show it again). Closes its open reports either way.
create function public.farm_moderate_v1(p_target uuid, p_action text)
returns text language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_moderator() then raise exception 'staff only' using errcode = '42501'; end if;
  if p_action not in ('clear', 'keep', 'rename') then return 'bad'; end if;
  if not exists (select 1 from farm.players where user_id = p_target) then return 'none'; end if;
  if p_action = 'clear' then update farm.players set hidden = false where user_id = p_target;
  elsif p_action = 'keep' then update farm.players set hidden = true where user_id = p_target;
  else update farm.players set farm_name = 'Farm ' || left(friend_code, 4), hidden = false where user_id = p_target;
  end if;
  update farm.reports set status = case when p_action = 'clear' then 'cleared' else 'actioned' end
  where target = p_target and status = 'open';
  return 'ok';
end $$;

-- ---------- play tracking ----------
create table farm.play_days (
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null,
  opens int not null default 0 check (opens between 0 and 1000),
  minutes int not null default 0 check (minutes between 0 and 1440),
  primary key (user_id, day)
);
alter table farm.play_days enable row level security;
revoke all on farm.play_days from public, anon, authenticated;

-- The app reports a visit to the game: an open, and the minutes played (capped per call and per day).
create function public.farm_track_v1(p_opens int default 0, p_minutes int default 0)
returns void language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); today date := (now() at time zone 'Asia/Manila')::date;
begin
  if uid is null then raise exception 'not signed in' using errcode = '28000'; end if;
  insert into farm.play_days (user_id, day, opens, minutes)
  values (uid, today, greatest(0, least(coalesce(p_opens, 0), 1)), greatest(0, least(coalesce(p_minutes, 0), 240)))
  on conflict (user_id, day) do update set
    opens = least(1000, farm.play_days.opens + excluded.opens),
    minutes = least(1440, farm.play_days.minutes + excluded.minutes);
end $$;

-- Staff: the last p_days days — players, new players, total and average minutes, and how many of that day's new
-- players came back the next day and within 7 days.
create function public.farm_stats_v1(p_days int default 14)
returns table (day date, players bigint, new_players bigint, minutes bigint, avg_minutes numeric, back_next_day bigint, back_in_7_days bigint)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_moderator() then raise exception 'staff only' using errcode = '42501'; end if;
  return query
  with first as (select pd.user_id, min(pd.day) as d0 from farm.play_days pd group by pd.user_id),
  days as (select generate_series((now() at time zone 'Asia/Manila')::date - greatest(1, least(p_days, 60)) + 1,
                                  (now() at time zone 'Asia/Manila')::date, interval '1 day')::date as d)
  select days.d,
    (select count(*) from farm.play_days p where p.day = days.d),
    (select count(*) from first f where f.d0 = days.d),
    (select coalesce(sum(p.minutes), 0) from farm.play_days p where p.day = days.d),
    (select round(avg(p.minutes), 1) from farm.play_days p where p.day = days.d),
    (select count(*) from first f where f.d0 = days.d and exists (select 1 from farm.play_days p where p.user_id = f.user_id and p.day = days.d + 1)),
    (select count(*) from first f where f.d0 = days.d and exists (select 1 from farm.play_days p where p.user_id = f.user_id and p.day > days.d and p.day <= days.d + 7))
  from days order by days.d desc;
end $$;

do $$
declare f text;
begin
  foreach f in array array['farm_reports_v1()', 'farm_moderate_v1(uuid, text)', 'farm_track_v1(int, int)', 'farm_stats_v1(int)']
  loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;

reset lock_timeout;

-- ---------- to undo part 3 ----------
-- drop function if exists public.farm_reports_v1(), public.farm_moderate_v1(uuid, text), public.farm_track_v1(int, int),
--   public.farm_stats_v1(int);
-- drop table if exists farm.play_days;
-- (farm.are_friends / farm_friends_v1 / farm_list_v1: re-run their part-1 definitions from farm_online.sql;
--  then drop function farm.follows(uuid, uuid), farm.profile_of(uuid))
