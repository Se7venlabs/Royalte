/* =================================================================
   ROYALTĒ — FAQ ACCORDION SYSTEM
   - Smooth expand/collapse with measured heights (no max-height: 9999px hack)
   - One-open-at-a-time within each category, but each category independent
   - Keyboard accessible (Enter / Space toggles)
   - aria-expanded mirroring for screen readers
   - Deep-linking via #hash to auto-open + scroll to a question
   ================================================================= */

(function () {
  'use strict';

  const ITEM_SELECTOR = '[data-item]';
  const TRIGGER_SELECTOR = '[data-trigger]';
  const PANEL_SELECTOR = '[data-panel]';
  const ACCORDION_SELECTOR = '[data-accordion]';
  const OPEN_CLASS = 'is-open';

  // ---------- Open / close primitives ----------

  function openItem(item) {
    const trigger = item.querySelector(TRIGGER_SELECTOR);
    const panel = item.querySelector(PANEL_SELECTOR);
    if (!trigger || !panel) return;

    item.classList.add(OPEN_CLASS);
    trigger.setAttribute('aria-expanded', 'true');

    // Measure the panel's natural height for smooth animation
    const targetHeight = panel.scrollHeight;
    panel.style.maxHeight = targetHeight + 'px';

    // After the transition, allow the panel to reflow naturally
    // (handles content reflow if window resizes while open)
    panel.addEventListener('transitionend', function handleEnd(e) {
      if (e.propertyName !== 'max-height') return;
      if (item.classList.contains(OPEN_CLASS)) {
        panel.style.maxHeight = 'none';
      }
      panel.removeEventListener('transitionend', handleEnd);
    });
  }

  function closeItem(item) {
    const trigger = item.querySelector(TRIGGER_SELECTOR);
    const panel = item.querySelector(PANEL_SELECTOR);
    if (!trigger || !panel) return;

    // If currently auto-height, snap to measured pixel height before transitioning to 0
    // (max-height transitions don't work from "none" → "0")
    if (panel.style.maxHeight === 'none' || panel.style.maxHeight === '') {
      panel.style.maxHeight = panel.scrollHeight + 'px';
      // Force reflow so the next style change is seen as a transition
      void panel.offsetHeight;
    }

    item.classList.remove(OPEN_CLASS);
    trigger.setAttribute('aria-expanded', 'false');
    panel.style.maxHeight = '0px';
  }

  function toggleItem(item) {
    if (item.classList.contains(OPEN_CLASS)) {
      closeItem(item);
    } else {
      // Within the same accordion, close any open siblings
      const accordion = item.closest(ACCORDION_SELECTOR);
      if (accordion) {
        accordion.querySelectorAll('.' + OPEN_CLASS).forEach((sibling) => {
          if (sibling !== item) closeItem(sibling);
        });
      }
      openItem(item);
    }
  }

  // ---------- Wire up triggers ----------

  function init() {
    const triggers = document.querySelectorAll(TRIGGER_SELECTOR);

    triggers.forEach((trigger) => {
      const item = trigger.closest(ITEM_SELECTOR);
      const panel = item ? item.querySelector(PANEL_SELECTOR) : null;
      if (!item || !panel) return;

      // Make sure aria state matches initial DOM state
      const initiallyOpen = item.classList.contains(OPEN_CLASS);
      trigger.setAttribute('aria-expanded', initiallyOpen ? 'true' : 'false');

      // Click toggle
      trigger.addEventListener('click', (e) => {
        e.preventDefault();
        toggleItem(item);
      });

      // Keyboard: native button handles Enter/Space, but ensure we don't double-fire
      // (no extra handler needed — buttons are accessible by default)
    });

    // Re-measure open panels on window resize so content reflow doesn't
    // leave them clipped or with stale max-height
    let resizeTimer = null;
    window.addEventListener('resize', () => {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        document.querySelectorAll('.' + OPEN_CLASS).forEach((item) => {
          const panel = item.querySelector(PANEL_SELECTOR);
          if (panel && panel.style.maxHeight === 'none') {
            // Keep it natural — no action needed
          }
        });
      }, 150);
    });

    // Deep-linking: if URL has #hash matching an item id or a known question,
    // open it and scroll into view
    handleDeepLink();
    window.addEventListener('hashchange', handleDeepLink);

    // Reveal on scroll (subtle fade-in for category blocks)
    setupScrollReveal();
  }

  // ---------- Deep linking (#some-question-id) ----------

  function handleDeepLink() {
    const hash = window.location.hash;
    if (!hash || hash.length < 2) return;

    const target = document.querySelector(hash);
    if (!target) return;

    const item = target.closest(ITEM_SELECTOR);
    if (item && !item.classList.contains(OPEN_CLASS)) {
      openItem(item);
    }

    // Smooth scroll, accounting for sticky header
    setTimeout(() => {
      const headerOffset = 90;
      const elementTop = (item || target).getBoundingClientRect().top + window.pageYOffset;
      window.scrollTo({
        top: elementTop - headerOffset,
        behavior: 'smooth'
      });
    }, 60);
  }

  // ---------- Scroll reveal (lightweight intersection observer) ----------

  function setupScrollReveal() {
    if (!('IntersectionObserver' in window)) return;

    const targets = document.querySelectorAll('.faq-category, .trust-card');
    if (!targets.length) return;

    targets.forEach((el) => {
      el.style.opacity = '0';
      el.style.transform = 'translateY(16px)';
      el.style.transition = 'opacity 0.7s cubic-bezier(0.16, 1, 0.3, 1), transform 0.7s cubic-bezier(0.16, 1, 0.3, 1)';
    });

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.style.opacity = '1';
          entry.target.style.transform = 'translateY(0)';
          observer.unobserve(entry.target);
        }
      });
    }, {
      rootMargin: '0px 0px -10% 0px',
      threshold: 0.08
    });

    targets.forEach((el) => observer.observe(el));
  }

  // ---------- Boot ----------

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
