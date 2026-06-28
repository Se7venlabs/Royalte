// Royaltē — Production authentication pipeline test
//
// Calls the live Supabase Auth endpoint exactly as the Vault form does.
// Uses a disposable email address so delivery can be independently checked.
// Does NOT use local SMTP scripts or mocks.

import { readFileSync } from 'fs';
import { resolve }      from 'path';

// Load env
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

const SUPABASE_URL  = process.env.SUPABASE_URL;
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRoZm5kcnJmZWt3dXh6Z2pibGNpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY1MzM4NTMsImV4cCI6MjA5MjEwOTg1M30.7WjaiC4JvoLEghRQzSqo0VogZ6GBzgd_ipPhFf2Ida4';
const SVC_KEY       = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Unique disposable address — mailinator public inbox, no auth needed to read
const TIMESTAMP     = Date.now();
const TEST_EMAIL    = `royalte-authtest-${TIMESTAMP}@mailinator.com`;
const TEST_PASSWORD = 'RoyalteTest2026!';

const anonHeaders = {
  apikey:         SUPABASE_ANON,
  Authorization:  `Bearer ${SUPABASE_ANON}`,
  'Content-Type': 'application/json',
};
const svcHeaders = {
  apikey:         SVC_KEY,
  Authorization:  `Bearer ${SVC_KEY}`,
  'Content-Type': 'application/json',
};

