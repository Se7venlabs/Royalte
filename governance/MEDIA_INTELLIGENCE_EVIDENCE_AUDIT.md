# Media Intelligence™ — Evidence Audit

**Status:** Discovery / Pre-Architecture — DO NOT BUILD YET. Investigation only; no code, UI, or Mission Control changes made.
**Requested by:** Executive Board
**Date:** 2026-07-22
**Method:** Every claim below traces to a specific file/line, confirmed by direct code inspection (and, for the three providers with dedicated prior field-inventory work, live API calls against real artists). Nothing in this document is inferred from provider documentation alone — where an API's public schema was consulted, that is stated explicitly, and it is never used as a substitute for reading this codebase's actual request/parse code.

**A load-bearing architectural correction first:** CLAUDE.md's description of the audit engine fanning out to ~10 providers via `runAudit()` is stale. The live orchestrator is `runScan()` in `api/_lib/run-scan.js`, which runs 12 real acquisition calls in parallel (`Promise.allSettled`, lines 228–271) — 10 through the Provider Acquisition Layer (PAL) and 2 as legacy direct `fetch()` calls never migrated to PAL. A further 6 functions physically remain in `run-scan.js`, marked `[RETIRED CANDIDATE]`, superseded by PAL, called by nothing. This distinction (live vs. dead vs. legacy) matters throughout this audit — a provider "existing in the file" and a provider "actually contributing evidence to a real scan" are reported separately everywhere below.

---

## 1. Media Provider Inventory

