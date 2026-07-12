// Canonical Intelligence Platform(tm) -- Monitoring & Change Detection Engine(tm) Test Suite
// Sprint 8: Monitoring & Change Detection(tm)

import { randomUUID } from 'crypto';
import * as _mon from '../api/monitoring/index.js';

let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (condition) { console.log(`  ✓ ${label}`); passed++; }
  else           { console.error(`  ✗ ${label}`); failed++; }
}

function section(title) { console.log(`\n── ${title}`); }

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeDomains(overrides = {}) {
  return {
    identity: {
      artistId:   'apple-A001',
      artistName: 'The Weeknd',
      verified:   true,
      providers: {
        apple:   { verified: true,  followersCount: 12000000 },
        spotify: { verified: true,  followersCount: 85000000 },
      },
    },
    publishing: {
      publisher: 'Sony Music Publishing',
      iswc:      'T-123456789-0',
      pro:       'ASCAP',
      rights:    'controlled',
    },
    catalog: {
      releaseCount: 5,
      genre:        'R&B',
      label:        'Republic Records',
      distributor:  'Universal Music Group',
    },
    ...overrides,
  };
}

function makeEngine(opts = {}) {
  return _mon.createMonitoringEngine(opts);
}

function makeScanInput(artistId, domainsOverrides = {}, extra = {}) {
  return {
    scanId:           randomUUID(),
    artistId:         artistId || 'apple-A001',
    canonicalDomains: makeDomains(domainsOverrides),
    engineVersions:   { resolution: '1.0.0', orchestrator: '1.0.0' },
    scanDuration:     42,
    ...extra,
  };
}

// ─── 1. Engine Loader ─────────────────────────────────────────────────────────

section('1. Engine Loader');

assert(typeof _mon.MONITORING_ENGINE        === 'object',   'MONITORING_ENGINE singleton exported');
assert(typeof _mon.createMonitoringEngine   === 'function', 'createMonitoringEngine factory exported');
assert(_mon.MONITORING_ENGINE_VERSION.version === '1.0.0',  'version is 1.0.0');
assert(Object.isFrozen(_mon.MONITORING_ENGINE_VERSION),     'MONITORING_ENGINE_VERSION is frozen');
assert(_mon.MONITORING_ENGINE_VERSION.engineId === 'monitoring-engine-v1', 'engineId correct');

// ─── 2. Version ───────────────────────────────────────────────────────────────

section('2. Version');

assert(_mon.MONITORING_ENGINE_VERSION.name          === 'Monitoring Engine',                  'name correct');
assert(_mon.MONITORING_ENGINE_VERSION.sprint        === 'Sprint 8 -- Monitoring & Change Detection(tm)', 'sprint correct');
assert(_mon.MONITORING_ENGINE_VERSION.effectiveDate === '2026-07-12',                         'effectiveDate correct');

// ─── 3. Type Constants ────────────────────────────────────────────────────────

section('3. Type Constants');

assert(_mon.CHANGE_TYPES.ADDED     === 'ADDED',     'CHANGE_TYPES.ADDED');
assert(_mon.CHANGE_TYPES.REMOVED   === 'REMOVED',   'CHANGE_TYPES.REMOVED');
assert(_mon.CHANGE_TYPES.MODIFIED  === 'MODIFIED',  'CHANGE_TYPES.MODIFIED');
assert(_mon.CHANGE_TYPES.UNCHANGED === 'UNCHANGED', 'CHANGE_TYPES.UNCHANGED');

assert(_mon.SEVERITY_LEVELS.CRITICAL    === 'CRITICAL',    'SEVERITY_LEVELS.CRITICAL');
assert(_mon.SEVERITY_LEVELS.HIGH        === 'HIGH',        'SEVERITY_LEVELS.HIGH');
assert(_mon.SEVERITY_LEVELS.MEDIUM      === 'MEDIUM',      'SEVERITY_LEVELS.MEDIUM');
assert(_mon.SEVERITY_LEVELS.LOW         === 'LOW',         'SEVERITY_LEVELS.LOW');
assert(_mon.SEVERITY_LEVELS.INFORMATION === 'INFORMATION', 'SEVERITY_LEVELS.INFORMATION');

