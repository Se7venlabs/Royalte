// ─── Suite 11: Deezer Streaming Verification Authority™ ──────────────────────
//
// Phase 3.6 Provider Expansion 07 — Board Certification — 2026-07-02
//
// Verifies the constitutional Deezer PAL pipeline:
//   A — Static contract: capabilities, provider name, connector version, trust
//   B — DeezerConnector: authenticate — no credentials needed, always AVAILABLE
//   C — EvidenceBridge: ARTIST_IDENTITY → platforms.deezer.*
//   D — EvidenceBridge: ALBUMS → platforms.deezer.albums[], albumCount, genres[]
//   E — EvidenceBridge: TRACKS → platforms.deezer.topTracks[], isrcs[], trackCount
//   F — synthesizeDeezerCompat: legacy shape matches retired getDeezer() contract
//   G — Edge cases: null/empty/malformed input never throws; bridge never throws
//
// Returns: { name, passed, failed, assertions, details[] }

import { bridgeToCanonical }     from '../../../lib/rie/EvidenceBridge.js';
import { DEEZER_CAPABILITIES }    from '../../../provider-acquisition/connectors/deezer/deezer-capabilities.js';
import { Capability }             from '../../../provider-acquisition/capability/capabilityVocabulary.js';
import { createEvidenceContract } from '../../../provider-acquisition/evidence/EvidenceContract.js';
import { PROVIDER_NAME, CONNECTOR_VERSION, DeezerConnector }
  from '../../../provider-acquisition/connectors/deezer/DeezerConnector.js';
import { synthesizeDeezerCompat } from '../../../api/_lib/deezer-pal-acquisition.js';

function check(label, pass, note = '') {
  return { label, pass, note: pass ? '' : (note || 'assertion failed') };
}

const NOW = '2026-07-02T00:00:00.000Z';

function deezerContract(evidenceType, payload) {
  return createEvidenceContract({
    acquisitionId:        'test-acq-deezer',
    correlationId:        'test-corr-deezer',
    requestId:            'test-req-deezer',
    provider:             'deezer',
    providerVersion:      'v1',
    connectorVersion:     '1.0',
    providerTrust:        80,
    capabilityProfileRef: '1.0',
    acquiredAt:           NOW,
    health:               { state: 'AVAILABLE' },
    completeness:         payload ? 'full' : 'empty',
    payload,
    payloadChecksum:      'mock-checksum',
    rawResponseHash:      'mock-hash',
  });
}

function deezerPkg(evidenceType, payload) {
  return { evidenceType, contract: deezerContract(evidenceType, payload) };
}

// ── Mock payloads ─────────────────────────────────────────────────────────────

// GET /artist/{id} — artist detail object
const ARTIST_PAYLOAD = {
  id:             4050205,
  name:           'Ed Sheeran',
  link:           'https://www.deezer.com/artist/4050205',
  share:          'https://www.deezer.com/artist/4050205?utm_source=deezer&utm_content=artist-4050205',
  picture:        'https://api.deezer.com/artist/4050205/image',
  picture_small:  'https://cdns-images.dzcdn.net/images/artist/small.jpg',
  picture_medium: 'https://cdns-images.dzcdn.net/images/artist/medium.jpg',
  picture_big:    'https://cdns-images.dzcdn.net/images/artist/big.jpg',
  picture_xl:     'https://cdns-images.dzcdn.net/images/artist/xl.jpg',
  nb_album:       15,
  nb_fan:         14500000,
  radio:          true,
  tracklist:      'https://api.deezer.com/artist/4050205/top?limit=50',
  type:           'artist',
};

