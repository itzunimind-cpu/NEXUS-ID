-- NexusID — WhatsApp bot session state (Phase 0 of the WhatsApp integration)
-- Schema-ready ahead of need: Phase 0's link-only flow doesn't yet require
-- multi-step state, but every later phase's menu/state machine does. Same
-- "schema now, feature later" pattern as nexus_activity_log's still-dormant
-- event types (0003_squad_to_profile_additions.sql).

create table public.nexus_wa_sessions (
  phone_e164 text primary key,
  to_id bigint references public.nexus_tos (id) on delete set null,
  state jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

comment on table public.nexus_wa_sessions is
  'Per-phone-number conversation state for the WhatsApp bot. Written only by the service-role webhook.';

-- Reuses public.set_updated_at(), already defined in 0001_init_nexusid_schema.sql.
create trigger nexus_wa_sessions_set_updated_at
before update on public.nexus_wa_sessions
for each row execute function public.set_updated_at();

alter table public.nexus_wa_sessions enable row level security;
-- No policies at all: RLS-enabled-with-zero-policies denies every row to
-- anon/authenticated by default. Only the service role (which bypasses RLS)
-- ever reads/writes this table — do not add a client-facing policy here.
revoke all on public.nexus_wa_sessions from authenticated, anon;
