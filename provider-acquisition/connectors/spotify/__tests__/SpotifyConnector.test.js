// SpotifyConnector — certification test suite — Phase 3.6
// Run: node provider-acquisition/connectors/spotify/__tests__/SpotifyConnector.test.js
// Exits 0 on all-green. Exits 1 on any failure.
//
// All Spotify API calls are mocked via injected fetchFn + tokenGenerator.
// No real network calls are made. No Spotify credentials required.

import assert from 'node:assert/strict';

import { SpotifyConnector, PROVIDER_NAME } from '../SpotifyConnector.js';
import { ProviderConnector }     from '../../../connector/ProviderConnector.js';
import { HealthState }           from '../../../health/healthStates.js';
import { Capability }            from '../../../capability/capabilityVocabulary.js';
import { createEvidenceRequest } from '../../../evidence/EvidenceRequest.js';
import { loadTrustConfig, resetTrustConfig } from '../../../trust/trustConfig.js';
import { SPOTIFY_CAPABILITIES }  from '../spotify-capabilities.js';

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

const MOCK_TOKEN = 'mock-spotify-access-token';

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

// ── Mock response fixtures ───────────────────────────────────────────────────

const MOCK_ARTIST_PAYLOAD = {
  id:            '6eUKZXaKkcviH0Ku9w2n3V',
  name:          'Ed Sheeran',
  type:          'artist',
  genres:        ['pop', 'uk pop'],
  images:        [{ url: 'https://i.scdn.co/image/abc.jpg', height: 640, width: 640 }],
  followers:     { href: null, total: 112899504 },
  popularity:    91,
  external_urls: { spotify: 'https://open.spotify.com/artist/6eUKZXaKkcviH0Ku9w2n3V' },
};

const MOCK_ALBUMS_PAYLOAD = {
  href:     'https://api.spotify.com/v1/artists/6eUKZXaKkcviH0Ku9w2n3V/albums',
  items:    [
    {
      id:           '4czdORdCWP9umpbhFXK2fW',
      name:         'Subtract',
      album_type:   'album',
      release_date: '2023-05-05',
      total_tracks: 16,
      images:       [{ url: 'https://i.scdn.co/image/subtract.jpg', height: 640, width: 640 }],
    },
    {
      id:           '3T4tUhGYeRNVUGevb0wThu',
      name:         'Shape of You',
      album_type:   'single',
      release_date: '2017-01-06',
      total_tracks: 1,
      images:       [{ url: 'https://i.scdn.co/image/soy.jpg', height: 640, width: 640 }],
    },
  ],
  limit:    50,
  next:     null,
  offset:   0,
  previous: null,
  total:    25,
};

const MOCK_TRACKS_PAYLOAD = {
  tracks: [
    {
      id:           '7qiZfU4dY1lWllzX7mPBI3',
      name:         'Shape of You',
      external_ids: { isrc: 'GBAHS1600463' },
      artists:      [{ id: '6eUKZXaKkcviH0Ku9w2n3V', name: 'Ed Sheeran' }],
      preview_url:  'https://p.scdn.co/mp3-preview/abc',
      popularity:   89,
    },
    {
      id:           '0tgVpDi06FyKpA1z0VMD4v',
      name:         'Thinking Out Loud',
      external_ids: { isrc: 'GBAHS1400468' },
      artists:      [{ id: '6eUKZXaKkcviH0Ku9w2n3V', name: 'Ed Sheeran' }],
      preview_url:  'https://p.scdn.co/mp3-preview/def',
      popularity:   82,
    },
  ],
};

const MOCK_ISRC_PAYLOAD = {
  tracks: {
    href:  'https://api.spotify.com/v1/search?q=isrc%3AGBAHS1600463&type=track&limit=1',
    items: [
      {
        id:           '7qiZfU4dY1lWllzX7mPBI3',
        name:         'Shape of You',
        artists:      [{ id: '6eUKZXaKkcviH0Ku9w2n3V', name: 'Ed Sheeran' }],
        external_ids: { isrc: 'GBAHS1600463' },
      },
    ],
    total: 1,
  },
};

// ── Connector factory ─────────────────────────────────────────────────────────

async function authenticatedConnector(fetchRoutes = {}) {
  resetTrustConfig();
  loadTrustConfig({ providers: { spotify: 90 } });
  const c = new SpotifyConnector();
  await c.initialize({
    clientId:       'test-client-id',
    clientSecret:   'test-client-secret',
    tokenGenerator: () => MOCK_TOKEN,
    fetchFn:        makeFetch(fetchRoutes),
  });
  await c.authenticate();
  return c;
}

