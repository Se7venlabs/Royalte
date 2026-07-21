// ─────────────────────────────────────────────────────────────────────
//  Royaltē Canonical Recording Evidence™ — Normalization Assembler
// ─────────────────────────────────────────────────────────────────────
//
//  Constitutional position (Board Option B, Phase 2 Recovery,
//  2026-07-21 — Recording Intelligence Alignment):
//
//    Scan Engine
//        ↓
//    api/_lib/recording-evidence.js  (Normalization — structural
//        ↓                             relocation only)
//        ↓ Canonical Recording Evidence: artistName, spotifyTopTracks,
//        ↓   musicbrainzRecordings
//    Recording Intelligence™ (business logic: provider-shape
//                              normalization, cross-provider merge,
//                              ISRC certification, confidence scoring)
//        ↓
//    CIM §8.2.13 `recording`
//
//  This module performs STRUCTURAL RELOCATION ONLY: it moves the three
//  fields Recording Intelligence needs out of canonicalForEnrichment's
//  provider-namespaced paths into one flat, recording-domain-scoped
//  object. It never reshapes individual track records (that remains
//  lib/recording/recording-normalizer.js's job — provider-shape
//  normalization is business-adjacent, downstream work, not structural
//  relocation), never merges across providers, never scores or
//  certifies anything. Recording Intelligence retains sole ownership of
//  all of that. Same pattern as api/_lib/catalog-evidence.js,
//  api/_lib/backend-evidence.js, api/_lib/global-footprint-evidence.js.
//
//  ── Spotify — undocumented EvidenceBridge dependency, now documented ──
//
//  canonicalForEnrichment.platforms.spotify.details is ALWAYS null from
//  Path A (normalizeAuditResponse.js) alone -- confirmed in
//  governance/NORMALIZATION_LAYER_COMPLETION_REPORT.md and
//  governance/RECORDING_INTELLIGENCE_ARCHITECTURE_REVIEW.md. The ONLY
//  reason spotifyTopTracks is ever non-empty is that Spotify is one of
//  the two providers (Apple + Spotify) _mergeApplePalEvidence()
//  (lib/rie/index.js) merges from Path B (EvidenceBridge) into Path A's
//  output. This module does not change that underlying mechanism --
//  changing it is ADR-004's decision, not this module's -- it only makes
//  the dependency explicit and readable in one place, rather than buried
//  inside Recording Intelligence's own business-logic file.
//
//  ── MusicBrainz — verified defect, evidence preserved not fabricated ──
//
//  canonicalForEnrichment.platforms.musicbrainz.details is ALWAYS null,
//  for every scan, because MusicBrainz is not merge-authoritative in
//  _mergeApplePalEvidence() -- EvidenceBridge's
//  translateMusicBrainzRecordings() computes real data
//  (lib/rie/EvidenceBridge.js:403-421) from a real PAL acquisition
//  (mb-pal-acquisition.js requests Capability.TRACKS), and it is
//  discarded at the Path A/Path B merge boundary every time. This is
//  N1 (governance/NORMALIZATION_LAYER_COMPLETION_REPORT.md) manifesting
//  specifically for Recording Intelligence -- an architectural defect,
//  not an intentional design choice (no comment, ADR, or certification
//  anywhere states MusicBrainz recording evidence should be excluded).
//  Per Board direction (Phase 6): this module preserves the read --
//  musicbrainzRecordings stays part of the contract, structurally ready
//  to receive real data the moment ADR-004 promotes MusicBrainz to
//  merge-authoritative, with zero further code changes required. It does
//  NOT fabricate data, and it does NOT attempt to fix N1/ADR-004 itself
//  -- that remains explicitly out of scope for this alignment.
//
// ─────────────────────────────────────────────────────────────────────
//  Output shape:
//
//    {
//      artistName:            string,   // canonicalForEnrichment.subject.artistName, '' if absent
//      spotifyTopTracks:      Array,     // [{ id, name, isrc, artistName, previewUrl, popularity }]
//                                        // LIVE today -- see Spotify note above
//      musicbrainzRecordings: Array,     // [{ id, title, isrcs[], length, ... }]
//                                        // ALWAYS [] today -- see MusicBrainz note above (N1)
//    }
// ─────────────────────────────────────────────────────────────────────

function deepFreeze(obj) {
  if (obj === null || typeof obj !== 'object') return obj;
  for (const k of Object.keys(obj)) {
    const v = obj[k];
    if (v !== null && typeof v === 'object' && !Object.isFrozen(v)) deepFreeze(v);
  }
  return Object.freeze(obj);
}

// assembleRecordingEvidence(canonical) — sole entrypoint. Never throws,
// including against a malformed input whose properties throw on access
// (e.g. a hostile getter) — matching the "never throws on any input"
// invariant every other assembler in this codebase upholds.
export function assembleRecordingEvidence(canonical) {
  try {
    const safe = (canonical && typeof canonical === 'object' && !Array.isArray(canonical)) ? canonical : {};
    const spotifyTopTracks      = safe.platforms?.spotify?.details?.topTracks;
    const musicbrainzRecordings = safe.platforms?.musicbrainz?.details?.recordings;

    return deepFreeze({
      artistName:            typeof safe.subject?.artistName === 'string' ? safe.subject.artistName : '',
      spotifyTopTracks:      Array.isArray(spotifyTopTracks) ? spotifyTopTracks : [],
      musicbrainzRecordings: Array.isArray(musicbrainzRecordings) ? musicbrainzRecordings : [],
    });
  } catch (err) {
    console.error('[recording-evidence] assembly threw (returning empty shell):', err?.message || err);
    return deepFreeze({ artistName: '', spotifyTopTracks: [], musicbrainzRecordings: [] });
  }
}
