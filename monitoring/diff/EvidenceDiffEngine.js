// Royaltē Evidence Difference Engine™
// Monitoring Intelligence Migration Sprint™ — Board Authorization 2026-07-03
//
// Constitutional definition:
//   The Difference Engine is responsible only for comparing snapshots.
//   It detects additions, removals, and modifications.
//   It never determines importance. It never assigns severity.
//   It simply detects differences.
//
// Constitutional constraints:
//   - Pure: same inputs always produce the same output (deterministic)
//   - Never throws: all errors are caught and returned as empty diff[]
//   - Never mutates: both snapshot arguments are read-only
//   - Shallow array comparison: arrays are treated as atomic values (whole-value diff)
//     at the foundation layer. Element-level array diffing is a future phase.
//   - Max depth: recursion is bounded by MAX_DIFF_DEPTH to prevent infinite recursion
//     on cyclic or deeply nested evidence objects
//
// Output shape — each element of the returned array:
// {
//   path:          string,                         — dot-path into evidence
//   changeType:    'addition'|'removal'|'modification',
//   previousValue: any,                            — from snapshot A; undefined for additions
//   currentValue:  any,                            — from snapshot B; undefined for removals
// }
//
// Authority: Royaltē Master Constitution — Monitoring Intelligence Migration Sprint™

const MAX_DIFF_DEPTH = 8;

/**
 * Compare two Evidence Snapshots and return an array of detected differences.
 *
 * @param {EvidenceSnapshot} snapshotA — baseline (older)
 * @param {EvidenceSnapshot} snapshotB — current (newer)
 * @returns {EvidenceDiff[]}
 */
export function compareSnapshots(snapshotA, snapshotB) {
  if (!snapshotA || !snapshotB) {
    return [];
  }

  try {
    const diffs = [];
    deepDiff(snapshotA.evidence, snapshotB.evidence, diffs, '', 0);
    return diffs;
  } catch {
    // Constitutional guarantee: never throws
    return [];
  }
}

/**
 * Compare any two evidence objects (not necessarily full snapshots).
 * Useful for unit testing the diff logic in isolation.
 *
 * @param {any} prevEvidence
 * @param {any} currEvidence
 * @returns {EvidenceDiff[]}
 */
export function compareEvidence(prevEvidence, currEvidence) {
  try {
    const diffs = [];
    deepDiff(prevEvidence, currEvidence, diffs, '', 0);
    return diffs;
  } catch {
    return [];
  }
}

// ── Core recursive diff ────────────────────────────────────────────────────────

/**
 * Recursively diff two values, pushing detected changes into the diffs array.
 *
 * Arrays are treated as atomic leaves: if two arrays differ by JSON.stringify,
 * a single 'modification' diff is pushed for that path. This is intentional at
 * the foundation layer — element-level array diff is a future phase.
 *
 * @param {any} prev
 * @param {any} curr
 * @param {EvidenceDiff[]} diffs
 * @param {string} path — current dot-path prefix
 * @param {number} depth — current recursion depth
 */
function deepDiff(prev, curr, diffs, path, depth) {
  if (depth > MAX_DIFF_DEPTH) return;

  const prevIsLeaf = isLeaf(prev);
  const currIsLeaf = isLeaf(curr);

  // Both undefined — no change
  if (prev === undefined && curr === undefined) return;

  // Both are plain objects → recurse key by key
  if (!prevIsLeaf && !currIsLeaf) {
    diffObjects(prev, curr, diffs, path, depth);
    return;
  }

  // At least one is a leaf — compare as values
  const prevJson = JSON.stringify(prev);
  const currJson = JSON.stringify(curr);
  if (prevJson === currJson) return;

  const changeType = prev === undefined ? 'addition'
    : curr === undefined               ? 'removal'
    : 'modification';

  diffs.push({ path, changeType, previousValue: prev, currentValue: curr });
}

function diffObjects(prev, curr, diffs, path, depth) {
  const prevKeys = new Set(Object.keys(prev));
  const currKeys = new Set(Object.keys(curr));
  const allKeys  = new Set([...prevKeys, ...currKeys]);

  for (const key of allKeys) {
    const childPath = path ? `${path}.${key}` : key;
    const hasPrev   = prevKeys.has(key);
    const hasCurr   = currKeys.has(key);

    if (!hasPrev) {
      // Addition: key only in curr
      diffs.push({ path: childPath, changeType: 'addition', previousValue: undefined, currentValue: curr[key] });
      continue;
    }
    if (!hasCurr) {
      // Removal: key only in prev
      diffs.push({ path: childPath, changeType: 'removal', previousValue: prev[key], currentValue: undefined });
      continue;
    }
    // Both have key → recurse
    deepDiff(prev[key], curr[key], diffs, childPath, depth + 1);
  }
}

// A value is a "leaf" when it is: null, undefined, a primitive, or an Array.
// Arrays are treated as atomic at the foundation layer.
function isLeaf(value) {
  return value === null
    || value === undefined
    || typeof value !== 'object'
    || Array.isArray(value);
}

// ── Diff filtering helpers ─────────────────────────────────────────────────────

/**
 * Filter diffs to only those matching a given path prefix.
 * Useful for isolating provider-specific or domain-specific changes.
 *
 * @param {EvidenceDiff[]} diffs
 * @param {string} prefix — e.g. 'platforms.lastfm'
 * @returns {EvidenceDiff[]}
 */
export function filterByPath(diffs, prefix) {
  return diffs.filter(d => d.path === prefix || d.path.startsWith(`${prefix}.`));
}

/**
 * Filter diffs by change type.
 * @param {EvidenceDiff[]} diffs
 * @param {'addition'|'removal'|'modification'} changeType
 * @returns {EvidenceDiff[]}
 */
export function filterByChangeType(diffs, changeType) {
  return diffs.filter(d => d.changeType === changeType);
}

/**
 * Extract the provider name from a diff path.
 * Returns null if the path does not start with 'platforms.{provider}'.
 *
 * @param {string} diffPath — e.g. 'platforms.lastfm.community.listeners'
 * @returns {string|null}
 */
export function extractProvider(diffPath) {
  const match = diffPath.match(/^platforms\.([^.]+)/);
  return match ? match[1] : null;
}
