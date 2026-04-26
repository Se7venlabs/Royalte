// SetupCard — single rich card for one setup area (Distributor / PRO / etc).
// Composed of: header strip, detected fields grid, intake fields,
// SetupStatusRow checks, warning callout, SetupActionButtons.
import { renderIntakeField } from './setupIntakeField.js';
import { renderStatusRows }  from './setupStatusRow.js';
import { renderActionButtons } from './setupActionButtons.js';

const STATUS_LABEL = { connected: 'Connected', partial: 'Partial', missing: 'Missing' };

export function renderSetupCard(s) {
  return `
    <div class="setup-card setup-card-rich" data-setup-id="${s.id}">

      <!-- Header strip: title + blurb + status badge + score + last verified -->
      <div class="setup-card-header">
        <div class="setup-card-titlewrap">
          <div class="setup-card-title">${s.title}</div>
          <div class="setup-card-blurb">${s.blurb}</div>
        </div>
        <div class="setup-card-meta">
          <span class="setup-status ${s.status}">${STATUS_LABEL[s.status]}</span>
          <div class="setup-score-wrap">
            <span class="setup-score setup-score-${s.status}">${s.score}</span>
            <span class="setup-score-label">/ 100</span>
          </div>
        </div>
      </div>
      <div class="setup-card-verified">Last verified ${s.lastVerified}</div>

      <!-- Detected: read-only fields auto-populated from connected platforms -->
      <div class="setup-section-label">Detected</div>
      <div class="setup-detected-grid">
        ${s.detected.map(d => `
          <div class="detected-item">
            <div class="detected-label">${d.label}</div>
            <div class="detected-value">${d.value}</div>
          </div>`).join('')}
      </div>

      <!-- Intake: editable fields the user fills in -->
      ${s.intake && s.intake.length ? `
        <div class="setup-section-label">Intake</div>
        <div class="intake-grid">
          ${s.intake.map(renderIntakeField).join('')}
        </div>` : ''}

      <!-- Sub-checks -->
      <div class="setup-section-label">Checks</div>
      ${renderStatusRows(s.checks)}

      <!-- Inline warning callout -->
      ${s.warning ? `
        <div class="setup-warning setup-warning-${s.warning.severity}">
          <div class="setup-warning-icon">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          </div>
          <div class="setup-warning-body">
            <div class="setup-warning-text">${s.warning.text}</div>
            <div class="setup-warning-impact">${s.warning.impact}</div>
          </div>
        </div>` : ''}

      ${renderActionButtons(s.actions)}
    </div>`;
}
