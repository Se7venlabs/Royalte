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

## 2026-07-03 — Sprint 3.1 Amendment — Constitutional Wiring Specification™

| | |
|---|---|
| **PR** | #209 (amendment commit) |
| **Commit SHA** | `aab47ca` |
| **Tag** | — |
| **Constitution Version** | v1.3 |
| **Added** | none |
| **Changed** | `api/_lib/monitoring-intelligence.js` — v1.0 → v1.1; `assembleMonitoringIntelligence` accepts `capturedAt` + `nextScanAt`; both fields included in output (`capturedAt`: Evidence Snapshot Store™ owner; `nextScan`: Monitoring Policy™ owner); error shell extended with null fields. `api/_lib/persist-os-scan.js` — `capturedAt` and `nextScanDate` hoisted out of monitoring_subscriptions try block; `capturedAt` + `nextScanAt` added to `osResult` return. `api/audit.js` — `osResult.capturedAt` and `osResult.nextScanAt` threaded into `assembleMonitoringIntelligence` call. `public/js/mission-control.js` — `buildEcosystemStatusPlan` reads `mi.capturedAt` (not `payload.scannedAt`) for Last Scan and `mi.nextScan` for Next Scheduled Scan; constitutional ownership comment block added for all 7 displayed values. |
| **Removed** | `payload.scannedAt` fallback for Last Scan (non-constitutional; replaced by Evidence Snapshot Store™ source). |
| **Impact** | Mission Control formally classified as a Constitutional Presentation Layer™. Every value in Music Ecosystem Status™ has a documented constitutional owner in source comments. Board Implementation Brief Standard™ established for all future Phase 3 modules. |

---

## 2026-07-03 — Sprint 3.1 — Music Ecosystem Status™

| | |
|---|---|
| **PR** | #209 |
| **Commit SHA** | `2c81e88` |
| **Tag** | — |
| **Constitution Version** | v1.3 |
| **Added** | `buildEcosystemStatusPlan(payload, plans)` — assembles render plan from Health Intelligence™, Change Detection™, Executive Brief™, and Monitoring Intelligence™ constitutional sources. `applyEcosystemStatusPlan(plan)` — DOM writer for all 12 `data-mc-es-*` attributes. `_esFormatTimeAgo(iso)` — presentation-layer time formatter. `_esMonitoringStatusLabel(rawStatus)` — constitutional label map for operational states. `case 'ecosystem-status'` block in `__mcRevealModule` with health score count-up animation. |
| **Changed** | `public/mission-control.html` — `.mc-hero` CSS redesigned from 4-column grid to `110px auto repeat(5, 1fr)` 7-cell layout; old hero HTML (`.mc-hero-block`, `.mc-pulse-line`, `.mc-hero-action`) replaced with Music Ecosystem Status™ section (`id="ecosystem-status"`); 12 `data-mc-es-*` attributes exposed. `public/js/vault-auth.js` — `'ecosystem-status'` prepended to MODULE_ORDER as first module revealed on boot. |
| **Removed** | "All Systems Normal" static banner. `.mc-hero-block`, `.mc-hero-label`, `.mc-hero-title`, `.mc-hero-meta`, `.mc-pulse-line`, `.mc-hero-action`, `.mc-hero-action-label`, `.mc-hero-action-value`, `.mc-hero-action-good` CSS and HTML. |
| **Impact** | Mission Control™ hero banner transformed from static status label into a 6-section Executive Intelligence Summary. Artists see Health Score, Last Scan, Next Scan, Changes Detected, Priority Actions, and Monitoring Status as the first thing revealed on every boot. |

---

## 2026-07-03 — Phase 3.6 Deezer — Streaming Verification Authority™ PAL Production Migration™

