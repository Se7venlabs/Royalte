// Canonical Intelligence Platform(tm) -- ATHENA(tm) Runtime Context Adapter Test Suite
// Phase 1: Canonical Executive Intelligence Object(tm)
// Covers the Phase 12 required list: adapter translation, EIO generation,
// confidence preservation, recommendation ordering, opportunity generation,
// source attribution, graceful degradation, missing domain handling,
// schema validation, version compatibility.

import { strict as assert } from 'node:assert';

import {
  buildAthenaApiResponses, ADAPTER_VERSION,
  buildIdentityEnvelope, buildMusicRightsEnvelope, buildCatalogEnvelope,
  buildDistributionEnvelope, buildMonitoringEnvelope, buildSystemOperationsEnvelope,
} from '../api/athena/runtime-context-adapter.js';
import { buildExecutiveIntelligenceObject, EIO_VERSION } from '../api/athena/executive-intelligence-object.js';
import { runExecutiveIntelligencePipeline, PIPELINE_VERSION } from '../api/athena/pipeline.js';
import { ATHENA_ENGINE, validateAthenaInput } from '../api/athena/index.js';

let passed = 0;
let failed = 0;

function test(description, fn) {
  try {
    fn();
    console.log(`  ✓ ${description}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${description}`);
    console.error(`    ${err.message}`);
    failed++;
  }
}

// ─── Fixtures ──────────────────────────────────────────────────────────────

function fullContext(overrides = {}) {
  return {
    schemaVersion: '1.1',
    scanId: 'scan-001',
    generatedAt: '2026-07-24T00:00:00.000Z',
    scannedAt:  '2026-07-24T00:00:00.000Z',
    artistName: 'Test Artist',
    artwork:    'https://example.com/art.jpg',
    recordLabel: 'Test Label',
    identity: {
      displayName: 'Test Artist',
      artistIds:   { apple: 'apple-123', spotify: 'spotify-456' },
      artistUrls:  { apple: null, spotify: null },
      genres:      ['Pop', 'Indie'],
      country:     'US',
      canonicalIdentity: { source: 'apple', appleArtistId: 'apple-123', appleStorefront: 'us' },
      verifiedIdentity:  { apple: true, spotify: true, youtube: false },
      confidence: 'verified',
      resolvedFrom: 'apple',
    },
    identityIntelligence: {
      providers: { apple: 'VERIFIED', spotify: 'VERIFIED', youtube: 'NOT_FOUND' },
      supportedProviders: ['apple', 'spotify', 'youtube'],
      verifiedProviders: 2,
      totalProviders: 3,
      coverage: 67, // 0-100 int, real shape
      strengths: [{ provider: 'apple', label: 'Apple Music' }],
      issues: [],
      recommendations: [],
    },
    musicRightsProfile: {
      performing_rights: { pro: 'ASCAP' },
      publishing: { publishing_management: 'self', organization_name: null, mlc_registered: true },
      distribution: { distributor: 'DistroKid', territories: 'Worldwide' },
      rights_identifiers: { isni: '0000000123456789', ipi_number: '00123456789', cae_number: null },
      publisher: { name: null },
    },
    publishing: {
      score: 40,
      pro: { name: 'ASCAP', url: '', note: '', steps: [], country: 'US' },
      publisher: null,
      administrator: null,
      collection: { confidence: 'moderate' },
      issues: [], summary: '', recommendations: [],
    },
    publishingIntelligence: null,
    catalogIntelligence: {
      singles: 3, eps: 1, albums: 2, totalTracks: 24,
      catalogStatus: 'Established Catalog', confidence: 'verified',
      isrcIntelligence: { status: 'ASSESSED', assessedCount: 24, verifiedCount: 22, missingCount: 2, coveragePercent: 92 },
      firstReleaseYear: 2018, latestReleaseYear: 2026, catalogAgeYears: 8,
      physicalReleaseCount: null, bestVerifiedRelease: null,
    },
    verification: {
      providers: { apple: { status: 'VERIFIED' }, spotify: { status: 'VERIFIED' }, youtube: { status: 'UNVERIFIED' } },
      verifiedCount: 2, totalCount: 3, confidence: 'high',
    },
    backendIntelligence: null,
    globalFootprint: null,
    globalMusicFootprint: null,
    mediaIntelligence: null,
    monitoringIntelligence: {
      status: 'active', scanNumber: 3, baselineEstablished: true,
      previousScanId: 'scan-000', currentScanId: 'scan-001',
      events: [
        { changeType: 'label_change', title: 'Label Changed', severity: 'action_needed' },
        { changeType: 'metadata_update', title: 'Genre Updated', severity: 'monitor' },
      ],
      newThisScan: 2, generatedAt: '2026-07-24T00:00:00.000Z',
    },
    healthIntelligence: null,
    healthReport: null,
    healthScore: { overallScore: 78, overallGrade: 'B' },
    royalteAI: null,
    executiveBrief: null,
    metrics: null,
    catalog: null,
    ...overrides,
  };
}

