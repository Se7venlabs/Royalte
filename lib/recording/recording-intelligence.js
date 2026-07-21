// Royaltē Recording Intelligence™ — Constitutional Domain Assembler
//
// Phase 3.7 Board Authorization: 2026-07-02
//
// Produces the RecordingIntelligence domain object for the Canonical
// Intelligence Model (CIM §8.2.13 — Board extended at Phase 3.7).
//
// This assembler is:
//   - Pure (no I/O, no network, no side effects)
//   - Synchronous
//   - Deterministic (same input → same output)
//   - Provider-agnostic (reads normalized canonical, not raw provider payloads)
//
// Recording Intelligence Alignment (Phase 2 Recovery, 2026-07-21 — Board
// Option B, per governance/RECORDING_INTELLIGENCE_ARCHITECTURE_REVIEW.md):
// this assembler no longer reads canonicalForEnrichment directly. All
// structural relocation now lives in api/_lib/recording-evidence.js
// (assembleRecordingEvidence()), the constitutional owner of Recording
// Evidence, called once per scan in lib/rie/index.js before this
// function runs. This closes the last of the 4 CIO-bypass findings from
// governance/NORMALIZATION_LAYER_PLATFORM_CERTIFICATION.md (N4) /
// governance/adr/ADR-002-CIO-Scope.md.
//
// Evidence consumed from recordingEvidence (api/_lib/recording-evidence.js):
//   spotifyTopTracks       — Spotify top tracks with ISRCs (Phase 3.6)
//   musicbrainzRecordings  — MusicBrainz recordings with ISRCs (currently
//                            always [] — see recording-evidence.js's own
//                            header for why: N1/ADR-004, not a defect in
//                            this module)
//   artistName             — canonical artist name
//
// Future evidence (when Apple TRACKS flow through PAL):
//   Apple songs with ISRCs — would be added to recording-evidence.js's
//   contract, not read here directly.
//
// RecordingIntelligence output shape:
// {
//   _version:          '1.0',
//   recordingCount:    number,
//   certifiedCount:    number,          // certificationStatus = 'VERIFIED'
//   singleSourceCount: number,          // certificationStatus = 'SINGLE_SOURCE'
//   conflictCount:     number,          // certificationStatus = 'CONFLICT'
//   unconfirmedCount:  number,          // certificationStatus = 'UNABLE_TO_CONFIRM'
//   isrcCoveragePercent: number | null, // % with any ISRC (any status ≠ UNABLE_TO_CONFIRM)
//   overallConfidence:   number | null, // mean recording confidence 0.0–1.0
//   recordings:          CanonicalRecording[],  // each carries certificationStatus + confidence
//   generatedAt:         string,        // ISO-8601
// }
//
// Returns null when no track evidence is available — never throws.

import { normalizeSpotifyTracks, normalizeMusicBrainzRecordings } from './recording-normalizer.js';
import { buildCanonicalRecordings } from './canonical-recording.js';
import { certifyISRCs }             from './isrc-certification.js';
import { computeRecordingConfidence, computeOverallConfidence } from './recording-confidence.js';

const ASSEMBLER_VERSION = '1.0';

// ── Statistics ────────────────────────────────────────────────────

function computeStats(recordings) {
  let certified    = 0;
  let singleSource = 0;
  let conflict     = 0;
  let unconfirmed  = 0;

  for (const r of recordings) {
    switch (r.certificationStatus) {
      case 'VERIFIED':          certified++;    break;
      case 'SINGLE_SOURCE':     singleSource++; break;
      case 'CONFLICT':          conflict++;     break;
      case 'UNABLE_TO_CONFIRM': unconfirmed++;  break;
      default:                  unconfirmed++;
    }
  }

  const withIsrc       = certified + singleSource + conflict; // any ISRC status
  const coveragePercent = recordings.length > 0
    ? Math.round((withIsrc / recordings.length) * 100)
    : null;

  return { certified, singleSource, conflict, unconfirmed, coveragePercent };
}

// ── assembleRecordingIntelligence — sole entrypoint ──────────────
//
// @param {{ artistName: string, spotifyTopTracks: Array, musicbrainzRecordings: Array }} recordingEvidence
//   Already-relocated Canonical Recording Evidence — see
//   api/_lib/recording-evidence.js#assembleRecordingEvidence(). This
//   function performs intelligence only; it never reads
//   canonicalForEnrichment or any other raw canonical shape.

export function assembleRecordingIntelligence(recordingEvidence) {
  try {
    const safe = (recordingEvidence && typeof recordingEvidence === 'object' && !Array.isArray(recordingEvidence))
      ? recordingEvidence
      : {};
    const artistName = typeof safe.artistName === 'string' ? safe.artistName : '';

    const rawSpotifyTracks = Array.isArray(safe.spotifyTopTracks) ? safe.spotifyTopTracks : [];
    const rawMBRecordings  = Array.isArray(safe.musicbrainzRecordings) ? safe.musicbrainzRecordings : [];

    // No evidence → return null so the CIM slot stays null
    if (rawSpotifyTracks.length === 0 && rawMBRecordings.length === 0) {
      return null;
    }

    // Normalize to provider-agnostic NormalizedTrack shape.
    // Each normalizer owns its provider's native format — Recording Intelligence stays provider-agnostic.
    const normalizedSpotify = normalizeSpotifyTracks(rawSpotifyTracks);
    const normalizedMB      = normalizeMusicBrainzRecordings(rawMBRecordings);

    // Build canonical recordings (cross-provider title-key merge)
    // Phase 3.7: Spotify + MusicBrainz; Apple TRACKS activate in a future phase
    const canonicalRecordings = buildCanonicalRecordings({
      artistName,
      spotifyTracks: normalizedSpotify.map(t => ({
        name:    t.title,
        isrc:    t.isrc,
        trackId: t.trackId,
        id:      t.trackId,
      })),
      mbRecordings: normalizedMB.map(t => ({
        id:    t.trackId,
        title: t.title,
        isrc:  t.isrc,
      })),
    });

    // Certify ISRCs across all contributing sources
    const certified = certifyISRCs(canonicalRecordings);

    // Attach per-recording confidence score
    const withConfidence = certified.map(r =>
      Object.freeze({ ...r, confidence: computeRecordingConfidence(r) })
    );

    // Compute stats and overall confidence
    const stats             = computeStats(withConfidence);
    const overallConfidence = computeOverallConfidence(withConfidence);

    return Object.freeze({
      _version:           ASSEMBLER_VERSION,
      recordingCount:     withConfidence.length,
      certifiedCount:     stats.certified,
      singleSourceCount:  stats.singleSource,
      conflictCount:      stats.conflict,
      unconfirmedCount:   stats.unconfirmed,
      isrcCoveragePercent: stats.coveragePercent,
      overallConfidence,
      recordings:         Object.freeze(withConfidence),
      generatedAt:        new Date().toISOString(),
    });
  } catch {
    return null;
  }
}
