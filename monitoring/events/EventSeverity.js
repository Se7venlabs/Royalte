// Royaltē Constitutional Event Severity™
// Monitoring Intelligence Migration Sprint™ — Board Authorization 2026-07-03
//
// Constitutional principle: Severity is policy-driven. Never hard-code severity
// directly in algorithms. Algorithms receive a severity value; they never compute
// or decide severity without a governing policy.
//
// This module defines the five Board-ratified severity constants.
// Severity assignment rules live in MonitoringPolicy.js.

export const EventSeverity = Object.freeze({
  // CRITICAL: core identity data lost, complete provider failure, catastrophic evidence gap
  CRITICAL: 'CRITICAL',

  // HIGH: significant data change, provider loss/gain, identity field modified
  HIGH: 'HIGH',

  // MEDIUM: meaningful data modification, audience metric change, content change
  MEDIUM: 'MEDIUM',

  // LOW: minor data changes, small numeric updates, editorial content changes
  LOW: 'LOW',

  // INFORMATIONAL: new data added, no quality degradation detected
  INFORMATIONAL: 'INFORMATIONAL',
});

const VALID_SEVERITIES = new Set(Object.values(EventSeverity));

/**
 * Returns true if the given string is a valid constitutional severity level.
 * @param {string} s
 * @returns {boolean}
 */
export function isValidSeverity(s) {
  return VALID_SEVERITIES.has(s);
}

// Severity order (lowest to highest) — used for threshold comparisons.
// Algorithms must read this ordering from policy where possible.
export const SEVERITY_ORDER = Object.freeze([
  EventSeverity.INFORMATIONAL,
  EventSeverity.LOW,
  EventSeverity.MEDIUM,
  EventSeverity.HIGH,
  EventSeverity.CRITICAL,
]);

/**
 * Returns true if severityA is at least as severe as severityB.
 * @param {string} severityA
 * @param {string} severityB
 * @returns {boolean}
 */
export function isAtLeast(severityA, severityB) {
  return SEVERITY_ORDER.indexOf(severityA) >= SEVERITY_ORDER.indexOf(severityB);
}
