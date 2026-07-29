// Canonical Intelligence Platform(tm) -- ATHENA(tm) Runtime Context Adapter
//
// Phase 1 (Canonical Executive Intelligence Object(tm)) -- Option C, ratified
// in governance/ATHENA_EXECUTIVE_ARCHITECTURE_RECONCILIATION.md.
//
// Translates the LIVE `royalte_workspace_context` (schema v1.1, built by
// public/js/runtime-context-mapper.js) into the `apiResponses` envelope shape
// ATHENA_ENGINE.analyze() requires: { identity, musicRights, catalog,
// distribution, monitoring, systemOperations }, each
// { apiVersion:'v1', status, data, artistId, scanId }.
//
// Constitutional constraints (per the Phase 1 brief):
//   - Must not modify runtime-context-mapper.js or any api/athena/* engine file.
//   - Pure function of its input. No I/O, no mutation, no module-level state.
//   - Isolated: this file's only contract is "real Runtime Context in,
//     ATHENA envelope shape out." Nothing outside this file needs to know
//     the translation exists.
//   - Versioned + replaceable: ADAPTER_VERSION below. A future adapter
//     (e.g. reading cim.* natively once the CimAdapter bridge is retired)
//     can replace this file without touching either side it sits between.
//
// Confidence labeling -- every field below is tagged with how sure we are
// that the mapping is correct, not just present:
//   DIRECT       -- real field, same meaning, no transform.
//   DERIVED      -- real field(s), mechanical transform (unit conversion,
//                   sum, first-of-array). Not a guess -- traceable math.
//   INTERPRETIVE -- real field(s), but the mapping encodes a judgment call
//                   about what the source data MEANS in ATHENA's vocabulary.
//                   Each one is called out below and belongs in Board review.
//   UNAVAILABLE  -- no real source exists anywhere in the live data flow.
//                   Left null rather than fabricated. Feeds ATHENA's own
//                   completeness/confidence scoring honestly (a null key
//                   lowers computeDomainDataCompleteness, which is correct --
//                   it IS a real gap).

export const ADAPTER_VERSION = Object.freeze({
  version:       '1.0.0',
  name:          'ATHENA Runtime Context Adapter',
  effectiveDate: '2026-07-24',
});

// Real Monitoring Intelligence™ severities (api/_lib/monitoring-intelligence.js
// VALID_SEVERITIES) have no CRITICAL tier and no native concept matching
// ATHENA's CRITICAL/HIGH/MEDIUM/LOW/INFORMATIONAL risk-level vocabulary.
// INTERPRETIVE: this table is a conservative, one-directional guess at how a
// human would read each real state as a risk level. 'action_needed' maps to
// HIGH (not CRITICAL) deliberately -- until the real Monitoring Engine adds
// its own critical tier, ATHENA's CRITICAL-monitoring-risk path can
// structurally never fire through this adapter. That is a known, documented
// limitation, not a bug.
const MONITORING_SEVERITY_TO_ATHENA_LEVEL = Object.freeze({
  action_needed: 'HIGH',
  monitor:       'MEDIUM',
  informational: 'INFORMATIONAL',
  positive:      'INFORMATIONAL',
});

function envelope(status, data, { artistId = null, scanId = null } = {}) {
  return Object.freeze({
    apiVersion: 'v1',
    status,
    data:       Object.freeze({ ...data }),
    artistId,
    scanId,
  });
}

