// Canonical Intelligence Platform(tm) -- Scan Orchestrator(tm) Test Suite
// Sprint 7: Scan Orchestrator(tm)

import * as _orchRef from '../api/orchestrator/index.js';

let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (condition) { console.log(`  ✓ ${label}`); passed++; }
  else           { console.error(`  ✗ ${label}`); failed++; }
}

function section(title) { console.log(`\n── ${title}`); }

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeExecutors(overrides = {}) {
  return {
    connectors:    async ({ scanId }) => ({ scanId, evidenceCount: 3 }),
    registry:      async ({ scanId }) => ({ scanId, registeredCount: 3 }),
    normalization: async ({ scanId }) => ({ scanId, normalizedCount: 3 }),
    resolution:    async ({ scanId }) => ({ scanId, resolvedCount: 3 }),
    domains:       async ({ scanId }) => ({ scanId, domainsRefreshed: ['identity', 'catalog'] }),
    ...overrides,
  };
}

function makeOrchestrator(executorOverrides = {}, options = {}) {
  return _orchRef.createScanOrchestrator({ stageExecutors: makeExecutors(executorOverrides), options });
}

const VALID_REQUEST = { artistId: 'apple-A001', artistName: 'The Weeknd' };

// ─── 1. Engine Loader ─────────────────────────────────────────────────────────

section('1. Engine Loader');

assert(typeof _orchRef.SCAN_ORCHESTRATOR === 'object',         'SCAN_ORCHESTRATOR singleton exported');
assert(typeof _orchRef.createScanOrchestrator === 'function',  'createScanOrchestrator factory exported');
assert(_orchRef.ORCHESTRATOR_VERSION.version === '1.0.0',      'version is 1.0.0');
assert(Object.isFrozen(_orchRef.ORCHESTRATOR_VERSION),         'ORCHESTRATOR_VERSION is frozen');
assert(_orchRef.ORCHESTRATOR_VERSION.engineId === 'scan-orchestrator-v1', 'engineId correct');

// ─── 2. Type Constants ────────────────────────────────────────────────────────

section('2. Type Constants');

const { LIFECYCLE_STAGES, SCAN_STATUSES, ORCHESTRATOR_EVENTS, ORCHESTRATOR_ERROR_CODES, LIFECYCLE_STAGE_ORDER } = _orchRef;

assert(LIFECYCLE_STAGES.SCAN_REQUESTED        === 'SCAN_REQUESTED',        'SCAN_REQUESTED');
assert(LIFECYCLE_STAGES.CONNECTORS_STARTED    === 'CONNECTORS_STARTED',    'CONNECTORS_STARTED');
assert(LIFECYCLE_STAGES.EVIDENCE_COLLECTED    === 'EVIDENCE_COLLECTED',    'EVIDENCE_COLLECTED');
assert(LIFECYCLE_STAGES.REGISTRY_COMPLETE     === 'REGISTRY_COMPLETE',     'REGISTRY_COMPLETE');
assert(LIFECYCLE_STAGES.NORMALIZATION_COMPLETE=== 'NORMALIZATION_COMPLETE','NORMALIZATION_COMPLETE');
assert(LIFECYCLE_STAGES.RESOLUTION_COMPLETE   === 'RESOLUTION_COMPLETE',   'RESOLUTION_COMPLETE');
assert(LIFECYCLE_STAGES.DOMAINS_REFRESHED     === 'DOMAINS_REFRESHED',     'DOMAINS_REFRESHED');
assert(LIFECYCLE_STAGES.SCAN_COMPLETE         === 'SCAN_COMPLETE',         'SCAN_COMPLETE');
assert(LIFECYCLE_STAGES.SCAN_FAILED           === 'SCAN_FAILED',           'SCAN_FAILED');
assert(LIFECYCLE_STAGES.SCAN_CANCELLED        === 'SCAN_CANCELLED',        'SCAN_CANCELLED');
assert(LIFECYCLE_STAGES.SCAN_TIMED_OUT        === 'SCAN_TIMED_OUT',        'SCAN_TIMED_OUT');
assert(SCAN_STATUSES.PENDING    === 'PENDING',    'SCAN_STATUSES.PENDING');
assert(SCAN_STATUSES.RUNNING    === 'RUNNING',    'SCAN_STATUSES.RUNNING');
assert(SCAN_STATUSES.COMPLETED  === 'COMPLETED',  'SCAN_STATUSES.COMPLETED');
assert(SCAN_STATUSES.FAILED     === 'FAILED',     'SCAN_STATUSES.FAILED');
assert(SCAN_STATUSES.CANCELLED  === 'CANCELLED',  'SCAN_STATUSES.CANCELLED');
assert(SCAN_STATUSES.TIMED_OUT  === 'TIMED_OUT',  'SCAN_STATUSES.TIMED_OUT');

