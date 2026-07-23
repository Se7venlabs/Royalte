// Royaltē Education Library™ — guide index
//
// Source of truth for the publish workflow + related-guides rendering.
// Landing-page cards are hand-maintained in /education/index.html for
// crawler compatibility, mirroring the same reasoning as blog-posts.js
// (avoids JS-rendered cards being invisible to non-JS-executing search
// bots and AI crawlers).
//
// Guides added here as they're published. Order: newest first.
// To publish a new guide:
// 1. Duplicate /education/_template.html → /education/<slug>.html
// 2. Find-and-replace the {{TOKENS}} in the new file
// 3. Prepend a new object to this array
// 4. Also mirror the entry on /education/index.html (Featured Guide,
//    a category tile, or the Recently Added grid, as appropriate)
// 5. Commit + push per the Royaltē Publishing Intelligence™ workflow --
//    see /education/README.md
//
// Category values are the Education Library's own topic taxonomy (distinct
// from the blog's categories) -- must match a tile on /education/index.html:
// Publishing, Metadata, Copyright, Neighbouring Rights, Streaming, AI,
// Catalogs, Career Building. A guide that spans every topic (a cornerstone
// reference, not a single-topic piece) uses category "Cornerstone Guide"
// and is surfaced via the Featured Guide slot instead of a topic tile.

const educationPosts = [
  {
    title: "The Complete Guide to Music Royalties",
    excerpt: "A complete, plain-English handbook covering the two copyrights every song creates, every major royalty type, publishing, metadata, Digital Identity™, distribution, streaming, AI, catalog building, international royalties, and long-term career stewardship.",
    category: "Cornerstone Guide",
    date: "2026-07-23",
    readTime: "52 min read",
    slug: "complete-guide-to-music-royalties",
    url: "/education/complete-guide-to-music-royalties.html",
    status: "live",
    featured: true
  }
];

if (typeof window !== 'undefined') {
  window.educationPosts = educationPosts;
}
