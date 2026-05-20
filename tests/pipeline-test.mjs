// End-to-end test of the normalize+validate pipeline.
// Feeds a realistic raw engine output through and asserts the canonical output.

import { normalizeAuditResponse } from '../api/lib/normalizeAuditResponse.js';
import { validateAuditResponse, AUDIT_RESPONSE_VERSION } from '../api/schema/auditResponse.js';
import { persistCanonicalScan } from '../api/audit.js';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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
  gapBasedExposure: {
    indicators: [
      { id: 'content-id-gap', severity: 'HIGH',
        title: 'Unmonetized content activity detected',
        description: '1,234,567 user-generated views found with no verified channel claim.',
        exposureLow: 6173, exposureHigh: 61728,
        methodology: 'Video-network payout rate × UGC view volume / 1000' },
      { id: 'catalog-age', severity: 'MED',
        title: 'Extended royalty verification recommended',
        description: 'Catalog active for 33 years across 47 releases.',
        exposureLow: 4653, exposureHigh: 27918,
        methodology: 'Unaudited-activity accrual × (catalog age × release count)' },
      { id: 'sync-discoverability', severity: 'LOW',
        title: 'Sync licensing discoverability limited',
        description: 'Editorial reference signals partial.',
        exposureLow: null, exposureHigh: null,
        methodology: 'Exposure pending validation' },
    ],
    aggregateLow: 10826, aggregateHigh: 89646,
    pendingValidationCount: 1, hasAnyGaps: true,
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
  // Deterministic identity for fixture stability — see commit message for rationale.
  // The normalizer's `r.scanId || randomUUID()` and `r.scannedAt || new Date().toISOString()`
  // fallbacks mean production callers (audit.js, submit-audit.js) continue to get
  // fresh values; only this test injects fixed ones for byte-identical fixture output.
  scanId:    '00000000-0000-0000-0000-000000000001',
  scannedAt: '2026-01-01T00:00:00.000Z',
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
  // ownershipVerificationRender intentionally absent — exercises the
  // null-render path that real production audits hit. The schema marks
  // ownership.render as nullable for exactly this case.
};

// ═════════════════════════════════════════════════════════════════════════════
// ── SPOTIFY PATH ──
// ═════════════════════════════════════════════════════════════════════════════
console.log('\n═════════════════════════════════════════════');
console.log('  ── SPOTIFY PATH ──');
console.log('═════════════════════════════════════════════');

// ── Run the pipeline ─────────────────────────────────────────────────────────
console.log('[TEST] normalizing raw engine output...');
const canonical = normalizeAuditResponse(rawEngineOutput);

console.log('[TEST] validating canonical output against schema...');
validateAuditResponse(canonical);

// ── Assertions ───────────────────────────────────────────────────────────────
let positiveCount = 0;
const assert = (cond, msg) => {
  if (!cond) { console.error('✗ FAIL:', msg); process.exit(1); }
  console.log('✓', msg);
  positiveCount++;
};

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
assert(canonical.ownership.render === null, 'ownership.render null when raw lacks ownershipVerificationRender (production case)');

// Reserved fields
assert(canonical.territoryCoverage === null, 'territoryCoverage explicit null');
assert(canonical.isrcValidation === null, 'isrcValidation explicit null');

console.log('\n─────────────────────────────────────────────');
console.log('✓ All assertions passed. Canonical shape:');
console.log('─────────────────────────────────────────────');
console.log(JSON.stringify(canonical, null, 2).slice(0, 2000) + '\n...[truncated]');

// Save the full canonical payload as a fixture for Python renderer testing
import { writeFileSync } from 'node:fs';
const fixturePath = join(__dirname, '..', 'api', 'fixtures', 'canonical-radiohead.json');
writeFileSync(fixturePath, JSON.stringify(canonical, null, 2));
console.log(`\n✓ Canonical fixture saved to: ${fixturePath}`);

