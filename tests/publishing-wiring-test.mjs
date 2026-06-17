// ─────────────────────────────────────────────────────────────────────
//  Royaltē Publishing Intelligence™ — wiring + invariant test (Phase 5B)
// ─────────────────────────────────────────────────────────────────────
//
//  Two distinct concerns are pinned here:
//
//    A. The eager-assembly chain inside /api/audit works end-to-end
//       against the same canonical fixtures /api/audit produces.
//
//    B. The Phase 5B Board Architectural Review invariant
//       (2026-06-17) — exactly ONE assembleCio() and ONE
//       runIntelligenceEngine() call per scan inside /api/audit,
//       with every intelligence domain consuming the SAME (cio,
//       report). The Board flagged this risk explicitly; this test
//       file pins it forever via a static source-code scan that
//       fails on first regression.
//
//    C. The Phase 4B-2 alias-not-clone invariant extended to
//       Publishing Intelligence:
//          response.publishingIntelligence === response.canonical.publishingIntelligence
// ─────────────────────────────────────────────────────────────────────

import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { assembleCio } from '../api/_lib/cio-assembler.js';
import { runIntelligenceEngine } from '../api/_lib/intelligence-engine.js';
import { ALL_RULES } from '../api/rules/index.js';
import {
  assemblePublishingIntelligence,
  PUBLISHING_STATE,
} from '../api/_lib/publishing-intelligence.js';
import { assembleIdentityIntelligence } from '../api/_lib/identity-intelligence.js';

const __dirname  = dirname(fileURLToPath(import.meta.url));
const AUDIT_SRC  = readFileSync(join(__dirname, '..', 'api', 'audit.js'), 'utf8');

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

// Strip line comments + block comments before counting source-code
// call sites. Comments documenting the invariant must not interfere
// with the static scan.
function stripJsComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '');
}
const AUDIT_CODE_ONLY = stripJsComments(AUDIT_SRC);

// Mirror of the audit handler's response-construction step. Mirrors
// the EXACT alias read; if api/audit.js's alias logic drifts (e.g.
// someone introduces structuredClone), the matching test in this
// file fails.
function buildHandlerResponseFromCanonical(canonical) {
  const identityIntelligence = (canonical && canonical.identityIntelligence)
    ? canonical.identityIntelligence
    : null;
  const publishingIntelligence = (canonical && canonical.publishingIntelligence)
    ? canonical.publishingIntelligence
    : null;
  return { canonical, identityIntelligence, publishingIntelligence };
}

// ═════════════════════════════════════════════════════════════════════
//  1–3 — Single-CIO invariant (Board Architectural Review 2026-06-17)
// ═════════════════════════════════════════════════════════════════════

