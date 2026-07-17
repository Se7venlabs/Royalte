// ─── Suite 15: ACRCloud Audio Recognition Connector™ ─────────────────────────
//
// Phase 3.9 (ACRCloud) Board Certification — 2026-07-17
//
// Verifies the constitutional ACRCloud PAL pipeline — Royaltē's first acoustic
// identity provider:
//   A — Static contract: capabilities, provider name, connector version
//   B — Authentication: local credential-presence check (no login endpoint exists)
//   C — Signature generation: HMAC-SHA1 correctness against an independent computation
//   D — Acquisition: status.code 0 (match found) → full evidence, raw passthrough
//   E — Acquisition: status.code 1001 (no match) → definitive empty answer, not an error
//   F — Acquisition: auth failure codes (3001/3014) → AUTH_FAILED
//   G — Acquisition: rate-limit codes (3003/3015) → retry then RATE_LIMITED
//   H — Timeout handling
//   I — Evidence Contract integrity
//   J — Edge cases: missing input, fingerprint-vs-audio dispatch priority, malformed response
//   K — reportHealth() lightweight probe
//
// Uses mocked fetchFn only — no live ACRCloud credentials required or used.
//
// Returns: { name, passed, failed, assertions, details[] }

import { ACRCloudConnector, PROVIDER_NAME, CONNECTOR_VERSION }
  from '../../../provider-acquisition/connectors/acrcloud/ACRCloudConnector.js';
import { ACR_CAPABILITIES }           from '../../../provider-acquisition/connectors/acrcloud/acr-capabilities.js';
import { generateAcrSignature }       from '../../../provider-acquisition/connectors/acrcloud/acr-auth.js';
import { Capability }                 from '../../../provider-acquisition/capability/capabilityVocabulary.js';
import { createHmac }                 from 'node:crypto';

function check(label, pass, note = '') {
  return { label, pass, note: pass ? '' : (note || 'assertion failed') };
}

const HOST = 'identify-eu-west-1.acrcloud.com';

function matchPayload() {
  return {
    status: { code: 0, msg: 'Success', version: '1.0' },
    metadata: {
      timestamp_utc: '2026-07-17 00:00:00',
      music: [{
        acrid: 'acr-001', title: 'Everything Is Over',
        artists: [{ name: 'Black Alternative' }],
        album: { name: 'Test Album' }, label: 'Indie',
        genres: [{ name: 'Rock' }], duration_ms: 210000, release_date: '2025-01-01',
        score: 100,
        external_ids: { isrc: 'US-TEST-25-00001', upc: '000000000001' },
        external_metadata: { spotify: { track: { id: 'sp-001' } } },
      }],
    },
  };
}

function statusOnlyResponse(code, msg = 'error') {
  return { status: { code, msg, version: '1.0' }, metadata: {} };
}

function mockFetch(handler) {
  return async (url, opts) => handler(url, opts);
}

function jsonRes(body) {
  return { ok: true, status: 200, text: async () => JSON.stringify(body) };
}

// ── Group A: Static contract ──────────────────────────────────────────────────

function groupA() {
  const results = [];

  results.push(check('PROVIDER_NAME === "acrcloud"', PROVIDER_NAME === 'acrcloud'));
  results.push(check('CONNECTOR_VERSION === "1.0"', CONNECTOR_VERSION === '1.0'));
  results.push(check('ACR_CAPABILITIES is frozen', Object.isFrozen(ACR_CAPABILITIES)));
  results.push(check(
    'ACR_CAPABILITIES includes AUDIO_RECOGNITION',
    ACR_CAPABILITIES.includes(Capability.AUDIO_RECOGNITION),
  ));
  results.push(check(
    'ACR_CAPABILITIES has exactly 1 entry (v1 scope — Board-approved)',
    ACR_CAPABILITIES.length === 1,
    `got: ${ACR_CAPABILITIES.length}`,
  ));
  results.push(check(
    'ACRCloudConnector is a class (function)',
    typeof ACRCloudConnector === 'function',
  ));
  results.push(check(
    'getVersion() returns correct provider metadata',
    (() => {
      const c = new ACRCloudConnector();
      const v = c.getVersion();
      return v.provider === 'acrcloud' && v.connectorVersion === '1.0' && v.providerApiVersion === 'v1';
    })(),
  ));

  return { name: 'A-static-contract', results };
}

