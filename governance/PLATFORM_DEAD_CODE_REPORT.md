# Platform Dead Code Report — ROYALTĒ v3.0 §2 — Discovery

**Status:** DISCOVERY ONLY, companion to `PLATFORM_REFACTORING_DISCOVERY_REPORT.md`. "Dead" below means: verified via exhaustive `grep` (relative-path, package-style, and re-export forms) to have zero importers outside its own test file(s) and its own directory. Nothing was deleted in this pass.

## 1. Entire Directories With Zero Production Importers

| Directory | Sprint / origin | Only importers found |
|---|---|---|
| `api/registry/` (2,656 lines: `index.js`, `objects.js`, `types.js`, `validate.js`, `version.js`, `fields/*`) | Sprint 1 | `api/normalization/index.js:39`, `api/resolution/index.js:5`, `api/mission-control-api/index.js:12,92` — each of which is *itself* dead (see below), so this is a dead chain, not a live consumer |
| `api/evidence/` | Sprint 2/3 | `api/normalization/normalized-record.js:23`, test files |
| `api/normalization/` | Sprint 4 | `tests/` only |
| `api/resolution/` | Sprint 5 | `tests/` only |
| `api/orchestrator/` | Sprint 7 | `tests/orchestrator-test.mjs` only; `DEFAULT_STAGE_EXECUTORS` (`index.js:16-22`) are all `stub: true` — never replaced with real implementations because nothing calls `createScanOrchestrator` |
| `monitoring/{diff,events,policy,snapshot,intelligence}/` | Sprint 8 | `tests/certification/suites/14-monitoring.mjs` only |
| `api/mission-control-api/` | Sprint 9 | `tests/mission-control-api-test.mjs` only — not called from any top-level `api/*.js` handler, not called from `api/mission-control-integration/` |
| `api/athena/` | Sprint 10 | `tests/` only; `createAthenaEngine()` (`index.js:22`) has zero importers |
| `api/executive-brief/` | Sprint 11 | `tests/` only |
| `api/mission-control-integration/` | Sprint 12 | `tests/mission-control-integration-test.mjs` only; `bindAllWorkspaces()`, documented as "sole entrypoint" for wiring workspace data, is never called — live wiring is the hand-rolled `window.__mcPopulate`/`window.__mcRevealModule` pair in `public/js/mission-control.js:1353,1487` |

**Governance gap:** `governance/MIGRATION_RETIREMENT_REGISTER.md`'s own stated rule is *"`READY FOR RETIREMENT` = Zero active callers."* By that rule, all nine directories above qualify for a retirement-register entry, yet none currently has one. This is a documentation gap worth closing regardless of which way the Board rules on wiring-vs-retiring (see Discovery Report §6).

## 2. Dead Top-Level API Handlers

- **`api/discogs.js`** (437 lines) — zero importers anywhere (`enrichWithDiscogs` etc. only self-referenced). Superseded by PAL: `api/_lib/run-scan.js:46,237` routes Discogs acquisition through `api/_lib/discogs-pal-acquisition.js`.
- **`api/tidal-token.js`** (107 lines) — zero importers. `api/_lib/tidal-pal-acquisition.js` gets its own token via `provider-acquisition/connectors/tidal/TidalConnector.js`, never referencing this file.
- **`api/territory-scan.js`** (609 lines) — zero HTTP callers and zero module importers found anywhere (`public/`, `api/`, `lib/`). Already flagged as an open question in `governance/PHASE_5_2_IMPLEMENTATION_CHECKPOINT_DEAD_CODE_FINDING.md`, never resolved since. Notably, this is also the file `api/submit-audit.js:8` cites as the template it copy-pasted its Supabase client setup from (see Duplicate Code Report §4) — i.e. live code is patterned after dead code.
- **`api/mlc-test.js`** (236 lines) — self-documented as a Phase-1 diagnostic probe ("no UI consumer" per its own header comment); confirmed zero references elsewhere.

## 3. Retired-But-Undeleted Legacy Functions Inside `api/_lib/run-scan.js`

Roughly 400 lines, each already marked `[RETIRED CANDIDATE]` in a preceding comment but never removed:

- `getSpotifyAlbums()` — `run-scan.js:824-833`
- `getSpotifyTopTracks()` — `run-scan.js:837-…` (marked `[RETIRED CANDIDATE — Phase 3.6]`, comment at `:835-836`)
- `getYouTube()` — `run-scan.js:866-889` (marked *"Retained for emergency fallback only. Remove after Board approval."*, comment at `:864-865`)
- `getMusicBrainz()` — `run-scan.js:1262-1288`
- `getDeezer()` — `run-scan.js:1289-1365`
- `getAudioDB()` — `run-scan.js:1366-1397`
- `getDiscogs()` — `run-scan.js:1398-1425`
- `getLastFm()` — `run-scan.js:1452-1477`

Confirmed dead via `grep -n "\bfnName("` per function — only each function's own `function` declaration line matches; `runScan` is the file's sole export.

## 4. Zero-Importer Connectors and Governance Files

- **`provider-acquisition/registry/EngineProviderRegistry.js`** (499 lines) — zero importers anywhere (`grep -rn "EngineProviderRegistry"` returns only its own header comment). Its five exported query functions (`getProvider`, `getProvidersByEngineGroup`, `getProvidersByStatus`, `getUncertifiedProviders`, `getUnmigratedProviders`) are all unreachable at runtime. The file self-describes its audience as "the Board, developers... governance" — it may be intentional documentation-as-code, but as written it's a `.js` file with a full runtime API nothing calls. Worth a Board ruling: either give it a real consumer or convert it to `.md`.
- **`ACRCloudConnector.js`** and **`ACRCloudAIDetectionConnector.js`** — zero `api/` importers outside their own `__tests__`. Both are fully built with README documentation citing Board Authorization (Phase 3.9 and Phase 5.0 respectively), matching the established "dormant until Board activation brief" pattern used elsewhere in this codebase — likely intentional, but nothing in the code itself marks them `DORMANT` vs. abandoned; that distinction currently lives only in README prose.
- **`lib/publishing/resolver.js`** (`resolvePublishing`, line 41) and its sole dependency **`lib/publishing/providers/mlc-resolver.js`** — zero external callers. Live pipeline (`api/audit.js:33-34`) calls `mlc-client.js`/`mlc-adapter.js` directly, bypassing this multi-strategy resolution orchestrator entirely.
- **`api/lib/health-score.js`** (`computeV2HealthScore`) — zero importers; superseded per the "One Health Engine" directive (Phase 3.2), never deleted.
- **`monitoring/intelligence/MonitoringIntelligence.js`** — zero importers; string matches elsewhere are function names / registry labels, not imports of this file.

## 5. Flagged For Follow-Up, Not Independently Re-Verified

`provider-acquisition/health/` and `provider-acquisition/trust/` showed no non-test importers in a single top-level grep pass — flagged here for a closer second look in any implementation phase, not asserted as confirmed dead given only one research pass checked them.
