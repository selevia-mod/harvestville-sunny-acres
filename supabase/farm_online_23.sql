-- Harvest Ville online, part 23 (7 Nov 2026). Run AFTER parts 1-22. Every hunting place on the server (owner, 7 Nov:
-- "is this set up future proof?"):
--   1. Hunting now: a hunter in one of the new places shows there (part 14 knew only Pulag, Makiling and Magayon, so
--      the game said "Pulag"). The places are a list now (farm.hunt_maps): a place added later is one row.
--   2. Biggest catch: the new places' animals (their usual weights, from the game: tools/places/server-rows.js). A
--      place added later: its rows from that tool.
--   3. The Hall of Fame: the first to beat each new dungeon's boss ('<place>_boss'; part 22's list had only the Lair,
--      the Bakunawa and the Great Mammoth). A place added later: its row from that tool.
-- Additive: one new list table (8 rows), the hunting table's check now that list, one function's check the same, 20
-- new rows. Safe to run twice.
set local lock_timeout = '5s';

-- ---------- 1. Hunting now: every hunting place ----------
-- The places one can be out hunting in: a list, so a place added later is one row (tools/places/server-rows.js).
create table if not exists farm.hunt_maps (map text primary key check (map ~ '^[a-z][a-z0-9_]{1,23}$'));
alter table farm.hunt_maps enable row level security;
revoke all on table farm.hunt_maps from public, anon, authenticated;
insert into farm.hunt_maps (map) values ('pulag'), ('makiling'), ('magayon') on conflict (map) do nothing;
alter table farm.hunting drop constraint if exists hunting_map_check;
alter table farm.hunting drop constraint if exists hunting_map_fk;
create or replace function public.farm_hunt_here_v1(p_map text)
returns void language plpgsql security definer set search_path = '' as $$
declare uid uuid := farm.me();
begin
  update farm.players set last_seen_at = now() where user_id = uid;
  if p_map is null then delete from farm.hunting where user_id = uid; return; end if;
  if not exists (select 1 from farm.hunt_maps where map = p_map) then raise exception 'bad map' using errcode = '22023'; end if;
  insert into farm.hunting (user_id, map) values (uid, p_map)
  on conflict (user_id) do update set map = excluded.map, since = case when farm.hunting.map = excluded.map then farm.hunting.since else now() end;
end $$;
revoke all on function public.farm_hunt_here_v1(text) from public, anon;
grant execute on function public.farm_hunt_here_v1(text) to authenticated;

-- ---------- the new places: their maps (1), their animals (2) and their dungeons' bosses (3) ----------
insert into farm.hunt_maps (map) values ('banaue'), ('bohol'), ('taal'), ('sierra'), ('palawan') on conflict (map) do nothing;
insert into farm.catch_kinds (kind, kg) values
  ('itik', 1.1), ('bayawak', 18), ('goldduck', 1.6), ('kambing', 45), ('musang', 6), ('cocoagoat', 60), ('tagak', 1.8), ('buwaya', 240), ('royal_tagak', 2.8), ('unggoy', 9), ('carabaoligaw', 800), ('silvercarabao', 900), ('paniki', 0.9), ('sawa', 45), ('golden_sawa', 70)
on conflict (kind) do nothing;
insert into farm.hall_first_keys (key, what) values
  ('banaue_boss', 'the Amomongo, Terrace Tunnels'),
  ('bohol_boss', 'the Great Nuno, Hill Hollows'),
  ('taal_boss', 'the Berberoka, Taal Crater'),
  ('sierra_boss', 'the Kapre, Kapre''s Roots'),
  ('palawan_boss', 'the Minokawa, River Caves')
on conflict (key) do nothing;

-- (a hunter's place is one of the list: after the new places are in it)
alter table farm.hunting add constraint hunting_map_fk foreign key (map) references farm.hunt_maps (map);

-- ---------- check (read only) ----------
-- select count(*) from farm.hunt_maps;         -- 8
-- select count(*) from farm.catch_kinds;       -- 27
-- select count(*) from farm.hall_first_keys;   -- 11

-- ---------- undo ----------
-- delete from farm.hall_first_keys k where k.key like '%\_boss' and not exists (select 1 from farm.hall_firsts f where f.key = k.key);
-- delete from farm.catch_kinds c where c.kind in ('itik', 'bayawak', 'goldduck', 'kambing', 'musang', 'cocoagoat', 'tagak', 'buwaya',
--   'royal_tagak', 'unggoy', 'carabaoligaw', 'silvercarabao', 'paniki', 'sawa', 'golden_sawa') and not exists (select 1 from farm.catches x where x.kind = c.kind);
-- delete from farm.hunting where map not in ('pulag', 'makiling', 'magayon');
-- alter table farm.hunting drop constraint hunting_map_fk;
-- alter table farm.hunting add constraint hunting_map_check check (map in ('pulag', 'makiling', 'magayon'));
-- drop table farm.hunt_maps;
-- (and part 14's farm_hunt_here_v1 again)
