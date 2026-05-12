# Royaltē Knowledge Hub — Publishing Workflow

This directory holds the article pages served at `/blog/<slug>.html`. The
Knowledge Hub is a content channel — its job is to bring artists, songwriters,
managers, and rights holders to royalte.ai through search and AI answers, then
move them toward the scan tool and the Founding Artist Beta.

This README is institutional memory for the publishing workflow. Read it before
adding a new article.

---

## How to publish a new article

1. **Duplicate the template.**
   Copy `/public/blog/_template.html` to `/public/blog/<slug>.html`.
   The slug must be lowercase, hyphen-separated, ASCII-only, and match the
   `slug` field in `blog-posts.js`.

2. **Find-and-replace the tokens in the new file.** There are 8:

   | Token                     | Where it lands                                              |
   |---------------------------|-------------------------------------------------------------|
   | `{{ARTICLE_TITLE}}`       | `<title>`, `<h1>`, OG title, Twitter title                  |
   | `{{ARTICLE_DESCRIPTION}}` | `<meta name="description">`, OG description, Twitter desc. |
   | `{{ARTICLE_SLUG}}`        | canonical URL, OG URL, related-articles JS exclusion key    |
   | `{{ARTICLE_CATEGORY}}`    | category pill in the article header                         |
   | `{{ARTICLE_DATE}}`        | ISO date in the article meta line (e.g. `2026-05-11`)       |
   | `{{ARTICLE_READ_TIME}}`   | read-time string (e.g. `7 min read`)                        |
   | `{{ARTICLE_INTRO}}`       | intro HTML — 1–3 `<p>` blocks, 200–300 words total          |
   | `{{ARTICLE_BODY}}`        | main body HTML — `<h2>`/`<h3>`/`<p>`/`<ul>` blocks          |

   Do **not** edit the mid-article CTA, the final CTA, the nav, or the footer.
   Those are part of the Knowledge Hub voice and stay identical across every
   article.

3. **Prepend an entry to `/public/js/blog-posts.js`.**
   Order is newest first. The object shape:

   ```js
   {
     title: "…",
     excerpt: "…",            // 2–3 sentences, used on the landing page
     category: "Publishing",  // must match a filter pill on /blog.html
     date: "2026-05-11",
     readTime: "7 min read",
     slug: "songtrust-vs-tunecore-publishing",
     url: "/blog/songtrust-vs-tunecore-publishing.html",
     status: "live"           // or "coming_soon"
   }
   ```

4. **Mirror the entry in `/public/blog.html`.**
   Add one `<article class="blog-card">` block to the `.blog-grid` section
   mirroring the new entry. The landing page is intentionally hand-maintained
   in HTML (not JS-rendered from `blog-posts.js`) so that search bots and AI
   crawlers without JS execution can still see every article. The two sources
   must agree.

5. **Commit and push to `main`.**
   Suggested commit message format:
   `feat(blog): publish <slug> — <short title>`.

6. **Verify on production after the Vercel deploy.**
   - Article URL renders.
   - It appears as a card on `/blog.html`.
   - The related-articles strip on the new article shows other articles
     (excluding itself).
   - Canonical, OG, and Twitter tags resolve to the right URL.

---

## Cadence

- **2 articles per week.** Mondays and Thursdays.
- **90-day initial run.** ~26 articles target.
- The schedule is what makes the SEO/AI-search compounding effect work. Hold
  the cadence even on weeks where it's tempting to skip.

---

## Publishing Roadmap (Locked — 90-Day Plan)

This sequence is strategically designed to build topical authority, emotional progression, and SEO compounding. Do not reorder or substitute without approval.

### Strategic Funnel

- **Phase 1 — Awareness:** Artists realize "something about my royalties feels wrong."
- **Phase 2 — Education:** Artists learn metadata, publishing, MLC, SoundExchange, backend systems.
- **Phase 3 — Authority:** Royaltē becomes the company that understands invisible backend infrastructure.
- **Phase 4 — Conversion:** Artists think "I should probably check my setup."

### Locked Article Order

| Week | Mon | Thu |
|---|---|---|
| 1 | Your Music Isn't The Problem. Your Backend Might Be Broken. ✅ LIVE | Why Your Spotify Streams Don't Match Your Money |
| 2 | The 7 Metadata Mistakes Killing Artist Royalties | What The MLC Actually Does (And Why So Many Artists Miss It) |
| 3 | SoundExchange Explained For Artists | Songtrust vs TuneCore Publishing |
| 4 | Why Your Music Is Missing From Certain Countries | Uploading Music Does NOT Mean You're Fully Registered |
| 5 | What Happens When Your ISRC Codes Are Wrong | The Hidden Royalties Most Artists Never Collect |

