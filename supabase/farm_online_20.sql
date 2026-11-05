-- Harvest Ville online, part 20 (6 Nov 2026). Run AFTER part 19 (it needs part 1's farm.players, farm.me and
-- farm.blocked, and part 16's barangays: farm.hoods, farm.my_hood and farm.nb_prize_ok).
-- Bayanihan Projects (owner, 6 Nov 2026: "Bayani Projects, i like this"; "we are loosing the real purpose of game, the
-- farm and town. We need to make it related to the town."). The whole of Harvest Ville builds Willowbrook together:
--   * One project at a time, in order (farm.bh_projects: the Old Bridge, the Market Hall, the Plaza Fountain, the Chapel
--     Bell, the Old Pier). Each needs things from every part of the game (farm.bh_needs). EVERY player gives toward the
--     same needs: one progress for the whole server. A gift made by a barangay member also counts for the barangay.
--   * When every need of a project is met, it is done (for everyone, at once) and the next one starts. The game changes
--     the town and opens the project's benefit when it sees it done.
--   * Fair play: nothing here takes Coins or Stars, and nothing can be bought. Each player may give at most day_max of
--     each thing a day (Philippine days) and at most `cap` points to one project, so nobody can flood it. Every gift
--     carries a request id: the same request again (a retry after a lost answer) gets its first answer back and counts
--     once. One gift at a time per player, and one at a time per project (a row lock), so two last gifts can never
--     both finish it, or both miss finishing it. Guests and banned or suspended accounts cannot give or claim.
--   * Rewards: everyone who gave to a done project claims once: Gold by tier (Helper: any gift; Builder: tier2 points;
--     Hero: tier3), and the game adds the project's title and yard piece. The amounts are here; the game never sends
--     one. A claim is a row keyed (project, player): a second claim gets the first one's answer back, and the game pays
--     a project's reward only once.
-- Additive: new tables (schema farm, row level security on, no policies, no grants) and new functions. Nothing that
-- exists changes. Safe to run twice (what is already there is kept, the starting numbers are not put back).
--   farm_project_state_v1()   { ok, current: { key, ord, cap, tiers: [points for Helper, Builder, Hero], gold: [each one's
--                               Gold], needs: [{ item, goal, have, pts, day_max, today }], mine,
--                               givers, top: [{ id, name, pts, me }] (10), hood: { name, pts } | null } | null (all
--                               done), done: [{ key, ago, mine, tier, claimed }], can_give }
--   farm_project_give_v1(p_item, p_n, p_request_id, p_project)
--                             { ok, project, item, n (taken: never more than asked, the need, the day or the cap allow),
--                               have, goal, today, mine, done (this gift finished the project), again (a retry) }
--                             | { ok: false, code: 'request-required' | 'not-player' | 'guest' | 'bad' | 'closed' (not
--                               needed now) | 'moved' (another project now) | 'met' (that need is full) | 'day' | 'cap' }
--   farm_project_claim_v1(p_project)  { ok, project, tier, gold, again } | { ok: false, code: 'bad' | 'not-done' |
--                               'none' (did not give) | 'guest' | 'not-player' }
-- To tune (numbers the owner may change at any time; gifts already made keep what they counted):
--   update farm.bh_needs set goal = 2000 where project = 'bridge' and item = 'lumber';
--   update farm.bh_projects set cap = 1000, tier2 = 200, gold3 = 3000 where key = 'market';
set local lock_timeout = '5s';

-- ---------- tables ----------
-- The projects, in order. cap: the most points one player may give to it. tier2 / tier3: the points for the Builder and
-- Hero rewards (Helper: any gift). gold1-3: each tier's Gold. done_at: when its last need was met.
create table if not exists farm.bh_projects (
  key text primary key check (key ~ '^[a-z]{1,16}$'),
  ord int not null unique check (ord between 1 and 100),
  cap int not null default 800 check (cap between 1 and 1000000),
  tier2 int not null default 150 check (tier2 >= 1),
  tier3 int not null default 500 check (tier3 >= 1),
  gold1 int not null default 300 check (gold1 between 0 and 100000),
  gold2 int not null default 1000 check (gold2 between 0 and 100000),
  gold3 int not null default 2500 check (gold3 between 0 and 100000),
  started_at timestamptz,
  done_at timestamptz
);

-- What each project needs: how many of a thing (a game item, or 'lumber' / 'stone'), the points each one counts for,
-- the most one player may give of it in a day, and how many the town has given so far.
create table if not exists farm.bh_needs (
  project text not null references farm.bh_projects (key) on delete cascade,
  item text not null check (item ~ '^[a-z_]{1,24}$'),
  pos smallint not null default 0,
  goal int not null check (goal between 1 and 10000000),
  pts int not null check (pts between 1 and 1000),
  day_max int not null check (day_max between 0 and 100000),
  have int not null default 0 check (have >= 0),
  primary key (project, item)
);

-- Every gift: its receipt (keyed by the game's request id), for the daily caps (day: in the Philippines) and retries.
create table if not exists farm.bh_gifts (
  user_id uuid not null references farm.players (user_id) on delete cascade,
  request_id uuid not null,
  project text not null references farm.bh_projects (key) on delete cascade,
  item text not null,
  n int not null check (n between 1 and 100000),
  pts int not null check (pts >= 0),
  hood_id bigint,
  day date not null,
  created_at timestamptz not null default now(),
  primary key (user_id, request_id)
);
create index if not exists bh_gifts_day on farm.bh_gifts (user_id, project, item, day);

-- Each player's total for a project (the top givers, the cap, the reward), and each barangay's.
create table if not exists farm.bh_givers (
  project text not null references farm.bh_projects (key) on delete cascade,
  user_id uuid not null references farm.players (user_id) on delete cascade,
  pts int not null default 0 check (pts >= 0),
  n int not null default 0 check (n >= 0),
  last_at timestamptz not null default now(),
  primary key (project, user_id)
);
create index if not exists bh_givers_top on farm.bh_givers (project, pts desc, last_at);
create index if not exists bh_givers_user on farm.bh_givers (user_id); -- (behind the on delete cascade)

create table if not exists farm.bh_hoods (
  project text not null references farm.bh_projects (key) on delete cascade,
  hood_id bigint not null references farm.hoods (id) on delete cascade,
  pts int not null default 0 check (pts >= 0),
  primary key (project, hood_id)
);
create index if not exists bh_hoods_hood on farm.bh_hoods (hood_id); -- (behind the on delete cascade)

-- A claimed reward: one row per project and player.
create table if not exists farm.bh_claims (
  project text not null references farm.bh_projects (key) on delete cascade,
  user_id uuid not null references farm.players (user_id) on delete cascade,
  tier int not null check (tier between 1 and 3),
  gold int not null check (gold >= 0),
  created_at timestamptz not null default now(),
  primary key (project, user_id)
);
create index if not exists bh_claims_user on farm.bh_claims (user_id); -- (behind the on delete cascade)

alter table farm.bh_projects enable row level security; -- (no policies: only the functions below read or write them)
alter table farm.bh_needs enable row level security;
alter table farm.bh_gifts enable row level security;
alter table farm.bh_givers enable row level security;
alter table farm.bh_hoods enable row level security;
alter table farm.bh_claims enable row level security;
revoke all on farm.bh_projects, farm.bh_needs, farm.bh_gifts, farm.bh_givers, farm.bh_hoods, farm.bh_claims from public, anon, authenticated;

-- ---------- the projects and what they need (the game shows the same: src/00-zzzzzzzzzzz-bayanihan.js) ----------
-- (on conflict do nothing: a second run keeps the numbers the owner tuned, and the progress)
insert into farm.bh_projects (key, ord) values ('bridge', 1), ('market', 2), ('fountain', 3), ('bell', 4), ('pier', 5)
on conflict (key) do nothing;
insert into farm.bh_needs (project, item, pos, goal, pts, day_max) values
  ('bridge', 'lumber', 1, 1500, 1, 60), ('bridge', 'stone', 2, 1000, 1, 60), ('bridge', 'ore_copper', 3, 400, 2, 25), ('bridge', 'fish_s', 4, 300, 2, 15),
  ('market', 'wheat', 1, 1500, 1, 60), ('market', 'egg', 2, 600, 2, 20), ('market', 'milk', 3, 300, 3, 12), ('market', 'bread', 4, 200, 4, 8),
  ('market', 'ore_silver', 5, 200, 3, 10),
  ('fountain', 'stone', 1, 1500, 1, 60), ('fountain', 'ore_silver', 2, 300, 3, 12), ('fountain', 'fish_m', 3, 200, 3, 10), ('fountain', 'butter', 4, 80, 6, 4),
  ('fountain', 'gem', 5, 40, 10, 2),
  ('bell', 'ore_copper', 1, 800, 2, 25), ('bell', 'ore_gold', 2, 250, 4, 8), ('bell', 'feather_labuyo', 3, 300, 1, 20), ('bell', 'antler', 4, 60, 5, 3),
  ('bell', 'cake', 5, 60, 8, 3),
  ('pier', 'lumber', 1, 2500, 1, 80), ('pier', 'meat_boar', 2, 150, 2, 6), ('pier', 'tusk', 3, 80, 4, 3), ('pier', 'fish_l', 4, 120, 5, 4),
  ('pier', 'cheese', 5, 60, 6, 3)
on conflict (project, item) do nothing;
update farm.bh_projects set started_at = now()
where started_at is null and ord = (select min(ord) from farm.bh_projects where done_at is null);

-- ---------- helpers (not callable by clients) ----------
-- Today in the Philippines (the daily caps turn over at midnight there, like the Bayanihan Cup).
create or replace function farm.bh_day() returns date
language sql stable set search_path = '' as $$ select (now() at time zone 'Asia/Manila')::date $$;

-- The reward tier for a player's points on a project: 0 none, 1 Helper, 2 Builder, 3 Hero.
create or replace function farm.bh_tier(p farm.bh_projects, p_pts int) returns int
language sql immutable set search_path = '' as $$
  select case when p_pts >= p.tier3 then 3 when p_pts >= p.tier2 then 2 when p_pts >= 1 then 1 else 0 end;
$$;

-- What a player gave of one thing to one project today.
create or replace function farm.bh_today(p_user uuid, p_project text, p_item text) returns int
language sql stable security definer set search_path = '' as $$
  select coalesce(sum(g.n), 0)::int from farm.bh_gifts g
  where g.user_id = p_user and g.project = p_project and g.item = p_item and g.day = farm.bh_day();
$$;

revoke all on function farm.bh_day(), farm.bh_tier(farm.bh_projects, int), farm.bh_today(uuid, text, text) from public, anon, authenticated;

-- ---------- the functions the game calls ----------

-- The board: the project on now (its needs with the town's progress and what I gave today, my points, the top 10
-- givers without anyone I blocked or who is hidden, my barangay's points), and the done ones with my reward.
create or replace function public.farm_project_state_v1()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare uid uuid := auth.uid(); cur farm.bh_projects; hid bigint; cur_j jsonb;
begin
  if uid is null then raise exception 'not signed in' using errcode = '28000'; end if;
  if not exists (select 1 from farm.players where user_id = uid) then return jsonb_build_object('ok', false, 'code', 'not-player'); end if;
  perform farm.me(); -- (a banned or suspended account: raises, as everywhere else)
  select * into cur from farm.bh_projects where done_at is null order by ord limit 1;
  if cur.key is not null then
    hid := farm.my_hood(uid);
    cur_j := jsonb_build_object(
      'key', cur.key, 'ord', cur.ord, 'cap', cur.cap,
      'tiers', jsonb_build_array(1, cur.tier2, cur.tier3), 'gold', jsonb_build_array(cur.gold1, cur.gold2, cur.gold3),
      'needs', (select coalesce(jsonb_agg(jsonb_build_object('item', n.item, 'goal', n.goal, 'have', n.have, 'pts', n.pts, 'day_max', n.day_max,
                  'today', farm.bh_today(uid, cur.key, n.item)) order by n.pos, n.item), '[]'::jsonb)
                from farm.bh_needs n where n.project = cur.key),
      'mine', coalesce((select g.pts from farm.bh_givers g where g.project = cur.key and g.user_id = uid), 0),
      'givers', (select count(*) from farm.bh_givers g where g.project = cur.key),
      'top', (select coalesce(jsonb_agg(jsonb_build_object('id', t.user_id, 'name', t.farm_name, 'pts', t.pts, 'me', t.user_id = uid) order by t.pts desc, t.last_at), '[]'::jsonb)
              from (select g.user_id, p.farm_name, g.pts, g.last_at from farm.bh_givers g join farm.players p on p.user_id = g.user_id
                    where g.project = cur.key and (g.user_id = uid or (not p.hidden and not farm.blocked(uid, g.user_id)))
                    order by g.pts desc, g.last_at limit 10) t),
      'hood', (select jsonb_build_object('name', h.name, 'pts', coalesce(b.pts, 0))
               from farm.hoods h left join farm.bh_hoods b on b.hood_id = h.id and b.project = cur.key where h.id = hid));
  end if;
  return jsonb_build_object('ok', true, 'current', cur_j, 'can_give', farm.nb_prize_ok(uid),
    'done', (select coalesce(jsonb_agg(jsonb_build_object('key', p.key, 'ago', floor(extract(epoch from now() - p.done_at))::bigint,
               'mine', coalesce(g.pts, 0), 'tier', farm.bh_tier(p, coalesce(g.pts, 0)), 'claimed', c.user_id is not null) order by p.ord), '[]'::jsonb)
             from farm.bh_projects p
             left join farm.bh_givers g on g.project = p.key and g.user_id = uid
             left join farm.bh_claims c on c.project = p.key and c.user_id = uid
             where p.done_at is not null));
end $$;

-- Give p_n of p_item to the project on now (p_project: the one the game thinks is on; another one now = 'moved', so a
-- gift never lands somewhere the player did not mean). The game takes the things out of its bag only on ok, and only
-- n of them: the server takes no more than the need, the player's day and the player's cap allow.
create or replace function public.farm_project_give_v1(p_item text, p_n int, p_request_id uuid, p_project text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); g farm.bh_gifts; cur farm.bh_projects; nd farm.bh_needs; today date := farm.bh_day();
  given int; mine int; take int; hid bigint; finished boolean := false;
begin
  if uid is null then raise exception 'not signed in' using errcode = '28000'; end if;
  if p_request_id is null then return jsonb_build_object('ok', false, 'code', 'request-required'); end if;
  if not exists (select 1 from farm.players where user_id = uid) then return jsonb_build_object('ok', false, 'code', 'not-player'); end if;
  perform farm.me();
  -- one gift at a time per player: a retried request (the same id), even at the same moment, finds its receipt
  perform pg_advisory_xact_lock(hashtextextended('farm_bh:' || uid::text, 0));
  select * into g from farm.bh_gifts where user_id = uid and request_id = p_request_id;
  if found then
    select * into nd from farm.bh_needs where project = g.project and item = g.item;
    return jsonb_build_object('ok', true, 'again', true, 'project', g.project, 'item', g.item, 'n', g.n, 'have', nd.have, 'goal', nd.goal,
      'today', farm.bh_today(uid, g.project, g.item),
      'mine', coalesce((select x.pts from farm.bh_givers x where x.project = g.project and x.user_id = uid), 0),
      'done', exists (select 1 from farm.bh_projects p where p.key = g.project and p.done_at is not null));
  end if;
  if not farm.nb_prize_ok(uid) then return jsonb_build_object('ok', false, 'code', 'guest'); end if;
  if p_item is null or p_n is null or p_n < 1 or p_n > 100000 then return jsonb_build_object('ok', false, 'code', 'bad'); end if;
  -- the project on now, locked: gifts to one project go one at a time, so its last need is seen met exactly once
  select * into cur from farm.bh_projects where done_at is null order by ord limit 1 for update;
  if cur.key is null then return jsonb_build_object('ok', false, 'code', 'closed'); end if;
  if p_project is not null and p_project <> cur.key then return jsonb_build_object('ok', false, 'code', 'moved', 'project', cur.key); end if;
  select * into nd from farm.bh_needs where project = cur.key and item = p_item;
  if not found then return jsonb_build_object('ok', false, 'code', 'closed'); end if;
  if nd.have >= nd.goal then return jsonb_build_object('ok', false, 'code', 'met'); end if;
  given := farm.bh_today(uid, cur.key, p_item);
  if given >= nd.day_max then return jsonb_build_object('ok', false, 'code', 'day'); end if;
  mine := coalesce((select x.pts from farm.bh_givers x where x.project = cur.key and x.user_id = uid), 0);
  if mine + nd.pts > cur.cap then return jsonb_build_object('ok', false, 'code', 'cap'); end if;
  take := least(p_n, nd.goal - nd.have, nd.day_max - given, (cur.cap - mine) / nd.pts);
  hid := farm.my_hood(uid);
  insert into farm.bh_gifts (user_id, request_id, project, item, n, pts, hood_id, day)
  values (uid, p_request_id, cur.key, p_item, take, take * nd.pts, hid, today);
  update farm.bh_needs set have = have + take where project = cur.key and item = p_item returning * into nd;
  insert into farm.bh_givers as x (project, user_id, pts, n, last_at) values (cur.key, uid, take * nd.pts, take, now())
  on conflict (project, user_id) do update set pts = x.pts + excluded.pts, n = x.n + excluded.n, last_at = now();
  if hid is not null then
    insert into farm.bh_hoods as x (project, hood_id, pts) values (cur.key, hid, take * nd.pts)
    on conflict (project, hood_id) do update set pts = x.pts + excluded.pts;
  end if;
  if not exists (select 1 from farm.bh_needs n where n.project = cur.key and n.have < n.goal) then
    update farm.bh_projects set done_at = now() where key = cur.key;
    update farm.bh_projects set started_at = now()
    where started_at is null and ord = (select min(p.ord) from farm.bh_projects p where p.done_at is null);
    finished := true;
  end if;
  return jsonb_build_object('ok', true, 'project', cur.key, 'item', p_item, 'n', take, 'have', nd.have, 'goal', nd.goal,
    'today', given + take, 'mine', mine + take * nd.pts, 'done', finished);
end $$;

-- Claim my reward for a done project I gave to (once: a second claim gets the first one's answer, marked again).
create or replace function public.farm_project_claim_v1(p_project text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); p farm.bh_projects; c farm.bh_claims; mine int; t int; gold int;
begin
  if uid is null then raise exception 'not signed in' using errcode = '28000'; end if;
  if not exists (select 1 from farm.players where user_id = uid) then return jsonb_build_object('ok', false, 'code', 'not-player'); end if;
  perform farm.me();
  select * into p from farm.bh_projects where key = p_project;
  if not found then return jsonb_build_object('ok', false, 'code', 'bad'); end if;
  if p.done_at is null then return jsonb_build_object('ok', false, 'code', 'not-done'); end if;
  select * into c from farm.bh_claims where project = p.key and user_id = uid;
  if found then return jsonb_build_object('ok', true, 'again', true, 'project', p.key, 'tier', c.tier, 'gold', c.gold); end if;
  if not farm.nb_prize_ok(uid) then return jsonb_build_object('ok', false, 'code', 'guest'); end if;
  mine := coalesce((select g.pts from farm.bh_givers g where g.project = p.key and g.user_id = uid), 0);
  t := farm.bh_tier(p, mine);
  if t = 0 then return jsonb_build_object('ok', false, 'code', 'none'); end if;
  gold := case t when 3 then p.gold3 when 2 then p.gold2 else p.gold1 end;
  insert into farm.bh_claims (project, user_id, tier, gold) values (p.key, uid, t, gold) on conflict (project, user_id) do nothing;
  if not found then -- (a claim at the same moment got in first: its answer)
    select * into c from farm.bh_claims where project = p.key and user_id = uid;
    return jsonb_build_object('ok', true, 'again', true, 'project', p.key, 'tier', c.tier, 'gold', c.gold);
  end if;
  return jsonb_build_object('ok', true, 'project', p.key, 'tier', t, 'gold', gold);
end $$;

-- ---------- who may call what (restated on every run) ----------
revoke all on function public.farm_project_state_v1(), public.farm_project_give_v1(text, int, uuid, text), public.farm_project_claim_v1(text)
  from public, anon, authenticated;
grant execute on function public.farm_project_state_v1(), public.farm_project_give_v1(text, int, uuid, text), public.farm_project_claim_v1(text)
  to authenticated;

reset lock_timeout;
notify pgrst, 'reload schema';

-- ---------- to undo part 20 ----------
-- (first an app without Bayanihan Projects, or one that hides them quietly when the functions are missing: this one does)
-- drop function if exists public.farm_project_state_v1(), public.farm_project_give_v1(text, int, uuid, text), public.farm_project_claim_v1(text),
--   farm.bh_today(uuid, text, text), farm.bh_tier(farm.bh_projects, int), farm.bh_day();
-- drop table if exists farm.bh_claims, farm.bh_hoods, farm.bh_givers, farm.bh_gifts, farm.bh_needs, farm.bh_projects;
-- notify pgrst, 'reload schema';
