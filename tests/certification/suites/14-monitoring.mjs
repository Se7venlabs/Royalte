// ─── Suite 14: Monitoring Intelligence Migration Sprint™ ──────────────────────
//
// Board Authorization 2026-07-03 — UNANIMOUSLY APPROVED
//
// Verifies the constitutional monitoring foundation:
//   A — EventSeverity: five Board-ratified severity levels; frozen; ordering
//   B — MonitoringPolicy: frozen; policy-driven thresholds; severity resolution; confidence
//   C — EvidenceSnapshot: creation, immutability, schema version, fields required
//   D — SnapshotStore: append-only; no-change guard; getters; artist isolation
//   E — EvidenceDiffEngine: additions, removals, modifications; deterministic; never throws
//   F — EvidenceEvent: all constitutional fields; immutable; UUID; validation
//   G — MonitoringIntelligence: full pipeline; explainability; summary; report fields
//   H — Historical replay capability: pair retrieval; chronological ordering
//   I — Edge cases / never-throw guarantees
//
// Returns: { name, passed, failed, assertions, details[] }

import { EventSeverity, isValidSeverity, SEVERITY_ORDER, isAtLeast } from '../../../monitoring/events/EventSeverity.js';
import { DEFAULT_MONITORING_POLICY, resolveSeverity, computeConfidence, POLICY_VERSION } from '../../../monitoring/policy/MonitoringPolicy.js';
import { createEvidenceSnapshot, evidenceDiffers, SNAPSHOT_SCHEMA_VERSION } from '../../../monitoring/snapshot/EvidenceSnapshot.js';
import { SnapshotStore } from '../../../monitoring/snapshot/SnapshotStore.js';
import { compareSnapshots, compareEvidence, filterByPath, filterByChangeType, extractProvider } from '../../../monitoring/diff/EvidenceDiffEngine.js';
import { createEvidenceEvent, EVENT_SCHEMA_VERSION } from '../../../monitoring/events/EvidenceEvent.js';
import { runMonitoringIntelligence, MONITORING_INTELLIGENCE_VERSION } from '../../../monitoring/intelligence/MonitoringIntelligence.js';

function check(label, pass, note = '') {
  return { label, pass, note: pass ? '' : (note || 'assertion failed') };
}

// ── Mock canonical evidence objects ──────────────────────────────────────────

const EVIDENCE_V1 = {
  subject:   { artistName: 'Ed Sheeran', artistId: 'apple-123' },
  platforms: {
    lastfm: {
      name:    'Ed Sheeran',
      url:     'https://www.last.fm/music/Ed+Sheeran',
      community: {
        listeners:      8312456,
        playcount:      125847293,
        tags:           [{ name: 'pop' }, { name: 'singer-songwriter' }],
        similarArtists: [],
      },
      biography: { summary: '<p>Ed Sheeran is a singer-songwriter.</p>', content: null, published: null, links: null },
      media:     { images: [{ '#text': 'https://example.com/img.jpg', size: 'small' }] },
      topTracks: [{ name: 'Shape of You', playcount: '52341234' }],
      topAlbums: [],
    },
    spotify: {
      artistId:  'spotify-abc',
      name:      'Ed Sheeran',
      followers: 70000000,
    },
  },
};

const EVIDENCE_V2 = {
  subject:   { artistName: 'Ed Sheeran', artistId: 'apple-123' },
  platforms: {
    lastfm: {
      name:    'Ed Sheeran',
      url:     'https://www.last.fm/music/Ed+Sheeran',
      community: {
        listeners:      9100000,    // ← increased
        playcount:      128000000,  // ← increased
        tags:           [{ name: 'pop' }, { name: 'singer-songwriter' }, { name: 'acoustic' }],  // ← tag added
        similarArtists: [{ name: 'James Arthur', url: 'https://last.fm/music/James+Arthur' }],  // ← new
      },
      biography: { summary: '<p>Ed Sheeran is a singer-songwriter.</p>', content: null, published: null, links: null },
      media:     { images: [{ '#text': 'https://example.com/img.jpg', size: 'small' }] },
      topTracks: [{ name: 'Shape of You', playcount: '55000000' }],  // ← playcount changed
      topAlbums: [],
    },
    spotify: {
      artistId:  'spotify-abc',
      name:      'Ed Sheeran',
      followers: 75000000,   // ← increased
    },
    // audiodb is NEW in V2
    audiodb: {
      name:    'Ed Sheeran',
      profile: { genre: 'Pop', country: 'United Kingdom' },
    },
  },
};

const EVIDENCE_V3 = {
  // spotify REMOVED, audiodb RETAINED
  subject:   { artistName: 'Ed Sheeran', artistId: 'apple-123' },
  platforms: {
    lastfm: EVIDENCE_V2.platforms.lastfm,
    audiodb: EVIDENCE_V2.platforms.audiodb,
  },
};

