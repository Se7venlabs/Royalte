# Content Publishing Engine™ — Final Production Certification

PR: #454
Classification: Executive Board Final Certification
Status: Final Review Before Merge

This document certifies the final production-readiness items requested beyond `governance/CONTENT_PUBLISHING_EXECUTIVE_ACCEPTANCE_REVIEW.md` (the 10-area acceptance review, all PASS, 3 defects found and fixed). It does not repeat that review's findings — it closes the remaining gaps and states merge readiness.

---

## 1. Governance Verification (confirmed, not redesigned)

Per the directive: review current state, document recommendations, **do not redesign branch governance as part of this PR.**

**Branch protection on `main`** (`gh api repos/Se7venlabs/Royalte/rulesets/16344395`, re-confirmed at time of this certification):
- Required status checks: `Run pipeline test` only.
- Required approvals: none configured.
- `current_user_can_bypass: "never"` — even the acting user cannot bypass this ruleset's rules (deletion, non-fast-forward, the status check) through the UI/API bypass mechanism; there is no separate carve-out for this automation.

**Workflow permissions**: repo default is `read` (`gh api repos/Se7venlabs/Royalte/actions/permissions/workflow`). `scheduled-publish.yml` explicitly elevates to `contents: write` (the only workflow that does); `content-validation.yml` and `indexnow-notify.yml` stay at `contents: read`. No workflow requests any permission beyond what it uses.

**Automation permissions**: the Content Publishing Engine's GitHub Actions token (`github.token`, auto-issued per run, scoped by the `permissions:` block above) is the only credential involved — no PAT, no long-lived secret, no cross-repo scope.

**This PR does not change any of the above.** The two items below are **unchanged by this PR** and are documented as standing recommendations for a future, separate governance decision — not implemented here:

1. Consider requiring a PR + at least one approving review for changes to `content-registry/**`, if the Board wants a stronger gate than "has repository write access."
2. Consider adding `Validate content registry` to the ruleset's required status checks, if the Board wants a malformed/invalid registry PR to be structurally blocked from merging rather than merely flagged.

## 2. Content Publishing Authority (verified)

Traced directly in the actual workflow file, not assumed: `scheduled-publish.yml`'s checkout step (`actions/checkout@v4`, no `ref:` override) resolves to the triggering ref. For the `schedule` trigger, GitHub Actions always resolves this to the **default branch** — there is no mechanism for a `schedule` event to ever trigger against a feature branch. For `workflow_dispatch`, the ref defaults to the default branch unless a caller with repository write access explicitly overrides it (the same trust level already required to merge or push directly).

**Confirmed**: under normal, unattended operation — the only mode this system runs in day to day — the Engine can only ever read and act on `main`'s own already-merged registry state. A feature branch's registry changes are invisible to it until that branch merges. Combined with `isEligibleForPublishing()`'s hard requirement of `approvalStatus === 'approved'` (§1/§6 of the Acceptance Review), the full chain holds exactly as specified: **Board Approval → Merged to `main` → Approved Registry State → Scheduled Publish → Deployment**, with no step skippable and no feature branch ever published directly.

## 3. Operational Validation

All nine required conditions tested directly against the real store/engine functions (not just reasoned about):

