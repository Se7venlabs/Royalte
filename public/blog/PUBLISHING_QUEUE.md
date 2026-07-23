# Royaltē Publishing Intelligence™ — Publishing Queue

Hand-maintained. Update this table whenever an article's status changes —
when a PR opens, when the Board approves and schedules it, and when it
publishes. This is the at-a-glance view; `PUBLISHING_INTELLIGENCE.md` is the
canonical process documentation.

| Article | Publishing Batch | Scheduled Publish Date | Status | PR | Assigned Branch |
|---|---|---|---|---|---|
| AI Didn't Kill Music—It Changed the Rules | _(none — pre-batch)_ | — | Published | [#398](https://github.com/Se7venlabs/Royalte/pull/398) | _(merged, branch deleted)_ |
| The 7 Metadata Mistakes That Could Be Costing You Music Royalties | _(none — pre-batch)_ | — | Board Review | [#399](https://github.com/Se7venlabs/Royalte/pull/399) | `content/metadata-mistakes-blog-post` |
| The Music Industry Runs on Data—Not Just Songs | 2026-07-A | 2026-07-24 | Scheduled | [#401](https://github.com/Se7venlabs/Royalte/pull/401) | `content/music-industry-runs-on-data` |
| AI Music Is Exploding—But Who Actually Owns the Rights? | 2026-07-A | 2026-07-27 | Scheduled | [#402](https://github.com/Se7venlabs/Royalte/pull/402) | `content/ai-music-is-exploding` |
| The Hidden Cost of Bad Metadata: How One Wrong ISRC Could Cost You Thousands in Royalties | 2026-07-A | 2026-07-29 | Scheduled | [#403](https://github.com/Se7venlabs/Royalte/pull/403) | `content/hidden-cost-of-bad-metadata` |
| What Is SoundExchange? (And Why Every Artist Should Understand Its Role) | 2026-07-A | 2026-07-31 | Scheduled | [#404](https://github.com/Se7venlabs/Royalte/pull/404) | `content/soundexchange-explained` |
| The 35-Year Copyright Rule: Can Artists Really Get Their Rights Back? | 2026-07-A | 2026-08-03 | Scheduled | [#405](https://github.com/Se7venlabs/Royalte/pull/405) | `content/35-year-copyright-rule` |
| Streaming Pays More Than You Think—If Your Music Is Registered Everywhere | 2026-07-A | 2026-08-05 | Scheduled | [#406](https://github.com/Se7venlabs/Royalte/pull/406) | `content/streaming-pays-more-than-you-think` |
| Why Artists Still Aren't Getting Paid Correctly in 2026 | 2026-07-A | 2026-08-07 | Scheduled | [#407](https://github.com/Se7venlabs/Royalte/pull/407) | `content/why-artists-arent-getting-paid-2026` |
| Why Every Independent Artist Needs a Music Rights Audit | 2026-07-A | 2026-08-10 | Scheduled | [#408](https://github.com/Se7venlabs/Royalte/pull/408) | `content/music-rights-audit` |
| Is AI Stealing Artists' Music? AI Music Copyright Explained | 2026-07-A | — | **Blocked — awaiting image** | _(not yet opened)_ | _(not yet created)_ |
| Five Revenue Streams Most Independent Artists Never Collect | 2026-07-A | — | **Blocked — awaiting image** | _(not yet opened)_ | _(not yet created)_ |
| What Happens After You Leave a Record Label | 2026-07-A | — | **Blocked — awaiting image** | _(not yet opened)_ | _(not yet created)_ |
| What The MLC Actually Does (And Why So Many Artists Miss It) | 2026-07-A | — | **Blocked — awaiting correct image** | _(not yet opened)_ | _(not yet created)_ |

**Status values:** `Draft` · `Board Review` · `Approved` · `Scheduled` · `Published` · `Blocked — awaiting image`

**Batch #001 progress: 8 of 13 delivered articles built and scheduled (2026-07-24 through 2026-08-10, Mon/Wed/Fri cadence). 1 excluded as a duplicate of PR #399. 4 remain blocked on artwork** — see governance note below.

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
