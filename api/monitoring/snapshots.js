// Canonical Intelligence Platform(tm) -- Canonical Snapshot(tm)
// Every completed scan produces one immutable Canonical Snapshot(tm).
// Snapshots are never modified after creation.

import { randomUUID } from 'crypto';
import { MONITORING_ENGINE_VERSION } from './version.js';
import { SNAPSHOT_REQUIRED_FIELDS, MONITORING_ERROR_CODES } from './types.js';

function deepFreeze(obj) {
  if (obj === null || typeof obj !== 'object') return obj;
  Object.freeze(obj);
  for (const key of Object.getOwnPropertyNames(obj)) {
    const val = obj[key];
    if (val && typeof val === 'object' && !Object.isFrozen(val)) {
      deepFreeze(val);
    }
  }
  return obj;
}

export function createSnapshot({
  snapshotId,
  scanId,
  artistId,
  timestamp,
  canonicalDomains,
  engineVersions,
  scanDuration,
  createdAt,
}) {
  for (const field of SNAPSHOT_REQUIRED_FIELDS) {
    const val = { snapshotId, scanId, artistId, timestamp, canonicalDomains, engineVersions, scanDuration, createdAt }[field];
    if (val === undefined || val === null) {
      const err = new Error(`Snapshot missing required field: ${field}`);
      err.code = MONITORING_ERROR_CODES.INVALID_SNAPSHOT;
      throw err;
    }
  }
  if (typeof canonicalDomains !== 'object' || Array.isArray(canonicalDomains)) {
    const err = new Error('canonicalDomains must be a plain object');
    err.code = MONITORING_ERROR_CODES.INVALID_SNAPSHOT;
    throw err;
  }

  return deepFreeze({
    snapshotId,
    scanId,
    artistId,
    timestamp,
    canonicalDomains,
    engineVersions:  engineVersions || {},
    scanDuration:    typeof scanDuration === 'number' ? scanDuration : 0,
    createdAt,
    monitoringEngineVersion: MONITORING_ENGINE_VERSION.version,
  });
}

export function buildSnapshotFromScanResult({
  scanId,
  artistId,
  canonicalDomains,
  engineVersions = {},
  scanDuration   = 0,
  timestamp,
} = {}) {
  return createSnapshot({
    snapshotId:       randomUUID(),
    scanId:           scanId || randomUUID(),
    artistId,
    timestamp:        timestamp || new Date().toISOString(),
    canonicalDomains: canonicalDomains || {},
    engineVersions,
    scanDuration,
    createdAt:        new Date().toISOString(),
  });
}
