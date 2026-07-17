// ─── Suite 16: Spotify AVAILABILITY Capability Certification ─────────────────
//
// Phase 3.6 (Spotify) Board Certification — 2026-07-17
//
// Scope: certifies the Spotify connector's AVAILABILITY capability, the final
// connector in the PAL modernization program. No pre-existing certification
// suite existed for SpotifyConnector — this is a new suite, scoped to the
// AVAILABILITY work per Board directive, not a retroactive certification of
// the connector's other 6 pre-existing capabilities (ARTIST_IDENTITY, ALBUMS,
// RELEASES, TRACKS, ISRC, ARTWORK, GENRES).
//
// Background: Spotify removed the bulk `available_markets` field from
// /tracks/{id} and /albums/{id} responses; GET /v1/markets returns 403 under
// standard Development Mode client-credentials access. Live-verified
// 2026-07-17. `?market={ISO_COUNTRY}` still works and returns a per-market
// `is_playable` boolean — one country per call, mirroring TIDAL's existing
// AVAILABILITY shape in this PAL. This connector returns exactly that raw
// evidence; it does not synthesize or reconstruct a bulk markets list.
//
// Groups:
//   A — Static contract: capabilities, provider name, connector version, trust
//   B — SpotifyConnector: initialize + authenticate (with/without credentials)
//   C — AVAILABILITY dispatch: correct endpoint + market param, track path
//   D — AVAILABILITY dispatch: correct endpoint + market param, album path
//   E — AVAILABILITY: missing subjectRef handling (no network call)
//   F — AVAILABILITY: failure path (HTTP error → health mapping)
//   G — reportHealth(): fixed probe path (was /markets, 403 under this
//       app's access tier — see SpotifyConnector.js HEALTH_PROBE_PATH comment)
//   H — Evidence Contract integrity
//
// Uses mocked fetchFn only — no live Spotify credentials required or used.
//
// Returns: { name, passed, failed, assertions, details[] }

import { SpotifyConnector, PROVIDER_NAME, CONNECTOR_VERSION }
  from '../../../provider-acquisition/connectors/spotify/SpotifyConnector.js';
import { SPOTIFY_CAPABILITIES } from '../../../provider-acquisition/connectors/spotify/spotify-capabilities.js';
import { Capability }           from '../../../provider-acquisition/capability/capabilityVocabulary.js';

function check(label, pass, note = '') {
  return { label, pass, note: pass ? '' : (note || 'assertion failed') };
}

const TRACK_ID = '7qiZfU4dY1lWllzX7mPBI3'; // "Shape of You" — Ed Sheeran (also the reportHealth() probe target)
const ALBUM_ID = '3T4tUhGYeRNVUGevb0wThu';

function jsonRes(body) {
  return { ok: true, status: 200, text: async () => JSON.stringify(body) };
}

async function acquireAvailability(connector, subjectRef) {
  return connector.acquire({
    requestId: 'req-availability', evidenceType: Capability.AVAILABILITY, subjectRef,
    context: { correlationId: 'corr-availability' },
  });
}

// ── Group A: Static contract ──────────────────────────────────────────────────

function groupA() {
  const results = [];

  results.push(check('PROVIDER_NAME === "spotify"', PROVIDER_NAME === 'spotify'));
  results.push(check('CONNECTOR_VERSION === "1.0"', CONNECTOR_VERSION === '1.0'));
  results.push(check('SPOTIFY_CAPABILITIES is frozen', Object.isFrozen(SPOTIFY_CAPABILITIES)));
  results.push(check(
    'SPOTIFY_CAPABILITIES includes AVAILABILITY',
    SPOTIFY_CAPABILITIES.includes(Capability.AVAILABILITY),
  ));
  results.push(check(
    'SPOTIFY_CAPABILITIES has exactly 7 entries',
    SPOTIFY_CAPABILITIES.length === 7, `got: ${SPOTIFY_CAPABILITIES.length}`,
  ));
  results.push(check('SpotifyConnector is a class (function)', typeof SpotifyConnector === 'function'));

  return { name: 'A-static-contract', results };
}

// ── Group B: Authentication ───────────────────────────────────────────────────

async function groupB() {
  const results = [];

  const connectorNoCreds = new SpotifyConnector();
  let threw = false;
  try { await connectorNoCreds.initialize({}); } catch { threw = true; }
  results.push(check('initialize() with no credentials and no tokenGenerator throws', threw));

  const connector = new SpotifyConnector();
  await connector.initialize({ clientId: 'id', clientSecret: 'secret', tokenGenerator: () => 'mock-token' });
  const auth = await connector.authenticate();
  results.push(check('authenticate() with valid config returns AVAILABLE', auth.health?.state === 'AVAILABLE'));

  const profile = await connector.discoverCapabilities();
  results.push(check('discoverCapabilities() returns an object', profile !== null && typeof profile === 'object'));

  const ver = connector.getVersion();
  results.push(check('getVersion().provider === "spotify"', ver.provider === 'spotify'));

  await connector.shutdown();
  return { name: 'B-auth-behavior', results };
}

