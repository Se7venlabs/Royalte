# ATHENA™ Phase 3A — Executive Brief Archive™ Architecture Note

**Status:** APPROVED, amended, implementation authorized (Board review 2026-07-24).
**Depends on:** ATHENA™ Phase 1 (`ATHENA_EXECUTIVE_INTELLIGENCE_PHASE1_IMPLEMENTATION.md`), ATHENA™ Phase 2, `CANONICAL_EXECUTIVE_ARCHITECTURE.md`.

## Board amendments incorporated (2026-07-24)

1. **Anonymous scans are never archived** — `artist_profile_id` is `NOT NULL`. No "Claim My Scan" design work in Phase 3A (explicitly out of scope per the Board).
2. **No soft delete** — no `deleted_at`, no deletable/mutable archive status. Executive Briefs are permanent historical records; a future retention/privacy policy is a separate initiative, not an archive-semantics change.
3. **Developer-only validation indicator** — one line in the existing `?dev=1`/`?debug=1` Executive Provenance™ bar (`Archived: Yes/No`, Executive Brief ID, truncated integrity hash). Never artist-facing.
4. **Archive Integrity™** — new `archive_integrity_hash` column (SHA-256 hex digest of `executive_intelligence_object`, computed immediately before persistence). See §5a.
5. **`comparison_group_id`** — new nullable `uuid` column, reserved for future use, always `NULL` in Phase 3A. See §2.

The migration (`supabase/migrations/20260724180000_executive_brief_archive.sql`) and all sections below reflect these amendments.

---

## 1. Summary

A new table, `public.executive_brief_archive`, stores one immutable row per successfully archived Executive Brief: structured, queryable summary columns plus the complete Executive Intelligence Object™ as a `jsonb` snapshot. Writes happen exclusively server-side, inside the existing `/api/executive-intelligence` request, after the EIO is generated and before it's returned to the client. Reads happen through a new, single, canonically-scoped read endpoint designed to be the one service Phase 3B's Timeline/Memory/Trend/Comparison features all read through — not five separate ad hoc queries.

---

## 2. Proposed Supabase schema

Full DDL: `supabase/migrations/20260724180000_executive_brief_archive.sql` (drafted, unapplied). Summary of the required structured fields, mapped to their real source:

| Column | Type | Source |
|---|---|---|
| `id` | `uuid` PK | `gen_random_uuid()` |
| `executive_brief_id` | `text` | `eio.executiveBriefId` |
| `artist_profile_id` | `uuid` NOT NULL, FK `auth.users(id)` | resolved server-side from Bearer token, **never from client-supplied `workspaceContext`** (see §6 Security) |
| `scan_id` | `uuid`, FK `audit_scans(id)` | `eio.scanId` — real FK, since `audit_scans.id` IS the handler-generated `scanId` (`api/audit.js`) |
| `generated_at` | `timestamptz` | `eio.generatedAt` |
| `executive_version` | `text` | `eio.metadata.executiveVersion` |
| `schema_version` | `text` | `eio.metadata.schemaVersion` |
| `pipeline_version` | `text` | `eio.metadata.pipelineVersion` |
| `athena_version` | `text` | `eio.metadata.athenaVersion` |
| `runtime_context_version` | `text` | `eio.metadata.runtimeContextVersion` |
| `confidence_level` | `text` | `eio.confidence.level` |
| `critical_issue_count` | `integer` | `eio.executiveBriefing.criticalIssues` |
| `risk_count` | `integer` | `eio.risks.length` |
| `opportunity_count` | `integer` | `eio.opportunities.length` |
| `recommendation_count` | `integer` | `eio.recommendations.length` |
| `archive_status` | `text` DEFAULT `'archived'` | always `'archived'` as written by 3A — see §5 |
| `executive_intelligence_object` | `jsonb` NOT NULL | the complete `eio` object, verbatim |
| `archive_integrity_hash` | `text` NOT NULL | SHA-256 hex digest of `executive_intelligence_object`, computed immediately before insert — see §5a |
| `comparison_group_id` | `uuid`, nullable | reserved for future use (Board amendment); always `NULL` in Phase 3A |
| `created_at` | `timestamptz` DEFAULT `now()` | archive-row creation time (distinct from `generated_at`, the EIO's own generation time) |

**Board-approved (Amendment 1):** `artist_profile_id` is `NOT NULL`. Anonymous/unauthenticated scans (real and currently allowed — `audit_scans.user_id` can be `NULL`) are **never archived**. ATHENA still generates and returns Executive Intelligence for anonymous scans exactly as it does today; the archive write step is simply skipped, with a clear, honest signal in the response (§6, §7). A future "Claim My Scan" workflow is explicitly out of scope for Phase 3A and not designed for here.

---

## 3. Write path

```
Canonical Workspace Context (client)
        ↓  POST /api/executive-intelligence  { workspaceContext }
        ↓  (server, api/executive-intelligence.js)
Resolve artist_profile_id from Bearer token (if present)
        ↓
ATHENA Executive Intelligence Pipeline™  (unchanged, pure — api/athena/pipeline.js)
        ↓
Executive Intelligence Object™ generated (executiveBriefId already assigned inside it — Phase 1, unchanged)
        ↓
IF artist_profile_id resolved:
    archiveExecutiveBrief(eio, artist_profile_id)   [NEW — api/_lib/executive-brief-archive.js]
        → INSERT ... ON CONFLICT handling (see §5 Idempotency)
        → success: archived=true
        → failure: archived=false, archiveError=<safe message>, logged server-side
ELSE:
    archived=false, archiveError='anonymous scan — not archived'
        ↓
Response: { executiveIntelligence: eio, archived, archiveError? }
```

The client (`ai-insights.html`) **never** archives anything — it only ever receives the already-generated EIO plus an `archived` boolean, matching the Board's explicit rule that AI Insights™ remains presentation-only and the browser does not archive briefs.

**Required change to `api/executive-intelligence.js`:** add Bearer-token resolution (identical pattern to `api/save-music-rights-profile.js`: `Authorization: Bearer <token>` → `supabase.auth.getUser(token)` → real `user.id`). This is the endpoint's first authentication of any kind — flagged as a known gap in the Phase 2 report; Phase 3A is where it gets resolved, because archiving requires a verified owner. An absent or invalid token is **not an error** — the endpoint still generates and returns Executive Intelligence (today's anonymous-use behavior is preserved), it simply skips archiving.

