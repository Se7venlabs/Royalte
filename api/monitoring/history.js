// Canonical Intelligence Platform(tm) -- Monitoring History Store
// Immutable append-only store for Canonical Snapshots(tm), comparisons, Timeline Events(tm), and Alerts.
// History entries are never modified after insertion.

import { MONITORING_ERROR_CODES } from './types.js';

export function createHistoryStore() {
  // snapshotId → snapshot
  const snapshots    = new Map();
  // comparisonId → comparison
  const comparisons  = new Map();
  // artistId → TimelineEvent[] (chronological, newest last)
  const eventsByArtist = new Map();
  // artistId → Alert[] (chronological, newest last)
  const alertsByArtist = new Map();
  // artistId → snapshotId[] (ordered insertion time, newest last)
  const snapshotOrder  = new Map();

  function addSnapshot(snapshot) {
    if (!snapshot || !snapshot.snapshotId) {
      const err = new Error('addSnapshot: snapshot must have a snapshotId');
      err.code = MONITORING_ERROR_CODES.INVALID_SNAPSHOT;
      throw err;
    }
    if (snapshots.has(snapshot.snapshotId)) {
      const err = new Error(`Duplicate snapshotId: ${snapshot.snapshotId}`);
      err.code = MONITORING_ERROR_CODES.DUPLICATE_SNAPSHOT;
      throw err;
    }
    snapshots.set(snapshot.snapshotId, snapshot);
    const { artistId } = snapshot;
    if (!snapshotOrder.has(artistId)) snapshotOrder.set(artistId, []);
    snapshotOrder.get(artistId).push(snapshot.snapshotId);
    return snapshot;
  }

  function getSnapshot(snapshotId) {
    return snapshots.get(snapshotId) || null;
  }

  function getLatestSnapshot(artistId) {
    const order = snapshotOrder.get(artistId);
    if (!order || !order.length) return null;
    return snapshots.get(order[order.length - 1]) || null;
  }

  function getPreviousSnapshot(artistId, currentSnapshotId) {
    const order = snapshotOrder.get(artistId);
    if (!order || order.length < 2) return null;
    const idx = order.indexOf(currentSnapshotId);
    if (idx <= 0) return null;
    return snapshots.get(order[idx - 1]) || null;
  }

  function listSnapshots(artistId) {
    const order = snapshotOrder.get(artistId);
    if (!order) return Object.freeze([]);
    return Object.freeze(order.map(id => snapshots.get(id)).filter(Boolean));
  }

  function addComparison(comparison) {
    if (!comparison || !comparison.comparisonId) {
      const err = new Error('addComparison: comparison must have a comparisonId');
      err.code = MONITORING_ERROR_CODES.INVALID_COMPARISON;
      throw err;
    }
    comparisons.set(comparison.comparisonId, comparison);
    return comparison;
  }

  function getComparison(comparisonId) {
    return comparisons.get(comparisonId) || null;
  }

  function addTimelineEvents(artistId, events) {
    if (!artistId) throw new Error('addTimelineEvents: artistId required');
    if (!Array.isArray(events)) throw new Error('addTimelineEvents: events must be an array');
    if (!eventsByArtist.has(artistId)) eventsByArtist.set(artistId, []);
    const list = eventsByArtist.get(artistId);
    for (const e of events) list.push(e);
    return events;
  }

  function getTimelineEvents(artistId, { domain, severity, changeType, limit, sinceSnapshotId } = {}) {
    let events = eventsByArtist.get(artistId) || [];
    if (domain)     events = events.filter(e => e.domain === domain);
    if (severity)   events = events.filter(e => e.severity === severity);
    if (changeType) events = events.filter(e => e.changeType === changeType);
    if (sinceSnapshotId) {
      const snap = snapshots.get(sinceSnapshotId);
      if (snap) {
        const since = snap.timestamp;
        events = events.filter(e => e.timestamp >= since);
      }
    }
    if (limit && limit > 0) events = events.slice(-limit);
    return Object.freeze([...events]);
  }

  function addAlerts(artistId, alerts) {
    if (!artistId) throw new Error('addAlerts: artistId required');
    if (!Array.isArray(alerts)) throw new Error('addAlerts: alerts must be an array');
    if (!alertsByArtist.has(artistId)) alertsByArtist.set(artistId, []);
    const list = alertsByArtist.get(artistId);
    for (const a of alerts) list.push(a);
    return alerts;
  }

  function getAlerts(artistId, { level, domain, limit } = {}) {
    let alerts = alertsByArtist.get(artistId) || [];
    if (level)  alerts = alerts.filter(a => a.level === level);
    if (domain) alerts = alerts.filter(a => a.domain === domain);
    if (limit && limit > 0) alerts = alerts.slice(-limit);
    return Object.freeze([...alerts]);
  }

  function snapshotCount()   { return snapshots.size; }
  function comparisonCount() { return comparisons.size; }
  function artistCount()     { return snapshotOrder.size; }

  function clear() {
    snapshots.clear();
    comparisons.clear();
    eventsByArtist.clear();
    alertsByArtist.clear();
    snapshotOrder.clear();
  }

  return Object.freeze({
    addSnapshot,
    getSnapshot,
    getLatestSnapshot,
    getPreviousSnapshot,
    listSnapshots,
    addComparison,
    getComparison,
    addTimelineEvents,
    getTimelineEvents,
    addAlerts,
    getAlerts,
    snapshotCount,
    comparisonCount,
    artistCount,
    clear,
  });
}