// GET /artist/{id}/albums?limit=50 — album list
const ALBUMS_PAYLOAD = {
  data: [
    {
      id:              302127,
      title:           '÷ (Divide)',
      link:            'https://www.deezer.com/album/302127',
      cover:           'https://api.deezer.com/album/302127/image',
      cover_small:     'https://cdns-images.dzcdn.net/images/cover/small.jpg',
      cover_medium:    'https://cdns-images.dzcdn.net/images/cover/medium.jpg',
      cover_big:       'https://cdns-images.dzcdn.net/images/cover/big.jpg',
      cover_xl:        'https://cdns-images.dzcdn.net/images/cover/xl.jpg',
      genre_id:        132,
      fans:            1200000,
      release_date:    '2017-03-03',
      record_type:     'album',
      available:       true,
      tracklist:       'https://api.deezer.com/album/302127/tracks',
      explicit_lyrics: false,
      type:            'album',
      genres: {
        data: [
          { id: 132, name: 'Pop', picture: 'https://...' },
          { id: 152, name: 'Folk', picture: 'https://...' },
        ],
      },
    },
    {
      id:              186350,
      title:           'x (Multiply)',
      link:            'https://www.deezer.com/album/186350',
      cover:           'https://api.deezer.com/album/186350/image',
      cover_small:     'https://cdns-images.dzcdn.net/images/cover/small2.jpg',
      cover_medium:    'https://cdns-images.dzcdn.net/images/cover/medium2.jpg',
      cover_big:       'https://cdns-images.dzcdn.net/images/cover/big2.jpg',
      cover_xl:        'https://cdns-images.dzcdn.net/images/cover/xl2.jpg',
      genre_id:        132,
      fans:            900000,
      release_date:    '2014-06-23',
      record_type:     'album',
      available:       true,
      tracklist:       'https://api.deezer.com/album/186350/tracks',
      explicit_lyrics: false,
      type:            'album',
      genres: {
        data: [
          { id: 132, name: 'Pop', picture: 'https://...' },
        ],
      },
    },
  ],
  total: 15,
};

// GET /artist/{id}/top?limit=50 — top tracks (includes isrc per track)
const TRACKS_PAYLOAD = {
  data: [
    {
      id:                      835685027,
      readable:                true,
      title:                   'Shape of You',
      title_short:             'Shape of You',
      isrc:                    'GBAHS1600463',
      link:                    'https://www.deezer.com/track/835685027',
      duration:                234,
      rank:                    916344,
      explicit_lyrics:         false,
      explicit_content_lyrics: 0,
      explicit_content_cover:  0,
      preview:                 'https://cdns-preview-b.dzcdn.net/stream/c-b.mp3',
      md5_image:               'abc123',
      artist: { id: 4050205, name: 'Ed Sheeran', tracklist: 'https://...', type: 'artist' },
      album:  { id: 302127, title: '÷ (Divide)', cover: 'https://...', type: 'album' },
      type:   'track',
    },
    {
      id:                      476902,
      readable:                true,
      title:                   'Thinking Out Loud',
      title_short:             'Thinking Out Loud',
      isrc:                    'GBAHS1400406',
      link:                    'https://www.deezer.com/track/476902',
      duration:                281,
      rank:                    879432,
      explicit_lyrics:         false,
      explicit_content_lyrics: 0,
      explicit_content_cover:  0,
      preview:                 'https://cdns-preview-c.dzcdn.net/stream/c-c.mp3',
      md5_image:               'def456',
      artist: { id: 4050205, name: 'Ed Sheeran', tracklist: 'https://...', type: 'artist' },
      album:  { id: 186350, title: 'x (Multiply)', cover: 'https://...', type: 'album' },
      type:   'track',
    },
    {
      id:         123456789,
      title:      'No ISRC Track',
      isrc:       null,          // deliberately null — should be excluded from isrcs[]
      duration:   180,
      type:       'track',
    },
  ],
  total: 50,
};

// ── Group A: Static contract ──────────────────────────────────────────────────

