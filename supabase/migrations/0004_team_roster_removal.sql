-- NexusID — team roster removal
-- Adds what team-roster.html needs to remove a player from a team's active
-- roster. nexus_team_members has select/insert/delete RLS from 0001 but no
-- update policy at all, so there was no RLS-legal way to set left_at — the
-- only option was a hard DELETE, which would erase roster history rather
-- than produce a "left" event (team.html's History tab, built 2026-09-16,
-- already reads left_at to render exactly that). See NEXUSID_HANDOFF_LOG.md,
-- 2026-09-16 session, for the decision behind soft-remove over hard-delete.
--
-- NOT YET APPLIED to the live Supabase project. Apply via the Supabase
-- Dashboard SQL Editor (no working `supabase db push`/CLI or MCP auth path
-- in this environment — see the 0002/0003 migrations' applied-via notes).

-- Same exists() shape as nexus_team_members_delete_team_creator_only (0001)
-- — only the team's own creator can remove a member.
create policy nexus_team_members_update_team_creator_only on public.nexus_team_members
  for update to authenticated
  using (
    exists (
      select 1 from public.nexus_teams t
      where t.id = team_id and t.created_by_to_id = (select private.current_to_id())
    )
  )
  with check (
    exists (
      select 1 from public.nexus_teams t
      where t.id = team_id and t.created_by_to_id = (select private.current_to_id())
    )
  );

-- Column-level lockdown, same pattern as every other table in 0001 section 14:
-- only left_at becomes updatable. joined_at/player_id/team_id/added_by_to_id
-- stay locked — a removal can only record when someone left, never rewrite
-- who was on the team or when they joined.
revoke update on public.nexus_team_members from authenticated, anon;
grant update (left_at) on public.nexus_team_members to authenticated;
