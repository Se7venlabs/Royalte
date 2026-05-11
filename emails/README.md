# Royaltē — Email Drip System v1

**Voice:** Rick Rubin — short sentences, confident, music-industry-native, white space, no shouting.
**Trigger:** Any Full Audit completion (free or paid).
**From addresses:**
- Transactional (1, 6, 7, 8, 9) → `audits@royalte.ai`
- Drip / conversion (2, 3, 4, 5) → `darryl@royalte.ai`
- Reply-to on everything → `darryl@royalte.ai`

---

## 1. Audit Complete (transactional)

**Trigger:** Full Audit pipeline finishes, PDF generated.
**Send:** Immediately.
**From:** `audits@royalte.ai`

**Subject:** Your audit is ready.
**Preview:** {{artist_name}} — {{total_issues}} flags found.

---

{{artist_name}}.

Your full audit is attached.

We scanned six platforms. Cross-referenced ISRCs. Checked your territory coverage and global collection readiness.

Here's what we found:

- Catalog Quality Score: **{{quality_score}} / 100**
- Total flags: **{{total_issues}}**
- Critical: **{{critical_count}}**

The PDF has the full picture. Read it slowly. Each flag has an action.

This audit is one moment in time. Catalogs move. ISRCs change. Territories open and close.

We'll be in touch in a day or two with what comes next.

— Royaltē

[Download Your Audit PDF →]({{pdf_url}})

---

*Royaltē audits data, identifies errors, and provides action plans. We don't collect royalties or guarantee payouts. We show you where to look and what to do.*

---
---

## 2. Day 1 — One moment in time (drip 1/4)

**Trigger:** 24 hours after email 1.
**From:** `darryl@royalte.ai`

**Subject:** Your audit is one moment in time.
**Preview:** Catalogs don't sit still.

---

The audit we sent yesterday is already a little out of date.

That's not a flaw. That's the nature of catalogs.

Distributors push updates. Platforms reindex. New territories open. ISRCs get reissued. Sync placements appear. UGC channels lift your tracks and call them their own.

A scan is a photograph. Useful. Honest. Finite.

The artists who get paid right are the ones who keep looking.

Most don't.

That's what Royaltē Pro Monitoring is for. Weekly scans. Alerts when something changes. The audit you already paid attention to, running on its own in the background.

I'll write again in a couple of days. Sit with the audit first.

— Darryl
Founder, Royaltē

[See How Monitoring Works →]({{monitoring_url}})

---
---

## 3. Day 3 — What changes (drip 2/4)

**Trigger:** 72 hours after email 1.
**From:** `darryl@royalte.ai`

**Subject:** What changes between scans.
**Preview:** A short list. Most of it costs you money.

---

Things that shift between manual scans:

A territory you weren't registered in opens up. Your track plays there. The royalties go somewhere else.

An ISRC you cleaned up reappears on a duplicate upload. Now there are two of you in the system. Splits get muddy.

A YouTube channel posts your track unlicensed. Content ID doesn't catch it because the audio is pitched a half-step. No claim. No revenue.

A distributor changes your metadata without telling you. Featured artist credit drops. Searches stop finding the song.

A sync placement clears. You don't know. Nobody tells the publisher.

None of these are dramatic. All of them are money.

Monitoring catches them inside a week. Manual catches them when you remember to look — which, for most artists, is never.

— Darryl

[Start Monitoring — $19.99/mo →]({{pricing_url}})

---
---

## 4. Day 7 — The math (drip 3/4)

**Trigger:** 7 days after email 1.
**From:** `darryl@royalte.ai`

**Subject:** The math on one missed flag.
**Preview:** $19.99 vs the alternative.

---

Pro Monitoring is $19.99 a month. $239.88 a year.

One unclaimed neighboring rights territory can be worth more than that.

One missed Content ID on a song with momentum can be worth ten times that.

One uncorrected ISRC mismatch on a track that gets playlisted can be worth more than I want to write in an email.

I'm not selling fear. The flags in your audit are real. The ones that haven't surfaced yet are also real. They surface on their own schedule.

You can check manually every few months and hope. Or you can have the scan running.

— Darryl

[Activate Monitoring →]({{pricing_url}})

---
---

## 5. Day 14 — Last note (drip 4/4)

**Trigger:** 14 days after email 1.
**From:** `darryl@royalte.ai`

**Subject:** Last note on this.
**Preview:** Then I'll stop.

---

This is the last email from me about Monitoring.

If it's not for you right now, that's fine. The audit you already have is yours to keep. The action items in the PDF don't expire.

If you want to come back to it later, the door's open. Same price.

If you want to start now: [royalte.ai/pricing]({{pricing_url}})

Either way — thank you for trusting us with your catalog. Most platforms in this space promise to find money. We don't. We show you where to look. The work is yours.