// ── Group C: AVAILABILITY dispatch — track path ───────────────────────────────

async function groupC() {
  const results = [];

  let capturedUrl = null;
  const fetchFn = async (url) => { capturedUrl = url; return jsonRes({ id: TRACK_ID, is_playable: true, name: 'Shape of You' }); };
  const c = new SpotifyConnector();
  await c.initialize({ clientId: 'id', clientSecret: 'secret', tokenGenerator: () => 'mock-token', fetchFn });
  await c.authenticate();

  const contract = await acquireAvailability(c, { spotifyTrackId: TRACK_ID, market: 'US' });

  results.push(check('AVAILABILITY (track) calls GET /tracks/{id}?market={code}',
    capturedUrl?.includes(`/tracks/${TRACK_ID}`) && capturedUrl?.includes('market=US'), `got: ${capturedUrl}`));
  results.push(check('AVAILABILITY (track) health is AVAILABLE', contract.health?.state === 'AVAILABLE', `got: ${contract.health?.state}`));
  results.push(check('AVAILABILITY (track) completeness is "full"', contract.completeness === 'full'));
  results.push(check('AVAILABILITY (track) payload preserves raw is_playable', contract.payload?.is_playable === true));

  // is_playable genuinely varies per market — not fabricated, passed through
  let capturedUrl2 = null;
  const fetchFn2 = async (url) => { capturedUrl2 = url; return jsonRes({ id: TRACK_ID, is_playable: false, name: 'Shape of You' }); };
  const c2 = new SpotifyConnector();
  await c2.initialize({ clientId: 'id', clientSecret: 'secret', tokenGenerator: () => 'mock-token', fetchFn: fetchFn2 });
  await c2.authenticate();
  const contract2 = await acquireAvailability(c2, { spotifyTrackId: TRACK_ID, market: 'KP' });
  results.push(check('AVAILABILITY (track) requests market=KP when specified', capturedUrl2?.includes('market=KP'), `got: ${capturedUrl2}`));
  results.push(check('AVAILABILITY (track) payload reflects is_playable:false raw, uninterpreted', contract2.payload?.is_playable === false));

  return { name: 'C-availability-track-path', results };
}

// ── Group D: AVAILABILITY dispatch — album path ───────────────────────────────

async function groupD() {
  const results = [];

  let capturedUrl = null;
  const fetchFn = async (url) => { capturedUrl = url; return jsonRes({ id: ALBUM_ID, name: '÷' }); };
  const c = new SpotifyConnector();
  await c.initialize({ clientId: 'id', clientSecret: 'secret', tokenGenerator: () => 'mock-token', fetchFn });
  await c.authenticate();

  const contract = await acquireAvailability(c, { spotifyAlbumId: ALBUM_ID, market: 'GB' });

  results.push(check('AVAILABILITY (album) calls GET /albums/{id}?market={code}',
    capturedUrl?.includes(`/albums/${ALBUM_ID}`) && capturedUrl?.includes('market=GB'), `got: ${capturedUrl}`));
  results.push(check('AVAILABILITY (album) health is AVAILABLE', contract.health?.state === 'AVAILABLE'));

  // Track ID takes priority when both track and album are supplied
  let capturedUrl2 = null;
  const fetchFn2 = async (url) => { capturedUrl2 = url; return jsonRes({ id: TRACK_ID }); };
  const c2 = new SpotifyConnector();
  await c2.initialize({ clientId: 'id', clientSecret: 'secret', tokenGenerator: () => 'mock-token', fetchFn: fetchFn2 });
  await c2.authenticate();
  await acquireAvailability(c2, { spotifyTrackId: TRACK_ID, spotifyAlbumId: ALBUM_ID, market: 'US' });
  results.push(check('AVAILABILITY: spotifyTrackId takes priority over spotifyAlbumId when both present',
    capturedUrl2?.includes('/tracks/'), `got: ${capturedUrl2}`));

  return { name: 'D-availability-album-path', results };
}

// ── Group E: Missing subjectRef handling ──────────────────────────────────────

async function groupE() {
  const results = [];

  let networkCalled = false;
  const fetchFn = async () => { networkCalled = true; return jsonRes({}); };

  // No market at all
  const c1 = new SpotifyConnector();
  await c1.initialize({ clientId: 'id', clientSecret: 'secret', tokenGenerator: () => 'mock-token', fetchFn });
  await c1.authenticate();
  const r1 = await acquireAvailability(c1, { spotifyTrackId: TRACK_ID });
  results.push(check('AVAILABILITY with no market returns PARTIAL_RESPONSE', r1.health?.state === 'PARTIAL_RESPONSE'));
  results.push(check('AVAILABILITY with no market makes no network call', networkCalled === false));

  // Market present, but neither track nor album ID
  const c2 = new SpotifyConnector();
  await c2.initialize({ clientId: 'id', clientSecret: 'secret', tokenGenerator: () => 'mock-token', fetchFn });
  await c2.authenticate();
  const r2 = await acquireAvailability(c2, { market: 'US' });
  results.push(check('AVAILABILITY with market but no track/album ID returns PARTIAL_RESPONSE', r2.health?.state === 'PARTIAL_RESPONSE'));
  results.push(check('AVAILABILITY with market but no track/album ID makes no network call', networkCalled === false));

  return { name: 'E-missing-subject-ref', results };
}

