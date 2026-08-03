#!/usr/bin/env node
// Content Publishing Engine™ — one-time migration script.
//
// Seeds content-registry/articles/*.json from:
//   (a) the 11 articles currently live/coming-soon in public/js/blog-posts.js
//       on `main`
//   (b) the 10 blog PRs stuck behind the old merge-driven scheduler
//       (#402-#412, real per-article data pulled directly from each PR's
//       branch — title/description/category/readTime — via `git show`,
//       publishDate from PUBLISHING_QUEUE.md / the old workflow's own
//       run logs)
//   (c) PR #399, real content sitting in Board Review with no approved
//       date yet -- migrated as approvalStatus: 'pending'
//
// Three of the "coming_soon" placeholder entries in the old blog-posts.js
// (metadata-mistakes-killing-royalties, soundexchange-explained-for-artists,
// what-the-mlc-actually-does) share their exact slug with a real, fully
// written article already sitting in an open PR (#399, #404, #410
// respectively) -- those are migrated ONCE, from the real PR data, not
// duplicated as a second, stale placeholder entry.
//
// contentPath always points at where the article file lives (or will live
// once its content PR merges) at public/blog/<slug>.html -- publish.mjs's
// existsSync() check naturally handles "not yet merged" by skipping and
// retrying, no special-casing needed here.
//
// Idempotent: re-running overwrites the same slug-keyed files with the
// same data. Safe to re-run.

import { saveArticle } from './registry.mjs';

const AUTHOR = 'Royaltē Editorial';

// (a) Currently live / coming-soon in public/js/blog-posts.js on `main`.
const LIVE_ARTICLES = [
  { slug: 'music-industry-runs-on-data', title: 'The Music Industry Runs on Data—Not Just Songs', excerpt: "Great music alone isn't enough anymore. Learn why the modern music industry runs on data—and how accurate information protects your royalties.", category: 'Metadata', publishDate: '2026-07-24', readTime: '5 min read', sourcePr: 401 },
  { slug: 'ai-didnt-kill-music-it-changed-the-rules', title: "AI Didn't Kill Music—It Changed the Rules", excerpt: "Artificial intelligence isn't replacing musicians—it's changing the music business. Here's how artists can adapt while protecting their royalties, metadata, and rights.", category: 'AI Music', publishDate: '2026-07-23', readTime: '4 min read', sourcePr: 398 },
  { slug: 'music-licensing-types-explained', title: "Sync License vs Sample vs Beat License vs Cover Song vs Interpolation vs Parody: What's the Difference?", excerpt: 'A practical breakdown of six music licensing types — sync licenses, samples, beat licenses, cover songs, interpolations, and parody — including which copyrights are involved and what permissions artists need.', category: 'Publishing', publishDate: '2026-06-23', readTime: '8 min read', sourcePr: null },
  { slug: 'the-backend-infrastructure-powering-modern-music', title: 'The Backend Infrastructure Powering Modern Music', excerpt: 'The systems behind every stream, sync, and royalty payment — and why independent artists need to understand them.', category: 'AI Music', publishDate: '2026-05-16', readTime: '10 min read', sourcePr: null },
  { slug: 'silent-money-leaks-killing-independent-artists', title: 'The Silent Money Leaks Killing Independent Artists', excerpt: "AI didn't break music's backend — it exposed how broken it already was. The metadata, publishing, and royalty leaks most artists never see.", category: 'AI Music', publishDate: '2026-05-15', readTime: '9 min read', sourcePr: null },
  { slug: 'suno-ai-release-risks', title: 'Using Suno AI? Read This Before Releasing Anything.', excerpt: 'The ownership, royalty, distribution, and copyright risks artists need to understand before commercially releasing AI-generated music.', category: 'AI Music', publishDate: '2026-05-14', readTime: '10 min read', sourcePr: null },
  { slug: 'your-backend-might-be-broken', title: "Your Music Isn't The Problem. Your Backend Might Be Broken.", excerpt: "Streaming numbers look healthy but royalty payouts don't always match. This article breaks down how multiple royalty layers, fragmented backend systems, and incomplete metadata can quietly delay or misroute revenue — and what artists can do to spot it.", category: 'Royalties', publishDate: '2026-05-11', readTime: '8 min read', sourcePr: null },
  { slug: 'why-your-spotify-streams-dont-match-your-money', title: "Why Your Spotify Streams Don't Match Your Money", excerpt: 'The reason Spotify stream counts and royalty payouts often don’t align — and the backend systems most artists never see.', category: 'Royalties', publishDate: '2026-05-15', readTime: '9 min read', sourcePr: null },
];

