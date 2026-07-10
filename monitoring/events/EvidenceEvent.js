// Royaltē Evidence Event™
// Monitoring Intelligence Migration Sprint™ — Board Authorization 2026-07-03
//
// Constitutional definition:
//   Every detected difference becomes an immutable constitutional event.
//   Evidence Events are Royaltē's historical audit trail.
//
// Constitutional fields (all required):
//   eventId           — globally unique UUID
//   detectedAt        — ISO 8601 detection timestamp
//   provider          — which provider's evidence changed
//   evidenceDomain    — the dot-path of the changed evidence field
//   changeType        — 'addition' | 'removal' | 'modification'
//   previousValue     — evidence value before the change (undefined for additions)
//   currentValue      — evidence value after the change (undefined for removals)
//   evidenceSource    — provider name + acquisition timestamp from snapshot metadata
//   confidence        — 0.0–1.0 confidence in the detected change
//   snapshotRefs      — { previous: snapshotId, current: snapshotId }
//   severity          — constitutional severity level from EventSeverity
//   explanation       — { whatChanged, whyDetected, whyItMatters } (explainability)
//
// Constitutional constraints:
//   - Immutable once created (deep-frozen)
//   - Event IDs are globally unique UUIDs
//   - History is never rewritten — events are permanent
//
// Authority: Royaltē Master Constitution — Monitoring Intelligence Migration Sprint™

import { randomUUID } from 'node:crypto';
import { isValidSeverity } from './EventSeverity.js';

export const EVENT_SCHEMA_VERSION = '1.0';

const VALID_CHANGE_TYPES = new Set(['addition', 'removal', 'modification']);

/**
 * Create an immutable Evidence Event™.
 *
 * @param {{
 *   detectedAt:     string,           — ISO 8601
 *   provider:       string,           — provider name (e.g. 'lastfm')
 *   evidenceDomain: string,           — dot-path (e.g. 'platforms.lastfm.community.listeners')
 *   changeType:     'addition'|'removal'|'modification',
 *   previousValue:  any,
 *   currentValue:   any,
 *   evidenceSource: { providerName: string, acquisitionTimestamp?: string|null },
 *   confidence:     number,           — 0.0–1.0
 *   snapshotRefs:   { previous: string|null, current: string },
 *   severity:       string,           — from EventSeverity
 *   explanation:    { whatChanged: string, whyDetected: string, whyItMatters: string },
 * }} params
 * @returns {Readonly<EvidenceEvent>}
 */
export function createEvidenceEvent({
  detectedAt,
  provider,
  evidenceDomain,
  changeType,
  previousValue,
  currentValue,
  evidenceSource,
  confidence,
  snapshotRefs,
  severity,
  explanation,
}) {
  // ── Validation ──────────────────────────────────────────────────────────────
  if (typeof detectedAt !== 'string' || !isIso8601(detectedAt)) {
    throw new TypeError(`EvidenceEvent: detectedAt must be ISO 8601, got "${detectedAt}"`);
  }
  if (!provider || typeof provider !== 'string') {
    throw new TypeError('EvidenceEvent: provider is required');
  }
  if (!evidenceDomain || typeof evidenceDomain !== 'string') {
    throw new TypeError('EvidenceEvent: evidenceDomain is required');
  }
  if (!VALID_CHANGE_TYPES.has(changeType)) {
    throw new TypeError(`EvidenceEvent: changeType must be addition|removal|modification, got "${changeType}"`);
  }
  if (typeof confidence !== 'number' || confidence < 0 || confidence > 1) {
    throw new TypeError(`EvidenceEvent: confidence must be 0.0–1.0, got ${confidence}`);
  }
  if (!snapshotRefs || typeof snapshotRefs !== 'object' || !snapshotRefs.current) {
    throw new TypeError('EvidenceEvent: snapshotRefs.current is required');
  }
  if (!isValidSeverity(severity)) {
    throw new TypeError(`EvidenceEvent: invalid severity "${severity}"`);
  }
  if (!explanation || !explanation.whatChanged || !explanation.whyDetected || !explanation.whyItMatters) {
    throw new TypeError('EvidenceEvent: explanation must include whatChanged, whyDetected, whyItMatters');
  }

  return Object.freeze({
    eventId:        randomUUID(),
    schemaVersion:  EVENT_SCHEMA_VERSION,
    detectedAt,
    provider,
    evidenceDomain,
    changeType,
    previousValue,
    currentValue,
    evidenceSource: Object.freeze({
      providerName:          evidenceSource?.providerName ?? provider,
      acquisitionTimestamp:  evidenceSource?.acquisitionTimestamp ?? null,
    }),
    confidence,
    snapshotRefs: Object.freeze({
      previous: snapshotRefs.previous ?? null,
      current:  snapshotRefs.current,
    }),
    severity,
    explanation: Object.freeze({
      whatChanged:   explanation.whatChanged,
      whyDetected:   explanation.whyDetected,
      whyItMatters:  explanation.whyItMatters,
    }),
  });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function isIso8601(s) {
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(s);
}
