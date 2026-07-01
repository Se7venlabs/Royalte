// Provider Connector Framework — conformance suite — Phase 2.1 §1.3 / §8
// Run: node provider-acquisition/__tests__/conformance.test.js
// Throws / exits 1 on any failure.

import assert from 'node:assert/strict';

import { MockConnector, MOCK_PROVIDER_NAME } from './mockConnector.js';
import { ProviderConnector } from '../connector/ProviderConnector.js';
import { ConnectorLifecycle, Stage } from '../connector/lifecycle.js';
import { ProviderRegistry } from '../registry/ProviderRegistry.js';
import { createRegistryEntry } from '../registry/RegistryEntry.js';
import { HealthState } from '../health/healthStates.js';
import { Capability, ALL_CAPABILITIES, VOCABULARY_VERSION } from '../capability/capabilityVocabulary.js';
import { createCapabilityProfile, hasCapability } from '../capability/CapabilityProfile.js';
import { createHealthSignal, isAvailable } from '../health/ProviderHealthSignal.js';
import { createEvidenceContract, SCHEMA_VERSION } from '../evidence/EvidenceContract.js';
import { computePayloadChecksum, computeRawResponseHash } from '../evidence/integrity.js';
import { createEvidenceRequest } from '../evidence/EvidenceRequest.js';
import { loadTrustConfig, getTrustValue, resetTrustConfig } from '../trust/trustConfig.js';

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

// Helper: build a mock lifecycle through to READY
async function readyLifecycle(scenario = 'success') {
  const connector = new MockConnector(scenario);
  const registry  = new ProviderRegistry();
  const lifecycle = new ConnectorLifecycle(connector, registry);
  await lifecycle.initialize({});
  await lifecycle.register();
  await lifecycle.authenticate();
  await lifecycle.checkHealthAndCapabilities();
  return { lifecycle, registry, connector };
}

// ── Health States ─────────────────────────────────────────────────────────────
console.log('\n── Health States ─');

test('all 9 constitutional states defined', () => {
  const keys = Object.keys(HealthState);
  assert.equal(keys.length, 9);
  for (const s of ['AVAILABLE','PARTIAL_RESPONSE','MAINTENANCE','TIMEOUT','AUTH_FAILED','SCHEMA_CHANGED','RATE_LIMITED','DEPRECATED','DISABLED']) {
    assert.ok(HealthState[s], `Missing: ${s}`);
  }
});

test('HealthState is frozen — no additions allowed', () => {
  assert.throws(() => { HealthState.NEW = 'x'; }, TypeError);
});

// ── Capability Vocabulary ─────────────────────────────────────────────────────
console.log('\n── Capability Vocabulary ─');

test('exactly 22 capabilities defined', () => {
  assert.equal(ALL_CAPABILITIES.size, 22);
});

test('all 22 Board-ratified capabilities present', () => {
  const expected = [
    'Artist Identity','Releases','Tracks','Albums','ISRC','ISWC','UPC',
    'Publishing','Songwriters','Contributors','Territories','Availability',
    'Genres','Labels','Audio Features','Artwork','Social Links','Rights Data',
    'Performance Data','Collection Data','Podcasts','Videos',
  ];
  for (const cap of expected) assert.ok(ALL_CAPABILITIES.has(cap), `Missing: ${cap}`);
});

test('vocabulary version is a non-empty string', () => {
  assert.equal(typeof VOCABULARY_VERSION, 'string');
  assert.ok(VOCABULARY_VERSION.length > 0);
});

// ── CapabilityProfile ─────────────────────────────────────────────────────────
console.log('\n── CapabilityProfile ─');

test('creates profile from valid vocabulary subset', () => {
  const profile = createCapabilityProfile({ capabilities: [Capability.ARTIST_IDENTITY, Capability.RELEASES] });
  assert.equal(profile.capabilities.length, 2);
  assert.ok(hasCapability(profile, Capability.ARTIST_IDENTITY));
  assert.ok(!hasCapability(profile, Capability.PODCASTS));
});

