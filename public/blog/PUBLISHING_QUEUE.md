# Royaltē Publishing Queue

**As of Content Publishing Engine™ (Phase 2), the queue is `content-registry/articles/*.json` itself — not this file.** A hand-maintained table duplicating the registry is exactly the kind of second source of truth this redesign exists to eliminate (see `governance/CONTENT_PUBLISHING_ROOT_CAUSE_REPORT.md`); this document is now a pointer, not a tracking surface.

## To see what's queued right now

```
node -e "
  const { loadRegistry } = await import('./scripts/content-publishing/registry.mjs');
  const rows = loadRegistry()
    .filter(a => a.publishStatus === 'scheduled')
    .sort((a, b) => a.publishDate.localeCompare(b.publishDate));
  for (const a of rows) console.log(a.publishDate, '—', a.title, `(#${a.sourcePr ?? '—'})`);
"
```

Or just read the individual files directly — `content-registry/articles/<slug>.json`, one per article, `publishStatus`/`publishDate`/`approvalStatus` tell the whole story for that article.

## Historical queue (Phase 1, pre-migration) — preserved for the record

This table reflects the queue's last state under the old PR-label/PR-body scheduling mechanism, before the 2026-08-03 migration to the Content Registry™. It is no longer updated.

| Article | Publishing Batch | Scheduled Publish Date | Status (at time of migration) | PR |
|---|---|---|---|---|
| AI Didn't Kill Music—It Changed the Rules | _(none — pre-batch)_ | — | Published | [#398](https://github.com/Se7venlabs/Royalte/pull/398) |
| The 7 Metadata Mistakes That Could Be Costing You Music Royalties | _(none — pre-batch)_ | — | Board Review (migrated as pending) | [#399](https://github.com/Se7venlabs/Royalte/pull/399) |
| The Music Industry Runs on Data—Not Just Songs | 2026-07-A | 2026-07-24 | Published | [#401](https://github.com/Se7venlabs/Royalte/pull/401) |
| AI Music Is Exploding—But Who Actually Owns the Rights? | 2026-07-A | 2026-07-27 | Scheduled, content not yet merged | [#402](https://github.com/Se7venlabs/Royalte/pull/402) |
| The Hidden Cost of Bad Metadata | 2026-07-A | 2026-07-29 | Scheduled, content not yet merged | [#403](https://github.com/Se7venlabs/Royalte/pull/403) |
| What Is SoundExchange? | 2026-07-A | 2026-07-31 | Scheduled, content not yet merged | [#404](https://github.com/Se7venlabs/Royalte/pull/404) |
| The 35-Year Copyright Rule | 2026-07-A | 2026-08-03 | Scheduled, content not yet merged | [#405](https://github.com/Se7venlabs/Royalte/pull/405) |
| Streaming Pays More Than You Think | 2026-07-A | 2026-08-05 | Scheduled | [#406](https://github.com/Se7venlabs/Royalte/pull/406) |
| Why Artists Still Aren't Getting Paid Correctly in 2026 | 2026-07-A | 2026-08-07 | Scheduled | [#407](https://github.com/Se7venlabs/Royalte/pull/407) |
| Why Every Independent Artist Needs a Music Rights Audit | 2026-07-A | 2026-08-10 | Scheduled | [#408](https://github.com/Se7venlabs/Royalte/pull/408) |
| What The MLC Actually Does | 2026-07-A | 2026-08-12 | Scheduled | [#410](https://github.com/Se7venlabs/Royalte/pull/410) |
| Five Revenue Streams Most Independent Artists Never Collect | 2026-07-A | 2026-08-14 | Scheduled | [#411](https://github.com/Se7venlabs/Royalte/pull/411) |
| What Happens After You Leave a Record Label? | 2026-07-A | 2026-08-17 | Scheduled | [#412](https://github.com/Se7venlabs/Royalte/pull/412) |

All twelve rows above were migrated into `content-registry/articles/*.json` with their approval state and publish dates preserved exactly — see `scripts/content-publishing/migrate.mjs`.
