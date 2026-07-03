// Royaltē Constitutional Monitoring Policy™
// Monitoring Intelligence Migration Sprint™ — Board Authorization 2026-07-03
//
// Constitutional principle: Algorithms consume policy. Algorithms never define policy.
//
// ALL monitoring behaviour — snapshot cadence, retention, alert thresholds,
// severity mapping, retry logic — is declared here as pure data.
// No monitoring algorithm contains a hard-coded threshold or rule.
//
// This module is Board-owned. Changes require Board ratification.
// Consuming modules must accept a policy object, never import defaults directly
// into business logic (pass-through is fine at integration layers).

export const POLICY_VERSION = '1.0';

// ── Severity level policy — consumed by EvidenceDiffEngine to assign severity ─
// Maps evidence domain patterns to severity escalation rules.
// "domain" is a minimatch-style dot-path prefix: 'platforms.spotify.community.*'
// Rules are evaluated in order; first match wins.
const SEVERITY_RULES = Object.freeze([
  // Provider disappearance / appearance — structural changes are HIGH severity
  { pattern: /^platforms\.\w+$/, onRemoval: 'HIGH', onAddition: 'MEDIUM', onModification: 'LOW' },

  // Community listener / playcount — meaningful audience signal
  { pattern: /community\.(listeners|playcount)$/,
    onRemoval: 'HIGH', onAddition: 'INFORMATIONAL', onModification: 'MEDIUM' },

  // Artist identity fields — any identity change is HIGH
  { pattern: /\.(name|artistId|mbid|isni)$/,
    onRemoval: 'HIGH', onAddition: 'MEDIUM', onModification: 'HIGH' },

  // Biography content — LOW (editorial, not operational)
  { pattern: /biography\.(summary|content)$/,
    onRemoval: 'LOW', onAddition: 'INFORMATIONAL', onModification: 'LOW' },

  // Image / media fields — INFORMATIONAL
  { pattern: /(media|images|thumbnails|fanArt|logos)\./,
    onRemoval: 'LOW', onAddition: 'INFORMATIONAL', onModification: 'INFORMATIONAL' },

  // Top tracks / albums — LOW
  { pattern: /\.(topTracks|topAlbums|discography)\b/,
    onRemoval: 'LOW', onAddition: 'INFORMATIONAL', onModification: 'LOW' },

  // Default catch-all
  { pattern: /./, onRemoval: 'LOW', onAddition: 'INFORMATIONAL', onModification: 'LOW' },
]);

// ── Snapshot policy ────────────────────────────────────────────────────────────
const SNAPSHOT_POLICY = Object.freeze({
  // Nominal snapshot cadence (scheduling is implementation detail)
  frequencyLabel:    '24h',
  frequencyMs:       24 * 60 * 60 * 1000,

  // Retention: keep at most this many snapshots per artist
  maxSnapshotsPerArtist: 365,

  // Retention: delete snapshots older than this (ms) during GC passes
  maxAgeMs: 365 * 24 * 60 * 60 * 1000,

  // Whether to create a snapshot if the new evidence is identical to the latest
  snapshotOnNoChange: false,
});

// ── Event retention policy ─────────────────────────────────────────────────────
const EVENT_RETENTION_POLICY = Object.freeze({
  maxEventsPerArtist: 10_000,
  maxAgeMs:           365 * 24 * 60 * 60 * 1000,
});

// ── Confidence policy ──────────────────────────────────────────────────────────
// Confidence is derived from provider trust + evidence completeness.
// These thresholds map trust values → confidence bands.
const CONFIDENCE_POLICY = Object.freeze({
  // Provider trust → base confidence multiplier
  highTrustThreshold:    80,   // trust >= 80 → base confidence 0.9
  mediumTrustThreshold:  60,   // trust >= 60 → base confidence 0.7
  lowTrustFloor:          0,   // trust < 60  → base confidence 0.5

  highConfidence:    0.9,
  mediumConfidence:  0.7,
  lowConfidence:     0.5,

  // Completeness modifier
  fullCompletenessBonus:    0.1,   // 'full' completeness adds 0.1 to base
  partialCompletenessBonus: 0.0,   // 'partial' gets no bonus
});

// ── Notification / alert policy (reserved for future Alert Intelligence™) ────
const NOTIFICATION_POLICY = Object.freeze({
  // Minimum severity required to raise an alert (future)
  alertMinimumSeverity: 'HIGH',
  // Batch threshold — wait for N events before triggering alert (future)
  alertBatchSize: 1,
});

// ── Master Policy object ───────────────────────────────────────────────────────
export const DEFAULT_MONITORING_POLICY = Object.freeze({
  policyVersion:    POLICY_VERSION,
  severityRules:    SEVERITY_RULES,
  snapshot:         SNAPSHOT_POLICY,
  eventRetention:   EVENT_RETENTION_POLICY,
  confidence:       CONFIDENCE_POLICY,
  notification:     NOTIFICATION_POLICY,
});

/**
 * Resolve severity for a detected diff using policy severity rules.
 * Returns the first matching severity for the given path + changeType.
 *
 * @param {string} diffPath — evidence path (e.g. 'platforms.spotify.community.listeners')
 * @param {'addition'|'removal'|'modification'} changeType
 * @param {object} policy — MonitoringPolicy (defaults to DEFAULT_MONITORING_POLICY)
 * @returns {'CRITICAL'|'HIGH'|'MEDIUM'|'LOW'|'INFORMATIONAL'}
 */
export function resolveSeverity(diffPath, changeType, policy = DEFAULT_MONITORING_POLICY) {
  const rules = policy.severityRules ?? DEFAULT_MONITORING_POLICY.severityRules;
  for (const rule of rules) {
    if (rule.pattern.test(diffPath)) {
      if (changeType === 'addition')     return rule.onAddition;
      if (changeType === 'removal')      return rule.onRemoval;
      if (changeType === 'modification') return rule.onModification;
    }
  }
  return 'INFORMATIONAL';
}

/**
 * Compute confidence for an event given provider trust and completeness.
 *
 * @param {number|null} providerTrust — 0-100; null → medium band assumed
 * @param {'full'|'partial'|'empty'|null} completeness
 * @param {object} policy
 * @returns {number} — 0.0 to 1.0
 */
export function computeConfidence(providerTrust, completeness, policy = DEFAULT_MONITORING_POLICY) {
  const cfg   = policy.confidence ?? DEFAULT_MONITORING_POLICY.confidence;
  const trust = typeof providerTrust === 'number' ? providerTrust : 60;

  let base;
  if (trust >= cfg.highTrustThreshold)   base = cfg.highConfidence;
  else if (trust >= cfg.mediumTrustThreshold) base = cfg.mediumConfidence;
  else                                   base = cfg.lowConfidence;

  const bonus = completeness === 'full' ? cfg.fullCompletenessBonus : cfg.partialCompletenessBonus;
  return Math.min(1.0, Math.max(0.0, base + bonus));
}
