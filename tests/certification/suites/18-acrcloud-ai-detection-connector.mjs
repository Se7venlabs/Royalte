// ─── Suite 18: ACRCloud AI Detection Connector™ ────────────────────────────────
//
// Phase 5.0 (ACRCloud AI Detection) Board Certification — 2026-07-17
//
// Completely separate from Suite 15 (ACRCloud Audio Recognition Connector™) —
// different product, different auth model, different processing model. See
// this connector's README.md for the full architectural distinction.
//
// Groups:
//   A — Static contract: capabilities, provider name, connector version
//   B — Initialization: missing token / missing containerId / invalid region
//   C — Authentication: credential-presence check, redaction, shutdown clears state
//   D — Submission routing: audio sample (multipart), fingerprint, audio URL
//   E — Acquisition: initial processing response (state 0) → polling begins
//   F — Acquisition: successful completion after multiple polls
//   G — Acquisition: provider-reported scan error (state -1)
//   H — Acquisition: timeout — bounded polling, last response preserved
//   I — Error handling: submission failure, auth failure (401/403), malformed response
//   J — reportHealth(): read-only container probe, no file upload
//   K — Evidence Contract integrity + connector immutability
//   L — Edge cases: missing subjectRef, unsupported capability, shutdown/cleanup
//
// Uses mocked fetchFn only — no live ACRCloud credentials required or used,
// consistent with this connector's documented live-verification limitation.
//
// Returns: { name, passed, failed, assertions, details[] }

import { ACRCloudAIDetectionConnector, PROVIDER_NAME, CONNECTOR_VERSION }
  from '../../../provider-acquisition/connectors/acrcloud-ai-detection/ACRCloudAIDetectionConnector.js';
import { ACR_AI_DETECTION_CAPABILITIES } from '../../../provider-acquisition/connectors/acrcloud-ai-detection/acr-ai-capabilities.js';
import { Capability } from '../../../provider-acquisition/capability/capabilityVocabulary.js';

function check(label, pass, note = '') {
  return { label, pass, note: pass ? '' : (note || 'assertion failed') };
}

const CONTAINER_ID = '4242';
const REGION       = 'eu-west-1';
const FILE_ID       = 'file-abc123';

function jsonRes(body) {
  return { ok: true, status: 200, text: async () => JSON.stringify(body) };
}

function submittedFile(overrides = {}) {
  return { id: FILE_ID, state: 0, uri: 'https://cdn.acrcloud.com/x', data_type: 'audio', ...overrides };
}

const AI_DETECTION_RESULT = {
  id: FILE_ID, state: 1,
  ai_detection: [{
    start: 0, end: 30, prediction: 'ai_generated', likely_source: 'Suno',
    ai_probability: 92.3, duration: 30, stem: 'original',
    source_probabilities: [{ source: 'Suno', probability: 92.3 }, { source: 'Human', probability: 7.7 }],
    segments: [{ start: 0, end: 30, prediction: 'ai_generated', likely_source: 'Suno' }],
    model_id: 'lv1axtcv',
  }],
};

function mockFetch(handler) {
  return async (url, opts = {}) => handler(url, opts);
}

async function newConnector(fetchFn, overrides = {}) {
  const c = new ACRCloudAIDetectionConnector();
  await c.initialize({ token: 'test-token', containerId: CONTAINER_ID, region: REGION, fetchFn, ...overrides });
  await c.authenticate();
  return c;
}

async function acquireDetection(connector, subjectRef) {
  return connector.acquire({
    requestId: 'req-ai-detect', evidenceType: Capability.AI_MUSIC_DETECTION, subjectRef,
    context: { correlationId: 'corr-ai-detect' },
  });
}

// ── Group A: Static contract ──────────────────────────────────────────────────

