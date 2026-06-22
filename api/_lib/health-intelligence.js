// ─────────────────────────────────────────────────────────────────────
//
// Royaltē Health Intelligence™ v1.0
//
// Assembles a single HealthIntelligence object from the 7 assembled
// domain intelligence objects. Reads; never fetches; never scores
// business logic (that is Royaltē Health Engine™ territory).
//
// This surface is the executive health summary MC renders — composite
// score, per-domain sub-scores, strengths, and concerns — derived
// strictly from already-assembled intelligence.
//
// Called once per scan from api/audit.js; output persisted to
// audit_scans.payload.healthIntelligence. MC reads it only from there.
//
// Constitutional invariants honoured here:
//   - Pure function: no I/O, no clock (generatedAt passed in or stamped).
//   - Never throws (outer try/catch; returns empty shell on failure).
//   - Output is deeply frozen.
//   - AUTH_UNAVAILABLE ≠ NOT_FOUND (never penalised as zero).
//   - Intelligence generated once; consumed everywhere.
//
// ─────────────────────────────────────────────────────────────────────

export const HEALTH_INTELLIGENCE_VERSION = '1.0.0';

// ── Scoring bands (Board-locked) ──────────────────────────────────────
// Vocabulary: Excellent / Strong / Moderate / Needs Review
const STATUS_BANDS = [
  { min: 90, max: 100, status: 'Excellent' },
  { min: 75, max:  89, status: 'Strong'    },
  { min: 60, max:  74, status: 'Moderate'  },
  { min:  0, max:  59, status: 'Needs Review' },
];

// ── Domain weights — must sum to 1.0 ─────────────────────────────────
const DOMAIN_WEIGHTS = Object.freeze({
  identity:    0.20,
  publishing:  0.20,
  catalog:     0.15,
  footprint:   0.20,
  backend:     0.15,
  monitoring:  0.10,
});

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

// ── Per-domain score derivations ──────────────────────────────────────

function deriveIdentityScore(ii) {
  if (!ii || typeof ii !== 'object') return 0;
  const cov = ii.coverage;
  if (typeof cov === 'number' && Number.isFinite(cov)) return clamp(cov);
  // Fallback: (verified / total) * 100
  const verified = typeof ii.verified === 'number' ? ii.verified : 0;
  const total    = typeof ii.total    === 'number' ? ii.total    : 0;
  if (total > 0) return clamp((verified / total) * 100);
  return 0;
}

function derivePublishingScore(pi) {
  if (!pi || typeof pi !== 'object') return 50; // neutral when no publishing intelligence
  const cov = pi.coverage;
  if (typeof cov === 'number' && Number.isFinite(cov)) return clamp(cov);
  // AUTH_UNAVAILABLE MLC → neutral 50 (not a gap)
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
  // Fallback: use totalTracks as a signal
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
  // Score = VERIFIED count / non-AUTH_UNAVAILABLE count × 100
  // AUTH_UNAVAILABLE services are excluded from both numerator and denominator
  // (they are not coverage gaps — monitoring-plan gated per Brief 015o).
  let verifiable = 0;
  let verified   = 0;
  for (const svc of services) {
    if (!svc || typeof svc !== 'object') continue;
    const st = svc.state;
    if (st === 'AUTH_UNAVAILABLE') continue;
    verifiable += 1;
    if (st === 'VERIFIED') verified += 1;
  }
  if (verifiable === 0) return 50; // all AUTH_UNAVAILABLE → neutral
  return clamp((verified / verifiable) * 100);
}

function deriveMonitoringScore(mi) {
  if (!mi || typeof mi !== 'object') return 50; // no monitoring data → neutral
  const st = mi.status;
  if (st === 'active')     return 100;
  if (st === 'no_changes') return 90;
  if (st === 'baseline')   return 80;
  return 50;
}

// ── Confidence derivation ─────────────────────────────────────────────
// Counts domains with real (non-neutral) data. AUTH_UNAVAILABLE is
// "neutral" — monitoring-plan gated services don't count against confidence.

function deriveConfidence(scores) {
  // Count domains with a score that's meaningfully above the neutral floor (50)
  // OR below it (i.e., a real signal exists, positive or negative).
  const meaningful = [
    scores.identity    !== 0,
    scores.publishing  !== 50,
    scores.catalog     !== 30,
    scores.footprint   !== 0,
    scores.backend     !== 50,
    scores.monitoring  !== 50,
  ].filter(Boolean).length;

  if (meaningful >= 5) return 'Verified';
  if (meaningful >= 3) return 'Partial';
  return 'Limited';
}

// ── Strengths extraction (max 5) ──────────────────────────────────────

function extractStrengths(scores, ii, pi, ci, gmf, bi, mi, ai) {
  const s = [];

  if (scores.identity >= 80)   s.push('Identity verified across reviewed platforms');
  if (scores.publishing >= 75) s.push('Publishing registration confirmed');
  if (scores.footprint >= 75)  s.push('Global distribution verified');
  if (scores.backend >= 90)    s.push('Backend infrastructure fully connected');
  if (scores.monitoring >= 85) s.push('Active monitoring and change detection');
  if (scores.catalog >= 80)    s.push('Catalog verified with confidence');

  // Royaltē AI insight: if AI found positive signal and we haven't hit 5 yet
  if (s.length < 5 && ai && Array.isArray(ai.strengths) && ai.strengths.length > 0) {
    const aiStrength = ai.strengths[0];
    if (typeof aiStrength === 'string' && aiStrength.trim()) {
      s.push(aiStrength.trim());
    }
  }

  return s.slice(0, 5);
}

