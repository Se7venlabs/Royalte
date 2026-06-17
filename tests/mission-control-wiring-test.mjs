// ─────────────────────────────────────────────────────────────────────
//  Royaltē Mission Control™ — wiring test (Phase 4B-3)
// ─────────────────────────────────────────────────────────────────────
//
//  Verifies the PURE renderers in public/js/mission-control-renderers.js
//  that translate Identity Intelligence™ → DOM-render plans.
//
//  These tests guarantee Mission Control's compliance with the
//  Stage 4B-3 Board directive:
//
//    - Mission Control renders intelligence; never computes it.
//    - Mission Control iterates supportedProviders (Board R7 + R8).
//    - Mission Control renders the four locked states only:
//        VERIFIED · ACTION_REQUIRED · NOT_FOUND · UNABLE_TO_CONFIRM
//    - Amazon Music is intentionally absent from every render plan
//      (Board R1 + R2 + R3 + Constitutional Rule R4).
//    - Coverage is rendered as informational provider coverage; never
//      labeled as Score / Health / Rating.
//    - Failure-mode contract: malformed inputs produce safe defaults,
//      never throw, never label anything as a Score.
// ─────────────────────────────────────────────────────────────────────

import { strict as assert } from 'node:assert';

import {
  buildProviderRenderPlan,
  buildCoveragePlan,
  buildRecommendationsPlan,
  safeIdentityIntelligence,
  PROVIDER_LABELS,
  STATE_PILL_CLASS,
  STATE_PILL_TEXT,
} from '../public/js/mission-control-renderers.js';

import { assembleCio } from '../api/_lib/cio-assembler.js';
import { runIntelligenceEngine } from '../api/_lib/intelligence-engine.js';
import { ALL_RULES } from '../api/rules/index.js';
import { assembleIdentityIntelligence } from '../api/_lib/identity-intelligence.js';

// ─── Helpers ──────────────────────────────────────────────────────

function makeIntelligence(overrides = {}) {
  // Synthesise a full Identity Intelligence™ object via the same chain
  // /api/audit uses at scan time. This guarantees the test exercises
  // the EXACT shape Mission Control will see in production.
  const canonical = {
    scanId:    'test',
    scannedAt: '2026-06-17T00:00:00.000Z',
    source:    { platform: 'apple_music', urlType: 'artist', storefront: 'us' },
    subject:   { artistName: 'Test Artist', artistId: 'apple_999' },
    platforms: overrides.platforms || {
      appleMusic: { availability: 'VERIFIED', details: { artwork: 'https://x/a.jpg' } },
      spotify:    { availability: 'VERIFIED', details: null },
      youtube:    { availability: 'VERIFIED', details: { officialChannel: { channelId: 'UC' }, contentIdVerified: true } },
    },
  };
  const cio    = assembleCio(canonical.subject.artistName, { scanPayload: canonical });
  const report = runIntelligenceEngine(cio, ALL_RULES);
  return assembleIdentityIntelligence(report, cio);
}

let passed = 0;
function test(name, fn) {
  try {
    fn();
    passed += 1;
    console.log(`  ✓  ${name}`);
  } catch (e) {
    console.error(`  ✗  ${name}`);
    console.error(`     ${e?.message || e}`);
    process.exit(1);
  }
}

// ═════════════════════════════════════════════════════════════════════
//  1–4 — Constants are correct + frozen.
// ═════════════════════════════════════════════════════════════════════

test('1. PROVIDER_LABELS is frozen and covers the canonical Phase-3 set only', () => {
  assert.ok(Object.isFrozen(PROVIDER_LABELS));
  assert.deepStrictEqual(Object.keys(PROVIDER_LABELS).sort(), ['apple', 'spotify', 'youtube']);
});

test('2. STATE_PILL_CLASS covers all four locked states (Board D4)', () => {
  assert.ok(Object.isFrozen(STATE_PILL_CLASS));
  assert.deepStrictEqual(Object.keys(STATE_PILL_CLASS).sort(),
    ['ACTION_REQUIRED', 'NOT_FOUND', 'UNABLE_TO_CONFIRM', 'VERIFIED']);
});

test('3. STATE_PILL_TEXT covers all four locked states (Board D4)', () => {
  assert.ok(Object.isFrozen(STATE_PILL_TEXT));
  assert.deepStrictEqual(Object.keys(STATE_PILL_TEXT).sort(),
    ['ACTION_REQUIRED', 'NOT_FOUND', 'UNABLE_TO_CONFIRM', 'VERIFIED']);
});

test('4. UNABLE_TO_CONFIRM pill class is NOT the same as NOT_FOUND pill class', () => {
  // Constitutional rule (Board R, 2026-06-17): UNABLE_TO_CONFIRM must
  // never be visually equivalent to NOT_FOUND. Different rgba treatment
  // signals "we could not look" vs "we looked and found nothing."
  assert.notEqual(STATE_PILL_CLASS.UNABLE_TO_CONFIRM, STATE_PILL_CLASS.NOT_FOUND);
});

// ═════════════════════════════════════════════════════════════════════
//  5–8 — Provider render plan iterates supportedProviders (R7 + R8).
// ═════════════════════════════════════════════════════════════════════