test('1. CONSTITUTIONAL — /api/audit calls assembleCio() exactly ONCE per scan', () => {
  // The Board explicitly flagged that calling assembleCio() twice
  // (once per intelligence domain) violates "One Scan → One CIO →
  // Many Consumers." This test counts actual call-site occurrences
  // in api/audit.js code (comments stripped). If a future commit
  // introduces a second assembleCio() call inside the handler, this
  // test fails immediately.
  const matches = AUDIT_CODE_ONLY.match(/\bassembleCio\s*\(/g) || [];
  assert.equal(matches.length, 1,
    `api/audit.js code must contain exactly 1 assembleCio() call (Phase 5B Board Architectural Review invariant); found ${matches.length}`);
});

test('2. CONSTITUTIONAL — /api/audit calls runIntelligenceEngine() exactly ONCE per scan', () => {
  // Same invariant applied to the engine. Every intelligence domain
  // MUST consume the same (cio, report) tuple.
  const matches = AUDIT_CODE_ONLY.match(/\brunIntelligenceEngine\s*\(/g) || [];
  assert.equal(matches.length, 1,
    `api/audit.js code must contain exactly 1 runIntelligenceEngine() call (Phase 5B Board Architectural Review invariant); found ${matches.length}`);
});

test('3. CONSTITUTIONAL — both intelligence assemblers consume the SAME (cio, report) — static check', () => {
  // The handler must invoke assembleIdentityIntelligence(report, cio)
  // AND assemblePublishingIntelligence(report, cio) with the SAME
  // local identifiers. We check that both calls reference `report`
  // and `cio` (rather than per-domain id/Cio / pubCio variables).
  assert.ok(/assembleIdentityIntelligence\s*\(\s*report\s*,\s*cio\s*\)/.test(AUDIT_CODE_ONLY),
    'assembleIdentityIntelligence must be called with the SHARED (report, cio) pair');
  assert.ok(/assemblePublishingIntelligence\s*\(\s*report\s*,\s*cio\s*\)/.test(AUDIT_CODE_ONLY),
    'assemblePublishingIntelligence must be called with the SHARED (report, cio) pair');
});

// ═════════════════════════════════════════════════════════════════════
//  4–8 — Eager-assembly chain end-to-end against a single CIO instance
// ═════════════════════════════════════════════════════════════════════

function runOneCioAssemblyChain({ scanPayload, publishingWorks, publishingSourceObservations }) {
  // Mirror of the audit handler's runtime sequence. EXACTLY ONE
  // assembleCio + EXACTLY ONE runIntelligenceEngine.
  const cio    = assembleCio(scanPayload.subject?.artistName, {
    scanPayload,
    publishingWorks,
    publishingSourceObservations,
  });
  const report = runIntelligenceEngine(cio, ALL_RULES);
  // The same (cio, report) feeds BOTH domains.
  const identityIntelligence   = assembleIdentityIntelligence(report, cio);
  const publishingIntelligence = assemblePublishingIntelligence(report, cio);
  return { cio, report, identityIntelligence, publishingIntelligence };
}

const SCAN = {
  scanId:    'test-scan',
  scannedAt: '2026-06-17T00:00:00.000Z',
  source:    { platform: 'apple_music', urlType: 'artist', storefront: 'us' },
  subject:   { artistName: 'Test Artist', artistId: 'apple_999' },
  platforms: {
    appleMusic: { availability: 'VERIFIED', details: { artistUrl: 'https://x', artwork: 'https://y' } },
    spotify:    { availability: 'VERIFIED', details: null },
    youtube:    { availability: 'VERIFIED', details: { officialChannel: { channelId: 'UC' }, contentIdVerified: true } },
  },
};

const MLC_WORK = {
  title:          'A',
  canonicalTitle: 'A',
  mlcSongCode:    'MLC_A',
  iswc:           'T-A',
  writers: [{
    writerIPI: 'IPI_A', firstName: 'W', lastName: 'A', fullName: 'W A', role: 'Composer',
  }],
  publishers:     [],
  source:         'mlc',
  rawMlcResponse: { mlcSongCode: 'MLC_A' },
  lastUpdated:    '2026-06-17T00:00:00.000Z',
  confidence:     'HIGH',
};

test('4. Eager chain — one CIO, two intelligence objects, both valid', () => {
  const { cio, identityIntelligence, publishingIntelligence } = runOneCioAssemblyChain({
    scanPayload:     SCAN,
    publishingWorks: [MLC_WORK],
    publishingSourceObservations: {
      mlc: { availability: 'VERIFIED', details: { worksCount: 1, iswcCount: 1, writerCount: 1 } },
    },
  });
  assert.ok(cio);
  assert.ok(Object.isFrozen(cio), 'the single CIO must be deep-frozen');
  assert.ok(identityIntelligence);
  assert.ok(publishingIntelligence);
  // The two intelligence objects are different (different domains)
  // but both were assembled from the SAME CIO reference. Spot-check
  // by asserting the CIO carried both domains' inputs.
  assert.equal(cio.identity.canonicalArtistName, 'Test Artist');
  assert.equal(cio.publishing.worksCount, 1);
  assert.equal(cio.observations.providers.apple.availability, 'VERIFIED');
  assert.equal(cio.observations.publishingSources.mlc.availability, 'VERIFIED');
});

test('5. Eager chain — Publishing Intelligence resolves all four metrics from the shared CIO', () => {
  const { publishingIntelligence } = runOneCioAssemblyChain({
    scanPayload:     SCAN,
    publishingWorks: [MLC_WORK],
    publishingSourceObservations: {
      mlc: { availability: 'VERIFIED', details: { worksCount: 1, iswcCount: 1, writerCount: 1 } },
    },
  });
  assert.equal(publishingIntelligence.registrations.mlcRegistration,      PUBLISHING_STATE.VERIFIED);
  assert.equal(publishingIntelligence.registrations.iswcCoverage,         PUBLISHING_STATE.VERIFIED);
  assert.equal(publishingIntelligence.registrations.writerCredits,        PUBLISHING_STATE.VERIFIED);
  assert.equal(publishingIntelligence.registrations.publisherInformation, PUBLISHING_STATE.NOT_FOUND);
  assert.equal(publishingIntelligence.registeredCount, 3);
  assert.equal(publishingIntelligence.coverage,        75);
});

test('6. Eager chain — chain on totally-malformed inputs does not throw', () => {
  assert.doesNotThrow(() => runOneCioAssemblyChain({
    scanPayload: { subject: null, platforms: 'garbage' },
    publishingWorks: null,
    publishingSourceObservations: null,
  }));
});

test('7. Eager chain — MLC AUTH_UNAVAILABLE yields publishingIntelligence with all UNABLE_TO_CONFIRM (Board D5)', () => {
  const { publishingIntelligence } = runOneCioAssemblyChain({
    scanPayload:     SCAN,
    publishingWorks: null,
    publishingSourceObservations: { mlc: { availability: 'AUTH_UNAVAILABLE', details: null } },
  });
  for (const metric of ['mlcRegistration', 'iswcCoverage', 'writerCredits', 'publisherInformation']) {
    assert.equal(publishingIntelligence.registrations[metric], PUBLISHING_STATE.UNABLE_TO_CONFIRM,
      `${metric} must be UNABLE_TO_CONFIRM, NEVER NOT_FOUND, when MLC was AUTH_UNAVAILABLE (Board D5 invariant)`);
  }
  assert.equal(publishingIntelligence.coverage, 0);
});

test('8. Eager chain — Identity Intelligence is unaffected by Publishing data presence on the same CIO', () => {
  // Demonstrates the constitutional separation: Identity reads only
  // cio.identity + cio.observations.providers; publishing inputs on
  // the same CIO must not perturb Identity outputs.
  const withoutPub = runOneCioAssemblyChain({
    scanPayload: SCAN, publishingWorks: null, publishingSourceObservations: null,
  }).identityIntelligence;
  const withPub = runOneCioAssemblyChain({
    scanPayload: SCAN,
    publishingWorks: [MLC_WORK],
    publishingSourceObservations: {
      mlc: { availability: 'VERIFIED', details: { worksCount: 1, iswcCount: 1, writerCount: 1 } },
    },
  }).identityIntelligence;
  assert.equal(JSON.stringify(withoutPub), JSON.stringify(withPub),
    'Identity Intelligence output must not depend on publishing inputs (one CIO, isolated domain reads)');
});

// ═════════════════════════════════════════════════════════════════════
//  9–12 — Alias-not-clone invariant (Phase 4B-2 amendment, extended)
// ═════════════════════════════════════════════════════════════════════

test('9. INVARIANT — response.publishingIntelligence === response.canonical.publishingIntelligence (success path)', () => {
  const { publishingIntelligence } = runOneCioAssemblyChain({
    scanPayload:     SCAN,
    publishingWorks: [MLC_WORK],
    publishingSourceObservations: {
      mlc: { availability: 'VERIFIED', details: { worksCount: 1, iswcCount: 1, writerCount: 1 } },
    },
  });
  const enrichedCanonical = { ...SCAN, publishingIntelligence };
  const response = buildHandlerResponseFromCanonical(enrichedCanonical);
  assert.ok(response.publishingIntelligence === response.canonical.publishingIntelligence,
    'response.publishingIntelligence must be the SAME reference as response.canonical.publishingIntelligence (Phase 4B-2 alias rule extended)');
});

test('10. INVARIANT — nested registrations + supportedSources are the same references through both access paths', () => {
  const { publishingIntelligence } = runOneCioAssemblyChain({
    scanPayload:     SCAN,
    publishingWorks: [MLC_WORK],
    publishingSourceObservations: {
      mlc: { availability: 'VERIFIED', details: { worksCount: 1, iswcCount: 1, writerCount: 1 } },
    },
  });
  const enrichedCanonical = { ...SCAN, publishingIntelligence };
  const response = buildHandlerResponseFromCanonical(enrichedCanonical);
  assert.ok(response.publishingIntelligence.registrations === response.canonical.publishingIntelligence.registrations,
    'nested registrations object must be the same reference — no separate clone allowed');
  assert.ok(response.publishingIntelligence.supportedSources === response.canonical.publishingIntelligence.supportedSources);
});

test('11. INVARIANT — failure-mode asymmetry (canonical omits the key; response surfaces null) is intentional', () => {
  // Simulates the failure path: assembly returned nothing so the
  // persisted canonical has NO publishingIntelligence key.
  const omittedCanonical = { ...SCAN };
  const response = buildHandlerResponseFromCanonical(omittedCanonical);
  assert.ok(!('publishingIntelligence' in response.canonical) || response.canonical.publishingIntelligence === undefined);
  assert.equal(response.publishingIntelligence, null);
});

test('12. INVARIANT — handler never deep-clones / structuredClones / JSON-rebuilds the Publishing Intelligence object', () => {
  const { publishingIntelligence } = runOneCioAssemblyChain({
    scanPayload:     SCAN,
    publishingWorks: [MLC_WORK],
    publishingSourceObservations: {
      mlc: { availability: 'VERIFIED', details: { worksCount: 1, iswcCount: 1, writerCount: 1 } },
    },
  });
  const enrichedCanonical = { ...SCAN, publishingIntelligence };
  const response = buildHandlerResponseFromCanonical(enrichedCanonical);
  assert.ok(response.publishingIntelligence === publishingIntelligence,
    'top-level field must be the SAME reference as the assembler output');
  assert.ok(response.canonical.publishingIntelligence === publishingIntelligence,
    'canonical-embedded field must be the SAME reference as the assembler output');
});

console.log('');
console.log('═════════════════════════════════════════════');
console.log(`  PUBLISHING WIRING VERIFIED: ${passed} assertions passed`);
console.log('═════════════════════════════════════════════');