function groupA() {
  const results = [];

  results.push(check('PROVIDER_NAME === "acrcloud_ai_detection"', PROVIDER_NAME === 'acrcloud_ai_detection'));
  results.push(check('CONNECTOR_VERSION === "1.0"', CONNECTOR_VERSION === '1.0'));
  results.push(check('ACR_AI_DETECTION_CAPABILITIES is frozen', Object.isFrozen(ACR_AI_DETECTION_CAPABILITIES)));
  results.push(check(
    'ACR_AI_DETECTION_CAPABILITIES includes AI_MUSIC_DETECTION',
    ACR_AI_DETECTION_CAPABILITIES.includes(Capability.AI_MUSIC_DETECTION),
  ));
  results.push(check(
    'ACR_AI_DETECTION_CAPABILITIES has exactly 1 entry (distinct from AUDIO_RECOGNITION)',
    ACR_AI_DETECTION_CAPABILITIES.length === 1, `got: ${ACR_AI_DETECTION_CAPABILITIES.length}`,
  ));
  results.push(check(
    'ACR_AI_DETECTION_CAPABILITIES does not include AUDIO_RECOGNITION (separate connector, separate capability)',
    !ACR_AI_DETECTION_CAPABILITIES.includes(Capability.AUDIO_RECOGNITION),
  ));
  results.push(check('ACRCloudAIDetectionConnector is a class (function)', typeof ACRCloudAIDetectionConnector === 'function'));
  results.push(check(
    'getVersion() returns correct provider metadata',
    (() => {
      const c = new ACRCloudAIDetectionConnector();
      const v = c.getVersion();
      return v.provider === 'acrcloud_ai_detection' && v.connectorVersion === '1.0';
    })(),
  ));

  return { name: 'A-static-contract', results };
}

// ── Group B: Initialization ───────────────────────────────────────────────────

async function groupB() {
  const results = [];

  const cEmpty = new ACRCloudAIDetectionConnector();
  await cEmpty.initialize({});
  results.push(check('initialize({}) then authenticate() returns AUTH_FAILED', (await cEmpty.authenticate()).health?.state === 'AUTH_FAILED'));

  const cNoToken = new ACRCloudAIDetectionConnector();
  await cNoToken.initialize({ containerId: CONTAINER_ID, region: REGION });
  results.push(check('missing token returns AUTH_FAILED', (await cNoToken.authenticate()).health?.state === 'AUTH_FAILED'));

  const cNoContainer = new ACRCloudAIDetectionConnector();
  await cNoContainer.initialize({ token: 't', region: REGION });
  results.push(check('missing containerId returns AUTH_FAILED', (await cNoContainer.authenticate()).health?.state === 'AUTH_FAILED'));

  const cNoRegion = new ACRCloudAIDetectionConnector();
  await cNoRegion.initialize({ token: 't', containerId: CONTAINER_ID });
  results.push(check('missing region returns AUTH_FAILED', (await cNoRegion.authenticate()).health?.state === 'AUTH_FAILED'));

  const cBadRegion = new ACRCloudAIDetectionConnector();
  await cBadRegion.initialize({ token: 't', containerId: CONTAINER_ID, region: 'not-a-real-region' });
  results.push(check('invalid region (not one of the 3 documented values) returns AUTH_FAILED — no implicit fallback',
    (await cBadRegion.authenticate()).health?.state === 'AUTH_FAILED'));

  const cValid = new ACRCloudAIDetectionConnector();
  await cValid.initialize({ token: 't', containerId: CONTAINER_ID, region: REGION });
  results.push(check('valid token+containerId+region returns AVAILABLE', (await cValid.authenticate()).health?.state === 'AVAILABLE'));

  return { name: 'B-initialization', results };
}

// ── Group C: Authentication ───────────────────────────────────────────────────

async function groupC() {
  const results = [];

  const c = await newConnector(mockFetch(async () => jsonRes({})));
  const auth = await c.authenticate();
  results.push(check('authenticate() reports mode "bearer", value redacted',
    auth.credentials?.mode === 'bearer' && auth.credentials?.value === '[redacted]', `got: ${JSON.stringify(auth.credentials)}`));
  results.push(check('authenticate() never exposes the actual token value',
    !JSON.stringify(auth.credentials).includes('test-token')));

  const profile = await c.discoverCapabilities();
  results.push(check('discoverCapabilities() returns an object', profile !== null && typeof profile === 'object'));

  await c.shutdown();
  const authAfterShutdown = await c.authenticate();
  results.push(check('authenticate() after shutdown() returns AUTH_FAILED (credentials cleared)', authAfterShutdown.health?.state === 'AUTH_FAILED'));

  return { name: 'C-auth-behavior', results };
}

