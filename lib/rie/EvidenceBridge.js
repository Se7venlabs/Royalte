// RIE Layer 2 — Evidence Bridge
// Phase 2.4 — migration infrastructure only.
// Phase 3.6 — Spotify translation added.
// Phase 3.8 — MusicBrainz translation added.
// Phase 3.6 (Discogs) — Discogs translation added.
// Phase 3.6 (YouTube) — YouTube translation added.
// Phase 3.6 (The MLC) — MLC translation added.
//
// Constitutional authority: Royaltē Master Constitution v1.3 §8
// Board Authorization: Phase 2.4 (2026-07-01), Phase 3.6-Spotify (2026-07-02),
//   Phase 3.8 (2026-07-02), Phase 3.6-Discogs (2026-07-03), Phase 3.6-YouTube (2026-07-02),
//   Phase 3.6-MLC (2026-07-02)
//
// ─────────────────────────────────────────────────────────────────────────────
// BOARD DIRECTIVE (Phase 2.4):
//
//   EvidenceBridge is MIGRATION INFRASTRUCTURE ONLY.
//   It is NOT part of the permanent Royaltē Operating System.
//
//   It MUST NOT:
//     • compute intelligence
//     • normalize intelligence
//     • reconcile providers
//     • interpret provider responses
//     • become business logic
//     • become a permanent dependency
//
//   It performs STRUCTURAL SHAPE TRANSLATION ONLY:
//     Provider Acquisition Layer Evidence Contracts
//       → canonicalForEnrichment shape expected by Phase 1 assembly chain
//
//   As future phases migrate the RIE to consume Evidence Contracts natively,
//   EvidenceBridge shall be reduced and ultimately removed.
//   No future functionality may depend upon EvidenceBridge.
// ─────────────────────────────────────────────────────────────────────────────
//
// Supported evidence types (Phase 3.6 — Apple Music + Spotify):
//
//   Apple Music (provider: 'apple_music'):
//     Capability.ARTIST_IDENTITY  → subject.*, source.*, platforms.appleMusic.*
//     Capability.GENRES           → same as ARTIST_IDENTITY (genres embedded in artist response)
//     Capability.ALBUMS           → platforms.appleMusic.details.albums[]
//     Capability.RELEASES         → same as ALBUMS
//     Capability.TERRITORIES      → platforms.appleMusic.details.globalStorefrontAvailability
//     Capability.AVAILABILITY     → same as TERRITORIES
//
//   Spotify (provider: 'spotify'):
//     Capability.ARTIST_IDENTITY  → platforms.spotify.*
//     Capability.ALBUMS           → platforms.spotify.details.albums[]
//     Capability.TRACKS           → platforms.spotify.details.topTracks[]
//
//   MusicBrainz (provider: 'musicbrainz') — Phase 3.8:
//     Capability.ARTIST_IDENTITY  → platforms.musicbrainz.* (mbid, aliases, tags)
//     Capability.TRACKS           → platforms.musicbrainz.details.recordings[]
//     Capability.RELEASES         → platforms.musicbrainz.details.releaseGroups[]
//
//   Discogs (provider: 'discogs') — Phase 3.6 (Discogs):
//     Capability.ARTIST_IDENTITY  → platforms.discogs.* (artistId, profile, urls, images)
//     Capability.RELEASES         → platforms.discogs.details.releases[] + totalReleases
//
//   YouTube (provider: 'youtube') — Phase 3.6 (YouTube):
//     Capability.ARTIST_IDENTITY  → platforms.youtube.* (channelId, channelTitle, channelSource)
//     Capability.COLLECTION_DATA  → platforms.youtube.details.* (statistics, topicDetails,
//                                   brandingSettings, contentDetails, uploadsPlaylistId)
//
//   The MLC (provider: 'mlc') — Phase 3.6 (The MLC):
//     Capability.ISRC        → platforms.mlc.recordings[] (raw Recording objects)
//                               [{ id, title, artist, isrc, mlcsongCode, labels }]
//     Capability.PUBLISHING  → platforms.mlc.details.works[] (raw Work objects)
//                               [{ primaryTitle, mlcSongCode, iswc, writers, publishers,
//                                  akas, artists, membersSongId }]
//     Raw evidence preserved in full — normalization deferred to Publishing Intelligence.
//     The Board-locked normalizeMlcWork() (lib/publishing/mlc-adapter.js) is called
//     by the intelligence domain, not by the bridge.
//
// Unknown evidence types are silently skipped — no rejection, no error.
// The bridge never throws.

import { Capability } from '../../provider-acquisition/capability/capabilityVocabulary.js';
// Phase 5.4 — translateTerritories() below no longer classifies territory
// availability itself (that was a second, cruder interpretation of the same
// evidence api/_lib/territory-intelligence.js already classifies — see
// governance/PHASE_5_3_TERRITORY_INTELLIGENCE_CONSOLIDATION_CERTIFICATION_REPORT.md
// Legacy Inventory #3). It now calls the Engine and down-maps its 5-state
// result into this file's existing legacy shape.
import { assembleTerritoryIntelligence, TerritoryState } from '../../api/_lib/territory-intelligence.js';

// ── Internal helpers — structural extraction only ─────────────────────────────

// Extract the first artist node from an Apple Music artist API response.
// Handles two response shapes:
//   Direct lookup:  { data: [{ id, type: 'artists', attributes: {...} }] }
//   Search result:  { results: { artists: { data: [{ id, type: 'artists', attributes: {...} }] } } }
function extractArtistNode(payload) {
  if (!payload || typeof payload !== 'object') return null;
  if (Array.isArray(payload.data)) {
    return payload.data.find(n => n?.type === 'artists') ?? null;
  }
  const searchData = payload.results?.artists?.data;
  if (Array.isArray(searchData) && searchData.length > 0) return searchData[0];
  return null;
}

// Find the first package whose evidenceType matches any of the given types
// and whose contract has a non-empty payload.
function findFirst(packages, ...types) {
  const typeSet = new Set(types);
  return packages.find(
    p => typeSet.has(p.evidenceType)
      && p.contract.completeness !== 'empty'
      && p.contract.payload != null,
  ) ?? null;
}

// Find the first package from a specific provider matching any of the given types.
// Required when multiple providers supply the same evidence type (e.g. ARTIST_IDENTITY).
function findFirstByProvider(packages, provider, ...types) {
  const typeSet = new Set(types);
  return packages.find(
    p => p.contract?.provider === provider
      && typeSet.has(p.evidenceType)
      && p.contract.completeness !== 'empty'
      && p.contract.payload != null,
  ) ?? null;
}

