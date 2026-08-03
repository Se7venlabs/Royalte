// Royaltē — Content Approval Center™, Phase 1 — /api/content/decide
//
// GET  ?token=... -> renders a branded, non-mutating confirm page (does
//                     NOT record a decision -- see below for why).
// POST { token }   -> the real decision: verifies the token, atomically
//                     consumes the Supabase request row, records the
//                     audit trail, fires a workflow_dispatch at
//                     scheduled-publish.yml so an already-due article
//                     publishes in that same run (ECR-001), sends the
//                     confirmation email, renders the result page.
//
// GET-then-POST is deliberate, not accidental complexity: corporate
// email gateways and some clients (Outlook Safe Links, Gmail link
// prescanning) automatically fetch links in emails before a human ever
// clicks. A single-use GET link would get silently consumed by a
// scanner. See governance/CONTENT_APPROVAL_CENTER_ARCHITECTURE.md.
//
// This endpoint never touches git. It only writes to Supabase and fires
// a workflow_dispatch -- the actual registry mutation happens inside
// scheduled-publish.yml's sync-approvals.mjs step, the one place in the
// whole system that writes to the registry. See ECR-004/Executive
// Visibility Rule(tm) and Objective 5's "do not create another
// publishing path."

import { createClient } from '@supabase/supabase-js';
import { verifyToken } from '../../scripts/content-publishing/approval-tokens.mjs';
import { sendDecisionConfirmEmail } from '../../scripts/content-publishing/approval-mailer.mjs';
import { extractIp } from '../_lib/rate-limit.js';

function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('[decide] Supabase credentials not configured');
  return createClient(url, key);
}

function escHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// Minimal, self-contained page shell -- this is a one-off confirm/result
// page, not a marketing email, so it doesn't reuse royalteEmailTemplates'
// email-client-compatibility constraints (table layout, inline styles
// only). Plain, real CSS is fine here.
function page(title, bodyHtml) {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escHtml(title)} — Royaltē</title>
<style>
  body{margin:0;background:#070410;color:#e8e4f4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;display:flex;min-height:100vh;align-items:center;justify-content:center;}
  .card{max-width:480px;width:90%;background:#0a0612;border:1px solid rgba(138,92,255,0.22);border-radius:12px;padding:36px;text-align:center;}
  h1{font-size:20px;margin:0 0 16px 0;color:#fff;}
  p{font-size:14px;line-height:1.6;color:#c8c4dc;}
  .btn{display:inline-block;margin:10px 6px;padding:14px 28px;border-radius:6px;font-weight:700;text-decoration:none;text-transform:uppercase;letter-spacing:1px;font-size:13px;border:none;cursor:pointer;}
  .approve{background:#2ecc71;color:#07200f;}
  .reject{background:#ff5c7a;color:#2a0710;}
</style></head>
<body><div class="card">${bodyHtml}</div></body></html>`;
}

async function logAudit(supabase, { requestId, slug, event, recipientEmail, ip, userAgent, previousStatus, newStatus, detail }) {
  await supabase.from('content_approval_audit_log').insert({
    request_id: requestId || null, article_slug: slug, event,
    recipient_email: recipientEmail || null, ip: ip || null, user_agent: userAgent || null,
    previous_status: previousStatus || null, new_status: newStatus || null, detail: detail || null,
  });
}

async function fireWorkflowDispatch() {
  const token = process.env.CONTENT_PUBLISHING_PAT;
  if (!token) throw new Error('CONTENT_PUBLISHING_PAT not configured');
  const res = await fetch('https://api.github.com/repos/Se7venlabs/Royalte/actions/workflows/scheduled-publish.yml/dispatches', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ ref: 'main' }),
  });
  if (!res.ok) throw new Error(`workflow_dispatch failed: ${res.status} ${await res.text()}`);
}

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const token = req.method === 'GET' ? req.query.token : req.body?.token;
  if (typeof token !== 'string' || !token) {
    return res.status(400).send(page('Invalid Link', '<h1>Invalid Link</h1><p>This approval link is missing required information.</p>'));
  }

  const tokenSecret = process.env.CONTENT_APPROVAL_TOKEN_SECRET;
  if (!tokenSecret) {
    console.error('[decide] CONTENT_APPROVAL_TOKEN_SECRET not configured');
    return res.status(500).send(page('Unavailable', '<h1>Temporarily Unavailable</h1><p>Please try again shortly.</p>'));
  }

  const verified = verifyToken(token, tokenSecret, new Date().toISOString());
  let supabase;
  try {
    supabase = getSupabase();
  } catch (err) {
    console.error('[decide]', err.message);
    return res.status(500).send(page('Unavailable', '<h1>Temporarily Unavailable</h1><p>Please try again shortly.</p>'));
  }

  if (!verified.valid) {
    // Security Review (Objective 15): every invalid/expired/tampered
    // attempt is logged, not just successes.
    await logAudit(supabase, {
      requestId: verified.payload?.requestId, slug: null,
      event: verified.reason === 'expired' ? 'expired_attempt' : 'invalid_signature',
      ip: extractIp(req), userAgent: req.headers['user-agent'],
    });
    const message = verified.reason === 'expired'
      ? 'This approval link has expired.'
      : 'This approval link is invalid or has already been used.';
    return res.status(410).send(page('Link No Longer Valid', `<h1>Link No Longer Valid</h1><p>${escHtml(message)}</p>`));
  }

  const { requestId, action } = verified.payload;

  const { data: requestRow, error: fetchError } = await supabase
    .from('content_approval_requests')
    .select('id, article_slug, article_title, article_publish_date, nonce, status, used_at, recipient_email')
    .eq('id', requestId)
    .maybeSingle();

  if (fetchError || !requestRow || requestRow.nonce !== verified.payload.nonce) {
    await logAudit(supabase, { requestId, slug: requestRow?.article_slug || null, event: 'invalid_signature', ip: extractIp(req), userAgent: req.headers['user-agent'], detail: 'nonce mismatch or request not found' });
    return res.status(410).send(page('Link No Longer Valid', '<h1>Link No Longer Valid</h1><p>This approval link could not be verified.</p>'));
  }

  if (req.method === 'GET') {
    await logAudit(supabase, { requestId, slug: requestRow.article_slug, event: 'viewed', ip: extractIp(req), userAgent: req.headers['user-agent'] });

    if (requestRow.status !== 'pending' || requestRow.used_at) {
      return res.status(410).send(page('Already Decided', '<h1>Already Decided</h1><p>A decision has already been recorded for this article.</p>'));
    }

    const verb = action === 'approve' ? 'Approve' : 'Reject';
    const btnClass = action === 'approve' ? 'approve' : 'reject';
    return res.status(200).send(page(`${verb} Publication`, `
      <h1>${verb} Publication?</h1>
      <p><strong>${escHtml(requestRow.article_title || requestRow.article_slug)}</strong></p>
      <p>Scheduled: ${escHtml(requestRow.article_publish_date || 'Not specified')}</p>
      <p>Confirm below to record this decision.</p>
      <form method="POST" action="/api/content/decide">
        <input type="hidden" name="token" value="${escHtml(token)}">
        <button class="btn ${btnClass}" type="submit">${verb} Publication</button>
      </form>
    `));
  }

  // POST -- the real decision. Atomic single-use guard: the WHERE clause
  // (status='pending' AND used_at IS NULL) means this UPDATE affects zero
  // rows for an already-decided or already-used request, same guard
  // pattern as the existing rate-limit RPC and sync-approvals.mjs's own
  // synced_at flip -- no separate "check then update" race window.
  const nowIso = new Date().toISOString();
  const newStatus = action === 'approve' ? 'approved' : 'rejected';
  const { data: updatedRows, error: updateError } = await supabase
    .from('content_approval_requests')
    .update({
      status: newStatus, action_requested: action, used_at: nowIso, decided_at: nowIso,
      decided_ip: extractIp(req), decided_user_agent: req.headers['user-agent'] || null,
    })
    .eq('id', requestId)
    .eq('status', 'pending')
    .is('used_at', null)
    .select();

  if (updateError || !updatedRows || updatedRows.length === 0) {
    await logAudit(supabase, { requestId, slug: requestRow.article_slug, event: 'replay_attempt', ip: extractIp(req), userAgent: req.headers['user-agent'] });
    return res.status(410).send(page('Already Decided', '<h1>Already Decided</h1><p>A decision has already been recorded for this article.</p>'));
  }

  await logAudit(supabase, {
    requestId, slug: requestRow.article_slug, event: newStatus,
    recipientEmail: requestRow.recipient_email, ip: extractIp(req), userAgent: req.headers['user-agent'],
    previousStatus: 'pending', newStatus,
  });

  // Best-effort: sync-approvals.mjs's next scheduled run (Tue/Thu, or a
  // manual workflow_dispatch) would eventually pick this decision up
  // regardless, so a dispatch failure here delays "immediate" (ECR-001)
  // rather than losing the decision -- never block the response on it
  // beyond a single attempt.
  try {
    await fireWorkflowDispatch();
  } catch (err) {
    console.error('[decide] workflow_dispatch failed:', err.message);
  }

  try {
    await sendDecisionConfirmEmail({
      article: { title: requestRow.article_title || requestRow.article_slug, slug: requestRow.article_slug, publishDate: requestRow.article_publish_date },
      action,
    });
  } catch (err) {
    console.error('[decide] confirmation email failed:', err.message);
  }

  const resultHtml = newStatus === 'approved'
    ? `<h1>✅ Article Approved</h1><p>Publishing will occur automatically according to the scheduled publishing date.</p>`
    : `<h1>Article Returned For Revision</h1><p>Publishing has been cancelled until approved again.</p>`;
  return res.status(200).send(page(newStatus === 'approved' ? 'Approved' : 'Returned For Revision', resultHtml));
}
