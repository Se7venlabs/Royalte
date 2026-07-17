// ─── Suite 17: TIDAL Connector™ Certification ─────────────────────────────────
//
// Phase 4.0 (TIDAL) Board Certification — 2026-07-17
//
// First certification suite for TidalConnector — none existed previously.
// Written as part of the Board-directed TIDAL Constitutional Audit modernization
// pass: corrected capability declaration (ISRC/RELEASES were dispatched but not
// declared), refactored #fetchArtistIdentity to return raw provider evidence
// instead of a reshaped payload, and built this suite.
//
// Groups:
//   A — Static contract: capabilities, provider name, connector version, trust
//   B — Authentication: initialize()/authenticate() with/without credentials
//   C — ARTIST_IDENTITY: direct path (tidalArtistId known) — raw passthrough
//   D — ARTIST_IDENTITY: search path, detail fetch succeeds — raw JSON:API envelope
//   E — ARTIST_IDENTITY: search path, detail fetch fails — raw fallback resource
//   F — ARTIST_IDENTITY: no identity-lock match — PARTIAL_RESPONSE
//   G — ALBUMS / RELEASES dispatch (aliased capabilities, same endpoint)
//   H — TRACKS / ISRC dispatch (aliased capabilities, collapseBy=FINGERPRINT required)
//   I — reportHealth()
//   J — Evidence Contract integrity
//   K — Edge cases: missing subjectRef, HTTP failures, health mapping
//
// Uses mocked fetchFn only — no live TIDAL credentials required or used.
//
// Returns: { name, passed, failed, assertions, details[] }

import { TidalConnector, PROVIDER_NAME, CONNECTOR_VERSION }
  from '../../../provider-acquisition/connectors/tidal/TidalConnector.js';
import { TIDAL_CAPABILITIES } from '../../../provider-acquisition/connectors/tidal/tidal-capabilities.js';
import { Capability }         from '../../../provider-acquisition/capability/capabilityVocabulary.js';

function check(label, pass, note = '') {
  return { label, pass, note: pass ? '' : (note || 'assertion failed') };
}

const ARTIST_ID = '4972312'; // Black Alternative — per connector header comment, live-verified

function jsonRes(body) {
  return { ok: true, status: 200, text: async () => JSON.stringify(body) };
}

const SEARCH_PAYLOAD = {
  data:     [{ id: ARTIST_ID, type: 'artists' }],
  included: [{ id: ARTIST_ID, type: 'artists', attributes: {
    name: 'Black Alternative', popularity: 0.42,
    externalLinks: [{ href: 'https://tidal.com/browse/artist/4972312', meta: { type: 'TIDAL_SHARING' } }],
  } }],
};

const DETAIL_PAYLOAD = {
  data: { id: ARTIST_ID, type: 'artists', attributes: {
    name: 'Black Alternative', popularity: 0.42,
    externalLinks: [{ href: 'https://tidal.com/browse/artist/4972312', meta: { type: 'TIDAL_SHARING' } }],
  } },
  included: [{ id: 'art1', type: 'artworks', attributes: {
    files: [{ href: 'https://img/large.jpg', meta: { width: 1000 } }],
  } }],
};

const ALBUMS_PAYLOAD = { data: [{ id: 'al1', type: 'albums' }], included: [{ id: 'al1', type: 'albums', attributes: { title: 'Test Album' } }] };
const TRACKS_PAYLOAD = { data: [{ id: 'tr1', type: 'tracks' }], included: [{ id: 'tr1', type: 'tracks', attributes: { title: 'Test Track', isrc: 'TCABM1310294' } }] };

function mockFetch(routes) {
  return async (url) => {
    for (const [match, res] of routes) {
      if (url.includes(match)) return typeof res === 'function' ? res(url) : res;
    }
    return { ok: false, status: 404, text: async () => '{}' };
  };
}

