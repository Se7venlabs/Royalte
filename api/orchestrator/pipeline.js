// Canonical Intelligence Platform(tm) -- Pipeline Coordinator(tm)
// Coordinates execution of every stage in the correct constitutional order.
// Never performs evidence collection, normalization, resolution, or domain logic.
// Never throws — all failures are returned as terminal scan state.

import { LIFECYCLE_STAGES, ORCHESTRATOR_EVENTS, ORCHESTRATOR_ERROR_CODES } from './types.js';
import { transitionState } from './state.js';
import { isValidTransition } from './lifecycle.js';

// Constitutional pipeline stage definitions — order is locked.
// Each stage entry: { executorKey, startStage (optional), endStage }
// startStage: lifecycle stage to transition to BEFORE running the executor (progress marker).
// endStage:   lifecycle stage to transition to AFTER the executor succeeds.
const PIPELINE_STAGE_DEFS = Object.freeze([
  {
    executorKey: 'connectors',
    startStage:  LIFECYCLE_STAGES.CONNECTORS_STARTED,    // visible "in progress" marker
    endStage:    LIFECYCLE_STAGES.EVIDENCE_COLLECTED,
    startEvent:  ORCHESTRATOR_EVENTS.CONNECTORS_STARTED,
    endEvent:    ORCHESTRATOR_EVENTS.EVIDENCE_COLLECTED,
    errorCode:   ORCHESTRATOR_ERROR_CODES.CONNECTOR_FAILURE,
  },
  {
    executorKey: 'registry',
    startStage:  null,
    endStage:    LIFECYCLE_STAGES.REGISTRY_COMPLETE,
    startEvent:  ORCHESTRATOR_EVENTS.PIPELINE_STAGE_STARTED,
    endEvent:    ORCHESTRATOR_EVENTS.REGISTRY_COMPLETE,
    errorCode:   ORCHESTRATOR_ERROR_CODES.REGISTRY_FAILURE,
  },
  {
    executorKey: 'normalization',
    startStage:  null,
    endStage:    LIFECYCLE_STAGES.NORMALIZATION_COMPLETE,
    startEvent:  ORCHESTRATOR_EVENTS.PIPELINE_STAGE_STARTED,
    endEvent:    ORCHESTRATOR_EVENTS.NORMALIZATION_COMPLETE,
    errorCode:   ORCHESTRATOR_ERROR_CODES.NORMALIZATION_FAILURE,
  },
  {
    executorKey: 'resolution',
    startStage:  null,
    endStage:    LIFECYCLE_STAGES.RESOLUTION_COMPLETE,
    startEvent:  ORCHESTRATOR_EVENTS.PIPELINE_STAGE_STARTED,
    endEvent:    ORCHESTRATOR_EVENTS.RESOLUTION_COMPLETE,
    errorCode:   ORCHESTRATOR_ERROR_CODES.RESOLUTION_FAILURE,
  },
  {
    executorKey: 'domains',
    startStage:  null,
    endStage:    LIFECYCLE_STAGES.DOMAINS_REFRESHED,
    startEvent:  ORCHESTRATOR_EVENTS.PIPELINE_STAGE_STARTED,
    endEvent:    ORCHESTRATOR_EVENTS.DOMAINS_REFRESHED,
    errorCode:   ORCHESTRATOR_ERROR_CODES.DOMAIN_REFRESH_FAILURE,
  },
]);

export function getPipelineStageDefs() {
  return PIPELINE_STAGE_DEFS;
}

function withTimeout(promise, ms) {
  if (!ms || ms <= 0) return promise;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(Object.assign(new Error(`[orchestrator] Stage timed out after ${ms}ms`), { code: ORCHESTRATOR_ERROR_CODES.PIPELINE_TIMEOUT }));
    }, ms);
    promise.then(
      result => { clearTimeout(timer); resolve(result); },
      error  => { clearTimeout(timer); reject(error); }
    );
  });
}

