-- NexusID — player profile additions
-- Adds what the new Player Profile page (2026-09-16 Claude Design handoff) needs
-- beyond the 0001 schema: a tournament stage label, and a squad-kills aggregate
-- for the per-match history breakdown. See NEXUSID_HANDOFF_LOG.md, 2026-09-16
-- session, for the full mockup-vs-schema comparison behind these two additions.
--
-- NOT YET APPLIED to the live Supabase project. Review, then run via
-- `supabase db push` (requires the project to be linked first).

-- =========================================================================
-- 1. nexus_tournaments.stage — free-text stage/round label (e.g. 'Qualifiers',
--    'Grand Finals'), same loose-text pattern as the existing `format` column.
--    Nullable — most tournaments won't set it. No RLS change needed; the
--    existing nexus_tournaments_select_public / update-by-creator policies
--    already cover this column.
-- =========================================================================
alter table public.nexus_tournaments
  add column stage text;
comment on column public.nexus_tournaments.stage is
  'Optional free-text round/stage label, e.g. ''Qualifiers'', ''Grand Finals''. Not structured — same convention as the format column.';

-- =========================================================================
-- 2. nexus_match_squad_kills — sum of kills per (match, team), i.e. "how many
--    kills did this squad get in this match." Not a stored column: computed
--    from nexus_participations, which already has a public-select RLS policy,
--    so this view needs no new policy of its own (security_invoker inherits
--    the caller's access same as nexus_player_tournament_summary).
-- =========================================================================
create or replace view public.nexus_match_squad_kills
with (security_invoker = true) as
select
  match_id,
  team_id,
  sum(kills) as squad_kills
from public.nexus_participations
where team_id is not null
group by match_id, team_id;
