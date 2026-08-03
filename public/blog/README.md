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
   `slug` field in the article's `content-registry/articles/<slug>.json`
   entry (step 3 below).

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

3. **Add `content-registry/articles/<slug>.json`.** This is the single
   source of truth now — `/public/js/blog-posts.js` and the `.blog-grid`
   cards on `/public/blog.html` are both **generated from it**, never
   hand-edited. See `content-registry/README.md` for the full schema. At a
   minimum:

   ```json
   {
     "slug": "songtrust-vs-tunecore-publishing",
     "title": "…",
     "type": "blog",
     "category": "Publishing",
     "excerpt": "…",
     "author": "Royaltē Editorial",
     "readTime": "7 min read",
     "contentPath": "public/blog/songtrust-vs-tunecore-publishing.html",
     "heroImagePath": null,
     "approvalStatus": "pending",
     "publishStatus": "draft",
     "publishDate": null,
     "publishedAt": null,
     "articleVersion": 1,
     "createdAt": "2026-08-03T00:00:00Z",
     "lastModified": "2026-08-03T00:00:00Z",
     "sourcePr": null
   }
   ```

   Once the Board approves a publish date, set `approvalStatus: "approved"`,
   `publishStatus: "scheduled"`, `publishDate: "YYYY-MM-DD"` — see
   `PUBLISHING_INTELLIGENCE.md`. Do **not** hand-edit `blog.html`'s card grid
   or `blog-posts.js` directly; the next scheduled run overwrites both from
   the registry regardless.

4. **Commit and push the article + registry entry.**
   Suggested commit message format:
   `feat(blog): add <slug> — <short title>`. This alone does not publish
   anything — the article stays invisible until the Content Publishing
   Engine™ flips it live on its scheduled Tuesday/Thursday run. Pushing a
   change to `blog-posts.js` (which only the Engine itself ever produces)
   auto-fires the IndexNow workflow (`.github/workflows/indexnow-notify.yml`),
   which submits newly-live URLs to Bing, Yandex, and other participating
   search engines.

5. **Verify on production after the next scheduled publish run and Vercel deploy.**
   - Article URL renders.
   - It appears as a card on `/blog.html`.
   - The related-articles strip on the new article shows other articles
     (excluding itself).
   - Canonical, OG, and Twitter tags resolve to the right URL.

---

## Cadence

- **2 articles per week — Tuesday, Thursday, 9am ET.** Superseded the prior
  3×/week (Mon/Wed/Fri) cadence per the Content Publishing Engine™ (Phase 2)
  directive, 2026-08-03 — see `PUBLISHING_INTELLIGENCE.md` and
  `governance/CONTENT_PUBLISHING_ROOT_CAUSE_REPORT.md`. All future
  Education Library planning should assume Tue/Thu unless otherwise
  directed.
- **90-day initial run.** ~26 articles target.
- The schedule is what makes the SEO/AI-search compounding effect work. Hold
  the cadence even on weeks where it's tempting to skip.
- Release dates are enforced by the Content Publishing Engine™'s Autonomous
  Publishing Engine (see `PUBLISHING_INTELLIGENCE.md`), driven by
  `content-registry/articles/*.json`, not by manually merging on the day.

---

## Publishing Roadmap (Locked — 90-Day Plan)

This sequence is strategically designed to build topical authority, emotional progression, and SEO compounding. Do not reorder or substitute without approval.

### Strategic Funnel

- **Phase 1 — Awareness:** Artists realize "something about my royalties feels wrong."
- **Phase 2 — Education:** Artists learn metadata, publishing, MLC, SoundExchange, backend systems.
- **Phase 3 — Authority:** Royaltē becomes the company that understands invisible backend infrastructure.
- **Phase 4 — Conversion:** Artists think "I should probably check my setup."

### Locked Article Order

`content-registry/articles/*.json` is the canonical source of truth for
article order and metadata (`public/js/blog-posts.js` is generated from it,
not authored separately). This section is a human-readable summary — if the
two disagree, the registry wins.

**Live (5):**

- Your Music Isn't The Problem. Your Backend Might Be Broken.
- Why Your Spotify Streams Don't Match Your Money
- Using Suno AI? Read This Before Releasing Anything. — *AI Music & Royalties, Part 1 of 4*
- The Silent Money Leaks Killing Independent Artists — *AI Music & Royalties, Part 3 of 4*
- AI Didn't Kill Music—It Changed the Rules

**Board Review, not yet scheduled (1):**

