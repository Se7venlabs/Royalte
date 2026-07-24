# ATHENA™ Executive Intelligence — Capability Audit & Matrix

**Status:** Discovery Phase — audit only, no implementation authorized here.
**Requested by:** Executive Board (Resolution superseding prior ATHENA deferrals, 2026-07-24)
**Depends on:** `AI_INSIGHTS_ATHENA_BOUNDARY_REVIEW.md`, `AI_INSIGHTS_IMPLEMENTATION_READINESS.md`, `AI_INSIGHTS_PHASE_1_3_IMPLEMENTATION.md`, `AI_INSIGHTS_EXECUTIVE_MORNING_BRIEF_DEFERRAL.md` (all 2026-07-23) — this document does not repeat their findings, it builds on them.

---

## 0. Headline finding

**A large fraction of the new brief's 17 subsystems already exist as real, tested, production-quality code in `api/athena/*` — but that code has never been callable, because it expects an input shape (Mission Control Data API™ envelopes, Sprint 9) that doesn't exist anywhere in the live data flow.** The live flow (CIO → CIM → `runtime-context-mapper.js` → `royalte_workspace_context`) never produces that envelope shape. This is not a "wire up an API call" gap — it's a data-contract translation problem, and it's the single largest risk item in this matrix.

Two other pre-existing findings materially affect scope:
- **Three-source overlap already exists and is unresolved.** `royalteAI`, `executiveBrief`, and `healthReport` are read independently today with overlapping risk/opportunity/priority content (`AI_INSIGHTS_IMPLEMENTATION_READINESS.md` §Outstanding Risks #4). Introducing ATHENA as a *fourth* independent source without resolving this makes the problem worse, not better.
- **§1 (Executive Briefing Hero)'s "comparison against the previous scan" requirement overlaps the explicitly-deferred Executive Morning Brief™**, deferred yesterday on architectural-ownership grounds (belongs to Monitoring Timeline™, which owns change detection). Real change detection exists for only 3 of 9 domains today (Territory, Catalog, YouTube-match) — any comparison claim in the new briefing hero must honestly scope itself to those 3, not imply full coverage. The Board's new resolution says this directive takes precedence over the deferral; flagging so that's a conscious choice, not a silent override.

---

## 1. Capability Matrix

| Capability | State today | Classification | Notes |
|---|---|---|---|
| **`api/athena/` core engine** (risk analysis, opportunity analysis, recommendation generation, confidence model, domain insights, executive analysis) | Real, complete, tested (`tests/athena-engine-test.mjs`), zero production callers | **WIRE** (needs an adapter, not a rewrite) | Logic is sound and matches the brief's §3–8 concepts closely. Blocked entirely on the input-shape mismatch (§0). |
| **Confidence Model™** (`api/athena/confidence.js`) | Real: `HIGH/MEDIUM/LOW/INSUFFICIENT_DATA`, weighted (domains 50%, completeness 30%, monitoring 10%, metrics 10%) | **EXTEND** | Brief's §4 wants a 4-tier %-band model (`Verified 95-100%` / `High 80-94%` / `Moderate 60-79%` / `Verification Required <60%`) with different labels/thresholds than the existing `HIGH(≥75%)/MEDIUM(≥50%)/LOW(≥25%)`. Same algorithm, needs a presentation-layer remap, not new math. |
| **Risk Analysis™** (6 categories: business/rights/catalog/distribution/monitoring/operational) | Real, reads canonical-domain-shaped fields (`data.artistId`, `data.verified`, etc.) | **WIRE** | Field names it expects don't match live CIM field names 1:1 — needs field-mapping in the adapter, not new risk logic. |
| **Opportunity Analysis™** (6 types) | Real | **WIRE** | Same adapter dependency as Risk Analysis. Covers ~10 of the brief's §7 opportunity categories directly; the rest (missing social platform, weak media coverage, etc.) aren't in either system yet — **new development**. |
| **Recommendation Model™ + priority sort** | Real, priority-sorted (`URGENT/HIGH/MEDIUM/LOW/INFORMATIONAL`), every recommendation traces to a `riskId`/`opportunityId` | **WIRE** | This *is* the brief's §3 Executive Priority Engine™, already deterministic (not random), already source-attributed. Priority category names differ slightly (`URGENT` vs. brief's `CRITICAL`) — trivial remap. |
| **Conversation Context™** (`prompts.js`) | Real: `executivePriorities`, `outstandingRisks`, `openOpportunities`, `historicalChanges`, immutable/versioned via `updateContext()` | **WIRE** | Built explicitly as the future chat foundation per its own doc comments. This is most of the data-shaping §12 (Ask ATHENA™) needs — the missing piece is a live LLM call layer + prompt-safety-gated request handler, which doesn't exist yet (**new development**). |
| **Financial Impact classification** | Not in `api/athena/*`. Exists partially as plain-language impact statements inside `executiveBrief`/`royalteAI` templates (deterministic, no dollar figures) | **NEW** (small) | No engine currently classifies into the brief's 8 categories (Revenue Protection, Revenue Opportunity, etc.) or HIGH/MEDIUM/LOW/UNKNOWN magnitude. Straightforward to add as a thin classifier over existing Risk/Opportunity output once wired — not a large build. |
| **AI Insights™ workspace UI** (`public/workspaces/ai-insights.html`, 1,181 lines) | Live, real data (8 domains via `royalte_workspace_context`), honestly labeled (ATHENA branding overclaim already resolved 2026-07-23, commit `d3db0c0`) | **KEEP** the honest-labeling discipline; **RETIRE** its own duplicate client-side severity ranking (`sevRank`, `allObs.sort(...)`) once the real Priority Engine is wired | The page currently reimplements a simplified version of what `recommendations.js` already does server-side. Once wired, this client-side duplicate becomes dead weight. |
| **Executive Briefing Hero (§1)** | Does not exist anywhere (the closest prior attempt, Executive Morning Brief™, was built then fully reverted 2026-07-23) | **NEW**, with a scoping constraint | See §0 — must honestly limit "comparison to previous scan" to the 3 domains with real change detection, or omit the comparison claim for the other 6. |
| **Score Explanations (§8, "Explain My Score")** | No engine produces positive/negative contributor breakdowns for any score today | **NEW** | Must read from the *same* canonical scoring output that generated the displayed score (per the brief's own requirement) — needs per-domain contributor tracking that doesn't exist in the Health Engine or elsewhere yet. This is a real, non-trivial build, not a wiring task. |
| **Executive Forecast™ (§9)** | A narrative "Executive Forecast" card already exists in `ai-insights.html` (3 template bullets), not rule-based projection | **EXTEND** | Foundation/placement exists; the actual "if you complete X, score may move from A to B±range" projection logic is new. |
| **Executive Memory™ (§10)** | Partial: `historicalChanges` exists in Conversation Context™; no persistent cross-session artist memory (goals, dismissed actions, milestones) exists anywhere | **NEW** (engine-side); **WIRE** (for the change-history piece) |  |
| **Executive Timeline™ (§11)** | A "Timeline" concept exists in `governance/ARTIST_PROFILE_CARD_HEALTH_SCHEMA.md` but is explicitly hardcoded/mock, not live | **NEW** — do not reuse the existing mock as a starting point, it sets a bad precedent (fabricated timeline entries) |  |
| **Scenario Simulator™ foundation (§13)** | Does not exist | **NEW** | Brief explicitly scopes this to architecture + placeholder only for Phase 1 — matches "not yet operational" framing already. Low risk to build honestly. |
| **Executive Briefing Modes™ (§14)** | Does not exist; `executiveBrief`/`royalteAI` produce one fixed voice | **NEW** (schema-only for Phase 1, per the brief's own scoping) |  |
| **Recommendation lifecycle states (§15)** | Does not exist. Recommendations are recomputed fresh every render; nothing persists `NEW/REVIEWED/IN_PROGRESS/...` | **NEW** | Requires a persistence layer (likely Supabase) that doesn't exist for this purpose today — real backend work, not a UI task. |
| **Source Attribution (§16)** | Partially real — `recommendations.js` already carries `sourceType`/`sourceId` tracing to a specific Risk/Opportunity; `ai-insights.html` does not currently surface this in the UI | **WIRE** | Data exists once §engine is wired; just needs a UI treatment. |
| **Data Contract (§17)** | No single contract like this exists. Closest are `AthenaReport` (engine output shape) and the informal `royalteAI`/`executiveBrief`/`healthReport` shapes | **EXTEND `AthenaReport`**, do not invent a parallel shape | The brief's proposed contract is close to `AthenaReport` plus the net-new sections above. Building a second, competing contract would recreate the exact three-source-overlap problem flagged in Readiness Assessment #4. |

---

## 2. What's production-ready right now (no new engineering)

- Risk identification (6 categories)
- Opportunity identification (6 types)
- Recommendation generation + deterministic priority sort
- Confidence scoring (algorithm; labels need remapping)
- Conversation Context™ data shaping (not the chat surface itself)
- Prompt-injection safety validation (`validatePromptSafety`)

## 3. What's partially implemented

- Executive Forecast (narrative card exists, no projection logic)
- Financial impact (plain-language only, no classification taxonomy)
- Executive Memory (change history only, no persistent goals/milestones/dismissals)
- Source attribution (data exists in the engine, not surfaced in UI)

## 4. What's unused (built, dormant)

- The entire `api/athena/*` engine — zero production callers, confirmed independently 4+ times through this platform's history including this pass.

## 5. What's missing entirely

- The Mission Control Data API™ → live-data adapter (§0 — the actual blocker)
- Score Explanations engine (contributor tracking)
- Executive Timeline™ (real, not mock)
- Recommendation lifecycle persistence
- Scenario Simulator™
- Briefing Modes™ schema
- Ask ATHENA™'s actual LLM call layer (Conversation Context™ is the input shape, not the chat mechanism)

## 6. What can be wired immediately (no new backend design)

- Risk/Opportunity/Recommendation engine, once the adapter exists
- Confidence model, once labels are remapped
- Source attribution surfaced in the UI

## 7. What requires new development

- The adapter itself (translates live CIM/`executiveBrief` shape → `AthenaReport`'s expected input, or extends the engine to accept the live shape directly — a real architecture decision, not a detail)
- Financial Impact classifier
- Score Explanations
- Executive Timeline™ (real)
- Executive Memory™ persistence
- Recommendation lifecycle persistence
- Ask ATHENA™ chat mechanism
- Scenario Simulator™

---

## 8. Recommended implementation order, if authorized

1. **Resolve the adapter/input-shape question first** — this blocks everything else and is a real architectural decision (extend ATHENA to accept live CIM shape vs. build a translation adapter), not an implementation detail to decide mid-build.
2. **Resolve the three-source overlap** (`royalteAI`/`executiveBrief`/`healthReport`/ATHENA) as one coherent design, per Readiness Assessment #4 — do not add ATHENA as an uncoordinated fourth source.
3. Wire Risk/Opportunity/Recommendation/Confidence (existing engine, once 1–2 are resolved) — retire `ai-insights.html`'s duplicate client-side ranking at the same time.
4. Financial Impact classifier (small, additive).
5. Source attribution UI surfacing (small, additive).
6. Executive Briefing Hero — scoped honestly to real 3-domain change detection (§0).
7. Everything else in §7 (Score Explanations, Memory, Timeline, lifecycle states, Ask ATHENA, Scenario Simulator) — each is independently schedulable, none blocks the others.

No UI implementation has been started. Awaiting Executive Board review of this matrix before proceeding, per the directive.
