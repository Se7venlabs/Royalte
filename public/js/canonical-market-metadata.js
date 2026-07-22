/* ============================================================
 * Royaltē Canonical Market Metadata Registry™
 * ============================================================
 * Board directive (2026-07-22, Canonical Market Metadata Registry).
 * Single source of truth for STATIC market characteristics -- the
 * authoritative registry every intelligence engine and workspace should
 * eventually reference instead of declaring its own copy. Replaces
 * public/js/market-priority.js (retired -- now a thin deprecated shim
 * delegating to this file, kept for backward compatibility only).
 *
 * CONSTITUTIONAL BOUNDARY -- this file is metadata only. It must never
 * contain business logic, evidence calculations, territory/platform/
 * artist availability calculations, revenue or streaming estimates, or
 * AI recommendations. Those remain the exclusive responsibility of the
 * Territory Intelligence Engine (api/_lib/territory-intelligence.js)
 * and other canonical engines -- this registry is never consulted by
 * them today, and this file does not modify them.
 *
 * A territory's real-time strategic signal (e.g. "Critical Priority")
 * is NOT static metadata -- it depends on that artist's real catalog
 * status for that scan, which changes per-artist and per-scan. That
 * computation intentionally lives in deriveStrategicSignal() below, kept
 * separate from the REGISTRY array itself, which holds only properties
 * true of the territory regardless of any artist's evidence.
 *
 * Fields intentionally NOT included as static registry data:
 *   - name: available for free on every real evidence object already
 *     (t.name, sourced by the Engine from getCountryName() in
 *     lib/territory/canonical-territory-vocabulary.js) -- duplicating it
 *     here would create exactly the kind of second copy this registry
 *     exists to prevent.
 *   - subRegion, strategicPriority: no real source exists for these yet;
 *     left out entirely rather than populated with empty placeholders,
 *     per "only populate fields required today."
 *
 * Fields explicitly reserved for future expansion (Board directive) --
 * NOT implemented, NOT stubbed, added only when a real source exists:
 *   population, streamingAdoption, gdp, primaryLanguages,
 *   musicConsumptionIndex, appleMusicMarketSize, spotifyMarketSize,
 *   regionalGrowthRate, catalogDemandScore, historicalScanFrequency,
 *   distributorCoverage, rightsOrganizationPresence, emergingMarketFlag,
 *   athenaIntelligenceWeight, executiveOpportunityScore.
 *
 * Cross-environment note: this file is a classic browser script (matches
 * every other public/js/ file in this codebase -- no bundler, no
 * type="module", zero script-ordering risk). It is NOT yet imported by
 * any backend/Node module. Genuine backend consumption (Territory
 * Intelligence Engine, ATHENA) requires a follow-up decision -- either
 * converting this page's scripts to ES modules or a small backend-side
 * mirror -- explicitly deferred, not solved here. See governance/
 * GLOBAL_MUSIC_FOOTPRINT_CANONICAL_MARKET_METADATA_REGISTRY.md.
 *
 * revenueOpportunityTier / marketClassification below reproduce exactly
 * the Board-specified Tier 1 (us, ca, gb, de, jp, br, in, mx, fr, au)
 * and Tier 2 (it, es, nl, kr, se, no) lists from the prior brief -- no
 * additional codes were invented. region assignment reproduces the
 * exact grouping already established in ALL_APPLE_STOREFRONTS
 * (lib/territory/canonical-territory-vocabulary.js): Americas (36),
 * Europe (44), Middle East & Africa (55), Asia Pacific (32).
 * displayOrder mirrors that same array's existing, stable order.
 * ============================================================ */

