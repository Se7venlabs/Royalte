// Canonical Intelligence Platform(tm) -- Alert Engine(tm)
// Generates platform alerts from Timeline Events(tm).
// Alert generation is deterministic: same timeline events always produce the same alerts.

import { randomUUID } from 'crypto';
import { ALERT_LEVELS, ALERT_REQUIRED_FIELDS, MONITORING_ERROR_CODES, VALID_ALERT_LEVELS } from './types.js';

export function createAlert({
  alertId,
  level,
  domain,
  title,
  description,
  snapshotId,
  artistId,
  timestamp,
  timelineEventIds,
  changeCount,
}) {
  const payload = { alertId, level, domain, title, snapshotId, artistId, timestamp };
  for (const f of ALERT_REQUIRED_FIELDS) {
    if (payload[f] === undefined || payload[f] === null) {
      const err = new Error(`Alert missing required field: ${f}`);
      err.code = MONITORING_ERROR_CODES.INVALID_ALERT;
      throw err;
    }
  }
  if (!VALID_ALERT_LEVELS.has(level)) {
    const err = new Error(`Invalid alert level: ${level}`);
    err.code = MONITORING_ERROR_CODES.INVALID_ALERT;
    throw err;
  }

  return Object.freeze({
    alertId,
    level,
    domain,
    title,
    description:      description || '',
    snapshotId,
    artistId,
    timestamp,
    timelineEventIds: Object.freeze(timelineEventIds || []),
    changeCount:      typeof changeCount === 'number' ? changeCount : (timelineEventIds ? timelineEventIds.length : 0),
  });
}

// Maps severity to alert level — severity and alert level share the same vocabulary.
function severityToAlertLevel(severity) {
  return ALERT_LEVELS[severity] || ALERT_LEVELS.INFORMATION;
}

function buildAlertTitle(level, domain, count) {
  const domainLabel = domain.charAt(0).toUpperCase() + domain.slice(1);
  switch (level) {
    case ALERT_LEVELS.CRITICAL:    return `Critical ${domainLabel} Change${count > 1 ? 's' : ''} Detected`;
    case ALERT_LEVELS.HIGH:        return `High Priority ${domainLabel} Change${count > 1 ? 's' : ''} Detected`;
    case ALERT_LEVELS.MEDIUM:      return `${domainLabel} Update${count > 1 ? 's' : ''} Detected`;
    case ALERT_LEVELS.LOW:         return `${domainLabel} Minor Change${count > 1 ? 's' : ''} Detected`;
    case ALERT_LEVELS.INFORMATION: return `${domainLabel} Scan Complete`;
    default:                       return `${domainLabel} Change Detected`;
  }
}

function buildAlertDescription(level, events) {
  if (!events.length) return '';
  const fields = [...new Set(events.map(e => e.field))].slice(0, 3).join(', ');
  const more   = events.length > 3 ? ` and ${events.length - 3} more` : '';
  return `Fields affected: ${fields}${more}`;
}

export function generateAlertsFromTimeline(timelineEvents, snapshot) {
  if (!timelineEvents || !timelineEvents.length) return Object.freeze([]);

  // Group events by (severity, domain) — each group becomes one alert
  const groups = new Map();
  for (const event of timelineEvents) {
    const key = `${event.severity}::${event.domain}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(event);
  }

  const alerts = [];
  for (const [key, events] of groups) {
    const [severity, domain] = key.split('::');
    const level = severityToAlertLevel(severity);
    alerts.push(createAlert({
      alertId:          randomUUID(),
      level,
      domain,
      title:            buildAlertTitle(level, domain, events.length),
      description:      buildAlertDescription(level, events),
      snapshotId:       snapshot.snapshotId,
      artistId:         snapshot.artistId,
      timestamp:        snapshot.timestamp,
      timelineEventIds: events.map(e => e.eventId),
      changeCount:      events.length,
    }));
  }

  // Sort alerts: CRITICAL first, then domain alphabetically
  alerts.sort((a, b) => {
    const ORDER = [ALERT_LEVELS.CRITICAL, ALERT_LEVELS.HIGH, ALERT_LEVELS.MEDIUM, ALERT_LEVELS.LOW, ALERT_LEVELS.INFORMATION];
    const ai = ORDER.indexOf(a.level);
    const bi = ORDER.indexOf(b.level);
    if (ai !== bi) return ai - bi;
    return a.domain.localeCompare(b.domain);
  });

  return Object.freeze(alerts);
}
