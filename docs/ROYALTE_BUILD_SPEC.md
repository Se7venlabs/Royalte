# Royaltē — Master Build Spec
## Phase 1 Launch Plan (Audit Only + Monitoring)

**Spec date:** May 9, 2026
**Owner:** Darryl West (Se7ven Labs Inc.)
**Implementation:** Darryl + Claude Code (no contractor)
**Status:** Spec locked. Ready for build.

---

## 1. Product Definition

### 1.1 Two Products, One Codebase

| Product | Price | Type | What's Included |
|---|---|---|---|
| Audit Only | $19.99 | One-time payment | Full Audit emailed once. No monitoring. |
| Monitoring | $29.99/mo or $299/yr | Recurring subscription | Initial audit + daily scans + weekly Friday reports + critical email alerts |

### 1.2 Beta Phase

- First **200 free audits** at current free-flow pricing ($0)
- After 200, paywall activates — free flow disabled, paid flow enabled
- 200-counter is a Supabase-tracked global counter on `audit_scans` table

### 1.3 Positioning (Immutable)

> *"Royaltē does not collect royalties. Royaltē monitors catalog/backend infrastructure and identifies risks using Verified Data Only."*

This must appear in every customer-facing surface. No royalty-collection promises anywhere.

---

## 2. Monitoring Behavior

### 2.1 Scan Cadence (Model C)

**Daily lightweight scans:**
- Platform availability check
- Broken-link detection
- Major metadata change detection
- Recent release detection
- UGC/YouTube movement (if available)
- Alert-triggering deltas only

**Weekly Friday deep scan:**
- Full audit re-run (all 6 modules)
- Metadata integrity, platform coverage, publishing risk, duplicate detection, YouTube/UGC, sync readiness
- Risk score movement calculated
- Unresolved issue summary
- New action items surfaced

### 2.2 Alert Tier System

**Tier 1 — Critical (immediate email + dashboard pulsing red)**
Triggers:
- Track disappears from a major platform
- Artist/release metadata changes significantly
- ISRC missing or no longer visible
- Platform coverage drops
- Release link breaks
- Major credit/ownership inconsistency
- YouTube/UGC issue with meaningful risk
- Royalty infrastructure issue requiring fast attention

**Tier 2 — Notable (weekly digest + dashboard, no immediate email)**
Triggers:
- New metadata mismatch
- Minor platform inconsistency
- Genre/category drift
- New coverage gap on lower-priority platform
- Risk score movement >5 points
- New action item detected
- Existing issue remains unresolved

**Tier 3 — Informational (dashboard only, no email ever)**
Triggers:
- Daily scan completed
- No material change detected
- Minor score movement <5 points
- Normal catalog updates
- Previously detected issue still unchanged

### 2.3 Alert Resolution (Auto-Resolve)

Phase 1: alerts auto-resolve when the next daily/weekly scan no longer detects the issue.
- No dashboard resolve button
- No "mark resolved" email link
- Resolved alerts remain in history if storage exists
- No "good news" emails when something auto-resolves

Phase 2: add manual resolve/archive controls.

### 2.4 Weekly Report Delivery

- Every Friday at **9:00 AM America/Toronto** (Eastern Time)
- Single send time, no per-user timezone in Phase 1
- Email contains: new issues, unresolved issues, fixed/improved items, score movement, recommended next steps
- Phase 2: add user timezone capture for local-time delivery

### 2.5 Cancellation Behavior

- Active subscription = monitoring active
- Canceled subscription = all monitoring stops (daily scans, alerts, weekly reports)
- Past purchased Full Audit remains accessible/retrievable
- Phase 1: cancel only, no pause functionality
- Phase 2: optional pause feature if churn becomes an issue

---

## 3. Post-Purchase Experience

Custom Royaltē-branded success page after Stripe checkout, NOT generic Stripe redirect.

### 3.1 Audit Only Success Page Copy
- "Your Royaltē audit is being prepared."
- Confirms PDF will be sent to checkout email
- Notes Audit Only is one-time, no ongoing monitoring
- CTA: "Want continuous monitoring? Upgrade to Monitoring"

### 3.2 Monitoring Success Page Copy
- "Your Royaltē audit is being prepared."
- Confirms PDF will be sent to checkout email
- Confirms monitoring is now active
- Notes daily scans starting tomorrow
- Notes weekly reports send every Friday 9am ET
- Notes critical alerts will email if detected

