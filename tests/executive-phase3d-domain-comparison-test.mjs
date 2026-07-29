// ATHENA™ Phase 3D — Cross-Scan Intelligence™ test suite. Pure-logic unit
// tests against fixture audit_scans.payload objects and archive rows — no
// real database. Matches the house pattern in
// tests/executive-phase3b-services-test.mjs.

import { strict as assert } from 'node:assert';
import { compareDomain, COMPARISON_STATES, DOMAIN_FINGERPRINTS } from '../api/_lib/canonical-domain-fingerprints.js';
import { compareExecutiveBriefs } from '../api/_lib/executive-comparison.js';
import { detectDomainTrends } from '../api/_lib/executive-trend-detection.js';

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

function makePayload(overrides = {}) {
  const base = {
    schemaVersion: '1.1',
    cim: {
      identity:   { verifiedProviders: 3, totalProviders: 5, coverage: 60 },
      publishing: { registeredCount: 2, totalChecked: 6, coverage: 33 },
      verification: { connectedCount: 1, totalCount: 2 },
      globalFootprint: { territoriesAvailable: 100, territoriesUnavailable: 67, coveragePercent: 60 },
      media: { available: true, platformCoverage: { coveredCount: 1, totalPlatforms: 3, coveragePercent: 33 }, catalogMediaSupport: { unsupportedReleases: [{ id: 'a' }] } },
    },
    catalogIntelligence: { totalTracks: 24, isrcIntelligence: { coveragePercent: 80 } },
    healthIntelligence: { score: 62, status: 'Moderate' },
    monitoringIntelligence: { status: 'active', events: [] },
  };
  return { ...base, ...overrides };
}

// ─── Per-domain fingerprint + compare ───────────────────────────────────

console.log('\n§1 Canonical Domain Fingerprints™ — per-domain compare');

test('identity: higher coverage is IMPROVED', () => {
  const before = makePayload();
  const after = makePayload({ cim: { ...before.cim, identity: { verifiedProviders: 5, totalProviders: 5, coverage: 100 } } });
  const result = compareDomain('identity', before, after);
  assert.equal(result.state, COMPARISON_STATES.IMPROVED);
  assert.equal(result.delta, 40);
});

test('publishing: lower coverage is DECLINED', () => {
  const before = makePayload();
  const after = makePayload({ cim: { ...before.cim, publishing: { registeredCount: 0, totalChecked: 6, coverage: 0 } } });
  const result = compareDomain('publishing', before, after);
  assert.equal(result.state, COMPARISON_STATES.DECLINED);
});

test('catalog: falls back to track-count growth when ISRC coverage unavailable in either scan', () => {
  const before = makePayload({ catalogIntelligence: { totalTracks: 20, isrcIntelligence: null } });
  const after = makePayload({ catalogIntelligence: { totalTracks: 24, isrcIntelligence: { coveragePercent: 80 } } });
  const result = compareDomain('catalog', before, after);
  assert.equal(result.state, COMPARISON_STATES.IMPROVED);
  assert.equal(result.delta, 4);
});

test('catalog: compares real ISRC coverage when available in both scans', () => {
  const before = makePayload({ catalogIntelligence: { totalTracks: 24, isrcIntelligence: { coveragePercent: 50 } } });
  const after = makePayload({ catalogIntelligence: { totalTracks: 24, isrcIntelligence: { coveragePercent: 80 } } });
  const result = compareDomain('catalog', before, after);
  assert.equal(result.state, COMPARISON_STATES.IMPROVED);
  assert.equal(result.delta, 30);
});

test('health: unchanged score is UNCHANGED', () => {
  const before = makePayload({ healthIntelligence: { score: 62, status: 'Moderate' } });
  const after = makePayload({ healthIntelligence: { score: 62, status: 'Moderate' } });
  const result = compareDomain('health', before, after);
  assert.equal(result.state, COMPARISON_STATES.UNCHANGED);
  assert.equal(result.delta, 0);
});

test('backend: all gaps closing from a real gap is RESOLVED, not just IMPROVED', () => {
  const before = makePayload({ cim: { ...makePayload().cim, verification: { connectedCount: 1, totalCount: 2 } } });
  const after = makePayload({ cim: { ...makePayload().cim, verification: { connectedCount: 2, totalCount: 2 } } });
  const result = compareDomain('backend', before, after);
  assert.equal(result.state, COMPARISON_STATES.RESOLVED);
});

