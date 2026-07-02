// RIE Layer 2 — Evidence Bridge
// Phase 2.4 — migration infrastructure only.
// Phase 3.6 — Spotify translation added.
//
// Constitutional authority: Royaltē Master Constitution v1.3 §8
// Board Authorization: Phase 2.4 (2026-07-01), Phase 3.6 (2026-07-02)
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
// Unknown evidence types are silently skipped — no rejection, no error.
// The bridge never throws.

import { Capability } from '../../provider-acquisition/capability/capabilityVocabulary.js';

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

// Structural availability check: a storefront has data when the response
// includes at least one record. This is field presence, not content interpretation.
function storefrontIsAvailable(storefrontResult) {
  if (!storefrontResult || storefrontResult.error) return false;
  return Array.isArray(storefrontResult.data) && storefrontResult.data.length > 0;
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
// assembleGlobalMusicFootprint reads:
//   { available: string[], unavailable: string[], errors: Array<{sf,error}>, total: number }
function translateTerritories(packages, canonical) {
  const pkg = findFirst(packages, Capability.TERRITORIES, Capability.AVAILABILITY);
  if (!pkg) return;

  const storefronts = pkg.contract.payload?.storefronts;
  if (!storefronts || typeof storefronts !== 'object') return;

  canonical.platforms             ??= {};
  canonical.platforms.appleMusic  ??= {};
  canonical.platforms.appleMusic.details ??= {};

  const available   = [];
  const unavailable = [];
  const errors      = [];

  for (const [sf, data] of Object.entries(storefronts)) {
    if (storefrontIsAvailable(data)) {
      available.push(sf);
    } else {
      if (data?.error) errors.push({ sf, error: data.error });
      unavailable.push(sf);
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