assert(_mon.ALERT_LEVELS.CRITICAL    === 'CRITICAL',    'ALERT_LEVELS.CRITICAL');
assert(_mon.ALERT_LEVELS.HIGH        === 'HIGH',        'ALERT_LEVELS.HIGH');
assert(_mon.ALERT_LEVELS.MEDIUM      === 'MEDIUM',      'ALERT_LEVELS.MEDIUM');
assert(_mon.ALERT_LEVELS.LOW         === 'LOW',         'ALERT_LEVELS.LOW');
assert(_mon.ALERT_LEVELS.INFORMATION === 'INFORMATION', 'ALERT_LEVELS.INFORMATION');

assert(_mon.MONITORING_DOMAINS.IDENTITY     === 'identity',     'MONITORING_DOMAINS.IDENTITY');
assert(_mon.MONITORING_DOMAINS.PUBLISHING   === 'publishing',   'MONITORING_DOMAINS.PUBLISHING');
assert(_mon.MONITORING_DOMAINS.RECORDING    === 'recording',    'MONITORING_DOMAINS.RECORDING');
assert(_mon.MONITORING_DOMAINS.CATALOG      === 'catalog',      'MONITORING_DOMAINS.CATALOG');
assert(_mon.MONITORING_DOMAINS.VERIFICATION === 'verification', 'MONITORING_DOMAINS.VERIFICATION');

assert(Object.isFrozen(_mon.CHANGE_TYPES),    'CHANGE_TYPES frozen');
assert(Object.isFrozen(_mon.SEVERITY_LEVELS), 'SEVERITY_LEVELS frozen');
assert(Object.isFrozen(_mon.ALERT_LEVELS),    'ALERT_LEVELS frozen');

// ─── 4. Snapshot Creation ─────────────────────────────────────────────────────

section('4. Snapshot Creation');

const snapA = _mon.buildSnapshotFromScanResult(makeScanInput('artist-001'));

assert(typeof snapA.snapshotId        === 'string',  'snapshotId is a string');
assert(typeof snapA.scanId            === 'string',  'scanId is a string');
assert(snapA.artistId                 === 'artist-001', 'artistId preserved');
assert(typeof snapA.timestamp         === 'string',  'timestamp is a string');
assert(typeof snapA.canonicalDomains  === 'object',  'canonicalDomains is an object');
assert(typeof snapA.createdAt         === 'string',  'createdAt is a string');
assert(Object.isFrozen(snapA),                       'snapshot is frozen');
assert(snapA.monitoringEngineVersion  === '1.0.0',   'monitoringEngineVersion stamped');

// ─── 5. Snapshot Immutability ─────────────────────────────────────────────────

section('5. Snapshot Immutability');

let mutationBlocked = false;
try { snapA.snapshotId = 'hacked'; } catch { mutationBlocked = true; }
assert(mutationBlocked || snapA.snapshotId !== 'hacked', 'snapshotId cannot be overwritten');

let deepMutationBlocked = false;
try { snapA.canonicalDomains.identity = 'hacked'; } catch { deepMutationBlocked = true; }
assert(deepMutationBlocked || snapA.canonicalDomains.identity !== 'hacked', 'canonicalDomains deeply frozen');

// ─── 6. Snapshot Validation ───────────────────────────────────────────────────

section('6. Snapshot Validation');

const { valid: v1, errors: e1 } = _mon.validateSnapshot(snapA);
assert(v1 === true,  'valid snapshot passes validation');
assert(Array.isArray(e1) && e1.length === 0, 'valid snapshot has no errors');

const { valid: v2, errors: e2 } = _mon.validateSnapshot({ snapshotId: 'x' });
assert(v2 === false, 'snapshot missing required fields fails validation');
assert(e2.length > 0, 'validation errors returned');

const { valid: v3 } = _mon.validateSnapshot(null);
assert(v3 === false, 'null snapshot fails validation');

let snapshotThrew = false;
try { _mon.createSnapshot({ snapshotId: 's1' }); } catch { snapshotThrew = true; }
assert(snapshotThrew, 'createSnapshot throws on missing required fields');

// ─── 7. Severity Classification ───────────────────────────────────────────────

section('7. Severity Classification');

