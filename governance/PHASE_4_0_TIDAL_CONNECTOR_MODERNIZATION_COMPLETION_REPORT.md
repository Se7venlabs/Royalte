# Phase 4.0 — TIDAL Connector Modernization — Completion Report

**Status:** BOARD APPROVED FOR MERGE
**Date:** 2026-07-17
**Branch:** `feat/tidal-connector-modernization`
**Certification:** 74/74 assertions passing (new suite — none existed previously)

---

## Executive Summary

Final connector in the PAL modernization program — audited, then brought up
to the same constitutional standard as the 7 previously-modernized
connectors, per Board directive following the TIDAL Constitutional Audit.
Four of the audit's five findings were actioned; `AVAILABILITY` was
confirmed as correctly out of scope (no equivalent signal exists in TIDAL's
current API) and the dormant `HealthState.UNAVAILABLE` references were
explicitly left untouched, both per Board instruction.

## Files Changed

- `provider-acquisition/connectors/tidal/tidal-capabilities.js` (+2 — `RELEASES`, `ISRC`)
- `provider-acquisition/connectors/tidal/TidalConnector.js` (raw-evidence refactor + dead-code removal)
- `provider-acquisition/connectors/tidal/tidal-auth.js` (comment correction)
- `api/_lib/tidal-pal-acquisition.js` (companion fix — see below)
- `tests/certification/suites/17-tidal-connector.mjs` (new)
- `tests/certification/harness.mjs` (suite 17 registered)

## 1. Capability Declaration — Fixed

`TIDAL_CAPABILITIES` now declares `RELEASES` and `ISRC` alongside the
previously-declared 4 — both were already dispatched (aliased to the
existing `#fetchArtistAlbums`/`#fetchArtistTracks` methods) but never
declared, meaning `discoverCapabilities()` didn't accurately reflect what
the connector could do. 6 entries total, up from 4.

## 2. Raw Evidence Deviation — Fixed, with a scope finding along the way

`#fetchArtistIdentity`'s search path previously constructed a hand-picked,
reshaped payload (`{id, name, popularity, url, images}`) instead of
returning TIDAL's raw response. Refactored so the identity-lock (matching a
search candidate by exact name) is purely a *routing* decision — it selects
which artist ID to fetch full detail for, but the returned payload is
always TIDAL's own response, untouched:
- Detail fetch succeeds → raw JSON:API envelope (`{data: {id, attributes}, included: [...]}`)
- Detail fetch fails (rare fallback) → the raw, already-identity-locked resource object from the search response's `included[]` (not the full, still-ambiguous search envelope, and not a synthesized object — one real, untouched item TIDAL returned)

The now-unused `#extractUrl`/`#extractImages` reshaping helpers were removed
from the connector.

**Scope finding surfaced mid-implementation and disclosed before proceeding**:
this refactor is not connector-only. `api/_lib/tidal-pal-acquisition.js` — a
real production file wired into `api/_lib/run-scan.js` — had two hard
dependencies on the old flat shape: extracting `tidalArtistId` from
`payload?.id`, and `synthesizeTidalCompat()` parsing `detail.id` /
`detail.popularity` / `detail.images[0].href` directly. Both were updated to
parse the new raw shape via a new `_normalizeArtistResource()` helper.
`#extractUrl`/`#extractImages` were relocated here rather than deleted —
this file's own docstring already declares it a transitional compat/synthesis
layer ("[TRANSITIONAL]: Required by V1 module system... Retires when those
consumers migrate to RIE Rule Library"), which is constitutionally the
correct home for evidence interpretation — unlike the connector, which must
never do it. **`synthesizeTidalCompat()`'s external output shape is
byte-identical to before** — verified directly against both the full-detail
and fallback input shapes; only its internal parsing changed.

## 3. Certification — Built

`tests/certification/suites/17-tidal-connector.mjs` — 74 assertions across
11 groups (A–K): static contract, authentication, `ARTIST_IDENTITY` direct
path, search-path-with-successful-detail (asserts raw envelope, explicitly
asserts the *absence* of hand-picked flat fields), search-path-with-failed-detail
fallback (asserts the raw single-resource shape), no-identity-lock-match,
`ALBUMS`/`RELEASES` aliased dispatch, `TRACKS`/`ISRC` aliased dispatch
(including the required `collapseBy=FINGERPRINT` param), `reportHealth()`,
Evidence Contract integrity, and edge cases (missing subjectRef, 401/429
mapping, unsupported evidence type). Fully mocked — no live credentials
required or used in the suite itself.

## 4. Minor Cleanup — Done

`tidal-auth.js`'s stale "24 hours (86400s)" token-lifetime comment corrected
to the live-verified actual value (4 hours / 14400s), with a note that this
is informational only since the connector doesn't cache tokens.

## Explicitly Not Done (per Board scope)

- **`AVAILABILITY`**: not implemented. Live verification during the audit
  confirmed TIDAL's artist/album/track resources expose no per-market
  signal — `countryCode` scopes the catalog queried but the response body
  carries no "available here" field. No basis to build this without
  evidence the API supports it.
- **Dormant `HealthState.UNAVAILABLE` references**: two remain in this file
  (unchanged), part of the already-tracked, separate PAL-wide audit (task
  #17 in this session's tracking). Confirmed via full read of
  `tidal-http.js` that every failure path always sets a real `healthState`,
  so these are non-triggering in practice — same class as the other 11
  instances elsewhere in the PAL.
- **Token redaction consistency** (`#authResult()` returns the raw bearer
  token, same as `AppleMusicConnector`): flagged in the original audit as a
  PAL-wide inconsistency, not actioned here — outside this PR's authorized scope.

## Validation

Full certification harness: **17/17 suites, zero regressions** (all 8
previously-modernized connectors plus the 9 non-connector suites unaffected).
Repo pipeline test (`node tests/pipeline-test.mjs`): 218 positive + 8
negative assertions, all passing — confirms the `tidal-pal-acquisition.js`
change didn't disturb the broader scan pipeline. Manual smoke test proved
`synthesizeTidalCompat()`'s output is identical before/after for both the
full-detail and fallback input shapes.

## Merge Recommendation

**Recommend merge.** Completes the PAL connector modernization program — all
8 connectors (ACRCloud, Discogs, MusicBrainz, YouTube, Deezer, MLC, Spotify,
TIDAL) now share the same constitutional standard: accurate capability
declaration, raw-evidence-only acquisition, and full self-certification.
