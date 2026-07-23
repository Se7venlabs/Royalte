# AI Insights™ — KPI Discovery

**Status:** Discovery Phase — no code changes, no implementation. Investigation and proposal only.
**Requested by:** Executive Board
**Date:** 2026-07-23
**Method:** Following the Media Intelligence™ KPI Discovery process. Every card below is built only from evidence already confirmed real in the Architecture/Evidence Audits, complies with Constitution §4.21 (Card Name, Mission Statement, Primary Executive Business Question, Executive Decision Enabled, Business Value, Evidence Used, Canonical Provider(s), Why this deserves dashboard space, Future Expansion Opportunities), and was explicitly checked against the Duplicate Intelligence Audit — nothing proposed here restates a number another workspace already owns.

---

## Retained from the current page (real, evidence-backed, non-duplicate)

### Top Action Today™
**Mission Statement:** Surface the single highest-priority action across every domain, not a list.
**Primary Executive Business Question:** "What's the one thing I should do first?"
**Executive Decision Enabled:** Decide today's first action without reading a full list.
**Business Value:** Reduces the existing Executive Actions™ grid (currently up to 4 cards, sometimes padded with fabricated fill text) to its single most defensible entry — the top-ranked real risk or opportunity, full stop.
**Evidence Used:** `healthReport.risks`/`.opportunities`, `identityIntelligence.issues`, `publishingIntelligence.issues` — the same real pool Executive Actions™ already draws from, minus the synthetic padding.
**Canonical Provider(s):** Health Engine, Identity Intelligence™, Publishing Intelligence™.
**Why it deserves dashboard space:** This is the genuine synthesis role the Board wants AI Insights™ to play — picking the single most important fact across domains, something no single-domain workspace can do for itself.
**Future Expansion Opportunities:** Extend the ranking pool to Media Intelligence™ and Recording Intelligence™ once wired in (see Dependency Map).

### Priority Roadmap™ (retained, unchanged in substance)
**Mission Statement:** Show the full ordered remediation queue.
**Primary Executive Business Question:** "In what order should I act, beyond just the first item?"
**Executive Decision Enabled:** Plan a multi-step remediation sequence.
**Business Value:** Already real, already sourced correctly from `executiveBrief.priorityActions`.
**Evidence Used:** `executiveBrief.priorityActions`.
**Canonical Provider(s):** Executive Brief Engine (`api/_lib/executive-brief-engine.js`).
**Why it deserves dashboard space:** Confirmed real and non-duplicative in the audits above — no changes recommended beyond removing the fallback path to the same fabricated-fill pool Top Action Today™ also removes.
**Future Expansion Opportunities:** None identified — this card is already correctly scoped.

### Executive Forecast™ narrative (retained, unchanged in substance)
**Mission Statement:** Give a plain-language read of where the business stands this session.
**Primary Executive Business Question:** "What's the story behind the numbers right now?"
**Executive Decision Enabled:** Decide whether today's session needs deep investigation or a quick check-in.
**Business Value:** Confirmed real, deterministic, sourced from `royalteAI`/`executiveBrief`/`healthReport`/`globalMusicFootprint` — no fabrication found.
**Evidence Used:** As above.
**Canonical Provider(s):** Royaltē AI™ Assembler, Executive Brief Engine, Health Engine, Global Music Footprint™.
**Why it deserves dashboard space:** Real narrative synthesis across domains — exactly AI Insights™'s stated purpose.
**Future Expansion Opportunities:** Extend to reference Media Intelligence™ once wired.

---

## New candidate — genuine cross-domain synthesis, not built by any single workspace today

### Intelligence Coverage Snapshot™
**Mission Statement:** Show, at a glance, which of the platform's intelligence domains have real evidence at all for this artist, and which have open issues.
**Primary Executive Business Question:** "Which parts of my business intelligence are complete, and which need attention?"
**Executive Decision Enabled:** Decide which domain workspace to open next.
**Business Value:** This is the one genuinely new synthesis metric identified in this discovery pass — a meta-view across all domains that no single-domain workspace can produce for itself, and unlike the removed "Confidence Score™"/"Evidence Coverage™" tiles, it doesn't restate a number Health Intelligence™ already owns.
**Evidence Used:** Presence/absence of real evidence per domain (`ctx.identity`, `ctx.publishing`, `ctx.catalog`, `ctx.globalFootprint`, `ctx.verification` [Backend], `ctx.media`, `ctx.recording`) plus each domain's own open-issue count where available.
**Canonical Provider(s):** Every CIM domain object, read directly (CIM-native, not the legacy CimAdapter bridge — see Dependency Map recommendation).
**Why it deserves dashboard space:** Directly replaces the two mislabeled duplicate tiles with something that earns its place: real, non-duplicate, decision-enabling.
**Future Expansion Opportunities:** Natural home for Media Intelligence™ and Recording Intelligence™ once genuinely consumed by this page — no redesign needed, just two more rows.

---

## Explicitly rejected — should not exist

| Rejected candidate | Why |
|---|---|
| "Confidence Score™" / "Evidence Coverage™" (as currently implemented) | Confirmed exact duplicates of the Health Score/Grade, mislabeled. Superseded by Intelligence Coverage Snapshot™ above, which is genuinely new instead of a renamed duplicate. |
| Executive Actions™ synthetic fill cards | No real evidence backs the displayed text — confirmed hardcoded template filler in the Evidence Audit. |
| Living Intelligence Core orbital animation | Confirmed purely decorative, zero data binding — not a KPI candidate at all, a visual-design question for a later phase, not this discovery. |
| Any "ATHENA-generated" insight | The real ATHENA™ engine is dormant with zero production callers (see ATHENA Boundary Review) — any card claiming ATHENA authorship today would be a fabrication of *authorship*, not just data. |
| A single combined "Business Health" mega-score | Considered and rejected — would re-create the exact duplication problem being removed, just at a coarser grain. Health Intelligence™ already owns the authoritative combined score. |

---

## Future KPI ideas requiring additional infrastructure (not built now)

| Future card | Requires |
|---|---|
| Trend/momentum narrative ("things are improving/declining") | A real historical snapshot mechanism — does not exist for any domain today, the same gap class already documented for Global Music Footprint™'s Coverage Timeline™ and Media Intelligence™'s growth metrics. |
| Genuine ATHENA-authored strategic recommendation | Requires the real `api/athena/` engine to be wired into a live data path — a separate, larger, not-yet-authorized initiative (see Implementation Readiness Assessment). |
| Media Intelligence™ / Recording Intelligence™-informed synthesis | Requires wiring those two domains into this page's dependency chain (Dependency Map already flags this as the top near-term gap). |
