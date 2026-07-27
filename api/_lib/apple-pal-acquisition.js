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
//   C. AVAILABILITY      — global 167-storefront check (needs the resolved
//      release from B, or -- Canonical Artist Presence™, Board Decree
//      2026-07-27 -- the artist's full paginated catalog, acquired via
//      acquireFullAlbumCatalog() starting from B's first ALBUMS page)
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

// Canonical Artist Presence™ (Board Decree, 2026-07-27) -- supersedes the
// Best Verified Release™-ranked 5-release sample (2026-07-25 decree,
// PR #428). Artist-only territory evaluation now acquires the artist's
// FULL Apple Music catalog (paginated beyond the connector's 25-per-page
// default) rather than a ranked subset. Best Verified Release™ scoring is
// no longer used to define artist territory presence -- release ranking
// is not the intelligence Mission Control reports; the release(s) that
// prove availability are evidence only.
//
// MAX_CATALOG_PAGES bounds worst-case acquisition cost for an
// unrealistically large catalog (25/page -- 12 pages = up to 300 albums,
// well beyond any real artist observed; Prince, one of the most prolific
// legacy catalogs on Apple Music, has 80). Named, Board-auditable
// constant, matching the existing pattern of GLOBAL_SF_WAVE_SIZE /
// APPLE_MAX_IDS_PER_REQUEST. Change only through formal Board Review.
export const MAX_CATALOG_PAGES = 12;

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

// ── Canonical Artist Presence™ — full-catalog acquisition ─────────────────
// (Board Decree, 2026-07-27). Given the artist's first ALBUMS page
// (already acquired, unconditionally, by the parallel B step below --
// unaffected by this function), follows Apple's `next` pagination link
// to acquire every remaining page, up to MAX_CATALOG_PAGES as a bounded
// safety cap. Returns { candidates, catalogReleaseCount, isCompleteCatalogEvaluation }.
//
// Deliberately issues each extra page as its own Capability.ALBUMS
// pal.acquire() call (via subjectRef.albumsOffset) but never pushes them
// into evidencePackages -- Catalog Intelligence™ and every other
// Capability.ALBUMS consumer reads only the first package found
// (findFirst semantics in EvidenceBridge.js), so this stays entirely
// local to territory evaluation and cannot change any other domain's
// evidence.
export async function acquireFullAlbumCatalog(pal, enrichedSubjectRef, firstPageContract) {
  const pages = [firstPageContract];
  let next = firstPageContract?.payload?.next;

  for (let page = 1; page < MAX_CATALOG_PAGES && next; page++) {
    const offset = page * 25;
    let report;
    try {
      report = await pal.acquire(APPLE_PROVIDER, createEvidenceRequest({
        subjectRef:   { ...enrichedSubjectRef, albumsOffset: offset },
        evidenceType: Capability.ALBUMS,
      }));
    } catch {
      break; // honest degradation: stop paginating, evaluate what was acquired
    }
    if (!report?.contract?.payload?.data) break;
    pages.push(report.contract);
    next = report.contract.payload.next;
  }

  const seen = new Set();
  const candidates = [];
  for (const contract of pages) {
    for (const candidate of extractAlbumCandidates(contract)) {
      if (seen.has(candidate.id)) continue;
      seen.add(candidate.id);
      candidates.push(candidate);
    }
  }

  return {
    candidates,
    catalogReleaseCount: candidates.length,
    // true only if pagination genuinely reached the end of the catalog
    // (Apple stopped returning a `next` link) rather than being
    // truncated by the safety cap -- an honest completeness signal, not
    // an assumption.
    isCompleteCatalogEvaluation: !next,
  };
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

    const resolvedAppleArtistId = appleArtistId ?? extractAppleArtistId(identityReport.contract);
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
    // Canonical Artist Presence™ (Board Decree, 2026-07-27) -- supersedes
    // the 2026-07-25 Best Verified Release™-ranked sample entirely. The
    // scan entry point still determines the intelligence scope:
    //
    //   Song/Release-scoped scan (resolvedReleaseAlbumId known) -- unchanged
    //   single-release evaluation, exactly as before either decree. A
    //   release-specific question ("is THIS release available") is a
    //   legitimate, different question from artist presence, and is out
    //   of scope for this correction.
    //
    //   Artist-only scan (no ISRC resolved) -- acquires the artist's FULL
    //   Apple Music catalog (paginated via acquireFullAlbumCatalog(), not
    //   a ranked subset) and evaluates presence via OR-aggregation across
    //   every acquired release. Best Verified Release™ scoring no longer
    //   defines artist territory presence -- release selection is an
    //   acquisition-layer implementation detail, never the intelligence
    //   Mission Control reports. extractFirstAlbumId() remains exported
    //   only for the raw-utility regression tests that exercise it in
    //   isolation; selectTopVerifiedReleases() remains available for other
    //   Best Verified Release™ consumers but is no longer invoked here.
    //
    //   If the catalog is genuinely empty (no eligible releases --
    //   malformed/empty album metadata, rare), availabilityAlbumIds is
    //   empty and NO AVAILABILITY evidence package is added at all:
    //   Territory Intelligence Engine™ then honestly reports NOT_EVALUATED
    //   for every territory, rather than fabricating a guess. Never
    //   invents evidence where none can be honestly derived.
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
      const { candidates, catalogReleaseCount, isCompleteCatalogEvaluation } =
        albumsReport ? await acquireFullAlbumCatalog(pal, enrichedSubjectRef, albumsReport.contract)
                      : { candidates: [], catalogReleaseCount: 0, isCompleteCatalogEvaluation: true };
      availabilityAlbumIds = candidates.map(c => c.id);
      territoryMethodology = Object.freeze({
        evaluationScope:            'artist_full_catalog',
        sampleSize:                 candidates.length,
        catalogReleaseCount,
        selectionMethod:            'full_catalog_acquisition',
        isCompleteCatalogEvaluation,
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
