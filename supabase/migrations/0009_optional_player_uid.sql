-- NexusID — make a registered player's BGMI UID optional
-- Moti, 2026-09-30: a captain may list a teammate by name only. That player
-- still counts toward the team, but with no UID nothing can link their
-- results to a Nexus ID — no history is kept for them. Refines decision 10
-- in NEXUSID_TELEGRAM_INTEGRATION_PLAN.md (UIDs stay stored whenever given).
-- Requires 0008. Apply via the Supabase Dashboard SQL Editor.

alter table public.nexus_tournament_registration_members
  alter column player_uid drop not null;

-- The format check from 0008 still applies whenever a UID is given
-- (a CHECK passes on NULL). The (tournament_id, player_uid) unique index
-- also ignores NULLs, so any number of name-only players can enter; only
-- players with a UID are held to one live team per tournament.

comment on column public.nexus_tournament_registration_members.player_uid is
  'BGMI UID if the captain gave one. NULL = name-only entry: counts for the team, but no history can be attached to a Nexus ID.';
