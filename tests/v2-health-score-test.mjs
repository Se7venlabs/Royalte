// V2 Health Score tests — Brief 012a (follow-up).
// Pure unit tests against synthetic canonical payloads. No DB.

import { computeV2HealthScore } from '../api/_lib/persist-os-scan.js';

let count = 0;
const assert = (cond, msg) => {
  if (!cond) { console.error('✗ FAIL:', msg); process.exit(1); }
  console.log('✓', msg);
  count++;
};

// ── Helpers ────────────────────────────────────────────────────────────────

const FULL_SFA = {
  us: { available: ['x'], unavailable: [] },
  ca: { available: ['x'], unavailable: [] },
  gb: { available: ['x'], unavailable: [] },
  de: { available: ['x'], unavailable: [] },
  fr: { available: ['x'], unavailable: [] },
  jp: { available: ['x'], unavailable: [] },
  au: { available: ['x'], unavailable: [] },
};

const fullCanonical = () => ({
  platforms: {
    appleMusic: {
      availability: 'VERIFIED',
      details: {
        albums: Array.from({ length: 10 }, (_, i) => ({ name: `Album ${i + 1}` })),
        storefrontAvailability: { ...FULL_SFA },
        isrcLookup: { isrc: 'USRC17600001' },
      },
    },
    spotify: { availability: 'VERIFIED' },
    youtube: { availability: 'VERIFIED' },
  },
});

// ═══════════════════════════════════════════════════════════════════════════
// 1. Full score — everything verified → 100, no drivers
// ═══════════════════════════════════════════════════════════════════════════

{
  const r = computeV2HealthScore(fullCanonical());
  assert(r.score === 100, 'full: score is 100');
  assert(r.drivers.length === 0, 'full: zero drivers');
  assert(r.breakdown.catalog_verification === 40, 'full: catalog bucket at max (40)');
  assert(r.breakdown.big6_coverage === 20, 'full: territory bucket at max (20)');
  assert(r.breakdown.backend_health === 20, 'full: backend_health (Apple+Spotify) at max (20)');
  assert(r.breakdown.youtube_presence === 10, 'full: youtube_presence at max (10)');
}

// ═══════════════════════════════════════════════════════════════════════════
// 2. Missing ISRC only → 90
// ═══════════════════════════════════════════════════════════════════════════

