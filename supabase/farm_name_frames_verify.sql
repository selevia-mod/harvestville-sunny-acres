-- Name frames: read-only checks after APPLY-name-frames.sql. Changes nothing.
-- Each line should say true (or show the rows described).

-- 1. the three game functions are there, security definer, for signed-in players only
select p.proname, p.prosecdef as security_definer,
  has_function_privilege('authenticated', p.oid, 'execute') as players_can_call,
  not has_function_privilege('anon', p.oid, 'execute') as anon_cannot_call
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname in ('farm_frames_v1', 'farm_frames_mine_v1', 'farm_frame_pick_v1')
order by 1; -- (3 rows, every column true)

-- 2. the helpers are not callable by players
select p.proname, not has_function_privilege('authenticated', p.oid, 'execute') as players_cannot_call
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'farm' and p.proname in ('frame_bosses', 'frames_owned', 'frame_wear')
order by 1; -- (3 rows, true)

-- 3. the table, with row level security on and no direct access for players
select c.relname, c.relrowsecurity as rls_on, not has_table_privilege('authenticated', c.oid, 'select') as players_cannot_read,
  not has_table_privilege('authenticated', c.oid, 'insert') as players_cannot_write
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'farm' and c.relname = 'player_frames_choice'; -- (1 row, true)

-- 4. the ten boss frames are the Tower's firsts on the Hall's list
select count(*) = 10 as ten_bosses from farm.hall_first_keys where key = any (farm.frame_bosses());

-- 5. who wears a frame now (empty until someone beats a big boss or last week's board is claimed): boss frames, then
--    last week's top 3 (each claim is made when the player opens the game after Monday)
select f.key, pl.farm_name, f.at, farm.frame_wear(f.user_id) as wears
from farm.hall_firsts f join farm.players pl on pl.user_id = f.user_id where f.key = any (farm.frame_bosses()) order by f.at;
select c.rank, pl.farm_name, c.frame, c.title, farm.frame_wear(c.user_id) as wears
from farm.tower_week_claims c join farm.players pl on pl.user_id = c.user_id
where c.week = farm.tower_week(now()) - 7 and c.frame is not null order by c.rank;

-- 6. picks players made
select ch.frame, count(*) from farm.player_frames_choice ch group by ch.frame order by 2 desc;