### Positioning Rules

Every article should feel: educational, artist-first, emotionally intelligent, authoritative, transparent, premium.

Avoid: fear-mongering, fake-guru language, exaggerated royalty claims, "we recover millions" marketing, aggressive sales tone.

Royaltē = backend music intelligence built for artists.

### SEO Strategy

Articles are intentionally connected to create:
- Topical authority clusters (metadata, publishing, streaming)
- Internal linking strength between sequential articles
- Long-tail search capture for artist intent queries
- AI search visibility (ChatGPT, Perplexity, Bing, Claude)

The publishing order matters. Each article reinforces the next.

### Hero Images

Each article requires a hero image at `public/blog/images/<slug>-hero.png`. Recommended dimensions: 1200x630 minimum, wide horizontal aspect. Articles will render with a broken image placeholder if the file is missing.

Currently pending hero image: `your-backend-might-be-broken-hero.png` (to be uploaded by Darryl).

---

## Writing standards

The Knowledge Hub is a **diagnostic education layer**, not a sales layer.
Articles teach how the royalty system works and where money commonly leaks.
They do not promise recovery.

**Voice rules:**

- **No "we recover money" language.** Royaltē identifies and surfaces; it
  does not guarantee recoveries. Diagnostic positioning only.
- **No specific feature claims about third-party services** (Songtrust does X
  but TuneCore does Y) unless you can cite the source. Where you're not sure,
  describe categories and tradeoffs instead of vendor-specific specifics.
- **Plain language.** Assume the reader is an intelligent artist or manager
  who is new to the underlying mechanics. Define industry acronyms on first
  use (MLC, PRO, ISRC, ISWC, UGC).
- **Action over fear.** Don't lead with "you're losing thousands." Lead with
  "here's how this works and what to verify."
- **One canonical CTA path.** Every CTA in the article points to `/#scan-tool`.
  Do not link directly to a contact form, a calendar, or an outbound vendor.

**Per-article structure** (locked by the template):

- 200–300 word intro
- Mid-article CTA (baked, do not edit)
- 4–8 H2 sections in the body
- Final CTA with Founding Artist Beta framing (baked, do not edit)
- Related articles strip (auto-rendered from `blog-posts.js`)

---

## Categories

The category on each article must match one of these — they are the filter
pills on `/blog.html`. If you need a new category, add the pill there first.

- Publishing
- Metadata
- Royalties
- MLC
- SoundExchange
- YouTube / UGC
- Distribution
- Artist Education

---

## SEO checklist before merging

- [ ] `<title>` ends with ` — Royaltē Knowledge Hub`
- [ ] `<meta name="description">` is one sentence, ≤ 160 characters, and is the
      same string used for OG description and Twitter description
- [ ] `<link rel="canonical">` matches the final URL exactly (`https://royalte.ai/blog/<slug>.html`)
- [ ] `og:url` matches the canonical URL exactly
- [ ] `og:type` is `article`
- [ ] H1 in the article body matches the `<title>` (minus the suffix)
- [ ] Slug is lowercase, hyphen-separated, ASCII-only
- [ ] Article is reachable from `/blog.html` (hand-mirrored card present)
- [ ] Related articles render and exclude the current article
- [ ] No leftover `{{TOKEN}}` strings anywhere in the file
      (`grep '{{' public/blog/<slug>.html` returns nothing)

---

## Reserved files — do not publish, do not link

- **`/public/blog/_template.html`** — the source template. The leading
  underscore is the visual marker. Never link to it, never reference it from
  the registry, never request the URL `/blog/_template.html` in any context.
- **`/public/blog/README.md`** — this file. Vercel will not serve `.md` files
  from `public/` under default routing, but treat it as internal docs anyway.

---

## Future enhancements

These are deferred follow-ups, not blockers for the launch:

- **`/sitemap.xml`** — currently absent. Once the Knowledge Hub has ~5 live
  articles, add a sitemap that lists `/`, `/blog.html`, and every live article
  URL with `<lastmod>` derived from the article date in `blog-posts.js`. Submit
  it to Google Search Console and Bing Webmaster Tools.
- **Filter-pill JS.** The pills on `/blog.html` are currently visual only.
  Once the article count grows past ~10, wire the filter to show/hide cards
  client-side based on `data-cat`.
- **JS-rendering of the landing-page grid** is **explicitly out of scope.**
  The grid is hand-maintained in `/blog.html` for crawler/AI-search visibility
  and that decision is durable — do not "DRY it up" against `blog-posts.js`.
- **Author bylines** — currently every article is published as Royaltē
  editorial. Add an `author` field to `blog-posts.js` and a byline block to
  `_template.html` when there's a real author to credit.
