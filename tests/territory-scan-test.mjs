// Territory Intelligence Engine™ Phase 5.2 — api/territory-scan.js regression
//
// Black-box handler tests. Spotify's fetch surface is mocked (entity
// resolution only — no available_markets dependency remains). Apple
// credentials are intentionally left unset in this test environment, which
// exercises acquireAppleEvidence()'s real "credentials not configured"
// degradation path — deterministic, no live network calls to Apple, and
// proves the endpoint degrades honestly (NOT_EVALUATED/unknown) rather than
// crashing when Apple is unavailable, matching this endpoint's pre-existing
// non-blocking philosophy.
//
// No test runner / framework — throws on first failure, like pipeline-test.mjs.

// Spotify credentials are required by getSpotifyToken() before fetch is ever
// called — dummy values are safe since fetch is fully mocked below and no
// real network call is made. Apple credentials are deliberately left unset
// (see header note) to exercise the real degradation path.
process.env.SPOTIFY_CLIENT_ID = 'test-client-id';
process.env.SPOTIFY_CLIENT_SECRET = 'test-client-secret';
delete process.env.APPLE_TEAM_ID;
delete process.env.APPLE_KEY_ID;
delete process.env.APPLE_PRIVATE_KEY;

let passed = 0;
function assert(name, cond) {
  if (!cond) throw new Error(`FAIL: ${name}`);
  passed++;
  console.log(`  ok  ${name}`);
}

function mockRes() {
  const res = {
    _status: 200,
    _headers: {},
    _json: null,
    _ended: false,
    setHeader(k, v) { res._headers[k] = v; return res; },
    status(code) { res._status = code; return res; },
    json(obj) { res._json = obj; return res; },
    end() { res._ended = true; return res; },
  };
  return res;
}

// ── Mock Spotify fetch ────────────────────────────────────────────────────────
function installSpotifyFetchMock() {
  global.fetch = async (url) => {
    const u = String(url);
    if (u.includes('accounts.spotify.com/api/token')) {
      return { status: 200, ok: true, json: async () => ({ access_token: 'mock-token' }) };
    }
    if (u.includes('/v1/tracks/track123')) {
      return {
        status: 200, ok: true,
        json: async () => ({
          name: 'Mock Track',
          artists: [{ name: 'Mock Artist' }],
          external_ids: { isrc: 'US1234567890' },
          album: { name: 'Mock Album' },
        }),
      };
    }
    if (u.includes('/v1/albums/album123')) {
      return {
        status: 200, ok: true,
        json: async () => ({ name: 'Mock Album', artists: [{ name: 'Mock Artist' }] }),
      };
    }
    if (u.includes('/v1/artists/artist123')) {
      return { status: 200, ok: true, json: async () => ({ name: 'Mock Artist' }) };
    }
    throw new Error(`Unexpected fetch in territory-scan test: ${u}`);
  };
}

const { default: handler } = await import('../api/territory-scan.js');

// ── 1. Method / input validation ──────────────────────────────────────────────
console.log('\n[TEST] Method and input validation...');
{
  const res = mockRes();
  await handler({ method: 'GET', body: {} }, res);
  assert('GET rejected with 405', res._status === 405);
}
{
  const res = mockRes();
  await handler({ method: 'OPTIONS', body: {} }, res);
  assert('OPTIONS handled with 200', res._status === 200 && res._ended);
}
{
  const res = mockRes();
  await handler({ method: 'POST', body: {} }, res);
  assert('missing url rejected with 400', res._status === 400);
}
{
  const res = mockRes();
  await handler({ method: 'POST', body: { url: 'https://example.com/not-spotify' } }, res);
  assert('non-Spotify URL rejected with 400', res._status === 400);
}

// ── 2. Full handler run — track, free tier ────────────────────────────────────
console.log('\n[TEST] Track scan — free tier (Apple credentials absent, honest degradation)...');
installSpotifyFetchMock();
{
  const res = mockRes();
  await handler(
    { method: 'POST', body: { url: 'https://open.spotify.com/track/track123' } },
    res
  );
  assert('200 response', res._status === 200);
  const body = res._json;
  assert('success: true', body.success === true);
  assert('dataSourceVersion present', body.dataSourceVersion === 'territory-intelligence-engine-v1.0-apple-only');
  assert('entity.name resolved from Spotify', body.entity.name === 'Mock Artist');
  assert('entity.trackTitle resolved', body.entity.trackTitle === 'Mock Track');
  assert('entity.isrc resolved', body.entity.isrc === 'US1234567890');
  assert('scan_note present and honest about Engine mechanism', typeof body.entity.scan_note === 'string' && body.entity.scan_note.includes('Territory Intelligence Engine'));
  assert('planTier defaults to free', body.planTier === 'free');
  assert('free tier: territories capped at 5', body.territories.length <= 5);
  assert('free tier: insights capped at 2', body.insights.length <= 2);
  assert('free tier: coverage_score present', typeof body.coverage_score === 'number');

  // Apple credentials are absent in this test env -> Engine returns
  // NOT_EVALUATED for everything -> status must be 'unknown' everywhere,
  // never a fabricated 'available' or 'unavailable'.
  assert('all territories honestly unknown (no Apple creds in test env)',
    body.territories.every(t => t.status === 'unknown'));
  assert('spotify_available is null, not false, everywhere (honest "not sourced")',
    body.territories.every(t => t.spotify_available === null));
  assert('confidence never fabricated as Verified (Apple-only ceiling is Inferred)',
    body.territories.every(t => t.confidence !== 'Verified'));
  assert('status never the reserved "unavailable" value',
    body.territories.every(t => t.status !== 'unavailable'));
  assert('Apple-only disclosure insight present',
    body.insights.some(i => i.includes('Apple Music data only')));
}

// ── 3. Album scan — audit tier ────────────────────────────────────────────────
console.log('\n[TEST] Album scan — audit tier...');
{
  const res = mockRes();
  await handler(
    { method: 'POST', body: { url: 'https://open.spotify.com/album/album123', planTier: 'audit' } },
    res
  );
  assert('200 response', res._status === 200);
  const body = res._json;
  assert('planTier audit', body.planTier === 'audit');
  assert('audit tier: territories between 25 and 50', body.territories.length >= 25 && body.territories.length <= 50);
  assert('audit tier: coverage object present', typeof body.coverage === 'object');
  assert('entity.type album', body.entity.type === 'album');
}

// ── 4. Artist scan — subscription tier (full universe) ────────────────────────
console.log('\n[TEST] Artist scan — subscription tier...');
{
  const res = mockRes();
  await handler(
    { method: 'POST', body: { url: 'https://open.spotify.com/artist/artist123', planTier: 'subscription' } },
    res
  );
  assert('200 response', res._status === 200);
  const body = res._json;
  assert('planTier subscription', body.planTier === 'subscription');
  assert('subscription tier: full evaluated universe returned', body.territories.length === body._meta.total_territories_in_dataset);
  assert('subscription tier: upgrade_available false', body.upgrade_available === false);
  assert('entity.type artist', body.entity.type === 'artist');
  // Every evaluated country appears exactly once (no duplicate rows)
  const codes = body.territories.map(t => t.country_code);
  assert('no duplicate country rows', new Set(codes).size === codes.length);
}

console.log(`\n✓ Territory scan (Phase 5.2) tests passed. ${passed} assertions.\n`);
