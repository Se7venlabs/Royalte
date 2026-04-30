// ═══════════════════════════════════════════════════════════
// ROYALTĒ — EMAIL TEMPLATE LIBRARY (Phase 1 prep)
// ═══════════════════════════════════════════════════════════
//
// Status: Templates are ready for Resend integration.
// NOT YET WIRED — Arta will plug these into the send pipeline.
//
// Usage (when wiring with Resend):
//   import { ROYALTE_EMAILS } from './royalteEmailTemplates.js';
//   const tpl = ROYALTE_EMAILS.email1;
//   const html = tpl.html
//     .replaceAll('{{ARTIST_NAME}}', artistName)
//     .replaceAll('{{ROYALTE_SCORE}}', String(score))
//     .replaceAll('{{ISSUES_COUNT}}', String(issuesCount))
//     .replaceAll('{{AUDIT_URL}}', auditUrl)
//     .replaceAll('{{UNSUBSCRIBE_URL}}', unsubscribeUrl);
//
// Variables available in every template:
//   {{ARTIST_NAME}}     — artist's name from scan, fallback to "there"
//   {{ROYALTE_SCORE}}   — Royaltē Score 0–100, fallback to "—"
//   {{ISSUES_COUNT}}    — total flags from data.flags.length, fallback to "—"
//   {{SOURCE_URL}}      — original Spotify/Apple URL submitted
//   {{AUDIT_URL}}       — Stripe checkout / signup link, set per send
//   {{UNSUBSCRIBE_URL}} — one-click unsubscribe (REQUIRED by CAN-SPAM/GDPR)
//
// Compliance notes:
//   - Every email includes a visible unsubscribe link in the footer
//   - From address must use a verified Resend domain (royalte.ai recommended)
//   - First-send open rates typically 15–25% on a fresh domain; warms over weeks
//   - ⚠️ emoji in subject lines can trigger spam filters in some inboxes —
//     monitor deliverability and pull if open rate drops
//
// Send schedule (planned):
//   email1 — immediately on submit (queue or fire-and-forget)
//   email2 — +24h after submit (scheduled)
//   email3 — +72h after submit (scheduled)
//   email4 — +120h after submit (scheduled)
//
// Skip-conditions Arta should implement:
//   - Don't send follow-ups if user has already paid for full audit
//   - Don't send follow-ups if user clicked unsubscribe
//   - Don't send follow-ups if email has bounced
// ═══════════════════════════════════════════════════════════

// ── Shared HTML wrapper ──────────────────────────────────────
// Dark-themed, table-based for email-client compatibility (Outlook
// requires tables; flexbox/grid don't render in many clients).
// Inline styles only — <style> tags get stripped or ignored by Gmail
// app, Outlook, etc. Keep widths under 600px for mobile readability.

const wrap = ({ preview, body, footerNote }) => `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Royaltē</title>
</head>
<body style="margin:0;padding:0;background-color:#070410;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#e8e4f4;">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:#070410;">${preview}</div>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#070410;">
<tr>
<td align="center" style="padding:32px 16px;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="560" style="max-width:560px;background-color:#0a0612;border:1px solid rgba(138,92,255,0.22);border-radius:12px;overflow:hidden;">
<tr>
<td style="padding:32px 36px 16px 36px;border-bottom:1px solid rgba(138,92,255,0.14);">
<div style="font-family:'Helvetica Neue',Arial,sans-serif;font-size:24px;font-weight:700;letter-spacing:-0.5px;color:#ffffff;">
ROYALT<span style="background:linear-gradient(135deg,#8a5cff,#e040c8);-webkit-background-clip:text;background-clip:text;color:#e040c8;">Ē</span>
</div>
<div style="font-family:'Courier New',monospace;font-size:10px;letter-spacing:2px;color:#7a7598;text-transform:uppercase;margin-top:4px;">Music Audit Intelligence</div>
</td>
</tr>
<tr>
<td style="padding:32px 36px;">
${body}
</td>
</tr>
<tr>
<td style="padding:24px 36px;border-top:1px solid rgba(138,92,255,0.14);background-color:#070410;">
<div style="font-size:12px;color:#7a7598;line-height:1.6;text-align:center;">
${footerNote || ''}
<div style="margin-top:12px;font-size:11px;color:#5a5578;">
Royaltē &middot; Built for artists, not the industry<br>
Se7ven Laboratories LLC<br>
<a href="{{UNSUBSCRIBE_URL}}" style="color:#7a7598;text-decoration:underline;">Unsubscribe</a>
</div>
</div>
</td>
</tr>
</table>
</td>
</tr>
</table>
</body>
</html>`;

