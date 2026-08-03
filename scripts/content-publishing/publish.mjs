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
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadRegistry, saveArticle, appendHistory } from './registry.mjs';
import { isEligibleForPublishing } from './schema.mjs';
import {
  renderBlogCards, renderBlogPostsJs, renderEducationCards, renderEducationPostsJs,
  renderSitemapUrls, renderRss, renderSearchIndex, substituteMarkerRegion,
} from './render.mjs';

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

// publishDueArticles({today, registryDir, historyPath, repoRoot}) ->
// { publishedSlugs, failedSlugs, allArticles }
// The only function that mutates registry state -- flips eligible entries
// to 'published' and appends a Publication History event per attempt.
// registryDir/historyPath/repoRoot default to the real project paths but
// are overridable, so tests can point this at a scratch directory instead
// of the real content-registry.
function publishDueArticles({
  today = todayUtc(), workflowRunId = null, commitSha = null,
  registryDir = undefined, historyPath = undefined, repoRoot = REPO_ROOT,
} = {}) {
  const startedAt = Date.now();
  const allArticles = loadRegistry(registryDir);
  const publishedSlugs = [];
  const failedSlugs = [];

  for (const article of allArticles) {
    if (!isEligibleForPublishing(article, today)) continue;

    if (!existsSync(path.join(repoRoot, article.contentPath))) {
      failedSlugs.push(article.slug);
      appendHistory({
        event: 'publish_failed',
        slug: article.slug,
        reason: `contentPath does not exist: ${article.contentPath}`,
        workflowRunId, commitSha,
        durationMs: Date.now() - startedAt,
      }, historyPath);
      continue;
    }

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
  }

  if (publishedSlugs.length === 0 && failedSlugs.length === 0) {
    appendHistory({ event: 'run_no_due_articles', workflowRunId, commitSha, durationMs: Date.now() - startedAt }, historyPath);
  }

  return { publishedSlugs, failedSlugs, allArticles };
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

function writeStepSummary({ publishedSlugs, failedSlugs, writtenFiles }) {
  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  const lines = [
    '## Content Publishing Engine™ run',
    '',
    `**Published**: ${publishedSlugs.length ? publishedSlugs.join(', ') : 'none'}`,
    `**Failed**: ${failedSlugs.length ? failedSlugs.join(', ') : 'none'}`,
    `**Files changed**: ${writtenFiles.length ? writtenFiles.map(f => path.relative(REPO_ROOT, f)).join(', ') : 'none'}`,
  ];
  console.log(lines.join('\n'));
  if (summaryPath) {
    writeFileSync(summaryPath, lines.join('\n') + '\n', { flag: 'a' });
  }
}

export { publishDueArticles, regenerateArtifacts, PATHS };

// CLI entry point.
if (import.meta.url === `file://${process.argv[1]}`) {
  const { publishedSlugs, failedSlugs, allArticles } = publishDueArticles({
    workflowRunId: process.env.GITHUB_RUN_ID || null,
    commitSha: process.env.GITHUB_SHA || null,
  });
  const writtenFiles = regenerateArtifacts(allArticles);
  writeStepSummary({ publishedSlugs, failedSlugs, writtenFiles });

  if (failedSlugs.length > 0) {
    console.error(`::warning::${failedSlugs.length} article(s) were due but failed to publish -- will retry next run.`);
  }
}