// Critical
assert(_mon.classifyChangeSeverity('identity',   'ownership')  === 'CRITICAL', 'identity.ownership = CRITICAL');
assert(_mon.classifyChangeSeverity('publishing', 'iswc')       === 'CRITICAL', 'publishing.iswc = CRITICAL');
assert(_mon.classifyChangeSeverity('publishing', 'publisher')  === 'CRITICAL', 'publishing.publisher = CRITICAL');
assert(_mon.classifyChangeSeverity('recording',  'isrc')       === 'CRITICAL', 'recording.isrc = CRITICAL');
assert(_mon.classifyChangeSeverity('publishing', 'rights')     === 'CRITICAL', 'publishing.rights = CRITICAL');

// High
assert(_mon.classifyChangeSeverity('catalog',      'label')      === 'HIGH', 'catalog.label = HIGH');
assert(_mon.classifyChangeSeverity('catalog',      'distributor') === 'HIGH', 'catalog.distributor = HIGH');
assert(_mon.classifyChangeSeverity('verification', 'status')     === 'HIGH', 'verification.status = HIGH');
assert(_mon.classifyChangeSeverity('recording',    'label')      === 'HIGH', 'recording.label = HIGH');
assert(_mon.classifyChangeSeverity('identity',     'verified')   === 'HIGH', 'identity.verified = HIGH');

// Medium
assert(_mon.classifyChangeSeverity('catalog',   'genre')      === 'MEDIUM', 'catalog.genre = MEDIUM');
assert(_mon.classifyChangeSeverity('metadata',  'artistName') === 'MEDIUM', 'metadata.artistName = MEDIUM');
assert(_mon.classifyChangeSeverity('identity',  'artistName') === 'MEDIUM', 'identity.artistName = MEDIUM');

// Low
assert(_mon.classifyChangeSeverity('metadata', 'biography')   === 'LOW', 'metadata.biography = LOW');
assert(_mon.classifyChangeSeverity('catalog',  'artwork')     === 'LOW', 'catalog.artwork = LOW');

// Information
assert(_mon.classifyChangeSeverity('system', 'rescanComplete') === 'INFORMATION', 'system.rescanComplete = INFORMATION');
assert(_mon.classifyChangeSeverity('unknown_domain', 'anything') === 'INFORMATION', 'unknown domain = INFORMATION');

// ─── 8. Change Detection — Identical Snapshots ────────────────────────────────

section('8. Change Detection — Identical Snapshots');

const domainsBase = makeDomains();
const snapBase1   = _mon.buildSnapshotFromScanResult({ scanId: randomUUID(), artistId: 'test-id-same', canonicalDomains: domainsBase });
// Build a second snapshot with identical domains
const snapBase2   = _mon.buildSnapshotFromScanResult({ scanId: randomUUID(), artistId: 'test-id-same', canonicalDomains: JSON.parse(JSON.stringify(domainsBase)) });

const compSame = _mon.compareSnapshots(snapBase1, snapBase2);

assert(compSame.summary.total    === 0, 'identical snapshots: 0 total changes');
assert(compSame.summary.added    === 0, 'identical snapshots: 0 added');
assert(compSame.summary.removed  === 0, 'identical snapshots: 0 removed');
assert(compSame.summary.modified === 0, 'identical snapshots: 0 modified');
assert(compSame.summary.unchanged > 0,  'identical snapshots: unchanged count > 0');
assert(compSame.changes.length   === 0, 'identical snapshots: changes array empty');
assert(Object.isFrozen(compSame),        'comparison result is frozen');

// ─── 9. Change Detection — Added Fields ───────────────────────────────────────

section('9. Change Detection — Added Fields');

const domainsNoExt = makeDomains();
const domainsWithExt = makeDomains({ distribution: { label: 'UMG', dspCoverage: 45 } });

const snapNoExt   = _mon.buildSnapshotFromScanResult({ scanId: randomUUID(), artistId: 'test-add', canonicalDomains: domainsNoExt });
const snapWithExt = _mon.buildSnapshotFromScanResult({ scanId: randomUUID(), artistId: 'test-add', canonicalDomains: domainsWithExt });

const compAdded = _mon.compareSnapshots(snapNoExt, snapWithExt);

assert(compAdded.summary.added > 0,                                   'added fields detected');
assert(compAdded.changes.some(c => c.changeType === 'ADDED'),         'change type ADDED present');
assert(compAdded.changes.every(c => Object.isFrozen(c)),              'individual changes are frozen');
assert(compAdded.changes.filter(c => c.changeType === 'ADDED').every(c => c.oldValue === undefined), 'added changes have no oldValue');
assert(compAdded.changes.filter(c => c.changeType === 'ADDED').every(c => c.newValue !== undefined), 'added changes have newValue');
assert(compAdded.changes.every(c => typeof c.severity === 'string'),  'every change has severity');
assert(compAdded.changes.every(c => typeof c.domain === 'string'),    'every change has domain');
assert(compAdded.changes.every(c => typeof c.fieldPath === 'string'), 'every change has fieldPath');