// ─── 3. Lifecycle State Machine ───────────────────────────────────────────────

section('3. Lifecycle State Machine');

const { isValidTransition, isTerminalStage, deriveStatus, VALID_TRANSITIONS } = _orchRef;

assert(isValidTransition(LIFECYCLE_STAGES.SCAN_REQUESTED, LIFECYCLE_STAGES.CONNECTORS_STARTED),      'SCAN_REQUESTED → CONNECTORS_STARTED valid');
assert(isValidTransition(LIFECYCLE_STAGES.CONNECTORS_STARTED, LIFECYCLE_STAGES.EVIDENCE_COLLECTED),  'CONNECTORS_STARTED → EVIDENCE_COLLECTED valid');
assert(isValidTransition(LIFECYCLE_STAGES.DOMAINS_REFRESHED, LIFECYCLE_STAGES.SCAN_COMPLETE),        'DOMAINS_REFRESHED → SCAN_COMPLETE valid');
assert(isValidTransition(LIFECYCLE_STAGES.CONNECTORS_STARTED, LIFECYCLE_STAGES.SCAN_FAILED),         'Any stage → SCAN_FAILED valid');
assert(isValidTransition(LIFECYCLE_STAGES.REGISTRY_COMPLETE, LIFECYCLE_STAGES.SCAN_CANCELLED),       'Any stage → SCAN_CANCELLED valid');
assert(!isValidTransition(LIFECYCLE_STAGES.SCAN_COMPLETE, LIFECYCLE_STAGES.SCAN_REQUESTED),          'Terminal stage → any is invalid');
assert(!isValidTransition(LIFECYCLE_STAGES.SCAN_REQUESTED, LIFECYCLE_STAGES.REGISTRY_COMPLETE),      'SCAN_REQUESTED cannot skip to REGISTRY_COMPLETE');
assert(isTerminalStage(LIFECYCLE_STAGES.SCAN_COMPLETE),   'SCAN_COMPLETE is terminal');
assert(isTerminalStage(LIFECYCLE_STAGES.SCAN_FAILED),     'SCAN_FAILED is terminal');
assert(isTerminalStage(LIFECYCLE_STAGES.SCAN_CANCELLED),  'SCAN_CANCELLED is terminal');
assert(!isTerminalStage(LIFECYCLE_STAGES.CONNECTORS_STARTED), 'CONNECTORS_STARTED is not terminal');
assert(deriveStatus(LIFECYCLE_STAGES.SCAN_REQUESTED)  === 'PENDING',    'SCAN_REQUESTED → PENDING');
assert(deriveStatus(LIFECYCLE_STAGES.CONNECTORS_STARTED) === 'RUNNING', 'CONNECTORS_STARTED → RUNNING');
assert(deriveStatus(LIFECYCLE_STAGES.SCAN_COMPLETE)   === 'COMPLETED',  'SCAN_COMPLETE → COMPLETED');
assert(deriveStatus(LIFECYCLE_STAGES.SCAN_FAILED)     === 'FAILED',     'SCAN_FAILED → FAILED');
assert(deriveStatus(LIFECYCLE_STAGES.SCAN_TIMED_OUT)  === 'TIMED_OUT',  'SCAN_TIMED_OUT → TIMED_OUT');

// ─── 4. Scan State™ ──────────────────────────────────────────────────────────

section('4. Scan State™');

const { createScanState, transitionState } = _orchRef;

