# NEXUSID — Design System Handoff
**Document type:** Design system definition
**Covers:** Merging the NexusID concept structure with the METAZONE visual system
**Purpose:** Single source of truth for colour and typography on NexusID, so no future session (including this one, later) drifts back to a dark theme by default.

---

## Why this document exists

The six concept pages in `NEXUS -id design language/` were built as dark-mode mockups (`#0b0b0f` background, Space Grotesk/Inter, green-glow badges). That look is generic esports-dashboard aesthetic — the same pattern METAZONE deliberately moved away from (see `metazone-main/METAZONE_DESIGN_HANDOFF.md`, Phase 1→2).

**Decision (2026-09-05):** NexusID keeps the *structural* patterns from those six concept pages (layout, component types, page flows — see them as reference, not as wireframes to copy field-for-field; they're missing data entities the real pages need). It adopts METAZONE's *colour and typography system* wholesale, for two reasons:

1. NexusID's actual job — a public participation/identity record, explicitly **not** KYC, explicitly not allowed to imply stronger verification than it has — is better served by METAZONE's "documentation, not game" logic than by a dark glowing badge system that performs seriousness instead of being restrained.
2. Shared visual language across MOTiSOFT products (METAZONE, NexusID) so they read as one company's ecosystem.

**Rule going forward: NexusID never uses a dark theme.** If a future session forgets this document exists, the six reference files themselves are now light/parchment — there is no dark-mode version left in this repo to copy from by accident.

---

## Palette

Directly inherited from METAZONE (`METAZONE_DESIGN_HANDOFF.md`, Phase 3 — do not re-derive, that document is the source of truth for *why* these values were chosen):

**Structural:**
| Token | Hex | Use |
|---|---|---|
| Canvas | `#F2EDE4` | Page background (replaces `#0b0b0f`) |
| Panel | `#E8E1D5` | Sidebar/header-adjacent zones, stronger card fills, active pill fills |
| Card | `#EDE7DC` | Default card background |

**Text:**
| Token | Hex | Use |
|---|---|---|
| Heading/hero | `#0C0A07` | Big numbers, Nexus IDs, page titles |
| Body | `#1C1A14` | Standard body text |
| Secondary/dim | `#6B6048` | Meta text, timestamps, muted state (use Tailwind opacity suffixes — `/70`, `/50` — for further dimness tiers instead of inventing new hex values) |

**Borders:** `#C9BFA8` (default, ~40–70% opacity) → `#A89880` (stronger/focused). Never neutral grey — warmth has to run through borders too, or the palette breaks.

**Brand/signal colours (strictly hierarchical — do not use decoratively):**
| Token | Hex | Meaning | NexusID usage |
|---|---|---|---|
| Forest green | `#2C4A2E` | Authority / primary workflow action | Header bar, primary submit buttons (Login, Create Tournament, Publish, Create Nexus ID), focus rings, form field labels |
| Olive | `#4E7C2F` | Active/filled, non-primary | Section eyebrow headers, "Logged"/active status indicators, "All Verified" style reputation text |
| Orange | `#C85E0A` | Rare — action or selection only | Logo square, active nav/tab underline, **Unclaimed** status chip, **Claim This Account** CTA (the one standout action on that screen), VOD-related badges/labels (mirrors METAZONE's own orange "VOD" link convention exactly) |

**Error/danger:** warm-shifted red `#B3261E` — never the cool `#ef4444` red, which would fight the palette's warmth.

**What NOT to do:** no glow effects, no dark backgrounds anywhere in NexusID's UI, no neutral/cool greys for borders or dim text, no using orange for anything that isn't an action or a selected/VOD state.

---

## Typography

Directly inherited from METAZONE's three-font system:

| Font | Role | NexusID usage |
|---|---|---|
| **Oswald** | Condensed, uppercase, high-impact | Nexus/TO IDs shown as headline (e.g. `NX-A7K2M9P` on a profile), page titles, big stat numbers (event/player counts), placement numbers (1st/3rd) |
| **Manrope** | Readable body prose | Player/team/tournament names, body copy, form input values, meta text |
| **Lexend Deca** | Geometric, uppercase, tightly tracked — the UI fabric | Every label, tag, badge, nav link, button label, eyebrow text, and small inline ID references inside list rows (this is METAZONE's own `--font-mono` role — kept the same class name, `.font-mono`, pointing at Lexend Deca instead of JetBrains Mono) |

Google Fonts import for every NexusID page:
```
family=Oswald:wght@400;500;600;700&family=Manrope:wght@400;500;600;700&family=Lexend+Deca:wght@400;500;600;700
```

**Label colour rule (resolves an apparent tension in the METAZONE doc — documenting the resolution so it isn't re-litigated):**
- **Section eyebrow headers** (the small italic/uppercase line above a content block, e.g. "In-Game Names", "Tournament Basics") → **olive** `#4E7C2F` (METAZONE's palette section explicitly calls out "section eyebrows" under olive).
- **Form field labels and small data-annotation labels** (e.g. "In-Game Name (IGN)", "Score", "Events"/"Players" stat labels) → **forest green** `#2C4A2E` (METAZONE's text-hierarchy section: "forest green for ALL CAPS labels... instead of grey").
- **Badges with specific semantic meaning** (VOD Verified, TO Reported, Unclaimed, Player/TO type tags) use the semantic colours above, not eyebrow/label colours.

---

## Component notes specific to NexusID

- **Logo mark**: orange square (`#C85E0A`), white "N" — matches METAZONE's own logo-square-is-orange convention.
- **Trust-tier badges**: "Video Verified" / "VOD Verified" → orange text on parchment/card background (mirrors METAZONE's VOD button styling exactly). "TO Reported" → muted khaki/tan, low emphasis, no fill — it's the lower-trust tier and should visually recede.
- **Primary action buttons** (Login, Create Tournament, Publish Ledger, Create Nexus ID): forest green fill, white text.
- **Secondary/utility buttons** (Edit Details, Save Draft, Manage Players): parchment card fill (`#E8E1D5`), tan border, body-dark text.
- **The one orange CTA per screen**: reserved for the screen's single standout action (Claim This Account, Publish header button) — never more than one competing orange element per screen, or it stops meaning "selected/action."
- **Unclaimed status chip**: orange, on the full profile page — this was already correct in the original concepts, kept as-is under the new palette.
- **Unclaimed status in compact contexts** (search results, roster/team lists): a small red dot (`#B3261E`) instead of the full chip, added 2026-09-05. This is a deliberate second use of the warm-red token beyond error/danger states — it means "needs claiming / needs attention" in dense list contexts where a full chip doesn't fit. Keep these two visually distinct (dot vs. chip) so red doesn't get overloaded into meaning both "error" and "unclaimed" identically in the same view.

---

## Files updated under this system

All six files in `NEXUS -id design language/` were recoloured/retypographed to this spec on 2026-09-05:
1. `01-nexusid-scoreboard-trust-clustered.html`
2. `02-nexusid-public-search-directory.html`
3. `03-nexusid-to-login.html`
4. `04-nexusid-to-dashboard.html`
5. `05-nexusid-player-registration.html`
6. `06-nexusid-tournament-editor.html`

Structure/layout/components/IDs were not changed — only `<style>` blocks, Google Fonts import, and Tailwind colour utility classes. These remain **reference for structure, not literal wireframes** — actual pages will be rebuilt from scratch with the full data model, using this document for colour/type tokens.

---

*Written 2026-09-05. Update this document (not METAZONE's) if NexusID's token usage diverges further from METAZONE's system — but any divergence should be a deliberate, logged decision, not drift.*
