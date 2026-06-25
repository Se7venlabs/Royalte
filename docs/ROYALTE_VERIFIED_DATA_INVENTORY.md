# ROYALTĒ VERIFIED DATA INVENTORY™

**Version:** 1.0  
**Date:** 2026-06-24  
**Status:** Board Directive — Master Reference  
**Classification:** Internal — Engineering & Product

---

## PURPOSE

This document answers one question: **What information can Royaltē prove today?**

It is the authoritative inventory of every external API integration in the Royaltē scan engine — what data is collected, how it is verified, and where it flows. Every future Mission Control module, Health Score calculation, AI Insight, Executive Assessment, and Executive Brief must treat this document as the canonical data contract before proposing new features.

---

## VERIFICATION STATE MODEL

All data points carry one of four states (Board Directive v2.0):

| State | Meaning | Health Score Treatment |
|---|---|---|
| `VERIFIED` | Confirmed present by a live query | Positive signal |
| `NOT_FOUND` | Queried, genuinely absent | Deduction allowed |
| `UNABLE TO CONFIRM` | Source not queried / key absent / non-subscriber | No deduction, no penalty, no assumption |
| `AUTH_UNAVAILABLE` | API key missing or auth failed | No deduction — display as "Unavailable" |

**Core principle:** Unable to Confirm ≠ Not Present. A field that cannot be confirmed is never treated as a gap.

---

## PLATFORM INDEX

| # | Platform | Auth Method | Identity Role | Health Score Impact | Mission Control Surface |
|---|---|---|---|---|---|
| 1 | Apple Music | JWT (p8 key) | **Canonical** | Catalog, Territory | Catalog Intelligence, Global Music Footprint |
| 2 | Spotify | OAuth Client Credentials | Verification | Streaming, Catalog | Streaming panel |
| 3 | MusicBrainz | None (public) | Cross-reference | Backend Health | Backend Intelligence |
| 4 | Discogs | Consumer key/secret | Cross-reference | Backend Health | Backend Intelligence |
| 5 | SoundCloud | None (public search) | Presence check | Platform Coverage | Identity card |
| 6 | Last.fm | API key | Listener data | — | Listener Intelligence |
| 7 | Wikidata / Wikipedia | None (public) | Factual data | — | Artist context |
| 8 | YouTube | API key | Channel identity | YouTube Presence | YouTube Intelligence |
| 9 | AudioDB | None (public) | Genre / biography | — | Artist context |
| 10 | Deezer | None (public) | Fan count | — | Platform coverage |
| 11 | MLC | Internal API | Publishing | Publishing Health | Publishing Intelligence, Backend Intelligence |
| 12 | Listen Notes | API key | Podcast discovery | — | Monitoring-plan only |
| 13 | TIDAL | OAuth Client Credentials | Popularity | — | Schema reserved — not yet wired |

---

## SECTION 1 — APPLE MUSIC

**Auth:** JWT signed with `APPLE_TEAM_ID` + `APPLE_KEY_ID` + `APPLE_PRIVATE_KEY`  
**Module:** `api/_lib/identity/apple.js`, `api/apple-music.js`  
**Constitutional role:** Primary canonical identity source. Apple wins when both Apple and Spotify data are present.

### Endpoints Called

| Endpoint | Purpose |
|---|---|
| `GET /v1/catalog/{sf}/artists/{id}` | Artist metadata |
| `GET /v1/catalog/{sf}/search?term=...&types=artists` | Artist search by name |
| `GET /v1/catalog/{sf}/music-videos/{id}` | Resolve music video → artist |
| `GET /v1/catalog/{sf}/albums/{id}` | Resolve album → artist |
| `GET /v1/catalog/{sf}/songs/{id}` | Resolve track → artist |
| `GET /v1/catalog/{sf}/artists/{id}/albums?limit=25` | Artist album list |
| `GET /v1/catalog/{sf}/artists/{id}/songs?limit=25` | Top songs for ISRC comparison |
| `GET /v1/catalog/{sf}/songs?filter[isrc]={isrc}` | ISRC cross-reference lookup |
| `GET /v1/catalog/{sf}/albums/{probeId}` (×8 storefronts) | BIG6 market availability |
| `GET /v1/catalog/{sf}/albums/{probeId}` (×167 storefronts) | Global storefront availability |

