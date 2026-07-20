// ─────────────────────────────────────────────────────────────────────
//
// Royaltē Health Intelligence™ v1.0
//
// Interpretation layer over the canonical Royaltē Health Score™.
// Reads; never calculates a health score. Never fetches.
//
// computeHealthScore() in api/_lib/health-engine.js is the sole
// constitutional authority for Royaltē Health Scores™. This module
// reads that output and adds:
//   - Status vocabulary (Excellent / Strong / Moderate / Needs Review)
//   - Per-domain contributor scores (informational display only —
//     these do NOT drive the overall score)
//   - Confidence (derived from domain data coverage)
//   - Strengths[] and Concerns[] (derived from domain thresholds)
//
// Called once per scan from api/audit.js AFTER computeHealthScore()
// runs. Output persisted to audit_scans.payload.healthIntelligence.
// MC reads it only from there.
//
// Invariant enforced here:
//   payload.healthIntelligence.score === payload.healthScore.overallScore
//
// ─────────────────────────────────────────────────────────────────────

export const HEALTH_INTELLIGENCE_VERSION = '1.0.0';

// ── Status vocabulary bands ───────────────────────────────────────────
// Maps the canonical overallScore (0-100) to a display status string.
// Vocabulary is Board-locked: Excellent / Strong / Moderate / Needs Review.
const STATUS_BANDS = [
  { min: 90, max: 100, status: 'Excellent'    },
  { min: 75, max:  89, status: 'Strong'       },
  { min: 60, max:  74, status: 'Moderate'     },
  { min:  0, max:  59, status: 'Needs Review' },
];

// ── Internal helpers ──────────────────────────────────────────────────

function deepFreeze(obj) {
  if (obj === null || typeof obj !== 'object') return obj;
  for (const k of Object.keys(obj)) {
    const v = obj[k];
    if (v !== null && typeof v === 'object' && !Object.isFrozen(v)) deepFreeze(v);
  }
  return Object.freeze(obj);
}

