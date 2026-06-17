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
//      apple:           IDENTITY_STATE,
//      spotify:         IDENTITY_STATE,
//      youtube:         IDENTITY_STATE,
//      score:           number 0-100 | null,
//      strengths:       Array<{ provider, label }>,
//      issues:          Array<{ provider, label, ruleId, title, severity }>,
//      recommendations: Array<{ provider, label, ruleId, recommendation }>,
//    }
//
//  SCORE FORMULA (Stage 3B v1.0 — flagged for Board ratification):
//    VERIFIED          = 100 points
//    ACTION_REQUIRED   =  50 points
//    NOT_FOUND         =   0 points
//    UNABLE_TO_CONFIRM = excluded from numerator AND denominator
//    score = round(sum / count of evaluated providers)
//    All-UNABLE_TO_CONFIRM → score = null
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

const SCORE_POINTS = Object.freeze({
  [IDENTITY_STATE.VERIFIED]:        100,
  [IDENTITY_STATE.ACTION_REQUIRED]:  50,
  [IDENTITY_STATE.NOT_FOUND]:         0,
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

function computeScore(states) {
  let total = 0;
  let counted = 0;
  for (const p of IDENTITY_PROVIDERS) {
    const s = states[p];
    if (s === IDENTITY_STATE.UNABLE_TO_CONFIRM) continue;
    const points = SCORE_POINTS[s];
    if (typeof points !== 'number') continue;
    total   += points;
    counted += 1;
  }
  return counted === 0 ? null : Math.round(total / counted);
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

  return deepFreeze({
    apple:   states.apple,
    spotify: states.spotify,
    youtube: states.youtube,
    score:   computeScore(states),
    strengths,
    issues,
    recommendations,
  });
}
