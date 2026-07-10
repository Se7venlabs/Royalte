// Royaltē — Supabase auth configuration diagnostic (extended)
//
// READ-ONLY. Fetches individual user records and raw auth settings.

import { readFileSync } from 'fs';
import { resolve } from 'path';

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  try {
    const envContent = readFileSync(resolve(process.cwd(), '.env.local'), 'utf8');
    for (const line of envContent.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
      if (!process.env[key]) process.env[key] = val;
    }
  } catch (_) { /* no .env.local */ }
}

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error('ERROR: env vars missing'); process.exit(1);
}

const adminHeaders = {
  apikey:         serviceKey,
  Authorization:  `Bearer ${serviceKey}`,
  'Content-Type': 'application/json',
};

async function fetchJson(endpoint, headers) {
  const res = await fetch(endpoint, { headers });
  const body = await res.text();
  if (!res.ok) return { __httpStatus: res.status, __body: body };
  try { return JSON.parse(body); } catch { return { __raw: body }; }
}

async function run() {
  // Try alternate admin config endpoint paths
  for (const path of [
    '/auth/v1/admin/config',
    '/auth/admin/config',
    '/auth/v1/settings',
  ]) {
    const r = await fetchJson(`${url}${path}`, adminHeaders);
    if (!r.__httpStatus) {
      console.log(`\n[${path}]`);
      const relevant = {
        mailer_autoconfirm:              r.mailer_autoconfirm,
        smtp_admin_email:                r.smtp_admin_email,
        smtp_host:                       r.smtp_host,
        smtp_port:                       r.smtp_port,
        smtp_user:                       r.smtp_user ? '(set)' : undefined,
        mailer_secure_email_change:      r.mailer_secure_email_change_enabled,
        external_email_enabled:          r.external?.email?.enabled,
      };
      for (const [k, v] of Object.entries(relevant)) {
        if (v !== undefined) console.log(`  ${k}: ${v}`);
      }
    } else {
      console.log(`[${path}] HTTP ${r.__httpStatus}`);
    }
  }

  // Fetch all users with full details
  console.log('\n── All users with full auth timestamps ──');
  const usersResp = await fetchJson(
    `${url}/auth/v1/admin/users?per_page=50&page=1`,
    adminHeaders,
  );
  if (usersResp.__httpStatus) {
    console.log(`  Error: ${usersResp.__httpStatus}`);
  } else {
    const users = (usersResp.users || []).sort(
      (a, b) => new Date(b.created_at) - new Date(a.created_at),
    );
    for (const u of users) {
      console.log(`\n  email: ${u.email}`);
      console.log(`  created_at:         ${u.created_at}`);
      console.log(`  email_confirmed_at: ${u.email_confirmed_at || 'NULL'}`);
      console.log(`  last_sign_in_at:    ${u.last_sign_in_at || 'never'}`);
      console.log(`  confirmed_at:       ${u.confirmed_at || 'NULL'}`);
      console.log(`  banned_until:       ${u.banned_until || 'n/a'}`);
      // Check identities
      if (u.identities && u.identities.length > 0) {
        const ids = u.identities.map(i => `${i.provider}(${i.identity_data?.email || i.id.slice(0,8)})`).join(', ');
        console.log(`  identities:         ${ids}`);
      }
    }
  }

  // Also try the Supabase REST schema endpoint to detect any auth-adjacent tables
  console.log('\n── Check auth.users directly via service-role REST ──');
  const restResp = await fetchJson(
    `${url}/rest/v1/rpc/verify_auth_config`,
    adminHeaders,
  );
  console.log(`  rpc/verify_auth_config: ${restResp.__httpStatus ? `HTTP ${restResp.__httpStatus}` : JSON.stringify(restResp)}`);
}

run().catch(e => { console.error(e.message); process.exit(1); });
