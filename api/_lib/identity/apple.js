// ─────────────────────────────────────────────────────────────────────────────
// IDENTITY INTELLIGENCE™ — APPLE ADAPTER
// ─────────────────────────────────────────────────────────────────────────────
// Phase 1, Stage 1 — pure behavior-preserving extract from
// api/_lib/run-scan.js (Apple resolution block 673-983). No new resolution
// logic, no shape changes, no Apple-API behavior changes. Every function
// here is byte-equivalent to its prior inline version in run-scan.js; the
// only thing that changed is where the module lives and how it's imported.
//
// Why this file exists
//   The locked architecture treats Apple as the *canonical* identity provider
//   (PR #108 made Spotify optional and Apple unconditional). Until now the
//   Apple resolution code was inlined inside the scan orchestrator. Pulling
//   it into a named adapter under api/_lib/identity/ creates the single
//   injection point the Identity Intelligence™ Engine needs — and prepares
//   the slot for future enrichment adapters (Spotify, Amazon, YouTube,
//   MusicBrainz, Discogs) to plug in behind the same engine.
//
// Public API
//   resolveAppleArtist(appleUrl)
//     Apple Music URL (artist/song/album) → { name, artworkUrl,
//     appleArtistId, storefront, [trackTitle, trackIsrc] } | null
//
//   resolveAppleArtistName(appleUrl)
//     Backwards-compat alias used by older call sites — returns just the
//     artist name (or null).
//
//   getAppleMusic(artistName, isrc, spotifyTopTracks = [], options = {})
//     Cross-platform enrichment AFTER artist is known. Resolves to the
//     scan-response shape:
//       { found, artistId, artistUrl, genres, albumCount, albums[],
//         storefrontAvailability, isrcLookup, catalogComparison }
//     options.appleArtistId — ID-direct path (skips Apple's strict name-
//                              search step that can miss artists whose URLs
//                              we just parsed). PR #108 Phase 2.
//     options.storefront    — defaults to 'us'.
//
//   parseAppleMusicUrl(url)
//     Internal Apple URL parser. Exported because Stage 2+ rule code may
//     want it for normalization without invoking Apple at all.
//
// ─────────────────────────────────────────────────────────────────────────────

import { generateAppleToken } from '../../apple-token.js';
import { lookupByISRC, checkStorefrontAvailability } from '../../apple-music.js';

// ────────────────────────────────────────────────────────
// APPLE MUSIC RESOLUTION (input → artist name)
// Separate responsibility from getAppleMusic() which is cross-platform
// enrichment AFTER artist is known.
// Supports artist / song / album URLs from music.apple.com.
// ────────────────────────────────────────────────────────
export async function resolveAppleArtist(appleUrl) {
  try {
    const meta = parseAppleMusicUrl(appleUrl);
    if (!meta) return null;

    const appleToken = generateAppleToken();
    const headers = { Authorization: `Bearer ${appleToken}` };
    const BASE = 'https://api.music.apple.com/v1';
    const sf = meta.storefront || 'us';

    const formatArtwork = (artwork) => {
      if (!artwork || !artwork.url) return null;
      // Apple's url is a template like https://....{w}x{h}bb.jpg
      // Substitute 600x600 for a high-quality square image.
      return artwork.url.replace('{w}', '600').replace('{h}', '600');
    };

    if (meta.kind === 'artist') {
      const r = await fetch(`${BASE}/catalog/${sf}/artists/${meta.id}`, { headers });
      if (!r.ok) return null;
      const data = await r.json();
      const attrs = data?.data?.[0]?.attributes;
      if (!attrs) return null;
      // Artist endpoint sometimes lacks artwork — fall back to artist search
      let artworkUrl = formatArtwork(attrs.artwork);
      if (!artworkUrl) {
        const sresp = await fetch(`${BASE}/catalog/${sf}/search?term=${encodeURIComponent(attrs.name)}&types=artists&limit=3`, { headers });
        if (sresp.ok) {
          const sdata = await sresp.json();
          const match = sdata?.results?.artists?.data?.[0];
          artworkUrl = formatArtwork(match?.attributes?.artwork);
        }
      }
      return { name: attrs.name, artworkUrl, appleArtistId: meta.id, storefront: sf };
    }

    if (meta.kind === 'song') {
      const r = await fetch(`${BASE}/catalog/${sf}/songs/${meta.id}`, { headers });
      if (!r.ok) return null;
      const data = await r.json();
      const attrs = data?.data?.[0]?.attributes;
      if (!attrs?.artistName) return null;
      // Songs always have artwork (album cover) — use as fallback
      const artworkUrl = formatArtwork(attrs.artwork);
      const appleArtistId = data?.data?.[0]?.relationships?.artists?.data?.[0]?.id || null;
      return { name: attrs.artistName, artworkUrl, appleArtistId, trackTitle: attrs.name ?? null, trackIsrc: attrs.isrc ?? null, storefront: sf };
    }

    if (meta.kind === 'album') {
      // If the URL contains ?i=<songId> Apple treats it as a song — try song first
      if (meta.songId) {
        const rs = await fetch(`${BASE}/catalog/${sf}/songs/${meta.songId}`, { headers });
        if (rs.ok) {
          const data = await rs.json();
          const attrs = data?.data?.[0]?.attributes;
          if (attrs?.artistName) {
            const appleArtistId = data?.data?.[0]?.relationships?.artists?.data?.[0]?.id || null;
            return { name: attrs.artistName, artworkUrl: formatArtwork(attrs.artwork), appleArtistId, trackTitle: attrs.name ?? null, trackIsrc: attrs.isrc ?? null, storefront: sf };
          }
        }
      }
      const r = await fetch(`${BASE}/catalog/${sf}/albums/${meta.id}`, { headers });
      if (!r.ok) return null;
      const data = await r.json();
      const attrs = data?.data?.[0]?.attributes;
      if (!attrs?.artistName) return null;
      const appleArtistId = data?.data?.[0]?.relationships?.artists?.data?.[0]?.id || null;
      return { name: attrs.artistName, artworkUrl: formatArtwork(attrs.artwork), appleArtistId, storefront: sf };
    }

    return null;
  } catch (err) {
    console.error('Apple resolution error:', err.message);
    return null;
  }
}

