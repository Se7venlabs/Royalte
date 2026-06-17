// ─────────────────────────────────────────────────────────────────────
//  Royaltē Identity Intelligence™ — deterministic test suite (Phase 3B)
// ─────────────────────────────────────────────────────────────────────
//
//  Covers the Board-locked four-state model (D4, 2026-06-17):
//    ✅ VERIFIED · ⚠ ACTION_REQUIRED · ❌ NOT_FOUND · ⏳ UNABLE_TO_CONFIRM
//
//  Critical regression — AUTH_UNAVAILABLE / ERROR never collapse to
//  NOT_FOUND. The whole executive layer rests on that distinction.
//
//  Convention matches the other Royaltē test suites:
//    - counter + throw on failure, run with `node tests/...`
//    - no framework
// ─────────────────────────────────────────────────────────────────────

import { strict as assert } from 'node:assert';
import {
  assembleIdentityIntelligence,
  IDENTITY_STATE,
  IDENTITY_PROVIDERS,
  IDENTITY_INTELLIGENCE_VERSION,
} from '../api/_lib/identity-intelligence.js';
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

// ─── Fixture helpers ──────────────────────────────────────────────

function platforms({ apple, spotify, youtube } = {}) {
  const out = {};
  if (apple   !== undefined) out.appleMusic = apple;
  if (spotify !== undefined) out.spotify    = spotify;
  if (youtube !== undefined) out.youtube    = youtube;
  return out;
}

function scanPayload({ subject, source, providers = {}, identity = {} } = {}) {
  return {
    scanId:    'scan-test',
    scannedAt: '2026-06-17T00:00:00.000Z',
    source:    source  || { platform: 'apple_music', urlType: 'artist', storefront: 'us' },
    subject:   subject || { artistName: 'Test Artist', artistId: 'apple_999' },
    platforms: platforms(providers),
    catalog:   identity.catalog || undefined,
  };
}

function cioFor(scanArgs, artistName = 'Test Artist') {
  return assembleCio(artistName, { scanPayload: scanPayload(scanArgs) }, OPTS);
}

function reportFor(cio) {
  return runIntelligenceEngine(cio, ALL_RULES);
}

// ═════════════════════════════════════════════════════════════════════
//  1–4 — Per-provider VERIFIED state
// ═════════════════════════════════════════════════════════════════════

test('1.  Apple VERIFIED — availability VERIFIED + artwork present + no provider-scoped observations fire', () => {
  const cio = cioFor({
    providers: {
      apple: {
        availability: 'VERIFIED',
        details: { artistId: 'apple_999', artistUrl: 'https://music.apple.com/us/artist/test/999', artwork: 'https://example.com/art.jpg' },
      },
    },
    source: { platform: 'apple_music', urlType: 'artist', storefront: 'us' },
  });
  // cio.identity.artwork is populated from details.artwork by the assembler
  assert.equal(cio.identity.artwork, 'https://example.com/art.jpg');
  const report = reportFor(cio);
  const out = assembleIdentityIntelligence(report, cio);
  assert.equal(out.providers.apple, IDENTITY_STATE.VERIFIED);
});

test('2.  Spotify VERIFIED — availability VERIFIED, no rules ever promote it to ACTION_REQUIRED', () => {
  const cio = cioFor({
    providers: { spotify: { availability: 'VERIFIED', details: null } },
    source:    { platform: 'spotify', urlType: 'artist' },
  });
  const out = assembleIdentityIntelligence(reportFor(cio), cio);
  assert.equal(out.providers.spotify, IDENTITY_STATE.VERIFIED);
});

test('3.  YouTube VERIFIED — availability VERIFIED + officialChannel present + Content ID verified', () => {
  const cio = cioFor({
    providers: {
      youtube: {
        availability: 'VERIFIED',
        details: { officialChannel: { title: 'Test', channelId: 'UC...' }, contentIdVerified: true, subscriberCount: 100000 },
      },
    },
  });
  const out = assembleIdentityIntelligence(reportFor(cio), cio);
  assert.equal(out.providers.youtube, IDENTITY_STATE.VERIFIED);
});