export async function executePipeline({ initialState, stageExecutors, emitter, queue, stageTimeout }) {
  let state = initialState;

  // Emit SCAN_REQUESTED
  emitter.emit(ORCHESTRATOR_EVENTS.SCAN_REQUESTED, null, state.scanId, LIFECYCLE_STAGES.SCAN_REQUESTED);

  for (const stageDef of PIPELINE_STAGE_DEFS) {
    // Check cancellation before each stage
    const current = queue.get(state.scanId);
    if (current?.cancelRequested) {
      state = transitionState(state, LIFECYCLE_STAGES.SCAN_CANCELLED, {
        error: { code: ORCHESTRATOR_ERROR_CODES.CANCELLATION_REQUESTED, message: 'Scan cancelled by request' },
      });
      queue.update(state.scanId, state);
      emitter.emit(ORCHESTRATOR_EVENTS.SCAN_CANCELLED, null, state.scanId, LIFECYCLE_STAGES.SCAN_CANCELLED);
      return state;
    }

    // Optional start-stage transition (e.g. CONNECTORS_STARTED)
    if (stageDef.startStage && isValidTransition(state.lifecycleStage, stageDef.startStage)) {
      state = transitionState(state, stageDef.startStage);
      queue.update(state.scanId, state);
      emitter.emit(stageDef.startEvent, null, state.scanId, stageDef.startStage);
    } else {
      // Emit a generic stage-started event for stages without a dedicated start-stage
      emitter.emit(stageDef.startEvent, { executorKey: stageDef.executorKey, targetStage: stageDef.endStage }, state.scanId, state.lifecycleStage);
    }

    // Execute the stage
    const executor = stageExecutors[stageDef.executorKey];
    if (typeof executor !== 'function') {
      state = transitionState(state, LIFECYCLE_STAGES.SCAN_FAILED, {
        error: { code: ORCHESTRATOR_ERROR_CODES.EXECUTOR_NOT_FOUND, message: `No executor for: ${stageDef.executorKey}` },
      });
      queue.update(state.scanId, state);
      emitter.emit(ORCHESTRATOR_EVENTS.PIPELINE_STAGE_FAILED, { errorCode: ORCHESTRATOR_ERROR_CODES.EXECUTOR_NOT_FOUND }, state.scanId, stageDef.endStage);
      emitter.emit(ORCHESTRATOR_EVENTS.SCAN_FAILED, null, state.scanId, LIFECYCLE_STAGES.SCAN_FAILED);
      return state;
    }

    let stageResult;
    try {
      stageResult = await withTimeout(
        executor({ scanId: state.scanId, stage: stageDef.endStage, request: state.scanRequest, previousResults: state.stageResults }),
        stageTimeout
      );
    } catch (err) {
      const isTimed = err?.code === ORCHESTRATOR_ERROR_CODES.PIPELINE_TIMEOUT;
      const terminalStage = isTimed ? LIFECYCLE_STAGES.SCAN_TIMED_OUT : LIFECYCLE_STAGES.SCAN_FAILED;
      const errorCode     = isTimed ? ORCHESTRATOR_ERROR_CODES.PIPELINE_TIMEOUT : stageDef.errorCode;
      state = transitionState(state, terminalStage, {
        error: { code: errorCode, message: err?.message ?? String(err) },
      });
      queue.update(state.scanId, state);
      emitter.emit(ORCHESTRATOR_EVENTS.PIPELINE_STAGE_FAILED, { errorCode, stage: stageDef.endStage, message: err?.message }, state.scanId, stageDef.endStage);
      emitter.emit(isTimed ? ORCHESTRATOR_EVENTS.SCAN_TIMED_OUT : ORCHESTRATOR_EVENTS.SCAN_FAILED, null, state.scanId, terminalStage);
      return state;
    }

    // Transition to end stage
    state = transitionState(state, stageDef.endStage, { stageResult });
    queue.update(state.scanId, state);
    emitter.emit(stageDef.endEvent, { stageResult }, state.scanId, stageDef.endStage);
    emitter.emit(ORCHESTRATOR_EVENTS.PIPELINE_STAGE_COMPLETED, { executorKey: stageDef.executorKey, stage: stageDef.endStage }, state.scanId, stageDef.endStage);
  }

  // All stages complete — transition to SCAN_COMPLETE
  state = transitionState(state, LIFECYCLE_STAGES.SCAN_COMPLETE);
  queue.update(state.scanId, state);
  emitter.emit(ORCHESTRATOR_EVENTS.SCAN_COMPLETED, null, state.scanId, LIFECYCLE_STAGES.SCAN_COMPLETE);
  return state;
}
