// ─────────────────────────────────────────────────────────────────────
//  Royaltē Global Music Footprint™ — Assembler (GMF Phase v1.0)
// ─────────────────────────────────────────────────────────────────────
//
//  Constitutional position (Phase 5.2 revision):
//
//    PAL Evidence Contracts (Capability.AVAILABILITY)
//        ↓
//    Territory Intelligence Engine™ (api/_lib/territory-intelligence.js)
//        ↓ territoryIntelligence
//    Global Music Footprint™  ◀── THIS MODULE — now a CONSUMER
//        ↓
//    Mission Control™ · Global Music Footprint Card
//
//  Phase 5.2 change: this module no longer calculates territory coverage
//  independently. It consumes the Territory Intelligence Engine's™ already-
//  reconciled per-territory five-state model (Board Decision 2) and maps it
//  down to this module's existing output shape — the shape itself does not
//  change, so Mission Control and Health Intelligence require zero changes.
//
//  A legacy fallback path (globalFootprintEvidence.globalStorefrontAvailability)
//  is preserved for any caller not yet passing the new 4th argument, but the
//  Territory Intelligence Engine is the primary and intended data source.
//
//  Phase 2 Recovery (Board Option 3, 2026-07-20): this module no longer
//  reads canonicalForEnrichment directly (former CIO-bypass, certified in
//  governance/NORMALIZATION_LAYER_PLATFORM_CERTIFICATION.md and
//  governance/CANONICAL_SCHEMA_CIO_CIM_PLATFORM_CERTIFICATION.md, resolved
//  same pattern as Catalog/Backend Intelligence). The 3rd argument is now
//  globalFootprintEvidence (api/_lib/global-footprint-evidence.js), a
//  normalized sibling canonical object carrying only Apple availability
//  and the legacy storefront fallback shape. territoryIntelligence (4th
//  argument) is unchanged — it was never part of this bypass; it already
//  reads raw evidencePackages directly by deliberate Board design.
//
//  Purity invariants:
//    - Pure function of (intelligenceReport, cio, globalFootprintEvidence, territoryIntelligence).
//    - Never throws on any input (null / undefined / malformed).
//    - Never mutates inputs.
//    - Output is deep-frozen.
//
// ─────────────────────────────────────────────────────────────────────
//  Output shape (v1.0 fields unchanged by Phase 5.2; distributionGaps
//  added Board Directive 2026-07-17 — additive only):
//
//    {
//      territoriesAvailable:   number,
//      territoriesUnavailable: number,
//      territoriesEvaluated:   number,  // true evaluation universe (Territory
//                                        // Intelligence Engine's totalTerritoriesEvaluated,
//                                        // always 167 on the primary path; `total` on the
//                                        // legacy fallback path). Added Board directive
//                                        // 2026-07-21 (Global Music Footprint™ Constitutional
//                                        // Refactor) so Mission Control never has to invent
//                                        // its own denominator for "X of Y" style displays.
//      coveragePercent:        number,  // (available / evaluated) × 100, rounded
//      status:                 string,  // 'Global' | 'Strong' | 'Regional' | 'Limited'
//      confidence:             string,  // 'Verified' | 'Partial' | 'Unable to Confirm' | 'Not Found'
//      distributionGaps: {              // present only when Engine per-territory data exists
//        totalRequiringAttention: number,  // count of non-AVAILABLE territories
//        unavailable:             number,
//        unknown:                 number,  // Engine UNKNOWN + ERROR grouped (no separate "Error" tier in this UI)
//        notEvaluated:            number,
//        territories: [{                    // ALL evaluated territories, not just gaps —
//          code, name,                       // the drawer's "Available" filter needs these too
//          status: 'Available'|'Unavailable'|'Unknown'|'Pending Review',
//          providers: string[],              // providers with real evidence for this territory only
//          reason: string|null,               // derived from the Engine's own reasonCode — never invented
//          recommendedAction: string|null,    // null for Available (no action needed)
//          confidence: 'Verified'|'Partial'|'Unknown', // real, from the Engine
//          lastVerified: string|null,         // real evidence.acquiredAt ISO timestamp, or null
//          platformSupport: [{ provider, supported }], // real, from the Engine --
//                                              // "does this platform operate in this
//                                              // territory," distinct from catalog status
//        }],
//      } | null,
//    }
//
// ─────────────────────────────────────────────────────────────────────

