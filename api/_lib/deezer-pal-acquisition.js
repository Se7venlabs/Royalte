// Deezer PAL Acquisition — Phase 3.6 Provider Expansion 07
//
// Routes all Deezer evidence acquisition through the Provider Acquisition Layer.
// REPLACES: direct call to getDeezer() (lines ~1207–1277 of api/_lib/run-scan.js)
//
// Constitutional constraint: acquires raw evidence only. No intelligence computed here.
// EvidencePackages flow directly into runRIE({ evidencePackages }).
//
// Deezer public API needs no credentials. The connector initializes with only fetch options.
//
// Sequential acquisition:
//   A. ARTIST_IDENTITY  — search by name (identity-lock) + artist detail
//   B. ALBUMS + TRACKS  — parallel, using deezerArtistId extracted from A's payload

import { ProviderAcquisitionLayer }  from '../../provider-acquisition/pal/ProviderAcquisitionLayer.js';
import { DeezerConnector, PROVIDER_NAME as DEEZER_PROVIDER } from '../../provider-acquisition/connectors/deezer/DeezerConnector.js';
import { createEvidenceRequest }      from '../../provider-acquisition/evidence/EvidenceRequest.js';
import { Capability }                 from '../../provider-acquisition/capability/capabilityVocabulary.js';

// ── Internal: find first evidence package matching one of the given types ─────
function findFirstByType(packages, ...types) {
  const typeSet = new Set(types);
  return packages.find(p => typeSet.has(p.evidenceType)) ?? null;
}

/**
 * Acquire Deezer evidence via PAL for a single scan.
 *
 * @param {{ artistName: string }} param
 * @returns {Promise<{ evidencePackages: EvidencePackage[], acquired: boolean, elapsedMs: number }>}
 */
export async function acquireDeezerEvidence({ artistName }) {
  const startMs = Date.now();

  if (!artistName) {
    return { evidencePackages: [], acquired: false, elapsedMs: 0 };
  }

  const pal = new ProviderAcquisitionLayer();
  try {
    await pal.activateConnector(new DeezerConnector(), {});
  } catch (err) {
    console.error('[deezer-pal] PAL activation failed:', err.message);
    return { evidencePackages: [], acquired: false, elapsedMs: Date.now() - startMs };
  }

  const evidencePackages = [];

  try {
    const subjectRef = { artistName };

    // ── A: ARTIST_IDENTITY (search + identity-lock + detail) ────────────────
    const identityReport = await pal.acquire(DEEZER_PROVIDER, createEvidenceRequest({
      subjectRef,
      evidenceType: Capability.ARTIST_IDENTITY,
    }));
    evidencePackages.push({ evidenceType: Capability.ARTIST_IDENTITY, contract: identityReport.contract });

    // Stop if no identity match — no artist ID to use for subsequent calls
    if (identityReport.contract.completeness === 'empty') {
      await pal.shutdown().catch(() => {});
      return { evidencePackages, acquired: false, elapsedMs: Date.now() - startMs };
    }

    const deezerArtistId = identityReport.contract.payload?.id ?? null;
    if (!deezerArtistId) {
      await pal.shutdown().catch(() => {});
      return { evidencePackages, acquired: false, elapsedMs: Date.now() - startMs };
    }

    const subjectWithId = { artistName, deezerArtistId };

    // ── B: ALBUMS + TRACKS (parallel) ──────────────────────────────────────
    const [albumsSettled, tracksSettled] = await Promise.allSettled([
      pal.acquire(DEEZER_PROVIDER, createEvidenceRequest({
        subjectRef:  subjectWithId,
        evidenceType: Capability.ALBUMS,
      })),
      pal.acquire(DEEZER_PROVIDER, createEvidenceRequest({
        subjectRef:  subjectWithId,
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
    console.error('[deezer-pal] acquisition error:', err.message);
    return { evidencePackages, acquired: false, elapsedMs: Date.now() - startMs };
  } finally {
    await pal.shutdown().catch(e => console.error('[deezer-pal] shutdown error:', e.message));
  }
}

/**
 * Synthesize the legacy Deezer shape from PAL evidence packages.
 *
 * [TRANSITIONAL]: Required by V1 module system (runModules / buildFlags / rawResponse).
 * Retires when those consumers migrate to RIE Rule Library.
 *
 * Produces the same shape as the retired getDeezer() direct function:
 *   { found, artistId, name, link, share, picture*, fans, nb_album,
 *     radio, tracklist, type, albums[], topTracks[], genres[] }
 *
 * @param {EvidencePackage[]} evidencePackages
 * @param {string} artistName
 * @returns {object}
 */
export function synthesizeDeezerCompat(evidencePackages, artistName) {
  const defaultResult = { found: false, fans: 0 };

  if (!evidencePackages || evidencePackages.length === 0) {
    return defaultResult;
  }

  // ── artist identity ────────────────────────────────────────────────────────
  const identityPkg  = findFirstByType(evidencePackages, Capability.ARTIST_IDENTITY);
  const detail       = identityPkg?.contract?.payload;

  if (!detail || typeof detail !== 'object' || !detail.id) {
    return defaultResult;
  }

  // ── albums ─────────────────────────────────────────────────────────────────
  const albumsPkg    = findFirstByType(evidencePackages, Capability.ALBUMS);
  const albumsBody   = albumsPkg?.contract?.payload;
  const albums       = Array.isArray(albumsBody?.data) ? albumsBody.data : [];

  // ── top tracks ─────────────────────────────────────────────────────────────
  const tracksPkg    = findFirstByType(evidencePackages, Capability.TRACKS);
  const tracksBody   = tracksPkg?.contract?.payload;
  const topTracks    = Array.isArray(tracksBody?.data) ? tracksBody.data : [];

  // ── genres — collect unique genre names from album genre tags ───────────────
  const genreSet = new Set();
  for (const album of albums) {
    if (Array.isArray(album.genres?.data)) {
      for (const g of album.genres.data) {
        if (g.name) genreSet.add(g.name);
      }
    }
  }

  return {
    found:          true,
    // Identity
    artistId:       detail.id        ?? null,
    name:           detail.name      ?? artistName,
    link:           detail.link      ?? null,
    share:          detail.share     ?? null,
    // Artwork — all sizes Deezer exposes
    picture:        detail.picture        ?? null,
    picture_small:  detail.picture_small  ?? null,
    picture_medium: detail.picture_medium ?? null,
    picture_big:    detail.picture_big    ?? null,
    picture_xl:     detail.picture_xl     ?? null,
    // Metrics
    fans:      typeof detail.nb_fan   === 'number' ? detail.nb_fan   : 0,
    nb_album:  typeof detail.nb_album === 'number' ? detail.nb_album : 0,
    radio:     !!detail.radio,
    tracklist: detail.tracklist ?? null,
    type:      detail.type      ?? 'artist',
    // Enriched catalog
    albums,
    topTracks,
    genres: [...genreSet],
  };
}