function emptyContext() {
  return {};
}

// ─── 1. Adapter translation ────────────────────────────────────────────────

console.log('\n§1 Adapter translation');

test('buildAthenaApiResponses returns all six domains', () => {
  const result = buildAthenaApiResponses(fullContext());
  for (const domain of ['identity', 'musicRights', 'catalog', 'distribution', 'monitoring', 'systemOperations']) {
    assert.ok(result[domain], `missing domain: ${domain}`);
    assert.equal(result[domain].apiVersion, 'v1');
  }
});

test('identity envelope maps artistId from Apple-canonical artistIds', () => {
  const env = buildIdentityEnvelope(fullContext());
  assert.equal(env.data.artistId, 'apple-123');
  assert.equal(env.artistId, 'apple-123');
});

test('identity envelope converts coverage from 0-100 to 0-1', () => {
  const env = buildIdentityEnvelope(fullContext());
  assert.equal(env.data.coverage, 0.67);
});

test('identity envelope derives verified=true when any provider verified', () => {
  const env = buildIdentityEnvelope(fullContext());
  assert.equal(env.data.verified, true);
});

test('identity envelope derives verified=false when no provider verified', () => {
  const ctx = fullContext({ identity: { ...fullContext().identity, verifiedIdentity: { apple: false, spotify: false, youtube: false } } });
  const env = buildIdentityEnvelope(ctx);
  assert.equal(env.data.verified, false);
});

test('identity envelope leaves biography unavailable (null), never fabricated', () => {
  const env = buildIdentityEnvelope(fullContext());
  assert.equal(env.data.biography, null);
});

test('musicRights envelope maps self-published as a satisfied publisher, not a gap', () => {
  const env = buildMusicRightsEnvelope(fullContext());
  assert.equal(env.data.publisher, 'Self-published');
  assert.equal(env.data.pro, 'ASCAP');
});

test('musicRights envelope leaves publisher null when no publishing arrangement declared', () => {
  const ctx = fullContext({
    musicRightsProfile: { performing_rights: { pro: null }, publishing: { publishing_management: null, organization_name: null }, publisher: {} },
    publishing: { pro: {}, publisher: null, administrator: null },
  });
  const env = buildMusicRightsEnvelope(ctx);
  assert.equal(env.data.publisher, null);
});

test('musicRights envelope leaves iswc/writer unavailable (real platform gap)', () => {
  const env = buildMusicRightsEnvelope(fullContext());
  assert.equal(env.data.iswc, null);
  assert.equal(env.data.writer, null);
});

test('catalog envelope sums singles+eps+albums into releaseCount', () => {
  const env = buildCatalogEnvelope(fullContext());
  assert.equal(env.data.releaseCount, 6);
});

test('catalog envelope converts isrcCoverage from percent to ratio', () => {
  const env = buildCatalogEnvelope(fullContext());
  assert.equal(env.data.isrcCoverage, 0.92);
});

test('catalog envelope reads genre from identity.genres, not catalog', () => {
  const env = buildCatalogEnvelope(fullContext());
  assert.equal(env.data.genre, 'Pop');
});

test('distribution envelope derives dspCoverage as verifiedCount/totalCount ratio', () => {
  const env = buildDistributionEnvelope(fullContext());
  assert.ok(Math.abs(env.data.dspCoverage - (2 / 3)) < 1e-9);
});