export const GLOBAL_MUSIC_FOOTPRINT_VERSION = '1.3.0';

// Distribution Gaps™ (Board Directive 2026-07-17) — display-label and
// recommended-action maps. Every value here is a deterministic function of
// the Territory Intelligence Engine's own real state/reasonCode — never a
// per-territory fabrication. Unrecognized reasonCodes fall back to an
// honest per-state default rather than inventing detail that isn't there.
const STATUS_DISPLAY_LABELS = Object.freeze({
  AVAILABLE:     'Available',
  UNAVAILABLE:   'Unavailable',
  UNKNOWN:       'Unknown',
  ERROR:         'Unknown', // Distribution Gaps™ UI exposes 4 statuses only (Board spec); ERROR reads as Unknown to the artist, detail preserved in `reason`
  NOT_EVALUATED: 'Pending Review',
});

const REASON_LABELS = Object.freeze({
  catalog_match_found:          'Catalog confirmed in this storefront',
  catalog_match_absent:         'Catalog not found in this storefront',
  provider_request_failed:      'Provider request failed during acquisition',
  unrecognized_response_shape:  'Provider returned an unrecognized response',
  capability_acquisition_failed:'Territory data could not be acquired for this scan',
});

const RECOMMENDED_ACTIONS_BY_REASON = Object.freeze({
  'UNAVAILABLE:catalog_match_absent':      'Confirm catalog delivery to this storefront with your distributor.',
  'ERROR:provider_request_failed':         'Re-run scan — the provider request failed and can be retried.',
  'ERROR:capability_acquisition_failed':   'Re-run scan — territory data could not be acquired this pass.',
  'UNKNOWN:unrecognized_response_shape':   'Provider response could not be interpreted — re-verify manually.',
});

const DEFAULT_ACTION_BY_STATE = Object.freeze({
  UNAVAILABLE:   'Confirm catalog delivery to this storefront with your distributor.',
  UNKNOWN:       'Insufficient data to confirm — re-verify with the provider.',
  ERROR:         'Re-run scan — acquisition did not complete for this territory.',
  NOT_EVALUATED: 'Not yet evaluated — will be checked on the next scan.',
});

// Board-locked status thresholds (coverage percent of evaluated markets).
// Named constants — change only through formal Board Review.
const STATUS_THRESHOLDS = Object.freeze({
  GLOBAL:   100,  // 100% of checked markets available
  STRONG:    75,  // 75–99%
  REGIONAL:  50,  // 50–74%
  // below 50% → 'Limited'
});

function deepFreeze(obj) {
  if (obj === null || typeof obj !== 'object') return obj;
  for (const k of Object.keys(obj)) {
    const v = obj[k];
    if (v !== null && typeof v === 'object' && !Object.isFrozen(v)) deepFreeze(v);
  }
  return Object.freeze(obj);
}

function deriveStatus(coveragePercent) {
  if (coveragePercent >= STATUS_THRESHOLDS.GLOBAL)   return 'Global';
  if (coveragePercent >= STATUS_THRESHOLDS.STRONG)   return 'Strong';
  if (coveragePercent >= STATUS_THRESHOLDS.REGIONAL) return 'Regional';
  return 'Limited';
}

function deriveConfidence(appleAvailability, storefrontData) {
  if (appleAvailability === 'AUTH_UNAVAILABLE') return 'Unable to Confirm';
  if (appleAvailability === 'NOT_FOUND')        return 'Not Found';
  if (appleAvailability === 'VERIFIED' && storefrontData) return 'Verified';
  if (appleAvailability === 'VERIFIED')         return 'Partial'; // artist verified but no BIG6 detail
  return 'Partial';
}

