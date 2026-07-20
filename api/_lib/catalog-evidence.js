// ─────────────────────────────────────────────────────────────────────
//  Royaltē Canonical Catalog Evidence™ — Normalization Assembler
// ─────────────────────────────────────────────────────────────────────
//
//  Constitutional position (Board Option 3, Phase 2 Recovery, 2026-07-20):
//
//    Provider (Apple / Discogs / Spotify-fallback via run-scan.js)
//        ↓
//    Normalization  ◀── THIS MODULE
//        ↓
//    Canonical Catalog Evidence
//        ↓
//    Catalog Intelligence™ (business logic: classification, thresholds,
//                            ISRC status labels, Best Verified Release)
//
//  This module performs STRUCTURAL NORMALIZATION ONLY:
//    - relocates catalog-relevant fields out of provider-namespaced
//      paths (canonical.platforms.appleMusic.details.*,
//      canonical.platforms.discogs.details.*) into one flat,
//      catalog-domain-scoped object
//    - never classifies (no singles/EPs/albums counting)
//    - never scores or thresholds (no catalogStatus, no ISRC status
//      labels, no Best Verified Release selection)
//    - never mutates inputs, never throws, deep-frozen output
//
//  It is a sibling canonical object to the CIO, not a section inside it.
//  The CIO's existing cio.catalog (releasesCount / catalogAgeYears /
//  catalogConfidence summary) is unchanged by this module -- this is
//  intentional. Per Board direction: the CIO indexes canonical domains,
//  it does not become a second copy of provider payloads, and it does
//  not grow new business-logic responsibilities to accommodate a
//  bypassing consumer. Catalog Intelligence remains the sole owner of
//  every classification/threshold decision -- it now reads this
//  evidence object instead of canonicalForEnrichment directly.
//
// ─────────────────────────────────────────────────────────────────────
//  Output shape:
//
//    {
//      appleAlbums:          Array,           // Apple Music album objects, relocated
//                                              // as-is (already normalized once by
//                                              // normalizeAuditResponse.js); this module
//                                              // does not re-shape individual album fields
//      appleAvailability:    string|null,      // PLATFORM_AVAILABILITY value
//      isrcComparison:       object|null,       // { tracksChecked, matched[], notFound[], matchRate }
//      discogsReleases:      Array,
//      discogsTotalReleases: number|null,
//      fallbackCounts: {                        // Spotify-derived, pre-computed by
//        singles:     number,                   // run-scan.js's analyzeCatalog() --
//        eps:         number,                   // evidence, not Catalog Intelligence's
//        albums:      number,                   // own derived business logic
//        totalTracks: number,
//      },
//    }
// ─────────────────────────────────────────────────────────────────────

function deepFreeze(obj) {
  if (obj === null || typeof obj !== 'object') return obj;
  for (const k of Object.keys(obj)) {
    const v = obj[k];
    if (v !== null && typeof v === 'object' && !Object.isFrozen(v)) deepFreeze(v);
  }
  return Object.freeze(obj);
}

// assembleCatalogEvidence(canonical) — sole entrypoint. Never throws,
// including against a malformed input whose properties throw on access
// (e.g. a hostile getter) — matching the "never throws on any input"
// invariant every other assembler in this codebase upholds. Retrofitted
// (Phase 2 Recovery, Global Music Footprint target, 2026-07-20) after the
// same gap was found while building global-footprint-evidence.js.
export function assembleCatalogEvidence(canonical) {
  try {
    const safe = (canonical && typeof canonical === 'object' && !Array.isArray(canonical)) ? canonical : {};
    const appleDetails   = safe.platforms?.appleMusic?.details;
    const discogsDetails = safe.platforms?.discogs?.details;
    const catalogFallback = safe.catalog;

    return deepFreeze({
      appleAlbums:          Array.isArray(appleDetails?.albums) ? appleDetails.albums : [],
      appleAvailability:    safe.platforms?.appleMusic?.availability ?? null,
      isrcComparison:       (appleDetails?.catalogComparison && typeof appleDetails.catalogComparison === 'object')
                               ? appleDetails.catalogComparison
                               : null,
      discogsReleases:      Array.isArray(discogsDetails?.releases) ? discogsDetails.releases : [],
      discogsTotalReleases: typeof discogsDetails?.totalReleases === 'number' ? discogsDetails.totalReleases : null,
      fallbackCounts: {
        singles:     typeof catalogFallback?.singlesCount === 'number' ? catalogFallback.singlesCount : 0,
        eps:         typeof catalogFallback?.epsCount      === 'number' ? catalogFallback.epsCount     : 0,
        albums:      typeof catalogFallback?.albumsCount   === 'number' ? catalogFallback.albumsCount  : 0,
        totalTracks: typeof catalogFallback?.totalTracks   === 'number' ? catalogFallback.totalTracks  : 0,
      },
    });
  } catch (err) {
    console.error('[catalog-evidence] assembly threw (returning empty shell):', err?.message || err);
    return deepFreeze({
      appleAlbums: [], appleAvailability: null, isrcComparison: null,
      discogsReleases: [], discogsTotalReleases: null,
      fallbackCounts: { singles: 0, eps: 0, albums: 0, totalTracks: 0 },
    });
  }
}
