# ISRC Intelligence™ v1 — Executive Review Package

**Module:** Catalog Intelligence™
**Initiative:** ISRC Intelligence™ v1
**Status:** Executive Review Package — MERGE NOT AUTHORIZED
**Branch:** `feat/catalog-intelligence-wiring`
**Commits:** `74964ed` (engine) · `ab7f7d2` (UI) · `2e459d5` (production fix)
**Date:** 2026-07-21

---

## 1. Executive Summary

**Objective.** Replace the permanently-null legacy ISRC coverage stub
(`catalogComparison: null`, hardcoded, never populated by any code path) with
a real, evidence-backed ISRC assessment engine, scoped to what Royaltē can
honestly claim today.

**Scope.** Version 1 uses exactly one evidence source — Apple Music's own
official catalog (`Capability.TRACKS`) — and makes exactly one claim: which
of an artist's Apple-listed recordings carry a verified ISRC. No
cross-provider reconciliation, no conflict detection, no inferred
relationships. This scope was proposed after the original 6-tier
multi-provider matching directive was found to assume evidence that doesn't
exist in the codebase, and was Board-approved as the honest v1 baseline.

**Architecture.** New evidence flows through the existing constitutional
pipeline unchanged in shape: PAL → EvidenceBridge → Catalog Evidence →
`isrc-intelligence.js` (new assembler) → Catalog Intelligence™ → Mission
Control. No new subsystem, no new canonical object, no bypass of the RIE.

**Production outcome.** Implementation surfaced and fixed one real,
previously-undetected production defect (Section 14, Discovery 1) — Apple's
`/songs` endpoint rejects `limit=25`. Post-fix, live-validated end-to-end
against two real artists (Michael Jackson, Adele) with real Apple evidence,
zero console errors, across desktop/tablet/mobile, with no regressions in
Identity Intelligence™ or Publishing Intelligence™.

**Board recommendation.** Production-ready. Recommend merge following
Board visual/architectural sign-off.

---

## 2. Architecture Summary

```
Apple Music Connector (#fetchArtistTracks)
    │  GET /catalog/{storefront}/artists/{id}/songs?limit=20
    ▼
apple-pal-acquisition.js — acquireAppleEvidence()
    │  Capability.TRACKS requested in the existing parallel batch B,
    │  alongside ALBUMS + VIDEOS + optional ISRC (reverse lookup)
    ▼
EvidencePackage[] (evidenceType: Capability.TRACKS, provider: 'apple_music')
    ▼
lib/rie/index.js — runRIE()
    │  bridgeToCanonical(evidencePackages)
    ▼
EvidenceBridge.js — translateAppleTracks(packages, canonical)
    │  JSON:API Song resources → canonical.platforms.appleMusic.details.tracks[]
    │  Provider-scoped (findFirstByProvider) — TRACKS is also supplied by
    │  Spotify/MusicBrainz/Deezer/Last.fm; an unscoped lookup could
    │  silently bridge the wrong provider's catalog.
    ▼
_mergeApplePalEvidence() → merged canonicalForEnrichment (local to runRIE)
    ▼
api/_lib/catalog-evidence.js — assembleCatalogEvidence(canonical)
    │  Structural relocation only. Produces:
    │    appleTracks: Array
    │    appleTracksAssessed: boolean  (ground-truth: was TRACKS evidence
    │                                   actually bridged, not just "is the
    │                                   array empty")
    ▼
api/_lib/isrc-intelligence.js — assembleIsrcIntelligence(evidence)  [NEW]
    │  Sole business-logic owner of ISRC assessment state/coverage/
    │  missing-recordings/provenance. Pure, deep-frozen, never throws.
    ▼
api/_lib/catalog-intelligence.js — assembleCatalogIntelligence()
    │  isrcIntelligence: <output of the above>  (replaces retired
    │  assembleIsrcCoverage()/ISRC_THRESHOLDS/ISRC_UNKNOWN/deriveIsrcStatus)
    ▼
cim.catalog → canonical.catalogIntelligence (CimAdapter)
    ▼
Mission Control runtime context (sessionStorage) → catalog-intelligence.html
    │  ISRC Intelligence™ card · ATHENA Executive Insight™ card ·
    │  Catalog Timeline™ card · ISRC Coverage™ KPI
```

