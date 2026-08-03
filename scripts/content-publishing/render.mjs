// Content Publishing Engine™ — pure rendering functions, Layer 3 support.
//
// Every function here is pure: (article list) -> (string | object). No fs,
// no network, no Date.now() (a `today`/`generatedAt` value is always
// passed in by the caller). Identical input -> identical output, matching
// the discipline already established for api/_lib/opportunity-scoring-engine.js
// and api/_lib/health-engine.js elsewhere in this codebase.
//
// Marker-delimited regions: public/blog.html, public/education/index.html,
// and public/sitemap.xml all carry hand-authored content (nav, hero,
// footer, education's category-tile shell, non-blog sitemap URLs) outside
// the article-listing region. substituteMarkerRegion() replaces only the
// content between an explicit `<!-- CONTENT-PUBLISHING-ENGINE:<NAME>:START -->`
// / `:END` pair, leaving everything else in the file byte-for-byte
// untouched. This preserves the existing, deliberate constraint documented
// in public/blog/README.md and blog.html itself ("do not JS-render from
// blog-posts.js") -- that constraint is about client-side runtime
// rendering; a script producing static HTML at publish time is the same
// kind of artifact the hand-authored cards always were, just authored by a
// script instead of a person.

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeXml(str) {
  return escapeHtml(str);
}

export function markerRegion(name) {
  return {
    start: `<!-- CONTENT-PUBLISHING-ENGINE:${name}:START -->`,
    end: `<!-- CONTENT-PUBLISHING-ENGINE:${name}:END -->`,
  };
}

// substituteMarkerRegion(fileContent, name, newInnerContent) -> string
// Throws if the markers aren't found -- a missing marker is a real
// configuration error (file was hand-edited to remove it), never silently
// ignored.
export function substituteMarkerRegion(fileContent, name, newInnerContent) {
  const { start, end } = markerRegion(name);
  const startIdx = fileContent.indexOf(start);
  const endIdx = fileContent.indexOf(end);
  if (startIdx === -1 || endIdx === -1 || endIdx < startIdx) {
    throw new Error(`marker region "${name}" not found or malformed in file content`);
  }
  const before = fileContent.slice(0, startIdx + start.length);
  const after = fileContent.slice(endIdx);
  return `${before}\n${newInnerContent}\n  ${after}`;
}

function publishedOnly(articles) {
  return articles.filter(a => a.publishStatus === 'published');
}

// Board-approved articles only (published or scheduled) -- a 'pending'/
// 'draft' article hasn't been Board-approved yet and must never appear on
// any public surface, not even as a "coming soon" teaser, since its title/
// content/date could still change or be cancelled before approval.
function publiclyVisible(articles) {
  return articles.filter(a => a.approvalStatus === 'approved');
}

function sortByPublishDateDesc(articles) {
  return [...articles].sort((a, b) => {
    const da = a.publishedAt || a.publishDate || '';
    const db = b.publishedAt || b.publishDate || '';
    return db.localeCompare(da);
  });
}

// ─── Blog ───────────────────────────────────────────────────────────────

function renderOneBlogCard(article) {
  const isComingSoon = article.publishStatus !== 'published';
  const dateLabel = article.publishDate || '';
  const metaLabel = isComingSoon ? 'Coming soon' : `${dateLabel} · ${article.readTime}`;
  const catLabel = isComingSoon ? `${escapeHtml(article.category)} · Coming soon` : escapeHtml(article.category);
  const disabledAttr = isComingSoon ? ' aria-disabled="true"' : '';
  const catClass = isComingSoon ? 'blog-card-cat coming-soon' : 'blog-card-cat';
  const href = `/blog/${article.slug}.html`;

  return [
    `    <article class="blog-card" data-cat="${escapeHtml(article.category)}"${disabledAttr}>`,
    `      <span class="${catClass}">${catLabel}</span>`,
    `      <h3 class="blog-card-title">${escapeHtml(article.title)}</h3>`,
    `      <p class="blog-card-excerpt">${escapeHtml(article.excerpt)}</p>`,
    `      <div class="blog-card-meta">${escapeHtml(metaLabel)}</div>`,
    `      <a class="blog-card-link" href="${href}"${disabledAttr}>Read article →</a>`,
    `    </article>`,
  ].join('\n');
}

