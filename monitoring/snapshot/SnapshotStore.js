// Royaltē Evidence Snapshot Store™
// Monitoring Intelligence Migration Sprint™ — Board Authorization 2026-07-03
//
// Constitutional definition:
//   The Snapshot Store is Royaltē's historical memory. It stores every constitutional
//   Evidence Snapshot and never modifies or deletes them during normal operation.
//
// Constitutional constraints:
//   - Append only: no existing snapshot record is ever mutated
//   - Immutable history: snapshots are never edited after storage
//   - Ordered: snapshots are retrievable in chronological order
//   - Auditable: every stored snapshot is traceable by snapshotId or capturedAt
//
// Implementation note (foundation layer):
//   This implementation provides an in-memory, append-only store. Production
//   deployments will back this with Supabase (audit_evidence_snapshots table).
//   The constitutional interface is stable; the storage backend is an implementation
//   detail subordinate to this contract.
//
// Constitutional invariant: #snapshots is never sorted or reordered after append.
//   Insertion order preserves chronological order (callers must append in time order).

import { evidenceDiffers } from './EvidenceSnapshot.js';
import { DEFAULT_MONITORING_POLICY } from '../policy/MonitoringPolicy.js';

export class SnapshotStore {
  // Ordered append-only log of snapshots (across all artists)
  #snapshots = [];

  /**
   * Append a snapshot to the store.
   *
   * Respects policy.snapshot.snapshotOnNoChange: if false (default), a snapshot
   * is not stored when the evidence is identical to the most recent snapshot for
   * the same artist.
   *
   * @param {EvidenceSnapshot} snapshot
   * @param {object} policy — MonitoringPolicy; defaults to DEFAULT_MONITORING_POLICY
   * @returns {{ stored: boolean, reason: string }}
   */
  append(snapshot, policy = DEFAULT_MONITORING_POLICY) {
    if (!snapshot || typeof snapshot !== 'object' || !snapshot.snapshotId) {
      throw new TypeError('SnapshotStore: snapshot must be a valid EvidenceSnapshot');
    }

    const snapshotPolicy = policy.snapshot ?? DEFAULT_MONITORING_POLICY.snapshot;

    // Duplicate guard: snapshotId must be unique
    if (this.#snapshots.some(s => s.snapshotId === snapshot.snapshotId)) {
      return { stored: false, reason: 'duplicate snapshotId' };
    }

    // No-change guard (policy-gated)
    if (!snapshotPolicy.snapshotOnNoChange) {
      const latest = this.getLatestForArtist(snapshot.artistId);
      if (latest && !evidenceDiffers(latest, snapshot)) {
        return { stored: false, reason: 'no evidence change — policy.snapshotOnNoChange is false' };
      }
    }

    this.#snapshots.push(snapshot);
    return { stored: true, reason: 'appended' };
  }

  /**
   * Return all snapshots for a given artistId, in chronological order (oldest first).
   * @param {string|null} artistId
   * @returns {EvidenceSnapshot[]}
   */
  getForArtist(artistId) {
    return this.#snapshots.filter(s => s.artistId === artistId);
  }

  /**
   * Return the most recent snapshot for an artistId, or null if none.
   * @param {string|null} artistId
   * @returns {EvidenceSnapshot|null}
   */
  getLatestForArtist(artistId) {
    const all = this.getForArtist(artistId);
    return all.length > 0 ? all[all.length - 1] : null;
  }

  /**
   * Return the snapshot immediately before the latest for an artistId.
   * Returns null if fewer than 2 snapshots exist.
   * @param {string|null} artistId
   * @returns {EvidenceSnapshot|null}
   */
  getPreviousForArtist(artistId) {
    const all = this.getForArtist(artistId);
    return all.length >= 2 ? all[all.length - 2] : null;
  }

  /**
   * Return a snapshot by its unique snapshotId.
   * @param {string} snapshotId
   * @returns {EvidenceSnapshot|null}
   */
  getById(snapshotId) {
    return this.#snapshots.find(s => s.snapshotId === snapshotId) ?? null;
  }

  /**
   * Return a snapshot pair (previous, current) for comparison.
   * Useful for feeding directly into EvidenceDiffEngine.compare().
   *
   * @param {string|null} artistId
   * @returns {{ previous: EvidenceSnapshot|null, current: EvidenceSnapshot|null }}
   */
  getComparisonPair(artistId) {
    return {
      previous: this.getPreviousForArtist(artistId),
      current:  this.getLatestForArtist(artistId),
    };
  }

  /**
   * Return total snapshot count in the store.
   * @returns {number}
   */
  get size() {
    return this.#snapshots.length;
  }

  /**
   * Return snapshot count for a specific artistId.
   * @param {string|null} artistId
   * @returns {number}
   */
  countForArtist(artistId) {
    return this.getForArtist(artistId).length;
  }

  /**
   * Return all unique artistIds in the store.
   * @returns {string[]}
   */
  getArtistIds() {
    return [...new Set(this.#snapshots.map(s => s.artistId))];
  }
}
