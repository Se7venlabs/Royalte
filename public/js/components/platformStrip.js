// "Your Platforms" grid on the Dashboard route.
// Uses BRAND_ICONS for the SVG mark and brand-tint CSS via [data-platform].
import { $ } from '../utils/dom.js';
import { PLATFORMS } from '../data/platforms.js';
import { BRAND_ICONS } from '../utils/brandIcons.js';

export function renderPlatforms() {
  const grid = $('#platformGrid');
  if (!grid) return;
  grid.innerHTML = PLATFORMS.map(p => {
    const mark = BRAND_ICONS[p.icon] || `<span class="platform-logo-text">${p.name}</span>`;
    return `
    <div class="platform-cell" data-platform="${p.icon}">
      <div class="platform-logo">${mark}</div>
      <div class="platform-name">${p.meta || p.name}</div>
      <div class="platform-status ${p.status}">${p.status === 'connected' ? 'Connected' : p.status === 'partial' ? 'Partial' : 'Available'}</div>
    </div>`;
  }).join('');
}
