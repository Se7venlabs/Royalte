// Royaltē Knowledge Hub — article index
//
// Source of truth for publish workflow + future related-articles rendering.
// Landing-page cards are hand-maintained in /blog.html for crawler
// compatibility (avoids JS-rendered cards being invisible to non-JS-
// executing search bots and AI crawlers).
//
// Articles added here as they're published. Order: newest first.
// To publish a new article:
// 1. Duplicate /blog/_template.html → /blog/<slug>.html
// 2. Find-and-replace the {{TOKENS}} in the new file
// 3. Prepend a new object to this array
// 4. Also add one <article> block to /blog.html mirroring the new entry
//    (hand-maintained for crawler compatibility — see header note above)
// 5. Commit + push to main
// See /blog/README.md for the full workflow.

const blogPosts = [
  {
    title: "Your Music Isn't The Problem. Your Backend Might Be Broken.",
    excerpt: "Streaming numbers look healthy but royalty payouts don't always match. This article breaks down how multiple royalty layers, fragmented backend systems, and incomplete metadata can quietly delay or misroute revenue — and what artists can do to spot it.",
    category: "Royalties",
    date: "2026-05-11",
    readTime: "8 min read",
    slug: "your-backend-might-be-broken",
    url: "/blog/your-backend-might-be-broken.html",
    status: "live"
  },
  {
    title: "Why Your Spotify Streams Don't Match Your Money",
    excerpt: "The reason Spotify stream counts and royalty payouts often don't align — and the backend systems most artists never see.",
    category: "Royalties",
    date: "2026-05-15",
    readTime: "9 min read",
    slug: "why-your-spotify-streams-dont-match-your-money",
    url: "/blog/why-your-spotify-streams-dont-match-your-money.html",
    status: "live"
  },
  {
    title: "The 7 Metadata Mistakes Killing Artist Royalties",
    excerpt: "Bad metadata is one of the most common reasons royalties get misrouted or never collected. This guide covers the seven most frequent errors — from missing ISRCs to mismatched credits — and how to spot them before they cost you.",
    category: "Metadata",
    date: null,
    readTime: null,
    slug: "metadata-mistakes-killing-royalties",
    url: "/blog/metadata-mistakes-killing-royalties.html",
    status: "coming_soon"
  },
  {
    title: "What The MLC Actually Does (And Why So Many Artists Miss It)",
    excerpt: "The Mechanical Licensing Collective handles mechanical royalties for streaming in the US, but most artists don't know what it covers or how to register. A plain-language explanation of what the MLC is, what it pays, and how to make sure you're in the system.",
    category: "MLC",
    date: null,
    readTime: null,
    slug: "what-the-mlc-actually-does",
    url: "/blog/what-the-mlc-actually-does.html",
    status: "coming_soon"
  },
  {
    title: "SoundExchange Explained For Artists",
    excerpt: "SoundExchange collects digital performance royalties for recording artists in the US — but only if you're registered and your tracks are properly attributed. Here's what SoundExchange covers, what it doesn't, and how to make sure you're collecting what you've earned.",
    category: "SoundExchange",
    date: null,
    readTime: null,
    slug: "soundexchange-explained-for-artists",
    url: "/blog/soundexchange-explained-for-artists.html",
    status: "coming_soon"
  }
];

if (typeof window !== 'undefined') {
  window.blogPosts = blogPosts;
}