### 3.3 Page Implementation
- Single template, conditional rendering by Stripe `?session_id=` and product type
- No login required (Phase 1)
- No dashboard required (Phase 1)
- Reuses existing Royaltē styling (dark cinematic, JetBrains Mono, green accent)

---

## 4. Phase 1 vs Phase 2 Split

### Phase 1 — Launch (Build Everything Below)

| Component | Status | Estimated Hours |
|---|---|---|
| Stripe products configured (manual, Stripe dashboard) | Not started | 0.5 |
| Stripe Checkout integration (Audit Only flow) | Not started | 3 |
| Stripe Checkout integration (Monitoring flow) | Not started | 2 |
| Stripe webhook handler (payment success → unlock audit) | Not started | 3 |
| Stripe webhook handler (subscription cancel → stop monitoring) | Not started | 1 |
| 200-free-audit counter logic | Not started | 2 |
| Paywall gating (env var `PAYWALL_ENABLED`) | Not started | 1 |
| Branded post-purchase success page (Audit Only + Monitoring variants) | Not started | 2 |
| Supabase schema additions (subscriptions, alerts, scans) | Not started | 1.5 |
| Daily monitoring scan cron (lightweight) | Not started | 4 |
| Weekly Friday deep scan cron (full audit re-run) | Not started | 2 |
| Alert classification logic (3-tier) | Not started | 3 |
| Alert auto-resolve logic | Not started | 1.5 |
| Critical alert email send (Resend) | Not started | 1.5 |
| Weekly Friday report email send (Resend) | Not started | 2 |
| Drip email sequence (4 emails post-audit) | Not started | 3 |
| Dashboard pulsing-red indicator (basic, no auth) | Not started | 2 |
| Feature flag plumbing across all of above | Not started | 1.5 |
| **Phase 1 Total** | | **~36 hours** |

### Phase 2 — Post-Launch Enhancements

| Component | Estimated Hours |
|---|---|
| Full dashboard with auth (login/signup) | 6 |
| Report history viewer | 3 |
| Alert history viewer | 2 |
| Resolve/archive workflow | 2 |
| Subscription management UI (upgrade, cancel) | 3 |
| Past audit access for canceled users | 2 |
| Monitoring timeline visualization | 4 |
| User timezone capture + local-time scheduling | 2 |
| Pause subscription feature | 4 |
| **Phase 2 Total** | **~28 hours** |

**Grand Total to Real Product:** ~64 hours of focused work

At a sustainable 2-3 hours/day pace, Phase 1 is **3-4 weeks**. Phase 2 is **3 weeks**. Total: **6-7 weeks** to fully-realized product.

---

## 5. File Structure (Additions to Repo)

```
api/
  audit.js                    [EXISTING - touch only to add paywall gate]
  submit-audit.js             [EXISTING - touch to add drip-trigger]
  stripe/
    create-checkout.js        [NEW - generates Stripe Checkout session]
    webhook.js                [NEW - Stripe webhook handler]
  monitoring/
    daily-scan.js             [NEW - cron endpoint, runs lightweight scans]
    weekly-deep-scan.js       [NEW - cron endpoint, runs full audit re-runs]
    classify-alert.js         [NEW - tier 1/2/3 classification logic]
    resolve-stale-alerts.js   [NEW - auto-resolve helper]
  email/
    drip/
      send-sequence.js        [NEW - cron endpoint, processes drip queue]
      email-1-immediate.js    [NEW - shock + risk template]
      email-2-day-2.js        [NEW - invisible loss template]
      email-3-day-5.js        [NEW - protection/security template]
      email-4-day-10.js       [NEW - scarcity close template]
    alerts/
      critical-alert.js       [NEW - tier 1 immediate alert template]
      weekly-report.js        [NEW - Friday digest template]
    success/
      audit-only-confirmation.js     [NEW - post-purchase email]
      monitoring-welcome.js          [NEW - post-purchase email]
  _lib/
    royalteEmailTemplates.js  [EXISTING - retire, replaced by above]
    stripe.js                 [NEW - Stripe SDK wrapper]
    supabase-monitoring.js    [NEW - DB queries for alerts/scans]
    feature-flags.js          [NEW - env-var gating helpers]

public/
  index.html                  [EXISTING - touch for paywall toggle]
  audit.html                  [EXISTING - touch for paywall toggle]
  success.html                [NEW - post-purchase branded page]
  pricing.html                [EXISTING - currently parked, unpark on launch]
  dashboard.html              [EXISTING - basic alert indicator only Phase 1]

vercel.json                   [EXISTING - add cron schedules]
```

