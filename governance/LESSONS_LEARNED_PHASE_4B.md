# Lessons Learned Report™ — Phase 4B: Executive Opportunity Engine™

Branch: `feat/phase4b-opportunity-engine` (PR #452)

---

## 1. Executive Summary

Milestone: Phase 4B — Executive Opportunity Engine™, the second slice of the Phase 4 Executive Actions™ program (4A → 4B → 4C → 4D).

Outcome: successful. The milestone activates the Recommendation Ranking Engine™ reserved since Phase 3E — Royaltē's first deterministic, explainable prioritization layer, answering "what should I do first?" rather than just "what could I do?" No defect was found in the shipped implementation during certification; one real test-coverage gap was found and closed during the certification review itself.

Implementation status: complete on branch, all automated tests passing (27 new + 460 regression across six other suites), live-verified on Preview against two real disposable test users, including a full production-UI-adjacent walkthrough (real evidence, real Bearer sessions, real database writes) and direct database confirmation.

Board certification status: certified (`governance/PHASE4B_OPPORTUNITY_ENGINE_CERTIFICATION.md`, `governance/PHASE4B_FINAL_MERGE_STANDARD_REVIEW.md`). **Not merged** — awaiting explicit Board merge approval per the Merge Standard.

---

## 2. Objectives

**Original engineering objective** (Board directive, Version 1.0): build the Executive Opportunity Engine™ as the canonical prioritization layer over Phase 4A's Playbook Actions — a normalized Opportunity Score, Opportunity Factors, Executive Prioritization, an Executive Roadmap (Do Now/Do Next/Do Later), Opportunity Categories, Quick Wins, Executive Impact explanations, ATHENA Advisor readiness, Ranking Transparency, Stable Opportunity Identity, Timeline integration, Dashboard backend support, and Opportunity History — 20 objectives in total, explicitly excluding the Executive Decision Engine™, Tool Invocation Framework™, automation, AI agents, workflow orchestration, and external integrations.

**Scope resolution this session**: recognized before implementation began that this phase is not new scope — it is the deliberate activation of the **Recommendation Ranking Engine™**, a component the user explicitly confirmed should remain reserved during Phase 3E specifically because no second real consumer existed yet (`governance/LESSONS_LEARNED_PHASE_3E.md` §3.2). Phase 4A's Playbook Actions supplied that second consumer; this session's plan opened by naming that connection explicitly rather than treating the directive as introducing a brand-new component.

**Final delivered scope**: exactly the approved plan, produced via a design-review pass (a dedicated review agent pressure-tested the initial design against the actual Phase 4A codebase before implementation began) that corrected several assumptions before any code was written — see §3.

---

## 3. Major Architectural Decisions

### 3.1 "Opportunity Registry™" named in code as a store, not a registry

**Problem**: the Board's architecture list names five components including "Opportunity Registry™," but this codebase's existing "Registry" pattern (Playbook Registry, Capability Registry) means specifically a `Map` of self-registering static content populated once at import time — the opposite of per-artist, DB-backed, continuously-mutated ranking state.

**Final decision**: named the file `api/_lib/opportunity-store.js`, matching `playbook-action-store.js`'s own grammar; "Opportunity Registry™" is preserved as Board-facing vocabulary in the file's header comment only.

**Rationale**: a design-review pass explicitly confirmed this was the right call rather than overloading "Registry" to mean two structurally different things in the same codebase — naming precision that pays off the first time someone greps for "registry" expecting self-registering content and finds per-artist mutable state instead, or vice versa.

### 3.2 Stable Opportunity Identity™ reuses the Playbook Action ID, not a new identity system

**Problem**: the Board required a stable "Opportunity ID" for trend tracking (Objective 13).

**Final decision**: `opportunity_scores.action_id` (UNIQUE, not just FK'd) *is* the Opportunity ID — no second identity system was minted.

**Rationale**: Phase 4A already solved "stable identity that survives across scans" via `playbook_actions.id` plus a partial unique index guaranteeing one active row per (artist, playbook). A ranking is inherently present-tense — "how should I prioritize this right now" — so it's the same entity, not a new one. The design-review pass confirmed this holds structurally: the existing `playbook_actions_one_active_per_playbook` index already guarantees one row per pair, so a second identity system would have duplicated an already-solved problem for no benefit.

### 3.3 `affectedDomain` reused for Opportunity Category, with a flagged, deliberately unfixed vocabulary divergence

**Problem**: Objective 6 required Opportunity Categories to "originate from Playbook Definitions." A design-review pass surfaced that Registry's own `domain` field (added in Phase 4A's hardening pass, e.g. `'Publishing'`) has zero live consumers anywhere in the codebase, while Definitions' `affectedDomain` field (e.g. `'publishing'`) is heavily consumed by ATHENA's entire risk/opportunity/trend machinery — but under a *different* vocabulary (ATHENA's own risk engine uses `'rights'`, not `'publishing'`, for the same concept).

**Final decision**: used Definitions' `affectedDomain` (satisfying Objective 6's literal instruction), and explicitly flagged — rather than silently fixed — the cross-system vocabulary divergence as pre-existing technical debt for a future consolidation pass.

**Rationale**: fixing the divergence would have meant editing already-merged, already-certified Phase 4A Definition files for a cosmetic alignment with no functional bug attached — out of this phase's scope, and exactly the kind of unrequested architectural change the Board's own directives elsewhere caution against. Flagging honestly, rather than either silently fixing scope-adjacent files or silently ignoring a real inconsistency, matched this project's established "report before edit, flag don't assume" convention.

### 3.4 Quick Wins override the band only, never the stored score

**Problem**: the Board's worked example ties "Do Now" to "high impact + low effort," which a pure score-threshold banding model can't guarantee — a genuine Quick Win's composite score could theoretically land below the `DO_NOW` threshold if other factors (Business Impact, Priority) are weak.

**Final decision**: `isQuickWin()` is a separate, strict four-criteria AND-filter that overrides only the *band* assignment (`quickWin ? 'DO_NOW' : computeBand(score)`); the underlying `score` is never inflated to justify the override.

**Rationale**: keeps "facts stored, derived values computed" intact — `opportunity_score_history`'s `score` column always reflects the honest weighted composite, so trend analysis on raw scores is never contaminated by a band-justification hack. Confirmed by a dedicated test asserting the score stays below 100 even when `isQuickWin` is true.

### 3.5 Unconditional Opportunity History writes, no "was this change big enough" filter

**Problem**: an early instinct was to only write a new `opportunity_score_history` row when a recompute produced a "materially different" score or band, to avoid unbounded history growth from repeated no-op recomputes.

**Final decision**: every `computeRoadmap` call writes a history row for every rankable action, unconditionally — no filtering heuristic.

**Rationale**: a design-review pass found the "materially different" instinct had **no precedent anywhere in this codebase** — `playbook_action_history`'s own `recordHistory()` fires unconditionally on every mutating call in Phase 4A, with no equivalent filter. Introducing one here would have been a genuinely new, unprecedented rule invented mid-implementation rather than following the house pattern. `computeRoadmap` is caller-triggered (not a continuous background process), so write volume is naturally bounded by how often an artist or a future automated trigger actually calls it — the concern that motivated the original instinct doesn't actually apply here.

---

## 4. Unexpected Discoveries

- A real bug was found while *writing the test suite*, before any push: stale `opportunity_scores` rows for actions that leave the rankable set (e.g. moved to `waiting_verification`) were never cleaned up — `getOpportunityRoadmap()` would have kept showing a phantom entry indefinitely. Fixed by adding explicit stale-row deletion to `recomputeOpportunityRoadmap()`, with the action's full history preserved untouched in `opportunity_score_history`. This is the second consecutive phase (after Phase 4A's fabricated-stepId bug) where writing genuinely thorough tests — not just tests that pass — surfaced a real defect before certification, reinforcing that test-writing itself is a design-review step, not just a verification step.
- Neither of the two real, currently-shipped Playbook Definitions can organically produce a Quick Win (`mlc-registration` has `estimatedRevenueImpact: MEDIUM`; `identity-coverage` has `estimatedRevenueImpact: LOW`, and both fail the strict four-criteria AND-filter for other reasons too) — meaning the live certification walkthrough could exercise `DO_NOW`/`DO_NEXT` scoring live but not an organic Quick Win. Same category of finding as Phase 4A's own "no artist with a genuine gap found" — worth noting for Phase 4C's content-authoring pass: a future third Playbook Definition with genuinely high revenue impact and low difficulty would let this be demonstrated live rather than only at the unit level.
- The local `.env.local` `SUPABASE_SERVICE_ROLE_KEY` (a newer `sb_secret_...`-format key) did not bypass RLS on `audit_scans` during this session's test-data setup, despite an apparently identical technique having worked during Phase 4A's certification earlier in this same overall engineering effort. Worked around via the Supabase management-plane connection instead; flagged as an environmental observation, not a Phase 4B defect, since `audit_scans` is owned elsewhere and unmodified.
- `resolvedThisMonth` (a Dashboard Metrics™ requirement, Objective 15/Objective 7 of the certification checklist) had been implemented but left with zero test coverage — found during the Final Merge Standard Review's own systematic checklist walk-through (§7), not by accident. Closed immediately, before the review was presented, rather than being carried forward as a known gap.

