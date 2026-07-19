// Music Rights Profile™ — shared field definitions and save logic.
//
// Single source of truth for Music Rights Profile data, used by both
// public/onboarding.html (first-time capture, 3-question wizard) and
// public/workspaces/settings.html (permanent, always-editable home).
//
// Constitutional note: api/save-music-rights-profile.js persists
// `profile.music_rights_profile` as a full-column overwrite (update(), not a
// deep merge) — see its own comments. Any caller that saves a subset of
// fields (e.g. one Settings section) MUST merge that subset into the
// complete current profile locally before calling saveMusicRightsProfile(),
// or it will silently erase every other previously-saved field. Both
// call sites in this codebase follow that rule; do not add a new one that
// doesn't. mergeProfileFragment() below exists specifically to make that
// safe and consistent.

// ── Onboarding's 3 required questions — unchanged from the original
//    onboarding.html SECTIONS array. Do not add new options/fields here
//    without also checking public/onboarding.html's wizard copy, since this
//    exact set is what the first-time gate asks. ─────────────────────────
export const ONBOARDING_SECTIONS = [
  {
    key: 'pro',
    group: 'performing_rights',
    field: 'pro',
    eyebrow: 'Performing Rights',
    question: 'Who is your Performance Rights Organization (PRO)?',
    hint: 'A Performing Rights Organization collects royalties when your music is played publicly — on radio, TV, live venues, and streaming.',
    options: [
      { value: 'SOCAN',  label: 'SOCAN',          badge: 'Canada' },
      { value: 'ASCAP',  label: 'ASCAP',          badge: 'US' },
      { value: 'BMI',    label: 'BMI',             badge: 'US' },
      { value: 'SESAC',  label: 'SESAC',           badge: 'US' },
      { value: 'PRS',    label: 'PRS for Music',   badge: 'UK' },
      { value: 'APRA',   label: 'APRA AMCOS',      badge: 'AU/NZ' },
      { value: 'Other',  label: 'Other' },
    ],
  },
  {
    key: 'publishing_management',
    group: 'publishing',
    field: 'publishing_management',
    eyebrow: 'Publishing',
    question: 'Who manages your publishing?',
    hint: 'Tell us how your publishing is managed so Royaltē can identify the right royalty collection paths for your music.',
    options: [
      { value: 'self',      label: 'I manage my own publishing' },
      { value: 'admin',     label: 'Publishing Administrator' },
      { value: 'publisher', label: 'Publisher' },
    ],
    conditionalTriggers: ['admin', 'publisher'],
    conditionalKey: 'organization_name',
    conditionalGroup: 'publishing',
    conditionalPlaceholder: 'Organization Name',
  },
  {
    key: 'mlc',
    group: 'publishing',
    field: 'mlc_registered',
    boolField: true, // stored as boolean ('Yes' -> true / 'No' -> false)
    eyebrow: 'MLC Registration',
    question: 'Are your works registered with The MLC?',
    hint: 'The Mechanical Licensing Collective (MLC) collects and distributes mechanical royalties from digital music services in the US.',
    options: [
      { value: 'Yes', label: 'Yes' },
      { value: 'No',  label: 'No' },
    ],
  },
];