No step in this chain was newly invented — every module boundary
(PAL → EvidenceBridge → Catalog Evidence → domain assembler → CIM →
Mission Control) already existed and is exercised identically by every
other Catalog Intelligence™ field. ISRC Intelligence™ is a new leaf, not a
new branch.

---

## 3. Canonical Evidence Model

`api/_lib/isrc-intelligence.js` — `assembleIsrcIntelligence(catalogEvidence, options)`. Deep-frozen output:

| Field | Type | Purpose |
|---|---|---|
| `status` | string | One of the four assessment states (§4). The single field UI and downstream consumers branch on. |
| `assessedCount` | number | Recordings evaluated (Apple-listed songs assessed for ISRC presence). `0` when not assessed or no recordings. |
| `verifiedCount` | number | Recordings with a real Apple-supplied ISRC (`attributes.isrc` non-empty string). |
| `missingCount` | number | `assessedCount - verifiedCount`. Recordings with no ISRC on the Apple resource. |
| `coveragePercent` | number \| null | `round(verifiedCount / assessedCount * 100)`. `null` when not assessed or zero recordings — never a fabricated `0`. |
| `conflictState` | `'NOT_APPLICABLE'` | Typed schema field only in v1. Always this value — see §4/§12. |
| `matchMethod` | string \| null | `'apple_catalog_direct'` when assessed; `null` when not. No multi-tier matching hierarchy exists in v1 — the recording and its ISRC come from the same first-party resource, so there is no separate "match" step to describe. |
| `missingRecordings` | `Array<{title, reason}>` | One entry per un-verified recording. `title` is the real Apple-supplied name when present, `null` otherwise — **never fabricated**. `reason` is a fixed vocabulary value (`NO_ISRC_ON_APPLE_RESOURCE`). |
| `provenance` | `{source, evidenceType, assessedAt}` \| `null` | `source: 'apple_music'`, `evidenceType: 'TRACKS'`, `assessedAt`: ISO 8601 timestamp of assembly. `null` when not assessed. Clock is injectable (`options.now`) for deterministic tests, matching `cio-assembler.js`'s existing pattern. |

---

## 4. Assessment State Definitions

| State | Produced when |
|---|---|
| `NOT_ASSESSED` | `evidence.appleTracksAssessed !== true` — i.e. the Apple TRACKS evidence package was never successfully bridged (Apple artist not resolved, acquisition failed, or the connector call errored). This is the *only* state in which `provenance` and `matchMethod` are `null` and `coveragePercent` is `null`. |
| `NO_RECORDINGS` | TRACKS evidence *was* assessed (`appleTracksAssessed === true`) but the artist has zero songs in Apple's catalog (`appleTracks.length === 0`). Distinct from `NOT_ASSESSED` — this is a genuine finding, not a missing assessment. |
| `ASSESSED_PARTIAL` | Assessed, `assessedCount > 0`, and `missingCount > 0` — at least one recording has no ISRC on the Apple resource. |
| `ASSESSED_COMPLETE` | Assessed, `assessedCount > 0`, and `missingCount === 0` — every Apple-listed recording carries a verified ISRC. |

`appleTracksAssessed` is the load-bearing distinction: without it, "assessed
with zero recordings" and "never assessed" both collapse to an empty array
and would be indistinguishable — the exact "0 verified is not equivalent to
not assessed" failure mode this codebase's evidence-honesty philosophy
exists to prevent.

---

## 5. Evidence Provenance