// Phase 5.2: confidence derivation sourced from the Territory Intelligence
// Engine's reconciled summary rather than the raw legacy storefront shape.
// NOT_FOUND / AUTH_UNAVAILABLE are artist-identity-level signals (does this
// artist exist on Apple at all?) — a different concern from territory
// acquisition, so those two cases still read appleAvailability directly.
function deriveConfidenceFromTerritoryIntelligence(appleAvailability, territoryIntelligence) {
  if (appleAvailability === 'NOT_FOUND')        return 'Not Found';
  if (appleAvailability === 'AUTH_UNAVAILABLE') return 'Unable to Confirm';

  const providersContributing = territoryIntelligence?.providersContributing;
  if (!Array.isArray(providersContributing) || providersContributing.length === 0) {
    return 'Unable to Confirm';
  }

  const summary = territoryIntelligence?.summary ?? {};
  const evaluated = (summary.available ?? 0) + (summary.unavailable ?? 0);
  return evaluated > 0 ? 'Verified' : 'Partial';
}

// Distribution Gaps™ — Board Directive 2026-07-17. Pure derivation from the
// Territory Intelligence Engine's own per-territory evidence; never invents
// a provider, reason, or timestamp that isn't already present in `evidence`.
function reasonLabelFor(reasonCode, hasEvidence) {
  if (reasonCode && REASON_LABELS[reasonCode]) return REASON_LABELS[reasonCode];
  if (!hasEvidence) return 'Not yet evaluated for this territory';
  return 'Reason not available from reviewed sources';
}

function recommendedActionFor(state, reasonCode) {
  if (state === 'AVAILABLE') return null; // no action needed — never fabricate a directive where none applies
  const keyed = reasonCode ? RECOMMENDED_ACTIONS_BY_REASON[`${state}:${reasonCode}`] : null;
  return keyed || DEFAULT_ACTION_BY_STATE[state] || 'Review this territory manually.';
}

function buildDistributionGaps(territoryIntelligence) {
  const rawTerritories = Array.isArray(territoryIntelligence?.territories) ? territoryIntelligence.territories : [];
  const summary = territoryIntelligence?.summary ?? {};

  const territories = rawTerritories.map((t) => {
    const state = t?.state;
    const evidence = Array.isArray(t?.evidence) ? t.evidence : [];
    // Only providers with real evidence for THIS territory — never the
    // full platform provider roster.
    const providers = evidence
      .map((e) => (e && typeof e.provider === 'string') ? e.provider : null)
      .filter(Boolean);
    // Phase 5.2 is single-provider (Apple); the first evidence entry is the
    // primary reason. Provider-general by design — a future multi-provider
    // phase can extend this without re-architecture, since `evidence` already
    // preserves every contributing provider's entry, not just the first.
    const primaryEvidence = evidence[0] || null;
    const reasonCode = primaryEvidence?.reasonCode ?? null;

    return {
      code:              t?.code,
      name:              t?.name,
      status:            STATUS_DISPLAY_LABELS[state] || 'Unknown',
      providers,
      reason:            reasonLabelFor(reasonCode, evidence.length > 0),
      recommendedAction: recommendedActionFor(state, reasonCode),
      lastVerified:      primaryEvidence?.acquiredAt ?? null,
      // confidence: real, already computed by the Engine (deriveConfidence,
      // territory-intelligence.js) but not previously threaded through this
      // assembler. Added Board directive 2026-07-21 (Executive Visual
      // Rebuild) -- repurposes existing evidence rather than inventing a
      // new field, for the Country Intelligence Panel.
      confidence:        t?.confidence ?? 'Unknown',
      // platformSupport: real, from the Engine (territory-intelligence.js) --
      // distinguishes "this platform operates in this territory" from
      // "this artist's catalog is available here" (status/providers above).
      // Added Board directive 2026-07-22 (Platform vs Catalog Availability).
      platformSupport:   Array.isArray(t?.platformSupport) ? t.platformSupport : [],
    };
  });

  const unavailable   = typeof summary.unavailable  === 'number' ? summary.unavailable  : 0;
  const unknownGrouped = (typeof summary.unknown === 'number' ? summary.unknown : 0)
                        + (typeof summary.error   === 'number' ? summary.error   : 0);
  const notEvaluated  = typeof summary.notEvaluated === 'number' ? summary.notEvaluated : 0;

  return {
    totalRequiringAttention: unavailable + unknownGrouped + notEvaluated,
    unavailable,
    unknown: unknownGrouped,
    notEvaluated,
    territories,
  };
}