// ── Test groups ───────────────────────────────────────────────────────────────

console.log('\n  SpotifyConnector — Phase 3.6 Certification Suite');
console.log('  ─────────────────────────────────────────────────');

// ── Group A: Identity & lifecycle ────────────────────────────────────────────
console.log('\n  [A] Identity & Lifecycle');

test('PROVIDER_NAME is "spotify"', () => {
  assert.equal(PROVIDER_NAME, 'spotify');
});

test('SpotifyConnector extends ProviderConnector', () => {
  assert.ok(new SpotifyConnector() instanceof ProviderConnector);
});

await testAsync('getVersion returns correct provider metadata', async () => {
  const c = new SpotifyConnector();
  await c.initialize({ clientId: 'id', clientSecret: 'sec', tokenGenerator: () => MOCK_TOKEN });
  const v = c.getVersion();
  assert.equal(v.provider, 'spotify');
  assert.equal(v.connectorVersion, '1.0');
  assert.equal(v.providerApiVersion, 'v1');
});

await testAsync('initialize throws without credentials', async () => {
  const c = new SpotifyConnector();
  await assert.rejects(() => c.initialize({}), /clientId|clientSecret/);
});

await testAsync('initialize accepts tokenGenerator without clientId/clientSecret', async () => {
  const c = new SpotifyConnector();
  await c.initialize({ tokenGenerator: () => MOCK_TOKEN });
});

await testAsync('discoverCapabilities includes required evidence types', async () => {
  const c = new SpotifyConnector();
  await c.initialize({ tokenGenerator: () => MOCK_TOKEN });
  const profile = await c.discoverCapabilities();
  assert.ok(profile.capabilities.includes(Capability.ARTIST_IDENTITY));
  assert.ok(profile.capabilities.includes(Capability.ALBUMS));
  assert.ok(profile.capabilities.includes(Capability.TRACKS));
  assert.ok(profile.capabilities.includes(Capability.ISRC));
});

await testAsync('SPOTIFY_CAPABILITIES matches discoverCapabilities output', async () => {
  const c = new SpotifyConnector();
  await c.initialize({ tokenGenerator: () => MOCK_TOKEN });
  const profile = await c.discoverCapabilities();
  for (const cap of SPOTIFY_CAPABILITIES) {
    assert.ok(profile.capabilities.includes(cap), `Missing capability: ${cap}`);
  }
});

// ── Group B: Authentication ──────────────────────────────────────────────────
console.log('\n  [B] Authentication');

await testAsync('authenticate with tokenGenerator returns AVAILABLE', async () => {
  const c = new SpotifyConnector();
  await c.initialize({ tokenGenerator: () => MOCK_TOKEN });
  const result = await c.authenticate();
  assert.equal(result.health.state, HealthState.AVAILABLE);
  assert.ok(result.credentials?.token);
});

await testAsync('authenticate without initialize returns AUTH_FAILED', async () => {
  const c = new SpotifyConnector();
  const result = await c.authenticate();
  assert.equal(result.health.state, HealthState.AUTH_FAILED);
  assert.equal(result.credentials, null);
});

await testAsync('authenticate with failing tokenGenerator returns AUTH_FAILED', async () => {
  const c = new SpotifyConnector();
  await c.initialize({
    tokenGenerator: () => { throw new Error('token fail'); },
  });
  const result = await c.authenticate();
  assert.equal(result.health.state, HealthState.AUTH_FAILED);
});

// ── Group C: ARTIST_IDENTITY acquisition ────────────────────────────────────
console.log('\n  [C] ARTIST_IDENTITY acquisition');

