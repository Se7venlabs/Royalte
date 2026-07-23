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
Idea → Writing → Board Review → Approved → Queued → Scheduled → Published → Indexed → Archived
```

What each stage means in practice today:

| Stage | Where it lives | Who/what moves it forward |
|---|---|---|
| Idea | Not yet in the repo | The Board or a content brief |
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
ones that correspond to a real, distinguishable state of a PR. Idea/Writing
happen before anything is in the repo; Indexed/Archived aren't separately
actioned today.

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
body with these five fields:

```markdown
## Publishing Schedule
- **Article Title:** The 7 Metadata Mistakes That Could Be Costing You Music Royalties
- **URL Slug:** `metadata-mistakes-killing-royalties`
- **Status:** Board Review
- **Publish Date:** _(not yet assigned)_
- **PR Number:** #399
```

Once the Board approves and assigns a date, `Status` becomes `Scheduled` and
`Publish Date` is filled in as `YYYY-MM-DD`:

```markdown
## Publishing Schedule
- **Article Title:** The 7 Metadata Mistakes That Could Be Costing You Music Royalties
- **URL Slug:** `metadata-mistakes-killing-royalties`
- **Status:** Scheduled
- **Publish Date:** 2026-08-05
- **PR Number:** #399
```

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

---

## Future Roadmap (not part of Phase 1)

Approved conceptually, explicitly out of scope for this phase: editorial
calendar, publishing dashboard, social media automation, newsletter
automation, post-publish analytics, search ranking reports, content
performance intelligence. `PUBLISHING_QUEUE.md` is deliberately a flat
Markdown table for now — a dashboard is a future evolution, not a Phase 1
requirement.
