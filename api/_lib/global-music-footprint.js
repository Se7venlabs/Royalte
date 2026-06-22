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
//    Primary:  canonical.platforms.appleMusic.details.storefrontAvailability
//              BIG6 storefront availability check — 8 markets verified
//              per scan (us, ca, gb, de, fr, jp, au, br).
//              Populated by checkStorefrontAvailability() in apple-music.js.
//
//  v1.0 scope note: territoriesAvailable reflects the 8 BIG6 markets
//  checked per scan, not the full Apple Music territory list (~167).
//  Full global territory checking (one API call per storefront) is
//  deferred to a Phase 2 expansion.
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
//      territoriesAvailable:   number,  // BIG6 markets where artist's music found
//      territoriesUnavailable: number,  // BIG6 markets where artist's music absent
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
    const storefrontData    = appleDetails?.storefrontAvailability;

    if (!storefrontData || typeof storefrontData !== 'object' || Array.isArray(storefrontData)) {
      return deepFreeze({
        territoriesAvailable:   0,
        territoriesUnavailable: 0,
        coveragePercent:        0,
        status:                 'Limited',
        confidence:             deriveConfidence(appleAvailability, null),
      });
    }

    // Count BIG6 markets: available = at least one album present in that market.
    let available   = 0;
    let unavailable = 0;
    for (const sfData of Object.values(storefrontData)) {
      if (sfData && typeof sfData === 'object' &&
          Array.isArray(sfData.available) && sfData.available.length > 0) {
        available++;
      } else {
        unavailable++;
      }
    }

    const total           = available + unavailable;
    const coveragePercent = total > 0 ? Math.round((available / total) * 100) : 0;
    const status          = deriveStatus(coveragePercent);
    const confidence      = deriveConfidence(appleAvailability, storefrontData);

    return deepFreeze({
      territoriesAvailable:   available,
      territoriesUnavailable: unavailable,
      coveragePercent,
      status,
      confidence,
    });
  } catch (err) {
    console.error('[global-music-footprint] assembly threw (returning empty shell):', err?.message || err);
    return deepFreeze({
      territoriesAvailable:   0,
      territoriesUnavailable: 0,
      coveragePercent:        0,
      status:                 'Limited',
      confidence:             'Unable to Confirm',
    });
  }
}
