// api/ownership-verification.js
//
// Royaltē — Ownership & Publishing Verification Module
//
// Guidance + risk detection layer. Does NOT scrape, fabricate, or assume
// ownership data. Generates Songview-backed ASCAP/BMI search URLs and
// classifies ownership risk based on existing scan signals.
//
// Usage (from api/audit.js):
//   import {
//     evaluateOwnership,
//     evaluateOwnershipBatch,
//     renderOwnershipSection
//   } from './ownership-verification.js';

const DEFAULT_RECOMMENDATIONS = [
  'Verify songwriter and publisher registration using ASCAP or BMI Songview database.',
  'Confirm that all contributors are properly registered to receive royalties.',
  'Ensure ISRC and metadata match across all platforms.'
];

const SCORE_IMPACT = {
  verified: 10,
  unverified: 0,
  at_risk: -15
};

// ---------- helpers ----------

function normalizeConfidence(value) {
  if (!value) return null;
  const v = String(value).trim().toUpperCase();
  if (v === 'HIGH' || v === 'MEDIUM' || v === 'LOW' || v === 'AUTH_UNAVAILABLE') {
    return v;
  }
  return null;
}

function isHigh(confidence) {
  return normalizeConfidence(confidence) === 'HIGH';
}

function isLowOrMissing(confidence) {
  const c = normalizeConfidence(confidence);
  return c === null || c === 'LOW' || c === 'AUTH_UNAVAILABLE';
}

function buildAscapSearchUrl(trackName) {
  const encoded = encodeURIComponent(trackName || '');
  return `https://www.ascap.com/repertory#/ace/search/title/${encoded}`;
}

function buildBmiSearchUrl(trackName) {
  const encoded = encodeURIComponent(trackName || '');
  return (
    'https://repertoire.bmi.com/Search/Search' +
    '?SearchForm.View_Count=20' +
    `&SearchForm.Main_Search_Text=${encoded}` +
    '&SearchForm.Main_Search=Title'
  );
}

// ---------- core evaluator ----------

/**
 * Evaluate ownership verification status for a single track.
 *
 * @param {Object} input
 * @param {string} input.artist_name
 * @param {string} input.track_name
 * @param {string} [input.album_name]
 * @param {string} [input.isrc]
 * @param {string} [input.spotify_confidence]  HIGH | MEDIUM | LOW | AUTH_UNAVAILABLE
 * @param {string} [input.apple_confidence]    HIGH | MEDIUM | LOW | AUTH_UNAVAILABLE
 * @param {Object} [input.ownership_data]      Placeholder for future PRO data
 * @returns {Object} structured ownership verification result
 */
export function evaluateOwnership(input = {}) {
  const {
    artist_name = '',
    track_name = '',
    album_name = null,
    isrc = null,
    spotify_confidence = null,
    apple_confidence = null,
    ownership_data = null
  } = input;

  const issues = [];
  let ownership_status = 'unverified';
  let ownership_confidence = 'low';

  const hasIsrc = typeof isrc === 'string' && isrc.trim().length > 0;
  const spotifyHigh = isHigh(spotify_confidence);
  const appleHigh = isHigh(apple_confidence);
  const spotifyWeak = isLowOrMissing(spotify_confidence);
  const appleWeak = isLowOrMissing(apple_confidence);

  // Rule 4 (highest precedence): verified ownership data present.
  // Placeholder — only triggers once a real PRO data source is wired in.
  if (
    ownership_data &&
    typeof ownership_data === 'object' &&
    ownership_data.verified === true
  ) {
    ownership_status = 'verified';
    ownership_confidence = 'high';
  }
  // Rule 2: missing ISRC OR weak cross-platform confidence → at risk.
  else if (!hasIsrc || spotifyWeak || appleWeak) {
    ownership_status = 'at_risk';
    ownership_confidence = 'low';
    issues.push(
      'Unable to confidently match track across platforms — ownership registration may be incomplete or incorrect.'
    );
    if (!hasIsrc) {
      issues.push(
        'ISRC is missing — this is required for accurate PRO registration and royalty tracking.'
      );
    }
  }
  // Rule 3: strong cross-platform match but no ownership data → unverified (medium).
  else if (spotifyHigh && appleHigh) {
    ownership_status = 'unverified';
    ownership_confidence = 'medium';
    issues.push('Ownership data not confirmed via performing rights organizations.');
  }
  // Rule 1 fallback: default unverified / low.
  else {
    ownership_status = 'unverified';
    ownership_confidence = 'low';
    issues.push('Ownership data not confirmed via performing rights organizations.');
  }

  const recommendations = [...DEFAULT_RECOMMENDATIONS];
  const ascap_search_url = buildAscapSearchUrl(track_name);
  const bmi_search_url = buildBmiSearchUrl(track_name);
  const score_impact = SCORE_IMPACT[ownership_status] ?? 0;

  return {
    ownership_status,
    ownership_confidence,
    issues,
    recommendations,
    ascap_search_url,
    bmi_search_url,
    score_impact,
    context: {
      artist_name,
      track_name,
      album_name,
      isrc: hasIsrc ? isrc : null
    }
  };
}

