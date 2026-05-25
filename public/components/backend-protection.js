// Royaltē OS — Backend Protection panel (Brief 004).
//
// Self-contained vanilla JS component that reads monitoring_alerts and
// monitoring_subscriptions for the current (user, artist) and renders the
// V2 Backend Protection panel.
//
// Reads only — no writes. Auth-gated by Supabase RLS (auth.uid() = user_id
// on both tables) so the browser client returns only this user's rows.
//
// Two notes vs. the brief, both deliberate:
//
//   1. The brief says Tabler outline icons are "already loaded via CDN in
//      dashboard.html — do not add another import." They weren't. The
//      `<link rel="stylesheet">` to @tabler/icons-webfont is added once in
//      dashboard.html in this same PR.
//
//   2. The brief specifies color tokens like --color-background-secondary,
//      --color-text-danger, etc. The host dashboard.html explicitly forbids
//      new global CSS tokens ("Do NOT introduce new tokens. Reuse existing
//      CSS variables only"). To honour both: the brief's tokens are
//      declared SCOPED to .os-protection-panel — they don't leak into the
//      global namespace and the host palette is untouched.

const STYLE_ID = 'os-protection-panel-styles';
const RESCAN_WINDOW_DAYS = 7;

function ensureStylesInjected() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
.os-protection-panel{
  /* Brief 009 — dark-themed for the dashboard. Same scoped-token approach
     as before, palette swapped from white-card to dark-frosted to match
     the dashboard's existing .card aesthetic. The component remains
     drop-in usable elsewhere — only the palette values changed. */
  --color-background-primary:rgba(255,255,255,0.04);
  --color-background-secondary:rgba(255,255,255,0.06);
  --color-background-danger:rgba(240,80,96,0.12);
  --color-background-warning:rgba(240,192,64,0.12);
  --color-background-success:rgba(64,240,160,0.12);
  --color-text-primary:#e8e4f4;
  --color-text-secondary:#b0abd0;
  --color-text-tertiary:#8480a8;
  --color-text-danger:#f05060;
  --color-text-warning:#f0c040;
  --color-text-success:#40f0a0;
  --color-border:rgba(138,92,255,0.25);
  --color-success-dot:#40f0a0;
  --color-active-dot:#40f0a0;
  --color-inactive-dot:#8480a8;
  --osp-fs-sm:12px;
  --osp-fs-md:14px;
  --osp-fs-lg:18px;
  --osp-fs-xl:22px;

  background:var(--color-background-primary);
  color:var(--color-text-primary);
  border:1px solid var(--color-border);
  border-radius:12px;
  padding:1.25rem;
  font-family:'Space Grotesk',system-ui,sans-serif;
  font-size:var(--osp-fs-md);
  line-height:1.5;
  margin:24px 0;
  box-shadow:0 1px 0 rgba(255,255,255,0.03), 0 16px 40px rgba(0,0,0,0.32);
}

.os-protection-panel *{box-sizing:border-box;}

.osp-header{
  display:flex;justify-content:space-between;align-items:flex-start;gap:16px;
  padding-bottom:1rem;border-bottom:0.5px solid var(--color-border);
}
.osp-header-left h2{
  margin:0;font-size:var(--osp-fs-lg);font-weight:600;
  letter-spacing:-0.01em;color:var(--color-text-primary);
}
.osp-header-sub{
  margin-top:4px;font-size:var(--osp-fs-sm);color:var(--color-text-secondary);
}
.osp-pill{
  display:inline-flex;align-items:center;gap:6px;
  padding:5px 12px;border-radius:20px;
  font-size:var(--osp-fs-sm);font-weight:500;
  background:var(--color-background-secondary);
  color:var(--color-text-secondary);
  border:0.5px solid var(--color-border);
  white-space:nowrap;
}
.osp-pill.osp-pill-active{
  background:var(--color-background-success);color:var(--color-text-success);
}
.osp-pill .osp-pill-dot{
  width:6px;height:6px;border-radius:50%;background:var(--color-inactive-dot);
}
.osp-pill.osp-pill-active .osp-pill-dot{background:var(--color-active-dot);}

