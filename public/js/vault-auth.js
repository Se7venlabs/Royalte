// ─────────────────────────────────────────────────────────────────────────
//  Royaltē Intelligence Vault™ — Authentication Module (Phase 3)
// ─────────────────────────────────────────────────────────────────────────
//
//  Manages the complete Vault lifecycle on mission-control.html:
//
//    1. Check session — skip Vault entirely if authenticated
//    2. Show Sentinel State + Vault overlay if auth is required
//    3. Authenticate — signIn first, signUp fallback
//       The artist never knows which path executed.
//    4. Claim scan ownership via /api/claim-scan (non-fatal)
//    5. Trigger signature transition:
//         Vault fades (0.5s) → silence (0.5s) → system click
//         → Sentinel deactivates → boot sequence
//
//  One path visible to the artist. One button. Royaltē determines
//  everything else invisibly.
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

  const needsVault = param('vault') === '1';
  const sessionId  = param('session_id');
  const scanId     = param('scanId') || _pendingScanId();

  let session = null;
  try {
    ({ data: { session } } = await supabase.auth.getSession());
  } catch {}

  if (session && needsVault) {
    // Authenticated artist landing on MC with ?vault=1 (e.g. a new scan
    // while already logged in). Claim the scan; MC is already visible.
    if (sessionId) await _claimScan(session.access_token, sessionId);
    return;
  }

  if (session && !needsVault) {
    // Returning artist with valid session — MC shows immediately.
    // The boot sequence IIFE handles ?boot=1 directly; vault-auth.js
    // does not interfere with that path.
    return;
  }

  // No session — activate Sentinel State and show the Vault.
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

function _blankSentinelData() {
  const q  = s => document.querySelector(s);
  const qa = s => document.querySelectorAll(s);

  // Health Intelligence
  const hs = q('[data-mc-health-score]');
  if (hs) hs.innerHTML = '0 <small>/100</small>';
  const hst = q('[data-mc-health-status]');
  if (hst) hst.textContent = 'Waiting for Intelligence';
  const hc = q('[data-mc-health-confidence]');
  if (hc) hc.textContent = '—';
  const hcp = q('[data-mc-health-composite]');
  if (hcp) hcp.textContent = '—';
  const hi = q('[data-mc-health-insights]');
  if (hi) hi.innerHTML = '';
  qa('[data-mc-health-domain] .val').forEach(el => { el.textContent = '—'; });
  const hr = q('[data-mc-health-ring-progress]');
  if (hr) hr.setAttribute('stroke-dasharray', '0 214');

  // Identity Intelligence
  const ic = q('[data-mc-identity-coverage-value]');
  if (ic) ic.innerHTML = '0<small>%</small>';
  const is = q('[data-mc-identity-coverage-summary]');
  if (is) is.textContent = 'No providers verified';
  qa('[data-mc-identity-pill]').forEach(el => {
    el.textContent = '—';
    el.className = 'mc-pill mc-pill--unable';
  });
  const itt = q('[data-mc-identity-top-track-title]');
  if (itt) itt.textContent = '—';
  const iti = q('[data-mc-identity-top-track-isrc]');
  if (iti) iti.textContent = '—';
  const ir = q('#identity-intelligence .mc-fp-ring');
  if (ir) ir.setAttribute('stroke-dasharray', '0 264');

  // Publishing Intelligence
  const pc = q('[data-mc-publishing-coverage-value]');
  if (pc) pc.innerHTML = '0<small>%</small>';
  const ps = q('[data-mc-publishing-coverage-summary]');
  if (ps) ps.textContent = '0 of 4 verified';
  const pr = q('#publishing-intelligence .mc-ring-progress');
  if (pr) pr.setAttribute('stroke-dasharray', '0 208');

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
  const base     = hasCover ? (80 + COVER_FADE) : 0;
  const BLIP1_AT = base + ONE_SWEEP - 200;  // end of first sweep
  const BLIP2_AT = BLIP1_AT + ONE_SWEEP;   // end of second sweep
  const VAULT_AT = BLIP2_AT + 600;         // vault fades in after second blip
  const FOCUS_AT = VAULT_AT + 800;         // email focus after vault is visible

  if (hasCover) {
    setTimeout(() => {
      cover.style.transition = 'opacity 1.2s ease';
      cover.style.opacity = '0';
      setTimeout(() => { cover.style.display = 'none'; }, COVER_FADE);
    }, 80);
  }

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

  dot.style.animationName            = 'mc-sentinel-blip-dot';
  dot.style.animationDuration        = BL_DUR;
  dot.style.animationTimingFunction  = 'ease-out';
  dot.style.animationIterationCount  = '1';
  dot.style.animationFillMode        = 'forwards';

  echoes.forEach(e => {
    const isRing2 = e.classList.contains('mc-radar-detect-echo--ring2');
    e.style.animationName            = isRing2 ? 'mc-sentinel-blip-echo-2' : 'mc-sentinel-blip-echo-1';
    e.style.animationDuration        = BL_DUR;
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
        _setCta('Unlock Mission Control', false);
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

  // Transition from Sentinel State into the boot-offline state.
  // Adding mc-booting BEFORE removing mc-sentinel keeps the MC dimmed
  // through the silence — no flash of full brightness.
  document.body.classList.add('mc-booting');
  document.body.classList.remove('mc-sentinel');
  window.__mcBoot?.setReactor?.(0);

  // Half-second silence — the defining pause before activation.
  await sleep(500);

  // Soft system click → Royaltē wakes.
  window.__mcBoot?.playClick?.();

  // Brief pause, then the module activation sequence.
  await sleep(400);
  _triggerBoot();
}

function _triggerBoot() {
  window.__mcBoot?.runActivationSequence?.();
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
