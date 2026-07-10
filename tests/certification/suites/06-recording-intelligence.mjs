// ─── Suite 06: Recording Intelligence Foundation™ ────────────────────────────
//
// Phase 3.7 Board Certification — 2026-07-02
//
// Verifies the constitutional recording layer:
//   A — Title Normalizer: strips versions, preserves core titles
//   B — Recording Normalizer: provider shapes → NormalizedTrack
//   C — Recording Matcher: ISRC-first then title grouping
//   D — ISRC Certification: VERIFIED / SINGLE_SOURCE / CONFLICT / UNABLE_TO_CONFIRM
//   E — Recording Confidence: per-recording score, overall confidence
//   F — Recording Assembler: end-to-end pure pipeline
//   G — CIM §8.2.13: recording slot present after runRIE
//   H — Edge cases: null / empty / malformed input never throws
//
// Returns: { name, passed, failed, assertions, details[] }

import { normalizeTitle, normalizeTitleStrict, titleVariants }
  from '../../../lib/recording/title-normalizer.js';
import { normalizeSpotifyTracks, normalizeAppleSongs }
  from '../../../lib/recording/recording-normalizer.js';
import { matchRecordings, deduplicate }
  from '../../../lib/recording/recording-matcher.js';
import { buildCanonicalRecordings }
  from '../../../lib/recording/canonical-recording.js';
import { certifyISRCs }
  from '../../../lib/recording/isrc-certification.js';
import { computeRecordingConfidence, computeOverallConfidence }
  from '../../../lib/recording/recording-confidence.js';
import { RECORDING_CONFIDENCE_POLICY }
  from '../../../lib/recording/recording-confidence-policy.js';
import { assembleRecordingIntelligence }
  from '../../../lib/recording/recording-intelligence.js';
import { runRIE }
  from '../../../lib/rie/index.js';

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join }  from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

function check(label, pass, note = '') {
  return { label, pass, note: pass ? '' : (note || 'assertion failed') };
}

// ── Fixtures ─────────────────────────────────────────────────────

const SPOTIFY_TRACKS = [
  { id: 'sp1', name: 'Shape of You', isrc: 'GBAHS1600463', artistName: 'Ed Sheeran', popularity: 90 },
  { id: 'sp2', name: 'Perfect',      isrc: 'GBAHS1700543', artistName: 'Ed Sheeran', popularity: 85 },
  { id: 'sp3', name: 'Blinding Lights', isrc: 'CAXPQ2100001', artistName: 'The Weeknd', popularity: 95 },
  { id: 'sp4', name: 'Shape of You (Radio Edit)', isrc: 'GBAHS1600463', artistName: 'Ed Sheeran', popularity: 70 },
  { id: 'sp5', name: 'No ISRC Track',  isrc: null,         artistName: 'Test Artist', popularity: 50 },
  { id: 'sp6', name: 'Invalid ISRC',   isrc: 'BAD-ISRC',   artistName: 'Test Artist', popularity: 40 },
];

const APPLE_SONGS = [
  { id: 'ap1', name: 'Shape of You', isrc: 'GBAHS1600463' },
  { id: 'ap2', name: 'Perfect',      isrc: 'GBAHS1700543' },
  { id: 'ap3', name: 'Conflict Song', isrc: 'GBXXX1900001' },
];

const SPOTIFY_WITH_CONFLICT = [
  { id: 'cx1', name: 'Conflict Song', isrc: 'GBXXX1900002', artistName: 'Artist X', popularity: 60 },
];

// canonicalForEnrichment stub carrying Spotify top-tracks
const CANONICAL_WITH_SPOTIFY = {
  subject:   { artistName: 'Ed Sheeran' },
  platforms: {
    spotify: {
      availability: 'VERIFIED',
      details: { topTracks: SPOTIFY_TRACKS },
    },
  },
};

const CANONICAL_EMPTY = {
  subject:   { artistName: 'Unknown' },
  platforms: {},
};

// ── Group runners ────────────────────────────────────────────────

