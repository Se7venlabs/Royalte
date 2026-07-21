// ─────────────────────────────────────────────────────────────────────
//  Royaltē ISRC Intelligence™ — Assembler  (v1.0.0)
// ─────────────────────────────────────────────────────────────────────
//
//  Board directive, 2026-07-21 — APPROVED scope: "Apple Catalog–based
//  ISRC Intelligence™ as Version 1." Single authoritative evidence
//  source only (Apple Music Capability.TRACKS — the artist's own
//  official Apple catalog, real per-track ISRC attributes). No
//  cross-provider reconciliation, no conflict detection, no inferred
//  relationships in v1 — see Version 2 Roadmap below.
//
//  Constitutional position:
//
//    api/_lib/catalog-evidence.js
//        ↓ appleTracks[] (id/name/isrc/albumName), appleTracksAssessed (bool)
//    ISRC Intelligence™  ◀── THIS MODULE (business logic lives here)
//        ↓
//    api/_lib/catalog-intelligence.js (assembleCatalogIntelligence)
//        ↓
//    Mission Control™ · Catalog Intelligence™ workspace
//
//  Evidence-honesty philosophy (unchanged from every other domain in
//  this codebase): "0 verified" is not equivalent to "not assessed."
//  appleTracksAssessed is the ground-truth signal for whether the
//  Apple TRACKS evidence package was actually acquired — appleTracks
//  alone can't carry this distinction (both "never assessed" and
//  "assessed, zero recordings" collapse to an empty array).
//
//  Version handling: every Apple-listed recording (song resource) is
//  treated as independent. Live / Remix / Instrumental / Acoustic /
//  Radio Edit / Reprise / Remaster are NEVER collapsed or merged —
//  Royaltē has no dedicated recording-classification engine yet.
//
//  Match method: 'apple_catalog_direct' — the recording and its ISRC
//  come from the same first-party Apple Song resource; there is no
//  cross-provider matching step to describe in v1.
//
//  Conflict handling: conflictState is a typed schema field, always
//  'NOT_APPLICABLE' in v1. CONFLICT is not an implemented state —
//  it requires genuine multi-provider reconciliation, deferred to
//  Version 2.
//
//  Version 2 Roadmap (document only, NOT implemented here): Spotify
//  full-catalog reconciliation, Deezer full-catalog reconciliation,
//  MusicBrainz reconciliation, cross-provider canonical recording
//  identity, real conflict detection, match confidence hierarchy,
//  recording-version classification, recording equivalency engine.
//
//  Purity invariants:
//    - Pure function of (catalogEvidence, options.now).
//    - Never throws on any input (null / undefined / malformed).
//    - Never mutates inputs.
//    - Output is deep-frozen.
//    - The only non-deterministic input is the clock — options.now is
//      injectable for deterministic tests, defaulting to
//      () => new Date().toISOString() (same pattern as cio-assembler.js).
//
// ─────────────────────────────────────────────────────────────────────
//  Output shape (v1.0):
//
//    {
//      status:            string,   // 'ASSESSED_COMPLETE' | 'ASSESSED_PARTIAL'
//                                    // | 'NOT_ASSESSED' | 'NO_RECORDINGS'
//      assessedCount:     number,   // recordings evaluated
//      verifiedCount:     number,   // recordings with a real Apple-supplied ISRC
//      missingCount:      number,   // recordings with no ISRC on the Apple resource
//      coveragePercent:   number|null,  // 0–100; null when not assessed
//      conflictState:     'NOT_APPLICABLE',  // typed field only, v1
//      matchMethod:       string|null,  // 'apple_catalog_direct'; null when not assessed
//      missingRecordings: Array<{ title: string|null, reason: string }>,
//                                    // title is the real Apple recording name when
//                                    // known; NEVER fabricated. reason is a fixed
//                                    // vocabulary value (see MISSING_REASON below).
//      provenance: {
//        source:       'apple_music',
//        evidenceType: 'TRACKS',
//        assessedAt:   string,      // ISO 8601 timestamp
//      } | null,                    // null when not assessed
//    }
// ─────────────────────────────────────────────────────────────────────

export const ISRC_INTELLIGENCE_VERSION = '1.0.0';

export const IsrcAssessmentStatus = Object.freeze({
  ASSESSED_COMPLETE: 'ASSESSED_COMPLETE',
  ASSESSED_PARTIAL:  'ASSESSED_PARTIAL',
  NOT_ASSESSED:      'NOT_ASSESSED',
  NO_RECORDINGS:     'NO_RECORDINGS',
});

