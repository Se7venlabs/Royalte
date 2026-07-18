# Platform Dependency Map — ROYALTĒ v3.0 §2 — Discovery

**Status:** DISCOVERY ONLY, companion to `PLATFORM_REFACTORING_DISCOVERY_REPORT.md`. Reflects the repository as audited 2026-07-18. Every edge below was confirmed by `grep` for actual import statements (not inferred from naming or governance-doc claims); "zero importers" claims were checked exhaustively across relative-path, package-style, and re-export forms.

Two legends are used throughout: **LIVE** = reachable from `api/audit.js`, the entrypoint for the free scan (`GET /api/audit`), the only path artists actually exercise today. **DORMANT** = fully built, tested in isolation, zero production callers.

## 1. Live Production Path

```
api/audit.js
 └─ api/_lib/run-scan.js  (1,739 lines; self-labeled "the scan orchestrator", unrelated to api/orchestrator/)
     ├─ 10x api/_lib/*-pal-acquisition.js  (Apple, Spotify, Deezer, Discogs, YouTube, MusicBrainz, AudioDB, MLC, Last.fm, TIDAL)
     │   └─ provider-acquisition/pal/ProviderAcquisitionLayer.js
     │       ├─ provider-acquisition/registry/ProviderRegistry.js (runtime, per-scan, ephemeral)
     │       ├─ provider-acquisition/connector/lifecycle.js → RegistryEntry.js
     │       └─ provider-acquisition/connectors/<provider>/<Provider>Connector.js
     │           └─ provider-acquisition/connectors/<provider>/<provider>-http.js (own retry/backoff copy — see Duplicate Code Report)
     ├─ inline (non-PAL) fetch calls: getSoundCloud() [:1426], getWikidata() [:1478]
     └─ lib/rie/index.js
         ├─ api/_lib/cio-assembler.js
         ├─ api/rules/index.js
         ├─ api/_lib/{identity,publishing,catalog,territory,backend,health,royalte-ai,monitoring}-intelligence.js
         ├─ api/_lib/health-engine.js
         ├─ api/_lib/executive-brief-engine.js
         ├─ lib/rie/EvidenceBridge.js → provider-acquisition/capability/
         └─ lib/recording/recording-intelligence.js
             └─ lib/recording/{recording-confidence.js, recording-confidence-policy.js, title-normalizer.js}
 └─ lib/publishing/mlc-client.js  (also called from api/_lib/publishing-title-extractor.js)
```

`api/_lib/listen-notes.js` is separate from the above — invoked only from `api/_lib/podcast-intelligence.js`, gated by `isMonitoringSubscriber()`, monitoring-plan only per CLAUDE.md; not part of the free-scan fan-out.

## 2. Dormant Stack (built, certified in isolation, zero production callers)

| Component | Sprint | Imports from | Imported by (production) | Imported by (test only) |
|---|---|---|---|---|
| `api/registry/` (2,656 lines) | 1 | nothing external | **none** | `api/normalization/`, `api/resolution/`, `api/mission-control-api/` (each imports `api/registry` transitively, but nothing calls *them*) |
| `api/evidence/` | 2 | nothing external | **none** | `api/normalization/normalized-record.js`, test files |
| `api/normalization/` | 4 | `api/registry`, `api/evidence` | **none** | `tests/` |
| `api/resolution/` | 5 | `api/registry` | **none** | `tests/` |
| `api/orchestrator/` | 7 | `node:crypto` only; stage executors are stubs (`stub: true`, `index.js:16-22`) | **none** | `tests/orchestrator-test.mjs` |
| `monitoring/{diff,events,policy,snapshot,intelligence}/` | 8 | internal cross-imports only | **none** | `tests/certification/suites/14-monitoring.mjs` |
| `api/mission-control-api/` | 9 | `api/registry` (via `registry.js`) | **none** | `tests/mission-control-api-test.mjs` |
| `api/athena/` | 10 | nothing external | **none** | `tests/` |
| `api/executive-brief/` | 11 | nothing external | **none** | `tests/` |
| `api/mission-control-integration/` | 12 | nothing (by design — takes `apiResponses` as parameters) | **none** | `tests/mission-control-integration-test.mjs` |
| `provider-acquisition/registry/EngineProviderRegistry.js` | §1 | `capability/capabilityVocabulary.js` | **none** | none (governance/doc artifact) |
| `lib/publishing/resolver.js` + `lib/publishing/providers/mlc-resolver.js` | — | each other, `lib/publishing/mlc-adapter.js` | **none** | none found |
| `provider-acquisition/connectors/acrcloud/ACRCloudConnector.js` | 3.9 | own `-http.js`/`-capabilities.js` | **none** | own `__tests__` |
| `provider-acquisition/connectors/acrcloud-ai-detection/ACRCloudAIDetectionConnector.js` | 5.0 | own `-http.js`/`-capabilities.js` | **none** | own `__tests__` |

## 3. Frontend (Mission Control) Dependency Chain

```
public/mission-control.html
 └─ public/js/mission-control.js  (type=module)
     ├─ mission-control-renderers.js
     ├─ royalte-image-service.js
     ├─ mc-preview-payload.js  (dynamic import)
     ├─ mc-workspace-context.js  (8 referencing files)
     ├─ mc-intelligence-utils.js
     ├─ vault-auth.js
     └─ window.__mcPopulate / window.__mcRevealModule  (hand-rolled wiring — NOT api/mission-control-integration/bindAllWorkspaces())
public/workspaces/*.html  (11 workspace files)
 └─ public/css/royalte-rds.css + public/css/royalte-workspace.css  (all 11)
 └─ per-file inline <style> blocks (5 of 11 files: ai-insights, backend-intelligence, catalog-intelligence, identity-intelligence, publishing-intelligence)
global-music-footprint.html additionally: gmf-distribution-gaps.css/.js, global-map-viewport.js
```

Data source for the frontend: `fetchScanPayload()` in `public/js/mission-control.js:73`, reading `audit_scans.payload` via sessionStorage → localStorage → Supabase (per the P0 MC payload bridge fix, PR #326) — **not** via `api/mission-control-api/` or `api/mission-control-integration/`, both of which sit dormant per §2.

## 4. Registry-Layer Naming Collision (not a code bug, a governance risk)

Two unrelated systems are both informally called "the registry" in code comments:

- `provider-acquisition/registry/{ProviderRegistry,RegistryEntry,EngineProviderRegistry}.js` — PAL runtime bookkeeping + governance provider catalog.
- `api/registry/` — Canonical Intelligence Platform™ field registry (six domains: Identity™, Music Rights™, Catalog™, Distribution Availability™, System Operations™, Monitoring™).

`EngineProviderRegistry.js:9-35` already contains a comment warning about this distinction. Nothing in code enforces it beyond that comment.

## 5. PAL Sub-Areas With No Non-Test Importers (flagged, not fully re-verified)

`provider-acquisition/health/` and `provider-acquisition/trust/` showed no importers outside PAL itself in a top-level grep during this pass. Unlike the Sprint 1–12 findings above, this was not independently cross-checked by a second research pass — flagged for a closer look in any follow-up implementation phase rather than asserted as confirmed dead code here.
