// ─────────────────────────────────────────────────────────────────────
//  Royaltē Canonical Scan Subject™ — Assembly Engine
// ─────────────────────────────────────────────────────────────────────
//
//  Two entrypoints, matching the two points in the scan pipeline where
//  the subject's known fields change (see api/schema/canonical-scan-subject.js
//  for the full constitutional position):
//
//    seedCanonicalScanSubject()   — called once, immediately after
//                                    Identity Resolution in run-scan.js,
//                                    before Provider Acquisition begins.
//    enrichWithAppleRelease()     — called once, inside
//                                    api/_lib/apple-pal-acquisition.js,
//                                    after the Apple ISRC->song lookup
//                                    resolves (or is confirmed absent).
//                                    Returns a NEW frozen object — never
//                                    mutates the seed.
//
//  Pure functions. Never throw. Never mutate inputs.
// ─────────────────────────────────────────────────────────────────────

import {
  emptyCanonicalScanSubject,
  SCAN_SUBJECT_TYPE,
  SCAN_SUBJECT_CONFIDENCE,
  deepFreeze,
} from '../schema/canonical-scan-subject.js';

// seedCanonicalScanSubject({ artistName, appleArtistId, spotifyArtistId, trackTitle, isrc })
//
// Called immediately after Identity Resolution (run-scan.js, right after
// `const appleIsrc = resolved.trackIsrc || trackData?.external_ids?.isrc || null;`).
// subjectType is 'release' whenever an ISRC is already known at this
// point — this is the fix: that ISRC previously flowed into a
// Capability.ISRC evidence request that nothing ever read back out.
export function seedCanonicalScanSubject({
  artistName      = null,
  appleArtistId   = null,
  spotifyArtistId = null,
  spotifyTrackId  = null,
  trackTitle      = null,
  isrc            = null,
} = {}) {
  const subject = emptyCanonicalScanSubject();

  subject.subjectType = isrc ? SCAN_SUBJECT_TYPE.RELEASE : SCAN_SUBJECT_TYPE.ARTIST;
  subject.artistName  = typeof artistName === 'string' && artistName !== '' ? artistName : null;
  subject.trackTitle  = typeof trackTitle === 'string' && trackTitle !== '' ? trackTitle : null;
  subject.isrc         = typeof isrc === 'string' && isrc !== '' ? isrc : null;

  subject.providerIds = {
    spotify: {
      artistId: typeof spotifyArtistId === 'string' && spotifyArtistId !== '' ? spotifyArtistId : null,
      trackId:  typeof spotifyTrackId  === 'string' && spotifyTrackId  !== '' ? spotifyTrackId  : null,
      albumId:  null,
    },
    apple: {
      artistId: typeof appleArtistId === 'string' && appleArtistId !== '' ? appleArtistId : null,
      trackId:  null,
      albumId:  null,
    },
  };

  // Not yet 'resolved' -- a provider release match hasn't confirmed the
  // subject yet. That happens in enrichWithAppleRelease() below.
  subject.confidence = SCAN_SUBJECT_CONFIDENCE.UNRESOLVED;

  return deepFreeze(subject);
}

// enrichWithAppleRelease(subject, appleSong)
//
// appleSong: the first entry of an Apple /catalog/{sf}/songs?filter[isrc]=X
//   &include=albums response's `data[]` array (raw Apple Song resource,
//   JSON:API shape), or null when no ISRC match was found / no ISRC was
//   known to search with.
//
// Returns a NEW frozen CanonicalScanSubject with providerIds.apple.trackId
// and .albumId populated from the matched song's own id and its
// relationships.albums.data[0].id (when Apple's response includes that
// relationship — see AppleMusicConnector#fetchByISRC's include=albums
// parameter). Never mutates the input subject.
export function enrichWithAppleRelease(subject, appleSong) {
  const base = (subject && typeof subject === 'object' && !Array.isArray(subject))
    ? subject
    : emptyCanonicalScanSubject();

  const enriched = {
    ...base,
    generatedAt: new Date().toISOString(),
    providerIds: {
      spotify: { ...base.providerIds?.spotify },
      apple:   { ...base.providerIds?.apple },
    },
  };

  const songId  = appleSong?.id ?? null;
  const albumId = appleSong?.relationships?.albums?.data?.[0]?.id ?? null;

  if (typeof songId === 'string' && songId !== '') {
    enriched.providerIds.apple.trackId = songId;
  }
  if (typeof albumId === 'string' && albumId !== '') {
    enriched.providerIds.apple.albumId = albumId;
    enriched.confidence = SCAN_SUBJECT_CONFIDENCE.RESOLVED;
  }

  return deepFreeze(enriched);
}
