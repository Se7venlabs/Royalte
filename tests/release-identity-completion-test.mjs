// Release-Centric Identity Completion — regression test
// (Phase 2 Recovery, Scan Entry Point Audit™ Findings 1 & 2, 2026-07-21)
// Run: node tests/release-identity-completion-test.mjs
//
// Proves both verified Findings from governance/SCAN_ENTRY_POINT_AUDIT_REPORT.md
// are fixed:
//
//   Finding 1 — Artist + Song (manual entry, api/resolve-artist.js) discarded
//   the Rule-A-matched song's own release identity and returned an
//   artist-only URL, so the Canonical Scan Subject™ (PR #384) never saw a
//   release even when the song had already been confirmed.
//
//   Finding 2 — Apple Music Track URL (paste): resolveToArtist()'s
//   Spotify-matched return branch (run-scan.js) dropped trackTitle/trackIsrc
//   that resolveAppleArtist() had already resolved correctly one call
//   earlier; only the degraded (no-Spotify-match) branch preserved them.
//
// Both fixes are exercised here through the REAL exported functions
// (resolve-artist.js's handler, resolveToArtist(), seedCanonicalScanSubject()),
// not re-implementations. No real network calls are made -- Apple + Spotify
// HTTP calls are mocked via a routes-based fetch stub; Apple JWT signing
// uses a real, locally-generated throwaway EC P-256 key (signing is local,
// no network validation, so this needs no live credentials).

import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';

import { resolveToArtist } from '../api/_lib/run-scan.js';
import { seedCanonicalScanSubject } from '../api/_lib/canonical-scan-subject-assembler.js';
import resolveArtistHandler from '../api/resolve-artist.js';

let passed = 0;
let failed = 0;

