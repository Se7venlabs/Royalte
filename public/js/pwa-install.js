// ─────────────────────────────────────────────────────────────────────────
// Mission Control PWA install handler (Brief 015p — true-app model).
//
// Four states: Ready / Pending / Installed / Unavailable.
// See state diagram in setupInstallButton() below.
//
// Brief 015p DIAGNOSTIC PASS: every step in the installability chain
// logs to console with the `[pwa]` prefix so a stuck button reveals
// exactly which precondition failed. Remove the diagnostic block at
// the top of this file once installability is confirmed in production.
// ─────────────────────────────────────────────────────────────────────────

(function () {
  if (typeof window === 'undefined') return;

  const log  = (...args) => console.log('[pwa]', ...args);
  const warn = (...args) => console.warn('[pwa]', ...args);
  const err  = (...args) => console.error('[pwa]', ...args);

  let deferredPrompt = null;
  const ua = navigator.userAgent || '';

  const isStandalone = () =>
    window.matchMedia?.('(display-mode: standalone)').matches ||
    window.navigator.standalone === true;
  const isIOS = () =>
    /iPad|iPhone|iPod/.test(ua) && !window.MSStream;
  const supportsBeforeInstallPrompt = () =>
    /Chrome|Chromium|Edg|OPR|SamsungBrowser/.test(ua) && !isIOS();

  // ── DIAGNOSTIC: startup PWA prerequisite audit ─────────────────────
  // Fetches and validates each installability requirement, logging
  // status to console. Runs once on load. Output answers:
  //   - Is the manifest reachable and well-formed?
  //   - Are the icons reachable?
  //   - Is the service worker file reachable?
  //   - Does this browser support beforeinstallprompt at all?
  //   - Are we already running standalone (would suppress the prompt)?
  async function runDiagnostics() {
    log('script loaded');
    log('userAgent:', ua);
    log('isStandalone:', isStandalone());
    log('isIOS:', isIOS());
    log('supportsBeforeInstallPrompt:', supportsBeforeInstallPrompt());
    log('origin:', window.location.origin);
    log('href:',   window.location.href);

    // Manifest fetch + parse
    try {
      const r = await fetch('/mission-control.webmanifest', { credentials: 'same-origin' });
      log('manifest fetch:', r.status, r.headers.get('content-type'));
      if (r.ok) {
        const m = await r.json();
        log('manifest parsed:', { name: m.name, start_url: m.start_url, scope: m.scope, display: m.display, icons: m.icons?.length });
      } else {
        warn('manifest fetch returned non-200 — installability blocked');
      }
    } catch (e) {
      err('manifest fetch threw:', e.message);
    }

    // Icon reachability
    for (const path of ['/android-chrome-192x192.png', '/android-chrome-512x512.png']) {
      try {
        const r = await fetch(path, { method: 'HEAD', credentials: 'same-origin' });
        log('icon', path, r.status, r.headers.get('content-type'));
        if (!r.ok) warn('icon not reachable —', path);
      } catch (e) {
        err('icon fetch threw:', path, e.message);
      }
    }

    // Service worker fetch (independent of registration — checks the
    // file itself is reachable with the right MIME type)
    try {
      const r = await fetch('/sw.js', { credentials: 'same-origin' });
      log('sw.js fetch:', r.status, r.headers.get('content-type'));
      if (!r.ok) warn('sw.js fetch non-200 — registration will fail');
    } catch (e) {
      err('sw.js fetch threw:', e.message);
    }

    // Service worker registration status (after a brief delay so the
    // load handler below has had a chance to register)
    setTimeout(async () => {
      if (!('serviceWorker' in navigator)) {
        warn('serviceWorker not in navigator — this browser does not support SW');
        return;
      }
      try {
        const reg = await navigator.serviceWorker.getRegistration('/');
        if (reg) {
          log('SW registration active:', { scope: reg.scope, scriptURL: reg.active?.scriptURL || reg.installing?.scriptURL || reg.waiting?.scriptURL });
        } else {
          warn('SW registration NOT found after load');
        }
      } catch (e) {
        err('SW registration query threw:', e.message);
      }
    }, 2000);

    // Engagement-window watchdog: if 30s pass on a Chromium browser
    // without beforeinstallprompt firing, log a warning — the
    // criteria are not being met.
    if (supportsBeforeInstallPrompt() && !isStandalone()) {
      setTimeout(() => {
        if (!deferredPrompt) {
          warn('beforeinstallprompt has NOT fired 30s after page load. Likely causes:');
          warn('  1. Chrome engagement heuristics not yet satisfied (interact more)');
          warn('  2. Manifest fetch failed or has invalid content (see logs above)');
          warn('  3. Service worker registration failed (see logs above)');
          warn('  4. App already installed on this profile — open chrome://apps to check');
          warn('  5. Vercel preview deployment protection is gating /sw.js or /manifest fetches');
        }
      }, 30000);
    }
  }
  runDiagnostics();

  // ── Service worker registration ──────────────────────────────────────
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js')
        .then((reg) => log('SW registered, scope:', reg.scope))
        .catch((e) => err('SW registration failed:', e.message));
    });
  } else {
    warn('serviceWorker API not available');
  }

  // ── Global event listeners ──────────────────────────────────────────
  window.addEventListener('beforeinstallprompt', (e) => {
    log('beforeinstallprompt FIRED — install available');
    e.preventDefault();
    deferredPrompt = e;
    const btn = document.getElementById('mc-install-btn');
    if (btn && btn.dataset.installState === 'pending') {
      setState(btn, 'ready');
    }
  });

  window.addEventListener('appinstalled', () => {
    log('appinstalled fired — app installed');
    deferredPrompt = null;
    const btn = document.getElementById('mc-install-btn');
    if (btn) setState(btn, 'installed');
  });

  // ── Button wiring ───────────────────────────────────────────────────
  function setupInstallButton() {
    const btn = document.getElementById('mc-install-btn');
    if (!btn) { warn('install button #mc-install-btn not found in DOM'); return; }

    if (isStandalone()) {
      log('state: installed (running standalone)');
      setState(btn, 'installed');
      return;
    }
    if (!supportsBeforeInstallPrompt()) {
      log('state: unavailable (browser does not support beforeinstallprompt)');
      setState(btn, 'unavailable');
      return;
    }
    const initial = deferredPrompt ? 'ready' : 'pending';
    log('state: initial', initial, '(deferredPrompt:', !!deferredPrompt, ')');
    setState(btn, initial);

    btn.addEventListener('click', async () => {
      log('button clicked, state:', btn.dataset.installState, 'deferredPrompt:', !!deferredPrompt);
      if (btn.dataset.installState !== 'ready' || !deferredPrompt) return;
      log('firing native install prompt');
      deferredPrompt.prompt();
      try {
        const choice = await deferredPrompt.userChoice;
        log('userChoice:', choice.outcome);
      } catch (e) {
        warn('userChoice threw:', e.message);
      }
      deferredPrompt = null;
      if (btn.dataset.installState === 'ready') setState(btn, 'pending');
    });
  }

  function setState(btn, state) {
    btn.dataset.installState = state;
    btn.classList.remove('is-pending', 'is-unavailable', 'is-installed');
    btn.removeAttribute('title');
    switch (state) {
      case 'ready':
        btn.disabled = false;
        btn.innerHTML = '<i data-lucide="download"></i> Install App';
        break;
      case 'pending':
        btn.classList.add('is-pending');
        btn.disabled = true;
        btn.innerHTML = '<i data-lucide="download"></i> Install App';
        break;
      case 'installed':
        btn.classList.add('is-installed');
        btn.disabled = true;
        btn.innerHTML = '<i data-lucide="check-circle-2"></i> Installed';
        break;
      case 'unavailable':
      default:
        btn.classList.add('is-unavailable');
        btn.disabled = true;
        btn.title = 'Installation is not supported in this browser.';
        btn.innerHTML = '<i data-lucide="download"></i> Install Unavailable';
        break;
    }
    if (window.lucide?.createIcons) {
      try { window.lucide.createIcons(); } catch (e) { /* non-fatal */ }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupInstallButton);
  } else {
    setupInstallButton();
  }
})();
