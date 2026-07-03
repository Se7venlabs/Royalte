// ─── Suite 07: MusicBrainz PAL Production Migration™ ─────────────────────────
//
// Phase 3.8 Board Certification — 2026-07-02
//
// Verifies the constitutional MusicBrainz PAL pipeline:
//   A — Static contract: capabilities, provider name, connector version
//   B — EvidenceBridge: MB ARTIST_IDENTITY translation → platforms.musicbrainz.*
//   C — EvidenceBridge: MB TRACKS translation → platforms.musicbrainz.details.recordings
//   D — EvidenceBridge: MB RELEASES translation → platforms.musicbrainz.details.releaseGroups
//   E — synthesizeMBCompat: legacy compat shape output
//   F — Recording Intelligence: MB recordings flow into assembleRecordingIntelligence
//   G — Edge cases: null/empty/malformed input never throws
//
// Returns: { name, passed, failed, assertions, details[] }

import { bridgeToCanonical }       from '../../../lib/rie/EvidenceBridge.js';
import { assembleRecordingIntelligence }
  from '../../../lib/recording/recording-intelligence.js';
import { MB_CAPABILITIES }         from '../../../provider-acquisition/connectors/musicbrainz/mb-capabilities.js';
import { Capability }              from '../../../provider-acquisition/capability/capabilityVocabulary.js';
import { createEvidenceContract }  from '../../../provider-acquisition/evidence/EvidenceContract.js';
import { synthesizeMBCompat }      from '../../../api/_lib/mb-pal-acquisition.js';
import { PROVIDER_NAME, CONNECTOR_VERSION }
  from '../../../provider-acquisition/connectors/musicbrainz/MusicBrainzConnector.js';

function check(label, pass, note = '') {
  return { label, pass, note: pass ? '' : (note || 'assertion failed') };
}

// ── Synthetic contract builder ────────────────────────────────────────────────

const NOW = '2026-07-02T00:00:00.000Z';

