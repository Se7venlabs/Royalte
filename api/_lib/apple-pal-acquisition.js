// Apple PAL Acquisition — Apple Production Migration (Phase 3.3)
//
// Routes all Apple Music evidence acquisition through the Provider Acquisition Layer.
// REPLACES: direct calls to getAppleMusic() in api/_lib/run-scan.js
//
// Constitutional constraint: acquires raw evidence only. No intelligence computed here.
// EvidencePackages flow directly into runRIE({ evidencePackages }).
//
// Sequential acquisition order:
//   A. ARTIST_IDENTITY   — confirms/discovers appleArtistId
//   B. ALBUMS + ISRC + VIDEOS — parallel (all need only appleArtistId from A)
//   C. AVAILABILITY      — global 167-storefront check (needs appleAlbumId from B)
//
// VIDEOS added Media PAL Expansion™ — artist music-videos catalog
// (/catalog/{storefront}/artists/{id}/music-videos), same parallel batch as
// ALBUMS since both only need appleArtistId, no new sequential round trip.

import { ProviderAcquisitionLayer }  from '../../provider-acquisition/pal/ProviderAcquisitionLayer.js';
import { AppleMusicConnector, PROVIDER_NAME as APPLE_PROVIDER } from '../../provider-acquisition/connectors/apple-music/AppleMusicConnector.js';
import { createEvidenceRequest }      from '../../provider-acquisition/evidence/EvidenceRequest.js';
import { Capability }                 from '../../provider-acquisition/capability/capabilityVocabulary.js';
import { bridgeToCanonical }          from '../../lib/rie/EvidenceBridge.js';

// ── Env config ───────────────────────────────────────────────────────────────
function getPalConfig() {
  return {
    teamId:     process.env.APPLE_TEAM_ID     ?? '',
    keyId:      process.env.APPLE_KEY_ID      ?? '',
    privateKey: process.env.APPLE_PRIVATE_KEY ?? '',
  };
}

// ── Artwork URL normalization — substitutes template dimensions ───────────────
// Apple returns "{w}x{h}bb.jpg" templates; downstream expects substituted URLs.
function substituteArtworkDimensions(url, w = 600, h = 600) {
  if (!url || typeof url !== 'string') return null;
  return url.replace('{w}', String(w)).replace('{h}', String(h));
}

// ── Apple artist ID extraction from ARTIST_IDENTITY contract payload ──────────
function extractAppleArtistId(contract) {
  const p = contract?.payload;
  if (!p || typeof p !== 'object') return null;
  // Direct artist lookup: { data: [{ id, type: 'artists' }] }
  if (Array.isArray(p.data)) {
    const artist = p.data.find(n => n?.type === 'artists');
    if (artist?.id) return artist.id;
  }
  // Search result: { results: { artists: { data: [{ id }] } } }
  const hits = p.results?.artists?.data;
  if (Array.isArray(hits) && hits.length > 0) return hits[0]?.id ?? null;
  return null;
}

// ── First album ID extraction from ALBUMS contract payload ────────────────────
function extractFirstAlbumId(contract) {
  const data = contract?.payload?.data;
  if (!Array.isArray(data)) return null;
  const album = data.find(n => n?.type === 'albums');
  return album?.id ?? null;
}

/**
 * Acquire Apple Music evidence via PAL for a single scan.
 *
 * @param {{ appleArtistId?: string|null, artistName: string, isrc?: string|null }} subjectHint
 * @returns {Promise<{ evidencePackages: EvidencePackage[], acquired: boolean, elapsedMs: number }>}
 */
