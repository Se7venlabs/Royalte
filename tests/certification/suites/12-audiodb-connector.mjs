// ─── Suite 12: TheAudioDB Artist & Media Intelligence Authority™ ──────────────
//
// Phase 3.6 Provider Expansion 08 — Board Certification — 2026-07-03
// Board Amendment 1–6 applied: constitutional media namespace (profile/media/discography).
//
// Verifies the constitutional TheAudioDB PAL pipeline:
//   A — Static contract: capabilities, provider name, connector version
//   B — AudioDBConnector: authenticate — no credentials needed, always AVAILABLE
//   C — EvidenceBridge: ARTIST_IDENTITY → platforms.audiodb.profile + media (Amendment 1–4)
//   D — EvidenceBridge: COLLECTION_DATA → platforms.audiodb.discography[], albumCount
//   E — EvidenceBridge: VIDEOS → platforms.audiodb.media.videos[], videoCount
//   F — synthesizeAudioDbCompat: legacy shape matches retired getAudioDB() contract
//   G — Edge cases: null/empty/malformed input never throws; bridge never throws
//
// Returns: { name, passed, failed, assertions, details[] }

// Phase 4.0 addendum (2026-07-17): Groups H–K added — the suite above tested
// EvidenceBridge translation extensively but never exercised the connector's
// own acquire()/dispatch behavior against a mocked fetchFn. This addendum
// closes that gap: HTTP endpoint construction, missing-subjectRef guards,
// health-state mapping on failure, identity-lock routing, and initialization
// edge cases — the checklist required for full self-certification.
//
// Live-verified provider drift (documented in the Phase 4.0 completion
// report, NOT fixed here — outside this connector's scope, since
// AudioDBConnector.js itself is unaffected raw-passthrough):
//   - strBiographyEN was renamed to strBiography (no language suffix for
//     English) — EvidenceBridge.js:834 and audiodb-pal-acquisition.js:144
//     both still reference the old name, so profile.biography is currently
//     always null in production regardless of whether TheAudioDB has a bio.
//   - strYoutube and strInstagram no longer exist on the artist object at
//     all (confirmed absent, not just empty, across 4 different artists).
//   - strTwitter still exists but its value is now the literal string "1"
//     for every artist tested — no longer a URL.
// New Group H+ fixtures below use TheAudioDB's actual current live field
// names/shapes, not the older fixture data Groups A–G were written against.

import { bridgeToCanonical }      from '../../../lib/rie/EvidenceBridge.js';
import { AUDIODB_CAPABILITIES }    from '../../../provider-acquisition/connectors/audiodb/audiodb-capabilities.js';
import { Capability }              from '../../../provider-acquisition/capability/capabilityVocabulary.js';
import { createEvidenceContract }  from '../../../provider-acquisition/evidence/EvidenceContract.js';
import { PROVIDER_NAME, CONNECTOR_VERSION, AudioDBConnector }
  from '../../../provider-acquisition/connectors/audiodb/AudioDBConnector.js';
import { synthesizeAudioDbCompat } from '../../../api/_lib/audiodb-pal-acquisition.js';

function check(label, pass, note = '') {
  return { label, pass, note: pass ? '' : (note || 'assertion failed') };
}

const NOW = '2026-07-03T00:00:00.000Z';

function audiodbContract(evidenceType, payload) {
  return createEvidenceContract({
    acquisitionId:        'test-acq-audiodb',
    correlationId:        'test-corr-audiodb',
    requestId:            'test-req-audiodb',
    provider:             'audiodb',
    providerVersion:      'v2',
    connectorVersion:     '1.0',
    providerTrust:        70,
    capabilityProfileRef: '1.0',
    acquiredAt:           NOW,
    health:               { state: 'AVAILABLE' },
    completeness:         payload ? 'full' : 'empty',
    payload,
    payloadChecksum:      'mock-checksum',
    rawResponseHash:      'mock-hash',
  });
}

function audiodbPkg(evidenceType, payload) {
  return { evidenceType, contract: audiodbContract(evidenceType, payload) };
}

// ── Mock payloads ─────────────────────────────────────────────────────────────

// GET /search.php?s={artist} — matched artist object from artists[] array
const ARTIST_PAYLOAD = {
  idArtist:            '111239',
  strArtist:           'Ed Sheeran',
  strGenre:            'Pop',
  strStyle:            'Contemporary',
  strMood:             'Happy',
  strCountry:          'United Kingdom',
  strBiographyEN:      'Ed Sheeran is a singer-songwriter who rose to fame with his debut album + (Plus). '.repeat(12),  // > 400 chars
  intFormedYear:       '2004',
  strLabel:            'Asylum/Atlantic',
  strWebsite:          'www.edsheeran.com',
  strYoutube:          'www.youtube.com/user/edsheeran',
  strFacebook:         'www.facebook.com/edsheeranmusic',
  strTwitter:          'www.twitter.com/edsheeran',
  strInstagram:        'www.instagram.com/teddysphotos',
  strArtistThumb:      'https://cdn.theaudiodb.com/images/media/artist/thumb/uuxp1548685825.jpg',
  strArtistLogo:       'https://cdn.theaudiodb.com/images/media/artist/logo/logo.jpg',
  strArtistClearart:   'https://cdn.theaudiodb.com/images/media/artist/clearart/clearart.jpg',
  strArtistWideThumb:  'https://cdn.theaudiodb.com/images/media/artist/widethumb/wide.jpg',
  strArtistFanart:     'https://cdn.theaudiodb.com/images/media/artist/fanart/fanart1.jpg',
  strArtistFanart2:    'https://cdn.theaudiodb.com/images/media/artist/fanart/fanart2.jpg',
  strArtistFanart3:    'https://cdn.theaudiodb.com/images/media/artist/fanart/fanart3.jpg',
  strArtistFanart4:    null,
  strArtistBanner:     'https://cdn.theaudiodb.com/images/media/artist/banner/banner.jpg',
};

