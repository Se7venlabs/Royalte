# Royaltē Launch Checklist

**Target:** June 1, 2026 beta launch
**Owner:** Darryl West, Se7ven Labs Inc.
**Status:** Living document — update at end of every working session.

This is the source of truth for what's left. Not memory, not chat history. If
it's not in here, it's not tracked.

---

## Today / On Deck

The next 2-3 actionable items. Update this section every session.

- [ ] **Block A · Auth foundation** — first thread to pull. No external dependency, unblocks B onward.
- [ ] **Decision: Free Scan locked-section UI treatment** — needs answer before Block B's tier-gating UI work.
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
- [ ] Build tier-gating UI: locked sections look intentional, not broken
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

1. **Free Scan locked-section UI** — blur + overlay, grayed cards, or hidden? (Affects Block B)
2. **Stripe tax handling** — Stripe Tax or customer-provided? (Affects Block C)
3. **Subscription cancellation UX** — immediate or end-of-period? (Affects Block C)
4. **Monitoring cancellation data handling** — keep account at Full Audit tier, downgrade to Free, or delete after retention? (Affects Block C)
5. **Failed Monitoring scan handling** — retry next day, skip to next week, email user? (Affects Block D)
6. **Spotify URL change** — user-editable + triggers rescan, or locked at signup? (Affects Block F)
7. **Stripe email vs Supabase Auth email** — auto-use Stripe email or let user choose at set-password? (Leaning: auto-use Stripe.) (Affects Block C)
8. **Refund data handling** — keep scan, revoke access immediately, retention window? (Affects Block C + refund policy doc)

---

## Done

Items get moved here when checked off. Keeps the active list scannable.

(empty for now)

---

*Last updated: 2026-05-14*
