# Royaltē Platform Roadmap

**Status:** single source of truth for platform progress.
**Authority:** subordinate to `constitution/ROYALTE_MASTER_CONSTITUTION.md`.
**Updated:** after every Board-approved merge (per governance rule, see `AGENT_MEMORY.md` § 9).

When this roadmap and the Constitution disagree, **the Constitution wins.**

---

## ROYALTĒ v3.0 — Board Launch Master Plan

| Section | Item | Status |
|---|---|---|
| Section 1 | Engine Provider Registry™ | ☑ Complete — PR #356, commit `c141c0b`, 2026-07-17 |
| Section 3 | Connect Library | ⏳ Next Board Initiative — not yet briefed |

**Section 1 summary:** `provider-acquisition/registry/EngineProviderRegistry.js` — governance-level, static, 15-provider catalog (12 PAL-migrated and Board-certified, 3 legacy/not-yet-migrated), separate from and non-duplicative of the runtime `ProviderRegistry.js`. Full detail: `governance/ENGINE_PROVIDER_REGISTRY_COMPLETION_REPORT.md`, `governance/ENGINE_PROVIDER_REGISTRY_ARCHITECTURE.md`.

**Open Board work items from Section 1's findings** (deferred, not yet authorized for implementation):
- PAL migration of SoundCloud, Wikidata, and Listen Notes (all three currently called directly from `run-scan.js`/`listen-notes.js`, predating the PAL architecture — no connector, no certification suite)
- Removal of SoundCloud's hardcoded `client_id` literal (`api/_lib/run-scan.js:1429`) in favor of an environment variable

*(Section 2 was not referenced in the Section 1 or Section 3 briefs received to date — status unknown, not assumed complete or pending.)*

---

## Active Build — OS Migration Sprint

