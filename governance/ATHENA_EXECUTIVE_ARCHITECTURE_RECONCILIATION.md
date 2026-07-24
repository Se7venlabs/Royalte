# ATHENA™ Executive Architecture — Reconciliation

**Status:** Discovery Phase — architecture only, no implementation authorized here.
**Requested by:** Executive Board, Phase 0.5 Directive (2026-07-24)
**Depends on:** `ATHENA_EXECUTIVE_INTELLIGENCE_CAPABILITY_MATRIX.md` (this document assumes that audit's findings)
**Scope:** Answers the Board's 8 questions. No UI, no API wiring, no merges.

---

## 1. Executive Intelligence Ownership

Every current source of executive-flavored output, traced to its real constitutional position (verified by reading the actual engine source, not assumed):

| Subsystem | Real position today | Disposition | Why |
|---|---|---|---|
| **Health Engine™** (`api/_lib/health-engine.js`) | Sole authority for Health Score/Grade. Reasons only over Intelligence Reports. Never creates facts, never recommends actions. | **KEEP** | Scoring and recommending are genuinely different concerns. ATHENA should consume `healthScore`/`healthReport` as an input domain, never recompute it. No ownership conflict exists here today — it's already correctly scoped. |
| **Royaltē AI™ Assembler** (`api/_lib/royalte-ai-assembler.js`) | Pure function of 4 domains (identity, publishing, catalog, GMF) → `{observation, nextAction, priority, positiveSignal}`. `generatedBy: 'engine_template'`, deterministic, no LLM. Persisted as `audit_scans.payload.royalteAI`. | **DEPRECATE the standalone output; MERGE the concept** | This is architecturally a narrow, single-card version of what ATHENA's Opportunity/Recommendation engine already does more completely from the same source domains. Once ATHENA is wired to those domains, `royalteAI`'s `observation`/`nextAction` becomes a strict subset of `athenaReport.recommendations`. Keep the assembler *module* only if some workspace needs its exact narrow shape during migration; retire it once every consumer reads from ATHENA. |
| **Executive Brief Engine™** (`api/_lib/executive-brief-engine.js`) | `HealthReport → ExecutiveBrief`. Explicitly "owns language... does NOT own presentation... never invents intelligence." Produces its own `priorityActions[]`/`strengths[]`/`opportunities[]`/`risks[]`, independently of Royaltē AI or ATHENA. | **MERGE — re-scope, don't retire** | Its actual skill (deterministic, constitutional language templating) is genuinely valuable and shouldn't be thrown away. The problem is *what it templates from*: today it independently derives priority/risk/opportunity content from the HealthReport alone. Re-scope it to render language *from `athenaReport`* instead of computing its own parallel `priorityActions[]`. Same engine, new upstream input — this eliminates the duplicate-ownership problem without discarding the language layer. |
| **ATHENA™ engine** (`api/athena/*`) | Real, tested, complete risk/opportunity/recommendation/confidence/analysis logic. Zero production callers. | **KEEP — becomes the single owner** | Per Board Principles 1–4. This is the target, not a candidate for replacement. |
| **AI Insights™ workspace** (`public/workspaces/ai-insights.html`) | UI/presentation layer. Currently computes its own `sevRank`/priority sort client-side from raw domain data as a fallback when `executiveBrief.priorityActions` is absent. Honestly labeled since 2026-07-23 (does not claim ATHENA performed analysis it didn't). | **KEEP the workspace; RETIRE its local ranking logic** | Per Board Principle 6 ("Mission Control displays executive intelligence. ATHENA generates executive intelligence") and Principle 7 ("No UI component shall independently invent recommendations"). The honest-labeling discipline already established here should extend to every other workspace touched in later phases. |
| **Mission Control Runtime Context** (`public/js/runtime-context-mapper.js`, `royalte_workspace_context` schema v1.1) | The real, live, single canonical shape every workspace already depends on. Explicit invariants: "Never invents values... Preserves null when data is legitimately unavailable... Workspaces receive one stable shape." | **KEEP — this is already the thing the Board is asking for, for domain data.** **EXTEND** to carry ATHENA's output too. | This file is the actual "Mission Control Runtime Context" named in the Board's proposed pipeline. It already does correctly, for domain data, what the Board wants done for executive intelligence — it just doesn't carry `athenaReport` yet. |
| **"Recommendation engine(s)"** (generic, per-workspace duplicate logic) | Confirmed at least once (`ai-insights.html`'s `sevRank`); other workspaces (Health Intelligence™, Publishing Intelligence™, etc.) were not individually re-audited in this pass and should be checked for the same pattern before Phase 3. | **RETIRE, wherever found** | Every instance is a violation of Board Principle 7 by definition. |

**Net effect:** this is not 7 systems merging into 1 from scratch. It's 2 systems (Royaltē AI™, Executive Brief Engine's own prioritization) folding into ATHENA, 1 system (Health Engine™) staying exactly where it correctly already is, 1 system (Runtime Context) getting one new field, and an unknown number of per-workspace client-side duplicates getting deleted.

---

## 2. Single Executive Pipeline

The Board's proposed flow is directionally correct. One refinement, grounded in how the *existing* constitutional engines actually run (verified: Health Engine™ and Executive Brief Engine™ both run server-side, once, at scan-persist time — not invoked live per page load):

```
Evidence Books™
    ↓
Domain Assemblers (Identity, Publishing, Catalog, GMF, Media, Verification, ...)
    ↓
Intelligence Report (Phase 6)
    ↓
Health Engine™ (Phase 7) ──────────────┐
    ↓ HealthReport                     │ (Royaltē AI™ Assembler position,
    ↓                                  │  being folded into ATHENA — see §1)
Runtime Context Adapter (NEW, §3)      │
    ↓                                  │
ATHENA™ Engine (api/athena/*)  ◀───────┘
    ↓ AthenaReport (risk, opportunity, recommendations, confidence,
    ↓               executive analysis, conversation context)
    ↓
Executive Brief Engine™ (re-scoped, §1) — renders AthenaReport into
    ↓                                    constitutional language, doesn't
    ↓                                    compute priority itself anymore
Mission Control Runtime Context Mapper (EXTENDED — adds `athenaReport`
    ↓                                    + rendered brief to the existing
    ↓                                    schema v1.1 shape)
royalte_workspace_context (unchanged shape otherwise — every existing
    ↓                        workspace contract keeps working)
Mission Control UI (workspaces read `ctx.athenaReport.*`, stop
    ↓                 computing their own rankings)
Artist
```

**The one deliberate deviation from the Board's literal diagram:** there is no single monolithic "Executive Intelligence API" sitting between ATHENA and the UI for the deterministic content (briefing, priorities, risks, opportunities, confidence, forecasts). That content is computed **once per scan**, server-side, at the same pipeline stage every other constitutional engine already runs at — it flows to the browser exactly the way `healthScore` and `monitoringIntelligence` already do today, through the existing Runtime Context payload. Introducing a live network call for content that's already deterministic and scan-scoped would add latency and a new failure mode for zero benefit.

A real, live "Executive Intelligence API" **is** needed for exactly one thing: **Ask ATHENA™** (§7), because conversational queries are inherently not precomputable. That's a narrow, separate endpoint, not the backbone of the whole pipeline. This distinction is what makes Phase 4 and Phase 5 (§8) cleanly independent of each other.

---

## 3. Data Contract Reconciliation

**Recommendation: C — a lightweight adapter layer. Not A, not B.**

The two shapes in question, both verified directly:
- `royalte_workspace_context` (Runtime Context): live, tested, the actual dependency of every Mission Control workspace today.
- Mission Control Data API™ envelopes (`{apiVersion, status, data}`, keyed by `identity`/`musicRights`/`catalog`/`distribution`/`monitoring`/`systemOperations`): the shape `api/athena/*` was built against. The Sprint 9 layer that was supposed to produce this shape in production was never built out — nothing generates these envelopes today.

| Option | Advantages | Disadvantages | Migration cost | Long-term maintainability |
|---|---|---|---|---|
| **A — Adapt Runtime Context into ATHENA's envelope shape** (change `runtime-context-mapper.js` to emit envelopes) | None found | Breaks the contract every existing workspace already depends on (`ctx.identity`, `ctx.publishing`, etc.) for the benefit of a shape nothing else uses. Highest blast radius of any option. | High — touches every workspace's read path | Poor — permanently couples the platform's one proven-stable schema to a dormant engine's input assumptions |
| **B — Adapt ATHENA to Runtime Context** (rewrite `extractData()` and field lookups inside `risk-analysis.js`, `opportunities.js`, etc. to read `ctx.*` directly) | Removes the envelope indirection entirely | Requires editing and re-certifying every module of a "Board-locked v1.0" engine (`ATHENA_ENGINE.md`: "No breaking changes to output shape without a new Board brief and version bump") for a wiring problem, not a logic problem. Also permanently welds ATHENA to this one context shape, closing the door on ever feeding it a differently-shaped input (e.g. a future batch/offline analysis mode). | Medium-High — every ATHENA module touched, full test suite re-run, version bump | Medium — works, but couples ATHENA's internals to one specific caller's shape |
| **C — Lightweight adapter layer** (new, small module that reads `royalte_workspace_context` and produces envelope-shaped `apiResponses` for `ATHENA_ENGINE.analyze()`) | Zero changes to the tested, locked ATHENA engine. Zero changes to Runtime Context or any of its 8+ existing dependents. Satisfies ATHENA's own constitutional constraint literally — it still consumes only through envelopes, they're just now real and populated from live data instead of a dormant API. Isolated, independently testable, independently revertable. | One more small file to maintain | **Low** — new file, no edits to existing tested code | **High** — the adapter is the only thing that needs to change if either side's shape evolves later; both proven systems stay exactly as they are |

**Recommendation in one sentence:** build `api/athena/runtime-context-adapter.js` (or equivalent) that takes a `royalte_workspace_context` object and produces the `apiResponses` map `ATHENA_ENGINE.analyze()` already expects — e.g. `{ identity: { apiVersion: 'v1', status: ctx.identity ? 'SUCCESS' : 'NOT_FOUND', data: ctx.identity || {} }, ... }` for each of the six expected keys, field-mapped to their real Runtime Context equivalents (`ctx.identity`, `ctx.publishing`/`ctx.publishingIntelligence`, `ctx.catalogIntelligence`, a distribution-equivalent field, `ctx.monitoringIntelligence`, and a systemOperations-equivalent). This is genuinely small, and it's the only option that touches zero already-shipped, already-tested code.

---

## 4. Recommendation Ownership

No duplicate ownership, per Board Principle 2–5:

| Function | Single owner |
|---|---|
| Executive priorities | ATHENA (`recommendations.js` → `prioritizeRecommendations`) |
| Risk analysis | ATHENA (`risk-analysis.js`) |
| Opportunity analysis | ATHENA (`opportunities.js`) |
| Confidence scoring | ATHENA (`confidence.js`) — note: this is *recommendation* confidence, a distinct concept from any internal confidence the Health Engine™ uses to compute a score. No conflict; different question being answered. |
| Forecasts | ATHENA (net-new capability, built on existing engine output — see Capability Matrix §1) |
| Health summaries | **Health Engine™ remains sole owner of the score itself.** ATHENA's `executiveAnalysis.healthSummary` is an *interpretation* of the Health Engine's output (via `buildHealthSummary()`), never a recomputation. This must stay one-directional — ATHENA reads the score, never derives its own. |
| Briefings | ATHENA determines *what* the briefing says (content, priority, evidence). Executive Brief Engine™ (re-scoped, §1) determines *how* it's phrased (constitutional language templating). One content owner, one language renderer — not two competing content sources. |

---

## 5. Executive Memory

**Recommendation: a dedicated memory layer — not Runtime Context, not Monitoring Timeline, not bolted onto ATHENA's own storage.**

Reasoning:
- **Runtime Context is regenerated fresh every scan** (`generatedAt: new Date().toISOString()` on every call to `buildWorkspaceRuntimeContext`). It has no persistence model at all — it's not a place things can be "remembered" across scans, only where the current scan's data lives.
- **Monitoring Timeline™ owns change *events*** (score deltas, new releases, etc.) — a different concept from artist-stated goals, dismissed recommendations, or completion history. Overloading it with memory would blur an already-carefully-scoped domain (per `AI_INSIGHTS_EXECUTIVE_MORNING_BRIEF_DEFERRAL.md`'s own architectural-ownership reasoning — the same discipline should apply here).
- **ATHENA itself should stay a pure function** (`analyze(apiResponses) → AthenaReport`, verified: no I/O, no persistence anywhere in `api/athena/*` today). Giving it its own storage would break that purity and its "identical input → identical output" guarantee.

Concretely: a new, small, artist-scoped table (e.g. `athena_executive_memory`, keyed by the platform's existing canonical artist identifier — `royalteId`/Artist Profile ID, matching the Canonical Identity Object™ pattern already used elsewhere) holding: prior recommendation IDs + their lifecycle state (§15 of the original brief), dismissal reasons, completion timestamps, artist-provided goals. Row-level security scoped to the owning artist, matching this platform's existing RLS pattern (`auth.uid()`-scoped policies already used for other tables, per `CLAUDE.md`). ATHENA's adapter (§3) reads from this table as one more input when building `apiResponses`/context — it does not own or write to it directly; the write path is a normal authenticated API action (recommendation dismissed/completed), same pattern as any other user action in this platform.

This preserves artist isolation exactly the way every other artist-scoped table in this system already does — no new isolation mechanism needs to be invented.

---

## 6. Change Detection — Graceful Degradation by Design

Confirmed: real change detection exists for exactly 3 of 9 domains today (Territory/Global Music Footprint, Catalog, and a raw YouTube-match signal within Media), per `ARTIST_PROFILE_CARD_MONITORING_SCHEMA.md` §4.8a, independently reconfirmed in the capability audit.

Design: the Runtime Context Adapter (§3) attaches a `domainCoverage` map alongside each domain's data — `{ [domainKey]: 'MEASURED' | 'NOT_YET_MEASURED' }`, sourced from `ctx.monitoringIntelligence`'s already-real per-event `changeType` data (today only Territory/Catalog/YouTube-match will ever produce real entries; everything else naturally has none). ATHENA's briefing/comparison logic (§1 of the original brief, "comparison against the previous available scan when supported") **must check this map before making any comparison claim for a domain** — `NOT_YET_MEASURED` domains are silently omitted from comparison language, never stated as "no change" (that would be a false claim of absence, not an honest absence-of-measurement).

This requires zero ATHENA redesign as Monitoring Timeline™ adds real detection to more domains — the map just grows more `MEASURED` entries over time, and the same conditional logic automatically starts including them. This is the mechanism, not a policy statement — it's implementable exactly as described in Phase 2 (§8).

---

## 7. Future Conversation Model

**Recommendation: yes, Conversation Context™ remains the conversational foundation.** It's already well-designed for this: immutable, versioned (`updateContext()` produces a new version rather than mutating), and scoped to exactly the right content (`executivePriorities`, `outstandingRisks`, `openOpportunities`, `historicalChanges`) — evidence-grounded inputs, not raw provider data, matching the constitutional constraint that ATHENA "must never query raw provider evidence directly when canonical resolved intelligence is available."

How Ask ATHENA™ should consume it (architecture only, per the directive — no conversational UI, no model call implemented here):

1. Conversation Context™ is computed once per scan, alongside the rest of `AthenaReport` (§2's pipeline), and flows into Runtime Context like everything else — no separate computation path.
2. A new, narrow, live endpoint (the one genuine "Executive Intelligence API" surface, §2) accepts: the artist's current Conversation Context™ (already computed, not recomputed per-question) + the live user question.
3. The endpoint validates the question with `validatePromptSafety()` (already built in `api/athena/validate.js` — reusable as-is).
4. The endpoint constructs a grounding prompt from Conversation Context™'s fields only — never raw domain data, preserving the same evidence boundary the rest of ATHENA already enforces.
5. Model invocation is a separate, later architectural decision (a governance doc referencing "Smart Consensus™" as the intended model-routing layer exists on an **unmerged** branch, `feat/athena-architecture-lock` — it should not be treated as binding until it's actually ratified on `main`; this reconciliation does not assume it).
6. The response carries source attribution back to the specific `Risk`/`Opportunity`/`Recommendation` objects in Conversation Context™ that grounded it, consistent with Board Principle 8 ("All executive advice must originate from canonical intelligence").

---

## 8. Migration Plan

Five phases, each independently deployable (no phase requires a later phase to be safe or complete on its own):

**Phase 1 — Immediate Wiring**
Build the Runtime Context Adapter (§3, Option C). Run `ATHENA_ENGINE.analyze()` server-side at scan-persist time, the same pipeline stage Health Engine™/Executive Brief Engine™/Royaltē AI™ Assembler already run at. Write the result to `audit_scans.payload.athenaReport`. Extend `runtime-context-mapper.js` to surface it as `ctx.athenaReport`. **No UI reads this yet** — purely additive, zero risk to any live page. Deployable alone; ships dark.

**Phase 2 — Runtime Adapter Hardening**
Extend adapter coverage to all six expected domains (not just an initial subset). Add the `domainCoverage` graceful-degradation map (§6). Add adapter-specific tests mirroring the rigor of `tests/athena-engine-test.mjs`. Still no UI reads it — this phase is about making the Phase 1 pipe trustworthy before anything depends on it.

**Phase 3 — Unified Recommendation Engine**
First user-visible change. Retire duplicate client-side ranking logic (`ai-insights.html`'s `sevRank` and any equivalent found in other workspaces, per §1's open item). Wire AI Insights™ (and any other workspace currently showing recommendations) to read `ctx.athenaReport.recommendations` directly. Re-scope Executive Brief Engine™ to render from `athenaReport` instead of computing its own `priorityActions` (§1, §4). Deprecate the standalone `royalteAI` card once its consumer(s) are migrated. This is a data-source swap on existing UI, not a redesign.

**Phase 4 — Executive Briefing**
Build the Executive Briefing Hero (§1 of the original implementation brief) from `athenaReport.executiveAnalysis`, honestly scoped via the Phase 2 `domainCoverage` map so "compared to last scan" claims never overreach into the 6 domains without real change detection. New UI surface, but built on data that's already flowing and already tested (Phases 1–3).

**Phase 5 — Ask ATHENA™**
Build the live conversational endpoint (§7) and its minimal chat UI. Last, because it's the only phase requiring genuinely new runtime infrastructure (a live endpoint, a model-invocation decision, production-grade prompt-safety enforcement) rather than restructuring of already-built, already-flowing data.

---

## Summary for Board Review

- §1: 2 systems fold into ATHENA (Royaltē AI™, Executive Brief Engine's own prioritization); Health Engine™ stays exactly where it is; Runtime Context gains one field; per-workspace duplicate ranking logic gets deleted.
- §2: Board's proposed flow confirmed correct with one refinement — deterministic content flows through the existing scan-time pipeline (no new live API for it); only Ask ATHENA™ needs a real live endpoint.
- §3: Recommend Option C (lightweight adapter). Lowest cost, zero risk to either proven system, easiest to maintain or revert.
- §4: No duplicate ownership remains under this design.
- §5: New dedicated, artist-scoped memory table. Isolation via the existing `royalteId`/RLS pattern already used elsewhere.
- §6: Graceful degradation is a data-driven flag (`domainCoverage`), not a policy note — it automatically improves as Monitoring Timeline™ covers more domains.
- §7: Conversation Context™ confirmed as the right foundation. Architecture defined; no model call decided or implemented.
- §8: 5 phases, each independently deployable, Phases 1–2 fully invisible/zero-risk, Phase 3 the first real (but narrow) UI change.

No UI implementation, no API wiring, no merges performed. Awaiting Executive Board review.
