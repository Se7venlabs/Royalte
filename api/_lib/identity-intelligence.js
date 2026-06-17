// ─────────────────────────────────────────────────────────────────────
//  Royaltē Identity Intelligence™ — Assembler  (Phase 3B)
// ─────────────────────────────────────────────────────────────────────
//
//  Constitutional position:
//
//    Scan Engine → Apple Adapter → Canonical Intelligence Object™
//                                        ↓
//                                Rule Library™
//                                        ↓
//                                Observations
//                                        ↓
//                          Identity Intelligence™  ◀── THIS MODULE
//                                        ↓
//      Mission Control™ · Royaltē AI™ · Executive Brief™ · Priority Actions™
//
//  Single executive object shared by every downstream consumer.
//  Mission Control performs ZERO calculations — it reads this object
//  and renders.
//
// ─────────────────────────────────────────────────────────────────────
//  Board-locked four-state model (D4, 2026-06-17):
//
//    ✅ VERIFIED           availability === 'VERIFIED' AND no
//                           identity.<provider>.* observation fired
//
//    ⚠ ACTION_REQUIRED    availability === 'VERIFIED' AND ≥1
//                           identity.<provider>.* observation fired
//
//    ❌ NOT_FOUND          availability === 'NOT_FOUND'
//
//    ⏳ UNABLE_TO_CONFIRM  availability ∈ {AUTH_UNAVAILABLE, ERROR}
//                           OR observation missing entirely
//
//  CONSTITUTIONAL INVARIANT: AUTH_UNAVAILABLE and ERROR resolve to
//  UNABLE_TO_CONFIRM. They NEVER collapse to NOT_FOUND. Doing so
//  would mislead an artist into thinking Royaltē confirmed their
//  absence when in fact Royaltē could not look.
//
//  Provider coverage (Phase 3B): apple · spotify · youtube.
//  Amazon Music is deferred per Board D1 and intentionally absent
//  from the output object. Adding it would imply scan coverage that
//  does not exist.
//
//  Spotify intentionally never resolves to ACTION_REQUIRED in this
//  phase — Board D4 forbids inventing conditions until richer Spotify
//  observations exist. A future phase may add Spotify rules; until
//  then Spotify resolves only to VERIFIED / NOT_FOUND / UNABLE_TO_CONFIRM.
//
// ─────────────────────────────────────────────────────────────────────
//  Output object shape (deep-frozen):
//
//    {
//      providers: {
//        apple:   IDENTITY_STATE,
//        spotify: IDENTITY_STATE,
//        youtube: IDENTITY_STATE,
//      },
//      verifiedProviders: number,   // count of providers in VERIFIED state
//      totalProviders:    number,   // count of providers covered by this phase
//      coverage:          number,   // round(verifiedProviders / totalProviders * 100)
//      strengths:       Array<{ provider, label }>,
//      issues:          Array<{ provider, label, ruleId, title, severity }>,
//      recommendations: Array<{ provider, label, ruleId, recommendation }>,
//    }
//
//  COVERAGE (Board Final Lock, 2026-06-17 amendment):
//
//    Identity Intelligence™ owns identity STATUS only. It does NOT
//    compute an executive Health Score. That responsibility belongs
//    to the future Royaltē Health™ Engine, which will consume this
//    object alongside Publishing / Catalog / Backend / Metadata / DSP
//    / Collection / Revenue intelligence and produce ONE overall
//    Health Score for the entire backend ecosystem.
//
//    The `coverage` field exposed here is INFORMATIONAL ONLY:
//
//      coverage = round(verifiedProviders / totalProviders * 100)
//
//    UNABLE_TO_CONFIRM, NOT_FOUND, and ACTION_REQUIRED do NOT count as
//    verified — only IDENTITY_STATE.VERIFIED does. The denominator is
//    the full Phase-3 provider set (IDENTITY_PROVIDERS.length = 3).
//
//    Coverage answers: "Is my artist identity healthy across supported
//    providers?" It is NOT a Health Score. Mission Control™ MUST NOT
//    render this as an executive score — only as a provider-coverage
//    indicator alongside the per-provider state badges.
//
//    Any future weighted scoring across identity providers — or across
//    identity and other intelligence domains — is the exclusive
//    responsibility of the Royaltē Health™ Engine.
//
//  Determinism & purity:
//    - Pure function of (intelligenceReport, cio).
//    - Never throws on any input (null / undefined / malformed).
//    - Never mutates inputs.
//    - Output is deep-frozen.
// ─────────────────────────────────────────────────────────────────────

export const IDENTITY_INTELLIGENCE_VERSION = '1.0.0';

export const IDENTITY_STATE = Object.freeze({
  VERIFIED:          'VERIFIED',
  ACTION_REQUIRED:   'ACTION_REQUIRED',
  NOT_FOUND:         'NOT_FOUND',
  UNABLE_TO_CONFIRM: 'UNABLE_TO_CONFIRM',
});

export const IDENTITY_PROVIDERS = Object.freeze(['apple', 'spotify', 'youtube']);

