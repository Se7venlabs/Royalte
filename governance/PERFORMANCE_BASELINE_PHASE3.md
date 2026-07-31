# Performance Baseline — Phase 3 Closeout

Post-Merge Engineering Directive. Establishes the baseline for future optimization, measured against the real production deployment (`www.royalte.ai`) on `main` after the Phase 3E merge, using a fresh, real, pre-confirmed test account and one real Spotify scan. This is a baseline for comparison, not a load test — single-request timings under no concurrent load, no formal benchmarking harness.

---

## 1. Methodology

Real `curl -w "time_total"` measurements against `https://www.royalte.ai`, authenticated with a real Supabase Bearer token for a freshly-created test user, immediately after Phase 3E merged to `main`. One measurement per endpoint (not averaged across multiple runs) — sufficient for an order-of-magnitude baseline, not for detecting regressions below ~20%. Database query counts are from code inspection (counting `.from()`/`.rpc()` calls per request path), not from a query profiler — no such tooling exists in this project today.

## 2. Measured timings

| Stage | Endpoint | Time | Notes |
|---|---|---|---|
| Scan processing | `GET /api/audit` | **11.70s** | 10-platform fan-out via `Promise.allSettled` — dominated by the slowest of ~10 external API calls, not by Royaltē's own code |
| Executive Intelligence generation (+ archive write) | `POST /api/executive-intelligence` | **0.75s** | Includes the full Phase 1/2 EIO pipeline (Adapter → Engine → EIO) plus the Phase 3A archive insert |
| Ask ATHENA — deterministic path | `POST /api/ask-athena` ("Show my executive memory.") | **1.37s** | Zero AI cost by construction (`providerVersion: 'deterministic'`) — this time is entirely rate-limiting, auth, and Supabase reads/writes, not reasoning |
| Ask ATHENA — AI-required path (placeholder provider) | `POST /api/ask-athena` ("What is my identity coverage?") | **1.14s** | Placeholder provider makes zero external calls — this is the pipeline's own overhead (Context Builder, Evidence Attribution, Prompt Assembly, conversation persistence), not provider latency. A real provider will add real network latency on top of this. |
| Executive Comparison | `GET /api/executive-comparison` | **0.36s** | Returned 400 (only one archived brief existed for this fresh test account — comparison correctly requires two) |
| Executive Trends | `GET /api/executive-trends` | **0.39s** | |
| Executive Memory (read) | `GET /api/executive-memory` | **0.49s** | |
| Workspace loading — `ask-athena.html` | static asset fetch | **0.19s** | 20,954 bytes, single-file page, no bundler |
| Workspace loading — `mission-control.html` | static asset fetch | **0.20s** | 24,059 bytes |

**Observation**: every server-side Executive Intelligence operation (everything except the raw scan itself) completes in under 1.5 seconds. The scan (`/api/audit`) is the dominant cost in the entire pipeline by roughly an order of magnitude — this was true before Phase 3 and remains true after; nothing in Phase 3D/3C/3E touches the scan engine.

## 3. Deterministic vs. AI-required Ask ATHENA — the real cost difference

Both measured Ask ATHENA calls landed in a similar wall-clock range (1.1–1.4s) in this single-request baseline, because the placeholder provider itself does no network I/O — so today, the "zero AI cost" property of the deterministic path shows up as zero *provider* cost, not yet as a dramatically different wall-clock time. **This will change materially once a real (non-placeholder) AI provider is configured**: the AI-required path will then include real network latency to an external LLM API (typically 1–5+ seconds for a non-streaming response), while the deterministic path's cost stays fixed. Re-measuring this comparison after the first real provider is wired in is the single most useful follow-up measurement for Phase 4.

## 4. Database query counts (from code inspection)

| Endpoint | Approx. query/RPC count | Detail |
|---|---|---|
| `GET /api/audit` | ~5 | 1 rate-limit blocked-IP check, up to 3 rate-limit window RPCs (burst/hour/day), 1 `audit_scans` insert |
| `POST /api/executive-intelligence` | ~2 | 1 auth lookup (`getUser`), 1 archive upsert (idempotent) |
| `POST /api/ask-athena` (AI-required path) | ~12–13 | 1 auth lookup, ~4 rate-limit queries, `listBriefs` (limit 2, desc), `countBriefs`, `audit_scans` select (batched via `.in()`), `buildExecutiveMemory`'s own internal `listBriefs` (limit 20, asc) + `listActiveMemoryItems`, conversation `getConversation`/`startConversation`, `getRecentTurns`, 2× `appendTurn` inserts |
| `POST /api/ask-athena` (deterministic path) | ~10–11 | Same as above minus the Context Builder/Evidence Attribution reads that only run on the AI-required path — but the Reasoning Engine's own patterns (e.g. "compare last two scans") still read `latestBrief`/`previousBrief` from the same `buildRawInputs()` call, so most of the query count is shared between both exits |

### Finding: `listBriefs()` is called twice per `/api/ask-athena` request

`api/ask-athena.js`'s `buildRawInputs()` calls `listBriefs(supabase, artistProfileId, {limit: 2, order: 'desc'})` directly (for `latestBrief`/`previousBrief`), then separately calls `buildExecutiveMemory()`, which internally calls `listBriefs(supabase, artistProfileId, {limit: 20, order: 'asc'})` again (for `recurringIssues`/`resolvedIssues`) — two real round-trips to `executive_brief_archive` per request.

**This is not a trivial duplicate to remove**: the two calls use genuinely different parameters for genuinely different purposes (2 most-recent-descending vs. up to 20 oldest-first for a multi-brief diff) — collapsing them into one query risks subtly changing which briefs Ask ATHENA's deterministic "compare last two scans" pattern selects. Not fixed during this closeout (crosses out of "low-risk and self-contained" once the actual shape difference is accounted for) — flagged as a genuine Phase 4 optimization candidate: a single well-designed query (e.g. fetch up to 20 descending once, derive both views from it) could serve both consumers.

## 5. What this baseline does not cover

- **No load testing.** All numbers are single-request, no-concurrency measurements. Behavior under concurrent traffic (rate-limit contention, connection pool exhaustion, cold-start latency on a previously-idle Vercel function) is unmeasured.
- **No real AI provider latency.** Every Ask ATHENA AI-required timing in this baseline reflects the zero-network-call placeholder provider — see §3.
- **No client-side render timing.** "Workspace loading" above measures the static HTML fetch only, not full browser paint/render time, which was not instrumented in this baseline (would require a browser-based performance harness this project doesn't currently have).
- **No repeated-sample statistics.** Single measurements, not p50/p95/p99 — sufficient for an order-of-magnitude baseline, not for detecting small regressions.

## 6. Recommended follow-up measurements for Phase 4

1. Re-measure Ask ATHENA's deterministic vs. AI-required timing gap once a real, non-placeholder provider is configured — this is the number that will actually validate Deterministic Before Generative™'s stated cost/latency benefit.
2. Build a lightweight repeated-sampling harness (even a simple loop-and-average script) before making any performance-sensitive change, so future comparisons have more than a single data point.
3. If the `listBriefs()` double-query (§4) is addressed, re-measure `/api/ask-athena`'s query count and latency before/after to confirm the actual saved cost, since the two calls' payload sizes differ (limit 2 vs. limit 20) and the saving may be smaller than the raw "2 queries → 1 query" framing suggests.