// ── Shape translation functions ───────────────────────────────────────────────

// Translate ARTIST_IDENTITY / GENRES contract payload into the
// subject, source, and platforms.appleMusic fields that:
//   - assembleCio  reads for identity and provider observations
//   - applyIdentityAnchor reads for Apple-as-canonical reconciliation
function translateArtistIdentity(packages, canonical) {
  const pkg = findFirst(packages, Capability.ARTIST_IDENTITY, Capability.GENRES);
  if (!pkg) return;

  const artist = extractArtistNode(pkg.contract.payload);
  if (!artist) return;
  const attrs = artist.attributes ?? {};

  canonical.subject ??= {};
  canonical.subject.artistName = attrs.name   ?? null;
  canonical.subject.artistId   = artist.id    ?? null;

  canonical.source ??= {};
  canonical.source.platform   = 'apple_music';
  canonical.source.storefront = 'us';  // BIG6 default storefront for Phase 2.4

  canonical.platforms             ??= {};
  canonical.platforms.appleMusic  ??= {};
  canonical.platforms.appleMusic.details ??= {};

  const am  = canonical.platforms.appleMusic;
  const det = am.details;

  // Fields read by applyIdentityAnchor (Step 3 in runRIE)
  am.artistName = attrs.name          ?? null;
  am.artistId   = artist.id           ?? null;
  am.genres     = attrs.genreNames    ?? [];
  am.artworkUrl = attrs.artwork?.url  ?? null;
  am.profileUrl = attrs.url           ?? null;

  // Fields read by assembleCio (Steps 4-5 in runRIE)
  am.availability = pkg.contract.completeness !== 'empty' ? 'VERIFIED' : 'NOT_FOUND';
  det.artistId    = artist.id          ?? null;
  det.artistUrl   = attrs.url          ?? null;
  det.artwork     = attrs.artwork?.url ?? null;
}

// Translate ALBUMS / RELEASES contract payload into the
// platforms.appleMusic.details.albums[] array that assembleCatalogIntelligence reads.
function translateAlbums(packages, canonical) {
  const pkg = findFirst(packages, Capability.ALBUMS, Capability.RELEASES);
  if (!pkg) return;

  const data = pkg.contract.payload?.data;
  if (!Array.isArray(data)) return;

  canonical.platforms             ??= {};
  canonical.platforms.appleMusic  ??= {};
  canonical.platforms.appleMusic.details ??= {};

  canonical.platforms.appleMusic.details.albums = data
    .filter(n => n?.type === 'albums')
    .map(n => ({
      id:          n.id                       ?? null,
      name:        n.attributes?.name         ?? null,
      releaseDate: n.attributes?.releaseDate  ?? null,
      trackCount:  n.attributes?.trackCount   ?? 0,
      artwork:     n.attributes?.artwork?.url ?? null,
      upc:         n.attributes?.upc          ?? null,
      recordLabel: n.attributes?.recordLabel  ?? null,
    }));
}

// Translate TERRITORIES / AVAILABILITY contract payload into the
// platforms.appleMusic.details.globalStorefrontAvailability shape that
// assembleGlobalMusicFootprint's legacy fallback path reads:
//   { available: string[], unavailable: string[], errors: Array<{sf,error}>, total: number }
//
// Phase 5.4: this shape is now derived from the Territory Intelligence
// Engine's™ own 5-state classification (Board-ratified — Phase 5.2) rather
// than an independent structural re-interpretation of the raw evidence.
// EvidenceBridge no longer decides AVAILABLE/UNAVAILABLE itself; it only
// down-maps the Engine's already-decided state into this legacy 3-bucket
// shape, preserving the existing payload contract exactly:
//   AVAILABLE                       → available[]
//   UNAVAILABLE                     → unavailable[]
//   UNKNOWN / NOT_EVALUATED / ERROR → unavailable[] (matches the prior
//     catch-all "not confirmed available" semantic exactly — this shape
//     predates the 5-state model and has no slot for the extra states)
//   ERROR                           → additionally recorded in errors[]
//     (matches the prior error-tracking behavior)
//
// The Engine is a pure, in-memory function of `packages` with no network
// calls — invoking it here is not a second acquisition, only a second
// (now-authoritative-sourced) classification pass. A future phase could
// thread a single precomputed result through instead of calling it at each
// bridge site; out of Phase 5.4's scope, which is limited to removing the
// independent classification, not restructuring the pipeline's call graph.
function translateTerritories(packages, canonical) {
  const pkg = findFirst(packages, Capability.TERRITORIES, Capability.AVAILABILITY);
  if (!pkg) return;

  const storefronts = pkg.contract.payload?.storefronts;
  if (!storefronts || typeof storefronts !== 'object') return;

  canonical.platforms             ??= {};
  canonical.platforms.appleMusic  ??= {};
  canonical.platforms.appleMusic.details ??= {};

  const engineReport = assembleTerritoryIntelligence(packages);
  const stateByCode = new Map(
    (engineReport?.territories ?? []).map(t => [t.code, t.state])
  );

  const available   = [];
  const unavailable = [];
  const errors      = [];

  for (const sf of Object.keys(storefronts)) {
    const code  = sf.toLowerCase();
    const state = stateByCode.get(code) ?? TerritoryState.UNKNOWN;
    if (state === TerritoryState.AVAILABLE) {
      available.push(sf);
    } else {
      unavailable.push(sf);
      if (state === TerritoryState.ERROR) {
        const evidenceEntry = engineReport?.territories
          ?.find(t => t.code === code)?.evidence?.[0];
        errors.push({ sf, error: evidenceEntry?.detail || 'provider_request_failed' });
      }
    }
  }

  canonical.platforms.appleMusic.details.globalStorefrontAvailability = {
    available,
    unavailable,
    errors,
    total: available.length + unavailable.length,
  };
}

// ── Spotify shape translation functions ──────────────────────────────────────

const SPOTIFY_PROVIDER = 'spotify';

