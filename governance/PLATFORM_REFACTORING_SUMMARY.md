# Platform Refactoring Summary — ROYALTĒ v3.0 §2 — Recommendations & Proposed Roadmap

**Status:** RECOMMENDATION ONLY. Nothing in this document has been authorized or implemented. It proposes how the findings in the four companion discovery documents could be resolved across separate, Board-authorized implementation phases — each would need its own brief, its own PR, and its own Board review before merge, per this session's established pattern (Phase 5.3 discovery → Phase 5.4 implementation; Mandatory Executive Product Review Standard).

## 1. The One Decision Everything Else Depends On

`PLATFORM_REFACTORING_DISCOVERY_REPORT.md` §1 and §6: the Sprint 1–12 "Canonical Intelligence Platform" stack is fully built, individually certified, and completely unwired from production. Two directions are possible, and they are not compatible with each other — the Board should pick one before any of the sub-recommendations below are actioned:

- **Option A — Wire it in.** Treat the live `api/_lib/*` pipeline as the thing that needs to change: route it through `api/mission-control-api/`, `api/orchestrator/`, `api/registry/`, etc., retiring the duplicate live implementations once the ratified stack is proven equivalent in production. This is the larger, higher-risk option — it touches the code path every artist scan runs through.
- **Option B — Retire it.** Treat the live pipeline as the thing that's actually correct (it has been running in production, unmodified in its core shape, since before Sprint 1 started), and formally retire the Sprint 1–12 stack: move it to `governance/MIGRATION_RETIREMENT_REGISTER.md` as `READY FOR RETIREMENT` per that document's own zero-active-callers rule, then delete it. Lower-risk (nothing live changes) but means roughly 8,000+ lines of certified, Board-ratified work get deleted rather than used.
- **Option C — Formalize the split.** Document explicitly that two architectures coexist by design (e.g. the Sprint 1–12 stack is a "v2 platform" not yet cut over), update every governance lock document that currently implies the opposite, and defer the wire-vs-retire call to a later, named cutover phase.

This report does not recommend one of the three — it is a strategic call about product risk tolerance and engineering investment, not a code-quality question. Whichever is chosen determines the shape of every phase below.

## 2. Proposed Phase Breakdown (pending Option A/B/C above)

Numbered independently of the Option chosen; each phase should be its own brief.

**Phase §2.1 — Governance reconciliation (low-risk, do regardless of Option).**
Update `governance/MIGRATION_RETIREMENT_REGISTER.md` to list the 9 dead directories from `PLATFORM_DEAD_CODE_REPORT.md` §1, per that document's own stated rule. Resolve the open `api/territory-scan.js` question from `governance/PHASE_5_2_IMPLEMENTATION_CHECKPOINT_DEAD_CODE_FINDING.md`. Documentation-only; no code risk.

**Phase §2.2 — Shared utility extraction (low-risk, additive, do regardless of Option).**
Extract one canonical `deepFreeze()` into a shared module (candidate location: `api/_lib/deep-freeze.js` or similar) and migrate the ~20 call sites from `PLATFORM_DUPLICATE_CODE_REPORT.md` §2. Extract one shared `assert()` test harness and migrate the ~18 test files from §3 — pick one canonical signature, since the current split has real argument-order collision risk. Extract one shared Supabase client bootstrap (§4) and one shared CORS-header helper (§5). Each of these is mechanical, individually testable, and does not touch business logic — good candidates for a first, low-trust-required implementation phase.

**Phase §2.3 — PAL HTTP layer consolidation (medium-risk).**
Extract the 12 duplicated retry/backoff/timeout implementations (`PLATFORM_DUPLICATE_CODE_REPORT.md` §6) into one shared PAL HTTP base, with per-connector config for the constants that legitimately differ (timeout, backoff ceiling) rather than duplicated logic. Touches every connector, so needs the full certification harness (all 12 connector suites) re-run green before merge — the harness already exists and is wired, per Engine Provider Registry lock.

**Phase §2.4 — Dead code removal (low-to-medium risk, depends on Option A/B/C for scope).**
Delete the confirmed-dead top-level handlers (`api/discogs.js`, `api/tidal-token.js`, `api/mlc-test.js`, and `api/territory-scan.js` pending §2.1's resolution) and the ~400 lines of retired legacy functions inside `run-scan.js` (`PLATFORM_DEAD_CODE_REPORT.md` §2–§3). If Option B is chosen, this phase also removes the 9 dormant directories; if Option A, it instead becomes a wiring phase (§2.5 below) and this phase shrinks to just the handler/legacy-function cleanup.

**Phase §2.5 — Constitutional gateway wiring (large, only if Option A).**
Route the live pipeline through `api/mission-control-api/`, `api/orchestrator/`, `api/registry/` per the original Board Decision (`BOARD_DECISIONS.md:88`). This is the highest-risk phase in this roadmap — it changes the code path every scan executes — and should itself be split by subsystem (Registry first, since it's foundational and read-only; Orchestrator last, since it wraps the entire pipeline) rather than attempted as one PR.

**Phase §2.6 — Frontend consolidation (low-risk, independent of Options above).**
Merge `catalog-intelligence.html`'s duplicated `.ci-kpi-card` component into the shared `.hi-kpi-card` (`PLATFORM_DUPLICATE_CODE_REPORT.md` §7). Deduplicate the twice-declared `.hi-kpi-card`/`.hi-kpi-card--score` rules in `royalte-workspace.css`. Purely visual-equivalence work — needs the Vercel Preview visual-review standard (per this session's established practice) rather than a functional test.

**Phase §2.7 — Env var / config hygiene (low-risk).**
Document the undocumented env vars found during the Workspace/Config research pass (`CRON_SECRET`, `INTERNAL_API_SECRET`, MLC vars, `PDFSHIFT_API_KEY`, `RESEND_API_KEY`/`RESEND_KEY`, Supabase vars, `VERCEL_ENV`) in CLAUDE.md's "Required environment variables" list. Resolve the `RESEND_KEY` vs `RESEND_API_KEY` fallback drift (`PLATFORM_DUPLICATE_CODE_REPORT.md` §8) to a single name. Clean up the stale `.env.*.tmp` scratch files at repo root.

**Already tracked, not re-proposed here:** SoundCloud hardcoded credential removal and SoundCloud/Wikidata PAL migration are existing Board-flagged future tasks (tracked separately) — this audit re-confirms both are still present and still accurate as described.

## 3. What This Report Deliberately Does Not Recommend

- **No "do everything in one PR."** The brief's own validation gate ("no duplicate implementations remain," "shared utilities are centralized") describes an end state reachable only after several of the phases above, not a single pass — attempting it as one changeset would be the same undisciplined-scope risk this Board flagged and split out at the start of this initiative.
- **No deletion of the Sprint 1–12 stack in this document.** Even under Option B, that deletion is Phase §2.4/§2.1 work requiring its own explicit Board sign-off, not a byproduct of writing this summary.
- **No opinion on whether Sprints 1–12 were "wasted work."** They pass their own certification suites on their own terms; the finding is a wiring gap, not a quality defect in the code that exists.
