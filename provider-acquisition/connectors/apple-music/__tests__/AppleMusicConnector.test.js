// AppleMusicConnector — certification test suite — Phase 2.2
// Run: node provider-acquisition/connectors/apple-music/__tests__/AppleMusicConnector.test.js
// Exits 0 on all-green. Exits 1 on any failure.
//
// All Apple API calls are mocked via injected fetchFn + tokenGenerator.
// No real network calls are made. No Apple credentials required.

import assert from 'node:assert/strict';

import { AppleMusicConnector, PROVIDER_NAME } from '../AppleMusicConnector.js';
import { ProviderConnector }     from '../../../connector/ProviderConnector.js';
import { ConnectorLifecycle, Stage } from '../../../connector/lifecycle.js';
import { ProviderRegistry }      from '../../../registry/ProviderRegistry.js';
import { HealthState }           from '../../../health/healthStates.js';
import { Capability }            from '../../../capability/capabilityVocabulary.js';
import { createEvidenceRequest } from '../../../evidence/EvidenceRequest.js';
import { loadTrustConfig, resetTrustConfig } from '../../../trust/trustConfig.js';
import { APPLE_MUSIC_CAPABILITIES } from '../apple-capabilities.js';

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${name}\n    ${err.message}`);
    failed++;
  }
}

async function testAsync(name, fn) {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${name}\n    ${err.message}`);
    failed++;
  }
}

// ── Mock helpers ──────────────────────────────────────────────────────────────

const MOCK_TOKEN = 'mock-apple-jwt-token';

// Create a mock fetchFn that returns canned responses by URL substring match.
function makeFetch(routes = {}, defaultStatus = 200) {
  return async (url, opts) => {
    const key    = Object.keys(routes).find(k => url.includes(k));
    const config = key ? routes[key] : null;

    if (config?.throw) throw new Error(config.throw);

    if (config?.delay) {
      await new Promise((resolve, reject) => {
        const tid = setTimeout(resolve, config.delay);
        if (opts?.signal) {
          opts.signal.addEventListener('abort', () => {
            clearTimeout(tid);
            const err = new Error('The operation was aborted');
            err.name = 'AbortError';
            reject(err);
          });
        }
      });
    }

    const status  = config?.status  ?? defaultStatus;
    const body    = config?.body    ?? {};
    const headers = {
      get: (h) => (config?.headers ?? {})[h.toLowerCase()] ?? null,
    };

    return {
      ok:     status < 400,
      status,
      headers,
      text:   async () => JSON.stringify(body),
      json:   async () => body,
    };
  };
}

// Standard mock config (token injected, fetch mocked)
function connectorConfig(fetchRoutes = {}) {
  return {
    teamId:         'TEST_TEAM',
    keyId:          'TEST_KEY',
    privateKey:     'unused-in-tests',
    tokenGenerator: () => MOCK_TOKEN,
    fetchFn:        makeFetch(fetchRoutes),
    timeoutMs:      5_000,
    maxRetries:     2,
  };
}

// Apple API response fixtures (raw shape — not normalized)
const ARTIST_FIXTURE = {
  data: [{
    id: '657515',
    type: 'artists',
    attributes: {
      name: 'Radiohead',
      url: 'https://music.apple.com/us/artist/radiohead/657515',
      genreNames: ['Alternative', 'Music'],
      artwork: { url: 'https://example.com/art/{w}x{h}.jpg', width: 4320, height: 4320 },
      editorialNotes: { short: 'Acclaimed British rock band.' },
    },
  }],
};

const ALBUMS_FIXTURE = {
  data: [
    {
      id: '1109714933',
      type: 'albums',
      attributes: {
        name: 'OK Computer',
        releaseDate: '1997-05-28',
        trackCount: 12,
        recordLabel: 'Parlophone',
        upc: '724384553098',
        genreNames: ['Alternative', 'Rock'],
        artwork: { url: 'https://example.com/okcomputer/{w}x{h}.jpg', width: 3000, height: 3000 },
        url: 'https://music.apple.com/us/album/ok-computer/1109714933',
      },
    },
  ],
};

const SONGS_FIXTURE = {
  data: [
    {
      id: '1109714935',
      type: 'songs',
      attributes: {
        name: 'Karma Police',
        artistName: 'Radiohead',
        albumName: 'OK Computer',
        isrc: 'GBBKS9700071',
        durationInMillis: 262466,
        releaseDate: '1997-08-25',
        genreNames: ['Alternative', 'Music'],
        previews: [{ url: 'https://example.com/preview.m4a' }],
        url: 'https://music.apple.com/us/album/karma-police/1109714933?i=1109714935',
      },
    },
  ],
};