function mbContract(evidenceType, payload) {
  return createEvidenceContract({
    acquisitionId:        'test-acq-id',
    correlationId:        'test-corr-id',
    requestId:            'test-req-id',
    provider:             'musicbrainz',
    providerVersion:      '2',
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

function mbPackage(evidenceType, payload) {
  return { evidenceType, contract: mbContract(evidenceType, payload) };
}

// ── Mock payloads ─────────────────────────────────────────────────────────────

const ARTIST_SEARCH_PAYLOAD = {
  artists: [{
    id:          'b8a7c3ae-38d7-4489-9cb5-38f44d59f406',
    name:        'Ed Sheeran',
    'sort-name': 'Sheeran, Ed',
    score:       100,
    country:     'GB',
    type:        'Person',
    'life-span': { begin: '1991-02-17', ended: false },
    aliases: [
      { name: 'エド・シーラン', locale: 'ja', type: 'Artist name' },
      { name: 'Edward Christopher Sheeran', locale: null, type: 'Legal name' },
    ],
    tags: [
      { name: 'pop', count: 25 },
      { name: 'singer-songwriter', count: 10 },
    ],
  }],
};

const ARTIST_DIRECT_PAYLOAD = {
  id:          'b8a7c3ae-38d7-4489-9cb5-38f44d59f406',
  name:        'Ed Sheeran',
  'sort-name': 'Sheeran, Ed',
  country:     'GB',
  type:        'Person',
  'life-span': { begin: '1991-02-17', ended: false },
  aliases: [
    { name: 'エド・シーラン', locale: 'ja', type: 'Artist name' },
  ],
  tags: [{ name: 'pop', count: 25 }],
};

const RECORDINGS_PAYLOAD = {
  recordings: [
    { id: 'rec1', title: 'Shape of You', length: 233713, isrcs: ['GBAHS1600463'] },
    { id: 'rec2', title: 'Perfect',      length: 263400, isrcs: ['GBAHS1700543'] },
    { id: 'rec3', title: 'Castle on the Hill', length: 261413, isrcs: [] },
  ],
  'recording-count': 3,
};

const RELEASE_GROUPS_PAYLOAD = {
  'release-groups': [
    { id: 'rg1', title: '÷',            'primary-type': 'Album',  'secondary-types': [], 'first-release-date': '2017-03-03' },
    { id: 'rg2', title: 'Shape of You', 'primary-type': 'Single', 'secondary-types': [], 'first-release-date': '2017-01-06' },
  ],
  'release-group-count': 2,
};

// ── Group A — Static contract ─────────────────────────────────────────────────

function groupA() {
  const assertions = [];

  assertions.push(check('PROVIDER_NAME is "musicbrainz"',
    PROVIDER_NAME === 'musicbrainz'));

  assertions.push(check('CONNECTOR_VERSION is "1.0"',
    CONNECTOR_VERSION === '1.0'));

  assertions.push(check('MB_CAPABILITIES is frozen',
    Object.isFrozen(MB_CAPABILITIES)));

  assertions.push(check('MB_CAPABILITIES is an array',
    Array.isArray(MB_CAPABILITIES)));

  assertions.push(check('MB_CAPABILITIES includes ARTIST_IDENTITY',
    MB_CAPABILITIES.includes(Capability.ARTIST_IDENTITY)));

  assertions.push(check('MB_CAPABILITIES includes TRACKS',
    MB_CAPABILITIES.includes(Capability.TRACKS)));

  assertions.push(check('MB_CAPABILITIES includes RELEASES',
    MB_CAPABILITIES.includes(Capability.RELEASES)));

  assertions.push(check('MB_CAPABILITIES includes ISRC',
    MB_CAPABILITIES.includes(Capability.ISRC)));

  assertions.push(check('MB_CAPABILITIES has exactly 4 capabilities',
    MB_CAPABILITIES.length === 4, `got ${MB_CAPABILITIES.length}`));

  return { label: 'A — Static Contract', assertions };
}

// ── Group B — EvidenceBridge: ARTIST_IDENTITY translation ────────────────────

function groupB() {
  const assertions = [];

  // Test 1: search-result shape (artists[])
  const searchPackage = [mbPackage(Capability.ARTIST_IDENTITY, ARTIST_SEARCH_PAYLOAD)];
  const canonical1    = bridgeToCanonical(searchPackage);

  assertions.push(check('ARTIST_IDENTITY (search): platforms.musicbrainz present',
    canonical1?.platforms?.musicbrainz != null));

  assertions.push(check('ARTIST_IDENTITY (search): availability = VERIFIED',
    canonical1?.platforms?.musicbrainz?.availability === 'VERIFIED'));

  assertions.push(check('ARTIST_IDENTITY (search): mbid extracted',
    canonical1?.platforms?.musicbrainz?.mbid === 'b8a7c3ae-38d7-4489-9cb5-38f44d59f406'));

  assertions.push(check('ARTIST_IDENTITY (search): artistName extracted',
    canonical1?.platforms?.musicbrainz?.artistName === 'Ed Sheeran'));

  assertions.push(check('ARTIST_IDENTITY (search): sortName extracted',
    canonical1?.platforms?.musicbrainz?.sortName === 'Sheeran, Ed'));

  assertions.push(check('ARTIST_IDENTITY (search): country extracted',
    canonical1?.platforms?.musicbrainz?.country === 'GB'));

  assertions.push(check('ARTIST_IDENTITY (search): aliases is array',
    Array.isArray(canonical1?.platforms?.musicbrainz?.aliases)));

  assertions.push(check('ARTIST_IDENTITY (search): aliases has 2 entries',
    canonical1?.platforms?.musicbrainz?.aliases?.length === 2,
    `got ${canonical1?.platforms?.musicbrainz?.aliases?.length}`));

  assertions.push(check('ARTIST_IDENTITY (search): tags is array',
    Array.isArray(canonical1?.platforms?.musicbrainz?.tags)));

  assertions.push(check('ARTIST_IDENTITY (search): tags has name+count shape',
    canonical1?.platforms?.musicbrainz?.tags?.[0]?.name === 'pop' &&
    canonical1?.platforms?.musicbrainz?.tags?.[0]?.count === 25));

  assertions.push(check('ARTIST_IDENTITY (search): details.mbid set',
    canonical1?.platforms?.musicbrainz?.details?.mbid === 'b8a7c3ae-38d7-4489-9cb5-38f44d59f406'));

  assertions.push(check('ARTIST_IDENTITY (search): details.type set',
    canonical1?.platforms?.musicbrainz?.details?.type === 'Person'));

  // Test 2: direct-lookup shape (payload.id)
  const directPackage = [mbPackage(Capability.ARTIST_IDENTITY, ARTIST_DIRECT_PAYLOAD)];
  const canonical2    = bridgeToCanonical(directPackage);

  assertions.push(check('ARTIST_IDENTITY (direct): mbid extracted from direct payload',
    canonical2?.platforms?.musicbrainz?.mbid === 'b8a7c3ae-38d7-4489-9cb5-38f44d59f406'));

  assertions.push(check('ARTIST_IDENTITY (direct): availability = VERIFIED',
    canonical2?.platforms?.musicbrainz?.availability === 'VERIFIED'));

  assertions.push(check('ARTIST_IDENTITY (direct): aliases extracted',
    canonical2?.platforms?.musicbrainz?.aliases?.length === 1));

  return { label: 'B — EvidenceBridge: ARTIST_IDENTITY Translation', assertions };
}

// ── Group C — EvidenceBridge: TRACKS translation ─────────────────────────────

function groupC() {
  const assertions = [];

  const packages  = [mbPackage(Capability.TRACKS, RECORDINGS_PAYLOAD)];
  const canonical = bridgeToCanonical(packages);

  assertions.push(check('TRACKS: platforms.musicbrainz.details.recordings present',
    Array.isArray(canonical?.platforms?.musicbrainz?.details?.recordings)));

  assertions.push(check('TRACKS: correct recording count',
    canonical?.platforms?.musicbrainz?.details?.recordings?.length === 3,
    `got ${canonical?.platforms?.musicbrainz?.details?.recordings?.length}`));

  const rec0 = canonical?.platforms?.musicbrainz?.details?.recordings?.[0];
  assertions.push(check('TRACKS: first recording has id',
    rec0?.id === 'rec1'));

  assertions.push(check('TRACKS: first recording has title',
    rec0?.title === 'Shape of You'));

  assertions.push(check('TRACKS: first recording has length',
    rec0?.length === 233713));

  assertions.push(check('TRACKS: first recording has isrcs array',
    Array.isArray(rec0?.isrcs) && rec0.isrcs[0] === 'GBAHS1600463'));

  const rec2 = canonical?.platforms?.musicbrainz?.details?.recordings?.[2];
  assertions.push(check('TRACKS: recording with empty isrcs has empty array',
    Array.isArray(rec2?.isrcs) && rec2.isrcs.length === 0));

  return { label: 'C — EvidenceBridge: TRACKS Translation', assertions };
}

// ── Group D — EvidenceBridge: RELEASES translation ───────────────────────────

function groupD() {
  const assertions = [];

  const packages  = [mbPackage(Capability.RELEASES, RELEASE_GROUPS_PAYLOAD)];
  const canonical = bridgeToCanonical(packages);

  assertions.push(check('RELEASES: platforms.musicbrainz.details.releaseGroups present',
    Array.isArray(canonical?.platforms?.musicbrainz?.details?.releaseGroups)));

  assertions.push(check('RELEASES: correct release group count',
    canonical?.platforms?.musicbrainz?.details?.releaseGroups?.length === 2,
    `got ${canonical?.platforms?.musicbrainz?.details?.releaseGroups?.length}`));

  const rg0 = canonical?.platforms?.musicbrainz?.details?.releaseGroups?.[0];
  assertions.push(check('RELEASES: first release group has id',
    rg0?.id === 'rg1'));

  assertions.push(check('RELEASES: first release group has title',
    rg0?.title === '÷'));

  assertions.push(check('RELEASES: first release group has primaryType',
    rg0?.primaryType === 'Album'));

  assertions.push(check('RELEASES: first release group has firstReleaseDate',
    rg0?.firstReleaseDate === '2017-03-03'));

  assertions.push(check('RELEASES: secondaryTypes is array',
    Array.isArray(rg0?.secondaryTypes)));

  const rg1 = canonical?.platforms?.musicbrainz?.details?.releaseGroups?.[1];
  assertions.push(check('RELEASES: second release group is a Single',
    rg1?.primaryType === 'Single'));

  return { label: 'D — EvidenceBridge: RELEASES Translation', assertions };
}

// ── Group E — synthesizeMBCompat ─────────────────────────────────────────────

function groupE() {
  const assertions = [];

  // Empty packages → found: false
  const empty = synthesizeMBCompat([], 'Ed Sheeran');
  assertions.push(check('synthesizeMBCompat([]) returns found: false',
    empty.found === false));
  assertions.push(check('synthesizeMBCompat([]) returns artists: []',
    Array.isArray(empty.artists) && empty.artists.length === 0));
  assertions.push(check('synthesizeMBCompat([]) returns topMatch: null',
    empty.topMatch === null));
  assertions.push(check('synthesizeMBCompat([]) returns score: 0',
    empty.score === 0));

  // Empty-contract package → found: false
  const emptyPkg = [{
    evidenceType: Capability.ARTIST_IDENTITY,
    contract: mbContract(Capability.ARTIST_IDENTITY, null),
  }];
  const fromEmpty = synthesizeMBCompat(emptyPkg, 'Ed Sheeran');
  assertions.push(check('synthesizeMBCompat(empty contract) returns found: false',
    fromEmpty.found === false));

  // Search-result package with exact name match
  const searchPkg = [mbPackage(Capability.ARTIST_IDENTITY, ARTIST_SEARCH_PAYLOAD)];
  const fromSearch = synthesizeMBCompat(searchPkg, 'Ed Sheeran');
  assertions.push(check('synthesizeMBCompat(search pkg) returns found: true for exact name',
    fromSearch.found === true));
  assertions.push(check('synthesizeMBCompat(search pkg) topMatch is the artist',
    fromSearch.topMatch?.id === 'b8a7c3ae-38d7-4489-9cb5-38f44d59f406'));
  assertions.push(check('synthesizeMBCompat(search pkg) score is numeric',
    typeof fromSearch.score === 'number'));
  assertions.push(check('synthesizeMBCompat(search pkg) score = 100',
    fromSearch.score === 100));
  assertions.push(check('synthesizeMBCompat(search pkg) artists array populated',
    fromSearch.artists.length === 1));

  // Case-insensitive name matching
  const fromLower = synthesizeMBCompat(searchPkg, 'ed sheeran');
  assertions.push(check('synthesizeMBCompat: case-insensitive name match',
    fromLower.found === true));

  // No name match → found: false
  const fromWrong = synthesizeMBCompat(searchPkg, 'Taylor Swift');
  assertions.push(check('synthesizeMBCompat: non-matching name returns found: false',
    fromWrong.found === false));

  // Direct-lookup package
  const directPkg = [mbPackage(Capability.ARTIST_IDENTITY, ARTIST_DIRECT_PAYLOAD)];
  const fromDirect = synthesizeMBCompat(directPkg, 'Ed Sheeran');
  assertions.push(check('synthesizeMBCompat(direct payload) returns found: true',
    fromDirect.found === true));
  assertions.push(check('synthesizeMBCompat(direct payload) topMatch.id correct',
    fromDirect.topMatch?.id === 'b8a7c3ae-38d7-4489-9cb5-38f44d59f406'));

  return { label: 'E — synthesizeMBCompat Legacy Shape', assertions };
}

// ── Group F — Recording Intelligence: MB recordings integration ───────────────

function groupF() {
  const assertions = [];

  // Build a canonicalForEnrichment with MB recordings + Spotify tracks
  const canonical = {
    subject: { artistName: 'Ed Sheeran' },
    platforms: {
      spotify: {
        details: {
          topTracks: [
            { id: 'sp1', name: 'Shape of You',   isrc: 'GBAHS1600463', artistName: 'Ed Sheeran', popularity: 90 },
            { id: 'sp2', name: 'Perfect',         isrc: 'GBAHS1700543', artistName: 'Ed Sheeran', popularity: 85 },
          ],
        },
      },
      musicbrainz: {
        details: {
          recordings: [
            { id: 'rec1', title: 'Shape of You',      length: 233713, isrcs: ['GBAHS1600463'] },
            { id: 'rec2', title: 'Perfect',            length: 263400, isrcs: ['GBAHS1700543'] },
            { id: 'rec3', title: 'Castle on the Hill', length: 261413, isrcs: ['GBUM71602756'] },
          ],
        },
      },
    },
  };

  let result;
  let threw = false;
  try {
    result = assembleRecordingIntelligence(canonical);
  } catch {
    threw = true;
  }

  assertions.push(check('assembleRecordingIntelligence with MB+Spotify evidence does not throw',
    !threw));

  assertions.push(check('result is not null when evidence present',
    result !== null));

  assertions.push(check('result._version is "1.0"',
    result?._version === '1.0'));

  assertions.push(check('recordingCount is a number',
    typeof result?.recordingCount === 'number'));

  assertions.push(check('recordingCount ≥ 2 (at least Spotify evidence merged)',
    (result?.recordingCount ?? 0) >= 2,
    `got ${result?.recordingCount}`));

  assertions.push(check('recordings array present',
    Array.isArray(result?.recordings)));

  assertions.push(check('certifiedCount is a number',
    typeof result?.certifiedCount === 'number'));

  assertions.push(check('overallConfidence is a number',
    typeof result?.overallConfidence === 'number'));

  // MB-only evidence (no Spotify) should also produce a result
  const mbOnly = {
    subject: { artistName: 'Ed Sheeran' },
    platforms: {
      musicbrainz: {
        details: {
          recordings: [
            { id: 'rec1', title: 'Shape of You', length: 233713, isrcs: ['GBAHS1600463'] },
          ],
        },
      },
    },
  };

  let mbResult;
  let mbThrew = false;
  try {
    mbResult = assembleRecordingIntelligence(mbOnly);
  } catch {
    mbThrew = true;
  }

  assertions.push(check('assembleRecordingIntelligence with MB-only evidence does not throw',
    !mbThrew));

  assertions.push(check('MB-only evidence produces non-null result',
    mbResult !== null));

  assertions.push(check('MB-only: recordingCount ≥ 1',
    (mbResult?.recordingCount ?? 0) >= 1, `got ${mbResult?.recordingCount}`));

  return { label: 'F — Recording Intelligence: MB Integration', assertions };
}

// ── Group G — Edge cases ──────────────────────────────────────────────────────

function groupG() {
  const assertions = [];

  // bridgeToCanonical robustness
  let threw = false;
  try { bridgeToCanonical(null); } catch { threw = true; }
  assertions.push(check('bridgeToCanonical(null) does not throw',
    !threw));

  let threw2 = false;
  try { bridgeToCanonical([]); } catch { threw2 = true; }
  assertions.push(check('bridgeToCanonical([]) does not throw',
    !threw2));

  // MB package with null payload — should silently skip translation
  const nullPayloadPkg = [mbPackage(Capability.ARTIST_IDENTITY, null)];
  let threw3 = false;
  let c3;
  try { c3 = bridgeToCanonical(nullPayloadPkg); } catch { threw3 = true; }
  assertions.push(check('bridgeToCanonical with null payload does not throw',
    !threw3));

  // MB TRACKS with null payload — should silently skip
  const nullTracksPkg = [mbPackage(Capability.TRACKS, null)];
  let threw4 = false;
  try { bridgeToCanonical(nullTracksPkg); } catch { threw4 = true; }
  assertions.push(check('bridgeToCanonical with null TRACKS payload does not throw',
    !threw4));

  // MB RELEASES with null payload — should silently skip
  const nullReleasesPkg = [mbPackage(Capability.RELEASES, null)];
  let threw5 = false;
  try { bridgeToCanonical(nullReleasesPkg); } catch { threw5 = true; }
  assertions.push(check('bridgeToCanonical with null RELEASES payload does not throw',
    !threw5));

  // ARTIST_IDENTITY with malformed payload (no id, no artists)
  const badPayloadPkg = [mbPackage(Capability.ARTIST_IDENTITY, { someOtherField: 'irrelevant' })];
  let threw6 = false;
  let c6;
  try { c6 = bridgeToCanonical(badPayloadPkg); } catch { threw6 = true; }
  assertions.push(check('bridgeToCanonical with malformed payload does not throw',
    !threw6));

  // synthesizeMBCompat edge cases
  let threw7 = false;
  try { synthesizeMBCompat(null); } catch { threw7 = true; }
  assertions.push(check('synthesizeMBCompat(null) does not throw',
    !threw7));

  // assembleRecordingIntelligence with no MB recordings (empty array)
  const noMBRecordings = {
    subject: { artistName: 'Test' },
    platforms: {
      musicbrainz: { details: { recordings: [] } },
    },
  };
  let threw8 = false;
  let r8;
  try { r8 = assembleRecordingIntelligence(noMBRecordings); } catch { threw8 = true; }
  assertions.push(check('assembleRecordingIntelligence with empty MB recordings does not throw',
    !threw8));
  assertions.push(check('assembleRecordingIntelligence with no evidence returns null',
    r8 === null));

  return { label: 'G — Edge Cases', assertions };
}

// ── Suite runner ──────────────────────────────────────────────────────────────

export async function runMusicBrainzConnector() {
  const suite = { name: '07-musicbrainz-connector', passed: 0, failed: 0, assertions: 0, details: [] };

  const groups = [
    groupA(),
    groupB(),
    groupC(),
    groupD(),
    groupE(),
    groupF(),
    groupG(),
  ];

  for (const { label, assertions } of groups) {
    const pass = assertions.filter(a => a.pass).length;
    const fail = assertions.filter(a => !a.pass).length;
    suite.passed     += pass;
    suite.failed     += fail;
    suite.assertions += assertions.length;

    const groupResult = {
      label,
      status:     fail === 0 ? 'PASS' : 'FAIL',
      passed:     pass,
      failed:     fail,
      assertions: assertions.length,
      failures:   assertions.filter(a => !a.pass),
    };

    suite.details.push(groupResult);
  }

  return suite;
}
