// Normalization Layer Completion — regression test (Phase 2 Recovery, 2026-07-21)
// Run: node tests/normalization-layer-completion-test.mjs
//
// Proves the one verified defect found during the Normalization Layer
// Completion audit is fixed: Discogs' total-release count is fetched via
// PAL and computed onto rawResponse.discogsReleases (run-scan.js) on every
// scan, but normalizeAuditResponse.js's _normalizePlatforms() previously
// discarded it -- discogs always got the boolean-only `simple()` shape
// (details: null) -- so Catalog Intelligence's physicalReleaseCount field
// (api/_lib/catalog-intelligence.js:238-240) was permanently null, even
// though real data existed one layer upstream the whole time.
//
// This test drives the real exported functions
// (normalizeAuditResponse, assembleCatalogEvidence), not
// re-implementations, through both the fixed path (discogs found) and
// the not-found path (regression: details must stay null).

import assert from 'node:assert/strict';

import { normalizeAuditResponse } from '../api/lib/normalizeAuditResponse.js';
import { assembleCatalogEvidence } from '../api/_lib/catalog-evidence.js';

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${name}\n    ${err.message}`);
    failed++;
  }
}

// Minimal raw shape -- only the fields normalizeAuditResponse actually
// reads for this path are populated with realistic values; everything
// else relies on the function's own documented defaults.
function rawFixture({ discogsFound, discogsReleases }) {
  return {
    platform: 'spotify',
    type: 'artist',
    artistName: 'Test Artist',
    artistId: 'spotify_artist_1',
    followers: 100,
    popularity: 50,
    genres: [],
    platforms: {
      spotify: true, musicbrainz: false, deezer: false, audiodb: false,
      discogs: discogsFound, soundcloud: false, lastfm: false,
      wikipedia: false, youtube: false, appleMusic: false, tidal: false,
    },
    catalog: { totalReleases: 0, earliestYear: null, latestYear: null, catalogAgeYears: 0, estimatedAnnualStreams: 0, recentActivity: false },
    royaltyGap: { estAnnualStreams: 0, estLifetimeStreams: 0, estSpotifyRoyalties: 0, estPROEarnings: 0, estTotalRoyalties: 0, potentialGapLow: 0, potentialGapHigh: 0, catalogYears: 0, ugcUnmonetisedViews: 0, ugcPotentialRevenue: 0, disclaimer: '' },
    gapBasedExposure: { indicators: [], aggregateLow: 0, aggregateHigh: 0, pendingValidationCount: 0, hasAnyGaps: false },
    proGuide: { pro: 'Test PRO', url: 'https://example.com', steps: [], note: '', country: null },
    country: null,
    discogsReleases,
    overallScore: 50,
    modules: {},
    flags: [],
    scannedAt: new Date().toISOString(),
  };
}

test('REGRESSION FIX: Discogs total-release count survives normalization when Discogs is found', () => {
  const raw = rawFixture({ discogsFound: true, discogsReleases: 42 });
  const canonical = normalizeAuditResponse(raw);

  assert.equal(canonical.platforms.discogs.availability, 'VERIFIED');
  assert.ok(canonical.platforms.discogs.details !== null, 'details must not be null when Discogs was found');
  assert.equal(canonical.platforms.discogs.details.totalReleases, 42);
});

test('REGRESSION FIX: propagates end-to-end into Catalog Evidence (physicalReleaseCount source)', () => {
  const raw = rawFixture({ discogsFound: true, discogsReleases: 42 });
  const canonical = normalizeAuditResponse(raw);
  const catalogEvidence = assembleCatalogEvidence(canonical);

  assert.equal(catalogEvidence.discogsTotalReleases, 42); // previously always null
});

test('NO REGRESSION: Discogs not found still produces null details (unchanged)', () => {
  const raw = rawFixture({ discogsFound: false, discogsReleases: 0 });
  const canonical = normalizeAuditResponse(raw);

  assert.equal(canonical.platforms.discogs.availability, 'NOT_FOUND');
  assert.equal(canonical.platforms.discogs.details, null);

  const catalogEvidence = assembleCatalogEvidence(canonical);
  assert.equal(catalogEvidence.discogsTotalReleases, null);
});

test('NO REGRESSION: discogsReleases (per-release dated array) remains honestly empty -- no upstream data exists for it', () => {
  const raw = rawFixture({ discogsFound: true, discogsReleases: 42 });
  const canonical = normalizeAuditResponse(raw);
  const catalogEvidence = assembleCatalogEvidence(canonical);

  assert.deepEqual(catalogEvidence.discogsReleases, []); // by design -- see catalog-evidence.js doc comment
});

test('NO REGRESSION: other simple() platforms (musicbrainz/audiodb/soundcloud/lastfm/wikipedia) unaffected', () => {
  const raw = rawFixture({ discogsFound: true, discogsReleases: 1 });
  raw.platforms.musicbrainz = true;
  raw.platforms.audiodb = true;
  const canonical = normalizeAuditResponse(raw);

  assert.equal(canonical.platforms.musicbrainz.availability, 'VERIFIED');
  assert.equal(canonical.platforms.musicbrainz.details, null); // unchanged -- still boolean-only
  assert.equal(canonical.platforms.audiodb.availability, 'VERIFIED');
  assert.equal(canonical.platforms.audiodb.details, null);
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
