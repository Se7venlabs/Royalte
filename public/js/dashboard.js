/* ═══════════════════════════════════════════════════════════════════
   ROYALTĒ DASHBOARD V1
   Render layer — populates dashboard.html from a single data object.

   V1 SCOPE:
     - Hardcoded mock data (one artist, one scan, fixed values)
     - No auth, no Stripe, no real backend
     - Money values shown as RANGES not specific dollars (Path B)
     - "Verified Data Only" tone preserved throughout

   V2 (LATER):
     - Replace mockData() with await fetch('/api/dashboard')
     - Add Supabase auth gate before render
     - Wire alerts, statement uploads, real scan history
     - One-line swap: see TODO comment in init()
   ═══════════════════════════════════════════════════════════════════ */


/* ─────────────────────────────────────────────
   DATA CONTRACT
   This is the JSON shape /api/dashboard must
   eventually return. Kept here as the single
   source of truth for backend + frontend.
   ───────────────────────────────────────────── */

/**
 * @typedef {Object} DashboardData
 * @property {Object} user
 * @property {string} user.firstName       - "Jordan"
 * @property {string} user.fullName        - "Jordan Kai"
 * @property {string} user.plan            - "Artist Plan" | "Pro" | "Free"
 * @property {boolean} user.verified
 * @property {number} user.notifications
 *
 * @property {Object} score
 * @property {number} score.value          - 0–100
 * @property {string} score.headline       - "Your setup needs improvement"
 *
 * @property {Object} revenueRisk          - Path B: ranges, not exact dollars
 * @property {string} revenueRisk.range    - "$1K–$10K+"
 * @property {string} revenueRisk.tier     - "high" | "medium" | "low"
 * @property {string} revenueRisk.tierLabel- "High"
 * @property {string} revenueRisk.note     - "Exact recovery requires full audit"
 *
 * @property {Object} stats
 * @property {number} stats.issuesFound
 * @property {number} stats.thingsWorking
 *
 * @property {Object} recentScan
 * @property {string} recentScan.dateLabel   - "Apr 24, 2026 · 10:32 AM"
 * @property {string} recentScan.nextDateLabel - "May 24, 2026"
 * @property {number} recentScan.sourcesCount  - 10+
 *
 * @property {Object} identity
 * @property {?string} identity.artistName   - "Gentlemen X" or null
 * @property {string} identity.sourcePlatform - "spotify" | "apple_music"
 * @property {string} identity.resolvedFrom  - "spotify" | "apple_music" | "spotify_from_apple" | "spotify_and_apple"
 * @property {{spotify:boolean, appleMusic:boolean}} identity.platforms
 * @property {string} identity.scanStatus    - "verified" | "limited" | "pending"
 *
 * @property {Array<{date:string, tier:'low'|'med'|'high'}>} trend
 *   - 6 months of severity tier history (Path B: tier-based, not $)
 *
 * @property {Array<Issue>} issues
 * @property {Array<Action>} actionPlan
 *
 * @property {Array<Platform>} platforms
 * @property {number} platformsConnected
 * @property {number} platformsTotal
 */

/**
 * @typedef {Object} Issue
 * @property {string} id
 * @property {string} title           - "Missing ISRC for 3 tracks"
 * @property {string} desc            - "Tracks may not be properly tracked"
 * @property {string} severity        - "high" | "medium" | "low"
 * @property {string} impactLabel     - "Thousands at risk" | "$1K–$5K+" | "—"
 * @property {string} icon            - emoji or key
 */

/**
 * @typedef {Object} Action
 * @property {number} step
 * @property {string} title           - "Fix missing ISRCs (recover revenue)"
 * @property {string} meta            - "3 tracks"
 * @property {string} severity        - "high" | "medium" | "low"
 */

/**
 * @typedef {Object} Platform
 * @property {string} key             - "spotify" | "apple" | "youtube" | etc.
 * @property {string} name            - "Spotify"
 * @property {string} status          - "connected" | "available"
 */


/* ─────────────────────────────────────────────
   MOCK DATA (V1)
   Replace this function in V2 with a real fetch.
   ───────────────────────────────────────────── */