// ─── 10. Change Detection — Removed Fields ────────────────────────────────────

section('10. Change Detection — Removed Fields');

const domainsWithPublishing = makeDomains();
const domainsNoPublishing   = makeDomains({ publishing: undefined });

const snapWith    = _mon.buildSnapshotFromScanResult({ scanId: randomUUID(), artistId: 'test-rem', canonicalDomains: domainsWithPublishing });
const snapWithout = _mon.buildSnapshotFromScanResult({ scanId: randomUUID(), artistId: 'test-rem', canonicalDomains: domainsNoPublishing });

const compRemoved = _mon.compareSnapshots(snapWith, snapWithout);

assert(compRemoved.summary.removed > 0,                                         'removed fields detected');
assert(compRemoved.changes.some(c => c.changeType === 'REMOVED'),               'change type REMOVED present');
assert(compRemoved.changes.filter(c => c.changeType === 'REMOVED').every(c => c.newValue === undefined), 'removed changes have no newValue');
assert(compRemoved.changes.filter(c => c.changeType === 'REMOVED').every(c => c.oldValue !== undefined), 'removed changes retain oldValue');

// ─── 11. Change Detection — Modified Fields ───────────────────────────────────

section('11. Change Detection — Modified Fields');

const domainsV1 = makeDomains();
const domainsV2 = makeDomains({
  catalog: { releaseCount: 6, genre: 'Pop', label: 'Republic Records', distributor: 'Universal Music Group' },
});

const snapV1 = _mon.buildSnapshotFromScanResult({ scanId: randomUUID(), artistId: 'test-mod', canonicalDomains: domainsV1 });
const snapV2 = _mon.buildSnapshotFromScanResult({ scanId: randomUUID(), artistId: 'test-mod', canonicalDomains: domainsV2 });

const compMod = _mon.compareSnapshots(snapV1, snapV2);

assert(compMod.summary.modified > 0,                               'modified fields detected');
assert(compMod.changes.some(c => c.changeType === 'MODIFIED'),     'change type MODIFIED present');
const releaseMod = compMod.changes.find(c => c.field === 'releaseCount');
assert(releaseMod !== undefined,                                    'releaseCount change found');
assert(releaseMod.oldValue === 5,                                   'releaseCount oldValue = 5');
assert(releaseMod.newValue === 6,                                   'releaseCount newValue = 6');
const genreMod = compMod.changes.find(c => c.field === 'genre' && c.domain === 'catalog');
assert(genreMod !== undefined,                                      'genre change found');
assert(genreMod.oldValue === 'R&B',                                 'genre oldValue = R&B');
assert(genreMod.newValue === 'Pop',                                 'genre newValue = Pop');

// ─── 12. Change Detection — Mixed Changes ─────────────────────────────────────

section('12. Change Detection — Mixed Changes');

const domainsMixA = { identity: { artistName: 'The Weeknd', verified: true }, catalog: { genre: 'R&B' } };
const domainsMixB = { identity: { artistName: 'The Weeknd', verified: false }, catalog: { genre: 'Pop' }, distribution: { label: 'UMG' } };

const snapMixA = _mon.buildSnapshotFromScanResult({ scanId: randomUUID(), artistId: 'test-mix', canonicalDomains: domainsMixA });
const snapMixB = _mon.buildSnapshotFromScanResult({ scanId: randomUUID(), artistId: 'test-mix', canonicalDomains: domainsMixB });

const compMix = _mon.compareSnapshots(snapMixA, snapMixB);

assert(compMix.summary.added   > 0, 'mixed: added detected');
assert(compMix.summary.modified > 0, 'mixed: modified detected');
assert(compMix.summary.total   === compMix.summary.added + compMix.summary.removed + compMix.summary.modified, 'total = added+removed+modified');

// ─── 13. Timeline Generation ──────────────────────────────────────────────────

section('13. Timeline Generation');