await testAsync('acquires ARTIST_IDENTITY by spotifyArtistId — full Evidence Contract', async () => {
  const c = await authenticatedConnector({ '/artists/': { body: MOCK_ARTIST_PAYLOAD } });
  const req = createEvidenceRequest({
    subjectRef:   { spotifyArtistId: '6eUKZXaKkcviH0Ku9w2n3V', artistName: 'Ed Sheeran' },
    evidenceType: Capability.ARTIST_IDENTITY,
  });
  const contract = await c.acquire(req);

  assert.equal(contract.provider, 'spotify');
  assert.equal(contract.completeness, 'full');
  assert.equal(contract.payload.id, '6eUKZXaKkcviH0Ku9w2n3V');
  assert.equal(contract.payload.name, 'Ed Sheeran');
  assert.deepEqual(contract.payload.genres, ['pop', 'uk pop']);
  assert.equal(contract.payload.followers.total, 112899504);
  assert.ok(contract.acquisitionId);
  assert.ok(contract.payloadChecksum);
  assert.ok(contract.rawResponseHash);
  assert.equal(contract.health.state, HealthState.AVAILABLE);
  assert.equal(contract.providerTrust, 90);
  resetTrustConfig();
});

await testAsync('ARTIST_IDENTITY without spotifyArtistId returns empty contract', async () => {
  const c = await authenticatedConnector();
  const req = createEvidenceRequest({
    subjectRef:   { artistName: 'Ed Sheeran' },
    evidenceType: Capability.ARTIST_IDENTITY,
  });
  const contract = await c.acquire(req);
  assert.equal(contract.completeness, 'empty');
  assert.equal(contract.payload, null);
  resetTrustConfig();
});

await testAsync('ARTIST_IDENTITY with 404 returns empty contract', async () => {
  const c = await authenticatedConnector({
    '/artists/': { status: 404, body: { error: { status: 404, message: 'Not found' } } },
  });
  const req = createEvidenceRequest({
    subjectRef:   { spotifyArtistId: 'not-a-real-id', artistName: 'Unknown' },
    evidenceType: Capability.ARTIST_IDENTITY,
  });
  const contract = await c.acquire(req);
  assert.equal(contract.completeness, 'empty');
  assert.equal(contract.payload, null);
  resetTrustConfig();
});

await testAsync('acquire without authenticate returns AUTH_FAILED contract', async () => {
  const c = new SpotifyConnector();
  await c.initialize({ tokenGenerator: () => MOCK_TOKEN });
  // No authenticate() call

  const req = createEvidenceRequest({
    subjectRef:   { spotifyArtistId: '6eUKZXaKkcviH0Ku9w2n3V', artistName: 'Ed Sheeran' },
    evidenceType: Capability.ARTIST_IDENTITY,
  });
  const contract = await c.acquire(req);
  assert.equal(contract.completeness, 'empty');
  assert.equal(contract.health.state, HealthState.AUTH_FAILED);
});

// ── Group D: ALBUMS acquisition ──────────────────────────────────────────────
console.log('\n  [D] ALBUMS acquisition');

await testAsync('acquires ALBUMS by spotifyArtistId', async () => {
  const c = await authenticatedConnector({ '/albums': { body: MOCK_ALBUMS_PAYLOAD } });
  const req = createEvidenceRequest({
    subjectRef:   { spotifyArtistId: '6eUKZXaKkcviH0Ku9w2n3V', artistName: 'Ed Sheeran' },
    evidenceType: Capability.ALBUMS,
  });
  const contract = await c.acquire(req);

  assert.equal(contract.provider, 'spotify');
  assert.equal(contract.completeness, 'full');
  assert.ok(Array.isArray(contract.payload.items));
  assert.equal(contract.payload.items.length, 2);
  assert.equal(contract.payload.items[0].name, 'Subtract');
  assert.equal(contract.payload.total, 25);
  resetTrustConfig();
});

await testAsync('ALBUMS without spotifyArtistId returns empty contract', async () => {
  const c = await authenticatedConnector();
  const req = createEvidenceRequest({
    subjectRef:   { artistName: 'Ed Sheeran' },
    evidenceType: Capability.ALBUMS,
  });
  const contract = await c.acquire(req);
  assert.equal(contract.completeness, 'empty');
  resetTrustConfig();
});

// ── Group E: TRACKS acquisition ──────────────────────────────────────────────
console.log('\n  [E] TRACKS acquisition');

await testAsync('acquires TRACKS (top-tracks) by spotifyArtistId', async () => {
  const c = await authenticatedConnector({ '/top-tracks': { body: MOCK_TRACKS_PAYLOAD } });
  const req = createEvidenceRequest({
    subjectRef:   { spotifyArtistId: '6eUKZXaKkcviH0Ku9w2n3V', artistName: 'Ed Sheeran' },
    evidenceType: Capability.TRACKS,
  });
  const contract = await c.acquire(req);

  assert.equal(contract.provider, 'spotify');
  assert.equal(contract.completeness, 'full');
  assert.ok(Array.isArray(contract.payload.tracks));
  assert.equal(contract.payload.tracks.length, 2);
  assert.equal(contract.payload.tracks[0].name, 'Shape of You');
  assert.equal(contract.payload.tracks[0].external_ids.isrc, 'GBAHS1600463');
  resetTrustConfig();
});