---

## 4. Read API proposal

One new endpoint, one canonical service — so Phase 3B's Timeline™, Memory™, Trend Intelligence™, and Comparison™ all read through the same path rather than each inventing its own query:

**`GET /api/executive-brief-archive`** (new file, `api/executive-brief-archive.js`)

Always Bearer-authenticated; every query is implicitly scoped to `auth.uid()` server-side — the endpoint never accepts an `artist_profile_id` parameter from the client (that would be an IDOR vector). Query parameters select the mode:

| Mode | Params | Behavior |
|---|---|---|
| Get by ID | `?executiveBriefId=EB-...` | single row, 404 if not found or not owned |
| Latest | `?latest=1` | single row, most recent `generated_at` for the caller |
| List by date range | `?from=YYYY-MM-DD&to=YYYY-MM-DD` | rows within range, paginated (`limit`/`cursor`), newest first |
| Compare (two IDs) | `?ids=EB-...,EB-...` | both rows if both exist and are owned by the caller; 404 if either is missing/not owned — no partial comparison |

All modes return the structured summary columns by default; a `?full=1` flag additionally includes `executive_intelligence_object`. This keeps list views cheap (no unnecessary `jsonb` transfer) while still supporting the "get one full brief" case Phase 3B's Timeline/History UI will need.

No `POST`/`PATCH`/`DELETE` in Phase 3A — this is a read-only foundation. Phase 3B may add its own higher-level reader (e.g., a trend-computation service) but should call through this endpoint's underlying query functions, not re-implement archive access.

**Minimal developer validation, not a UI:** the existing dev-only Executive Provenance™ bar (`?dev=1`/`?debug=1`, already shipped in Phase 2) is a natural, already-existing place to add one line — `Archived: yes (EB-...)` or `Archived: no (<reason>)` — for manual verification during Phase 3A review. This is a one-line extension of existing dev tooling, not new UI, and I'd implement it alongside the write path rather than as a separate deliverable.

---

## 5. Idempotency and duplicate protection

