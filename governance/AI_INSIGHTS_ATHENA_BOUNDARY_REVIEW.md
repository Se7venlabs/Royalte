# AI Insights™ — ATHENA™ Boundary Review

**Status:** Discovery Phase — no code changes. Investigation only.
**Requested by:** Executive Board
**Date:** 2026-07-23

---

## The Board's proposed boundary

| AI Insights™ | ATHENA™ |
|---|---|
| Deterministic | Conversational |
| Evidence-based | Strategic advisor |
| Explainable | Executive coaching |
| Reproducible | Forecasting |
| Generated from canonical intelligence | Planning |
| Dashboard intelligence | Reasoning, recommendations |

This is a sound, defensible architectural boundary. The finding below is not that the boundary is wrong — it's that **the real code doesn't currently implement either side of it the way the branding on screen claims.**

---

## What ATHENA™ actually is, today

`api/athena/` is real, substantial code (`index.js` exporting `createAthenaEngine()`/`ATHENA_ENGINE`, plus `analysis.js`, `risk-analysis.js`, `opportunities.js`, `recommendations.js`, `prompts.js`, `validate.js`, `confidence.js`, `insights.js`). It takes a bundle of Mission Control Data API™ response envelopes and produces a frozen `AthenaReport` — architecturally, this is exactly the kind of interpretive, synthesis-layer engine the Board's boundary describes for ATHENA™.

**It has zero production callers.** Confirmed independently three separate times across this platform's history per `governance/MISSION_CONTROL_CONSTITUTIONAL_ARCHITECTURE.md:172` (Repository Review PR #368, a Media Intelligence trace, and a Health Intelligence trace), and reconfirmed in this discovery pass: no `import`/`require` of anything under `api/athena/` exists anywhere outside that directory itself; no API route serves it; no frontend fetch calls it. It is part of the same dormant "Sprint 1-12 Constitutional Stack" already documented elsewhere in this platform's governance history as real code with no live wiring.

## What AI Insights™ actually is, today

Per the Architecture and Evidence Audits: a page that assembles output from `royalteAI` (a pure template-selection function, `generatedBy: 'engine_template'`) and `executiveBrief` (a similarly deterministic template engine), plus real counts from the Health Engine, plus some hardcoded filler text. **This matches the Board's "AI Insights™" column of the boundary almost exactly** — deterministic, evidence-based (mostly), reproducible, generated from canonical intelligence. The one real violation of the "AI Insights™" side of the boundary is the hardcoded template filler (`WEAK_MODULE_MSGS`, `IMPACT_STATEMENTS`) — text that isn't derived from evidence at all, deterministic or otherwise.

## The actual boundary violation

**It is not that AI Insights™ contains ATHENA-like conversational/coaching content it shouldn't (it doesn't — everything on the page is template-generated, not conversational).** The violation is presentational: the page's hero explicitly claims ATHENA™ performed the analysis —

- Eyebrow: *"Executive Intelligence Workspace · ATHENA™"*
- Body copy: *"ATHENA™ has analyzed your complete music business."*
- *"ATHENA has identified 3 critical issues"*
- A "Living Intelligence Core" orb labeled `ATHENA™` in the hero SVG
- An action-detail panel header labeled `"ATHENA"` (reusing CSS classes shared with Publishing Intelligence™'s identically-branded panel)

None of this text is produced by `api/athena/*`. Every fact it's paired with comes from `royalteAI`/`healthReport`/`executiveBrief` — real, but explicitly self-declared as `engine_template` output, not ATHENA. This is the same pattern `governance/MISSION_CONTROL_CONSTITUTIONAL_ARCHITECTURE.md:172` already flagged for Backend Intelligence™'s drill-down, Media Intelligence™'s "ATHENA Media Insights™" card, and Health Intelligence™'s "ATHENA Monitoring™" card — described there as *"a forward-reference to this constitutional position, not evidence the real engine is wired."* AI Insights™ is the same pattern, on the page with by far the heaviest ATHENA branding of any workspace in the platform (a full hero section, an animated "Intelligence Core," and a named orb).

## Constitutional risk

This is worth stating plainly: an artist reading "ATHENA™ has analyzed your complete music business" is being told, in the platform's own executive voice, that a specific named system did something it did not do. Every other evidence-first discipline this platform enforces (never claim a provider confirms availability when it only returned evidence, never invent a KPI card's data, never claim a growth trend with no historical mechanism) exists to prevent exactly this class of overclaim. The AI Insights™ hero is currently the platform's largest instance of it.

## Recommendation (discovery only — not implemented here)

Two honest paths, not decided in this document:

1. **Stop naming ATHENA™ on this page until the real engine is wired.** Rename the hero/orb/panel to something accurate to what's actually running (e.g. "Royaltē Intelligence Summary" or similar) — the underlying content stays exactly as evidence-backed as it already is, only the branding claim changes.
2. **Wire the real `api/athena/` engine in** and let the branding become true. This is a materially larger undertaking (the engine currently expects Mission Control Data API™ envelopes that don't exist in the live data flow — see Implementation Readiness Assessment) and should be scoped and authorized separately, not assumed as part of an AI Insights™ rebuild.

Either path resolves the violation; continuing to ship the current branding against dormant code does not.
