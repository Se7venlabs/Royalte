# Content Publishing — Root Cause & Recovery Report

Branch: `feat/content-publishing-engine`

---

## 1. Symptom

The Tuesday/Thursday (documented as Mon/Wed/Fri at the time) publishing cadence had silently stalled — no new blog article had gone live since 2026-07-24, despite ten articles sitting fully written and scheduled behind it.

## 2. Investigation

**The scheduler was running correctly.** `gh run list --workflow=scheduled-publish.yml` showed the old `.github/workflows/scheduled-publish.yml` firing on schedule every day since 2026-07-25, without exception.

**Every run failed identically.** `gh run view <id> --log` on the most recent failures showed the same error, repeated for PRs #402, #403, #404:

```
Pull request Se7venlabs/Royalte#404 is not mergeable: the merge commit cannot be cleanly created.
```

**Confirmed via direct API, not just the log.** `gh api repos/Se7venlabs/Royalte/pulls/<n> -q '{mergeable, mergeable_state}'` returned `{"mergeable": false, "mergeable_state": "dirty"}` for every one of the ten open, scheduled blog PRs (`#402`–`#412`) — a real git conflict, not a transient GitHub computation lag.

**Root cause, confirmed via `git merge-tree`**: every one of those ten PR branches was cut from the same commit (`809437a`, "Add Publishing Batch ID support ahead of Batch #001", 2026-07-23 09:59), *before* two other articles (`5cf9125`, `edaeace`) merged later that same day and modified the exact same insertion point in three shared files every PR also touches: `public/blog.html`'s card grid, `public/js/blog-posts.js`, `public/sitemap.xml`. None of the ten branches were ever rebased onto `main` after that point, so every one of them — not just the first to attempt merging — conflicts with `main` on the same lines.

**This was not a one-off.** Once any PR touching those shared files merges, every other PR still branched from before that point becomes unmergeable without a manual rebase. The old workflow had no rebase step and no mechanism to detect or recover from this — it would retry forever, failing identically, until a human intervened.

## 3. Why this kept getting worse, not just staying broken

Every day the scheduler ran and failed, the backlog grew by one more scheduled-but-blocked article, and the underlying divergence between the stuck branches and `main` only widened as unrelated work continued to land. The failure was self-reinforcing: the very fact that publishing was stuck meant nothing ever merged to make the ten branches' base current again.

**A second, larger instance of the identical pattern was found during the same investigation**: the entire Education Library (`public/education/`, `public/js/education-posts.js`, its own governance docs) does not exist on `main` at all — it exists only across three mutually-divergent, unmerged branches, stuck behind the same shared-file-conflict problem before a single Education article ever went live.

## 4. Disposition — architectural, not a patch

A minimal fix (manually rebase the ten stuck branches) would have cleared the immediate backlog but left the underlying architecture — N independent branches racing to edit the same shared files — fully intact, guaranteed to recur and worsen as content volume grows. The Executive Board authorized a redesign instead: **Content Publishing Engine™**, replacing merge-driven publishing with state-driven publishing.

Full architecture: `content-registry/README.md`. Summary: a per-article JSON registry (`content-registry/articles/<slug>.json`, one file per article — never a shared array, so the registry itself can't reintroduce the same conflict class) is the single source of truth for approval and scheduling; a new Autonomous Publishing Engine (`scripts/content-publishing/publish.mjs`) runs Tuesday/Thursday, reads the registry, and **fully regenerates** every derived listing surface (cards, `blog-posts.js`, sitemap, RSS, search index) from current registry state, then commits directly to `main` — no PR, no merge, no rebase, structurally immune to this failure mode. Article content itself still merges via a normal, human-reviewed PR (each article is a uniquely-named new file, which never conflicted in the first place — only the shared listing files did).

## 5. Migration outcome

The 8 already-live blog articles and 10 stuck-but-real scheduled articles were migrated into the new registry with their original data and Board-approved publish dates preserved (`scripts/content-publishing/migrate.mjs`). The 10 scheduled articles' actual content still needs its own normal PR merge (now trivially conflict-free, since content PRs never touch the shared listing files under the new architecture) before each can go live — the registry entry alone doesn't publish anything; `publish.mjs`'s own `contentPath` existence check enforces that honestly, skipping and logging (never fabricating) a publish it can't actually perform.

The Education Library's three-way branch divergence was **not** auto-resolved as part of this work — reconciling which of three independently-diverged, unmerged copies of the same content is authoritative requires human judgment a script should not guess at, given the real risk of silently dropping content. The registry/engine is fully ready to accept Education entries the moment that reconciliation happens; the reconciliation itself is called out as a separate, follow-up task.

## 6. Verification

- `tests/content-publishing-test.mjs` — 28/28 passing (schema, rendering, registry, validation, publish/recovery/idempotency).
- Full existing regression suite — zero regressions (this work touches no `api/` code).
- Local dry-run of `publish.mjs` against the fully migrated registry, diffed against `main`: correctly identified the 4 currently-overdue articles (content not yet merged) as failed/retry, correctly regenerated all listing surfaces, correctly found and fixed two pre-existing sitemap gaps (`music-licensing-types-explained.html` and `the-backend-infrastructure-powering-modern-music.html` were live articles missing from the old hand-maintained sitemap).
- A full end-to-end success-path dry run (temporarily copying one real article's content into place, running `publish.mjs`, confirming it correctly flipped to `published` and appeared live in every generated surface, then reverting the simulated merge) confirmed the recovery path works before this report was written, not just in theory.