---

## 5. Bugs Discovered During Certification

**None found during the live Preview walkthrough itself.** Two real issues were found and fixed earlier, during this agent's own implementation and review process, before certification began:

1. Stale `opportunity_scores` rows never cleaned up when an action leaves the rankable set (§4) — caught while writing `tests/opportunity-engine-test.mjs`, before any push.
2. `resolvedThisMonth` had zero test coverage — caught during the Final Merge Standard Review's own checklist audit (§7 of that document), fixed before the review was finalized.

This continues the project's now-established pattern (Phase 3E, Phase 4A) of catching real issues during implementation/review rather than during live certification — four of the last five milestones (3D and 3C being the exceptions) found their defects before the live walkthrough, not during it.

---

## 6. Technical Debt Removed

None pre-existing in the files this phase touched — `api/_lib/opportunity-*.js`, `api/schema/opportunity.js`, and `api/opportunity-actions.js` are new code end-to-end.

---

## 7. Technical Debt Deferred

| Item | Reason for deferral | Risk | Recommended milestone |
|---|---|---|---|
| `affectedDomain` vocabulary divergence between Playbook Definitions (`'publishing'`) and ATHENA's risk engine (`'rights'`) | Pre-existing (predates Phase 4B), cosmetic, no functional bug attached; fixing it means editing already-merged Phase 4A files out of scope | Low today; becomes real friction if/when a future ATHENA capability needs to cross-reference Opportunities against Risks by domain | A dedicated small consolidation pass, likely bundled into Phase 4D (ATHENA Action Engine™) when that cross-referencing need becomes real |
| Quick Win / some Timeline event labels (Promotion, Demotion, Quick-Win-flagged) not live-demonstrated | No real Playbook Definition today satisfies Quick Win criteria or has an evidence source likely to change band mid-session; fully proven at the unit level, which is sufficient for pure logic with no I/O dependency | Low — the underlying logic is simple, pure, and fully tested | Naturally resolved once Phase 4C's content-authoring pass adds a third+ Playbook Definition with genuinely high-revenue/low-effort characteristics |
| No Ask ATHENA Capability module for Opportunity data | Board's own architecture list (Objective 17) doesn't name one; "backend support required, UI optional" instruction implies data-readiness, not live integration, is this phase's bar; matches Phase 4A's own identical deferral for `explainRecommendation()` | None — `explainOpportunity()` is capability-ready, importable directly, no redesign needed later | Phase 4D (ATHENA Action Engine™) |
| No UI rendering of the Roadmap | Explicit Board instruction ("UI is optional. Backend support is required") | None — the API is fully functional and tested independently of any UI | Phase 4C (Executive Action Center™ workspace) |
| Intelligence Vault™ login UI still dead code | Pre-existing, out of scope for every Phase 3/4 milestone so far | Now the sixth consecutive milestone requiring manually-created test users for live verification | Should be the clear top priority — flagged in every Lessons Learned report since Phase 3D |