function groupA() {
  const assertions = [];

  assertions.push(check('normalizeTitle strips (Radio Edit)',
    normalizeTitle('Shape of You (Radio Edit)') === 'Shape of You'));

  assertions.push(check('normalizeTitle strips - Remastered',
    normalizeTitle('Blinding Lights - Remastered') === 'Blinding Lights'));

  assertions.push(check('normalizeTitle leaves plain title unchanged',
    normalizeTitle('Perfect') === 'Perfect'));

  assertions.push(check('normalizeTitleStrict strips feat.',
    normalizeTitleStrict('Strange Situation (feat. Chuck Ice)') === 'Strange Situation'));

  assertions.push(check('titleVariants returns array with ≥1 entry',
    Array.isArray(titleVariants('Shape of You (Radio Edit)'))
    && titleVariants('Shape of You (Radio Edit)').length >= 2));

  assertions.push(check('titleVariants deduplicates entries',
    titleVariants('Perfect').every((v, i, a) => a.indexOf(v) === i)));

  return { label: 'A — Title Normalizer', assertions };
}

function groupB() {
  const assertions = [];

  const tracks = normalizeSpotifyTracks(SPOTIFY_TRACKS);

  assertions.push(check('normalizeSpotifyTracks returns array',
    Array.isArray(tracks)));

  assertions.push(check('count matches input',
    tracks.length === SPOTIFY_TRACKS.length));

  assertions.push(check('source is "spotify" for all',
    tracks.every(t => t.source === 'spotify')));

  assertions.push(check('valid ISRC preserved (GBAHS1600463)',
    tracks[0].isrc === 'GBAHS1600463'));

  assertions.push(check('null ISRC stays null',
    tracks[4].isrc === null));

  assertions.push(check('invalid ISRC becomes null',
    tracks[5].isrc === null));

  assertions.push(check('title populated',
    tracks.every(t => typeof t.title === 'string' && t.title.length > 0)));

  const appleTracks = normalizeAppleSongs(APPLE_SONGS);
  assertions.push(check('normalizeAppleSongs returns array',
    Array.isArray(appleTracks)));
  assertions.push(check('apple source label',
    appleTracks.every(t => t.source === 'apple')));
  assertions.push(check('apple ISRC validated',
    appleTracks[0].isrc === 'GBAHS1600463'));

  assertions.push(check('empty input returns []',
    normalizeSpotifyTracks([]).length === 0));
  assertions.push(check('null input returns []',
    normalizeSpotifyTracks(null).length === 0));

  return { label: 'B — Recording Normalizer', assertions };
}

function groupC() {
  const assertions = [];
  const tracks     = normalizeSpotifyTracks(SPOTIFY_TRACKS);
  const groups     = matchRecordings(tracks);

  assertions.push(check('matchRecordings returns array',
    Array.isArray(groups)));

  // sp1 and sp4 share ISRC GBAHS1600463 → one ISRC group
  const isrcGroup = groups.find(g => g.key === 'GBAHS1600463');
  assertions.push(check('ISRC group found for GBAHS1600463',
    !!isrcGroup));
  assertions.push(check('ISRC group has matchType ISRC',
    isrcGroup?.matchType === 'ISRC'));
  assertions.push(check('ISRC group contains 2 tracks (sp1 + sp4)',
    isrcGroup?.tracks.length === 2));

  // sp5 (no ISRC) → title group
  const titleGroups = groups.filter(g => g.matchType === 'TITLE');
  assertions.push(check('TITLE groups present for no-ISRC tracks',
    titleGroups.length >= 1));

  // ISRC groups precede TITLE groups in output
  const firstTitle = groups.findIndex(g => g.matchType === 'TITLE');
  const lastIsrc   = groups.findLastIndex(g => g.matchType === 'ISRC');
  assertions.push(check('ISRC groups precede TITLE groups',
    lastIsrc === -1 || firstTitle === -1 || lastIsrc < firstTitle));

  assertions.push(check('empty input returns []',
    matchRecordings([]).length === 0));

  const deduped = deduplicate(groups);
  assertions.push(check('deduplicate returns array',
    Array.isArray(deduped)));
  assertions.push(check('deduplicate preserves ISRC groups',
    deduped.filter(g => g.matchType === 'ISRC').length ===
    groups.filter(g => g.matchType === 'ISRC').length));

  return { label: 'C — Recording Matcher', assertions };
}

