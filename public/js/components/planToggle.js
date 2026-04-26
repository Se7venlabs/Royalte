// Plan-state toggle (Free / Audit / Pro).
//
// Drives:
//   - body.plan-{free|audit|pro} class for CSS gating
//   - sidebar user-plan label
//   - Settings → Subscription card text/button
//   - Monitoring page gate overlay
//   - Sidebar upgrade card visibility (hidden for Pro)
//   - Free-plan blur overlay on Issues / Action Plan / Catalog / Reports
//
// [API HOOK] Replace with real subscription_status from Supabase
//   (e.g. audit_sessions.user_tier or similar).
import { $, $$, on } from '../utils/dom.js';
import { PLAN_LABELS } from '../data/planConfig.js';

let currentPlan = 'audit';

export function setPlan(plan) {
  currentPlan = plan;
  document.body.classList.remove('plan-free', 'plan-audit', 'plan-pro');
  document.body.classList.add(`plan-${plan}`);

  // Toggle buttons active state
  $$('.plan-btn').forEach(b => b.classList.toggle('active', b.dataset.plan === plan));

  // Sidebar plan label
  const planLabel = $('#userPlanLabel');
  if (planLabel) planLabel.textContent = `${PLAN_LABELS[plan]} Plan`;

  // Settings subscription card
  const subName = $('#subName');
  const subMeta = $('#subMeta');
  const subBtn  = $('#subUpgradeBtn');
  if (subName && subMeta && subBtn) {
    if (plan === 'free') {
      subName.textContent = 'Free Scan';
      subMeta.textContent = 'Limited preview only — upgrade to view full results';
      subBtn.textContent = 'Get Full Audit';
      subBtn.style.display = '';
    } else if (plan === 'audit') {
      subName.textContent = 'Full Audit (one-time)';
      subMeta.textContent = 'Snapshot report & limited dashboard access';
      subBtn.textContent = 'Upgrade to Pro';
      subBtn.style.display = '';
    } else {
      subName.textContent = 'Pro Monitoring — $19.99/mo';
      subMeta.textContent = 'Continuous monitoring, alerts, and full dashboard';
      subBtn.style.display = 'none';
    }
  }

  // Monitoring gate
  const monGate = $('#monitoringGate');
  const monContent = $('#monitoringContent');
  if (monGate && monContent) {
    if (plan === 'pro') {
      monGate.classList.add('hidden');
      monContent.classList.remove('locked');
    } else {
      monGate.classList.remove('hidden');
      monContent.classList.add('locked');
    }
  }

  // Upgrade card hidden for Pro
  const upgradeCard = $('#upgradeCard');
  if (upgradeCard) upgradeCard.style.display = plan === 'pro' ? 'none' : '';

  applyFreeGating();
}

function applyFreeGating() {
  const lockableRoutes = ['issues', 'actions', 'catalog', 'reports'];
  lockableRoutes.forEach(r => {
    const section = document.querySelector(`[data-route-content="${r}"]`);
    if (!section) return;
    section.querySelectorAll('.free-lock-message').forEach(n => n.remove());
    section.querySelectorAll('.lockable-free').forEach(n => n.classList.remove('lockable-free'));

    if (currentPlan === 'free') {
      const cards = section.querySelectorAll('.card, .action-plan-list, .filter-row');
      cards.forEach(c => c.classList.add('lockable-free'));
      const lock = document.createElement('div');
      lock.className = 'free-lock-message';
      lock.innerHTML = `
        <div class="free-lock-message-card">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          Get the Full Audit to unlock this view
          <button class="btn-primary" data-action="upgrade" style="margin-left:8px;padding:7px 14px;font-size:12px;">Get Full Audit</button>
        </div>`;
      section.style.position = 'relative';
      section.appendChild(lock);
    }
  });
}

export function initPlanToggle() {
  $$('.plan-btn').forEach(btn => on(btn, 'click', () => setPlan(btn.dataset.plan)));
  setPlan('audit'); // default
}
