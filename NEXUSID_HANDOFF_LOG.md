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
| `nexus_players` | DB table | Supabase (dedicated NexusID project, ref `zghjdrqpnjxuozwrwbjq` — separate Supabase account from METAZONE) | Player identity registry | Defined in roadmap, not yet migrated |
| `nexus_tos` | DB table | Supabase | TO identity registry | Defined in roadmap, not yet migrated |
| `nexus_participations` | DB table | Supabase | Tournament participation ledger | Defined in roadmap, not yet migrated |
| `nexus_ign_links` | DB table | Supabase | IGN history linking (core anti-cycling feature) | Defined in roadmap, not yet migrated |

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
- [ ] Full Supabase schema migration SQL — not yet written
- [ ] Pilot tournament logistics — not yet locked
- [ ] Demo build (Nexus ID public profile page UI) — not yet started
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