// ── Settings-only expansion — permanent, always-editable fields beyond the
//    3-question onboarding minimum. Presented as independently-editable
//    groups in Settings → Music Rights Profile, never shown in onboarding's
//    wizard. Each writes into its own top-level key on the profile object,
//    additive alongside performing_rights/publishing — nothing here renames
//    or restructures the onboarding-owned fields above. ───────────────────
export const SETTINGS_GROUPS = [
  {
    id: 'pro_membership',
    title: 'PRO Membership Status',
    group: 'performing_rights',
    field: 'membership_status',
    hint: 'Your current standing with your Performing Rights Organization.',
    options: [
      { value: 'active',  label: 'Active' },
      { value: 'pending',  label: 'Pending' },
      { value: 'inactive', label: 'Inactive' },
    ],
  },
  {
    id: 'mechanical_rights',
    title: 'Mechanical Rights',
    group: 'mechanical_rights',
    field: 'organization',
    hint: 'The organization that collects your mechanical royalties, if different from The MLC.',
    options: [
      { value: 'mlc',    label: 'The MLC' },
      { value: 'cmrra',  label: 'CMRRA' },
      { value: 'hfa',    label: 'Harry Fox' },
      { value: 'other',  label: 'Other' },
    ],
    conditionalTriggers: ['other'],
    conditionalKey: 'organization_other',
    conditionalGroup: 'mechanical_rights',
    conditionalPlaceholder: 'Organization Name',
  },
  {
    id: 'record_label',
    title: 'Record Label',
    group: 'record_label',
    field: 'status',
    hint: 'Whether your releases are independent or signed to a label.',
    options: [
      { value: 'independent', label: 'Independent' },
      { value: 'signed',      label: 'Signed' },
    ],
    conditionalTriggers: ['signed'],
    conditionalKey: 'label_name',
    conditionalGroup: 'record_label',
    conditionalPlaceholder: 'Label Name',
  },
  {
    id: 'distribution',
    title: 'Distribution',
    group: 'distribution',
    field: 'distributor',
    hint: 'Your primary distributor and the territories you distribute to.',
    freeText: true,
    placeholder: 'Distributor (e.g. DistroKid, TuneCore, AWAL)',
    secondaryField: 'territories',
    secondaryPlaceholder: 'Territories (e.g. Worldwide, or a list of countries)',
  },
  {
    id: 'master_rights',
    title: 'Master Rights',
    group: 'master_rights',
    field: 'ownership',
    hint: 'Who owns the master recordings for your catalog.',
    options: [
      { value: 'own',    label: 'I own my masters' },
      { value: 'label',  label: 'Label owns my masters' },
      { value: 'shared', label: 'Shared ownership' },
    ],
  },
  {
    id: 'neighboring_rights',
    title: 'Neighboring Rights',
    group: 'neighboring_rights',
    field: 'organization',
    hint: 'The organization that collects your neighboring rights royalties (performer/master-owner royalties from broadcast and public performance).',
    options: [
      { value: 'soundexchange', label: 'SoundExchange' },
      { value: 'resound',       label: 'Re:Sound' },
      { value: 'ppl',           label: 'PPL' },
      { value: 'other',         label: 'Other' },
    ],
    conditionalTriggers: ['other'],
    conditionalKey: 'organization_other',
    conditionalGroup: 'neighboring_rights',
    conditionalPlaceholder: 'Organization Name',
  },
  {
    id: 'sync_representation',
    title: 'Sync Representation',
    group: 'sync_representation',
    field: 'representative',
    hint: 'Who represents your catalog for sync licensing (film, TV, advertising, games).',
    options: [
      { value: 'self',      label: 'I represent myself' },
      { value: 'publisher', label: 'My Publisher' },
      { value: 'label',     label: 'My Label' },
      { value: 'agent',     label: 'A dedicated Sync Agent' },
    ],
  },
];

export function esc(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Maps the 3 onboarding answers into the canonical grouped profile
// structure. Unchanged in shape from the original onboarding.html.
export function buildOnboardingProfile(answers) {
  return {
    performing_rights: {
      pro: answers.pro || null,
    },
    publishing: {
      publishing_management: answers.publishing_management || null,
      organization_name:     answers.organization_name     || null,
      mlc_registered:        answers.mlc === 'Yes',
    },
  };
}

// Safely merges a single-group change into a full profile object, never
// dropping other groups. `currentProfile` should be the full, currently-saved
// music_rights_profile (fetched fresh on page load — see settings.html).
export function mergeProfileFragment(currentProfile, group, fields) {
  const base = currentProfile && typeof currentProfile === 'object' ? currentProfile : {};
  return {
    ...base,
    [group]: {
      ...(base[group] && typeof base[group] === 'object' ? base[group] : {}),
      ...fields,
    },
  };
}

// Shared save call. `fullProfile` must be the complete, merged profile object
// (see mergeProfileFragment) — this function does not merge on your behalf,
// because the caller is the one with the up-to-date in-memory copy.
export async function saveMusicRightsProfile(fullProfile, accessToken) {
  const headers = { 'Content-Type': 'application/json' };
  if (accessToken) headers['Authorization'] = 'Bearer ' + accessToken;
  const res = await fetch('/api/save-music-rights-profile', {
    method:  'POST',
    headers,
    body:    JSON.stringify({ profile: fullProfile }),
  });
  if (!res.ok) {
    let detail = '';
    try { detail = (await res.json())?.error || ''; } catch (_) {}
    throw new Error('Save failed' + (detail ? ': ' + detail : '') + ' (' + res.status + ')');
  }
  return true;
}