- **Evidence Source:** Apple Music Official Catalog — the artist's own,
  first-party song catalog as published on Apple Music.
- **Match Method:** `apple_catalog_direct` — the ISRC and the recording
  come from the identical JSON:API Song resource; there is no separate
  cross-reference or matching step in v1.
- **Provider:** `apple_music` (`PROVIDER_NAME` constant, `AppleMusicConnector.js`).
- **Assessment Timestamp:** ISO 8601, stamped at assembly time
  (`provenance.assessedAt`), rendered on the ISRC Intelligence™ card as
  "Assessed {date}".

**Why Apple is the v1 authoritative source:** Apple Music's `Capability.TRACKS`
is the only evidence source in the current codebase that returns a real,
first-party, per-track ISRC attribute for an artist's own catalog at scale
(20 tracks per request, real `attributes.isrc`). No other connector in this
repo currently exposes an equivalent full-catalog ISRC field through an
existing capability without additional acquisition work. Building a
multi-provider claim without that underlying acquisition work would mean
implying reconciliation that cannot actually happen — the reason the
original 6-tier proposal was scoped down.

---

## 6. Live Production Validation

Both scans run against a live Preview deployment
(`https://royalte-epsa3apnp-darrylwest-7086s-projects.vercel.app`, built
from commit `2e459d5`), via real `/api/audit` calls (Spotify-artist-URL
input, cross-resolved to Apple Music), not fixtures.

### Michael Jackson

| Field | Result |
|---|---|
| Recordings assessed | 20 |
| Recordings verified | 20 |
| Missing count | 0 |
| Coverage | 100% |
| Status | `ASSESSED_COMPLETE` |
| Match method | `apple_catalog_direct` |
| Conflicts | N/A — `conflictState: NOT_APPLICABLE` (not implemented in v1, by design) |
| Catalog Timeline™ | First Release 1972 · Latest Release 2026 · Catalog Age 54 yrs |
| Console | Zero errors (verified via `read_console_messages`, `onlyErrors: true`) |

### Adele

| Field | Result |
|---|---|
| Recordings assessed | 20 |
| Recordings verified | 20 |
| Missing count | 0 |
| Coverage | 100% |
| Status | `ASSESSED_COMPLETE` |
| Match method | `apple_catalog_direct` |
| Conflicts | N/A — `conflictState: NOT_APPLICABLE` |
| Catalog Timeline™ | First Release 2008 · Latest Release 2021 · Catalog Age 13 yrs |
| Console | Zero errors |

**Honest limitation:** neither real artist naturally produced
`ASSESSED_PARTIAL` or `NO_RECORDINGS` — both are major-label catalogs with
clean, complete ISRC metadata on Apple. Those two states, and version
non-collapsing (e.g. a Live/Remix/Remaster of the same title staying
independent), were verified structurally: (a) via the dev fixture, built to
mirror the real schema exactly (`ASSESSED_PARTIAL`, two missing recordings
including a `(Radio Edit)` variant), and (b) by direct inspection of Michael
Jackson's real Apple payload, which independently contains "P.Y.T. (Pretty
Young Thing)" twice and a "(2012 Remaster)" tag — both preserved as
separate entries by the assembler with no collapsing logic anywhere in the
code path. This was not forced or cherry-picked; it is what the real
catalog happened to contain.

`NOT_ASSESSED` was directly observed in production *before* the Section 14
fix (every real scan showed "— Not Assessed" despite Apple identity
resolving correctly) and confirmed corrected after.

**Preview URL** (per this repo's established Vercel-Preview-is-the-review-surface
convention — no local screenshot files committed):
`https://royalte-epsa3apnp-darrylwest-7086s-projects.vercel.app/workspaces/catalog-intelligence.html`

---

## 7. Responsive Validation

Tested live in Chrome against the same Preview deployment, real Adele scan
data (§6), plus the `ASSESSED_PARTIAL` fixture for missing-recordings-list
layout stress-testing.

