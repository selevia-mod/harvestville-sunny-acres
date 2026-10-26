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

-- ---------- Selebox alerts for farm friends ----------
-- A notification in Selebox's own bell and push (type 'farm_alert'), from the friend who did it. The words are fixed
-- here; a person's Selebox name is the only thing that comes from them (never message text). Throttled: a visit once a
-- day per visitor (a visit row is one per day), a gift once per farm a day, messages one alert per friend per 30
-- minutes, friend requests and acceptances once. Never stops the farm action that made it.
insert into public.notification_push_policy (type, push_enabled, note)
values ('farm_alert', true, 'Harvest Ville: a farm friend visited, left a gift, wrote, or asked to be friends (farm.alert). Switch: app_config sunny_acres_alerts.')
on conflict (type) do update set push_enabled = excluded.push_enabled, note = excluded.note, updated_at = now();

create function farm.alert(p_to uuid, p_from uuid, p_kind text, p_what text) returns void
language plpgsql security definer set search_path = '' as $$
declare rcp uuid; act uuid; who text;
begin
  if p_to is null or p_from is null or p_to = p_from then return; end if;
  if coalesce((select lower(btrim(value)) from public.app_config where key = 'sunny_acres_alerts'), 'on') = 'off' then return; end if;
  select id into rcp from public.profiles where auth_user_id = p_to limit 1;
  select id, left(coalesce(nullif(btrim(display_name), ''), username, 'A farmer'), 40) into act, who from public.profiles where auth_user_id = p_from limit 1;
  if rcp is null or act is null then return; end if;
  if p_kind = 'message' and exists (select 1 from public.notifications n where n.recipient_id = rcp and n.actor_id = act
      and n.type = 'farm_alert' and n.metadata->>'kind' = 'message' and n.created_at > now() - interval '30 minutes') then return; end if;
  insert into public.notifications (recipient_id, actor_id, type, target_type, message, metadata)
  values (rcp, act, 'farm_alert', 'farm', p_what,
          jsonb_build_object('kind', p_kind, 'push_title', 'Harvest Ville', 'push_body', who || ' ' || p_what));
exception when others then
  return; -- an alert never stops the farm action
end $$;
revoke all on function farm.alert(uuid, uuid, text, text) from public, anon, authenticated;

create function farm.on_visit() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then perform farm.alert(new.host, new.visitor, 'visit', 'visited your farm in Harvest Ville');
  elsif old.gift is null and new.gift is not null then perform farm.alert(new.host, new.visitor, 'gift', 'left you a gift in Harvest Ville');
  end if;
  return null;
end $$;
create trigger farm_visit_alert after insert or update of gift on farm.visits for each row execute function farm.on_visit();

create function farm.on_message() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform farm.alert(new.recipient, new.sender, 'message', 'sent you a message in Harvest Ville');
  return null;
end $$;
create trigger farm_message_alert after insert on farm.messages for each row execute function farm.on_message();

create function farm.on_friend() returns trigger language plpgsql security definer set search_path = '' as $$
declare other uuid := case when new.requested_by = new.user_a then new.user_b else new.user_a end;
begin
  if tg_op = 'INSERT' and new.accepted_at is null then perform farm.alert(other, new.requested_by, 'friend', 'wants to be your farm friend in Harvest Ville');
  elsif tg_op = 'UPDATE' and old.accepted_at is null and new.accepted_at is not null then perform farm.alert(new.requested_by, other, 'friend', 'is your farm friend now in Harvest Ville');
  end if;
  return null;
end $$;
create trigger farm_friend_alert after insert or update of accepted_at on farm.friends for each row execute function farm.on_friend();
revoke all on function farm.on_visit(), farm.on_message(), farm.on_friend() from public, anon, authenticated;

-- The push's words: Selebox's push text function learns 'farm_alert' (title and body from the alert's metadata, as
-- it does for 'book_suggestion'). Patched in place from the live definition, so other changes to it are kept.
do $$
declare def text := pg_get_functiondef('public.notification_push_copy_v1(uuid[])'::regprocedure);
  t_old text := $q$when 'book_suggestion' then t.m->>'push_title'$q$;
  b_old text := $q$when 'book_suggestion' then t.m->>'push_body'$q$;
begin
  if position('farm_alert' in def) > 0 then return; end if; -- already taught
  if (length(def) - length(replace(def, t_old, ''))) / length(t_old) <> 1 or (length(def) - length(replace(def, b_old, ''))) / length(b_old) <> 1 then
    raise exception 'notification_push_copy_v1 changed: its book_suggestion lines were not found once each';
  end if;
  def := replace(def, t_old, t_old || E'\n        when ''farm_alert'' then t.m->>''push_title''');
  def := replace(def, b_old, b_old || E'\n        when ''farm_alert'' then t.m->>''push_body''');
  execute def;
end $$;

reset lock_timeout;

-- ---------- to undo part 2 ----------
-- drop trigger if exists farm_visit_alert on farm.visits; drop trigger if exists farm_message_alert on farm.messages;
-- drop trigger if exists farm_friend_alert on farm.friends;
-- drop function if exists farm.on_visit(), farm.on_message(), farm.on_friend(), farm.alert(uuid, uuid, text, text);
-- delete from public.notification_push_policy where type = 'farm_alert';
--   (notification_push_copy_v1 keeps its two farm_alert lines: harmless without farm alerts)
-- drop function if exists public.farm_prizes_v1(), farm.prize_for(int);
-- drop table if exists farm.prizes;
