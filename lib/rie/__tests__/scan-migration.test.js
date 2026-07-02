// Phase 3.1 Certification Suite — Website Scan Migration
//
// Constitutional authority: Royaltē Master Constitution v1.3 §8
// Board Authorization: Phase 3.1 (2026-07-01)
//
// Proves the constitutional migration:
//   Website Scan requests intelligence from the Royaltē Operating System.
//   Website Scan no longer computes intelligence.
//   The Certified Canonical Intelligence Model is the single source of truth.
//
// Run: node lib/rie/__tests__/scan-migration.test.js

import { strictEqual, ok, deepStrictEqual, notStrictEqual } from 'node:assert';
import { runRIE }            from '../index.js';
import { buildCimEnrichment } from '../CimAdapter.js';
import { validateCIM }       from '../../../api/schema/canonical-intelligence-model.js';
import { normalizeAuditResponse } from '../../../api/lib/normalizeAuditResponse.js';

// ── Minimal raw response fixture ──────────────────────────────────────────────
// Matches what runScan() returns for a Spotify artist input.
// Must be rich enough to pass normalizeAuditResponse validation.
const MOCK_RAW = {
  success: true,
  platform: 'spotify',
  type: 'artist',
  artistName: 'Test Artist',
  artistId:   'spotify-artist-001',
  followers: 50000,
  popularity: 72,
  genres: ['pop', 'r&b'],
  trackTitle:  null,
  trackIsrc:   null,
  resolvedFrom: 'artist',
  resolvedFromType: 'direct',
  resolvedFromTitle: 'Test Artist',
  canonicalTarget: 'artist',
  spotifyMatched: true,
  artistUrl: 'https://open.spotify.com/artist/spotify-artist-001',
  imageUrl: null,
  artistImageUrl: null,
  albumImageUrl: null,
  appleArtworkUrl: null,
  appleMusic: {
    found: true,
    artistId: 'apple-001',
    artistName: 'Test Artist',
    genres: ['pop'],
    artworkUrl: null,
    profileUrl: null,
    albums: [
      { id: 'alb-1', name: 'Album One', releaseDate: '2021-01-01', trackCount: 10 },
      { id: 'alb-2', name: 'EP One',    releaseDate: '2022-03-01', trackCount: 5 },
      { id: 'alb-3', name: 'Single A',  releaseDate: '2023-06-01', trackCount: 1 },
    ],
    catalogComparison: { matchRate: 90, notFound: [] },
  },
  platforms: {
    spotify:     true,
    musicbrainz: true,
    deezer:      true,
    audiodb:     false,
    discogs:     false,
    soundcloud:  false,
    lastfm:      true,
    wikipedia:   true,
    youtube:     false,
    appleMusic:  true,
  },
  catalog: {
    totalReleases:   3,
    singlesCount:    1,
    epsCount:        1,
    albumsCount:     1,
    featuresCount:   0,
    totalTracks:     16,
    earliestYear:    2021,
    latestYear:      2023,
    catalogAgeYears: 2,
    estimatedAnnualStreams: 0,
    recentActivity:  true,
  },
  royaltyGap: {
    estAnnualStreams: 0, estLifetimeStreams: 0, estSpotifyRoyalties: 0,
    estPROEarnings: 0, estTotalRoyalties: 0, potentialGapLow: 0, potentialGapHigh: 0,
    catalogYears: 2, ugcUnmonetisedViews: 0, ugcPotentialRevenue: 0,
    disclaimer: 'Estimates only.',
  },
  gapBasedExposure: { indicators: [], aggregateLow: null, aggregateHigh: null, pendingValidationCount: 0, hasAnyGaps: false },
  proGuide: { pro: 'Your local PRO', url: 'https://www.cisac.org', steps: [], note: '' },
  country: null,
  lastfmPlays: 120000,
  lastfmListeners: 45000,
  wikipediaUrl: 'https://en.wikipedia.org/wiki/Test_Artist',
  deezerFans: 8000,
  discogsReleases: 0,
  deezer: { found: true, fans: 8000 },
  youtube: { found: false },
  overallScore: 65,
  modules: {
    metadata: { name: 'Metadata Integrity', score: 80, flags: [] },
    coverage: { name: 'Platform Coverage',  score: 70, flags: [] },
    publishing: { name: 'Publishing Risk',  score: 75, flags: [] },
    duplicates: { name: 'Duplicate Detection', score: 80, flags: [] },
    youtube:    { name: 'YouTube / UGC',    score: 30, flags: ['No YouTube channel'] },
    sync:       { name: 'Sync Readiness',   score: 60, flags: [] },
  },
  flags: [],
  flagCount: 0,
  previewFlags: [],
  scannedAt: '2026-07-01T00:00:00.000Z',
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function pass(label) { console.log(`  ✓ ${label}`); }
function fail(label, err) { console.error(`  ✗ ${label}`); throw err; }

let passed = 0;
let failed = 0;

async function test(label, fn) {
  try {
    await fn();
    passed++;
    pass(label);
  } catch (err) {
    failed++;
    fail(label, err);
  }
}

// ── Suite ─────────────────────────────────────────────────────────────────────
console.log('\n── Phase 3.1 Certification Suite — Website Scan Migration ──────────────\n');

// ─── Group A: runRIE receives legacy canonicalForEnrichment (Phase 1 path) ───
console.log('Group A — runRIE Phase 1 path (legacy evidence)');

let canonicalForEnrichment;

await test('1. normalizeAuditResponse produces a valid canonicalForEnrichment', () => {
  canonicalForEnrichment = normalizeAuditResponse({ ...MOCK_RAW, scanId: 'test-scan-001' });
  ok(canonicalForEnrichment && typeof canonicalForEnrichment === 'object', 'not an object');
  ok(canonicalForEnrichment.subject?.artistName, 'missing subject.artistName');
  ok(canonicalForEnrichment.platforms, 'missing platforms');
});

let cim;

await test('2. runRIE accepts canonicalForEnrichment and returns a certified CIM', async () => {
  cim = await runRIE({ canonicalForEnrichment });
  ok(cim && typeof cim === 'object', 'CIM not returned');
  strictEqual(cim._certified, true, 'CIM not certified');
});

await test('3. CIM passes validateCIM — all 12 §8.2 keys present', () => {
  const result = validateCIM(cim);
  ok(result.valid, `validateCIM failed: ${result.errors?.join(', ')}`);
});

await test('4. CIM is deep-frozen (no mutation possible)', () => {
  let threw = false;
  try { cim.identity = 'mutated'; } catch { threw = true; }
  ok(threw || cim.identity !== 'mutated', 'CIM is not frozen');
});

await test('5. CIM carries scanAuthority with generatedAt', () => {
  ok(cim.scanAuthority?.generatedAt, 'scanAuthority.generatedAt missing');
  ok(cim.scanAuthority._cimVersion, 'scanAuthority._cimVersion missing');
});

// ─── Group B: CIM carries all intelligence domains ────────────────────────────
console.log('\nGroup B — CIM intelligence domains populated');

await test('6. cim.identity is non-null (identity intelligence present)', () => {
  ok(cim.identity !== null, 'cim.identity is null');
  ok(typeof cim.identity === 'object', 'cim.identity not an object');
});

await test('7. cim.health is non-null (health intelligence present)', () => {
  ok(cim.health !== null, 'cim.health is null');
  ok(typeof cim.health.score === 'number' || cim.health.score === null, 'cim.health.score unexpected type');
});

await test('8. cim.catalog is non-null (catalog intelligence present)', () => {
  ok(cim.catalog !== null, 'cim.catalog is null');
});

await test('9. cim.actions is an array (executive actions present)', () => {
  ok(Array.isArray(cim.actions), 'cim.actions not an array');
});

await test('10. cim.brief carries the full executiveBrief object (Phase 3.1 bridge)', () => {
  ok(cim.brief !== null, 'cim.brief is null — executiveBrief not stored in CIM');
  ok(typeof cim.brief === 'object', 'cim.brief not an object');
  ok('priorityActions' in cim.brief, 'cim.brief missing priorityActions');
  ok('healthHeadline' in cim.brief, 'cim.brief missing healthHeadline — PDF renderer will break');
});

// ─── Group C: CimAdapter maps CIM → canonical enrichment ──────────────────────
console.log('\nGroup C — CimAdapter backward-compat mapping');

let enrichedCanonical;

await test('11. buildCimEnrichment returns an object with canonical fields populated from CIM', () => {
  enrichedCanonical = buildCimEnrichment(cim, canonicalForEnrichment);
  ok(enrichedCanonical && typeof enrichedCanonical === 'object', 'enrichedCanonical not an object');
  ok(enrichedCanonical.cim === cim, 'enrichedCanonical.cim is not the same CIM reference');
});

await test('12. canonical.identityIntelligence === cim.identity (same reference)', () => {
  strictEqual(enrichedCanonical.identityIntelligence, cim.identity,
    'identityIntelligence is not the CIM identity reference');
});

await test('13. canonical.publishingIntelligence === cim.publishing (same reference)', () => {
  strictEqual(enrichedCanonical.publishingIntelligence, cim.publishing,
    'publishingIntelligence is not the CIM publishing reference');
});

await test('14. canonical.catalogIntelligence === cim.catalog (same reference)', () => {
  strictEqual(enrichedCanonical.catalogIntelligence, cim.catalog,
    'catalogIntelligence is not the CIM catalog reference');
});

await test('15. canonical.globalMusicFootprint === cim.globalFootprint (same reference)', () => {
  strictEqual(enrichedCanonical.globalMusicFootprint, cim.globalFootprint,
    'globalMusicFootprint is not the CIM globalFootprint reference');
});

await test('16. canonical.executiveBrief === cim.brief (same reference)', () => {
  strictEqual(enrichedCanonical.executiveBrief, cim.brief,
    'executiveBrief is not the CIM brief reference');
});

await test('17. canonical.healthScore derived from cim.health carries overallScore', () => {
  if (cim.health?.score !== null) {
    ok(enrichedCanonical.healthScore, 'healthScore not derived from cim.health');
    strictEqual(enrichedCanonical.healthScore.overallScore, cim.health.score,
      'healthScore.overallScore !== cim.health.score');
  } else {
    ok(enrichedCanonical.healthScore === null, 'healthScore should be null when cim.health.score is null');
  }
});

await test('18. canonical.healthReport === cim.health.report (same reference)', () => {
  strictEqual(enrichedCanonical.healthReport, cim.health?.report ?? null,
    'healthReport is not the CIM health.report reference');
});

await test('19. baseCanonical fields preserved in enrichedCanonical (backward-compat)', () => {
  ok(enrichedCanonical.schemaVersion, 'schemaVersion missing');
  ok(enrichedCanonical.subject, 'subject missing');
  ok(enrichedCanonical.platforms, 'platforms missing');
  ok(enrichedCanonical.catalog, 'catalog missing');
  ok(enrichedCanonical.modules, 'modules missing');
});

// ─── Group D: Constitutional boundaries ─────────────────────────────────────
console.log('\nGroup D — Constitutional boundaries');

await test('20. CimAdapter does not recompute intelligence — it maps only', () => {
  // Verify buildCimEnrichment is synchronous (no async compute)
  const start = Date.now();
  const result = buildCimEnrichment(cim, canonicalForEnrichment);
  const elapsed = Date.now() - start;
  ok(result.cim === cim, 'did not return the same CIM reference');
  ok(elapsed < 50, `buildCimEnrichment took ${elapsed}ms — should be instant (mapping, not compute)`);
});

await test('21. runRIE never throws on empty publishing works', async () => {
  let emptyCim;
  emptyCim = await runRIE({
    canonicalForEnrichment,
    publishingWorks: null,
    publishingSourceObservations: null,
  });
  ok(emptyCim?._certified === true, 'CIM not certified when publishingWorks is null');
});

await test('22. runRIE never throws on null canonicalForEnrichment (returns safe CIM)', async () => {
  const safeCim = await runRIE({ canonicalForEnrichment: null });
  ok(safeCim?._certified === true, 'CIM not certified on null evidence');
});

await test('23. buildCimEnrichment handles null CIM gracefully', () => {
  const base = { schemaVersion: '1.0.0', subject: { artistName: 'Test' } };
  const result = buildCimEnrichment(null, base);
  strictEqual(result.schemaVersion, '1.0.0', 'baseCanonical fields not preserved');
  ok(result.identityIntelligence === undefined || result.identityIntelligence === null,
    'null CIM produced non-null identity intelligence');
});

// ─── Group E: Legacy path verification ───────────────────────────────────────
console.log('\nGroup E — Legacy path coexistence');

await test('24. normalizeAuditResponse (legacy path) still works independently', () => {
  const canonical = normalizeAuditResponse({ ...MOCK_RAW, scanId: 'legacy-test-001' });
  ok(canonical.schemaVersion, 'schemaVersion missing from legacy canonical');
  ok(canonical.subject?.artistName, 'artistName missing from legacy canonical');
  // Legacy canonical has no intelligence objects (they come from OS enrichment)
  strictEqual(canonical.cim, undefined, 'legacy canonical should not have cim field');
  strictEqual(canonical.identityIntelligence, undefined, 'legacy canonical should not have identityIntelligence');
});

await test('25. enrichedCanonical.cim is the same object as returned by runRIE', () => {
  // The CIM in the canonical IS the CIM — not a copy, not a clone.
  // Phase 3.2 consumers must be able to read from enrichedCanonical.cim.
  ok(enrichedCanonical.cim === cim, 'canonical.cim is not the same reference as the CIM from runRIE');
  strictEqual(enrichedCanonical.cim._certified, true, 'canonical.cim is not certified');
});

// ── Results ────────────────────────────────────────────────────────────────────
console.log('\n── Results ─────────────────────────────────────────────────────────');
console.log(`   ${passed} passed  /  ${failed} failed  /  ${passed + failed} total\n`);

if (failed > 0) {
  console.error(`✗ Phase 3.1 certification FAILED — ${failed} criterion/criteria not met.\n`);
  process.exit(1);
} else {
  console.log(`✓ Phase 3.1 certification COMPLETE — all ${passed} criteria passed.\n`);
}
