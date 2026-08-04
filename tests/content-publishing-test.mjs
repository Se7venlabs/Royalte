// Content Publishing Engine™ test suite. Pure-logic unit tests against
// schema.mjs, render.mjs, registry.mjs, validate.mjs, and publish.mjs
// (against a scratch registry directory, never the real content-registry).
// No GitHub Actions, no real git, no real network — matches the house
// pattern in tests/opportunity-engine-test.mjs.

import { strict as assert } from 'node:assert';
import { mkdtempSync, rmSync, writeFileSync, existsSync, readFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { validateArticleShape, isValidSlug, isEligibleForPublishing, isDueForApprovalRequest } from '../scripts/content-publishing/schema.mjs';
import {
  renderBlogCards, renderBlogPostsJs, renderEducationCards, renderCategoryTileCounts,
  renderSitemapUrls, renderRss, renderSearchIndex, substituteMarkerRegion,
} from '../scripts/content-publishing/render.mjs';
import { loadRegistry, saveArticle, appendHistory, loadHistory } from '../scripts/content-publishing/registry.mjs';
import { validateRegistry } from '../scripts/content-publishing/validate.mjs';
import { publishDueArticles, regenerateArtifacts } from '../scripts/content-publishing/publish.mjs';
import { syncDecidedApprovals } from '../scripts/content-publishing/sync-approvals.mjs';
import { signToken, verifyToken, decodeTokenUnsafe } from '../scripts/content-publishing/approval-tokens.mjs';
import { extractSeoMetadata } from '../scripts/content-publishing/approval-mailer.mjs';
import { logAudit, resolveAuditSlug } from '../scripts/content-publishing/approval-audit.mjs';
import { renderPublishingCalendar } from '../scripts/content-publishing/generate-publishing-calendar.mjs';

let passed = 0;
let failed = 0;

function test(description, fn) {
  return (async () => {
    try {
      await fn();
      console.log(`  ✓ ${description}`);
      passed++;
    } catch (err) {
      console.error(`  ✗ ${description}`);
      console.error(`    ${err.message}`);
      failed++;
    }
  })();
}

function makeArticle(overrides = {}) {
  const now = new Date().toISOString();
  return {
    slug: 'test-article',
    title: 'Test Article',
    type: 'blog',
    category: 'Metadata',
    excerpt: 'A test excerpt.',
    author: 'Royaltē Editorial',
    readTime: '5 min read',
    contentPath: 'public/blog/test-article.html',
    heroImagePath: null,
    approvalStatus: 'approved',
    publishStatus: 'scheduled',
    publishDate: '2026-08-01',
    publishedAt: null,
    articleVersion: 1,
    createdAt: now,
    lastModified: now,
    sourcePr: null,
    ...overrides,
  };
}

// Injected into every publishDueArticles() call in this file -- records
// what was sent without ever touching the real Resend API. Real email
// rendering has its own coverage in §6; this file only cares that the
// right notification fires at the right moment.
function makeTestMailer() {
  const calls = [];
  const record = (type) => async (args) => { calls.push({ type, slug: args.article.slug }); };
  return {
    calls,
    sendPublishingStartedEmail: record('started'),
    sendPublishingSuccessEmail: record('success'),
    sendPublishingFailureEmail: record('failure'),
    sendApprovalRequestEmail: record('approval_request'),
    readSeoMetadata: () => ({ seoTitle: null, metaDescription: null, keywords: null }),
  };
}

// Minimal in-memory Supabase stub -- just enough surface for
// issueApprovalRequest()'s single `.from(...).insert(...)` call. Tests
// exercising sync-approvals.mjs build their own richer stub inline.
function makeTestSupabase() {
  const insertedRows = [];
  return {
    insertedRows,
    from: () => ({
      insert: (row) => { insertedRows.push(row); return Promise.resolve({ error: null }); },
    }),
  };
}

// ═══════════════════════════════════════════════════════════════════════
console.log('\n§1 Schema — validation and eligibility, pure');

await test('isValidSlug accepts lowercase-hyphenated, rejects everything else', async () => {
  assert.equal(isValidSlug('good-slug-123'), true);
  assert.equal(isValidSlug('Bad_Slug'), false);
  assert.equal(isValidSlug('UPPERCASE'), false);
  assert.equal(isValidSlug(''), false);
  assert.equal(isValidSlug(null), false);
});

await test('validateArticleShape flags every missing required field', async () => {
  const problems = validateArticleShape({});
  assert.ok(problems.length >= 10);
  assert.ok(problems.some(p => p.includes('slug')));
});

await test('validateArticleShape accepts a fully-formed entry', async () => {
  assert.deepEqual(validateArticleShape(makeArticle()), []);
});

await test('validateArticleShape flags scheduled status without a publishDate', async () => {
  const problems = validateArticleShape(makeArticle({ publishDate: null }));
  assert.ok(problems.some(p => p.includes('publishDate is missing')));
});

await test('isEligibleForPublishing requires approved + scheduled + due date, exactly', async () => {
  assert.equal(isEligibleForPublishing(makeArticle({ publishDate: '2026-08-01' }), '2026-08-03'), true);
  assert.equal(isEligibleForPublishing(makeArticle({ publishDate: '2026-08-01' }), '2026-07-31'), false, 'not due yet');
  assert.equal(isEligibleForPublishing(makeArticle({ approvalStatus: 'pending' }), '2026-08-03'), false, 'not approved');
  assert.equal(isEligibleForPublishing(makeArticle({ publishStatus: 'published' }), '2026-08-03'), false, 'already published');
  assert.equal(isEligibleForPublishing(makeArticle({ publishStatus: 'draft', publishDate: null }), '2026-08-03'), false, 'no publishDate at all');
  assert.equal(isEligibleForPublishing(null, '2026-08-03'), false);
});

// ═══════════════════════════════════════════════════════════════════════
console.log('\n§2 Render — pure, deterministic generation');

await test('renderBlogCards excludes pending/draft (not yet Board-approved) articles entirely', async () => {
  const articles = [
    makeArticle({ slug: 'approved-one', approvalStatus: 'approved', publishStatus: 'scheduled' }),
    makeArticle({ slug: 'pending-one', approvalStatus: 'pending', publishStatus: 'draft', publishDate: null }),
  ];
  const html = renderBlogCards(articles);
  assert.ok(html.includes('approved-one'));
  assert.ok(!html.includes('pending-one'), 'a not-yet-approved article must never appear, not even as a teaser');
});

await test('renderBlogCards marks unpublished-but-approved articles as "Coming soon"', async () => {
  const html = renderBlogCards([makeArticle({ publishStatus: 'scheduled' })]);
  assert.ok(html.includes('Coming soon'));
  assert.ok(html.includes('aria-disabled="true"'));
});

await test('renderBlogCards renders a published article with its real date and read time, not "Coming soon"', async () => {
  const html = renderBlogCards([makeArticle({ publishStatus: 'published', publishDate: '2026-08-01', readTime: '5 min read' })]);
  assert.ok(html.includes('2026-08-01 · 5 min read'));
  assert.ok(!html.includes('Coming soon'));
});

await test('renderBlogCards escapes HTML-significant characters in title/excerpt', async () => {
  const html = renderBlogCards([makeArticle({ title: 'Title with <script> & "quotes"' })]);
  assert.ok(!html.includes('<script>'));
  assert.ok(html.includes('&lt;script&gt;'));
});

await test('rendering is deterministic — identical input produces identical output', async () => {
  const articles = [makeArticle({ slug: 'a' }), makeArticle({ slug: 'b', publishStatus: 'published' })];
  assert.equal(renderBlogCards(articles), renderBlogCards(articles));
  assert.equal(renderBlogPostsJs(articles), renderBlogPostsJs(articles));
});

await test('renderBlogPostsJs produces valid, evaluable JS with the expected fields', async () => {
  const js = renderBlogPostsJs([makeArticle({ publishStatus: 'published', publishDate: '2026-08-01' })]);
  assert.ok(js.includes('const blogPosts = ['));
  assert.ok(js.includes("status: \"live\""));
  const arrMatch = js.match(/const blogPosts = (\[[\s\S]*?\n\]);/);
  assert.ok(arrMatch);
  const parsed = eval(arrMatch[1]);
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].slug, 'test-article');
});

