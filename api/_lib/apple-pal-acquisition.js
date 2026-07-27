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
import { enrichWithAppleRelease }     from './canonical-scan-subject-assembler.js';
import { selectTopVerifiedReleases }  from './best-verified-release.js';

// Canonical Artist Territory Intelligence™ (Board Decree, 2026-07-25) --
// the number of Best Verified Release™-ranked albums sampled for an
// artist-only scan's territory availability check. Named, Board-auditable
// constant, matching the existing pattern of GLOBAL_SF_WAVE_SIZE /
// STATUS_THRESHOLDS / BVR_* weights. Change only through formal Board Review.
export const TERRITORY_SAMPLE_SIZE = 5;

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
//
// Identity-lock (Board Phase 1, IC-2, 2026-07-27): mirrors the exact
// pattern already used by api/_lib/mb-pal-acquisition.js and
// api/_lib/discogs-pal-acquisition.js -- a free-text search result is
// only trusted when its name exactly matches the artist being resolved.
// Apple's search endpoint ranks by its own relevance scoring, not
// identity certainty; for a common/ambiguous name, the top hit is not
// guaranteed to be the correct artist. Every other provider connector in
// this codebase already refuses to guess here -- Apple was the one
// exception. No exact match among the returned hits means the artist is
// honestly unresolved (null), never a fuzzy first pick, consistent with
// this codebase's established never-fabricate convention.
//
// The direct-ID-lookup branch (p.data) is a CONFIRM, not a search --
// subjectRef.appleArtistId was already known and is being read back from
// Apple's own /artists/{id} response, so no verification is needed or
// possible there.
export function extractAppleArtistId(contract, artistName) {
  const p = contract?.payload;
  if (!p || typeof p !== 'object') return null;
  // Direct artist lookup: { data: [{ id, type: 'artists' }] }
  if (Array.isArray(p.data)) {
    const artist = p.data.find(n => n?.type === 'artists');
    if (artist?.id) return artist.id;
  }
  // Search result: { results: { artists: { data: [{ id, attributes: { name } }] } } }
  const hits = p.results?.artists?.data;
  if (!Array.isArray(hits) || hits.length === 0) return null;
  const norm  = s => (typeof s === 'string' ? s.toLowerCase().trim() : '');
  const target = norm(artistName);
  const match = hits.find(h => norm(h?.attributes?.name) === target);
  return match?.id ?? null;
}

// ── First album ID extraction from ALBUMS contract payload ────────────────────
// Exported for regression testing (tests/canonical-scan-subject-test.mjs) --
// this is the exact fallback used when no ISRC-resolved release exists.
export function extractFirstAlbumId(contract) {
  const data = contract?.payload?.data;
  if (!Array.isArray(data)) return null;
  const album = data.find(n => n?.type === 'albums');
  return album?.id ?? null;
}

// ── Album candidates extraction — flat objects for Best Verified Release™
//    ranking (Canonical Artist Territory Intelligence™, Board Decree
//    2026-07-25) ──────────────────────────────────────────────────────────
// Mirrors lib/rie/EvidenceBridge.js's translateAlbums() field mapping
// (id/name/releaseDate/trackCount/artwork/upc) verbatim. Duplicated
// deliberately as a small, stable JSON:API extraction (not business logic)
// rather than importing EvidenceBridge's private helper -- matches this
// file's existing pattern of owning its own small raw-payload extractors
// (extractFirstAlbumId, extractFirstIsrcSong), and EvidenceBridge operates
// one layer downstream (post-acquisition canonical translation), not here.
// Exported for regression testing, matching extractFirstAlbumId's convention.
export function extractAlbumCandidates(contract) {
  const data = contract?.payload?.data;
  if (!Array.isArray(data)) return [];
  return data
    .filter(n => n?.type === 'albums')
    .map(n => ({
      id:          typeof n.id === 'string' ? n.id : null,
      name:        n.attributes?.name         ?? null,
      releaseDate: n.attributes?.releaseDate  ?? null,
      trackCount:  n.attributes?.trackCount   ?? 0,
      artwork:     n.attributes?.artwork?.url ?? null,
      url:         n.attributes?.url          ?? null,
      upc:         n.attributes?.upc          ?? null,
    }))
    .filter(a => a.id); // territory checks require a real album id
}

// extractFirstIsrcSong: returns the matched Apple Song resource from a
// Capability.ISRC contract (raw /catalog/{sf}/songs?filter[isrc]=X&include=albums
// response), or null. Structural extraction only -- does not classify or
// score anything (matches this file's other extract* helpers' pattern).
export function extractFirstIsrcSong(contract) {
  const data = contract?.payload?.data;
  if (!Array.isArray(data)) return null;
  const song = data.find(n => n?.type === 'songs');
  return song ?? null;
}