const s0 = createScanState({ scanId: 'test-1', scanRequest: VALID_REQUEST });
assert(Object.isFrozen(s0),                          'Initial scan state is frozen');
assert(s0.scanId === 'test-1',                       'scanId preserved');
assert(s0.status === 'PENDING',                      'Initial status is PENDING');
assert(s0.lifecycleStage === 'SCAN_REQUESTED',       'Initial lifecycleStage is SCAN_REQUESTED');
assert(Array.isArray(s0.lifecycleHistory),           'lifecycleHistory is array');
assert(s0.lifecycleHistory.length === 0,             'lifecycleHistory starts empty');
assert(s0.error === null,                            'error starts null');
assert(s0.cancelRequested === false,                 'cancelRequested starts false');
assert(Object.isFrozen(s0.scanRequest),              'scanRequest is frozen');

const s1 = transitionState(s0, LIFECYCLE_STAGES.CONNECTORS_STARTED);
assert(Object.isFrozen(s1),                          'Transitioned state is frozen');
assert(s1.status === 'RUNNING',                      'Status → RUNNING after first transition');
assert(s1.lifecycleStage === 'CONNECTORS_STARTED',   'lifecycleStage updated');
assert(s1.lifecycleHistory.length === 1,             'History grew by 1');
assert(s1.startedAt !== null,                        'startedAt set on first RUNNING transition');
assert(s0.lifecycleStage === 'SCAN_REQUESTED',       'Original state not mutated');

let invalidTransErr = false;
try { transitionState(s0, LIFECYCLE_STAGES.SCAN_COMPLETE); } catch { invalidTransErr = true; }
assert(invalidTransErr, 'Invalid transition throws');

// ─── 5. Event System™ ────────────────────────────────────────────────────────

section('5. Event System™');

const { createEventEmitter, createScanEvent } = _orchRef;

const emitter = createEventEmitter();
const received = [];
emitter.on('SCAN_COMPLETED', e => received.push(e));
emitter.emit('SCAN_COMPLETED', { result: 'ok' }, 'scan-1', LIFECYCLE_STAGES.SCAN_COMPLETE);
assert(received.length === 1,                     'Event received by subscriber');
assert(received[0].eventType === 'SCAN_COMPLETED','eventType correct');
assert(received[0].scanId === 'scan-1',           'scanId in event');
assert(Object.isFrozen(received[0]),              'Event is frozen');
assert(typeof received[0].eventId === 'string',   'eventId auto-generated');
assert(typeof received[0].timestamp === 'string', 'timestamp present');

// Wildcard subscription
const wildReceived = [];
emitter.on('*', e => wildReceived.push(e));
emitter.emit('SCAN_FAILED', null, 'scan-2', LIFECYCLE_STAGES.SCAN_FAILED);
assert(wildReceived.length === 1, 'Wildcard handler receives all events');

// off() works
const handler = e => received.push(e);
emitter.on('REGISTRY_COMPLETE', handler);
emitter.off('REGISTRY_COMPLETE', handler);
emitter.emit('REGISTRY_COMPLETE', null, 'scan-3', LIFECYCLE_STAGES.REGISTRY_COMPLETE);
assert(received.length === 1, 'off() prevents future delivery');

const ev = createScanEvent({ eventType: 'SCAN_COMPLETED', scanId: 'x' });
assert(Object.isFrozen(ev),                   'createScanEvent produces frozen event');
assert(ev.engineVersion === '1.0.0',          'engineVersion in event');

// ─── 6. Scan Queue™ ──────────────────────────────────────────────────────────

section('6. Scan Queue™');

const { createScanQueue } = _orchRef;
const q = createScanQueue();
const qs = createScanState({ scanId: 'q-1' });
q.enqueue(qs);
assert(q.size() === 1,                     'Queue size 1 after enqueue');
assert(q.has('q-1'),                       'has() returns true for queued scan');
assert(q.get('q-1') === qs,               'get() returns correct state');
assert(q.list().length === 1,              'list() returns all scans');
assert(q.pending().length === 1,           'pending() returns PENDING scans');
assert(q.running().length === 0,           'running() returns 0 when none running');