// Translate Spotify ARTIST_IDENTITY contract payload into platforms.spotify.*.
// Spotify artist response: { id, name, genres, images, followers: { total }, popularity, external_urls }
function translateSpotifyArtistIdentity(packages, canonical) {
  const pkg = findFirstByProvider(packages, SPOTIFY_PROVIDER, Capability.ARTIST_IDENTITY, Capability.GENRES, Capability.ARTWORK);
  if (!pkg) return;

  const p = pkg.contract.payload;
  if (!p || typeof p !== 'object') return;

  canonical.platforms           ??= {};
  canonical.platforms.spotify   ??= {};
  canonical.platforms.spotify.details ??= {};

  const sp  = canonical.platforms.spotify;
  const det = sp.details;

  sp.availability = 'VERIFIED';
  sp.artistId     = p.id   ?? null;
  sp.artistName   = p.name ?? null;
  sp.genres       = Array.isArray(p.genres) ? p.genres : [];
  sp.imageUrl     = Array.isArray(p.images) && p.images.length ? p.images[0].url ?? null : null;
  sp.profileUrl   = p.external_urls?.spotify ?? null;

  det.artistId   = p.id   ?? null;
  det.artistUrl  = p.external_urls?.spotify ?? null;
  det.followers  = typeof p.followers?.total === 'number' ? p.followers.total : null;
  det.popularity = typeof p.popularity === 'number' ? p.popularity : null;
  det.genres     = Array.isArray(p.genres) ? p.genres : [];
  det.images     = Array.isArray(p.images) ? p.images : [];
}

// Translate Spotify ALBUMS contract payload into platforms.spotify.details.albums[].
// Spotify albums response: { items: [{ id, name, album_type, release_date, total_tracks, images, ... }] }
function translateSpotifyAlbums(packages, canonical) {
  const pkg = findFirstByProvider(packages, SPOTIFY_PROVIDER, Capability.ALBUMS, Capability.RELEASES);
  if (!pkg) return;

  const items = pkg.contract.payload?.items;
  if (!Array.isArray(items)) return;

  canonical.platforms           ??= {};
  canonical.platforms.spotify   ??= {};
  canonical.platforms.spotify.details ??= {};

  canonical.platforms.spotify.details.albums = items;
}

// Translate Spotify TRACKS contract payload into platforms.spotify.details.topTracks[].
// Spotify top-tracks response: { tracks: [{ id, name, external_ids: { isrc }, artists, preview_url, ... }] }
function translateSpotifyTopTracks(packages, canonical) {
  const pkg = findFirstByProvider(packages, SPOTIFY_PROVIDER, Capability.TRACKS);
  if (!pkg) return;

  const tracks = pkg.contract.payload?.tracks;
  if (!Array.isArray(tracks)) return;

  canonical.platforms           ??= {};
  canonical.platforms.spotify   ??= {};
  canonical.platforms.spotify.details ??= {};

  canonical.platforms.spotify.details.topTracks = tracks.map(t => ({
    id:         t.id                   ?? null,
    name:       t.name                 ?? null,
    isrc:       t.external_ids?.isrc   ?? null,
    artistName: t.artists?.[0]?.name   ?? null,
    previewUrl: t.preview_url          ?? null,
    popularity: typeof t.popularity === 'number' ? t.popularity : null,
  }));
}

// ── MusicBrainz shape translation functions — Phase 3.8 ─────────────────────

const MB_PROVIDER = 'musicbrainz';

// Translate MusicBrainz ARTIST_IDENTITY payload into platforms.musicbrainz.*.
//
// Two payload shapes:
//   Search result:  { artists: [{ id, name, score, aliases[], tags[] }] }
//   Direct lookup:  { id, name, aliases[], tags[], 'sort-name', country, ... }
//
// We extract: mbid, name, aliases (international names), tags (genres), country.
function translateMBArtistIdentity(packages, canonical) {
  const pkg = findFirstByProvider(packages, MB_PROVIDER, Capability.ARTIST_IDENTITY);
  if (!pkg) return;

  const p = pkg.contract.payload;
  if (!p || typeof p !== 'object') return;

  // Determine which shape we have
  let artist = null;
  if (typeof p.id === 'string') {
    // Direct lookup response
    artist = p;
  } else if (Array.isArray(p.artists) && p.artists.length > 0) {
    // Search result — use first artist (PAL acquisition uses exact-name match upstream)
    artist = p.artists[0];
  }
  if (!artist) return;

  canonical.platforms                 ??= {};
  canonical.platforms.musicbrainz     ??= {};
  canonical.platforms.musicbrainz.details ??= {};

  const mb  = canonical.platforms.musicbrainz;
  const det = mb.details;

  mb.availability = 'VERIFIED';
  mb.mbid         = artist.id       ?? null;
  mb.artistName   = artist.name     ?? null;
  mb.sortName     = artist['sort-name'] ?? null;
  mb.country      = artist.country  ?? null;
  mb.score        = typeof artist.score === 'number' ? artist.score : null;

  // Aliases — international names, historical names, alternate spellings
  mb.aliases = Array.isArray(artist.aliases)
    ? artist.aliases.map(a => ({
        name:   a.name    ?? null,
        locale: a.locale  ?? null,
        type:   a.type    ?? null,
      }))
    : [];

  // Tags — genre and category annotations from the MusicBrainz community
  mb.tags = Array.isArray(artist.tags)
    ? artist.tags.map(t => ({ name: t.name ?? null, count: t.count ?? 0 }))
    : [];

  // Detail fields for Identity Intelligence consumers
  det.mbid      = artist.id       ?? null;
  det.sortName  = artist['sort-name'] ?? null;
  det.country   = artist.country  ?? null;
  det.lifeSpan  = artist['life-span'] ?? null;
  det.type      = artist.type     ?? null;
}

// Translate MusicBrainz TRACKS payload into platforms.musicbrainz.details.recordings[].
// MusicBrainz recordings response: { recordings: [{ id, title, length, isrcs[], ... }] }
function translateMBRecordings(packages, canonical) {
  const pkg = findFirstByProvider(packages, MB_PROVIDER, Capability.TRACKS);
  if (!pkg) return;

  const recordings = pkg.contract.payload?.recordings;
  if (!Array.isArray(recordings)) return;

  canonical.platforms                 ??= {};
  canonical.platforms.musicbrainz     ??= {};
  canonical.platforms.musicbrainz.details ??= {};

  canonical.platforms.musicbrainz.details.recordings = recordings.map(r => ({
    id:     r.id     ?? null,
    title:  r.title  ?? null,
    length: typeof r.length === 'number' ? r.length : null,
    isrcs:  Array.isArray(r.isrcs) ? r.isrcs : [],
  }));
}

