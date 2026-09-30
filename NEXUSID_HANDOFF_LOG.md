# NEXUSID — HANDOFF & LOG

**Companion file to `NEXUSID_ROADMAP_v1.md`. Read the roadmap for scope/mission. Read THIS file for state — what actually happened, what was decided, what changed, and what to watch for.**

This file exists to stop drift. The roadmap says what NexusID *is*. This file tracks what has *actually been built, decided, and changed* — so a new session doesn't re-derive, contradict, or silently override prior ground truth.

**Rule for every future session:** before writing code or giving advice, read the roadmap AND the most recent 2–3 entries in every section below. At the end of any session that changes scope, schema, decisions, or naming — update the relevant section(s). No exceptions, even for small changes.

---

## 1. Session Log

One entry per work session. Newest on top. This is the "what happened" ledger — chronological, factual, no editorializing.

```
### Session — [YYYY-MM-DD]
**Duration/scope:** [what was worked on]
**Files touched:** [list]
**What was done:**
- ...
**What was NOT finished / left mid-flight:**
- ...
**Anything the next session needs to know before continuing:**
- ...
```

<!-- TEMPLATE ABOVE — ADD NEW ENTRIES BELOW, NEWEST FIRST -->

### Session — 2026-09-30 (cont. 2) — Bot live; step 2 built: Find a TO → apply → approve
**Duration/scope:** Took Moti through custom SMTP, bot creation (@Motisoft_NexusID_bot), Vercel env vars and setWebhook; found the real production domain is `nexus-id-omega.vercel.app`. Live-tested Become a TO → set password → dashboard login. Then built step 2 (plan Phase 1, part 1).
**Files touched:** `supabase/migrations/0008_tournament_registrations.sql` (new), `api/telegram/_apply.js`, `_tournaments.js`, `_registrations.js` (new), `api/registrations/decide.js` (new), `api/telegram/_router.js`, `js/auth.js`, `tournament-editor.html`, `tournament-new.html`, `to-login.html` (signup code box, earlier), plan doc.
**What was done:**
- Everything in the plan doc's "Built (Phase 1, part 1)". Simulated the whole flow against an in-memory fake of supabase-js (scratch only): create → open → find → apply (bad lines, wrong count, duplicate UID, duplicate team name all rejected) → TO push → approve → second decision blocked → web reject via the API (non-member refused) → UIDs freed → close hides the tournament.
**What was NOT finished / left mid-flight:**
- ~~`0008` not applied; code not pushed~~ — **Moti applied `0008` the same day, then `9c1b629` was pushed.** (Pushing first would have broken `tournament-new.html`/`tournament-editor.html` (they read/write `team_size`/`registrations_open`) and the bot.)
- Not built from Phase 1: guest results logging (`0009` participations relaxation), team captains (decision 8), per-member action attribution, `registration_code`. Standings/scores for applicants (step 3).
**Anything the next session needs to know before continuing:**
- Deploy order: Moti pastes `0008`, then push.
- Step 3 = results + standings: `0009` (guest participations keyed by UID), log results for registered teams in the editor/bot, "My registrations" → placement + kills (decision 11: no points).


### Session — 2026-09-30 (cont.) — Phase 0.5 built: TO accounts on Telegram, shared members, invites
**Duration/scope:** Pushed the Telegram conversion, then built Phase 0.5 per decisions 6–7 in `NEXUSID_TELEGRAM_INTEGRATION_PLAN.md`. Moti also asked how Supabase verification works and what TO registration data is collected, from whom.
**Files touched:** `supabase/migrations/0007_to_members.sql` (new), `api/telegram/_router.js`, `_account.js`, `_members.js`, `_session.js` (new), `api/telegram/webhook.js`, `_link.js`, `_send.js`, `_supabaseAdmin.js`, `js/auth.js`, `to-dashboard.html`, `to-login.html`, `to-onboarding.html`, `join.html` (new), `set-password.html` (new), `NEXUSID_TELEGRAM_INTEGRATION_PLAN.md`.
**What was done:**
- Bot: menu with buttons; "Become a TO" (email → emailed code → org name, IGN, UID, optional real name → TO ID + one-time "set website password" link); "I already have a TO account" (email code → reconnects this Telegram, or finishes TO registration for a web login that never onboarded); owner "Invite a member" (Telegram + web links); invite acceptance on the bot (email code → name → admin); Members list; "Website login" (fresh set-password link).
- Web: Members card on the dashboard (owner invites/removes), `join.html`, `set-password.html`; login/onboarding route invited users to `join.html`.
- Simulated every bot flow against an in-memory fake of supabase-js (scratch only, not committed). Caught one real bug: a 10-digit BGMI UID typed during signup matched the Telegram link-code pattern and hijacked the flow — fixed (bare codes only count when no flow is in progress).
**What was NOT finished / left mid-flight:**
- ~~Migrations 0005–0007 not applied~~ — Moti applied all three the same day, then the code was pushed (`5686923`). Bot not created. Nothing live-tested.
- Team captains (decision 8) moved into Phase 1. Per-member action attribution (decision 6) not built.
**Anything the next session needs to know before continuing:**
- **Deploy order matters:** after this commit, `fetchMyToProfile()` reads `nexus_to_members`. If the site deploys before `0007` is pasted, every TO page breaks. Paste 0005 → 0006 → 0007 first, then push.
- **Email delivery is a blocker for real TO signups on the bot *and* the website** — see the new Open Threads item. Found this session: Supabase's default sender only emails the project's own team members, 2/hour.
- Logging in with an existing TO email from a different Telegram account moves the Telegram link to the new account (proving the email is the authority). Intentional — covers a new phone.