// Backwards-compat alias — keep the old function name in case anything else calls it
export async function resolveAppleArtistName(appleUrl) {
  const r = await resolveAppleArtist(appleUrl);
  return r ? r.name : null;
}

export function parseAppleMusicUrl(url) {
  try {
    const u = new URL(url);
    if (!u.hostname.includes('music.apple.com')) return null;
    const parts = u.pathname.split('/').filter(Boolean);
    // Expected shape: /<storefront>/<kind>/<slug>/<id>
    // kind ∈ { artist, song, album }
    const storefront = parts[0] || 'us';
    const kindIdx = parts.findIndex(p => p === 'artist' || p === 'song' || p === 'album');
    if (kindIdx === -1) return null;
    const kind = parts[kindIdx];
    const id = parts[parts.length - 1]; // last segment is the numeric id
    if (!id) return null;
    const songId = u.searchParams.get('i') || null;
    return { storefront, kind, id, songId };
  } catch { return null; }
}

// ────────────────────────────────────────────────────────
// APPLE MUSIC — artist search, ISRC lookup, catalog comparison
// (existing cross-platform enrichment — runs AFTER artist is known)
// ────────────────────────────────────────────────────────
// 2026-06-07 scan-engine-converge Phase 2 — options.appleArtistId lets
// the unified pipeline call this with an Apple ID known from the URL
// (Apple URL inputs always have one from resolveAppleArtist). Skipping
// the name-search step removes the strict-exact-match failure mode for
// the same artist whose URL we just resolved. Spotify-URL callers (no
// known Apple ID) keep the existing name-search behavior.
export async function getAppleMusic(artistName, isrc, spotifyTopTracks = [], options = {}) {
  try {
    const appleToken = generateAppleToken();
    const STOREFRONT = options.storefront || 'us';
    const BASE = 'https://api.music.apple.com/v1';

    const headers = { Authorization: `Bearer ${appleToken}` };

    let artistFound = false;
    let appleArtistId = null;
    let appleArtistUrl = null;
    let appleArtistGenres = [];
    let appleAlbumCount = 0;
    let appleAlbums = [];

    if (options.appleArtistId) {
      // ID-direct path: fetch artist record for url/genres, then drop
      // into the existing album-list fetch below.
      appleArtistId = options.appleArtistId;
      artistFound = true;
      try {
        const ar = await fetch(`${BASE}/catalog/${STOREFRONT}/artists/${appleArtistId}`, { headers });
        if (ar.ok) {
          const ad = await ar.json();
          const attrs = ad?.data?.[0]?.attributes;
          appleArtistUrl    = attrs?.url || null;
          appleArtistGenres = attrs?.genreNames || [];
        }
      } catch (e) {
        console.warn(`[apple-id] artist record fetch failed for ${appleArtistId}: ${e.message}`);
      }
    } else {
      // Name-search path (Spotify URL inputs without a known Apple ID).
      const artistQuery = encodeURIComponent(artistName);
      const artistResp = await fetch(
        `${BASE}/catalog/${STOREFRONT}/search?term=${artistQuery}&types=artists&limit=5`,
        { headers }
      );

      if (artistResp.ok) {
        const artistData = await artistResp.json();
        const artists = artistData?.results?.artists?.data || [];
        const norm = s => s.toLowerCase().trim();
        const match = artists.find(a => norm(a.attributes?.name) === norm(artistName)) || null;
        if (!match && artists.length) {
          console.log(`[identity] Apple returned ${artists.length} candidates for "${artistName}" but no exact match — skipping Apple Music enrichment`);
        }
        if (match) {
          artistFound = true;
          appleArtistId = match.id;
          appleArtistUrl = match.attributes?.url || null;
          appleArtistGenres = match.attributes?.genreNames || [];
        }
      }
    }

    if (artistFound && appleArtistId) {
      {

        // Get album list (up to 25). We previously surfaced only the count;
        // the full list is the source for V2 releases[] / EPs / Singles /
        // Tracks (Brief 008). attributes.trackCount lets the consumer side
        // classify each release: 1 → Single · 2–6 → EP · 7+ → Album.
        const albumResp = await fetch(
          `${BASE}/catalog/${STOREFRONT}/artists/${appleArtistId}/albums?limit=25`,
          { headers }
        );
        if (albumResp.ok) {
          const albumData = await albumResp.json();
          const rows = albumData?.data || [];
          appleAlbumCount = rows.length;
          appleAlbums = rows.map((a) => ({
            id:          a.id || null,
            name:        a.attributes?.name || null,
            releaseDate: a.attributes?.releaseDate || null,
            trackCount:  (typeof a.attributes?.trackCount === 'number') ? a.attributes.trackCount : null,
            url:         a.attributes?.url || null,
            // Brief 015k Fix #1 — persist cover artwork so Mission Control's
            // Intelligence Feed can render real release art instead of the
            // music-icon fallback. Apple Music returns a URL template with
            // {w}x{h} placeholders; we substitute 300×300 here so the
            // stored URL is immediately usable by any consumer (dashboard
            // displays at 56×56 — 300×300 is ~retina-5×, slightly heavy
            // bandwidth but matches the pattern already used in
            // api/apple-music.js:79-81 / 117-119). Pre-existing scans
            // won't have this field until they re-scan.
            artwork:     a.attributes?.artwork?.url
              ? a.attributes.artwork.url.replace('{w}', '300').replace('{h}', '300')
              : null,
          }));
        }
      }
    }

    // Brief 011 — BIG 6 storefront availability. Reuses the same JWT
    // (single shared `headers` object) for 7 parallel `/catalog/{sf}/
    // albums?ids=...` calls. Failure on any one storefront is isolated
    // to that storefront's entry; others continue. Skipped entirely on
    // an artist with no Apple Music albums.
    let storefrontAvailability = null;
    if (appleAlbums.length > 0) {
      const albumIds = appleAlbums.map((a) => a.id).filter(Boolean);
      if (albumIds.length > 0) {
        try {
          storefrontAvailability = await checkStorefrontAvailability(albumIds, headers);
        } catch (sfErr) {
          // checkStorefrontAvailability already isolates per-storefront
          // errors; a top-level throw here means the whole Promise.all
          // failed (e.g. headers / network catastrophe). Leave the field
          // null so the dashboard renders the "—" empty state.
          console.error('Apple Music storefront availability failed:', sfErr.message);
        }
      }
    }

    // 2. ISRC lookup for the specific track (if track scan)
    let isrcResult = null;
    if (isrc) {
      const r = await lookupByISRC(isrc);
      // Preserve original semantics: only surface definitive results.
      // Helper errors (r.error present) stay invisible so the
      // "ISRC found on Spotify but not on Apple Music" flag at
      // audit.js:1253 doesn't fire on transient Apple API failures.
      if (!r.error) isrcResult = r;
    }

    // 3. Compare Spotify top tracks against Apple Music catalog
    let catalogComparison = null;
    if (spotifyTopTracks.length > 0) {
      const matched = [];
      const notFound = [];

      for (const track of spotifyTopTracks.slice(0, 10)) { // limit to 10 to avoid rate limits
        let found = false;

        if (track.isrc) {
          found = (await lookupByISRC(track.isrc)).found;
        }

        if (!found) {
          // Fallback: search by name
          const q = encodeURIComponent(`${track.name} ${track.artistName}`);
          const searchResp = await fetch(
            `${BASE}/catalog/${STOREFRONT}/search?term=${q}&types=songs&limit=3`,
            { headers }
          );
          if (searchResp.ok) {
            const searchData = await searchResp.json();
            const songs = searchData?.results?.songs?.data || [];
            const norm = s => s.toLowerCase().trim();
            // 2026-06-05 identity-lock — require BOTH track name AND artist
            // name to match. Previously the name-only check let a same-titled
            // track from a different artist count as a match, inflating the
            // catalog-comparison match rate.
            found = songs.some(s =>
              norm(s.attributes?.name) === norm(track.name) &&
              norm(s.attributes?.artistName || '') === norm(track.artistName || '')
            );
          }
        }

        if (found) {
          matched.push(track.name);
        } else {
          notFound.push(track.name);
        }
      }

      const total = matched.length + notFound.length;
      catalogComparison = {
        tracksChecked: total,
        matched: matched.length,
        notFound,
        matchRate: total > 0 ? Math.round((matched.length / total) * 100) : 0,
      };
    }

    return {
      found: artistFound,
      artistId: appleArtistId,
      artistUrl: appleArtistUrl,
      genres: appleArtistGenres,
      albumCount: appleAlbumCount,
      albums: appleAlbums,
      storefrontAvailability,
      isrcLookup: isrcResult,
      catalogComparison,
    };

  } catch (err) {
    console.error('Apple Music error:', err.message);
    return { found: false, error: err.message };
  }
}