| Breakpoint | Width | ISRC Intelligence™ | ATHENA Executive Insight™ | Catalog Timeline™ | Result |
|---|---|---|---|---|---|
| Desktop | 1568px | 3-stat row, full-width | Icon + sentence, side-by-side with Timeline | 3-stat row | No clipping, no overflow |
| Tablet | 834px | 3-stat row wraps cleanly | Same | Same | No clipping, no overflow |
| Mobile | ~583px (tool floor*) | Stats stack correctly; missing-recordings list (2 items, badges, provenance line) fully legible, no truncation | Text wraps naturally | 3 stat cards fit without horizontal scroll | No clipping, no overflow |

\*The browser automation tool's `resize_window` has a practical floor around
583px regardless of the requested width (390px requested) — a known,
previously-established limitation of the tool itself, not the page. No
horizontal page scroll was observed at any tested width.

Console errors: zero at every breakpoint.

---

## 8. Workspace Regression Testing

The only production-code change with cross-workspace blast radius is the
Apple PAL acquisition change (adding `Capability.TRACKS` to the existing
parallel batch) and the `/songs?limit` fix — both touch the shared Apple
evidence-acquisition path that Identity Intelligence™ and Publishing
Intelligence™ also depend on indirectly (same scan, same `runRIE()` call).

| Workspace | Real scan | Result |
|---|---|---|
| Identity Intelligence™ | Michael Jackson | Identity Presence™ 100%, 5/5 platforms Verified, Latest Release™ card intact, zero console errors |
| Publishing Ecosystem™ | Michael Jackson | Renders correctly with expected "Pending"/"Unavailable" states (no Music Rights Profile configured for this anonymous scan — expected, not a regression), zero console errors |
| Catalog Intelligence™ | Michael Jackson, Adele | Covered in full in §6/§7 |

No field breakage, no new console errors, no changed behavior outside the
Catalog Intelligence™ / ISRC Intelligence™ surfaces.

---

## 9. Performance Validation

All automated suites run clean on the final branch state (commit `2e459d5`):

```
tests/pipeline-test.mjs                    222 positive + 8 negative assertions passed
lib/rie/__tests__/rie-activation.test.js   20 / 20 passed  (Phase 2.4 certification COMPLETE)
lib/rie/__tests__/scan-migration.test.js   35 / 36 passed  (see note below)
tests/cio-assembler-test.mjs               17 / 17 assertions passed
```

**Note on `scan-migration.test.js`:** 1 failure — "Phase 2.1 conformance
suite: exactly 22 capabilities defined (got 24)". Confirmed **pre-existing
and unrelated to this work**: reproduced identically on a clean `git stash`
of every change in this branch, against `capabilityVocabulary.js`, a file
this initiative never touched. Not a regression introduced by ISRC
Intelligence™ v1.

No new test failures anywhere in the suite as a result of this work.

---

## 10. HTML Preview Package

Per this repository's established review convention (`feedback_royalte_vercel_preview_only`
— no local PNG/raw-image embeds; the live Vercel Preview URL is the sole UI
review surface), the Board's visual review should be performed directly
against the live deployment rather than static captures:

**`https://royalte-epsa3apnp-darrylwest-7086s-projects.vercel.app/workspaces/catalog-intelligence.html`**

This single URL serves Desktop, Tablet, and Mobile — resize the Board's own
browser window to inspect each breakpoint directly; pass/fail findings for
all three are documented in §7 from live automated testing at those exact
widths. Real Michael Jackson / Adele data is loaded via the live scan flow
described in §6; the `ASSESSED_PARTIAL` dev fixture (with the
missing-recordings list) loads automatically on a fresh session with no
prior scan.

---

## 11. Architectural Hygiene Report

**Files added**
- `api/_lib/isrc-intelligence.js` — new domain assembler, sole owner of
  ISRC Intelligence™ v1 business logic.

