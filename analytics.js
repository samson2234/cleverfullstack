// Analytics & Tracking — CleverStack
// GA4: G-W368FVBPYM (stream: Cleverstack)
// Meta Pixel: placeholder — add your Pixel ID when ready
// Third-party scripts load only after cookie consent (GDPR).

(function () {
  'use strict';

  var GA_MEASUREMENT_ID = 'G-W368FVBPYM';
  var META_PIXEL_ID = '000000000000000';
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