// Translate MusicBrainz RELEASES payload into platforms.musicbrainz.details.releaseGroups[].
// MusicBrainz release-groups response: { 'release-groups': [{ id, title, primary-type, first-release-date }] }
function translateMBReleaseGroups(packages, canonical) {
  const pkg = findFirstByProvider(packages, MB_PROVIDER, Capability.RELEASES);
  if (!pkg) return;

  const groups = pkg.contract.payload?.['release-groups'];
  if (!Array.isArray(groups)) return;

  canonical.platforms                 ??= {};
  canonical.platforms.musicbrainz     ??= {};
  canonical.platforms.musicbrainz.details ??= {};

  canonical.platforms.musicbrainz.details.releaseGroups = groups.map(g => ({
    id:               g.id                      ?? null,
    title:            g.title                   ?? null,
    primaryType:      g['primary-type']         ?? null,
    secondaryTypes:   Array.isArray(g['secondary-types']) ? g['secondary-types'] : [],
    firstReleaseDate: g['first-release-date']   ?? null,
  }));
}

// ── Discogs shape translation functions — Phase 3.6 (Discogs) ────────────────

const DISCOGS_PROVIDER = 'discogs';

// Translate Discogs ARTIST_IDENTITY payload into platforms.discogs.*.
//
// Two payload shapes:
//   Search result:  { results: [{ id, type, title, thumb, uri, resource_url }] }
//   Direct lookup:  { id, name, profile, urls, images, aliases, namevariations, members, groups }
//
// Identity-lock: only the exact-name-matched artist from search is used;
// that resolution happens in acquireDiscogsEvidence before this bridge is called.
// The direct lookup payload is what arrives after identity resolution.
function translateDiscogsArtistIdentity(packages, canonical) {
  const pkg = findFirstByProvider(packages, DISCOGS_PROVIDER, Capability.ARTIST_IDENTITY);
  if (!pkg) return;

  const p = pkg.contract.payload;
  if (!p || typeof p !== 'object') return;

  canonical.platforms             ??= {};
  canonical.platforms.discogs     ??= {};
  canonical.platforms.discogs.details ??= {};

  const dc  = canonical.platforms.discogs;

  // Determine payload shape
  if (typeof p.id !== 'undefined' && typeof p.name === 'string') {
    // Direct lookup response (full artist profile)
    dc.availability   = 'VERIFIED';
    dc.artistId       = p.id    ?? null;
    dc.artistName     = p.name  ?? null;
    dc.profile        = typeof p.profile === 'string' ? p.profile : null;
    dc.resourceUrl    = p.resource_url ?? null;
    dc.uri            = p.uri          ?? null;
    dc.dataQuality    = p.data_quality ?? null;

    dc.urls           = Array.isArray(p.urls)            ? p.urls            : [];
    dc.images         = Array.isArray(p.images)          ? p.images          : [];
    dc.aliases        = Array.isArray(p.aliases)         ? p.aliases         : [];
    dc.namevariations = Array.isArray(p.namevariations)  ? p.namevariations  : [];
    dc.members        = Array.isArray(p.members)         ? p.members         : [];
    dc.groups         = Array.isArray(p.groups)          ? p.groups          : [];

    dc.details.artistId = p.id ?? null;

  } else if (Array.isArray(p.results) && p.results.length > 0) {
    // Search result response — take the first result
    // (acquireDiscogsEvidence performed identity-lock before reaching this bridge)
    const r = p.results[0];
    dc.availability   = 'VERIFIED';
    dc.artistId       = r.id    ?? null;
    dc.artistName     = r.title ?? null;
    dc.thumb          = r.thumb ?? null;
    dc.resourceUrl    = r.resource_url ?? null;
    dc.uri            = r.uri          ?? null;

    dc.details.artistId = r.id ?? null;
  }
}

// Translate Discogs RELEASES payload into platforms.discogs.details.releases[].
//
// Discogs releases response:
// {
//   releases: [{ id, type, main_release, artist, role, resource_url, title, year,
//                thumb, stats, label, format, catno }],
//   pagination: { per_page, items, page, urls, pages }
// }
//
// Each release carries embedded label, format, and catalog number fields.
// Preserve all fields — future Catalog Intelligence™ consumes this evidence.
function translateDiscogsReleases(packages, canonical) {
  const pkg = findFirstByProvider(packages, DISCOGS_PROVIDER, Capability.RELEASES);
  if (!pkg) return;

  const payload = pkg.contract.payload;
  if (!payload || typeof payload !== 'object') return;

  canonical.platforms             ??= {};
  canonical.platforms.discogs     ??= {};
  canonical.platforms.discogs.details ??= {};

  const det = canonical.platforms.discogs.details;

  // Preserve full pagination metadata — consumers can determine total release count
  det.totalReleases = payload.pagination?.items ?? null;
  det.releasesPage  = payload.pagination?.page  ?? null;
  det.releasesPages = payload.pagination?.pages ?? null;

  const releases = Array.isArray(payload.releases) ? payload.releases : [];

  det.releases = releases.map(r => ({
    id:           r.id           ?? null,
    type:         r.type         ?? null,    // 'release' | 'master'
    mainRelease:  r.main_release ?? null,    // master → main release ID
    title:        r.title        ?? null,
    year:         typeof r.year === 'number' ? r.year : null,
    artist:       r.artist       ?? null,
    role:         r.role         ?? null,    // 'Main' | 'Appearance' | 'TrackAppearance' | ...
    label:        r.label        ?? null,    // label name (string from Discogs search result)
    format:       r.format       ?? null,    // 'Vinyl', 'CD', 'Cassette', 'Digital', ...
    catno:        r.catno        ?? null,    // catalog number string
    thumb:        r.thumb        ?? null,
    resourceUrl:  r.resource_url ?? null,
    stats:        r.stats        ?? null,    // community collection / wantlist counts
  }));
}

// ── YouTube shape translation functions — Phase 3.6 (YouTube) ────────────────
//
// YouTube (provider: 'youtube'):
//   ARTIST_IDENTITY → search.list OR channels.list (snippet only)
//     Search path:  { items: [{ id: { channelId }, snippet: { channelId, channelTitle } }] }
//     Direct path:  { items: [{ id: "UC...", snippet: { title, customUrl } }] }
//   COLLECTION_DATA → channels.list (full parts)
//     { items: [{ id, snippet, statistics, topicDetails, brandingSettings, contentDetails }] }
//
// The bridge does not apply identity-lock — it translates whatever the evidence says.
// Identity-lock was already applied in youtube-pal-acquisition.js before these packages
// were produced.

const YOUTUBE_PROVIDER = 'youtube';