---

## 6. Supabase Schema Additions

```sql
-- Subscriptions table (NEW)
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  stripe_customer_id TEXT NOT NULL,
  stripe_subscription_id TEXT,
  product_type TEXT NOT NULL CHECK (product_type IN ('audit_only', 'monitoring_monthly', 'monitoring_annual')),
  status TEXT NOT NULL CHECK (status IN ('active', 'canceled', 'past_due', 'incomplete')),
  artist_name TEXT,
  spotify_url TEXT,
  scan_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  canceled_at TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ
);

-- Monitoring alerts table (NEW)
CREATE TABLE monitoring_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID REFERENCES subscriptions(id),
  tier INT NOT NULL CHECK (tier IN (1, 2, 3)),
  alert_type TEXT NOT NULL,
  message TEXT NOT NULL,
  detected_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  emailed_at TIMESTAMPTZ,
  scan_run_id UUID
);

-- Monitoring scan history (NEW)
CREATE TABLE monitoring_scans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID REFERENCES subscriptions(id),
  scan_type TEXT NOT NULL CHECK (scan_type IN ('daily_lightweight', 'weekly_deep')),
  ran_at TIMESTAMPTZ DEFAULT NOW(),
  scan_data JSONB,
  alerts_generated INT DEFAULT 0
);

-- Drip email tracking (NEW)
CREATE TABLE drip_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  scan_id UUID,
  artist_name TEXT,
  sequence_stage INT DEFAULT 1 CHECK (sequence_stage IN (1, 2, 3, 4)),
  last_sent_at TIMESTAMPTZ,
  completed BOOLEAN DEFAULT FALSE,
  unsubscribed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Beta counter (NEW or add to existing audit_scans)
ALTER TABLE audit_scans ADD COLUMN IF NOT EXISTS counted_in_beta BOOLEAN DEFAULT TRUE;
```

---

## 7. Stripe Configuration

**Stripe Dashboard setup (manual, before any code):**

| Product | Stripe Type | Price | Stripe ID Pattern |
|---|---|---|---|
| Audit Only | One-time | $19.99 USD | `prod_audit_only` / `price_audit_one_time` |
| Monitoring Monthly | Recurring | $29.99/month | `prod_monitoring` / `price_monitoring_monthly` |
| Monitoring Annual | Recurring | $299.00/year | `prod_monitoring` / `price_monitoring_annual` |

**Webhook events to handle:**
- `checkout.session.completed` → mark subscription active, trigger initial audit
- `customer.subscription.deleted` → mark monitoring stopped
- `customer.subscription.updated` → handle plan changes
- `invoice.payment_failed` → flag account, send recovery email

---

## 8. Environment Variables

```bash
# Existing
RESEND_API_KEY=
SUPABASE_URL=
SUPABASE_SERVICE_KEY=
SPOTIFY_CLIENT_ID=
SPOTIFY_CLIENT_SECRET=
APPLE_TEAM_ID=
APPLE_KEY_ID=
APPLE_PRIVATE_KEY=
TIDAL_CLIENT_ID=
TIDAL_CLIENT_SECRET=
DISCOGS_TOKEN=
YOUTUBE_API_KEY=

# NEW (Phase 1)
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRICE_AUDIT_ONLY=price_xxx
STRIPE_PRICE_MONITORING_MONTHLY=price_xxx
STRIPE_PRICE_MONITORING_ANNUAL=price_xxx

# Feature flags
PAYWALL_ENABLED=false                    # flip to true after 200 free audits
DRIP_ENABLED=false                        # flip to true when ready to ship drip
MONITORING_ENABLED=false                  # flip to true on launch
DASHBOARD_ENABLED=false                   # flip to true when Phase 2 ready

# Email config
EMAIL_FROM=info@royalte.ai
EMAIL_FROM_NAME=Royaltē
```

---

## 9. Cron Schedule (vercel.json additions)

```json
{
  "crons": [
    {
      "path": "/api/monitoring/daily-scan",
      "schedule": "0 6 * * *"
    },
    {
      "path": "/api/monitoring/weekly-deep-scan",
      "schedule": "0 13 * * 5"
    },
    {
      "path": "/api/email/drip/send-sequence",
      "schedule": "0 14 * * *"
    },
    {
      "path": "/api/monitoring/resolve-stale-alerts",
      "schedule": "0 7 * * *"
    }
  ]
}
```