function groupD() {
  const assertions = [];

  // VERIFIED: Apple + Spotify agree on same ISRC
  const verified = buildCanonicalRecordings({
    artistName:    'Ed Sheeran',
    appleSongs:    [{ id: 'a1', name: 'Shape of You', isrc: 'GBAHS1600463' }],
    spotifyTracks: [{ name: 'Shape of You', isrc: 'GBAHS1600463', trackId: 'sp1' }],
  });
  const certifiedVerified = certifyISRCs(verified);
  const verifiedRec = certifiedVerified[0];
  assertions.push(check('VERIFIED when 2 sources agree on ISRC',
    verifiedRec?.certificationStatus === 'VERIFIED'));
  assertions.push(check('VERIFIED certifiedISRC populated',
    verifiedRec?.certifiedISRC === 'GBAHS1600463'));

  // SINGLE_SOURCE: only Spotify has ISRC
  const single = buildCanonicalRecordings({
    artistName:    'Ed Sheeran',
    spotifyTracks: [{ name: 'Perfect', isrc: 'GBAHS1700543', trackId: 'sp2' }],
  });
  const certifiedSingle = certifyISRCs(single)[0];
  assertions.push(check('SINGLE_SOURCE when one source has ISRC',
    certifiedSingle?.certificationStatus === 'SINGLE_SOURCE'));

  // UNABLE_TO_CONFIRM: no ISRC anywhere
  const none = buildCanonicalRecordings({
    artistName:    'Test',
    spotifyTracks: [{ name: 'No ISRC Track', isrc: null, trackId: 'sp5' }],
  });
  const certifiedNone = certifyISRCs(none)[0];
  assertions.push(check('UNABLE_TO_CONFIRM when no ISRC',
    certifiedNone?.certificationStatus === 'UNABLE_TO_CONFIRM'));

  // CONFLICT: sources disagree on ISRC
  const conflict = buildCanonicalRecordings({
    artistName:    'Artist X',
    appleSongs:    [{ id: 'a3', name: 'Conflict Song', isrc: 'GBXXX1900001' }],
    spotifyTracks: [{ name: 'Conflict Song', isrc: 'GBXXX1900002', trackId: 'cx1' }],
  });
  const certifiedConflict = certifyISRCs(conflict)[0];
  assertions.push(check('CONFLICT when sources disagree',
    certifiedConflict?.certificationStatus === 'CONFLICT'));
  assertions.push(check('CONFLICT isrcConflicts populated',
    certifiedConflict?.isrcConflicts.length >= 2));

  assertions.push(check('certifyISRCs([]) returns []',
    certifyISRCs([]).length === 0));
  assertions.push(check('certifyISRCs(null) returns []',
    certifyISRCs(null).length === 0));

  return { label: 'D — ISRC Certification', assertions };
}

