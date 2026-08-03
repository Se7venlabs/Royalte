// Content Publishing Engine™ test suite. Pure-logic unit tests against
// schema.mjs, render.mjs, registry.mjs, validate.mjs, and publish.mjs
// (against a scratch registry directory, never the real content-registry).
// No GitHub Actions, no real git, no real network — matches the house
// pattern in tests/opportunity-engine-test.mjs.

import { strict as assert } from 'node:assert';
import { mkdtempSync, rmSync, writeFileSync, existsSync, readFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { validateArticleShape, isValidSlug, isEligibleForPublishing } from '../scripts/content-publishing/schema.mjs';
import {
  renderBlogCards, renderBlogPostsJs, renderEducationCards, renderCategoryTileCounts,
  renderSitemapUrls, renderRss, renderSearchIndex, substituteMarkerRegion,
} from '../scripts/content-publishing/render.mjs';
import { loadRegistry, saveArticle, appendHistory, loadHistory } from '../scripts/content-publishing/registry.mjs';
import { validateRegistry } from '../scripts/content-publishing/validate.mjs';
import { publishDueArticles, regenerateArtifacts } from '../scripts/content-publishing/publish.mjs';

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

function withPublishScratch(fn) {
  const dir = mkdtempSync(path.join(tmpdir(), 'publish-test-'));
  const registryDir = path.join(dir, 'articles');
  const historyPath = path.join(dir, 'history.jsonl');
  const repoRoot = dir;
  mkdirSync(registryDir, { recursive: true });
  try {
    return fn({ registryDir, historyPath, repoRoot });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

await test('publishDueArticles only flips eligible (approved+scheduled+due) articles', async () => {
  withPublishScratch(({ registryDir, historyPath, repoRoot }) => {
    saveArticle(makeArticle({ slug: 'due', publishDate: '2026-08-01', contentPath: 'exists.html' }), registryDir);
    saveArticle(makeArticle({ slug: 'not-due-yet', publishDate: '2026-09-01', contentPath: 'exists.html' }), registryDir);
    writeFileSync(path.join(repoRoot, 'exists.html'), '<html></html>');

    const result = publishDueArticles({ today: '2026-08-03', registryDir, historyPath, repoRoot });
    assert.deepEqual(result.publishedSlugs, ['due']);

    const due = loadRegistry(registryDir).find(a => a.slug === 'due');
    assert.equal(due.publishStatus, 'published');
    assert.ok(due.publishedAt);
    const notDue = loadRegistry(registryDir).find(a => a.slug === 'not-due-yet');
    assert.equal(notDue.publishStatus, 'scheduled');
  });
});

await test('an article whose contentPath is missing is skipped, not published, and logged as a failure', async () => {
  withPublishScratch(({ registryDir, historyPath, repoRoot }) => {
    saveArticle(makeArticle({ slug: 'missing-content', publishDate: '2026-08-01', contentPath: 'nonexistent.html' }), registryDir);

    const result = publishDueArticles({ today: '2026-08-03', registryDir, historyPath, repoRoot });
    assert.deepEqual(result.publishedSlugs, []);
    assert.deepEqual(result.failedSlugs, ['missing-content']);

    const article = loadRegistry(registryDir).find(a => a.slug === 'missing-content');
    assert.equal(article.publishStatus, 'scheduled', 'must remain scheduled, not silently marked published');

    const history = loadHistory(historyPath);
    assert.ok(history.some(e => e.event === 'publish_failed' && e.slug === 'missing-content'));
  });
});

await test('a failed article is retried and succeeds once its content appears (recovery)', async () => {
  withPublishScratch(({ registryDir, historyPath, repoRoot }) => {
    saveArticle(makeArticle({ slug: 'late-content', publishDate: '2026-08-01', contentPath: 'late.html' }), registryDir);

    const first = publishDueArticles({ today: '2026-08-03', registryDir, historyPath, repoRoot });
    assert.deepEqual(first.failedSlugs, ['late-content']);

    // Simulate the content PR merging.
    writeFileSync(path.join(repoRoot, 'late.html'), '<html></html>');

    const second = publishDueArticles({ today: '2026-08-04', registryDir, historyPath, repoRoot });
    assert.deepEqual(second.publishedSlugs, ['late-content']);
  });
});

await test('interrupted publish self-heals: an article flipped to published but never regenerated (simulated crash) becomes visible on the next regeneration pass', async () => {
  withPublishScratch(({ registryDir, historyPath, repoRoot }) => {
    saveArticle(makeArticle({ slug: 'crash-recovery', title: 'Crash Recovery Article', publishDate: '2026-08-01', contentPath: 'exists.html' }), registryDir);
    writeFileSync(path.join(repoRoot, 'exists.html'), '<html></html>');

    // Step 1 only -- simulates a crash between the status flip and the
    // regeneration pass (publish.mjs's CLI wraps this in try/finally
    // specifically so a real crash can't skip regeneration within the
    // same run; this test verifies the underlying guarantee that makes
    // that safe even without the finally: regeneration always reads the
    // registry's actual current state, never a stale in-memory snapshot).
    const result = publishDueArticles({ today: '2026-08-03', registryDir, historyPath, repoRoot });
    assert.deepEqual(result.publishedSlugs, ['crash-recovery']);

    const paths = scratchPaths(repoRoot);
    writeFileSync(paths.blogHtml, '<!-- CONTENT-PUBLISHING-ENGINE:BLOG_CARDS:START -->\n<!-- CONTENT-PUBLISHING-ENGINE:BLOG_CARDS:END -->');
    // Regeneration never ran this "run" (simulated crash) -- confirm the
    // card genuinely isn't there yet.
    assert.ok(!readFileSync(paths.blogHtml, 'utf8').includes('Crash Recovery Article'));

    // Next run: nothing newly due (already published), but a fresh
    // loadRegistry() + regenerateArtifacts() call must still surface it.
    const nextRun = publishDueArticles({ today: '2026-08-04', registryDir, historyPath, repoRoot });
    assert.deepEqual(nextRun.publishedSlugs, [], 'already published -- nothing new to flip');
    regenerateArtifacts(nextRun.allArticles, { generatedAt: '2026-08-04T13:00:00Z', paths });
    assert.ok(readFileSync(paths.blogHtml, 'utf8').includes('Crash Recovery Article'), 'must self-heal on the next regeneration pass');
  });
});

await test('idempotency: running twice with nothing newly due produces identical registry state and no re-publish', async () => {
  withPublishScratch(({ registryDir, historyPath, repoRoot }) => {
    saveArticle(makeArticle({ slug: 'already-published', publishStatus: 'published', publishDate: '2026-07-01', contentPath: 'exists.html' }), registryDir);
    writeFileSync(path.join(repoRoot, 'exists.html'), '<html></html>');

    const first = publishDueArticles({ today: '2026-08-03', registryDir, historyPath, repoRoot });
    const second = publishDueArticles({ today: '2026-08-03', registryDir, historyPath, repoRoot });
    assert.deepEqual(first.publishedSlugs, []);
    assert.deepEqual(second.publishedSlugs, []);

    const history = loadHistory(historyPath);
    assert.equal(history.filter(e => e.event === 'run_no_due_articles').length, 2, 'each run is still a real, logged fact even when nothing is due');
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
  withPublishScratch(({ repoRoot }) => {
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
  withPublishScratch(({ repoRoot }) => {
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
console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