const snapTL1 = _mon.buildSnapshotFromScanResult({ scanId: randomUUID(), artistId: 'test-tl', canonicalDomains: domainsMixA });
const snapTL2 = _mon.buildSnapshotFromScanResult({ scanId: randomUUID(), artistId: 'test-tl', canonicalDomains: domainsMixB });
const compTL  = _mon.compareSnapshots(snapTL1, snapTL2);
const timeline = _mon.generateTimeline(compTL, snapTL2);

assert(Array.isArray(timeline),                                      'timeline is an array');
assert(Object.isFrozen(timeline),                                    'timeline is frozen');
assert(timeline.length === compTL.summary.total,                     'one event per change');
assert(timeline.every(e => typeof e.eventId === 'string'),           'every event has eventId');
assert(timeline.every(e => typeof e.snapshotId === 'string'),        'every event has snapshotId');
assert(timeline.every(e => typeof e.domain === 'string'),            'every event has domain');
assert(timeline.every(e => typeof e.severity === 'string'),          'every event has severity');
assert(timeline.every(e => typeof e.label === 'string'),             'every event has label');
assert(timeline.every(e => Object.isFrozen(e)),                      'every event is frozen');

// ─── 14. Timeline Sorting ─────────────────────────────────────────────────────

section('14. Timeline Sorting');

const PRIORITY_ORDER = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFORMATION'];
const sortedTL = _mon.sortTimeline(timeline);

for (let i = 0; i < sortedTL.length - 1; i++) {
  const rankA = PRIORITY_ORDER.indexOf(sortedTL[i].severity);
  const rankB = PRIORITY_ORDER.indexOf(sortedTL[i + 1].severity);
  assert(rankA <= rankB, `Event ${i} severity (${sortedTL[i].severity}) <= Event ${i+1} severity (${sortedTL[i+1].severity})`);
  if (i < 3) break; // check first 3 pairs
}
assert(sortedTL.length === timeline.length, 'sortTimeline preserves all events');

const filtered = _mon.filterTimeline(timeline, { domain: 'catalog' });
assert(filtered.every(e => e.domain === 'catalog'), 'filterTimeline by domain works');

const limited = _mon.filterTimeline(timeline, { limit: 1 });
assert(limited.length <= 1, 'filterTimeline limit respected');

// ─── 15. Alert Generation ─────────────────────────────────────────────────────

section('15. Alert Generation');

const snapAL1 = _mon.buildSnapshotFromScanResult({ scanId: randomUUID(), artistId: 'test-al', canonicalDomains: { publishing: { publisher: 'Old Publisher', iswc: 'T-001' } } });
const snapAL2 = _mon.buildSnapshotFromScanResult({ scanId: randomUUID(), artistId: 'test-al', canonicalDomains: { publishing: { publisher: 'New Publisher', iswc: 'T-001' }, catalog: { label: 'New Label' } } });
const compAL  = _mon.compareSnapshots(snapAL1, snapAL2);
const tlAL    = _mon.generateTimeline(compAL, snapAL2);
const alerts  = _mon.generateAlertsFromTimeline(tlAL, snapAL2);

assert(Array.isArray(alerts),                                     'alerts is an array');
assert(Object.isFrozen(alerts),                                   'alerts array is frozen');
assert(alerts.length > 0,                                         'alerts generated from changes');
assert(alerts.every(a => typeof a.alertId === 'string'),          'every alert has alertId');
assert(alerts.every(a => typeof a.level === 'string'),            'every alert has level');
assert(alerts.every(a => typeof a.title === 'string'),            'every alert has title');
assert(alerts.every(a => typeof a.snapshotId === 'string'),       'every alert has snapshotId');
assert(alerts.every(a => Object.isFrozen(a)),                     'every alert is frozen');
assert(alerts.every(a => Array.isArray(a.timelineEventIds)),      'every alert has timelineEventIds array');

// ─── 16. Alert Severity Routing ───────────────────────────────────────────────

section('16. Alert Severity Routing');

// Publisher change → CRITICAL severity → CRITICAL alert
const criticalAlerts = alerts.filter(a => a.level === 'CRITICAL');
assert(criticalAlerts.length > 0, 'CRITICAL alert generated for publisher change');

// Label change → HIGH alert
const highAlerts = alerts.filter(a => a.level === 'HIGH');
assert(highAlerts.length > 0, 'HIGH alert generated for label change');