await testAsync('TRACKS without spotifyArtistId returns empty contract', async () => {
  const c = await authenticatedConnector();
  const req = createEvidenceRequest({
    subjectRef:   { artistName: 'Ed Sheeran' },
    evidenceType: Capability.TRACKS,
  });
  const contract = await c.acquire(req);
  assert.equal(contract.completeness, 'empty');
  resetTrustConfig();
});

// ── Group F: ISRC acquisition ────────────────────────────────────────────────
console.log('\n  [F] ISRC acquisition');

await testAsync('acquires ISRC via search endpoint', async () => {
  const c = await authenticatedConnector({ '/search': { body: MOCK_ISRC_PAYLOAD } });
  const req = createEvidenceRequest({
    subjectRef:   { isrc: 'GBAHS1600463', artistName: 'Ed Sheeran' },
    evidenceType: Capability.ISRC,
  });
  const contract = await c.acquire(req);

  assert.equal(contract.provider, 'spotify');
  assert.equal(contract.completeness, 'full');
  assert.ok(contract.payload.tracks);
  assert.equal(contract.payload.tracks.items[0].external_ids.isrc, 'GBAHS1600463');
  resetTrustConfig();
});

await testAsync('ISRC without isrc returns empty contract', async () => {
  const c = await authenticatedConnector();
  const req = createEvidenceRequest({
    subjectRef:   { artistName: 'Ed Sheeran' },
    evidenceType: Capability.ISRC,
  });
  const contract = await c.acquire(req);
  assert.equal(contract.completeness, 'empty');
  resetTrustConfig();
});

// ── Group G: Evidence Contract integrity ─────────────────────────────────────
console.log('\n  [G] Evidence Contract integrity');

await testAsync('Evidence Contract has all required fields', async () => {
  const c = await authenticatedConnector({ '/artists/': { body: MOCK_ARTIST_PAYLOAD } });
  const req = createEvidenceRequest({
    subjectRef:   { spotifyArtistId: '6eUKZXaKkcviH0Ku9w2n3V', artistName: 'Ed Sheeran' },
    evidenceType: Capability.ARTIST_IDENTITY,
  });
  const contract = await c.acquire(req);

  assert.ok(contract.evidenceId,      'evidenceId required');
  assert.ok(contract.acquisitionId,   'acquisitionId required');
  assert.ok(contract.correlationId,   'correlationId required');
  assert.ok(contract.provider,        'provider required');
  assert.ok(contract.acquiredAt,      'acquiredAt required');
  assert.ok(contract.completeness,    'completeness required');
  assert.ok(contract.payloadChecksum, 'payloadChecksum required');
  assert.ok(contract.rawResponseHash, 'rawResponseHash required');
  assert.ok(contract.health,          'health required');
  resetTrustConfig();
});

await testAsync('Evidence Contract provider is always "spotify"', async () => {
  const c = await authenticatedConnector({ '/artists/': { body: MOCK_ARTIST_PAYLOAD } });
  const req = createEvidenceRequest({
    subjectRef:   { spotifyArtistId: '6eUKZXaKkcviH0Ku9w2n3V', artistName: 'Ed Sheeran' },
    evidenceType: Capability.ARTIST_IDENTITY,
  });
  const contract = await c.acquire(req);
  assert.equal(contract.provider, 'spotify');
  resetTrustConfig();
});

await testAsync('payloadChecksum differs between different payloads', async () => {
  const differentArtist = { ...MOCK_ARTIST_PAYLOAD, id: 'XYZ', name: 'Different Artist' };
  const c1 = await authenticatedConnector({ '/artists/': { body: MOCK_ARTIST_PAYLOAD } });
  const c2 = await authenticatedConnector({ '/artists/': { body: differentArtist } });

  const req1 = createEvidenceRequest({
    subjectRef:   { spotifyArtistId: '6eUKZXaKkcviH0Ku9w2n3V', artistName: 'Ed Sheeran' },
    evidenceType: Capability.ARTIST_IDENTITY,
  });
  const req2 = createEvidenceRequest({
    subjectRef:   { spotifyArtistId: 'XYZ', artistName: 'Different Artist' },
    evidenceType: Capability.ARTIST_IDENTITY,
  });

  const r1 = await c1.acquire(req1);
  const r2 = await c2.acquire(req2);
  assert.notEqual(r1.payloadChecksum, r2.payloadChecksum);
  resetTrustConfig();
});

