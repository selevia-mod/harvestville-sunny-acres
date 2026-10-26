-- Sunny Acres online (Phase 4): visiting farms, likes and gifts, weekly leaderboards, friends and messages, and
-- seeing each other live on a farm.
--
-- What this ADDS (nothing existing is changed or removed):
--   * schema  farm            6 tables, Row Level Security on, NO policies and NO grants: the app's clients can't
--                             read or write them directly.
--   * functions public.farm_*_v1   the only way in. SECURITY DEFINER with an empty search_path, every one checks
--                             auth.uid(), and they are granted to signed-in users only (not anon).
--   * 2 policies on realtime.messages   for private channels named 'farm:<farm id>' only. Policies add access,
--                             they can't take any away, so the existing chat channels are not affected.
--
-- Safety and fairness (added 26 Oct 2026, before the first apply):
--   * Block (farm.blocks): a blocked player can't see, visit, message or friend you, or join your farm's channel.
--   * Report (farm.reports): a farm name or messages, with the evidence copied on the server. A farm reported by 3
--     different players in 7 days is hidden from the lists and ranks (farm.players.hidden) until a moderator clears it.
--   * Words (farm.words): farm names and messages are checked against this list (edit it with plain SQL).
--   * Ranks: the weekly gold earned and daily quests a player can post are capped by the real time since Monday.
--   * Cloud saves (farm.saves, farm_save_put_v1 / farm_save_get_v1): the app keeps a copy of each player's save, so a
--     farm survives a new phone. They need only a sign-in, not online play.
--   * farm_clock_v1: the server's time, so the app can run the game on it instead of the phone's clock.
--
-- Undo everything:  drop schema farm cascade;  drop function public.farm_...;  drop policy farm_topic_recv / farm_topic_send
--                   on realtime.messages;  (see the bottom of this file)

-- (run as one migration: it all goes in, or none of it does)

create schema farm;
revoke all on schema farm from public, anon, authenticated;

-- ---------- tables ----------