---

## 8. Performance Observations

No formal load testing performed. Qualitative observation during live verification: every `/api/opportunity-actions` call (`GET`, `computeRoadmap` ×3, `history` ×2) returned promptly with no perceptible latency, consistent with the operation's actual cost profile (a handful of small row reads/writes per rankable action, no external API calls, no AI provider involvement — scoring is pure in-process computation). `computeRoadmap`'s current implementation does one lookup query, N upserts, and N history inserts per call (N = number of rankable actions) — fine at today's scale (a handful of Playbooks per artist) but worth revisiting if the Playbook catalog grows to the "dozens" scale the Registry pattern was explicitly designed to support, since N sequential awaited writes could become a real latency factor at that point. **Not a defect today, not tested under load.**

---

## 9. Testing Summary

- **Unit tests**: `tests/opportunity-engine-test.mjs` — 27/27 passing, covering the Scoring Engine, the ranking Engine, the Store's full lifecycle (including the stale-row cleanup bug fix and the `resolvedThisMonth` gap fix, both applied during this same development/review cycle), and the Explanation composer.
- **Regression tests**: `pipeline-test.mjs` (222+8), `playbook-action-engine-test.mjs` (45/45 — confirms zero impact on Phase 4A), `ask-athena-test.mjs` (47/47), `executive-memory-store-test.mjs` (19/19), `executive-phase3d-domain-comparison-test.mjs` (20/20), `executive-phase3b-services-test.mjs` (19/19), `workspace-contract-validator.test.mjs` (83/83) — all passing, zero regressions, re-run in full after every fix during this cycle, not just once at the end.
- **Preview verification**: one full deployment cycle, live-verified end-to-end including real evidence-driven scoring (independently hand-computed and matched before the live call), unconditional history accumulation, stale-row cleanup against the real Phase 4A lifecycle, and cross-artist isolation at both read and write layers.
- **Production validation**: not applicable — Preview only, correctly, since Board merge approval has not yet been granted.
- **Board certification walkthrough**: performed against two real, disposable, pre-confirmed Supabase test users; full detail and a checklist-by-checklist accounting in `governance/PHASE4B_FINAL_MERGE_STANDARD_REVIEW.md`.

