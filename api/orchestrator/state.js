// Canonical Intelligence Platform(tm) -- Scan State(tm)
// Immutable. Each transition produces a new frozen state; inputs are never mutated.

import { randomUUID } from 'crypto';
import { LIFECYCLE_STAGES, SCAN_STATUSES } from './types.js';
import { isValidTransition, deriveStatus } from './lifecycle.js';
import { ORCHESTRATOR_VERSION } from './version.js';

export function createScanState({ scanId, scanRequest, metadata } = {}) {
  const now = new Date().toISOString();
  return Object.freeze({
    scanId:           scanId          ?? randomUUID(),
    status:           SCAN_STATUSES.PENDING,
    lifecycleStage:   LIFECYCLE_STAGES.SCAN_REQUESTED,
    lifecycleHistory: Object.freeze([]),
    startedAt:        null,
    completedAt:      null,
    failedAt:         null,
    cancelledAt:      null,
    timedOutAt:       null,
    error:            null,
    cancelRequested:  false,
    scanRequest:      Object.freeze({ ...(scanRequest ?? {}) }),
    stageResults:     Object.freeze({}),
    metadata:         Object.freeze({ ...(metadata ?? {}) }),
    engineVersion:    ORCHESTRATOR_VERSION.version,
    createdAt:        now,
    updatedAt:        now,
  });
}

export function transitionState(state, nextStage, options = {}) {
  if (!isValidTransition(state.lifecycleStage, nextStage)) {
    throw new Error(
      `[orchestrator-state] Invalid lifecycle transition: ${state.lifecycleStage} → ${nextStage}`
    );
  }

  const now     = new Date().toISOString();
  const newStatus = deriveStatus(nextStage);

  const historyEntry = Object.freeze({
    stage:      state.lifecycleStage,
    status:     state.status,
    enteredAt:  state.updatedAt,
    exitedAt:   now,
  });

  const newHistory = Object.freeze([...state.lifecycleHistory, historyEntry]);

  // Merge any stage result provided via options.stageResult
  const newStageResults = options.stageResult
    ? Object.freeze({ ...state.stageResults, [nextStage]: Object.freeze(options.stageResult) })
    : state.stageResults;

  return Object.freeze({
    ...state,
    status:           newStatus,
    lifecycleStage:   nextStage,
    lifecycleHistory: newHistory,
    stageResults:     newStageResults,
    startedAt:        (state.startedAt === null && newStatus === 'RUNNING') ? now : state.startedAt,
    completedAt:      newStatus === 'COMPLETED'  ? now : state.completedAt,
    failedAt:         newStatus === 'FAILED'     ? now : state.failedAt,
    cancelledAt:      newStatus === 'CANCELLED'  ? now : state.cancelledAt,
    timedOutAt:       newStatus === 'TIMED_OUT'  ? now : state.timedOutAt,
    error:            options.error  ?? state.error,
    cancelRequested:  options.cancelRequested ?? state.cancelRequested,
    updatedAt:        now,
  });
}

export function markCancelRequested(state) {
  return Object.freeze({ ...state, cancelRequested: true, updatedAt: new Date().toISOString() });
}