function groupA() {
  const results = [];

  results.push(check('PROVIDER_NAME === "deezer"', PROVIDER_NAME === 'deezer'));
  results.push(check('CONNECTOR_VERSION === "1.0"', CONNECTOR_VERSION === '1.0'));
  results.push(check(
    'DEEZER_CAPABILITIES is frozen',
    Object.isFrozen(DEEZER_CAPABILITIES),
  ));
  results.push(check(
    'DEEZER_CAPABILITIES includes ARTIST_IDENTITY',
    DEEZER_CAPABILITIES.includes(Capability.ARTIST_IDENTITY),
  ));
  results.push(check(
    'DEEZER_CAPABILITIES includes ALBUMS',
    DEEZER_CAPABILITIES.includes(Capability.ALBUMS),
  ));
  results.push(check(
    'DEEZER_CAPABILITIES includes TRACKS',
    DEEZER_CAPABILITIES.includes(Capability.TRACKS),
  ));
  results.push(check(
    'DEEZER_CAPABILITIES includes ISRC',
    DEEZER_CAPABILITIES.includes(Capability.ISRC),
  ));
  results.push(check(
    'DEEZER_CAPABILITIES includes ARTWORK',
    DEEZER_CAPABILITIES.includes(Capability.ARTWORK),
  ));
  results.push(check(
    'DEEZER_CAPABILITIES includes GENRES',
    DEEZER_CAPABILITIES.includes(Capability.GENRES),
  ));
  results.push(check(
    'DEEZER_CAPABILITIES has exactly 6 entries',
    DEEZER_CAPABILITIES.length === 6,
    `got: ${DEEZER_CAPABILITIES.length}`,
  ));
  results.push(check(
    'DeezerConnector is a class (function)',
    typeof DeezerConnector === 'function',
  ));
  results.push(check(
    'getVersion() returns correct metadata',
    (() => {
      const c = new DeezerConnector();
      const v = c.getVersion();
      return v.provider === 'deezer' && v.connectorVersion === '1.0' && v.providerApiVersion === 'v1';
    })(),
  ));

  return { name: 'A-static-contract', results };
}

// ── Group B: authenticate — no credentials needed ─────────────────────────────

async function groupB() {
  const results = [];

  // Not initialized → AUTH_FAILED
  const uninit = new DeezerConnector();
  const authUninit = await uninit.authenticate();
  results.push(check(
    'authenticate() before initialize() returns AUTH_FAILED',
    authUninit.health?.state === 'AUTH_FAILED',
    `got: ${authUninit.health?.state}`,
  ));

  // After initialize() — no credentials needed → AVAILABLE
  const connector = new DeezerConnector();
  await connector.initialize({});
  const auth = await connector.authenticate();
  results.push(check(
    'authenticate() after initialize() returns AVAILABLE (no credentials required)',
    auth.health?.state === 'AVAILABLE',
    `got: ${auth.health?.state}`,
  ));
  results.push(check(
    'authenticate() returns null credentials (Deezer has no credentials)',
    auth.credentials === null,
  ));

  // Custom fetchFn — confirms injected fetch is stored
  const mockFetch = async () => ({ ok: true, status: 200, text: async () => '{"data":[]}' });
  const connectorWithFetch = new DeezerConnector();
  await connectorWithFetch.initialize({ fetchFn: mockFetch });
  const authWithFetch = await connectorWithFetch.authenticate();
  results.push(check(
    'authenticate() with custom fetchFn returns AVAILABLE',
    authWithFetch.health?.state === 'AVAILABLE',
    `got: ${authWithFetch.health?.state}`,
  ));

  // discoverCapabilities() shape
  const profile = await connector.discoverCapabilities();
  results.push(check(
    'discoverCapabilities() returns an object',
    profile !== null && typeof profile === 'object',
  ));

  await connector.shutdown();
  await connectorWithFetch.shutdown();

  return { name: 'B-auth-no-credentials', results };
}

// ── Group C: EvidenceBridge — ARTIST_IDENTITY ─────────────────────────────────

