/* app-install.js — makes /messages ("CleverStack Chat") and /admin ("CleverStack CRM") installable apps.
   <script src="app-install.js" data-scope="/messages" data-app="CleverStack Chat" data-slot="ptInstall" defer></script>
   - registers sw.js for that scope only (the rest of the website never gets a service worker)
   - fills the [data-slot] element with an install bar: an "Install" button where the browser offers one
     (Chrome / Edge / Android), step-by-step "Add to Home Screen" help on iPhone and iPad, nothing once installed.
   - "Not now" hides the bar for 14 days. window.CSApp.installed() tells other scripts if we run as the app. */
(function () {
  'use strict';
  var me = document.currentScript; if (!me) return;
  var scope = me.getAttribute('data-scope'), app = me.getAttribute('data-app') || 'the app', slotId = me.getAttribute('data-slot');
  var KEY = 'cs_install_later' + scope.replace(/\W/g, '_'), deferred = null;
  function installed() { return (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || window.navigator.standalone === true; }
  function later() { try { return Date.now() < +(localStorage.getItem(KEY) || 0); } catch (e) { return false; } }
  function snooze() { try { localStorage.setItem(KEY, String(Date.now() + 14 * 864e5)); } catch (e) {} }
  var ua = navigator.userAgent || '';
  var ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  var iosSafari = ios && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);

  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    addEventListener('load', function () { navigator.serviceWorker.register('/sw.js', { scope: scope }).catch(function () {}); });
  }

  var SHARE = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="vertical-align:-3px"><path d="M12 3v13M7 8l5-5 5 5"/><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/></svg>';
  function bar(html, withButton) {
    var slot = slotId && document.getElementById(slotId); if (!slot) return;
    slot.innerHTML = '<div class="cs-install" role="region" aria-label="Install ' + app + '"><img src="' + me.getAttribute('data-icon') + '" alt="" width="40" height="40"><div class="cs-install-t">' + html + '</div>' +
      (withButton ? '<button type="button" class="cs-install-go">Install</button>' : '') + '<button type="button" class="cs-install-x" aria-label="Not now">✕</button></div>';
    slot.hidden = false;
    slot.querySelector('.cs-install-x').addEventListener('click', function () { snooze(); slot.hidden = true; });
    var go = slot.querySelector('.cs-install-go');
    if (go) go.addEventListener('click', function () {
      if (!deferred) return;
      deferred.prompt();
      deferred.userChoice.then(function (c) { if (c && c.outcome === 'accepted') slot.hidden = true; deferred = null; }).catch(function () {});
    });
  }
  function hide() { var slot = slotId && document.getElementById(slotId); if (slot) slot.hidden = true; }

  addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault(); deferred = e;
    if (installed() || later()) return;
    bar('<b>Install ' + app + '</b><span>' + (me.getAttribute('data-pitch') || 'Open it from your home screen like any app.') + '</span>', true);
  });
  addEventListener('appinstalled', hide);
  function iosHelp() {
    if (!iosSafari || installed() || later()) return;
    bar('<b>Add ' + app + ' to your Home Screen</b><span>Tap ' + SHARE + ' <b>Share</b> below, then <b>Add to Home Screen</b>.</span>', false);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iosHelp); else iosHelp();

  window.CSApp = { installed: installed };
})();
