#!/usr/bin/env node
// Content Publishing Engine™ — Layer 3, Autonomous Publishing Engine.
//
// Invoked by .github/workflows/scheduled-publish.yml (Tue/Thu 13:00 UTC,
// plus manual workflow_dispatch). No merges, no rebases, no cherry-picks,
// no human intervention required in the common case:
//
//   load registry -> find due articles -> publish -> regenerate every
//   derived artifact from the full current registry -> write files ->
//   append Publication History -> (workflow commits + pushes directly)
//
// Idempotent: re-running with nothing newly due re-renders identical
// output from identical registry state (never an incremental patch), so
// the workflow's own diff-before-commit step naturally no-ops. An article
// whose contentPath file is missing is skipped (not flipped to published)
// and logged as a failed attempt -- it stays 'scheduled' and is retried
// automatically on the next run.

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { randomUUID, randomBytes } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadRegistry, saveArticle, appendHistory } from './registry.mjs';
import { isEligibleForPublishing, isDueForApprovalRequest } from './schema.mjs';
import { signToken } from './approval-tokens.mjs';
import * as defaultMailer from './approval-mailer.mjs';
import {
  renderBlogCards, renderBlogPostsJs, renderEducationCards, renderEducationPostsJs,
  renderSitemapUrls, renderRss, renderSearchIndex, substituteMarkerRegion,
} from './render.mjs';

// Signed approval links are valid for 7 days -- long enough that an
// executive checking email a few days late doesn't hit a dead link, short
// enough that a stale, unactioned link isn't usable indefinitely.
const APPROVAL_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const RECIPIENT_EMAIL = 'info@royalte.ai';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../..');

const PATHS = Object.freeze({
  blogHtml: path.join(REPO_ROOT, 'public/blog.html'),
  educationHtml: path.join(REPO_ROOT, 'public/education/index.html'),
  sitemapXml: path.join(REPO_ROOT, 'public/sitemap.xml'),
  blogPostsJs: path.join(REPO_ROOT, 'public/js/blog-posts.js'),
  educationPostsJs: path.join(REPO_ROOT, 'public/js/education-posts.js'),
  rssXml: path.join(REPO_ROOT, 'public/rss.xml'),
  searchIndexJson: path.join(REPO_ROOT, 'public/search-index.json'),
});

function todayUtc() {
  return new Date().toISOString().slice(0, 10);
}

// issueApprovalRequest(article, opts) -- Content Approval Center(tm),
// Phase 1. Creates the Supabase staging row + two signed links (approve/
// reject sharing one requestId+nonce -- whichever is used first
// atomically consumes the row, naturally invalidating the other), sends
// the rich approval-request email (ECR-002), and only then flips
// approvalStatus: 'pending' -> 'awaiting_approval'. If the Supabase
// insert or the email send fails, the article is left 'pending' and
// retried next run -- never flipped to 'awaiting_approval' without a
// real, backed, delivered request, mirroring the publish path's own
// "don't advance state on failure" discipline.
async function issueApprovalRequest(article, { supabase, tokenSecret, baseUrl, registryDir, historyPath, repoRoot, workflowRunId, mailer }) {
  const requestId = randomUUID();
  const nonce = randomBytes(16).toString('hex');
  const expiresAt = new Date(Date.now() + APPROVAL_TOKEN_TTL_MS).toISOString();

  const { error: insertError } = await supabase.from('content_approval_requests').insert({
    id: requestId, article_slug: article.slug, recipient_email: RECIPIENT_EMAIL,
    nonce, expires_at: expiresAt,
    // Denormalized snapshot -- api/content/decide.js is a live Vercel
    // function with no git access, so it can't read the registry for the
    // real title/date. These don't change after a request is already
    // outstanding, so a snapshot is correct, not stale.
    article_title: article.title, article_publish_date: article.publishDate,
  });
  if (insertError) throw new Error(`could not create approval request row: ${insertError.message}`);

  const approveToken = signToken({ requestId, action: 'approve', expiresAt, nonce }, tokenSecret);
  const rejectToken = signToken({ requestId, action: 'reject', expiresAt, nonce }, tokenSecret);
  const approveUrl = `${baseUrl}/api/content/decide?token=${encodeURIComponent(approveToken)}`;
  const rejectUrl = `${baseUrl}/api/content/decide?token=${encodeURIComponent(rejectToken)}`;

  const seo = mailer.readSeoMetadata(article, repoRoot);
  await mailer.sendApprovalRequestEmail({ article, seo, approveUrl, rejectUrl });

  const nowIso = new Date().toISOString();
  const updated = { ...article, approvalStatus: 'awaiting_approval', lastModified: nowIso };
  saveArticle(updated, registryDir);
  Object.assign(article, updated);

  appendHistory({ event: 'approval_requested', slug: article.slug, approvalRequestId: requestId, workflowRunId }, historyPath);
}

