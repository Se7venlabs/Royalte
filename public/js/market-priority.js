/* ============================================================
 * Royaltē Market Priority™ — canonical metadata (not evidence)
 * ============================================================
 * Board directive (2026-07-22, Country Intelligence™ Priority & Revenue
 * Opportunity): a configurable, editorial ruleset classifying relative
 * market size/importance, entirely independent of any single artist's
 * real catalog status. This is NOT Territory Intelligence Engine output
 * and must never be presented as evidence -- it is a business-priority
 * lens applied on top of real evidence (t.status), not a substitute
 * for it.
 *
 * Distinct from BIG6_STOREFRONTS (lib/territory/canonical-territory-
 * vocabulary.js, Brief 011) -- that is a separately Board-locked list
 * for a different consumer. This module intentionally does not reuse
 * or mutate it, to avoid a change here rippling into that lock.
 *
 * Only territories the Board explicitly named are classified below.
 * Every other real Apple storefront defaults to Tier 3 ("Standard
 * Market") -- not a claim about that market's real size, simply "not
 * yet named in this ruleset." Extend TIER_1 / TIER_2 only through a
 * Board directive, never by inference.
 *
 * No numeric revenue or audience figures are computed or displayed
 * anywhere in this module -- every output is a qualitative bucket
 * traceable to two real/canonical inputs only: catalog status and tier.
 * ============================================================ */

(function (root) {
  'use strict';

  var TIER_1 = ['us', 'ca', 'gb', 'de', 'jp', 'br', 'in', 'mx', 'fr', 'au'];
  var TIER_2 = ['it', 'es', 'nl', 'kr', 'se', 'no'];

  var TIER_LABEL = { 1: 'Tier 1', 2: 'Tier 2', 3: 'Standard Market' };

  function getTier(code) {
    var c = String(code || '').toLowerCase();
    if (TIER_1.indexOf(c) !== -1) return 1;
    if (TIER_2.indexOf(c) !== -1) return 2;
    return 3;
  }

  function tierLabel(tier) {
    return TIER_LABEL[tier] || 'Standard Market';
  }

  // Deterministic, documented rule combining real catalog status (t.status,
  // from the Territory Intelligence Engine) with the canonical tier above.
  // 'explanation' is set only for cases needing bespoke copy (Available);
  // callers fall back to a generic tier-based sentence otherwise.
  function derive(status, tier) {
    if (status === 'Available') {
      return { priority: 'N/A', revenueOpportunity: 'N/A', explanation: 'No action needed — catalog is already available here.' };
    }
    if (status === 'Unavailable') {
      if (tier === 1) return { priority: 'Critical', revenueOpportunity: 'High', explanation: null };
      if (tier === 2) return { priority: 'High', revenueOpportunity: 'Medium', explanation: null };
      return { priority: 'Medium', revenueOpportunity: 'Low', explanation: null };
    }
    if (status === 'Unknown') {
      if (tier === 1) return { priority: 'High', revenueOpportunity: 'Medium', explanation: null };
      return { priority: 'Medium', revenueOpportunity: 'Low', explanation: null };
    }
    // Pending Review / not yet evaluated -- can't prioritize what hasn't
    // been assessed yet.
    return { priority: 'Low', revenueOpportunity: 'Unknown', explanation: null };
  }

  root.RoyalteMarketPriority = {
    getTier: getTier,
    tierLabel: tierLabel,
    derive: derive,
  };
}(window));
