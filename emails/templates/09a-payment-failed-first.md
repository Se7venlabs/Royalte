## 9a — Payment Failed: First attempt

**Trigger:** Stripe `invoice.payment_failed` (first failure).
**Send:** Immediately on first failure.
**From:** `audits@royalte.ai`

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