// ── Group B: Authentication — local credential-presence check ────────────────
//
// ACRCloud's Identify API has no login/token endpoint — every request is
// independently HMAC-signed. authenticate() therefore never makes a network
// call; it can only confirm the three required values are present.

async function groupB() {
  const results = [];

  const connectorNoAuth = new ACRCloudConnector();
  await connectorNoAuth.initialize({});
  const authNoAuth = await connectorNoAuth.authenticate();
  results.push(check(
    'authenticate() with no credentials returns AUTH_FAILED',
    authNoAuth.health?.state === 'AUTH_FAILED',
    `got: ${authNoAuth.health?.state}`,
  ));
  results.push(check(
    'authenticate() with no credentials returns null credentials',
    authNoAuth.credentials === null,
  ));

  const connectorPartial = new ACRCloudConnector();
  await connectorPartial.initialize({ accessKey: 'k', accessSecret: 's' }); // host missing
  const authPartial = await connectorPartial.authenticate();
  results.push(check(
    'authenticate() with host missing returns AUTH_FAILED (all three values required)',
    authPartial.health?.state === 'AUTH_FAILED',
    `got: ${authPartial.health?.state}`,
  ));

  let networkCallMade = false;
  const trackingFetch = mockFetch(async () => { networkCallMade = true; return jsonRes(matchPayload()); });
  const connectorWithAuth = new ACRCloudConnector();
  await connectorWithAuth.initialize({ accessKey: 'k', accessSecret: 's', host: HOST, fetchFn: trackingFetch });
  const authWithCreds = await connectorWithAuth.authenticate();
  results.push(check(
    'authenticate() with valid credentials returns AVAILABLE',
    authWithCreds.health?.state === 'AVAILABLE',
    `got: ${authWithCreds.health?.state}`,
  ));
  results.push(check(
    'authenticate() makes no network call (no login endpoint exists for ACRCloud)',
    networkCallMade === false,
  ));
  results.push(check(
    'authenticate() reports mode "hmac-sha1", value redacted',
    authWithCreds.credentials?.mode === 'hmac-sha1' && authWithCreds.credentials?.value === '[redacted]',
    `got: ${JSON.stringify(authWithCreds.credentials)}`,
  ));
  results.push(check(
    'authenticate() credentials never exposes the actual access key or secret',
    !JSON.stringify(authWithCreds.credentials).includes('k') || JSON.stringify(authWithCreds.credentials) === '{"mode":"hmac-sha1","value":"[redacted]"}',
  ));

  const profile = await connectorWithAuth.discoverCapabilities();
  results.push(check(
    'discoverCapabilities() returns an object',
    profile !== null && typeof profile === 'object',
  ));

  await connectorWithAuth.shutdown();
  const authAfterShutdown = await connectorWithAuth.authenticate();
  results.push(check(
    'authenticate() after shutdown() returns AUTH_FAILED (credentials cleared)',
    authAfterShutdown.health?.state === 'AUTH_FAILED',
  ));

  return { name: 'B-auth-behavior', results };
}

// ── Group C: Signature generation correctness ─────────────────────────────────

function groupC() {
  const results = [];

  const params = {
    accessKey: 'test-access-key', accessSecret: 'test-access-secret',
    dataType: 'audio', timestamp: '1700000000',
  };
  const signature = generateAcrSignature(params);

  // Independently recompute the expected signature per ACRCloud's documented
  // algorithm, without going through the module under test.
  const expectedStringToSign = ['POST', '/v1/identify', params.accessKey, params.dataType, '1', params.timestamp].join('\n');
  const expectedSignature = createHmac('sha1', params.accessSecret).update(expectedStringToSign, 'utf8').digest('base64');

  results.push(check(
    'generateAcrSignature() matches independently computed HMAC-SHA1',
    signature === expectedSignature,
    `got: ${signature}, expected: ${expectedSignature}`,
  ));
  results.push(check(
    'generateAcrSignature() is deterministic for identical inputs',
    generateAcrSignature(params) === generateAcrSignature(params),
  ));
  results.push(check(
    'generateAcrSignature() differs for a different timestamp',
    generateAcrSignature(params) !== generateAcrSignature({ ...params, timestamp: '1700000001' }),
  ));
  results.push(check(
    'generateAcrSignature() differs for a different dataType (audio vs fingerprint)',
    generateAcrSignature(params) !== generateAcrSignature({ ...params, dataType: 'fingerprint' }),
  ));
  results.push(check(
    'generateAcrSignature() throws without accessSecret',
    (() => { try { generateAcrSignature({ ...params, accessSecret: undefined }); return false; } catch { return true; } })(),
  ));

  return { name: 'C-signature-generation', results };
}