That's how it should be.

— Darryl
Founder, Royaltē

---
---

## 6. Welcome to Pro Monitoring (transactional)

**Trigger:** Stripe `customer.subscription.created` for Pro tier.
**Send:** Immediately.
**From:** `audits@royalte.ai`

**Subject:** Welcome to Pro Monitoring.
**Preview:** Your first scan runs {{first_scan_day}}.

---

{{artist_name}}.

You're in.

Your catalog is now being watched. Here's what happens next:

**Your first weekly scan runs {{first_scan_day}}.** Same six platforms as your audit. Same ISRC cross-referencing. Same territory and UGC checks.

**You'll get an email when it completes.** And another one any time something changes — a new flag, a new territory, a duplicate upload, a UGC match.

**Your dashboard is here:** [royalte.ai/dashboard]({{dashboard_url}})

**Your subscription:** $19.99/month, billed to the card on file. Cancel anytime from Settings.

I'll send a separate note in a day or two on how to get the most out of this. For now, the only thing to do is wait for the first scan.

Welcome.

— Royaltē

---
---

## 7. Getting the Most Out of Your Subscription (onboarding)

**Trigger:** 36 hours after email 6.
**From:** `audits@royalte.ai`
**Reply-to:** `darryl@royalte.ai`

**Subject:** How to actually use Royaltē Pro.
**Preview:** A short guide. Read it once.

---

{{artist_name}}.

Now that the subscription is live, here's how to use it.

There are six things to know. Read it once. Bookmark this email.

---

**1. Your weekly scan**

Every {{scan_day}}, Royaltē scans your catalog across Spotify, Apple Music, YouTube, Discogs, Last.fm, and Tidal (when their API clears).

You don't have to do anything. You get an email when it finishes.

If a scan misses or fails, you'll see it in **Dashboard → Monitoring**.

---

**2. Alerts**

When something changes, you get an alert. Email first. Then logged in **Dashboard → Issues Found**.

Three alert tiers:

- **Critical** — money is leaving right now. Act today.
- **Action recommended** — money will leave soon if untouched. Act this week.
- **Watch** — flagged for context. No urgent action.

The tier is on every alert. Don't treat them all the same.

---

**3. Action plans**

Every alert has an action plan. Who to contact. What to send them. What to ask for.

Open the alert in **Dashboard → Action Plan**. Each one is a numbered list. Work through it.

We don't file the claim for you. The action is yours. The path is ours.

---

**4. Your catalog view**

**Dashboard → Catalog** shows every track we're tracking, scored, with platform coverage and flag history.

If something's missing, add it in **My Setup**. We'll pick it up on the next weekly scan.

---

**5. Your reports**

Every month, you get a fresh full audit PDF — same format as the one you started with, updated with the last month of scans.

Find them in **Dashboard → Reports**.

---

**6. When something's wrong**

If a scan looks off, an alert doesn't make sense, or something's missing — reply to this email. It goes straight to me.

I read every one.

---

That's the whole system. Six things.

The artists who get the most out of this are the ones who treat alerts like a weekly inbox. Open them. Work the action plans. Move on.

Welcome to the work.

— Darryl
Founder, Royaltē

[Open Your Dashboard →]({{dashboard_url}})

---

*A full version of this guide lives at [royalte.ai/guide]({{guide_url}}). It updates as the product evolves.*

---
---

## 8. Pro Monitoring Alert (triggered)

**Trigger:** Weekly scan surfaces a new issue (`monitoring_alerts.alert_tier IN ('critical', 'action_recommended')`).
**Send:** Immediately on alert creation.
**From:** `audits@royalte.ai`

**Subject (critical):** Critical — {{alert_summary}}.
**Subject (action):** New flag — {{alert_summary}}.
**Preview:** {{artist_name}} — found in this week's scan.

---

{{artist_name}}.

This week's scan surfaced a new flag.

**Tier:** {{alert_tier_label}}
**Type:** {{flag_type}}
**Where:** {{platform}} / {{territory}}
**Detail:** {{flag_detail}}

**What to do:**

{{action_step_1}}
{{action_step_2}}
{{action_step_3}}

The full action plan is in your dashboard with contact info and templates.

[Open This Alert →]({{alert_url}})

— Royaltē

---

*This alert was generated from your {{scan_date}} weekly scan. Reply to this email if it doesn't look right.*

---
---

## 9. Payment Failed (Stripe dunning)

**Trigger:** Stripe `invoice.payment_failed`.
**Send:** Immediately on first failure. Second email at 72 hours if still unresolved. Third at 7 days.
**From:** `audits@royalte.ai`

### 9a — First attempt

**Subject:** Your payment didn't go through.
**Preview:** Quick fix. We'll keep scanning in the meantime.

---

{{artist_name}}.

Your monthly payment for Royaltē Pro didn't process.

