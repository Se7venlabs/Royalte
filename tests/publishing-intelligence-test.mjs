// ─────────────────────────────────────────────────────────────────────
//  Royaltē Publishing Intelligence™ — deterministic test suite (Phase 5B)
// ─────────────────────────────────────────────────────────────────────
//
//  Covers the Board-locked four-state model (D5) and the v1.0 output
//  shape (D8). Critical regression — AUTH_UNAVAILABLE / ERROR never
//  collapse to NOT_FOUND, per Board D5 invariant inherited from
//  Identity Intelligence™.
//
//  Convention matches the other Royaltē test suites:
//    - counter + throw on failure, run with `node tests/...`
// ─────────────────────────────────────────────────────────────────────

import { strict as assert } from 'node:assert';
import {
  assemblePublishingIntelligence,
  PUBLISHING_STATE,
  REGISTRATION_METRICS,
  SUPPORTED_SOURCES,
  PUBLISHING_INTELLIGENCE_VERSION,
} from '../api/_lib/publishing-intelligence.js';
import { assembleCio } from '../api/_lib/cio-assembler.js';
import { runIntelligenceEngine } from '../api/_lib/intelligence-engine.js';
import { ALL_RULES } from '../api/rules/index.js';

const OPTS = { now: () => '2026-06-17T00:00:00.000Z' };

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

// ─── Fixture builders ──────────────────────────────────────────────

function publishingWork({ suffix, withIswc = true, withIPI = true } = {}) {
  return {
    title:          `Work ${suffix}`,
    canonicalTitle: `Work ${suffix}`,
    mlcSongCode:    `MLC_${suffix}`,
    iswc:           withIswc ? `T-${suffix}` : null,
    writers: [{
      writerIPI: withIPI ? `IPI_${suffix}` : null,
      firstName: 'Writer',
      lastName:  suffix,
      fullName:  `Writer ${suffix}`,
      role:      'Composer',
    }],
    publishers:     [],
    source:         'mlc',
    rawMlcResponse: { mlcSongCode: `MLC_${suffix}` },
    lastUpdated:    '2026-06-17T00:00:00.000Z',
    confidence:     'MEDIUM',
  };
}

function buildScenario({
  mlcAvailability = 'VERIFIED',
  works           = [publishingWork({ suffix: 'A' })],
  details,         // override observation details
  artistName      = 'Test Artist',
} = {}) {
  const mlcDetails = details !== undefined
    ? details
    : (mlcAvailability === 'VERIFIED'
        ? {
            worksCount:  works.length,
            iswcCount:   works.filter((w) => w.iswc !== null).length,
            writerCount: works.reduce((n, w) => n + (Array.isArray(w.writers) ? w.writers.length : 0), 0),
          }
        : null);
  const cio = assembleCio(artistName, {
    publishingWorks: works,
    publishingSourceObservations: { mlc: { availability: mlcAvailability, details: mlcDetails } },
  }, OPTS);
  const report = runIntelligenceEngine(cio, ALL_RULES);
  return { cio, report, pi: assemblePublishingIntelligence(report, cio) };
}

// ═════════════════════════════════════════════════════════════════════
//  1–4 — Constants are frozen + correct
// ═════════════════════════════════════════════════════════════════════

test('1. PUBLISHING_INTELLIGENCE_VERSION is exported as a semver string', () => {
  assert.equal(typeof PUBLISHING_INTELLIGENCE_VERSION, 'string');
  assert.ok(/^\d+\.\d+\.\d+$/.test(PUBLISHING_INTELLIGENCE_VERSION));
});

test('2. REGISTRATION_METRICS is the locked Board D7 set, in canonical order', () => {
  assert.ok(Object.isFrozen(REGISTRATION_METRICS));
  assert.deepStrictEqual(Array.from(REGISTRATION_METRICS),
    ['mlcRegistration', 'iswcCoverage', 'writerCredits', 'publisherInformation']);
});

test('3. SUPPORTED_SOURCES is the locked Phase 5B set (Board D1 — MLC only)', () => {
  assert.ok(Object.isFrozen(SUPPORTED_SOURCES));
  assert.deepStrictEqual(Array.from(SUPPORTED_SOURCES), ['mlc']);
});