// Typed schema field only in v1 — always NOT_APPLICABLE. Do not implement
// CONFLICT until Version 2 introduces genuine multi-provider reconciliation.
export const IsrcConflictState = Object.freeze({
  NOT_APPLICABLE: 'NOT_APPLICABLE',
});

const MATCH_METHOD_APPLE_CATALOG_DIRECT = 'apple_catalog_direct';
const MISSING_REASON_NO_ISRC_ON_APPLE_RESOURCE = 'NO_ISRC_ON_APPLE_RESOURCE';

function deepFreeze(obj) {
  if (obj === null || typeof obj !== 'object') return obj;
  for (const k of Object.keys(obj)) {
    const v = obj[k];
    if (v !== null && typeof v === 'object' && !Object.isFrozen(v)) deepFreeze(v);
  }
  return Object.freeze(obj);
}

function defaultNow() {
  return new Date().toISOString();
}

function notAssessedShell() {
  return deepFreeze({
    status:            IsrcAssessmentStatus.NOT_ASSESSED,
    assessedCount:     0,
    verifiedCount:     0,
    missingCount:      0,
    coveragePercent:   null,
    conflictState:     IsrcConflictState.NOT_APPLICABLE,
    matchMethod:       null,
    missingRecordings: [],
    provenance:        null,
  });
}

// hasIsrc — an Apple Song resource carries a verified ISRC only when
// attributes.isrc is a non-empty string. Apple omits the attribute
// entirely (not an empty string) when a recording has no ISRC on file.
function hasIsrc(track) {
  return typeof track?.isrc === 'string' && track.isrc.length > 0;
}

// assembleIsrcIntelligence(catalogEvidence, options)
//
// Sole entrypoint for ISRC Intelligence™ v1. catalogEvidence is the
// Canonical Catalog Evidence object produced by api/_lib/catalog-evidence.js
// (appleTracks[], appleTracksAssessed).
//
// Always returns a deep-frozen object. Never throws.
export function assembleIsrcIntelligence(catalogEvidence, options = {}) {
  try {
    const now = typeof options.now === 'function' ? options.now : defaultNow;
    const evidence = (catalogEvidence && typeof catalogEvidence === 'object' && !Array.isArray(catalogEvidence))
      ? catalogEvidence
      : {};

    if (evidence.appleTracksAssessed !== true) return notAssessedShell();

    const tracks = Array.isArray(evidence.appleTracks) ? evidence.appleTracks : [];

    if (tracks.length === 0) {
      return deepFreeze({
        status:            IsrcAssessmentStatus.NO_RECORDINGS,
        assessedCount:     0,
        verifiedCount:     0,
        missingCount:      0,
        coveragePercent:   null,
        conflictState:     IsrcConflictState.NOT_APPLICABLE,
        matchMethod:       MATCH_METHOD_APPLE_CATALOG_DIRECT,
        missingRecordings: [],
        provenance: {
          source:       'apple_music',
          evidenceType: 'TRACKS',
          assessedAt:   now(),
        },
      });
    }

    const assessedCount = tracks.length;
    const verifiedTracks = tracks.filter(hasIsrc);
    const missingTracks  = tracks.filter((t) => !hasIsrc(t));
    const verifiedCount  = verifiedTracks.length;
    const missingCount   = missingTracks.length;
    const coveragePercent = Math.round((verifiedCount / assessedCount) * 100);

    // Never fabricate track names — title is the real Apple-supplied
    // name when present, null otherwise (never a placeholder string).
    const missingRecordings = missingTracks.map((t) => ({
      title:  typeof t?.name === 'string' && t.name.length > 0 ? t.name : null,
      reason: MISSING_REASON_NO_ISRC_ON_APPLE_RESOURCE,
    }));

    const status = missingCount === 0
      ? IsrcAssessmentStatus.ASSESSED_COMPLETE
      : IsrcAssessmentStatus.ASSESSED_PARTIAL;

    return deepFreeze({
      status,
      assessedCount,
      verifiedCount,
      missingCount,
      coveragePercent,
      conflictState: IsrcConflictState.NOT_APPLICABLE,
      matchMethod:   MATCH_METHOD_APPLE_CATALOG_DIRECT,
      missingRecordings,
      provenance: {
        source:       'apple_music',
        evidenceType: 'TRACKS',
        assessedAt:   now(),
      },
    });
  } catch (err) {
    console.error('[isrc-intelligence] assembly threw (returning NOT_ASSESSED shell):', err?.message || err);
    return notAssessedShell();
  }
}
