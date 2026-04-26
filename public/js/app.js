/* ============================================================
   ROYALTĒ DASHBOARD — APP ENTRY POINT
   ------------------------------------------------------------
   UI prototype only. No backend, no Stripe, no auth yet.
   API hook points are marked across the codebase with: // [API HOOK]
   ------------------------------------------------------------
   This file orchestrates init only. Component logic lives in
   js/components/. Mock data lives in js/data/. Utilities in js/utils/.
   ============================================================ */

import { initRouter } from './utils/router.js';
import { drawRevenueChart, drawTrendChart } from './utils/charts.js';

import { renderHeroStats }       from './components/heroStats.js';
import { renderTopIssues, renderAllIssues } from './components/topIssuesCard.js';
import { initIssuesFilter }      from './components/issuesPage.js';
import { renderTopActions, renderFullActionPlan } from './components/actionPlanCard.js';
import { renderPlatforms }       from './components/platformStrip.js';
import { renderSetup }           from './components/setupPage.js';
import { renderCatalog }         from './components/catalogPage.js';
import { renderReports }         from './components/reportsPage.js';
import { initPlanToggle }        from './components/planToggle.js';

// Global action handlers (mock buttons that hit an API in production).
// Lives at app level since it's a tiny global delegated listener.
function initGlobalActions() {
  document.addEventListener('click', e => {
    const action = e.target.closest('[data-action]')?.dataset.action;
    if (!action) return;
    if (action === 'upgrade') {
      // [API HOOK] POST /api/create-checkout-session
      alert('Upgrade flow → would redirect to Stripe Checkout for Pro Monitor ($19.99/mo).');
    } else if (action === 'new-scan') {
      // [API HOOK] POST /api/submit-audit
      alert('Run New Scan → would call /api/submit-audit and start a new ScanSession.');
    } else if (action === 'download-report') {
      // [API HOOK] GET /api/reports/:id/pdf
      alert('Download PDF → would fetch the generated audit report.');
    }
  });
}

function init() {
  // Static renders
  renderHeroStats();
  renderTopIssues();
  renderAllIssues('all');
  renderTopActions();
  renderFullActionPlan();
  renderPlatforms();
  renderSetup();
  renderCatalog();
  renderReports();

  // Charts
  drawRevenueChart();
  drawTrendChart();

  // Interactivity
  initRouter();
  initIssuesFilter();
  initPlanToggle();
  initGlobalActions();
}

window.addEventListener('load', init);
window.addEventListener('resize', () => {
  drawRevenueChart();
  drawTrendChart();
});
