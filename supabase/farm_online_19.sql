-- Harvest Ville online, part 19 (6 Nov 2026). Run AFTER part 18 (it needs part 1's farm.players, farm.blocked,
-- farm.are_friends and farm_topic_ok_v1, part 3's farm.are_friends with follows, and part 18's farm_line_keys_v1).
-- Central Park (owner, 6 Nov 2026): one open place in town for EVERY player, not anyone's farm. You walk in from town
-- and see everyone else there, talk and hang out. 30 people per park, in three parks (Park 1, Park 2, Park 3, like
-- an online game's channels), so a crowd never gets too big for a phone. The live channels are 'park:1' to 'park:3'.
--   * A seat (farm.park_seats) says which park you are in. It counts only while the game says "still here" every
--     30 s (seen in the last 75 s), so a phone that closes or drops never keeps a seat from anyone.
--   * Join picks for you, if you like: the park where a friend of yours is (and there is room), else the lowest
--     park with room, so Park 1 fills first and feels alive. A full park says so, with how many are in each.
--   * Anyone signed in with a farm may use the park channels. Each message is signed for each pair by part 18's
--     keys, and those keys skip players who blocked each other, so a blocked player is never seen or heard there.
-- Additive: one new table, four new functions, two new policies on realtime.messages (for 'park:%' topics only:
-- policies add access, they take none away, so the farm channels and the app's chats are not affected), and
-- farm_topic_ok_v1 REPLACED with every farm-channel rule exactly as it was, plus the park channels. Safe to run twice.
-- The policies take a short exclusive lock on realtime.messages: they come last, and the lock_timeout below gives up
-- (and the whole part rolls back) rather than queue behind live traffic. Then just run it again.
--   farm_park_join_v1(p_park)   { ok, park, counts } | { ok: false, code: 'full' | 'not-player' | 'bad', counts }
--   farm_park_beat_v1()         { ok, park (null: no seat), counts }: "still here", every 30 s while in the park
--   farm_park_leave_v1()        my seat is gone
--   farm_park_counts_v1()       { counts: [Park 1, Park 2, Park 3] }: people in each now (me included)
set local lock_timeout = '5s';

create table if not exists farm.park_seats (
  user_id uuid primary key references farm.players (user_id) on delete cascade, -- (leaving online play leaves the park)
  park smallint not null check (park between 1 and 3),
  seen_at timestamptz not null default now()
);
create index if not exists park_seats_park on farm.park_seats (park, seen_at);
alter table farm.park_seats enable row level security; -- (no policies: only the functions below read or write it)
revoke all on table farm.park_seats from public, anon, authenticated;

-- ---------- helpers (not callable by clients) ----------

-- How many may be in one park, and how long a seat lasts without a "still here" (the game says it every 30 s, so a
-- seat survives one missed beat on a bad network, and is free again within about a minute of a phone closing).
create or replace function farm.park_rules(out cap int, out fresh interval)
language sql immutable set search_path = '' as $$ select 30, interval '75 seconds' $$;

-- People in each park now: [Park 1, Park 2, Park 3]. Only fresh seats count.
create or replace function farm.park_counts() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_array(count(*) filter (where s.park = 1), count(*) filter (where s.park = 2), count(*) filter (where s.park = 3))
  from farm.park_seats s where s.seen_at > now() - (farm.park_rules()).fresh;
$$;

revoke all on function farm.park_rules(), farm.park_counts() from public, anon, authenticated;

-- ---------- the functions the game calls ----------

-- Go into a park (or move to another). p_park null = pick for me: stay where I am if my seat is still fresh (a
-- reconnect or a second tap must not throw me into another park), else the park with the most of my friends in it
-- that has room, else the lowest park with room. One join at a time across all parks (a lock), so two players can
-- never both take the 30th seat. A park I am already in always has room for me.
create or replace function public.farm_park_join_v1(p_park int default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); r record := farm.park_rules(); mine int; pick int; cnt int;
begin
  if uid is null then raise exception 'not signed in' using errcode = '28000'; end if;
  if not exists (select 1 from farm.players where user_id = uid) then return jsonb_build_object('ok', false, 'code', 'not-player'); end if;
  perform farm.me(); -- (a banned or suspended account can't go online: raises, as everywhere else)
  if p_park is not null and p_park not between 1 and 3 then
    return jsonb_build_object('ok', false, 'code', 'bad', 'counts', farm.park_counts());
  end if;
  perform pg_advisory_xact_lock(hashtextextended('farm_park', 0));
  delete from farm.park_seats where seen_at < now() - interval '1 hour'; -- (old seats out, so the table stays small)
  select park into mine from farm.park_seats where user_id = uid and seen_at > now() - r.fresh;
  if p_park is null then
    if mine is not null then
      pick := mine;
    else
      select p.n into pick
      from generate_series(1, 3) p (n)
      cross join lateral (
        select count(*) filter (where s.user_id <> uid) as here,
               count(*) filter (where s.user_id <> uid and farm.are_friends(uid, s.user_id) and not farm.blocked(uid, s.user_id)) as friends
        from farm.park_seats s where s.park = p.n and s.seen_at > now() - r.fresh) c
      where c.here < r.cap
      order by c.friends desc, p.n
      limit 1;
      if pick is null then return jsonb_build_object('ok', false, 'code', 'full', 'counts', farm.park_counts()); end if;
    end if;
  else
    select count(*) into cnt from farm.park_seats s where s.park = p_park and s.user_id <> uid and s.seen_at > now() - r.fresh;
    if cnt >= r.cap then return jsonb_build_object('ok', false, 'code', 'full', 'counts', farm.park_counts()); end if;
    pick := p_park;
  end if;
  insert into farm.park_seats (user_id, park, seen_at) values (uid, pick, now())
  on conflict (user_id) do update set park = excluded.park, seen_at = excluded.seen_at;
  return jsonb_build_object('ok', true, 'park', pick, 'counts', farm.park_counts());
end $$;

-- "Still here": keeps my seat. A seat that went stale (the phone slept past 75 s) comes back only if its park still
-- has room (else someone who took the free seat would make it 31): if not, the seat is gone and park is null, and the
-- game joins again (to another park). Under the same lock as join, so a beat and a join never both take the 30th seat.
create or replace function public.farm_park_beat_v1()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); r record := farm.park_rules(); s farm.park_seats; cnt int;
begin
  if uid is null then raise exception 'not signed in' using errcode = '28000'; end if;
  perform pg_advisory_xact_lock(hashtextextended('farm_park', 0));
  select * into s from farm.park_seats where user_id = uid;
  if found and s.seen_at <= now() - r.fresh then
    select count(*) into cnt from farm.park_seats x where x.park = s.park and x.user_id <> uid and x.seen_at > now() - r.fresh;
    if cnt >= r.cap then delete from farm.park_seats where user_id = uid; s.park := null; end if;
  end if;
  if s.park is not null then update farm.park_seats set seen_at = now() where user_id = uid; end if;
  return jsonb_build_object('ok', true, 'park', s.park, 'counts', farm.park_counts());
end $$;

-- Leave the park (walking out, or closing the game): the seat is free at once.
create or replace function public.farm_park_leave_v1()
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'not signed in' using errcode = '28000'; end if;
  delete from farm.park_seats where user_id = auth.uid();
end $$;

-- How many are in each park now (for the park gate's sign, before going in).
create or replace function public.farm_park_counts_v1()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'not signed in' using errcode = '28000'; end if;
  return jsonb_build_object('counts', farm.park_counts());
end $$;

revoke all on function public.farm_park_join_v1(int), public.farm_park_beat_v1(), public.farm_park_leave_v1(), public.farm_park_counts_v1()
  from public, anon, authenticated;
grant execute on function public.farm_park_join_v1(int), public.farm_park_beat_v1(), public.farm_park_leave_v1(), public.farm_park_counts_v1()
  to authenticated;

-- For the realtime channels: the farm rules exactly as part 1 made them, and now the park channels too: any player
-- (signed in, with a farm.players row) may use 'park:1', 'park:2' and 'park:3'. (Who is blocked is handled by part 18's
-- line keys: no key between two players who blocked each other, so neither sees or hears the other there.)
-- CREATE OR REPLACE keeps the function's grants as they are (drop and create would open it to everyone again).
create or replace function public.farm_topic_ok_v1(p_topic text)
returns boolean language plpgsql stable security definer set search_path = '' as $$
declare uid uuid := auth.uid(); host uuid;
begin
  if uid is not null and p_topic ~ '^park:[1-3]$' then
    return exists (select 1 from farm.players where user_id = uid);
  end if;
  if uid is null or p_topic is null or p_topic !~ '^farm:[0-9a-f-]{36}$' then return false; end if;
  if not exists (select 1 from farm.players where user_id = uid) then return false; end if;
  host := substr(p_topic, 6)::uuid;
  if host <> uid and farm.blocked(uid, host) then return false; end if;
  return exists (select 1 from farm.players where user_id = host and (listed or user_id = uid or farm.are_friends(uid, host)));
end $$;

-- ---------- the park's live channels: private realtime channels 'park:1' to 'park:3' ----------
-- (Positions, emotes and talk are broadcast between the people in the same park; nothing is stored.)
drop policy if exists farm_park_recv on realtime.messages;
create policy farm_park_recv on realtime.messages for select to authenticated
  using (realtime.topic() like 'park:%' and public.farm_topic_ok_v1(realtime.topic()));
drop policy if exists farm_park_send on realtime.messages;
create policy farm_park_send on realtime.messages for insert to authenticated
  with check (realtime.topic() like 'park:%' and public.farm_topic_ok_v1(realtime.topic()));

reset lock_timeout;
notify pgrst, 'reload schema';

-- ---------- to undo part 19 ----------
-- (first an app that has no Central Park: the park's game calls fail without these)
-- drop policy if exists farm_park_recv on realtime.messages;
-- drop policy if exists farm_park_send on realtime.messages;
-- create or replace function public.farm_topic_ok_v1(p_topic text)
-- returns boolean language plpgsql stable security definer set search_path = '' as $$
-- declare uid uuid := auth.uid(); host uuid;
-- begin
--   if uid is null or p_topic is null or p_topic !~ '^farm:[0-9a-f-]{36}$' then return false; end if;
--   if not exists (select 1 from farm.players where user_id = uid) then return false; end if;
--   host := substr(p_topic, 6)::uuid;
--   if host <> uid and farm.blocked(uid, host) then return false; end if;
--   return exists (select 1 from farm.players where user_id = host and (listed or user_id = uid or farm.are_friends(uid, host)));
-- end $$;
-- drop function if exists public.farm_park_join_v1(int), public.farm_park_beat_v1(), public.farm_park_leave_v1(), public.farm_park_counts_v1(),
--   farm.park_counts(), farm.park_rules();
-- drop table if exists farm.park_seats;
-- notify pgrst, 'reload schema';
