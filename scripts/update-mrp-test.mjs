// Royaltē — Music Rights Profile™ Test Data Update
//
// Updates the music_rights_profile for a target account without overwriting
// any fields not explicitly listed in this script.
//
// Target: Black Alternative test account (Executive Board Reset Directive 2026-07-11)
// Changes:
//   performing_rights.pro          → 'SOCAN'
//   performing_rights.soundexchange → 'Yes'
//   publishing.publishing_admin    → 'TuneCore Publishing'
//   publishing.mlc                 → 'Registered'
//   recording.record_label         → 'Own Label'
//   recording.label_name           → 'Castle Park Studioz'
//   distribution.distributor       → 'TuneCore'
//
// Usage:
//   node scripts/update-mrp-test.mjs [email]
//   node scripts/update-mrp-test.mjs darryl.west@gmail.com

import { readFileSync } from 'fs';
import { resolve }      from 'path';
import { createClient } from '@supabase/supabase-js';

// ── Load env ──────────────────────────────────────────────────────────────────
try {
  const raw = readFileSync(resolve(process.cwd(), '.env.local'), 'utf8');
  for (const line of raw.split('\n')) {
    const t = line.trim(); if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('='); if (i < 0) continue;
    const k = t.slice(0, i).trim();
    const v = t.slice(i + 1).trim().replace(/^["']|["']$/g, '');
    if (!process.env[k]) process.env[k] = v;
  }
} catch (_) {}

const SUPABASE_URL = process.env.SUPABASE_URL;
const SVC_KEY      = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SVC_KEY) {
  console.error('ERROR: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SVC_KEY, { auth: { persistSession: false } });

// ── Target identification ─────────────────────────────────────────────────────
// Accepts an email from argv, defaults to the founder account.
const TARGET_EMAIL = process.argv[2] || 'darryl.west@gmail.com';
console.log(`\nTarget: ${TARGET_EMAIL}`);

// ── Profile patch values ──────────────────────────────────────────────────────
// These are the three fields being updated; all others are preserved.
const PATCH = {
  performing_rights: { pro: 'SOCAN', soundexchange: 'Yes' },
  publishing:        { publishing_admin: 'TuneCore Publishing', mlc: 'Registered' },
  recording:         { record_label: 'Own Label', label_name: 'Castle Park Studioz' },
  distribution:      { distributor: 'TuneCore' },
};

// ── Resolve user ──────────────────────────────────────────────────────────────
console.log('Resolving user…');
const { data: { users }, error: listErr } = await supabase.auth.admin.listUsers();
if (listErr) { console.error('ERROR listing users:', listErr.message); process.exit(1); }

const targetUser = users.find(u => u.email === TARGET_EMAIL);
if (!targetUser) {
  console.error(`ERROR: No user found with email "${TARGET_EMAIL}"`);
  console.log('\nAvailable emails:');
  users.slice(0, 10).forEach(u => console.log(' ', u.email));
  process.exit(1);
}
console.log(`Found user: uid=${targetUser.id}`);

// ── Read existing profile ─────────────────────────────────────────────────────
const { data: profileRow, error: readErr } = await supabase
  .from('profiles')
  .select('music_rights_profile, onboarding_completed_at')
  .eq('id', targetUser.id)
  .single();

if (readErr) {
  console.error('ERROR reading profile:', readErr.message);
  process.exit(1);
}

const existing = profileRow?.music_rights_profile || {};
const now = new Date().toISOString();

console.log('\nExisting music_rights_profile:');
console.log(JSON.stringify(existing, null, 2));

// ── Merge patch into existing ─────────────────────────────────────────────────
// Deep-merge each group: existing fields are preserved, PATCH fields overwrite.
const updated = {
  meta: {
    version:          '1.0',
    completed_at:     existing?.meta?.completed_at || now,
    last_updated_at:  now,
  },
  performing_rights: { ...(existing.performing_rights || {}), ...PATCH.performing_rights },
  publishing:        { ...(existing.publishing        || {}), ...PATCH.publishing },
  distribution:      { ...(existing.distribution      || {}), ...PATCH.distribution },
  recording:         { ...(existing.recording         || {}), ...PATCH.recording },
  songwriter:        { ...(existing.songwriter        || {}) },
};

console.log('\nUpdated music_rights_profile to write:');
console.log(JSON.stringify(updated, null, 2));

// ── Write ─────────────────────────────────────────────────────────────────────
const { error: writeErr } = await supabase
  .from('profiles')
  .update({
    music_rights_profile:     updated,
    onboarding_completed_at:  profileRow.onboarding_completed_at || now,
    updated_at:               now,
  })
  .eq('id', targetUser.id);

if (writeErr) {
  console.error('\nERROR writing profile:', writeErr.message);
  process.exit(1);
}

// ── Verify round-trip ─────────────────────────────────────────────────────────
const { data: verify, error: verifyErr } = await supabase
  .from('profiles')
  .select('music_rights_profile')
  .eq('id', targetUser.id)
  .single();

if (verifyErr) {
  console.error('\nERROR verifying write:', verifyErr.message);
  process.exit(1);
}

console.log('\n✓ Write verified. Stored profile:');
console.log(JSON.stringify(verify.music_rights_profile, null, 2));

// ── Spot-check the three target fields ───────────────────────────────────────
const p = verify.music_rights_profile;
const checks = [
  ['performing_rights.pro',           p?.performing_rights?.pro,          'SOCAN'],
  ['performing_rights.soundexchange', p?.performing_rights?.soundexchange, 'Yes'],
  ['publishing.publishing_admin',     p?.publishing?.publishing_admin,    'TuneCore Publishing'],
  ['publishing.mlc',                  p?.publishing?.mlc,                 'Registered'],
  ['recording.record_label',          p?.recording?.record_label,         'Own Label'],
  ['recording.label_name',            p?.recording?.label_name,           'Castle Park Studioz'],
  ['distribution.distributor',        p?.distribution?.distributor,       'TuneCore'],
];

console.log('\nField verification:');
let allPassed = true;
for (const [field, actual, expected] of checks) {
  const pass = actual === expected;
  if (!pass) allPassed = false;
  console.log(`  ${pass ? '✓' : '✗'} ${field}: ${JSON.stringify(actual)} ${pass ? '== expected' : `!= expected "${expected}"`}`);
}

console.log(allPassed ? '\n✓ All fields verified.' : '\n✗ Some fields did not match.');
process.exit(allPassed ? 0 : 1);