// ═════════════════════════════════════════════════════════════════════════════
// ── APPLE-RESOLVED-ONLY PATH ──
// Exercises the Shape B fallback from PR #8 (commit 9f4efcd): when the raw
// engine output has artistId = null but appleMusic.artistId populated, the
// canonical's subject.artistId resolves to the Apple ID via the
// spotifyId || appleId fallback in _normalizeSubject.
//
// "Apple-resolved-only" means the resolution code path where the normalizer
// received an Apple Music URL and could not produce a Spotify artist ID
// (Spotify cross-reference failed, name match below threshold, small/new
// or regional artist). The fixture is synthetic by design — not a real artist.
// ═════════════════════════════════════════════════════════════════════════════
console.log('\n═════════════════════════════════════════════');
console.log('  ── APPLE-RESOLVED-ONLY PATH ──');
console.log('═════════════════════════════════════════════');

const rawAppleOnlyOutput = {
  _originalUrl: 'https://music.apple.com/us/artist/test-apple-only-artist/1234567890',
  _storefront: 'us',
  platform: 'apple',                    // normalizer maps to 'apple_music' in canonical
  sourcePlatform: 'apple_music',
  type: 'artist',
  resolvedFrom: 'artist',
  artistName: 'Test Apple Only Artist', // clearly synthetic
  artistId: null,                       // ← Spotify ID absent — Shape B fallback fires
  followers: 0,
  popularity: 0,
  genres: [],
  trackTitle: null,
  trackIsrc: null,
  trackIsrcSource: null,
  platforms: {
    spotify: false, musicbrainz: false, deezer: false, audiodb: false,
    discogs: false, soundcloud: false, lastfm: false, wikipedia: false,
    youtube: false, appleMusic: true, tidal: false,
  },
  catalog: {
    totalReleases: 3, earliestYear: 2022, latestYear: 2024,
    catalogAgeYears: 2, estimatedAnnualStreams: 50000, recentActivity: true,
  },
  royaltyGap: {
    estAnnualStreams: 0, estLifetimeStreams: 0,
    estSpotifyRoyalties: 0, estPROEarnings: 0,
    estTotalRoyalties: 0, potentialGapLow: 0, potentialGapHigh: 0,
    catalogYears: 2, ugcUnmonetisedViews: 0, ugcPotentialRevenue: 0,
    disclaimer: 'Estimates only. Verify with your distributor and PRO.',
  },
  proGuide: {
    pro: 'Your local PRO', url: 'https://www.cisac.org',
    steps: [], note: '', country: null,
  },
  country: null,
  lastfmPlays: 0, lastfmListeners: 0,
  wikipediaUrl: null,
  deezerFans: 0, tidalPopularity: 0, discogsReleases: 0,
  // youtube intentionally found:false with NO `reason` field — keeps availability
  // as NOT_FOUND, not AUTH_UNAVAILABLE (assertion #7 depends on this)
  youtube: { found: false },
  appleMusic: {
    found: true,
    artistId: '1234567890',
    artistUrl: 'https://music.apple.com/us/artist/test-apple-only-artist/1234567890',
    genres: [], albumCount: 3,
    isrcLookup: null,
    catalogComparison: null,
  },
  appleMusicSource: null,
  overallScore: 50,
  // All 6 module keys populated — prevents normalizer from defaulting any of
  // them to AUTH_UNAVAILABLE (assertion #7 depends on this)
  modules: {
    metadata:   { name: 'Metadata Integrity',  score: 60, flags: [] },
    coverage:   { name: 'Platform Coverage',   score: 40, flags: [] },
    publishing: { name: 'Publishing Risk',     score: 50, flags: [] },
    duplicates: { name: 'Duplicate Detection', score: 70, flags: [] },
    youtube:    { name: 'YouTube / UGC',       score: 50, flags: [] },
    sync:       { name: 'Sync Readiness',      score: 50, flags: [] },
  },
  flags: [],
  // Deterministic identity — separate UUID from the Radiohead fixture so the
  // two fixtures are visually distinguishable in audit_scans / debug logs.
  scanId:    '00000000-0000-0000-0000-000000000002',
  scannedAt: '2026-01-01T00:00:00.000Z',
  auditCoverage: {
    spotify:       { status: 'Not Confirmed', tier: null },
    appleMusic:    { status: 'Verified',      tier: 'artist' },
    publishing:    { status: 'Not Confirmed', tier: null },
    soundExchange: { status: 'Not Confirmed', tier: null },
  },
  // Confidence values must NOT be AUTH_UNAVAILABLE (assertion #7 depends on this)
  ownershipVerification: {
    ownership_status: 'unverified',
    confidence: 'LOW',
    score_impact: 0,
    spotify_confidence: 'LOW',
    apple_confidence: 'MEDIUM',
  },
  ownershipVerificationRender: {
    headline: 'Ownership: Unverified',
    detail: 'Apple Music presence confirmed; PRO registration unconfirmed.',
    cta: 'Verify with ASCAP/BMI Songview',
  },
};

