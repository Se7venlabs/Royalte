// Canonical Intelligence Platform(tm) -- Change Detection Engine(tm)
// Compares two immutable Canonical Snapshots(tm) and produces a deterministic ComparisonResult.
// Every comparison is replayable: same snapshot pair produces identical change classifications.

import { randomUUID } from 'crypto';
import { CHANGE_TYPES, MONITORING_ERROR_CODES } from './types.js';
import { classifyChangeSeverity } from './severity.js';
import { MONITORING_ENGINE_VERSION } from './version.js';

// Flatten a nested object into a map of dotted-path → leaf value.
// Arrays are treated as leaf values (compared as JSON strings).
function flattenObject(obj, prefix = '') {
  if (obj === null || obj === undefined) {
    return prefix ? { [prefix]: obj } : {};
  }
  if (typeof obj !== 'object' || Array.isArray(obj)) {
    return prefix ? { [prefix]: obj } : {};
  }

  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value !== null && value !== undefined && typeof value === 'object' && !Array.isArray(value)) {
      Object.assign(result, flattenObject(value, path));
    } else {
      result[path] = value;
    }
  }
  return result;
}

// Deterministic equality check for any value type.
function valuesEqual(a, b) {
  if (a === b) return true;
  if (a === null || b === null) return false;
  if (a === undefined || b === undefined) return false;
  if (typeof a !== typeof b) return false;
  if (typeof a === 'object') return JSON.stringify(a) === JSON.stringify(b);
  return false;
}

// Extract domain (first segment) and field (last segment) from a dotted path.
function parsePath(fieldPath) {
  const parts = fieldPath.split('.');
  return {
    domain: parts[0] || 'system',
    field:  parts[parts.length - 1] || fieldPath,
  };
}

export function compareSnapshots(previousSnapshot, currentSnapshot) {
  if (!previousSnapshot || !previousSnapshot.snapshotId) {
    const err = new Error('previousSnapshot is required and must have a snapshotId');
    err.code = MONITORING_ERROR_CODES.INVALID_SNAPSHOT;
    throw err;
  }
  if (!currentSnapshot || !currentSnapshot.snapshotId) {
    const err = new Error('currentSnapshot is required and must have a snapshotId');
    err.code = MONITORING_ERROR_CODES.INVALID_SNAPSHOT;
    throw err;
  }
  if (previousSnapshot.snapshotId === currentSnapshot.snapshotId) {
    const err = new Error('Cannot compare a snapshot to itself');
    err.code = MONITORING_ERROR_CODES.COMPARISON_FAILED;
    throw err;
  }

  const prevFlat = flattenObject(previousSnapshot.canonicalDomains);
  const currFlat = flattenObject(currentSnapshot.canonicalDomains);

  const prevKeys = new Set(Object.keys(prevFlat));
  const currKeys = new Set(Object.keys(currFlat));

  const comparisonId = randomUUID();
  const changes = [];
  let unchangedCount = 0;

  // Added — present in current, absent in previous
  for (const path of currKeys) {
    if (!prevKeys.has(path)) {
      const { domain, field } = parsePath(path);
      changes.push(Object.freeze({
        changeId:           randomUUID(),
        comparisonId,
        domain,
        field,
        fieldPath:          path,
        changeType:         CHANGE_TYPES.ADDED,
        oldValue:           undefined,
        newValue:           currFlat[path],
        severity:           classifyChangeSeverity(domain, field),
        previousSnapshotId: previousSnapshot.snapshotId,
        currentSnapshotId:  currentSnapshot.snapshotId,
      }));
    }
  }

  // Removed — present in previous, absent in current
  for (const path of prevKeys) {
    if (!currKeys.has(path)) {
      const { domain, field } = parsePath(path);
      changes.push(Object.freeze({
        changeId:           randomUUID(),
        comparisonId,
        domain,
        field,
        fieldPath:          path,
        changeType:         CHANGE_TYPES.REMOVED,
        oldValue:           prevFlat[path],
        newValue:           undefined,
        severity:           classifyChangeSeverity(domain, field),
        previousSnapshotId: previousSnapshot.snapshotId,
        currentSnapshotId:  currentSnapshot.snapshotId,
      }));
    }
  }

  // Modified or Unchanged — present in both
  for (const path of currKeys) {
    if (prevKeys.has(path)) {
      if (!valuesEqual(prevFlat[path], currFlat[path])) {
        const { domain, field } = parsePath(path);
        changes.push(Object.freeze({
          changeId:           randomUUID(),
          comparisonId,
          domain,
          field,
          fieldPath:          path,
          changeType:         CHANGE_TYPES.MODIFIED,
          oldValue:           prevFlat[path],
          newValue:           currFlat[path],
          severity:           classifyChangeSeverity(domain, field),
          previousSnapshotId: previousSnapshot.snapshotId,
          currentSnapshotId:  currentSnapshot.snapshotId,
        }));
      } else {
        unchangedCount++;
      }
    }
  }

  const added    = changes.filter(c => c.changeType === CHANGE_TYPES.ADDED).length;
  const removed  = changes.filter(c => c.changeType === CHANGE_TYPES.REMOVED).length;
  const modified = changes.filter(c => c.changeType === CHANGE_TYPES.MODIFIED).length;

  return Object.freeze({
    comparisonId,
    previousSnapshotId: previousSnapshot.snapshotId,
    currentSnapshotId:  currentSnapshot.snapshotId,
    artistId:           currentSnapshot.artistId,
    timestamp:          new Date().toISOString(),
    changes:            Object.freeze(changes),
    summary: Object.freeze({
      added,
      removed,
      modified,
      unchanged:  unchangedCount,
      total:      changes.length,
    }),
    engineVersion: MONITORING_ENGINE_VERSION.version,
  });
}

// Exported for testing — exposes the flattening logic.
export { flattenObject, valuesEqual };
