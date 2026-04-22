// End-to-end test of the normalize+validate pipeline.
// Feeds a realistic raw engine output through and asserts the canonical output.

import { normalizeAuditResponse } from '../api/lib/normalizeAuditResponse.js';
import { validateAuditResponse, AUDIT_RESPONSE_VERSION } from '../api/schema/auditResponse.js';

// Realistic raw engine output — mirrors what runAudit() produces just before
// piping into normalizeAuditResponse(). Matches the shape of the original audit.js output.
const rawEngineOutput = {
  _originalUrl: 'https://open.spotify.com/artist/4Z8W4fKeB5YxbusRsdQVPb',
  _storefront: 'us',
  platform: 'spotify',
  sourcePlatform: 'spotify',
  type: 'artist',
  resolvedFrom: 'artist',
  artistName: 'Radiohead',
  artistId: '4Z8W4fKeB5YxbusRsdQVPb',
  followers: 8234567,
  popularity: 82,
  genres: ['alternative rock', 'art rock', 'melancholia', 'oxford indie'],
  trackTitle: 'Creep',
  trackIsrc: 'GBAYE9300001',
  trackIsrcSource: 'top_tracks_hoist',
  platforms: {
    spotify: true, musicbrainz: true, deezer: true, audiodb: true,
    discogs: true, soundcloud: false, lastfm: true, wikipedia: true,
    youtube: true, appleMusic: true, tidal: true,
  },
  catalog: {
    totalReleases: 47, earliestYear: 1993, latestYear: 2023,
    catalogAgeYears: 33, estimatedAnnualStreams: 98814804, recentActivity: true,
  },
  royaltyGap: {
    estAnnualStreams: 65614404, estLifetimeStreams: 656144040,
    estSpotifyRoyalties: 2624576, estPROEarnings: 524915,
    estTotalRoyalties: 3149491, potentialGapLow: 157474, potentialGapHigh: 314949,
    catalogYears: 33, ugcUnmonetisedViews: 1234567, ugcPotentialRevenue: 1852,
    disclaimer: 'Estimates only. Verify with your distributor and PRO.',
  },
  proGuide: {
    pro: 'PRS for Music', url: 'https://www.prsformusic.com',
    steps: ['Go to prsformusic.com and click Join PRS', 'Register as a writer member'],
    note: 'PRS for Music collects performance royalties across the UK.',
    country: 'United Kingdom',
  },
  country: 'United Kingdom',
  lastfmPlays: 234567890, lastfmListeners: 4567890,
  wikipediaUrl: 'https://en.wikipedia.org/wiki/Radiohead',
  deezerFans: 2345678, tidalPopularity: 78, discogsReleases: 89,
  youtube: {
    found: true,
    officialChannel: { title: 'Radiohead', channelId: 'UC...', subscribers: 4200000, totalViews: 2100000000, videoCount: 89 },
    ugc: { videoCount: 10, estimatedViews: 1234567, topVideos: [], contentIdRisk: false },
    contentIdVerified: true, subscriberCount: 4200000, totalOfficialViews: 2100000000,
  },
  appleMusic: {
    found: true, artistId: '657515', artistUrl: 'https://music.apple.com/us/artist/radiohead/657515',
    genres: ['Alternative', 'Music'], albumCount: 15,
    isrcLookup: { found: true, name: 'Creep', albumName: 'Pablo Honey' },
    catalogComparison: { tracksChecked: 10, matched: 9, notFound: ['Karma Police (Live)'], matchRate: 90 },
  },
  appleMusicSource: null,
  overallScore: 68,
  modules: {
    metadata:   { name: 'Metadata Integrity', score: 82, flags: ['ISRC signal not detected on this track'] },
    coverage:   { name: 'Platform Coverage', score: 74, flags: ['SoundCloud presence not detected — coverage risk'] },
    publishing: { name: 'Publishing Risk', score: 52, flags: ['Catalog active for 33 years — extended royalty verification recommended', 'High Last.fm play count — significant streaming history detected, PRO verification critical'] },
    duplicates: { name: 'Duplicate Detection', score: 88, flags: [] },
    youtube:    { name: 'YouTube / UGC', score: 45, flags: ['Content ID monetisation status unverified'] },
    sync:       { name: 'Sync Readiness', score: 71, flags: ['Only 90% of top tracks matched on Apple Music — catalog gaps detected'] },
  },
  flags: [
    { module: 'Publishing Risk', severity: 'high', description: 'Catalog active for 33 years — extended period of potential royalty exposure detected' },
    { module: 'Platform Coverage', severity: 'high', description: '234,567,890 Last.fm plays detected — significant historical streaming activity warrants full PRO audit' },
    { module: 'YouTube / UGC', severity: 'medium', description: '~1,234,567 views detected on UGC videos — significant unmonetised revenue risk' },
    { module: 'Ownership & Publishing', severity: 'medium', description: 'Ownership data not confirmed via performing rights organizations — verify songwriter and publisher registration via ASCAP/BMI Songview.' },
    { module: 'Sync Readiness', severity: 'medium', description: 'No Wikipedia presence detected — sync licensing teams often research artists on Wikipedia before licensing' },
    { module: 'Duplicate Detection', severity: 'low', description: '89 releases found on Discogs — physical catalog confirmed' },
  ],
  scannedAt: new Date().toISOString(),
  auditCoverage: {
    spotify:       { status: 'Verified', tier: null },
    appleMusic:    { status: 'Verified', tier: 'isrc' },
    publishing:    { status: 'Not Confirmed', tier: null },
    soundExchange: { status: 'Not Confirmed', tier: null },
  },
  ownershipVerification: {
    ownership_status: 'unverified',
    confidence: 'MEDIUM',
    score_impact: -4,
    spotify_confidence: 'HIGH',
    apple_confidence: 'HIGH',
  },
  ownershipVerificationRender: {
    headline: 'Ownership: Unverified',
    detail: 'Cross-platform signals present but PRO registration unconfirmed.',
    cta: 'Verify with ASCAP/BMI Songview',
  },
};

