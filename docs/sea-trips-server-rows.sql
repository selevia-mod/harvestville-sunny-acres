-- Sea Trips (boats step 1, owner 18 Nov 2026): the server rows the boat needs. FOR THE OWNER TO APPLY; never applied by me.
-- Made by: node tools/places/server-rows.js sea
--   farm.hunt_maps 'sea': "Hunting now" lists Kapitana Marisol's boat (farm_hunt_here_v1 takes p_map 'sea').
--   farm.catch_kinds: the 7 sea fish (kind, usual kg) for the Biggest catch board (farm_catch_v1 / farm_catch_board_v1).
--   farm.hall_first_keys 'sea_boss': the first player ever to land the Marlin, on the Hall of Fame.
-- Each line is safe to run again (on conflict do nothing). Before it is applied the game hides these quietly.

insert into farm.hunt_maps (map) values ('sea') on conflict (map) do nothing;
insert into farm.catch_kinds (kind, kg) values
  ('galunggong', 0.25), ('sea_pusit', 0.6), ('maya_maya', 2.5), ('lapu_lapu', 5), ('tanigue', 9), ('tuna', 18), ('marlin', 150)
on conflict (kind) do nothing;
insert into farm.hall_first_keys (key, what) values
  ('sea_boss', 'the Marlin, Manila Bay')
on conflict (key) do nothing;