**IMPORTANT:** Vercel Hobby tier limits cron to 2 invocations/day.
The schedule above requires **Vercel Pro** ($20/month).
Confirm tier upgrade before building cron logic, or compress crons into single endpoint with branching.

---

## 10. Drip Email Sequence (Reframed for Real CTAs)

The drip you wrote earlier needs reframing because:
1. The audit is no longer "locked" — it ships immediately on signup
2. Monitoring is now the upsell, not the audit unlock
3. CTAs need real Stripe destinations

**Email #1 (immediate):** Shock + personalize. CTA: "Activate Monitoring — $29.99/mo"
**Email #2 (Day 2):** Invisible loss + ongoing leakage. CTA: "Activate Monitoring"
**Email #3 (Day 5):** Protection/security framing. CTA: "Start Monitoring Your Catalog"
**Email #4 (Day 10):** Scarcity close. CTA: "Lock in Founding Pricing"

Final copy to be written/refined before drip ships. Use existing copy from May 9 spec doc as starting point, reframe "unlock your audit" language to "upgrade to monitoring."

---

## 11. Build Order (Recommended)

**Sprint 1 — Foundation (~10 hours):**
1. Create Supabase tables (1.5h)
2. Configure Stripe products in dashboard (0.5h)
3. Build feature flag library (1.5h)
4. Build branded success page (2h)
5. Build Stripe Checkout endpoint (Audit Only path) (3h)
6. Build Stripe webhook handler (basic) (1.5h)

**Sprint 2 — Paid Audit Flow (~8 hours):**
7. Wire paywall toggle into audit.html (1h)
8. Build 200-counter logic (2h)
9. Test Audit Only purchase end-to-end (1h)
10. Build Monitoring Checkout flow (2h)
11. Test Monitoring purchase end-to-end (1h)
12. Wire success page to both flows with conditional copy (1h)

**Sprint 3 — Monitoring Backend (~10 hours):**
13. Build daily scan cron (4h)
14. Build weekly deep scan cron (2h)
15. Build alert classification logic (3h)
16. Build auto-resolve logic (1h)

**Sprint 4 — Email Delivery (~7 hours):**
17. Build critical alert email (1.5h)
18. Build weekly Friday report email (2h)
19. Build drip sequence cron + 4 templates (3h)
20. End-to-end test all email paths (0.5h)

**Sprint 5 — Polish (~3 hours):**
21. Basic dashboard pulsing-red indicator (2h)
22. Full launch checklist run-through (1h)

---

## 12. Launch Activation Sequence

When everything is built and tested, launch is just config flips:

```
1. Stripe → activate live mode (currently in test mode)
2. Vercel env → PAYWALL_ENABLED=true
3. Vercel env → DRIP_ENABLED=true
4. Vercel env → MONITORING_ENABLED=true
5. Unpark pricing.html (remove Vercel redirect)
6. Update homepage CTAs to point to pricing
7. Send announcement email to free-tier users
```

That's the launch. No scrambling. No "we'll build that next week."

---

## 13. Open Questions / Decisions Deferred to Phase 2

- User timezone capture and local-time report delivery
- Pause subscription feature
- Manual alert resolve/archive workflow
- Full dashboard with auth, history, timeline
- Affiliate program (parked, not deleted, exists in repo)
- Tidal catalog integration (waiting on Tidal-side approval)
- "Good news" weekly summary for auto-resolved alerts

---

## 14. What NOT to Build in Phase 1

- ❌ Login/signup system
- ❌ User dashboard with full data binding
- ❌ Alert history viewer
- ❌ Subscription management UI (cancel goes through Stripe customer portal directly)
- ❌ Pause feature
- ❌ Manual alert resolution
- ❌ Per-user timezone scheduling
- ❌ Mobile app
- ❌ API for third-party integrations
- ❌ Multi-artist accounts (one email = one catalog being monitored)

These are intentional Phase 2 scope. Resist scope creep during Phase 1 build.

---

## 15. Success Metrics (Track from Day 1)

- Free audits delivered (countdown to 200)
- Conversion rate: free audit → email captured → drip enrollment
- Conversion rate: drip → Audit Only purchase
- Conversion rate: drip → Monitoring purchase
- Audit Only vs Monitoring purchase split
- Monthly vs Annual Monitoring split
- Monthly churn rate (cancellations / active subscriptions)
- Critical alerts triggered per active subscription per month
- Weekly report open rate

---

**End of spec.**

Spec authored Saturday May 9, 2026. Ready for implementation.
Next session: begin Sprint 1.
