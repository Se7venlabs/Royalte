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
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  renderIdentity,
  renderPublishing,
  renderCatalog,
  renderGlobalMusicFootprint,
  renderRoyalteAI,
  renderBackend,
  renderChangeDetection,
  renderHealth,
  renderPriorityActions,
  buildProviderRenderPlan,
  buildCoveragePlan,
  buildRecommendationsPlan,
  safeIdentityIntelligence,
  safeBackendIntelligence,
  safeMonitoringIntelligence,
  safeHealthIntelligence,
  ROYALTE_AI_ACTIVITY_LABELS,
  STATE_PILL_CLASS,
  STATE_PILL_TEXT,
} from '../public/js/mission-control-renderers.js';

import { assembleCio } from '../api/_lib/cio-assembler.js';
import { runIntelligenceEngine } from '../api/_lib/intelligence-engine.js';
import { ALL_RULES } from '../api/rules/index.js';
import { assembleIdentityIntelligence } from '../api/_lib/identity-intelligence.js';
import { assembleHealthIntelligence } from '../api/_lib/health-intelligence.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MC_RENDERERS_SRC = readFileSync(join(__dirname, '..', 'public', 'js', 'mission-control-renderers.js'), 'utf8');
const MC_BOOT_SRC      = readFileSync(join(__dirname, '..', 'public', 'js', 'mission-control.js'),           'utf8');

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

