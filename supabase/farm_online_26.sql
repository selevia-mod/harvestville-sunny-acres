-- Harvest Ville online, part 26 (9 Nov 2026). Run AFTER part 25. Farm Raids: the raids on your farm stay in a list
-- (the Raid Camp's "Raids on your farm"), so Replay and Revenge are not lost once the raided card is closed.
--   farm_fraid_recent_v1()   the last 10 raids on my farm (7 days): who, the stars, what was taken, Revenge still free,
--                            and the battle for Replay
-- Additive: one new function. Safe to run twice.
set local lock_timeout = '5s';

create or replace function public.farm_fraid_recent_v1()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not signed in' using errcode = '28000'; end if;
  return coalesce((select jsonb_agg(x order by x->>'at' desc) from (
    select jsonb_build_object('raid', r.id, 'by', r.attacker, 'name', pl.farm_name, 'stars', r.stars, 'taken', r.taken,
      'at', r.settled_at, 'revenge', r.revenged_at is null, 'copy', r.copy, 'army', r.army, 'seed', r.seed, 'cap', r.cap,
      'moves', r.moves) x
    from farm.fraid_raids r left join farm.players pl on pl.user_id = r.attacker
    where r.defender = uid and r.state = 'done' and r.settled_at > now() - interval '7 days'
    order by r.settled_at desc limit 10) t), '[]');
end $$;

revoke all on function public.farm_fraid_recent_v1() from public, anon, authenticated;
grant execute on function public.farm_fraid_recent_v1() to authenticated;
reset lock_timeout;
notify pgrst, 'reload schema';
