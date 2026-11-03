-- Harvest Ville online, part 15 (4 Nov 2026). Run AFTER parts 1-14. The Fishing Derby (owner, 4 Nov: "Fishing Derby on
-- Mondays: the Biggest catch board, but for fish"): on Fish Monday every fish a player lands is weighed, and the
-- biggest of each kind goes on that Monday's board. The board stays up all week, until the next Monday.
-- Additive: two new tables, two new functions for the game and two helpers; nothing that exists changes.
-- Monday is the Philippines' Monday (the game's own clock is the phone's). So that a phone a few hours off still
-- counts, a catch is taken while it is Monday in Manila or in UTC (Monday 00:00 to Tuesday 08:00, Manila time).
set lock_timeout = '5s';

-- Each fish's usual weight (the game's numbers, 00-zzzzzmore.js). A fish is 0.8 to 1.6 times that.
create table farm.derby_fish (
  kind text primary key,
  kg numeric not null check (kg > 0)
);
insert into farm.derby_fish (kind, kg) values ('fish_s', 0.3), ('fish_m', 1.2), ('fish_l', 3.5), ('fish_k', 12);

-- Your biggest of each fish, each Derby (its Monday). g: grams.
create table farm.derby (
  user_id uuid not null references farm.players (user_id) on delete cascade,
  monday date not null,
  kind text not null references farm.derby_fish (kind),
  g int not null check (g > 0),
  at timestamptz not null default now(),
  primary key (monday, kind, user_id)
);
alter table farm.derby_fish enable row level security;
alter table farm.derby enable row level security;
revoke all on farm.derby_fish, farm.derby from public, anon, authenticated;

-- The Monday of this week in Manila (the Derby being played, or the last one).
create function farm.derby_monday() returns date
language sql stable set search_path = '' as $$
  select (now() at time zone 'Asia/Manila')::date - (extract(isodow from now() at time zone 'Asia/Manila')::int - 1);
$$;

-- Whether the Derby is on (Monday in Manila or in UTC).
create function farm.derby_open() returns boolean
language sql stable set search_path = '' as $$
  select extract(isodow from now() at time zone 'Asia/Manila') = 1 or extract(isodow from now() at time zone 'UTC') = 1;
$$;

create function public.farm_derby_v1(p_kind text, p_g int)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare uid uuid := farm.me(); base numeric; mon date := farm.derby_monday(); best int; place int;
begin
  if not farm.derby_open() then return jsonb_build_object('ok', false, 'code', 'not-monday'); end if;
  select kg into base from farm.derby_fish where kind = p_kind;
  if base is null then return jsonb_build_object('ok', false, 'code', 'bad-kind'); end if;
  if p_g is null or p_g < floor(base * 800) or p_g > ceil(base * 1600) then return jsonb_build_object('ok', false, 'code', 'bad-weight'); end if;
  insert into farm.derby (user_id, monday, kind, g) values (uid, mon, p_kind, p_g)
  on conflict (monday, kind, user_id) do update set g = excluded.g, at = now() where farm.derby.g < excluded.g;
  select g into best from farm.derby where user_id = uid and monday = mon and kind = p_kind;
  select 1 + count(*) into place from farm.derby d join farm.players pl on pl.user_id = d.user_id
  where d.monday = mon and d.kind = p_kind and d.g > best and not pl.hidden;
  return jsonb_build_object('ok', true, 'best', best, 'rank', place);
end $$;

-- The top 10 for one fish at this week's Derby, and your own place under them if you are not in it.
create function public.farm_derby_board_v1(p_kind text)
returns table (rank int, id uuid, farm_name text, g int, me boolean)
language sql stable security definer set search_path = '' as $$
  with me as (select farm.me() as uid),
  board as (
    select (1 + (select count(*) from farm.derby o join farm.players op on op.user_id = o.user_id
                 where o.monday = d.monday and o.kind = d.kind and o.g > d.g and not op.hidden))::int as rank,
      d.user_id, pl.farm_name, d.g, d.at
    from farm.derby d join farm.players pl on pl.user_id = d.user_id
    where d.monday = farm.derby_monday() and d.kind = p_kind and (not pl.hidden or d.user_id = (select uid from me))
      and not farm.blocked((select uid from me), d.user_id)
  )
  select b.rank, b.user_id, b.farm_name, b.g, b.user_id = me.uid
  from board b, me
  where b.rank <= 10 or b.user_id = me.uid
  order by b.rank, b.at
  limit 11;
$$;

revoke all on function farm.derby_monday(), farm.derby_open() from public, anon;
revoke all on function public.farm_derby_v1(text, int), public.farm_derby_board_v1(text) from public, anon;
grant execute on function public.farm_derby_v1(text, int), public.farm_derby_board_v1(text) to authenticated;

-- ---------- undo ----------
-- drop function public.farm_derby_v1(text, int), public.farm_derby_board_v1(text), farm.derby_monday(), farm.derby_open();
-- drop table farm.derby, farm.derby_fish;
