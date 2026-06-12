# FOUNDER NOTES

**Owner:** Darryl West (Founder, Se7ven Labs LLC)
**Status:** **APPEND-ONLY.** Existing entries are never edited or deleted. Corrections are appended as new entries that explicitly supersede the prior one.
**Effective:** 2026-06-11

Personal record from the founder. The Constitution governs principles; the Roadmap governs scope; the Changelog governs merges. This file governs *the founder's mind* — the ideas before they were briefs, the pivots before they were decisions, the breakthroughs before they were locked, the observations that don't fit any other register.

Entries are organised by category. Within each category, entries are listed **oldest first** so the trajectory of thinking is preserved in natural order.

---

## Ideas

Ideas — original or borrowed — that the founder wants to remember, regardless of whether they are yet on any roadmap.

| Date | Idea | Context |
|---|---|---|
| 2026-05 (early) | "Music Backend Intelligence" as a category name | The competitive landscape had "royalty audit" tools but nothing that framed the entire artist-side backend as one health surface. |
| 2026-05 | The artist sees outcomes, not internals | Whatever the engine computes, the artist must only ever see *what the outcome means for them*. No raw provider field names. No internal jargon. No "the MLC reports …" — always "your publishing coverage is …". |
| 2026-06 | Intelligence generates once, consumes everywhere | The Constitution principle that prevents the platform from drifting into N inconsistent copies of the same logic across consumer surfaces. |
| 2026-06 | Constitutional separation (knowledge ≠ execution ≠ scoring ≠ presentation) | The doctrine the founder will keep returning to whenever scope ambiguity appears in a brief. |
| 2026-06 | Append-only governance bound to every phase merge | The pattern that makes the *audit trail itself* a constitutional invariant. |

---

## Pivots

Moments where the platform's direction changed, with a note on why.

| Date | Pivot | Reason |
|---|---|---|
| 2026-05-08 → ongoing | From "audit script" → engine + persistence | First Vercel-function deploy made the move from one-off audits to a persisted, idempotent engine. |
| 2026-05-29 | From "royalty audit" → "Music Backend Intelligence™" | Category framing that gave the platform its own language and removed dependence on incumbent vocabulary. |
| 2026-05-30 | From "audit PDF" → "Royaltē Review" | Brief 014 promoted the artist-emailed PDF to V2 framing. |
| 2026-06-07 | From "match-everything" identity → Canonical Identity Architecture | Apple = canonical, Spotify = verification, all enrichment independent. |
| 2026-06-11 (mid-Phase 5) | From "Intelligence Engine with hardcoded rules (PR #129)" → "Rule Library + generic engine (PR #130 + #131)" | Constitutional separation; the original Phase 5 violated it; Board reframed mid-sprint. |
| 2026-06-11 (post-Phase 7) | "Phase 7 = Engine Wiring" → "Phase 7 = Royaltē Health Engine™" | Board directive after Phase 6.5 reframed the next phase as quantification before wiring. |

---

## Architecture

Architectural decisions that crystallised through founder reflection, before they were briefed.

| Date | Decision | Note |
|---|---|---|
| 2026-06-09 | The Constitution must be a single living document with in-document revision history | Prior versions are not preserved as separate files. The repository contains exactly one constitutional authority. |
| 2026-06-09 | Identity Graph is the only owner of artist identity | Scan engine reads, never writes. |
| 2026-06-09 | Canonical Payload V2 — 12 objects every product consumes | Distribution folded into globalFootprint; providers under verification.providers.*; AI Insight generated once. |
| 2026-06-10 | Provider isolation — one adapter per provider, no downstream module reads provider field names | First instance: MLC adapter. |
| 2026-06-11 | Royaltē Engineering Stack™ — seven layers, single-responsibility per layer | Constitution v1.3 § 8B. |
| 2026-06-11 | Append-only governance binding every phase merge | `governance/AGENT_MEMORY.md` § 9. |
| 2026-06-11 | Fixtures are immutable; versioned forward; never overwritten | Phase 6.5 rule; constitutional precedent for evolving golden references. |

---

## Breakthroughs

Moments of clarity that unlocked otherwise-blocked work.