| | |
|---|---|
| **PR** | #201 |
| **Commit SHA** | `ba66b26` |
| **Tag** | — |
| **Constitution Version** | v1.3 |
| **Added** | `provider-acquisition/connectors/deezer/DeezerConnector.js` — 6 capabilities; no credentials; `authenticate()` returns AVAILABLE after `initialize()` with no network call. `provider-acquisition/connectors/deezer/deezer-http.js` — GET-only HTTP client; Deezer-specific 200-with-body-error detection; 429/5xx retry/backoff. `provider-acquisition/connectors/deezer/deezer-capabilities.js` — frozen capability declaration (ARTIST_IDENTITY, ALBUMS, TRACKS, ISRC, ARTWORK, GENRES). `api/_lib/deezer-pal-acquisition.js` — sequential A→B acquisition; `synthesizeDeezerCompat` reproduces the exact legacy `getDeezer()` output shape. `tests/certification/suites/11-deezer-connector.mjs` — 67-assertion certification suite (7 groups A–G). |
| **Changed** | `lib/rie/EvidenceBridge.js` — `translateDeezerArtistIdentity`, `translateDeezerAlbums`, `translateDeezerTopTracks`; `platforms.deezer.isrcs[]` is the constitutional bridge for future Verification Intelligence™; genres aggregated at `platforms.deezer.genres[]`; raw genre objects preserved in `albums[].genres.data`. `api/_lib/run-scan.js` — Deezer added as 7th PAL provider; legacy `getDeezer()` direct-call retired. `tests/certification/harness.mjs` — Suite 11 wired. |
| **Removed** | `getDeezer()` direct-call acquisition path from `run-scan.js` (lines ~1207–1277). All Deezer acquisition now flows through PAL. |
| **Impact** | Deezer is Royaltē's Streaming Verification Authority™ (provider trust: 80). Independent streaming evidence preserved for future Verification Intelligence™ — cross-provider agreement, disagreement, and confidence detection against Apple Music and Spotify. All seven constitutional providers now acquire via PAL. The original streaming provider group (Apple, Spotify, Deezer) is now 100% migrated to PAL. |
| **Tests** | 740 / 740 CERTIFIED (67 new assertions in Suite 11). |

---

## 2026-07-02 — Phase 3.6 MLC — The MLC Publishing Authority PAL Production Migration™

| | |
|---|---|
| **PR** | #199 |
| **Commit SHA** | `67d7fe8` |
| **Tag** | — |
| **Constitution Version** | v1.3 |
| **Added** | `provider-acquisition/connectors/mlc/MLCConnector.js` — ISRC + PUBLISHING capabilities; `authenticate()` calls `POST /oauth/token` to obtain JWT Bearer token (network call, distinct from other connectors). `provider-acquisition/connectors/mlc/mlc-http.js` — POST-only HTTP client; JWT Bearer auth; 401/429/5xx retry/backoff. `provider-acquisition/connectors/mlc/mlc-capabilities.js` — frozen capability declaration (ISRC + PUBLISHING). `api/_lib/mlc-pal-acquisition.js` — sequential A→B acquisition: recordings → extract mlcSongCodes → works; no compat synthesis (MLC is new to the fan-out). `tests/certification/suites/10-mlc-connector.mjs` — 63-assertion certification suite (7 groups A–G). |
| **Changed** | `lib/rie/EvidenceBridge.js` — `translateMLCRecordings` and `translateMLCWorks` added; recordings at `platforms.mlc.recordings[]`, works at `platforms.mlc.details.works[]`, `mlcSongCodes[]` bridge array; Board Amendment applied — no flattening of publishers/ISWCs into aggregate arrays. `api/_lib/run-scan.js` — MLC added as 6th PAL provider in fan-out. `tests/certification/harness.mjs` — Suite 10 wired. |
| **Removed** | none |
| **Impact** | The MLC is Royaltē's first constitutional Publishing Authority. Provider trust: 95 (statutory US mechanical licensing authority under the Music Modernization Act). Recording → Song Code → Musical Work → Publishers / Songwriters / ISWC hierarchy preserved for future Publishing Intelligence™, Rights Intelligence™, and Revenue Intelligence™. MLC API field-casing inconsistency documented and preserved raw: `/search/recordings` uses `mlcsongCode` (lowercase s); `/works` uses `mlcSongCode` (uppercase S). Six constitutional provider ecosystem complete. |
| **Tests** | 673 / 673 CERTIFIED (63 new assertions in Suite 10). |

---

## 2026-07-02 — Phase 3.6 YouTube — Official Artist Channel PAL Production Migration™

