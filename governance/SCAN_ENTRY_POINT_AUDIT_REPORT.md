# ROYALTĒ v3.0 — SCAN ENTRY POINT AUDIT™

**Status:** Discovery complete; Findings 1 and 2 RESOLVED under Phase 2 Recovery — Identity Resolution Completion (branch `recovery/release-centric-identity-completion`, prerequisite PR #384 merged).
**Type:** Constitutional Architecture Audit
**Merge Status:** Findings 1 and 2 corrected — see §6 Resolution below. Finding 3 remains explicitly deferred (Release vs. Catalog Analysis Scope™, future initiative). Finding 4 is informational only (no entry point exists to fix).
**Date:** 2026-07-21 (audit) / 2026-07-21 (resolution)

---

## 0. Method

Every claim below is a direct code citation, traced by hand through the live pipeline:

`public/index.html` (Scan Hero V3 UI) → `api/resolve-artist.js` (manual entry only) → `api/audit.js` → `api/_lib/run-scan.js` (`detectInputType` → `resolveToArtist` → `runScan`) → `api/_lib/canonical-scan-subject-assembler.js` → `api/_lib/apple-pal-acquisition.js` → `api/_lib/territory-intelligence.js`.

No assumptions were carried over from prior briefs. In particular, the premise that "Artist + Song" was fully corrected by PR #384 was re-verified from scratch — see Finding 1, which contradicts it.

---

## 1. Scan Entry Matrix

| Scan Type | Canonical Subject Created | Deterministic | Compliance | Issues |
|---|---|---|---|---|
| Artist + Song (manual entry) | ✅ `subjectType: 'release'` | ✅ correctly | 🟢 | **Finding 1 RESOLVED** — `resolve-artist.js` now returns the matched song's own release URL |
| Apple Music Track URL | ✅ `subjectType: 'release'` on the Spotify-matched path | ✅ correctly | 🟢 | **Finding 2 RESOLVED** — `resolveToArtist()`'s matched branch now preserves `trackTitle`/`trackIsrc` |
| Apple Music Album URL (no `?i=`) | ✅ (`subjectType: 'artist'`) | ✅ | 🟡 Album Scoped | Album-granularity release identity is out of current schema scope (by design, not a regression) — see Finding 3, unchanged |
| Apple Music Album URL (`?i=<songId>`) | ✅ `subjectType: 'release'` on the Spotify-matched path | ✅ correctly | 🟢 | Same fix as Finding 2 — the album-deep-link song ID now preserves its ISRC identically to a plain track URL |
| Spotify Track URL | ✅ (`subjectType: 'release'`, correct ISRC) | ✅ | 🟢 | None — regression-tested, unchanged |
| Spotify Album URL | ✅ (`subjectType: 'artist'`) | ✅ | 🟡 Album Scoped | No track-level identity exists for this input by explicit prior spec ("do NOT fetch tracks, do NOT use ISRC") — architecture boundary, not a defect; regression-tested, unchanged |
| Artist + Album (manual entry) | N/A | N/A | N/A | **Finding 4** — this entry point does not exist in the codebase (informational; unchanged) |

Legend: 🟢 Compliant · 🟡 Minor / scoped-out, not a regression · 🔴 Architectural Defect (verified)

---

## 2. Per-Entry-Point Detail

### 2.1 Artist + Song (manual entry — Scan Hero V3, Method 2)

**Scan Flow (as built):**
```
"Artist Name" + "Song Title" text fields  (public/index.html:1894-1896)
        ↓
GET /api/resolve-artist?name=...&song=...   (index.html:3336-3341)
        ↓
Rule A: Apple song search confirms artist identity via song match
        (api/resolve-artist.js:198-223)
        ↓
searchArtist(confirmedName) — Apple ARTIST search only (line 233)
        ↓
returns { url: artistResult.results[0].url }   ← an Apple ARTIST URL.
        The matched song object (with its own id/isrc) is discarded here.
        (resolve-artist.js:262)
        ↓
index.html writes this URL into #hero-url, calls runAudit()  (index.html:3348,3362)
        ↓
GET /api/audit?url=<apple ARTIST url>
        ↓
run-scan.js: detectInputType → 'apple', meta.kind === 'artist'
        ↓
resolveAppleArtist() artist branch (identity/apple.js:57-74) —
        returns { name, artworkUrl, appleArtistId, storefront } only.
        No trackTitle/trackIsrc field exists on this branch's return shape.
        ↓
appleTrackIsrc = null  (run-scan.js:571)
        ↓
seedCanonicalScanSubject({ ..., isrc: null })  →  subjectType: 'artist'
        ↓
acquireAppleEvidence({ isrc: null, ... })  →  Capability.ISRC never requested
        ↓
Territory Intelligence AVAILABILITY check uses extractFirstAlbumId()
        (arbitrary catalog-order album), exactly as before PR #384.
```

**Creation Point:** `seedCanonicalScanSubject()`, `run-scan.js:219` — same as every path. The defect is upstream of this call, not in it.

**Determinism:** Yes — deterministically wrong. The same artist+song input always resolves to the same (arbitrary) album, but it is never the album the song title actually identifies.

**Subject Preservation:** N/A in the strict sense — the subject is never seeded with release information to begin with, because the song identity is discarded one full layer *before* the Canonical Scan Subject™ lifecycle begins (inside `resolve-artist.js`, before `run-scan.js` is ever called).

**Provider Enrichment:** Apple only ever sees an artist-level request. No provider redefines the subject — there is no release-level subject to redefine.

**Evidence Resolution:** Confirmed clean — `territory-intelligence.js` correctly consumes whatever `appleAlbumId` arrives in the `AVAILABILITY`/`TERRITORIES` evidence package (`territory-intelligence.js:66-92`). It has no knowledge of, and does not need to know about, how that album id was chosen. This is a Provider Acquisition-layer defect, not a Territory Intelligence defect — consistent with the Board's non-goal ("do not change Territory Intelligence").

**Intelligence Consumers:** `canonicalScanSubject` is preserved into `canonicalForEnrichment` (`normalizeAuditResponse.js`) but is not yet consumed by any workspace beyond the Apple availability check inside `apple-pal-acquisition.js` — true for every entry point, not specific to this one.

**Constitutional Compliance:** 🔴 **Architectural Defect (Finding 1).**

---

### 2.2 Apple Music Track URL (paste — Scan Hero V3, Method 1)

**Scan Flow:**
```
Paste music.apple.com/.../song/.../<id> URL   (index.html #url-input)
        ↓
GET /api/audit?url=<apple song url>
        ↓
run-scan.js: detectInputType → 'apple', meta.kind === 'song'
        ↓
resolveAppleArtist() song branch (identity/apple.js:76-86) —
        CORRECTLY returns { name, artworkUrl, appleArtistId,
        trackTitle, trackIsrc, storefront }. trackIsrc is populated here.
        ↓
run-scan.js:601 — ISRC-first Spotify cross-discovery runs using appleTrackIsrc
        ↓
   ┌─── IF Spotify match succeeds (the common case) ──────────────────┐
   │ resolveToArtist() returns the "matched" object literal            │
   │ (run-scan.js:665-678). This object does NOT include trackTitle    │
   │ or trackIsrc — those two fields are simply absent from the        │
   │ literal, even though appleResolved (in scope one function up)     │
   │ has them.                                                          │
   │        ↓                                                          │
   │ appleIsrc = resolved.trackIsrc || trackData?.external_ids?.isrc   │
   │           = undefined || null   (trackData stays null because     │
   │             resolvedFromType === 'external', not 'track', so the  │
   │             trackData-fetch guard at run-scan.js:188 never fires) │
   │           = null                                                  │
   │        ↓                                                          │
   │ seedCanonicalScanSubject({ isrc: null })  →  subjectType: 'artist'│
   │        ↓                                                          │
   │ SAME arbitrary-first-album fallback as Finding 1.                 │
   └────────────────────────────────────────────────────────────────────┘
   ┌─── IF Spotify match fails (degraded path) ───────────────────────┐
   │ resolveToArtist() returns the "degraded" object literal           │
   │ (run-scan.js:684-700), which DOES include                         │
   │ trackTitle: appleTrackTitle, trackIsrc: appleTrackIsrc.            │
   │        ↓                                                          │
   │ appleIsrc correctly populated → subjectType: 'release' →          │
   │ PR #384's fix engages correctly.                                  │
   └────────────────────────────────────────────────────────────────────┘
```

**Creation Point:** `run-scan.js:219`, same as every path.

**Determinism:** Yes — deterministically wrong whenever Spotify successfully cross-matches the artist (the majority case, since Apple track URLs always carry an ISRC and the ISRC-first bridge is specifically built to succeed here). Correct only in the minority degraded-path case.

**Subject Preservation:** **Violated.** `appleResolved.trackTitle` / `appleResolved.trackIsrc` are resolved correctly one function up, then silently dropped by the "matched" return branch of `resolveToArtist()` — a direct parallel to the exact class of bug PR #384 fixed (evidence resolved, then discarded before use), except one layer earlier in the pipeline (identity resolution, not provider acquisition).

There is a second, related symptom of the same drop: the `rawResponse.trackTitle` / `rawResponse.trackIsrc` display fields (`run-scan.js:411-412`) fall through to `spotifyTopTracks[0]?.name` / `?.isrc` — i.e., an *arbitrary Spotify top track*, not the specific song the artist pasted a URL for. This means the defect is not purely internal to Territory Intelligence; it can also surface as visibly wrong track information in the scan result itself, for the same class of input.

**Provider Enrichment:** Apple resolves the correct release correctly. Spotify's cross-match (used only for artist-identity verification) is the point where the release-level data is thrown away — Spotify does not "redefine" the subject maliciously, the code simply forgets to carry the two fields through.

**Evidence Resolution:** Clean, same as 2.1 — this is upstream of Provider Acquisition entirely.

**Intelligence Consumers:** Same as every entry point — not yet consumed beyond the Apple availability check.

**Constitutional Compliance:** 🔴 **Architectural Defect (Finding 2).**

---

### 2.3 Apple Music Album URL

**Two sub-cases exist under one code path** (`identity/apple.js:88-108`):

**(a) Plain album URL (no `?i=` query param).** `resolveAppleArtist()`'s album branch returns `{ name, artworkUrl, appleArtistId, storefront }` — no track/ISRC fields, because none exist at album granularity, and (separately) the specific Apple **album id** the user scanned (`meta.id`) is never returned at all, even though it's known. This is a real information gap, but it is *not* a regression relative to any prior working state — no track-level identity was ever available for this input, and the current `SCAN_SUBJECT_TYPE` enum (`release` | `artist`) has no album-granularity slot by explicit, Board-approved scope (`canonical-scan-subject.js:12-24`). Extending it would be exactly the "Release vs. Catalog Analysis Scope™" work the Board has explicitly deferred. **Rating: 🟡** — documented for the future initiative, not a defect under current scope.

**(b) Album deep-link with `?i=<songId>` (a specific track within an album context).** `resolveAppleArtist()` takes the `meta.songId` branch (`identity/apple.js:90-99`), which returns the exact same shape as the plain song branch — `trackTitle` / `trackIsrc` populated correctly. This sub-case is therefore subject to **the identical defect as Finding 2** (2.2 above): the "matched" return branch in `run-scan.js:665-678` drops these fields on Spotify-match success. **Rating: 🔴**, same root cause as Finding 2 — not a separate finding, just an additional manifestation of it worth naming explicitly since "Apple Music Album URL" is its own line item in the Board's scope.

**Creation Point / Evidence Resolution / Intelligence Consumers:** identical to 2.2.

---

### 2.4 Spotify Track URL

**Scan Flow:**
```
Paste spotify.com/track/<id> URL
        ↓
resolveToArtist(): inputType 'spotify_track'  (run-scan.js:517-536)
        ↓
getSpotifyTrack(trackId) resolves the track directly; returns
        { ..., resolvedFromType: 'track', spotifyTrackId: trackId }
        ↓
run-scan.js:188 trackData-fetch guard FIRES (resolvedFromType === 'track'
        AND spotifyTrackId present) — re-fetches the same track
        (redundant call, not a defect — see §4 Future)
        ↓
appleIsrc = resolved.trackIsrc || trackData?.external_ids?.isrc
          = undefined || <real ISRC>  = <real ISRC>          ✅ correct
        ↓
seedCanonicalScanSubject({ isrc: <real ISRC>, trackTitle: trackData.name })
        →  subjectType: 'release'                             ✅ correct
        ↓
acquireAppleEvidence({ isrc: <real ISRC>, ... }) — Capability.ISRC fires,
        Apple's ISRC-matched song + its album relationship resolve correctly
        — exactly the PR #384 fix, engaging exactly as designed.
```

**Determinism:** Yes, correctly.

**Subject Preservation:** Intact end-to-end. No drop anywhere in this path.

**Constitutional Compliance:** 🟢 **Compliant.** No action needed.

---

### 2.5 Spotify Album URL

**Scan Flow:**
```
Paste spotify.com/album/<id> URL
        ↓
resolveToArtist(): inputType 'spotify_album'  (run-scan.js:540-558)
        ↓
getSpotifyAlbum(albumId) — explicitly does NOT fetch tracks
        ("Per spec: do NOT fetch tracks, do NOT use ISRC, do NOT add
        extra calls" — run-scan.js:539)
        ↓
returns { ..., resolvedFromType: 'album' }  — no spotifyTrackId
        ↓
trackData-fetch guard does not fire (resolvedFromType !== 'track')
        ↓
appleIsrc = null   ✅ correctly reflects that no track-level identity
        was ever resolved — nothing was discarded here, there was
        nothing to discard
        ↓
seedCanonicalScanSubject({ isrc: null }) → subjectType: 'artist'
        ↓
Territory Intelligence falls back to extractFirstAlbumId() — same
        treatment as any artist-only scan.
```

**Determinism:** Yes.

**Subject Preservation:** Not violated — there is no release-level information at any point in this path for anything to drop. This is architecturally identical to an artist-only scan, by original design.

**Constitutional Compliance:** 🟡 **Minor / scope boundary, not a defect.** A future Release vs. Catalog initiative could bridge Spotify album → Apple album (e.g., via UPC/barcode cross-reference), but building that now would violate this audit's own non-goal ("do not build Release vs. Catalog architecture").

---

### 2.6 Artist + Album (manual entry)

**Finding 4 — this entry point does not exist.** A full search of `public/index.html`, `public/dev-spec.html`, and every `api/*.js` handler found no "Artist Name + Album Title" manual-entry form or endpoint. The only album-adjacent manual field is the Scan Hero V3 "Song Title" field (which, per §2.1, only feeds Rule A's song-match disambiguation — it has no album equivalent). `dev-spec.html` references `albumTitle`/`album_title` only as *payload/schema* field names for displaying an already-resolved album, never as a form input.

The Board's scope list should be corrected to remove this as a supported entry point, or — if this method is intended to ship in the future — it does not yet exist and is out of scope for this audit (which covers what is built, not what is planned).

---

## 3. Findings Summary (verified, evidence-based only)

| # | Entry Point(s) | Root Cause | File:Line | Severity |
|---|---|---|---|---|
| **1** | Artist + Song (manual entry) | `resolve-artist.js` Rule A confirms identity via song match, then discards the matched song and returns an artist-only URL — no song/ISRC reference survives into the URL passed to `runScan()` | `api/resolve-artist.js:233,262` | 🔴 High — this is the Board's headline scan method |
| **2** | Apple Music Track URL (+ Album deep-link `?i=`) | `resolveToArtist()`'s Spotify-matched return branch omits `trackTitle`/`trackIsrc`, which `resolveAppleArtist()` resolved correctly one call earlier; only the degraded (no-Spotify-match) branch preserves them | `api/_lib/run-scan.js:665-678` (vs. correct handling at `684-700`) | 🔴 High — affects the majority (Spotify-matched) case for a common paste-URL input |
| **3** | Apple Music Album URL (plain, no `?i=`) | Apple album id known from the URL (`meta.id`) is never returned by `resolveAppleArtist()` at all | `api/_lib/identity/apple.js:101-108` | 🟡 Low — no regression, pre-existing scope boundary; only actionable alongside a future album-granularity schema decision |
| **4** | "Artist + Album" | Entry point described in Board scope does not exist in the codebase | N/A | 🟡 Informational |

**Both 🔴 findings share one property:** the *specific track/release the user identified* is resolved correctly by an underlying provider call, and is then thrown away one step later by an unrelated piece of code (an artist-only return shape) — not by a missing feature. Both are narrow, mechanical fixes (add fields to a return object; return a song URL instead of an artist URL when a song was already matched), not architecture changes. Neither requires a `SCAN_SUBJECT_TYPE` schema change — both would flow through the existing `release` subject type exactly as Spotify Track URL already does today (§2.4).

**Territory Intelligence Engine itself required zero changes to investigate this** — confirmed by inspecting `territory-intelligence.js:66-92`, which is agnostic to how `appleAlbumId` was chosen upstream. Every finding here is a Provider Acquisition / Identity Resolution-layer issue, consistent with the Board's non-goal that Territory Intelligence not be touched.

---

## 4. Recommended Actions

### Immediate (candidates for a future narrowly-scoped PR, same pattern as #384 — not implemented here)
- **Finding 1:** In `api/resolve-artist.js` Rule A, when a song match confirms identity, prefer returning the matched song's own Apple Music URL (if Apple's song search response includes `attributes.url`) instead of `artistResult.results[0].url`. This alone would let the existing `meta.kind === 'song'` path in `identity/apple.js` — already correct — carry the ISRC through, closing this finding without any schema change.
- **Finding 2:** Add `trackTitle: appleTrackTitle, trackIsrc: appleTrackIsrc` to the "matched" return object literal in `resolveToArtist()` (`run-scan.js:665-678`), mirroring the fields already present in the degraded-path literal three lines below it (`698-699`). Two-line change, no schema impact, brings the majority-case Apple Track URL path in line with the already-correct degraded-path and Spotify Track URL behavior.

### Future (explicitly deferred — matches Board's stated Release vs. Catalog Analysis Scope™ initiative)
- **Finding 3:** Album-granularity `SCAN_SUBJECT_TYPE` (or equivalent) so a specific Apple/Spotify album id can be preserved end-to-end for pure album-URL scans.
- Minor: Spotify Track URL's redundant double-fetch of the same track (`resolveToArtist()` and the `trackData` guard both call `getSpotifyTrack` for the identical `trackId}`) — a harmless inefficiency, not correctness-affecting, worth a one-line dedupe whenever that file is next touched for another reason.

### No Action Required
- Spotify Track URL (§2.4) — fully compliant.
- Spotify Album URL (§2.5) — architecturally consistent scope boundary, not a defect.
- Territory Intelligence Engine — confirmed unaffected by, and correctly agnostic to, every finding above.

---

## 5. Answers to the Board's Success Criteria

- **Does every supported scan entry point create the Canonical Scan Subject™ correctly?** No. Two entry points (Artist + Song manual entry, and Apple Track/Album-deep-link URLs on the Spotify-matched path) create a subject that is structurally valid but seeded with `isrc: null` when a real ISRC was in fact resolved and available — the subject is *created* correctly per its own schema, but *seeded* with the wrong (incomplete) inputs.
- **Is every scan path deterministic?** Yes, all six paths are deterministic — including the two defective ones, which are deterministically wrong rather than flaky. This matches the same characterization PR #384 used for the original confirmed defect.
- **Is user intent preserved end-to-end?** No, not for Findings 1 and 2 — the specific song the user typed or pasted a URL for is resolved correctly by a provider call and then discarded before the Canonical Scan Subject™ is seeded.
- **Are providers enriching rather than redefining the subject?** Yes — in every finding, the *provider* data was correct; the defect is in first-party glue code (`resolve-artist.js`, `resolveToArtist()`) discarding already-correct provider results, not in any provider redefining anything.
- **Do all Intelligence Engines consume the same canonical subject?** `canonicalScanSubject` is preserved uniformly into `canonicalForEnrichment` for every entry point, but is consumed today only by the Apple availability step inside `apple-pal-acquisition.js` — true for all six paths equally, not a per-entry-point discrepancy.
- **Which scan paths require future architectural work?** Findings 1 and 2 are narrow, immediate-candidate fixes. Finding 3 (album granularity) is the legitimate seed for the Board's next initiative. Finding 4 means the Board's own scope list should be corrected.

---

## 6. Resolution — Findings 1 & 2 (2026-07-21)

Implemented under **Phase 2 Recovery — Identity Resolution Completion** (branch `recovery/release-centric-identity-completion`). Sections 1-5 above are left as originally written (the as-found state); this section records what changed and the evidence it changed correctly. §1's Scan Entry Matrix and Compliance ratings have been updated in place to 🟢 for both.

**Finding 1 fix** — `api/resolve-artist.js` Rule A (song-confirmed path): when the Apple song search confirms identity, the handler now returns the matched song's own Apple Music URL (`matched.attributes.url`) instead of the artist-only URL, falling back to the artist URL only if Apple's song resource is missing its own `url` (should not happen in practice). No re-resolution, no new API call — the song object was already in hand. `resolveToArtist()`'s existing `meta.kind === 'song'` handling (already correct, proven by Finding 2's Spotify Track URL comparison) does the rest with zero further changes.

