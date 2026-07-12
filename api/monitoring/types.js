// Canonical Intelligence Platform(tm) -- Monitoring & Change Detection Type Constants

export const CHANGE_TYPES = Object.freeze({
  ADDED:     'ADDED',
  REMOVED:   'REMOVED',
  MODIFIED:  'MODIFIED',
  UNCHANGED: 'UNCHANGED',
});

export const SEVERITY_LEVELS = Object.freeze({
  CRITICAL:    'CRITICAL',
  HIGH:        'HIGH',
  MEDIUM:      'MEDIUM',
  LOW:         'LOW',
  INFORMATION: 'INFORMATION',
});

// Alert levels mirror severity levels — alerts are generated at the same classification
export const ALERT_LEVELS = Object.freeze({
  CRITICAL:    'CRITICAL',
  HIGH:        'HIGH',
  MEDIUM:      'MEDIUM',
  LOW:         'LOW',
  INFORMATION: 'INFORMATION',
});

export const MONITORING_DOMAINS = Object.freeze({
  IDENTITY:     'identity',
  PUBLISHING:   'publishing',
  RECORDING:    'recording',
  CATALOG:      'catalog',
  VERIFICATION: 'verification',
  DISTRIBUTION: 'distribution',
  METADATA:     'metadata',
  SYSTEM:       'system',
});

export const MONITORING_EVENT_TYPES = Object.freeze({
  SCAN_RECORDED:        'SCAN_RECORDED',
  SNAPSHOT_CREATED:     'SNAPSHOT_CREATED',
  CHANGE_DETECTED:      'CHANGE_DETECTED',
  TIMELINE_GENERATED:   'TIMELINE_GENERATED',
  ALERT_GENERATED:      'ALERT_GENERATED',
  FIRST_SCAN:           'FIRST_SCAN',
  NO_CHANGES_DETECTED:  'NO_CHANGES_DETECTED',
});

export const MONITORING_ERROR_CODES = Object.freeze({
  INVALID_SNAPSHOT:       'INVALID_SNAPSHOT',
  SNAPSHOT_NOT_FOUND:     'SNAPSHOT_NOT_FOUND',
  INVALID_COMPARISON:     'INVALID_COMPARISON',
  COMPARISON_FAILED:      'COMPARISON_FAILED',
  DUPLICATE_SNAPSHOT:     'DUPLICATE_SNAPSHOT',
  HISTORY_VIOLATION:      'HISTORY_VIOLATION',
  VALIDATION_FAILED:      'VALIDATION_FAILED',
  INVALID_TIMELINE_EVENT: 'INVALID_TIMELINE_EVENT',
  INVALID_ALERT:          'INVALID_ALERT',
  ARTIST_NOT_FOUND:       'ARTIST_NOT_FOUND',
});

// Fields required on every Canonical Snapshot(tm)
export const SNAPSHOT_REQUIRED_FIELDS = Object.freeze([
  'snapshotId',
  'scanId',
  'artistId',
  'timestamp',
  'canonicalDomains',
  'engineVersions',
  'scanDuration',
  'createdAt',
]);

// Fields required on every Timeline Event(tm)
export const TIMELINE_EVENT_REQUIRED_FIELDS = Object.freeze([
  'eventId',
  'snapshotId',
  'artistId',
  'timestamp',
  'domain',
  'field',
  'fieldPath',
  'changeType',
  'severity',
]);

// Fields required on every Alert
export const ALERT_REQUIRED_FIELDS = Object.freeze([
  'alertId',
  'level',
  'domain',
  'title',
  'snapshotId',
  'artistId',
  'timestamp',
]);

// Board-locked severity priority order (lower index = higher priority)
export const SEVERITY_PRIORITY_ORDER = Object.freeze([
  SEVERITY_LEVELS.CRITICAL,
  SEVERITY_LEVELS.HIGH,
  SEVERITY_LEVELS.MEDIUM,
  SEVERITY_LEVELS.LOW,
  SEVERITY_LEVELS.INFORMATION,
]);

export const VALID_CHANGE_TYPES     = new Set(Object.values(CHANGE_TYPES));
export const VALID_SEVERITY_LEVELS  = new Set(Object.values(SEVERITY_LEVELS));
export const VALID_ALERT_LEVELS     = new Set(Object.values(ALERT_LEVELS));
export const VALID_MONITORING_DOMAINS = new Set(Object.values(MONITORING_DOMAINS));