// (b) Stuck-behind-the-old-scheduler PRs -- real data from each branch.
const SCHEDULED_ARTICLES = [
  { slug: 'ai-music-is-exploding-but-who-actually-owns-the-rights', title: 'AI Music Is Exploding—But Who Actually Owns the Rights?', excerpt: 'AI-generated music is exploding, but ownership remains unclear. Learn who actually owns AI-created music and how to protect your rights as an artist.', category: 'AI Music', readTime: '7 min read', publishDate: '2026-07-27', sourcePr: 402, createdAt: '2026-07-23T16:05:28Z' },
  { slug: 'hidden-cost-of-bad-metadata', title: 'The Hidden Cost of Bad Metadata: How One Wrong ISRC Could Cost You Thousands in Royalties', excerpt: "One wrong ISRC can quietly cost artists thousands in royalties. Learn how metadata errors happen and why your recording's Digital Identity matters.", category: 'Metadata', readTime: '5 min read', publishDate: '2026-07-29', sourcePr: 403, createdAt: '2026-07-23T16:05:58Z' },
  { slug: 'soundexchange-explained-for-artists', title: 'What Is SoundExchange? (And Why Every Artist Should Understand Its Role)', excerpt: 'SoundExchange administers specific digital performance royalties—often confused with a PRO. Learn what SoundExchange actually does for artists.', category: 'SoundExchange', readTime: '7 min read', publishDate: '2026-07-31', sourcePr: 404, createdAt: '2026-07-23T16:09:21Z' },
  { slug: 'the-35-year-copyright-rule', title: 'The 35-Year Copyright Rule: Can Artists Really Get Their Rights Back?', excerpt: 'Many artists believe they automatically regain music rights after 35 years. Learn what copyright termination actually means and how it really works.', category: 'Publishing', readTime: '5 min read', publishDate: '2026-08-03', sourcePr: 405, createdAt: '2026-07-23T16:09:50Z' },
  { slug: 'streaming-pays-more-than-you-think', title: 'Streaming Pays More Than You Think—If Your Music Is Registered Everywhere', excerpt: 'Streaming pays more than most artists realize—if your music is registered everywhere it should be. Learn the royalty streams you might be missing.', category: 'Royalties', readTime: '6 min read', publishDate: '2026-08-05', sourcePr: 406, createdAt: '2026-07-23T16:10:19Z' },
  { slug: 'why-artists-still-arent-getting-paid-in-2026', title: "Why Artists Still Aren't Getting Paid Correctly in 2026", excerpt: "Music is streamed and performed everywhere, yet many artists still aren't paid correctly. Learn why today's fragmented royalty system leaves money behind.", category: 'Royalties', readTime: '9 min read', publishDate: '2026-08-07', sourcePr: 407, createdAt: '2026-07-23T16:10:54Z' },
  { slug: 'why-every-independent-artist-needs-a-music-rights-audit', title: 'Why Every Independent Artist Needs a Music Rights Audit', excerpt: 'Your music catalog is one of your greatest assets. Learn why independent artists need a Music Rights Audit to protect royalties and catalog health.', category: 'Artist Education', readTime: '6 min read', publishDate: '2026-08-10', sourcePr: 408, createdAt: '2026-07-23T16:11:24Z' },
  { slug: 'what-the-mlc-actually-does', title: 'What The MLC Actually Does (And Why Every Songwriter Should Care)', excerpt: 'The Mechanical Licensing Collective explained in plain English—what The MLC does and why registration helps you collect royalties you are owed.', category: 'MLC', readTime: '5 min read', publishDate: '2026-08-12', sourcePr: 410, createdAt: '2026-07-23T17:16:03Z' },
  { slug: 'five-revenue-streams-most-independent-artists-never-collect', title: 'Five Revenue Streams Most Independent Artists Never Collect', excerpt: 'Discover the five music revenue streams many independent artists miss—including neighboring rights, publishing income, and mechanical royalties.', category: 'Royalties', readTime: '7 min read', publishDate: '2026-08-14', sourcePr: 411, createdAt: '2026-07-23T17:16:33Z' },
  { slug: 'what-happens-after-you-leave-a-record-label', title: 'What Happens After You Leave a Record Label?', excerpt: 'Leaving a record label creates new opportunities—and risks. Learn what happens after your deal ends and how to protect your music business.', category: 'Artist Education', readTime: '7 min read', publishDate: '2026-08-17', sourcePr: 412, createdAt: '2026-07-23T17:17:05Z' },
];

// (c) Real content, Board Review, not yet approved/scheduled.
const PENDING_ARTICLES = [
  { slug: 'metadata-mistakes-killing-royalties', title: 'The 7 Metadata Mistakes That Could Be Costing You Music Royalties', excerpt: 'Bad metadata can quietly cost artists their royalties. Learn the 7 most common mistakes—from ISRC errors to missing publisher info—and how to avoid them.', category: 'Metadata', readTime: '7 min read', sourcePr: 399, createdAt: '2026-07-23T13:12:38Z' },
];

function toEntry(a, { approvalStatus, publishStatus, publishedAt = null, createdAt }) {
  const now = new Date().toISOString();
  return {
    slug: a.slug,
    title: a.title,
    type: 'blog',
    category: a.category,
    excerpt: a.excerpt,
    author: AUTHOR,
    readTime: a.readTime,
    contentPath: `public/blog/${a.slug}.html`,
    heroImagePath: null,
    approvalStatus,
    publishStatus,
    publishDate: a.publishDate || null,
    publishedAt,
    articleVersion: 1,
    createdAt: createdAt || a.createdAt || now,
    // For already-published articles, lastModified reflects when the
    // content actually went live, not today's migration run -- migrating
    // its registry record isn't a real content change.
    lastModified: publishedAt || now,
    sourcePr: a.sourcePr,
  };
}

function migrate() {
  let count = 0;

  for (const a of LIVE_ARTICLES) {
    saveArticle(toEntry(a, { approvalStatus: 'approved', publishStatus: 'published', publishedAt: `${a.publishDate}T13:00:00Z` }));
    count++;
  }

  for (const a of SCHEDULED_ARTICLES) {
    saveArticle(toEntry(a, { approvalStatus: 'approved', publishStatus: 'scheduled' }));
    count++;
  }

  for (const a of PENDING_ARTICLES) {
    saveArticle(toEntry(a, { approvalStatus: 'pending', publishStatus: 'draft' }));
    count++;
  }

  console.log(`Migrated ${count} article(s) into the Content Registry.`);
  console.log(`  ${LIVE_ARTICLES.length} published, ${SCHEDULED_ARTICLES.length} scheduled (awaiting content-PR merge), ${PENDING_ARTICLES.length} pending Board approval.`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  migrate();
}

export { migrate, LIVE_ARTICLES, SCHEDULED_ARTICLES, PENDING_ARTICLES };
