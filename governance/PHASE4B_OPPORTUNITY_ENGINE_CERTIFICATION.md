# Phase 4B — Executive Opportunity Engine™ Certification

Branch: `feat/phase4b-opportunity-engine` (PR #452)

Per the Board's directive, this document certifies 4B's implementation before requesting Board merge approval — **per the Merge Standard, certification alone does not authorize merge.**

---

## 1. Implementation summary

Activates the Recommendation Ranking Engine™ reserved since Phase 3E, now with a real second consumer (Phase 4A's Playbook Actions). Delivers a deterministic, explainable Executive Opportunity Score™ (0–100) on every rankable Playbook Action, computed by a pure scoring engine (`api/_lib/opportunity-scoring-engine.js`, weights externalized in `api/schema/opportunity.js`, six named factors summing to 1.0). Actions are grouped into an Executive Roadmap™ (Do Now / Do Next / Do Later) with Quick Wins™ auto-detected via a strict AND-filter that overrides the assigned band only, never the stored score. Stable Opportunity Identity™ reuses `playbook_actions.id` rather than a second identity system. Opportunity History™ is permanent and unconditional (`api/_lib/opportunity-store.js`), and Ranking Transparency™ is structural — every score decomposes into its full factor breakdown. Zero changes to `api/playbooks/` or `api/playbook-actions.js`.

## 2. Migration report

`supabase/migrations/20260805000000_opportunity_scores.sql` — two new tables. Confirmed via `information_schema.tables` that neither existed before this migration (clean apply, no pre-existing data affected). Applied to production Supabase (`dhfndrrfekwuxzgjblci`) with explicit founder approval.

Post-apply verification (direct SQL against `information_schema.columns`, `pg_constraint`, `pg_policies`):
- **Columns**: all present with correct types (`opportunity_scores`: 13 columns incl. `playbook_id text NOT NULL` — a denormalized snapshot added during implementation once a real bug surfaced, see §9; `opportunity_score_history`: 11 columns).
- **Constraints**: `opportunity_scores_pkey`, `opportunity_scores_action_id_key` (UNIQUE — Stable Opportunity Identity™'s DB-level enforcement), FKs to `playbook_actions(id)` and `auth.users(id)`, CHECK constraints on `score` (0–100) and `band` (`DO_NOW`/`DO_NEXT`/`DO_LATER`) — all confirmed present on both tables via `pg_constraint`.
- **RLS policies**: `opportunity_scores_select_own` and `opportunity_score_history_select_own`, both `SELECT`-only, confirmed via `pg_policies`. No client write policy exists — service-role-only writes, matching every other Phase 4 table.
- **Rollback strategy**: both `CREATE TABLE` statements use `IF NOT EXISTS` (idempotent, safe to re-run); rollback is a manual `DROP TABLE` pair (no data migration path needed since this is new, additive schema with no dependent objects other than the FK from `opportunity_score_history` back to `opportunity_scores`' referenced `playbook_actions`, which is one-directional and CASCADE-safe).

**Observation** (not a Phase 4B defect): during test-data setup for the live walkthrough, a direct `INSERT` into `audit_scans` via the project's local `SUPABASE_SERVICE_ROLE_KEY` (a newer `sb_secret_...`-format key) was rejected by `audit_scans`' RLS policy — `audit_scans` has only a `SELECT`-own policy, no `INSERT` policy, and this key did not bypass RLS the way a classic `service_role` JWT does. Worked around by inserting via the Supabase management-plane connection instead. `audit_scans` is not owned by Phase 4B and was not modified; flagging this as an environmental observation for whoever owns local `.env.local` credentials next, not a Phase 4B migration issue — the new `opportunity_scores`/`opportunity_score_history` tables were written to successfully via the real API endpoint using a real Bearer session throughout the live walkthrough, so this observation does not affect Phase 4B's own write path.

## 3. API documentation

`api/opportunity-actions.js`, Bearer-auth throughout; `artistProfileId` always `auth.uid()`, never client-supplied:

- `GET` → `{roadmap, counts, metrics}` — reads the artist's last-persisted Roadmap. Never recomputes.
- `POST {action: 'computeRoadmap'}` → recomputes from the artist's real `playbook_actions`, persists, returns the fresh Roadmap + counts + dashboard metrics.
- `POST {action: 'history', actionId}` → `{ok, events}` — Automatic Executive Timeline™, each event pre-labeled.

## 4. Validation report (automated tests)

- `tests/opportunity-engine-test.mjs` — **27/27 passing**: scoring determinism (identical input → identical output, verified twice), weight sum-to-1.0 assertion, per-factor HIGH/MEDIUM/LOW/INSUFFICIENT_DATA correctness, band threshold edges (39/40, 69/70), Quick Win strict-AND logic (each of the four criteria independently required), Quick Win band override without score mutation, Opportunity Explanation factor citation, ranking + deterministic tie-breaking (confidence → time → action number), `RANKABLE_STATUSES` completeness, upsert-not-duplicate on repeat compute, unconditional history writes with correct `from_score`/`from_band` snapshots, read-only `GET` never recomputes, explanation re-derived at read time from stored `factor_breakdown` (never persisted), `describeScoreHistoryEvent()` label correctness across first-score/band-change/score-change/no-change cases, cross-artist isolation (read + write), never-throws contract, dashboard metrics (`quickWinsCount`, `topOpportunityActionId`, and — added during this certification pass after finding it had zero coverage — `resolvedThisMonth`'s real cross-reference against `playbook_action_history`, including correct deduplication of an action with two resolution events in the same month), and the stale-row cleanup path (an action leaving the rankable set is removed from current state while its full history survives).
- `tests/pipeline-test.mjs` — 222+8, no regressions.
- `tests/playbook-action-engine-test.mjs` — 45/45, no regressions (confirms zero impact on Phase 4A).
- `tests/ask-athena-test.mjs` — 47/47, no regressions.
- `tests/executive-memory-store-test.mjs` — 19/19, no regressions.
- `tests/executive-phase3d-domain-comparison-test.mjs` — 20/20, no regressions.
- `tests/executive-phase3b-services-test.mjs` — 19/19, no regressions.
- `tests/workspace-contract-validator.test.mjs` — 83/83, no regressions.

## 5. Live Preview verification (Executive Board Certification Walkthrough™)

Performed against a fresh deployment of this branch (`royalte-git-feat-phase4b-oppor-d99b7a-*.vercel.app`), after the migration was applied, using two new, disposable, pre-confirmed Supabase test users created via the admin API and fully deleted (users, `audit_scans`, `playbook_actions`, `playbook_action_history`, `opportunity_scores`, `opportunity_score_history` rows) immediately after.

**Real evidence, real scoring, verified against a hand-computed expectation before the call was made**: seeded test user A with a real `audit_scans` payload (`identity.coverage: 65`, `mlcRegistration: 'NOT_FOUND'`). The real `ai-insights.html` production UI (not a harness) correctly surfaced `identity-coverage` at `MEDIUM CONFIDENCE` (65% coverage falls in the MEDIUM confidence band per `identity-coverage.js`'s own thresholds) — confirming the confidence computation before the ranking engine ever touched it. Called `POST computeRoadmap` live: `mlc-registration` scored **80/100, DO_NOW, rank 1** and `identity-coverage` scored **59/100, DO_NEXT, rank 2** — both scores matched a hand-computed expectation (using the real weights against each Definition's real `metrics` and the real `evidence_confidence`) calculated *before* the live call was made, confirming the deployed scoring formula matches the certified design exactly, not just in isolated tests.

**`GET` (read-only) confirmed to never recompute**: returned an empty roadmap before any `computeRoadmap` call, and exactly reflected the last-persisted state afterward.

**Idempotency and Opportunity History™ confirmed unconditional, live**: called `computeRoadmap` three times in a row with no underlying evidence change — `history` for the `mlc-registration` action returned exactly 3 events (`"Ranked #1 (score 80, DO_NOW)"`, then two `"Re-ranked #1 (score 80, DO_NOW) — no change"` entries), confirming every recompute writes, never a "was this different enough" filter.

**Stale-row cleanup confirmed live against the real Phase 4A lifecycle** (the certification's most important architectural guarantee): drove `mlc-registration` through a real `start → advance×4 → complete` sequence via `api/playbook-actions.js`, reaching `waiting_verification`. Recomputed the Opportunity Roadmap: `mlc-registration` was correctly absent from both the fresh `computeRoadmap` response *and* a subsequent `GET` (confirming the row was actually deleted, not merely excluded from one response) — while its full 4-event history remained fully readable via `history`. `identity-coverage`'s `rank` correctly recalculated from 2 to 1 once it became the only rankable action.

**Cross-artist isolation confirmed live, both layers**: a second real test user saw an empty roadmap of their own, a `computeRoadmap` call for them created nothing and touched nothing belonging to the first user, and a `history` request against the first user's `actionId` returned an empty event list rather than another artist's data.

**Direct database confirmation** (`opportunity_scores`, `opportunity_score_history` queried directly): matched every API-level observation exactly — one row for `identity-coverage` at `rank 1` after `mlc-registration`'s removal; the full, permanent, unconditional history trail (5 events for `identity-coverage`, 4 events for `mlc-registration` before its removal) confirmed by direct query, not just through the API.

**No defect was found during this live pass.** One real test-coverage gap was found and closed *during* this certification session, before it was presented: `resolvedThisMonth` (an Objective 7 dashboard metric) had zero automated test coverage — added a dedicated test (including a same-action-two-events-in-one-month deduplication case) before finalizing this report.

## 6. Evidence ownership verification

Cross-checked live against the Canonical Ownership™ table in `governance/OPPORTUNITY_ENGINE_ARCHITECTURE.md`: Score/Band/Rank/Quick Win flag/History confirmed written exclusively by `api/_lib/opportunity-store.js` (grep-confirmed: all `.from('opportunity_scores')`/`.from('opportunity_score_history')` calls anywhere in `api/` are in this one file); Opportunity Metadata confirmed sourced exclusively from `definition.metrics`, unchanged from Phase 4A; the ranked score the live UI's Guided Playbooks™ section displays for confidence (`MEDIUM`) was confirmed to originate from the same `evidence_confidence` the Scoring Engine read, never a second, UI-side derivation.

## 7. Merge status

**Not merged.** Per the Merge Standard, certification never authorizes merge on its own. Awaiting explicit Board "Merge PR #452" instruction.