function groupC() {
  const results = [];

  const packages = [deezerPkg(Capability.ARTIST_IDENTITY, ARTIST_PAYLOAD)];
  const canonical = bridgeToCanonical(packages);

  results.push(check(
    'bridgeToCanonical produces platforms.deezer',
    canonical.platforms?.deezer !== undefined,
  ));
  results.push(check(
    'platforms.deezer.artistId populated',
    canonical.platforms?.deezer?.artistId === 4050205,
    `got: ${canonical.platforms?.deezer?.artistId}`,
  ));
  results.push(check(
    'platforms.deezer.name populated',
    canonical.platforms?.deezer?.name === 'Ed Sheeran',
    `got: ${canonical.platforms?.deezer?.name}`,
  ));
  results.push(check(
    'platforms.deezer.link populated',
    typeof canonical.platforms?.deezer?.link === 'string' &&
    canonical.platforms.deezer.link.includes('deezer.com'),
  ));
  results.push(check(
    'platforms.deezer.fans populated (nb_fan)',
    canonical.platforms?.deezer?.fans === 14500000,
    `got: ${canonical.platforms?.deezer?.fans}`,
  ));
  results.push(check(
    'platforms.deezer.nbAlbum populated',
    canonical.platforms?.deezer?.nbAlbum === 15,
    `got: ${canonical.platforms?.deezer?.nbAlbum}`,
  ));
  results.push(check(
    'platforms.deezer.radio preserved',
    canonical.platforms?.deezer?.radio === true,
  ));
  results.push(check(
    'platforms.deezer.artwork object created',
    canonical.platforms?.deezer?.artwork !== undefined &&
    typeof canonical.platforms.deezer.artwork === 'object',
  ));
  results.push(check(
    'artwork.picture preserved',
    typeof canonical.platforms?.deezer?.artwork?.picture === 'string',
  ));
  results.push(check(
    'artwork.picture_xl preserved',
    typeof canonical.platforms?.deezer?.artwork?.picture_xl === 'string',
  ));

  return { name: 'C-artist-identity-bridge', results };
}

// ── Group D: EvidenceBridge — ALBUMS ─────────────────────────────────────────

function groupD() {
  const results = [];

  const packages = [
    deezerPkg(Capability.ARTIST_IDENTITY, ARTIST_PAYLOAD),
    deezerPkg(Capability.ALBUMS,          ALBUMS_PAYLOAD),
  ];
  const canonical = bridgeToCanonical(packages);

  results.push(check(
    'platforms.deezer.albums is the raw array',
    Array.isArray(canonical.platforms?.deezer?.albums) &&
    canonical.platforms.deezer.albums.length === 2,
    `got length: ${canonical.platforms?.deezer?.albums?.length}`,
  ));
  results.push(check(
    'albumCount reflects API total',
    canonical.platforms?.deezer?.albumCount === 15,
    `got: ${canonical.platforms?.deezer?.albumCount}`,
  ));
  results.push(check(
    'genres extracted from album genre tags',
    Array.isArray(canonical.platforms?.deezer?.genres) &&
    canonical.platforms.deezer.genres.length === 2,   // Pop + Folk (deduplicated)
    `got: ${JSON.stringify(canonical.platforms?.deezer?.genres)}`,
  ));
  results.push(check(
    'genres contains Pop',
    canonical.platforms?.deezer?.genres?.includes('Pop'),
  ));
  results.push(check(
    'genres contains Folk',
    canonical.platforms?.deezer?.genres?.includes('Folk'),
  ));
  results.push(check(
    'first album release_date preserved',
    canonical.platforms?.deezer?.albums?.[0]?.release_date === '2017-03-03',
    `got: ${canonical.platforms?.deezer?.albums?.[0]?.release_date}`,
  ));
  results.push(check(
    'first album record_type preserved',
    canonical.platforms?.deezer?.albums?.[0]?.record_type === 'album',
  ));
  results.push(check(
    'first album genres.data preserved (not flattened)',
    Array.isArray(canonical.platforms?.deezer?.albums?.[0]?.genres?.data) &&
    canonical.platforms.deezer.albums[0].genres.data.length === 2,
  ));

  return { name: 'D-albums-bridge', results };
}

// ── Group E: EvidenceBridge — TRACKS ─────────────────────────────────────────

