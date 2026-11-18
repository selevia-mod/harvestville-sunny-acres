-- Harvest Ville online: the barangays' weekly City Orders (18 Nov 2026; step 3 of the truck plan, owner approved: "12,
-- Barangay"; docs/superpowers/specs/2026-11-18-trucks-and-city-orders-design.md). NOT APPLIED: the owner applies it.
-- Run AFTER part 1 (farm.players, farm.me) and part 16 (farm.hoods, farm.hood_members, farm.my_hood, farm.nb_week).
-- (The game's side: src/*trucks*.js. Until this is applied the game's City Order board says "City Orders open soon",
-- calls nothing else and takes nothing from a player.)
--   THE ORDER. Each barangay gets one a week, Monday 08:00 to Sunday 19:00 Asia/Manila: 4 crops, the same for every member.
--     The game works the 4 out from the week and the barangay's id (the same on every phone) and sends them with the first
--     look of the week; the server checks each is a farm crop it knows (farm.co_crops) and keeps the order (the first one
--     made wins, a later look changes nothing). How many of each: 150 for every 5 members (600 crops per 5 in all),
--     counted when the week's order is made, at most 30 members (900 of each).
--   DELIVERIES. A member delivers n of one of its crops; the server counts what the order still needs (never more, at
--     most per_call at a time) and says how many it took: the game takes only those out of the vehicle and pays the 2x
--     there (the gold is the game's, as the Grand Market's). Each delivery has the game's id: asked again (an answer lost
--     on the way) it gives the same answer and counts nothing twice. One member at a time (a lock), one order at a time
--     (its row locked): two members delivering at once never go over.
--   THE PRIZE. When every crop is filled the order is done. Each member who delivered to it claims once (a row keyed
--     player + week): 3 Market Stars, and the barangay's first finished order a plaque too. A claim asked again returns
--     the same rows: the game pays each week once (it keeps the last week paid). Claims stay open 4 weeks.
-- Additive: new tables (row level security on, no policies: only these functions read or write them) and functions.
-- Nothing that exists changes. Safe to run twice. Runs as ONE transaction in the SQL editor.
--   farm_city_order_v1(p_kinds text[])                   { ok, week, hood, name, members, kinds, need, got, mine, done, ends_in }
--                                                        | { ok: false, code: 'closed' | 'hood' | 'kinds' (send them), hood, members }
--   farm_city_deliver_v1(p_kind text, p_n int, p_request_id uuid)
--                                                        { ok, took, left, done, again } | { ok: false, code: 'closed' | 'hood' |
--                                                          'none' (look first) | 'done' | 'kind' | 'full' | 'bad' }
--   farm_city_claim_v1()                                 [{ week, stars, plaque }] (this week's and the 4 before, new and old)
set lock_timeout = '5s';

-- ---------- the numbers ----------
create or replace function farm.co_rules(out kinds int, out per5 int, out stars int, out most int, out per_call int, out claim_weeks int)
language sql immutable set search_path = '' as $$
  select 4, 600, 3, 30, 2000, 4;
$$;

-- This week's Monday while its City Order is open (Monday 08:00 to Sunday 19:00 in the Philippines), else null.
create or replace function farm.co_week(t timestamptz) returns date
language sql stable set search_path = '' as $$
  select case when (t at time zone 'Asia/Manila') >= x.w + time '08:00' and (t at time zone 'Asia/Manila') < x.w + 6 + time '19:00' then x.w end
  from (select farm.nb_week(t) as w) x;
$$;

-- ---------- the tables ----------
-- The crops an order may ask (the game's farm crops: L.gmCrops). A new crop in the game: insert it here too.
create table if not exists farm.co_crops (
  crop text primary key check (crop ~ '^[a-z][a-z0-9_]{0,39}$')
);
insert into farm.co_crops (crop) values
  ('turnip'), ('potato'), ('strawberry'), ('tomato'), ('corn'), ('carrot'), ('pumpkin'), ('radish'), ('lettuce'), ('peas'), ('cabbage'),
  ('cauliflower'), ('onion'), ('tulip'), ('okra'), ('chili'), ('cucumber'), ('bell_pepper'), ('eggplant'), ('sunflower'), ('melon'),
  ('watermelon'), ('spinach'), ('bok_choy'), ('beet'), ('garlic'), ('sweet_potato'), ('cranberry'), ('rice'), ('grapes'), ('kale'), ('celery'),
  ('broccoli'), ('leek'), ('parsnip'), ('red_cabbage'), ('brussels'), ('ginger'), ('winter_squash'), ('coffee'), ('wheat'), ('rose'),
  ('sampaguita'), ('gumamela'), ('cotton'), ('sugarcane'), ('cacao'), ('oregano'), ('banana'), ('oats'), ('peanut'), ('cassava'), ('taro'),
  ('mung_bean'), ('pineapple'), ('bitter_gourd')
on conflict (crop) do nothing;
-- A barangay's order in a week. (No foreign key to the barangay: a week's results stay if it closes.) first: it was the
-- barangay's first order done (its members' plaque).
create table if not exists farm.city_orders (
  week date not null,
  hood_id bigint not null,
  kinds text[] not null check (cardinality(kinds) = 4),
  need int not null check (need between 1 and 100000),
  got int[] not null default array[0, 0, 0, 0] check (cardinality(got) = 4),
  members int not null check (members >= 0),
  done_at timestamptz,
  first boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (week, hood_id)
);
create index if not exists city_orders_done on farm.city_orders (hood_id, week) where done_at is not null;
-- What each member delivered to an order (each crop).
create table if not exists farm.city_order_gives (
  week date not null,
  hood_id bigint not null,
  user_id uuid not null references farm.players (user_id) on delete cascade,
  got int[] not null default array[0, 0, 0, 0] check (cardinality(got) = 4),
  at timestamptz not null default now(),
  primary key (week, hood_id, user_id)
);
create index if not exists city_order_gives_user on farm.city_order_gives (user_id, week);
-- The deliveries already counted, by the game's id (kept 3 days: a phone asks an unanswered one again within minutes).
create table if not exists farm.city_order_requests (
  id uuid primary key,
  user_id uuid not null references farm.players (user_id) on delete cascade,
  week date not null,
  hood_id bigint not null,
  kind text not null,
  took int not null check (took >= 0),
  done boolean not null default false,
  at timestamptz not null default now()
);
create index if not exists city_order_requests_user on farm.city_order_requests (user_id, at);
-- The prizes, one a player a week.
create table if not exists farm.city_order_claims (
  user_id uuid not null references farm.players (user_id) on delete cascade,
  week date not null,
  hood_id bigint not null,
  stars int not null check (stars >= 0),
  plaque boolean not null default false,
  claimed_at timestamptz not null default now(),
  primary key (user_id, week)
);
alter table farm.co_crops enable row level security;
alter table farm.city_orders enable row level security;
alter table farm.city_order_gives enable row level security;
alter table farm.city_order_requests enable row level security;
alter table farm.city_order_claims enable row level security;
revoke all on farm.co_crops, farm.city_orders, farm.city_order_gives, farm.city_order_requests, farm.city_order_claims from public, anon, authenticated;
revoke all on function farm.co_rules(), farm.co_week(timestamptz) from public, anon, authenticated;