test('5. buildProviderRenderPlan — iterates supportedProviders in canonical order', () => {
  const ii = makeIntelligence();
  const plan = buildProviderRenderPlan(ii);
  assert.equal(plan.length, ii.supportedProviders.length,
    'plan length must equal supportedProviders.length — no fixed assumption (Board R8)');
  assert.deepStrictEqual(plan.map((p) => p.provider), Array.from(ii.supportedProviders));
});

test('6. buildProviderRenderPlan — each entry carries state + pillClass + pillText derived from the locked state', () => {
  const ii = makeIntelligence();
  const plan = buildProviderRenderPlan(ii);
  for (const entry of plan) {
    assert.ok(['VERIFIED', 'ACTION_REQUIRED', 'NOT_FOUND', 'UNABLE_TO_CONFIRM'].includes(entry.state),
      `state must be one of the four locked values; got "${entry.state}"`);
    assert.equal(entry.pillClass, STATE_PILL_CLASS[entry.state]);
    assert.equal(entry.pillText,  STATE_PILL_TEXT[entry.state]);
  }
});

test('7. buildProviderRenderPlan — Amazon Music is NOT in the plan (R1 + R2 + R3 + R4)', () => {
  const ii = makeIntelligence();
  const plan = buildProviderRenderPlan(ii);
  for (const entry of plan) {
    assert.notEqual(entry.provider, 'amazon',
      'Amazon must never appear in the provider render plan until a first-class adapter exists');
    assert.notEqual(entry.provider, 'amazonMusic');
  }
});

test('8. buildProviderRenderPlan — dynamic count: synthesise an intelligence with 4 supportedProviders and confirm 4 entries', () => {
  // The Board principle is "never assume 3 or 4." Verify the plan
  // length tracks supportedProviders.length even for a hypothetical
  // future provider list. We can't really add a 4th provider without
  // building an adapter, but we can verify the iteration logic works
  // against a synthesised intelligence object directly.
  const synthetic = {
    providers: { apple: 'VERIFIED', spotify: 'VERIFIED', youtube: 'VERIFIED', amazon: 'VERIFIED' },
    supportedProviders: Object.freeze(['apple', 'spotify', 'youtube', 'amazon']),
    verifiedProviders: 4, totalProviders: 4, coverage: 100,
    strengths: [], issues: [], recommendations: [],
  };
  const plan = buildProviderRenderPlan(synthetic);
  assert.equal(plan.length, 4,
    'render plan must grow with supportedProviders (Board R8)');
  assert.deepStrictEqual(plan.map((p) => p.provider), ['apple', 'spotify', 'youtube', 'amazon']);
});

// ═════════════════════════════════════════════════════════════════════
//  9–13 — Coverage plan — informational only, never a Score.
// ═════════════════════════════════════════════════════════════════════

test('9.  buildCoveragePlan — label is "Identity Coverage" (Board R: never "Score / Health / Rating")', () => {
  const ii = makeIntelligence();
  const plan = buildCoveragePlan(ii);
  assert.equal(plan.label, 'Identity Coverage');
});

test('10. buildCoveragePlan — label is NEVER "Score" or any executive-metric synonym', () => {
  const ii = makeIntelligence();
  const plan = buildCoveragePlan(ii);
  const forbidden = ['Score', 'Health', 'Rating', 'Health Score', 'Coverage Score'];
  for (const term of forbidden) {
    assert.ok(plan.label !== term,
      `coverage label must never be "${term}" — Royaltē Health™ owns executive scoring`);
  }
});

test('11. buildCoveragePlan — value carries the integer coverage; summary uses the Board worked example format', () => {
  const ii = makeIntelligence({
    platforms: {
      appleMusic: { availability: 'VERIFIED', details: { artwork: 'https://x/a.jpg' } },
      spotify:    { availability: 'VERIFIED', details: null },
      youtube:    { availability: 'NOT_FOUND', details: null },
    },
  });
  // 2 of 3 verified → coverage 67
  const plan = buildCoveragePlan(ii);
  assert.equal(plan.value, 67);
  assert.equal(plan.summary, '2 of 3 providers verified');
});

test('12. buildCoveragePlan — null on missing intelligence (boot leaves the locked sample HTML in place)', () => {
  assert.equal(buildCoveragePlan(null), null);
  assert.equal(buildCoveragePlan(undefined), null);
  assert.equal(buildCoveragePlan({}), null);
  assert.equal(buildCoveragePlan({ coverage: 'not a number' }), null);
});

test('13. buildCoveragePlan — does NOT carry any field hinting at executive scoring', () => {
  const ii = makeIntelligence();
  const plan = buildCoveragePlan(ii);
  const planKeys = Object.keys(plan);
  for (const k of planKeys) {
    assert.ok(!/score|health|rating|grade/i.test(k),
      `coverage plan must not expose an executive-scoring key; got "${k}"`);
  }
});

// ═════════════════════════════════════════════════════════════════════
//  14–18 — Recommendations plan — pass-through, no Mission Control logic.
// ═════════════════════════════════════════════════════════════════════