function mockData() {
  return {
    user: {
      firstName: "Jordan",
      fullName: "Jordan Kai",
      plan: "Artist Plan",
      verified: true,
      notifications: 3
    },
    score: {
      value: 72,
      headline: "Your setup needs improvement"
    },
    revenueRisk: {
      range: "$1K–$10K+",
      tier: "high",
      tierLabel: "High",
      note: "Exact recovery amount requires full audit review"
    },
    stats: {
      issuesFound: 8,
      thingsWorking: 12
    },
    recentScan: {
      dateLabel: "Apr 24, 2026 · 10:32 AM",
      nextDateLabel: "May 24, 2026",
      sourcesCount: 10
    },
    // Artist identity from the most recent scan.
    // resolvedFrom values:
    //   "spotify"             — found via Spotify only
    //   "apple_music"         — found via Apple Music only (limited data)
    //   "spotify_from_apple"  — Apple URL → resolved to Spotify match
    //   "spotify_and_apple"   — confirmed on both (best case)
    identity: {
      artistName: "Gentlemen X",
      sourcePlatform: "spotify",
      resolvedFrom: "spotify_and_apple",
      platforms: {
        spotify: true,
        appleMusic: true
      },
      scanStatus: "verified" // "verified" | "limited" | "pending"
    },
    // Path B: tier-based trend, not fake dollars.
    // Each point is a severity level; chart paints the silhouette.
    trend: [
      { date: "Feb", tier: "low"  },
      { date: "Mar", tier: "med"  },
      { date: "Apr", tier: "med"  },
      { date: "May", tier: "med"  },
      { date: "Jun", tier: "high" },
      { date: "Jul", tier: "high" }
    ],
    issues: [
      { id: "i1", title: "Missing ISRC for 3 tracks",          desc: "Tracks may not be properly tracked",           severity: "high", impactLabel: "Thousands at risk", icon: "isrc" },
      { id: "i2", title: "YouTube Content ID not claimed",     desc: "You're missing out on Content ID revenue",     severity: "high", impactLabel: "Thousands at risk", icon: "yt" },
      { id: "i3", title: "Publishing not linked to recordings",desc: "Publishing and master not connected",          severity: "medium", impactLabel: "Hundreds at risk", icon: "pub" },
      { id: "i4", title: "Missing writer splits on 2 tracks",  desc: "Incomplete splits can cause payment issues",   severity: "medium", impactLabel: "Hundreds at risk", icon: "splits" },
      { id: "i5", title: "Apple Music missing editorial tags", desc: "Improper tagging reduces discoverability",     severity: "low",    impactLabel: "Minor",            icon: "tags" }
    ],
    actionPlan: [
      { step: 1, title: "Fix missing ISRCs (recover revenue)",        meta: "3 tracks",  severity: "high"   },
      { step: 2, title: "Claim YouTube Content ID (recover revenue)", meta: "2 channels",severity: "high"   },
      { step: 3, title: "Link publishing to recordings",              meta: "4 releases",severity: "medium" },
      { step: 4, title: "Review & update splits",                     meta: "2 tracks",  severity: "medium" },
      { step: 5, title: "Add editorial tags",                         meta: "7 tracks",  severity: "low"    }
    ],
    platforms: [
      { key: "spotify",    name: "Spotify",     status: "connected" },
      { key: "apple",      name: "Apple Music", status: "connected" },
      { key: "youtube",    name: "YouTube",     status: "connected" },
      { key: "soundcloud", name: "SoundCloud",  status: "connected" },
      { key: "tiktok",     name: "TikTok",      status: "connected" }
    ],
    platformsConnected: 9,
    platformsTotal: 15
  };
}


/* ─────────────────────────────────────────────
   ICONS — inline SVG, kept in JS so HTML stays clean
   ───────────────────────────────────────────── */

const ICONS = {
  // sidebar nav
  dashboard:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>',
  setup:      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>',
  issues:     '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
  action:     '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>',
  catalog:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>',
  monitoring: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>',
  reports:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>',
  settings:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
  upgrade:    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>',
  // issue category icons
  isrc:       '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/></svg>',
  yt:         '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.25 29 29 0 0 0-.46-5.33z"/><polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02"/></svg>',
  pub:        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>',
  splits:     '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="7" r="4"/><path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/><path d="M21 21v-2a4 4 0 0 0-3-3.85"/></svg>',
  tags:       '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>',
  // misc
  arrow:      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>'
};


/* ─────────────────────────────────────────────
   SIDEBAR
   ───────────────────────────────────────────── */

function renderSidebar(data) {
  const navItems = [
    { id: "dashboard",  label: "Dashboard",  icon: "dashboard",  active: true  },
    { id: "setup",      label: "My Setup",   icon: "setup"   },
    { id: "issues",     label: "Issues Found", icon: "issues", badge: data.stats.issuesFound + "" },
    { id: "action",     label: "Action Plan",  icon: "action"  },
    { id: "catalog",    label: "Catalog",      icon: "catalog",    soonLabel: "Soon" },
    { id: "monitoring", label: "Monitoring",   icon: "monitoring", soonLabel: "Soon" },
    { id: "reports",    label: "Reports",      icon: "reports" },
    { id: "settings",   label: "Settings",     icon: "settings" }
  ];

  const navHTML = navItems.map(item => {
    const badge = item.badge
      ? `<span class="sb-badge">${item.badge}</span>`
      : item.soonLabel
        ? `<span class="sb-badge soon">${item.soonLabel}</span>`
        : "";
    return `
      <a class="sb-link ${item.active ? 'active' : ''}" data-nav="${item.id}" href="#${item.id}">
        ${ICONS[item.icon]}
        <span class="sb-link-name">${item.label}</span>
        ${badge}
      </a>
    `;
  }).join("");

  document.getElementById("sb-nav").innerHTML = navHTML;

  // upgrade card
  document.getElementById("sb-upgrade").innerHTML = `
    <div class="sb-upgrade-ico">${ICONS.upgrade}</div>
    <div class="sb-upgrade-t">Unlock Full Audit</div>
    <div class="sb-upgrade-d">See <strong>every issue</strong>, the <strong>full action plan</strong>, and your complete recovery roadmap.</div>
    <button class="sb-upgrade-btn" data-action="upgrade">Unlock Full Audit →</button>
  `;

  // user pill
  const initials = (data.user.fullName || "")
    .split(/\s+/).map(s => s[0]).filter(Boolean).slice(0, 2).join("").toUpperCase() || "U";

  document.getElementById("sb-user").innerHTML = `
    <div class="sb-user-avatar">${initials}</div>
    <div class="sb-user-info">
      <div class="sb-user-name">
        ${escapeHtml(data.user.fullName)}
        ${data.user.verified ? '<svg class="sb-user-verified" width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" stroke="currentColor" stroke-width="2" fill="none"/></svg>' : ''}
      </div>
      <div class="sb-user-plan">${escapeHtml(data.user.plan)}</div>
    </div>
  `;
}


