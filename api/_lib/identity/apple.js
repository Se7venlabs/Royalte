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
//   parseAppleMusicUrl(url)
//     Internal Apple URL parser. Exported because Stage 2+ rule code may
//     want it for normalization without invoking Apple at all.
//
// ─────────────────────────────────────────────────────────────────────────────

import { generateAppleToken } from '../../apple-token.js';

// ────────────────────────────────────────────────────────
// APPLE MUSIC RESOLUTION (input → artist name)
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