// renderBlogCards(articles) -> HTML string for the marker region interior.
// Includes both published and draft/scheduled ("coming soon") blog
// articles, newest-first -- matches the pre-existing hand-authored
// convention of showing not-yet-live articles as disabled preview cards.
export function renderBlogCards(articles) {
  const blogArticles = sortByPublishDateDesc(publiclyVisible(articles).filter(a => a.type === 'blog'));
  return blogArticles.map(renderOneBlogCard).join('\n\n');
}

// renderBlogPostsJs(articles) -> full file content for public/js/blog-posts.js.
// Whole-file generation (not marker-delimited) -- this file was never
// meant to be hand-authored prose, just data.
export function renderBlogPostsJs(articles) {
  const blogArticles = sortByPublishDateDesc(publiclyVisible(articles).filter(a => a.type === 'blog'));
  const entries = blogArticles.map(a => {
    const status = a.publishStatus === 'published' ? 'live' : 'coming_soon';
    const date = a.publishStatus === 'published' ? JSON.stringify(a.publishDate) : 'null';
    const readTime = a.publishStatus === 'published' ? JSON.stringify(a.readTime) : 'null';
    return [
      '  {',
      `    title: ${JSON.stringify(a.title)},`,
      `    excerpt: ${JSON.stringify(a.excerpt)},`,
      `    category: ${JSON.stringify(a.category)},`,
      `    date: ${date},`,
      `    readTime: ${readTime},`,
      `    slug: ${JSON.stringify(a.slug)},`,
      `    url: ${JSON.stringify(`/blog/${a.slug}.html`)},`,
      `    status: ${JSON.stringify(status)}`,
      '  }',
    ].join('\n');
  });

  return [
    '// Royaltē Knowledge Hub — article index',
    '//',
    '// GENERATED FILE — Content Publishing Engine™. Do not hand-edit.',
    '// Source of truth: content-registry/articles/*.json. Regenerated by',
    '// scripts/content-publishing/publish.mjs on every publish run.',
    '// Landing-page cards in /blog.html are generated from the same source,',
    '// via the same engine — see scripts/content-publishing/render.mjs.',
    '',
    'const blogPosts = [',
    entries.join(',\n'),
    '];',
    '',
    "if (typeof window !== 'undefined') {",
    '  window.blogPosts = blogPosts;',
    '}',
    '',
  ].join('\n');
}

// ─── Education ──────────────────────────────────────────────────────────

function renderOneEducationCard(article) {
  return [
    `      <a class="edu-card" href="/education/${article.slug}.html">`,
    `        <span class="edu-card-cat">${escapeHtml(article.category)}</span>`,
    `        <h3 class="edu-card-title">${escapeHtml(article.title)}</h3>`,
    `        <p class="edu-card-excerpt">${escapeHtml(article.excerpt)}</p>`,
    `        <div class="edu-card-meta">${escapeHtml(article.publishDate)} · ${escapeHtml(article.readTime)}</div>`,
    `      </a>`,
  ].join('\n');
}

// renderEducationCards(articles) -> HTML for the "Recently Added" grid
// marker region. Cornerstone Guides (category "Cornerstone Guide") are
// excluded here -- they render via the separate Featured Guide slot
// (renderFeaturedGuide()) instead of the grid.
export function renderEducationCards(articles) {
  const eduArticles = sortByPublishDateDesc(
    publishedOnly(articles).filter(a => a.type === 'education' && a.category !== 'Cornerstone Guide')
  );
  return eduArticles.map(renderOneEducationCard).join('\n');
}

// renderCategoryTileCounts(articles) -> { [category]: count } for
// published education articles. Consumed by whatever renders the tile
// grid's `<span class="edu-category-count">` values.
export function renderCategoryTileCounts(articles) {
  const eduArticles = publishedOnly(articles).filter(a => a.type === 'education' && a.category !== 'Cornerstone Guide');
  const counts = {};
  for (const a of eduArticles) {
    counts[a.category] = (counts[a.category] || 0) + 1;
  }
  return counts;
}

