// Canonical Intelligence Platform(tm) -- Timeline Event(tm) Factory
// Every detected change produces one immutable Timeline Event(tm).

import { randomUUID } from 'crypto';
import { TIMELINE_EVENT_REQUIRED_FIELDS, MONITORING_ERROR_CODES, VALID_CHANGE_TYPES, VALID_SEVERITY_LEVELS } from './types.js';

export function createTimelineEvent({
  eventId,
  snapshotId,
  artistId,
  timestamp,
  domain,
  field,
  fieldPath,
  oldValue,
  newValue,
  changeType,
  severity,
  comparisonId,
  label,
}) {
  const payload = { eventId, snapshotId, artistId, timestamp, domain, field, fieldPath, changeType, severity };
  for (const f of TIMELINE_EVENT_REQUIRED_FIELDS) {
    if (payload[f] === undefined || payload[f] === null) {
      const err = new Error(`TimelineEvent missing required field: ${f}`);
      err.code = MONITORING_ERROR_CODES.INVALID_TIMELINE_EVENT;
      throw err;
    }
  }
  if (!VALID_CHANGE_TYPES.has(changeType)) {
    const err = new Error(`Invalid changeType: ${changeType}`);
    err.code = MONITORING_ERROR_CODES.INVALID_TIMELINE_EVENT;
    throw err;
  }
  if (!VALID_SEVERITY_LEVELS.has(severity)) {
    const err = new Error(`Invalid severity: ${severity}`);
    err.code = MONITORING_ERROR_CODES.INVALID_TIMELINE_EVENT;
    throw err;
  }

  return Object.freeze({
    eventId,
    snapshotId,
    artistId,
    timestamp,
    domain,
    field,
    fieldPath,
    oldValue:     oldValue !== undefined ? oldValue : null,
    newValue:     newValue !== undefined ? newValue : null,
    changeType,
    severity,
    comparisonId: comparisonId || null,
    label:        label || buildEventLabel(domain, field, changeType),
  });
}

export function buildTimelineEventFromChange(change, snapshot) {
  return createTimelineEvent({
    eventId:      randomUUID(),
    snapshotId:   snapshot.snapshotId,
    artistId:     snapshot.artistId,
    timestamp:    snapshot.timestamp,
    domain:       change.domain,
    field:        change.field,
    fieldPath:    change.fieldPath,
    oldValue:     change.oldValue,
    newValue:     change.newValue,
    changeType:   change.changeType,
    severity:     change.severity,
    comparisonId: change.comparisonId,
  });
}

function buildEventLabel(domain, field, changeType) {
  const domainLabel = domain.charAt(0).toUpperCase() + domain.slice(1);
  const fieldLabel  = field.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').trim();
  switch (changeType) {
    case 'ADDED':    return `${domainLabel} ${fieldLabel} Added`;
    case 'REMOVED':  return `${domainLabel} ${fieldLabel} Removed`;
    case 'MODIFIED': return `${domainLabel} ${fieldLabel} Updated`;
    default:         return `${domainLabel} ${fieldLabel} Changed`;
  }
}
