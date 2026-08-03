# Content Publishing Engine™ — Authentication Model

**Status:** Board-authorized 2026-08-03 ("Executive Board Final Engineering Directive — Authentication & Automation Completion").
**Scope:** the one repository-level setting that lets `scheduled-publish.yml` complete a full autonomous publish, and exactly what it does and does not grant.

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

See `governance/CONTENT_PUBLISHING_FINAL_CERTIFICATION.md` §6 for the certification record of the live verification run against this configuration, and `governance/CONTENT_PUBLISHING_ROOT_CAUSE_REPORT.md` for the original incident this whole initiative traces back to.