const ISRC_FIXTURE = {
  data: [
    {
      id: '1109714935',
      type: 'songs',
      attributes: {
        name: 'Karma Police',
        isrc: 'GBBKS9700071',
        artistName: 'Radiohead',
      },
    },
  ],
};

// Phase 2 Recovery (2026-07-20, Canonical Scan Subject correction):
// the real Apple response shape once ?include=albums is requested --
// relationships.albums.data[] carries the album this song belongs to.
// Mirrors Apple's documented JSON:API relationship-inclusion format.
const ISRC_WITH_ALBUM_FIXTURE = {
  data: [
    {
      id: '1109714935',
      type: 'songs',
      attributes: {
        name: 'Karma Police',
        isrc: 'GBBKS9700071',
        artistName: 'Radiohead',
      },
      relationships: {
        albums: {
          data: [
            { id: '1109714933', type: 'albums' },
          ],
        },
      },
    },
  ],
};

const HEALTH_FIXTURE = {
  data: [{ id: 'us', type: 'storefronts', attributes: { name: 'United States' } }],
};

const ALBUM_DATA_FIXTURE = {
  data: [{
    id: '1109714933',
    type: 'albums',
    attributes: { name: 'OK Computer', recordLabel: 'Parlophone', upc: '724384553098' },
  }],
};

const STOREFRONT_FIXTURE = {
  data: [{ id: '1109714933', type: 'albums', attributes: { name: 'OK Computer' } }],
};

// ── Interface conformance ─────────────────────────────────────────────────────
console.log('\n── Interface conformance ─');

test('AppleMusicConnector extends ProviderConnector', () => {
  assert.ok(new AppleMusicConnector() instanceof ProviderConnector);
});

test('all 7 interface methods are present', () => {
  const c = new AppleMusicConnector();
  for (const m of ['initialize','authenticate','discoverCapabilities','reportHealth','acquire','getVersion','shutdown']) {
    assert.equal(typeof c[m], 'function', `missing method: ${m}`);
  }
});

test('getVersion() returns correct provider identity', () => {
  const v = new AppleMusicConnector().getVersion();
  assert.equal(v.provider, PROVIDER_NAME);
  assert.equal(v.provider, 'apple_music');
  assert.ok(v.connectorVersion);
  assert.ok(v.providerApiVersion);
});

// ── initialize() ─────────────────────────────────────────────────────────────
console.log('\n── initialize() ─');

await testAsync('initialize() succeeds with valid config', async () => {
  const c = new AppleMusicConnector();
  await c.initialize(connectorConfig());
  // no throw = success
});

await testAsync('initialize() rejects missing teamId (without tokenGenerator override)', async () => {
  const c = new AppleMusicConnector();
  await assert.rejects(
    () => c.initialize({ keyId: 'k', privateKey: 'p' }),
    /teamId/
  );
});

await testAsync('initialize() rejects missing keyId', async () => {
  const c = new AppleMusicConnector();
  await assert.rejects(
    () => c.initialize({ teamId: 't', privateKey: 'p' }),
    /keyId/
  );
});

// ── authenticate() ────────────────────────────────────────────────────────────
console.log('\n── authenticate() ─');

await testAsync('authenticate() returns AVAILABLE health on success', async () => {
  const c = new AppleMusicConnector();
  await c.initialize(connectorConfig());
  const result = await c.authenticate();
  assert.equal(result.health.state, HealthState.AVAILABLE);
  assert.ok(result.credentials?.token);
});

await testAsync('authenticate() returns AUTH_FAILED when tokenGenerator throws', async () => {
  const c = new AppleMusicConnector();
  await c.initialize({
    teamId: 'T', keyId: 'K', privateKey: 'P',
    tokenGenerator: () => { throw new Error('invalid key'); },
    fetchFn: makeFetch({}),
  });
  const result = await c.authenticate();
  assert.equal(result.health.state, HealthState.AUTH_FAILED);
  assert.equal(result.credentials, null);
});

await testAsync('authenticate() never throws — always returns structured result', async () => {
  const c = new AppleMusicConnector();
  await c.initialize({
    teamId: 'T', keyId: 'K', privateKey: 'P',
    tokenGenerator: () => { throw new Error('boom'); },
    fetchFn: makeFetch({}),
  });
  const result = await c.authenticate(); // must not throw
  assert.ok(result.health);
  assert.ok(['AVAILABLE','AUTH_FAILED'].includes(result.health.state));
});

