// Canonical Intelligence Platform(tm) -- Timeline Engine(tm)
// Generates ordered immutable Timeline Events(tm) from a ComparisonResult.
// Timeline is sorted by severity (highest first) then timestamp (newest first).

import { CHANGE_TYPES, SEVERITY_PRIORITY_ORDER } from './types.js';
import { buildTimelineEventFromChange } from './events.js';

const SEVERITY_RANK = new Map(SEVERITY_PRIORITY_ORDER.map((s, i) => [s, i]));

function severityRank(severity) {
  return SEVERITY_RANK.has(severity) ? SEVERITY_RANK.get(severity) : SEVERITY_PRIORITY_ORDER.length;
}

export function generateTimeline(comparisonResult, currentSnapshot) {
  if (!comparisonResult || !comparisonResult.changes) return Object.freeze([]);

  // Only ADDED / REMOVED / MODIFIED produce Timeline Events — UNCHANGED is silent
  const actionableChanges = comparisonResult.changes.filter(
    c => c.changeType !== CHANGE_TYPES.UNCHANGED
  );

  const events = actionableChanges.map(change =>
    buildTimelineEventFromChange(change, currentSnapshot)
  );

  return Object.freeze(sortTimeline(events));
}

export function sortTimeline(events) {
  return [...events].sort((a, b) => {
    const sevDiff = severityRank(a.severity) - severityRank(b.severity);
    if (sevDiff !== 0) return sevDiff;
    // Newest first within same severity
    return b.timestamp < a.timestamp ? -1 : b.timestamp > a.timestamp ? 1 : 0;
  });
}

export function filterTimeline(events, { domain, severity, changeType, limit } = {}) {
  let filtered = events;
  if (domain)     filtered = filtered.filter(e => e.domain === domain);
  if (severity)   filtered = filtered.filter(e => e.severity === severity);
  if (changeType) filtered = filtered.filter(e => e.changeType === changeType);
  if (limit && limit > 0) filtered = filtered.slice(0, limit);
  return Object.freeze(filtered);
}

export function mergeTimelines(timelines) {
  const merged = [].concat(...timelines);
  return Object.freeze(sortTimeline(merged));
}
