# Supabase Auth → Resend SMTP setup

## Why

Supabase **Auth** emails (magic links, OTP, password reset) currently send through
Supabase's **default email sender**, which is heavily rate-limited (a few sends
per hour). That rate limit is the cause of the magic-link fallback failing under
testing.

Pointing Supabase Auth at **Resend via custom SMTP** lifts the limit and sends
from a branded Royaltē address.

> **Note — this is separate from the existing Resend integration.**
> `api/submit-audit.js` already uses Resend's **API** (`RESEND_API_KEY`) for the
> transactional audit-PDF email. This task wires Supabase **Auth** email through
> Resend's **SMTP** endpoint — a different path, configured entirely in the
> Supabase Dashboard. No repo code or env var changes.

## Prerequisite — verified sending domain in Resend

The SMTP sender address must be on a domain verified in Resend.

- [ ] Resend dashboard → **Domains** → confirm `royalte.ai` is added and verified
      (DNS records — SPF/DKIM — published and green). If not, add it and publish
      the records before continuing.
- [ ] Confirm a Resend **API key** exists (the same value already set as
      `RESEND_API_KEY` in Vercel can be reused).

## Manual setup — Supabase Dashboard

Authentication → **Emails** → **SMTP Settings** → enable **Custom SMTP**, then:

| Field         | Value |
|---------------|-------|
| Host          | `smtp.resend.com` |
| Port          | `587` (STARTTLS) or `465` (SSL/TLS) |
| Username      | `resend` |
| Password      | the Resend API key |
| Sender email  | a verified Royaltē address (e.g. `noreply@royalte.ai`) |
| Sender name   | `Royaltē` |

- [ ] Enable Custom SMTP and enter the values above.
- [ ] Authentication → **Rate Limits** → raise the email send rate limit. The low
      default exists because of the shared Supabase sender; custom SMTP lets you
      raise it to a sane level for real traffic.
- [ ] Save.

## Verify

- [ ] Trigger a magic link — the "Enter Royaltē OS" modal or the homepage
      "Continue Inside Royaltē OS" form.
- [ ] Confirm the email arrives **from the Royaltē sender** (not Supabase's
      default) and lands quickly.
- [ ] Confirm the link points to `https://royalte.ai/auth/callback?session_id=…`
      (not the bare homepage — see the redirect-allowlist note below).
- [ ] Confirm clicking it completes sign-in and lands in the dashboard.

## Related

- **Redirect URL allowlist** — separate from SMTP. Authentication → URL
  Configuration → Redirect URLs must tolerate `/auth/callback` *with* a query
  string (`?session_id=…`); a wildcard entry such as
  `https://royalte.ai/auth/callback**` is the safe form.
- **Branded magic-link template** — SMTP is only the sending pipe. Replacing the
  default magic-link email *content* with a V5-toned template is a separate
  item (Authentication → Email Templates) — tracked in `LAUNCH_CHECKLIST.md`.

## Out of scope

A custom (non-Supabase) magic-link email system. Supabase Auth + Resend SMTP is
the supported path. Building our own would only be considered if we later decide
to bypass Supabase Auth entirely — a separate decision, not this task.
