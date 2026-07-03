# Royaltē Platform Roadmap

**Status:** single source of truth for platform progress.
**Authority:** subordinate to `constitution/ROYALTE_MASTER_CONSTITUTION.md`.
**Updated:** after every Board-approved merge (per governance rule, see `AGENT_MEMORY.md` § 9).

When this roadmap and the Constitution disagree, **the Constitution wins.**

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

---

## What's Live in `main` Today

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

---

## What's Live in Mission Control™ (as of 2026-07-03)

- **Music Ecosystem Status™ (Sprint 3.1)** — 6-section executive summary banner. Health Score, Last Scan, Next Scan, Changes Detected, Priority Actions, Monitoring Status. First module revealed on every MC boot. Constitutional Presentation Layer™ — reads from Health Intelligence™, Evidence Snapshot Store™, Monitoring Policy™, Evidence Events™, Executive Brief™, Monitoring Intelligence™. Merged at `aab47ca` (PR #209 + amendment).

---

## What's Not Live Yet

- **Mission Control modules 2–8** — Identity Intelligence, Publishing Intelligence, Catalog Intelligence, Change Detection, Backend Intelligence, Global Footprint, AI Insights all boot with locked sample HTML. Each requires its own Board implementation brief before wiring begins.
- **Publishing Intelligence™ not yet built.** The MLC evidence (recordings + works) is acquired and preserved in the CIM. The intelligence layer that reads this evidence — Publishing Intelligence™, Rights Intelligence™, Revenue Intelligence™ — requires a separate Board brief.
- **Monitoring and Revenue reserved sections remain placeholders.** `MONITORING`, `REVENUE`, and `GENERAL` in the Rule Library carry empty arrays; `monitoring` and `revenue` in reserved sections ship `null`. Phase 9+ may begin populating them.
- **All future work is Board-authorized only.** No phase begins until the Board issues a formal brief.

---

## Next Engineering Target

**Sprint 3.1 (Music Ecosystem Status™) complete. MC Constitutional Presentation Layer™ established.** The next phase requires explicit Board authorization. Options pending Board direction:
- **MC Sprint 3.2** — next Mission Control™ module wiring (Board brief required per module)
- **Publishing Intelligence™** — consume MLC + publishing evidence from CIM; requires Board brief
- **Rights Intelligence™** — consume publisher/writer/ISWC evidence to generate ownership insight; requires Board brief
- **Phase 3.5 Sprint A** — dead code retirement (V1 stubs); deferred; requires Board authorization

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