// GET /discography.php?s={name} — discography response
const DISCOGRAPHY_PAYLOAD = {
  album: [
    {
      idAlbum:         '2121289',
      strAlbum:        '÷ (Divide)',
      intYearReleased: '2017',
      strLabel:        'Atlantic',
      strAlbumThumb:   'https://cdn.theaudiodb.com/images/media/album/thumb/divide.jpg',
      intSales:        null,
    },
    {
      idAlbum:         '2102030',
      strAlbum:        'x (Multiply)',
      intYearReleased: '2014',
      strLabel:        'Atlantic',
      strAlbumThumb:   'https://cdn.theaudiodb.com/images/media/album/thumb/multiply.jpg',
      intSales:        null,
    },
    {
      idAlbum:         '2095459',
      strAlbum:        '+ (Plus)',
      intYearReleased: '2011',
      strLabel:        'Atlantic',
      strAlbumThumb:   'https://cdn.theaudiodb.com/images/media/album/thumb/plus.jpg',
      intSales:        null,
    },
  ],
};

// GET /mvid.php?i={artist_id} — music videos response
const VIDEOS_PAYLOAD = {
  mvids: [
    {
      idMVid:           '114336521',
      idArtist:         '111239',
      idAlbum:          '2121289',
      strTrack:         'Shape of You',
      strMusicVid:      'https://www.youtube.com/watch?v=JGwWNGJdvx8',
      strDescriptionEN: 'Official music video for Shape of You.',
      strTrackThumb:    'https://cdn.theaudiodb.com/images/media/track/thumb/shape.jpg',
    },
    {
      idMVid:           '114335204',
      idArtist:         '111239',
      idAlbum:          '2102030',
      strTrack:         'Thinking Out Loud',
      strMusicVid:      'https://www.youtube.com/watch?v=lp-EO5I60KA',
      strDescriptionEN: 'Official music video for Thinking Out Loud.',
      strTrackThumb:    'https://cdn.theaudiodb.com/images/media/track/thumb/thinking.jpg',
    },
  ],
};

// ── Group A: Static contract ──────────────────────────────────────────────────

function groupA() {
  const results = [];

  results.push(check('PROVIDER_NAME === "audiodb"', PROVIDER_NAME === 'audiodb'));
  results.push(check('CONNECTOR_VERSION === "1.0"', CONNECTOR_VERSION === '1.0'));
  results.push(check(
    'AUDIODB_CAPABILITIES is frozen',
    Object.isFrozen(AUDIODB_CAPABILITIES),
  ));
  results.push(check(
    'AUDIODB_CAPABILITIES includes ARTIST_IDENTITY',
    AUDIODB_CAPABILITIES.includes(Capability.ARTIST_IDENTITY),
  ));
  results.push(check(
    'AUDIODB_CAPABILITIES includes ARTWORK',
    AUDIODB_CAPABILITIES.includes(Capability.ARTWORK),
  ));
  results.push(check(
    'AUDIODB_CAPABILITIES includes GENRES',
    AUDIODB_CAPABILITIES.includes(Capability.GENRES),
  ));
  results.push(check(
    'AUDIODB_CAPABILITIES includes SOCIAL_LINKS',
    AUDIODB_CAPABILITIES.includes(Capability.SOCIAL_LINKS),
  ));
  results.push(check(
    'AUDIODB_CAPABILITIES includes COLLECTION_DATA',
    AUDIODB_CAPABILITIES.includes(Capability.COLLECTION_DATA),
  ));
  results.push(check(
    'AUDIODB_CAPABILITIES includes VIDEOS',
    AUDIODB_CAPABILITIES.includes(Capability.VIDEOS),
  ));
  results.push(check(
    'AUDIODB_CAPABILITIES has exactly 6 entries',
    AUDIODB_CAPABILITIES.length === 6,
    `got: ${AUDIODB_CAPABILITIES.length}`,
  ));
  results.push(check(
    'AudioDBConnector is a class (function)',
    typeof AudioDBConnector === 'function',
  ));
  results.push(check(
    'getVersion() returns correct metadata',
    (() => {
      const c = new AudioDBConnector();
      const v = c.getVersion();
      return v.provider === 'audiodb' && v.connectorVersion === '1.0' && v.providerApiVersion === 'v2';
    })(),
  ));

  return { name: 'A-static-contract', results };
}

// ── Group B: authenticate — no credentials needed ─────────────────────────────