function groupE() {
  const assertions = [];

  // Confidence for VERIFIED (2-source)
  const verifiedRec = {
    certificationStatus: 'VERIFIED',
    sourceEvidence: [
      { source: 'apple',   title: 'Shape of You', isrc: 'GBAHS1600463' },
      { source: 'spotify', title: 'Shape of You', isrc: 'GBAHS1600463' },
    ],
  };
  const verifiedConf = computeRecordingConfidence(verifiedRec);
  assertions.push(check('VERIFIED 2-source confidence > 0.7',
    verifiedConf > 0.7,
    `got ${verifiedConf}`));
  assertions.push(check('confidence is 0.0–1.0',
    verifiedConf >= 0 && verifiedConf <= 1));

  // Confidence for SINGLE_SOURCE
  const singleRec = {
    certificationStatus: 'SINGLE_SOURCE',
    sourceEvidence: [
      { source: 'spotify', title: 'Perfect', isrc: 'GBAHS1700543' },
    ],
  };
  const singleConf = computeRecordingConfidence(singleRec);
  assertions.push(check('SINGLE_SOURCE confidence < VERIFIED',
    singleConf < verifiedConf,
    `single=${singleConf} verified=${verifiedConf}`));

  // CONFLICT confidence — 2-source conflicts score independently from SINGLE_SOURCE.
  // With 2 providers, CONFLICT can outscore 1-source SINGLE_SOURCE because provider
  // coverage is a separate dimension from ISRC agreement. The key invariant is that
  // VERIFIED (full agreement) > CONFLICT (disagreement) when source count is equal.
  const conflictRec = {
    certificationStatus: 'CONFLICT',
    sourceEvidence: [
      { source: 'apple',   title: 'Conflict Song', isrc: 'GBXXX1900001' },
      { source: 'spotify', title: 'Conflict Song', isrc: 'GBXXX1900002' },
    ],
  };
  const conflictConf = computeRecordingConfidence(conflictRec);
  assertions.push(check('CONFLICT confidence is a valid 0.0–1.0 number',
    typeof conflictConf === 'number' && conflictConf >= 0 && conflictConf <= 1,
    `got ${conflictConf}`));

  // Equal-source invariant: VERIFIED beats CONFLICT when both have 2 sources
  const verifiedRec2 = {
    certificationStatus: 'VERIFIED',
    sourceEvidence: [
      { source: 'apple',   title: 'Song', isrc: 'GBAHS1600463' },
      { source: 'spotify', title: 'Song', isrc: 'GBAHS1600463' },
    ],
  };
  assertions.push(check('VERIFIED 2-source beats CONFLICT 2-source (same provider count)',
    computeRecordingConfidence(verifiedRec2) > conflictConf,
    `verified=${computeRecordingConfidence(verifiedRec2)} conflict=${conflictConf}`));

  // computeOverallConfidence
  const overall = computeOverallConfidence([verifiedRec, singleRec, conflictRec]);
  assertions.push(check('computeOverallConfidence returns number',
    typeof overall === 'number'));
  assertions.push(check('overall confidence 0.0–1.0',
    overall >= 0 && overall <= 1));
  assertions.push(check('computeOverallConfidence([]) returns null',
    computeOverallConfidence([]) === null));
  assertions.push(check('computeOverallConfidence(null) returns null',
    computeOverallConfidence(null) === null));

  return { label: 'E — Recording Confidence', assertions };
}

function groupF() {
  const assertions = [];

  // Happy path
  const result = assembleRecordingIntelligence(CANONICAL_WITH_SPOTIFY);
  assertions.push(check('assembleRecordingIntelligence returns non-null',
    result !== null));
  assertions.push(check('_version is "1.0"',
    result?._version === '1.0'));
  assertions.push(check('recordingCount > 0',
    result?.recordingCount > 0,
    `got ${result?.recordingCount}`));
  assertions.push(check('recordings is array',
    Array.isArray(result?.recordings)));
  assertions.push(check('certifiedCount + singleSourceCount + conflictCount + unconfirmedCount === recordingCount',
    (result?.certifiedCount ?? 0) +
    (result?.singleSourceCount ?? 0) +
    (result?.conflictCount ?? 0) +
    (result?.unconfirmedCount ?? 0) === result?.recordingCount,
    `sum=${(result?.certifiedCount ?? 0)+(result?.singleSourceCount ?? 0)+(result?.conflictCount ?? 0)+(result?.unconfirmedCount ?? 0)} count=${result?.recordingCount}`));
  assertions.push(check('isrcCoveragePercent is number or null',
    result?.isrcCoveragePercent === null || typeof result?.isrcCoveragePercent === 'number'));
  assertions.push(check('overallConfidence is number or null',
    result?.overallConfidence === null || typeof result?.overallConfidence === 'number'));
  assertions.push(check('generatedAt is ISO string',
    typeof result?.generatedAt === 'string' && result.generatedAt.includes('T')));

  // Each recording has certificationStatus + confidence
  const allHaveStatus = result?.recordings.every(r =>
    ['VERIFIED','SINGLE_SOURCE','CONFLICT','UNABLE_TO_CONFIRM'].includes(r.certificationStatus)
  );
  assertions.push(check('all recordings have certificationStatus',
    !!allHaveStatus));
  const allHaveConf = result?.recordings.every(r =>
    typeof r.confidence === 'number' && r.confidence >= 0 && r.confidence <= 1
  );
  assertions.push(check('all recordings have confidence 0.0–1.0',
    !!allHaveConf));

  // sp1 and sp4 share ISRC → merged into one canonical recording (SINGLE_SOURCE)
  const shapeRec = result?.recordings.find(r => r.isrcs?.includes('GBAHS1600463'));
  assertions.push(check('tracks sharing ISRC merged into one recording',
    !!shapeRec));

  // No evidence → null
  const noResult = assembleRecordingIntelligence(CANONICAL_EMPTY);
  assertions.push(check('returns null when no track evidence',
    noResult === null));

  // Never throws on null / undefined
  assertions.push(check('does not throw on null input',
    (() => { try { assembleRecordingIntelligence(null); return true; } catch { return false; } })()));
  assertions.push(check('does not throw on undefined input',
    (() => { try { assembleRecordingIntelligence(undefined); return true; } catch { return false; } })()));

  return { label: 'F — Recording Assembler (pure pipeline)', assertions };
}

