# Royaltē Publishing Intelligence™ — Publishing Queue

Hand-maintained. Update this table whenever an article's status changes —
when a PR opens, when the Board approves and schedules it, and when it
publishes. This is the at-a-glance view; `PUBLISHING_INTELLIGENCE.md` is the
canonical process documentation.

| Article | Publishing Batch | Scheduled Publish Date | Status | PR | Assigned Branch |
|---|---|---|---|---|---|
| AI Didn't Kill Music—It Changed the Rules | _(none — pre-batch)_ | — | Published | [#398](https://github.com/Se7venlabs/Royalte/pull/398) | _(merged, branch deleted)_ |
| The 7 Metadata Mistakes That Could Be Costing You Music Royalties | _(none — pre-batch)_ | — | Board Review | [#399](https://github.com/Se7venlabs/Royalte/pull/399) | `content/metadata-mistakes-blog-post` |

**Status values:** `Draft` · `Board Review` · `Approved` · `Scheduled` · `Published`

(Full conceptual lifecycle, including `Idea`/`Writing` upstream of `Draft` and
`Indexed`/`Archived` downstream of `Published`, is defined in
`PUBLISHING_INTELLIGENCE.md` §Status Lifecycle. This table tracks the subset
the queue and the scheduled-merge Action actually act on.)

PR #399 is open and passing CI but has not yet been assigned a publish date —
per the Executive Board Approval Workflow, it will move to `Scheduled` only
once the Board approves it with an explicit date, at which point the
`scheduled` label and a `**Publish Date:**` line get added to its PR body.

Every article exists in exactly one status at a time — this table's `Status`
column and the matching `**Status:**` field in the PR's Publishing Schedule
block are kept as the single source of truth for that article's current
state; there is no article tracked in two places with two different
statuses.