The constitutional architecture is complete. The platform is now in its migration epoch:
eliminating legacy provider acquisition one provider at a time using the proven blueprint
from Apple Production Migration (PR #189, 2026-07-02).

**Migration order** (Board authorizes each): Apple ✅ → Spotify (recommended next) → MusicBrainz / Deezer / YouTube / others.

### Intelligence-Wiring Sprint (COMPLETE)

| Phase | Title | Status | Locked at | Tag |
|---|---|---|---|---|
| 1 | MLC Public API Connectivity | ✅ Complete | (probe endpoint live) | — |
| 2 | Publishing Intelligence Adapter™ | ✅ Complete | `bca9e68` | `mlc-publishing-adapter-v1.0` |
| 3 | Royaltē Identity Graph™ | ✅ Complete | `bf12b5a` | — |
| 4 | Canonical Intelligence Assembly Engine™ | ✅ Complete | `a3c78d7` | — |
| 5 | Royaltē Rule Library™ | ✅ Complete | `8907bd6` | — |
| 6 | Royaltē Intelligence Engine™ | ✅ Complete | `a23788b` | `intelligence-engine-v1.0` |
| 6.5 | Royaltē Golden Fixture Library™ + Phase 5 polarity amendment | ✅ Complete | `52b1750` | — |
| 6C | Canonical Catalog Model™ Composer | ✅ Complete | `9259220` | — |
| 6D | Catalog Rule Library Migration Layer | ✅ Complete | `2979410` | `phase-6d-catalog-rule-migration-v1.0` |
| 7 | Royaltē Health Engine™ | ✅ Complete | `ec57481` | — |
| 7.5 | Se7ven Labs IP Vault™ | ✅ Complete | `38ec3be` | — |
| 8 | Scan Pipeline Wiring — Health & Executive Brief | ✅ Complete | `17f462f` | `phase-8-scan-pipeline-wiring-v1.0` |

### OS Migration Sprint

| Phase | Title | Status | Locked at | Tag |
|---|---|---|---|---|
| 3.1 | CimAdapter + scan-migration test suite | ✅ Complete | `77c827a` | — |
| 3.2 | One Health Engine | ✅ Complete | `aca5571` | — |
| 3.3 | Apple Production Migration | ✅ Complete | `584770d` | `apple-pal-production-migration-v1.0` |
| 3.4 | Product Consumption Cleanup | ✅ Complete | `8a71df7` | `phase-3-4-product-consumption-cleanup-v1.0` |
| 3.5 | Royaltē OS v1.0 Certification Sprint | ✅ Complete | `65c5c16` | `royalte-os-v1.0` |
| 3.5-backfill | Phase 3.5 Governance Backfill | ✅ Complete | `de312b1` (PR #193) | — |
| 3.6 Spotify | Spotify PAL Production Migration | ✅ Complete | `ba4054d` (PR #194) | — |
| 3.7 | Recording Intelligence Foundation™ + Amendment | ✅ Complete | `2057db6` (PR #195) | — |
| 3.8 | MusicBrainz PAL Production Migration™ + Amendment 1 | ✅ Complete | `b966881` (PR #196) | — |
| 3.6 Discogs | Discogs PAL Production Migration™ + Amendment 1 | ✅ Complete | `aea8095` (PR #197) | — |
| 3.6 YouTube | YouTube Official Artist Channel PAL Production Migration™ | ✅ Complete | `fb44ef5` (PR #198) | — |
| 3.6 MLC | The MLC Publishing Authority PAL Production Migration™ | ✅ Complete | `67d7fe8` (PR #199) | — |
| 3.6 Deezer | Deezer Streaming Verification Authority™ PAL Production Migration™ | ✅ Complete | `ba66b26` (PR #201) | — |

### MC Intelligence Sprint

| Phase | Title | Status | Locked at | Tag |
|---|---|---|---|---|
| MC-3.2 | Health Intelligence™ Executive Assessment (6-section redesign) | ✅ Complete | `346a2d0` (PR #211) | — |
| MC-3.2-ELO | Executive Layout Optimization™ v1.0 — desktop density pass | ✅ Complete | `83c8804` (PR #211) | — |
| MC-3.3 | Identity Intelligence™ Executive Passport (6-section redesign) | ✅ Complete | `654eb52` (PR #213) | — |
| MC-3.4 | Publishing Intelligence™ Executive Passport (7-section + Amendment 1 + Amendment 2) | ✅ Complete | `8400134` (PR #216) | — |

### Mission Control™ v2.0 — Canonical Intelligence Platform™

| Phase | Title | Status | Locked at | Tag |
|---|---|---|---|---|
| Sprint 1 | Canonical Registry Foundation™ (+ Sprint 1A Ownership Corrections) | ✅ Complete | `a902da7` (PR #303) | `canonical-registry-sprint1-v1.0` |
| Sprint 2 | Evidence Contracts™ | ✅ Complete | `d10d469` (PR #305) | `evidence-contracts-sprint2-v1.0` |
| Sprint 3 | Evidence Registry™ | ✅ Complete | `73a036d` (PR #307) | `evidence-registry-sprint3-v1.0` |
| Sprint 4 | Normalization Engine™ (+ Board Enhancements: Normalized Record™, Manifest™, Fingerprint) | ✅ Complete | `43761fa` (PR #309) | `normalization-engine-sprint4-v1.0` |
| Sprint 5 | Evidence Resolution Engine™ (Resolution Policy Registry™, Confidence Engine™, Conflict Detection™, Field Provenance™, Resolution Record™, Resolution Manifest™) | ✅ Complete | `8c7fb5f` (PR #311) | `resolution-engine-sprint5-v1.0` |
| Sprint 6 | Canonical Intelligence Domains™ — Delivered during the expanded Canonical Registry Foundation™ implementation (PR #303 / `a902da7`). Sprint 6 formally recognizes the Canonical Intelligence Domain architecture (6 domains, 26 objects, domain ownership validation, consumer workspace separation) that was implemented during the expanded Sprint 1. No additional engineering implementation was required. Constitutional ratification only. | ✅ Complete | `a902da7` (PR #303) | `canonical-registry-sprint1-v1.0` |
| Sprint 7 | Scan Orchestrator™ (Scan Lifecycle™, Scan State™, Pipeline Coordinator™, Event System™, Scan Queue™, Scan Scheduler™) | ✅ Complete | `8a4aa19` (PR #313) | `scan-orchestrator-sprint7-v1.0` |
| Sprint 8 | Monitoring & Change Detection™ (Canonical Snapshot™, Change Detection Engine™, Timeline Engine™, Alert Engine™, Severity Engine™, History Store™) | ✅ Complete | `1317f07` (PR #315) | `monitoring-engine-v1.0` |
| Sprint 9 | Mission Control Data API™ (Endpoint Registry™, Response Models™, Serialization Layer™, Validation Framework™, Route Layer™, API Factory™) — constitutional public gateway between the Canonical Intelligence Platform™ and every consumer. No application may bypass this layer to reach platform engines directly. | ✅ Complete | `4047311` (PR #318) | `mission-control-api-v1.0` |

### Executive Workspace Sprint

| Phase | Title | Status | Locked at | Tag |
|---|---|---|---|---|
| WS-4.1 | Identity Intelligence™ Workspace Build (ii-* namespace + coverage ring) | ✅ Complete | `c43f431` (PR #222) | — |
| WS-4.1-AME | Ambient Module Elevation™ — ws-dept scoping system (Health + Identity) | ✅ Complete | `96a8dc5` (PR #222) | — |
| WS-4.2 | Publishing Intelligence™ Workspace Build (pi-* namespace + Amendments #001/#002) | ✅ Complete | `cdd4fda` (PR #224) | — |
| WS-4.2-RTZ | Reporting Time Zone™ — dynamic tz detection, MC System Status™ placement, DB migration | ✅ Complete | `6efd9e2` (PR #226) | — |
| WS-4.x-IMG | Executive Image Service™ — platform-agnostic image selection + .royalte-exec-img standard | ✅ Complete | `7127bc0` (PR #228) | — |

### Territory Intelligence Sprint

| Phase | Title | Status | Locked at | Tag |
|---|---|---|---|---|
| 5.1 | Territory Intelligence Discovery Report — architectural audit of all existing territory/availability/market infrastructure | ✅ Complete | (discovery only, no code) | — |
| 5.2 | Territory Intelligence Engine™ — single authoritative provider-general territory/availability assembler, five-state model, GMF converted to consumer, territory-scan.js rewired onto the Engine | ✅ Complete | `788f97c` (PR #349) | `territory-intelligence-engine-v1.0` |
| 5.2-DG | Distribution Gaps™ — responsive-first territory detail panel on the Global Music Footprint™ workspace; desktop drawer / tablet wide drawer / mobile full-height sheet; sourced from real Territory Intelligence Engine™ evidence only | ✅ Complete | `930fd91` (PR #351) | — |
| 5.3 | Territory Intelligence Consolidation & Platform Certification — discovery-only platform-wide audit of every territory intelligence consumer; recommendation Certified with Minor Refactoring; 3 live findings surfaced | ✅ Complete | `31de17c` (PR #353) | — |
| 5.4 | Territory Intelligence Refactoring — resolved all 3 Phase 5.3 findings: dashboard.js Global Presence card rewired to the Engine, EvidenceBridge.js's duplicate interpretation removed, delta-engine.js territory monitoring rewired to the Engine (Board Decision: Option A) | ✅ Complete | `36df8f2` (PR #354) | — |

**Note:** this roadmap's phase inventory between Sprint 9 (Mission Control Data API™, above) and Phase 5.2 (this entry) is known to be incomplete — several later phases from this build cycle (Sprint 10 ATHENA™ Intelligence Engine, Sprint 11 Executive Brief™ Engine, Sprint 12 MC Integration Layer, the P0 MC payload bridge fix, and the PAL Connector Modernization Program covering ACRCloud ×2/Discogs/MusicBrainz/YouTube/Deezer/MLC/Spotify/TIDAL/TheAudioDB) are not yet reflected in the tables above. Backfilling that gap is a separate governance task, out of scope for this entry.

---

## What's Live in `main` Today

- **Territory Intelligence Engine™ is now the platform's sole territory-classification authority — no known live exceptions remain** (Phase 5.4, PR #354, 2026-07-17): resolves the three findings Phase 5.3's platform-wide audit surfaced. `public/js/dashboard.js`'s Global Presence card reads `globalMusicFootprint.distributionGaps.territories` (previously read a deprecated field hardcoded `null`, so it always rendered unstyled regardless of real data). `lib/rie/EvidenceBridge.js`'s `translateTerritories()` calls the Engine directly instead of independently re-classifying the same evidence (`storefrontIsAvailable()` removed). `api/_lib/persist-os-scan.js`'s `extractTerritories()` gained an Engine-sourced fallback, restoring real `territory_gain`/`territory_loss` monitoring alerts that had been dormant since an unrelated field was nulled during the Health Engine migration. All fixes additive; every existing fallback shape and payload contract preserved unchanged; runtime-verified against the actual production code, not static analysis alone.
- **Distribution Gaps™ on the Global Music Footprint™ workspace** (Phase 5.2-DG, PR #351, 2026-07-17): new section beneath the world map — summary panel (Total Requiring Attention / Unavailable / Unknown / Pending Review) + a responsive full-list panel (desktop right drawer with the map still visible, tablet wide drawer, mobile full-height bottom sheet with drag-handle affordance) with search, status/provider filter chips, and a territory detail sub-panel. `api/_lib/global-music-footprint.js`'s `buildDistributionGaps()` derives every field (status, providers, reason, recommended action, last verified) directly from the Territory Intelligence Engine™'s real per-territory evidence — additive `distributionGaps` field, all existing GMF output fields unchanged. Established as the binding responsive-first standard (desktop/tablet/mobile as equal citizens, not a post-build optimization) for all future Royaltē workspace/panel/engine UI work, per the same Board directive.
- **Territory Intelligence Engine™ is the sole authoritative source of territory/availability intelligence** (Phase 5.2, PR #349, tag `territory-intelligence-engine-v1.0`, 2026-07-17): `api/_lib/territory-intelligence.js` — `assembleTerritoryIntelligence(evidencePackages)`, Board-ratified five-state model (`AVAILABLE`/`UNAVAILABLE`/`UNKNOWN`/`NOT_EVALUATED`/`ERROR`), provider-general reconciliation policy, Apple-sourced via PAL in this phase. One canonical territory vocabulary at `lib/territory/canonical-territory-vocabulary.js` replaces three prior fragmented copies. Global Music Footprint™ (`api/_lib/global-music-footprint.js`) converted to a consumer of the Engine's output; public output shape unchanged. `api/territory-scan.js` repaired and rewired onto the Engine (two explicitly-versioned contract changes, `dataSourceVersion` field). Legacy Apple storefront duplication (`getAppleMusic()`, `checkGlobalStorefrontAvailability()`) removed after confirmation it was already dead code, not live duplication.

- **Phases 1–8 are merged and locked.** The full Intelligence Stack is wired into production:
  - **Rule Library** at `api/rules/` — declarative pure-data rules with `(cio) => boolean` conditions; polarity-aware; category-indexed
  - **Intelligence Engine** at `api/_lib/intelligence-engine.js` — `runIntelligenceEngine(cio, ruleLibrary)` sole entrypoint; generic iteration; deeply frozen output
  - **Golden Fixture Library** at `tests/fixtures/` — 7 canonical CIO reference states; 30-assertion regression surface; append-only
  - **Canonical Catalog Model™ Composer** at `api/_lib/catalog-model-composer.js` — sole owner of `catalogModel` assembly; pure composition; never evaluates rules
  - **Catalog Rule Migration Layer** in `api/rules/catalog-rules.js` — Phase 6D dual-read layer connecting the Rule Library to the Canonical Catalog Model™
  - **Royaltē Health Engine™** at `api/_lib/health-engine.js` — `computeHealthScore(intelligenceReport)` sole scoring authority; Board-locked weights and grade thresholds; pure, deterministic, deeply frozen output
  - **Royaltē Executive Brief Engine™** at `api/_lib/executive-brief-engine.js` — `generateExecutiveBrief(cio, intelligenceReport, healthReport, canonicalHealth)` sole entrypoint; presentation layer only; never scores, never invents
  - **Se7ven Labs IP Vault™** at `/ip/` — permanent internal corporate IP register (24 markdown files); survives product lifecycles, mergers, acquisitions
- **Provider Expansion Sprint + Deezer complete** (PRs #194–#201, 2026-07-02/03):
  - **Seven constitutional providers** — Apple Music (100), Spotify (90), MusicBrainz (80), Discogs (75), YouTube OAC (85), The MLC (95), Deezer (80)
  - **Streaming Verification Authority™** — Deezer; independent evidence foundation for future Verification Intelligence™; `getDeezer()` direct-call retired
  - **Recording Intelligence Foundation™** — Board-locked RECORDING_CONFIDENCE_WEIGHTS (ISRC 40 / MB 30 / Apple 20 / Spotify 10)
  - **Board Certification Harness™** now at **740 assertions / 11 suites** — permanent gate for all future provider phases
  - **Constitutional Publishing Authority** — The MLC; Recording → Song Code → Musical Work hierarchy preserved; foundation for future Publishing / Rights / Revenue Intelligence
  - **All original streaming providers (Apple, Spotify, Deezer) now 100% migrated to PAL**
- **Royaltē OS v1.0 is the certified production baseline** (Phase 3.5, PR #192, tag `royalte-os-v1.0` at `65c5c16`, 2026-07-02):
  - **Board Certification Harness™** at `tests/certification/harness.mjs` — 10 suites, 673 assertions, exit 0 = CERTIFIED; permanent certification gate
  - **Certification Artist Library** at `tests/certification/artist-library/` — 12 archetypes covering full range of real-world edge cases; append-only
  - **Determinism certified:** same evidence always produces the same CIM (verified 10 runs IE + 5 runs full RIE with fixed clock)
  - **Performance baseline:** Full RIE pipeline p95 = 0.33ms (budget 500ms); Intelligence Engine p95 = 0.09ms
  - **`deepFreeze` bug fixed** in `api/_lib/backend-intelligence.js` — arrays now properly frozen in the CIM
  - **Certification gates locked:** IE, Health Engine, Rule Library, RIE changes require 100% harness pass before merge; release tags require harness + CI green
- **Phase 8 scan pipeline wiring** (`api/audit.js`): every scan now runs the full constitutional pipeline end-to-end:
  - `runIntelligenceEngine(cio, ALL_RULES)` → `computeHealthScore(report)` [once] → `generateHealthReport(cio, report)` → `generateExecutiveBrief(cio, report, healthReport, healthScore)` → persists `healthScore`, `healthReport`, `executiveBrief` in the enriched scan payload
  - `computeHealthScore()` called exactly once per scan; canonical result passed downstream, never re-derived
- **Royaltē Scan Experience V1 is DESIGN FROZEN.** PR #122 remains open and is held until intelligence wiring is complete. No layout / spacing / typography / color / animation / UX changes are authorised in the meantime.
- **Constitution at v1.3** (effective 2026-06-11) ratifies the seven-layer Engineering Stack.
- **Phase 5 rule format** permits the optional `polarity: 'positive'` field on positive-framing rules — applied to `publishing.strong-coverage` and `catalog.complete-delivery-verified`.
- **Mission Control™ Health Intelligence™ card redesigned** (PR #211, 2026-07-03): 6-section executive assessment fully wired to Health Engine output. `applyHealthIntelligencePlan` is the sole DOM writer; `buildHealthIntelligencePlan` is the sole plan builder. All values sourced constitutionally. Executive Layout Optimization™ v1.0 reduces desktop page height ~260px; final holistic pass deferred until all MC modules complete.
- **Mission Control™ Identity Intelligence™ card redesigned** (PR #213, 2026-07-03): 6-section executive passport replaces the fingerprint ring + provider checklist. Sections: Identity Coverage (% + grade), Identity Summary (4 counts), Identity Providers (constitutional + platform pills), Biggest Risk, Biggest Win, Recent Changes. `applyIdentityIntelligencePlan` is the sole DOM writer; `buildIdentityIntelligencePlan` is the sole plan builder. Deezer/TIDAL read from `payload.platforms.*` via Evidence Bridge™.
- **Mission Control™ Publishing Intelligence™ card redesigned** (PR #215, 2026-07-03): 7-section executive passport replaces the ring + flat checklist. Sections: Publishing Coverage (% + grade), Publishing Summary (4 counts), Publishing Systems (6 metric rows), Financial Impact™ (NEW — risk badge + Potential Royalty Impact™ + Estimated Resolution), Biggest Risk, Biggest Win, Recent Changes. Financial Neutrality Rule™ preserved. `applyPublishingIntelligencePlan` is the sole DOM writer; `buildPublishingIntelligencePlan` is the sole plan builder.

---

## What's Not Live Yet

- **Publishing Intelligence™ not yet built.** The MLC evidence (recordings + works) is acquired and preserved in the CIM. The intelligence layer that reads this evidence — Publishing Intelligence™, Rights Intelligence™, Revenue Intelligence™ — requires a separate Board brief.
- **Health Trend sparkline (Section 5) shows current scan only.** Historical Health Snapshots™ wiring is deferred; positions 0–3 display "—" until a historical scan series exists.
- **Monitoring and Revenue reserved sections remain placeholders.** `MONITORING`, `REVENUE`, and `GENERAL` in the Rule Library carry empty arrays; `monitoring` and `revenue` in reserved sections ship `null`. Phase 9+ may begin populating them.
- **All future work is Board-authorized only.** No phase begins until the Board issues a formal brief.

---

## Next Engineering Target

**Superseded by later Board activity not yet backfilled into this section** (see the Territory Intelligence Sprint note above) — several of the items below were completed in phases this roadmap doesn't yet reflect. Left as-is rather than guessed at; reconciling this section is part of the same backfill task noted above.

**Phase 5.2 (Territory Intelligence Engine™) is complete as of 2026-07-17.** The Board's stated candidate next initiatives, none yet formally briefed:
- Royaltē Platform Architecture v1.0 — document the complete platform architecture
- Connector completion roadmap — finish remaining Connectors™
- Engine completion roadmap — finish remaining Intelligence Engines™
- ATHENA™ activation, once the underlying intelligence platform is sufficiently mature

No sprint begins until the Board issues a formal brief.

Prior options (carried forward from an earlier roadmap state, status not reconciled):
- **Publishing Intelligence™** — consume MLC + publishing evidence from CIM to generate constitutional publishing insight; requires Board brief
- **Rights Intelligence™** — consume publisher/writer/ISWC evidence to generate ownership insight; requires Board brief
- **UI Wiring** — surface Phase 8 engine output (`healthScore`, `healthReport`, `executiveBrief`) in Mission Control and the scan UI; requires Board brief
- **Phase 3.5 Sprint A** — dead code retirement (V1 stubs); deferred from Phase 3.5; requires Board authorization
- **Phase 3.5 Sprint E** — ISRC Coverage real-data validation against live tracks
- **Phase 3.5 Sprint F** — Publishing expansion (ASCAP/BMI/SOCAN adapter)

No sprint begins until the Board issues a formal brief.

---

## Outside the Intelligence-Wiring Sprint

These tracks were active prior to the sprint and remain on the roadmap:

| Track | Status |
|---|---|
| Royaltē Scan Experience V1 (`public/index.html`) | 🔒 DESIGN FROZEN (PR #122 held) |
| Royaltē Master Constitution | ✅ v1.3 (2026-06-11) |
| Canonical Payload V2 (wire format) | ✅ Board-ratified (`constitution/CANONICAL_PAYLOAD_V2.md`) |
| Beta launch | June 1, 2026 (per `LAUNCH_CHECKLIST.md`) |
| Live intelligence sources to wire | Spotify · Apple Music · MusicBrainz · Discogs · Listen Notes · YouTube · MLC Public API · MLC Bulk Data Feed |

---

## How to Update This Roadmap

Per the constitutional governance rule (see `AGENT_MEMORY.md` § 9), every Board-approved merge that affects platform state shall:

1. Tick the relevant ⬜ entry to ✅ in the **Phase Status** table.
2. Append the corresponding lock point (commit SHA, tag if any) in the row.
3. Update **What's Live in `main` Today** if the merge changes platform behaviour or new files are added to the Engineering Stack.
4. Move the **Next Engineering Target** entry into the Phase Status table once a Board brief is issued and work commences.

This roadmap is a **living document**. Older state is preserved through `governance/CHANGELOG.md` (append-only) and `governance/BOARD_DECISIONS.md` (append-only); the roadmap itself reflects only the present.
