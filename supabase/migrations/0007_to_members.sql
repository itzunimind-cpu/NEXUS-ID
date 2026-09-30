-- NexusID — shared TO accounts: members + invites (Phase 0.5 of the Telegram bot integration)
-- See NEXUSID_TELEGRAM_INTEGRATION_PLAN.md decisions 6–7 and the 2026-09-30
-- Decision Log entry. Requires 0005_telegram_to_linking.sql and
-- 0006_bot_sessions.sql to have been applied first. Apply via the Supabase
-- Dashboard SQL Editor (same manual path as every prior migration).
--
-- A TO ID (org) is now run by members, each with their own login — never a
-- shared password. private.current_to_id() resolves through membership, so
-- every existing RLS policy from 0001–0004 keeps working unchanged: any
-- active member acts as the TO. nexus_tos.auth_user_id stays as the record
-- of who created the TO.

-- =========================================================================
-- 1. nexus_to_members
-- =========================================================================
create table public.nexus_to_members (
  id bigint generated always as identity primary key,
  to_id bigint not null references public.nexus_tos (id) on delete cascade,
  auth_user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('owner', 'admin')),
  display_name text not null,
  telegram_user_id bigint,
  telegram_linked_at timestamptz,
  joined_at timestamptz not null default now(),
  removed_at timestamptz
);

comment on table public.nexus_to_members is
  'People who can act as a TO. One active membership per login (v1). Owner invites/removes admins. Joined only via the service-role bot or accept_to_invite(), never a client INSERT.';

-- v1: one login (and one Telegram account) belongs to one TO at a time.
-- Partial indexes so a removed member can later join a different TO.
create unique index nexus_to_members_auth_user_active_idx
  on public.nexus_to_members (auth_user_id) where removed_at is null;
create unique index nexus_to_members_telegram_active_idx
  on public.nexus_to_members (telegram_user_id) where removed_at is null and telegram_user_id is not null;
create unique index nexus_to_members_one_owner_idx
  on public.nexus_to_members (to_id) where role = 'owner' and removed_at is null;
create index nexus_to_members_to_id_idx on public.nexus_to_members (to_id);

-- Backfill: every existing TO's creator becomes its owner.
insert into public.nexus_to_members (to_id, auth_user_id, role, display_name, joined_at)
select id, auth_user_id, 'owner', to_ign, created_at from public.nexus_tos;

-- Fold Phase 0's one-Telegram-per-TO links (0005) into the owner's
-- membership — each member now links their own Telegram account.
update public.nexus_to_members m
set telegram_user_id = l.telegram_user_id, telegram_linked_at = l.linked_at
from public.nexus_to_telegram_links l
where m.to_id = l.to_id and m.role = 'owner';

drop table public.nexus_to_telegram_links;

-- Creating a TO (web onboarding or the bot) makes its creator the owner.
-- Also what stops an existing member of one TO from creating a second one:
-- the active-login unique index above rejects the insert.
create or replace function private.add_to_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.nexus_to_members (to_id, auth_user_id, role, display_name)
  values (new.id, new.auth_user_id, 'owner', new.to_ign);
  return new;
end;
$$;

create trigger nexus_tos_add_owner
after insert on public.nexus_tos
for each row execute function private.add_to_owner();

-- =========================================================================
-- 2. Membership-aware helpers. current_to_id() keeps its exact signature
--    from 0001 §12 so every policy that calls it is untouched.
-- =========================================================================
create or replace function private.current_to_id()
returns bigint
language sql
security definer
stable
set search_path = ''
as $$
  select to_id from public.nexus_to_members
  where auth_user_id = (select auth.uid()) and removed_at is null;
$$;

create or replace function private.current_to_role()
returns text
language sql
security definer
stable
set search_path = ''
as $$
  select role from public.nexus_to_members
  where auth_user_id = (select auth.uid()) and removed_at is null;
$$;

revoke execute on function private.current_to_role() from public, anon;
grant execute on function private.current_to_role() to authenticated;

-- =========================================================================
-- 3. RLS on nexus_to_members. Members see their own TO's member list. The
--    owner can remove (soft-delete) admins — never themselves or another
--    owner. No client INSERT or DELETE.
-- =========================================================================
alter table public.nexus_to_members enable row level security;
create policy nexus_to_members_select_same_to on public.nexus_to_members
  for select to authenticated
  using (to_id = (select private.current_to_id()));