// YouTube ARTIST_IDENTITY: channel search or direct snippet lookup.
function translateYouTubeChannelIdentity(packages, canonical) {
  const pkg = findFirstByProvider(packages, YOUTUBE_PROVIDER, Capability.ARTIST_IDENTITY);
  if (!pkg) return;

  const payload = pkg.contract.payload;
  if (!payload || typeof payload !== 'object') return;

  const items = Array.isArray(payload.items) ? payload.items : [];
  if (items.length === 0) return;

  canonical.platforms          ??= {};
  canonical.platforms.youtube  ??= {};

  const yt = canonical.platforms.youtube;

  // Determine if direct channel lookup (id is a string "UC...") or search result
  const firstId     = items[0]?.id;
  const isDirectLookup = typeof firstId === 'string' && firstId.startsWith('UC');

  if (isDirectLookup) {
    // channels.list?part=snippet: { id: "UC...", snippet: { title, customUrl, country } }
    const item = items[0];
    yt.channelId    = item.id ?? null;
    yt.channelTitle = item.snippet?.title ?? null;
    yt.customUrl    = item.snippet?.customUrl ?? null;
    yt.country      = item.snippet?.country ?? null;
    yt.channelSource = 'royalte_identity_graph';
  } else {
    // search.list: { id: { channelId }, snippet: { channelId, channelTitle } }
    // Use first item — identity-lock was applied before acquisition
    const item = items[0];
    yt.channelId    = item.id?.channelId ?? item.snippet?.channelId ?? null;
    yt.channelTitle = item.snippet?.channelTitle ?? null;
    yt.customUrl    = null;
    yt.country      = item.snippet?.defaultAudioLanguage ?? null;
    yt.channelSource = 'strict_name_match';
  }

  // Preserve all search result items for audit trail
  yt.searchResults = items.length > 1 ? items : null;
}

// YouTube COLLECTION_DATA: full channel details.
// channels.list?part=snippet,statistics,topicDetails,brandingSettings,contentDetails
function translateYouTubeChannelData(packages, canonical) {
  const pkg = findFirstByProvider(packages, YOUTUBE_PROVIDER, Capability.COLLECTION_DATA);
  if (!pkg) return;

  const payload = pkg.contract.payload;
  if (!payload || typeof payload !== 'object') return;

  const item = Array.isArray(payload.items) ? payload.items[0] : null;
  if (!item) return;

  canonical.platforms          ??= {};
  canonical.platforms.youtube  ??= {};
  canonical.platforms.youtube.details ??= {};

  const det = canonical.platforms.youtube.details;

  // Statistics
  const stats = item.statistics ?? {};
  det.subscriberCount        = parseInt(stats.subscriberCount ?? 0) || 0;
  det.viewCount              = parseInt(stats.viewCount       ?? 0) || 0;
  det.videoCount             = parseInt(stats.videoCount      ?? 0) || 0;
  det.hiddenSubscriberCount  = stats.hiddenSubscriberCount === 'true' ||
                               stats.hiddenSubscriberCount === true;

  // Topic categories (OAC and music topic detection)
  // e.g. ["https://en.wikipedia.org/wiki/Music", "https://en.wikipedia.org/wiki/Pop_music"]
  det.topicCategories = Array.isArray(item.topicDetails?.topicCategories)
    ? item.topicDetails.topicCategories
    : null;

  // Branding settings — banner, profile image, keywords, etc.
  const channel = item.brandingSettings?.channel ?? {};
  det.brandingTitle       = channel.title          ?? null;
  det.brandingDescription = channel.description    ?? null;
  det.brandingKeywords    = channel.keywords        ?? null;
  det.brandingCountry     = channel.country         ?? null;
  det.bannerImageUrl      = item.brandingSettings?.image?.bannerExternalUrl ?? null;

  // Content details — uploads playlist ID
  det.uploadsPlaylistId = item.contentDetails?.relatedPlaylists?.uploads ?? null;

  // Snippet (title here is authoritative — channel can be renamed)
  det.title        = item.snippet?.title       ?? null;
  det.description  = item.snippet?.description ?? null;
  det.customUrl    = item.snippet?.customUrl   ?? null;
  det.publishedAt  = item.snippet?.publishedAt ?? null;
  det.country      = item.snippet?.country     ?? null;
  det.thumbnails   = item.snippet?.thumbnails  ?? null;
}

// ── MLC shape translation functions — Phase 3.6 (The MLC) ────────────────────
//
// The MLC (provider: 'mlc'):
//   ISRC      → POST /search/recordings response
//     Array of Recording: [{ id, title, artist, isrc, mlcsongCode, labels }]
//     Note: mlcsongCode uses lowercase 's' in this response.
//
//   PUBLISHING → POST /works response
//     Array of Work: [{ primaryTitle, mlcSongCode, iswc, membersSongId, artists,
//                       akas[], writers[], publishers[] }]
//     Note: mlcSongCode uses uppercase 'S' in this response.
//
// EVIDENCE PRESERVATION PRINCIPLE: Raw arrays are stored intact.
// The Board-locked normalizeMlcWork() in lib/publishing/mlc-adapter.js
// is invoked by intelligence domains, never by the bridge.
// The bridge never calls or depends on the adapter.

const MLC_PROVIDER = 'mlc';

// MLC ISRC: recording search results.
// Preserves the full Recording array — all fields, including labels and linked song codes.
// Also surfaces a summary count for quick consumer access.
function translateMLCRecordings(packages, canonical) {
  const pkg = findFirstByProvider(packages, MLC_PROVIDER, Capability.ISRC);
  if (!pkg) return;

  const payload = pkg.contract.payload;
  if (!Array.isArray(payload)) return;

  canonical.platforms       ??= {};
  canonical.platforms.mlc   ??= {};

  const mlc = canonical.platforms.mlc;

  mlc.recordings      = payload;
  mlc.recordingCount  = payload.length;

  // Extract the set of unique MLC song codes for consumer convenience.
  // Consumers use this to cross-reference to /works data in platforms.mlc.details.works.
  const codes = payload
    .map(r => r?.mlcsongCode ?? null)
    .filter(c => typeof c === 'string' && c.trim().length > 0);
  mlc.mlcSongCodes = [...new Set(codes)];
}

// MLC PUBLISHING: full work details.
// Preserves the complete Work array — publishers, writers, ISWC, AKAs, artists.
// Normalization by normalizeMlcWork() is deferred to Publishing Intelligence domain.
function translateMLCWorks(packages, canonical) {
  const pkg = findFirstByProvider(packages, MLC_PROVIDER, Capability.PUBLISHING);
  if (!pkg) return;

  const payload = pkg.contract.payload;
  if (!Array.isArray(payload)) return;

  canonical.platforms            ??= {};
  canonical.platforms.mlc        ??= {};
  canonical.platforms.mlc.details ??= {};

  const det = canonical.platforms.mlc.details;

  // Preserve the full Work array with its natural publisher/writer/AKA hierarchy intact.
  // Board Amendment (Phase 3.6-MLC): do not flatten publishers, ISWCs, or writers
  // into top-level aggregate arrays — the hierarchy Recording → Song Code → Work →
  // Publishers/Songwriters must be preserved as nested structure for future intelligence.
  det.works     = payload;
  det.workCount = payload.length;
}

