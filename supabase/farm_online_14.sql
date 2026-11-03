-- Harvest Ville online, part 14 (3 Nov 2026). Run AFTER parts 1-13. Hunting together (owner, 3 Nov: "i like the hunting
-- ideas"): who is out hunting right now (so a player on their own can find a partner for the Great Mammoth), a friend
-- request to someone you just hunted with, and the biggest catch of the week for each animal.
-- Additive: two new tables and five new functions; nothing that exists changes. The friend request by id uses the same
-- rules as adding a friend code (it looks the code up and calls farm_friend_add_v1).
set lock_timeout = '5s';

-- ---------- who is hunting now ----------
-- One row while you are in the Wild Lands in your own game (the game says when you go in and come out). You show up
-- only while you are online (seen in the last 2 minutes), to your friends, and to everyone if your farm is listed.
create table farm.hunting (
  user_id uuid primary key references farm.players (user_id) on delete cascade,
  map text not null check (map in ('pulag', 'makiling', 'magayon')),
  since timestamptz not null default now()
);
alter table farm.hunting enable row level security;
revoke all on farm.hunting from public, anon, authenticated;

create function public.farm_hunt_here_v1(p_map text)
returns void language plpgsql security definer set search_path = '' as $$
declare uid uuid := farm.me();
begin
  update farm.players set last_seen_at = now() where user_id = uid;
  if p_map is null then delete from farm.hunting where user_id = uid; return; end if;
  if p_map not in ('pulag', 'makiling', 'magayon') then raise exception 'bad map' using errcode = '22023'; end if;
  insert into farm.hunting (user_id, map) values (uid, p_map)
  on conflict (user_id) do update set map = excluded.map, since = case when farm.hunting.map = excluded.map then farm.hunting.since else now() end;
end $$;

create function public.farm_hunting_v1()
returns table (id uuid, farm_name text, map text, friend boolean, minutes int)
language sql stable security definer set search_path = '' as $$
  with me as (select farm.me() as uid)
  select pl.user_id, pl.farm_name, h.map, farm.are_friends(me.uid, pl.user_id),
    greatest(0, floor(extract(epoch from now() - h.since) / 60))::int
  from me join farm.hunting h on h.user_id <> me.uid
  join farm.players pl on pl.user_id = h.user_id
  where pl.last_seen_at > now() - interval '2 minutes' and not farm.blocked(me.uid, pl.user_id)
    and (farm.are_friends(me.uid, pl.user_id) or (pl.listed and not pl.hidden))
  order by 4 desc, (h.map = 'magayon') desc, h.since
  limit 20;
$$;

-- ---------- a friend request to someone you hunted with ----------
create function public.farm_friend_ask_v1(p_other uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare uid uuid := farm.me(); code text;
begin
  select friend_code into code from farm.players where user_id = p_other;
  if code is null then return 'nocode'; end if;
  return public.farm_friend_add_v1(code);
end $$;

-- ---------- the biggest catch of the week ----------
-- Each animal's usual weight (the game's own numbers, 00-wild.js and 00-zmagayon.js). An animal is 0.9 to 1.1 times
-- that, a giant up to 1.35 times; a weight no animal can have is refused.
create table farm.catch_kinds (
  kind text primary key,
  kg numeric not null check (kg > 0)
);
insert into farm.catch_kinds (kind, kg) values
  ('rabbit', 2), ('labuyo', 1.4), ('deer', 60), ('boar', 90), ('wolf', 40), ('whitedeer', 75), ('goldboar', 120),
  ('bear', 180), ('mammoth', 4000), ('tiger', 200), ('rhino', 1500), ('greatmammoth', 7000);

-- Your biggest of each animal, each week (Monday to Sunday, UTC, as the other rankings). kg10: tenths of a kg.
create table farm.catches (
  user_id uuid not null references farm.players (user_id) on delete cascade,
  week date not null,
  kind text not null references farm.catch_kinds (kind),
  kg10 int not null check (kg10 > 0),
  at timestamptz not null default now(),
  primary key (week, kind, user_id)
);
alter table farm.catch_kinds enable row level security;
alter table farm.catches enable row level security;
revoke all on farm.catch_kinds, farm.catches from public, anon, authenticated;

create function public.farm_catch_v1(p_kind text, p_kg10 int)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare uid uuid := farm.me(); base numeric; wk date := farm.week_of(now()); best int; place int;
begin
  select kg into base from farm.catch_kinds where kind = p_kind;
  if base is null then return jsonb_build_object('ok', false, 'code', 'bad-kind'); end if;
  if p_kg10 is null or p_kg10 < floor(base * 9) or p_kg10 > ceil(base * 13.5) then return jsonb_build_object('ok', false, 'code', 'bad-weight'); end if;
  insert into farm.catches (user_id, week, kind, kg10) values (uid, wk, p_kind, p_kg10)
  on conflict (week, kind, user_id) do update set kg10 = excluded.kg10, at = now() where farm.catches.kg10 < excluded.kg10;
  select kg10 into best from farm.catches where user_id = uid and week = wk and kind = p_kind;
  select 1 + count(*) into place from farm.catches c join farm.players pl on pl.user_id = c.user_id
  where c.week = wk and c.kind = p_kind and c.kg10 > best and not pl.hidden;
  return jsonb_build_object('ok', true, 'best', best, 'rank', place);
end $$;

-- The top 10 for one animal this week, and your own place under them if you are not in it.
create function public.farm_catch_board_v1(p_kind text)
returns table (rank int, id uuid, farm_name text, kg10 int, me boolean)
language sql stable security definer set search_path = '' as $$
  with me as (select farm.me() as uid),
  board as (
    select (1 + (select count(*) from farm.catches o join farm.players op on op.user_id = o.user_id
                 where o.week = c.week and o.kind = c.kind and o.kg10 > c.kg10 and not op.hidden))::int as rank,
      c.user_id, pl.farm_name, c.kg10, c.at
    from farm.catches c join farm.players pl on pl.user_id = c.user_id
    where c.week = farm.week_of(now()) and c.kind = p_kind and (not pl.hidden or c.user_id = (select uid from me))
      and not farm.blocked((select uid from me), c.user_id)
  )
  select b.rank, b.user_id, b.farm_name, b.kg10, b.user_id = me.uid
  from board b, me
  where b.rank <= 10 or b.user_id = me.uid
  order by b.rank, b.at
  limit 11;
$$;

revoke all on function public.farm_hunt_here_v1(text), public.farm_hunting_v1(), public.farm_friend_ask_v1(uuid),
  public.farm_catch_v1(text, int), public.farm_catch_board_v1(text) from public, anon;
grant execute on function public.farm_hunt_here_v1(text), public.farm_hunting_v1(), public.farm_friend_ask_v1(uuid),
  public.farm_catch_v1(text, int), public.farm_catch_board_v1(text) to authenticated;

-- ---------- undo ----------
-- drop function public.farm_hunt_here_v1(text), public.farm_hunting_v1(), public.farm_friend_ask_v1(uuid),
--   public.farm_catch_v1(text, int), public.farm_catch_board_v1(text);
-- drop table farm.catches, farm.catch_kinds, farm.hunting;
