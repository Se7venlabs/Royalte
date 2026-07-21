// ─────────────────────────────────────────────────────────────────────
//  Royaltē Catalog Intelligence™ — Assembler  (Phase 3.4 — v1.1.0)
// ─────────────────────────────────────────────────────────────────────
//
//  Constitutional position (Board Option 3, Phase 2 Recovery, 2026-07-20):
//
//    Scan Engine
//        ↓
//    api/_lib/catalog-evidence.js  (Normalization — structural relocation only)
//        ↓ Canonical Catalog Evidence: appleAlbums[], appleTracks[],
//        ↓   appleTracksAssessed, discogsReleases[], fallbackCounts
//    Catalog Intelligence™  ◀── THIS MODULE (business logic lives here)
//        ↓
//    Mission Control™ · Catalog Intelligence Card
//    Website Scan · Catalog panel
//
//  This module no longer reads canonicalForEnrichment directly (former
//  CIO-bypass, certified in governance/NORMALIZATION_LAYER_PLATFORM_CERTIFICATION.md
//  and governance/CANONICAL_SCHEMA_CIO_CIM_PLATFORM_CERTIFICATION.md, resolved
//  per ADR-002 Option 3: the CIO stays lean, a sibling canonical evidence
//  object carries what this domain needs, business logic stays here).
//
//  Data source hierarchy (Board directive, unchanged):
//    Primary:   evidence.appleAlbums → singles / EPs / albums classification
//               by trackCount
//    Fallback:  evidence.fallbackCounts (Spotify album_group classification,
//               pre-computed upstream) when Apple album list is unavailable
//               (Apple wins when both are present because Apple is canonical).
//
//  ISRC Intelligence™ v1 (Board directive, 2026-07-21):
//    Delegated entirely to api/_lib/isrc-intelligence.js — assembled from
//    evidence.appleTracks / evidence.appleTracksAssessed (Apple Music
//    Capability.TRACKS, the artist's own official catalog). This module
//    no longer computes ISRC coverage itself; see that module's header
//    for the full v1 scope, states, and Version 2 roadmap.
//
//  Purity invariants:
//    - Pure function of (intelligenceReport, cio, catalogEvidence).
//    - Never throws on any input (null / undefined / malformed).
//    - Never mutates inputs.
//    - Output is deep-frozen.
//    - Never recomputes intelligence; only assembles from pre-computed
//      canonical data (constitutionally: products read, never recalculate).
//
// ─────────────────────────────────────────────────────────────────────
//  Output shape (v1.1):
//
//    {
//      singles:       number,  // Apple-canonical owned single releases
//      eps:           number,  // Apple-canonical owned EP releases
//      albums:        number,  // Apple-canonical owned album releases
//      totalTracks:   number,  // total tracks across owned releases
//      catalogStatus: string,  // 'Limited Catalog' | 'Stable' | 'Growing'
//                               // | 'Expanding' | 'Large Catalog'
//      confidence:    string,  // 'Verified' | 'Partial' | 'Not Found' |
//                               // 'Unable to Confirm'
//      isrcIntelligence: object,  // ISRC Intelligence™ v1 — see
//                                  // api/_lib/isrc-intelligence.js for the
//                                  // full shape (status/assessedCount/
//                                  // verifiedCount/missingCount/
//                                  // coveragePercent/conflictState/
//                                  // matchMethod/missingRecordings/provenance)
//    }
//
// ─────────────────────────────────────────────────────────────────────

export const CATALOG_INTELLIGENCE_VERSION = '1.3.0';

import { CATALOG_EVIDENCE_POLICY } from './catalog-evidence-policy.js';
import { selectBestVerifiedRelease } from './best-verified-release.js';
import { assembleIsrcIntelligence } from './isrc-intelligence.js';

// Board-locked release-count thresholds for catalogStatus.
// Change only through a formal Board Review.
const STATUS_THRESHOLDS = Object.freeze({
  LIMITED:   0,   // 0 owned releases
  STABLE:    1,   // 1–6
  GROWING:   7,   // 7–20
  EXPANDING: 21,  // 21–40
  LARGE:     41,  // 41+
});