// ── Group F: Failure path ─────────────────────────────────────────────────────

async function groupF() {
  const results = [];

  const fetchFn = async () => ({ ok: false, status: 404, text: async () => '{"error":{"status":404,"message":"non existing id"}}' });
  const c = new SpotifyConnector();
  await c.initialize({ clientId: 'id', clientSecret: 'secret', tokenGenerator: () => 'mock-token', fetchFn });
  await c.authenticate();
  const contract = await acquireAvailability(c, { spotifyTrackId: 'nonexistent', market: 'US' });

  results.push(check('AVAILABILITY on HTTP 404 does not return AVAILABLE', contract.health?.state !== 'AVAILABLE'));
  results.push(check('AVAILABILITY on HTTP 404 returns null payload', contract.payload === null));
  results.push(check('AVAILABILITY on HTTP 404 completeness is "empty"', contract.completeness === 'empty'));

  const rateLimited = new SpotifyConnector();
  const fetchFnRL = async () => ({ ok: false, status: 429, text: async () => '{}' });
  await rateLimited.initialize({ clientId: 'id', clientSecret: 'secret', tokenGenerator: () => 'mock-token', fetchFn: fetchFnRL, maxRetries: 0 });
  await rateLimited.authenticate();
  const contractRL = await acquireAvailability(rateLimited, { spotifyTrackId: TRACK_ID, market: 'US' });
  results.push(check('AVAILABILITY on HTTP 429 does not throw and returns a health signal',
    contractRL.health !== null && contractRL.health !== undefined));

  return { name: 'F-failure-path', results };
}

// ── Group G: reportHealth() probe fix ─────────────────────────────────────────

async function groupG() {
  const results = [];

  // No token → AUTH_FAILED, no network call
  const c1 = new SpotifyConnector();
  await c1.initialize({ clientId: 'id', clientSecret: 'secret', tokenGenerator: () => 'mock-token' });
  const h1 = await c1.reportHealth();
  results.push(check('reportHealth() without authenticate() returns AUTH_FAILED', h1.state === 'AUTH_FAILED'));

  // Probe now hits /tracks/{id}, not the 403-under-this-tier /markets endpoint
  let capturedUrl = null;
  const fetchFn = async (url) => { capturedUrl = url; return jsonRes({ id: TRACK_ID, name: 'Shape of You' }); };
  const c2 = new SpotifyConnector();
  await c2.initialize({ clientId: 'id', clientSecret: 'secret', tokenGenerator: () => 'mock-token', fetchFn });
  await c2.authenticate();
  const h2 = await c2.reportHealth();
  results.push(check('reportHealth() no longer probes /markets (was 403 under Development Mode access)',
    !capturedUrl?.includes('/markets'), `got: ${capturedUrl}`));
  results.push(check('reportHealth() probes /tracks/{id} instead', capturedUrl?.includes('/tracks/'), `got: ${capturedUrl}`));
  results.push(check('reportHealth() with working probe returns AVAILABLE', h2.state === 'AVAILABLE', `got: ${h2.state}`));

  return { name: 'G-report-health-probe-fix', results };
}

// ── Group H: Evidence Contract integrity ──────────────────────────────────────

async function groupH() {
  const results = [];

  const fetchFn = async () => jsonRes({ id: TRACK_ID, is_playable: true });
  const c = new SpotifyConnector();
  await c.initialize({ clientId: 'id', clientSecret: 'secret', tokenGenerator: () => 'mock-token', fetchFn });
  await c.authenticate();
  const contract = await acquireAvailability(c, { spotifyTrackId: TRACK_ID, market: 'US' });

  const requiredFields = [
    'evidenceId', 'schemaVersion', 'acquisitionId', 'correlationId', 'requestId',
    'provider', 'providerVersion', 'connectorVersion', 'providerTrust',
    'capabilityProfileRef', 'acquiredAt', 'health', 'completeness', 'payload',
    'payloadChecksum', 'rawResponseHash',
  ];
  for (const field of requiredFields) {
    results.push(check(`contract has required field "${field}"`, Object.prototype.hasOwnProperty.call(contract, field)));
  }

  results.push(check('contract.provider === "spotify"', contract.provider === 'spotify'));
  results.push(check('contract.payloadChecksum is a non-empty sha256 hex string', /^[0-9a-f]{64}$/.test(contract.payloadChecksum)));
  results.push(check('contract is frozen (Evidence Contract immutability)', Object.isFrozen(contract)));

  return { name: 'H-evidence-contract-integrity', results };
}

// ── Suite runner ──────────────────────────────────────────────────────────────

export async function runSpotifyConnector() {
  const groups = [
    groupA(),
    await groupB(),
    await groupC(),
    await groupD(),
    await groupE(),
    await groupF(),
    await groupG(),
    await groupH(),
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
    name:       '16-spotify-connector',
    passed,
    failed,
    assertions: passed + failed,
    details,
  };
}