async function groupB() {
  const results = [];

  // Not initialized → AUTH_FAILED
  const uninit = new AudioDBConnector();
  const authUninit = await uninit.authenticate();
  results.push(check(
    'authenticate() before initialize() returns AUTH_FAILED',
    authUninit.health?.state === 'AUTH_FAILED',
    `got: ${authUninit.health?.state}`,
  ));

  // After initialize() — no credentials needed → AVAILABLE
  const connector = new AudioDBConnector();
  await connector.initialize({});
  const auth = await connector.authenticate();
  results.push(check(
    'authenticate() after initialize() returns AVAILABLE (no credentials required)',
    auth.health?.state === 'AVAILABLE',
    `got: ${auth.health?.state}`,
  ));
  results.push(check(
    'authenticate() returns null credentials (TheAudioDB has no credentials)',
    auth.credentials === null,
  ));

  // Custom fetchFn — confirms injected fetch is stored
  const mockFetch = async () => ({ ok: true, status: 200, text: async () => '{"artists":[]}' });
  const connectorWithFetch = new AudioDBConnector();
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

// ── Group C: EvidenceBridge — ARTIST_IDENTITY (profile + media namespace) ────
// Verifies Board Amendment 1–4: constitutional profile/media structure.

function groupC() {
  const results = [];

  const packages = [audiodbPkg(Capability.ARTIST_IDENTITY, ARTIST_PAYLOAD)];
  const canonical = bridgeToCanonical(packages);

  const audiodb = canonical.platforms?.audiodb;

  // Top-level identity
  results.push(check(
    'bridgeToCanonical produces platforms.audiodb',
    audiodb !== undefined,
  ));
  results.push(check(
    'platforms.audiodb.artistId populated (idArtist)',
    audiodb?.artistId === '111239',
    `got: ${audiodb?.artistId}`,
  ));
  results.push(check(
    'platforms.audiodb.name populated',
    audiodb?.name === 'Ed Sheeran',
    `got: ${audiodb?.name}`,
  ));

  // Profile namespace (Amendment 2)
  results.push(check(
    'platforms.audiodb.profile object created',
    audiodb?.profile !== undefined && typeof audiodb.profile === 'object',
  ));
  results.push(check(
    'profile.biography is full text (not truncated at bridge)',
    typeof audiodb?.profile?.biography === 'string' && audiodb.profile.biography.length > 400,
    `got length: ${audiodb?.profile?.biography?.length}`,
  ));
  results.push(check(
    'profile.country populated',
    audiodb?.profile?.country === 'United Kingdom',
    `got: ${audiodb?.profile?.country}`,
  ));
  results.push(check(
    'profile.formed populated',
    audiodb?.profile?.formed === '2004',
    `got: ${audiodb?.profile?.formed}`,
  ));
  results.push(check(
    'profile.label populated',
    audiodb?.profile?.label === 'Asylum/Atlantic',
    `got: ${audiodb?.profile?.label}`,
  ));
  results.push(check(
    'profile.genre populated',
    audiodb?.profile?.genre === 'Pop',
    `got: ${audiodb?.profile?.genre}`,
  ));
  results.push(check(
    'profile.style populated',
    audiodb?.profile?.style === 'Contemporary',
    `got: ${audiodb?.profile?.style}`,
  ));
  results.push(check(
    'profile.mood populated',
    audiodb?.profile?.mood === 'Happy',
    `got: ${audiodb?.profile?.mood}`,
  ));

  // Media namespace (Amendment 1 & 3)
  results.push(check(
    'platforms.audiodb.media object created',
    audiodb?.media !== undefined && typeof audiodb.media === 'object',
  ));

  // Thumbnails (Amendment 4 — image types preserved independently)
  results.push(check(
    'media.thumbnails.thumb populated',
    typeof audiodb?.media?.thumbnails?.thumb === 'string' &&
    audiodb.media.thumbnails.thumb.includes('theaudiodb.com'),
  ));
  results.push(check(
    'media.thumbnails.wideThumb populated',
    typeof audiodb?.media?.thumbnails?.wideThumb === 'string',
  ));

  // Logos (Amendment 4)
  results.push(check(
    'media.logos.logo populated',
    typeof audiodb?.media?.logos?.logo === 'string',
  ));
  results.push(check(
    'media.logos.clearart populated',
    typeof audiodb?.media?.logos?.clearart === 'string',
  ));

  // Banners (Amendment 4)
  results.push(check(
    'media.banners.banner populated',
    typeof audiodb?.media?.banners?.banner === 'string',
  ));

  // Fan art (Amendment 4 — each index preserved independently)
  results.push(check(
    'media.fanArt.fanart populated',
    typeof audiodb?.media?.fanArt?.fanart === 'string',
  ));
  results.push(check(
    'media.fanArt.fanart2 populated',
    typeof audiodb?.media?.fanArt?.fanart2 === 'string',
  ));
  results.push(check(
    'media.fanArt.fanart3 populated',
    typeof audiodb?.media?.fanArt?.fanart3 === 'string',
  ));
  results.push(check(
    'media.fanArt.fanart4 is null when not provided',
    audiodb?.media?.fanArt?.fanart4 === null,
  ));

  // Social (under media, not standalone)
  results.push(check(
    'media.social object created',
    audiodb?.media?.social !== undefined && typeof audiodb.media.social === 'object',
  ));
  results.push(check(
    'media.social.website populated',
    audiodb?.media?.social?.website === 'www.edsheeran.com',
  ));
  results.push(check(
    'media.social.youtube populated',
    typeof audiodb?.media?.social?.youtube === 'string' &&
    audiodb.media.social.youtube.includes('youtube.com'),
  ));
  results.push(check(
    'media.social.twitter populated',
    typeof audiodb?.media?.social?.twitter === 'string',
  ));
  results.push(check(
    'media.social.instagram populated',
    typeof audiodb?.media?.social?.instagram === 'string',
  ));

  // Videos initialized as empty array (populated by translateAudioDBVideos)
  results.push(check(
    'media.videos initialized as empty array',
    Array.isArray(audiodb?.media?.videos) && audiodb.media.videos.length === 0,
  ));

  // Reserved sections
  results.push(check(
    'discography initialized as empty array',
    Array.isArray(audiodb?.discography) && audiodb.discography.length === 0,
  ));
  results.push(check(
    'statistics initialized as empty object',
    audiodb?.statistics !== undefined && typeof audiodb.statistics === 'object',
  ));

  // Verify no flat fields at root (Amendment 1 — profile data must be under profile)
  results.push(check(
    'biography NOT at root (must be under profile)',
    audiodb?.biography === undefined,
  ));
  results.push(check(
    'genre NOT at root (must be under profile)',
    audiodb?.genre === undefined,
  ));

  return { name: 'C-artist-identity-bridge', results };
}

// ── Group D: EvidenceBridge — COLLECTION_DATA ─────────────────────────────────

function groupD() {
  const results = [];

  const packages = [
    audiodbPkg(Capability.ARTIST_IDENTITY, ARTIST_PAYLOAD),
    audiodbPkg(Capability.COLLECTION_DATA, DISCOGRAPHY_PAYLOAD),
  ];
  const canonical = bridgeToCanonical(packages);
  const audiodb   = canonical.platforms?.audiodb;

  results.push(check(
    'platforms.audiodb.discography is an array',
    Array.isArray(audiodb?.discography),
  ));
  results.push(check(
    'discography contains 3 albums',
    audiodb?.discography?.length === 3,
    `got length: ${audiodb?.discography?.length}`,
  ));
  results.push(check(
    'albumCount equals discography length',
    audiodb?.albumCount === 3,
    `got: ${audiodb?.albumCount}`,
  ));
  results.push(check(
    'first album strAlbum preserved',
    audiodb?.discography?.[0]?.strAlbum === '÷ (Divide)',
    `got: ${audiodb?.discography?.[0]?.strAlbum}`,
  ));
  results.push(check(
    'first album intYearReleased preserved',
    audiodb?.discography?.[0]?.intYearReleased === '2017',
    `got: ${audiodb?.discography?.[0]?.intYearReleased}`,
  ));
  results.push(check(
    'first album strLabel preserved',
    audiodb?.discography?.[0]?.strLabel === 'Atlantic',
    `got: ${audiodb?.discography?.[0]?.strLabel}`,
  ));
  results.push(check(
    'third album strAlbum preserved',
    audiodb?.discography?.[2]?.strAlbum === '+ (Plus)',
    `got: ${audiodb?.discography?.[2]?.strAlbum}`,
  ));

  return { name: 'D-discography-bridge', results };
}

// ── Group E: EvidenceBridge — VIDEOS (under media namespace) ─────────────────

function groupE() {
  const results = [];

  const packages = [
    audiodbPkg(Capability.ARTIST_IDENTITY, ARTIST_PAYLOAD),
    audiodbPkg(Capability.COLLECTION_DATA, DISCOGRAPHY_PAYLOAD),
    audiodbPkg(Capability.VIDEOS,          VIDEOS_PAYLOAD),
  ];
  const canonical = bridgeToCanonical(packages);
  const audiodb   = canonical.platforms?.audiodb;

  results.push(check(
    'media.videos is an array (under media namespace)',
    Array.isArray(audiodb?.media?.videos),
  ));
  results.push(check(
    'media.videos contains 2 entries',
    audiodb?.media?.videos?.length === 2,
    `got length: ${audiodb?.media?.videos?.length}`,
  ));
  results.push(check(
    'videoCount equals media.videos length',
    audiodb?.videoCount === 2,
    `got: ${audiodb?.videoCount}`,
  ));
  results.push(check(
    'first video strTrack preserved',
    audiodb?.media?.videos?.[0]?.strTrack === 'Shape of You',
    `got: ${audiodb?.media?.videos?.[0]?.strTrack}`,
  ));
  results.push(check(
    'first video strMusicVid is a YouTube URL',
    typeof audiodb?.media?.videos?.[0]?.strMusicVid === 'string' &&
    audiodb.media.videos[0].strMusicVid.includes('youtube.com'),
  ));
  results.push(check(
    'second video strTrack preserved',
    audiodb?.media?.videos?.[1]?.strTrack === 'Thinking Out Loud',
    `got: ${audiodb?.media?.videos?.[1]?.strTrack}`,
  ));
  results.push(check(
    'discography still intact after videos added',
    audiodb?.discography?.length === 3,
  ));
  results.push(check(
    'social still intact after videos added',
    audiodb?.media?.social?.website === 'www.edsheeran.com',
  ));

  return { name: 'E-videos-bridge', results };
}

// ── Group F: synthesizeAudioDbCompat ─────────────────────────────────────────

function groupF() {
  const results = [];

  const packages = [
    audiodbPkg(Capability.ARTIST_IDENTITY, ARTIST_PAYLOAD),
    audiodbPkg(Capability.COLLECTION_DATA, DISCOGRAPHY_PAYLOAD),
    audiodbPkg(Capability.VIDEOS,          VIDEOS_PAYLOAD),
  ];
  const compat = synthesizeAudioDbCompat(packages, 'Ed Sheeran');

  results.push(check('synthesizeAudioDbCompat found=true', compat.found === true, `got: ${compat.found}`));
  results.push(check(
    'name from strArtist',
    compat.name === 'Ed Sheeran',
    `got: ${compat.name}`,
  ));
  results.push(check(
    'genre from strGenre',
    compat.genre === 'Pop',
    `got: ${compat.genre}`,
  ));
  results.push(check(
    'style from strStyle',
    compat.style === 'Contemporary',
    `got: ${compat.style}`,
  ));
  results.push(check(
    'mood from strMood',
    compat.mood === 'Happy',
    `got: ${compat.mood}`,
  ));
  results.push(check(
    'country from strCountry',
    compat.country === 'United Kingdom',
    `got: ${compat.country}`,
  ));
  results.push(check(
    'biography truncated to 400 chars for V1 compat',
    typeof compat.biography === 'string' && compat.biography.length === 400,
    `got length: ${compat.biography?.length}`,
  ));
  results.push(check(
    'formed from intFormedYear',
    compat.formed === '2004',
    `got: ${compat.formed}`,
  ));
  results.push(check(
    'website from strWebsite',
    compat.website === 'www.edsheeran.com',
    `got: ${compat.website}`,
  ));
  results.push(check(
    'youtube from strYoutube',
    typeof compat.youtube === 'string' && compat.youtube.includes('youtube.com'),
    `got: ${compat.youtube}`,
  ));
  results.push(check(
    'facebook from strFacebook',
    typeof compat.facebook === 'string' && compat.facebook.includes('facebook.com'),
    `got: ${compat.facebook}`,
  ));
  results.push(check(
    'twitter from strTwitter',
    typeof compat.twitter === 'string' && compat.twitter.includes('twitter.com'),
    `got: ${compat.twitter}`,
  ));
  results.push(check(
    'instagram from strInstagram',
    typeof compat.instagram === 'string' && compat.instagram.includes('instagram.com'),
    `got: ${compat.instagram}`,
  ));

  // Empty packages → { found: false }
  const empty = synthesizeAudioDbCompat([], 'Unknown');
  results.push(check('empty packages → found=false', empty.found === false));

  // Null packages → { found: false }
  const nullPkgs = synthesizeAudioDbCompat(null, 'Unknown');
  results.push(check('null packages → found=false', nullPkgs.found === false));

  // Package missing idArtist → found=false
  const noId = synthesizeAudioDbCompat([
    audiodbPkg(Capability.ARTIST_IDENTITY, { strArtist: 'Someone', strGenre: 'Rock' }),
  ], 'Someone');
  results.push(check(
    'payload missing idArtist → found=false',
    noId.found === false,
    `got: ${noId.found}`,
  ));

  // Fallback name when strArtist missing
  const noName = synthesizeAudioDbCompat([
    audiodbPkg(Capability.ARTIST_IDENTITY, { idArtist: '999' }),
  ], 'Fallback Name');
  results.push(check(
    'missing strArtist falls back to artistName parameter',
    noName.found === true && noName.name === 'Fallback Name',
    `got found=${noName.found} name=${noName.name}`,
  ));

  return { name: 'F-compat-synthesis', results };
}

// ── Group G: Edge cases ────────────────────────────────────────────────────────

function groupG() {
  const results = [];

  results.push(check('bridgeToCanonical([]) does not throw', (() => {
    try { return typeof bridgeToCanonical([]) === 'object'; } catch { return false; }
  })()));
  results.push(check('bridgeToCanonical with null ARTIST_IDENTITY payload does not throw', (() => {
    try { bridgeToCanonical([audiodbPkg(Capability.ARTIST_IDENTITY, null)]); return true; }
    catch { return false; }
  })()));
  results.push(check('bridgeToCanonical with null COLLECTION_DATA payload does not throw', (() => {
    try { bridgeToCanonical([audiodbPkg(Capability.COLLECTION_DATA, null)]); return true; }
    catch { return false; }
  })()));
  results.push(check('bridgeToCanonical with null VIDEOS payload does not throw', (() => {
    try { bridgeToCanonical([audiodbPkg(Capability.VIDEOS, null)]); return true; }
    catch { return false; }
  })()));
  results.push(check('ARTIST_IDENTITY with no idArtist does not populate platforms.audiodb', (() => {
    const c = bridgeToCanonical([audiodbPkg(Capability.ARTIST_IDENTITY, { strArtist: 'Ghost' })]);
    return c.platforms?.audiodb === undefined;
  })()));
  results.push(check('COLLECTION_DATA with null album produces empty discography', (() => {
    const c = bridgeToCanonical([audiodbPkg(Capability.COLLECTION_DATA, { album: null })]);
    return Array.isArray(c.platforms?.audiodb?.discography) &&
           c.platforms.audiodb.discography.length === 0;
  })()));
  results.push(check('COLLECTION_DATA with empty album array produces albumCount 0', (() => {
    const c = bridgeToCanonical([audiodbPkg(Capability.COLLECTION_DATA, { album: [] })]);
    return c.platforms?.audiodb?.albumCount === 0;
  })()));
  results.push(check('VIDEOS with null mvids produces empty media.videos', (() => {
    const c = bridgeToCanonical([audiodbPkg(Capability.VIDEOS, { mvids: null })]);
    return Array.isArray(c.platforms?.audiodb?.media?.videos) &&
           c.platforms.audiodb.media.videos.length === 0;
  })()));
  results.push(check('VIDEOS with empty mvids produces videoCount 0', (() => {
    const c = bridgeToCanonical([audiodbPkg(Capability.VIDEOS, { mvids: [] })]);
    return c.platforms?.audiodb?.videoCount === 0;
  })()));
  results.push(check('profile.biography null when strBiographyEN absent', (() => {
    const c = bridgeToCanonical([audiodbPkg(Capability.ARTIST_IDENTITY, {
      idArtist: '123', strArtist: 'NoBio',
    })]);
    return c.platforms?.audiodb?.profile?.biography === null;
  })()));
  results.push(check('media.thumbnails.thumb null when strArtistThumb absent', (() => {
    const c = bridgeToCanonical([audiodbPkg(Capability.ARTIST_IDENTITY, {
      idArtist: '123', strArtist: 'NoImages',
    })]);
    return c.platforms?.audiodb?.media?.thumbnails?.thumb === null;
  })()));
  results.push(check('media.logos.logo null when strArtistLogo absent', (() => {
    const c = bridgeToCanonical([audiodbPkg(Capability.ARTIST_IDENTITY, {
      idArtist: '123', strArtist: 'NoLogo',
    })]);
    return c.platforms?.audiodb?.media?.logos?.logo === null;
  })()));
  results.push(check('media.social.website null when strWebsite absent', (() => {
    const c = bridgeToCanonical([audiodbPkg(Capability.ARTIST_IDENTITY, {
      idArtist: '123', strArtist: 'NoSocial',
    })]);
    return c.platforms?.audiodb?.media?.social?.website === null;
  })()));
  results.push(check('VIDEOS-only package (no ARTIST_IDENTITY) still populates media.videos', (() => {
    const c = bridgeToCanonical([audiodbPkg(Capability.VIDEOS, VIDEOS_PAYLOAD)]);
    return Array.isArray(c.platforms?.audiodb?.media?.videos) &&
           c.platforms.audiodb.media.videos.length === 2;
  })()));

  return { name: 'G-edge-cases', results };
}

// ── Live-current fixtures (Phase 4.0) — match TheAudioDB's actual field ──────
// names/shapes as verified live 2026-07-17, distinct from the Groups A-G
// fixtures above which predate the provider drift documented at the top of
// this file.

const LIVE_ARTIST_PAYLOAD = {
  idArtist: '111611', strArtist: 'Ed Sheeran', strLabel: 'Asylum/Atlantic',
  intFormedYear: '2004', strGenre: 'Pop', strStyle: 'Contemporary', strMood: 'Happy',
  strCountry: 'United Kingdom', strBiography: 'Full biography text under the current field name.',
  strWebsite: 'www.edsheeran.com', strFacebook: 'www.facebook.com/EdSheeranMusic', strTwitter: '1',
  strArtistThumb: 'https://cdn.theaudiodb.com/images/media/artist/thumb/thumb.jpg',
};

const LIVE_DISCOGRAPHY_PAYLOAD = { album: [{ strAlbum: 'Play', intYearReleased: '2025' }, { strAlbum: '÷ (Divide)', intYearReleased: '2017' }] };
const LIVE_VIDEOS_PAYLOAD = { mvids: [{ idArtist: '111611', idAlbum: '2113725', idTrack: '32767153', strTrack: 'Small Bump', strTrackThumb: null, strMusicVid: 'http://www.youtube.com/watch?v=A_af256mnTE', strDescriptionEN: 'Official music video.' }] };

function jsonRes(body) {
  return { ok: true, status: 200, text: async () => JSON.stringify(body) };
}

async function newConnector(fetchFn, config = {}) {
  const c = new AudioDBConnector();
  await c.initialize({ fetchFn, ...config });
  await c.authenticate();
  return c;
}

// ── Group H: ARTIST_IDENTITY dispatch (direct + search + identity-lock) ──────

async function groupH() {
  const results = [];

  // Direct path — audiodbArtistId known
  let capturedUrl = null;
  const fetchFnDirect = async (url) => { capturedUrl = url; return jsonRes({ artists: [LIVE_ARTIST_PAYLOAD] }); };
  const cDirect = await newConnector(fetchFnDirect);
  const contractDirect = await cDirect.acquire({
    requestId: 'req-direct', evidenceType: Capability.ARTIST_IDENTITY,
    subjectRef: { audiodbArtistId: '111611' }, context: { correlationId: 'corr-direct' },
  });
  results.push(check('direct path calls GET /artist.php?i={id}', capturedUrl?.includes('/artist.php?i=111611'), `got: ${capturedUrl}`));
  results.push(check('direct path health is AVAILABLE', contractDirect.health?.state === 'AVAILABLE'));
  results.push(check('direct path payload is raw, unreshaped (has artists[] envelope)', Array.isArray(contractDirect.payload?.artists)));

  // Search path — identity-lock exact match
  let searchUrl = null;
  const fetchFnSearch = async (url) => { searchUrl = url; return jsonRes({ artists: [LIVE_ARTIST_PAYLOAD] }); };
  const cSearch = await newConnector(fetchFnSearch);
  const contractSearch = await cSearch.acquire({
    requestId: 'req-search', evidenceType: Capability.ARTIST_IDENTITY,
    subjectRef: { artistName: 'Ed Sheeran' }, context: { correlationId: 'corr-search' },
  });
  results.push(check('search path calls GET /search.php?s={query}', searchUrl?.includes('/search.php?s=Ed'), `got: ${searchUrl}`));
  results.push(check('search path health is AVAILABLE', contractSearch.health?.state === 'AVAILABLE'));
  results.push(check('search path completeness is "full"', contractSearch.completeness === 'full'));
  results.push(check('search path payload is the raw matched artist object (identity-lock is routing only, not reshaping)',
    contractSearch.payload?.idArtist === '111611' && contractSearch.payload?.strArtist === 'Ed Sheeran',
    `got: ${JSON.stringify(contractSearch.payload).slice(0, 120)}`));
  results.push(check('search path payload preserves live-current field name strBiography (not reshaped/renamed)',
    contractSearch.payload?.strBiography === 'Full biography text under the current field name.'));

  // Search path — no exact match
  const cNoMatch = await newConnector(async () => jsonRes({ artists: [{ idArtist: '999', strArtist: 'Completely Different Artist' }] }));
  const contractNoMatch = await cNoMatch.acquire({
    requestId: 'req-nomatch', evidenceType: Capability.ARTIST_IDENTITY,
    subjectRef: { artistName: 'Ed Sheeran' }, context: { correlationId: 'corr-nomatch' },
  });
  results.push(check('no identity-lock match returns PARTIAL_RESPONSE', contractNoMatch.health?.state === 'PARTIAL_RESPONSE'));
  results.push(check('no identity-lock match returns null payload', contractNoMatch.payload === null));

  // Search path — provider returns no artists at all (empty catalog result)
  const cEmpty = await newConnector(async () => jsonRes({ artists: null }));
  const contractEmpty = await cEmpty.acquire({
    requestId: 'req-empty', evidenceType: Capability.ARTIST_IDENTITY,
    subjectRef: { artistName: 'Nonexistent Artist' }, context: { correlationId: 'corr-empty' },
  });
  results.push(check('search with artists:null does not throw, returns PARTIAL_RESPONSE', contractEmpty.health?.state === 'PARTIAL_RESPONSE'));

  return { name: 'H-artist-identity-dispatch', results };
}

// ── Group I: COLLECTION_DATA / VIDEOS dispatch ────────────────────────────────

async function groupI() {
  const results = [];

  let discogUrl = null;
  const fetchFnDiscog = async (url) => { discogUrl = url; return jsonRes(LIVE_DISCOGRAPHY_PAYLOAD); };
  const cDiscog = await newConnector(fetchFnDiscog);
  const contractDiscog = await cDiscog.acquire({
    requestId: 'req-discog', evidenceType: Capability.COLLECTION_DATA,
    subjectRef: { artistName: 'Ed Sheeran' }, context: { correlationId: 'corr-discog' },
  });
  results.push(check('COLLECTION_DATA calls GET /discography.php?s={name}', discogUrl?.includes('/discography.php?s=Ed'), `got: ${discogUrl}`));
  results.push(check('COLLECTION_DATA health is AVAILABLE', contractDiscog.health?.state === 'AVAILABLE'));
  results.push(check('COLLECTION_DATA payload preserves raw album[] (live-current 2-field shape)',
    contractDiscog.payload?.album?.[0]?.strAlbum === 'Play' && contractDiscog.payload?.album?.[0]?.intYearReleased === '2025'));

  const cDiscogMissing = await newConnector(async () => jsonRes(LIVE_DISCOGRAPHY_PAYLOAD));
  const missingDiscog = await cDiscogMissing.acquire({
    requestId: 'req-discog-missing', evidenceType: Capability.COLLECTION_DATA,
    subjectRef: {}, context: { correlationId: 'corr-discog-missing' },
  });
  results.push(check('COLLECTION_DATA with no artistName returns PARTIAL_RESPONSE', missingDiscog.health?.state === 'PARTIAL_RESPONSE'));

  let videosUrl = null;
  const fetchFnVideos = async (url) => { videosUrl = url; return jsonRes(LIVE_VIDEOS_PAYLOAD); };
  const cVideos = await newConnector(fetchFnVideos);
  const contractVideos = await cVideos.acquire({
    requestId: 'req-videos', evidenceType: Capability.VIDEOS,
    subjectRef: { audiodbArtistId: '111611' }, context: { correlationId: 'corr-videos' },
  });
  results.push(check('VIDEOS calls GET /mvid.php?i={id}', videosUrl?.includes('/mvid.php?i=111611'), `got: ${videosUrl}`));
  results.push(check('VIDEOS health is AVAILABLE', contractVideos.health?.state === 'AVAILABLE'));
  results.push(check('VIDEOS payload preserves raw mvids[] (live-current idTrack, no idMVid)',
    contractVideos.payload?.mvids?.[0]?.strTrack === 'Small Bump' && contractVideos.payload?.mvids?.[0]?.idTrack === '32767153'));

  const cVideosMissing = await newConnector(async () => jsonRes(LIVE_VIDEOS_PAYLOAD));
  const missingVideos = await cVideosMissing.acquire({
    requestId: 'req-videos-missing', evidenceType: Capability.VIDEOS,
    subjectRef: {}, context: { correlationId: 'corr-videos-missing' },
  });
  results.push(check('VIDEOS with no audiodbArtistId returns PARTIAL_RESPONSE', missingVideos.health?.state === 'PARTIAL_RESPONSE'));

  return { name: 'I-collection-videos-dispatch', results };
}

// ── Group J: Health reporting + error-path health-state mapping ──────────────

async function groupJ() {
  const results = [];

  const cNotInit = new AudioDBConnector();
  const hNotInit = await cNotInit.reportHealth();
  results.push(check('reportHealth() before initialize() returns AUTH_FAILED', hNotInit.state === 'AUTH_FAILED'));

  let probeUrl = null;
  const cHealthy = await newConnector(async (url) => { probeUrl = url; return jsonRes({ artists: [LIVE_ARTIST_PAYLOAD] }); });
  const hHealthy = await cHealthy.reportHealth();
  results.push(check('reportHealth() probes /search.php?s=Ed+Sheeran', probeUrl?.includes('/search.php?s=Ed'), `got: ${probeUrl}`));
  results.push(check('reportHealth() with working probe returns AVAILABLE', hHealthy.state === 'AVAILABLE'));

  const cDown = await newConnector(async () => ({ ok: false, status: 503, text: async () => '{}' }), { maxRetries: 0 });
  const hDown = await cDown.reportHealth();
  results.push(check('reportHealth() when probe fails returns a non-AVAILABLE state', hDown.state !== 'AVAILABLE', `got: ${hDown.state}`));

  // acquire()-level error-path mapping
  const c429 = await newConnector(async () => ({ ok: false, status: 429, text: async () => '{}' }), { maxRetries: 0 });
  const contract429 = await c429.acquire({
    requestId: 'req-429', evidenceType: Capability.VIDEOS, subjectRef: { audiodbArtistId: 'x' },
    context: { correlationId: 'corr-429' },
  });
  results.push(check('HTTP 429 maps to RATE_LIMITED', contract429.health?.state === 'RATE_LIMITED', `got: ${contract429.health?.state}`));

  const c404 = await newConnector(async () => ({ ok: false, status: 404, text: async () => '{}' }));
  const contract404 = await c404.acquire({
    requestId: 'req-404', evidenceType: Capability.VIDEOS, subjectRef: { audiodbArtistId: 'x' },
    context: { correlationId: 'corr-404' },
  });
  results.push(check('HTTP 404 maps to PARTIAL_RESPONSE', contract404.health?.state === 'PARTIAL_RESPONSE', `got: ${contract404.health?.state}`));

  const cMalformed = await newConnector(async () => ({ ok: true, status: 200, text: async () => 'not json{{' }));
  const contractMalformed = await cMalformed.acquire({
    requestId: 'req-malformed', evidenceType: Capability.VIDEOS, subjectRef: { audiodbArtistId: 'x' },
    context: { correlationId: 'corr-malformed' },
  });
  results.push(check('malformed JSON response maps to SCHEMA_CHANGED', contractMalformed.health?.state === 'SCHEMA_CHANGED', `got: ${contractMalformed.health?.state}`));

  return { name: 'J-health-and-error-mapping', results };
}

// ── Group K: Initialization / connector-level edge cases ─────────────────────

async function groupK() {
  const results = [];

  const cNotInit = new AudioDBConnector();
  const notInitContract = await cNotInit.acquire({
    requestId: 'req-not-init', evidenceType: Capability.ARTIST_IDENTITY,
    subjectRef: { artistName: 'X' }, context: { correlationId: 'corr-not-init' },
  });
  results.push(check('acquire() before initialize() returns AUTH_FAILED', notInitContract.health?.state === 'AUTH_FAILED'));
  results.push(check('acquire() before initialize() returns null payload', notInitContract.payload === null));

  const c = await newConnector(async () => jsonRes({ artists: [] }));
  const unsupported = await c.acquire({
    requestId: 'req-unsupported', evidenceType: Capability.ISRC, subjectRef: {},
    context: { correlationId: 'corr-unsupported' },
  });
  results.push(check('unsupported evidence type returns PARTIAL_RESPONSE, not a throw', unsupported.health?.state === 'PARTIAL_RESPONSE'));

  // Evidence Contract integrity
  const fetchFn = async () => jsonRes({ artists: [LIVE_ARTIST_PAYLOAD] });
  const cContract = await newConnector(fetchFn);
  const contract = await cContract.acquire({
    requestId: 'req-integrity', evidenceType: Capability.ARTIST_IDENTITY,
    subjectRef: { artistName: 'Ed Sheeran' }, context: { correlationId: 'corr-integrity' },
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
  results.push(check('contract.providerTrust defaults to 70', contract.providerTrust === 70, `got: ${contract.providerTrust}`));
  results.push(check('contract.payloadChecksum is a non-empty sha256 hex string', /^[0-9a-f]{64}$/.test(contract.payloadChecksum)));
  results.push(check('contract is frozen (Evidence Contract immutability)', Object.isFrozen(contract)));

  return { name: 'K-initialization-and-contract-integrity', results };
}

// ── Suite runner ──────────────────────────────────────────────────────────────

export async function runAudioDbConnector() {
  const groups = [
    groupA(),
    await groupB(),
    groupC(),
    groupD(),
    groupE(),
    groupF(),
    groupG(),
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
    name:       '12-audiodb-connector',
    passed,
    failed,
    assertions: passed + failed,
    details,
  };
}