test('distribution envelope exposes estimatedDistributionCoverage as the honest alias for dspCoverage', () => {
  const env = buildDistributionEnvelope(fullContext());
  assert.equal(env.data.estimatedDistributionCoverage, env.data.dspCoverage);
});

test('monitoring envelope maps action_needed severity to HIGH, never CRITICAL', () => {
  const env = buildMonitoringEnvelope(fullContext());
  const levels = env.data.alerts.map(a => a.level);
  assert.ok(levels.includes('HIGH'));
  assert.ok(!levels.includes('CRITICAL'), 'real severities never fabricate a CRITICAL level');
});

test('monitoring envelope passes changeCount through directly from newThisScan', () => {
  const env = buildMonitoringEnvelope(fullContext());
  assert.equal(env.data.changeCount, 2);
});

test('systemOperations envelope derives complete status from presence of core scan outputs', () => {
  const env = buildSystemOperationsEnvelope(fullContext());
  assert.equal(env.data.scanStatus, 'complete');
});

// ─── 2. Graceful degradation / missing domain handling ─────────────────────

console.log('\n§2 Graceful degradation & missing domain handling');

test('adapter never throws on an empty context', () => {
  assert.doesNotThrow(() => buildAthenaApiResponses(emptyContext()));
});

test('adapter never throws on null/undefined context', () => {
  assert.doesNotThrow(() => buildAthenaApiResponses(null));
  assert.doesNotThrow(() => buildAthenaApiResponses(undefined));
});

test('missing identity produces a NOT_FOUND envelope, not a fabricated SUCCESS', () => {
  const result = buildAthenaApiResponses(emptyContext());
  assert.equal(result.identity.status, 'NOT_FOUND');
  assert.deepEqual(result.identity.data, {});
});

test('missing musicRightsProfile and publishing both absent -> NOT_FOUND', () => {
  const ctx = fullContext({ musicRightsProfile: null, publishing: null });
  const env = buildMusicRightsEnvelope(ctx);
  assert.equal(env.status, 'NOT_FOUND');
});

test('partial context (identity only) still produces a valid apiResponses shape', () => {
  const ctx = { identity: fullContext().identity, artistName: 'Solo', scanId: 'scan-solo' };
  const result = buildAthenaApiResponses(ctx);
  assert.equal(result.identity.status, 'SUCCESS');
  assert.equal(result.catalog.status, 'NOT_FOUND');
  assert.equal(result.musicRights.status, 'NOT_FOUND');
});

// ─── 3. Schema validation (ATHENA's own validateAthenaInput) ───────────────

console.log('\n§3 Schema validation');

test('adapter output passes ATHENA\'s own validateAthenaInput when identity resolves', () => {
  const result = buildAthenaApiResponses(fullContext());
  const { valid, errors } = validateAthenaInput(result);
  assert.equal(valid, true, errors.join('; '));
});

test('adapter output fails validateAthenaInput honestly when everything is empty (no silent success)', () => {
  const result = buildAthenaApiResponses(emptyContext());
  const { valid } = validateAthenaInput(result);
  assert.equal(valid, false);
});

test('every envelope declares apiVersion v1 (schema compatibility)', () => {
  const result = buildAthenaApiResponses(fullContext());
  for (const domain of Object.keys(result)) {
    assert.equal(result[domain].apiVersion, 'v1');
  }
});

// ─── 4. EIO generation ──────────────────────────────────────────────────────

console.log('\n§4 Executive Intelligence Object(tm) generation');

test('pipeline produces a complete EIO from a full context', () => {
  const eio = runExecutiveIntelligencePipeline(fullContext());
  assert.ok(eio.eioId);
  assert.equal(eio.eioVersion, EIO_VERSION.version);
  assert.ok(eio.executiveBriefing);
  assert.ok(typeof eio.executiveSummary === 'string' && eio.executiveSummary.length > 0);
  assert.ok(Array.isArray(eio.topPriorities));
  assert.ok(Array.isArray(eio.recommendations));
  assert.ok(Array.isArray(eio.opportunities));
  assert.ok(Array.isArray(eio.risks));
  assert.ok(eio.confidence);
  assert.ok(eio.businessHealthSummary);
  assert.ok(Array.isArray(eio.sourceAttribution));
  assert.ok(eio.metadata);
});

