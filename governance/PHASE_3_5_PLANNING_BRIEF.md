# Phase 3.5 — Planning Brief

**Status:** PLANNING  
**Prepared:** 2026-07-02  
**Prerequisite:** Phase 3.4 certification complete (PR #191 merged)

---

## Starting Position

Phase 3.4 established a fully constitutional architecture. Every product renderer is a pure presentation layer. Every displayed concept has exactly one owner in the CIM. The PAL → RIE → CIM pipeline is proven end-to-end.

Phase 3.5 begins from a stable foundation. No emergency fixes. No migration debt. Clean history.

The objectives for Phase 3.5 are:
1. Complete the dead-code retirement that Phase 3.4 identified but deferred
2. Harden the platform for production artist usage (artist name acquisition, provider coverage)
3. Advance the provider migration roadmap (Spotify PAL, CimAdapter retirement)
4. Resolve the remaining vocabulary inconsistencies

---

## Recommended Roadmap

### Sprint A — Dead Code Retirement (1 PR, low risk)

Everything in this sprint has zero active callers. No regressions possible.

**Deliverables:**
- Delete `api/lib/health-score.js` (152 lines: `computeV2HealthScore`, `getHealthBand`, `HEALTH_GRADES`)
- Delete `tests/v2-health-score-test.mjs` (tests the deleted module; current source of 1 pre-existing test failure)
- Remove `window.__royalteScan.score` field from `public/index.html` (reads V1 `data.royalteScore`/`data.riskScore`; no active callers)
- Remove 10 V1 stub functions from `public/index.html`:
  - `renderRiskScore()` · `renderAuditCoverage()` · `renderTerritoryCoverage()`
  - `getScoreBand()` · `formatFollowers()` · `gbeFmtMoney()` · `renderGapBasedExposure()`
  - `showDemoResults()` · `setScore()` · `buildCards()` · `buildFlags()`
- Remove `GRADE_TO_CLASS['Review Recommended']` entry (pre-migration sessionStorage compat; TTL expired)

**Expected outcome:** 1 pre-existing test failure resolved. ~170 lines of dead code removed. Zero regressions.

---

### Sprint B — Artist Name Acquisition (1 PR, medium complexity)

**Problem:** Artist name text input is currently resolved to a URL inside the browser frontend (Hero V3), then the URL is passed to `/api/audit`. Any non-browser product surface (mobile, partner API, CLI) that wants to accept artist names must independently implement resolution.

**Solution — `ArtistNameAdapter` inside the PAL:**

New file: `api/_lib/pal/artist-name-adapter.js`

```
Input: artistName (string)
Output: Evidence Contract { type: 'artist-name-resolution', canonicalUrl, provider, confidence }

Resolution order:
  1. Spotify Search API → artist URL
  2. Apple Music Search API → artist URL (fallback)
  3. Resolution failure → structured error contract
```

New API endpoint mode: `GET /api/audit?name=<artist>` → internally resolves via `ArtistNameAdapter` → then runs normal acquisition pipeline.

The Web Hero V3 frontend may continue resolving for the browser UI (avoids round-trip). The backend adapter handles all other surfaces.

**Expected outcome:** Artist name is a first-class acquisition path. Partner API and CLI can accept artist names without building their own resolution.

---

### Sprint C — Vocabulary Alignment (1 PR, low risk)

**Problem:** Two vocabularies for health status labels coexist:

| Source | Labels |
|--------|--------|
| `GRADE_THRESHOLDS` in `api/schema/health.js` | 'World Class' · 'Excellent' · 'Strong' · 'Good' · 'Needs Improvement' · 'Critical' |
| `STATUS_BANDS` in `api/_lib/health-intelligence.js` | 'Excellent' · 'Strong' · 'Moderate' · 'Needs Review' |

The RIE assemblers expose `STATUS_BANDS` vocabulary to all renderers. `GRADE_THRESHOLDS` vocabulary appears in Board-locked test assertions and `healthScore.overallGrade`. These two systems serve different purposes (grade vs display status) but use overlapping terms inconsistently.

**Solution:**
1. Audit every place each vocabulary appears (schema, rules, tests, displays)
2. Codify the distinction: `grade` = letter/tier label (A+/A/B etc); `status` = display vocabulary
3. Rename `GRADE_THRESHOLDS` to `TIER_THRESHOLDS` if the vocabulary is actually tier-based
4. Add constitutional comment to each constant: "This vocabulary is the sole source for X"

This is a naming/documentation sprint — no threshold changes, no scoring changes.

---

### Sprint D — CimAdapter Retirement + Spotify PAL Migration (2 PRs, highest complexity)

**Dependencies:** Sprints A and B complete. A clean codebase makes this migration safer.

**CimAdapter retirement (PR 1):**

`lib/rie/CimAdapter.js` + `buildCimEnrichment()` in `api/audit.js` is the migration bridge that maps CIM output back to legacy field names. Retire it once we confirm the frontend reads exclusively from `data.canonical.*`.

Retirement checklist:
1. Grep every `data.` read in `public/index.html`, `mc-renderers.js`, `render-audit-pdf.js`, `executive-brief-v4.html` — confirm all are `data.canonical.*` or top-level metadata
2. Remove `buildCimEnrichment()` call from `api/audit.js`
3. Delete `lib/rie/CimAdapter.js`
4. Remove `normalizeAuditResponse.js` if no longer needed after above
5. Full regression + parity validation

**Spotify PAL migration (PR 2):**

Follows the same Evidence Contract pattern as `AppleMusicConnector` (Phase 3.3).

New file: `api/_lib/pal/spotify-connector.js`

- Implements `SpotifyConnector` following the constitutional connector interface
- Issues `SpotifyArtistEvidence`, `SpotifyAlbumEvidence`, `SpotifyTrackEvidence`
- Tested with 46+ assertions to match `AppleMusicConnector` regression surface
- Current Spotify direct API calls in the scan engine retired after connector activation

**Expected outcome:** Zero direct Spotify API calls outside the PAL. Provider migration is now a 1-file change (swap connector) not a codebase-wide search.

---

### Sprint E — ISRC Coverage Activation (1 PR, requires PAL work)

**Dependency:** Spotify PAL connector must be live (needed for cross-reference data).

**Problem:** `catalogIntelligence.isrcCoverage` returns `{ status: 'Unknown', assessed: false }` for all scans because `catalogComparison` evidence requires an Apple-Spotify ISRC cross-reference that was removed from the legacy scan path.

**Solution:**
1. Add `TRACKS` capability to `AppleMusicConnector` — fetches track ISRCs for a release
2. Add `TRACKS` capability to `SpotifyConnector` — fetches track ISRCs for the same release
3. Add `CatalogComparisonAssembler` in the RIE — cross-references Apple and Spotify ISRCs
4. Wire `catalogComparison` evidence into `assembleCatalogIntelligence`

**Expected outcome:** ISRC Coverage shows real data (Complete / Partial / Limited) instead of 'Unknown' for all scans.

---

### Sprint F — Publishing Intelligence Expansion (1 PR, extensible)

**Problem:** `assemblePublishingIntelligence` supports MLC only. The `SUPPORTED_SOURCES` array is designed to be extensible (Phase 5B constitutional D1) but no second source has been added.

**Candidate sources:** ASCAP, BMI, SOCAN, CISAC

**Note:** Each requires a corresponding PAL connector issuing a `PublishingRegistrationEvidence` contract. The Publishing Intelligence assembler itself does not change — sources are additive.

**Recommendation:** Add one source (ASCAP recommended — largest US PRO) as Sprint F-1. This proves the extensible path and gives the Board visibility into whether the design holds for real-world PRO data.

---

## Recommended Phase 3.5 Order

| Sprint | Deliverable | Risk | Unlocks |
|--------|-------------|------|---------|
| A | Dead code retirement | Low | Cleaner codebase for all subsequent work |
| B | ArtistNameAdapter (PAL) | Medium | Partner API / CLI artist name input |
| C | Vocabulary alignment | Low | Cleaner schema for Sprint D |
| D | CimAdapter retirement + Spotify PAL | High | Full provider migration completion |
| E | ISRC Coverage activation | Medium | Real ISRC data in all scans |
| F | Publishing expansion (ASCAP) | Medium | Multi-PRO coverage reports |

Sprint A can begin immediately. B and C can run in parallel. D blocks on A+C. E blocks on D. F can run in parallel with E.

---

## What Phase 3.5 Does NOT Include

- Mission Control redesign (Board Module Freeze in effect — see `project_royalte_module_freeze.md`)
- Health Engine threshold changes (Board-locked — requires formal Board Review)
- New product surfaces (Partner API, mobile — these are business decisions, not engineering ones)
- Rule Library additions (can be added per the Phase 5/6 constitutional process; not a Phase 3.5 concern)

---

## Phase 3.5 Success Criteria

Phase 3.5 is complete when:
1. Zero dead-code retirement candidates remain in the codebase
2. `ArtistNameAdapter` is live and tested
3. `CimAdapter.js` is deleted
4. Spotify acquisition runs through the PAL
5. ISRC Coverage shows real data (not 'Unknown') in production scans
6. All pre-existing test failures are resolved (currently: 2 — `v2-health-score-test.mjs` and `publishing-wiring-test.mjs`)

---

*Phase 3.5 Planning Brief prepared 2026-07-02. Awaiting Board review and Sprint A authorization.*