.osp-stats{
  display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-top:1rem;
}
.osp-stat{
  background:var(--color-background-secondary);
  border-radius:8px;padding:14px 16px;
}
.osp-stat-label{
  font-size:var(--osp-fs-sm);color:var(--color-text-secondary);
  font-weight:500;letter-spacing:0.01em;
}
.osp-stat-value{
  margin-top:6px;font-size:var(--osp-fs-xl);font-weight:600;
  color:var(--color-text-primary);font-variant-numeric:tabular-nums;
}
@media (max-width:640px){
  .osp-stats{grid-template-columns:1fr;}
}

.osp-section{margin-top:1.25rem;}
.osp-section-label{
  font-size:var(--osp-fs-sm);font-weight:600;text-transform:uppercase;
  letter-spacing:0.06em;color:var(--color-text-tertiary);
  margin-bottom:10px;
}

.osp-changes{display:flex;flex-direction:column;gap:8px;}
.osp-empty-feed{
  padding:18px;border-radius:8px;background:var(--color-background-secondary);
  color:var(--color-text-secondary);font-size:var(--osp-fs-sm);text-align:center;
}
.osp-change{
  display:grid;grid-template-columns:32px 1fr auto;align-items:flex-start;gap:12px;
  padding:12px 14px;border:0.5px solid var(--color-border);border-radius:8px;
  transition:background 0.15s ease;
}
.osp-change:hover{background:var(--color-background-secondary);}
.osp-change-icon{
  display:flex;align-items:center;justify-content:center;
  width:32px;height:32px;border-radius:8px;
  background:var(--color-background-secondary);
  color:var(--color-text-secondary);font-size:18px;
}
.osp-change-body{min-width:0;}
.osp-change-title{
  font-size:var(--osp-fs-md);font-weight:600;color:var(--color-text-primary);
  margin:0 0 2px;
}
.osp-change-detail{
  font-size:var(--osp-fs-sm);color:var(--color-text-secondary);
  margin:0;line-height:1.5;
}
.osp-change-meta{
  display:flex;flex-direction:column;align-items:flex-end;gap:6px;white-space:nowrap;
}
.osp-badge{
  display:inline-flex;align-items:center;font-size:11px;font-weight:600;
  padding:3px 8px;border-radius:6px;letter-spacing:0.02em;
}
.osp-badge-action_needed{background:var(--color-background-danger);color:var(--color-text-danger);}
.osp-badge-monitor{background:var(--color-background-warning);color:var(--color-text-warning);}
.osp-badge-positive{background:var(--color-background-success);color:var(--color-text-success);}
.osp-badge-informational{background:var(--color-background-secondary);color:var(--color-text-secondary);}
.osp-change-time{font-size:11px;color:var(--color-text-tertiary);}

.osp-view-all{
  margin-top:14px;width:100%;
  padding:11px 14px;font-family:inherit;font-size:var(--osp-fs-sm);font-weight:600;
  background:transparent;color:var(--color-text-primary);
  border:0.5px solid var(--color-border);border-radius:8px;cursor:pointer;
  transition:background 0.15s ease;
}
.osp-view-all:hover{background:var(--color-background-secondary);}

.osp-scan-group{margin-top:14px;}
.osp-scan-group-label{
  font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.07em;
  color:var(--color-text-tertiary);padding:6px 4px;
}

.osp-protected{
  display:grid;grid-template-columns:1fr 1fr;gap:8px 16px;margin-top:8px;
}
.osp-protected-item{
  display:flex;align-items:center;gap:8px;
  font-size:var(--osp-fs-sm);color:var(--color-text-secondary);
}
.osp-protected-dot{
  width:6px;height:6px;border-radius:50%;background:var(--color-success-dot);flex-shrink:0;
}
@media (max-width:640px){
  .osp-protected{grid-template-columns:1fr;}
}

