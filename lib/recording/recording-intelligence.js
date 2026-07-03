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
// Evidence consumed from canonicalForEnrichment:
//   platforms.spotify.details.topTracks  — Spotify top tracks with ISRCs (Phase 3.6)
//   subject.artistName                   — canonical artist name
//
// Future evidence (when Apple TRACKS flow through PAL):
//   platforms.appleMusic.details.songs   — Apple songs with ISRCs
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

// ── Evidence extraction ───────────────────────────────────────────

function extractSpotifyTracks(canonicalForEnrichment) {
  const topTracks = canonicalForEnrichment?.platforms?.spotify?.details?.topTracks;
  return Array.isArray(topTracks) ? topTracks : [];
}

function extractMBRecordings(canonicalForEnrichment) {
  const recordings = canonicalForEnrichment?.platforms?.musicbrainz?.details?.recordings;
  return Array.isArray(recordings) ? recordings : [];
}

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

export function assembleRecordingIntelligence(canonicalForEnrichment) {
  try {
    const artistName = canonicalForEnrichment?.subject?.artistName ?? '';

    // Extract evidence from every available provider
    const rawSpotifyTracks = extractSpotifyTracks(canonicalForEnrichment);
    const rawMBRecordings  = extractMBRecordings(canonicalForEnrichment);

    // No evidence → return null so the CIM slot stays null
    if (rawSpotifyTracks.length === 0 && rawMBRecordings.length === 0) {
      return null;
    }

    // Normalize to provider-agnostic NormalizedTrack shape
    const normalizedSpotify = normalizeSpotifyTracks(rawSpotifyTracks);
    // MB recordings have shape [{ id, title, isrcs[], length }] — map isrcs[0] → isrc
    const mbForBuilder = rawMBRecordings.map(r => ({
      id:    r.id    ?? null,
      title: r.title ?? '',
      isrc:  Array.isArray(r.isrcs) && r.isrcs.length ? r.isrcs[0] : null,
    }));
    const normalizedMB = normalizeMusicBrainzRecordings(mbForBuilder);

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
