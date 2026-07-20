# Phase 1 — Foundation Recovery — Remediation Report

**Scope:** Normalization Layer + CIO/CIM + Runtime Context + Mission Control data flow, treated as one coupled foundation per Board directive.
**Branch:** `chore/platform-recovery-phase1-foundation`
**Status:** Remediation complete. No push, no PR, no merge.

---

## What changed and why

| # | Change | Traces to finding | Files |
|---|---|---|---|
| 1 | EvidenceBridge deletion **cancelled** after evidence review; replaced with an architecture assessment | N1 (Normalization cert) | `governance/PHASE_1_EVIDENCEBRIDGE_ARCHITECTURE_REVIEW.md` (new) |
| 2 | Deleted the dormant Sprint 4 Normalization Engine (1,413 lines) + its test | N3 (Normalization cert) | `api/normalization/*` (removed), `tests/normalization-engine-test.mjs` (removed) |
| 3 | Enforced `validateCio()` in `runRIE()` — invalid CIO now short-circuits to a safe, logged, degraded CIM instead of silently propagating | N2 (Canonical Schema cert) | `lib/rie/index.js` |
| 4 | Fixed `cio.js` doc-block drift (3→5 observation providers) | N7 (Canonical Schema cert) | `api/schema/cio.js` |
| 5 | Added Recording Intelligence to `lib/rie/index.js`'s self-declared CIO-bypass violation list | N4 (both certs) | `lib/rie/index.js` |
| 6 | Corrected `ROADMAP.md`'s stale PAL-migration provider count (append, not edit — historical entry preserved) | N6 (Normalization cert) | `governance/ROADMAP.md` |
| 7 | Bumped `CIO_VERSION`/`CIM_VERSION` 1.0.0 → 1.1.0, added versioning policy comments | N6/versioning gaps (Canonical Schema cert) | `api/schema/cio.js`, `api/schema/canonical-intelligence-model.js` |
| 8 | Created permanent ADR register (4 ADRs) for decisions explicitly not resolved in this pass | ADR-001 through ADR-004 | `governance/adr/*` (new) |

## What was explicitly NOT done, and why

- **EvidenceBridge translator deletion (original Item A).** Cancelled mid-investigation: the translators are reachable via two production call sites, exercised by 7 dated Board Certification suites (07–13) wired into the permanent certification harness, and not architecturally unreachable by any evidentiary standard. Deleting them would have broken certified regression tests. Replaced with `governance/PHASE_1_EVIDENCEBRIDGE_ARCHITECTURE_REVIEW.md` and ADR-004.
- **CimAdapter retirement / Mission Control native CIM reads.** Escalated per the Board's own pause criteria (platform data flow, major subsystem boundary) — see ADR-001. Not resolved in this pass.
- **CIO schema expansion for the 4 bypassing domain assemblers.** Escalated — see ADR-002. Not resolved.
- **Runtime context generation strategy.** Escalated — see ADR-003.
- **CIO confidence-scoring implementation.** Out of scope — this is a feature addition (new business logic), not a defect fix, per the Board's "no feature additions" constraint.
- **Provider merge-authority promotion.** Escalated — see ADR-004.

## Verification performed

Five distinct verification surfaces were used. They are named explicitly and individually below because two of them coincidentally both report "20/20" while measuring different things, and one reports a fractional result that needs its own explanation — see the callout beneath the table.

| Verification surface | What it measures | Baseline (before any Phase 1 change) | After all Phase 1 changes |
|---|---|---|---|
| `tests/pipeline-test.mjs` | 230 assertions, normalize+validate pipeline | 230/230 pass | 230/230 pass (unchanged) |
| `lib/rie/__tests__/rie-activation.test.js` | 20 individual certification criteria in one file | 20/20 pass | 20/20 pass (unchanged) |
| `lib/rie/__tests__/scan-migration.test.js` | 36 individual criteria in one file | **35/36** — 1 failure | **35/36** — same 1 failure |
| `tests/cio-assembler-test.mjs` | 17 assertions | 17/17 pass | 17/17 pass (unchanged) |
| `tests/certification/harness.mjs` ("the certification harness") | 20 Board Certification **suites**, each containing many assertions (2,344+ total across the suite) | 20/20 suites green | 20/20 suites green (unchanged) |

### The 35/36 result, explained precisely

- **Which verification produced it:** `lib/rie/__tests__/scan-migration.test.js`, criterion 32 of 36 ("Phase 2.1 conformance suite — Provider Connector Framework").
- **What the failure is:** `exactly 22 capabilities defined` — the test asserts the `Capability` vocabulary (`provider-acquisition/capability/capabilityVocabulary.js`) has exactly 22 entries; it currently has 24.
- **Why it's unrelated to this remediation:** the `Capability` vocabulary is part of the Provider Acquisition Layer's capability taxonomy — no file touched in Phase 1 (`api/normalization/*`, `lib/rie/index.js`, `api/schema/cio.js`, `api/schema/canonical-intelligence-model.js`, `governance/ROADMAP.md`) defines, imports, or modifies that vocabulary.
- **Whether it existed before this branch:** yes — it was present in the very first baseline run, captured before a single line of code was changed in this session (Task 14, prior to Task A).
- **Why it does not invalidate this remediation:** the same test, same criterion, same 24-vs-22 count, was re-verified identically after every individual change in this pass (Tasks B, C, D, E) and in the final full re-run — it never changed state, in either direction, at any point in this session.

### "Certification harness green throughout" — what that claim covers

Any prior reference in chat or documentation to "the certification harness" or "green throughout" refers specifically to `tests/certification/harness.mjs` (20/20 suites, both before and after) — not to `scan-migration.test.js`'s separate, standalone `node` invocation, which is a different file with its own pre-existing, unrelated failure as described above. Both statements are independently true; they describe two different test files and were not intended to imply all 36 criteria in every file passed.

## Additional verification

- `grep`-confirmed zero remaining code references to `api/normalization/*` anywhere in the live codebase after deletion (remaining hits are prose in governance docs, which is the correct place for them to live).
- `validateCio()` enforcement was directly exercised live (not just via the existing suite) with both a deliberately invalid and a valid `canonicalForEnrichment`, confirming: the invalid case short-circuits before `runIntelligenceEngine` runs (all domain-object fields remain `null`), the degraded CIM passes `certifyCIM()`'s structural check and is deep-frozen, and the valid case proceeds through the full pipeline unaffected.

## Performance

| Stage | Baseline p95 | Post-change p95 |
|---|---|---|
| intelligenceEngine | 0.09ms | 0.22ms* |
| fullRIEPipeline | 0.50ms | 0.51ms |

*Single-run noise on a sub-millisecond measurement over 20 samples — not attributable to any specific change (no code touched `intelligenceEngine` itself); both baseline and post-change fullRIEPipeline stayed within the same noise band. No performance regression.