test('4. PUBLISHING_STATE covers exactly the four Board-locked states (D5)', () => {
  assert.ok(Object.isFrozen(PUBLISHING_STATE));
  assert.deepStrictEqual(Object.keys(PUBLISHING_STATE).sort(),
    ['ACTION_REQUIRED', 'NOT_FOUND', 'UNABLE_TO_CONFIRM', 'VERIFIED']);
});

// ═════════════════════════════════════════════════════════════════════
//  5–10 — VERIFIED state per metric
// ═════════════════════════════════════════════════════════════════════

test('5. mlcRegistration VERIFIED — MLC VERIFIED upstream + ≥1 work in CIO', () => {
  const { pi } = buildScenario();
  assert.equal(pi.registrations.mlcRegistration, PUBLISHING_STATE.VERIFIED);
});

test('6. iswcCoverage VERIFIED — every work in details has an ISWC', () => {
  const works = [publishingWork({ suffix: 'A' }), publishingWork({ suffix: 'B' })];
  const { pi } = buildScenario({ works });
  assert.equal(pi.registrations.iswcCoverage, PUBLISHING_STATE.VERIFIED);
});

test('7. writerCredits VERIFIED — at least one writer carries an IPI', () => {
  const { pi } = buildScenario();
  assert.equal(pi.registrations.writerCredits, PUBLISHING_STATE.VERIFIED);
});

test('8. publisherInformation NOT_FOUND — MLC publishers[] always empty (adapter doc)', () => {
  const { pi } = buildScenario();
  assert.equal(pi.registrations.publisherInformation, PUBLISHING_STATE.NOT_FOUND,
    'When MLC is the only source, publisherInformation is NOT_FOUND because MLC carries no publisher data');
});

test('9. all-VERIFIED scenario (hypothetical publishers) → coverage 100', () => {
  // Synthesise a CIO with publishers present so the publisher metric
  // can flip VERIFIED. Use the assembler entrypoint directly with a
  // synthetic CIO to skip the MLC-only constraint of the helper.
  const cio = {
    publishing: { worksCount: 1, writerCount: 1, writerIPIs: ['IPI_A'], publisherCount: 1 },
    observations: {
      publishingSources: {
        mlc: { availability: 'VERIFIED', details: { worksCount: 1, iswcCount: 1, writerCount: 1 } },
      },
    },
  };
  const report = { observations: [] };
  const pi = assemblePublishingIntelligence(report, cio);
  assert.equal(pi.registrations.mlcRegistration,      PUBLISHING_STATE.VERIFIED);
  assert.equal(pi.registrations.iswcCoverage,         PUBLISHING_STATE.VERIFIED);
  assert.equal(pi.registrations.writerCredits,        PUBLISHING_STATE.VERIFIED);
  assert.equal(pi.registrations.publisherInformation, PUBLISHING_STATE.VERIFIED);
  assert.equal(pi.coverage, 100);
});

test('10. iswcCoverage ACTION_REQUIRED — some works without ISWC', () => {
  const works = [
    publishingWork({ suffix: 'A', withIswc: true }),
    publishingWork({ suffix: 'B', withIswc: false }),
  ];
  const cio = assembleCio('Test Artist', {
    publishingWorks: works,
    publishingSourceObservations: {
      mlc: { availability: 'VERIFIED', details: { worksCount: 2, iswcCount: 1, writerCount: 2 } },
    },
  }, OPTS);
  const report = runIntelligenceEngine(cio, ALL_RULES);
  const pi = assemblePublishingIntelligence(report, cio);
  assert.equal(pi.registrations.iswcCoverage, PUBLISHING_STATE.ACTION_REQUIRED);
});

// ═════════════════════════════════════════════════════════════════════
//  11–14 — NOT_FOUND state
// ═════════════════════════════════════════════════════════════════════

test('11. MLC NOT_FOUND upstream → mlcRegistration NOT_FOUND', () => {
  const { pi } = buildScenario({ mlcAvailability: 'NOT_FOUND', works: [], details: null });
  assert.equal(pi.registrations.mlcRegistration, PUBLISHING_STATE.NOT_FOUND);
});