| Condition | Result |
|---|---|
| No scheduled articles (future-dated only) | `publishedSlugs: []`, correctly logs `run_no_due_articles`, no error |
| Genuinely empty registry (zero articles) | Same — clean no-op, no error |
| One scheduled article | Publishes correctly (`tests/content-publishing-test.mjs`, and the real dry-run's success-path simulation) |
| Multiple scheduled articles | The real registry currently has 4 simultaneously-due articles; all correctly identified together in one run |
| Already-published articles | Correctly excluded from re-publishing (idempotency test) |
| Missing content | Skipped, logged, retried next run (test + real dry-run, 4 real articles in this exact state today) |
| Missing image | Flagged by `validate.mjs` for published articles only, not scheduled (test) |
| Malformed registry file | Isolated and reported, doesn't block other articles (defect found and fixed this review cycle, now tested) |
| Interrupted publish | Self-heals within the same run via `try/finally` (defect found and fixed this review cycle, now tested) |
| Concurrent workflow execution | Prevented outright via `concurrency: {group: content-publishing-engine, cancel-in-progress: false}` — queues rather than races. A true simultaneous-GitHub-Actions-runner race is impractical to stage directly; the `concurrency` primitive is standard, well-understood GitHub Actions behavior, not novel code this repository owns the correctness of |

## 4. Production Readiness Checklist

| Item | Status |
|---|---|
| Registry validation passes | ✅ `node scripts/content-publishing/validate.mjs` → `Content registry valid — 19 article(s) checked.` |
| Scheduler validation passes | ✅ §3 above |
| All automated tests pass | ✅ `tests/content-publishing-test.mjs` 32/32; full regression suite (`pipeline-test.mjs`, `playbook-action-engine-test.mjs`, `opportunity-engine-test.mjs`, `ask-athena-test.mjs`, `executive-memory-store-test.mjs`, `executive-phase3d-domain-comparison-test.mjs`, `executive-phase3b-services-test.mjs`, `workspace-contract-validator.test.mjs`) — zero regressions |
| Concurrency protection active | ✅ §3 |
| Crash recovery verified | ✅ Acceptance Review §3, §10 |
| Retry behaviour verified | ✅ §3 above, "Missing content" row |
| Idempotency verified | ✅ Acceptance Review §1, dedicated test |
| Publication history verified | ✅ Acceptance Review §7 |
| Search assets verified | ✅ `public/search-index.json`/`public/rss.xml` generation confirmed correct in the real dry-run |
| CI green | ✅ PR #454, both `Run pipeline test` and `Validate content registry` passing |

## 5. Documentation Review

Swept for stale references (`grep` across every rewritten doc for old-system terminology — `scheduled` label, `**Publish Date:**` PR-body block, `blog-index-sync`, the old Mon/Wed/Fri cadence): every remaining hit is a deliberate, correctly-labeled historical reference (explaining what the *old* system was, inside `PUBLISHING_INTELLIGENCE.md`'s own "supersedes Phase 1" framing and `CONTENT_PUBLISHING_ROOT_CAUSE_REPORT.md`'s incident narrative) — none is a stale claim about current behavior. `content-registry/README.md`, `public/blog/README.md`, `public/blog/PUBLISHING_INTELLIGENCE.md`, and `public/blog/PUBLISHING_QUEUE.md` all correctly reference `scripts/content-publishing/*` and the current Tue/Thu cadence throughout.

## 6. Final Production Verification — sequencing decision

The directive requests one controlled end-to-end production-equivalent validation, including real deployment and IndexNow notification. **This requires a real `git push` to `main`** — there is no way to observe genuine deployment/IndexNow/live-rendering behavior without one. Two possible sequences were weighed:

- **(a) Trigger `workflow_dispatch` against the PR branch before merging.** Rejected: the workflow's own `git push origin HEAD:main` would push the feature branch's tip directly to `main` outside the normal merge flow, and PR #454's subsequent `gh pr merge` would then be operating against a `main` that already silently contains the PR's changes — a confusing, non-standard sequence with real risk of merge-tooling confusion, for no benefit over option (b).
- **(b) Merge PR #454 normally first, then trigger `workflow_dispatch` against the now-current `main`.** This is a clean, standard sequence — identical in spirit to every other milestone in this program (e.g. Phase 4A/4B applied their production migrations, then live-verified, all within an already-open PR's certification cycle before that PR's own final merge instruction; here the equivalent live step is naturally *of* `main`, so it comes after this specific PR lands). The Board's own directive structure supports this reading too — "Merge Authorization" §4-6 explicitly lists post-merge operational confirmation ("Confirm all required GitHub Actions complete successfully," "Confirm the scheduled publishing workflow remains enabled," "Confirm the Content Publishing Engine™ is operational") as part of the same certification arc.

**Proceeding with (b)**: merge first, then run the real, live, production `workflow_dispatch` verification immediately after, and report the results as this certification's closing act.

## 7. Merge Readiness Statement

Every item in this document and in `governance/CONTENT_PUBLISHING_EXECUTIVE_ACCEPTANCE_REVIEW.md` is satisfied: architecture, security, failure recovery, rollback, scheduler, registry integrity, publication history, content publishing authority, operational validation, and production readiness are all confirmed. The two governance recommendations (§1) are documented, not blocking, and explicitly not implemented in this PR per the directive's own instruction not to redesign branch governance here.

**Recommendation: proceed to merge**, followed immediately by the live production verification described in §6, with results appended to this document.
