// ─────────────────────────────────────────────────────────────────────────
//  Royaltē Intelligence Vault™ — Authentication Module (Phase 4.1)
// ─────────────────────────────────────────────────────────────────────────
//
//  The Intelligence Vault is the only entrance to Mission Control.
//  One path. Every artist. Every visit. Every device. No exceptions.
//
//  Vault lifecycle on mission-control.html:
//
//    1. Show Sentinel State + Vault overlay (always — no session shortcuts)
//    2. Authenticate — signIn first, signUp fallback
//       The artist never knows which path executed.
//    3. Claim scan ownership via /api/claim-scan (non-fatal)
//    4. Trigger signature transition:
//         Vault fades (0.5s) → silence (0.5s) → system click
//         → Sentinel deactivates → boot sequence
//
//  One button. One Vault. Royaltē determines everything else invisibly.
// ─────────────────────────────────────────────────────────────────────────

import { getSupabase } from '/js/supabase-client.js';

const sleep = ms => new Promise(r => setTimeout(r, ms));
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function param(key) {
  try { return new URL(window.location.href).searchParams.get(key); }
  catch { return null; }
}

// ── Entry point — called once on DOMContentLoaded ──────────────────────

export async function initVault() {
  const supabase = getSupabase();
  if (!supabase) return;

  // Preview mode — vault-auth.js does not interfere; MC renders from fixture data.
  const isPreview = param('preview') === '1' ||
    window.location.pathname.includes('mission-control-preview');
  if (isPreview) return;

  const needsVault    = param('vault') === '1';
  const isPreactivate = param('preactivate') === '1';
  const sessionId     = param('session_id');
  const scanId        = param('scanId') || _pendingScanId();

  // Phase 4.1 Board lock: the Intelligence Vault is the only entrance to MC.
  // Any URL without ?vault=1 is an illegal direct-entry path — redirect to vault.
  // Covers bookmarks, old ?boot=1 links, and any direct mission-control.html access.
  if (!needsVault) {
    const url = new URL(window.location.href);
    url.searchParams.set('vault', '1');
    url.searchParams.delete('boot');
    window.location.replace(url.toString());
    return;
  }

  // Phase 4.3: preactivate path — OS activates first, vault rises after.
  if (isPreactivate) {
    _showPreactivateSequence(sessionId, scanId);
    return;
  }

  // Every artist authenticates every time. No session shortcuts. No auto-entry.
  _showVault(sessionId, scanId);
}

// ── Sentinel State ─────────────────────────────────────────────────────
//
//  Sequence (cover path — arriving via ?vault=1 from index.html):
//
//    t =   0ms  mc-sentinel added; radar speeds to 4s/rev
//    t =  80ms  boot cover begins fading (1.2s ease)
//    t =1280ms  cover fully transparent → MC visible in Sentinel
//    t =5000ms  one Sentinel blip fires (≈ end of first radar sweep)
//    t =5600ms  Vault begins fading in (0.7s ease)
//    t =6300ms  Vault fully visible; email field focuses
//
//  The artist sees MC asleep with radar sweeping for ~3.7s before
//  the blip, then the Vault fades in immediately after.

// ── Sentinel Empty State™ ──────────────────────────────────────────────
//
//  Sets every MC module to its initialized-but-unpopulated state.
//  Called before the Vault appears so the artist sees an OS that is
//  awake but has not yet received intelligence — not hidden values.
//
//  CSS ring overrides (stroke-dasharray:0) are a failsafe; this JS
//  ensures every text value is genuinely blank, not merely invisible.

// Sets reactor step + overrides status text for Sentinel (passive, not booting).
function _setSentinelReactor(step) {
  const boot = window.__mcBoot;
  if (boot && boot.setReactor) boot.setReactor(step);
  const statusEl = document.getElementById('mc-reactor-status');
  if (statusEl) {
    statusEl.textContent = step === 0 ? 'Standby' : 'Passive Monitoring';
    statusEl.className   = step === 0 ? 'mc-reactor-status' : 'mc-reactor-status mc-rs-booting';
  }
}

