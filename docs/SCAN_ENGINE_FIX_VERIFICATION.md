# SCAN ENGINE FIX VERIFICATION

**Date:** 2026-06-09
**Reference artist:** Black Alternative
  - Apple Music ID `505490272` · `https://music.apple.com/us/artist/black-alternative/505490272`
  - Spotify ID `1lnM3VZrD6SG9vxBsE9654` · `https://open.spotify.com/artist/1lnM3VZrD6SG9vxBsE9654`
  - Verified YouTube channel `UCOIO07KGdBFp9Ej40iaZRGQ` (official, title "Black Alternative Music")
**Bugs fixed (PR #112 on `feat/scan-engine-determinism`):**
  - BUG 1 — Apple→Spotify ISRC bridge for artist-URL inputs (`4ced71f`)
  - BUG 2 — YouTube strict-match-or-null + constitutional verified-channel gate (`f14c98f`)
  - Convergence test enforcing Apple/Spotify URL business-intelligence equivalence (`1fca82f`)
  - Royaltē Identity Graph™ external identity provider (`90b5cf3`)
**Constitutional framework:** [Royalté Master Constitution v1.0](../constitution/ROYALTE_MASTER_CONSTITUTION_v1.md) · Governance Directive Rules 1, 2, 3, 4, 5 · Identity Graph separation

---

## CONSTITUTIONAL INTELLIGENCE MAP

For every payload field that drives a Mission Control surface, Executive Brief, or Health Score component:

| Field | Primary Source | Verification Sources | Confidence |
|---|---|---|---|
| `artistName` | Apple Music (artist URL canonical) | Spotify name-verify (when ISRC bridge resolves Spotify ID) | Verified |
| `artistId` (Spotify) | Spotify URL direct, OR Apple→ISRC bridge → Spotify track → `artists[0].id` | `getSpotifyArtist().name` normalize-matches Apple canonical (gate at line 111) | Verified |
| `appleArtistId` | Apple Music URL path / `resolveAppleArtist()` | — (canonical source) | Verified |
| `appleStorefront` | Apple Music URL storefront segment | — (canonical source) | Verified |
| `genres` | Apple Music `attributes.genreNames` (canonical) | Spotify `artist.genres` (informational, never overwrites Apple) | Verified |
| `platforms.appleMusic` | `resolveAppleArtist()` returns `appleArtistId` | — (canonical source) | Verified |
| `platforms.spotify` | Spotify URL direct OR Apple→ISRC bridge resolved + name-verified | `discoverSpotifyByIsrc()` + `getSpotifyArtist().name` match | Verified |
| `platforms.youtube` | `getYouTube()` → Royaltē Identity Graph™ lookup first, strict name-match fallback | YouTube channels resource for stats | Verified OR UNVERIFIED (no fallback) |
| `platforms.deezer` | `getDeezer()` name search | strict exact-match | High |
| `platforms.musicbrainz` | `getMusicBrainz()` name search | strict exact-match | High |
| `platforms.lastfm` | `getLastFm()` name search | strict exact-match | High |
| `appleMusic.albums` | Apple Music API (ID-direct) | — (canonical source) | Verified |
| `appleMusic.storefrontAvailability` | Apple Music BIG6 storefronts | — (canonical source) | Verified |
| `appleMusic.isrcLookup` | Apple Music ISRC endpoint | — (canonical source when present) | Verified |
| `youtube.officialChannel.title` | YouTube channels resource (authoritative) | — | Verified |
| `youtube.officialChannel.channelId` | Royaltē Identity Graph™ OR YouTube strict-name match | — | Verified |
| `youtube.officialChannel.verifiedVia` | engine constant (`'royalte_identity_graph'` \| `'strict_name_match'`) | — | Verified (provenance) |
| `youtube.officialChannel.{subscribers,totalViews,videoCount}` | YouTube channels.statistics | — | Verified (when channel verified) |
| `youtube.ugc.*` | **REMOVED** — no defensible source absent ContentID API | — | n/a (always absent post-fix) |
| `royaltyGap.ugcUnmonetisedViews` | gated on `YOUTUBE_REVENUE_REQUIRES_VERIFIED_CHANNEL` + `youtube.availability === 'VERIFIED'` | — | Always 0 in current model |
| `royaltyGap.ugcPotentialRevenue` | derived from `ugcUnmonetisedViews` | — | Always 0 in current model |
| `gapBasedExposure.indicators[content-id-gap]` | gated on verified channel + `contentIdRisk` + `ugcViews > 100` | — | Never fires in current model |
| `lastfm.playcount` | Last.fm API `getInfo` endpoint | — | High |
| `catalog.totalReleases` | Spotify albums (when available) OR Apple Music albums fallback | strict counts | High |
| `score.overall` | computed from module scores, deterministic | — | Verified |

**Confidence enum:**
- **Verified** — single authoritative source OR multiple corroborating sources with strict identity gates
- **High** — single source with strict exact-match-or-null discipline (PR #103)
- **Moderate** — single source, no exact-match guarantee
- **Unknown** — no source available

---

## PRODUCTION EVIDENCE (BEFORE — current `main`, pre-fix)

Convergence test ran live against `https://royalte.ai/api/audit` on 2026-06-09 at 13:22 UTC, immediately before the merge call. Production is at `main` HEAD, **does not** contain PR #112 fixes.

### Test command
```
CONVERGE_LIVE=1 node tests/payload-convergence-test.mjs
```

### Test result
```
[convergence] LIVE mode — host: https://royalte.ai
[convergence] mode=live host=https://royalte.ai
[convergence] fields compared: 203, provenance-exempt: 20
✖ Payload convergence FAILED — 6 divergent business-intelligence field(s)
```

### Divergent fields (6 of 203)

| Field | Apple URL | Spotify URL | Root Cause |
|---|---|---|---|
| `artistId` | `null` | `"1lnM3VZrD6SG9vxBsE9654"` | BUG 1 — ISRC bridge never fires (no `trackIsrc` on artist URLs) |
| `spotifyMatched` | `false` | `true` | BUG 1 — downstream of `artistId` |
| `platforms.spotify` | `false` | `true` | BUG 1 — downstream of `artistId` |
| `royaltyGap.ugcUnmonetisedViews` | `4,392,619` | `18,648,353` | BUG 2 — derived from contaminated UGC view count |
| `royaltyGap.ugcPotentialRevenue` | `$6,589` | `$27,973` | BUG 2 — derived from `ugcUnmonetisedViews` |
| `youtube.ugc.estimatedViews` | `4,392,619` | `18,648,353` | BUG 2 — keyword-text-search sums view counts of unrelated videos |

### Production "official channel" today is the Topic channel — false positive
Both BA URL scans currently resolve YouTube to the **Topic channel** (`UCOD08w7bwiOlcW3DZEhLKdA`), title `"Black Alternative - Topic"`:
```json
"officialChannel": {
  "title": "Black Alternative - Topic",
  "channelId": "UCOD08w7bwiOlcW3DZEhLKdA",
  "subscribers": 4,
  "totalViews": 16,
  "videoCount": 4
}
```
This is **wrong** — Topic channels are YouTube-auto-generated for distributed music, not artist-owned. The substring match (`norm("Black Alternative - Topic").includes(norm("Black Alternative"))`) currently passes, producing a verified-looking channel that the artist does not own. Per Constitution, this is identity contamination of the same class banned by PR #103 for Spotify.

### Production UGC top videos today (unrelated content)
Both scans currently return UGC `topVideos` like:
```json
{
  "title": "What NOT to say to a black alternative/goth person…",
  "channel": "Cocoa De Vampyr",
  "videoId": "zLDOnck-JM0"
}
```
This video is not Black Alternative's content. It surfaced because YouTube's text search returned it for the query `"Black Alternative"` and its channel ("Cocoa De Vampyr") doesn't contain the artist's name → passed the UGC filter → counted in `estimatedViews`.

Run-to-run variance proves the contamination: the two payloads (captured 1 second apart) report `4,646,446` vs `4,361,088` UGC views for the same query — different YouTube search results, different sums, identical query.

### Convergence test output (raw)
Cached at `/tmp/convergence-prod-prefix.txt` (Vercel preview is auth-protected; production is the only public surface for live convergence runs).

---

## EXPECTED PRODUCTION EVIDENCE (AFTER — post-merge)

After PR #112 merges to `main` and Vercel auto-deploys, the same convergence test against `https://royalte.ai/api/audit` MUST produce:

```
[convergence] mode=live host=https://royalte.ai
[convergence] fields compared: 203, provenance-exempt: 20
✓ Payload convergence VERIFIED — Apple URL and Spotify URL produce identical business intelligence.
```

### Predicted post-fix field state

| Field | Predicted Apple URL | Predicted Spotify URL | Why |
|---|---|---|---|
| `artistId` | `"1lnM3VZrD6SG9vxBsE9654"` | `"1lnM3VZrD6SG9vxBsE9654"` | BUG 1 fix — ISRC bridge fans out across all artist ISRCs from Apple, name-verifies on Spotify |
| `spotifyMatched` | `true` | `true` | downstream of `artistId` resolution |
| `platforms.spotify` | `true` | `true` | downstream of `artistId` resolution |
| `youtube.availability` | `"VERIFIED"` | `"VERIFIED"` | Identity Graph hit (`black alternative` → `UCOIO07KGdBFp9Ej40iaZRGQ`) |
| `youtube.officialChannel.channelId` | `"UCOIO07KGdBFp9Ej40iaZRGQ"` | `"UCOIO07KGdBFp9Ej40iaZRGQ"` | Identity Graph lookup |
| `youtube.officialChannel.title` | `"Black Alternative Music"` | `"Black Alternative Music"` | Authoritative from YouTube channels resource |
| `youtube.officialChannel.verifiedVia` | `"royalte_identity_graph"` | `"royalte_identity_graph"` | Constitutional traceability — engine constant |
| `youtube.ugc` | absent | absent | UGC discovery removed; ContentID future |
| `royaltyGap.ugcUnmonetisedViews` | `0` | `0` | `YOUTUBE_REVENUE_REQUIRES_VERIFIED_CHANNEL` gate; `ugc` absent |
| `royaltyGap.ugcPotentialRevenue` | `$0` | `$0` | downstream of `ugcUnmonetisedViews` |
| `gapBasedExposure.indicators` — `content-id-gap` | absent | absent | gate never fires; `youtube.ugc` absent |

### Health Score knock-on
Today's production gives Black Alternative the 10-point `youtube_presence` component based on the (incorrectly resolved) Topic channel. Post-merge the Identity Graph routes to the correct official channel which still has the `found: true` state → Black Alternative retains the 10 points, but **for the right reason** (official artist-owned channel verified).

Artists not in the Identity Graph whose YouTube channel title doesn't exactly match their canonical name will lose 10 points post-merge. **Correct behavior** per Constitution — false positives were inflating their scores.

---

## CODE REFERENCE

| Commit | Subject | Files |
|---|---|---|
| [`4ced71f`](https://github.com/Se7venlabs/Royalte/pull/112/commits/4ced71f) | fix(scan): Apple→Spotify ISRC bridge for artist-URL inputs | `api/_lib/run-scan.js`, `api/apple-music.js` |
| [`f14c98f`](https://github.com/Se7venlabs/Royalte/pull/112/commits/f14c98f) | fix(scan): YouTube strict-match-or-null + constitutional verified-channel gate | `api/_lib/run-scan.js` |
| [`1fca82f`](https://github.com/Se7venlabs/Royalte/pull/112/commits/1fca82f) | test(scan): payload convergence test (Governance Directive Rule 3) | `tests/payload-convergence-test.mjs` |
| [`90b5cf3`](https://github.com/Se7venlabs/Royalte/pull/112/commits/90b5cf3) | feat(scan): Royaltē Identity Graph™ — external identity provider | `api/_lib/identity-graph.js`, `api/_lib/run-scan.js` |

### Constitutional artifacts added
- **File-level engineering principle** (Governance Directive Rule 5): top-of-file comment in `run-scan.js`
- **Named-constant verification gate** (Rule 2): `YOUTUBE_REVENUE_REQUIRES_VERIFIED_CHANNEL = true` referenced from `estimateRoyaltyGap` + `computeGapBasedExposure` gate sites
- **Source-of-truth comment block** (Rule 1): YOUTUBE CHANNEL MATCHING above the resolution logic, names Royaltē Identity Graph™ + ContentID API as the architecture
- **Convergence test** (Rule 3): `tests/payload-convergence-test.mjs` — enforces Apple/Spotify URL business-intelligence equivalence
- **Identity Graph module** (Board Directive): `api/_lib/identity-graph.js` — engine reads, never owns artist data

### Pipeline tests
- `tests/pipeline-test.mjs` — **203 positive + 8 negative assertions still passing** locally and on PR CI

---

## CONSTITUTIONAL COMPLIANCE

- ✓ Every number defensible (no speculative metrics) — Constitution principle 5
- ✓ Apple = canonical, Spotify = verification — Canonical Identity Architecture preserved
- ✓ Strict-exact-match-or-null across every cross-platform enrichment — PR #103 discipline preserved
- ✓ `YOUTUBE_REVENUE_REQUIRES_VERIFIED_CHANNEL` constitutional gate enforced at both UGC-derivation sites
- ✓ Engine owns zero artist-specific records — Board Directive 2026-06-09
- ✓ Identity Graph delegation explicit in source-of-truth comment block (Governance Directive Rule 1)
- ✓ Convergence test prevents future divergence regressions (Governance Directive Rule 3)
- ✓ Constitutional Intelligence Map traces every Mission Control field (Governance Directive Rule 4)
- ✓ Engineering principle header at top of engine file (Governance Directive Rule 5)
- ✓ Provenance traceability: `officialChannel.verifiedVia` makes verification path queryable in the payload

---

## POST-MERGE VERIFICATION CHECKLIST

After merging PR #112 and Vercel deploys to `main`:

- [ ] Re-run `CONVERGE_LIVE=1 node tests/payload-convergence-test.mjs` against `https://royalte.ai`
- [ ] Confirm `✓ Payload convergence VERIFIED — 0 divergences`
- [ ] Capture post-fix payloads as fixtures: `api/fixtures/convergence-{apple,spotify}.json`
- [ ] Commit fixtures to `main` (one follow-up commit) so the convergence test runs in CI against fixtures
- [ ] Verify Black Alternative scan: `youtube.officialChannel.channelId === "UCOIO07KGdBFp9Ej40iaZRGQ"` and `verifiedVia === "royalte_identity_graph"`
- [ ] Verify `royaltyGap.ugcUnmonetisedViews === 0` and `ugcPotentialRevenue === 0` on both Apple and Spotify URL inputs

---

## OPEN ITEMS (future briefs)

- **Supabase-backed `verified_artist_identity` table** — replace the file-based seed in `api/_lib/identity-graph.js`. Function signatures (`lookupYouTubeChannelId` etc.) are the stable contract; only the data source changes.
- **ContentID API integration** — defensible UGC metrics for verified channels. Until then `youtube.ugc` is absent and `royaltyGap.ugc*` is 0.
- **Identity Graph expansion** — Bandcamp channels, Patreon links, Instagram handles, official websites. Same module, same lookup pattern.
- **Identity Graph seeding workflow** — founder-curated entries today; needs a workflow for surfacing UNVERIFIED artists to the founder for verification + ratification.
- **Schema field for `verifiedVia`** — `api/schema/auditResponse.js` currently has `youtube` as `type: 'any'`. Tightening to a structured schema with the new `officialChannel.verifiedVia` enum is a follow-up.
