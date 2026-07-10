// ─────────────────────────────────────────────────────────────────────
//  Royaltē Global Music Footprint™ — Assembler (GMF Phase v1.0)
// ─────────────────────────────────────────────────────────────────────
//
//  Constitutional position:
//
//    Scan Engine
//        ↓ platforms.appleMusic.details.storefrontAvailability
//    Canonical Intelligence Object™
//        ↓
//    Global Music Footprint™  ◀── THIS MODULE
//        ↓
//    Mission Control™ · Global Music Footprint Card
//
//  Data source (Apple is canonical per Board directive):
//    Primary:  canonical.platforms.appleMusic.details.globalStorefrontAvailability
//              Full Apple Music storefront universe — 167 markets verified
//              per scan via checkGlobalStorefrontAvailability() in apple-music.js.
//              Uses a single probe album ID checked across all storefronts
//              in batched waves of 50 (Promise.allSettled, isolated failures).
//
//  Scope note: Global Music Footprint™ uses Apple Music storefront availability
//  as the canonical global availability signal for v1.0.
//
//  Purity invariants:
//    - Pure function of (intelligenceReport, cio, canonical).
//    - Never throws on any input (null / undefined / malformed).
//    - Never mutates inputs.
//    - Output is deep-frozen.
//
// ─────────────────────────────────────────────────────────────────────
//  Output shape (v1.0):
//
//    {
//      territoriesAvailable:   number,  // Apple Music storefronts where probe album found
//      territoriesUnavailable: number,  // Apple Music storefronts where probe album absent
//      coveragePercent:        number,  // (available / total) × 100, rounded
//      status:                 string,  // 'Global' | 'Strong' | 'Regional' | 'Limited'
//      confidence:             string,  // 'Verified' | 'Partial' | 'Unable to Confirm' | 'Not Found'
//    }
//
// ─────────────────────────────────────────────────────────────────────

export const GLOBAL_MUSIC_FOOTPRINT_VERSION = '1.0.0';

// Board-locked status thresholds (coverage percent of BIG6 markets checked).
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

export function assembleGlobalMusicFootprint(intelligenceReport, cio, canonical) {
  try {
    const safeCanonical = (canonical && typeof canonical === 'object' && !Array.isArray(canonical))
      ? canonical
      : {};

    const appleDetails      = safeCanonical?.platforms?.appleMusic?.details;
    const appleAvailability = safeCanonical?.platforms?.appleMusic?.availability ?? 'NOT_FOUND';
    // Primary: full 167-storefront global check.
    // Shape: { available: string[], unavailable: string[], errors: Array<{sf,error}>, total: number }
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
