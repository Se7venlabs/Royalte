# Royaltē Publishing Intelligence™ — Content Publishing Engine™ (Phase 2)

Canonical documentation for scheduled blog/education publishing. This sits on top of the base publishing workflow in `README.md` — read that first for how to actually build an article (template, tokens, hero image). This document covers the release step: how an approved, scheduled article actually goes live.

**Phase 2 supersedes Phase 1's PR-merge-based scheduler outright** (not a fallback — that mechanism is removed). Phase 1's approach (a `scheduled` label + a `**Publish Date:**` PR-body block, merged by a daily GitHub Action) got permanently stuck when independently-scheduled PRs shared the same insertion point in `blog.html`/`blog-posts.js`/`sitemap.xml` and diverged from a common base — see `governance/CONTENT_PUBLISHING_ROOT_CAUSE_REPORT.md` for the full incident. Phase 2 is state-driven instead: a **Content Registry™** (`content-registry/articles/*.json`) is the single source of truth for approval and scheduling, and an **Autonomous Publishing Engine™** (`scripts/content-publishing/publish.mjs`) regenerates every listing surface from that registry on a Tuesday/Thursday schedule — no PR, no merge, no rebase, structurally immune to the class of conflict that broke Phase 1.

Everything downstream of a successful run is unchanged: Vercel's push-to-`main` deploy and `.github/workflows/indexnow-notify.yml` still fire exactly as before.

---

## Why this design

The site is fully static — no CMS, no database, no server-rendered pages. An article's HTML file either exists in the deployed `main` branch (public, crawlable, live) or it doesn't (404). Article content itself still merges via a normal, human-reviewed PR — that part of the model never needed to change, since each article is a uniquely-named new file that never conflicted with another. What needed to change was *only* the shared listing surfaces (the card grid, the JS registry, the sitemap) — the files every scheduled article's old-style PR also had to touch, and the actual source of the conflict.

## Status Lifecycle

```
draft → (Board approval) → scheduled → published → archived
```

Tracked in `content-registry/articles/<slug>.json` via two separate fields — `approvalStatus` (`pending`/`approved`, a one-time Board sign-off) and `publishStatus` (`draft`/`scheduled`/`published`/`archived`, the lifecycle the Engine drives). An article is eligible to go live when `approvalStatus === 'approved' && publishStatus === 'scheduled' && publishDate <= today`. See `content-registry/README.md` for the full schema.

A `pending`/`draft` article never appears on any public page, not even as a "coming soon" teaser — only `approved` articles do.

## How to queue an article

1. Build and PR the article as usual (`README.md`) — a normal, human-reviewed content PR.
2. Add `content-registry/articles/<slug>.json` with `approvalStatus: "pending"`, `publishStatus: "draft"`. Either the same PR or a follow-up — both are fine, they're independent files.
3. `.github/workflows/content-validation.yml` lints the registry on every PR touching `content-registry/**` — required fields, valid slug, no duplicate slugs, and (for any already-`published` entry) that its content file actually exists.

## How to approve and schedule an article

Only after the Board explicitly approves the article and gives a date, in conversation:

1. Edit `content-registry/articles/<slug>.json`: `approvalStatus: "approved"`, `publishStatus: "scheduled"`, `publishDate: "YYYY-MM-DD"`.
2. Commit and push (or merge via PR, same as any other file). No label, no PR body block — the registry entry itself is the schedule.
3. The next Tuesday/Thursday run picks it up automatically once its date arrives, **provided the article's own content file has already merged to `main`**. If the content PR hasn't merged yet by the publish date, the Engine skips it, logs a `publish_failed` event in `content-registry/history.jsonl`, and retries on the next run — it never fabricates a publish it can't actually perform.

## How to cancel or reschedule an article