### Fields Extracted

| Field | Type | Example | CIO Location | Used By |
|---|---|---|---|---|
| `attributes.name` | string | `"Kendrick Lamar"` | `identity.canonicalArtistName` | All modules |
| `id` (artist) | string | `"368183298"` | `identity.externalProfiles[apple].profileId` | Identity Intelligence |
| `attributes.artwork.url` | string (template) | `https://is1-ssl.mzstatic.com/image/{w}x{h}bb.jpg` | `platforms.appleMusic.details.artworkUrl` (600×600 substituted) | EA, MC artwork |
| `relationships.albums.data[]` | array | `[{id, type, href}]` | Feeds album classification | Catalog Intelligence |
| `albums[].attributes.name` | string | `"DAMN."` | `platforms.appleMusic.details.albums[].title` | Catalog Intelligence |
| `albums[].attributes.trackCount` | number | `14` | Album type classification (1=single, 2-6=EP, 7+=album) | Catalog Intelligence |
| `albums[].attributes.releaseDate` | string (YYYY) | `"2017"` | `platforms.appleMusic.details.albums[].releaseYear` | Catalog Intelligence |
| `albums[].id` | string | `"1440828886"` | Probe album ID for storefront checks | Global Music Footprint |
| `songs[].attributes.isrc` | string | `"USRC11600448"` | ISRC cross-reference source | ISRC Intelligence |
| `storefrontAvailability.available[]` | array of sf codes | `["us","gb","ca"]` | `platforms.appleMusic.details.storefrontAvailability` | BIG6 map |
| `globalStorefrontAvailability.available[]` | array (167 max) | `["us","gb","fr",...]` | `platforms.appleMusic.details.globalStorefrontAvailability.available` | Global Music Footprint |
| `globalStorefrontAvailability.unavailable[]` | array | `["cn","ir",...]` | `platforms.appleMusic.details.globalStorefrontAvailability.unavailable` | Global Music Footprint |
| `globalStorefrontAvailability.total` | number | `167` | Territory math | Global Music Footprint |

### What Royaltē Can Prove from Apple Music

- Artist exists on Apple Music with a verified Apple ID
- Exact canonical artist name per Apple catalog
- Full discography: singles, EPs, albums, track counts
- Global distribution reach (which of 167 Apple Music markets carry the catalog)
- Key market presence: US, GB, CA, AU, DE, FR, JP, MX (BIG6 + 2)
- ISRC values for released recordings
- Artwork URL for the artist's Apple Music profile

---

## SECTION 2 — SPOTIFY

**Auth:** Client Credentials (`SPOTIFY_CLIENT_ID` + `SPOTIFY_CLIENT_SECRET`)  
**Module:** `api/_lib/run-scan.js`  
**Constitutional role:** Verification layer. Confirms Apple canonical identity; provides streaming metrics.

### Endpoints Called

| Endpoint | Purpose |
|---|---|
| `GET /v1/search?q={name}&type=artist` | Artist search by name |
| `GET /v1/artists/{id}` | Artist profile |
| `GET /v1/artists/{id}/albums?include_groups=album,single,compilation&limit=50` | Album list |
| `GET /v1/artists/{id}/albums?include_groups=appears_on&limit=50` | Features / appears_on |
| `GET /v1/artists/{id}/top-tracks?market=US` | Top tracks |
| `GET /v1/albums/{id}` | Album detail (for track listing) |
| `GET /v1/tracks?ids={id1,id2,...}` | Track batch lookup (ISRCs) |
| `GET /v1/search?q=isrc:{isrc}&type=track` | ISRC cross-reference |

### Fields Extracted

