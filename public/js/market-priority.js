/* ============================================================
 * DEPRECATED — retired by the Canonical Market Metadata Registry™
 * ============================================================
 * Board directive (2026-07-22, Canonical Market Metadata Registry):
 * this file's real logic has moved to
 * public/js/canonical-market-metadata.js, which is now the single
 * source of truth for market tier/priority metadata.
 *
 * global-music-footprint.html (the only real consumer, confirmed by a
 * full-repo grep before this migration) no longer loads this file --
 * it loads canonical-market-metadata.js directly. This shim exists
 * purely as a safety net per the Board's "maintain backward
 * compatibility" instruction, in case anything else references
 * window.RoyalteMarketPriority. It contains no logic of its own; it
 * only delegates to the real registry, so there is exactly one place
 * the tier/priority ruleset actually lives.
 *
 * Safe to delete once nothing loads this file — check with:
 *   grep -rn "market-priority" public/
 * ============================================================ */

(function (root) {
  'use strict';

  if (!root.RoyalteCanonicalMarketMetadata) {
    console.warn('[market-priority] deprecated shim loaded without canonical-market-metadata.js present -- load order likely needs fixing.');
    return;
  }

  var CMM = root.RoyalteCanonicalMarketMetadata;
  root.RoyalteMarketPriority = {
    getTier: CMM.getTier,
    tierLabel: CMM.tierLabel,
    derive: function (status, code) { return CMM.deriveStrategicSignal(status, code); },
  };
}(window));
