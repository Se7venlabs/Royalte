// Canonical Domain Fingerprints™ — ATHENA™ Phase 3D
//
// One small pure function pair per canonical domain: extractFingerprint(payload)
// and compareFingerprint(before, after). Reads directly from a raw
// audit_scans.payload row (the same shape public/js/runtime-context-mapper.js
// resolves ctx.* from) -- never from the executive_brief_archive's jsonb
// snapshot, which only records each domain's request status, not its data
// (see executive-intelligence-object.js). Reused by both
// api/_lib/executive-comparison.js (pairwise) and
// api/_lib/executive-trend-detection.js (windowed) -- "no layer duplicates
// another."
//
// No causal narrative is ever produced here -- only structured facts
// (state + delta + detail), matching api/_lib/executive-comparison.js's
// existing philosophy exactly.

export const COMPARISON_STATES = Object.freeze({
  IMPROVED:             'IMPROVED',
  DECLINED:             'DECLINED',
  UNCHANGED:            'UNCHANGED',
  NEWLY_DETECTED:       'NEWLY_DETECTED',
  RESOLVED:             'RESOLVED',
  UNKNOWN:              'UNKNOWN',
  NOT_COMPARABLE:       'NOT_COMPARABLE',
  INSUFFICIENT_EVIDENCE: 'INSUFFICIENT_EVIDENCE',
});

const S = COMPARISON_STATES;

// Same dual-path resolution runtime-context-mapper.js uses (payload.cim.X,
// falling back to payload.canonical.cim.X for the legacy storage path).
function cim(payload, key) {
  const p = payload || {};
  const can = p.canonical || {};
  return (p.cim && p.cim[key]) || (can.cim && can.cim[key]) || null;
}
function direct(payload, key) {
  const p = payload || {};
  const can = p.canonical || {};
  return p[key] != null ? p[key] : (can[key] != null ? can[key] : null);
}

// Generic numeric comparison -- IMPROVED/DECLINED/UNCHANGED only. Domain
// functions layer NEWLY_DETECTED/RESOLVED on top where that vocabulary is
// actually meaningful for that domain's data (see each function below).
function compareNumeric(before, after, { higherIsBetter = true } = {}) {
  if (before === after) return S.UNCHANGED;
  const better = higherIsBetter ? after > before : after < before;
  return better ? S.IMPROVED : S.DECLINED;
}

function unavailable(reason) {
  return { available: false, reason };
}

// ── Identity ──────────────────────────────────────────────────────────────
function extractIdentity(payload) {
  const identity = cim(payload, 'identity');
  if (!identity || typeof identity.coverage !== 'number') return unavailable('cim.identity not present');
  return {
    available: true,
    verifiedProviders: identity.verifiedProviders ?? 0,
    totalProviders: identity.totalProviders ?? 0,
    coverage: identity.coverage,
  };
}
function compareIdentity(before, after) {
  if (!before.available || !after.available) return { state: S.INSUFFICIENT_EVIDENCE, delta: null, detail: 'Identity data unavailable in one or both scans.' };
  return {
    state: compareNumeric(before.coverage, after.coverage),
    delta: after.coverage - before.coverage,
    detail: `Identity coverage ${before.coverage}% -> ${after.coverage}% (${after.verifiedProviders}/${after.totalProviders} providers verified).`,
  };
}

// ── Publishing ────────────────────────────────────────────────────────────
function extractPublishing(payload) {
  const publishing = cim(payload, 'publishing');
  if (!publishing || typeof publishing.coverage !== 'number') return unavailable('cim.publishing not present');
  return {
    available: true,
    registeredCount: publishing.registeredCount ?? 0,
    totalChecked: publishing.totalChecked ?? 0,
    coverage: publishing.coverage,
  };
}
function comparePublishing(before, after) {
  if (!before.available || !after.available) return { state: S.INSUFFICIENT_EVIDENCE, delta: null, detail: 'Publishing data unavailable in one or both scans.' };
  return {
    state: compareNumeric(before.coverage, after.coverage),
    delta: after.coverage - before.coverage,
    detail: `Publishing coverage ${before.coverage}% -> ${after.coverage}% (${after.registeredCount}/${after.totalChecked} registrations verified).`,
  };
}

