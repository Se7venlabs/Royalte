# AI Insights™ — Duplicate Intelligence Audit

**Status:** Discovery Phase — no code changes. Investigation only.
**Requested by:** Executive Board
**Date:** 2026-07-23

---

## Confirmed duplications

| Metric on AI Insights™ | Location | Also independently rendered at | Verdict |
|---|---|---|---|
| Health Score (0–100) | "Confidence Score™" tile, `[data-ai-metric-score]` — `healthIntelligence.score`/`healthScore.overallScore` | `health-intelligence.html`, `.hi-score-ring-num`, same `hi.score` field | **True duplicate, and mislabeled.** Same number, different name, same source. Recommend: remove, or if retained, explicitly labeled as a restatement of the real Health Score rather than a new "Confidence" concept |
| Health Grade (A+–F) | "Evidence Coverage™" tile — `healthReport.grade`/`healthScore.overallGrade` | `health-intelligence.html`, status pill beside the score ring | **True duplicate, and mislabeled** — same reasoning as above |
| `identityScore`/`publishingScore`/`catalogScore`/`footprintScore` | Used only as `>40`/`<40` gates for synthetic fill text, never directly displayed as numbers | `health-intelligence.html`, breakdown columns (numerically displayed for all 5 + monitoring); `monitoring-timeline.html`, same 4 scores plotted per-scan | **Partial duplicate** — the underlying scores are real and duplicated in concept (the same category weights drive both), but AI Insights™ doesn't display the numbers directly, only gates canned text on them. Recommend resolving alongside the fill-text removal already recommended in the Evidence/Question/Decision audits |
| `backendScore` | Not directly displayed (excluded from the score-gating array) | `backend-intelligence.html`, numeric ring display; `health-intelligence.html`, breakdown | Not currently duplicated on this page — no action needed |
| Risk/opportunity counts | "Open Risks™"/"Opportunities" tiles + headline "N critical issues" | No separate literal *count* found elsewhere by direct search, but the *underlying issue objects* independently surface on Identity Intelligence™'s own "Identity Risks™" KPI (`ctx.identity.issues`) | **Internal duplicate** (the same count appears twice on this single page — headline and tile) plus a **conceptual overlap** with Identity Intelligence™'s own risk display (different framing, same underlying evidence pool) |

## Why the duplication exists (root cause, not just observation)

AI Insights™ was built to read `healthReport`/`healthIntelligence` directly as its primary data source, then layered `royalteAI` and `executiveBrief` on top for narrative framing. Health Intelligence™ was built independently, reading the same Health Engine output for its own, correctly-labeled display. Neither page was designed with awareness of what number the other was already showing under a different name — this is an artifact of Health Intelligence™ and AI Insights™ both being early, direct consumers of the Health Engine, built before this platform's current "each domain owns its own display, others reference it, never duplicate it" discipline was established (the discipline visible in every workspace built or rebuilt since the Global Music Footprint™ audit series).

## Recommendation

**Should the duplicated tiles remain? No, not in their current form.** The Board's own stated preference — "AI Insights™ should synthesize intelligence, not duplicate dashboards" — is violated exactly by "Confidence Score™" and "Evidence Coverage™": same number, different label, no added synthesis. Two honest paths forward, either is defensible, neither is decided here (discovery only):

1. **Remove both tiles entirely.** AI Insights™ references the Health Score by name in a sentence ("your Health Score is 72") where useful, but does not give it its own competing tile.
2. **Replace both tiles with something Health Intelligence™ doesn't already show** — e.g., a genuinely cross-domain synthesis metric no single workspace currently owns (see KPI Discovery for real, evidence-backed candidates).

The risk-count duplication (headline vs. tile, same page) is a smaller, purely internal issue — straightforward to consolidate into one display regardless of which broader redesign path is chosen.