// ── Shared button component ──────────────────────────────────
// Bulletproof button — works in Outlook (which doesn't support gradients
// or border-radius). Falls back to solid purple in older clients.
const button = (text, url) => `<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:24px auto;">
<tr>
<td align="center" style="background-color:#8a5cff;background-image:linear-gradient(135deg,#8a5cff,#e040c8);border-radius:6px;">
<a href="${url}" style="display:inline-block;padding:14px 28px;font-family:'Helvetica Neue',Arial,sans-serif;font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;letter-spacing:1px;text-transform:uppercase;">${text}</a>
</td>
</tr>
</table>
<div style="text-align:center;margin-top:-12px;">
<a href="${url}" style="font-size:12px;color:#8a5cff;text-decoration:underline;">Or open this link in your browser</a>
</div>`;

// ═══════════════════════════════════════════════════════════
// EMAIL 1 — INSTANT (sent on form submit)
// ═══════════════════════════════════════════════════════════

const email1Text = `We ran your scan.

And we found issues.

Missing metadata. Registration gaps. Unclaimed royalties.

This is happening right now.
Not later. Not "maybe." Right now.

Your free scan only shows a preview.

Your full audit shows:
- Exactly what's broken
- Where your money is leaking
- What to fix (step-by-step)

Get your full audit: {{AUDIT_URL}}

Most artists never fix this.
They just keep releasing… while their money goes somewhere else.

Don't be that artist.

—
Royaltē
Built by artists. Not the industry.

Unsubscribe: {{UNSUBSCRIBE_URL}}`;

const email1Html = wrap({
  preview: 'We found issues. This is just the surface.',
  body: `
<div style="font-family:'Helvetica Neue',Arial,sans-serif;font-size:16px;line-height:1.65;color:#e8e4f4;">

<p style="margin:0 0 16px 0;">We ran your scan.</p>

<p style="margin:0 0 16px 0;">And we found issues.</p>

<p style="margin:0 0 16px 0;color:#c8c4e0;">Missing metadata. Registration gaps. Unclaimed royalties.</p>

<p style="margin:24px 0 8px 0;font-weight:700;color:#ffffff;font-size:18px;">This is happening right now.</p>
<p style="margin:0 0 24px 0;color:#c8c4e0;">Not later. Not "maybe." Right now.</p>

<p style="margin:0 0 8px 0;color:#c8c4e0;">Your free scan only shows a preview.</p>
<p style="margin:0 0 16px 0;color:#ffffff;font-weight:700;">Your full audit shows:</p>

<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 16px 0;">
<tr><td style="padding:4px 0;color:#e8e4f4;"><span style="color:#8a5cff;font-weight:700;">✓</span> &nbsp; Exactly what's broken</td></tr>
<tr><td style="padding:4px 0;color:#e8e4f4;"><span style="color:#8a5cff;font-weight:700;">✓</span> &nbsp; Where your money is leaking</td></tr>
<tr><td style="padding:4px 0;color:#e8e4f4;"><span style="color:#8a5cff;font-weight:700;">✓</span> &nbsp; What to fix (step-by-step)</td></tr>
</table>

${button('Get My Full Audit →', '{{AUDIT_URL}}')}

<p style="margin:32px 0 16px 0;color:#9490b8;font-size:14px;line-height:1.65;">Most artists never fix this.<br>They just keep releasing&hellip;<br><span style="color:#c8c4e0;">&hellip;while their money goes somewhere else.</span></p>

<p style="margin:0;color:#ffffff;font-weight:700;">Don't be that artist.</p>

</div>`,
  footerNote: ''
});

// ═══════════════════════════════════════════════════════════
// EMAIL 2 — DAY 1 (24 hours after submit)
// ═══════════════════════════════════════════════════════════

const email2Text = `Quick reminder —

Nothing has been fixed.

Your royalties are still leaking.

Every stream. Every play. Every sync opportunity.
Still misrouted.

You already saw the warning.

Now you have a choice:
Ignore it OR fix it

Fix my royalties: {{AUDIT_URL}}

This is why most artists stay broke.
Not lack of talent.
Broken backend.

—
Royaltē

Unsubscribe: {{UNSUBSCRIBE_URL}}`;

