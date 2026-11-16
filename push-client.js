/* push-client.js — turn phone / desktop notifications on or off for this device (Web Push, lib/push.js on the server).
   Used by the website chat (chat-widget.js), the chat page (/messages) and the CRM Inbox (/admin).
     CSPush.supported()                       -> false on iPhone/iPad unless the app was added to the Home Screen
     CSPush.state(scope)                      -> Promise<'on' | 'off' | 'blocked' | 'unsupported'>
     CSPush.enable({ scope, key, save(sub) }) -> asks permission, subscribes with the server's public key, saves it
     CSPush.disable({ scope, remove(sub) })
   The service worker (sw.js) is registered for `scope` only (/messages or /admin), never the whole website. */
(function () {
  'use strict';
  if (window.CSPush) return;
  function supported() { return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window && window.isSecureContext !== false; }
  function bytes(b64) {
    var s = (b64 + '='.repeat((4 - b64.length % 4) % 4)).replace(/-/g, '+').replace(/_/g, '/'), raw = atob(s), out = new Uint8Array(raw.length);
    for (var i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
    return out;
  }
  function active(r) {
    if (r.active) return Promise.resolve(r);
    var w = r.installing || r.waiting;
    return new Promise(function (ok) {
      if (!w) return ok(r);
      w.addEventListener('statechange', function () { if (w.state === 'activated') ok(r); });
    });
  }
  function registration(scope) {
    return navigator.serviceWorker.getRegistration(scope).then(function (r) {
      // getRegistration matches by URL prefix, so make sure it is ours and not another scope
      if (r && new URL(r.scope).pathname === scope) return r;
      return navigator.serviceWorker.register('/sw.js', { scope: scope });
    }).then(active);
  }
  function current(scope) {
    return navigator.serviceWorker.getRegistration(scope).then(function (r) { return r && new URL(r.scope).pathname === scope ? r.pushManager.getSubscription() : null; });
  }
  function state(scope) {
    if (!supported()) return Promise.resolve('unsupported');
    if (Notification.permission === 'denied') return Promise.resolve('blocked');
    return current(scope).then(function (s) { return s && Notification.permission === 'granted' ? 'on' : 'off'; }).catch(function () { return 'off'; });
  }
  function enable(o) {
    if (!supported()) return Promise.reject(new Error('This browser cannot show notifications. On iPhone, add the app to your Home Screen first.'));
    if (!o.key) return Promise.reject(new Error('Notifications are not set up yet.'));
    // ask first, while the tap still counts as the user's own action
    return Promise.resolve(Notification.requestPermission()).then(function (p) {
      if (p !== 'granted') throw new Error(p === 'denied' ? 'Notifications are blocked for this site. Allow them in your browser settings.' : 'Notifications were not turned on.');
      return registration(o.scope);
    }).then(function (r) {
      return r.pushManager.getSubscription().then(function (s) {
        return s || r.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: bytes(o.key) });
      });
    }).then(function (s) { return Promise.resolve(o.save(s.toJSON())).then(function () { return s; }); });
  }
  function disable(o) {
    return current(o.scope).then(function (s) {
      if (!s) return;
      var json = s.toJSON();
      return s.unsubscribe().then(function () { return o.remove ? o.remove(json) : null; });
    });
  }
  window.CSPush = { supported: supported, state: state, enable: enable, disable: disable };
})();