function _blankSentinelData() {
  const q  = s => document.querySelector(s);
  const qa = s => document.querySelectorAll(s);

  // Health Intelligence™ v2.0 (Sprint 3.2)
  const hiScore = q('[data-mc-hi-score]');
  if (hiScore) hiScore.textContent = '—';
  const hiGrade = q('[data-mc-hi-grade]');
  if (hiGrade) hiGrade.textContent = '—';
  const hiTrendText = q('[data-mc-hi-trend-text]');
  if (hiTrendText) hiTrendText.textContent = '—';
  qa('[data-mc-hi-cat-score]').forEach(el => { el.textContent = '—'; });
  const hiBestTitle = q('[data-mc-hi-best-title]');
  if (hiBestTitle) hiBestTitle.textContent = '—';
  const hiRiskTitle = q('[data-mc-hi-risk-title]');
  if (hiRiskTitle) hiRiskTitle.textContent = '—';
  const hiSpark4 = q('[data-mc-hi-spark="4"]');
  if (hiSpark4) hiSpark4.textContent = '—';
  const hiChanges = q('[data-mc-hi-changes]');
  if (hiChanges) hiChanges.innerHTML = '';

  // Identity Intelligence™ v2.0 (Sprint 3.3)
  const idCov = q('[data-mc-id-coverage]');    if (idCov) idCov.textContent = '—';
  const idGrd = q('[data-mc-id-coverage-grade]'); if (idGrd) idGrd.textContent = '—';
  const idSub = q('[data-mc-id-coverage-sub]');   if (idSub) idSub.textContent = '— of — verified';
  const idSv  = q('[data-mc-id-sum-verified]');   if (idSv)  idSv.textContent  = '—';
  const idSa  = q('[data-mc-id-sum-action]');     if (idSa)  idSa.textContent  = '—';
  const idSm  = q('[data-mc-id-sum-missing]');    if (idSm)  idSm.textContent  = '—';
  const idSu  = q('[data-mc-id-sum-unavailable]');if (idSu)  idSu.textContent  = '—';
  qa('[data-mc-id-provider-pill]').forEach(el => { el.textContent = '—'; el.className = 'mc-pill mc-pill--unable'; });
  const idRt  = q('[data-mc-id-risk-title]'); if (idRt) idRt.textContent = '—';
  const idWt  = q('[data-mc-id-win-title]');  if (idWt) idWt.textContent  = '—';
  const idCh  = q('[data-mc-id-changes]');    if (idCh) idCh.innerHTML    = '';

  // Publishing Intelligence™ v3.4 (Sprint 3.4)
  const piCov = q('[data-mc-pi-coverage]');       if (piCov) piCov.textContent = '—';
  const piGrd = q('[data-mc-pi-coverage-grade]'); if (piGrd) piGrd.textContent = '—';
  const piSub = q('[data-mc-pi-coverage-sub]');   if (piSub) piSub.textContent = '— of — complete';
  const piSv  = q('[data-mc-pi-sum-verified]');   if (piSv)  piSv.textContent  = '—';
  const piSc  = q('[data-mc-pi-sum-connected]');  if (piSc)  piSc.textContent  = '—';
  const piSa  = q('[data-mc-pi-sum-attention]');  if (piSa)  piSa.textContent  = '—';
  const piSm  = q('[data-mc-pi-sum-missing]');    if (piSm)  piSm.textContent  = '—';
  qa('[data-mc-pi-system-pill]').forEach(el => { el.textContent = '—'; el.className = 'mc-pill mc-pill--unable'; });
  const piIr  = q('[data-mc-pi-impact-resolution]'); if (piIr) piIr.textContent = '—';
  const piRt  = q('[data-mc-pi-risk-title]');        if (piRt) piRt.textContent = '—';
  const piWt  = q('[data-mc-pi-win-title]');       if (piWt) piWt.textContent  = '—';
  const piCh  = q('[data-mc-pi-changes]');         if (piCh) piCh.innerHTML    = '';

  // Catalog Intelligence
  const cs = q('[data-mc-catalog-status]');
  if (cs) cs.textContent = '—';
  ['singles', 'eps', 'albums', 'tracks'].forEach(k => {
    const el = q(`[data-mc-catalog-${k}]`);
    if (el) el.textContent = '0';
  });

  // Change Detection
  const cv = q('[data-mc-cd-sum-value]');
  if (cv) cv.textContent = '—';
  const cm = q('[data-mc-cd-sum-meta]');
  if (cm) cm.textContent = 'Waiting for Intelligence';
  const cf = q('[data-mc-cd-feed]');
  if (cf) cf.innerHTML = '';

  // Backend Intelligence
  const bc = q('[data-mc-backend-connected-count]');
  if (bc) bc.textContent = '0 / 4';
  const bm = q('[data-mc-backend-summary]');
  if (bm) bm.textContent = 'Initializing';
  qa('.mc-bi-service-status').forEach(el => { el.textContent = '—'; });
  qa('.mc-bi-service-sub').forEach(el    => { el.textContent = 'Connecting'; });

  // AI Insights (right rail)
  const ao = q('[data-mc-ai-observation]');
  if (ao) ao.textContent = 'Waiting for Intelligence';
  const al = q('[data-mc-ai-activity-list]');
  if (al) al.innerHTML = '';

  // Royaltē Review (right rail)
  const pac = q('[data-mc-priority-actions-count]');
  if (pac) pac.textContent = '0';
  const pal = q('[data-mc-priority-actions]');
  if (pal) pal.innerHTML = '';
  const rr = q('.mc-review-ring .mc-ring-progress');
  if (rr) rr.setAttribute('stroke-dasharray', '0 289');

  // Page title + founder name — hardcoded seed values must not show until the
  // scan's artist is confirmed from the payload. __mcRevealHero() writes the
  // real name after __mcPopulate() resolves.
  const pt = q('[data-mc-page-title]');
  if (pt) pt.textContent = '';
  const fn = q('[data-mc-founder-name]');
  if (fn) fn.textContent = '';

  // Reactor: start at 0% / Standby. Will rise to 25% over the two sweeps.
  _setSentinelReactor(0);
}

