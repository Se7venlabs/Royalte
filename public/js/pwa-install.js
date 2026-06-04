// ─────────────────────────────────────────────────────────────────────────
// Mission Control PWA install handler (Brief 015p Phase 1).
//
// Loaded only from /dashboard.html. The install button + this handler
// exist ONLY inside the authenticated Mission Control surface; the
// marketing pages don't get an install prompt because they don't link
// the mission-control.webmanifest.
//
// Flow:
//   1. Register the service worker (/sw.js — required for Chrome
//      installability).
//   2. Capture beforeinstallprompt on Chrome/Edge/Android, surface the
//      header button, fire the deferred prompt on click.
//   3. iOS Safari doesn't expose programmatic install — it requires
//      Share → Add to Home Screen. The button on iOS opens a one-time
//      hint dialog explaining those two taps. Unavoidable platform
//      limitation, not a design choice.
//   4. After installation (appinstalled event OR detected standalone
//      mode on next visit), the button switches to "Installed ✓" and
//      becomes inert.
// ─────────────────────────────────────────────────────────────────────────

(function () {
  if (typeof window === 'undefined') return;

  let deferredPrompt = null;

  const isStandalone = () =>
    window.matchMedia?.('(display-mode: standalone)').matches ||
    window.navigator.standalone === true;

  const isIOS = () =>
    /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

  // ── Service worker registration ──────────────────────────────────────
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch((err) => {
        console.warn('[pwa] service worker registration failed:', err.message);
      });
    });
  }

  // ── Install button wiring ────────────────────────────────────────────
  function setupInstallButton() {
    const btn = document.getElementById('mc-install-btn');
    if (!btn) return;

    // Already running as an installed app → button is irrelevant.
    if (isStandalone()) {
      markInstalled(btn);
      return;
    }

    // Chrome/Edge/Android — beforeinstallprompt fires once eligible
    // criteria are met (manifest + SW + engagement heuristics).
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredPrompt = e;
      btn.hidden = false;
    });

    // Successful install (any browser that fires the event).
    window.addEventListener('appinstalled', () => {
      deferredPrompt = null;
      markInstalled(btn);
    });

    // iOS Safari path — show the button immediately (the OS can install,
    // just not via a JS prompt) and fall back to the Share-sheet hint.
    if (isIOS()) {
      btn.hidden = false;
      btn.addEventListener('click', showIOSInstructions);
      return;
    }

    // Standard install click handler (Chrome/Edge/Android).
    btn.addEventListener('click', async () => {
      if (!deferredPrompt) {
        // No prompt available — likely already installable but the event
        // hasn't fired yet, or the user dismissed it. Show iOS-style hint
        // as a last resort so the click isn't a no-op.
        showInstallUnavailable();
        return;
      }
      deferredPrompt.prompt();
      try {
        await deferredPrompt.userChoice;
      } catch (e) {
        // user choice rejected — silent
      }
      deferredPrompt = null;
    });
  }

  function markInstalled(btn) {
    btn.classList.add('is-installed');
    btn.disabled = true;
    btn.hidden = false;
    btn.innerHTML = '<i data-lucide="check-circle-2"></i> Installed';
    if (window.lucide?.createIcons) {
      try { window.lucide.createIcons(); } catch (e) { /* non-fatal */ }
    }
  }

  function showIOSInstructions() {
    const dialog = ensureHintDialog();
    dialog.querySelector('.mc-install-hint-title').textContent =
      'Add Mission Control to your Home Screen';
    dialog.querySelector('.mc-install-hint-body').innerHTML =
      'Tap the <strong>Share</strong> button in Safari, ' +
      'then choose <strong>Add to Home Screen</strong>.';
    dialog.classList.add('is-open');
  }

  function showInstallUnavailable() {
    const dialog = ensureHintDialog();
    dialog.querySelector('.mc-install-hint-title').textContent =
      'Install Mission Control';
    dialog.querySelector('.mc-install-hint-body').textContent =
      'Your browser will offer the install prompt shortly. Try again ' +
      'in a moment, or use your browser menu to install the app.';
    dialog.classList.add('is-open');
  }

  function ensureHintDialog() {
    let dialog = document.getElementById('mc-install-hint');
    if (dialog) return dialog;
    dialog = document.createElement('div');
    dialog.id = 'mc-install-hint';
    dialog.className = 'mc-install-hint';
    dialog.innerHTML =
      '<div class="mc-install-hint-inner">' +
      '  <div class="mc-install-hint-title"></div>' +
      '  <div class="mc-install-hint-body"></div>' +
      '  <button class="mc-install-hint-close" type="button">Got it</button>' +
      '</div>';
    document.body.appendChild(dialog);
    dialog.querySelector('.mc-install-hint-close')
      .addEventListener('click', () => dialog.classList.remove('is-open'));
    dialog.addEventListener('click', (e) => {
      if (e.target === dialog) dialog.classList.remove('is-open');
    });
    return dialog;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupInstallButton);
  } else {
    setupInstallButton();
  }
})();
