/* sw.js — service worker for the two installable apps: "CleverStack Chat" (registered with scope /messages) and
   "CleverStack CRM" (scope /admin). It never touches the rest of the website.
   - Page loads go to the network first (chats must always be fresh); when the phone is offline it shows a small
     "you're offline" page instead of the browser's error, and retries by itself when the connection is back.
   - API calls, files and everything else pass straight through (no caching of private data).
   - Web Push (lib/push.js): shows the notification; tapping it focuses the open chat / CRM, or opens it. */
'use strict';
var VERSION = 'cs-apps-2';

self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k.indexOf('cs-apps-') === 0 && k !== VERSION; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

var OFFLINE = '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
  '<title>Offline · CleverStack</title><style>html,body{height:100%;margin:0}body{display:flex;align-items:center;justify-content:center;background:#0b141a;color:#e9edef;' +
  'font:16px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif;text-align:center;padding:24px;box-sizing:border-box}b{display:block;font-size:1.2rem;margin-bottom:6px}' +
  'span{color:#8696a0}button{margin-top:18px;border:0;border-radius:100px;padding:11px 22px;font:600 15px system-ui,sans-serif;background:#2AA79F;color:#fff}</style></head>' +
  '<body><div><b>You\'re offline</b><span>Your messages are safe. This page reloads as soon as you\'re back online.</span><br>' +
  '<button onclick="location.reload()">Try again</button></div><script>addEventListener("online",function(){location.reload()})</script></body></html>';

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET' || req.mode !== 'navigate') return; // only page loads; everything else goes to the network untouched
  var path = new URL(req.url).pathname;
  if (!/^\/(messages|admin)(\.html)?$/.test(path)) return;
  e.respondWith(fetch(req).catch(function () {
    return new Response(OFFLINE, { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
  }));
});

// ---- notifications (Phase 4) ---------------------------------------------------------------------------
self.addEventListener('push', function (e) {
  var d = {};
  try { d = e.data ? e.data.json() : {}; } catch (err) { d = { body: e.data ? e.data.text() : '' }; }
  var crm = /^\/admin/.test(d.url || '') || /\/admin$/.test(self.registration.scope);
  var icon = crm ? '/images/app/crm-192.png' : '/images/app/chat-192.png';
  e.waitUntil(Promise.all([
    self.registration.showNotification(d.title || 'CleverStack', {
      body: d.body || 'You have a new message.', icon: icon, badge: icon, tag: d.tag || 'cs-message', renotify: true,
      data: { url: d.url || (crm ? '/admin#inbox' : '/messages') }
    }),
    // number on the app icon where supported (cleared when the app is opened)
    self.navigator && self.navigator.setAppBadge ? self.navigator.setAppBadge().catch(function () {}) : null
  ]));
});

self.addEventListener('notificationclick', function (e) {
  e.notification.close();
  var url = new URL((e.notification.data && e.notification.data.url) || '/', self.location.origin);
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (list) {
    // an open window of the same app: bring it forward (and move the CRM to the right chat)
    for (var i = 0; i < list.length; i++) {
      var c = list[i], cu = new URL(c.url);
      if (cu.origin === url.origin && cu.pathname.replace(/\.html$/, '') === url.pathname) {
        return c.focus().then(function (w) { if (w && url.hash && w.url !== url.href && 'navigate' in w) return w.navigate(url.href).catch(function () {}); });
      }
    }
    return self.clients.openWindow(url.href);
  }));
});

