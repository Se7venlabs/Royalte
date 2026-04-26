// Single-page hash-based router. Drives nav active-state + section visibility +
// topbar subtitle text. Exposes setRoute() for programmatic navigation
// (called by data-route-link delegation in app.js).
import { $$, $ } from './dom.js';

export const ROUTES = ['dashboard', 'setup', 'issues', 'actions', 'catalog', 'monitoring', 'reports', 'settings'];

const SUBTITLES = {
  dashboard: "Here's what's happening with your royalties.",
  setup:     'Manage how your royalty system is structured.',
  issues:    'Review every issue we identified in your setup.',
  actions:   'Step-by-step plan to fix what we found.',
  catalog:   'Your catalog and per-track monetization status.',
  monitoring:'Continuous tracking, alerts, and re-scans.',
  reports:   'Your audit reports and scan history.',
  settings:  'Account, notifications, and connections.',
};

export function setRoute(route) {
  if (!ROUTES.includes(route)) route = 'dashboard';
  $$('[data-route-content]').forEach(s => s.classList.toggle('hidden', s.dataset.routeContent !== route));
  $$('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.route === route));
  const sub = $('#topbarSubtitle');
  if (sub) sub.textContent = SUBTITLES[route];
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

export function initRouter() {
  // Sidebar nav clicks
  $$('.nav-item').forEach(item => {
    item.addEventListener('click', e => { e.preventDefault(); setRoute(item.dataset.route); });
  });
  // Cross-route links (delegated so dynamically rendered links also fire)
  document.addEventListener('click', e => {
    const el = e.target.closest('[data-route-link]');
    if (!el) return;
    e.preventDefault();
    setRoute(el.dataset.routeLink);
  });
  // Initial route from hash
  const hash = window.location.hash.replace('#', '');
  if (ROUTES.includes(hash)) setRoute(hash);
}