/**
 * Acquire Apple Music evidence via PAL for a single scan.
 *
 * @param {{ appleArtistId?: string|null, artistName: string, isrc?: string|null, canonicalScanSubject?: object|null }} subjectHint
 *   canonicalScanSubject: the seed Canonical Scan Subject™ from
 *   api/_lib/canonical-scan-subject-assembler.js#seedCanonicalScanSubject(),
 *   created immediately after Identity Resolution in run-scan.js.
 * @returns {Promise<{ evidencePackages: EvidencePackage[], acquired: boolean, elapsedMs: number, canonicalScanSubject: object|null }>}
 *   canonicalScanSubject in the return value is the ENRICHED subject (a new
 *   frozen object; the seed is never mutated) once the Apple ISRC->song
 *   lookup resolves. Null when no seed was passed in.
 */
export async function acquireAppleEvidence({ appleArtistId = null, artistName, isrc = null, canonicalScanSubject = null }) {
  const startMs = Date.now();
  const evidencePackages = [];

  const config = getPalConfig();
  if (!config.teamId || !config.keyId || !config.privateKey) {
    console.warn('[apple-pal] Apple Music credentials not configured — skipping PAL acquisition');
    return { evidencePackages: [], acquired: false, elapsedMs: Date.now() - startMs, canonicalScanSubject };
  }

  const pal = new ProviderAcquisitionLayer();
  try {
    await pal.activateConnector(new AppleMusicConnector(), config);
  } catch (err) {
    console.error('[apple-pal] PAL activation failed:', err.message);
    return { evidencePackages: [], acquired: false, elapsedMs: Date.now() - startMs, canonicalScanSubject };
  }

  try {
    const baseSubjectRef = appleArtistId ? { appleArtistId, artistName } : { artistName };

    // ── A: ARTIST_IDENTITY ───────────────────────────────────────────────
    const identityReport = await pal.acquire(APPLE_PROVIDER, createEvidenceRequest({
      subjectRef:   baseSubjectRef,
      evidenceType: Capability.ARTIST_IDENTITY,
    }));
    evidencePackages.push({ evidenceType: Capability.ARTIST_IDENTITY, contract: identityReport.contract });

    const resolvedAppleArtistId = appleArtistId ?? extractAppleArtistId(identityReport.contract, artistName);
    if (!resolvedAppleArtistId) {
      // Apple artist not found — record identity evidence and return
      await pal.shutdown().catch(() => {});
      return { evidencePackages, acquired: false, elapsedMs: Date.now() - startMs, canonicalScanSubject };
    }

    const enrichedSubjectRef = { ...baseSubjectRef, appleArtistId: resolvedAppleArtistId };

    // ── B: ALBUMS + TRACKS + optional ISRC + VIDEOS (parallel) ───────────
    // ISRC Intelligence™ v1 (Board directive, 2026-07-21): TRACKS added --
    // every other connector (Spotify/Deezer/MusicBrainz/TIDAL/Last.fm)
    // already requests this capability; Apple was the one provider that
    // never did, despite the connector supporting it since #fetchArtistTracks()
    // was written. This is the artist's own official Apple Music song
    // catalog with real per-track ISRC attributes -- the authoritative v1
    // evidence source for ISRC Intelligence™ (see isrc-intelligence.js).
    const parallelB = [
      pal.acquire(APPLE_PROVIDER, createEvidenceRequest({
        subjectRef:   enrichedSubjectRef,
        evidenceType: Capability.ALBUMS,
      })),
      pal.acquire(APPLE_PROVIDER, createEvidenceRequest({
        subjectRef:   enrichedSubjectRef,
        evidenceType: Capability.TRACKS,
      })),
      // Media PAL Expansion™ — artist music-videos catalog. Index [2] is
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

    const [albumsSettled, tracksSettled, videosSettled, isrcSettled] = await Promise.allSettled(parallelB);

    let albumsReport = null;
    if (albumsSettled?.status === 'fulfilled') {
      albumsReport = albumsSettled.value;
      evidencePackages.push({ evidenceType: Capability.ALBUMS, contract: albumsReport.contract });
    }
    if (tracksSettled?.status === 'fulfilled') {
      evidencePackages.push({ evidenceType: Capability.TRACKS, contract: tracksSettled.value.contract });
    }
    if (videosSettled?.status === 'fulfilled') {
      evidencePackages.push({ evidenceType: Capability.VIDEOS, contract: videosSettled.value.contract });
    }
    if (isrcSettled?.status === 'fulfilled') {
      evidencePackages.push({ evidenceType: Capability.ISRC, contract: isrcSettled.value.contract });
    }

    // ── Canonical Scan Subject™ enrichment (Phase 2 Recovery, 2026-07-20) ──
    // The confirmed defect: this ISRC-matched song was already resolved
    // above (Capability.ISRC) and, before this fix, was never read back --
    // Territory Intelligence fell back to an arbitrary catalog-order album
    // instead. resolvedAppleSong is the exact release the artist scanned,
    // when an ISRC was known; null for artist-only scans.
    const resolvedAppleSong = isrcSettled?.status === 'fulfilled'
      ? extractFirstIsrcSong(isrcSettled.value.contract)
      : null;
    const enrichedScanSubject = enrichWithAppleRelease(canonicalScanSubject, resolvedAppleSong);
    const resolvedReleaseAlbumId = enrichedScanSubject.providerIds.apple.albumId;

    // ── C: AVAILABILITY — global 167-storefront check ────────────────────
    //
    // Canonical Artist Territory Intelligence™ (Board Decree, 2026-07-25):
    // the scan entry point determines the intelligence scope.
    //
    //   Song/Release-scoped scan (resolvedReleaseAlbumId known) -- unchanged
    //   single-release evaluation, exactly as before this decree.
    //
    //   Artist-only scan (no ISRC resolved) -- evaluates a Board-approved,
    //   evidence-ranked SAMPLE of the artist's catalog (Best Verified
    //   Release™ scoring, reused strictly as an evidence-ranking
    //   optimization -- see best-verified-release.js's
    //   selectTopVerifiedReleases() header). extractFirstAlbumId() no
    //   longer determines artist territory intelligence (Board directive)
    //   -- it remains exported only for the raw-utility regression tests
    //   that exercise it in isolation.
    //
    //   If BVR scoring finds zero eligible releases (malformed/empty album
    //   metadata -- rare), availabilityAlbumIds is empty and NO
    //   AVAILABILITY evidence package is added at all: Territory
    //   Intelligence Engine™ then honestly reports NOT_EVALUATED for every
    //   territory, rather than reintroducing a fabricated single-album
    //   guess. Never invents evidence where none can be honestly derived.
    // Territory Evaluation Methodology™ (Board Pre-Merge Validation Directive,
    // Part 2, 2026-07-25): the 5-release sample is a BOUNDED APPROXIMATION,
    // not the final canonical methodology -- explicitly classified per the
    // Board's requirement, not silently presented as complete-catalog truth.
    // Carried through the evidence package itself (not just the UI) so
    // Royaltē never loses this transparency, even if no surface currently
    // renders it. isCompleteCatalogEvaluation is true only when the sample
    // genuinely covers every eligible candidate (small catalogs).
    let availabilityAlbumIds;
    let territoryMethodology;
    if (resolvedReleaseAlbumId) {
      availabilityAlbumIds = [resolvedReleaseAlbumId];
      territoryMethodology = Object.freeze({
        evaluationScope:            'release_specific',
        sampleSize:                 1,
        catalogReleaseCount:        null,
        selectionMethod:            'isrc_resolved_release',
        isCompleteCatalogEvaluation: null,
      });
    } else {
      const albumCandidates = albumsReport ? extractAlbumCandidates(albumsReport.contract) : [];
      const ranked = selectTopVerifiedReleases(albumCandidates, enrichedSubjectRef.artistName, TERRITORY_SAMPLE_SIZE);
      availabilityAlbumIds = ranked.map(r => r.id);
      territoryMethodology = Object.freeze({
        evaluationScope:            'artist_sample',
        sampleSize:                 ranked.length,
        catalogReleaseCount:        albumCandidates.length,
        selectionMethod:            'best_verified_release',
        isCompleteCatalogEvaluation: albumCandidates.length > 0 && ranked.length >= albumCandidates.length,
      });
    }

    if (availabilityAlbumIds.length > 0) {
      const availReport = await pal.acquire(APPLE_PROVIDER, createEvidenceRequest({
        subjectRef:   { ...enrichedSubjectRef, appleAlbumIds: availabilityAlbumIds, territoryMethodology },
        evidenceType: Capability.AVAILABILITY,
      }));
      evidencePackages.push({ evidenceType: Capability.AVAILABILITY, contract: availReport.contract });
    }

    return { evidencePackages, acquired: true, elapsedMs: Date.now() - startMs, canonicalScanSubject: enrichedScanSubject };

  } catch (err) {
    console.error('[apple-pal] acquisition error:', err.message);
    return { evidencePackages, acquired: false, elapsedMs: Date.now() - startMs, canonicalScanSubject };
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
    // Apple returns "{w}x{h}bb.jpg" artwork templates on every album entry,
    // same as the artist-level artworkUrl above -- substitute here too so
    // Best Verified Release™ artwork (and any other album-artwork consumer)
    // receives a real, loadable URL instead of an unresolved template.
    albums:                      Array.isArray(am.details?.albums)
      ? am.details.albums.map(al => ({ ...al, artwork: substituteArtworkDimensions(al.artwork) }))
      : [],
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