-- A player: anyone signed in (an existing app account or a guest) who opens the online menu.
create table farm.players (
  user_id uuid primary key references auth.users (id) on delete cascade,
  farm_name text not null check (char_length(btrim(farm_name)) between 1 and 24),
  friend_code text not null unique check (friend_code ~ '^[A-HJ-NP-Z2-9]{8}$'),
  listed boolean not null default true, -- shows up in "Visit a farm"
  hidden boolean not null default false, -- hidden from lists and ranks after reports, until a moderator clears it
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

-- The farm as visitors see it: the house, the furniture, the yard (no inventory, gold or progress).
create table farm.snapshots (
  user_id uuid primary key references farm.players (user_id) on delete cascade,
  data jsonb not null check (octet_length(data::text) <= 32768),
  beauty integer not null default 0 check (beauty between 0 and 100000),
  house_level integer not null default 1 check (house_level between 1 and 50),
  updated_at timestamptz not null default now()
);
create index snapshots_beauty on farm.snapshots (beauty desc);
create index snapshots_updated on farm.snapshots (updated_at desc);

-- One row per visitor per farm per day: the like and the gift left there.
create table farm.visits (
  host uuid not null references farm.players (user_id) on delete cascade,
  visitor uuid not null references farm.players (user_id) on delete cascade,
  day date not null default ((now() at time zone 'utc')::date),
  liked boolean not null default false,
  gift text check (gift in ('gold', 'star')),
  collected boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (host, visitor, day),
  check (host <> visitor)
);
create index visits_waiting on farm.visits (host) where gift is not null and not collected;
create index visits_by_visitor on farm.visits (visitor, day);
create index visits_recent on farm.visits (host, created_at desc);

-- Weekly scores for the leaderboards (week = that week's Monday, UTC).
create table farm.scores (
  user_id uuid not null references farm.players (user_id) on delete cascade,
  week date not null,
  beauty integer not null default 0 check (beauty between 0 and 100000),
  earned bigint not null default 0 check (earned between 0 and 100000000),
  quests integer not null default 0 check (quests between 0 and 10000),
  updated_at timestamptz not null default now(),
  primary key (user_id, week)
);
create index scores_beauty on farm.scores (week, beauty desc);
create index scores_earned on farm.scores (week, earned desc);
create index scores_quests on farm.scores (week, quests desc);

-- Friends: one row per pair (user_a < user_b); accepted_at null = a request waiting for an answer.
create table farm.friends (
  user_a uuid not null references farm.players (user_id) on delete cascade,
  user_b uuid not null references farm.players (user_id) on delete cascade,
  requested_by uuid not null,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (user_a, user_b),
  check (user_a < user_b),
  check (requested_by in (user_a, user_b))
);
create index friends_b on farm.friends (user_b);

-- Short messages between friends.
create table farm.messages (
  id bigint generated always as identity primary key,
  sender uuid not null references farm.players (user_id) on delete cascade,
  recipient uuid not null references farm.players (user_id) on delete cascade,
  body text not null check (char_length(body) between 1 and 200),
  created_at timestamptz not null default now(),
  read_at timestamptz,
  check (sender <> recipient)
);
create index messages_inbox on farm.messages (recipient, created_at desc);
create index messages_sent on farm.messages (sender, created_at desc);

-- Blocks: blocker no longer sees blocked, and blocked can't reach blocker (both ways in practice).
create table farm.blocks (
  blocker uuid not null references farm.players (user_id) on delete cascade,
  blocked uuid not null references farm.players (user_id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker, blocked),
  check (blocker <> blocked)
);
create index blocks_blocked on farm.blocks (blocked);

-- Reports for moderators. evidence = what the server saw at report time (the farm name, the target's last messages
-- to the reporter), so a report can't be faked by the reporter and survives the target deleting things.
create table farm.reports (
  id bigint generated always as identity primary key,
  reporter uuid not null references auth.users (id) on delete cascade,
  target uuid not null references auth.users (id) on delete cascade,
  reason text not null check (reason in ('name', 'messages', 'other')),
  note text check (char_length(note) <= 200),
  evidence jsonb not null default '{}'::jsonb,
  status text not null default 'open' check (status in ('open', 'cleared', 'actioned')),
  created_at timestamptz not null default now(),
  check (reporter <> target)
);
create index reports_target on farm.reports (target, created_at desc);
create index reports_open on farm.reports (created_at desc) where status = 'open';

-- Words not allowed in farm names and messages. whole = match only as a whole word (short words that hide inside
-- ordinary ones); otherwise anywhere in the text. Letters are compared after simple look-alike folding (0->o, 1->i...).
create table farm.words (
  word text primary key check (word ~ '^[a-z ]{3,24}$'),
  whole boolean not null default true
);
insert into farm.words (word, whole) values
  ('fuck', false), ('shit', false), ('bitch', false), ('cunt', false), ('nigger', false), ('nigga', false),
  ('faggot', false), ('whore', false), ('slut', false), ('pussy', false), ('porn', false), ('asshole', false),
  ('motherfucker', false), ('dick', true), ('rape', true), ('rapist', true), ('penis', true),
  ('vagina', true), ('sex', true), ('nude', true), ('nudes', true), ('boobs', true),
  ('tangina', false), ('tang ina', false), ('putangina', false), ('putang', false), ('kantot', false),
  ('kantutan', false), ('hindot', false), ('jakol', false), ('pakyu', false), ('pakshet', false), ('tarantado', false),
  ('puta', true), ('gago', true), ('ulol', true), ('ulul', true), ('bobo', true), ('tanga', true),
  ('pokpok', true), ('puke', true), ('titi', true), ('burat', true), ('kupal', true), ('punyeta', true);

-- A copy of each player's game save, for a new phone (the app writes it; newest wins by the time it was saved).
create table farm.saves (
  user_id uuid primary key references auth.users (id) on delete cascade,
  data jsonb not null check (octet_length(data::text) <= 20000),
  saved_at timestamptz not null,
  updated_at timestamptz not null default now()
);

alter table farm.players enable row level security;
alter table farm.snapshots enable row level security;
alter table farm.visits enable row level security;
alter table farm.scores enable row level security;
alter table farm.friends enable row level security;
alter table farm.messages enable row level security;
alter table farm.blocks enable row level security;
alter table farm.reports enable row level security;
alter table farm.words enable row level security;
alter table farm.saves enable row level security;
revoke all on all tables in schema farm from public, anon, authenticated;
revoke all on all sequences in schema farm from public, anon, authenticated;

-- ---------- helpers (not callable by clients) ----------

-- The signed-in player, or an error. Banned or suspended app accounts can't play online.
create function farm.me() returns uuid
language plpgsql stable security definer set search_path = '' as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not signed in' using errcode = '28000'; end if;
  if exists (select 1 from public.profiles p where p.auth_user_id = uid and (p.is_banned or p.suspended_until > now())) then
    raise exception 'account suspended' using errcode = '42501';
  end if;
  if not exists (select 1 from farm.players where user_id = uid) then
    raise exception 'join first' using errcode = 'P0002';
  end if;
  return uid;
end $$;

create function farm.week_of(t timestamptz) returns date
language sql stable set search_path = '' as $$
  select ((t at time zone 'utc')::date - ((extract(isodow from (t at time zone 'utc')) - 1)::int));
$$;

create function farm.are_friends(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from farm.friends where user_a = least(a, b) and user_b = greatest(a, b) and accepted_at is not null);
$$;

-- Either of the two blocked the other.
create function farm.blocked(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from farm.blocks where (blocker = a and blocked = b) or (blocker = b and blocked = a));
$$;

-- Text a player may show to others: no word from farm.words (after folding look-alike characters and spacing).
create function farm.clean_ok(t text) returns boolean
language sql stable security definer set search_path = '' as $$
  with f as (select translate(lower(coalesce(t, '')), '0134578@$!|', 'oieastbasii') as x)
  select not exists (
    select 1 from farm.words w, f
    where case when w.whole then f.x ~ ('(^|[^a-z])' || w.word || '([^a-z]|$)') else f.x like '%' || w.word || '%' end);
$$;

revoke all on function farm.me(), farm.week_of(timestamptz), farm.are_friends(uuid, uuid), farm.blocked(uuid, uuid), farm.clean_ok(text)
  from public, anon, authenticated;

-- ---------- the functions the game calls ----------

-- Join (or rename): makes the player row with a friend code. The name defaults to the app's display name.
create function public.farm_join_v1(p_farm_name text default null)
returns json language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  nm text;
  code text;
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  tries int := 0;
begin
  if uid is null then raise exception 'not signed in' using errcode = '28000'; end if;
  if exists (select 1 from public.profiles p where p.auth_user_id = uid and (p.is_banned or p.suspended_until > now())) then
    raise exception 'account suspended' using errcode = '42501';
  end if;
  if p_farm_name is not null and not farm.clean_ok(p_farm_name) then
    raise exception 'name not allowed' using errcode = '22023';
  end if;
  nm := left(btrim(coalesce(nullif(btrim(p_farm_name), ''),
    (select coalesce(nullif(btrim(p.display_name), ''), p.username) from public.profiles p where p.auth_user_id = uid limit 1),
    'Sunny Acres')), 24);
  if not farm.clean_ok(nm) then nm := 'Sunny Acres'; end if;
  if exists (select 1 from farm.players where user_id = uid) then
    if p_farm_name is not null then update farm.players set farm_name = nm, last_seen_at = now() where user_id = uid; end if;
  else
    loop
      code := '';
      for i in 1..8 loop code := code || substr(alphabet, 1 + floor(random() * 32)::int, 1); end loop;
      begin
        insert into farm.players (user_id, farm_name, friend_code) values (uid, nm, code);
        exit;
      exception when unique_violation then
        tries := tries + 1;
        if tries > 5 then raise; end if;
      end;
    end loop;
  end if;
  return (select json_build_object('id', user_id, 'farm_name', farm_name, 'friend_code', friend_code, 'listed', listed)
          from farm.players where user_id = uid);
end $$;

-- Publish my farm (house, furniture, yard) and this week's scores. At most once every 30 seconds.
-- The week's scores are capped by the real time since Monday (UTC): at most 10,000G + 2,500G an hour earned (an
-- active player earns about 5,000G a day) and 10 daily quests a day, so a changed clock or game can't top the ranks.
create function public.farm_publish_v1(p_data jsonb, p_beauty int, p_house_level int, p_earned_week bigint, p_quests_week int)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := farm.me();
  hrs numeric := extract(epoch from (now() - (farm.week_of(now())::timestamp at time zone 'utc'))) / 3600;
begin
  p_earned_week := least(p_earned_week, (10000 + 2500 * hrs)::bigint);
  p_quests_week := least(p_quests_week, (10 * ceil(greatest(hrs, 1) / 24))::int);
  if exists (select 1 from farm.snapshots where user_id = uid and updated_at > now() - interval '30 seconds') then return false; end if;
  insert into farm.snapshots (user_id, data, beauty, house_level, updated_at)
  values (uid, p_data, greatest(0, least(p_beauty, 100000)), greatest(1, least(p_house_level, 50)), now())
  on conflict (user_id) do update set data = excluded.data, beauty = excluded.beauty, house_level = excluded.house_level, updated_at = now();
  insert into farm.scores (user_id, week, beauty, earned, quests)
  values (uid, farm.week_of(now()), greatest(0, least(p_beauty, 100000)), greatest(0, least(p_earned_week, 100000000)), greatest(0, least(p_quests_week, 10000)))
  on conflict (user_id, week) do update set
    beauty = excluded.beauty, earned = greatest(farm.scores.earned, excluded.earned), quests = greatest(farm.scores.quests, excluded.quests), updated_at = now();
  update farm.players set last_seen_at = now() where user_id = uid;
  return true;
end $$;

-- I'm still here (every minute while the game is open), so friends see me as online.
create function public.farm_heartbeat_v1()
returns void language sql security definer set search_path = '' as $$
  update farm.players set last_seen_at = now() where user_id = farm.me();
$$;

-- Farms to visit: 'popular' (most beautiful), 'recent' (just updated) or 'friends'.
create function public.farm_list_v1(p_kind text default 'popular', p_limit int default 30)
returns table (id uuid, farm_name text, beauty int, house_level int, online boolean, likes_week bigint)
language plpgsql stable security definer set search_path = '' as $$
declare uid uuid := farm.me();
begin
  return query
  select pl.user_id, pl.farm_name, sn.beauty, sn.house_level, pl.last_seen_at > now() - interval '2 minutes',
    (select count(*) from farm.visits v where v.host = pl.user_id and v.liked and v.day >= farm.week_of(now()))
  from farm.players pl join farm.snapshots sn on sn.user_id = pl.user_id
  where pl.user_id <> uid and not farm.blocked(uid, pl.user_id)
    and (case when p_kind = 'friends' then farm.are_friends(uid, pl.user_id) else pl.listed and not pl.hidden end)
  order by case when p_kind = 'recent' then extract(epoch from sn.updated_at) else sn.beauty end desc
  limit greatest(1, least(p_limit, 50));
end $$;

-- Open a farm: its snapshot, and my like and gift there today. Counts as a visit.
create function public.farm_visit_v1(p_host uuid)
returns json language plpgsql security definer set search_path = '' as $$
declare uid uuid := farm.me(); out json;
begin
  if p_host = uid then raise exception 'that is your own farm' using errcode = '22023'; end if;
  if not exists (select 1 from farm.snapshots where user_id = p_host) or farm.blocked(uid, p_host) then
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

-- Like a farm I'm visiting (once a day each).
create function public.farm_like_v1(p_host uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare uid uuid := farm.me();
begin
  update farm.visits set liked = true
  where host = p_host and visitor = uid and day = (now() at time zone 'utc')::date and not liked;
  return found;
end $$;

-- Leave a gift: 'gold' (up to 5 farms a day) or 'star' (1 farm a day). One gift per farm per day.
create function public.farm_gift_v1(p_host uuid, p_gift text)
returns text language plpgsql security definer set search_path = '' as $$
declare uid uuid := farm.me(); today date := (now() at time zone 'utc')::date;
begin
  if p_gift not in ('gold', 'star') then return 'bad'; end if;
  if p_gift = 'gold' and (select count(*) from farm.visits where visitor = uid and day = today and gift = 'gold') >= 5 then return 'limit'; end if;
  if p_gift = 'star' and exists (select 1 from farm.visits where visitor = uid and day = today and gift = 'star') then return 'limit'; end if;
  update farm.visits set gift = p_gift where host = p_host and visitor = uid and day = today and gift is null;
  return case when found then 'ok' else 'already' end;
end $$;

-- The gifts visitors left me (collected once): how many of each, and from whom.
create function public.farm_collect_v1()
returns json language plpgsql security definer set search_path = '' as $$
declare uid uuid := farm.me(); out json;
begin
  with taken as (
    update farm.visits v set collected = true
    where v.host = uid and v.gift is not null and not v.collected
    returning v.gift, v.visitor)
  select json_build_object(
    'gold', count(*) filter (where gift = 'gold'), 'stars', count(*) filter (where gift = 'star'),
    'from', coalesce(json_agg(distinct pl.farm_name), '[]'::json))
  into out from taken t join farm.players pl on pl.user_id = t.visitor;
  return out;
end $$;

-- Who visited my farm in the last 7 days.
create function public.farm_visitors_v1()
returns table (id uuid, farm_name text, day date, liked boolean, gift text)
language sql stable security definer set search_path = '' as $$
  select pl.user_id, pl.farm_name, v.day, v.liked, v.gift
  from farm.visits v join farm.players pl on pl.user_id = v.visitor
  where v.host = farm.me() and v.day > (now() at time zone 'utc')::date - 7 and not farm.blocked(v.host, v.visitor)
  order by v.created_at desc limit 50;
$$;

-- This week's top 50 by 'beauty', 'earned' or 'quests', plus my own rank.
create function public.farm_leaderboard_v1(p_kind text default 'beauty')
returns table (rank bigint, id uuid, farm_name text, score bigint, me boolean)
language plpgsql stable security definer set search_path = '' as $$
declare uid uuid := farm.me(); wk date := farm.week_of(now());
begin
  if p_kind not in ('beauty', 'earned', 'quests') then raise exception 'bad kind' using errcode = '22023'; end if;
  return query
  with ranked as (
    select s.user_id, pl.farm_name,
      (case p_kind when 'beauty' then s.beauty::bigint when 'earned' then s.earned else s.quests::bigint end) as score
    from farm.scores s join farm.players pl on pl.user_id = s.user_id
    where s.week = wk and (not pl.hidden or pl.user_id = uid) and not farm.blocked(uid, pl.user_id)),
  numbered as (select r.*, rank() over (order by r.score desc) as rk from ranked r)
  select n.rk, n.user_id, n.farm_name, n.score, n.user_id = uid
  from numbered n where n.rk <= 50 or n.user_id = uid
  order by n.rk limit 51;
end $$;

-- Friends: add by friend code (or accept their request), answer a request, list them.
create function public.farm_friend_add_v1(p_code text)
returns text language plpgsql security definer set search_path = '' as $$
declare uid uuid := farm.me(); other uuid; fr farm.friends;
begin
  select user_id into other from farm.players where friend_code = upper(btrim(p_code));
  if other is null or farm.blocked(uid, other) then return 'nocode'; end if;
  if other = uid then return 'self'; end if;
  if (select count(*) from farm.friends where (user_a = uid or user_b = uid)) >= 200 then return 'limit'; end if;
  select * into fr from farm.friends where user_a = least(uid, other) and user_b = greatest(uid, other);
  if fr.user_a is null then
    insert into farm.friends (user_a, user_b, requested_by) values (least(uid, other), greatest(uid, other), uid);
    return 'requested';
  end if;
  if fr.accepted_at is not null then return 'already'; end if;
  if fr.requested_by = other then
    update farm.friends set accepted_at = now() where user_a = fr.user_a and user_b = fr.user_b;
    return 'friends';
  end if;
  return 'waiting';
end $$;

create function public.farm_friend_answer_v1(p_other uuid, p_accept boolean)
returns text language plpgsql security definer set search_path = '' as $$
declare uid uuid := farm.me();
begin
  if p_accept then
    update farm.friends set accepted_at = now()
    where user_a = least(uid, p_other) and user_b = greatest(uid, p_other) and requested_by = p_other and accepted_at is null;
    return case when found then 'friends' else 'none' end;
  end if;
  delete from farm.friends where user_a = least(uid, p_other) and user_b = greatest(uid, p_other);
  return 'removed';
end $$;

create function public.farm_friends_v1()
returns table (id uuid, farm_name text, status text, online boolean, unread bigint)
language sql stable security definer set search_path = '' as $$
  with me as (select farm.me() as uid)
  select pl.user_id, pl.farm_name,
    case when f.accepted_at is not null then 'friend' when f.requested_by = me.uid then 'sent' else 'request' end,
    pl.last_seen_at > now() - interval '2 minutes',
    (select count(*) from farm.messages m where m.recipient = me.uid and m.sender = pl.user_id and m.read_at is null)
  from me join farm.friends f on me.uid in (f.user_a, f.user_b)
  join farm.players pl on pl.user_id = case when f.user_a = me.uid then f.user_b else f.user_a end
  order by (f.accepted_at is null) desc, pl.last_seen_at desc;
$$;

-- Messages between friends: send (up to 50 a day), and read a conversation (marks it read).
create function public.farm_message_send_v1(p_to uuid, p_body text)
returns text language plpgsql security definer set search_path = '' as $$
declare uid uuid := farm.me(); msg text := left(btrim(p_body), 200);
begin
  if msg = '' then return 'empty'; end if;
  if not farm.are_friends(uid, p_to) or farm.blocked(uid, p_to) then return 'notfriends'; end if;
  if not farm.clean_ok(msg) then return 'word'; end if;
  if (select count(*) from farm.messages m where m.sender = uid and m.created_at > now() - interval '1 day') >= 50 then return 'limit'; end if;
  insert into farm.messages (sender, recipient, body) values (uid, p_to, msg);
  return 'ok';
end $$;

create function public.farm_messages_v1(p_with uuid)
returns table (id bigint, mine boolean, body text, created_at timestamptz)
language plpgsql security definer set search_path = '' as $$
declare uid uuid := farm.me();
begin
  update farm.messages m set read_at = now() where m.recipient = uid and m.sender = p_with and m.read_at is null;
  return query
  select m.id, m.sender = uid, m.body, m.created_at from farm.messages m
  where (m.sender = uid and m.recipient = p_with) or (m.sender = p_with and m.recipient = uid)
  order by m.created_at desc limit 50;
end $$;

-- Hide my farm from the public lists (friends can still visit), or leave online play and delete it all.
create function public.farm_set_listed_v1(p_listed boolean)
returns void language sql security definer set search_path = '' as $$
  update farm.players set listed = p_listed where user_id = farm.me();
$$;

create function public.farm_leave_v1()
returns void language sql security definer set search_path = '' as $$
  delete from farm.players where user_id = farm.me();
$$;

-- For the realtime channels: may this user use the channel 'farm:<id>'? (Any player may visit a listed farm;
-- unlisted farms only their owner and friends.)
create function public.farm_topic_ok_v1(p_topic text)
returns boolean language plpgsql stable security definer set search_path = '' as $$
declare uid uuid := auth.uid(); host uuid;
begin
  if uid is null or p_topic is null or p_topic !~ '^farm:[0-9a-f-]{36}$' then return false; end if;
  if not exists (select 1 from farm.players where user_id = uid) then return false; end if;
  host := substr(p_topic, 6)::uuid;
  if host <> uid and farm.blocked(uid, host) then return false; end if;
  return exists (select 1 from farm.players where user_id = host and (listed or user_id = uid or farm.are_friends(uid, host)));
end $$;

-- Block or unblock a player. Blocking also ends a friendship (and any request) between you.
create function public.farm_block_v1(p_other uuid, p_block boolean)
returns text language plpgsql security definer set search_path = '' as $$
declare uid uuid := farm.me();
begin
  if p_other = uid then return 'self'; end if;
  if not p_block then
    delete from farm.blocks where blocker = uid and blocked = p_other;
    return 'unblocked';
  end if;
  if not exists (select 1 from farm.players where user_id = p_other) then return 'none'; end if;
  if (select count(*) from farm.blocks where blocker = uid) >= 500 then return 'limit'; end if;
  insert into farm.blocks (blocker, blocked) values (uid, p_other) on conflict do nothing;
  delete from farm.friends where user_a = least(uid, p_other) and user_b = greatest(uid, p_other);
  return 'blocked';
end $$;

-- The players I blocked (for the Me tab, and so the game hides them on a farm).
create function public.farm_blocked_v1()
returns table (id uuid, farm_name text, created_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select pl.user_id, pl.farm_name, b.created_at from farm.blocks b join farm.players pl on pl.user_id = b.blocked
  where b.blocker = farm.me() order by b.created_at desc limit 500;
$$;

-- Report a player's farm name, messages, or something else. One report per player per day; 20 a day in all.
-- 3 different reporters in 7 days hide the farm from lists and ranks until a moderator clears it.
create function public.farm_report_v1(p_target uuid, p_reason text, p_note text default null)
returns text language plpgsql security definer set search_path = '' as $$
declare uid uuid := farm.me(); ev jsonb;
begin
  if p_target = uid then return 'self'; end if;
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

-- Cloud saves: keep the newest copy (by when the game saved it, on the server's clock as the app sees it).
create function public.farm_save_put_v1(p_data jsonb, p_saved_at timestamptz)
returns text language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); at timestamptz := least(p_saved_at, now() + interval '5 minutes');
begin
  if uid is null then raise exception 'not signed in' using errcode = '28000'; end if;
  if p_data is null or jsonb_typeof(p_data) <> 'object' then return 'bad'; end if;
  if octet_length(p_data::text) > 20000 then return 'big'; end if;
  if exists (select 1 from farm.saves where user_id = uid and saved_at > at) then return 'older'; end if;
  insert into farm.saves (user_id, data, saved_at, updated_at) values (uid, p_data, at, now())
  on conflict (user_id) do update set data = excluded.data, saved_at = excluded.saved_at, updated_at = now();
  return 'ok';
end $$;

create function public.farm_save_get_v1()
returns json language plpgsql stable security definer set search_path = '' as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not signed in' using errcode = '28000'; end if;
  return (select json_build_object('data', data, 'saved_at', saved_at) from farm.saves where user_id = uid);
end $$;

-- The server's clock in milliseconds: the app runs the game on it, so changing the phone's clock changes nothing.
create function public.farm_clock_v1()
returns bigint language sql stable security definer set search_path = '' as $$
  select (extract(epoch from clock_timestamp()) * 1000)::bigint;
$$;

-- Only signed-in users can call these (not anon, not public).
do $$
declare f text;
begin
  foreach f in array array[
    'farm_join_v1(text)', 'farm_publish_v1(jsonb, int, int, bigint, int)', 'farm_heartbeat_v1()', 'farm_list_v1(text, int)',
    'farm_visit_v1(uuid)', 'farm_like_v1(uuid)', 'farm_gift_v1(uuid, text)', 'farm_collect_v1()', 'farm_visitors_v1()',
    'farm_leaderboard_v1(text)', 'farm_friend_add_v1(text)', 'farm_friend_answer_v1(uuid, boolean)', 'farm_friends_v1()',
    'farm_message_send_v1(uuid, text)', 'farm_messages_v1(uuid)', 'farm_set_listed_v1(boolean)', 'farm_leave_v1()',
    'farm_topic_ok_v1(text)', 'farm_block_v1(uuid, boolean)', 'farm_blocked_v1()', 'farm_report_v1(uuid, text, text)',
    'farm_save_put_v1(jsonb, timestamptz)', 'farm_save_get_v1()', 'farm_clock_v1()']
  loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;

-- ---------- seeing each other live: private realtime channels 'farm:<farm id>' ----------
-- (Positions and emotes are broadcast between the people on the same farm; nothing is stored.)
create policy farm_topic_recv on realtime.messages for select to authenticated
  using (realtime.topic() like 'farm:%' and public.farm_topic_ok_v1(realtime.topic()));
create policy farm_topic_send on realtime.messages for insert to authenticated
  with check (realtime.topic() like 'farm:%' and public.farm_topic_ok_v1(realtime.topic()));

-- ---------- to undo all of it ----------
-- begin;
-- drop policy if exists farm_topic_recv on realtime.messages;
-- drop policy if exists farm_topic_send on realtime.messages;
-- drop function if exists public.farm_join_v1(text), public.farm_publish_v1(jsonb, int, int, bigint, int), public.farm_heartbeat_v1(),
--   public.farm_list_v1(text, int), public.farm_visit_v1(uuid), public.farm_like_v1(uuid), public.farm_gift_v1(uuid, text),
--   public.farm_collect_v1(), public.farm_visitors_v1(), public.farm_leaderboard_v1(text), public.farm_friend_add_v1(text),
--   public.farm_friend_answer_v1(uuid, boolean), public.farm_friends_v1(), public.farm_message_send_v1(uuid, text),
--   public.farm_messages_v1(uuid), public.farm_set_listed_v1(boolean), public.farm_leave_v1(), public.farm_topic_ok_v1(text),
--   public.farm_block_v1(uuid, boolean), public.farm_blocked_v1(), public.farm_report_v1(uuid, text, text),
--   public.farm_save_put_v1(jsonb, timestamptz), public.farm_save_get_v1(), public.farm_clock_v1();
-- drop schema if exists farm cascade;
-- commit;