// ──────────────────────────────────────────────────────────────────────────────
// Deezer translations — Phase 3.6 Provider Expansion 07
//
// Deezer is Royaltē's Streaming Verification Authority™.
// Evidence is preserved in full for future Verification Intelligence™ which
// may cross-reference these fields against Apple Music and Spotify evidence.
// ──────────────────────────────────────────────────────────────────────────────

const DEEZER_PROVIDER = 'deezer';

// Deezer ARTIST_IDENTITY: artist detail object.
// Preserves all artwork sizes, fan count, album count, and metadata.
function translateDeezerArtistIdentity(packages, canonical) {
  const pkg = findFirstByProvider(packages, DEEZER_PROVIDER, Capability.ARTIST_IDENTITY);
  if (!pkg) return;

  const payload = pkg.contract.payload;
  if (!payload || typeof payload !== 'object' || !payload.id) return;

  canonical.platforms        ??= {};
  canonical.platforms.deezer ??= {};

  const deezer       = canonical.platforms.deezer;
  deezer.artistId    = payload.id       ?? null;
  deezer.name        = payload.name     ?? null;
  deezer.link        = payload.link     ?? null;
  deezer.fans        = typeof payload.nb_fan   === 'number' ? payload.nb_fan   : null;
  deezer.nbAlbum     = typeof payload.nb_album === 'number' ? payload.nb_album : null;
  deezer.radio       = typeof payload.radio    === 'boolean' ? payload.radio   : !!payload.radio;
  deezer.tracklist   = payload.tracklist ?? null;
  deezer.artwork     = {
    picture:        payload.picture        ?? null,
    picture_small:  payload.picture_small  ?? null,
    picture_medium: payload.picture_medium ?? null,
    picture_big:    payload.picture_big    ?? null,
    picture_xl:     payload.picture_xl     ?? null,
  };
}

// Deezer ALBUMS: full discography response (data array + total).
// Preserves the raw album objects including release_date, record_type, explicit flags.
function translateDeezerAlbums(packages, canonical) {
  const pkg = findFirstByProvider(packages, DEEZER_PROVIDER, Capability.ALBUMS);
  if (!pkg) return;

  const payload = pkg.contract.payload;
  if (!payload || !Array.isArray(payload.data)) return;

  canonical.platforms        ??= {};
  canonical.platforms.deezer ??= {};

  canonical.platforms.deezer.albums     = payload.data;
  canonical.platforms.deezer.albumCount = typeof payload.total === 'number'
    ? payload.total
    : payload.data.length;

  // Collect unique genre names from album genre tags for quick consumer access.
  // Full genre objects preserved in albums[].genres.data.
  const genreSet = new Set();
  for (const album of payload.data) {
    if (Array.isArray(album.genres?.data)) {
      for (const g of album.genres.data) {
        if (g.name) genreSet.add(g.name);
      }
    }
  }
  canonical.platforms.deezer.genres = [...genreSet];
}

// Deezer TRACKS: top 50 tracks response.
// Preserves full track objects including ISRC fields where available.
// ISRCs extracted for constitutional cross-reference convenience.
function translateDeezerTopTracks(packages, canonical) {
  const pkg = findFirstByProvider(packages, DEEZER_PROVIDER, Capability.TRACKS);
  if (!pkg) return;

  const payload = pkg.contract.payload;
  if (!payload || !Array.isArray(payload.data)) return;

  canonical.platforms        ??= {};
  canonical.platforms.deezer ??= {};

  canonical.platforms.deezer.topTracks  = payload.data;
  canonical.platforms.deezer.trackCount = payload.data.length;

  // Extract ISRCs where present — constitutional bridge for future Verification Intelligence.
  const isrcs = payload.data
    .map(t => t?.isrc ?? null)
    .filter(i => typeof i === 'string' && i.trim().length > 0);
  canonical.platforms.deezer.isrcs = [...new Set(isrcs)];
}

// ──────────────────────────────────────────────────────────────────────────────
// TheAudioDB translations — Phase 3.6 Provider Expansion 08
//
// TheAudioDB is Royaltē's Artist & Media Intelligence Authority™.
// Evidence is preserved in full for future Artist Intelligence™ and
// Brand Intelligence™ — biography, artwork, logos, fan art, social links.
// ──────────────────────────────────────────────────────────────────────────────

const AUDIODB_PROVIDER = 'audiodb';

// TheAudioDB's strTwitter field now returns the literal string "1" for
// every artist tested (live-verified 2026-07-17, not a URL) rather than
// being absent — a stub/flag value that would otherwise flow through as if
// it were a real social link. Everything else passes through unchanged;
// this filters exactly the one confirmed-bad value, not a general pattern.
function normalizeAudioDBTwitter(value) {
  return value === '1' ? null : (value ?? null);
}

