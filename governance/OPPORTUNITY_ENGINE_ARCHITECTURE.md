# Executive Opportunity Engine™ Architecture

Phase 4B — Executive Actions™. The constitutional reference for the Executive Opportunity Engine as it exists on this branch — Royaltē's first capability that answers "what should I do first?" rather than just "what could I do?"

---

## 1. Governing principle

> ATHENA™ recommends. The Opportunity Engine™ prioritizes. The Playbook Engine™ executes. The Evidence Engine™ verifies.

Every Executive Opportunity Score™ is deterministic and reproducible — identical inputs always produce identical output. Rankings are never a black box: every score is fully decomposable into its named factor contributions (Ranking Transparency™), and every recommendation's rank is explainable from canonical data, never generated ad hoc by a presentation layer.

## 2. Scope decision (Board-ratified)

This phase is the deliberate activation of the **Recommendation Ranking Engine™**, a component named across the Board's Phase 3E Final Architectural Directive but explicitly reserved at the time — the user confirmed directly that it should not be built without a second real consumer beyond Ask ATHENA (`governance/LESSONS_LEARNED_PHASE_3E.md` §3.2). Phase 4A's Playbook Actions are that second consumer. Building the Executive Opportunity Engine™ now is the foreshadowed next step, not new scope creep.

Explicitly out of scope, unchanged from every prior phase: Executive Decision Engine™, Tool Invocation Framework™, automation, AI agents, workflow orchestration, external integrations all remain reserved.

## 3. Architecture — five Board-named components, mapped to concrete files

| Board name | File | Responsibility |
|---|---|---|
| Executive Opportunity Engine™ | `api/_lib/opportunity-engine.js` | Pure orchestrator: given an artist's rankable Playbook Actions + their Definitions, computes scores, assigns bands, flags Quick Wins, ranks with deterministic tie-breaking, and returns the full Roadmap. No I/O. |
| Opportunity Scoring Engine™ | `api/_lib/opportunity-scoring-engine.js` | Pure `computeOpportunityScore(action, definition)` → `{score, factorBreakdown}`. No I/O, identical input → identical output — same constitutional discipline as `api/_lib/health-engine.js`. |
| Opportunity Registry™ (Board term) | `api/_lib/opportunity-store.js` | The persisted current-state store. Deliberately **not** named "registry" in code — in this codebase "Registry" means a `Map` of self-registering static content (Playbook Registry, Capability Registry); this is per-artist DB state, mutated on every recompute, the opposite of that. Named to match `playbook-action-store.js`'s own grammar; "Opportunity Registry™" is Board-facing vocabulary only. Never-throws `{ok,...}` contract, DI'd Supabase client. |
| Opportunity History Store™ | same file, table `opportunity_score_history` | Append-only, written unconditionally on every `computeRoadmap` call — no "was this change big enough" heuristic, matching `playbook_action_history`'s own unconditional `recordHistory()` precedent. |
| Opportunity Timeline Integration™ | *(not a separate file)* | Satisfied by the store's own write path — identical to how Phase 4A's ECR7 resolved "Automatic Executive Timeline™" as a read-time label function (`describeScoreHistoryEvent()`) over an already-written history table, not a new module. |

Additional pure module: `api/_lib/opportunity-explain.js` — `explainOpportunity(scoredAction, definition)`. **Canonical Ownership split, deliberate**: "why does this recommendation exist at all" is answered by a Playbook Definition's own `explainRecommendation(rawInputs)` (Phase 4A ECR8) — unchanged, not re-derived here. This module answers the different question Phase 4B introduces: "why is it ranked where it is." Both are canonical, non-UI-generated, ATHENA-Advisor-ready data.

Scoring constants live in `api/schema/opportunity.js`, not inline in the engine — matches `api/schema/health.js` → `api/_lib/health-engine.js`'s own schema/engine split exactly.

## 4. Scoring formula

