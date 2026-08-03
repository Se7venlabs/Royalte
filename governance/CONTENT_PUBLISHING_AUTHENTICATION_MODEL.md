# Content Publishing Engine™ — Authentication Model

**Status:** Board-authorized 2026-08-03. Two directives, in sequence — "Final Engineering Directive — Authentication & Automation Completion" (repo setting), then "Authentication & Automation Completion (Final Blocker Resolution)" (PAT) after the setting alone proved insufficient. **§1-3 below are the first attempt's record, kept for the audit trail. §4 is the final, working design — read that first if you're asking "how does this actually authenticate today."**

---

## 1. Repository Configuration Review (written before the change, per directive)

| | |
|---|---|
| **Setting name** | Actions → General → Workflow permissions → "Allow GitHub Actions to create and approve pull requests" |
| **API surface** | `PUT /repos/Se7venlabs/Royalte/actions/permissions/workflow`, field `can_approve_pull_request_reviews` |
| **Current value** (verified 2026-08-03) | `false` |
| **Required value** | `true` |
| **Companion setting, unchanged** | `default_workflow_permissions: "read"` stays `read`. This setting is orthogonal — it's the baseline `GITHUB_TOKEN` scope every workflow gets unless its own `permissions:` block elevates it. `scheduled-publish.yml` already elevates itself explicitly (`contents: write`, `pull-requests: write`); no other workflow in this repo does, and this change does not alter that. |

**Why this specific setting is required**: GitHub's `GITHUB_TOKEN` is blocked from creating (or approving) pull requests by default at the repo level, independent of what scopes a workflow's own `permissions:` block requests. This is a second, org/repo-level gate on top of the per-workflow token scope — confirmed empirically on 2026-08-03 via a live `workflow_dispatch` run that had `pull-requests: write` in its own `permissions:` block and was still rejected: `GraphQL: GitHub Actions is not permitted to create or approve pull requests (createPullRequest)`. There is no per-workflow or per-token way to satisfy this; it is a single repo-wide boolean.

**Security impact — read this before assuming "create" can be granted without "approve"**: GitHub bundles PR creation and PR review approval behind one checkbox and one API field (`can_approve_pull_request_reviews`). There is no finer-grained setting that grants creation without approval capability. Enabling this therefore technically grants every workflow's `GITHUB_TOKEN` in this repo the *capability* to call `gh pr review --approve` (or the equivalent API), not just `gh pr create` — even though `scheduled-publish.yml` is the only workflow that needs the create half, and never calls the approve half. This is why the Governance Requirements below are enforced by workflow code and human code review, not by the platform setting alone — the setting cannot express "create-only."

**What protections remain in place, unchanged by this setting:**
- Branch protection ruleset `main-protection` (id `16344395`) still requires the `Run pipeline test` status check on every PR into `main`, `strict_required_status_checks_policy: false`, `bypass_actors: []`, `enforcement: active`. This setting does not touch branch protection at all — it only controls whether a PR can be *opened*, not whether it can be *merged*.
- `main-protection` has no required-review rule (confirmed via the ruleset API — no `pull_request` rule type is present). Approval capability being technically available to the bot therefore doesn't let it skip a review gate that already didn't exist; it also means this repo was never relying on required-reviewer-count as its actual protection — required status checks are, and those are untouched.
- `allow_auto_merge: false` repo-wide — GitHub's native auto-merge feature stays off. The workflow uses its own explicit `gh pr checks --watch --fail-fast` + `gh pr merge` sequence, which only proceeds after checks report green, same gate a human merging by hand would be subject to.
- `default_workflow_permissions: read` stays the baseline for every other workflow in the repo — this change does not broaden any other workflow's token scope.

## 2. Governance rationale — why the Engine still cannot self-govern its way to production

`scheduled-publish.yml`'s `permissions:` block (`contents: write`, `pull-requests: write`) never requests `pull-requests: write` review/approve scopes beyond what opening and merging its own PR needs, and the workflow itself contains no call to `gh pr review` in any form — creating that capability without exercising it is a deliberate choice, not an oversight. The actual enforcement that the Engine can never publish unapproved or untested content is:

