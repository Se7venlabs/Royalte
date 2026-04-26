// Action Plan: numbered preview list on Dashboard + full step-by-step list
// on the Action Plan route.
import { $ } from '../utils/dom.js';
import { ACTION_PLAN } from '../data/actionPlan.js';

export function renderTopActions() {
  const list = $('#topActionList');
  if (!list) return;
  list.innerHTML = ACTION_PLAN.map(a => `
    <li class="action-row">
      <div class="action-num">${a.num}</div>
      <div class="action-info">
        <div class="action-title">${a.title}</div>
        <div class="action-sub">${a.sub}</div>
      </div>
      <span class="issue-severity sev-${a.severity}">${a.severity}</span>
      <span class="action-arrow">›</span>
    </li>`).join('');
}

export function renderFullActionPlan() {
  const list = $('#fullActionList');
  if (!list) return;
  list.innerHTML = ACTION_PLAN.map(a => `
    <div class="action-plan-card">
      <div class="action-plan-num">${a.num}</div>
      <div class="action-plan-body">
        <div class="action-plan-title">${a.title}</div>
        <div class="action-plan-desc">${a.sub} — estimated impact addressed</div>
        <ol class="action-plan-steps">
          ${a.steps.map(s => `<li>${s}</li>`).join('')}
        </ol>
        ${a.link && a.link !== '#' ? `<a href="${a.link}" target="_blank" rel="noopener" class="action-plan-link">Open helpful resource →</a>` : ''}
      </div>
      <span class="issue-severity sev-${a.severity}">${a.severity}</span>
    </div>`).join('');
}