let _lastBlipIdx = -1;

function _showVault(sessionId, scanId) {
  document.body.classList.add('mc-sentinel');
  _blankSentinelData();

  const cover    = document.getElementById('mc-boot-cover');
  const hasCover = cover && cover.style.display !== 'none';

  const COVER_FADE = 1200;  // boot cover fade duration
  const ONE_SWEEP  = 4000;  // radar animation-duration in Sentinel State

  // Blips fire just before each sweep completes so detection feels
  // triggered by the sweep arm passing that position.
  const base       = hasCover ? (80 + COVER_FADE) : 0;
  const BLIP1_AT   = base + ONE_SWEEP - 200;        // end of first sweep
  const BLIP2_AT   = BLIP1_AT + ONE_SWEEP;          // end of second sweep
  const VAULT_AT   = BLIP2_AT + 600;                // vault fades in after second blip
  const FOCUS_AT   = VAULT_AT + 800;                // email focus after vault is visible
  // Power rises gradually over the two sweeps: 0% → 12% → 25%
  const SWEEP1_MID = base + ONE_SWEEP / 2;          // midway through sweep 1 → 12%
  const SWEEP2_MID = (BLIP1_AT + BLIP2_AT) / 2;    // midway through sweep 2 → 25%

  if (hasCover) {
    setTimeout(() => {
      cover.style.transition = 'opacity 1.2s ease';
      cover.style.opacity = '0';
      setTimeout(() => { cover.style.display = 'none'; }, COVER_FADE);
    }, 80);
  }

  // Power rises over the two sweeps: 0% (on load) → 12% (mid sweep 1) → 25% (mid sweep 2)
  setTimeout(() => _setSentinelReactor(1), SWEEP1_MID);
  setTimeout(() => _setSentinelReactor(2), SWEEP2_MID);

  // Two Sentinel blips — one per radar sweep, guaranteed different positions.
  setTimeout(_fireOneSentinelBlip, BLIP1_AT);
  setTimeout(_fireOneSentinelBlip, BLIP2_AT);

  // Vault fades in after second blip
  setTimeout(() => {
    const vault = document.getElementById('mc-vault');
    if (vault) {
      vault.removeAttribute('aria-hidden');
      requestAnimationFrame(() => requestAnimationFrame(() => {
        vault.classList.add('mc-vault--visible');
      }));
    }
  }, VAULT_AT);

  // Focus email field after Vault is visible
  setTimeout(() => {
    const el = document.getElementById('mc-vault-email');
    if (el) el.focus();
  }, FOCUS_AT);

  _wireForm(sessionId, scanId);
}

