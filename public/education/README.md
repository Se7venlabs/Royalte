# Royaltē Education Library™ — Publishing Workflow

This directory holds long-form guide pages served at `/education/<slug>.html`.
The Education Library is **permanent platform infrastructure**, not a
one-off page for any single guide — it's the reference layer behind the
Knowledge Hub blog (`/blog/`): where the blog moves fast on single-topic
articles, the Education Library holds cornerstone, long-form guides meant to
stay accurate and get updated over years, not weeks.

This README is institutional memory for the publishing workflow. Read it
before adding a new guide.

---

## Education Library vs. the Knowledge Hub blog

Two separate content systems, sharing the same visual language:

| | Knowledge Hub (`/blog/`) | Education Library (`/education/`) |
|---|---|---|
| Content type | Single-topic articles, 4–10 min read | Cornerstone long-form guides, 20–60+ min read |
| Template | `/blog/_template.html` | `/education/_template.html` |
| Registry | `/public/js/blog-posts.js` | `/public/js/education-posts.js` |
| Landing page | `/blog.html` | `/education/index.html` |
| Structural components | Intro, H2 sections, mid/final CTA | + Table of Contents, chapter navigation, glossary, checklist, educational disclaimer |
| Cadence | 3×/week, Mon/Wed/Fri | No fixed cadence — published when a guide is ready |

Both reuse `.article-header` / `.article-intro` / `.article-body` prose
typography from `blog.css` — same Royaltē reading experience, same root
color/font tokens. `education.css` layers Education-Library-specific
structural components on top; it never redefines a token blog.css already
owns.

Both are publicly reachable and both run through the same **Royaltē
Publishing Intelligence™** scheduled-merge pipeline documented in
`/blog/PUBLISHING_INTELLIGENCE.md` — that document's mechanics (the
`scheduled` label, the `**Publish Date:**` PR-body line, the daily merge
Action, the "never self-schedule" rule) apply identically here. The
Action's file-scope safety rail is extended to cover `public/education/**`
and `public/js/education-posts.js` — see that file's own header comment for
the current scope regex.

---

## How to publish a new guide

1. **Duplicate the template.**
   Copy `/public/education/_template.html` to `/public/education/<slug>.html`.
   The slug must be lowercase, hyphen-separated, ASCII-only, and match the
   `slug` field in `education-posts.js`.

2. **Find-and-replace the tokens in the new file.** There are 11:

   | Token                     | Where it lands                                              |
   |---------------------------|-------------------------------------------------------------|
   | `{{GUIDE_TITLE}}`         | `<title>`, `<h1>`, OG title, Twitter title, JSON-LD headline |
   | `{{GUIDE_DESCRIPTION}}`   | `<meta name="description">`, OG/Twitter description, JSON-LD |
   | `{{GUIDE_SLUG}}`          | canonical URL, OG URL, JSON-LD URLs, related-guides JS exclusion key |
   | `{{GUIDE_CATEGORY}}`      | category pill in the guide header — must match a tile on `/education/index.html`, or `Cornerstone Guide` for a guide that spans every topic |
   | `{{GUIDE_DATE}}`          | ISO date in the meta line and JSON-LD (e.g. `2026-07-23`)   |
   | `{{GUIDE_READ_TIME}}`     | read-time badge (e.g. `52 min read`) — word count / 200wpm  |
   | `{{TOC_HTML}}`            | `<ol class="edu-toc-list">` — one `<li><a href="#anchor">` per top-level section |
   | `{{GUIDE_BODY}}`          | main body HTML — h2/h3/h4/p/ul/table/blockquote, chapter nav injected between sections |
   | `{{CHECKLIST_HTML}}`      | optional — delete the whole `<section id="checklist">` + wrapping `<div class="edu-checklist">` block if the guide has none |
   | `{{GLOSSARY_HTML}}`       | optional — delete the whole `<section id="glossary">` block + `{{GLOSSARY_HTML}}` line if the guide has none |
   | `{{DISCLAIMER_HTML}}`     | required on every guide — educational-disclaimer paragraph(s) |

   Do **not** edit the mid-article CTA, the final CTA, the nav, or the
   footer. Those are part of the Royaltē voice and stay identical across
   every guide, matching the blog convention.