const email2Html = wrap({
  preview: "Nothing's changed since your scan.",
  body: `
<div style="font-family:'Helvetica Neue',Arial,sans-serif;font-size:16px;line-height:1.65;color:#e8e4f4;">

<p style="margin:0 0 16px 0;color:#c8c4e0;">Quick reminder —</p>

<p style="margin:0 0 8px 0;font-size:20px;font-weight:700;color:#ffffff;">Nothing has been fixed.</p>
<p style="margin:0 0 24px 0;color:#c8c4e0;">Your royalties are still leaking.</p>

<p style="margin:0 0 4px 0;color:#9490b8;">Every stream. Every play. Every sync opportunity.</p>
<p style="margin:0 0 24px 0;color:#ff8590;font-weight:700;">Still misrouted.</p>

<p style="margin:0 0 8px 0;color:#c8c4e0;">You already saw the warning.</p>
<p style="margin:0 0 16px 0;color:#ffffff;font-weight:700;">Now you have a choice:</p>

<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 16px 0;">
<tr><td style="padding:6px 0;color:#9490b8;font-size:15px;">Ignore it</td></tr>
<tr><td style="padding:6px 0;color:#ffffff;font-size:15px;font-weight:700;">OR fix it</td></tr>
</table>

${button('Fix My Royalties Now', '{{AUDIT_URL}}')}

<p style="margin:32px 0 8px 0;color:#9490b8;font-size:14px;line-height:1.65;">This is why most artists stay broke.</p>
<p style="margin:0 0 4px 0;color:#c8c4e0;font-size:14px;">Not lack of talent.</p>
<p style="margin:0;color:#ffffff;font-weight:700;font-size:14px;">Broken backend.</p>

</div>`,
  footerNote: ''
});

// ═══════════════════════════════════════════════════════════
// EMAIL 3 — DAY 3 (72 hours after submit)
// ═══════════════════════════════════════════════════════════

const email3Text = `Here's the truth:

The music industry doesn't fix this for you.
It was never built to.

Royalties don't just "show up."

They depend on:
- Metadata
- Registrations
- Publishing setup
- Matching systems

If those are wrong…
You don't get paid.

Your scan already showed issues.
The full audit shows where you're losing money.

See my full audit: {{AUDIT_URL}}

You either control your data…
Or your data controls your income.

—
Royaltē

Unsubscribe: {{UNSUBSCRIBE_URL}}`;

const email3Html = wrap({
  preview: 'And it costs them.',
  body: `
<div style="font-family:'Helvetica Neue',Arial,sans-serif;font-size:16px;line-height:1.65;color:#e8e4f4;">

<p style="margin:0 0 16px 0;color:#c8c4e0;">Here's the truth:</p>

<p style="margin:0 0 8px 0;font-size:18px;color:#ffffff;font-weight:700;">The music industry doesn't fix this for you.</p>
<p style="margin:0 0 24px 0;color:#9490b8;">It was never built to.</p>

<p style="margin:0 0 8px 0;color:#c8c4e0;">Royalties don't just "show up."</p>
<p style="margin:0 0 12px 0;color:#ffffff;font-weight:700;">They depend on:</p>

<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px 0;">
<tr><td style="padding:4px 0;color:#e8e4f4;"><span style="color:#8a5cff;">▸</span> &nbsp; Metadata</td></tr>
<tr><td style="padding:4px 0;color:#e8e4f4;"><span style="color:#8a5cff;">▸</span> &nbsp; Registrations</td></tr>
<tr><td style="padding:4px 0;color:#e8e4f4;"><span style="color:#8a5cff;">▸</span> &nbsp; Publishing setup</td></tr>
<tr><td style="padding:4px 0;color:#e8e4f4;"><span style="color:#8a5cff;">▸</span> &nbsp; Matching systems</td></tr>
</table>

<p style="margin:0 0 4px 0;color:#c8c4e0;">If those are wrong&hellip;</p>
<p style="margin:0 0 24px 0;color:#ff8590;font-weight:700;font-size:18px;">You don't get paid.</p>

<p style="margin:0 0 4px 0;color:#9490b8;font-size:14px;">Your scan already showed issues.</p>
<p style="margin:0 0 16px 0;color:#ffffff;font-weight:700;">The full audit shows where you're losing money.</p>

${button('See My Full Audit →', '{{AUDIT_URL}}')}

<p style="margin:32px 0 8px 0;color:#c8c4e0;font-size:14px;line-height:1.65;">You either control your data&hellip;</p>
<p style="margin:0;color:#ffffff;font-weight:700;font-size:14px;">Or your data controls your income.</p>

</div>`,
  footerNote: ''
});

// ═══════════════════════════════════════════════════════════
// EMAIL 4 — DAY 5 (120 hours after submit)
// ═══════════════════════════════════════════════════════════

const email4Text = `We're not keeping this open forever.

Free audits are limited.

You already ran the scan.
You already saw the warning.

This is your last chance to:
- Find what's broken
- Fix your setup
- Start getting paid properly

Get my full audit: {{AUDIT_URL}}

After this — it's gone.

—
Royaltē

Unsubscribe: {{UNSUBSCRIBE_URL}}`;

