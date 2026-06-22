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
  renderHealth,
  renderPriorityActions,
  buildProviderRenderPlan,
  buildCoveragePlan,
  buildRecommendationsPlan,
  safeIdentityIntelligence,
  ROYALTE_AI_ACTIVITY_LABELS,
  STATE_PILL_CLASS,
  STATE_PILL_TEXT,
} from '../public/js/mission-control-renderers.js';

import { assembleCio } from '../api/_lib/cio-assembler.js';
import { runIntelligenceEngine } from '../api/_lib/intelligence-engine.js';
import { ALL_RULES } from '../api/rules/index.js';
import { assembleIdentityIntelligence } from '../api/_lib/identity-intelligence.js';

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
  // must throw a clear error when invoked. renderPublishing and
  // renderCatalog are no longer in this list — Phase 5B promoted
  // renderPublishing and Catalog Phase v1.0 promoted renderCatalog
  // to real implementations (see test 26b and 26c below).
  for (const [name, fn] of [
    ['renderBackend',         renderBackend],
    ['renderHealth',          renderHealth],
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
      mlcRegistration:      'VERIFIED',
      iswcCoverage:         'VERIFIED',
      writerCredits:        'VERIFIED',
      publisherInformation: 'NOT_FOUND',
    },
    supportedSources: Object.freeze(['mlc']),
    registeredCount: 3,
    totalChecked:    4,
    coverage:        75,
    strengths: [], issues: [], recommendations: [],
  };
  const plan = renderPublishing(pi);
  assert.deepStrictEqual(Object.keys(plan).sort(), ['coverage', 'registrations']);
  assert.equal(plan.coverage.label, 'Publishing Coverage',
    'Publishing Intelligence coverage label must be "Publishing Coverage" — never Score/Health/Rating (Board D9)');
  assert.equal(plan.registrations.length, 4);
  // Iteration order matches the registrations map (data-driven, no
  // hardcoded metric list in MC — Board D7 + Phase 5B Concern 2 parity).
  assert.deepStrictEqual(plan.registrations.map((r) => r.metric),
    ['mlcRegistration', 'iswcCoverage', 'writerCredits', 'publisherInformation']);
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