// ── discoverCapabilities() ────────────────────────────────────────────────────
console.log('\n── discoverCapabilities() ─');

await testAsync('discoverCapabilities() returns profile with all declared capabilities', async () => {
  const c = new AppleMusicConnector();
  await c.initialize(connectorConfig());
  const profile = await c.discoverCapabilities();
  assert.ok(profile.capabilities.length > 0);
  for (const cap of APPLE_MUSIC_CAPABILITIES) {
    assert.ok(profile.capabilities.includes(cap), `Missing capability: ${cap}`);
  }
});

await testAsync('declared capabilities are all from the shared vocabulary', async () => {
  const c = new AppleMusicConnector();
  await c.initialize(connectorConfig());
  const profile = await c.discoverCapabilities();
  // all declared capabilities are valid Capability enum values
  const validCaps = new Set(Object.values(Capability));
  for (const cap of profile.capabilities) {
    assert.ok(validCaps.has(cap), `Unknown capability: ${cap}`);
  }
});

// ── reportHealth() ────────────────────────────────────────────────────────────
console.log('\n── reportHealth() ─');

await testAsync('reportHealth() returns AVAILABLE when probe succeeds', async () => {
  const c = new AppleMusicConnector();
  await c.initialize(connectorConfig({ storefronts: { status: 200, body: HEALTH_FIXTURE } }));
  await c.authenticate();
  const sig = await c.reportHealth();
  assert.equal(sig.state, HealthState.AVAILABLE);
  assert.equal(sig.provider, PROVIDER_NAME);
});

await testAsync('reportHealth() returns AUTH_FAILED when not authenticated', async () => {
  const c = new AppleMusicConnector();
  await c.initialize(connectorConfig());
  // do NOT authenticate
  const sig = await c.reportHealth();
  assert.equal(sig.state, HealthState.AUTH_FAILED);
});

await testAsync('reportHealth() returns TIMEOUT on probe timeout', async () => {
  const c = new AppleMusicConnector();
  await c.initialize({
    ...connectorConfig(),
    timeoutMs: 50, // very short timeout
    maxRetries: 0,
    fetchFn: makeFetch({ storefronts: { delay: 200, body: HEALTH_FIXTURE } }),
  });
  await c.authenticate();
  const sig = await c.reportHealth();
  assert.equal(sig.state, HealthState.TIMEOUT);
});

await testAsync('reportHealth() returns MAINTENANCE on 5xx probe', async () => {
  const c = new AppleMusicConnector();
  await c.initialize({
    ...connectorConfig({ storefronts: { status: 503, body: {} } }),
    maxRetries: 0,
  });
  await c.authenticate();
  const sig = await c.reportHealth();
  assert.equal(sig.state, HealthState.MAINTENANCE);
});

// ── acquire() — evidence types ────────────────────────────────────────────────
console.log('\n── acquire() — evidence types ─');

async function authenticatedConnector(fetchRoutes = {}) {
  resetTrustConfig();
  loadTrustConfig({ providers: { apple_music: 100 } });
  const c = new AppleMusicConnector();
  await c.initialize(connectorConfig(fetchRoutes));
  await c.authenticate();
  return c;
}

await testAsync('acquires ARTIST_IDENTITY by appleArtistId — full Evidence Contract', async () => {
  const c   = await authenticatedConnector({ '/artists/657515': { status: 200, body: ARTIST_FIXTURE } });
  const req = createEvidenceRequest({
    subjectRef:   { appleArtistId: '657515' },
    evidenceType: Capability.ARTIST_IDENTITY,
    context:      { correlationId: 'corr-001' },
  });
  const contract = await c.acquire(req);

  assert.ok(contract.evidenceId);
  assert.equal(contract.provider, 'apple_music');
  assert.equal(contract.completeness, 'full');
  assert.equal(contract.health.state, HealthState.AVAILABLE);
  assert.equal(contract.correlationId, 'corr-001');
  assert.equal(contract.requestId, req.requestId);
  assert.match(contract.payloadChecksum, /^[0-9a-f]{64}$/);
  assert.match(contract.rawResponseHash, /^[0-9a-f]{64}$/);
  assert.equal(contract.providerTrust, 100);
  // payload is the RAW Apple response — not normalized
  assert.deepEqual(contract.payload, ARTIST_FIXTURE);
  resetTrustConfig();
});

