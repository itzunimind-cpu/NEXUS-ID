-- NexusID — WhatsApp phone linking for TOs (Phase 0 of the WhatsApp integration)
-- See NEXUSID_HANDOFF_LOG.md and the approved WhatsApp integration plan for full
-- rationale. Apply via the Supabase Dashboard SQL Editor (same manual path as
-- 0001-0004 — no working `supabase db push`/CLI path in this environment).

-- =========================================================================
-- 1. nexus_tos.whatsapp_phone_e164 — binds one WhatsApp number to a TO.
--    Deliberately NOT added to nexus_tos's existing `grant update (...)`
--    list from 0001 §14 — only the service-role WhatsApp webhook may ever
--    set this, after verifying the one-time code below. A client-updatable
--    phone column would let any authenticated TO silently steal another
--    TO's WhatsApp identity by re-linking their own number onto it.
-- =========================================================================
alter table public.nexus_tos
  add column whatsapp_phone_e164 text unique;

comment on column public.nexus_tos.whatsapp_phone_e164 is
  'E.164 phone number linked via a one-time code (see nexus_wa_link_codes). Set only by the WhatsApp webhook (service role), never by a client UPDATE.';

-- =========================================================================
-- 2. nexus_wa_link_codes — short-lived codes a TO generates from the web
--    dashboard and sends back over WhatsApp to prove they hold both.
-- =========================================================================
create table public.nexus_wa_link_codes (
  id bigint generated always as identity primary key,
  to_id bigint not null references public.nexus_tos (id) on delete cascade,
  code text not null unique,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '15 minutes',
  consumed_at timestamptz
);
create index nexus_wa_link_codes_to_id_idx on public.nexus_wa_link_codes (to_id);

create or replace function public.generate_wa_link_code()
returns text
language plpgsql
as $$
declare
  candidate text;
begin
  loop
    candidate := lpad((floor(random() * 1000000))::int::text, 6, '0');
    exit when not exists (select 1 from public.nexus_wa_link_codes where code = candidate);
  end loop;
  return candidate;
end;
$$;

alter table public.nexus_wa_link_codes alter column code set default public.generate_wa_link_code();

alter table public.nexus_wa_link_codes enable row level security;
create policy nexus_wa_link_codes_select_own on public.nexus_wa_link_codes
  for select to authenticated
  using (to_id = (select private.current_to_id()));
create policy nexus_wa_link_codes_insert_own on public.nexus_wa_link_codes
  for insert to authenticated
  with check (to_id = (select private.current_to_id()));
-- No UPDATE/DELETE grant to any client role — a code is only ever consumed
-- (marking consumed_at) by the service-role webhook, which bypasses RLS
-- entirely by design. Do not add a client UPDATE policy here.
revoke update, delete on public.nexus_wa_link_codes from authenticated, anon;
