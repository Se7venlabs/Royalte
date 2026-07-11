// TIDAL PAL Acquisition — Phase 4.0 TIDAL Connector™
//
// Routes all TIDAL evidence acquisition through the Provider Acquisition Layer.
//
// Constitutional constraint: acquires raw evidence only. No intelligence computed here.
// EvidencePackages flow directly into runRIE({ evidencePackages }).
//
// Authentication: OAuth 2.1 client credentials (TIDAL_CLIENT_ID + TIDAL_CLIENT_SECRET).
// If credentials are absent, the acquisition returns empty — never throws.
//
// VERIFIED API contract (2026-07-11):
//   Base:    https://openapi.tidal.com/v2
//   Search:  GET /searchResults/{query}/relationships/artists?countryCode=US&include=artists
//   Artist:  GET /artists/{id}?countryCode=US&include=profileArt
//   Albums:  GET /artists/{id}/relationships/albums?countryCode=US&include=albums
//   Tracks:  GET /artists/{id}/relationships/tracks?countryCode=US&collapseBy=FINGERPRINT&include=tracks
//
// Sequential acquisition order:
//   A. ARTIST_IDENTITY — search by name + identity-lock; confirms artist + returns TIDAL ID
//   B. ALBUMS + TRACKS — parallel (both need tidalArtistId from A)

import { ProviderAcquisitionLayer } from '../../provider-acquisition/pal/ProviderAcquisitionLayer.js';
import { TidalConnector, PROVIDER_NAME as TIDAL_PROVIDER } from '../../provider-acquisition/connectors/tidal/TidalConnector.js';
import { createEvidenceRequest }     from '../../provider-acquisition/evidence/EvidenceRequest.js';
import { Capability }                from '../../provider-acquisition/capability/capabilityVocabulary.js';

// ── Env config ────────────────────────────────────────────────────────────────
function getPalConfig() {
  return {
    clientId:     process.env.TIDAL_CLIENT_ID     ?? '',
    clientSecret: process.env.TIDAL_CLIENT_SECRET ?? '',
  };
}

// ── Internal: find first evidence package of a given type ────────────────────
function findFirstByType(packages, ...types) {
  const typeSet = new Set(types);
  return packages.find(p => typeSet.has(p.evidenceType)) ?? null;
}

/**
 * Acquire TIDAL evidence via PAL for a single scan.
 *
 * @param {{ artistName: string }} param
 * @returns {Promise<{ evidencePackages: EvidencePackage[], acquired: boolean, elapsedMs: number }>}
 */
export async function acquireTidalEvidence({ artistName }) {
  const startMs = Date.now();

  if (!artistName) {
    return { evidencePackages: [], acquired: false, elapsedMs: 0 };
  }

  const config = getPalConfig();
  if (!config.clientId || !config.clientSecret) {
    console.warn('[tidal-pal] TIDAL credentials not configured — skipping PAL acquisition');
    return { evidencePackages: [], acquired: false, elapsedMs: Date.now() - startMs };
  }

  const pal = new ProviderAcquisitionLayer();
  try {
    await pal.activateConnector(new TidalConnector(), config);
  } catch (err) {
    console.error('[tidal-pal] PAL activation failed:', err.message);
    return { evidencePackages: [], acquired: false, elapsedMs: Date.now() - startMs };
  }

  const evidencePackages = [];

  try {
    const subjectRef = { artistName };

    // ── A: ARTIST_IDENTITY (search + identity-lock + detail) ────────────────
    const identityReport = await pal.acquire(TIDAL_PROVIDER, createEvidenceRequest({
      subjectRef,
      evidenceType: Capability.ARTIST_IDENTITY,
    }));
    evidencePackages.push({ evidenceType: Capability.ARTIST_IDENTITY, contract: identityReport.contract });

    if (identityReport.contract.completeness === 'empty') {
      await pal.shutdown().catch(() => {});
      return { evidencePackages, acquired: false, elapsedMs: Date.now() - startMs };
    }

    const tidalArtistId = identityReport.contract.payload?.id ?? null;
    if (!tidalArtistId) {
      await pal.shutdown().catch(() => {});
      return { evidencePackages, acquired: false, elapsedMs: Date.now() - startMs };
    }

    const subjectWithId = { artistName, tidalArtistId };

    // ── B: ALBUMS + TRACKS (parallel) ──────────────────────────────────────
    const [albumsSettled, tracksSettled] = await Promise.allSettled([
      pal.acquire(TIDAL_PROVIDER, createEvidenceRequest({
        subjectRef:   subjectWithId,
        evidenceType: Capability.ALBUMS,
      })),
      pal.acquire(TIDAL_PROVIDER, createEvidenceRequest({
        subjectRef:   subjectWithId,
        evidenceType: Capability.TRACKS,
      })),
    ]);

    if (albumsSettled.status === 'fulfilled') {
      evidencePackages.push({ evidenceType: Capability.ALBUMS, contract: albumsSettled.value.contract });
    }
    if (tracksSettled.status === 'fulfilled') {
      evidencePackages.push({ evidenceType: Capability.TRACKS, contract: tracksSettled.value.contract });
    }

    return { evidencePackages, acquired: true, elapsedMs: Date.now() - startMs };

  } catch (err) {
    console.error('[tidal-pal] acquisition error:', err.message);
    return { evidencePackages, acquired: false, elapsedMs: Date.now() - startMs };
  } finally {
    await pal.shutdown().catch(e => console.error('[tidal-pal] shutdown error:', e.message));
  }
}

