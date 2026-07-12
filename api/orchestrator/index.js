// Canonical Intelligence Platform(tm) -- Scan Orchestrator(tm) Public API
// Sole public entrypoint. The Orchestrator coordinates execution only.
// It never performs evidence collection, normalization, resolution, or domain logic.

import { randomUUID } from 'crypto';
import { ORCHESTRATOR_VERSION } from './version.js';
import { createScanState } from './state.js';
import { createEventEmitter } from './events.js';
import { createScanQueue } from './queue.js';
import { createScanScheduler } from './scheduler.js';
import { executePipeline } from './pipeline.js';
import { validateScanRequest, validateStageExecutors } from './validate.js';
import { LIFECYCLE_STAGES, ORCHESTRATOR_ERROR_CODES } from './types.js';

// Stub executors — represent the interfaces Sprint 3/4/5/6 modules satisfy.
// Replace with real implementations at wiring time.
export const DEFAULT_STAGE_EXECUTORS = Object.freeze({
  connectors:    async ({ scanId }) => ({ scanId, providersRun: [], evidenceCount: 0, stub: true }),
  registry:      async ({ scanId }) => ({ scanId, registeredCount: 0, registryRecordIds: [], stub: true }),
  normalization: async ({ scanId }) => ({ scanId, normalizedCount: 0, normalizedRecordIds: [], stub: true }),
  resolution:    async ({ scanId }) => ({ scanId, resolvedCount: 0, resolutionRecordIds: [], stub: true }),
  domains:       async ({ scanId }) => ({ scanId, domainsRefreshed: [], refreshedAt: new Date().toISOString(), stub: true }),
});

export function createScanOrchestrator({ stageExecutors, options } = {}) {
  const _executors  = stageExecutors ?? DEFAULT_STAGE_EXECUTORS;
  const _opts       = options ?? {};
  const _queue      = createScanQueue();
  const _emitter    = createEventEmitter();
  const _scheduler  = createScanScheduler({ maxConcurrentScans: _opts.maxConcurrentScans });
  const _timeout    = _opts.stageTimeout ?? null;

  async function scan(request) {
    const requestErrors = validateScanRequest(request);
    if (requestErrors.length > 0) {
      return {
        success: false,
        scanId:  null,
        error:   { code: ORCHESTRATOR_ERROR_CODES.INVALID_SCAN_REQUEST, details: requestErrors },
        state:   null,
      };
    }

    const scanId     = request.scanId ?? randomUUID();
    const scanState  = createScanState({ scanId, scanRequest: request });
    _queue.enqueue(scanState);
    _scheduler.markStarted(scanId);

    let finalState;
    try {
      finalState = await executePipeline({
        initialState:   scanState,
        stageExecutors: _executors,
        emitter:        _emitter,
        queue:          _queue,
        stageTimeout:   _timeout,
      });
    } finally {
      _scheduler.markCompleted(scanId);
    }

    return {
      success: finalState.status === 'COMPLETED',
      scanId,
      state: finalState,
      error: finalState.error ?? null,
    };
  }

  function cancel(scanId) {
    if (!_queue.has(scanId)) {
      return { success: false, error: { code: ORCHESTRATOR_ERROR_CODES.SCAN_NOT_FOUND, message: `Scan ${scanId} not found` } };
    }
    const state = _queue.cancel(scanId);
    return { success: true, state };
  }

  function getState(scanId) {
    return _queue.get(scanId);
  }

  function listScans() {
    return _queue.list();
  }

  function on(eventType, handler)  { _emitter.on(eventType, handler); }
  function off(eventType, handler) { _emitter.off(eventType, handler); }

  return Object.freeze({
    scan,
    cancel,
    getState,
    listScans,
    on,
    off,
    engineVersion: ORCHESTRATOR_VERSION.version,
  });
}

export const SCAN_ORCHESTRATOR = createScanOrchestrator({ stageExecutors: DEFAULT_STAGE_EXECUTORS });

// Re-export all public types and utilities
export { ORCHESTRATOR_VERSION } from './version.js';
export {
  LIFECYCLE_STAGES, SCAN_STATUSES, ORCHESTRATOR_EVENTS,
  ORCHESTRATOR_ERROR_CODES, LIFECYCLE_STAGE_ORDER,
  TERMINAL_STAGES, STAGE_EXECUTOR_MAP, EXECUTOR_KEYS,
} from './types.js';
export { VALID_TRANSITIONS, isValidTransition, isTerminalStage, deriveStatus } from './lifecycle.js';
export { createScanState, transitionState, markCancelRequested } from './state.js';
export { createScanEvent, createEventEmitter } from './events.js';
export { createScanQueue } from './queue.js';
export { createScanScheduler } from './scheduler.js';
export { getPipelineStageDefs } from './pipeline.js';
export { validateScanRequest, validateStageExecutors, validatePipelineOrder, validateLifecycleTransition, validateScanState } from './validate.js';