function deepFreeze(obj) {
  if (obj === null || typeof obj !== 'object') return obj;
  for (const k of Object.keys(obj)) {
    const v = obj[k];
    if (v !== null && typeof v === 'object' && !Object.isFrozen(v)) deepFreeze(v);
  }
  return Object.freeze(obj);
}

// classifyAppleAlbums — Apple Music is canonical for release type.
// trackCount === 1 → single · 2–6 → EP · 7+ → album.
function classifyAppleAlbums(albums) {
  let singles = 0, eps = 0, albumCount = 0, totalTracks = 0;
  for (const a of albums) {
    const tc = typeof a.trackCount === 'number' ? a.trackCount : 7;
    totalTracks += tc;
    if (tc === 1) singles++;
    else if (tc <= 6) eps++;
    else albumCount++;
  }
  return { singles, eps, albums: albumCount, totalTracks };
}

// deriveCatalogStatus — pure function of owned release count.
function deriveCatalogStatus(ownedCount) {
  if (ownedCount <= 0) return 'Limited Catalog';
  if (ownedCount <= STATUS_THRESHOLDS.GROWING - 1)   return 'Stable';
  if (ownedCount <= STATUS_THRESHOLDS.EXPANDING - 1) return 'Growing';
  if (ownedCount <= STATUS_THRESHOLDS.LARGE - 1)     return 'Expanding';
  return 'Large Catalog';
}

// deriveConfidence — based on Apple Music availability in the catalog evidence.
function deriveConfidence(evidence) {
  const avail = evidence?.appleAvailability;
  if (avail === 'VERIFIED')   return 'Verified';
  if (avail === 'NOT_FOUND')  return 'Not Found';
  return 'Partial';
}

// deriveYearRange — extracts firstReleaseYear / latestReleaseYear from
// Apple Music album objects.  Pure presentational metadata; does not
// classify or score anything.  Null when Apple albums are absent.
function deriveYearRange(albums) {
  if (!Array.isArray(albums) || !albums.length) {
    return { firstReleaseYear: null, latestReleaseYear: null, catalogAgeYears: null };
  }
  const currentYear = new Date().getFullYear();
  const years = albums
    .map((a) => {
      if (!a?.releaseDate) return null;
      const y = new Date(a.releaseDate).getFullYear();
      return (y > 1900 && y <= currentYear) ? y : null;
    })
    .filter((y) => y !== null);
  if (!years.length) return { firstReleaseYear: null, latestReleaseYear: null, catalogAgeYears: null };
  const first  = Math.min(...years);
  const latest = Math.max(...years);
  return { firstReleaseYear: first, latestReleaseYear: latest, catalogAgeYears: latest - first };
}