async function test(name, fn) {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${name}\n    ${err.message}`);
    failed++;
  }
}

// ── Apple credentials — real throwaway EC P-256 key, local signing only ──────
// generateAppleToken() (api/apple-token.js) validates the key is a real EC
// key and signs a JWT locally; it never calls Apple. No live credentials
// needed for this to succeed.
const { privateKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
process.env.APPLE_TEAM_ID    = 'TESTTEAM01';
process.env.APPLE_KEY_ID     = 'TESTKEY001';
process.env.APPLE_PRIVATE_KEY = privateKey.export({ type: 'pkcs8', format: 'pem' });

// ── Fixture identity ──────────────────────────────────────────────────────────
const ARTIST_NAME      = 'Test Artist';
const SONG_TITLE       = 'Test Song';
const APPLE_SONG_ID    = '1111111111';
const APPLE_ARTIST_ID  = '2222222222';
const APPLE_ALBUM_ID   = '3333333333';
const ISRC             = 'USRC17600001';
const SPOTIFY_ARTIST_ID = 'spotify_artist_1';
const SPOTIFY_TRACK_ID  = 'spotify_track_1';
const SPOTIFY_ALBUM_ID  = 'spotify_album_1';

const APPLE_SONG_URL   = `https://music.apple.com/us/song/test-song/${APPLE_SONG_ID}`;
const APPLE_ALBUM_URL  = `https://music.apple.com/us/album/test-album/${APPLE_ALBUM_ID}`;
const SPOTIFY_TRACK_URL = `https://open.spotify.com/track/${SPOTIFY_TRACK_ID}`;
const SPOTIFY_ALBUM_URL = `https://open.spotify.com/album/${SPOTIFY_ALBUM_ID}`;

// ── Mock fetch — routes matched by URL substring, first match wins ──────────
function makeFetch(routes) {
  return async (url) => {
    const key = Object.keys(routes).find(k => String(url).includes(k));
    const body = key ? routes[key] : {};
    return {
      ok: true,
      status: 200,
      json: async () => body,
      text: async () => JSON.stringify(body),
    };
  };
}

const ROUTES = {
  // Apple: song search (resolve-artist.js Rule A)
  'types=songs': {
    results: { songs: { data: [{
      id: APPLE_SONG_ID,
      attributes: { name: SONG_TITLE, artistName: ARTIST_NAME, isrc: ISRC, url: APPLE_SONG_URL },
    }] } },
  },
  // Apple: artist search (resolve-artist.js Rule A/B, api/apple-music.js searchArtist)
  'types=artists': {
    results: { artists: { data: [{
      id: APPLE_ARTIST_ID,
      attributes: { name: ARTIST_NAME, url: `https://music.apple.com/us/artist/test-artist/${APPLE_ARTIST_ID}` },
    }] } },
  },
  // Apple: song lookup by id (identity/apple.js resolveAppleArtist, kind='song')
  [`/songs/${APPLE_SONG_ID}`]: {
    data: [{
      attributes: { artistName: ARTIST_NAME, name: SONG_TITLE, isrc: ISRC, artwork: { url: 'https://example.com/{w}x{h}bb.jpg' } },
      relationships: { artists: { data: [{ id: APPLE_ARTIST_ID }] } },
    }],
  },
  // Apple: album lookup by id (identity/apple.js resolveAppleArtist, kind='album')
  [`/albums/${APPLE_ALBUM_ID}`]: {
    data: [{
      attributes: { artistName: ARTIST_NAME, artwork: { url: 'https://example.com/{w}x{h}bb.jpg' } },
      relationships: { artists: { data: [{ id: APPLE_ARTIST_ID }] } },
    }],
  },
  // Spotify: ISRC cross-discovery
  'q=isrc:': {
    tracks: { items: [{ name: SONG_TITLE, artists: [{ id: SPOTIFY_ARTIST_ID }] }] },
  },
  // Spotify: artist name search (searchSpotifyArtistByName -- fires for
  // Apple album-URL inputs, which never carry an ISRC to bridge with)
  'type=artist': {
    artists: { items: [{ id: SPOTIFY_ARTIST_ID, name: ARTIST_NAME }] },
  },
  // Spotify: artist fetch (verification + spotify_artist/track/album kinds)
  [`/artists/${SPOTIFY_ARTIST_ID}`]: {
    id: SPOTIFY_ARTIST_ID, name: ARTIST_NAME,
    images: [{ url: 'https://example.com/spotify-artist.jpg' }],
    external_urls: { spotify: `https://open.spotify.com/artist/${SPOTIFY_ARTIST_ID}` },
  },
  // Spotify: track fetch (spotify_track kind)
  [`/tracks/${SPOTIFY_TRACK_ID}`]: {
    name: SONG_TITLE,
    artists: [{ id: SPOTIFY_ARTIST_ID }],
    external_ids: { isrc: ISRC },
  },
  // Spotify: album fetch (spotify_album kind)
  [`/albums/${SPOTIFY_ALBUM_ID}`]: {
    name: 'Test Album',
    artists: [{ id: SPOTIFY_ARTIST_ID }],
  },
};

globalThis.fetch = makeFetch(ROUTES);

const FAKE_SPOTIFY_TOKEN = 'fake-token-for-mocked-fetch';

// Mirrors the exact construction run-scan.js uses (canonicalScanSubjectSeed,
// run-scan.js:219-226) -- not a re-implementation, the same call shape.
function seedFromResolved(resolved) {
  return seedCanonicalScanSubject({
    artistName:      resolved.artistName,
    appleArtistId:   resolved.appleArtistId ?? null,
    spotifyArtistId: resolved.artistId      ?? null,
    spotifyTrackId:  resolved.spotifyTrackId ?? null,
    trackTitle:      resolved.trackTitle || null,
    isrc:            resolved.trackIsrc  || null,
  });
}

// ── Fake req/res for the resolve-artist.js handler ────────────────────────────
function fakeReqRes(query) {
  const req = { method: 'GET', query, headers: {} };
  const res = {
    statusCode: null,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body)   { this.body = body; return this; },
    setHeader()  { return this; },
  };
  return { req, res };
}

// ── Test 1/2/3 — Artist + Song (manual entry) ────────────────────────────────
await test('Test 1/3: Artist + Song — resolve-artist.js Rule A now returns the release URL, not the artist URL', async () => {
  const { req, res } = fakeReqRes({ name: ARTIST_NAME, song: SONG_TITLE });
  await resolveArtistHandler(req, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.url, APPLE_SONG_URL); // release URL, not the artist URL
});