// ── identity ────────────────────────────────────────────────────────────
// Sources: ctx.identity (cim.identity, CANONICAL_PAYLOAD_V2 Object 1),
// ctx.identityIntelligence (real engine output, project_royalte_identity_intelligence_lock:
// locked shape providers/coverage/strengths/issues/recommendations),
// ctx.musicRightsProfile.rights_identifiers (Settings-only isni/ipi_number).
function buildIdentityEnvelope(ctx) {
  const identity = ctx.identity;
  const ii       = ctx.identityIntelligence;
  const rightsIds = (ctx.musicRightsProfile && ctx.musicRightsProfile.rights_identifiers) || {};

  if (!identity) {
    return envelope('NOT_FOUND', {}, { scanId: ctx.scanId || null });
  }

  // DERIVED: ctx.identity (the real Identity Intelligence(tm) engine output)
  // carries no artistId field at all -- only per-provider VERIFIED/etc.
  // status strings (identity.providers) and counts. The one real canonical
  // identifier for the scanned artist lives on ctx.subject.artistId
  // (set by resolveToArtist() during the scan). Using that here instead of
  // a nonexistent identity.artistIds field.
  const artistId = (ctx.subject && ctx.subject.artistId) || null;

  // DERIVED: "verified on at least one provider" from the real
  // identity.verifiedProviders count, replacing a reference to a
  // nonexistent identity.verifiedIdentity object. Chosen over "all
  // providers" as the more defensible executive reading -- flagged for
  // Board review.
  const verifiedAny = typeof identity.verifiedProviders === 'number' && identity.verifiedProviders > 0;

  return envelope('SUCCESS', {
    artistId,
    artistName: ctx.artistName || identity.displayName || null,            // DIRECT
    verified:   verifiedAny,                                                // INTERPRETIVE (see above)
    biography:  null,                                                       // UNAVAILABLE -- no biography field anywhere in CIM v2 or musicRightsProfile
    ipi:        rightsIds.ipi_number || null,                              // DIRECT (real, but sparsely populated -- Settings-only, opt-in)
    isni:       rightsIds.isni       || null,                              // DIRECT (real, but sparsely populated -- Settings-only, opt-in)
    providers:  (ii && ii.providers) || null,                              // DIRECT -- real Identity Intelligence(tm) engine output
    coverage:   (ii && typeof ii.coverage === 'number') ? ii.coverage / 100 : null, // DERIVED -- real field is 0-100 int, ATHENA expects a 0-1 ratio
  }, { artistId, scanId: ctx.scanId || null });
}

// ── musicRights ─────────────────────────────────────────────────────────
// Sources: ctx.musicRightsProfile (real, user-declared onboarding/Settings
// data -- see public/js/music-rights-profile.js), ctx.publishing (cim.publishing,
// Object 7 -- publisher/administrator are explicitly "future enrichment" and
// near-always null; used only as a fallback).
function buildMusicRightsEnvelope(ctx) {
  const pub = ctx.publishing;
  const mrp = ctx.musicRightsProfile;

  if (!pub && !mrp) {
    return envelope('NOT_FOUND', {});
  }

  const proValue      = (mrp && mrp.performing_rights && mrp.performing_rights.pro) || null;
  const publishingMgmt = (mrp && mrp.publishing && mrp.publishing.publishing_management) || null;
  const orgName        = (mrp && mrp.publishing && mrp.publishing.organization_name) || null;
  const settingsPublisherName = (mrp && mrp.publisher && mrp.publisher.name) || null;

  // INTERPRETIVE: self-publishing is a legitimate declared state, not a gap.
  // ATHENA's "No Publisher on Record" risk (identifyRightsRisks, !data.publisher)
  // should fire only when the artist has declared NO publishing arrangement --
  // not when they've declared self-publishing. Mapping publishing_management
  // === 'self' to a truthy sentinel encodes that judgment call; flagged for
  // Board review. Without this, every self-published artist (a large,
  // legitimate population) would show a false CRITICAL risk.
  const publisherKnown = publishingMgmt === 'self'
    ? 'Self-published'
    : (settingsPublisherName || orgName || (pub && pub.publisher) || null);

  const administrator = (publishingMgmt === 'admin' ? orgName : null) || (pub && pub.administrator) || null;

  return envelope('SUCCESS', {
    publisher:     publisherKnown,   // INTERPRETIVE (see above)
    pro:           proValue,         // DIRECT -- real onboarding answer (e.g. 'ASCAP'), preferred over cim.publishing.pro (an engine-generated "how to register" card, not a membership record)
    iswc:          null,             // UNAVAILABLE -- cim.metadata (Object 6, the only real ISWC field, an enum not an identifier) is not wired into royalte_workspace_context at all today; real gap, not an adapter shortcoming
    writer:        null,             // UNAVAILABLE -- no per-work writer field exists anywhere in the live data flow
    administrator,                   // DIRECT/DERIVED
    ownership:     null,             // UNAVAILABLE
  });
}