// TheAudioDB ARTIST_IDENTITY: full artist object from search.php.
//
// Board Amendment 1–4 (2026-07-03): constitutional media namespace established.
// platforms.audiodb structure:
//   artistId / name  — top-level for cross-referencing
//   profile          — descriptive artist information (biography, country, genre, etc.)
//   media            — presentation assets (thumbnails, logos, banners, fanArt, social, videos)
//   discography      — populated by translateAudioDBDiscography
//   statistics       — reserved for future domain
//
// Each image type is preserved independently (Amendment 4).
// biography is preserved in full — never truncated at the bridge layer (Amendment 3 & 5).
// This structure is the constitutional reference model for future media-rich providers (Amendment 6).
function translateAudioDBArtistProfile(packages, canonical) {
  const pkg = findFirstByProvider(packages, AUDIODB_PROVIDER, Capability.ARTIST_IDENTITY);
  if (!pkg) return;

  const a = pkg.contract.payload;
  if (!a || typeof a !== 'object' || !a.idArtist) return;

  canonical.platforms         ??= {};
  canonical.platforms.audiodb ??= {};
  const audiodb = canonical.platforms.audiodb;

  // Top-level identity — available without descending into profile
  audiodb.artistId = a.idArtist  ?? null;
  audiodb.name     = a.strArtist ?? null;

  // Profile — descriptive artist information
  audiodb.profile = {
    // TheAudioDB renamed strBiographyEN -> strBiography (live-verified
    // 2026-07-17; English no longer gets a language suffix, other
    // languages e.g. strBiographyDE kept theirs) — see Phase 4.0 AudioDB
    // modernization completion report for the full drift findings.
    biography: a.strBiography    ?? null,   // full text; compat synthesis truncates for V1
    country:   a.strCountry      ?? null,
    formed:    a.intFormedYear   ?? null,
    label:     a.strLabel        ?? null,
    genre:     a.strGenre        ?? null,
    style:     a.strStyle        ?? null,
    mood:      a.strMood         ?? null,
  };

  // Media — presentation assets; each image type preserved independently (Amendment 4)
  audiodb.media = {
    thumbnails: {
      thumb:     a.strArtistThumb     ?? null,
      wideThumb: a.strArtistWideThumb ?? null,
    },
    logos: {
      logo:     a.strArtistLogo     ?? null,
      clearart: a.strArtistClearart ?? null,
    },
    banners: {
      banner: a.strArtistBanner ?? null,
    },
    fanArt: {
      fanart:  a.strArtistFanart  ?? null,
      fanart2: a.strArtistFanart2 ?? null,
      fanart3: a.strArtistFanart3 ?? null,
      fanart4: a.strArtistFanart4 ?? null,
    },
    videos: [],   // populated by translateAudioDBVideos
    // strYoutube and strInstagram no longer exist on TheAudioDB's artist
    // object at all (confirmed absent, not just empty, live-verified
    // 2026-07-17 across 4 artists) — these two will read as null until the
    // provider re-exposes the data, under this or another field name.
    // strTwitter still exists but its value is now the literal string "1"
    // for every artist tested, not a URL — normalizeAudioDBTwitter() treats
    // that specific known-bad value as absent rather than exposing it as a
    // social link.
    social: {
      website:   a.strWebsite   ?? null,
      youtube:   a.strYoutube   ?? null,
      facebook:  a.strFacebook  ?? null,
      twitter:   normalizeAudioDBTwitter(a.strTwitter),
      instagram: a.strInstagram ?? null,
    },
  };

  audiodb.discography = [];    // populated by translateAudioDBDiscography
  audiodb.statistics  = {};    // reserved — future intelligence domain
}

// TheAudioDB COLLECTION_DATA: discography response.
// Payload shape: { album: [ { idAlbum, strAlbum, intYearReleased, strLabel, ... } ] }
// Populates platforms.audiodb.discography and albumCount.
function translateAudioDBDiscography(packages, canonical) {
  const pkg = findFirstByProvider(packages, AUDIODB_PROVIDER, Capability.COLLECTION_DATA);
  if (!pkg) return;

  const payload = pkg.contract.payload;
  if (!payload || typeof payload !== 'object') return;

  canonical.platforms         ??= {};
  canonical.platforms.audiodb ??= {};

  const albums = Array.isArray(payload.album) ? payload.album : [];
  canonical.platforms.audiodb.discography = albums;
  canonical.platforms.audiodb.albumCount  = albums.length;
}

// TheAudioDB VIDEOS: music video metadata.
// Payload shape: { mvids: [ { idMVid, strTrack, strMusicVid, strDescriptionEN, ... } ] }
// Populates platforms.audiodb.media.videos and videoCount.
// If ARTIST_IDENTITY was not acquired, initializes media.videos at root level.
function translateAudioDBVideos(packages, canonical) {
  const pkg = findFirstByProvider(packages, AUDIODB_PROVIDER, Capability.VIDEOS);
  if (!pkg) return;

  const payload = pkg.contract.payload;
  if (!payload || typeof payload !== 'object') return;

  canonical.platforms         ??= {};
  canonical.platforms.audiodb ??= {};

  const videos = Array.isArray(payload.mvids) ? payload.mvids : [];

  // If profile translation already ran, media.videos exists; otherwise create the path
  if (canonical.platforms.audiodb.media) {
    canonical.platforms.audiodb.media.videos = videos;
  } else {
    canonical.platforms.audiodb.media = { videos };
  }
  canonical.platforms.audiodb.videoCount = videos.length;
}

// ──────────────────────────────────────────────────────────────────────────────
// Last.fm translations — Phase 3.6 Provider Expansion 09
//
// Last.fm is Royaltē's Community Intelligence Authority™.
// Community evidence (listeners, playcount, tags, similar artists) is constitutionally
// distinct from commercial streaming. Do NOT merge with Apple Music / Spotify stats.
// Preserved independently for future Community Intelligence™ and Discovery Intelligence™.
//
// platforms.lastfm structure (follows AudioDB constitutional media namespace pattern):
//   profile    — name, url
//   community  — listeners, playcount, tags[], similarArtists[]
//   biography  — raw bio (summary + content HTML preserved; compat synthesis strips HTML)
//   media      — artist images[] (multiple sizes)
//   topTracks  — populated by translateLastFmTopTracks
//   topAlbums  — populated by translateLastFmTopAlbums
// ──────────────────────────────────────────────────────────────────────────────

const LASTFM_PROVIDER = 'lastfm';

// ARTIST_IDENTITY: artist.getinfo response.
// Carries community stats, tags, biography, similar artists, and images.
function translateLastFmArtistInfo(packages, canonical) {
  const pkg = findFirstByProvider(packages, LASTFM_PROVIDER, Capability.ARTIST_IDENTITY);
  if (!pkg) return;

  const a = pkg.contract.payload;
  if (!a || typeof a !== 'object' || !a.name) return;

  canonical.platforms         ??= {};
  canonical.platforms.lastfm  ??= {};
  const lastfm = canonical.platforms.lastfm;

  // Top-level identity — available without descending into profile
  lastfm.name = a.name ?? null;
  lastfm.url  = a.url  ?? null;

  // Profile — identity information
  lastfm.profile = {
    name: a.name ?? null,
    url:  a.url  ?? null,
    mbid: a.mbid ?? null,   // MusicBrainz ID when available — cross-reference bridge
  };

  // Community — listeners, playcount, similar artists, tags
  // Community evidence is constitutionally independent. Never merge with streaming counts.
  lastfm.community = {
    listeners:      parseInt(a.stats?.listeners ?? 0, 10) || 0,
    playcount:      parseInt(a.stats?.playcount  ?? 0, 10) || 0,
    tags:           Array.isArray(a.tags?.tag)
                      ? a.tags.tag.map(t => ({ name: t.name, url: t.url ?? null }))
                      : [],
    similarArtists: Array.isArray(a.similar?.artist)
                      ? a.similar.artist.map(s => ({
                          name:   s.name   ?? null,
                          url:    s.url    ?? null,
                          images: Array.isArray(s.image) ? s.image : [],
                        }))
                      : [],
  };

  // Biography — raw HTML preserved; compat synthesis strips HTML and truncates
  lastfm.biography = {
    summary:   a.bio?.summary   ?? null,   // short HTML summary
    content:   a.bio?.content   ?? null,   // full HTML bio
    published: a.bio?.published ?? null,
    links:     a.bio?.links     ?? null,
  };

  // Media — artist images at all sizes Last.fm provides
  lastfm.media = {
    images: Array.isArray(a.image) ? a.image : [],
  };

  lastfm.topTracks = [];   // populated by translateLastFmTopTracks
  lastfm.topAlbums = [];   // populated by translateLastFmTopAlbums
}

