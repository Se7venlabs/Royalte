// Phase 2.3 PAL Activation Certification Suite
// Run: node provider-acquisition/pal/__tests__/pal-activation.test.js
// Exits 0 on all-green. Exits 1 on any failure.
//
// Proves the end-to-end acquisition path:
//   Apple Music → AppleMusicConnector → ProviderAcquisitionLayer → Evidence Contract → STOP
//
// All Apple API calls are mocked via injectable fetchFn + tokenGenerator.
// No real network calls. No Apple credentials required.

import assert from 'node:assert/strict';

import { ProviderAcquisitionLayer } from '../ProviderAcquisitionLayer.js';
import { createAcquisitionReport }  from '../AcquisitionReport.js';
import { AppleMusicConnector }      from '../../connectors/apple-music/AppleMusicConnector.js';
import { MockConnector, MOCK_PROVIDER_NAME } from '../../__tests__/mockConnector.js';
import { createEvidenceRequest }    from '../../evidence/EvidenceRequest.js';
import { HealthState }              from '../../health/healthStates.js';
import { Capability }               from '../../capability/capabilityVocabulary.js';
import { Stage }                    from '../../connector/lifecycle.js';
import { loadTrustConfig, resetTrustConfig } from '../../trust/trustConfig.js';
import { APPLE_MUSIC_CAPABILITIES } from '../../connectors/apple-music/apple-capabilities.js';

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

const MOCK_TOKEN = 'mock-pal-jwt-token';

function makeFetch(routes = {}) {
  return async (url, opts) => {
    const key    = Object.keys(routes).find(k => url.includes(k));
    const config = key ? routes[key] : null;

    if (config?.throw) throw new Error(config.throw);

    if (config?.delay) {
      await new Promise((resolve, reject) => {
        const tid = setTimeout(resolve, config.delay);
        opts?.signal?.addEventListener('abort', () => {
          clearTimeout(tid);
          const err = new Error('The operation was aborted');
          err.name = 'AbortError';
          reject(err);
        });
      });
    }

    const status = config?.status ?? 200;
    return {
      ok:      status < 400,
      status,
      headers: { get: h => (config?.headers ?? {})[h.toLowerCase()] ?? null },
      text:    async () => JSON.stringify(config?.body ?? {}),
    };
  };
}