create policy nexus_to_members_owner_removes_admin on public.nexus_to_members
  for update to authenticated
  using (
    to_id = (select private.current_to_id())
    and (select private.current_to_role()) = 'owner'
    and role = 'admin'
  )
  with check (
    to_id = (select private.current_to_id())
    and role = 'admin'
  );
revoke insert, update, delete on public.nexus_to_members from authenticated, anon;
grant update (removed_at) on public.nexus_to_members to authenticated;

-- =========================================================================
-- 4. nexus_to_invites — owner-generated links (7 days, single use) that let
--    someone join a TO as an admin, from the bot (t.me/<bot>?start=inv_<code>)
--    or the web (/join.html?code=<code>).
-- =========================================================================
create table public.nexus_to_invites (
  id bigint generated always as identity primary key,
  to_id bigint not null references public.nexus_tos (id) on delete cascade,
  code text not null unique,
  role text not null default 'admin' check (role = 'admin'),
  created_by_auth_user_id uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '7 days',
  consumed_at timestamptz,
  consumed_by_member_id bigint references public.nexus_to_members (id) on delete set null
);
create index nexus_to_invites_to_id_idx on public.nexus_to_invites (to_id);

create or replace function public.generate_to_invite_code()
returns text
language plpgsql
as $$
declare
  candidate text;
begin
  loop
    candidate := upper(substr(md5(gen_random_uuid()::text), 1, 12));
    exit when not exists (select 1 from public.nexus_to_invites where code = candidate);
  end loop;
  return candidate;
end;
$$;

alter table public.nexus_to_invites alter column code set default public.generate_to_invite_code();

alter table public.nexus_to_invites enable row level security;
create policy nexus_to_invites_owner_select on public.nexus_to_invites
  for select to authenticated
  using (to_id = (select private.current_to_id()) and (select private.current_to_role()) = 'owner');
create policy nexus_to_invites_owner_insert on public.nexus_to_invites
  for insert to authenticated
  with check (to_id = (select private.current_to_id()) and (select private.current_to_role()) = 'owner');
-- Clients supply only to_id; code/role/expiry/creator come from defaults.
revoke insert, update, delete on public.nexus_to_invites from authenticated, anon;
grant insert (to_id) on public.nexus_to_invites to authenticated;

-- Web-side invite acceptance. SECURITY DEFINER because a not-yet-member
-- can't see or write either table under RLS; every check is explicit here.
create or replace function public.accept_to_invite(invite_code text, member_name text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  invite public.nexus_to_invites%rowtype;
  new_member_id bigint;
  org_to_id text;
begin
  if (select auth.uid()) is null then
    raise exception 'Log in first.';
  end if;
  if coalesce(trim(member_name), '') = '' then
    raise exception 'Enter your name.';
  end if;
  if exists (
    select 1 from public.nexus_to_members
    where auth_user_id = (select auth.uid()) and removed_at is null
  ) then
    raise exception 'This login already belongs to a TO account.';
  end if;

  select * into invite from public.nexus_to_invites
  where code = upper(trim(invite_code))
  for update;

  if invite.id is null or invite.consumed_at is not null or invite.expires_at < now() then
    raise exception 'This invite link is not valid or has expired.';
  end if;

  insert into public.nexus_to_members (to_id, auth_user_id, role, display_name)
  values (invite.to_id, (select auth.uid()), invite.role, trim(member_name))
  returning id into new_member_id;

  update public.nexus_to_invites
  set consumed_at = now(), consumed_by_member_id = new_member_id
  where id = invite.id;

  select to_id into org_to_id from public.nexus_tos where id = invite.to_id;
  return org_to_id;
end;
$$;

revoke execute on function public.accept_to_invite(text, text) from public, anon;
grant execute on function public.accept_to_invite(text, text) to authenticated;

-- =========================================================================
-- 5. nexus_bot_link_codes (0005) now binds Telegram to the specific member
--    who generated the code, not just the TO. Filled from the session by
--    default — the existing `grant insert (to_id)` keeps clients from
--    setting it.
-- =========================================================================
alter table public.nexus_bot_link_codes
  add column auth_user_id uuid default auth.uid() references auth.users (id) on delete cascade;
