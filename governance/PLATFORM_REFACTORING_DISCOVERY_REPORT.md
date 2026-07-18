# Platform Refactoring™ — ROYALTĒ v3.0 §2 — Discovery Report

**Status:** DISCOVERY ONLY. Zero code changes were made in this pass, per Board resolution (2026-07-18): the brief's audit deliverables (this report + four companions) were produced first; any actual refactoring is deferred to a separate, explicitly-scoped implementation phase (or phases), authorized area-by-area. This mirrors the Phase 5.3 → 5.4 precedent (Territory Intelligence Consolidation discovery, then a separate Refactoring implementation phase).

**Section numbering:** This initiative is **Section 2** of the ROYALTĒ v3.0 Master Plan. Section 1 (Engine Provider Registry) is already merged (`c141c0b`, PR #356); Section 3 (Connect Library) was previously queued as "next" — its scope is subsumed here since the Connect Library (`provider-acquisition/connector/`, `provider-acquisition/connectors/`) was audited as part of the PAL pass below.

**Method:** Four parallel, read-only research passes, one per group of related platform areas, covering all 14 areas named in the brief. Every finding below is grounded in `grep`/file reads performed against the live repository — not reconstructed from memory or governance-doc claims. Zero files were written, edited, or deleted during the audit itself.

| Research group | Platform areas covered |
|---|---|
| A | Provider Acquisition Layer (PAL), Connect Library (`connector/`, `connectors/`), Registry Layer |
| B | Intelligence Engine Framework, Runtime Context |
| C | API Layer, Scan Orchestration |
| D | Workspace Framework, Shared Components, Shared Utilities, Configuration, Environment Management, Testing Infrastructure, Governance |

Full findings live in the four companion documents:

- `governance/PLATFORM_DEPENDENCY_MAP.md`
- `governance/PLATFORM_DUPLICATE_CODE_REPORT.md`
- `governance/PLATFORM_DEAD_CODE_REPORT.md`
- `governance/PLATFORM_REFACTORING_SUMMARY.md` (recommendations + proposed phased roadmap)
- `governance/PLATFORM_ARCHITECTURE_AS_BUILT.md` (reconciled architecture diagram)

---

## 1. Headline Finding: A Second, Unwired Platform Exists Alongside the Live One

All four research groups independently converged on the same structural finding from different angles, which is why it is reported once here rather than four times:

**The Canonical Intelligence Platform™ — the stack ratified across Sprints 1 through 12 (Registry Layer, Evidence Contracts, Evidence Registry, Normalization Engine, Resolution Engine, Canonical Intelligence Domains, Scan Orchestrator, Monitoring Engine, Mission Control Data API, ATHENA Intelligence Engine, Executive Brief Engine, Mission Control Integration Layer) — has zero load-bearing edges into the code path that actually runs when an artist scan executes.**

The live production pipeline is a separate, older architecture:

```
api/audit.js → api/_lib/run-scan.js → lib/rie/index.js → api/_lib/{identity,publishing,catalog,territory,backend,health,royalte-ai,monitoring}-intelligence.js
                                                          → api/_lib/executive-brief-engine.js
                                                          → api/_lib/cio-assembler.js, api/rules/
```

None of these live files import `api/registry/`, `api/normalization/`, `api/resolution/`, `api/orchestrator/`, `api/mission-control-api/`, `api/mission-control-integration/`, `api/athena/`, `api/executive-brief/`, or `monitoring/{diff,events,policy,snapshot,intelligence}/`. Each of those nine directories is imported only by its own test file(s) — confirmed independently by three of the four research groups via exhaustive `grep` for every plausible import-path form (relative paths, package-style paths, re-export chains).

Two governance artifacts already gesture at this without stating it outright:

- `governance/PHASE_5_2_IMPLEMENTATION_CHECKPOINT_DEAD_CODE_FINDING.md` flags `api/territory-scan.js` as a possible dead-code question, never resolved.
- `api/mission-control-integration/index.js:8` and `api/executive-brief/index.js:7` carry a comment — *"Never imports from `api/evidence`, `api/registry`, `api/normalization`..."* — documenting a constitutional boundary rule. That rule is not being violated; it's simply never being exercised, because nothing calls these modules from the live path in either direction.

**Board Decision reference:** `governance/BOARD_DECISIONS.md:88` states the Mission Control Data API™ is "the constitutional gateway — no application may communicate directly with the Evidence Registry, Normalization Engine, Resolution Engine, Canonical Intelligence Domains, or Monitoring Engine." In the actual repository, the inverse is true: the gateway and everything behind it sit dark, and the live application reimplements equivalent functionality independently outside the gateway (see §2).

This is not a claim that Sprints 1–12 were built incorrectly — each sprint's own certification suite passes on its own terms (2,000+ combined assertions across the nine directories, per their respective completion reports). It is a claim that **the wiring step connecting this stack to production never happened**, and no governance document currently says so plainly. Companion doc `PLATFORM_ARCHITECTURE_AS_BUILT.md` diagrams both stacks side by side.

## 2. Duplicate "Live" Implementations of "Constitutional" Concepts

Because the ratified stack is unwired, several concerns are implemented twice — once in the dormant Sprint 1–12 stack, once again (independently, without shared code) in the live `api/_lib/` path:

| Concept | Dormant (ratified, Sprint N) | Live (production) |
|---|---|---|
| Monitoring Intelligence | `monitoring/intelligence/MonitoringIntelligence.js` (257 lines, `runMonitoringIntelligence(snapshotA, snapshotB, policy)`) — Sprint 8 | `api/_lib/monitoring-intelligence.js` (128 lines, `{scanNumber, alerts}`) |
| Executive Brief | `api/executive-brief/` (11 files: assembler/sections/recommendations/etc.) — Sprint 11 | `api/_lib/executive-brief-engine.js` |
| Scan pipeline execution | `api/orchestrator/` (11-state lifecycle, 5-stage pipeline, stub executors) — Sprint 7 | `api/_lib/run-scan.js` (1,739 lines, self-describes as "the scan orchestrator" in a comment at line 78 despite no relationship to `api/orchestrator/`) |
| Canonical field ownership | `api/registry/` (2,656 lines: `REGISTRY`, `getField`, `getFieldsByDomain`) — Sprint 1 | No equivalent; field shape is implicit in each `api/_lib/*-intelligence.js` engine's own output object |

Full detail in `PLATFORM_DUPLICATE_CODE_REPORT.md`, which also covers the platform's more conventional duplication (copy-pasted `deepFreeze()`, `assert()` test helpers, Supabase client bootstrap, CORS headers, HTTP retry/backoff in PAL connectors, and a duplicated KPI card CSS component).

## 3. Dead Code Volume

Full inventory in `PLATFORM_DEAD_CODE_REPORT.md`. Order-of-magnitude summary:

- **9 entire directories** with zero production importers (only test-file importers): `api/registry/`, `api/evidence/`, `api/normalization/`, `api/resolution/`, `api/orchestrator/`, `api/athena/`, `api/executive-brief/`, `api/mission-control-api/`, `api/mission-control-integration/`, plus `monitoring/{diff,events,policy,snapshot,intelligence}/` — roughly 8,000+ lines combined (not separately re-verified line-by-line in this pass; each directory's own completion report states its size).
- **4 dead top-level API handler files**: `api/discogs.js` (437 lines, superseded by PAL), `api/tidal-token.js` (107 lines, superseded by PAL), `api/territory-scan.js` (609 lines, flagged but unresolved since Phase 5.2), `api/mlc-test.js` (236 lines, self-documented diagnostic probe).
- **~400 lines of retired-but-undeleted legacy provider functions inside `api/_lib/run-scan.js`** (`getSpotifyAlbums`, `getSpotifyTopTracks`, `getYouTube`, `getMusicBrainz`, `getDeezer`, `getAudioDB`, `getDiscogs`, `getLastFm`), each already marked `[RETIRED CANDIDATE]` in its own preceding comment.
- **Two fully-built, zero-importer connectors**: `ACRCloudConnector.js` and `ACRCloudAIDetectionConnector.js` — likely intentionally dormant pending a Board activation brief (matches the established "dormant until Board brief" pattern used for other connectors), but currently indistinguishable in code from abandoned work.
- **`lib/publishing/resolver.js`** and its dependency **`lib/publishing/providers/mlc-resolver.js`** — a full alternate MLC-acquisition path with zero callers; the live path goes through `lib/publishing/mlc-client.js` directly.
- **`api/lib/health-score.js`** (`computeV2HealthScore`) — zero importers, superseded by the "One Health Engine" directive (Phase 3.2).

## 4. Confirmed Pre-Existing Findings, Still True

- SoundCloud's hardcoded `client_id` is still live at `api/_lib/run-scan.js:1429` — unchanged since the Engine Provider Registry audit (§1 completion report) first documented it. No `SOUNDCLOUD_CLIENT_ID` env var exists anywhere in the repo.
- SoundCloud and Wikidata remain unmigrated to PAL, calling `fetch()` directly from `api/_lib/run-scan.js` (`getSoundCloud()` line 1426, `getWikidata()` line 1478), each returning a different response shape (`{found: false}`) than the PAL evidence-contract convention used by the 12 migrated connectors.

## 5. What Is Genuinely Healthy

Not everything audited is broken. Worth stating plainly so the Refactoring Summary's recommendations are read in proportion:

- The **PAL connector layer itself** (`provider-acquisition/connectors/*`) has no circular or backwards dependencies, is 100% ESM-consistent, and uses one consistent error-handling convention (`{ok, status, healthState, error}`, never throws) across all 12 migrated connectors.
- The **Registry Layer's runtime files** (`ProviderRegistry.js`, `RegistryEntry.js`) remain untouched and correctly isolated from the newer `EngineProviderRegistry.js` governance catalog, exactly as designed in Phase §1.
- **Workspace HTML files** are all reachable and referenced — no orphaned workspace pages were found.
- The **live production pipeline itself** (`lib/rie/` → `api/_lib/*-intelligence.js`), despite running in parallel to the unwired constitutional stack, is internally coherent: one CIO assembled once, engines called consistently, deep-freezing applied consistently within that stack (separately from the shallow-freeze convention used in the dormant Sprint 4/5 code).

## 6. Recommendation

See `governance/PLATFORM_REFACTORING_SUMMARY.md` for the proposed phased roadmap. The central open question for the Board is strategic, not mechanical: **does the Sprint 1–12 stack get wired into production, or retired?** Every duplicate-implementation and dead-code finding above is downstream of that one decision — deleting the dormant stack and formalizing the live one is a fundamentally different refactor than wiring the dormant stack in and retiring the live one. No code should move until that call is made.