const updatedQS = transitionState(qs, LIFECYCLE_STAGES.CONNECTORS_STARTED);
q.update('q-1', updatedQS);
assert(q.get('q-1').status === 'RUNNING',  'update() replaces state');
assert(q.running().length === 1,           'running() now returns 1');

let dupError = false;
try { q.enqueue(qs); } catch { dupError = true; }
assert(dupError, 'Duplicate enqueue throws');

const { markCancelRequested } = _orchRef;
const cancelledQS = markCancelRequested(qs);
assert(cancelledQS.cancelRequested === true, 'markCancelRequested sets flag');
assert(Object.isFrozen(cancelledQS),          'markCancelRequested result is frozen');
assert(qs.cancelRequested === false,          'Original state not mutated');

// ─── 7. Scan Scheduler™ ──────────────────────────────────────────────────────

section('7. Scan Scheduler™');

const { createScanScheduler } = _orchRef;
const sched = createScanScheduler({ maxConcurrentScans: 2 });
assert(sched.maxConcurrent() === 2,  'maxConcurrent() correct');
assert(sched.canStart() === true,    'canStart() true when empty');
assert(sched.activeCount() === 0,    'activeCount 0 initially');
sched.markStarted('s1');
sched.markStarted('s2');
assert(sched.canStart() === false,   'canStart() false when at max');
assert(sched.activeCount() === 2,    'activeCount 2');
sched.markCompleted('s1');
assert(sched.canStart() === true,    'canStart() true after completion');
assert(sched.activeCount() === 1,    'activeCount decremented');

let schedError = false;
try { sched.markStarted('s3'); sched.markStarted('s4'); } catch { schedError = true; }
assert(schedError, 'Exceeding maxConcurrentScans throws');

// ─── 8. Pipeline Stage Order ──────────────────────────────────────────────────

section('8. Pipeline Stage Order');

const { getPipelineStageDefs } = _orchRef;
const stageDefs = getPipelineStageDefs();
assert(Array.isArray(stageDefs),                          'getPipelineStageDefs returns array');
assert(stageDefs.length === 5,                            '5 pipeline stages defined');
assert(stageDefs[0].executorKey === 'connectors',         'Stage 0 = connectors');
assert(stageDefs[1].executorKey === 'registry',           'Stage 1 = registry');
assert(stageDefs[2].executorKey === 'normalization',      'Stage 2 = normalization');
assert(stageDefs[3].executorKey === 'resolution',         'Stage 3 = resolution');
assert(stageDefs[4].executorKey === 'domains',            'Stage 4 = domains');
assert(stageDefs[0].startStage === LIFECYCLE_STAGES.CONNECTORS_STARTED,    'Connectors has startStage');
assert(stageDefs[0].endStage   === LIFECYCLE_STAGES.EVIDENCE_COLLECTED,    'Connectors endStage correct');
assert(stageDefs[4].endStage   === LIFECYCLE_STAGES.DOMAINS_REFRESHED,     'Domains endStage correct');

// ─── 9. Validation ────────────────────────────────────────────────────────────

section('9. Validation');

const { validateScanRequest, validateStageExecutors, validatePipelineOrder, validateLifecycleTransition } = _orchRef;

assert(validateScanRequest(VALID_REQUEST).length === 0,   'Valid scan request passes');
assert(validateScanRequest({}).length > 0,                'Empty request fails validation');
assert(validateScanRequest(null).length > 0,              'Null request fails validation');
assert(validateScanRequest({ url: 'https://music.apple.com/artist/1' }).length === 0, 'URL-only request is valid');

assert(validateStageExecutors(makeExecutors()).length === 0, 'Valid executors pass');
assert(validateStageExecutors({ connectors: 'not-a-fn' }).length > 0, 'Non-function executor fails');
assert(validateStageExecutors({}).length === 5,             'All 5 missing executors reported');

const goodOrder = [LIFECYCLE_STAGES.SCAN_REQUESTED, LIFECYCLE_STAGES.CONNECTORS_STARTED, LIFECYCLE_STAGES.EVIDENCE_COLLECTED];
assert(validatePipelineOrder(goodOrder).length === 0,       'Correct stage order passes');