test('rejects capabilities not in the vocabulary', () => {
  assert.throws(
    () => createCapabilityProfile({ capabilities: ['Invented Capability'] }),
    /not in vocabulary/
  );
});

test('profile is frozen — immutable after creation', () => {
  const profile = createCapabilityProfile({ capabilities: [Capability.TRACKS] });
  assert.throws(() => { profile.capabilities.push('x'); }, TypeError);
  assert.throws(() => { profile.vocabularyVersion = '99'; }, TypeError);
});

test('empty profile is valid (a connector may declare no capabilities)', () => {
  const profile = createCapabilityProfile({ capabilities: [] });
  assert.equal(profile.capabilities.length, 0);
});

// ── ProviderHealthSignal ──────────────────────────────────────────────────────
console.log('\n── ProviderHealthSignal ─');

test('creates valid health signal', () => {
  const sig = createHealthSignal({ state: HealthState.AVAILABLE, provider: 'p' });
  assert.equal(sig.state, HealthState.AVAILABLE);
  assert.equal(sig.provider, 'p');
  assert.ok(sig.timestamp);
  assert.ok(isAvailable(sig));
});

test('rejects unknown health state', () => {
  assert.throws(() => createHealthSignal({ state: 'BOGUS', provider: 'p' }), /invalid state/);
});

test('health signal is frozen', () => {
  const sig = createHealthSignal({ state: HealthState.TIMEOUT, provider: 'p' });
  assert.throws(() => { sig.state = 'AVAILABLE'; }, TypeError);
});

test('detail is null by default', () => {
  const sig = createHealthSignal({ state: HealthState.RATE_LIMITED, provider: 'p' });
  assert.equal(sig.detail, null);
});

// ── Integrity ─────────────────────────────────────────────────────────────────
console.log('\n── Integrity ─');

test('computePayloadChecksum returns 64-char hex string', () => {
  const c = computePayloadChecksum({ any: 'payload' });
  assert.equal(typeof c, 'string');
  assert.match(c, /^[0-9a-f]{64}$/);
});

test('computeRawResponseHash returns 64-char hex string', () => {
  const h = computeRawResponseHash('{"raw":"response"}');
  assert.equal(typeof h, 'string');
  assert.match(h, /^[0-9a-f]{64}$/);
});

test('identical payloads produce identical checksums', () => {
  assert.equal(computePayloadChecksum({ x: 1 }), computePayloadChecksum({ x: 1 }));
});

test('different payloads produce different checksums', () => {
  assert.notEqual(computePayloadChecksum({ x: 1 }), computePayloadChecksum({ x: 2 }));
});

test('rawResponseHash accepts Buffer input', () => {
  const h = computeRawResponseHash(Buffer.from('raw bytes'));
  assert.match(h, /^[0-9a-f]{64}$/);
});

// ── TrustConfig ───────────────────────────────────────────────────────────────
console.log('\n── TrustConfig ─');

test('loads and retrieves trust values', () => {
  loadTrustConfig({ configVersion: '1.0', providers: { apple_music: 100, spotify: 96 } });
  assert.equal(getTrustValue('apple_music'), 100);
  assert.equal(getTrustValue('spotify'), 96);
  assert.equal(getTrustValue('unknown_provider'), null);
  resetTrustConfig();
});

test('returns null for unconfigured provider', () => {
  resetTrustConfig();
  assert.equal(getTrustValue('nobody'), null);
});

test('framework carries trust value — never interprets it', () => {
  loadTrustConfig({ providers: { p: 75 } });
  const val = getTrustValue('p');
  assert.equal(typeof val, 'number'); // a number, not a ranking or judgment
  resetTrustConfig();
});

// ── EvidenceRequest ───────────────────────────────────────────────────────────
console.log('\n── EvidenceRequest ─');