const NOW_1 = '2026-07-01T00:00:00.000Z';
const NOW_2 = '2026-07-02T00:00:00.000Z';
const NOW_3 = '2026-07-03T00:00:00.000Z';

const PROVIDER_META_V1 = [
  { provider: 'lastfm',  trust: 75,  completeness: 'full' },
  { provider: 'spotify', trust: 90,  completeness: 'full' },
];
const PROVIDER_META_V2 = [
  { provider: 'lastfm',  trust: 75,  completeness: 'full' },
  { provider: 'spotify', trust: 90,  completeness: 'full' },
  { provider: 'audiodb', trust: 70,  completeness: 'full' },
];

// ── Group A: EventSeverity ────────────────────────────────────────────────────

function groupA() {
  const assertions = [];

  assertions.push(check('EventSeverity is frozen', Object.isFrozen(EventSeverity)));
  assertions.push(check('EventSeverity has 5 levels', Object.keys(EventSeverity).length === 5,
    `got: ${Object.keys(EventSeverity).length}`));
  assertions.push(check('CRITICAL is defined', EventSeverity.CRITICAL === 'CRITICAL'));
  assertions.push(check('HIGH is defined',     EventSeverity.HIGH     === 'HIGH'));
  assertions.push(check('MEDIUM is defined',   EventSeverity.MEDIUM   === 'MEDIUM'));
  assertions.push(check('LOW is defined',      EventSeverity.LOW      === 'LOW'));
  assertions.push(check('INFORMATIONAL is defined', EventSeverity.INFORMATIONAL === 'INFORMATIONAL'));

  assertions.push(check('isValidSeverity("CRITICAL") is true',  isValidSeverity('CRITICAL')));
  assertions.push(check('isValidSeverity("UNKNOWN") is false',  !isValidSeverity('UNKNOWN')));
  assertions.push(check('isValidSeverity("") is false',         !isValidSeverity('')));

  assertions.push(check('SEVERITY_ORDER is frozen', Object.isFrozen(SEVERITY_ORDER)));
  assertions.push(check('SEVERITY_ORDER has 5 items', SEVERITY_ORDER.length === 5));
  assertions.push(check('INFORMATIONAL is lowest',    SEVERITY_ORDER[0] === 'INFORMATIONAL'));
  assertions.push(check('CRITICAL is highest',        SEVERITY_ORDER[4] === 'CRITICAL'));

  assertions.push(check('isAtLeast(CRITICAL, HIGH) is true',        isAtLeast('CRITICAL', 'HIGH')));
  assertions.push(check('isAtLeast(LOW, CRITICAL) is false',        !isAtLeast('LOW', 'CRITICAL')));
  assertions.push(check('isAtLeast(MEDIUM, MEDIUM) is true',        isAtLeast('MEDIUM', 'MEDIUM')));
  assertions.push(check('isAtLeast(INFORMATIONAL, LOW) is false',   !isAtLeast('INFORMATIONAL', 'LOW')));

  return assertions;
}

// ── Group B: MonitoringPolicy ──────────────────────────────────────────────────

function groupB() {
  const assertions = [];

  assertions.push(check('DEFAULT_MONITORING_POLICY is frozen', Object.isFrozen(DEFAULT_MONITORING_POLICY)));
  assertions.push(check('policy has policyVersion', typeof DEFAULT_MONITORING_POLICY.policyVersion === 'string'));
  assertions.push(check('policy.policyVersion is POLICY_VERSION', DEFAULT_MONITORING_POLICY.policyVersion === POLICY_VERSION));
  assertions.push(check('policy has severityRules array', Array.isArray(DEFAULT_MONITORING_POLICY.severityRules)));
  assertions.push(check('policy.snapshot is frozen', Object.isFrozen(DEFAULT_MONITORING_POLICY.snapshot)));
  assertions.push(check('policy.snapshot.frequencyMs is 24h ms', DEFAULT_MONITORING_POLICY.snapshot.frequencyMs === 86400000));
  assertions.push(check('policy.eventRetention is frozen', Object.isFrozen(DEFAULT_MONITORING_POLICY.eventRetention)));
  assertions.push(check('policy.confidence is frozen', Object.isFrozen(DEFAULT_MONITORING_POLICY.confidence)));

  // Severity resolution is policy-driven
  assertions.push(check('listener path removal → HIGH',
    resolveSeverity('platforms.lastfm.community.listeners', 'removal') === 'HIGH'));
  assertions.push(check('listener path modification → MEDIUM',
    resolveSeverity('platforms.lastfm.community.listeners', 'modification') === 'MEDIUM'));
  assertions.push(check('name path modification → HIGH',
    resolveSeverity('platforms.spotify.name', 'modification') === 'HIGH'));
  assertions.push(check('biography summary modification → LOW',
    resolveSeverity('platforms.lastfm.biography.summary', 'modification') === 'LOW'));
  assertions.push(check('image modification → INFORMATIONAL',
    resolveSeverity('platforms.audiodb.media.thumbnails.thumb', 'modification') === 'INFORMATIONAL'));

  // Confidence is policy-driven
  const highConf = computeConfidence(90, 'full');
  assertions.push(check('trust=90, full → confidence > 0.8', highConf > 0.8,
    `got: ${highConf}`));
  const medConf = computeConfidence(60, 'partial');
  assertions.push(check('trust=60, partial → 0.5 <= confidence <= 0.8',
    medConf >= 0.5 && medConf <= 0.8, `got: ${medConf}`));
  const lowConf = computeConfidence(40, 'empty');
  assertions.push(check('trust=40, empty → confidence <= 0.7', lowConf <= 0.7,
    `got: ${lowConf}`));
  assertions.push(check('confidence always 0–1',
    highConf >= 0 && highConf <= 1 && medConf >= 0 && medConf <= 1));

  return assertions;
}

