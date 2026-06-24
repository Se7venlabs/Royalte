// ─────────────────────────────────────────────────────────────────────
//  Royaltē Catalog Classifier™ — Phase 6C
// ─────────────────────────────────────────────────────────────────────
//
//  Single responsibility: classify a release into a canonical release type.
//  No identity generation. No hashing. No provider logic. No I/O.
//
//  Classification rules (Board-locked, Canonical Catalog Model™ v1.0):
//    1. Spotify album_type 'compilation'       → COMPILATION
//    2. trackCount === 1                       → SINGLE
//    3. trackCount >= 2 && trackCount <= 6     → EP
//    4. trackCount >= 7                        → ALBUM
//    5. Spotify album_type 'album'             → ALBUM  (trackCount absent)
//    6. Spotify album_type 'single'            → SINGLE (trackCount absent)
//    7. No reliable signal                     → UNKNOWN
//
//  Apple Music does not return album_type; trackCount drives classification.
//  Spotify returns album_type; trackCount is preferred when both are present.
// ─────────────────────────────────────────────────────────────────────

export const RELEASE_TYPE = Object.freeze({
  ALBUM:       'ALBUM',
  EP:          'EP',
  SINGLE:      'SINGLE',
  COMPILATION: 'COMPILATION',
  UNKNOWN:     'UNKNOWN',
});

/**
 * classifyRelease(trackCount, albumType)
 *
 * Pure, synchronous, never throws.
 *
 * @param {number|null}  trackCount  total tracks on the release (Apple: trackCount, Spotify: total_tracks)
 * @param {string|null}  albumType   provider album type string (Spotify: album_type). null for Apple.
 * @returns {string}                 one of RELEASE_TYPE values
 */
export function classifyRelease(trackCount, albumType) {
  // Priority 1: explicit compilation flag (Spotify only)
  if (typeof albumType === 'string' && albumType.toLowerCase() === 'compilation') {
    return RELEASE_TYPE.COMPILATION;
  }

  // Priority 2-4: track count (most reliable signal, works for both providers)
  if (typeof trackCount === 'number' && Number.isFinite(trackCount) && trackCount > 0) {
    if (trackCount === 1)                        return RELEASE_TYPE.SINGLE;
    if (trackCount >= 2 && trackCount <= 6)      return RELEASE_TYPE.EP;
    return RELEASE_TYPE.ALBUM;
  }

  // Priority 5-6: Spotify album_type fallback (when trackCount is absent or zero)
  if (typeof albumType === 'string') {
    if (albumType.toLowerCase() === 'album')  return RELEASE_TYPE.ALBUM;
    if (albumType.toLowerCase() === 'single') return RELEASE_TYPE.SINGLE;
  }

  return RELEASE_TYPE.UNKNOWN;
}
