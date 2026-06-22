// ─────────────────────────────────────────────────────────────────────
//  Royaltē Mission Control™ — Intelligence Rendering Layer (Phase 4B-3)
// ─────────────────────────────────────────────────────────────────────
//
//  This is the GENERIC rendering layer Mission Control uses to
//  consume Royaltē intelligence objects. Identity Intelligence™ is
//  the first implementation per the Stage 4B-3 brief; the same
//  module will house the renderer for each future intelligence
//  domain. No domain receives special treatment.
//
//  Canonical surface (Board Concerns 3 + 6, 2026-06-17):
//
//      renderIdentity(intelligence)         ← Stage 4B-3 — implemented
//      renderPublishing(intelligence)       ← future stage (stub below)
//      renderCatalog(intelligence)          ← future stage (stub below)
//      renderBackend(intelligence)          ← future stage (stub below)
//      renderHealth(intelligence)           ← future stage (stub below)
//      renderPriorityActions(intelligence)  ← future stage (stub below)
//
//  Each renderer takes a deep-frozen intelligence object produced by
//  its respective assembler and returns a deterministic, pure render
//  plan. The boot module (public/js/mission-control.js) applies the
//  plans to the locked Mission Control DOM. The Mission Control
//  surface itself never grows special-case branches per domain —
//  it dispatches to a renderer and renders.
//
//  This file is PURE. Zero DOM access. Zero network. Zero side
//  effects. Every export is a deterministic function of its input.
//  Two reasons it exists separately from the boot module:
//
//    1. Constitutional separation. The Board rule for Mission
//       Control™ is "zero business logic." Keeping the input → output
//       transformations in their own pure module makes that
//       inspectable; if a future commit drifts toward computing,
//       inferring, or filtering anything, this file is the first
//       place a reviewer looks.
//    2. Testability. Node ES modules can import this file directly.
//       No DOM, no Supabase, no /js/ root-relative imports. The test
//       suite tests/mission-control-wiring-test.mjs verifies every
//       renderer in isolation.
//
//  Constitutional invariants (Stage 4B-3 Board Final Review,
//  2026-06-17):
//
//    - Mission Control reads pre-assembled intelligence ONLY.
//    - Mission Control never calls a domain assembler (assembleCio,
//      runIntelligenceEngine, assembleIdentityIntelligence, or any
//      future equivalent).
//    - Mission Control never calls a provider adapter.
//    - Mission Control never evaluates Rule Library logic.
//    - Mission Control never mutates the input object.
//    - Mission Control never recomputes any value the intelligence
//      object already carries.
//    - Mission Control never derives recommendations.
//    - Mission Control never infers provider state.
//    - Mission Control never calculates Health, Score, or Rating
//      values. Royaltē Health™ owns executive scoring; Identity
//      Intelligence™ owns identity status + coverage. The Mission
//      Control coverage indicator is labelled "Identity Coverage"
//      and NEVER "Score", "Health", or "Rating".
//
//  Provider iteration (Board Concerns 2 + 6):
//
//    The render plan iterates whatever `supportedProviders` carries.
//    This module contains NO hardcoded provider list and NO
//    provider-keyed map. A future supported provider (Amazon,
//    Deezer, Tidal, SoundCloud, etc.) appears automatically once
//    the corresponding adapter publishes it into IDENTITY_PROVIDERS
//    upstream. Mission Control requires no JavaScript change at
//    that point — only an HTML card with the matching
//    `data-mc-identity-provider="<key>"` attribute needs to exist
//    in public/mission-control.html for the iteration target.
//
//  Amazon Music (Board Concern 5):
//
//    Amazon is intentionally ABSENT from the Identity Intelligence
//    output (no provider observations exist). It therefore never
//    appears in supportedProviders, never appears in any render
//    plan, and never contributes to coverage / verifiedProviders /
//    totalProviders. The Amazon visual card in Mission Control is
//    static "Coming Soon / Official Integration Pending" HTML
//    outside the iterated render path — never an intelligence
//    state, never produced from data.
// ─────────────────────────────────────────────────────────────────────

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
// assembler produced them. `supportedProviders` is the canonical
// source of truth — this function contains NO hardcoded provider
// list (Board Concern 2, 2026-06-17). Returns [] on any malformed
// input; never throws.
//
// Output shape:
//   [{ provider, state, pillClass, pillText }]
//
// `provider` is the canonical key (e.g. 'apple'). The boot module
// uses it to find the matching [data-mc-identity-provider="<key>"]
// card in the locked HTML. Per-provider display labels (e.g. "Apple
// Music for Artists") live in the static HTML alongside the data
// attribute, not in this module — Mission Control never assumes a
// label mapping, so a future provider added to supportedProviders
// upstream picks up its label from whatever HTML card declares its
// data attribute.
//
// The number of entries is dynamic — the row never assumes a fixed
// count (Board R7 + R8 + Concern 2).
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
      pillClass: STATE_PILL_CLASS[state] || 'mc-pill',
      pillText:  STATE_PILL_TEXT[state]  || 'Unknown',
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