| Field | Type | Example | CIO Location | Used By |
|---|---|---|---|---|
| `name` | string | `"Kendrick Lamar"` | `identity.externalProfiles[spotify].name` | Name match verification |
| `id` | string | `"2YZyLoL8N0Wb9xBt1NhZWg"` | `identity.externalProfiles[spotify].profileId` | All Spotify calls |
| `followers.total` | number | `34521890` | `platforms.spotify.details.followers` | Streaming Intelligence |
| `popularity` | number (0-100) | `92` | `platforms.spotify.details.popularity` | Streaming Intelligence |
| `genres[]` | array of strings | `["west coast rap","hip hop"]` | `platforms.spotify.details.genres` | AI context |
| `images[0].url` | string | `https://i.scdn.co/image/...` | `platforms.spotify.details.imageUrl` | Fallback artwork |
| `external_urls.spotify` | string | `https://open.spotify.com/artist/...` | `platforms.spotify.details.profileUrl` | MC links |
| `albums[].album_group` | string | `"album"/"single"/"appears_on"` | Drives `catalog.albumsCount`, `singlesCount`, `featuresCount` | Catalog Intelligence (secondary to Apple) |
| `albums[].total_tracks` | number | `14` | Track count per release | Catalog Intelligence |
| `albums[].release_date` | string | `"2017-04-14"` | Release date | Catalog Intelligence |
| `top-tracks[].isrc` | string | `"USRC11600448"` | `catalog.recordings[].isrc` | ISRC Intelligence, Publishing Intelligence |
| `top-tracks[].id` | string | Spotify track ID | Track identity | ISRC cross-reference |
| `top-tracks[].name` | string | `"HUMBLE."` | `catalog.recordings[].title` | AI context |
| `top-tracks[].popularity` | number | `84` | Track-level engagement signal | AI context |
| `top-tracks[].album.name` | string | `"DAMN."` | Album context per track | AI context |
| `appears_on` album count | derived | `12` | `catalog.featuresCount` | Catalog Intelligence (features) |

### What Royaltē Can Prove from Spotify

- Artist exists on Spotify with a verified Spotify ID
- Monthly listener proxy (followers as floor indicator)
- Popularity score (0-100 Spotify internal metric)
- Genre classification
- Complete discography count by type (own releases vs. features)
- ISRC values for top tracks (up to 10 tracks)
- Whether catalog counts match Apple Music (cross-platform consistency)

---

## SECTION 3 — MUSICBRAINZ

**Auth:** None (public API, user-agent required)  
**Module:** `api/_lib/run-scan.js`  
**Constitutional role:** Independent backend verification. Cross-reference for ISRC, MBID, and release metadata.

### Endpoints Called

| Endpoint | Purpose |
|---|---|
| `GET /ws/2/artist?query=artist:{name}&limit=5&fmt=json` | Artist search |
| `GET /ws/2/recording?query=isrc:{isrc}&fmt=json` | ISRC lookup |

### Fields Extracted

| Field | Type | Example | CIO Location | Used By |
|---|---|---|---|---|
| `artists[0].id` (MBID) | UUID | `"381086ea-f511-4aba-bdf9-71c753dc5077"` | `platforms.musicbrainz.details.mbid` | Backend Intelligence |
| `artists[0].name` | string | `"Kendrick Lamar"` | Name verification | Identity cross-check |
| `artists[0].country` | string | `"US"` | Origin country | Artist context |
| `artists[0].score` | number | `100` | Confidence in match | Match gating |
| `recordings[].isrcs[]` | array | `["USRC11600448"]` | ISRC verification | ISRC Intelligence |
| `recordings[0].releases[]` | array | Release objects | Release cross-check | Catalog cross-reference |

### What Royaltē Can Prove from MusicBrainz

- MusicBrainz ID (MBID) exists for the artist
- ISRC registration is confirmed in the MusicBrainz database
- Independent verification of artist country of origin
- Backend connectivity status (VERIFIED / NOT_FOUND / ERROR)

---

## SECTION 4 — DISCOGS

**Auth:** Consumer key + secret (`DISCOGS_CONSUMER_KEY`, `DISCOGS_CONSUMER_SECRET`)  
**Module:** `api/_lib/run-scan.js`  
**Constitutional role:** Physical release and metadata cross-reference.

### Endpoints Called

| Endpoint | Purpose |
|---|---|
| `GET /database/search?q={name}&type=artist&per_page=5` | Artist search |
| `GET /artists/{id}/releases?per_page=10&sort=year&sort_order=desc` | Release history |

### Fields Extracted

