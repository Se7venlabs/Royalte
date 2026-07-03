// MusicBrainzConnector — certification test suite — Phase 3.8
// Run: node provider-acquisition/connectors/musicbrainz/__tests__/MusicBrainzConnector.test.js
// Exits 0 on all-green. Exits 1 on any failure.
//
// All MusicBrainz API calls are mocked via injected fetchFn.
// No real network calls are made. No credentials required.

import assert from 'node:assert/strict';

import { MusicBrainzConnector, PROVIDER_NAME, CONNECTOR_VERSION } from '../MusicBrainzConnector.js';
import { ProviderConnector }     from '../../../connector/ProviderConnector.js';
import { HealthState }           from '../../../health/healthStates.js';
import { Capability }            from '../../../capability/capabilityVocabulary.js';
import { createEvidenceRequest } from '../../../evidence/EvidenceRequest.js';
import { loadTrustConfig, resetTrustConfig } from '../../../trust/trustConfig.js';
import { MB_CAPABILITIES }       from '../mb-capabilities.js';

let passed = 0;
let failed = 0;

function test(name, fn) {
  try { fn(); console.log(`  ✓ ${name}`); passed++; }
  catch (err) { console.error(`  ✗ ${name}\n    ${err.message}`); failed++; }
}

async function testAsync(name, fn) {
  try { await fn(); console.log(`  ✓ ${name}`); passed++; }
  catch (err) { console.error(`  ✗ ${name}\n    ${err.message}`); failed++; }
}

// ── Mock helpers ──────────────────────────────────────────────────────────────

const MOCK_ARTIST_PAYLOAD = {
  artists: [{
    id:          'b8a7c3ae-38d7-4489-9cb5-38f44d59f406',
    name:        'Ed Sheeran',
    'sort-name': 'Sheeran, Ed',
    score:       100,
    country:     'GB',
    type:        'Person',
    aliases: [
      { name: 'エド・シーラン', locale: 'ja', type: 'Artist name' },
    ],
    tags: [
      { name: 'pop', count: 25 },
      { name: 'singer-songwriter', count: 10 },
    ],
  }],
};

const MOCK_DIRECT_ARTIST_PAYLOAD = {
  id:          'b8a7c3ae-38d7-4489-9cb5-38f44d59f406',
  name:        'Ed Sheeran',
  'sort-name': 'Sheeran, Ed',
  country:     'GB',
  type:        'Person',
  aliases: [{ name: 'エド・シーラン', locale: 'ja', type: 'Artist name' }],
  tags: [{ name: 'pop', count: 25 }],
};

const MOCK_RECORDINGS_PAYLOAD = {
  recordings: [
    { id: 'rec1', title: 'Shape of You', length: 233713, isrcs: ['GBAHS1600463'] },
    { id: 'rec2', title: 'Perfect',      length: 263400, isrcs: ['GBAHS1700543'] },
  ],
  'recording-count': 2,
  'recording-offset': 0,
};

const MOCK_RELEASE_GROUPS_PAYLOAD = {
  'release-groups': [
    { id: 'rg1', title: '÷', 'primary-type': 'Album', 'secondary-types': [], 'first-release-date': '2017-03-03' },
    { id: 'rg2', title: 'Shape of You', 'primary-type': 'Single', 'secondary-types': [], 'first-release-date': '2017-01-06' },
  ],
  'release-group-count': 2,
  'release-group-offset': 0,
};

const MOCK_ISRC_PAYLOAD = {
  recordings: [
    { id: 'rec1', title: 'Shape of You', length: 233713, isrcs: ['GBAHS1600463'] },
  ],
};

function makeFetch(routes = {}, defaultStatus = 200) {
  return async (url) => {
    const key    = Object.keys(routes).find(k => url.includes(k));
    const config = key ? routes[key] : null;
    const status = config?.status ?? defaultStatus;
    const body   = config?.body   ?? {};
    return {
      ok:   status < 400,
      status,
      headers: { get: () => null },
      text:    async () => JSON.stringify(body),
      json:    async () => body,
    };
  };
}

async function initializedConnector(fetchRoutes = {}) {
  loadTrustConfig({ configVersion: '1.0', providers: { musicbrainz: 80 } });
  const c = new MusicBrainzConnector();
  await c.initialize({
    fetchFn:    makeFetch(fetchRoutes),
    timeoutMs:  5_000,
    maxRetries: 0,
  });
  return c;
}

// ── Group A — static contract ──────────────────────────────────────────────────

console.log('\nA — Static contract');

test('is a ProviderConnector subclass', () => {
  assert.ok(new MusicBrainzConnector() instanceof ProviderConnector);
});

test('PROVIDER_NAME is "musicbrainz"', () => {
  assert.equal(PROVIDER_NAME, 'musicbrainz');
});

test('CONNECTOR_VERSION is "1.0"', () => {
  assert.equal(CONNECTOR_VERSION, '1.0');
});

test('MB_CAPABILITIES includes ARTIST_IDENTITY', () => {
  assert.ok(MB_CAPABILITIES.includes(Capability.ARTIST_IDENTITY));
});

