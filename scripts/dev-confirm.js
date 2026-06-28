// Royaltē — Development account confirmation override
//
// Confirms an approved internal development account in Supabase without
// waiting for a verification email. Production artist accounts are never
// affected — this script refuses to operate on any non-allowlisted address.
//
// Usage:
//   node scripts/dev-confirm.js <email>
//
// What it does:
//   1. Verifies the email is on the approved internal allowlist.
//   2. Looks the account up in Supabase.
//   3. If unconfirmed — admin-confirms it immediately (no email required).
//   4. If already confirmed — reports status and exits cleanly.
//   5. If account does not exist — prints signup instructions and exits.
//
// Security contract:
//   - Allowlist is hard-coded here; it never reaches any public API route.
//   - Requires SUPABASE_SERVICE_ROLE_KEY (admin credential, server-only).
//   - Does not bypass authentication, ownership, RLS, or scan claiming.
//   - Only the email verification step is skipped.

import { readFileSync } from 'fs';
import { resolve }      from 'path';

// ── Approved development accounts ─────────────────────────────────────────────
// Only these addresses may be confirmed via this script.
// Add new internal accounts here only after Board approval.
const DEV_ALLOWLIST = new Set([
  'info@royalte.ai',
]);

// ── Load env ──────────────────────────────────────────────────────────────────
try {
  const env = readFileSync(resolve(process.cwd(), '.env.local'), 'utf8');
  for (const line of env.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const idx = t.indexOf('=');
    if (idx < 0) continue;
    const k = t.slice(0, idx).trim();
    const v = t.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
    if (!process.env[k]) process.env[k] = v;
  }
} catch (_) {}

const SUPABASE_URL = process.env.SUPABASE_URL;
const SVC_KEY      = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SVC_KEY) {
  console.error('Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required.');
  process.exit(1);
}

const headers = {
  apikey:         SVC_KEY,
  Authorization:  `Bearer ${SVC_KEY}`,
  'Content-Type': 'application/json',
};

async function run() {
  const email = (process.argv[2] || '').trim().toLowerCase();

  if (!email) {
    console.error('Usage: node scripts/dev-confirm.js <email>');
    process.exit(1);
  }

  // ── Guard: allowlist check ─────────────────────────────────────────────────
  if (!DEV_ALLOWLIST.has(email)) {
    console.error(`\n  REFUSED: ${email} is not on the approved development allowlist.`);
    console.error('  This script may only be used for internal development accounts.');
    console.error('  Production artist accounts must complete the standard email verification flow.\n');
    process.exit(1);
  }

  console.log(`\n  Royaltē dev-confirm: ${email}`);

  // ── Look up user ───────────────────────────────────────────────────────────
  const listRes  = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?per_page=50`, { headers });
  const listBody = await listRes.json();
  const users    = listBody?.users || [];
  const user     = users.find(u => u.email?.toLowerCase() === email);

  if (!user) {
    console.log(`\n  Account not found in Supabase.\n`);
    console.log('  To create it:');
    console.log('  1. Visit the live site and run any scan.');
    console.log('  2. At the Vault, submit the signup form with this email and a password.');
    console.log('  3. Re-run this script — the account will be confirmed immediately.\n');
    process.exit(0);
  }

  console.log(`  user_id:   ${user.id}`);
  console.log(`  created:   ${user.created_at.slice(0, 19)}Z`);

  if (user.email_confirmed_at) {
    console.log(`  status:    CONFIRMED (${user.email_confirmed_at.slice(0, 19)}Z)`);
    console.log(`  last login: ${user.last_sign_in_at ? user.last_sign_in_at.slice(0, 19) + 'Z' : 'never'}`);
    console.log('\n  Account is already confirmed. No action needed.');
    console.log('  Log in at the Vault with the registered password to begin QA.\n');
    process.exit(0);
  }

  // ── Confirm the account ────────────────────────────────────────────────────
  console.log('  status:    UNCONFIRMED — confirming now…');
  const patchRes  = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${user.id}`, {
    method:  'PUT',
    headers,
    body:    JSON.stringify({ email_confirm: true }),
  });
  const patchBody = await patchRes.json();

  if (!patchRes.ok) {
    console.error(`\n  Confirmation failed: HTTP ${patchRes.status}`);
    console.error(`  ${JSON.stringify(patchBody)}\n`);
    process.exit(1);
  }

  const confirmed = patchBody.email_confirmed_at;
  console.log(`  ✓ Confirmed at: ${confirmed ? confirmed.slice(0, 19) + 'Z' : '(set)'}`);
  console.log('\n  Account is now verified. QA workflow:');
  console.log('  1. Visit royalte.ai and run a scan.');
  console.log('  2. At the Vault, log in with the registered password (not signup).');
  console.log('  3. Vault unlocks → Mission Control opens with the scanned artist.\n');
}

run().catch(e => { console.error(e.message); process.exit(1); });
