// SetupIntakeField — renders one editable input inside a SetupCard.
// Type-discriminated: text | textarea | select | toggle | multi.
// Multi-chip click handlers + change events are wired in setupPage.js.
export function renderIntakeField(f, idx) {
  const id = `intake-${idx}`;

  if (f.type === 'text') {
    return `
      <div class="intake-field">
        <label class="intake-label" for="${id}">${f.label}</label>
        <input id="${id}" class="intake-input" type="text" value="${f.value || ''}" placeholder="${f.placeholder || ''}" />
        ${f.hint ? `<div class="intake-hint">${f.hint}</div>` : ''}
      </div>`;
  }

  if (f.type === 'textarea') {
    return `
      <div class="intake-field intake-field-wide">
        <label class="intake-label" for="${id}">${f.label}</label>
        <textarea id="${id}" class="intake-input intake-textarea" rows="3" placeholder="${f.placeholder || ''}">${f.value || ''}</textarea>
        ${f.hint ? `<div class="intake-hint">${f.hint}</div>` : ''}
      </div>`;
  }

  if (f.type === 'select') {
    const opts = f.options.map(o => {
      const display = (f.labels && f.labels[o]) || o || (f.placeholder || '— Select —');
      const selected = o === f.value ? 'selected' : '';
      return `<option value="${o}" ${selected}>${display}</option>`;
    }).join('');
    return `
      <div class="intake-field">
        <label class="intake-label" for="${id}">${f.label}</label>
        <select id="${id}" class="intake-input intake-select">${opts}</select>
        ${f.hint ? `<div class="intake-hint">${f.hint}</div>` : ''}
      </div>`;
  }

  if (f.type === 'toggle') {
    const checked = f.value ? 'checked' : '';
    return `
      <div class="intake-field intake-field-toggle">
        <div>
          <label class="intake-label" for="${id}">${f.label}</label>
          ${f.hint ? `<div class="intake-hint">${f.hint}</div>` : ''}
        </div>
        <label class="switch"><input id="${id}" type="checkbox" ${checked} /><span class="slider"></span></label>
      </div>`;
  }

  if (f.type === 'multi') {
    const chips = f.options.map(o => {
      const active = (f.value || []).includes(o) ? 'active' : '';
      return `<button type="button" class="multi-chip ${active}" data-value="${o}">${o}</button>`;
    }).join('');
    return `
      <div class="intake-field intake-field-wide">
        <label class="intake-label">${f.label}</label>
        <div class="multi-chips">${chips}</div>
        ${f.hint ? `<div class="intake-hint">${f.hint}</div>` : ''}
      </div>`;
  }

  return '';
}