await test('Test 1/2/3: Artist + Song — full pipeline produces subjectType=release with ISRC + release identifiers intact', async () => {
  const { req, res } = fakeReqRes({ name: ARTIST_NAME, song: SONG_TITLE });
  await resolveArtistHandler(req, res);
  const releaseUrl = res.body.url;

  const resolved = await resolveToArtist(releaseUrl, FAKE_SPOTIFY_TOKEN);
  assert.equal(resolved.spotifyMatched, true);
  assert.equal(resolved.trackTitle, SONG_TITLE);   // Test 2: ISRC's sibling field survives
  assert.equal(resolved.trackIsrc, ISRC);           // Test 2: ISRC survives Identity Resolution
  assert.equal(resolved.appleArtistId, APPLE_ARTIST_ID);

  const seed = seedFromResolved(resolved);
  assert.equal(seed.subjectType, 'release');        // Test 1
  assert.equal(seed.isrc, ISRC);                     // Test 3
  assert.equal(seed.trackTitle, SONG_TITLE);         // Test 3
  assert.equal(seed.providerIds.apple.artistId, APPLE_ARTIST_ID); // Test 3
});

// ── Test 4/5 — Apple Music Track URL (direct paste) ──────────────────────────
await test('Test 4: Apple Track URL — successful Spotify bridge preserves ISRC, track title, Apple release identity', async () => {
  const resolved = await resolveToArtist(APPLE_SONG_URL, FAKE_SPOTIFY_TOKEN);
  assert.equal(resolved.spotifyMatched, true); // confirms we're on the fixed (matched) branch, not the degraded fallback
  assert.equal(resolved.trackTitle, SONG_TITLE);
  assert.equal(resolved.trackIsrc, ISRC);
  assert.equal(resolved.appleArtistId, APPLE_ARTIST_ID);
  assert.equal(resolved.resolvedFrom, 'apple');
});

await test('Test 5: Apple Track URL — Canonical Scan Subject receives release identity', async () => {
  const resolved = await resolveToArtist(APPLE_SONG_URL, FAKE_SPOTIFY_TOKEN);
  const seed = seedFromResolved(resolved);
  assert.equal(seed.subjectType, 'release');
  assert.equal(seed.isrc, ISRC);
  assert.equal(seed.providerIds.apple.artistId, APPLE_ARTIST_ID);
});

// ── Test 6 — Spotify Track URL: regression only ───────────────────────────────
await test('Test 6: Spotify Track URL — unchanged (regression)', async () => {
  const resolved = await resolveToArtist(SPOTIFY_TRACK_URL, FAKE_SPOTIFY_TOKEN);
  assert.equal(resolved.artistId, SPOTIFY_ARTIST_ID);
  assert.equal(resolved.artistName, ARTIST_NAME);
  assert.equal(resolved.spotifyMatched, true);
  assert.equal(resolved.resolvedFrom, 'track');
  assert.equal(resolved.resolvedFromType, 'track');
  assert.equal(resolved.spotifyTrackId, SPOTIFY_TRACK_ID);
  assert.equal(resolved.canonicalTarget, 'artist');
  // This branch was never touched by either fix -- confirm no new fields leaked in.
  assert.equal(resolved.trackTitle, undefined);
  assert.equal(resolved.trackIsrc, undefined);
});

// ── Test 7 — Album URLs: regression only, remain album-scoped ────────────────
await test('Test 7a: Spotify Album URL — unchanged (regression)', async () => {
  const resolved = await resolveToArtist(SPOTIFY_ALBUM_URL, FAKE_SPOTIFY_TOKEN);
  assert.equal(resolved.artistId, SPOTIFY_ARTIST_ID);
  assert.equal(resolved.resolvedFrom, 'album');
  assert.equal(resolved.resolvedFromType, 'album');
  assert.equal(resolved.trackTitle, undefined);
  assert.equal(resolved.trackIsrc, undefined);

  const seed = seedFromResolved(resolved);
  assert.equal(seed.subjectType, 'artist'); // no track-level identity exists for album inputs -- correct, unchanged
});

await test('Test 7b: Apple Album URL (no ?i=) — unchanged (regression)', async () => {
  const resolved = await resolveToArtist(APPLE_ALBUM_URL, FAKE_SPOTIFY_TOKEN);
  assert.equal(resolved.spotifyMatched, true);
  assert.equal(resolved.appleArtistId, APPLE_ARTIST_ID);
  assert.equal(resolved.resolvedFrom, 'apple');
  // The matched-branch fix (Finding 2) now always includes these two keys,
  // but for album inputs resolveAppleArtist() never resolves them in the
  // first place -- they surface as null (not a real release), never a
  // fabricated value. Confirms Finding 2's fix does not leak release
  // identity into album-scoped scans.
  assert.equal(resolved.trackTitle, null);
  assert.equal(resolved.trackIsrc, null);

  const seed = seedFromResolved(resolved);
  assert.equal(seed.subjectType, 'artist');
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