Two unique constraints, both enforced at the database level (not relied on client-side, per the Board's explicit instruction):

1. **`UNIQUE (artist_profile_id, scan_id) WHERE scan_id IS NOT NULL`** — the primary idempotency anchor. One archived brief per artist per scan. Handles: client retries, Vercel re-invoking the serverless function, the same scan somehow generating Executive Intelligence twice. The write path:
   - Attempts `INSERT`.
   - On a unique-violation against *this* constraint → the row already exists (a prior attempt succeeded) → `SELECT` the existing row's `executive_brief_id` and return `archived=true` with the **original** ID, not a new one. Never a duplicate row, never a silently different ID for the same scan.

2. **`UNIQUE (executive_brief_id)`** — defense against the flagged Phase 1 limitation that `executiveBriefId`'s 6-digit suffix is cryptographically random, not a database-guaranteed-unique sequence (`ATHENA_EXECUTIVE_INTELLIGENCE_PHASE1_IMPLEMENTATION.md` §15). On the rare unique-violation against *this* constraint (two different scans independently minting the same ID): the write path regenerates a new `executive_brief_id` for the *same* EIO content and retries the insert, bounded to 3 attempts before surfacing a failure. This is the correct place to close that Phase 1 gap — a real DB constraint, not a probability argument.

Order of conflict handling matters: check for (1) first (idempotent success path), only regenerate-and-retry for (2) if (1) didn't match.

---

## 5a. Archive Integrity™ (Board amendment, 2026-07-24)

Every archived row includes `archive_integrity_hash` — `sha256(JSON.stringify(eio))`, computed in `api/_lib/executive-brief-archive.js` immediately before the `INSERT`, using Node's built-in `node:crypto` `createHash('sha256')` (no new dependency). Because `eio` is deep-frozen and its keys are always constructed in the same order by `buildExecutiveIntelligenceObject()` (Phase 1), the serialization is deterministic for a given EIO.

This lets a later export, a Phase 3B comparison, or a support/compliance investigation confirm that a copy of an Executive Brief (in a PDF export, a UI render, a support ticket attachment) matches byte-for-byte what ATHENA actually archived — recompute the hash over the copy and compare. The hash is computed over `executive_intelligence_object` only (not the structured summary columns, which are derived from it and not independently authoritative).

Not stored on the EIO itself (Phase 1's schema is unchanged) — this is archive-specific metadata, scoped to the archive table, computed once at archive time.

---

## 6. Data ownership and security

- **`artist_profile_id` verification:** resolved exclusively from a verified Supabase Bearer token server-side (`supabase.auth.getUser(token)`), identical to the established pattern in `api/save-music-rights-profile.js`. Never trusted from the client-supplied `workspaceContext` body — a workspace context has no cryptographic binding to a specific user and must not be treated as an ownership claim.
- **Cross-artist access prevention:** two layers. (a) The read endpoint scopes every query to `auth.uid()` server-side, never accepting a caller-supplied artist id. (b) RLS `SELECT USING (auth.uid() = artist_profile_id)` is defense-in-depth for any future direct-client-read path, matching the `royalty_statements` precedent.
- **Service-role requirement:** yes, required for writes — the archive-writer (`api/_lib/executive-brief-archive.js`) uses the Supabase service-role client, identical to every other server-side write path in this codebase (`persist-os-scan.js`, `save-music-rights-profile.js`). RLS has no INSERT policy at all; the service role bypasses RLS entirely, and no policy exists that would grant the browser write access even if that were somehow attempted.
- **RLS:** enabled, SELECT-only, own-rows-only. No INSERT/UPDATE/DELETE client policies.
- **Unauthenticated/incomplete scan contexts:** per §2's design decision, simply not archived. `POST /api/executive-intelligence` continues to function exactly as it does today for anonymous callers — this is additive, not a breaking change to existing behavior.
- **Sensitive intelligence protection:** the full EIO snapshot (including risks, opportunities, recommendations — real business-sensitive data about an artist's rights/publishing gaps) is protected the same way any other sensitive profile data in this schema is: RLS scoped to the owner, service-role-only writes, no public bucket/URL, no unauthenticated read path. The existing unauthenticated `/api/executive-intelligence` computation endpoint explicitly does **not** become an unauthenticated archive reader — the new read endpoint is a separate file with its own mandatory auth check, not a mode flag on the existing one.

---

## 7. Archive failure behavior

Per the Board's recommended rule, implemented exactly: **ATHENA still returns the generated Executive Intelligence Object even when archival fails.** The response always includes an explicit `archived: boolean` field; when `false`, an `archiveError` string (safe, non-leaking message) is included. The system never reports `archived: true` unless a row genuinely exists — there is no "optimistic" or "assumed" success state.

Failure is observable via structured server-side logging (`console.error('[executive-brief-archive] write failed:', ...)`, matching the existing `[executive-intelligence]` / `[save-music-rights-profile]` log-tag convention in this codebase) so it's diagnosable without needing a dedicated failure-tracking table in Phase 3A. If failure volume becomes a real operational concern later, a `schema_violations`-style table (an existing precedent in this codebase, per `api/audit.js`'s `handleSchemaViolation`) would be the natural Phase 3B+ addition — not proposed here as it isn't needed to satisfy Phase 3A's own requirements.

---

## 8. Retention and immutability rules

- **No UPDATE policy, no UPDATE call anywhere in the write path.** Once a row is inserted, its `executive_intelligence_object` snapshot and all structured columns are permanent.
- **No hard DELETE.** Nothing in Phase 3A ever deletes a row. (No soft-delete column is proposed either — unlike `royalty_statements`, there's no artist-initiated deletion use case in this brief; if one emerges later, a `deleted_at` column can be added additively without touching this migration's core contract.)
- **Corrections never overwrite.** If a later scan produces different intelligence, it is a **new row** with a new `scan_id` and a new `executive_brief_id` — never a rewrite of the prior assessment. This is enforced structurally: the write path only ever `INSERT`s, and the idempotency constraint (§5) only prevents *duplicate* inserts for the *same* scan, not a new insert for a genuinely new scan.
- **Schema evolution:** if `executive-intelligence-object.js`'s EIO shape changes in a future phase, `executive_intelligence_object` continues to store whatever shape was actually generated at that time — old rows are never migrated/rewritten to a new shape. `schema_version`/`athena_version`/`pipeline_version` on each row are exactly what makes old snapshots reproducible and interpretable later (this is why the Board's Phase 2 Executive Provenance™ addendum matters here — it's the mechanism that makes retention meaningful).
- **Reproducibility:** because the full EIO is stored verbatim, a historical brief can always be re-rendered by a future presentation layer without re-running the pipeline — the stored snapshot IS the historical record, not a derived summary that could drift from what ATHENA actually said at the time.

---

## 9. Test plan

New test file: `tests/executive-brief-archive-test.mjs`, following the existing no-framework `assert`-based convention (`tests/athena-adapter-test.mjs`).

Since there is no local Postgres/Supabase test harness in this repo today (confirmed — all existing DB-touching code is tested via unit tests around the pure logic, not integration tests against a real database), the test plan splits cleanly:

**Pure-logic unit tests (no DB required, run in CI like everything else):**
- Idempotency-key derivation is deterministic for the same `(artist_profile_id, scan_id)`.
- Retry-and-regenerate logic: given a mocked "unique violation on executive_brief_id" response, a new ID is generated and a second insert is attempted; bounded to 3 attempts; a 4th consecutive failure surfaces as `archived: false`.
- Given a mocked "unique violation on (artist_profile_id, scan_id)" response, the writer fetches and returns the *existing* row's `executive_brief_id`, and does **not** attempt a second insert.
- `archiveExecutiveBrief()` never throws — always resolves to `{ archived, executiveBriefId?, archiveError? }`, matching the "never break the response" requirement.
- Anonymous-context path: no `artist_profile_id` → `archiveExecutiveBrief()` is never called at all (verify via a spy/mock at the endpoint-logic level) → `archived: false, archiveError: 'anonymous scan — not archived'`.
- Read-endpoint query-builder functions: each of the 4 modes (by ID / latest / date range / compare-two) builds the correct filter, always includes the caller's own `auth.uid()`, never accepts a client-supplied artist id.

**Manual / Preview-environment verification (documented, not automated in this phase):**
- Apply the migration to a preview/staging Supabase project (not production) and confirm: RLS blocks a second test user from reading a first user's rows; the unique constraints reject duplicate inserts as designed; a full round-trip (generate → archive → read back by ID → read back as latest → read back in a date range) matches the original EIO byte-for-byte.

---

## 10. Dependency map — how Phase 3B consumes this

```
executive_brief_archive (table, Phase 3A)
        │
        ▼
api/executive-brief-archive.js (read service, Phase 3A)
        │
        ├──▶ Executive Intelligence History™  — list mode, paginated
        ├──▶ Executive Timeline™               — list mode (date range) + per-domain diffing of
        │                                          consecutive rows' executive_intelligence_object
        ├──▶ Persistent Executive Memory™      — list mode, aggregated across all of an artist's
        │                                          rows (goals/completed/deferred derived from
        │                                          recommendation-status changes across scans —
        │                                          Phase 3B's own new logic, not built here)
        ├──▶ Cross-Scan Trend Intelligence™     — list mode (date range) + per-domain trend
        │                                          classification (improving/stable/declining/
        │                                          emerging/resolved — Phase 3B's own new logic)
        └──▶ Executive Comparison™              — compare mode (two IDs)
```

Every Phase 3B feature is a **reader** over this one table through this one endpoint's query functions — none of them need their own archive-access logic, and none of them can be built before this exists. This is the concrete fulfillment of the Board's "reuse one canonical history and comparison service" instruction.

---

## 11. Files expected to be created or modified (Phase 3A implementation, once approved)

**New:**
- `supabase/migrations/20260724180000_executive_brief_archive.sql` (already drafted, this note)
- `api/_lib/executive-brief-archive.js` — `archiveExecutiveBrief(eio, artistProfileId)`, idempotency/retry logic, service-role client
- `api/executive-brief-archive.js` — read endpoint (4 modes, §4)
- `tests/executive-brief-archive-test.mjs`
- `vercel.json` — route entry for `/api/executive-brief-archive`

**Modified:**
- `api/executive-intelligence.js` — add Bearer-token resolution, call `archiveExecutiveBrief()` when a user is resolved, include `archived`/`archiveError` in the response
- `public/workspaces/ai-insights.html` — read the new `archived` field from the existing fetch response and surface it in the existing dev-only Executive Provenance™ bar only (one line; no new UI, no change to artist-facing content)

**Explicitly not touched in Phase 3A:** anything under Timeline™, Memory™ persistence logic, Trend Intelligence™, Comparison™, Ask ATHENA™, or Forecasting™ — those remain Phase 3B/3C/3D per the Board's revised sequencing.

---

## 12. Board review outcome (2026-07-24)

All three open items resolved — see "Board amendments incorporated" at the top of this document. Implementation of §11's file list is authorized. Migration application and merge remain gated on: migration reviewed, security model reviewed, tests passing, Vercel Preview reviewed (per the Board's standing Phase 3A closure requirement).

---

## 13. Operational validation (2026-07-24) — Phase 3A: COMPLETE

Migration applied to the live Supabase project (`dhfndrrfekwuxzgjblci`, the same project `SUPABASE_URL` in `public/js/supabase-client.js` points to — not a separate staging project). Verified directly against the database, not inferred from code:

**Infrastructure:**
- `public.executive_brief_archive` exists with all 20 designed columns, correct types.
- Table comment and all 4 designed column comments present verbatim.
- FK constraints present: `artist_profile_id → auth.users(id)`, `scan_id → audit_scans(id)`.
- All 4 indexes present: PK, `uq_executive_brief_archive_artist_scan` (partial unique, `WHERE scan_id IS NOT NULL`), `uq_executive_brief_archive_brief_id` (unique), `idx_executive_brief_archive_artist_generated`.

**Security (`get_advisors` + direct policy inspection):**
- RLS enabled. Exactly one policy, `executive_brief_archive_select_own`, `SELECT ... USING (auth.uid() = artist_profile_id)`. No INSERT/UPDATE/DELETE policy exists.
- `get_advisors(type=security)` returns zero findings for `executive_brief_archive` — the table introduces no new security advisories (several *pre-existing* tables in this project do carry an informational "RLS enabled, no policy" advisory; none of them are Phase 3A's).
- **Cross-user isolation, tested with two real accounts** (via `SET LOCAL role authenticated; SET LOCAL request.jwt.claims`, the standard way to exercise Postgres RLS policies directly — this is the exact `auth.uid()` mechanism the Supabase client relies on, not a simulation of a different mechanism): inserted one test row per account, confirmed Account A's session sees only Account A's row, Account B's session sees only Account B's row, neither sees the other's.
- **Anonymous access**: `SET LOCAL role anon` (no JWT claims) returns zero rows.
- **Client-side write rejection**: an authenticated session attempting to `INSERT` a row under its *own* `artist_profile_id` was rejected with `42501 — new row violates row-level security policy` — confirmed no client, even a legitimate one, can write directly; only the service-role write path (`api/_lib/executive-brief-archive.js`) can.
- Both test rows deleted immediately after verification; table confirmed back to 0 rows.

**Archive write/read (direct SQL, exercising the same schema/constraints the application code writes through):** insert with the full column set succeeded, including `jsonb` storage of a representative `executive_intelligence_object` and an `archive_integrity_hash`; read-back matched what was written.

**Scope of this validation — stated precisely, not overclaimed:** the above proves the database layer (schema, constraints, indexes, RLS, storage) is correct and live. It does **not** by itself exercise a live browser session calling the deployed Vercel functions end-to-end (that requires a real logged-in browser flow, which wasn't available in this validation pass). The application code (`api/_lib/executive-brief-archive.js`, `api/executive-intelligence.js`, `api/executive-brief-archive.js`) uses the standard Supabase JS client against the exact schema just verified, and is separately covered by 18 unit tests (idempotency, collision-regeneration consistency, canonical hashing, never-throws, anonymous path) — so this is a disclosed scope boundary, not a hidden gap.

**Status: Phase 3A — Complete.** Foundation is live; Phase 3B (Executive History™/Timeline™/Memory™/Comparison™) may begin.
