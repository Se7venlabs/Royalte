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
    title: "Songtrust vs. KOSIGN vs. Royaltē",
    excerpt: "Compare Songtrust, KOSIGN, and Royaltē to understand the differences between publishing administration, royalty collection, and music rights intelligence so you can build a stronger music business.",
    category: "Publishing",
    date: "2026-07-23",
    readTime: "5 min read",
    slug: "songtrust-vs-kosign-vs-royalte",
    url: "/education/songtrust-vs-kosign-vs-royalte.html",
    status: "live",
    featured: false
  },
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
  },
  {
    title: "Why Your Distributor Doesn't Collect Every Royalty",
    excerpt: "Every day, thousands of independent artists upload new music to streaming platforms through digital distributors. Within hours or days, their songs appear on Spotify, Apple Music, YouTube Music, Amazon Music, and dozens of other services around the world.",
    category: "Publishing",
    date: "2026-07-23",
    readTime: "4 min read",
    slug: "why-your-distributor-doesnt-collect-every-royalty",
    url: "/education/why-your-distributor-doesnt-collect-every-royalty.html",
    status: "live",
    featured: false
  },
  {
    title: "The Truth About Music Publishing (Most Artists Still Get It Wrong)",
    excerpt: "If you ask ten independent artists what music publishing means, you'll probably get ten different answers.",
    category: "Publishing",
    date: "2026-07-23",
    readTime: "4 min read",
    slug: "the-truth-about-music-publishing-most-artists-still-get-it-wrong",
    url: "/education/the-truth-about-music-publishing-most-artists-still-get-it-wrong.html",
    status: "live",
    featured: false
  },
  {
    title: "What Happens to Your Royalties When Your Song Goes Viral?",
    excerpt: "Every artist dreams about the moment. You wake up, grab your phone, and discover your latest song has exploded overnight.",
    category: "Streaming",
    date: "2026-07-23",
    readTime: "5 min read",
    slug: "what-happens-to-your-royalties-when-your-song-goes-viral",
    url: "/education/what-happens-to-your-royalties-when-your-song-goes-viral.html",
    status: "live",
    featured: false
  },
  {
    title: "Understanding Mechanical Royalties Without the Confusing Legal Language",
    excerpt: "You've just released your latest single. A few months later, it's been streamed hundreds of thousands of times.",
    category: "Publishing",
    date: "2026-07-23",
    readTime: "5 min read",
    slug: "understanding-mechanical-royalties-without-the-confusing-legal-language",
    url: "/education/understanding-mechanical-royalties-without-the-confusing-legal-language.html",
    status: "live",
    featured: false
  },
  {
    title: "How Music Copyright Actually Works in 2026",
    excerpt: "Every day, thousands of artists write songs, record music, and release new albums.",
    category: "Copyright",
    date: "2026-07-23",
    readTime: "4 min read",
    slug: "how-music-copyright-actually-works-in-2026",
    url: "/education/how-music-copyright-actually-works-in-2026.html",
    status: "live",
    featured: false
  },
  {
    title: "What Every Independent Artist Should Know Before Signing a Record Deal",
    excerpt: "For many independent artists, getting offered a record deal feels like the moment they've been working toward their entire career.",
    category: "Career Building",
    date: "2026-07-23",
    readTime: "5 min read",
    slug: "what-every-independent-artist-should-know-before-signing-a-record-deal",
    url: "/education/what-every-independent-artist-should-know-before-signing-a-record-deal.html",
    status: "live",
    featured: false
  },
  {
    title: "Why Metadata Matters More Than Ever in the Age of AI",
    excerpt: "Artificial intelligence is transforming the music industry faster than any technology before it.",
    category: "Metadata",
    date: "2026-07-23",
    readTime: "5 min read",
    slug: "why-metadata-matters-more-than-ever-in-the-age-of-ai",
    url: "/education/why-metadata-matters-more-than-ever-in-the-age-of-ai.html",
    status: "live",
    featured: false
  },
  {
    title: "How Streaming Platforms Decide Which Songs to Recommend",
    excerpt: "Streaming recommendation engines aren't guessing—they're reading data. Here's how metadata, listener behavior, and catalog quality shape which songs algorithms actually surface.",
    category: "Streaming",
    date: "2026-07-23",
    readTime: "5 min read",
    slug: "how-streaming-platforms-decide-which-songs-to-recommend",
    url: "/education/how-streaming-platforms-decide-which-songs-to-recommend.html",
    status: "live",
    featured: false
  },
  {
    title: "The Complete Guide to Neighbouring Rights",
    excerpt: "Neighbouring rights are one of the least understood royalty types in music—and one of the most commonly missed. A plain-English guide to what they are, who collects them, and how to make sure you're not leaving income unclaimed.",
    category: "Neighbouring Rights",
    date: "2026-07-23",
    readTime: "5 min read",
    slug: "the-complete-guide-to-neighbouring-rights",
    url: "/education/the-complete-guide-to-neighbouring-rights.html",
    status: "live",
    featured: false
  },
  {
    title: "What Happens When Two Artists Share the Same Name?",
    excerpt: "Imagine spending years building your music career. You release great songs. You earn new fans.",
    category: "Metadata",
    date: "2026-07-23",
    readTime: "5 min read",
    slug: "what-happens-when-two-artists-share-the-same-name",
    url: "/education/what-happens-when-two-artists-share-the-same-name.html",
    status: "live",
    featured: false
  },
  {
    title: "Why Every Artist Should Audit Their Catalog Every Year",
    excerpt: "Imagine owning a business with hundreds of products. Now imagine never checking whether those products were correctly labeled, properly inventoried, or generating the revenue they should.",
    category: "Catalogs",
    date: "2026-07-23",
    readTime: "4 min read",
    slug: "why-every-artist-should-audit-their-catalog-every-year",
    url: "/education/why-every-artist-should-audit-their-catalog-every-year.html",
    status: "live",
    featured: false
  },
  {
    title: "How AI Is Changing Music Rights Management",
    excerpt: "Artificial intelligence is transforming almost every part of the music industry.",
    category: "AI",
    date: "2026-07-23",
    readTime: "4 min read",
    slug: "how-ai-is-changing-music-rights-management",
    url: "/education/how-ai-is-changing-music-rights-management.html",
    status: "live",
    featured: false
  },
  {
    title: "What Happens When Your Music Is Played Internationally?",
    excerpt: "One of the most exciting moments in an artist's career is discovering that people are listening to your music in countries you've never even visited.",
    category: "Neighbouring Rights",
    date: "2026-07-23",
    readTime: "5 min read",
    slug: "what-happens-when-your-music-is-played-internationally",
    url: "/education/what-happens-when-your-music-is-played-internationally.html",
    status: "live",
    featured: false
  },
  {
    title: "Building a Career Instead of Chasing a Hit Song",
    excerpt: "Every musician dreams of writing a hit song. One song that explodes on streaming platforms.",
    category: "Career Building",
    date: "2026-07-23",
    readTime: "4 min read",
    slug: "building-a-career-instead-of-chasing-a-hit-song",
    url: "/education/building-a-career-instead-of-chasing-a-hit-song.html",
    status: "live",
    featured: false
  },
  {
    title: "Why Older Songs Still Make Money",
    excerpt: "Great evergreen article on catalog value, long-tail streaming, licensing, and sync — source article not yet delivered.",
    category: "Catalogs",
    date: null,
    readTime: null,
    slug: "why-older-songs-still-make-money",
    url: "/education/why-older-songs-still-make-money.html",
    status: "coming_soon",
    featured: false
  }
];

if (typeof window !== 'undefined') {
  window.educationPosts = educationPosts;
}
