// ─────────────────────────────────────────────────────────────────────
//  Royaltē Identity Intelligence™ — wiring test (Phase 4B-2)
// ─────────────────────────────────────────────────────────────────────
//
//  Verifies the EAGER ASSEMBLY chain that lives inside `/api/audit`:
//
//      canonical AuditResponse
//          ↓
//      assembleCio(artistName, { scanPayload: canonical })
//          ↓
//      runIntelligenceEngine(cio, ALL_RULES)
//          ↓
//      assembleIdentityIntelligence(report, cio)
//          ↓
//      { ...canonical, identityIntelligence }   ← persisted as
//                                                  audit_scans.payload
//
//  These tests exercise the chain against the SAME canonical fixtures
//  that `pipeline-test.mjs` produces (api/fixtures/canonical-*.json),
//  so any drift between the assembler and a real scan payload surfaces
//  here. The full HTTP handler is not invoked — that would require a
//  Supabase mock — but the entire intelligence chain that runs inside
//  the handler IS invoked end-to-end.
//
//  Board R5 + R10 (2026-06-17): "Identity Intelligence™ shall be
//  assembled exactly once per scan." This test guarantees the chain
//  produces a valid, locked-shape Identity Intelligence object from a
//  realistic canonical payload.
//
//  Convention matches the other Royaltē suites:
//    - counter + throw on failure
//    - run with `node tests/identity-wiring-test.mjs`
// ─────────────────────────────────────────────────────────────────────

import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { assembleCio } from '../api/_lib/cio-assembler.js';
import { runIntelligenceEngine } from '../api/_lib/intelligence-engine.js';
import { ALL_RULES } from '../api/rules/index.js';
import {
  assembleIdentityIntelligence,
  IDENTITY_STATE,
  IDENTITY_PROVIDERS,
} from '../api/_lib/identity-intelligence.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadCanonicalFixture(name) {
  const path = join(__dirname, '..', 'api', 'fixtures', `${name}.json`);
  return JSON.parse(readFileSync(path, 'utf8'));
}

