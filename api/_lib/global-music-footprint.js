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
//  A legacy fallback path (direct canonical.platforms.appleMusic reads) is
//  preserved for any caller not yet passing the new 4th argument, but the
//  Territory Intelligence Engine is the primary and intended data source.
//
//  Purity invariants:
//    - Pure function of (intelligenceReport, cio, canonical, territoryIntelligence).
//    - Never throws on any input (null / undefined / malformed).
//    - Never mutates inputs.
//    - Output is deep-frozen.
//
// ─────────────────────────────────────────────────────────────────────
//  Output shape (v1.0 — unchanged by Phase 5.2):
//
//    {
//      territoriesAvailable:   number,
//      territoriesUnavailable: number,
//      coveragePercent:        number,  // (available / evaluated) × 100, rounded
//      status:                 string,  // 'Global' | 'Strong' | 'Regional' | 'Limited'
//      confidence:             string,  // 'Verified' | 'Partial' | 'Unable to Confirm' | 'Not Found'
//    }
//
// ─────────────────────────────────────────────────────────────────────

export const GLOBAL_MUSIC_FOOTPRINT_VERSION = '1.0.0';

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

export function assembleGlobalMusicFootprint(intelligenceReport, cio, canonical, territoryIntelligence) {
  try {
    const safeCanonical = (canonical && typeof canonical === 'object' && !Array.isArray(canonical))
      ? canonical
      : {};
    const appleAvailability = safeCanonical?.platforms?.appleMusic?.availability ?? 'NOT_FOUND';

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

      const coveragePercent = evaluatedTotal > 0 ? Math.round((available / evaluatedTotal) * 100) : 0;
      const status     = deriveStatus(coveragePercent);
      const confidence = deriveConfidenceFromTerritoryIntelligence(appleAvailability, territoryIntelligence);

      const reachNarrative = available > 0
        ? `Available in ${available} ${available === 1 ? 'territory' : 'territories'} (${coveragePercent}% of global markets).`
        : 'Catalog availability could not be confirmed across reviewed distribution territories.';

      return deepFreeze({
        territoriesAvailable:   available,
        territoriesUnavailable: unavailable,
        coveragePercent,
        status,
        reachNarrative,
        confidence,
      });
    }

    // ── Legacy fallback path — preserved for callers not yet passing
    //    territoryIntelligence. Unchanged from pre-Phase-5.2 behavior. ──────
    const appleDetails = safeCanonical?.platforms?.appleMusic?.details;
    const globalSfData = appleDetails?.globalStorefrontAvailability;

    if (!globalSfData || typeof globalSfData !== 'object' || Array.isArray(globalSfData)) {
      return deepFreeze({
        territoriesAvailable:   0,
        territoriesUnavailable: 0,
        coveragePercent:        0,
        status:                 'Limited',
        reachNarrative:         'Territory availability could not be determined from reviewed sources.',
        confidence:             deriveConfidence(appleAvailability, null),
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
      coveragePercent,
      status,
      reachNarrative,
      confidence,
    });
  } catch (err) {
    console.error('[global-music-footprint] assembly threw (returning empty shell):', err?.message || err);
    return deepFreeze({
      territoriesAvailable:   0,
      territoriesUnavailable: 0,
      coveragePercent:        0,
      status:                 'Limited',
      reachNarrative:         'Territory availability could not be determined from reviewed sources.',
      confidence:             'Unable to Confirm',
    });
  }
}
