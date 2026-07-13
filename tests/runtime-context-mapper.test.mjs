/**
 * ROYALTĒ RUNTIME CONTEXT MAPPER™ — Contract Completeness Tests
 *
 * Tests the 10 required contract paths specified by the Executive Board.
 * Run: node tests/runtime-context-mapper.test.mjs
 */

import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { buildWorkspaceRuntimeContext } = require('../public/js/runtime-context-mapper.js');

let passed = 0;
let failed = 0;

function assert(label, condition, detail) {
  if (condition) {
    console.log('  ✓', label);
    passed++;
  } else {
    console.error('  ✗', label, detail ? ('— ' + detail) : '');
    failed++;
  }
}

function assertEqual(label, actual, expected) {
  const ok = actual === expected;
  assert(label, ok, ok ? '' : ('got ' + JSON.stringify(actual) + ', expected ' + JSON.stringify(expected)));
}

function assertNull(label, value) {
  assert(label + ' is null', value === null, 'got ' + JSON.stringify(value));
}

function assertNotNull(label, value) {
  assert(label + ' is non-null', value !== null && value !== undefined, 'got null/undefined');
}

// ─── Fixtures ────────────────────────────────────────────────────────────────

const RAW_API_PAYLOAD = {
  // Production scan API shape — only these two at top-level
  identityIntelligence:   { providers: { apple: 'VERIFIED', spotify: 'VERIFIED' }, coverage: 100 },
  publishingIntelligence: { coverage: null, coverageStatus: 'Unavailable', supportedSources: ['mlc'] },
  scanId:   'test-scan-001',
  scannedAt: '2026-07-13T12:00:00.000Z',
  subject:  null,  // not at top-level in raw API
  canonical: {
    schemaVersion: '1.0',
    scanId:        'test-scan-001',
    scannedAt:     '2026-07-13T12:00:00.000Z',
    subject:       { artistName: 'Black Alternative', recordLabel: 'Castle Park Studioz (GmbH)', trackTitle: 'Everything Is Over', trackIsrc: 'QT6622698063' },
    healthIntelligence: { score: 90, grade: 'B', status: 'Excellent', identityScore: 100, publishingScore: 50, catalogScore: 100, backendScore: 100, footprintScore: 93, monitoringScore: 50, concerns: ['Monitoring not active'], strengths: ['Identity verified'] },
    healthScore:        { overallScore: 90, overallGrade: 'B', summary: 'Strong Foundation', generatedAt: '2026-07-13T12:00:00Z' },
    catalogIntelligence: { totalTracks: 4, singles: 4, albums: 0, eps: 0, catalogStatus: 'Stable', isrcCoverage: { status: 'Unknown', percent: null }, bestVerifiedRelease: { releaseTitle: 'Everything Is Over - Single', artistName: 'Black Alternative', releaseType: 'Single', artwork: 'https://example.com/artwork.jpg' } },
    backendIntelligence: { services: [{ key: 'musicbrainz', name: 'MusicBrainz', state: 'VERIFIED' }], connectedCount: 1, totalCount: 2, summaryLabel: '1 of 2 Connected' },
    globalMusicFootprint: { status: 'Strong', territoriesAvailable: 156, coveragePercent: 93, reachNarrative: 'Strong global presence.' },
    executiveBrief: { briefVersion: '1.0.0', generatedAt: '2026-07-13T12:00:01Z', executiveSummary: 'Strong foundation.', healthHeadline: 'Strong Foundation with Minor Gaps', executiveNarrative: 'Infrastructure reflects strong maturity.', topStrengths: [{ id: 'obs-1', label: 'Global presence', desc: 'Verified worldwide.' }], priorityActions: [] },
    monitoringIntelligence: null,
    royalteAI: { executiveInsight: 'Strong backend health.' },
    cim: { identity: { coverage: 100, verifiedProviders: 5, totalProviders: 5, providers: { apple: 'VERIFIED', spotify: 'VERIFIED', youtube: 'VERIFIED', deezer: 'VERIFIED', tidal: 'VERIFIED' }, issues: [] } },
  },
};