/* ─────────────────────────────────────────────
   PAGE HEADER
   ───────────────────────────────────────────── */

function renderHeader(data) {
  document.getElementById("artist-name").textContent = data.user.firstName;
  document.getElementById("welcome-sub").textContent = "Here's what we found in your royalty setup.";

  const bell = document.getElementById("bell-count");
  if (data.user.notifications > 0) {
    bell.textContent = data.user.notifications;
    bell.style.display = "flex";
  } else {
    bell.style.display = "none";
  }
}


/* ─────────────────────────────────────────────
   HERO BANNER (score ring + 3 stats)
   ───────────────────────────────────────────── */

function renderHeroBanner(data) {
  const score = clamp(data.score.value, 0, 100);

  // animate the score ring
  const arc = document.getElementById("score-arc");
  const circumference = 2 * Math.PI * 38; // r=38 → ~238.76
  const offset = circumference - (circumference * score / 100);
  // delay so the entrance fade plays first
  setTimeout(() => {
    arc.style.transition = "stroke-dashoffset 1.1s cubic-bezier(0.22,0.61,0.36,1)";
    arc.style.strokeDashoffset = offset;
  }, 250);

  document.getElementById("score-val").textContent = score + "%";
  document.getElementById("score-headline").textContent = data.score.headline;

  // revenue at risk (Path B: range string, not number)
  document.getElementById("stat-revenue").textContent = data.revenueRisk.range;
  const tierEl = document.getElementById("stat-revenue-tier");
  tierEl.textContent = data.revenueRisk.tierLabel;
  tierEl.className = "hero-stat-sub " + tierClass(data.revenueRisk.tier);

  document.getElementById("stat-issues").textContent  = data.stats.issuesFound;
  document.getElementById("stat-working").textContent = data.stats.thingsWorking;
}


/* ─────────────────────────────────────────────
   ARTIST IDENTITY CARD (inside hero banner)
   Renders artist name, resolved-from line, status,
   and platform pills based on scan data.
   ───────────────────────────────────────────── */

function renderHeroIdentity(data) {
  const id = data.identity || {};
  const platforms = id.platforms || {};
  const host = document.getElementById("hero-identity");
  if (!host) return;

  // Rule 6.1: artist name fallback
  const displayName = (id.artistName && id.artistName.trim())
    ? id.artistName
    : "Artist detected.";

  // resolved-from copy (Rule 6.5/6.6)
  let resolvedFromText = "";
  switch (id.resolvedFrom) {
    case "spotify":            resolvedFromText = "Spotify"; break;
    case "apple_music":        resolvedFromText = "Apple Music"; break;
    case "spotify_from_apple": resolvedFromText = "Matched from Apple → Spotify"; break;
    case "spotify_and_apple":  resolvedFromText = "Spotify + Apple Music"; break;
    default:                   resolvedFromText = "—";
  }

  // status row (verified/limited/pending)
  const isLimited = id.scanStatus === "limited" || id.resolvedFrom === "apple_music";
  const statusText = id.scanStatus === "pending"
    ? "Scan in progress"
    : isLimited
      ? "Limited scan complete"
      : "Verified scan complete";
  const statusIcon = id.scanStatus === "pending"
    ? `<span class="pulse-dot"></span>`
    : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>`;

  // platform pills (Rule 6.3 / 6.4)
  const pills = [];
  if (platforms.spotify) {
    pills.push(`<span class="hi-pill verified">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
      Spotify
    </span>`);
  }
  if (platforms.appleMusic) {
    pills.push(`<span class="hi-pill verified">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
      Apple Music
    </span>`);
  }

  // amber fallback tag for Apple-only result (Rule 6.5)
  const fallbackTag = id.resolvedFrom === "apple_music"
    ? `<div class="hi-fallback">
         <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
         Limited Apple result
       </div>`
    : "";

  // tiny avatar — image if provided, initials fallback otherwise
  const initials = (id.artistName || "")
    .split(/\s+/).map(s => s[0]).filter(Boolean).slice(0, 2).join("").toUpperCase() || "?";
  const avatarInner = id.artistImage
    ? `<img src="${escapeHtml(id.artistImage)}" alt="" onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'hi-avatar-initials',textContent:'${escapeHtml(initials)}'}))">`
    : `<span class="hi-avatar-initials">${escapeHtml(initials)}</span>`;

  // stale data banner (only when localStorage scan is older than 24h)
  const staleBanner = id._staleHours
    ? `<div class="hi-stale">
         <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
         Showing scan from ${escapeHtml(id._staleHours)} ago
       </div>`
    : "";

  host.innerHTML = `
    <div class="hi-name-row">
      <div class="hi-avatar">${avatarInner}</div>
      <div class="hi-name-stack">
        <span class="hi-label">Artist</span>
        <span class="hi-name" title="${escapeHtml(displayName)}">${escapeHtml(displayName)}</span>
      </div>
    </div>
    <div class="hi-row">
      <span class="hi-label">Resolved from</span>
      <span class="hi-resolved">${escapeHtml(resolvedFromText)}</span>
    </div>
    <div class="hi-status ${isLimited ? 'limited' : ''}">
      ${statusIcon}
      ${escapeHtml(statusText)}
    </div>
    ${pills.length ? `<div class="hi-pills">${pills.join("")}</div>` : ""}
    ${fallbackTag}
    ${staleBanner}
  `;
}