assert(validateLifecycleTransition(LIFECYCLE_STAGES.SCAN_REQUESTED, LIFECYCLE_STAGES.CONNECTORS_STARTED).length === 0, 'Valid transition passes');
assert(validateLifecycleTransition(LIFECYCLE_STAGES.SCAN_COMPLETE, LIFECYCLE_STAGES.SCAN_REQUESTED).length > 0,        'Invalid transition fails');

// ─── 10. Full Successful Pipeline ─────────────────────────────────────────────

section('10. Full Successful Pipeline');

const orch = makeOrchestrator();
const result = await orch.scan(VALID_REQUEST);

assert(result.success === true,                                  'Successful scan returns success=true');
assert(typeof result.scanId === 'string',                        'scanId returned');
assert(result.state.status === 'COMPLETED',                      'Final status = COMPLETED');
assert(result.state.lifecycleStage === 'SCAN_COMPLETE',          'Final stage = SCAN_COMPLETE');
assert(result.state.completedAt !== null,                        'completedAt set');
assert(result.state.startedAt !== null,                          'startedAt set');
assert(result.error === null,                                    'No error on success');
assert(result.state.lifecycleHistory.length > 0,                 'History populated');
assert(Object.isFrozen(result.state),                            'Final state is frozen');

// ─── 11. Stage Results Carried Forward ────────────────────────────────────────

section('11. Stage Results Carried Forward');

const orchWithResults = makeOrchestrator({
  connectors:    async ({ scanId }) => ({ scanId, providersRun: ['apple-music', 'spotify'] }),
  normalization: async ({ scanId, previousResults }) => ({ scanId, seenPriorStages: Object.keys(previousResults).length }),
});

const r2 = await orchWithResults.scan(VALID_REQUEST);
assert(r2.success === true, 'Pipeline with results carried forward succeeds');
const normResult = r2.state.stageResults[LIFECYCLE_STAGES.NORMALIZATION_COMPLETE];
assert(normResult?.seenPriorStages >= 1, 'Previous stage results visible to later executor');

// ─── 12. Failure — Connector Failure ──────────────────────────────────────────

section('12. Failure — Connector Failure');

const orchFail = makeOrchestrator({ connectors: async () => { throw new Error('Provider API unavailable'); } });
const rf = await orchFail.scan(VALID_REQUEST);

assert(rf.success === false,                                     'Failed scan returns success=false');
assert(rf.state.status === 'FAILED',                             'Status = FAILED');
assert(rf.state.lifecycleStage === 'SCAN_FAILED',                'lifecycleStage = SCAN_FAILED');
assert(rf.state.failedAt !== null,                               'failedAt set');
assert(rf.state.error?.code === 'CONNECTOR_FAILURE',             'Error code = CONNECTOR_FAILURE');
assert(typeof rf.state.error?.message === 'string',              'Error message present');

// ─── 13. Failure — Mid-Pipeline (Normalization) ────────────────────────────────

section('13. Failure — Mid-Pipeline (Normalization)');

const orchNormFail = makeOrchestrator({ normalization: async () => { throw new Error('Normalization crashed'); } });
const rnf = await orchNormFail.scan(VALID_REQUEST);

assert(rnf.success === false,                           'Failed normalization returns success=false');
assert(rnf.state.error?.code === 'NORMALIZATION_FAILURE','Error code = NORMALIZATION_FAILURE');
// Prior stages completed — history should include EVIDENCE_COLLECTED and REGISTRY_COMPLETE
const histStages = rnf.state.lifecycleHistory.map(h => h.stage);
assert(histStages.includes('EVIDENCE_COLLECTED'),       'EVIDENCE_COLLECTED in history before failure');
assert(histStages.includes('REGISTRY_COMPLETE'),        'REGISTRY_COMPLETE in history before failure');

// ─── 14. Failure — Resolution Failure ─────────────────────────────────────────

section('14. Failure — Resolution Failure');