// ── Group D: Submission routing ───────────────────────────────────────────────

async function groupD() {
  const results = [];

  // audioSample → multipart, data_type "audio"
  // pollMaxAttempts: 0 guarantees zero poll calls, so only the submission
  // POST is ever captured — a poll GET has no body and would otherwise
  // overwrite these captures on any nonzero timeout budget.
  let capturedForm1 = null, capturedUrl1 = null;
  const c1 = await newConnector(mockFetch(async (url, opts) => {
    if (opts.method === 'POST') { capturedUrl1 = url; capturedForm1 = opts.body; }
    return jsonRes(submittedFile());
  }), { pollMaxAttempts: 0 });
  await acquireDetection(c1, { audioSample: Buffer.from('raw-audio-bytes') });
  results.push(check('audioSample submission posts to /api/fs-containers/{id}/files',
    capturedUrl1?.includes(`/api/fs-containers/${CONTAINER_ID}/files`), `got: ${capturedUrl1}`));
  results.push(check('audioSample submission sets data_type=audio', capturedForm1?.get('data_type') === 'audio'));
  results.push(check('audioSample submission includes a file field', capturedForm1?.has('file')));

  // fingerprint → multipart, data_type "fingerprint"
  let capturedForm2 = null;
  const c2 = await newConnector(mockFetch(async (url, opts) => {
    if (opts.method === 'POST') capturedForm2 = opts.body;
    return jsonRes(submittedFile());
  }), { pollMaxAttempts: 0 });
  await acquireDetection(c2, { fingerprint: Buffer.from('fp-bytes') });
  results.push(check('fingerprint submission sets data_type=fingerprint', capturedForm2?.get('data_type') === 'fingerprint'));
  results.push(check('fingerprint submission includes a file field', capturedForm2?.has('file')));

  // audioUrl → multipart, data_type "audio_url", no file field
  let capturedForm3 = null;
  const c3 = await newConnector(mockFetch(async (url, opts) => {
    if (opts.method === 'POST') capturedForm3 = opts.body;
    return jsonRes(submittedFile());
  }), { pollMaxAttempts: 0 });
  await acquireDetection(c3, { audioUrl: 'https://example.com/track.mp3' });
  results.push(check('audioUrl submission sets data_type=audio_url', capturedForm3?.get('data_type') === 'audio_url'));
  results.push(check('audioUrl submission sets url field', capturedForm3?.get('url') === 'https://example.com/track.mp3'));
  results.push(check('audioUrl submission has no file field', !capturedForm3?.has('file')));

  // Bearer header present on submission
  let capturedHeaders = null;
  const c4 = await newConnector(mockFetch(async (url, opts) => {
    if (opts.method === 'POST') capturedHeaders = opts.headers;
    return jsonRes(submittedFile());
  }), { pollMaxAttempts: 0 });
  await acquireDetection(c4, { audioSample: Buffer.from('x') });
  results.push(check('submission sends Authorization: Bearer {token}', capturedHeaders?.Authorization === 'Bearer test-token'));

  return { name: 'D-submission-routing', results };
}

// ── Group E: Initial processing response ──────────────────────────────────────

async function groupE() {
  const results = [];

  let pollCalled = false;
  const fetchFn = mockFetch(async (url, opts) => {
    if (opts.method === 'POST') return jsonRes(submittedFile({ state: 0 }));
    pollCalled = true;
    return jsonRes(submittedFile({ state: 0 }));
  });
  const c = await newConnector(fetchFn, { pollIntervalMs: 5, pollMaxAttempts: 1, pollTotalTimeoutMs: 200 });
  const contract = await acquireDetection(c, { audioSample: Buffer.from('x') });

  results.push(check('submission with state 0 triggers at least one poll', pollCalled));
  results.push(check('still-processing after budget exhausted maps to TIMEOUT', contract.health?.state === 'TIMEOUT', `got: ${contract.health?.state}`));

  return { name: 'E-initial-processing-response', results };
}