**Files modified**
- `api/_lib/apple-pal-acquisition.js` — `Capability.TRACKS` added to the
  existing parallel evidence batch.
- `lib/rie/EvidenceBridge.js` — new `translateAppleTracks()` translator,
  registered in `bridgeToCanonical()`'s Apple Music translation block.
- `api/_lib/catalog-evidence.js` — new `appleTracks[]` /
  `appleTracksAssessed` fields, following the existing `appleAlbums`
  relocation pattern exactly.
- `api/_lib/catalog-intelligence.js` — `isrcIntelligence` replaces
  `isrcCoverage` in the output shape; version bumped `1.2.0 → 1.3.0`.
- `provider-acquisition/connectors/apple-music/AppleMusicConnector.js` —
  `#fetchArtistTracks()` limit corrected `25 → 20` (production fix, §14).
- `public/js/mission-control-renderers.js` — `renderCatalog()` updated to
  the new `isrcIntelligence` field/shape.
- `public/js/mc-workspace-context.js` — `catalog-intelligence` workspace
  contract's optional-field path updated.
- `public/index.html` — legacy V1 "Website Scan" `os-found-grid` panel's
  ISRC coverage row mapped to the new status vocabulary with a
  human-readable label lookup (was silently reading a now-removed field).
- `public/workspaces/catalog-intelligence.html` — new ISRC Intelligence™,
  ATHENA Executive Insight™, and Catalog Timeline™ cards; compact
  catalogStatus/confidence text signal; dev fixture rewritten to the real
  schema.

**Files removed / legacy logic retired**
- `assembleIsrcCoverage()`, `deriveIsrcStatus()`, `ISRC_THRESHOLDS`,
  `ISRC_UNKNOWN` — deleted from `catalog-intelligence.js`. Confirmed via
  repo-wide grep to have no other callers before removal. This retires the
  dead-end `isrcComparison`/`catalogComparison: null` stub path this
  initiative was built to replace.

**New modules introduced**
- `isrc-intelligence.js` (see above) — first new domain assembler added to
  the Catalog Intelligence™ chain since the Phase 2 Recovery evidence
  normalization split.

**Version updates**
- `CATALOG_INTELLIGENCE_VERSION`: `1.2.0 → 1.3.0`.
- `ISRC_INTELLIGENCE_VERSION`: `1.0.0` (new).

**Dependency changes:** none.

**Technical debt reduced:** the permanent-null `isrcComparison`/`isrcLookup`
stubs in `apple-pal-acquisition.js`'s `synthesizeAppleMusicCompat()` remain
in place (they still feed the separate `[TRANSITIONAL]` V1 module-system
compat path, which is out of scope for this initiative and was not touched)
but are now provably dead for the Catalog Intelligence™ / ISRC Intelligence™
consumer — the real assessment no longer routes through them anywhere. Full
retirement of that compat shape is a separate, future cleanup, not bundled
into this PR to keep the change surgical.

---

## 12. Version 2 Roadmap (documentation only — not implemented)

- Spotify full-catalog ISRC reconciliation
- Deezer full-catalog ISRC reconciliation
- MusicBrainz reconciliation
- Cross-provider canonical recording identity
- Real `CONFLICT` state — genuine multi-provider disagreement detection
  (the `conflictState` field exists today as a typed schema placeholder,
  always `NOT_APPLICABLE`, specifically so this can slot in without a
  breaking schema change)