await testAsync('rawResponseHash is present and non-empty', async () => {
  const c = await authenticatedConnector({ '/artists/': { body: MOCK_ARTIST_PAYLOAD } });
  const req = createEvidenceRequest({
    subjectRef:   { spotifyArtistId: '6eUKZXaKkcviH0Ku9w2n3V', artistName: 'Ed Sheeran' },
    evidenceType: Capability.ARTIST_IDENTITY,
  });
  const contract = await c.acquire(req);
  assert.match(contract.payloadChecksum, /^[0-9a-f]{64}$/);
  assert.match(contract.rawResponseHash, /^[0-9a-f]{64}$/);
  resetTrustConfig();
});

// ── Group H: Unsupported types + safety ──────────────────────────────────────
console.log('\n  [H] Unsupported types & safety');

await testAsync('unsupported evidence type returns empty PARTIAL_RESPONSE contract', async () => {
  const c = await authenticatedConnector();
  const req = createEvidenceRequest({
    subjectRef:   { spotifyArtistId: 'abc', artistName: 'Test' },
    evidenceType: Capability.AVAILABILITY,
  });
  const contract = await c.acquire(req);
  assert.equal(contract.completeness, 'empty');
  assert.equal(contract.health.state, HealthState.PARTIAL_RESPONSE);
  resetTrustConfig();
});

await testAsync('shutdown clears state — acquire after shutdown returns AUTH_FAILED', async () => {
  const c = await authenticatedConnector();
  await c.shutdown();

  const req = createEvidenceRequest({
    subjectRef:   { spotifyArtistId: 'abc', artistName: 'Test' },
    evidenceType: Capability.ARTIST_IDENTITY,
  });
  const contract = await c.acquire(req);
  assert.equal(contract.health.state, HealthState.AUTH_FAILED);
  resetTrustConfig();
});

await testAsync('GENRES capability routes to artist identity — genres embedded', async () => {
  const c = await authenticatedConnector({ '/artists/': { body: MOCK_ARTIST_PAYLOAD } });
  const req = createEvidenceRequest({
    subjectRef:   { spotifyArtistId: '6eUKZXaKkcviH0Ku9w2n3V', artistName: 'Ed Sheeran' },
    evidenceType: Capability.GENRES,
  });
  const contract = await c.acquire(req);
  assert.equal(contract.completeness, 'full');
  assert.deepEqual(contract.payload.genres, ['pop', 'uk pop']);
  resetTrustConfig();
});

await testAsync('ARTWORK capability routes to artist identity — images embedded', async () => {
  const c = await authenticatedConnector({ '/artists/': { body: MOCK_ARTIST_PAYLOAD } });
  const req = createEvidenceRequest({
    subjectRef:   { spotifyArtistId: '6eUKZXaKkcviH0Ku9w2n3V', artistName: 'Ed Sheeran' },
    evidenceType: Capability.ARTWORK,
  });
  const contract = await c.acquire(req);
  assert.equal(contract.completeness, 'full');
  assert.ok(Array.isArray(contract.payload.images));
  resetTrustConfig();
});

await testAsync('acquire never throws — network failure returns empty contract', async () => {
  const c = await authenticatedConnector({ '/artists/': { throw: 'Network error' } });
  const req = createEvidenceRequest({
    subjectRef:   { spotifyArtistId: 'abc', artistName: 'Test' },
    evidenceType: Capability.ARTIST_IDENTITY,
  });
  const contract = await c.acquire(req);
  assert.ok(contract);
  assert.equal(contract.completeness, 'empty');
  resetTrustConfig();
});

// ── Summary ───────────────────────────────────────────────────────────────────
console.log(`\n  ${'─'.repeat(55)}`);
const verb = failed > 0 ? '✗ FAILED' : '✓ PASSED';
console.log(`  ${verb}: ${passed} passed, ${failed} failed`);
console.log(`  ${'─'.repeat(55)}\n`);

process.exit(failed > 0 ? 1 : 0);
