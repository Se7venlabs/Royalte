// Constitutional health states — PAL Technical Design v3 §4.1
// Nine exact states. Framework never interprets state meaning; it reports and carries.

export const HealthState = Object.freeze({
  AVAILABLE:        'AVAILABLE',        // healthy, full response
  PARTIAL_RESPONSE: 'PARTIAL_RESPONSE', // responded, incomplete data
  MAINTENANCE:      'MAINTENANCE',      // provider signalled planned downtime
  TIMEOUT:          'TIMEOUT',          // exceeded request or attempt budget
  AUTH_FAILED:      'AUTH_FAILED',      // credentials rejected / expired
  SCHEMA_CHANGED:   'SCHEMA_CHANGED',   // response shape no longer matches expectation
  RATE_LIMITED:     'RATE_LIMITED',     // provider throttled this connector
  DEPRECATED:       'DEPRECATED',       // endpoint works but scheduled for retirement
  DISABLED:         'DISABLED',         // governance-off via registry enabled flag
});