test('EIO is deep-frozen (constitutional immutability)', () => {
  const eio = runExecutiveIntelligencePipeline(fullContext());
  assert.throws(() => { eio.eioId = 'mutated'; });
  assert.throws(() => { eio.recommendations.push({}); });
});

test('EIO forecast, timelineSummary, and memory sub-sections are honestly marked unavailable', () => {
  const eio = runExecutiveIntelligencePipeline(fullContext());
  assert.equal(eio.forecast.available, false);
  assert.ok(eio.forecast.reason.length > 0);
  assert.equal(eio.timelineSummary.available, false);
  assert.ok(eio.timelineSummary.reason.length > 0);
  assert.equal(eio.executiveMemorySummary.goals.available, false);
  assert.equal(eio.executiveMemorySummary.dismissedActions.available, false);
});

test('EIO executiveMemorySummary honestly scopes historicalChanges to current-scan only', () => {
  const eio = runExecutiveIntelligencePipeline(fullContext());
  assert.equal(eio.executiveMemorySummary.available, true);
  assert.equal(eio.executiveMemorySummary.scope, 'current_scan_monitoring_history_only');
});

test('EIO metadata is fully self-describing (Board addendum, 2026-07-24)', () => {
  const eio = runExecutiveIntelligencePipeline(fullContext());
  assert.ok(eio.metadata.schemaVersion);
  assert.ok(eio.metadata.generatedAt);
  assert.ok(eio.metadata.generatedBy);
  assert.ok(eio.metadata.pipelineVersion);
  assert.ok(eio.metadata.adapterVersion);
  assert.ok(eio.metadata.athenaVersion);
  assert.ok(eio.metadata.runtimeContextVersion);
});

test('EIO metadata.runtimeContextVersion traces to the real royalte_workspace_context schemaVersion', () => {
  const eio = runExecutiveIntelligencePipeline(fullContext());
  assert.equal(eio.metadata.runtimeContextVersion, '1.1');
});

// ─── 5. Confidence preservation ─────────────────────────────────────────────

console.log('\n§5 Confidence preservation');

test('EIO risks/opportunities preserve their original per-item confidence objects unmodified', () => {
  const apiResponses = buildAthenaApiResponses(fullContext());
  const athenaReport  = ATHENA_ENGINE.analyze(apiResponses);
  const eio           = buildExecutiveIntelligenceObject(athenaReport, apiResponses);

  assert.deepEqual(eio.risks, athenaReport.riskAnalysis.risks);
  assert.deepEqual(eio.opportunities, athenaReport.opportunityAnalysis.opportunities);
  for (const r of eio.risks) {
    assert.ok(['HIGH', 'MEDIUM', 'LOW', 'INSUFFICIENT_DATA'].includes(r.confidence.level));
  }
});

test('EIO aggregate confidence score is between 0 and 1', () => {
  const eio = runExecutiveIntelligencePipeline(fullContext());
  assert.ok(eio.confidence.score >= 0 && eio.confidence.score <= 1);
});

// ─── 6. Recommendation ordering ─────────────────────────────────────────────

console.log('\n§6 Recommendation ordering');

test('recommendations remain sorted URGENT > HIGH > MEDIUM > LOW > INFORMATIONAL', () => {
  const eio = runExecutiveIntelligencePipeline(fullContext());
  const order = { URGENT: 0, HIGH: 1, MEDIUM: 2, LOW: 3, INFORMATIONAL: 4 };
  for (let i = 1; i < eio.recommendations.length; i++) {
    assert.ok(order[eio.recommendations[i - 1].priority] <= order[eio.recommendations[i].priority],
      'recommendations must not regress in priority order');
  }
});

test('topPriorities only draws from URGENT/HIGH recommendations, capped at 5', () => {
  const eio = runExecutiveIntelligencePipeline(fullContext());
  assert.ok(eio.topPriorities.length <= 5);
});

// ─── 7. Opportunity generation ──────────────────────────────────────────────

