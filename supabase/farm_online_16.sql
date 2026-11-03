-- Harvest Ville online, part 16 (4 Nov 2026). Run AFTER parts 1-3 (it needs farm.players, friends, blocks, words and
-- farm.are_friends; nothing from parts 4-15). Barangays and the weekly Bayanihan Cup (owner, 4 Nov: "Neighborhoods
-- with a weekly Derby"; our own names: a barangay is a team of farms, the Bayanihan Cup is its week of tasks).
-- Additive: new tables and functions, a trigger on the new farm.hood_members and one on farm.snapshots (leaving online
-- play leaves your barangay too; added with CREATE OR REPLACE TRIGGER, so a second run takes no exclusive lock on the
-- busy farm.snapshots); nothing that exists changes. Safe to run twice. Runs fine as ONE transaction in the SQL editor.
-- Needs Postgres 14+ (create or replace trigger; Supabase is 15+).
--
--   BARANGAYS. A team of up to 30 farms. Anyone online (with a published farm) can make one (a name checked like farm
--     names, invisible characters taken out first; a badge from 8 icons; open to all or only with its 6-letter code;
--     3 made a day, counted in a log), find one (friends' first, then the busiest with room, or by name), join (10
--     tries a minute), leave. One at a time. The leader (who made it; then the longest member) can open or close it,
--     make a new code (only the leader sees the code) and take a member out (who then cannot come back for 7 days).
--     A banned, suspended or hidden (reported) leader does not lead: the longest member in good standing does. A
--     small news board: members write short lines (checked for bad words like farm messages, 30 a day), and the
--     server adds a line when someone joins, leaves or finishes a Cup task; lines older than 14 days are pruned
--     whenever the board gets a line. When the last member leaves, the barangay is gone.
--   THE BAYANIHAN CUP. Weeks run Monday 00:00 to Sunday 24:00 Philippine time. Each week every barangay gets the same 8
--     tasks (picked from farm.cup_kinds by the week). A member picks one task at a time, does it in their game, and the
--     game turns it in; the points go to the barangay. Each member: each task once a week, 6 tasks a week, 3 a day.
--     The server does not take the game's word blindly: a task counts only after its least time since it was picked
--     (farm.cup_kinds.minutes, by the server's clock), and the caps above are per player whatever is asked. So a changed
--     game can score no more than a busy honest player.
--     Guests (profiles.is_guest) cannot pick or turn in Cup tasks.
--     Leagues: the first task a barangay finishes in a week puts it in a group of 10 barangays of a similar size (1-5,
--     6-15 or 16-30), in the order they start. Its size that week is the most it has had: members at once, or
--     different players who scored for it; when that grows past its league (a join, a task), it moves up to the
--     bigger league's first group with room. So a big barangay never plays in the small league. The places are in
--     that group: most points first; a tie goes to the barangay that got there first.
--     Prizes: every member who finished a task that week gets one, once (in the barangay they scored most for):
--     1st 3,000G + 3 Sunbeams, 2nd 2,000G + 2, 3rd 1,200G + 1 (a place needs 400 points or more), everyone else 500G.
--     The amounts are here; the game never sends one. A claim is a row keyed (player, week), so a second claim, at the
--     same moment or later, finds the row and pays nothing. Claims stay open for the 4 weeks after a week ends.
--   To change a task:  update farm.cup_kinds set goal = 100 where kind = 'harvest';  (picks already made keep theirs)
set lock_timeout = '5s';

-- ---------- helpers (not callable by clients) ----------
-- The numbers of this part, in one place.
create or replace function farm.nb_rules(out max_members int, out week_tasks int, out day_tasks int, out min_place int,
  out posts_day int, out makes_day int, out base_gold int)
language sql immutable set search_path = '' as $$
  select 30, 6, 3, 400, 30, 3, 500;
$$;

-- A place's prize.
create or replace function farm.nb_prize(p_place int, p_score int, out gold int, out stars int)
language sql immutable set search_path = '' as $$
  select case when p_score >= 400 and p_place = 1 then 3000 when p_score >= 400 and p_place = 2 then 2000 when p_score >= 400 and p_place = 3 then 1200 else 500 end,
    case when p_score >= 400 and p_place between 1 and 3 then 4 - p_place else 0 end;
$$;

-- This week's Monday in the Philippines.
create or replace function farm.nb_week(t timestamptz) returns date
language sql stable set search_path = '' as $$
  select (t at time zone 'Asia/Manila')::date - (extract(isodow from (t at time zone 'Asia/Manila'))::int - 1);
$$;

-- A guest, or an account closed to prizes? (the same test as part 12's prize_ok, kept here so this part stands alone)
create or replace function farm.nb_prize_ok(p_user uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select not exists (select 1 from public.profiles p where p.auth_user_id = p_user
    and (coalesce(p.is_guest, false) or p.is_banned or p.suspended_until > now() or p.deleted_at is not null));
$$;

-- Text with the invisible characters taken out (soft hyphen, zero-width spaces and joiners, direction marks and
-- overrides, word joiners, the byte-order mark): they let a rude word or a copy of a name past the checks.
create or replace function farm.nb_clean(t text) returns text
language sql immutable set search_path = '' as $$
  select regexp_replace(coalesce(t, ''), '[\u00AD\u200B-\u200F\u202A-\u202E\u2060-\u2064\u2066-\u2069\uFEFF]', '', 'g');
$$;

-- In good standing: a player who is not hidden (reports) and whose account is not banned, suspended or deleted.
-- Anyone else is treated as gone for leading a barangay, Find and the Market board.
create or replace function farm.nb_ok(p_user uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from farm.players pl where pl.user_id = p_user and not pl.hidden)
    and not exists (select 1 from public.profiles p where p.auth_user_id = p_user
      and (coalesce(p.is_banned, false) or p.suspended_until > now() or p.deleted_at is not null));
$$;

-- A barangay's league for its size that week.
create or replace function farm.cup_league(p_size int) returns text
language sql immutable set search_path = '' as $$
  select case when p_size <= 5 then 's' when p_size <= 15 then 'm' else 'l' end;
$$;

-- ---------- tables ----------
create table if not exists farm.hoods (
  id bigint generated always as identity primary key,
  name text not null check (char_length(name) between 3 and 20 and name = btrim(name)),
  badge text not null check (badge in ('carabao', 'mango', 'sunflower', 'fish_k', 'star', 'heart', 'cow', 'gem')),
  open boolean not null default true,
  code text not null unique check (code ~ '^[A-HJ-NP-Z2-9]{6}$'),
  leader uuid references farm.players (user_id) on delete set null,
  made_by uuid,
  created_at timestamptz not null default now()
);
create unique index if not exists hoods_name on farm.hoods (lower(name));
create index if not exists hoods_leader on farm.hoods (leader); -- (behind the on delete set null)

create table if not exists farm.hood_members (
  user_id uuid primary key references farm.players (user_id) on delete cascade,
  hood_id bigint not null references farm.hoods (id) on delete cascade,
  joined_at timestamptz not null default now()
);
create index if not exists hood_members_hood on farm.hood_members (hood_id, joined_at);

-- The news board: 'say' a member wrote; 'made', 'join', 'left', 'task' the server wrote (a task's body: kind:points).
create table if not exists farm.hood_posts (
  id bigint generated always as identity primary key,
  hood_id bigint not null references farm.hoods (id) on delete cascade,
  user_id uuid references farm.players (user_id) on delete cascade,
  kind text not null check (kind in ('say', 'made', 'join', 'left', 'task')),
  body text not null default '' check (char_length(body) <= 120),
  created_at timestamptz not null default now()
);
create index if not exists hood_posts_hood on farm.hood_posts (hood_id, id desc);
create index if not exists hood_posts_user on farm.hood_posts (user_id, created_at); -- (the 30 a day; behind the cascade)

-- The kinds of task the Cup draws from (kind: the game's counter, 00-zzzzzzz-social.js). minutes: the least time
-- from picking it to finishing it.
create table if not exists farm.cup_kinds (
  kind text primary key check (kind ~ '^[a-z]{1,16}$'),
  goal int not null check (goal between 1 and 1000),
  points int not null check (points between 1 and 1000),
  minutes int not null check (minutes between 0 and 600)
);
insert into farm.cup_kinds (kind, goal, points, minutes) values
  ('harvest', 80, 120, 12), ('fish', 12, 100, 10), ('hunt', 4, 120, 10), ('order', 3, 100, 15), ('collect', 15, 80, 10),
  ('care', 25, 60, 8), ('cooked', 5, 80, 8), ('plant', 60, 60, 8), ('forage', 10, 80, 10), ('request', 2, 100, 15)
on conflict (kind) do nothing;

-- Your task now (one at a time). What it asks is copied in, so a change to cup_kinds never moves a task already picked.
create table if not exists farm.cup_picks (
  user_id uuid primary key references farm.players (user_id) on delete cascade,
  week date not null,
  kind text not null,
  goal int not null,
  points int not null,
  minutes int not null,
  hood_id bigint not null references farm.hoods (id) on delete cascade,
  picked_at timestamptz not null default now()
);
create index if not exists cup_picks_hood on farm.cup_picks (hood_id); -- (behind the cascade)
-- Tasks finished. (No foreign key to the barangay: the week's results stay if it closes.)
create table if not exists farm.cup_done (
  user_id uuid not null references farm.players (user_id) on delete cascade,
  week date not null,
  kind text not null,
  hood_id bigint not null,
  points int not null check (points > 0),
  day date not null,
  done_at timestamptz not null default now(),
  primary key (user_id, week, kind)
);
create index if not exists cup_done_hood on farm.cup_done (week, hood_id);
-- A barangay in a week's Cup: its group (league + number) and points. Name and badge are copied in for the same reason.
create table if not exists farm.cup_hoods (
  week date not null,
  hood_id bigint not null,
  name text not null,
  badge text not null,
  league text not null check (league in ('s', 'm', 'l')),
  grp int not null check (grp >= 0),
  score int not null default 0 check (score >= 0),
  last_at timestamptz not null default now(),
  most int not null default 1, -- its size this week so far: the most members at once, or players who scored for it
  primary key (week, hood_id)
);
create index if not exists cup_hoods_grp on farm.cup_hoods (week, league, grp);
create table if not exists farm.cup_claims (
  user_id uuid not null references farm.players (user_id) on delete cascade,
  week date not null,
  hood_id bigint not null,
  place int not null,
  gold int not null,
  stars int not null,
  created_at timestamptz not null default now(),
  primary key (user_id, week)
);
-- Taken out by the leader: no coming back to that barangay until then.
create table if not exists farm.hood_bans (
  hood_id bigint not null references farm.hoods (id) on delete cascade,
  user_id uuid not null references farm.players (user_id) on delete cascade,
  until timestamptz not null,
  primary key (hood_id, user_id)
);
create index if not exists hood_bans_user on farm.hood_bans (user_id); -- (behind the cascade)
-- What a player did that has a limit: 'make' (3 barangays a day), 'join' (10 tries a minute). Kept a day.
create table if not exists farm.nb_log (
  user_id uuid not null references farm.players (user_id) on delete cascade,
  kind text not null check (kind in ('make', 'join')),
  at timestamptz not null default now()
);
create index if not exists nb_log_user on farm.nb_log (user_id, kind, at);
alter table farm.hoods enable row level security;
alter table farm.hood_bans enable row level security;
alter table farm.nb_log enable row level security;
alter table farm.hood_members enable row level security;
alter table farm.hood_posts enable row level security;
alter table farm.cup_kinds enable row level security;
alter table farm.cup_picks enable row level security;
alter table farm.cup_done enable row level security;
alter table farm.cup_hoods enable row level security;
alter table farm.cup_claims enable row level security;
revoke all on farm.hoods, farm.hood_members, farm.hood_posts, farm.cup_kinds, farm.cup_picks, farm.cup_done, farm.cup_hoods, farm.cup_claims,
  farm.hood_bans, farm.nb_log from public, anon, authenticated;

-- My barangay's id, or null.
create or replace function farm.my_hood(p_user uuid) returns bigint
language sql stable security definer set search_path = '' as $$
  select hood_id from farm.hood_members where user_id = p_user;
$$;

-- Who leads a barangay: the leader it names, if still a member in good standing; else the longest member in good
-- standing (null if there is none).
create or replace function farm.hood_lead(p_hood bigint) returns uuid
language plpgsql stable security definer set search_path = '' as $$
declare l uuid;
begin
  select h.leader into l from farm.hoods h join farm.hood_members m on m.user_id = h.leader and m.hood_id = h.id where h.id = p_hood;
  if l is not null and farm.nb_ok(l) then return l; end if;
  select m.user_id into l from farm.hood_members m where m.hood_id = p_hood and farm.nb_ok(m.user_id) order by m.joined_at, m.user_id limit 1;
  return l;
end $$;

-- Write down who leads now (when it changed and someone can).
create or replace function farm.hood_fix_lead(p_hood bigint) returns void
language sql security definer set search_path = '' as $$
  update farm.hoods h set leader = x.l from (select farm.hood_lead(p_hood) as l) x
  where h.id = p_hood and x.l is not null and h.leader is distinct from x.l;
$$;

-- Old news goes (14 days), whenever the board gets a line of any kind.
create or replace function farm.hood_prune(p_hood bigint) returns void
language sql security definer set search_path = '' as $$
  delete from farm.hood_posts p where p.hood_id = p_hood and p.created_at < now() - interval '14 days';
$$;

-- When a member goes (leaves, is taken out, or leaves online play): the barangay's row is locked first, so two
-- members going at once are taken one after the other (the second sees the first gone); then a barangay with nobody
-- left is gone, or the lead passes on if the leader went. (Its Cup results stay: they are not tied to it.)
create or replace function farm.hood_member_gone()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform 1 from farm.hoods where id = old.hood_id for update;
  if not found then return null; end if; -- (the barangay itself is going)
  if not exists (select 1 from farm.hood_members m where m.hood_id = old.hood_id) then
    delete from farm.hoods where id = old.hood_id;
  else
    perform farm.hood_fix_lead(old.hood_id);
  end if;
  return null;
end $$;
create or replace trigger hood_member_gone after delete on farm.hood_members for each row execute function farm.hood_member_gone();

-- Leaving online play (farm_leave_v1 deletes your farm's snapshot, and only it does) leaves your barangay too. Making
-- or joining a barangay needs a published farm (a snapshot), so everyone in one has a snapshot to lose and this
-- always runs. (Deleting an account cascades: farm.players to hood_members, and the trigger above.) A problem here
-- never stops the leave.
create or replace function farm.snapshot_gone_leave_hood()
returns trigger language plpgsql security definer set search_path = '' as $$
declare hid bigint := farm.my_hood(old.user_id);
begin
  if hid is null then return null; end if;
  delete from farm.cup_picks where user_id = old.user_id;
  perform farm.hood_note(hid, old.user_id, 'left');
  delete from farm.hood_members where user_id = old.user_id;
  return null;
exception
  when query_canceled then raise;
  when others then return null;
end $$;
create or replace trigger snapshot_gone_leave_hood after delete on farm.snapshots for each row execute function farm.snapshot_gone_leave_hood();

-- A barangay's place in this week's Cup, for its size p_size: p_new makes it (its first task), else only a barangay
-- already in moves up (a join). The size only grows; when it passes the league's top, the barangay moves to the
-- bigger league, into its first group with room. Locks: the barangay's, then the league's (always in that order).
create or replace function farm.cup_seat(p_week date, p_hood bigint, p_size int, p_new boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare ch farm.cup_hoods; h farm.hoods; lg text; g int;
begin
  perform pg_advisory_xact_lock(hashtextextended('farm_cup_hood:' || p_week::text || ':' || p_hood::text, 0));
  select * into ch from farm.cup_hoods where week = p_week and hood_id = p_hood;
  if not found and not p_new then return; end if;
  if found and p_size <= ch.most then return; end if;
  lg := farm.cup_league(greatest(p_size, coalesce(ch.most, 0)));
  if ch.hood_id is not null and lg = ch.league then
    update farm.cup_hoods set most = p_size where week = p_week and hood_id = p_hood;
    return;
  end if;
  perform pg_advisory_xact_lock(hashtextextended('farm_cup_league:' || p_week::text || lg, 0));
  select coalesce(min(x.grp), (select coalesce(max(o.grp) + 1, 0) from farm.cup_hoods o where o.week = p_week and o.league = lg)) into g
  from (select o.grp from farm.cup_hoods o where o.week = p_week and o.league = lg and o.hood_id <> p_hood group by o.grp having count(*) < 10) x;
  if ch.hood_id is not null then
    update farm.cup_hoods set league = lg, grp = g, most = p_size where week = p_week and hood_id = p_hood;
  else
    select * into h from farm.hoods where id = p_hood;
    insert into farm.cup_hoods (week, hood_id, name, badge, league, grp, most) values (p_week, p_hood, h.name, h.badge, lg, g, greatest(p_size, 1))
    on conflict (week, hood_id) do nothing;
  end if;
end $$;

-- This week's 8 tasks, the same for every barangay: cup_kinds in an order the week decides.
create or replace function farm.cup_tasks(p_week date)
returns table (kind text, goal int, points int, minutes int)
language sql stable security definer set search_path = '' as $$
  select k.kind, k.goal, k.points, k.minutes from farm.cup_kinds k order by md5(p_week::text || ':' || k.kind) limit 8;
$$;

-- A barangay's place in its group in a week (null if it is not in that week's Cup).
create or replace function farm.cup_place(p_week date, p_hood bigint) returns int
language sql stable security definer set search_path = '' as $$
  select (1 + (select count(*) from farm.cup_hoods o
    where o.week = h.week and o.league = h.league and o.grp = h.grp and o.hood_id <> h.hood_id
      and (o.score > h.score or (o.score = h.score and (o.last_at, o.hood_id) < (h.last_at, h.hood_id)))))::int
  from farm.cup_hoods h where h.week = p_week and h.hood_id = p_hood;
$$;

-- A line the server writes on the news board (joined, left). Once a day per player and kind, so joining and leaving
-- over and over cannot fill the board.
create or replace function farm.hood_note(p_hood bigint, p_user uuid, p_kind text) returns void
language sql security definer set search_path = '' as $$
  insert into farm.hood_posts (hood_id, user_id, kind)
  select p_hood, p_user, p_kind where not exists (select 1 from farm.hood_posts p
    where p.hood_id = p_hood and p.user_id = p_user and p.kind = p_kind and p.created_at > now() - interval '1 day');
  select farm.hood_prune(p_hood);
$$;

revoke all on function farm.nb_rules(), farm.nb_prize(int, int), farm.nb_week(timestamptz), farm.nb_prize_ok(uuid), farm.nb_clean(text), farm.nb_ok(uuid),
  farm.cup_league(int), farm.hood_lead(bigint), farm.hood_fix_lead(bigint), farm.hood_prune(bigint), farm.hood_member_gone(), farm.snapshot_gone_leave_hood(),
  farm.cup_seat(date, bigint, int, boolean), farm.cup_tasks(date), farm.cup_place(date, bigint), farm.my_hood(uuid), farm.hood_note(bigint, uuid, text)
  from public, anon, authenticated;

-- ---------- the functions the game calls ----------

-- Everything the Barangay panel shows, in one call: the barangay (or null), this week's tasks, my task now, how many I
-- have done, and my barangay's group in the Cup. Only the leader is sent the code.
create or replace function public.farm_nb_v1()
returns json language plpgsql security definer set search_path = '' as $$
declare uid uuid := farm.me(); wk date := farm.nb_week(now()); today date := (now() at time zone 'Asia/Manila')::date;
  r record := farm.nb_rules(); hid bigint := farm.my_hood(uid); h farm.hoods; pk farm.cup_picks; ch farm.cup_hoods;
  hood json := null; cup json := null; pick json := null; tasks json; n int; online int; lead uuid;
begin
  update farm.players set last_seen_at = now() where user_id = uid;
  select coalesce(json_agg(json_build_object('kind', t.kind, 'goal', t.goal, 'points', t.points, 'minutes', t.minutes,
    'done', exists (select 1 from farm.cup_done d where d.user_id = uid and d.week = wk and d.kind = t.kind))), '[]'::json)
  into tasks from farm.cup_tasks(wk) t;
  if hid is not null then
    select * into h from farm.hoods where id = hid;
    lead := farm.hood_lead(hid);
    select count(*), count(*) filter (where pl.last_seen_at > now() - interval '2 minutes') into n, online
    from farm.hood_members m join farm.players pl on pl.user_id = m.user_id where m.hood_id = hid;
    hood := json_build_object('id', h.id, 'name', h.name, 'badge', h.badge, 'open', h.open, 'code', case when lead = uid then h.code end,
      'leader', lead = uid, 'members', n, 'online', online, 'max', r.max_members);
    select * into ch from farm.cup_hoods where week = wk and hood_id = hid;
    if found then
      select json_build_object('league', ch.league, 'score', ch.score, 'place', farm.cup_place(wk, hid),
        'group', coalesce(json_agg(json_build_object('name', g.name, 'badge', g.badge, 'score', g.score, 'me', g.hood_id = hid)
          order by g.score desc, g.last_at, g.hood_id), '[]'::json))
      into cup from farm.cup_hoods g where g.week = wk and g.league = ch.league and g.grp = ch.grp;
    end if;
  end if;
  select * into pk from farm.cup_picks where user_id = uid;
  if found and pk.week = wk and pk.hood_id is not distinct from hid then
    pick := json_build_object('kind', pk.kind, 'goal', pk.goal, 'points', pk.points, 'minutes', pk.minutes,
      'ago', extract(epoch from now() - pk.picked_at)::int);
  end if;
  return json_build_object('hood', hood, 'week', wk, 'ends_in', extract(epoch from ((wk + 7)::timestamp at time zone 'Asia/Manila') - now())::int,
    'tasks', tasks, 'pick', pick, 'cup', cup,
    'done_week', (select count(*) from farm.cup_done d where d.user_id = uid and d.week = wk),
    'done_today', (select count(*) from farm.cup_done d where d.user_id = uid and d.week = wk and d.day = today),
    'max_week', r.week_tasks, 'max_day', r.day_tasks, 'min_place', r.min_place, 'base_gold', r.base_gold,
    'prizes', json_build_array(json_build_array(3000, 3), json_build_array(2000, 2), json_build_array(1200, 1)),
    'can_win', farm.nb_prize_ok(uid));
end $$;

-- Make a barangay (and join it as its leader). 'bad' | 'word' | 'taken' | 'in' (in one already) | 'limit' (3 a day,
-- however many were left or closed since) | 'snap' (my farm is not published yet)
create or replace function public.farm_nb_create_v1(p_name text, p_badge text, p_open boolean)
returns json language plpgsql security definer set search_path = '' as $$
declare uid uuid := farm.me(); nm text := regexp_replace(btrim(farm.nb_clean(p_name)), '\s+', ' ', 'g'); r record := farm.nb_rules();
  code text; new_id bigint; tries int := 0; alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
begin
  if char_length(nm) not between 3 and 20 or p_badge is null or p_badge not in ('carabao', 'mango', 'sunflower', 'fish_k', 'star', 'heart', 'cow', 'gem') then
    return json_build_object('ok', false, 'code', 'bad');
  end if;
  if not farm.clean_ok(nm) then return json_build_object('ok', false, 'code', 'word'); end if;
  perform pg_advisory_xact_lock(hashtextextended('farm_nb:' || uid::text, 0));
  if farm.my_hood(uid) is not null then return json_build_object('ok', false, 'code', 'in'); end if;
  if not exists (select 1 from farm.snapshots where user_id = uid) then return json_build_object('ok', false, 'code', 'snap'); end if;
  if (select count(*) from farm.nb_log where user_id = uid and kind = 'make' and at > now() - interval '1 day') >= r.makes_day then
    return json_build_object('ok', false, 'code', 'limit');
  end if;
  if exists (select 1 from farm.hoods where lower(name) = lower(nm)) then return json_build_object('ok', false, 'code', 'taken'); end if;
  loop
    code := '';
    for i in 1..6 loop code := code || substr(alphabet, 1 + floor(random() * 32)::int, 1); end loop;
    begin
      insert into farm.hoods (name, badge, open, code, leader, made_by) values (nm, p_badge, coalesce(p_open, true), code, uid, uid) returning id into new_id;
      exit;
    exception when unique_violation then
      if exists (select 1 from farm.hoods where lower(name) = lower(nm)) then return json_build_object('ok', false, 'code', 'taken'); end if;
      tries := tries + 1;
      if tries > 5 then raise; end if;
    end;
  end loop;
  insert into farm.hood_members (user_id, hood_id) values (uid, new_id);
  insert into farm.hood_posts (hood_id, user_id, kind) values (new_id, uid, 'made');
  delete from farm.nb_log where user_id = uid and at < now() - interval '1 day';
  insert into farm.nb_log (user_id, kind) values (uid, 'make');
  return json_build_object('ok', true, 'id', new_id, 'name', nm, 'code', code);
end $$;

-- Barangays to join: up to 10 my friends are in first, then this week's busiest (with p_q: the ones whose name has
-- it), 30 in all, then the best 20. Only ones with room and a leader in good standing, not led by someone who blocked
-- me (or I blocked), and not one that took me out: all checked BEFORE the 30 are counted, so full ones never crowd
-- out the rest. Closed ones show: they need their code.
create or replace function public.farm_nb_find_v1(p_q text default null)
returns table (id bigint, name text, badge text, open boolean, members int, friends int, score int)
language plpgsql stable security definer set search_path = '' as $$
declare uid uuid := farm.me(); wk date := farm.nb_week(now()); r record := farm.nb_rules();
  q text := lower(left(btrim(farm.nb_clean(p_q)), 20)); x record; lead uuid; n int; ids bigint[] := '{}'; nf int := 0;
begin
  for x in
    with fr as (
      select case when f.user_a = uid then f.user_b else f.user_a end as fid
      from farm.friends f where uid in (f.user_a, f.user_b) and f.accepted_at is not null),
    fh as (select m.hood_id, count(*)::int as n from farm.hood_members m join fr on fr.fid = m.user_id group by m.hood_id)
    select h.id as hid, (fh.hood_id is not null and char_length(q) < 2) as by_friend
    from farm.hoods h left join fh on fh.hood_id = h.id left join farm.cup_hoods c on c.week = wk and c.hood_id = h.id
    where char_length(q) < 2 or position(q in lower(h.name)) > 0
    order by case when char_length(q) < 2 then coalesce(fh.n, 0) else 0 end desc, coalesce(c.score, 0) desc, h.created_at desc, h.id
  loop
    exit when cardinality(ids) >= 30;
    continue when x.by_friend and nf >= 10;
    select count(*) into n from farm.hood_members m where m.hood_id = x.hid;
    continue when n not between 1 and r.max_members - 1;
    lead := farm.hood_lead(x.hid);
    continue when lead is null or farm.blocked(uid, lead);
    continue when exists (select 1 from farm.hood_bans b where b.hood_id = x.hid and b.user_id = uid and b.until > now());
    ids := ids || x.hid;
    if x.by_friend then nf := nf + 1; end if;
  end loop;
  return query
  with fr as (
    select case when f.user_a = uid then f.user_b else f.user_a end as fid
    from farm.friends f where uid in (f.user_a, f.user_b) and f.accepted_at is not null),
  cand as (
    select h.id, h.name, h.badge, h.open,
      (select count(*)::int from farm.hood_members m where m.hood_id = h.id) as members,
      (select count(*)::int from farm.hood_members m join fr on fr.fid = m.user_id where m.hood_id = h.id) as friends,
      coalesce((select c.score from farm.cup_hoods c where c.week = wk and c.hood_id = h.id), 0) as score
    from farm.hoods h where h.id = any (ids))
  select x2.id, x2.name, x2.badge, x2.open, x2.members, x2.friends, x2.score from cand x2
  order by x2.friends desc, x2.open desc, x2.score desc, x2.members desc, x2.id
  limit 20;
end $$;

-- Join: an open barangay by its id, or any by its code. 'gone' | 'code' (closed: needs its code) | 'full' | 'in' |
-- 'banned' (the leader took me out: 7 days) | 'slow' (10 tries a minute) | 'snap' (my farm is not published yet)
create or replace function public.farm_nb_join_v1(p_id bigint default null, p_code text default null)
returns json language plpgsql security definer set search_path = '' as $$
declare uid uuid := farm.me(); r record := farm.nb_rules(); h farm.hoods; c text := upper(btrim(coalesce(p_code, ''))); lead uuid;
  wk date := farm.nb_week(now()); n int;
begin
  perform pg_advisory_xact_lock(hashtextextended('farm_nb:' || uid::text, 0));
  if (select count(*) from farm.nb_log where user_id = uid and kind = 'join' and at > now() - interval '1 minute') >= 10 then
    return json_build_object('ok', false, 'code', 'slow');
  end if;
  delete from farm.nb_log where user_id = uid and at < now() - interval '1 day';
  insert into farm.nb_log (user_id, kind) values (uid, 'join');
  if farm.my_hood(uid) is not null then return json_build_object('ok', false, 'code', 'in'); end if;
  if not exists (select 1 from farm.snapshots where user_id = uid) then return json_build_object('ok', false, 'code', 'snap'); end if;
  if c <> '' then select * into h from farm.hoods where code = c for update;
  else select * into h from farm.hoods where id = p_id for update; end if;
  if h.id is null then return json_build_object('ok', false, 'code', 'gone'); end if;
  select count(*) into n from farm.hood_members where hood_id = h.id;
  if n = 0 then delete from farm.hoods where id = h.id; return json_build_object('ok', false, 'code', 'gone'); end if; -- (nobody left in it)
  lead := farm.hood_lead(h.id);
  if lead is not null and farm.blocked(uid, lead) then return json_build_object('ok', false, 'code', 'gone'); end if;
  if exists (select 1 from farm.hood_bans b where b.hood_id = h.id and b.user_id = uid and b.until > now()) then
    return json_build_object('ok', false, 'code', 'banned');
  end if;
  if c = '' and not h.open then return json_build_object('ok', false, 'code', 'code'); end if;
  if n >= r.max_members then return json_build_object('ok', false, 'code', 'full'); end if;
  insert into farm.hood_members (user_id, hood_id) values (uid, h.id);
  delete from farm.cup_picks where user_id = uid;
  perform farm.hood_note(h.id, uid, 'join');
  perform farm.hood_fix_lead(h.id); -- (the leader gone: the joiner may lead)
  perform farm.cup_seat(wk, h.id, n + 1, false); -- (in this week's Cup: a bigger barangay moves up a league)
  return json_build_object('ok', true, 'id', h.id, 'name', h.name);
end $$;

-- Leave my barangay (my task now goes too; tasks I finished still count for it this week). 'ok' | 'out'
create or replace function public.farm_nb_leave_v1()
returns text language plpgsql security definer set search_path = '' as $$
declare uid uuid := farm.me(); hid bigint := farm.my_hood(uid);
begin
  if hid is null then return 'out'; end if;
  delete from farm.cup_picks where user_id = uid;
  perform farm.hood_note(hid, uid, 'left');
  delete from farm.hood_members where user_id = uid; -- (the trigger passes on the lead, or closes an empty barangay)
  return 'ok';
end $$;

-- The leader: open to all, or only with the code. 'ok' | 'leader' (only the leader can)
create or replace function public.farm_nb_set_v1(p_open boolean)
returns text language plpgsql security definer set search_path = '' as $$
declare uid uuid := farm.me(); hid bigint := farm.my_hood(uid);
begin
  if hid is null then return 'leader'; end if;
  perform 1 from farm.hoods where id = hid for update;
  if farm.hood_lead(hid) is distinct from uid then return 'leader'; end if;
  perform farm.hood_fix_lead(hid);
  update farm.hoods set open = coalesce(p_open, open) where id = hid;
  return 'ok';
end $$;

-- The leader makes a new code (the old one stops working). {ok, join_code} | {ok: false, code: 'leader'}
create or replace function public.farm_nb_code_v1()
returns json language plpgsql security definer set search_path = '' as $$
declare uid uuid := farm.me(); hid bigint := farm.my_hood(uid); nc text; tries int := 0; alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
begin
  if hid is null then return json_build_object('ok', false, 'code', 'leader'); end if;
  perform 1 from farm.hoods where id = hid for update;
  if farm.hood_lead(hid) is distinct from uid then return json_build_object('ok', false, 'code', 'leader'); end if;
  perform farm.hood_fix_lead(hid);
  loop
    nc := '';
    for i in 1..6 loop nc := nc || substr(alphabet, 1 + floor(random() * 32)::int, 1); end loop;
    begin
      update farm.hoods set code = nc where id = hid;
      exit;
    exception when unique_violation then
      tries := tries + 1;
      if tries > 5 then raise; end if;
    end;
  end loop;
  return json_build_object('ok', true, 'join_code', nc);
end $$;

-- The leader takes a member out; they cannot come back for 7 days (by its id or its code). 'ok' | 'leader' | 'none'
create or replace function public.farm_nb_kick_v1(p_user uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare uid uuid := farm.me(); hid bigint := farm.my_hood(uid);
begin
  if hid is null then return 'leader'; end if;
  perform 1 from farm.hoods where id = hid for update;
  if farm.hood_lead(hid) is distinct from uid then return 'leader'; end if;
  if p_user = uid then return 'none'; end if;
  perform farm.hood_fix_lead(hid);
  delete from farm.hood_members where user_id = p_user and hood_id = hid;
  if not found then return 'none'; end if;
  delete from farm.cup_picks where user_id = p_user;
  delete from farm.hood_bans where hood_id = hid and until < now();
  insert into farm.hood_bans (hood_id, user_id, until) values (hid, p_user, now() + interval '7 days')
  on conflict (hood_id, user_id) do update set until = excluded.until;
  insert into farm.hood_posts (hood_id, user_id, kind) values (hid, p_user, 'left');
  perform farm.hood_prune(hid);
  return 'ok';
end $$;

-- The members: online, and what each did for the Cup this week. Blocked players are left out.
create or replace function public.farm_nb_members_v1()
returns table (id uuid, farm_name text, leader boolean, online boolean, tasks int, points int, me boolean)
language sql stable security definer set search_path = '' as $$
  with me as materialized (select farm.me() as uid), mine as materialized (select farm.my_hood(me.uid) as hid, me.uid from me),
  lead as (select farm.hood_lead(mine.hid) as lid from mine)
  select pl.user_id, pl.farm_name, pl.user_id is not distinct from lead.lid, pl.last_seen_at > now() - interval '2 minutes',
    coalesce(d.n, 0), coalesce(d.pts, 0), pl.user_id = mine.uid
  from mine cross join lead join farm.hood_members m on m.hood_id = mine.hid
  join farm.players pl on pl.user_id = m.user_id
  left join lateral (select count(*)::int as n, sum(cd.points)::int as pts from farm.cup_done cd
    where cd.user_id = m.user_id and cd.week = farm.nb_week(now()) and cd.hood_id = mine.hid) d on true
  where not farm.blocked(mine.uid, pl.user_id)
  order by coalesce(d.pts, 0) desc, m.joined_at
  limit 30;
$$;

-- Write on the news board (80 letters at most: a longer line is cut; invisible characters taken out). 'ok' | 'empty'
-- | 'word' | 'limit' (30 a day; one at a time per player, so lines sent at once cannot pass it) | 'out'
create or replace function public.farm_nb_post_v1(p_body text)
returns text language plpgsql security definer set search_path = '' as $$
declare uid uuid := farm.me(); hid bigint; msg text := left(regexp_replace(btrim(farm.nb_clean(p_body)), '\s+', ' ', 'g'), 80); r record := farm.nb_rules();
begin
  perform pg_advisory_xact_lock(hashtextextended('farm_nb:' || uid::text, 0));
  hid := farm.my_hood(uid);
  if hid is null then return 'out'; end if;
  if msg = '' then return 'empty'; end if;
  if not farm.clean_ok(msg) then return 'word'; end if;
  if (select count(*) from farm.hood_posts p where p.user_id = uid and p.kind = 'say' and p.created_at > now() - interval '1 day') >= r.posts_day then return 'limit'; end if;
  insert into farm.hood_posts (hood_id, user_id, kind, body) values (hid, uid, 'say', msg);
  perform farm.hood_prune(hid);
  return 'ok';
end $$;

-- The news board: the newest 40, without anyone blocked. (me is worked out once, not per line.)
create or replace function public.farm_nb_posts_v1()
returns table (id bigint, who uuid, farm_name text, kind text, body text, ago int, mine boolean)
language sql stable security definer set search_path = '' as $$
  with me as materialized (select x.uid, farm.my_hood(x.uid) as hid from (select farm.me() as uid) x)
  select p.id, p.user_id, pl.farm_name, p.kind, p.body, extract(epoch from now() - p.created_at)::int, p.user_id = me.uid
  from me join farm.hood_posts p on p.hood_id = me.hid
  left join farm.players pl on pl.user_id = p.user_id
  where p.user_id is null or not farm.blocked(me.uid, p.user_id)
  order by p.id desc
  limit 40;
$$;

-- Pick a task of this week's Cup. 'out' (no barangay) | 'guest' (guests do not play the Cup) | 'bad' (not this
-- week's) | 'busy' (one at a time) | 'done' (that one is done this week) | 'week' (6 this week) | 'day' (3 today)
create or replace function public.farm_cup_pick_v1(p_kind text)
returns json language plpgsql security definer set search_path = '' as $$
declare uid uuid := farm.me(); hid bigint := farm.my_hood(uid); wk date := farm.nb_week(now()); today date := (now() at time zone 'Asia/Manila')::date;
  r record := farm.nb_rules(); t record; pk farm.cup_picks;
begin
  if hid is null then return json_build_object('ok', false, 'code', 'out'); end if;
  if not farm.nb_prize_ok(uid) then return json_build_object('ok', false, 'code', 'guest'); end if;
  perform pg_advisory_xact_lock(hashtextextended('farm_cup:' || uid::text, 0));
  select * into t from farm.cup_tasks(wk) x where x.kind = p_kind;
  if t.kind is null then return json_build_object('ok', false, 'code', 'bad'); end if;
  select * into pk from farm.cup_picks where user_id = uid;
  if found and pk.week = wk and pk.hood_id = hid then return json_build_object('ok', false, 'code', 'busy', 'kind', pk.kind); end if;
  if exists (select 1 from farm.cup_done where user_id = uid and week = wk and kind = p_kind) then return json_build_object('ok', false, 'code', 'done'); end if;
  if (select count(*) from farm.cup_done where user_id = uid and week = wk) >= r.week_tasks then return json_build_object('ok', false, 'code', 'week'); end if;
  if (select count(*) from farm.cup_done where user_id = uid and week = wk and day = today) >= r.day_tasks then return json_build_object('ok', false, 'code', 'day'); end if;
  insert into farm.cup_picks (user_id, week, kind, goal, points, minutes, hood_id) values (uid, wk, t.kind, t.goal, t.points, t.minutes, hid)
  on conflict (user_id) do update set week = excluded.week, kind = excluded.kind, goal = excluded.goal, points = excluded.points,
    minutes = excluded.minutes, hood_id = excluded.hood_id, picked_at = now();
  return json_build_object('ok', true, 'kind', t.kind, 'goal', t.goal, 'points', t.points, 'minutes', t.minutes);
end $$;

-- Give up my task now (it can be picked again).
create or replace function public.farm_cup_drop_v1()
returns text language plpgsql security definer set search_path = '' as $$
begin
  delete from farm.cup_picks where user_id = farm.me();
  return case when found then 'ok' else 'none' end;
end $$;

-- My task is done (the game counted it). The points go to my barangay. 'none' | 'late' (last week's: gone) | 'out'
-- (not in that barangay now) | 'guest' | 'soon' (sooner than it can be done; wait: seconds) | 'day' (3 today
-- already: keep it for tomorrow)
create or replace function public.farm_cup_done_v1()
returns json language plpgsql security definer set search_path = '' as $$
declare uid uuid := farm.me(); wk date := farm.nb_week(now()); today date := (now() at time zone 'Asia/Manila')::date;
  r record := farm.nb_rules(); pk farm.cup_picks; n int; total int; wait int;
begin
  perform pg_advisory_xact_lock(hashtextextended('farm_cup:' || uid::text, 0));
  select * into pk from farm.cup_picks where user_id = uid;
  if not found then return json_build_object('ok', false, 'code', 'none'); end if;
  if pk.week <> wk then delete from farm.cup_picks where user_id = uid; return json_build_object('ok', false, 'code', 'late'); end if;
  if farm.my_hood(uid) is distinct from pk.hood_id then delete from farm.cup_picks where user_id = uid; return json_build_object('ok', false, 'code', 'out'); end if;
  if not farm.nb_prize_ok(uid) then delete from farm.cup_picks where user_id = uid; return json_build_object('ok', false, 'code', 'guest'); end if;
  wait := ceil(pk.minutes * 60 - extract(epoch from now() - pk.picked_at))::int;
  if wait > 0 then return json_build_object('ok', false, 'code', 'soon', 'wait', wait); end if;
  if (select count(*) from farm.cup_done where user_id = uid and week = wk and day = today) >= r.day_tasks then return json_build_object('ok', false, 'code', 'day'); end if;
  if (select count(*) from farm.cup_done where user_id = uid and week = wk) >= r.week_tasks then
    delete from farm.cup_picks where user_id = uid;
    return json_build_object('ok', false, 'code', 'week');
  end if;
  delete from farm.cup_picks where user_id = uid;
  insert into farm.cup_done (user_id, week, kind, hood_id, points, day) values (uid, wk, pk.kind, pk.hood_id, pk.points, today)
  on conflict (user_id, week, kind) do nothing;
  if not found then return json_build_object('ok', false, 'code', 'none'); end if; -- (done already: counted once)
  -- the barangay's place in this week's Cup: made with the first task, in a group of its size; its size is the most
  -- of its members now and the players who scored for it this week, and a bigger one moves up a league
  select greatest((select count(*) from farm.hood_members where hood_id = pk.hood_id),
    (select count(distinct d.user_id) from farm.cup_done d where d.week = wk and d.hood_id = pk.hood_id)) into n;
  perform farm.cup_seat(wk, pk.hood_id, n::int, true);
  update farm.cup_hoods set score = score + pk.points, last_at = now() where week = wk and hood_id = pk.hood_id returning score into total;
  insert into farm.hood_posts (hood_id, user_id, kind, body) values (pk.hood_id, uid, 'task', pk.kind || ':' || pk.points);
  perform farm.hood_prune(pk.hood_id);
  return json_build_object('ok', true, 'kind', pk.kind, 'points', pk.points, 'score', total, 'place', farm.cup_place(wk, pk.hood_id));
end $$;

-- My prizes from finished weeks (the last 4): one a week, in the barangay I scored most for. The insert decides.
create or replace function public.farm_cup_claim_v1()
returns json language plpgsql security definer set search_path = '' as $$
declare uid uuid := farm.me(); wk date := farm.nb_week(now()); out json;
begin
  if not farm.nb_prize_ok(uid) then return '[]'::json; end if;
  with mine as (
    select d.week, d.hood_id, sum(d.points) as pts from farm.cup_done d
    where d.user_id = uid and d.week < wk and d.week >= wk - 28 group by d.week, d.hood_id),
  best as (select distinct on (m.week) m.week, m.hood_id from mine m order by m.week, m.pts desc, m.hood_id),
  placed as (
    select b.week, b.hood_id, c.name, c.score, farm.cup_place(b.week, b.hood_id) as place
    from best b join farm.cup_hoods c on c.week = b.week and c.hood_id = b.hood_id
    where not exists (select 1 from farm.cup_claims cl where cl.user_id = uid and cl.week = b.week)),
  won as (
    insert into farm.cup_claims (user_id, week, hood_id, place, gold, stars)
    select uid, p.week, p.hood_id, p.place, pr.gold, pr.stars from placed p cross join lateral farm.nb_prize(p.place, p.score) pr
    on conflict (user_id, week) do nothing
    returning week, hood_id, place, gold, stars)
  select coalesce(json_agg(json_build_object('week', w.week, 'place', w.place, 'gold', w.gold, 'stars', w.stars,
    'name', (select p.name from placed p where p.week = w.week)) order by w.week), '[]'::json) into out from won w;
  return out;
end $$;

-- ---------- who may call what (restated on every run: a recreated function comes back open) ----------
do $$
declare f text;
begin
  foreach f in array array['farm_nb_v1()', 'farm_nb_create_v1(text, text, boolean)', 'farm_nb_find_v1(text)', 'farm_nb_join_v1(bigint, text)',
    'farm_nb_leave_v1()', 'farm_nb_set_v1(boolean)', 'farm_nb_kick_v1(uuid)', 'farm_nb_members_v1()', 'farm_nb_post_v1(text)', 'farm_nb_posts_v1()',
    'farm_cup_pick_v1(text)', 'farm_cup_drop_v1()', 'farm_cup_done_v1()', 'farm_cup_claim_v1()', 'farm_nb_code_v1()']
  loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
reset lock_timeout;

-- ---------- to undo part 16 ----------
-- drop function if exists public.farm_nb_v1(), public.farm_nb_create_v1(text, text, boolean), public.farm_nb_find_v1(text),
--   public.farm_nb_join_v1(bigint, text), public.farm_nb_leave_v1(), public.farm_nb_set_v1(boolean), public.farm_nb_kick_v1(uuid),
--   public.farm_nb_code_v1(), public.farm_nb_members_v1(), public.farm_nb_post_v1(text), public.farm_nb_posts_v1(), public.farm_cup_pick_v1(text),
--   public.farm_cup_drop_v1(), public.farm_cup_done_v1(), public.farm_cup_claim_v1();
-- drop trigger if exists snapshot_gone_leave_hood on farm.snapshots;
-- drop table if exists farm.cup_claims, farm.cup_hoods, farm.cup_done, farm.cup_picks, farm.cup_kinds, farm.hood_posts, farm.hood_bans, farm.nb_log,
--   farm.hood_members, farm.hoods;
-- drop function if exists farm.hood_member_gone(), farm.snapshot_gone_leave_hood(), farm.cup_seat(date, bigint, int, boolean), farm.cup_tasks(date),
--   farm.cup_place(date, bigint), farm.hood_note(bigint, uuid, text), farm.hood_fix_lead(bigint), farm.hood_lead(bigint), farm.hood_prune(bigint),
--   farm.my_hood(uuid), farm.nb_rules(), farm.nb_prize(int, int), farm.nb_week(timestamptz), farm.nb_prize_ok(uuid), farm.nb_clean(text),
--   farm.nb_ok(uuid), farm.cup_league(int);
