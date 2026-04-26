// Catalog table — per-track ISRC + monetization status + brand-marked platform dots.
import { $ } from '../utils/dom.js';
import { CATALOG } from '../data/catalog.js';
import { BRAND_ICONS } from '../utils/brandIcons.js';

export function renderCatalog() {
  const tbody = document.querySelector('#catalogTable tbody');
  if (!tbody) return;
  tbody.innerHTML = CATALOG.map(t => `
    <tr>
      <td class="catalog-track-name">${t.track}</td>
      <td class="catalog-isrc">${t.isrc}</td>
      <td><div class="platform-dots">${t.platforms.map(p => `<span class="platform-dot" data-platform="${p}" title="${p.charAt(0).toUpperCase() + p.slice(1)}">${BRAND_ICONS[p] || ''}</span>`).join('')}</div></td>
      <td><span class="catalog-status ${t.status}">${t.status === 'full' ? 'Fully monetized' : t.status === 'partial' ? 'Partial' : 'Missing data'}</span></td>
    </tr>`).join('');
}