| Field | Type | Example | CIO Location | Used By |
|---|---|---|---|---|
| `results[0].id` | number | `2541855` | `platforms.discogs.details.discogsId` | Backend Intelligence |
| `results[0].title` | string | `"Kendrick Lamar"` | Name verification | Identity check |
| `results[0].thumb` | string | Image URL | Thumbnail | — (unused v1.0) |
| `releases[].title` | string | `"good kid, m.A.A.d city"` | Release titles | Catalog cross-check |
| `releases[].year` | number | `2012` | Release year | Catalog cross-check |
| Availability state | derived | `"VERIFIED"` / `"NOT_FOUND"` | `platforms.discogs.availability` | Backend Intelligence |

### What Royaltē Can Prove from Discogs

- Discogs artist profile exists (independent of streaming platforms)
- Physical/digital release history in the Discogs database
- Backend connectivity status

---

## SECTION 5 — SOUNDCLOUD

**Auth:** None (public search endpoint)  
**Module:** `api/_lib/run-scan.js`  
**Constitutional role:** SoundCloud presence signal (fan count).

### Endpoints Called

| Endpoint | Purpose |
|---|---|
| `GET /search/users?q={name}&limit=5` | Artist presence search |

### Fields Extracted

| Field | Type | Example | CIO Location | Used By |
|---|---|---|---|---|
| `collection[0].followers_count` | number | `4521890` | `platforms.soundcloud.details.followers` | Platform coverage |
| `collection[0].username` | string | `"kendricklamar"` | Handle verification | Platform coverage |
| `collection[0].permalink_url` | string | `https://soundcloud.com/kendricklamar` | Profile URL | MC links |

### What Royaltē Can Prove from SoundCloud

- SoundCloud profile exists for the artist
- SoundCloud follower count (self-reported metric)

---

## SECTION 6 — LAST.FM

**Auth:** API key (`LASTFM_API_KEY`)  
**Module:** `api/_lib/run-scan.js`

### Endpoints Called

| Endpoint | Purpose |
|---|---|
| `GET /?method=artist.getinfo&artist={name}&api_key=...&format=json` | Listener and play count |

### Fields Extracted

| Field | Type | Example | CIO Location | Used By |
|---|---|---|---|---|
| `artist.stats.listeners` | string (number) | `"4521890"` | `platforms.lastfm.details.listeners` | Listener Intelligence |
| `artist.stats.playcount` | string (number) | `"98765432"` | `platforms.lastfm.details.playcount` | Listener Intelligence |
| `artist.bio.summary` | string | HTML bio | — | Unused v1.0 |
| `artist.tags.tag[]` | array | `[{name:"rap"},{name:"hip-hop"}]` | Genre cross-reference | AI context |

### What Royaltē Can Prove from Last.fm

- Last.fm registered listener count (long-term engagement metric)
- Total historical play count
- Audience genre tags (community-sourced)

---

## SECTION 7 — WIKIDATA / WIKIPEDIA

**Auth:** None (public)  
**Module:** `api/_lib/run-scan.js`

### Endpoints Called

| Endpoint | Purpose |
|---|---|
| `GET /w/api.php?action=wbsearchentities&search={name}&type=item` (Wikidata) | Entity lookup |
| `GET /wiki/Special:EntityData/{Q-id}.json` | Entity data |
| `GET /api/rest_v1/page/summary/{title}` (Wikipedia) | Article summary |

### Fields Extracted

| Field | Type | Example | CIO Location | Used By |
|---|---|---|---|---|
| Q-ID | string | `"Q102244"` | `platforms.wikipedia.details.wikidataId` | Identity cross-check |
| `claims.P569` (birth date) | date | `"1987-06-17"` | Artist biography context | AI context |
| `claims.P19` (birthplace) | entity ref | `Q65` (Los Angeles) | Origin context | AI context |
| Wikipedia summary | string | 1-paragraph text | AI context | AI Insight generation |

### What Royaltē Can Prove from Wikidata / Wikipedia

- Wikidata entity exists (notable enough for Wikipedia ecosystem)
- Artist birth date and origin city (when public record exists)
- Short factual biography text

---

## SECTION 8 — YOUTUBE

**Auth:** API key (`YOUTUBE_API_KEY`)  
**Module:** `api/_lib/run-scan.js`

### Endpoints Called

