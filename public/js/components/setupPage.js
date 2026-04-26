// My Setup route — renders all 6 SetupCards and wires intake-field
// console-logging (visual only, no persistence per scope).
// [API HOOK] PATCH /api/setup/:areaId — wire these to the backend later.
import { $, $$ } from '../utils/dom.js';
import { SETUP } from '../data/setup.js';
import { renderSetupCard } from './setupCard.js';

export function renderSetup() {
  const grid = $('#setupGrid');
  if (!grid) return;

  grid.innerHTML = SETUP.map(renderSetupCard).join('');

  // Wire intake field interactions — visual only, no persistence.
  const areaIdOf = (el) => el.closest('[data-setup-id]')?.dataset.setupId || 'unknown';
  const fieldOf  = (el) => el.closest('.intake-field')?.querySelector('.intake-label')?.textContent || '';

  $$('.multi-chip', grid).forEach(chip => {
    chip.addEventListener('click', () => {
      chip.classList.toggle('active');
      console.log('[setup intake]', { area: areaIdOf(chip), field: fieldOf(chip), value: chip.dataset.value, active: chip.classList.contains('active') });
    });
  });

  $$('.intake-input', grid).forEach(input => {
    const evt = input.tagName === 'SELECT' || input.type === 'checkbox' ? 'change' : 'input';
    input.addEventListener(evt, () => {
      const value = input.type === 'checkbox' ? input.checked : input.value;
      console.log('[setup intake]', { area: areaIdOf(input), field: fieldOf(input), value });
    });
  });

  $$('.intake-field-toggle input[type="checkbox"]', grid).forEach(input => {
    input.addEventListener('change', () => {
      console.log('[setup intake]', { area: areaIdOf(input), field: fieldOf(input), value: input.checked });
    });
  });
}