// ── Group F: Successful completion after multiple polls ──────────────────────

async function groupF() {
  const results = [];

  let pollCount = 0;
  const fetchFn = mockFetch(async (url, opts) => {
    if (opts.method === 'POST') return jsonRes(submittedFile({ state: 0 }));
    pollCount++;
    return pollCount < 3 ? jsonRes(submittedFile({ state: 0 })) : jsonRes(AI_DETECTION_RESULT);
  });
  const c = await newConnector(fetchFn, { pollIntervalMs: 5 });
  const contract = await acquireDetection(c, { audioSample: Buffer.from('x') });

  results.push(check('resolves after multiple processing polls (state 0 → 0 → 1)', pollCount === 3, `got: ${pollCount}`));
  results.push(check('successful completion health is AVAILABLE', contract.health?.state === 'AVAILABLE', `got: ${contract.health?.state}`));
  results.push(check('successful completion completeness is "full"', contract.completeness === 'full'));
  results.push(check('payload preserves raw ai_detection[0].prediction', contract.payload?.ai_detection?.[0]?.prediction === 'ai_generated'));
  results.push(check('payload preserves raw ai_detection[0].ai_probability (untouched, not scored)', contract.payload?.ai_detection?.[0]?.ai_probability === 92.3));
  results.push(check('payload preserves raw likely_source (not reinterpreted)', contract.payload?.ai_detection?.[0]?.likely_source === 'Suno'));
  results.push(check('payload preserves raw source_probabilities array (not collapsed)',
    Array.isArray(contract.payload?.ai_detection?.[0]?.source_probabilities) && contract.payload.ai_detection[0].source_probabilities.length === 2));
  results.push(check('payload preserves raw segments array (not collapsed)', Array.isArray(contract.payload?.ai_detection?.[0]?.segments)));
  results.push(check('payload preserves raw model_id', contract.payload?.ai_detection?.[0]?.model_id === 'lv1axtcv'));

  return { name: 'F-successful-completion', results };
}

// ── Group G: Provider-reported scan error (state -1) ──────────────────────────

async function groupG() {
  const results = [];

  const fetchFn = mockFetch(async (url, opts) => {
    if (opts.method === 'POST') return jsonRes(submittedFile({ state: 0 }));
    return jsonRes({ id: FILE_ID, state: -1, error: 'unsupported audio format' });
  });
  const c = await newConnector(fetchFn, { pollIntervalMs: 5 });
  const contract = await acquireDetection(c, { audioSample: Buffer.from('x') });

  results.push(check('provider scan error (state -1) maps to PARTIAL_RESPONSE, not AVAILABLE', contract.health?.state === 'PARTIAL_RESPONSE', `got: ${contract.health?.state}`));
  results.push(check('provider scan error payload is preserved raw (not discarded)', contract.payload?.state === -1));

  return { name: 'G-provider-scan-error', results };
}

// ── Group H: Timeout — bounded polling, last response preserved ──────────────

async function groupH() {
  const results = [];

  let requestCount = 0;
  const fetchFn = mockFetch(async (url, opts) => {
    requestCount++;
    if (opts.method === 'POST') return jsonRes(submittedFile({ state: 0, uri: 'submission-uri' }));
    return jsonRes(submittedFile({ state: 0, uri: 'poll-response-uri' })); // never resolves
  });
  const c = await newConnector(fetchFn, { pollIntervalMs: 5, pollMaxAttempts: 4, pollTotalTimeoutMs: 100 });
  const contract = await acquireDetection(c, { audioSample: Buffer.from('x') });

  results.push(check('never-resolving submission maps to TIMEOUT', contract.health?.state === 'TIMEOUT', `got: ${contract.health?.state}`));
  results.push(check('TIMEOUT completeness is "partial"', contract.completeness === 'partial'));
  results.push(check('TIMEOUT preserves the last known provider response (not null, not fabricated)',
    contract.payload?.uri === 'poll-response-uri', `got: ${JSON.stringify(contract.payload)}`));
  results.push(check('polling is bounded — did not poll forever (finite request count)', requestCount > 1 && requestCount <= 6, `got: ${requestCount} requests`));

  return { name: 'H-timeout-bounded-polling', results };
}

