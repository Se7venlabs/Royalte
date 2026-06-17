// ─────────────────────────────────────────────────────────────────────
//  Royaltē Mission Control™ — pure render helpers (Phase 4B-3)
// ─────────────────────────────────────────────────────────────────────
//
//  This module is PURE. Zero DOM access. Zero network. Zero side
//  effects. Every export is a deterministic function of its input.
//
//  Two reasons it exists separately from the boot module:
//    1. Constitutional separation — the Board rule for Mission
//       Control™ is "zero business logic." Keeping the input → output
//       transformations in their own pure module makes that
//       inspectable; if a future commit drifts toward computing,
//       inferring, or filtering anything, this file is the first
//       place a reviewer looks.
//    2. Testability — Node ES modules can import this file directly.
//       No DOM, no Supabase, no /js/ root-relative imports.
//
//  Constitutional invariants (Stage 4B-3 brief, 2026-06-17):
//    - Mission Control reads from Identity Intelligence™ ONLY.
//    - Mission Control never calls assembleCio, runIntelligenceEngine,
//      or assembleIdentityIntelligence.
//    - Mission Control never mutates the input object.
//    - Mission Control never re-computes per-provider state, coverage,
//      or recommendations.
//    - Mission Control never labels coverage as "Score / Health /
//      Rating" — coverage is informational provider coverage only.
//    - Amazon Music is intentionally absent from supportedProviders
//      and from every render plan; the Amazon UI is static "Coming
//      Soon" informational HTML outside the iterated render path.
// ─────────────────────────────────────────────────────────────────────

// Display labels for each provider (used by issues / recommendations).
// Mission Control NEVER infers a label — it reads from this constant
// or, when present, from the `label` field on issues / recommendations
// produced by the Identity Intelligence assembler.
export const PROVIDER_LABELS = Object.freeze({
  apple:   'Apple Music for Artists',
  spotify: 'Spotify for Artists',
  youtube: 'YouTube Official Artist Channel',
});

// Per-state pill CSS class. Mirrors the locked Mission Control CSS in
// public/mission-control.html (mc-pill / mc-pill--verified /
// mc-pill--action / mc-pill--notfound / mc-pill--unable). The "Coming
// Soon" pill used on the Amazon informational card is mc-pill--coming-soon
// — but Mission Control NEVER produces that class from data, only as
// static HTML.
export const STATE_PILL_CLASS = Object.freeze({
  VERIFIED:          'mc-pill mc-pill--verified',
  ACTION_REQUIRED:   'mc-pill mc-pill--action',
  NOT_FOUND:         'mc-pill mc-pill--notfound',
  UNABLE_TO_CONFIRM: 'mc-pill mc-pill--unable',
});

// Per-state badge text. Title-case for visual presentation; the raw
// enum values (e.g. UNABLE_TO_CONFIRM) never appear on screen.
export const STATE_PILL_TEXT = Object.freeze({
  VERIFIED:          'Verified',
  ACTION_REQUIRED:   'Action Required',
  NOT_FOUND:         'Not Found',
  UNABLE_TO_CONFIRM: 'Unable to Confirm',
});

// safeIdentityIntelligence: returns the input if it is a plain object,
// otherwise null. Mission Control never throws on a missing or malformed
// intelligence object — the failure mode is "leave the locked sample
// HTML in place" (Board failure-mode brief, Stage 4B-2).
export function safeIdentityIntelligence(ii) {
  if (!ii || typeof ii !== 'object' || Array.isArray(ii)) return null;
  return ii;
}

// buildProviderRenderPlan(intelligence)
//
// One render plan entry per supported provider, IN THE ORDER the
// assembler produced them (supportedProviders is canonical). Returns
// an empty array on any malformed input.
//
// Output shape:
//   [{ provider, state, pillClass, pillText, providerLabel }]
//
// This is what the boot module iterates over to update each
// [data-mc-identity-provider="<key>"] DOM card. The number of entries
// is dynamic — the row never assumes a fixed count (Board R7 + R8).
export function buildProviderRenderPlan(intelligence) {
  const ii = safeIdentityIntelligence(intelligence);
  if (!ii) return [];
  const supported = Array.isArray(ii.supportedProviders) ? ii.supportedProviders : [];
  const providers = (ii.providers && typeof ii.providers === 'object') ? ii.providers : {};
  return supported.map((provider) => {
    const state = providers[provider] || 'UNABLE_TO_CONFIRM';
    return {
      provider,
      state,
      pillClass:     STATE_PILL_CLASS[state] || 'mc-pill',
      pillText:      STATE_PILL_TEXT[state]  || 'Unknown',
      providerLabel: PROVIDER_LABELS[provider] || provider,
    };
  });
}

// buildCoveragePlan(intelligence)
//
// Returns the values the coverage indicator DOM nodes display.
//
//   value          — number 0-100 (informational provider coverage)
//   label          — always 'Identity Coverage' (Board R: never
//                    'Score / Health / Rating')
//   summary        — '<verified> of <total> providers verified' (Board
//                    worked example)
//
// Returns null on missing intelligence — boot module leaves the locked
// sample HTML untouched in that case.
export function buildCoveragePlan(intelligence) {
  const ii = safeIdentityIntelligence(intelligence);
  if (!ii) return null;
  if (typeof ii.coverage !== 'number') return null;
  return {
    value:   ii.coverage,
    label:   'Identity Coverage',
    summary: `${ii.verifiedProviders ?? 0} of ${ii.totalProviders ?? 0} providers verified`,
  };
}

// buildRecommendationsPlan(intelligence)
//
// Pass-through of identityIntelligence.recommendations with shape
// adapted to the existing Priority Actions DOM. Per Board:
//   - Mission Control does NOT create recommendations
//   - Mission Control does NOT filter recommendations
//   - Mission Control does NOT reorder recommendations
//
// We surface the FULL recommendations array verbatim. The locked CSS
// only formats label text; provider context can be displayed alongside
// if a future visual pass authorizes it.
//
// Returns null on missing intelligence — boot module leaves the
// locked sample HTML in place. Returns [] on intelligence present but
// no recommendations — boot module renders an empty list (legitimate
// "all clear" state).
export function buildRecommendationsPlan(intelligence) {
  const ii = safeIdentityIntelligence(intelligence);
  if (!ii) return null;
  const recs = Array.isArray(ii.recommendations) ? ii.recommendations : [];
  return recs.map((r) => ({
    ruleId:        (r && typeof r.ruleId === 'string') ? r.ruleId : null,
    provider:      (r && typeof r.provider === 'string') ? r.provider : null,
    providerLabel: (r && typeof r.label === 'string') ? r.label : '',
    label:         (r && typeof r.recommendation === 'string') ? r.recommendation : '',
  }));
}
