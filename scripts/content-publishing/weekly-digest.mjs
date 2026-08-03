#!/usr/bin/env node
// Content Approval Center™ — Phase 1, Weekly Executive Publishing Summary.
//
// Every Monday morning (or on-demand via workflow_dispatch), replaces
// what a dashboard would have shown (the Board explicitly ruled out a
// dashboard for this phase): read-only, no git writes, no publishing
// side effects. Reads the same registry + Publication History
// publish.mjs already owns, plus a live Supabase snapshot for anything
// not yet reflected in git (an approval decided moments ago, still
// awaiting the next sync-approvals.mjs run).

import { loadRegistry, loadHistory } from './registry.mjs';
import { sendWeeklyDigestEmail } from './approval-mailer.mjs';

const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

// computeWeeklyDigestData(allArticles, historyEvents, now) -> the exact
// shape renderWeeklyDigestEmail expects. Pure -- `now` is always caller-
// supplied, matching isEligibleForPublishing's convention.
export function computeWeeklyDigestData(allArticles, historyEvents, now) {
  const nowMs = new Date(now).getTime();
  const weekAgoIso = new Date(nowMs - ONE_WEEK_MS).toISOString();
  const weekAheadDate = new Date(nowMs + ONE_WEEK_MS).toISOString().slice(0, 10);
  const todayDate = new Date(now).toISOString().slice(0, 10);

  const publishedLastWeek = allArticles.filter(a =>
    a.publishStatus === 'published' && a.publishedAt && a.publishedAt >= weekAgoIso);

  const scheduledThisWeek = allArticles.filter(a =>
    a.publishStatus === 'scheduled' && a.approvalStatus === 'approved' &&
    a.publishDate >= todayDate && a.publishDate <= weekAheadDate);

  const awaitingApproval = allArticles.filter(a => a.approvalStatus === 'awaiting_approval');
  const needsRevision = allArticles.filter(a => a.approvalStatus === 'needs_revision');

  const failedSlugsLastWeek = new Set(
    historyEvents
      .filter(e => e.event === 'publish_failed' && e.loggedAt >= weekAgoIso)
      .map(e => e.slug)
  );
  const failedLastWeek = allArticles.filter(a => failedSlugsLastWeek.has(a.slug));

  return { publishedLastWeek, scheduledThisWeek, awaitingApproval, needsRevision, failedLastWeek };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const allArticles = loadRegistry();
  const historyEvents = loadHistory();
  const digest = computeWeeklyDigestData(allArticles, historyEvents, new Date().toISOString());
  try {
    await sendWeeklyDigestEmail(digest);
    console.log(`Weekly digest sent: ${digest.publishedLastWeek.length} published, ${digest.scheduledThisWeek.length} scheduled, ${digest.awaitingApproval.length} awaiting approval, ${digest.needsRevision.length} needing revision, ${digest.failedLastWeek.length} failed.`);
  } catch (err) {
    console.error(`::error::weekly digest email failed to send: ${err.message}`);
    process.exitCode = 1;
  }
}