### Session — 2026-09-30 — Bot channel switched from WhatsApp to Telegram; Phase 0 rebuilt
**Duration/scope:** Moti asked whether the bot could use Telegram instead of WhatsApp. Compared the two (main driver: WhatsApp's 5-test-number cap without Meta Business Verification, which needed Udyam Registration first), Moti approved the switch, and Phase 0 was rebuilt for Telegram. Rationale in Section 2 (2026-09-30).
**Files touched:** `api/whatsapp/` (deleted), `api/telegram/webhook.js`, `_send.js`, `_supabaseAdmin.js`, `_link.js` (new), `supabase/migrations/0005_whatsapp_phone_linking.sql` + `0006_wa_sessions.sql` (deleted from the repo — but see correction below: they *had* been applied live), `supabase/migrations/0005_telegram_to_linking.sql` + `0006_bot_sessions.sql` (new), `js/auth.js`, `to-dashboard.html`, `NEXUSID_WHATSAPP_INTEGRATION_PLAN.md` → renamed `NEXUSID_TELEGRAM_INTEGRATION_PLAN.md` and rewritten.
**What was done:**
- `0005_telegram_to_linking.sql`: TO↔Telegram link lives in its own table `nexus_to_telegram_links` (owner-only SELECT, zero client writes), **not** a column on `nexus_tos` — `nexus_tos` is publicly SELECTable to `anon`, so the old `whatsapp_phone_e164` column design would have published every linked TO's phone number (also a Section 5 guardrail miss: "phone numbers stored unhashed"). `nexus_bot_link_codes` replaces `nexus_wa_link_codes`: 10 hex-char codes instead of 6 digits (anyone can message a Telegram bot, so a 6-digit code was brute-forceable inside its 15-min window), and clients can insert only `to_id` (column-level insert grant) so a TO can't pick their own code or expiry.
- `0006_bot_sessions.sql`: `nexus_bot_sessions` keyed by `(channel, external_user_id)` so a WhatsApp channel could be added later without a second table.
- `api/telegram/webhook.js`: verifies Telegram's `X-Telegram-Bot-Api-Secret-Token` header (timing-safe), ignores everything but private-chat text messages, acks 200 only after processing. `_link.js` accepts a bare code or the deep-link form `/start <code>`, consumes the code with a conditional update (can't be redeemed twice), then upserts the link (a TO re-linking from a new Telegram account replaces the old link). Flow takes a `reply` callback instead of importing the Telegram send function directly.
- `to-dashboard.html`: "Connect Telegram" card — shows an "Open Telegram" one-tap deep link (`t.me/<bot>?start=<code>`) plus the code for manual entry; once linked, a "Telegram Connected · Linked on <date>" card.
- Plan doc: all channel-specific details swapped (Phase 1's `nexus_wa_entity_links` → `nexus_bot_entity_links` keyed by `telegram_user_id`; `registered_via` values `web`/`telegram`; proactive pushes/reminders now free). One small Phase 1 correction: the "captain can read their own pending request via RLS" policy was dropped — captains have no web login, so they check status through the bot (service role).
**What was NOT finished / left mid-flight:**
- Migrations `0005`/`0006` not applied (manual Dashboard SQL Editor paste, as always).
- **Correction (same session):** Moti had already pasted the old WhatsApp `0005`/`0006` into the live project (twice — the second run just errored on "already exists"), contrary to the earlier "not yet applied" notes. So the live DB currently has `nexus_tos.whatsapp_phone_e164`, `nexus_wa_link_codes`, `generate_wa_link_code()`, `nexus_wa_sessions`. The new `0005_telegram_to_linking.sql` now starts with a section 0 that drops all four (`if exists`, so safe on a fresh DB) — pasting the new `0005` then `0006` cleans up and sets up Telegram in one go. Dropping `whatsapp_phone_e164` also closes the public-phone-number exposure on the live project.
- Bot not yet created via @BotFather; `TELEGRAM_BOT_TOKEN`/`TELEGRAM_WEBHOOK_SECRET`/`SUPABASE_SERVICE_ROLE_KEY` not set in Vercel; `setWebhook` not run; `TELEGRAM_BOT_USERNAME` in `js/auth.js` is the placeholder `NexusIDBot`. Steps are in the plan doc's "One-time bot setup".
- Nothing live-tested (can't be until the above is done).
**Anything the next session needs to know before continuing:**
- The Udyam Registration item in Section 6 is **no longer a blocker** for the bot — only relevant if WhatsApp is ever added back.
- Vercel Deployment Protection (Section 6) would also block Telegram's webhook calls — must be off for Production before the bot can work.


### Session — 2026-09-27 — WhatsApp integration: full plan agreed, Phase 0 (infra + TO phone linking) built
**Duration/scope:** Moti asked for a WhatsApp-based path into NexusID — teams/TOs registering, editing rosters, tracking payment status, and checking standings by messaging a bot, including tournament entry for teams/players with no existing Nexus ID at all. Worked through the tradeoffs (official Meta Cloud API vs. unofficial libraries vs. paid BSPs; whether "payment tracking" could mean real money movement; how a WhatsApp message proves it's acting as a given TO; what "no history tracked" for guest entries actually means for the results/standings ledger) before writing anything, then built the first phase end-to-end. Full rationale for every decision below lives in Section 2; this entry is the "what got built" record.
**Files touched:** `package.json` (new — first in this repo), `supabase/migrations/0005_whatsapp_phone_linking.sql` (new), `supabase/migrations/0006_wa_sessions.sql` (new), `api/whatsapp/webhook.js` (new), `api/whatsapp/_supabaseAdmin.js` (new), `api/whatsapp/_send.js` (new), `api/whatsapp/flows/link.js` (new), `js/auth.js`, `to-dashboard.html`.
**What was done:**
- Chose Vercel serverless functions under `/api` over Supabase Edge Functions — this project has no working `supabase db push`/CLI/MCP auth path (every migration so far was hand-pasted into the Dashboard SQL Editor), and Edge Functions deploy almost exclusively via that same CLI, so it would import an identical unsolved blocker. The Vercel project is already linked (`.vercel/project.json`) and has no `vercel.json`, so `/api/*.js` is picked up by zero-config detection alongside the existing static pages — confirmed no build config changes were needed.
- `0005_whatsapp_phone_linking.sql` (**not yet applied** — needs the same manual Dashboard SQL Editor paste as every prior migration): adds `nexus_tos.whatsapp_phone_e164` (unique, deliberately excluded from the existing client `grant update (...)` list from `0001` §14 — only the service-role webhook may ever set it, after code verification, so a TO can't hijack another TO's WhatsApp identity by re-linking their number) and `nexus_wa_link_codes` (short-lived 6-digit codes, `generate_wa_link_code()` collision-checked against the table's full history since the column has a hard `unique` constraint, not just against currently-active codes).
- `0006_wa_sessions.sql` (**not yet applied**): adds `nexus_wa_sessions` (phone-keyed conversation state, RLS-enabled with zero policies so only the service role can touch it). Deliberately schema-ready-but-unused this phase, same pattern as `nexus_activity_log`'s still-dormant event types (`0003`) — Phase 0's link-only flow is a single-message action with no multi-step state yet; later phases' menu/state machine will actually read/write this table.
- `js/auth.js` gained `generateWaLinkCode()` (mirrors the existing `fetchMyToProfile`-then-insert pattern) and `fetchMyWaLinkStatus()`.
- `to-dashboard.html` gained a "Connect WhatsApp" quick-action card: click → generates a code via `generateWaLinkCode()` → displays it with a 15-minute expiry note; once linked, that card is replaced by a read-only "WhatsApp Connected: `<number>`" card instead (checked via `fetchMyWaLinkStatus()` on page load).
- `api/whatsapp/webhook.js`: handles Meta's `GET` verification handshake (`hub.mode`/`hub.verify_token`/`hub.challenge`) and the signed `POST` message webhook. Body parsing is disabled (`config.api.bodyParser = false`) so the raw bytes are available for HMAC-SHA256 signature verification against `WHATSAPP_APP_SECRET` (a parsed-then-restringified body isn't guaranteed to match the original bytes) — verified with `crypto.timingSafeEqual`, not a plain string comparison. Processes the message (currently just delegates to `flows/link.js`) and only acks 200 to Meta after that finishes, not before, since Meta retries aggressively on non-200s.
- `api/whatsapp/flows/link.js` is Phase 0's entire conversation: if the sender's number is already in `nexus_tos.whatsapp_phone_e164`, reply with a "connected as `<org>` (`<TO->`)" status line; otherwise, if the message is a bare 6-digit code, look it up in `nexus_wa_link_codes` (must be unexpired and unconsumed), set the phone column, mark the code consumed, and confirm — else prompt them to generate a code from the dashboard first.
**What was NOT finished / left mid-flight:**
- `0005`/`0006` are written but **not applied** to the live project — same manual-paste requirement as every prior migration. `to-dashboard.html`'s Connect WhatsApp card and the webhook will error against `nexus_tos.whatsapp_phone_e164`/`nexus_wa_link_codes` until this is done.
- The actual Meta WhatsApp Business setup (Meta Business account, app, phone number, business verification) has not been started — this is external, account-level work outside this codebase. Until it exists, none of `WHATSAPP_TOKEN`/`WHATSAPP_PHONE_NUMBER_ID`/`WHATSAPP_VERIFY_TOKEN`/`WHATSAPP_APP_SECRET`/`SUPABASE_SERVICE_ROLE_KEY` are set in Vercel, and the webhook can't go live.
- **Real blocker surfaced, not yet resolved: Moti has no registered business (no GST/incorporation).** Meta's WhatsApp Cloud API only lets an unverified app message up to 5 manually-added test phone numbers — any other real player/TO literally cannot reach the bot. Since the whole point of Phase 1's decision 5 (players messaging a TO to self-register) is strangers being able to message in, this is a real blocker for that specific feature, not just a formality — test mode alone cannot deliver it. The unblock path costs nothing and needs no company: **Udyam Registration** (udyamregistration.gov.in), India's free ~10-15 minute sole-proprietorship registration using Aadhaar + PAN, which produces a Udyam Certificate Meta's Business Verification can accept as proof of business. Full step-by-step walked through with Moti this session (see Open Threads, Section 6) — Moti could not do it in-session ("too late... cannot literally do the steps rn"), so this is carried forward, not completed.
- Not live-tested at all (no Meta app to test against yet) — verified only via `node --check` on every new file and a local static-server 200 check on `to-dashboard.html`.
- The dashboard's "Connect WhatsApp" panel hardcodes no actual bot phone number in its instructions (there isn't one yet) — revisit the copy once a real WhatsApp Business number exists.
- Phases 1–4 (registration incl. guest entries + self-service captain requests, roster edits, payments, stats queries) are fully designed (see `NEXUSID_WHATSAPP_INTEGRATION_PLAN.md`, added to this repo the same day) but not built.
**Anything the next session needs to know before continuing:**
- Before writing any Phase 1+ code: apply `0005`/`0006`, get the Meta developer app + test number set up, and set the five new env vars in Vercel — none of Phase 0 can be exercised end-to-end until then.
- The full phased plan (schema for `nexus_tournament_registrations`/`nexus_tournament_registration_members`/`nexus_wa_entity_links`, the `nexus_participations` guest-relaxation migration, conversation design, approval workflow) is written out in detail in `NEXUSID_WHATSAPP_INTEGRATION_PLAN.md` and was approved by Moti — read it before redesigning any of this from scratch. (It originated in a Claude Code planning-tool file outside this repo; that file is no longer the source of truth — this repo copy is.)
- **Udyam Registration is a real prerequisite for shipping decision 5's self-service player→TO registration flow to real users**, not an optional nice-to-have — see the Open Threads item (Section 6) for the exact steps. Development/testing against the 5-number sandbox can continue regardless (covers everything except "an arbitrary stranger can message the bot"), but don't promise Moti that flow works for real players until this is done and Meta's Business Verification is completed on top of it.

### Session — 2026-09-16 (cont. 3) — Team roster management + tournament editor (matches & results) built; closes two long-standing open threads
**Duration/scope:** Moti asked for "all the required pages" — clarified down to two concrete gaps: linking an existing player into an existing team (no UI existed for `nexus_team_members` at all), and a real tournament editor (matches + per-match results), since `tournament-new.html` only ever created the tournament shell. Reviewed `06-nexusid-tournament-editor.html` and `05-nexusid-player-registration.html` for inspiration first — neither maps onto our schema (06 uses a flat "Score" with no match/kills concept; 05 always creates a new team inline rather than linking to an existing one) — so this was built fresh against real schema, borrowing only the interaction patterns (search-to-add, card-based entry, draft/publish status).
**Files touched:** `supabase/migrations/0004_team_roster_removal.sql` (new), `js/auth.js`, `team-roster.html` (new), `tournament-editor.html` (new), `team.html`, `to.html`, `tournament-new.html`.
**What was done:**
- Three scope calls made before building (see Decision Log): (1) squad-based batch result entry — pick a team, its active roster auto-loads, one placement for the whole squad + a kills value per member, one submit inserts a `nexus_participations` row per player; (2) no explicit tournament-squad pre-registration table — a team's presence in a tournament is implied by the first logged match result for them; (3) soft-remove for team members via a new UPDATE RLS policy (sets `left_at`) instead of the existing hard-DELETE-only policy, since `team.html`'s History tab (built earlier this session) already reads `left_at` to render "left" events and had no real path to ever get one.
- Migration `0004_team_roster_removal.sql` — **applied 2026-09-16** to the live project (`jzqmscrmeywckzodgjre`), pasted and run by Moti directly in the Supabase Dashboard SQL Editor (same route as `0002`/`0003`; hit a transient "Failed to fetch (api.supabase.com)" error on the first attempt, resolved on retry): adds `nexus_team_members_update_team_creator_only` (same `exists()` shape as the table's existing delete policy) plus the column-lockdown pattern every other table in `0001` already uses (`revoke update ... ; grant update (left_at) ...`) — only `left_at` becomes settable, `joined_at`/`player_id`/`team_id`/`added_by_to_id` stay locked.
- `js/auth.js` gained six functions: `addTeamMember`, `removeTeamMember` (soft-remove), `createMatch`, `updateTournamentStatus`, `logParticipations` (one multi-row INSERT per squad, atomic since it's a single Postgres statement), `updateParticipations` (edits placement/kills within the 48h window).
- Built `team-roster.html` (new, TO-only): active roster list with Remove buttons (visible only to the team's own creator, matching RLS), a debounced player search to add existing players (any TO can add, per the existing 2026-09-05 cross-TO roster decision), and an inline "+ Create New Player" fallback reusing `createPlayer` when a search finds nobody — avoids forcing a detour through `register.html`.
- Built `tournament-editor.html` (new, TO-only, owner-checked against `created_by_to_id` beyond just RLS for UX): a status control (draft/active/concluded, using the `nexus_tournaments.status` column that's existed since `0001` but nothing ever updated — this is also what will finally move `to.html`'s status badge off "DRAFT"); a "+ New Match" form; and, per match, expandable logged-squad/solo results with a "+ Log Squad Result" flow (search-existing-team-or-create-inline via `createTeam`, auto-loads the team's active roster, one placement + per-member kills, edit-in-place within the 48h window) and a simpler "+ Log Solo Result" for `team_id: null` entries.
- Wired entry points: `team.html` gained a "Manage Roster →" link next to its Roster/History tabs; `to.html`'s Hosted tournament cards gained a "Manage Matches & Results" link; `tournament-new.html`'s success modal now links straight into the new tournament's editor (using the `id` the insert already returned) instead of just "Create Another"/"Back to Dashboard", and its footer copy was corrected (previously said roster/result logging was "separate follow-up work" — it now exists).
**What was NOT finished / left mid-flight:**
- Migration `0004` is **written but not applied** — needs the same manual Supabase Dashboard SQL Editor paste as `0002`/`0003`. Until then, attempting to remove a team member will fail (no matching UPDATE policy yet).
- Not live-browser-tested — no real teams/tournaments/matches exist in the live project yet to exercise the squad-result batch-entry flow, the 48h edit-window UI logic, or the champion/stats numbers this now actually feeds on `to.html`/`team.html`.
- `tournament-editor.html`'s "Champion" heuristic on `to.html` (documented 2026-09-16 as a heuristic, not a verified result) will now actually have real match data to compute from once results are logged — worth a second look once that happens, to see if the last-match-winner heuristic holds up against real usage.
**Anything the next session needs to know before continuing:**
- `0004_team_roster_removal.sql` is confirmed applied — `nexus_team_members` UPDATEs (roster removal) are safe against the live DB now.
- `tournament-editor.html` re-renders its entire matches list on every state change (toggle, form open/close, submit) rather than doing targeted DOM patches — deliberate simplicity given how much interactive state one match card can hold (open/closed, active add-form, which team's roster is loaded), consistent with how `search.html`/`player.html`/`team.html`/`to.html` already re-render their content areas wholesale rather than diffing.

### Session — 2026-09-16 (cont. 2) — Squad Profile and TO Profile rebuilt from Claude Design handoffs; prize pool + activity-log schema additions
**Duration/scope:** Moti shared two more Claude Design handoffs (`NexusID Squad Profile.dc.html`, `NexusID TO Profile.dc.html`) as the intended replacements for `team.html`/`to.html` — same process as the player profile rebuild: compared both mockups against the live schema before building, since both invent fields the schema has no room for (neither `nexus_teams` nor `nexus_tos` has a `claimed` concept at all, unlike players).
**Files touched:** `supabase/migrations/0003_squad_to_profile_additions.sql` (new), `js/auth.js`, `tournament-new.html`, `team.html` (rebuilt), `to.html` (rebuilt).
**What was done:**
- Four scope calls made before building (see Decision Log): (1) drop the claimed/unclaimed badge and claim CTA entirely on both pages — neither table has a claimed column, and the mockups' claim buttons would be dead links same as the player page's deferred one; (2) drop the Squad mockup's "tag" (short team abbreviation) and per-roster-member "IGL" badge — neither exists in the schema, not added; (3) drop the TO mockup's "orgType" line — `organisation_name` already covers it; (4) **add real schema support** for the TO mockup's Activity tab and Hosted-tournament Champion/Prize Pool fields, rather than dropping or faking them.
- Migration `0003_squad_to_profile_additions.sql` — **applied 2026-09-16** to the live project (`jzqmscrmeywckzodgjre`), pasted and run by Moti directly in the Supabase Dashboard SQL Editor (same route as `0002` — no working `supabase db push`/CLI or MCP auth in this environment): adds `nexus_tournaments.prize_pool` (nullable numeric, INR assumed — no currency column, matches this product's India-only scope) and a new `nexus_activity_log` table (`to_id`, `tournament_id` nullable, `event_type` check-constrained to 4 values, `detail`, `created_at`) with public-select / insert-own-only RLS, same pattern as every other TO-owned table.
- `createTournament` in `js/auth.js` now accepts `prize_pool` and, after successfully inserting the tournament, writes a best-effort `nexus_activity_log` row (`event_type: 'tournament_created'`) — wrapped so a logging failure can't roll back or surface as a tournament-creation error. **Only `tournament_created` is ever actually emitted anywhere in the app right now** — the other three `event_type` values (`registrations_opened`, `registrations_closed`, `results_published`) are schema-ready but have no UI feature driving them yet (there's no registration-open/close or result-publishing flow built at all), so the Activity tab will read sparse until those features exist. `tournament-new.html` gained a matching optional Prize Pool (₹) input next to Max Players.
- Rebuilt `team.html`: same canonical token block as `player.html`/`search.html`, added the back-arrow header they already have. Identity card shows `team_name` + `tm_id` (no tag, no claim badge), a 4-stat row (Matches/Avg Place/Total Kills/Win Rate computed from the team's deduped match participations), a Roster/History tab pair, and the same per-tournament/day/match expandable history pattern as `player.html` but scoped to the team (squad kills from the existing `nexus_match_squad_kills` view, deduped by match since up to 4 teammates share a participations row per match). The History tab is a real feature, not a placeholder: it's built entirely from existing `nexus_team_members.joined_at`/`left_at` data (no schema change) — reconstructs a join/left/rejoined timeline per player by walking each player's membership rows in order and labeling a second-or-later join as "rejoined."
- Rebuilt `to.html`: same token block + back-arrow header. Identity card shows `organisation_name`, `to_ign`, `to_id`, optional `to_real_name` — no handle, no orgType, no claim badge. 4-stat row (Tournaments/Total Matches/Avg Squads/Total Squads). Hosted/Activity tabs: Hosted lists the TO's tournaments as expandable cards (real `status` column instead of the mockup's fictional "Completed" label, real `stage` pill, day/squad/match counts derived from `nexus_matches`/`nexus_participations`, and an expandable panel with Maps, Prize Pool when set, and a **Champion field that is a documented heuristic, not a verified result** — the team placing #1 in the tournament's chronologically last match, since the schema has no final-standings concept, same limitation `nexus_player_tournament_summary`'s own comment already flags for rank/points). Activity lists `nexus_activity_log` rows with an icon/color/tag lookup covering all 4 event types even though only one is currently ever written.
**What was NOT finished / left mid-flight:**
- Migration `0003` is **written but not applied** — needs the same manual Supabase Dashboard SQL Editor paste as `0002` (no working `supabase db push`/CLI or MCP auth path in this environment). `team.html`'s stats/history and `to.html`'s prize pool/activity feed will silently read as empty until this is applied.
- Not live-browser-tested; no real multi-squad tournament data exists yet to sanity-check the champion heuristic, squad-count dedup, or activity feed against.
- The Activity tab will look sparse in practice (only "Created tournament" events) until registration-open/close and results-published features are actually built and instrumented to write to `nexus_activity_log` — this was a known, accepted tradeoff of choosing the "full schema support" option, not an oversight.
**Anything the next session needs to know before continuing:**
- `0003_squad_to_profile_additions.sql` is confirmed applied (Moti ran it directly in the Dashboard SQL Editor) — `nexus_tournaments.prize_pool` and `nexus_activity_log` are safe to read/write against the live DB now.
- If a future session adds registration-open/close or result-publishing UI, wire it to insert into `nexus_activity_log` with the matching `event_type` — the schema and `to.html`'s rendering already support it, only the writer side is missing.

### Session — 2026-09-16 (cont.) — Player profile page rebuilt from Claude Design handoff; tournament `stage` + squad-kills schema additions
**Duration/scope:** Moti shared a new Claude Design handoff (`NexusID Player Profile.dc.html`) as the intended replacement for `player.html`'s search-result page. Talked through 4 real mismatches between the mockup and the live schema/product decisions before building (see Decision Log), then rebuilt the page.
**Files touched:** `supabase/migrations/0002_player_profile_additions.sql` (new), `js/auth.js`, `tournament-new.html`, `player.html` (rebuilt).
**What was done:**
- Migration `0002_player_profile_additions.sql` — **applied 2026-09-16** to the live project (`jzqmscrmeywckzodgjre`), pasted and run by Moti directly in the Supabase Dashboard SQL Editor (not `supabase db push` — no Supabase CLI available in this environment; MCP-based Supabase auth also failed with an "Unrecognized client_id" OAuth error, filed as product feedback, not fixed here). Adds `nexus_tournaments.stage` (nullable free text, same convention as the existing `format` column) and a new view `nexus_match_squad_kills` (`match_id, team_id, squad_kills` = `sum(kills)` from `nexus_participations` grouped by match+team) — needed because "squad kills" isn't a stored column, it's teammates' kills summed for the same match. No new RLS policies needed; both build on tables/columns that already have public-select policies.
- `createTournament` in `js/auth.js` now accepts and inserts `stage`. `tournament-new.html` gained a matching optional "Stage" text input next to Format.
- Rebuilt `player.html` fully: moved off the old Tailwind-CDN/hardcoded-hex pattern onto the same hand-rolled canonical CSS-custom-property token block `search.html` uses (this repo's established way of following the design system without literally importing its CSS files), extended with three tokens the mockup needed that weren't defined yet — `--bg-panel` (`#E8E1D5`), `--olive` (`#4E7C2F`), `--radius-sm` (`2px`), pulled from the actual `metazone-design` skill token files, not guessed. `player.html` is now on canonical tokens (join `index.html`/`to-login.html`/`to-onboarding.html`/`search.html`).
- Identity card: `nx_id`, claimed/unclaimed badge (olive shield-check vs. red dot), most-recently-created game account's IGN+UID with a "+N more" note when the player has more than one (players can have several cross-game accounts by design), and most-recent active team membership with the same "+N more" pattern (team membership is many-to-many by design, so this picks one rather than showing all). **No "Claim This Profile" CTA** — deliberately kept out, matching the existing 2026-09-05 decision that an actionable claim button would be a dead end until the OTP claim flow exists.
- New 4-stat row (Matches / Avg Place / Total Kills / Win Rate) computed client-side from the player's full participation list — no new query needed beyond what tournament history already fetches.
- Tournament history rebuilt as expandable cards (plain click-to-toggle JS, no framework — the mockup used the Design Canvas `x-dc`/`sc-if`/`sc-for` runtime, which isn't part of this static-HTML app, so the interactivity was reimplemented in vanilla JS): groups the player's `nexus_participations` by tournament (via `nexus_matches.tournament_id`), then by day (bucketed from `nexus_matches.played_at`, with a single "Unscheduled" bucket for matches with no date), showing per-match map, placement, kills, and squad kills (from the new view) with a BGMI map-image background per match (`assets/maps/{erangel,miramar,sanhok,rondo}_mid.jpg` — extended the mockup's own `mapImage()` helper, which only handled 3 of the 4 available maps). Replaced `nexus_player_tournament_summary` with this richer per-match query as the page's real data source — the older summary view still exists and is still used nowhere else, not removed.
**What was NOT finished / left mid-flight:**
- Not live-browser-tested, and there's no real tournament/match data in the live project yet to sanity-check the day/match grouping or squad-kills numbers against — verified only via local static-server 200s and a manual JS-syntax check. (Migration itself is applied — see update below — this gap is about exercising the page against real rows, not schema.)
- `to.html`/`team.html` (built earlier this session) are still on the old Tailwind/hardcoded-hex pattern, not moved onto these tokens — see the retrofit backlog note in Open Threads.
**Anything the next session needs to know before continuing:**
- `0002_player_profile_additions.sql` is confirmed applied (Moti ran it directly in the Dashboard SQL Editor) — `nexus_tournaments.stage` and `nexus_match_squad_kills` are safe to read/write against the live DB now. This repo still has no working `supabase db push`/CLI path in this environment, so future schema changes will likely need the same manual-paste route unless the CLI gets installed or the MCP OAuth bug gets fixed upstream.
- If TOs start setting `stage` via `tournament-new.html`, existing tournaments created before this migration will have `stage = null` — the profile page already handles that (only renders the stage pill when present).

### Session — 2026-09-16 — Search extended to cover TOs and teams; new `to.html`/`team.html` public profile pages
**Duration/scope:** Moti asked for the search page to cover "any id," not just players — closed the gap flagged since 2026-09-05 (Open Threads item on TO/team search coverage).
**Files touched:** `search.html` (rewritten query/render logic), `to.html` (new), `team.html` (new).
**What was done:**
- Confirmed `nexus_tos` and `nexus_teams` both already have public-select RLS policies (`nexus_tos_select_public`, `nexus_teams_select_public` in the 0001 migration) — no schema/RLS change needed, this was purely a frontend gap.
- Built `to.html` (new): public TO profile — `to_id`, `organisation_name`, `to_ign`, optional `to_real_name`, registered date, and the list of tournaments that TO created (`nexus_tournaments` where `created_by_to_id` matches). Modeled directly on `player.html`'s structure/style (Tailwind CDN + hardcoded hex), not yet on the canonical CSS-custom-property tokens — same non-conformant pattern as `player.html`, `to-dashboard.html`, `register.html`, `tournament-new.html`.
- Built `team.html` (new): public team profile — `tm_id`, `team_name`, registered date, and active roster (`nexus_team_members` joined to `nexus_players`, filtered to `left_at is null`), each member linking through to their `player.html`. Same styling pattern as `to.html`/`player.html`.
- Rewrote `search.html`'s query/render logic: now queries `nexus_players` (by `nx_id`), `nexus_player_game_accounts` (by IGN), `nexus_tos` (by `to_id`/`to_ign`/`organisation_name` via `.or()`), and `nexus_teams` (by `tm_id`/`team_name` via `.or()`) in parallel, merges into one typed result list, and routes each result card to `/player.html`, `/to.html`, or `/team.html` based on type. Player cards keep the red-dot "Unclaimed" indicator; TO/team cards show a type badge (Organizer/Team) instead since claim status doesn't apply to them. Updated the header subtext and input placeholder to reflect all three ID types.
**What was NOT finished / left mid-flight:**
- Not live-browser-tested (still no live Supabase data for TOs/teams to search against beyond whatever Moti has created manually; Chrome automation not exercised this session).
- `to.html`/`team.html` follow `player.html`'s old Tailwind-CDN/hardcoded-hex pattern, not the canonical design-system tokens `search.html` itself uses — adds two more pages to the non-conformant retrofit backlog rather than shrinking it.
- The `.or()` filter strings interpolate the raw search query with no escaping — a query containing a comma will break the PostgREST filter syntax for the TO/team branches specifically (silently falls back to 0 results from those two, not a crash, since the overall error check only fires if all four queries fail). Pre-existing `ilike` calls have the same raw-interpolation pattern, so this matches existing code, but flagging it since it's newly exercised by two more queries.
**Anything the next session needs to know before continuing:**
- TO/team search coverage (2026-09-05 Open Threads item) is now closed — remove it from Section 6 once confirmed live.
- If retrofitting the remaining non-conformant pages, `to.html` and `team.html` need to be included in that pass alongside `player.html`, `to-dashboard.html`, `register.html`, `tournament-new.html`.

### Session — 2026-09-06 (cont. 4) — Onboarding and search pages reworked onto canonical tokens
**Duration/scope:** Two more Claude Design handoffs (`NexusID TO Onboarding.dc.html`, `NexusID Search.dc.html`) — straight visual reworks of two existing pages, no new fields or backend logic.
**Files touched:** `to-onboarding.html` (rebuilt), `search.html` (rebuilt).
**What was done:**
- `to-onboarding.html`: same three Organiser Information fields (IGN, UID, real name) plus Organisation Name, same `createToProfile` call, same success-modal-with-generated-TO-ID pattern. Added a bottom border under the header and a "One-Time Setup" eyebrow label. Rebuilt on the corrected canonical tokens (2–4px radii, `#9B1C11` red, real Iconify icons) instead of the old `rounded-xl` pattern. Committed as `6cf2783`.
- `search.html`: same debounced Nexus-ID/IGN search over `nexus_players` + `nexus_player_game_accounts`, same merge-by-player logic, same `player.html` destination. Adds an explicit "Searching…" loading state (previously the hint just stayed up during the debounce with no distinct loading message), a hover lift (border + shadow) on result cards instead of a flat active-state background, and a back-arrow icon button next to the logo in the header. Committed as `252d4bf`.
- Both bring the running conformant-page count to four: `index.html`, `to-login.html`, `to-onboarding.html`, `search.html`. Remaining non-conformant: `to-dashboard.html`, `register.html`, `tournament-new.html`, `player.html`.
- Both verified via local static server (element-presence check against expected IDs) rather than a live browser — Chrome automation still unavailable this session.
**What was NOT finished / left mid-flight:**
- Neither commit's log entry was written by the commit hook — same tool-write-denial pattern as every prior commit this session. This entry backfills both by hand, per explicit instruction this time to always do so regardless of hook behavior.
**Anything the next session needs to know before continuing:**
- Stop expecting the hook to log commits automatically until its tool-permission issue is actually fixed (see Decision Log addendum, 2026-09-06). Manually update this file after every commit in the meantime — this was made an explicit standing instruction this session, not just a one-off.

### Session — 2026-09-06 (cont. 3) — Email-confirmation redirect fixed; production domain corrected; Vercel Deployment Protection discovered blocking the whole site
**Duration/scope:** Moti asked what happens after TO signup → Gmail confirmation → landing page, and whether onboarding needs new disclaimers. That surfaced a real bug (confirmation redirect silently drops the session) and, while fixing it, a much bigger live blocker (Vercel Deployment Protection).
**Files touched:** `js/auth.js`, `supabase/config.toml`.
**What was done:**
- Diagnosed: `signUpTo()` had no `emailRedirectTo`, so Supabase's confirmation link fell back to the project's configured Site URL (the landing page). Since `index.html` no longer imports the Supabase client at all (dropped when the stats script was removed earlier this session), the session token in that redirect URL was silently ignored — user lands on a plain landing page, not signed in, no indication anything happened.
- Fixed by setting `emailRedirectTo: `${window.location.origin}/to-onboarding.html`` in `signUpTo()`. Confirming establishes a session directly (Supabase's `detectSessionInUrl`), so onboarding is reachable immediately — no login step needed. `to-onboarding.html`'s existing `requireSession()` guard still falls back to `/to-login.html` if session detection ever fails.
- Attempted to set this up via `supabase config push` (CLI already linked to the project from a prior session) so Moti wouldn't need the dashboard. **Stopped before running it**: pushing sends the *entire* local `config.toml` `[auth]` block, and comparing it against observed production behavior found real contradictions — `enable_confirmations = false` locally vs. confirmed-on in production, and CLI-scaffold-default rate limits (`email_sent = 2`/hour) that were never verified against live settings. Running it as-is would likely have silently disabled email confirmation and throttled signups in production. No safe partial-push or pull-to-diff option exists in this CLI version.
- Corrected `config.toml`'s `site_url`/`additional_redirect_urls` instead, as local documentation only (**not pushed**) — first guessed the domain from the stale 2026-09-04 log entry (`nexus-id-omega.vercel.app`), which Moti caught was wrong; actual production domain is `nexus-id-mot-i-soft.vercel.app`. Confirmed the dashboard's existing Redirect URLs already include `https://nexus-id-mot-i-soft.vercel.app/**`, which covers `/to-onboarding.html` and `/to-login.html` — no dashboard change was actually needed for the redirect fix itself.
- **New finding, not yet resolved:** `curl` against `https://nexus-id-mot-i-soft.vercel.app/` (and `/index.html`, `/to-login.html`) all return a 302 to `vercel.com/sso-api` → Vercel's login page. This is Vercel Deployment Protection (or "Vercel Authentication") gating the **entire production domain**, not just previews — meaning real, anonymous users currently cannot reach NexusID at all, regardless of the auth-redirect fix above. This may be new since the 2026-09-04 infra session (which only flagged GitHub↔Vercel auto-deploy as unconfirmed, not this), or may have been present without Moti noticing while browsing logged into Vercel himself.
**What was NOT finished / left mid-flight:**
- Vercel Deployment Protection status/scope is unconfirmed from the dashboard side — Moti needs to check Project Settings → Deployment Protection and decide whether Production should have it off (or preview-only). This is a real access blocker for the live product, higher priority than most other open items.
- `config.toml`'s auth rate limits and `enable_confirmations` (now manually set to `true` to match observed reality) are still unverified against the actual live dashboard values beyond that one field — don't assume the rest of `[auth]` in this file is accurate.
- Not live-browser-tested (same recurring gap this session).
**Anything the next session needs to know before continuing:**
- Don't run `supabase config push` without first getting the live Auth settings from the dashboard (screenshot, or once the MCP/OAuth issue is fixed) to reconcile against `config.toml` — this file is known-partially-stale and pushing it blind risks disabling email confirmation and throttling signups in production.
- The production domain is `nexus-id-mot-i-soft.vercel.app`, not `nexus-id-omega.vercel.app` — the 2026-09-04 Session Log entry recording the latter is now known-stale (left as-is per this file's append-only rule; this entry is the correction).

### Session — 2026-09-06 (cont. 2) — TO login/signup merged into one tabbed page; commit hook's failure mode diagnosed
**Duration/scope:** Moti shared a third Claude Design handoff (`NexusID TO Auth.dc.html`) merging TO login and signup into one page with a tab switcher. Implemented it, then got a genuinely useful error message out of the flaky commit hook that narrows down why it's been missing commits.
**Files touched:** `to-login.html` (rebuilt), `to-signup.html` (deleted), `NEXUSID_DESIGN_HANDOFF.md` (corrected).
**What was done:**
- Rebuilt `to-login.html` from the handoff: a LOGIN/SIGN UP segmented tab control (styled after the design system's `DayTabs` component) at the top drives which form shows; login keeps both password and OTP methods (same toggle as before), signup is the same email/password form. Wired to the exact same `js/auth.js` functions already in place (`signInTo`, `signInWithOtp`, `verifyOtp`, `signUpTo`, `getSession`, `fetchMyToProfile`) — no backend changes needed, this was a template/markup merge only.
- Deleted `to-signup.html` — confirmed via grep that nothing else in the repo linked to it, so no redirect stub was needed.
- Built this page directly against the corrected canonical tokens (2–4px radii, `#9B1C11` red, real Iconify icons via component specs pulled from `metazone-main/design-system/components/{navigation/DayTabs,forms/Input,buttons/Button}.jsx`), rather than the old `rounded-xl`/`#B3261E`/raw-glyph pattern — second page in the repo now conformant (after `index.html`).
- Corrected `NEXUSID_DESIGN_HANDOFF.md`: its danger-red entries said `#B3261E` (two places) but that doesn't trace back to anything in `metazone-main/METAZONE_DESIGN_HANDOFF.md` (checked — no hex for red appears there at all), so it was an eyeballed value from 2026-09-05, not a literal copy. Corrected both to `#9B1C11` in place, and added the previously-undocumented radii (2–4px, never pill/12px+) and icon (Iconify Lucide only, no raw glyphs/emoji) rules that this doc never specified before.
- **Commit-hook diagnosis:** committing this work (`e2fce58`) triggered the hook, and this time it reported *why* it couldn't act: its own Edit/Write tools are denied in its execution context. This is the first time the hook has explained a miss instead of silently doing nothing — strong candidate root cause for all three prior misses (`8c352e1`, `940761b`, and now this one before manual intervention): the hook can *read* and *reason* about whether the log needs updating, but apparently cannot *write* to it in at least some execution contexts, making it structurally unable to do its one job in exactly the cases where something new needs logging (the no-op cases it "succeeded" at never needed a write in the first place).
- Committed (`e2fce58`) and pushed to `origin/main`.
**What was NOT finished / left mid-flight:**
- Root cause is now a strong hypothesis (Edit/Write tool denial), not a fix — nobody has yet reconfigured the hook's permissions or confirmed this explains all three misses definitively.
- Not live-browser-tested (Chrome extension still unavailable) — verified via local static server: 200 response, all expected form/tab element IDs present in the served HTML.
- Retrofit of the remaining non-conformant pages (`search.html`, `to-onboarding.html`, `to-dashboard.html`, `register.html`, `tournament-new.html`, `player.html`) is still untouched.
**Anything the next session needs to know before continuing:**
- If asked to fix the commit hook: start from the Edit/Write-tool-denial hypothesis above rather than re-diagnosing from scratch. Check `.claude/settings.local.json`'s hook config for anything scoping the hook agent's tool permissions.
- `to-signup.html` no longer exists — if anything outside this repo (bookmarks, external docs) links to it, that link is now dead. Nothing inside the repo does.

### Session — 2026-09-06 (cont.) — METAZONE canonical design system adopted; landing page rebuilt for fluid responsiveness
**Duration/scope:** Moti shared a Claude Design export of METAZONE's actual design system (tokens/components/guidelines, not just the reference mockups this repo already had), said NexusID should follow it too, then shared a second Claude Design handoff specifically redesigning `index.html` for fluid responsiveness. Both were implemented.
**Files touched:** `index.html` (rebuilt), `assets/maps/*.jpg` (new).
**What was done:**
- Extracted the METAZONE Design System bundle (`METAZONE Design System-handoff.zip`) and placed it in two homes: the full bundle (tokens, React components, guidelines, UI kits) now lives at `metazone-main/design-system/` (the actual METAZONE product repo, sibling to this one, already home to `METAZONE_DESIGN_HANDOFF.md`); it's also installed as a user-level Claude Code skill at `~/.claude/skills/metazone-design/` (invocable as `/metazone-design` from any project on this machine, NexusID included) so it doesn't need duplicating per-repo. Not committed into `metazone-main` yet — that's a separate repo/decision.
- Comparing the canonical tokens against NexusID's current pages surfaced three real mismatches: (1) radius — canonical spec caps at `--radius-lg` 4px and explicitly bans pill/12px+ soft-rounded shapes ("reads as consumer app, not an instrument"), but every existing NexusID page uses Tailwind `rounded-xl`/`rounded-2xl`/`rounded-3xl` (12–24px); (2) danger red — canonical token is `#9B1C11`, NexusID hardcodes `#B3261E`; (3) icons — canonical spec mandates Iconify Lucide (`<iconify-icon icon="lucide:...">`) everywhere, NexusID used a raw `←` glyph for back buttons. **Not yet fixed on the pre-existing pages** — flagged in Open Threads, pending Moti's call on whether to retrofit now or only apply forward.
- Also confirmed (from the same design-system doc) that Lexend Deca-as-`--font-mono` is an intentional, documented naming convention ("UI fabric" role, not literal monospacing) — a real monospace font was tried and explicitly rejected in METAZONE's own v1→v2 pivot for reading as "terminal." Corrects an assistant-side misreading from earlier the same session that suggested swapping to a tabular/mono numeral font for stats; that suggestion should not be pursued.
- Rebuilt `index.html` from the second handoff (`Page redesign for responsiveness (1).zip`, a single `.dc.html` Claude Design canvas + README): sticky full-bleed BGMI map hero (Erangel default, gradient overlay `linear-gradient(180deg, rgba(20,17,13,.90)…)`) with a parallax-reveal scroll effect, the two-CTA layout (Search forest / TO-login orange, each icon+label+subtext+chevron) in a `grid-template-columns:repeat(auto-fit,minmax(260px,1fr))` row, and a redone "How It Works" with large Oswald `01/02/03` numerals. Fully `clamp()`-driven fluid sizing — no discrete breakpoints, per the handoff's explicit responsive strategy. This build already follows the canonical radius (`--radius-lg` 4px) and uses real Iconify icons, so it's the first page in the repo actually conformant to the corrected design system.
- Per the handoff's explicit instruction, dropped the live Supabase stats strip and the footer from `index.html` entirely ("no footer, no stats/counters — no live data source at this time"). The inline search box was already removed to `search.html` in the prior session; this handoff independently confirms that split.
- Copied all four BGMI map images (`erangel`/`miramar`/`sanhok`/`rondo`, `_mid` resolution) into a new `assets/maps/` folder; only `erangel_mid.jpg` is wired up as the hero background, the other three are available for a future swap (the source design treats the map as a swappable prop).
- Committed (`940761b`) and pushed to `origin/main`.
**What was NOT finished / left mid-flight:**
- The three canonical-system mismatches (radius, danger red, icons) are unresolved on every page except the new `index.html` — `search.html`, `to-login.html`, `to-signup.html`, `to-onboarding.html`, `to-dashboard.html`, `register.html`, `tournament-new.html`, `player.html` all still use the old `rounded-xl`/`2xl`/`3xl` + `#B3261E` + raw-glyph pattern.
- Not live-browser-tested (Chrome automation extension unavailable again) — verified by serving locally and confirming 200s on the page and hero image only.
- `metazone-main/design-system/` is uncommitted in that repo.
**Anything the next session needs to know before continuing:**
- The 2026-09-05 git-commit hook missed *this* commit too (`940761b`) — third miss in a row (see the two 2026-09-06 Decision Log addenda). Treat the hook as unreliable until someone actually debugs it; keep manually updating this file after commits in the meantime.
- Before styling anything else in NexusID, check `metazone-main/design-system/tokens/` (or run `/metazone-design`) for the canonical values rather than eyeballing existing NexusID pages, since several of those pages are now known to be non-conformant.

### Session — 2026-09-06 — Page flow restructuring (index → search / TO dashboard quick actions)
**Duration/scope:** Restructured navigation per Moti's explicit flow spec, then investigated why the 2026-09-05 git-commit hook didn't update this file afterward.
**Files touched:** `index.html`, `search.html` (new), `register.html` (new), `tournament-new.html` (new), `to-dashboard.html`, `player.html`, `js/auth.js`.
**What was done:**
- Rebuilt `index.html` down to two primary CTAs per Moti's spec: "Search for a Player" → `search.html`, "Sign Up / Login as TO" → `to-login.html`. Kept the stats strip and "How It Works" as supporting content; dropped the header's separate "TO Login" link and the old inline search box (both superseded by the two-button flow).
- Built `search.html` (new): the debounced Nexus ID/IGN search moved wholesale off `index.html`. Updated `player.html`'s not-found back-link to point here instead of `index.html`.
- Added the first two real "Quick Actions" to `to-dashboard.html` (previously a stub with zero actions): "Create Team / Player IDs" → `register.html`, "Create Tournament" → `tournament-new.html`.
- Built `register.html` (new): two independent forms — create a Nexus ID (`nexus_players` + first `nexus_player_game_accounts` row) and create a Team (`nexus_teams`). Does not link a new player into a team in the same step — rosters (`nexus_team_members`) are still a separate, unbuilt action.
- Built `tournament-new.html` (new): creates only the `nexus_tournaments` shell (name, game, format, dates, max players) — no roster/match/result editing (that's the much larger tournament-editor mockup, out of scope here).
- Added `createPlayer`, `createTeam`, `createTournament` to `js/auth.js`, following the existing `fetchMyToProfile`-gated pattern.
- Committed (`8c352e1`) and pushed to `origin/main`. Deliberately left the untracked `arbitary/bulk-export-*.zip` folder out of the commit — pre-existing, unrelated to this work.
**What was NOT finished / left mid-flight:**
- Not live-browser-tested — Chrome automation extension wasn't connected in this environment (same gap as the 2026-09-05 TO-flow build). Verified by hand-tracing the RLS/JS logic and confirming all pages return 200 from a local static server.
- Team rosters (`nexus_team_members`) still have no UI.
- `tournament-new.html` doesn't lead into the full editor (roster, per-match results, VOD proof) yet.
**Anything the next session needs to know before continuing:**
- The 2026-09-05 git-commit hook got its first real live-fire test on this session's commit (`8c352e1`) and **did not update this file** — this entry was written manually instead. See the Decision Log addendum below before assuming the hook works.

### Session — 2026-09-05 (cont.) — Public landing page + player search/profile
**Duration/scope:** Rebuilt the homepage into a real public landing page and added the first public, no-auth page in the product: player search + profile.
**Files touched:** `index.html` (rebuilt), `player.html` (new).
**What was done:**
- Rebuilt `index.html` from a placeholder stub into a real landing page on the merged design system: hero copy (careful not to imply KYC/verification, per the roadmap guardrail), a live Supabase-backed stats strip (counts from `nexus_players`/`nexus_tos`/`nexus_tournaments`, honestly showing 0 since no real data exists yet), a "How It Works" explainer, and a TO login CTA. Dropped the old `css/style.css`/`js/main.js` scaffold — confirmed via grep that nothing else referenced them.
- Explicit decision (Moti, this session): the root page stays a public page, not a login page — signup/login already live at their own paths (`to-signup.html`/`to-login.html`), so this doesn't change that split.
- Added a live, debounced search box on the landing page: queries `nexus_players` (by `nx_id`) and `nexus_player_game_accounts` (by `in_game_name`) in parallel, merges results by player, and renders the compact "Unclaimed" red-dot indicator per the design handoff's compact-context spec (not the full profile-page chip).
- Built `player.html` (new) as the public profile page search results link to: Nexus ID, real name (if set), Claimed/Unclaimed badge, linked in-game accounts (game/IGN/UID), and tournament history via the `nexus_player_tournament_summary` view joined against `nexus_tournaments` for names. No "Claim This Account" CTA included — the OTP claim flow is still deferred (per existing decision log entry), so an actionable claim button would be a dead end.
- Live-browser-tested both pages against the live Supabase project (Chrome automation): empty-state search ("No matches"), not-found profile page, zero console errors on either.
**What was NOT finished / left mid-flight:**
- Search and `player.html` only cover players (`NX-`) — TOs (`TO-`) and teams (`TM-`) have no public profile page yet and aren't included in search results.
- The TO signup→login→onboarding→dashboard flow still has not been live-browser-tested — explicitly deferred again this session (Moti's call: "skip it, build first"), not fixed.
**Anything the next session needs to know before continuing:**
- `index.html` and `player.html` follow the same self-contained Tailwind CDN + Google Fonts pattern as the TO-side pages. There is no longer any reference anywhere in the repo to `css/style.css` or `js/main.js` — both files are now orphaned (not deleted, just unused; safe to remove if a future session wants to tidy up).
- If TO or team search/profile pages get built later, reuse the same merge-by-search-source pattern in `index.html`'s search script rather than inventing a second search implementation.

### Session — 2026-09-05
**Duration/scope:** Full day, one continuous session — design system merge, schema design through applying it live, and building the first real feature (TO auth + registration).
**Files touched:** `NEXUSID_DESIGN_HANDOFF.md` (new), all 6 files in `NEXUS -id design language/`, `supabase/migrations/0001_init_nexusid_schema.sql` (new), `js/auth.js` (new), `to-login.html`/`to-signup.html`/`to-onboarding.html`/`to-dashboard.html` (new), `index.html`, `.claude/settings.local.json` (new, gitignored), this file.
**What was done (see Decision Log / Change Log for full reasoning on each):**
- Merged NexusID's mockup structure with METAZONE's colour/typography system; recoloured all 6 reference mockups; fixed a "Verified Identity" copy violation.
- Extended ID format to include `TM-` (teams); confirmed all three prefixes use 7-char random suffixes.
- Worked through the actual data model with Moti: Supabase Auth is TO-only (TOs create players/teams on their behalf); player↔team is many-to-many by design; identity dedup is UID-based; a tournament has multiple matches, each with per-player placement/kills; NexusID stores raw match data only and does not compute standings — a separate future "points table" app owns that.
- Drafted the full schema (`0001_init_nexusid_schema.sql`), self-reviewed it and fixed 5 real gaps (see Change Log) before applying it, corrected a stale/wrong Supabase project ref that had sat unverified since 2026-09-04, linked the Supabase CLI, and applied the migration to the live project (`jzqmscrmeywckzodgjre`).
- Built the first real feature end-to-end: TO signup (password), login (password + OTP), onboarding (creates the `nexus_tos` row and generates the TO's `TO-` id), and a minimal dashboard — see Section 4 for the new files. Added a link from `index.html` so the flow is reachable.
- Committed and pushed everything to `origin/main` (commit `d4dcfdf`).
- Set up a local git hook (`.claude/settings.local.json`, gitignored, not shared via the repo) that runs an agent after every `git commit` in this project to check whether this handoff log needs updating — see Decision Log.
**What was NOT finished / left mid-flight:**
- The TO auth/registration flow was **not tested in a live browser** — the Chrome automation extension wasn't connected in this environment. It was traced by hand against the RLS policies and served correctly from a local static server, but nobody has actually clicked through signup → login → onboarding → dashboard yet.
- Whether GitHub→Vercel auto-deploy is connected is unverified as of this push — as of the 2026-09-04 session it was not (manual `vercel --prod` was required). If the new pages don't appear on the live Vercel URL after this push, that's almost certainly why.
- The full-featured TO dashboard (tournament list, quick actions, stats) from the reference mockup was **not** built — `to-dashboard.html` is a minimal stub that only proves the auth/registration loop works.
- Player registration, team registration, and the public profile/scoreboard page (all flagged as priorities earlier) are still not built.
- Two RLS ownership assumptions remain unconfirmed by Moti (only creating-TO can edit a player's identity/IGN/game-accounts; only a team's creating-TO can remove a member) — flagged in the schema's Change Log entry.
- Whether duplicate-player delete-and-restart should be TO-self-service or admin-only is still an open decision (currently modeled as admin-only — no DELETE policy exists for TOs).
**Anything the next session needs to know before continuing:**
- Read `NEXUSID_DESIGN_HANDOFF.md` before styling anything, and `supabase/migrations/0001_init_nexusid_schema.sql` before touching schema — both are now source of truth, separate from METAZONE's own handoff (which explains *why* the tokens exist but isn't NexusID-specific).
- The new local git hook only fires for commits made *by Claude Code* in this repo on this machine — it won't fire for commits Moti makes directly, and won't exist at all on a different machine (it's gitignored, personal-scope by choice).
- First thing to check next session: did the auth flow actually work when Moti clicked through it, and did the Vercel deployment pick up the push.

### Session — 2026-09-04
**Duration/scope:** Infra bootstrap — connecting Git, Supabase, and Vercel for the NexusID website.
**Files touched:** `index.html`, `css/style.css`, `js/main.js`, `js/supabase-config.js`, `.gitignore`
**What was done:**
- Scaffolded a plain HTML/CSS/JS site (not a framework app — matches the existing METAZONE site's stack) as the base for the NexusID public-facing pages.
- Wired `js/supabase-config.js` to load `@supabase/supabase-js` via esm.sh CDN and create a client from a Project URL + anon key (placeholders pending real values).
- Confirmed NexusID uses a **separate Supabase account/project** and a **separate Vercel account** from METAZONE — do NOT assume the shared "MetaZone" Supabase project (`qsiqgtdgpcyishtayqhy`) applies here, despite what Section 4 previously implied ("shared instance w/ METAZONE"). That line is now stale.
- Same GitHub account as other MOTiSOFT projects, but a new/dedicated repo for NexusID.
**What was NOT finished / left mid-flight:**
- Real Supabase Project URL + anon key not yet plugged into `js/supabase-config.js`.
- Git repo not yet pushed to GitHub (remote not created/added yet).
- Vercel project not yet linked/deployed.
**Anything the next session needs to know before continuing:**
- Section 4's `nexus_players`/`nexus_tos`/etc. table rows still say "Supabase (dedicated NexusID project, ref `zghjdrqpnjxuozwrwbjq` — separate Supabase account from METAZONE)" — verify against whichever Supabase project this session actually wires up, and correct that row if it's now a dedicated NexusID project instead of a shared one.

---

## 2. Decision Log

Every decision that shapes scope, architecture, or product direction — with the reasoning, so it isn't re-litigated or silently reversed by a future session that doesn't know why it was made.

Format: **Decision → Reasoning → Reversible?**

```
### [YYYY-MM-DD] — [Short decision title]
**Decision:** ...
**Reasoning:** ...
**Reversible?** Yes/No — if yes, under what condition would it be revisited?
**Supersedes:** [prior decision, if any]
```

<!-- ADD NEW ENTRIES BELOW, NEWEST FIRST -->

### 2026-09-30 — The bot applicant must have their own Nexus ID; they're always player #1
**Decision:** Whoever applies to a tournament from the bot must give their own IGN + UID and gets a Nexus ID (self-created, no TO involved), and is automatically player #1 on the roster. Teammates' UIDs stay optional. If the applicant's UID already has a Nexus ID that no Telegram account is linked to (e.g. a TO created it on the web), the bot links it instead of creating a duplicate; if it's linked to someone else's Telegram, the bot refuses.
**Reasoning:** Moti: makes every bot user a tracked player from their first application — the adoption hook. Moti chose "always a player" over asking each time.
**Reversible?** Yes. Known risk, accepted as the product's existing low-trust tier: someone who knows another player's UID could link a web-created, unlinked Nexus ID to their own Telegram first. The link is not a "claim" (`claimed` stays false) and gives no edit rights; if it's abused, add a TO-confirmed or OTP claim step.
**Supersedes:** Refines the 2026-09-30 bot-first decision "players never need a phone number or Telegram" (teammates still don't; the applicant now does). First time a Nexus ID can exist without a creating TO — refines 2026-09-05 "a TO creates Player IDs on players' behalf".


### 2026-09-30 — A registered player's UID is optional
**Decision:** When applying, a captain may list a teammate by name only. The player counts toward the team; with no UID nothing can ever link their results to a Nexus ID, so no history is kept for them. UIDs are still stored whenever given.
**Reasoning:** Moti, after live-testing step 2: captains often won't know every teammate's UID, and the bot is meant to lower the barrier to entry. The bot says plainly on the confirm screen and after submitting which players will have no history.
**Reversible?** Yes — a per-tournament "require UIDs" switch could be added if TOs want it.
**Supersedes:** Refines the 2026-09-30 bot-first decision's "guest entries keep each player's UID" (now: keep it when given).


### 2026-09-30 — Production domain is `nexus-id-omega.vercel.app`
**Decision:** Treat `nexus-id-omega.vercel.app` as NexusID's public address everywhere (bot links, Supabase Site URL/redirects, Telegram webhook).
**Reasoning:** Vercel → Domains (seen by Moti 2026-09-30) lists omega as the only Production domain. `nexus-id-mot-i-soft.vercel.app` is Vercel's team-scoped alias and sits behind Vercel's login — the 302-to-SSO found 2026-09-06 and Telegram's 401 on 2026-09-30 were both that login, not the site.
**Reversible?** Yes — if a custom domain is added later, switch to it the same way.
**Supersedes:** The 2026-09-06 note/Change Log correction that declared `mot-i-soft` the production domain and omega stale.

### 2026-09-30 — Bot-first direction: shared TO accounts, TO signup on Telegram, captains, guest UIDs, universal TO search
**Decision:** The bot is the acquisition channel; a Nexus ID is optional history, never a prerequisite. Agreed with Moti (full detail: `NEXUSID_TELEGRAM_INTEGRATION_PLAN.md` decisions 6–12):
  - TO IDs are shared through **members with their own logins** (Owner/Admin, invite links), not a shared password. `private.current_to_id()` will resolve via a new `nexus_to_members` table.
  - A TO account can be **created fully on Telegram** (email collected); the bot sends a one-time "set your password" link to a web page so the TO picks their own password and can log in on the web. Passwords are never typed into the chat.
  - Teams are run from Telegram by a **captain** (creator), co-managers by invite. Linking to an existing `TM-` id now needs that invite (changes 2026-09-27 point 5 for teams).
  - Players need no phone or Telegram — identity stays the BGMI UID, typed by the captain.
  - **Guest entries keep each player's UID** so results attach if they later get a Nexus ID (Moti chose this over names-only; changes 2026-09-27 point 4).
  - **Standings stay raw placement + kills** (Moti chose this over adding a points table; reaffirms 2026-09-05).
  - Universal **Find a TO → active/upcoming tournaments → Apply** is open to anyone on the bot.
**Reasoning:** Shared passwords can't be revoked per person or show who did what. Collecting UIDs from guests turns "play first" into a path to claiming a Nexus ID later. Keeping standings raw avoids building a points ruleset another app owns.
**Reversible?** Yes — each is additive schema; the points table could be added later.
**Supersedes:** 2026-09-27 points 4 (guest UIDs now kept) and 5 (team linking now invite-only). Refines 2026-09-05 "Supabase Auth is TO-only" (still TO-only, now also creatable from the bot).

### 2026-09-30 — Bot channel: Telegram instead of WhatsApp
**Decision:** The NexusID bot runs on the Telegram Bot API, not the Meta WhatsApp Cloud API. Replaces point 1 of the 2026-09-27 decision (below); points 2–5 stand, with channel details swapped (TO linking via a Telegram account instead of a phone number; player/team links keyed by Telegram user id).
**Reasoning:** WhatsApp without Meta Business Verification is capped at 5 manually-added test numbers, and verification needed Udyam Registration first — so the self-service registration flow (decision 5) couldn't reach real players at all. Telegram needs no business verification, any user can message a bot immediately, it's free with no 24h window or paid templates (so proactive TO pushes and payment reminders become free too), and it has richer buttons. Telegram is widely used in the BGMI community. It also avoids storing phone numbers entirely (Section 5 guardrail). Tradeoff accepted: fewer users already have Telegram installed than WhatsApp.
**Reversible?** Yes — flow code takes a `reply` callback and `nexus_bot_sessions`/`nexus_bot_link_codes` are channel-neutral, so WhatsApp can be added later as a second channel (after Udyam + Meta verification) without redoing the flows.
**Supersedes:** Point 1 of "2026-09-27 — WhatsApp integration: five scope decisions before building anything".


### 2026-09-27 — WhatsApp integration: five scope decisions before building anything
**Decision:** Before designing the WhatsApp feature, five forks were resolved with Moti:
  1. **WhatsApp channel: official Meta WhatsApp Cloud API**, not an unofficial library (Baileys/whatsapp-web.js) or a paid BSP (Wati/AiSensy/Gupshup). The core flow (replying to a user-initiated message inside the 24h session window) is free either way; only a platform-initiated message outside that window (a payment reminder, a push notification to a TO) would need a paid template message.
  2. **Payments stay record-keeping only.** The bot/dashboard tracks a paid/unpaid/partial status per registration, marked manually by the TO after collecting money outside the platform — no gateway, no real funds ever touch NexusID. Reaffirms, does not reverse, the 2026-07 baseline "no payments/escrow" decision below.
  3. **A TO's WhatsApp number is linked to their existing web account**, not a new "WhatsApp-only TO" identity — a one-time code generated on the dashboard, sent back over WhatsApp, binds `whatsapp_phone_e164` to their `nexus_tos` row. Every write still attributes to a real, existing TO.
  4. **Guest tournament entries (no `NX-`/`TM-` id, "no history tracked") get zero `nexus_players`/`nexus_teams` rows** — they stay invisible to search/profiles/other tournaments' stats — but a TO must still be able to log placement/kills for them and see them in that tournament's own standings. Realizing the schema as originally sketched (pure freeform text with nothing to attach a match result to) would have broken exactly that, `nexus_participations` itself needs relaxing (nullable `player_id`, new `guest_player_name`/`guest_team_name` columns) rather than just adding a registration table. Guest/registration data of every kind must still surface on the TO's own tournament history/dashboard view — "no history tracked" means no public profile for the guest, not that the TO can't see who registered.
  5. **Players/teams who already hold a Nexus ID can self-serve**, separately from TO linking: link their `TM-`/`NX-` id to their own phone (`nexus_wa_entity_links` — a lighter-weight binding than TO linking, no password, since these ids are already public/lookup-able and nothing today models a single "owner" of a team), then browse a TO's open tournaments and submit a registration request in one structured message (fixed `TEAM: ... / PLAYERS: ...` format, meant to be pasted straight from a WhatsApp group chat). The request lands as `pending`; the TO approves it from a pull-based menu (never a push notification by default — that would cost a paid template message outside the 24h window). Approval is what actually removes the TO's manual copy-paste-into-the-tournament-editor step.
**Reasoning:** See each point above — every one was a genuine fork with a real tradeoff, not a detail to guess at. #4 in particular was caught only after Moti asked a clarifying follow-up ("will guest players still be searchable enough to mark positions and give kill points?") that exposed the schema gap in the first draft of the plan.
**Reversible?** Yes for all five — e.g. #1 could add a paid BSP later if Meta's business verification proves too slow; #5's no-code entity linking could gain a lightweight confirm-back step if abuse shows up (a rival captain linking someone else's `TM-` id to submit bogus requests).
**Supersedes:** None. #2 reaffirms rather than reverses the 2026-07 "no payments/escrow" baseline decision.

### 2026-09-17 — Confirmed: a TO and a player may share the same in-game UID
**Decision:** No schema change — confirmed, by inspection, that `nexus_tos.to_uid` and `nexus_player_game_accounts.in_game_uid` are allowed to hold the same value for the same real person. This is intentional, not an oversight, and must not be "fixed" into a cross-table uniqueness constraint later.
**Reasoning:** `nexus_tos.to_uid` has no uniqueness constraint at all (not even among TOs, and it isn't scoped to a `game` column). `nexus_player_game_accounts.in_game_uid` is only unique *per game, among players* (`nexus_player_game_accounts_uid_unique_per_game`) — that constraint exists purely as the anti-duplicate-player mechanism (2026-09-05), with zero relationship to the TO table. There is no FK, check, or trigger linking the two. Moti confirmed this is the desired behavior: a TO is very often also a player in real life, using the same BGMI UID for both roles, and the product should not force them to fake a second UID just to organize tournaments.
**Reversible?** Yes — if a future need arises to flag "this TO is also this player" as an explicit link (e.g. to unify their public profiles), that would be a new, additive feature, not a constraint tightening.
**Supersedes:** None.

### 2026-09-16 — Team roster management + tournament editor: three scope calls
**Decision:** Building the first real write-UI for `nexus_team_members`/`nexus_matches`/`nexus_participations` surfaced three forks, all confirmed by Moti:
  1. **Squad-based batch result entry, not one-row-at-a-time.** A TO picks an existing team, its active roster auto-loads, and they enter one placement for the whole squad plus a kills value per member — one submit inserts a `nexus_participations` row per player. Matches how a BGMI scoreboard is actually read (per-squad placement, per-player kills), not how the schema happens to store it (one row per player).
  2. **No explicit tournament-squad pre-registration step or table.** Unlike METAZONE's "Opposition Roster" wizard step, a team's participation in a tournament is implied by the first logged match result for them — no new bridge table, no separate "register teams" phase before results can be entered.
  3. **Soft-remove for team members (new UPDATE RLS policy), not hard-delete.** `nexus_team_members` had a DELETE policy (team creator only) from `0001` but no UPDATE policy at all, so there was no RLS-legal way to set `left_at`. `team.html`'s History tab (built earlier the same session) already reads `left_at` to render "left"/"rejoined" events — hard-delete would make that half of the feature permanently unreachable. `0004_team_roster_removal.sql` adds the policy plus the same column-lockdown pattern (`revoke update ...; grant update (left_at) ...`) every other table in `0001` already uses.
**Reasoning:** (1) optimizes for how a TO will actually use this feature at 2am after a tournament ends, not for schema convenience. (2) avoids adding a table whose only job would be to pre-declare something the match-results table already implies once real data exists — YAGNI until a concrete need for pre-registration (e.g. seeding/bracket generation) shows up. (3) was found, not chosen — the History tab already committed to `left_at`-based semantics before this session got to roster removal, so hard-delete would've silently broken an already-built feature.
**Reversible?** Yes for all three — e.g. if seeding/bracket logic is ever built, (2) would need revisiting with a real pre-registration table at that point.
**Supersedes:** None.

### 2026-09-16 — Squad/TO Profile mockups vs. real schema: four more scope calls
**Decision:** Same process as the Player Profile mockup, applied to the two Squad/TO Design handoffs. Four calls, all confirmed by Moti:
  1. **No claimed/unclaimed badge or claim CTA on `team.html`/`to.html`** — unlike `nexus_players`, neither `nexus_teams` nor `nexus_tos` has a `claimed` column at all, so this isn't just "the claim flow is deferred" (the 2026-09-05 player reasoning) — there's no schema state to check in the first place.
  2. **Drop the Squad mockup's team "tag" and per-roster "IGL" badge** — neither exists in the schema; not added as new columns.
  3. **Drop the TO mockup's "orgType" line** — `nexus_tos.organisation_name` already covers this; a separate free-text category field would likely just duplicate it.
  4. **Add real schema support for the TO Activity tab and Champion/Prize Pool fields**, rather than dropping them or faking the data — a new `nexus_activity_log` table and `nexus_tournaments.prize_pool` column (see Change Log). Accepted tradeoff: only `tournament_created` events are actually emitted right now (no registration-open/close or result-publishing feature exists to write the other event types yet), and "Champion" is a documented heuristic (last-match winner), not a verified final standing.
**Reasoning:** Same as the player mockup decision — these are visual references, not literal specs. Unlike the player page's four calls, this set leaned toward *dropping* invented fields (1–3) rather than adding schema for them, except where the added value was judged worth real schema work (4, TO's Activity/Champion/Prize Pool being core to how a TO's profile actually represents their track record).
**Reversible?** Yes for all four — e.g. if a real "verify this team/TO" feature ships later, #1 gets revisited; if registration/result-publishing UI gets built, #4's Activity tab starts getting real data for the other event types.
**Supersedes:** None.

### 2026-09-16 — Player Profile mockup vs. real schema: four scope calls
**Decision:** Talked through the new Player Profile Claude Design handoff against the live schema/decisions before building. Four calls, all confirmed by Moti:
  1. **No "Claim This Profile" CTA** — the mockup has one, but it stays out, unchanged from the existing 2026-09-05 decision (OTP claim flow deferred; an actionable claim button would be a dead end).
  2. **Multi-account/multi-team players show "most recent + N more"**, not every linked account/team — the mockup's single IGN/UID/Team line doesn't reflect that a player can have several game accounts and belong to several teams concurrently (both by design, 2026-09-05).
  3. **Build the full per-match tournament-history breakdown** (day/match/squad-kills), not the simpler flat per-tournament summary the old page used — squad kills required a new DB view since it isn't a stored column.
  4. **Add a real `stage` schema column** (`nexus_tournaments.stage`) for the mockup's "Grand Finals"/"Qualifiers" label, rather than dropping it — so TOs can eventually set it via `tournament-new.html`.
**Reasoning:** The mockup is a visual reference, not a literal spec — same standing approach as the rest of this repo's design-language/mockup folders. Each of these four points was a genuine mismatch between what the mockup assumed and what the schema/product decisions actually support, so each got a deliberate call instead of silently picking one.
**Reversible?** Yes for all four — e.g. if the claim flow ships, #1 gets revisited; if a real multi-account UI need shows up, #2 can change to a list.
**Supersedes:** None — #1 reaffirms the 2026-09-05 claim-CTA decision rather than reversing it.

### 2026-09-06 — Adopt METAZONE's canonical design system as NexusID's own styling source of truth
**Decision:** NexusID now defers to the actual METAZONE Design System (tokens/components/guidelines shipped from Claude Design, placed at `metazone-main/design-system/` and installed as the `/metazone-design` Claude Code skill) as the authority for colors, type, spacing, radii, and iconography — not the earlier hand-eyeballed "merged design system" from the 2026-09-05 session, which turned out to diverge from it in three concrete ways (radius, danger red, icon usage — see this session's log entry and Open Threads).
**Reasoning:** The 2026-09-05 session merged NexusID's own mockups with METAZONE's colors/type by inspection of METAZONE's HTML source, without an authoritative token file to check against — reasonable at the time, but it silently drifted on radius (used Tailwind's large rounded corners instead of the system's tight 2–4px caps), the exact danger-red hex, and icon methodology (raw glyphs instead of Iconify Lucide). Now that a real, versioned token source exists, drift should stop.
**Reversible?** Yes — if NexusID's product needs ever diverge from METAZONE's (e.g. a deliberately different feel), that would be its own logged decision, not silent drift.
**Supersedes:** Refines, does not reverse, the 2026-09-05 "merged the design system" work — the palette/type choices made then were correct; the geometry/icon details were not.

### 2026-09-06 — Git-commit handoff-log hook: first live test failed silently
**Decision:** No new decision — this is a factual addendum to the 2026-09-05 entry below, so a future session doesn't assume the hook is working just because it's configured.
**Reasoning:** N/A (observation, not a design choice).
**Reversible?** N/A
**What was observed:** The 2026-09-05 entry noted the hook was "not live-fire tested yet... the next real commit is the first live test." That commit happened this session (`8c352e1` — new pages, new `auth.js` functions, unambiguously session-worthy). Afterward, `NEXUSID_HANDOFF_LOG.md`'s last-touched commit remained `946cd70` (the prior session's commit) — no hook-authored edit appeared, staged or otherwise, and no hook agent was still running post-push. Separately, the hook *did* fire twice earlier the same session for two unrelated `curl` commands (its `matcher` is scoped to any `Bash` call, not literally `git commit` — the `if` field reads as a natural-language condition handed to the hook's own agent, not a strict pre-filter) and both times correctly concluded nothing needed logging. So the hook mechanism runs, but did not act on the one commit it actually mattered for.
**Root cause:** Not yet diagnosed — flagged in Open Threads for next session.
**Supersedes:** N/A — appended alongside the 2026-09-05 entry, not a reversal of it.

### 2026-09-05 — Local git-commit hook to auto-check the handoff log
**Decision:** Added `.claude/settings.local.json` (gitignored, personal to this machine) with a `PostToolUse`/`Bash` hook filtered to `git commit` commands. After every commit Claude Code makes in this repo, it spawns a Sonnet-5 agent that checks the commit's diff against this file's existing entries and adds a properly-sectioned entry if something session-worthy isn't already logged, or does nothing if it's already covered.
**Reasoning:** Moti asked for automatic handoff updates on every commit. A plain shell git hook can't intelligently decide what's worth logging or write prose matching this file's style — that needs an LLM, which is what Claude Code's `agent`-type hook provides. Scoped to local settings (not the shared project settings) per Moti's choice, and to commits only (not pushes) since the commit is where the diff naturally lives.
**Reversible?** Yes — it's a single gitignored file; delete it or edit via `/hooks` to change/disable.
**Constraints/edge cases to hold going forward:** Only fires for commits Claude Code itself makes in this repo on this machine — it does not fire for commits Moti makes directly, and does not exist on any other machine since it's gitignored by design. Not live-fire-tested yet (would have required a throwaway test commit) — validated by JSON schema/structure check only; the next real commit is the first live test.
**Supersedes:** N/A

### 2026-09-05 — 48-hour edit window on TO-submitted match/participation data; evidence upload planned for later
**Decision:** A TO can edit a player's match/participation entry only within 48 hours of entering it. After that window, the entry is locked — no further edits to that player's history/data for that match. Enforced at the database level (RLS `UPDATE` policy checking `now() <= created_at + interval '48 hours'`), not just in the UI, so it can't be bypassed by calling the API directly. Separately (later phase, not this build pass): TOs will be prompted to attach evidence for a result — a screenshot upload and/or a stream/VOD link — as proof. This is a generalization of the existing VOD-verified vs. TO-reported trust-tier concept already in the tournament editor mockup (which has a "VOD Proof" link field): the future version pushes toward requiring or strongly encouraging evidence at entry time rather than it being an optional link.
**Reasoning:** A ledger that can be silently rewritten weeks later has no integrity — the whole value of NexusID is that participation history is a trustworthy record, not a live-editable spreadsheet. A short, fixed edit window allows correcting genuine mistakes (typos, wrong score entered) shortly after the fact, without leaving the door open to retroactive tampering (e.g. a TO changing a result later to favor someone, or scrubbing a bad result). Requiring evidence going forward raises the bar on what counts as `to_reported` vs. currently-unverifiable data, without yet requiring the heavier `vod_verified` review process.
**Reversible?** Yes — window length (48h) can be tuned; must stay a deliberate, logged change if adjusted, not silently drift.
**Migration/schema notes:** `nexus_participations` needs a `created_at` timestamp (edit-window anchor — based on original entry time, not last-edit time) and, for the future evidence feature, reserve columns for `evidence_screenshot_url` / `evidence_stream_url` even if not enforced/populated in v1, so the schema doesn't need a breaking migration when that phase ships.
**Post-lock correction path:** there is no in-product "request an edit" or override feature for locked entries in v1. Any correction needed after the 48-hour window requires contacting Moti's team directly (out-of-band support/manual process) — this is a deliberate absence, not a gap to fill with UI. If a self-service post-lock correction/appeal feature is ever considered, it needs its own due-process design (audit trail, who can approve it) — do not casually add a "TO requests override" button without that, since it would quietly reopen the exact tampering risk the 48-hour lock exists to close.
**Supersedes:** N/A

### 2026-09-05 — Player-team relationship is many-to-many by design (not an edge case)
**Decision:** A single Nexus player ID (`NX-`) can be linked to multiple different Team IDs (`TM-`), concurrently or over time, with no exclusivity constraint. Teams are persistent, standing entities (not per-tournament snapshots) and are searchable/loadable by any TO — if a different TO enters an existing `TM-` ID into their tournament editor, that team's player roster auto-loads.
**Reasoning:** In lower-tier/grassroots tournaments, players routinely play under different teams for different events (pickup squads, org changes, guest slots). Artificially locking a player to one team would misrepresent reality and create friction the platform doesn't need to solve. This was raised as a potential edge case needing special handling, but the resolution is that it isn't one — the schema should just support a natural many-to-many player↔team relationship (a join table, not a `team_id` foreign key on the player record).
**Reversible?** Yes, though loosening a stricter model later would be easier than the reverse — starting many-to-many is the safer default.
**Supersedes:** N/A

### 2026-09-05 — Player identity uniqueness enforced on in-game UID, not name; conflict resolution is delete-and-restart only
**Decision:** A player's real-world identity anchor is their **in-game UID** (paired with game — a BGMI UID and a Valorant UID are different namespaces), not their IGN (display name), since IGNs can legitimately change or repeat across different real people while a game UID is a fixed per-account identifier. When a TO tries to register a new `NX-` player and enters a UID that's already attached to an existing Nexus player record, the system must surface that ("this UID already exists") instead of silently creating a duplicate identity. The only resolution path when a genuine conflict needs resetting is to **delete that record's participation history and start fresh** — there is no merge feature. In the normal case this is rarely needed, since the many-to-many team relationship above already covers the "same player, different team" scenario without requiring a new ID.
**Reasoning:** UID-based deduplication is the actual mechanism that prevents the identity-cycling problem NexusID exists to solve (a banned/cheating player re-registering under a new IGN). Delete-and-restart (rather than a merge tool) was chosen for simplicity in v1 — merging participation histories correctly is a harder problem deferred until it's actually needed.
**Reversible?** Yes — a merge feature can be added later without breaking this constraint.
**Open risk to flag, not yet resolved:** giving any authenticated TO the power to delete an existing player's participation history (even framed as "duplicate cleanup") is a real misuse vector — a careless or bad-faith TO could wipe a rival's or disliked player's record. Worth deciding whether this action should be TO-self-service, or gated to an admin/Moti-level role, before it ships. Not blocking schema work, but should be resolved before this ships to real TOs.
**Supersedes:** N/A

### 2026-09-05 — Unclaimed status stays in v1; OTP player-claim flow confirmed deferred, not dropped
**Decision:** The "unclaimed" player record concept (from the original roadmap) stays in this build. In compact contexts (search results, roster lists), unclaimed status is shown as a small red dot rather than the full "Account Unclaimed" chip used on the full profile page (that chip stays for the profile view — this only affects list/card density elsewhere). The OTP-based player claim flow itself remains on the roadmap but is explicitly deferred to a later phase — it is not being built in this pass, consistent with "Supabase Auth is TO-only" for now.
**Reasoning:** Confirms `nexus_players` still needs a claimed/unclaimed status field in v1 schema even though the claiming *mechanism* isn't implemented yet — the status just won't be actionable by the player themselves until player-side auth exists later.
**Reversible?** Yes.
**Supersedes:** N/A
**Design system note:** using red for an "unclaimed" attention-marker (not just errors) is a new, deliberate use of the warm-red token (`#B3261E`) outside pure error/danger states — added as a component note in `NEXUSID_DESIGN_HANDOFF.md`.

### 2026-09-05 — Supabase Auth scope: TO-only; TO email sourced from auth session, not re-entered
**Decision:** Supabase Auth is used only on the TO side of NexusID. TOs sign up/log in via Supabase Auth (email or OTP), and once authenticated, a TO creates Player IDs (`NX-`) and Team IDs (`TM-`) on players'/teams' behalf. Player and TO profile cards themselves are public pages — no auth required to view them. Because the TO is the one authenticated (not Moti acting as an anonymous admin), the "TO email" field in the TO registration/profile form is **not** a separately-typed field — it's read from `auth.users.email` for that TO's session and reused, since they already supplied it at signup.
**Reasoning:** Corrects an earlier in-session assumption (this file's 2026-09-05 session notes originally treated "TO email" like the player form's manually-entered recovery-contact field, on the theory that Moti enters TO data anonymously per the pilot ingestion strategy). Moti clarified TOs authenticate directly — so re-asking for an email Supabase Auth already has would be redundant data entry and a sync-drift risk (two sources of truth for the same email).
**Reversible?** Yes — if a future phase adds player-side Supabase Auth (e.g. for the OTP claim flow), the same logic would apply there too: claim confirmation should read from the auth session, not a re-typed field.
**Supersedes:** N/A (corrects same-day reasoning, not a prior logged decision — no formal entry existed yet for TO email sourcing).

### 2026-09-05 — ID format extended to include Team ID (TM-)
**Decision:** A third registerable entity, the Team, gets its own Nexus-format ID: `TM-XXXXXXX` (7-character random alphanumeric suffix, same charset/logic as `NX-`/`TO-`). Distinct short prefixes per type (`NX-`, `TO-`, `TM-`) are kept — explicitly rejected a unified-brand scheme (`NXPL-`/`NXTO-`/`NXTM-`) that would prefix everything with `NX` plus a type code.
**Reasoning:** Same rationale as the original 2026-09-04 ID format decision: prefixes exist purely for at-a-glance account-type recognition, not as a trust/brand signal, so a third short prefix extends that logic cleanly rather than requiring a redesign. The unified-brand scheme was rejected because it adds 2 extra characters to every ID for no real gain — IDs only ever appear inside NexusID's own branded UI anyway. Suffix length stays at 7 characters (matching existing `NX-`/`TO-` IDs) rather than shortening to 6 or 4 for teams specifically, to avoid a fourth inconsistent ID length in the system; 4 characters (36⁴ ≈ 1.7M combinations) was also judged too small a space long-term.
**Reversible?** Yes — same reversibility as the original ID format decision (no meaning encoded in the suffix, so format is extensible without breaking issued IDs).
**Supersedes:** N/A — extends [2026-09-04 — ID format for players and TOs] rather than replacing it.

### 2026-09-04 — Pilot data-ingestion strategy (Moti-operated TO accounts)
**Decision:** For the pilot tournament, Moti (or team) creates TO accounts on behalf of real-world TOs — not requiring TOs to use the platform directly. Moti pays TOs to (a) run their tournament as normal and share results as screenshots, and (b) distribute a NexusID scoreboard link to players. Moti then manually enters match/participation data from those screenshots under the TO's account, tagged `to_reported`. Players are created as unclaimed `nexus_players` records (per the TO-creates-player-record decision) and linked via the shared scoreboard URL, which doubles as the player claim funnel.
**Reasoning:** Solves cold-start adoption risk — getting a TO to *use* a new unproven tool mid-tournament is high-friction; getting them to share a link and screenshots for pay is low-friction. Screenshots entered by Moti under the TO's `logged_by` ID are legitimately `to_reported` trust tier (same as if TO typed it themselves) — no schema change needed. Paying TOs for distribution/content is unrelated to the roadmap's payments/escrow prohibition (that clause blocks the platform handling entry fees/prize pools, not Moti paying a contractor).
**Reversible?** Yes — this is a deliberate one-tournament bootstrap tactic, not the permanent ingestion model. Real adoption still means TOs or players using the tool directly at scale.
**Constraints/edge cases to hold going forward:**
- Internally note that the TO didn't operate the platform themselves — screenshots + Moti-entered data — so this pilot isn't later mistaken as "TOs actually used the tool" (a different, stronger signal not to overclaim).
- Screenshot-sourced data stays capped at `to_reported` trust tier, never promoted to `vod_verified` — that tier stays reserved for actual video evidence.
- TO accounts created this way remain claimable later via OTP if the real TO wants direct platform access, same unclaimed-record pattern as players.
- The scoreboard link given to players is doing double duty (proof-of-concept distribution + player claim funnel) — worth designing deliberately once built.
**Supersedes:** N/A

### 2026-09-04 — ID format for players and TOs
**Decision:** Nexus ID is a flat, random alphanumeric string with a category prefix — no encoded meaning beyond category. Format: `NX-XXXXXXX` for players, `TO-XXXXXXX` for TOs (same random-suffix logic, different prefix). No region, year, or game encoded into the ID.
**Reasoning:** Random suffix avoids leaking volume/signup-order info and can't be reverse-engineered. No game code because identity must survive across games/tournaments (game context lives on `nexus_participations`, not the ID) — encoding game would fragment identity if a player plays multiple titles or MOTiSOFT expands beyond BGMI. No region/year encoding because it would imply a verification/authority tier that doesn't exist yet — consistent with the "not KYC" guardrail. Distinct prefixes (`NX-` vs `TO-`) exist purely for UX clarity (immediately know account type when looking up an ID), not as a trust signal — TOs remain the same low-trust tier as players per Roadmap Section 5.
**Reversible?** Yes — format can be extended (e.g. adding a checksum char) without breaking existing IDs, since no meaning is encoded to begin with. Would need migration if changed after IDs are issued.
**Supersedes:** N/A (first ID format decision)

### 2026-07 (baseline, from Roadmap v1)
**Decision:** OTP-only signup; never call it KYC or "verified identity."
**Reasoning:** Legal exposure (DPDP Act) and credibility — overclaiming verification is worse than admitting the current tier is low-trust.
**Reversible?** Yes — only if a real KYC integration + legal entity + budget exist.
**Supersedes:** N/A (founding decision)

### 2026-07 (baseline, from Roadmap v1)
**Decision:** No cheater-flagging feature, no public accusation system, in v1.
**Reasoning:** Defamation liability with zero due-process infra and no account-level KYC to prevent re-registration.
**Reversible?** Yes — only alongside a due-process framework and legal review.
**Supersedes:** N/A

### 2026-07 (baseline, from Roadmap v1)
**Decision:** No payments/escrow, no entry fees handled by the platform.
**Reasoning:** Triggers RBI Payment Aggregator/Gateway regulation — out of scope until legal entity + compliance budget exist.
**Reversible?** Yes — only with legal entity formed and compliance reviewed.
**Supersedes:** N/A

---

## 3. Change Log (build/schema/code)

Tracks concrete changes to the data model, function names, file structure, or shipped features — the stuff that breaks things if a future session assumes stale state.

```
### [YYYY-MM-DD] — [Component changed]
**Type:** Schema / Function rename / New feature / Bugfix / Infra / Copy change
**What changed:** ...
**Why:** ...
**Migration/backward-compat notes:** (e.g. "old column X kept, new column Y added — do not drop X")
```

<!-- ADD NEW ENTRIES BELOW, NEWEST FIRST -->

### 2026-09-30 — Bot screens update in place
**Type:** UX
**What changed:** `api/telegram/webhook.js` collects every reply a flow makes for one update into a single message (texts joined, button rows stacked, duplicate rows dropped). For a button tap, that message replaces the tapped message via `editMessageText` (new `editText` in `_send.js`), falling back to a new message if Telegram refuses the edit. Typed messages still get a new reply, now one instead of several.
**Why:** Moti: the chat looked "jeggedy" with every tap stacking a new message.
**Migration/backward-compat notes:** No flow code changed — flows still call `reply()` as before. Pushes to other users (new-application alerts, approval messages) are unchanged.


### 2026-09-30 — Self-registered Nexus IDs from the bot
**Type:** Schema / New feature
**What changed:** `0010_self_registered_players.sql`: `created_by_to_id` nullable on `nexus_players`, `nexus_player_game_accounts`, `nexus_ign_links`; `nexus_players.created_via` ('to'/'telegram'); new private `nexus_player_telegram_links` (player ↔ Telegram, one each way). Bot: `api/telegram/_players.js` (find/create/link the applicant's Nexus ID), apply flow asks for the applicant's IGN + UID first (skipped once they have one), applicant is player #1 and only teammates are typed, new "🪪 My Nexus ID" menu item.
**Why:** See Decision Log, same day.
**Migration/backward-compat notes:** 0001 RLS unchanged — a NULL `created_by_to_id` matches no TO, so self-registered players can't be edited from the web. Planned migration numbers shift again: guest participations → `0011`, payment status → `0012`. `0009` + `0010` applied by Moti 2026-09-30 before this was pushed.


### 2026-09-30 — Optional player UID on registrations
**Type:** Schema / Behaviour change
**What changed:** `0009_optional_player_uid.sql` drops NOT NULL on `nexus_tournament_registration_members.player_uid` (format check and the per-tournament UID unique index both ignore NULL). Bot accepts a bare name as a player line (a bare number is still rejected), checks for duplicate names within a team, and labels name-only players "no UID (no history)" on the confirm/review screens and the editor.
**Why:** See Decision Log, same day.
**Migration/backward-compat notes:** Planned migration numbers shift: guest participations → `0010`, payment status → `0011` (plan doc updated). Apply `0009` before this code deploys, or name-only submissions fail on the NOT NULL.


### 2026-09-30 — Tournament registrations (Phase 1, part 1)
**Type:** Schema / New feature
**What changed:** `0008_tournament_registrations.sql` (`nexus_tournaments.registrations_open`/`team_size`, `nexus_tournament_registrations`, `nexus_tournament_registration_members`, `private.attach_guest_registrations()` trigger). Bot apply/review flows, `api/registrations/decide.js`, editor Registrations section, team size on tournament creation. `js/auth.js`: `createTournament` takes `team_size`; new `setRegistrationsOpen`, `fetchTournamentRegistrations`, `decideRegistration`.
**Why:** Decisions 9, 10, 12 (bot-first, 2026-09-30).
**Migration/backward-compat notes:** Existing tournaments get `team_size = 4`, `registrations_open = false`. Must be applied before the code deploys. No existing policy altered; `grant update (registrations_open, team_size)` is additive.


### 2026-09-30 — Site address switched back to `nexus-id-omega.vercel.app`
**Type:** Infra / Config
**What changed:** `api/telegram/_supabaseAdmin.js` `SITE_URL` fallback, `supabase/config.toml` `site_url` (+ omega added to `additional_redirect_urls`, mot-i-soft kept), and the setWebhook command in `NEXUSID_TELEGRAM_INTEGRATION_PLAN.md` now use `nexus-id-omega.vercel.app`.
**Why:** See Decision Log 2026-09-30 (production domain). Telegram's webhook got 401 at the mot-i-soft address.
**Migration/backward-compat notes:** Live Supabase Site URL / Redirect URLs must be updated by hand in the dashboard (Moti, same day) — `config.toml` is never pushed. Reverses the 2026-09-06 Change Log correction that moved `site_url` from omega to mot-i-soft.

### 2026-09-30 — Website signup: confirm with the emailed code
**Type:** New feature
**What changed:** `to-login.html`'s SIGN UP tab now shows a code box right after "Create Account" (plus "Resend code"), instead of only "check your email, then log in". The OTP login code field no longer caps input at 6 digits (the code length is a project setting). `js/auth.js` gained `verifySignupCode` (tries type `email`, falls back to `signup`) and `resendSignupCode`.
**Why:** After SMTP was set up the same day, confirmation emails carry both a code (`{{ .Token }}`) and a link. Moti tested signup and found the page gave no way to enter the code.
**Migration/backward-compat notes:** The email's link still works as before. No schema change.


### 2026-09-30 — Phase 0.5: TO members, invites, TO signup on Telegram
**Type:** Schema / New feature
**What changed:** `0007_to_members.sql`: `nexus_to_members`, `nexus_to_invites`, `generate_to_invite_code()`, `accept_to_invite()`, `private.add_to_owner()` trigger, `private.current_to_role()`, `private.current_to_id()` rewritten to resolve via membership, `nexus_bot_link_codes.auth_user_id` added, `nexus_to_telegram_links` dropped (folded into members). Bot gained the account flow and menu (`_router.js`, `_account.js`, `_members.js`, `_session.js`). `js/auth.js`: `fetchMyToProfile` via membership; new `setPassword`, `fetchMyToMembers`, `removeToMember`, `createToInvite`, `acceptToInvite`, `postLoginDestination`, pending-invite helpers. New pages `join.html`, `set-password.html`.
**Why:** Decisions 6–7 (Decision Log 2026-09-30, bot-first direction).
**Migration/backward-compat notes:** 0007 requires 0005 + 0006. Backfills an owner membership for every existing TO, so existing TOs keep full access. Every 0001–0004 RLS policy is unchanged — they call `current_to_id()`, whose signature is unchanged. Must be applied **before** this code deploys.


### 2026-09-30 — Bot Phase 0 moved from WhatsApp to Telegram
**Type:** Schema / New feature / Infra
**What changed:** `api/whatsapp/` replaced by `api/telegram/` (`webhook.js`, `_send.js`, `_supabaseAdmin.js`, `_link.js`). Never-applied `0005_whatsapp_phone_linking.sql`/`0006_wa_sessions.sql` deleted and replaced by `0005_telegram_to_linking.sql` (`nexus_to_telegram_links`, `nexus_bot_link_codes`, `generate_bot_link_code()`) and `0006_bot_sessions.sql` (`nexus_bot_sessions`). `js/auth.js`: `generateWaLinkCode`/`fetchMyWaLinkStatus` → `generateTelegramLinkCode`/`fetchMyTelegramLink`, plus `TELEGRAM_BOT_USERNAME`. `to-dashboard.html`: "Connect WhatsApp" card → "Connect Telegram" with a deep link.
**Why:** See Decision Log 2026-09-30.
**Migration/backward-compat notes:** `0005`/`0006` replaced in place. The old WhatsApp versions turned out to be applied live already (see the 2026-09-30 Session Log correction), so the new `0005` begins by dropping `nexus_tos.whatsapp_phone_e164`, `nexus_wa_link_codes`, `generate_wa_link_code()`, `nexus_wa_sessions` (`if exists`). Nothing in the codebase references them anymore. New `0005`/`0006` still **not applied**. No table/column/policy from `0001`–`0004` altered.


### 2026-09-27 — WhatsApp integration Phase 0: backend layer introduced, TO phone linking
**Type:** New feature / Infra
**What changed:** This repo's first backend code — `package.json` (first ever, adds `@supabase/supabase-js` for the Node runtime) and `/api/whatsapp/` (`webhook.js`, `_supabaseAdmin.js`, `_send.js`, `flows/link.js`), deployed as Vercel serverless functions alongside the existing static pages (no `vercel.json` needed — zero-config detection). `nexus_tos.whatsapp_phone_e164` and `nexus_wa_link_codes` added (`0005_whatsapp_phone_linking.sql`); `nexus_wa_sessions` added (`0006_wa_sessions.sql`, schema-ready but not yet driving any logic). `js/auth.js` gained `generateWaLinkCode`/`fetchMyWaLinkStatus`; `to-dashboard.html` gained a "Connect WhatsApp" quick-action card.
**Why:** First phase of the WhatsApp integration agreed with Moti this session — see the Decision Log entry above and `NEXUSID_WHATSAPP_INTEGRATION_PLAN.md` (new, this session) for the full design of the remaining phases (registration incl. guest entries + self-service captain requests, roster edits, payments, stats queries).
**Migration/backward-compat notes:** `0005`/`0006` are **not yet applied** to the live project — same manual Dashboard SQL Editor paste every prior migration needed. `whatsapp_phone_e164` is deliberately excluded from `nexus_tos`'s existing client `grant update (...)` list from `0001` §14 — only the service-role webhook may ever set it. No existing table/column/RLS policy from `0001`–`0004` was altered.

### 2026-09-06 — Onboarding and search pages retrofitted to canonical tokens
**Type:** Redesign (styling-only, no logic/schema changes)
**What changed:** `to-onboarding.html` and `search.html` rebuilt from Claude Design handoffs onto the corrected canonical tokens (2–4px radii, `#9B1C11` red, Iconify Lucide icons). Same fields, same Supabase calls, same navigation targets as before in both cases — see Session Log entry above for the specific visual additions (onboarding: header border + eyebrow label; search: loading state, hover-lift cards, back-arrow header).
**Why:** Continuing the page-by-page retrofit against `metazone-main/design-system/` tokens, per the 2026-09-06 "adopt METAZONE's canonical design system" decision.
**Migration/backward-compat notes:** None — purely presentational commits (`6cf2783`, `252d4bf`).

### 2026-09-06 — Email-confirmation redirect bugfix; config.toml domain/confirmation corrections
**Type:** Bugfix / Infra correction
**What changed:** `signUpTo()` in `js/auth.js` now passes `options: { emailRedirectTo: `${window.location.origin}/to-onboarding.html` }` — previously passed nothing, so the confirmation link used Supabase's Site URL default (the landing page) and the returning session token was silently dropped since `index.html` doesn't load the Supabase client anymore. `supabase/config.toml`'s `site_url`/`additional_redirect_urls` corrected from a stale `nexus-id-omega.vercel.app` to the real `nexus-id-mot-i-soft.vercel.app`, and `enable_confirmations` corrected from `false` to `true` to match observed production behavior.
**Why:** See Session Log entry above.
**Migration/backward-compat notes:** `config.toml` changes are **not pushed** to the live Supabase project — local documentation only. Do not run `supabase config push` on this file without first reconciling it against the live dashboard's actual Auth settings (rate limits especially) — see the open risk in Session Log/Open Threads.

### 2026-09-06 — TO login + signup merged into one tabbed page; danger-red and radii/icon rules corrected in the design handoff doc
**Type:** Redesign / Docs correction
**What changed:** `to-login.html` rebuilt to include both login (password/OTP) and signup as tabs on one page, from the `NexusID TO Auth.dc.html` handoff; `to-signup.html` deleted. `NEXUSID_DESIGN_HANDOFF.md`'s danger-red value corrected from `#B3261E` to the canonical `#9B1C11` (two places), and its previously-unwritten radii (2–4px cap) and icon (Iconify Lucide only) rules added.
**Why:** See Session Log entry above. The page merge was the requested redesign; the doc corrections close the gap this session's design-system comparison surfaced.
**Migration/backward-compat notes:** No schema/backend changes — same `js/auth.js` functions, no new ones added. `to-signup.html` removed outright (not redirected) since nothing in-repo referenced it.

### 2026-09-06 — Landing page rebuilt for fluid responsiveness, from a Claude Design handoff
**Type:** Redesign / Infra (design-system placement)
**What changed:** `index.html` rebuilt to match a Claude Design canvas handoff exactly: sticky full-bleed BGMI map hero with gradient overlay and parallax-reveal scroll, two-CTA `auto-fit` grid (search/TO-login), redone "How It Works" with large Oswald numerals, all sized via `clamp()` with no discrete breakpoints. Live stats strip and footer removed per the handoff. Added `assets/maps/{erangel,miramar,sanhok,rondo}_mid.jpg`. Separately, the full METAZONE Design System bundle (tokens/components/guidelines) was placed at `metazone-main/design-system/` and installed as the user-level `/metazone-design` Claude Code skill.
**Why:** See Session Log and the 2026-09-06 Decision Log entry above — NexusID now treats METAZONE's actual design-system tokens as its styling source of truth, and this is the first page rebuilt against it.
**Migration/backward-compat notes:** No schema/backend changes. Every other existing NexusID page still uses the old (non-conformant) radius/red/icon pattern — see Open Threads; not retrofitted yet.

### 2026-09-06 — Page flow restructuring: two-button landing, dedicated search page, first real dashboard quick actions
**Type:** New feature / Navigation restructuring
**What changed:** See Session Log entry above for full detail. Summary: `index.html` reduced to two primary CTAs (search / TO login); search UI extracted to new `search.html`; `to-dashboard.html` gained its first two real quick actions (`register.html`, `tournament-new.html`); `js/auth.js` gained `createPlayer`/`createTeam`/`createTournament`.
**Why:** Moti's explicit flow spec: index → {search, TO login} → {onboarding/dashboard} → {create team/player IDs, create tournament}.
**Migration/backward-compat notes:** No schema changes — all three new create-functions insert into tables/columns already present in the applied `0001_init_nexusid_schema.sql`. Not live-browser-tested (see Session Log).

### 2026-09-05 — Migration reviewed before applying: closed 5 real gaps
**Type:** Schema (review pass, before first apply)
**What changed:** Self-reviewed `0001_init_nexusid_schema.sql` before running `db push`. Found and fixed:
1. The 48-hour edit-window RLS policy on `nexus_participations` only checked `logged_by_to_id` and time — it didn't stop a TO from repointing an already-logged row's `player_id`/`match_id` to something else entirely within the window, which would have defeated the whole purpose of the lock.
2. `nexus_tos`/`nexus_players`/`nexus_teams` UPDATE policies allowed rewriting the row's own permanent public code (`to_id`/`nx_id`/`tm_id`) and, on players, the `claimed`/`claimed_at` fields — none of which should be client-editable.
3. `nexus_player_game_accounts` had no UPDATE policy at all — meaning a player's current IGN could never actually change, breaking the IGN-history feature entirely.
4. `nexus_matches` had no UPDATE policy — a typo'd match number/map could never be corrected.
5. The `nexus_player_tournament_summary` view was missing `security_invoker = true` (Supabase's own recommended default for views).
**Fix applied:** Added a new "Column-level UPDATE privileges" section (`REVOKE UPDATE` then `GRANT UPDATE (specific columns)` per table) so RLS controls *which rows* a TO can touch and column grants now separately control *which columns* — the two previously overlapped nowhere, meaning column-level restriction didn't exist at all. Added the two missing UPDATE policies (`nexus_player_game_accounts`, `nexus_matches`), each still scoped to the resource's creating TO. Documented `nexus_ign_links.ended_at` as deliberately unwritten (current IGN is derived by latest `started_at`, not by closing out prior rows) so a future session doesn't "fix" this by casually adding an UPDATE policy.
**Why:** Caught before this schema touched the live database — exactly the kind of gap that's cheap to fix now and expensive once real data and RLS assumptions are load-bearing.
**Migration/backward-compat notes:** No live data affected (still unapplied). Docker wasn't available locally to test-apply against a local Postgres instance first, so this was a manual read-through rather than an executed test — worth a close look at Supabase's dashboard SQL editor logs on first real `db push` in case anything was missed.

### 2026-09-05 — TO auth + registration flow built (first real feature)
**Type:** New feature
**What changed:** Built the actual TO signup/login/registration loop as real pages (not mockups): `to-signup.html` (email+password signup via Supabase Auth), `to-login.html` (password login, plus an OTP-based alternative), `to-onboarding.html` (the real "registration" step — inserts the `nexus_tos` row and shows the generated `TO-` id), and a minimal `to-dashboard.html` that displays the TO's profile and confirms the loop closes. Added `js/auth.js` as the shared Supabase Auth/DB helper module (`signUpTo`, `signInTo`, `signInWithOtp`, `verifyOtp`, `signOut`, `fetchMyToProfile`, `createToProfile`, `requireSession`). Added a link from `index.html` so the flow is reachable from the homepage.
**Why:** First real feature built against the applied schema, to prove the auth model (TO-only Supabase Auth, email sourced from session not re-entered) and the schema's RLS policies actually work together end to end.
**Migration/backward-compat notes:** Pages use the merged design system (parchment/Oswald/Manrope/Lexend Deca) self-contained per page (Tailwind CDN + Google Fonts), matching the pattern in `NEXUS -id design language/`, not the plain CSS approach in the original `css/style.css`. **Not verified in a live browser** — see this session's top-level entry in Section 1 for why.

### 2026-09-05 — Corrected stale Supabase project ref; CLI linked
**Type:** Infra correction
**What changed:** The Supabase project ref recorded since 2026-09-04 (`zghjdrqpnjxuozwrwbjq`) was wrong/stale — the 2026-09-04 session log entry itself had already flagged this as unverified ("verify against whichever Supabase project this session actually wires up"), but it was never corrected. Confirmed via `npx supabase projects list` after logging in: the actual live project is **`jzqmscrmeywckzodgjre`** (name "NEXUS-ID", region eu-west-1), which matches what's already hardcoded in `js/supabase-config.js`. Ran `npx supabase login --token ...` (user's own terminal, token never entered this session) and `npx supabase link --project-ref jzqmscrmeywckzodgjre` — the local repo is now CLI-linked to the correct project. All earlier references to `zghjdrqpnjxuozwrwbjq` in this file have been corrected in place (Section 3 and Section 4), except the original 2026-09-04 session log entry, which is left as-is per this file's append-only rule (it correctly recorded the ambiguity as unresolved at the time).
**Why:** Needed a correct, linked project before `supabase db push` can apply the drafted schema.
**Migration/backward-compat notes:** No live schema was ever applied under the wrong ref, so nothing needs to be undone — this was caught before any migration touched either project.

### 2026-09-05 — Participations moved to per-match granularity; NexusID does not compute standings/points
**Decision:** A tournament is made of multiple matches (rounds). Added `nexus_matches` (belongs to a tournament, has a match number/map/played_at). `nexus_participations` now references `match_id` instead of `tournament_id` directly, and gained a `kills` column. A player's profile-page timeline chip (tournament standing + total kills) is an **aggregate query** across their match participations for that tournament (a `nexus_player_tournament_summary` view sums kills and tracks best placement per player per tournament) — not a stored value. NexusID explicitly does **not** compute or store an overall points table / ranking; Moti confirmed a separate "points table" app will connect via Nexus IDs later and own that logic.
**Reasoning:** The player profile needs match-wise detail (clicking a tournament chip drills into individual match standings), which the original one-row-per-tournament participation model couldn't represent at all. Scope was deliberately kept to "raw trustworthy data source" (per-match placement + kills, evidence, trust tier) rather than guessing at a points/ranking ruleset that a dedicated future app already owns — avoids building throwaway logic.
**Reversible?** Yes — if the points-table app ends up wanting NexusID to store a computed rank, that's an additive column/table later, not a rework of the match ledger itself.
**Migration/schema notes:** `nexus_matches` needs its own RLS (only a tournament's creating TO can add matches to it). `nexus_participations` uniqueness is now `(match_id, player_id)` — one result per player per match. Caught before the schema was applied anywhere, so no live migration needed.
**Supersedes:** N/A — refines the 2026-09-05 schema draft, doesn't reopen the RLS/ID-format decisions from earlier the same day.

### 2026-09-05 — Player identity split from game accounts (cross-game `NX-` IDs)
**Type:** Schema (corrects a mistake made earlier the same session, before it was applied anywhere)
**What changed:** The first schema draft put `game` + `in_game_uid` directly on `nexus_players` with uniqueness on `(game, in_game_uid)` — which meant one `NX-` ID per game, requiring a second ID if the same person played a second title. Corrected by splitting game-specific data into a new `nexus_player_game_accounts` table (`player_id`, `game`, `in_game_uid`, `in_game_name`; the UID-uniqueness constraint now lives here instead). `nexus_players` now holds only cross-game identity (`nx_id`, `real_name`, `claimed`, `created_by_to_id`). `nexus_ign_links` now references `game_account_id` instead of `player_id` + `game`.
**Why:** The first draft silently contradicted a founding roadmap decision (2026-07): *"identity must survive across games/tournaments... encoding game would fragment identity if a player plays multiple titles."* Caught when Moti asked how the system handles multiple games — confirmed tournaments already carry their own `game` field (`nexus_tournaments.game`), which is the correct place for game context to live; players needed the same separation.
**Migration/backward-compat notes:** Caught before this schema was ever applied to the live project, so no live-data migration is needed — this is a same-day in-place correction to the still-unapplied draft, not a follow-up migration.

### 2026-09-05 — Full schema drafted: `supabase/migrations/0001_init_nexusid_schema.sql`
**Type:** Schema (draft, not yet applied)
**What changed:**
- Wrote the first complete Supabase migration covering `nexus_tos`, `nexus_tournaments` (new), `nexus_players`, `nexus_ign_links`, `nexus_teams`, `nexus_team_members` (new, join table), `nexus_participations`.
- Encodes every decision logged this session: UID+game uniqueness on players, many-to-many player↔team via a join table, `TO-`/`NX-`/`TM-` code generation (7-char random suffix, via `generate_nexus_code()` set as a column default), the 48-hour edit lock on participations (enforced in the RLS `UPDATE` policy itself, not just app-side), reserved-but-unused `evidence_screenshot_url`/`evidence_stream_url` columns, and a `vod_verified` trust tier that requires an evidence link via a check constraint.
- RLS: public `SELECT` on every table (players/TOs/teams/tournaments/participations are all public per the roadmap); writes scoped to the authenticated TO's own rows via a `private.current_to_id()` security-definer helper; **no `DELETE` policy exists anywhere** for the `authenticated` role — duplicate-player cleanup and post-48h corrections are intentionally admin/service-role-only actions, not app features (see the open risk note in the 2026-09-05 decision log — don't add a DELETE policy without resolving that first).
**Why:** Closes the "Full Supabase schema migration SQL — not yet written" open thread. Needed before any real page (not just the reference mockups) can be built against actual data.
**Migration/backward-compat notes:**
- **Not yet applied to the live Supabase project** (`jzqmscrmeywckzodgjre` — see correction below) — this is a draft awaiting review. No Supabase CLI project link exists yet in this repo (`supabase/` folder was created fresh for this migration).
- `nexus_tournaments` and `nexus_team_members` are new tables not in the original roadmap — see Section 4 for why they were needed.
- Two RLS assumptions were made without an explicit decision on record and should be confirmed: (1) only a player's *creating* TO can add to their IGN history or edit their core fields — other TOs can reference/add them to tournaments and teams but not edit identity; (2) only a team's *creating* TO can remove a member, though any TO can add one. Flag if either should work differently.

### 2026-09-04 — Infra: Git, Supabase, Vercel linked
**Type:** Infra
**What changed:**
- Git repo initialized locally, pushed to GitHub: `https://github.com/itzunimind-cpu/NEXUS-ID` (main branch).
- Supabase wired: dedicated NexusID project, URL `https://zghjdrqpnjxuozwrwbjq.supabase.co`, publishable key embedded client-side in `js/supabase-config.js` (safe to expose — relies on RLS).
- Vercel project created: `mot-i-soft/nexus-id`, deployed to production at `https://nexus-id-omega.vercel.app`.
**Why:** Bootstrap infra for the NexusID public website (plain HTML/CSS/JS, not a framework app) ahead of building actual pages/auth flows.
**Migration/backward-compat notes:**
- GitHub↔Vercel auto-deploy is NOT yet connected — Vercel's GitHub App lacks repo access on the `itzunimind-cpu` account. Until authorized (GitHub → Settings → Applications → Vercel → grant access to NEXUS-ID repo), deploys must be triggered manually via `vercel --prod` rather than happening automatically on push.
- No RLS policies or tables exist yet on the new Supabase project — schema migration from the roadmap (Section 5) is still an open item (see Section 6).

---

## 4. Function / Naming Directory

**Single source of truth for names.** Prevents a future session from inventing a second name for the same thing (e.g. `nexus_participations` vs `nexusParticipationLog` vs `participation_records`). If it's not in this table, don't assume it exists — check, then add it here once it does.

| Name | Type | Location/File | Purpose | Status |
|---|---|---|---|---|
| `nexus_players` | DB table | Supabase (dedicated NexusID project, ref `jzqmscrmeywckzodgjre` — separate Supabase account from METAZONE; see 2026-09-05 ref correction) | Player identity registry | Applied 2026-09-05 to the live project (`jzqmscrmeywckzodgjre`) via `supabase db push` — `supabase/migrations/0001_init_nexusid_schema.sql` |
| `nexus_tos` | DB table | Supabase | TO identity registry | Applied 2026-09-05 to the live project (`jzqmscrmeywckzodgjre`) |
| `nexus_participations` | DB table | Supabase | Tournament participation ledger, 48h TO edit window enforced via RLS | Applied 2026-09-05 to the live project (`jzqmscrmeywckzodgjre`) |
| `nexus_ign_links` | DB table | Supabase | IGN history linking (core anti-cycling feature), one game-account at a time | Applied 2026-09-05 to the live project (`jzqmscrmeywckzodgjre`) via `supabase db push` — `supabase/migrations/0001_init_nexusid_schema.sql` |
| `nexus_player_game_accounts` | DB table | Supabase | Per-game identity (UID + current IGN) linked under one cross-game `NX-` player. Holds the actual UID-uniqueness anti-duplicate constraint | New table, not in roadmap v1 — split out 2026-09-05 so one `NX-` ID can span multiple games, per the founding "identity survives across games" decision. Applied 2026-09-05 to the live project (`jzqmscrmeywckzodgjre`) |
| `nexus_teams` | DB table | Supabase | Team registry (holds `TM-` IDs, team name) | Applied 2026-09-05 to the live project (`jzqmscrmeywckzodgjre`) |
| `nexus_team_members` | DB table | Supabase | Many-to-many join: which players belong to which teams (a player can belong to several) | New table, not in roadmap v1 — needed to model the many-to-many player↔team decision (2026-09-05). Applied 2026-09-05 to the live project (`jzqmscrmeywckzodgjre`). Gained an UPDATE policy (`left_at` only, team creator only) 2026-09-16 (`0004_team_roster_removal.sql`), applied same day |
| `nexus_tournaments` | DB table | Supabase | A TO's individual tournaments/events (name, game, format, stage, prize_pool, dates, max players) | New table, not in roadmap v1 — the roadmap only listed `nexus_participations` for the ledger, but participations need a real tournament entity to reference rather than a repeated free-text tournament name per row. Applied 2026-09-05 to the live project (`jzqmscrmeywckzodgjre`). `stage` column added and applied 2026-09-16 (`0002_player_profile_additions.sql`). `prize_pool` column added and applied 2026-09-16 (`0003_squad_to_profile_additions.sql`) |
| `nexus_activity_log` | DB table | Supabase | TO-facing activity feed (`to_id`, `tournament_id`, `event_type`, `detail`, `created_at`) powering `to.html`'s Activity tab. Only `tournament_created` is ever actually written (from `createTournament()` in `js/auth.js`) — `registrations_opened`/`registrations_closed`/`results_published` are schema-ready but currently dead, no feature writes them yet | New, 2026-09-16 (`0003_squad_to_profile_additions.sql`) — applied 2026-09-16 to the live project (`jzqmscrmeywckzodgjre`) via manual Dashboard SQL Editor paste |
| `nexus_matches` | DB table | Supabase | Individual matches/rounds within a tournament (match number, map, played_at) | New table, not in roadmap v1 — added 2026-09-05 so player results can be logged per match, not just per tournament. Applied 2026-09-05 to the live project (`jzqmscrmeywckzodgjre`) |
| `nexus_player_tournament_summary` | DB view | Supabase | Aggregates a player's matches within one tournament (total kills, best placement, match count). Does **not** compute overall rank/points — that's a future external app's job. Superseded as `player.html`'s data source by the richer per-match query added 2026-09-16 (see `nexus_match_squad_kills` below) — still exists, currently unused elsewhere | New, 2026-09-05. Not yet applied |
| `nexus_match_squad_kills` | DB view | Supabase | Sum of `kills` per `(match_id, team_id)` — "how many kills did this squad get in this match." Powers the Squad Kills figure on `player.html`'s per-match tournament history | New, 2026-09-16 (`0002_player_profile_additions.sql`) — applied 2026-09-16 to the live project (`jzqmscrmeywckzodgjre`) via manual Dashboard SQL Editor paste |
| `generate_nexus_code(prefix)` | DB function | Supabase | Generates a random `PREFIX-XXXXXXX` code and sets it as the default for `nx_id`/`to_id`/`tm_id` columns | Applied 2026-09-05 to the live project (`jzqmscrmeywckzodgjre`) |
| `private.current_to_id()` | DB function | Supabase | Security-definer helper resolving the calling TO's internal id from their auth session, used inside RLS policies | Applied 2026-09-05 to the live project (`jzqmscrmeywckzodgjre`) |
| `js/auth.js` | JS module | Project root | Shared Supabase Auth/DB helpers: `signUpTo`, `signInTo`, `signInWithOtp`, `verifyOtp`, `signOut`, `getSession`, `requireSession`, `fetchMyToProfile`, `createToProfile`, `createPlayer`, `createTeam`, `createTournament`, `addTeamMember`, `removeTeamMember`, `createMatch`, `updateTournamentStatus`, `logParticipations`, `updateParticipations` | Base helpers built 2026-09-05; `createPlayer`/`createTeam`/`createTournament` added 2026-09-06; `signUpTo` gained `emailRedirectTo` → `/to-onboarding.html` (2026-09-06, cont. 3); `createTournament` gained `stage`/`prize_pool` + activity-log write (2026-09-16); six roster/match/result functions added 2026-09-16 (cont. 3). Not live-tested in browser |
| `to-signup.html` | Page | Project root | ~~TO account creation~~ | **Deprecated 2026-09-06 → merged into `to-login.html`'s SIGN UP tab.** File deleted. |
| `to-login.html` | Page | Project root | TO auth — LOGIN and SIGN UP as tabs on one page (was two separate pages until 2026-09-06). Login supports password or OTP; routes to onboarding or dashboard based on profile completeness. Second page conformant to the canonical design tokens (after `index.html`) | Built 2026-09-05; merged with `to-signup.html` and rebuilt on canonical tokens 2026-09-06 — not live-tested |
| `to-onboarding.html` | Page | Project root | The real TO registration step — inserts `nexus_tos`, generates and displays the `TO-` id. Conformant to canonical design tokens | Built 2026-09-05; rebuilt on canonical tokens 2026-09-06 (cont. 4) — not live-tested |
| `to-dashboard.html` | Page | Project root | TO dashboard — profile card plus two Quick Actions (`register.html`, `tournament-new.html`) added 2026-09-06. Still **not** the full feature-rich dashboard from the reference mockup (tournament list, stats) | Built 2026-09-05 as a proof-of-loop stub; Quick Actions added 2026-09-06; full dashboard (tournament list/stats) still not built |
| `index.html` | Page | Project root | Public landing page — sticky full-bleed BGMI map hero, two CTAs (`search.html`, `to-login.html`) in an auto-fit grid, "How It Works". No search box, no stats strip, no footer (all deliberately dropped). First page conformant to the canonical METAZONE design-system tokens (4px radius cap, Iconify icons) | Rebuilt 2026-09-05 from placeholder stub; reduced to two-button flow 2026-09-06; rebuilt again 2026-09-06 (cont.) for fluid responsiveness per Claude Design handoff — not live-tested |
| `assets/maps/*.jpg` | Static asset | Project root | BGMI map screenshots (erangel/miramar/sanhok/rondo, `_mid` res) for the landing-page hero background; only erangel wired up as default | Added 2026-09-06 |
| `metazone-main/design-system/` | External reference (sibling repo) | `metazone-main/design-system/` (not in this repo) | Canonical METAZONE Design System bundle — tokens (colors/typography/spacing/effects), React components, HTML guideline specimens, UI kits. Source of truth for styling decisions in NexusID going forward | Placed 2026-09-06, uncommitted in that repo |
| `/metazone-design` | Claude Code skill (user-level) | `~/.claude/skills/metazone-design/` (not in this repo) | Same bundle as above, installed as a portable skill invocable from any project on this machine | Installed 2026-09-06 |
| `search.html` | Page | Project root | Registry-wide search (Nexus/TO/Team ID, IGN, or name) over `nexus_players`/`nexus_player_game_accounts`/`nexus_tos`/`nexus_teams`, merged and routed by type. Conformant to canonical design tokens, explicit loading state | Built 2026-09-06; rebuilt on canonical tokens 2026-09-06 (cont. 4); extended to TOs/teams 2026-09-16 — not live-tested |
| `player.html` | Page | Project root | Public player profile (no auth) — identity, claimed status, most-recent game account/team (+N more), 4-stat summary row, expandable per-tournament/day/match history with squad kills and map backgrounds. Search-result destination from `search.html` for player results. Conformant to canonical design tokens as of 2026-09-16 | Built 2026-09-05; live-tested in browser at the time; back-link updated 2026-09-06; fully rebuilt 2026-09-16 from the Player Profile Claude Design handoff onto canonical tokens and per-match data; its `0002_player_profile_additions.sql` dependency is applied — not yet re-tested live |
| `to.html` | Page | Project root | Public TO profile (no auth) — org name, IGN, TO-id, 4-stat row, Hosted (expandable tournament cards with status/stage/champion-heuristic/maps/prize pool) and Activity tabs. Search-result destination from `search.html` for organizer results. Conformant to canonical design tokens as of 2026-09-16 | Built 2026-09-16 (Tailwind/hardcoded-hex); fully rebuilt same day from the TO Profile Claude Design handoff onto canonical tokens; its `0003_squad_to_profile_additions.sql` dependency is applied — not yet live-tested |
| `team.html` | Page | Project root | Public team profile (no auth) — team name, `tm_id`, 4-stat row, Roster/History tabs (History is a real join/leave/rejoin timeline from `nexus_team_members`), expandable per-tournament/day/match history with squad kills. Search-result destination from `search.html` for team results. Conformant to canonical design tokens as of 2026-09-16 | Built 2026-09-16 (Tailwind/hardcoded-hex); fully rebuilt same day from the Squad Profile Claude Design handoff onto canonical tokens — not live-tested |
| `register.html` | Page | Project root | TO-only: create a new Nexus ID (player + first game account) or a new Team. Does not build team rosters — see `team-roster.html` for that | Built 2026-09-06, not live-tested |
| `team-roster.html` | Page | Project root | TO-only: link an existing player into an existing team's roster (any TO can add, per the 2026-09-05 cross-TO decision), remove a member (soft-remove via `left_at`, team creator only), or create a new player inline | Built 2026-09-16 (cont. 3); its `0004_team_roster_removal.sql` dependency is applied — not live-tested |
| `tournament-new.html` | Page | Project root | TO-only: create a tournament shell (name/game/format/stage/prize_pool/dates/max players), then hands off into `tournament-editor.html` | Built 2026-09-06; `stage`/`prize_pool` fields and editor hand-off link added 2026-09-16; not live-tested |
| `tournament-editor.html` | Page | Project root | TO-only, owner-checked: create matches, log squad results in batch (one placement + per-member kills → one `nexus_participations` row per player) or solo results, edit results within the 48h window, and move the tournament through draft/active/concluded status | Built 2026-09-16 (cont. 3), not live-tested |
| `nexus_to_telegram_links` | DB table | Supabase | One Telegram account per TO (`to_id` PK, `telegram_user_id` unique). Owner-only SELECT, written only by the Telegram webhook | New, 2026-09-30 (`0005_telegram_to_linking.sql`) — not yet applied |
| `nexus_bot_link_codes` | DB table | Supabase | Short-lived (15 min) 10-hex-char codes a TO generates on the dashboard to link their Telegram account. Replaces the never-applied `nexus_wa_link_codes` | New, 2026-09-30 (`0005_telegram_to_linking.sql`) — applied 2026-09-30 via manual Dashboard SQL Editor paste |
| `generate_bot_link_code()` | DB function | Supabase | Default for `nexus_bot_link_codes.code`. Replaces the never-applied `generate_wa_link_code()` | New, 2026-09-30 — applied 2026-09-30 via manual Dashboard SQL Editor paste |
| `nexus_bot_sessions` | DB table | Supabase | Bot conversation state keyed by `(channel, external_user_id)`, service-role only. Replaces the never-applied `nexus_wa_sessions` | New, 2026-09-30 (`0006_bot_sessions.sql`) — applied 2026-09-30 via manual Dashboard SQL Editor paste, not yet used by any flow |
| `api/telegram/` | Vercel functions | Project root | Telegram bot backend: `webhook.js` (the only public endpoint, `/api/telegram/webhook`), `_send.js`, `_supabaseAdmin.js`, `_link.js` (TO linking flow) | New, 2026-09-30, replaces `api/whatsapp/` (deleted) — not deployed/tested; bot not yet created |
| `api/whatsapp/`, `nexus_wa_link_codes`, `nexus_wa_sessions`, `nexus_tos.whatsapp_phone_e164`, `generateWaLinkCode`, `fetchMyWaLinkStatus` | — | — | ~~WhatsApp bot Phase 0~~ | **Deprecated 2026-09-30 → renamed to the Telegram equivalents above** (`generateTelegramLinkCode`, `fetchMyTelegramLink` in `js/auth.js`). Old migrations were applied live by manual paste (never deployed as code); dropped by section 0 of the new `0005_telegram_to_linking.sql` once that's pasted |
| `nexus_to_members` | DB table | Supabase | Who can act as a TO: owner/admin, own login each, optional Telegram link. `private.current_to_id()` resolves through it | New, 2026-09-30 (`0007_to_members.sql`) — applied 2026-09-30 via manual Dashboard SQL Editor paste. Supersedes `nexus_to_telegram_links` |
| `nexus_to_invites` | DB table | Supabase | Owner-created single-use 7-day invite codes (admin role) | New, 2026-09-30 (`0007`) — applied 2026-09-30 via manual Dashboard SQL Editor paste |
| `accept_to_invite(invite_code, member_name)` | DB function (RPC) | Supabase | Web invite acceptance, security definer | New, 2026-09-30 (`0007`) — applied 2026-09-30 via manual Dashboard SQL Editor paste |
| `private.current_to_role()` | DB function | Supabase | Caller's role in their TO (owner/admin), used in RLS | New, 2026-09-30 (`0007`) — applied 2026-09-30 via manual Dashboard SQL Editor paste |
| `join.html` | Page | Project root | Accept a TO invite on the web | New, 2026-09-30 — not live-tested |
| `set-password.html` | Page | Project root | Set website password from the bot's one-time link | New, 2026-09-30 — not live-tested |
| `nexus_to_telegram_links` | DB table | — | ~~One Telegram per TO~~ | **Deprecated 2026-09-30 → folded into `nexus_to_members.telegram_user_id`** (dropped by `0007`) |
| `nexus_tournament_registrations` | DB table | Supabase | Tournament applications (named team, status pending/approved/rejected, applicant's Telegram id) | New, 2026-09-30 (`0008`) — applied 2026-09-30 via manual Dashboard SQL Editor paste |
| `nexus_tournament_registration_members` | DB table | Supabase | Players on each application: IGN + BGMI UID always, `player_id` if they have a Nexus ID | New, 2026-09-30 (`0008`) — applied 2026-09-30 via manual Dashboard SQL Editor paste |
| `api/registrations/decide.js` | Vercel function | Project root | Website approve/reject endpoint (Bearer Supabase token), sends the applicant's Telegram message | New, 2026-09-30 — deployed (`9c1b629`), not live-tested |
| `nexus_player_telegram_links` | DB table | Supabase | Which Telegram account a Nexus ID belongs to (bot self-registration). Service role only | New, 2026-09-30 (`0010`) — applied 2026-09-30 via manual Dashboard SQL Editor paste |
| `api/telegram/_players.js` | Vercel helper | Project root | `findMyPlayer`, `registerMyPlayer`, `describeMyPlayer`, `profileUrl` — the applicant's own Nexus ID | New, 2026-09-30 |

<!-- ADD NEW ROWS AS FUNCTIONS/TABLES/COMPONENTS ARE ACTUALLY BUILT -->

**Rule:** when you build something, name it here exactly as it exists in code — not as a paraphrase. When you rename something, don't delete the old row — mark it `Deprecated → renamed to X` so old references in chat history still resolve.

---

## 5. Scope Guardrail Check (run this every session)

Before building or advising, confirm none of these have silently crept into scope. If any answer is "yes" without a corresponding Decision Log entry authorizing it, **stop and flag it to Moti** rather than proceeding.

- [ ] Are we calling OTP verification "KYC" or "verified identity" anywhere?
- [ ] Is there a cheater-flagging / public accusation feature being discussed or built?
- [ ] Is money (entry fees, escrow, prize pools) touching the platform in any way?
- [ ] Are we collecting data beyond phone/email + gameplay stats (e.g. Aadhaar, PAN, address)?
- [ ] Are TOs able to self-report results with no `logged_by` ID attached?
- [ ] Has "Section 6 bigger picture" language (KeSPA, certification body, rating system) leaked into demo copy or MVP task lists?
- [ ] Are phone numbers being stored anywhere unhashed?

If a session is asked to build any "IS NOT" item from the roadmap (Section 2), **do not proceed silently** — surface it as an explicit scope-change request and log it in the Decision Log if approved.

---

## 6. Open Threads (carry-forward TODOs)

Living list — not a full backlog, just the things a next session should know are unresolved so nothing gets silently dropped or silently re-decided.

- [ ] Privacy policy template — not yet drafted
- [x] Full Supabase schema migration SQL — written and **applied** 2026-09-05 (`supabase/migrations/0001_init_nexusid_schema.sql`) to the live project (`jzqmscrmeywckzodgjre`) via `supabase db push`. Verified with `supabase gen types typescript --linked`.
- [ ] Confirm the two RLS assumptions flagged in the 2026-09-05 Change Log entry (IGN/identity edit rights limited to creating TO; team-member removal limited to team's creating TO)
- [ ] Resolve the open risk from the 2026-09-05 decision log: should duplicate-player delete-and-restart be TO-self-service or admin-only? (Currently modeled as admin-only — no DELETE RLS policy exists for TOs.)
- [ ] Pilot tournament logistics — not yet locked
- [x] Demo build (Nexus ID public profile page UI) — `player.html` built and live-tested 2026-09-05, players only
- [ ] TO auth/registration flow (built 2026-09-05) needs live browser testing — click through signup → login → onboarding → dashboard and confirm each step actually works, especially whether Supabase requires email confirmation on signup. Explicitly skipped again this session (Moti: "skip it, build first").
- [ ] Confirm whether GitHub→Vercel auto-deploy is now connected — unverified since the 2026-09-04 note that it wasn't; if the 2026-09-05 push doesn't show up live, this is why
- [ ] Full-featured TO dashboard (tournament list, stats) — Quick Actions (create player/team, create tournament) added 2026-09-06, but no tournament list/stats yet
- [x] TO (`TO-`) and team (`TM-`) public profile pages and search coverage — built 2026-09-16: `to.html`, `team.html` (new), `search.html` now queries `nexus_tos`/`nexus_teams` alongside players. Not live-browser-tested; `to.html`/`team.html` still non-conformant on design tokens (see the 2026-09-16 Session Log entry and the retrofit line below).
- [x] Player registration and team registration pages — built 2026-09-06 as `register.html` (creates a Nexus ID + first game account, or a team). Roster linking gap closed 2026-09-16: `team-roster.html` (new) lets any TO add an existing player to an existing team, and the team's own creator remove one (soft-remove, sets `left_at`).
- [x] Tournament creation page (`tournament-new.html`, built 2026-09-06) creates only the tournament shell — the full editor gap closed 2026-09-16: `tournament-editor.html` (new) adds matches, squad-based batch result logging (placement + per-member kills), solo entries, and a draft/active/concluded status control. VOD proof (`evidence_stream_url`/`evidence_screenshot_url` — already exist as columns, unused by any UI) and bulk/CSV import are still not built.
- [ ] Fix the git-commit handoff-log hook. Root cause hypothesized and repeatedly reconfirmed (not yet fixed): every commit this session that actually needed a write got the same "Edit/Bash/PowerShell denied in this execution context" explanation (`e2fce58`, `6cf2783`, `252d4bf`, and originally `8c352e1`/`940761b` before that explanation existed). Until fixed, **manually update this file after every commit — standing instruction from Moti as of 2026-09-06 ("no matter"), not just a one-off courtesy.** Check `.claude/settings.local.json`'s hook tool-permission scoping to actually fix it.
- [x] Retrofit `to-login.html`, `to-onboarding.html`, `search.html`, `player.html`, `to.html`, `team.html` to canonical tokens — all done as of 2026-09-16 (`to.html`/`team.html` rebuilt same day from their Design handoffs, closing the gap opened earlier that session when they were first built on the old pattern). Still open for: `to-dashboard.html`, `register.html`, `tournament-new.html` — all still use Tailwind `rounded-xl`/`2xl`/`3xl`, `#B3261E`, and raw glyph icons instead of the 2–4px radius scale / `#9B1C11` / Iconify Lucide. Conformant so far: `index.html`, `to-login.html`, `to-onboarding.html`, `search.html`, `player.html`, `to.html`, `team.html` (7 of 10 pages). Not started on the rest — pending Moti's call on scope/timing, or further design handoffs arriving one page at a time as they have been.
- [x] Push `supabase/migrations/0002_player_profile_additions.sql` (adds `nexus_tournaments.stage` + `nexus_match_squad_kills` view) — written and **applied** 2026-09-16, pasted by Moti directly into the Supabase Dashboard SQL Editor (no working `supabase db push`/CLI path in this environment — see the Session Log entry). Still open: `player.html` hasn't been live-tested against real data since.
- [x] Push `supabase/migrations/0003_squad_to_profile_additions.sql` (adds `nexus_tournaments.prize_pool` + the new `nexus_activity_log` table) — written and **applied** 2026-09-16, pasted by Moti directly into the Supabase Dashboard SQL Editor (same route as `0002`). Still open: `team.html`/`to.html` haven't been live-tested against real data since.
- [x] Push `supabase/migrations/0004_team_roster_removal.sql` (adds the `nexus_team_members` UPDATE policy needed for soft-removing a roster member) — written and **applied** 2026-09-16, same manual Dashboard SQL Editor route as `0002`/`0003`. Still open: `team-roster.html`/`tournament-editor.html` haven't been live-tested against real data.
- [ ] Commit `metazone-main/design-system/` in its own repo (currently uncommitted there)
- [x] **Real production address resolved 2026-09-30:** Vercel → Domains lists **`nexus-id-omega.vercel.app`** as the only Production domain. `nexus-id-mot-i-soft.vercel.app` is Vercel's team-scoped alias, which sits behind Vercel's login (hence the 302 below, and Telegram's webhook getting 401 there). This reverses the 2026-09-06 note claiming `mot-i-soft` was production. Switched to omega: `api/telegram/_supabaseAdmin.js` `SITE_URL` fallback, `supabase/config.toml` `site_url` + redirect list, the setWebhook command in the plan doc. Moti to set Supabase Site URL to omega and add omega to Redirect URLs (the live list had only `mot-i-soft` entries).
- [ ] **Check Vercel Deployment Protection** (see the resolved item above — the protected address was the wrong one) on the `nexus-id` project (Settings → Deployment Protection) — `curl` against the production domain (`https://nexus-id-mot-i-soft.vercel.app/`) returns a 302 to `vercel.com/sso-api`/login for every path tried (`/`, `/index.html`, `/to-login.html`), meaning anonymous real users likely cannot reach the site at all right now. Found 2026-09-06 (cont. 3), unconfirmed/unresolved — needs Moti to check the dashboard and decide whether Production should have protection off or preview-only.
- [ ] Reconcile `supabase/config.toml`'s `[auth]` section against the live project's actual dashboard settings before ever running `supabase config push` — known-stale fields found so far: `site_url`/`additional_redirect_urls` (fixed 2026-09-06 to `nexus-id-mot-i-soft.vercel.app`) and `enable_confirmations` (fixed to `true`). Rate limits and everything else in that section are unverified against live values.
- [ ] Post-pilot pitch target: GodLike Esports' "GodLike Warriors" program (fan-appointed City Foreman/Campus Managers who run local grassroots tournaments and scout talent — strong ICP fit for TO-side adoption). Approach after one pilot tournament is fully logged, using it as proof artifact rather than a cold concept pitch. Unconfirmed whether Free Fire-specific Warriors exist vs. general/multi-title — verify before reaching out.
- [ ] **(No longer blocking as of 2026-09-30 — bot moved to Telegram, which needs no business verification. Only relevant if WhatsApp is ever added back as a second channel.)** Moti needs to complete Udyam Registration (found 2026-09-27, blocked the WhatsApp integration's player-self-service registration flow — see that day's Session Log entry). Moti has no registered business, and Meta's WhatsApp Cloud API restricts an unverified app to messaging only 5 manually-added test numbers — real players/TOs outside that list can't reach the bot at all. Udyam is India's free, ~10-15 minute online MSME/sole-proprietorship registration; no company or GST needed. Steps, for whenever Moti picks this back up:
  1. Have Aadhaar number (+ its linked mobile, for OTP) and PAN number ready.
  2. Go to `udyamregistration.gov.in` directly (not a search result — look-alike sites charge a fake fee; the real one is free) → "For New Entrepreneurs who are not Registered yet as MSME."
  3. Enter Aadhaar number + name as on Aadhaar → verify via OTP sent to the linked phone.
  4. Enter PAN number → auto-verifies against tax records.
  5. Fill the business details form: enterprise name (anything, e.g. "Metazone"), type = **Proprietorship**, address (home address is fine), bank account + IFSC, NIC code (search by keyword like "software"/"information technology" and pick the closest match), investment/turnover (small numbers → auto-classifies as "Micro," the most lenient tier).
  6. Submit, verify with one more OTP → get a Udyam Registration Number and downloadable Udyam Certificate (PDF with QR code) immediately.
  7. **After that**, separately: go back to Meta Business Settings → Security Center → Start Verification, and submit that certificate as the business proof document — this is what actually lifts the 5-test-number cap. Not done in the same step as Udyam itself.
- [ ] **Telegram bot go-live setup** (2026-09-30): ~~apply `0005`/`0006`/`0007`~~ — **done 2026-09-30** (Moti pasted all three in order; Phase 0.5 code pushed afterwards, `5686923`). Still to do: ~~create the bot via @BotFather~~ — **done 2026-09-30: @Motisoft_NexusID_bot**, username set in `js/auth.js` and `_router.js`. ~~Vercel env vars~~ — **done 2026-09-30** (`TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, `TELEGRAM_BOT_USERNAME` added; `SUPABASE_SERVICE_ROLE_KEY` already existed from the Sep 5 Vercel↔Supabase integration, pointing at `jzqmscrmeywckzodgjre`). setWebhook first pointed at `mot-i-soft` → Telegram got 401 (Vercel login); re-pointed at `nexus-id-omega.vercel.app` (URL-encoded `url=` param — the plain form got "invalid webhook URL" once, likely a copy/paste artifact). **Bot answered `/start` with the welcome menu, 2026-09-30 — webhook, secret check, Supabase session read all working live.** **Become a TO live-tested by Moti 2026-09-30:** email code → TO created → set-password link opened `set-password.html` on omega (first attempt landed on the mot-i-soft home page until the live Supabase Site URL/Redirect URLs were switched to omega). Dashboard Members card showed Moti as owner, and email + password login worked. Remaining live tests: invites (bot + web) and website Connect Telegram. Exact steps in `NEXUSID_TELEGRAM_INTEGRATION_PLAN.md` → "One-time bot setup". Then live-test linking from the dashboard.
- [x] **Custom email sender (SMTP) connected in Supabase** — done 2026-09-30 by Moti: a dedicated Gmail account via app password (`smtp.gmail.com:587`), email rate limit raised to ~30/hour, `{{ .Token }}` added to the Confirm signup and Magic Link templates (link kept too). Live "Confirm email" setting confirmed **on**; `supabase/config.toml` `[auth.email] enable_confirmations` updated to `true` to match. Found because Supabase's built-in sender only emails the project's own team members, 2/hour. Gmail's own cap is ~500/day — revisit if signups outgrow that.
- [x] **Step 2 live test** — Moti: "all good" (2026-09-30).
- [x] **`0009_optional_player_uid.sql` + `0010_self_registered_players.sql` applied** by Moti 2026-09-30, then pushed.
- [ ] Live-test the applicant Nexus ID flow: apply from a Telegram account with no Nexus ID → IGN + UID → NX ID shown → teammates (some name-only) → approve → "🪪 My Nexus ID".
- [ ] ~~Step 2 live test~~ (2026-09-30, superseded by the line above) — ~~apply `0008`, then push~~ **done: Moti applied `0008`, then `9c1b629` was pushed.** Still to do: live-test with two Telegram accounts: TO creates + opens a tournament, the other finds and applies, TO approves (bot and website).

<!-- Move items here from Session Log "not finished" notes; check off and move to Change Log once done -->

---

## 7. How to use this file (for future Claude sessions)

1. On session start: read `NEXUSID_ROADMAP_v1.md` in full, then read Sections 1–2 of *this* file (last 2–3 entries each), then skim Section 4 in full (it's short and prevents naming drift).
2. Before proposing anything in the roadmap's "IS NOT" list: stop, check Section 5, ask Moti.
3. Before naming anything new (table, function, feature): check Section 4 first.
4. At end of session: add one entry to Section 1 (always), and to Sections 2/3/4 if applicable. Update Section 6 if TODOs were resolved or created.
5. Never delete past entries in Sections 1–3 to "clean up" — this file's value is that it's append-only history. If something is superseded, say so explicitly (`Supersedes: [old entry]`) rather than erasing it.

---

*This file's own version log:*
- **v1 — 2026-07-08** — Initial creation, seeded from Roadmap v1 baseline decisions and schema. No build sessions logged yet.