| Provider | File(s) | Status | Auth |
|---|---|---|---|
| **YouTube** | `provider-acquisition/connectors/youtube/YouTubeConnector.js`, `api/_lib/youtube-pal-acquisition.js` | **Integrated** (live PAL, `run-scan.js:258`) | Requires API key (`YOUTUBE_API_KEY`); degrades gracefully (AUTH_UNAVAILABLE, not a coverage gap) if missing |
| **Apple Music** | `provider-acquisition/connectors/apple-music/AppleMusicConnector.js`, `api/_lib/apple-pal-acquisition.js` | **Integrated** (live PAL, `run-scan.js:242`); canonical identity source for the whole scan | Requires JWT (`APPLE_TEAM_ID`/`APPLE_KEY_ID`/`APPLE_PRIVATE_KEY`), graceful degradation if missing |
| **TheAudioDB** | `provider-acquisition/connectors/audiodb/AudioDBConnector.js`, `api/_lib/audiodb-pal-acquisition.js` | **Integrated** (live PAL, `run-scan.js:264`); richest media-asset/social provider of the three | None — free public API |
| **MusicBrainz** | `provider-acquisition/connectors/musicbrainz/MusicBrainzConnector.js`, `api/_lib/mb-pal-acquisition.js` | **Partially Integrated** — identity/tracks/releases live; `SOCIAL_LINKS` capability is declared and implemented at the connector level (`MusicBrainzConnector.js:158-159`) but never requested by the acquisition wrapper and has no bridge translator — a fully dead capability end-to-end today | None |
| **Discogs** | `provider-acquisition/connectors/discogs/DiscogsConnector.js`, `api/_lib/discogs-pal-acquisition.js` | **Partially Integrated** — identity/releases live; the `urls` field (official site/social links) has bridge-translation code (`EvidenceBridge.js:513`) that is architecturally unreachable, because the acquisition wrapper always uses the search endpoint and never the direct-lookup endpoint the `urls` field requires | Requires API key (`DISCOGS_CONSUMER_KEY`/`SECRET`) |
| **Spotify** | `provider-acquisition/connectors/spotify/SpotifyConnector.js`, `api/_lib/spotify-pal-acquisition.js` | **Integrated** (live PAL, `run-scan.js:249`, conditional on a resolved Spotify artist ID) — no social/channel fields exist on this provider's API at all | Requires OAuth client-credentials (`SPOTIFY_CLIENT_ID`/`SECRET`) |
| **Deezer** | `provider-acquisition/connectors/deezer/DeezerConnector.js`, `api/_lib/deezer-pal-acquisition.js` | **Integrated** (live PAL, `run-scan.js:261`) — no social/channel fields exist on this provider's public API | None |
| **Last.fm** | `provider-acquisition/connectors/lastfm/LastFmConnector.js`, `api/_lib/lastfm-pal-acquisition.js` | **Integrated** (live PAL, `run-scan.js:266`) — no social/channel fields | Requires API key (`LASTFM_API_KEY`) |
| **TIDAL** | `provider-acquisition/connectors/tidal/TidalConnector.js`, `api/_lib/tidal-pal-acquisition.js` | **Integrated** (live PAL, `run-scan.js:268`) — no social/channel fields; also does not expose genres | Requires OAuth 2.1 (`TIDAL_CLIENT_ID`/`SECRET`) |
| **MLC** (Mechanical Licensing Collective) | `provider-acquisition/connectors/mlc/MLCConnector.js`, `api/_lib/mlc-pal-acquisition.js` | **Integrated** (live PAL, `run-scan.js:259`) — publishing-only, zero media/social relevance | Requires credentials (`MLC_USERNAME`/`PASSWORD`, `MLC_REFRESH_TOKEN`) |
| **SoundCloud** | `api/_lib/run-scan.js:1464-1482` | **Integrated but not PAL-migrated** — legacy direct call, live on every scan (`run-scan.js:269`); Board's own provider registry flags this provider's hardcoded public `client_id` as a remediation item | Hardcoded public client_id (not env-configured) |
| **Wikidata / Wikipedia** | `api/_lib/run-scan.js:1516-1553` | **Integrated but not PAL-migrated** — legacy direct call, live on every scan (`run-scan.js:270`). Only calls `wbsearchentities` for name matching; never calls `wbgetentities` for property claims, so Wikidata's social-handle property system (e.g. Instagram, P2003) is never queried despite existing on the provider side | None (User-Agent header only) |
| **ACRCloud / ACRCloud AI Detection** | `provider-acquisition/connectors/acrcloud/`, `acrcloud-ai-detection/` | **Integrated, but not part of `runScan()`'s fan-out** — audio fingerprinting / AI-generated-music detection, zero media/social relevance | Requires API credentials |
| **Listen Notes** | `api/_lib/listen-notes.js` | **Integrated, but not part of `runScan()`'s fan-out**, and gated to monitoring-plan subscribers only (`isMonitoringSubscriber()`) — podcast-mention discovery, not artist media/channel data | Requires API key (`LISTEN_NOTES_API_KEY`), monitoring-tier only |
| **Meta (Instagram / Facebook)** | — | **Unavailable — no connector exists.** Every repo hit is either TheAudioDB's dead/broken `strFacebook`/`strInstagram` fields (Facebook works; Instagram is confirmed absent from the provider entirely), a UI service-picker label list in `settings.html:1015` with no backing connector, or a forward-looking comment | N/A |
| **TikTok** | — | **Unavailable — no connector exists.** All repo hits are marketing copy, the same UI label list, or a business/marketing checklist item in `LAUNCH_CHECKLIST.md` unrelated to code integration | N/A |
| **Official Website (generic scraper)** | — | **Unavailable — no connector exists.** No code path fetches an arbitrary artist website and extracts social links or other metadata | N/A |

---

## 2. Complete API Capability Matrix

Full, current Capability vocabulary (`provider-acquisition/capability/capabilityVocabulary.js:8-45`, 24 entries): `ARTIST_IDENTITY, RELEASES, TRACKS, ALBUMS, ISRC, ISWC, UPC, PUBLISHING, SONGWRITERS, CONTRIBUTORS, TERRITORIES, AVAILABILITY, GENRES, LABELS, AUDIO_FEATURES, ARTWORK, SOCIAL_LINKS, RIGHTS_DATA, PERFORMANCE_DATA, COLLECTION_DATA, PODCASTS, VIDEOS, AUDIO_RECOGNITION, AI_MUSIC_DETECTION`.

Media-relevant capabilities only, by provider and live status:

| Capability | YouTube | Apple Music | TheAudioDB | MusicBrainz | Discogs |
|---|---|---|---|---|---|
| `ARTIST_IDENTITY` | Live | Live | Live | Live | Live (search-only) |
| `COLLECTION_DATA` | Live | — | Live | — | — |
| `VIDEOS` | Live (acquired, not wired to canonical) | Live (acquired, not wired to canonical) | Live and wired | — | — |
| `ARTWORK` | — (thumbnails wired via identity/details) | Live | Live (richest of all providers — logos, clearart, banners, fan art) | — | — |
| `SOCIAL_LINKS` | — | — | Live and wired (with one filtered bad field) | **Declared + connector-implemented, never requested — dead capability** | **Declared with bridge code present, architecturally unreachable — dead capability** |
| `GENRES` | — | Live | Live | — | — |

