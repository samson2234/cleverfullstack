// Analytics & Tracking — CleverStack
// GA4: G-W368FVBPYM (stream: Cleverstack)
// Meta Pixel: 1411355187832320 (dataset "CleverStack Pixel")
// Third-party scripts load only after cookie consent (GDPR).

(function () {
  'use strict';

  var GA_MEASUREMENT_ID = 'G-W368FVBPYM';
  var META_PIXEL_ID = '2081700449139098';
  var CONSENT_KEY = 'cleverstack_cookie_consent';

  window.dataLayer = window.dataLayer || [];
  window.gtag = function () { window.dataLayer.push(arguments); };

  // Default consent = denied until the visitor accepts the cookie banner
  gtag('consent', 'default', {
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    analytics_storage: 'denied'
  });
  gtag('js', new Date());

  function consentGranted() {
    try { return localStorage.getItem(CONSENT_KEY) === 'accepted'; }
    catch (e) { return false; }
  }

  var gaLoaded = false;
  function loadGA4() {
    if (gaLoaded || !GA_MEASUREMENT_ID || GA_MEASUREMENT_ID === 'G-XXXXXXXXXX') return;
    gaLoaded = true;
    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA_MEASUREMENT_ID;
    document.head.appendChild(s);
    gtag('config', GA_MEASUREMENT_ID, { send_page_view: true });
  }

  function initMeta() {
    if (!META_PIXEL_ID || META_PIXEL_ID === '000000000000000') return;
    !function(f,b,e,v,n,t,s){
      if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};
      if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
      n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;
      s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s);
    }(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
    fbq('init', META_PIXEL_ID);
    fbq('track', 'PageView');
  }

  function applyConsent() {
    if (!consentGranted()) return;
    gtag('consent', 'update', {
      ad_storage: 'granted',
      ad_user_data: 'granted',
      ad_personalization: 'granted',
      analytics_storage: 'granted'
    });
    loadGA4();
    initMeta();
  }

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    applyConsent();
  } else {
    document.addEventListener('DOMContentLoaded', applyConsent);
  }
  document.addEventListener('cs-consent-accepted', applyConsent);

  // Unified event helper used by conversion tracking:
  // window.csEvent('cta_click', { cta: 'Book a Free Call' })
  // Beacon transport keeps events delivered even when the submit navigates away.
  window.csEvent = function (eventName, params) {
    if (typeof window.gtag === 'function') {
      var p = params || {};
      p.transport_type = 'beacon';
      gtag('event', eventName, p);
    }
    if (typeof window.fbq === 'function') { fbq('trackCustom', eventName, params || {}); }
  };

  // ---- Ads conversions -------------------------------------------------
  // Google Ads: Goals > Conversions (account 447-599-6150). Values match the ones set on each action.
  var GOOGLE_ADS_ID = 'AW-18534927695';
  var ADS_LABEL_LEAD = 'JYLUCNPb2KgdEM-akoZF';      // "Contact form lead": contact / planner / ROI form accepted
  var ADS_LABEL_BOOK = '7DqoCJHB0qgdEM-akoZF';      // "Book a call click": Calendly link
  var ADS_LABEL_WHATSAPP = '0UCXCNLU3KgdEM-akoZF';  // "Contact click": WhatsApp link
  var ADS_LABEL_SIGNUP = 'IrkCCNzD3KgdEM-akoZF';    // "Sign-up Click": newsletter subscription accepted

  function adsConversion(label, value) {
    if (typeof window.gtag !== 'function' || !GOOGLE_ADS_ID || !label) return;
    gtag('event', 'conversion', { send_to: GOOGLE_ADS_ID + '/' + label, value: value || 0, currency: 'USD', transport_type: 'beacon' });
  }
  if (GOOGLE_ADS_ID) {
    // Load the Ads tag through the same consent-gated gtag
    document.addEventListener('cs-consent-accepted', function () { gtag('config', GOOGLE_ADS_ID); });
    if (consentGranted()) gtag('config', GOOGLE_ADS_ID);
  }

  // A lead = the contact API actually accepted the submission (not just a click on Send).
  var nativeFetch = window.fetch;
  if (nativeFetch) {
    window.fetch = function (input, init) {
      var p = nativeFetch.apply(this, arguments);
      try {
        var url = typeof input === 'string' ? input : (input && input.url) || '';
        var method = ((init && init.method) || (input && input.method) || 'GET').toUpperCase();
        if (method === 'POST' && url.indexOf('/api/contact') !== -1) {
          p.then(function (res) {
            if (res && res.ok) {
              window.csEvent('generate_lead', { form: 'contact', currency: 'USD', value: 500 });
              if (typeof window.fbq === 'function') fbq('track', 'Lead');
              adsConversion(ADS_LABEL_LEAD, 500);
            }
          }, function () {});
        } else if (method === 'POST' && url.indexOf('/api/subscribe') !== -1) {
          p.then(function (res) {
            if (res && res.ok) {
              window.csEvent('sign_up', { method: 'newsletter' });
              if (typeof window.fbq === 'function') fbq('track', 'CompleteRegistration');
              adsConversion(ADS_LABEL_SIGNUP, 0);
            }
          }, function () {});
        }
      } catch (e) {}
      return p;
    };
  }

  // Click tracking: booking, WhatsApp, phone, email
  document.addEventListener('click', function (e) {
    var a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
    if (!a) return;
    var href = a.getAttribute('href') || '';
    if (href.indexOf('calendly.com') !== -1) {
      window.csEvent('book_call_click', { location: location.pathname });
      if (typeof window.fbq === 'function') fbq('track', 'Schedule');
      adsConversion(ADS_LABEL_BOOK, 100);
    } else if (href.indexOf('wa.me') !== -1 || href.indexOf('api.whatsapp.com') !== -1) {
      window.csEvent('whatsapp_click', { location: location.pathname });
      if (typeof window.fbq === 'function') fbq('track', 'Contact');
      adsConversion(ADS_LABEL_WHATSAPP, 50);
    } else if (href.indexOf('tel:') === 0) {
      window.csEvent('phone_click', { location: location.pathname });
    } else if (href.indexOf('mailto:') === 0) {
      window.csEvent('email_click', { location: location.pathname });
    }
  }, true);

  // Fire form_submission conversion events on contact + newsletter submits
  document.addEventListener('submit', function (e) {
    var f = e.target;
    if (f && f.matches && f.matches('.contact-form, .subscribe-form')) {
      var isContact = f.classList.contains('contact-form');
      window.csEvent('form_submission', {
        form: isContact ? 'contact' : 'newsletter',
        form_name: isContact ? 'Contact Form' : 'Newsletter Subscribe'
      });
    }
  }, true);

  // Lightweight client-side error tracking -> GA4 (consent-gated like all events)
  var lastErrorSent = 0;
  function reportError(label, detail) {
    var now = Date.now();
    if (now - lastErrorSent < 10000) return; // throttle: max 1 error event / 10s
    lastErrorSent = now;
    try {
      window.csEvent('js_error', { label: label, detail: String(detail || '').slice(0, 300) });
    } catch (e) {}
  }
  window.addEventListener('error', function (e) {
    var msg = e && e.message ? String(e.message) : '';
    if (msg === 'Script error.' || !msg) return; // cross-origin opaque errors carry no info
    reportError('window_error', msg);
  });
  window.addEventListener('unhandledrejection', function (e) {
    var r = e && e.reason;
    var msg = r && r.message ? String(r.message) : String(r || '');
    reportError('unhandled_rejection', msg);
  });
})();

