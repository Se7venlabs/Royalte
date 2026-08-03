# Content Publishing Engine™ — Executive Board Acceptance Review

PR: #454
Classification: Executive Board Acceptance Review (Mandatory Before Merge)
Status: **DO NOT MERGE** pending Board certification of the findings below

This document works through the Board's ten required areas in order. Two real defects were found and fixed during this review (FIX AS WE GO™, applied to the review process itself, not just the original implementation). Two governance questions are surfaced for explicit Board decision rather than resolved unilaterally — this review's job is to give the Board accurate information to certify against, not to make governance policy on the Board's behalf.

---

## 1. Architecture Validation

**Is there exactly one canonical source of truth?** Yes — `content-registry/articles/<slug>.json`. Confirmed by direct grep: every write to a generated artifact (`blog.html`'s marker region, `blog-posts.js`, `sitemap.xml`'s marker region, `rss.xml`, `search-index.json`) originates from `render.mjs`'s pure functions, which take only the registry's in-memory article list as input — no generated file is ever read back as a source of data for another.

**Can conflicting states exist?** No two fields can disagree about an article's status — `approvalStatus`/`publishStatus`/`publishDate` live on the single registry entry for that slug, never duplicated elsewhere. The old system's actual failure mode (a PR's `**Publish Date:**` line disagreeing with `PUBLISHING_QUEUE.md`'s hand-typed row) is structurally impossible now — `PUBLISHING_QUEUE.md` is no longer a tracking surface (rewritten to say so explicitly, pointing at the registry instead).

**Can duplicate publications occur?** No. Every generated artifact is a full regeneration from a slug-keyed registry (`content-registry/articles/<slug>.json` — one file per slug, filesystem-enforced uniqueness), never an append. Re-running `publish.mjs` with an already-published article present produces byte-identical output — verified by a dedicated idempotency test (`tests/content-publishing-test.mjs`, "idempotency: running twice...").

**Is the architecture deterministic?** Yes — every `render*()` function in `render.mjs` is pure (no `Date.now()`, no filesystem, no network; `generatedAt`/`today` are always caller-supplied). Verified by a dedicated determinism test.

**Verdict: PASS.**

---

## 2. Security Review

**GitHub Actions permissions — confirmed least-privilege, not assumed.** Repo default workflow permissions: `{"default_workflow_permissions":"read"}` (`gh api repos/Se7venlabs/Royalte/actions/permissions/workflow`). Every new/modified workflow explicitly declares only what it needs: `content-validation.yml` → `contents: read` only; `scheduled-publish.yml` → `contents: write` (the one workflow that actually writes); `indexnow-notify.yml` (pre-existing, unchanged) → `contents: read`. No workflow requests `pull-requests` or any other scope.

**Secrets usage.** Neither new workflow references any secret. `indexnow-notify.yml`'s pre-existing `secrets.INDEXNOW_KEY` usage is unchanged.

**Can someone bypass Board approval? Can registry manipulation publish unauthorized content?** Investigated directly, not assumed: `gh api repos/Se7venlabs/Royalte/rulesets/16344395` shows `main`'s branch protection requires only the `Run pipeline test` status check — **there is no required-PR-review rule** (no `pull_request` rule type in the ruleset at all). This means anyone with repository write access could, today, set `approvalStatus: "approved"` on a registry entry and merge it (or push directly to `main`) without a second human's sign-off, exactly as they could already hand-edit `PUBLISHING_QUEUE.md` or add a `scheduled` label to any PR under the old system. **This is a pre-existing trust boundary, not a new one introduced by this PR** — the registry does not weaken or strengthen who can write to `main`; that has always been "anyone with write access," unchanged by this redesign. Flagged in §8 below as a governance decision for the Board, not something this review resolves unilaterally.

**Is `content-validation.yml` (Workflow A) actually a merge-blocking gate?** No — investigated directly: it is **not** in the ruleset's `required_status_checks` list (only `Run pipeline test` is). It runs and reports on every content PR, but a PR could theoretically be merged with a red "Validate content registry" check today, the same way any non-required check could be. Also flagged in §8.

**Verdict: PASS on implementation (least-privilege correctly applied everywhere); two pre-existing governance gaps surfaced honestly, not silently accepted or silently fixed — see §8.**

