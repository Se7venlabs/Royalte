// ─────────────────────────────────────────────────────────────────────
//  Royaltē Canonical Scan Subject™ — Schema definition
// ─────────────────────────────────────────────────────────────────────
//
//  Board directive (Phase 2 Recovery, 2026-07-20): correct a confirmed
//  defect where Territory Intelligence evaluated an arbitrary album
//  (whichever the Apple Albums API happened to list first) instead of
//  the release the artist actually scanned, even though the correct
//  release was already resolved via ISRC earlier in the pipeline and
//  simply discarded before Territory Intelligence ran.
//
//  SCOPE OF THIS IMPLEMENTATION (deliberately narrow — see
//  governance/PHASE_2_RECOVERY_TERRITORY_VALIDATION.md history in this
//  program's PR discussion for the larger initiative this is scoped
//  out of):
//    - Release-centric only. Two subject types: 'release' (a specific
//      track/ISRC was resolved) and 'artist' (no specific track was
//      resolved — the pre-existing artist-only scan case).
//    - Apple provider identifiers only. Spotify/Deezer identifiers are
//      captured when already known from identity resolution, but no
//      new Spotify/Deezer release-resolution logic is introduced here.
//    - No speculative future scope taxonomy (Publisher, Playlist,
//      Rights Holder, Label, Collection, etc.) — Release vs. Catalog
//      scope is a separate, future, evidence-based initiative.
//
//  This file is SCHEMA ONLY. No resolution logic. No I/O. No mutation
//  of external state. Assembly logic lives in
//  api/_lib/canonical-scan-subject-assembler.js.
//
// ─────────────────────────────────────────────────────────────────────
//  Constitutional position:
//
//    Identity Resolution (run-scan.js resolveToArtist())
//        ↓
//    Canonical Scan Subject™ — SEED  ◀── created here, immediately
//        ↓                            after identity resolution, with
//        ↓                            whatever is already known
//    Provider Acquisition (Apple PAL)
//        ↓
//    Canonical Scan Subject™ — ENRICHED  ◀── same object, new frozen
//        ↓                                  version, once the Apple
//        ↓                                  ISRC→song→album lookup
//        ↓                                  resolves (or confirmed
//        ↓                                  absent, for artist-only
//        ↓                                  scans)
//    Territory Intelligence Engine (unchanged — consumes whatever
//        ↓                          appleAlbumId flows into its
//        ↓                          evidence packages; never receives
//        ↓                          this object directly)
//    Mission Control
//
// ─────────────────────────────────────────────────────────────────────
//  Output shape:
//
//    {
//      _version: string,
//      generatedAt: string,        // ISO timestamp
//      subjectType: 'release' | 'artist',
//      artistName: string | null,
//      trackTitle: string | null,
//      isrc: string | null,
//      providerIds: {
//        spotify: { artistId: string|null, trackId: string|null, albumId: string|null },
//        apple:   { artistId: string|null, trackId: string|null, albumId: string|null },
//      },
//      confidence: 'resolved' | 'unresolved',  // 'resolved' once a provider
//                                               // release match confirms the
//                                               // subject; 'unresolved' until then
//    }
// ─────────────────────────────────────────────────────────────────────

export const CANONICAL_SCAN_SUBJECT_VERSION = '1.0.0';

export const SCAN_SUBJECT_TYPE = Object.freeze({
  RELEASE: 'release',
  ARTIST:  'artist',
});

export const SCAN_SUBJECT_CONFIDENCE = Object.freeze({
  RESOLVED:   'resolved',
  UNRESOLVED: 'unresolved',
});

function deepFreeze(obj) {
  if (obj === null || typeof obj !== 'object') return obj;
  for (const k of Object.keys(obj)) {
    const v = obj[k];
    if (v !== null && typeof v === 'object' && !Object.isFrozen(v)) deepFreeze(v);
  }
  return Object.freeze(obj);
}

// emptyCanonicalScanSubject: blank shell with every required field present.
// Assembly logic (canonical-scan-subject-assembler.js) populates and freezes it.
export function emptyCanonicalScanSubject() {
  return {
    _version:    CANONICAL_SCAN_SUBJECT_VERSION,
    generatedAt: new Date().toISOString(),
    subjectType: SCAN_SUBJECT_TYPE.ARTIST,
    artistName:  null,
    trackTitle:  null,
    isrc:        null,
    providerIds: {
      spotify: { artistId: null, trackId: null, albumId: null },
      apple:   { artistId: null, trackId: null, albumId: null },
    },
    confidence: SCAN_SUBJECT_CONFIDENCE.UNRESOLVED,
  };
}

// validateCanonicalScanSubject: structural check. Returns { valid, errors }.
// Never throws.
export function validateCanonicalScanSubject(subject) {
  const errors = [];
  if (!subject || typeof subject !== 'object' || Array.isArray(subject)) {
    return { valid: false, errors: ['not_an_object'] };
  }
  if (!Object.values(SCAN_SUBJECT_TYPE).includes(subject.subjectType)) errors.push('invalid_subjectType');
  if (!Object.values(SCAN_SUBJECT_CONFIDENCE).includes(subject.confidence)) errors.push('invalid_confidence');
  if (!subject.providerIds || typeof subject.providerIds !== 'object') errors.push('missing_providerIds');
  return { valid: errors.length === 0, errors };
}

export { deepFreeze };