// ── Phase 4.3 — Preactivate sequence ───────────────────────────────────
// Called when ?preactivate=1 is in the URL (OPEN MISSION CONTROL path).
// Runs the full OS activation experience first — Sentinel radar sweeps,
// then each module illuminates one at a time at 2.5-second intervals —
// then raises the Intelligence Vault for authentication.
//
// Rule 8 compliant: mc-booting is never used on the vault path.
// The "activation" effect is data appearing via __mcRevealModule, not
// opacity transitions (those require mc-booting which is cold-start only).
function _showPreactivateSequence(sessionId, scanId) {
  document.body.classList.add('mc-sentinel');
  _blankSentinelData();

  const cover    = document.getElementById('mc-boot-cover');
  const hasCover = cover && cover.style.display !== 'none';
  const COVER_FADE = 1200;
  const ONE_SWEEP  = 4000;
  const base       = hasCover ? (80 + COVER_FADE) : 0;
  const BLIP1_AT   = base + ONE_SWEEP - 200;
  const BLIP2_AT   = BLIP1_AT + ONE_SWEEP;
  const SWEEP1_MID = base + ONE_SWEEP / 2;
  const SWEEP2_MID = (BLIP1_AT + BLIP2_AT) / 2;

  if (hasCover) {
    setTimeout(() => {
      cover.style.transition = 'opacity 1.2s ease';
      cover.style.opacity = '0';
      setTimeout(() => { cover.style.display = 'none'; }, COVER_FADE);
    }, 80);
  }

  setTimeout(() => _setSentinelReactor(1), SWEEP1_MID);
  setTimeout(() => _setSentinelReactor(2), SWEEP2_MID);
  setTimeout(_fireOneSentinelBlip, BLIP1_AT);
  setTimeout(_fireOneSentinelBlip, BLIP2_AT);

  // After two sweeps: activate modules one at a time at 2.5-second intervals.
  const ACTIVATE_AT = BLIP2_AT + 600;
  const MODULE_ORDER = [
    'ecosystem-status',
    'health-intelligence', 'identity-intelligence', 'publishing-intelligence',
    'catalog-intelligence', 'change-detection', 'backend-intelligence',
    'global-footprint', 'ai-insights',
  ];
  const INTERVAL = 2500; // Board directive: ~2.5 seconds per module
  const TOTAL    = MODULE_ORDER.length * INTERVAL;

  setTimeout(async () => {
    // Populate MC from bridged sessionStorage payload (no auth required —
    // data was stored by the homepage scan before navigation).
    if (typeof window.__mcPopulate === 'function') await window.__mcPopulate();

    // Write the artist name to the page title immediately after the payload
    // resolves — before sentinel is removed and modules activate — so the
    // first visible frame of MC shows the correct subject, not the seed value.
    if (typeof window.__mcRevealHero === 'function') window.__mcRevealHero();

    // Remove Sentinel — modules are fully visible with blanked data from here.
    // Inline stroke-dasharray attributes set by _blankSentinelData() hold rings
    // at zero until __mcRevealModule updates them with transitions.
    document.body.classList.remove('mc-sentinel');

    const reactorStatus = document.getElementById('mc-reactor-status');
    if (reactorStatus) {
      reactorStatus.textContent = 'System Booting';
      reactorStatus.className   = 'mc-reactor-status mc-rs-booting';
    }

    const hero = document.querySelector('.mc-hero');
    if (hero) hero.classList.add('mc-online');

    // Animate reactor percentage 25% → 100% continuously over the full activation.
    _animateReactorPct(25, 100, TOTAL);

    const boot  = window.__mcBoot;
    const pctEl = document.getElementById('mc-reactor-pct');

    MODULE_ORDER.forEach((id, i) => {
      setTimeout(() => {
        const el = document.getElementById(id);
        if (el) el.classList.add('mc-online');
        if (typeof window.__mcRevealModule === 'function') window.__mcRevealModule(id);
        // Step reactor dots without overwriting the animated percentage.
        if (boot?.setReactor) {
          const saved = pctEl?.textContent;
          boot.setReactor(i + 1);
          if (pctEl && saved) pctEl.textContent = saved;
        }
      }, (i + 1) * INTERVAL);
    });

    // After last module: finalize reactor state, brief pause, raise vault.
    setTimeout(() => {
      if (pctEl) pctEl.textContent = '100%';
      if (reactorStatus) {
        reactorStatus.textContent = 'Royaltē OS Online';
        reactorStatus.className   = 'mc-reactor-status mc-rs-online';
      }
      if (boot?.setReactor) {
        const saved = pctEl?.textContent;
        boot.setReactor(MODULE_ORDER.length);
        if (pctEl && saved) pctEl.textContent = saved;
      }

      // 2-second pause — entire OS is alive — then Intelligence Vault rises.
      setTimeout(() => {
        // Flag so _handleUnlock skips re-running the boot sequence after auth.
        window.__royaltePreactivated = true;
        const vault = document.getElementById('mc-vault');
        if (vault) {
          vault.removeAttribute('aria-hidden');
          requestAnimationFrame(() => requestAnimationFrame(() => {
            vault.classList.add('mc-vault--visible');
          }));
        }
        setTimeout(() => {
          const emailEl = document.getElementById('mc-vault-email');
          if (emailEl) emailEl.focus();
        }, 800);
        _wireForm(sessionId, scanId);
      }, 2000);
    }, TOTAL + 500);
  }, ACTIVATE_AT);
}

