# Royaltē Publishing Intelligence™

Canonical documentation for scheduled blog publishing. This sits on top of
the base publishing workflow in `README.md` — read that first for how to
actually build an article (template, tokens, registry, blog.html card,
sitemap). This document covers everything added in Phase 1: the publishing
queue, the approval-then-schedule workflow, and the scheduled-merge GitHub
Action that automates the release step.

**Phase 1 scope, precisely:** this automates *when a PR merges*. It does not
touch article authoring, does not add a CMS, and does not change the
GitHub → `main` → Vercel deployment model. Everything that already happens
on a push to `main` (Vercel deploy, IndexNow notification) still happens
exactly the same way — the only new thing is a scheduled job that presses
"merge" on a human's behalf, on a date a human already chose.

---

## Why this design

The site is fully static — no CMS, no database, no server-rendered pages.
An article's HTML file either exists in the deployed `main` branch (public,
crawlable, live) or it doesn't (404). There is no in-between "exists but
hidden" state without adding real complexity (a date-gated client-side
filter, a server, etc.) — and both of those were explicitly rejected:

- A client-side date filter wouldn't hide anything from search crawlers
  (`blog.html` is deliberately hand-maintained, non-JS-rendered HTML, so
  crawlers that don't execute JS still see every card — see `README.md`),
  and the article's own HTML file would still be directly fetchable by URL
  before its scheduled date. It doesn't actually keep the content private.
- A CMS/backend would work, but is a materially bigger architectural change
  than this problem needs, and was explicitly ruled out by the Board.

So the only thing that actually needs to be time-gated is **the merge to
`main`** — because that's the one action that makes a static file public.
Everything upstream of that (writing, building the HTML, adding the hero
image, registering it, opening the PR, Board review on the Vercel Preview)
already happens today, unchanged. Phase 1 automates exactly one step.

---

## Status Lifecycle

The full conceptual lifecycle for an article:

```
Idea → Research → Writing → Board Review → Approved → Queued → Scheduled → Published → Indexed → Archived
```

Every article exists in exactly one of these states at a time — never two
at once, never an ambiguous in-between. The `Status` field in
`PUBLISHING_QUEUE.md` and the `**Status:**` field in the PR's Publishing
Schedule block are the single source of truth for that state.

What each stage means in practice today:

| Stage | Where it lives | Who/what moves it forward |
|---|---|---|
| Idea | Not yet in the repo | The Board proposes a topic |
| Research | Not yet in the repo | Topic/angle validated before writing begins |
| Writing | Not yet in the repo | Article + hero image are drafted |
| **Board Review** | Open PR, no `scheduled` label | I build the HTML/registry/queue entry and open a PR. This is where PR #398 and #399 started. |
| Approved | Open PR, Board has signed off in conversation but scheduling hasn't been applied yet | A brief, momentary state between review and the label being added |
| Queued | `PUBLISHING_QUEUE.md` row exists | Effectively merges with Board Review/Approved today — the queue table is the single tracking surface, there's no separate "queued but not yet approved" state in Phase 1 |
| **Scheduled** | Open PR, `scheduled` label + `**Publish Date:**` line present | The scheduled-publish Action will merge it once the date arrives |
| **Published** | Merged to `main`, live on royalte.ai | The scheduled-publish Action (or a manual `gh pr merge`) |
| Indexed | No separate tracking | Happens automatically — pushing the registry change to `main` fires `.github/workflows/indexnow-notify.yml`, which submits the new URL to Bing/Yandex within the same push. Not tracked as a distinct queue state because it's not a distinct action anyone takes. |
| Archived | Not yet applicable | No article has been archived; this stage is reserved for a future need (e.g. retiring a stale article) |

The Queue table (`PUBLISHING_QUEUE.md`) tracks the bolded stages above —
**Board Review**, **Scheduled**, and **Published** — since those are the
ones that correspond to a real, distinguishable state of a PR. Idea/
Research/Writing happen before anything is in the repo; Indexed/Archived
aren't separately actioned today.

---

## Executive Board Approval Workflow

**Articles are never scheduled automatically.** The workflow is strictly:

```
Draft → Board Approval → Queue → Scheduled Merge → Published
```

Concretely:

1. An article is built and PR'd exactly as described in `README.md` —
   this alone puts it in **Board Review**, nothing more. No PR is ever
   opened with the `scheduled` label already attached.
2. The Board reviews the Vercel Preview and, in conversation, approves the
   article **and gives it an explicit publish date**.
3. Only after that explicit approval does a human (today: me, on the
   Board's instruction) do two things to the PR:
   - Add the `scheduled` label.
   - Add a `## Publishing Schedule` block to the PR body (see the Publication
     Metadata Standard below) with `**Status:** Scheduled` and the approved
     `**Publish Date:**`.
4. `PUBLISHING_QUEUE.md` is updated to reflect the new status and date.
5. From that point on, the scheduled-publish Action owns the release — no
   further manual step is needed unless something needs to change (see
   Reschedule/Cancel below).

The Action itself never adds the `scheduled` label, never invents a date,
and never merges anything that isn't already labeled and dated. It only
asks "is this labeled PR's date here yet?" — the decision to schedule is
made entirely by a human, upstream of anything the Action can see.

---

## Publication Metadata Standard

Every blog PR should include a `## Publishing Schedule` block in its PR
body with these eight fields — designed so future fields can be appended
without changing anything the Action already parses (it only ever reads
`**Publish Date:**`; every other field, including `Publishing Batch`, is
for human/audit/reporting use only):

```markdown
## Publishing Schedule
- **Article Title:** The 7 Metadata Mistakes That Could Be Costing You Music Royalties
- **URL Slug:** `metadata-mistakes-killing-royalties`
- **Status:** Board Review
- **Publish Date:** _(not yet assigned)_
- **PR Number:** #399
- **Publishing Batch:** _(none — pre-batch article)_
- **Created Date:** 2026-07-23
- **Last Updated:** 2026-07-23
```

Once the Board approves and assigns a date, `Status` becomes `Scheduled`,
`Publish Date` is filled in as `YYYY-MM-DD`, and `Last Updated` is bumped to
the date of that edit:

```markdown
## Publishing Schedule
- **Article Title:** The 7 Metadata Mistakes That Could Be Costing You Music Royalties
- **URL Slug:** `metadata-mistakes-killing-royalties`
- **Status:** Scheduled
- **Publish Date:** 2026-08-05
- **PR Number:** #399
- **Publishing Batch:** _(none — pre-batch article)_
- **Created Date:** 2026-07-23
- **Last Updated:** 2026-07-30
```

`Created Date` is set once, when the PR opens, and never changes. `Last
Updated` is bumped on every edit to the block (status change, reschedule,
cancellation) — it's the field to check first when auditing why an
article's state changed.

### Publishing Batch ID

Articles delivered together as a named batch (e.g. "Batch #001," six
articles for August/September) share a **Publishing Batch** value so they
can be reported on and managed as a group later, without changing anything
about how any individual article is scheduled or merged — each PR is still
independently labeled, dated, reviewed, and merged on its own. The Action
does not read this field at all; it exists purely for grouping/reporting.

**Format:** `YYYY-MM-<letter>`, e.g. `2026-08-A`. Increment the letter if a
second batch ships within the same calendar month (`2026-08-B`, etc.).
Articles built before batching existed (PR #398, #399) carry
`_(none — pre-batch article)_` rather than being retroactively assigned a
batch they weren't actually part of.

**The exact string `**Publish Date:**` followed by an ISO date
(`YYYY-MM-DD`) is what the Action's parser looks for.** Do not reformat this
line — the Action does a literal regex match against it
(`\*\*Publish Date:\*\*\s*\K\d{4}-\d{2}-\d{2}`). If the `scheduled` label is
present but this line is missing or malformed, the Action logs a
`::warning::` and skips the PR rather than guessing — it will keep showing
up as skipped on every daily run until the line is fixed.

---

## How the GitHub Action decides when to merge

`.github/workflows/scheduled-publish.yml`, runs once daily (13:00 UTC) plus
on-demand via `workflow_dispatch`:

1. Lists open PRs with the `scheduled` label.
2. For each one, extracts the `**Publish Date:**` line from the PR body.
3. If today (UTC) is on or after that date, it checks the PR's changed
   files are all confined to the blog content surface (`public/blog/**`,
   `public/js/blog-posts.js`, `public/sitemap.xml`) — a safety rail so this
   automation can never merge something outside its intended scope, even if
   the `scheduled` label were ever misapplied to an unrelated PR.
4. If in scope, it runs the same `gh pr merge --rebase --delete-branch`
   used for every manual merge in this repo. Branch protection's required
   `Run pipeline test` check still gates this exactly as it would a manual
   merge — the Action cannot and does not bypass it.
5. A successful merge triggers Vercel's existing push-to-main deploy and the
   existing IndexNow workflow automatically — the Action does not call
   either of those itself.

The Action never merges a PR whose date hasn't arrived yet, never merges an
unlabeled PR, and fails loudly (a red workflow run, `::error::` annotated)
rather than silently if a scheduled merge can't complete.

---

## How to queue an article

1. Build and PR the article as usual (`README.md`).
2. Add the `## Publishing Schedule` block to the PR body with
   `**Status:** Board Review` and no publish date yet.
3. Add a row to `PUBLISHING_QUEUE.md`.

## How to assign a publication date / approve an article

This only happens after the Board explicitly approves the article and gives
a date, in conversation. Once approved:

1. Update the PR body's `## Publishing Schedule` block: `**Status:**
   Scheduled`, `**Publish Date:** YYYY-MM-DD`.
2. Add the `scheduled` label to the PR.
3. Update the `PUBLISHING_QUEUE.md` row to match.

## How to cancel or reschedule an article

- **Reschedule:** edit the `**Publish Date:**` line in the PR body to the
  new date. The label stays. Update the queue row. No workflow changes
  needed — the Action reads the date fresh on every run.
- **Cancel:** remove the `scheduled` label from the PR. The Action only ever
  looks at labeled PRs, so an unlabeled PR is inert regardless of what its
  body says. Update the queue row's status back to `Board Review` (or close
  the PR entirely if the article itself is being scrapped).

## Recovery procedures if a scheduled merge fails

A failed merge attempt makes the `scheduled-publish` workflow run fail (red
X) with an `::error::` annotation naming the PR and the likely cause:

- **Required check ("Run pipeline test") isn't green.** Look at the PR's
  checks tab, fix whatever's failing, push a fix commit. The PR stays
  labeled and dated — the next daily run (or a manual
  `workflow_dispatch`) will pick it up automatically once checks pass. No
  need to re-add the label or re-enter the date.
- **Merge conflict with `main`.** Rebase the branch locally, push, and the
  next run will retry.
- **PR touches files outside the blog content surface.** The Action refuses
  to merge and errors loudly rather than merging something out of scope.
  Either split the PR so the out-of-scope change ships separately, or (if
  the extra files are genuinely part of this publish) treat that as a
  signal to merge manually with `gh pr merge` after manual review, rather
  than relying on the automation.
- **Nothing happens at all / no run appears.** Check the Actions tab for
  `Scheduled Blog Publish` — confirm the cron actually fired (GitHub can
  delay scheduled workflows under load) or trigger it manually via
  `workflow_dispatch` to force an immediate check.

The Action never auto-retries within a single run and never force-bypasses
branch protection — every failure surfaces as a visible, actionable signal
rather than a silent skip or an unsafe override.

## Manual override procedures

Scheduled merging is a convenience, not the only path — a human can always
merge a blog PR the normal way (`gh pr merge <N> --rebase --delete-branch`,
same as any other PR in this repo) without waiting for the Action, for
example if an article needs to go out same-day.

To manually publish ahead of schedule:

1. Confirm the PR's required checks are green.
2. Run `gh pr merge <N> --rebase --delete-branch` directly. This is exactly
   what the Action would eventually do — there's no separate "override
   mode," just doing the same action a run early.
3. Update `PUBLISHING_QUEUE.md` to `Published` and update the PR's
   `**Status:**`/`**Last Updated:**` fields (the PR is closed at this point,
   so this is for the historical record — edit the merged PR's description
   if it needs to stay accurate).

There is no separate mechanism to force the Action itself to merge early —
manual merge is the override, by design, so there's exactly one merge
code path to reason about rather than two.

## Emergency rollback procedures

If an article is published in error (wrong content, factual error, legal
concern) after a merge:

1. **Take the article down first, investigate after.** Revert the merge
   commit on `main` (`git revert <merge-sha>`, PR'd and merged the normal
   way — do not force-push `main`) to remove the article file, its registry
   entry, and its `blog.html` card in one atomic change. This redeploys via
   the existing Vercel push-to-main path exactly like a normal publish.
2. **IndexNow has no "un-notify."** The URL was already submitted to search
   engines; there's no retraction call. Once the article is pulled, the URL
   will 404 and search engines will drop it from their index on their own
   recrawl schedule — this is a real, known limitation, not something this
   automation can fix. If speed matters, use each search engine's own URL
   removal tool (e.g. Google Search Console) directly — outside the scope
   of this repo's automation.
3. **Update `PUBLISHING_QUEUE.md`** — mark the row `Archived` (not
   `Published`) with a note on why, rather than deleting the row, so the
   queue keeps an honest history.
4. **Re-publishing a corrected version** goes through the normal pipeline
   from `Board Review` again — it is a new PR, not a resurrection of the
   old one.

---

## Standard Operating Procedure — this is the default from here on

Once Phase 1 merges, this pipeline is the standing publishing process for
every Royaltē article, not a one-off. A future publishing request only
needs to supply: the completed article, a hero image, and a desired
publication date. Everything else — building the HTML, registering it,
writing the SEO metadata, opening the PR, adding the Publishing Schedule
block, updating the queue, and (once the Board approves a date) labeling
and scheduling it — follows this document by default, without needing a
fresh implementation brief each time. A new brief is only needed if the
Board is explicitly revising the publishing standard itself, not for
routine article submissions.

## Future Roadmap (not part of Phase 1)

Approved conceptually, explicitly out of scope for this phase:

- **Phase 2** — Editorial calendar, content dashboard, publishing
  dashboard, calendar view.
- **Phase 3** — Automatic social media package generation, newsletter
  draft generation, press release generation, content distribution
  tracking.
- **Phase 4** — SEO performance dashboard, Google index verification,
  search ranking monitoring, content analytics, internal link health,
  content refresh recommendations.
- **Phase 5** — Publishing Intelligence™ Dashboard: executive visibility
  into upcoming releases, published articles, the publishing queue, SEO
  status, index status, social distribution status, content performance,
  and the editorial pipeline as a whole.

`PUBLISHING_QUEUE.md` is deliberately a flat Markdown table for now — a
dashboard is a Phase 5 evolution, not a Phase 1 requirement.