| Date | Breakthrough | Note |
|---|---|---|
| 2026-06-10 | MLC OAuth two-step flow proven end-to-end | Phase 1 connectivity unblocked Phase 2. PRs #123 / #124 / #125. |
| 2026-06-11 | The polarity gap was visible from a fixture, not a code review | Phase 6.5 fixtures exposed that Phase 5's positive INFO rules never reached `strengths[]` under the Phase 6 contract. Board chose Option A (add `polarity: 'positive'`), and the gap closed cleanly. The fixture library proved its value before its first quarter of use. |
| 2026-06-11 | Tests 11 & 13 expose the difference between "literally HIGH = -20" and "publishingScore < 80" | The Health Engine's deduction values are locked at exactly 20; a single HIGH observation reduces from 100 to 80, not below it. The interpretation note in the Phase 7 PR is the kind of small-but-load-bearing discipline the founder wants the platform to carry forward. |

---

## Observations

Patterns the founder has noticed in operating the platform.

| Date | Observation |
|---|---|
| 2026-05 onwards | Briefs that lock language explicitly produce better artefacts than briefs that describe intent. |
| 2026-06 | The Boot Sequence's 5 questions catch about 80 % of constitutional violations before the first edit. |
| 2026-06 | "Flag, don't assume" is the single most valuable instruction the founder has given an AI executive. |
| 2026-06 | The strongest evidence that the platform is on the right track is that *constraints multiply work* — every constitutional rule simultaneously prevents drift, accelerates new work, and makes the system more defensible. |
| 2026-06-11 | Phase 7's success suggests every future quantification surface should follow the same pattern: pure deterministic scoring of an upstream-frozen artefact with Board-locked constants. |

---

## Vision

Where the founder wants Se7ven Labs LLC and Royaltē™ to be at successive horizons.

### Beta launch — June 1, 2026

- Royaltē Scan™ V1 live with full intelligence wiring (Spotify · Apple Music · MusicBrainz · Discogs · Listen Notes · YouTube · MLC Public API · MLC Bulk Data Feed).
- Royaltē Mission Control™ available to scanned artists.
- Royaltē Review PDF emailed on completion.
- Royaltē Health Score™ visible on every surface that displays platform health.

### 12-month horizon

- Royaltē Monitoring™ subscription operational across all 8 sources.
- Royaltē Executive Brief™ delivered to onboarded artists at the cadence each subscriber selects.
- Publishing Intelligence™ extended beyond MLC to SOCAN / ASCAP / BMI / CISAC.
- Royaltē Revenue Intelligence™ first surface ships (Phase 8 or later).

### Multi-year horizon

- Royaltē Identity Graph™ becomes the canonical reference for music-rights identity across the industry; licensed under enterprise + OEM terms (see `LICENSING.md`).
- Se7ven Labs AI Operating System™ generalised so additional products beyond Royaltē can run on the same Executive Runtime.
- Royaltē Health Engine™ becomes a category-defining scorecard.

---

## Company history

Milestones worth remembering at a corporate-history level.

| Date | Milestone |
|---|---|
| 2026-05-08 | First Vercel-function production deploy. |
| 2026-05-13 | First branch-protection gate (`Run pipeline test`) on `main`. |
| 2026-05-14 | Royaltē Audit™ scoring lock (V1 audit display). |
| 2026-05-29 | Music Backend Intelligence™ positioning locked. Royaltē Health Score model finalised (Brief 012a). |
| 2026-05-30 | Royaltē Review (V2 PDF) shipped (Brief 014). |
| 2026-06-04 | Royaltē Mission Control™ V1 freeze + Royaltē Signal Meter™ lock. |
| 2026-06-07 | Canonical Identity Architecture locked. |
| 2026-06-09 | Royaltē Master Constitution v1.0 ratified. Governance Directive issued. Identity Graph separation enforced. Canonical Payload V2 ratified. Royaltē Boot Sequence™ established. |
| 2026-06-10 | Phase 1 MLC connectivity proven (PRs #123 / #124 / #125). Phase 2 Publishing Adapter merged (PR #126). Phase 3 Identity Graph merged (PR #127). Phase 4 CIO Assembler merged (PR #128). Scan V1 design freeze (PR #122). |
| 2026-06-11 | Phase 5 Rule Library merged (PR #130). Phase 6 Intelligence Engine merged + tagged `intelligence-engine-v1.0` (PR #131). Constitution v1.3 ratified — Engineering Stack canonicalised (PR #132). Governance Layer established (PRs #133 / #134). Phase 6.5 Golden Fixture Library + Phase 5 polarity amendment merged (PR #135). Phase 7 Health Engine merged (PR #137). Phase 7.5 IP Vault drafted (this PR). |

---

*Authored by Darryl West, Founder, Se7ven Labs LLC. Internal corporate record; not a legal filing.*