function _fireOneSentinelBlip() {
  // Pick from the five detection positions, excluding the last one fired.
  // Guarantees consecutive blips always appear at different locations.
  const pool = [1, 2, 3, 4, 5].filter(i => i !== _lastBlipIdx);
  const idx  = pool[Math.floor(Math.random() * pool.length)];
  _lastBlipIdx = idx;

  const BL_DUR = '1500ms';
  const dot    = document.querySelector(`.mc-radar-detect-dot--${idx}`);
  const echoes = document.querySelectorAll(`.mc-radar-detect-echo--${idx}`);
  if (!dot) return;

  // animationDelay MUST be set to '0s' here — the per-index class CSS
  // has animation-delay values of 2s–41s that would otherwise delay
  // the blip from appearing until long after it was scheduled.
  dot.style.animationName            = 'mc-sentinel-blip-dot';
  dot.style.animationDuration        = BL_DUR;
  dot.style.animationDelay           = '0s';
  dot.style.animationTimingFunction  = 'ease-out';
  dot.style.animationIterationCount  = '1';
  dot.style.animationFillMode        = 'forwards';

  echoes.forEach(e => {
    const isRing2 = e.classList.contains('mc-radar-detect-echo--ring2');
    e.style.animationName            = isRing2 ? 'mc-sentinel-blip-echo-2' : 'mc-sentinel-blip-echo-1';
    e.style.animationDuration        = BL_DUR;
    e.style.animationDelay           = '0s';
    e.style.animationTimingFunction  = 'ease-out';
    e.style.animationIterationCount  = '1';
    e.style.animationFillMode        = 'forwards';
  });
}

// ── Form wiring ────────────────────────────────────────────────────────

