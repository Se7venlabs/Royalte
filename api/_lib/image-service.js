// ─────────────────────────────────────────────────────────────────────
//  Royaltē OS™ — Executive Image Service™ (backend)
// ─────────────────────────────────────────────────────────────────────
//
//  Sole owner of image source selection for all Royaltē OS intelligence
//  surfaces. The UI never requests a platform-specific image — it
//  requests only Best Verified Artist Image™ or Best Verified Release
//  Artwork™. This service evaluates all available platform evidence and
//  returns the highest-quality verified URL.
//
//  Board Directive: Executive Workspace Image Selection Standard™
//  (2026-07-03). No workspace may reference Apple Music, Spotify,
//  Deezer, or any future provider directly for image selection.
//
//  Evaluation order for artist images (IMAGE_SOURCE_PRIORITY):
//    1. Apple Music — canonical identity provider per Canonical Identity
//       Architecture (Board 2026-06-07); returns artist images at
//       reliably higher resolution (typically 3000×3000).
//    2. Spotify — verified streaming identity; first image is largest.
//    3. (Future providers extend this list; this function never changes.)
//
//  Both functions are pure, deterministic, and never throw.
// ─────────────────────────────────────────────────────────────────────

/**
 * Returns the best verified artist image URL from all available
 * platform evidence. Never throws. Returns null if no verified
 * image is available.
 *
 * @param {{ artistImage?: string|null, appleArtworkUrl?: string|null }} resolved
 *   The object returned by resolveToArtist(). May carry an Apple-first
 *   artistImage already selected by that path, or a raw appleArtworkUrl.
 * @param {{ images?: Array<{url:string}>|null }} artistData
 *   Spotify artist payload. images[0] is the largest available.
 * @param {{ artwork?: string|null }} appleMusicData
 *   Apple Music compatibility payload from synthesizeAppleMusicCompat().
 * @returns {string|null}
 */
export function getBestVerifiedArtistImage(resolved, artistData, appleMusicData) {
  // 1. resolved.artistImage — set by resolveToArtist() on the apple-URL
  //    path as appleArtwork || spotifyFallback, or on spotify/track paths
  //    as spotifyImages[0]. If present it already represents the best
  //    available image from that resolution path.
  const fromResolved = resolved?.artistImage;
  if (typeof fromResolved === 'string' && fromResolved) return fromResolved;

  // 2. Apple Music artwork — present on apple-URL scans where the Apple
  //    PAL connector resolves a high-res URL independently of resolveToArtist.
  const fromApple = resolved?.appleArtworkUrl || appleMusicData?.artwork || null;
  if (typeof fromApple === 'string' && fromApple) return fromApple;

  // 3. Spotify artist images — images[0] is the highest-resolution image
  //    Spotify provides; used as verified fallback when Apple is unavailable.
  const fromSpotify = artistData?.images?.[0]?.url || null;
  if (typeof fromSpotify === 'string' && fromSpotify) return fromSpotify;

  return null;
}

/**
 * Returns the best verified release artwork URL from available evidence.
 * Release-level (album/single) artwork is preferred over artist image.
 * Never throws. Returns null if no verified artwork is available.
 *
 * @param {{ album?: { images?: Array<{url:string}>|null }|null }} trackData
 *   Spotify track payload. trackData.album.images[0] is the largest.
 * @param {{ appleArtworkUrl?: string|null }} resolved
 *   Resolved subject; used as fallback when no track/album data exists.
 * @returns {string|null}
 */
export function getBestVerifiedReleaseArtwork(trackData, resolved) {
  // Album-level images from track metadata are the most specific
  // release artwork signal. Spotify's album images are reliably present
  // when a track URL was the scan input.
  const fromAlbum = trackData?.album?.images?.[0]?.url || null;
  if (typeof fromAlbum === 'string' && fromAlbum) return fromAlbum;

  // Apple artwork is a valid fallback for artist-URL scans where no
  // track was resolved and album images are absent.
  const fromApple = resolved?.appleArtworkUrl || null;
  if (typeof fromApple === 'string' && fromApple) return fromApple;

  return null;
}