function appleConfig(fetchRoutes = {}, overrides = {}) {
  return {
    teamId:         'PAL_TEAM',
    keyId:          'PAL_KEY',
    privateKey:     'unused-in-tests',
    tokenGenerator: () => MOCK_TOKEN,
    fetchFn:        makeFetch(fetchRoutes),
    timeoutMs:      5_000,
    maxRetries:     2,
    ...overrides,
  };
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

const HEALTH_FIXTURE = {
  data: [{ id: 'us', type: 'storefronts', attributes: { name: 'United States' } }],
};

const ARTIST_FIXTURE = {
  data: [{
    id: '657515',
    type: 'artists',
    attributes: {
      name: 'Radiohead',
      url: 'https://music.apple.com/us/artist/radiohead/657515',
      genreNames: ['Alternative', 'Music'],
      artwork: { url: 'https://example.com/art/{w}x{h}.jpg', width: 4320, height: 4320 },
    },
  }],
};

const ALBUMS_FIXTURE = {
  data: [{
    id: '1109714933',
    type: 'albums',
    attributes: {
      name: 'OK Computer',
      releaseDate: '1997-05-28',
      recordLabel: 'Parlophone',
      upc: '724384553098',
    },
  }],
};

// Standard routes covering health probe + artist identity
const STANDARD_ROUTES = {
  storefronts:  { status: 200, body: HEALTH_FIXTURE },
  '/artists/657515': { status: 200, body: ARTIST_FIXTURE },
};

function setupTrust() {
  resetTrustConfig();
  loadTrustConfig({ providers: { apple_music: 100 } });
}

// Fully activated PAL with Apple Music connector (health-checked, READY)
async function activatedPAL(fetchRoutes = STANDARD_ROUTES, configOverrides = {}) {
  setupTrust();
  const pal = new ProviderAcquisitionLayer();
  await pal.activateConnector(new AppleMusicConnector(), appleConfig(fetchRoutes, configOverrides));
  return pal;
}

// ── PAL instantiation ─────────────────────────────────────────────────────────
console.log('\n── PAL instantiation ─');

test('ProviderAcquisitionLayer instantiates without arguments', () => {
  const pal = new ProviderAcquisitionLayer();
  assert.ok(pal);
});

test('new PAL has no registered connectors', () => {
  const pal = new ProviderAcquisitionLayer();
  assert.deepEqual(pal.listConnectors(), []);
});

// ── Connector registration ─────────────────────────────────────────────────────
console.log('\n── Connector registration ─');

await testAsync('registerConnector() returns providerName', async () => {
  setupTrust();
  const pal  = new ProviderAcquisitionLayer();
  const name = await pal.registerConnector(new AppleMusicConnector(), appleConfig());
  assert.equal(name, 'apple_music');
  resetTrustConfig();
});

await testAsync('registry entry exists after registerConnector()', async () => {
  setupTrust();
  const pal = new ProviderAcquisitionLayer();
  await pal.registerConnector(new AppleMusicConnector(), appleConfig());
  const entry = pal.getConnectorEntry('apple_music');
  assert.ok(entry, 'entry must be present');
  assert.equal(entry.name, 'apple_music');
  assert.equal(entry.trustValue, 100);
  resetTrustConfig();
});

await testAsync('listConnectors() returns apple_music after registration', async () => {
  setupTrust();
  const pal = new ProviderAcquisitionLayer();
  await pal.registerConnector(new AppleMusicConnector(), appleConfig());
  const list = pal.listConnectors();
  assert.equal(list.length, 1);
  assert.equal(list[0].name, 'apple_music');
  resetTrustConfig();
});

await testAsync('getConnectorStage() is REGISTERED after registerConnector()', async () => {
  setupTrust();
  const pal = new ProviderAcquisitionLayer();
  await pal.registerConnector(new AppleMusicConnector(), appleConfig());
  assert.equal(pal.getConnectorStage('apple_music'), Stage.REGISTERED);
  resetTrustConfig();
});

// ── Capability discovery ───────────────────────────────────────────────────────
console.log('\n── Capability discovery ─');

await testAsync('registry entry has full Apple Music capability profile after registration', async () => {
  setupTrust();
  const pal = new ProviderAcquisitionLayer();
  await pal.registerConnector(new AppleMusicConnector(), appleConfig());
  const entry = pal.getConnectorEntry('apple_music');
  assert.ok(entry.capabilityProfile);
  for (const cap of APPLE_MUSIC_CAPABILITIES) {
    assert.ok(
      entry.capabilityProfile.capabilities.includes(cap),
      `capability missing from registry: ${cap}`
    );
  }
  resetTrustConfig();
});

await testAsync('registry entry version matches connector', async () => {
  setupTrust();
  const pal = new ProviderAcquisitionLayer();
  await pal.registerConnector(new AppleMusicConnector(), appleConfig());
  const entry = pal.getConnectorEntry('apple_music');
  assert.equal(entry.version.provider, 'apple_music');
  assert.equal(entry.version.connectorVersion, '1.0');
  resetTrustConfig();
});

// ── Authentication ─────────────────────────────────────────────────────────────
console.log('\n── Authentication ─');

await testAsync('authenticateConnector() returns AVAILABLE health', async () => {
  setupTrust();
  const pal = new ProviderAcquisitionLayer();
  await pal.registerConnector(new AppleMusicConnector(), appleConfig());
  const result = await pal.authenticateConnector('apple_music');
  assert.equal(result.health.state, HealthState.AVAILABLE);
  assert.ok(result.credentials?.token);
  resetTrustConfig();
});

await testAsync('getConnectorStage() is AUTHENTICATED after authenticateConnector()', async () => {
  setupTrust();
  const pal = new ProviderAcquisitionLayer();
  await pal.registerConnector(new AppleMusicConnector(), appleConfig());
  await pal.authenticateConnector('apple_music');
  assert.equal(pal.getConnectorStage('apple_music'), Stage.AUTHENTICATED);
  resetTrustConfig();
});

await testAsync('auth failure → lifecycle stage FAILED — PAL handles without throwing', async () => {
  setupTrust();
  const pal = new ProviderAcquisitionLayer();
  await pal.registerConnector(new AppleMusicConnector(), appleConfig({}, {
    tokenGenerator: () => { throw new Error('bad key'); },
  }));
  const result = await pal.authenticateConnector('apple_music');
  assert.equal(result.health.state, HealthState.AUTH_FAILED);
  assert.equal(pal.getConnectorStage('apple_music'), Stage.FAILED);
  resetTrustConfig();
});

// ── Provider health reporting ──────────────────────────────────────────────────
console.log('\n── Provider health reporting ─');

await testAsync('checkConnectorHealth() returns AVAILABLE after successful probe', async () => {
  setupTrust();
  const pal = new ProviderAcquisitionLayer();
  await pal.registerConnector(new AppleMusicConnector(), appleConfig(STANDARD_ROUTES));
  await pal.authenticateConnector('apple_music');
  const health = await pal.checkConnectorHealth('apple_music');
  assert.equal(health.state, HealthState.AVAILABLE);
  resetTrustConfig();
});

await testAsync('getConnectorStage() is READY after checkConnectorHealth()', async () => {
  setupTrust();
  const pal = new ProviderAcquisitionLayer();
  await pal.registerConnector(new AppleMusicConnector(), appleConfig(STANDARD_ROUTES));
  await pal.authenticateConnector('apple_music');
  await pal.checkConnectorHealth('apple_music');
  assert.equal(pal.getConnectorStage('apple_music'), Stage.READY);
  resetTrustConfig();
});

await testAsync('registry healthState updated after checkConnectorHealth()', async () => {
  setupTrust();
  const pal = new ProviderAcquisitionLayer();
  await pal.registerConnector(new AppleMusicConnector(), appleConfig(STANDARD_ROUTES));
  await pal.authenticateConnector('apple_music');
  await pal.checkConnectorHealth('apple_music');
  const entry = pal.getConnectorEntry('apple_music');
  assert.equal(entry.healthState, HealthState.AVAILABLE);
  resetTrustConfig();
});

await testAsync('getConnectorHealth() returns last health signal', async () => {
  const pal = await activatedPAL();
  const h   = pal.getConnectorHealth('apple_music');
  assert.ok(h);
  assert.equal(h.state, HealthState.AVAILABLE);
  assert.equal(h.provider, 'apple_music');
  resetTrustConfig();
});

// ── Full activation sequence ───────────────────────────────────────────────────
console.log('\n── Full activation sequence ─');

await testAsync('activateConnector() reaches READY in one call', async () => {
  const pal = await activatedPAL();
  assert.equal(pal.getConnectorStage('apple_music'), Stage.READY);
  resetTrustConfig();
});

await testAsync('activateConnector() registers provider in listConnectors()', async () => {
  const pal  = await activatedPAL();
  const list = pal.listConnectors();
  assert.equal(list.length, 1);
  assert.equal(list[0].name, 'apple_music');
  resetTrustConfig();
});

// ── Evidence acquisition ───────────────────────────────────────────────────────
console.log('\n── Evidence acquisition ─');

await testAsync('acquire() returns AcquisitionReport with valid Evidence Contract', async () => {
  const pal = await activatedPAL();
  const req = createEvidenceRequest({
    subjectRef:   { appleArtistId: '657515' },
    evidenceType: Capability.ARTIST_IDENTITY,
    context:      { correlationId: 'pal-corr-001' },
  });
  const report = await pal.acquire('apple_music', req);

  assert.ok(report.reportId);
  assert.equal(report.providerName, 'apple_music');
  assert.equal(report.requestId, req.requestId);
  assert.ok(report.contract);
  assert.ok(report.acquired);
  assert.equal(report.completeness, 'full');
  assert.equal(report.healthState, HealthState.AVAILABLE);
  resetTrustConfig();
});

await testAsync('acquire() contract has all required Evidence Contract fields', async () => {
  const pal = await activatedPAL();
  const req = createEvidenceRequest({ subjectRef: { appleArtistId: '657515' }, evidenceType: Capability.ARTIST_IDENTITY });
  const { contract } = await pal.acquire('apple_music', req);

  assert.ok(contract.evidenceId);
  assert.ok(contract.acquisitionId);
  assert.ok(contract.correlationId);
  assert.equal(contract.requestId, req.requestId);
  assert.equal(contract.provider, 'apple_music');
  assert.equal(contract.providerVersion, 'v1');
  assert.equal(contract.connectorVersion, '1.0');
  assert.equal(contract.providerTrust, 100);
  assert.ok(contract.capabilityProfileRef);
  assert.ok(contract.acquiredAt);
  assert.ok(contract.health);
  assert.ok(contract.completeness);
  assert.match(contract.payloadChecksum, /^[0-9a-f]{64}$/);
  assert.match(contract.rawResponseHash, /^[0-9a-f]{64}$/);
  resetTrustConfig();
});

await testAsync('acquire() contract payload is raw Apple response — no PAL transformation', async () => {
  const pal = await activatedPAL();
  const req = createEvidenceRequest({ subjectRef: { appleArtistId: '657515' }, evidenceType: Capability.ARTIST_IDENTITY });
  const { contract } = await pal.acquire('apple_music', req);

  // Payload must be the raw Apple API shape — data array untouched
  assert.deepEqual(contract.payload, ARTIST_FIXTURE);
  // PAL must not have added its own fields
  assert.ok(!('palProcessed' in contract));
  assert.ok(!('normalized' in contract));
  assert.ok(!('intelligence' in contract));
  resetTrustConfig();
});

await testAsync('acquire() works for ALBUMS evidence type', async () => {
  const pal = await activatedPAL({
    storefronts:  STANDARD_ROUTES.storefronts,
    '/albums':    { status: 200, body: ALBUMS_FIXTURE },
  });
  const req = createEvidenceRequest({ subjectRef: { appleArtistId: '657515' }, evidenceType: Capability.ALBUMS });
  const report = await pal.acquire('apple_music', req);
  assert.equal(report.healthState, HealthState.AVAILABLE);
  assert.deepEqual(report.contract.payload, ALBUMS_FIXTURE);
  resetTrustConfig();
});

// ── AcquisitionReport structure ────────────────────────────────────────────────
console.log('\n── AcquisitionReport structure ─');

test('createAcquisitionReport() rejects missing providerName', () => {
  const fakeContract = { health: { state: 'AVAILABLE' }, completeness: 'full' };
  assert.throws(() => createAcquisitionReport({ requestId: 'r', contract: fakeContract, elapsedMs: 0 }), /providerName/);
});

test('createAcquisitionReport() rejects missing contract', () => {
  assert.throws(() => createAcquisitionReport({ providerName: 'p', requestId: 'r', elapsedMs: 0 }), /contract/);
});

test('createAcquisitionReport() report is frozen', () => {
  const fakeContract = Object.freeze({ health: { state: 'AVAILABLE' }, completeness: 'full' });
  const report = createAcquisitionReport({ providerName: 'p', requestId: 'r', contract: fakeContract, elapsedMs: 5 });
  assert.ok(Object.isFrozen(report));
});

test('acquired = true when completeness is full', () => {
  const c = Object.freeze({ health: { state: 'AVAILABLE' }, completeness: 'full' });
  assert.equal(createAcquisitionReport({ providerName: 'p', requestId: 'r', contract: c, elapsedMs: 1 }).acquired, true);
});

test('acquired = true when completeness is partial', () => {
  const c = Object.freeze({ health: { state: 'PARTIAL_RESPONSE' }, completeness: 'partial' });
  assert.equal(createAcquisitionReport({ providerName: 'p', requestId: 'r', contract: c, elapsedMs: 1 }).acquired, true);
});

test('acquired = false when completeness is empty', () => {
  const c = Object.freeze({ health: { state: 'AUTH_FAILED' }, completeness: 'empty' });
  assert.equal(createAcquisitionReport({ providerName: 'p', requestId: 'r', contract: c, elapsedMs: 1 }).acquired, false);
});

// ── Acquisition timing ─────────────────────────────────────────────────────────
console.log('\n── Acquisition timing ─');

await testAsync('report.elapsedMs is a non-negative number', async () => {
  const pal = await activatedPAL();
  const req = createEvidenceRequest({ subjectRef: { appleArtistId: '657515' }, evidenceType: Capability.ARTIST_IDENTITY });
  const report = await pal.acquire('apple_music', req);
  assert.ok(typeof report.elapsedMs === 'number');
  assert.ok(report.elapsedMs >= 0);
  resetTrustConfig();
});

await testAsync('report.acquiredAt is an ISO timestamp', async () => {
  const pal = await activatedPAL();
  const req = createEvidenceRequest({ subjectRef: { appleArtistId: '657515' }, evidenceType: Capability.ARTIST_IDENTITY });
  const { acquiredAt } = await pal.acquire('apple_music', req);
  assert.ok(acquiredAt);
  assert.ok(!isNaN(Date.parse(acquiredAt)));
  resetTrustConfig();
});

// ── Failure handling ───────────────────────────────────────────────────────────
console.log('\n── Failure handling ─');

await testAsync('401 from Apple → AUTH_FAILED AcquisitionReport — never throws', async () => {
  const pal = await activatedPAL({
    storefronts:      STANDARD_ROUTES.storefronts,
    '/artists/657515': { status: 401, body: {} },
  });
  const req = createEvidenceRequest({ subjectRef: { appleArtistId: '657515' }, evidenceType: Capability.ARTIST_IDENTITY });
  const report = await pal.acquire('apple_music', req); // must not throw
  assert.equal(report.healthState, HealthState.AUTH_FAILED);
  assert.equal(report.acquired, false);
  assert.ok(report.contract);
  resetTrustConfig();
});

await testAsync('network error → MAINTENANCE AcquisitionReport — never throws', async () => {
  const pal = await activatedPAL({
    storefronts:      STANDARD_ROUTES.storefronts,
    '/artists/657515': { throw: 'connection refused' },
  }, { maxRetries: 0 });
  const req = createEvidenceRequest({ subjectRef: { appleArtistId: '657515' }, evidenceType: Capability.ARTIST_IDENTITY });
  const report = await pal.acquire('apple_music', req);
  assert.equal(report.healthState, HealthState.MAINTENANCE);
  assert.equal(report.acquired, false);
  resetTrustConfig();
});

await testAsync('missing subjectRef → PARTIAL_RESPONSE AcquisitionReport', async () => {
  const pal = await activatedPAL();
  const req = createEvidenceRequest({ subjectRef: { royalteId: 'r-001' }, evidenceType: Capability.ARTIST_IDENTITY });
  const report = await pal.acquire('apple_music', req);
  assert.equal(report.healthState, HealthState.PARTIAL_RESPONSE);
  assert.equal(report.completeness, 'empty');
  assert.equal(report.acquired, false);
  resetTrustConfig();
});

await testAsync('acquire() for unknown provider throws cleanly', async () => {
  const pal = new ProviderAcquisitionLayer();
  const req = createEvidenceRequest({ subjectRef: { appleArtistId: '657515' }, evidenceType: Capability.ARTIST_IDENTITY });
  await assert.rejects(() => pal.acquire('spotify', req), /no connector registered/);
});

// ── Retry handling ─────────────────────────────────────────────────────────────
console.log('\n── Retry handling ─');

await testAsync('PAL acquire() succeeds after connector retries 5xx internally', async () => {
  let calls = 0;
  const fetchFn = async (url, opts) => {
    if (url.includes('storefronts')) {
      return { ok: true, status: 200, headers: { get: () => null }, text: async () => JSON.stringify(HEALTH_FIXTURE) };
    }
    calls++;
    if (calls < 2) return { ok: false, status: 503, headers: { get: () => null }, text: async () => '' };
    return { ok: true, status: 200, headers: { get: () => null }, text: async () => JSON.stringify(ARTIST_FIXTURE) };
  };
  setupTrust();
  const pal = new ProviderAcquisitionLayer();
  await pal.activateConnector(new AppleMusicConnector(), {
    teamId: 'T', keyId: 'K', privateKey: 'P',
    tokenGenerator: () => MOCK_TOKEN,
    fetchFn,
    timeoutMs: 5_000,
    maxRetries: 3,
  });
  const req    = createEvidenceRequest({ subjectRef: { appleArtistId: '657515' }, evidenceType: Capability.ARTIST_IDENTITY });
  const report = await pal.acquire('apple_music', req);
  assert.equal(report.healthState, HealthState.AVAILABLE);
  assert.ok(calls >= 2, 'should have retried at least once');
  resetTrustConfig();
});

await testAsync('PAL acquire() returns MAINTENANCE after exhausted retries', async () => {
  setupTrust();
  const pal = new ProviderAcquisitionLayer();
  await pal.activateConnector(new AppleMusicConnector(), appleConfig({
    storefronts:       STANDARD_ROUTES.storefronts,
    '/artists/657515': { status: 503, body: {} },
  }, { maxRetries: 1 }));
  const req    = createEvidenceRequest({ subjectRef: { appleArtistId: '657515' }, evidenceType: Capability.ARTIST_IDENTITY });
  const report = await pal.acquire('apple_music', req);
  assert.equal(report.healthState, HealthState.MAINTENANCE);
  resetTrustConfig();
});

// ── Timeout handling ───────────────────────────────────────────────────────────
console.log('\n── Timeout handling ─');

await testAsync('PAL acquire() returns TIMEOUT report when connector times out', async () => {
  setupTrust();
  const pal = new ProviderAcquisitionLayer();
  await pal.activateConnector(new AppleMusicConnector(), appleConfig({
    storefronts:       STANDARD_ROUTES.storefronts,
    '/artists/657515': { delay: 500, body: ARTIST_FIXTURE },
  }, { timeoutMs: 50, maxRetries: 0 }));
  const req    = createEvidenceRequest({ subjectRef: { appleArtistId: '657515' }, evidenceType: Capability.ARTIST_IDENTITY });
  const report = await pal.acquire('apple_music', req);
  assert.equal(report.healthState, HealthState.TIMEOUT);
  assert.equal(report.acquired, false);
  resetTrustConfig();
});

// ── Multiple acquisition cycles ────────────────────────────────────────────────
console.log('\n── Multiple acquisition cycles ─');

await testAsync('same connector can acquire multiple times — stays READY', async () => {
  const pal = await activatedPAL();
  for (let i = 0; i < 3; i++) {
    const req    = createEvidenceRequest({ subjectRef: { appleArtistId: '657515' }, evidenceType: Capability.ARTIST_IDENTITY });
    const report = await pal.acquire('apple_music', req);
    assert.equal(report.healthState, HealthState.AVAILABLE);
    assert.equal(pal.getConnectorStage('apple_music'), Stage.READY);
  }
  resetTrustConfig();
});

await testAsync('each acquisition produces a unique reportId and unique contract evidenceId', async () => {
  const pal  = await activatedPAL();
  const req1 = createEvidenceRequest({ subjectRef: { appleArtistId: '657515' }, evidenceType: Capability.ARTIST_IDENTITY });
  const req2 = createEvidenceRequest({ subjectRef: { appleArtistId: '657515' }, evidenceType: Capability.ARTIST_IDENTITY });
  const r1   = await pal.acquire('apple_music', req1);
  const r2   = await pal.acquire('apple_music', req2);
  assert.notEqual(r1.reportId, r2.reportId);
  assert.notEqual(r1.contract.evidenceId, r2.contract.evidenceId);
  resetTrustConfig();
});

// ── Evidence Contract integrity ────────────────────────────────────────────────
console.log('\n── Evidence Contract integrity ─');

await testAsync('PAL never mutates the Evidence Contract — contract is frozen', async () => {
  const pal  = await activatedPAL();
  const req  = createEvidenceRequest({ subjectRef: { appleArtistId: '657515' }, evidenceType: Capability.ARTIST_IDENTITY });
  const { contract } = await pal.acquire('apple_music', req);
  // Contract must be frozen — proof that the PAL does not unwrap and re-wrap it
  assert.ok(Object.isFrozen(contract));
});

await testAsync('report.contract is the same reference passed through from the connector — no copy', async () => {
  // Capture the contract produced by the connector by wrapping acquire()
  setupTrust();
  const pal = new ProviderAcquisitionLayer();
  let capturedContract = null;
  const connectorProxy = new Proxy(new AppleMusicConnector(), {
    get(target, prop) {
      if (prop !== 'acquire') return target[prop].bind ? target[prop].bind(target) : target[prop];
      return async (...args) => {
        const c = await target.acquire(...args);
        capturedContract = c;
        return c;
      };
    },
  });
  await pal.activateConnector(connectorProxy, appleConfig(STANDARD_ROUTES));
  const req    = createEvidenceRequest({ subjectRef: { appleArtistId: '657515' }, evidenceType: Capability.ARTIST_IDENTITY });
  const report = await pal.acquire('apple_music', req);
  assert.strictEqual(report.contract, capturedContract, 'PAL must pass the contract through, not copy it');
  resetTrustConfig();
});

await testAsync('payloadChecksum matches payload content throughout — no silent mutation', async () => {
  const { computePayloadChecksum } = await import('../../evidence/integrity.js');
  const pal  = await activatedPAL();
  const req  = createEvidenceRequest({ subjectRef: { appleArtistId: '657515' }, evidenceType: Capability.ARTIST_IDENTITY });
  const { contract } = await pal.acquire('apple_music', req);
  // Re-compute checksum from payload — must match what the connector set
  const expected = computePayloadChecksum(contract.payload);
  assert.equal(contract.payloadChecksum, expected);
  resetTrustConfig();
});

// ── Provider-agnosticism ───────────────────────────────────────────────────────
console.log('\n── Provider-agnosticism (MockConnector) ─');

await testAsync('PAL works identically with MockConnector — no Apple-specific logic in PAL', async () => {
  resetTrustConfig();
  loadTrustConfig({ providers: { [MOCK_PROVIDER_NAME]: 80 } });
  const pal  = new ProviderAcquisitionLayer();
  await pal.activateConnector(new MockConnector('success'), { trustValue: 80 });
  assert.equal(pal.getConnectorStage(MOCK_PROVIDER_NAME), Stage.READY);
  const req    = createEvidenceRequest({ subjectRef: { royalteId: 'r-001' }, evidenceType: Capability.ARTIST_IDENTITY });
  const report = await pal.acquire(MOCK_PROVIDER_NAME, req);
  assert.equal(report.providerName, MOCK_PROVIDER_NAME);
  assert.equal(report.healthState, HealthState.AVAILABLE);
  assert.equal(report.acquired, true);
  resetTrustConfig();
});

await testAsync('PAL can register both MockConnector and AppleMusicConnector simultaneously', async () => {
  setupTrust();
  loadTrustConfig({ providers: { apple_music: 100, [MOCK_PROVIDER_NAME]: 80 } });
  const pal = new ProviderAcquisitionLayer();
  await pal.activateConnector(new AppleMusicConnector(), appleConfig(STANDARD_ROUTES));
  await pal.activateConnector(new MockConnector('success'), { trustValue: 80 });
  const list = pal.listConnectors();
  assert.equal(list.length, 2);
  const names = list.map(e => e.name).sort();
  assert.deepEqual(names, ['apple_music', MOCK_PROVIDER_NAME].sort());
  resetTrustConfig();
});

test('ProviderAcquisitionLayer source imports no Apple-specific modules', async () => {
  // Read the PAL source and verify no connector-specific imports
  const { readFileSync } = await import('node:fs');
  const { fileURLToPath } = await import('node:url');
  const { dirname, join } = await import('node:path');
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const palSrc = readFileSync(join(__dirname, '../ProviderAcquisitionLayer.js'), 'utf8');
  const forbidden = ['apple-music', 'AppleMusicConnector', 'apple-auth', 'apple-http', 'spotify', 'musicbrainz'];
  for (const name of forbidden) {
    assert.ok(!palSrc.includes(name), `PAL source must not reference "${name}"`);
  }
});

// ── Clean shutdown ─────────────────────────────────────────────────────────────
console.log('\n── Clean shutdown ─');

await testAsync('shutdownConnector() moves apple_music to SHUTDOWN', async () => {
  const pal = await activatedPAL();
  await pal.shutdownConnector('apple_music');
  assert.equal(pal.getConnectorStage('apple_music'), Stage.SHUTDOWN);
  resetTrustConfig();
});

await testAsync('PAL.shutdown() shuts down all connectors and returns empty errors array', async () => {
  setupTrust();
  loadTrustConfig({ providers: { apple_music: 100, [MOCK_PROVIDER_NAME]: 80 } });
  const pal = new ProviderAcquisitionLayer();
  await pal.activateConnector(new AppleMusicConnector(), appleConfig(STANDARD_ROUTES));
  await pal.activateConnector(new MockConnector('success'), { trustValue: 80 });
  const errors = await pal.shutdown();
  assert.deepEqual(errors, []);
  resetTrustConfig();
});

await testAsync('PAL.shutdown() clears listConnectors()', async () => {
  const pal = await activatedPAL();
  await pal.shutdown();
  assert.deepEqual(pal.listConnectors(), []);
  resetTrustConfig();
});

await testAsync('acquire() after shutdown throws (connector removed from lifecycles map)', async () => {
  const pal = await activatedPAL();
  await pal.shutdown();
  const req = createEvidenceRequest({ subjectRef: { appleArtistId: '657515' }, evidenceType: Capability.ARTIST_IDENTITY });
  await assert.rejects(() => pal.acquire('apple_music', req), /no connector registered/);
  resetTrustConfig();
});

await testAsync('PAL.shutdown() is safe to call twice', async () => {
  const pal = await activatedPAL();
  await pal.shutdown();
  const errors = await pal.shutdown(); // second call — already cleared
  assert.deepEqual(errors, []);
  resetTrustConfig();
});

// ── Summary ───────────────────────────────────────────────────────────────────
console.log(`\n────────────────────────────────────`);
console.log(`  Passed: ${passed}`);
console.log(`  Failed: ${failed}`);
console.log(`────────────────────────────────────`);

if (failed > 0) {
  console.error('\nPAL activation tests FAILED. See above.\n');
  process.exit(1);
}

console.log('\nPAL activation tests GREEN. Phase 2.3 certification ready.\n');
