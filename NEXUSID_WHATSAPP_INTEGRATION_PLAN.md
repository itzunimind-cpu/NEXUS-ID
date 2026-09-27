# NexusID — WhatsApp Integration Plan

**Status as of 2026-09-27:** Approved by Moti in full. **Phase 0 is built** (see `NEXUSID_HANDOFF_LOG.md`'s 2026-09-27 Session Log / Change Log entries). **Phases 1–4 below are fully designed but not yet built.** This file is the durable, in-repo copy of that approval — the Claude Code planning-tool file it originated from lives outside this repo and isn't guaranteed to persist, so this is now the source of truth. Read this in full before redesigning any of the WhatsApp feature from scratch.

Also read alongside this: `NEXUSID_HANDOFF_LOG.md` Section 6 (Open Threads) for the **Udyam Registration blocker** — Meta's WhatsApp Cloud API caps an unverified app at 5 manually-added test numbers, which blocks Phase 1's player-self-service flow (decision 5 below) from working for real strangers until that's resolved. Nothing in this plan is blocked from being *built*, only from going live for real, unknown users.

---

## Context

NexusID (part of the Metazone BGMI esports platform) currently has zero self-service registration: every player/team/tournament record is created manually by a Tournament Organiser (TO) through web forms, and every TO must authenticate via Supabase Auth on the website. Moti wants to let TOs and teams register for tournaments, create their Nexus IDs, manage rosters, track payment status, and check standings/kill-count stats — all by sending WhatsApp messages, without necessarily ever visiting the website. This needs to work for teams/players who don't have an existing Nexus ID at all ("guest" entries), and it needs to stay within an existing product decision that NexusID never processes real money (payments/escrow), logged 2026-07 for RBI Payment Aggregator regulation reasons.

The project today is 100% static HTML + client-side Supabase calls (RLS-enforced), with no backend/API layer at all before this plan. Phase 0 added the first backend piece the project has ever needed.

## Decisions already made (do not re-litigate — see the 2026-09-27 Decision Log entry in the handoff log for full rationale)

1. **WhatsApp channel**: official Meta WhatsApp Cloud API — free for the core flow (replying to a user-initiated message inside the 24h session window costs nothing; only a platform-initiated message outside that window, e.g. a payment reminder or a push notification to a TO, would need a paid template message). No unofficial library, no paid BSP.
2. **Payments**: record-keeping only. The bot/dashboard tracks a paid/unpaid/partial status per registration, set manually by the TO after collecting money outside the platform. No gateway, no real funds touch NexusID. Reaffirms, does not reverse, the 2026-07 "no payments/escrow" baseline decision.
3. **TO identity on WhatsApp**: a TO must link their phone number to their existing web account via a one-time code generated on the dashboard and sent back over WhatsApp. No separate "WhatsApp-only TO" identity — every write still attributes to a real `nexus_tos` row.
4. **Guest tournament entries** (no existing `NX-`/`TM-` ID, explicitly "no history tracked"): no `nexus_players`/`nexus_teams` rows are created, so guests never appear in search/profiles/other tournaments' stats. But a TO must still be able to log placement + kills for guest entries and have them show up correctly in that tournament's own standings — this requires relaxing `nexus_participations` (below), not just adding a registration table. **All registration/roster data for a tournament — guest or linked — must still be visible on the TO's own tournament history/dashboard view** (they're the tournament's owner; "no history tracked" means guests don't get a *searchable public profile*, not that the TO can't see who registered).
5. **Self-service registration requests from players/teams who already have a Nexus ID**: a captain (or player) can link their *existing* `TM-`/`NX-` id to their own WhatsApp number (separate from TO linking — this isn't a login, just a phone↔id binding, consistent with the product's existing low-trust-tier stance on team/player identity — no password, no OTP-to-a-verified-owner, since these IDs are already public/lookup-able on `team.html`/`player.html` and nothing today models a single "owner" of a team). Once linked, they can browse a TO's open tournaments over WhatsApp and submit a registration request in one structured message (team name + player list, in a fixed format the bot supplies) *without going through the TO first*. The request sits as **pending** until the TO approves it (via WhatsApp or web) — approval auto-populates the real registration/roster rows, removing the TO's manual copy-paste-from-WhatsApp-groups step into the tournament editor. This is the feature that most directly needs Meta Business Verification (see the Udyam note above) — it only works for strangers once that's done.

## Backend layer: Vercel serverless functions under `/api` (built, Phase 0)

Chosen over Supabase Edge Functions because this project has no working `supabase db push`/CLI/MCP auth path (every prior migration was hand-pasted into the Supabase Dashboard SQL Editor) — Edge Functions deploy almost exclusively via that same CLI, importing an identical unsolved blocker. The project's Vercel deployment already works end-to-end (`.vercel/project.json` shows it linked, no `vercel.json` needed — zero-config detection picks up `/api/*.js`), so adding this was zero new infrastructure: same deploy pipeline, same env-var mechanism.

The webhook must use the Supabase **service role key** (bypasses RLS) since there's no browser session to anchor RLS to. This means: **RLS on the new tables only protects the web client path.** Every WhatsApp-originated authorization check (is this phone linked, does this TO own this tournament, is the 48h edit window still open, is this edit-code valid) must be written explicitly in the serverless function code — do not assume RLS covers it just because it's declared on the table.

Built: `package.json`, `/api/whatsapp/webhook.js` (Meta's `GET` verification handshake + signed `POST` message handler, raw-body HMAC-SHA256 signature check), `/api/whatsapp/_supabaseAdmin.js`, `/api/whatsapp/_send.js` (text messages — button/list helpers to be added as later phases need them), `/api/whatsapp/flows/link.js` (Phase 0's TO phone-linking conversation).

Still to add per phase: `/api/whatsapp/flows/{ids,register,roster,payments,stats}.js`.

Vercel env vars needed (not yet set — see Open Threads): `SUPABASE_SERVICE_ROLE_KEY`, `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_APP_SECRET`.

## Schema changes

Conventions followed throughout (matching `0001_init_nexusid_schema.sql`): public SELECT + creator-scoped INSERT/UPDATE policies, `revoke update ... / grant update (safe columns only)` lockdowns, soft-delete via nullable `*_at` columns, IDs via `generate_nexus_code(prefix)`.

### Built (Phase 0)

**`0005_whatsapp_phone_linking.sql`** — `nexus_tos.whatsapp_phone_e164` (unique, deliberately **not** added to the client `grant update` list — only the service-role webhook may set it, after code verification, so a TO can't silently hijack another TO's WhatsApp identity by re-linking their number). New table `nexus_wa_link_codes` (`to_id`, `code`, `expires_at`, `consumed_at`) — TO generates a code from the dashboard, sends it via WhatsApp to bind their number.

**`0006_wa_sessions.sql`** — `nexus_wa_sessions` (`phone_e164` PK, `to_id` cached lookup, `state jsonb`, `updated_at`). RLS enabled with zero policies (denies all client access by default); only the service role touches it. Schema-ready ahead of need — Phase 0's link-only flow doesn't need multi-step state yet, but every later phase's menu/state machine will.

**Not yet applied to the live project** — same manual Supabase Dashboard SQL Editor paste as every prior migration.

### Designed, not yet built (Phase 1)

**`0007_tournament_registrations.sql`** — `nexus_tournaments` gains `registration_code` (unique, same generator) and `registrations_open boolean`. New table `nexus_tournament_registrations`:
- `tournament_id`, `team_id`/`guest_team_name` (at most one set), `player_id`/`guest_player_name` for solo entries (exactly one set)
- `edit_code` unique — lets a guest/self-service captain re-enter later and manage their own roster without ever needing a TO login
- `registered_via` (`web`/`whatsapp`)
- `status` — `'approved'` by default for TO-entered/guest registrations, `'pending'` for a captain-initiated self-service request — plus `approved_by_to_id`/`approved_at`
- `registered_by_to_id` — always the tournament's *owning* TO for TO-entered rows (never a new identity type, per decision 3), with the real sender phone kept only as an audit string (`initiated_by_phone`)
- a self-service request instead carries `requested_by_link_id` referencing `nexus_wa_entity_links` (below), and only gets `registered_by_to_id` filled in on approval

New table `nexus_tournament_registration_members` — per-registration roster snapshot, same linked/guest split as above, soft-remove via `removed_at` mirroring `nexus_team_members.left_at`.

RLS scoped to the tournament's creating TO, same shape as `nexus_matches`, plus a narrower policy letting the `requested_by_link_id`'s own phone read (not write) its own pending request's status.

**Note:** `generate_nexus_code`'s uniqueness check is hardcoded to three tables today — extend its `union all` (or add a sibling function) to cover `registration_code`/`edit_code` too.

**`nexus_wa_entity_links`** (part of 0007) — phone↔identity binding for players/teams, separate from TO linking: `phone_e164`, `team_id` nullable, `player_id` nullable (exactly one set per row), `linked_at`. No approval code needed to link — the identity itself is already public/lookup-able (same trust tier as the rest of the product), but this is a deliberate, reversible call: if abuse shows up (e.g. someone linking a rival's `TM-` id to submit bogus requests), add a lightweight confirm-back-to-the-team step before this ships to real users. Multiple phones may link to the same team (a squad often has more than one person who'd message on its behalf); a phone may link to more than one team/player.

**`0008_participations_guest_relaxation.sql`** — the schema change that actually makes guest standings work: `nexus_participations.player_id` becomes nullable, adds `guest_player_name`/`guest_team_name`, replaces the single `(match_id, player_id)` unique constraint with two partial unique indexes (one for real players, one for guests — needed because Postgres treats NULLs as distinct, so nullable `player_id` alone would let unlimited duplicate guest rows into one match). Rewrites `nexus_player_tournament_summary` and `nexus_match_squad_kills` to key off `coalesce(player_id, guest_player_name)` / `coalesce(team_id, guest_team_name)` instead of dropping or silently merging guest rows — without this, guest kills either vanish from the view or collapse into one bucket. `tournament-editor.html`'s existing search-or-create-inline flow gets a third option ("no match — type a guest name") that logs placement/kills the same way, without ever creating a permanent player/team row.

### Designed, not yet built (Phase 3)

**`0009_registration_payment_status.sql`** — `nexus_tournament_registrations` gains `payment_status` (unpaid/partial/paid), `payment_amount`, `payment_note`, `payment_marked_by_to_id`, `payment_marked_at`, with a client update grant scoped to just those columns.

## Conversation design (Phase 1+)

Menu/button-driven, not free-text commands — the audience is grassroots TOs and captains, not developers, and WhatsApp's `interactive` message type (reply buttons, list messages) removes typing for every "which action" decision. Free text is used only where input is inherently open-ended (names, UIDs, kill counts, codes). Every step accepts `0`/`cancel` back to the previous step or root menu. Session state (`{step, data}`) lives in `nexus_wa_sessions`, keyed by phone number.

Root menu adapts to link status: **Register for a tournament** (works unlinked — asks for the tournament's `registration_code`, squad-or-solo, then either an existing `TM-`/`NX-` id or a typed name for guests; ends by reciting the roster + an `edit_code` so a guest captain can self-manage later without ever needing a TO login) · **Check stats** (works unlinked, pure SELECT, safest to build/test first) · **Link my TO account** (unlinked only) · **Link my Team/Player ID** (any captain/player, separate from TO linking — binds `phone_e164` to an existing `TM-`/`NX-` id in `nexus_wa_entity_links`) · **Create Player/Team ID**, **Mark payment status**, **Edit a tournament roster** (linked TO only, or via `edit_code` for captains) · **Approve registrations** (linked TO only).

**Browse & self-service request** (decision 5): once a phone is linked to a team, "Register for a tournament" gains a second path — instead of only entering a known `registration_code`, the captain can search for a TO by name/`TO-` id (reusing `search.html`'s existing TO-lookup query, run server-side) and see that TO's open tournaments (`registrations_open = true`). Picking one, the bot sends back a fixed template rather than asking one field at a time — because the whole point is letting the captain paste what they already have from a WhatsApp group chat in one shot:

```
Reply in this format to register for <tournament name>:
TEAM: <team name>
PLAYERS: <name1>, <name2>, <name3>, <name4>
```

The webhook parses that single message, resolves the sender's linked `team_id` (or accepts a new team name if unlinked — falls back to the guest path), matches each player name against the team's existing roster where possible and otherwise stores it as a plain name pending the TO's review, and inserts a `nexus_tournament_registrations` row with `status = 'pending'`. This is intentionally NOT auto-approved even for a fully-linked, all-recognized-names request — a TO's approval step is the whole safeguard against a rival captain registering a team without the real owner's say-so, and matches how a TO already reviews rosters manually today.

**TO approval**: default to a pull model, not a push notification — "Approve registrations" in the TO's own menu lists pending requests (list message, one per tournament) with buttons `Approve` / `Reject` per row; approving copies the request into real `nexus_tournament_registration_members` rows (creating any brand-new `nexus_players` rows for names the parser couldn't match, same as `register.html`'s manual create-player flow) and flips `status`/`approved_by_to_id`/`approved_at`. A proactive "you have a new request" push to the TO is a valid future enhancement but falls outside the 24h free window unless the TO messaged recently, so it needs a paid template message — call this an explicit stretch item alongside the payment-reminder one, not part of the core flow.

## Phasing

| Phase | Scope | Migrations | Status | Cost note |
|---|---|---|---|---|
| **0 — Infra + phone linking** | Webhook skeleton, signature verification, session store, TO linking flow, "Connect WhatsApp" card on `to-dashboard.html` | 0005, 0006 | **Built 2026-09-27.** Migrations not yet applied; Meta app not yet set up. | Free. Meta Business verification (Udyam route, see Open Threads) is the long-lead item — needed before real (non-test) numbers can use *any* phase, and specifically blocks Phase 1's self-service path. |
| **1 — Registration** | TO-run guest + linked registration (walk-up), per-tournament roster snapshot, guest-aware standings views, and: player/team `nexus_wa_entity_links` linking, browse-a-TO's-open-tournaments, structured-message self-service request, TO pull-based approval queue. Also: surface the full registrations list (guest names included) on `to.html`'s Hosted tab / `tournament-editor.html`, so a TO's own history view never hides guest data | 0007, 0008 | Designed, not built. | Free — approval is pull-based (TO checks their own menu), not a push notification. |
| **2 — Roster edits** | Per-registration roster swap via `edit_code` or linked TO | none | Designed, not built. | Free. |
| **3 — Payments** | Mark/query paid/unpaid/partial per registration | 0009 | Designed, not built. | Reactive replies free; a *proactive* reminder (not replying to an incoming message) would need a paid template message — treat as a stretch item, not core Phase 3. |
| **4 — Stats queries** | Personal/team/player kill-count and standings lookups | none | Designed, not built. | Free. |

## Reuse map

- `js/auth.js`'s `fetchMyToProfile()` pattern → webhook resolves the caller's `nexus_tos` row by `whatsapp_phone_e164` instead of `auth.uid()`.
- `createPlayer`/`createTeam` → mirrored server-side in `flows/ids.js`, same two-insert shape.
- `removeTeamMember`'s `left_at` soft-remove (`0004_team_roster_removal.sql`) → template for `nexus_tournament_registration_members.removed_at`.
- `logParticipations`/`updateParticipations` → extended (not replaced) to accept `guest_player_name`/`guest_team_name`.
- `createTournament`'s best-effort `nexus_activity_log` write → reused when `registrations_open` toggles, finally giving the dormant `registrations_opened`/`registrations_closed` event types real data.
- `to-dashboard.html`'s Quick Actions card layout → pattern for the "Connect WhatsApp" card (built, Phase 0).
- `search.html`'s TO-lookup query → reused server-side for the "browse a TO's open tournaments" flow.
- `register.html`'s manual create-player pattern → reused inside TO approval, for any name in a self-service request that doesn't match an existing roster member.
- `to.html`'s existing Hosted-tab tournament cards (day/squad/match counts from `nexus_matches`/`nexus_participations`) → gains a registrations sub-list (status, guest vs. linked, pending-approval count) so a TO's own history view always shows the full picture regardless of how a registration arrived.

## Critical files

- `js/auth.js` — every new mutation mirrors this module's insert/RLS patterns. Gained `generateWaLinkCode`/`fetchMyWaLinkStatus` in Phase 0.
- `tournament-editor.html` — will gain the guest-name fallback in its existing search-or-create UI, plus a pending-registrations approval view (Phase 1).
- `to.html` — Hosted tab will gain the registrations sub-list (including guest/pending entries) so nothing about a tournament's real roster stays invisible to its own TO (Phase 1).
- `supabase/migrations/0001_init_nexusid_schema.sql` — source of truth for every convention the new migrations must follow.
- `to-dashboard.html` — gained the "Connect WhatsApp" linking card (Phase 0).
- Built: `package.json`, `api/whatsapp/webhook.js`, `_supabaseAdmin.js`, `_send.js`, `flows/link.js`, `supabase/migrations/0005`, `0006`.
- To build: `api/whatsapp/flows/{ids,register,roster,payments,stats}.js`, `supabase/migrations/0007`–`0009`.

## Verification

- Migrations: apply each via the Supabase Dashboard SQL Editor (same manual path as 0001–0006) against the live project; confirm via a quick `select` that RLS policies behave as expected for an `anon` vs `authenticated` role.
- Webhook: Meta's Cloud API dashboard provides a built-in test console and up to 5 verified test numbers — use these to walk every flow (link → create ID → register with existing ID → register as guest → edit roster via edit_code → mark payment → check stats) before requesting business verification for real numbers.
- End-to-end: after Phase 1 ships, log a guest team's match result through `tournament-editor.html` and confirm their kills/placement actually appear via the Phase 4 stats query and in the tournament's own standings — this is the specific gap the guest-relaxation migration exists to close.
