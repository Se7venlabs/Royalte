# Global Music Footprint™ — Canonical Artist Territory Intelligence™ — Implementation Report

**Status:** Implemented, tested, not yet merged. Per Board Decree (2026-07-25).
**Supersedes:** single-album Artist Scan territory evaluation.
**Depends on:** `GLOBAL_MUSIC_FOOTPRINT_PRINCE_TERRITORY_REGRESSION_INVESTIGATION.md` (root cause), `GLOBAL_MUSIC_FOOTPRINT_ARTIST_LEVEL_TERRITORY_DESIGN_BRIEF.md` (approved design).

---

## 1. Canonical Definition of Artist Presence™ (as implemented)

> **A storefront is Available when at least one release from a Board-approved, evidence-ranked sample of the artist's canonical catalog exists within that storefront.**

Implemented exactly as the approved design specified: OR-aggregation over a bounded top-N sample (default N=5, `TERRITORY_SAMPLE_SIZE`), never the full catalog and never a percentage threshold.

---

## 2. New execution flow (as implemented)

```
Artist Scan (no ISRC resolved)
        │
        ▼
ARTIST_IDENTITY → ALBUMS  (unchanged PAL steps)
        │
        ▼
extractAlbumCandidates()          [api/_lib/apple-pal-acquisition.js — NEW]
        │  flattens raw Apple JSON:API album resources into
        │  { id, name, trackCount, releaseDate, artwork, url, upc }
        ▼
selectTopVerifiedReleases()       [api/_lib/best-verified-release.js — NEW export]
        │  reuses existing Board-locked BVR scoring (scoreAlbum/compareScored,
        │  UNCHANGED weights) — ranks all candidates, returns top N
        ▼
#fetchGlobalStorefrontAvailability(subjectRef)  [AppleMusicConnector.js — EXTENDED]
        │  accepts subjectRef.appleAlbumIds (array); same 167-storefront,
        │  wave-based fan-out; ids= now comma-separated (batched, same
        │  request count as before — see §5)
        ▼
Territory Intelligence Engine™    [api/_lib/territory-intelligence.js — UNCHANGED]
        │  classifyAppleStorefrontResult()'s existing `data.length > 0`
        │  check already means "any requested album present" once the
        │  evidence itself carries multiple album matches — zero Engine
        │  code was modified, proven by tests/canonical-artist-territory-test.mjs
        │  calling the real assembleTerritoryIntelligence() directly
        ▼
Global Music Footprint™ / Runtime Context / Mission Control™ — UNCHANGED
```

**Song/Release-scoped scans** (Artist + Song, Apple Song URL) are untouched: `resolvedReleaseAlbumId` still takes unconditional priority (`if (resolvedReleaseAlbumId) { availabilityAlbumIds = [resolvedReleaseAlbumId]; }`) — single-release evaluation, exactly as before this decree.

---

## 3. Files changed