// ── Group C: EvidenceSnapshot ──────────────────────────────────────────────────

function groupC() {
  const assertions = [];

  const snap = createEvidenceSnapshot({
    artistId:         'apple-123',
    artistName:       'Ed Sheeran',
    canonicalEvidence: EVIDENCE_V1,
    capturedAt:       NOW_1,
    providerMetadata: PROVIDER_META_V1,
  });

  assertions.push(check('snapshot is frozen', Object.isFrozen(snap)));
  assertions.push(check('snapshot.snapshotId is a string', typeof snap.snapshotId === 'string'));
  assertions.push(check('snapshot.snapshotId looks like UUID',
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(snap.snapshotId)));
  assertions.push(check('snapshot.schemaVersion is SNAPSHOT_SCHEMA_VERSION',
    snap.schemaVersion === SNAPSHOT_SCHEMA_VERSION));
  assertions.push(check('snapshot.artistId is set',   snap.artistId === 'apple-123'));
  assertions.push(check('snapshot.artistName is set', snap.artistName === 'Ed Sheeran'));
  assertions.push(check('snapshot.capturedAt is set', snap.capturedAt === NOW_1));
  assertions.push(check('snapshot.evidence is an object', typeof snap.evidence === 'object'));
  assertions.push(check('snapshot.evidence.platforms.lastfm exists',
    snap.evidence?.platforms?.lastfm !== undefined));
  assertions.push(check('snapshot.metadata.platformCount is 2',
    snap.metadata.platformCount === 2, `got: ${snap.metadata.platformCount}`));
  assertions.push(check('snapshot.metadata.platforms includes lastfm',
    snap.metadata.platforms.includes('lastfm')));
  assertions.push(check('snapshot.metadata.platforms includes spotify',
    snap.metadata.platforms.includes('spotify')));

  // Immutability — evidence is a deep copy; modifying the original does not affect snapshot
  const mutatingEvidence = JSON.parse(JSON.stringify(EVIDENCE_V1));
  const snap2 = createEvidenceSnapshot({ canonicalEvidence: mutatingEvidence, capturedAt: NOW_1 });
  mutatingEvidence.platforms.lastfm.community.listeners = 999;
  assertions.push(check('snapshot evidence is isolated from source mutations',
    snap2.evidence?.platforms?.lastfm?.community?.listeners !== 999));

  // evidenceDiffers
  const snapV2 = createEvidenceSnapshot({
    canonicalEvidence: EVIDENCE_V2,
    capturedAt: NOW_2,
    artistId: 'apple-123',
  });
  assertions.push(check('evidenceDiffers(snapV1, snapV2) is true',
    evidenceDiffers(snap, snapV2)));
  assertions.push(check('evidenceDiffers(snap, snap itself) is false',
    !evidenceDiffers(snap, snap)));

  // Invalid inputs throw
  let threw = false;
  try { createEvidenceSnapshot({ canonicalEvidence: null, capturedAt: NOW_1 }); } catch { threw = true; }
  assertions.push(check('null canonicalEvidence throws TypeError', threw));

  threw = false;
  try { createEvidenceSnapshot({ canonicalEvidence: {}, capturedAt: 'not-a-date' }); } catch { threw = true; }
  assertions.push(check('invalid capturedAt throws TypeError', threw));

  return assertions;
}

// ── Group D: SnapshotStore ────────────────────────────────────────────────────