| Endpoint | Purpose |
|---|---|
| `GET /youtube/v3/search?q={name}&type=channel&part=snippet` | Channel search |
| `GET /youtube/v3/channels?id={channelId}&part=statistics,snippet` | Channel stats |
| `GET /youtube/v3/search?channelId={id}&type=video&order=viewCount&part=id,snippet&maxResults=5` | Top videos |
| `GET /youtube/v3/videos?id={ids}&part=statistics` | Video view counts |

### Fields Extracted

| Field | Type | Example | CIO Location | Used By |
|---|---|---|---|---|
| `items[0].id.channelId` | string | `"UC07D5hcOHOLw_FkgBN0e3Zg"` | `platforms.youtube.details.channelId` | YouTube Health |
| `statistics.subscriberCount` | string (number) | `"28400000"` | `platforms.youtube.details.subscribers` | YouTube Health |
| `statistics.viewCount` | string (number) | `"4521890765"` | `platforms.youtube.details.totalViews` | YouTube Health |
| `statistics.videoCount` | string (number) | `"234"` | `platforms.youtube.details.videoCount` | YouTube Health |
| Top video view counts | derived | `[4M, 2.1M, 1.8M, ...]` | Engagement signals | YouTube Health |
| Channel verified badge | derived | boolean | ContentID eligibility signal | YouTube Health |

**Important:** UGC (User Generated Content) analysis was removed in PR #103 and must not be reintroduced without ContentID API per CLAUDE.md.

### What Royaltē Can Prove from YouTube

- Official YouTube channel exists with a verified channel ID
- Total subscriber count
- Total historical view count
- Active upload count
- Engagement rate via top-video view distribution

---

## SECTION 9 — AUDIODB

**Auth:** None (public API)  
**Module:** `api/_lib/run-scan.js`

### Endpoints Called

| Endpoint | Purpose |
|---|---|
| `GET /api/v1/json/1/search.php?s={name}` | Artist search |

### Fields Extracted

| Field | Type | Example | CIO Location | Used By |
|---|---|---|---|---|
| `artists[0].strGenre` | string | `"Hip-Hop"` | Genre signal | AI context |
| `artists[0].strBiographyEN` | string | Long bio text | Biography text | AI context |
| `artists[0].strCountry` | string | `"USA"` | Origin country | AI context |
| `artists[0].strMood` | string | `"Dark"` | Mood classification | AI context |
| `artists[0].strStyle` | string | `"West Coast"` | Style tag | AI context |

### What Royaltē Can Prove from AudioDB

- Genre classification (independent of streaming platform genre tags)
- Extended biographical text (English)
- Country of origin cross-reference

---

## SECTION 10 — DEEZER

**Auth:** None (public)  
**Module:** `api/_lib/run-scan.js`

### Endpoints Called

| Endpoint | Purpose |
|---|---|
| `GET /search/artist?q={name}&limit=5` | Artist search |
| `GET /artist/{id}` | Fan count |

### Fields Extracted

| Field | Type | Example | CIO Location | Used By |
|---|---|---|---|---|
| `data[0].id` | number | `1167830` | `platforms.deezer.details.deezerId` | Platform coverage |
| `nb_fan` | number | `4521890` | `platforms.deezer.details.fans` | Fan count |
| `link` | string | `https://www.deezer.com/artist/1167830` | Profile URL | MC links |

### What Royaltē Can Prove from Deezer

- Deezer artist profile exists
- Deezer fan count (an independent streaming audience metric)

---

## SECTION 11 — MLC (MECHANICAL LICENSING COLLECTIVE)

**Auth:** Internal (API credentials managed by Royaltē)  
**Module:** `api/_lib/mlc-client.js`, `lib/publishing/mlc-adapter.js`  
**Constitutional role:** Primary publishing verification source. The `mlc-adapter.js` is the sole owner of MLC field-name parsing (Board lock `mlc-publishing-adapter-v1.0`).

### Endpoints Called

| Endpoint | Purpose |
|---|---|
| MLC Artist Search | Artist registration check |
| MLC Work Search | Composition registration lookup by artist |

### Fields Extracted