- Match-confidence hierarchy across providers
- Recording-version classification engine (formal Live/Remix/Acoustic/
  Radio Edit/Remaster taxonomy, distinct from today's "never collapse,
  treat every Apple resource as independent" default)
- Recording equivalency engine (linking the same underlying recording
  across providers without merging its metadata)

None of the above is implemented, stubbed as executable logic, or
schema-committed beyond the single reserved `conflictState` field.

---

## 13. Executive Recommendation

**Production ready:** Yes, for the scope defined. Real evidence, real
failure-mode discovered and fixed via live testing (not just code review),
zero regressions, zero console errors across all tested surfaces and
breakpoints.

**Remaining risks**
- Apple's `/songs` endpoint returns at most 20 tracks per artist, with no
  pagination anywhere in this codebase (pre-existing constraint, shared
  with `/albums` at 25 — not introduced by this work). Artists with more
  than 20 catalog entries will only have their first 20 (by Apple's
  internal ordering, effectively "top songs") assessed. `assessedCount`
  honestly reflects this — it never claims to cover the full catalog size
  shown elsewhere on the page (`totalTracks`).
- No automated test currently exercises the real Apple `/songs` endpoint's
  actual limit boundary (see Discovery 2, §14) — the mocked connector
  tests cannot catch a live API contract change like this again without a
  production smoke test.

**Known limitations**
- Single-provider evidence only (by design, v1 scope).
- `CONFLICT` state not implemented (by design).
- No pagination beyond Apple's per-request cap (pre-existing, shared
  constraint).

**Recommended merge decision:** Approve for merge following Board visual
review of the live Preview URL.

**Future enhancements:** see §12.

---

## 14. Lessons Learned (Executive Appendix)

### Discovery 1 — Apple's `/songs` endpoint caps `limit` at 20, not 25

`#fetchArtistTracks()` called
`GET /catalog/{storefront}/artists/{id}/songs?limit=25` — the same pattern
already used successfully for `/albums?limit=25`. Live-tested directly
against Apple's real API with a generated JWT:

```
GET /v1/catalog/us/artists/32940/songs?limit=25
→ 400 {"errors":[{"title":"Invalid Parameter Value",
       "detail":"Value must be an integer less than or equal to 20, but was: 25",
       "status":"400","code":"40005","source":{"parameter":"limit"}}]}
```

Because `AppleMusicConnector`'s `#get()` treats any non-2xx response as a
structural failure — `completeness: 'empty'`, no thrown exception — this
400 never surfaced as a visible error anywhere in the pipeline. It was
absorbed silently: `findFirstByProvider()` in `EvidenceBridge.js` correctly
skips packages with `completeness === 'empty'`, so `translateAppleTracks()`
simply never ran, `appleTracksAssessed` stayed `false`, and every real scan
produced an entirely plausible-looking `NOT_ASSESSED` state — indistinguishable,
from the outside, from "this artist just hasn't been assessed yet."

### Discovery 2 — Why mocked connector tests never caught this

`lib/rie/__tests__/rie-activation.test.js` and the certification suites
exercise `AppleMusicConnector` against a mocked `fetchFn` that returns
hand-built fixture payloads for whatever endpoint is requested — the mock
has no concept of Apple's real parameter validation rules, so a
structurally-valid-looking request (`limit=25`, a number, well within any
schema-shaped constraint a test author would think to check) passes every
existing assertion. The defect only exists in the live contract between
this codebase and Apple's actual production API — a class of bug unit
tests against a mock, by construction, cannot detect.

### Discovery 3 — How the issue was confirmed

1. Live browser scan (Michael Jackson, real Spotify→Apple resolution)
   showed `NOT_ASSESSED` in the deployed Preview despite Apple identity and
   ALBUMS evidence resolving correctly for the same artist in the same
   scan.
2. A pipeline trace (via a dedicated Explore pass) established that
   `assembleCatalogEvidence()` internally *does* receive the correctly
   RIE-bridged/merged canonical object — ruling out a wiring bug in the
   merge/return path.
3. Downloaded the project's real `APPLE_TEAM_ID` / `APPLE_KEY_ID` /
   `APPLE_PRIVATE_KEY` from the Vercel Preview environment
   (`vercel env pull`), generated a real Apple Music API JWT using the
   project's own `generateAppleToken()`, and called
   `GET /v1/catalog/us/artists/{id}/songs` directly with `curl`/`fetch` —
   reproducing the 400 outside the application entirely.