test('MB_CAPABILITIES includes TRACKS', () => {
  assert.ok(MB_CAPABILITIES.includes(Capability.TRACKS));
});

test('MB_CAPABILITIES includes RELEASES', () => {
  assert.ok(MB_CAPABILITIES.includes(Capability.RELEASES));
});

test('MB_CAPABILITIES includes ISRC', () => {
  assert.ok(MB_CAPABILITIES.includes(Capability.ISRC));
});

test('MB_CAPABILITIES is frozen', () => {
  assert.ok(Object.isFrozen(MB_CAPABILITIES));
});

// ── Group B — initialization + authentication ──────────────────────────────────

console.log('\nB — Initialize + authenticate');

await testAsync('initialize with empty config succeeds (no credentials required)', async () => {
  const c = new MusicBrainzConnector();
  await assert.doesNotReject(c.initialize({}));
});

await testAsync('authenticate returns AVAILABLE without network call', async () => {
  const c = await initializedConnector();
  const result = await c.authenticate();
  assert.equal(result.health.state, HealthState.AVAILABLE);
  assert.equal(result.credentials, null);
  resetTrustConfig();
});

await testAsync('authenticate before initialize returns AUTH_FAILED', async () => {
  const c = new MusicBrainzConnector();
  const result = await c.authenticate();
  assert.equal(result.health.state, HealthState.AUTH_FAILED);
});

await testAsync('discoverCapabilities returns MB_CAPABILITIES', async () => {
  const c = await initializedConnector();
  const profile = await c.discoverCapabilities();
  assert.ok(MB_CAPABILITIES.every(cap => profile.capabilities.includes(cap)));
  resetTrustConfig();
});

// ── Group C — ARTIST_IDENTITY acquisition ──────────────────────────────────────

console.log('\nC — ARTIST_IDENTITY acquisition');

await testAsync('ARTIST_IDENTITY by artistName returns contract with payload', async () => {
  const c = await initializedConnector({ '/artist': { body: MOCK_ARTIST_PAYLOAD } });
  const contract = await c.acquire(createEvidenceRequest({
    subjectRef:   { artistName: 'Ed Sheeran' },
    evidenceType: Capability.ARTIST_IDENTITY,
  }));
  assert.equal(contract.provider, PROVIDER_NAME);
  assert.equal(contract.completeness, 'full');
  assert.ok(contract.payload?.artists?.length > 0);
  resetTrustConfig();
});

await testAsync('ARTIST_IDENTITY by MBID uses direct lookup path', async () => {
  const c = await initializedConnector({
    '/artist/b8a7c3ae': { body: MOCK_DIRECT_ARTIST_PAYLOAD },
  });
  const contract = await c.acquire(createEvidenceRequest({
    subjectRef:   { mbid: 'b8a7c3ae-38d7-4489-9cb5-38f44d59f406', artistName: 'Ed Sheeran' },
    evidenceType: Capability.ARTIST_IDENTITY,
  }));
  assert.equal(contract.completeness, 'full');
  assert.equal(contract.payload?.id, 'b8a7c3ae-38d7-4489-9cb5-38f44d59f406');
  resetTrustConfig();
});

await testAsync('ARTIST_IDENTITY missing both artistName and MBID returns empty contract', async () => {
  const c = await initializedConnector();
  const contract = await c.acquire(createEvidenceRequest({
    subjectRef:   {},
    evidenceType: Capability.ARTIST_IDENTITY,
  }));
  assert.equal(contract.completeness, 'empty');
  resetTrustConfig();
});

// ── Group D — TRACKS acquisition ──────────────────────────────────────────────

console.log('\nD — TRACKS (recordings) acquisition');

await testAsync('TRACKS with MBID returns recordings payload', async () => {
  const c = await initializedConnector({ '/recording': { body: MOCK_RECORDINGS_PAYLOAD } });
  const contract = await c.acquire(createEvidenceRequest({
    subjectRef:   { mbid: 'b8a7c3ae-38d7-4489-9cb5-38f44d59f406' },
    evidenceType: Capability.TRACKS,
  }));
  assert.equal(contract.provider, PROVIDER_NAME);
  assert.equal(contract.completeness, 'full');
  assert.ok(Array.isArray(contract.payload?.recordings));
  assert.equal(contract.payload.recordings[0].isrcs[0], 'GBAHS1600463');
  resetTrustConfig();
});

await testAsync('TRACKS without MBID returns empty contract', async () => {
  const c = await initializedConnector();
  const contract = await c.acquire(createEvidenceRequest({
    subjectRef:   { artistName: 'Ed Sheeran' },
    evidenceType: Capability.TRACKS,
  }));
  assert.equal(contract.completeness, 'empty');
  resetTrustConfig();
});

// ── Group E — RELEASES acquisition ────────────────────────────────────────────

console.log('\nE — RELEASES (release groups) acquisition');