async function newConnector(fetchFn, config = {}) {
  const c = new TidalConnector();
  await c.initialize({ clientId: 'id', clientSecret: 'secret', tokenGenerator: () => 'mock-token', fetchFn, ...config });
  await c.authenticate();
  return c;
}

async function acquireIdentity(connector, subjectRef) {
  return connector.acquire({
    requestId: 'req-identity', evidenceType: Capability.ARTIST_IDENTITY, subjectRef,
    context: { correlationId: 'corr-identity' },
  });
}

// ── Group A: Static contract ──────────────────────────────────────────────────

function groupA() {
  const results = [];

  results.push(check('PROVIDER_NAME === "tidal"', PROVIDER_NAME === 'tidal'));
  results.push(check('CONNECTOR_VERSION === "1.0"', CONNECTOR_VERSION === '1.0'));
  results.push(check('TIDAL_CAPABILITIES is frozen', Object.isFrozen(TIDAL_CAPABILITIES)));
  for (const cap of ['ARTIST_IDENTITY', 'ALBUMS', 'RELEASES', 'TRACKS', 'ISRC', 'ARTWORK']) {
    results.push(check(`TIDAL_CAPABILITIES includes ${cap}`, TIDAL_CAPABILITIES.includes(Capability[cap])));
  }
  results.push(check('TIDAL_CAPABILITIES has exactly 6 entries', TIDAL_CAPABILITIES.length === 6, `got: ${TIDAL_CAPABILITIES.length}`));
  results.push(check('TidalConnector is a class (function)', typeof TidalConnector === 'function'));

  return { name: 'A-static-contract', results };
}

// ── Group B: Authentication ───────────────────────────────────────────────────

async function groupB() {
  const results = [];

  const cNoCreds = new TidalConnector();
  let threw = false;
  try { await cNoCreds.initialize({}); } catch { threw = true; }
  results.push(check('initialize() with no credentials and no tokenGenerator throws', threw));

  const c = await newConnector(mockFetch([]));
  const auth = await c.authenticate();
  results.push(check('authenticate() with valid config returns AVAILABLE', auth.health?.state === 'AVAILABLE'));
  results.push(check('authenticate() returns a token in credentials', !!auth.credentials?.token));

  const profile = await c.discoverCapabilities();
  results.push(check('discoverCapabilities() returns an object', profile !== null && typeof profile === 'object'));

  const ver = c.getVersion();
  results.push(check('getVersion().provider === "tidal"', ver.provider === 'tidal'));
  results.push(check('getVersion().providerApiVersion === "v2"', ver.providerApiVersion === 'v2'));

  await c.shutdown();
  return { name: 'B-auth-behavior', results };
}

// ── Group C: ARTIST_IDENTITY — direct path ────────────────────────────────────

async function groupC() {
  const results = [];

  let capturedUrl = null;
  const fetchFn = mockFetch([[`/artists/${ARTIST_ID}`, (url) => { capturedUrl = url; return jsonRes(DETAIL_PAYLOAD); }]]);
  const c = await newConnector(fetchFn);
  const contract = await acquireIdentity(c, { tidalArtistId: ARTIST_ID });

  results.push(check('direct path calls GET /artists/{id}?countryCode=US&include=profileArt',
    capturedUrl?.includes(`/artists/${ARTIST_ID}`) && capturedUrl?.includes('countryCode=US') && capturedUrl?.includes('include=profileArt'),
    `got: ${capturedUrl}`));
  results.push(check('direct path health is AVAILABLE', contract.health?.state === 'AVAILABLE'));
  results.push(check('direct path payload is raw JSON:API envelope (data.id present)', contract.payload?.data?.id === ARTIST_ID));

  return { name: 'C-identity-direct-path', results };
}

// ── Group D: ARTIST_IDENTITY — search path, detail succeeds ──────────────────