| | |
|---|---|
| **PR** | #198 |
| **Commit SHA** | `fb44ef5` |
| **Tag** | — |
| **Constitution Version** | v1.3 |
| **Added** | `provider-acquisition/connectors/youtube/YouTubeConnector.js` — ARTIST_IDENTITY + COLLECTION_DATA capabilities. `provider-acquisition/connectors/youtube/youtube-http.js` — GET-only HTTP client; appends API key as query param; 403/quotaExceeded → RATE_LIMITED. `provider-acquisition/connectors/youtube/youtube-capabilities.js` — frozen capability declaration. `api/_lib/youtube-pal-acquisition.js` — identity-lock on channelTitle (no partial matches); `acquireYouTubeEvidence` + `synthesizeYouTubeCompat`. `tests/certification/suites/09-youtube-connector.mjs` — 66-assertion certification suite (7 groups A–G). |
| **Changed** | `lib/rie/EvidenceBridge.js` — `translateYouTubeChannelIdentity` and `translateYouTubeChannelData` added. `api/_lib/run-scan.js` — YouTube added as 5th PAL provider in fan-out; legacy `getYouTubeData` retired from run-scan. `tests/certification/harness.mjs` — Suite 09 wired. |
| **Removed** | Legacy `getYouTubeData` direct-call path from `run-scan.js`. |
| **Impact** | YouTube Official Artist Channel is Royaltē's Digital Presence Authority (provider trust: 85). Identity-lock ensures only official artist channels are captured. |
| **Tests** | 610 / 610 CERTIFIED (66 new assertions in Suite 09). |

---

## 2026-07-02 — Phase 3.6 — Discogs PAL Production Migration™ + Amendment 1

| | |
|---|---|
| **PR** | #197 |
| **Commit SHA** | `aea8095` |
| **Tag** | — |
| **Constitution Version** | v1.3 |
| **Added** | `provider-acquisition/connectors/discogs/DiscogsConnector.js` — CATALOG_DATA + ARTIST_IDENTITY capabilities. `provider-acquisition/connectors/discogs/discogs-http.js` — GET HTTP client with Discogs user-agent header. `provider-acquisition/connectors/discogs/discogs-capabilities.js` — frozen capability declaration. `api/_lib/discogs-pal-acquisition.js` — identity-lock on artist name; `acquireDiscogsEvidence` + `synthesizeDiscogsCompat`. `tests/certification/suites/08-discogs-connector.mjs` — 79-assertion certification suite (6 groups A–F2). |
| **Changed** | `lib/rie/EvidenceBridge.js` — Discogs catalog translations added. `api/_lib/run-scan.js` — Discogs added as 4th PAL provider; legacy `getDiscogsData` retired from run-scan. `tests/certification/harness.mjs` — Suite 08 wired. Amendment 1 (Catalog Evidence Policy): EvidenceBridge reads `catalog.releases` array from Discogs evidence; no flattening of catalog data into summary fields at bridge layer. |
| **Removed** | Legacy `getDiscogsData` direct-call path from `run-scan.js`. |
| **Impact** | Discogs is Royaltē's Catalog Authority (provider trust: 75). Catalog evidence — releases, formats, labels — preserved as structured array. |
| **Tests** | 544 / 544 CERTIFIED (79 new assertions in Suite 08). |

---

## 2026-07-02 — Phase 3.8 — MusicBrainz PAL Production Migration™ + Amendment 1

| | |
|---|---|
| **PR** | #196 |
| **Commit SHA** | `b966881` |
| **Tag** | — |
| **Constitution Version** | v1.3 |
| **Added** | `provider-acquisition/connectors/musicbrainz/MusicBrainzConnector.js` — ARTIST_IDENTITY + CATALOG_DATA + ISRC capabilities. `provider-acquisition/connectors/musicbrainz/musicbrainz-http.js` — GET HTTP client; rate-limit compliant (1 req/s per MB policy); MusicBrainz User-Agent header. `provider-acquisition/connectors/musicbrainz/musicbrainz-capabilities.js` — frozen capability declaration. `api/_lib/musicbrainz-pal-acquisition.js` — identity-lock on artist name; `acquireMusicBrainzEvidence` + `synthesizeMusicBrainzCompat`. `tests/certification/suites/07-musicbrainz-connector.mjs` — 73-assertion certification suite (7 groups A–G). |
| **Changed** | `lib/rie/EvidenceBridge.js` — MusicBrainz translations added. `api/_lib/run-scan.js` — MusicBrainz added as 3rd PAL provider; legacy `getMusicBrainzData` retired from run-scan. `tests/certification/harness.mjs` — Suite 07 wired. Amendment 1 (provider normalization boundary): all MusicBrainz-specific field parsing terminates at the connector/bridge boundary; EvidenceBridge never maps internal MB tags to provider-specific business concepts. |
| **Removed** | Legacy `getMusicBrainzData` direct-call path from `run-scan.js`. |
| **Impact** | MusicBrainz is Royaltē's Canonical Metadata Authority (provider trust: 80). MBID-based identity confirmed; Recording ISRC cross-reference preserved. |
| **Tests** | 478 / 478 CERTIFIED (73 new assertions in Suite 07). |