/* ─────────────────────────────────────────────
   REVENUE-AT-RISK CARD (chart + headline)
   Path B: chart paints severity tiers over time,
   not fake dollar amounts.
   ───────────────────────────────────────────── */

function renderRevenueCard(data) {
  document.getElementById("rev-amount").textContent = data.revenueRisk.range;

  const pill = document.getElementById("rev-tier-pill");
  pill.textContent = data.revenueRisk.tierLabel;
  pill.className = "rev-tier-pill " + tierClass(data.revenueRisk.tier);

  document.getElementById("rev-sub").textContent = data.revenueRisk.note;

  // build the chart silhouette from tier history
  const trend = data.trend || [];
  if (!trend.length) return;

  const W = 600, H = 180;
  const padL = 36, padR = 16, padT = 10, padB = 28;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;

  const tierY = { low: padT + innerH * 0.85, med: padT + innerH * 0.5, high: padT + innerH * 0.15 };

  const stepX = innerW / Math.max(trend.length - 1, 1);
  const points = trend.map((p, i) => ({ x: padL + i * stepX, y: tierY[p.tier] || tierY.med, label: p.date }));

  // smooth path using simple cubic interpolation
  const linePath = smoothPath(points);
  const areaPath = `${linePath} L ${points[points.length - 1].x.toFixed(1)} ${(H - padB).toFixed(1)} L ${points[0].x.toFixed(1)} ${(H - padB).toFixed(1)} Z`;

  document.getElementById("rev-line-path").setAttribute("d", linePath);
  document.getElementById("rev-area-path").setAttribute("d", areaPath);

  // x-axis labels
  const labelsHTML = points.map(p =>
    `<text x="${p.x.toFixed(1)}" y="${(H - 8).toFixed(0)}" font-family="Space Mono" font-size="10" fill="#8480a8" text-anchor="middle" letter-spacing="0.06em">${escapeHtml(p.label)}</text>`
  ).join("");
  document.getElementById("rev-x-labels").innerHTML = labelsHTML;
}


/* ─────────────────────────────────────────────
   RECENT SCAN CARD
   ───────────────────────────────────────────── */

function renderRecentScan(data) {
  document.getElementById("recent-scan-meta").textContent = data.recentScan.dateLabel;
  document.getElementById("next-scan-date").textContent  = data.recentScan.nextDateLabel;
}


/* ─────────────────────────────────────────────
   ISSUES LIST
   ───────────────────────────────────────────── */

function renderIssues(data) {
  const issues = data.issues || [];
  const VISIBLE = 3; // V1 lock: only show top 3
  const preview = issues.slice(0, VISIBLE);

  // total count from stats (may be larger than issues.length if backend caps the array)
  const total = Math.max(data.stats.issuesFound || 0, issues.length);
  const visibleShown = Math.min(preview.length, VISIBLE);
  const hiddenCount = Math.max(0, total - visibleShown);

  // pill format: "3 of 15"
  const pill = document.getElementById("issues-count");
  if (pill) {
    pill.textContent = total > 0 ? `${visibleShown} of ${total}` : "0";
  }

  const html = preview.map(issue => `
    <div class="issue-row" data-issue="${issue.id}">
      <div class="issue-ico ${tierClass(issue.severity)}">
        ${ICONS[issue.icon] || ICONS.issues}
      </div>
      <div class="issue-body">
        <div class="issue-title">${escapeHtml(issue.title)}</div>
        <div class="issue-desc">${escapeHtml(issue.desc)}</div>
      </div>
      <div class="issue-sev ${tierClass(issue.severity)}">${escapeHtml(severityLabel(issue.severity))}</div>
      <div class="issue-impact">${escapeHtml(issue.impactLabel)}</div>
    </div>
  `).join("");

  document.getElementById("issues-list").innerHTML = html;

  // locked overflow row (replaces old "+ N more issues" footer)
  const overflow = document.getElementById("issues-locked-overflow");
  const overflowH = document.getElementById("issues-locked-h");
  if (overflow && overflowH) {
    if (hiddenCount > 0) {
      overflowH.innerHTML = `🔒 ${hiddenCount} more issue${hiddenCount === 1 ? "" : "s"} hidden`;
      overflow.style.display = "flex";
    } else {
      overflow.style.display = "none";
    }
  }
}