Card on file: {{card_brand}} ending in {{card_last4}}.

This happens — expired cards, bank holds, the usual. Updating the card takes less than a minute.

[Update Your Card →]({{billing_url}})

Your scans are still running. Nothing's paused yet.

— Royaltē

---

### 9b — Second attempt (72 hours later, if still unpaid)

**Subject:** Still need to update your card.
**Preview:** Scans pause in 4 days if this isn't resolved.

---

{{artist_name}}.

A quick reminder — the payment from a few days ago is still pending.

If it's not resolved in the next 4 days, your weekly scans pause. Your data stays where it is. Nothing's deleted. But the monitoring stops until billing is current.

[Update Your Card →]({{billing_url}})

Reply to this email if something else is going on. I'll sort it out.

— Darryl

---

### 9c — Final notice (7 days after first failure)

**Subject:** Monitoring paused.
**Preview:** Reactivate anytime.

---

{{artist_name}}.

Your weekly scans are paused as of today.

Your data and history are intact. Your past audit PDFs are still in the dashboard. Nothing's lost.

When you're ready to come back, one click reactivates everything.

[Reactivate Monitoring →]({{billing_url}})

— Royaltē

---
---

## Template variable reference

Variables used across all emails:

| Variable | Source |
|---|---|
| `{{artist_name}}` | `audit_requests.artist_name` |
| `{{total_issues}}` | Audit response |
| `{{critical_count}}` | Audit response |
| `{{quality_score}}` | Audit response |
| `{{pdf_url}}` | Generated PDF URL |
| `{{monitoring_url}}` | `royalte.ai/monitoring` |
| `{{pricing_url}}` | `royalte.ai/pricing` |
| `{{dashboard_url}}` | `royalte.ai/dashboard` |
| `{{guide_url}}` | `royalte.ai/guide` |
| `{{billing_url}}` | Stripe customer portal URL |
| `{{first_scan_day}}` | Calculated from subscription start + cron schedule |
| `{{scan_day}}` | Day of week scans run (e.g., "Monday") |
| `{{scan_date}}` | Date the surfacing scan ran |
| `{{alert_tier_label}}` | `monitoring_alerts.alert_tier` formatted |
| `{{alert_summary}}` | Short alert title |
| `{{flag_type}}` | `monitoring_alerts.flag_type` |
| `{{platform}}` | Source platform |
| `{{territory}}` | Affected territory |
| `{{flag_detail}}` | Full alert description |
| `{{action_step_1/2/3}}` | First three steps from `recovery_action.action_steps` |
| `{{alert_url}}` | Deep link to the alert in dashboard |
| `{{card_brand}}` | Stripe payment method brand |
| `{{card_last4}}` | Stripe payment method last4 |

---

## Drip cadence summary

```
Day 0    — Email 1 (Audit Complete) — transactional
Day 1    — Email 2 (One moment in time)
Day 3    — Email 3 (What changes)
Day 7    — Email 4 (The math)
Day 14   — Email 5 (Last note)
         — Drip ends. No more conversion emails.

ON SUBSCRIBE:
Day 0    — Email 6 (Welcome)
Day +1.5 — Email 7 (How to use Royaltē Pro)

ONGOING:
Triggered — Email 8 (Pro Monitoring Alert) per surfaced issue
Triggered — Email 9a/b/c (Payment Failed dunning)
```

---

## Notes on the writing

A few things to know about what's drafted above, so you can edit with intent:

**On Email 1 voice:** I leaned slightly less mystical here on purpose. People opening a transactional email expect clarity. The Rick Rubin energy lives in the closing line — "This audit is one moment in time" — which also seeds Email 2's subject. The whole drip is built around that thread.

**On Email 7:** This is the one most likely to need your edits. Step-by-step content fights Rick Rubin voice. I kept the intro and outro in the register and let the middle be scannable. If you want it more mystical, we can rewrite the six points with less direct phrasing — but be careful, users genuinely need to know how to use the product.

**On the founder vs brand voice split:** Drip emails (2-5) and the dunning email 9b are signed `— Darryl`. Everything else signs `— Royaltē`. This is intentional: warm + personal on the conversion ask, institutional on the transactional. Stripe does this. Linear does this. Works.

**On Email 5 ("Last note"):** This one breaks the mold. It's a genuine "we're done" email. The temptation in SaaS is to keep nudging. Don't. The honesty of "this is the last email about this" outperforms a 6th, 7th, 8th nudge — in opens, in conversions, and in brand trust. Trust me on this one.

**On Free vs Paid audit variants for Email 1:** I left a single version. If you want a paid variant that acknowledges the purchase, swap the opening line:
- Free: `Your full audit is attached.`
- Paid: `Your full audit is delivered. Thank you.`

That's enough differentiation. More would feel forced.
