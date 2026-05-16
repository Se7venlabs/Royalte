# Royaltē Launch Checklist

**Target:** June 1, 2026 beta launch
**Owner:** Darryl West, Se7ven Labs Inc.
**Status:** Living document — update at end of every working session.
**Spec:** V5 supersedes V4 as primary source of truth, locked Saturday May 16, 2026.

This is the source of truth for what's left. Not memory, not chat history. If
it's not in here, it's not tracked.

---

## Today / On Deck

The next actionable items. Update this section every session.

**⚠️ Schedule risk:** ~16 days to the June 1, 2026 beta launch (as of 2026-05-16). The Tier 1 non-code critical path below still has weeks of external lead time and is untouched — start it immediately, in parallel with code work.

### Next code task

Blocks A, B, and D are shipped, plus V5 Phase 2 Founding Artist pricing (see Done). **Block C (Stripe) is the next major block but is hard-blocked on the Tier 1 LLC/payments track.** Unblocked code work available now: Block E (manual rescan), Block F (polish / edge cases), Block G (history view), plus the queued Follow-ups. Darryl to pick the next bounded task.

### Tier 1 — Non-code critical path (start now, dependency-ordered)

Single source of truth for the LLC / EIN / banking / Stripe / legal track (the standalone "Business foundation" section was folded in here). This track gates Block C entirely.

- [ ] **Wyoming LLC formation** — no dependencies, start immediately.
- [ ] **EIN application** — blocked on LLC formation.
- [ ] **Mercury bank account** — blocked on EIN.
- [ ] **Stripe account setup** — blocked on Mercury account + Refund Policy.
- [ ] **Terms of Service** — no dependencies, start immediately.
- [ ] **Privacy Policy** — no dependencies, start immediately.
- [ ] **Refund Policy** — no dependencies; blocks Stripe account setup.

### Tier 3 — Marketing / Ops (parallel track, no Block C dependency)

Independent of the Tier 1 LLC/payments path — none of these gate Block C. Start as capacity allows.

- [ ] **TikTok Business account** — marketing channel setup. No dependencies.
- [ ] **Analytics installed** — PostHog or equivalent (TBD).
- [ ] **Error monitoring installed** — Sentry or equivalent (TBD).
- [ ] **Uptime check** — on royalte.ai + key API endpoints.
- [ ] **Supabase Pro upgrade** — $25/month per project. Free-tier rate limits (especially magic-link auth sends) blocked smoke testing repeatedly; not sustainable once real user traffic shares the quota. Schedule: Thursday May 21, 2026.

---

## Block A — Auth foundation (V5 magic-link)

The original V4 plan here was password-login — `/login.html`, `/signup.html`,
`/set-password.html`, and a shared `/js/auth.js` session module. **None of that
shipped.** V5 replaced it with Supabase magic-link auth, delivered in three
chunks. The struck V4 items are kept below for the record.

- [x] ~~Build `/login.html` matching dashboard brand voice~~ — superseded by V5 magic-link
- [x] ~~Build `/signup.html` matching dashboard brand voice~~ — superseded by V5 magic-link
- [x] ~~Build `/set-password.html` that consumes Supabase magic link tokens~~ — superseded by V5 magic-link
- [x] ~~Build session check + logout in shared `/js/auth.js`~~ — superseded by V5 (`supabase-client.js` singleton)

### Chunk 1 — Auth schema foundation ✅ done (PR #36, `d4da105`)

- [x] `profiles` table + RLS policies + auto-create-profile trigger on `auth.users` insert
- [x] `audit_scans.user_id` + `audit_scans.session_id` columns (nullable)
- [x] `migrate_anonymous_scans` RPC (SECURITY DEFINER) to claim anonymous scans onto a user

### Chunk 2 — Magic-link delivery + homepage wiring ✅ done (PR #37, `8259796`)