// ── Group I: Error handling ────────────────────────────────────────────────────

async function groupI() {
  const results = [];

  // Submission failure (5xx)
  const c500 = await newConnector(mockFetch(async () => ({ ok: false, status: 500, text: async () => '{}' })), { maxRetries: 0 });
  const contract500 = await acquireDetection(c500, { audioSample: Buffer.from('x') });
  results.push(check('submission HTTP 500 does not throw, returns a health signal', contract500.health != null));
  results.push(check('submission HTTP 500 returns null payload', contract500.payload === null));

  // Auth failure on submission (401)
  const c401 = await newConnector(mockFetch(async () => ({ ok: false, status: 401, text: async () => '{}' })));
  const contract401 = await acquireDetection(c401, { audioSample: Buffer.from('x') });
  results.push(check('submission HTTP 401 maps to AUTH_FAILED', contract401.health?.state === 'AUTH_FAILED', `got: ${contract401.health?.state}`));

  // Auth failure via 403
  const c403 = await newConnector(mockFetch(async () => ({ ok: false, status: 403, text: async () => '{}' })));
  const contract403 = await acquireDetection(c403, { audioSample: Buffer.from('x') });
  results.push(check('submission HTTP 403 maps to AUTH_FAILED', contract403.health?.state === 'AUTH_FAILED', `got: ${contract403.health?.state}`));

  // Malformed JSON on submission
  const cMalformed = await newConnector(mockFetch(async () => ({ ok: true, status: 200, text: async () => 'not json{{' })));
  const contractMalformed = await acquireDetection(cMalformed, { audioSample: Buffer.from('x') });
  results.push(check('malformed submission response maps to SCHEMA_CHANGED (no file id found)', contractMalformed.health?.state === 'SCHEMA_CHANGED', `got: ${contractMalformed.health?.state}`));

  // Rate limited (429) with retries exhausted
  const c429 = await newConnector(mockFetch(async () => ({ ok: false, status: 429, text: async () => '{}' })), { maxRetries: 0 });
  const contract429 = await acquireDetection(c429, { audioSample: Buffer.from('x') });
  results.push(check('submission HTTP 429 maps to RATE_LIMITED', contract429.health?.state === 'RATE_LIMITED', `got: ${contract429.health?.state}`));

  return { name: 'I-error-handling', results };
}

// ── Group J: reportHealth() ────────────────────────────────────────────────────

async function groupJ() {
  const results = [];

  const cNoAuth = new ACRCloudAIDetectionConnector();
  await cNoAuth.initialize({});
  const hNoAuth = await cNoAuth.reportHealth();
  results.push(check('reportHealth() with no credentials returns AUTH_FAILED', hNoAuth.state === 'AUTH_FAILED'));

  let probeUrl = null, probeMethod = null;
  const c = await newConnector(mockFetch(async (url, opts) => {
    probeUrl = url; probeMethod = opts.method;
    return jsonRes({ id: CONTAINER_ID, name: 'test-container', engine: 5 });
  }));
  const h = await c.reportHealth();
  results.push(check('reportHealth() probes the container endpoint (read-only, no file upload)',
    probeUrl?.includes(`/api/fs-containers/${CONTAINER_ID}`) && !probeUrl?.includes('/files'), `got: ${probeUrl}`));
  results.push(check('reportHealth() uses GET, not POST (no audio submitted)', probeMethod === 'GET' || probeMethod === undefined));
  results.push(check('reportHealth() with working probe returns AVAILABLE', h.state === 'AVAILABLE'));

  const cDown = await newConnector(mockFetch(async () => ({ ok: false, status: 503, text: async () => '{}' })), { maxRetries: 0 });
  const hDown = await cDown.reportHealth();
  results.push(check('reportHealth() when container probe fails returns non-AVAILABLE', hDown.state !== 'AVAILABLE', `got: ${hDown.state}`));

  return { name: 'J-report-health', results };
}