const SUPABASE_PAYLOAD = {
  // Supabase-stored shape — all fields at top-level (canonical IS the payload)
  scanId:   'test-scan-002',
  scannedAt: '2026-07-13T12:00:00.000Z',
  subject:  { artistName: 'Black Alternative', recordLabel: 'Castle Park Studioz (GmbH)', trackTitle: 'Everything Is Over' },
  healthIntelligence: { score: 88, grade: 'B', status: 'Good', identityScore: 95, publishingScore: 60, catalogScore: 98, backendScore: 100, footprintScore: 90, monitoringScore: 50, concerns: [], strengths: ['Identity verified'] },
  healthScore: { overallScore: 88, overallGrade: 'B', summary: 'Good', generatedAt: '2026-07-13T12:00:00Z' },
  catalogIntelligence: { totalTracks: 5, singles: 5, albums: 0, eps: 0, catalogStatus: 'Stable', isrcCoverage: { status: 'complete', percent: 100 }, bestVerifiedRelease: { releaseTitle: 'Test Single', artistName: 'Black Alternative', releaseType: 'Single', artwork: 'https://example.com/art2.jpg' } },
  backendIntelligence: { services: [{ key: 'musicbrainz', name: 'MusicBrainz', state: 'VERIFIED' }], connectedCount: 1, totalCount: 2, summaryLabel: '1 of 2 Connected' },
  globalMusicFootprint: { status: 'Global', territoriesAvailable: 180, coveragePercent: 99, reachNarrative: 'Worldwide.' },
  identityIntelligence: { providers: { apple: 'VERIFIED' }, coverage: 95 },
  publishingIntelligence: { coverage: 40, coverageStatus: 'Partial', supportedSources: ['mlc'] },
  executiveBrief: { briefVersion: '1.0.0', generatedAt: '2026-07-13T12:00:01Z', executiveSummary: 'Good.', healthHeadline: 'Good Health', topStrengths: [], priorityActions: [] },
  monitoringIntelligence: null,
  cim: { identity: { coverage: 95, verifiedProviders: 4, totalProviders: 5, providers: { apple: 'VERIFIED' }, issues: [] } },
  royalteAI: null,
};

const DERIVED = {
  artistName:  'Black Alternative',
  artwork:     'https://example.com/artist.jpg',
  recordLabel: 'Castle Park Studioz (GmbH)',
};

// ─── Test 1: Raw API response path ────────────────────────────────────────────
console.log('\nTest 1: Raw API response path');
{
  const ctx = buildWorkspaceRuntimeContext(RAW_API_PAYLOAD, null, DERIVED);

  assertEqual('schemaVersion',        ctx.schemaVersion,    '1.1');
  assertEqual('scanId',               ctx.scanId,           'test-scan-001');
  assertEqual('artistName (derived)', ctx.artistName,       'Black Alternative');
  assertEqual('recordLabel (derived)',ctx.recordLabel,      'Castle Park Studioz (GmbH)');
  assertNotNull('subject from canonical',         ctx.subject);
  assertEqual('subject.artistName',   ctx.subject && ctx.subject.artistName, 'Black Alternative');
  assertNotNull('healthIntelligence from canonical', ctx.healthIntelligence);
  assertEqual('healthIntelligence.score', ctx.healthIntelligence && ctx.healthIntelligence.score, 90);
  assertNotNull('catalogIntelligence from canonical', ctx.catalogIntelligence);
  assertNotNull('identityIntelligence top-level', ctx.identityIntelligence);
  assertNotNull('publishingIntelligence top-level', ctx.publishingIntelligence);
  assertNotNull('executiveBrief normalized', ctx.executiveBrief);
}

// ─── Test 2: Supabase canonical payload path ──────────────────────────────────
console.log('\nTest 2: Supabase canonical payload path');
{
  const ctx = buildWorkspaceRuntimeContext(SUPABASE_PAYLOAD, null, DERIVED);

  assertEqual('schemaVersion',        ctx.schemaVersion, '1.1');
  assertEqual('healthIntelligence.score', ctx.healthIntelligence && ctx.healthIntelligence.score, 88);
  assertEqual('catalogIntelligence.totalTracks', ctx.catalogIntelligence && ctx.catalogIntelligence.totalTracks, 5);
  assertEqual('globalMusicFootprint.status', ctx.globalMusicFootprint && ctx.globalMusicFootprint.status, 'Global');
  assertNotNull('executiveBrief normalized', ctx.executiveBrief);
  assertNotNull('identity from cim.identity', ctx.identity);
}

