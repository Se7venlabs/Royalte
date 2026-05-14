# Royaltē Launch Checklist

**Target:** June 1, 2026 beta launch
**Owner:** Darryl West, Se7ven Labs Inc.
**Status:** Living document — update at end of every working session.

This is the source of truth for what's left. Not memory, not chat history. If
it's not in here, it's not tracked.

---

## Today / On Deck

The next 2-3 actionable items. Update this section every session.

- [ ] **Mobile scan visibility (URGENT)** — Right column with score/banner/sections/findings/CTA is hidden at ≤900px (`.hero-right` `display:none`). Most artists scan on mobile and currently see nothing useful below the hero. Needs dedicated PR with mobile design pass.
- [ ] **Block A · Auth foundation** — first thread to pull on dashboard wiring. No external dependency, unblocks B onward.
- [ ] **Business foundation in flight** — LLC, Mercury, Stripe business account, TikTok. See Business foundation section.
- [ ] **Legal pages drafting** — ToS, privacy, refund policy. Can run in parallel with Block A.

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

## Mobile scan visibility (urgent, conversion-critical)

Most artists scan from phones. The current `public/index.html` layout
hides `.hero-right` at ≤900px, meaning mobile users see the hero,
input, "Run Free Scan" button, and trust badges — but no scan results.
No score. No banner. No section cards. No findings. No CTA. Discovered
during PR #24 (feat/scan-ux-clarity) pre-flight.

- [ ] Confirm intent: is mobile hiding intentional (mobile funnels to email PDF) or an unintentional pre-existing gap?
- [ ] If unintentional: design a mobile presentation of scan results that preserves the v4 decoder panel + scoring vocabulary
- [ ] Implement responsive layout for mobile scan view
- [ ] Verify decoder panel position works in stacked mobile order (between hero and score card per v4 spec)
- [ ] Consider mobile collapse pattern for decoder panel (accordion or condensed) — desktop-first locked, mobile pattern TBD
- [ ] Verify "+N risk" treatment + section-card red-bar visuals render correctly on narrow viewports
- [ ] Vercel preview check on real mobile device, not just devtools emulator

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

---

*Last updated: 2026-05-14*