-- ---------- the functions the game calls ----------

-- My barangay's order this week (made on the first look, with the game's 4 crops).
create or replace function public.farm_city_order_v1(p_kinds text[] default null)
returns json language plpgsql security definer set search_path = '' as $$
declare uid uuid := farm.me(); wk date := farm.co_week(now()); r record := farm.co_rules(); hid bigint; o farm.city_orders; h farm.hoods;
  n int; mine int[];
begin
  if wk is null then return json_build_object('ok', false, 'code', 'closed'); end if;
  hid := farm.my_hood(uid);
  if hid is null then return json_build_object('ok', false, 'code', 'hood'); end if;
  select * into o from farm.city_orders where week = wk and hood_id = hid;
  if not found then
    select count(*) into n from farm.hood_members where hood_id = hid;
    if p_kinds is null or cardinality(p_kinds) is distinct from r.kinds
      or (select count(distinct k) from unnest(p_kinds) k) <> r.kinds
      or exists (select 1 from unnest(p_kinds) k where not exists (select 1 from farm.co_crops c where c.crop = k)) then
      return json_build_object('ok', false, 'code', 'kinds', 'hood', hid, 'members', n);
    end if;
    insert into farm.city_orders (week, hood_id, kinds, need, members)
    values (wk, hid, p_kinds, (r.per5 / r.kinds) * greatest(1, ceil(least(n, r.most) / 5.0)::int), n)
    on conflict (week, hood_id) do nothing;
    select * into o from farm.city_orders where week = wk and hood_id = hid;
  end if;
  select * into h from farm.hoods where id = hid;
  select g.got into mine from farm.city_order_gives g where g.week = wk and g.hood_id = hid and g.user_id = uid;
  return json_build_object('ok', true, 'week', to_char(wk, 'YYYY-MM-DD'), 'hood', hid, 'name', h.name, 'members', o.members,
    'kinds', to_json(o.kinds), 'need', o.need, 'got', to_json(o.got), 'mine', to_json(coalesce(mine, array[0, 0, 0, 0])),
    'done', o.done_at is not null,
    'ends_in', greatest(0, extract(epoch from ((wk + 6 + time '19:00') at time zone 'Asia/Manila') - now())::int));
end $$;