/* ─────────────────────────────────────────────
   ACTION PLAN LIST
   ───────────────────────────────────────────── */

function renderActionPlan(data) {
  const actions = data.actionPlan || [];

  // V1 lock: action plan is always rendered as a blurred preview, with
  // .action-locked-overlay sitting on top. We still render the rows so
  // the blur looks like real content rather than empty space.
  const html = actions.map(a => `
    <div class="action-row" data-step="${a.step}">
      <div class="action-num">${a.step}</div>
      <div class="action-body">
        <div class="action-title">${escapeHtml(a.title)}</div>
        <div class="action-meta">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/></svg>
          ${escapeHtml(a.meta)}
        </div>
      </div>
      <div class="action-pill ${tierClass(a.severity)}">${escapeHtml(severityLabel(a.severity))}</div>
      <div class="action-arrow"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg></div>
    </div>
  `).join("");

  document.getElementById("action-list").innerHTML = html;

  // dynamic locked copy (shown by .action-locked-overlay)
  const lockedD = document.getElementById("action-locked-d");
  if (lockedD) {
    const stepCount = actions.length || data.stats.issuesFound || 0;
    lockedD.textContent = stepCount > 0
      ? `${stepCount} step${stepCount === 1 ? "" : "s"} to recover unclaimed royalties — included in your Full Audit.`
      : `Your full step-by-step plan to recover unclaimed royalties is in the Full Audit.`;
  }
}


/* ─────────────────────────────────────────────
   LOCK STRIP (between revenue row and issues row)
   Surfaces dynamic counts of what's hidden + CTA.
   ───────────────────────────────────────────── */

function renderLockStrip(data) {
  const strip = document.getElementById("lock-strip");
  const desc  = document.getElementById("lock-strip-d");
  if (!strip || !desc) return;

  const totalIssues = Math.max(data.stats.issuesFound || 0, (data.issues || []).length);
  const hiddenIssues = Math.max(0, totalIssues - 3);
  const stepCount = (data.actionPlan || []).length;

  const parts = [];
  if (hiddenIssues > 0) parts.push(`<strong>${hiddenIssues} more issue${hiddenIssues === 1 ? "" : "s"}</strong>`);
  if (stepCount > 0)    parts.push(`<strong>your ${stepCount}-step action plan</strong>`);
  parts.push(`<strong>territory + sync detail</strong>`);

  // graceful joiner: "A, B + C"
  let body;
  if (parts.length === 1) body = `Unlock ${parts[0]} with the Full Audit.`;
  else if (parts.length === 2) body = `Unlock ${parts[0]} and ${parts[1]} with the Full Audit.`;
  else body = `Unlock ${parts[0]}, ${parts[1]} and ${parts[parts.length - 1]} with the Full Audit.`;

  desc.innerHTML = body;
  strip.style.display = "flex";
}


/* ─────────────────────────────────────────────
   PLATFORMS GRID
   ───────────────────────────────────────────── */

function renderPlatforms(data) {
  document.getElementById("platforms-meta").textContent =
    `Connected: ${data.platformsConnected} of ${data.platformsTotal}`;

  // logo content lookup (first letter / brand mark)
  const LOGO_CHAR = {
    spotify: "♪", apple: "", youtube: "▶",
    soundcloud: "☁", tiktok: "♫"
  };

  const tiles = (data.platforms || []).map(p => `
    <div class="platform-tile" data-platform="${p.key}">
      <div class="platform-logo ${p.key}">${LOGO_CHAR[p.key] || (p.name[0] || "?")}</div>
      <div class="platform-name">${escapeHtml(p.name)}</div>
      <div class="platform-status ${p.status}">${p.status === 'connected' ? 'Connected' : 'Available'}</div>
    </div>
  `).join("");

  // "+N More Platforms" tile
  const remaining = Math.max(0, data.platformsTotal - data.platforms.length);
  const moreTile = remaining > 0 ? `
    <div class="platform-tile more">
      <div class="platform-logo more">+${remaining}</div>
      <div class="platform-name">More Platforms</div>
      <div class="platform-status available">Available</div>
    </div>
  ` : "";

  document.getElementById("platforms-grid").innerHTML = tiles + moreTile;
}


/* ─────────────────────────────────────────────
   INTERACTIONS
   Wire up buttons — V1 uses console.log + alerts
   as placeholders. V2 will wire to real routes.
   ───────────────────────────────────────────── */

