# Royaltē — Email Alerts System: Master Developer Document

**Project:** Royaltē (Se7ven Labs Inc.) — Music Audit Intelligence
**Feature:** Audit/Issue email alerts for Pro subscribers
**Owner:** Darryl
**Status:** 🟡 In Build (Phase 1 — pre-Stripe)
**Last updated:** 2026-04-25

---

## 📌 Purpose of this Document

This is the **master index** for the email alerts feature build. It tracks:

1. What's been built and what hasn't
2. Where every file lives and what it does
3. The build sequence and decision log
4. The handoff plan to the developer once Stripe is wired

When the build is complete, this document — combined with all referenced files — becomes the complete developer handoff package.

> 💡 **Workflow:** Each time we create or update a file in the build, this document gets updated to reflect it. Treat this as the table of contents for the entire feature.

---

## 🎯 Feature Summary

Royaltē sends Pro subscribers email alerts when their audit results contain new critical issues, when their Royalty Risk Score crosses thresholds, or when new platform/territory issues are detected. Alerts are deduped, severity-tiered, respect user-configured quiet hours by timezone, and support per-user cadence preferences (real-time + digest, daily digest only, weekly digest only, or disabled).

The system is **channel-agnostic** by design — emails today, with the option to add SMS later by adding `'sms'` to the `delivery_channel` enum. No restructuring required for v2.

---

## 🏗️ Architecture at a Glance

```
┌─────────────────────────────────────────────────────────────────┐
│  Audit Engine (ScanSession)                                     │
│  Detects critical issues, score deltas, platform/territory gaps │
└────────────────────────────┬────────────────────────────────────┘
                             │ calls enqueue_alert()
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│  Supabase (royalte.ai project)                                  │
│  • alerts table (channel-agnostic events + dedupe)              │
│  • user_alert_preferences (opt-in, cadence, quiet hours)        │
│  • alert_deliveries (one row per send attempt)                  │
│  • should_send_alert() — eligibility logic                      │
│  • is_pro_subscriber() — Stripe integration point ⚠️            │
└────────────────────────────┬────────────────────────────────────┘
                             │
            ┌────────────────┼────────────────┐
            ▼                ▼                ▼
   ┌────────────────┐ ┌────────────────┐ ┌────────────────┐
   │ /api/alerts/   │ │ /api/alerts/   │ │ /api/webhooks/ │
   │ send-pending   │ │ digest         │ │ resend         │
   │ (cron 5min)    │ │ (cron daily)   │ │ (delivery,     │
   │                │ │                │ │  bounce, open) │
   └───────┬────────┘ └────────┬───────┘ └────────┬───────┘
           │                   │                  │
           └─────────┬─────────┘                  │
                     ▼                            │
           ┌────────────────┐                     │
           │ Resend API     │ ◄───────────────────┘
           │ (email send)   │   webhooks back
           └────────────────┘
```

---

## 🗂️ File Manifest

All files referenced below should be saved into `/Royalte_Email_Alerts/` in your master folder. Some are built and ready; others are pending.

### Phase 1 — Foundation (Pre-Stripe)

| # | File | Status | Purpose |
|---|---|---|---|
| 1 | `MASTER_DEV_DOC.md` | ✅ This file | Master index — build status, file manifest, decision log |
| 2 | `royalte_email_alerts_migration.sql` | ✅ Built | Complete Supabase migration: tables, enums, RLS, functions, indexes |
| 3 | `DEVELOPER_HANDOFF.md` | ✅ Built | Stripe-wiring handoff doc for the developer |
| 4 | `api/alerts/send-pending.js` | ⏳ Pending | Vercel serverless cron route — processes queued alerts every 5 min |
| 5 | `api/alerts/digest.js` | ⏳ Pending | Vercel serverless cron route — builds + sends daily/weekly digests |
| 6 | `api/webhooks/resend.js` | ⏳ Pending | Receives Resend delivery/bounce/open events; calls `mark_delivery_status()` |
| 7 | `api/alerts/unsubscribe.js` | ⏳ Pending | Handles one-click unsubscribe link clicks |
| 8 | `email_templates/critical_alert.html` | ⏳ Pending | Real-time critical issue email — dark cinematic, gradient É |
| 9 | `email_templates/digest.html` | ⏳ Pending | Daily/weekly digest email — multi-alert summary |
| 10 | `audit_engine_integration.md` | ⏳ Pending | Where in ScanSession to call `enqueue_alert()` + dedupe key conventions |
| 11 | `dashboard_alert_settings.html` | ⏳ Pending | User-facing settings UI panel — toggle, cadence, quiet hours, timezone |
| 12 | `vercel.json` (cron config) | ⏳ Pending | Cron schedule definitions for `send-pending` and `digest` routes |

### Phase 2 — Stripe Integration (Developer Scope)

| # | File | Status | Purpose |
|---|---|---|---|
| D1 | `DEVELOPER_HANDOFF.md` | ✅ Built | Single doc the developer reads first |
| D2 | (Migration edit) | Dev task | Uncomment one Stripe pattern in `is_pro_subscriber()`, drop `dev_pro_override` |
| D3 | (Stripe webhook handler) | Dev task | Out of scope for this build — developer will spec separately |