// ─── Test 3: Mixed payload path ───────────────────────────────────────────────
console.log('\nTest 3: Mixed payload path (some top-level, some canonical)');
{
  const mixed = {
    scanId: 'test-scan-003',
    scannedAt: '2026-07-13T12:00:00Z',
    // identityIntelligence at top-level (raw API alias)
    identityIntelligence: { providers: { apple: 'VERIFIED' }, coverage: 80 },
    // everything else in canonical
    canonical: {
      subject: { artistName: 'Mixed Artist' },
      healthIntelligence: { score: 75, grade: 'C' },
      catalogIntelligence: { totalTracks: 10, singles: 10, albums: 0, eps: 0 },
      executiveBrief: { healthHeadline: 'Needs Work', executiveSummary: 'Gaps exist.' },
      backendIntelligence: { services: [], connectedCount: 0, totalCount: 1, summaryLabel: '0 of 1' },
      globalMusicFootprint: { status: 'Regional', territoriesAvailable: 50, coveragePercent: 30 },
    },
  };
  const ctx = buildWorkspaceRuntimeContext(mixed, null, { artistName: 'Mixed Artist', artwork: null, recordLabel: null });

  assertEqual('identityIntelligence.coverage (top-level wins)', ctx.identityIntelligence && ctx.identityIntelligence.coverage, 80);
  assertEqual('healthIntelligence.score (canonical fallback)', ctx.healthIntelligence && ctx.healthIntelligence.score, 75);
  assertEqual('catalogIntelligence.totalTracks (canonical)', ctx.catalogIntelligence && ctx.catalogIntelligence.totalTracks, 10);
}

// ─── Test 4: Missing optional field ───────────────────────────────────────────
console.log('\nTest 4: Missing optional field produces null, not undefined');
{
  const minimal = {
    scanId: 'test-scan-004',
    scannedAt: null,
    canonical: { subject: { artistName: 'Minimal Artist' } },
  };
  const ctx = buildWorkspaceRuntimeContext(minimal, null, { artistName: 'Minimal Artist', artwork: null, recordLabel: null });

  assertNull('healthIntelligence', ctx.healthIntelligence);
  assertNull('catalogIntelligence', ctx.catalogIntelligence);
  assertNull('backendIntelligence', ctx.backendIntelligence);
  assertNull('globalMusicFootprint', ctx.globalMusicFootprint);
  assertNull('royalteAI', ctx.royalteAI);
  assertNull('executiveBrief', ctx.executiveBrief);  // no raw executiveBrief → null
  assert('monitoringIntelligence not null (baseline)', ctx.monitoringIntelligence !== null);
  assert('all 22 schema fields present', Object.keys(ctx).length >= 22, 'found ' + Object.keys(ctx).length);
}

// ─── Test 5: Executive Brief normalization ────────────────────────────────────
console.log('\nTest 5: Executive Brief normalization — healthHeadline → headline');
{
  const ctx = buildWorkspaceRuntimeContext(RAW_API_PAYLOAD, null, DERIVED);
  const eb = ctx.executiveBrief;

  assertNotNull('executiveBrief', eb);
  assertEqual('eb.headline (from healthHeadline)',  eb && eb.headline,  'Strong Foundation with Minor Gaps');
  assert('eb.healthHeadline removed',   eb && eb.healthHeadline === undefined, 'healthHeadline should not appear in output');
  assertEqual('eb.artistName (from subject)', eb && eb.artistName, 'Black Alternative');
  assertNotNull('eb.executiveSummary', eb && eb.executiveSummary);
  assert('eb.strengths is array',      eb && Array.isArray(eb.strengths));
  assert('eb.priorityActions is array',eb && Array.isArray(eb.priorityActions));
  assertNotNull('eb.healthGrade (from healthScore)', eb && eb.healthGrade);
  assert('eb.healthScore is number',   eb && typeof eb.healthScore === 'number');
}

