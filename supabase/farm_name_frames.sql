-- Harvest Ville online: name frames (13 Nov 2026). Run AFTER the Tower's weekly board (APPLY-tower-board.sql). It needs
-- part 1 (farm.players, farm.me, farm.blocked), part 22 (farm.hall_firsts) and the board (farm.tower_week_claims,
-- farm.tower_week). (The same file as ~/Downloads/name-frames-SQL/APPLY-name-frames.sql; the game's side:
-- src/*name-frames.js; the design: docs/superpowers/specs/2026-11-13-name-frames-design.md.)
--   A frame round a player's name, in the game only (over their head, on their card, the board, the wall, the Hall):
--   - First in Selebox: the first player ever to beat each of the Tower's 10 big bosses (farm.hall_firsts, keys
--     tower_100 ... tower_1000) owns that boss's frame, for as long as the first is theirs;
--   - the weekly Lighthouse Board: last week's places 1, 2, 3 own gold, silver, bronze for this week (Monday to Monday,
--     Manila time), place 1 also the title "Lighthouse Champion": the claim the server made from last week's final board
--     (farm.tower_week_claims, the week before farm.tower_week(now())).
--   What a player wears: their pick if they still own it, else Auto (this week's board frame, else their newest boss
--   frame); 'none': no frame. The title shows for the week whatever the frame.
--   No faking: a phone never takes a frame from what another phone says about itself. It asks here, for the players in
--   its room (at most 60 a call), and keeps the answers 10 minutes.
--   Hidden players (after reports) show no frame; nor do players you blocked or who blocked you.
-- Additive: one new table, new functions. Nothing that exists changes. Safe to run twice.
--   farm_frames_v1(p_ids uuid[])   [{ id, frame, title }] (only players with a frame or a title) | { ok: false, code: 'bad' }
--   farm_frames_mine_v1()          { pick, firsts: [keys, newest first], week, title, until, wear: { frame, title } }
--   farm_frame_pick_v1(p_frame text)  { ok, pick, wear: { frame, title } } | { ok: false, code: 'not-yours' }
set local lock_timeout = '5s';

-- ---------- the table ----------
-- The frame each player picked: 'auto', 'none' or a frame they own (checked again each time it is read: a frame no
-- longer owned falls back to Auto). No row: Auto.
create table if not exists farm.player_frames_choice (
  user_id uuid primary key references farm.players (user_id) on delete cascade,
  frame text not null check (frame ~ '^[a-z0-9_]{1,20}$'),
  at timestamptz not null default now()
);
alter table farm.player_frames_choice enable row level security; -- (no policies: only the functions below read or write it)
revoke all on table farm.player_frames_choice from public, anon, authenticated;

-- ---------- helpers (not callable by clients) ----------
-- the ten boss frames (the Tower's firsts), floor 100 first
create or replace function farm.frame_bosses() returns text[]
language sql immutable set search_path = '' as $$
  select array['tower_100', 'tower_200', 'tower_300', 'tower_400', 'tower_500', 'tower_600', 'tower_700', 'tower_800', 'tower_900', 'tower_1000']
$$;
-- A player's frames: { firsts: [boss frames, newest first], week: 'gold' | 'silver' | 'bronze' | null, title }
create or replace function farm.frames_owned(p_user uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare wk text; ttl text;
begin
  select c.frame, c.title into wk, ttl from farm.tower_week_claims c
  where c.user_id = p_user and c.week = farm.tower_week(now()) - 7;
  if wk is not null and wk not in ('gold', 'silver', 'bronze') then wk := null; end if;
  return jsonb_build_object('week', wk, 'title', ttl,
    'firsts', coalesce((select jsonb_agg(h.key order by h.at desc, h.key) from farm.hall_firsts h
      where h.user_id = p_user and h.key = any (farm.frame_bosses())), '[]'::jsonb));
end $$;
-- What a player wears now: { frame, title }
create or replace function farm.frame_wear(p_user uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare o jsonb := farm.frames_owned(p_user); pick text; f text;
begin
  select ch.frame into pick from farm.player_frames_choice ch where ch.user_id = p_user;
  f := coalesce(o->>'week', o->'firsts'->>0); -- (Auto)
  if pick = 'none' then f := null;
  elsif pick is not null and pick <> 'auto' and (pick = coalesce(o->>'week', '') or (o->'firsts') @> to_jsonb(pick)) then f := pick;
  end if;
  return jsonb_build_object('frame', f, 'title', o->>'title');
end $$;

revoke all on function farm.frame_bosses(), farm.frames_owned(uuid), farm.frame_wear(uuid) from public, anon, authenticated;

-- ---------- the functions the game calls ----------

-- The frames the players in a room wear (at most 60 ids a call). Only players with a frame or a title come back.
create or replace function public.farm_frames_v1(p_ids uuid[])
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare uid uuid := farm.me();
begin
  if p_ids is null or coalesce(cardinality(p_ids), 0) > 60 then
    return jsonb_build_object('ok', false, 'code', 'bad');
  end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', w.user_id, 'frame', w.j->>'frame', 'title', w.j->>'title'))
    from (select pl.user_id, farm.frame_wear(pl.user_id) as j from farm.players pl
          where pl.user_id = any (p_ids) and not pl.hidden and not farm.blocked(uid, pl.user_id)) w
    where w.j->>'frame' is not null or w.j->>'title' is not null), '[]'::jsonb);
end $$;

-- My frames (for the "My frame" page): what I own, what I picked, what I wear, until when this week's board frame lasts.
create or replace function public.farm_frames_mine_v1()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare uid uuid := farm.me(); o jsonb := farm.frames_owned(uid); pick text;
begin
  select ch.frame into pick from farm.player_frames_choice ch where ch.user_id = uid;
  return jsonb_build_object('pick', coalesce(pick, 'auto'), 'firsts', o->'firsts', 'week', o->>'week', 'title', o->>'title',
    'until', to_char(farm.tower_week(now()) + 7, 'YYYY-MM-DD'), 'wear', farm.frame_wear(uid));
end $$;

-- Pick the frame I wear: 'auto', 'none' or one I own.
create or replace function public.farm_frame_pick_v1(p_frame text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare uid uuid := farm.me(); o jsonb := farm.frames_owned(uid);
begin
  if p_frame is null or p_frame !~ '^[a-z0-9_]{1,20}$' or not (p_frame in ('auto', 'none') or p_frame = coalesce(o->>'week', '') or (o->'firsts') @> to_jsonb(p_frame)) then
    return jsonb_build_object('ok', false, 'code', 'not-yours');
  end if;
  insert into farm.player_frames_choice (user_id, frame, at) values (uid, p_frame, now())
  on conflict (user_id) do update set frame = excluded.frame, at = now();
  return jsonb_build_object('ok', true, 'pick', p_frame, 'wear', farm.frame_wear(uid));
end $$;

revoke all on function public.farm_frames_v1(uuid[]), public.farm_frames_mine_v1(), public.farm_frame_pick_v1(text)
  from public, anon, authenticated;
grant execute on function public.farm_frames_v1(uuid[]), public.farm_frames_mine_v1(), public.farm_frame_pick_v1(text)
  to authenticated;

reset lock_timeout;
notify pgrst, 'reload schema';

-- ---------- to undo ----------
-- (first an app without frames: its game calls fail quietly without these, and nobody wears a frame)
-- drop function if exists public.farm_frames_v1(uuid[]), public.farm_frames_mine_v1(), public.farm_frame_pick_v1(text),
--   farm.frame_wear(uuid), farm.frames_owned(uuid), farm.frame_bosses();
-- drop table if exists farm.player_frames_choice;
-- notify pgrst, 'reload schema';