// ── catalog ─────────────────────────────────────────────────────────────
// Sources: ctx.catalogIntelligence (real engine output -- singles/eps/albums/
// isrcIntelligence.coveragePercent), ctx.identity.genres (genre lives on the
// Identity object in CIM v2, not Catalog), ctx.recordLabel (MC-derived),
// ctx.musicRightsProfile.distribution.distributor (real Settings field).
function buildCatalogEnvelope(ctx) {
  const ci = ctx.catalogIntelligence;
  if (!ci) return envelope('NOT_FOUND', {});

  // DERIVED: real engine exposes singles/eps/albums separately, not a single
  // releaseCount. Sum of owned release types.
  const releaseCount = (ci.singles || 0) + (ci.eps || 0) + (ci.albums || 0);
  const isrcPct = ci.isrcIntelligence && ci.isrcIntelligence.coveragePercent;

  return envelope('SUCCESS', {
    releaseCount,                                                          // DERIVED (see above)
    isrcCoverage: (typeof isrcPct === 'number') ? isrcPct / 100 : null,    // DERIVED -- real field (ISRC Coverage(tm)) is 0-100 percent, ATHENA expects a 0-1 ratio
    genre: (ctx.identity && Array.isArray(ctx.identity.genres) && ctx.identity.genres[0]) || null, // DERIVED -- genre lives on cim.identity in the real schema, not on catalog; first (Apple-canonical top-of-list) genre used
    label: ctx.recordLabel || null,                                       // DIRECT -- MC-derived field (_appleRecordLabel)
    distributor: (ctx.musicRightsProfile && ctx.musicRightsProfile.distribution
      && ctx.musicRightsProfile.distribution.distributor) || null,        // DIRECT -- real Settings freetext field
  });
}

// ── distribution ────────────────────────────────────────────────────────
// Sources: ctx.verification (cim.verification, Object 5 -- per-provider
// VERIFIED/UNVERIFIED/AUTH_UNAVAILABLE/ERROR status), ctx.musicRightsProfile.
// distribution.distributor (real Settings freetext field).
//
// CANONICAL_PAYLOAD_V2.md is explicit: "Distribution is folded into
// [Global Footprint's] territories + platformCoverage; it is NOT a standalone
// object." ATHENA's distribution domain has no clean 1:1 real counterpart --
// every field below is a best-available proxy, not a verified match.
function buildDistributionEnvelope(ctx) {
  const ver = ctx.verification;
  const distributor = (ctx.musicRightsProfile && ctx.musicRightsProfile.distribution
    && ctx.musicRightsProfile.distribution.distributor) || null;

  if (!ver && !distributor) return envelope('NOT_FOUND', {});

  // INTERPRETIVE: real field is per-provider VERIFICATION status (does this
  // artist have a confirmed presence on Apple/Spotify/etc.), not DSP-specific
  // active distribution coverage. Used as the best available proxy --
  // verification presence is correlated with but not equivalent to active
  // distribution. Flagged for Board review.
  const dspCoverage = (ver && typeof ver.verifiedCount === 'number'
    && typeof ver.totalCount === 'number' && ver.totalCount > 0)
    ? ver.verifiedCount / ver.totalCount
    : null;

  return envelope('SUCCESS', {
    distributor,               // DIRECT
    // dspCoverage is kept under this exact key ONLY because
    // api/athena/risk-analysis.js, opportunities.js, and insights.js hardcode
    // `data.dspCoverage` -- renaming it would silently break the engine's own
    // distribution risk/opportunity/insight detection, and modifying the
    // Engine is prohibited. estimatedDistributionCoverage is the Board-approved
    // honest name (2026-07-24 addendum) -- same value, and the field any
    // future adapter or consumer should read/rename toward. Both carry the
    // same INTERPRETIVE proxy caveat: this is per-provider verification
    // presence, not confirmed active DSP distribution.
    dspCoverage,
    estimatedDistributionCoverage: dspCoverage,
    label:  ctx.recordLabel || null, // DIRECT
    status: distributor ? 'active' : null, // DERIVED
  });
}

