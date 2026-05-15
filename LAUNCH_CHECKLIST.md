# Royaltē Launch Checklist

**Target:** June 1, 2026 beta launch
**Owner:** Darryl West, Se7ven Labs Inc.
**Status:** Living document — update at end of every working session.

This is the source of truth for what's left. Not memory, not chat history. If
it's not in here, it's not tracked.

---

## Today / On Deck

The next 2-3 actionable items. Update this section every session.

- [ ] **Block A · Auth foundation Chunk 1** — Supabase Auth provider + email confirmation, `profiles` table + RLS policies, auto-create-profile trigger, `user_id` column on `audit_scans`. Schema-only, no UI. Deferred from week 1.
- [ ] **V4 spec commit** — get the full Royaltē OS V4 spec + quick-reference one-pager into the repo so future Code briefs reference it from source, not from briefs.
- [ ] **Phase 2 dashboard evolution scoping** — decide the next bounded PR: sidebar expansion vs degradation states vs Alert Center.

---

## Business foundation (pre-launch, gates Block C)

- [ ] Setup LLC in Wyoming (Se7ven Labs / Royaltē entity)
- [ ] Open Mercury business bank account (requires LLC formation docs + EIN)
- [ ] Setup new Stripe business account under Royaltē (requires LLC + bank account)
- [ ] Setup TikTok Business account (marketing channel — independent dependency)

---

## Block A — Auth foundation (1.5 days, no blockers)

- [ ] Enable Supabase Auth Email provider; configure email confirmation required
- [ ] Create `profiles` table + RLS policies
- [ ] Create trigger: insert into `profiles` when `auth.users` row created
- [ ] Build `/login.html` matching dashboard brand voice
- [ ] Build `/signup.html` matching dashboard brand voice
- [ ] Build `/set-password.html` that consumes Supabase magic link tokens
- [ ] Build session check + logout in shared `/js/auth.js`
- [ ] Add `user_id` column to `audit_scans`

## Block B — Dashboard auth wiring + tier gating (1.5 days, no blockers)

- [ ] Dashboard reads current session on load
- [ ] No session → show free-scan-anonymous mode (limited visibility)
- [ ] Session → fetch user's profile + tier + most recent scan
- [ ] Replace mock data with real Supabase queries
- [ ] Build tier-gating UI: grayed-out cards with lock icon + "Unlock Full Audit $19.99" CTA per locked section (no blur, no hidden — show structure, not fake content)
- [ ] "Unlock Full Audit" prompts on locked features for Free tier

## Block C — Stripe payment (2 days) — `BLOCKED: see Business foundation section (LLC + Mercury + Stripe account)`

- [ ] Create Stripe products + prices: `full_audit_one_time` ($19.99), `monitoring_monthly` ($29.99/mo)
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

## Block D — Monitoring auto-scan + diff (2.5 days)

- [ ] Vercel cron `/api/cron/weekly-rescan.js` runs daily at 3am UTC
- [ ] Query monitoring users where `signup_day_of_week === today`
- [ ] For each: call `/api/audit`, persist new scan
- [ ] Diff against previous scan: new issues, resolved, score delta, metadata, territory
- [ ] Write `scan_diffs` row
- [ ] Send "Royaltē Monitoring · Weekly Check-in" email via Resend
- [ ] Update dashboard to render `scan_diffs`: "What's Changed" card + inline badges

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
- [ ] Analytics installed (PostHog or equivalent — TBD)
- [ ] Error monitoring installed (Sentry or equivalent — TBD)
- [ ] Uptime check on royalte.ai + key API endpoints
- [ ] Support inbox monitoring plan for `info@royalte.ai` (who watches, response SLA)

---

## Decisions needed

These need answers before the blocks they affect can ship.

1. **Stripe tax handling** — Stripe Tax or customer-provided? (Affects Block C)
2. **Subscription cancellation UX** — immediate or end-of-period? (Affects Block C)
3. **Monitoring cancellation data handling** — keep account at Full Audit tier, downgrade to Free, or delete after retention? (Affects Block C)
4. **Failed Monitoring scan handling** — retry next day, skip to next week, email user? (Affects Block D)
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

---

## Follow-ups (queued, not yet on On Deck)

Items surfaced during recent sessions that need PRs but aren't on the
critical path:

### Blog SEO + content hygiene

- [ ] **Embedded "Metadata Is The New Management" mid-article image for Part 3** — Part 3 source brief called for a second image embedded in Section 3. Asset doesn't exist yet. Follow-up PR once the image is generated/sourced.

- [ ] **Part 2 of AI Music & Royalties series doesn't exist** — series is currently 1, _, 3 of 4. Reader who lands on Part 3 sees the series numbering and Part 2 simply doesn't appear in related-articles (registry-driven). Content-pipeline gap. Needs writing.

### Phase 2 dashboard evolution

- [ ] **Degradation states** — "monitoring inactive", "last scan: N days ago", "risk estimate may be outdated". The dashboard currently assumes everything-active.

- [ ] **Alert Center scaffolding** — page route + alert categories per V4: metadata inconsistency, platform mismatch, duplicate release, ownership inconsistency.

- [ ] **Sidebar expansion to V4's 6 functional sections** — Dashboard / Revenue Risk / Issues Found / Alerts / Monitoring / Scan History.

- [ ] **Present-but-locked nav for the 8 V4 preview sections** — Catalog / Action Center / Reports / Activity Feed / Platforms / AI Insights / Settings / Billing.

- [ ] **Statement Upload backend** — parsing engine for PRO/DSP/distributor/publishing/royalty accounting statements; comparison logic against existing scan data; encrypted storage for sensitive financial files. Phase 1 shipped the inert preview tile only.

- [ ] **Multi-page routing decision** — separate HTML files vs SPA routing vs same-page sections. Gates how the Phase 2 sidebar links work.

### V4 spec

- [ ] **V4 spec commit** — commit the full Royaltē OS V4 spec to `/docs/royalte-os-v4-spec.md` so future sessions reference it from source, not from briefs.

- [ ] **V4 quick-reference one-pager** — `/docs/royalte-os-quick-reference.md` for Code session priming.

### audit.html cleanup

- [ ] **Inert dead-code cleanup** — `.hero-right{display:none}` at audit.html L369 is unreachable (overridden by `.audit-page #scan-tool .hero-right{display:flex}` at L908). Remove or comment to reduce future-developer confusion. Low priority.

- [ ] **Full mobile QA sweep of audit.html** — the Phase 1 audit was scoped to `.hero-right` only. Other mobile-breakable patterns may exist elsewhere on the page. Sweep before launch.

### Pre-launch (CTA strategy)

- [ ] **Blog CTA audit** — decide steady-state post-beta CTA copy (the current Founding Artist 1,000 Spots scarcity play expires at launch). Use the CTA library variants to choose. Update template once, propagates to all articles.

- [ ] **/pricing.html page** — doesn't exist yet, must be built before warm-reader CTAs can go live. Pre-launch dependency.

---

*Last updated: 2026-05-15*