test('creates valid request with generated requestId', () => {
  const req = createEvidenceRequest({ subjectRef: { royalteId: 'r-001' }, evidenceType: Capability.ARTIST_IDENTITY });
  assert.ok(req.requestId);
  assert.deepEqual(req.subjectRef, { royalteId: 'r-001' });
  assert.equal(req.evidenceType, Capability.ARTIST_IDENTITY);
  assert.ok(req.createdAt);
});

test('request is frozen', () => {
  const req = createEvidenceRequest({ subjectRef: { id: '1' }, evidenceType: Capability.TRACKS });
  assert.throws(() => { req.requestId = 'x'; }, TypeError);
});

test('rejects missing subjectRef', () => {
  assert.throws(() => createEvidenceRequest({ evidenceType: Capability.ALBUMS }), /subjectRef/);
});

test('rejects missing evidenceType', () => {
  assert.throws(() => createEvidenceRequest({ subjectRef: { id: '1' } }), /evidenceType/);
});

// ── EvidenceContract ──────────────────────────────────────────────────────────
console.log('\n── EvidenceContract ─');

function makeContract(overrides = {}) {
  const payload = { opaque: 'provider-data', nested: { whatever: true } };
  const raw     = JSON.stringify(payload);
  return createEvidenceContract({
    acquisitionId:       'acq-001',
    correlationId:       'corr-001',
    requestId:           'req-001',
    provider:            'mock',
    providerVersion:     '1.0',
    connectorVersion:    '1.0',
    providerTrust:       90,
    capabilityProfileRef: VOCABULARY_VERSION,
    acquiredAt:          new Date().toISOString(),
    health:              createHealthSignal({ state: HealthState.AVAILABLE, provider: 'mock' }),
    completeness:        'full',
    payload,
    payloadChecksum:     computePayloadChecksum(payload),
    rawResponseHash:     computeRawResponseHash(raw),
    ...overrides,
  });
}

test('creates valid evidence contract with all required fields', () => {
  const c = makeContract();
  assert.ok(c.evidenceId);
  assert.equal(c.schemaVersion, SCHEMA_VERSION);
  assert.equal(c.provider, 'mock');
  assert.equal(c.completeness, 'full');
  assert.equal(c.providerTrust, 90);
  assert.match(c.payloadChecksum, /^[0-9a-f]{64}$/);
  assert.match(c.rawResponseHash, /^[0-9a-f]{64}$/);
});

test('contract is frozen', () => {
  const c = makeContract();
  assert.throws(() => { c.provider = 'other'; }, TypeError);
});

test('payload is opaque — framework accepts any payload shape without inspection', () => {
  assert.ok(makeContract({ payload: { deeply: { nested: { ok: true } } } }));
  assert.ok(makeContract({ payload: null }));
  assert.ok(makeContract({ payload: [] }));
  assert.ok(makeContract({ payload: 'raw string from provider' }));
  assert.ok(makeContract({ payload: 42 }));
});

test('providerFields are quarantined — never hoisted to canonical shape', () => {
  const c = makeContract({ providerFields: { provider_native_id: 'p123', sp_artist_id: 'sp456' } });
  assert.equal(c.providerFields.provider_native_id, 'p123');
  assert.ok(!('artistId' in c));
  assert.ok(!('canonicalName' in c));
  assert.ok(!('healthScore' in c));
});

test('rejects invalid completeness value', () => {
  assert.throws(() => makeContract({ completeness: 'invalid' }), /invalid completeness/);
});

test('rejects missing required envelope fields', () => {
  assert.throws(() => createEvidenceContract({}), /missing required envelope fields/);
});

test('each contract gets a unique evidenceId', () => {
  const a = makeContract();
  const b = makeContract();
  assert.notEqual(a.evidenceId, b.evidenceId);
});

// ── Abstract ProviderConnector ────────────────────────────────────────────────
console.log('\n── Abstract ProviderConnector ─');