- **Reschedule:** edit `publishDate` in the registry entry. No workflow changes needed — the Engine reads the registry fresh on every run.
- **Cancel:** set `publishStatus` back to `"draft"` (or delete the registry file entirely if the article itself is being scrapped — the content file, if merged, is left in place but simply won't appear in any generated listing while its registry entry says `draft`).

## How the Autonomous Publishing Engine decides what to publish

`.github/workflows/scheduled-publish.yml`, runs Tuesday and Thursday (13:00 UTC / 9am ET) plus on-demand via `workflow_dispatch`:

1. Runs `scripts/content-publishing/publish.mjs`, which loads every `content-registry/articles/*.json`, filters to `approvalStatus === 'approved' && publishStatus === 'scheduled' && publishDate <= today`.
2. For each eligible article, confirms its `contentPath` file actually exists. If yes: flips `publishStatus: 'published'`, sets `publishedAt`. If no: leaves it `scheduled`, logs a failure, moves on — this article will be retried automatically on the next run.
3. Regardless of whether anything was newly published, **fully regenerates** every derived artifact (`blog.html`'s card region, `education/index.html`'s equivalent, `blog-posts.js`, `education-posts.js`, `sitemap.xml`'s article section, `rss.xml`, `search-index.json`) from the complete current registry state — never an incremental patch, which is what makes re-running always safe.
4. Appends one `content-registry/history.jsonl` line per attempt, including "ran, nothing was due."
5. If anything actually changed on disk, commits to a fresh single-purpose branch (`content-publish/run-<run-id>`), pushes it, opens a PR, waits for every check on it to go green (`gh pr checks --watch --fail-fast`), then merges it (`gh pr merge --rebase --delete-branch`). Not a direct push — a real `git push origin HEAD:main` was tried first and rejected by `main`'s branch protection, which enforces its required `Run pipeline test` check against direct pushes too, not only PR merges (see `governance/CONTENT_PUBLISHING_FINAL_CERTIFICATION.md` §8). Opening the PR itself needs one more repo-level permission (`can_approve_pull_request_reviews`, distinct from this workflow's own token scopes) — see `governance/CONTENT_PUBLISHING_AUTHENTICATION_MODEL.md` for exactly what that grants and what stays unchanged (branch protection, required checks, no required-review rule). The Engine never approves its own PR — nothing requires it to, since `main` has no required-review rule.
6. That merge triggers Vercel's existing deploy and `.github/workflows/indexnow-notify.yml` exactly as any other push touching `blog-posts.js`/`education-posts.js` would.

The Engine never publishes an article whose date hasn't arrived, never publishes an unapproved article, and never loses track of a failed attempt — it stays `scheduled` and is retried, logged every time.

## Recovery procedures if a scheduled publish fails

Check `content-registry/history.jsonl` for the most recent `publish_failed` event for the article's slug — the `reason` field states exactly what blocked it (today, only one cause is possible: `contentPath does not exist`, meaning the article's own content PR hasn't merged yet). Merge that content PR; the article publishes automatically on the next Tuesday/Thursday run, or trigger `workflow_dispatch` to force an immediate retry without waiting.

The Engine never auto-retries within a single run and never silently drops a failure — every attempt is a real, permanent line in Publication History™.

## Manual override procedures

A human can always run `node scripts/content-publishing/publish.mjs` locally (or trigger `workflow_dispatch`) to force an immediate check without waiting for the Tuesday/Thursday cron — there's no separate "override mode," the manual path and the scheduled path are the identical script.

## Emergency rollback procedures

If an article is published in error (wrong content, factual error, legal concern):

1. **Take the article down first, investigate after.** Edit `content-registry/articles/<slug>.json` back to `publishStatus: "draft"` (or `"archived"`) and re-run `publish.mjs` (or wait for the next scheduled run) — the article disappears from every generated listing surface on the next regeneration. Its content file can be reverted or fixed via a normal PR separately.
2. **IndexNow has no "un-notify."** The URL was already submitted; there's no retraction call. Once the article drops from `sitemap.xml`/`blog-posts.js`, search engines will drop it from their index on their own recrawl schedule. For urgency, use each search engine's own URL removal tool directly (e.g. Google Search Console) — outside the scope of this repo's automation.
3. **The registry entry and its full Publication History stay** — set `publishStatus: "archived"` rather than deleting the registry file, so the record of what happened and when is never lost.
4. **Re-publishing a corrected version** is a new content PR plus (if the slug changes) a new registry entry — not a resurrection of the old one.

---

## Future Roadmap (not part of Phase 2)

Approved conceptually, explicitly out of scope for this phase — unchanged from Phase 1's own deferral list:

- Editorial calendar, content dashboard, calendar view.
- Automatic social media package generation, newsletter draft generation, press release generation, content distribution tracking.
- SEO performance dashboard, Google index verification, search ranking monitoring, content analytics, internal link health, content refresh recommendations.
- **Mission Control dashboard integration** — `content-registry/history.jsonl` is the durable data source a future Mission Control card would read; no such card exists yet, and building one wasn't requested this phase.
- **Search UI** — `public/search-index.json` is generated as real, structured data every publish run; no query interface consumes it yet. Building one wasn't requested this phase.