**Finding 2 fix** — `api/_lib/run-scan.js`'s `resolveToArtist()`, Apple-input Spotify-matched return branch (previously lines 665-678): added `trackTitle: appleTrackTitle, trackIsrc: appleTrackIsrc` to the returned object literal — the exact two fields already present on the degraded (no-Spotify-match) branch three lines below. Two-line addition, no schema change, no re-resolution.

**Regression evidence** — `tests/release-identity-completion-test.mjs`, 7/7 passing, one test per the Board's required list:

| # | Assertion | Result |
|---|---|---|
| 1 | Artist + Song → `subjectType = 'release'` | ✅ |
| 2 | Artist + Song → ISRC survives Identity Resolution | ✅ |
| 3 | Artist + Song → Canonical Scan Subject contains release identifiers | ✅ |
| 4 | Apple Track URL, successful Spotify bridge → ISRC/title/Apple identity preserved | ✅ |
| 5 | Apple Track URL → Canonical Scan Subject receives release identity | ✅ |
| 6 | Spotify Track URL → unchanged (regression) | ✅ |
| 7 | Album URLs (Spotify + Apple, no `?i=`) → unchanged, remain album-scoped (regression) | ✅ |

Every assertion drives the real exported functions (`resolveToArtist()`, `seedCanonicalScanSubject()`, the `resolve-artist.js` handler) through mocked network I/O — not re-implementations of their logic.