function groupD() {
  const assertions = [];

  const store = new SnapshotStore();
  assertions.push(check('new store has size 0', store.size === 0));

  const snapA = createEvidenceSnapshot({ artistId: 'a1', canonicalEvidence: EVIDENCE_V1, capturedAt: NOW_1 });
  const snapB = createEvidenceSnapshot({ artistId: 'a1', canonicalEvidence: EVIDENCE_V2, capturedAt: NOW_2 });
  const snapC = createEvidenceSnapshot({ artistId: 'a2', canonicalEvidence: EVIDENCE_V1, capturedAt: NOW_1 });

  const r1 = store.append(snapA);
  assertions.push(check('append first snapshot → stored: true', r1.stored === true));
  assertions.push(check('store size is 1 after first append', store.size === 1));

  const r2 = store.append(snapB);
  assertions.push(check('append different evidence → stored: true', r2.stored === true));
  assertions.push(check('store size is 2 after second append', store.size === 2));

  // No-change guard: append same evidence again → not stored
  const snapBDuplicate = createEvidenceSnapshot({ artistId: 'a1', canonicalEvidence: EVIDENCE_V2, capturedAt: NOW_3 });
  const r3 = store.append(snapBDuplicate);
  assertions.push(check('append identical evidence → stored: false (no-change guard)',
    r3.stored === false, `got: ${JSON.stringify(r3)}`));
  assertions.push(check('store size remains 2 after no-change append', store.size === 2));

  // Append for different artist
  const r4 = store.append(snapC);
  assertions.push(check('append for different artist (a2) → stored: true', r4.stored === true));
  assertions.push(check('store size is 3 after a2 append', store.size === 3));

  // getForArtist
  const a1Snaps = store.getForArtist('a1');
  assertions.push(check('getForArtist(a1) returns 2 snapshots', a1Snaps.length === 2,
    `got: ${a1Snaps.length}`));
  assertions.push(check('getForArtist(a2) returns 1 snapshot', store.getForArtist('a2').length === 1));

  // getLatestForArtist
  const latest = store.getLatestForArtist('a1');
  assertions.push(check('getLatestForArtist returns most recent', latest.snapshotId === snapB.snapshotId));

  // getPreviousForArtist
  const previous = store.getPreviousForArtist('a1');
  assertions.push(check('getPreviousForArtist returns snapA', previous.snapshotId === snapA.snapshotId));

  // getById
  const byId = store.getById(snapA.snapshotId);
  assertions.push(check('getById returns correct snapshot', byId.snapshotId === snapA.snapshotId));
  assertions.push(check('getById returns null for unknown id', store.getById('no-such-id') === null));

  // getComparisonPair
  const pair = store.getComparisonPair('a1');
  assertions.push(check('getComparisonPair previous = snapA', pair.previous.snapshotId === snapA.snapshotId));
  assertions.push(check('getComparisonPair current = snapB',  pair.current.snapshotId  === snapB.snapshotId));

  // Duplicate snapshotId guard
  const rDup = store.append(snapA);
  assertions.push(check('duplicate snapshotId → stored: false', rDup.stored === false));

  // countForArtist
  assertions.push(check('countForArtist(a1) = 2', store.countForArtist('a1') === 2));

  // getArtistIds
  const ids = store.getArtistIds();
  assertions.push(check('getArtistIds returns both artists',
    ids.includes('a1') && ids.includes('a2')));

  return assertions;
}

// ── Group E: EvidenceDiffEngine ───────────────────────────────────────────────

