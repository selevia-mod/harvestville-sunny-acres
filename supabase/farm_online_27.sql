-- Harvest Ville online, part 27 (10 Nov 2026). Run AFTER part 26. Farm Raids' rewards, like Clash of Clans (owner,
-- 10 Nov 2026: "check the whole mechanics for this raid, it was too imbalance. Learn from clash of clan"; plan approved:
-- "Yes, build it"). Live raids showed a 3-star raid paying 4 Gold and the full 50 Raid Points, armies costing more than
-- any prize, and nothing for a good defense.
--   1. A star bonus the game pays (never taken from the defender): the army's room x bonus_per_space x star_bonus[stars]
--      (a full camp 7, 40 room: 600 / 1,300 / 2,000 Gold for 1 / 2 / 3 stars), on top of the loot taken.
--   2. Raid Points and the star bonus only from a farm worth raiding: its share of the loot (the cap) must be worth
--      min_loot_points Gold.
--   3. The defender earns points for holding: defend_points[stars] (10 for 0 stars, 5 for 1), from an army of at least
--      defend_min_space room.
--   4. The shield after a raid by its stars: shield_by_stars (0 / 8 / 12 / 16 hours), never shorter than one already on.
-- farm.fraid_config gains those numbers (every one adjustable there); farm_fraid_settle_v1 is replaced (same arguments,
-- same answer plus 'bonus'). Safe to run twice.
set local lock_timeout = '5s';

update farm.fraid_config set cfg = cfg || jsonb_build_object(
  'bonus_per_space', 50,
  'star_bonus', jsonb '[0, 0.3, 0.65, 1]',
  'raider_space', jsonb '{"goat": 1, "crow": 1, "cat": 2, "carabao": 5, "monkey": 2, "boar": 4, "rooster": 2, "bayawak": 3}',
  'min_loot_points', 100,
  'defend_points', jsonb '[10, 5, 0, 0]',
  'defend_min_space', 10,
  'shield_by_stars', jsonb '[0, 8, 12, 16]'
) where id = 1;

create or replace function public.farm_fraid_settle_v1(p_key text, p_raid uuid, p_stars integer, p_taken jsonb, p_moves jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); c jsonb := farm.fraid_cfg(); r farm.fraid_raids; v_total int; v_cap int; v_value int; v_prize int;
  v_pts int; v_stars int; v_space int; v_bonus int; v_def int; v_hours int;
begin
  if uid is null then raise exception 'not signed in' using errcode = '28000'; end if;
  if p_key is null or p_key is distinct from (select secret from farm.fraid_secret where id = 1) then
    return jsonb_build_object('ok', false, 'code', 'key');
  end if;
  select * into r from farm.fraid_raids where id = p_raid and attacker = uid for update;
  if not found then return jsonb_build_object('ok', false, 'code', 'none'); end if;
  if r.state = 'done' then return jsonb_build_object('ok', true, 'duplicate', true, 'stars', r.stars, 'prize', r.prize, 'points', r.points); end if;
  if now() > r.expires_at + interval '2 minutes' then return jsonb_build_object('ok', false, 'code', 'late'); end if;
  if p_taken is null or jsonb_typeof(p_taken) <> 'object' or octet_length(p_taken::text) > 8192
    or (p_moves is not null and octet_length(p_moves::text) > 16384) then return jsonb_build_object('ok', false, 'code', 'bad'); end if;
  v_stars := greatest(0, least(3, coalesce(p_stars, 0)));
  select coalesce(loot, 0) into v_total from farm.fraid_copies where user_id = r.defender;
  v_total := greatest(coalesce((r.copy->>'value')::int, v_total, 0), 0);
  v_cap := ceil(v_total * r.cap)::int;
  v_value := greatest(0, least(coalesce((p_taken->>'value')::int, 0), v_cap));
  -- the army's room (what it brought), for the star bonus and the defender's points
  select coalesce(sum(greatest(0, coalesce((e.value->>'n')::int, 0)) * coalesce((c->'raider_space'->>e.key)::int, 1)), 0)::int
    into v_space from jsonb_each(coalesce(r.army, '{}'::jsonb)) e;
  -- (only from a farm worth raiding, like the points: no bonus for beating an empty farm)
  v_bonus := case when v_cap >= coalesce((c->>'min_loot_points')::int, 0)
    then round(v_space * coalesce((c->>'bonus_per_space')::numeric, 0) * coalesce((c->'star_bonus'->>v_stars)::numeric, 0))::int else 0 end;
  v_prize := v_value + greatest(0, v_bonus);
  -- points only from a farm worth raiding
  v_pts := case when v_cap >= coalesce((c->>'min_loot_points')::int, 0) then coalesce((c->'points'->>v_stars)::int, 0) else 0 end;
  update farm.fraid_raids set state = 'done', stars = v_stars, taken = p_taken || jsonb_build_object('value', v_value, 'bonus', v_bonus),
    moves = p_moves, prize = v_prize, points = v_pts, settled_at = now() where id = r.id;
  if v_pts > 0 then
    insert into farm.fraid_points (user_id, week, points) values (uid, farm.fraid_week(now()), v_pts)
    on conflict (user_id, week) do update set points = farm.fraid_points.points + excluded.points;
  end if;
  -- the defender held: their points (a real army only)
  v_def := coalesce((c->'defend_points'->>v_stars)::int, 0);
  if v_def > 0 and v_space >= coalesce((c->>'defend_min_space')::int, 0) then
    insert into farm.fraid_points (user_id, week, points) values (r.defender, farm.fraid_week(now()), v_def)
    on conflict (user_id, week) do update set points = farm.fraid_points.points + excluded.points;
  end if;
  -- the shield by stars (a longer one already on stays)
  v_hours := coalesce((c->'shield_by_stars'->>v_stars)::int, (c->>'shield_hours')::int, 0);
  if v_hours > 0 then
    update farm.fraid_copies set raided_until = greatest(coalesce(raided_until, now()), now() + make_interval(hours => v_hours)) where user_id = r.defender;
  end if;
  return jsonb_build_object('ok', true, 'stars', v_stars, 'prize', v_prize, 'points', v_pts, 'bonus', v_bonus);
end $$;