await testAsync('all abstract methods throw "not implemented"', async () => {
  const base = new ProviderConnector();
  await assert.rejects(() => base.initialize(),           /not implemented/);
  await assert.rejects(() => base.authenticate(),         /not implemented/);
  await assert.rejects(() => base.discoverCapabilities(), /not implemented/);
  await assert.rejects(() => base.reportHealth(),         /not implemented/);
  await assert.rejects(() => base.acquire(),              /not implemented/);
  assert.throws(        () => base.getVersion(),          /not implemented/);
  await assert.rejects(() => base.shutdown(),             /not implemented/);
});

// ── RegistryEntry ─────────────────────────────────────────────────────────────
console.log('\n── RegistryEntry ─');

test('creates valid entry with all 7 fields', () => {
  const entry = createRegistryEntry({
    name:                 'p',
    version:              { provider: 'p', connectorVersion: '1.0', providerApiVersion: '1.0' },
    capabilityProfile:    createCapabilityProfile({ capabilities: [Capability.RELEASES] }),
    trustValue:           80,
    healthState:          HealthState.AVAILABLE,
    enabled:              true,
    implementationStatus: 'implemented',
  });
  assert.equal(entry.name, 'p');
  assert.equal(entry.trustValue, 80);
  assert.equal(entry.implementationStatus, 'implemented');
});

test('rejects invalid implementationStatus', () => {
  assert.throws(
    () => createRegistryEntry({ name: 'p', version: {}, capabilityProfile: {}, trustValue: 80, healthState: 'AVAILABLE', implementationStatus: 'unknown' }),
    /invalid implementationStatus/
  );
});

// ── ProviderRegistry ──────────────────────────────────────────────────────────
console.log('\n── ProviderRegistry ─');

test('register and lookup', () => {
  const reg = new ProviderRegistry();
  reg.register({ name: 'p', version: {}, capabilityProfile: {}, trustValue: 80, healthState: HealthState.AVAILABLE, enabled: true, implementationStatus: 'implemented' });
  const e = reg.lookup('p');
  assert.equal(e.name, 'p');
  assert.equal(e.trustValue, 80);
});

test('lookup returns null for unknown provider', () => {
  assert.equal(new ProviderRegistry().lookup('nobody'), null);
});

test('updateHealth changes state of record', () => {
  const reg = new ProviderRegistry();
  reg.register({ name: 'p', version: {}, capabilityProfile: {}, trustValue: 80, healthState: HealthState.AVAILABLE, enabled: true, implementationStatus: 'implemented' });
  reg.updateHealth('p', HealthState.RATE_LIMITED);
  assert.equal(reg.lookup('p').healthState, HealthState.RATE_LIMITED);
});

test('registry is a directory — no rank/select/score/decide methods', () => {
  const reg = new ProviderRegistry();
  for (const method of ['rank', 'select', 'score', 'decide', 'choose', 'pick']) {
    assert.ok(!(method in reg), `Registry must not have "${method}" method`);
  }
});

test('listAll returns copies of all registered entries', () => {
  const reg = new ProviderRegistry();
  reg.register({ name: 'a', version: {}, capabilityProfile: {}, trustValue: 100, healthState: HealthState.AVAILABLE, enabled: true, implementationStatus: 'implemented' });
  reg.register({ name: 'b', version: {}, capabilityProfile: {}, trustValue: 90,  healthState: HealthState.AVAILABLE, enabled: true, implementationStatus: 'implemented' });
  assert.equal(reg.listAll().length, 2);
  assert.equal(reg.size, 2);
});

// ── Lifecycle: success path ───────────────────────────────────────────────────
console.log('\n── Lifecycle: success path ─');