// ── Concerns extraction (max 5) ───────────────────────────────────────

function extractConcerns(scores, ii, pi, ci, gmf, bi, mi, ai) {
  const c = [];

  if (scores.publishing < 50) c.push('Publishing registration requires review');
  if (scores.footprint  < 60) c.push('Territory coverage may be limited');
  if (scores.identity   < 60) c.push('Identity verification incomplete');
  if (scores.backend    < 50) c.push('Backend infrastructure connectivity issues');
  if (scores.catalog    < 40) c.push('Catalog data could not be verified');
  if (!mi || scores.monitoring === 50) c.push('Monitoring not active for this scan');

  // Royaltē AI concern: if AI found issues and we haven't hit 5 yet
  if (c.length < 5 && ai && Array.isArray(ai.issues) && ai.issues.length > 0) {
    const aiIssue = ai.issues[0];
    if (typeof aiIssue === 'string' && aiIssue.trim()) {
      c.push(aiIssue.trim());
    }
  }

  return c.slice(0, 5);
}

// ── Empty shell — returned on assembly failure ─────────────────────────

function emptyHealthIntelligence() {
  return {
    version:          HEALTH_INTELLIGENCE_VERSION,
    score:            0,
    status:           'Needs Review',
    confidence:       'Limited',
    identityScore:    0,
    publishingScore:  0,
    catalogScore:     0,
    footprintScore:   0,
    backendScore:     0,
    monitoringScore:  0,
    strengths:        [],
    concerns:         [],
    generatedAt:      new Date().toISOString(),
  };
}

// ── Public API ────────────────────────────────────────────────────────

/**
 * assembleHealthIntelligence — produce the executive health summary.
 *
 * Reads from all 7 assembled domain intelligence objects.
 * Never fetches data. Never computes business rules. Never throws.
 * Output is deeply frozen.
 *
 * @param {object} identityIntelligence    — from assembleIdentityIntelligence
 * @param {object} publishingIntelligence  — from assemblePublishingIntelligence
 * @param {object} catalogIntelligence     — from assembleCatalogIntelligence
 * @param {object} globalMusicFootprint    — from assembleGlobalMusicFootprint
 * @param {object} backendIntelligence     — from assembleBackendIntelligence
 * @param {object} monitoringIntelligence  — from assembleMonitoringIntelligence (may be null on first write)
 * @param {object} royalteAI               — from assembleRoyalteAI
 */
export function assembleHealthIntelligence(
  identityIntelligence,
  publishingIntelligence,
  catalogIntelligence,
  globalMusicFootprint,
  backendIntelligence,
  monitoringIntelligence,
  royalteAI,
) {
  try {
    const identityScore   = deriveIdentityScore(identityIntelligence);
    const publishingScore = derivePublishingScore(publishingIntelligence);
    const catalogScore    = deriveCatalogScore(catalogIntelligence);
    const footprintScore  = deriveFootprintScore(globalMusicFootprint);
    const backendScore    = deriveBackendScore(backendIntelligence);
    const monitoringScore = deriveMonitoringScore(monitoringIntelligence);

    const scores = { identity: identityScore, publishing: publishingScore, catalog: catalogScore, footprint: footprintScore, backend: backendScore, monitoring: monitoringScore };

    const composite =
        identityScore   * DOMAIN_WEIGHTS.identity
      + publishingScore * DOMAIN_WEIGHTS.publishing
      + catalogScore    * DOMAIN_WEIGHTS.catalog
      + footprintScore  * DOMAIN_WEIGHTS.footprint
      + backendScore    * DOMAIN_WEIGHTS.backend
      + monitoringScore * DOMAIN_WEIGHTS.monitoring;

    const score      = clamp(composite);
    const status     = statusForScore(score);
    const confidence = deriveConfidence(scores);

    const strengths = extractStrengths(scores, identityIntelligence, publishingIntelligence, catalogIntelligence, globalMusicFootprint, backendIntelligence, monitoringIntelligence, royalteAI);
    const concerns  = extractConcerns(scores, identityIntelligence, publishingIntelligence, catalogIntelligence, globalMusicFootprint, backendIntelligence, monitoringIntelligence, royalteAI);

    return deepFreeze({
      version:         HEALTH_INTELLIGENCE_VERSION,
      score,
      status,
      confidence,
      identityScore,
      publishingScore,
      catalogScore,
      footprintScore,
      backendScore,
      monitoringScore,
      strengths,
      concerns,
      generatedAt:     new Date().toISOString(),
    });
  } catch (err) {
    console.error('[health-intelligence] assembly failed (non-blocking):', err.message);
    return deepFreeze(emptyHealthIntelligence());
  }
}