4. Confirmed the fix (`limit=20`) returns `200` with 20 real songs, real
   `attributes.isrc` values, and field names (`name`, `isrc`, `albumName`)
   matching `translateAppleTracks()`'s mapping exactly.
5. Re-deployed and re-validated live against both Michael Jackson and
   Adele in the browser — `ASSESSED_COMPLETE`, 20/20, zero console errors.

### Discovery 4 — Architectural improvements resulting from this work

- Apple's TRACKS capability now participates in the canonical evidence
  pipeline for the first time — every other connector (Spotify, Deezer,
  MusicBrainz, TIDAL, Last.fm) already requested it; Apple was the one gap.
- ISRC Intelligence™ now operates from real, first-party evidence instead
  of a permanently-null stub that had existed in the codebase since before
  this session — a defect this initiative discovered proactively.
- No browser-side fabrication: every number, badge, and missing-recording
  title rendered by the new UI traces to a real field on a real assembler
  output; nothing is computed or invented client-side beyond formatting.
- Catalog Intelligence™ now consumes a single canonical `isrcIntelligence`
  object instead of the retired `isrcComparison`/threshold-derivation
  machinery, removing one more instance of business logic that had crept
  toward the presentation layer.

### Discovery 5 — Recommendations for future provider integrations

- **Live endpoint validation during connector development.** A connector
  method should be exercised against the real provider API at least once
  before being wired to a capability request, even when it mirrors an
  already-working sibling endpoint's shape — parameter constraints are not
  guaranteed to match across a provider's own endpoint family (confirmed
  here: `/albums` allows 25, `/songs` does not).
- **Provider contract verification.** Where a provider publishes API
  documentation, capability limits (pagination caps, per-parameter bounds)
  should be captured as a comment at the call site, not assumed by analogy
  to a neighboring endpoint.
- **API capability documentation.** Each connector's capability map should
  note known per-endpoint limits alongside the capability itself, so future
  changes to those values are a deliberate, documented edit rather than a
  silent drift.
- **Endpoint limit verification.** Any new or newly-wired connector method
  should have its query parameters (`limit`, pagination cursors, filter
  values) checked against the provider's real API at least once via a
  manual smoke call, independent of mocked test coverage.
- **Response schema verification.** Field-name assumptions in a translator
  function (e.g. `attributes.isrc`, `attributes.albumName`) should be
  confirmed against a real response sample, not only against provider
  documentation, before being treated as load-bearing.
- **Production smoke testing before merge.** For any change that adds a
  new capability request to a live connector, a real (non-mocked) API call
  — even a single manual one — should be part of the pre-merge validation
  checklist, precisely because mocked tests structurally cannot catch a
  live contract mismatch like this one.

---

## Executive Board Addendum — Assessment Source Attribution (Future Recommendation)

Recorded per Board directive, **not part of this implementation and not a
merge blocker**.

Recommendation: every Mission Control intelligence workspace should
eventually display a compact "Assessment Source" line identifying the
evidence basis for its claims — the same evidence-honesty principle that
motivated ISRC Intelligence™ v1's scope decision, generalized platform-wide.

| Workspace | Proposed Assessment Source |
|---|---|
| ISRC Intelligence™ | Apple Music Official Catalog |
| Identity Intelligence™ | Apple Music (Canonical Identity) |
| Publishing Intelligence™ | Artist Profile + Canonical Publishing Evidence |
| Catalog Intelligence™ | Apple Music Official Catalog |
| Global Music Footprint™ | Apple Music Storefronts |
| Media Intelligence™ | Provider-specific evidence sources |

This should be scoped and designed as its own future platform-wide UI
initiative, not retrofitted piecemeal into this PR.

---

## Merge Authority

Implementation complete. Live production validation complete. Merge is
**NOT authorized** pending Executive Board visual, architectural, and
constitutional approval of this package.