test('4.  All three VERIFIED — every provider resolves cleanly, no issues, full coverage', () => {
  const cio = cioFor({
    providers: {
      apple:   { availability: 'VERIFIED', details: { artwork: 'https://x/a.jpg' } },
      spotify: { availability: 'VERIFIED', details: null },
      youtube: { availability: 'VERIFIED', details: { officialChannel: { channelId: 'UC' }, contentIdVerified: true } },
    },
  });
  const out = assembleIdentityIntelligence(reportFor(cio), cio);
  assert.equal(out.providers.apple,   IDENTITY_STATE.VERIFIED);
  assert.equal(out.providers.spotify, IDENTITY_STATE.VERIFIED);
  assert.equal(out.providers.youtube, IDENTITY_STATE.VERIFIED);
  assert.equal(out.verifiedProviders, 3);
  assert.equal(out.totalProviders,    3);
  assert.equal(out.coverage,        100);
  assert.equal(out.issues.length, 0);
  assert.equal(out.strengths.length, 3);
});

test('4b. Identity Intelligence MUST NOT expose a `score` field — that belongs to Royaltē Health™', () => {
  const cio = cioFor({
    providers: {
      apple:   { availability: 'VERIFIED', details: { artwork: 'https://x/a.jpg' } },
      spotify: { availability: 'VERIFIED', details: null },
      youtube: { availability: 'NOT_FOUND', details: null },
    },
  });
  const out = assembleIdentityIntelligence(reportFor(cio), cio);
  assert.ok(!('score' in out),
    'score must not exist on Identity Intelligence (Board amendment 2026-06-17)');
});

// ═════════════════════════════════════════════════════════════════════
//  5–9 — ACTION_REQUIRED conditions per provider
// ═════════════════════════════════════════════════════════════════════

test('5.  Apple ACTION_REQUIRED — VERIFIED but artwork missing fires identity.apple.artwork-missing', () => {
  const cio = cioFor({
    providers: {
      apple: { availability: 'VERIFIED', details: { artistId: 'a', artistUrl: 'https://music.apple.com/us/artist/test/1', artwork: null } },
    },
    source: { platform: 'apple_music', urlType: 'artist', storefront: 'us' },
  });
  assert.equal(cio.identity.artwork, null);
  const report = reportFor(cio);
  const fired = report.observations.filter((o) => o.ruleId === 'identity.apple.artwork-missing');
  assert.equal(fired.length, 1, 'identity.apple.artwork-missing should fire');
  const out = assembleIdentityIntelligence(report, cio);
  assert.equal(out.providers.apple, IDENTITY_STATE.ACTION_REQUIRED);
  assert.ok(out.issues.some((i) => i.ruleId === 'identity.apple.artwork-missing'));
  assert.ok(out.recommendations.some((r) => r.ruleId === 'identity.apple.artwork-missing'));
});

test('6.  Spotify never ACTION_REQUIRED — Board D4 forbids inventing Spotify conditions', () => {
  const ruleIds = ALL_RULES.map((r) => r.id);
  for (const id of ruleIds) {
    assert.ok(!id.startsWith('identity.spotify.'),
      `Spotify provider-scoped rule "${id}" must not exist in Phase 3 (Board D4)`);
  }
});

test('7.  YouTube ACTION_REQUIRED — channel exists but is not Official Artist Channel', () => {
  const cio = cioFor({
    providers: {
      youtube: { availability: 'VERIFIED', details: { officialChannel: null, contentIdVerified: false, subscriberCount: 0 } },
    },
  });
  const report = reportFor(cio);
  const fired = report.observations.filter((o) => o.ruleId === 'identity.youtube.no-official-channel');
  assert.equal(fired.length, 1, 'identity.youtube.no-official-channel should fire');
  const out = assembleIdentityIntelligence(report, cio);
  assert.equal(out.providers.youtube, IDENTITY_STATE.ACTION_REQUIRED);
});

test('8.  YouTube ACTION_REQUIRED — Official Artist Channel present but Content ID unverified', () => {
  const cio = cioFor({
    providers: {
      youtube: { availability: 'VERIFIED', details: { officialChannel: { channelId: 'UC' }, contentIdVerified: false, subscriberCount: 1000 } },
    },
  });
  const report = reportFor(cio);
  const fired = report.observations.filter((o) => o.ruleId === 'identity.youtube.content-id-unverified');
  assert.equal(fired.length, 1, 'identity.youtube.content-id-unverified should fire');
  // no-official-channel must NOT also fire (officialChannel present)
  const noChannel = report.observations.filter((o) => o.ruleId === 'identity.youtube.no-official-channel');
  assert.equal(noChannel.length, 0);
  const out = assembleIdentityIntelligence(report, cio);
  assert.equal(out.providers.youtube, IDENTITY_STATE.ACTION_REQUIRED);
});