const orchResFail = makeOrchestrator({ resolution: async () => { throw new Error('Resolution error'); } });
const rrf = await orchResFail.scan(VALID_REQUEST);
assert(rrf.state.error?.code === 'RESOLUTION_FAILURE',  'Resolution failure code correct');
assert(rrf.state.status === 'FAILED',                    'Status FAILED on resolution error');

// ─── 15. Timeout Handling ─────────────────────────────────────────────────────

section('15. Timeout Handling');

const orchTimeout = makeOrchestrator(
  { connectors: async () => new Promise(resolve => setTimeout(resolve, 500)) },
  { stageTimeout: 10 }
);
const rt = await orchTimeout.scan(VALID_REQUEST);

assert(rt.success === false,                           'Timed-out scan returns success=false');
assert(rt.state.status === 'TIMED_OUT',               'Status = TIMED_OUT');
assert(rt.state.lifecycleStage === 'SCAN_TIMED_OUT',  'lifecycleStage = SCAN_TIMED_OUT');
assert(rt.state.timedOutAt !== null,                  'timedOutAt set');
assert(rt.state.error?.code === 'PIPELINE_TIMEOUT',   'Error code = PIPELINE_TIMEOUT');

// ─── 16. Cancellation ────────────────────────────────────────────────────────

section('16. Cancellation');

const orchCancel = makeOrchestrator({
  connectors: async ({ scanId }) => ({ scanId, evidenceCount: 1 }),
  // registry sets cancelRequested then returns — cancellation check happens BEFORE next stage
});

// We can't easily cancel mid-execution in a sync test, so we test the mechanism via direct queue cancel
const cancelQ = _orchRef.createScanQueue();
const cancelState = createScanState({ scanId: 'cancel-test' });
cancelQ.enqueue(cancelState);
cancelQ.cancel('cancel-test');
const cancelledState = cancelQ.get('cancel-test');
assert(cancelledState.cancelRequested === true, 'Queue cancel() marks cancelRequested');

// Test cancel() on an orchestrator
const orchForCancel = makeOrchestrator({
  connectors: async ({ scanId }) => ({ scanId }),
  registry:   async ({ scanId }) => { return { scanId }; },
  normalization: async () => new Promise(resolve => setTimeout(resolve, 1000)),
});
// Start scan in background (don't await)
const scanPromise = orchForCancel.scan({ ...VALID_REQUEST, scanId: 'cancel-me' });
// Immediately try to cancel — may or may not hit before normalization starts
const cancelResult = orchForCancel.cancel('cancel-me');
assert(cancelResult.success === true || cancelResult.error?.code === 'SCAN_NOT_FOUND', 'cancel() returns result');
await scanPromise; // let it finish regardless

// ─── 17. Events Emitted in Order ──────────────────────────────────────────────

section('17. Events Emitted in Order');

const orchEvents = makeOrchestrator();
const eventsLog = [];
orchEvents.on('*', e => eventsLog.push(e.eventType));
await orchEvents.scan(VALID_REQUEST);

assert(eventsLog[0] === 'SCAN_REQUESTED',          'First event: SCAN_REQUESTED');
assert(eventsLog.includes('CONNECTORS_STARTED'),   'CONNECTORS_STARTED emitted');
assert(eventsLog.includes('EVIDENCE_COLLECTED'),   'EVIDENCE_COLLECTED emitted');
assert(eventsLog.includes('REGISTRY_COMPLETE'),    'REGISTRY_COMPLETE emitted');
assert(eventsLog.includes('NORMALIZATION_COMPLETE'),'NORMALIZATION_COMPLETE emitted');
assert(eventsLog.includes('RESOLUTION_COMPLETE'),  'RESOLUTION_COMPLETE emitted');
assert(eventsLog.includes('DOMAINS_REFRESHED'),    'DOMAINS_REFRESHED emitted');
assert(eventsLog[eventsLog.length - 1] === 'SCAN_COMPLETED', 'Last event: SCAN_COMPLETED');

// Failure events
const orchFailEvents = makeOrchestrator({ connectors: async () => { throw new Error('fail'); } });
const failLog = [];
orchFailEvents.on('*', e => failLog.push(e.eventType));
await orchFailEvents.scan(VALID_REQUEST);
assert(failLog.includes('SCAN_FAILED'),            'SCAN_FAILED event emitted on failure');
assert(failLog.includes('PIPELINE_STAGE_FAILED'),  'PIPELINE_STAGE_FAILED emitted on failure');
assert(!failLog.includes('SCAN_COMPLETED'),        'SCAN_COMPLETED NOT emitted on failure');