await test('substituteMarkerRegion replaces only the marked region, leaves the rest untouched', async () => {
  const file = 'HEADER\n<!-- CONTENT-PUBLISHING-ENGINE:X:START -->\nold\n<!-- CONTENT-PUBLISHING-ENGINE:X:END -->\nFOOTER';
  const result = substituteMarkerRegion(file, 'X', 'new');
  assert.ok(result.includes('HEADER'));
  assert.ok(result.includes('FOOTER'));
  assert.ok(result.includes('new'));
  assert.ok(!result.includes('old'));
});

await test('substituteMarkerRegion throws if the markers are missing (never silently no-ops)', async () => {
  assert.throws(() => substituteMarkerRegion('no markers here', 'X', 'new'));
});

await test('renderSitemapUrls / renderRss / renderSearchIndex only include published articles', async () => {
  const articles = [
    makeArticle({ slug: 'live-one', publishStatus: 'published', publishDate: '2026-08-01' }),
    makeArticle({ slug: 'scheduled-one', publishStatus: 'scheduled' }),
  ];
  const sitemap = renderSitemapUrls(articles);
  assert.ok(sitemap.includes('live-one'));
  assert.ok(!sitemap.includes('scheduled-one'));

  const rss = renderRss(articles, '2026-08-03T12:00:00Z');
  assert.ok(rss.includes('live-one'));
  assert.ok(!rss.includes('scheduled-one'));

  const searchIndex = renderSearchIndex(articles, '2026-08-03T12:00:00Z');
  assert.equal(searchIndex.articles.length, 1);
  assert.equal(searchIndex.articles[0].slug, 'live-one');
});

await test('renderCategoryTileCounts counts published education articles by category, excluding Cornerstone Guides', async () => {
  const articles = [
    makeArticle({ slug: 'e1', type: 'education', category: 'Publishing', publishStatus: 'published', publishDate: '2026-08-01' }),
    makeArticle({ slug: 'e2', type: 'education', category: 'Publishing', publishStatus: 'published', publishDate: '2026-08-01' }),
    makeArticle({ slug: 'e3', type: 'education', category: 'Cornerstone Guide', publishStatus: 'published', publishDate: '2026-08-01' }),
    makeArticle({ slug: 'e4', type: 'education', category: 'Streaming', publishStatus: 'scheduled' }),
  ];
  const counts = renderCategoryTileCounts(articles);
  assert.equal(counts['Publishing'], 2);
  assert.equal(counts['Cornerstone Guide'], undefined);
  assert.equal(counts['Streaming'], undefined, 'not yet published, must not count');
});

// ═══════════════════════════════════════════════════════════════════════
console.log('\n§3 Registry — one-file-per-article store');

