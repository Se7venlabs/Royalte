// MusicBrainz PAL Acquisition — Phase 3.8
//
// Routes all MusicBrainz evidence acquisition through the Provider Acquisition Layer.
// REPLACES: direct calls to getMusicBrainz(artistName) in api/_lib/run-scan.js
//
// Constitutional constraint: acquires raw evidence only. No intelligence computed here.
// EvidencePackages flow into runRIE({ evidencePackages }) via combined evidence array.
//
// MusicBrainz requires no credentials — no config guard needed.
//
// Sequential acquisition order:
//   A. ARTIST_IDENTITY   — search by name; extracts MBID from exact-name match
//   B. TRACKS + RELEASES — parallel (both require MBID from A)

import { ProviderAcquisitionLayer }  from '../../provider-acquisition/pal/ProviderAcquisitionLayer.js';
import { MusicBrainzConnector, PROVIDER_NAME as MB_PROVIDER }
  from '../../provider-acquisition/connectors/musicbrainz/MusicBrainzConnector.js';
import { createEvidenceRequest }      from '../../provider-acquisition/evidence/EvidenceRequest.js';
import { Capability }                 from '../../provider-acquisition/capability/capabilityVocabulary.js';

// ── MBID extraction from ARTIST_IDENTITY contract payload ─────────────────────
// Two possible payload shapes from MusicBrainzConnector:
//   Search result:   { artists: [{ id, name, score, aliases, tags, ... }] }
//   Direct lookup:   { id, name, aliases, tags, ... }
function extractMBID(contract, artistName) {
  const payload = contract?.payload;
  if (!payload || typeof payload !== 'object') return null;

  // Direct artist lookup (when MBID was already known)
  if (typeof payload.id === 'string' && payload.id) return payload.id;

  // Search result — require exact-name match (identity-lock pattern)
  const norm    = s => (typeof s === 'string' ? s.toLowerCase().trim() : '');
  const target  = norm(artistName);
  const artists = Array.isArray(payload.artists) ? payload.artists : [];
  const match   = artists.find(a => norm(a.name) === target);
  return match?.id ?? null;
}

// ── Compat shape extraction ───────────────────────────────────────────────────

// Extract the search-result artists array from ARTIST_IDENTITY payload.
function extractArtists(contract) {
  const payload = contract?.payload;
  if (!payload) return [];
  if (Array.isArray(payload.artists)) return payload.artists;
  // Direct lookup — wrap single artist
  if (typeof payload.id === 'string') return [payload];
  return [];
}

/**
 * Acquire MusicBrainz evidence via PAL for a single scan.
 *
 * MusicBrainz requires no credentials — this function never bails on missing env vars.
 *
 * @param {{ artistName: string, mbid?: string|null }} subjectHint
 * @returns {Promise<{ evidencePackages: EvidencePackage[], acquired: boolean, elapsedMs: number }>}
 */
export async function acquireMBEvidence({ artistName, mbid = null }) {
  const startMs = Date.now();
  const evidencePackages = [];

  if (!artistName && !mbid) {
    return { evidencePackages: [], acquired: false, elapsedMs: 0 };
  }

  const pal = new ProviderAcquisitionLayer();
  try {
    await pal.activateConnector(new MusicBrainzConnector(), {});
  } catch (err) {
    console.error('[mb-pal] PAL activation failed:', err.message);
    return { evidencePackages: [], acquired: false, elapsedMs: Date.now() - startMs };
  }

  try {
    const baseSubjectRef = mbid ? { mbid, artistName } : { artistName };

    // ── A: ARTIST_IDENTITY ───────────────────────────────────────────────────
    const identityReport = await pal.acquire(MB_PROVIDER, createEvidenceRequest({
      subjectRef:   baseSubjectRef,
      evidenceType: Capability.ARTIST_IDENTITY,
    }));
    evidencePackages.push({ evidenceType: Capability.ARTIST_IDENTITY, contract: identityReport.contract });

    const resolvedMBID = mbid ?? extractMBID(identityReport.contract, artistName);
    if (!resolvedMBID) {
      // Artist not found in MusicBrainz — record identity evidence, return
      await pal.shutdown().catch(() => {});
      return { evidencePackages, acquired: false, elapsedMs: Date.now() - startMs };
    }

    const enrichedSubjectRef = { ...baseSubjectRef, mbid: resolvedMBID };

    // ── B: TRACKS + RELEASES (parallel) ─────────────────────────────────────
    const [tracksSettled, releasesSettled] = await Promise.allSettled([
      pal.acquire(MB_PROVIDER, createEvidenceRequest({
        subjectRef:   enrichedSubjectRef,
        evidenceType: Capability.TRACKS,
      })),
      pal.acquire(MB_PROVIDER, createEvidenceRequest({
        subjectRef:   enrichedSubjectRef,
        evidenceType: Capability.RELEASES,
      })),
    ]);

    if (tracksSettled.status === 'fulfilled') {
      evidencePackages.push({ evidenceType: Capability.TRACKS, contract: tracksSettled.value.contract });
    }
    if (releasesSettled.status === 'fulfilled') {
      evidencePackages.push({ evidenceType: Capability.RELEASES, contract: releasesSettled.value.contract });
    }

    return { evidencePackages, acquired: true, elapsedMs: Date.now() - startMs };

  } catch (err) {
    console.error('[mb-pal] acquisition error:', err.message);
    return { evidencePackages, acquired: false, elapsedMs: Date.now() - startMs };
  } finally {
    await pal.shutdown().catch(e => console.error('[mb-pal] shutdown error:', e.message));
  }
}

/**
 * Synthesize the legacy MusicBrainz compat shape from PAL evidence packages.
 *
 * [TRANSITIONAL]: Required by V1 module system (runModules / buildFlags).
 * Retires when those consumers migrate to RIE Rule Library.
 *
 * Returns { found, artists, topMatch, score } — same shape as getMusicBrainz().
 *
 * @param {EvidencePackage[]} evidencePackages
 * @param {string} [artistName]
 * @returns {{ found: boolean, artists: any[], topMatch: any|null, score: number }}
 */
export function synthesizeMBCompat(evidencePackages, artistName = '') {
  if (!Array.isArray(evidencePackages) || evidencePackages.length === 0) {
    return { found: false, artists: [], topMatch: null, score: 0 };
  }

  const identityPkg = evidencePackages.find(p => p.evidenceType === Capability.ARTIST_IDENTITY);
  if (!identityPkg || identityPkg.contract.completeness === 'empty') {
    return { found: false, artists: [], topMatch: null, score: 0 };
  }

  const artists  = extractArtists(identityPkg.contract);
  const norm     = s => (typeof s === 'string' ? s.toLowerCase().trim() : '');
  const target   = norm(artistName);
  const topMatch = target
    ? (artists.find(a => norm(a.name) === target) ?? null)
    : (artists[0] ?? null);

  return {
    found:    !!topMatch,
    artists,
    topMatch,
    score:    typeof topMatch?.score === 'number' ? topMatch.score : 0,
  };
}