function clamp(n) {
  if (typeof n !== 'number' || !Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function statusForScore(score) {
  for (const band of STATUS_BANDS) {
    if (score >= band.min && score <= band.max) return band.status;
  }
  return 'Needs Review';
}

// ── Per-domain contributor score derivations ──────────────────────────
// These are informational display values for the Health Contributors™
// card rows. They do NOT feed the overall score — computeHealthScore()
// owns that calculation exclusively.

function deriveIdentityScore(ii) {
  if (!ii || typeof ii !== 'object') return 0;
  const cov = ii.coverage;
  // Identity Recovery (Phase 2, 2026-07-20): removed a fallback branch
  // reading ii.verified/ii.total — field names that never existed in
  // assembleIdentityIntelligence()'s locked v1.0 output shape
  // (api/_lib/identity-intelligence.js), which has always returned
  // verifiedProviders/totalProviders plus a guaranteed-finite
  // coverage. The fallback was dead code from a stale assumption
  // about field names, never reachable, never tested.
  return typeof cov === 'number' && Number.isFinite(cov) ? clamp(cov) : 0;
}

function derivePublishingScore(pi) {
  if (!pi || typeof pi !== 'object') return 50;
  const cov = pi.coverage;
  if (typeof cov === 'number' && Number.isFinite(cov)) return clamp(cov);
  const reg = pi.registrations;
  if (reg && typeof reg === 'object') {
    const mlc = reg.mlcRegistration;
    if (mlc && mlc.availability === 'AUTH_UNAVAILABLE') return 50;
  }
  return 50;
}

function deriveCatalogScore(ci) {
  if (!ci || typeof ci !== 'object') return 30;
  const conf = ci.confidence;
  if (conf === 'Verified')          return 100;
  if (conf === 'Partial')           return 65;
  if (conf === 'Unable to Confirm') return 30;
  const tt = ci.totalTracks;
  if (typeof tt === 'number' && tt > 0) return 65;
  return 30;
}

function deriveFootprintScore(gmf) {
  if (!gmf || typeof gmf !== 'object') return 0;
  const pct = gmf.coveragePercent;
  if (typeof pct === 'number' && Number.isFinite(pct)) return clamp(pct);
  return 0;
}

function deriveBackendScore(bi) {
  if (!bi || typeof bi !== 'object') return 50;
  const services = bi.services;
  if (!Array.isArray(services) || services.length === 0) return 50;
  // VERIFIED / non-AUTH_UNAVAILABLE ratio. AUTH_UNAVAILABLE services
  // (monitoring-plan gated per Brief 015o) are excluded from both numerator
  // and denominator — they are not coverage gaps.
  let verifiable = 0;
  let verified   = 0;
  for (const svc of services) {
    if (!svc || typeof svc !== 'object') continue;
    const st = svc.state;
    if (st === 'AUTH_UNAVAILABLE') continue;
    verifiable += 1;
    if (st === 'VERIFIED') verified += 1;
  }
  if (verifiable === 0) return 50;
  return clamp((verified / verifiable) * 100);
}

function deriveMonitoringScore(mi) {
  if (!mi || typeof mi !== 'object') return 50;
  const st = mi.status;
  if (st === 'active')     return 100;
  if (st === 'no_changes') return 90;
  if (st === 'baseline')   return 80;
  return 50;
}

// ── Confidence derivation ─────────────────────────────────────────────
// Counts domains with real (non-neutral) data present. AUTH_UNAVAILABLE
// services contribute neutral values and do not raise or lower confidence.

function deriveConfidence(domainScores) {
  const meaningful = [
    domainScores.identity   !== 0,
    domainScores.publishing !== 50,
    domainScores.catalog    !== 30,
    domainScores.footprint  !== 0,
    domainScores.backend    !== 50,
    domainScores.monitoring !== 50,
  ].filter(Boolean).length;

  if (meaningful >= 5) return 'Verified';
  if (meaningful >= 3) return 'Partial';
  return 'Limited';
}

// ── Strengths extraction (max 5) ──────────────────────────────────────

function extractStrengths(domainScores, ii, pi, ci, gmf, bi, mi, ai) {
  const s = [];

  if (domainScores.identity   >= 80) s.push('Identity verified across reviewed platforms');
  if (domainScores.publishing >= 75) s.push('Publishing registration confirmed');
  if (domainScores.footprint  >= 75) s.push('Global distribution verified');
  if (domainScores.backend    >= 90) s.push('Backend infrastructure fully connected');
  if (domainScores.monitoring >= 85) s.push('Active monitoring and change detection');
  if (domainScores.catalog    >= 80) s.push('Catalog verified with confidence');

  if (s.length < 5 && ai && Array.isArray(ai.strengths) && ai.strengths.length > 0) {
    const aiStrength = ai.strengths[0];
    if (typeof aiStrength === 'string' && aiStrength.trim()) s.push(aiStrength.trim());
  }

  return s.slice(0, 5);
}

// ── Concerns extraction (max 5) ───────────────────────────────────────

function extractConcerns(domainScores, ii, pi, ci, gmf, bi, mi, ai) {
  const c = [];

  if (domainScores.publishing < 50) c.push('Publishing registration requires review');
  if (domainScores.footprint  < 60) c.push('Territory coverage may be limited');
  if (domainScores.identity   < 60) c.push('Identity verification incomplete');
  if (domainScores.backend    < 50) c.push('Backend infrastructure connectivity issues');
  if (domainScores.catalog    < 40) c.push('Catalog data could not be verified');
  if (!mi || domainScores.monitoring === 50) c.push('Monitoring not active for this scan');

  if (c.length < 5 && ai && Array.isArray(ai.issues) && ai.issues.length > 0) {
    const aiIssue = ai.issues[0];
    if (typeof aiIssue === 'string' && aiIssue.trim()) c.push(aiIssue.trim());
  }

  return c.slice(0, 5);
}

// ── Empty domain-status shell (Needs Review for every domain) ────────────────
const EMPTY_DOMAIN_STATUSES = Object.freeze({
  identity:   'Needs Review',
  publishing: 'Needs Review',
  catalog:    'Needs Review',
  footprint:  'Needs Review',
  backend:    'Needs Review',
  monitoring: 'Needs Review',
  metadata:   'Needs Review',
  coverage:   'Needs Review',
});

// ── Empty shell — returned on assembly failure ────────────────────────

function emptyHealthIntelligence() {
  return {
    version:         HEALTH_INTELLIGENCE_VERSION,
    score:           0,
    status:          'Needs Review',
    confidence:      'Limited',
    identityScore:   0,
    publishingScore: 0,
    catalogScore:    0,
    footprintScore:  0,
    backendScore:    0,
    monitoringScore: 0,
    domainStatuses:  EMPTY_DOMAIN_STATUSES,
    strengths:       [],
    concerns:        [],
    generatedAt:     new Date().toISOString(),
  };
}

// ── Public API ────────────────────────────────────────────────────────

/**
 * assembleHealthIntelligence — interpretation layer over the canonical score.
 *
 * score is always sourced from healthScore.overallScore (computeHealthScore output).
 * No independent health score is calculated here.
 *
 * @param {object} healthScore             — output of computeHealthScore(); provides overallScore
 * @param {object} identityIntelligence    — from assembleIdentityIntelligence
 * @param {object} publishingIntelligence  — from assemblePublishingIntelligence
 * @param {object} catalogIntelligence     — from assembleCatalogIntelligence
 * @param {object} globalMusicFootprint    — from assembleGlobalMusicFootprint
 * @param {object} backendIntelligence     — from assembleBackendIntelligence
 * @param {object} monitoringIntelligence  — from assembleMonitoringIntelligence (null on first write)
 * @param {object} royalteAI               — from assembleRoyalteAI
 */
export function assembleHealthIntelligence(
  healthScore,
  identityIntelligence,
  publishingIntelligence,
  catalogIntelligence,
  globalMusicFootprint,
  backendIntelligence,
  monitoringIntelligence,
  royalteAI,
) {
  try {
    // healthScore is required — it is the canonical authority for the score.
    // Absent or malformed input returns an empty shell rather than fabricating a score.
    if (!healthScore || typeof healthScore !== 'object'
        || typeof healthScore.overallScore !== 'number') {
      console.error('[health-intelligence] healthScore missing or malformed — returning empty shell');
      return deepFreeze(emptyHealthIntelligence());
    }

    // score is the canonical Royaltē Health Score™ — sourced verbatim from
    // computeHealthScore(). This module does not recompute it.
    const score  = clamp(healthScore.overallScore);
    const status = statusForScore(score);

    // Per-domain contributor scores — informational display for the Health
    // Contributors™ card rows. They do NOT feed the overall score.
    const identityScore   = deriveIdentityScore(identityIntelligence);
    const publishingScore = derivePublishingScore(publishingIntelligence);
    const catalogScore    = deriveCatalogScore(catalogIntelligence);
    const footprintScore  = deriveFootprintScore(globalMusicFootprint);
    const backendScore    = deriveBackendScore(backendIntelligence);
    const monitoringScore = deriveMonitoringScore(monitoringIntelligence);

    const domainScores = {
      identity:   identityScore,
      publishing: publishingScore,
      catalog:    catalogScore,
      footprint:  footprintScore,
      backend:    backendScore,
      monitoring: monitoringScore,
    };

    const confidence = deriveConfidence(domainScores);
    const strengths  = extractStrengths(domainScores, identityIntelligence, publishingIntelligence, catalogIntelligence, globalMusicFootprint, backendIntelligence, monitoringIntelligence, royalteAI);
    const concerns   = extractConcerns(domainScores, identityIntelligence, publishingIntelligence, catalogIntelligence, globalMusicFootprint, backendIntelligence, monitoringIntelligence, royalteAI);

    // Per-domain status labels — constitutional source of truth for
    // every renderer that needs to display "Excellent / Strong / Moderate /
    // Needs Review" next to a domain.  Consumers read; never classify.
    const domainStatuses = deepFreeze({
      identity:   statusForScore(identityScore),
      publishing: statusForScore(publishingScore),
      catalog:    statusForScore(catalogScore),
      footprint:  statusForScore(footprintScore),
      backend:    statusForScore(backendScore),
      monitoring: statusForScore(monitoringScore),
      // Phase 7 Health Engine category scores projected through STATUS_BANDS.
      // healthScore is the first parameter so these are always available.
      metadata: statusForScore(typeof healthScore.metadataScore  === 'number' ? healthScore.metadataScore  : 0),
      coverage: statusForScore(typeof healthScore.coverageScore  === 'number' ? healthScore.coverageScore  : 0),
    });

    return deepFreeze({
      version:         HEALTH_INTELLIGENCE_VERSION,
      score,           // canonical — sourced from computeHealthScore().overallScore
      status,          // Excellent | Strong | Moderate | Needs Review
      confidence,      // Verified | Partial | Limited
      identityScore,
      publishingScore,
      catalogScore,
      footprintScore,
      backendScore,
      monitoringScore,
      domainStatuses,  // per-domain status labels; renderers read, never classify
      strengths,
      concerns,
      generatedAt:     new Date().toISOString(),
    });
  } catch (err) {
    console.error('[health-intelligence] assembly failed (non-blocking):', err.message);
    return deepFreeze(emptyHealthIntelligence());
  }
}