---

## 📋 Build Status & Sequence

### ✅ Completed

- [x] **Architecture decision:** Email-only for v1, channel-agnostic schema for SMS v2
- [x] **Vendor decisions:** Resend (already integrated), Supabase (existing royalte.ai project)
- [x] **Master Supabase migration** with full schema, RLS, indexes, core functions
- [x] **Two-phase deployment plan:** Phase 1 (dev override) → Phase 2 (Stripe wiring)
- [x] **Developer handoff document** for clean Stripe integration scope
- [x] **Master tracking document** (this file)

### 🚧 In Progress

_(Nothing currently. Awaiting Darryl's choice for next file to build.)_

### ⏳ Pending — Recommended Build Order

1. **Audit engine integration spec** (`audit_engine_integration.md`)
   - *Why first:* Defines the dedupe key contract that everything else depends on
   - *Outputs:* Exact code change locations in ScanSession + dedupe key format

2. **Email templates** (`critical_alert.html`, `digest.html`)
   - *Why second:* Visual deliverable — easy to review, builds momentum
   - *Outputs:* Production-ready MJML or table-based HTML, tested across Gmail/Outlook/Apple Mail

3. **API route: send-pending** (`api/alerts/send-pending.js`)
   - *Why third:* The core sender — most everything else feeds it
   - *Outputs:* Cron-triggered handler, claims queued alerts, sends via Resend, records delivery

4. **API route: webhooks/resend** (`api/webhooks/resend.js`)
   - *Why fourth:* Closes the loop on send-pending — without this, no delivery confirmation
   - *Outputs:* Verified Resend webhook handler, updates delivery state

5. **API route: digest** (`api/alerts/digest.js`)
   - *Why fifth:* Builds on send-pending; uses the same Resend integration
   - *Outputs:* Cron handler that bundles queued non-realtime alerts into one email per user

6. **API route: unsubscribe** (`api/alerts/unsubscribe.js`)
   - *Why sixth:* Compliance gate before any production email goes out
   - *Outputs:* Public route that consumes unsubscribe token + confirmation page

7. **Vercel cron config** (`vercel.json`)
   - *Why seventh:* Wires schedule to the routes
   - *Outputs:* Updated `vercel.json` with cron entries

8. **Settings UI panel** (`dashboard_alert_settings.html`)
   - *Why eighth:* User-facing — needs the backend complete to test against
   - *Outputs:* Drop-in HTML/JS panel for `dashboard.html`

---

## 🧠 Key Design Decisions (Decision Log)

### Email vs SMS (resolved 2026-04-25)
- **Decision:** Email-only for v1. Schema is channel-agnostic so SMS plugs in later.
- **Why:** Resend is already integrated, no new vendors, no TCPA/A2P 10DLC compliance overhead, costs are negligible, alert content is too rich for 160-char SMS, and most "urgency" claims for SMS don't survive scrutiny against monthly royalty reporting cycles.
- **Reversibility:** High. Adding SMS = add `'sms'` to `delivery_channel` enum + new sender function. Schema is forward-compatible.

### Same Supabase project as royalte.ai (resolved 2026-04-25)
- **Decision:** Email alerts live in the existing royalte.ai Supabase project, NOT a new one or the landing page project.
- **Why:** Alert triggers come from audit data, which lives there. Cross-project queries would be fragile and create the same domain-confusion pain we hit with `royalte.ai` vs `royalteaudit.com`.

### Cadence: real-time critical + digest for rest (resolved 2026-04-25)
- **Decision:** Default cadence is `realtime_critical_digest_rest`. Critical alerts override quiet hours; high alerts respect them; medium/low always batched.
- **Why:** Critical issues (e.g. zero streams on a tracked ISRC) lose meaningful urgency in a 24h delay. Non-critical alerts cause fatigue if delivered individually. Users can override to pure daily/weekly digest if they prefer.

### Two-phase deployment for Stripe handoff (resolved 2026-04-25)
- **Decision:** Ship `is_pro_subscriber()` with a `dev_pro_override` table for Phase 1 testing. Developer replaces with real Stripe check in Phase 2.
- **Why:** Lets us QA the full alert pipeline before Stripe exists. Reduces developer scope to ~2-4 hours of focused work with zero ambiguity. Saves money + time.

### Database functions over app-layer logic (resolved 2026-04-25)
- **Decision:** Eligibility (`should_send_alert`), dedup (`enqueue_alert`), and unsubscribe (`unsubscribe_via_token`) live in Postgres, not in API routes.
- **Why:** Single source of truth. API routes can't accidentally bypass eligibility checks. Logic doesn't drift across multiple call sites.

### Pricing structure unchanged (resolved 2026-04-25)
- **Decision:** Email alerts are a perk of the existing $19.99/month Pro Monitor tier — no new pricing tier introduced.
- **Why:** Alerts are a value-add, not a separate product. Adding a tier fragments the offering pre-PMF.

---

## 🔑 Critical Conventions

### Dedupe Key Format
Every call to `enqueue_alert()` includes a `dedupe_key`. Format:

```
{alert_type}:{primary_identifier}:{specific_issue}
```

**Examples:**
- `critical_audit_issue:USRC12345678:apple_music_zero_streams`
- `risk_score_threshold:user_uuid:dropped_below_70`
- `new_platform_issue:USRC12345678:tidal_missing_metadata`
- `new_territory_issue:user_uuid:germany_no_collection`

The same key for the same user will only ever produce one alert. To re-alert (e.g. issue resolved then reappeared), include a date or session marker in the key.

### Severity Tier Definitions

| Severity | Examples | Behavior |
|---|---|---|
| `critical` | Zero streams on tracked ISRC, missing collection on >$X royalties | Real-time, overrides quiet hours |
| `high` | Score dropped 5+ points, new territory gap on top track | Real-time during waking hours, deferred during quiet hours |
| `medium` | Minor metadata mismatch, new low-impact platform issue | Always batched into digest |
| `low` | Informational, score nudged 1-2 points | Always batched into digest |

### Status Lifecycle for `alerts`

```
pending → queued → sent
                 → suppressed (with reason)
                 → failed
```

`pending` → `queued`: passed eligibility check on insert
`queued` → `sent`: handed off to Resend
`pending`/`queued` → `suppressed`: failed eligibility (not Pro, unsubscribed, quiet hours, duplicate)
`queued` → `failed`: send attempt failed permanently after retries

---

## 🚦 Environment / Vendor State

| Item | Status | Notes |
|---|---|---|
| Supabase project (royalte.ai) | ✅ Live | Existing — migration runs against this |
| Supabase landing page project | ⛔ Don't touch | Separate project for `royalteaudit.com` only |
| Resend API key | ✅ Configured | Already in Vercel env (`RESEND_API_KEY`) |
| Resend webhook secret | ⏳ Pending | Will need to be added once webhook route is built |
| Vercel project (royalte.ai) | ✅ Live | API routes deploy here |
| Stripe | ⏳ Not yet integrated | Developer scope — Phase 2 |
| `dev_pro_override` table | 🚧 Phase 1 only | Drop after Stripe wiring complete |

### Required Vercel Environment Variables

```
RESEND_API_KEY              ✅ Already set
RESEND_WEBHOOK_SECRET       ⏳ Add when webhook route is built
SUPABASE_URL                ✅ Already set
SUPABASE_SERVICE_ROLE_KEY   ✅ Already set
ALERT_FROM_EMAIL            ⏳ Add: e.g. "alerts@royalte.ai"
ALERT_FROM_NAME             ⏳ Add: "Royaltē Alerts"
ALERT_REPLY_TO              ⏳ Add: "support@royalte.ai"
APP_URL                     ⏳ Add: "https://royalte.ai" (for unsubscribe links)
```

---

## ✅ Pre-Production Verification Checklist

To be completed before turning on alerts for any real user:

### Phase 1 (pre-Stripe)
- [ ] Migration ran successfully in royalte.ai Supabase project
- [ ] Test user added to `dev_pro_override` table
- [ ] Test user has row in `user_alert_preferences`
- [ ] `enqueue_alert()` for the test user creates a `queued` alert
- [ ] `send-pending` cron sends a real email via Resend
- [ ] Resend webhook updates `alert_deliveries.status` to `delivered`
- [ ] Unsubscribe link in email works (sets `unsubscribed_at`)
- [ ] Re-running the same alert (same dedupe key) does NOT create a duplicate
- [ ] Quiet hours correctly defer `high` severity alerts
- [ ] Critical alerts override quiet hours
- [ ] Daily digest cron sends a single email summarizing multiple `medium`/`low` alerts
- [ ] Settings UI in dashboard correctly reads/writes `user_alert_preferences`
- [ ] Email renders correctly in Gmail web, Gmail mobile, Apple Mail, Outlook web

### Phase 2 (post-Stripe handoff)
- [ ] `is_pro_subscriber()` returns `true` for active Pro users
- [ ] `is_pro_subscriber()` returns `false` for cancelled / non-Pro users
- [ ] `dev_pro_override` table dropped
- [ ] Backfill `user_alert_preferences` ran for all existing Pro users
- [ ] Subscription cancellation triggers no further alerts within 1 cron cycle

---

## 📝 Open Questions / Parking Lot

_(Add items here as they come up during the build. Resolve and move to Decision Log.)_

- [ ] Should users be able to choose which alert types they receive (e.g. opt out of `new_territory_issue` only)? — Currently all-or-nothing per cadence.
- [ ] What happens if a user changes their email address — do we re-verify? — Probably not for v1 (Resend just sends to the new address).
- [ ] Do we want admin-side observability (e.g. dashboard of alerts sent / bounced / unsubscribed)? — v2.
- [ ] What's the exact threshold logic for `risk_score_threshold` alerts? Currently the migration accepts the type but the trigger logic in ScanSession is TBD.

---

## 📞 Contact

**Founder:** Darryl
**Project:** Royaltē (Se7ven Labs Inc.)
**Repo:** `Se7venlabs/Royalte`
**Live app:** https://royalte.ai
**Landing page:** https://royalteaudit.com (separate project — don't confuse)
