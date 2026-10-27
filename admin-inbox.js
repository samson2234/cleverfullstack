// admin-inbox.js — CRM Inbox: project conversations with clients (they reply on messages.html via a private link).
// The thread and composer come from chat-ui.js (shared with the client page). Everything a client wrote is shown
// with textContent / escaping; the server enforces roles. Files are fetched with the staff token and shown as blob: URLs.
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function token() { try { return sessionStorage.getItem('admin_token') || ''; } catch (e) { return ''; } }
  function api(method, path, body) {
    var o = { method: method, headers: { Authorization: 'Bearer ' + token(), 'Content-Type': 'application/json' } };
    if (body) o.body = JSON.stringify(body);
    return fetch('/api/admin' + path, o).then(function (r) { return r.json().then(function (d) { if (!r.ok) throw new Error(d.error || 'Request failed'); return d; }); });
  }
  function toast(m) { if (window.showToast) window.showToast(m); }
  function role() { return document.body.getAttribute('data-role') || 'owner'; }
  var STATUS = { open: 'Open', waiting: 'Waiting on client', won: 'Won', closed: 'Closed' };
  var QUICK = [
    ['Thanks', 'Thanks for the details! I will review everything and get back to you shortly.'],
    ['Book a call', 'It would be great to talk this through. You can pick a time that suits you here: https://calendly.com/henryygeorge25/30min'],
    ['Need info', 'To give you an accurate plan and fixed price, could you share: your current website (if any), 2-3 sites you like, and your ideal launch date?'],
    ['Proposal sent', 'I have sent your proposal by email. Have a look and reply here with any questions.'],
    ['Follow up', 'Just checking in on this. Are you still planning to move ahead? Happy to answer any questions.']
  ];
  var state = { filter: '', q: '', current: null, conv: null, since: '', thread: null, busy: false, timer: null, ticks: 0, files: {}, items: {} };

  function ago(s) { var d = new Date(String(s).replace(' ', 'T') + 'Z'), m = Math.round((Date.now() - d) / 60000); return isNaN(m) ? '' : m < 1 ? 'now' : m < 60 ? m + 'm' : m < 1440 ? Math.round(m / 60) + 'h' : Math.round(m / 1440) + 'd'; }

  function shell() {
    var v = $('view-inbox');
    if (v.getAttribute('data-ready')) return;
    v.setAttribute('data-ready', '1');
    v.innerHTML = '<div class="ib">' +
      '<aside class="ib-list"><div class="ib-tools"><input id="ibSearch" type="search" placeholder="Search name, email, subject"><button class="btn-sm primary ib-new" id="ibNew" type="button">New</button></div>' +
      '<div class="ib-filters" id="ibFilters">' + [['', 'All'], ['unread', 'Unread'], ['open', 'Open'], ['waiting', 'Waiting'], ['won', 'Won'], ['closed', 'Closed'], ['archived', 'Archived']].map(function (f) { return '<button type="button" data-f="' + f[0] + '" class="' + (f[0] === '' ? 'on' : '') + '">' + f[1] + '</button>'; }).join('') + '</div>' +
      '<div id="ibItems" class="ib-items"></div></aside>' +
      '<section class="ib-main" id="ibMain"><div class="ib-empty">Select a conversation, or start a new one.</div></section></div>';
    $('ibFilters').querySelectorAll('button').forEach(function (b) { b.addEventListener('click', function () { $('ibFilters').querySelectorAll('button').forEach(function (x) { x.classList.toggle('on', x === b); }); state.filter = b.getAttribute('data-f'); list(); }); });
    var t; $('ibSearch').addEventListener('input', function () { clearTimeout(t); t = setTimeout(function () { state.q = $('ibSearch').value.trim(); list(); }, 300); });
    $('ibNew').addEventListener('click', function () { compose({}); });
  }

  function list() {
    return api('GET', '?view=inbox&limit=100&status=' + encodeURIComponent(state.filter) + '&q=' + encodeURIComponent(state.q)).then(function (d) {
      badge(d.unread);
      state.items = {};
      var canMenu = role() !== 'viewer';
      $('ibItems').innerHTML = !d.conversations.length ? '<div class="ib-none">' + (state.filter === 'archived' ? 'No archived conversations.' : 'No conversations here yet.') + '</div>' : d.conversations.map(function (c) {
        state.items[c.id] = c;
        return '<div role="button" tabindex="0" class="ib-item' + (state.current === c.id ? ' on' : '') + (c.unread_staff ? ' unread' : '') + (c.pinned ? ' pinned' : '') + '" data-id="' + c.id + '">' +
          '<span class="ib-top"><b>' + (c.pinned ? '<i class="ib-pin" title="Pinned">' + ICON.pin + '</i>' : '') + esc(c.client_name || c.client_email) + '</b><time>' + ago(c.last_message_at) + '</time></span>' +
          (canMenu ? '<button type="button" class="ib-more" aria-label="Conversation options" title="More options">' + ICON.dots + '</button>' : '') +
          '<span class="ib-subj">' + esc(c.subject) + ' <em class="ib-st ' + c.status + '">' + STATUS[c.status] + '</em></span>' +
          '<span class="ib-prev">' + (c.client_typing ? '<i class="ib-typing">typing…</i>' : (c.last_sender === 'staff' ? 'You: ' : '') + esc(c.preview)) + '</span>' + (c.unread_staff ? '<i class="ib-dot">' + c.unread_staff + '</i>' : '') + '</div>';
      }).join('');
      $('ibItems').querySelectorAll('.ib-item').forEach(function (b) {
        var cid = +b.getAttribute('data-id');
        b.addEventListener('click', function (e) { if (!e.target.closest('.ib-more')) open(cid); });
        b.addEventListener('keydown', function (e) { if ((e.key === 'Enter' || e.key === ' ') && e.target === b) { e.preventDefault(); open(cid); } });
        if (!canMenu) return;
        b.querySelector('.ib-more').addEventListener('click', function (e) { e.stopPropagation(); menu(state.items[cid], this); });
        b.addEventListener('contextmenu', function (e) { e.preventDefault(); menu(state.items[cid], { x: e.clientX, y: e.clientY }); });
      });
    }).catch(function (e) { $('ibItems').innerHTML = '<div class="ib-none">' + esc(e.message) + '</div>'; });
  }

  var ICON = {
    dots: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>',
    pin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 17v5M9 10.76V6h6v4.76l2 2.24v2H7v-2z"/><path d="M8 6h8V3H8z"/></svg>',
    unread: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="18" cy="6" r="3"/><path d="M13 4H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/></svg>',
    read: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>',
    archive: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="3" width="20" height="5" rx="1"/><path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8M10 12h4"/></svg>',
    copy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
    lead: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
    trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>'
  };

  // ⋯ menu for a conversation (list rows, right-click, and the open thread's header)
  function closeMenu() { var m = document.querySelector('.ib-menu'); if (m) { m.remove(); document.removeEventListener('mousedown', outside, true); document.removeEventListener('keydown', escKey, true); window.removeEventListener('resize', closeMenu); } }
  function outside(e) { if (!e.target.closest('.ib-menu')) closeMenu(); }
  function escKey(e) { if (e.key === 'Escape') closeMenu(); }
  function act(c, action, extra, msg) {
    return api('POST', '', Object.assign({ action: action, id: c.id }, extra || {})).then(function () { if (msg) toast(msg); list(); pollBadge(); });
  }
  function menu(c, anchor) {
    closeMenu();
    if (!c) return;
    var canDelete = role() === 'owner' || role() === 'admin';
    var items = [
      [ICON.pin, c.pinned ? 'Unpin' : 'Pin to top', function () { return act(c, 'conv_pin', { pinned: !c.pinned }, c.pinned ? 'Unpinned' : 'Pinned to top'); }],
      c.unread_staff ? [ICON.read, 'Mark as read', function () { return act(c, 'conv_read', null, 'Marked as read'); }]
        : [ICON.unread, 'Mark as unread', function () { return act(c, 'conv_unread', null, 'Marked as unread').then(function () { if (state.current === c.id) closeThread(); }); }],
      [ICON.archive, c.archived ? 'Unarchive' : 'Archive', function () {
        return act(c, 'conv_archive', { archived: !c.archived }, c.archived ? 'Moved back to the inbox' : 'Archived. Find it under "Archived"; it comes back if the client replies.')
          .then(function () { if (state.current === c.id && !c.archived) closeThread(); });
      }],
      [ICON.copy, 'Copy email address', function () { return (navigator.clipboard ? navigator.clipboard.writeText(c.client_email) : Promise.reject()).then(function () { toast('Email copied'); }).catch(function () { window.prompt('Email:', c.client_email); }); }],
      c.submission_id && window.__openLead ? [ICON.lead, 'Open the lead', function () { window.__openLead(c.submission_id); }] : null,
      'status',
      canDelete ? '-' : null,
      canDelete ? [ICON.trash, 'Delete conversation', function () {
        if (!confirm('Delete the conversation with ' + (c.client_name || c.client_email) + '?\n\nAll messages and files are removed for good, and the client\'s link stops working. The lead itself is kept.')) return;
        return act(c, 'conv_delete', null, 'Conversation deleted').then(function () { if (state.current === c.id) closeThread(); });
      }, 'danger'] : null
    ].filter(Boolean);
    var m = document.createElement('div');
    m.className = 'ib-menu'; m.setAttribute('role', 'menu');
    m.innerHTML = items.map(function (it, i) {
      if (it === '-') return '<hr>';
      if (it === 'status') return '<div class="ib-menu-st"><small>Status</small><div>' + Object.keys(STATUS).map(function (s) { return '<button type="button" role="menuitemradio" aria-checked="' + (s === c.status) + '" data-st="' + s + '" class="ib-st ' + s + (s === c.status ? ' cur' : '') + '">' + (s === 'waiting' ? 'Waiting' : STATUS[s]) + '</button>'; }).join('') + '</div></div>';
      return '<button type="button" role="menuitem" data-i="' + i + '"' + (it[3] ? ' class="' + it[3] + '"' : '') + '>' + it[0] + '<span>' + it[1] + '</span></button>';
    }).join('');
    document.body.appendChild(m);
    m.querySelectorAll('[data-i]').forEach(function (b) {
      b.addEventListener('click', function () { var f = items[+b.getAttribute('data-i')][2]; closeMenu(); var p = f(); if (p && p.catch) p.catch(function (e) { alert(e.message); }); });
    });
    m.querySelectorAll('[data-st]').forEach(function (b) {
      b.addEventListener('click', function () {
        var s = b.getAttribute('data-st'); closeMenu();
        act(c, 'conv_status', { status: s }, 'Status: ' + STATUS[s]).then(function () { var sel = $('ibStatus'); if (sel && state.current === c.id) sel.value = s; }).catch(function (e) { alert(e.message); });
      });
    });
    // position next to the ⋯ button (or the mouse), kept on screen
    var r = anchor.getBoundingClientRect ? anchor.getBoundingClientRect() : { left: anchor.x, right: anchor.x, top: anchor.y, bottom: anchor.y };
    var w = m.offsetWidth, h = m.offsetHeight;
    var x = Math.min(Math.max(8, (anchor.getBoundingClientRect ? r.right - w : r.left)), innerWidth - w - 8);
    var y = r.bottom + 4; if (y + h > innerHeight - 8) y = Math.max(8, r.top - h - 4);
    m.style.left = x + 'px'; m.style.top = y + 'px';
    var first = m.querySelector('button'); if (first) first.focus();
    setTimeout(function () { document.addEventListener('mousedown', outside, true); document.addEventListener('keydown', escKey, true); window.addEventListener('resize', closeMenu); });
  }
  function closeThread() {
    state.current = null; state.thread = null;
    $('ibMain').innerHTML = '<div class="ib-empty">Select a conversation, or start a new one.</div>';
    document.querySelector('.ib').classList.remove('reading');
    try { history.replaceState(null, '', '#inbox'); } catch (e) {}
  }

  function badge(n) {
    var b = $('inboxBadge'); if (!b) return;
    b.textContent = n; b.style.display = n ? '' : 'none';
  }

  // files need the staff token, so they are fetched and shown from memory (blob: URLs, cached per file)
  function fileBlob(convId, f, dl) {
    var key = convId + ':' + f.id;
    if (!dl && state.files[key]) return state.files[key];
    var p = fetch('/api/admin?view=file&conv=' + convId + '&id=' + f.id + (dl ? '&dl=1' : ''), { headers: { Authorization: 'Bearer ' + token() } })
      .then(function (r) { if (!r.ok) throw new Error('File not available'); return r.blob(); })
      .then(function (b) { return URL.createObjectURL(b); });
    if (!dl) { state.files[key] = p; p.catch(function () { delete state.files[key]; }); }
    return p;
  }
  function download(convId, f) {
    fileBlob(convId, f, true).then(function (u) { var a = document.createElement('a'); a.href = u; a.download = f.name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(u); }, 10000); })
      .catch(function (e) { alert(e.message); });
  }

  function open(id) {
    state.current = id; state.since = ''; state.conv = null; state.busy = false;
    $('ibItems').querySelectorAll('.ib-item').forEach(function (b) { b.classList.toggle('on', +b.getAttribute('data-id') === id); });
    document.querySelector('.ib').classList.add('reading');
    var canWrite = role() !== 'viewer';
    $('ibMain').innerHTML = '<div class="ib-head" id="ibHead"></div><div class="ib-thread" id="ibThread"></div>' +
      (canWrite ? '<div class="ib-quick" id="ibQuick">' + QUICK.map(function (q, i) { return '<button type="button" data-q="' + i + '">' + q[0] + '</button>'; }).join('') + '</div>' +
      '<form class="ib-compose" id="ibCompose"><textarea id="ibBody" rows="2" maxlength="5000" placeholder="Write a reply… (Enter to send, Shift+Enter for a new line). Drop or paste files here."></textarea>' +
      '<div class="ib-send"><div class="ib-send-l"><button type="button" class="ch-tool" id="ibAttach" aria-label="Attach a file" title="Attach a file (max 4 MB)">' + CSChat.ICON.clip + '</button>' +
      '<button type="button" class="ch-tool" id="ibEmoji" aria-label="Insert an emoji" title="Emoji">' + CSChat.ICON.smile + '</button>' +
      '<label class="ib-check"><input type="checkbox" id="ibMail" checked> Email the client too</label></div><button class="btn-sm primary" type="submit" id="ibSendBtn">Send</button></div></form>' : '<div class="ib-none">Read-only access.</div>');
    var staffMsg = function (m) { return canWrite && m.sender !== 'client'; };
    state.thread = CSChat.thread($('ibThread'), {
      mine: function (m) { return m.sender !== 'client'; },
      name: function (m) { return m.sender === 'client' ? ((state.conv && state.conv.client_name) || 'Client') : (m.staff_name || 'CleverStack'); },
      fileSrc: function (f) { return fileBlob(id, f, false); },
      download: function (f) { download(id, f); },
      canEdit: staffMsg, canDelete: staffMsg,
      onEdit: function (m, text) { return api('POST', '', { action: 'msg_edit', id: id, message_id: m.id, body: text }).then(function () { refresh(false, true); }); },
      onDelete: function (m) { return api('POST', '', { action: 'msg_delete', id: id, message_id: m.id }).then(function () { refresh(false, true); list(); }); }
    });
    if (canWrite) {
      $('ibQuick').querySelectorAll('button').forEach(function (b) { b.addEventListener('click', function () { var t = $('ibBody'); t.value = (t.value ? t.value + '\n' : '') + QUICK[+b.getAttribute('data-q')][1]; t.focus(); t.dispatchEvent(new Event('input')); }); });
      CSChat.composer({ form: $('ibCompose'), input: $('ibBody'), attach: $('ibAttach'), emoji: $('ibEmoji'), drop: $('ibMain'),
        onSend: function (text) { sendText(id, text); }, onFiles: function (files) { sendFiles(id, files); },
        onTyping: function () { api('POST', '', { action: 'msg_typing', id: id }).catch(function () {}); } });
    }
    refresh(true);
    try { history.replaceState(null, '', '#inbox-' + id); } catch (e) {}
  }

  function sendText(id, text) {
    var p = state.thread.pending(text, false), mail = $('ibMail') && $('ibMail').checked;
    api('POST', '', { action: 'msg_send', id: id, body: text, email: mail })
      .then(function (r) {
        refresh(false, true).then(p.done); list();
        if (mail && !r.emailed) toast('Sent on the platform. Email not sent' + (r.emailError ? ': ' + r.emailError : ' (email not configured)'));
      })
      .catch(function (e) { p.fail(e.message, function () { sendText(id, text); }); });
  }
  function sendFiles(id, files) {
    var mail = $('ibMail') && $('ibMail').checked;
    files.slice(0, 10).reduce(function (chain, file) {
      return chain.then(function () {
        return CSChat.prepareFile(file).then(function (f) {
          var p = state.thread.pending(f.name, true);
          return CSChat.upload('/api/admin?action=msg_upload&id=' + id + '&name=' + encodeURIComponent(f.name) + '&email=' + (mail ? '1' : '0'), f.blob, { Authorization: 'Bearer ' + token() }, p.progress)
            .then(function () { return refresh(false, true).then(p.done); })
            .catch(function (e) { p.fail(e.message, function () { sendFiles(id, [file]); }); });
        }, function (e) { alert(e.message); });
      });
    }, Promise.resolve()).then(function () { list(); });
    if (files.length > 10) toast('Up to 10 files at a time');
  }

  function head(c, link) {
    var canWrite = role() !== 'viewer';
    $('ibHead').innerHTML = '<button type="button" class="ib-back" id="ibBack" aria-label="Back to list">‹</button>' +
      '<div class="ib-who"><b>' + esc(c.client_name || c.client_email) + '</b><span>' + esc(c.client_email) + ' · ' + esc(c.subject) + '</span></div>' +
      '<div class="ib-actions">' + (canWrite ? '<select id="ibStatus">' + Object.keys(STATUS).map(function (s) { return '<option value="' + s + '"' + (s === c.status ? ' selected' : '') + '>' + STATUS[s] + '</option>'; }).join('') + '</select>' : '<em class="ib-st ' + c.status + '">' + STATUS[c.status] + '</em>') +
      (link ? '<button class="btn-sm ghost" id="ibCopy" type="button" title="Copy the client\'s private link">Copy client link</button>' : '') +
      (canWrite ? '<button class="btn-sm ghost" id="ibRotate" type="button" title="Make a new link; the old one stops working">New link</button>' : '') +
      (canWrite ? '<button class="ib-more ib-more-head" id="ibMore" type="button" aria-label="Conversation options" title="More options">' + ICON.dots + '</button>' : '') + '</div>';
    if ($('ibMore')) $('ibMore').addEventListener('click', function (e) { e.stopPropagation(); menu(Object.assign({}, c, state.items[c.id] || {}, { status: ($('ibStatus') || {}).value || c.status }), this); });
    $('ibBack').addEventListener('click', function () { document.querySelector('.ib').classList.remove('reading'); });
    if ($('ibStatus')) $('ibStatus').addEventListener('change', function () { api('POST', '', { action: 'conv_status', id: c.id, status: this.value }).then(function () { toast('Status updated'); list(); }).catch(function (e) { alert(e.message); }); });
    if ($('ibCopy')) $('ibCopy').addEventListener('click', function () { var b = this; (navigator.clipboard ? navigator.clipboard.writeText(link) : Promise.reject()).then(function () { b.textContent = 'Copied ✓'; setTimeout(function () { b.textContent = 'Copy client link'; }, 1500); }).catch(function () { window.prompt('Client link:', link); }); });
    if ($('ibRotate')) $('ibRotate').addEventListener('click', function () {
      if (!confirm('Create a new private link? The current link (in emails already sent) will stop working. Send the new one to the client.')) return;
      api('POST', '', { action: 'conv_rotate', id: c.id }).then(function (r) { window.prompt('New client link (copy it and send it to the client):', r.link); head(c, r.link); }).catch(function (e) { alert(e.message); });
    });
  }

  // first: load the whole thread; force: run even if a poll is in flight (after sending)
  function refresh(first, force) {
    var id = state.current; if (!id || (state.busy && !force)) return Promise.resolve();
    state.busy = true;
    var th = state.thread;
    return api('GET', '?view=thread&id=' + id + '&after=' + (first ? 0 : th.lastId()) + '&since=' + encodeURIComponent(state.since)).then(function (d) {
      if (state.current !== id || state.thread !== th) return;
      state.conv = d.conversation;
      if (first) head(d.conversation, d.link);
      var fresh = th.add(d.messages, { initial: first });
      th.update(d.changed || []);
      th.seen(d.seen);
      th.typing(d.typing, String(d.conversation.client_name || 'The client').split(' ')[0]);
      state.since = d.now || state.since;
      if (!first) CSChat.alert(fresh);
    }).catch(function (e) { if (first) $('ibMain').innerHTML = '<div class="ib-empty">' + esc(e.message) + '</div>'; })
      .then(function () { state.busy = false; });
  }

  // New conversation (optionally prefilled from a lead)
  function compose(p) {
    if (role() === 'viewer') return;
    state.current = null; state.thread = null;
    document.querySelector('.ib').classList.add('reading');
    $('ibMain').innerHTML = '<div class="ib-head"><button type="button" class="ib-back" id="ibBack2">‹</button><div class="ib-who"><b>New conversation</b><span>The client gets an email with a private link to reply on the website.</span></div></div>' +
      '<form class="ib-newform" id="ibNewForm"><div class="ib-row"><label>Name<input id="ncName" maxlength="120" value="' + esc(p.name || '') + '"></label><label>Email<input id="ncEmail" type="email" required value="' + esc(p.email || '') + '"></label></div>' +
      '<label>Subject<input id="ncSubject" maxlength="140" value="' + esc(p.subject || 'Your project') + '"></label>' +
      '<label>Message<textarea id="ncBody" rows="6" maxlength="5000" required>' + esc(p.body || '') + '</textarea></label>' +
      '<p class="ib-hint">You can send files once the conversation has started.</p>' +
      '<button class="btn-sm primary" type="submit">Send &amp; start conversation</button></form>';
    $('ibBack2').addEventListener('click', function () { document.querySelector('.ib').classList.remove('reading'); });
    $('ibNewForm').addEventListener('submit', function (e) {
      e.preventDefault();
      api('POST', '', { action: 'conv_create', name: $('ncName').value, email: $('ncEmail').value, subject: $('ncSubject').value, body: $('ncBody').value, submission_id: p.submission_id || null })
        .then(function (r) { toast(r.emailed ? 'Sent. The client was emailed their link.' : 'Conversation started (email not sent).'); list().then(function () { open(r.id); }); })
        .catch(function (er) { alert(er.message); });
    });
    $('ncBody').focus();
  }

  function load() {
    shell();
    list().then(function () {
      var m = location.hash.match(/^#inbox-(\d+)$/);
      if (m && !state.current) open(+m[1]);
    });
    clearInterval(state.timer);
    // open thread every 4s (new messages, Seen, typing); the list every 16s
    state.timer = setInterval(function () {
      var v = $('view-inbox'); if (!v || !v.classList.contains('active')) return;
      var visible = document.visibilityState === 'visible';
      state.ticks++;
      if (state.current && (visible || state.ticks % 4 === 0)) refresh(false);
      if (visible && state.ticks % 4 === 0) list();
    }, 4000);
  }

  // From a lead: open its existing conversation, or start one prefilled
  function fromLead(lead) {
    if (!lead) return;
    var tab = document.querySelector('.tab[data-view="inbox"]'); if (tab) tab.click();
    api('GET', '?view=lead_conversations&id=' + lead.id).then(function (d) {
      if (d.conversations && d.conversations.length) open(d.conversations[d.conversations.length - 1].id);
      else compose({ name: lead.name, email: lead.email, subject: 'Your enquiry', submission_id: lead.id, body: 'Hi ' + String(lead.name || '').split(' ')[0] + ',\n\n' });
    }).catch(function (e) { alert(e.message); });
  }

  // unread badge in the sidebar, refreshed in the background
  function pollBadge() { if (!token()) return; api('GET', '?view=inbox&limit=1').then(function (d) { badge(d.unread); }).catch(function () {}); }
  setInterval(function () { if (document.visibilityState === 'visible') pollBadge(); }, 60000);

  window.CSInbox = { load: load, fromLead: fromLead, pollBadge: pollBadge };
})();