function wireInteractions() {
  // sidebar nav (V1: visual only — no routing)
  document.getElementById("sb-nav").addEventListener("click", (e) => {
    const link = e.target.closest("[data-nav]");
    if (!link) return;
    e.preventDefault();
    document.querySelectorAll(".sb-link").forEach(el => el.classList.remove("active"));
    link.classList.add("active");
    // V2: route to /dashboard/{id}
    console.log("[v1] nav →", link.dataset.nav);
  });

  // upgrade button (sidebar)
  document.querySelector("[data-action='upgrade']")?.addEventListener("click", () => {
    // V1: route to homepage Full Audit form. Same destination as all unlock CTAs.
    window.location.href = "/#request";
  });

  // unlock CTAs — log which surface fired, then let the <a href="/#request"> navigate naturally
  document.querySelectorAll("[data-unlock]").forEach(el => {
    el.addEventListener("click", () => {
      console.log("[v1] unlock CTA →", el.getAttribute("data-unlock"));
    });
  });

  // issue / action / platform tile clicks (V1: log only)
  document.body.addEventListener("click", (e) => {
    const issue    = e.target.closest("[data-issue]");
    const step     = e.target.closest("[data-step]");
    const platform = e.target.closest("[data-platform]");
    if (issue)    console.log("[v1] open issue", issue.dataset.issue);
    // step rows live under the locked overlay — they're behind a blur and pointer-events:none on
    // the preview, but we also short-circuit any leaked clicks just in case
    if (step) {
      e.preventDefault();
      e.stopPropagation();
      console.log("[v1] action step locked — redirecting to unlock");
      window.location.href = "/#request";
      return;
    }
    if (platform) console.log("[v1] manage platform", platform.dataset.platform);
  });

  // "View All Issues" / "Manage Connections" / etc. — log clicks (real links navigate via href)
  document.querySelectorAll(".view-all, .manage-link, [data-jump]")
    .forEach(btn => btn.addEventListener("click", () => {
      console.log("[v1] CTA clicked:", btn.textContent.trim());
    }));
}


/* ─────────────────────────────────────────────
   HELPERS
   ───────────────────────────────────────────── */

function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }

function tierClass(tier) {
  if (tier === "high") return "high";
  if (tier === "medium" || tier === "med") return "med";
  return "low";
}

function severityLabel(tier) {
  if (tier === "high") return "High";
  if (tier === "medium" || tier === "med") return "Medium";
  return "Low";
}

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

// simple smooth path through points using midpoint averaging
function smoothPath(points) {
  if (points.length < 2) return "";
  if (points.length === 2) return `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)} L ${points[1].x.toFixed(1)} ${points[1].y.toFixed(1)}`;
  let d = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i];
    const p1 = points[i + 1];
    const cx = (p0.x + p1.x) / 2;
    d += ` Q ${p0.x.toFixed(1)} ${p0.y.toFixed(1)} ${cx.toFixed(1)} ${((p0.y + p1.y) / 2).toFixed(1)}`;
  }
  const last = points[points.length - 1];
  d += ` T ${last.x.toFixed(1)} ${last.y.toFixed(1)}`;
  return d;
}


/* ═════════════════════════════════════════════════════════════════
   SCAN → DASHBOARD HANDOFF
   Reads the audit response from localStorage (set by index.html
   after a successful scan) and transforms it into dashboard shape.
   Falls back to mockData() when nothing is stored.
   ═════════════════════════════════════════════════════════════════ */

const SCAN_KEY      = "royalte_scan_data";
const SCAN_TIME_KEY = "royalte_scan_time";

function getDashboardData() {
  try {
    const raw = localStorage.getItem(SCAN_KEY);
    if (!raw) return mockData();

    const audit = JSON.parse(raw);
    if (!audit || typeof audit !== "object") return mockData();

    const data = mapScanToDashboard(audit);

    // mark stale if the stored scan is older than 24h
    const t = Number(localStorage.getItem(SCAN_TIME_KEY));
    if (t && Number.isFinite(t)) {
      const ageHours = (Date.now() - t) / 36e5;
      if (ageHours >= 24 && data.identity) {
        data.identity._staleHours = ageHours < 48
          ? Math.round(ageHours) + "h"
          : Math.round(ageHours / 24) + "d";
      }
    }
    return data;
  } catch (e) {
    console.warn("[dashboard] failed to parse stored scan, using mock data:", e);
    return mockData();
  }
}

/**
 * Transform the audit.js response into the dashboard data contract.
 * Defensively tolerates missing fields — every output property has a
 * sensible default, so the dashboard never breaks on partial data.
 *
 * @param {Object} audit - raw response from /api/audit
 * @returns {DashboardData}
 */
