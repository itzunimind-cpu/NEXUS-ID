-- NexusID — players can create their own Nexus ID from the Telegram bot
-- Moti, 2026-09-30: whoever applies to a tournament from the bot must give
-- their own UID and gets a Nexus ID (they're always player #1 on the
-- roster); their teammates' UIDs stay optional (0009). Requires 0009.
-- Apply via the Supabase Dashboard SQL Editor.
--
-- Until now every Nexus ID was created by a TO (created_by_to_id NOT NULL).
-- A self-registered player has no creating TO, so those columns become
-- nullable and nexus_players.created_via records where it came from. The
-- 0001 RLS policies are unchanged: a NULL created_by_to_id never equals
-- current_to_id(), so no TO can edit a self-registered player from the
-- web — only the service-role bot writes them.

alter table public.nexus_players alter column created_by_to_id drop not null;
alter table public.nexus_player_game_accounts alter column created_by_to_id drop not null;
-- seed_initial_ign_link() (0001) copies created_by_to_id from the new game
-- account, so this must be nullable too.
alter table public.nexus_ign_links alter column created_by_to_id drop not null;

alter table public.nexus_players
  add column created_via text not null default 'to' check (created_via in ('to', 'telegram'));

comment on column public.nexus_players.created_via is
  '''to'' = created by a TO on the web (created_by_to_id set); ''telegram'' = the player created it themselves from the bot (created_by_to_id NULL). Not a verification — claimed stays false.';

-- =========================================================================
-- nexus_player_telegram_links — which Telegram account a Nexus ID belongs
-- to. One each way. Private: service role only (a public mapping would let
-- anyone look up a player's Telegram account).
-- =========================================================================
create table public.nexus_player_telegram_links (
  player_id bigint primary key references public.nexus_players (id) on delete cascade,
  telegram_user_id bigint not null unique,
  linked_at timestamptz not null default now()
);

comment on table public.nexus_player_telegram_links is
  'Telegram account that registered/uses each Nexus ID. Set only by the bot. Not a claim or verification.';

alter table public.nexus_player_telegram_links enable row level security;
revoke all on public.nexus_player_telegram_links from authenticated, anon;