function groupE() {
  const assertions = [];

  // Addition detection
  const addDiffs = compareEvidence({ a: 1 }, { a: 1, b: 2 });
  assertions.push(check('addition detected', addDiffs.some(d => d.changeType === 'addition' && d.path === 'b'),
    `diffs: ${JSON.stringify(addDiffs)}`));
  assertions.push(check('addition has correct currentValue',
    addDiffs.find(d => d.path === 'b')?.currentValue === 2));
  assertions.push(check('addition previousValue is undefined',
    addDiffs.find(d => d.path === 'b')?.previousValue === undefined));

  // Removal detection
  const remDiffs = compareEvidence({ a: 1, b: 2 }, { a: 1 });
  assertions.push(check('removal detected', remDiffs.some(d => d.changeType === 'removal' && d.path === 'b')));
  assertions.push(check('removal has correct previousValue',
    remDiffs.find(d => d.path === 'b')?.previousValue === 2));
  assertions.push(check('removal currentValue is undefined',
    remDiffs.find(d => d.path === 'b')?.currentValue === undefined));

  // Modification detection
  const modDiffs = compareEvidence({ a: 1 }, { a: 2 });
  assertions.push(check('modification detected', modDiffs.some(d => d.changeType === 'modification' && d.path === 'a')));
  assertions.push(check('modification previousValue = 1', modDiffs.find(d => d.path === 'a')?.previousValue === 1));
  assertions.push(check('modification currentValue = 2',  modDiffs.find(d => d.path === 'a')?.currentValue === 2));

  // No change
  const noDiffs = compareEvidence({ a: 1 }, { a: 1 });
  assertions.push(check('no change → empty diffs array', noDiffs.length === 0, `got ${noDiffs.length}`));

  // Deep path
  const deepDiffs = compareEvidence(
    { platforms: { lastfm: { community: { listeners: 100 } } } },
    { platforms: { lastfm: { community: { listeners: 200 } } } },
  );
  assertions.push(check('deep path modification detected',
    deepDiffs.some(d => d.path === 'platforms.lastfm.community.listeners' && d.changeType === 'modification')));

  // New provider (whole object addition at platforms level)
  const newProviderDiffs = compareEvidence(
    { platforms: { lastfm: { name: 'X' } } },
    { platforms: { lastfm: { name: 'X' }, audiodb: { name: 'X' } } },
  );
  assertions.push(check('new provider addition detected at platforms.audiodb',
    newProviderDiffs.some(d => d.path === 'platforms.audiodb' && d.changeType === 'addition')));

  // Provider removal
  const removeProviderDiffs = compareEvidence(
    { platforms: { spotify: { followers: 70e6 }, lastfm: { name: 'X' } } },
    { platforms: { lastfm: { name: 'X' } } },
  );
  assertions.push(check('provider removal detected at platforms.spotify',
    removeProviderDiffs.some(d => d.path === 'platforms.spotify' && d.changeType === 'removal')));

  // Arrays treated as atomic
  const arrayDiffs = compareEvidence(
    { tags: ['pop', 'rock'] },
    { tags: ['pop', 'rock', 'folk'] },
  );
  assertions.push(check('array modification detected as single modification at path "tags"',
    arrayDiffs.some(d => d.path === 'tags' && d.changeType === 'modification')));
  assertions.push(check('array diff produces exactly 1 diff for tags change',
    arrayDiffs.filter(d => d.path === 'tags').length === 1));

  // Full snapshot comparison
  const snapV1 = createEvidenceSnapshot({ artistId: 'a1', canonicalEvidence: EVIDENCE_V1, capturedAt: NOW_1, providerMetadata: PROVIDER_META_V1 });
  const snapV2 = createEvidenceSnapshot({ artistId: 'a1', canonicalEvidence: EVIDENCE_V2, capturedAt: NOW_2, providerMetadata: PROVIDER_META_V2 });
  const fullDiffs = compareSnapshots(snapV1, snapV2);
  assertions.push(check('compareSnapshots returns diffs array', Array.isArray(fullDiffs)));
  assertions.push(check('compareSnapshots detects changes between V1 and V2', fullDiffs.length > 0,
    `got: ${fullDiffs.length}`));
  assertions.push(check('audiodb addition detected',
    fullDiffs.some(d => d.path === 'platforms.audiodb' && d.changeType === 'addition')));

  // filterByPath
  const lastfmDiffs = filterByPath(fullDiffs, 'platforms.lastfm');
  assertions.push(check('filterByPath("platforms.lastfm") returns lastfm diffs only',
    lastfmDiffs.every(d => d.path.startsWith('platforms.lastfm'))));
  assertions.push(check('filterByPath returns non-empty array for changed platform',
    lastfmDiffs.length > 0));

  // filterByChangeType
  const additions = filterByChangeType(fullDiffs, 'addition');
  assertions.push(check('filterByChangeType("addition") returns only additions',
    additions.every(d => d.changeType === 'addition')));

  // extractProvider
  assertions.push(check('extractProvider("platforms.lastfm.community.listeners") → "lastfm"',
    extractProvider('platforms.lastfm.community.listeners') === 'lastfm'));
  assertions.push(check('extractProvider("subject.artistName") → null',
    extractProvider('subject.artistName') === null));

  // Determinism
  const diffsA = compareSnapshots(snapV1, snapV2);
  const diffsB = compareSnapshots(snapV1, snapV2);
  assertions.push(check('compareSnapshots is deterministic (same output twice)',
    JSON.stringify(diffsA) === JSON.stringify(diffsB)));

  // Never throws
  let threw = false;
  try { compareSnapshots(null, null); } catch { threw = true; }
  assertions.push(check('compareSnapshots(null, null) does not throw', !threw));
  try { compareEvidence(undefined, undefined); } catch { threw = true; }
  assertions.push(check('compareEvidence(undefined, undefined) does not throw', !threw));

  return assertions;
}

// ── Group F: EvidenceEvent ────────────────────────────────────────────────────

