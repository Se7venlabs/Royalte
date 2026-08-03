// ─────────────────────────────────────────────────────────────────────
//  Content Approval Center™ — Phase 1, Executive Visibility Rule™
// ─────────────────────────────────────────────────────────────────────
//
//  Every automated publishing lifecycle event gets an email to
//  info@royalte.ai: Approval Required, Article Approved, Publishing
//  Started, Publishing Completed, Publishing Failed, Weekly Publishing
//  Summary. Executives should never need GitHub/Actions/registry files/
//  Vercel to know publishing status -- see
//  governance/CONTENT_APPROVAL_CENTER_ARCHITECTURE.md.
//
//  HTML rendering is pure (no network) so it's directly testable;
//  sendXxxEmail wrappers are the only functions that touch Resend.
//  Reuses api/_lib/royalteEmailTemplates.js's wrap()/button() chrome --
//  same brand, no duplicated HTML. These are transactional/internal
//  emails (to info@royalte.ai, not an end artist), so the shared
//  template's {{UNSUBSCRIBE_URL}} placeholder is substituted with the
//  site root rather than left as a dead link or given a real unsubscribe
//  mechanism that doesn't apply here.
// ─────────────────────────────────────────────────────────────────────

import { readFileSync, existsSync } from 'node:fs';
import { Resend } from 'resend';
import { wrap, button } from '../../api/_lib/royalteEmailTemplates.js';

const RECIPIENT = 'info@royalte.ai';
const FROM = 'Royaltē <info@royalte.ai>';
const SITE_ORIGIN = 'https://royalte.ai';

function escHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function articleUrl(article) {
  return `${SITE_ORIGIN}/${article.type}/${article.slug}.html`;
}

function finalizeHtml(html) {
  return html.replaceAll('{{UNSUBSCRIBE_URL}}', SITE_ORIGIN);
}

