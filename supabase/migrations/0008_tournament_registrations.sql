-- NexusID — tournament registrations (Phase 1 of the Telegram bot integration)
-- See NEXUSID_TELEGRAM_INTEGRATION_PLAN.md decisions 9, 10, 12. Requires
-- 0007_to_members.sql. Apply via the Supabase Dashboard SQL Editor.
--
-- Anyone can apply to a TO's open tournament from the bot, with or without a
-- Nexus ID: a team name plus each player's IGN and BGMI UID. Applications
-- start 'pending'; a TO member approves or rejects them (bot or web). All
-- writes go through the service role (bot webhook / api/registrations), so
-- clients only get read access here.

-- =========================================================================
-- 1. Tournaments: a registrations switch and a team size.
-- =========================================================================
alter table public.nexus_tournaments
  add column registrations_open boolean not null default false,
  add column team_size integer not null default 4 check (team_size in (1, 2, 4));

comment on column public.nexus_tournaments.team_size is
  'Players per team: 1 solo, 2 duo, 4 squad. Applications may add substitutes (see api/telegram/_apply.js).';

-- Additive to the column grants from 0001 §14 / 0002 / 0003.
grant update (registrations_open, team_size) on public.nexus_tournaments to authenticated;

create index nexus_tournaments_registrations_open_idx
  on public.nexus_tournaments (created_by_to_id) where registrations_open;

-- =========================================================================
-- 2. nexus_tournament_registrations — one row per team (or solo player)
--    applying to a tournament.
-- =========================================================================
create table public.nexus_tournament_registrations (
  id bigint generated always as identity primary key,
  tournament_id bigint not null references public.nexus_tournaments (id) on delete cascade,
  team_name text not null check (char_length(trim(team_name)) between 1 and 60),
  team_id bigint references public.nexus_teams (id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  registered_via text not null check (registered_via in ('telegram', 'web')),
  applicant_telegram_user_id bigint,
  decided_by_member_id bigint references public.nexus_to_members (id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default now()
);

comment on table public.nexus_tournament_registrations is
  'Tournament applications. team_id is reserved for when team captains can apply as an existing TM- team; today every entry is a named team. Written only by the service role.';

-- A team name, and an applicant, can each hold one live entry per tournament.
-- Rejected entries don't count, so a rejected team can re-apply.
create unique index nexus_tournament_registrations_team_name_idx
  on public.nexus_tournament_registrations (tournament_id, lower(team_name))
  where status <> 'rejected';
create unique index nexus_tournament_registrations_applicant_idx
  on public.nexus_tournament_registrations (tournament_id, applicant_telegram_user_id)
  where status <> 'rejected' and applicant_telegram_user_id is not null;
create index nexus_tournament_registrations_tournament_idx
  on public.nexus_tournament_registrations (tournament_id, status);
create index nexus_tournament_registrations_applicant_lookup_idx
  on public.nexus_tournament_registrations (applicant_telegram_user_id);

-- =========================================================================
-- 3. nexus_tournament_registration_members — the players on each entry.
--    player_uid is kept even for players without a Nexus ID (decision 10),
--    so their results can attach to a Nexus ID created later.
-- =========================================================================
create table public.nexus_tournament_registration_members (
  id bigint generated always as identity primary key,
  registration_id bigint not null references public.nexus_tournament_registrations (id) on delete cascade,
  tournament_id bigint not null references public.nexus_tournaments (id) on delete cascade,
  player_ign text not null check (char_length(trim(player_ign)) between 1 and 40),
  player_uid text not null check (player_uid ~ '^[0-9]{6,15}$'),
  player_id bigint references public.nexus_players (id) on delete set null,
  removed_at timestamptz,
  created_at timestamptz not null default now()
);

-- tournament_id is duplicated from the registration so this index can stop
-- one player (UID) sitting on two live entries in the same tournament.
-- Rejecting an entry sets removed_at on its players, freeing their UIDs.
create unique index nexus_tournament_registration_members_uid_idx
  on public.nexus_tournament_registration_members (tournament_id, player_uid)
  where removed_at is null;
create index nexus_tournament_registration_members_registration_idx
  on public.nexus_tournament_registration_members (registration_id);
create index nexus_tournament_registration_members_player_idx
  on public.nexus_tournament_registration_members (player_id);

-- When a Nexus ID is created later for a UID that already played as a guest,
-- attach those entries to it — "your history is already waiting".
create or replace function private.attach_guest_registrations()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.nexus_tournament_registration_members m
  set player_id = new.player_id
  from public.nexus_tournaments t
  where m.tournament_id = t.id
    and t.game = new.game
    and m.player_uid = new.in_game_uid
    and m.player_id is null;
  return new;
end;
$$;

create trigger nexus_player_game_accounts_attach_guest_registrations
after insert on public.nexus_player_game_accounts
for each row execute function private.attach_guest_registrations();

-- =========================================================================
-- 4. RLS: members of the owning TO can read their tournaments' entries.
--    No client writes — the bot and api/registrations/decide.js use the
--    service role and check TO membership themselves.
-- =========================================================================
alter table public.nexus_tournament_registrations enable row level security;
create policy nexus_tournament_registrations_select_owner on public.nexus_tournament_registrations
  for select to authenticated
  using (exists (
    select 1 from public.nexus_tournaments t
    where t.id = tournament_id and t.created_by_to_id = (select private.current_to_id())
  ));
revoke insert, update, delete on public.nexus_tournament_registrations from authenticated, anon;

alter table public.nexus_tournament_registration_members enable row level security;
create policy nexus_tournament_registration_members_select_owner on public.nexus_tournament_registration_members
  for select to authenticated
  using (exists (
    select 1 from public.nexus_tournaments t
    where t.id = tournament_id and t.created_by_to_id = (select private.current_to_id())
  ));
revoke insert, update, delete on public.nexus_tournament_registration_members from authenticated, anon;