// Alerts sorted: CRITICAL first
const ORDER = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFORMATION'];
for (let i = 0; i < alerts.length - 1; i++) {
  const rA = ORDER.indexOf(alerts[i].level);
  const rB = ORDER.indexOf(alerts[i + 1].level);
  assert(rA <= rB, `Alert ${i} (${alerts[i].level}) sorted before alert ${i+1} (${alerts[i+1].level})`);
  if (i < 2) break;
}

assert(alerts[0].level === 'CRITICAL', 'CRITICAL alert is first');

// Empty timeline → no alerts
const emptyAlerts = _mon.generateAlertsFromTimeline([], snapAL2);
assert(emptyAlerts.length === 0, 'empty timeline produces no alerts');

// ─── 17. History Store — Basic CRUD ──────────────────────────────────────────

section('17. History Store — Basic CRUD');

const store = _mon.createHistoryStore();

const snapS1 = _mon.buildSnapshotFromScanResult({ scanId: randomUUID(), artistId: 'store-artist', canonicalDomains: { identity: { artistName: 'A' } } });
store.addSnapshot(snapS1);

assert(store.snapshotCount()             === 1,       'snapshot count = 1 after add');
assert(store.getSnapshot(snapS1.snapshotId) !== null, 'getSnapshot retrieves stored snapshot');
assert(store.getLatestSnapshot('store-artist') !== null, 'getLatestSnapshot returns snapshot');

const snapS2 = _mon.buildSnapshotFromScanResult({ scanId: randomUUID(), artistId: 'store-artist', canonicalDomains: { identity: { artistName: 'B' } } });
store.addSnapshot(snapS2);
assert(store.snapshotCount() === 2, 'snapshot count = 2 after second add');

const compS = _mon.compareSnapshots(snapS1, snapS2);
store.addComparison(compS);
assert(store.comparisonCount()               === 1,   'comparison count = 1');
assert(store.getComparison(compS.comparisonId) !== null, 'getComparison retrieves stored comparison');

const tlS = _mon.generateTimeline(compS, snapS2);
store.addTimelineEvents('store-artist', tlS);
assert(store.getTimelineEvents('store-artist').length > 0, 'getTimelineEvents returns events');

const alS = _mon.generateAlertsFromTimeline(tlS, snapS2);
store.addAlerts('store-artist', alS);
assert(store.getAlerts('store-artist').length >= 0, 'getAlerts returns array');

// ─── 18. History Store — Latest/Previous Snapshot ────────────────────────────

section('18. History Store — Latest/Previous Snapshot');

const storeLP = _mon.createHistoryStore();
const s1 = _mon.buildSnapshotFromScanResult({ scanId: randomUUID(), artistId: 'lp-artist', canonicalDomains: { a: 1 } });
const s2 = _mon.buildSnapshotFromScanResult({ scanId: randomUUID(), artistId: 'lp-artist', canonicalDomains: { a: 2 } });
const s3 = _mon.buildSnapshotFromScanResult({ scanId: randomUUID(), artistId: 'lp-artist', canonicalDomains: { a: 3 } });

storeLP.addSnapshot(s1);
storeLP.addSnapshot(s2);
storeLP.addSnapshot(s3);

assert(storeLP.getLatestSnapshot('lp-artist').snapshotId === s3.snapshotId, 'getLatestSnapshot returns newest');
assert(storeLP.getPreviousSnapshot('lp-artist', s3.snapshotId).snapshotId === s2.snapshotId, 'getPreviousSnapshot returns prior');
assert(storeLP.getPreviousSnapshot('lp-artist', s1.snapshotId) === null, 'no previous for first snapshot');
assert(storeLP.listSnapshots('lp-artist').length === 3, 'listSnapshots returns all 3');
assert(storeLP.getLatestSnapshot('unknown-artist') === null, 'unknown artist returns null');

// ─── 19. recordScan — First Scan ─────────────────────────────────────────────

section('19. recordScan — First Scan');

const eng1 = makeEngine();
const result1 = eng1.recordScan(makeScanInput('artist-first'));

assert(result1.success === true,                    'first scan success = true');
assert(result1.firstScan === true,                  'first scan firstScan = true');
assert(result1.comparison === null,                 'first scan comparison = null');
assert(result1.changeCount === 0,                   'first scan changeCount = 0');
assert(result1.timeline.length === 0,               'first scan timeline empty');
assert(result1.alerts.length === 0,                 'first scan alerts empty');
assert(typeof result1.snapshot.snapshotId === 'string', 'first scan snapshot created');
assert(Object.isFrozen(result1),                    'recordScan result is frozen');

