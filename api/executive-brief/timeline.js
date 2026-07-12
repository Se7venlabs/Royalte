// Canonical Intelligence Platform™ -- Executive Brief™ Timeline
// Extracts and sorts monitoring events and alerts from API response envelopes.
// Events are sorted newest-first. Alerts are sorted by severity then newest-first.

import { randomUUID } from 'node:crypto';

const SEVERITY_ORDER = Object.freeze({
  CRITICAL:      0,
  HIGH:          1,
  MEDIUM:        2,
  LOW:           3,
  INFORMATIONAL: 4,
});

function extractData(response) {
  return (response?.status === 'SUCCESS' && response?.data) ? response.data : {};
}

function eventTimestamp(event) {
  return event.timestamp || event.detectedAt || '';
}

export function buildTimeline(apiResponses = {}, _athenaReport = null) {
  const monitoring = extractData(apiResponses.monitoring);

  const rawEvents = Array.isArray(monitoring.timeline) ? monitoring.timeline : [];
  const rawAlerts = Array.isArray(monitoring.alerts)   ? monitoring.alerts   : [];

  const sortedEvents = [...rawEvents].sort((a, b) =>
    eventTimestamp(b).localeCompare(eventTimestamp(a))
  );

  const sortedAlerts = [...rawAlerts].sort((a, b) => {
    const sa = SEVERITY_ORDER[a.severity] ?? 99;
    const sb = SEVERITY_ORDER[b.severity] ?? 99;
    if (sa !== sb) return sa - sb;
    return eventTimestamp(b).localeCompare(eventTimestamp(a));
  });

  return Object.freeze({
    timelineId:      randomUUID(),
    generatedAt:     new Date().toISOString(),
    events:          Object.freeze(sortedEvents),
    alerts:          Object.freeze(sortedAlerts),
    totalEvents:     sortedEvents.length,
    totalAlerts:     sortedAlerts.length,
    criticalAlerts:  sortedAlerts.filter(a => a.severity === 'CRITICAL').length,
    highAlerts:      sortedAlerts.filter(a => a.severity === 'HIGH').length,
    latestEvent:     sortedEvents[0]  || null,
    latestAlert:     sortedAlerts[0]  || null,
    hasActiveAlerts: sortedAlerts.length > 0,
  });
}
