// ─────────────────────────────────────────────────────────────────────
//  Royaltē Catalog Intelligence™ — Assembler  (Phase 3.4 — v1.1.0)
// ─────────────────────────────────────────────────────────────────────
//
//  Constitutional position:
//
//    Scan Engine
//        ↓ catalog.{singlesCount,epsCount,albumsCount,featuresCount,totalTracks}
//        ↓ platforms.appleMusic.details.albums[]
//        ↓ platforms.appleMusic.details.catalogComparison (ISRC evidence)
//    Canonical Intelligence Object™  (catalog summary)
//        ↓
//    Rule Library™
//        ↓
//    Catalog Intelligence™  ◀── THIS MODULE
//        ↓
//    Mission Control™ · Catalog Intelligence Card
//    Website Scan · Catalog panel
//
//  Data source hierarchy (Board directive):
//    Primary:   Apple Music albums (via canonical.platforms.appleMusic.details.albums)
//               → singles / EPs / albums classification by trackCount
//    Fallback:  canonical.catalog.singlesCount/epsCount/albumsCount from
//               Spotify album_group classification when Apple album list
//               is unavailable (both paths set these fields; Apple wins
//               when both are present because Apple is canonical).
//
//  ISRC Coverage evidence:
//    Primary:   canonical.platforms.appleMusic.details.catalogComparison
//               Populated when the Apple-Spotify ISRC cross-reference ran
//               (legacy path; PAL TRACKS capability will repopulate once added).
//               Shape: { tracksChecked, matched: [], notFound: [], matchRate }
//    When absent: isrcCoverage.status = 'Unknown' (not yet assessed).
//
//  Purity invariants:
//    - Pure function of (intelligenceReport, cio, canonical).
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
//      isrcCoverage: {          // RIE-certified ISRC assessment
//        status:          string,         // 'Unknown' | 'Limited' | 'Partial' | 'Complete'
//        assessed:        boolean,        // true when evidence was available
//        assessedCount:   number,         // tracks whose ISRC status was evaluated
//        verifiedCount:   number,         // tracks with confirmed ISRC
//        coveragePercent: number | null,  // 0–100; null when not assessed
//      },
//    }
//
// ─────────────────────────────────────────────────────────────────────

export const CATALOG_INTELLIGENCE_VERSION = '1.1.0';

import { CATALOG_EVIDENCE_POLICY } from './catalog-evidence-policy.js';

// Board-locked release-count thresholds for catalogStatus.
// Change only through a formal Board Review.
const STATUS_THRESHOLDS = Object.freeze({
  LIMITED:   0,   // 0 owned releases
  STABLE:    1,   // 1–6
  GROWING:   7,   // 7–20
  EXPANDING: 21,  // 21–40
  LARGE:     41,  // 41+
});

// Board-locked ISRC coverage thresholds (coverage percent of assessed tracks).
// Pending formal Board ratification — named constants so the Board can
// adjust without hunting for hardcoded numbers.
const ISRC_THRESHOLDS = Object.freeze({
  COMPLETE: 75,  // ≥ 75% tracks with verified ISRC → 'Complete'
  PARTIAL:  25,  // 25–74% → 'Partial'
  LIMITED:   1,  // 1–24% → 'Limited'
  // < 1% (or no assessment) → 'Unknown'
});

