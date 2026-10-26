-- Harvest Ville online, part 2 (26 Oct 2026): weekly rank prizes and Selebox alerts for farm friends.
-- Run AFTER farm_online.sql (already applied on Selebox). Additive: one table, three functions, one alert switch.
--   * farm.prizes + farm_prizes_v1(): last week's top 10 on each board (Home Beauty, gold earned, daily quests) win
--     Sunbeams and gold, claimed once by the game when it opens.
--   * farm.alert(): a Selebox notification (type 'farm_alert', the bell and a push) when someone visits your farm,
--     leaves a gift, sends a message, or asks / agrees to be friends. Off with app_config sunny_acres_alerts = 'off'.
set lock_timeout = '5s';

-- ---------- weekly prizes ----------
create table farm.prizes (
  user_id uuid not null references farm.players (user_id) on delete cascade,
  week date not null,
  kind text not null check (kind in ('beauty', 'earned', 'quests')),
  rank int not null check (rank between 1 and 10),
  gold int not null default 0,
  stars int not null default 0,
  created_at timestamptz not null default now(),
  primary key (user_id, week, kind)
);
alter table farm.prizes enable row level security;
revoke all on farm.prizes from public, anon, authenticated;

-- The prize for a rank: 1st 5,000G + 5 Sunbeams, 2nd 3,000G + 3, 3rd 2,000G + 2, 4th-10th 1,000G + 1.
create function farm.prize_for(r int) returns table (gold int, stars int)
language sql immutable set search_path = '' as $$
  select case r when 1 then 5000 when 2 then 3000 when 3 then 2000 else 1000 end,
         case r when 1 then 5 when 2 then 3 when 3 then 2 else 1 end;
$$;
revoke all on function farm.prize_for(int) from public, anon, authenticated;

-- My prizes from last week that I have not had yet (each board once): the game adds them to the farm.
create function public.farm_prizes_v1()
returns table (kind text, rank int, gold int, stars int, week date)
language plpgsql security definer set search_path = '' as $$
declare uid uuid := farm.me(); wk date := farm.week_of(now()) - 7;
begin
  return query
  with ranked as (
    select s.user_id, k.kind,
      case k.kind when 'beauty' then s.beauty::bigint when 'earned' then s.earned else s.quests::bigint end as score
    from farm.scores s join farm.players pl on pl.user_id = s.user_id
    cross join (values ('beauty'), ('earned'), ('quests')) k(kind)
    where s.week = wk and not pl.hidden),
  numbered as (select r.*, rank() over (partition by r.kind order by r.score desc) as rk from ranked r where r.score > 0),
  mine as (select n.kind, n.rk::int as rk from numbered n where n.user_id = uid and n.rk <= 10),
  won as (
    insert into farm.prizes (user_id, week, kind, rank, gold, stars)
    select uid, wk, m.kind, m.rk, p.gold, p.stars from mine m cross join lateral farm.prize_for(m.rk) p
    on conflict do nothing
    returning farm.prizes.kind, farm.prizes.rank, farm.prizes.gold, farm.prizes.stars, farm.prizes.week)
  select w.kind, w.rank, w.gold, w.stars, w.week from won w;
end $$;
revoke all on function public.farm_prizes_v1() from public, anon;
grant execute on function public.farm_prizes_v1() to authenticated;

reset lock_timeout;

-- ---------- to undo part 2 ----------
-- drop function if exists public.farm_prizes_v1(), farm.prize_for(int);
-- drop table if exists farm.prizes;
