/**
 * CMG Home Loans — Builder Portal Onboarding Tutorial
 * Self-contained IIFE. ES5 compatible. No external dependencies.
 */
(function () {
  'use strict';

  // ──────────────────────────────────────────────────────────────────────────
  // 1. Guard — only run when conditions are met
  // ──────────────────────────────────────────────────────────────────────────
  if (window.location.pathname.indexOf('portal') === -1) return;
  if (!localStorage.getItem('builderAccount')) return;
  if (localStorage.getItem('builderTutorialSeen')) return;

  // ──────────────────────────────────────────────────────────────────────────
  // 2. Constants & step definitions
  // ──────────────────────────────────────────────────────────────────────────
  var TOTAL_STEPS = 7;
  var OVERLAY_Z   = 100000;
  var SPOTLIGHT_PAD = 12;
  var STYLE_ID   = 'cmg-tutorial-styles';
  var CONTAINER_ID = 'cmg-tutorial-container';

  var steps = [
    {
      // Step 1 — welcome modal (no spotlight target)
      target: null,
      position: 'center',
      title: 'Welcome to the Builder Portal',
      body: 'This quick tour will show you everything you need to complete your builder application. It only takes a minute.',
      ariaNote: 'Aria, your AI assistant, is here to help at every step.',
      nextLabel: "Let’s Get Started →"
    },
    {
      // Step 2 — dashboard status card
      target: function () {
        var ring = document.querySelector('[role="progressbar"]');
        return ring ? ring.closest('.bg-white') : null;
      },
      position: 'below',
      title: 'Your Dashboard',
      body: 'Track your application progress here. The progress ring shows how much you’ve completed — it updates as you fill out your application, upload documents, and sign your packet.'
    },
    {
      // Step 3 — Application nav
      target: function () { return document.querySelector('.nav-item[data-nav="application"]'); },
      position: 'right',
      title: 'Builder Application',
      body: 'A 9-section questionnaire covering your company, project details, experience, references, and more. Aria can help you fill in reference information.'
    },
    {
      // Step 4 — Documents nav
      target: function () { return document.querySelector('.nav-item[data-nav="documents"]'); },
      position: 'right',
      title: 'Document Upload',
      body: 'Upload required documents like insurance certificates, contractor license, plans, and construction contract. 12 required documents plus conditionals.'
    },
    {
      // Step 5 — E-Sign nav
      target: function () { return document.querySelector('.nav-item[data-nav="esign"]'); },
      position: 'right',
      title: 'Review & E-Sign',
      body: 'Review your completed application rendered as formal documents, fill out the W-9, and sign everything electronically. ESIGN Act compliant.'
    },
    {
      // Step 6 — Quick Actions card
      target: function () {
        var headings = document.querySelectorAll('h2');
        for (var i = 0; i < headings.length; i++) {
          if (headings[i].textContent.indexOf('Quick Actions') !== -1) {
            return headings[i].closest('.bg-white');
          }
        }
        return null;
      },
      position: 'left',
      title: 'Quick Actions',
      body: 'Jump to any section from here. You can also schedule a consultation with your CMG lending team if you have questions.'
    },
    {
      // Step 7 — Aria FAB
      target: function () { return document.getElementById('aria-fab'); },
      position: 'left',
      title: 'Meet Aria',
      body: 'Your AI assistant is always here to help. Ask Aria to search for reference information, explain requirements, or schedule an appointment. Just click to chat!',
      nextLabel: 'Start Exploring →'
    }
  ];

  // ──────────────────────────────────────────────────────────────────────────
  // 3. State
  // ──────────────────────────────────────────────────────────────────────────
  var currentStep = 0;
  var previousFocus = null;
  var container = null;
  var overlayEl = null;
  var spotlightEl = null;
  var tooltipEl = null;
  var liveRegion = null;
  var resizeTimer = null;

  // ──────────────────────────────────────────────────────────────────────────
  // 4. Inject styles
  // ──────────────────────────────────────────────────────────────────────────
  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var css = [
      // Keyframes
      '@keyframes cmgTutFadeIn { from { opacity: 0; } to { opacity: 1; } }',
      '@keyframes cmgTutFadeOut { from { opacity: 1; } to { opacity: 0; } }',
      '@keyframes cmgTutSlideUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }',
      '@keyframes cmgTutSlideDown { from { opacity: 0; transform: translateY(-12px); } to { opacity: 1; transform: translateY(0); } }',
      '@keyframes cmgTutSlideLeft { from { opacity: 0; transform: translateX(12px); } to { opacity: 1; transform: translateX(0); } }',
      '@keyframes cmgTutSlideRight { from { opacity: 0; transform: translateX(-12px); } to { opacity: 1; transform: translateX(0); } }',
      '@keyframes cmgTutPulse { 0%, 100% { box-shadow: 0 0 0 0 rgba(184,146,74,0.40); } 50% { box-shadow: 0 0 0 6px rgba(184,146,74,0); } }',
      '@keyframes cmgTutScaleIn { from { opacity: 0; transform: scale(0.92); } to { opacity: 1; transform: scale(1); } }',

      // Overlay
      '#cmg-tutorial-container { position: fixed; inset: 0; z-index: ' + OVERLAY_Z + '; pointer-events: auto; }',
      '.cmg-tut-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.55); animation: cmgTutFadeIn 300ms ease forwards; }',
      '.cmg-tut-overlay--out { animation: cmgTutFadeOut 300ms ease forwards; }',

      // Spotlight
      '.cmg-tut-spotlight {',
      '  position: fixed; border-radius: 12px; z-index: ' + (OVERLAY_Z + 1) + ';',
      '  box-shadow: 0 0 0 9999px rgba(0,0,0,0.55);',
      '  transition: top 300ms ease, left 300ms ease, width 300ms ease, height 300ms ease;',
      '  animation: cmgTutPulse 2.4s ease-in-out infinite;',
      '  pointer-events: none;',
      '}',

      // Tooltip card
      '.cmg-tut-tooltip {',
      '  position: fixed; z-index: ' + (OVERLAY_Z + 2) + ';',
      '  background: #FFFFFF; border-radius: 16px; max-width: 340px; width: 340px;',
      '  box-shadow: 0 12px 40px rgba(0,0,0,0.2);',
      '  border-left: 3px solid #B8924A;',
      '  padding: 20px 22px 18px 22px;',
      '  pointer-events: auto;',
      '}',
      '.cmg-tut-tooltip--below { animation: cmgTutSlideUp 200ms ease forwards; }',
      '.cmg-tut-tooltip--above { animation: cmgTutSlideDown 200ms ease forwards; }',
      '.cmg-tut-tooltip--right { animation: cmgTutSlideLeft 200ms ease forwards; }',
      '.cmg-tut-tooltip--left  { animation: cmgTutSlideRight 200ms ease forwards; }',
      '.cmg-tut-tooltip--center { animation: cmgTutScaleIn 300ms ease forwards; }',

      // Arrow (CSS triangle)
      '.cmg-tut-arrow { position: absolute; width: 0; height: 0; }',
      '.cmg-tut-arrow--up { top: -8px; left: 28px; border-left: 8px solid transparent; border-right: 8px solid transparent; border-bottom: 8px solid #FFFFFF; }',
      '.cmg-tut-arrow--down { bottom: -8px; left: 28px; border-left: 8px solid transparent; border-right: 8px solid transparent; border-top: 8px solid #FFFFFF; }',
      '.cmg-tut-arrow--left { left: -8px; top: 20px; border-top: 8px solid transparent; border-bottom: 8px solid transparent; border-right: 8px solid #FFFFFF; }',
      '.cmg-tut-arrow--right { right: -8px; top: 20px; border-top: 8px solid transparent; border-bottom: 8px solid transparent; border-left: 8px solid #FFFFFF; }',

      // Welcome modal
      '.cmg-tut-welcome {',
      '  position: fixed; z-index: ' + (OVERLAY_Z + 2) + ';',
      '  top: 50%; left: 50%; transform: translate(-50%, -50%);',
      '  background: #FFFFFF; border-radius: 20px; max-width: 460px; width: 92%;',
      '  box-shadow: 0 16px 48px rgba(0,0,0,0.22);',
      '  padding: 40px 36px 32px 36px; text-align: center;',
      '  animation: cmgTutScaleIn 300ms ease forwards;',
      '  pointer-events: auto;',
      '}',

      // Step indicator
      '.cmg-tut-step-label {',
      '  font-family: "Geist Mono", ui-monospace, monospace;',
      '  font-size: 10px; text-transform: uppercase; letter-spacing: 0.12em;',
      '  color: #B8924A; margin-bottom: 6px; font-weight: 500;',
      '}',

      // Title
      '.cmg-tut-title {',
      '  font-family: "Fraunces", Georgia, serif; font-size: 18px; font-weight: 600;',
      '  color: #1A1F1B; margin: 0 0 8px 0; line-height: 1.35;',
      '}',
      '.cmg-tut-title--welcome {',
      '  font-family: "Fraunces", Georgia, serif; font-size: 24px; font-weight: 600;',
      '  color: #1A1F1B; margin: 0 0 12px 0; line-height: 1.3; letter-spacing: -0.01em;',
      '}',

      // Body
      '.cmg-tut-body {',
      '  font-family: "Geist", system-ui, sans-serif; font-size: 13.5px;',
      '  color: #4F554E; line-height: 1.6; margin: 0 0 16px 0;',
      '}',

      // Aria note
      '.cmg-tut-aria-note {',
      '  font-family: "Geist", system-ui, sans-serif; font-size: 12px;',
      '  color: #8B8A7E; line-height: 1.5; margin: 0 0 20px 0; font-style: italic;',
      '}',

      // Logo text
      '.cmg-tut-logo {',
      '  font-family: "Fraunces", Georgia, serif; font-size: 15px; font-weight: 600;',
      '  color: #1F3D2E; margin-bottom: 20px; letter-spacing: -0.01em;',
      '}',
      '.cmg-tut-logo span { color: #1A1F1B; font-weight: 400; }',

      // Primary button
      '.cmg-tut-btn {',
      '  display: block; width: 100%; height: 44px; border: none; border-radius: 10px;',
      '  background: #1F3D2E; color: #FFFFFF; font-family: "Geist", system-ui, sans-serif;',
      '  font-size: 14px; font-weight: 600; cursor: pointer; letter-spacing: -0.005em;',
      '  transition: background 150ms ease;',
      '}',
      '.cmg-tut-btn:hover { background: #2A4F3D; }',
      '.cmg-tut-btn:focus { outline: 2px solid #B8924A; outline-offset: 2px; }',

      // Skip link
      '.cmg-tut-skip {',
      '  display: inline-block; margin-top: 12px; border: none; background: none;',
      '  font-family: "Geist", system-ui, sans-serif; font-size: 12px; color: #8B8A7E;',
      '  cursor: pointer; text-decoration: none; padding: 4px 8px; border-radius: 4px;',
      '  transition: color 150ms ease;',
      '}',
      '.cmg-tut-skip:hover { color: #4F554E; }',
      '.cmg-tut-skip:focus { outline: 2px solid #B8924A; outline-offset: 2px; }',

      // Progress dots
      '.cmg-tut-dots { display: flex; justify-content: center; gap: 6px; margin-top: 14px; }',
      '.cmg-tut-dot {',
      '  width: 7px; height: 7px; border-radius: 50%; background: #ECE6D8;',
      '  transition: background 200ms ease;',
      '}',
      '.cmg-tut-dot--active { background: #1F3D2E; }',

      // Gold divider for welcome card
      '.cmg-tut-divider { width: 40px; height: 2px; background: #B8924A; border-radius: 2px; margin: 0 auto 20px auto; }',

      // Live region (visually hidden)
      '.cmg-tut-sr-only {',
      '  position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;',
      '  overflow: hidden; clip: rect(0,0,0,0); border: 0;',
      '}'
    ].join('\n');

    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.type = 'text/css';
    style.appendChild(document.createTextNode(css));
    document.head.appendChild(style);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 5. DOM helpers
  // ──────────────────────────────────────────────────────────────────────────
  function el(tag, className, attrs) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (attrs) {
      for (var k in attrs) {
        if (attrs.hasOwnProperty(k)) {
          node.setAttribute(k, attrs[k]);
        }
      }
    }
    return node;
  }

  function removeNode(node) {
    if (node && node.parentNode) node.parentNode.removeChild(node);
  }

  function resolveTarget(step) {
    var def = steps[step];
    if (!def || !def.target) return null;
    return typeof def.target === 'function' ? def.target() : def.target;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 6. Build progress dots
  // ──────────────────────────────────────────────────────────────────────────
  function buildDots(active) {
    var wrapper = el('div', 'cmg-tut-dots');
    wrapper.setAttribute('aria-hidden', 'true');
    for (var i = 0; i < TOTAL_STEPS; i++) {
      var dot = el('span', 'cmg-tut-dot' + (i === active ? ' cmg-tut-dot--active' : ''));
      wrapper.appendChild(dot);
    }
    return wrapper;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 7. Welcome modal (step 1)
  // ──────────────────────────────────────────────────────────────────────────
  function showWelcome() {
    var card = el('div', 'cmg-tut-welcome', {
      'role': 'alertdialog',
      'aria-modal': 'true',
      'aria-label': 'Welcome to the Builder Portal'
    });

    // Logo
    var logo = el('div', 'cmg-tut-logo');
    logo.innerHTML = 'CMG <span>Home Loans</span>';
    card.appendChild(logo);

    // Divider
    card.appendChild(el('div', 'cmg-tut-divider'));

    // Title
    var title = el('h2', 'cmg-tut-title--welcome');
    title.textContent = steps[0].title;
    card.appendChild(title);

    // Body
    var body = el('p', 'cmg-tut-body');
    body.textContent = steps[0].body;
    card.appendChild(body);

    // Aria note
    var note = el('p', 'cmg-tut-aria-note');
    note.textContent = steps[0].ariaNote;
    card.appendChild(note);

    // CTA button
    var btn = el('button', 'cmg-tut-btn');
    btn.textContent = steps[0].nextLabel;
    btn.setAttribute('type', 'button');
    btn.addEventListener('click', function () { goToStep(1); });
    card.appendChild(btn);

    // Skip
    var skip = el('button', 'cmg-tut-skip');
    skip.textContent = 'Skip tour';
    skip.setAttribute('type', 'button');
    skip.addEventListener('click', function () { completeTour(); });
    card.appendChild(skip);

    // Dots
    card.appendChild(buildDots(0));

    container.appendChild(card);
    tooltipEl = card;

    btn.focus();
    trapFocus(card);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 8. Spotlight + tooltip (steps 2-7)
  // ──────────────────────────────────────────────────────────────────────────
  function showSpotlightStep(stepIndex) {
    var def = steps[stepIndex];
    var target = resolveTarget(stepIndex);

    if (!target) {
      // Skip missing targets
      if (stepIndex < TOTAL_STEPS - 1) {
        goToStep(stepIndex + 1);
      } else {
        completeTour();
      }
      return;
    }

    // Scroll target into view if necessary
    target.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

    // Give the browser a moment to finish scrolling
    setTimeout(function () {
      positionSpotlight(target);
      showTooltip(stepIndex, target, def);
      announceStep(stepIndex);
    }, 80);
  }

  function positionSpotlight(target) {
    var rect = target.getBoundingClientRect();

    if (!spotlightEl) {
      spotlightEl = el('div', 'cmg-tut-spotlight');
      container.appendChild(spotlightEl);
    }

    spotlightEl.style.top    = (rect.top - SPOTLIGHT_PAD) + 'px';
    spotlightEl.style.left   = (rect.left - SPOTLIGHT_PAD) + 'px';
    spotlightEl.style.width  = (rect.width + SPOTLIGHT_PAD * 2) + 'px';
    spotlightEl.style.height = (rect.height + SPOTLIGHT_PAD * 2) + 'px';
  }

  function showTooltip(stepIndex, target, def) {
    // Remove previous tooltip
    removeNode(tooltipEl);

    var card = el('div', 'cmg-tut-tooltip cmg-tut-tooltip--' + def.position, {
      'role': 'alertdialog',
      'aria-modal': 'true',
      'aria-label': def.title
    });

    // Arrow
    var arrowDir = '';
    if (def.position === 'below') arrowDir = 'up';
    else if (def.position === 'above') arrowDir = 'down';
    else if (def.position === 'right') arrowDir = 'left';
    else if (def.position === 'left') arrowDir = 'right';

    if (arrowDir) {
      card.appendChild(el('div', 'cmg-tut-arrow cmg-tut-arrow--' + arrowDir));
    }

    // Step label
    var label = el('div', 'cmg-tut-step-label');
    label.textContent = 'Step ' + (stepIndex + 1) + ' of ' + TOTAL_STEPS;
    card.appendChild(label);

    // Title
    var title = el('h3', 'cmg-tut-title');
    title.textContent = def.title;
    card.appendChild(title);

    // Body
    var body = el('p', 'cmg-tut-body');
    body.textContent = def.body;
    card.appendChild(body);

    // Next / finish button
    var btn = el('button', 'cmg-tut-btn');
    btn.setAttribute('type', 'button');
    var isLast = stepIndex === TOTAL_STEPS - 1;
    btn.textContent = def.nextLabel || 'Next →';
    btn.addEventListener('click', function () {
      if (isLast) {
        completeTour();
      } else {
        goToStep(stepIndex + 1);
      }
    });
    card.appendChild(btn);

    // Skip
    var skip = el('button', 'cmg-tut-skip');
    skip.textContent = 'Skip tour';
    skip.setAttribute('type', 'button');
    skip.addEventListener('click', function () { completeTour(); });
    card.appendChild(skip);

    // Dots
    card.appendChild(buildDots(stepIndex));

    container.appendChild(card);
    tooltipEl = card;

    // Position tooltip relative to spotlight
    positionTooltipNear(card, target, def.position);

    btn.focus();
    trapFocus(card);
  }

  function positionTooltipNear(tooltip, target, position) {
    var rect = target.getBoundingClientRect();
    var vw = window.innerWidth;
    var vh = window.innerHeight;

    // Reset for measurement
    tooltip.style.top = '0px';
    tooltip.style.left = '0px';
    tooltip.style.right = 'auto';

    var tw = tooltip.offsetWidth;
    var th = tooltip.offsetHeight;

    var top = 0;
    var left = 0;
    var gap = 16;

    if (position === 'below') {
      top  = rect.bottom + SPOTLIGHT_PAD + gap;
      left = rect.left + (rect.width / 2) - (tw / 2);
    } else if (position === 'above') {
      top  = rect.top - SPOTLIGHT_PAD - gap - th;
      left = rect.left + (rect.width / 2) - (tw / 2);
    } else if (position === 'right') {
      top  = rect.top + (rect.height / 2) - (th / 2);
      left = rect.right + SPOTLIGHT_PAD + gap;
    } else if (position === 'left') {
      top  = rect.top + (rect.height / 2) - (th / 2);
      left = rect.left - SPOTLIGHT_PAD - gap - tw;
    }

    // Clamp to viewport
    if (left < 12) left = 12;
    if (left + tw > vw - 12) left = vw - 12 - tw;
    if (top < 12) top = 12;
    if (top + th > vh - 12) top = vh - 12 - th;

    tooltip.style.top  = Math.round(top) + 'px';
    tooltip.style.left = Math.round(left) + 'px';

    // Reposition arrow on the tooltip if we clamped
    var arrow = tooltip.querySelector('.cmg-tut-arrow');
    if (arrow) {
      if (position === 'below' || position === 'above') {
        var arrowLeft = (rect.left + rect.width / 2) - left - 8;
        arrowLeft = Math.max(16, Math.min(arrowLeft, tw - 32));
        arrow.style.left = Math.round(arrowLeft) + 'px';
      } else if (position === 'right' || position === 'left') {
        var arrowTop = (rect.top + rect.height / 2) - top - 8;
        arrowTop = Math.max(12, Math.min(arrowTop, th - 28));
        arrow.style.top = Math.round(arrowTop) + 'px';
      }
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 9. Navigation between steps
  // ──────────────────────────────────────────────────────────────────────────
  function goToStep(stepIndex) {
    // Clean up current tooltip
    removeNode(tooltipEl);
    tooltipEl = null;

    currentStep = stepIndex;

    if (stepIndex === 0) {
      removeNode(spotlightEl);
      spotlightEl = null;
      showWelcome();
    } else {
      showSpotlightStep(stepIndex);
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 10. Tour lifecycle
  // ──────────────────────────────────────────────────────────────────────────
  function startTour() {
    previousFocus = document.activeElement;

    injectStyles();

    // Container
    container = el('div', '', { 'id': CONTAINER_ID });
    document.body.appendChild(container);

    // Overlay
    overlayEl = el('div', 'cmg-tut-overlay', {
      'role': 'dialog',
      'aria-modal': 'true',
      'aria-label': 'Builder Portal Tour'
    });
    overlayEl.addEventListener('click', function (e) {
      if (e.target === overlayEl) {
        // Click on overlay does nothing (don't close on outside click)
      }
    });
    container.appendChild(overlayEl);

    // Live region for screen readers
    liveRegion = el('div', 'cmg-tut-sr-only', {
      'aria-live': 'polite',
      'aria-atomic': 'true',
      'role': 'status'
    });
    container.appendChild(liveRegion);

    // Keyboard handler
    document.addEventListener('keydown', onKeyDown);

    // Resize handler
    window.addEventListener('resize', onResize);

    // Start at step 0
    goToStep(0);
  }

  function completeTour() {
    localStorage.setItem('builderTutorialSeen', 'true');
    cleanup();
  }

  function cleanup() {
    document.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('resize', onResize);

    // Fade out overlay
    if (overlayEl) {
      overlayEl.className = 'cmg-tut-overlay cmg-tut-overlay--out';
    }

    // Remove elements after fade
    setTimeout(function () {
      removeNode(container);
      container = null;
      overlayEl = null;
      spotlightEl = null;
      tooltipEl = null;
      liveRegion = null;

      var styleEl = document.getElementById(STYLE_ID);
      removeNode(styleEl);

      // Restore focus
      if (previousFocus && typeof previousFocus.focus === 'function') {
        previousFocus.focus();
      }
    }, 320);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 11. Keyboard handling
  // ──────────────────────────────────────────────────────────────────────────
  function onKeyDown(e) {
    if (e.key === 'Escape' || e.keyCode === 27) {
      e.preventDefault();
      completeTour();
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 12. Focus trap
  // ──────────────────────────────────────────────────────────────────────────
  function trapFocus(el) {
    var focusable = el.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    if (focusable.length === 0) return;

    var first = focusable[0];
    var last = focusable[focusable.length - 1];

    // Remove previous trap handler if any
    if (el._trapHandler) {
      el.removeEventListener('keydown', el._trapHandler);
    }

    el._trapHandler = function (e) {
      if (e.key !== 'Tab' && e.keyCode !== 9) return;

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    el.addEventListener('keydown', el._trapHandler);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 13. Resize handler
  // ──────────────────────────────────────────────────────────────────────────
  function onResize() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      if (currentStep === 0 || !container) return;

      var target = resolveTarget(currentStep);
      if (!target) return;

      positionSpotlight(target);
      if (tooltipEl) {
        positionTooltipNear(tooltipEl, target, steps[currentStep].position);
      }
    }, 100);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 14. Live region announcements
  // ──────────────────────────────────────────────────────────────────────────
  function announceStep(stepIndex) {
    if (!liveRegion) return;
    var def = steps[stepIndex];
    liveRegion.textContent = 'Step ' + (stepIndex + 1) + ' of ' + TOTAL_STEPS + ': ' + def.title + '. ' + def.body;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 15. Resolve steps that need waiting (Aria FAB)
  // ──────────────────────────────────────────────────────────────────────────
  function resolveStepsAndStart() {
    // Build the list of valid steps by checking that non-null targets exist.
    // For step 7 (index 6) — Aria FAB — wait up to 2 seconds if it hasn't loaded.
    var ariaTarget = resolveTarget(6);
    if (!ariaTarget) {
      waitForAriaFab(0);
    } else {
      checkAllTargetsAndStart();
    }
  }

  function waitForAriaFab(elapsed) {
    if (elapsed >= 2000) {
      checkAllTargetsAndStart();
      return;
    }
    setTimeout(function () {
      var fab = document.getElementById('aria-fab');
      if (fab) {
        checkAllTargetsAndStart();
      } else {
        waitForAriaFab(elapsed + 200);
      }
    }, 200);
  }

  function checkAllTargetsAndStart() {
    // Check if at least one spotlight step has a valid target
    var hasAny = false;
    for (var i = 1; i < TOTAL_STEPS; i++) {
      if (resolveTarget(i)) {
        hasAny = true;
        break;
      }
    }

    if (!hasAny) {
      // No targets found at all — show only welcome modal then complete
      injectStyles();
      container = el('div', '', { 'id': CONTAINER_ID });
      document.body.appendChild(container);
      overlayEl = el('div', 'cmg-tut-overlay', {
        'role': 'dialog',
        'aria-modal': 'true',
        'aria-label': 'Builder Portal Tour'
      });
      container.appendChild(overlayEl);
      liveRegion = el('div', 'cmg-tut-sr-only', {
        'aria-live': 'polite',
        'aria-atomic': 'true',
        'role': 'status'
      });
      container.appendChild(liveRegion);
      document.addEventListener('keydown', onKeyDown);

      // Override steps[0] next to complete tour
      var card = el('div', 'cmg-tut-welcome', {
        'role': 'alertdialog',
        'aria-modal': 'true',
        'aria-label': 'Welcome to the Builder Portal'
      });

      var logo = el('div', 'cmg-tut-logo');
      logo.innerHTML = 'CMG <span>Home Loans</span>';
      card.appendChild(logo);
      card.appendChild(el('div', 'cmg-tut-divider'));

      var title = el('h2', 'cmg-tut-title--welcome');
      title.textContent = steps[0].title;
      card.appendChild(title);

      var body = el('p', 'cmg-tut-body');
      body.textContent = steps[0].body;
      card.appendChild(body);

      var note = el('p', 'cmg-tut-aria-note');
      note.textContent = steps[0].ariaNote;
      card.appendChild(note);

      var btn = el('button', 'cmg-tut-btn');
      btn.textContent = 'Start Exploring →';
      btn.setAttribute('type', 'button');
      btn.addEventListener('click', function () { completeTour(); });
      card.appendChild(btn);

      container.appendChild(card);
      tooltipEl = card;
      previousFocus = document.activeElement;
      btn.focus();
      trapFocus(card);
      return;
    }

    startTour();
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 16. Boot — 800ms delay after page load
  // ──────────────────────────────────────────────────────────────────────────
  function boot() {
    setTimeout(function () {
      resolveStepsAndStart();
    }, 800);
  }

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    boot();
  } else {
    document.addEventListener('DOMContentLoaded', boot);
  }
})();