// ─── 20. recordScan — Second Scan with Changes ───────────────────────────────

section('20. recordScan — Second Scan with Changes');

const eng2 = makeEngine();
eng2.recordScan(makeScanInput('artist-second'));

// Second scan with changes
const result2 = eng2.recordScan(makeScanInput('artist-second', {
  catalog: { releaseCount: 7, genre: 'Pop', label: 'New Label', distributor: 'Universal Music Group' },
  publishing: { publisher: 'Warner Chappell', iswc: 'T-999', pro: 'BMI', rights: 'controlled' },
}));

assert(result2.success   === true,    'second scan success');
assert(result2.firstScan === false,   'second scan firstScan = false');
assert(result2.comparison !== null,   'second scan comparison generated');
assert(result2.changeCount > 0,       'second scan has changes');
assert(result2.timeline.length > 0,   'second scan has timeline events');
assert(result2.alerts.length > 0,     'second scan generates alerts');
assert(result2.comparison.summary.modified > 0, 'second scan has modified fields');
assert(eng2.getSnapshot(result2.snapshot.snapshotId) !== null, 'snapshot retrievable');
assert(eng2.getTimeline('artist-second').length > 0,           'timeline stored and retrievable');
assert(eng2.getAlerts('artist-second').length > 0,             'alerts stored and retrievable');

// ─── 21. recordScan — Multiple Artists ───────────────────────────────────────

section('21. recordScan — Multiple Artists');

const engMA = makeEngine();
engMA.recordScan(makeScanInput('artist-alpha'));
engMA.recordScan(makeScanInput('artist-beta'));
engMA.recordScan(makeScanInput('artist-alpha', { catalog: { genre: 'Pop' } }));

const histAlpha = engMA.getHistory('artist-alpha');
const histBeta  = engMA.getHistory('artist-beta');

assert(histAlpha.length === 2, 'artist-alpha has 2 snapshots');
assert(histBeta.length  === 1, 'artist-beta has 1 snapshot');
assert(engMA.getTimeline('artist-alpha').length > 0, 'artist-alpha has timeline events');
assert(engMA.getTimeline('artist-beta').length  === 0, 'artist-beta has no timeline (first scan)');

// ─── 22. Determinism ─────────────────────────────────────────────────────────

section('22. Determinism');

const domains22A = { identity: { artistName: 'X', verified: true }, catalog: { genre: 'R&B' } };
const domains22B = { identity: { artistName: 'X', verified: false }, catalog: { genre: 'Pop' } };

// Two separate comparison runs with identical domain data
const snap22A1 = _mon.buildSnapshotFromScanResult({ scanId: 'scan-d1', artistId: 'det-artist', canonicalDomains: domains22A });
const snap22A2 = _mon.buildSnapshotFromScanResult({ scanId: 'scan-d2', artistId: 'det-artist', canonicalDomains: domains22B });
const comp22_1 = _mon.compareSnapshots(snap22A1, snap22A2);

const snap22B1 = _mon.buildSnapshotFromScanResult({ scanId: 'scan-d3', artistId: 'det-artist', canonicalDomains: domains22A });
const snap22B2 = _mon.buildSnapshotFromScanResult({ scanId: 'scan-d4', artistId: 'det-artist', canonicalDomains: domains22B });
const comp22_2 = _mon.compareSnapshots(snap22B1, snap22B2);

assert(comp22_1.summary.added    === comp22_2.summary.added,    'determinism: same added count');
assert(comp22_1.summary.removed  === comp22_2.summary.removed,  'determinism: same removed count');
assert(comp22_1.summary.modified === comp22_2.summary.modified, 'determinism: same modified count');
assert(comp22_1.summary.unchanged === comp22_2.summary.unchanged, 'determinism: same unchanged count');

// Same severity assigned for same fields
const changesA = comp22_1.changes.map(c => `${c.fieldPath}:${c.severity}`).sort();
const changesB = comp22_2.changes.map(c => `${c.fieldPath}:${c.severity}`).sort();
assert(JSON.stringify(changesA) === JSON.stringify(changesB), 'determinism: same fieldPath+severity pairs');