{
  const c = fullCanonical();
  c.platforms.appleMusic.details.isrcLookup = null;
  const r = computeV2HealthScore(c);
  assert(r.score === 90, 'missing ISRC: score is 90');
  assert(r.drivers.length === 1, 'missing ISRC: one driver');
  assert(
    r.drivers[0] === 'ISRC information was not available from reviewed sources',
    'missing ISRC: driver text matches locked tone',
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 3. Missing territory only → 80
// ═══════════════════════════════════════════════════════════════════════════

{
  const c = fullCanonical();
  c.platforms.appleMusic.details.storefrontAvailability = null;
  const r = computeV2HealthScore(c);
  assert(r.score === 80, 'missing territory: score is 80');
  assert(r.drivers.length === 1, 'missing territory: one driver');
  assert(
    r.drivers[0] === 'Territory availability was not yet verified in this scan',
    'missing territory: driver text matches locked tone',
  );
  assert(r.breakdown.big6_coverage === 0, 'missing territory: big6_coverage bucket is 0');
}

// ═══════════════════════════════════════════════════════════════════════════
// 4. Missing all three platforms → 70
// ═══════════════════════════════════════════════════════════════════════════

{
  const c = fullCanonical();
  c.platforms.appleMusic.availability = 'NOT_FOUND';
  c.platforms.spotify.availability    = 'NOT_FOUND';
  c.platforms.youtube.availability    = 'NOT_FOUND';
  const r = computeV2HealthScore(c);
  assert(r.score === 70, 'missing platforms: score is 70');
  assert(r.drivers.length === 3, 'missing platforms: three drivers');
  assert(
    r.drivers.includes('Apple Music presence was not available from reviewed sources'),
    'missing platforms: Apple driver present',
  );
  assert(
    r.drivers.includes('Spotify presence was not available from reviewed sources'),
    'missing platforms: Spotify driver present',
  );
  assert(
    r.drivers.includes('YouTube presence was not available from reviewed sources'),
    'missing platforms: YouTube driver present',
  );
  assert(r.breakdown.backend_health === 0,    'missing platforms: backend_health bucket is 0');
  assert(r.breakdown.youtube_presence === 0,  'missing platforms: youtube_presence bucket is 0');
}

// ═══════════════════════════════════════════════════════════════════════════
// 5. Empty catalog → 60
// ═══════════════════════════════════════════════════════════════════════════

{
  const c = fullCanonical();
  c.platforms.appleMusic.details.albums = [];
  c.platforms.appleMusic.details.albumCount = 0;
  const r = computeV2HealthScore(c);
  assert(r.score === 60, 'empty catalog: score is 60');
  assert(r.drivers.length === 1, 'empty catalog: one driver');
  assert(
    r.drivers[0] === 'Catalog depth could not be determined from reviewed sources',
    'empty catalog: driver text matches locked tone',
  );
  assert(r.breakdown.catalog_verification === 0, 'empty catalog: catalog bucket is 0');
}

// ═══════════════════════════════════════════════════════════════════════════
// 6. BA-like scenario (4 albums, all platforms verified, no ISRC) → ~80
// ═══════════════════════════════════════════════════════════════════════════

{
  const c = fullCanonical();
  c.platforms.appleMusic.details.albums = Array.from({ length: 4 }, (_, i) => ({ name: `Album ${i + 1}` }));
  c.platforms.appleMusic.details.isrcLookup = null;
  const r = computeV2HealthScore(c);
  // catalog 30 (>=1 +20, >=4 +10, not >=10) + backend 20 + youtube 10 + territory 20 + ISRC 0 = 80
  assert(r.score === 80, 'BA scenario: score is 80');
  assert(r.breakdown.catalog_verification === 30, 'BA scenario: catalog bucket is 30');
  assert(r.drivers.length === 1, 'BA scenario: one driver (ISRC)');
  assert(
    r.drivers[0] === 'ISRC information was not available from reviewed sources',
    'BA scenario: ISRC driver',
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 7. Driver cap — top 4 even when more would exist
// ═══════════════════════════════════════════════════════════════════════════

{
  // Empty everything — would emit 6 drivers uncapped.
  const c = {
    platforms: {
      appleMusic: { availability: 'NOT_FOUND', details: { albums: [], albumCount: 0 } },
      spotify:    { availability: 'NOT_FOUND' },
      youtube:    { availability: 'NOT_FOUND' },
    },
  };
  const r = computeV2HealthScore(c);
  assert(r.score === 0, 'all missing: score is 0');
  assert(r.drivers.length === 4, 'all missing: drivers capped at 4');
  // Catalog (weight 40) and territory (weight 20) must lead, sorted desc.
  assert(
    r.drivers[0] === 'Catalog depth could not be determined from reviewed sources',
    'all missing: catalog driver first (weight 40)',
  );
  assert(
    r.drivers[1] === 'Territory availability was not yet verified in this scan',
    'all missing: territory driver second (weight 20)',
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 8. Catalog 0 < count < 4 → "below typical range" driver
// ═══════════════════════════════════════════════════════════════════════════

{
  const c = fullCanonical();
  c.platforms.appleMusic.details.albums = [{ name: 'Album 1' }, { name: 'Album 2' }];
  const r = computeV2HealthScore(c);
  // 2 albums: +20 (>=1) only. Total = 20 + 20 + 10 + 20 + 10 = 80.
  assert(r.score === 80, 'small catalog: score is 80');
  assert(r.drivers.length === 1, 'small catalog: one driver');
  assert(
    r.drivers[0] === 'Catalog depth below typical range in reviewed sources',
    'small catalog: "below typical range" driver, not "could not be determined"',
  );
  assert(r.breakdown.catalog_verification === 20, 'small catalog: catalog bucket is 20');
}

// ═══════════════════════════════════════════════════════════════════════════
// 9. Partial territory (5 of 7 storefronts) → +5 instead of +10
// ═══════════════════════════════════════════════════════════════════════════

{
  const c = fullCanonical();
  c.platforms.appleMusic.details.storefrontAvailability = {
    us: { available: ['x'], unavailable: [] },
    ca: { available: ['x'], unavailable: [] },
    gb: { available: ['x'], unavailable: [] },
    de: { available: ['x'], unavailable: [] },
    fr: { available: ['x'], unavailable: [] },
    jp: { available: [], unavailable: ['x'] },
    au: { available: [], unavailable: ['x'] },
  };
  const r = computeV2HealthScore(c);
  // territory: +10 (sfa present) + +5 (5–6 range) = 15. Total = 40+20+10+15+10 = 95.
  assert(r.score === 95, 'partial territory: score is 95');
  assert(r.breakdown.big6_coverage === 15, 'partial territory: big6 bucket is 15');
  assert(
    r.drivers.includes('Limited availability detected in some major markets'),
    'partial territory: "limited availability" driver present',
  );
}

// ═══════════════════════════════════════════════════════════════════════════

console.log('\n═════════════════════════════════════════════');
console.log('  V2 HEALTH SCORE VERIFIED');
console.log('═════════════════════════════════════════════');
console.log(`Total: ${count} assertions passed`);