---

## 10. Governance Updates

- **Created**: `governance/OPPORTUNITY_ENGINE_ARCHITECTURE.md`, `governance/PHASE4B_OPPORTUNITY_ENGINE_CERTIFICATION.md`, `governance/PHASE4B_FINAL_MERGE_STANDARD_REVIEW.md`, `governance/LESSONS_LEARNED_PHASE_4B.md` (this report).
- **Modified**: none. No prior governance document's own claims were changed by this phase.
- **Superseded**: none.
- **Deferred**: `governance/ROADMAP.md`'s "What's Live in `main` Today" entry for Phase 4B is intentionally not yet written, added at merge time per this repo's established convention.

---

## 11. Recommendations for Future Phases

- Resolve the Vault/auth login gap before Phase 4C — now the single most repeated finding across six consecutive Lessons Learned reports (3D, 3C, 3E, 4A, 4A-hardening, 4B).
- When Phase 4C's content-authoring pass adds new Playbook Definitions, deliberately author at least one with genuinely high `estimatedRevenueImpact` + `LOW` `difficulty` + short `estimatedMinutes`, specifically so a future certification can demonstrate a live, organic Quick Win rather than relying on unit tests alone for that path.
- Phase 4D (ATHENA Action Engine™) should resolve the `affectedDomain` vocabulary divergence (§3.3/§7) as part of whatever work makes Opportunity data cross-referenceable against ATHENA's risk engine — the two systems will need a shared domain vocabulary the moment that integration is real, not before.
- If `computeRoadmap`'s N-sequential-writes pattern (§8) becomes a real latency concern once the Playbook catalog grows, batch the `opportunity_scores` upserts and `opportunity_score_history` inserts into single multi-row statements rather than N round-trips — the current per-action loop was the simplest correct implementation for this phase's actual scale (2 real Playbooks), not a decision expected to hold indefinitely.
- The design-review-before-implementation pattern used this phase (a dedicated review pass pressure-testing the initial design against the real codebase, surfacing the `opportunity-store.js` naming call, the `affectedDomain` consumption-vs-existence distinction, and the unconditional-history-write precedent, all before any code was written) caught real issues cheaply. Worth repeating explicitly for Phase 4C/4D, which will each involve comparable architectural ambiguity (a new standalone workspace's data contract; ATHENA capability wiring against two prior phases' data shapes).

---

## 12. Final Assessment

- **Overall implementation quality**: solid. A genuinely new capability class for Royaltē (the first that prioritizes rather than just records or executes), built with a deterministic, fully-transparent formula, zero changes to either prior phase it builds on, and two real defects caught and fixed before certification rather than during or after it.
- **Confidence level**: High.
- **Readiness for merge**: Ready.
- **Remaining risks**: Low. The two disclosed live-verification limitations (Quick Win, some Timeline event labels not organically demonstrable with today's real Playbook Definitions) are honestly reported rather than hidden, and are fully covered at the unit level, which is the correct and sufficient proof for pure, database-independent logic. The Vault/auth gap remains the platform's single most overdue piece of pre-existing debt, unrelated to this phase's own quality.
- **Executive Board recommendation**: approve for merge.