-- Deliver p_n of p_kind to my barangay's order: the server takes what it still needs (and says how many).
create or replace function public.farm_city_deliver_v1(p_kind text, p_n int, p_request_id uuid)
returns json language plpgsql security definer set search_path = '' as $$
declare uid uuid := farm.me(); wk date := farm.co_week(now()); r record := farm.co_rules(); hid bigint; o farm.city_orders;
  rq farm.city_order_requests; g int[]; i int; k int; v_done boolean; v_first boolean;
begin
  if p_request_id is null then return json_build_object('ok', false, 'code', 'bad'); end if;
  perform pg_advisory_xact_lock(hashtextextended('farm_city:' || uid::text, 0));
  select * into rq from farm.city_order_requests where id = p_request_id;
  if found then
    if rq.user_id <> uid then return json_build_object('ok', false, 'code', 'bad'); end if;
    return json_build_object('ok', true, 'took', rq.took, 'done', rq.done, 'again', true);
  end if;
  if wk is null then return json_build_object('ok', false, 'code', 'closed'); end if;
  hid := farm.my_hood(uid);
  if hid is null then return json_build_object('ok', false, 'code', 'hood'); end if;
  select * into o from farm.city_orders where week = wk and hood_id = hid for update;
  if not found then return json_build_object('ok', false, 'code', 'none'); end if;
  if o.done_at is not null then return json_build_object('ok', false, 'code', 'done'); end if;
  i := array_position(o.kinds, p_kind);
  if i is null then return json_build_object('ok', false, 'code', 'kind'); end if;
  g := o.got;
  k := least(greatest(coalesce(p_n, 0), 0), r.per_call, o.need - g[i]);
  if k <= 0 then return json_build_object('ok', false, 'code', 'full'); end if;
  g[i] := g[i] + k;
  v_done := (select bool_and(x >= o.need) from unnest(g) x);
  v_first := v_done and not exists (select 1 from farm.city_orders x where x.hood_id = hid and x.done_at is not null and x.week < wk);
  update farm.city_orders set got = g, done_at = case when v_done then now() end, first = coalesce(v_first, false)
  where week = wk and hood_id = hid;
  insert into farm.city_order_gives (week, hood_id, user_id) values (wk, hid, uid) on conflict (week, hood_id, user_id) do nothing;
  update farm.city_order_gives set got[i] = got[i] + k, at = now() where week = wk and hood_id = hid and user_id = uid;
  delete from farm.city_order_requests where user_id = uid and at < now() - interval '3 days';
  insert into farm.city_order_requests (id, user_id, week, hood_id, kind, took, done) values (p_request_id, uid, wk, hid, p_kind, k, v_done);
  return json_build_object('ok', true, 'took', k, 'left', o.need - g[i], 'done', v_done, 'again', false);
end $$;

-- My prizes: each finished order I delivered to (in the last 4 weeks) becomes a claim once; all of them are returned, so
-- an answer lost on the way is paid by the game on the next ask (it pays each week once).
create or replace function public.farm_city_claim_v1()
returns json language plpgsql security definer set search_path = '' as $$
declare uid uuid := farm.me(); r record := farm.co_rules(); wk date := farm.nb_week(now()); out json;
begin
  perform pg_advisory_xact_lock(hashtextextended('farm_city:' || uid::text, 0));
  insert into farm.city_order_claims (user_id, week, hood_id, stars, plaque)
  select uid, o.week, o.hood_id, r.stars, o.first
  from farm.city_order_gives g join farm.city_orders o on o.week = g.week and o.hood_id = g.hood_id
  where g.user_id = uid and o.done_at is not null and o.week >= wk - 7 * r.claim_weeks
    and exists (select 1 from unnest(g.got) x where x > 0)
  on conflict (user_id, week) do nothing;
  select coalesce(json_agg(json_build_object('week', to_char(c.week, 'YYYY-MM-DD'), 'stars', c.stars, 'plaque', c.plaque) order by c.week), '[]'::json)
  into out from farm.city_order_claims c where c.user_id = uid and c.week >= wk - 7 * r.claim_weeks;
  return out;
end $$;

-- ---------- who may call what (restated on every run: a recreated function comes back open) ----------
revoke all on function public.farm_city_order_v1(text[]), public.farm_city_deliver_v1(text, int, uuid), public.farm_city_claim_v1()
  from public, anon, authenticated;
grant execute on function public.farm_city_order_v1(text[]), public.farm_city_deliver_v1(text, int, uuid), public.farm_city_claim_v1()
  to authenticated;

reset lock_timeout;
notify pgrst, 'reload schema';

-- ---------- to undo ----------
-- (the game's board goes back to "City Orders open soon" by itself; deliveries waiting in a save go back to the vehicle)
-- drop function if exists public.farm_city_order_v1(text[]), public.farm_city_deliver_v1(text, int, uuid), public.farm_city_claim_v1(),
--   farm.co_week(timestamptz), farm.co_rules();
-- drop table if exists farm.city_order_claims, farm.city_order_requests, farm.city_order_gives, farm.city_orders, farm.co_crops;
-- notify pgrst, 'reload schema';
