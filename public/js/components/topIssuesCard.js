// Top Issues card on the Dashboard route + full Issues Found page list.
// Both share the same row template via issueRow().
import { $ } from '../utils/dom.js';
import { ISSUES } from '../data/issues.js';
import { ICONS } from '../utils/issueIcons.js';

function issueRow(i, full = false) {
  const sevClass = `issue-icon-${i.severity.toLowerCase()}`;
  return `
    <li class="issue-row">
      <div class="issue-icon ${sevClass}">${ICONS[i.icon] || ICONS.tag}</div>
      <div class="issue-info">
        <div class="issue-title">${i.title}</div>
        <div class="issue-sub">${i.sub}${full && i.tracks ? ` · ${i.tracks} track${i.tracks !== 1 ? 's' : ''}` : ''}</div>
      </div>
      <span class="issue-severity sev-${i.severity}">${i.severity}</span>
      <span class="issue-impact">${i.impact}</span>
    </li>`;
}

export function renderTopIssues() {
  const list = $('#topIssuesList');
  if (!list) return;
  list.innerHTML = ISSUES.slice(0, 5).map(i => issueRow(i)).join('');
}

export function renderAllIssues(filter = 'all') {
  const list = $('#allIssuesList');
  if (!list) return;
  const filtered = filter === 'all' ? ISSUES : ISSUES.filter(i => i.severity === filter);
  list.innerHTML = filtered.map(i => issueRow(i, true)).join('');
}