.osp-loading,.osp-empty-card{
  padding:20px;text-align:center;color:var(--color-text-secondary);
  font-size:var(--osp-fs-sm);
}
`;
  document.head.appendChild(style);
}

const SEVERITY_LABEL = {
  action_needed: 'Action needed',
  monitor:       'Monitor',
  positive:      'No action',
  informational: 'Informational',
};

// change_type → Tabler icon name. Specific glyphs per the brief; severity
// fallbacks for change_types the brief doesn't enumerate.
function iconForAlert(alert) {
  switch (alert.change_type) {
    case 'territory_loss':       return 'ti-map-pin-off';
    case 'territory_gain':       return 'ti-circle-check';
    case 'isrc_dropped':         return 'ti-fingerprint-off';
    case 'isrc_added':           return 'ti-circle-check';
    case 'isrc_mismatch':        return 'ti-fingerprint-off';
    case 'video_removed':        return 'ti-video-off';
    case 'video_added':          return 'ti-video';
    case 'release_removed':      return 'ti-package';
    case 'release_added':        return 'ti-package';
    case 'baseline_established': return 'ti-database';
    case 'profile_missing':      return 'ti-user-off';
    case 'metadata_changed':     return 'ti-edit';
    default:
      if (alert.severity === 'monitor')  return 'ti-alert-triangle';
      if (alert.severity === 'positive') return 'ti-circle-check';
      return 'ti-info-circle';
  }
}

function escapeHtml(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function relativeTime(input) {
  if (!input) return '';
  const t = (input instanceof Date) ? input : new Date(input);
  if (Number.isNaN(t.getTime())) return '';
  const diffMs = Date.now() - t.getTime();
  if (diffMs < 0) return 'just now';
  const sec = Math.floor(diffMs / 1000);
  if (sec < 45)      return 'just now';
  const min = Math.floor(sec / 60);
  if (min < 60)      return min === 1 ? '1 minute ago' : `${min} minutes ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24)       return hr === 1 ? '1 hour ago'    : `${hr} hours ago`;
  const day = Math.floor(hr / 24);
  if (day < 14)      return day === 1 ? '1 day ago'    : `${day} days ago`;
  const wk = Math.floor(day / 7);
  if (wk < 8)        return wk === 1 ? '1 week ago'    : `${wk} weeks ago`;
  return t.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatDateLong(input) {
  if (!input) return '';
  const t = (input instanceof Date) ? input : new Date(input);
  if (Number.isNaN(t.getTime())) return '';
  return t.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function daysBetween(later, earlier) {
  const a = new Date(later).getTime();
  const b = new Date(earlier).getTime();
  if (!Number.isFinite(a) || !Number.isFinite(b) || a < b) return 0;
  return Math.floor((a - b) / (1000 * 60 * 60 * 24));
}

export class BackendProtectionPanel {
  constructor({ supabase, artistId, artistName, containerId }) {
    this.supabase    = supabase;
    this.artistId    = artistId   || null;
    this.artistName  = artistName || '';
    this.containerId = containerId;
    this.expanded    = false;
    this.data        = null;
  }

  _container() {
    return document.getElementById(this.containerId);
  }

  async render() {
    ensureStylesInjected();
    const root = this._container();
    if (!root) {
      console.warn(`[backend-protection] container #${this.containerId} not found`);
      return;
    }
    if (!this.artistId) {
      root.innerHTML = '';
      return;
    }
    this._renderLoading();
    try {
      await this._load();
    } catch (e) {
      console.error('[backend-protection] load failed:', e);
      this._renderEmptyCard('Could not load monitoring data. Please refresh.');
      return;
    }
    this._renderPanel();
  }

  async _load() {
    const [alertsRes, subRes] = await Promise.all([
      this.supabase
        .from('monitoring_alerts')
        .select('*')
        .eq('artist_id', this.artistId)
        .order('detected_at', { ascending: false })
        .limit(50),
      this.supabase
        .from('monitoring_subscriptions')
        .select('*')
        .eq('artist_id', this.artistId)
        .limit(1)
        .maybeSingle(),
    ]);

    if (alertsRes.error) throw alertsRes.error;
    if (subRes.error && subRes.error.code !== 'PGRST116') throw subRes.error;

    const alerts = alertsRes.data || [];
    const subscription = subRes.data || null;

    // Pull scan metadata (scan_number + scanned_at) for any scan referenced
    // by the alerts. Used to group + label the View-All expansion.
    const scanIds = Array.from(new Set(alerts.map((a) => a.scan_id).filter(Boolean)));
    let scanMap = {};
    if (scanIds.length > 0) {
      const { data: scanRows, error: scanErr } = await this.supabase
        .from('scan_snapshots')
        .select('id, scan_number, scanned_at')
        .in('id', scanIds);
      if (scanErr) {
        // Non-fatal — scan_number labels degrade to date-only.
        console.warn('[backend-protection] scan_snapshots lookup failed:', scanErr.message);
      } else {
        for (const s of (scanRows || [])) scanMap[s.id] = s;
      }
    }

    this.data = { alerts, subscription, scanMap };
  }

  _renderLoading() {
    const root = this._container();
    if (!root) return;
    root.innerHTML = `
      <div class="os-protection-panel">
        <div class="osp-loading">Loading protection status...</div>
      </div>`;
  }

  _renderEmptyCard(message) {
    const root = this._container();
    if (!root) return;
    root.innerHTML = `
      <div class="os-protection-panel">
        <div class="osp-empty-card">${escapeHtml(message)}</div>
      </div>`;
  }

  _renderPanel() {
    const root = this._container();
    if (!root) return;

    const { alerts, subscription } = this.data;

    // No subscription found — show the "run a scan to activate" message.
    if (!subscription) {
      this._renderEmptyCard(
        'No monitoring subscription found for this artist. Run a scan to activate monitoring.',
      );
      return;
    }

    const html = `
      <div class="os-protection-panel">
        ${this._renderHeader(subscription)}
        ${this._renderStats(alerts)}
        ${this._renderChangesSection(alerts)}
        ${this._renderProtectedAreas()}
      </div>`;
    root.innerHTML = html;

    this._wireInteractions();
  }

  _renderHeader(subscription) {
    const active = !!(subscription && subscription.active);
    const lastScannedAt = subscription && subscription.last_scanned_at;
    const lastScanLabel = lastScannedAt ? relativeTime(lastScannedAt) : 'never';
    const pillClass = active ? 'osp-pill-active' : '';
    const pillText  = active ? 'Monitoring active' : 'Monitoring inactive';

    return `
      <div class="osp-header">
        <div class="osp-header-left">
          <h2>Backend protection</h2>
          <div class="osp-header-sub">
            ${escapeHtml(this.artistName)} · Last scan: ${escapeHtml(lastScanLabel)}
          </div>
        </div>
        <div class="osp-header-right">
          <span class="osp-pill ${pillClass}">
            <span class="osp-pill-dot"></span>${pillText}
          </span>
        </div>
      </div>`;
  }

  _renderStats(alerts) {
    const unresolved   = alerts.filter((a) => !a.resolved);
    const changesCount = unresolved.length;
    const actionCount  = unresolved.filter((a) => a.severity === 'action_needed').length;

    // Days monitored — earliest detected_at to now.
    let daysMonitored = 0;
    if (alerts.length > 0) {
      const earliest = alerts.reduce((acc, a) => {
        const t = new Date(a.detected_at).getTime();
        return Number.isFinite(t) && (acc == null || t < acc) ? t : acc;
      }, null);
      if (earliest != null) {
        daysMonitored = daysBetween(Date.now(), earliest);
      }
    }

    return `
      <div class="osp-stats">
        <div class="osp-stat">
          <div class="osp-stat-label">Changes detected</div>
          <div class="osp-stat-value">${changesCount}</div>
        </div>
        <div class="osp-stat">
          <div class="osp-stat-label">Require action</div>
          <div class="osp-stat-value">${actionCount}</div>
        </div>
        <div class="osp-stat">
          <div class="osp-stat-label">Days monitored</div>
          <div class="osp-stat-value">${daysMonitored}</div>
        </div>
      </div>`;
  }

  _renderChangesSection(alerts) {
    if (!alerts || alerts.length === 0) {
      return `
        <div class="osp-section">
          <div class="osp-section-label">Changes since last scan</div>
          <div class="osp-empty-feed">
            No changes detected yet. Monitoring is active — you will be alerted when something changes.
          </div>
        </div>`;
    }

    if (this.expanded) {
      return this._renderAllScans(alerts);
    }

    const latestScanId = alerts[0].scan_id;
    const latestScanAlerts = alerts.filter((a) => a.scan_id === latestScanId);

    return `
      <div class="osp-section">
        <div class="osp-section-label">Changes since last scan</div>
        <div class="osp-changes">
          ${latestScanAlerts.map((a) => this._renderChangeItem(a)).join('')}
        </div>
        <button class="osp-view-all" data-osp-toggle type="button">
          View all scan history (${alerts.length} change${alerts.length === 1 ? '' : 's'})
        </button>
      </div>`;
  }

  _renderAllScans(alerts) {
    // Group by scan_id, ordered by scan_number DESC (fallback scanned_at).
    const groupsByScanId = new Map();
    for (const a of alerts) {
      if (!groupsByScanId.has(a.scan_id)) groupsByScanId.set(a.scan_id, []);
      groupsByScanId.get(a.scan_id).push(a);
    }
    const groups = Array.from(groupsByScanId.entries()).map(([scanId, items]) => {
      const meta = this.data.scanMap[scanId] || {};
      return {
        scanId,
        scanNumber: meta.scan_number,
        scannedAt: meta.scanned_at || items[0].detected_at,
        items,
      };
    });
    groups.sort((a, b) => {
      if (a.scanNumber != null && b.scanNumber != null) return b.scanNumber - a.scanNumber;
      return new Date(b.scannedAt).getTime() - new Date(a.scannedAt).getTime();
    });

    const groupsHtml = groups.map((g) => {
      const label = g.scanNumber != null
        ? `Scan ${g.scanNumber} · ${formatDateLong(g.scannedAt)}`
        : formatDateLong(g.scannedAt);
      return `
        <div class="osp-scan-group">
          <div class="osp-scan-group-label">${escapeHtml(label)}</div>
          <div class="osp-changes">
            ${g.items.map((a) => this._renderChangeItem(a)).join('')}
          </div>
        </div>`;
    }).join('');

    return `
      <div class="osp-section">
        <div class="osp-section-label">All scan history</div>
        ${groupsHtml}
        <button class="osp-view-all" data-osp-toggle type="button">
          Show latest scan only
        </button>
      </div>`;
  }

  _renderChangeItem(a) {
    const icon = iconForAlert(a);
    const sev  = a.severity || 'informational';
    const label = SEVERITY_LABEL[sev] || 'Informational';
    return `
      <div class="osp-change">
        <div class="osp-change-icon"><i class="ti ${icon}" aria-hidden="true"></i></div>
        <div class="osp-change-body">
          <p class="osp-change-title">${escapeHtml(a.title || '')}</p>
          <p class="osp-change-detail">${escapeHtml(a.detail || '')}</p>
        </div>
        <div class="osp-change-meta">
          <span class="osp-badge osp-badge-${sev}">${escapeHtml(label)}</span>
          <span class="osp-change-time">${escapeHtml(relativeTime(a.detected_at))}</span>
        </div>
      </div>`;
  }

  _renderProtectedAreas() {
    const areas = [
      'Territory availability',
      'ISRC coverage',
      'Catalog presence',
      'YouTube matches',
      'Artist profiles',
      'Metadata completeness',
    ];
    return `
      <div class="osp-section">
        <div class="osp-section-label">Protected areas</div>
        <div class="osp-protected">
          ${areas.map((a) => `
            <div class="osp-protected-item">
              <span class="osp-protected-dot"></span>${escapeHtml(a)}
            </div>`).join('')}
        </div>
      </div>`;
  }

  _wireInteractions() {
    const root = this._container();
    if (!root) return;
    const toggleBtn = root.querySelector('[data-osp-toggle]');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => {
        this.expanded = !this.expanded;
        this._renderPanel();
      });
    }
  }
}