| File | Change |
|---|---|
| `api/_lib/best-verified-release.js` | **New export** `selectTopVerifiedReleases(albums, artistName, n)`. Zero changes to any existing export, weight, or the existing `selectBestVerifiedRelease()`/`debugScoreReport()` behavior — reuses the same internal `scoreAlbum`/`compareScored` pipeline unmodified. |
| `api/_lib/apple-pal-acquisition.js` | **New export** `extractAlbumCandidates(contract)` (raw JSON:API → flat album shape, mirrors `EvidenceBridge.js`'s `translateAlbums()` field mapping). **New constant** `TERRITORY_SAMPLE_SIZE = 5`. **Changed**: the AVAILABILITY step's selection logic — artist-only scans now rank candidates via `selectTopVerifiedReleases()` instead of calling `extractFirstAlbumId()`; `resolvedReleaseAlbumId` priority for song-scoped scans is unchanged. `extractFirstAlbumId()` itself is untouched and still exported (regression-tested in isolation) but **no longer called from `acquireAppleEvidence()`**. |
| `provider-acquisition/connectors/apple-music/AppleMusicConnector.js` | `#fetchGlobalStorefrontAvailability()` now accepts `subjectRef.appleAlbumIds` (array), batching all requested ids into a single comma-separated `ids=` value per storefront request — same 167-request, wave-of-50 structure as before. `subjectRef.appleAlbumId` (singular) still accepted for backward compatibility. Payload field renamed `albumId` → `albumIds` (confirmed via repo-wide search that nothing downstream read the singular field name). |
| `api/_lib/territory-intelligence.js` | **Not modified.** Confirmed unchanged by `git diff`. |
| `api/_lib/global-music-footprint.js`, `public/js/runtime-context-mapper.js`, `public/workspaces/global-music-footprint.html` | **Not modified.** Confirmed unchanged by `git diff`. |

---

## 4. Evidence methodology — confirms the design brief exactly as approved

- Album ranking: existing, Board-locked `BVR_*` scoring constants — no weight changed, no new scoring algorithm invented.
- Per-storefront presence: same real Apple Music API response classification (`classifyAppleStorefrontResult`) already in production.
- Aggregate rule: any-of-N-samples present (OR) — not a fabricated percentage, not a new confidence tier.
- Sample size: `TERRITORY_SAMPLE_SIZE = 5`, a new named, Board-auditable constant, matching the existing pattern of `GLOBAL_SF_WAVE_SIZE` / `STATUS_THRESHOLDS` / `BVR_*_WEIGHTS`.
- Honest degradation: if BVR scoring finds zero eligible candidates (malformed/empty album metadata — rare), no AVAILABILITY evidence package is added at all. Territory Intelligence Engine then honestly reports `NOT_EVALUATED` for every territory rather than reintroducing a fabricated single-album guess.

---

## 5. Performance — Apple batch `ids=` behavior

**Confirmed as designed, at the code level — not yet confirmed against a live Apple API response** (no Apple credentials available in this environment; see Limitations, §8). The implementation sends `ids={id1},{id2},{id3}` in a single request per storefront, per wave, identical to the pre-existing 167-request / 50-per-wave structure. If Apple's endpoint behaves as its own parameter naming (`ids`, plural) and general Apple Music Catalog API convention suggests, this is a **zero-request-count increase** over the previous single-album behavior. This is the first thing that should be confirmed with a real deployed scan before this is treated as fully proven in production, exactly as flagged in the design brief.

No caching was implemented (none was proposed in the approved design). No change to `GLOBAL_SF_WAVE_SIZE` (still 50) or the sequential-wave structure.

---

## 6. Regression results

All existing suites green, zero regressions:

| Suite | Result |
|---|---|
| `tests/canonical-scan-subject-test.mjs` | 6/6 (2 stale assertions corrected — see §7) |
| `tests/best-verified-release-test.mjs` | 92/92 (17 new assertions for `selectTopVerifiedReleases`) |
| `provider-acquisition/.../AppleMusicConnector.test.js` | 49/49 (2 new tests: multi-album batching, singular-id backward compatibility) |
| `tests/pipeline-test.mjs` | 222+8 |
| `tests/territory-scan-test.mjs` | 31/31 |
| `tests/cio-assembler-test.mjs` | 17/17 |
| `lib/rie/__tests__/rie-activation.test.js` | 20/20 |
| `tests/golden-fixture-test.mjs` | 31/31 |

**New test file:** `tests/canonical-artist-territory-test.mjs` (7/7) — the decisive regression proof. Directly exercises the real, unmodified `assembleTerritoryIntelligence()` (not a re-implementation) against a synthetic Prince-shaped fixture (a sparse, catalog-order-first "compilation" album vs. two well-verified "flagship" albums), proving:
1. `selectTopVerifiedReleases()` does not select the catalog-order-first album when better-verified releases exist (the regression proof).
2. The real Engine correctly reconciles a storefront to `AVAILABLE` when it carries *any* one of the sampled albums.
3. The real Engine correctly reconciles a storefront absent from the response to `NOT_EVALUATED` (never fabricated into `UNAVAILABLE`) — re-confirming the investigation's earlier finding that this failure mode does not exist.

---

## 7. Stale test corrections (honesty maintenance, not new defects)

`tests/canonical-scan-subject-test.mjs` contained a local re-implementation of the *old* selection expression (`resolvedReleaseAlbumId || fallbackFirstAlbumId`) used to demonstrate two artist-only-adjacent scenarios. Both scenarios' final assertions described behavior that is no longer what production code does. Corrected in place: kept every assertion that is still true (album/ISRC extraction correctness, never-fabricate-on-missing-relationship), removed the now-false claims about production fallback behavior, and pointed to the new dedicated test file. The still-accurate test (Song-scan uses the resolved release, not the fallback) was left untouched — it remains true under the new code exactly as before.

---

## 8. Limitations

No live scan was executed against the real Apple Music API (no credentials in this environment; running one would touch production without separate authorization). Every claim above is verified by direct code citation and by real, executable regression tests operating on realistic fixtures — not by live observation. Two things specifically still need live confirmation once deployed:
1. Apple's batch `ids=` behavior (§5) — the single highest-value thing to verify first.
2. A live before/after scan of Prince (and the Board's other named artists) to produce the requested before/after canonical payload comparison — this requires a deployed environment with real Apple credentials, which this implementation pass did not have access to.

---

## 9. Executive Validation

- **Before/after execution diagram:** §2 above (before: `governance/GLOBAL_MUSIC_FOOTPRINT_PRINCE_TERRITORY_REGRESSION_INVESTIGATION.md` §3; after: this document's §2).
- **Before/after canonical payload comparison:** cannot be produced from real Apple data without a live scan (§8) — the synthetic fixture in `tests/canonical-artist-territory-test.mjs` demonstrates the corrected mechanism precisely (a sparse first-in-catalog-order album no longer solely determines the result; two better-verified albums are included in the sample and correctly OR-aggregated), which is the strongest evidence available without live API access.
- **Storefront evidence comparison:** demonstrated in the same test file — `us` (carries a sampled album) → `AVAILABLE`; `jp` (carries none of the sample) → genuinely `UNAVAILABLE`; a storefront never returned in the response at all → `NOT_EVALUATED`, never collapsed.
- **Performance metrics:** §5 — request-count reasoning provided; live measurement pending deployment.
- **Regression results:** §6 — full battery green, 0 failures, 7 new dedicated tests.
- **Confirmation that Mission Control required no modifications:** **Confirmed.** `git diff --name-only` shows zero changes to `public/js/runtime-context-mapper.js`, `public/workspaces/global-music-footprint.html`, `public/js/global-map-viewport.js`, `public/js/mission-control*.js`, or `api/_lib/global-music-footprint.js`. The correction is entirely contained within the acquisition layer, exactly as the Board's approved architecture specified.

---

## 10. Architectural rationale (summary)

This closes the architecture-vs-implementation gap the Board identified: Global Music Footprint™'s acquisition layer now asks "does this artist's real catalog exist in this storefront," not "does one arbitrarily-selected album exist here." The Territory Intelligence Engine™, Runtime Context, and Mission Control remain exactly as certified in the prior investigation — untouched, because the defect never lived there. The fix reuses two pieces of existing, Board-governed infrastructure (Best Verified Release™ scoring for ranking, the Engine's existing OR-style storefront classification for aggregation) rather than inventing new methodology, consistent with this codebase's standing "reuse over rebuild" principle.