```js
SCORE_WEIGHTS = {
  revenuePotential:   0.30,  // metrics.estimatedRevenueImpact
  businessImpact:     0.20,  // metrics.businessImpact
  evidenceConfidence: 0.20,  // playbook_actions.evidence_confidence (real, per-artist)
  difficulty:         0.15,  // metrics.difficulty, inverted -- LOW difficulty scores higher
  estimatedTime:      0.10,  // metrics.estimatedMinutes, bucketed + inverted -- faster scores higher
  priorityWeight:     0.05,  // metrics.priority, editorial nudge
} // sums to 1.0, asserted by tests/opportunity-engine-test.mjs -- same discipline as CATEGORY_WEIGHTS
```

Final score = `round(weightedSum × 100)`, clamped to `[0, 100]`. Every factor's `rawValue`, `normalizedScore`, `weight`, and `contribution` are captured in `factor_breakdown` (Ranking Transparency™, Objective 12) — the system can always answer "what factors caused this rank."

**Executive Roadmap™ banding** (`BAND_THRESHOLDS`): `DO_NOW` (70–100), `DO_NEXT` (40–69), `DO_LATER` (0–39).

**Quick Wins™** (`QUICK_WIN_CRITERIA`) are a strict AND-filter — `estimatedRevenueImpact: HIGH`, `evidence_confidence: HIGH`, `difficulty: LOW`, `estimatedMinutes <= 30` — that overrides the assigned **band only**, never the stored score. The score stays the honest weighted composite so History/trend data is never fabricated to justify a band.

**Tie-breaking** for equal composite scores, in order: (1) `evidence_confidence` rank (HIGH > MEDIUM > LOW > INSUFFICIENT_DATA), (2) `estimatedMinutes` ascending, (3) `action_number` ascending as the final stable fallback — reusing Executive Action Numbers™ as the permanent monotonic tiebreak.

**Rankable statuses** (`RANKABLE_STATUSES`): `recommended`, `started`, `in_progress` — the complete non-terminal `playbook_actions.status` universe. `available` is never a persisted status (only a virtual `fromStatus` in Playbook Action history rows); `waiting_verification`/`verified`/`completed`/`archived` have nothing left to prioritize.

## 5. Canonical Ownership™

| Field | Canonical owner |
|---|---|
| Score, Band, Rank, Quick Win flag, Opportunity History | Executive Opportunity Engine™ (`api/_lib/opportunity-store.js`) |
| Scoring formula/weights | Opportunity Scoring Engine™ (`api/_lib/opportunity-scoring-engine.js`, constants in `api/schema/opportunity.js`) |
| Opportunity Metadata (revenue impact, difficulty, time, business impact, priority) | Playbook Registry™ (`definition.metrics`) — unchanged from Phase 4A ECR5 |
| Evidence Confidence | Canonical Intelligence Engine™, snapshotted onto `playbook_actions.evidence_confidence` at recommend/start time — unchanged from Phase 4A |
| "Why does this recommendation exist" | Playbook Definition's `explainRecommendation()` (Phase 4A ECR8) — unchanged |
| "Why is it ranked here" | Opportunity Explanation™ (`api/_lib/opportunity-explain.js`) — new this phase |
| Playbook lifecycle status (which actions are even rankable) | Playbook Action Engine™ (`api/_lib/playbook-action-store.js`) — read-only from this engine's perspective |

Zero changes to `api/playbooks/` or `api/playbook-actions.js` this phase — confirms the Registry/Store separation established in 4A actually pays off: a second engine added with no edits to the first.

## 6. Stable Opportunity Identity™

The Opportunity ID is **not** a second parallel identity system — it *is* the Playbook Action ID (`playbook_actions.id`). `opportunity_scores.action_id` is `UNIQUE` (not just foreign-keyed), enforcing one current ranking per action, exactly as `playbook_actions_one_active_per_playbook` enforces one active instance per (artist, playbook). A ranking is inherently present-tense — "how should I prioritize this right now" — so reusing the entity that already has a solved stable-identity problem was the correct call rather than minting a new one.

## 7. Facts, not derived values