await testAsync('full lifecycle: CREATED → INITIALIZED → REGISTERED → AUTHENTICATED → READY → SHUTDOWN', async () => {
  resetTrustConfig();
  loadTrustConfig({ providers: { [MOCK_PROVIDER_NAME]: 80 } });

  const connector = new MockConnector('success');
  const registry  = new ProviderRegistry();
  const lifecycle = new ConnectorLifecycle(connector, registry);

  assert.equal(lifecycle.stage, Stage.CREATED);
  await lifecycle.initialize({});
  assert.equal(lifecycle.stage, Stage.INITIALIZED);
  await lifecycle.register();
  assert.equal(lifecycle.stage, Stage.REGISTERED);
  await lifecycle.authenticate();
  assert.equal(lifecycle.stage, Stage.AUTHENTICATED);
  await lifecycle.checkHealthAndCapabilities();
  assert.equal(lifecycle.stage, Stage.READY);

  const req = createEvidenceRequest({
    subjectRef:   { royalteId: 'r-001' },
    evidenceType: Capability.ARTIST_IDENTITY,
    context:      { correlationId: 'corr-test-001' },
  });
  const contract = await lifecycle.acquire(req);
  assert.equal(lifecycle.stage, Stage.READY); // stays READY after acquire

  assert.ok(contract.evidenceId);
  assert.equal(contract.provider, MOCK_PROVIDER_NAME);
  assert.equal(contract.completeness, 'full');
  assert.match(contract.payloadChecksum, /^[0-9a-f]{64}$/);
  assert.match(contract.rawResponseHash, /^[0-9a-f]{64}$/);

  await lifecycle.shutdown();
  assert.equal(lifecycle.stage, Stage.SHUTDOWN);
  resetTrustConfig();
});

await testAsync('registry holds provider entry with capability profile + trust after registration', async () => {
  resetTrustConfig();
  loadTrustConfig({ providers: { [MOCK_PROVIDER_NAME]: 80 } });
  const { registry } = await readyLifecycle('success');
  const entry = registry.lookup(MOCK_PROVIDER_NAME);
  assert.ok(entry);
  assert.equal(entry.trustValue, 80);
  assert.ok(hasCapability(entry.capabilityProfile, Capability.ARTIST_IDENTITY));
  assert.ok(hasCapability(entry.capabilityProfile, Capability.RELEASES));
  assert.ok(hasCapability(entry.capabilityProfile, Capability.TRACKS));
  assert.ok(!hasCapability(entry.capabilityProfile, Capability.PODCASTS));
  resetTrustConfig();
});

await testAsync('multiple acquire() calls remain in READY stage', async () => {
  resetTrustConfig();
  loadTrustConfig({ providers: { [MOCK_PROVIDER_NAME]: 80 } });
  const { lifecycle } = await readyLifecycle('success');
  const req = createEvidenceRequest({ subjectRef: { id: 'a' }, evidenceType: Capability.TRACKS });
  await lifecycle.acquire(req);
  await lifecycle.acquire(req);
  assert.equal(lifecycle.stage, Stage.READY);
  await lifecycle.shutdown();
  resetTrustConfig();
});

// ── Lifecycle: ordering enforcement ──────────────────────────────────────────
console.log('\n── Lifecycle: ordering enforcement ─');

await testAsync('cannot acquire before authenticate', async () => {
  resetTrustConfig();
  loadTrustConfig({ providers: { [MOCK_PROVIDER_NAME]: 80 } });
  const connector = new MockConnector();
  const lifecycle = new ConnectorLifecycle(connector, new ProviderRegistry());
  await lifecycle.initialize({});
  await lifecycle.register();
  // Stage is REGISTERED — not AUTHENTICATED or READY
  const req = createEvidenceRequest({ subjectRef: { id: 'x' }, evidenceType: Capability.TRACKS });
  await assert.rejects(() => lifecycle.acquire(req), /invalid stage/);
  resetTrustConfig();
});

