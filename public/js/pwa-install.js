// ─────────────────────────────────────────────────────────────────────────
// Mission Control PWA install handler (Brief 015p — always-visible fix).
//
// The install button is a product affordance, NOT a browser event. It
// is always visible from the moment Mission Control renders, except
// when the app is already installed (then "✓ Installed").
//
// Click behavior is adaptive:
//   • If beforeinstallprompt has fired and we have a deferred prompt:
//     trigger the native install dialog.
//   • Otherwise: open a platform-specific hint dialog with the right
//     install path for the user's browser/OS.
//
// This handler lives only inside /dashboard.html — marketing pages
// don't link the manifest and don't load this script.
// ─────────────────────────────────────────────────────────────────────────

(function () {
  if (typeof window === 'undefined') return;

  let deferredPrompt = null;

  const ua = navigator.userAgent || '';
  const isStandalone = () =>
    window.matchMedia?.('(display-mode: standalone)').matches ||
    window.navigator.standalone === true;
  const isIOS = () => /iPad|iPhone|iPod/.test(ua) && !window.MSStream;
  const isAndroid = () => /Android/.test(ua);
  const isFirefox = () => /Firefox/.test(ua);
  const isSafariDesktop = () =>
    /Safari/.test(ua) && !/Chrome|Chromium|Edg|OPR/.test(ua) && !isIOS();
  const isChromiumDesktop = () =>
    /Chrome|Chromium|Edg/.test(ua) && !isIOS() && !isAndroid();

  // ── Service worker registration (Chrome installability requirement) ──
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch((err) => {
        console.warn('[pwa] service worker registration failed:', err.message);
      });
    });
  }

  // ── Capture beforeinstallprompt globally (may or may not fire) ──────
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    const btn = document.getElementById('mc-install-btn');
    if (btn) markInstalled(btn);
  });

  // ── Button wiring ────────────────────────────────────────────────────
  function setupInstallButton() {
    const btn = document.getElementById('mc-install-btn');
    if (!btn) return;

    // Already running standalone → switch to "✓ Installed" state.
    if (isStandalone()) {
      markInstalled(btn);
      return;
    }

    btn.addEventListener('click', async () => {
      // Path 1: native prompt available — fire it.
      if (deferredPrompt) {
        deferredPrompt.prompt();
        try {
          await deferredPrompt.userChoice;
        } catch (e) {
          // user choice rejected/dismissed — silent
        }
        deferredPrompt = null;
        return;
      }
      // Path 2: no native prompt — show platform-specific instructions.
      showPlatformInstructions();
    });
  }

  function markInstalled(btn) {
    btn.classList.add('is-installed');
    btn.disabled = true;
    btn.innerHTML = '<i data-lucide="check-circle-2"></i> Installed';
    if (window.lucide?.createIcons) {
      try { window.lucide.createIcons(); } catch (e) { /* non-fatal */ }
    }
  }

  // ── Platform-specific instructions ───────────────────────────────────
  function showPlatformInstructions() {
    const { title, body } = instructionsForPlatform();
    const dialog = ensureHintDialog();
    dialog.querySelector('.mc-install-hint-title').textContent = title;
    dialog.querySelector('.mc-install-hint-body').innerHTML = body;
    dialog.classList.add('is-open');
  }

  function instructionsForPlatform() {
    if (isIOS()) {
      return {
        title: 'Add Mission Control to your Home Screen',
        body:
          'Tap the <strong>Share</strong> button at the bottom of Safari, ' +
          'then choose <strong>Add to Home Screen</strong>. ' +
          'Mission Control will appear on your home screen like a native app.',
      };
    }
    if (isAndroid()) {
      return {
        title: 'Install Mission Control',
        body:
          'Tap your browser menu (<strong>⋮</strong>), then choose ' +
          '<strong>Install app</strong> or <strong>Add to Home screen</strong>. ' +
          'Mission Control will appear on your home screen like a native app.',
      };
    }
    if (isSafariDesktop()) {
      return {
        title: 'Add Mission Control to your Dock',
        body:
          'In Safari, click <strong>File</strong> → ' +
          '<strong>Add to Dock</strong> (macOS 14+). Mission Control will ' +
          'launch from your Dock like a native app. On older macOS, use ' +
          '<strong>Share</strong> → <strong>Add to Dock</strong>.',
      };
    }
    if (isFirefox()) {
      return {
        title: 'Install Mission Control',
        body:
          'Firefox does not currently support installing this app directly. ' +
          'To install Mission Control as a standalone app, open this page ' +
          'in <strong>Chrome</strong>, <strong>Edge</strong>, or <strong>Safari</strong> ' +
          'and tap the Install button there.',
      };
    }
    if (isChromiumDesktop()) {
      return {
        title: 'Install Mission Control',
        body:
          'Look for the install icon (<strong>⊕</strong>) at the right end of ' +
          'your address bar, or open your browser menu (<strong>⋮</strong>) ' +
          'and choose <strong>Install Royaltē Mission Control</strong>. ' +
          'The install prompt may need a few seconds of engagement before ' +
          'it becomes available.',
      };
    }
    return {
      title: 'Install Mission Control',
      body:
        'Your browser may not support installing this app directly. ' +
        'Try opening Mission Control in <strong>Chrome</strong>, ' +
        '<strong>Edge</strong>, or <strong>Safari</strong> to install it ' +
        'as a standalone app.',
    };
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