(function (root) {
  'use strict';

  var REGISTRY = Object.freeze([
  { code: "ag", isoCode: "AG", appleStorefront: true, region: "Americas", marketClassification: "Standard Market", revenueOpportunityTier: 3, displayOrder: 0, enabled: true },
  { code: "ai", isoCode: "AI", appleStorefront: true, region: "Americas", marketClassification: "Standard Market", revenueOpportunityTier: 3, displayOrder: 1, enabled: true },
  { code: "bb", isoCode: "BB", appleStorefront: true, region: "Americas", marketClassification: "Standard Market", revenueOpportunityTier: 3, displayOrder: 2, enabled: true },
  { code: "bm", isoCode: "BM", appleStorefront: true, region: "Americas", marketClassification: "Standard Market", revenueOpportunityTier: 3, displayOrder: 3, enabled: true },
  { code: "bo", isoCode: "BO", appleStorefront: true, region: "Americas", marketClassification: "Standard Market", revenueOpportunityTier: 3, displayOrder: 4, enabled: true },
  { code: "br", isoCode: "BR", appleStorefront: true, region: "Americas", marketClassification: "Tier 1", revenueOpportunityTier: 1, displayOrder: 5, enabled: true },
  { code: "bs", isoCode: "BS", appleStorefront: true, region: "Americas", marketClassification: "Standard Market", revenueOpportunityTier: 3, displayOrder: 6, enabled: true },
  { code: "bz", isoCode: "BZ", appleStorefront: true, region: "Americas", marketClassification: "Standard Market", revenueOpportunityTier: 3, displayOrder: 7, enabled: true },
  { code: "ca", isoCode: "CA", appleStorefront: true, region: "Americas", marketClassification: "Tier 1", revenueOpportunityTier: 1, displayOrder: 8, enabled: true },
  { code: "cl", isoCode: "CL", appleStorefront: true, region: "Americas", marketClassification: "Standard Market", revenueOpportunityTier: 3, displayOrder: 9, enabled: true },
  { code: "co", isoCode: "CO", appleStorefront: true, region: "Americas", marketClassification: "Standard Market", revenueOpportunityTier: 3, displayOrder: 10, enabled: true },
  { code: "cr", isoCode: "CR", appleStorefront: true, region: "Americas", marketClassification: "Standard Market", revenueOpportunityTier: 3, displayOrder: 11, enabled: true },
  { code: "dm", isoCode: "DM", appleStorefront: true, region: "Americas", marketClassification: "Standard Market", revenueOpportunityTier: 3, displayOrder: 12, enabled: true },
  { code: "do", isoCode: "DO", appleStorefront: true, region: "Americas", marketClassification: "Standard Market", revenueOpportunityTier: 3, displayOrder: 13, enabled: true },
  { code: "ec", isoCode: "EC", appleStorefront: true, region: "Americas", marketClassification: "Standard Market", revenueOpportunityTier: 3, displayOrder: 14, enabled: true },
  { code: "gd", isoCode: "GD", appleStorefront: true, region: "Americas", marketClassification: "Standard Market", revenueOpportunityTier: 3, displayOrder: 15, enabled: true },
  { code: "gt", isoCode: "GT", appleStorefront: true, region: "Americas", marketClassification: "Standard Market", revenueOpportunityTier: 3, displayOrder: 16, enabled: true },
  { code: "gy", isoCode: "GY", appleStorefront: true, region: "Americas", marketClassification: "Standard Market", revenueOpportunityTier: 3, displayOrder: 17, enabled: true },
  { code: "hn", isoCode: "HN", appleStorefront: true, region: "Americas", marketClassification: "Standard Market", revenueOpportunityTier: 3, displayOrder: 18, enabled: true },
  { code: "jm", isoCode: "JM", appleStorefront: true, region: "Americas", marketClassification: "Standard Market", revenueOpportunityTier: 3, displayOrder: 19, enabled: true },
  { code: "kn", isoCode: "KN", appleStorefront: true, region: "Americas", marketClassification: "Standard Market", revenueOpportunityTier: 3, displayOrder: 20, enabled: true },
  { code: "ky", isoCode: "KY", appleStorefront: true, region: "Americas", marketClassification: "Standard Market", revenueOpportunityTier: 3, displayOrder: 21, enabled: true },
  { code: "lc", isoCode: "LC", appleStorefront: true, region: "Americas", marketClassification: "Standard Market", revenueOpportunityTier: 3, displayOrder: 22, enabled: true },
  { code: "mx", isoCode: "MX", appleStorefront: true, region: "Americas", marketClassification: "Tier 1", revenueOpportunityTier: 1, displayOrder: 23, enabled: true },
  { code: "ni", isoCode: "NI", appleStorefront: true, region: "Americas", marketClassification: "Standard Market", revenueOpportunityTier: 3, displayOrder: 24, enabled: true },
  { code: "pa", isoCode: "PA", appleStorefront: true, region: "Americas", marketClassification: "Standard Market", revenueOpportunityTier: 3, displayOrder: 25, enabled: true },
  { code: "pe", isoCode: "PE", appleStorefront: true, region: "Americas", marketClassification: "Standard Market", revenueOpportunityTier: 3, displayOrder: 26, enabled: true },
  { code: "py", isoCode: "PY", appleStorefront: true, region: "Americas", marketClassification: "Standard Market", revenueOpportunityTier: 3, displayOrder: 27, enabled: true },
  { code: "sr", isoCode: "SR", appleStorefront: true, region: "Americas", marketClassification: "Standard Market", revenueOpportunityTier: 3, displayOrder: 28, enabled: true },
  { code: "sv", isoCode: "SV", appleStorefront: true, region: "Americas", marketClassification: "Standard Market", revenueOpportunityTier: 3, displayOrder: 29, enabled: true },
  { code: "tc", isoCode: "TC", appleStorefront: true, region: "Americas", marketClassification: "Standard Market", revenueOpportunityTier: 3, displayOrder: 30, enabled: true },
  { code: "tt", isoCode: "TT", appleStorefront: true, region: "Americas", marketClassification: "Standard Market", revenueOpportunityTier: 3, displayOrder: 31, enabled: true },
  { code: "us", isoCode: "US", appleStorefront: true, region: "Americas", marketClassification: "Tier 1", revenueOpportunityTier: 1, displayOrder: 32, enabled: true },
  { code: "uy", isoCode: "UY", appleStorefront: true, region: "Americas", marketClassification: "Standard Market", revenueOpportunityTier: 3, displayOrder: 33, enabled: true },
  { code: "vc", isoCode: "VC", appleStorefront: true, region: "Americas", marketClassification: "Standard Market", revenueOpportunityTier: 3, displayOrder: 34, enabled: true },
  { code: "vg", isoCode: "VG", appleStorefront: true, region: "Americas", marketClassification: "Standard Market", revenueOpportunityTier: 3, displayOrder: 35, enabled: true },
  { code: "al", isoCode: "AL", appleStorefront: true, region: "Europe", marketClassification: "Standard Market", revenueOpportunityTier: 3, displayOrder: 36, enabled: true },
  { code: "am", isoCode: "AM", appleStorefront: true, region: "Europe", marketClassification: "Standard Market", revenueOpportunityTier: 3, displayOrder: 37, enabled: true },
  { code: "at", isoCode: "AT", appleStorefront: true, region: "Europe", marketClassification: "Standard Market", revenueOpportunityTier: 3, displayOrder: 38, enabled: true },
  { code: "az", isoCode: "AZ", appleStorefront: true, region: "Europe", marketClassification: "Standard Market", revenueOpportunityTier: 3, displayOrder: 39, enabled: true },
  { code: "be", isoCode: "BE", appleStorefront: true, region: "Europe", marketClassification: "Standard Market", revenueOpportunityTier: 3, displayOrder: 40, enabled: true },
  { code: "bg", isoCode: "BG", appleStorefront: true, region: "Europe", marketClassification: "Standard Market", revenueOpportunityTier: 3, displayOrder: 41, enabled: true },
  { code: "by", isoCode: "BY", appleStorefront: true, region: "Europe", marketClassification: "Standard Market", revenueOpportunityTier: 3, displayOrder: 42, enabled: true },
  { code: "ch", isoCode: "CH", appleStorefront: true, region: "Europe", marketClassification: "Standard Market", revenueOpportunityTier: 3, displayOrder: 43, enabled: true },
  { code: "cy", isoCode: "CY", appleStorefront: true, region: "Europe", marketClassification: "Standard Market", revenueOpportunityTier: 3, displayOrder: 44, enabled: true },
  { code: "cz", isoCode: "CZ", appleStorefront: true, region: "Europe", marketClassification: "Standard Market", revenueOpportunityTier: 3, displayOrder: 45, enabled: true },
  { code: "de", isoCode: "DE", appleStorefront: true, region: "Europe", marketClassification: "Tier 1", revenueOpportunityTier: 1, displayOrder: 46, enabled: true },
  { code: "dk", isoCode: "DK", appleStorefront: true, region: "Europe", marketClassification: "Standard Market", revenueOpportunityTier: 3, displayOrder: 47, enabled: true },
  { code: "ee", isoCode: "EE", appleStorefront: true, region: "Europe", marketClassification: "Standard Market", revenueOpportunityTier: 3, displayOrder: 48, enabled: true },
  { code: "es", isoCode: "ES", appleStorefront: true, region: "Europe", marketClassification: "Tier 2", revenueOpportunityTier: 2, displayOrder: 49, enabled: true },
  { code: "fi", isoCode: "FI", appleStorefront: true, region: "Europe", marketClassification: "Standard Market", revenueOpportunityTier: 3, displayOrder: 50, enabled: true },
  { code: "fr", isoCode: "FR", appleStorefront: true, region: "Europe", marketClassification: "Tier 1", revenueOpportunityTier: 1, displayOrder: 51, enabled: true },
  { code: "gb", isoCode: "GB", appleStorefront: true, region: "Europe", marketClassification: "Tier 1", revenueOpportunityTier: 1, displayOrder: 52, enabled: true },
  { code: "gr", isoCode: "GR", appleStorefront: true, region: "Europe", marketClassification: "Standard Market", revenueOpportunityTier: 3, displayOrder: 53, enabled: true },
  { code: "hr", isoCode: "HR", appleStorefront: true, region: "Europe", marketClassification: "Standard Market", revenueOpportunityTier: 3, displayOrder: 54, enabled: true },
  { code: "hu", isoCode: "HU", appleStorefront: true, region: "Europe", marketClassification: "Standard Market", revenueOpportunityTier: 3, displayOrder: 55, enabled: true },
  { code: "ie", isoCode: "IE", appleStorefront: true, region: "Europe", marketClassification: "Standard Market", revenueOpportunityTier: 3, displayOrder: 56, enabled: true },
  { code: "is", isoCode: "IS", appleStorefront: true, region: "Europe", marketClassification: "Standard Market", revenueOpportunityTier: 3, displayOrder: 57, enabled: true },
  { code: "it", isoCode: "IT", appleStorefront: true, region: "Europe", marketClassification: "Tier 2", revenueOpportunityTier: 2, displayOrder: 58, enabled: true },
  { code: "kg", isoCode: "KG", appleStorefront: true, region: "Europe", marketClassification: "Standard Market", revenueOpportunityTier: 3, displayOrder: 59, enabled: true },
  { code: "kz", isoCode: "KZ", appleStorefront: true, region: "Europe", marketClassification: "Standard Market", revenueOpportunityTier: 3, displayOrder: 60, enabled: true },
  { code: "lt", isoCode: "LT", appleStorefront: true, region: "Europe", marketClassification: "Standard Market", revenueOpportunityTier: 3, displayOrder: 61, enabled: true },
  { code: "lu", isoCode: "LU", appleStorefront: true, region: "Europe", marketClassification: "Standard Market", revenueOpportunityTier: 3, displayOrder: 62, enabled: true },
  { code: "lv", isoCode: "LV", appleStorefront: true, region: "Europe", marketClassification: "Standard Market", revenueOpportunityTier: 3, displayOrder: 63, enabled: true },
  { code: "md", isoCode: "MD", appleStorefront: true, region: "Europe", marketClassification: "Standard Market", revenueOpportunityTier: 3, displayOrder: 64, enabled: true },
  { code: "mk", isoCode: "MK", appleStorefront: true, region: "Europe", marketClassification: "Standard Market", revenueOpportunityTier: 3, displayOrder: 65, enabled: true },
  { code: "mt", isoCode: "MT", appleStorefront: true, region: "Europe", marketClassification: "Standard Market", revenueOpportunityTier: 3, displayOrder: 66, enabled: true },
  { code: "nl", isoCode: "NL", appleStorefront: true, region: "Europe", marketClassification: "Tier 2", revenueOpportunityTier: 2, displayOrder: 67, enabled: true },
  { code: "no", isoCode: "NO", appleStorefront: true, region: "Europe", marketClassification: "Tier 2", revenueOpportunityTier: 2, displayOrder: 68, enabled: true },
  { code: "pl", isoCode: "PL", appleStorefront: true, region: "Europe", marketClassification: "Standard Market", revenueOpportunityTier: 3, displayOrder: 69, enabled: true },
  { code: "pt", isoCode: "PT", appleStorefront: true, region: "Europe", marketClassification: "Standard Market", revenueOpportunityTier: 3, displayOrder: 70, enabled: true },
  { code: "ro", isoCode: "RO", appleStorefront: true, region: "Europe", marketClassification: "Standard Market", revenueOpportunityTier: 3, displayOrder: 71, enabled: true },
  { code: "ru", isoCode: "RU", appleStorefront: true, region: "Europe", marketClassification: "Standard Market", revenueOpportunityTier: 3, displayOrder: 72, enabled: true },
  { code: "se", isoCode: "SE", appleStorefront: true, region: "Europe", marketClassification: "Tier 2", revenueOpportunityTier: 2, displayOrder: 73, enabled: true },
  { code: "si", isoCode: "SI", appleStorefront: true, region: "Europe", marketClassification: "Standard Market", revenueOpportunityTier: 3, displayOrder: 74, enabled: true },
  { code: "sk", isoCode: "SK", appleStorefront: true, region: "Europe", marketClassification: "Standard Market", revenueOpportunityTier: 3, displayOrder: 75, enabled: true },
  { code: "tj", isoCode: "TJ", appleStorefront: true, region: "Europe", marketClassification: "Standard Market", revenueOpportunityTier: 3, displayOrder: 76, enabled: true },
  { code: "tr", isoCode: "TR", appleStorefront: true, region: "Europe", marketClassification: "Standard Market", revenueOpportunityTier: 3, displayOrder: 77, enabled: true },
  { code: "ua", isoCode: "UA", appleStorefront: true, region: "Europe", marketClassification: "Standard Market", revenueOpportunityTier: 3, displayOrder: 78, enabled: true },
  { code: "uz", isoCode: "UZ", appleStorefront: true, region: "Europe", marketClassification: "Standard Market", revenueOpportunityTier: 3, displayOrder: 79, enabled: true },
  { code: "ae", isoCode: "AE", appleStorefront: true, region: "Middle East & Africa", marketClassification: "Standard Market", revenueOpportunityTier: 3, displayOrder: 80, enabled: true },
  { code: "ao", isoCode: "AO", appleStorefront: true, region: "Middle East & Africa", marketClassification: "Standard Market", revenueOpportunityTier: 3, displayOrder: 81, enabled: true },
  { code: "bf", isoCode: "BF", appleStorefront: true, region: "Middle East & Africa", marketClassification: "Standard Market", revenueOpportunityTier: 3, displayOrder: 82, enabled: true },
  { code: "bh", isoCode: "BH", appleStorefront: true, region: "Middle East & Africa", marketClassification: "Standard Market", revenueOpportunityTier: 3, displayOrder: 83, enabled: true },
  { code: "bj", isoCode: "BJ", appleStorefront: true, region: "Middle East & Africa", marketClassification: "Standard Market", revenueOpportunityTier: 3, displayOrder: 84, enabled: true },
  { code: "bw", isoCode: "BW", appleStorefront: true, region: "Middle East & Africa", marketClassification: "Standard Market", revenueOpportunityTier: 3, displayOrder: 85, enabled: true },
  { code: "cd", isoCode: "CD", appleStorefront: true, region: "Middle East & Africa", marketClassification: "Standard Market", revenueOpportunityTier: 3, displayOrder: 86, enabled: true },
  { code: "cg", isoCode: "CG", appleStorefront: true, region: "Middle East & Africa", marketClassification: "Standard Market", revenueOpportunityTier: 3, displayOrder: 87, enabled: true },
  { code: "ci", isoCode: "CI", appleStorefront: true, region: "Middle East & Africa", marketClassification: "Standard Market", revenueOpportunityTier: 3, displayOrder: 88, enabled: true },
  { code: "cm", isoCode: "CM", appleStorefront: true, region: "Middle East & Africa", marketClassification: "Standard Market", revenueOpportunityTier: 3, displayOrder: 89, enabled: true },
  { code: "cv", isoCode: "CV", appleStorefront: true, region: "Middle East & Africa", marketClassification: "Standard Market", revenueOpportunityTier: 3, displayOrder: 90, enabled: true },
  { code: "dj", isoCode: "DJ", appleStorefront: true, region: "Middle East & Africa", marketClassification: "Standard Market", revenueOpportunityTier: 3, displayOrder: 91, enabled: true },
  { code: "dz", isoCode: "DZ", appleStorefront: true, region: "Middle East & Africa", marketClassification: "Standard Market", revenueOpportunityTier: 3, displayOrder: 92, enabled: true },
  { code: "eg", isoCode: "EG", appleStorefront: true, region: "Middle East & Africa", marketClassification: "Standard Market", revenueOpportunityTier: 3, displayOrder: 93, enabled: true },
  { code: "et", isoCode: "ET", appleStorefront: true, region: "Middle East & Africa", marketClassification: "Standard Market", revenueOpportunityTier: 3, displayOrder: 94, enabled: true },
  { code: "ga", isoCode: "GA", appleStorefront: true, region: "Middle East & Africa", marketClassification: "Standard Market", revenueOpportunityTier: 3, displayOrder: 95, enabled: true },
  { code: "gh", isoCode: "GH", appleStorefront: true, region: "Middle East & Africa", marketClassification: "Standard Market", revenueOpportunityTier: 3, displayOrder: 96, enabled: true },
  { code: "gm", isoCode: "GM", appleStorefront: true, region: "Middle East & Africa", marketClassification: "Standard Market", revenueOpportunityTier: 3, displayOrder: 97, enabled: true },
  { code: "gn", isoCode: "GN", appleStorefront: true, region: "Middle East & Africa", marketClassification: "Standard Market", revenueOpportunityTier: 3, displayOrder: 98, enabled: true },
  { code: "gq", isoCode: "GQ", appleStorefront: true, region: "Middle East & Africa", marketClassification: "Standard Market", revenueOpportunityTier: 3, displayOrder: 99, enabled: true },
  { code: "gw", isoCode: "GW", appleStorefront: true, region: "Middle East & Africa", marketClassification: "Standard Market", revenueOpportunityTier: 3, displayOrder: 100, enabled: true },
  { code: "il", isoCode: "IL", appleStorefront: true, region: "Middle East & Africa", marketClassification: "Standard Market", revenueOpportunityTier: 3, displayOrder: 101, enabled: true },
  { code: "jo", isoCode: "JO", appleStorefront: true, region: "Middle East & Africa", marketClassification: "Standard Market", revenueOpportunityTier: 3, displayOrder: 102, enabled: true },
  { code: "ke", isoCode: "KE", appleStorefront: true, region: "Middle East & Africa", marketClassification: "Standard Market", revenueOpportunityTier: 3, displayOrder: 103, enabled: true },
  { code: "kw", isoCode: "KW", appleStorefront: true, region: "Middle East & Africa", marketClassification: "Standard Market", revenueOpportunityTier: 3, displayOrder: 104, enabled: true },
  { code: "lb", isoCode: "LB", appleStorefront: true, region: "Middle East & Africa", marketClassification: "Standard Market", revenueOpportunityTier: 3, displayOrder: 105, enabled: true },
  { code: "lr", isoCode: "LR", appleStorefront: true, region: "Middle East & Africa", marketClassification: "Standard Market", revenueOpportunityTier: 3, displayOrder: 106, enabled: true },
  { code: "ly", isoCode: "LY", appleStorefront: true, region: "Middle East & Africa", marketClassification: "Standard Market", revenueOpportunityTier: 3, displayOrder: 107, enabled: true },
  { code: "ma", isoCode: "MA", appleStorefront: true, region: "Middle East & Africa", marketClassification: "Standard Market", revenueOpportunityTier: 3, displayOrder: 108, enabled: true },
  { code: "mg", isoCode: "MG", appleStorefront: true, region: "Middle East & Africa", marketClassification: "Standard Market", revenueOpportunityTier: 3, displayOrder: 109, enabled: true },
  { code: "ml", isoCode: "ML", appleStorefront: true, region: "Middle East & Africa", marketClassification: "Standard Market", revenueOpportunityTier: 3, displayOrder: 110, enabled: true },
  { code: "mr", isoCode: "MR", appleStorefront: true, region: "Middle East & Africa", marketClassification: "Standard Market", revenueOpportunityTier: 3, displayOrder: 111, enabled: true },
  { code: "mu", isoCode: "MU", appleStorefront: true, region: "Middle East & Africa", marketClassification: "Standard Market", revenueOpportunityTier: 3, displayOrder: 112, enabled: true },
  { code: "mw", isoCode: "MW", appleStorefront: true, region: "Middle East & Africa", marketClassification: "Standard Market", revenueOpportunityTier: 3, displayOrder: 113, enabled: true },
  { code: "mz", isoCode: "MZ", appleStorefront: true, region: "Middle East & Africa", marketClassification: "Standard Market", revenueOpportunityTier: 3, displayOrder: 114, enabled: true },
  { code: "na", isoCode: "NA", appleStorefront: true, region: "Middle East & Africa", marketClassification: "Standard Market", revenueOpportunityTier: 3, displayOrder: 115, enabled: true },
  { code: "ne", isoCode: "NE", appleStorefront: true, region: "Middle East & Africa", marketClassification: "Standard Market", revenueOpportunityTier: 3, displayOrder: 116, enabled: true },
  { code: "ng", isoCode: "NG", appleStorefront: true, region: "Middle East & Africa", marketClassification: "Standard Market", revenueOpportunityTier: 3, displayOrder: 117, enabled: true },
  { code: "om", isoCode: "OM", appleStorefront: true, region: "Middle East & Africa", marketClassification: "Standard Market", revenueOpportunityTier: 3, displayOrder: 118, enabled: true },
  { code: "qa", isoCode: "QA", appleStorefront: true, region: "Middle East & Africa", marketClassification: "Standard Market", revenueOpportunityTier: 3, displayOrder: 119, enabled: true },
  { code: "rw", isoCode: "RW", appleStorefront: true, region: "Middle East & Africa", marketClassification: "Standard Market", revenueOpportunityTier: 3, displayOrder: 120, enabled: true },
  { code: "sa", isoCode: "SA", appleStorefront: true, region: "Middle East & Africa", marketClassification: "Standard Market", revenueOpportunityTier: 3, displayOrder: 121, enabled: true },
  { code: "sc", isoCode: "SC", appleStorefront: true, region: "Middle East & Africa", marketClassification: "Standard Market", revenueOpportunityTier: 3, displayOrder: 122, enabled: true },
  { code: "sl", isoCode: "SL", appleStorefront: true, region: "Middle East & Africa", marketClassification: "Standard Market", revenueOpportunityTier: 3, displayOrder: 123, enabled: true },
  { code: "sn", isoCode: "SN", appleStorefront: true, region: "Middle East & Africa", marketClassification: "Standard Market", revenueOpportunityTier: 3, displayOrder: 124, enabled: true },
  { code: "st", isoCode: "ST", appleStorefront: true, region: "Middle East & Africa", marketClassification: "Standard Market", revenueOpportunityTier: 3, displayOrder: 125, enabled: true },
  { code: "sz", isoCode: "SZ", appleStorefront: true, region: "Middle East & Africa", marketClassification: "Standard Market", revenueOpportunityTier: 3, displayOrder: 126, enabled: true },
  { code: "td", isoCode: "TD", appleStorefront: true, region: "Middle East & Africa", marketClassification: "Standard Market", revenueOpportunityTier: 3, displayOrder: 127, enabled: true },
  { code: "tn", isoCode: "TN", appleStorefront: true, region: "Middle East & Africa", marketClassification: "Standard Market", revenueOpportunityTier: 3, displayOrder: 128, enabled: true },
  { code: "tz", isoCode: "TZ", appleStorefront: true, region: "Middle East & Africa", marketClassification: "Standard Market", revenueOpportunityTier: 3, displayOrder: 129, enabled: true },
  { code: "ug", isoCode: "UG", appleStorefront: true, region: "Middle East & Africa", marketClassification: "Standard Market", revenueOpportunityTier: 3, displayOrder: 130, enabled: true },
  { code: "ye", isoCode: "YE", appleStorefront: true, region: "Middle East & Africa", marketClassification: "Standard Market", revenueOpportunityTier: 3, displayOrder: 131, enabled: true },
  { code: "za", isoCode: "ZA", appleStorefront: true, region: "Middle East & Africa", marketClassification: "Standard Market", revenueOpportunityTier: 3, displayOrder: 132, enabled: true },
  { code: "zm", isoCode: "ZM", appleStorefront: true, region: "Middle East & Africa", marketClassification: "Standard Market", revenueOpportunityTier: 3, displayOrder: 133, enabled: true },
  { code: "zw", isoCode: "ZW", appleStorefront: true, region: "Middle East & Africa", marketClassification: "Standard Market", revenueOpportunityTier: 3, displayOrder: 134, enabled: true },
  { code: "au", isoCode: "AU", appleStorefront: true, region: "Asia Pacific", marketClassification: "Tier 1", revenueOpportunityTier: 1, displayOrder: 135, enabled: true },
  { code: "bt", isoCode: "BT", appleStorefront: true, region: "Asia Pacific", marketClassification: "Standard Market", revenueOpportunityTier: 3, displayOrder: 136, enabled: true },
  { code: "cn", isoCode: "CN", appleStorefront: true, region: "Asia Pacific", marketClassification: "Standard Market", revenueOpportunityTier: 3, displayOrder: 137, enabled: true },
  { code: "fj", isoCode: "FJ", appleStorefront: true, region: "Asia Pacific", marketClassification: "Standard Market", revenueOpportunityTier: 3, displayOrder: 138, enabled: true },
  { code: "fm", isoCode: "FM", appleStorefront: true, region: "Asia Pacific", marketClassification: "Standard Market", revenueOpportunityTier: 3, displayOrder: 139, enabled: true },
  { code: "hk", isoCode: "HK", appleStorefront: true, region: "Asia Pacific", marketClassification: "Standard Market", revenueOpportunityTier: 3, displayOrder: 140, enabled: true },
  { code: "id", isoCode: "ID", appleStorefront: true, region: "Asia Pacific", marketClassification: "Standard Market", revenueOpportunityTier: 3, displayOrder: 141, enabled: true },
  { code: "in", isoCode: "IN", appleStorefront: true, region: "Asia Pacific", marketClassification: "Tier 1", revenueOpportunityTier: 1, displayOrder: 142, enabled: true },
  { code: "jp", isoCode: "JP", appleStorefront: true, region: "Asia Pacific", marketClassification: "Tier 1", revenueOpportunityTier: 1, displayOrder: 143, enabled: true },
  { code: "kh", isoCode: "KH", appleStorefront: true, region: "Asia Pacific", marketClassification: "Standard Market", revenueOpportunityTier: 3, displayOrder: 144, enabled: true },
  { code: "kr", isoCode: "KR", appleStorefront: true, region: "Asia Pacific", marketClassification: "Tier 2", revenueOpportunityTier: 2, displayOrder: 145, enabled: true },
  { code: "la", isoCode: "LA", appleStorefront: true, region: "Asia Pacific", marketClassification: "Standard Market", revenueOpportunityTier: 3, displayOrder: 146, enabled: true },
  { code: "lk", isoCode: "LK", appleStorefront: true, region: "Asia Pacific", marketClassification: "Standard Market", revenueOpportunityTier: 3, displayOrder: 147, enabled: true },
  { code: "mn", isoCode: "MN", appleStorefront: true, region: "Asia Pacific", marketClassification: "Standard Market", revenueOpportunityTier: 3, displayOrder: 148, enabled: true },
  { code: "mo", isoCode: "MO", appleStorefront: true, region: "Asia Pacific", marketClassification: "Standard Market", revenueOpportunityTier: 3, displayOrder: 149, enabled: true },
  { code: "mv", isoCode: "MV", appleStorefront: true, region: "Asia Pacific", marketClassification: "Standard Market", revenueOpportunityTier: 3, displayOrder: 150, enabled: true },
  { code: "my", isoCode: "MY", appleStorefront: true, region: "Asia Pacific", marketClassification: "Standard Market", revenueOpportunityTier: 3, displayOrder: 151, enabled: true },
  { code: "np", isoCode: "NP", appleStorefront: true, region: "Asia Pacific", marketClassification: "Standard Market", revenueOpportunityTier: 3, displayOrder: 152, enabled: true },
  { code: "nr", isoCode: "NR", appleStorefront: true, region: "Asia Pacific", marketClassification: "Standard Market", revenueOpportunityTier: 3, displayOrder: 153, enabled: true },
  { code: "nz", isoCode: "NZ", appleStorefront: true, region: "Asia Pacific", marketClassification: "Standard Market", revenueOpportunityTier: 3, displayOrder: 154, enabled: true },
  { code: "pg", isoCode: "PG", appleStorefront: true, region: "Asia Pacific", marketClassification: "Standard Market", revenueOpportunityTier: 3, displayOrder: 155, enabled: true },
  { code: "ph", isoCode: "PH", appleStorefront: true, region: "Asia Pacific", marketClassification: "Standard Market", revenueOpportunityTier: 3, displayOrder: 156, enabled: true },
  { code: "pw", isoCode: "PW", appleStorefront: true, region: "Asia Pacific", marketClassification: "Standard Market", revenueOpportunityTier: 3, displayOrder: 157, enabled: true },
  { code: "sb", isoCode: "SB", appleStorefront: true, region: "Asia Pacific", marketClassification: "Standard Market", revenueOpportunityTier: 3, displayOrder: 158, enabled: true },
  { code: "sg", isoCode: "SG", appleStorefront: true, region: "Asia Pacific", marketClassification: "Standard Market", revenueOpportunityTier: 3, displayOrder: 159, enabled: true },
  { code: "th", isoCode: "TH", appleStorefront: true, region: "Asia Pacific", marketClassification: "Standard Market", revenueOpportunityTier: 3, displayOrder: 160, enabled: true },
  { code: "tl", isoCode: "TL", appleStorefront: true, region: "Asia Pacific", marketClassification: "Standard Market", revenueOpportunityTier: 3, displayOrder: 161, enabled: true },
  { code: "to", isoCode: "TO", appleStorefront: true, region: "Asia Pacific", marketClassification: "Standard Market", revenueOpportunityTier: 3, displayOrder: 162, enabled: true },
  { code: "tw", isoCode: "TW", appleStorefront: true, region: "Asia Pacific", marketClassification: "Standard Market", revenueOpportunityTier: 3, displayOrder: 163, enabled: true },
  { code: "vn", isoCode: "VN", appleStorefront: true, region: "Asia Pacific", marketClassification: "Standard Market", revenueOpportunityTier: 3, displayOrder: 164, enabled: true },
  { code: "vu", isoCode: "VU", appleStorefront: true, region: "Asia Pacific", marketClassification: "Standard Market", revenueOpportunityTier: 3, displayOrder: 165, enabled: true },
  { code: "ws", isoCode: "WS", appleStorefront: true, region: "Asia Pacific", marketClassification: "Standard Market", revenueOpportunityTier: 3, displayOrder: 166, enabled: true }
  ].map(Object.freeze));

  var BY_CODE = {};
  REGISTRY.forEach(function (r) { BY_CODE[r.code] = r; });

  function getTerritory(code) {
    return BY_CODE[String(code || '').toLowerCase()] || null;
  }

  function getTier(code) {
    var r = getTerritory(code);
    return r ? r.revenueOpportunityTier : 3;
  }

  function tierLabel(tier) {
    return tier === 1 ? 'Tier 1' : tier === 2 ? 'Tier 2' : 'Standard Market';
  }

  function getRegion(code) {
    var r = getTerritory(code);
    return r ? r.region : null;
  }

  // The one legitimate piece of derived logic in this file: combines a
  // real, per-artist evidence value (status, from the Territory
  // Intelligence Engine) with static registry metadata (tier) into a
  // qualitative, non-numeric strategic signal. Never fabricates a number.
  // Identical rule to the prior market-priority.js implementation --
  // preserved verbatim for backward compatibility (see Migration Summary).
  function deriveStrategicSignal(status, code) {
    var tier = getTier(code);
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
    return { priority: 'Low', revenueOpportunity: 'Unknown', explanation: null };
  }

  root.RoyalteCanonicalMarketMetadata = {
    REGISTRY: REGISTRY,
    getTerritory: getTerritory,
    getTier: getTier,
    tierLabel: tierLabel,
    getRegion: getRegion,
    deriveStrategicSignal: deriveStrategicSignal,
  };

  // Backward compatibility for any stray window.RoyalteMarketPriority
  // reference lives in the deprecated public/js/market-priority.js shim,
  // not here -- keeping it in exactly one place.
}(window));