// publishDueArticles({today, registryDir, historyPath, repoRoot, supabase,
// tokenSecret, baseUrl, mailer}) -> { publishedSlugs, failedSlugs,
// approvalRequestedSlugs, allArticles }
//
// The only function that mutates registry state. Two independent
// due-date branches share one loop (Architecture, governance/
// CONTENT_APPROVAL_CENTER_ARCHITECTURE.md): 'approved' articles publish
// exactly as before; 'pending' articles due for their publishing window
// instead have an approval request issued -- never both, since the two
// eligibility checks require mutually exclusive approvalStatus values.
//
// `supabase`/`tokenSecret` are optional: when either is missing (e.g. a
// test exercising only the publish path), due-for-approval articles are
// simply left alone and logged, not silently skipped -- this function
// never assumes Content Approval Center(tm) config is present.
// `mailer` defaults to the real approval-mailer.mjs but is overridable so
// tests never make a real Resend call; every mailer call is best-effort
// (wrapped, logged, never fails the run) since a notification failure
// must never block or roll back a real publish/approval-request action.
async function publishDueArticles({
  today = todayUtc(), workflowRunId = null, commitSha = null,
  registryDir = undefined, historyPath = undefined, repoRoot = REPO_ROOT,
  supabase = undefined, tokenSecret = undefined, baseUrl = 'https://royalte.ai',
  mailer = defaultMailer,
} = {}) {
  const startedAt = Date.now();
  const allArticles = loadRegistry(registryDir);
  const publishedSlugs = [];
  const failedSlugs = [];
  const approvalRequestedSlugs = [];
  const approvalRequestFailedSlugs = [];

  async function notify(fn, args) {
    try {
      await fn(args);
    } catch (err) {
      console.error(`::warning::notification failed (${fn.name || 'mailer call'}): ${err.message}`);
    }
  }

  for (const article of allArticles) {
    if (isEligibleForPublishing(article, today)) {
      if (!existsSync(path.join(repoRoot, article.contentPath))) {
        failedSlugs.push(article.slug);
        appendHistory({
          event: 'publish_failed',
          slug: article.slug,
          reason: `contentPath does not exist: ${article.contentPath}`,
          workflowRunId, commitSha,
          durationMs: Date.now() - startedAt,
        }, historyPath);
        await notify(mailer.sendPublishingFailureEmail, { article, reason: `contentPath does not exist: ${article.contentPath}`, workflowRunId });
        continue;
      }

      await notify(mailer.sendPublishingStartedEmail, { article, workflowRunId });

      const nowIso = new Date().toISOString();
      const updated = {
        ...article,
        publishStatus: 'published',
        publishedAt: nowIso,
        lastModified: nowIso,
      };
      saveArticle(updated, registryDir);
      // Reflect the flip in our in-memory copy so the render pass below sees it.
      Object.assign(article, updated);
      publishedSlugs.push(article.slug);
      appendHistory({
        event: 'published',
        slug: article.slug,
        publishDate: article.publishDate,
        workflowRunId, commitSha,
        durationMs: Date.now() - startedAt,
      }, historyPath);

      const totalPublishedCount = allArticles.filter(a => a.publishStatus === 'published').length;
      await notify(mailer.sendPublishingSuccessEmail, { article, workflowRunId, totalPublishedCount });
      continue;
    }

    if (isDueForApprovalRequest(article, today) && supabase && tokenSecret) {
      try {
        await issueApprovalRequest(article, { supabase, tokenSecret, baseUrl, registryDir, historyPath, repoRoot, workflowRunId, mailer });
        approvalRequestedSlugs.push(article.slug);
      } catch (err) {
        approvalRequestFailedSlugs.push(article.slug);
        appendHistory({
          event: 'approval_request_failed',
          slug: article.slug,
          reason: err.message,
          workflowRunId,
        }, historyPath);
      }
    }
  }

  if (publishedSlugs.length === 0 && failedSlugs.length === 0 && approvalRequestedSlugs.length === 0) {
    appendHistory({ event: 'run_no_due_articles', workflowRunId, commitSha, durationMs: Date.now() - startedAt }, historyPath);
  }

  return { publishedSlugs, failedSlugs, approvalRequestedSlugs, approvalRequestFailedSlugs, allArticles };
}