export function renderEducationPostsJs(articles) {
  const eduArticles = sortByPublishDateDesc(publiclyVisible(articles).filter(a => a.type === 'education'));
  const entries = eduArticles.map(a => {
    const status = a.publishStatus === 'published' ? 'live' : 'coming_soon';
    const date = a.publishStatus === 'published' ? JSON.stringify(a.publishDate) : 'null';
    const readTime = a.publishStatus === 'published' ? JSON.stringify(a.readTime) : 'null';
    return [
      '  {',
      `    title: ${JSON.stringify(a.title)},`,
      `    excerpt: ${JSON.stringify(a.excerpt)},`,
      `    category: ${JSON.stringify(a.category)},`,
      `    date: ${date},`,
      `    readTime: ${readTime},`,
      `    slug: ${JSON.stringify(a.slug)},`,
      `    url: ${JSON.stringify(`/education/${a.slug}.html`)},`,
      `    featured: ${a.category === 'Cornerstone Guide' ? 'true' : 'false'},`,
      `    status: ${JSON.stringify(status)}`,
      '  }',
    ].join('\n');
  });

  return [
    '// Royaltē Education Library™ — guide index',
    '//',
    '// GENERATED FILE — Content Publishing Engine™. Do not hand-edit.',
    '// Source of truth: content-registry/articles/*.json. Regenerated by',
    '// scripts/content-publishing/publish.mjs on every publish run.',
    '',
    'const educationPosts = [',
    entries.join(',\n'),
    '];',
    '',
    "if (typeof window !== 'undefined') {",
    '  window.educationPosts = educationPosts;',
    '}',
    '',
  ].join('\n');
}

// ─── Sitemap ────────────────────────────────────────────────────────────

// renderSitemapUrls(articles) -> HTML string for the marker region interior
// inside public/sitemap.xml. Only ever manages published blog/education
// article URLs -- the homepage, landing pages, and other marketing URLs
// live outside the marker region and are never touched.
export function renderSitemapUrls(articles) {
  const published = sortByPublishDateDesc(publishedOnly(articles));
  return published.map(a => {
    const loc = `https://royalte.ai/${a.type}/${a.slug}.html`;
    const lastmod = a.lastModified ? a.lastModified.slice(0, 10) : a.publishDate;
    return [
      '  <url>',
      `    <loc>${escapeXml(loc)}</loc>`,
      `    <lastmod>${lastmod}</lastmod>`,
      '    <changefreq>monthly</changefreq>',
      '    <priority>0.8</priority>',
      '  </url>',
    ].join('\n');
  }).join('\n');
}

// ─── RSS ────────────────────────────────────────────────────────────────

// renderRss(articles, generatedAt) -> full public/rss.xml content.
export function renderRss(articles, generatedAt) {
  const published = sortByPublishDateDesc(publishedOnly(articles)).slice(0, 30);
  const items = published.map(a => {
    const link = `https://royalte.ai/${a.type}/${a.slug}.html`;
    const pubDate = new Date(a.publishedAt || `${a.publishDate}T13:00:00Z`).toUTCString();
    return [
      '    <item>',
      `      <title>${escapeXml(a.title)}</title>`,
      `      <link>${escapeXml(link)}</link>`,
      `      <guid>${escapeXml(link)}</guid>`,
      `      <description>${escapeXml(a.excerpt)}</description>`,
      `      <pubDate>${pubDate}</pubDate>`,
      '    </item>',
    ].join('\n');
  }).join('\n');

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0">',
    '  <channel>',
    '    <title>Royaltē Knowledge Hub</title>',
    '    <link>https://royalte.ai/blog.html</link>',
    '    <description>Music royalty, publishing, and rights education from Royaltē.</description>',
    `    <lastBuildDate>${new Date(generatedAt).toUTCString()}</lastBuildDate>`,
    items,
    '  </channel>',
    '</rss>',
    '',
  ].join('\n');
}

// ─── Search index (data only, no query UI — see plan Decision #2) ───────

export function renderSearchIndex(articles, generatedAt) {
  const published = sortByPublishDateDesc(publishedOnly(articles));
  return {
    generatedAt: new Date(generatedAt).toISOString(),
    articles: published.map(a => ({
      slug: a.slug,
      title: a.title,
      excerpt: a.excerpt,
      category: a.category,
      type: a.type,
      url: `/${a.type}/${a.slug}.html`,
      publishDate: a.publishDate,
    })),
  };
}
