// Royaltē Evidence Snapshot™
// Monitoring Intelligence Migration Sprint™ — Board Authorization 2026-07-03
//
// Constitutional definition:
//   An Evidence Snapshot is a complete, immutable representation of an artist's
//   canonical evidence at a specific point in time.
//
// Constitutional constraints:
//   - Immutable: once created, a snapshot cannot be modified
//   - Timestamped: every snapshot carries a precise capturedAt timestamp
//   - Provider-agnostic: stores canonical evidence, not raw provider payloads
//   - Auditable: every field is observable and traceable
//   - Append-only: snapshots are never overwritten; new state = new snapshot
//
// Input: the canonical evidence object produced by EvidenceBridge.bridgeToCanonical()
// (the `platforms` namespace + `subject` + `source` fields).
//
// Authority: Royaltē Master Constitution — Monitoring Intelligence Migration Sprint™

import { randomUUID } from 'node:crypto';

export const SNAPSHOT_SCHEMA_VERSION = '1.0';

/**
 * Create an immutable Evidence Snapshot™ from a canonical evidence object.
 *
 * @param {{
 *   artistId?:         string | null,
 *   artistName?:       string | null,
 *   canonicalEvidence: object,         — output of bridgeToCanonical()
 *   capturedAt?:       string,         — ISO 8601; defaults to now
 *   providerMetadata?: Array<{ provider: string, trust: number, completeness: string }>
 * }} params
 * @returns {Readonly<EvidenceSnapshot>}
 */
export function createEvidenceSnapshot({
  artistId         = null,
  artistName       = null,
  canonicalEvidence,
  capturedAt       = new Date().toISOString(),
  providerMetadata = [],
}) {
  if (!canonicalEvidence || typeof canonicalEvidence !== 'object') {
    throw new TypeError('EvidenceSnapshot: canonicalEvidence must be a non-null object');
  }
  if (typeof capturedAt !== 'string' || !isIso8601(capturedAt)) {
    throw new TypeError(`EvidenceSnapshot: capturedAt must be ISO 8601, got "${capturedAt}"`);
  }

  // Deep-clone the evidence to guarantee immutability of the snapshot.
  // The canonical evidence may contain frozen or non-frozen objects — JSON
  // round-trip produces a plain, fully mutable clone that we then deep-freeze.
  const evidenceCopy = JSON.parse(JSON.stringify(canonicalEvidence));
  const platforms    = evidenceCopy?.platforms ?? {};
  const platformKeys = Object.keys(platforms);

  const snapshot = deepFreeze({
    snapshotId:    randomUUID(),
    schemaVersion: SNAPSHOT_SCHEMA_VERSION,
    artistId:      artistId  ?? null,
    artistName:    artistName ?? null,
    capturedAt,
    evidence:      evidenceCopy,
    metadata: {
      platformCount:    platformKeys.length,
      platforms:        platformKeys,
      providerMetadata: providerMetadata.slice(),  // defensive copy
    },
  });

  return snapshot;
}

/**
 * Returns true if snapshot b represents a meaningfully different evidence state
 * than snapshot a. Uses JSON serialisation of the evidence object for comparison.
 *
 * This is an O(N) text comparison used by SnapshotStore to decide whether to
 * persist a new snapshot (when policy.snapshotOnNoChange = false).
 *
 * @param {EvidenceSnapshot} a
 * @param {EvidenceSnapshot} b
 * @returns {boolean}
 */
export function evidenceDiffers(a, b) {
  return JSON.stringify(a.evidence) !== JSON.stringify(b.evidence);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

// ISO 8601 date-time string check (basic)
function isIso8601(s) {
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(s);
}

export function deepFreeze(obj) {
  if (obj === null || typeof obj !== 'object') return obj;
  Object.freeze(obj);
  for (const val of Object.values(obj)) deepFreeze(val);
  return obj;
}