// DNS TXT lookup via Google DNS-over-HTTPS
async function dnsText(name) {
  try {
    const res  = await fetch(`https://dns.google/resolve?name=${encodeURIComponent(name)}&type=TXT`);
    const data = await res.json();
    return (data.Answer || []).filter(r => r.type === 16).map(r => r.data.replace(/"/g, ''));
  } catch { return []; }
}

async function run() {
  console.log('\n══════════════════════════════════════════════════════════════════');
  console.log('  Royaltē — Production Auth Pipeline Test');
  console.log('══════════════════════════════════════════════════════════════════');
  console.log(`  Test email: ${TEST_EMAIL}`);
  console.log(`  Endpoint:   ${SUPABASE_URL}/auth/v1/signup\n`);

  // ── 1. Fire the production signup ─────────────────────────────────────────
  // This is identical to what sb.auth.signUp() does in the Vault form.
  console.log('── 1. Production signup (POST /auth/v1/signup) ──────────────────');
  const t0 = Date.now();
  const signupRes = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
    method:  'POST',
    headers: anonHeaders,
    body:    JSON.stringify({ email: TEST_EMAIL, password: TEST_PASSWORD }),
  });
  const signupMs   = Date.now() - t0;
  const signupBody = await signupRes.json();

  console.log(`  HTTP status:  ${signupRes.status} (${signupMs}ms)`);

  if (!signupRes.ok) {
    console.log(`  ✗ SIGNUP FAILED`);
    console.log(`  Error code:   ${signupBody.error_code || signupBody.code || '(none)'}`);
    console.log(`  Message:      ${signupBody.message || signupBody.error || JSON.stringify(signupBody)}`);
    console.log('');
    console.log('  ▶ FINDING: Supabase rejected the signup request.');
    console.log('    If message contains "SMTP" or "email" → SMTP credentials are wrong.');
    console.log('    If message contains "rate limit" → Supabase free-tier SMTP rate hit.');
    console.log('');
  } else {
    const user    = signupBody.user || signupBody;
    const session = signupBody.session;
    console.log(`  ✓ Signup accepted`);
    console.log(`  user_id:      ${user.id || '(none)'}`);
    console.log(`  email:        ${user.email || '(none)'}`);
    console.log(`  confirmed:    ${user.email_confirmed_at || 'NOT YET — waiting for email click'}`);
    console.log(`  session:      ${session ? 'PRESENT (email confirm DISABLED)' : 'null (email confirm REQUIRED — email sent)'}`);
    console.log('');

    if (!session) {
      console.log('  ▶ Supabase accepted the user AND triggered an email send.');
      console.log('    If the email does not arrive, the failure is between Supabase and Resend.');
    } else {
      console.log('  ▶ Session returned immediately — email confirmation is DISABLED.');
      console.log('    No email will be sent.');
    }
  }

  // ── 2. Confirm user appears in admin list ─────────────────────────────────
  console.log('── 2. Supabase admin users (post-signup check) ──────────────────');
  await new Promise(r => setTimeout(r, 1500)); // give Supabase a moment
  const usersRes  = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?per_page=50`, { headers: svcHeaders });
  const usersBody = await usersRes.json();
  const users     = (usersBody?.users || []).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  const testUser  = users.find(u => u.email === TEST_EMAIL);

  if (testUser) {
    console.log(`  ✓ User created in Supabase:`);
    console.log(`    id:                  ${testUser.id}`);
    console.log(`    email_confirmed_at:  ${testUser.email_confirmed_at || 'NULL — unconfirmed'}`);
    console.log(`    created_at:          ${testUser.created_at}`);
    console.log('');
    if (!testUser.email_confirmed_at) {
      console.log('  ▶ Account exists and is UNCONFIRMED.');
      console.log('    Supabase generated the verification email and attempted delivery.');
      console.log('    The question is whether Resend received it.');
    }
  } else {
    console.log(`  ✗ User NOT found in Supabase after signup.`);
    console.log(`    Signup returned ${signupRes.status} but the account does not exist.`);
    console.log(`    This means Supabase rolled back account creation — likely an SMTP send failure.`);
  }
  console.log('');

  // ── 3. Check Mailinator for the verification email ────────────────────────
  console.log('── 3. Mailinator inbox check ────────────────────────────────────');
  console.log(`  Inbox: ${TEST_EMAIL}`);
  console.log('  Waiting 15 seconds for potential email delivery…');
  await new Promise(r => setTimeout(r, 15000));

  const inboxName = TEST_EMAIL.split('@')[0];
  try {
    const inboxRes  = await fetch(`https://www.mailinator.com/api/v2/domains/mailinator.com/inboxes/${inboxName}`, {
      headers: { Accept: 'application/json' },
    });
    if (inboxRes.ok) {
      const inbox = await inboxRes.json();
      const msgs  = inbox?.msgs || [];
      if (msgs.length === 0) {
        console.log('  ✗ NO email received in Mailinator after 15 seconds.');
        console.log('    Either delivery is delayed, or Resend never received the message.');
      } else {
        console.log(`  ✓ ${msgs.length} email(s) received:`);
        for (const m of msgs) {
          console.log(`    From:    ${m.from}`);
          console.log(`    Subject: ${m.subject}`);
          console.log(`    Time:    ${new Date(m.time).toISOString()}`);
        }
      }
    } else {
      // Try alternative Mailinator endpoint
      const alt = await fetch(`https://www.mailinator.com/v4/public/inboxes.jsp?to=${inboxName}&domain=mailinator.com`);
      if (alt.ok) {
        const text = await alt.text();
        const hasEmail = text.includes('from') && text.includes('subject');
        console.log(`  Mailinator public page: ${hasEmail ? '✓ email found' : '✗ no email in inbox'}`);
      } else {
        console.log(`  Mailinator API: HTTP ${inboxRes.status} — checking public inbox page…`);
        console.log(`  Manual check: https://www.mailinator.com/v4/public/inboxes.jsp?to=${inboxName}`);
      }
    }
  } catch (e) {
    console.log(`  Mailinator check failed: ${e.message}`);
    console.log(`  Manual check: https://www.mailinator.com/v4/public/inboxes.jsp?to=${inboxName}`);
  }
  console.log('');

  // ── 4. SPF / DKIM / DMARC state ───────────────────────────────────────────
  console.log('── 4. Sender domain DNS state ───────────────────────────────────');
  const spfRecs  = await dnsText('royalte.ai');
  const dkimRecs = await dnsText('resend._domainkey.royalte.ai');
  const dmarcRecs= await dnsText('_dmarc.royalte.ai');

  const spf    = spfRecs.find(r => r.startsWith('v=spf1')) || '(none)';
  const spfOk  = spf.includes('spf.resend.com');
  const dkimOk = dkimRecs.length > 0;
  const dmarcOk= dmarcRecs.length > 0;

  console.log(`  SPF:   ${spf}`);
  console.log(`         ${spfOk ? '✓ spf.resend.com included' : '✗ MISSING include:spf.resend.com — emails will SOFTFAIL SPF'}`);
  console.log(`  DKIM:  ${dkimOk ? '✓ resend._domainkey.royalte.ai configured' : '✗ no DKIM record'}`);
  console.log(`  DMARC: ${dmarcOk ? dmarcRecs[0] : '✗ no DMARC record'}`);
  console.log('');

  // ── 5. Summary ───────────────────────────────────────────────────────────
  console.log('── 5. Summary ───────────────────────────────────────────────────');
  const userCreated = Boolean(testUser);
  console.log(`  Signup accepted by Supabase:  ${signupRes.ok ? '✓' : '✗'}`);
  console.log(`  User exists in database:      ${userCreated ? '✓' : '✗'}`);
  console.log(`  SPF includes Resend:          ${spfOk ? '✓' : '✗'}`);
  console.log(`  DKIM configured:              ${dkimOk ? '✓' : '✗'}`);
  console.log(`  DMARC record:                 ${dmarcOk ? '✓' : '✗'}`);

  if (signupRes.ok && userCreated && testUser && !testUser.email_confirmed_at) {
    console.log('\n  ▶ Supabase accepted the signup and created the account (unconfirmed).');
    console.log('    This confirms Supabase attempted to send the verification email.');
    if (!spfOk) {
      console.log('    SPF SOFTFAIL may cause the email to reach spam at major providers.');
    }
    console.log('\n  → Next step: check resend.com/emails for this test address to confirm delivery.');
    console.log(`    Address: ${TEST_EMAIL}`);
  } else if (!signupRes.ok) {
    console.log('\n  ▶ CRITICAL: Supabase rejected the signup. SMTP credentials may be wrong.');
    console.log('    Check: Supabase dashboard → Authentication → Logs for SMTP errors.');
  }

  // Clean up: delete the test user (read-only data not worth keeping)
  if (testUser) {
    const delRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${testUser.id}`, {
      method: 'DELETE', headers: svcHeaders,
    });
    console.log(`\n  Test user cleanup: ${delRes.ok ? '✓ deleted' : `not deleted (${delRes.status})`}`);
  }

  console.log('\n══════════════════════════════════════════════════════════════════\n');
}

run().catch(e => { console.error(e.message); process.exit(1); });