function _wireForm(sessionId, scanId) {
  const form   = document.getElementById('mc-vault-form');
  const passEl = document.getElementById('mc-vault-pass');
  const showEl = document.getElementById('mc-vault-show-pass');
  const forgot = document.getElementById('mc-vault-forgot');

  if (!form) return;

  // Password visibility toggle.
  if (showEl && passEl) {
    showEl.addEventListener('click', () => {
      const visible = passEl.type === 'text';
      passEl.type = visible ? 'password' : 'text';
      showEl.setAttribute('aria-label', visible ? 'Show password' : 'Hide password');
    });
  }

  // Forgot password — inline, no page navigation.
  if (forgot) {
    forgot.addEventListener('click', async () => {
      const email = (document.getElementById('mc-vault-email')?.value || '').trim();
      if (!EMAIL_RE.test(email)) {
        _setStatus('Enter your email address above first.', 'error');
        return;
      }
      forgot.disabled = true;
      _setStatus('Sending reset link…', '');
      const supabase = getSupabase();
      if (supabase) {
        await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/auth/callback`,
        });
      }
      _setStatus(`Password reset link sent to ${email}.`, 'success');
      forgot.disabled = false;
    });
  }

  // Form submission — the only action the artist takes.
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const email    = (document.getElementById('mc-vault-email')?.value || '').trim();
    const password = document.getElementById('mc-vault-pass')?.value || '';
    if (!email || !password) {
      _setStatus('Please enter your email and password.', 'error');
      return;
    }
    await _handleUnlock(email, password, sessionId, scanId);
  });
}

// ── Authentication — single deterministic flow ─────────────────────────

async function _handleUnlock(email, password, sessionId, scanId) {
  _setCta('Unlocking…', true);
  _setStatus('', '');

  const supabase = getSupabase();

  // ── Path 1: Sign in (returning artist) ───────────────────────────────
  let { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    const isInvalid = (error.message || '').toLowerCase().includes('invalid');

    if (isInvalid) {
      // "Invalid login credentials" is ambiguous — Supabase returns it for
      // both wrong passwords and unknown emails. Try signUp to disambiguate:
      // if the email is already registered, signUp returns "already registered"
      // confirming it was a wrong password. If unknown, signUp creates the account.
      const callbackUrl = `${window.location.origin}/auth/callback`
        + (sessionId ? `?session_id=${encodeURIComponent(sessionId)}` : '');

      const signUp = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { session_id: sessionId || null, source: 'vault_mc_phase3' },
          emailRedirectTo: callbackUrl,
        },
      });

      if (signUp.error) {
        // Email already registered → the original signIn failure was wrong password.
        _setCta('INITIATE ROYALTĒ OS', false);
        _setStatus('Incorrect email or password.', 'error');
        return;
      }

      if (!signUp.data?.session) {
        // ── Path 2: New artist — email confirmation required ─────────────
        // Vault stays. Artist must click the link in their inbox.
        // Pending scan id is saved so the callback can boot MC with it.
        if (scanId) { try { localStorage.setItem('royalte_pending_scan_id', scanId); } catch {} }
        _setCta('Verification Sent', true);
        _setStatus(
          `Check your inbox. We sent a verification link to ${email}. Click it to unlock Mission Control.`,
          ''
        );
        return;
      }

      // ── Path 3: New artist — auto-confirmed (no email confirm) ──────────
      data = signUp.data;
    } else {
      // Non-credentials error (service unavailable, etc.).
      _setCta('Unlock Mission Control', false);
      _setStatus(error.message || 'Royaltē is temporarily unavailable. Please try again.', 'error');
      return;
    }
  }

  // ── Authentication succeeded — claim the scan ─────────────────────────
  const token = data?.session?.access_token;
  if (sessionId && token) {
    await _claimScan(token, sessionId);
  }

  if (window.__royaltePreactivated) {
    // Preactivate path: Mission Control is already displaying the current scan's
    // intelligence. The scan claim above establishes ownership. No re-population
    // is performed — the anonymous scan payload and the authenticated scan payload
    // are identical for this scan. Querying Supabase post-auth could return a
    // different artist's owned data, violating the authentication boundary.
    // The vault dissolves; the OS remains active with the correct scan displayed.
    const _vault = document.getElementById('mc-vault');
    if (_vault) {
      _vault.classList.remove('mc-vault--visible');
      await sleep(800);
      _vault.setAttribute('aria-hidden', 'true');
    }
    return;
  }

  // Normal vault path: populate cards while they are still invisible behind
  // the vault overlay, then run the signature transition into the boot sequence.
  if (typeof window.__mcPopulate === 'function') {
    await window.__mcPopulate();
  }

  // ── Signature transition ───────────────────────────────────────────────
  await _signatureTransition();
}

// ── Scan ownership ─────────────────────────────────────────────────────

async function _claimScan(token, sessionId) {
  try {
    const res = await fetch('/api/claim-scan', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body:    JSON.stringify({ session_id: sessionId }),
    });
    if (!res.ok) console.warn('[vault] claim-scan returned', res.status);
  } catch (e) {
    console.warn('[vault] claim-scan threw:', e.message);
  }
}

// ── Signature transition ───────────────────────────────────────────────

async function _signatureTransition() {
  // Vault fades out — 0.5s ease-in.
  const vault = document.getElementById('mc-vault');
  if (vault) {
    vault.classList.add('mc-vault--leaving');
    await sleep(500);
    vault.setAttribute('aria-hidden', 'true');
    vault.style.display = 'none';
  }

  // Remove Sentinel State. MC was always at full brightness — the vault
  // overlay was the sole visual element over it. Removing mc-sentinel
  // restores pointer-events and stops the Sentinel radar timing.
  // No dots reset, no status change: power rises from 25% in _triggerBoot.
  document.body.classList.remove('mc-sentinel');

  // Page title: write the scanned artist name now that MC is visible.
  // __mcPopulate() already ran and stored the name; this is the first
  // visible frame of MC on the normal vault path.
  if (typeof window.__mcRevealHero === 'function') window.__mcRevealHero();

  // Half-second silence — the defining pause before activation.
  await sleep(500);

  // Soft system click → Royaltē wakes.
  window.__mcBoot?.playClick?.();

  // Brief pause, then the module activation sequence.
  await sleep(400);
  _triggerBoot();
}

function _triggerBoot() {
  const boot = window.__mcBoot;
  if (!boot?.runActivationSequence) return;

  const pctEl = document.getElementById('mc-reactor-pct');

  // Sentinel left the reactor at 25% (2 dots lit). Capture that baseline
  // so the activation sequence never decreases the dot count — power only
  // rises from here. setReactor calls below that baseline are skipped.
  const sentinelDotCount = document.querySelectorAll('.mc-reactor-dot.lit').length;

  // Transition reactor status from Sentinel's "Passive Monitoring" to
  // "System Booting" the moment activation begins.
  const reactorStatus = document.getElementById('mc-reactor-status');
  if (reactorStatus) {
    reactorStatus.textContent = 'System Booting';
    reactorStatus.className   = 'mc-reactor-status mc-rs-booting';
  }

  // Patch setReactor so it updates dots and status text but not the
  // percentage display. The pct is driven by _animateReactorPct which
  // rises continuously from Sentinel's 25% to 100% across the full
  // activation sequence — giving the Board's "slowly and continuously
  // rise" feel without step-wise jumps.
  let reactorAnimating = true;
  const origSetReactor  = boot.setReactor.bind(boot);
  boot.setReactor = function (step) {
    // Skip any step that would decrease dots below the Sentinel baseline.
    if (reactorAnimating && step < sentinelDotCount) return;
    if (!reactorAnimating || !pctEl) { origSetReactor(step); return; }
    const saved = pctEl.textContent;
    origSetReactor(step);
    pctEl.textContent = saved;
  };

  // Animate reactor pct 25% → 100% over the full 8-module sequence.
  _animateReactorPct(25, 100, 8 * 850 + 200);

  // Watch for each module getting mc-online and trigger per-module reveals.
  _watchModuleActivation();

  boot.runActivationSequence();

  // Restore original setReactor after sequence + grace window.
  setTimeout(() => {
    reactorAnimating = false;
    boot.setReactor   = origSetReactor;
  }, 8 * 850 + 1200);
}

function _animateReactorPct(from, to, duration) {
  const pctEl = document.getElementById('mc-reactor-pct');
  if (!pctEl) return;
  const t0 = performance.now();
  (function frame(now) {
    const t      = Math.min((now - t0) / duration, 1);
    const eased  = t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t+2, 3)/2;
    pctEl.textContent = Math.round(from + (to - from) * eased) + '%';
    if (t < 1) requestAnimationFrame(frame);
    else pctEl.textContent = to + '%';
  })(t0);
}

function _watchModuleActivation() {
  if (typeof window.__mcRevealModule !== 'function') return;
  const obs = new MutationObserver(mutations => {
    for (const m of mutations) {
      if (m.type !== 'attributes' || m.attributeName !== 'class') continue;
      const el = m.target;
      if (!el.classList.contains('mc-online')) continue;
      window.__mcRevealModule(el.id);
    }
  });
  obs.observe(document.body, { subtree: true, attributes: true, attributeFilter: ['class'] });
  // Auto-disconnect when the full sequence is confirmed complete.
  setTimeout(() => obs.disconnect(), 8 * 850 + 2000);
}

// ── Helpers ────────────────────────────────────────────────────────────

function _setCta(text, disabled) {
  const el = document.getElementById('mc-vault-cta');
  if (!el) return;
  el.textContent = text;
  el.disabled = !!disabled;
}

function _setStatus(msg, kind) {
  const el = document.getElementById('mc-vault-status');
  if (!el) return;
  el.textContent = msg;
  el.className = 'mc-vault-status' + (kind ? ` mc-vault-status--${kind}` : '');
}

function _pendingScanId() {
  try { return localStorage.getItem('royalte_pending_scan_id') || null; }
  catch { return null; }
}

// ── Auto-init ──────────────────────────────────────────────────────────

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initVault);
} else {
  initVault();
}