// ── Run the pipeline ─────────────────────────────────────────────────────────
console.log('[TEST] normalizing raw engine output...');
const canonical = normalizeAuditResponse(rawEngineOutput);

console.log('[TEST] validating canonical output against schema...');
validateAuditResponse(canonical);

// ── Assertions ───────────────────────────────────────────────────────────────
const assert = (cond, msg) => { if (!cond) { console.error('✗ FAIL:', msg); process.exit(1); } console.log('✓', msg); };

assert(canonical.schemaVersion === AUDIT_RESPONSE_VERSION, `schemaVersion is ${AUDIT_RESPONSE_VERSION}`);
assert(typeof canonical.scanId === 'string' && canonical.scanId.length > 0, 'scanId generated');
assert(canonical.source.platform === 'spotify', 'source.platform preserved');
assert(canonical.subject.artistName === 'Radiohead', 'subject.artistName preserved');
assert(canonical.subject.trackIsrc === 'GBAYE9300001', 'subject.trackIsrc preserved');
assert(canonical.metrics.followers === 8234567, 'metrics.followers preserved');
assert(canonical.metrics.genres.length === 4, 'metrics.genres preserved');

// Platforms: booleans → availability enums
assert(canonical.platforms.spotify.availability === 'VERIFIED', 'platforms.spotify.availability VERIFIED');
assert(canonical.platforms.soundcloud.availability === 'NOT_FOUND', 'platforms.soundcloud.availability NOT_FOUND');
assert(canonical.platforms.appleMusic.details !== null, 'platforms.appleMusic.details populated');
assert(canonical.platforms.youtube.details.officialChannel !== null, 'platforms.youtube details present');

// Coverage
assert(canonical.auditCoverage.spotify.status === 'Verified', 'auditCoverage.spotify.status preserved');
assert(canonical.auditCoverageRaw._deprecated === true, 'auditCoverageRaw flagged deprecated');
assert(canonical.auditCoverageRaw.spotify.connected === true, 'auditCoverageRaw mirror correct');

// Modules: standardized shape + grade derivation
assert(canonical.modules.metadata.score === 82, 'modules.metadata.score preserved');
assert(canonical.modules.metadata.grade === 'B', 'modules.metadata.grade derived = B');
assert(canonical.modules.publishing.grade === 'F', 'modules.publishing.grade derived = F (52)');
assert(canonical.modules.publishing.issueCount === 2, 'modules.publishing.issueCount derived');
assert(canonical.modules.publishing.availability === 'AVAILABLE', 'modules.publishing.availability AVAILABLE');

