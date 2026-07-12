// Canonical Intelligence Platform(tm) -- Monitoring Validation

import {
  SNAPSHOT_REQUIRED_FIELDS,
  TIMELINE_EVENT_REQUIRED_FIELDS,
  ALERT_REQUIRED_FIELDS,
  MONITORING_ERROR_CODES,
  VALID_CHANGE_TYPES,
  VALID_SEVERITY_LEVELS,
  VALID_ALERT_LEVELS,
} from './types.js';

function checkRequired(obj, fields, label) {
  const errors = [];
  for (const f of fields) {
    if (obj[f] === undefined || obj[f] === null) {
      errors.push(`${label} missing required field: ${f}`);
    }
  }
  return errors;
}

export function validateSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== 'object') {
    return { valid: false, errors: ['snapshot must be a non-null object'] };
  }
  const errors = checkRequired(snapshot, SNAPSHOT_REQUIRED_FIELDS, 'Snapshot');
  if (snapshot.canonicalDomains !== undefined && (typeof snapshot.canonicalDomains !== 'object' || Array.isArray(snapshot.canonicalDomains))) {
    errors.push('canonicalDomains must be a plain object');
  }
  return { valid: errors.length === 0, errors };
}

export function validateComparison(comparison) {
  if (!comparison || typeof comparison !== 'object') {
    return { valid: false, errors: ['comparison must be a non-null object'] };
  }
  const required = ['comparisonId', 'previousSnapshotId', 'currentSnapshotId', 'artistId', 'timestamp', 'changes', 'summary', 'engineVersion'];
  const errors = checkRequired(comparison, required, 'Comparison');
  if (comparison.changes !== undefined && !Array.isArray(comparison.changes)) {
    errors.push('comparison.changes must be an array');
  }
  if (comparison.summary) {
    for (const f of ['added', 'removed', 'modified', 'unchanged', 'total']) {
      if (typeof comparison.summary[f] !== 'number') errors.push(`comparison.summary.${f} must be a number`);
    }
  }
  return { valid: errors.length === 0, errors };
}

export function validateTimelineEvent(event) {
  if (!event || typeof event !== 'object') {
    return { valid: false, errors: ['event must be a non-null object'] };
  }
  const errors = checkRequired(event, TIMELINE_EVENT_REQUIRED_FIELDS, 'TimelineEvent');
  if (event.changeType && !VALID_CHANGE_TYPES.has(event.changeType)) {
    errors.push(`Invalid changeType: ${event.changeType}`);
  }
  if (event.severity && !VALID_SEVERITY_LEVELS.has(event.severity)) {
    errors.push(`Invalid severity: ${event.severity}`);
  }
  return { valid: errors.length === 0, errors };
}

export function validateAlert(alert) {
  if (!alert || typeof alert !== 'object') {
    return { valid: false, errors: ['alert must be a non-null object'] };
  }
  const errors = checkRequired(alert, ALERT_REQUIRED_FIELDS, 'Alert');
  if (alert.level && !VALID_ALERT_LEVELS.has(alert.level)) {
    errors.push(`Invalid alert level: ${alert.level}`);
  }
  return { valid: errors.length === 0, errors };
}

export function validateTimelineOrdering(events) {
  const errors = [];
  if (!Array.isArray(events)) return { valid: false, errors: ['events must be an array'] };
  for (let i = 0; i < events.length; i++) {
    if (!events[i].timestamp) errors.push(`Event at index ${i} missing timestamp`);
    if (!events[i].eventId)   errors.push(`Event at index ${i} missing eventId`);
  }
  return { valid: errors.length === 0, errors };
}

export function assertSnapshotIntegrity(snapshot) {
  const { valid, errors } = validateSnapshot(snapshot);
  if (!valid) {
    const err = new Error(`Snapshot integrity failure: ${errors.join('; ')}`);
    err.code = MONITORING_ERROR_CODES.INVALID_SNAPSHOT;
    throw err;
  }
}

export function assertComparisonIntegrity(comparison) {
  const { valid, errors } = validateComparison(comparison);
  if (!valid) {
    const err = new Error(`Comparison integrity failure: ${errors.join('; ')}`);
    err.code = MONITORING_ERROR_CODES.INVALID_COMPARISON;
    throw err;
  }
}
