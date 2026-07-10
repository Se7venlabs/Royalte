// Royaltē Recording Intelligence™ — Deterministic Recording Matcher
//
// Groups NormalizedTrack[] from multiple providers into MatchGroup[] using
// a two-pass deterministic strategy:
//
//   Pass 1 — ISRC exact match (highest authority)
//     Tracks that share the same ISRC are the same recording.
//     A track is consumed by Pass 1 if it carries a valid ISRC.
//
//   Pass 2 — Normalized title + artist key (soft match)
//     Tracks without ISRCs (or remaining unmatched) are grouped by the
//     normalized title key produced by title-normalizer.js.
//
//   Pass 3 — Duration tolerance (future)
//     When two tracks share no ISRC and have different titles but identical
//     durations (±2000 ms), they may represent the same master recording
//     under localized or alternate titles. Reserved; not activated in v1.0.
//
// MatchGroup:
// {
//   key:       string,             // ISRC (Pass 1) or normalized title key (Pass 2)
//   matchType: 'ISRC' | 'TITLE',
//   tracks:    NormalizedTrack[],
// }
//
// Pure. No I/O. Never throws.

import { normalizeTitle } from './title-normalizer.js';

// Stable, lowercase, punctuation-stripped key for title matching
function titleKey(title) {
  if (typeof title !== 'string') return '';
  return normalizeTitle(title)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

// artistKey: strips common articles and normalizes for comparison
function artistKey(artistName) {
  if (typeof artistName !== 'string') return '';
  return artistName
    .toLowerCase()
    .replace(/^(the|a|an)\s+/, '')
    .replace(/[^a-z0-9]/g, '');
}

// compositeKey: title + '::' + artist — prevents false matches across artists
function compositeKey(title, artistName) {
  const tKey = titleKey(title);
  const aKey = artistKey(artistName);
  return aKey ? `${tKey}::${aKey}` : tKey;
}

// matchRecordings — deterministic two-pass matcher
//
// tracks: NormalizedTrack[]
// Returns: MatchGroup[]
export function matchRecordings(tracks = []) {
  if (!Array.isArray(tracks) || tracks.length === 0) return [];

  // Pass 1: ISRC exact grouping
  const isrcGroups = new Map(); // isrc → NormalizedTrack[]
  const noIsrc     = [];

  for (const t of tracks) {
    if (t?.isrc) {
      const g = isrcGroups.get(t.isrc) ?? [];
      g.push(t);
      isrcGroups.set(t.isrc, g);
    } else if (t) {
      noIsrc.push(t);
    }
  }

  // Pass 2: Title + artist grouping for tracks without ISRCs
  const titleGroups = new Map(); // compositeKey → NormalizedTrack[]
  for (const t of noIsrc) {
    const key = compositeKey(t.title ?? '', t.artistName ?? '');
    const g   = titleGroups.get(key) ?? [];
    g.push(t);
    titleGroups.set(key, g);
  }

  // Assemble MatchGroup[] — ISRC groups first, then title groups
  const groups = [];

  for (const [isrc, tracksInGroup] of isrcGroups) {
    groups.push(Object.freeze({
      key:       isrc,
      matchType: 'ISRC',
      tracks:    Object.freeze(tracksInGroup),
    }));
  }

  for (const [key, tracksInGroup] of titleGroups) {
    if (key) { // skip empty key (degenerate case)
      groups.push(Object.freeze({
        key,
        matchType: 'TITLE',
        tracks:    Object.freeze(tracksInGroup),
      }));
    }
  }

  return Object.freeze(groups);
}

// deduplicate — collapse MatchGroup[] into a flat unique recording set
// where the same ISRC appearing under multiple title keys is resolved.
// Returns MatchGroup[] with no ISRC duplicated across groups.
export function deduplicate(groups = []) {
  if (!Array.isArray(groups)) return [];

  const seenIsrcs = new Set();
  const result    = [];

  // ISRC groups first — they are authoritative
  for (const g of groups) {
    if (g.matchType === 'ISRC') {
      seenIsrcs.add(g.key);
      result.push(g);
    }
  }

  // Title groups — discard any track whose ISRC was already claimed
  for (const g of groups) {
    if (g.matchType === 'TITLE') {
      const filtered = g.tracks.filter(t => !t.isrc || !seenIsrcs.has(t.isrc));
      if (filtered.length > 0) {
        result.push(Object.freeze({ ...g, tracks: Object.freeze(filtered) }));
      }
    }
  }

  return Object.freeze(result);
}
