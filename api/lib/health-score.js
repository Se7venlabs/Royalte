// ─────────────────────────────────────────────────────────────────────────
// ROYALTÉ ENGINEERING PRINCIPLE (Constitutional)
// Royaltē verifies intelligence.
// Royaltē does not estimate intelligence.
// If a provider cannot be verified: UNVERIFIED.
// Every number must be traceable and defensible.
// ─────────────────────────────────────────────────────────────────────────
//
// V2 Health Score — single source of truth for the engine's
// signal-driven health calculation. Extracted from persist-os-scan.js
// 2026-06-09 (Canonical Payload V2 Phase 1, Health Object Migration)
// so both the persist path (api/_lib/persist-os-scan.js) and the
// normalize path (api/lib/normalizeAuditResponse.js) consume the same
// implementation. Per Constitutional Rule: Generate Once. Normalize
// Once. Compute Once. Consume Everywhere.
//
// Engine emits SEMANTIC business intelligence only. No presentation
// concepts. No CSS class names. Each downstream surface owns its own
// grade→className mapping as a presentation-layer lookup.
// ─────────────────────────────────────────────────────────────────────────

// Canonical engine grade labels (Board-locked 2026-06-09).
// Adding, removing, or re-spelling any of these is a Constitutional
// decision requiring Board ratification — every Royaltē surface
// inherits these strings.
export const HEALTH_GRADES = Object.freeze([
  'Excellent',
  'Strong',
  'Moderate',
  'Review Recommended',
]);

// Score → grade banding. Boundary values (60, 75, 90) inclusive at
// the start of each band per the existing UI semantics:
//   90+  → Excellent
//   75-89→ Strong
//   60-74→ Moderate
//   <60  → Review Recommended
export function getHealthBand(score) {
  if (typeof score !== 'number' || !Number.isFinite(score)) {
    return { grade: 'Review Recommended' };
  }
  if (score >= 90) return { grade: 'Excellent' };
  if (score >= 75) return { grade: 'Strong' };
  if (score >= 60) return { grade: 'Moderate' };
  return                  { grade: 'Review Recommended' };
}

// V2 verified-signal Health Score.
// Reads only signals the V2 surfaces actually display: catalog depth,
// BIG 8 territory availability, platform presence, ISRC coverage.
// Returns { score, grade, drivers, breakdown }:
//   score:     0–100 (signal-driven, not change-driven)
//   grade:     one of HEALTH_GRADES
//   drivers:   top 4 explanatory strings, sorted by impact desc
//   breakdown: per-bucket points for the dashboard breakdown grid
// Driver tone follows the locked trust rule: never speculate, never
// accuse — phrase every gap as "not available from reviewed sources".
export function computeV2HealthScore(canonical) {
  const am      = (canonical && canonical.platforms && canonical.platforms.appleMusic && canonical.platforms.appleMusic.details) || {};
  const apple   = (canonical && canonical.platforms && canonical.platforms.appleMusic) || {};
  const spotify = (canonical && canonical.platforms && canonical.platforms.spotify)    || {};
  const youtube = (canonical && canonical.platforms && canonical.platforms.youtube)    || {};

  let catalogPoints   = 0; // bucket: catalog_verification (max 40)
  let backendPoints   = 0; // bucket: backend_health       (Apple + Spotify, max 20)
  let youtubePoints   = 0; // bucket: youtube_presence     (YouTube, max 10)
  let territoryPoints = 0; // bucket: big6_coverage        (max 20)
  let isrcPoints      = 0; // not bucketed; contributes to total only (max 10)
  const drivers       = [];

  // ── Catalog depth (max 40) ──────────────────────────────────────────────
  const albums     = Array.isArray(am.albums) ? am.albums : [];
  const albumCount = albums.length || am.albumCount || 0;
  if (albums.length >= 1) catalogPoints += 20;
  if (albumCount >= 4)    catalogPoints += 10;
  if (albumCount >= 10)   catalogPoints += 10;
  if (albumCount === 0) {
    drivers.push({ text: 'Catalog depth could not be determined from reviewed sources', weight: 40 });
  } else if (albumCount < 4) {
    drivers.push({ text: 'Catalog depth was below the typical range in reviewed sources', weight: 20 });
  }

  // ── Platform presence ──────────────────────────────────────────────────
  if (apple.availability   === 'VERIFIED') backendPoints += 10;
  else drivers.push({ text: 'Apple Music presence was not available from reviewed sources', weight: 10 });
  if (spotify.availability === 'VERIFIED') backendPoints += 10;
  else drivers.push({ text: 'Spotify presence was not available from reviewed sources',     weight: 10 });
  if (youtube.availability === 'VERIFIED') youtubePoints += 10;
  else drivers.push({ text: 'YouTube presence was not available from reviewed sources',     weight: 10 });

  // ── Territory availability (max 20) ─────────────────────────────────────
  const sfa = am.storefrontAvailability;
  if (!sfa || typeof sfa !== 'object') {
    drivers.push({ text: 'Territory availability was not yet verified in this scan', weight: 20 });
  } else {
    territoryPoints += 10;
    const keys = ['us', 'ca', 'gb', 'de', 'fr', 'jp', 'au', 'br'];
    let fullCount = 0;
    for (const sf of keys) {
      const ent = sfa[sf];
      if (!ent || ent.error) continue;
      const avail = Array.isArray(ent.available) ? ent.available.length : 0;
      if (avail > 0) fullCount++;
    }
    if (fullCount === keys.length) {
      territoryPoints += 10;
    } else if (fullCount >= 5) {
      territoryPoints += 5;
      drivers.push({ text: 'Availability was not yet verified across all reviewed territories', weight: 10 });
    } else {
      drivers.push({ text: 'Availability was not yet verified across all reviewed territories', weight: 10 });
    }
  }

  // ── ISRC coverage (max 10) ──────────────────────────────────────────────
  // 2026-06-09 Canonical Payload V2 Phase 1 / Question #1: engine becomes
  // the single source of truth for ISRC detection. 3-source check:
  //   1) canonical.subject.trackIsrc       — present on track-input scans
  //   2) am.isrcLookup.isrc                — Apple Music ISRC endpoint
  //   3) am.catalogComparison.matched > 0  — Apple↔Spotify cross-match
  // Any ONE source confirms ISRC presence.
  const isrcLookup       = am.isrcLookup;
  const catalogMatched   = am.catalogComparison && typeof am.catalogComparison.matched === 'number'
                             ? am.catalogComparison.matched : 0;
  const trackIsrcPresent = canonical && canonical.subject && canonical.subject.trackIsrc;
  const hasIsrc = !!(trackIsrcPresent
                     || (isrcLookup && isrcLookup.isrc)
                     || catalogMatched > 0);
  if (hasIsrc) {
    isrcPoints += 10;
  } else {
    drivers.push({ text: 'ISRC information was not available from reviewed sources', weight: 10 });
  }

  const total = catalogPoints + backendPoints + youtubePoints + territoryPoints + isrcPoints;
  const score = Math.max(0, Math.min(100, total));
  const { grade } = getHealthBand(score);

  drivers.sort((a, b) => b.weight - a.weight);
  return {
    score,
    grade,
    drivers: drivers.slice(0, 4).map((d) => d.text),
    breakdown: {
      catalog_verification: catalogPoints,
      big6_coverage:        territoryPoints,
      backend_health:       backendPoints,
      youtube_presence:     youtubePoints,
    },
  };
}