// regenerateArtifacts(allArticles, {generatedAt, paths}) -> string[] of
// file paths actually written. Always a full regeneration from the
// complete current registry, never an incremental patch -- this is what
// makes re-running safe. `paths` defaults to the real project PATHS but is
// overridable so tests can point this at a scratch directory.
function regenerateArtifacts(allArticles, { generatedAt = new Date().toISOString(), paths = PATHS } = {}) {
  const written = [];

  if (existsSync(paths.blogHtml)) {
    const current = readFileSync(paths.blogHtml, 'utf8');
    const next = substituteMarkerRegion(current, 'BLOG_CARDS', renderBlogCards(allArticles));
    if (next !== current) { writeFileSync(paths.blogHtml, next, 'utf8'); written.push(paths.blogHtml); }
  }

  if (existsSync(paths.sitemapXml)) {
    const current = readFileSync(paths.sitemapXml, 'utf8');
    const next = substituteMarkerRegion(current, 'SITEMAP_URLS', renderSitemapUrls(allArticles));
    if (next !== current) { writeFileSync(paths.sitemapXml, next, 'utf8'); written.push(paths.sitemapXml); }
  }

  // Education surfaces only regenerate once public/education/index.html
  // actually exists -- it doesn't on main yet (see plan Migration §6);
  // skipping silently here is correct, not a failure.
  if (existsSync(paths.educationHtml)) {
    const current = readFileSync(paths.educationHtml, 'utf8');
    const next = substituteMarkerRegion(current, 'EDUCATION_CARDS', renderEducationCards(allArticles));
    if (next !== current) { writeFileSync(paths.educationHtml, next, 'utf8'); written.push(paths.educationHtml); }
  }

  const nextBlogPostsJs = renderBlogPostsJs(allArticles);
  if (!existsSync(paths.blogPostsJs) || readFileSync(paths.blogPostsJs, 'utf8') !== nextBlogPostsJs) {
    writeFileSync(paths.blogPostsJs, nextBlogPostsJs, 'utf8');
    written.push(paths.blogPostsJs);
  }

  if (allArticles.some(a => a.type === 'education')) {
    const nextEduPostsJs = renderEducationPostsJs(allArticles);
    if (!existsSync(paths.educationPostsJs) || readFileSync(paths.educationPostsJs, 'utf8') !== nextEduPostsJs) {
      writeFileSync(paths.educationPostsJs, nextEduPostsJs, 'utf8');
      written.push(paths.educationPostsJs);
    }
  }

  const nextRss = renderRss(allArticles, generatedAt);
  if (!existsSync(paths.rssXml) || readFileSync(paths.rssXml, 'utf8') !== nextRss) {
    writeFileSync(paths.rssXml, nextRss, 'utf8');
    written.push(paths.rssXml);
  }

  const nextSearchIndex = JSON.stringify(renderSearchIndex(allArticles, generatedAt), null, 2) + '\n';
  if (!existsSync(paths.searchIndexJson) || readFileSync(paths.searchIndexJson, 'utf8') !== nextSearchIndex) {
    writeFileSync(paths.searchIndexJson, nextSearchIndex, 'utf8');
    written.push(paths.searchIndexJson);
  }

  return written;
}

