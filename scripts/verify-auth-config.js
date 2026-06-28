// Royaltē — Supabase auth configuration diagnostic
//
// READ-ONLY. Does not create users, modify settings, or write any data.
//
// Usage:
//   node scripts/verify-auth-config.js
//   (reads SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from env or .env.local)

import { readFileSync } from 'fs';
import { resolve } from 'path';

// Load .env.local if env vars are not already present
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  try {
    const envPath = resolve(process.cwd(), '.env.local');
    const envContent = readFileSync(envPath, 'utf8');
    for (const line of envContent.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
      if (!process.env[key]) process.env[key] = val;
    }
  } catch (e) {
    // .env.local not found — continue with existing env
  }
}

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error('ERROR: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.');
  process.exit(1);
}

const projectRef = new URL(url).hostname.split('.')[0];

async function fetchJson(endpoint, headers) {
  const res = await fetch(endpoint, { headers });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    return { __httpStatus: res.status, __error: body };
  }
  return res.json();
}

async function run() {
  console.log('\n══════════════════════════════════════════════════');
  console.log('  Royaltē — Supabase Auth Configuration Diagnostic');
  console.log('══════════════════════════════════════════════════\n');
  console.log(`Project ref: ${projectRef}`);
  console.log(`API base:    ${url}\n`);

  const adminHeaders = {
    apikey:        serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    'Content-Type': 'application/json',
  };

  // ── 1. Auth admin config ──────────────────────────────────────────────
  // Returns mailer_autoconfirm (true = email confirm DISABLED),
  // SMTP settings, and JWT settings.
  console.log('── 1. Auth admin config (/auth/v1/admin/config) ─────────────────');
  const config = await fetchJson(`${url}/auth/v1/admin/config`, adminHeaders);

  if (config.__httpStatus) {
    console.log(`  HTTP ${config.__httpStatus}: ${config.__error}`);
    console.log('  (service-role key may not have access to admin config endpoint)\n');
  } else {
    const emailConfirmDisabled = config.mailer_autoconfirm === true;
    console.log(`  mailer_autoconfirm:      ${config.mailer_autoconfirm}  ← email confirm is ${emailConfirmDisabled ? 'DISABLED (accounts activate immediately)' : 'ENABLED (confirmation email required)'}`);
    console.log(`  mailer_secure_email_change_enabled: ${config.mailer_secure_email_change_enabled ?? 'n/a'}`);
    console.log(`  smtp_admin_email:        ${config.smtp_admin_email || '(not set)'}`);
    console.log(`  smtp_host:               ${config.smtp_host || '(not set — using Supabase built-in SMTP)'}`);
    console.log(`  smtp_port:               ${config.smtp_port || 'n/a'}`);
    console.log(`  smtp_sender_name:        ${config.smtp_sender_name || '(not set)'}`);
    console.log(`  smtp_user:               ${config.smtp_user ? '(set)' : '(not set)'}`);
    console.log(`  smtp_pass:               ${config.smtp_pass ? '(set, hidden)' : '(not set)'}`);
    const emailProvider = config.smtp_host
      ? `Custom SMTP (${config.smtp_host})`
      : 'Supabase built-in SMTP (free tier: 3 emails/hour limit)';
    console.log(`\n  Email provider:          ${emailProvider}`);
    console.log(`\n  ▶ VERDICT: Email confirmation is ${emailConfirmDisabled ? 'DISABLED' : 'ENABLED'}`);
    if (emailConfirmDisabled) {
      console.log('    signUp() returns a valid session immediately.');
      console.log('    No confirmation email is sent.');
      console.log('    Accounts activate on signup.');
    } else {
      console.log('    signUp() returns session: null.');
      console.log('    A confirmation email must be clicked before the account is active.');
      if (!config.smtp_host) {
        console.log('    WARNING: No custom SMTP configured. Using Supabase built-in SMTP.');
        console.log('    Free tier limit: 3 confirmation emails/hour. Production projects need custom SMTP.');
      }
    }
    console.log('');
  }

  // ── 2. Recent auth logs (last 10 auth events via admin users list) ────
  console.log('── 2. Recent user accounts (/auth/v1/admin/users) ───────────────');
  const usersResp = await fetchJson(
    `${url}/auth/v1/admin/users?per_page=10&page=1`,
    adminHeaders,
  );
  if (usersResp.__httpStatus) {
    console.log(`  HTTP ${usersResp.__httpStatus}: ${usersResp.__error}\n`);
  } else {
    const users = usersResp.users || [];
    console.log(`  Total users (page 1, up to 10): ${users.length}`);
    for (const u of users) {
      const confirmed = u.email_confirmed_at ? `confirmed ${u.email_confirmed_at.slice(0,10)}` : 'NOT confirmed';
      console.log(`  ${u.email || u.phone || '(no email)'} — ${confirmed} — created ${(u.created_at || '').slice(0,10)}`);
    }
    const testEmail = 'darryl.ewst@gmail.com';
    const testUser = users.find(u => u.email === testEmail);
    if (testUser) {
      console.log(`\n  ▶ Test account (${testEmail}):`);
      console.log(`    created_at:          ${testUser.created_at}`);
      console.log(`    email_confirmed_at:  ${testUser.email_confirmed_at || 'NULL — not confirmed'}`);
      console.log(`    last_sign_in_at:     ${testUser.last_sign_in_at || 'never'}`);
      console.log(`    confirmed:           ${testUser.email_confirmed_at ? 'YES' : 'NO'}`);
    } else {
      console.log(`\n  Note: ${testEmail} not found in first 10 users.`);
    }
    console.log('');
  }

  // ── 3. Public auth settings (no key required) ─────────────────────────
  console.log('── 3. Public auth settings (/auth/v1/settings) ──────────────────');
  const pubSettings = await fetchJson(`${url}/auth/v1/settings`, {
    apikey: process.env.SUPABASE_ANON_KEY || serviceKey,
  });
  if (pubSettings.__httpStatus) {
    console.log(`  HTTP ${pubSettings.__httpStatus}: ${pubSettings.__error}\n`);
  } else {
    const activeProviders = Object.entries(pubSettings)
      .filter(([, v]) => v === true || (typeof v === 'object' && v?.enabled))
      .map(([k]) => k);
    console.log(`  Active settings/providers: ${activeProviders.join(', ') || '(none detected)'}`);
    console.log(`  Password signup enabled:   ${pubSettings.password_min_length !== undefined ? `yes (min length ${pubSettings.password_min_length})` : 'unknown'}`);
    console.log('');
  }

  console.log('══════════════════════════════════════════════════');
  console.log('  Diagnostic complete.');
  console.log('══════════════════════════════════════════════════\n');
}

run().catch(err => {
  console.error('Diagnostic failed:', err.message);
  process.exit(1);
});