function groupF() {
  const assertions = [];

  const SNAP_ID_A = 'snap-id-prev-123';
  const SNAP_ID_B = 'snap-id-curr-456';

  const event = createEvidenceEvent({
    detectedAt:     NOW_2,
    provider:       'lastfm',
    evidenceDomain: 'platforms.lastfm.community.listeners',
    changeType:     'modification',
    previousValue:  8312456,
    currentValue:   9100000,
    evidenceSource: { providerName: 'lastfm', acquisitionTimestamp: NOW_2 },
    confidence:     0.85,
    snapshotRefs:   { previous: SNAP_ID_A, current: SNAP_ID_B },
    severity:       'MEDIUM',
    explanation: {
      whatChanged:   'Listener count changed from 8,312,456 to 9,100,000',
      whyDetected:   'Detected by EvidenceDiffEngine comparing 2026-07-01 to 2026-07-02',
      whyItMatters:  'Community audience metric changed significantly',
    },
  });

  assertions.push(check('event is frozen', Object.isFrozen(event)));
  assertions.push(check('event.eventId is a UUID string',
    /^[0-9a-f]{8}-[0-9a-f]{4}-/.test(event.eventId)));
  assertions.push(check('event.schemaVersion is EVENT_SCHEMA_VERSION',
    event.schemaVersion === EVENT_SCHEMA_VERSION));
  assertions.push(check('event.detectedAt is set',     event.detectedAt === NOW_2));
  assertions.push(check('event.provider is "lastfm"',  event.provider === 'lastfm'));
  assertions.push(check('event.evidenceDomain is set', event.evidenceDomain.includes('listeners')));
  assertions.push(check('event.changeType is modification', event.changeType === 'modification'));
  assertions.push(check('event.previousValue is 8312456', event.previousValue === 8312456));
  assertions.push(check('event.currentValue is 9100000',  event.currentValue === 9100000));
  assertions.push(check('event.confidence is 0.85', event.confidence === 0.85));
  assertions.push(check('event.snapshotRefs.previous is set', event.snapshotRefs.previous === SNAP_ID_A));
  assertions.push(check('event.snapshotRefs.current is set',  event.snapshotRefs.current  === SNAP_ID_B));
  assertions.push(check('event.severity is "MEDIUM"',          event.severity === 'MEDIUM'));
  assertions.push(check('event.explanation.whatChanged is a string',
    typeof event.explanation.whatChanged === 'string' && event.explanation.whatChanged.length > 0));
  assertions.push(check('event.explanation.whyDetected is a string',
    typeof event.explanation.whyDetected === 'string'));
  assertions.push(check('event.explanation.whyItMatters is a string',
    typeof event.explanation.whyItMatters === 'string'));
  assertions.push(check('event.evidenceSource.providerName is "lastfm"',
    event.evidenceSource.providerName === 'lastfm'));

  // Two events have different eventIds (UUID uniqueness)
  const event2 = createEvidenceEvent({
    detectedAt: NOW_2, provider: 'lastfm', evidenceDomain: 'platforms.lastfm.community.playcount',
    changeType: 'modification', previousValue: 125847293, currentValue: 128000000,
    evidenceSource: { providerName: 'lastfm', acquisitionTimestamp: NOW_2 },
    confidence: 0.85, snapshotRefs: { previous: SNAP_ID_A, current: SNAP_ID_B },
    severity: 'MEDIUM',
    explanation: { whatChanged: 'x', whyDetected: 'y', whyItMatters: 'z' },
  });
  assertions.push(check('two events have different eventIds', event.eventId !== event2.eventId));

  // Validation — invalid severity throws
  let threw = false;
  try {
    createEvidenceEvent({
      detectedAt: NOW_2, provider: 'lastfm', evidenceDomain: 'x',
      changeType: 'modification', previousValue: 1, currentValue: 2,
      evidenceSource: { providerName: 'lastfm' },
      confidence: 0.8, snapshotRefs: { current: 'x' },
      severity: 'INVALID_SEVERITY',
      explanation: { whatChanged: 'x', whyDetected: 'y', whyItMatters: 'z' },
    });
  } catch { threw = true; }
  assertions.push(check('invalid severity throws', threw));

  // Missing explanation throws
  threw = false;
  try {
    createEvidenceEvent({
      detectedAt: NOW_2, provider: 'x', evidenceDomain: 'x',
      changeType: 'addition', previousValue: undefined, currentValue: 1,
      evidenceSource: { providerName: 'x' },
      confidence: 0.5, snapshotRefs: { current: 'x' },
      severity: 'LOW', explanation: null,
    });
  } catch { threw = true; }
  assertions.push(check('null explanation throws', threw));

  return assertions;
}

// ── Group G: MonitoringIntelligence ───────────────────────────────────────────