await testAsync('cannot acquire before initialize', async () => {
  resetTrustConfig();
  const connector = new MockConnector();
  const lifecycle = new ConnectorLifecycle(connector, new ProviderRegistry());
  // Stage is CREATED
  const req = createEvidenceRequest({ subjectRef: { id: 'x' }, evidenceType: Capability.TRACKS });
  await assert.rejects(() => lifecycle.acquire(req), /invalid stage/);
});

await testAsync('cannot register before initialize', async () => {
  const lifecycle = new ConnectorLifecycle(new MockConnector(), new ProviderRegistry());
  await assert.rejects(() => lifecycle.register(), /invalid stage/);
});

await testAsync('cannot authenticate before register', async () => {
  const lifecycle = new ConnectorLifecycle(new MockConnector(), new ProviderRegistry());
  await lifecycle.initialize({});
  await assert.rejects(() => lifecycle.authenticate(), /invalid stage/);
});

await testAsync('cannot checkHealthAndCapabilities before authenticate', async () => {
  resetTrustConfig();
  loadTrustConfig({ providers: { [MOCK_PROVIDER_NAME]: 80 } });
  const connector = new MockConnector();
  const lifecycle = new ConnectorLifecycle(connector, new ProviderRegistry());
  await lifecycle.initialize({});
  await lifecycle.register();
  await assert.rejects(() => lifecycle.checkHealthAndCapabilities(), /invalid stage/);
  resetTrustConfig();
});

await testAsync('cannot shutdown before initialize', async () => {
  const lifecycle = new ConnectorLifecycle(new MockConnector(), new ProviderRegistry());
  await assert.rejects(() => lifecycle.shutdown(), /before initialize/);
});

// ── Lifecycle: failure scenarios ──────────────────────────────────────────────
console.log('\n── Lifecycle: failure scenarios ─');

await testAsync('auth failure → FAILED stage + AUTH_FAILED health in registry', async () => {
  resetTrustConfig();
  loadTrustConfig({ providers: { [MOCK_PROVIDER_NAME]: 80 } });
  const connector = new MockConnector('auth_failure');
  const registry  = new ProviderRegistry();
  const lifecycle = new ConnectorLifecycle(connector, registry);
  await lifecycle.initialize({});
  await lifecycle.register();
  await lifecycle.authenticate();

  assert.equal(lifecycle.stage, Stage.FAILED);
  assert.equal(lifecycle.lastHealth.state, HealthState.AUTH_FAILED);
  assert.equal(registry.lookup(MOCK_PROVIDER_NAME).healthState, HealthState.AUTH_FAILED);

  await lifecycle.shutdown(); // shutdown from FAILED is allowed
  assert.equal(lifecycle.stage, Stage.SHUTDOWN);
  resetTrustConfig();
});

await testAsync('partial response — contract completeness = partial', async () => {
  resetTrustConfig();
  loadTrustConfig({ providers: { [MOCK_PROVIDER_NAME]: 80 } });
  const { lifecycle } = await readyLifecycle('partial');
  const req      = createEvidenceRequest({ subjectRef: { id: 'a' }, evidenceType: Capability.RELEASES });
  const contract = await lifecycle.acquire(req);
  assert.equal(contract.completeness, 'partial');
  await lifecycle.shutdown();
  resetTrustConfig();
});

await testAsync('schema_changed — health state captured in contract + registry', async () => {
  resetTrustConfig();
  loadTrustConfig({ providers: { [MOCK_PROVIDER_NAME]: 80 } });
  const { lifecycle, registry } = await readyLifecycle('schema_changed');
  const req      = createEvidenceRequest({ subjectRef: { id: 'a' }, evidenceType: Capability.RELEASES });
  const contract = await lifecycle.acquire(req);
  assert.equal(contract.health.state, HealthState.SCHEMA_CHANGED);
  assert.equal(registry.lookup(MOCK_PROVIDER_NAME).healthState, HealthState.SCHEMA_CHANGED);
  await lifecycle.shutdown();
  resetTrustConfig();
});