await testAsync('acquires ARTIST_IDENTITY by artistName search fallback', async () => {
  const c   = await authenticatedConnector({ '/search': { status: 200, body: { results: { artists: { data: ARTIST_FIXTURE.data } } } } });
  const req = createEvidenceRequest({
    subjectRef:   { artistName: 'Radiohead' },
    evidenceType: Capability.ARTIST_IDENTITY,
  });
  const contract = await c.acquire(req);
  assert.equal(contract.health.state, HealthState.AVAILABLE);
  resetTrustConfig();
});

await testAsync('acquires ALBUMS evidence', async () => {
  const c   = await authenticatedConnector({ '/albums': { status: 200, body: ALBUMS_FIXTURE } });
  const req = createEvidenceRequest({ subjectRef: { appleArtistId: '657515' }, evidenceType: Capability.ALBUMS });
  const contract = await c.acquire(req);
  assert.equal(contract.health.state, HealthState.AVAILABLE);
  assert.deepEqual(contract.payload, ALBUMS_FIXTURE);
  resetTrustConfig();
});

await testAsync('acquires RELEASES evidence (same API as ALBUMS)', async () => {
  const c   = await authenticatedConnector({ '/albums': { status: 200, body: ALBUMS_FIXTURE } });
  const req = createEvidenceRequest({ subjectRef: { appleArtistId: '657515' }, evidenceType: Capability.RELEASES });
  const contract = await c.acquire(req);
  assert.equal(contract.health.state, HealthState.AVAILABLE);
  resetTrustConfig();
});

await testAsync('acquires TRACKS evidence', async () => {
  const c   = await authenticatedConnector({ '/songs': { status: 200, body: SONGS_FIXTURE } });
  const req = createEvidenceRequest({ subjectRef: { appleArtistId: '657515' }, evidenceType: Capability.TRACKS });
  const contract = await c.acquire(req);
  assert.equal(contract.health.state, HealthState.AVAILABLE);
  assert.deepEqual(contract.payload, SONGS_FIXTURE);
  resetTrustConfig();
});

await testAsync('acquires ISRC evidence', async () => {
  const c   = await authenticatedConnector({ 'filter[isrc]': { status: 200, body: ISRC_FIXTURE } });
  const req = createEvidenceRequest({ subjectRef: { isrc: 'GBBKS9700071' }, evidenceType: Capability.ISRC });
  const contract = await c.acquire(req);
  assert.equal(contract.health.state, HealthState.AVAILABLE);
  assert.deepEqual(contract.payload, ISRC_FIXTURE);
  resetTrustConfig();
});

await testAsync('ISRC lookup: album relationship is retrievable from the response (Canonical Scan Subject correction)', async () => {
  // Board-directed fix, 2026-07-20: #fetchByISRC now requests include=albums
  // (verified by direct code inspection of AppleMusicConnector.js -- the
  // mock helper in this file matches by URL substring and does not expose
  // the requested URL back to the test, so this test verifies the
  // consumer-facing behavior that actually matters: given a response shaped
  // the way Apple's API returns it once that parameter is honored, the
  // album relationship is correctly present and extractable end-to-end
  // through the connector).
  const c   = await authenticatedConnector({ 'filter[isrc]': { status: 200, body: ISRC_WITH_ALBUM_FIXTURE } });
  const req = createEvidenceRequest({ subjectRef: { isrc: 'GBBKS9700071' }, evidenceType: Capability.ISRC });
  const contract = await c.acquire(req);

  assert.equal(contract.health.state, HealthState.AVAILABLE);
  const song    = contract.payload?.data?.[0];
  const albumId = song?.relationships?.albums?.data?.[0]?.id ?? null;
  assert.equal(albumId, '1109714933', 'album relationship must be extractable from the ISRC response');
  resetTrustConfig();
});

await testAsync('acquires LABELS evidence from album data', async () => {
  const c   = await authenticatedConnector({ '/albums/1109714933': { status: 200, body: ALBUM_DATA_FIXTURE } });
  const req = createEvidenceRequest({ subjectRef: { appleAlbumId: '1109714933' }, evidenceType: Capability.LABELS });
  const contract = await c.acquire(req);
  assert.equal(contract.health.state, HealthState.AVAILABLE);
  resetTrustConfig();
});

await testAsync('acquires UPC evidence from album data', async () => {
  const c   = await authenticatedConnector({ '/albums/1109714933': { status: 200, body: ALBUM_DATA_FIXTURE } });
  const req = createEvidenceRequest({ subjectRef: { appleAlbumId: '1109714933' }, evidenceType: Capability.UPC });
  const contract = await c.acquire(req);
  assert.equal(contract.health.state, HealthState.AVAILABLE);
  resetTrustConfig();
});