// TRACKS: artist.gettoptracks response.
// Payload shape: { track: [...], '@attr': { ... } }
function translateLastFmTopTracks(packages, canonical) {
  const pkg = findFirstByProvider(packages, LASTFM_PROVIDER, Capability.TRACKS);
  if (!pkg) return;

  const payload = pkg.contract.payload;
  if (!payload || typeof payload !== 'object') return;

  canonical.platforms         ??= {};
  canonical.platforms.lastfm  ??= {};

  const tracks = Array.isArray(payload.track) ? payload.track : [];
  canonical.platforms.lastfm.topTracks  = tracks;
  canonical.platforms.lastfm.trackCount = tracks.length;
}

// ALBUMS: artist.gettopalbums response.
// Payload shape: { album: [...], '@attr': { ... } }
function translateLastFmTopAlbums(packages, canonical) {
  const pkg = findFirstByProvider(packages, LASTFM_PROVIDER, Capability.ALBUMS);
  if (!pkg) return;

  const payload = pkg.contract.payload;
  if (!payload || typeof payload !== 'object') return;

  canonical.platforms         ??= {};
  canonical.platforms.lastfm  ??= {};

  const albums = Array.isArray(payload.album) ? payload.album : [];
  canonical.platforms.lastfm.topAlbums  = albums;
  canonical.platforms.lastfm.albumCount = albums.length;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Translate an array of validated EvidencePackages into a
 * canonicalForEnrichment-compatible object for the Phase 1 RIE assembly chain.
 *
 * STRUCTURAL SHAPE TRANSLATION ONLY. See Board Directive above.
 * Never throws — unknown or empty packages produce an empty canonical object.
 *
 * @param {Array} evidencePackages — validated EvidencePackage[]
 * @returns {object} canonicalForEnrichment-compatible object
 */
export function bridgeToCanonical(evidencePackages) {
  const canonical = {};
  // Apple Music translations (Phase 2.4)
  try { translateArtistIdentity(evidencePackages, canonical); } catch { /* never throw */ }
  try { translateAlbums(evidencePackages, canonical);         } catch { /* never throw */ }
  try { translateTerritories(evidencePackages, canonical);    } catch { /* never throw */ }
  // Spotify translations (Phase 3.6)
  try { translateSpotifyArtistIdentity(evidencePackages, canonical); } catch { /* never throw */ }
  try { translateSpotifyAlbums(evidencePackages, canonical);          } catch { /* never throw */ }
  try { translateSpotifyTopTracks(evidencePackages, canonical);        } catch { /* never throw */ }
  // MusicBrainz translations (Phase 3.8)
  try { translateMBArtistIdentity(evidencePackages, canonical); } catch { /* never throw */ }
  try { translateMBRecordings(evidencePackages, canonical);      } catch { /* never throw */ }
  try { translateMBReleaseGroups(evidencePackages, canonical);   } catch { /* never throw */ }
  // Discogs translations (Phase 3.6 — Discogs)
  try { translateDiscogsArtistIdentity(evidencePackages, canonical); } catch { /* never throw */ }
  try { translateDiscogsReleases(evidencePackages, canonical);        } catch { /* never throw */ }
  // YouTube translations (Phase 3.6 — YouTube)
  try { translateYouTubeChannelIdentity(evidencePackages, canonical); } catch { /* never throw */ }
  try { translateYouTubeChannelData(evidencePackages, canonical);      } catch { /* never throw */ }
  // MLC translations (Phase 3.6 — The MLC)
  try { translateMLCRecordings(evidencePackages, canonical); } catch { /* never throw */ }
  try { translateMLCWorks(evidencePackages, canonical);       } catch { /* never throw */ }
  // Deezer translations (Phase 3.6 — Deezer)
  try { translateDeezerArtistIdentity(evidencePackages, canonical); } catch { /* never throw */ }
  try { translateDeezerAlbums(evidencePackages, canonical);          } catch { /* never throw */ }
  try { translateDeezerTopTracks(evidencePackages, canonical);        } catch { /* never throw */ }
  // TheAudioDB translations (Phase 3.6 — TheAudioDB)
  try { translateAudioDBArtistProfile(evidencePackages, canonical); } catch { /* never throw */ }
  try { translateAudioDBDiscography(evidencePackages, canonical);    } catch { /* never throw */ }
  try { translateAudioDBVideos(evidencePackages, canonical);          } catch { /* never throw */ }
  // Last.fm translations (Phase 3.6 — Last.fm)
  try { translateLastFmArtistInfo(evidencePackages, canonical);  } catch { /* never throw */ }
  try { translateLastFmTopTracks(evidencePackages, canonical);   } catch { /* never throw */ }
  try { translateLastFmTopAlbums(evidencePackages, canonical);   } catch { /* never throw */ }
  return canonical;
}

/**
 * Extract evidence provenance metadata for the CIM's scanAuthority object.
 * Returns the lineage record required by the Board's evidence lineage directive.
 *
 * @param {Array} evidencePackages — validated EvidencePackage[]
 * @returns {{ sourceProviders, evidenceIds, connectorVersions, acquiredAts }}
 */
export function extractEvidenceLineage(evidencePackages) {
  const sourceProviders   = [...new Set(evidencePackages.map(p => p.contract.provider).filter(Boolean))];
  const evidenceIds       = evidencePackages.map(p => p.contract.evidenceId).filter(Boolean);
  const connectorVersions = [...new Set(evidencePackages.map(p => p.contract.connectorVersion).filter(Boolean))];
  const acquiredAts       = evidencePackages.map(p => p.contract.acquiredAt).filter(Boolean);
  return { sourceProviders, evidenceIds, connectorVersions, acquiredAts };
}