// ── monitoring ──────────────────────────────────────────────────────────
// Source: ctx.monitoringIntelligence (real, live -- api/_lib/monitoring-intelligence.js,
// always present after the mapper's baseline normalization; never null).
function buildMonitoringEnvelope(ctx) {
  const mi = ctx.monitoringIntelligence;
  if (!mi) return envelope('NOT_FOUND', {});

  const events = Array.isArray(mi.events) ? mi.events : [];

  // INTERPRETIVE: see MONITORING_SEVERITY_TO_ATHENA_LEVEL header comment --
  // real severities have no CRITICAL tier.
  const alerts = events.map(e => ({
    level: MONITORING_SEVERITY_TO_ATHENA_LEVEL[e.severity] || 'INFORMATIONAL',
    title: e.title,
  }));

  return envelope('SUCCESS', {
    timeline:    events,                                                   // DIRECT passthrough
    alerts,                                                                 // INTERPRETIVE (see above)
    changeCount: typeof mi.newThisScan === 'number' ? mi.newThisScan : 0,  // DIRECT
    snapshotId:  mi.currentScanId || null,                                 // DIRECT
  });
}

// ── systemOperations ────────────────────────────────────────────────────
// No real "system operations" domain exists anywhere in the live data flow.
// DERIVED from the presence of core scan outputs -- a genuinely partial or
// failed scan is not currently distinguishable from a complete one anywhere
// in royalte_workspace_context. Documented as a real platform gap, not
// modeled with fabricated precision here.
function buildSystemOperationsEnvelope(ctx) {
  const hasCore = !!(ctx.identity || ctx.healthScore);
  return envelope(hasCore ? 'SUCCESS' : 'NOT_FOUND', {
    scanStatus:  hasCore ? 'complete' : null, // DERIVED (see above)
    lastScanAt:  ctx.scannedAt || null,        // DIRECT
  });
}

// ── Public entrypoint ──────────────────────────────────────────────────
// Pure function: royalte_workspace_context (v1.1) -> ATHENA apiResponses.
// Never mutates its input. Never throws -- a malformed/absent field simply
// produces a NOT_FOUND envelope for that domain, consistent with ATHENA's
// own "never invents canonical facts" contract.
export function buildAthenaApiResponses(workspaceContext) {
  const ctx = (workspaceContext && typeof workspaceContext === 'object') ? workspaceContext : {};

  return Object.freeze({
    identity:         buildIdentityEnvelope(ctx),
    musicRights:      buildMusicRightsEnvelope(ctx),
    catalog:          buildCatalogEnvelope(ctx),
    distribution:      buildDistributionEnvelope(ctx),
    monitoring:        buildMonitoringEnvelope(ctx),
    systemOperations:  buildSystemOperationsEnvelope(ctx),
  });
}

// Exported individually for unit testing (Phase 1 brief, Phase 12 test list).
export {
  buildIdentityEnvelope,
  buildMusicRightsEnvelope,
  buildCatalogEnvelope,
  buildDistributionEnvelope,
  buildMonitoringEnvelope,
  buildSystemOperationsEnvelope,
};