1. **Content Merge Gate** (unchanged, pre-existing this whole initiative): article HTML only ever reaches `main` via a normal, human-reviewed content PR. The Engine never touches `public/blog/*.html` — only registry state and generated listing surfaces.
2. **Registry approval gate**: `isEligibleForPublishing()` requires `approvalStatus === 'approved'`, a field the Engine itself never sets — it's set by whoever edits the registry entry (a human, via a normal registry PR) when the Board signs off on an article.
3. **Required status check**: every publish PR the Engine opens must pass `Run pipeline test` (plus `Validate content registry` when registry files changed) before `gh pr merge` is even attempted — enforced by GitHub's branch protection, not by the Engine's own judgment.
4. **No self-approval in practice**: the Engine's PR carries zero reviews. It doesn't need any, because `main-protection` doesn't require any — the same rule that governs every other PR into this repo.

## 3. Authentication summary

- Identity: `github-actions[bot]`, using the workflow-scoped ephemeral `GITHUB_TOKEN` — no PAT, no new credential, no long-lived secret introduced.
- Scope: `contents: write` + `pull-requests: write`, requested only by `scheduled-publish.yml`'s own `permissions:` block, only for the duration of that job.
- Enabled capability: this repo-level setting change lets that token open a PR (and, as an unused side-capability of the same setting, approve one — never exercised).
- Everything else about the token's access is unchanged: it cannot bypass branch protection, cannot merge a PR with failing or pending required checks, and has no access outside this repository.

## 4. The setting alone wasn't enough — a third finding, and the final design

With `can_approve_pull_request_reviews` enabled, a live `workflow_dispatch` run (`30836050904`) got further than either prior attempt: `gh pr create` succeeded, opening PR #457 as `github-actions[bot]`. But its required checks (`Run pipeline test`, `Validate content registry`) never ran — both sat at `action_required` with **zero jobs ever created**. Confirmed via `gh api repos/Se7venlabs/Royalte/actions/runs/<id>` → `triggering_actor: github-actions[bot]`, `conclusion: action_required`, empty `jobs` array. `gh pr checks --watch` didn't detect this as pending (the check-run object doesn't exist until a human clicks "Approve and run"), returned early, and the subsequent `gh pr merge` correctly failed: `the base branch policy prohibits the merge` — no bypass occurred, nothing merged. PR #457 and its branch were closed/deleted; `main` was never touched.

**This is GitHub enforcing almost exactly the Governance Requirements this program itself specified** — no automation should silently earn its own required checks with no human ever in the loop. `github-actions[bot]`-authored PRs are treated the same way outside-collaborator/fork PRs are for this purpose, regardless of repo settings. There is no repo-level setting that exempts `GITHUB_TOKEN`-authored PRs from this gate — it isn't a checkbox this document can hand you.

**Resolution — a dedicated machine-account identity, not a token workaround:**

| | |
|---|---|
| **Identity** | `royalte-content-bot`, a real GitHub user account, added as a direct repository collaborator |
| **Repository role** | `write` (confirmed via `gh api repos/Se7venlabs/Royalte/collaborators/royalte-content-bot/permission`) — **not** `admin`, no `bypass_actors` entry |
| **Credential** | Fine-grained Personal Access Token, stored as the repo secret `CONTENT_PUBLISHING_PAT` |
| **PAT permission minimum** (verify against this — nothing more is needed) | Contents: Read and write · Pull requests: Read and write · Metadata: Read (mandatory baseline for all fine-grained PATs) |
| **Organization policy** | Does not apply — confirmed `Se7venlabs` is a personal GitHub **user** account (`gh api repos/Se7venlabs/Royalte -q .owner.type` → `"User"`), not an Organization. The org-level "fine-grained PAT access" restriction the directive asked to check for only exists for Organization-owned repos; there was no setting to find or change. |

**Why a real collaborator identity clears the blocker**: the "Approve and run" gate is about unestablished trust (fork contributors, bots), not about write access per se. A real user account with direct `write` collaborator status triggers `pull_request` workflows the same way any human teammate's PR would — normally, no manual click.

**What changed in `scheduled-publish.yml`**: `actions/checkout`'s `token:` input and every `GH_TOKEN` env var now point at `secrets.CONTENT_PUBLISHING_PAT` instead of `github.token`; commit identity is `royalte-content-bot <312678072+royalte-content-bot@users.noreply.github.com>`. Because all writes now go through the PAT, the workflow's own `GITHUB_TOKEN` no longer needs `contents`/`pull-requests: write` — it was reduced back to the repo default (`read`), tightening privilege further than the §1-3 design. A dedicated "Verify CONTENT_PUBLISHING_PAT authentication" step runs first and fails loudly (without ever printing the token) if the secret is missing, wrong, or the account loses write access, rather than letting that surface as a confusing failure mid-publish.

