-- Harvest Ville online, part 11 (2 Nov 2026): room for bigger farms, and a hidden loading report. Run AFTER parts 1-10.
-- Needs no app update: an older app keeps its own 16 KB limit, and calls the new function only once it is updated.
--   1. Saves: the game counts a save as JSON with no spaces, but the server counts it as stored, with spaces, about 25%
--      longer. A save near the game's old 16 KB limit could pass the game and fail here ('big'), and its online copy
--      then quietly stopped updating. The limit moves from 20,000 to 32,768 bytes, enough for the game's new 24,000.
--   2. farm.load_days: how many visits reached each step of loading, per day and phone type. Counts only: no player id.
--      farm_report_v1(stage, platform, ms) adds one; it never fails a game, and an unknown stage is ignored.
--      Read it with: select * from farm.load_days order by day desc, stage;
set lock_timeout = '5s';

alter table farm.saves drop constraint saves_data_check;
alter table farm.saves add constraint saves_data_check check (octet_length(data::text) <= 32768);

create or replace function public.farm_save_put_v1(p_data jsonb, p_saved_at timestamptz)
returns text language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); at timestamptz := least(p_saved_at, now() + interval '5 minutes');
begin
  if uid is null then raise exception 'not signed in' using errcode = '28000'; end if;
  if p_data is null or jsonb_typeof(p_data) <> 'object' then return 'bad'; end if;
  if octet_length(p_data::text) > 32768 then return 'big'; end if;
  if exists (select 1 from farm.saves where user_id = uid and saved_at > at) then return 'older'; end if;
  insert into farm.saves (user_id, data, saved_at, updated_at) values (uid, p_data, at, now())
  on conflict (user_id) do update set data = excluded.data, saved_at = excluded.saved_at, updated_at = now();
  return 'ok';
end $$;

create table farm.load_days (
  day date not null,
  stage text not null check (stage in ('open', 'page', 'ready', 'slow', 'left', 'failed', 'crash', 'save_refused')),
  platform text not null check (platform in ('ios', 'android', 'other')),
  n int not null default 0 check (n >= 0),
  ms bigint not null default 0 check (ms >= 0), -- added up: ms / n is the average time to reach this step
  primary key (day, stage, platform)
);
alter table farm.load_days enable row level security;
revoke all on farm.load_days from public, anon, authenticated;

create function public.farm_report_v1(p_stage text, p_platform text default 'other', p_ms int default 0)
returns void language plpgsql security definer set search_path = '' as $$
declare today date := (now() at time zone 'Asia/Manila')::date;
  phone text := case when p_platform in ('ios', 'android') then p_platform else 'other' end;
begin
  if auth.uid() is null then raise exception 'not signed in' using errcode = '28000'; end if;
  if p_stage is null or p_stage not in ('open', 'page', 'ready', 'slow', 'left', 'failed', 'crash', 'save_refused') then return; end if;
  insert into farm.load_days (day, stage, platform, n, ms)
  values (today, p_stage, phone, 1, greatest(0, least(coalesce(p_ms, 0), 600000)))
  on conflict (day, stage, platform) do update set
    n = farm.load_days.n + 1,
    ms = farm.load_days.ms + excluded.ms;
end $$;
revoke all on function public.farm_report_v1(text, text, int) from public, anon, authenticated;
grant execute on function public.farm_report_v1(text, text, int) to authenticated;
reset lock_timeout;

-- ---------- to undo part 11 ----------
-- drop function if exists public.farm_report_v1(text, text, int);
-- drop table if exists farm.load_days;
-- (only when no save is over 20,000 bytes) alter table farm.saves drop constraint saves_data_check;
-- alter table farm.saves add constraint saves_data_check check (octet_length(data::text) <= 20000);
-- and put 20000 back in public.farm_save_put_v1.
