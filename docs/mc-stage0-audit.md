# Mission Control Stage 0 — Architecture Audit

**Generated:** 2026-06-07
**Reference artist:** Black Alternative (Apple ID `505490272` / Spotify ID `1lnM3VZrD6SG9vxBsE9654`)
**Reference payloads:** `/tmp/ba-apple-post108.json` and `/tmp/ba-spotify-post108.json` — byte-equivalent post-PR #108 convergence
**Purpose:** Foundation document for Mission Control V2 design. Maps the full Royaltē Scan Payload against what Mission Control currently surfaces; identifies hidden intelligence and dashboard-only logic. **This audit is the brief for MC V2 Stage 1.**

**Locked architectural premise:** Mission Control is a presentation layer only. It performs zero calculations, zero API calls beyond Supabase loaders, zero logic. It renders the Royaltē Scan Payload.

---

## Phase 1 — Scan Payload Audit

The scan engine has two payload shapes:

1. **Raw API response** — what `/api/audit` returns to the browser at scan time. Cached in `/tmp/ba-*.json`.
2. **Canonical normalized payload** — what `normalizeAuditResponse(raw)` transforms it into, then persists into `audit_scans.payload` and (for authenticated callers) `scan_snapshots.payload`. **Mission Control reads the canonical form.**

The two shapes differ in key ways (most importantly: raw `platforms.<name>` is a boolean; canonical `platforms.<name>` is `{availability, details}`). Both are documented below.

### 1A. Raw API response — every field in `/tmp/ba-apple-post108.json`

Produced by `api/_lib/run-scan.js → runScan()`.

