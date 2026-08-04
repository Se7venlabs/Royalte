#!/usr/bin/env node
// Content Approval Center™ / Content Publishing Engine™ — Publishing
// Calendar™.
//
// A generated reference document, not a dashboard -- the Board
// explicitly ruled out a live dashboard for Phase 1 (replaced by the
// Weekly Executive Publishing Summary, weekly-digest.yml). This is
// closer in kind to content-registry/README.md: a human-readable,
// regenerate-on-demand snapshot of registry state, not a running
// service. Every article in the registry appears exactly once, grouped
// by lifecycle stage and sorted by publishDate.

import { loadRegistry } from './registry.mjs';

function fmtRow(a) {
  const date = a.publishDate || '—';
  return `| ${date} | ${a.title} | ${a.category} | ${a.slug} |`;
}

function section(title, articles) {
  const rows = articles
    .slice()
    .sort((a, b) => (a.publishDate || '9999-99-99').localeCompare(b.publishDate || '9999-99-99'))
    .map(fmtRow);
  return [
    `### ${title} (${articles.length})`,
    '',
    rows.length ? '| Date | Title | Category | Slug |' : '_None._',
    rows.length ? '|---|---|---|---|' : '',
    ...rows,
    '',
  ].filter(line => line !== '').join('\n');
}

// renderPublishingCalendar(allArticles, generatedAt) -> string. Pure --
// no fs, no network, no Date.now() -- matches this codebase's render.mjs
// convention.
export function renderPublishingCalendar(allArticles, generatedAt) {
  const published = allArticles.filter(a => a.publishStatus === 'published');
  const scheduled = allArticles.filter(a => a.publishStatus === 'scheduled' && a.approvalStatus === 'approved');
  const awaitingApproval = allArticles.filter(a => a.approvalStatus === 'awaiting_approval');
  const pendingReview = allArticles.filter(a => a.approvalStatus === 'pending' && a.publishStatus !== 'draft');
  const needsRevision = allArticles.filter(a => a.approvalStatus === 'needs_revision');
  const draft = allArticles.filter(a => a.publishStatus === 'draft');

  const preamble = [
    '# Royaltē Publishing Calendar™',
    '',
    `Generated ${generatedAt} from ${allArticles.length} registry ${allArticles.length === 1 ? 'entry' : 'entries'} (\`content-registry/articles/*.json\`) -- the registry is the source of truth; this is a snapshot, regenerate rather than hand-edit.`,
    '',
    'A reference document, not a dashboard -- the Board ruled out a live dashboard for Content Approval Center™ Phase 1 in favor of the Weekly Executive Publishing Summary (`weekly-digest.yml`). Regenerate on demand: `node scripts/content-publishing/generate-publishing-calendar.mjs`.',
  ].join('\n');

  const sections = [
    section('Published', published),
    section('Scheduled (approved, awaiting publish date)', scheduled),
    section('Awaiting Approval (email sent, no decision yet)', awaitingApproval),
    section('Pending Review (not yet due for an approval request)', pendingReview),
    section('Needs Revision (rejected)', needsRevision),
    section('Draft (not yet scheduled)', draft),
  ].join('\n\n');

  return `${preamble}\n\n${sections}\n`;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { writeFileSync } = await import('node:fs');
  const path = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const outPath = path.resolve(__dirname, '../../content-registry/PUBLISHING_CALENDAR.md');

  const allArticles = loadRegistry();
  const generatedAt = new Date().toISOString();
  const markdown = renderPublishingCalendar(allArticles, generatedAt);
  writeFileSync(outPath, markdown, 'utf8');
  console.log(`Publishing Calendar written to ${outPath} (${allArticles.length} articles).`);
}