await testAsync('deprecated — endpoint works, health is DEPRECATED, lifecycle proceeds to READY', async () => {
  resetTrustConfig();
  loadTrustConfig({ providers: { [MOCK_PROVIDER_NAME]: 80 } });
  const connector = new MockConnector('deprecated');
  const registry  = new ProviderRegistry();
  const lifecycle = new ConnectorLifecycle(connector, registry);
  await lifecycle.initialize({});
  await lifecycle.register();
  await lifecycle.authenticate();
  const health = await lifecycle.checkHealthAndCapabilities();
  assert.equal(health.state, HealthState.DEPRECATED);
  assert.equal(lifecycle.stage, Stage.READY); // deprecated but still functional
  const req      = createEvidenceRequest({ subjectRef: { id: 'a' }, evidenceType: Capability.TRACKS });
  const contract = await lifecycle.acquire(req);
  assert.ok(contract.evidenceId); // evidence still flows
  await lifecycle.shutdown();
  resetTrustConfig();
});

// ── Mock extends ProviderConnector ────────────────────────────────────────────
console.log('\n── MockConnector (reference implementation) ─');

test('MockConnector extends ProviderConnector', () => {
  assert.ok(new MockConnector() instanceof ProviderConnector);
});

await testAsync('mock never reads inside payload — payload is opaque to framework', async () => {
  resetTrustConfig();
  loadTrustConfig({ providers: { [MOCK_PROVIDER_NAME]: 80 } });
  const { lifecycle } = await readyLifecycle('success');
  const req      = createEvidenceRequest({ subjectRef: { id: 'a' }, evidenceType: Capability.ARTIST_IDENTITY });
  const contract = await lifecycle.acquire(req);
  // Framework accepts payload and checksums it — never parses internal shape
  assert.ok(contract.payload !== undefined);
  assert.match(contract.payloadChecksum, /^[0-9a-f]{64}$/);
  assert.match(contract.rawResponseHash, /^[0-9a-f]{64}$/);
  await lifecycle.shutdown();
  resetTrustConfig();
});

// ── Constitutional checks ─────────────────────────────────────────────────────
console.log('\n── Constitutional checks ─');

test('no real provider names in framework constants', () => {
  const forbidden = ['apple','spotify','musicbrainz','mlc','deezer','discogs','youtube','soundexchange','lastfm','audiodb','soundcloud'];
  const frameworkKeys = [
    ...Object.keys(HealthState),
    ...Object.values(Capability),
    ...Object.keys(Stage),
  ].map(k => k.toLowerCase().replace(/\s+/g, ''));
  for (const name of forbidden) {
    const match = frameworkKeys.find(k => k.includes(name));
    assert.ok(!match, `Provider name "${name}" found in framework constant: ${match}`);
  }
});

test('EvidenceContract never injects canonical fields', () => {
  const c = makeContract({ providerFields: { apple_artist_id: 'a123', sp_id: 'sp456' } });
  for (const canonical of ['artistId','canonicalName','healthScore','royalteId','isrc','iswc']) {
    assert.ok(!(canonical in c), `Canonical field "${canonical}" must not appear at contract root`);
  }
});

test('ProviderRegistry has no intelligence methods', () => {
  const reg = new ProviderRegistry();
  for (const method of ['rank','select','score','decide','choose','pick','compute','infer']) {
    assert.ok(!(method in reg), `Registry must not expose intelligence method "${method}"`);
  }
});

// ── Summary ───────────────────────────────────────────────────────────────────
console.log(`\n────────────────────────────────────`);
console.log(`  Passed: ${passed}`);
console.log(`  Failed: ${failed}`);
console.log(`────────────────────────────────────`);

if (failed > 0) {
  console.error('\nConformance FAILED. See failures above.\n');
  process.exit(1);
}

console.log('\nConformance suite GREEN. Phase 2.1 Provider Connector Framework certified.\n');