function mapScanToDashboard(audit) {
  audit = audit || {};

  // ── score ────────────────────────────────────
  const score = pickFirst([audit.overallScore, audit.score, audit.royaltyScore], 0);
  const scoreHeadline = headlineForScore(score);

  // ── revenue risk (Path B: ranges, not exact $) ─
  const riskTier = mapRiskTier(audit.royaltyRiskScore || audit.riskLevel || riskFromScore(score));
  const revenueRisk = {
    range: revenueRangeForTier(riskTier),
    tier: riskTier,
    tierLabel: riskTier.charAt(0).toUpperCase() + riskTier.slice(1),
    note: "Exact recovery amount requires full audit review"
  };

  // ── stats (issues / things working) ──────────
  const flags = Array.isArray(audit.flags) ? audit.flags : [];
  const verifiedFlags = flags.filter(f => f && f.verified !== false);
  const issuesFound = verifiedFlags.length || pickFirst([audit.issuesFound, audit.flagCount], 0);
  // "things working" is a derived count — modules at high scores
  const modules = audit.modules && typeof audit.modules === "object" ? audit.modules : {};
  const modScores = Object.values(modules).map(m => Number(m && m.score) || 0);
  const thingsWorking = Math.max(
    pickFirst([audit.thingsWorking, audit.verifiedCount], 0),
    modScores.filter(s => s >= 75).length * 2
  );

  // ── recent scan dates ────────────────────────
  const scannedAt = audit.scannedAt ? new Date(audit.scannedAt) : new Date();
  const next = new Date(scannedAt.getTime()); next.setDate(next.getDate() + 30);

  // ── identity ─────────────────────────────────
  const platforms = audit.platforms && typeof audit.platforms === "object" ? audit.platforms : {};
  const identity = {
    artistName:     pickFirst([audit.artistName, audit.artist, audit.subjectName], null),
    artistImage:    pickArtistImage(audit),
    sourcePlatform: detectSourcePlatform(audit, platforms),
    resolvedFrom:   detectResolvedFrom(audit, platforms),
    platforms: {
      spotify:    !!(platforms.spotify    && (platforms.spotify.found    !== false)),
      appleMusic: !!(platforms.appleMusic && (platforms.appleMusic.found !== false))
                  || !!(platforms.apple && (platforms.apple.found !== false))
    },
    scanStatus: detectScanStatus(audit)
  };

  // ── trend (Path B: tier-based silhouette) ────
  // V1: a single scan can't paint a real trend. Show a flat-ish line
  // at the current tier so the chart isn't empty.
  const trend = buildTrendFromCurrentTier(riskTier);

  // ── issues + action plan ─────────────────────
  const issues = verifiedFlags.slice(0, 5).map((f, i) => ({
    id:          f.id || ("i" + (i + 1)),
    title:       f.title || f.message || f.name || "Issue detected",
    desc:        f.description || f.detail || "—",
    severity:    normalizeSeverity(f.severity),
    impactLabel: f.impact || impactLabelForSeverity(normalizeSeverity(f.severity)),
    icon:        f.icon || iconKeyForFlag(f)
  }));

  const actionPlan = (audit.actionPlan || verifiedFlags).slice(0, 5).map((src, i) => {
    const sev = normalizeSeverity(src.severity);
    return {
      step: i + 1,
      title: src.action || src.fix || actionTitleFromFlag(src),
      meta:  src.meta || src.scope || "—",
      severity: sev
    };
  });

  // ── platforms grid ───────────────────────────
  const PLAT_KEYS = [
    { audit: "spotify",    key: "spotify",    name: "Spotify" },
    { audit: "appleMusic", key: "apple",      name: "Apple Music" },
    { audit: "apple",      key: "apple",      name: "Apple Music" },
    { audit: "youtube",    key: "youtube",    name: "YouTube" },
    { audit: "soundcloud", key: "soundcloud", name: "SoundCloud" },
    { audit: "tiktok",     key: "tiktok",     name: "TikTok" }
  ];
  const seen = new Set();
  const platformList = [];
  PLAT_KEYS.forEach(p => {
    if (seen.has(p.key)) return;
    const m = platforms[p.audit];
    if (m && m.found !== false) {
      platformList.push({ key: p.key, name: p.name, status: "connected" });
      seen.add(p.key);
    }
  });
  const totalAvailable = pickFirst([audit.platformsTotal, audit.totalPlatforms], 15);

  // ── final assembly ───────────────────────────
  return {
    user: {
      firstName: firstWord(identity.artistName) || "there",
      fullName:  identity.artistName || "Artist",
      plan:      "Free Scan",
      verified:  identity.scanStatus === "verified",
      notifications: 0
    },
    score: { value: clamp(Math.round(score), 0, 100), headline: scoreHeadline },
    revenueRisk,
    stats: { issuesFound, thingsWorking },
    recentScan: {
      dateLabel:     formatScanDate(scannedAt),
      nextDateLabel: formatNextDate(next),
      sourcesCount:  10
    },
    identity,
    trend,
    issues:     issues.length     ? issues     : [],
    actionPlan: actionPlan.length ? actionPlan : [],
    platforms:  platformList,
    platformsConnected: platformList.length,
    platformsTotal:     totalAvailable
  };
}

/* ── mapping helpers ──────────────────────────── */

function pickFirst(values, fallback) {
  for (const v of values) {
    if (v !== undefined && v !== null && v !== "") return v;
  }
  return fallback;
}

/**
 * Look up the artist/album/track image URL across known shapes.
 * Order is intentional — exactly per spec.
 *   1. audit.imageUrl
 *   2. audit.artworkUrl
 *   3. audit.artistImageUrl
 *   4. audit.albumImageUrl
 *   5. audit.trackImageUrl
 *   6. audit.track?.album?.images?.[0]?.url
 *   7. audit.album?.images?.[0]?.url
 *   8. audit.artist?.images?.[0]?.url
 * Returns null if none yield a usable URL string → initials fallback.
 */
function pickArtistImage(audit) {
  if (!audit || typeof audit !== "object") return null;

  const candidates = [
    audit.imageUrl,
    audit.artworkUrl,
    audit.artistImageUrl,
    audit.albumImageUrl,
    audit.trackImageUrl,
    audit.track && audit.track.album && audit.track.album.images && audit.track.album.images[0] && audit.track.album.images[0].url,
    audit.album && audit.album.images && audit.album.images[0] && audit.album.images[0].url,
    audit.artist && audit.artist.images && audit.artist.images[0] && audit.artist.images[0].url
  ];

  for (const c of candidates) {
    if (typeof c === "string" && c.trim().length > 0) return c.trim();
  }
  return null;
}