test('1. Renderer module contains NO hardcoded provider array — iteration is data-driven only (Board Concern 2)', () => {
  // The renderer module must never list provider keys as a literal.
  // Forbidden literal-array patterns the boot module / renderer
  // would resort to if it tried to hardcode the supported set.
  const forbiddenPatterns = [
    /\[\s*['"`]apple['"`]\s*,\s*['"`]spotify['"`]/i,
    /\[\s*['"`]spotify['"`]\s*,\s*['"`]apple['"`]/i,
    /\[\s*['"`]apple['"`]\s*,\s*['"`]youtube['"`]/i,
  ];
  for (const p of forbiddenPatterns) {
    assert.ok(!p.test(MC_RENDERERS_SRC),
      `mission-control-renderers.js must not contain a hardcoded provider list (Board Concern 2); pattern matched: ${p}`);
    assert.ok(!p.test(MC_BOOT_SRC),
      `mission-control.js must not contain a hardcoded provider list (Board Concern 2); pattern matched: ${p}`);
  }
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

// ═════════════════════════════════════════════════════════════════════
//  23–27 — Board Final Review concerns (2026-06-17)
// ═════════════════════════════════════════════════════════════════════

test('23. CONCERN 1 (HEP) — neither MC file produces a user-facing "Score" / "Health" / "Rating" string from data', () => {
  // The renderer module + boot module must never assign one of these
  // forbidden labels to ANY user-facing string. Allowed: comments
  // explaining that the label is forbidden, source identifiers (variable
  // names like "Royaltē Health™" referenced in doc-blocks are
  // documentation, not user-facing rendering).
  //
  // We grep for an assignment / interpolation / object-literal value
  // that would route a forbidden label to the DOM.
  const forbiddenAsValue = [
    /label\s*[:=]\s*['"`]Identity Score['"`]/i,
    /label\s*[:=]\s*['"`]Health['"`]/i,
    /label\s*[:=]\s*['"`]Health Score['"`]/i,
    /label\s*[:=]\s*['"`]Identity Rating['"`]/i,
    /label\s*[:=]\s*['"`]Artist Rating['"`]/i,
    /label\s*[:=]\s*['"`]Coverage Score['"`]/i,
  ];
  for (const p of forbiddenAsValue) {
    assert.ok(!p.test(MC_RENDERERS_SRC),
      `renderer assigns forbidden label "${p}" — Royaltē Health™ owns executive scoring (Board Concern 1)`);
    assert.ok(!p.test(MC_BOOT_SRC),
      `boot module assigns forbidden label "${p}" — Royaltē Health™ owns executive scoring (Board Concern 1)`);
  }
});

test('24. CONCERN 4 (MC boundary) — neither MC file imports any api/_lib/ or api/rules/ module', () => {
  // Mission Control must never reach into the scan engine, Rule
  // Library, CIO assembler, or Identity Intelligence assembler. The
  // boot module + renderer module are CLIENT code; importing from
  // api/ would break the constitutional separation.
  const forbiddenImportPatterns = [
    /from\s+['"`].*api\/_lib\//,
    /from\s+['"`].*api\/rules\//,
    /from\s+['"`].*api\/schema\//,
    /from\s+['"`].*api\/lib\//,
    /import\s*\(\s*['"`].*api\/_lib\//,
    /import\s*\(\s*['"`].*api\/rules\//,
  ];
  for (const p of forbiddenImportPatterns) {
    assert.ok(!p.test(MC_RENDERERS_SRC),
      `mission-control-renderers.js must not import from api/ — Mission Control is presentation-only (Board Concern 4)`);
    assert.ok(!p.test(MC_BOOT_SRC),
      `mission-control.js must not import from api/ — Mission Control is presentation-only (Board Concern 4)`);
  }
});

test('25. CONCERN 3 — renderIdentity(intelligence) composes the three plan builders into a single canonical entry point', () => {
  const ii = makeIntelligence({
    platforms: {
      appleMusic: { availability: 'VERIFIED', details: { artwork: null } },
      spotify:    { availability: 'VERIFIED', details: null },
      youtube:    { availability: 'NOT_FOUND', details: null },
    },
  });
  const plan = renderIdentity(ii);
  assert.deepStrictEqual(Object.keys(plan).sort(),
    ['coverage', 'providers', 'recommendations']);
  // Each slot matches the individual builder's output (composition is
  // pass-through, no extra transformation)
  assert.deepStrictEqual(plan.coverage,        buildCoveragePlan(ii));
  assert.deepStrictEqual(plan.providers,       buildProviderRenderPlan(ii));
  assert.deepStrictEqual(plan.recommendations, buildRecommendationsPlan(ii));
});

test('26. CONCERN 6 — future-stage renderers are exported as deliberate "not yet implemented" stubs', () => {
  // Each remaining placeholder must exist as a callable export AND
  // must throw a clear error when invoked. renderPublishing, renderCatalog,
  // renderGlobalMusicFootprint, renderRoyalteAI, renderBackend,
  // renderChangeDetection, and renderHealth are no longer in this list —
  // each has been promoted to a real implementation (see tests 26b–26h below).
  for (const [name, fn] of [
    ['renderPriorityActions', renderPriorityActions],
  ]) {
    assert.equal(typeof fn, 'function', `${name} must be exported as a function`);
    assert.throws(() => fn({}),
      /not yet implemented/i,
      `${name} stub must throw a "not yet implemented" error until its future stage lands`);
  }
});

test('26b. CONCERN 3 + 6 (Phase 5B) — renderPublishing is implemented and conforms to the canonical entry-point contract', () => {
  // Phase 5B replaced the not-yet-implemented stub with a real
  // renderer. It must (a) be a function, (b) NOT throw on a
  // well-formed publishingIntelligence input, (c) return the same
  // shape every domain renderer follows.
  assert.equal(typeof renderPublishing, 'function');
  const pi = {
    registrations: {
      mlcRegistration:       'VERIFIED',
      registeredWorks:       'VERIFIED',
      iswcCoverage:          'VERIFIED',
      registeredSongwriters: 'VERIFIED',
      writerIpi:             'NOT_FOUND',
      compositionMatch:      'VERIFIED',
    },
    metrics: { mlcWorksCount: 3, mlcIswcCount: 3, mlcWriterCount: 4, mlcWriterIpiCount: 3 },
    supportedSources: Object.freeze(['mlc']),
    registeredCount: 5,
    totalChecked:    6,
    coverage:        83,
    strengths: [], issues: [], recommendations: [],
  };
  const plan = renderPublishing(pi);
  assert.deepStrictEqual(Object.keys(plan).sort(), ['coverage', 'registrations']);
  assert.equal(plan.coverage.label, 'Publishing Coverage',
    'Publishing Intelligence coverage label must be "Publishing Coverage" — never Score/Health/Rating (Board D9)');
  assert.equal(plan.registrations.length, 6);
  // Iteration order matches the registrations map (data-driven, no
  // hardcoded metric list in MC — Board D7 + Build Pass 2 parity).
  assert.deepStrictEqual(plan.registrations.map((r) => r.metric),
    ['mlcRegistration', 'registeredWorks', 'iswcCoverage', 'registeredSongwriters', 'writerIpi', 'compositionMatch']);
});

test('26c. CONCERN 3 + 6 (Catalog Phase v1.0) — renderCatalog is implemented and conforms to the canonical entry-point contract', () => {
  // Catalog Phase v1.0 replaced the not-yet-implemented stub with a real
  // renderer. It must (a) be a function, (b) NOT throw on a well-formed
  // catalogIntelligence input, (c) return all six expected keys.
  assert.equal(typeof renderCatalog, 'function');
  const ci = Object.freeze({
    singles: 4, eps: 0, albums: 0,
    totalTracks: 4, catalogStatus: 'Stable', confidence: 'Verified',
  });
  const plan = renderCatalog(ci);
  assert.ok(plan !== null, 'renderCatalog must return a plan object, not null');
  assert.deepStrictEqual(
    Object.keys(plan).sort(),
    ['albums', 'catalogStatus', 'confidence', 'eps', 'singles', 'totalTracks'],
    'renderCatalog plan must carry exactly the six Catalog Intelligence™ v1.0 fields (features removed)'
  );
  assert.equal(plan.singles, 4);
  assert.equal(plan.eps, 0);
  assert.equal(plan.albums, 0);
  assert.equal(plan.totalTracks, 4);
  assert.equal(plan.catalogStatus, 'Stable');
  assert.equal(plan.confidence, 'Verified');
  // features must NOT appear in the plan (deferred to Featured Appearance Intelligence™)
  assert.ok(!('features' in plan), 'features must not appear in Catalog Intelligence™ v1.0 plan');
  // renderCatalog must return null on absent / malformed intelligence
  // (boot module leaves the locked sample HTML in place).
  assert.equal(renderCatalog(null), null);
  assert.equal(renderCatalog(undefined), null);
  assert.equal(renderCatalog('string'), null);
});

test('26d. CONCERN 3 + 6 (GMF Phase v1.0) — renderGlobalMusicFootprint is implemented and conforms to the canonical entry-point contract', () => {
  // GMF Phase v1.0 replaced the not-yet-implemented placeholder with a
  // real renderer. It must (a) be a function, (b) NOT throw on a
  // well-formed globalMusicFootprint input, (c) return the five expected
  // keys exactly matching the BIG6 territory intelligence shape.
  assert.equal(typeof renderGlobalMusicFootprint, 'function');
  const gmf = Object.freeze({
    territoriesAvailable:   8,
    territoriesUnavailable: 0,
    coveragePercent:        100,
    status:                 'Global',
    confidence:             'Verified',
  });
  const plan = renderGlobalMusicFootprint(gmf);
  assert.ok(plan !== null, 'renderGlobalMusicFootprint must return a plan object, not null');
  assert.deepStrictEqual(
    Object.keys(plan).sort(),
    ['confidence', 'coveragePercent', 'status', 'territoriesAvailable', 'territoriesUnavailable'],
    'renderGlobalMusicFootprint plan must carry exactly the five Global Music Footprint™ v1.0 fields'
  );
  assert.equal(plan.territoriesAvailable,   8);
  assert.equal(plan.territoriesUnavailable, 0);
  assert.equal(plan.coveragePercent,        100);
  assert.equal(plan.status,                 'Global');
  assert.equal(plan.confidence,             'Verified');
  // HEP boundary — plan must not carry score/health/rating
  assert.ok(!('score'  in plan), 'renderGlobalMusicFootprint must not expose a score field');
  assert.ok(!('health' in plan), 'renderGlobalMusicFootprint must not expose a health field');
  // renderGlobalMusicFootprint must return null on absent / malformed intelligence
  assert.equal(renderGlobalMusicFootprint(null),      null);
  assert.equal(renderGlobalMusicFootprint(undefined), null);
  assert.equal(renderGlobalMusicFootprint('string'),  null);
});

test('26e. CONCERN 3 + 6 (Royaltē AI v1.0) — renderRoyalteAI is implemented and conforms to the canonical entry-point contract', () => {
  // Royaltē AI Phase v1.0 replaced the not-yet-implemented slot with
  // a real renderer. Verifies: (a) function export, (b) correct output
  // shape on valid input, (c) null-safe on absent intelligence, (d) HEP
  // boundary — never exposes a score / health field.
  assert.equal(typeof renderRoyalteAI, 'function', 'renderRoyalteAI must be exported as a function');

  const ai = Object.freeze({
    observation:    'Your catalog is verified globally across all 167 Apple Music territories. Your catalog includes 4 singles.',
    priority:       'Publisher Information not confirmed in reviewed sources.',
    positiveSignal: 'Verified global distribution across all 167 Apple Music territories.',
    nextAction:     'Register with a music publisher or establish self-publishing to confirm publisher information.',
    confidence:     'high',
    generatedBy:    'engine_template',
    generatedAt:    '2026-06-21T00:00:00.000Z',
    generatedFrom:  ['identityIntelligence', 'publishingIntelligence', 'catalogIntelligence', 'globalMusicFootprint'],
  });

  const plan = renderRoyalteAI(ai);

  assert.ok(plan !== null, 'renderRoyalteAI must return a non-null plan for valid input');
  assert.equal(typeof plan.observation, 'string', 'plan must carry observation string');
  assert.ok(Array.isArray(plan.activities), 'plan must carry activities array');
  assert.equal(plan.activities.length, 3,
    'activities must have exactly 3 entries (Priority Issue, Positive Signal, Next Action)');
  assert.deepStrictEqual(
    plan.activities.map((a) => a.label),
    [
      ROYALTE_AI_ACTIVITY_LABELS.PRIORITY,
      ROYALTE_AI_ACTIVITY_LABELS.POSITIVE_SIGNAL,
      ROYALTE_AI_ACTIVITY_LABELS.NEXT_ACTION,
    ],
    'activity labels must match the Board-locked ROYALTE_AI_ACTIVITY_LABELS vocabulary'
  );
  assert.equal(plan.activities[0].text, ai.priority,       'activity[0].text must be the priority field');
  assert.equal(plan.activities[1].text, ai.positiveSignal, 'activity[1].text must be the positiveSignal field');
  assert.equal(plan.activities[2].text, ai.nextAction,     'activity[2].text must be the nextAction field');

  // Graceful null handling — boot module leaves locked sample HTML in place
  assert.strictEqual(renderRoyalteAI(null),      null, 'null input must return null');
  assert.strictEqual(renderRoyalteAI(undefined), null, 'undefined input must return null');

  // HEP boundary — Royaltē Health™ owns scoring; AI renderer must never expose it
  const forbidden = ['score', 'health', 'grade', 'healthScore', 'overallScore'];
  for (const key of forbidden) {
    assert.ok(!(key in plan),
      `plan must not expose '${key}' — Royaltē Health™ owns executive scoring (HEP boundary)`);
  }
});

test('26f. CONCERN 3 + 6 (Backend Intelligence v2.0 Build Pass 3) — renderBackend conforms to the updated contract', () => {
  // Build Pass 3 Board directive: Discogs + Listen Notes removed from display;
  // MLC subLabel changed from 'Registered' → 'Connected'; added apisResponding
  // and lastSync fields. Renderer must expose apisRespondingLabel + lastSyncLabel.
  assert.equal(typeof renderBackend, 'function', 'renderBackend must be exported as a function');
  assert.equal(typeof safeBackendIntelligence, 'function', 'safeBackendIntelligence must be exported');

  const bi = Object.freeze({
    services: Object.freeze([
      Object.freeze({ key: 'musicbrainz', name: 'MusicBrainz', state: 'VERIFIED', subLabel: 'Connected', statusLabel: 'Verified' }),
      Object.freeze({ key: 'mlc',         name: 'MLC',         state: 'VERIFIED', subLabel: 'Connected', statusLabel: 'Verified' }),
    ]),
    connectedCount:  2,
    totalCount:      2,
    summaryLabel:    'All Verified',
    apisResponding:  Object.freeze({ responded: 4, total: 4 }),
    lastSync:        '2026-06-25T08:42:00.000Z',
  });

  const plan = renderBackend(bi);

  assert.ok(plan !== null, 'renderBackend must return a non-null plan for valid input');
  assert.ok(Array.isArray(plan.services), 'plan must carry services array');
  assert.equal(plan.services.length, 2, 'plan must carry exactly 2 displayed service entries (Build Pass 3)');

  // Service key vocabulary — v2.0 lock: musicbrainz + mlc only
  assert.deepStrictEqual(
    plan.services.map((s) => s.key),
    ['musicbrainz', 'mlc'],
    'service keys must match Build Pass 3 lock order: musicbrainz, mlc'
  );

  // Each service plan must carry name, subLabel, statusLabel
  for (const svc of plan.services) {
    assert.equal(typeof svc.name,        'string', `${svc.key} plan must carry name string`);
    assert.equal(typeof svc.subLabel,    'string', `${svc.key} plan must carry subLabel string`);
    assert.equal(typeof svc.statusLabel, 'string', `${svc.key} plan must carry statusLabel string`);
  }

  // MLC must show infrastructure status only — 'Registered' is Publishing Intelligence vocabulary
  const mlcPlan = plan.services.find((s) => s.key === 'mlc');
  assert.ok(mlcPlan, 'mlc service must be present in plan');
  assert.notEqual(mlcPlan.subLabel,    'Registered', 'MLC subLabel must not use "Registered" — that belongs to Publishing Intelligence™');
  assert.equal   (mlcPlan.subLabel,    'Connected',  'MLC subLabel must be Connected');
  assert.equal   (mlcPlan.statusLabel, 'Verified',   'MLC statusLabel must be Verified');

  // APIs Responding label — new in Build Pass 3
  assert.equal(typeof plan.apisRespondingLabel, 'string', 'plan must carry apisRespondingLabel');
  assert.equal(plan.apisRespondingLabel, '4 / 4', 'apisRespondingLabel must be "4 / 4" for 4/4 responded');

  // Last Sync label — new in Build Pass 3
  assert.equal(typeof plan.lastSyncLabel, 'string', 'plan must carry lastSyncLabel');
  assert.ok(plan.lastSyncLabel.length > 0, 'lastSyncLabel must be non-empty');

  // connectedCount + totalCount + summaryLabel preserved for backward compat
  assert.equal(typeof plan.connectedCount, 'number', 'plan must carry connectedCount');
  assert.equal(typeof plan.totalCount,     'number', 'plan must carry totalCount');
  assert.equal(typeof plan.summaryLabel,   'string', 'plan must carry summaryLabel');

  // Graceful null handling — boot module leaves locked sample HTML in place
  assert.strictEqual(renderBackend(null),      null, 'null input must return null');
  assert.strictEqual(renderBackend(undefined), null, 'undefined input must return null');
  assert.strictEqual(renderBackend({ services: [] }), null, 'empty services array must return null');

  // HEP boundary — Royaltē Health™ owns scoring; backend renderer must never expose it
  const forbidden = ['score', 'health', 'grade', 'healthScore', 'overallScore', 'rating'];
  for (const key of forbidden) {
    assert.ok(!(key in plan),
      `plan must not expose '${key}' — Royaltē Health™ owns executive scoring (HEP boundary)`);
  }

  // Stale payload backward compat: no apisResponding field → falls back to connectedCount/totalCount
  const staleBI = Object.freeze({
    services: Object.freeze([
      Object.freeze({ key: 'musicbrainz', name: 'MusicBrainz', state: 'VERIFIED', subLabel: 'Connected', statusLabel: 'Verified' }),
    ]),
    connectedCount: 1,
    totalCount:     1,
    summaryLabel:   'All Verified',
  });
  const stalePlan = renderBackend(staleBI);
  assert.ok(stalePlan !== null, 'stale payload must still render');
  assert.equal(stalePlan.apisRespondingLabel, '1 / 1', 'stale payload falls back to connectedCount/totalCount');
  assert.equal(stalePlan.lastSyncLabel, 'Unknown', 'stale payload with no lastSync renders Unknown');
});

test('26g. CONCERN 3 + 6 (Monitoring Intelligence v1.0) — renderChangeDetection is implemented and conforms to the canonical entry-point contract', () => {
  // Monitoring Intelligence Phase v1.0 (Option A — per-scan delta only).
  // Verifies: (a) function export, (b) output shape on active/baseline/no_changes
  // inputs, (c) null-safe on absent intelligence, (d) HEP boundary.
  assert.equal(typeof renderChangeDetection, 'function', 'renderChangeDetection must be exported as a function');
  assert.equal(typeof safeMonitoringIntelligence, 'function', 'safeMonitoringIntelligence must be exported');

  // ── active state: N events this scan ────────────────────────────────
  const activeInput = Object.freeze({
    status:      'active',
    scanNumber:  3,
    newThisScan: 2,
    events: Object.freeze([
      Object.freeze({ changeType: 'territory_gain',  title: 'Territory added: JP', severity: 'positive'      }),
      Object.freeze({ changeType: 'release_added',   title: 'New release detected', severity: 'informational' }),
    ]),
  });
  const activePlan = renderChangeDetection(activeInput);
  assert.ok(activePlan !== null, 'renderChangeDetection must return a non-null plan for active input');
  assert.equal(activePlan.sumValue, '2 New',    'active state: sumValue must reflect newThisScan count');
  assert.equal(activePlan.sumMeta,  'This Scan', 'active state: sumMeta must be "This Scan"');
  assert.ok(Array.isArray(activePlan.events),   'plan must carry events array');
  assert.equal(activePlan.events.length, 2,     'events length must match input');
  assert.equal(activePlan.events[0].changeType, 'territory_gain');
  assert.equal(activePlan.events[0].title,      'Territory added: JP');

  // ── baseline state: first scan ──────────────────────────────────────
  const baselineInput = Object.freeze({
    status:      'baseline',
    scanNumber:  1,
    newThisScan: 1,
    events: Object.freeze([
      Object.freeze({ changeType: 'baseline_established', title: 'Baseline established — monitoring now active', severity: 'informational' }),
    ]),
  });
  const baselinePlan = renderChangeDetection(baselineInput);
  assert.ok(baselinePlan !== null, 'renderChangeDetection must return a plan for baseline input');
  assert.equal(baselinePlan.sumValue, '1 New',       'baseline: sumValue must be "1 New"');
  assert.equal(baselinePlan.sumMeta,  'Baseline Set', 'baseline: sumMeta must be "Baseline Set"');

  // ── no_changes state: repeat scan, nothing changed ──────────────────
  const noChangesInput = Object.freeze({
    status:      'no_changes',
    scanNumber:  5,
    newThisScan: 0,
    events:      Object.freeze([]),
  });
  const noChangesPlan = renderChangeDetection(noChangesInput);
  assert.ok(noChangesPlan !== null,   'renderChangeDetection must return a plan for no_changes input');
  assert.equal(noChangesPlan.sumValue, 'All Clear', 'no_changes: sumValue must be "All Clear"');
  assert.equal(noChangesPlan.sumMeta,  'This Scan', 'no_changes: sumMeta must be "This Scan"');
  assert.ok(Array.isArray(noChangesPlan.events) && noChangesPlan.events.length === 0, 'no_changes events must be empty');

  // ── null-safe ────────────────────────────────────────────────────────
  assert.strictEqual(renderChangeDetection(null),      null, 'null input must return null');
  assert.strictEqual(renderChangeDetection(undefined), null, 'undefined input must return null');
  assert.strictEqual(renderChangeDetection({}),        null, 'missing status field must return null');

  // ── HEP boundary ─────────────────────────────────────────────────────
  const forbidden = ['score', 'health', 'grade', 'healthScore', 'overallScore', 'rating'];
  for (const key of forbidden) {
    assert.ok(!(key in activePlan),
      `plan must not expose '${key}' — Royaltē Health™ owns executive scoring (HEP boundary)`);
  }
});

test('26h. CONCERN 3 + 6 (Health Intelligence v1.0) — renderHealth is implemented and conforms to the canonical entry-point contract', () => {
  // Health Intelligence v1.0 is an interpretation layer: score comes from
  // the canonical healthScore.overallScore, never from independent calculation.
  // Validates: function exported, null-safe, correct output shape.

  assert.equal(typeof renderHealth,           'function', 'renderHealth must be exported as a function');
  assert.equal(typeof safeHealthIntelligence, 'function', 'safeHealthIntelligence must be exported');

  // ── Well-formed input — simulates assembleHealthIntelligence output ───
  const hi = {
    score:           78,
    status:          'Strong',
    confidence:      'Partial',
    identityScore:   72,
    publishingScore: 86,
    catalogScore:    84,
    footprintScore:  58,
    monitoringScore: 90,
    backendScore:    100,
    strengths:       ['Identity verified across reviewed platforms', 'Backend infrastructure fully connected'],
    concerns:        ['Territory coverage may be limited'],
    generatedAt:     new Date().toISOString(),
  };

  const plan = renderHealth(hi);
  assert.ok(plan !== null, 'renderHealth must return a non-null plan for valid input');

  // ── Score passes through verbatim (canonical — not recomputed) ────────
  assert.equal(plan.score,      78,       'score must pass through as-is from the canonical health score');
  assert.equal(plan.status,     'Strong', 'status must pass through');
  assert.equal(plan.confidence, 'Partial','confidence must pass through');

  // ── composite field must NOT exist — one score in the system ─────────
  assert.ok(!('composite' in plan),
    'plan must not expose a composite field — there is one canonical health score');

  // ── Ring dasharray ────────────────────────────────────────────────────
  assert.ok(typeof plan.ringDasharray === 'string' && plan.ringDasharray.includes(' '),
    'ringDasharray must be a two-value SVG string');

  // ── Domain scores (informational contributor rows) ────────────────────
  assert.ok(plan.domainScores && typeof plan.domainScores === 'object', 'domainScores must be an object');
  assert.equal(plan.domainScores.identity,   72,  'identityScore');
  assert.equal(plan.domainScores.publishing, 86,  'publishingScore');
  assert.equal(plan.domainScores.catalog,    84,  'catalogScore');
  assert.equal(plan.domainScores.footprint,  58,  'footprintScore');
  assert.equal(plan.domainScores.monitoring, 90,  'monitoringScore');
  assert.equal(plan.domainScores.backend,    100, 'backendScore');

  // ── Strengths / concerns ─────────────────────────────────────────────
  assert.ok(Array.isArray(plan.strengths), 'strengths must be an array');
  assert.ok(Array.isArray(plan.concerns),  'concerns must be an array');
  assert.equal(plan.strengths.length, 2, 'strengths count must match input');
  assert.equal(plan.concerns.length,  1, 'concerns count must match input');

  // ── Null-safe ────────────────────────────────────────────────────────
  assert.strictEqual(renderHealth(null),      null, 'null input must return null');
  assert.strictEqual(renderHealth(undefined), null, 'undefined input must return null');
  assert.strictEqual(renderHealth({}),        null, 'object missing score field must return null');

  // ── Status vocabulary enforced ────────────────────────────────────────
  const validStatuses = ['Excellent', 'Strong', 'Moderate', 'Needs Review'];
  assert.ok(validStatuses.includes(plan.status),
    `status must be one of ${validStatuses.join(' | ')}`);
});

test('26i. CONSTITUTIONAL — assembleHealthIntelligence score === canonical healthScore.overallScore (one score in the system)', () => {
  // This test enforces the Board directive: Health Intelligence™ is an
  // interpretation layer only. payload.healthIntelligence.score must
  // equal payload.healthScore.overallScore — no independent calculation.

  const canonicalHealthScore = { overallScore: 83, overallGrade: 'A' };

  // Minimal domain intelligence stubs (non-null to exercise the path)
  const hi = assembleHealthIntelligence(
    canonicalHealthScore,
    { coverage: 72, verified: 3, total: 4, supportedProviders: [] },
    { coverage: 86, registrations: {} },
    { confidence: 'Verified', totalTracks: 120 },
    { coveragePercent: 58 },
    { services: [{ state: 'VERIFIED' }, { state: 'VERIFIED' }, { state: 'VERIFIED' }, { state: 'AUTH_UNAVAILABLE' }] },
    { status: 'no_changes' },
    null,
  );

  // Primary invariant
  assert.equal(hi.score, canonicalHealthScore.overallScore,
    'assembleHealthIntelligence.score must equal healthScore.overallScore — one canonical score');

  // Output shape sanity
  assert.ok(typeof hi.status     === 'string', 'status must be a string');
  assert.ok(typeof hi.confidence === 'string', 'confidence must be a string');
  assert.ok(Array.isArray(hi.strengths), 'strengths must be an array');
  assert.ok(Array.isArray(hi.concerns),  'concerns must be an array');

  // No independent calculation field
  assert.ok(!('composite'     in hi), 'no composite field — one score only');
  assert.ok(!('weightedScore' in hi), 'no weightedScore field');

  // Guard: missing healthScore returns empty shell (score = 0), not a fabricated value
  const empty = assembleHealthIntelligence(null, null, null, null, null, null, null, null);
  assert.equal(empty.score, 0, 'null healthScore must return empty shell with score 0, not a fabricated score');
});

test('27. CONCERN 1 (HEP) — Identity Intelligence + Royaltē Health remain separated; coverage carries no scoring fields', () => {
  // The intelligence object the renderer consumes must not carry a
  // `score` / `health` / `rating` field. If a future commit silently
  // adds one to the assembler, this test catches it BEFORE Mission
  // Control accidentally renders it as an executive metric.
  const ii = makeIntelligence();
  const forbiddenKeys = ['score', 'health', 'rating', 'healthScore', 'identityScore', 'artistRating'];
  for (const k of forbiddenKeys) {
    assert.ok(!(k in ii),
      `Identity Intelligence object must not expose "${k}" — Royaltē Health™ owns executive scoring (Board Concern 1)`);
  }
  // And the renderer's coverage plan must not synthesize one either
  const coverage = buildCoveragePlan(ii);
  for (const k of forbiddenKeys) {
    assert.ok(!(k in coverage),
      `Coverage plan must not expose "${k}" — Royaltē Health™ owns executive scoring (Board Concern 1)`);
  }
});

console.log('');
console.log('═════════════════════════════════════════════');
console.log(`  MISSION CONTROL WIRING VERIFIED: ${passed} assertions passed`);
console.log('═════════════════════════════════════════════');