// Issues: severity normalization CRITICAL (high + score < 40) / HIGH / WARNING / INFO
const issueSeverities = canonical.issues.map(i => i.severity);
assert(issueSeverities.includes('HIGH'), 'issues contain HIGH');
assert(issueSeverities.includes('WARNING'), 'issues contain WARNING');
assert(issueSeverities.includes('INFO'), 'issues contain INFO');
const issueIds = new Set(canonical.issues.map(i => i.id));
assert(issueIds.size === canonical.issues.length, 'issue IDs are unique');

// Score + risk
assert(canonical.score.overall >= 0 && canonical.score.overall <= 100, 'score.overall in range');
assert(['LOW','MODERATE','HIGH','CRITICAL'].includes(canonical.score.riskLevel), 'score.riskLevel valid');
assert(typeof canonical.score.riskSummary === 'string' && canonical.score.riskSummary.length > 0, 'score.riskSummary generated');

// Ownership
assert(canonical.ownership.status === 'unverified', 'ownership.status preserved');
assert(canonical.ownership.confidence === 'MEDIUM', 'ownership.confidence preserved');
assert(canonical.ownership.render !== null, 'ownership.render preserved');

// Reserved fields
assert(canonical.territoryCoverage === null, 'territoryCoverage explicit null');
assert(canonical.isrcValidation === null, 'isrcValidation explicit null');

console.log('\n─────────────────────────────────────────────');
console.log('✓ All assertions passed. Canonical shape:');
console.log('─────────────────────────────────────────────');
console.log(JSON.stringify(canonical, null, 2).slice(0, 2000) + '\n...[truncated]');

// Save the full canonical payload as a fixture for Python renderer testing
import { writeFileSync } from 'node:fs';
const fixturePath = '/home/claude/royalte-refactor/api/fixtures/canonical-radiohead.json';
writeFileSync(fixturePath, JSON.stringify(canonical, null, 2));
console.log(`\n✓ Canonical fixture saved to: ${fixturePath}`);

// ── Negative tests: failure modes ────────────────────────────────────────────
console.log('\n[TEST] Running negative tests (these SHOULD throw)...');

function expectThrow(fn, matcher, label) {
  try {
    fn();
    console.error(`✗ FAIL: ${label} — did not throw`);
    process.exit(1);
  } catch (e) {
    if (matcher.test(e.message)) {
      console.log(`✓ ${label} — threw as expected: ${e.message.slice(0, 80)}...`);
    } else {
      console.error(`✗ FAIL: ${label} — threw but wrong message: ${e.message}`);
      process.exit(1);
    }
  }
}

// Missing required field
expectThrow(
  () => validateAuditResponse({ ...canonical, subject: { ...canonical.subject, artistName: undefined } }),
  /required field missing.*artistName/,
  'missing required field throws'
);

// Wrong type
expectThrow(
  () => validateAuditResponse({ ...canonical, score: { ...canonical.score, overall: 'high' } }),
  /expected finite number/,
  'wrong type throws'
);

// Invalid enum
expectThrow(
  () => validateAuditResponse({ ...canonical, score: { ...canonical.score, riskLevel: 'EXTREME' } }),
  /value not in enum/,
  'invalid enum throws'
);

// Out-of-range
expectThrow(
  () => validateAuditResponse({ ...canonical, score: { ...canonical.score, overall: 150 } }),
  /above max 100/,
  'above max throws'
);

// Schema version mismatch
expectThrow(
  () => validateAuditResponse({ ...canonical, schemaVersion: '0.9.0' }),
  /schemaVersion mismatch/,
  'schema version mismatch throws'
);

// Null in non-nullable field
expectThrow(
  () => validateAuditResponse({ ...canonical, auditCoverage: null }),
  /field is null but not nullable/,
  'null in non-nullable throws'
);

console.log('\n✓ All negative tests passed.\n');
console.log('═════════════════════════════════════════════');
console.log('  PIPELINE VERIFIED: normalize + validate working end-to-end');
console.log('═════════════════════════════════════════════');
