-- NexusID — squad/TO profile additions
-- Adds what the new Squad Profile and TO Profile pages (2026-09-16 Claude
-- Design handoffs) need beyond 0001/0002: a prize pool on tournaments, and a
-- TO activity log. See NEXUSID_HANDOFF_LOG.md, 2026-09-16 session, for the
-- full mockup-vs-schema comparison and the decisions behind these additions
-- (claimed/unclaimed, squad tag, IGL flag, and TO org type were all
-- explicitly dropped rather than added — only these two survived).
--
-- NOT YET APPLIED to the live Supabase project. Review, then apply via the
-- Supabase Dashboard SQL Editor (no working `supabase db push`/CLI path in
-- this environment — see the 0002 migration's applied-via note).

-- =========================================================================
-- 1. nexus_tournaments.prize_pool — optional numeric prize pool, for the TO
--    profile's Hosted-tournament detail panel. No currency column; the app
--    assumes INR (₹) for display, consistent with this product's India-only
--    grassroots BGMI scope.
-- =========================================================================
alter table public.nexus_tournaments
  add column prize_pool numeric check (prize_pool is null or prize_pool >= 0);
comment on column public.nexus_tournaments.prize_pool is
  'Optional total prize pool in INR. No currency field — this product is India-only per the roadmap, so ₹ is assumed at display time.';

-- =========================================================================
-- 2. nexus_activity_log — TO-driven event feed for the TO profile's
--    Activity tab. event_type is an open-ended check list so future TO
--    actions (opening/closing registration, publishing results) can log
--    into it once those features exist — as of this migration, only
--    'tournament_created' is ever actually written (from createTournament()
--    in js/auth.js). The other event types are schema-ready but currently
--    dead — don't assume real data exists for them yet.
-- =========================================================================
create table public.nexus_activity_log (
  id bigint generated always as identity primary key,
  to_id bigint not null references public.nexus_tos (id) on delete cascade,
  tournament_id bigint references public.nexus_tournaments (id) on delete set null,
  event_type text not null check (event_type in (
    'tournament_created', 'registrations_opened', 'registrations_closed', 'results_published'
  )),
  detail text,
  created_at timestamptz not null default now()
);
create index nexus_activity_log_to_id_idx on public.nexus_activity_log (to_id);
comment on table public.nexus_activity_log is
  'TO-facing activity feed. Only tournament_created is currently emitted anywhere in the app — the other event_type values exist for future features (registration/result-publishing UI) that are not built yet.';

alter table public.nexus_activity_log enable row level security;

create policy nexus_activity_log_select_public on public.nexus_activity_log
  for select to anon, authenticated using (true);
create policy nexus_activity_log_insert_own on public.nexus_activity_log
  for insert to authenticated
  with check (to_id = (select private.current_to_id()));