// ---------- batch evaluator ----------

/**
 * Aggregate ownership evaluation across multiple tracks (e.g. artist scans).
 *
 * Aggregate status precedence:
 *   any at_risk    → at_risk
 *   all verified   → verified
 *   otherwise      → unverified
 *
 * Aggregate score_impact = sum of per-track impacts, clamped to [-15, +10].
 */
export function evaluateOwnershipBatch(tracks = [], artist_name = '') {
  const list = Array.isArray(tracks) ? tracks : [];

  const results = list.map((t) =>
    evaluateOwnership({
      artist_name: t.artist_name || artist_name,
      track_name: t.track_name || t.name || '',
      album_name: t.album_name || t.album || null,
      isrc: t.isrc || null,
      spotify_confidence: t.spotify_confidence ?? t.spotify?.confidence ?? null,
      apple_confidence: t.apple_confidence ?? t.apple?.confidence ?? null,
      ownership_data: t.ownership_data || null
    })
  );

  const hasAtRisk = results.some((r) => r.ownership_status === 'at_risk');
  const allVerified =
    results.length > 0 && results.every((r) => r.ownership_status === 'verified');

  let ownership_status = 'unverified';
  if (hasAtRisk) ownership_status = 'at_risk';
  else if (allVerified) ownership_status = 'verified';

  const ownership_confidence =
    ownership_status === 'verified'
      ? 'high'
      : ownership_status === 'at_risk'
        ? 'low'
        : 'medium';

  const rawScore = results.reduce((sum, r) => sum + (r.score_impact || 0), 0);
  const score_impact = Math.max(-15, Math.min(10, rawScore));

  // Deduplicate issues across tracks for the summary view.
  const issueSet = new Set();
  results.forEach((r) => r.issues.forEach((i) => issueSet.add(i)));
  const issues = Array.from(issueSet);

  // Artist-level search URLs fall back to the artist name when no single track
  // represents the scan (e.g. artist-page audits).
  const representative = list[0] || {};
  const repTrackName =
    representative.track_name || representative.name || artist_name || '';

  return {
    ownership_status,
    ownership_confidence,
    issues,
    recommendations: [...DEFAULT_RECOMMENDATIONS],
    ascap_search_url: buildAscapSearchUrl(repTrackName),
    bmi_search_url: buildBmiSearchUrl(repTrackName),
    score_impact,
    tracks: results,
    context: {
      artist_name,
      track_count: results.length,
      at_risk_count: results.filter((r) => r.ownership_status === 'at_risk').length,
      verified_count: results.filter((r) => r.ownership_status === 'verified').length
    }
  };
}

// ---------- render helpers (widget + PDF) ----------

const STATUS_LABEL = {
  verified: 'Verified',
  unverified: 'Needs Verification',
  at_risk: 'At Risk'
};

const STATUS_ICON = {
  verified: '✅',
  unverified: '⚠️',
  at_risk: '🚨'
};

/**
 * Render a plain-object payload for the chat widget / frontend card.
 * Matches the spec'd UI format in the module brief.
 */
export function renderOwnershipSection(result) {
  if (!result) return null;

  return {
    title: 'Ownership & Publishing Verification',
    status_label: STATUS_LABEL[result.ownership_status] || 'Needs Verification',
    status_icon: STATUS_ICON[result.ownership_status] || '⚠️',
    status: result.ownership_status,
    confidence: result.ownership_confidence,
    score_impact: result.score_impact,
    issues: result.issues || [],
    recommendations: result.recommendations || [],
    actions: [
      { label: 'Check ASCAP', url: result.ascap_search_url },
      { label: 'Check BMI', url: result.bmi_search_url }
    ]
  };
}

export default {
  evaluateOwnership,
  evaluateOwnershipBatch,
  renderOwnershipSection
};
