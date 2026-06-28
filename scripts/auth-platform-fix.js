// Royaltē — Auth platform fix & SMTP diagnostic
//
// READ operations + one targeted write (resend/generate confirmation for a specific account).
// Does NOT modify authentication settings or SMTP configuration (requires Supabase dashboard).
//
// Usage:
//   node scripts/auth-platform-fix.js
//
// What it does:
//   1. Lists all unconfirmed accounts.
//   2. Generates an admin sign-in link for info@royalte.ai (bypasses email delivery).
//   3. Reports SMTP configuration status.
//   4. Provides Resend SMTP configuration instructions.

import { readFileSync } from 'fs';
import { resolve } from 'path';

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  try {
    const env = readFileSync(resolve(process.cwd(), '.env.local'), 'utf8');
    for (const line of env.split('\n')) {
      const t = line.trim();
      if (!t || t.startsWith('#')) continue;
      const idx = t.indexOf('=');
      if (idx === -1) continue;
      const k = t.slice(0, idx).trim();
      const v = t.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
      if (!process.env[k]) process.env[k] = v;
    }
  } catch (_) {}
}

const url = process.env.SUPABASE_URL;
const svcKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const resendKey = process.env.RESEND_API_KEY || process.env.RESEND_KEY;

if (!url || !svcKey) {
  console.error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required'); process.exit(1);
}

const headers = {
  apikey:         svcKey,
  Authorization:  `Bearer ${svcKey}`,
  'Content-Type': 'application/json',
};

async function fetchJson(path, opts = {}) {
  const res = await fetch(`${url}${path}`, { headers, ...opts });
  const body = await res.text();
  try { return { ok: res.ok, status: res.status, data: JSON.parse(body) }; }
  catch { return { ok: res.ok, status: res.status, data: body }; }
}