---

## 3. Failure Recovery

Tested directly, not just reasoned about:

- **Missing article content**: `publish.mjs` checks `existsSync(contentPath)` before flipping status; if missing, the article stays `scheduled`, a `publish_failed` history event is logged with the reason, and the article is retried automatically on the next run. Verified by test and by the real dry-run (4 of today's real registry entries are in exactly this state right now, correctly).
- **Missing hero image**: `validate.mjs` flags a missing `heroImagePath` for any `published` article (PR-time gate); `publish.mjs` itself does not currently block publishing on a missing hero image at publish time (only content). This is an intentional scope boundary, not an oversight — a missing hero image is a degraded-but-viewable page, not a broken one, and Workflow A already catches it before an article reaches `published` in the first place if authored correctly.
- **Invalid/corrupted registry entry (a real defect found and fixed during this review)**: `loadRegistry()` originally threw on the first unparseable JSON file, which would abort the *entire* publish run — every article, not just the corrupted one. **Fixed**: a malformed file is now skipped and reported via `articles.loadErrors`, never allowed to block unrelated articles. `publish.mjs`'s CLI now surfaces load errors as a loud `::error::` (workflow fails, visibly, rather than silently degrading) while still publishing everything that *is* valid. `validate.mjs` (Workflow A) independently fails a PR that introduces a malformed file. Both behaviors are covered by dedicated tests.
- **Interrupted publish (a second real defect found and fixed during this review)**: originally, if `publishDueArticles()` threw an unexpected error partway through processing multiple due articles, any articles already flipped to `published` before the throw would not be regenerated into a visible artifact until the *next* scheduled run — a real but bounded (self-healing) window, not data loss. **Fixed**: the CLI entry point now wraps the publish step in `try/finally`, guaranteeing a regeneration pass always runs from the registry's actual current state before the process exits, closing that window within the same run. Verified by a dedicated test simulating the crash boundary directly.
- **Failed deployment**: out of scope for this Engine — Vercel's existing push-to-`main` deploy pipeline is unchanged and was not touched by this PR.

**Verdict: PASS**, with two real defects found and fixed during this review, not before it.

---

## 4. Rollback Validation

- **Registry rollback**: a registry entry is a normal git-tracked file; `git revert` on the commit that changed it restores the prior state exactly, same as any other file in this repository.
- **Content rollback**: unchanged from the pre-existing model — an article's HTML file is a normal git-tracked file, reverted the same way.
- **Search index / sitemap / RSS rollback**: these are *generated*, not hand-maintained — rolling back the registry and re-running `publish.mjs` regenerates all three correctly from the rolled-back state. There is no separate rollback procedure needed for generated files; they always reflect current registry truth, by construction.
- **Is rollback deterministic?** Yes — given the same registry state, `publish.mjs` always produces the same output (§1). A rollback is not a special code path; it's the same deterministic regeneration running against an intentionally older registry state.

Documented in `public/blog/PUBLISHING_INTELLIGENCE.md`'s "Emergency rollback procedures" section (rewritten this PR).

**Verdict: PASS.**

---

## 5. Scheduler Validation

- **Correct execution dates**: `isEligibleForPublishing()` is a pure function taking `today` as an explicit parameter (never reads the clock internally) — tested against exact boundary conditions (due today, not yet due, already published).
- **Multiple scheduled articles**: `publishDueArticles()` iterates every eligible article in one pass; tested with multiple due articles simultaneously (the real registry has 4 overdue-and-content-pending articles today, all correctly identified together in one run).
- **No duplicate publication**: see §1 — structurally impossible.
- **Missed execution recovery**: if a scheduled run doesn't fire (GitHub Actions delay, or the workflow being paused), nothing is lost — the next run (or a manual `workflow_dispatch`) picks up every article whose `publishDate <= today`, regardless of how much time has passed. Confirmed by design and by the real registry's current state (articles originally due 2026-07-27 onward are all still correctly `scheduled`, ready to be picked up the moment their content merges).
- **Manual workflow dispatch**: `workflow_dispatch: {}` is wired identically to the cron trigger — both invoke the same `publish.mjs`, no separate code path.
- **Time zone handling**: the cron (`0 13 * * 2,4`) is UTC, fixed at 13:00 year-round — this is 9am ET during Daylight Time and 8am ET during Standard Time, since GitHub Actions cron does not shift for DST. **This is unchanged from the previous scheduler**, which ran at the identical UTC hour; documented explicitly in the workflow file now (was not documented before).
- **Can articles publish twice? Can publishing stall?** See §1 (no) and the concurrency fix below.
- **Concurrency (a real gap found and fixed during this review)**: the workflow had no `concurrency:` guard — a manual `workflow_dispatch` overlapping the cron, or two manual triggers close together, could run two `publish.mjs` processes simultaneously. Idempotency (§1) means this could never produce duplicate *content*, but it could produce a rejected (non-fast-forward) `git push` requiring a manual retry. **Fixed**: added `concurrency: {group: content-publishing-engine, cancel-in-progress: false}`, which queues a second trigger rather than running it in parallel, eliminating the race outright rather than relying on it being merely harmless.

**Verdict: PASS**, with one real gap (concurrency) found and closed during this review.

---

## 6. Registry Integrity

- **Schema validation**: `schema.mjs`'s `validateArticleShape()` checks every required field, valid enum values, valid slug format, and the `scheduled`-requires-`publishDate` invariant. Enforced on every PR via Workflow A.
- **Duplicate prevention**: structural (filesystem — one file per slug) plus an explicit `validateRegistry()` duplicate-slug check (defensive, since the filesystem itself already prevents true duplicates; this catches the case of two differently-named files both claiming the same `slug` field internally).
- **State integrity**: `approvalStatus`/`publishStatus`/`publishDate` combinations are validated together, not independently (a `scheduled` status without a `publishDate` is rejected).
- **Required fields**: all 13 required fields checked; missing any one fails validation with a specific, actionable message per field.
- **Migration accuracy**: all 19 real articles (8 published, 10 scheduled, 1 pending) migrated with title/excerpt/category/readTime pulled directly from each article's own real HTML `<meta name="description">`/`<title>`/category badge (via `git show` against each source branch), not retyped from memory or inferred — cross-checked against `PUBLISHING_QUEUE.md`'s historical record for publish dates and PR numbers.
- **Historical preservation**: original `createdAt` timestamps (from each PR's real creation date) and `sourcePr` references preserved on every migrated entry; `lastModified` for already-published articles reflects their real `publishedAt`, not the migration run's timestamp (fixed during migration script development, before this review, when first noticed).
- **Can invalid states exist? Can registry corruption occur?** See §3's malformed-file fix — a corrupted file is now isolated and reported, never silently accepted as valid data nor allowed to corrupt processing of other articles.

**Verdict: PASS.**

---

## 7. Publication History™

- **Every publish event, every failed publish, every "nothing was due" run**: `appendHistory()` is called unconditionally from every code path in `publishDueArticles()` — confirmed by direct code read, not just by test, that there is no early-return that skips it.
- **Retry history**: a failed article's subsequent successful publish produces a second, distinct `published` event — the full retry sequence is reconstructable from `history.jsonl` alone.
- **Registry updates / state transitions**: every `saveArticle()` call that changes `publishStatus` is paired with an `appendHistory()` call recording that exact transition.
- **Is the audit log immutable?** `appendHistory()` only ever appends (`writeFileSync` with the full prior content plus one new line) — there is no update or delete path anywhere in the codebase that touches `history.jsonl`, confirmed by grep.
- **Can history be reconstructed? Is every production event traceable?** Yes — `history.jsonl` plus the current registry state together fully reconstruct "what happened, when, and why" for any article, without depending on git history or GitHub Actions logs (which are also available, but not required).

**Verdict: PASS.**

---

## 8. Direct-to-main Automation Review

This is the most significant governance question, and this review surfaces it for **explicit Board decision** rather than resolving it unilaterally — implementing a governance/security policy change (e.g., altering branch protection rules) without being asked is exactly the kind of unrequested architectural decision this project's own conventions caution against.

**What actually happens**: `scheduled-publish.yml` runs `publish.mjs`, and if any file changed, commits directly to `main` with `git push origin HEAD:main` — no PR, no merge, no rebase. The commit author is `royalte-content-publishing-engine[bot] <actions@github.com>`. Commits are not GPG-signed (neither are any other commits in this repository's history — unchanged convention). Commit messages are a fixed string, `chore(content-publishing): scheduled publish run`.

**Should automation be allowed to write directly to `main`?** This is precisely the "Board Approval → Registry State → Autonomous Publishing Engine → Automatic Commit" chain the Board's own brief described as the intended replacement for the old model. What is genuinely new is not "content reaches `main` without a human clicking merge" (the old scheduler already did that, via `gh pr merge`) — it's that the commit itself is authored by the automation rather than being a merge of a human-authored commit. The distinction matters less than it might first appear: in both models, the actual decision of *what* gets published and *when* was always made by a human (Board approval + a chosen date), recorded in a machine-readable field (a PR label/body block before, a registry entry now); the automation's job in both models is mechanical — press the button once the date arrives. What changed is *how* that mechanical step is expressed in git, not who authorized the outcome.

**Should an intermediate protected branch exist?** Investigated as a real option, not dismissed: an intermediate branch would mean the Engine pushes to (e.g.) `content-publish-staging`, and a *second* step promotes that to `main`. This would reintroduce exactly the kind of extra merge step whose failure mode (a stuck, conflict-prone merge) is what this entire redesign exists to eliminate — unless the promotion step is itself another piece of trusted automation, in which case the intermediate branch adds a hop without adding a real independent check. **Not recommended by this review**, but presented for the Board's own judgment, not decided here.

**Should production publishing require a final confirmation gate?** A gate of any kind (a required human approval before the automated push) would reintroduce a manual step into the one action this system was built to make unattended — directly contradicting the Board's own stated success criteria ("the Executive Board should be able to approve an article, assign a publish date, and then forget about it"). **This review's assessment**: the actual gate already exists, earlier in the pipeline — Board approval (`approvalStatus: "approved"`) plus an explicit date. Adding a second gate at publish time would mean Board approval doesn't actually authorize publishing, which seems to work against the system's own purpose. Presented for Board judgment, not decided here.

**Does this align with Royaltē's governance philosophy?** Two concrete, fixable gaps were found during this review that bear directly on this question, and are presented as **decisions for the Board**, not implemented unilaterally by this review:

1. `main`'s branch protection ruleset has no required-PR-review rule today — anyone with repository write access could already merge or directly push a change to a registry entry's `approvalStatus` without a second human's sign-off, identically to how they could already hand-edit `PUBLISHING_QUEUE.md` or add a `scheduled` label under the old system. This PR does not change that fact either way. **If the Board wants a stronger gate than "write access," that requires a ruleset change** (e.g., requiring a PR + at least one approving review for changes to `content-registry/**`), which is a repository security setting, not something this review changes on its own authority.
2. `content-validation.yml` (Workflow A) is not currently a *required* status check — it reports, but does not block, a merge. **If the Board wants a malformed or unauthorized-looking registry change to be structurally unable to merge**, "Validate content registry" should be added to the ruleset's required status checks alongside "Run pipeline test." Also a repository setting change requiring explicit Board authorization, not made by this review.

**Verdict: Implementation is sound and least-privilege; two real governance decisions are surfaced honestly for the Board to make, not pre-empted.**

---

## 9. Production Validation

**What this review actually did**: a full local dry-run of `publish.mjs` against the real, fully-migrated production registry, diffed against `main` — not a synthetic test fixture. This correctly identified the 4 real overdue articles (content not yet merged) as failed/retry, correctly regenerated `blog.html`, `blog-posts.js`, and `sitemap.xml`'s article section to exactly match real registry state, and — as a genuine, unplanned side effect — found and fixed two pre-existing gaps in the hand-maintained `sitemap.xml` (`music-licensing-types-explained.html` and `the-backend-infrastructure-powering-modern-music.html`, both real live articles, were simply missing from the old file). A full success-path dry run was also performed: one real article's content was temporarily copied into place, `publish.mjs` was run, the article correctly flipped to `published` and appeared correctly in every generated surface, and the simulation was fully reverted before this PR was opened.

**What this review did NOT do, and cannot do without further explicit authorization**: trigger the *real* `scheduled-publish.yml` workflow via `workflow_dispatch` against GitHub Actions' actual production environment. Doing so would mean the workflow's `git push origin HEAD:main` executes for real, against the real `main` branch, **before this PR is merged and before Board certification is complete** — which would mean the exact governance question this review exists to resolve (should this automation be allowed to write to `main`) gets answered by default, by an action taken during the review itself, rather than by a Board decision. This review deliberately did not do that.

**Board decision needed**: if a true end-to-end production-equivalent execution (the real GitHub Actions workflow actually pushing to `main`) is required before certification, that is a distinct, explicit action this review recommends requesting separately — the same way every production Supabase migration and every production merge earlier in this program required its own explicit go-ahead, not an implicit one.

**Verdict: PASS for everything verifiable without an unauthorized production write; the one remaining gap is disclosed, not hidden, and requires an explicit Board decision to close.**

---

## 10. Disaster Recovery

| Scenario | Recovery | Time to recover | Manual steps |
|---|---|---|---|
| Registry corruption (one bad file) | Self-isolating as of the §3 fix — other articles unaffected; fix the one file, re-run | Minutes | Fix the malformed JSON, push |
| Registry corruption (many/all files) | `git revert` the offending commit(s) — registry files are normal git-tracked files with full history | Minutes | `git revert`, push, done |
| Broken workflow (bug in `publish.mjs` itself) | Workflow fails loudly (non-zero exit on load errors or unexpected exceptions, per §3's fix); `main` is simply not updated until fixed — there is no partial/corrupt commit, since the commit step only runs after `publish.mjs` completes | Depends on the fix; no data loss regardless | Fix the script, push, re-run via `workflow_dispatch` |
| Failed deployment (Vercel) | Outside this Engine's scope — Vercel's own retry/rollback tooling, unchanged from before this PR | N/A (pre-existing) | N/A |
| Invalid publication (wrong content live) | `PUBLISHING_INTELLIGENCE.md`'s Emergency rollback procedure: flip `publishStatus` back to `draft`/`archived`, re-run | One publish cycle | Edit one registry file, push |
| Mass/duplicate publication | Structurally prevented (§1) — not a reachable state given the current codebase | N/A | N/A |
| Partial regeneration (crash mid-run) | Self-healing as of the §3 fix within the same run (`finally` block), and self-healing across runs regardless (regeneration always reads full current state) | One run (minutes) to one scheduled cycle (up to ~3.5 days if entirely unnoticed) | None required; automatic |

**Can the platform recover from every scenario above without data loss?** Yes — in every case, the worst outcome is a delay before content reflects the correct state, never a loss of what state is correct. Publication History™ (§7) means the "what happened and why" record survives every scenario in this table intact.

**Verdict: PASS.**

---

## Summary

| Area | Verdict |
|---|---|
| 1. Architecture Validation | PASS |
| 2. Security Review | PASS (2 governance gaps disclosed, not implementation defects — see §8) |
| 3. Failure Recovery | PASS (2 real defects found and fixed during this review) |
| 4. Rollback Validation | PASS |
| 5. Scheduler Validation | PASS (1 real gap — concurrency — found and fixed during this review) |
| 6. Registry Integrity | PASS |
| 7. Publication History™ | PASS |
| 8. Direct-to-main Automation | Implementation sound; 2 governance decisions require explicit Board input |
| 9. Production Validation | PASS for everything verifiable pre-merge; true production execution requires a separate explicit authorization |
| 10. Disaster Recovery | PASS |

**Three real defects were found and fixed during this review**, all before being presented to the Board: registry-load resilience to a malformed file, interrupted-publish self-healing within a single run, and a missing concurrency guard. `tests/content-publishing-test.mjs` grew from 28 to 32 tests to cover all three. Full regression suite: zero regressions throughout.

**Two items require an explicit Board decision, not implementation** (§8, §9): whether to strengthen `main`'s branch protection (require review, make Workflow A a required check) beyond its current — and pre-existing, unchanged-by-this-PR — state; and whether a true production `workflow_dispatch` execution is required before merge, given that running it for real means writing to `main` before certification completes.

**Recommendation**: the engineering implementation is ready. The two governance questions above are the Board's to answer, not this review's — recommend the Board address them explicitly, then issue a merge decision.