| Field path | Value for BA | Type | Engine source |
|---|---|---|---|
| `payload.success` | `true` | bool | runScan return |
| `payload.platform` | `"apple"` | str | runScan rawResponse builder (line 327, inputType-derived) |
| `payload.type` | `"artist"` | str | runScan rawResponse builder (hardcoded) |
| `payload.artistName` | `"Black Alternative"` | str | `resolved.artistName` from `resolveAppleArtist()` |
| `payload.artistId` | `"1lnM3VZrD6SG9vxBsE9654"` | str | `discoverSpotifyByIsrc()` after ISRC bridge + name verification |
| `payload.followers` | `-1` | int | `artistData.followers.total` (Spotify dev-mode returns -1) |
| `payload.popularity` | `0` | int | `artistData.popularity` (Spotify dev-mode returns 0) |
| `payload.genres` | `[]` | str[] | `artistData.genres` from Spotify artist record |
| `payload.trackTitle` | `"Everything Is Over"` | str | `resolved.trackTitle` from Apple song endpoint |
| `payload.trackIsrc` | `"QT6622698063"` | str | `resolved.trackIsrc` from Apple song endpoint |
| `payload.resolvedFrom` | `"apple"` | str | resolveToArtist Apple branch |
| `payload.resolvedFromType` | `"external"` | str | resolveToArtist Apple branch |
| `payload.resolvedFromTitle` | `"Black Alternative"` | str | Apple's artist name |
| `payload.canonicalTarget` | `"artist"` | str | resolveToArtist (always 'artist' post-resolution) |
| `payload.spotifyMatched` | `true` | bool | `!!resolved.artistId` after PR #108 |
| `payload.artistUrl` | `"https://open.spotify.com/artist/1lnM3VZrD6SG9vxBsE9654"` | str | Spotify artist external_urls.spotify |
| `payload.imageUrl` | Apple artwork URL | str | resolved.appleArtworkUrl preferred (PR #103) |
| `payload.artistImageUrl` | Apple artwork URL | str | same |
| `payload.albumImageUrl` | `null` | str/null | trackData.album.images[0].url (null when not a track scan) |
| `payload.appleArtworkUrl` | Apple artwork URL | str | resolved.appleArtworkUrl |
| `payload.platforms.spotify` | `true` | bool | `!!spotifyArtistId` |
| `payload.platforms.musicbrainz` | `true` | bool | `!!mbData.found` (getMusicBrainz fan-out) |
| `payload.platforms.deezer` | `true` | bool | `!!deezerData.found` (getDeezer fan-out) |
| `payload.platforms.audiodb` | `false` | bool | `!!audioDbData.found` |
| `payload.platforms.discogs` | `false` | bool | `!!discogsData.found` |
| `payload.platforms.soundcloud` | `false` | bool | `!!soundcloudData.found` |
| `payload.platforms.lastfm` | `true` | bool | `!!lastfmData.found` |
| `payload.platforms.wikipedia` | `false` | bool | `!!wikidataData.found` |
| `payload.platforms.youtube` | `true` | bool | `!!youtubeData.found` |
| `payload.platforms.appleMusic` | `true` | bool | `!!appleMusicData.found` |
| `payload.catalog.totalReleases` | `4` | int | `analyzeCatalog(albumsData)` from Spotify albums OR `_analyzeAppleCatalog()` fallback |
| `payload.catalog.totalTracks` | `4` | int | same |
| `payload.catalog.earliestYear` | `2013` | int | same |
| `payload.catalog.latestYear` | `2026` | int | same |
| `payload.catalog.catalogAgeYears` | `13` | int | same |
| `payload.catalog.estimatedAnnualStreams` | `12` | int | overwritten from `royaltyGap.estAnnualStreams` |
| `payload.catalog.recentActivity` | `true` | bool | derived from latestYear ≥ currentYear-2 |
| `payload.royaltyGap.estAnnualStreams` | `12` | int | `estimateRoyaltyGap()` from Last.fm playcount × multiplier |
| `payload.royaltyGap.estLifetimeStreams` | `160` | int | `estAnnualStreams × catalogYears` |
| `payload.royaltyGap.estSpotifyRoyalties` | `0` | int | `estAnnualStreams × PER_STREAM_RATE` |
| `payload.royaltyGap.estPROEarnings` | `0` | int | small fraction of streaming royalties |
| `payload.royaltyGap.estTotalRoyalties` | `0` | int | sum of above |
| `payload.royaltyGap.potentialGapLow` | `0` | int | `total × LOW_GAP_RATIO` |
| `payload.royaltyGap.potentialGapHigh` | `0` | int | `total × HIGH_GAP_RATIO` |
| `payload.royaltyGap.catalogYears` | `13` | int | mirror of catalog.catalogAgeYears |
| `payload.royaltyGap.ugcUnmonetisedViews` | `18568815` | int | `youtube.ugc.estimatedViews` |
| `payload.royaltyGap.ugcPotentialRevenue` | `27853` | int | derived from ugc views × rate |
| `payload.royaltyGap.disclaimer` | `"Estimates only..."` | str | hardcoded in estimateRoyaltyGap |
| `payload.gapBasedExposure.indicators` | list[2] | obj[] | `computeGapBasedExposure()` |
| `payload.gapBasedExposure.indicators[0].id` | `"catalog-age"` | str | indicator emitter |
| `payload.gapBasedExposure.indicators[0].severity` | `"MED"` | str | indicator emitter |
| `payload.gapBasedExposure.indicators[0].title` | `"Extended royalty verification recommended"` | str | indicator emitter |
| `payload.gapBasedExposure.indicators[0].description` | `"Catalog active for 13 years across 4 releases."` | str | indicator emitter |
| `payload.gapBasedExposure.indicators[0].exposureLow` | `156` | int | per-indicator low estimate |
| `payload.gapBasedExposure.indicators[0].exposureHigh` | `936` | int | per-indicator high estimate |
| `payload.gapBasedExposure.indicators[0].methodology` | `"Unaudited-activity accrual × ..."` | str | indicator emitter |
| `payload.gapBasedExposure.aggregateLow` | `156` | int | sum of indicators' lows |
| `payload.gapBasedExposure.aggregateHigh` | `936` | int | sum of indicators' highs |
| `payload.gapBasedExposure.pendingValidationCount` | `1` | int | count of indicators awaiting verification |
| `payload.gapBasedExposure.hasAnyGaps` | `true` | bool | `indicators.length > 0` |
| `payload.proGuide.pro` | `"Your local PRO"` | str | `getPROGuide(country)` — country null → default |
| `payload.proGuide.url` | `"https://www.cisac.org"` | str | same |
| `payload.proGuide.steps` | str[4] | str[] | same |
| `payload.proGuide.note` | `"CISAC is..."` | str | same |
| `payload.country` | `null` | str/null | `audioDbData.country \|\| wikidataData.country \|\| null` |
| `payload.lastfmPlays` | `16` | int | `lastfmData.playcount` |
| `payload.lastfmListeners` | `15` | int | `lastfmData.listeners` |
| `payload.wikipediaUrl` | `null` | str/null | `wikidataData.wikipediaUrl` |
| `payload.deezerFans` | `13` | int | `deezerData.fans` |
| `payload.discogsReleases` | `0` | int | `discogsData.releases` |
| `payload.youtube.found` | `true` | bool | `getYouTube()` result |
| `payload.youtube.officialChannel.title` | `"Black Alternative - Topic"` | str | YouTube channel.snippet.title |
| `payload.youtube.officialChannel.channelId` | `"UCOD08w7bwiOlcW3DZEhLKdA"` | str | YouTube channel.id |
| `payload.youtube.officialChannel.subscribers` | `4` | int | YouTube channel.statistics.subscriberCount |
| `payload.youtube.officialChannel.totalViews` | `16` | int | YouTube channel.statistics.viewCount |
| `payload.youtube.officialChannel.videoCount` | `4` | int | YouTube channel.statistics.videoCount |
| `payload.youtube.ugc.videoCount` | `10` | int | YouTube search?type=video count |
| `payload.youtube.ugc.estimatedViews` | `18568815` | int | sum of UGC view counts |
| `payload.youtube.ugc.topVideos` | list[3] | obj[] | top UGC videos by views |
| `payload.youtube.ugc.topVideos[0].title` | (UGC video title) | str | YouTube video.snippet.title |
| `payload.youtube.ugc.topVideos[0].channel` | `"Cocoa De Vampyr"` | str | YouTube video.snippet.channelTitle |
| `payload.youtube.ugc.topVideos[0].videoId` | `"zLDOnck-JM0"` | str | YouTube video.id |
| `payload.youtube.ugc.contentIdRisk` | `false` | bool | derived: official channel exists |
| `payload.youtube.contentIdVerified` | `true` | bool | derived: officialChannel.title is "X - Topic" |
| `payload.youtube.subscriberCount` | `4` | int | mirror of officialChannel.subscribers |
| `payload.youtube.totalOfficialViews` | `16` | int | mirror of officialChannel.totalViews |
| `payload.appleMusic.found` | `true` | bool | `getAppleMusic()` matched (ID-direct via options.appleArtistId) |
| `payload.appleMusic.artistId` | `"505490272"` | str | Apple artist ID |
| `payload.appleMusic.artistUrl` | Apple artist URL | str | from artist record fetch |
| `payload.appleMusic.genres` | `["Soundtrack"]` | str[] | from artist record fetch |
| `payload.appleMusic.albumCount` | `4` | int | `appleAlbums.length` |
| `payload.appleMusic.albums` | list[4] | obj[] | `getArtistAlbums(appleArtistId, storefront)` |
| `payload.appleMusic.albums[0].id` | `"1889785995"` | str | Apple album id |
| `payload.appleMusic.albums[0].name` | `"Everything Is Over - Single"` | str | Apple album name |
| `payload.appleMusic.albums[0].releaseDate` | `"2026-05-15"` | str | Apple album releaseDate |
| `payload.appleMusic.albums[0].trackCount` | `1` | int | Apple album trackCount |
| `payload.appleMusic.albums[0].url` | Apple album URL | str | Apple album url |
| `payload.appleMusic.albums[0].artwork` | Apple artwork URL (300×300) | str | template-substituted artwork URL |
| `payload.appleMusic.storefrontAvailability.{us,ca,gb,de,fr,jp,au,br}.available` | str[4] (album IDs) | str[] | `checkStorefrontAvailability(albumIds, headers)` per region |
| `payload.appleMusic.storefrontAvailability.{...}.unavailable` | `[]` | str[] | same |
| `payload.appleMusic.isrcLookup.found` | `true` | bool | `lookupByISRC(appleIsrc)` (only present for track scans) |
| `payload.appleMusic.isrcLookup.isrc` | `"QT6622698063"` | str | same |
| `payload.appleMusic.isrcLookup.id` | `"1889786000"` | str | Apple song ID |
| `payload.appleMusic.isrcLookup.name` | `"Everything Is Over"` | str | Apple song name |
| `payload.appleMusic.isrcLookup.artistName` | `"Black Alternative"` | str | Apple song artistName |
| `payload.appleMusic.isrcLookup.albumName` | `"Everything Is Over - Single"` | str | Apple song collectionName |
| `payload.appleMusic.isrcLookup.releaseDate` | `"2026-05-15"` | str | Apple song releaseDate |
| `payload.appleMusic.isrcLookup.durationMs` | `225912` | int | Apple song durationInMillis |
| `payload.appleMusic.isrcLookup.url` | Apple song URL | str | Apple song url |
| `payload.appleMusic.isrcLookup.previewUrl` | Apple preview URL | str | Apple song previews[0].url |
| `payload.appleMusic.isrcLookup.artwork` | Apple artwork URL | str | Apple song artwork |
| `payload.appleMusic.isrcLookup.genreNames` | `["Alternative","Music","R&B/Soul"]` | str[] | Apple song genreNames |
| `payload.appleMusic.isrcLookup.composerName` | `"Daryl West & Charles Richard Husbands"` | str | Apple song composerName |
| `payload.appleMusic.catalogComparison` | `null` | obj/null | `compareSpotifyToApple(spotifyTopTracks)` — null when no top tracks |
| `payload.overallScore` | `74` | int | mean of module scores (excluding AUTH_UNAVAILABLE) |
| `payload.modules.metadata.name` | `"Metadata Integrity"` | str | `runModules()` |
| `payload.modules.metadata.score` | `100` | int | per-module scoring |
| `payload.modules.metadata.flags` | `[]` | str[] | per-module flags |
| `payload.modules.coverage.{name,score,flags}` | `"Platform Coverage"` / `69` / 4 flags | mixed | per-module |
| `payload.modules.publishing.{name,score,flags}` | `"Publishing Risk"` / `90` / 1 flag | mixed | per-module |
| `payload.modules.duplicates.{name,score,flags}` | `"Duplicate Detection"` / `80` / 0 flags | mixed | per-module |
| `payload.modules.youtube.{name,score,flags}` | `"YouTube / UGC"` / `60` / 0 flags | mixed | per-module |
| `payload.modules.sync.{name,score,flags}` | `"Sync Readiness"` / `43` / 1 flag | mixed | per-module |
| `payload.flags` | list[7] | obj[] | `buildFlags()` aggregating module flags + extras |
| `payload.flags[0].module` | `"Publishing Risk"` | str | source module name |
| `payload.flags[0].severity` | `"high"` | str | severity (high/medium/low) |
| `payload.flags[0].description` | (text) | str | the flag description |
| `payload.flagCount` | `7` | int | `flags.length` |
| `payload.previewFlags` | `flags.slice(0,2)` | obj[] | first 2 flags |
| `payload.scannedAt` | `"2026-06-07T14:34:15.558Z"` | str | scan timestamp |
| `payload.scanId` | (UUID) | str | scan UUID |

### 1B. Canonical normalized payload — what MC actually reads

`normalizeAuditResponse(raw)` transforms the raw shape above into a canonical contract. The canonical form is what `audit_scans.payload` and `scan_snapshots.payload` store, and what Mission Control's loaders return.

**Key transformations:**

| Raw field | Canonical field | Transformation |
|---|---|---|
| `r.platforms.<name>` (boolean) | `payload.platforms.<name>` (object `{availability, details}`) | Booleans become `{availability: 'VERIFIED' \| 'NOT_FOUND'}`. Apple Music gets `details` with albums/storefrontAvailability/isrcLookup. YouTube gets `details` with officialChannel/ugc/subscriberCount. Other sources get `details: null`. |
| `r.artistId`, `r.artistName`, `r.trackTitle`, `r.trackIsrc` | `payload.subject.{artistId, artistName, trackTitle, trackIsrc, trackIsrcSource, albumName}` | Grouped under `subject`. `subject.artistId` prefers Spotify ID then falls back to Apple ID. |
| `r.followers`, `r.popularity`, `r.genres`, `r.lastfmPlays`, `r.lastfmListeners`, `r.deezerFans`, `r.tidalPopularity`, `r.discogsReleases`, `r.country`, `r.wikipediaUrl` | `payload.metrics.<same>` | Grouped under `metrics`. |
| `r.catalog.<fields>` | `payload.catalog.<same fields>` | Pass-through except `totalTracks` is NOT in canonical catalog (it's a runScan-only field). |
| `r.modules.<key>` (raw shape `{name, score, flags}`) | `payload.modules.<key>` (canonical shape `{key, name, score, grade, availability, issueCount, flags}`) | Adds `key`, `grade` (A-F), `availability` (AUTH_UNAVAILABLE if module absent), `issueCount`. |
| `r.overallScore` | `payload.score.{overall, riskLevel, riskSummary, moduleAverage, ownershipImpact}` | Becomes an object with risk level (LOW/MODERATE/HIGH/CRITICAL) and risk summary text. |
| `r.flags` (raw `{module, severity, description}`) | `payload.issues[]` (canonical `{id, module, moduleName, severity, title, detail, source}`) | Adds id (sha1 hash), separates moduleKey from moduleName, normalizes severity to CRITICAL/HIGH/WARNING/INFO, derives title from description. |
| `r.royaltyGap.*` | `payload.royaltyGap.*` | Pass-through with numeric coercion. |
| `r.gapBasedExposure.*` | `payload.gapBasedExposure.*` | Pass-through. |
| `r.proGuide.*` | `payload.proGuide.*` | Pass-through. |
| `r.auditCoverage.*` | `payload.auditCoverage.{spotify, appleMusic, publishing, soundExchange}.{status, tier}` | Normalized coverage status per source (NOT_CONFIRMED / VERIFIED / etc.). |
| `r.ownershipVerification.*` | `payload.ownership.{status, confidence, scoreImpact, render}` | Ownership verification meta. |
| — | `payload.schemaVersion`, `payload.scanId`, `payload.scannedAt`, `payload.source.{platform, urlType, resolvedFrom, originalUrl, storefront}`, `payload.auditCoverageRaw` (deprecated mirror), `payload.territoryCoverage` (null), `payload.isrcValidation` (null) | Added by normalize, no raw counterpart. |

**The shape difference matters:** raw `payload.platforms.spotify === true` becomes canonical `payload.platforms.spotify.availability === 'VERIFIED'`. Mission Control reads the canonical form (`p.spotify?.availability === 'VERIFIED'` in `_confidenceLabelForScan`, etc.) — so every field-binding table in Phase 2 references canonical paths.

---

## Phase 2 — Mission Control Display Audit

Mission Control consists of:
- **Topbar** (artist name + status strip + stats + last scan)
- **Sidebar** (logo, nav, founding-artist banner, footer)
- **12-card grid** (numbered 1–9 in source; only 9 distinct cards render today)
- **Below-grid sections** (pricing, founding-artist reservation, trial banner)

Total `id="mc-*" / "tb-*" / "sb-*"` elements in `dashboard.html`: **59**.

### Card 0a — Topbar artist name

| Element ID | What displays | Value for BA | Reads from | Correct? |
|---|---|---|---|---|
| `tb-artist-name` | Uppercase artist name | "BLACK ALTERNATIVE" | `scan.artist_name \|\| scan.payload.subject.artistName` | ✓ |

Renderer: `renderMcArtistName(artistName)` at `dashboard.js:624`.

### Card 0b — Topbar status strip

| Element ID | What displays | Value for BA | Reads from | Correct? |
|---|---|---|---|---|
| `tb-status-dot` | Color dot (red/amber/green) | green | derived: `criticalCount > 0 ? red : opportunitiesCount > 0 ? amber : green` | ✓ |
| `tb-status-label` | ACTION REQUIRED / ATTENTION NEEDED / ALL SYSTEMS NORMAL | "ALL SYSTEMS NORMAL" | same derivation | ✓ |
| `tb-stat-health` | Health Score number | "74" | `_resolveHealthScoreFromSnapshot(scan)` — V2 `health_score` or V1 fallback | ✓ |
| `tb-stat-monitoring` | Active / Paused | "Active" | `monitoringActive` from `loadMonitoringActive(userId, artistId)` | ✓ post-PR #106 (artist-scoped) |
| `tb-stat-changes` | Total alerts count | "0" | `alertOverview.total` from `loadAlertOverview(userId, artistId)` | ✓ |
| `tb-stat-confidence` | High / Moderate / Limited | "High" (6 verified) | `_confidenceLabelForScan(scan)` — counts VERIFIED across 6 sources | ✓ |
| `tb-stat-revenue` | Opportunities count | "0" | `opportunitiesCount` from `_countMonitorAlerts(userId, artistId)` | ✓ |
| `tb-last-scan` | Relative time | "Just now" | `relativeTimePast(scanDate)` from `scan.scanned_at \|\| scan.created_at` | ✓ |

Renderer: `renderMcStatusBar({healthScore, monitoringActive, criticalCount, opportunitiesCount, totalChanges, confidenceLabel, scanDate})` at `dashboard.js:633`.

### Card 0c — Sidebar

| Element ID | What displays | Value for BA | Reads from | Correct? |
|---|---|---|---|---|
| `sb-nav` | Nav items (Mission Control, Reviews, Catalog, Action Center, Monitoring, Settings) | static + active class | hardcoded HTML | ✓ |
| `sb-fa` | Founding Artist banner (if applicable) | shown if `profile.founding_artist === true` | `profile.founding_artist`, `profile.created_at` | ✓ |
| `sb-fa-num` | Founding artist number | per profile | `profile.founding_artist_number` | ✓ |
| `sb-fa-since` | "Founding Artist since {date}" | per profile | `profile.created_at` formatted | ✓ |
| `sb-version` | "MC v1.0.5" | "MC v1.0.5" | hardcoded `MC_VERSION` constant | ✓ |

Renderer: `renderMcSidebar(profile)` at `dashboard.js:679`.

### Card 1 — Royaltē Health Score (Signal Meter)

| Element ID | What displays | Value for BA | Reads from | Correct? |
|---|---|---|---|---|
| `mc-score-num` | Score number | "74" | `_resolveHealthScoreFromSnapshot(scan)` (V2: `health_score`; V1 fallback: `100 - payload.overallScore`; degraded: null) | ✓ |
| `mc-score-circle` | Band CSS class on orb | `.band-moderate` (74 → 60–74) | `_healthBand(score)` | ✓ |
| `mc-score-band` | Band label | "Moderate" | same | ✓ |
| `mc-score-desc` | Description copy | "Your music business backend health, computed from verified sources." OR degraded variant | static or `_isDegradedScan(scan)` branch | ✓ |
| `mc-score-delta` | Δ since baseline | "Baseline established" (no history yet) | `current - history[0].health_score` | ✓ |
| `mc-signal-needle` (SVG) | Sweeps to score angle | rotated to 74° equivalent | `initSignalMeter(currentScore)` | ✓ |
| `mc-signal-pulse` (SVG) | Infusion animation | fires once on first paint | `triggerSignalInfusion()` | ✓ (visual only) |
| `mc-signal-{face, brass, sheen, panel, needle-shadow, pivot-grad}` | Static SVG chrome | n/a | hardcoded | ✓ |

Renderer: `renderMcHealth(scan, history)` at `dashboard.js:699`.

### Card 2 — Backend Status

| Element ID | What displays | Value for BA | Reads from | Correct? |
|---|---|---|---|---|
| `mc-status-list` | 3 tiles: Monitoring Active / No Critical Issues / All Clear | all green | derived: `monitoringActive`, `criticalCount`, `opportunitiesCount` | ✓ |

Renderer: `renderMcBackendStatus({monitoringActive, criticalCount, opportunitiesCount})` at `dashboard.js:789`. **The tile content is generated entirely from 3 derived booleans/numbers — not from the scan payload.**

### Card 3 — Intelligence Feed

| Element ID | What displays | Value for BA | Reads from | Correct? |
|---|---|---|---|---|
| `mc-feed-list` | Up to 5 alert items with artwork + track + event + meta | empty (no baseline_established / release_added alerts for this Apple-only artist's keyed subscription yet) | `loadAlertFeed(userId, artistId)` filtered by `_filterBaselineArtifacts()`, matched against `scan.payload.platforms.appleMusic.details.albums` for artwork via `_matchAlbumArtwork()` | ✓ — empty state correctly shown; copy updated by PR #106 |

Renderer: `renderMcFeed(alertsRaw, baselineTimes, albums, currentArtistId, scan)` at `dashboard.js:842`. **Reads from `monitoring_alerts` table (not from payload directly), albums from payload, scan for degraded copy.**

### Card 4 — Catalog Intelligence

| Element ID | What displays | Value for BA | Reads from | Correct? |
|---|---|---|---|---|
| `mc-cat-tracks` | Tracks count | "4" | `payload.platforms.appleMusic.details.albums.reduce(+trackCount)` | ✓ |
| `mc-cat-releases` | Releases count | "4" | `albums.length \|\| albumCount` | ✓ |
| `mc-cat-isrc` | "Verified" / "Pending verification" / "Unavailable" | "Verified" (isrcLookup populated for track scans) | `payload.platforms.appleMusic.details.isrcLookup?.isrc` | ✓ |
| `mc-cat-sources` | "N / 6" | "6 / 6" (BA has 6 verified) | count VERIFIED across {appleMusic, spotify, youtube, musicbrainz, discogs, lastfm} | ✓ |
| `mc-cat-last` | Last change relative time | "No changes detected yet" | `_lastGenuineChangeAt(feedAlerts, baselineTimes)` | ✓ |

Renderer: `renderMcCatalogIntelligence(scan, feedAlerts, baselineTimes)` at `dashboard.js:896`.

### Card 5 — Action Center

| Element ID | What displays | Value for BA | Reads from | Correct? |
|---|---|---|---|---|
| `mc-action-count` | Count of items needing attention | hidden when 0 | `criticalCount + opportunitiesCount` | ✓ |
| `mc-action-list` | Top 3 action items OR "ALL SYSTEMS NORMAL" banner | banner | `loadActionItems(userId, artistId, 3)` from `monitoring_alerts WHERE severity IN ('action_needed','monitor')` | ✓ |

Renderer: `renderMcActionCenter({items, totalCount})` at `dashboard.js:942`.

### Card 6 — Intelligence Confidence

| Element ID | What displays | Value for BA | Reads from | Correct? |
|---|---|---|---|---|
| `mc-donut` | Conic-gradient ring filled to (verified/6 × 100)% | filled to 100% (6/6 verified) | `_confidenceLabelForScan(scan).count / .total × 100` | ✓ |
| `mc-donut-label` | "High" / "Moderate" / "Limited" | "High" | `_confidenceLabelForScan(scan).label` | ✓ |
| `mc-intel-streaming` | Verified / Pending / Unavailable | Verified | `appleMusic OR spotify === VERIFIED` | ✓ |
| `mc-intel-metadata` | same | Verified (both Apple AND Spotify VERIFIED) | `appleMusic AND spotify === VERIFIED` | ✓ |
| `mc-intel-identity` | same | Verified (musicbrainz VERIFIED) | `musicbrainz === VERIFIED` | ✓ |
| `mc-intel-authority` | same | Verified (lastfm VERIFIED) | `discogs OR lastfm === VERIFIED` | ✓ |
| `mc-intel-podcast` | Active / Monitoring Plan Required | "Active" (founding_artist) | `profile.founding_artist OR profile.tier === 'paid'` | ✓ |
| `mc-intel-catalog` | Active / Unavailable / Pending | derived from `monitoringActive` after PR #106 | `monitoringActive` (passed in) | ✓ |

Renderer: `renderMcIntelligenceConfidence(scan, profile, monitoringActive)` at `dashboard.js:994`.

### Card 7 — Global Presence

| Element ID | What displays | Value for BA | Reads from | Correct? |
|---|---|---|---|---|
| `mc-flag-grid` | 8 country flags with availability state class | 8/8 verified | iterates BIG6 (8 entries actually: us/ca/gb/de/fr/jp/au/br); reads `payload.platforms.appleMusic.details.storefrontAvailability[code]` per region | ✓ |
| `mc-presence-num` | Verified region count | "8" | `verifiedN` | ✓ |
| `mc-presence-total` | Total regions | "8" | `BIG6.length` | ✓ |

Renderer: `renderMcGlobalPresence(scan)` at `dashboard.js:1069`.

### Card 8 — Monitoring Overview

| Element ID | What displays | Value for BA | Reads from | Correct? |
|---|---|---|---|---|
| `mc-ovr-days` | Days Protected | derived | `(now - history[0].scanned_at) / 86400000 + 1` from `loadScanHistory(userId, artistId)`; "—" when degraded AND 0 | ✓ post-PR #106 |
| `mc-ovr-changes` | Total Changes | derived | `alertOverview.total`; "—" when degraded AND 0 | ✓ |
| `mc-ovr-resolved` | Actions Required | derived | `criticalCount`; "—" when degraded AND 0 | ✓ |

Renderer: `renderMcMonitoringOverview({history, alertOverview, criticalCount, scan})` at `dashboard.js:1102`.

### Card 9 — Your Royaltē Review

| Element ID | What displays | Value for BA | Reads from | Correct? |
|---|---|---|---|---|
| `mc-review-num` | Baseline health_score OR current | depends on history | `baseline.health_score \|\| currentScan.health_score` | ✓ |
| `mc-review-date` | "Generated {date}" or "No baseline yet" | per state | `baseline.scanned_at` | ✓ |
| `mc-review-confidence` | "Review Confidence: {label}" | per scan | `_confidenceLabelForScan(baseline \|\| scan)` | ✓ |
| `mc-review-pdf` | PDF download button (enabled/disabled) | enabled if PDF exists for artist | `loadBaselinePdf(userId, scan)` — user + artist scoped after PR #106 | ✓ |
| `mc-review-view` | "View Review →" link target | `#reviews` (anchor, no destination today) | hardcoded href | partial — page exists as PR #100 (held) |

Renderer: `renderMcYourReview({baseline, currentScan, pdfUrl, confidenceLabel})` at `dashboard.js:1131`.

---

## Phase 3 — Gap Analysis

### LIST A — Fields in the scan payload but NOT displayed in Mission Control

**Significant hidden intelligence — high-value candidates for MC V2 surfacing:**

| Field path (canonical) | Value for BA | Why it matters |
|---|---|---|
| `payload.subject.trackTitle` | "Everything Is Over" | The track URL the artist scanned with. Could anchor the Review card / catalog detail. |
| `payload.subject.trackIsrc` | "QT6622698063" | Per-track ISRC verification — currently only used as a boolean ("Verified"/"Pending") on Card 4. |
| `payload.subject.albumName` | "Everything Is Over - Single" | Album the scanned track lives on. |
| `payload.appleMusic.details.albums[].id, name, releaseDate, trackCount, url, artwork` | 4 entries × 6 fields each | **Full per-release detail** — release artwork URLs, release dates, track counts. Currently only `albums.length` and `sum(trackCount)` are surfaced. **No per-release surface exists in MC.** |
| `payload.appleMusic.details.albums[].artwork` | 4 × 300×300 Apple CDN URLs | Real release artwork — currently only used inside `_matchAlbumArtwork` to decorate Feed items, never surfaced as a catalog gallery. |
| `payload.appleMusic.details.storefrontAvailability.{region}.available[]` | 4 album IDs per region × 8 regions | **Per-album per-region availability** — the data exists for granular per-release territory mapping; only an 8/8 count is shown. |
| `payload.appleMusic.details.isrcLookup.{id, name, artistName, albumName, releaseDate, durationMs, url, previewUrl, artwork, genreNames, composerName}` | 11 fields for the scanned track | **Composer name, preview URL, genre, duration, release date** — none surface in MC. Composer is direct publishing intel. |
| `payload.appleMusic.details.catalogComparison` | null for BA (would be `{matched, notFound, matchRate, tracksChecked}` for track scans) | Spotify-vs-Apple track parity — never surfaced. |
| `payload.platforms.youtube.details.officialChannel.{title, channelId, subscribers, totalViews, videoCount}` | "Black Alternative - Topic" / channelId / 4 / 16 / 4 | YouTube official channel detail — currently only used by `runModules`; never displayed in MC. |
| `payload.platforms.youtube.details.ugc.{videoCount, estimatedViews, topVideos[], contentIdRisk}` | 10 / 18.5M / 3 videos / false | **UGC presence + top videos + estimated unmonetised reach** — completely hidden from MC. |
| `payload.platforms.youtube.details.contentIdVerified` | true | Content ID coverage signal — hidden. |
| `payload.metrics.followers` | -1 | Spotify followers (sentinel = absent). MC shows Health Score but not raw audience metric. |
| `payload.metrics.popularity` | 0 | Spotify popularity (0-100). Hidden. |
| `payload.metrics.genres` | [] | Top-level genre tags. Hidden. (Apple genres separately at `appleMusic.details.genres`.) |
| `payload.metrics.lastfmPlays` | 16 | Last.fm playcount. Hidden in MC; used by score engine only. |
| `payload.metrics.lastfmListeners` | 15 | Last.fm listeners. Hidden. |
| `payload.metrics.deezerFans` | 13 | Deezer fans. Hidden. |
| `payload.metrics.tidalPopularity` | 0 | Tidal popularity. Hidden. |
| `payload.metrics.discogsReleases` | 0 | Discogs release count. Hidden. |
| `payload.metrics.country` | null | Country of origin. Hidden. |
| `payload.metrics.wikipediaUrl` | null | Wikipedia URL. Hidden. |
| `payload.catalog.earliestYear` / `latestYear` / `catalogAgeYears` | 2013 / 2026 / 13 | Catalog timeline. Hidden in MC (PDF shows this; in-app doesn't). |
| `payload.catalog.estimatedAnnualStreams` | 12 | Stream estimate — hidden. |
| `payload.catalog.recentActivity` | true | Recent-release boolean — hidden. |
| `payload.modules.metadata.{name, score, grade, flags}` | "Metadata Integrity" 100 / A / 0 flags | **Per-module scores and grades** — hidden. Only the average (overallScore) surfaces. |
| `payload.modules.coverage.{...}` | "Platform Coverage" 69 / D / 4 flags | hidden |
| `payload.modules.publishing.{...}` | "Publishing Risk" 90 / A / 1 flag | hidden |
| `payload.modules.duplicates.{...}` | "Duplicate Detection" 80 / B / 0 flags | hidden |
| `payload.modules.youtube.{...}` | "YouTube / UGC" 60 / D / 0 flags | hidden |
| `payload.modules.sync.{...}` | "Sync Readiness" 43 / F / 1 flag | hidden |
| `payload.issues[]` (7 entries) | each with `{id, module, moduleName, severity (CRITICAL/HIGH/WARNING/INFO), title, detail, source}` | **The full canonical issues list** — MC's Action Center reads from `monitoring_alerts` instead. The scan payload's `issues[]` array is completely unused by MC. |
| `payload.score.{overall, riskLevel, riskSummary, moduleAverage, ownershipImpact}` | 74 / MODERATE / "Moderate risk — some gaps detected. Top concerns: …" | **Risk level + risk summary text** — hidden. MC only uses `score.overall`. |
| `payload.royaltyGap.{estAnnualStreams, estLifetimeStreams, estSpotifyRoyalties, estPROEarnings, estTotalRoyalties, potentialGapLow, potentialGapHigh, catalogYears, ugcUnmonetisedViews, ugcPotentialRevenue, disclaimer}` | 12/160/0/0/0/0/0/13/18.5M/27853 | **Entire royalty-gap section** — hidden. PDF surfaces this; MC doesn't. |
| `payload.gapBasedExposure.{indicators[], aggregateLow, aggregateHigh, pendingValidationCount, hasAnyGaps}` | 2 indicators / 156-936 / 1 / true | **Per-indicator exposure with low/high range + methodology strings** — hidden. |
| `payload.gapBasedExposure.indicators[].{id, severity, title, description, exposureLow, exposureHigh, methodology}` | structured indicator detail | hidden |
| `payload.proGuide.{pro, url, steps, note, country}` | "Your local PRO" / cisac.org / 4 steps / note / null | PRO guidance — hidden in MC. |
| `payload.auditCoverage.{spotify, appleMusic, publishing, soundExchange}.{status, tier}` | per-source coverage status | hidden |
| `payload.ownership.{status, confidence, scoreImpact, render}` | unverified / LOW / 0 / null | Artist-identity confidence — hidden. |
| `payload.source.{platform, urlType, resolvedFrom, originalUrl, storefront}` | apple_music / artist / apple / "" / null | Scan provenance — hidden. |

### LIST B — Things Mission Control displays that do NOT come from the scan payload

These come from other Supabase tables, derivations, hardcoded values, or computed at render time. Each is a place where Mission Control is doing work that should arguably move into the canonical payload, OR remain as separate-table concerns.

**From `monitoring_alerts` table** (not the scan payload):
- Card 3 Intelligence Feed items — loaded via `loadAlertFeed(userId, artistId)`
- Card 5 Action Center items — `loadActionItems(userId, artistId, 3)`
- Card 8 `mc-ovr-changes` (Total Changes) — `loadAlertOverview(userId, artistId).total`
- Card 8 `mc-ovr-resolved` (Actions Required) — `_countActionNeededAlerts(userId, artistId)`
- Topbar `tb-stat-changes` — same as above
- Topbar `tb-stat-revenue` (Opportunity Signals) — `_countMonitorAlerts(userId, artistId)`
- Card 2 critical/opportunities tile derivations — same counters
- Topbar status dot/label derivation — composed from critical/opportunities counts
- Card 4 `mc-cat-last` (Last Change Detected) — `_lastGenuineChangeAt(feedAlerts, baselineTimes)` filters feed against `_loadBaselineTimes` query

**From `monitoring_subscriptions` table**:
- Topbar `tb-stat-monitoring` (Active/Paused) — `loadMonitoringActive(userId, artistId)`
- Card 2 Monitoring Active tile — same
- Card 6 `mc-intel-catalog` (Catalog Monitoring active state) — same (post-PR #106)

**From `scan_snapshots` table** (history):
- Card 1 `mc-score-delta` — uses `history[0].health_score` from `loadScanHistory(userId, artistId)`
- Card 8 `mc-ovr-days` (Days Protected) — uses `history[0].scanned_at`
- Card 9 baseline rendering — uses `history[0]` if present

**From `profiles` table**:
- Sidebar Founding Artist banner — `profile.founding_artist`, `profile.founding_artist_number`, `profile.created_at`
- Card 6 `mc-intel-podcast` — `profile.founding_artist === true \|\| profile.tier === 'paid'`
- Below-grid Pricing visibility — `profile.tier`
- Trial banner — `profile.trial_started_at`, `profile.next_rescan_at`, `profile.monitoring_status`

**From `audit_scans` table**:
- Card 9 PDF button URL — `loadBaselinePdf(userId, scan)` scoped by `spotify_artist_id` or `apple_artist_id` (post-PR #106)

**Hardcoded constants in dashboard.js**:
- `BIG6` array (8 region entries with code/name/flag emoji) — feeds Card 7's iteration. The scan payload's `storefrontAvailability` keys ARE these 8 codes; the country names/emoji are MC-side only.
- `FEED_META` map — change_type → tag/color/event label mapping
- `PLATFORM_DISPLAY` map — short platform-name → human label
- `TERRITORY_NAMES` map — country code → readable name (used by `_territoryDisplay`)
- Card 1 description copy (degraded vs non-degraded variants)
- Card 3 empty-state copy
- Card 5 healthy-state banner copy
- Sidebar nav items (Mission Control, Reviews, Catalog, Action Center, Monitoring, Settings)
- `MC_VERSION` (sidebar footer)

**Derived at render time** (not stored, not in payload):
- `_isDegradedScan(s)` — derived from `platforms.appleMusic.availability` vs `platforms.spotify.availability`
- `_healthBand(score)` — score → band label + CSS class
- `_resolveHealthScoreFromSnapshot(s)` — V2 `health_score` preferred; V1 fallback computes `100 - overallScore`; degraded returns null
- `_confidenceLabelForScan(scan)` — counts VERIFIED platforms across 6 sources, maps to High/Moderate/Limited
- `_donutGradient(pct)` — conic-gradient CSS string
- Status dot/label derivation in topbar
- "All systems normal" vs "Action required" vs "Attention needed" banner logic
- All animation state for the Signal Meter (sweep, infusion, drift loop) — entirely MC-side

**From the URL or window state**:
- Admin preview mode (`?preview_state=` query param)
- `body.tier-{tier}` class for CSS targeting

---

## Stage 0 Summary

### Headline findings

1. **MC reads 12 fields from `scan.payload` for direct rendering** (artist name, artwork, score, platforms.\*.availability for 6 sources, appleMusic.details.albums, appleMusic.details.storefrontAvailability, appleMusic.details.isrcLookup.isrc) — out of ~150 fields the canonical payload contains. **Roughly 90% of the canonical payload is unsurfaced in Mission Control today.**

2. **MC reads 5 tables beyond the scan payload** for the data it does display: `scan_snapshots` (history), `monitoring_alerts` (feed/actions/counts), `monitoring_subscriptions` (active state), `profiles` (founding-artist/tier), `audit_scans` (PDF URL). This is appropriate for monitoring-state concerns; less appropriate for things like Card 5's action items, which could be derived from `payload.issues[]` if the scan were the source of truth.

3. **Per-module scores (Metadata 100, Coverage 69, Publishing 90, Duplicates 80, YouTube 60, Sync 43), per-module grades (A-F), and risk summary text are all hidden.** Only the average appears as the Health Score. Surfacing the breakdown is a high-leverage MC V2 opportunity.

4. **The entire Royalty Gap and Gap-Based Exposure sections are absent from MC.** Both are user-visible on the PDF Royaltē Review but the in-app surface has no equivalent. This is a clear strategic gap for "Revenue Signals" / "Distribution Coverage Score™" / "AI Insight" future modules.

5. **Per-release detail is completely hidden.** The payload carries 4 albums with full metadata (name, releaseDate, trackCount, url, artwork) plus per-region availability per album. MC shows only aggregate counts. A Catalog Explorer drill-in (deferred in `project_royalte_deferred`) is the obvious surfacing target.

6. **`payload.issues[]` (7 normalized issue objects with severity / title / detail / module / source) is unused.** Mission Control's Action Center reads `monitoring_alerts` instead. Reconciling these two sources of "actions" is an architectural decision for MC V2.

7. **YouTube intelligence (official channel + UGC + ContentID risk + top videos + estimated unmonetised reach) is entirely hidden** despite being one of the strongest signal sources in the engine.

8. **Composer / publishing metadata** (`appleMusic.details.isrcLookup.composerName`) is hidden — direct publishing intel that the new "Publishing Intelligence" future module could consume.

### What Mission Control V2 Stage 1 should decide

| Question | Why it matters |
|---|---|
| **Does MC V2 read directly from the canonical scan payload, or from a derived "MC view" object?** | Today's loaders mix payload reads + table queries + derivations. The locked architecture says MC is presentation-only and reads the Royaltē Scan Payload. If "the payload" is literally `scan_snapshots.payload`, MC needs to consume `payload.issues[]` (not `monitoring_alerts`), `payload.score` (not derived `_resolveHealthScoreFromSnapshot`), etc. This is a major data-source unification. |
| **Should monitoring state (active subscription, alert history, baseline times) merge INTO the canonical payload as a `monitoring` sub-object, or stay as separate Supabase queries?** | Either is defensible. Today they're separate; the canonical payload knows nothing about monitoring. MC has both kinds of data on screen simultaneously. |
| **Which of the 90% hidden fields graduate into MC V2 surfaces?** | Per-module score breakdown, royalty-gap, gap-based-exposure indicators, YouTube UGC reach, per-album per-region availability, composer name. Each is a candidate for a dedicated card or drill-in. |
| **What's the formal Royaltē Canonical Artist Object schema?** | Today the de-facto canonical object is `normalizeAuditResponse`'s output. The locked architecture calls for a typed contract including all platform IDs, ISRC/UPC lists, albums, singles, tracks, publishing, metadata, catalog, and identity confidence — most of which exists in the payload today but is not surfaced or formally schematized. |
| **How does MC V2 honor the intelligence-network rule (#7)?** | Today MC labels are already Royaltē-Intelligence-named (Streaming Presence, Metadata Verification, Artist Identity, Authority Signals, Podcast Intelligence, Catalog Monitoring). Per-module scores would need similar abstraction if surfaced. |
| **Where does monitoring activation live for Apple-only artists?** | The Phase 4 question still open. Today `persistOSScanSnapshot`'s `_normalizeSubject` falls back to Apple ID → monitoring works keyed by Apple ID. Whether that's the canonical decision or whether a polymorphic-key migration is needed is unresolved. |

### Out of scope for Stage 0

- Designing MC V2 layouts, cards, or interactions
- Writing schemas for the Royaltē Canonical Artist Object
- Touching `dashboard.html`, `dashboard.js`, or any UI surface
- Implementing any of the hidden-field surfacing

Stage 0 ends here. **This document is the brief for Mission Control V2 Stage 1.**
