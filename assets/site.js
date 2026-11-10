/* ============================================================
   staged.ai — site interactions
   Reveal lens · split dissolve · scroll reveal · single-select ·
   mobile nav · cookie consent (GTM/Clarity/GA4 gated) · Formspree
   Italian primary, English under /en/ (lang read from <html lang>).
   ============================================================ */
(function () {
  'use strict';

  var EN = document.documentElement.lang === 'en';

  /* ---------- analytics IDs (README §13) ---------- */
  var GTM_ID = 'GTM-MX9H34XN';      // tag manager (Clarity/other tags)
  var GA4_ID = 'G-0QMKLSND59';      // GA4 property for the institutional site
  var CLARITY_ID = 'wifg72oiw0';
  var CONSENT_KEY = 'hs_cookie_consent';
  var CONSENT_VERSION = 1;

  /* ============================================================
     1 · NAV — mobile burger + dropdown
     ============================================================ */
  function initNav() {
    var burger = document.querySelector('.nav-burger');
    var nav = document.querySelector('.topbar .nav');
    if (burger && nav) {
      burger.addEventListener('click', function () {
        nav.classList.toggle('nav--mobile');
      });
    }
    var dds = document.querySelectorAll('.nav-dd');
    dds.forEach(function (el) {
      var toggle = el.querySelector('.nav-dd__toggle');
      if (!toggle) return;
      toggle.addEventListener('click', function (e) {
        e.preventDefault(); e.stopPropagation();
        var open = el.getAttribute('data-open') === 'true';
        dds.forEach(function (o) { o.setAttribute('data-open', 'false'); });
        el.setAttribute('data-open', open ? 'false' : 'true');
      });
    });
    document.addEventListener('click', function () {
      dds.forEach(function (o) { o.setAttribute('data-open', 'false'); });
    });
  }

  /* ============================================================
     2 · SINGLE-SELECT CHIP GROUPS (studio demo)
     ============================================================ */
  function initSingleSelect() {
    document.querySelectorAll('[data-single]').forEach(function (group) {
      group.addEventListener('click', function (e) {
        var btn = e.target.closest('button');
        if (!btn || !group.contains(btn)) return;
        group.querySelectorAll('button').forEach(function (b) { b.setAttribute('aria-pressed', String(b === btn)); });
      });
    });
  }

  /* ============================================================
     3 · ANIMATED MASK REVEAL LENS (creative before/after)
     ============================================================ */
  function initLens() {
    document.querySelectorAll('.lens').forEach(function (lens) {
      var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
      var active = false, open = false;
      var t = (parseInt(lens.getAttribute('data-seed') || '0', 10) % 10) || 3;
      var last = performance.now();

      function set(x, y, r) {
        if (x != null) lens.style.setProperty('--lx', x + '%');
        if (y != null) lens.style.setProperty('--ly', y + '%');
        if (r != null) lens.style.setProperty('--lr', r + '%');
      }
      function point(e) {
        if (open) return;
        var p = e.touches ? e.touches[0] : e;
        var rct = lens.getBoundingClientRect();
        var x = ((p.clientX - rct.left) / rct.width) * 100;
        var y = ((p.clientY - rct.top) / rct.height) * 100;
        active = true; lens.classList.add('is-touched');
        set(Math.max(0, Math.min(100, x)), Math.max(0, Math.min(100, y)), 30);
      }
      lens.addEventListener('mousemove', point);
      lens.addEventListener('touchmove', function (e) { point(e); if (e.cancelable) e.preventDefault(); }, { passive: false });
      lens.addEventListener('touchstart', point, { passive: true });
      lens.addEventListener('mouseleave', function () { active = false; });

      function loop(now) {
        var dt = Math.min(0.05, (now - last) / 1000); last = now;
        if (!active && !open && !reduce) {
          t += dt;
          set(50 + 27 * Math.sin(t * 0.55), 45 + 17 * Math.sin(t * 0.83 + 1.1), 30);
        }
        requestAnimationFrame(loop);
      }
      if (!reduce) requestAnimationFrame(loop); else set(50, 46, 30);

      var btn = lens.querySelector('.lens__toggle');
      if (btn) {
        btn.addEventListener('click', function (e) {
          e.stopPropagation();
          open = !open; lens.classList.add('is-touched');
          if (open) set(50, 50, 150); else set(56, 46, 30);
          btn.textContent = open ? (EN ? 'Show lens' : 'Mostra lente') : (EN ? 'Reveal all' : 'Rivela tutto');
        });
      }
    });
  }

  /* ============================================================
     4 · SPLIT / DISSOLVE (hands-free loop)
     ============================================================ */
  function initSplit() {
    document.querySelectorAll('.ba-split').forEach(function (sp) {
      if (matchMedia('(prefers-reduced-motion: reduce)').matches) { sp.classList.add('is-after'); return; }
      var on = false;
      setInterval(function () { on = !on; sp.classList.toggle('is-after', on); }, 2600);
    });
  }

  /* ============================================================
     5 · REVEAL ON SCROLL
     ============================================================ */
  function initReveal() {
    if (!('IntersectionObserver' in window)) {
      document.querySelectorAll('.reveal').forEach(function (el) { el.classList.add('in'); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
    document.querySelectorAll('.reveal').forEach(function (el) { io.observe(el); });
  }

  /* ============================================================
     6 · ANALYTICS LOADERS — only after consent
     ============================================================ */
  function loadGTM() {
    if (window._gtmLoaded) return; window._gtmLoaded = true;
    (function (w, d, s, l, i) {
      w[l] = w[l] || []; w[l].push({ 'gtm.start': new Date().getTime(), event: 'gtm.js' });
      var f = d.getElementsByTagName(s)[0], j = d.createElement(s), dl = l != 'dataLayer' ? '&l=' + l : '';
      j.async = true; j.src = 'https://www.googletagmanager.com/gtm.js?id=' + i + dl;
      f.parentNode.insertBefore(j, f);
    })(window, document, 'script', 'dataLayer', GTM_ID);
    var ns = document.createElement('noscript');
    var ifr = document.createElement('iframe');
    ifr.src = 'https://www.googletagmanager.com/ns.html?id=' + GTM_ID;
    ifr.height = '0'; ifr.width = '0'; ifr.style.display = 'none'; ifr.style.visibility = 'hidden';
    ns.appendChild(ifr); document.body.appendChild(ns);
  }
  function loadClarity() {
    if (window._clarityLoaded) return; window._clarityLoaded = true;
    (function (c, l, a, r, i, t, y) {
      c[a] = c[a] || function () { (c[a].q = c[a].q || []).push(arguments); };
      t = l.createElement(r); t.async = 1; t.src = 'https://www.clarity.ms/tag/' + i;
      y = l.getElementsByTagName(r)[0]; y.parentNode.insertBefore(t, y);
    })(window, document, 'clarity', 'script', CLARITY_ID);
  }
  function loadGA4() {
    if (window._ga4Loaded) return; window._ga4Loaded = true;
    var s = document.createElement('script'); s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA4_ID;
    document.head.appendChild(s);
    window.dataLayer = window.dataLayer || [];
    window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };
    window.gtag('js', new Date());
    window.gtag('config', GA4_ID);
  }
  function enableAnalytics() { loadGTM(); loadGA4(); loadClarity(); }

  /* ============================================================
     7 · CONSENT STATE + BANNER + MODAL
     ============================================================ */
  function readConsent() {
    try { var c = JSON.parse(localStorage.getItem(CONSENT_KEY)); return (c && c.v === CONSENT_VERSION) ? c : null; }
    catch (e) { return null; }
  }
  function saveConsent(analytics) {
    var c = { v: CONSENT_VERSION, analytics: !!analytics, ts: new Date().toISOString() };
    try { localStorage.setItem(CONSENT_KEY, JSON.stringify(c)); } catch (e) {}
    return c;
  }

  var T = EN ? {
    bannerText: 'We use technical cookies (always on) and, with your consent, analytics cookies (Google Analytics and Microsoft Clarity) to improve the site. Details in the ',
    cookiePolicy: 'Cookie Policy', cookieHref: 'cookie-policy.html',
    acceptAll: 'Accept all', techOnly: 'Technical only', customize: 'Customise',
    prefTitle: 'Cookie preferences',
    prefIntro: 'Choose which categories to enable. Technical cookies are required for the site to work and cannot be turned off.',
    techName: 'Technical cookies', techDesc: 'Required for navigation and security. Always on.',
    anName: 'Analytics cookies', anDesc: 'Google Analytics 4 (via GTM) and Microsoft Clarity. Anonymous, aggregated usage statistics.',
    cancel: 'Cancel', save: 'Save preferences'
  } : {
    bannerText: 'Usiamo cookie tecnici (sempre attivi) e, con il tuo consenso, cookie analitici (Google Analytics e Microsoft Clarity) per migliorare il sito. Dettagli nella ',
    cookiePolicy: 'Cookie Policy', cookieHref: 'cookie-policy.html',
    acceptAll: 'Accetta tutto', techOnly: 'Solo tecnici', customize: 'Personalizza',
    prefTitle: 'Preferenze cookie',
    prefIntro: 'Scegli quali categorie attivare. I cookie tecnici sono necessari al funzionamento del sito e non possono essere disattivati.',
    techName: 'Cookie tecnici', techDesc: 'Necessari per la navigazione e la sicurezza. Sempre attivi.',
    anName: 'Cookie analitici', anDesc: 'Google Analytics 4 (via GTM) e Microsoft Clarity. Statistiche di utilizzo anonime e aggregate.',
    cancel: 'Annulla', save: 'Salva preferenze'
  };
  // EN pages live under /en/, so cookie-policy is a sibling there too
  var ckHref = (location.pathname.indexOf('/en/') !== -1) ? 'cookie-policy.html' : 'cookie-policy.html';

  function buildBanner() {
    var b = document.createElement('div');
    b.className = 'ck-banner'; b.setAttribute('role', 'dialog'); b.setAttribute('aria-label', T.prefTitle);
    b.innerHTML =
      '<p>' + T.bannerText + '<a href="' + ckHref + '">' + T.cookiePolicy + '</a>.</p>' +
      '<div class="ck-actions">' +
      '<button class="btn btn--primary btn--sm" data-ck="all">' + T.acceptAll + '</button>' +
      '<button class="btn btn--outline btn--sm" data-ck="tech">' + T.techOnly + '</button>' +
      '<button class="ck-link" data-ck="custom">' + T.customize + '</button>' +
      '</div>';
    document.body.appendChild(b);
    b.addEventListener('click', function (e) {
      var act = e.target.getAttribute('data-ck');
      if (act === 'all') { saveConsent(true); enableAnalytics(); removeBanner(); }
      else if (act === 'tech') { saveConsent(false); removeBanner(); }
      else if (act === 'custom') { removeBanner(); openModal(); }
    });
    window._ckBanner = b;
  }
  function removeBanner() {
    if (window._ckBanner && window._ckBanner.parentNode) { window._ckBanner.parentNode.removeChild(window._ckBanner); window._ckBanner = null; }
  }
  function buildModal() {
    if (window._ckModal) return window._ckModal;
    var current = readConsent();
    var checked = current && current.analytics ? 'checked' : '';
    var ov = document.createElement('div');
    ov.className = 'ck-overlay';
    ov.innerHTML =
      '<div class="ck-modal" role="dialog" aria-modal="true" aria-label="' + T.prefTitle + '">' +
      '<h3>' + T.prefTitle + '</h3><p>' + T.prefIntro + '</p>' +
      '<div class="ck-toggle"><div class="t-text"><strong>' + T.techName + '</strong><span>' + T.techDesc + '</span></div>' +
      '<label class="ck-switch"><input type="checkbox" checked disabled><span class="track"></span></label></div>' +
      '<div class="ck-toggle"><div class="t-text"><strong>' + T.anName + '</strong><span>' + T.anDesc + '</span></div>' +
      '<label class="ck-switch"><input type="checkbox" id="ck-analytics" ' + checked + '><span class="track"></span></label></div>' +
      '<div class="ck-modal-actions">' +
      '<button class="btn btn--outline btn--sm" data-ck="cancel">' + T.cancel + '</button>' +
      '<button class="btn btn--primary btn--sm" data-ck="save">' + T.save + '</button>' +
      '</div></div>';
    document.body.appendChild(ov);
    ov.addEventListener('click', function (e) {
      var act = e.target.getAttribute('data-ck');
      if (e.target === ov || act === 'cancel') { closeModal(); }
      else if (act === 'save') { var on = document.getElementById('ck-analytics').checked; saveConsent(on); if (on) enableAnalytics(); closeModal(); }
    });
    window._ckModal = ov; return ov;
  }
  function openModal() { buildModal().classList.add('show'); }
  function closeModal() { if (window._ckModal) window._ckModal.classList.remove('show'); }
  window.openCookieSettings = function () { openModal(); };

  function initConsent() {
    var c = readConsent();
    if (c) { if (c.analytics) enableAnalytics(); }
    else { buildBanner(); }
  }

  /* ============================================================
     8 · FORMSPREE — AJAX submit + validation + feedback
     ============================================================ */
  function ensureMsg(form) {
    var m = form.querySelector('.form-msg');
    if (!m) { m = document.createElement('div'); m.className = 'form-msg'; form.appendChild(m); }
    return m;
  }
  function showMsg(form, text, isErr) {
    var m = ensureMsg(form); m.textContent = text; m.className = 'form-msg show ' + (isErr ? 'err' : 'ok');
  }
  function initForms() {
    document.querySelectorAll('form[data-formspree]').forEach(function (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        if (!form.checkValidity()) { form.reportValidity(); return; }
        var btn = form.querySelector('[type="submit"]');
        var label = btn ? btn.innerHTML : '';
        if (btn) { btn.disabled = true; btn.textContent = EN ? 'Sending…' : 'Invio in corso…'; }
        fetch(form.action, { method: 'POST', body: new FormData(form), headers: { Accept: 'application/json' } })
          .then(function (res) {
            if (res.ok) {
              if (window.clarity) { try { window.clarity('event', form.getAttribute('data-event') || 'form_submit'); } catch (e) {} }
              var redirect = form.getAttribute('data-redirect');
              if (redirect) { window.location.href = redirect; return; }
              form.reset();
              showMsg(form, form.getAttribute('data-success') || (EN ? '✓ Sent — we’ll be in touch.' : '✓ Inviato — ti risponderemo presto.'), false);
              if (btn) { btn.disabled = false; btn.innerHTML = label; }
            } else {
              res.json().then(function (data) {
                var t = (data && data.errors) ? data.errors.map(function (x) { return x.message; }).join(', ')
                  : (EN ? 'Something went wrong. Try again or email hello@home-staged.ai' : 'Si è verificato un errore. Riprova o scrivici a hello@home-staged.ai');
                showMsg(form, t, true);
              }).catch(function () {
                showMsg(form, EN ? 'Something went wrong. Try again.' : 'Si è verificato un errore. Riprova.', true);
              });
              if (btn) { btn.disabled = false; btn.innerHTML = label; }
            }
          })
          .catch(function () {
            showMsg(form, EN ? 'Network error. Check your connection and retry.' : 'Errore di rete. Controlla la connessione e riprova.', true);
            if (btn) { btn.disabled = false; btn.innerHTML = label; }
          });
      });
    });
  }

  function initYear() {
    document.querySelectorAll('[data-year]').forEach(function (el) { el.textContent = new Date().getFullYear(); });
  }

  /* ---------- BEFORE/AFTER SLIDER (tabbed) ---------- */
  function initBA() {
    document.querySelectorAll('.ba').forEach(function (ba) {
      var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
      var dragging = false, hover = false, t = 2, last = performance.now();
      function setPos(p) { p = Math.max(4, Math.min(96, p)); ba.style.setProperty('--pos', p + '%'); }
      function fromEvent(e) { var p = e.touches ? e.touches[0] : e; var r = ba.getBoundingClientRect(); setPos(((p.clientX - r.left) / r.width) * 100); }
      ba.addEventListener('pointerdown', function (e) { dragging = true; try { ba.setPointerCapture(e.pointerId); } catch (x) {} fromEvent(e); });
      ba.addEventListener('pointermove', function (e) { if (dragging) fromEvent(e); });
      window.addEventListener('pointerup', function () { dragging = false; });
      ba.addEventListener('mouseenter', function () { hover = true; });
      ba.addEventListener('mouseleave', function () { hover = false; });
      function loop(now) {
        var dt = Math.min(0.05, (now - last) / 1000); last = now;
        if (!dragging && !hover && !reduce) { t += dt; setPos(50 + 30 * Math.sin(t * 0.5)); }
        requestAnimationFrame(loop);
      }
      if (!reduce) requestAnimationFrame(loop); else setPos(50);
    });
    document.querySelectorAll('.ba-tabs').forEach(function (tabs) {
      var after = document.getElementById('hero-ba-after');
      tabs.addEventListener('click', function (e) {
        var b = e.target.closest('.ba-tab'); if (!b) return;
        tabs.querySelectorAll('.ba-tab').forEach(function (x) { x.classList.toggle('is-on', x === b); });
        var img = b.getAttribute('data-img'); if (after && img) after.src = img;
        var alt = b.getAttribute('data-alt'); if (after && alt) after.alt = alt;
      });
    });
  }

  /* ---------- boot ---------- */
  function boot() {
    initNav(); initSingleSelect(); initLens(); initSplit(); initReveal();
    initConsent(); initForms(); initYear(); initBA();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