No provider declares a dedicated "subscriber/follower delta," "monetization status," "official channel verification," or "content-type classification" capability — these do not exist anywhere in the 24-entry vocabulary, and are not proposed as new vocabulary entries here (see §8 Gap Analysis).

---

## 3. Complete Field Inventory

The full field-by-field detail for YouTube, Apple Music, and TheAudioDB already exists as Board-produced, live-verified documentation and is not reproduced in full here to avoid maintaining two copies of the same evidence — see `governance/MEDIA_PAL_FIELD_INVENTORY.md` (206 lines, every field individually cited with type, example, availability, and wiring status). Summary of that document's scope, confirmed accurate against current code during this audit:

**YouTube** — Identity (6 fields: channelId, channelTitle, customUrl, country, channelSource, searchResults), Statistics (4: subscriberCount, viewCount, videoCount, hiddenSubscriberCount), Channel Metadata (8: title, description, publishedAt, thumbnails, bannerImageUrl, topicCategories, brandingKeywords, uploadsPlaylistId), Video Metadata (10 fields per video: title, description, publishedAt, thumbnails, tags, duration, definition, viewCount, likeCount, commentCount, privacyStatus) — **all 18 channel-level fields wired to `canonical.platforms.youtube.*`; all 10 video-level fields acquired only, not yet translated to canonical.**

**Apple Music** — Identity (5: name, id, genreNames, artwork, url), Releases (11: id, name, releaseDate, trackCount, artwork, upc, recordLabel, copyright, genreNames, isSingle/isCompilation, editorialNotes, isMasteredForItunes), Territory (167-storefront availability, wired via Territory Intelligence Engine), Video Metadata (9 fields per video: id, name, artistName, releaseDate, durationInMillis, artwork, genreNames, isrc, contentRating) — **acquired only, not yet translated to canonical.** Tracks/ISRC endpoint currently returns HTTP 400 live — a pre-existing, unrelated condition, flagged not fabricated.

