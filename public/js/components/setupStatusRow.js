// SetupStatusRow — a single sub-check row inside a SetupCard.
// Renders ✓ / ⚠ / ✕ icon + label + detail line.
const STATE_ICONS = { ok: '✓', partial: '⚠', missing: '✕' };

export function renderStatusRow(check) {
  return `
    <li class="check-item check-${check.state}">
      <span class="check-icon">${STATE_ICONS[check.state] || '·'}</span>
      <div class="check-body">
        <div class="check-label">${check.label}</div>
        <div class="check-detail">${check.detail}</div>
      </div>
    </li>`;
}

export function renderStatusRows(checks) {
  return `<ul class="setup-checks">${checks.map(renderStatusRow).join('')}</ul>`;
}