async function groupD() {
  const results = [];

  let searchUrl = null, detailUrl = null;
  const fetchFn = mockFetch([
    ['/searchResults/', (url) => { searchUrl = url; return jsonRes(SEARCH_PAYLOAD); }],
    [`/artists/${ARTIST_ID}`, (url) => { detailUrl = url; return jsonRes(DETAIL_PAYLOAD); }],
  ]);
  const c = await newConnector(fetchFn);
  const contract = await acquireIdentity(c, { artistName: 'Black Alternative' });

  results.push(check('search path calls GET /searchResults/{query}/relationships/artists',
    searchUrl?.includes('/searchResults/') && searchUrl?.includes('relationships/artists'), `got: ${searchUrl}`));
  results.push(check('search path then calls GET /artists/{matched id}', detailUrl?.includes(`/artists/${ARTIST_ID}`), `got: ${detailUrl}`));
  results.push(check('search path (detail succeeds) health is AVAILABLE', contract.health?.state === 'AVAILABLE'));
  results.push(check('search path (detail succeeds) completeness is "full"', contract.completeness === 'full'));
  results.push(check('search path (detail succeeds) payload is raw envelope, not reshaped',
    contract.payload?.data?.id === ARTIST_ID && contract.payload?.data?.attributes?.name === 'Black Alternative',
    `got: ${JSON.stringify(contract.payload).slice(0, 150)}`));
  results.push(check('search path (detail succeeds) payload has no hand-picked flat fields (no top-level .name)',
    contract.payload?.name === undefined));
  results.push(check('search path (detail succeeds) payload preserves included artworks',
    Array.isArray(contract.payload?.included) && contract.payload.included[0]?.type === 'artworks'));

  return { name: 'D-identity-search-detail-succeeds', results };
}

// ── Group E: ARTIST_IDENTITY — search path, detail fails (fallback) ──────────

async function groupE() {
  const results = [];

  const fetchFn = mockFetch([
    ['/searchResults/', () => jsonRes(SEARCH_PAYLOAD)],
    [`/artists/${ARTIST_ID}`, () => ({ ok: false, status: 500, text: async () => '{}' })],
  ]);
  const c = await newConnector(fetchFn, { maxRetries: 0 });
  const contract = await acquireIdentity(c, { artistName: 'Black Alternative' });

  results.push(check('fallback path health is still AVAILABLE (degraded, not failed)', contract.health?.state === 'AVAILABLE'));
  results.push(check('fallback path completeness is "partial"', contract.completeness === 'partial'));
  results.push(check('fallback path payload is the raw identity-locked resource (bare {id, attributes})',
    contract.payload?.id === ARTIST_ID && contract.payload?.attributes?.name === 'Black Alternative',
    `got: ${JSON.stringify(contract.payload)}`));
  results.push(check('fallback path payload is not the full ambiguous search envelope (no top-level included[])',
    contract.payload?.included === undefined));

  return { name: 'E-identity-search-detail-fails-fallback', results };
}

// ── Group F: ARTIST_IDENTITY — no identity-lock match ─────────────────────────

async function groupF() {
  const results = [];

  const fetchFn = mockFetch([['/searchResults/', () => jsonRes(SEARCH_PAYLOAD)]]);
  const c = await newConnector(fetchFn);
  const contract = await acquireIdentity(c, { artistName: 'Some Completely Different Artist' });

  results.push(check('no-match returns PARTIAL_RESPONSE', contract.health?.state === 'PARTIAL_RESPONSE', `got: ${contract.health?.state}`));
  results.push(check('no-match returns null payload', contract.payload === null));
  results.push(check('no-match completeness is "empty"', contract.completeness === 'empty'));

  return { name: 'F-identity-no-match', results };
}

// ── Group G: ALBUMS / RELEASES dispatch ────────────────────────────────────────