// ── Catalog ───────────────────────────────────────────────────────────────
function extractCatalog(payload) {
  const catalogIntelligence = direct(payload, 'catalogIntelligence');
  if (!catalogIntelligence) return unavailable('catalogIntelligence not present');
  const isrc = catalogIntelligence.isrcIntelligence;
  return {
    available: true,
    totalTracks: catalogIntelligence.totalTracks ?? 0,
    isrcCoveragePercent: (isrc && typeof isrc.coveragePercent === 'number') ? isrc.coveragePercent : null,
  };
}
function compareCatalog(before, after) {
  if (!before.available || !after.available) return { state: S.INSUFFICIENT_EVIDENCE, delta: null, detail: 'Catalog data unavailable in one or both scans.' };
  if (before.isrcCoveragePercent == null || after.isrcCoveragePercent == null) {
    // ISRC assessment itself unavailable in at least one scan -- fall back to
    // track-count growth as the only real comparable signal, never invent an
    // ISRC delta from nothing.
    return {
      state: compareNumeric(before.totalTracks, after.totalTracks),
      delta: after.totalTracks - before.totalTracks,
      detail: `Catalog size ${before.totalTracks} -> ${after.totalTracks} tracks (ISRC coverage not assessed in one or both scans).`,
    };
  }
  return {
    state: compareNumeric(before.isrcCoveragePercent, after.isrcCoveragePercent),
    delta: after.isrcCoveragePercent - before.isrcCoveragePercent,
    detail: `ISRC coverage ${before.isrcCoveragePercent}% -> ${after.isrcCoveragePercent}% across ${after.totalTracks} tracks.`,
  };
}

// ── Health ────────────────────────────────────────────────────────────────
function extractHealth(payload) {
  const hi = direct(payload, 'healthIntelligence');
  if (!hi || typeof hi.score !== 'number') return unavailable('healthIntelligence not present');
  return { available: true, score: hi.score, status: hi.status || null };
}
function compareHealth(before, after) {
  if (!before.available || !after.available) return { state: S.INSUFFICIENT_EVIDENCE, delta: null, detail: 'Health Intelligence data unavailable in one or both scans.' };
  return {
    state: compareNumeric(before.score, after.score),
    delta: after.score - before.score,
    detail: `Health Score ${before.score}/100 (${before.status || 'Unknown'}) -> ${after.score}/100 (${after.status || 'Unknown'}).`,
  };
}

// ── Backend ───────────────────────────────────────────────────────────────
function extractBackend(payload) {
  const verification = cim(payload, 'verification');
  if (!verification || typeof verification.connectedCount !== 'number') return unavailable('cim.verification not present');
  return {
    available: true,
    connectedCount: verification.connectedCount,
    totalCount: verification.totalCount ?? 0,
  };
}
function compareBackend(before, after) {
  if (!before.available || !after.available) return { state: S.INSUFFICIENT_EVIDENCE, delta: null, detail: 'Backend verification data unavailable in one or both scans.' };
  const beforeGap = Math.max(0, before.totalCount - before.connectedCount);
  const afterGap  = Math.max(0, after.totalCount - after.connectedCount);
  if (beforeGap > 0 && afterGap === 0) {
    return { state: S.RESOLVED, delta: after.connectedCount - before.connectedCount, detail: `All ${after.totalCount} backend services now connected (was ${before.connectedCount}/${before.totalCount}).` };
  }
  return {
    state: compareNumeric(before.connectedCount, after.connectedCount),
    delta: after.connectedCount - before.connectedCount,
    detail: `Backend connections ${before.connectedCount}/${before.totalCount} -> ${after.connectedCount}/${after.totalCount}.`,
  };
}

// ── Media ─────────────────────────────────────────────────────────────────
function extractMedia(payload) {
  const media = cim(payload, 'media');
  if (!media || media.available !== true) return unavailable('cim.media not available for this scan');
  const pc = media.platformCoverage || {};
  const unsupported = (media.catalogMediaSupport && Array.isArray(media.catalogMediaSupport.unsupportedReleases))
    ? media.catalogMediaSupport.unsupportedReleases.length : 0;
  return {
    available: true,
    coveragePercent: typeof pc.coveragePercent === 'number' ? pc.coveragePercent : null,
    unsupportedCount: unsupported,
  };
}
function compareMedia(before, after) {
  if (!before.available || !after.available) return { state: S.INSUFFICIENT_EVIDENCE, delta: null, detail: 'Media Intelligence data unavailable in one or both scans.' };
  if (before.unsupportedCount > 0 && after.unsupportedCount === 0) {
    return { state: S.RESOLVED, delta: after.unsupportedCount - before.unsupportedCount, detail: 'Every release now has video support (previously had unsupported releases).' };
  }
  if (before.coveragePercent == null || after.coveragePercent == null) {
    return {
      state: compareNumeric(before.unsupportedCount, after.unsupportedCount, { higherIsBetter: false }),
      delta: after.unsupportedCount - before.unsupportedCount,
      detail: `Unsupported releases ${before.unsupportedCount} -> ${after.unsupportedCount}.`,
    };
  }
  return {
    state: compareNumeric(before.coveragePercent, after.coveragePercent),
    delta: after.coveragePercent - before.coveragePercent,
    detail: `Media platform coverage ${before.coveragePercent}% -> ${after.coveragePercent}%.`,
  };
}