// ── Group D: Acquisition — status.code 0 (match found) ────────────────────────

async function groupD() {
  const results = [];

  let capturedUrl = null, capturedForm = null;
  const fetchFn = mockFetch(async (url, opts) => {
    capturedUrl  = url;
    capturedForm = opts.body;
    return jsonRes(matchPayload());
  });

  const c = new ACRCloudConnector();
  await c.initialize({ accessKey: 'k', accessSecret: 's', host: HOST, fetchFn });
  await c.authenticate();
  const contract = await c.acquire({
    requestId: 'req-audio', evidenceType: Capability.AUDIO_RECOGNITION,
    subjectRef: { audioSample: Buffer.from('fake-audio-bytes') },
    context: { correlationId: 'corr-audio' },
  });

  results.push(check('acquire() posts to https://{host}/v1/identify', capturedUrl === `https://${HOST}/v1/identify`, `got: ${capturedUrl}`));
  results.push(check('acquire() sends data_type "audio" for subjectRef.audioSample', capturedForm?.get('data_type') === 'audio'));
  results.push(check('acquire() sends signed form fields (access_key, signature, signature_version, timestamp)',
    ['access_key', 'signature', 'signature_version', 'timestamp'].every(f => capturedForm?.has(f))));
  results.push(check('acquire() sends sample + sample_bytes', capturedForm?.has('sample') && capturedForm?.has('sample_bytes')));
  results.push(check('acquire() health is AVAILABLE on status.code 0', contract.health?.state === 'AVAILABLE', `got: ${contract.health?.state}`));
  results.push(check('acquire() completeness is "full" on a match', contract.completeness === 'full'));
  results.push(check('acquire() payload preserves raw metadata.music[0].title', contract.payload?.metadata?.music?.[0]?.title === 'Everything Is Over'));
  results.push(check('acquire() payload preserves external_ids.isrc', contract.payload?.metadata?.music?.[0]?.external_ids?.isrc === 'US-TEST-25-00001'));
  results.push(check('acquire() payload preserves external_metadata.spotify', contract.payload?.metadata?.music?.[0]?.external_metadata?.spotify?.track?.id === 'sp-001'));
  results.push(check('acquire() payload preserves score (raw, uninterpreted)', contract.payload?.metadata?.music?.[0]?.score === 100));

  // Fingerprint path
  let capturedFormFp = null;
  const fetchFnFp = mockFetch(async (url, opts) => { capturedFormFp = opts.body; return jsonRes(matchPayload()); });
  const cFp = new ACRCloudConnector();
  await cFp.initialize({ accessKey: 'k', accessSecret: 's', host: HOST, fetchFn: fetchFnFp });
  await cFp.authenticate();
  await cFp.acquire({
    requestId: 'req-fp', evidenceType: Capability.AUDIO_RECOGNITION,
    subjectRef: { fingerprint: Buffer.from('fake-fingerprint-bytes') },
    context: { correlationId: 'corr-fp' },
  });
  results.push(check('acquire() sends data_type "fingerprint" for subjectRef.fingerprint', capturedFormFp?.get('data_type') === 'fingerprint'));

  return { name: 'D-acquisition-match-found', results };
}

// ── Group E: Acquisition — status.code 1001 (no match, not an error) ─────────

async function groupE() {
  const results = [];

  const fetchFn = mockFetch(async () => jsonRes(statusOnlyResponse(1001, 'No result')));
  const c = new ACRCloudConnector();
  await c.initialize({ accessKey: 'k', accessSecret: 's', host: HOST, fetchFn });
  await c.authenticate();
  const contract = await c.acquire({
    requestId: 'req-nomatch', evidenceType: Capability.AUDIO_RECOGNITION,
    subjectRef: { audioSample: Buffer.from('silence') },
    context: { correlationId: 'corr-nomatch' },
  });

  results.push(check('no-match (1001) health is PARTIAL_RESPONSE, not an error state', contract.health?.state === 'PARTIAL_RESPONSE', `got: ${contract.health?.state}`));
  results.push(check('no-match (1001) completeness is "empty"', contract.completeness === 'empty'));
  results.push(check('no-match (1001) still preserves the raw status envelope as payload', contract.payload?.status?.code === 1001));

  return { name: 'E-acquisition-no-match', results };
}