async function groupG() {
  const results = [];

  for (const capability of [Capability.ALBUMS, Capability.RELEASES]) {
    let capturedUrl = null;
    const fetchFn = mockFetch([[`/artists/${ARTIST_ID}/relationships/albums`, (url) => { capturedUrl = url; return jsonRes(ALBUMS_PAYLOAD); }]]);
    const c = await newConnector(fetchFn);
    const contract = await c.acquire({
      requestId: 'req-albums', evidenceType: capability, subjectRef: { tidalArtistId: ARTIST_ID },
      context: { correlationId: 'corr-albums' },
    });
    results.push(check(`${capability} routes to GET /artists/{id}/relationships/albums`,
      capturedUrl?.includes(`/artists/${ARTIST_ID}/relationships/albums`), `got: ${capturedUrl}`));
    results.push(check(`${capability} payload preserves raw included[] albums`,
      contract.payload?.included?.[0]?.attributes?.title === 'Test Album'));
  }

  const cMissing = await newConnector(mockFetch([]));
  const missing = await cMissing.acquire({
    requestId: 'req-albums-missing', evidenceType: Capability.ALBUMS, subjectRef: {},
    context: { correlationId: 'corr-albums-missing' },
  });
  results.push(check('ALBUMS with no tidalArtistId returns PARTIAL_RESPONSE', missing.health?.state === 'PARTIAL_RESPONSE'));

  return { name: 'G-albums-releases-dispatch', results };
}

// ── Group H: TRACKS / ISRC dispatch ────────────────────────────────────────────

async function groupH() {
  const results = [];

  for (const capability of [Capability.TRACKS, Capability.ISRC]) {
    let capturedUrl = null;
    const fetchFn = mockFetch([[`/artists/${ARTIST_ID}/relationships/tracks`, (url) => { capturedUrl = url; return jsonRes(TRACKS_PAYLOAD); }]]);
    const c = await newConnector(fetchFn);
    const contract = await c.acquire({
      requestId: 'req-tracks', evidenceType: capability, subjectRef: { tidalArtistId: ARTIST_ID },
      context: { correlationId: 'corr-tracks' },
    });
    results.push(check(`${capability} routes to GET /artists/{id}/relationships/tracks`,
      capturedUrl?.includes(`/artists/${ARTIST_ID}/relationships/tracks`), `got: ${capturedUrl}`));
    results.push(check(`${capability} request includes collapseBy=FINGERPRINT (required by TIDAL API)`,
      capturedUrl?.includes('collapseBy=FINGERPRINT'), `got: ${capturedUrl}`));
    results.push(check(`${capability} payload preserves raw isrc field`,
      contract.payload?.included?.[0]?.attributes?.isrc === 'TCABM1310294'));
  }

  return { name: 'H-tracks-isrc-dispatch', results };
}

// ── Group I: reportHealth() ────────────────────────────────────────────────────

async function groupI() {
  const results = [];

  const cNoAuth = new TidalConnector();
  await cNoAuth.initialize({ clientId: 'id', clientSecret: 'secret', tokenGenerator: () => 'mock-token' });
  const h1 = await cNoAuth.reportHealth();
  results.push(check('reportHealth() without authenticate() returns AUTH_FAILED', h1.state === 'AUTH_FAILED'));

  let probeUrl = null;
  const fetchFn = mockFetch([['/searchResults/', (url) => { probeUrl = url; return jsonRes(SEARCH_PAYLOAD); }]]);
  const c = await newConnector(fetchFn);
  const h2 = await c.reportHealth();
  results.push(check('reportHealth() probes a search endpoint', probeUrl?.includes('/searchResults/'), `got: ${probeUrl}`));
  results.push(check('reportHealth() with working probe returns AVAILABLE', h2.state === 'AVAILABLE'));

  const fetchFnDown = mockFetch([['/searchResults/', () => ({ ok: false, status: 503, text: async () => '{}' })]]);
  const cDown = await newConnector(fetchFnDown, { maxRetries: 0 });
  const h3 = await cDown.reportHealth();
  results.push(check('reportHealth() when probe fails returns a non-AVAILABLE state', h3.state !== 'AVAILABLE', `got: ${h3.state}`));

  return { name: 'I-report-health', results };
}

