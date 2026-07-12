// Canonical Intelligence Platform(tm) -- Monitoring & Change Detection Engine(tm)
// Public API. The sole entrypoint for all monitoring operations.
// Monitoring observes Canonical Intelligence. It never creates or modifies it.

import { MONITORING_ENGINE_VERSION } from './version.js';
import { buildSnapshotFromScanResult, createSnapshot } from './snapshots.js';
import { compareSnapshots as compareSnapshotsFn } from './change-engine.js';
import { generateTimeline, filterTimeline, mergeTimelines } from './timeline.js';
import { generateAlertsFromTimeline } from './alerts.js';
import { createHistoryStore } from './history.js';
import { validateSnapshot, validateComparison, validateTimelineEvent, validateAlert, validateTimelineOrdering, assertSnapshotIntegrity, assertComparisonIntegrity } from './validate.js';
import { classifyChangeSeverity } from './severity.js';

export function createMonitoringEngine({ historyStore } = {}) {
  const store = historyStore || createHistoryStore();

  function recordScan({
    scanId,
    artistId,
    canonicalDomains,
    engineVersions,
    scanDuration,
    timestamp,
  } = {}) {
    // 1. Build an immutable Canonical Snapshot(tm)
    const snapshot = buildSnapshotFromScanResult({
      scanId,
      artistId,
      canonicalDomains: canonicalDomains || {},
      engineVersions:   engineVersions   || {},
      scanDuration:     scanDuration      || 0,
      timestamp,
    });

    // 2. Persist snapshot — throws on duplicate scanId collision
    store.addSnapshot(snapshot);

    // 3. Look up the snapshot immediately preceding this one for this artist
    const previousSnapshot = store.getPreviousSnapshot(artistId, snapshot.snapshotId);

    // 4. First scan — no comparison possible
    if (!previousSnapshot) {
      return Object.freeze({
        success:          true,
        firstScan:        true,
        snapshot,
        comparison:       null,
        timeline:         Object.freeze([]),
        alerts:           Object.freeze([]),
        changeCount:      0,
      });
    }

    // 5. Compare previous ↔ current snapshot
    const comparison = compareSnapshotsFn(previousSnapshot, snapshot);
    store.addComparison(comparison);

    // 6. Generate timeline events
    const timeline = generateTimeline(comparison, snapshot);
    store.addTimelineEvents(artistId, timeline);

    // 7. Generate alerts
    const alerts = generateAlertsFromTimeline(timeline, snapshot);
    store.addAlerts(artistId, alerts);

    return Object.freeze({
      success:          true,
      firstScan:        false,
      snapshot,
      comparison,
      timeline,
      alerts,
      changeCount:      comparison.summary.total,
    });
  }

  function getTimeline(artistId, opts) {
    return store.getTimelineEvents(artistId, opts || {});
  }

  function getLatestChanges(artistId) {
    const snapshots = store.listSnapshots(artistId);
    if (snapshots.length < 2) return null;
    const current  = snapshots[snapshots.length - 1];
    const previous = snapshots[snapshots.length - 2];
    return compareSnapshotsFn(previous, current);
  }

  function getAlerts(artistId, opts) {
    return store.getAlerts(artistId, opts || {});
  }

  function getSnapshot(snapshotId) {
    return store.getSnapshot(snapshotId);
  }

  function getHistory(artistId) {
    return store.listSnapshots(artistId);
  }

  function compareSnapshots(previous, current) {
    return compareSnapshotsFn(previous, current);
  }

  return Object.freeze({
    recordScan,
    getTimeline,
    getLatestChanges,
    getAlerts,
    getSnapshot,
    compareSnapshots,
    getHistory,
    engineVersion: MONITORING_ENGINE_VERSION,
  });
}

export const MONITORING_ENGINE = createMonitoringEngine();

// ─── Re-exports ───────────────────────────────────────────────────────────────

export { MONITORING_ENGINE_VERSION }                              from './version.js';
export {
  CHANGE_TYPES,
  SEVERITY_LEVELS,
  ALERT_LEVELS,
  MONITORING_DOMAINS,
  MONITORING_EVENT_TYPES,
  MONITORING_ERROR_CODES,
  SNAPSHOT_REQUIRED_FIELDS,
  TIMELINE_EVENT_REQUIRED_FIELDS,
  ALERT_REQUIRED_FIELDS,
  SEVERITY_PRIORITY_ORDER,
  VALID_CHANGE_TYPES,
  VALID_SEVERITY_LEVELS,
  VALID_ALERT_LEVELS,
  VALID_MONITORING_DOMAINS,
}                                                                 from './types.js';
export { classifyChangeSeverity, DOMAIN_FIELD_SEVERITY }          from './severity.js';
export { createSnapshot, buildSnapshotFromScanResult }            from './snapshots.js';
export { compareSnapshots, flattenObject, valuesEqual }           from './change-engine.js';
export { createTimelineEvent, buildTimelineEventFromChange }      from './events.js';
export { generateTimeline, sortTimeline, filterTimeline, mergeTimelines } from './timeline.js';
export { createAlert, generateAlertsFromTimeline }                from './alerts.js';
export { createHistoryStore }                                     from './history.js';
export {
  validateSnapshot,
  validateComparison,
  validateTimelineEvent,
  validateAlert,
  validateTimelineOrdering,
  assertSnapshotIntegrity,
  assertComparisonIntegrity,
}                                                                 from './validate.js';