3. **Prepend an entry to `/public/js/education-posts.js`.**
   Order is newest first. The object shape:

   ```js
   {
     title: "…",
     excerpt: "…",                 // 2–3 sentences, used on the landing page
     category: "Cornerstone Guide", // or a topic tile category
     date: "2026-07-23",
     readTime: "52 min read",
     slug: "complete-guide-to-music-royalties",
     url: "/education/complete-guide-to-music-royalties.html",
     status: "live",                // or "coming_soon"
     featured: true                 // true only for the current Featured Guide slot
   }
   ```

4. **Mirror the entry on `/education/index.html`.**
   Add it to the Featured Guide slot (only one guide holds this at a time),
   a topic tile's guide count, and/or the Recently Added grid, as
   appropriate. The landing page is intentionally hand-maintained HTML (not
   JS-rendered from `education-posts.js`) for the same crawler/AI-search
   visibility reason as `/blog.html` — do not "DRY it up" against the
   registry.

5. **Commit and push per the Publishing Intelligence™ workflow.**
   Open a PR with a `## Publishing Schedule` block (same format as blog
   PRs — see `/blog/PUBLISHING_INTELLIGENCE.md`). It stays unscheduled
   (`Status: Board Review`, no `scheduled` label) until the Board explicitly
   approves it with a publish date — guides are never self-scheduled, same
   hard rule as the blog.

6. **Verify on the Vercel Preview before merge, on production after.**
   - Guide URL renders, TOC anchors jump to the right sections, chapter
     nav prev/next links work.
   - It appears as a card on `/education/index.html`.
   - Related-guides strip renders (or shows the "more guides coming soon"
     empty state if this is the only guide).
   - Canonical, OG, Twitter, and both JSON-LD blocks resolve to the right
     URL.
   - No leftover `{{TOKEN}}` strings anywhere in the file
     (`grep '{{' public/education/<slug>.html` returns nothing).

---

## Reusability — this is infrastructure, not a one-off

The template, registry, and landing page were built generic on purpose so a
second, third, and tenth guide require **content only**, no new
architecture:

- `_template.html`'s chapter-nav and TOC generation both key off the
  guide's own `<h2 id="chapter-N">` anchors — any guide that follows the
  same "Chapter N — Title" heading convention gets working navigation for
  free, without touching the template.
- Checklist and glossary are optional per-guide (delete the block if unused)
  rather than mandatory — a shorter guide isn't forced into a fake checklist.
- The landing page's category tiles are the Education Library's own topic
  taxonomy (Publishing, Metadata, Copyright, Neighbouring Rights, Streaming,
  AI, Catalogs, Career Building) — independent of the blog's categories.
  Add a guide's category count when it fills a currently-empty tile.

## Reserved files — do not publish, do not link

- **`/public/education/_template.html`** — the source template. Never link
  to it, never reference it from the registry, never request the URL
  `/education/_template.html` in any context.
- **`/public/education/README.md`** — this file. Vercel will not serve
  `.md` files from `public/` under default routing, but treat it as
  internal docs anyway.

## Future enhancements

- **Author bylines** — not yet added, same deferred status as the blog.
- **Per-category landing pages** — the topic tiles on `/education/index.html`
  are currently visual-only markers ("Coming soon"); once several guides
  exist per topic, wire them to real filtered views.
- **Cross-linking with the blog** — the guide's "Continue Learning" lines
  reference blog article titles that don't exist as live pages yet (see
  `PUBLISHING_QUEUE.md`); resolve them to real links as those articles
  publish, following the same pattern used for the guide's own internal
  links.