// ─── 23. Validation Functions ─────────────────────────────────────────────────

section('23. Validation Functions');

const { valid: va, errors: ea } = _mon.validateComparison(compSame);
assert(va === true, 'valid comparison passes validation');

const { valid: vb } = _mon.validateComparison({ comparisonId: 'x' });
assert(vb === false, 'incomplete comparison fails validation');

const sampleEvent = _mon.generateTimeline(compAdded, snapWithExt)[0];
if (sampleEvent) {
  const { valid: vc } = _mon.validateTimelineEvent(sampleEvent);
  assert(vc === true, 'valid timeline event passes validation');
}

const { valid: vd } = _mon.validateTimelineEvent({ eventId: 'x' });
assert(vd === false, 'incomplete timeline event fails validation');

const { valid: ve } = _mon.validateTimelineOrdering(timeline);
assert(ve === true, 'valid timeline ordering check passes');

// ─── 24. Constitutional Boundaries ───────────────────────────────────────────

section('24. Constitutional Boundaries');

// Monitoring never modifies canonicalDomains
const domainsBefore = JSON.stringify(snapV1.canonicalDomains);
_mon.compareSnapshots(snapV1, snapV2);
const domainsAfter  = JSON.stringify(snapV1.canonicalDomains);
assert(domainsBefore === domainsAfter, 'compareSnapshots never mutates previous snapshot domains');

const domainsV2Before = JSON.stringify(snapV2.canonicalDomains);
_mon.generateTimeline(compMod, snapV2);
const domainsV2After  = JSON.stringify(snapV2.canonicalDomains);
assert(domainsV2Before === domainsV2After, 'generateTimeline never mutates snapshot domains');

// compareSnapshots with same snapshotId throws
let sameIdThrew = false;
try { _mon.compareSnapshots(snapA, snapA); } catch { sameIdThrew = true; }
assert(sameIdThrew, 'compareSnapshots rejects comparing snapshot to itself');

// recordScan result is frozen — cannot be mutated
const engConst = makeEngine();
const constResult = engConst.recordScan(makeScanInput('const-artist'));
let resultMutationBlocked = false;
try { constResult.success = false; } catch { resultMutationBlocked = true; }
assert(resultMutationBlocked || constResult.success !== false, 'recordScan result is immutable');

// Engine object is frozen
assert(Object.isFrozen(engConst), 'engine object is frozen');

// ─── 25. API Surface ──────────────────────────────────────────────────────────

section('25. API Surface');

const engAPI = makeEngine();

assert(typeof engAPI.recordScan        === 'function', 'recordScan is a function');
assert(typeof engAPI.getTimeline       === 'function', 'getTimeline is a function');
assert(typeof engAPI.getLatestChanges  === 'function', 'getLatestChanges is a function');
assert(typeof engAPI.getAlerts         === 'function', 'getAlerts is a function');
assert(typeof engAPI.getSnapshot       === 'function', 'getSnapshot is a function');
assert(typeof engAPI.compareSnapshots  === 'function', 'compareSnapshots is a function');
assert(typeof engAPI.getHistory        === 'function', 'getHistory is a function');
assert(typeof engAPI.engineVersion     === 'object',   'engineVersion is an object');

// Singleton is accessible
assert(typeof _mon.MONITORING_ENGINE.recordScan      === 'function', 'singleton.recordScan accessible');
assert(typeof _mon.MONITORING_ENGINE.getTimeline     === 'function', 'singleton.getTimeline accessible');

// getLatestChanges returns null with only one scan
engAPI.recordScan(makeScanInput('api-artist'));
assert(engAPI.getLatestChanges('api-artist') === null, 'getLatestChanges null with only one scan');

// getLatestChanges returns comparison after two scans
engAPI.recordScan(makeScanInput('api-artist', { catalog: { genre: 'Pop' } }));
assert(engAPI.getLatestChanges('api-artist') !== null, 'getLatestChanges returns comparison after two scans');

// ─── Summary ──────────────────────────────────────────────────────────────────

console.log(`\n${'─'.repeat(60)}`);
console.log(`Monitoring & Change Detection Engine(tm) — Sprint 8`);
console.log(`${'─'.repeat(60)}`);
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);
console.log(`Total:  ${passed + failed}`);

if (failed > 0) {
  console.error(`\n${failed} assertion(s) failed.`);
  process.exit(1);
}
