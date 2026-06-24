// ─────────────────────────────────────────────────────────────────────
//  Royaltē Catalog Identity™ — Phase 6C
// ─────────────────────────────────────────────────────────────────────
//
//  Single responsibility: generate a deterministic releaseId for a
//  canonical release.  No classification logic. No provider logic.
//  No metadata logic. No I/O.
//
//  Contract:
//    • Same (artistName, title, releaseYear) → same releaseId, always.
//    • Different inputs → different releaseIds (collision-resistant).
//    • Format: "rl_" + first 12 hex characters of SHA-256 over the
//      normalized canonical string.
//    • Normalization: lowercase + trim on artist name and title;
//      releaseYear coerced to a 4-digit string or empty string when null.
//
//  This determinism is the foundation for Change Detection™ — the same
//  release must produce the same ID across every scan so that a future
//  Change Detection phase can compare catalog snapshots by stable keys.
// ─────────────────────────────────────────────────────────────────────

import { createHash } from 'node:crypto';

const RELEASE_ID_PREFIX = 'rl_';
const RELEASE_ID_LENGTH = 12;

/**
 * generateReleaseId(artistName, title, releaseYear)
 *
 * Pure, synchronous, never throws.
 *
 * @param {string}      artistName   canonical artist name
 * @param {string}      title        release title
 * @param {number|null} releaseYear  four-digit year of release, or null
 * @returns {string}                 stable releaseId, e.g. "rl_3a9f1b2c4e7d"
 */
export function generateReleaseId(artistName, title, releaseYear) {
  const normalizedArtist = (typeof artistName === 'string' ? artistName : '').toLowerCase().trim();
  const normalizedTitle  = (typeof title      === 'string' ? title      : '').toLowerCase().trim();
  const year             = (typeof releaseYear === 'number' && Number.isFinite(releaseYear))
    ? String(Math.floor(releaseYear))
    : '';

  const input = `${normalizedArtist}|${normalizedTitle}|${year}`;
  const hex   = createHash('sha256').update(input, 'utf8').digest('hex');
  return RELEASE_ID_PREFIX + hex.slice(0, RELEASE_ID_LENGTH);
}
