# Royaltē Agent Memory

**Status:** institutional memory for every AI agent operating in this repository.
**Authority:** subordinate to `constitution/ROYALTE_MASTER_CONSTITUTION.md` § entire document.
**Effective:** 2026-06-11

This is the **second document** every AI shall read after the Master Constitution. It captures the current state of the platform, the Engineering Stack, the Executive Board, and the governance process every AI is expected to follow.

When the Constitution and this document disagree, **the Constitution wins.**

---

## 1. Current Constitution

| | |
|---|---|
| Path | `constitution/ROYALTE_MASTER_CONSTITUTION.md` |
| Version | **v1.3** |
| Effective | 2026-06-11 |
| Last ratifying PR | #132 |
| Companion document | `docs/ROYALTE_ENGINEERING_STACK.md` |

Prior versions are **not** preserved as separate files; their substance lives in the in-document Revision History. The repository shall contain exactly one constitutional authority.

---

## 2. Current Build Phase

| | |
|---|---|
| Most recently locked phase | **Phase 7 — Royaltē Health Engine™** |
| Locked at | (set on merge) |
| Tag | — |
| Effective | 2026-06-11 |
| Next anticipated phase | per future Board directives (no brief authorised yet) |

Phase 6 lock point: `a23788b` / tag `intelligence-engine-v1.0`. Phase 6.5 lock point: `52b1750`.

The full phase ledger lives in `governance/ROADMAP.md`. The merge history lives in `governance/CHANGELOG.md`.

---

## 3. Engineering Stack

The seven-layer architecture ratified in Constitution Section 8B:

```
1. Providers
       ↓
2. Normalization Adapters             lib/publishing/*-adapter.js
       ↓
3. Royaltē Identity Graph™            api/_lib/identity-graph.js
       ↓
4. Canonical Intelligence Assembly™   api/_lib/cio-assembler.js
       ↓
5. Canonical Intelligence Object™     (deep-frozen artifact)
       ↓
6. Royaltē Rule Library™              api/rules/*
       ↓
7. Royaltē Intelligence Engine™       api/_lib/intelligence-engine.js
       ↓
8. Consumers
```

Per-layer file paths, public APIs, and lock points are documented in `docs/ROYALTE_ENGINEERING_STACK.md`.

**Constitutional separation (non-negotiable):**
- **Knowledge** belongs in the Rule Library.
- **Execution** belongs in the Intelligence Engine.
- **Presentation** belongs in consumers.

Mixing these is constitutionally rejected.

---

## 4. Executive Board

Full Board roster — including titles, responsibilities, and authorities — lives in `governance/EXECUTIVE_BOARD.md`. Briefs may quote the Board collectively ("Board Directive") or call out a specific Executive when their domain applies.

---

## 5. Product Philosophy

- **Category:** Music Backend Intelligence™
- **Mission:** Royaltē shows artists what is broken between the music and the money.
- **Constitutional motto:** *Clarity Creates Control. Intelligence Creates Value.*
- **Engineering motto:** *One Adapter. One Graph. One CIO. One Library. One Engine. One Platform.*

Royaltē verifies intelligence; Royaltē does not estimate intelligence. Every number must be traceable and defensible. (Constitution § 6, § 8B.6.)

---

## 6. Current Architecture (file map)

| Layer | File | Lock |
|---|---|---|
| Phase 2 — Publishing Adapter | `lib/publishing/mlc-adapter.js` | `mlc-publishing-adapter-v1.0` (`bca9e68`) |
| Phase 3 — Identity Graph | `api/_lib/identity-graph.js` | `bf12b5a` |
| Phase 4 — CIO Assembler | `api/_lib/cio-assembler.js` + `api/schema/cio.js` | `a3c78d7` |
| Phase 5 — Rule Library | `api/rules/*` | `8907bd6` (+ Phase 6.5 polarity amendment — see below) |
| Phase 6 — Intelligence Engine | `api/_lib/intelligence-engine.js` + `api/schema/intelligence.js` | `intelligence-engine-v1.0` (`a23788b`) |
| Phase 6.5 — Golden Fixture Library | `tests/fixtures/*` + `tests/golden-fixture-test.mjs` | `52b1750` |
| Phase 7 — Health Engine | `api/_lib/health-engine.js` + `api/schema/health.js` | (set on merge) |

