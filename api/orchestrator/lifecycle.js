// Canonical Intelligence Platform(tm) -- Scan Lifecycle(tm) State Machine

import { LIFECYCLE_STAGES, SCAN_STATUSES, TERMINAL_STAGES } from './types.js';

// Valid forward transitions for each lifecycle stage.
// Any stage may transition to terminal error stages.
const TERMINAL_ERRORS = [
  LIFECYCLE_STAGES.SCAN_FAILED,
  LIFECYCLE_STAGES.SCAN_CANCELLED,
  LIFECYCLE_STAGES.SCAN_TIMED_OUT,
];

export const VALID_TRANSITIONS = Object.freeze({
  [LIFECYCLE_STAGES.SCAN_REQUESTED]:        Object.freeze([LIFECYCLE_STAGES.CONNECTORS_STARTED,    ...TERMINAL_ERRORS]),
  [LIFECYCLE_STAGES.CONNECTORS_STARTED]:    Object.freeze([LIFECYCLE_STAGES.EVIDENCE_COLLECTED,    ...TERMINAL_ERRORS]),
  [LIFECYCLE_STAGES.EVIDENCE_COLLECTED]:    Object.freeze([LIFECYCLE_STAGES.REGISTRY_COMPLETE,     ...TERMINAL_ERRORS]),
  [LIFECYCLE_STAGES.REGISTRY_COMPLETE]:     Object.freeze([LIFECYCLE_STAGES.NORMALIZATION_COMPLETE,...TERMINAL_ERRORS]),
  [LIFECYCLE_STAGES.NORMALIZATION_COMPLETE]:Object.freeze([LIFECYCLE_STAGES.RESOLUTION_COMPLETE,   ...TERMINAL_ERRORS]),
  [LIFECYCLE_STAGES.RESOLUTION_COMPLETE]:   Object.freeze([LIFECYCLE_STAGES.DOMAINS_REFRESHED,     ...TERMINAL_ERRORS]),
  [LIFECYCLE_STAGES.DOMAINS_REFRESHED]:     Object.freeze([LIFECYCLE_STAGES.SCAN_COMPLETE,          LIFECYCLE_STAGES.SCAN_FAILED]),
  [LIFECYCLE_STAGES.SCAN_COMPLETE]:         Object.freeze([]),
  [LIFECYCLE_STAGES.SCAN_FAILED]:           Object.freeze([]),
  [LIFECYCLE_STAGES.SCAN_CANCELLED]:        Object.freeze([]),
  [LIFECYCLE_STAGES.SCAN_TIMED_OUT]:        Object.freeze([]),
});

export function isValidTransition(fromStage, toStage) {
  const allowed = VALID_TRANSITIONS[fromStage];
  if (!allowed) return false;
  return allowed.includes(toStage);
}

export function isTerminalStage(stage) {
  return TERMINAL_STAGES.has(stage);
}

// Derives the operational SCAN_STATUS from a lifecycle stage.
export function deriveStatus(stage) {
  switch (stage) {
    case LIFECYCLE_STAGES.SCAN_REQUESTED:  return SCAN_STATUSES.PENDING;
    case LIFECYCLE_STAGES.SCAN_COMPLETE:   return SCAN_STATUSES.COMPLETED;
    case LIFECYCLE_STAGES.SCAN_FAILED:     return SCAN_STATUSES.FAILED;
    case LIFECYCLE_STAGES.SCAN_CANCELLED:  return SCAN_STATUSES.CANCELLED;
    case LIFECYCLE_STAGES.SCAN_TIMED_OUT:  return SCAN_STATUSES.TIMED_OUT;
    default:                               return SCAN_STATUSES.RUNNING;
  }
}
