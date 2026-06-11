# Royaltē Changelog

**Status:** append-only architectural history of every merge into `main`.
**Authority:** subordinate to `constitution/ROYALTE_MASTER_CONSTITUTION.md`.

Format follows the spirit of [Keep a Changelog](https://keepachangelog.com), adapted for the Board's required fields:

- **Date** — date of merge into `main`
- **PR Number** — GitHub pull request
- **Commit SHA** — short merge SHA on `main`
- **Added** — files / capabilities introduced
- **Changed** — files / behaviour modified
- **Removed** — files / capabilities retired
- **Constitution Version** — Constitution at the moment of merge

Entries are listed **newest first** for ease of catching up. Older entries are never edited; corrections are appended.

The Phase 1 probe iterations (PRs #123, #124, #125) are listed individually because each landed a distinct architectural improvement.

---

## 2026-06-11 — Repository Governance Layer™ established

| | |
|---|---|
| **PR** | #133 |
| **Commit SHA** | `60e76ef` |
| **Constitution Version** | v1.3 |
| **Added** | `governance/AGENT_MEMORY.md`, `governance/BOARD_DECISIONS.md`, `governance/ROADMAP.md`, `governance/CHANGELOG.md` (this file), `governance/EXECUTIVE_BOARD.md`. New constitutional rule recorded in `AGENT_MEMORY.md` § 9 binding every future architectural Phase merge to governance updates. AI Startup Order documented. Executive Board roster captured with first-draft titles pending Board confirmation. |
| **Changed** | none |
| **Removed** | none |

---

## 2026-06-11 — Constitution v1.3 + Engineering Stack documentation

| | |
|---|---|
| **PR** | #132 |
| **Commit SHA** | `33edba6` |
| **Constitution Version** | **v1.3** |
| **Added** | `docs/ROYALTE_ENGINEERING_STACK.md` (long-form companion to Constitution § 8B) |
| **Changed** | `constitution/ROYALTE_MASTER_CONSTITUTION.md` — version 1.2 → 1.3; revision-history entry; **new Section 8B — Royaltē Engineering Stack™** (sub-sections 8B.0–8B.9) |
| **Removed** | none |

---

## 2026-06-11 — Phase 6: Royaltē Intelligence Engine™ (generic rule executor)

| | |
|---|---|
| **PR** | #131 |
| **Commit SHA** | `a23788b` |
| **Tag** | `intelligence-engine-v1.0` |
| **Constitution Version** | v1.2 (at merge) → v1.3 (post-Section-8B) |
| **Added** | `api/_lib/intelligence-engine.js`, `api/schema/intelligence.js`, `tests/intelligence-engine-test.mjs` (30 deterministic assertions) |
| **Changed** | none |
| **Removed** | none |

---

## 2026-06-11 — Phase 5: Royaltē Rule Library™

| | |
|---|---|
| **PR** | #130 |
| **Commit SHA** | `8907bd6` |
| **Constitution Version** | v1.2 (at merge) → v1.3 (post-Section-8B) |
| **Added** | `api/rules/identity-rules.js`, `api/rules/publishing-rules.js`, `api/rules/catalog-rules.js`, `api/rules/metadata-rules.js`, `api/rules/index.js`, `tests/rule-library-test.mjs` (29 deterministic assertions) |
| **Changed** | none |
| **Removed** | none |

---

## 2026-06-11 — Close PR #129 (architecturally superseded Intelligence Engine v1)

| | |
|---|---|
| **PR** | #129 (closed without merge) |
| **Commit SHA** | — |
| **Constitution Version** | v1.2 |
| **Added** | none |
| **Changed** | none |
| **Removed** | none. PR was the first proposed Phase-5 Intelligence Engine; it hardcoded rules inside engine logic, violating the constitutional separation. Work has been redone as PR #130 (Rule Library) + PR #131 (generic engine). `main` was never affected by this branch. |

---

## 2026-06-10 — Phase 4: Canonical Intelligence Assembly Engine™

| | |
|---|---|
| **PR** | #128 |
| **Commit SHA** | `a3c78d7` |
| **Constitution Version** | v1.2 |
| **Added** | `api/_lib/cio-assembler.js`, `api/schema/cio.js`, `tests/cio-assembler-test.mjs` (17 deterministic assertions) |
| **Changed** | none |
| **Removed** | none |

---

## 2026-06-10 — Phase 3: Royaltē Identity Graph™ (Publishing Layer)

| | |
|---|---|
| **PR** | #127 |
| **Commit SHA** | `bf12b5a` |
| **Constitution Version** | v1.2 |
| **Added** | `tests/identity-graph-publishing-test.mjs` (23 deterministic assertions). New public API on `api/_lib/identity-graph.js`: `addPublishingWork`, `getPublishingWorks`, `getCompositionByISWC`, `getCompositionByProviderId`, `getWriterByIPI`, `linkRecordingToComposition`, `getCompositionsForRecording`, `getRecordingsForComposition`. New schema: `CompositionNode` with `royalteId` + `externalIds{mlc, socan, ascap, bmi, cisac, musicbrainz}`. |
| **Changed** | `api/_lib/identity-graph.js` extended (additive; original YouTube exports byte-identical). |
| **Removed** | none |

---

## 2026-06-10 — Phase 2: Royaltē Publishing Intelligence Adapter™

| | |
|---|---|
| **PR** | #126 |
| **Commit SHA** | `bca9e68` |
| **Tag** | `mlc-publishing-adapter-v1.0` |
| **Constitution Version** | v1.2 |
| **Added** | `lib/publishing/mlc-adapter.js`, `tests/publishing-adapter-test.mjs` (20 deterministic assertions). Public API: `normalizeMlcWork`, `normalizeMlcWorks`, `validatePublishingWork`. |
| **Changed** | none |
| **Removed** | none |

---

## 2026-06-10 — Phase 1 (Step 3): `/api/mlc-test` body-shape probe — `writers[]` required

| | |
|---|---|
| **PR** | #125 |
| **Commit SHA** | (merged to main) |
| **Constitution Version** | v1.2 |
| **Added** | none |
| **Changed** | `api/mlc-test.js` — sends `{ title, writers: [] }` by default; `?writers=ed` populates a synthetic writer for Ed Sheeran. Empirically discovered: MLC's API Gateway validator rejects body without `writers` populated; sending populated `writers` returns 200 with real publishing data (`mlcSongCode`, `workTitle`, `iswc`, `writers[]` including `writerIPI`). Phase 1 connectivity proven end-to-end. |
| **Removed** | none |

---

## 2026-06-10 — Phase 1 (Step 2): `/api/mlc-test` Bearer source — idToken vs accessToken

| | |
|---|---|
| **PR** | #124 |
| **Commit SHA** | (merged to main) |
| **Constitution Version** | v1.2 |
| **Added** | none |
| **Changed** | `api/mlc-test.js` — default Bearer JWT switched from `accessToken` to `idToken` (Cognito + API Gateway authorizer validates `idToken`). `?bearer=access` retained for completeness. |
| **Removed** | none |

---

## 2026-06-10 — Phase 1 (Step 1): `/api/mlc-test` OAuth two-step flow

| | |
|---|---|
| **PR** | #123 |
| **Commit SHA** | (merged to main) |
| **Constitution Version** | v1.2 |
| **Added** | `api/mlc-test.js` — probe endpoint implementing the documented OAuth flow: `POST /oauth/token` with `{ username, password }` → `accessToken` + `idToken`; subsequent `POST /search/songcode` with `Authorization: Bearer <token>`. Reads `MLC_USERNAME` / `MLC_PASSWORD` (Production-scoped) from Vercel env vars. |
| **Changed** | none |
| **Removed** | `MLC_API_KEY` (CEO action — Vercel reported as duplicate of `MLC_PASSWORD`) |

---

## How to add a new entry (template)

Copy this stub to the **top** of the changelog on every merge into `main`:

```markdown
## YYYY-MM-DD — <merge title>

| | |
|---|---|
| **PR** | #<number> |
| **Commit SHA** | `<short sha>` |
| **Constitution Version** | v1.<x> |
| **Added** | <files / capabilities> |
| **Changed** | <files / behaviour> |
| **Removed** | <files / capabilities> |
```

Never overwrite an existing entry. Per governance rule (see `AGENT_MEMORY.md` § 9), every merge must include this entry.