// ─────────────────────────────────────────────────────────────────────
//  Canonical render entry points (Board Concerns 3 + 6, 2026-06-17)
//
//  These are the public API every future intelligence domain will
//  conform to. The boot module dispatches to `renderIdentity(...)`
//  today; the placeholder stubs below document the contract future
//  domains must satisfy — same input shape (deep-frozen intelligence
//  object from the assembler), same return shape (a domain render
//  plan), same purity guarantees (no DOM, no network, no mutation,
//  no business logic).
//
//  Each placeholder throws a deliberate "not yet implemented" error
//  so production code accidentally calling a future stub fails loudly
//  rather than rendering nothing.
// ─────────────────────────────────────────────────────────────────────

// renderIdentity(intelligence)
//
// CANONICAL entry point for the Identity Intelligence™ domain. Composes
// the three plan builders above into a single render-plan object the
// boot module can apply against the locked Mission Control DOM.
//
// Output:
//   {
//     coverage:        { value, label, summary } | null,
//     providers:       [{ provider, state, pillClass, pillText }, …],
//     recommendations: [{ ruleId, provider, providerLabel, label }, …] | null,
//   }
//
// `null` on coverage / recommendations means "intelligence absent —
// leave the locked sample HTML in place." The boot module honors that.
export function renderIdentity(intelligence) {
  return {
    coverage:        buildCoveragePlan(intelligence),
    providers:       buildProviderRenderPlan(intelligence),
    recommendations: buildRecommendationsPlan(intelligence),
  };
}

// ─── Future stages (Board Concern 6) — placeholder stubs ─────────────
//
// When each future intelligence domain is delivered, replace the body
// of the matching stub with a renderer implementation that follows
// the same contract: pure, deterministic, deep-frozen-safe, never
// computing the intelligence it renders, never reaching into the
// scan engine, the Rule Library, or a provider adapter.
//
// Until then, calling any of these throws — preventing accidental
// "silent render nothing" bugs in production.

function _unimplemented(domain) {
  return () => {
    throw new Error(
      `[mc-renderers] render${domain}() is not yet implemented. ` +
      `Future stage will land it; until then Mission Control must ` +
      `not invoke this entry point.`
    );
  };
}

// ─────────────────────────────────────────────────────────────────────
//  Catalog Intelligence™ renderers  (Catalog Phase v1.0)
// ─────────────────────────────────────────────────────────────────────
//
//  Mirror of renderIdentity / renderPublishing. The boot module
//  dispatches catalogPlan through the same applyXxx pattern; nothing
//  about MC's surface is special-cased per domain.
//
//  Mission Control:
//    - never recomputes singles/eps/albums/features/totalTracks
//    - never re-derives catalogStatus or confidence
//    - reads pre-assembled catalogIntelligence from audit_scans.payload
//
//  Return shape:
//    {
//      singles:       number,
//      eps:           number,
//      albums:        number,
//      features:      number,
//      totalTracks:   number,
//      catalogStatus: string,
//      confidence:    string,
//    }
//  or null when intelligence is absent (boot module leaves locked sample HTML).

export function safeCatalogIntelligence(ci) {
  if (!ci || typeof ci !== 'object' || Array.isArray(ci)) return null;
  return ci;
}

// renderCatalog(intelligence) — canonical entry point for the Catalog
// Intelligence™ domain. Passes through the frozen intelligence object
// as a plain render plan the boot module applies against the locked
// Mission Control DOM. Returns null on absent / malformed intelligence.
export function renderCatalog(intelligence) {
  const ci = safeCatalogIntelligence(intelligence);
  if (!ci) return null;
  return {
    singles:       typeof ci.singles       === 'number' ? ci.singles       : 0,
    eps:           typeof ci.eps           === 'number' ? ci.eps           : 0,
    albums:        typeof ci.albums        === 'number' ? ci.albums        : 0,
    features:      typeof ci.features      === 'number' ? ci.features      : 0,
    totalTracks:   typeof ci.totalTracks   === 'number' ? ci.totalTracks   : 0,
    catalogStatus: typeof ci.catalogStatus === 'string' ? ci.catalogStatus : 'Unknown',
    confidence:    typeof ci.confidence    === 'string' ? ci.confidence    : 'Unable to Confirm',
  };
}
export const renderBackend         = _unimplemented('Backend');
export const renderHealth          = _unimplemented('Health');
export const renderPriorityActions = _unimplemented('PriorityActions');