// ─── 18. Scan State Immutability ──────────────────────────────────────────────

section('18. Scan State Immutability');

const orchImm = makeOrchestrator();
const immResult = await orchImm.scan(VALID_REQUEST);

assert(Object.isFrozen(immResult.state),                          'Final state is frozen');
assert(Object.isFrozen(immResult.state.lifecycleHistory),         'lifecycleHistory is frozen');
assert(Object.isFrozen(immResult.state.scanRequest),              'scanRequest is frozen');
assert(Object.isFrozen(immResult.state.stageResults),             'stageResults is frozen');

// Verify history entries are frozen
if (immResult.state.lifecycleHistory.length > 0) {
  assert(Object.isFrozen(immResult.state.lifecycleHistory[0]),    'History entries are frozen');
}

// Original scan request not mutated
const req = { artistId: 'test', artistName: 'Test Artist' };
const reqCopy = { ...req };
await orchImm.scan(req);
assert(req.artistId === reqCopy.artistId && req.artistName === reqCopy.artistName, 'Input request not mutated');

// ─── 19. Determinism ──────────────────────────────────────────────────────────

section('19. Determinism');

const orchDet1 = makeOrchestrator();
const orchDet2 = makeOrchestrator();

const dr1 = await orchDet1.scan({ artistId: 'apple-A001', artistName: 'Drake' });
const dr2 = await orchDet2.scan({ artistId: 'apple-A001', artistName: 'Drake' });

assert(dr1.success === dr2.success,                   'Same request → same success outcome');
assert(dr1.state.status === dr2.state.status,         'Same request → same final status');
assert(dr1.state.lifecycleStage === dr2.state.lifecycleStage, 'Same request → same final stage');
assert(dr1.state.lifecycleHistory.length === dr2.state.lifecycleHistory.length, 'Same history length');

// ─── 20. Multiple Concurrent Scans ────────────────────────────────────────────

section('20. Multiple Concurrent Scans');

const orchMulti = makeOrchestrator();
const [mr1, mr2, mr3] = await Promise.all([
  orchMulti.scan({ artistId: 'a1', artistName: 'Artist One' }),
  orchMulti.scan({ artistId: 'a2', artistName: 'Artist Two' }),
  orchMulti.scan({ artistId: 'a3', artistName: 'Artist Three' }),
]);

assert(mr1.success && mr2.success && mr3.success, 'All concurrent scans succeed');
assert(mr1.scanId !== mr2.scanId && mr2.scanId !== mr3.scanId, 'Each scan has unique scanId');
assert(orchMulti.listScans().length === 3, 'All scans tracked in queue');

// ─── 21. Invalid Scan Request ─────────────────────────────────────────────────

section('21. Invalid Scan Request');

const orchValidate = makeOrchestrator();
const invalid = await orchValidate.scan({});
assert(invalid.success === false,                          'Empty request → success=false');
assert(invalid.error?.code === 'INVALID_SCAN_REQUEST',     'Error code = INVALID_SCAN_REQUEST');
assert(invalid.state === null,                             'No state produced for invalid request');
assert(invalid.scanId === null,                            'No scanId for invalid request');

const invalidNull = await orchValidate.scan(null);
assert(invalidNull.success === false,                      'Null request → success=false');

// ─── 22. getState() and listScans() ──────────────────────────────────────────

section('22. getState() and listScans()');

const orchQuery = makeOrchestrator();
const qr = await orchQuery.scan({ artistId: 'q-artist' });
const retrieved = orchQuery.getState(qr.scanId);
assert(retrieved !== null,                                    'getState() returns state after scan');
assert(retrieved.scanId === qr.scanId,                        'getState() returns correct scan');
assert(orchQuery.listScans().length >= 1,                     'listScans() returns at least 1');
assert(orchQuery.getState('nonexistent-id') === null,         'getState() returns null for unknown id');

