## 9b — Payment Failed: Second attempt

**Trigger:** Stripe `invoice.payment_failed` (still unpaid 72h after first failure).
**Send:** 72 hours after first failure if still unresolved.
**From:** `audits@royalte.ai`

**Subject:** Still need to update your card.
**Preview:** Scans pause in 4 days if this isn't resolved.

---

{{artist_name}}.

A quick reminder — the payment from a few days ago is still pending.

If it's not resolved in the next 4 days, your weekly scans pause. Your data stays where it is. Nothing's deleted. But the monitoring stops until billing is current.

[Update Your Card →]({{billing_url}})

Reply to this email if something else is going on. I'll sort it out.

— Darryl