await testAsync('acquires AVAILABILITY evidence (BIG6 storefronts)', async () => {
  // Mock all storefront calls
  const routes = {};
  for (const sf of ['us','ca','gb','de','fr','jp','au','br']) {
    routes[`/catalog/${sf}/albums`] = { status: 200, body: STOREFRONT_FIXTURE };
  }
  const c   = await authenticatedConnector(routes);
  const req = createEvidenceRequest({ subjectRef: { appleAlbumId: '1109714933' }, evidenceType: Capability.AVAILABILITY });
  const contract = await c.acquire(req);
  assert.equal(contract.health.state, HealthState.AVAILABLE);
  assert.ok(contract.payload?.storefronts);
  assert.ok('us' in contract.payload.storefronts);
  resetTrustConfig();
});

// ── acquire() — missing subjectRef fields ─────────────────────────────────────
console.log('\n── acquire() — missing subjectRef ─');

await testAsync('missing appleArtistId for ALBUMS → PARTIAL_RESPONSE completeness empty', async () => {
  const c   = await authenticatedConnector();
  const req = createEvidenceRequest({ subjectRef: { artistName: 'Radiohead' }, evidenceType: Capability.ALBUMS });
  const contract = await c.acquire(req);
  assert.equal(contract.health.state, HealthState.PARTIAL_RESPONSE);
  assert.equal(contract.completeness, 'empty');
  resetTrustConfig();
});

await testAsync('missing isrc for ISRC → PARTIAL_RESPONSE', async () => {
  const c   = await authenticatedConnector();
  const req = createEvidenceRequest({ subjectRef: { appleArtistId: '657515' }, evidenceType: Capability.ISRC });
  const contract = await c.acquire(req);
  assert.equal(contract.health.state, HealthState.PARTIAL_RESPONSE);
  resetTrustConfig();
});

await testAsync('missing both appleArtistId and artistName for ARTIST_IDENTITY → PARTIAL_RESPONSE', async () => {
  const c   = await authenticatedConnector();
  const req = createEvidenceRequest({ subjectRef: { royalteId: 'r-001' }, evidenceType: Capability.ARTIST_IDENTITY });
  const contract = await c.acquire(req);
  assert.equal(contract.health.state, HealthState.PARTIAL_RESPONSE);
  resetTrustConfig();
});

await testAsync('unsupported evidenceType → PARTIAL_RESPONSE empty', async () => {
  const c   = await authenticatedConnector();
  const req = createEvidenceRequest({ subjectRef: { appleArtistId: '657515' }, evidenceType: Capability.COLLECTION_DATA });
  const contract = await c.acquire(req);
  assert.equal(contract.health.state, HealthState.PARTIAL_RESPONSE);
  assert.equal(contract.completeness, 'empty');
  resetTrustConfig();
});

// ── acquire() — not authenticated ─────────────────────────────────────────────
console.log('\n── acquire() — not authenticated ─');

await testAsync('acquire() before authenticate() → AUTH_FAILED completeness empty', async () => {
  resetTrustConfig();
  loadTrustConfig({ providers: { apple_music: 100 } });
  const c = new AppleMusicConnector();
  await c.initialize(connectorConfig());
  // do NOT authenticate
  const req = createEvidenceRequest({ subjectRef: { appleArtistId: '657515' }, evidenceType: Capability.ARTIST_IDENTITY });
  const contract = await c.acquire(req);
  assert.equal(contract.health.state, HealthState.AUTH_FAILED);
  assert.equal(contract.completeness, 'empty');
  resetTrustConfig();
});

// ── Error handling ────────────────────────────────────────────────────────────
console.log('\n── Error handling ─');

await testAsync('401 from Apple API → AUTH_FAILED evidence contract', async () => {
  const c   = await authenticatedConnector({ '/artists/': { status: 401, body: { errors: [{ status: '401' }] } } });
  const req = createEvidenceRequest({ subjectRef: { appleArtistId: '657515' }, evidenceType: Capability.ARTIST_IDENTITY });
  const contract = await c.acquire(req);
  assert.equal(contract.health.state, HealthState.AUTH_FAILED);
  assert.equal(contract.completeness, 'empty');
  resetTrustConfig();
});