- The 7 Metadata Mistakes That Could Be Costing You Music Royalties (PR #399)

**Scheduled — Publishing Batch #001, 2026-07-A (8):**

Built from 13 Board-approved Word documents; 1 excluded as a duplicate of PR #399, 4 blocked pending artwork (see below). Each is its own PR, individually reviewable, rollback-able, and merges automatically on its date via the scheduled-merge Action — see `PUBLISHING_INTELLIGENCE.md`.

- The Music Industry Runs on Data—Not Just Songs — 2026-07-24 (PR #401)
- AI Music Is Exploding—But Who Actually Owns the Rights? — 2026-07-27 (PR #402)
- The Hidden Cost of Bad Metadata: How One Wrong ISRC Could Cost You Thousands in Royalties — 2026-07-29 (PR #403)
- What Is SoundExchange? (And Why Every Artist Should Understand Its Role) — 2026-07-31 (PR #404, fulfills the `coming_soon` SoundExchange slot below)
- The 35-Year Copyright Rule: Can Artists Really Get Their Rights Back? — 2026-08-03 (PR #405)
- Streaming Pays More Than You Think—If Your Music Is Registered Everywhere — 2026-08-05 (PR #406)
- Why Artists Still Aren't Getting Paid Correctly in 2026 — 2026-08-07 (PR #407)
- Why Every Independent Artist Needs a Music Rights Audit — 2026-08-10 (PR #408)

**Blocked — awaiting approved artwork, not yet PR'd (4):**

- Is AI Stealing Artists' Music? AI Music Copyright Explained
- Five Revenue Streams Most Independent Artists Never Collect
- What Happens After You Leave a Record Label
- What The MLC Actually Does (And Why So Many Artists Miss It) — fulfills the `coming_soon` MLC slot below, once unblocked

**Queued in the registry as `coming_soon` (3, current `main` state):**

- The 7 Metadata Mistakes Killing Artist Royalties — superseded by PR #399 once merged
- What The MLC Actually Does (And Why So Many Artists Miss It) — superseded once the blocked article above is unblocked and PR'd
- SoundExchange Explained For Artists — superseded by PR #404 once merged

**AI Music & Royalties series** is a planned 4-part arc. Parts 1 and 3 are
live; Parts 2 and 4 are not yet written. Part 3 references the series
numbering, so a reader sees the gap until Part 2 ships — a known
content-pipeline follow-up, not a bug.

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

Each article requires a hero image at `public/blog/images/<slug>-hero.<ext>`
— `.jpg` or `.png` (most are `.jpg`; `your-backend-might-be-broken-hero.png`
is the one PNG). Articles render with a broken image placeholder if the file
is missing.

Current heroes run roughly 1536x1024 and 1660x948 — wide horizontal, but not
the 1.91:1 (1200x630) social-card standard. `og:image` / `twitter:image` on
each article point at its per-article hero, and the `og:image:width` /
`og:image:height` tags reflect each image's real dimensions. The 1.91:1
mismatch is known and kept consistent across all four articles; standardizing
hero dimensions would be a future image-standards refresh.

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

The mid-article and final CTAs are baked into `_template.html` and identical
across every article — never customise them per article (it breaks A/B
testing). CTA copy variants for future template-level changes are catalogued
in `/docs/blog-cta-variants.md` (12 variants, cold- and warm-reader); the warm
variants are post-beta and depend on a pricing page that does not yet exist.

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

- **`/sitemap.xml`** — done, and as of the Content Publishing Engine™ (Phase
  2), the article-URL section (marked by
  `<!-- CONTENT-PUBLISHING-ENGINE:SITEMAP_URLS:START/END -->`) is generated
  automatically on every publish run, not manually maintained. The
  non-article URLs (`/`, `/blog.html`, marketing pages) outside that marker
  region remain hand-maintained.
- **Filter-pill JS.** The pills on `/blog.html` are currently visual only.
  Once the article count grows past ~10, wire the filter to show/hide cards
  client-side based on `data-cat`.
- **Client-side JS-rendering of the landing-page grid** is **explicitly out
  of scope**, unchanged. The grid is static HTML for crawler/AI-search
  visibility — as of Phase 2 a script (`scripts/content-publishing/publish.mjs`)
  writes that static HTML from the registry at publish time instead of a
  person typing it, but it is never rendered client-side from
  `blog-posts.js` at runtime. Do not "DRY it up" into a client-side render.
- **Author bylines** — currently every article is published as Royaltē
  editorial. `content-registry/articles/<slug>.json` already carries a real
  `author` field on every entry; wire a byline block into `_template.html`
  when there's a real named author to credit.