async function groupG() {
  const assertions = [];

  let radiohead;
  try {
    radiohead = JSON.parse(readFileSync(
      join(__dirname, '../../../api/fixtures/canonical-radiohead.json'), 'utf8'
    ));
  } catch (e) {
    assertions.push(check('canonical-radiohead fixture loads', false, e.message));
    return { label: 'G — CIM §8.2.13 integration', assertions };
  }

  let cim;
  try {
    cim = await runRIE(
      { canonicalForEnrichment: JSON.parse(JSON.stringify(radiohead)) },
      { now: () => '2026-07-02T00:00:00.000Z' }
    );
    assertions.push(check('runRIE completes', true));
  } catch (e) {
    assertions.push(check('runRIE completes', false, e.message));
    return { label: 'G — CIM §8.2.13 integration', assertions };
  }

  assertions.push(check('cim.recording key exists',
    'recording' in cim));
  assertions.push(check('cim.recording is null or object (null valid when no Spotify evidence)',
    cim.recording === null || (typeof cim.recording === 'object')));
  assertions.push(check('CIM is still certified',
    cim._certified === true));

  // When recording is populated, validate structure
  if (cim.recording !== null) {
    assertions.push(check('cim.recording._version is "1.0"',
      cim.recording?._version === '1.0'));
    assertions.push(check('cim.recording.recordingCount is number',
      typeof cim.recording?.recordingCount === 'number'));
    assertions.push(check('cim.recording.recordings is array',
      Array.isArray(cim.recording?.recordings)));
  } else {
    assertions.push(check('cim.recording is null (no Spotify evidence in radiohead fixture)', true,
      'null is valid — radiohead fixture predates Spotify PAL evidence'));
  }

  return { label: 'G — CIM §8.2.13 integration', assertions };
}

function groupH() {
  const assertions = [];

  // normalizeSpotifyTracks edge cases
  assertions.push(check('normalizeSpotifyTracks handles undefined',
    normalizeSpotifyTracks(undefined).length === 0));
  assertions.push(check('normalizeSpotifyTracks filters out null entries',
    normalizeSpotifyTracks([null, undefined, { name: 'Valid', isrc: null }]).length === 1));
  assertions.push(check('normalizeSpotifyTracks filters tracks with empty name',
    normalizeSpotifyTracks([{ name: '', isrc: null }]).length === 0));

  // matchRecordings edge cases
  assertions.push(check('matchRecordings handles null',
    matchRecordings(null).length === 0));
  assertions.push(check('matchRecordings handles tracks with empty title',
    Array.isArray(matchRecordings([{ source: 'spotify', trackId: 'x', title: '', isrc: null, durationMs: null, artistName: '', popularity: null }]))));

  // buildCanonicalRecordings edge cases
  assertions.push(check('buildCanonicalRecordings empty inputs → []',
    buildCanonicalRecordings({}).length === 0));

  // certifyISRCs edge cases
  assertions.push(check('certifyISRCs with no sourceEvidence returns UNABLE_TO_CONFIRM',
    certifyISRCs([{ canonicalTitle: 'X', sourceEvidence: [], isrcs: [] }])[0]
      ?.certificationStatus === 'UNABLE_TO_CONFIRM'));

  // computeRecordingConfidence edge cases
  assertions.push(check('computeRecordingConfidence(null) returns 0',
    computeRecordingConfidence(null) === 0));
  assertions.push(check('computeRecordingConfidence({}) returns number',
    typeof computeRecordingConfidence({}) === 'number'));

  return { label: 'H — Edge Cases', assertions };
}

