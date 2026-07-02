// Royaltē Recording Intelligence™ — Provider Shape Normalizer
//
// Converts raw provider track shapes into a common NormalizedTrack object
// so the matcher, builder, and confidence engine remain provider-agnostic.
//
// NormalizedTrack:
// {
//   source:     'spotify' | 'apple' | 'musicbrainz' | 'deezer',
//   trackId:    string | null,
//   title:      string,
//   isrc:       string | null,   // validated + uppercased; null if absent/invalid
//   durationMs: number | null,
//   artistName: string,
//   popularity: number | null,
// }
//
// Pure. No I/O. Never throws.

const ISRC_RE = /^[A-Z]{2}[A-Z0-9]{3}\d{7}$/;

function validIsrc(v) {
  if (typeof v !== 'string') return null;
  const t = v.trim().toUpperCase();
  return ISRC_RE.test(t) ? t : null;
}

function safeStr(v) { return typeof v === 'string' ? v.trim() : ''; }
function safeNum(v) { return typeof v === 'number' && Number.isFinite(v) ? v : null; }

// normalizeSpotifyTracks
//
// Input shape (from EvidenceBridge.translateSpotifyTopTracks):
//   [{ id, name, isrc, artistName, previewUrl, popularity }]
export function normalizeSpotifyTracks(topTracks = []) {
  if (!Array.isArray(topTracks)) return [];
  return topTracks
    .filter(t => t && typeof t.name === 'string' && t.name.trim())
    .map(t => Object.freeze({
      source:     'spotify',
      trackId:    safeStr(t.id) || null,
      title:      safeStr(t.name),
      isrc:       validIsrc(t.isrc),
      durationMs: safeNum(t.duration_ms) ?? safeNum(t.durationMs),
      artistName: safeStr(t.artistName),
      popularity: safeNum(t.popularity),
    }));
}

// normalizeAppleSongs
//
// Input shape (from getArtistSongs / Apple TRACKS evidence payload):
//   [{ id, name, isrc, albumName, durationInMillis }]
export function normalizeAppleSongs(songs = []) {
  if (!Array.isArray(songs)) return [];
  return songs
    .filter(s => s && typeof s.name === 'string' && s.name.trim())
    .map(s => Object.freeze({
      source:     'apple',
      trackId:    safeStr(s.id) || null,
      title:      safeStr(s.name),
      isrc:       validIsrc(s.isrc),
      durationMs: safeNum(s.durationInMillis),
      artistName: '',   // Apple song-level response does not include artist name
      popularity: null, // Apple does not expose a popularity integer
    }));
}

// normalizeMusicBrainzRecordings — future
//
// Input shape (from MusicBrainz recording search):
//   [{ id, title, isrc, length }]
export function normalizeMusicBrainzRecordings(recordings = []) {
  if (!Array.isArray(recordings)) return [];
  return recordings
    .filter(r => r && typeof r.title === 'string' && r.title.trim())
    .map(r => Object.freeze({
      source:     'musicbrainz',
      trackId:    safeStr(r.id) || null,
      title:      safeStr(r.title),
      isrc:       validIsrc(r.isrc),
      durationMs: safeNum(r.length),
      artistName: '',
      popularity: null,
    }));
}