// ─── Test 6: Health normalization — score field ───────────────────────────────
console.log('\nTest 6: Health normalization — score is stable, not overallScore');
{
  const ctx = buildWorkspaceRuntimeContext(RAW_API_PAYLOAD, null, DERIVED);

  assert('healthIntelligence uses .score', ctx.healthIntelligence && ctx.healthIntelligence.score === 90, 'score=' + (ctx.healthIntelligence && ctx.healthIntelligence.score));
  assert('healthIntelligence.score not .overallScore', ctx.healthIntelligence && ctx.healthIntelligence.overallScore === undefined, 'overallScore should not exist on healthIntelligence');
  // healthScore domain preserves overallScore (different object)
  assert('healthScore.overallScore present', ctx.healthScore && ctx.healthScore.overallScore === 90, 'overallScore=' + (ctx.healthScore && ctx.healthScore.overallScore));
  assertEqual('healthScore.overallGrade', ctx.healthScore && ctx.healthScore.overallGrade, 'B');
}

// ─── Test 7: First scan monitoring — null → baseline ─────────────────────────
console.log('\nTest 7: First scan monitoring — null → baseline object');
{
  const ctx = buildWorkspaceRuntimeContext(RAW_API_PAYLOAD, null, DERIVED);
  const mi = ctx.monitoringIntelligence;

  assertNotNull('monitoringIntelligence', mi);
  assertEqual('mi.status', mi && mi.status, 'baseline');
  assertEqual('mi.scanNumber', mi && mi.scanNumber, 1);
  assert('mi.baselineEstablished', mi && mi.baselineEstablished === true);
  assert('mi.events is empty array', mi && Array.isArray(mi.events) && mi.events.length === 0);
  assertEqual('mi.newThisScan', mi && mi.newThisScan, 0);
  assertEqual('mi.currentScanId', mi && mi.currentScanId, 'test-scan-001');
}

// ─── Test 8: Music Rights Profile absent ─────────────────────────────────────
console.log('\nTest 8: Music Rights Profile absent — publishingIntelligence still present');
{
  const ctx = buildWorkspaceRuntimeContext(RAW_API_PAYLOAD, null, DERIVED);

  assertNull('musicRightsProfile', ctx.musicRightsProfile);
  assertNotNull('publishingIntelligence still present', ctx.publishingIntelligence);
  assertEqual('publishingIntelligence.coverageStatus', ctx.publishingIntelligence && ctx.publishingIntelligence.coverageStatus, 'Unavailable');
}

// ─── Test 9: Music Rights Profile present ────────────────────────────────────
console.log('\nTest 9: Music Rights Profile present when supplied');
{
  const mrp = { performing_rights: { pro: 'SOCAN', soundexchange: 'Yes' } };
  const ctx = buildWorkspaceRuntimeContext(RAW_API_PAYLOAD, mrp, DERIVED);

  assertNotNull('musicRightsProfile', ctx.musicRightsProfile);
  assertEqual('mrp.performing_rights.pro', ctx.musicRightsProfile && ctx.musicRightsProfile.performing_rights && ctx.musicRightsProfile.performing_rights.pro, 'SOCAN');
}

// ─── Test 10: All 22 schema fields present ────────────────────────────────────
console.log('\nTest 10: All required schema fields present in output');
{
  const ctx = buildWorkspaceRuntimeContext(RAW_API_PAYLOAD, null, DERIVED);
  const REQUIRED_FIELDS = [
    'schemaVersion', 'scanId', 'generatedAt', 'scannedAt', 'artistName', 'artwork', 'recordLabel',
    'subject', 'identity', 'identityIntelligence', 'musicRightsProfile', 'publishingIntelligence',
    'catalogIntelligence', 'backendIntelligence', 'globalMusicFootprint', 'monitoringIntelligence',
    'healthIntelligence', 'healthReport', 'healthScore', 'royalteAI', 'executiveBrief',
    'metrics', 'catalog',
  ];
  const missing = REQUIRED_FIELDS.filter(function (f) { return !(f in ctx); });
  assert('all 23 schema fields present in output', missing.length === 0, 'missing: ' + missing.join(', '));

  // Verify no unexpected extra fields
  const extra = Object.keys(ctx).filter(function (k) { return !REQUIRED_FIELDS.includes(k); });
  assert('no unexpected extra fields', extra.length === 0, 'extra: ' + extra.join(', '));
}

// ─── Summary ─────────────────────────────────────────────────────────────────
console.log('\n──────────────────────────────────────────────');
console.log('Runtime Context Mapper™ Contract Tests');
console.log('Passed:', passed, '  Failed:', failed);
console.log('──────────────────────────────────────────────\n');

if (failed > 0) process.exit(1);