// ── Global Music Footprint ───────────────────────────────────────────────
function extractFootprint(payload) {
  const footprint = cim(payload, 'globalFootprint');
  if (!footprint || typeof footprint.territoriesAvailable !== 'number') return unavailable('cim.globalFootprint not present');
  return {
    available: true,
    territoriesAvailable: footprint.territoriesAvailable,
    territoriesUnavailable: footprint.territoriesUnavailable ?? 0,
    coveragePercent: footprint.coveragePercent ?? null,
  };
}
function compareFootprint(before, after) {
  if (!before.available || !after.available) return { state: S.INSUFFICIENT_EVIDENCE, delta: null, detail: 'Global Music Footprint data unavailable in one or both scans.' };
  if (before.territoriesUnavailable > 0 && after.territoriesUnavailable === 0) {
    return { state: S.RESOLVED, delta: after.territoriesAvailable - before.territoriesAvailable, detail: `All evaluated territories now available (${after.territoriesAvailable}), no missing markets remain.` };
  }
  return {
    state: compareNumeric(before.territoriesAvailable, after.territoriesAvailable),
    delta: after.territoriesAvailable - before.territoriesAvailable,
    detail: `Territories available ${before.territoriesAvailable} -> ${after.territoriesAvailable}.`,
  };
}

// ── Monitoring ────────────────────────────────────────────────────────────
function extractMonitoring(payload) {
  const mi = direct(payload, 'monitoringIntelligence');
  if (!mi || !Array.isArray(mi.events)) return unavailable('monitoringIntelligence not present');
  const actionNeededCount = mi.events.filter(e => e && e.severity === 'action_needed').length;
  return { available: true, actionNeededCount, status: mi.status || null };
}
function compareMonitoring(before, after) {
  if (!before.available || !after.available) return { state: S.INSUFFICIENT_EVIDENCE, delta: null, detail: 'Monitoring data unavailable in one or both scans.' };
  if (before.actionNeededCount === 0 && after.actionNeededCount > 0) {
    return { state: S.NEWLY_DETECTED, delta: after.actionNeededCount, detail: `${after.actionNeededCount} new action-needed event(s) detected (none previously).` };
  }
  if (before.actionNeededCount > 0 && after.actionNeededCount === 0) {
    return { state: S.RESOLVED, delta: -before.actionNeededCount, detail: 'All action-needed monitoring events resolved.' };
  }
  return {
    state: compareNumeric(before.actionNeededCount, after.actionNeededCount, { higherIsBetter: false }),
    delta: after.actionNeededCount - before.actionNeededCount,
    detail: `Action-needed events ${before.actionNeededCount} -> ${after.actionNeededCount}.`,
  };
}

// ── Registry ──────────────────────────────────────────────────────────────
// Domain key -> {extract, compare}. AI Insights / Executive Overview are
// intentionally absent here -- they compare ATHENA's own overallLevel /
// riskLevel / risk_count / opportunity_count, already available directly on
// the archive rows (see api/_lib/executive-comparison.js), not sourced from
// audit_scans.payload.
export const DOMAIN_FINGERPRINTS = Object.freeze({
  identity:   { extract: extractIdentity,   compare: compareIdentity },
  publishing: { extract: extractPublishing, compare: comparePublishing },
  catalog:    { extract: extractCatalog,    compare: compareCatalog },
  health:     { extract: extractHealth,     compare: compareHealth },
  backend:    { extract: extractBackend,    compare: compareBackend },
  media:      { extract: extractMedia,      compare: compareMedia },
  footprint:  { extract: extractFootprint,  compare: compareFootprint },
  monitoring: { extract: extractMonitoring, compare: compareMonitoring },
});

// compareDomain(domainKey, payloadBefore, payloadAfter, {schemaCompatible})
// -> {domain, state, delta, detail}. Single entrypoint both
// executive-comparison.js and executive-trend-detection.js call -- neither
// touches the per-domain extract/compare functions directly.
export function compareDomain(domainKey, payloadBefore, payloadAfter, { schemaCompatible = true } = {}) {
  const fns = DOMAIN_FINGERPRINTS[domainKey];
  if (!fns) return { domain: domainKey, state: S.UNKNOWN, delta: null, detail: 'No comparison rule defined for this domain yet.' };
  if (!schemaCompatible) return { domain: domainKey, state: S.NOT_COMPARABLE, delta: null, detail: 'Schema version differs between the two scans being compared.' };
  const before = fns.extract(payloadBefore);
  const after  = fns.extract(payloadAfter);
  const result = fns.compare(before, after);
  return { domain: domainKey, ...result };
}