**TheAudioDB** — Identity (11 fields), Media Assets (9 fields: thumb, wideThumb, logo, clearart, banner, fanart×4), Links (5: website, facebook, twitter [broken], youtube [absent from provider], instagram [absent from provider]), Discography (2 fields per album), Video Metadata (6 fields per video) — **the only provider with all of identity, media assets, and video metadata simultaneously wired to canonical**, and the only provider with any working social-link acquisition at all (website + Facebook; Twitter is acquired but filtered to null due to a confirmed provider data-quality regression, Instagram and YouTube fields no longer exist on the provider's API as of the 2026-07-17 field-drift finding).

**Additional media-adjacent fields confirmed present on other providers, none previously catalogued:**

| Provider | Field | Media relevance |
|---|---|---|
| Spotify | `images[]` | Artist profile image (identity, not media-channel data) |
| Spotify | `followers.total`, `popularity` | Audience-size signal, Spotify-specific, no delta tracking |
| Deezer | `picture` (5 sizes), `fans` | Artist profile image + follower count |
| Last.fm | `listeners`, `playcount` | Audience-engagement signal, Last.fm-specific |
| SoundCloud | `followers_count`, `track_count`, `permalink_url` | Audience size + content count + profile link |
| TheAudioDB (retired legacy code, `run-scan.js:1404-1428`, not live) | `facebook`/`twitter`/`instagram`/`youtube` on the artist object directly | Historical evidence the provider used to expose these before the API changed shape — confirms the current absence is a provider-side regression, not a codebase oversight |

None of the above (Spotify/Deezer/Last.fm/SoundCloud audience numbers) carry a channel/video/content dimension — they are single-number audience signals from music-streaming platforms, not media-channel intelligence in the sense this audit is scoped to, but are listed for completeness since the Board's example field list included "Followers."

---

## 4. Canonical Field Classification

Using the Board's suggested categories, with two added where the evidence didn't fit cleanly into any suggested bucket (noted):

| Domain | Fields |
|---|---|
| **Identity** | channelId, channelTitle, customUrl, channelSource (YouTube); artist id/name (Apple, all providers); TheAudioDB idArtist/strArtist |
| **Media Assets** | thumbnails, bannerImageUrl (YouTube); artwork (Apple, per artist/album/video); strArtistThumb/WideThumb/Logo/Clearart/Banner/Fanart1-4 (TheAudioDB — richest single source of visual assets in the platform) |
| **Audience** | subscriberCount, viewCount, hiddenSubscriberCount (YouTube); followers.total (Spotify); fans (Deezer); listeners (Last.fm); followers_count (SoundCloud); intFollowers (TheAudioDB, acquired only) |
| **Engagement** *(new — not one of the suggested categories, but the evidence clearly separates from raw Audience size)* | statistics.viewCount/likeCount/commentCount (YouTube, per video); playcount (Last.fm); popularity (Spotify, Deezer's rank fields, TIDAL) |
| **Content / Video** | videoCount, uploadsPlaylistId (YouTube channel-level); per-video title/description/publishedAt/thumbnails/tags/duration/definition/privacyStatus (YouTube); per-video name/artistName/releaseDate/duration/artwork/genreNames/isrc/contentRating (Apple); idMVid/strTrack/strMusicVid/strTrackThumb/strDescriptionEN (TheAudioDB) |
| **Verification** | **No real field exists anywhere in the provider ecosystem for this category.** Confirmed absent, not just unwired — see §8. |
| **Monetization** | **No real field exists anywhere in the provider ecosystem for this category.** Confirmed absent — see §8. |
| **Discovery** *(new — not one of the suggested categories, but a real, distinct field cluster)* | topicCategories, brandingKeywords (YouTube — genre/SEO-adjacent signals used for discoverability, not identity or content per se) |
| **Links / Web Presence** | strWebsite, strFacebook, strTwitter (broken) (TheAudioDB — the only working social-link source); Discogs `urls` (present in principle, unreachable in practice); Wikidata property claims (present in principle on the provider side, never queried) |
| **Publishing** | Not media-relevant — MLC's ISRC/PUBLISHING/SONGWRITERS capabilities are pure rights-metadata, no channel/media dimension. Listed for completeness per the Board's category suggestion, empty for this audit's actual scope. |
| **Release Support** | releaseDate (cross-provider), recordLabel, upc (Apple) — connects a release to its supporting media (does this release have a video? — answerable only for the subset of video data currently wired, i.e. TheAudioDB) |
| **Platform Metadata** | channelSource (YouTube — internal resolution-method audit trail, not artist-facing data); searchResults (YouTube — audit trail) |

---

## 5. Canonical Ownership Matrix

| Field | Canonical Provider | Secondary Provider | Duplicate Providers | Confidence |
|---|---|---|---|---|
| Channel/Artist Identity (name, ID) | Apple Music (platform-wide canonical identity source per PAL architecture) | YouTube (channel-specific identity) | Spotify, Deezer, Last.fm, TheAudioDB, MusicBrainz, Discogs, TIDAL, SoundCloud (all independently confirm name) | High |
| Subscriber/Follower Count | YouTube (`subscriberCount`) | Spotify (`followers.total`), SoundCloud (`followers_count`), Deezer (`fans`) | TheAudioDB `intFollowers` (acquired only, provider-internal scale, not comparable) | High for YouTube; each other provider's number is platform-specific and not directly comparable to another's — no single "canonical follower count" exists across platforms |
| Video Catalog / Count | YouTube (`videoCount`, full video list) | Apple Music (music-video search results) | TheAudioDB (`idMVid` list, wired) | High for YouTube; Apple Music's video catalog is a different, narrower set (only videos indexed in Apple's catalog) — not a duplicate of YouTube's, a distinct real signal |
| Artist Images / Media Assets | TheAudioDB (broadest set: thumb, wide thumb, logo, clearart, banner, ×4 fan art) | Apple Music (artwork, template-based, high resolution) | YouTube (channel thumbnail/banner), Spotify (`images[]`), Deezer (`picture`) | High — TheAudioDB is the only provider offering the full asset-type range (logo/clearart/banner separately, not just a generic photo) |
| Website / Official Link | TheAudioDB (`strWebsite`, wired) | — | Discogs `urls` (unreachable), Wikidata property claims (never queried) | Low-Medium — only one provider's website field is actually reachable in production today; the "secondary" sources exist only in principle |
| Social Links (Facebook) | TheAudioDB (`strFacebook`, wired, confirmed working) | — | — | Medium — single-source, no cross-verification possible |
| Social Links (Twitter/X) | **None** — TheAudioDB's field is provider-broken (returns literal `"1"`, filtered to null) | — | — | None — no working source exists today |
| Social Links (Instagram, TikTok) | **None** | — | — | None — no provider in the ecosystem exposes these at all |
| Genre | Apple Music (`genreNames`, per artist and per album) | TheAudioDB (`strGenre`/`strStyle`/`strMood`), Deezer (derived), Spotify (`genres[]`), Last.fm (`tags[]`) | — | High for Apple as canonical (already the platform-wide identity anchor); the others are legitimate secondary signals, not exact duplicates (different taxonomies) |
| Biography / Description | TheAudioDB (`strBiography`, full-length, wired) | YouTube (`description`, channel-level "About" text — different content, not a duplicate) | Last.fm (`bio`, HTML-stripped, acquired) | Medium — three genuinely different texts serving different purposes, not one fact triple-sourced |
| Video Type Classification (Official Music Video / Lyric Video / Behind-the-Scenes / Live Performance / Shorts) | **None.** No provider returns this classification. | — | — | None — see §8, this is the single largest gap between the approved mockup and real evidence |
| Official Channel Verification | **None.** No provider exposes this. | — | — | None |
| Monetization Status | **None.** No provider exposes this. | — | — | None |
| Growth / Delta Metrics (subscriber change %, view change %) | **None.** No historical snapshot mechanism exists anywhere in the platform for any provider (same class of gap as Global Music Footprint™'s already-documented Coverage Timeline™ deferral). | — | — | None |

---

## 6. Derived Intelligence Opportunities

For every field cluster with real evidence, whether genuine executive intelligence is legitimately derivable — and, just as importantly, where it is not, despite superficially seeming like it should be.

| Evidence | Derivable? | Intelligence |
|---|---|---|
| `subscriberCount`, `videoCount`, `viewCount` (YouTube, wired) | **YES** | **Channel Scale™** — a real, point-in-time snapshot of channel size. Cannot support a trend/growth claim (no historical snapshots exist — see §8). |
| `latestUploadAt` (derivable once video-level YouTube data is wired to canonical — currently acquired only) | **YES, once wired** | **Upload Recency™** — "days since last upload," a real, computable fact from a real timestamp. **Upload Frequency™** (cadence over time) is **NOT** derivable from a single scan — requires either multiple video timestamps (available, once wired — could compute average gap between the N most recent real uploads) or historical scan comparison (not available). A single-scan "average gap between existing upload timestamps" is legitimate; a "frequency trend" is not, absent monitoring history. |
| `platformsDetected` (which of YouTube/Apple/Spotify/TheAudioDB/etc. returned real evidence for this artist) | **YES** | **Platform Coverage™** — directly analogous to Global Music Footprint™'s already-shipped pattern (which providers have real evidence vs. which don't). Real, evidence-backed, no fabrication risk if implemented the same way (never conflate "provider returned evidence" with "provider confirms an official channel exists" — the same class of bug caught twice already in Global Music Footprint™). |
| Per-video `duration` (YouTube, Apple — acquired only) | **YES, once wired** | **Shorts Detection™** (≤60s, YouTube only — no dedicated API flag exists, but duration-based inference is a real, documented, board-approved technique already used for this exact purpose in `governance/MEDIA_PAL_EXPANSION_COMPLETION_REPORT.md:33`). **Cannot** derive "Lyric Video," "Behind-the-Scenes," "Live Performance," or "Official Music Video" classification from duration or any other real field — no provider returns this, and no combination of real fields (title text, description text) constitutes reliable evidence without a fabricated keyword-matching heuristic, which this audit does not recommend (see §8). |
| Video-catalog presence per real release (cross-referencing Apple/YouTube video data against a real, already-acquired album/release from the same scan) | **YES, partially** | **Release Support™** — "does this specific release have an accompanying music video," answerable for Apple Music (video `releaseDate`/`artistName` can be matched against a real album) and partially for YouTube (title-text matching against a release name is heuristic, not exact — flagged as lower-confidence than the Apple Music match). |
| `strWebsite`, `strFacebook` (TheAudioDB, wired) | **YES** | **Web Presence™** — a simple, real "does this artist have a discoverable official website / Facebook page" signal. Cannot extend to Instagram/TikTok/Twitter — no real data exists for those platforms in this codebase today. |
| Channel/video media assets (thumbnails, banners, logos — multiple providers, wired) | **YES** | **Asset Completeness™** — "how many of the standard asset types (profile image, banner, logo) does this artist have across their real, evidence-backed platforms" — a real completeness count, not a quality judgment. |
| Delta/growth in any metric (subscribers, views, video count) | **NO** | No historical snapshot mechanism exists for any provider today. Identical, already-documented gap class to Global Music Footprint™'s Coverage Timeline™ (explicitly deferred there, pending a real Monitoring Timeline™ mechanism — not built here either). |
| Monetization readiness | **NO** | No provider exposes YouTube Partner Program status, monetization eligibility, or any equivalent for any platform. This is not a wiring gap — it is data that does not exist anywhere in the current provider ecosystem, full stop. |
| Official Channel / Official Artist Channel verification | **NO** | Confirmed absent from the YouTube Data API v3 public schema (`governance/MEDIA_PAL_FIELD_INVENTORY.md:66`) and from every other provider's schema. No real signal exists to derive this from. |
| Content-gap "opportunities" (e.g. "missing a lyric video for your latest single") | **NO, as currently conceived** | This requires the video-type classification that does not exist (see above). A narrower, real version is possible — "this release has zero associated videos across wired providers" (a real completeness gap) — but "missing a *lyric* video specifically" cannot be honestly claimed without real type data. |

---

## 7. Recommended KPI Cards (Evidence-Based)

Every card below is backed only by evidence confirmed real and either already wired or wireable via a documented, non-speculative translation step (per §6). Presentation/layout is explicitly out of scope per the Board's instructions — these are content recommendations only, not mockups.

**Channel Scale™**
Evidence: YouTube `subscriberCount`, `viewCount`, `videoCount` (wired today).
Reason: Real, point-in-time channel size, directly analogous to already-shipped KPI patterns elsewhere in the platform (e.g. Global Reach™).

**Platform Coverage™**
Evidence: presence/absence of real evidence packages across YouTube, Apple Music, TheAudioDB, Spotify, Deezer, Last.fm, TIDAL, SoundCloud, MusicBrainz, Discogs (all live today).
Reason: Directly reuses the "which providers have real evidence" pattern already proven correct in Global Music Footprint™'s Provider Coverage™ card — same evidence shape, same honesty guarantees (never conflate evidence-presence with official-status).

**Upload Recency™**
Evidence: YouTube/Apple video `publishedAt`/`releaseDate` (acquired today; requires the documented translation step in §8 before it reaches canonical — not yet available in production).
Reason: A real, single-fact "days since last upload" — legitimate without requiring any historical snapshot mechanism.

**Web Presence™**
Evidence: TheAudioDB `strWebsite`, `strFacebook` (wired today).
Reason: Real, if narrow — the only working social/web-link evidence in the entire provider ecosystem today.

**Asset Completeness™**
Evidence: thumbnails/artwork/logo/banner fields across YouTube, Apple Music, TheAudioDB (wired today).
Reason: A real completeness count across already-acquired media assets, no fabrication risk.

**Video Catalog™** (renamed from the mockup's "Total Videos" to avoid implying type-classification the evidence doesn't support)
Evidence: YouTube `videoCount` (wired); Apple Music music-video search-result count (acquired, requires translation step); TheAudioDB video list (wired).
Reason: Real per-provider video counts. Explicitly **not** recommended: any card implying a breakdown by video type (Official/Lyric/Behind-the-Scenes/etc.) — no evidence supports that breakdown today.

**Cards from the approved mockup NOT recommended, with reasons — see §8 for full detail:** Subscriber/View Growth (delta %), Official Artist Channel status, Monetization Readiness, any video-type-classified breakdown or "missing video type" opportunity card.

---

## 8. Gap Analysis

Organized against the Board's requested categories, and explicitly cross-referenced against the approved mockup's dev fixture (`public/workspaces/media-intelligence.html:270-315`) — because that fixture is the clearest available statement of what the Board's approved design currently assumes exists, and several of its fields do not.

### Unavailable via any API (confirmed absent from every provider in the ecosystem)
- **Official Artist Channel / verified-channel status** — mockup field `officialArtistChannel`. Confirmed absent from YouTube's public schema and every other provider. Cannot be built without a manual verification/attestation flow (artist self-declares, or Royaltē staff verifies) — not an API problem, a product-design one.
- **Monetization status/readiness** — mockup field `monetization.status`/`readinessPct`/`checklist`. No provider in the ecosystem exposes this. YouTube Partner Program status specifically would require a fundamentally different, OAuth-scoped, channel-owner-authenticated API surface (YouTube Analytics API or Content ID API), not the public Data API v3 this codebase uses — a different auth model entirely, not a missing field on the current one.
- **Video type classification** (Official Music Video / Lyric Video / Behind-the-Scenes / Live Performance) — mockup field `videos[].type`. No provider returns this. The one narrow exception: Shorts are legitimately duration-inferable (≤60s), already documented as the correct technique in the Media PAL Expansion™ completion report.
- **Instagram, TikTok data of any kind** — no connector exists; not an auth/tier problem, the connectors themselves do not exist.
- **Growth/delta metrics** (subscriber change %, view change %, video count change) — mockup fields `subscribersDeltaPct`, `channelViewsDeltaPct`, `totalVideosDelta`. No historical snapshot mechanism exists anywhere in the platform for any provider — same already-documented gap class as Global Music Footprint™'s Coverage Timeline™.

### Requires OAuth
- Deeper YouTube channel data (e.g. real-time analytics, monetization) would require the YouTube Analytics/Content ID APIs — channel-owner OAuth, not the current API-key model. Not pursued in this audit per "do not speculate about future capabilities."

### Requires Enterprise/Paid Access
- None identified as a genuine near-term unlock for media-specific data — the providers already integrated (YouTube, Apple, TheAudioDB) are the ones with real media-channel data among this ecosystem; Meta/TikTok would each require a full new connector build (their own developer-platform approval processes, likely business-verification-gated) rather than a tier upgrade on an existing connector.

### Requires Future Connector
- Meta (Instagram/Facebook Graph API), TikTok (TikTok for Developers API), and a generic official-website scraper are the three genuinely missing acquisition sources identified in this audit. Building any of them is out of scope here per explicit Board instruction not to speculate about future capabilities — flagged as existing, real gaps only.

### Requires Manual Artist Input
- Official-channel verification and monetization status (see above) are the two fields the mockup assumes that likely cannot be filled by any API at all, ever, for a third-party platform like Royaltē, and would need either a manual attestation flow or would need to be dropped from the design entirely.

### A distinct, actionable near-term gap — not "unavailable," just "not yet wired"
Both YouTube and Apple Music already **acquire** full video-level metadata (title, description, dates, thumbnails, duration, and for YouTube view/like/comment counts) — none of it is currently translated into `canonical.platforms.*`. This is the single largest concrete, buildable gap between real evidence and the approved mockup's video-catalog display: closing it requires a translation function in `EvidenceBridge.js` (a `translateYouTubeVideos()` and an Apple videos translator, following the exact, already-proven pattern `translateAudioDBVideos()` establishes) — a real, scoped, non-speculative engineering task already identified and explicitly deferred in `governance/MEDIA_PAL_EXPANSION_COMPLETION_REPORT.md:206`, not invented for this audit.

---

## 9. Constitutional Architecture Recommendations

**Canonical Media Model.** No dedicated canonical media/social object exists yet in the 12-object Canonical Payload V2 model (per memory: identity, publishing, catalog, territory, backend, recording-intelligence, etc.) — media/video/social evidence currently lives only in `canonical.platforms.{youtube,appleMusic,audiodb}.*`, provider-namespaced, not domain-unified the way Territory Intelligence™ or Publishing Intelligence™ already are. Recommend a future `assembleMediaIntelligence()` domain assembler, following the exact constitutional pattern already proven by `assembleGlobalMusicFootprint()`/`assembleCatalogIntelligence()` — pure function of evidence, deep-frozen output, never invents a field the evidence doesn't support. Not built here; a recommendation for the next authorized phase.

**Canonical Provider Hierarchy for media fields**, per §5's ownership matrix: TheAudioDB is canonical for media assets and (the only working) social links; YouTube is canonical for channel scale and video catalog; Apple Music is canonical for identity and the video subset that exists in Apple's own catalog. No single provider is canonical for "media intelligence" as a whole — any future assembler must merge across all three, honestly reflecting that different facts have different canonical sources, exactly as Territory Intelligence™ already does for Apple-only territory data vs. the broader identity model.

**Evidence Resolution Strategy.** The two "declared but dead" capabilities found in this audit (MusicBrainz `SOCIAL_LINKS`, Discogs `urls`) are a real, fixable architecture debt distinct from "data doesn't exist" — both are genuine engineering gaps (a missing wrapper call, a wrong endpoint choice) rather than provider limitations, and should be evaluated for a future, separately-scoped fix rather than folded into Media Intelligence™'s first real build, since fixing them only adds two more low-confidence secondary sources (MusicBrainz relationship URLs, Discogs profile `urls`) to an already-established canonical hierarchy — not a blocker for shipping Media Intelligence™ v1 on TheAudioDB + YouTube + Apple.

**Future Expansion Opportunities**, strictly limited to what this audit found real evidence pointing toward, not speculation: (1) the video-translation wiring gap in §8 is immediately actionable and unlocks real video-catalog and release-support intelligence without any new connector; (2) MusicBrainz/Discogs social-link wiring, if ever prioritized, adds low-confidence secondary sources only; (3) any Meta/TikTok/website-scraper connector is a genuinely new, unscoped build, not an extension of existing work.

**Architectural improvement discovered during this audit, unrelated to media specifically:** CLAUDE.md's provider fan-out description is stale (documents `runAudit()`/legacy shape, not the real `runScan()`/PAL shape) — worth a documentation correction in a future housekeeping pass, flagged here since it was discovered during this investigation, not acted on (documentation-only fix, out of this audit's scope to execute).