// extractSeoMetadata(htmlContent) -> { seoTitle, metaDescription, keywords }
// Pure string parsing, no DOM library (matches this codebase's "no
// framework" convention). ECR-002: SEO Title/Meta Description/Focus
// Keyword aren't registry fields -- the article's own <head> is the real
// source of truth for what search engines see, so this reads it directly
// rather than risking a second, driftable copy in the registry. A tag
// genuinely absent renders as 'Not specified', never fabricated.
export function extractSeoMetadata(htmlContent) {
  const titleMatch = htmlContent.match(/<title>([^<]*)<\/title>/i);
  const descMatch = htmlContent.match(/<meta\s+name=["']description["']\s+content=["']([^"']*)["']/i);
  const keywordsMatch = htmlContent.match(/<meta\s+name=["']keywords["']\s+content=["']([^"']*)["']/i);
  return {
    seoTitle: titleMatch ? titleMatch[1].trim() : null,
    metaDescription: descMatch ? descMatch[1].trim() : null,
    keywords: keywordsMatch ? keywordsMatch[1].trim() : null,
  };
}

// readSeoMetadata(article, repoRoot) -> { seoTitle, metaDescription, keywords }
// I/O wrapper around extractSeoMetadata -- returns all-null if the
// content file doesn't exist yet (never throws; the calling email should
// still send with "Not specified" rather than fail the whole run).
export function readSeoMetadata(article, repoRoot) {
  const fullPath = repoRoot ? `${repoRoot}/${article.contentPath}` : article.contentPath;
  if (!existsSync(fullPath)) return { seoTitle: null, metaDescription: null, keywords: null };
  return extractSeoMetadata(readFileSync(fullPath, 'utf8'));
}

function metaRow(label, value) {
  return `<tr><td style="padding:4px 0;font-size:13px;color:#7a7598;">${escHtml(label)}</td><td style="padding:4px 0;font-size:13px;color:#e8e4f4;text-align:right;">${escHtml(value ?? 'Not specified')}</td></tr>`;
}

// ── Approval Required ────────────────────────────────────────────────
// ECR-002: rich executive brief, not a developer notification. Featured
// Image/Executive Summary/Category/ReadTime/PublishDate are all existing
// registry fields; SEO Title/Meta Description/Focus Keyword come from
// readSeoMetadata (the article's own HTML), not the registry.
export function renderApprovalRequestEmail({ article, seo, approveUrl, rejectUrl }) {
  const heroImg = article.heroImagePath
    ? `<img src="${escHtml(SITE_ORIGIN + '/' + article.heroImagePath.replace(/^public\//, ''))}" alt="" style="width:100%;max-width:488px;border-radius:8px;margin-bottom:20px;">`
    : '';
  const body = `
    <div style="font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:#8a5cff;font-weight:700;margin-bottom:8px;">Approval Required</div>
    <h1 style="font-size:20px;color:#ffffff;margin:0 0 16px 0;">${escHtml(article.title)}</h1>
    ${heroImg}
    <p style="font-size:14px;line-height:1.6;color:#c8c4dc;margin:0 0 20px 0;">${escHtml(article.excerpt)}</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
      ${metaRow('Category', article.category)}
      ${metaRow('Read Time', article.readTime)}
      ${metaRow('Scheduled Publish Date', article.publishDate)}
      ${metaRow('SEO Title', seo.seoTitle)}
      ${metaRow('Meta Description', seo.metaDescription)}
      ${metaRow('Focus Keyword(s)', seo.keywords)}
    </table>
    <p style="font-size:13px;color:#7a7598;margin:0 0 4px 0;"><a href="${escHtml(articleUrl(article))}" style="color:#8a5cff;">Preview the live article →</a></p>
    ${button('🟢 Approve Publication', approveUrl)}
    ${button('🔴 Reject Publication', rejectUrl)}
  `;
  return {
    subject: `Approval Required — ${article.title}`,
    html: finalizeHtml(wrap({ preview: `Approve or reject: ${article.title}`, body })),
  };
}

export function renderDecisionConfirmEmail({ article, action }) {
  const approved = action === 'approve';
  const body = approved
    ? `
      <h1 style="font-size:20px;color:#ffffff;margin:0 0 16px 0;">✅ Article Approved</h1>
      <p style="font-size:14px;line-height:1.6;color:#c8c4dc;">${escHtml(article.title)} has been approved.</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0;">
        ${metaRow('Scheduled Publish Date', article.publishDate)}
        ${metaRow('Current Status', 'Approved — publishing will occur automatically')}
      </table>`
    : `
      <h1 style="font-size:20px;color:#ffffff;margin:0 0 16px 0;">Article Returned For Revision</h1>
      <p style="font-size:14px;line-height:1.6;color:#c8c4dc;">${escHtml(article.title)} has been rejected and moved to Needs Revision. Publishing has been cancelled until approved again.</p>`;
  return {
    subject: approved ? `✅ Royaltē Article Approved — ${article.title}` : `Royaltē Article Returned For Revision — ${article.title}`,
    html: finalizeHtml(wrap({ preview: approved ? 'Article approved' : 'Article returned for revision', body })),
  };
}

export function renderPublishingStartedEmail({ article, workflowRunId }) {
  const body = `
    <h1 style="font-size:20px;color:#ffffff;margin:0 0 16px 0;">🚀 Publishing Started</h1>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      ${metaRow('Article', article.title)}
      ${metaRow('Publishing Start Time', new Date().toISOString())}
      ${metaRow('Workflow ID', workflowRunId)}
    </table>
  `;
  return {
    subject: `🚀 Royaltē Publishing Started — ${article.title}`,
    html: finalizeHtml(wrap({ preview: `Publishing started: ${article.title}`, body })),
  };
}

// ECR-003: enhanced confirmation — adds totalPublishedCount and an
// explicit "Publication History recorded" line, both true at the point
// this is called (appendHistory already ran earlier in the same
// publishDueArticles pass).
export function renderPublishingSuccessEmail({ article, workflowRunId, totalPublishedCount }) {
  const body = `
    <h1 style="font-size:20px;color:#ffffff;margin:0 0 16px 0;">✅ Article Published</h1>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      ${metaRow('Article Title', article.title)}
      ${metaRow('Published', new Date().toISOString())}
      ${metaRow('Category', article.category)}
      ${metaRow('Read Time', article.readTime)}
      ${metaRow('RSS', 'Updated')}
      ${metaRow('Search Index', 'Updated')}
      ${metaRow('Deployment', 'Live via Vercel')}
      ${metaRow('Workflow Run', workflowRunId)}
      ${metaRow('Published in Royaltē Knowledge Hub', `${totalPublishedCount} articles total`)}
      ${metaRow('Publication History', 'Recorded')}
    </table>
    ${button('View Live Article', articleUrl(article))}
  `;
  return {
    subject: `✅ Royaltē Article Published — ${article.title}`,
    html: finalizeHtml(wrap({ preview: `${article.title} is live`, body })),
  };
}

export function renderPublishingFailureEmail({ article, reason, workflowRunId }) {
  const body = `
    <h1 style="font-size:20px;color:#ffffff;margin:0 0 16px 0;">🚨 Publishing Failed</h1>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      ${metaRow('Article', article.title)}
      ${metaRow('Failure Reason', reason)}
      ${metaRow('Workflow Reference', workflowRunId)}
      ${metaRow('Retry Status', 'Will retry automatically on the next scheduled run')}
      ${metaRow('Recommended Next Step', 'Confirm the article\'s content file has merged to main')}
    </table>
  `;
  return {
    subject: `🚨 Royaltē Publishing Failed — ${article.title}`,
    html: finalizeHtml(wrap({ preview: `Publishing failed: ${article.title}`, body })),
  };
}

export function renderWeeklyDigestEmail({ publishedLastWeek, scheduledThisWeek, awaitingApproval, needsRevision, failedLastWeek }) {
  const list = (label, articles) => `
    <div style="font-size:13px;font-weight:700;color:#ffffff;margin:16px 0 6px 0;">${escHtml(label)} (${articles.length})</div>
    ${articles.length === 0
      ? '<div style="font-size:13px;color:#7a7598;">None</div>'
      : articles.map(a => `<div style="font-size:13px;color:#c8c4dc;padding:2px 0;">${escHtml(a.title)}</div>`).join('')}
  `;
  const body = `
    <h1 style="font-size:20px;color:#ffffff;margin:0 0 16px 0;">📊 Weekly Publishing Summary</h1>
    ${list('Published Last Week', publishedLastWeek)}
    ${list('Scheduled This Week', scheduledThisWeek)}
    ${list('Awaiting Approval', awaitingApproval)}
    ${list('Needing Revision', needsRevision)}
    ${list('Failed Publications', failedLastWeek)}
  `;
  return {
    subject: '📊 Royaltē Weekly Publishing Summary',
    html: finalizeHtml(wrap({ preview: 'This week in Royaltē publishing', body })),
  };
}

// ── Send wrappers — the only functions here that touch the network ─────
function getResendClient() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error('[approval-mailer] RESEND_API_KEY not configured');
  return new Resend(apiKey);
}

async function send({ subject, html }) {
  const resend = getResendClient();
  const result = await resend.emails.send({ from: FROM, to: [RECIPIENT], subject, html });
  if (result.error) {
    const detail = result.error.message || JSON.stringify(result.error);
    throw new Error(`[approval-mailer] Resend send failed: ${detail}`);
  }
  return result.data?.id || null;
}

export async function sendApprovalRequestEmail(args) { return send(renderApprovalRequestEmail(args)); }
export async function sendDecisionConfirmEmail(args) { return send(renderDecisionConfirmEmail(args)); }
export async function sendPublishingStartedEmail(args) { return send(renderPublishingStartedEmail(args)); }
export async function sendPublishingSuccessEmail(args) { return send(renderPublishingSuccessEmail(args)); }
export async function sendPublishingFailureEmail(args) { return send(renderPublishingFailureEmail(args)); }
export async function sendWeeklyDigestEmail(args) { return send(renderWeeklyDigestEmail(args)); }
