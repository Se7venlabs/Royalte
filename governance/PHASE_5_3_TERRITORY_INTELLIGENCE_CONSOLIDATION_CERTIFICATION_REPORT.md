# Phase 5.3 — Territory Intelligence Consolidation & Platform Certification

**Classification:** Governance Initiative (Discovery & Architecture)
**Status:** Discovery complete — returned to the Board for review
**Implementation:** Not performed. Not authorized by this report.
**Nature of this document:** Discovery only. No production code, configuration, or dependency was modified in producing this report. See §7 for the exact repository-state confirmation the Board requested.

---

## 1. Executive Summary

**Overall platform readiness: Certified with Minor Refactoring.**

The core Phase 5.2 promise holds under independent re-verification: `api/_lib/territory-intelligence.js` is the sole *acquisition* path for Apple storefront data (re-confirmed — no second network-calling implementation was found anywhere in the platform), and every primary, currently-active consumer surface (Mission Control's live rendering path, Global Music Footprint™, Distribution Gaps™, the live Royaltē AI assembler, Health Intelligence, `api/territory-scan.js`, both PDF/export renderers, Identity Intelligence, Publishing Intelligence) reads the Engine's output correctly and computes nothing independently.

Three real issues survived verification, none of them a re-emergence of the acquisition-duplication problem Phase 5.2 fixed:

1. **One live, user-facing architecture violation**: `public/js/dashboard.js`'s "Global Presence" card independently classifies territory availability from a deprecated, now-permanently-`null` field, silently rendering broken data on `/dashboard.html`.
2. **One live landmine**: `api/_lib/delta-engine.js`'s territory-change-detection logic is wired into every scan but starved of real input by an unrelated field nulling elsewhere in the platform — dormant today, but a duplicate-logic risk the moment anything re-populates that field from outside the Engine.
3. **One live *interpretation* duplication** (distinct from *acquisition* duplication): `lib/rie/EvidenceBridge.js` independently re-classifies the same PAL evidence the Engine already classifies, using a cruder two-state model, to populate a legacy V1 payload shape — no extra API calls, but a second, less rigorous judgment of the same data, in direct tension with that file's own stated constitutional constraint.

Everything else found (an entire unwired Sprint 10 ATHENA engine, a retired V2 health-score module, a second unreferenced monitoring engine, several dead schema fields) is confirmed-dead code with no live risk — safe to leave, but worth an explicit disposition so nothing gets silently reactivated.

**No production merge, deploy, commit, or code change occurred in producing this report.**

---

## 2. Consumer Inventory

Classification per the Board's evidence standard — runtime ownership verified via caller tracing, not keyword matching.

| Consumer | File | Classification | Evidence | Risk |
|---|---|---|---|---|
| Territory Intelligence Engine™ | `api/_lib/territory-intelligence.js` | **Provider Acquisition** (authoritative source) | `assembleTerritoryIntelligence()` — 5-state model, sole owner | — |
| Apple PAL acquisition | `api/_lib/apple-pal-acquisition.js` (`acquireAppleEvidence`), `provider-acquisition/connectors/apple-music/AppleMusicConnector.js` | **Provider Acquisition** | Sole live network-calling path for Apple storefront data; re-confirmed no second acquisition path exists anywhere | — |
| Global Music Footprint™ (primary path) | `api/_lib/global-music-footprint.js:221-244` | **Certified Consumer** | Consumes `territoryIntelligence` exclusively | — |
| Global Music Footprint™ (legacy fallback) | `api/_lib/global-music-footprint.js:246-285` | **Legacy Logic** (dormant/defensive) | Independent recompute from raw canonical data; only reachable if the Engine call itself throws — not exercised on the happy path | Low |
| Distribution Gaps™ | `public/js/gmf-distribution-gaps.js`, `public/workspaces/global-music-footprint.html` | **Certified Consumer** / Presentation Only | Reads `globalMusicFootprint.distributionGaps` only; shows honest empty state if absent | — |
| `api/territory-scan.js` | same | **Certified Consumer** | Calls `acquireAppleEvidence()` + `assembleTerritoryIntelligence()` directly; pure aggregation on top | — |
| Royaltē AI™ Assembler (live) | `api/_lib/royalte-ai-assembler.js` | **Certified Consumer** | Reads only `gmf.confidence`/`status`/`territoriesAvailable` | — |
| ATHENA™ Sprint 10 Engine | `api/athena/*` (11 files) | **Dead Code** | Zero importers anywhere in the repo; touches only an unrelated, unwired `dspCoverage` envelope field | Low |
| Health Intelligence | `api/_lib/health-intelligence.js` (`deriveFootprintScore`) | **Certified Consumer** | Reads only `gmf.coveragePercent` | — |
| Health Engine | `api/_lib/health-engine.js` | **Certified** (no territory involvement) | No Apple/storefront access in file | — |
| Health Score V2 (retired) | `api/lib/health-score.js` (`computeV2HealthScore`) | **Dead Code** (Legacy Logic present in source) | Independent BIG-8 storefront scoring exists in source but zero live importers; explicitly retired per Board Directive comments in 3 other files | Low (dead) |
| Monitoring — Delta Engine | `api/_lib/delta-engine.js` (`emitTerritoryDeltas`) | **Architecture Issue** | Live, invoked every scan; reads `canonical.territoryCoverage`, hardcoded `null` elsewhere — dormant output, live wiring | **Medium** |
| Monitoring Intelligence (live) | `api/_lib/monitoring-intelligence.js` | **Certified Consumer** | Pure pass-through of delta-engine's alert strings | — |
| Monitoring Intelligence (second, unrelated) | `monitoring/intelligence/MonitoringIntelligence.js` | **Dead Code** | Zero callers; no territory-specific logic at all | Low |
| Identity Intelligence | `api/_lib/identity-intelligence.js` | **Certified** (no territory involvement) | Zero references to territory/storefront/market concepts | — |
| Identity storefront field | `api/registry/fields/identity.js` (`identity.storefront`), written at `api/_lib/cio-assembler.js:163` | **Dead-end scalar** | Single write, never read by any assembler; identity-resolution parameter, not availability data | Very Low |
| Publishing Intelligence | `api/_lib/publishing-intelligence.js` | **Certified** (no territory involvement) | Zero references to territory/distribution concepts | — |
| Rights evidence `rightsTerritory` field | `api/evidence/contracts/rights.js:87-93` | **Dead Schema** | Declared, registered for validation; zero connectors ever populate it | Low |
| Distribution Contract/Registry fields | `api/evidence/contracts/distribution.js`, `api/registry/fields/distribution.js` | **Dead Schema** | `territoryStates`/`territorySummary`/`territoryProvidersContributing` declared, never written by any assembler | Low |
| V1 scan orchestrator | `api/_lib/run-scan.js` | **Certified** | Acquires raw evidence only, delegates all territory computation downstream | — |
| Evidence Bridge (legacy shape) | `lib/rie/EvidenceBridge.js` (`translateTerritories`), `api/_lib/apple-pal-acquisition.js` (`synthesizeAppleMusicCompat`) | **Legacy Logic — Interpretation Duplication** | Independently re-classifies the same PAL evidence using a cruder 2-state model to populate the legacy V1 `platforms.appleMusic.details.*` shape; contradicts the file's own "MUST NOT interpret provider responses" constraint | **Medium** |
| Audit request handler | `api/audit.js` | **Certified** | Delegates entirely to `runRIE()` | — |
| Scan persistence | `api/_lib/persist-os-scan.js` | **Certified** | Pass-through extractor of an always-null field; V2 health engine correctly not imported | — |
| Identify / submit-audit endpoints | `api/identify.js`, `api/submit-audit.js` | **Certified** | No territory computation | — |
| Location normalizer | `api/normalization/normalizers/location.js` | **Certified** | Generic ISO code formatting, not availability logic | — |
| Schema files | `api/schema/cio.js`, `api/schema/auditResponse.js`, `api/lib/normalizeAuditResponse.js` | **Certified / Wrapper** | Schema-only or pure field pass-through, no computation | — |
| Audit PDF renderer | `lib/render-audit-pdf.js` | **Certified** / Presentation Only | Reads `payload.globalMusicFootprint` only | — |
| Executive Assessment renderer | `lib/render-executive-assessment.js` | **Certified** / Presentation Only | Reads `payload.globalMusicFootprint` only | — |
| Brand/print PDF | `generate_audit_pdf.py` | **Certified** | `territoryCoverage` always null, never computed; no territory rendering today | — |
| Mission Control preview fixture | `public/js/mc-preview-payload.js` | **Certified** | Static demo data, correctly modeled on the Engine's shape | — |
| Mission Control (live rendering path) | `public/js/mission-control.js`, `public/js/mission-control-renderers.js` | **Certified Consumer** / Presentation Only | `renderGlobalMusicFootprint()` whitelists exactly 5 already-processed fields; `applyFootprintPlan()` writes them to DOM attributes with no computation | — |
| Mission Control footprint DOM writer | `public/js/mission-control.js:352` (`applyFootprintPlan`) | **Presentation Only, currently inert** | Correct data source; target DOM elements (`.mc-globe-territories-count`, `#global-footprint`) don't exist in current `mission-control.html` — orthogonal to territory architecture, caused by the separate MC Executive OS visual freeze | Very Low |
| **Legacy dashboard "Global Presence" card** | `public/js/dashboard.js` (`renderMcGlobalPresence`) | **Architecture Issue — active violation** | Live, called on every dashboard render; independently classifies verified/partial/unavailable per storefront from `platforms.appleMusic.details.storefrontAvailability`, a field hardcoded `null` by the PAL compat layer — never reads `globalMusicFootprint`/`distributionGaps` | **Medium-High** |

---

## 3. Legacy Inventory (ordered by risk)

| # | Location | Reason it exists | Recommended action | Risk |
|---|---|---|---|---|
| 1 | `public/js/dashboard.js` — `renderMcGlobalPresence()` | Pre-dates the Engine; never migrated when `global-music-footprint.js`/`gmf-distribution-gaps.js` were introduced | Rewire to read `payload.globalMusicFootprint`/`distributionGaps` directly (same pattern already proven in `gmf-distribution-gaps.js`), or remove the card if `/dashboard.html` is being superseded by Mission Control | Medium-High |
| 2 | `api/_lib/delta-engine.js` — `emitTerritoryDeltas()` | Predates the Engine; its data source (`canonical.territoryCoverage`) was nulled during an unrelated Health Engine migration, silently orphaning this logic rather than removing it | Either wire `territoryCoverage` from `cim.globalFootprint`/territory-intelligence output so alerts become real, or delete `emitTerritoryDeltas()` outright to remove the landmine | Medium |
| 3 | `lib/rie/EvidenceBridge.js` (`translateTerritories`) + `api/_lib/apple-pal-acquisition.js` (`synthesizeAppleMusicCompat`) | Built as V1-compatibility infrastructure before the Engine existed; never retired once the Engine shipped | Either retire the legacy `globalStorefrontAvailability` V1 field entirely (if nothing needs it once dashboard.js is fixed), or derive it by down-mapping the Engine's already-computed 5-state result instead of re-classifying raw evidence | Medium |
| 4 | `api/_lib/global-music-footprint.js:246-285` (legacy fallback branch) | Defensive fallback written during the Phase 5.2 migration, intentionally kept for safety | Low urgency — candidate for removal now that Phase 5.2 is stable and certified, per the file's own migration-notes intent; Board's call, not a live risk today | Low |
| 5 | `api/lib/health-score.js` (`computeV2HealthScore`) | Superseded by the "One Health Engine" directive (2026-07-02); orphaned rather than deleted | Delete the file — it is already confirmed retired in three other files' comments; leaving it is a landmine for accidental re-import | Low (dead) |
| 6 | `api/athena/*` (Sprint 10 ATHENA Intelligence Engine, 11 files) | Built and board-locked, never wired into any live route or the RIE pipeline | Either schedule its activation as a future phase, or explicitly document it as intentionally reserved/dormant so it isn't mistaken for live code | Low |
| 7 | `monitoring/intelligence/MonitoringIntelligence.js` | A second, differently-located monitoring engine with a near-identical name to the live one | Remove, or rename/document to eliminate the confusion with the live `api/_lib/monitoring-intelligence.js` | Low |
| 8 | `api/evidence/contracts/distribution.js` / `api/registry/fields/distribution.js` territory fields | Added forward-looking in Phase 5.2, never populated by any assembler | Populate in a future phase if the schema is still wanted, or document as intentionally dormant | Low |
| 9 | `api/evidence/contracts/rights.js` (`rightsTerritory`) | Declared schema, no connector ever wired to write it | Same as #8 — document intent or populate | Low |
| 10 | `identity.storefront` field | Written once at scan time, never read by any assembler | No action needed — this is a working-as-intended identity-resolution parameter, not a duplicate territory calculation; listed for completeness only | Very Low |

---

## 4. Refactoring Plan (priority order — proposed for a future Phase 5.4, not authorized here)

1. **Fix `public/js/dashboard.js`'s Global Presence card** (Legacy Inventory #1). Highest priority — it is the only finding actively showing incorrect data to a real user surface today. Estimated effort: small (rewire one render function to read an already-available field, following the exact pattern already proven in `gmf-distribution-gaps.js`). Risk of the fix itself: Low — no API/behavior contract to preserve beyond making the card show correct data instead of empty data.
2. **Resolve the `delta-engine.js` territory-diff landmine** (#2). Requires a Board decision on direction (wire it up vs. remove it) before implementation — not a pure mechanical fix. Estimated effort: small either way once the direction is chosen.
3. **Retire or correctly re-derive the legacy `EvidenceBridge.js` territory classification** (#3). Requires confirming nothing else still depends on the V1 `globalStorefrontAvailability` shape before removing it — needs a dependency check, not just a code change. Estimated effort: medium (the dependency check is the real work; the code change itself is small).
4. **Delete `api/lib/health-score.js`** (#5). Trivial, zero risk — already confirmed dead by three independent comments in the codebase itself.
5. **Remove the defensive fallback in `global-music-footprint.js`** (#4). Trivial, low priority, purely a cleanliness item.
6. **Disposition the two dead-and-unreferenced engines** (`api/athena/*` #6, `monitoring/intelligence/MonitoringIntelligence.js` #7) and the three dead schema fields (#8, #9, #10) — administrative decisions, not urgent, batchable into a single small housekeeping pass whenever convenient.

None of the above is authorized by this report. This is a proposed ordering for the Board's consideration when scoping Phase 5.4, per the directive's own closing instruction.

---

## 5. Certification Report

Evaluated against the Board's five required proofs:

| Requirement | Result | Evidence |
|---|---|---|
| **Single source of truth** — every territory *decision* originates from the Engine | ✅ **Holds**, for every primary/live consumer surface (GMF, Distribution Gaps, territory-scan.js, live ATHENA/RoyaltēAI, Health Intelligence, PDF/export renderers, Mission Control's live path). ⚠️ Two live exceptions found (dashboard.js, EvidenceBridge.js's legacy interpretation) — see §2/§3. | Full consumer inventory above |
| **No parallel implementations** | ⚠️ **Two live parallel classifications exist** (dashboard.js's independent per-storefront logic; EvidenceBridge.js's cruder 2-state re-interpretation of the same evidence the Engine already classifies). One dormant parallel exists in a defensive fallback. One fully dead parallel exists in `health-score.js`. No parallel *acquisition* (network-calling) path exists anywhere — re-confirmed. | §2, §3 |
| **No hidden consumers** | ✅ **Holds.** Every file touching territory/storefront/market/footprint concepts across the platform was traced to a caller graph and classified; nothing was left unidentified. | Full inventory, all rows sourced from exhaustive grep + caller tracing |
| **Consistent results across surfaces** | ⚠️ **Does not fully hold today.** `dashboard.js` and the live Engine-consuming surfaces (GMF, Distribution Gaps) can show different answers for the same artist, because `dashboard.js` reads a permanently-null field and always renders "unverified" regardless of the Engine's real, correct classification available in the same payload. | Legacy Inventory #1 |
| **Legacy elimination** | ⚠️ **Partially complete.** Acquisition-level legacy code (the original Phase 5.2 target: `getAppleMusic()`, `checkGlobalStorefrontAvailability()`) is fully and correctly removed — re-confirmed, zero trace remains. Interpretation-level and monitoring-level legacy code (items #1–#3 above) was not in Phase 5.2's scope and remains. | Legacy Inventory |

---

## 6. Board Recommendation

**Certified with Minor Refactoring.**

The architecture the Board ratified in Phase 5.2 is sound and correctly implemented for its actual scope: acquisition-level duplication is eliminated, and every consumer built or touched during Phase 5.2 and the Distribution Gaps™ initiative (which together represent the platform's primary, actively-developed surfaces) correctly treats the Territory Intelligence Engine as sole authority. This is not a case of an incomplete migration — it is a case of pre-existing, out-of-scope legacy surfaces (a secondary dashboard, monitoring's change-detection layer, and V1-compatibility interpretation code) that were never part of what Phase 5.2 was chartered to touch, now surfaced by a wider audit than Phase 5.2 required.

Two of the three live findings are genuinely minor in blast radius (a dormant monitoring feature that never fires; a legacy interpretation layer producing no visible defect on its own, since nothing currently prominent reads its output besides the deprecated dashboard). One is a real, live, user-visible defect (`dashboard.js`) that predates this initiative and should be prioritized independent of everything else in this report.

Recommend the Board authorize a **Phase 5.4** scoped narrowly to the Refactoring Plan above, starting with item 1.

---

## 7. Repository State Confirmation

- **No production files were modified.** This report is the only file written to the repository in producing this document.
- **`git diff --stat`** (tracked-file changes): empty — zero tracked files modified.
- **`git status --short`:**
  ```
  ?? governance/PHASE_5_3_TERRITORY_INTELLIGENCE_CONSOLIDATION_CERTIFICATION_REPORT.md
  ```
  (plus a long-standing set of untracked files from unrelated prior work — `api/_lib/publishing-title-extractor.js`, `api/_lib/recording-intelligence.js`, `docs/*`, `lib/executive-assessment-v1.html`, `lib/publishing/*`, `lib/render-executive-assessment.js`, `memory/`, `public/css/royalte-executive-brief.css`, `scripts/*`, `tests/p0-diagnostic.mjs`, `tests/publishing-cert.mjs` — present before this session began this initiative, not touched by it, and not part of this deliverable.)
- **Confirmation:** nothing was committed, pushed, deployed, or merged. No `git add`, `git commit`, `git push`, or `gh pr create` command was run in producing this report.