test('media: unsupported releases dropping to zero is RESOLVED', () => {
  const before = makePayload({ cim: { ...makePayload().cim, media: { available: true, platformCoverage: { coveragePercent: 33 }, catalogMediaSupport: { unsupportedReleases: [{ id: 'a' }] } } } });
  const after = makePayload({ cim: { ...makePayload().cim, media: { available: true, platformCoverage: { coveragePercent: 33 }, catalogMediaSupport: { unsupportedReleases: [] } } } });
  const result = compareDomain('media', before, after);
  assert.equal(result.state, COMPARISON_STATES.RESOLVED);
});

test('media: unavailable in one scan is INSUFFICIENT_EVIDENCE, never fabricated as UNCHANGED', () => {
  const before = makePayload({ cim: { ...makePayload().cim, media: { available: false } } });
  const after = makePayload();
  const result = compareDomain('media', before, after);
  assert.equal(result.state, COMPARISON_STATES.INSUFFICIENT_EVIDENCE);
  assert.equal(result.delta, null);
});

test('footprint: all missing markets resolving is RESOLVED', () => {
  const before = makePayload({ cim: { ...makePayload().cim, globalFootprint: { territoriesAvailable: 100, territoriesUnavailable: 67, coveragePercent: 60 } } });
  const after = makePayload({ cim: { ...makePayload().cim, globalFootprint: { territoriesAvailable: 167, territoriesUnavailable: 0, coveragePercent: 100 } } });
  const result = compareDomain('footprint', before, after);
  assert.equal(result.state, COMPARISON_STATES.RESOLVED);
});

test('monitoring: zero action-needed events appearing is NEWLY_DETECTED, not silently UNCHANGED', () => {
  const before = makePayload({ monitoringIntelligence: { status: 'active', events: [] } });
  const after = makePayload({ monitoringIntelligence: { status: 'active', events: [{ severity: 'action_needed' }] } });
  const result = compareDomain('monitoring', before, after);
  assert.equal(result.state, COMPARISON_STATES.NEWLY_DETECTED);
});

test('monitoring: all action-needed events resolving is RESOLVED', () => {
  const before = makePayload({ monitoringIntelligence: { status: 'active', events: [{ severity: 'action_needed' }] } });
  const after = makePayload({ monitoringIntelligence: { status: 'active', events: [] } });
  const result = compareDomain('monitoring', before, after);
  assert.equal(result.state, COMPARISON_STATES.RESOLVED);
});

test('schema mismatch forces NOT_COMPARABLE regardless of underlying data', () => {
  const before = makePayload();
  const after = makePayload({ cim: { ...before.cim, identity: { verifiedProviders: 5, totalProviders: 5, coverage: 100 } } });
  const result = compareDomain('identity', before, after, { schemaCompatible: false });
  assert.equal(result.state, COMPARISON_STATES.NOT_COMPARABLE);
});

test('an undefined domain key returns UNKNOWN, never throws', () => {
  const result = compareDomain('not_a_real_domain', makePayload(), makePayload());
  assert.equal(result.state, COMPARISON_STATES.UNKNOWN);
});

test('DOMAIN_FINGERPRINTS covers exactly the 8 payload-sourced domains (AI Insights/Executive Overview handled separately)', () => {
  assert.deepEqual(Object.keys(DOMAIN_FINGERPRINTS).sort(), ['backend', 'catalog', 'footprint', 'health', 'identity', 'media', 'monitoring', 'publishing']);
});

// ─── compareExecutiveBriefs integration ─────────────────────────────────

console.log('\n§2 compareExecutiveBriefs — canonicalDomains integration');

function makeArchiveRow(overrides = {}) {
  return {
    executive_brief_id: 'EB-1', generated_at: '2026-07-01T00:00:00.000Z',
    scan_id: 'scan-1', critical_issue_count: 0, risk_count: 2, opportunity_count: 1,
    executive_intelligence_object: { executiveBriefing: { overallLevel: 'STABLE', riskLevel: 'MEDIUM' }, risks: [], opportunities: [] },
    ...overrides,
  };
}