// assembleCatalogIntelligence(intelligenceReport, cio, catalogEvidence)
//
// Sole entrypoint for Catalog Intelligence™. Certifies all catalog-domain
// values consumed by every product surface.
//
// catalogEvidence is the Canonical Catalog Evidence object produced by
// api/_lib/catalog-evidence.js (Board Option 3, Phase 2 Recovery) — this
// module no longer reads canonicalForEnrichment directly.
//
// Always returns a deep-frozen object. Never throws.
export function assembleCatalogIntelligence(intelligenceReport, cio, catalogEvidence) {
  try {
    const evidence = (catalogEvidence && typeof catalogEvidence === 'object' && !Array.isArray(catalogEvidence))
      ? catalogEvidence
      : {};

    // Primary: Apple Music albums → singles / EPs / albums / totalTracks
    const appleAlbums = evidence.appleAlbums;
    let singles, eps, albums, totalTracks;

    if (Array.isArray(appleAlbums) && appleAlbums.length > 0) {
      const classified = classifyAppleAlbums(appleAlbums);
      singles     = classified.singles;
      eps         = classified.eps;
      albums      = classified.albums;
      totalTracks = classified.totalTracks;
    } else {
      // Fallback: Spotify-derived classification, pre-computed upstream
      const fb = evidence.fallbackCounts || {};
      singles     = typeof fb.singles     === 'number' ? fb.singles     : 0;
      eps         = typeof fb.eps         === 'number' ? fb.eps         : 0;
      albums      = typeof fb.albums      === 'number' ? fb.albums      : 0;
      totalTracks = typeof fb.totalTracks === 'number' ? fb.totalTracks : 0;
    }

    // Note: featuresCount (Spotify appears_on) is intentionally excluded.
    // Cannot prove canonical ownership of appearances without identity-locking them.
    // Deferred to Featured Appearance Intelligence™ domain.

    const ownedCount    = singles + eps + albums;
    const catalogStatus = deriveCatalogStatus(ownedCount);
    const confidence    = deriveConfidence(evidence);
    const isrcIntelligence = assembleIsrcIntelligence(evidence);

    // Discogs: physical release count and year range (Phase 3.6/Discogs)
    // Provider precedence for release chronology is owned by CATALOG_EVIDENCE_POLICY.
    // Current order: CATALOG_EVIDENCE_POLICY.releaseChronology = ['apple', 'discogs']
    const discogsReleases = evidence.discogsReleases;
    const physicalReleaseCount = typeof evidence.discogsTotalReleases === 'number'
      ? evidence.discogsTotalReleases
      : null;

    // Year range: Apple is canonical. Discogs supplements when Apple is absent.
    const appleAlbumsForYear = Array.isArray(appleAlbums) ? appleAlbums : [];
    const { firstReleaseYear: appleFirst, latestReleaseYear: appleLast, catalogAgeYears: appleAge } =
      deriveYearRange(appleAlbumsForYear);

    let firstReleaseYear = appleFirst;
    let latestReleaseYear = appleLast;
    let catalogAgeYears  = appleAge;

    // Fall back to Discogs year data when Apple albums are absent.
    // Discogs releases carry a numeric `year` field — extract directly to avoid
    // date-parsing timezone boundary issues from `new Date('YYYY-01-01').getFullYear()`.
    if (firstReleaseYear === null && Array.isArray(discogsReleases) && discogsReleases.length > 0) {
      const currentYear = new Date().getFullYear();
      const dcYears = discogsReleases
        .map(r => r.year)
        .filter(y => typeof y === 'number' && y > 1900 && y <= currentYear);
      if (dcYears.length > 0) {
        firstReleaseYear  = Math.min(...dcYears);
        latestReleaseYear = Math.max(...dcYears);
        catalogAgeYears   = latestReleaseYear - firstReleaseYear;
      }
    }

    // Best Verified Release™ — intelligence-selected representative release.
    // selectBestVerifiedRelease scores every eligible Apple Music album and
    // returns the highest-ranked one. Never throws; returns null when no
    // albums are available.
    //
    // artistName now sourced from cio.identity.canonicalArtistName (the CIO
    // this function already receives) rather than canonicalForEnrichment,
    // completing the removal of the direct canonical read. The prior
    // fallback (safeCanonical?.cio?.identity?.name) was itself dead code:
    // canonicalForEnrichment has no nested .cio property, and the CIO's
    // real field is canonicalArtistName, not name -- it could never fire.
    const artistName = (cio && typeof cio === 'object' && cio.identity
      && typeof cio.identity.canonicalArtistName === 'string')
      ? cio.identity.canonicalArtistName
      : '';
    const bestVerifiedRelease = selectBestVerifiedRelease(
      Array.isArray(appleAlbums) ? appleAlbums : [],
      artistName,
    );

    return deepFreeze({
      singles,
      eps,
      albums,
      totalTracks,
      catalogStatus,
      confidence,
      isrcIntelligence,
      firstReleaseYear,
      latestReleaseYear,
      catalogAgeYears,
      physicalReleaseCount,
      bestVerifiedRelease,
    });
  } catch (err) {
    console.error('[catalog-intelligence] assembly threw (returning empty shell):', err?.message || err);
    return deepFreeze({
      singles: 0, eps: 0, albums: 0, totalTracks: 0,
      catalogStatus: 'Limited Catalog',
      confidence: 'Unable to Confirm',
      isrcIntelligence: assembleIsrcIntelligence(null),
      firstReleaseYear: null, latestReleaseYear: null, catalogAgeYears: null,
      physicalReleaseCount: null,
      bestVerifiedRelease: null,
    });
  }
}
