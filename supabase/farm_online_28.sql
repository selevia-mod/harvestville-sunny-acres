-- Harvest Ville online, part 28 (10 Nov 2026). Run AFTER part 27. Farm Raids: a farm to raid even when no player is near
-- your power (owner, 10 Nov 2026: "create a random farm that users can raid even though there's no nearby neighborhood
-- that can match up... Full points, make it random player, not bandit, just make it look like a random player, we will use
-- it until we have enough players to match up").
--   - Raid a player finds no farm near your power: the list gets one made-up farm (a username-like name, a power near
--     yours, loot for that power). It is raided like a real one: a daily raid, the energy, the game server's check, the
--     loot and the star bonus, full Raid Points. Nobody loses anything (no defender).
--   - Its numbers come from the server (farm.fraid_ghost_spec): its power, its defenses' tier and level, its loot; the
--     phone lays the farm out from them, and the game server checks the farm it played had them all.
--   farm.fraid_raids.defender may be null (a made-up farm); farm_fraid_find_v1 replaced; farm_fraid_ghost_start_v1 new;
--   farm_fraid_settle_v1 replaced (part 27's, with no defender points or shield for a made-up farm). Safe to run twice.
set local lock_timeout = '5s';

alter table farm.fraid_raids alter column defender drop not null;

update farm.fraid_config set cfg = cfg || jsonb_build_object(
  'ghost_on', true,
  'ghost_names', jsonb '["jhayvee","Kuya Ron","mikaela_07","AngelBee","rosalyn22","JM Farmer","Ate Lyn","kenjie","Princess M","bebang",
    "Nikki R","lovely_23","Marvin","yna.farm","Tito Boy","Carlo J","shaira","Jun-jun","Mae Ann","rhea_09","Dodong","Kristine","Ellaine","JR Tan",
    "aileen","Paolo V","Bea","Lolo Ben","Jasmine M","renz","Grace A","Tonyo","maricar","Iya","Kim Joy","Nonoy","Arlene","Jhun","Cathy B","miko"]',
  'ghost_loot_per_power', 15,
  'ghost_loot_min', 400,
  'ghost_loot_max', 5000,
  'ghost_tier_power', jsonb '[0, 60, 120, 200]',
  'ghost_lv_power', 60
) where id = 1;

-- a made-up farm's numbers, from its seed and the raider's power (the same every time for the same two)
create or replace function farm.fraid_ghost_spec(p_seed int, p_mine int)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare c jsonb := farm.fraid_cfg(); names jsonb := coalesce(c->'ghost_names', '["Farmer"]'); n int; s int := abs(coalesce(p_seed, 1));
  pw int; tier int := 0; lv int; val int; nm text; k int := 0;
begin
  n := greatest(1, jsonb_array_length(names));
  -- a name no real farm has
  loop
    nm := names->>((s + k) % n);
    exit when k >= n or not exists (select 1 from farm.players where lower(farm_name) = lower(nm));
    k := k + 1;
  end loop;
  pw := greatest(10, coalesce(p_mine, 50) + (s % 21) - 10);
  select greatest(0, count(*) - 1)::int into tier from jsonb_array_elements(coalesce(c->'ghost_tier_power', '[0]')) t where (t #>> '{}')::int <= pw;
  tier := least(3, tier);
  lv := least(5, 1 + pw / greatest(1, coalesce((c->>'ghost_lv_power')::int, 60)));
  val := least(coalesce((c->>'ghost_loot_max')::int, 5000), greatest(coalesce((c->>'ghost_loot_min')::int, 400), pw * coalesce((c->>'ghost_loot_per_power')::int, 15)));
  return jsonb_build_object('seed', s, 'name', nm, 'look', case when (s / 7) % 2 = 0 then 'boy' else 'girl' end, 'power', pw,
    'tier', tier, 'lv', lv, 'value', val, 'home', least(10, 2 + tier * 2 + (s % 2)));
end $$;
revoke all on function farm.fraid_ghost_spec(int, int) from public, anon, authenticated;

-- the list: as before; none near your power: one made-up farm
create or replace function public.farm_fraid_find_v1(p_mode text, p_skip uuid[])
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare uid uuid := auth.uid(); c jsonb := farm.fraid_cfg(); mine int; n int; out jsonb; gs int; g jsonb;
begin
  if uid is null then raise exception 'not signed in' using errcode = '28000'; end if;
  if not coalesce((c->>'on')::boolean, false) then return jsonb_build_object('ok', false, 'code', 'off'); end if;
  select power into mine from farm.fraid_copies where user_id = uid;
  if mine is null then return jsonb_build_object('ok', false, 'code', 'no-copy'); end if;
  n := case when p_mode = 'random' then 1 else (c->>'list')::int end;
  select coalesce(jsonb_agg(x order by x->>'o'), '[]') into out from (
    select jsonb_build_object('id', f.user_id, 'name', coalesce(pl.farm_name, 'A farm'), 'power', f.power, 'loot', f.loot,
      'cap', round(farm.fraid_cap(mine, f.power), 3), 'o', lpad(rn::text, 4, '0')) x
    from (
      select f.*, row_number() over (order by abs(f.power - mine) + (random() * greatest(mine, 10) * 0.3)) rn
      from farm.fraid_copies f
      where f.loot > 0 and f.user_id <> uid and not (f.user_id = any (coalesce(p_skip, '{}')))
        and f.power between mine * 0.5 and mine * 2 + 20
        and farm.fraid_why_not(f.user_id, uid) is null
      limit 200
    ) f join farm.players pl on pl.user_id = f.user_id
    where f.rn <= n
  ) t;
  if jsonb_array_length(out) = 0 and coalesce((c->>'ghost_on')::boolean, false) then
    gs := (floor(random() * 2147483646) + 1)::int;
    g := farm.fraid_ghost_spec(gs, mine);
    out := jsonb_build_array(jsonb_build_object('id', null, 'ghost', gs, 'name', g->>'name', 'power', (g->>'power')::int,
      'loot', (g->>'value')::int, 'cap', round(farm.fraid_cap(mine, (g->>'power')::int), 3), 'o', '0001'));
  end if;
  return jsonb_build_object('ok', true, 'farms', out, 'next_gold', c->'next_gold', 'energy', c->'energy');
end $$;

-- a raid on a made-up farm: the same limits as farm_fraid_start_v1 (daily raids, one at a time, a request id)
create or replace function public.farm_fraid_ghost_start_v1(p_ghost int, p_army jsonb, p_request_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); c jsonb := farm.fraid_cfg(); r farm.fraid_raids; mine int; done_today int; g jsonb;
begin
  if uid is null then raise exception 'not signed in' using errcode = '28000'; end if;
  if not coalesce((c->>'on')::boolean, false) or not coalesce((c->>'ghost_on')::boolean, false) then return jsonb_build_object('ok', false, 'code', 'off'); end if;
  if p_request_id is null then return jsonb_build_object('ok', false, 'code', 'request-required'); end if;
  if p_ghost is null or p_ghost < 1 then return jsonb_build_object('ok', false, 'code', 'target'); end if;
  if not farm.fraid_player_ok(uid) then return jsonb_build_object('ok', false, 'code', 'account-unavailable'); end if;
  select * into r from farm.fraid_raids where attacker = uid and request_id = p_request_id;
  if found then
    return jsonb_build_object('ok', true, 'duplicate', true, 'raid', r.id, 'copy', r.copy, 'seed', r.seed, 'cap', r.cap, 'expires_at', r.expires_at, 'ghost', r.copy->'ghost');
  end if;
  if p_army is null or jsonb_typeof(p_army) <> 'object' or octet_length(p_army::text) > 2048 then return jsonb_build_object('ok', false, 'code', 'army'); end if;
  perform pg_advisory_xact_lock(hashtext('farm_fraid'), hashtext(uid::text));
  if exists (select 1 from farm.fraid_raids where attacker = uid and state = 'open' and expires_at > now()) then
    return jsonb_build_object('ok', false, 'code', 'in-raid');
  end if;
  select count(*) into done_today from farm.fraid_raids where attacker = uid and revenge_of is null and started_at >= farm.fraid_today_start();
  if done_today >= (c->>'daily')::int then return jsonb_build_object('ok', false, 'code', 'daily', 'daily', c->'daily'); end if;
  select power into mine from farm.fraid_copies where user_id = uid;
  if mine is null then return jsonb_build_object('ok', false, 'code', 'no-copy'); end if;
  g := farm.fraid_ghost_spec(p_ghost, mine);
  insert into farm.fraid_raids (attacker, defender, request_id, copy, army, seed, cap, expires_at)
  values (uid, null, p_request_id, jsonb_build_object('ghost', g, 'value', (g->>'value')::int), p_army, (floor(random() * 2147483646) + 1)::int,
    farm.fraid_cap(mine, (g->>'power')::int), now() + make_interval(secs => (c->>'lock_secs')::int))
  returning * into r;
  update farm.fraid_copies set shield_until = null, raided_until = null where user_id = uid; -- (raiding breaks your shield, as any raid)
  return jsonb_build_object('ok', true, 'raid', r.id, 'name', g->>'name', 'copy', r.copy, 'seed', r.seed, 'cap', r.cap,
    'expires_at', r.expires_at, 'shield_broken', true, 'ghost', g);
end $$;
revoke all on function public.farm_fraid_ghost_start_v1(int, jsonb, uuid) from public, anon;
grant execute on function public.farm_fraid_ghost_start_v1(int, jsonb, uuid) to authenticated;

-- part 27's settle; a made-up farm (no defender): no defender points, no shield
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
  if r.defender is not null then select coalesce(loot, 0) into v_total from farm.fraid_copies where user_id = r.defender; end if;
  v_total := greatest(coalesce((r.copy->>'value')::int, v_total, 0), 0);
  v_cap := ceil(v_total * r.cap)::int;
  v_value := greatest(0, least(coalesce((p_taken->>'value')::int, 0), v_cap));
  select coalesce(sum(greatest(0, coalesce((e.value->>'n')::int, 0)) * coalesce((c->'raider_space'->>e.key)::int, 1)), 0)::int
    into v_space from jsonb_each(coalesce(r.army, '{}'::jsonb)) e;
  v_bonus := case when v_cap >= coalesce((c->>'min_loot_points')::int, 0)
    then round(v_space * coalesce((c->>'bonus_per_space')::numeric, 0) * coalesce((c->'star_bonus'->>v_stars)::numeric, 0))::int else 0 end;
  v_prize := v_value + greatest(0, v_bonus);
  v_pts := case when v_cap >= coalesce((c->>'min_loot_points')::int, 0) then coalesce((c->'points'->>v_stars)::int, 0) else 0 end;
  update farm.fraid_raids set state = 'done', stars = v_stars, taken = p_taken || jsonb_build_object('value', v_value, 'bonus', v_bonus),
    moves = p_moves, prize = v_prize, points = v_pts, settled_at = now() where id = r.id;
  if v_pts > 0 then
    insert into farm.fraid_points (user_id, week, points) values (uid, farm.fraid_week(now()), v_pts)
    on conflict (user_id, week) do update set points = farm.fraid_points.points + excluded.points;
  end if;
  if r.defender is not null then
    v_def := coalesce((c->'defend_points'->>v_stars)::int, 0);
    if v_def > 0 and v_space >= coalesce((c->>'defend_min_space')::int, 0) then
      insert into farm.fraid_points (user_id, week, points) values (r.defender, farm.fraid_week(now()), v_def)
      on conflict (user_id, week) do update set points = farm.fraid_points.points + excluded.points;
    end if;
    v_hours := coalesce((c->'shield_by_stars'->>v_stars)::int, (c->>'shield_hours')::int, 0);
    if v_hours > 0 then
      update farm.fraid_copies set raided_until = greatest(coalesce(raided_until, now()), now() + make_interval(hours => v_hours)) where user_id = r.defender;
    end if;
  end if;
  return jsonb_build_object('ok', true, 'stars', v_stars, 'prize', v_prize, 'points', v_pts, 'bonus', v_bonus);
end $$;