function groupG() {
  const assertions = [];

  const snapV1 = createEvidenceSnapshot({
    artistId: 'apple-123', artistName: 'Ed Sheeran',
    canonicalEvidence: EVIDENCE_V1, capturedAt: NOW_1, providerMetadata: PROVIDER_META_V1,
  });
  const snapV2 = createEvidenceSnapshot({
    artistId: 'apple-123', artistName: 'Ed Sheeran',
    canonicalEvidence: EVIDENCE_V2, capturedAt: NOW_2, providerMetadata: PROVIDER_META_V2,
  });

  const report = runMonitoringIntelligence(snapV1, snapV2);

  assertions.push(check('report is frozen', Object.isFrozen(report)));
  assertions.push(check('report.schemaVersion is MONITORING_INTELLIGENCE_VERSION',
    report.schemaVersion === MONITORING_INTELLIGENCE_VERSION));
  assertions.push(check('report.reportId is a UUID',
    /^[0-9a-f]{8}-[0-9a-f]{4}-/.test(report.reportId)));
  assertions.push(check('report.generatedAt is ISO 8601',
    /^\d{4}-\d{2}-\d{2}T/.test(report.generatedAt)));
  assertions.push(check('report.artistId is set',   report.artistId === 'apple-123'));
  assertions.push(check('report.artistName is set', report.artistName === 'Ed Sheeran'));
  assertions.push(check('report.policyVersion is set', typeof report.policyVersion === 'string'));
  assertions.push(check('report.snapshotRefs.previous matches snapV1',
    report.snapshotRefs.previous === snapV1.snapshotId));
  assertions.push(check('report.snapshotRefs.current matches snapV2',
    report.snapshotRefs.current === snapV2.snapshotId));
  assertions.push(check('report.eventCount > 0 (changes detected)',
    report.eventCount > 0, `got: ${report.eventCount}`));
  assertions.push(check('report.events is frozen array', Object.isFrozen(report.events)));
  assertions.push(check('report.events.length === report.eventCount',
    report.events.length === report.eventCount));

  // Explainability — every event has full explanation
  const allExplained = report.events.every(e =>
    e.explanation?.whatChanged && e.explanation?.whyDetected && e.explanation?.whyItMatters);
  assertions.push(check('every event has all 3 explainability fields', allExplained));

  // Every event has a valid severity
  const allValidSeverity = report.events.every(e => isValidSeverity(e.severity));
  assertions.push(check('every event has a valid severity level', allValidSeverity));

  // Every event has a UUID eventId
  const allHaveUUIDs = report.events.every(e => /^[0-9a-f]{8}-[0-9a-f]{4}-/.test(e.eventId));
  assertions.push(check('every event has a UUID eventId', allHaveUUIDs));

  // Every event links back to the correct snapshot pair
  const allLinked = report.events.every(e =>
    e.snapshotRefs.previous === snapV1.snapshotId &&
    e.snapshotRefs.current  === snapV2.snapshotId);
  assertions.push(check('every event links to correct snapshot pair', allLinked));

  // audiodb addition appears as an event
  const audiodbEvent = report.events.find(e => e.evidenceDomain === 'platforms.audiodb');
  assertions.push(check('audiodb addition event present in report',
    audiodbEvent !== undefined));
  assertions.push(check('audiodb event is addition', audiodbEvent?.changeType === 'addition'));

  // Summary section
  assertions.push(check('report.summary exists', typeof report.summary === 'object'));
  assertions.push(check('report.summary.bySeverity exists', typeof report.summary.bySeverity === 'object'));
  assertions.push(check('report.summary.byProvider exists',  typeof report.summary.byProvider === 'object'));
  assertions.push(check('report.summary.byChangeType exists', typeof report.summary.byChangeType === 'object'));
  assertions.push(check('summary byProvider.lastfm > 0',
    (report.summary.byProvider.lastfm ?? 0) > 0));
  assertions.push(check('summary totals equal eventCount',
    Object.values(report.summary.byChangeType).reduce((s, n) => s + n, 0) === report.eventCount));

  // Empty report when both snapshots null
  const emptyReport = runMonitoringIntelligence(null, null);
  assertions.push(check('null snapshots → empty report (eventCount 0)',
    emptyReport.eventCount === 0));
  assertions.push(check('null snapshots → report.events is empty array',
    emptyReport.events.length === 0));

  return assertions;
}

// ── Group H: Historical replay capability ─────────────────────────────────────

function groupH() {
  const assertions = [];

  // Build a history of 3 snapshots for the same artist
  const store = new SnapshotStore();
  const s1 = createEvidenceSnapshot({ artistId: 'a1', artistName: 'Ed', canonicalEvidence: EVIDENCE_V1, capturedAt: NOW_1 });
  const s2 = createEvidenceSnapshot({ artistId: 'a1', artistName: 'Ed', canonicalEvidence: EVIDENCE_V2, capturedAt: NOW_2 });
  const s3 = createEvidenceSnapshot({ artistId: 'a1', artistName: 'Ed', canonicalEvidence: EVIDENCE_V3, capturedAt: NOW_3 });

  store.append(s1);
  store.append(s2);
  store.append(s3);

  // Chronological retrieval
  const all = store.getForArtist('a1');
  assertions.push(check('historical store has 3 snapshots', all.length === 3, `got: ${all.length}`));
  assertions.push(check('oldest snapshot is s1 (capturedAt order)',
    all[0].snapshotId === s1.snapshotId));
  assertions.push(check('newest snapshot is s3',
    all[all.length - 1].snapshotId === s3.snapshotId));

  // Any historical snapshot is retrievable by ID
  assertions.push(check('s1 retrievable by ID', store.getById(s1.snapshotId)?.snapshotId === s1.snapshotId));
  assertions.push(check('s2 retrievable by ID', store.getById(s2.snapshotId)?.snapshotId === s2.snapshotId));

  // Run intelligence between s1 and s2 then s2 and s3 — different reports
  const report12 = runMonitoringIntelligence(s1, s2);
  const report23 = runMonitoringIntelligence(s2, s3);

  assertions.push(check('report s1→s2 has reportId',  typeof report12.reportId === 'string'));
  assertions.push(check('report s2→s3 has reportId',  typeof report23.reportId === 'string'));
  assertions.push(check('report s1→s2 and s2→s3 have different reportIds',
    report12.reportId !== report23.reportId));

  // s2→s3: spotify removal should appear
  const spotifyRemoval = report23.events.find(e =>
    e.evidenceDomain === 'platforms.spotify' && e.changeType === 'removal');
  assertions.push(check('s2→s3 report detects spotify removal',
    spotifyRemoval !== undefined, `events: ${report23.events.map(e => e.evidenceDomain + '/' + e.changeType).join(', ')}`));
  assertions.push(check('spotify removal severity is HIGH',
    spotifyRemoval?.severity === 'HIGH', `got: ${spotifyRemoval?.severity}`));

  // Replay: running the same two snapshots again produces the same events (determinism)
  const replayReport = runMonitoringIntelligence(s1, s2);
  assertions.push(check('replaying s1→s2 produces same eventCount',
    replayReport.eventCount === report12.eventCount));

  return assertions;
}

