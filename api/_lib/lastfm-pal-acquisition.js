// Last.fm PAL Acquisition — Phase 3.6 Provider Expansion 09
//
// Routes all Last.fm evidence acquisition through the Provider Acquisition Layer.
// REPLACES: direct call to getLastFm() in api/_lib/run-scan.js
//
// Constitutional constraint: acquires raw evidence only. No intelligence computed here.
// EvidencePackages flow directly into runRIE({ evidencePackages }).
//
// Last.fm requires an API key. Reads LASTFM_API_KEY from env.
// If not configured, acquisition returns empty packages (AUTH_UNAVAILABLE — not a data gap).
//
// Sequential acquisition:
//   A. ARTIST_IDENTITY — artist.getinfo (soft identity-lock; carries stats, tags, bio, images)
//   B. TRACKS + ALBUMS — parallel (artist.gettoptracks, artist.gettopalbums)

import { ProviderAcquisitionLayer }  from '../../provider-acquisition/pal/ProviderAcquisitionLayer.js';
import { LastFmConnector, PROVIDER_NAME as LASTFM_PROVIDER } from '../../provider-acquisition/connectors/lastfm/LastFmConnector.js';
import { createEvidenceRequest }      from '../../provider-acquisition/evidence/EvidenceRequest.js';
import { Capability }                 from '../../provider-acquisition/capability/capabilityVocabulary.js';

// ── Internal: find first evidence package matching one of the given types ─────
function findFirstByType(packages, ...types) {
  const typeSet = new Set(types);
  return packages.find(p => typeSet.has(p.evidenceType)) ?? null;
}

/**
 * Acquire Last.fm evidence via PAL for a single scan.
 *
 * @param {{ artistName: string }} param
 * @returns {Promise<{ evidencePackages: EvidencePackage[], acquired: boolean, elapsedMs: number }>}
 */
export async function acquireLastFmEvidence({ artistName }) {
  const startMs = Date.now();

  if (!artistName) {
    return { evidencePackages: [], acquired: false, elapsedMs: 0 };
  }

  const apiKey = process.env.LASTFM_API_KEY ?? null;
  // AUTH_UNAVAILABLE is not a coverage gap — credentials simply not configured
  if (!apiKey) {
    return { evidencePackages: [], acquired: false, elapsedMs: Date.now() - startMs };
  }

  const pal = new ProviderAcquisitionLayer();
  try {
    await pal.activateConnector(new LastFmConnector(), { apiKey });
  } catch (err) {
    console.error('[lastfm-pal] PAL activation failed:', err.message);
    return { evidencePackages: [], acquired: false, elapsedMs: Date.now() - startMs };
  }

  const evidencePackages = [];

  try {
    const subjectRef = { artistName };

    // ── A: ARTIST_IDENTITY (artist.getinfo — includes stats, tags, bio, images, similar) ─
    const identityReport = await pal.acquire(LASTFM_PROVIDER, createEvidenceRequest({
      subjectRef,
      evidenceType: Capability.ARTIST_IDENTITY,
    }));
    evidencePackages.push({ evidenceType: Capability.ARTIST_IDENTITY, contract: identityReport.contract });

    // Stop if artist.getinfo returned no data — no artist name for subsequent calls
    if (identityReport.contract.completeness === 'empty') {
      await pal.shutdown().catch(() => {});
      return { evidencePackages, acquired: false, elapsedMs: Date.now() - startMs };
    }

    // ── B: TRACKS + ALBUMS (parallel) ────────────────────────────────────────
    const [tracksSettled, albumsSettled] = await Promise.allSettled([
      pal.acquire(LASTFM_PROVIDER, createEvidenceRequest({
        subjectRef,
        evidenceType: Capability.TRACKS,
      })),
      pal.acquire(LASTFM_PROVIDER, createEvidenceRequest({
        subjectRef,
        evidenceType: Capability.ALBUMS,
      })),
    ]);

    if (tracksSettled.status === 'fulfilled') {
      evidencePackages.push({ evidenceType: Capability.TRACKS, contract: tracksSettled.value.contract });
    }
    if (albumsSettled.status === 'fulfilled') {
      evidencePackages.push({ evidenceType: Capability.ALBUMS, contract: albumsSettled.value.contract });
    }

    return { evidencePackages, acquired: true, elapsedMs: Date.now() - startMs };

  } catch (err) {
    console.error('[lastfm-pal] acquisition error:', err.message);
    return { evidencePackages, acquired: false, elapsedMs: Date.now() - startMs };
  } finally {
    await pal.shutdown().catch(e => console.error('[lastfm-pal] shutdown error:', e.message));
  }
}

/**
 * Synthesize the legacy Last.fm shape from PAL evidence packages.
 *
 * [TRANSITIONAL]: Required by V1 module system (runModules / buildFlags / estimateRoyaltyGap).
 * Retires when those consumers migrate to RIE Rule Library.
 *
 * Produces the same shape as the retired getLastFm() direct function:
 *   { found, name, playcount, listeners, tags[], bio(300, HTML-stripped), url }
 *
 * bio is HTML-stripped and truncated to 300 chars for V1 module compat.
 * The full raw bio is preserved in platforms.lastfm.biography via EvidenceBridge.
 *
 * @param {EvidencePackage[]} evidencePackages
 * @param {string} artistName
 * @returns {object}
 */
export function synthesizeLastFmCompat(evidencePackages, artistName) {
  const defaultResult = { found: false };

  if (!evidencePackages || evidencePackages.length === 0) {
    return defaultResult;
  }

  const identityPkg = findFirstByType(evidencePackages, Capability.ARTIST_IDENTITY);
  const a           = identityPkg?.contract?.payload;

  if (!a || typeof a !== 'object' || !a.name) {
    return defaultResult;
  }

  // Strip HTML tags and truncate to 300 chars for V1 compat
  const rawBio  = a.bio?.summary ?? null;
  const cleanBio = rawBio
    ? rawBio.replace(/<[^>]+>/g, '').substring(0, 300)
    : null;

  return {
    found:     true,
    name:      a.name,
    playcount: parseInt(a.stats?.playcount ?? 0, 10) || 0,
    listeners: parseInt(a.stats?.listeners ?? 0, 10) || 0,
    tags:      Array.isArray(a.tags?.tag) ? a.tags.tag.map(t => t.name).filter(Boolean) : [],
    bio:       cleanBio,
    url:       a.url ?? null,
  };
}
