// ─────────────────────────────────────────────────────────────────────
//  Content Approval Center™ — Phase 1, Supabase → Registry reconciliation
// ─────────────────────────────────────────────────────────────────────
//
//  The only direction of sync this module performs: a decision already
//  recorded in Supabase (by api/content/decide.js, a live Vercel
//  endpoint with no git access) gets folded into the git-tracked
//  registry, through the exact same saveArticle()/appendHistory() calls
//  publish.mjs already uses. Runs as an early step in
//  scheduled-publish.yml, before publish.mjs, so a newly-approved
//  overdue article is already 'approved' in the registry by the time
//  that same run's due-date loop looks for eligible articles.
//
//  Never the other direction -- this module never reads registry state
//  to decide what to do, and never writes to Supabase's `status` column
//  (only `synced_at`, marking a decision as folded in). The registry
//  remains the single source of truth for what's actually approved and
//  published; Supabase is a staging area this reconciles from, not a
//  second source of truth.
// ─────────────────────────────────────────────────────────────────────

import { createClient } from '@supabase/supabase-js';
import { loadArticle, saveArticle, appendHistory } from './registry.mjs';

const APPROVAL_STATUS_FOR_DECISION = Object.freeze({
  approved: 'approved',
  rejected: 'needs_revision',
});

// syncDecidedApprovals({supabase, workflowRunId, registryDir, historyPath})
// -> { syncedSlugs, errors }
//
// `supabase` is an injected client (createClient(...) result, or a mock
// with a matching .from().select()/.update() shape in tests) -- this
// module never creates its own client, so it never needs
// SUPABASE_SERVICE_ROLE_KEY directly and stays trivially testable.
export async function syncDecidedApprovals({ supabase, workflowRunId = null, registryDir, historyPath }) {
  const syncedSlugs = [];
  const errors = [];

  const { data: rows, error: queryError } = await supabase
    .from('content_approval_requests')
    .select('id, article_slug, status, decided_at')
    .in('status', ['approved', 'rejected'])
    .is('synced_at', null);

  if (queryError) {
    errors.push({ requestId: null, slug: null, error: `query failed: ${queryError.message}` });
    return { syncedSlugs, errors };
  }

  for (const row of rows || []) {
    const article = loadArticle(row.article_slug, registryDir);
    if (!article) {
      errors.push({ requestId: row.id, slug: row.article_slug, error: 'no matching registry entry -- skipped, left unsynced for manual investigation' });
      continue;
    }

    const nextApprovalStatus = APPROVAL_STATUS_FOR_DECISION[row.status];
    const previousApprovalStatus = article.approvalStatus;
    const nowIso = new Date().toISOString();
    const updated = { ...article, approvalStatus: nextApprovalStatus, lastModified: nowIso };
    saveArticle(updated, registryDir);

    appendHistory({
      event: row.status === 'approved' ? 'approval_synced' : 'rejection_synced',
      slug: row.article_slug,
      approvalRequestId: row.id,
      previousApprovalStatus,
      newApprovalStatus: nextApprovalStatus,
      decidedAt: row.decided_at,
      workflowRunId,
    }, historyPath);

    const { error: updateError } = await supabase
      .from('content_approval_requests')
      .update({ synced_at: nowIso })
      .eq('id', row.id)
      .is('synced_at', null); // same idempotent-write guard as every other single-use flip in this system

    if (updateError) {
      errors.push({ requestId: row.id, slug: row.article_slug, error: `registry updated but marking synced failed: ${updateError.message}` });
      continue;
    }

    syncedSlugs.push(row.article_slug);
  }

  return { syncedSlugs, errors };
}

// CLI entry point -- invoked as a step in scheduled-publish.yml, before
// publish.mjs. Requires SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY, already
// used elsewhere in this codebase (api/_lib/rate-limit.js and others) --
// added here as GitHub Actions repo secrets alongside CONTENT_PUBLISHING_PAT.
if (import.meta.url === `file://${process.argv[1]}`) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('::error::sync-approvals.mjs requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
    process.exitCode = 1;
  } else {
    const supabase = createClient(url, key);
    const { syncedSlugs, errors } = await syncDecidedApprovals({
      supabase,
      workflowRunId: process.env.GITHUB_RUN_ID || null,
    });
    console.log(`Synced ${syncedSlugs.length} decision(s) into the registry: ${syncedSlugs.join(', ') || 'none'}`);
    if (errors.length > 0) {
      for (const e of errors) console.error(`::warning::sync-approvals: ${e.slug || 'query'}: ${e.error}`);
    }
  }
}