| Field | Type | Example | CIO Location | Used By |
|---|---|---|---|---|
| Artist registration exists | boolean | `true` | `observations.publishingSources.mlc.availability` | Publishing Intelligence |
| `worksCount` | number | `47` | `observations.publishingSources.mlc.details.worksCount` | Publishing Health |
| `iswcCount` | number | `47` | `observations.publishingSources.mlc.details.iswcCount` | Publishing Health (primary positive indicator) |
| `publisherCount` | number | `3` | `observations.publishingSources.mlc.details.publisherCount` | Publishing Intelligence |
| Works list | `PublishingWork[]` | Array of works | Publishing processing | Publishing Intelligence |

### The 4-State MLC Contract (Board Directive v2.0)

| `availability` | Meaning | Source state | Health Score |
|---|---|---|---|
| `VERIFIED` | MLC was queried, artist found | Live API response | See below |
| `NOT_FOUND` | MLC was queried, artist not found | Live API response | Deduction possible |
| `AUTH_UNAVAILABLE` | MLC credentials absent | Missing env var | No deduction |
| null / absent | MLC not queried this scan | No call made | **No deduction — Unable to Confirm** |

**Critical rule:** `null` MLC observation = Unable to Confirm. Never assume absence of publishing registration from a missing MLC observation. Only a `VERIFIED` result with `worksCount === 0` produces a deduction (MEDIUM severity, routed to `opportunities[]`).

### What Royaltē Can Prove from MLC

- Compositions are registered in the MLC database (when `availability === 'VERIFIED'`)
- Count of ISWC-registered compositions (primary positive publishing indicator)
- Number of distinct publishers administering rights
- Verified absence of MLC registration (when `availability === 'NOT_FOUND'`)

---

## SECTION 12 — LISTEN NOTES

**Auth:** API key (`LISTEN_NOTES_API_KEY`)  
**Module:** `api/_lib/podcast-intelligence.js`  
**Access restriction:** Monitoring-plan subscribers only. MUST NOT be called from the public `/api/audit` scan path.

### Endpoints Called

| Endpoint | Purpose |
|---|---|
| `GET /api/v2/search?q={artistName}&type=episode` | Podcast episode mentions |

### Fields Extracted

| Field | Type | Example | CIO Location | Used By |
|---|---|---|---|---|
| Episode count mentioning artist | number | `23` | `payload.monitoringIntelligence.*` | Podcast Intelligence (monitoring) |
| Podcast titles | string[] | `["The Joe Budden Podcast",...]` | Episode context | Monitoring card |
| Episode publish dates | dates | ISO dates | Recency scoring | Monitoring Intelligence |

**Never name "Listen Notes" in artist-facing UI.** Display as podcast coverage data only.

### What Royaltē Can Prove from Listen Notes

- Count of podcast episodes referencing the artist (monitoring-plan only)
- Podcast reach and recency (monitoring-plan only)

---

## SECTION 13 — TIDAL

**Auth:** OAuth 2.1 Client Credentials (`TIDAL_CLIENT_ID`, `TIDAL_CLIENT_SECRET`)  
**Module:** `api/tidal-token.js`  
**Status:** Token infrastructure exists; scan integration not yet wired.

### Current State

The TIDAL OAuth token module is built and tested (`api/tidal-token.js`). The canonical schema reserves `tidalPopularity` (number, required) in `api/schema/auditResponse.js`. The Radiohead fixture carries `tidalPopularity: 78`.

No live TIDAL endpoint calls are wired in the scan engine. The `tidalPopularity` field defaults to `0` when no live data is present.

### What Royaltē Will Be Able to Prove from TIDAL (v2.0)

