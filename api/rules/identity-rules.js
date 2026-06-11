// ─────────────────────────────────────────────────────────────────────
//  Royaltē Rule Library™ — Identity rules
// ─────────────────────────────────────────────────────────────────────
//
//  Leaf module of the Rule Library. The constitutional header lives in
//  api/rules/index.js — this file ships the IDENTITY-category rule
//  array only.
//
//  Each rule is a frozen plain object with:
//    id              stable string, unique across the whole library
//    category        'IDENTITY' (literal — avoids circular import with
//                    index.js where the RULE_CATEGORIES constant lives)
//    title           human-readable, provider-neutral
//    description     evidence framing (no claims, no diagnoses)
//    severity        SEVERITY value
//    confidence      CONFIDENCE value
//    recommendation  guidance string consumers may surface
//    providerSources string[] — left empty when not provider-specific
//    condition       pure (cio) => boolean, never throws, never mutates
// ─────────────────────────────────────────────────────────────────────

function safeIdentity(cio) {
  if (!cio || typeof cio !== 'object' || Array.isArray(cio)) return null;
  const i = cio.identity;
  if (!i || typeof i !== 'object' || Array.isArray(i)) return null;
  return i;
}

export const identityRules = Object.freeze([

  Object.freeze({
    id:              'identity.duplicate-dsp-profiles',
    category:        'IDENTITY',
    title:           'Duplicate artist profiles detected',
    description:     'Multiple distribution profiles share the same provider identifier in reviewed sources.',
    severity:        'MEDIUM',
    confidence:      'HIGH',
    recommendation:  'Review and consolidate duplicate profiles to ensure consistent artist identity across reviewed sources.',
    providerSources: [],
    condition(cio) {
      const identity = safeIdentity(cio);
      if (!identity) return false;
      const profiles = Array.isArray(identity.externalProfiles) ? identity.externalProfiles : [];
      const counts = {};
      for (const p of profiles) {
        if (p && typeof p === 'object' && typeof p.provider === 'string' && p.provider !== '') {
          counts[p.provider] = (counts[p.provider] || 0) + 1;
        }
      }
      for (const k of Object.keys(counts)) {
        if (counts[k] > 1) return true;
      }
      return false;
    },
  }),

  Object.freeze({
    id:              'identity.confidence-unresolved',
    category:        'IDENTITY',
    title:           'Artist identity confidence unresolved',
    description:     'The artist identity confidence has not yet resolved from reviewed sources.',
    severity:        'LOW',
    confidence:      'MEDIUM',
    recommendation:  'Additional verification across reviewed sources is recommended to lift identity confidence.',
    providerSources: [],
    condition(cio) {
      const identity = safeIdentity(cio);
      if (!identity) return false;
      return identity.artistConfidence === 'UNKNOWN';
    },
  }),

]);