/**
 * Synthesize the legacy TIDAL shape from PAL evidence packages.
 *
 * [TRANSITIONAL]: Required by V1 module system (rawResponse).
 * Retires when those consumers migrate to RIE Rule Library.
 *
 * TIDAL API v2 response structure (verified 2026-07-11):
 *   ARTIST_IDENTITY payload: { id, name, popularity (0-1 scale), url, images: [{ href, meta: { width, height } }...] }
 *   ALBUMS payload:  { data: [], included: [{ id, type, attributes: { title, releaseDate, barcodeId } }...] }
 *   TRACKS payload:  { data: [], included: [{ id, type, attributes: { title, isrc, duration, explicit } }...] }
 *
 * Produces:
 *   { found, artistId, name, url, popularity (0-100), picture, albums[], topTracks[], genres[] }
 *
 * @param {EvidencePackage[]} evidencePackages
 * @param {string} artistName
 * @returns {object}
 */
export function synthesizeTidalCompat(evidencePackages, artistName) {
  const defaultResult = { found: false, popularity: 0 };

  if (!evidencePackages || evidencePackages.length === 0) {
    return defaultResult;
  }

  // ── artist identity ────────────────────────────────────────────────────────
  const identityPkg = findFirstByType(evidencePackages, Capability.ARTIST_IDENTITY);
  const detail      = identityPkg?.contract?.payload;

  if (!detail || typeof detail !== 'object' || !detail.id) {
    return defaultResult;
  }

  // TIDAL popularity is 0-1 scale; normalize to 0-100 for consistency with other providers
  const popularity = typeof detail.popularity === 'number'
    ? Math.round(detail.popularity * 100)
    : 0;

  // Best image: first entry in sorted images array (largest first)
  const picture = Array.isArray(detail.images) && detail.images.length > 0
    ? detail.images[0].href ?? null
    : null;

  // ── albums ─────────────────────────────────────────────────────────────────
  const albumsPkg = findFirstByType(evidencePackages, Capability.ALBUMS);
  const albums    = _extractIncluded(albumsPkg?.contract?.payload, 'albums');

  // ── tracks ─────────────────────────────────────────────────────────────────
  const tracksPkg = findFirstByType(evidencePackages, Capability.TRACKS);
  const topTracks = _extractIncluded(tracksPkg?.contract?.payload, 'tracks');

  return {
    found:      true,
    artistId:   String(detail.id),
    name:       detail.name     ?? artistName,
    url:        detail.url      ?? `https://tidal.com/browse/artist/${detail.id}`,
    popularity,
    picture,
    albums,
    topTracks,
    genres:     [],   // TIDAL API v2 does not expose genres on artist objects
  };
}

// ── Private helpers ─────────────────────────────────────────────────────────

// Extract included resource objects of a given type from a JSON:API collection response.
// TIDAL collections: { data: [{ id, type }...], included: [{ id, type, attributes: {...} }...] }
// Returns the included array (full attribute objects), filtered by type.
function _extractIncluded(payload, type) {
  if (!payload || typeof payload !== 'object') return [];
  const included = Array.isArray(payload.included) ? payload.included : [];
  const items    = type ? included.filter(item => item?.type === type) : included;
  return items.map(item => ({
    id:         item.id,
    type:       item.type,
    ...item.attributes,
  })).filter(Boolean);
}