// ─── 23. Default Stage Executors (stubs) ──────────────────────────────────────

section('23. Default Stage Executors (stubs)');

const { DEFAULT_STAGE_EXECUTORS, SCAN_ORCHESTRATOR } = _orchRef;
assert(typeof DEFAULT_STAGE_EXECUTORS.connectors === 'function',    'Default connectors executor exists');
assert(typeof DEFAULT_STAGE_EXECUTORS.registry === 'function',      'Default registry executor exists');
assert(typeof DEFAULT_STAGE_EXECUTORS.normalization === 'function',  'Default normalization executor exists');
assert(typeof DEFAULT_STAGE_EXECUTORS.resolution === 'function',     'Default resolution executor exists');
assert(typeof DEFAULT_STAGE_EXECUTORS.domains === 'function',        'Default domains executor exists');

const stubResult = await SCAN_ORCHESTRATOR.scan(VALID_REQUEST);
assert(stubResult.success === true,                                   'Default stub orchestrator completes successfully');
assert(stubResult.state.status === 'COMPLETED',                       'Default stub scan status = COMPLETED');

// ─── 24. Lifecycle History Completeness ───────────────────────────────────────

section('24. Lifecycle History Completeness');

const orchHist = makeOrchestrator();
const hr = await orchHist.scan(VALID_REQUEST);
const histStageNames = hr.state.lifecycleHistory.map(h => h.stage);

assert(histStageNames.includes('SCAN_REQUESTED'),       'SCAN_REQUESTED in history');
assert(histStageNames.includes('CONNECTORS_STARTED'),   'CONNECTORS_STARTED in history');
assert(histStageNames.includes('EVIDENCE_COLLECTED'),   'EVIDENCE_COLLECTED in history');
assert(histStageNames.includes('REGISTRY_COMPLETE'),    'REGISTRY_COMPLETE in history');
assert(histStageNames.includes('NORMALIZATION_COMPLETE'),'NORMALIZATION_COMPLETE in history');
assert(histStageNames.includes('RESOLUTION_COMPLETE'),  'RESOLUTION_COMPLETE in history');
assert(histStageNames.includes('DOMAINS_REFRESHED'),    'DOMAINS_REFRESHED in history');

hr.state.lifecycleHistory.forEach(entry => {
  assert(entry.enteredAt && entry.exitedAt, `History entry for ${entry.stage} has timestamps`);
});

// ─── 25. Constitutional Boundaries ────────────────────────────────────────────

section('25. Constitutional Boundaries');

// Orchestrator does not contain business logic — executor is a black box
let executorCallOrder = [];
const orderedOrch = makeOrchestrator({
  connectors:    async () => { executorCallOrder.push('connectors');    return {}; },
  registry:      async () => { executorCallOrder.push('registry');      return {}; },
  normalization: async () => { executorCallOrder.push('normalization'); return {}; },
  resolution:    async () => { executorCallOrder.push('resolution');    return {}; },
  domains:       async () => { executorCallOrder.push('domains');       return {}; },
});
await orderedOrch.scan(VALID_REQUEST);

assert(executorCallOrder[0] === 'connectors',    'Connectors called first');
assert(executorCallOrder[1] === 'registry',      'Registry called second');
assert(executorCallOrder[2] === 'normalization', 'Normalization called third');
assert(executorCallOrder[3] === 'resolution',    'Resolution called fourth');
assert(executorCallOrder[4] === 'domains',       'Domains called fifth');

// Engine version is accessible
assert(typeof _orchRef.SCAN_ORCHESTRATOR.engineVersion === 'string', 'engineVersion exposed on orchestrator');

// ─── Summary ─────────────────────────────────────────────────────────────────

console.log(`\n${'═'.repeat(60)}`);
console.log(`Scan Orchestrator Test Suite — Sprint 7`);
console.log(`${'─'.repeat(60)}`);
console.log(`  Total:  ${passed + failed}`);
console.log(`  Passed: ${passed}`);
console.log(`  Failed: ${failed}`);
console.log(`${'═'.repeat(60)}\n`);

if (failed > 0) process.exit(1);