test('9.  Apple VERIFIED + artwork null + apple availability NOT VERIFIED — artwork rule does NOT fire', () => {
  const cio = cioFor({
    providers: {
      apple: { availability: 'NOT_FOUND', details: null },
    },
    source: { platform: 'spotify', urlType: 'artist' },
  });
  const report = reportFor(cio);
  const fired = report.observations.filter((o) => o.ruleId === 'identity.apple.artwork-missing');
  assert.equal(fired.length, 0, 'artwork-missing must require Apple VERIFIED upstream');
});

// ═════════════════════════════════════════════════════════════════════
//  10–13 — NOT_FOUND state
// ═════════════════════════════════════════════════════════════════════

test('10. Apple NOT_FOUND — availability NOT_FOUND maps directly', () => {
  const cio = cioFor({
    providers: { apple: { availability: 'NOT_FOUND', details: null } },
    source:    { platform: 'spotify', urlType: 'artist' },
  });
  const out = assembleIdentityIntelligence(reportFor(cio), cio);
  assert.equal(out.providers.apple, IDENTITY_STATE.NOT_FOUND);
});

test('11. Spotify NOT_FOUND maps directly', () => {
  const cio = cioFor({
    providers: { spotify: { availability: 'NOT_FOUND', details: null } },
    source:    { platform: 'apple_music', urlType: 'artist', storefront: 'us' },
  });
  const out = assembleIdentityIntelligence(reportFor(cio), cio);
  assert.equal(out.providers.spotify, IDENTITY_STATE.NOT_FOUND);
});

test('12. YouTube NOT_FOUND maps directly', () => {
  const cio = cioFor({
    providers: { youtube: { availability: 'NOT_FOUND', details: null } },
  });
  const out = assembleIdentityIntelligence(reportFor(cio), cio);
  assert.equal(out.providers.youtube, IDENTITY_STATE.NOT_FOUND);
});

test('13. NOT_FOUND emits an issue entry for that provider', () => {
  const cio = cioFor({
    providers: {
      apple:   { availability: 'NOT_FOUND', details: null },
      spotify: { availability: 'VERIFIED', details: null },
      youtube: { availability: 'NOT_FOUND', details: null },
    },
  });
  const out = assembleIdentityIntelligence(reportFor(cio), cio);
  const appleIssue   = out.issues.find((i) => i.provider === 'apple');
  const youtubeIssue = out.issues.find((i) => i.provider === 'youtube');
  assert.ok(appleIssue);
  assert.ok(youtubeIssue);
  assert.ok(/Apple Music presence not confirmed/.test(appleIssue.title));
});

// ═════════════════════════════════════════════════════════════════════
//  14–19 — UNABLE_TO_CONFIRM (constitutional regression)
// ═════════════════════════════════════════════════════════════════════

test('14. CRITICAL: AUTH_UNAVAILABLE → UNABLE_TO_CONFIRM, NEVER NOT_FOUND (apple)', () => {
  const cio = cioFor({
    providers: { apple: { availability: 'AUTH_UNAVAILABLE', details: null } },
    source:    { platform: 'spotify', urlType: 'artist' },
  });
  const out = assembleIdentityIntelligence(reportFor(cio), cio);
  assert.equal(out.providers.apple, IDENTITY_STATE.UNABLE_TO_CONFIRM);
  assert.notEqual(out.providers.apple, IDENTITY_STATE.NOT_FOUND);
});

test('15. CRITICAL: ERROR → UNABLE_TO_CONFIRM, NEVER NOT_FOUND (youtube)', () => {
  const cio = cioFor({
    providers: { youtube: { availability: 'ERROR', details: null } },
  });
  const out = assembleIdentityIntelligence(reportFor(cio), cio);
  assert.equal(out.providers.youtube, IDENTITY_STATE.UNABLE_TO_CONFIRM);
  assert.notEqual(out.providers.youtube, IDENTITY_STATE.NOT_FOUND);
});

test('16. Missing provider observation entry → UNABLE_TO_CONFIRM (apple)', () => {
  const cio = cioFor({
    providers: { spotify: { availability: 'VERIFIED', details: null } },
    source:    { platform: 'spotify', urlType: 'artist' },
  });
  // cio.observations.providers.apple is null
  assert.equal(cio.observations.providers.apple, null);
  const out = assembleIdentityIntelligence(reportFor(cio), cio);
  assert.equal(out.providers.apple, IDENTITY_STATE.UNABLE_TO_CONFIRM);
});

