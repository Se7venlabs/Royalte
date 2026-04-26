// SetupActionButtons — the Connect / Verify / View affected tracks / etc.
// row at the bottom of each SetupCard. First button is primary, rest are
// secondary. data-route-link is honored by router delegation.
export function renderActionButtons(actions = []) {
  if (!actions.length) return '';
  return `
    <div class="setup-actions">
      ${actions.map((a, i) => `
        <button class="${i === 0 ? 'btn-primary' : 'btn-secondary'} setup-action-btn" data-route-link="${a.route}">${a.label} →</button>
      `).join('')}
    </div>`;
}