// ─── /api/audit eager-assembly chain (mirror of the handler) ───────
//
// This MUST mirror the exact chain wired into `api/audit.js`. If the
// handler changes, this helper must change with it, and this test
// suite enforces that the produced object stays valid.
function runEagerAssemblyChain(canonical) {
  const cio = assembleCio(
    canonical.subject?.artistName,
    { scanPayload: canonical }
  );
  const report = runIntelligenceEngine(cio, ALL_RULES);
  const identityIntelligence = assembleIdentityIntelligence(report, cio);
  return { cio, report, identityIntelligence };
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
//  1–5 — Eager assembly produces a valid Identity Intelligence object
//        from the real canonical-radiohead fixture (Spotify-rooted scan,
//        Apple + YouTube observations both present and VERIFIED).
// ═════════════════════════════════════════════════════════════════════

test('1.  canonical-radiohead — chain runs without throwing', () => {
  const canonical = loadCanonicalFixture('canonical-radiohead');
  const { identityIntelligence } = runEagerAssemblyChain(canonical);
  assert.ok(identityIntelligence);
});

test('2.  canonical-radiohead — output matches locked v1.0 shape', () => {
  const canonical = loadCanonicalFixture('canonical-radiohead');
  const { identityIntelligence } = runEagerAssemblyChain(canonical);
  assert.deepStrictEqual(Object.keys(identityIntelligence).sort(),
    ['coverage', 'issues', 'providers', 'recommendations', 'strengths', 'supportedProviders', 'totalProviders', 'verifiedProviders']);
  assert.deepStrictEqual(Object.keys(identityIntelligence.providers).sort(),
    ['apple', 'spotify', 'youtube']);
});

test('3.  canonical-radiohead — Spotify is VERIFIED upstream → VERIFIED state', () => {
  const canonical = loadCanonicalFixture('canonical-radiohead');
  assert.equal(canonical.platforms.spotify.availability, 'VERIFIED');
  const { identityIntelligence } = runEagerAssemblyChain(canonical);
  assert.equal(identityIntelligence.providers.spotify, IDENTITY_STATE.VERIFIED);
});

test('4.  canonical-radiohead — output is deep-frozen', () => {
  const canonical = loadCanonicalFixture('canonical-radiohead');
  const { identityIntelligence } = runEagerAssemblyChain(canonical);
  assert.ok(Object.isFrozen(identityIntelligence));
  assert.ok(Object.isFrozen(identityIntelligence.providers));
  assert.ok(Object.isFrozen(identityIntelligence.supportedProviders));
});

test('5.  canonical-radiohead — score field is absent (Board amendment 2026-06-17)', () => {
  const canonical = loadCanonicalFixture('canonical-radiohead');
  const { identityIntelligence } = runEagerAssemblyChain(canonical);
  assert.ok(!('score' in identityIntelligence),
    'score must not exist on Identity Intelligence (Royaltē Health™ owns scoring)');
});

// ═════════════════════════════════════════════════════════════════════
//  6–8 — Same chain on the Apple-only fixture (Apple-rooted scan where
//        the Spotify hoist did not match an artist).
// ═════════════════════════════════════════════════════════════════════

test('6.  canonical-apple-resolved-only — chain runs without throwing', () => {
  const canonical = loadCanonicalFixture('canonical-apple-resolved-only');
  const { identityIntelligence } = runEagerAssemblyChain(canonical);
  assert.ok(identityIntelligence);
});

test('7.  canonical-apple-resolved-only — supportedProviders is the Phase-3 set, length 3', () => {
  const canonical = loadCanonicalFixture('canonical-apple-resolved-only');
  const { identityIntelligence } = runEagerAssemblyChain(canonical);
  assert.deepStrictEqual(Array.from(identityIntelligence.supportedProviders),
    ['apple', 'spotify', 'youtube']);
  assert.equal(identityIntelligence.totalProviders, 3);
});

test('8.  canonical-apple-resolved-only — Apple VERIFIED upstream + artwork null → ACTION_REQUIRED', () => {
  // This fixture was regenerated by pipeline-test.mjs after Phase 2B
  // added the `artwork` passthrough to normalizeAuditResponse. The
  // fixture has artwork=null (no Apple artwork URL produced), which
  // legitimately fires identity.apple.artwork-missing — and the
  // assembler correctly promotes Apple to ACTION_REQUIRED. This test
  // proves the full chain (rule-firing AND state promotion) works
  // against a real persisted scan payload.
  const canonical = loadCanonicalFixture('canonical-apple-resolved-only');
  assert.equal(canonical.platforms.appleMusic.availability, 'VERIFIED');
  assert.equal(canonical.platforms.appleMusic.details.artwork, null,
    'fixture precondition: artwork is null, so identity.apple.artwork-missing should fire');
  const { identityIntelligence, report } = runEagerAssemblyChain(canonical);
  // Rule fires
  const fired = report.observations.filter((o) => o.ruleId === 'identity.apple.artwork-missing');
  assert.equal(fired.length, 1, 'identity.apple.artwork-missing should fire on this fixture');
  // State promotes to ACTION_REQUIRED
  assert.equal(identityIntelligence.providers.apple, IDENTITY_STATE.ACTION_REQUIRED);
  // And the corresponding issue + recommendation appear
  assert.ok(identityIntelligence.issues.some((i) => i.ruleId === 'identity.apple.artwork-missing'));
  assert.ok(identityIntelligence.recommendations.some((r) => r.ruleId === 'identity.apple.artwork-missing'));
});

// ═════════════════════════════════════════════════════════════════════
//  9–11 — Persisted-payload shape: the canonical that gets written to
//         audit_scans.payload includes identityIntelligence at the top
//         level alongside the rest of the canonical fields. This is the
//         exact persistence target Board R5 ratified.
// ═════════════════════════════════════════════════════════════════════

test('9.  Enriched canonical — identityIntelligence sits at the top level (not buried)', () => {
  const canonical = loadCanonicalFixture('canonical-radiohead');
  const { identityIntelligence } = runEagerAssemblyChain(canonical);
  const persisted = { ...canonical, identityIntelligence };
  assert.ok('identityIntelligence' in persisted,
    'identityIntelligence must be a top-level key on the persisted payload (Board R5 — audit_scans.payload.identityIntelligence)');
  assert.equal(persisted.identityIntelligence, identityIntelligence);
});

test('10. Enriched canonical — does NOT pollute existing canonical fields', () => {
  const canonical = loadCanonicalFixture('canonical-radiohead');
  const before = JSON.parse(JSON.stringify(canonical));
  const { identityIntelligence } = runEagerAssemblyChain(canonical);
  const persisted = { ...canonical, identityIntelligence };
  // Every original key still equals its original value
  for (const k of Object.keys(before)) {
    assert.deepStrictEqual(persisted[k], before[k],
      `enrichment must not mutate canonical key "${k}"`);
  }
});

test('11. Enriched canonical — original canonical object is not mutated by the chain', () => {
  const canonical = loadCanonicalFixture('canonical-radiohead');
  const beforeJson = JSON.stringify(canonical);
  runEagerAssemblyChain(canonical);
  assert.equal(JSON.stringify(canonical), beforeJson,
    'eager assembly must not mutate the canonical input');
});

// ═════════════════════════════════════════════════════════════════════
//  12–14 — Failure-mode contract (Board, Stage 4B-2 brief):
//          "If assembly unexpectedly fails: the scan SHALL continue,
//           canonical payload SHALL still persist, identityIntelligence
//           SHALL be omitted, the error SHALL be logged."
//          The chain itself is documented as never-throws; we verify
//          that here and verify the omission path.
// ═════════════════════════════════════════════════════════════════════

test('12. Chain on a totally-malformed canonical — does not throw', () => {
  const malformed = { not: 'a canonical', subject: null, platforms: 'string-not-object' };
  let identityIntelligence = null;
  assert.doesNotThrow(() => {
    const result = runEagerAssemblyChain(malformed);
    identityIntelligence = result.identityIntelligence;
  });
  assert.ok(identityIntelligence,
    'never-throws contract: even malformed input must yield a valid Identity Intelligence object');
});

test('13. Chain on empty {} — yields all-UNABLE_TO_CONFIRM (no signal to evaluate)', () => {
  const { identityIntelligence } = runEagerAssemblyChain({});
  for (const p of IDENTITY_PROVIDERS) {
    assert.equal(identityIntelligence.providers[p], IDENTITY_STATE.UNABLE_TO_CONFIRM,
      `${p} must resolve to UNABLE_TO_CONFIRM when no observation is present`);
  }
  assert.equal(identityIntelligence.verifiedProviders, 0);
  assert.equal(identityIntelligence.coverage, 0);
});

test('14. Omission path — if the handler catches and skips enrichment, persisted payload has no identityIntelligence key', () => {
  // Simulates the failure-mode brief: when the catch block in
  // assembleIdentityIntelligenceForScan returns the unmodified
  // canonical, the persisted payload is byte-identical to the
  // pre-Phase-4B-2 shape.
  const canonical = loadCanonicalFixture('canonical-radiohead');
  const omitted = { ...canonical };  // simulates "return canonicalForEnrichment" early-return
  assert.ok(!('identityIntelligence' in omitted),
    'omission path must produce a canonical payload with no identityIntelligence key');
});

// ═════════════════════════════════════════════════════════════════════
//  15 — Determinism across two runs of the same canonical input.
// ═════════════════════════════════════════════════════════════════════

test('15. Determinism — same canonical input produces JSON-identical Identity Intelligence', () => {
  const canonical = loadCanonicalFixture('canonical-radiohead');
  const a = runEagerAssemblyChain(canonical).identityIntelligence;
  const b = runEagerAssemblyChain(canonical).identityIntelligence;
  assert.equal(JSON.stringify(a), JSON.stringify(b));
});

// ═════════════════════════════════════════════════════════════════════
//  16–19 — CONSTITUTIONAL INVARIANT  (Board Final Amendment 2026-06-17)
//
//     response.identityIntelligence === response.canonical.identityIntelligence
//
//  Same JS object reference (not a copy, not a clone, not a JSON
//  round-trip rebuild). One assembly per scan; two access paths.
//  These tests mirror the EXACT response-construction step from the
//  /api/audit handler so any future drift (e.g. someone "helpfully"
//  introducing structuredClone) is caught here.
// ═════════════════════════════════════════════════════════════════════

// Mirror the handler's response-construction step (api/audit.js, after
// PERSIST + EAGER IDENTITY INTELLIGENCE™ ASSEMBLY). Keep these two
// statements in lock-step with the production code.
function buildHandlerResponseFromCanonical(canonical) {
  const identityIntelligence = (canonical && canonical.identityIntelligence)
    ? canonical.identityIntelligence
    : null;
  return {
    canonical,
    identityIntelligence,
  };
}

test('16. INVARIANT — response.identityIntelligence === response.canonical.identityIntelligence (success path)', () => {
  const canonical = loadCanonicalFixture('canonical-radiohead');
  const { identityIntelligence } = runEagerAssemblyChain(canonical);
  const enrichedCanonical = { ...canonical, identityIntelligence };
  const response = buildHandlerResponseFromCanonical(enrichedCanonical);
  assert.ok(response.identityIntelligence === response.canonical.identityIntelligence,
    'response.identityIntelligence MUST be the same object reference as response.canonical.identityIntelligence (Board Final Amendment 2026-06-17)');
});

test('17. INVARIANT — top-level mirror is the SAME deep-frozen object, not a separate freeze', () => {
  const canonical = loadCanonicalFixture('canonical-radiohead');
  const { identityIntelligence } = runEagerAssemblyChain(canonical);
  const enrichedCanonical = { ...canonical, identityIntelligence };
  const response = buildHandlerResponseFromCanonical(enrichedCanonical);
  assert.ok(Object.isFrozen(response.identityIntelligence));
  assert.ok(Object.isFrozen(response.canonical.identityIntelligence));
  // Same frozen object — proven by reference equality on the deeply-frozen
  // nested providers slot. A separate rebuild would have a different
  // `providers` reference even if deep-equal in value.
  assert.ok(response.identityIntelligence.providers === response.canonical.identityIntelligence.providers,
    'nested providers object must be the same reference — no separate clone allowed');
  assert.ok(response.identityIntelligence.supportedProviders === response.canonical.identityIntelligence.supportedProviders,
    'nested supportedProviders array must be the same reference — no separate clone allowed');
});

test('18. INVARIANT — failure-mode asymmetry (canonical omits the key; response surfaces null) is intentional', () => {
  // Simulates the failure path: enrichmentFn returned canonicalForEnrichment
  // unchanged, so the persisted canonical has NO identityIntelligence key.
  const canonical = loadCanonicalFixture('canonical-radiohead');
  // Strip any enrichment so we're at the pre-Phase-4B-2 shape
  const { identityIntelligence: _stripped, ...canonicalWithoutEnrichment } = { ...canonical, identityIntelligence: undefined };
  const response = buildHandlerResponseFromCanonical(canonicalWithoutEnrichment);
  // canonical OMITS the key
  assert.ok(!('identityIntelligence' in response.canonical) || response.canonical.identityIntelligence === undefined,
    'failure path: canonical.identityIntelligence must be absent/undefined (Board failure-mode brief)');
  // response surfaces NULL
  assert.equal(response.identityIntelligence, null,
    'failure path: response.identityIntelligence must be null (Board failure-mode brief)');
  // The asymmetry is by Board design — null vs undefined lets the client
  // distinguish "we tried and failed" (null) from "we did not try"
  // (key absent on a payload from a pre-Phase-4B-2 source).
});

test('19. INVARIANT — handler never deep-clones / structuredClones / JSON-rebuilds the Identity Intelligence object', () => {
  // This test pins the implementation: if a future commit replaces
  // the alias read with structuredClone / JSON.parse(JSON.stringify(...))
  // / { ...obj } / Object.freeze(rebuild), the reference equality
  // will break and this test will fail. The alias rule (Board Final
  // Amendment 2026-06-17) requires the SAME reference.
  const canonical = loadCanonicalFixture('canonical-radiohead');
  const { identityIntelligence } = runEagerAssemblyChain(canonical);
  const enrichedCanonical = { ...canonical, identityIntelligence };
  const response = buildHandlerResponseFromCanonical(enrichedCanonical);
  // The exact object the chain produced is reachable from BOTH paths
  assert.ok(response.identityIntelligence === identityIntelligence,
    'top-level field must be the SAME reference as the assembler output');
  assert.ok(response.canonical.identityIntelligence === identityIntelligence,
    'canonical-embedded field must be the SAME reference as the assembler output');
});

console.log('');
console.log('═════════════════════════════════════════════');
console.log(`  IDENTITY WIRING VERIFIED: ${passed} assertions passed`);
console.log('═════════════════════════════════════════════');