// ── Group J: Evidence Contract integrity ──────────────────────────────────────

async function groupJ() {
  const results = [];

  const fetchFn = mockFetch([[`/artists/${ARTIST_ID}`, () => jsonRes(DETAIL_PAYLOAD)]]);
  const c = await newConnector(fetchFn);
  const contract = await acquireIdentity(c, { tidalArtistId: ARTIST_ID });

  const requiredFields = [
    'evidenceId', 'schemaVersion', 'acquisitionId', 'correlationId', 'requestId',
    'provider', 'providerVersion', 'connectorVersion', 'providerTrust',
    'capabilityProfileRef', 'acquiredAt', 'health', 'completeness', 'payload',
    'payloadChecksum', 'rawResponseHash',
  ];
  for (const field of requiredFields) {
    results.push(check(`contract has required field "${field}"`, Object.prototype.hasOwnProperty.call(contract, field)));
  }

  results.push(check('contract.provider === "tidal"', contract.provider === 'tidal'));
  results.push(check('contract.providerTrust defaults to 85', contract.providerTrust === 85, `got: ${contract.providerTrust}`));
  results.push(check('contract.payloadChecksum is a non-empty sha256 hex string', /^[0-9a-f]{64}$/.test(contract.payloadChecksum)));
  results.push(check('contract is frozen (Evidence Contract immutability)', Object.isFrozen(contract)));

  return { name: 'J-evidence-contract-integrity', results };
}

// ── Group K: Edge cases ────────────────────────────────────────────────────────

async function groupK() {
  const results = [];

  const c = await newConnector(mockFetch([]));

  const missingRef = await acquireIdentity(c, {});
  results.push(check('ARTIST_IDENTITY with no artistName/tidalArtistId returns PARTIAL_RESPONSE', missingRef.health?.state === 'PARTIAL_RESPONSE'));

  const noAuth = new TidalConnector();
  await noAuth.initialize({ clientId: 'id', clientSecret: 'secret', tokenGenerator: () => 'mock-token' });
  const noAuthContract = await acquireIdentity(noAuth, { tidalArtistId: ARTIST_ID });
  results.push(check('acquire() without authenticate() returns AUTH_FAILED', noAuthContract.health?.state === 'AUTH_FAILED'));

  const c401 = await newConnector(mockFetch([[`/artists/${ARTIST_ID}`, () => ({ ok: false, status: 401, text: async () => '{}' })]]));
  const contract401 = await acquireIdentity(c401, { tidalArtistId: ARTIST_ID });
  results.push(check('HTTP 401 maps to AUTH_FAILED', contract401.health?.state === 'AUTH_FAILED', `got: ${contract401.health?.state}`));

  const c429 = await newConnector(mockFetch([[`/artists/${ARTIST_ID}`, () => ({ ok: false, status: 429, text: async () => '{}' })]]), { maxRetries: 0 });
  const contract429 = await acquireIdentity(c429, { tidalArtistId: ARTIST_ID });
  results.push(check('HTTP 429 maps to RATE_LIMITED', contract429.health?.state === 'RATE_LIMITED', `got: ${contract429.health?.state}`));

  const unsupported = await c.acquire({
    requestId: 'req-unsupported', evidenceType: Capability.GENRES, subjectRef: {},
    context: { correlationId: 'corr-unsupported' },
  });
  results.push(check('unsupported evidence type returns PARTIAL_RESPONSE, not a throw', unsupported.health?.state === 'PARTIAL_RESPONSE'));

  return { name: 'K-edge-cases', results };
}

// ── Suite runner ──────────────────────────────────────────────────────────────

export async function runTidalConnector() {
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
    name:       '17-tidal-connector',
    passed,
    failed,
    assertions: passed + failed,
    details,
  };
}