---

## 2026-07-02 — Phase 3.7 — Recording Intelligence Foundation™ + Amendment

| | |
|---|---|
| **PR** | #195 |
| **Commit SHA** | `2057db6` |
| **Tag** | — |
| **Constitution Version** | v1.3 |
| **Added** | `api/_lib/recording-intelligence.js` — `assembleRecordingIntelligence(cio)` sole entrypoint; pure, deterministic; Board-locked RECORDING_CONFIDENCE_WEIGHTS and CONFIDENCE_THRESHOLDS (High ≥ 80 / Moderate ≥ 50 / Low ≥ 0). `tests/certification/suites/06-recording-intelligence.mjs` — 83-assertion certification suite (7 groups A–G). |
| **Changed** | `lib/rie/RIE.js` — Recording Intelligence wired into the RIE pipeline. `tests/certification/harness.mjs` — Suite 06 wired. Amendment (Recording Confidence Policy): Board-locked weights ratified — ISRC 40, MusicBrainz 30, Apple 20, Spotify 10 (sum to 100). Confidence is normalized [0, 100]; weights are advisory signals, not hard gates. |
| **Removed** | none |
| **Impact** | Recording confidence is a first-class constitutional intelligence field. Every CIM now includes recording confidence with explicit rationale. Suite 06 enforces the confidence contract and prevents score regression. |
| **Tests** | 405 / 405 CERTIFIED (83 new assertions in Suite 06). |

---

## 2026-07-02 — Phase 3.6 — Spotify PAL Production Migration

| | |
|---|---|
| **PR** | #194 |
| **Commit SHA** | `ba4054d` |
| **Tag** | — |
| **Constitution Version** | v1.3 |
| **Added** | `provider-acquisition/connectors/spotify/SpotifyConnector.js` — ARTIST_IDENTITY + CATALOG_DATA capabilities; client-credentials OAuth flow. `provider-acquisition/connectors/spotify/spotify-http.js` — GET HTTP client; Bearer token; 429 retry. `provider-acquisition/connectors/spotify/spotify-capabilities.js` — frozen capability declaration. `api/_lib/spotify-pal-acquisition.js` — `acquireSpotifyEvidence` + `synthesizeSpotifyCompat`. |
| **Changed** | `lib/rie/EvidenceBridge.js` — Spotify translations added. `api/_lib/run-scan.js` — Spotify added as 2nd PAL provider; legacy `getSpotifyData` retired from run-scan. |
| **Removed** | Legacy `getSpotifyData` direct-call path from `run-scan.js`. |
| **Impact** | Spotify is the second constitutional PAL provider (provider trust: 90). Verification authority. Legacy Spotify direct path retired. |
| **Tests** | 322 / 322 CERTIFIED. |

---

## 2026-07-02 — Phase 3.5 Governance Backfill — Royaltē OS v1.0 Certification

| | |
|---|---|
| **PR** | #193 |
| **Commit SHA** | (pending merge) |
| **Tag** | — (documentation only) |
| **Constitution Version** | v1.3 |
| **Added** | `ARCHITECTURE.md` — four-layer OS architecture diagram, constitutional ownership map, certified provider status, determinism contract, performance baseline, key invariants. `CERTIFICATION.md` — permanent record of the Board Certification Harness™: suite architecture, artist library, determinism policy, performance baseline policy, certification gates, certified baseline record (`royalte-os-v1.0` at `65c5c16`, 308/308 assertions). `GOVERNANCE.md` — permanent engineering governance: constitutional priority chain, session init, pre-implementation checklist, certification gates, phase PR protocol, ownership rules, migration rules, intelligence integrity rules. `TESTING.md` — permanent testing reference: all 7 test suites with commands and assertion counts, full test file map, CI configuration, test governance rules. |
| **Changed** | `governance/AGENT_MEMORY.md` § 2 — current build phase updated to Phase 3.5 complete, `royalte-os-v1.0` at `65c5c16` recorded. `governance/ROADMAP.md` — Phase 3.5 row updated to ✅; OS v1.0 milestone and certification framework added to What's Live. `governance/BOARD_DECISIONS.md` — Phase 3.5 ratification entry prepended. |
| **Removed** | none |
| **Impact** | Royaltē OS v1.0 certification is formally documented as permanent institutional record. Four root-level documents serve as the canonical orientation surface for all future engineering and AI sessions. |

