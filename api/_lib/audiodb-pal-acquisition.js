// AudioDB PAL Acquisition — Phase 3.6 Provider Expansion 08
//
// Routes all TheAudioDB evidence acquisition through the Provider Acquisition Layer.
// REPLACES: direct call to getAudioDB() in api/_lib/run-scan.js
//
// Constitutional constraint: acquires raw evidence only. No intelligence computed here.
// EvidencePackages flow directly into runRIE({ evidencePackages }).
//
// TheAudioDB public API requires no credentials.
// The connector initializes with only fetch options.
//
// Sequential acquisition:
//   A. ARTIST_IDENTITY — search by name (identity-lock) → full artist object
//      (biography, artwork, genres, social links all in the same search.php response)
//   B. COLLECTION_DATA + VIDEOS — parallel, using audiodbArtistId extracted from A's payload

import { ProviderAcquisitionLayer }  from '../../provider-acquisition/pal/ProviderAcquisitionLayer.js';
import { AudioDBConnector, PROVIDER_NAME as AUDIODB_PROVIDER } from '../../provider-acquisition/connectors/audiodb/AudioDBConnector.js';
import { createEvidenceRequest }      from '../../provider-acquisition/evidence/EvidenceRequest.js';
import { Capability }                 from '../../provider-acquisition/capability/capabilityVocabulary.js';

// ── Internal: find first evidence package matching one of the given types ─────
function findFirstByType(packages, ...types) {
  const typeSet = new Set(types);
  return packages.find(p => typeSet.has(p.evidenceType)) ?? null;
}

/**
 * Acquire TheAudioDB evidence via PAL for a single scan.
 *
 * @param {{ artistName: string }} param
 * @returns {Promise<{ evidencePackages: EvidencePackage[], acquired: boolean, elapsedMs: number }>}
 */
export async function acquireAudioDbEvidence({ artistName }) {
  const startMs = Date.now();

  if (!artistName) {
    return { evidencePackages: [], acquired: false, elapsedMs: 0 };
  }

  const pal = new ProviderAcquisitionLayer();
  try {
    await pal.activateConnector(new AudioDBConnector(), {});
  } catch (err) {
    console.error('[audiodb-pal] PAL activation failed:', err.message);
    return { evidencePackages: [], acquired: false, elapsedMs: Date.now() - startMs };
  }

  const evidencePackages = [];

  try {
    const subjectRef = { artistName };

    // ── A: ARTIST_IDENTITY (search + identity-lock) ─────────────────────────
    // The search.php response contains biography, artwork, genres, and social
    // links — all in a single API call. ARTIST_IDENTITY captures the full object.
    const identityReport = await pal.acquire(AUDIODB_PROVIDER, createEvidenceRequest({
      subjectRef,
      evidenceType: Capability.ARTIST_IDENTITY,
    }));
    evidencePackages.push({ evidenceType: Capability.ARTIST_IDENTITY, contract: identityReport.contract });

    // Stop if no identity match — no artist ID for subsequent calls
    if (identityReport.contract.completeness === 'empty') {
      await pal.shutdown().catch(() => {});
      return { evidencePackages, acquired: false, elapsedMs: Date.now() - startMs };
    }

    const audiodbArtistId = identityReport.contract.payload?.idArtist ?? null;
    if (!audiodbArtistId) {
      await pal.shutdown().catch(() => {});
      return { evidencePackages, acquired: false, elapsedMs: Date.now() - startMs };
    }

    const subjectWithId = { artistName, audiodbArtistId };

    // ── B: COLLECTION_DATA + VIDEOS (parallel) ─────────────────────────────
    const [discographySettled, videosSettled] = await Promise.allSettled([
      pal.acquire(AUDIODB_PROVIDER, createEvidenceRequest({
        subjectRef:   subjectWithId,
        evidenceType: Capability.COLLECTION_DATA,
      })),
      pal.acquire(AUDIODB_PROVIDER, createEvidenceRequest({
        subjectRef:   subjectWithId,
        evidenceType: Capability.VIDEOS,
      })),
    ]);

    if (discographySettled.status === 'fulfilled') {
      evidencePackages.push({ evidenceType: Capability.COLLECTION_DATA, contract: discographySettled.value.contract });
    }
    if (videosSettled.status === 'fulfilled') {
      evidencePackages.push({ evidenceType: Capability.VIDEOS, contract: videosSettled.value.contract });
    }

    return { evidencePackages, acquired: true, elapsedMs: Date.now() - startMs };

  } catch (err) {
    console.error('[audiodb-pal] acquisition error:', err.message);
    return { evidencePackages, acquired: false, elapsedMs: Date.now() - startMs };
  } finally {
    await pal.shutdown().catch(e => console.error('[audiodb-pal] shutdown error:', e.message));
  }
}

/**
 * Synthesize the legacy AudioDB shape from PAL evidence packages.
 *
 * [TRANSITIONAL]: Required by V1 module system (runModules / buildFlags / rawResponse).
 * Retires when those consumers migrate to RIE Rule Library.
 *
 * Produces the same shape as the retired getAudioDB() direct function:
 *   { found, name, genre, style, mood, country, biography(400),
 *     formed, website, youtube, facebook, twitter, instagram }
 *
 * biography is truncated to 400 chars for V1 module compat.
 * The full biography is preserved in platforms.audiodb.biography via EvidenceBridge.
 *
 * @param {EvidencePackage[]} evidencePackages
 * @param {string} artistName
 * @returns {object}
 */
export function synthesizeAudioDbCompat(evidencePackages, artistName) {
  const defaultResult = { found: false };

  if (!evidencePackages || evidencePackages.length === 0) {
    return defaultResult;
  }

  const identityPkg = findFirstByType(evidencePackages, Capability.ARTIST_IDENTITY);
  const a           = identityPkg?.contract?.payload;

  if (!a || typeof a !== 'object' || !a.idArtist) {
    return defaultResult;
  }

  // TheAudioDB field drift, live-verified 2026-07-17 (see Phase 4.0 AudioDB
  // modernization completion report): strBiographyEN was renamed to
  // strBiography; strYoutube/strInstagram no longer exist on the artist
  // object at all; strTwitter now returns the literal string "1" for every
  // artist rather than a URL, filtered out here rather than exposed as if
  // it were a real link.
  const twitter = a.strTwitter === '1' ? null : (a.strTwitter ?? null);

  return {
    found:     true,
    name:      a.strArtist  ?? artistName,
    genre:     a.strGenre   ?? null,
    style:     a.strStyle   ?? null,
    mood:      a.strMood    ?? null,
    country:   a.strCountry ?? null,
    biography: a.strBiography ? a.strBiography.substring(0, 400) : null,
    formed:    a.intFormedYear  ?? null,
    website:   a.strWebsite    ?? null,
    youtube:   a.strYoutube    ?? null,
    facebook:  a.strFacebook   ?? null,
    twitter,
    instagram: a.strInstagram  ?? null,
  };
}