// ─────────────────────────────────────────────────────────────────────
//  Publishing Intelligence™ renderers  (Phase 5B Board D6 + D7)
// ─────────────────────────────────────────────────────────────────────
//
//  Mirror of renderIdentity. The boot module dispatches identityPlan +
//  publishingPlan through the same apply* pattern; nothing about MC's
//  surface is special-cased per domain.
//
//  Mission Control:
//    - never assumes a fixed number of registration metrics (iterates
//      whatever `registrations` carries)
//    - never labels coverage as Score / Health / Rating
//    - never recomputes per-metric state, coverage, or recommendations
//    - never reaches into the MLC adapter / Rule Library / CIO
//
//  Display labels for the four metrics live in the locked MC HTML
//  alongside each row's `data-mc-publishing-metric` attribute — this
//  module is label-agnostic.

const PUBLISHING_STATE_PILL_CLASS = Object.freeze({
  VERIFIED:          'mc-pill mc-pill--verified',
  ACTION_REQUIRED:   'mc-pill mc-pill--action',
  NOT_FOUND:         'mc-pill mc-pill--notfound',
  UNABLE_TO_CONFIRM: 'mc-pill mc-pill--unable',
});

const PUBLISHING_STATE_PILL_TEXT = Object.freeze({
  VERIFIED:          'Verified',
  ACTION_REQUIRED:   'Action Required',
  NOT_FOUND:         'Not Found',
  UNABLE_TO_CONFIRM: 'Unable to Confirm',
});

export { PUBLISHING_STATE_PILL_CLASS, PUBLISHING_STATE_PILL_TEXT };

function safePublishingIntelligence(pi) {
  if (!pi || typeof pi !== 'object' || Array.isArray(pi)) return null;
  return pi;
}

export { safePublishingIntelligence };

// buildPublishingRegistrationPlan(intelligence)
//
// One render plan entry per `registrations` key, IN ITERATION ORDER
// the assembler produced them. This function contains NO hardcoded
// metric list — `Object.keys(intelligence.registrations)` is the
// canonical source. Returns [] on any malformed input.
//
// Output shape:
//   [{ metric, state, pillClass, pillText }]
//
// `metric` is the canonical key (e.g. 'mlcRegistration'). The boot
// module uses it to find the matching [data-mc-publishing-metric="<key>"]
// row in the locked HTML.
export function buildPublishingRegistrationPlan(intelligence) {
  const pi = safePublishingIntelligence(intelligence);
  if (!pi) return [];
  const regs = (pi.registrations && typeof pi.registrations === 'object' && !Array.isArray(pi.registrations))
    ? pi.registrations
    : null;
  if (!regs) return [];
  return Object.keys(regs).map((metric) => {
    const state = regs[metric] || 'UNABLE_TO_CONFIRM';
    return {
      metric,
      state,
      pillClass: PUBLISHING_STATE_PILL_CLASS[state] || 'mc-pill',
      pillText:  PUBLISHING_STATE_PILL_TEXT[state]  || 'Unknown',
    };
  });
}

// buildPublishingCoveragePlan(intelligence)
//
// Same contract as Identity Intelligence's coverage plan. Label is
// 'Publishing Coverage' — never 'Score / Health / Rating' (Board D9).
// Returns null on missing intelligence so the boot module can leave
// the locked sample HTML in place.
export function buildPublishingCoveragePlan(intelligence) {
  const pi = safePublishingIntelligence(intelligence);
  if (!pi) return null;
  if (typeof pi.coverage !== 'number') return null;
  return {
    value:   pi.coverage,
    label:   'Publishing Coverage',
    summary: `${pi.registeredCount ?? 0} of ${pi.totalChecked ?? 0} verified`,
  };
}

// renderPublishing(intelligence) — canonical entry point for the
// Publishing Intelligence™ domain. Composes the per-metric plan +
// coverage plan into a single render-plan object the boot module
// applies against the locked Mission Control DOM.
//
// Output:
//   {
//     coverage:      { value, label, summary } | null,
//     registrations: [{ metric, state, pillClass, pillText }, …],
//   }
//
// `null` on coverage means "intelligence absent — leave the locked
// sample HTML in place."
export function renderPublishing(intelligence) {
  return {
    coverage:      buildPublishingCoveragePlan(intelligence),
    registrations: buildPublishingRegistrationPlan(intelligence),
  };
}