function groupE() {
  const results = [];

  const packages = [
    deezerPkg(Capability.ARTIST_IDENTITY, ARTIST_PAYLOAD),
    deezerPkg(Capability.ALBUMS,          ALBUMS_PAYLOAD),
    deezerPkg(Capability.TRACKS,          TRACKS_PAYLOAD),
  ];
  const canonical = bridgeToCanonical(packages);

  results.push(check(
    'platforms.deezer.topTracks is the raw array',
    Array.isArray(canonical.platforms?.deezer?.topTracks) &&
    canonical.platforms.deezer.topTracks.length === 3,
    `got length: ${canonical.platforms?.deezer?.topTracks?.length}`,
  ));
  results.push(check(
    'trackCount equals topTracks length',
    canonical.platforms?.deezer?.trackCount === 3,
    `got: ${canonical.platforms?.deezer?.trackCount}`,
  ));
  results.push(check(
    'isrcs array extracted (deduped, null filtered)',
    Array.isArray(canonical.platforms?.deezer?.isrcs) &&
    canonical.platforms.deezer.isrcs.length === 2,   // 2 valid ISRCs; null excluded
    `got: ${JSON.stringify(canonical.platforms?.deezer?.isrcs)}`,
  ));
  results.push(check(
    'isrcs contains GBAHS1600463',
    canonical.platforms?.deezer?.isrcs?.includes('GBAHS1600463'),
  ));
  results.push(check(
    'isrcs contains GBAHS1400406',
    canonical.platforms?.deezer?.isrcs?.includes('GBAHS1400406'),
  ));
  results.push(check(
    'first track duration preserved',
    canonical.platforms?.deezer?.topTracks?.[0]?.duration === 234,
    `got: ${canonical.platforms?.deezer?.topTracks?.[0]?.duration}`,
  ));
  results.push(check(
    'first track explicit_lyrics preserved',
    canonical.platforms?.deezer?.topTracks?.[0]?.explicit_lyrics === false,
  ));
  results.push(check(
    'first track album object preserved',
    canonical.platforms?.deezer?.topTracks?.[0]?.album?.id === 302127,
    `got: ${canonical.platforms?.deezer?.topTracks?.[0]?.album?.id}`,
  ));

  return { name: 'E-tracks-bridge', results };
}

// ── Group F: synthesizeDeezerCompat ──────────────────────────────────────────

function groupF() {
  const results = [];

  const packages = [
    deezerPkg(Capability.ARTIST_IDENTITY, ARTIST_PAYLOAD),
    deezerPkg(Capability.ALBUMS,          ALBUMS_PAYLOAD),
    deezerPkg(Capability.TRACKS,          TRACKS_PAYLOAD),
  ];
  const compat = synthesizeDeezerCompat(packages, 'Ed Sheeran');

  results.push(check('synthesizeDeezerCompat found=true', compat.found === true, `got: ${compat.found}`));
  results.push(check(
    'artistId matches Deezer artist ID',
    compat.artistId === 4050205,
    `got: ${compat.artistId}`,
  ));
  results.push(check(
    'name matches artist name',
    compat.name === 'Ed Sheeran',
    `got: ${compat.name}`,
  ));
  results.push(check(
    'fans equals nb_fan from payload',
    compat.fans === 14500000,
    `got: ${compat.fans}`,
  ));
  results.push(check(
    'nb_album equals nb_album from payload',
    compat.nb_album === 15,
    `got: ${compat.nb_album}`,
  ));
  results.push(check(
    'link is a string',
    typeof compat.link === 'string' && compat.link.includes('deezer.com'),
  ));
  results.push(check(
    'picture fields all present',
    compat.picture        !== undefined &&
    compat.picture_small  !== undefined &&
    compat.picture_medium !== undefined &&
    compat.picture_big    !== undefined &&
    compat.picture_xl     !== undefined,
  ));
  results.push(check(
    'radio preserved',
    compat.radio === true,
  ));
  results.push(check(
    'albums array contains 2 items',
    Array.isArray(compat.albums) && compat.albums.length === 2,
    `got length: ${compat.albums?.length}`,
  ));
  results.push(check(
    'topTracks array contains 3 items',
    Array.isArray(compat.topTracks) && compat.topTracks.length === 3,
    `got length: ${compat.topTracks?.length}`,
  ));
  results.push(check(
    'genres array deduped from albums',
    Array.isArray(compat.genres) && compat.genres.length === 2,
    `got: ${JSON.stringify(compat.genres)}`,
  ));

  // Empty packages → { found: false, fans: 0 }
  const empty = synthesizeDeezerCompat([], 'Unknown');
  results.push(check('empty packages → found=false', empty.found === false));
  results.push(check('empty packages → fans=0', empty.fans === 0));

  // Null packages
  const nullPkgs = synthesizeDeezerCompat(null, 'Unknown');
  results.push(check('null packages → found=false', nullPkgs.found === false));

  return { name: 'F-compat-synthesis', results };
}