const email4Html = wrap({
  preview: "We're closing this soon.",
  body: `
<div style="font-family:'Helvetica Neue',Arial,sans-serif;font-size:16px;line-height:1.65;color:#e8e4f4;">

<p style="margin:0 0 8px 0;font-size:20px;font-weight:700;color:#ffffff;">We're not keeping this open forever.</p>
<p style="margin:0 0 24px 0;color:#ff8590;font-weight:700;">Free audits are limited.</p>

<p style="margin:0 0 4px 0;color:#c8c4e0;">You already ran the scan.</p>
<p style="margin:0 0 24px 0;color:#c8c4e0;">You already saw the warning.</p>

<p style="margin:0 0 12px 0;color:#ffffff;font-weight:700;">This is your last chance to:</p>

<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 16px 0;">
<tr><td style="padding:4px 0;color:#e8e4f4;"><span style="color:#8a5cff;font-weight:700;">✓</span> &nbsp; Find what's broken</td></tr>
<tr><td style="padding:4px 0;color:#e8e4f4;"><span style="color:#8a5cff;font-weight:700;">✓</span> &nbsp; Fix your setup</td></tr>
<tr><td style="padding:4px 0;color:#e8e4f4;"><span style="color:#8a5cff;font-weight:700;">✓</span> &nbsp; Start getting paid properly</td></tr>
</table>

${button('Get My Full Audit', '{{AUDIT_URL}}')}

<p style="margin:32px 0 0 0;color:#9490b8;font-size:14px;line-height:1.65;">After this — it's gone.</p>

</div>`,
  footerNote: ''
});

// ═══════════════════════════════════════════════════════════
// EXPORT
// ═══════════════════════════════════════════════════════════

export const ROYALTE_EMAILS = {
  email1: {
    id:           'royalte-email-1-instant',
    sequence:     1,
    name:         'Instant — submit confirmation + first push',
    subject:      '⚠️ You\'re already losing royalties',
    preview:      'We found issues. This is just the surface.',
    sendDelayMs:  0,
    sendDelayHours: 0,
    text:         email1Text,
    html:         email1Html
  },
  email2: {
    id:           'royalte-email-2-day1',
    sequence:     2,
    name:         'Day 1 — pressure',
    subject:      'You\'re still leaving money on the table',
    preview:      'Nothing\'s changed since your scan.',
    sendDelayMs:  24 * 60 * 60 * 1000,
    sendDelayHours: 24,
    text:         email2Text,
    html:         email2Html
  },
  email3: {
    id:           'royalte-email-3-day3',
    sequence:     3,
    name:         'Day 3 — authority + fear',
    subject:      'Most artists never fix this',
    preview:      'And it costs them.',
    sendDelayMs:  72 * 60 * 60 * 1000,
    sendDelayHours: 72,
    text:         email3Text,
    html:         email3Html
  },
  email4: {
    id:           'royalte-email-4-day5',
    sequence:     4,
    name:         'Day 5 — urgency / last chance',
    subject:      'Last chance — free audit',
    preview:      'We\'re closing this soon.',
    sendDelayMs:  120 * 60 * 60 * 1000,
    sendDelayHours: 120,
    text:         email4Text,
    html:         email4Html
  }
};

// Convenience array form for sequential iteration
export const ROYALTE_EMAIL_SEQUENCE = [
  ROYALTE_EMAILS.email1,
  ROYALTE_EMAILS.email2,
  ROYALTE_EMAILS.email3,
  ROYALTE_EMAILS.email4
];

// Helper for runtime variable substitution.
// Pass the template (text or html) and a values object — returns rendered string.
// Unknown {{TOKENS}} are left in place so partial data doesn't silently break sends.
export function renderRoyalteEmail(template, values = {}) {
  if (typeof template !== 'string') return '';
  const v = values || {};
  return template
    .replace(/\{\{ARTIST_NAME\}\}/g,     v.artistName     || 'there')
    .replace(/\{\{ROYALTE_SCORE\}\}/g,   v.royalteScore != null ? String(v.royalteScore) : '—')
    .replace(/\{\{ISSUES_COUNT\}\}/g,    v.issuesCount  != null ? String(v.issuesCount)  : '—')
    .replace(/\{\{SOURCE_URL\}\}/g,      v.sourceUrl      || '')
    .replace(/\{\{AUDIT_URL\}\}/g,       v.auditUrl       || 'https://royalte.ai')
    .replace(/\{\{UNSUBSCRIBE_URL\}\}/g, v.unsubscribeUrl || 'https://royalte.ai/unsubscribe');
}
