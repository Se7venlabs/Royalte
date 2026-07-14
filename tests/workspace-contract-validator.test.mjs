/**
 * ROYALTE WORKSPACE CONTRACT VALIDATOR -- Certification Tests
 *
 * Tests all 8 named workspace contracts with required fields, required types,
 * and the type_mismatch state. Also covers MRP absent/present and
 * monitoring baseline/second-scan scenarios.
 *
 * Run: node tests/workspace-contract-validator.test.mjs
 */

import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const { validateContract, WORKSPACE_CONTRACTS } = require('../public/js/mc-workspace-context.js');
const { buildWorkspaceRuntimeContext }           = require('../public/js/runtime-context-mapper.js');

let passed = 0;
let failed = 0;

function assert(label, condition, detail) {
  if (condition) {
    console.log('  OK', label);
    passed++;
  } else {
    console.error('  FAIL', label, detail ? ('-- ' + detail) : '');
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

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

// Full context representing a healthy Black Alternative scan (all domains present)
const FULL_CTX = {
  schemaVersion:          '1.1',
  scanId:                 'e0aa20ef-5962-4e1c-a6b2-0c02b02aa7f8',
  generatedAt:            new Date().toISOString(),
  scannedAt:              '2026-07-14T11:13:20.690Z',
  artistName:             'Black Alternative',
  artwork:                'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/artwork.jpg',
  recordLabel:            'Castle Park Studioz (GmbH)',
  subject:                { artistName: 'Black Alternative', recordLabel: 'Castle Park Studioz (GmbH)' },
  identity:               { coverage: 100, verifiedProviders: 5, totalProviders: 5, providers: { apple: 'VERIFIED', spotify: 'VERIFIED', youtube: 'VERIFIED', deezer: 'VERIFIED', tidal: 'VERIFIED' }, issues: [] },
  identityIntelligence:   { providers: { apple: 'VERIFIED', spotify: 'VERIFIED', youtube: 'VERIFIED', deezer: 'VERIFIED', tidal: 'VERIFIED' }, coverage: 100 },
  musicRightsProfile:     null,
  publishingIntelligence: { coverage: 0, coverageStatus: 'Unavailable', supportedSources: ['mlc'] },
  catalogIntelligence:    { totalTracks: 4, singles: 4, albums: 0, eps: 0, catalogStatus: 'Stable', isrcCoverage: { status: 'Unknown', percent: null }, bestVerifiedRelease: { releaseTitle: 'Everything Is Over - Single', artistName: 'Black Alternative', releaseType: 'Single', artwork: 'https://example.com/art.jpg' } },
  backendIntelligence:    { services: [{ key: 'musicbrainz', name: 'MusicBrainz', state: 'VERIFIED' }, { key: 'discogs', name: 'Discogs', state: 'NOT_FOUND' }], connectedCount: 1, totalCount: 2 },
  globalMusicFootprint:   { status: 'Strong', territoriesAvailable: 156, coveragePercent: 93, reachNarrative: 'Strong global presence.' },
  monitoringIntelligence: { status: 'baseline', scanNumber: 1, baselineEstablished: true, previousScanId: null, currentScanId: 'e0aa20ef', events: [], newThisScan: 0, generatedAt: null },
  healthIntelligence:     { score: 90, grade: 'B', status: 'Excellent', identityScore: 100, publishingScore: 50 },
  healthReport:           { grade: 'B', risks: [], strengths: ['Identity verified'] },
  healthScore:            { overallScore: 90, overallGrade: 'B', summary: 'Strong Foundation' },
  royalteAI:              { executiveInsight: 'Strong backend health.' },
  executiveBrief:         { headline: 'Strong Foundation with Minor Gaps', artistName: 'Black Alternative', executiveSummary: 'Strong.', healthGrade: 'B', healthScore: 90, priorityActions: [], strengths: [], opportunities: [], risks: [], briefVersion: '1.0.0' },
  metrics:                null,
  catalog:                null,
};

// ---------------------------------------------------------------------------
// Test Suite 1: Health Intelligence contract
// ---------------------------------------------------------------------------
console.log('\nSuite 1: Health Intelligence -- required fields and types');
{
  const r = validateContract(FULL_CTX, 'health-intelligence');
  assertEqual('state', r.state, 'valid');

  // Missing score
  const noScore = Object.assign({}, FULL_CTX, { healthIntelligence: { status: 'Good' } });
  const r2 = validateContract(noScore, 'health-intelligence');
  assertEqual('missing score -> missing_field', r2.state, 'missing_field');
  assert('missingFields includes score', r2.missingFields && r2.missingFields.includes('healthIntelligence.score'));

  // Score is string not number -> type_mismatch
  const badScore = Object.assign({}, FULL_CTX, { healthIntelligence: { score: '90', status: 'Excellent' } });
  const r3 = validateContract(badScore, 'health-intelligence');
  assertEqual('string score -> type_mismatch', r3.state, 'type_mismatch');
  assert('mismatch field is score', r3.typeMismatches && r3.typeMismatches[0] && r3.typeMismatches[0].field === 'healthIntelligence.score');
  assert('mismatch expected number', r3.typeMismatches && r3.typeMismatches[0] && r3.typeMismatches[0].expected === 'number');
  assert('mismatch received string', r3.typeMismatches && r3.typeMismatches[0] && r3.typeMismatches[0].received === 'string');

  // Empty status -> type_mismatch (non-empty-string)
  const emptyStatus = Object.assign({}, FULL_CTX, { healthIntelligence: { score: 90, status: '' } });
  const r4 = validateContract(emptyStatus, 'health-intelligence');
  assertEqual('empty status -> type_mismatch', r4.state, 'type_mismatch');

  // No healthIntelligence domain at all -> missing_domain
  const noDomain = Object.assign({}, FULL_CTX, { healthIntelligence: null });
  const r5 = validateContract(noDomain, 'health-intelligence');
  assertEqual('null domain -> missing_domain', r5.state, 'missing_domain');
}

// ---------------------------------------------------------------------------
// Suite 2: Identity Intelligence -- provider requirement
// ---------------------------------------------------------------------------
console.log('\nSuite 2: Identity Intelligence -- provider requirement');
{
  const r = validateContract(FULL_CTX, 'identity-intelligence');
  assertEqual('state', r.state, 'valid');

  // No providers -> missing_field
  const noProviders = Object.assign({}, FULL_CTX, { identity: { coverage: 100, verifiedProviders: 5, totalProviders: 5 } });
  const r2 = validateContract(noProviders, 'identity-intelligence');
  assertEqual('no providers -> missing_field', r2.state, 'missing_field');
  assert('missingFields includes providers', r2.missingFields && r2.missingFields.includes('identity.providers'));

  // providers is array not object -> type_mismatch
  const arrayProviders = Object.assign({}, FULL_CTX, { identity: { coverage: 100, providers: ['apple', 'spotify'] } });
  const r3 = validateContract(arrayProviders, 'identity-intelligence');
  assertEqual('array providers -> type_mismatch', r3.state, 'type_mismatch');
  assert('mismatch field is providers', r3.typeMismatches && r3.typeMismatches[0] && r3.typeMismatches[0].field === 'identity.providers');

  // No subject domain -> missing_domain
  const noSubject = Object.assign({}, FULL_CTX, { subject: null });
  const r4 = validateContract(noSubject, 'identity-intelligence');
  assertEqual('no subject -> missing_domain', r4.state, 'missing_domain');

  // Empty artistName -> type_mismatch
  const emptyArtist = Object.assign({}, FULL_CTX, { subject: { artistName: '', recordLabel: 'Label' } });
  const r5 = validateContract(emptyArtist, 'identity-intelligence');
  assertEqual('empty artistName -> type_mismatch', r5.state, 'type_mismatch');
}

// ---------------------------------------------------------------------------
// Suite 3: Monitoring Timeline -- required fields and types
// ---------------------------------------------------------------------------
console.log('\nSuite 3: Monitoring Timeline -- required fields and types');
{
  // Baseline first scan
  const r = validateContract(FULL_CTX, 'monitoring-timeline');
  assertEqual('baseline state', r.state, 'valid');

  // Second scan (has events)
  const secondScan = Object.assign({}, FULL_CTX, {
    monitoringIntelligence: {
      status: 'active', scanNumber: 2, baselineEstablished: true,
      previousScanId: 'prev-id', currentScanId: 'curr-id',
      events: [{ type: 'ADDED', field: 'territory', value: 'DE' }],
      newThisScan: 1, generatedAt: '2026-07-14T12:00:00Z',
    },
  });
  const r2 = validateContract(secondScan, 'monitoring-timeline');
  assertEqual('second scan state', r2.state, 'valid');

  // No monitoringIntelligence domain -> missing_domain (mapper always produces this now)
  const noDomain = Object.assign({}, FULL_CTX, { monitoringIntelligence: null });
  const r3 = validateContract(noDomain, 'monitoring-timeline');
  assertEqual('null mi -> missing_domain', r3.state, 'missing_domain');

  // events is object not array -> type_mismatch
  const badEvents = Object.assign({}, FULL_CTX, {
    monitoringIntelligence: { status: 'baseline', scanNumber: 1, events: {} },
  });
  const r4 = validateContract(badEvents, 'monitoring-timeline');
  assertEqual('object events -> type_mismatch', r4.state, 'type_mismatch');
  assert('mismatch field is events', r4.typeMismatches && r4.typeMismatches[0] && r4.typeMismatches[0].field === 'monitoringIntelligence.events');
  assert('mismatch expected array', r4.typeMismatches && r4.typeMismatches[0] && r4.typeMismatches[0].expected === 'array');

  // scanNumber is string -> type_mismatch
  const badNumber = Object.assign({}, FULL_CTX, {
    monitoringIntelligence: { status: 'baseline', scanNumber: '1', events: [] },
  });
  const r5 = validateContract(badNumber, 'monitoring-timeline');
  assertEqual('string scanNumber -> type_mismatch', r5.state, 'type_mismatch');
}

// ---------------------------------------------------------------------------
// Suite 4: Catalog -- number validation
// ---------------------------------------------------------------------------
console.log('\nSuite 4: Catalog Intelligence -- number validation');
{
  const r = validateContract(FULL_CTX, 'catalog-intelligence');
  assertEqual('state', r.state, 'valid');

  // totalTracks as string -> type_mismatch
  const badTracks = Object.assign({}, FULL_CTX, { catalogIntelligence: { totalTracks: '4' } });
  const r2 = validateContract(badTracks, 'catalog-intelligence');
  assertEqual('string totalTracks -> type_mismatch', r2.state, 'type_mismatch');

  // totalTracks 0 (valid number) -> valid
  const zeroTracks = Object.assign({}, FULL_CTX, { catalogIntelligence: { totalTracks: 0 } });
  const r3 = validateContract(zeroTracks, 'catalog-intelligence');
  assertEqual('zero totalTracks -> valid', r3.state, 'valid');

  // No catalogIntelligence -> missing_domain
  const noCat = Object.assign({}, FULL_CTX, { catalogIntelligence: null });
  const r4 = validateContract(noCat, 'catalog-intelligence');
  assertEqual('null catalog -> missing_domain', r4.state, 'missing_domain');
}

// ---------------------------------------------------------------------------
// Suite 5: Backend -- services array validation
// ---------------------------------------------------------------------------
console.log('\nSuite 5: Backend Intelligence -- services array validation');
{
  const r = validateContract(FULL_CTX, 'backend-intelligence');
  assertEqual('state', r.state, 'valid');

  // services is object not array -> type_mismatch
  const badServices = Object.assign({}, FULL_CTX, { backendIntelligence: { services: { musicbrainz: 'VERIFIED' } } });
  const r2 = validateContract(badServices, 'backend-intelligence');
  assertEqual('object services -> type_mismatch', r2.state, 'type_mismatch');
  assert('mismatch field is services', r2.typeMismatches && r2.typeMismatches[0] && r2.typeMismatches[0].field === 'backendIntelligence.services');

  // services is empty array -> valid (presence + type correct)
  const emptyServices = Object.assign({}, FULL_CTX, { backendIntelligence: { services: [] } });
  const r3 = validateContract(emptyServices, 'backend-intelligence');
  assertEqual('empty services array -> valid', r3.state, 'valid');
}

// ---------------------------------------------------------------------------
// Suite 6: Global Music Footprint -- number and string validation
// ---------------------------------------------------------------------------
console.log('\nSuite 6: Global Music Footprint -- number and string validation');
{
  const r = validateContract(FULL_CTX, 'global-music-footprint');
  assertEqual('state', r.state, 'valid');

  // territoriesAvailable as string -> type_mismatch
  const badTerr = Object.assign({}, FULL_CTX, { globalMusicFootprint: { status: 'Strong', territoriesAvailable: '156' } });
  const r2 = validateContract(badTerr, 'global-music-footprint');
  assertEqual('string territories -> type_mismatch', r2.state, 'type_mismatch');
  assert('mismatch field is territoriesAvailable', r2.typeMismatches && r2.typeMismatches[0] && r2.typeMismatches[0].field === 'globalMusicFootprint.territoriesAvailable');

  // Empty status -> type_mismatch
  const emptyStatus = Object.assign({}, FULL_CTX, { globalMusicFootprint: { status: '', territoriesAvailable: 156 } });
  const r3 = validateContract(emptyStatus, 'global-music-footprint');
  assertEqual('empty status -> type_mismatch', r3.state, 'type_mismatch');

  // Both correct -> valid
  const r4 = validateContract(FULL_CTX, 'global-music-footprint');
  assertEqual('good values -> valid', r4.state, 'valid');
}

// ---------------------------------------------------------------------------
// Suite 7: AI Insights -- headline non-empty string validation
// ---------------------------------------------------------------------------
console.log('\nSuite 7: AI Insights -- headline non-empty string');
{
  const r = validateContract(FULL_CTX, 'ai-insights');
  assertEqual('state', r.state, 'valid');

  // headline is empty string -> type_mismatch
  const emptyHeadline = Object.assign({}, FULL_CTX, { executiveBrief: Object.assign({}, FULL_CTX.executiveBrief, { headline: '' }) });
  const r2 = validateContract(emptyHeadline, 'ai-insights');
  assertEqual('empty headline -> type_mismatch', r2.state, 'type_mismatch');
  assert('mismatch field is headline', r2.typeMismatches && r2.typeMismatches[0] && r2.typeMismatches[0].field === 'executiveBrief.headline');
  assert('mismatch expected non-empty-string', r2.typeMismatches && r2.typeMismatches[0] && r2.typeMismatches[0].expected === 'non-empty-string');

  // headline absent -> missing_field
  const noHeadline = Object.assign({}, FULL_CTX, { executiveBrief: { artistName: 'Black Alternative' } });
  const r3 = validateContract(noHeadline, 'ai-insights');
  assertEqual('no headline -> missing_field', r3.state, 'missing_field');

  // headline is number -> type_mismatch
  const numHeadline = Object.assign({}, FULL_CTX, { executiveBrief: Object.assign({}, FULL_CTX.executiveBrief, { headline: 90 }) });
  const r4 = validateContract(numHeadline, 'ai-insights');
  assertEqual('number headline -> type_mismatch', r4.state, 'type_mismatch');
}

// ---------------------------------------------------------------------------
// Suite 8: type_mismatch state completeness
// ---------------------------------------------------------------------------
console.log('\nSuite 8: type_mismatch state structure');
{
  const badScore = Object.assign({}, FULL_CTX, { healthIntelligence: { score: '90', status: 'Excellent' } });
  const r = validateContract(badScore, 'health-intelligence');

  assertEqual('state is type_mismatch', r.state, 'type_mismatch');
  assertNotNull('workspace present', r.workspace);
  assertEqual('workspace name', r.workspace, 'health-intelligence');
  assert('typeMismatches is array', Array.isArray(r.typeMismatches));
  assert('typeMismatches has entries', r.typeMismatches && r.typeMismatches.length > 0);
  assert('each entry has field', r.typeMismatches && r.typeMismatches.every(function (m) { return typeof m.field === 'string'; }));
  assert('each entry has expected', r.typeMismatches && r.typeMismatches.every(function (m) { return typeof m.expected === 'string'; }));
  assert('each entry has received', r.typeMismatches && r.typeMismatches.every(function (m) { return typeof m.received === 'string'; }));
  assertNotNull('reason string', r.reason);
}

// ---------------------------------------------------------------------------
// Suite 9: Publishing Intelligence -- MRP absent/present
// ---------------------------------------------------------------------------
console.log('\nSuite 9: Publishing Intelligence -- MRP absent and present');
{
  // MRP absent -- publishingIntelligence alone is sufficient
  const r = validateContract(FULL_CTX, 'publishing-intelligence');
  assertEqual('MRP absent -> valid', r.state, 'valid');
  assertNull('musicRightsProfile is null', FULL_CTX.musicRightsProfile);
  assertNotNull('publishingIntelligence still present', FULL_CTX.publishingIntelligence);

  // MRP present -- still valid
  const withMrp = Object.assign({}, FULL_CTX, {
    musicRightsProfile: { performing_rights: { pro: 'SOCAN', soundexchange: 'Yes' } },
  });
  const r2 = validateContract(withMrp, 'publishing-intelligence');
  assertEqual('MRP present -> valid', r2.state, 'valid');
  assertNotNull('musicRightsProfile populated', withMrp.musicRightsProfile);
  assertEqual('pro value', withMrp.musicRightsProfile.performing_rights.pro, 'SOCAN');
}

// ---------------------------------------------------------------------------
// Suite 10: Monitoring baseline vs second scan
// ---------------------------------------------------------------------------
console.log('\nSuite 10: Monitoring -- baseline vs second scan');
{
  // First scan -- baseline object from mapper
  const firstScan = Object.assign({}, FULL_CTX);
  // monitoringIntelligence already set to baseline in FULL_CTX
  const r = validateContract(firstScan, 'monitoring-timeline');
  assertEqual('first scan -> valid', r.state, 'valid');
  assertEqual('status is baseline', FULL_CTX.monitoringIntelligence.status, 'baseline');
  assertEqual('scanNumber is 1', FULL_CTX.monitoringIntelligence.scanNumber, 1);
  assert('events is empty array', Array.isArray(FULL_CTX.monitoringIntelligence.events) && FULL_CTX.monitoringIntelligence.events.length === 0);
  assert('baselineEstablished', FULL_CTX.monitoringIntelligence.baselineEstablished === true);

  // Second scan -- engine provides real monitoring data
  const secondScan = Object.assign({}, FULL_CTX, {
    monitoringIntelligence: {
      status:              'active',
      scanNumber:          2,
      baselineEstablished: true,
      previousScanId:      'e0aa20ef-5962-4e1c-a6b2-0c02b02aa7f8',
      currentScanId:       'aaaabbbb-cccc-dddd-eeee-ffffffffffff',
      events:              [
        { type: 'MODIFIED', field: 'globalMusicFootprint.territoriesAvailable', was: 155, now: 156, severity: 'LOW' },
      ],
      newThisScan:         1,
      generatedAt:         '2026-07-14T14:00:00Z',
    },
  });
  const r2 = validateContract(secondScan, 'monitoring-timeline');
  assertEqual('second scan -> valid', r2.state, 'valid');
  assertEqual('status is active', secondScan.monitoringIntelligence.status, 'active');
  assertEqual('scanNumber is 2', secondScan.monitoringIntelligence.scanNumber, 2);
  assert('events has one entry', secondScan.monitoringIntelligence.events.length === 1);
  assertEqual('newThisScan', secondScan.monitoringIntelligence.newThisScan, 1);
}

// ---------------------------------------------------------------------------
// Suite 11: Invalid contract name
// ---------------------------------------------------------------------------
console.log('\nSuite 11: Invalid / unknown contract data');
{
  const r = validateContract(FULL_CTX, 'unknown-workspace');
  assertEqual('unknown contract -> invalid', r.state, 'invalid');
  assert('reason mentions contract name', r.reason && r.reason.includes('unknown-workspace'));

  // Context with empty-string subject.artistName (present but fails non-empty-string type)
  const badCtx = Object.assign({}, FULL_CTX, { subject: { artistName: '', recordLabel: 'Label' } });
  const r2 = validateContract(badCtx, 'identity-intelligence');
  assertEqual('empty-string artistName -> type_mismatch', r2.state, 'type_mismatch');
}

// ---------------------------------------------------------------------------
// Suite 12: All 8 contracts pass against fresh Spotify scan context
// ---------------------------------------------------------------------------
console.log('\nSuite 12: All 8 contracts -- fresh Spotify scan e0aa20ef');
{
  // Build the context using the mapper with the fresh scan's canonical shape
  const scanPayload = {
    scanId:   'e0aa20ef-5962-4e1c-a6b2-0c02b02aa7f8',
    scannedAt: '2026-07-14T11:13:20.690Z',
    identityIntelligence:   { providers: { apple: 'VERIFIED', spotify: 'VERIFIED', youtube: 'VERIFIED', deezer: 'VERIFIED', tidal: 'VERIFIED' }, coverage: 100 },
    publishingIntelligence: { coverage: 0, coverageStatus: 'Unavailable', supportedSources: ['mlc'] },
    canonical: {
      subject:              { artistName: 'Black Alternative', recordLabel: 'Castle Park Studioz (GmbH)' },
      cim:                  { identity: { coverage: 100, verifiedProviders: 5, totalProviders: 5, providers: { apple: 'VERIFIED', spotify: 'VERIFIED', youtube: 'VERIFIED', deezer: 'VERIFIED', tidal: 'VERIFIED' }, issues: [] } },
      healthIntelligence:   { score: 90, grade: 'B', status: 'Excellent', identityScore: 100, publishingScore: 50 },
      healthReport:         { grade: 'B', risks: [], strengths: ['Identity fully verified'] },
      healthScore:          { overallScore: 90, overallGrade: 'B', summary: 'Strong Foundation', generatedAt: '2026-07-14T11:13:20Z' },
      catalogIntelligence:  { totalTracks: 4, singles: 4, albums: 0, eps: 0, catalogStatus: 'Stable', isrcCoverage: { status: 'Unknown', percent: null }, bestVerifiedRelease: { releaseTitle: 'Everything Is Over - Single', artistName: 'Black Alternative', releaseType: 'Single', artwork: 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/artwork.jpg' } },
      backendIntelligence:  { services: [{ key: 'musicbrainz', name: 'MusicBrainz', state: 'VERIFIED' }, { key: 'discogs', name: 'Discogs', state: 'NOT_FOUND' }], connectedCount: 1, totalCount: 2 },
      globalMusicFootprint: { status: 'Strong', territoriesAvailable: 156, coveragePercent: 93, reachNarrative: 'Strong global presence.' },
      monitoringIntelligence: null,
      royalteAI:            { executiveInsight: 'Strong backend health.' },
      executiveBrief:       { briefVersion: '1.0.0', generatedAt: '2026-07-14T11:13:21Z', executiveSummary: 'Strong foundation.', healthHeadline: 'Strong Foundation with Minor Gaps', executiveNarrative: 'Infrastructure reflects strong maturity.', topStrengths: [{ id: 'obs-1', label: 'Global presence' }], priorityActions: [] },
      metrics:              { totalFollowers: 500, monthlyListeners: 1200 },
      catalog:              { releases: [] },
    },
  };

  const derivedState = {
    artistName:  'Black Alternative',
    artwork:     'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/artwork/{w}x{h}bb.jpg',
    recordLabel: 'Castle Park Studioz (GmbH)',
  };

  const freshCtx = buildWorkspaceRuntimeContext(scanPayload, null, derivedState);
  assert('schemaVersion 1.1', freshCtx.schemaVersion === '1.1');
  assert('artistName Black Alternative', freshCtx.artistName === 'Black Alternative');
  assert('monitoringIntelligence normalized', freshCtx.monitoringIntelligence !== null);
  assert('mi.status is baseline', freshCtx.monitoringIntelligence.status === 'baseline');
  assert('executiveBrief.headline normalized', freshCtx.executiveBrief !== null && typeof freshCtx.executiveBrief.headline === 'string');

  const contracts = [
    'health-intelligence',
    'identity-intelligence',
    'publishing-intelligence',
    'catalog-intelligence',
    'backend-intelligence',
    'global-music-footprint',
    'monitoring-timeline',
    'ai-insights',
  ];

  contracts.forEach(function (name) {
    const result = validateContract(freshCtx, name);
    assertEqual('  ' + name, result.state, 'valid');
    if (result.state !== 'valid') {
      console.error('    reason:', result.reason);
      if (result.missingDomains) console.error('    missingDomains:', result.missingDomains);
      if (result.missingFields)  console.error('    missingFields:', result.missingFields);
      if (result.typeMismatches) console.error('    typeMismatches:', result.typeMismatches);
    }
  });
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------
console.log('\n----------------------------------------------');
console.log('Workspace Contract Validator -- Certification');
console.log('Passed:', passed, '  Failed:', failed);
console.log('----------------------------------------------\n');

if (failed > 0) process.exit(1);