// ── Group F: Acquisition — auth failure codes (3001 / 3014) ──────────────────

async function groupF() {
  const results = [];

  for (const code of [3001, 3014]) {
    const fetchFn = mockFetch(async () => jsonRes(statusOnlyResponse(code, 'auth error')));
    const c = new ACRCloudConnector();
    await c.initialize({ accessKey: 'k', accessSecret: 's', host: HOST, fetchFn });
    await c.authenticate();
    const contract = await c.acquire({
      requestId: `req-auth-${code}`, evidenceType: Capability.AUDIO_RECOGNITION,
      subjectRef: { audioSample: Buffer.from('x') },
      context: { correlationId: `corr-auth-${code}` },
    });
    results.push(check(`status.code ${code} maps to AUTH_FAILED`, contract.health?.state === 'AUTH_FAILED', `got: ${contract.health?.state}`));
    results.push(check(`status.code ${code} returns null payload`, contract.payload === null));
  }

  return { name: 'F-acquisition-auth-failed', results };
}

// ── Group G: Acquisition — rate-limit codes (3003 / 3015), retry then fail ───

async function groupG() {
  const results = [];

  for (const code of [3003, 3015]) {
    let callCount = 0;
    const fetchFn = mockFetch(async () => { callCount++; return jsonRes(statusOnlyResponse(code, 'rate limited')); });
    const c = new ACRCloudConnector();
    await c.initialize({ accessKey: 'k', accessSecret: 's', host: HOST, fetchFn, maxRetries: 2 });
    await c.authenticate();
    const contract = await c.acquire({
      requestId: `req-rl-${code}`, evidenceType: Capability.AUDIO_RECOGNITION,
      subjectRef: { audioSample: Buffer.from('x') },
      context: { correlationId: `corr-rl-${code}` },
    });
    results.push(check(`status.code ${code} maps to RATE_LIMITED after exhausting retries`, contract.health?.state === 'RATE_LIMITED', `got: ${contract.health?.state}`));
    results.push(check(`status.code ${code} retries before giving up (maxRetries=2 → 3 attempts)`, callCount === 3, `got calls: ${callCount}`));
  }

  // Non-retryable client-error codes must NOT retry
  let notRetryableCalls = 0;
  const fetchNotRetryable = mockFetch(async () => { notRetryableCalls++; return jsonRes(statusOnlyResponse(3006, 'invalid arguments')); });
  const cNotRetryable = new ACRCloudConnector();
  await cNotRetryable.initialize({ accessKey: 'k', accessSecret: 's', host: HOST, fetchFn: fetchNotRetryable, maxRetries: 3 });
  await cNotRetryable.authenticate();
  const contractNotRetryable = await cNotRetryable.acquire({
    requestId: 'req-badargs', evidenceType: Capability.AUDIO_RECOGNITION,
    subjectRef: { audioSample: Buffer.from('x') },
    context: { correlationId: 'corr-badargs' },
  });
  results.push(check('status.code 3006 (invalid arguments) maps to MAINTENANCE, not retried', contractNotRetryable.health?.state === 'MAINTENANCE'));
  results.push(check('status.code 3006 makes exactly 1 call (no retry)', notRetryableCalls === 1, `got: ${notRetryableCalls}`));

  return { name: 'G-acquisition-rate-limited', results };
}

// ── Group H: Timeout handling ─────────────────────────────────────────────────

async function groupH() {
  const results = [];

  const abortingFetch = mockFetch(async (url, opts) => {
    return new Promise((_, reject) => {
      opts.signal.addEventListener('abort', () => {
        const err = new Error('aborted'); err.name = 'AbortError'; reject(err);
      });
    });
  });

  const c = new ACRCloudConnector();
  await c.initialize({ accessKey: 'k', accessSecret: 's', host: HOST, fetchFn: abortingFetch, timeoutMs: 20, maxRetries: 0 });
  await c.authenticate();
  const contract = await c.acquire({
    requestId: 'req-timeout', evidenceType: Capability.AUDIO_RECOGNITION,
    subjectRef: { audioSample: Buffer.from('x') },
    context: { correlationId: 'corr-timeout' },
  });

  results.push(check('request that exceeds timeoutMs maps to TIMEOUT', contract.health?.state === 'TIMEOUT', `got: ${contract.health?.state}`));
  results.push(check('TIMEOUT contract has null payload', contract.payload === null));

  return { name: 'H-timeout-handling', results };
}