- TIDAL popularity score (0-100)
- HiFi subscriber engagement (TIDAL's core audience segment)

---

## SECTION 14 — DERIVED DATA POINTS

These fields are computed from the raw API data above, not fetched directly. They are facts Royaltē generates from verified sources.

### Catalog Intelligence

| Derived Field | Source | Method |
|---|---|---|
| Singles count | Apple Music albums | `trackCount === 1` |
| EP count | Apple Music albums | `trackCount >= 2 && <= 6` |
| Album count | Apple Music albums | `trackCount >= 7` |
| Features count | Spotify `appears_on` | Count of `album_group === 'appears_on'` |
| Catalog status | Owned release count | Board-locked thresholds (Limited/Stable/Growing/Expanding/Large) |
| Catalog confidence | Apple availability | VERIFIED / Partial / Unable to Confirm |

### Global Music Footprint

| Derived Field | Source | Method |
|---|---|---|
| Territories available | Apple Music global check | Count of `available[]` array (167-storefront universe) |
| Territories unavailable | Apple Music global check | Count of `unavailable[]` array |
| Coverage percent | `available / total * 100` | Integer percentage |
| Market presence labels | BIG6 check | US/GB/CA/AU/DE/FR/JP/MX per-storefront probe |

### Publishing Intelligence

| Derived Field | Source | Method |
|---|---|---|
| ISWC coverage | MLC `iswcCount` vs `catalog.recordings` count | Ratio |
| Publisher present | MLC `publisherCount > 0` | Boolean |
| Rights registration status | MLC `availability` + `worksCount` | 4-state model per Board Directive v2.0 |

### Health Score

| Category | Source Fields | Max Points |
|---|---|---|
| Catalog Verification | Apple album count, ISRC presence | 40 |
| BIG6 Coverage | Apple 8-market storefront probe | 20 |
| Backend Health | MusicBrainz + Discogs availability | 20 |
| YouTube Presence | YouTube channel + subscribers | 10 |
| ISRC | Recordings with valid ISRCs | 10 |

---

## SECTION 15 — DATA FRESHNESS

| Platform | Update Frequency | Royaltē Refresh |
|---|---|---|
| Apple Music | Real-time (catalog updates within hours) | Per scan |
| Spotify | Real-time | Per scan |
| MusicBrainz | Community-edited (days to weeks lag) | Per scan |
| Discogs | Community-edited (days to weeks lag) | Per scan |
| SoundCloud | Real-time | Per scan |
| Last.fm | Near real-time (hourly aggregates) | Per scan |
| Wikidata/Wikipedia | Community-edited (variable) | Per scan |
| YouTube | Real-time | Per scan |
| AudioDB | Manually curated (slow updates) | Per scan |
| Deezer | Real-time | Per scan |
| MLC | Monthly update cycle | Per scan |
| Listen Notes | Crawl-based (days lag) | Per scan (monitoring only) |

---

## SECTION 16 — DATA NOT CURRENTLY AVAILABLE

The following data points are frequently requested but not within Royaltē's current verified data set:

| Data Point | Why Unavailable | Path to Availability |
|---|---|---|
| PRO membership (ASCAP/BMI/SOCAN/PRS) | No API access to PRO member databases | Direct PRO integrations (future) |
| Streaming royalty amounts | DSP financials are not public APIs | Publisher/distributor OAuth (future) |
| SoundExchange registration | No public SoundExchange API | Direct integration (future) |
| Publishing deal terms | Private contracts | Not in scope |
| Sync licensing history | Industry databases (Music Reports, HFA) | Future integration |
| Performance royalty collection amounts | PRO statement data | Future (PRO OAuth) |
| TIDAL popularity (live) | Token built, not wired | Engineering sprint |
| Podcast reach (free tier) | Listen Notes — monitoring only | Subscription gate |

---

## GOVERNING PRINCIPLES

1. **Apple is canonical.** When Apple and Spotify data conflict, Apple wins.
2. **Unable to Confirm is never a deduction.** Per Board Directive v2.0: only verified absence produces negative Health Score impact.
3. **ISWC is the primary publishing positive indicator.** An ISWC in the MLC database is a confirmed registration fact.
4. **AUTH_UNAVAILABLE is not NOT_FOUND.** A missing API key is never rendered as a gap, never scored as zero.
5. **Intelligence generates once, consumes everywhere.** No module recomputes from raw API data — all downstream surfaces read from the CIO and assembled intelligence objects.
6. **The scan engine never owns artist identity.** All artist-specific records live in `api/_lib/identity-graph.js` (Royaltē Identity Graph™); the engine reads, never writes.
7. **Listen Notes is never named artist-facing.** Display as podcast/media data only.

---

*Source of truth: the modules listed in each section header. For implementation disputes, the module docblock governs. This document is updated when new API integrations are added or existing integrations change scope.*