// ── Group G: Edge cases ────────────────────────────────────────────────────────

function groupG() {
  const results = [];

  results.push(check('bridgeToCanonical([]) does not throw', (() => {
    try { return typeof bridgeToCanonical([]) === 'object'; } catch { return false; }
  })()));
  results.push(check('bridgeToCanonical(null) does not throw', (() => {
    try { bridgeToCanonical(null); return true; } catch { return false; }
  })()));
  results.push(check('bridgeToCanonical with null ARTIST_IDENTITY payload does not throw', (() => {
    try { bridgeToCanonical([deezerPkg(Capability.ARTIST_IDENTITY, null)]); return true; }
    catch { return false; }
  })()));
  results.push(check('bridgeToCanonical with null ALBUMS payload does not throw', (() => {
    try { bridgeToCanonical([deezerPkg(Capability.ALBUMS, null)]); return true; }
    catch { return false; }
  })()));
  results.push(check('bridgeToCanonical with null TRACKS payload does not throw', (() => {
    try { bridgeToCanonical([deezerPkg(Capability.TRACKS, null)]); return true; }
    catch { return false; }
  })()));
  results.push(check('ARTIST_IDENTITY with missing id field does not populate deezer.artistId', (() => {
    const c = bridgeToCanonical([deezerPkg(Capability.ARTIST_IDENTITY, { name: 'Someone' })]);
    return c.platforms?.deezer === undefined;  // invalid payload → translate skipped
  })()));
  results.push(check('ALBUMS with empty data array produces albumCount 0', (() => {
    const c = bridgeToCanonical([deezerPkg(Capability.ALBUMS, { data: [], total: 0 })]);
    return c.platforms?.deezer?.albumCount === 0;
  })()));
  results.push(check('TRACKS with all-null ISRCs produces empty isrcs array', (() => {
    const c = bridgeToCanonical([deezerPkg(Capability.TRACKS, {
      data: [{ id: 1, title: 'A', isrc: null }, { id: 2, title: 'B' }],
    })]);
    return Array.isArray(c.platforms?.deezer?.isrcs) && c.platforms.deezer.isrcs.length === 0;
  })()));
  results.push(check('ALBUMS with no genre data produces empty genres array', (() => {
    const c = bridgeToCanonical([deezerPkg(Capability.ALBUMS, {
      data: [{ id: 1, title: 'Album Without Genres' }], total: 1,
    })]);
    return Array.isArray(c.platforms?.deezer?.genres) && c.platforms.deezer.genres.length === 0;
  })()));
  results.push(check('ARTIST_IDENTITY missing fans field → fans is null', (() => {
    const c = bridgeToCanonical([deezerPkg(Capability.ARTIST_IDENTITY, {
      id: 999, name: 'Test',
    })]);
    return c.platforms?.deezer?.fans === null;
  })()));

  return { name: 'G-edge-cases', results };
}

// ── Suite runner ──────────────────────────────────────────────────────────────

export async function runDeezerConnector() {
  const groups = [
    groupA(),
    await groupB(),
    groupC(),
    groupD(),
    groupE(),
    groupF(),
    groupG(),
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
    name:       '11-deezer-connector',
    passed,
    failed,
    assertions: passed + failed,
    details,
  };
}
