// Canonical Territory Vocabulary™ — Phase 5.2 (Territory Intelligence Engine)
//
// Single source of truth for territory/storefront codes across Royaltē.
// Board decision (Phase 5.2 Implementation Decree §2, item 5): "One canonical
// territory vocabulary shall exist... every consumer imports from it rather
// than declaring its own copy."
//
// Prior state (Phase 5.1 Discovery Report §6): three independent, non-unified
// lists existed — api/apple-music.js's ALL_APPLE_STOREFRONTS/BIG6_STOREFRONTS,
// an identical duplicate in AppleMusicConnector.js, and a third, differently-
// coded list in api/territory-scan.js (EVALUATION_UNIVERSE/PRIORITY_MARKETS/
// COUNTRY_NAMES). Verified byte-identical (167 codes, same order) before
// consolidation — see Phase 5.2 completion report for the diff proof.
//
// ALL_APPLE_STOREFRONTS is Apple's own storefront code set (lowercase,
// "mostly but not entirely ISO-2" per Discovery — e.g. covers UK as 'gb'
// per ISO-3166, consistent here). This module does not invent a new code
// system; it consolidates the existing, live-verified Apple list as the
// canonical base, since Apple is Royaltē's sole territory-acquisition
// provider for Phase 5.2 (Decree §"Board Decisions", Decision 1).
//
// Named constant — change only through a Board directive (carried forward
// from the original per-file comments this module replaces).

// Global Music Footprint™ — complete Apple Music storefront universe.
// Source: Apple MusicKit documentation + storefronts API (2026-06).
// 167 storefronts, organized by region for readability.
export const ALL_APPLE_STOREFRONTS = Object.freeze([
  // Americas (36)
  'ag','ai','bb','bm','bo','br','bs','bz','ca','cl',
  'co','cr','dm','do','ec','gd','gt','gy','hn','jm',
  'kn','ky','lc','mx','ni','pa','pe','py','sr','sv',
  'tc','tt','us','uy','vc','vg',
  // Europe (44)
  'al','am','at','az','be','bg','by','ch','cy','cz',
  'de','dk','ee','es','fi','fr','gb','gr','hr','hu',
  'ie','is','it','kg','kz','lt','lu','lv','md','mk',
  'mt','nl','no','pl','pt','ro','ru','se','si','sk',
  'tj','tr','ua','uz',
  // Middle East & Africa (55)
  'ae','ao','bf','bh','bj','bw','cd','cg','ci','cm',
  'cv','dj','dz','eg','et','ga','gh','gm','gn','gq',
  'gw','il','jo','ke','kw','lb','lr','ly','ma','mg',
  'ml','mr','mu','mw','mz','na','ne','ng','om','qa',
  'rw','sa','sc','sl','sn','st','sz','td','tn','tz',
  'ug','ye','za','zm','zw',
  // Asia Pacific (32)
  'au','bt','cn','fj','fm','hk','id','in','jp','kh',
  'kr','la','lk','mn','mo','mv','my','np','nr','nz',
  'pg','ph','pw','sb','sg','th','tl','to','tw','vn',
  'vu','ws',
]);

// BIG6 storefronts — the primary revenue markets (Brief 011). Order is
// region-grouped so downstream consumers can iterate predictably.
export const BIG6_STOREFRONTS = Object.freeze(['us', 'ca', 'gb', 'de', 'fr', 'jp', 'au', 'br']);

// Display names for storefront/country codes — uppercase ISO-2 keys, matching
// the shape most non-Apple consumers (e.g. the legacy territory-scan.js
// evaluation universe) already used. Apple's lowercase storefront codes map
// 1:1 to these uppercase keys via toUpperCase() for the codes that are
// standard ISO-3166; this module does not currently include a name for every
// one of Apple's 167 codes, only those already carried forward from prior
// display-name work — gaps fall back to the raw code at the call site.
export const COUNTRY_NAMES = Object.freeze({
  US:'United States',CA:'Canada',GB:'United Kingdom',DE:'Germany',FR:'France',
  AU:'Australia',JP:'Japan',BR:'Brazil',MX:'Mexico',SE:'Sweden',NL:'Netherlands',
  IT:'Italy',ES:'Spain',KR:'South Korea',IN:'India',ZA:'South Africa',NG:'Nigeria',
  NZ:'New Zealand',NO:'Norway',DK:'Denmark',FI:'Finland',PL:'Poland',BE:'Belgium',
  CH:'Switzerland',AT:'Austria',PT:'Portugal',GR:'Greece',HU:'Hungary',CZ:'Czechia',
  RO:'Romania',SK:'Slovakia',BG:'Bulgaria',HR:'Croatia',SI:'Slovenia',EE:'Estonia',
  LV:'Latvia',LT:'Lithuania',IE:'Ireland',IS:'Iceland',LU:'Luxembourg',CY:'Cyprus',
  MT:'Malta',TR:'Turkey',IL:'Israel',AE:'UAE',SA:'Saudi Arabia',QA:'Qatar',
  KW:'Kuwait',BH:'Bahrain',OM:'Oman',EG:'Egypt',MA:'Morocco',TN:'Tunisia',
  AR:'Argentina',CL:'Chile',CO:'Colombia',PE:'Peru',VE:'Venezuela',EC:'Ecuador',
  UY:'Uruguay',PY:'Paraguay',BO:'Bolivia',DO:'Dominican Republic',GT:'Guatemala',
  HN:'Honduras',SV:'El Salvador',CR:'Costa Rica',PA:'Panama',JM:'Jamaica',
  TT:'Trinidad and Tobago',HK:'Hong Kong',SG:'Singapore',TW:'Taiwan',MY:'Malaysia',
  TH:'Thailand',ID:'Indonesia',PH:'Philippines',VN:'Vietnam',PK:'Pakistan',
  BD:'Bangladesh',LK:'Sri Lanka',NP:'Nepal',KH:'Cambodia',MM:'Myanmar',
  GH:'Ghana',KE:'Kenya',TZ:'Tanzania',UG:'Uganda',ET:'Ethiopia',CM:'Cameroon',
  CI:"Côte d'Ivoire",SN:'Senegal',RW:'Rwanda',ZW:'Zimbabwe',BW:'Botswana',
  NA:'Namibia',MZ:'Mozambique',MG:'Madagascar',MW:'Malawi',ZM:'Zambia',
});

/**
 * Returns the display name for a storefront/country code, accepting either
 * casing (Apple's lowercase storefront codes or uppercase ISO-2). Falls back
 * to the uppercased code itself when no display name is recorded.
 * @param {string} code
 * @returns {string}
 */
export function getCountryName(code) {
  if (typeof code !== 'string' || code.length === 0) return code;
  const upper = code.toUpperCase();
  return COUNTRY_NAMES[upper] ?? upper;
}

/**
 * Normalizes a storefront/country code to Apple's canonical lowercase form,
 * for comparison against ALL_APPLE_STOREFRONTS / BIG6_STOREFRONTS.
 * @param {string} code
 * @returns {string}
 */
export function normalizeStorefrontCode(code) {
  return typeof code === 'string' ? code.toLowerCase().trim() : code;
}

export function isKnownStorefront(code) {
  return ALL_APPLE_STOREFRONTS.includes(normalizeStorefrontCode(code));
}