export function assembleGlobalMusicFootprint(intelligenceReport, cio, globalFootprintEvidence, territoryIntelligence) {
  try {
    const evidence = (globalFootprintEvidence && typeof globalFootprintEvidence === 'object' && !Array.isArray(globalFootprintEvidence))
      ? globalFootprintEvidence
      : {};
    const appleAvailability = evidence.appleAvailability ?? 'NOT_FOUND';

    // ── Phase 5.2 primary path: Territory Intelligence Engine™ ──────────────
    const hasEngineOutput = territoryIntelligence
      && typeof territoryIntelligence === 'object'
      && Array.isArray(territoryIntelligence.territories)
      && territoryIntelligence.summary
      && typeof territoryIntelligence.summary === 'object';

    if (hasEngineOutput) {
      const { summary } = territoryIntelligence;
      const available   = typeof summary.available   === 'number' ? summary.available   : 0;
      const unavailable = typeof summary.unavailable === 'number' ? summary.unavailable : 0;
      const evaluatedTotal = available + unavailable;
      const territoriesEvaluated = typeof territoryIntelligence.totalTerritoriesEvaluated === 'number'
        ? territoryIntelligence.totalTerritoriesEvaluated
        : evaluatedTotal;

      const coveragePercent = evaluatedTotal > 0 ? Math.round((available / evaluatedTotal) * 100) : 0;
      const status     = deriveStatus(coveragePercent);
      const confidence = deriveConfidenceFromTerritoryIntelligence(appleAvailability, territoryIntelligence);

      const reachNarrative = available > 0
        ? `Available in ${available} ${available === 1 ? 'territory' : 'territories'} (${coveragePercent}% of global markets).`
        : 'Catalog availability could not be confirmed across reviewed distribution territories.';

      return deepFreeze({
        territoriesAvailable:   available,
        territoriesUnavailable: unavailable,
        territoriesEvaluated,
        coveragePercent,
        status,
        reachNarrative,
        confidence,
        distributionGaps: buildDistributionGaps(territoryIntelligence),
      });
    }

    // ── Legacy fallback path — preserved for callers not yet passing
    //    territoryIntelligence. Unchanged from pre-Phase-5.2 behavior.
    //    distributionGaps is null here — no per-territory evidence exists on
    //    this path to derive it from honestly. ──────────────────────────────
    const globalSfData = evidence.globalStorefrontAvailability;

    if (!globalSfData || typeof globalSfData !== 'object' || Array.isArray(globalSfData)) {
      return deepFreeze({
        territoriesAvailable:   0,
        territoriesUnavailable: 0,
        territoriesEvaluated:   0,
        coveragePercent:        0,
        status:                 'Limited',
        reachNarrative:         'Territory availability could not be determined from reviewed sources.',
        confidence:             deriveConfidence(appleAvailability, null),
        distributionGaps:       null,
      });
    }

    const available   = Array.isArray(globalSfData.available)   ? globalSfData.available.length   : 0;
    const unavailable = Array.isArray(globalSfData.unavailable) ? globalSfData.unavailable.length : 0;
    const total       = typeof globalSfData.total === 'number'  ? globalSfData.total              : available + unavailable;

    const coveragePercent = total > 0 ? Math.round((available / total) * 100) : 0;
    const status          = deriveStatus(coveragePercent);
    const confidence      = deriveConfidence(appleAvailability, globalSfData);

    const reachNarrative = available > 0
      ? `Available in ${available} ${available === 1 ? 'territory' : 'territories'} (${coveragePercent}% of global markets).`
      : 'Catalog availability could not be confirmed across reviewed distribution territories.';

    return deepFreeze({
      territoriesAvailable:   available,
      territoriesUnavailable: unavailable,
      territoriesEvaluated:   total,
      coveragePercent,
      status,
      reachNarrative,
      confidence,
      distributionGaps:       null,
    });
  } catch (err) {
    console.error('[global-music-footprint] assembly threw (returning empty shell):', err?.message || err);
    return deepFreeze({
      territoriesAvailable:   0,
      territoriesUnavailable: 0,
      territoriesEvaluated:   0,
      coveragePercent:        0,
      status:                 'Limited',
      reachNarrative:         'Territory availability could not be determined from reviewed sources.',
      confidence:             'Unable to Confirm',
      distributionGaps:       null,
    });
  }
}
