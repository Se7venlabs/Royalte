// Spotify PAL Acquisition — Phase 3.6
//
// Routes all Spotify evidence acquisition through the Provider Acquisition Layer.
// REPLACES: direct calls to getSpotifyArtist (enrichment), getSpotifyAlbums,
//           getSpotifyTopTracks in api/_lib/run-scan.js
//
// Constitutional constraint: acquires raw evidence only. No intelligence computed here.
// EvidencePackages flow directly into runRIE({ evidencePackages }).
//
// TRANSITIONAL functions in run-scan.js that are NOT replaced here:
//   getSpotifyToken()             — used by legacy resolution path
//   getSpotifyArtist() in resolveToArtist — identity resolution (cross-provider)
//   getSpotifyTrack()             — track input resolution
//   getSpotifyAlbum()             — album input resolution
//   searchSpotifyArtistByName()   — name-based identity discovery
//   discoverSpotifyByIsrc()       — ISRC-based cross-provider discovery
//
// Sequential acquisition order:
//   A. ARTIST_IDENTITY   — confirms artist on Spotify
//   B. ALBUMS + TRACKS   — parallel (both need spotifyArtistId from A)

import { ProviderAcquisitionLayer }  from '../../provider-acquisition/pal/ProviderAcquisitionLayer.js';
import { SpotifyConnector, PROVIDER_NAME as SPOTIFY_PROVIDER } from '../../provider-acquisition/connectors/spotify/SpotifyConnector.js';
import { createEvidenceRequest }      from '../../provider-acquisition/evidence/EvidenceRequest.js';
import { Capability }                 from '../../provider-acquisition/capability/capabilityVocabulary.js';

// ── Env config ───────────────────────────────────────────────────────────────
function getPalConfig() {
  return {
    clientId:     process.env.SPOTIFY_CLIENT_ID     ?? '',
    clientSecret: process.env.SPOTIFY_CLIENT_SECRET ?? '',
  };
}

// ── Internal: find first evidence package of a given type ────────────────────
function findFirstByType(packages, ...types) {
  const typeSet = new Set(types);
  return packages.find(p => typeSet.has(p.evidenceType)) ?? null;
}

/**
 * Acquire Spotify evidence via PAL for a single scan.
 *
 * @param {{ spotifyArtistId?: string|null, artistName: string }} subjectHint
 * @returns {Promise<{ evidencePackages: EvidencePackage[], acquired: boolean, elapsedMs: number }>}
 */
