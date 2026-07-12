// Canonical Intelligence Platform(tm) -- Orchestrator Validation

import {
  LIFECYCLE_STAGE_ORDER, EXECUTOR_KEYS, TERMINAL_STAGES,
  ORCHESTRATOR_ERROR_CODES,
} from './types.js';
import { VALID_TRANSITIONS } from './lifecycle.js';

export function validateScanRequest(request) {
  const errors = [];
  if (!request || typeof request !== 'object') {
    return [{ code: ORCHESTRATOR_ERROR_CODES.INVALID_SCAN_REQUEST, field: 'request', message: 'Scan request must be a non-null object' }];
  }
  if (!request.artistId && !request.artistName && !request.url) {
    errors.push({ code: ORCHESTRATOR_ERROR_CODES.INVALID_SCAN_REQUEST, field: 'target', message: 'Scan request must include artistId, artistName, or url' });
  }
  return errors;
}

export function validateStageExecutors(executors) {
  const errors = [];
  if (!executors || typeof executors !== 'object') {
    return [{ code: ORCHESTRATOR_ERROR_CODES.EXECUTOR_NOT_FOUND, field: 'executors', message: 'Stage executors must be a non-null object' }];
  }
  for (const key of EXECUTOR_KEYS) {
    if (typeof executors[key] !== 'function') {
      errors.push({ code: ORCHESTRATOR_ERROR_CODES.EXECUTOR_NOT_FOUND, field: key, message: `Missing executor: ${key}` });
    }
  }
  return errors;
}

export function validatePipelineOrder(stageNames) {
  const errors = [];
  if (!Array.isArray(stageNames)) {
    return [{ code: ORCHESTRATOR_ERROR_CODES.PIPELINE_ORDER_VIOLATION, message: 'stageNames must be an array' }];
  }
  const orderedHappyPath = LIFECYCLE_STAGE_ORDER.filter(s => stageNames.includes(s));
  for (let i = 0; i < orderedHappyPath.length; i++) {
    if (orderedHappyPath[i] !== stageNames.filter(s => LIFECYCLE_STAGE_ORDER.includes(s))[i]) {
      errors.push({ code: ORCHESTRATOR_ERROR_CODES.PIPELINE_ORDER_VIOLATION, message: `Stage order violation at position ${i}: expected ${orderedHappyPath[i]}` });
    }
  }
  return errors;
}

export function validateLifecycleTransition(fromStage, toStage) {
  const allowed = VALID_TRANSITIONS[fromStage];
  if (!allowed) {
    return [{ code: ORCHESTRATOR_ERROR_CODES.INVALID_STATE_TRANSITION, message: `Unknown source stage: ${fromStage}` }];
  }
  if (!allowed.includes(toStage)) {
    return [{ code: ORCHESTRATOR_ERROR_CODES.INVALID_STATE_TRANSITION, message: `Invalid transition: ${fromStage} → ${toStage}` }];
  }
  return [];
}

export function validateScanState(state) {
  const errors = [];
  if (!state || typeof state !== 'object') {
    return [{ code: ORCHESTRATOR_ERROR_CODES.INVALID_SCAN_REQUEST, message: 'Scan state must be a non-null object' }];
  }
  if (!state.scanId) errors.push({ field: 'scanId',         message: 'Missing scanId' });
  if (!state.status) errors.push({ field: 'status',         message: 'Missing status' });
  if (!state.lifecycleStage) errors.push({ field: 'lifecycleStage', message: 'Missing lifecycleStage' });
  if (!Array.isArray(state.lifecycleHistory)) errors.push({ field: 'lifecycleHistory', message: 'lifecycleHistory must be an array' });
  return errors;
}