console.log('[TEST] normalizing Apple-resolved-only raw engine output...');
const canonicalAppleOnly = normalizeAuditResponse(rawAppleOnlyOutput);

console.log('[TEST] validating Apple-resolved-only canonical output against schema...');
validateAuditResponse(canonicalAppleOnly);

// ── Apple-resolved-only assertions ───────────────────────────────────────────
assert(canonicalAppleOnly.subject.artistName === 'Test Apple Only Artist', 'apple subject.artistName preserved');
assert(canonicalAppleOnly.subject.artistId === '1234567890', 'apple subject.artistId resolves to Apple ID via Shape B fallback');
assert(canonicalAppleOnly.source.platform === 'apple_music', 'apple source.platform mapped to apple_music');
assert(canonicalAppleOnly.source.resolvedFrom === 'artist', 'apple source.resolvedFrom is artist');
assert(canonicalAppleOnly.platforms.appleMusic.details !== null, 'apple platforms.appleMusic.details populated');
assert(['VERIFIED', 'NOT_FOUND', 'ERROR'].includes(canonicalAppleOnly.platforms.appleMusic.availability), 'apple platforms.appleMusic.availability is a valid non-AUTH_UNAVAILABLE enum');
assert(!JSON.stringify(canonicalAppleOnly).includes('AUTH_UNAVAILABLE'), 'apple canonical contains no AUTH_UNAVAILABLE leakage');
assert(canonicalAppleOnly.schemaVersion === AUDIT_RESPONSE_VERSION, `apple schemaVersion is ${AUDIT_RESPONSE_VERSION}`);
assert(typeof canonicalAppleOnly.scanId === 'string' && canonicalAppleOnly.scanId.length > 0, 'apple scanId generated');
assert(canonicalAppleOnly.subject.trackTitle === null, 'apple subject.trackTitle null for artist-URL scan');

const appleFixturePath = join(__dirname, '..', 'api', 'fixtures', 'canonical-apple-resolved-only.json');
writeFileSync(appleFixturePath, JSON.stringify(canonicalAppleOnly, null, 2));
console.log(`\n✓ Apple-resolved-only canonical fixture saved to: ${appleFixturePath}`);

// ── Negative tests: failure modes ────────────────────────────────────────────
console.log('\n[TEST] Running negative tests (these SHOULD throw)...');

let negativeCount = 0;
function expectThrow(fn, matcher, label) {
  try {
    fn();
    console.error(`✗ FAIL: ${label} — did not throw`);
    process.exit(1);
  } catch (e) {
    if (matcher.test(e.message)) {
      console.log(`✓ ${label} — threw as expected: ${e.message.slice(0, 80)}...`);
      negativeCount++;
    } else {
      console.error(`✗ FAIL: ${label} — threw but wrong message: ${e.message}`);
      process.exit(1);
    }
  }
}