// ---- First-party analytics (cookieless) ---------------------------------------------------------
// Feeds the CRM's Analytics dashboard: page views, clicks, visible time, scroll depth, leads.
// No cookies, no stored identifiers, no IPs: the server derives a daily-rotating anonymous visitor hash
// and the country/city from Vercel's edge, so it needs no consent and does not depend on the cookie banner.
// Skipped for bots/automation, local development, and browsers the owner excluded in the CRM.
(function () {
  'use strict';
  try {
    if (navigator.webdriver && !window.CS_PULSE_TEST) return;
    var h = location.hostname;
    if ((h === 'localhost' || h === '127.0.0.1' || h === '[::1]') && !window.CS_PULSE_TEST) return;
    if (localStorage.getItem('cs_notrack') === '1') return;
  } catch (e) {}

  var ENDPOINT = '/api/pulse';
  var SK = 'cs_pulse_s';
  function rid(n) {
    var a = new Uint8Array(n || 8);
    try { crypto.getRandomValues(a); } catch (e) { for (var i = 0; i < a.length; i++) a[i] = Math.floor(Math.random() * 256); }
    return Array.prototype.map.call(a, function (b) { return ('0' + b.toString(16)).slice(-2); }).join('');
  }
  function session() {
    var now = Date.now(), s = null;
    try { s = JSON.parse(sessionStorage.getItem(SK) || 'null'); } catch (e) {}
    if (!s || !s.id || now - s.t > 30 * 60 * 1000) s = { id: rid(8), t: now };
    s.t = now;
    try { sessionStorage.setItem(SK, JSON.stringify(s)); } catch (e) {}
    return s.id;
  }
  function pagePath() {
    var p = location.pathname, id = '';
    try { id = new URLSearchParams(location.search).get('id') || ''; } catch (e) {}
    return /portfolio-detail/.test(p) && id ? p + '?id=' + id : p;
  }
  var PATH = pagePath();
  var PID = rid(6);
  function send(events) {
    try {
      var body = JSON.stringify({ s: session(), w: window.innerWidth || 0, e: events });
      if (navigator.sendBeacon && navigator.sendBeacon(ENDPOINT, new Blob([body], { type: 'text/plain' }))) return;
      fetch(ENDPOINT, { method: 'POST', body: body, headers: { 'Content-Type': 'text/plain' }, keepalive: true, credentials: 'omit' }).catch(function () {});
    } catch (e) {}
  }

  window.__csPulse = function (events) { send(events); };   // used by the A/B block below

  // 1. page view
  var utm = {};
  try {
    var q = new URLSearchParams(location.search);
    utm = { s: q.get('utm_source') || '', m: q.get('utm_medium') || '', c: q.get('utm_campaign') || '' };
  } catch (e) {}
  send([{ t: 'pageview', p: PATH, pid: PID, ti: (document.title || '').slice(0, 120), r: document.referrer || '', u: utm }]);

  // 2. clicks: what was clicked and where it leads
  function kindOf(el, href) {
    if (/^tel:/i.test(href)) return 'phone';
    if (/^mailto:/i.test(href)) return 'email';
    if (/wa\.me|whatsapp\.com/i.test(href)) return 'whatsapp';
    if (/calendly\.com/i.test(href)) return 'booking';
    if (el.tagName === 'A' && href) {
      if (href.charAt(0) === '#') return 'anchor';
      try { var u = new URL(href, location.href); if (u.hostname !== location.hostname) return 'outbound'; } catch (e) {}
      return /\bbtn-primary\b|\bbtn\b/.test(el.className || '') ? 'cta' : 'nav';
    }
    if (el.type === 'submit') return 'submit';
    return /\bbtn-primary\b/.test(el.className || '') ? 'cta' : 'button';
  }
  document.addEventListener('click', function (e) {
    try {
      var el = e.target && e.target.closest ? e.target.closest('a,button,[role="button"],summary,input[type="submit"]') : null;
      if (!el) return;
      var href = el.getAttribute('href') || '';
      var label = (el.getAttribute('aria-label') || el.innerText || el.value || el.getAttribute('title') || '').replace(/\s+/g, ' ').replace(/[\s\u2192\u203A\u00BB>]+$/, '').trim().slice(0, 80);
      var kind = kindOf(el, href), dest = '';
      if (kind === 'outbound') { try { dest = new URL(href, location.href).hostname.replace(/^www\./, ''); } catch (x) {} }
      else if (kind === 'nav' || kind === 'cta') { try { var u = new URL(href, location.href); dest = u.hostname === location.hostname ? u.pathname : u.hostname; } catch (x) {} }
      else if (kind === 'booking' || kind === 'whatsapp') { try { dest = new URL(href, location.href).hostname.replace(/^www\./, ''); } catch (x) {} }
      var ev = [{ t: 'click', p: PATH, pid: PID, tg: label || href.slice(0, 80) || el.tagName.toLowerCase(), k: kind, d: dest }];
      // a link that leaves the page: send the time spent here together with the click, before unload
      if (/^(nav|cta|booking|whatsapp|outbound|phone|email)$/.test(kind)) { var eng = takeEngage(); if (eng) ev.push(eng); }
      send(ev);
    } catch (x) {}
  }, true);

  // 3. engagement: visible time on the page + deepest scroll position
  var visibleSince = document.visibilityState === 'visible' ? Date.now() : 0, acc = 0, depth = 0, lastDepthSent = 0;
  function measureDepth() {
    var de = document.documentElement, full = Math.max(de.scrollHeight, document.body ? document.body.scrollHeight : 0);
    if (!full) return;
    var d = Math.min(100, Math.round(((window.scrollY || de.scrollTop) + window.innerHeight) / full * 100));
    if (d > depth) depth = d;
  }
  window.addEventListener('scroll', measureDepth, { passive: true });
  window.addEventListener('load', measureDepth);
  // returns the engagement accumulated since the last report (and resets it), or null if nothing new
  function takeEngage() {
    var now = Date.now();
    if (visibleSince) { acc += now - visibleSince; visibleSince = document.visibilityState === 'visible' ? now : 0; }
    if (acc < 1000 && depth <= lastDepthSent) return null;
    var ev = { t: 'engage', p: PATH, pid: PID, v: Math.min(acc, 30 * 60 * 1000), dp: depth };
    acc = 0; lastDepthSent = depth;
    return ev;
  }
  function flush() {
    var ev = takeEngage();
    visibleSince = 0;
    if (ev) send([ev]);
  }
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') flush(); else visibleSince = Date.now();
  });
  window.addEventListener('pagehide', flush);

  // 4. conversions: a lead or review counts only when the API accepted it
  var f = window.fetch;
  if (f) {
    window.fetch = function (input, init) {
      // link a form submission to this visit (anonymous session id) so the CRM can score the lead by its journey
      try {
        var u0 = typeof input === 'string' ? input : (input && input.url) || '';
        if (u0.indexOf('/api/contact') !== -1 && init && typeof init.body === 'string' && init.body.charAt(0) === '{') {
          var b0 = JSON.parse(init.body);
          if (b0 && !b0._asid) { b0._asid = session(); init = Object.assign({}, init, { body: JSON.stringify(b0) }); arguments[1] = init; }
        }
      } catch (x) {}
      var p = f.apply(this, arguments);
      try {
        var url = typeof input === 'string' ? input : (input && input.url) || '';
        var method = ((init && init.method) || (input && input.method) || 'GET').toUpperCase();
        var isLead = url.indexOf('/api/contact') !== -1, isReview = url.indexOf('/api/reviews') !== -1;
        if (method === 'POST' && (isLead || isReview)) {
          var src = '';
          try { src = isLead ? (JSON.parse((init && init.body) || '{}').source || 'contact-form') : 'review'; } catch (x) { src = isLead ? 'contact-form' : 'review'; }
          p.then(function (res) { if (res && res.ok) send([{ t: isLead ? 'lead' : 'review', p: PATH, pid: PID, tg: String(src).slice(0, 60) }]); }, function () {});
        }
      } catch (x) {}
      return p;
    };
  }
})();

