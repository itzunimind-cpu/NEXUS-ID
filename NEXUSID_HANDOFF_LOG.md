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
| `nexus_team_members` | DB table | Supabase | Many-to-many join: which players belong to which teams (a player can belong to several) | New table, not in roadmap v1 — needed to model the many-to-many player↔team decision (2026-09-05). Applied 2026-09-05 to the live project (`jzqmscrmeywckzodgjre`) |
| `nexus_tournaments` | DB table | Supabase | A TO's individual tournaments/events (name, game, format, dates, max players) | New table, not in roadmap v1 — the roadmap only listed `nexus_participations` for the ledger, but participations need a real tournament entity to reference rather than a repeated free-text tournament name per row. Applied 2026-09-05 to the live project (`jzqmscrmeywckzodgjre`) |
| `nexus_matches` | DB table | Supabase | Individual matches/rounds within a tournament (match number, map, played_at) | New table, not in roadmap v1 — added 2026-09-05 so player results can be logged per match, not just per tournament. Applied 2026-09-05 to the live project (`jzqmscrmeywckzodgjre`) |
| `nexus_player_tournament_summary` | DB view | Supabase | Aggregates a player's matches within one tournament (total kills, best placement, match count) for the profile timeline chip. Does **not** compute overall rank/points — that's a future external app's job | New, 2026-09-05. Not yet applied |
| `generate_nexus_code(prefix)` | DB function | Supabase | Generates a random `PREFIX-XXXXXXX` code and sets it as the default for `nx_id`/`to_id`/`tm_id` columns | Applied 2026-09-05 to the live project (`jzqmscrmeywckzodgjre`) |
| `private.current_to_id()` | DB function | Supabase | Security-definer helper resolving the calling TO's internal id from their auth session, used inside RLS policies | Applied 2026-09-05 to the live project (`jzqmscrmeywckzodgjre`) |
| `js/auth.js` | JS module | Project root | Shared Supabase Auth/DB helpers: `signUpTo`, `signInTo`, `signInWithOtp`, `verifyOtp`, `signOut`, `getSession`, `requireSession`, `fetchMyToProfile`, `createToProfile`, `createPlayer`, `createTeam`, `createTournament` | Base helpers built 2026-09-05; `createPlayer`/`createTeam`/`createTournament` added 2026-09-06; `signUpTo` gained `emailRedirectTo` → `/to-onboarding.html` (2026-09-06, cont. 3). Not live-tested in browser |
| `to-signup.html` | Page | Project root | ~~TO account creation~~ | **Deprecated 2026-09-06 → merged into `to-login.html`'s SIGN UP tab.** File deleted. |
| `to-login.html` | Page | Project root | TO auth — LOGIN and SIGN UP as tabs on one page (was two separate pages until 2026-09-06). Login supports password or OTP; routes to onboarding or dashboard based on profile completeness. Second page conformant to the canonical design tokens (after `index.html`) | Built 2026-09-05; merged with `to-signup.html` and rebuilt on canonical tokens 2026-09-06 — not live-tested |
| `to-onboarding.html` | Page | Project root | The real TO registration step — inserts `nexus_tos`, generates and displays the `TO-` id | Built 2026-09-05, not live-tested |
| `to-dashboard.html` | Page | Project root | TO dashboard — profile card plus two Quick Actions (`register.html`, `tournament-new.html`) added 2026-09-06. Still **not** the full feature-rich dashboard from the reference mockup (tournament list, stats) | Built 2026-09-05 as a proof-of-loop stub; Quick Actions added 2026-09-06; full dashboard (tournament list/stats) still not built |
| `index.html` | Page | Project root | Public landing page — sticky full-bleed BGMI map hero, two CTAs (`search.html`, `to-login.html`) in an auto-fit grid, "How It Works". No search box, no stats strip, no footer (all deliberately dropped). First page conformant to the canonical METAZONE design-system tokens (4px radius cap, Iconify icons) | Rebuilt 2026-09-05 from placeholder stub; reduced to two-button flow 2026-09-06; rebuilt again 2026-09-06 (cont.) for fluid responsiveness per Claude Design handoff — not live-tested |
| `assets/maps/*.jpg` | Static asset | Project root | BGMI map screenshots (erangel/miramar/sanhok/rondo, `_mid` res) for the landing-page hero background; only erangel wired up as default | Added 2026-09-06 |
| `metazone-main/design-system/` | External reference (sibling repo) | `metazone-main/design-system/` (not in this repo) | Canonical METAZONE Design System bundle — tokens (colors/typography/spacing/effects), React components, HTML guideline specimens, UI kits. Source of truth for styling decisions in NexusID going forward | Placed 2026-09-06, uncommitted in that repo |
| `/metazone-design` | Claude Code skill (user-level) | `~/.claude/skills/metazone-design/` (not in this repo) | Same bundle as above, installed as a portable skill invocable from any project on this machine | Installed 2026-09-06 |
| `search.html` | Page | Project root | Dedicated player search (Nexus ID or IGN) over `nexus_players`/`nexus_player_game_accounts` — moved off `index.html` | Built 2026-09-06, not live-tested |
| `player.html` | Page | Project root | Public player profile (no auth) — identity, claimed status, in-game accounts, tournament history via `nexus_player_tournament_summary`. Search-result destination from `search.html` (was `index.html` before 2026-09-06). Covers players only, not TOs/teams | Built 2026-09-05; live-tested in browser at the time; back-link updated 2026-09-06, not re-tested live |
| `register.html` | Page | Project root | TO-only: create a new Nexus ID (player + first game account) or a new Team. Does not build team rosters | Built 2026-09-06, not live-tested |
| `tournament-new.html` | Page | Project root | TO-only: create a tournament shell (name/game/format/dates/max players). No roster/match/result editing yet | Built 2026-09-06, not live-tested |

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
- [ ] TO (`TO-`) and team (`TM-`) public profile pages and search coverage — `search.html` (formerly `index.html`) and `player.html` currently only cover players
- [x] Player registration and team registration pages — built 2026-09-06 as `register.html` (creates a Nexus ID + first game account, or a team). Still open: team rosters (`nexus_team_members`) have no UI, and there's no "add existing player to team" flow
- [ ] Tournament creation page (`tournament-new.html`, built 2026-09-06) creates only the tournament shell — the full editor (roster, per-match results, VOD proof, publish/draft) from the reference mockup is still not built
- [ ] Fix the git-commit handoff-log hook. Root cause now hypothesized (not yet confirmed/fixed): on commit `e2fce58` (2026-09-06) the hook explained for the first time that its own Edit/Write tools are denied in its execution context — meaning it can read/reason but not write, which would explain why it "succeeds" only on no-op cases (unrelated `curl` commands, the manual log-backfill commit `aec6104`) and silently fails whenever a real write is needed (`8c352e1`, `940761b`, and `e2fce58` before manual backfill). Check `.claude/settings.local.json`'s hook tool-permission scoping next.
- [x] Retrofit `to-login.html` to canonical tokens — done 2026-09-06 as part of the login/signup merge (see Change Log). Still open for: `search.html`, `to-onboarding.html`, `to-dashboard.html`, `register.html`, `tournament-new.html`, `player.html` — all still use Tailwind `rounded-xl`/`2xl`/`3xl`, `#B3261E`, and raw glyph icons instead of the 2–4px radius scale / `#9B1C11` / Iconify Lucide. `index.html` and `to-login.html` are the only two conformant pages so far. Not started on the rest — pending Moti's call on scope/timing.
- [ ] Commit `metazone-main/design-system/` in its own repo (currently uncommitted there)
- [ ] **Check Vercel Deployment Protection** on the `nexus-id` project (Settings → Deployment Protection) — `curl` against the production domain (`https://nexus-id-mot-i-soft.vercel.app/`) returns a 302 to `vercel.com/sso-api`/login for every path tried (`/`, `/index.html`, `/to-login.html`), meaning anonymous real users likely cannot reach the site at all right now. Found 2026-09-06 (cont. 3), unconfirmed/unresolved — needs Moti to check the dashboard and decide whether Production should have protection off or preview-only.
- [ ] Reconcile `supabase/config.toml`'s `[auth]` section against the live project's actual dashboard settings before ever running `supabase config push` — known-stale fields found so far: `site_url`/`additional_redirect_urls` (fixed 2026-09-06 to `nexus-id-mot-i-soft.vercel.app`) and `enable_confirmations` (fixed to `true`). Rate limits and everything else in that section are unverified against live values.
- [ ] Post-pilot pitch target: GodLike Esports' "GodLike Warriors" program (fan-appointed City Foreman/Campus Managers who run local grassroots tournaments and scout talent — strong ICP fit for TO-side adoption). Approach after one pilot tournament is fully logged, using it as proof artifact rather than a cold concept pitch. Unconfirmed whether Free Fire-specific Warriors exist vs. general/multi-title — verify before reaching out.

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
