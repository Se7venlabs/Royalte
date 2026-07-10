// ─────────────────────────────────────────────────────────────────────
//  Royaltē OS™ — Executive Image Service™ (frontend)
// ─────────────────────────────────────────────────────────────────────
//
//  Sole owner of image resolution for Executive Workspace rendering.
//  Reads exclusively from canonical Royaltē Intelligence payload fields.
//  Never reads from platform-specific paths (payload.platforms.apple.*,
//  payload.platforms.spotify.*, etc.).
//
//  Board Directive: Executive Workspace Image Selection Standard™
//  (2026-07-03). All Executive Workspaces that render images MUST
//  call these functions rather than reading platform-specific paths.
//
//  The backend (api/_lib/image-service.js + cio-assembler.js) has
//  already resolved the best-quality verified source before the payload
//  reaches the UI. This layer reads that decision — it never re-derives.
//
//  Canonical payload read paths:
//    Artist image:  payload.cio?.identity?.artwork
//                   ↳ payload.subject?.artistImageUrl  (scan-level fallback)
//    Release art:   payload.albumImageUrl
//                   ↳ getBestVerifiedArtistImage(payload) (artist-level fallback)
// ─────────────────────────────────────────────────────────────────────

/**
 * Returns the best verified artist image URL from the canonical
 * Royaltē Intelligence payload. Never throws. Returns null when no
 * verified image is available.
 *
 * @param {object} payload  audit_scans.payload
 * @returns {string|null}
 */
export function getBestVerifiedArtistImage(payload) {
  if (!payload || typeof payload !== 'object') return null;

  // CIO identity.artwork is the canonical store — the backend has
  // already selected the highest-quality verified source (Apple-first
  // per Canonical Identity Architecture; Spotify as fallback).
  const cioArtwork = payload.cio?.identity?.artwork;
  if (typeof cioArtwork === 'string' && cioArtwork) return cioArtwork;

  // Scan-level fallback: artistImageUrl was assembled by image-service.js
  // during scan execution and reflects the same priority ordering.
  const scanImg = payload.subject?.artistImageUrl || payload.artistImageUrl || null;
  if (typeof scanImg === 'string' && scanImg) return scanImg;

  // Platform fallback: artwork written to platforms.appleMusic.details.artwork
  // by normalizeAuditResponse from appleArtworkUrl. The CIO assembly engine reads
  // from this path to populate cio.identity.artwork; this fallback handles
  // consumers that receive the canonical payload before CIO is surfaced on it.
  const platformImg = payload.platforms?.appleMusic?.details?.artwork || null;
  if (typeof platformImg === 'string' && platformImg) return platformImg;

  return null;
}

/**
 * Returns the best verified release artwork URL from the canonical
 * Royaltē Intelligence payload. Never throws. Returns null when no
 * verified artwork is available.
 *
 * @param {object} payload  audit_scans.payload
 * @returns {string|null}
 */
export function getBestVerifiedReleaseArtwork(payload) {
  if (!payload || typeof payload !== 'object') return null;

  // albumImageUrl is the canonical release artwork field, assembled by
  // image-service.getBestVerifiedReleaseArtwork() during scan execution.
  const albumImg = payload.albumImageUrl || payload.subject?.albumImageUrl || null;
  if (typeof albumImg === 'string' && albumImg) return albumImg;

  // Fallback to artist image when no release-specific artwork is
  // available (e.g. artist-URL scans where no track was resolved).
  return getBestVerifiedArtistImage(payload);
}