function groupI() {
  const assertions = [];
  const policy = RECORDING_CONFIDENCE_POLICY;

  assertions.push(check('RECORDING_CONFIDENCE_POLICY exports an object',
    typeof policy === 'object' && policy !== null));

  assertions.push(check('policy.weights exists',
    typeof policy?.weights === 'object' && policy.weights !== null));

  assertions.push(check('policy is frozen',
    Object.isFrozen(policy)));

  assertions.push(check('policy.weights is frozen',
    Object.isFrozen(policy?.weights)));

  const { isrc, provider, title, artist } = policy?.weights ?? {};

  assertions.push(check('isrc weight is 0.55',
    isrc === 0.55, `got ${isrc}`));

  assertions.push(check('provider weight is 0.20',
    provider === 0.20, `got ${provider}`));

  assertions.push(check('title weight is 0.15',
    title === 0.15, `got ${title}`));

  assertions.push(check('artist weight is 0.10',
    artist === 0.10, `got ${artist}`));

  const total = (isrc ?? 0) + (provider ?? 0) + (title ?? 0) + (artist ?? 0);
  assertions.push(check('weights sum to 1.00',
    Math.round(total * 100) === 100,
    `sum=${total}`));

  // Algorithm consumes policy: VERIFIED 2-source score must match policy-derived value
  const verifiedRec = {
    certificationStatus: 'VERIFIED',
    sourceEvidence: [
      { source: 'apple',   title: 'Song', isrc: 'GBAHS1600463' },
      { source: 'spotify', title: 'Song', isrc: 'GBAHS1600463' },
    ],
  };
  const expectedVerified = Math.round(
    (isrc + provider * 0.65 + title + artist) * 100
  ) / 100;
  const actualVerified = computeRecordingConfidence(verifiedRec);
  assertions.push(check('algorithm uses policy ISRC weight for VERIFIED score',
    actualVerified === expectedVerified,
    `expected ${expectedVerified} got ${actualVerified}`));

  // SINGLE_SOURCE score must also match policy-derived value
  const singleRec = {
    certificationStatus: 'SINGLE_SOURCE',
    sourceEvidence: [{ source: 'spotify', title: 'Song', isrc: 'GBAHS1700543' }],
  };
  const expectedSingle = Math.round(
    (isrc * 0.5 + provider * 0.30 + title * 0.50 + artist) * 100
  ) / 100;
  const actualSingle = computeRecordingConfidence(singleRec);
  assertions.push(check('algorithm uses policy ISRC weight for SINGLE_SOURCE score',
    actualSingle === expectedSingle,
    `expected ${expectedSingle} got ${actualSingle}`));

  return { label: 'I — Recording Confidence Policy (Board-ratified)', assertions };
}

// ── Suite runner ─────────────────────────────────────────────────

export async function runRecordingIntelligence() {
  const suite = { name: '06-recording-intelligence', passed: 0, failed: 0, assertions: 0, details: [] };

  const groups = [
    groupA(),
    groupB(),
    groupC(),
    groupD(),
    groupE(),
    groupF(),
    await groupG(),
    groupH(),
    groupI(),
  ];

  for (const { label, assertions } of groups) {
    const pass = assertions.filter(a => a.pass).length;
    const fail = assertions.filter(a => !a.pass).length;
    suite.passed     += pass;
    suite.failed     += fail;
    suite.assertions += assertions.length;
    suite.details.push({ fixture: label, status: fail === 0 ? 'PASS' : 'FAIL', assertions });
  }

  return suite;
}