---

## 2026-07-02 — Phase 3.5 — Royaltē OS v1.0 Board Certification Harness

| | |
|---|---|
| **PR** | #192 |
| **Commit SHA** | `65c5c16` |
| **Tag** | `royalte-os-v1.0` |
| **Constitution Version** | v1.3 |
| **Added** | `tests/certification/harness.mjs` — permanent Board Certification Harness orchestrator; 5 suites; exit 0 = CERTIFIED. `tests/certification/suites/01-regression.mjs` — 8 golden fixtures through IE + Health; 73 assertions. `tests/certification/suites/02-determinism.mjs` — 20 fixtures × 10 IE runs + canonical-radiohead × 5 RIE runs with fixed clock; 21 assertions. `tests/certification/suites/03-artist-library.mjs` — 12 artist archetypes through IE, Health, Identity Intelligence, Publishing Intelligence; 177 assertions. `tests/certification/suites/04-cim-integrity.mjs` — full RIE → §8.2 CIM structure + deep-freeze verification; 36 assertions. `tests/certification/suites/05-performance.mjs` — stage timing baselines (20 samples); 500ms full-RIE p95 budget gate; 1 assertion. `tests/certification/reporters/board-report.mjs` — Board Certification Report formatter. `tests/certification/artist-library/*.json` — 12 certification archetypes: major, independent, single-only, album-heavy, no-publisher, legacy-catalog, duplicate-identity, international, classical, sparse-metadata, null-fields, multi-publisher. |
| **Changed** | `api/_lib/backend-intelligence.js` line 93 — removed `!Array.isArray(v)` guard from `deepFreeze`; arrays now properly frozen. Production bug fix: `verification.services[]` was unfrozen in the CIM. |
| **Removed** | none |
| **Tests** | 308 assertions / 5 suites / 0 failures. BOARD VERDICT: CERTIFIED. |

---

## 2026-07-02 — Product Consumption Cleanup (Phase 3.4)

| | |
|---|---|
| **PR** | #190 |
| **Commit SHA** | `8a71df7` (pending merge) |
| **Tag** | `phase-3-4-product-consumption-cleanup-v1.0` (pending) |
| **Constitution Version** | v1.3 |
| **Added** | `isrcCoverage` field in `api/_lib/catalog-intelligence.js` — constitutional ISRC Coverage intelligence (status/assessed/assessedCount/verifiedCount/coveragePercent). Board-pending `ISRC_THRESHOLDS` named constants (Complete ≥ 75 / Partial ≥ 25 / Limited ≥ 1 / Unknown). `renderCatalog` in `public/js/mission-control-renderers.js` extended with `isrcCoverage` in plan. |
| **Changed** | `public/index.html` `_renderV2Found()` rewritten as a pure presentation layer — zero business logic. All six displayed fields now read from the Certified CIM (`data.canonical.catalogIntelligence` and `data.canonical.globalMusicFootprint`). Album classification loop, provider-count catalogAvail formula, and `trackIsrc` ISRC proxy removed. |
| **Removed** | Renderer business logic: album classification (loop over `appleMusic.albums[]`), catalog availability provider-count formula (`verifAM + verifSP >= 2`), ISRC coverage proxy (`trackIsrc ? 'Complete' : 'Unknown'`). |
| **Impact** | Website Scan is now a constitutional presentation layer. ISRC Coverage and Catalog Availability are certified by the RIE and produce identical results regardless of entry point. Vocabulary: Catalog Availability is now Global/Strong/Regional/Limited (from `globalMusicFootprint.status`); ISRC Coverage is Unknown/Limited/Partial/Complete (from `catalogIntelligence.isrcCoverage.status`). |

---

## 2026-07-02 — Apple Production Migration (Phase 3.3)