test('12. iswcCount 0 → iswcCoverage NOT_FOUND', () => {
  const works = [publishingWork({ suffix: 'A', withIswc: false })];
  const cio = assembleCio('T', {
    publishingWorks: works,
    publishingSourceObservations: {
      mlc: { availability: 'VERIFIED', details: { worksCount: 1, iswcCount: 0, writerCount: 1 } },
    },
  }, OPTS);
  const pi = assemblePublishingIntelligence(runIntelligenceEngine(cio, ALL_RULES), cio);
  assert.equal(pi.registrations.iswcCoverage, PUBLISHING_STATE.NOT_FOUND);
});

test('13. publisherInformation NOT_FOUND emits an issue', () => {
  const { pi } = buildScenario();
  assert.ok(pi.issues.some((i) => i.metric === 'publisherInformation'));
});

test('14. NOT_FOUND emits issue but never throws', () => {
  const { pi } = buildScenario({ mlcAvailability: 'NOT_FOUND', works: [], details: null });
  assert.ok(pi.issues.some((i) => i.metric === 'mlcRegistration'));
});

// ═════════════════════════════════════════════════════════════════════
//  15–19 — UNABLE_TO_CONFIRM (CONSTITUTIONAL invariant — Board D5)
// ═════════════════════════════════════════════════════════════════════

test('15. CRITICAL: AUTH_UNAVAILABLE → UNABLE_TO_CONFIRM, NEVER NOT_FOUND', () => {
  const { pi } = buildScenario({ mlcAvailability: 'AUTH_UNAVAILABLE', works: [], details: null });
  for (const metric of REGISTRATION_METRICS) {
    assert.equal(pi.registrations[metric], PUBLISHING_STATE.UNABLE_TO_CONFIRM,
      `${metric} must be UNABLE_TO_CONFIRM when MLC was AUTH_UNAVAILABLE`);
    assert.notEqual(pi.registrations[metric], PUBLISHING_STATE.NOT_FOUND,
      `${metric} must NEVER collapse AUTH_UNAVAILABLE to NOT_FOUND (Board D5 invariant)`);
  }
});

test('16. CRITICAL: ERROR → UNABLE_TO_CONFIRM, NEVER NOT_FOUND', () => {
  const { pi } = buildScenario({ mlcAvailability: 'ERROR', works: [], details: null });
  for (const metric of REGISTRATION_METRICS) {
    assert.equal(pi.registrations[metric], PUBLISHING_STATE.UNABLE_TO_CONFIRM);
    assert.notEqual(pi.registrations[metric], PUBLISHING_STATE.NOT_FOUND);
  }
});

test('17. Missing observation entry → UNABLE_TO_CONFIRM', () => {
  const cio = assembleCio('T', { /* no publishingSourceObservations */ }, OPTS);
  assert.equal(cio.observations.publishingSources.mlc, null);
  const pi = assemblePublishingIntelligence(runIntelligenceEngine(cio, ALL_RULES), cio);
  for (const metric of REGISTRATION_METRICS) {
    assert.equal(pi.registrations[metric], PUBLISHING_STATE.UNABLE_TO_CONFIRM);
  }
});

test('18. UNABLE_TO_CONFIRM emits NO issue and NO strength', () => {
  const { pi } = buildScenario({ mlcAvailability: 'AUTH_UNAVAILABLE', works: [], details: null });
  for (const metric of REGISTRATION_METRICS) {
    assert.ok(!pi.issues.some((i) => i.metric === metric),
      `${metric} UNABLE_TO_CONFIRM must produce no issue`);
    assert.ok(!pi.strengths.some((s) => s.metric === metric),
      `${metric} UNABLE_TO_CONFIRM must produce no strength`);
  }
});

test('19. All-UNABLE_TO_CONFIRM → coverage 0 (no verified registrations)', () => {
  const { pi } = buildScenario({ mlcAvailability: 'AUTH_UNAVAILABLE', works: [], details: null });
  assert.equal(pi.registeredCount, 0);
  assert.equal(pi.totalChecked,    4);
  assert.equal(pi.coverage,        0);
});