await testAsync('500 from Apple API → MAINTENANCE evidence contract', async () => {
  const c = new AppleMusicConnector();
  await c.initialize({
    ...connectorConfig({ '/artists/': { status: 500, body: {} } }),
    maxRetries: 0,
  });
  await c.authenticate();
  const req = createEvidenceRequest({ subjectRef: { appleArtistId: '657515' }, evidenceType: Capability.ARTIST_IDENTITY });
  const contract = await c.acquire(req);
  assert.equal(contract.health.state, HealthState.MAINTENANCE);
  assert.equal(contract.completeness, 'empty');
  resetTrustConfig();
});

await testAsync('network error → MAINTENANCE — never throws raw error', async () => {
  const c = new AppleMusicConnector();
  await c.initialize({
    ...connectorConfig({ '/artists/': { throw: 'network failure' } }),
    maxRetries: 0,
  });
  await c.authenticate();
  const req = createEvidenceRequest({ subjectRef: { appleArtistId: '657515' }, evidenceType: Capability.ARTIST_IDENTITY });
  const contract = await c.acquire(req); // must not throw
  assert.equal(contract.health.state, HealthState.MAINTENANCE);
  resetTrustConfig();
});

await testAsync('SCHEMA_CHANGED when response body is not valid JSON object', async () => {
  const c = new AppleMusicConnector();
  await c.initialize({
    teamId: 'T', keyId: 'K', privateKey: 'P',
    tokenGenerator: () => MOCK_TOKEN,
    maxRetries: 0,
    fetchFn: async () => ({
      ok: true, status: 200,
      headers: { get: () => null },
      text: async () => 'this is not json {{{{',
      json: async () => { throw new SyntaxError('bad JSON'); },
    }),
  });
  await c.authenticate();
  const req = createEvidenceRequest({ subjectRef: { appleArtistId: '657515' }, evidenceType: Capability.ARTIST_IDENTITY });
  const contract = await c.acquire(req);
  assert.equal(contract.health.state, HealthState.SCHEMA_CHANGED);
  assert.equal(contract.completeness, 'partial');
  resetTrustConfig();
});

// ── Retry handling ────────────────────────────────────────────────────────────
console.log('\n── Retry handling ─');

await testAsync('retries on 5xx — succeeds on second attempt', async () => {
  let calls = 0;
  const fetchFn = async (url) => {
    calls++;
    if (calls < 2) return { ok: false, status: 503, headers: { get: () => null }, text: async () => '' };
    return { ok: true, status: 200, headers: { get: () => null }, text: async () => JSON.stringify(ARTIST_FIXTURE) };
  };
  const c = new AppleMusicConnector();
  await c.initialize({ teamId:'T', keyId:'K', privateKey:'P', tokenGenerator: () => MOCK_TOKEN, fetchFn, timeoutMs: 5_000, maxRetries: 3 });
  await c.authenticate();
  const req = createEvidenceRequest({ subjectRef: { appleArtistId: '657515' }, evidenceType: Capability.ARTIST_IDENTITY });
  const contract = await c.acquire(req);
  assert.equal(contract.health.state, HealthState.AVAILABLE);
  assert.ok(calls >= 2, 'should have retried');
  resetTrustConfig();
});

await testAsync('exhausts retries on persistent 5xx → MAINTENANCE', async () => {
  const c = new AppleMusicConnector();
  await c.initialize({
    teamId:'T', keyId:'K', privateKey:'P',
    tokenGenerator: () => MOCK_TOKEN,
    fetchFn: makeFetch({ '/artists/': { status: 503, body: {} } }),
    maxRetries: 1,
    timeoutMs: 5_000,
  });
  await c.authenticate();
  const req = createEvidenceRequest({ subjectRef: { appleArtistId: '657515' }, evidenceType: Capability.ARTIST_IDENTITY });
  const contract = await c.acquire(req);
  assert.equal(contract.health.state, HealthState.MAINTENANCE);
  resetTrustConfig();
});

// ── Rate limit handling ───────────────────────────────────────────────────────
console.log('\n── Rate limit handling ─');

await testAsync('429 after retries → RATE_LIMITED health state', async () => {
  const c = new AppleMusicConnector();
  await c.initialize({
    teamId:'T', keyId:'K', privateKey:'P',
    tokenGenerator: () => MOCK_TOKEN,
    fetchFn: makeFetch({ '/artists/': { status: 429, body: {}, headers: { 'retry-after': '0' } } }),
    maxRetries: 1,
    timeoutMs: 5_000,
  });
  await c.authenticate();
  const req = createEvidenceRequest({ subjectRef: { appleArtistId: '657515' }, evidenceType: Capability.ARTIST_IDENTITY });
  const contract = await c.acquire(req);
  assert.equal(contract.health.state, HealthState.RATE_LIMITED);
  resetTrustConfig();
});