---

## 10. Executive Summary

Royaltē's real, live media-relevant evidence today comes from exactly three providers — **YouTube** (channel scale + video catalog, richest audience/statistics source), **Apple Music** (identity anchor + a narrower official video catalog), and **TheAudioDB** (richest media-asset and only working social-link source) — plus thin, single-number audience signals from Spotify/Deezer/Last.fm/SoundCloud that don't carry a channel or content dimension. Two capabilities (MusicBrainz and Discogs social links) are declared in code but dead end-to-end — genuine, fixable engineering gaps, not provider limitations. Meta, TikTok, and a generic website scraper are confirmed entirely absent from the codebase — real gaps requiring new connector builds, not tier upgrades.

The most consequential finding of this audit: **the Board-approved Media Intelligence™ mockup's own dev fixture assumes several fields that do not exist anywhere in the real provider ecosystem** — official-channel verification, monetization readiness, video-type classification (Lyric Video / Behind-the-Scenes / Official Music Video), and every growth/delta metric. This is the same class of finding this evidence-first methodology has caught before (Global Music Footprint™'s mockup contained a fabricated 195-country denominator, discovered the same way, before any implementation began) — evidence discovery working exactly as intended, catching a design/reality mismatch before a single line of Media Intelligence™ UI code is written against it.

