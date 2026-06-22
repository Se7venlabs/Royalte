// ─────────────────────────────────────────────────────────────────────
//  Royaltē Catalog Intelligence™ — Assembler  (Phase Catalog v1.0)
// ─────────────────────────────────────────────────────────────────────
//
//  Constitutional position:
//
//    Scan Engine
//        ↓ catalog.{singlesCount,epsCount,albumsCount,featuresCount,totalTracks}
//        ↓ platforms.appleMusic.details.albums[]
//    Canonical Intelligence Object™  (catalog summary)
//        ↓
//    Rule Library™
//        ↓
//    Catalog Intelligence™  ◀── THIS MODULE
//        ↓
//    Mission Control™ · Catalog Intelligence Card
//
//  Data source hierarchy (Board directive):
//    Primary:   Apple Music albums (via canonical.platforms.appleMusic.details.albums)
//               → singles / EPs / albums classification by trackCount
//    Secondary: Spotify appears_on count (via canonical.catalog.featuresCount)
//               → features count
//    Fallback:  canonical.catalog.singlesCount/epsCount/albumsCount from
//               Spotify album_group classification when Apple album list
//               is unavailable (both paths set these fields; Apple wins
//               when both are present because Apple is canonical).
//
//  Purity invariants:
//    - Pure function of (intelligenceReport, cio, canonical).
//    - Never throws on any input (null / undefined / malformed).
//    - Never mutates inputs.
//    - Output is deep-frozen.
//    - Never recomputes intelligence; only assembles from pre-computed
//      canonical data (constitutionally: Mission Control reads, never recalculates).
//
// ─────────────────────────────────────────────────────────────────────
//  Output shape (v1.0):
//
//    {
//      singles:       number,  // Apple-canonical owned single releases
//      eps:           number,  // Apple-canonical owned EP releases
//      albums:        number,  // Apple-canonical owned album releases
//      features:      number,  // Spotify appears_on count
//      totalTracks:   number,  // total tracks across owned releases
//      catalogStatus: string,  // 'Limited Catalog' | 'Stable' | 'Growing'
//                               // | 'Expanding' | 'Large Catalog'
//      confidence:    string,  // 'Verified' | 'Partial' | 'Unable to Confirm'
//    }
//
// ─────────────────────────────────────────────────────────────────────

export const CATALOG_INTELLIGENCE_VERSION = '1.0.0';

// Board-locked status thresholds (owned releases = singles + eps + albums).
// Board decision: "Stable" covers 1-6 owned releases (Black Alternative
// with 4 singles = Stable). Thresholds are named constants — change only
// through a formal Board Review.
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
    if (v !== null && typeof v === 'object' && !Object.isFrozen(v)) {
      deepFreeze(v);
    }
  }
  return Object.freeze(obj);
}

// classifyAppleAlbums — Apple Music is canonical for release type.
// trackCount === 1 → single · 2–6 → EP · 7+ → album.
// Returns { singles, eps, albums, totalTracks }.
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
// "Owned" = singles + EPs + albums (not features/appearances).
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
  if (avail === 'VERIFIED') return 'Verified';
  if (avail === 'NOT_FOUND') return 'Not Found';
  return 'Partial';
}

// assembleCatalogIntelligence(intelligenceReport, cio, canonical)
//
// Main entry point — same calling convention as assembleIdentityIntelligence
// and assemblePublishingIntelligence, with a third `canonical` argument to
// access Apple Music album details (not currently stored in the CIO).
//
// Always returns a frozen object. Never throws.
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

    // Secondary: Spotify appears_on → features count
    const catSection = safeCanonical.catalog || {};
    const features = typeof catSection.featuresCount === 'number' ? catSection.featuresCount : 0;

    const ownedCount   = singles + eps + albums;
    const catalogStatus = deriveCatalogStatus(ownedCount);
    const confidence    = deriveConfidence(safeCanonical);

    return deepFreeze({
      singles,
      eps,
      albums,
      features,
      totalTracks,
      catalogStatus,
      confidence,
    });
  } catch (err) {
    // Belt-and-suspenders: assemble a safe empty shell on any unexpected throw.
    console.error('[catalog-intelligence] assembly threw (returning empty shell):', err?.message || err);
    return deepFreeze({
      singles: 0, eps: 0, albums: 0, features: 0, totalTracks: 0,
      catalogStatus: 'Limited Catalog',
      confidence: 'Unable to Confirm',
    });
  }
}