| | |
|---|---|
| **PR** | #189 |
| **Commit SHA** | `584770d` |
| **Tag** | `apple-pal-production-migration-v1.0` |
| **Constitution Version** | v1.3 |
| **Added** | `api/_lib/apple-pal-acquisition.js` — PAL orchestration module; `acquireAppleEvidence()` (sequential ARTIST_IDENTITY → ALBUMS+ISRC → AVAILABILITY) + `synthesizeAppleMusicCompat()` (V1 module compat shim, TRANSITIONAL). `governance/MIGRATION_RETIREMENT_REGISTER.md` — Board's master legacy retirement checklist. |
| **Changed** | `provider-acquisition/connectors/apple-music/AppleMusicConnector.js` — `AVAILABILITY` capability upgraded from BIG6 (8 storefronts) to global 167-storefront wave-based fan-out; `TERRITORIES` stays BIG6; `ALL_APPLE_STOREFRONTS` constant embedded. `lib/rie/index.js` — hybrid merge path added (`_mergeApplePalEvidence`, `_deepMerge`): when both `evidencePackages` and `canonicalForEnrichment` provided, PAL Apple evidence deep-merges into legacy canonical with PAL authoritative for `platforms.appleMusic.*`, `subject.*`, `source.*`. `api/_lib/run-scan.js` — Apple acquisition replaced by `acquireAppleEvidence()` running in parallel with all other providers via `Promise.allSettled`; `getAppleMusic()` removed from fan-out; legacy Apple imports marked `[RETIRED CANDIDATE]`; `evidencePackages` added to return value; `appleArtworkUrl` populated from PAL evidence for Spotify-URL inputs. `api/audit.js` — `evidencePackages: result.evidencePackages` threaded into `runRIE()`. |
| **Removed** | Direct `getAppleMusic()` call from production scan path. |
| **Tests** | pipeline-test 226/226, golden-fixture 31/31, rie-phase1 25/25, identity-wiring 19/19, publishing-intelligence 26/26, health-engine 36/36. |

---

## 2026-07-02 — One Health Engine (Phase 3.2)

| | |
|---|---|
| **PR** | #188 |
| **Commit SHA** | `aca5571` |
| **Tag** | — |
| **Constitution Version** | v1.3 |
| **Added** | `lib/rie/CimAdapter.js` — `buildCimEnrichment(cim, baseCanonical)` migration bridge; maps CIM → legacy canonical fields for backward-compat consumers. `lib/rie/__tests__/scan-migration.test.js` — 36-criterion test suite enforcing CimAdapter boundaries and One Health Engine invariants. |
| **Changed** | `api/_lib/persist-os-scan.js` — health score sourced from `cim.health.score` (via CimAdapter output) instead of `computeV2HealthScore`. `api/audit.js` — OS enrichment path migrated to `buildCimEnrichment(cim, canonical)` pattern; `canonical.cim` carries full certified CIM for Phase 3.2+ consumers. `api/lib/normalizeAuditResponse.js`, `api/schema/auditResponse.js`, `generate_audit_pdf.py` — schema alignment updates. `lib/rie/index.js` — `runRIE()` updated to return certified CIM (Phase 2.4 PAL path activated). |
| **Removed** | `computeV2HealthScore()` removed from production paths (zero consumers; V2 function body retired). |

---

## 2026-06-20 — Phase 8: Scan Pipeline Wiring — Health & Executive Brief

| | |
|---|---|
| **PR** | #155 |
| **Commit SHA** | `17f462f` |
| **Tag** | `phase-8-scan-pipeline-wiring-v1.0` |
| **Constitution Version** | v1.3 |
| **Added** | nothing new — integration only |
| **Changed** | `api/audit.js` — step 5 added to `assembleIntelligenceForScan()`: `computeHealthScore(report)` [once] → `generateHealthReport(cio, report)` → `generateExecutiveBrief(cio, report, healthReport, healthScore)`; `healthScore`, `healthReport`, `executiveBrief` persisted in enriched payload. `api/_lib/executive-brief-engine.js` — signature updated from `generateExecutiveBrief(healthReport)` to `generateExecutiveBrief(cio, intelligenceReport, healthReport, canonicalHealth)`; strict layer ownership enforced; fail-closed on absent `canonicalHealth` or `intelligenceReport`. `tests/executive-brief-engine-test.mjs` — migrated to 4-arg signature (40 → 40 assertions, zero coverage lost). |
| **Removed** | none |

---

## 2026-06-12 — Phase 8: Royaltē Executive Brief Engine™