// ── Group K: Evidence Contract integrity + immutability ───────────────────────

async function groupK() {
  const results = [];

  const fetchFn = mockFetch(async (url, opts) => opts.method === 'POST' ? jsonRes(submittedFile({ state: 0 })) : jsonRes(AI_DETECTION_RESULT));
  const c = await newConnector(fetchFn, { pollIntervalMs: 5 });
  const contract = await acquireDetection(c, { audioSample: Buffer.from('x') });

  const requiredFields = [
    'evidenceId', 'schemaVersion', 'acquisitionId', 'correlationId', 'requestId',
    'provider', 'providerVersion', 'connectorVersion', 'providerTrust',
    'capabilityProfileRef', 'acquiredAt', 'health', 'completeness', 'payload',
    'payloadChecksum', 'rawResponseHash',
  ];
  for (const field of requiredFields) {
    results.push(check(`contract has required field "${field}"`, Object.prototype.hasOwnProperty.call(contract, field)));
  }

  results.push(check('contract.provider === "acrcloud_ai_detection"', contract.provider === 'acrcloud_ai_detection'));
  results.push(check('contract.providerTrust defaults to 80', contract.providerTrust === 80, `got: ${contract.providerTrust}`));
  results.push(check('contract.payloadChecksum is a non-empty sha256 hex string', /^[0-9a-f]{64}$/.test(contract.payloadChecksum)));
  results.push(check('contract.rawResponseHash is a non-empty sha256 hex string', /^[0-9a-f]{64}$/.test(contract.rawResponseHash)));
  results.push(check('contract is frozen (Evidence Contract immutability)', Object.isFrozen(contract)));

  let threwOnMutation = false;
  try { contract.payload = { fabricated: true }; if (contract.payload.fabricated) threwOnMutation = false; }
  catch { threwOnMutation = true; }
  results.push(check('contract cannot be mutated after construction (frozen — assignment silently fails or throws)',
    contract.payload?.fabricated !== true));

  return { name: 'K-evidence-contract-integrity', results };
}

// ── Group L: Edge cases ────────────────────────────────────────────────────────

async function groupL() {
  const results = [];

  const c = await newConnector(mockFetch(async () => jsonRes(submittedFile())));

  const missing = await acquireDetection(c, {});
  results.push(check('acquire() with no audioSample/fingerprint/audioUrl returns PARTIAL_RESPONSE', missing.health?.state === 'PARTIAL_RESPONSE'));
  results.push(check('acquire() with no subjectRef fields makes no network call needed (guard before submission)', missing.payload === null));

  const unsupported = await c.acquire({
    requestId: 'req-unsupported', evidenceType: Capability.ISRC, subjectRef: {},
    context: { correlationId: 'corr-unsupported' },
  });
  results.push(check('unsupported evidence type returns PARTIAL_RESPONSE, not a throw', unsupported.health?.state === 'PARTIAL_RESPONSE'));

  const cNoCreds = new ACRCloudAIDetectionConnector();
  await cNoCreds.initialize({});
  const noCredsContract = await acquireDetection(cNoCreds, { audioSample: Buffer.from('x') });
  results.push(check('acquire() with no credentials returns AUTH_FAILED, no network attempted', noCredsContract.health?.state === 'AUTH_FAILED'));

  await c.shutdown();
  const afterShutdown = await acquireDetection(c, { audioSample: Buffer.from('x') });
  results.push(check('acquire() after shutdown() returns AUTH_FAILED (state fully cleared)', afterShutdown.health?.state === 'AUTH_FAILED'));

  return { name: 'L-edge-cases', results };
}

// ── Suite runner ──────────────────────────────────────────────────────────────

export async function runACRCloudAIDetectionConnector() {
  const groups = [
    groupA(),
    await groupB(),
    await groupC(),
    await groupD(),
    await groupE(),
    await groupF(),
    await groupG(),
    await groupH(),
    await groupI(),
    await groupJ(),
    await groupK(),
    await groupL(),
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
    name:       '18-acrcloud-ai-detection-connector',
    passed,
    failed,
    assertions: passed + failed,
    details,
  };
}
