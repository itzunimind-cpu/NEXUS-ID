-- NexusID — Telegram account linking for TOs (Phase 0 of the Telegram bot integration)
-- Replaces the never-applied 0005_whatsapp_phone_linking.sql (see the
-- 2026-09-30 Decision Log entry in NEXUSID_HANDOFF_LOG.md for why the bot
-- moved from WhatsApp to Telegram). Apply via the Supabase Dashboard SQL
-- Editor (same manual path as 0001-0004 — no working `supabase db push`/CLI
-- path in this environment).

-- =========================================================================
-- 1. nexus_to_telegram_links — binds one Telegram account to a TO.
--    A separate table rather than a column on nexus_tos: nexus_tos is
--    publicly SELECTable (0001 §13, `using (true)` for anon), so a column
--    there would publish every TO's Telegram user id to anyone. This table
--    is readable only by the owning TO, and writable only by the
--    service-role Telegram webhook after it verifies a one-time code below —
--    a client-writable link would let any TO silently bind their own
--    Telegram account onto another TO's identity.
-- =========================================================================
create table public.nexus_to_telegram_links (
  to_id bigint primary key references public.nexus_tos (id) on delete cascade,
  telegram_user_id bigint not null unique,
  linked_at timestamptz not null default now()
);

comment on table public.nexus_to_telegram_links is
  'One Telegram account per TO, linked via a one-time code (see nexus_bot_link_codes). Written only by the Telegram webhook (service role).';

alter table public.nexus_to_telegram_links enable row level security;
create policy nexus_to_telegram_links_select_own on public.nexus_to_telegram_links
  for select to authenticated
  using (to_id = (select private.current_to_id()));
-- No INSERT/UPDATE/DELETE for any client role — see the header above.
revoke insert, update, delete on public.nexus_to_telegram_links from authenticated, anon;

-- =========================================================================
-- 2. nexus_bot_link_codes — short-lived codes a TO generates from the web
--    dashboard and sends to the bot to prove they hold both accounts.
--    Channel-neutral name on purpose: if WhatsApp is added back later
--    (after Udyam + Meta verification), it reuses this same table.
--
--    10 hex chars (~1 trillion values), not 6 digits: anyone can message a
--    Telegram bot, so a short numeric code could be brute-forced inside its
--    15-minute window to hijack a TO's account. The dashboard hands the code
--    over as a one-tap t.me deep link, so its length costs the TO nothing.
-- =========================================================================
create table public.nexus_bot_link_codes (
  id bigint generated always as identity primary key,
  to_id bigint not null references public.nexus_tos (id) on delete cascade,
  code text not null unique,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '15 minutes',
  consumed_at timestamptz
);
create index nexus_bot_link_codes_to_id_idx on public.nexus_bot_link_codes (to_id);

create or replace function public.generate_bot_link_code()
returns text
language plpgsql
as $$
declare
  candidate text;
begin
  loop
    candidate := upper(substr(md5(gen_random_uuid()::text), 1, 10));
    exit when not exists (select 1 from public.nexus_bot_link_codes where code = candidate);
  end loop;
  return candidate;
end;
$$;

alter table public.nexus_bot_link_codes alter column code set default public.generate_bot_link_code();

alter table public.nexus_bot_link_codes enable row level security;
create policy nexus_bot_link_codes_select_own on public.nexus_bot_link_codes
  for select to authenticated
  using (to_id = (select private.current_to_id()));
create policy nexus_bot_link_codes_insert_own on public.nexus_bot_link_codes
  for insert to authenticated
  with check (to_id = (select private.current_to_id()));
-- Clients may only supply to_id on insert — code/expires_at/consumed_at
-- always come from the column defaults, so a TO can't mint a code of their
-- choosing or one that never expires. No UPDATE/DELETE for any client role:
-- a code is only ever consumed by the service-role webhook.
revoke insert, update, delete on public.nexus_bot_link_codes from authenticated, anon;
grant insert (to_id) on public.nexus_bot_link_codes to authenticated;
