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

// Read a provider observation off the new Phase 3B section
// `cio.observations.providers.<provider>`. Returns the entry object
// `{ availability, details }` or null. Never throws. Used by the
// provider-scoped ACTION REQUIRED rules below; the per-provider STATE
// resolution itself is owned by api/_lib/identity-intelligence.js.
function safeProviderObs(cio, provider) {
  if (!cio || typeof cio !== 'object' || Array.isArray(cio)) return null;
  const o = cio.observations;
  if (!o || typeof o !== 'object' || Array.isArray(o)) return null;
  const ps = o.providers;
  if (!ps || typeof ps !== 'object' || Array.isArray(ps)) return null;
  const entry = ps[provider];
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return null;
  return entry;
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

  // ─── Phase 3B provider-scoped ACTION REQUIRED rules ──────────────
  //
  // Per Board D4 (2026-06-17), each VERIFIED provider may surface
  // narrowly-scoped ACTION REQUIRED conditions. Rule IDs are
  // provider-scoped (`identity.<provider>.<signal>`) so the Identity
  // Intelligence™ assembler can group observations by provider via
  // prefix match without category branching in the engine. Titles
  // remain provider-neutral per Phase 5 lock + rule-library-test #28.
  //
  // Spotify intentionally has NO ACTION REQUIRED rules in Phase 3
  // (Board D4: "Do NOT invent Action Required conditions until
  // richer Spotify observations exist.").

  Object.freeze({
    id:              'identity.apple.artwork-missing',
    category:        'IDENTITY',
    title:           'Canonical identity profile is missing artwork',
    description:     'A verified canonical identity profile was returned without an artwork URL in reviewed sources.',
    severity:        'MEDIUM',
    confidence:      'HIGH',
    recommendation:  'Upload a high-resolution artist image to the canonical identity provider to complete the public profile.',
    providerSources: [],
    condition(cio) {
      const obs = safeProviderObs(cio, 'apple');
      if (!obs || obs.availability !== 'VERIFIED') return false;
      const identity = safeIdentity(cio);
      if (!identity) return false;
      return identity.artwork === null || identity.artwork === '';
    },
  }),

  Object.freeze({
    id:              'identity.youtube.no-official-channel',
    category:        'IDENTITY',
    title:           'Verified channel is not registered as an Official Artist Channel',
    description:     'A verified video-platform presence was found but the channel is not flagged as an Official Artist Channel in reviewed sources.',
    severity:        'MEDIUM',
    confidence:      'MEDIUM',
    recommendation:  'Claim the Official Artist Channel status with the video platform to consolidate analytics and royalty attribution.',
    providerSources: [],
    condition(cio) {
      const obs = safeProviderObs(cio, 'youtube');
      if (!obs || obs.availability !== 'VERIFIED') return false;
      if (!obs.details || typeof obs.details !== 'object') return false;
      return obs.details.officialChannel === null
          || obs.details.officialChannel === undefined;
    },
  }),

  Object.freeze({
    id:              'identity.youtube.content-id-unverified',
    category:        'IDENTITY',
    title:           'Content identification verification not confirmed',
    description:     'A verified video-platform presence with an Official Artist Channel was found but Content ID verification was not confirmed in reviewed sources.',
    severity:        'MEDIUM',
    confidence:      'MEDIUM',
    recommendation:  'Verify Content ID coverage with the video platform to protect user-generated content royalty attribution.',
    providerSources: [],
    condition(cio) {
      const obs = safeProviderObs(cio, 'youtube');
      if (!obs || obs.availability !== 'VERIFIED') return false;
      if (!obs.details || typeof obs.details !== 'object') return false;
      // Distinct from no-official-channel: only fires when a channel
      // DOES exist but Content ID flag is explicitly false.
      if (obs.details.officialChannel === null
       || obs.details.officialChannel === undefined) return false;
      return obs.details.contentIdVerified === false;
    },
  }),

]);