const ISRC_UNKNOWN = Object.freeze({
  status: 'Unknown', assessed: false, assessedCount: 0, verifiedCount: 0, coveragePercent: null,
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

// deriveConfidence — based on Apple Music availability in the canonical payload.
function deriveConfidence(canonical) {
  const avail = canonical?.platforms?.appleMusic?.availability;
  if (avail === 'VERIFIED')   return 'Verified';
  if (avail === 'NOT_FOUND')  return 'Not Found';
  return 'Partial';
}

// deriveIsrcStatus — maps a coverage percentage to the constitutional vocabulary.
function deriveIsrcStatus(pct) {
  if (typeof pct !== 'number' || pct < ISRC_THRESHOLDS.LIMITED) return 'Unknown';
  if (pct >= ISRC_THRESHOLDS.COMPLETE) return 'Complete';
  if (pct >= ISRC_THRESHOLDS.PARTIAL)  return 'Partial';
  return 'Limited';
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

// assembleIsrcCoverage — derives ISRC Coverage from provider evidence.
//
// Primary source: platforms.appleMusic.details.catalogComparison
//   (Apple-Spotify ISRC cross-reference from legacy getAppleMusic() or
//    future PAL TRACKS capability when added).
//
// When no evidence is present: returns ISRC_UNKNOWN (status: 'Unknown').
// trackIsrc (single-track sentinel) is intentionally NOT used as a proxy
// for catalog-wide ISRC coverage — one verified track ≠ catalog completeness.
function assembleIsrcCoverage(canonical) {
  const cc = canonical?.platforms?.appleMusic?.details?.catalogComparison;
  if (cc && typeof cc.matchRate === 'number') {
    const pct = cc.matchRate;
    return Object.freeze({
      status:          deriveIsrcStatus(pct),
      assessed:        true,
      assessedCount:   typeof cc.tracksChecked === 'number' ? cc.tracksChecked
                       : (Array.isArray(cc.matched) && Array.isArray(cc.notFound)
                          ? cc.matched.length + cc.notFound.length : 0),
      verifiedCount:   Array.isArray(cc.matched) ? cc.matched.length : 0,
      coveragePercent: pct,
    });
  }
  return ISRC_UNKNOWN;
}

// assembleCatalogIntelligence(intelligenceReport, cio, canonical)
//
// Sole entrypoint for Catalog Intelligence™. Certifies all catalog-domain
// values consumed by every product surface.
//
// Always returns a deep-frozen object. Never throws.
export function assembleCatalogIntelligence(intelligenceReport, cio, canonical) {
  try {
    const safeCanonical = (canonical && typeof canonical === 'object' && !Array.isArray(canonical))
      ? canonical
      : {};

    // Primary: Apple Music albums → singles / EPs / albums / totalTracks
    const appleAlbums = safeCanonical?.platforms?.appleMusic?.details?.albums;
    let singles, eps, albums, totalTracks;

    if (Array.isArray(appleAlbums) && appleAlbums.length > 0) {
      const classified = classifyAppleAlbums(appleAlbums);
      singles     = classified.singles;
      eps         = classified.eps;
      albums      = classified.albums;
      totalTracks = classified.totalTracks;
    } else {
      // Fallback: Spotify-derived classification from catalog section
      const cat = safeCanonical.catalog || {};
      singles     = typeof cat.singlesCount === 'number' ? cat.singlesCount : 0;
      eps         = typeof cat.epsCount     === 'number' ? cat.epsCount     : 0;
      albums      = typeof cat.albumsCount  === 'number' ? cat.albumsCount  : 0;
      totalTracks = typeof cat.totalTracks  === 'number' ? cat.totalTracks  : 0;
    }

    // Note: featuresCount (Spotify appears_on) is intentionally excluded.
    // Cannot prove canonical ownership of appearances without identity-locking them.
    // Deferred to Featured Appearance Intelligence™ domain.

    const ownedCount    = singles + eps + albums;
    const catalogStatus = deriveCatalogStatus(ownedCount);
    const confidence    = deriveConfidence(safeCanonical);
    const isrcCoverage  = assembleIsrcCoverage(safeCanonical);

    // Discogs: physical release count and year range (Phase 3.6/Discogs)
    // Provider precedence for release chronology is owned by CATALOG_EVIDENCE_POLICY.
    // Current order: CATALOG_EVIDENCE_POLICY.releaseChronology = ['apple', 'discogs']
    const discogsReleases = safeCanonical?.platforms?.discogs?.details?.releases;
    const physicalReleaseCount = typeof safeCanonical?.platforms?.discogs?.details?.totalReleases === 'number'
      ? safeCanonical.platforms.discogs.details.totalReleases
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

    return deepFreeze({
      singles,
      eps,
      albums,
      totalTracks,
      catalogStatus,
      confidence,
      isrcCoverage,
      firstReleaseYear,
      latestReleaseYear,
      catalogAgeYears,
      physicalReleaseCount,
    });
  } catch (err) {
    console.error('[catalog-intelligence] assembly threw (returning empty shell):', err?.message || err);
    return deepFreeze({
      singles: 0, eps: 0, albums: 0, totalTracks: 0,
      catalogStatus: 'Limited Catalog',
      confidence: 'Unable to Confirm',
      isrcCoverage: ISRC_UNKNOWN,
      firstReleaseYear: null, latestReleaseYear: null, catalogAgeYears: null,
      physicalReleaseCount: null,
    });
  }
}