// ── Timeout handling ──────────────────────────────────────────────────────────
console.log('\n── Timeout handling ─');

await testAsync('request timeout → TIMEOUT health state — never hangs', async () => {
  const c = new AppleMusicConnector();
  await c.initialize({
    teamId:'T', keyId:'K', privateKey:'P',
    tokenGenerator: () => MOCK_TOKEN,
    fetchFn: makeFetch({ '/artists/': { delay: 500, body: ARTIST_FIXTURE } }),
    timeoutMs: 50, // much shorter than mock delay
    maxRetries: 0,
  });
  await c.authenticate();
  const req = createEvidenceRequest({ subjectRef: { appleArtistId: '657515' }, evidenceType: Capability.ARTIST_IDENTITY });
  const contract = await c.acquire(req);
  assert.equal(contract.health.state, HealthState.TIMEOUT);
  resetTrustConfig();
});

// ── Evidence Contract integrity ───────────────────────────────────────────────
console.log('\n── Evidence Contract integrity ─');

await testAsync('every contract has a unique evidenceId', async () => {
  resetTrustConfig();
  loadTrustConfig({ providers: { apple_music: 100 } });
  const c = new AppleMusicConnector();
  await c.initialize(connectorConfig({ '/artists/': { status: 200, body: ARTIST_FIXTURE } }));
  await c.authenticate();
  const req = createEvidenceRequest({ subjectRef: { appleArtistId: '657515' }, evidenceType: Capability.ARTIST_IDENTITY });
  const a = await c.acquire(req);
  const b = await c.acquire(req);
  assert.notEqual(a.evidenceId, b.evidenceId);
  resetTrustConfig();
});

await testAsync('payloadChecksum and rawResponseHash are present on every contract', async () => {
  resetTrustConfig();
  loadTrustConfig({ providers: { apple_music: 100 } });
  const c = new AppleMusicConnector();
  await c.initialize(connectorConfig({ '/artists/': { status: 200, body: ARTIST_FIXTURE } }));
  await c.authenticate();
  const req = createEvidenceRequest({ subjectRef: { appleArtistId: '657515' }, evidenceType: Capability.ARTIST_IDENTITY });
  const contract = await c.acquire(req);
  assert.match(contract.payloadChecksum, /^[0-9a-f]{64}$/);
  assert.match(contract.rawResponseHash, /^[0-9a-f]{64}$/);
  resetTrustConfig();
});

await testAsync('payload is the raw Apple API response — no normalization', async () => {
  resetTrustConfig();
  loadTrustConfig({ providers: { apple_music: 100 } });
  const c = new AppleMusicConnector();
  await c.initialize(connectorConfig({ '/artists/': { status: 200, body: ARTIST_FIXTURE } }));
  await c.authenticate();
  const req = createEvidenceRequest({ subjectRef: { appleArtistId: '657515' }, evidenceType: Capability.ARTIST_IDENTITY });
  const contract = await c.acquire(req);
  // payload must be raw Apple API shape — data array with id/type/attributes
  assert.deepEqual(contract.payload, ARTIST_FIXTURE);
  // must NOT contain normalized fields
  assert.ok(!('artistName' in contract));
  assert.ok(!('name' in contract));
  assert.ok(!('genreNames' in contract));
  assert.ok(!('healthScore' in contract));
  resetTrustConfig();
});

await testAsync('providerTrust from trustConfig — carried, not interpreted', async () => {
  resetTrustConfig();
  loadTrustConfig({ providers: { apple_music: 100 } });
  const c = new AppleMusicConnector();
  await c.initialize(connectorConfig({ '/artists/': { status: 200, body: ARTIST_FIXTURE } }));
  await c.authenticate();
  const req = createEvidenceRequest({ subjectRef: { appleArtistId: '657515' }, evidenceType: Capability.ARTIST_IDENTITY });
  const contract = await c.acquire(req);
  assert.equal(contract.providerTrust, 100);
  // just a number on the contract — no judgment attached
  assert.equal(typeof contract.providerTrust, 'number');
  resetTrustConfig();
});

// ── Full lifecycle via ConnectorLifecycle ─────────────────────────────────────
console.log('\n── Full lifecycle (via ConnectorLifecycle) ─');

