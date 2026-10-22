// admin-inbox.js — CRM Inbox: project conversations with clients (they reply on messages.html via a private link).
// Everything a client wrote is shown with textContent / escaping; the server enforces roles.
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
  var state = { filter: '', q: '', current: null, lastId: 0, timer: null };

  function when(s) { var d = new Date(String(s).replace(' ', 'T') + 'Z'); return isNaN(d) ? '' : d.toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); }
  function ago(s) { var d = new Date(String(s).replace(' ', 'T') + 'Z'), m = Math.round((Date.now() - d) / 60000); return isNaN(m) ? '' : m < 1 ? 'now' : m < 60 ? m + 'm' : m < 1440 ? Math.round(m / 60) + 'h' : Math.round(m / 1440) + 'd'; }

  function shell() {
    var v = $('view-inbox');
    if (v.getAttribute('data-ready')) return;
    v.setAttribute('data-ready', '1');
    v.innerHTML = '<div class="ib">' +
      '<aside class="ib-list"><div class="ib-tools"><input id="ibSearch" type="search" placeholder="Search name, email, subject"><button class="btn-sm primary ib-new" id="ibNew" type="button">New</button></div>' +
      '<div class="ib-filters" id="ibFilters">' + [['', 'All'], ['unread', 'Unread'], ['open', 'Open'], ['waiting', 'Waiting'], ['won', 'Won'], ['closed', 'Closed']].map(function (f) { return '<button type="button" data-f="' + f[0] + '" class="' + (f[0] === '' ? 'on' : '') + '">' + f[1] + '</button>'; }).join('') + '</div>' +
      '<div id="ibItems" class="ib-items"></div></aside>' +
      '<section class="ib-main" id="ibMain"><div class="ib-empty">Select a conversation, or start a new one.</div></section></div>';
    $('ibFilters').querySelectorAll('button').forEach(function (b) { b.addEventListener('click', function () { $('ibFilters').querySelectorAll('button').forEach(function (x) { x.classList.toggle('on', x === b); }); state.filter = b.getAttribute('data-f'); list(); }); });
    var t; $('ibSearch').addEventListener('input', function () { clearTimeout(t); t = setTimeout(function () { state.q = $('ibSearch').value.trim(); list(); }, 300); });
    $('ibNew').addEventListener('click', function () { compose({}); });
  }

  function list() {
    return api('GET', '?view=inbox&limit=100&status=' + encodeURIComponent(state.filter) + '&q=' + encodeURIComponent(state.q)).then(function (d) {
      badge(d.unread);
      $('ibItems').innerHTML = !d.conversations.length ? '<div class="ib-none">No conversations here yet.</div>' : d.conversations.map(function (c) {
        return '<button type="button" class="ib-item' + (state.current === c.id ? ' on' : '') + (c.unread_staff ? ' unread' : '') + '" data-id="' + c.id + '">' +
          '<span class="ib-top"><b>' + esc(c.client_name || c.client_email) + '</b><time>' + ago(c.last_message_at) + '</time></span>' +
          '<span class="ib-subj">' + esc(c.subject) + ' <em class="ib-st ' + c.status + '">' + STATUS[c.status] + '</em></span>' +
          '<span class="ib-prev">' + (c.last_sender === 'staff' ? 'You: ' : '') + esc(c.preview) + '</span>' + (c.unread_staff ? '<i class="ib-dot">' + c.unread_staff + '</i>' : '') + '</button>';
      }).join('');
      $('ibItems').querySelectorAll('.ib-item').forEach(function (b) { b.addEventListener('click', function () { open(+b.getAttribute('data-id')); }); });
    }).catch(function (e) { $('ibItems').innerHTML = '<div class="ib-none">' + esc(e.message) + '</div>'; });
  }

  function badge(n) {
    var b = $('inboxBadge'); if (!b) return;
    b.textContent = n; b.style.display = n ? '' : 'none';
  }

  function open(id) {
    state.current = id; state.lastId = 0;
    $('ibItems').querySelectorAll('.ib-item').forEach(function (b) { b.classList.toggle('on', +b.getAttribute('data-id') === id); });
    document.querySelector('.ib').classList.add('reading');
    var canWrite = role() !== 'viewer';
    $('ibMain').innerHTML = '<div class="ib-head" id="ibHead"></div><div class="ib-thread" id="ibThread"></div>' +
      (canWrite ? '<div class="ib-quick" id="ibQuick">' + QUICK.map(function (q, i) { return '<button type="button" data-q="' + i + '">' + q[0] + '</button>'; }).join('') + '</div>' +
      '<form class="ib-compose" id="ibCompose"><textarea id="ibBody" rows="2" maxlength="5000" placeholder="Write a reply… (Enter to send, Shift+Enter for a new line)"></textarea>' +
      '<div class="ib-send"><label class="ib-check"><input type="checkbox" id="ibMail" checked> Email the client too</label><button class="btn-sm primary" type="submit" id="ibSendBtn">Send</button></div></form>' : '<div class="ib-none">Read-only access.</div>');
    if (canWrite) {
      $('ibQuick').querySelectorAll('button').forEach(function (b) { b.addEventListener('click', function () { var t = $('ibBody'); t.value = (t.value ? t.value + '\n' : '') + QUICK[+b.getAttribute('data-q')][1]; t.focus(); }); });
      $('ibBody').addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); $('ibCompose').requestSubmit(); } });
      $('ibCompose').addEventListener('submit', function (e) {
        e.preventDefault();
        var text = $('ibBody').value.trim(); if (!text) return;
        $('ibSendBtn').disabled = true;
        api('POST', '', { action: 'msg_send', id: id, body: text, email: $('ibMail').checked }).then(function (r) {
          $('ibBody').value = ''; refresh(); list();
          if ($('ibMail').checked && !r.emailed) toast('Sent on the platform. Email not sent' + (r.emailError ? ': ' + r.emailError : ' (email not configured)'));
        }).catch(function (er) { alert(er.message); }).then(function () { $('ibSendBtn').disabled = false; });
      });
    }
    refresh(true);
    try { history.replaceState(null, '', '#inbox-' + id); } catch (e) {}
  }

  function head(c, link) {
    var canWrite = role() !== 'viewer';
    $('ibHead').innerHTML = '<button type="button" class="ib-back" id="ibBack" aria-label="Back to list">‹</button>' +
      '<div class="ib-who"><b>' + esc(c.client_name || c.client_email) + '</b><span>' + esc(c.client_email) + ' · ' + esc(c.subject) + '</span></div>' +
      '<div class="ib-actions">' + (canWrite ? '<select id="ibStatus">' + Object.keys(STATUS).map(function (s) { return '<option value="' + s + '"' + (s === c.status ? ' selected' : '') + '>' + STATUS[s] + '</option>'; }).join('') + '</select>' : '<em class="ib-st ' + c.status + '">' + STATUS[c.status] + '</em>') +
      (link ? '<button class="btn-sm ghost" id="ibCopy" type="button" title="Copy the client\'s private link">Copy client link</button>' : '') +
      (canWrite ? '<button class="btn-sm ghost" id="ibRotate" type="button" title="Make a new link; the old one stops working">New link</button>' : '') + '</div>';
    $('ibBack').addEventListener('click', function () { document.querySelector('.ib').classList.remove('reading'); });
    if ($('ibStatus')) $('ibStatus').addEventListener('change', function () { api('POST', '', { action: 'conv_status', id: c.id, status: this.value }).then(function () { toast('Status updated'); list(); }).catch(function (e) { alert(e.message); }); });
    if ($('ibCopy')) $('ibCopy').addEventListener('click', function () { var b = this; (navigator.clipboard ? navigator.clipboard.writeText(link) : Promise.reject()).then(function () { b.textContent = 'Copied ✓'; setTimeout(function () { b.textContent = 'Copy client link'; }, 1500); }).catch(function () { window.prompt('Client link:', link); }); });
    if ($('ibRotate')) $('ibRotate').addEventListener('click', function () {
      if (!confirm('Create a new private link? The current link (in emails already sent) will stop working. Send the new one to the client.')) return;
      api('POST', '', { action: 'conv_rotate', id: c.id }).then(function (r) { window.prompt('New client link (copy it and send it to the client):', r.link); refresh(true); }).catch(function (e) { alert(e.message); });
    });
  }

  function refresh(first) {
    var id = state.current; if (!id) return;
    api('GET', '?view=thread&id=' + id + '&after=' + (first ? 0 : state.lastId)).then(function (d) {
      if (state.current !== id) return;
      if (first) { head(d.conversation, d.link); $('ibThread').innerHTML = ''; }
      var th = $('ibThread'), atBottom = th.scrollHeight - th.scrollTop - th.clientHeight < 80;
      d.messages.forEach(function (m) {
        if (m.id <= state.lastId) return;
        state.lastId = m.id;
        var el = document.createElement('div'); el.className = 'ib-msg ' + (m.sender === 'client' ? 'them' : 'us');
        var b = document.createElement('div'); b.className = 'ib-bubble'; b.textContent = m.body;
        var meta = document.createElement('div'); meta.className = 'ib-meta'; meta.textContent = (m.sender === 'client' ? (d.conversation.client_name || 'Client') : (m.staff_name || 'CleverStack')) + ' · ' + when(m.created_at);
        el.appendChild(b); el.appendChild(meta); th.appendChild(el);
      });
      if (first || atBottom) th.scrollTop = th.scrollHeight;
    }).catch(function (e) { if (first) $('ibMain').innerHTML = '<div class="ib-empty">' + esc(e.message) + '</div>'; });
  }

  // New conversation (optionally prefilled from a lead)
  function compose(p) {
    if (role() === 'viewer') return;
    state.current = null;
    document.querySelector('.ib').classList.add('reading');
    $('ibMain').innerHTML = '<div class="ib-head"><button type="button" class="ib-back" id="ibBack2">‹</button><div class="ib-who"><b>New conversation</b><span>The client gets an email with a private link to reply on the website.</span></div></div>' +
      '<form class="ib-newform" id="ibNewForm"><div class="ib-row"><label>Name<input id="ncName" maxlength="120" value="' + esc(p.name || '') + '"></label><label>Email<input id="ncEmail" type="email" required value="' + esc(p.email || '') + '"></label></div>' +
      '<label>Subject<input id="ncSubject" maxlength="140" value="' + esc(p.subject || 'Your project') + '"></label>' +
      '<label>Message<textarea id="ncBody" rows="6" maxlength="5000" required>' + esc(p.body || '') + '</textarea></label>' +
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
    state.timer = setInterval(function () {
      var v = $('view-inbox'); if (!v || !v.classList.contains('active') || document.visibilityState !== 'visible') return;
      list(); if (state.current) refresh(false);
    }, 8000);
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