function firstWord(s) {
  if (!s) return "";
  const m = String(s).trim().match(/^\S+/);
  return m ? m[0] : "";
}

function normalizeSeverity(s) {
  s = String(s || "").toLowerCase();
  if (s === "high"   || s === "critical") return "high";
  if (s === "low"    || s === "info")     return "low";
  return "medium";
}

function mapRiskTier(v) {
  if (typeof v === "number") {
    if (v >= 70) return "high";
    if (v >= 40) return "medium";
    return "low";
  }
  const s = String(v || "").toLowerCase();
  if (s.includes("high"))   return "high";
  if (s.includes("low"))    return "low";
  return "medium";
}

function riskFromScore(score) {
  // inverse: lower score = higher risk
  if (score < 50) return "high";
  if (score < 75) return "medium";
  return "low";
}

function revenueRangeForTier(tier) {
  if (tier === "high")   return "$1K–$10K+";
  if (tier === "medium") return "Hundreds–Thousands";
  return "Low impact";
}

function impactLabelForSeverity(sev) {
  if (sev === "high")   return "Thousands at risk";
  if (sev === "medium") return "Hundreds at risk";
  return "Minor";
}

function headlineForScore(score) {
  if (score >= 85) return "Your setup is solid";
  if (score >= 70) return "Your setup needs improvement";
  if (score >= 50) return "Multiple gaps detected";
  return "Critical gaps detected";
}

function detectSourcePlatform(audit, platforms) {
  if (audit.sourcePlatform) return String(audit.sourcePlatform).toLowerCase();
  if (platforms.spotify    && platforms.spotify.found    !== false) return "spotify";
  if (platforms.appleMusic && platforms.appleMusic.found !== false) return "apple_music";
  if (platforms.apple      && platforms.apple.found      !== false) return "apple_music";
  return "spotify";
}

function detectResolvedFrom(audit, platforms) {
  if (audit.resolvedFrom) return audit.resolvedFrom;
  const sp = !!(platforms.spotify    && platforms.spotify.found    !== false);
  const ap = !!((platforms.appleMusic && platforms.appleMusic.found !== false) ||
                (platforms.apple      && platforms.apple.found      !== false));
  if (sp && ap) return "spotify_and_apple";
  if (sp) return "spotify";
  if (ap) return "apple_music";
  return "spotify";
}

function detectScanStatus(audit) {
  if (audit.scanStatus) return String(audit.scanStatus).toLowerCase();
  // Apple-only scans have less data — flag as limited
  const platforms = audit.platforms || {};
  const sp = !!(platforms.spotify    && platforms.spotify.found    !== false);
  const ap = !!((platforms.appleMusic && platforms.appleMusic.found !== false) ||
                (platforms.apple      && platforms.apple.found      !== false));
  if (!sp && ap) return "limited";
  return "verified";
}

function iconKeyForFlag(f) {
  const key = String((f && (f.category || f.type || f.code || f.title)) || "").toLowerCase();
  if (key.includes("isrc"))     return "isrc";
  if (key.includes("youtube") || key.includes("content id")) return "yt";
  if (key.includes("publish")) return "pub";
  if (key.includes("split"))   return "splits";
  if (key.includes("tag") || key.includes("metadata")) return "tags";
  return "isrc";
}

function actionTitleFromFlag(f) {
  const t = String((f && (f.title || f.message || f.name)) || "").toLowerCase();
  if (t.includes("isrc"))            return "Fix missing ISRCs (recover revenue)";
  if (t.includes("content id"))      return "Claim YouTube Content ID (recover revenue)";
  if (t.includes("publish"))         return "Link publishing to recordings";
  if (t.includes("split"))           return "Review & update splits";
  if (t.includes("tag") || t.includes("metadata")) return "Add editorial tags";
  return f && f.title ? "Fix: " + f.title : "Review issue";
}

function buildTrendFromCurrentTier(tier) {
  // V1: no historical data — paint a flat current-tier line
  return [
    { date: "Feb", tier },
    { date: "Mar", tier },
    { date: "Apr", tier },
    { date: "May", tier },
    { date: "Jun", tier },
    { date: "Jul", tier }
  ];
}

function formatScanDate(d) {
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const h = d.getHours();
  const min = String(d.getMinutes()).padStart(2, "0");
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = ((h + 11) % 12) + 1;
  return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()} · ${h12}:${min} ${ampm}`;
}

function formatNextDate(d) {
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}


/* ─────────────────────────────────────────────
   INIT
   ───────────────────────────────────────────── */

function init() {
  // V1 data source: localStorage scan handoff with mock fallback.
  // V2 will replace this with /api/dashboard fetch.
  const data = getDashboardData();

  renderSidebar(data);
  renderHeader(data);
  renderHeroBanner(data);
  renderHeroIdentity(data);
  renderRevenueCard(data);
  renderRecentScan(data);
  renderLockStrip(data);
  renderIssues(data);
  renderActionPlan(data);
  renderPlatforms(data);

  wireInteractions();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
