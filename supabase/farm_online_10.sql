-- Harvest Ville online, part 10 (31 Oct 2026): the Goals task "get the Harvest Ville monthly chest". Run AFTER parts 1-9
-- and after Goals November (it needs private.goals_v2_record_harvest_monthly_chest).
-- Adds one trigger on farm.saves; replaces nothing and needs no app update.
--   The game keeps the chest in its save: p3.mq = [month, chest, quests], and chest is 1 only after the player claimed it
--   (L.claimChest in src/01-logic7.js). Whenever a save with this month's chest reaches the server, Goals is told.
--   farm.saves holds the sign-in id and Goals the profile id; a few players have two different ones.
--   Goals ignores a repeat, so every later save of that month is harmless, and a try that failed is tried again by the
--   next save. A player who had the chest before this part is counted by their next save of the same month.
--   The save is written by the phone, so this trusts it; the most a faked save can win is this one task.
--   A problem here never stops a save.
set lock_timeout = '5s';

create function farm.saves_monthly_chest()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  at timestamptz := statement_timestamp();
  month text := to_char(at at time zone 'Asia/Manila', 'YYYY-MM');
  profile uuid;
begin
  if new.data #>> '{p3,mq,0}' is distinct from month then return new; end if;
  select pr.id into profile from public.profiles pr
  where pr.auth_user_id = new.user_id and not pr.is_banned and pr.deleted_at is null
    and (pr.suspended_until is null or pr.suspended_until <= at);
  if profile is null then return new; end if;
  perform private.goals_v2_record_harvest_monthly_chest(profile, month);
  return new;
exception
  when query_canceled then raise;
  when others then return new;
end $$;

revoke all on function farm.saves_monthly_chest() from public, anon, authenticated;

create trigger saves_monthly_chest after insert or update of data on farm.saves
  for each row when (new.data #>> '{p3,mq,1}' = '1')
  execute function farm.saves_monthly_chest();
reset lock_timeout;

-- ---------- to undo part 10 ----------
-- drop trigger if exists saves_monthly_chest on farm.saves;
-- drop function if exists farm.saves_monthly_chest();
