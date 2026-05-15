// Blog index drift guard.
//
// public/blog.html hand-maintains the article card grid. public/js/blog-posts.js
// is the canonical registry (it also drives the related-articles block on every
// article page and the IndexNow auto-notification). The two are separate files
// with no automatic link, so they have drifted before — the Part 3 PR had to
// fix three stale cards in one go (a missing card, a broken slug, wrong status).
//
// This test fails the build when a registry entry and its blog.html card
// disagree on any field. The registry is the source of truth: to fix a failure,
// edit the blog.html card to match public/js/blog-posts.js — never the reverse.
//
// Runs in CI as a step of the "Run pipeline test" required check. Run locally
// with: node tests/blog-index-sync-test.mjs

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = join(__dirname, '..');
const REGISTRY_PATH = join(REPO, 'public/js/blog-posts.js');
const BLOG_HTML_PATH = join(REPO, 'public/blog.html');

// Decode the small set of HTML entities that can appear in card text content.
function decodeEntities(s) {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#34;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');
}

// Parse the registry: extract the `blogPosts` array literal and eval it. This is
// the same regex-extract pattern used by .github/workflows/indexnow-notify.yml,
// so both pieces of infrastructure parse the registry the same way.
function loadRegistry() {
  const src = readFileSync(REGISTRY_PATH, 'utf8');
  const m = src.match(/const blogPosts = (\[[\s\S]*?\n\]);/);
  if (!m) {
    throw new Error(
      '[blog-index-sync] Could not locate the `blogPosts` array in public/js/blog-posts.js. ' +
      'The registry format may have changed — update this test to match.'
    );
  }
  const posts = eval(m[1]);
  if (!Array.isArray(posts)) {
    throw new Error('[blog-index-sync] `blogPosts` did not parse to an array.');
  }
  return posts;
}

// Parse blog.html into card objects, one per <article class="blog-card">.
function loadCards() {
  const html = readFileSync(BLOG_HTML_PATH, 'utf8');
  const cards = [];
  const articleRe = /<article class="blog-card"([^>]*)>([\s\S]*?)<\/article>/g;
  let m;
  while ((m = articleRe.exec(html)) !== null) {
    const attrs = m[1];
    const body = m[2];

    const field = (re, label) => {
      const fm = body.match(re);
      if (!fm) {
        throw new Error(
          `[blog-index-sync] A blog.html card is missing its ${label}. ` +
          'The card markup may have changed — update this test to match the new structure.'
        );
      }
      return decodeEntities(fm[1].trim());
    };

    const dataCat = (attrs.match(/data-cat="([^"]*)"/) || [])[1];
    const catSpan = body.match(/<span class="blog-card-cat([^"]*)">/);
    if (!dataCat || !catSpan) {
      throw new Error(
        '[blog-index-sync] A blog.html card is missing its data-cat attribute or blog-card-cat span. ' +
        'The card markup may have changed — update this test to match.'
      );
    }
    const comingSoon = /\bcoming-soon\b/.test(catSpan[1]);

    cards.push({
      category: decodeEntities(dataCat.trim()),
      title:    field(/<h3 class="blog-card-title">([\s\S]*?)<\/h3>/, 'title'),
      excerpt:  field(/<p class="blog-card-excerpt">([\s\S]*?)<\/p>/, 'excerpt'),
      meta:     field(/<div class="blog-card-meta">([\s\S]*?)<\/div>/, 'meta line'),
      url:      field(/<a class="blog-card-link" href="([^"]*)"/, 'link href'),
      status:   comingSoon ? 'coming_soon' : 'live',
    });
  }
  return cards;
}

// The card meta line a registry entry should produce.
// Live entries show "<date> · <readTime>"; coming-soon entries show "Coming soon".
function expectedMeta(entry) {
  return entry.status === 'live'
    ? `${entry.date} · ${entry.readTime}`
    : 'Coming soon';
}

const registry = loadRegistry();
const cards = loadCards();
const errors = [];

const cardByUrl = new Map(cards.map((c) => [c.url, c]));
const registryUrls = new Set(registry.map((e) => e.url));

// Direction 1: every registry entry must have a matching, in-sync card.
for (const entry of registry) {
  const card = cardByUrl.get(entry.url);
  if (!card) {
    errors.push(
      `MISSING CARD — registry slug "${entry.slug}" (${entry.url}) has no ` +
      `<article class="blog-card"> in public/blog.html.\n` +
      `  Fix: add a card for this article to public/blog.html, mirroring the registry entry.`
    );
    continue;
  }
  const cmp = (fieldName, expected, actual) => {
    if (expected !== actual) {
      errors.push(
        `DRIFT — slug "${entry.slug}": ${fieldName} mismatch.\n` +
        `  registry  : ${JSON.stringify(expected)}\n` +
        `  blog.html : ${JSON.stringify(actual)}\n` +
        `  Fix: update the blog.html card to match public/js/blog-posts.js (registry is the source of truth).`
      );
    }
  };
  cmp('title', entry.title, card.title);
  cmp('excerpt', entry.excerpt, card.excerpt);
  cmp('category', entry.category, card.category);
  cmp('status', entry.status, card.status);
  cmp('meta line (date · readTime)', expectedMeta(entry), card.meta);
}

// Direction 2: every card must have a matching registry entry.
for (const card of cards) {
  if (!registryUrls.has(card.url)) {
    errors.push(
      `ORPHAN CARD — public/blog.html has a card for ${card.url} ("${card.title}") ` +
      `with no matching entry in public/js/blog-posts.js.\n` +
      `  Fix: add the article to the registry, or remove the stale card from blog.html.`
    );
  }
}

if (errors.length > 0) {
  console.error('\n═════════════════════════════════════════════');
  console.error('  BLOG INDEX DRIFT — public/blog.html is out of sync with the registry');
  console.error('═════════════════════════════════════════════\n');
  errors.forEach((e, i) => console.error(`${i + 1}. ${e}\n`));
  console.error(
    `${errors.length} drift issue(s) found. public/js/blog-posts.js is the source of ` +
    `truth — sync public/blog.html to it.\n`
  );
  process.exit(1);
}

console.log('═════════════════════════════════════════════');
console.log('  BLOG INDEX VERIFIED: blog.html cards match the registry');
console.log('═════════════════════════════════════════════');
console.log(`Total: ${registry.length} registry entries, ${cards.length} cards — all fields in sync.`);