What genuinely can ship, evidence-first: Channel Scale™, Platform Coverage™, Upload Recency™ (once a small, already-scoped translation step lands), Web Presence™, Asset Completeness™, and a video-count-only Video Catalog™ card — all real, all traceable, all already acquired or one documented wiring step away. What cannot ship as currently mocked: any monetization card, any official-verification badge, any video-type breakdown, and any growth/trend metric — none of these have real evidence behind them today, and building them would mean either fabricating data or waiting on genuinely new capabilities (new connectors, a monitoring/history mechanism, or a manual-attestation product flow) that are explicitly out of this audit's scope to design.

---

## Deliverables Reference

1. Media Provider Inventory — §1
2. Complete API Capability Matrix — §2
3. Complete Field Inventory — §3
4. Canonical Field Classification — §4
5. Canonical Ownership Matrix — §5
6. Derived Intelligence Opportunities — §6
7. Recommended KPI Cards (Evidence-Based) — §7
8. Gap Analysis — §8
9. Constitutional Architecture Recommendations — §9
10. Executive Summary — §10

---

## Merge Authority

This is a documentation-only deliverable — no code, UI, or Mission Control changes were made, per explicit Board instruction. Nothing to merge; committing this file to the repository as the Board's requested audit record. Media Intelligence™ implementation work remains unauthorized pending Executive Board review of these findings.