export async function acquireSpotifyEvidence({ spotifyArtistId = null, artistName }) {
  const startMs = Date.now();
  const evidencePackages = [];

  if (!spotifyArtistId) {
    return { evidencePackages: [], acquired: false, elapsedMs: 0 };
  }

  const config = getPalConfig();
  if (!config.clientId || !config.clientSecret) {
    console.warn('[spotify-pal] Spotify credentials not configured — skipping PAL acquisition');
    return { evidencePackages: [], acquired: false, elapsedMs: Date.now() - startMs };
  }

  const pal = new ProviderAcquisitionLayer();
  try {
    await pal.activateConnector(new SpotifyConnector(), config);
  } catch (err) {
    console.error('[spotify-pal] PAL activation failed:', err.message);
    return { evidencePackages: [], acquired: false, elapsedMs: Date.now() - startMs };
  }

  try {
    const subjectRef = { spotifyArtistId, artistName };

    // ── A: ARTIST_IDENTITY ───────────────────────────────────────────────
    const identityReport = await pal.acquire(SPOTIFY_PROVIDER, createEvidenceRequest({
      subjectRef,
      evidenceType: Capability.ARTIST_IDENTITY,
    }));
    evidencePackages.push({ evidenceType: Capability.ARTIST_IDENTITY, contract: identityReport.contract });

    // Stop if artist not found (empty contract means Spotify didn't respond)
    if (identityReport.contract.completeness === 'empty') {
      await pal.shutdown().catch(() => {});
      return { evidencePackages, acquired: false, elapsedMs: Date.now() - startMs };
    }

    // ── B: ALBUMS + TRACKS (parallel) ───────────────────────────────────
    const [albumsSettled, tracksSettled] = await Promise.allSettled([
      pal.acquire(SPOTIFY_PROVIDER, createEvidenceRequest({
        subjectRef,
        evidenceType: Capability.ALBUMS,
      })),
      pal.acquire(SPOTIFY_PROVIDER, createEvidenceRequest({
        subjectRef,
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
    console.error('[spotify-pal] acquisition error:', err.message);
    return { evidencePackages, acquired: false, elapsedMs: Date.now() - startMs };
  } finally {
    await pal.shutdown().catch(e => console.error('[spotify-pal] shutdown error:', e.message));
  }
}

/**
 * Synthesize the legacy Spotify shapes from PAL evidence packages.
 *
 * [TRANSITIONAL]: Required by V1 module system (runModules / buildFlags / rawResponse).
 * Retires when those consumers migrate to RIE Rule Library.
 *
 * @param {EvidencePackage[]} evidencePackages
 * @param {{ spotifyArtistId?: string|null, artistName?: string|null, artistImage?: string|null, artistUrl?: string|null }} [subjectHints]
 * @returns {{ artistData: object, albumsData: { items: any[] }, spotifyTopTracks: any[] }}
 */
export function synthesizeSpotifyCompat(evidencePackages, subjectHints = {}) {
  const defaultArtistData = {
    id:            subjectHints.spotifyArtistId ?? null,
    name:          subjectHints.artistName      ?? null,
    followers:     { total: -1 },
    popularity:    0,
    genres:        [],
    images:        subjectHints.artistImage ? [{ url: subjectHints.artistImage }] : [],
    external_urls: subjectHints.artistUrl   ? { spotify: subjectHints.artistUrl } : {},
  };

  if (!evidencePackages || evidencePackages.length === 0) {
    return { artistData: defaultArtistData, albumsData: { items: [] }, spotifyTopTracks: [] };
  }

  // ── artistData from ARTIST_IDENTITY ─────────────────────────────────────────
  const identityPkg     = findFirstByType(evidencePackages, Capability.ARTIST_IDENTITY);
  const artistPayload   = identityPkg?.contract?.payload;

  let artistData = defaultArtistData;
  if (artistPayload && typeof artistPayload === 'object') {
    artistData = {
      id:            artistPayload.id                      ?? null,
      name:          artistPayload.name                    ?? subjectHints.artistName ?? null,
      followers:     { total: typeof artistPayload.followers?.total === 'number'
                               ? artistPayload.followers.total : -1 },
      popularity:    typeof artistPayload.popularity === 'number' ? artistPayload.popularity : 0,
      genres:        Array.isArray(artistPayload.genres) ? artistPayload.genres : [],
      images:        Array.isArray(artistPayload.images) ? artistPayload.images : [],
      external_urls: artistPayload.external_urls ?? {},
    };
  }

  // ── albumsData from ALBUMS ───────────────────────────────────────────────────
  const albumsPkg   = findFirstByType(evidencePackages, Capability.ALBUMS);
  const albumsPayload = albumsPkg?.contract?.payload;

  const albumsData = { items: [] };
  if (albumsPayload && typeof albumsPayload === 'object') {
    albumsData.items = Array.isArray(albumsPayload.items) ? albumsPayload.items : [];
  }

  // ── spotifyTopTracks from TRACKS ─────────────────────────────────────────────
  const tracksPkg    = findFirstByType(evidencePackages, Capability.TRACKS);
  const tracksPayload = tracksPkg?.contract?.payload;

  let spotifyTopTracks = [];
  if (tracksPayload && typeof tracksPayload === 'object') {
    const tracks = Array.isArray(tracksPayload.tracks) ? tracksPayload.tracks : [];
    spotifyTopTracks = tracks.map(t => ({
      name:       t.name                     ?? null,
      isrc:       t.external_ids?.isrc       ?? null,
      artistName: t.artists?.[0]?.name       ?? '',
    }));
  }

  return { artistData, albumsData, spotifyTopTracks };
}