// ═════════════════════════════════════════════════════════════════════
//  20–23 — Coverage arithmetic + locked output shape
// ═════════════════════════════════════════════════════════════════════

test('20. Coverage formula — 3 of 4 verified → 75', () => {
  const cio = {
    publishing: { worksCount: 1, writerCount: 1, writerIPIs: ['IPI_A'], publisherCount: 1 },
    observations: {
      publishingSources: {
        mlc: { availability: 'VERIFIED', details: { worksCount: 1, iswcCount: 0, writerCount: 1 } },
      },
    },
  };
  const pi = assemblePublishingIntelligence({ observations: [] }, cio);
  // mlcRegistration VERIFIED + iswcCoverage NOT_FOUND + writerCredits VERIFIED + publisherInformation VERIFIED
  assert.equal(pi.registeredCount, 3);
  assert.equal(pi.coverage, 75);
});

test('21. UNABLE_TO_CONFIRM never counts toward registeredCount (Board D9)', () => {
  // Mixed: one VERIFIED, others UNABLE_TO_CONFIRM (missing observation)
  const cio = {
    publishing: { worksCount: 1, writerCount: 1, writerIPIs: ['IPI_A'], publisherCount: 1 },
    observations: {
      publishingSources: {
        mlc: { availability: 'AUTH_UNAVAILABLE', details: null },
      },
    },
  };
  const pi = assemblePublishingIntelligence({ observations: [] }, cio);
  assert.equal(pi.registeredCount, 0);
  assert.equal(pi.totalChecked,    4);
  assert.equal(pi.coverage,        0);
});

test('22. Output shape LOCKED v1.0 — exact keys, deep-frozen, NO score field', () => {
  const { pi } = buildScenario();
  assert.deepStrictEqual(Object.keys(pi).sort(),
    ['coverage', 'issues', 'recommendations', 'registeredCount', 'registrations', 'strengths', 'supportedSources', 'totalChecked']);
  assert.deepStrictEqual(Object.keys(pi.registrations).sort(),
    ['iswcCoverage', 'mlcRegistration', 'publisherInformation', 'writerCredits']);
  assert.ok(!('score' in pi), 'score must not exist on Publishing Intelligence (Royaltē Health™ owns scoring — Board D9)');
  assert.ok(Object.isFrozen(pi));
  assert.ok(Object.isFrozen(pi.registrations));
  assert.ok(Object.isFrozen(pi.supportedSources));
});

test('23. supportedSources matches the Phase 5B locked set (Board D1 — MLC only)', () => {
  const { pi } = buildScenario();
  assert.deepStrictEqual(Array.from(pi.supportedSources), ['mlc']);
});

// ═════════════════════════════════════════════════════════════════════
//  24–26 — Determinism / purity / defensive contract
// ═════════════════════════════════════════════════════════════════════

test('24. Determinism — same inputs produce JSON-identical output', () => {
  const { pi: a } = buildScenario();
  const { pi: b } = buildScenario();
  assert.equal(JSON.stringify(a), JSON.stringify(b));
});

test('25. Purity — assembler never mutates inputs', () => {
  const { cio, report } = buildScenario();
  const cioJson = JSON.stringify(cio);
  const repJson = JSON.stringify(report);
  assemblePublishingIntelligence(report, cio);
  assert.equal(JSON.stringify(cio),    cioJson);
  assert.equal(JSON.stringify(report), repJson);
});

test('26. Defensive — null / undefined / garbage never throws', () => {
  for (const inputs of [
    [null, null],
    [undefined, undefined],
    ['string', 42],
    [{ observations: 'not-an-array' }, { publishing: 'not-an-object' }],
  ]) {
    assert.doesNotThrow(() => assemblePublishingIntelligence(inputs[0], inputs[1]));
  }
});

console.log('');
console.log('═════════════════════════════════════════════');
console.log(`  PUBLISHING INTELLIGENCE VERIFIED: ${passed} assertions passed`);
console.log('═════════════════════════════════════════════');