Full existing regression battery re-run and green on this branch: `tests/pipeline-test.mjs` (222+8), `tests/canonical-scan-subject-test.mjs` (6/6), `provider-acquisition/.../AppleMusicConnector.test.js` (47/47), `tests/territory-scan-test.mjs` (31/31), `tests/cio-assembler-test.mjs` (17/17), `lib/rie/__tests__/rie-activation.test.js` (20/20), `tests/certification/harness.mjs` (full suite CERTIFIED). No fixture drift — `normalizeAuditResponse.js` was not touched by this change.

**Confirmed untouched, per Board non-goals:** Territory Intelligence Engine, Provider Acquisition, Evidence Resolution, Intelligence Engines, Mission Control, the `SCAN_SUBJECT_TYPE` schema (still exactly `release` | `artist`, no new types added). Verified via `git diff --name-only`: only `api/_lib/run-scan.js` and `api/resolve-artist.js` changed, plus the new test file.

**Updated Success Criteria answers:**
- Does every *release-based* scan entry point create the Canonical Scan Subject™ with correct release identity? **Yes**, as of this fix — Artist + Song and Apple Track/Album-deep-link URLs now seed `subjectType: 'release'` with the correct ISRC, matching Spotify Track URL's already-correct behavior.
- Is user intent preserved end-to-end? **Yes**, for all release-based paths — the specific song a user names or pastes a URL for now survives from the provider's response through to the Canonical Scan Subject™.
- Finding 3 (album-granularity release identity) and Finding 4 (no "Artist + Album" entry point exists) remain open, by design — deferred to a future, separately-scoped Release vs. Catalog Analysis Scope™ initiative, per this project's explicit non-goals.
