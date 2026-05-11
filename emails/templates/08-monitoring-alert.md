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