test('17. UNABLE_TO_CONFIRM emits NO issue and NO strength', () => {
  const cio = cioFor({
    providers: { apple: { availability: 'AUTH_UNAVAILABLE', details: null } },
    source:    { platform: 'spotify', urlType: 'artist' },
  });
  const out = assembleIdentityIntelligence(reportFor(cio), cio);
  assert.ok(!out.issues.some((i) => i.provider === 'apple'),
    'UNABLE_TO_CONFIRM must produce no issue (we do not know)');
  assert.ok(!out.strengths.some((s) => s.provider === 'apple'),
    'UNABLE_TO_CONFIRM must produce no strength either');
});

test('18. Garbage availability value → UNABLE_TO_CONFIRM, never NOT_FOUND', () => {
  const cio = cioFor({
    providers: { apple: { availability: 'GARBAGE_VALUE', details: null } },
    source:    { platform: 'spotify', urlType: 'artist' },
  });
  const out = assembleIdentityIntelligence(reportFor(cio), cio);
  assert.equal(out.providers.apple, IDENTITY_STATE.UNABLE_TO_CONFIRM);
});

test('19. All three UNABLE_TO_CONFIRM → coverage 0 (no verified providers)', () => {
  const cio = cioFor({
    providers: {
      apple:   { availability: 'AUTH_UNAVAILABLE', details: null },
      spotify: { availability: 'AUTH_UNAVAILABLE', details: null },
      youtube: { availability: 'AUTH_UNAVAILABLE', details: null },
    },
  });
  const out = assembleIdentityIntelligence(reportFor(cio), cio);
  assert.equal(out.verifiedProviders, 0);
  assert.equal(out.totalProviders,    3);
  assert.equal(out.coverage,          0);
});

// ═════════════════════════════════════════════════════════════════════
//  20–24 — Coverage arithmetic & output shape
//  (Board amendment 2026-06-17 — replaces prior score-formula tests)
// ═════════════════════════════════════════════════════════════════════

test('20. Coverage — 2 VERIFIED of 3 (one NOT_FOUND) → coverage 67 — matches Board example', () => {
  const cio = cioFor({
    providers: {
      apple:   { availability: 'VERIFIED', details: { artwork: 'https://x/a.jpg' } },
      spotify: { availability: 'VERIFIED', details: null },
      youtube: { availability: 'NOT_FOUND', details: null },
    },
  });
  const out = assembleIdentityIntelligence(reportFor(cio), cio);
  assert.equal(out.providers.apple,   IDENTITY_STATE.VERIFIED);
  assert.equal(out.providers.spotify, IDENTITY_STATE.VERIFIED);
  assert.equal(out.providers.youtube, IDENTITY_STATE.NOT_FOUND);
  assert.equal(out.verifiedProviders, 2);
  assert.equal(out.totalProviders,    3);
  assert.equal(out.coverage,         67);
});

test('21. Coverage — UNABLE_TO_CONFIRM counts toward totalProviders, NOT toward verifiedProviders', () => {
  const cio = cioFor({
    providers: {
      apple:   { availability: 'VERIFIED', details: { artwork: 'https://x/a.jpg' } },
      spotify: { availability: 'AUTH_UNAVAILABLE', details: null },
      youtube: { availability: 'VERIFIED', details: { officialChannel: { channelId: 'UC' }, contentIdVerified: true } },
    },
  });
  const out = assembleIdentityIntelligence(reportFor(cio), cio);
  assert.equal(out.providers.spotify,  IDENTITY_STATE.UNABLE_TO_CONFIRM);
  assert.equal(out.verifiedProviders, 2);
  assert.equal(out.totalProviders,    3);
  assert.equal(out.coverage,         67);
});

test('21b. Coverage — ACTION_REQUIRED does NOT count as verified', () => {
  const cio = cioFor({
    providers: {
      apple:   { availability: 'VERIFIED', details: { artwork: null } },  // → ACTION_REQUIRED
      spotify: { availability: 'VERIFIED', details: null },
      youtube: { availability: 'VERIFIED', details: { officialChannel: { channelId: 'UC' }, contentIdVerified: true } },
    },
  });
  const out = assembleIdentityIntelligence(reportFor(cio), cio);
  assert.equal(out.providers.apple, IDENTITY_STATE.ACTION_REQUIRED);
  assert.equal(out.verifiedProviders, 2);
  assert.equal(out.coverage,         67);
});