async function expectThrowAsync(fn, matcher, label) {
  try {
    await fn();
    console.error(`✗ FAIL: ${label} — did not throw`);
    process.exit(1);
  } catch (e) {
    if (matcher.test(e.message)) {
      console.log(`✓ ${label} — threw as expected: ${e.message.slice(0, 100)}...`);
      negativeCount++;
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

// Apple-resolved raw with BOTH artistId and appleMusic.artistId null — guard
// at normalizeAuditResponse.js L82-84 must throw before reaching the Shape B
// fallback at L87. This is the failure mode the L82 guard exists to prevent.
expectThrow(
  () => normalizeAuditResponse({
    ...rawAppleOnlyOutput,
    artistId: null,
    appleMusic: { ...rawAppleOnlyOutput.appleMusic, artistId: null },
  }),
  /at least one platform artist ID/,
  'apple raw with both artistId and appleMusic.artistId null throws guard error'
);

// persistCanonicalScan validation gate (dev/test env path):
// raw → normalize → validate → handleSchemaViolation re-throws because
// VERCEL_ENV is unset. _normalizeOwnership passes ov.ownership_status through
// unchanged when truthy, so a non-enum value produces a canonical that
// normalizes cleanly but trips the validator at $.ownership.status.
//
// Dummy Supabase creds let getAuditScansSupabase return a client (truthy env
// check), but no DB call ever fires — validation throws first.
const savedSupabaseUrl = process.env.SUPABASE_URL;
const savedSupabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const savedVercelEnv   = process.env.VERCEL_ENV;

try {
  process.env.SUPABASE_URL              = 'https://test-not-real.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key-not-real';
  delete process.env.VERCEL_ENV;

  const rawWithInvalidOwnership = {
    ...rawEngineOutput,
    ownershipVerification: {
      ...rawEngineOutput.ownershipVerification,
      ownership_status: 'TOTALLY_BOGUS_NOT_AN_ENUM_VALUE',
    },
  };

  await expectThrowAsync(
    () => persistCanonicalScan(
      rawWithInvalidOwnership,
      'https://open.spotify.com/artist/test',
      'artist',
      '00000000-0000-0000-0000-0000000000aa',
    ),
    /ownership\.status/,
    'persistCanonicalScan throws AuditSchemaError when canonical fails validation (test env)'
  );
} finally {
  if (savedSupabaseUrl === undefined) delete process.env.SUPABASE_URL;
  else process.env.SUPABASE_URL = savedSupabaseUrl;
  if (savedSupabaseKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  else process.env.SUPABASE_SERVICE_ROLE_KEY = savedSupabaseKey;
  if (savedVercelEnv !== undefined) process.env.VERCEL_ENV = savedVercelEnv;
}

console.log('\n✓ All negative tests passed.\n');

// ─── V2 OS scan-write path (Brief 003) ──────────────────────────────────────
// Unit tests against persistOSScanSnapshot with a mock Supabase client.
// Confirms:
//   • scan_snapshots insert includes the V2 fields (artist_id, artist_name,
//     canonical_data, scan_number, status) per the brief.
//   • monitoring_subscriptions upsert is invoked with onConflict on
//     (user_id, artist_id) and the expected payload.
//
// computeDelta is exercised here transitively; its own coverage lives in
// tests/delta-engine-test.mjs.

console.log('\n[TEST] V2 OS scan-write path (Brief 003)...');

const { persistOSScanSnapshot } = await import('../api/_lib/persist-os-scan.js');

function buildOSMockSupabase({ priorScanCount = 0, priorSequence = null } = {}) {
  const captured = { inserts: {}, upserts: {}, updates: {} };
  return {
    _captured: captured,
    from(table) {
      const builder = {
        // .select with count flag — used for scan_number = COUNT(*) + 1.
        select(_cols, opts) {
          if (opts && opts.count === 'exact' && opts.head === true) {
            const filterable = {
              eq() { return filterable; },
              then(resolve) {
                return resolve({ count: priorScanCount, error: null });
              },
            };
            return filterable;
          }
          // sequence_number lookup — order().limit().maybeSingle().
          const queryable = {
            eq() { return queryable; },
            neq() { return queryable; },
            order() { return queryable; },
            limit() { return queryable; },
            maybeSingle() {
              return Promise.resolve({
                data: priorSequence === null ? null : { sequence_number: priorSequence },
                error: null,
              });
            },
            single() {
              return Promise.resolve({ data: null, error: null });
            },
          };
          return queryable;
        },
        insert(row) {
          const list = Array.isArray(row) ? row : [row];
          captured.inserts[table] = (captured.inserts[table] || []).concat(list);
          // The persist-os-scan helper expects .insert(row).select('*').single()
          // to return the inserted row including its generated id.
          const withId = { ...list[0], id: 'inserted-snapshot-id' };
          return {
            select() {
              return {
                single() {
                  return Promise.resolve({ data: withId, error: null });
                },
              };
            },
            then(resolve) {
              return resolve({ data: list, error: null });
            },
          };
        },
        update(payload) {
          return {
            eq(col, val) {
              captured.updates[table] = (captured.updates[table] || []).concat([
                { payload, where: { [col]: val } },
              ]);
              return Promise.resolve({ data: payload, error: null });
            },
          };
        },
        upsert(row, opts) {
          captured.upserts[table] = (captured.upserts[table] || []).concat([{ row, opts }]);
          return Promise.resolve({ data: row, error: null });
        },
      };
      return builder;
    },
  };
}

// Test 1 — scan_snapshots insert includes the V2 fields per the brief.
{
  const sb = buildOSMockSupabase({ priorScanCount: 0, priorSequence: null });
  const canonicalForOS = {
    schemaVersion: '1.1.0',
    subject: { artistId: 'spotify-1lnM3VZrD6SG9vxBsE9654', artistName: 'Black Alternative' },
    issues: [],
  };
  const result = await persistOSScanSnapshot({
    canonical: canonicalForOS,
    urlType: 'spotify',
    userId: 'user-test-uuid',
    supabase: sb,
    warnings: [],
  });

  assert(result.written === true, 'os-scan: write reported as successful');
  assert(result.scanNumber === 1, 'os-scan: scan_number is 1 for a brand-new (user, artist)');

  const snapshots = sb._captured.inserts.scan_snapshots || [];
  assert(snapshots.length === 1, 'os-scan: exactly one scan_snapshots insert');
  const ins = snapshots[0];
  assert(ins.user_id === 'user-test-uuid', 'os-scan: user_id wired');
  assert(ins.artist_id === 'spotify-1lnM3VZrD6SG9vxBsE9654', 'os-scan: artist_id from canonical.subject');
  assert(ins.artist_name === 'Black Alternative', 'os-scan: artist_name from canonical.subject');
  assert(ins.canonical_data && ins.canonical_data.schemaVersion === '1.1.0', 'os-scan: canonical_data populated');
  assert(ins.payload && ins.payload === ins.canonical_data, 'os-scan: payload mirrors canonical_data (V1 compat)');
  assert(ins.scan_number === 1, 'os-scan: scan_number = 1 (baseline)');
  assert(ins.sequence_number === 1, 'os-scan: legacy sequence_number populated to 1');
  assert(ins.source === 'spotify', 'os-scan: source maps to V2 platform enum (spotify)');
  assert(ins.status === 'complete', 'os-scan: status = complete when no warnings');
  assert(typeof ins.scanned_at === 'string' && ins.scanned_at.length > 0, 'os-scan: scanned_at is an ISO string');
}

// Test 2 — monitoring_subscriptions upsert is wired with correct keys + onConflict.
{
  const sb = buildOSMockSupabase({ priorScanCount: 2, priorSequence: 4 });
  const canonicalForOS = {
    schemaVersion: '1.1.0',
    subject: { artistId: 'spotify-xyz', artistName: 'Test Artist' },
    issues: [],
  };
  await persistOSScanSnapshot({
    canonical: canonicalForOS,
    urlType: 'apple_music',
    userId: 'user-A',
    supabase: sb,
    warnings: ['some-degradation'],
  });

  const upserts = sb._captured.upserts.monitoring_subscriptions || [];
  assert(upserts.length === 1, 'os-scan: exactly one monitoring_subscriptions upsert');
  assert(upserts[0].opts && upserts[0].opts.onConflict === 'user_id,artist_id', 'os-scan: upsert onConflict targets (user_id, artist_id)');
  const sub = upserts[0].row;
  assert(sub.user_id === 'user-A', 'os-scan: subscription user_id');
  assert(sub.artist_id === 'spotify-xyz', 'os-scan: subscription artist_id');
  assert(sub.artist_name === 'Test Artist', 'os-scan: subscription artist_name');
  assert(sub.scan_frequency === 'weekly', 'os-scan: subscription scan_frequency defaults to weekly');
  assert(sub.active === true, 'os-scan: subscription set active=true');
  assert(typeof sub.last_scanned_at === 'string', 'os-scan: subscription last_scanned_at set');
  assert(typeof sub.next_scan_at === 'string', 'os-scan: subscription next_scan_at set');
  // next ≈ last + 7 days
  const last = new Date(sub.last_scanned_at).getTime();
  const next = new Date(sub.next_scan_at).getTime();
  const diffDays = Math.round((next - last) / (1000 * 60 * 60 * 24));
  assert(diffDays === 7, 'os-scan: next_scan_at is exactly 7 days after last_scanned_at');

  // Also verify scan_number = prior_count + 1, sequence_number = prior_max + 1,
  // and that 'partial' status fires when warnings are non-empty.
  const ins = sb._captured.inserts.scan_snapshots[0];
  assert(ins.scan_number === 3, 'os-scan: scan_number = priorScanCount(2) + 1');
  assert(ins.sequence_number === 5, 'os-scan: sequence_number = priorMax(4) + 1');
  assert(ins.source === 'apple_music', 'os-scan: source maps to apple_music for Apple URL');
  assert(ins.status === 'partial', 'os-scan: status = partial when warnings non-empty');
}

// Test 3 — no-op short-circuits (anonymous / no canonical / no subject).
{
  const sb = buildOSMockSupabase();
  const r1 = await persistOSScanSnapshot({ canonical: { subject: { artistId: 'x', artistName: 'y' } }, urlType: 'spotify', userId: null, supabase: sb });
  assert(r1.written === false && r1.reason === 'no_user_id', 'os-scan: skips cleanly when no user_id (anonymous scan)');
  const r2 = await persistOSScanSnapshot({ canonical: null, urlType: 'spotify', userId: 'u', supabase: sb });
  assert(r2.written === false && r2.reason === 'no_canonical', 'os-scan: skips cleanly when no canonical');
  const r3 = await persistOSScanSnapshot({ canonical: { subject: {} }, urlType: 'spotify', userId: 'u', supabase: sb });
  assert(r3.written === false && r3.reason === 'no_artist_subject', 'os-scan: skips cleanly when subject has no artistId/artistName');
  assert(!sb._captured.inserts.scan_snapshots, 'os-scan: no insert occurred for any of the short-circuit cases');
}

console.log('\n✓ V2 OS scan-write path tests passed.\n');

console.log('═════════════════════════════════════════════');
console.log('  PIPELINE VERIFIED: normalize + validate working end-to-end');
console.log('═════════════════════════════════════════════');
console.log(`Total: ${positiveCount} positive + ${negativeCount} negative assertions passed`);
