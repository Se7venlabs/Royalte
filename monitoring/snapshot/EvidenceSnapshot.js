// Royaltē Evidence Snapshot™
// Monitoring Intelligence Migration Sprint™ — Board Authorization 2026-07-03
// Board Amendment: snapshotVersion + snapshotHash — 2026-07-03
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
//   - Verifiable: snapshotHash is a deterministic SHA-256 of the serialised
//     evidence; enables tamper detection, efficient no-change detection, and
//     future historical replay verification without full evidence deserialisation
//
// snapshotVersion: the version of the Evidence Snapshot™ schema contract.
//   Distinct from schemaVersion to allow independent evolution of the snapshot
//   format and the broader monitoring schema.
//
// snapshotHash: SHA-256 hex digest of JSON.stringify(canonicalEvidence).
//   Deterministic for identical evidence. Used by SnapshotStore for O(1)
//   no-change detection. Allows long-term audit verification.
//
// Input: the canonical evidence object produced by EvidenceBridge.bridgeToCanonical()
// (the `platforms` namespace + `subject` + `source` fields).
//
// Authority: Royaltē Master Constitution — Monitoring Intelligence Migration Sprint™

import { randomUUID, createHash } from 'node:crypto';

export const SNAPSHOT_SCHEMA_VERSION = '1.0';

// Separate versioning for the snapshot format, distinct from schemaVersion,
// to allow independent evolution per Board Amendment recommendation.
export const SNAPSHOT_VERSION = '1.0';

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
 *
 * Produced snapshot includes:
 *   snapshotVersion — snapshot schema version (SNAPSHOT_VERSION constant)
 *   snapshotHash    — SHA-256 hex of JSON.stringify(canonicalEvidence); deterministic
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
  const serialized   = JSON.stringify(canonicalEvidence);
  const evidenceCopy = JSON.parse(serialized);
  const platforms    = evidenceCopy?.platforms ?? {};
  const platformKeys = Object.keys(platforms);

  // snapshotHash: deterministic SHA-256 of the serialised evidence.
  // Computed before deep-freeze so the original serialization is reused.
  // Same evidence always produces the same hash (deterministic).
  const snapshotHash = createHash('sha256').update(serialized).digest('hex');

  const snapshot = deepFreeze({
    snapshotId:      randomUUID(),
    snapshotVersion: SNAPSHOT_VERSION,
    schemaVersion:   SNAPSHOT_SCHEMA_VERSION,
    snapshotHash,
    artistId:        artistId  ?? null,
    artistName:      artistName ?? null,
    capturedAt,
    evidence:        evidenceCopy,
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
 * than snapshot a.
 *
 * Uses snapshotHash comparison (O(1) string equality) when both snapshots carry
 * the Board Amendment hash field. Falls back to JSON serialisation for snapshots
 * created before the Amendment (backwards compatible).
 *
 * @param {EvidenceSnapshot} a
 * @param {EvidenceSnapshot} b
 * @returns {boolean}
 */
export function evidenceDiffers(a, b) {
  // Fast path: both snapshots carry hashes (Board Amendment)
  if (a.snapshotHash && b.snapshotHash) {
    return a.snapshotHash !== b.snapshotHash;
  }
  // Fallback: full JSON comparison (pre-Amendment snapshots)
  return JSON.stringify(a.evidence) !== JSON.stringify(b.evidence);
}

/**
 * Verify a snapshot's integrity by recomputing its hash and comparing.
 * Returns true if the snapshot has not been tampered with.
 * Returns true for pre-Amendment snapshots (no snapshotHash field) — cannot verify.
 *
 * @param {EvidenceSnapshot} snapshot
 * @returns {boolean}
 */
export function verifySnapshotIntegrity(snapshot) {
  if (!snapshot.snapshotHash) return true;  // pre-Amendment: unverifiable, assume valid
  try {
    const recomputed = createHash('sha256')
      .update(JSON.stringify(snapshot.evidence))
      .digest('hex');
    return recomputed === snapshot.snapshotHash;
  } catch {
    return false;
  }
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