test('omitting scanPayloads leaves canonicalDomains null — fully backward compatible', () => {
  const cmp = compareExecutiveBriefs(makeArchiveRow(), makeArchiveRow({ executive_brief_id: 'EB-2' }));
  assert.equal(cmp.canonicalDomains, null);
  assert.ok(Array.isArray(cmp.domains)); // original risk/opportunity-count field untouched
});

test('supplying scanPayloads produces all 10 canonical domains including aiInsights and executiveOverview', () => {
  const before = makeArchiveRow({ risk_count: 4, opportunity_count: 1, executive_intelligence_object: { executiveBriefing: { overallLevel: 'AT_RISK', riskLevel: 'HIGH' }, risks: [], opportunities: [] } });
  const after = makeArchiveRow({ executive_brief_id: 'EB-2', risk_count: 1, opportunity_count: 2, executive_intelligence_object: { executiveBriefing: { overallLevel: 'STRONG', riskLevel: 'LOW' }, risks: [], opportunities: [] } });
  const cmp = compareExecutiveBriefs(before, after, {
    scanPayloads: {
      before: { payload: makePayload(), schemaVersion: '1.1' },
      after: { payload: makePayload({ cim: { ...makePayload().cim, identity: { verifiedProviders: 5, totalProviders: 5, coverage: 100 } } }), schemaVersion: '1.1' },
    },
  });
  assert.equal(cmp.canonicalDomains.length, 10);
  const byDomain = Object.fromEntries(cmp.canonicalDomains.map(d => [d.domain, d]));
  assert.equal(byDomain.identity.state, COMPARISON_STATES.IMPROVED);
  assert.equal(byDomain.aiInsights.state, COMPARISON_STATES.IMPROVED); // HIGH -> LOW risk
  assert.equal(byDomain.executiveOverview.state, COMPARISON_STATES.IMPROVED); // AT_RISK -> STRONG
  assert.ok(byDomain.identity.label.includes('Identity'));
});

test('schema version mismatch between the two real scans propagates NOT_COMPARABLE into canonicalDomains', () => {
  const cmp = compareExecutiveBriefs(makeArchiveRow(), makeArchiveRow({ executive_brief_id: 'EB-2' }), {
    scanPayloads: {
      before: { payload: makePayload(), schemaVersion: '1.0' },
      after: { payload: makePayload(), schemaVersion: '1.1' },
    },
  });
  const identity = cmp.canonicalDomains.find(d => d.domain === 'identity');
  assert.equal(identity.state, COMPARISON_STATES.NOT_COMPARABLE);
});

// ─── detectDomainTrends integration ─────────────────────────────────────

console.log('\n§3 detectDomainTrends — canonicalDomains integration');

test('detectDomainTrends canonicalDomains is null with fewer than 2 briefs or no scanPayloads', () => {
  const single = detectDomainTrends([makeArchiveRow()]);
  assert.equal(single.canonicalDomains, null);

  const two = detectDomainTrends([makeArchiveRow(), makeArchiveRow({ executive_brief_id: 'EB-2' })]);
  assert.equal(two.canonicalDomains, null); // no scanPayloads supplied
});

test('detectDomainTrends canonicalDomains reflects first-vs-last endpoint comparison, same methodology as the existing risk-count domains', () => {
  const first = makeArchiveRow({ generated_at: '2026-01-01T00:00:00.000Z' });
  const last = makeArchiveRow({ executive_brief_id: 'EB-2', generated_at: '2026-07-01T00:00:00.000Z' });
  const trends = detectDomainTrends([first, last], {
    scanPayloads: {
      first: { payload: makePayload({ cim: { ...makePayload().cim, verification: { connectedCount: 0, totalCount: 2 } } }), schemaVersion: '1.1' },
      last: { payload: makePayload({ cim: { ...makePayload().cim, verification: { connectedCount: 2, totalCount: 2 } } }), schemaVersion: '1.1' },
    },
  });
  const backend = trends.canonicalDomains.find(d => d.domain === 'backend');
  assert.equal(backend.state, COMPARISON_STATES.RESOLVED);
});

// ─── Summary ─────────────────────────────────────────────────────────────

console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