**Actioned 2026-08-03**: per Board agreement ("grant only the permissions that are actually needed"), `can_approve_pull_request_reviews` was reverted to `false`. Confirmed via a live `workflow_dispatch` run (`30856352700`) immediately after the revert that the PAT-based flow is entirely unaffected — success, fully unattended, same as every run since the check-runs race fix. No workflow's `GITHUB_TOKEN` retains PR-create/approve capability in this repo any more; §1-3 above describe a setting that is no longer enabled, kept only as the audit trail of how this design was reached.

## 5. Security validation (post-PAT)

- ✅ Engine can create publication PRs — as `royalte-content-bot`, a real collaborator, not subject to the bot-approval gate.
- ✅ Engine cannot approve PRs — no code path calls `gh pr review`; `main-protection` has no required-review rule for this to matter against.
- ✅ Engine cannot bypass branch protection — `royalte-content-bot` is not in `bypass_actors` (empty list, `current_user_can_bypass: never` applies to everyone).
- ✅ Engine cannot merge with failing checks — `gh pr checks --watch --fail-fast` gates `gh pr merge`; branch protection independently re-enforces this regardless of what the workflow script does.
- ✅ Engine cannot publish unapproved content — `isEligibleForPublishing()` requires `approvalStatus === 'approved'`, set only via a human-reviewed registry PR (§2).
- ✅ Engine operates entirely within repository governance — same ruleset, same required check, same absence of a bypass carve-out as every other contributor.

## 6. Two operational findings on the way to a working PAT, and the final passing run

Getting `CONTENT_PUBLISHING_PAT` actually working surfaced two more issues, neither architectural:

**Secret never actually saved.** Two successive "update secret" attempts left the repo secret's `updated_at` identical to its original `created_at` (checked via `gh api repos/Se7venlabs/Royalte/actions/secrets/CONTENT_PUBLISHING_PAT`) — the value in GitHub's secret store hadn't changed, which explained a `git push` 403 (stale fine-grained PAT, read-only) followed by a harder `could not read Username` failure once that original token was separately revoked. Resolved once the secret was updated via a path that visibly succeeded; `updated_at` moving is now the standing way to confirm a secret edit actually took effect before spending a live run on it.

**Check-runs race.** With the PAT actually live, PR #460 went further than any prior attempt — auth, branch, commit, push, and `gh pr create` all succeeded, and `Run pipeline test` / `Validate content registry` both passed for real. But the workflow had already failed: `gh pr checks --watch --fail-fast`, called immediately after `gh pr create`, polls once and errors with "no checks reported" if GitHub hasn't attached any check suite yet — a startup race, not a real failure. PR #460 was completed with a one-off manual `gh pr merge` once its checks had landed on their own. **Fixed** in a follow-up commit: the workflow now polls `commits/{sha}/check-runs` for at least one check to exist (bounded, 60s) before handing off to `--watch`.

**Run `30855809849`** (`workflow_dispatch` against `main`, post-fix): fully unattended, no manual step. `publish.mjs` found the 4 already-scheduled articles still blocked on their own unmerged content PRs (correctly retried and logged, not published), regenerated `rss.xml`/`search-index.json`, opened PR #462, waited out the check-runs race correctly, watched `Run pipeline test` and `Validate content registry` both pass, and merged — `mergedBy: royalte-content-bot`. This is the Board's original success criterion satisfied for real: registry → PR → required checks → merge → deploy, zero human steps.

**Final security validation, re-confirmed after all of the above**: `main-protection`'s ruleset unchanged (`bypass_actors: []`, `enforcement: active`, same 3 rule types); `royalte-content-bot`'s repo role still `write`, not `admin`; no `gh pr review`/`--approve` call anywhere in the workflow; `isEligibleForPublishing()` still hard-gates on `approvalStatus === 'approved'`; `allow_auto_merge` still `false` repo-wide.

See `governance/CONTENT_PUBLISHING_FINAL_CERTIFICATION.md` §8-9 for the full live-verification record, and `governance/CONTENT_PUBLISHING_ROOT_CAUSE_REPORT.md` for the original incident this whole initiative traces back to.