async function run() {
  console.log('\n══════════════════════════════════════════════════════════════');
  console.log('  Royaltē — Auth Platform Fix');
  console.log('══════════════════════════════════════════════════════════════\n');

  // ── 1. Unconfirmed accounts ──────────────────────────────────────────
  console.log('── 1. Unconfirmed accounts ──────────────────────────────────────');
  const { data: usersResp } = await fetchJson('/auth/v1/admin/users?per_page=50');
  const users = usersResp?.users || [];
  const unconfirmed = users.filter(u => !u.email_confirmed_at);

  if (unconfirmed.length === 0) {
    console.log('  All accounts are confirmed.\n');
  } else {
    console.log(`  ${unconfirmed.length} unconfirmed account(s):\n`);
    for (const u of unconfirmed) {
      console.log(`  email:      ${u.email}`);
      console.log(`  user_id:    ${u.id}`);
      console.log(`  created_at: ${u.created_at}`);
      console.log('');
    }
  }

  // ── 2. Generate admin sign-in link for info@royalte.ai ───────────────
  // This bypasses email delivery and gives the Board a direct activation URL.
  // The link expires in 1 hour and is single-use.
  const targetEmail = 'info@royalte.ai';
  const targetUser  = users.find(u => u.email === targetEmail);

  console.log(`── 2. Admin activation link for ${targetEmail} ─────────────`);

  if (!targetUser) {
    console.log(`  Account not found. If the signup failed, create a fresh account:\n`);
    console.log(`  → Run a scan on royalte.ai → use the Vault form to create ${targetEmail}`);
    console.log(`  → Then re-run this script to generate an activation link.\n`);
  } else {
    console.log(`  Account found (id: ${targetUser.id})`);
    console.log(`  Status: ${targetUser.email_confirmed_at ? 'confirmed' : 'UNCONFIRMED — will generate activation link'}\n`);

    if (!targetUser.email_confirmed_at) {
      // Generate a magiclink/signup link via admin API
      const linkResult = await fetchJson('/auth/v1/admin/generate_link', {
        method: 'POST',
        body: JSON.stringify({
          type:  'magiclink',
          email: targetEmail,
          options: {
            redirectTo: `${url.replace('https://dhfndrrfekwuxzgjblci.supabase.co', 'https://www.royalte.ai')}/auth/callback`,
          },
        }),
      });

      if (linkResult.ok && linkResult.data?.properties?.action_link) {
        console.log('  ✓ Activation link generated (valid 1 hour, single-use):');
        console.log(`\n  ${linkResult.data.properties.action_link}\n`);
        console.log('  → Open this URL in the browser to confirm the account without email.');
        console.log('  → This IS the email confirmation click — it triggers /auth/callback.\n');
      } else if (linkResult.ok && linkResult.data?.action_link) {
        console.log('  ✓ Activation link:');
        console.log(`\n  ${linkResult.data.action_link}\n`);
      } else {
        console.log(`  ✗ generate_link failed: ${JSON.stringify(linkResult.data)}`);
        // Fallback: try resend endpoint
        console.log('\n  Trying resend endpoint…');
        const resendResult = await fetchJson('/auth/v1/resend', {
          method: 'POST',
          body: JSON.stringify({ type: 'signup', email: targetEmail }),
        });
        if (resendResult.ok) {
          console.log('  ✓ Resend confirmation email triggered (check inbox).');
        } else {
          console.log(`  ✗ Resend also failed: ${JSON.stringify(resendResult.data)}`);
          console.log('\n  Manual option: Supabase dashboard → Authentication → Users → confirm manually.');
        }
      }
    }
  }

  // ── 3. Email/SMTP status ─────────────────────────────────────────────
  console.log('── 3. Email / SMTP status ───────────────────────────────────────');
  const settingsResult = await fetchJson('/auth/v1/settings', {
    headers: { ...headers },
  });
  console.log(`  mailer_autoconfirm: ${settingsResult.data?.mailer_autoconfirm}`);
  console.log(`  → Email confirmation: ${settingsResult.data?.mailer_autoconfirm === false ? 'ENABLED (required)' : 'disabled'}`);

  const hasResendKey = Boolean(resendKey);
  const projectRef   = new URL(url).hostname.split('.')[0];

  console.log(`\n  Custom SMTP: ${hasResendKey ? 'Resend API key found in env — ready to configure' : 'NOT CONFIGURED (using Supabase built-in SMTP)'}`);
  if (!hasResendKey) {
    console.log(`  Supabase built-in SMTP limit: 3 emails/hour (free tier)`);
    console.log(`  → This is the cause of undelivered confirmation emails.`);
  }

  // ── 4. Resend SMTP configuration instructions ────────────────────────
  console.log('\n── 4. SMTP configuration (Resend) ───────────────────────────────');
  console.log(`
  Resend already handles Royaltē audit emails. Use it for Supabase auth emails too.

  STEP 1 — Get Resend SMTP credentials:
    → resend.com dashboard → API Keys → Create key (name: "Supabase auth emails")
    → Resend SMTP does NOT use the API key directly. Set up via:
    → resend.com dashboard → Domains → Add domain → verify ${url.replace('https://', '').split('.')[0].includes('supabase') ? 'royalte.ai' : 'your domain'}
    → Once domain verified: resend.com dashboard → SMTP → note the settings below

  STEP 2 — Configure in Supabase dashboard:
    → supabase.com/dashboard → project ${projectRef} → Authentication → Settings → SMTP
    → Enable custom SMTP
    → SMTP host:      smtp.resend.com
    → SMTP port:      465
    → SMTP user:      resend
    → SMTP password:  <your Resend API key>
    → Sender email:   noreply@royalte.ai  (must match verified Resend domain)
    → Sender name:    Royaltē

  STEP 3 — Test:
    → Save settings → Supabase sends a test email
    → Then resend the confirmation to ${targetEmail}

  CURRENT WORKAROUND (immediate):
    → Use the activation link generated in Step 2 above (if generated successfully)
    → This confirms the account without requiring email delivery
    → Allows end-to-end testing of the Vault flow immediately
`);

  console.log('══════════════════════════════════════════════════════════════\n');
}

run().catch(e => { console.error(e.message); process.exit(1); });