Test suites (12, all deterministic) live under `tests/`. Pipeline regression is enforced by GitHub Actions on every PR.

**Health Engine ≠ legacy V2 health score.** `api/_lib/persist-os-scan.js::computeV2HealthScore` is the locked V2-surface health score derived from raw scan signals at persist time (Brief 012a, 2026-05-29). The new Phase 7 Health Engine at `api/_lib/health-engine.js` scores Intelligence Reports (Phase 6 output) — different inputs, different consumers, different surfaces. They coexist; the V2 score is not deprecated. Future consolidation is a future Board decision.

**Phase 5 rule format addendum (Phase 6.5):** rules may carry an optional `polarity: 'positive'` field. When present, the rule's observation is routed to `engineOutput.strengths[]` by the Phase 6 engine (in addition to `observations[]`). Currently applied to `publishing.strong-coverage` and `catalog.complete-delivery-verified`. Backward compatible — rules without `polarity` behave exactly as before.

**Golden Fixture rule:** Fixtures under `tests/fixtures/` are immutable. They carry `_fixtureVersion` and are versioned forward; never overwritten. New canonical states are added as new files; evolving an existing one means adding `-v2.json` alongside the original.

---

## 7. Strategic Direction

| | |
|---|---|
| Scan Experience V1 | **DESIGN FROZEN** (PR #122 held; will merge when intel wiring is complete) |
| Intelligence-Wiring Sprint | Phases 1–6 **COMPLETE** |
| Next | Phase 7 — wire `runIntelligenceEngine` into `/api/audit`. No brief authorised yet. |
| Beta target | June 1, 2026 (per `LAUNCH_CHECKLIST.md`) |
| Live intelligence sources to wire (per Board roadmap) | Spotify · Apple Music · MusicBrainz · Discogs · Listen Notes · YouTube · MLC Public API · MLC Bulk Data Feed |

---

## 8. AI Startup Sequence

Every Royaltē AI shall initialize using this order on every session:

1. `constitution/ROYALTE_MASTER_CONSTITUTION.md`
2. `governance/AGENT_MEMORY.md` (this document)
3. `governance/ROADMAP.md`
4. `governance/BOARD_DECISIONS.md`
5. Current Assignment (the brief or task at hand)

This is the standard onboarding procedure for every AI system used by Se7ven Labs.

---

## 9. Governance Update Policy

**New Constitutional Rule** ratified by Board Directive 2026-06-11:

> No architectural Phase may be considered complete until:
> 1. Governance files updated
> 2. `governance/ROADMAP.md` updated
> 3. `governance/BOARD_DECISIONS.md` updated with the Board's authorising decision
> 4. `governance/CHANGELOG.md` updated with the merge entry
> 5. `governance/AGENT_MEMORY.md` updated (this file) where the phase changes the platform's current state
>
> **Only then may the PR be merged into main.**

`BOARD_DECISIONS.md` and `CHANGELOG.md` are **append-only**: existing entries are never edited; new entries are added at the end (or at the top of the chronological section per file convention).

`AGENT_MEMORY.md`, `ROADMAP.md`, and `EXECUTIVE_BOARD.md` are **living documents**: they may be revised to reflect current state, but historical context is preserved via Board Decisions and Changelog references.

---

## 10. Out-of-Scope Reminders

What this governance layer is **not**:

- Not a substitute for the Master Constitution. The Constitution governs principles; this layer governs operational state.
- Not a substitute for `MEMORY.md`-style auto-memory inside any specific AI tool. Local AI tooling memory is per-tool and per-session; this governance layer is per-repository and per-platform.
- Not a place to embed business logic, rules, or runtime configuration. All of that lives in code under the Engineering Stack.