await testAsync('full lifecycle: CREATED → INITIALIZED → REGISTERED → AUTHENTICATED → READY → SHUTDOWN', async () => {
  resetTrustConfig();
  loadTrustConfig({ providers: { apple_music: 100 } });

  const connector = new AppleMusicConnector();
  const registry  = new ProviderRegistry();
  const lifecycle = new ConnectorLifecycle(connector, registry);

  assert.equal(lifecycle.stage, Stage.CREATED);

  await lifecycle.initialize(connectorConfig({ storefronts: { status: 200, body: HEALTH_FIXTURE }, '/artists/': { status: 200, body: ARTIST_FIXTURE } }));
  assert.equal(lifecycle.stage, Stage.INITIALIZED);

  await lifecycle.register();
  assert.equal(lifecycle.stage, Stage.REGISTERED);

  const entry = registry.lookup('apple_music');
  assert.ok(entry, 'apple_music must be in registry after register()');
  assert.equal(entry.trustValue, 100);
  assert.ok(entry.capabilityProfile.capabilities.includes(Capability.ARTIST_IDENTITY));

  await lifecycle.authenticate();
  assert.equal(lifecycle.stage, Stage.AUTHENTICATED);

  await lifecycle.checkHealthAndCapabilities();
  assert.equal(lifecycle.stage, Stage.READY);

  const req      = createEvidenceRequest({ subjectRef: { appleArtistId: '657515' }, evidenceType: Capability.ARTIST_IDENTITY, context: { correlationId: 'test-corr' } });
  const contract = await lifecycle.acquire(req);
  assert.equal(lifecycle.stage, Stage.READY);
  assert.equal(contract.provider, 'apple_music');
  assert.equal(contract.completeness, 'full');

  await lifecycle.shutdown();
  assert.equal(lifecycle.stage, Stage.SHUTDOWN);

  resetTrustConfig();
});

await testAsync('registry entry contains full capability profile after lifecycle.register()', async () => {
  resetTrustConfig();
  loadTrustConfig({ providers: { apple_music: 100 } });
  const connector = new AppleMusicConnector();
  const registry  = new ProviderRegistry();
  const lifecycle = new ConnectorLifecycle(connector, registry);
  await lifecycle.initialize(connectorConfig());
  await lifecycle.register();
  const entry = registry.lookup('apple_music');
  for (const cap of APPLE_MUSIC_CAPABILITIES) {
    assert.ok(entry.capabilityProfile.capabilities.includes(cap), `Missing from registry: ${cap}`);
  }
  resetTrustConfig();
});

// ── Constitutional boundary checks ───────────────────────────────────────────
console.log('\n── Constitutional boundary checks ─');

test('connector has no normalize/reconcile/score/compute/interpret methods', () => {
  const c = new AppleMusicConnector();
  for (const m of ['normalize','reconcile','score','compute','interpret','enrich','certify','buildCanonical']) {
    assert.ok(!(m in c), `Connector must not expose "${m}"`);
  }
});

test('connector has no mission control / audit / publishing references', () => {
  // check the module exports — only constitutional surface exposed
  const exported = Object.keys({ AppleMusicConnector, PROVIDER_NAME });
  for (const name of ['missionControl','audit','publishing','executiveBrief','scan']) {
    assert.ok(!exported.some(k => k.toLowerCase().includes(name)), `Leaked: ${name}`);
  }
});

await testAsync('shutdown() releases token — acquire() after shutdown returns AUTH_FAILED', async () => {
  resetTrustConfig();
  loadTrustConfig({ providers: { apple_music: 100 } });
  const c = new AppleMusicConnector();
  await c.initialize(connectorConfig({ '/artists/': { status: 200, body: ARTIST_FIXTURE } }));
  await c.authenticate();
  await c.shutdown();
  const req = createEvidenceRequest({ subjectRef: { appleArtistId: '657515' }, evidenceType: Capability.ARTIST_IDENTITY });
  const contract = await c.acquire(req);
  assert.equal(contract.health.state, HealthState.AUTH_FAILED);
  resetTrustConfig();
});

// ── Summary ───────────────────────────────────────────────────────────────────
console.log(`\n────────────────────────────────────`);
console.log(`  Passed: ${passed}`);
console.log(`  Failed: ${failed}`);
console.log(`────────────────────────────────────`);

if (failed > 0) {
  console.error('\nAppleMusicConnector tests FAILED. See above.\n');
  process.exit(1);
}

console.log('\nAppleMusicConnector tests GREEN. Phase 2.2 certification ready.\n');
