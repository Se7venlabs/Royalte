// ─────────────────────────────────────────────────────────────────────
//  Content Approval Center™ — Phase 1, Executive Audit™
// ─────────────────────────────────────────────────────────────────────
//
//  Extracted from api/content/decide.js so the audit-write path is
//  independently testable with an injected Supabase mock, the same
//  pattern already established for sync-approvals.mjs -- a Vercel
//  request/response object is awkward to unit test; this pure(ish)
//  logic isn't.
//
//  Production defect, found and fixed 2026-08-04: logAudit() previously
//  never checked the Supabase insert's returned error, so a NOT NULL
//  constraint violation on article_slug (every verification-failure
//  event passed slug: null) failed silently -- the audit table appeared
//  completely empty for the exact class of event, invalid links, it
//  exists to explain. Fixed on two fronts: the column is now nullable
//  (a malformed token genuinely cannot always resolve an article
//  identity, and this must never be fabricated), and logAudit() now
//  surfaces any insert error to server logs, always.
// ─────────────────────────────────────────────────────────────────────

// logAudit(supabase, event) -> void. Never throws -- an audit-write
// failure must never break the user-facing approval/rejection response,
// but it must never be silently invisible either. Any Supabase error is
// logged to stderr with the event type and request id for correlation.
// Never logs the token or secret -- neither is ever a parameter this
// function accepts, so it cannot leak them by construction, not just by
// convention.
export async function logAudit(supabase, { requestId, slug, event, recipientEmail, ip, userAgent, previousStatus, newStatus, detail }) {
  const { error } = await supabase.from('content_approval_audit_log').insert({
    request_id: requestId || null,
    article_slug: slug || null,
    event,
    recipient_email: recipientEmail || null,
    ip: ip || null,
    user_agent: userAgent || null,
    previous_status: previousStatus || null,
    new_status: newStatus || null,
    detail: detail || null,
  });
  if (error) {
    console.error(`::error::content_approval_audit_log insert failed for event "${event}" (request ${requestId || 'unknown'}): ${error.message}`);
  }
}

// resolveAuditSlug(supabase, requestId) -> string | null
//
// The only source of truth for "which article was this attempt about,"
// for audit purposes -- a token's own payload is never trusted for this
// (Objective 15: "do not trust a slug supplied by the token or client"),
// even when the token's requestId can be read (decodeTokenUnsafe). If
// no matching row exists, returns null rather than guessing -- an
// invalid requestId is itself useful audit information, distinct from a
// wrong guess at a slug.
export async function resolveAuditSlug(supabase, requestId) {
  if (!requestId) return null;
  const { data } = await supabase
    .from('content_approval_requests')
    .select('article_slug')
    .eq('id', requestId)
    .maybeSingle();
  return data?.article_slug || null;
}