test('14. buildRecommendationsPlan — null on missing intelligence (locked sample HTML survives)', () => {
  assert.equal(buildRecommendationsPlan(null), null);
  assert.equal(buildRecommendationsPlan(undefined), null);
});

test('15. buildRecommendationsPlan — empty array on intelligence-present-but-no-recommendations (legitimate "all clear")', () => {
  const ii = makeIntelligence();
  const plan = buildRecommendationsPlan(ii);
  assert.ok(Array.isArray(plan));
  assert.equal(plan.length, 0,
    'all-VERIFIED intelligence has zero identity recommendations → empty plan, NOT null');
});

test('16. buildRecommendationsPlan — preserves the recommendation order produced by the assembler', () => {
  const ii = makeIntelligence({
    platforms: {
      appleMusic: { availability: 'VERIFIED', details: { artwork: null } },          // fires identity.apple.artwork-missing
      spotify:    { availability: 'VERIFIED', details: null },
      youtube:    { availability: 'VERIFIED', details: { officialChannel: { channelId: 'UC' }, contentIdVerified: false } }, // fires identity.youtube.content-id-unverified
    },
  });
  const plan = buildRecommendationsPlan(ii);
  // Each plan entry's order matches the assembler's order
  for (let i = 0; i < plan.length; i++) {
    assert.equal(plan[i].ruleId, ii.recommendations[i].ruleId,
      `plan[${i}].ruleId must match ii.recommendations[${i}].ruleId — Mission Control never reorders (Board R)`);
  }
});

test('17. buildRecommendationsPlan — never invents a recommendation (count equals assembler count)', () => {
  const ii = makeIntelligence({
    platforms: {
      appleMusic: { availability: 'VERIFIED', details: { artwork: null } },
      spotify:    { availability: 'VERIFIED', details: null },
      youtube:    { availability: 'VERIFIED', details: { officialChannel: { channelId: 'UC' }, contentIdVerified: true } },
    },
  });
  const plan = buildRecommendationsPlan(ii);
  assert.equal(plan.length, ii.recommendations.length,
    'recommendation count must match exactly — Mission Control never adds recommendations');
});

test('18. buildRecommendationsPlan — never references Amazon (Board R3)', () => {
  // Even when Amazon is hypothetically passed in (it cannot be today
  // because IDENTITY_PROVIDERS excludes it, but we test the
  // pass-through contract): any recommendation with provider="amazon"
  // would only appear if the assembler produced it — which it never
  // does because Amazon is not in IDENTITY_PROVIDERS. Verify by
  // sampling the assembler output.
  const ii = makeIntelligence({
    platforms: {
      appleMusic: { availability: 'AUTH_UNAVAILABLE', details: null },
      spotify:    { availability: 'NOT_FOUND', details: null },
      youtube:    { availability: 'ERROR', details: null },
    },
  });
  const plan = buildRecommendationsPlan(ii);
  for (const rec of plan) {
    assert.notEqual(rec.provider, 'amazon');
  }
});

// ═════════════════════════════════════════════════════════════════════
//  19–22 — Defensive contract: never throws on any input.
// ═════════════════════════════════════════════════════════════════════

test('19. safeIdentityIntelligence — returns null on garbage', () => {
  assert.equal(safeIdentityIntelligence(null), null);
  assert.equal(safeIdentityIntelligence(undefined), null);
  assert.equal(safeIdentityIntelligence(42), null);
  assert.equal(safeIdentityIntelligence('a string'), null);
  assert.equal(safeIdentityIntelligence([1, 2, 3]), null);
});

test('20. buildProviderRenderPlan — returns [] on garbage input, never throws', () => {
  assert.deepStrictEqual(buildProviderRenderPlan(null), []);
  assert.deepStrictEqual(buildProviderRenderPlan(undefined), []);
  assert.deepStrictEqual(buildProviderRenderPlan({}), []);
  assert.deepStrictEqual(buildProviderRenderPlan({ supportedProviders: 'not-an-array' }), []);
});

test('21. buildCoveragePlan + buildRecommendationsPlan — never throw on garbage', () => {
  for (const input of [null, undefined, 42, 'string', [], {}, { foo: 'bar' }]) {
    assert.doesNotThrow(() => buildCoveragePlan(input));
    assert.doesNotThrow(() => buildRecommendationsPlan(input));
  }
});

test('22. CONSTITUTIONAL — no render plan exposes a `score` field (Royaltē Health™ owns scoring)', () => {
  const ii = makeIntelligence();
  const coverage = buildCoveragePlan(ii);
  const providers = buildProviderRenderPlan(ii);
  const recs = buildRecommendationsPlan(ii);
  assert.ok(!('score' in coverage),
    'coverage plan must not have a score field');
  for (const p of providers) {
    assert.ok(!('score' in p),
      'provider plan entry must not have a score field');
  }
  for (const r of recs) {
    assert.ok(!('score' in r),
      'recommendation plan entry must not have a score field');
  }
});

console.log('');
console.log('═════════════════════════════════════════════');
console.log(`  MISSION CONTROL WIRING VERIFIED: ${passed} assertions passed`);
console.log('═════════════════════════════════════════════');
