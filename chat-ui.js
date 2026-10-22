// chat-ui.js — shared chat building blocks for the client portal (messages.html) and the CRM Inbox.
// Messages are plain text: everything is inserted with textContent; links are built as elements (http/https only).
//   CSChat.thread(el, opts)    -> message list: day dividers, bubbles, files, edit/delete menu, Seen, typing, jump button, pending/failed sends
//   CSChat.composer(opts)      -> Enter to send, auto-grow, emoji picker, attach / paste / drag-and-drop files, typing pings
//   CSChat.prepareFile(file)   -> checks type/size, shrinks large photos; resolves { blob, name } or rejects with a friendly message
//   CSChat.upload(url, blob, headers, onProgress) -> XHR upload with progress
//   CSChat.lightbox(src, name, onDownload), CSChat.alert(count) (tab title + soft sound while the tab is hidden)
(function () {
  'use strict';
  var MAX_FILE = 4 * 1024 * 1024;
  var EXT = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'pdf', 'txt', 'csv', 'zip', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'];
  var ACCEPT = EXT.map(function (e) { return '.' + e; }).join(',');
  var EMOJI = ['😀', '😂', '😊', '😍', '🙂', '😅', '😎', '🤔', '😢', '🙏', '👍', '👏', '🙌', '👀', '🎉', '🔥', '✨', '💯', '✅', '❤️', '🚀', '💡', '📅', '📎'];
  var ICON = {
    clip: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>',
    smile: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>',
    doc: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>',
    more: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>'
  };

  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function parseTime(s) { var d = new Date(String(s || '').replace(' ', 'T') + 'Z'); return isNaN(d) ? null : d; }
  function size(n) { return n < 1024 ? n + ' B' : n < 1048576 ? Math.round(n / 1024) + ' KB' : (n / 1048576).toFixed(1) + ' MB'; }
  function extOf(name) { var m = String(name).match(/\.([A-Za-z0-9]{1,5})$/); return m ? m[1].toLowerCase() : ''; }

  // Text with clickable http(s) links, built as nodes (never HTML).
  function linkify(text) {
    var frag = document.createDocumentFragment(), re = /\bhttps?:\/\/[^\s<>"]+[^\s<>"'.,:;!?)\]]/g, last = 0, m;
    text = String(text || '');
    while ((m = re.exec(text))) {
      if (m.index > last) frag.appendChild(document.createTextNode(text.slice(last, m.index)));
      var a = el('a', 'ch-link', m[0]); a.href = m[0]; a.target = '_blank'; a.rel = 'noopener noreferrer nofollow';
      frag.appendChild(a); last = m.index + m[0].length;
    }
    if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
    return frag;
  }

  function closeMenus() { document.querySelectorAll('.ch-menu, .ch-emoji').forEach(function (m) { m.remove(); }); }
  document.addEventListener('click', function (e) { if (!e.target.closest('.ch-menu, .ch-more, .ch-emoji, .ch-emoji-btn')) closeMenus(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') { closeMenus(); var lb = document.querySelector('.ch-lightbox'); if (lb) lb.remove(); } });

  function popover(anchor, cls, build) {
    closeMenus();
    var p = el('div', cls); build(p);
    document.body.appendChild(p);
    var r = anchor.getBoundingClientRect(), w = p.offsetWidth, h = p.offsetHeight;
    var left = Math.min(Math.max(8, r.right - w), window.innerWidth - w - 8);
    var top = r.top - h - 6 < 8 ? r.bottom + 6 : r.top - h - 6;
    p.style.left = left + 'px'; p.style.top = top + 'px';
    return p;
  }

  function lightbox(src, name, onDownload) {
    var box = el('div', 'ch-lightbox'); box.setAttribute('role', 'dialog'); box.setAttribute('aria-label', name || 'Image');
    var img = el('img'); img.src = src; img.alt = name || '';
    var bar = el('div', 'ch-lb-bar'), title = el('span', '', name || ''), dl = el('button', 'ch-lb-btn', 'Download'), x = el('button', 'ch-lb-btn', 'Close');
    dl.type = x.type = 'button';
    dl.addEventListener('click', function (e) { e.stopPropagation(); onDownload && onDownload(); });
    x.addEventListener('click', function () { box.remove(); });
    box.addEventListener('click', function (e) { if (e.target === box) box.remove(); });
    bar.appendChild(title); if (onDownload) bar.appendChild(dl); bar.appendChild(x);
    box.appendChild(img); box.appendChild(bar); document.body.appendChild(box); x.focus();
  }

  // ---- thread -------------------------------------------------------------------------------------------
  function thread(root, o) {
    // o: mine(m), name(m), fileSrc(file) -> url | Promise<url>, download(file), canEdit(m), canDelete(m),
    //    onEdit(m, text) -> Promise, onDelete(m) -> Promise, otherName
    root.classList.add('ch-thread');
    root.textContent = '';
    var list = el('div', 'ch-list'), pending = el('div', 'ch-pendings'), typing = el('div', 'ch-typing'), jump = el('button', 'ch-jump', 'New messages ↓');
    typing.innerHTML = '<span class="ch-dots"><i></i><i></i><i></i></span><span class="ch-typing-t"></span>';
    typing.hidden = true; jump.type = 'button'; jump.hidden = true;
    root.appendChild(list); root.appendChild(pending); root.appendChild(typing); root.appendChild(jump);
    var byId = {}, lastDay = '', seenId = 0, lastId = 0;
    function atBottom() { return root.scrollHeight - root.scrollTop - root.clientHeight < 90; }
    function toBottom() { root.scrollTop = root.scrollHeight; jump.hidden = true; }
    jump.addEventListener('click', toBottom);
    root.addEventListener('scroll', function () { if (atBottom()) jump.hidden = true; });

    function fileNode(f) {
      if (f.image) {
        var wrap = el('button', 'ch-imgwrap'); wrap.type = 'button'; wrap.setAttribute('aria-label', 'Open image ' + f.name);
        var img = el('img', 'ch-img'); img.alt = f.name; img.loading = 'lazy';
        Promise.resolve(o.fileSrc(f)).then(function (u) { img.src = u; wrap.onclick = function () { lightbox(u, f.name, function () { o.download(f); }); }; }).catch(function () { wrap.replaceWith(fileCard(f)); });
        wrap.appendChild(img); return wrap;
      }
      return fileCard(f);
    }
    function fileCard(f) {
      var c = el('button', 'ch-file'); c.type = 'button'; c.title = 'Download ' + f.name;
      c.innerHTML = '<span class="ch-file-ic">' + ICON.doc + '</span>';
      var t = el('span', 'ch-file-t'); t.appendChild(el('b', '', f.name)); t.appendChild(el('small', '', (extOf(f.name) || 'file').toUpperCase() + ' · ' + size(f.size) + ' · Download'));
      c.appendChild(t); c.addEventListener('click', function () { o.download(f); });
      return c;
    }

    function fill(node, m) {
      var mine = o.mine(m);
      node.className = 'ch-msg ' + (mine ? 'mine' : 'them') + (m.deleted ? ' deleted' : '');
      node.textContent = '';
      var b = el('div', 'ch-bubble' + (m.file && !m.body && m.file.image ? ' media' : ''));
      if (m.deleted) b.textContent = 'This message was deleted';
      else {
        if (m.file) b.appendChild(fileNode(m.file));
        if (m.body) { var t = el('div', 'ch-text'); t.appendChild(linkify(m.body)); b.appendChild(t); }
      }
      var row = el('div', 'ch-row'); row.appendChild(b);
      var editable = !m.deleted && o.canEdit && o.canEdit(m), deletable = !m.deleted && o.canDelete && o.canDelete(m);
      if (!m.deleted && (m.body || m.file || editable || deletable)) {
        var more = el('button', 'ch-more'); more.type = 'button'; more.innerHTML = ICON.more; more.setAttribute('aria-label', 'Message options');
        more.addEventListener('click', function (e) {
          e.stopPropagation();
          popover(more, 'ch-menu', function (p) {
            function item(label, fn, danger) { var i = el('button', danger ? 'danger' : '', label); i.type = 'button'; i.addEventListener('click', function () { closeMenus(); fn(); }); p.appendChild(i); }
            if (m.body) item('Copy text', function () { if (navigator.clipboard) navigator.clipboard.writeText(m.body).catch(function () {}); });
            if (m.file) item('Download file', function () { o.download(m.file); });
            if (editable && !m.file) item('Edit', function () { edit(node, m); });
            if (deletable) item('Delete', function () { if (confirm('Delete this message? This cannot be undone.')) o.onDelete(m).catch(function (er) { alert(er.message); }); }, true);
          });
        });
        row.appendChild(more);
      }
      node.appendChild(row);
      var d = parseTime(m.created_at);
      var meta = el('div', 'ch-meta', o.name(m) + (d ? ' · ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) : '') + (m.edited && !m.deleted ? ' · edited' : ''));
      node.appendChild(meta);
    }
    function edit(node, m) {
      var row = node.querySelector('.ch-row'), box = el('div', 'ch-edit'), ta = el('textarea'), save = el('button', 'ch-btn primary', 'Save'), cancel = el('button', 'ch-btn', 'Cancel');
      ta.value = m.body; ta.maxLength = 5000; ta.rows = Math.min(8, m.body.split('\n').length + 1); save.type = cancel.type = 'button';
      var actions = el('div', 'ch-edit-a'); actions.appendChild(cancel); actions.appendChild(save);
      box.appendChild(ta); box.appendChild(actions); row.replaceWith(box); ta.focus();
      cancel.addEventListener('click', function () { fill(node, m); receipts(); });
      function go() { var v = ta.value.trim(); if (!v || v === m.body) { fill(node, m); receipts(); return; } save.disabled = true; o.onEdit(m, v).catch(function (er) { alert(er.message); fill(node, m); receipts(); }); }
      save.addEventListener('click', go);
      ta.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); go(); } else if (e.key === 'Escape') cancel.click(); });
    }
    function receipts() {
      list.querySelectorAll('.ch-receipt').forEach(function (r) { r.remove(); });
      var mineMsgs = list.querySelectorAll('.ch-msg.mine:not(.deleted)'), lastMine = mineMsgs[mineMsgs.length - 1];
      if (!lastMine) return;
      var id = +lastMine.getAttribute('data-id');
      lastMine.appendChild(el('div', 'ch-receipt' + (id <= seenId ? ' seen' : ''), id <= seenId ? 'Seen' : 'Sent'));
    }

    return {
      // add new messages (ignores ones already shown). Returns how many from the other side were added.
      add: function (msgs, opts) {
        var stick = (opts && opts.initial) || atBottom(), fresh = 0, mineAdded = false;
        msgs.forEach(function (m) {
          if (byId[m.id]) return;
          var d = parseTime(m.created_at), day = d ? d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' }) : '';
          if (day && day !== lastDay) { list.appendChild(el('div', 'ch-day', day)); lastDay = day; }
          var node = el('div'); node.setAttribute('data-id', m.id); fill(node, m); list.appendChild(node);
          byId[m.id] = { node: node, m: m }; lastId = Math.max(lastId, m.id);
          if (o.mine(m)) mineAdded = true; else fresh++;
        });
        receipts();
        if (stick || mineAdded) toBottom(); else if (fresh) jump.hidden = false;
        return fresh;
      },
      // edited / deleted messages
      update: function (msgs) { msgs.forEach(function (m) { var x = byId[m.id]; if (x && (x.m.edited !== m.edited || x.m.deleted !== m.deleted || x.m.body !== m.body)) { x.m = m; fill(x.node, m); } }); receipts(); },
      seen: function (id) { if (id !== seenId) { seenId = id || 0; receipts(); } },
      typing: function (on, who) { var b = atBottom(); typing.hidden = !on; typing.querySelector('.ch-typing-t').textContent = on ? (who || 'Someone') + ' is typing…' : ''; if (on && b) toBottom(); },
      lastId: function () { return lastId; },
      // optimistic bubble while sending; returns { progress(p), fail(message, retry), done() }
      pending: function (label, isFile) {
        var node = el('div', 'ch-msg mine pending'), b = el('div', 'ch-bubble'), meta = el('div', 'ch-meta', 'Sending…');
        if (isFile) { b.innerHTML = '<span class="ch-file-ic">' + ICON.clip + '</span>'; b.appendChild(document.createTextNode(' ' + label)); var bar = el('div', 'ch-progress'); bar.appendChild(el('i')); b.appendChild(bar); }
        else b.appendChild(linkify(label));
        var row = el('div', 'ch-row'); row.appendChild(b); node.appendChild(row); node.appendChild(meta); pending.appendChild(node); toBottom();
        return {
          progress: function (p) { var i = node.querySelector('.ch-progress i'); if (i) i.style.width = Math.round(p * 100) + '%'; meta.textContent = 'Uploading… ' + Math.round(p * 100) + '%'; },
          fail: function (msg, retry, discard) {
            node.classList.add('failed'); meta.textContent = '';
            meta.appendChild(document.createTextNode('Not sent' + (msg ? ': ' + msg : '') + ' '));
            if (retry) { var r = el('button', 'ch-linkbtn', 'Retry'); r.type = 'button'; r.addEventListener('click', function () { node.remove(); retry(); }); meta.appendChild(r); }
            var x = el('button', 'ch-linkbtn', 'Remove'); x.type = 'button'; x.addEventListener('click', function () { node.remove(); discard && discard(); }); meta.appendChild(x);
          },
          done: function () { node.remove(); }
        };
      },
      toBottom: toBottom
    };
  }

  // ---- composer -----------------------------------------------------------------------------------------
  function composer(o) {
    // o: form, input, attach, emoji, drop (element for drag-and-drop), onSend(text), onFiles([File]), onTyping()
    var input = o.input, lastPing = 0;
    function grow() { input.style.height = 'auto'; input.style.height = Math.min(200, input.scrollHeight) + 'px'; }
    input.addEventListener('input', function () {
      grow();
      if (o.onTyping && input.value.trim() && Date.now() - lastPing > 4000) { lastPing = Date.now(); o.onTyping(); }
    });
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && !('ontouchstart' in window && window.innerWidth < 700)) { e.preventDefault(); submit(); } });
    o.form.addEventListener('submit', function (e) { e.preventDefault(); submit(); });
    function submit() { var t = input.value.trim(); if (!t) return; input.value = ''; grow(); lastPing = 0; o.onSend(t); input.focus(); }
    if (o.attach) {
      var fi = el('input'); fi.type = 'file'; fi.multiple = true; fi.accept = ACCEPT; fi.hidden = true; o.form.appendChild(fi);
      o.attach.addEventListener('click', function () { fi.click(); });
      fi.addEventListener('change', function () { if (fi.files.length) o.onFiles([].slice.call(fi.files)); fi.value = ''; });
    }
    input.addEventListener('paste', function (e) {
      var files = [].slice.call((e.clipboardData && e.clipboardData.files) || []);
      if (files.length && o.onFiles) { e.preventDefault(); o.onFiles(files); }
    });
    if (o.drop && o.onFiles) {
      var depth = 0;
      o.drop.addEventListener('dragenter', function (e) { if (e.dataTransfer && [].indexOf.call(e.dataTransfer.types || [], 'Files') > -1) { depth++; o.drop.classList.add('ch-dragging'); } });
      o.drop.addEventListener('dragleave', function () { depth = Math.max(0, depth - 1); if (!depth) o.drop.classList.remove('ch-dragging'); });
      o.drop.addEventListener('dragover', function (e) { e.preventDefault(); });
      o.drop.addEventListener('drop', function (e) { e.preventDefault(); depth = 0; o.drop.classList.remove('ch-dragging'); var f = [].slice.call((e.dataTransfer && e.dataTransfer.files) || []); if (f.length) o.onFiles(f); });
    }
    if (o.emoji) {
      o.emoji.classList.add('ch-emoji-btn');
      o.emoji.addEventListener('click', function (e) {
        e.stopPropagation();
        if (document.querySelector('.ch-emoji')) { closeMenus(); return; }
        popover(o.emoji, 'ch-emoji', function (p) {
          EMOJI.forEach(function (em) {
            var b = el('button', '', em); b.type = 'button'; b.setAttribute('aria-label', 'Insert ' + em);
            b.addEventListener('click', function () {
              var s = input.selectionStart == null ? input.value.length : input.selectionStart, en = input.selectionEnd == null ? s : input.selectionEnd;
              input.value = input.value.slice(0, s) + em + input.value.slice(en); input.focus(); input.selectionStart = input.selectionEnd = s + em.length; grow();
            });
            p.appendChild(b);
          });
        });
      });
    }
    return { grow: grow };
  }

  // ---- files --------------------------------------------------------------------------------------------
  function prepareFile(file) {
    var name = file.name || ('image-' + Date.now() + '.png'), ext = extOf(name);
    if (!ext && /^image\/(png|jpeg|webp|gif)$/.test(file.type)) { ext = file.type.split('/')[1].replace('jpeg', 'jpg'); name += '.' + ext; }
    if (EXT.indexOf(ext) < 0) return Promise.reject(new Error(name + ': this file type is not supported. Send images, PDF, Word, Excel, PowerPoint, TXT, CSV or ZIP.'));
    var shrink = /^(jpg|jpeg|png|webp)$/.test(ext) && (file.size > 1.5 * 1024 * 1024);
    if (!shrink) return file.size > MAX_FILE ? Promise.reject(new Error(name + ' is ' + size(file.size) + '. Files can be up to 4 MB; for bigger files share a Google Drive or WeTransfer link.')) : Promise.resolve({ blob: file, name: name });
    // large photo: resize to max 2048px as JPEG (white behind transparent PNG areas)
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file), img = new Image();
      img.onload = function () {
        var k = Math.min(1, 2048 / Math.max(img.width, img.height)), c = document.createElement('canvas');
        c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
        var x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        c.toBlob(function (b) {
          if (!b || b.size > MAX_FILE) return reject(new Error(name + ' is too large even after shrinking. Files can be up to 4 MB.'));
          resolve({ blob: b, name: name.replace(/\.[^.]+$/, '') + '.jpg' });
        }, 'image/jpeg', 0.85);
      };
      img.onerror = function () { URL.revokeObjectURL(url); file.size > MAX_FILE ? reject(new Error(name + ' is larger than 4 MB.')) : resolve({ blob: file, name: name }); };
      img.src = url;
    });
  }
  function upload(url, blob, headers, onProgress) {
    return new Promise(function (resolve, reject) {
      var x = new XMLHttpRequest();
      x.open('POST', url);
      x.setRequestHeader('Content-Type', 'application/octet-stream');
      Object.keys(headers || {}).forEach(function (k) { x.setRequestHeader(k, headers[k]); });
      if (x.upload && onProgress) x.upload.onprogress = function (e) { if (e.lengthComputable) onProgress(e.loaded / e.total); };
      x.onload = function () { var d = {}; try { d = JSON.parse(x.responseText); } catch (e) {} if (x.status >= 200 && x.status < 300) resolve(d); else reject(new Error(d.error || (x.status === 413 ? 'Files can be up to 4 MB.' : 'Upload failed'))); };
      x.onerror = function () { reject(new Error('Network problem. Check your connection.')); };
      x.send(blob);
    });
  }

  // ---- attention ----------------------------------------------------------------------------------------
  var baseTitle = document.title, unseen = 0, audio = null;
  function alertNew(n) {
    if (document.visibilityState === 'visible' || !n) return;
    unseen += n; document.title = '(' + unseen + ') New message · ' + baseTitle;
    try {
      audio = audio || new (window.AudioContext || window.webkitAudioContext)();
      var g = audio.createGain(), s = audio.createOscillator(); s.type = 'sine'; s.frequency.value = 880;
      g.gain.setValueAtTime(0.0001, audio.currentTime); g.gain.exponentialRampToValueAtTime(0.08, audio.currentTime + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + 0.35);
      s.connect(g); g.connect(audio.destination); s.start(); s.stop(audio.currentTime + 0.4);
    } catch (e) { /* sound is optional */ }
  }
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible' && unseen) { unseen = 0; document.title = baseTitle; } });

  window.CSChat = { thread: thread, composer: composer, prepareFile: prepareFile, upload: upload, lightbox: lightbox, alert: alertNew, linkify: linkify, ICON: ICON, ACCEPT: ACCEPT, setBaseTitle: function (t) { baseTitle = t; } };
})();