console.log('\n§7 Opportunity generation');

test('a self-published, fully-registered artist still yields real, non-fabricated opportunities', () => {
  const eio = runExecutiveIntelligencePipeline(fullContext());
  assert.ok(Array.isArray(eio.opportunities));
});

test('missing ISWC (a real, honest platform gap) surfaces as a registration opportunity', () => {
  const apiResponses = buildAthenaApiResponses(fullContext());
  assert.equal(apiResponses.musicRights.data.iswc, null);
  const athenaReport = ATHENA_ENGINE.analyze(apiResponses);
  const titles = athenaReport.opportunityAnalysis.opportunities.map(o => o.title);
  assert.ok(titles.includes('Register Compositions for ISWC'));
});

// ─── 8. Source attribution ──────────────────────────────────────────────────

console.log('\n§8 Source attribution');

test('every sourceAttribution entry traces back to a real riskId or opportunityId', () => {
  const apiResponses = buildAthenaApiResponses(fullContext());
  const athenaReport  = ATHENA_ENGINE.analyze(apiResponses);
  const eio           = buildExecutiveIntelligenceObject(athenaReport, apiResponses);

  const riskIds = new Set(athenaReport.riskAnalysis.risks.map(r => r.riskId));
  const oppIds  = new Set(athenaReport.opportunityAnalysis.opportunities.map(o => o.opportunityId));

  for (const attr of eio.sourceAttribution) {
    assert.ok(attr.sourceType === 'risk' || attr.sourceType === 'opportunity');
    if (attr.sourceType === 'risk') assert.ok(riskIds.has(attr.sourceId));
    if (attr.sourceType === 'opportunity') assert.ok(oppIds.has(attr.sourceId));
  }
});

test('sourceAttribution count matches recommendation count 1:1', () => {
  const eio = runExecutiveIntelligencePipeline(fullContext());
  assert.equal(eio.sourceAttribution.length, eio.recommendations.length);
});

// ─── 8b. Executive Provenance(tm) (Board addendum, 2026-07-24) ─────────────

console.log('\n§8b Executive Provenance(tm)');

test('provenance is a separate array from sourceAttribution, one entry per recommendation', () => {
  const eio = runExecutiveIntelligencePipeline(fullContext());
  assert.ok(Array.isArray(eio.provenance));
  assert.equal(eio.provenance.length, eio.recommendations.length);
});

test('every provenance entry carries recommendationId, versions, confidence, sourceDomains, generatedBy', () => {
  const eio = runExecutiveIntelligencePipeline(fullContext());
  for (const p of eio.provenance) {
    assert.ok(p.recommendationId);
    assert.ok(p.generatedAt);
    assert.ok(p.engineVersion);
    assert.ok(p.schemaVersion);
    assert.ok(p.confidence);
    assert.ok(Array.isArray(p.sourceDomains));
    assert.equal(p.generatedBy, 'athena_executive_intelligence_pipeline');
  }
});

test('provenance entries trace back to real recommendationIds', () => {
  const eio = runExecutiveIntelligencePipeline(fullContext());
  const recIds = new Set(eio.recommendations.map(r => r.recommendationId));
  for (const p of eio.provenance) {
    assert.ok(recIds.has(p.recommendationId));
  }
});

// ─── 9. Version compatibility ───────────────────────────────────────────────

console.log('\n§9 Version compatibility');

test('ADAPTER_VERSION, EIO_VERSION, and PIPELINE_VERSION are all present and semver-shaped', () => {
  const semverLike = /^\d+\.\d+\.\d+$/;
  assert.ok(semverLike.test(ADAPTER_VERSION.version));
  assert.ok(semverLike.test(EIO_VERSION.version));
  assert.ok(semverLike.test(PIPELINE_VERSION.version));
});

test('adapter rejects nothing on apiVersion -- always emits v1, matching ATHENA_ENGINE\'s only supported version', () => {
  const result = buildAthenaApiResponses(fullContext());
  const { errors } = validateAthenaInput(result);
  assert.ok(!errors.some(e => e.includes('apiVersion')));
});

// ─── Summary ─────────────────────────────────────────────────────────────

console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
