// ─────────────────────────────────────────────────────────────────────────
// Mission Control PWA install handler (Brief 015p — true-app model).
//
// Three explicit states for the install button, no platform-specific
// instruction modals, no "look for the icon" educational text:
//
//   1. Installed       (green ✓ Installed)
//      app is running standalone OR appinstalled fired
//   2. Ready           (blue Install App, clickable)
//      browser supports beforeinstallprompt AND it has fired
//   3. Pending         (muted blue Install App, disabled)
//      browser supports beforeinstallprompt but it hasn't fired yet
//      (engagement signals pending — Chrome requires interaction
//      before exposing the prompt)
//   4. Unavailable     (gray Install Unavailable, disabled)
//      browser will never fire beforeinstallprompt: iOS Safari,
//      macOS Safari, Firefox, anything non-Chromium
//
// One-click install: clicking the Ready button fires the native
// install dialog immediately. No fallback dialogs, no instructions
// for browsers that can't install. If installation isn't possible,
// the button visibly communicates that — never presented as a
// one-click install that doesn't work.
// ─────────────────────────────────────────────────────────────────────────

(function () {
  if (typeof window === 'undefined') return;

  let deferredPrompt = null;
  const ua = navigator.userAgent || '';

  const isStandalone = () =>
    window.matchMedia?.('(display-mode: standalone)').matches ||
    window.navigator.standalone === true;

  const isIOS = () =>
    /iPad|iPhone|iPod/.test(ua) && !window.MSStream;

  // beforeinstallprompt is a Chromium-family event. iOS Safari, macOS
  // Safari, and Firefox never fire it. We use this to decide whether
  // the button enters Pending or Unavailable state on first paint.
  const supportsBeforeInstallPrompt = () =>
    /Chrome|Chromium|Edg|OPR|SamsungBrowser/.test(ua) && !isIOS();

  // ── Service worker registration (Chrome installability requirement) ──
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch((err) => {
        console.warn('[pwa] service worker registration failed:', err.message);
      });
    });
  }

  // ── Global event listeners ──────────────────────────────────────────
  // The prompt event may fire BEFORE the button is wired up (DOMContentLoaded
  // race), so the listener is registered globally and re-applies state on
  // whichever button instance exists at the time.
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    const btn = document.getElementById('mc-install-btn');
    if (btn && btn.dataset.installState === 'pending') {
      setState(btn, 'ready');
    }
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    const btn = document.getElementById('mc-install-btn');
    if (btn) setState(btn, 'installed');
  });

  // ── Button wiring ───────────────────────────────────────────────────
  function setupInstallButton() {
    const btn = document.getElementById('mc-install-btn');
    if (!btn) return;

    // Decide initial state.
    if (isStandalone()) {
      setState(btn, 'installed');
      return;
    }
    if (!supportsBeforeInstallPrompt()) {
      setState(btn, 'unavailable');
      return;
    }
    // Chromium family — install IS possible; either the prompt has
    // already fired (deferredPrompt set) or it hasn't yet.
    setState(btn, deferredPrompt ? 'ready' : 'pending');

    btn.addEventListener('click', async () => {
      if (btn.dataset.installState !== 'ready' || !deferredPrompt) return;
      deferredPrompt.prompt();
      try { await deferredPrompt.userChoice; } catch (e) { /* dismissed */ }
      deferredPrompt = null;
      // The appinstalled handler will switch to "installed" on accept.
      // On dismiss, browsers typically suppress the prompt for a session —
      // returning the button to "pending" reflects that reality.
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
