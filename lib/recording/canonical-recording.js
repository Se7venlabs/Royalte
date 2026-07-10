// Royaltē Recording Intelligence™ — Canonical Recording Builder
//
// Produces CanonicalRecording objects from multi-source evidence.
// Each recording aggregates identifiers and ISRCs from Apple Music,
// Spotify, MusicBrainz, and Deezer without discarding provider values.
//
// CanonicalRecording shape:
// {
//   canonicalTitle:         string,           // from highest-authority source (Apple)
//   normalizedTitle:        string,           // version-stripped for search
//   artistName:             string,
//   appleTrackId:           string | null,
//   spotifyTrackId:         string | null,
//   musicBrainzRecordingId: string | null,
//   deezerTrackId:          string | null,
//   isrcs:                  string[],         // all ISRCs, deduplicated
//   sourceEvidence:         SourceEvidence[], // one per provider that contributed
// }
//
// SourceEvidence:
// { source: 'apple'|'spotify'|'musicbrainz'|'deezer', trackId, title, isrc }
//
// Pure. No I/O. Never throws.

import { normalizeTitle } from './title-normalizer.js';

const SOURCE_PRIORITY = ['apple', 'spotify', 'musicbrainz', 'deezer'];

function normKey(title) {
  return (title || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function addIsrc(set, isrc) {
  if (typeof isrc === 'string' && /^[A-Z]{2}[A-Z0-9]{3}\d{7}$/.test(isrc.trim())) {
    set.add(isrc.trim().toUpperCase());
  }
}

// buildCanonicalRecordings
//
// options:
//   artistName    string
//   appleSongs    [{ id, name, isrc, albumName }]         from getArtistSongs()
//   spotifyTracks [{ name, isrc, trackId? }]              from getSpotifyTopTracks()
//   mbRecordings  [{ id, title, isrc }]                   from MusicBrainz (future)
//   deezerTracks  [{ id, title, isrc }]                   from Deezer (future)
//
// Returns CanonicalRecording[]. If no sources provide data, returns [].
export function buildCanonicalRecordings({
  artistName   = '',
  appleSongs   = [],
  spotifyTracks = [],
  mbRecordings  = [],
  deezerTracks  = [],
} = {}) {
  // Index by normalized title so cross-source merging is reliable
  const byNormTitle = new Map(); // normKey → CanonicalRecording (mutable build object)

  function getOrCreate(canonicalTitle, source) {
    const key = normKey(canonicalTitle);
    if (!byNormTitle.has(key)) {
      byNormTitle.set(key, {
        canonicalTitle,
        normalizedTitle:        normalizeTitle(canonicalTitle),
        artistName,
        appleTrackId:           null,
        spotifyTrackId:         null,
        musicBrainzRecordingId: null,
        deezerTrackId:          null,
        isrcs:                  new Set(),
        sourceEvidence:         [],
        _sourcesSeen:           new Set(),
      });
    }
    return byNormTitle.get(key);
  }

  // ── Apple Music (canonical authority) ────────────────────────────
  for (const s of (appleSongs || [])) {
    if (!s || typeof s.name !== 'string') continue;
    const rec = getOrCreate(s.name, 'apple');
    if (!rec.appleTrackId) rec.appleTrackId = s.id || null;
    addIsrc(rec.isrcs, s.isrc);
    if (!rec._sourcesSeen.has('apple')) {
      rec.sourceEvidence.push({ source: 'apple', trackId: s.id || null, title: s.name, isrc: s.isrc || null });
      rec._sourcesSeen.add('apple');
    }
  }

  // ── Spotify (enrichment) ──────────────────────────────────────────
  for (const t of (spotifyTracks || [])) {
    if (!t || typeof t.name !== 'string') continue;
    const rec = getOrCreate(t.name, 'spotify');
    if (!rec.spotifyTrackId) rec.spotifyTrackId = t.trackId || t.id || null;
    addIsrc(rec.isrcs, t.isrc);
    if (!rec._sourcesSeen.has('spotify')) {
      rec.sourceEvidence.push({ source: 'spotify', trackId: t.trackId || t.id || null, title: t.name, isrc: t.isrc || null });
      rec._sourcesSeen.add('spotify');
    }
  }

  // ── MusicBrainz (future) ──────────────────────────────────────────
  for (const r of (mbRecordings || [])) {
    if (!r || typeof r.title !== 'string') continue;
    const rec = getOrCreate(r.title, 'musicbrainz');
    if (!rec.musicBrainzRecordingId) rec.musicBrainzRecordingId = r.id || null;
    addIsrc(rec.isrcs, r.isrc);
    if (!rec._sourcesSeen.has('musicbrainz')) {
      rec.sourceEvidence.push({ source: 'musicbrainz', trackId: r.id || null, title: r.title, isrc: r.isrc || null });
      rec._sourcesSeen.add('musicbrainz');
    }
  }

  // ── Deezer (future) ───────────────────────────────────────────────
  for (const d of (deezerTracks || [])) {
    if (!d || typeof d.title !== 'string') continue;
    const rec = getOrCreate(d.title, 'deezer');
    if (!rec.deezerTrackId) rec.deezerTrackId = String(d.id || '');
    addIsrc(rec.isrcs, d.isrc);
    if (!rec._sourcesSeen.has('deezer')) {
      rec.sourceEvidence.push({ source: 'deezer', trackId: String(d.id || ''), title: d.title, isrc: d.isrc || null });
      rec._sourcesSeen.add('deezer');
    }
  }

  // Freeze and return — convert Sets to sorted arrays
  return Array.from(byNormTitle.values()).map(rec => {
    const isrcs = Array.from(rec.isrcs).sort();
    const { _sourcesSeen, ...rest } = rec;
    return Object.freeze({ ...rest, isrcs });
  });
}
