// Reports route — past audit history with download-PDF buttons.
import { $ } from '../utils/dom.js';
import { REPORTS } from '../data/reports.js';

export function renderReports() {
  const list = $('#reportsList');
  if (!list) return;
  list.innerHTML = REPORTS.map(r => `
    <li class="report-row">
      <div class="report-icon">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
      </div>
      <div>
        <div class="report-title">${r.title}</div>
        <div class="report-meta">${r.date}</div>
      </div>
      <div class="report-score">${r.score}%</div>
      <button class="btn-download" data-action="download-report">Download PDF</button>
    </li>`).join('');
}
