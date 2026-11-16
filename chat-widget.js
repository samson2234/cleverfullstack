/* chat-widget.js — website chat with Henry (replaces the old WhatsApp buttons). Any [data-chat-open] link opens it;
   without JavaScript those links go to /contact?chat=1, which opens it on arrival. First message goes through
   /api/contact (chat:true) — that creates the CRM conversation, emails the owner and returns the visitor's private
   token. After that the thread is the same conversation as /messages and the CRM Inbox (api/portal.js).
   chat-ui.js/.css and chat-widget.css load only when the chat is first opened. */
(function () {
  'use strict';
  if (window.CSWidget) return;
  var me = document.currentScript, base = (me && me.src) || location.href;
  function asset(name) { var v = me && me.getAttribute(name); return v ? new URL(v, base).href : ''; }
  var KEY = 'cleverstack_chat', AGENT = 'Henry George', FIRST = 'Henry';
  var store = { get: function () { try { return JSON.parse(localStorage.getItem(KEY) || 'null') || {}; } catch (e) { return {}; } },
    set: function (o) { try { localStorage.setItem(KEY, JSON.stringify(o)); } catch (e) {} } };
  var state = store.get(), panel = null, thread = null, since = '', busy = false, timer = null, peekTimer = null, isOpen = false, editMinutes = 15, lastSeen = state.seen || 0;

  function el(tag, cls, text) { var n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; }
  function loadCss(href) { if (!href || document.querySelector('link[href="' + href + '"]')) return Promise.resolve(); return new Promise(function (ok) { var l = el('link'); l.rel = 'stylesheet'; l.href = href; l.onload = l.onerror = ok; document.head.appendChild(l); }); }
  var uiReady = null;
  function loadUi() {
    if (uiReady) return uiReady;
    var css = Promise.all([loadCss(asset('data-ui-href')), loadCss(asset('data-css-href'))]);
    var js = window.CSChat ? Promise.resolve() : new Promise(function (ok, bad) { var s = el('script'); s.src = asset('data-ui-src'); s.onload = ok; s.onerror = bad; document.head.appendChild(s); });
    uiReady = Promise.all([css, js]).catch(function (e) { uiReady = null; throw e; });
    return uiReady;
  }

  // ---- panel -------------------------------------------------------------------------------------------
  var CHIPS = ['I need a website', 'I need a web or mobile app', 'I need custom software', 'How much would my project cost?'];
  function build() {
    panel = el('div', 'cw'); panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-label', 'Chat with ' + AGENT); panel.hidden = true;
    panel.innerHTML =
      '<header class="cw-head"><span class="cw-av" aria-hidden="true">HG<i></i></span><span class="cw-who"><b>' + AGENT + '</b><small>CleverStack · Typically replies within an hour</small></span>' +
      '<a class="cw-ic cw-full" target="_blank" rel="noopener" title="Open full screen" aria-label="Open the chat full screen" hidden><svg viewBox="0 0 24 24"><path d="M14 4h6v6M10 20H4v-6M20 4l-7 7M4 20l7-7"/></svg></a>' +
      '<button type="button" class="cw-ic cw-x" aria-label="Close chat"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button></header>' +
      '<div class="cw-body">' +
        '<div class="cw-start">' +
          '<div class="cw-bub">Hi there 👋 I\'m Henry from CleverStack.</div>' +
          '<div class="cw-bub">Tell me a little about what you\'d like to build and I\'ll reply here, usually within an hour. I\'ll also email you, so you won\'t miss my answer.</div>' +
          '<div class="cw-chips"></div>' +
          '<form class="cw-form" novalidate>' +
            '<label><span>Your name</span><input name="name" autocomplete="name" maxlength="100" required placeholder="What should we call you?"></label>' +
            '<label><span>Your email</span><input name="email" type="email" autocomplete="email" maxlength="200" required placeholder="you@company.com"></label>' +
            '<label><span>Message</span><textarea name="message" rows="3" maxlength="5000" required placeholder="Type your message…"></textarea></label>' +
            '<input name="company_website" tabindex="-1" autocomplete="off" aria-hidden="true" class="cw-hp">' +
            '<p class="cw-err" role="alert"></p>' +
            '<button type="submit" class="cw-go">Start chat <svg viewBox="0 0 24 24"><path d="M3 20l18-8L3 4v6l12 2-12 2z"/></svg></button>' +
            '<p class="cw-note">By starting a chat you agree to our <a href="/privacy">privacy policy</a>.</p>' +
          '</form>' +
        '</div>' +
        '<div class="cw-thread" hidden></div>' +
        '<div class="cw-done" hidden></div>' +
      '</div>' +
      '<form class="cw-composer" hidden><button type="button" class="cw-ic cw-attach" aria-label="Attach a file"></button><button type="button" class="cw-ic cw-emoji" aria-label="Insert emoji"></button>' +
        '<textarea rows="1" maxlength="5000" placeholder="Type a message" aria-label="Message"></textarea>' +
        '<button type="submit" class="cw-send" aria-label="Send"><svg viewBox="0 0 24 24"><path d="M3 20l18-8L3 4v6l12 2-12 2z"/></svg></button>' +
        '<p class="cw-err" role="alert"></p></form>';
    document.body.appendChild(panel);
    var form = panel.querySelector('.cw-form'), chips = panel.querySelector('.cw-chips');
    CHIPS.forEach(function (c) { var b = el('button', 'cw-chip', c); b.type = 'button'; b.addEventListener('click', function () { form.message.value = c + (c.slice(-1) === '?' ? ' ' : '. '); form.message.focus(); }); chips.appendChild(b); });
    if (state.name) form.name.value = state.name;
    if (state.email) form.email.value = state.email;
    form.addEventListener('submit', function (e) { e.preventDefault(); start(form); });
    panel.querySelector('.cw-x').addEventListener('click', close);
    panel.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !document.querySelector('.ch-menu,.ch-emoji,.ch-lightbox')) close(); });
  }

  function start(form) {
    var err = form.querySelector('.cw-err'), go = form.querySelector('.cw-go');
    var name = form.name.value.trim(), email = form.email.value.trim(), message = form.message.value.trim();
    err.textContent = '';
    if (!name) { err.textContent = 'Please tell us your name.'; form.name.focus(); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) { err.textContent = 'Please enter a valid email so we can reply.'; form.email.focus(); return; }
    if (!message) { err.textContent = 'Please type a message.'; form.message.focus(); return; }
    var q = new URLSearchParams(location.search), body = { chat: true, name: name, email: email, message: message, page: location.pathname, company_website: form.company_website.value };
    ['utm_source', 'utm_medium', 'utm_campaign'].forEach(function (k) { var v = q.get(k); if (v) body[k] = v.slice(0, 100); });
    go.disabled = true; go.firstChild.textContent = 'Starting… ';
    fetch('/api/contact', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { if (!r.ok) throw new Error(d.error || 'Something went wrong. Please try again.'); return d; }); })
      .then(function (d) {
        state = { name: name, email: email };
        if (d.chat && d.chat.token) { state.token = d.chat.token; store.set(state); showThread(); }
        else { store.set(state); showDone(name); }
      })
      .catch(function (e) { err.textContent = e.message; go.disabled = false; go.firstChild.textContent = 'Start chat '; });
  }

  function showDone(name) {
    panel.querySelector('.cw-start').hidden = true;
    var d = panel.querySelector('.cw-done'); d.hidden = false;
    d.innerHTML = '<div class="cw-bub"></div>';
    d.firstChild.textContent = 'Thanks, ' + name.split(/\s+/)[0] + '! Your message has reached us and we\'ll reply by email shortly.';
  }

  // ---- live thread (same conversation as /messages and the CRM Inbox) ----------------------------------
  function post(body) {
    return fetch('/api/portal', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Object.assign({ t: state.token }, body)) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { if (!r.ok) throw new Error(d.error || 'Could not send'); return d; }); });
  }
  function T() { return encodeURIComponent(state.token); }
  function norm(m) { m.created_at = m.at; return m; }
  function age(m) { return (Date.now() - new Date(String(m.created_at).replace(' ', 'T') + 'Z')) / 1000; }

  function showThread() {
    panel.querySelector('.cw-start').hidden = true;
    panel.querySelector('.cw-done').hidden = true;
    var box = panel.querySelector('.cw-thread'), comp = panel.querySelector('.cw-composer'), full = panel.querySelector('.cw-full');
    box.hidden = false; comp.hidden = false; full.hidden = false; full.href = '/messages#c=' + state.token;
    offerAlerts(box);
    if (thread) { load(false); return; }
    var input = comp.querySelector('textarea'), err = comp.querySelector('.cw-err');
    comp.querySelector('.cw-attach').innerHTML = CSChat.ICON.clip;
    comp.querySelector('.cw-emoji').innerHTML = CSChat.ICON.smile;
    function download(f) { var a = el('a'); a.href = '/api/portal?t=' + T() + '&file=' + f.id + '&dl=1'; a.download = f.name; a.rel = 'noopener'; document.body.appendChild(a); a.click(); a.remove(); }
    thread = CSChat.thread(box, {
      mine: function (m) { return m.from === 'you'; },
      name: function (m) { return m.from === 'you' ? 'You' : (m.name || 'CleverStack'); },
      fileSrc: function (f) { return '/api/portal?t=' + T() + '&file=' + f.id; },
      download: download,
      canEdit: function (m) { return m.from === 'you' && age(m) < editMinutes * 60; },
      canDelete: function (m) { return m.from === 'you' && age(m) < editMinutes * 60; },
      onEdit: function (m, text) { return post({ op: 'edit', id: m.id, body: text }).then(function () { load(false); }); },
      onDelete: function (m) { return post({ op: 'delete', id: m.id }).then(function () { load(false); }); }
    });
    function settle() { busy = false; return load(false); }
    function sendText(text) {
      err.textContent = '';
      var p = thread.pending(text, false);
      post({ body: text, company_website: '' }).then(function () { return settle().then(p.done); })
        .catch(function (e) { p.fail(e.message, function () { sendText(text); }); });
    }
    function sendFiles(files) {
      err.textContent = '';
      files.slice(0, 10).reduce(function (chain, file) {
        return chain.then(function () {
          return CSChat.prepareFile(file).then(function (f) {
            var p = thread.pending(f.name, true);
            return CSChat.upload('/api/portal?t=' + T() + '&name=' + encodeURIComponent(f.name), f.blob, {}, p.progress)
              .then(function () { return settle().then(p.done); })
              .catch(function (e) { p.fail(e.message, function () { sendFiles([file]); }); });
          }, function (e) { err.textContent = e.message; });
        });
      }, Promise.resolve());
      if (files.length > 10) err.textContent = 'You can send up to 10 files at a time.';
    }
    CSChat.composer({ form: comp, input: input, attach: comp.querySelector('.cw-attach'), emoji: comp.querySelector('.cw-emoji'), drop: panel,
      onSend: sendText, onFiles: sendFiles, onTyping: function () { post({ op: 'typing' }).catch(function () {}); } });
    load(true).then(function () { if (isOpen && window.innerWidth > 640) input.focus({ preventScroll: true }); });
  }

  // Strip above the thread: notifications when Henry replies where the browser supports them (push-client.js),
  // otherwise the installable chat app (the /messages page shows Install / iPhone "Add to Home Screen" steps).
  var pushLoad = null;
  function loadPush() {
    if (window.CSPush) return Promise.resolve();
    if (!pushLoad) pushLoad = new Promise(function (ok, bad) { var s = el('script'); s.src = asset('data-push-src'); s.onload = ok; s.onerror = bad; document.head.appendChild(s); });
    return pushLoad;
  }
  function pushSave(sub) { return post({ op: 'push_sub', sub: sub }); }
  function offerAlerts(box) {
    if (state.noApp || panel.querySelector('.cw-app')) return;
    var tip = el('div', 'cw-app'), body = panel.querySelector('.cw-body');
    function close() { state.noApp = true; store.set(state); tip.remove(); }
    function appTip() {
      tip.innerHTML = '<span>📲 Get Henry\'s replies on your phone</span><a target="_blank" rel="noopener">Get the app</a><button type="button" aria-label="Hide">✕</button>';
      tip.querySelector('a').href = '/messages#c=' + state.token;
      tip.querySelector('button').addEventListener('click', close);
      if (!tip.parentNode) body.insertBefore(tip, box);
    }
    loadPush().then(function () {
      if (!window.CSPush.supported()) return appTip();
      return fetch('/api/portal?push_key=1', { cache: 'no-store' }).then(function (r) { return r.json(); }).then(function (d) {
        if (!d.key) return appTip();
        return CSPush.state('/messages').then(function (s) {
          if (s === 'on') { CSPush.enable({ scope: '/messages', key: d.key, save: pushSave }).catch(function () {}); return; } // quietly follow this chat
          if (s === 'blocked') return appTip();
          tip.innerHTML = '<span>🔔 Get a notification when Henry replies</span><a href="#" role="button">Turn on</a><button type="button" aria-label="Hide">✕</button>';
          tip.querySelector('button').addEventListener('click', close);
          tip.querySelector('a').addEventListener('click', function (e) {
            e.preventDefault();
            CSPush.enable({ scope: '/messages', key: d.key, save: pushSave }).then(function () {
              tip.innerHTML = '<span>✓ Notifications on. We\'ll ping this device when Henry replies.</span>';
              setTimeout(function () { tip.remove(); }, 4000);
            }).catch(function (er) { tip.querySelector('span').textContent = er.message; });
          });
          body.insertBefore(tip, box);
        });
      });
    }).catch(appTip);
  }

  function load(first) {
    if (busy || !state.token) return Promise.resolve(); busy = true;
    return fetch('/api/portal?t=' + T() + '&after=' + thread.lastId() + '&since=' + encodeURIComponent(since), { cache: 'no-store' })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { return { ok: r.ok, status: r.status, d: d }; }); })
      .then(function (x) {
        if (!x.ok) { if (x.status === 404) reset(); return; }
        editMinutes = x.d.editMinutes || editMinutes;
        thread.add(x.d.messages.map(norm), { initial: first });
        thread.update((x.d.changed || []).map(norm));
        thread.seen(x.d.seen);
        thread.typing(x.d.typing, FIRST);
        since = x.d.now || since;
        markSeen(thread.lastId());
      }).catch(function () {}).then(function () { busy = false; });
  }
  // the link stopped working (conversation deleted or link replaced): start over with a fresh form
  function reset() {
    clearInterval(timer); timer = null;
    state = { name: state.name, email: state.email }; store.set(state);
    var name = state.name, email = state.email;
    panel.remove(); panel = null; thread = null; since = '';
    build(); panel.hidden = !isOpen;
    var f = panel.querySelector('.cw-form'); if (name) f.name.value = name; if (email) f.email.value = email;
  }

  // ---- unread badge while closed (peek=1 reads without marking messages as seen) -----------------------
  function markSeen(id) { if (id > lastSeen) { lastSeen = id; state.seen = id; store.set(state); } badge(0); }
  function badge(n) {
    document.querySelectorAll('.chat-float, .cta-chat').forEach(function (a) {
      var b = a.querySelector('.cw-badge');
      if (!n) { if (b) b.remove(); return; }
      if (!b) { b = el('span', 'cw-badge'); a.appendChild(b); }
      b.textContent = n > 9 ? '9+' : String(n);
    });
  }
  function peek() {
    if (isOpen || !state.token || document.visibilityState !== 'visible') return;
    fetch('/api/portal?t=' + T() + '&after=' + lastSeen + '&peek=1', { cache: 'no-store' })
      .then(function (r) { if (r.status === 404) { state = { name: state.name, email: state.email }; store.set(state); } return r.ok ? r.json() : null; })
      .then(function (d) { if (!d || isOpen) return; var n = (d.messages || []).filter(function (m) { return m.from !== 'you'; }).length; badge(n); })
      .catch(function () {});
  }
  function startPeek() { if (!peekTimer && state.token) { peek(); peekTimer = setInterval(peek, 45000); } }

  // ---- open / close ------------------------------------------------------------------------------------
  function open() {
    if (isOpen) { if (panel) panel.querySelector(state.token ? '.cw-composer textarea' : '.cw-form input').focus(); return; }
    isOpen = true;
    loadUi().then(function () {
      if (!panel) build();
      panel.hidden = false; document.documentElement.classList.add('cw-open');
      requestAnimationFrame(function () { panel.classList.add('in'); });
      if (state.token) showThread();
      else { var f = panel.querySelector('.cw-form'); if (window.innerWidth > 640) (f.name.value ? (f.email.value ? f.message : f.email) : f.name).focus(); }
      clearInterval(timer);
      var ticks = 0;
      timer = setInterval(function () { ticks++; if (thread && (document.visibilityState === 'visible' || ticks % 4 === 0)) load(false); }, 4000);
    }).catch(function () { isOpen = false; location.href = '/contact'; });
  }
  function close() {
    if (!panel) return;
    isOpen = false; clearInterval(timer); timer = null;
    panel.classList.remove('in'); document.documentElement.classList.remove('cw-open');
    setTimeout(function () { if (!isOpen) panel.hidden = true; }, 200);
    startPeek();
    var f = document.querySelector('.chat-float'); if (f && f.offsetParent) f.focus({ preventScroll: true });
  }

  document.addEventListener('click', function (e) {
    var a = e.target && e.target.closest ? e.target.closest('[data-chat-open]') : null;
    if (!a || e.ctrlKey || e.metaKey || e.shiftKey || e.button > 0) return;
    e.preventDefault(); open();
  });
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') { if (isOpen && thread) load(false); else peek(); } });
  window.CSWidget = { open: open, close: close };
  if (/[?&]chat=1\b/.test(location.search)) {
    try { var u = new URL(location.href); u.searchParams.delete('chat'); history.replaceState(null, '', u.pathname + u.search + u.hash); } catch (e) {}
    open();
  } else startPeek();
})();