`opportunity_scores` stores `score`, `band`, `rank`, `is_quick_win`, and `factor_breakdown` as facts, computed once at recompute time by the Scoring/Ranking Engines. The **Opportunity Explanation™** (`whyRankedHere`/`whatIfIgnored`/`whatIfCompleted`/`topFactors`) is never persisted — `explainOpportunity()` re-derives it at read time from the stored `factor_breakdown` plus the Definition's title (a synchronous, in-memory `getPlaybook()` lookup, no additional I/O) — the same "facts stored, derived values computed" discipline as `progressPercentage` and `formatActionNumber()`.

## 8. Opportunity History™ and stale-row cleanup

Every `computeRoadmap` call writes an unconditional `opportunity_score_history` row per rankable action, capturing `from_score`/`from_band` snapshots so `describeScoreHistoryEvent()` can compute a human-readable label at read time (`"Ranked #2 (score 78, DO_NEXT)"`, `"Moved from DO_NEXT to DO_NOW"`, etc.) without a second lookup.

When an action leaves the rankable set entirely (e.g. the artist marks a playbook complete and it moves to `waiting_verification`), its **current** `opportunity_scores` row is deleted — there is nothing left to rank. Its full history in `opportunity_score_history` is untouched and permanent, satisfying "recommendations should evolve, not disappear" (Objective 13) at the history layer while keeping the current-state table an accurate reflection of what's actually rankable today. This mirrors how `archivePlaybook()` changes `playbook_actions.status` without ever touching `playbook_action_history`.

## 9. API surface — `api/opportunity-actions.js`

- `GET` → `{roadmap, counts, metrics}` — reads the artist's last-persisted Roadmap. **Never recomputes.**
- `POST {action: 'computeRoadmap'}` → recomputes from the artist's real `playbook_actions` rows, persists, returns the fresh Roadmap. The only write trigger — explicit, caller-initiated, same restraint as `verifyPlaybook()` not being an automatic scan hook.
- `POST {action: 'history', actionId}` → `{events}`.

Bearer-auth throughout; `artistProfileId` is always the authenticated caller's own `auth.uid()`, never client-supplied.

## 10. Executive Dashboard Metrics™

`getOpportunityDashboardMetrics()` returns Top Opportunity, Highest Revenue Opportunity, Quick Wins count, Highest Confidence, Most Urgent, and Resolved This Month — the last of these cross-references the Playbook Action Engine's own `playbook_action_history` (read-only; Canonical Ownership of that table stays with `playbook-action-store.js`) for real transitions into `completed`/`verified` this calendar month. Backend only — **no UI required this phase**, per the Board's own explicit instruction, matching Phase 4A ECR9's identical deferral.

## 11. Known, flagged, deferred technical debt

`affectedDomain` (Objective 6's mandated source for Opportunity Categories, read directly from Playbook Definitions — e.g. `'publishing'`, `'identity'`) uses a different vocabulary than ATHENA's own risk/opportunity `affectedDomain` field (`api/_lib/executive-domain-labels.js`: `identity, rights, catalog, distribution, monitoring, system_operations` — e.g. `'rights'`, not `'publishing'`). This divergence pre-dates Phase 4B (it exists between Phase 4A's Definitions and Phase 3's ATHENA risk engine) and is not fixed here — fixing it would mean editing already-merged, already-certified Phase 4A Definition files for a cosmetic vocabulary alignment with no functional bug attached. Flagged for a future consolidation pass, likely when a future ATHENA capability needs to cross-reference Opportunities against Risks by domain.

## 12. Explicitly deferred this phase

- **No UI changes to `ai-insights.html`.** Board: "UI is optional. Backend support is required" (Objective 15) — same deferral shape as Phase 4A ECR9.
- **No new Ask ATHENA Capability module.** `explainOpportunity()` ships as canonical, capability-ready data — exactly how Phase 4A's ECR8 `explainRecommendation()` shipped one phase before its own capability wiring (which, as of this writing, still hasn't happened — checked, zero Playbook/Opportunity capability exists in `api/athena/ask/capabilities/`).

## 13. Sequencing

This is Phase 4B of the Executive Actions™ program (4A → 4B → 4C → 4D). 4C (Executive Action Center™ workspace + UI rendering of the Roadmap) and 4D (ATHENA Action Engine™ — Ask ATHENA capability wiring for Opportunity data) each require their own branch, full certification, and explicit Board merge approval before beginning.
