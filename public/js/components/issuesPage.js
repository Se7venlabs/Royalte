// Issues Found route — wires the filter chips. Initial render + filtered
// re-renders both call into renderAllIssues from topIssuesCard.js.
import { $$ } from '../utils/dom.js';
import { renderAllIssues } from './topIssuesCard.js';

export function initIssuesFilter() {
  $$('.filter-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      $$('.filter-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      renderAllIssues(chip.dataset.filter);
    });
  });
}