| | |
|---|---|
| **PR** | #141 |
| **Commit SHA** | `8f00014` |
| **Constitution Version** | v1.3 |
| **Added** | `api/schema/executive-brief.js` (constants + `emptyBrief()` factory; `BRIEF_VERSION='1.0.0'`, `HEALTH_HEADLINES`, `RECOMMENDED_NEXT_STEPS`). `api/_lib/executive-brief-engine.js` (sole export: `generateExecutiveBrief(healthReport)`; pure, deterministic, never throws, deep-freezes output; reads upstream `strengths/risks/opportunities/recommendations/observations` arrays defensively). `tests/executive-brief-engine-test.mjs` (40 deterministic assertions: input tolerance, grade-derived headlines, summary/narrative word caps, top-N capped at 5, severity-ordered risks, never-invent invariant for priorityActions, confidence-statement templates, determinism, immutability, no-mutation, schema invariants). |
| **Changed** | none |
| **Removed** | none |

---

## 2026-06-12 — Phase 7.5: Se7ven Labs Intellectual Property Vault™

| | |
|---|---|
| **PR** | #139 |
| **Commit SHA** | `38ec3be` (Vault establishment at `7a72e77`; Permanence Amendment at `38ec3be`) |
| **Constitution Version** | v1.3 |
| **Added** | `/ip/` directory with 24 markdown files (2,547 lines): `README.md` (Vault index, Purpose, Permanence, Legal disclaimer, Ownership Block), `TRADEMARKS.md`, `TRADEMARK_USAGE.md`, `FIRST_USE_LOG.md`, `PATENTS.md`, `PRIOR_ART.md`, `DEFENSIVE_PUBLICATIONS.md`, `COPYRIGHTS.md`, `TRADE_SECRETS.md` (CONFIDENTIAL), `PRODUCT_REGISTRY.md`, `INVENTION_LOG.md`, `FOUNDER_NOTES.md`, `IP_ROADMAP.md`, `LICENSING.md`, `AI_MODELS.md`, `ARCHITECTURE_DECISIONS.md`, `DOMAIN_REGISTRY.md`, `BRAND_GUIDELINES.md`, `PRESS.md`, `VALUATION.md` (PRIVATE), `COMPETITOR_ANALYSIS.md`, `INVESTOR_DUE_DILIGENCE.md`, `ACQUISITION_DATA_ROOM.md`, `OPEN_SOURCE.md`. Documentation-only; no runtime / governance / constitutional impact. |
| **Changed** | none |
| **Removed** | none |

---

## 2026-06-11 — Phase 7: Royaltē Health Engine™

| | |
|---|---|
| **PR** | #137 |
| **Commit SHA** | `ec57481` (Phase 7 code at `0c10fb4`; roadmap amendment at `ec57481`) |
| **Constitution Version** | v1.3 |
| **Added** | `api/schema/health.js` (constants + `emptyHealthReport()` factory; `HEALTH_VERSION='1.0.0'`, `CATEGORY_WEIGHTS`, `GRADE_THRESHOLDS`). `api/_lib/health-engine.js` (sole export: `computeHealthScore(intelligenceReport)`; pure, deterministic, never throws, deep-freezes output). `tests/health-engine-test.mjs` (35 deterministic assertions: input tolerance, fixture-driven category scores, all six grade bands, determinism, immutability, no-mutation, invariants). |
| **Changed** | none |
| **Removed** | none |

---

## 2026-06-11 — Phase 6.5: Golden Fixture Library™ + Phase 5 polarity amendment

| | |
|---|---|
| **PR** | #135 |
| **Commit SHA** | `52b1750` |
| **Constitution Version** | v1.3 |
| **Added** | `tests/fixtures/artist-empty.json`, `tests/fixtures/artist-perfect.json`, `tests/fixtures/artist-duplicate-profiles.json`, `tests/fixtures/artist-missing-publishing.json`, `tests/fixtures/artist-orphan-recordings.json`, `tests/fixtures/artist-fragmented-catalog.json`, `tests/fixtures/artist-metadata-conflicts.json` — each carrying `_fixtureVersion`, `_fixtureName`, `_description`, `_expectedBehavior`. Plus `tests/fixtures/fixture-loader.mjs` (exports `loadFixture`, `listFixtures` only) and `tests/golden-fixture-test.mjs` (30 deterministic assertions). |
| **Changed** | `api/rules/publishing-rules.js` — added `polarity: 'positive'` to `publishing.strong-coverage` (1 line). `api/rules/catalog-rules.js` — added `polarity: 'positive'` to `catalog.complete-delivery-verified` (1 line). Additive Phase 5 amendment; existing rule-library tests stay 29/29 green. |
| **Removed** | none |

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
