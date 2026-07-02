// Royaltē Recording Intelligence™ — Recording Confidence Engine
//
// Produces a deterministic per-recording confidence score (0.0–1.0) and
// an overall confidence metric across the full recording set.
//
// Confidence Dimensions (Board-locked weights — Phase 3.7):
//
//   ISRC certification  (0.00–0.40) — highest weight; ISRCs are the industry
//                                      identifier; agreement across sources is
//                                      the strongest signal of authenticity.
//
//   Provider coverage   (0.00–0.30) — more independent sources → higher trust.
//
//   Title agreement     (0.00–0.20) — normalized titles from multiple sources
//                                      converging on the same key strengthens
//                                      identity confidence.
//
//   Artist agreement    (0.00–0.10) — reserved; will activate when Apple and
//                                      Spotify artist names can be compared.
//                                      Currently contributes 0.10 base value.
//
// Pure. No I/O. Never throws.

import { normalizeTitle } from './title-normalizer.js';

// ── Board-locked dimension weights (sum = 1.0) ────────────────────
const W_ISRC     = 0.40;
const W_PROVIDER = 0.30;
const W_TITLE    = 0.20;
const W_ARTIST   = 0.10;

function normKey(v) {
  return typeof v === 'string'
    ? normalizeTitle(v).toLowerCase().replace(/[^a-z0-9]/g, '')
    : '';
}

// computeRecordingConfidence
//
// Accepts a CanonicalRecording (with certificationStatus + sourceEvidence).
// Returns 0.0–1.0 (rounded to 2 decimal places).
export function computeRecordingConfidence(rec) {
  if (!rec || typeof rec !== 'object') return 0;

  const evidence = Array.isArray(rec.sourceEvidence) ? rec.sourceEvidence : [];

  // ── ISRC dimension ─────────────────────────────────────────────
  let isrcScore = 0;
  switch (rec.certificationStatus) {
    case 'VERIFIED':          isrcScore = W_ISRC;       break; // ≥2 sources agree
    case 'SINGLE_SOURCE':     isrcScore = W_ISRC * 0.5; break; // 1 source; unverified
    case 'CONFLICT':          isrcScore = W_ISRC * 0.2; break; // sources disagree
    case 'UNABLE_TO_CONFIRM': isrcScore = 0;             break; // no ISRC at all
    default:                  isrcScore = 0;
  }

  // ── Provider coverage dimension ───────────────────────────────
  const sourceCount = evidence.length;
  let providerScore = 0;
  if      (sourceCount >= 3) providerScore = W_PROVIDER;
  else if (sourceCount === 2) providerScore = W_PROVIDER * 0.65;
  else if (sourceCount === 1) providerScore = W_PROVIDER * 0.30;

  // ── Title agreement dimension ─────────────────────────────────
  const titles = evidence.map(e => normKey(e.title ?? '')).filter(Boolean);
  let titleScore = 0;
  if (titles.length >= 2) {
    const unique = new Set(titles);
    titleScore = unique.size === 1 ? W_TITLE : W_TITLE * 0.20; // full if all agree
  } else if (titles.length === 1) {
    titleScore = W_TITLE * 0.50; // single-source title
  }

  // ── Artist agreement dimension (reserved) ─────────────────────
  // Phase 3.7: no multi-provider artist name comparison possible yet.
  // Base contribution of full W_ARTIST (no known conflicts).
  const artistScore = W_ARTIST;

  const raw = isrcScore + providerScore + titleScore + artistScore;
  return Math.round(Math.min(1.0, Math.max(0.0, raw)) * 100) / 100;
}

// computeOverallConfidence
//
// Returns the mean recording confidence across all recordings, or null
// when the recording set is empty.
export function computeOverallConfidence(certifiedRecordings = []) {
  if (!Array.isArray(certifiedRecordings) || certifiedRecordings.length === 0) {
    return null;
  }
  const sum = certifiedRecordings.reduce(
    (acc, r) => acc + (computeRecordingConfidence(r)),
    0,
  );
  return Math.round((sum / certifiedRecordings.length) * 100) / 100;
}