await testAsync('RELEASES with MBID returns release-groups payload', async () => {
  const c = await initializedConnector({ '/release-group': { body: MOCK_RELEASE_GROUPS_PAYLOAD } });
  const contract = await c.acquire(createEvidenceRequest({
    subjectRef:   { mbid: 'b8a7c3ae-38d7-4489-9cb5-38f44d59f406' },
    evidenceType: Capability.RELEASES,
  }));
  assert.equal(contract.completeness, 'full');
  const groups = contract.payload?.['release-groups'];
  assert.ok(Array.isArray(groups));
  assert.equal(groups[0].title, '÷');
  resetTrustConfig();
});

await testAsync('RELEASES without MBID returns empty contract', async () => {
  const c = await initializedConnector();
  const contract = await c.acquire(createEvidenceRequest({
    subjectRef:   { artistName: 'Ed Sheeran' },
    evidenceType: Capability.RELEASES,
  }));
  assert.equal(contract.completeness, 'empty');
  resetTrustConfig();
});

// ── Group F — ISRC acquisition ────────────────────────────────────────────────

console.log('\nF — ISRC acquisition');

await testAsync('ISRC lookup returns recording payload', async () => {
  const c = await initializedConnector({ '/recording': { body: MOCK_ISRC_PAYLOAD } });
  const contract = await c.acquire(createEvidenceRequest({
    subjectRef:   { isrc: 'GBAHS1600463' },
    evidenceType: Capability.ISRC,
  }));
  assert.equal(contract.completeness, 'full');
  assert.ok(Array.isArray(contract.payload?.recordings));
  resetTrustConfig();
});

await testAsync('ISRC without isrc returns empty contract', async () => {
  const c = await initializedConnector();
  const contract = await c.acquire(createEvidenceRequest({
    subjectRef:   {},
    evidenceType: Capability.ISRC,
  }));
  assert.equal(contract.completeness, 'empty');
  resetTrustConfig();
});

// ── Group G — Evidence Contract integrity ─────────────────────────────────────

console.log('\nG — Evidence Contract integrity');

await testAsync('contract has required fields', async () => {
  const c = await initializedConnector({ '/artist': { body: MOCK_ARTIST_PAYLOAD } });
  const contract = await c.acquire(createEvidenceRequest({
    subjectRef:   { artistName: 'Ed Sheeran' },
    evidenceType: Capability.ARTIST_IDENTITY,
  }));
  assert.ok(contract.acquisitionId, 'acquisitionId present');
  assert.ok(contract.acquiredAt,    'acquiredAt present');
  assert.ok(contract.payloadChecksum !== undefined, 'payloadChecksum present');
  assert.ok(contract.rawResponseHash !== undefined, 'rawResponseHash present');
  assert.equal(contract.provider, PROVIDER_NAME);
  resetTrustConfig();
});

await testAsync('providerTrust = 80 when configured', async () => {
  const c = await initializedConnector({ '/artist': { body: MOCK_ARTIST_PAYLOAD } });
  const contract = await c.acquire(createEvidenceRequest({
    subjectRef:   { artistName: 'Ed Sheeran' },
    evidenceType: Capability.ARTIST_IDENTITY,
  }));
  assert.equal(contract.providerTrust, 80);
  resetTrustConfig();
});

await testAsync('unsupported evidence type returns empty contract', async () => {
  const c = await initializedConnector();
  const contract = await c.acquire(createEvidenceRequest({
    subjectRef:   { artistName: 'Ed Sheeran' },
    evidenceType: Capability.PUBLISHING,
  }));
  assert.equal(contract.completeness, 'empty');
  assert.equal(contract.provider, PROVIDER_NAME);
  resetTrustConfig();
});

// ── Group H — HTTP error handling ─────────────────────────────────────────────

console.log('\nH — HTTP error handling');

await testAsync('503 rate limit returns empty contract', async () => {
  const c = await initializedConnector({ '/artist': { status: 503, body: {} } });
  const contract = await c.acquire(createEvidenceRequest({
    subjectRef:   { artistName: 'Ed Sheeran' },
    evidenceType: Capability.ARTIST_IDENTITY,
  }));
  assert.equal(contract.completeness, 'empty');
  resetTrustConfig();
});

await testAsync('404 not found returns empty contract', async () => {
  const c = await initializedConnector({ '/artist': { status: 404, body: {} } });
  const contract = await c.acquire(createEvidenceRequest({
    subjectRef:   { artistName: 'Ed Sheeran' },
    evidenceType: Capability.ARTIST_IDENTITY,
  }));
  assert.equal(contract.completeness, 'empty');
  resetTrustConfig();
});

await testAsync('shutdown clears state', async () => {
  const c = await initializedConnector();
  await c.shutdown();
  const contract = await c.acquire(createEvidenceRequest({
    subjectRef:   { artistName: 'Ed Sheeran' },
    evidenceType: Capability.ARTIST_IDENTITY,
  }));
  assert.equal(contract.completeness, 'empty');
});

// ── Summary ───────────────────────────────────────────────────────────────────

console.log(`\n  ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