function writeStepSummary({ publishedSlugs, failedSlugs, approvalRequestedSlugs = [], approvalRequestFailedSlugs = [], writtenFiles, loadErrors = [] }) {
  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  const lines = [
    '## Content Publishing Engine™ run',
    '',
    `**Published**: ${publishedSlugs.length ? publishedSlugs.join(', ') : 'none'}`,
    `**Failed**: ${failedSlugs.length ? failedSlugs.join(', ') : 'none'}`,
    `**Approval requested**: ${approvalRequestedSlugs.length ? approvalRequestedSlugs.join(', ') : 'none'}`,
    `**Approval request failed**: ${approvalRequestFailedSlugs.length ? approvalRequestFailedSlugs.join(', ') : 'none'}`,
    `**Files changed**: ${writtenFiles.length ? writtenFiles.map(f => path.relative(REPO_ROOT, f)).join(', ') : 'none'}`,
  ];
  if (loadErrors.length > 0) {
    lines.push(`**Registry load errors** (skipped, did not block other articles): ${loadErrors.map(e => `${e.file} (${e.error})`).join('; ')}`);
  }
  console.log(lines.join('\n'));
  if (summaryPath) {
    writeFileSync(summaryPath, lines.join('\n') + '\n', { flag: 'a' });
  }
}

export { publishDueArticles, regenerateArtifacts, PATHS };

// CLI entry point.
//
// Interrupted-publish resilience: if publishDueArticles() throws partway
// through an unexpected error (not the handled "contentPath missing"
// case -- something truly unexpected, e.g. a disk error), any articles it
// already flipped to 'published' before the throw would otherwise sit in
// the registry without ever being regenerated into a visible artifact
// until the next scheduled run. The `finally` block guarantees a fresh
// regeneration pass always runs from whatever the registry's actual
// current state is, closing that window within the same run rather than
// leaving it to self-heal (correctly, but with unnecessary delay) later.
if (import.meta.url === `file://${process.argv[1]}`) {
  // Content Approval Center(tm) config -- both optional at the type
  // level, but a due-for-approval article silently never gets a request
  // if either is missing (see publishDueArticles's own doc comment), so
  // a misconfigured SUPABASE_* or CONTENT_APPROVAL_TOKEN_SECRET fails
  // loudly here rather than silently disabling half the Engine.
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const tokenSecret = process.env.CONTENT_APPROVAL_TOKEN_SECRET;
  if (!supabaseUrl || !supabaseKey || !tokenSecret) {
    console.error('::error::SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and CONTENT_APPROVAL_TOKEN_SECRET must all be set -- Content Approval Center cannot issue approval requests without them.');
    process.exitCode = 1;
  }
  const { createClient } = await import('@supabase/supabase-js');
  const supabase = (supabaseUrl && supabaseKey) ? createClient(supabaseUrl, supabaseKey) : undefined;

  let publishResult = null;
  let publishError = null;
  try {
    publishResult = await publishDueArticles({
      workflowRunId: process.env.GITHUB_RUN_ID || null,
      commitSha: process.env.GITHUB_SHA || null,
      supabase, tokenSecret,
    });
  } catch (err) {
    publishError = err;
  } finally {
    const allArticles = publishResult ? publishResult.allArticles : loadRegistry();
    const publishedSlugs = publishResult ? publishResult.publishedSlugs : [];
    const failedSlugs = publishResult ? publishResult.failedSlugs : [];
    const approvalRequestedSlugs = publishResult ? publishResult.approvalRequestedSlugs : [];
    const approvalRequestFailedSlugs = publishResult ? publishResult.approvalRequestFailedSlugs : [];
    const writtenFiles = regenerateArtifacts(allArticles);
    const loadErrors = allArticles.loadErrors || [];
    writeStepSummary({ publishedSlugs, failedSlugs, approvalRequestedSlugs, approvalRequestFailedSlugs, writtenFiles, loadErrors });

    if (failedSlugs.length > 0) {
      console.error(`::warning::${failedSlugs.length} article(s) were due but failed to publish -- will retry next run.`);
    }
    if (approvalRequestFailedSlugs.length > 0) {
      console.error(`::warning::${approvalRequestFailedSlugs.length} approval request(s) failed to issue -- will retry next run: ${approvalRequestFailedSlugs.join(', ')}`);
    }
    if (loadErrors.length > 0) {
      console.error(`::error::${loadErrors.length} registry file(s) could not be parsed and were skipped -- fix them, this is not a self-healing condition: ${loadErrors.map(e => e.file).join(', ')}`);
      process.exitCode = 1;
    }
    if (publishError) {
      console.error(`::error::publishDueArticles failed unexpectedly: ${publishError.message} -- artifacts were still regenerated from current registry state before exiting.`);
      process.exitCode = 1;
    }
  }
}