- [x] `public/js/supabase-client.js` — browser anon client singleton + `getOrCreateSessionId()`
- [x] V5 continuation CTA wired to `signInWithOtp` (replaces audit-modal open)
- [x] `/auth/callback` handler — verifies session, calls `migrate_anonymous_scans`, shows "Welcome to Royaltē OS" holding page
- [x] `profiles` + RLS schema and `audit_scans` `user_id`/`session_id` now exercised end-to-end
- [x] GRANT/REVOKE migration scoping `migrate_anonymous_scans` EXECUTE to `authenticated` (and revoked from `anon`)

### Chunk 3 — Initialization sequence + dashboard handoff ✅ done (PR #40, `48b60ac`)

- [x] Cinematic initialization sequence — "Initializing Royaltē OS…" with checkmark progression
- [x] Founding Artist counter logic — first 1,000 verified signups gate
- [x] Audit modal removal — `openAuditModal`, `submitAuditModal`, and the modal markup
- [x] Dashboard data wiring — load the migrated scan into the dashboard view
- [x] `dashboard.html` auth gating
- [x] `/dashboard.html` un-parked — the `vercel.json` 302 redirect was removed

## Block B — Dashboard tier gating ✅ done (PR #42, `dd460ff`)

- [x] Tier-gating UI — grayed-card lock overlays (no blur, per the PR #23 decision) on the dashboard's Action Plan, Issue Details, Revenue Risk, and Platforms sections; homepage issue descriptions gated.
- [x] "Unlock Full Audit →" CTA on locked sections (no price displayed — Stripe is Block C). `profiles.tier` column added; `data-lock-cta` contract established for the Block C swap.

Scope note: Block B gated only the sections that existed at the time — Monitoring / Alerts / "Why This Matters" gating was deferred (see Follow-ups).

## Block C — Stripe payment (2 days) — `BLOCKED: see Tier 1 (LLC + Mercury + Stripe account)`

V5 Phase 2 (PR #46) already shipped the pricing UI + the `founding_artist_reservations` table — Block C wires real checkout behind them, flipping `tier='pro'` (and `founding_artist=true` for the Founding Artist plan) on success.

- [ ] Create Stripe products + prices matching the shipped pricing UI: Founding Artist Access ($99 one-time), Monthly Monitoring ($19.99/mo)
- [ ] Build `/api/create-checkout-session.js`
- [ ] Wire "Upgrade" buttons to create checkout sessions
- [ ] Pass `scan_id` from localStorage as Stripe metadata
- [ ] Build `/api/stripe-webhook.js`:
  - [ ] `checkout.session.completed` → create user, link scan, send set-password email
  - [ ] `customer.subscription.updated` → update subscription row
  - [ ] `customer.subscription.deleted` → mark canceled
  - [ ] `invoice.payment_failed` → mark past_due
- [ ] Idempotency via Stripe event ID
- [ ] End-to-end test in Stripe test mode

## Block D — Monitoring auto-scan + diff ✅ done (PR #44, `cedadf6`; fix PR #45)

Shipped — with implementation that differs from this section's original sketch:

- [x] Vercel cron — `/api/cron/rescan.js`, daily 06:00 UTC (not `weekly-rescan.js` / 3am)
- [x] Cron queries `profiles` due for rescan (`next_rescan_at <= now()`); reuses the scan engine via the extracted `api/_lib/run-scan.js`
- [x] Diff computed into `scan_changes` rows (not `scan_diffs`) — issue_new / issue_resolved / score_change / revenue_risk_change / platform_change, via `api/_lib/compute-changes.js`
- [x] `scan_snapshots` table — one canonical-payload snapshot per rescan; the dashboard reads living state from it
- [x] Dashboard Monitoring card — tier/status-aware (Pro active view; Free grace_period; Free inactive protection-loss banner)
- [x] Free grace-period → one rescan → `inactive`; Pro → continuous weekly rescans
- [ ] ~~Send "Weekly Check-in" email via Resend~~ — deferred to Block E (email/push alerts)

Follow-up fix (PR #45): `computeChanges` originally matched issues by content-hash id, producing phantom diffs on metric drift — now matched on a stable normalized key.

## Block E — Manual rescan + rate limiting (0.5 days)

- [ ] Dashboard "Rescan now" button → `/api/manual-rescan.js`
- [ ] Endpoint checks `rescan_log` for last 24h, enforces 1/day
- [ ] Triggers scan, writes log

## Block F — Polish + edge cases (1 day)

- [ ] Empty states (no scan yet, no diff yet)
- [ ] Loading states for all async calls
- [ ] Error states (scan failed, payment failed, expired session)
- [ ] Account settings page: change password, cancel subscription, change Spotify URL, change email

## Block G — Dashboard history view (1 day)

- [ ] `/api/scans/history.js` returns Monitoring user's past scans
- [ ] Sidebar nav adds "History" route
- [ ] List view of past scans + view any past scan as frozen snapshot

---

## Pre-launch (non-block) items

Things that aren't in the block sequence but need to be done before June 1.

### Legal
- [ ] Terms of Service drafted + linked in footer
- [ ] Privacy Policy drafted + linked in footer
- [ ] Refund Policy drafted + linked in footer (Stripe needs this)

### Marketing / launch
- [ ] Beta announcement plan (channels, copy, timing)
- [ ] Marketing site copy reviewed end-to-end for the "no money-recovery promises" rule
- [ ] Remove noindex + redirect from `public/dashboard.html` when ready

### Ops / monitoring
- [ ] Support inbox monitoring plan for `info@royalte.ai` (who watches, response SLA)

Analytics, error monitoring, and uptime checks moved to On Deck → Tier 3 — Marketing / Ops.

---

## Decisions needed

These need answers before the blocks they affect can ship.

1. **Stripe tax handling** — Stripe Tax or customer-provided? (Affects Block C)
2. **Subscription cancellation UX** — immediate or end-of-period? (Affects Block C)
3. **Monitoring cancellation data handling** — keep account at Full Audit tier, downgrade to Free, or delete after retention? (Affects Block C)
4. ~~**Failed Monitoring scan handling**~~ — RESOLVED in Block D: a degraded rescan is skipped entirely (no snapshot, no diff), `next_rescan_at` left unchanged so the next cron cycle retries. No backoff counter for V1.
5. **Spotify URL change** — user-editable + triggers rescan, or locked at signup? (Affects Block F)
6. **Stripe email vs Supabase Auth email** — auto-use Stripe email or let user choose at set-password? (Leaning: auto-use Stripe.) (Affects Block C)
7. **Refund data handling** — keep scan, revoke access immediately, retention window? (Affects Block C + refund policy doc)

---

## Done

Items get moved here when checked off. Keeps the active list scannable.

### Scan UX clarity — PR #24 (merged 2026-05-14)

Removed frontend inversion of audit scores. Displayed score is now the
raw backend risk value (higher = more risk). Flipped getScoreBand to
a 4-tier model (Low / Moderate / At Risk / Critical, 0-30 / 31-60 /
61-80 / 81-100). Added left-column "Understanding Your Risk Score"
decoder panel with calm Bloomberg-style legend + colored dots.
Reformatted section numbers as "+N risk". Replaced "You are losing
royalties right now" alert banner with the intelligence-framed
"Royaltē detected verified royalty-risk issues in your backend setup"
(removes money-recovery claim that violated locked positioning rule).
Rewrote all 4 MODULE_COPY band variants per module (healthy / warning
/ atrisk / danger) with consistent risk vocabulary. Generalized
Wikipedia finding to "public artist authority signal" so the audit
engine can expand to MusicBrainz / Discogs / knowledge panels without
copy rework. Updated ISRC, genre, and authority findings in both
index.html and audit.html.

Polish refinements landed in second commit on same PR:
- "elevated royalty and metadata risk" → "elevated risk to royalty collection"
- Appended "and backend risk exposure" to decoder body second sentence
- Reduced foot helper opacity to 0.7 so it reads as helper text below the legend

### Mobile scan visibility — PR #26 (merged 2026-05-14)

`.hero-right` was `display:none` at ≤900px, hiding the entire scan
dashboard (score, banner, section cards, findings, CTA) from mobile
users. Most artists scan from phones, so this was a conversion black
hole on the most common device.

Removed the display:none rule and let `.hero-right` stack naturally
below `.hero-left` on mobile. Decoder panel condensed on mobile
(header + 4-row legend kept; body paragraph and foot helper hidden).
Producer photo kept visible as a visual divider between input section
and stacked results section. Desktop slide-in-from-right animation
swapped for fade-up on mobile so the now-stacked column animates in
the correct direction. Internal dashboard padding tightened slightly
for narrow widths.

No backend changes. No new design tokens. All work inside the existing
≤900px media query.

### Blog Part 3 published + blog index cards synced — PR #28 (merged 2026-05-15)

Published Part 3 of the AI Music & Royalties series ("The Silent Money
Leaks Killing Independent Artists") to the Knowledge Hub. Article URL:
/blog/silent-money-leaks-killing-independent-artists.html.

6 body sections, 4 required positioning lines preserved verbatim,
locked baked-in CTAs (mid-cta + Founding Artist final-cta), per-article
hero used as og:image (override from generic /og-image.jpg used on the
3 existing articles). IndexNow auto-fired, sitemap entry added,
production smoke-test green.

Scope expanded mid-PR to fix three stale cards in public/blog.html
that surfaced during discovery: added Part 1 card (was completely
missing from index despite article being live), fixed "Why Your
Spotify Streams" card (broken slug link + stale coming-soon status).

### Blog index drift guard — PR #29 (merged 2026-05-15)

public/blog.html hand-maintains the article card grid in parallel
with public/js/blog-posts.js (the canonical registry that drives
related-articles blocks + IndexNow). Nothing enforced sync between
the two, and they drifted repeatedly — Part 3's PR had to fix three
stale cards at once.

Considered moving the grid to JS rendering, but the repo deliberately
keeps cards as static HTML for non-JS-executing AI crawler visibility
(ChatGPT, Perplexity, Bing, Claude) — documented in blog.html,
blog-posts.js, and blog/README.md. Kept the static cards and added a
build-time drift check instead.

tests/blog-index-sync-test.mjs parses both files and asserts a 1:1
match on title, excerpt, category, status, and meta. Errors name the
slug, the field, and both values with a fix instruction. Wired into
the existing "Run pipeline test" required check, so branch protection
blocks merges on drift with no ruleset change.

Result: drift bug class is permanently closed without trading off
AI-crawler visibility.

### Blog SEO backfill — PR #31 (merged 2026-05-15)

Sitemap and og:image consistency cleanup for the 3 articles published
before Part 3. Added sitemap.xml entries for suno-ai-release-risks and
why-your-spotify-streams-dont-match-your-money (both live but never
listed). Switched all 3 existing articles' og:image and twitter:image
from the generic /og-image.jpg to their per-article hero images, with
og:image:width/height corrected to each hero's real dimensions —
matching the pattern Part 3 introduced.

### CTA library commit + blog README refresh — PR #32 (merged 2026-05-15)

Committed the blog CTA library to /docs/blog-cta-variants.md (12 CTA
variants — 6 cold-reader, 6 warm-reader — with usage notes and SEO
keyword pairings) so it survives session boundaries as the canonical
reference for future article briefs.

Refreshed public/blog/README.md for accuracy: replaced the stale
Week 1-5 "Locked Article Order" roadmap with the actual current state
(4 articles live, AI series Parts 1 + 3 live, 2 + 4 planned), corrected
the "sitemap currently absent" note, updated the Hero Images section to
real dimensions, and added references to the drift guard test, IndexNow
auto-fire, and the CTA library. Preserved the documented AI-crawler
visibility decision and hand-maintained card grid rationale.

### Dashboard Phase 1 — Royaltē OS V4 evolution — PR #33 (merged 2026-05-15)

First evolution PR moving public/dashboard.html + public/js/dashboard.js
toward the Royaltē OS V4 spec. Four bounded changes:

- Positioning copy scrub — removed every "recover" / "recovery"
  reference across both files (mockData and the real-data
  mapScanToDashboard path); also fixed a regression where renderHeader()
  overwrote PR #24's parked welcome-sub copy.
- Revenue Risk model rebalance — replaced the "$1K-$10K+" placeholder
  with V4-pattern probabilistic ranges ("$420 – $2,100 annually"),
  dropped the "+" suffix everywhere, added a Confidence label to both
  data paths.
- Hero stat CSS emphasis — Revenue at Risk now visually dominates the
  hero stat row (larger value with glow, tier rendered as a pill);
  Issues Found and Things Working shrink to supporting size.
- Statement Upload preview tile — new locked/preview card between the
  Action Plan row and Platforms, inert "Coming Soon" state, signaling a
  future Royaltē OS capability.

Out of scope (later phases): sidebar expansion, degradation states,
Alert Center, multi-page routing, auth, real upload backend.

### V5 Phase 1 — homepage positioning shift — PR #35 (merged 2026-05-15, `6c5407a`)

Reframed the homepage as a detection/signal layer per the V5 spec.
Compressed flag rendering to locked 🔒 signals, replaced the legacy
`.d-conversion` block with the "Continue Inside Royaltē OS"
continuation section, stacked the email form vertically, and rewired
the nav CTA to scroll to the continuation section.

### Block A Chunk 1 — auth schema foundation — PR #36 (merged 2026-05-15, `d4da105`)

Schema groundwork for Supabase magic-link auth. `profiles` table
(1:1 with `auth.users`) + RLS + an auto-create-profile trigger;
`audit_scans` gained nullable `user_id` and `session_id`;
`migrate_anonymous_scans(text, uuid)` RPC (SECURITY DEFINER) to claim
anonymous scans onto a user account. No UI / client code. Migration
applied via psql over the Session Pooler.

### Block A Chunk 2 — magic-link delivery + homepage wiring — PR #37 (merged 2026-05-15, `8259796`)

Made signup work. New `public/js/supabase-client.js` (browser anon
client singleton + `getOrCreateSessionId()`); the V5 continuation CTA
now calls `signInWithOtp` instead of opening the audit modal; new
`/auth/callback` handler verifies the session, calls
`migrate_anonymous_scans`, and shows a static "Welcome to Royaltē OS"
holding page (no redirect — dashboard stays parked). A follow-up
GRANT/REVOKE migration scopes the RPC to `authenticated` only (revoked
from `anon`). `api/audit.js` now accepts an optional `session_id`.
Smoke-tested end-to-end on a Vercel preview before merge.

### .gitignore hygiene — PR #38 (merged 2026-05-15, `42e5023`)

Added `.vercel` to `.gitignore` — the Vercel CLI's local project-
linkage directory, which must never be committed.

### V5 spec lock-in — locked 2026-05-16

V5 is now the primary source of truth, superseding V4. V4 artifacts
in this checklist and elsewhere are retained for the record only;
all new work references V5.

### Block A Chunk 3 — initialization sequence + dashboard handoff — PR #40 (merged 2026-05-15, `48b60ac`)

Cinematic 5-step "Initializing Royaltē OS" sequence on `/auth/callback`;
Founding Artist counter (advisory-locked, 1,000 cap); audit modal fully
removed; dashboard auth-gated and wired to render the migrated scan;
`/dashboard.html` un-parked. Block A complete.

### Block B — tier-gating UI — PR #42 (merged 2026-05-16, `dd460ff`)

`profiles.tier` column; `<body>` `.tier-free` / `.tier-pro` class;
grayed-card lock overlays (no blur, per PR #23) on the dashboard's
Action Plan / Issue Details / Revenue Risk / Platforms and on homepage
issue descriptions; "Unlock Full Audit →" CTAs via the `data-lock-cta`
contract; `#upgrade` placeholder. Existing always-on locks made
tier-conditional.

### Dead-code cleanup — mapScanToDashboard cluster — PR #43 (merged 2026-05-16, `999b8e7`)

Deleted the dead V1 localStorage scan→dashboard handoff cluster
(`mockData`, `getDashboardData`, `SCAN_KEY`/`SCAN_TIME_KEY`,
`mapScanToDashboard`) from `dashboard.js` — unreachable since Chunk 3
swapped the dashboard to the canonical mapper. 258-line removal, no
behavior change.

### Block D — monitoring foundation — PR #44 (merged 2026-05-16, `cedadf6`)

Scheduled rescans + living backend state. `scan_snapshots` +
`scan_changes` tables; `profiles.monitoring_status` + `next_rescan_at`;
daily `/api/cron/rescan.js`; the scan engine extracted to
`api/_lib/run-scan.js` (callable by both `/api/audit` and the cron);
`computeChanges` diff; tier/status-aware dashboard Monitoring card.
Free users get one grace-period rescan then go inactive; Pro users get
continuous weekly monitoring.

### computeChanges stable issue matching — PR #45 (merged 2026-05-16, `fb7940e`)

Fixed a diff-quality bug found in the Block D cron dry-run: issue ids
are content hashes of titles that embed volatile metrics, so a metric
tick produced phantom resolved+new pairs. `computeChanges` now matches
issues on a normalized key (module + severity + digit-stripped title).
Verified live: 0 spurious changes on a real rescan.

### V5 Phase 2 — Founding Artist pricing + reservations — PR #46 (merged 2026-05-16, `326709a`)

`founding_artist_reservations` table; rate-limited
`POST /api/founding-artist/reserve` (idempotent upsert, optional session
link); dashboard Welcome panel + two-card pricing section ($99 Founding
Artist / $19.99-mo Monthly); reservation flow with a "Reservation
Confirmed" state. Founding Artist is a billing flag (`tier='pro'` +
`founding_artist=true`), not a new tier — pre-Stripe intent capture only.

### Blog Part 4 — "The Backend Infrastructure Powering Modern Music" — PR #47 (merged 2026-05-16, `32fecda`)

Final article in the AI Music & Royalties series, at
`/blog/the-backend-infrastructure-powering-modern-music.html`. Built to
the Part 3 structure; registry + blog-index card added in sync (drift
guard passes); 4 required positioning lines verbatim; IndexNow
auto-submits the URL on merge.

---

## Follow-ups (queued, not yet on On Deck)

Items surfaced during recent sessions that need PRs but aren't on the
critical path:

### Blog SEO + content hygiene

- [ ] **Embedded "Metadata Is The New Management" mid-article image for Part 3** — Part 3 source brief called for a second image embedded in Section 3. Asset doesn't exist yet. Follow-up PR once the image is generated/sourced.

- [ ] **Part 2 of AI Music & Royalties series doesn't exist** — series is now 1, _, 3, 4 of 4 (Parts 1, 3, 4 live; Part 2 never written). Part 2 simply doesn't appear in related-articles (registry-driven). Content-pipeline gap. Needs writing.

### Phase 2 dashboard evolution

- [ ] **Degradation states** — "monitoring inactive", "last scan: N days ago", "risk estimate may be outdated". The dashboard currently assumes everything-active.

- [ ] **Alert Center scaffolding** — page route + alert categories per V4: metadata inconsistency, platform mismatch, duplicate release, ownership inconsistency.

- [ ] **Sidebar expansion to V4's 6 functional sections** — Dashboard / Revenue Risk / Issues Found / Alerts / Monitoring / Scan History.

- [ ] **Present-but-locked nav for the 8 V4 preview sections** — Catalog / Action Center / Reports / Activity Feed / Platforms / AI Insights / Settings / Billing.

- [ ] **Statement Upload backend** — parsing engine for PRO/DSP/distributor/publishing/royalty accounting statements; comparison logic against existing scan data; encrypted storage for sensitive financial files. Phase 1 shipped the inert preview tile only.

- [ ] **Multi-page routing decision** — separate HTML files vs SPA routing vs same-page sections. Gates how the Phase 2 sidebar links work.

### V4 spec — archived

- [x] ~~**V4 spec commit** — commit the full Royaltē OS V4 spec to `/docs/royalte-os-v4-spec.md`~~ — dropped; V4 superseded by V5.
- [x] ~~**V4 quick-reference one-pager** — `/docs/royalte-os-quick-reference.md`~~ — dropped; V4 superseded by V5.

V4 docs are not to be expanded post-V5 lock-in (2026-05-16); V4 artifacts are retained for historical record only.

### audit.html cleanup

- [ ] **Inert dead-code cleanup** — `.hero-right{display:none}` at audit.html L369 is unreachable (overridden by `.audit-page #scan-tool .hero-right{display:flex}` at L908). Remove or comment to reduce future-developer confusion. Low priority.

- [ ] **Full mobile QA sweep of audit.html** — the Phase 1 audit was scoped to `.hero-right` only. Other mobile-breakable patterns may exist elsewhere on the page. Sweep before launch.

### Pre-launch (CTA strategy)

- [ ] **Blog CTA audit** — decide steady-state post-beta CTA copy (the current Founding Artist 1,000 Spots scarcity play expires at launch). Use the CTA library variants to choose. Update template once, propagates to all articles.

- [ ] **/pricing.html page** — doesn't exist yet, must be built before warm-reader CTAs can go live. Pre-launch dependency.

### V5 auth / Block A follow-ups

- [ ] **Rotate Supabase DB password** — the production DB password was pasted in chat during Chunk 1 and Chunk 2 migration work, so it should be rotated (Supabase dashboard → Settings → Database). The DB password is independent of `SUPABASE_SERVICE_ROLE_KEY`, so rotating does not affect the Vercel functions.

- [ ] **Migrate the `runAudit` script block to an ES module** — `runAudit()` lives in a regular non-module `<script>` block, so Chunk 2 added a `window.getOrCreateSessionId` bridge to reach the module helper. Converting that block to an ES module drops the bridge and the window-namespace pollution. Touches many inline `onclick=` handlers — needs care.

- [ ] **Custom magic-link email template** — Chunk 2 ships on Supabase's default magic-link email. Replace with a V5-toned branded template (Supabase dashboard → Authentication → Email Templates).

### Block B follow-ups

Block B gated only the sections that exist today. These were scoped out because the content doesn't exist yet — gate them when it does:

- [ ] **Write "Why This Matters" premium copy** — the explanation layer is the intended biggest conversion driver, but no discrete WTM content exists yet. Write it as net-new premium content, then gate it.
- [x] ~~**Gate the Monitoring section**~~ — done: Block D (PR #44) built the Monitoring card tier/status-aware (Pro active view; Free grace/inactive with an "Activate Monitoring" lock CTA).
- [ ] **Gate the Alerts section** — once Alerts exist (no Alerts section in the dashboard today).

### Block D follow-ups

- [ ] **Cron batch size vs function timeout** — at scale (>10 active monitored users) the 50-user sequential scan won't fit in the 300s function budget. Revisit (smaller batches / multiple daily runs) when the active monitored user count grows.
- [ ] **Remove the `audit_scans` fallback in `loadLatestScan`** — the dashboard reads `scan_snapshots` with a temporary `audit_scans` fallback for users without a snapshot. Drop the fallback once snapshot coverage is confirmed for all users.

### V5 Phase 2 follow-ups

- [ ] **Founding Artist reservation flow — live verification** — the reserve flow (PR #46) was build-verified only; exercise a real logged-in reserve POST → "Reservation Confirmed" on production.
- [ ] **Block B tier-overlay live visual check** — the tier-overlay / lock states were not eyeballed on a live session pre-merge (Supabase rate limit); verify free overlays show / pro overlays hidden via an SQL tier-flip on production.

---

*Last updated: 2026-05-16*
