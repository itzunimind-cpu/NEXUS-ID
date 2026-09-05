-- NexusID — initial schema
-- Reflects decisions logged in NEXUSID_HANDOFF_LOG.md (Decision Log, 2026-09-04 / 2026-09-05).
-- Read that file before changing anything here — the "why" for every non-obvious
-- constraint below is documented there, not repeated inline except where load-bearing.
--
-- NOT YET APPLIED to the live Supabase project. Review, then run via
-- `supabase db push` (requires the project to be linked first).

create schema if not exists private;

-- =========================================================================
-- 1. nexus_tos — Tournament Organisers. The ONLY authenticated actor in v1.
-- =========================================================================
-- Email is intentionally NOT stored here — it lives in auth.users and is
-- read via auth_user_id. Decision 2026-09-05: "Supabase Auth scope: TO-only;
-- TO email sourced from auth session, not re-entered." Storing a duplicate
-- copy would create a second source of truth that can drift from auth.users.
create table public.nexus_tos (
  id bigint generated always as identity primary key,
  to_id text not null unique,                 -- public-facing 'TO-XXXXXXX' (default added below)
  auth_user_id uuid not null unique references auth.users (id) on delete cascade,
  to_ign text not null,
  to_uid text not null,
  to_real_name text,                          -- optional, per registration field spec
  organisation_name text not null,
  created_at timestamptz not null default now(),
  constraint nexus_tos_to_id_format check (to_id ~ '^TO-[A-Z0-9]{7}$')
);
comment on table public.nexus_tos is 'Tournament Organisers. Public profile, but only the owning auth user can write to it.';
comment on column public.nexus_tos.auth_user_id is 'FK to auth.users. Email/login identity lives there, not duplicated here.';