export async function acquireAppleEvidence({ appleArtistId = null, artistName, isrc = null }) {
  const startMs = Date.now();
  const evidencePackages = [];

  const config = getPalConfig();
  if (!config.teamId || !config.keyId || !config.privateKey) {
    console.warn('[apple-pal] Apple Music credentials not configured — skipping PAL acquisition');
    return { evidencePackages: [], acquired: false, elapsedMs: Date.now() - startMs };
  }

  const pal = new ProviderAcquisitionLayer();
  try {
    await pal.activateConnector(new AppleMusicConnector(), config);
  } catch (err) {
    console.error('[apple-pal] PAL activation failed:', err.message);
    return { evidencePackages: [], acquired: false, elapsedMs: Date.now() - startMs };
  }

  try {
    const baseSubjectRef = appleArtistId ? { appleArtistId, artistName } : { artistName };

    // ── A: ARTIST_IDENTITY ───────────────────────────────────────────────
    const identityReport = await pal.acquire(APPLE_PROVIDER, createEvidenceRequest({
      subjectRef:   baseSubjectRef,
      evidenceType: Capability.ARTIST_IDENTITY,
    }));
    evidencePackages.push({ evidenceType: Capability.ARTIST_IDENTITY, contract: identityReport.contract });

    const resolvedAppleArtistId = appleArtistId ?? extractAppleArtistId(identityReport.contract);
    if (!resolvedAppleArtistId) {
      // Apple artist not found — record identity evidence and return
      await pal.shutdown().catch(() => {});
      return { evidencePackages, acquired: false, elapsedMs: Date.now() - startMs };
    }

    const enrichedSubjectRef = { ...baseSubjectRef, appleArtistId: resolvedAppleArtistId };

    // ── B: ALBUMS + optional ISRC + VIDEOS (parallel) ────────────────────
    const parallelB = [
      pal.acquire(APPLE_PROVIDER, createEvidenceRequest({
        subjectRef:   enrichedSubjectRef,
        evidenceType: Capability.ALBUMS,
      })),
      // Media PAL Expansion™ — artist music-videos catalog. Index [1] is
      // fixed regardless of whether the ISRC request below is appended.
      pal.acquire(APPLE_PROVIDER, createEvidenceRequest({
        subjectRef:   enrichedSubjectRef,
        evidenceType: Capability.VIDEOS,
      })),
    ];
    if (isrc) {
      parallelB.push(pal.acquire(APPLE_PROVIDER, createEvidenceRequest({
        subjectRef:   { ...enrichedSubjectRef, isrc },
        evidenceType: Capability.ISRC,
      })));
    }

    const [albumsSettled, videosSettled, isrcSettled] = await Promise.allSettled(parallelB);

    let albumsReport = null;
    if (albumsSettled?.status === 'fulfilled') {
      albumsReport = albumsSettled.value;
      evidencePackages.push({ evidenceType: Capability.ALBUMS, contract: albumsReport.contract });
    }
    if (videosSettled?.status === 'fulfilled') {
      evidencePackages.push({ evidenceType: Capability.VIDEOS, contract: videosSettled.value.contract });
    }
    if (isrcSettled?.status === 'fulfilled') {
      evidencePackages.push({ evidenceType: Capability.ISRC, contract: isrcSettled.value.contract });
    }

    // ── C: AVAILABILITY — global 167-storefront check ────────────────────
    const firstAlbumId = albumsReport ? extractFirstAlbumId(albumsReport.contract) : null;
    if (firstAlbumId) {
      const availReport = await pal.acquire(APPLE_PROVIDER, createEvidenceRequest({
        subjectRef:   { ...enrichedSubjectRef, appleAlbumId: firstAlbumId },
        evidenceType: Capability.AVAILABILITY,
      }));
      evidencePackages.push({ evidenceType: Capability.AVAILABILITY, contract: availReport.contract });
    }

    return { evidencePackages, acquired: true, elapsedMs: Date.now() - startMs };

  } catch (err) {
    console.error('[apple-pal] acquisition error:', err.message);
    return { evidencePackages, acquired: false, elapsedMs: Date.now() - startMs };
  } finally {
    await pal.shutdown().catch(e => console.error('[apple-pal] shutdown error:', e.message));
  }
}

/**
 * Synthesize the legacy appleMusicData shape from PAL evidence packages.
 *
 * [TRANSITIONAL]: Required by V1 module system (runModules / buildFlags).
 * Retires when those consumers migrate to RIE Rule Library.
 *
 * @param {EvidencePackage[]} evidencePackages
 * @returns {{ found: boolean, artistId, artistUrl, artwork, genres, albumCount, albums, globalStorefrontAvailability, storefrontAvailability, isrcLookup, catalogComparison }}
 */
export function synthesizeAppleMusicCompat(evidencePackages) {
  if (!evidencePackages || evidencePackages.length === 0) return { found: false };

  const bridged = bridgeToCanonical(evidencePackages);
  const am = bridged.platforms?.appleMusic;
  if (!am) return { found: false };

  return {
    found:                       am.availability === 'VERIFIED',
    artistId:                    am.details?.artistId        ?? null,
    artistUrl:                   am.details?.artistUrl       ?? null,
    // Normalized artwork URL for normalizeAuditResponse → cio.identity.artwork
    artwork:                     substituteArtworkDimensions(am.artworkUrl),
    genres:                      Array.isArray(am.genres) ? am.genres : [],
    albumCount:                  Array.isArray(am.details?.albums) ? am.details.albums.length : 0,
    albums:                      Array.isArray(am.details?.albums) ? am.details.albums : [],
    // Full 167-storefront coverage (from AVAILABILITY evidence)
    globalStorefrontAvailability: am.details?.globalStorefrontAvailability ?? null,
    // [RETIRED CANDIDATE]: BIG6 legacy format — no longer populated by PAL path
    storefrontAvailability:      null,
    // [TRANSITIONAL]: Will migrate to PAL ISRC capability in a future phase
    isrcLookup:                  null,
    // [TRANSITIONAL]: Spotify catalog cross-compare — deferred to RIE cross-provider phase
    catalogComparison:           null,
  };
}