// ── Group I: Evidence Contract integrity ──────────────────────────────────────

async function groupI() {
  const results = [];

  const fetchFn = mockFetch(async () => jsonRes(matchPayload()));
  const c = new ACRCloudConnector();
  await c.initialize({ accessKey: 'k', accessSecret: 's', host: HOST, fetchFn });
  await c.authenticate();
  const contract = await c.acquire({
    requestId: 'req-integrity', evidenceType: Capability.AUDIO_RECOGNITION,
    subjectRef: { audioSample: Buffer.from('x') },
    context: { correlationId: 'corr-integrity' },
  });

  const requiredFields = [
    'evidenceId', 'schemaVersion', 'acquisitionId', 'correlationId', 'requestId',
    'provider', 'providerVersion', 'connectorVersion', 'providerTrust',
    'capabilityProfileRef', 'acquiredAt', 'health', 'completeness', 'payload',
    'payloadChecksum', 'rawResponseHash',
  ];
  for (const field of requiredFields) {
    results.push(check(`contract has required field "${field}"`, Object.prototype.hasOwnProperty.call(contract, field)));
  }

  results.push(check('contract.provider === "acrcloud"', contract.provider === 'acrcloud'));
  results.push(check('contract.requestId propagated from evidenceRequest', contract.requestId === 'req-integrity'));
  results.push(check('contract.providerTrust defaults to 80 (governance default)', contract.providerTrust === 80, `got: ${contract.providerTrust}`));
  results.push(check('contract.payloadChecksum is a non-empty sha256 hex string', /^[0-9a-f]{64}$/.test(contract.payloadChecksum)));
  results.push(check('contract.rawResponseHash is a non-empty sha256 hex string', /^[0-9a-f]{64}$/.test(contract.rawResponseHash)));
  results.push(check('contract is frozen (Evidence Contract immutability)', Object.isFrozen(contract)));

  return { name: 'I-evidence-contract-integrity', results };
}

// ── Group J: Edge cases ────────────────────────────────────────────────────────

async function groupJ() {
  const results = [];

  // Missing subjectRef entirely — no network call
  let networkCalled = false;
  const fetchFn = mockFetch(async () => { networkCalled = true; return jsonRes(matchPayload()); });
  const c = new ACRCloudConnector();
  await c.initialize({ accessKey: 'k', accessSecret: 's', host: HOST, fetchFn });
  await c.authenticate();
  const contractNoRef = await c.acquire({
    requestId: 'req-noref', evidenceType: Capability.AUDIO_RECOGNITION,
    subjectRef: {}, context: { correlationId: 'corr-noref' },
  });
  results.push(check('acquire() with neither audioSample nor fingerprint returns PARTIAL_RESPONSE', contractNoRef.health?.state === 'PARTIAL_RESPONSE'));
  results.push(check('acquire() with neither audioSample nor fingerprint makes no network call', networkCalled === false));

  // Both supplied — fingerprint takes priority (documented dispatch rule)
  let capturedDataType = null;
  const fetchFnBoth = mockFetch(async (url, opts) => { capturedDataType = opts.body.get('data_type'); return jsonRes(matchPayload()); });
  const cBoth = new ACRCloudConnector();
  await cBoth.initialize({ accessKey: 'k', accessSecret: 's', host: HOST, fetchFn: fetchFnBoth });
  await cBoth.authenticate();
  await cBoth.acquire({
    requestId: 'req-both', evidenceType: Capability.AUDIO_RECOGNITION,
    subjectRef: { audioSample: Buffer.from('a'), fingerprint: Buffer.from('f') },
    context: { correlationId: 'corr-both' },
  });
  results.push(check('when both audioSample and fingerprint present, fingerprint takes priority', capturedDataType === 'fingerprint', `got: ${capturedDataType}`));

  // No credentials at all — empty contract, no network call
  let networkCalledNoAuth = false;
  const fetchFnNoAuth = mockFetch(async () => { networkCalledNoAuth = true; return jsonRes(matchPayload()); });
  const cNoAuth = new ACRCloudConnector();
  await cNoAuth.initialize({ fetchFn: fetchFnNoAuth });
  const contractNoAuth = await cNoAuth.acquire({
    requestId: 'req-nocreds', evidenceType: Capability.AUDIO_RECOGNITION,
    subjectRef: { audioSample: Buffer.from('x') }, context: { correlationId: 'corr-nocreds' },
  });
  results.push(check('acquire() with no credentials returns AUTH_FAILED', contractNoAuth.health?.state === 'AUTH_FAILED'));
  results.push(check('acquire() with no credentials makes no network call', networkCalledNoAuth === false));

  // Malformed JSON response body
  const fetchFnMalformed = mockFetch(async () => ({ ok: true, status: 200, text: async () => 'not json{{' }));
  const cMalformed = new ACRCloudConnector();
  await cMalformed.initialize({ accessKey: 'k', accessSecret: 's', host: HOST, fetchFn: fetchFnMalformed });
  await cMalformed.authenticate();
  const contractMalformed = await cMalformed.acquire({
    requestId: 'req-malformed', evidenceType: Capability.AUDIO_RECOGNITION,
    subjectRef: { audioSample: Buffer.from('x') }, context: { correlationId: 'corr-malformed' },
  });
  results.push(check('malformed JSON response maps to SCHEMA_CHANGED', contractMalformed.health?.state === 'SCHEMA_CHANGED', `got: ${contractMalformed.health?.state}`));

  // Unsupported evidence type
  const cUnsupported = new ACRCloudConnector();
  await cUnsupported.initialize({ accessKey: 'k', accessSecret: 's', host: HOST, fetchFn });
  await cUnsupported.authenticate();
  const contractUnsupported = await cUnsupported.acquire({
    requestId: 'req-unsupported', evidenceType: Capability.ISRC,
    subjectRef: {}, context: { correlationId: 'corr-unsupported' },
  });
  results.push(check('unsupported evidence type returns PARTIAL_RESPONSE, not a throw', contractUnsupported.health?.state === 'PARTIAL_RESPONSE'));

  return { name: 'J-edge-cases', results };
}

