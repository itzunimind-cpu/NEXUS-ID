-- NexusID — bot conversation state (Phase 0 of the Telegram bot integration)
-- Replaces the never-applied 0006_wa_sessions.sql. Schema-ready ahead of
-- need: Phase 0's link-only flow doesn't yet require multi-step state, but
-- every later phase's menu/state machine does. Same "schema now, feature
-- later" pattern as nexus_activity_log's still-dormant event types
-- (0003_squad_to_profile_additions.sql).

-- Keyed by (channel, external_user_id) rather than a Telegram-specific
-- column so a WhatsApp channel could be added later by widening the check
-- constraint, without a second sessions table.
create table public.nexus_bot_sessions (
  channel text not null check (channel in ('telegram')),
  external_user_id text not null,
  to_id bigint references public.nexus_tos (id) on delete set null,
  state jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (channel, external_user_id)
);

comment on table public.nexus_bot_sessions is
  'Per-user conversation state for the NexusID bot. Written only by the service-role webhook.';

-- Reuses public.set_updated_at(), already defined in 0001_init_nexusid_schema.sql.
create trigger nexus_bot_sessions_set_updated_at
before update on public.nexus_bot_sessions
for each row execute function public.set_updated_at();

alter table public.nexus_bot_sessions enable row level security;
-- No policies at all: RLS-enabled-with-zero-policies denies every row to
-- anon/authenticated by default. Only the service role (which bypasses RLS)
-- ever reads/writes this table — do not add a client-facing policy here.
revoke all on public.nexus_bot_sessions from authenticated, anon;
