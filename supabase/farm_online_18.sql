-- Harvest Ville online, part 18 (4 Nov 2026). Run AFTER part 1 (farm.players, farm.blocked, farm_topic_ok_v1).
-- Signed live messages (owner, 4 Nov: "yes, fix it", the online review's "a broadcast says who sent it, and nothing on
-- the server checks it"). On a farm's live channel a phone could send a message, or show itself, as another player.
-- Now every two players on a channel share a key only the server can make: farm_line_keys_v1 gives you your key with
-- each player you name, and never a key between two others. The app signs each message and its presence with the key
-- for every player in the room, and takes a message (or shows a farmer) only if it is signed for it by the one it says
-- it is from. No key between two players who blocked each other, so their messages never arrive.
-- Additive: one new table (one row: the server's secret), one new function. Nothing that exists changes. Safe to run twice.
--   farm_line_keys_v1(p_topic, p_peers)   { "<peer id>": "<64 hex>" } for the channel; null if you may not use it
set local lock_timeout = '5s';
create extension if not exists pgcrypto with schema extensions;

create table if not exists farm.line_secret (
  id int primary key default 1 check (id = 1),
  secret bytea not null default extensions.gen_random_bytes(32)
);
insert into farm.line_secret default values on conflict do nothing;
alter table farm.line_secret enable row level security; -- (no policies: only the function below reads it)
revoke all on table farm.line_secret from public, anon, authenticated;

create or replace function public.farm_line_keys_v1(p_topic text, p_peers uuid[])
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare uid uuid := auth.uid(); s bytea; out jsonb := '{}'; p uuid;
begin
  if not public.farm_topic_ok_v1(p_topic) then return null; end if; -- (signed in, a player, and allowed on this farm)
  if p_peers is null or cardinality(p_peers) > 40 then return null; end if;
  select secret into s from farm.line_secret where id = 1;
  foreach p in array p_peers loop
    if p is null or p = uid or farm.blocked(uid, p) then continue; end if;
    out := out || jsonb_build_object(p::text, encode(extensions.hmac(
      convert_to(p_topic || '|' || least(uid, p)::text || '|' || greatest(uid, p)::text, 'UTF8'), s, 'sha256'), 'hex'));
  end loop;
  return out;
end $$;

revoke all on function public.farm_line_keys_v1(text, uuid[]) from public, anon, authenticated;
grant execute on function public.farm_line_keys_v1(text, uuid[]) to authenticated;
reset lock_timeout;
notify pgrst, 'reload schema';

-- ---------- to undo part 18 ----------
-- (first an app that does not sign: the signing app shows nobody without this function)
-- drop function if exists public.farm_line_keys_v1(text, uuid[]);
-- drop table if exists farm.line_secret;