// ── Group I: Edge cases / never-throw ─────────────────────────────────────────

async function groupI() {
  const assertions = [];

  // compareEvidence with null both sides → empty diffs
  const nullDiffs = compareEvidence(null, null);
  assertions.push(check('compareEvidence(null, null) returns empty array', nullDiffs.length === 0));

  // compareEvidence with objects containing null values
  const nullValDiffs = compareEvidence({ a: null }, { a: 'present' });
  assertions.push(check('null → non-null detected as modification',
    nullValDiffs.some(d => d.changeType === 'modification' && d.path === 'a')));

  // compareEvidence deeply nested — stays within MAX_DIFF_DEPTH
  let deepObj = { val: 'leaf' };
  for (let i = 0; i < 12; i++) deepObj = { child: deepObj };
  let threw = false;
  let deepDiffs;
  try { deepDiffs = compareEvidence(deepObj, { ...deepObj, extra: 1 }); } catch { threw = true; }
  assertions.push(check('deeply nested evidence does not throw', !threw));
  assertions.push(check('deeply nested evidence returns array', Array.isArray(deepDiffs)));

  // runMonitoringIntelligence with identical snapshots → 0 events (no change)
  const snapSame1 = createEvidenceSnapshot({ canonicalEvidence: EVIDENCE_V1, capturedAt: NOW_1 });
  const snapSame2 = createEvidenceSnapshot({ canonicalEvidence: EVIDENCE_V1, capturedAt: NOW_2 });
  const sameReport = runMonitoringIntelligence(snapSame1, snapSame2);
  assertions.push(check('identical evidence → 0 events in report', sameReport.eventCount === 0,
    `got: ${sameReport.eventCount}`));

  // SnapshotStore never throws on bad input
  const store = new SnapshotStore();
  threw = false;
  try { store.append(null); } catch { threw = true; }
  assertions.push(check('store.append(null) throws TypeError (defensive contract)', threw));

  // getById on empty store returns null
  assertions.push(check('empty store getById returns null', store.getById('any') === null));
  assertions.push(check('empty store getLatestForArtist returns null', store.getLatestForArtist('a1') === null));
  assertions.push(check('empty store getPreviousForArtist returns null', store.getPreviousForArtist('a1') === null));

  // MonitoringPolicy can be overridden at call site
  const customPolicy = {
    ...DEFAULT_MONITORING_POLICY,
    policyVersion: 'custom-1.0',
    severityRules: [{ pattern: /.*/, onAddition: 'CRITICAL', onRemoval: 'CRITICAL', onModification: 'CRITICAL' }],
  };
  const severity = resolveSeverity('platforms.lastfm.community.listeners', 'modification', customPolicy);
  assertions.push(check('custom policy overrides severity (all CRITICAL)',
    severity === 'CRITICAL', `got: ${severity}`));

  return assertions;
}

// ── Runner ────────────────────────────────────────────────────────────────────

export async function runMonitoring() {
  const suiteName = '14-monitoring';
  const groups = [
    { name: 'A – EventSeverity',               fn: groupA },
    { name: 'B – MonitoringPolicy',            fn: groupB },
    { name: 'C – EvidenceSnapshot',            fn: groupC },
    { name: 'D – SnapshotStore',               fn: groupD },
    { name: 'E – EvidenceDiffEngine',          fn: groupE },
    { name: 'F – EvidenceEvent',               fn: groupF },
    { name: 'G – MonitoringIntelligence',      fn: groupG },
    { name: 'H – Historical replay',           fn: groupH },
    { name: 'I – Edge cases / never-throw',    fn: groupI },
  ];

  let passed = 0;
  let failed = 0;
  const details = [];

  for (const group of groups) {
    let results;
    try {
      results = await group.fn();
    } catch (err) {
      results = [{ label: `${group.name} (group threw)`, pass: false, note: err.message }];
    }
    for (const r of results) {
      if (r.pass) passed++; else failed++;
      details.push({ group: group.name, ...r });
    }
  }

  return { name: suiteName, passed, failed, assertions: passed + failed, details };
}