-- =========================================================================
-- 2. nexus_tournaments — a TO's events. Referenced by participations below.
--    Game lives HERE (a tournament is always a single game), not on the
--    player — see the player-identity design note in section 3.
--    (Not one of the roadmap's original 4 tables, but required: the TO
--    registration flow and the tournament editor both need a real entity
--    to attach a tournament name/dates/format/game to, separate from each
--    individual player's participation row.)
-- =========================================================================
create table public.nexus_tournaments (
  id bigint generated always as identity primary key,
  name text not null,
  game text not null,
  format text,                                -- e.g. 'Squad 4v4', '1v1 Duels'
  start_date date,
  end_date date,
  max_players integer check (max_players is null or max_players > 0),
  status text not null default 'draft' check (status in ('draft', 'active', 'concluded')),
  created_by_to_id bigint not null references public.nexus_tos (id) on delete restrict,
  created_at timestamptz not null default now()
);
create index nexus_tournaments_created_by_to_id_idx on public.nexus_tournaments (created_by_to_id);

-- =========================================================================
-- 3. nexus_players — the cross-game identity. Deliberately has NO game or
--    UID columns. Founding decision (roadmap, 2026-07): "identity must
--    survive across games/tournaments... encoding game would fragment
--    identity if a player plays multiple titles." One NX- ID per real
--    person, regardless of how many games they play. Game-specific data
--    (UID, IGN) lives in nexus_player_game_accounts below.
-- =========================================================================
create table public.nexus_players (
  id bigint generated always as identity primary key,
  nx_id text not null unique,                 -- public-facing 'NX-XXXXXXX' (default added below)
  real_name text,                             -- optional
  claimed boolean not null default false,     -- OTP claim flow deferred (roadmap), field stays
  claimed_at timestamptz,
  created_by_to_id bigint not null references public.nexus_tos (id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint nexus_players_nx_id_format check (nx_id ~ '^NX-[A-Z0-9]{7}$')
);
create index nexus_players_created_by_to_id_idx on public.nexus_players (created_by_to_id);

-- =========================================================================
-- 4. nexus_player_game_accounts — one row per (player, game). This is
--    where the actual anti-duplicate-identity mechanism lives: a player's
--    real-world identity anchor is their in-game UID, which cannot repeat
--    within a game (2026-09-05 decision). A single NX- ID can have several
--    of these rows (e.g. a BGMI account and a Valorant account).
-- =========================================================================
create table public.nexus_player_game_accounts (
  id bigint generated always as identity primary key,
  player_id bigint not null references public.nexus_players (id) on delete cascade,
  game text not null,
  in_game_uid text not null,
  in_game_name text not null,                 -- current/display IGN for this game; full history in nexus_ign_links
  created_by_to_id bigint not null references public.nexus_tos (id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint nexus_player_game_accounts_uid_unique_per_game unique (game, in_game_uid)
);
create index nexus_player_game_accounts_player_id_idx on public.nexus_player_game_accounts (player_id);
comment on constraint nexus_player_game_accounts_uid_unique_per_game on public.nexus_player_game_accounts is
  'The actual anti-duplicate-identity mechanism. A conflict here is the "UID already exists" case from the 2026-09-05 decision log — resolution is admin-level delete-and-restart, not exposed to TOs via RLS (see open risk note in the log).';

-- =========================================================================
-- 5. nexus_ign_links — full IGN history, one game-account at a time.
--    Deliberately INSERT-only (no UPDATE/DELETE policy below): "current"
--    IGN is derived by ordering `started_at` desc, not by closing out
--    `ended_at` on the prior row. The column exists for a future backfill/
--    admin process, not for the app to maintain at write time — don't add
--    an UPDATE policy just to start populating it without revisiting this.
-- =========================================================================
create table public.nexus_ign_links (
  id bigint generated always as identity primary key,
  game_account_id bigint not null references public.nexus_player_game_accounts (id) on delete cascade,
  ign text not null,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  created_by_to_id bigint not null references public.nexus_tos (id) on delete restrict
);
create index nexus_ign_links_game_account_id_idx on public.nexus_ign_links (game_account_id);

-- =========================================================================
-- 6. nexus_teams — persistent, reusable across tournaments and TOs.
-- =========================================================================
-- Decision 2026-09-05: teams are standing entities, not per-tournament
-- snapshots. Any TO can look one up by tm_id and its roster loads.
create table public.nexus_teams (
  id bigint generated always as identity primary key,
  tm_id text not null unique,                 -- public-facing 'TM-XXXXXXX' (default added below)
  team_name text not null,
  created_by_to_id bigint not null references public.nexus_tos (id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint nexus_teams_tm_id_format check (tm_id ~ '^TM-[A-Z0-9]{7}$')
);
create index nexus_teams_created_by_to_id_idx on public.nexus_teams (created_by_to_id);

-- =========================================================================
-- 7. nexus_team_members — many-to-many. A player can belong to several
--    teams concurrently or over time; this is by design, not an edge case
--    (2026-09-05 decision: "we cannot limit the player to a team").
-- =========================================================================
create table public.nexus_team_members (
  id bigint generated always as identity primary key,
  team_id bigint not null references public.nexus_teams (id) on delete cascade,
  player_id bigint not null references public.nexus_players (id) on delete cascade,
  added_by_to_id bigint not null references public.nexus_tos (id) on delete restrict,
  joined_at timestamptz not null default now(),
  left_at timestamptz
);
create index nexus_team_members_team_id_idx on public.nexus_team_members (team_id);
create index nexus_team_members_player_id_idx on public.nexus_team_members (player_id);

-- =========================================================================
-- 8. nexus_matches — individual matches/rounds within a tournament. A
--    tournament (e.g. "BGMI City Qualifier") is made of several of these
--    (Match 1, Match 2, finals...). Player-level results are logged per
--    match, not per tournament — see nexus_participations below.
-- =========================================================================
create table public.nexus_matches (
  id bigint generated always as identity primary key,
  tournament_id bigint not null references public.nexus_tournaments (id) on delete cascade,
  match_number integer not null check (match_number > 0),
  map text,
  played_at timestamptz,
  created_by_to_id bigint not null references public.nexus_tos (id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (tournament_id, match_number)
);
create index nexus_matches_tournament_id_idx on public.nexus_matches (tournament_id);

-- =========================================================================
-- 9. nexus_participations — the actual ledger, one row per player per
--    MATCH (not per tournament). A player's "tournament standing" and
--    "total kills" (shown on the profile timeline chip) are aggregates
--    computed across their nexus_participations rows for that tournament's
--    matches — NOT stored here. NexusID does not compute or store an
--    overall points/ranking table: that is a separate "points table" app
--    planned to connect via Nexus IDs later (2026-09-05 decision). This
--    table's job is only to be that app's raw, trustworthy data source.
--    Every row is append-only once its 48-hour edit window closes (below).
-- =========================================================================
create type public.nexus_trust_tier as enum ('to_reported', 'vod_verified');

create table public.nexus_participations (
  id bigint generated always as identity primary key,
  player_id bigint not null references public.nexus_players (id) on delete cascade,
  match_id bigint not null references public.nexus_matches (id) on delete cascade,
  team_id bigint references public.nexus_teams (id) on delete set null,  -- team played under FOR THIS match; nullable (solo entries)
  placement integer check (placement is null or placement > 0),
  kills integer not null default 0 check (kills >= 0),
  trust_tier public.nexus_trust_tier not null default 'to_reported',
  -- Reserved for the planned evidence-upload phase (2026-09-05 decision).
  -- evidence_stream_url currently doubles as the existing "VOD Proof" link
  -- field from the tournament editor concept.
  evidence_screenshot_url text,
  evidence_stream_url text,
  logged_by_to_id bigint not null references public.nexus_tos (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint nexus_participations_vod_requires_link
    check (trust_tier <> 'vod_verified' or evidence_stream_url is not null),
  constraint nexus_participations_one_row_per_player_per_match unique (match_id, player_id)
);
create index nexus_participations_player_id_idx on public.nexus_participations (player_id);
create index nexus_participations_match_id_idx on public.nexus_participations (match_id);
create index nexus_participations_team_id_idx on public.nexus_participations (team_id);
create index nexus_participations_logged_by_to_id_idx on public.nexus_participations (logged_by_to_id);
comment on column public.nexus_participations.created_at is
  'Edit-window anchor. RLS blocks UPDATEs once now() > created_at + 48h — see the 2026-09-05 decision log entry. Never reset this on edit.';

-- Convenience view for the profile-page timeline: one row per (player,
-- tournament) with aggregated kills and match count. "Overall standing"
-- (rank) is deliberately NOT computed here — no points ruleset is owned
-- by NexusID yet (see table comment above).
create or replace view public.nexus_player_tournament_summary
with (security_invoker = true) as
select
  p.player_id,
  m.tournament_id,
  count(*) as matches_played,
  sum(p.kills) as total_kills,
  min(p.placement) as best_placement
from public.nexus_participations p
join public.nexus_matches m on m.id = p.match_id
group by p.player_id, m.tournament_id;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger nexus_participations_set_updated_at
before update on public.nexus_participations
for each row execute function public.set_updated_at();

-- =========================================================================
-- 10. Seed the first IGN history row automatically when a game account is
--     created, so nexus_ign_links is never missing the entry that created it.
-- =========================================================================
create or replace function public.seed_initial_ign_link()
returns trigger
language plpgsql
as $$
begin
  insert into public.nexus_ign_links (game_account_id, ign, created_by_to_id)
  values (new.id, new.in_game_name, new.created_by_to_id);
  return new;
end;
$$;

create trigger nexus_player_game_accounts_seed_ign_link
after insert on public.nexus_player_game_accounts
for each row execute function public.seed_initial_ign_link();

-- =========================================================================
-- 11. Random ID generation for the three public-facing code columns.
--     Applied as column defaults so callers never need to invent/pass one.
-- =========================================================================
create or replace function public.generate_nexus_code(prefix text)
returns text
language plpgsql
as $$
declare
  charset text := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  candidate text;
begin
  loop
    candidate := prefix || '-' || (
      select string_agg(substr(charset, (floor(random() * length(charset)) + 1)::int, 1), '')
      from generate_series(1, 7)
    );
    exit when not exists (
      select 1 from public.nexus_players where nx_id = candidate
      union all
      select 1 from public.nexus_tos where to_id = candidate
      union all
      select 1 from public.nexus_teams where tm_id = candidate
    );
  end loop;
  return candidate;
end;
$$;

alter table public.nexus_tos alter column to_id set default public.generate_nexus_code('TO');
alter table public.nexus_players alter column nx_id set default public.generate_nexus_code('NX');
alter table public.nexus_teams alter column tm_id set default public.generate_nexus_code('TM');

-- =========================================================================
-- 12. Helper: resolve the calling TO's internal id from their auth session.
--     SECURITY DEFINER so it can read nexus_tos regardless of RLS state,
--     but it only ever returns the CALLER's own row (auth.uid() is fixed
--     to the invoking session, not caller-suppliable) — safe to expose to
--     `authenticated`. Kept in `private` schema and not granted to `anon`.
-- =========================================================================
create or replace function private.current_to_id()
returns bigint
language sql
security definer
stable
set search_path = ''
as $$
  select id from public.nexus_tos where auth_user_id = (select auth.uid());
$$;

revoke execute on function private.current_to_id() from public, anon;
grant execute on function private.current_to_id() to authenticated;

-- =========================================================================
-- 13. Row Level Security
--     Read model: everything is publicly readable (player/TO/team cards,
--     tournaments, and the participation ledger are all public per the
--     roadmap). Write model: only authenticated TOs, scoped to their own
--     rows, with nexus_participations additionally time-boxed to 48h.
--     No DELETE policy exists anywhere for the `authenticated` role — every
--     delete path (duplicate-player cleanup, post-48h corrections) is an
--     admin/service-role action outside the app, per the open risk note in
--     the 2026-09-05 decision log. Do not add a DELETE policy casually.
-- =========================================================================

alter table public.nexus_tos enable row level security;
create policy nexus_tos_select_public on public.nexus_tos
  for select to anon, authenticated using (true);
create policy nexus_tos_insert_self on public.nexus_tos
  for insert to authenticated
  with check ((select auth.uid()) = auth_user_id);
create policy nexus_tos_update_self on public.nexus_tos
  for update to authenticated
  using ((select auth.uid()) = auth_user_id)
  with check ((select auth.uid()) = auth_user_id);

alter table public.nexus_tournaments enable row level security;
create policy nexus_tournaments_select_public on public.nexus_tournaments
  for select to anon, authenticated using (true);
create policy nexus_tournaments_insert_own on public.nexus_tournaments
  for insert to authenticated
  with check (created_by_to_id = (select private.current_to_id()));
create policy nexus_tournaments_update_own on public.nexus_tournaments
  for update to authenticated
  using (created_by_to_id = (select private.current_to_id()))
  with check (created_by_to_id = (select private.current_to_id()));

alter table public.nexus_players enable row level security;
create policy nexus_players_select_public on public.nexus_players
  for select to anon, authenticated using (true);
create policy nexus_players_insert_any_to on public.nexus_players
  for insert to authenticated
  with check (created_by_to_id = (select private.current_to_id()));
create policy nexus_players_update_creator_only on public.nexus_players
  for update to authenticated
  using (created_by_to_id = (select private.current_to_id()))
  with check (created_by_to_id = (select private.current_to_id()));

alter table public.nexus_player_game_accounts enable row level security;
create policy nexus_player_game_accounts_select_public on public.nexus_player_game_accounts
  for select to anon, authenticated using (true);
-- Only the owning player's creating TO can add a game account (e.g. "this
-- player also plays Valorant") — same assumption as IGN edits below, flagged
-- as unconfirmed in the handoff log.
create policy nexus_player_game_accounts_insert_creator_only on public.nexus_player_game_accounts
  for insert to authenticated
  with check (
    created_by_to_id = (select private.current_to_id())
    and exists (
      select 1 from public.nexus_players p
      where p.id = player_id and p.created_by_to_id = (select private.current_to_id())
    )
  );
-- Needed so a player's current IGN can actually change (column-restricted
-- to in_game_name below — game/in_game_uid stay immutable, they're the
-- identity anchor). Without this, IGN history could never be updated.
create policy nexus_player_game_accounts_update_creator_only on public.nexus_player_game_accounts
  for update to authenticated
  using (created_by_to_id = (select private.current_to_id()))
  with check (created_by_to_id = (select private.current_to_id()));

alter table public.nexus_ign_links enable row level security;
create policy nexus_ign_links_select_public on public.nexus_ign_links
  for select to anon, authenticated using (true);
create policy nexus_ign_links_insert_creator_only on public.nexus_ign_links
  for insert to authenticated
  with check (
    created_by_to_id = (select private.current_to_id())
    and exists (
      select 1 from public.nexus_player_game_accounts ga
      join public.nexus_players p on p.id = ga.player_id
      where ga.id = game_account_id and p.created_by_to_id = (select private.current_to_id())
    )
  );

alter table public.nexus_teams enable row level security;
create policy nexus_teams_select_public on public.nexus_teams
  for select to anon, authenticated using (true);
create policy nexus_teams_insert_any_to on public.nexus_teams
  for insert to authenticated
  with check (created_by_to_id = (select private.current_to_id()));
create policy nexus_teams_update_creator_only on public.nexus_teams
  for update to authenticated
  using (created_by_to_id = (select private.current_to_id()))
  with check (created_by_to_id = (select private.current_to_id()));

alter table public.nexus_team_members enable row level security;
create policy nexus_team_members_select_public on public.nexus_team_members
  for select to anon, authenticated using (true);
-- Any authenticated TO can add an existing player to any existing team —
-- this is what makes "load an existing TM- roster into my tournament" work
-- across different TOs (2026-09-05 decision).
create policy nexus_team_members_insert_any_to on public.nexus_team_members
  for insert to authenticated
  with check (added_by_to_id = (select private.current_to_id()));
-- Removing a member is restricted to the team's own creator, so a rival TO
-- can't sabotage another team's roster just because they can add to it.
create policy nexus_team_members_delete_team_creator_only on public.nexus_team_members
  for delete to authenticated
  using (
    exists (
      select 1 from public.nexus_teams t
      where t.id = team_id and t.created_by_to_id = (select private.current_to_id())
    )
  );

alter table public.nexus_matches enable row level security;
create policy nexus_matches_select_public on public.nexus_matches
  for select to anon, authenticated using (true);
-- Only the tournament's own creator can add matches to it.
create policy nexus_matches_insert_tournament_creator_only on public.nexus_matches
  for insert to authenticated
  with check (
    created_by_to_id = (select private.current_to_id())
    and exists (
      select 1 from public.nexus_tournaments t
      where t.id = tournament_id and t.created_by_to_id = (select private.current_to_id())
    )
  );
create policy nexus_matches_update_tournament_creator_only on public.nexus_matches
  for update to authenticated
  using (
    exists (
      select 1 from public.nexus_tournaments t
      where t.id = tournament_id and t.created_by_to_id = (select private.current_to_id())
    )
  )
  with check (
    exists (
      select 1 from public.nexus_tournaments t
      where t.id = tournament_id and t.created_by_to_id = (select private.current_to_id())
    )
  );

alter table public.nexus_participations enable row level security;
create policy nexus_participations_select_public on public.nexus_participations
  for select to anon, authenticated using (true);
create policy nexus_participations_insert_own on public.nexus_participations
  for insert to authenticated
  with check (logged_by_to_id = (select private.current_to_id()));
-- The 48-hour lock: once now() passes created_at + 48h, this USING clause
-- matches zero rows, so no UPDATE can succeed — enforced at the database
-- level, not just hidden in the UI (2026-09-05 decision log).
create policy nexus_participations_update_within_window on public.nexus_participations
  for update to authenticated
  using (
    logged_by_to_id = (select private.current_to_id())
    and now() <= created_at + interval '48 hours'
  )
  with check (
    logged_by_to_id = (select private.current_to_id())
    and now() <= created_at + interval '48 hours'
  );

-- =========================================================================
-- 14. Column-level UPDATE privileges.
--     RLS above controls WHICH ROWS a TO can touch; it does NOT restrict
--     WHICH COLUMNS. Supabase's default grants give `authenticated` full
--     UPDATE on every column of every public table, so without this section
--     a TO could rewrite their own permanent to_id/nx_id/tm_id, silently
--     flip a player's `claimed` flag, or — most importantly — repoint an
--     already-logged nexus_participations row at a different player or
--     match within its 48-hour window, which would defeat the entire point
--     of that lock. Every permanent/system-owned column is locked down here
--     by revoking table-wide UPDATE and re-granting it only on the columns
--     that are actually meant to be editable.
-- =========================================================================

revoke update on public.nexus_tos from authenticated, anon;
grant update (to_ign, to_uid, to_real_name, organisation_name)
  on public.nexus_tos to authenticated;

revoke update on public.nexus_tournaments from authenticated, anon;
grant update (name, game, format, start_date, end_date, max_players, status)
  on public.nexus_tournaments to authenticated;

revoke update on public.nexus_players from authenticated, anon;
grant update (real_name) on public.nexus_players to authenticated;
-- nx_id, claimed, claimed_at, created_by_to_id stay locked: claim status
-- changes only through a future claim-flow function, never a raw client UPDATE.

revoke update on public.nexus_player_game_accounts from authenticated, anon;
grant update (in_game_name) on public.nexus_player_game_accounts to authenticated;
-- game and in_game_uid are the identity anchor (2026-09-05 decision) —
-- changing them post-creation would undermine the anti-duplicate mechanism.

revoke update on public.nexus_teams from authenticated, anon;
grant update (team_name) on public.nexus_teams to authenticated;

revoke update on public.nexus_matches from authenticated, anon;
grant update (match_number, map, played_at) on public.nexus_matches to authenticated;

revoke update on public.nexus_participations from authenticated, anon;
grant update (team_id, placement, kills, trust_tier, evidence_screenshot_url, evidence_stream_url)
  on public.nexus_participations to authenticated;
-- player_id, match_id, logged_by_to_id are locked — this is what actually
-- makes the 48-hour edit window meaningful: a TO can correct a result's
-- numbers within the window, but can never re-point it at a different
-- player or match, before or after the lock.