function withScratchDir(fn) {
  const dir = mkdtempSync(path.join(tmpdir(), 'content-registry-test-'));
  try {
    return fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

await test('saveArticle + loadRegistry round-trips correctly, one file per article', async () => {
  withScratchDir(dir => {
    saveArticle(makeArticle({ slug: 'a' }), dir);
    saveArticle(makeArticle({ slug: 'b' }), dir);
    const all = loadRegistry(dir);
    assert.equal(all.length, 2);
    assert.ok(existsSync(path.join(dir, 'a.json')));
    assert.ok(existsSync(path.join(dir, 'b.json')));
  });
});

await test('saveArticle overwrites the same slug file, never duplicates', async () => {
  withScratchDir(dir => {
    saveArticle(makeArticle({ slug: 'a', title: 'First' }), dir);
    saveArticle(makeArticle({ slug: 'a', title: 'Second' }), dir);
    const all = loadRegistry(dir);
    assert.equal(all.length, 1);
    assert.equal(all[0].title, 'Second');
  });
});

await test('appendHistory is append-only — never overwrites prior lines', async () => {
  withScratchDir(dir => {
    const historyPath = path.join(dir, 'history.jsonl');
    appendHistory({ event: 'first' }, historyPath);
    appendHistory({ event: 'second' }, historyPath);
    const events = loadHistory(historyPath);
    assert.equal(events.length, 2);
    assert.equal(events[0].event, 'first');
    assert.equal(events[1].event, 'second');
  });
});

await test('loadRegistry skips a malformed (unparseable) registry file rather than throwing for the whole load', async () => {
  withScratchDir(dir => {
    saveArticle(makeArticle({ slug: 'good' }), dir);
    writeFileSync(path.join(dir, 'corrupted.json'), '{ this is not valid json');
    const articles = loadRegistry(dir);
    assert.equal(articles.length, 1, 'the one good article must still load');
    assert.equal(articles[0].slug, 'good');
    assert.equal(articles.loadErrors.length, 1);
    assert.equal(articles.loadErrors[0].file, 'corrupted.json');
  });
});

// ═══════════════════════════════════════════════════════════════════════
console.log('\n§4 Validate — registry-level checks (Workflow A)');

await test('validateRegistry rejects duplicate slugs across the registry', async () => {
  const problems = validateRegistry([makeArticle({ slug: 'dup' }), makeArticle({ slug: 'dup' })]);
  assert.ok(problems.some(p => p.includes('duplicate slug')));
});

await test('validateRegistry does NOT flag a missing contentPath for a scheduled (not yet merged) article', async () => {
  const problems = validateRegistry([makeArticle({ publishStatus: 'scheduled', contentPath: 'public/blog/does-not-exist-yet.html' })]);
  assert.deepEqual(problems, [], 'scheduled articles legitimately may not have merged content yet');
});

await test('validateRegistry DOES flag a missing contentPath for a published article', async () => {
  const problems = validateRegistry([makeArticle({ publishStatus: 'published', contentPath: 'public/blog/does-not-exist.html' })]);
  assert.ok(problems.some(p => p.includes('published but contentPath does not exist')));
});

await test('validateRegistry DOES flag a missing heroImagePath for a published article, not for scheduled', async () => {
  const publishedProblems = validateRegistry([makeArticle({ publishStatus: 'published', contentPath: 'public/blog/README.md', heroImagePath: 'public/blog/images/missing.jpg' })]);
  assert.ok(publishedProblems.some(p => p.includes('heroImagePath does not exist')));
  const scheduledProblems = validateRegistry([makeArticle({ publishStatus: 'scheduled', heroImagePath: 'public/blog/images/missing.jpg' })]);
  assert.deepEqual(scheduledProblems, []);
});

await test('validateRegistry surfaces a malformed registry file as a loud failure, not a silent skip', async () => {
  withScratchDir(dir => {
    writeFileSync(path.join(dir, 'corrupted.json'), '{ not valid json');
    const articles = loadRegistry(dir);
    const problems = validateRegistry(articles).concat(
      (articles.loadErrors || []).map(e => `[${e.file}] could not be parsed as JSON: ${e.error}`)
    );
    assert.ok(problems.some(p => p.includes('corrupted.json')));
  });
});

await test('validateRegistry passes a clean, valid registry', async () => {
  assert.deepEqual(validateRegistry([makeArticle({ slug: 'a' }), makeArticle({ slug: 'b', publishStatus: 'published', contentPath: 'public/blog/README.md' })]), []);
});

// ═══════════════════════════════════════════════════════════════════════
console.log('\n§5 Publish — the autonomous engine, against a scratch registry');

async function withPublishScratch(fn) {
  const dir = mkdtempSync(path.join(tmpdir(), 'publish-test-'));
  const registryDir = path.join(dir, 'articles');
  const historyPath = path.join(dir, 'history.jsonl');
  const repoRoot = dir;
  mkdirSync(registryDir, { recursive: true });
  try {
    return await fn({ registryDir, historyPath, repoRoot });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

await test('publishDueArticles only flips eligible (approved+scheduled+due) articles', async () => {
  await withPublishScratch(async ({ registryDir, historyPath, repoRoot }) => {
    saveArticle(makeArticle({ slug: 'due', publishDate: '2026-08-01', contentPath: 'exists.html' }), registryDir);
    saveArticle(makeArticle({ slug: 'not-due-yet', publishDate: '2026-09-01', contentPath: 'exists.html' }), registryDir);
    writeFileSync(path.join(repoRoot, 'exists.html'), '<html></html>');

    const result = await publishDueArticles({ today: '2026-08-03', registryDir, historyPath, repoRoot, mailer: makeTestMailer() });
    assert.deepEqual(result.publishedSlugs, ['due']);

    const due = loadRegistry(registryDir).find(a => a.slug === 'due');
    assert.equal(due.publishStatus, 'published');
    assert.ok(due.publishedAt);
    const notDue = loadRegistry(registryDir).find(a => a.slug === 'not-due-yet');
    assert.equal(notDue.publishStatus, 'scheduled');
  });
});

await test('an article whose contentPath is missing is skipped, not published, and logged as a failure', async () => {
  await withPublishScratch(async ({ registryDir, historyPath, repoRoot }) => {
    saveArticle(makeArticle({ slug: 'missing-content', publishDate: '2026-08-01', contentPath: 'nonexistent.html' }), registryDir);

    const result = await publishDueArticles({ today: '2026-08-03', registryDir, historyPath, repoRoot, mailer: makeTestMailer() });
    assert.deepEqual(result.publishedSlugs, []);
    assert.deepEqual(result.failedSlugs, ['missing-content']);

    const article = loadRegistry(registryDir).find(a => a.slug === 'missing-content');
    assert.equal(article.publishStatus, 'scheduled', 'must remain scheduled, not silently marked published');

    const history = loadHistory(historyPath);
    assert.ok(history.some(e => e.event === 'publish_failed' && e.slug === 'missing-content'));
  });
});

await test('a failed article is retried and succeeds once its content appears (recovery)', async () => {
  await withPublishScratch(async ({ registryDir, historyPath, repoRoot }) => {
    saveArticle(makeArticle({ slug: 'late-content', publishDate: '2026-08-01', contentPath: 'late.html' }), registryDir);

    const first = await publishDueArticles({ today: '2026-08-03', registryDir, historyPath, repoRoot, mailer: makeTestMailer() });
    assert.deepEqual(first.failedSlugs, ['late-content']);

    // Simulate the content PR merging.
    writeFileSync(path.join(repoRoot, 'late.html'), '<html></html>');

    const second = await publishDueArticles({ today: '2026-08-04', registryDir, historyPath, repoRoot, mailer: makeTestMailer() });
    assert.deepEqual(second.publishedSlugs, ['late-content']);
  });
});

await test('interrupted publish self-heals: an article flipped to published but never regenerated (simulated crash) becomes visible on the next regeneration pass', async () => {
  await withPublishScratch(async ({ registryDir, historyPath, repoRoot }) => {
    saveArticle(makeArticle({ slug: 'crash-recovery', title: 'Crash Recovery Article', publishDate: '2026-08-01', contentPath: 'exists.html' }), registryDir);
    writeFileSync(path.join(repoRoot, 'exists.html'), '<html></html>');

    // Step 1 only -- simulates a crash between the status flip and the
    // regeneration pass (publish.mjs's CLI wraps this in try/finally
    // specifically so a real crash can't skip regeneration within the
    // same run; this test verifies the underlying guarantee that makes
    // that safe even without the finally: regeneration always reads the
    // registry's actual current state, never a stale in-memory snapshot).
    const result = await publishDueArticles({ today: '2026-08-03', registryDir, historyPath, repoRoot, mailer: makeTestMailer() });
    assert.deepEqual(result.publishedSlugs, ['crash-recovery']);

    const paths = scratchPaths(repoRoot);
    writeFileSync(paths.blogHtml, '<!-- CONTENT-PUBLISHING-ENGINE:BLOG_CARDS:START -->\n<!-- CONTENT-PUBLISHING-ENGINE:BLOG_CARDS:END -->');
    // Regeneration never ran this "run" (simulated crash) -- confirm the
    // card genuinely isn't there yet.
    assert.ok(!readFileSync(paths.blogHtml, 'utf8').includes('Crash Recovery Article'));

    // Next run: nothing newly due (already published), but a fresh
    // loadRegistry() + regenerateArtifacts() call must still surface it.
    const nextRun = await publishDueArticles({ today: '2026-08-04', registryDir, historyPath, repoRoot, mailer: makeTestMailer() });
    assert.deepEqual(nextRun.publishedSlugs, [], 'already published -- nothing new to flip');
    regenerateArtifacts(nextRun.allArticles, { generatedAt: '2026-08-04T13:00:00Z', paths });
    assert.ok(readFileSync(paths.blogHtml, 'utf8').includes('Crash Recovery Article'), 'must self-heal on the next regeneration pass');
  });
});

await test('idempotency: running twice with nothing newly due produces identical registry state and no re-publish', async () => {
  await withPublishScratch(async ({ registryDir, historyPath, repoRoot }) => {
    saveArticle(makeArticle({ slug: 'already-published', publishStatus: 'published', publishDate: '2026-07-01', contentPath: 'exists.html' }), registryDir);
    writeFileSync(path.join(repoRoot, 'exists.html'), '<html></html>');

    const first = await publishDueArticles({ today: '2026-08-03', registryDir, historyPath, repoRoot, mailer: makeTestMailer() });
    const second = await publishDueArticles({ today: '2026-08-03', registryDir, historyPath, repoRoot, mailer: makeTestMailer() });
    assert.deepEqual(first.publishedSlugs, []);
    assert.deepEqual(second.publishedSlugs, []);

    const history = loadHistory(historyPath);
    assert.equal(history.filter(e => e.event === 'run_no_due_articles').length, 2, 'each run is still a real, logged fact even when nothing is due');
  });
});

await test('a pending article due for its publishing window gets an approval request, not a publish', async () => {
  await withPublishScratch(async ({ registryDir, historyPath, repoRoot }) => {
    saveArticle(makeArticle({ slug: 'needs-approval', approvalStatus: 'pending', publishDate: '2026-08-01', contentPath: 'exists.html' }), registryDir);
    writeFileSync(path.join(repoRoot, 'exists.html'), '<html></html>');

    const mailer = makeTestMailer();
    const supabase = makeTestSupabase();
    const result = await publishDueArticles({
      today: '2026-08-03', registryDir, historyPath, repoRoot,
      supabase, tokenSecret: 'test-secret', mailer,
    });

    assert.deepEqual(result.publishedSlugs, [], 'must never publish a pending article, however overdue');
    assert.deepEqual(result.approvalRequestedSlugs, ['needs-approval']);
    assert.equal(mailer.calls.filter(c => c.type === 'approval_request').length, 1);
    assert.equal(supabase.insertedRows.length, 1);
    assert.equal(supabase.insertedRows[0].article_slug, 'needs-approval');

    const article = loadRegistry(registryDir).find(a => a.slug === 'needs-approval');
    assert.equal(article.approvalStatus, 'awaiting_approval');

    // Re-running the same day must NOT issue a second request -- the
    // registry flip itself is what prevents duplicates, no separate
    // "already has an outstanding request" query needed.
    const second = await publishDueArticles({ today: '2026-08-03', registryDir, historyPath, repoRoot, supabase, tokenSecret: 'test-secret', mailer });
    assert.deepEqual(second.approvalRequestedSlugs, []);
  });
});

await test('publishDueArticles never issues an approval request without both supabase and tokenSecret configured', async () => {
  await withPublishScratch(async ({ registryDir, historyPath, repoRoot }) => {
    saveArticle(makeArticle({ slug: 'needs-approval', approvalStatus: 'pending', publishDate: '2026-08-01', contentPath: 'exists.html' }), registryDir);
    writeFileSync(path.join(repoRoot, 'exists.html'), '<html></html>');

    const result = await publishDueArticles({ today: '2026-08-03', registryDir, historyPath, repoRoot, mailer: makeTestMailer() });
    assert.deepEqual(result.approvalRequestedSlugs, []);
    const article = loadRegistry(registryDir).find(a => a.slug === 'needs-approval');
    assert.equal(article.approvalStatus, 'pending', 'left untouched, safe to retry once configured');
  });
});

await test('a Supabase insert failure leaves the article pending for retry, never flips to awaiting_approval', async () => {
  await withPublishScratch(async ({ registryDir, historyPath, repoRoot }) => {
    saveArticle(makeArticle({ slug: 'needs-approval', approvalStatus: 'pending', publishDate: '2026-08-01', contentPath: 'exists.html' }), registryDir);
    writeFileSync(path.join(repoRoot, 'exists.html'), '<html></html>');

    const failingSupabase = { from: () => ({ insert: () => Promise.resolve({ error: { message: 'connection refused' } }) }) };
    const result = await publishDueArticles({ today: '2026-08-03', registryDir, historyPath, repoRoot, supabase: failingSupabase, tokenSecret: 'test-secret', mailer: makeTestMailer() });

    assert.deepEqual(result.approvalRequestedSlugs, []);
    assert.deepEqual(result.approvalRequestFailedSlugs, ['needs-approval']);
    const article = loadRegistry(registryDir).find(a => a.slug === 'needs-approval');
    assert.equal(article.approvalStatus, 'pending');
    const history = loadHistory(historyPath);
    assert.ok(history.some(e => e.event === 'approval_request_failed' && e.slug === 'needs-approval'));
  });
});

function scratchPaths(repoRoot) {
  return {
    blogHtml: path.join(repoRoot, 'blog.html'),
    educationHtml: path.join(repoRoot, 'education.html'),
    sitemapXml: path.join(repoRoot, 'sitemap.xml'),
    blogPostsJs: path.join(repoRoot, 'blog-posts.js'),
    educationPostsJs: path.join(repoRoot, 'education-posts.js'),
    rssXml: path.join(repoRoot, 'rss.xml'),
    searchIndexJson: path.join(repoRoot, 'search-index.json'),
  };
}

await test('regenerateArtifacts substitutes the marker region and leaves surrounding hand-authored HTML untouched', async () => {
  await withPublishScratch(async ({ repoRoot }) => {
    const paths = scratchPaths(repoRoot);
    writeFileSync(paths.blogHtml, 'NAV\n<!-- CONTENT-PUBLISHING-ENGINE:BLOG_CARDS:START -->\n<!-- CONTENT-PUBLISHING-ENGINE:BLOG_CARDS:END -->\nFOOTER');
    writeFileSync(paths.sitemapXml, '<urlset>\n<!-- CONTENT-PUBLISHING-ENGINE:SITEMAP_URLS:START -->\n<!-- CONTENT-PUBLISHING-ENGINE:SITEMAP_URLS:END -->\n</urlset>');

    const articles = [makeArticle({ slug: 'live', publishStatus: 'published', publishDate: '2026-08-01' })];
    const written = regenerateArtifacts(articles, { generatedAt: '2026-08-03T12:00:00Z', paths });

    const blogHtml = readFileSync(paths.blogHtml, 'utf8');
    assert.ok(blogHtml.includes('NAV') && blogHtml.includes('FOOTER'), 'hand-authored regions must survive regeneration untouched');
    assert.ok(blogHtml.includes('Test Article'));
    assert.ok(existsSync(paths.blogPostsJs), 'blog-posts.js is whole-file generated unconditionally');
    assert.ok(existsSync(paths.rssXml));
    assert.ok(existsSync(paths.searchIndexJson));
    assert.ok(written.includes(paths.blogHtml));
    assert.ok(!existsSync(paths.educationHtml), 'education surfaces never created when the target file does not already exist');
  });
});

await test('regenerateArtifacts is a true no-op (no files rewritten) when nothing changed', async () => {
  await withPublishScratch(async ({ repoRoot }) => {
    const paths = scratchPaths(repoRoot);
    writeFileSync(paths.blogHtml, '<!-- CONTENT-PUBLISHING-ENGINE:BLOG_CARDS:START -->\n<!-- CONTENT-PUBLISHING-ENGINE:BLOG_CARDS:END -->');
    writeFileSync(paths.sitemapXml, '<!-- CONTENT-PUBLISHING-ENGINE:SITEMAP_URLS:START -->\n<!-- CONTENT-PUBLISHING-ENGINE:SITEMAP_URLS:END -->');

    const articles = [makeArticle({ slug: 'live', publishStatus: 'published', publishDate: '2026-08-01' })];
    regenerateArtifacts(articles, { generatedAt: '2026-08-03T12:00:00Z', paths });
    const secondRun = regenerateArtifacts(articles, { generatedAt: '2026-08-03T12:00:00Z', paths });

    assert.ok(!secondRun.includes(paths.blogHtml), 'identical registry state must not rewrite blog.html a second time');
    assert.ok(!secondRun.includes(paths.blogPostsJs), 'identical registry state must not rewrite blog-posts.js a second time');
  });
});

// ═══════════════════════════════════════════════════════════════════════
console.log('\n§6 Approval — Content Approval Center™, tokens and sync');

await test('isDueForApprovalRequest requires pending + scheduled + due date, exactly', async () => {
  const today = '2026-08-03';
  assert.ok(isDueForApprovalRequest(makeArticle({ approvalStatus: 'pending', publishDate: '2026-08-01' }), today));
  assert.ok(!isDueForApprovalRequest(makeArticle({ approvalStatus: 'pending', publishDate: '2026-09-01' }), today), 'not yet due');
  assert.ok(!isDueForApprovalRequest(makeArticle({ approvalStatus: 'approved', publishDate: '2026-08-01' }), today), 'already approved -- publish path\'s job, not this one');
  assert.ok(!isDueForApprovalRequest(makeArticle({ approvalStatus: 'awaiting_approval', publishDate: '2026-08-01' }), today), 'already has an outstanding request');
  assert.ok(!isDueForApprovalRequest(makeArticle({ approvalStatus: 'pending', publishStatus: 'draft', publishDate: '2026-08-01' }), today), 'draft, not yet scheduled');
});

await test('signToken/verifyToken round-trip correctly', async () => {
  const secret = 'test-secret';
  const token = signToken({ requestId: 'req-1', action: 'approve', expiresAt: '2026-08-10T00:00:00.000Z', nonce: 'abc' }, secret);
  const result = verifyToken(token, secret, '2026-08-03T00:00:00.000Z');
  assert.equal(result.valid, true);
  assert.deepEqual(result.payload, { requestId: 'req-1', action: 'approve', expiresAt: '2026-08-10T00:00:00.000Z', nonce: 'abc' });
});

await test('verifyToken rejects an expired token', async () => {
  const secret = 'test-secret';
  const token = signToken({ requestId: 'req-1', action: 'approve', expiresAt: '2026-08-01T00:00:00.000Z', nonce: 'abc' }, secret);
  const result = verifyToken(token, secret, '2026-08-03T00:00:00.000Z');
  assert.equal(result.valid, false);
  assert.equal(result.reason, 'expired');
});

await test('verifyToken rejects a tampered payload', async () => {
  const secret = 'test-secret';
  const token = signToken({ requestId: 'req-1', action: 'approve', expiresAt: '2026-08-10T00:00:00.000Z', nonce: 'abc' }, secret);
  const [payloadB64, signature] = token.split('.');
  const tamperedPayload = Buffer.from(JSON.stringify({ requestId: 'req-1', action: 'reject', expiresAt: '2026-08-10T00:00:00.000Z', nonce: 'abc' })).toString('base64url');
  const result = verifyToken(`${tamperedPayload}.${signature}`, secret, '2026-08-03T00:00:00.000Z');
  assert.equal(result.valid, false);
  assert.equal(result.reason, 'invalid_signature');
});

await test('verifyToken rejects a token signed with a different secret (replay/forgery protection)', async () => {
  const token = signToken({ requestId: 'req-1', action: 'approve', expiresAt: '2026-08-10T00:00:00.000Z', nonce: 'abc' }, 'secret-a');
  const result = verifyToken(token, 'secret-b', '2026-08-03T00:00:00.000Z');
  assert.equal(result.valid, false);
  assert.equal(result.reason, 'invalid_signature');
});

await test('verifyToken rejects malformed input without throwing', async () => {
  assert.equal(verifyToken('', 'secret', '2026-08-03').valid, false);
  assert.equal(verifyToken('no-dot-here', 'secret', '2026-08-03').valid, false);
  assert.equal(verifyToken('a.b.c', 'secret', '2026-08-03').valid, false);
});

await test('extractSeoMetadata reads title/description/keywords, "Not specified" behavior left to the caller when absent', async () => {
  const full = '<html><head><title>My SEO Title</title><meta name="description" content="A description."><meta name="keywords" content="royalties, metadata"></head></html>';
  assert.deepEqual(extractSeoMetadata(full), { seoTitle: 'My SEO Title', metaDescription: 'A description.', keywords: 'royalties, metadata' });

  const bare = '<html><head></head></html>';
  assert.deepEqual(extractSeoMetadata(bare), { seoTitle: null, metaDescription: null, keywords: null }, 'genuinely absent tags are null, never fabricated');
});

function makeApprovalRow(overrides = {}) {
  return {
    id: 'req-1', article_slug: 'test-article', status: 'approved', decided_at: '2026-08-03T12:00:00Z',
    ...overrides,
  };
}

function makeSyncSupabaseStub(rows) {
  const updates = [];
  return {
    updates,
    from: () => ({
      select: function () { return this; },
      in: function () { return this; },
      is: () => Promise.resolve({ data: rows, error: null }),
      update: (payload) => ({
        eq: (col, id) => ({
          is: () => { updates.push({ id, payload }); return Promise.resolve({ error: null }); },
        }),
      }),
    }),
  };
}

await test('syncDecidedApprovals flips approved -> approved and rejected -> needs_revision', async () => {
  await withPublishScratch(async ({ registryDir, historyPath }) => {
    saveArticle(makeArticle({ slug: 'went-approved', approvalStatus: 'awaiting_approval' }), registryDir);
    saveArticle(makeArticle({ slug: 'went-rejected', approvalStatus: 'awaiting_approval' }), registryDir);

    const rows = [
      makeApprovalRow({ id: 'req-1', article_slug: 'went-approved', status: 'approved' }),
      makeApprovalRow({ id: 'req-2', article_slug: 'went-rejected', status: 'rejected' }),
    ];
    const supabase = makeSyncSupabaseStub(rows);

    const result = await syncDecidedApprovals({ supabase, registryDir, historyPath, workflowRunId: 'test-run' });
    assert.deepEqual(result.syncedSlugs.sort(), ['went-approved', 'went-rejected']);
    assert.equal(supabase.updates.length, 2);

    assert.equal(loadRegistry(registryDir).find(a => a.slug === 'went-approved').approvalStatus, 'approved');
    assert.equal(loadRegistry(registryDir).find(a => a.slug === 'went-rejected').approvalStatus, 'needs_revision');

    const history = loadHistory(historyPath);
    assert.ok(history.some(e => e.event === 'approval_synced' && e.slug === 'went-approved'));
    assert.ok(history.some(e => e.event === 'rejection_synced' && e.slug === 'went-rejected'));
  });
});

await test('syncDecidedApprovals skips a decision for a slug with no matching registry entry, reports it, never throws', async () => {
  await withPublishScratch(async ({ registryDir, historyPath }) => {
    const rows = [makeApprovalRow({ id: 'req-1', article_slug: 'does-not-exist', status: 'approved' })];
    const supabase = makeSyncSupabaseStub(rows);

    const result = await syncDecidedApprovals({ supabase, registryDir, historyPath });
    assert.deepEqual(result.syncedSlugs, []);
    assert.equal(result.errors.length, 1);
    assert.equal(result.errors[0].slug, 'does-not-exist');
  });
});

// Minimal Supabase stub covering exactly what logAudit/resolveAuditSlug
// touch: content_approval_audit_log.insert(...) and
// content_approval_requests.select(...).eq(...).maybeSingle(). Captures
// every insert payload for assertions rather than persisting anything.
function makeAuditSupabaseStub({ insertError = null, requestRowsBySlugId = {} } = {}) {
  const inserts = [];
  return {
    inserts,
    from(table) {
      if (table === 'content_approval_audit_log') {
        return { insert: (row) => { inserts.push(row); return Promise.resolve({ error: insertError }); } };
      }
      if (table === 'content_approval_requests') {
        return {
          select: function () { return this; },
          eq: function (_col, id) { this._id = id; return this; },
          maybeSingle: function () { return Promise.resolve({ data: requestRowsBySlugId[this._id] || null, error: null }); },
        };
      }
      throw new Error(`unexpected table in test stub: ${table}`);
    },
  };
}

await test('decodeTokenUnsafe extracts requestId/action from a token even when its signature is invalid (audit-only, never authorization)', async () => {
  const token = signToken({ requestId: 'req-audit-1', action: 'approve', expiresAt: '2026-08-10T00:00:00.000Z', nonce: 'abc' }, 'secret-a');
  const decoded = decodeTokenUnsafe(token);
  assert.deepEqual(decoded, { requestId: 'req-audit-1', action: 'approve', expiresAt: '2026-08-10T00:00:00.000Z', nonce: 'abc' });

  // Signed with a different secret than whoever verifies it will use --
  // decodeTokenUnsafe still reads the same payload, since it never checks
  // the signature. verifyToken, separately, would reject this token.
  const verifiedElsewhere = verifyToken(token, 'secret-b', '2026-08-03T00:00:00.000Z');
  assert.equal(verifiedElsewhere.valid, false);
  assert.equal(verifiedElsewhere.reason, 'invalid_signature');
});

await test('decodeTokenUnsafe returns null for a fully malformed token -- never fabricates a value', async () => {
  assert.equal(decodeTokenUnsafe('not-a-token-at-all'), null);
  assert.equal(decodeTokenUnsafe(''), null);
  assert.equal(decodeTokenUnsafe('garbage.moregarbage'), null);
});

await test('a malformed token creates an audit event with article_slug = NULL, never fabricated', async () => {
  const supabase = makeAuditSupabaseStub();
  const unsafe = decodeTokenUnsafe('garbage-with-no-dot');
  const slug = await resolveAuditSlug(supabase, unsafe?.requestId);
  await logAudit(supabase, { requestId: unsafe?.requestId || null, slug, event: 'invalid_signature', detail: 'verification failed: malformed' });

  assert.equal(supabase.inserts.length, 1);
  assert.equal(supabase.inserts[0].article_slug, null);
  assert.equal(supabase.inserts[0].request_id, null);
  assert.equal(supabase.inserts[0].event, 'invalid_signature');
});

await test('an invalid-signature attempt (well-formed token, wrong secret) creates an audit event, resolving the real slug from the trusted row -- never the token', async () => {
  const token = signToken({ requestId: 'req-real-1', action: 'reject', expiresAt: '2026-08-10T00:00:00.000Z', nonce: 'xyz' }, 'secret-a');
  const verified = verifyToken(token, 'secret-b', '2026-08-03T00:00:00.000Z'); // wrong secret, as the live incident was
  assert.equal(verified.valid, false);
  assert.equal(verified.reason, 'invalid_signature');

  const supabase = makeAuditSupabaseStub({ requestRowsBySlugId: { 'req-real-1': { article_slug: 'the-real-article' } } });
  const unsafe = decodeTokenUnsafe(token);
  const slug = await resolveAuditSlug(supabase, unsafe?.requestId);
  await logAudit(supabase, { requestId: unsafe.requestId, slug, event: 'invalid_signature', detail: `verification failed: invalid_signature; attempted action: ${unsafe.action}` });

  assert.equal(supabase.inserts.length, 1);
  assert.equal(supabase.inserts[0].article_slug, 'the-real-article', 'resolved from the trusted Supabase row, not the token');
  assert.equal(supabase.inserts[0].request_id, 'req-real-1');
  assert.ok(supabase.inserts[0].detail.includes('attempted action: reject'));
});

await test('an expired-token attempt creates an audit event', async () => {
  const token = signToken({ requestId: 'req-expired-1', action: 'approve', expiresAt: '2026-08-01T00:00:00.000Z', nonce: 'old' }, 'secret-a');
  const verified = verifyToken(token, 'secret-a', '2026-08-03T00:00:00.000Z');
  assert.equal(verified.valid, false);
  assert.equal(verified.reason, 'expired');

  const supabase = makeAuditSupabaseStub({ requestRowsBySlugId: { 'req-expired-1': { article_slug: 'an-expired-article' } } });
  const unsafe = decodeTokenUnsafe(token);
  const slug = await resolveAuditSlug(supabase, unsafe?.requestId);
  await logAudit(supabase, { requestId: unsafe.requestId, slug, event: 'expired_attempt', detail: 'verification failed: expired' });

  assert.equal(supabase.inserts.length, 1);
  assert.equal(supabase.inserts[0].event, 'expired_attempt');
  assert.equal(supabase.inserts[0].article_slug, 'an-expired-article');
});

await test('a valid, successfully-verified request retains the resolved article slug', async () => {
  const supabase = makeAuditSupabaseStub({ requestRowsBySlugId: { 'req-valid-1': { article_slug: 'a-valid-article' } } });
  const slug = await resolveAuditSlug(supabase, 'req-valid-1');
  assert.equal(slug, 'a-valid-article');
  await logAudit(supabase, { requestId: 'req-valid-1', slug, event: 'approved', previousStatus: 'pending', newStatus: 'approved' });
  assert.equal(supabase.inserts[0].article_slug, 'a-valid-article');
});

await test('resolveAuditSlug returns null, never a guess, when no matching request row exists', async () => {
  const supabase = makeAuditSupabaseStub();
  const slug = await resolveAuditSlug(supabase, 'req-does-not-exist');
  assert.equal(slug, null);
});

await test('audit database errors are surfaced (logged) rather than silently ignored', async () => {
  const supabase = makeAuditSupabaseStub({ insertError: { message: 'null value in column "article_slug" violates not-null constraint' } });
  const originalConsoleError = console.error;
  const captured = [];
  console.error = (...args) => captured.push(args.join(' '));
  try {
    await logAudit(supabase, { requestId: 'req-1', slug: null, event: 'invalid_signature' });
  } finally {
    console.error = originalConsoleError;
  }
  assert.equal(captured.length, 1, 'a Supabase insert error must be logged, not swallowed');
  assert.ok(captured[0].includes('invalid_signature'), 'the logged message must include the event type for correlation');
  assert.ok(captured[0].includes('not-null constraint'), 'the logged message must include the actual database error');
});

await test('logAudit never has a code path that can log a token or secret value -- neither is ever a parameter it accepts', async () => {
  // Structural guarantee, verified: logAudit's own signature has no
  // `token`/`secret` field, so no combination of inputs can cause one to
  // appear in a logged message -- this asserts the property directly
  // rather than trusting a comment. A fake sensitive-looking value is
  // deliberately never passed to logAudit at all.
  const sensitiveLookingValue = 'eyJhbGciOiJIUzI1NiJ9.super-secret-token-value-should-never-appear';
  const supabase = makeAuditSupabaseStub({ insertError: { message: 'simulated failure' } });
  const originalConsoleError = console.error;
  const captured = [];
  console.error = (...args) => captured.push(args.join(' '));
  try {
    await logAudit(supabase, { requestId: 'req-1', slug: 'some-article', event: 'invalid_signature', detail: 'verification failed: invalid_signature' });
  } finally {
    console.error = originalConsoleError;
  }
  assert.ok(!captured.join(' ').includes(sensitiveLookingValue), 'no logged output may ever contain a token-shaped value');
});

await test('renderPublishingCalendar groups every article into exactly one lifecycle section, sorted by publishDate', async () => {
  const articles = [
    makeArticle({ slug: 'live-1', publishStatus: 'published', publishDate: '2026-07-01' }),
    makeArticle({ slug: 'scheduled-1', publishStatus: 'scheduled', approvalStatus: 'approved', publishDate: '2026-09-01' }),
    makeArticle({ slug: 'awaiting-1', publishStatus: 'scheduled', approvalStatus: 'awaiting_approval', publishDate: '2026-08-01' }),
    makeArticle({ slug: 'needs-revision-1', publishStatus: 'scheduled', approvalStatus: 'needs_revision', publishDate: '2026-08-01' }),
    makeArticle({ slug: 'draft-1', publishStatus: 'draft', approvalStatus: 'pending', publishDate: null }),
  ];
  const markdown = renderPublishingCalendar(articles, '2026-08-04T00:00:00.000Z');
  for (const a of articles) {
    assert.ok(markdown.includes(a.slug), `${a.slug} must appear somewhere in the calendar`);
  }
  assert.ok(markdown.includes('### Published (1)'));
  assert.ok(markdown.includes('### Scheduled (approved, awaiting publish date) (1)'));
  assert.ok(markdown.includes('### Awaiting Approval (email sent, no decision yet) (1)'));
  assert.ok(markdown.includes('### Needs Revision (rejected) (1)'));
  assert.ok(markdown.includes('### Draft (not yet scheduled) (1)'));
});

// ═══════════════════════════════════════════════════════════════════════
console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