export const IDENTITY_PROVIDER_LABELS = Object.freeze({
  apple:   'Apple Music',
  spotify: 'Spotify',
  youtube: 'YouTube',
});

function deepFreeze(obj) {
  if (obj === null || typeof obj !== 'object') return obj;
  for (const k of Object.keys(obj)) {
    const v = obj[k];
    if (v !== null && typeof v === 'object' && !Object.isFrozen(v)) {
      deepFreeze(v);
    }
  }
  return Object.freeze(obj);
}

function getProviderObs(cio, provider) {
  if (!cio || typeof cio !== 'object' || Array.isArray(cio)) return null;
  const o = cio.observations;
  if (!o || typeof o !== 'object' || Array.isArray(o)) return null;
  const ps = o.providers;
  if (!ps || typeof ps !== 'object' || Array.isArray(ps)) return null;
  const entry = ps[provider];
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return null;
  return entry;
}

function getProviderObservations(report, provider) {
  if (!report || !Array.isArray(report.observations)) return [];
  const prefix = `identity.${provider}.`;
  return report.observations.filter((o) =>
    o && typeof o.ruleId === 'string' && o.ruleId.startsWith(prefix)
  );
}

function deriveState(cio, report, provider) {
  const obs = getProviderObs(cio, provider);
  if (!obs) return IDENTITY_STATE.UNABLE_TO_CONFIRM;
  const availability = obs.availability;
  // Hard rule: AUTH_UNAVAILABLE and ERROR are Unable to Confirm,
  // never Not Found. Same applies to any unrecognised string and
  // null — caller could not establish a result.
  if (availability === 'NOT_FOUND') return IDENTITY_STATE.NOT_FOUND;
  if (availability !== 'VERIFIED') return IDENTITY_STATE.UNABLE_TO_CONFIRM;
  // VERIFIED upstream — check for provider-scoped observations that
  // promote the state to ACTION_REQUIRED.
  const fired = getProviderObservations(report, provider);
  return fired.length > 0 ? IDENTITY_STATE.ACTION_REQUIRED : IDENTITY_STATE.VERIFIED;
}

// computeCoverage(states)
//
// Provider-coverage percentage. Informational only — NOT a Health Score.
// Score-class computation belongs exclusively to the future Royaltē
// Health™ Engine; Identity Intelligence™ does not weight or grade.
function computeCoverage(states) {
  let verified = 0;
  const total = IDENTITY_PROVIDERS.length;
  for (const p of IDENTITY_PROVIDERS) {
    if (states[p] === IDENTITY_STATE.VERIFIED) verified += 1;
  }
  return {
    verifiedProviders: verified,
    totalProviders:    total,
    coverage:          total === 0 ? 0 : Math.round((verified / total) * 100),
  };
}

// assembleIdentityIntelligence(intelligenceReport, cio)
//
// Sole public entrypoint. Returns the deep-frozen Identity Intelligence™
// object every downstream surface consumes. Never throws.
export function assembleIdentityIntelligence(intelligenceReport, cio) {
  const safeReport = (intelligenceReport && typeof intelligenceReport === 'object' && !Array.isArray(intelligenceReport))
    ? intelligenceReport
    : null;
  const safeCio = (cio && typeof cio === 'object' && !Array.isArray(cio))
    ? cio
    : null;

  const states = {};
  for (const p of IDENTITY_PROVIDERS) {
    states[p] = deriveState(safeCio, safeReport, p);
  }

  const strengths       = [];
  const issues          = [];
  const recommendations = [];

  for (const p of IDENTITY_PROVIDERS) {
    const state = states[p];
    const label = IDENTITY_PROVIDER_LABELS[p];

    if (state === IDENTITY_STATE.VERIFIED) {
      strengths.push({ provider: p, label });
      continue;
    }

    if (state === IDENTITY_STATE.ACTION_REQUIRED) {
      const fired = getProviderObservations(safeReport, p);
      for (const obs of fired) {
        issues.push({
          provider: p,
          label,
          ruleId:   obs.ruleId,
          title:    typeof obs.title === 'string' ? obs.title : '',
          severity: typeof obs.severity === 'string' ? obs.severity : '',
        });
        if (typeof obs.recommendation === 'string' && obs.recommendation !== '') {
          recommendations.push({
            provider:       p,
            label,
            ruleId:         obs.ruleId,
            recommendation: obs.recommendation,
          });
        }
      }
      continue;
    }

    if (state === IDENTITY_STATE.NOT_FOUND) {
      issues.push({
        provider: p,
        label,
        ruleId:   null,
        title:    `${label} presence not confirmed in reviewed sources`,
        severity: 'MEDIUM',
      });
      continue;
    }

    // UNABLE_TO_CONFIRM: intentionally no issue, no strength.
    // We do not know — say nothing executive about it.
  }

  const { verifiedProviders, totalProviders, coverage } = computeCoverage(states);

  return deepFreeze({
    providers: {
      apple:   states.apple,
      spotify: states.spotify,
      youtube: states.youtube,
    },
    verifiedProviders,
    totalProviders,
    coverage,
    strengths,
    issues,
    recommendations,
  });
}