// ---- A/B tests (configured in the CRM: Tools > A/B tests) ----------------------------------------
// Version B replaces the text of one element. Visitors are split 50/50 and keep their group (only the
// letter "a"/"b" is stored). English pages only, so translations never fight a variant.
// Preview a variant without counting it: add ?ab_preview=<test id> to the page address.
(function () {
  'use strict';
  try {
    var html = document.documentElement;
    if ((html.getAttribute('lang') || 'en').slice(0, 2) !== 'en') return;
    var KEY = 'cs_ab_cfg', now = Date.now();
    function norm(p) { p = (p || '/').split('#')[0].split('?')[0].replace(/\/index\.html$/i, '/').replace(/\.html$/i, '').replace(/\/+$/, ''); return p || '/'; }
    var here = norm(location.pathname);
    var preview = (location.search.match(/[?&]ab_preview=(\d+)/) || [])[1];
    function apply(tests, record) {
      (tests || []).forEach(function (t) {
        if (norm(t.page) !== here) return;
        var el; try { el = document.querySelector(t.sel); } catch (e) { return; }
        if (!el) return;
        var v;
        if (preview) v = String(t.id) === preview ? 'b' : 'a';
        else {
          try { v = localStorage.getItem('cs_ab_' + t.id); } catch (e) {}
          if (v !== 'a' && v !== 'b') { v = Math.random() < 0.5 ? 'a' : 'b'; try { localStorage.setItem('cs_ab_' + t.id, v); } catch (e) {} }
        }
        if (v === 'b' && el.getAttribute('data-ab') !== String(t.id)) { el.textContent = t.b; el.setAttribute('data-ab', String(t.id)); }
        if (record && !preview && window.__csPulse) window.__csPulse([{ t: 'exp', p: location.pathname, tg: String(t.id), k: v }]);
      });
    }
    var cached = null;
    try { cached = JSON.parse(sessionStorage.getItem(KEY) || 'null'); } catch (e) {}
    if (cached && now - cached.t < 5 * 60 * 1000) { apply(cached.tests, true); return; }
    fetch('/api/pulse?ab=1', { credentials: 'omit' }).then(function (r) { return r.ok ? r.json() : { tests: [] }; }).then(function (d) {
      var tests = (d && d.tests) || [];
      try { sessionStorage.setItem(KEY, JSON.stringify({ t: Date.now(), tests: tests })); } catch (e) {}
      apply(tests, true);
    }).catch(function () {});
  } catch (e) {}
})();