test('22. Output shape — exact keys, NO score field, deep-frozen', () => {
  const cio = cioFor({ providers: { apple: { availability: 'VERIFIED', details: { artwork: 'https://x/a.jpg' } } } });
  const out = assembleIdentityIntelligence(reportFor(cio), cio);
  assert.deepStrictEqual(Object.keys(out).sort(),
    ['coverage', 'issues', 'providers', 'recommendations', 'strengths', 'totalProviders', 'verifiedProviders']);
  assert.deepStrictEqual(Object.keys(out.providers).sort(),
    ['apple', 'spotify', 'youtube']);
  assert.ok(!('score' in out), 'score must not exist (Board amendment 2026-06-17)');
  assert.ok(Object.isFrozen(out));
  assert.ok(Object.isFrozen(out.providers));
  assert.ok(Object.isFrozen(out.strengths));
  assert.ok(Object.isFrozen(out.issues));
  assert.ok(Object.isFrozen(out.recommendations));
});

test('23. Determinism — two consecutive runs produce JSON-identical output', () => {
  const cio = cioFor({
    providers: {
      apple:   { availability: 'VERIFIED', details: { artwork: null } },
      spotify: { availability: 'NOT_FOUND', details: null },
      youtube: { availability: 'AUTH_UNAVAILABLE', details: null },
    },
  });
  const report = reportFor(cio);
  const a = assembleIdentityIntelligence(report, cio);
  const b = assembleIdentityIntelligence(report, cio);
  assert.equal(JSON.stringify(a), JSON.stringify(b));
});

test('24. Purity — assembler never mutates inputs', () => {
  const cio = cioFor({
    providers: { apple: { availability: 'VERIFIED', details: { artwork: 'https://x/a.jpg' } } },
  });
  const report = reportFor(cio);
  const reportJson = JSON.stringify(report);
  const cioJson    = JSON.stringify(cio);
  assembleIdentityIntelligence(report, cio);
  assert.equal(JSON.stringify(report), reportJson, 'report must not mutate');
  assert.equal(JSON.stringify(cio),    cioJson,    'cio must not mutate');
});

// ═════════════════════════════════════════════════════════════════════
//  25–28 — Defensive / never-throws contract
// ═════════════════════════════════════════════════════════════════════

test('25. null inputs do not throw and produce all-UNABLE_TO_CONFIRM, coverage 0', () => {
  const out = assembleIdentityIntelligence(null, null);
  assert.equal(out.providers.apple,   IDENTITY_STATE.UNABLE_TO_CONFIRM);
  assert.equal(out.providers.spotify, IDENTITY_STATE.UNABLE_TO_CONFIRM);
  assert.equal(out.providers.youtube, IDENTITY_STATE.UNABLE_TO_CONFIRM);
  assert.equal(out.verifiedProviders, 0);
  assert.equal(out.totalProviders,    3);
  assert.equal(out.coverage,          0);
});

test('26. undefined inputs do not throw', () => {
  const out = assembleIdentityIntelligence(undefined, undefined);
  assert.ok(out);
  assert.equal(out.providers.apple, IDENTITY_STATE.UNABLE_TO_CONFIRM);
});

test('27. Empty cio + empty report do not throw', () => {
  const out = assembleIdentityIntelligence({ observations: [] }, {});
  assert.ok(out);
  assert.equal(out.providers.apple, IDENTITY_STATE.UNABLE_TO_CONFIRM);
});

test('28. Amazon Music is intentionally absent from the output object (Board D1)', () => {
  const out = assembleIdentityIntelligence(null, null);
  assert.ok(!('amazon' in out.providers),
    'Amazon key must not appear on providers (Phase 3 deferred per Board D1)');
  assert.ok(!('amazonMusic' in out.providers),
    'Amazon key must not appear on providers (Phase 3 deferred per Board D1)');
  assert.ok(!IDENTITY_PROVIDERS.includes('amazon'));
  // totalProviders covers ONLY Phase-3 providers, not unsupported ones
  assert.equal(out.totalProviders, 3,
    'totalProviders must reflect the Phase-3 provider set (3), not include unsupported providers');
});

// ═════════════════════════════════════════════════════════════════════
//  29–30 — Output identity / version
// ═════════════════════════════════════════════════════════════════════

test('29. IDENTITY_INTELLIGENCE_VERSION is exported and is a semver string', () => {
  assert.equal(typeof IDENTITY_INTELLIGENCE_VERSION, 'string');
  assert.ok(/^\d+\.\d+\.\d+$/.test(IDENTITY_INTELLIGENCE_VERSION));
});

test('30. IDENTITY_PROVIDERS export is the canonical phase-3 set, in canonical order', () => {
  assert.deepStrictEqual(Array.from(IDENTITY_PROVIDERS), ['apple', 'spotify', 'youtube']);
});

console.log('');
console.log('═════════════════════════════════════════════');
console.log(`  IDENTITY INTELLIGENCE VERIFIED: ${passed} assertions passed`);
console.log('═════════════════════════════════════════════');