// ── Group K: reportHealth() lightweight probe ─────────────────────────────────

async function groupK() {
  const results = [];

  // No credentials → AUTH_FAILED without a network call
  const cNoAuth = new ACRCloudConnector();
  await cNoAuth.initialize({});
  const healthNoAuth = await cNoAuth.reportHealth();
  results.push(check('reportHealth() with no credentials returns AUTH_FAILED', healthNoAuth.state === 'AUTH_FAILED'));

  // No-match (1001) on the probe still counts as AVAILABLE — proves connectivity + auth
  const fetchFnProbeNoMatch = mockFetch(async () => jsonRes(statusOnlyResponse(1001, 'No result')));
  const cProbe = new ACRCloudConnector();
  await cProbe.initialize({ accessKey: 'k', accessSecret: 's', host: HOST, fetchFn: fetchFnProbeNoMatch });
  const healthProbe = await cProbe.reportHealth();
  results.push(check('reportHealth() treats a no-match probe response as AVAILABLE', healthProbe.state === 'AVAILABLE', `got: ${healthProbe.state}`));

  // Auth failure on the probe → AUTH_FAILED
  const fetchFnProbeAuthFail = mockFetch(async () => jsonRes(statusOnlyResponse(3001, 'wrong access key')));
  const cProbeAuthFail = new ACRCloudConnector();
  await cProbeAuthFail.initialize({ accessKey: 'bad', accessSecret: 'bad', host: HOST, fetchFn: fetchFnProbeAuthFail });
  const healthProbeAuthFail = await cProbeAuthFail.reportHealth();
  results.push(check('reportHealth() surfaces a real auth failure as AUTH_FAILED', healthProbeAuthFail.state === 'AUTH_FAILED'));

  return { name: 'K-report-health', results };
}

// ── Suite runner ──────────────────────────────────────────────────────────────

export async function runACRCloudConnector() {
  const groups = [
    groupA(),
    await groupB(),
    groupC(),
    await groupD(),
    await groupE(),
    await groupF(),
    await groupG(),
    await groupH(),
    await groupI(),
    await groupJ(),
    await groupK(),
  ];

  let passed = 0, failed = 0;
  const details = [];

  for (const group of groups) {
    for (const r of group.results) {
      if (r.pass) passed++;
      else failed++;
      details.push({ group: group.name, label: r.label, status: r.pass ? 'PASS' : 'FAIL', note: r.note });
    }
  }

  return {
    name:       '15-acrcloud-connector',
    passed,
    failed,
    assertions: passed + failed,
    details,
  };
}
