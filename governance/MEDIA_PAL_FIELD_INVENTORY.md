# Media PAL Field Inventory — YouTube, Apple Music, TheAudioDB

**Status:** DOCUMENTATION ONLY. No code changes. Produced per Board request following Media PAL Expansion™ (PR #363).
**Method:** Every field below was confirmed by direct, live API calls made through the actual PAL connectors during this pass (not inferred from documentation) — using real credentials against real artists (Black Alternative, Coldplay, Radiohead). Where a field's *wiring* status is stated, it was confirmed by reading `lib/rie/EvidenceBridge.js` directly, not assumed. One exception is flagged explicitly in §2.4 (Apple Music Tracks/ISRC) where the underlying endpoint currently errors — documented as a finding, not fabricated.

**Legend:**
- **Availability**: *Always* = the API contract guarantees this field on a successful response. *Optional* = present only when the provider has the data (may be `null`, empty string, or absent depending on provider).
- **Wired**: *Wired* = flows through `EvidenceBridge.js` into `canonical.platforms.*`, reachable by downstream intelligence engines today. *Acquired only* = the PAL acquires this data (available in the raw Evidence Contract payload) but no translation function surfaces it into `canonical.platforms.*` yet — available for future use, exactly as flagged in the Media PAL Expansion™ completion report.

---

## 1. YouTube

**Capabilities declared:** `ARTIST_IDENTITY`, `COLLECTION_DATA`, `VIDEOS` (all three acquired in production as of PR #363).
**Connector:** `provider-acquisition/connectors/youtube/YouTubeConnector.js` · **Wrapper:** `api/_lib/youtube-pal-acquisition.js` · **Bridge:** `EvidenceBridge.js:571-663`

### 1.1 Identity

| Field | Type | Description | Example | Availability | Wired |
|---|---|---|---|---|---|
| `channelId` | string | YouTube channel ID | `"UCxxxxxxxxxxxxxxxx"` | Always (once channel resolved) | **Wired** → `platforms.youtube.channelId` |
| `channelTitle` | string | Channel display name | `"Black Alternative"` | Always | **Wired** → `platforms.youtube.channelTitle` |
| `customUrl` | string | Channel's custom URL slug | `"@blackalternative"` | Optional | **Wired** → `platforms.youtube.customUrl` |
| `country` | string | Channel's declared country | `"US"` | Optional | **Wired** → `platforms.youtube.country` |
| `channelSource` | string (derived) | How the channel was resolved — `royalte_identity_graph` or `strict_name_match` | `"strict_name_match"` | Always | **Wired** → `platforms.youtube.channelSource` |
| `searchResults` | array | Raw search hits when more than one candidate matched | — | Optional | **Wired** → `platforms.youtube.searchResults` (audit trail only) |

### 1.2 Statistics

| Field | Type | Description | Example | Availability | Wired |
|---|---|---|---|---|---|
| `subscriberCount` | number | Channel subscriber count | `125400` | Always (0 if hidden) | **Wired** → `platforms.youtube.details.subscriberCount` |
| `viewCount` | number | Total channel views, all-time | `3200000` | Always | **Wired** → `platforms.youtube.details.viewCount` |
| `videoCount` | number | Total public video count | `48` | Always | **Wired** → `platforms.youtube.details.videoCount` |
| `hiddenSubscriberCount` | boolean | Whether the channel owner has hidden subscriber count | `false` | Always | **Wired** → `platforms.youtube.details.hiddenSubscriberCount` |

### 1.3 Channel Metadata / Branding

| Field | Type | Description | Example | Availability | Wired |
|---|---|---|---|---|---|
| `title` | string | Channel title (authoritative — channel can rename) | `"Black Alternative"` | Always | **Wired** → `platforms.youtube.details.title` |
| `description` | string | Channel "About" description | — | Optional | **Wired** → `platforms.youtube.details.description` |
| `publishedAt` | string (ISO 8601) | Channel creation date | `"2026-01-15T00:00:00Z"` | Always | **Wired** → `platforms.youtube.details.publishedAt` |
| `thumbnails` | object | Channel avatar, multiple sizes (default/medium/high) | `{default:{url},medium:{url},high:{url}}` | Always | **Wired** → `platforms.youtube.details.thumbnails` |
| `bannerImageUrl` | string | Channel banner image URL | — | Optional | **Wired** → `platforms.youtube.details.bannerImageUrl` |
| `topicCategories` | array\<string\> | Wikipedia topic URLs (music-genre detection signal) | `["https://en.wikipedia.org/wiki/Music"]` | Optional | **Wired** → `platforms.youtube.details.topicCategories` |
| `brandingKeywords` | string | Channel SEO keywords, owner-set | — | Optional | **Wired** → `platforms.youtube.details.brandingKeywords` |
| `uploadsPlaylistId` | string | Playlist ID listing every public upload (used internally to acquire Videos) | `"UUxxxxxxxxxxxxxxxx"` | Always | **Wired** → `platforms.youtube.details.uploadsPlaylistId` |

### 1.4 Video Metadata (per video — new as of Media PAL Expansion™)

| Field | Type | Description | Example | Availability | Wired |
|---|---|---|---|---|---|
| `snippet.title` | string | Video title | `"Everything Is Over – Black Alternative \| Dark Cinematic Visualizer"` | Always | **Acquired only** |
| `snippet.description` | string | Video description | — | Optional | **Acquired only** |
| `snippet.publishedAt` | string (ISO 8601) | Video publish date/time | `"2026-04-12T04:00:10Z"` | Always | **Acquired only** |
| `snippet.thumbnails` | object | Video thumbnail, multiple sizes | `{medium:{url:"https://i.ytimg.com/vi/AGwjpmhOsgo/mqdefault.jpg"}}` | Always | **Acquired only** |
| `snippet.tags` | array\<string\> | Video tags, owner-set | — | Optional | **Acquired only** |
| `contentDetails.duration` | string (ISO 8601) | Video length | `"PT28S"` | Always | **Acquired only** — sub-60s duration is the client-derivable Shorts signal (no dedicated API field exists) |
| `contentDetails.definition` | string | `hd` or `sd` | `"hd"` | Always | **Acquired only** |
| `statistics.viewCount` | number (string) | Video view count | `"23"` | Always | **Acquired only** |
| `statistics.likeCount` | number (string) | Video like count | — | Optional (can be hidden) | **Acquired only** |
| `statistics.commentCount` | number (string) | Video comment count | — | Optional (can be disabled) | **Acquired only** |
| `status.privacyStatus` | string | `public`, `unlisted`, or `private` | `"public"` | Always | **Acquired only** |

**Not available from this provider, confirmed:** an explicit "is this a Short" flag, or an "Official Artist Channel" flag — neither exists anywhere in the YouTube Data API v3 public response schema. Not fabricated here.

---

## 2. Apple Music

**Capabilities declared:** `ARTIST_IDENTITY`, `RELEASES`/`ALBUMS`, `TRACKS`, `ISRC`, `UPC`, `ARTWORK`, `GENRES`, `AVAILABILITY`, `TERRITORIES`, `LABELS`, and **`VIDEOS`** (new as of Media PAL Expansion™).
**Connector:** `provider-acquisition/connectors/apple-music/AppleMusicConnector.js` · **Wrapper:** `api/_lib/apple-pal-acquisition.js` · **Bridge:** `EvidenceBridge.js:129-262`

### 2.1 Identity

| Field | Type | Description | Example | Availability | Wired |
|---|---|---|---|---|---|
| `attributes.name` | string | Artist name | `"Coldplay"` | Always | **Wired** → `subject.artistName`, `platforms.appleMusic.artistName` |
| `id` | string | Apple catalog artist ID | `"471744"` | Always | **Wired** → `subject.artistId`, `platforms.appleMusic.artistId` |
| `attributes.genreNames` | array\<string\> | Artist genre tags | `["Alternative"]` | Optional | **Wired** → `platforms.appleMusic.genres` |
| `attributes.artwork.url` | string (template) | Artist image, `{w}x{h}` template | `".../{w}x{h}bb.jpg"` | Optional | **Wired** → `platforms.appleMusic.artworkUrl` / `cio.identity.artwork` (dimension-substituted) |
| `attributes.url` | string | Apple Music artist page URL | `"https://music.apple.com/us/artist/coldplay/471744"` | Always | **Wired** → `platforms.appleMusic.profileUrl` |

### 2.2 Releases / Albums

| Field | Type | Description | Example | Availability | Wired |
|---|---|---|---|---|---|
| `id` | string | Apple catalog album ID | `"1122782080"` | Always | **Wired** → `platforms.appleMusic.details.albums[].id` |
| `attributes.name` | string | Album title | `"Parachutes"` | Always | **Wired** → `...albums[].name` |
| `attributes.releaseDate` | string (date) | Release date | `"2000-07-10"` | Always | **Wired** → `...albums[].releaseDate` |
| `attributes.trackCount` | number | Track count | `10` | Always | **Wired** → `...albums[].trackCount` |
| `attributes.artwork.url` | string (template) | Album artwork | — | Always | **Wired** → `...albums[].artwork` |
| `attributes.upc` | string | Universal Product Code | `"190295978075"` | Optional | **Wired** → `...albums[].upc` |
| `attributes.recordLabel` | string | Record label | `"Parlophone UK"` | Optional | **Wired** → `...albums[].recordLabel` |
| `attributes.copyright` | string | Copyright line | `"℗ 2000 Parlophone Records Ltd..."` | Optional | **Acquired only** |
| `attributes.genreNames` | array\<string\> | Album genre tags | `["Alternative","Indie Rock",...]` | Optional | **Acquired only** |
| `attributes.isSingle` / `isCompilation` | boolean | Release-type flags | `false` | Always | **Acquired only** |
| `attributes.editorialNotes.short` / `.standard` | string | Apple editorial description | `"The stars begin to shine..."` | Optional | **Acquired only** |
| `attributes.isMasteredForItunes` | boolean | Mastered-for-iTunes flag | `true` | Always | **Acquired only** |

### 2.3 Territory / Availability

| Field | Type | Description | Example | Availability | Wired |
|---|---|---|---|---|---|
| `storefronts.{code}` | object per storefront | Per-storefront catalog presence, all 167 Apple storefronts (or BIG6 subset) | — | Always (per requested storefront set) | **Wired** → `platforms.appleMusic.details.globalStorefrontAvailability.{available[],unavailable[],errors[],total}` — now sourced from the Territory Intelligence Engine's classification (Phase 5.4), not re-interpreted at the bridge |

### 2.4 Tracks / ISRC — flagged, not independently re-verified this pass

`Capability.TRACKS` (`/artists/{id}/songs`) was tested live during this pass and currently returns **HTTP 400** for a known-good artist ID. This is a **pre-existing condition, unrelated to Media PAL Expansion™** — this endpoint was not touched by that work. Not fabricating a field shape for data that could not be confirmed live; flagged here as a finding for a future, separately-scoped fix rather than documented as working. `Capability.ISRC` (`/songs?filter[isrc]=`) uses the same underlying songs resource and was not independently tested given the above.

### 2.5 Video Metadata (new as of Media PAL Expansion™)

| Field | Type | Description | Example | Availability | Wired |
|---|---|---|---|---|---|
| `id` | string | Apple catalog music-video ID | `"1447404777"` | Always | **Acquired only** |
| `attributes.name` | string | Video title | `"All I Need (In Rainbows - From the Basement)"` | Always | **Acquired only** |
| `attributes.artistName` | string | Attributed artist | `"Radiohead"` | Always | **Acquired only** |
| `attributes.releaseDate` | string (date) | Release date | — | Optional | **Acquired only** |
| `attributes.durationInMillis` | number | Video length in ms | — | Always | **Acquired only** |
| `attributes.artwork` | object | Video thumbnail/artwork | `{url, width, height, bgColor}` | Always | **Acquired only** |
| `attributes.genreNames` | array\<string\> | Genre tags | — | Optional | **Acquired only** |
| `attributes.isrc` | string | ISRC, where the video is tied to a recording | — | Optional | **Acquired only** |
| `attributes.contentRating` | string | `explicit`/`clean`/absent | — | Optional | **Acquired only** |

**Finding, documented in the Media PAL Expansion™ completion report:** Apple Music does not expose music videos as an artist relationship or view — this data is acquired via a search scoped to the `music-videos` resource type, confirmed working with 25 real results against a known artist.

---

## 3. TheAudioDB

**Capabilities declared:** `ARTIST_IDENTITY`, `ARTWORK`, `GENRES`, `SOCIAL_LINKS`, `COLLECTION_DATA`, `VIDEOS` — all six already fully acquired **and** wired in production; zero changes were made to this provider during Media PAL Expansion™.
**Connector:** `provider-acquisition/connectors/audiodb/AudioDBConnector.js` · **Wrapper:** `api/_lib/audiodb-pal-acquisition.js` · **Bridge:** `EvidenceBridge.js:858-970`

### 3.1 Identity

| Field | Type | Description | Example | Availability | Wired |
|---|---|---|---|---|---|
| `idArtist` | string | TheAudioDB artist ID | `"111239"` | Always | **Wired** → `platforms.audiodb.artistId` |
| `strArtist` | string | Artist name | `"Coldplay"` | Always | **Wired** → `platforms.audiodb.name` |
| `strBiography` | string | Full biography (English) | — (long-form text, unabridged) | Optional | **Wired** → `platforms.audiodb.profile.biography` |
| `strCountry` | string | Country of origin | `"United Kingdom"` (example shape) | Optional | **Wired** → `platforms.audiodb.profile.country` |
| `intFormedYear` | string (numeric) | Year formed | `"1996"` | Optional | **Wired** → `platforms.audiodb.profile.formed` |
| `strLabel` | string | Record label | `"Parlophone"` | Optional | **Wired** → `platforms.audiodb.profile.label` |
| `strGenre` | string | Primary genre | `"Alternative Rock"` | Optional | **Wired** → `platforms.audiodb.profile.genre` |
| `strStyle` | string | Style tag | `"Rock/Pop"` | Optional | **Wired** → `platforms.audiodb.profile.style` |
| `strMood` | string | Mood tag | `"Happy"` | Optional | **Wired** → `platforms.audiodb.profile.mood` |
| `intPopularity` | string (numeric) | Popularity score, provider-internal scale | `"91"` | Optional | **Acquired only** |
| `intFollowers` | string (numeric) | Follower count, provider-internal | `"57510550"` | Optional | **Acquired only** |

### 3.2 Media Assets

| Field | Type | Description | Availability | Wired |
|---|---|---|---|---|
| `strArtistThumb` | string (URL) | Artist thumbnail | Optional | **Wired** → `platforms.audiodb.media.thumbnails.thumb` |
| `strArtistWideThumb` | string (URL) | Wide-format thumbnail | Optional | **Wired** → `...thumbnails.wideThumb` |
| `strArtistLogo` | string (URL) | Artist logo | Optional | **Wired** → `...logos.logo` |
| `strArtistClearart` | string (URL) | Transparent-background art | Optional | **Wired** → `...logos.clearart` |
| `strArtistBanner` | string (URL) | Banner image | Optional | **Wired** → `...banners.banner` |
| `strArtistFanart` / `Fanart2` / `Fanart3` / `Fanart4` | string (URL) ×4 | Up to 4 independent fan-art images | Optional (each independently) | **Wired** → `...fanArt.fanart` / `.fanart2` / `.fanart3` / `.fanart4` |

### 3.3 Links

| Field | Type | Description | Availability | Wired |
|---|---|---|---|---|
| `strWebsite` | string | Official website (bare domain, no scheme) | Optional (empty string when absent, confirmed live) | **Wired** → `platforms.audiodb.media.social.website` |
| `strFacebook` | string | Facebook URL | Optional (empty string when absent) | **Wired** → `...social.facebook` |
| `strTwitter` | string | **Confirmed provider data-quality issue**: returns the literal string `"1"` for every artist tested, never a real URL | Always present as `"1"`, never a usable link | **Wired**, but filtered — `normalizeAudioDBTwitter()` converts `"1"` to `null` rather than exposing it as a fake link |
| `strYoutube` | — | **Confirmed absent from the API entirely** (not just empty) as of the 2026-07-17 field-drift finding | N/A | Reads as `null` — field no longer exists on the provider side |
| `strInstagram` | — | **Confirmed absent from the API entirely**, same finding | N/A | Reads as `null` — field no longer exists on the provider side |

### 3.4 Discography (Collection Data)

| Field | Type | Description | Example | Availability | Wired |
|---|---|---|---|---|---|
| `strAlbum` | string | Album title | `"Moon Music"` | Always | **Wired** → `platforms.audiodb.discography[]` (raw array preserved) |
| `intYearReleased` | string (numeric) | Release year | `"2024"` | Always | **Wired** → same array |

Live-confirmed response shape is sparser than the provider's documented schema suggests — only `strAlbum` and `intYearReleased` were present per entry in this pass's live sample (51 albums returned for Coldplay); the bridge preserves whatever the provider actually returns, unmodified.

### 3.5 Video Metadata

| Field | Type | Description | Example | Availability | Wired |
|---|---|---|---|---|---|
| `idMVid` | string | TheAudioDB video ID | — | Always | **Wired** → `platforms.audiodb.media.videos[]` (raw array preserved) |
| `strTrack` | string | Track/song title | `"Princess of China"` | Always | **Wired** → same array |
| `strMusicVid` | string (URL) | Link to the video (typically a YouTube URL) | `"http://www.youtube.com/watch?v=1Uw6ZkbsAH8"` | Always | **Wired** → same array |
| `strTrackThumb` | string (URL) | Video thumbnail | `"https://r2.theaudiodb.com/images/media/track/thumb/..."` | Optional | **Wired** → same array |
| `strDescriptionEN` | string | Video/song description (English) | — (long-form text) | Optional | **Wired** → same array |
| `idAlbum` / `idTrack` | string | Cross-reference IDs to discography/track | — | Always | **Wired** → same array |

---

## 4. Cross-Provider Summary

| Category | YouTube | Apple Music | TheAudioDB |
|---|---|---|---|
| Identity | Wired | Wired | Wired |
| Statistics (subscribers/views) | Wired | N/A (not this provider's domain) | Popularity/followers acquired only |
| Releases/Discography | N/A (not this provider's domain) | Wired | Wired |
| Territory/Availability | N/A | Wired | N/A |
| **Video Metadata** | **Acquired only (new)** | **Acquired only (new)** | **Wired (pre-existing)** |
| Media Assets (artwork/logos/banners) | Partial (thumbnails wired) | Partial (artwork wired) | Fully wired (richest of the three) |
| Social Links | N/A | N/A | Wired (with one known bad-field filter) |

**The one deliberate, load-bearing takeaway for future Media Intelligence™ work:** video-level metadata is now acquired from both YouTube and Apple Music, matching TheAudioDB's existing pattern — but per the Media PAL Expansion™ brief's explicit scope boundary, none of it is yet translated into `canonical.platforms.*` the way TheAudioDB's video data already is. That translation step (a new `translateYouTubeVideos()` / a new Apple videos translator in `EvidenceBridge.js`, following the exact pattern `translateAudioDBVideos()` already establishes) is the concrete next engineering step before any of this new video data can reach Media Intelligence™, Backend Intelligence™, Executive Brief™, or AI Insights™ — and remains a coding task for a future, separately-authorized brief.
