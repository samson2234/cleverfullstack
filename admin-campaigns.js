// admin-campaigns.js — CRM: Email campaigns. Campaign list, composer, reports, lists, import, suppressed addresses, settings,
// plus the audience chips (lists + tags) reused by the Contact modal, Lead modal and Inbox.
// All data from /api/admin (lib/campaigns.js, lib/contacts.js); the server enforces every permission and escapes everything sent.
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function token() { try { return sessionStorage.getItem('admin_token') || ''; } catch (e) { return ''; } }
  function api(method, path, body) {
    var o = { method: method, headers: { Authorization: 'Bearer ' + token(), 'Content-Type': 'application/json' } };
    if (body) o.body = JSON.stringify(body);
    return fetch('/api/admin' + path, o).then(function (r) {
      return r.json().then(function (d) { if (!r.ok) { var e = new Error(d.error || 'Request failed'); e.status = r.status; e.data = d; throw e; } return d; });
    });
  }
  function post(action, body) { return api('POST', '', Object.assign({ action: action }, body || {})); }
  function toast(msg) { if (window.showToast) window.showToast(msg); }
  function fail(e) { toast('Error: ' + e.message); }
  function canSend() { var r = document.body.getAttribute('data-role'); return r === 'owner' || r === 'admin'; }
  function canWrite() { return document.body.getAttribute('data-role') !== 'viewer'; }
  function when(s) {
    if (!s) return '—';
    var d = new Date(/T/.test(s) ? s : String(s).replace(' ', 'T') + 'Z');
    return isNaN(d.getTime()) ? s : d.toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  }
  var STATUS = { draft: ['Draft', ''], scheduled: ['Scheduled', ''], sending: ['Sending', 'ok'], paused: ['Paused', 'warn'], testing: ['A/B test running', 'ok'], sent: ['Sent', 'ok'], cancelled: ['Cancelled', 'off'] };
  function statusPill(s) { var x = STATUS[s] || [s, '']; return '<span class="tl-pill ' + x[1] + '">' + esc(x[0]) + '</span>'; }

  var state = { tab: 'campaigns', lists: [], settings: null, run: 0 };
  // a screen change stops any polling belonging to the old screen
  function newRun() { state.run++; clearTimeout(state.timer); return state.run; }

  function loadLists() { return api('GET', '?view=lists').then(function (d) { state.lists = d.lists || []; return state.lists; }); }
  function listOptions(sel, blank) {
    return (blank ? '<option value="">' + esc(blank) + '</option>' : '') + state.lists.map(function (l) { return '<option value="' + l.id + '"' + (+sel === +l.id ? ' selected' : '') + '>' + esc(l.name) + ' (' + l.members + ')</option>'; }).join('');
  }

  // ---------------- shell ----------------
  var TABS = [['campaigns', 'Campaigns'], ['lists', 'Lists'], ['import', 'Import'], ['suppressed', 'Do not email'], ['settings', 'Settings']];
  function shell(tab) {
    state.tab = tab;
    $('view-campaigns').innerHTML = '<div class="status-filter cp-tabs">' + TABS.map(function (t) {
      if (!canSend() && (t[0] === 'import' || t[0] === 'settings')) return '';
      return '<button class="chip' + (t[0] === tab ? ' active' : '') + '" data-cptab="' + t[0] + '">' + t[1] + '</button>';
    }).join('') + '</div><div id="cpBody"></div>';
    $('view-campaigns').querySelectorAll('[data-cptab]').forEach(function (b) { b.addEventListener('click', function () { go(b.getAttribute('data-cptab')); }); });
  }
  // what a screen shows depends on the role, which may still be loading on a direct link
  function ready() { return document.body.getAttribute('data-role') || !window.CSTools ? Promise.resolve() : window.CSTools.loadMe(); }
  function go(tab) {
    var run = newRun();
    ready().then(function () {
      if (run !== state.run) return;
      shell(tab);
      if (tab === 'campaigns') viewCampaigns();
      if (tab === 'lists') viewLists();
      if (tab === 'import') viewImport();
      if (tab === 'suppressed') viewSuppressed();
      if (tab === 'settings') viewSettings();
    });
  }
  function showView() { var t = document.querySelector('.tab[data-view="campaigns"]'); if (t && !t.classList.contains('active')) t.click(); }

  // ---------------- campaign list ----------------
  function viewCampaigns() {
    var run = state.run;
    $('cpBody').innerHTML = '<div class="tl-card muted">Loading…</div>';
    if (canSend()) post('camp_tick', {}).catch(function () {}); // anything scheduled or waiting on an A/B result that is now due
    Promise.all([api('GET', '?view=campaigns'), api('GET', '?view=campaign_settings')]).then(function (r) {
      if (run !== state.run) return;
      state.settings = r[1];
      var all = r[0].campaigns || [];
      var live = all.filter(function (c) { return !c.is_template; });
      var tpl = all.filter(function (c) { return c.is_template; });
      var s = r[1], notes = [];
      if (!s.email_ready) notes.push('Emails cannot be sent yet: RESEND_API_KEY is not set.');
      if (!s.postal_address) notes.push('Add your postal address in <a href="#" data-cptab2="settings">Settings</a> before sending. The law requires it in marketing email.');
      if (!s.webhook_ready) notes.push('Bounces, spam complaints and delivery are not being tracked yet. <a href="#" data-cptab2="settings">Connect the Resend webhook</a>.');
      $('cpBody').innerHTML = (canSend() ? '<div class="cp-bar"><button class="btn-sm primary" id="cpNew">+ New campaign</button></div>' : '') +
        (notes.length ? '<div class="cp-note">' + notes.map(function (n) { return '<div>' + n + '</div>'; }).join('') + '</div>' : '') +
        '<div class="table-wrap"><table class="table"><thead><tr><th>Campaign</th><th>Status</th><th>Sent on</th><th class="cp-n">Sent</th><th class="cp-n">Opened</th><th class="cp-n">Clicked</th><th class="cp-n">Bounced</th><th></th></tr></thead><tbody>' +
        (live.length ? live.map(row).join('') : '<tr><td colspan="8" class="empty-state">No campaigns yet.</td></tr>') + '</tbody></table></div>' +
        (tpl.length ? '<h3 class="cp-h">Templates</h3><div class="table-wrap"><table class="table"><tbody>' + tpl.map(function (c) {
          return '<tr><td><b>' + esc(c.name) + '</b><div class="muted small">' + esc(c.subject) + '</div></td><td class="cp-acts">' + (canSend() ? '<button class="btn-sm primary" data-copy="' + c.id + '">Use template</button> <button class="btn-sm ghost" data-edit="' + c.id + '">Edit</button> <button class="btn-sm danger" data-del="' + c.id + '">Delete</button>' : '') + '</td></tr>';
        }).join('') + '</tbody></table></div>' : '');
      if ($('cpNew')) $('cpNew').addEventListener('click', function () { compose({}); });
      $('cpBody').querySelectorAll('[data-cptab2]').forEach(function (a) { a.addEventListener('click', function (e) { e.preventDefault(); go(a.getAttribute('data-cptab2')); }); });
      $('cpBody').querySelectorAll('[data-open]').forEach(function (b) { b.addEventListener('click', function () { openReport(+b.getAttribute('data-open')); }); });
      $('cpBody').querySelectorAll('[data-edit]').forEach(function (b) { b.addEventListener('click', function () { api('GET', '?view=campaign&id=' + b.getAttribute('data-edit')).then(function (d) { compose(d.campaign); }).catch(fail); }); });
      $('cpBody').querySelectorAll('[data-copy]').forEach(function (b) { b.addEventListener('click', function () { post('camp_duplicate', { id: +b.getAttribute('data-copy') }).then(function (d) { return api('GET', '?view=campaign&id=' + d.id); }).then(function (d) { compose(d.campaign); }).catch(fail); }); });
      $('cpBody').querySelectorAll('[data-del]').forEach(function (b) { b.addEventListener('click', function () { if (confirm('Delete this campaign and its results? This cannot be undone.')) post('camp_delete', { id: +b.getAttribute('data-del') }).then(viewCampaigns).catch(fail); }); });
      // keep a send moving while this screen is open
      var sending = live.filter(function (c) { return c.status === 'sending'; })[0];
      if (sending && canSend()) ticker(sending.id, run, function (p) { if (p.status !== 'sending') viewCampaigns(); });
    }).catch(function (e) { $('cpBody').innerHTML = '<div class="tl-card">' + esc(e.message) + '</div>'; });
  }
  function row(c) {
    var s = c.stats, started = ['draft', 'scheduled'].indexOf(c.status) < 0;
    var cell = function (n, p) { return '<td class="cp-n">' + (started ? '<b>' + n + '</b>' + (p != null ? '<div class="muted small">' + p + '%</div>' : '') : '—') + '</td>'; };
    return '<tr><td><a href="#" class="cp-link" data-' + (started ? 'open' : 'edit') + '="' + c.id + '" onclick="return false"><b>' + esc(c.name) + '</b></a>' + (c.ab ? ' <span class="tl-pill">A/B</span>' : '') + '<div class="muted small">' + esc(c.subject) + '</div></td>' +
      '<td>' + statusPill(c.status) + '</td><td class="small">' + when(c.status === 'scheduled' ? c.schedule_at : c.started_at) + '</td>' +
      cell(s.sent) + cell(s.opened, s.rates.open) + cell(s.clicked, s.rates.click) + cell(s.bounced, s.rates.bounce) +
      '<td class="cp-acts">' + (started ? '<button class="btn-sm" data-open="' + c.id + '">Report</button>' : canSend() ? '<button class="btn-sm" data-edit="' + c.id + '">Edit</button>' : '') +
      (canSend() ? ' <button class="btn-sm ghost" data-copy="' + c.id + '">Copy</button>' + (['sending', 'testing'].indexOf(c.status) < 0 ? ' <button class="btn-sm danger" data-del="' + c.id + '">Delete</button>' : '') : '') + '</td></tr>';
  }

  // Keeps sending by calling tick again and again; each call runs up to 35s on the server.
  function ticker(id, run, onUpdate) {
    var loop = function () {
      if (run !== state.run) return;
      post('camp_tick', { id: id }).then(function (p) {
        if (run !== state.run) return;
        onUpdate(p);
        if (p.status !== 'sending') return;
        if (p.waiting === 'daily_limit') return; // tomorrow's daily run continues it
        state.timer = setTimeout(loop, p.waiting ? 30000 : 800);
      }).catch(function () { if (run === state.run) state.timer = setTimeout(loop, 15000); });
    };
    loop();
  }

  // ---------------- composer ----------------
  var BLOCK_LABEL = { heading: 'Heading', text: 'Text', button: 'Button', image: 'Image', divider: 'Divider' };
  function blockEditor(el, blocks, onChange) {
    function draw() {
      el.innerHTML = blocks.map(function (b, i) {
        var f = '';
        if (b.type === 'heading') f = '<input data-f="text" value="' + esc(b.text) + '" maxlength="300" placeholder="Heading">';
        if (b.type === 'text') f = '<textarea data-f="text" rows="4" maxlength="5000" placeholder="Hi {{first_name|there}}, ...">' + esc(b.text) + '</textarea>';
        if (b.type === 'button') f = '<div class="tl-row"><input data-f="text" value="' + esc(b.text) + '" maxlength="60" placeholder="Button text"><input data-f="url" type="url" value="' + esc(b.url) + '" placeholder="https://..."></div>';
        if (b.type === 'image') f = '<div class="tl-row"><input data-f="url" type="url" value="' + esc(b.url) + '" placeholder="Image address, https://..."><input data-f="alt" value="' + esc(b.alt) + '" maxlength="200" placeholder="Describe the image"></div>';
        return '<div class="cp-block" data-i="' + i + '"><div class="cp-block-h"><b>' + BLOCK_LABEL[b.type] + '</b><span><button type="button" class="btn-sm ghost" data-mv="-1" aria-label="Move up">↑</button> <button type="button" class="btn-sm ghost" data-mv="1" aria-label="Move down">↓</button> <button type="button" class="btn-sm danger" data-rm aria-label="Remove">×</button></span></div>' + f + '</div>';
      }).join('') + '<div class="tl-actions cp-add">' + Object.keys(BLOCK_LABEL).map(function (t) { return '<button type="button" class="btn-sm ghost" data-add="' + t + '">+ ' + BLOCK_LABEL[t] + '</button>'; }).join('') + '</div>';
    }
    el.addEventListener('input', function (e) {
      var box = e.target.closest('.cp-block'), k = e.target.getAttribute('data-f');
      if (box && k) { blocks[+box.getAttribute('data-i')][k] = e.target.value; onChange(); }
    });
    el.addEventListener('click', function (e) {
      var t = e.target, box = t.closest('.cp-block'), i = box ? +box.getAttribute('data-i') : -1;
      if (t.hasAttribute('data-add')) { blocks.push({ type: t.getAttribute('data-add'), text: '', url: '', alt: '' }); draw(); onChange(); }
      else if (t.hasAttribute('data-rm')) { blocks.splice(i, 1); draw(); onChange(); }
      else if (t.hasAttribute('data-mv')) {
        var j = i + +t.getAttribute('data-mv');
        if (j >= 0 && j < blocks.length) { var x = blocks[i]; blocks[i] = blocks[j]; blocks[j] = x; draw(); onChange(); }
      }
    });
    draw();
  }

  function compose(c) {
    var run = newRun();
    shell('campaigns');
    var ed = {
      id: c.id || 0, name: c.name || '', subject: c.subject || '', preview: c.preview || '', from_name: c.from_name || '', reply_to: c.reply_to || '', is_template: !!c.is_template,
      blocks: c.blocks && c.blocks.length ? c.blocks : [{ type: 'text', text: 'Hi {{first_name|there}},\n\n', url: '', alt: '' }],
      audience: Object.assign({ lists: [], tags: [], kinds: [] }, c.audience || {}),
      ab: Object.assign({ enabled: false, field: 'subject', subject_b: '', blocks_b: [], test_pct: 20, metric: 'open', wait_hours: 4 }, c.ab || {})
    };
    Promise.all([loadLists(), api('GET', '?view=campaign_settings'), api('GET', '?view=contact_stats').catch(function () { return {}; })]).then(function (r) {
      if (run !== state.run) return;
      var s = state.settings = r[1], st = r[2];
      var opt = function (arr, sel) { return (arr || []).map(function (x) { var v = x.label != null ? x.label : x; return '<option' + (v === sel ? ' selected' : '') + '>' + esc(v) + '</option>'; }).join(''); };
      var aud = ed.audience;
      var check = function (k, label, help) { return '<label class="cp-check"><input type="checkbox" data-aud="' + k + '"' + (aud[k] ? ' checked' : '') + '> <span>' + label + (help ? ' <small class="muted">' + help + '</small>' : '') + '</span></label>'; };
      $('cpBody').innerHTML = '<div class="cp-bar"><button class="btn-sm ghost" id="cpBack">← All campaigns</button></div><div class="cp-compose"><div class="cp-col">' +
        '<section class="tl-card"><h3>Details</h3><div class="tl-form col"><label>Campaign name (only you see this)<input id="edName" maxlength="80" value="' + esc(ed.name) + '" placeholder="e.g. November offer"></label>' +
        '<label>Subject line<input id="edSubject" maxlength="200" value="' + esc(ed.subject) + '" placeholder="Hi {{first_name|there}}, quick question"></label>' +
        '<label>Preview text (shown after the subject in the inbox)<input id="edPreview" maxlength="200" value="' + esc(ed.preview) + '"></label>' +
        '<div class="tl-row"><label>From name<input id="edFrom" maxlength="80" value="' + esc(ed.from_name) + '" placeholder="' + esc(s.from_name || 'CleverStack') + '"></label><label>Replies go to<input id="edReply" type="email" maxlength="200" value="' + esc(ed.reply_to) + '" placeholder="' + esc(s.reply_to || 'your usual address') + '"></label></div></div></section>' +
        '<section class="tl-card"><h3>Email</h3><p class="muted small">Personalise with {{first_name|there}}, {{name}}, {{company}}, {{country}} or any column you imported. The word after | is used if it is blank. In text, **bold** and [link text](https://...) work. Your address and an unsubscribe link are added automatically.</p><div id="edBlocks"></div></section>' +
        '<section class="tl-card"><h3>Who gets it</h3><p class="muted small">Anyone in any of the ticked groups. Unsubscribed, bounced and complained addresses are always left out.</p><div class="cp-aud">' +
        check('all', 'Everyone in your contacts') + check('subscribers', 'Newsletter subscribers') + check('leads', 'Website leads', '(vendor pitches excluded)') +
        state.lists.map(function (l) { return '<label class="cp-check"><input type="checkbox" data-audlist="' + l.id + '"' + (aud.lists.indexOf(+l.id) >= 0 ? ' checked' : '') + '> <span>' + esc(l.name) + ' <small class="muted">' + l.mailable + ' can be emailed</small></span></label>'; }).join('') +
        '</div><div class="tl-form col"><label>Also anyone tagged (comma separated)<input id="edTags" value="' + esc((aud.tags || []).join(', ')) + '" placeholder="vip, fiverr"></label>' +
        '<div class="tl-row"><label>Only this country<select id="edCountry"><option value="">Any</option>' + opt(st.countries, aud.country) + '</select></label><label>Only this industry<select id="edIndustry"><option value="">Any</option>' + opt(st.industries, aud.industry) + '</select></label></div></div><div class="cp-count" id="edCount"></div></section>' +
        '<section class="tl-card"><h3>A/B test</h3><label class="cp-check"><input type="checkbox" id="abOn"' + (ed.ab.enabled ? ' checked' : '') + '> <span>Test two versions on part of the audience, then send the winner to the rest</span></label><div id="abBox" style="display:' + (ed.ab.enabled ? 'block' : 'none') + '"><div class="tl-form col">' +
        '<label>What to test<select id="abField"><option value="subject"' + (ed.ab.field === 'subject' ? ' selected' : '') + '>Subject line</option><option value="content"' + (ed.ab.field === 'content' ? ' selected' : '') + '>Email content</option></select></label>' +
        '<label id="abSubL">Subject line B<input id="abSub" maxlength="200" value="' + esc(ed.ab.subject_b) + '"></label><div id="abBlocksL"><div class="muted small" style="margin-bottom:8px">Version B of the email</div><div id="edBlocksB"></div></div>' +
        '<div class="tl-row"><label>Test on<select id="abPct">' + [10, 20, 30, 40, 50].map(function (p) { return '<option value="' + p + '"' + (+ed.ab.test_pct === p ? ' selected' : '') + '>' + p + '% of the audience</option>'; }).join('') + '</select></label>' +
        '<label>Winner is the one with more<select id="abMetric"><option value="open"' + (ed.ab.metric !== 'click' ? ' selected' : '') + '>Opens</option><option value="click"' + (ed.ab.metric === 'click' ? ' selected' : '') + '>Clicks (more reliable)</option></select></label></div>' +
        '<label>Wait before choosing<select id="abWait">' + [1, 2, 4, 8, 12, 24, 48].map(function (h) { return '<option value="' + h + '"' + (+ed.ab.wait_hours === h ? ' selected' : '') + '>' + h + (h === 1 ? ' hour' : ' hours') + '</option>'; }).join('') + '</select></label>' +
        '<p class="muted small">The winner goes out when the wait is over and this screen is opened, or at the next daily run. You can also choose it yourself from the report.</p></div></div></section>' +
        '</div><div class="cp-col"><section class="tl-card cp-sticky"><div class="cp-prevh"><h3>Preview</h3><select id="prevVar" style="display:none"><option value="a">Version A</option><option value="b">Version B</option></select></div><div class="muted small" id="prevSubject"></div><div class="cp-preview" id="prevBody"></div>' +
        '<div class="tl-form"><input id="testTo" placeholder="Test addresses, comma separated" value="' + esc(s.seeds) + '"><button type="button" class="btn-sm" id="testBtn">Send test</button></div>' +
        '<p class="muted small">No tool can see inbox vs spam for your real recipients. Send a test to a Gmail, Outlook and Yahoo address of your own and look where it lands.</p>' +
        '<div class="cp-send"><button type="button" class="btn-sm ghost" id="saveBtn">Save draft</button><label class="cp-check small"><input type="checkbox" id="edTpl"' + (ed.is_template ? ' checked' : '') + '> Keep as a reusable template</label></div>' +
        '<div class="tl-form" id="sendRow"><input type="datetime-local" id="schedAt" aria-label="Send later"><button type="button" class="btn-sm" id="schedBtn">Schedule</button><button type="button" class="btn-sm primary" id="sendBtn">Send now</button></div><div id="sendMsg"></div></section></div></div>';

      $('cpBack').addEventListener('click', function () { go('campaigns'); });
      var dirty = function () { schedulePreview(); };
      blockEditor($('edBlocks'), ed.blocks, dirty);
      blockEditor($('edBlocksB'), ed.ab.blocks_b, dirty);
      var abShow = function () {
        $('abBox').style.display = ed.ab.enabled ? 'block' : 'none';
        $('abSubL').style.display = ed.ab.field === 'subject' ? '' : 'none';
        $('abBlocksL').style.display = ed.ab.field === 'content' ? '' : 'none';
        $('prevVar').style.display = ed.ab.enabled ? '' : 'none';
      };
      abShow();
      var read = function () {
        ed.name = $('edName').value; ed.subject = $('edSubject').value; ed.preview = $('edPreview').value; ed.from_name = $('edFrom').value; ed.reply_to = $('edReply').value;
        ed.is_template = $('edTpl').checked;
        var a = { all: false, subscribers: false, leads: false, lists: [], tags: [], kinds: [] };
        $('cpBody').querySelectorAll('[data-aud]').forEach(function (x) { a[x.getAttribute('data-aud')] = x.checked; });
        $('cpBody').querySelectorAll('[data-audlist]').forEach(function (x) { if (x.checked) a.lists.push(+x.getAttribute('data-audlist')); });
        a.tags = $('edTags').value.split(',').map(function (t) { return t.trim().toLowerCase(); }).filter(Boolean);
        a.country = $('edCountry').value; a.industry = $('edIndustry').value;
        ed.audience = a;
        ed.ab.enabled = $('abOn').checked; ed.ab.field = $('abField').value; ed.ab.subject_b = $('abSub').value; ed.ab.test_pct = +$('abPct').value; ed.ab.metric = $('abMetric').value; ed.ab.wait_hours = +$('abWait').value;
        return ed;
      };
      var pt, ct;
      function schedulePreview() { clearTimeout(pt); pt = setTimeout(preview, 450); }
      function preview() {
        if (run !== state.run) return;
        read();
        post('camp_preview', Object.assign({}, ed, { variant: $('prevVar').value })).then(function (p) {
          if (run !== state.run) return;
          $('prevSubject').textContent = 'From ' + p.from + ' · Subject: ' + (p.subject || '(no subject yet)');
          $('prevBody').innerHTML = p.html; // built and escaped by the server (lib/campaigns.js)
        }).catch(function () {});
      }
      function count() {
        if (run !== state.run) return;
        read();
        post('camp_audience', { audience: ed.audience }).then(function (d) {
          if (run !== state.run) return;
          $('edCount').innerHTML = '<b>' + d.total + '</b> people will get this' + (d.excluded ? ' <span class="muted">(' + d.excluded + ' left out: unsubscribed or bounced)</span>' : '') + (d.no_permission ? '<div class="cp-warn">' + d.no_permission + ' of them have no recorded permission. Sending to people who never agreed gets you marked as spam, and Resend does not allow purchased lists.</div>' : '');
          if (s.daily_limit && d.total > s.daily_limit) $('edCount').innerHTML += '<div class="muted small">Your daily limit is ' + s.daily_limit + ', so this will take about ' + Math.ceil(d.total / s.daily_limit) + ' days. Change it in Settings if your Resend plan allows more.</div>';
        }).catch(function () {});
      }
      $('cpBody').addEventListener('input', function (e) {
        if (e.target.closest('#edBlocks') || e.target.closest('#edBlocksB')) return;
        schedulePreview();
        if (e.target.closest('.cp-aud') || /^ed(Tags|Country|Industry)$/.test(e.target.id)) { clearTimeout(ct); ct = setTimeout(count, 350); }
      });
      $('cpBody').addEventListener('change', function (e) {
        if (/^(abOn|abField)$/.test(e.target.id)) { read(); abShow(); }
        if (e.target.closest('.cp-aud') || /^ed(Country|Industry)$/.test(e.target.id)) count();
        if (e.target.id === 'prevVar') preview();
      });
      var save = function () {
        read();
        return post('camp_save', ed).then(function (d) { ed.id = d.id; return d; });
      };
      $('saveBtn').addEventListener('click', function () { save().then(function () { toast(ed.is_template ? 'Template saved' : 'Draft saved'); }).catch(fail); });
      $('testBtn').addEventListener('click', function () {
        read();
        post('camp_test', Object.assign({}, ed, { emails: $('testTo').value.split(/[\s,;]+/).filter(Boolean) })).then(function (d) {
          var bad = d.results.filter(function (x) { return !x.ok; });
          toast(d.sent + ' test email' + (d.sent === 1 ? '' : 's') + ' sent' + (bad.length ? '. Failed: ' + bad[0].error : ''));
        }).catch(fail);
      });
      var start = function (schedule, confirmed) {
        var label = schedule ? 'scheduling' : 'sending';
        $('sendMsg').innerHTML = '';
        return save().then(function () { return post('camp_start', { id: ed.id, schedule_at: schedule || '', confirm_permission: !!confirmed }); }).then(function (r) {
          toast(r.scheduled ? 'Scheduled for ' + when(r.scheduled) : 'Sending started');
          if (r.scheduled) go('campaigns'); else openReport(ed.id);
        }).catch(function (e) {
          if (e.status === 409 && e.data && e.data.needs_confirmation) {
            $('sendMsg').innerHTML = '<div class="cp-warn"><b>' + e.data.summary.no_permission + ' of ' + e.data.summary.total + ' people have no recorded permission.</b> Only continue if they agreed to hear from you or know you. Complaints from cold lists can get your domain blocked.<label class="cp-check"><input type="checkbox" id="permOk"> I am allowed to email these people</label><button type="button" class="btn-sm primary" id="permGo" disabled>Continue ' + label + '</button></div>';
            $('permOk').addEventListener('change', function () { $('permGo').disabled = !$('permOk').checked; });
            $('permGo').addEventListener('click', function () { start(schedule, true); });
          } else $('sendMsg').innerHTML = '<div class="cp-warn">' + esc(e.message) + '</div>';
        });
      };
      $('sendBtn').addEventListener('click', function () {
        read();
        if (ed.is_template) return toast('Untick "Keep as a reusable template" to send this');
        if (confirm('Send "' + (ed.subject || ed.name) + '" now? This cannot be undone.')) start('');
      });
      $('schedBtn').addEventListener('click', function () {
        var v = $('schedAt').value;
        if (!v) return toast('Choose a date and time first');
        start(new Date(v).toISOString());
      });
      preview(); count();
    }).catch(function (e) { $('cpBody').innerHTML = '<div class="tl-card">' + esc(e.message) + '</div>'; });
  }

  // ---------------- report ----------------
  function openReport(id) {
    showView(); // first: opening the tab loads the campaign list, which this screen then replaces
    var run = newRun();
    var filter = '', offset = 0;
    var tile = function (label, n, p, warn) { return '<div class="cp-tile' + (warn ? ' bad' : '') + '"><span>' + label + '</span><b>' + n + '</b>' + (p != null ? '<small>' + p + '%</small>' : '') + '</div>'; };
    function draw() {
      return api('GET', '?view=campaign_report&id=' + id).then(function (r) {
        if (run !== state.run) return r;
        var c = r.campaign, s = r.stats, p = r.progress;
        var done = p.total ? Math.round(((p.done + p.failed_total + p.skipped) / p.total) * 100) : 0;
        var link = location.origin + r.campaign.report_link;
        $('cpBody').innerHTML = '<div class="cp-bar"><button class="btn-sm ghost" id="cpBack">← All campaigns</button><span class="cp-grow"></span><button class="btn-sm" id="cpCopyLink">Copy report link</button>' + (canSend() ? ' <button class="btn-sm ghost" id="cpDup">Send again as new</button>' : '') + '</div>' +
          '<section class="tl-card"><div class="cp-head"><div><h3>' + esc(c.name) + ' ' + statusPill(p.status) + '</h3><div class="muted small">Subject: ' + esc(c.subject) + ' · started ' + when(c.started_at) + (c.finished_at ? ' · finished ' + when(c.finished_at) : '') + '</div></div><div class="tl-actions" id="cpCtl"></div></div>' +
          (p.status !== 'sent' && p.total ? '<div class="cp-progress"><i style="width:' + done + '%"></i></div><div class="muted small" id="cpProg">' + p.done + ' of ' + p.total + ' sent' + (p.held ? ', ' + p.held + ' waiting for the A/B winner' : '') + (p.failed_total ? ', ' + p.failed_total + ' failed' : '') + '</div>' : '') +
          (p.last_error ? '<div class="cp-warn">' + esc(p.last_error) + '</div>' : '') + s.warnings.map(function (w) { return '<div class="cp-warn">' + esc(w) + '</div>'; }).join('') + '</section>' +
          '<div class="cp-tiles">' + tile('Sent', s.sent) + tile('Delivered', s.delivery_known ? s.delivered : '—', s.rates.delivery) + tile('Opened', s.opened, s.rates.open) + tile('Clicked', s.clicked, s.rates.click) + tile('Bounced', s.bounced, s.rates.bounce, s.sent >= 20 && s.rates.bounce > 2) + tile('Spam complaints', s.complained, s.rates.complaint, s.sent >= 20 && s.rates.complaint > 0.1) + tile('Unsubscribed', s.unsubscribed, s.rates.unsubscribe) + '</div>' +
          '<div class="cp-tiles">' + tile('Website visits', r.visits) + tile('Leads', r.leads) + tile('Won', r.won) + tile('Revenue', '$' + Number(r.revenue).toLocaleString()) + '</div>' +
          abPanel(r) +
          '<div class="tl-grid"><section class="tl-card"><h3>Activity by hour</h3>' + timeline(r.timeline) + '</section><section class="tl-card"><h3>Links clicked</h3>' + links(r.links) + '<h3 class="cp-h">Devices</h3>' + (r.devices.length ? r.devices.map(function (d) { return '<div class="tl-saved"><span style="flex:1;text-transform:capitalize">' + esc(d.device) + '</span><b>' + d.people + '</b></div>'; }).join('') : '<div class="muted small">No activity yet.</div>') + '</section></div>' +
          '<section class="tl-card"><h3>People</h3><div class="status-filter" id="cpFilters">' + [['', 'All'], ['opened', 'Opened'], ['not_opened', 'Not opened'], ['clicked', 'Clicked'], ['bounced', 'Bounced'], ['complained', 'Complained'], ['unsubscribed', 'Unsubscribed'], ['failed', 'Failed'], ['queued', 'Waiting']].map(function (f) { return '<button class="chip' + (f[0] === filter ? ' active' : '') + '" data-f="' + f[0] + '">' + f[1] + '</button>'; }).join('') + '</div><div id="cpPeople"></div></section>' +
          '<p class="muted small cp-foot">Opens are approximate: Apple Mail loads images automatically, and some apps block them. Clicks are reliable. Inbox vs spam placement and replies cannot be tracked. ' + (s.delivery_known ? '' : 'Delivered stays blank until the Resend webhook is connected in Settings.') + ' This page needs a CRM sign-in.</p>';
        $('cpBack').addEventListener('click', function () { if (location.hash.indexOf('#campaign-') === 0) history.replaceState(null, '', location.pathname); go('campaigns'); });
        $('cpCopyLink').addEventListener('click', function () { (navigator.clipboard ? navigator.clipboard.writeText(link) : Promise.reject()).then(function () { toast('Link copied'); }).catch(function () { window.prompt('Copy this:', link); }); });
        if ($('cpDup')) $('cpDup').addEventListener('click', function () { post('camp_duplicate', { id: id }).then(function (d) { return api('GET', '?view=campaign&id=' + d.id); }).then(function (d) { compose(d.campaign); }).catch(fail); });
        controls(p.status);
        $('cpFilters').querySelectorAll('[data-f]').forEach(function (b) { b.addEventListener('click', function () { filter = b.getAttribute('data-f'); offset = 0; $('cpFilters').querySelectorAll('.chip').forEach(function (x) { x.classList.toggle('active', x === b); }); people(); }); });
        people();
        $('cpBody').querySelectorAll('[data-winner]').forEach(function (b) { b.addEventListener('click', function () {
          if (!confirm('Send version ' + b.getAttribute('data-winner').toUpperCase() + ' to everyone who is left?')) return;
          post('camp_winner', { id: id, winner: b.getAttribute('data-winner') }).then(function () { return start(); }).catch(fail);
        }); });
        return r;
      });
    }
    function abPanel(r) {
      var a = r.ab;
      if (!a) return '';
      var v = a.variants, key = a.metric === 'click' ? 'click_rate' : 'open_rate', max = Math.max(v.a[key], v.b[key], 1);
      var bar = function (k, x) { return '<div class="ab-row"><b>' + k + '</b><div class="ab-bar"><i style="width:' + (x[key] / max * 100) + '%"></i></div><span class="small">' + x[key] + '% ' + (a.metric === 'click' ? 'clicked' : 'opened') + ' (' + x.sent + ' sent)</span></div>'; };
      var verdict = a.winner ? '<span class="tl-pill ok">Version ' + a.winner.toUpperCase() + ' won and went to the rest</span>'
        : r.progress.status === 'testing' ? '<span class="tl-pill">Waiting ' + a.wait_hours + 'h from when the test group finished</span>' + (canSend() ? ' <button class="btn-sm" data-winner="a">Send A to the rest</button> <button class="btn-sm" data-winner="b">Send B to the rest</button>' : '') : '';
      return '<section class="tl-card"><h3>A/B test: ' + (a.field === 'subject' ? 'subject line' : 'email content') + '</h3>' + (a.field === 'subject' ? '<div class="muted small">A: ' + esc(r.campaign.subject) + '<br>B: ' + esc(a.subject_b) + '</div>' : '') + bar('A', v.a) + bar('B', v.b) +
        '<div class="muted small" style="margin:8px 0">' + (a.confidence != null ? a.confidence + '% confidence this difference is real.' : '') + ' Small test groups often show a difference by chance.</div>' + verdict + '</section>';
    }
    function timeline(t) {
      if (!t.length) return '<div class="muted small">No opens or clicks yet.</div>';
      var max = Math.max.apply(null, t.map(function (x) { return x.opens + x.clicks; }).concat(1));
      return '<div class="cp-hours">' + t.slice(-48).map(function (x) {
        return '<div class="cp-hour"><span class="small muted">' + when(x.hour.replace(' ', 'T') + ':00Z') + '</span><div class="ab-bar"><i style="width:' + ((x.opens + x.clicks) / max * 100) + '%"></i></div><span class="small">' + x.opens + (x.opens === 1 ? ' open, ' : ' opens, ') + x.clicks + (x.clicks === 1 ? ' click' : ' clicks') + '</span></div>';
      }).join('') + '</div>';
    }
    function links(l) {
      if (!l.length) return '<div class="muted small">This email has no links.</div>';
      return l.map(function (x) { return '<div class="tl-saved"><code title="' + esc(x.url) + '">' + esc(x.url) + '</code><b>' + x.people + '</b><span class="small muted">' + (x.people === 1 ? 'person' : 'people') + '</span></div>'; }).join('');
    }
    function controls(status) {
      var el = $('cpCtl');
      if (!el || !canSend()) return;
      var b = [];
      if (status === 'sending') b.push(['pause', 'Pause', 'ghost']);
      if (status === 'paused') b.push(['resume', 'Resume', 'primary']);
      if (['sending', 'paused', 'testing'].indexOf(status) >= 0) b.push(['cancel', 'Cancel the rest', 'danger']);
      el.innerHTML = b.map(function (x) { return '<button class="btn-sm ' + x[2] + '" data-op="' + x[0] + '">' + x[1] + '</button>'; }).join('');
      el.querySelectorAll('[data-op]').forEach(function (x) { x.addEventListener('click', function () {
        var op = x.getAttribute('data-op');
        if (op === 'cancel' && !confirm('Stop sending to everyone who has not had it yet?')) return;
        post('camp_control', { id: id, op: op }).then(start).catch(fail);
      }); });
    }
    function people() {
      var wrap = $('cpPeople');
      if (!wrap) return;
      api('GET', '?view=campaign_recipients&limit=50&id=' + id + '&offset=' + offset + '&filter=' + filter).then(function (d) {
        if (run !== state.run || !$('cpPeople')) return;
        wrap.innerHTML = '<div class="table-wrap"><table class="table"><thead><tr><th>Person</th><th>Result</th><th>Sent</th><th>Opened</th><th>Clicked</th></tr></thead><tbody>' + (d.rows.length ? d.rows.map(function (r) {
          var result = r.complained_at ? 'Complained' : r.bounced_at ? 'Bounced' : r.unsubscribed_at ? 'Unsubscribed' : r.status === 'failed' ? 'Failed' : r.status === 'skipped' ? 'Skipped' : r.status === 'cancelled' ? 'Cancelled' : r.clicked_at ? 'Clicked' : r.opened_at ? 'Opened' : r.delivered_at ? 'Delivered' : r.sent_at ? 'Sent' : 'Waiting';
          return '<tr' + (r.contact_id ? ' style="cursor:pointer" onclick="window.__ctOpen&&window.__ctOpen(' + Number(r.contact_id) + ')"' : '') + '><td><b>' + esc(r.name || r.email) + '</b>' + (r.name ? '<div class="muted small">' + esc(r.email) + '</div>' : '') + '</td><td>' + result + (r.error ? '<div class="muted small">' + esc(r.error) + '</div>' : '') + '</td><td class="small">' + when(r.sent_at) + '</td><td class="small">' + (r.opened_at ? when(r.opened_at) + (+r.open_count > 1 ? ' (' + r.open_count + 'x)' : '') : '—') + '</td><td class="small">' + (r.clicked_at ? when(r.clicked_at) + (+r.click_count > 1 ? ' (' + r.click_count + 'x)' : '') : '—') + '</td></tr>';
        }).join('') : '<tr><td colspan="5" class="empty-state">Nobody here.</td></tr>') + '</tbody></table></div>' +
          (d.total > 50 ? '<div class="pager"><span>' + (offset + 1) + '-' + Math.min(offset + 50, d.total) + ' of ' + d.total + '</span><button id="cpPrev"' + (offset <= 0 ? ' disabled' : '') + '>Prev</button><button id="cpNext"' + (offset + 50 >= d.total ? ' disabled' : '') + '>Next</button></div>' : '');
        if ($('cpPrev')) $('cpPrev').addEventListener('click', function () { offset = Math.max(0, offset - 50); people(); });
        if ($('cpNext')) $('cpNext').addEventListener('click', function () { offset += 50; people(); });
      }).catch(function () {});
    }
    // sending moves on while the screen is open; the page redraws at most every few seconds
    function start() {
      return draw().then(function (r) {
        if (run !== state.run || !canSend() || !r) return;
        var p = r.progress;
        if (p.status === 'sending') {
          var last = 0;
          ticker(id, run, function (t) {
            var bar = document.querySelector('.cp-progress i');
            if (bar && t.total) bar.style.width = Math.round(((t.done + t.failed_total + t.skipped) / t.total) * 100) + '%';
            if ($('cpProg')) $('cpProg').textContent = t.done + ' of ' + t.total + ' sent' + (t.waiting === 'daily_limit' ? '. Daily limit reached: the rest continue tomorrow.' : t.waiting === 'provider' ? '. The email provider asked us to slow down, retrying shortly.' : '');
            if (t.status !== 'sending' || Date.now() - last > 20000) { last = Date.now(); if (t.status !== 'sending') draw(); }
          });
        } else if (p.status === 'testing') {
          post('camp_tick', { id: id }).catch(function () {});
          state.timer = setTimeout(function () { if (run === state.run) start(); }, 60000);
        }
      }).catch(function (e) { $('cpBody').innerHTML = '<div class="tl-card">' + esc(e.message) + '</div>'; });
    }
    ready().then(function () {
      if (run !== state.run) return;
      shell('campaigns');
      $('cpBody').innerHTML = '<div class="tl-card muted">Loading…</div>';
      start();
    });
  }

  // ---------------- lists ----------------
  function viewLists() {
    var run = state.run;
    $('cpBody').innerHTML = '<div class="tl-card muted">Loading…</div>';
    loadLists().then(function () {
      if (run !== state.run) return;
      $('cpBody').innerHTML = (canWrite() ? '<section class="tl-card"><h3>New list</h3><form class="tl-form" id="lsForm"><input id="lsName" maxlength="60" placeholder="List name" required><input id="lsDesc" maxlength="200" placeholder="What is it for? (optional)"><button class="btn-sm primary" type="submit">Create list</button></form></section>' : '') +
        '<div class="table-wrap"><table class="table"><thead><tr><th>List</th><th class="cp-n">People</th><th class="cp-n">Can be emailed</th><th></th></tr></thead><tbody>' + (state.lists.length ? state.lists.map(function (l) {
          return '<tr><td><b>' + esc(l.name) + '</b>' + (l.description ? '<div class="muted small">' + esc(l.description) + '</div>' : '') + '</td><td class="cp-n">' + l.members + '</td><td class="cp-n">' + l.mailable + '</td><td class="cp-acts"><button class="btn-sm" data-view="' + l.id + '">View people</button>' +
            (canSend() ? ' <button class="btn-sm primary" data-mail="' + l.id + '">Email this list</button>' : '') + (canWrite() ? ' <button class="btn-sm ghost" data-ren="' + l.id + '">Rename</button>' : '') + (canSend() ? ' <button class="btn-sm danger" data-del="' + l.id + '">Delete</button>' : '') + '</td></tr>';
        }).join('') : '<tr><td colspan="4" class="empty-state">No lists yet.</td></tr>') + '</tbody></table></div>' +
        '<p class="muted small cp-foot">Add people from the Import tab, from Clients &amp; Contacts, or from any lead or Inbox conversation. Deleting a list keeps the people in your contacts.</p>';
      if ($('lsForm')) $('lsForm').addEventListener('submit', function (e) { e.preventDefault(); post('list_create', { name: $('lsName').value, description: $('lsDesc').value }).then(viewLists).catch(fail); });
      $('cpBody').querySelectorAll('button[data-view]').forEach(function (b) { b.addEventListener('click', function (e) {
        e.stopPropagation();
        var t = document.querySelector('.tab[data-view="contacts"]');
        window.__ctPendingList = b.getAttribute('data-view');
        if (t) t.click();
      }); });
      $('cpBody').querySelectorAll('[data-mail]').forEach(function (b) { b.addEventListener('click', function () { compose({ audience: { lists: [+b.getAttribute('data-mail')] } }); }); });
      $('cpBody').querySelectorAll('[data-ren]').forEach(function (b) { b.addEventListener('click', function () {
        var id = +b.getAttribute('data-ren'), l = state.lists.filter(function (x) { return +x.id === id; })[0];
        var n = window.prompt('New name for this list:', l.name);
        if (n && n.trim()) post('list_update', { id: id, name: n.trim(), description: l.description }).then(viewLists).catch(fail);
      }); });
      $('cpBody').querySelectorAll('[data-del]').forEach(function (b) { b.addEventListener('click', function () { if (confirm('Delete this list? The people stay in your contacts.')) post('list_delete', { id: +b.getAttribute('data-del') }).then(viewLists).catch(fail); }); });
    }).catch(function (e) { $('cpBody').innerHTML = '<div class="tl-card">' + esc(e.message) + '</div>'; });
  }

  // ---------------- file reading (no libraries): CSV / TSV / TXT / JSON / XLSX, or any text containing email addresses ----------------
  var EMAIL_RE = /[A-Za-z0-9._%+'-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
  function decodeText(buf) {
    var b = new Uint8Array(buf);
    if (b[0] === 0xFF && b[1] === 0xFE) return new TextDecoder('utf-16le').decode(buf);
    if (b[0] === 0xFE && b[1] === 0xFF) return new TextDecoder('utf-16be').decode(buf);
    var t = new TextDecoder('utf-8').decode(buf);
    if (t.indexOf('�') >= 0) t = new TextDecoder('windows-1252').decode(buf); // old Excel CSV exports
    return t.replace(/^﻿/, '');
  }
  function parseDelimited(text) {
    var firstLine = (text.split(/\r?\n/).filter(function (l) { return l.trim(); })[0]) || '';
    var delim = ['\t', ';', ',', '|'].map(function (d) { return [d, firstLine.split(d).length]; }).sort(function (a, b) { return b[1] - a[1]; })[0];
    if (delim[1] < 2) delim = [',', 1];
    var d = delim[0], rows = [], row = [], cell = '', q = false;
    for (var i = 0; i < text.length; i++) {
      var c = text[i];
      if (q) { if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; }
      else if (c === '"' && cell === '') q = true;
      else if (c === d) { row.push(cell); cell = ''; }
      else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cell); cell = ''; if (row.some(function (x) { return x.trim(); })) rows.push(row); row = []; }
      else cell += c;
    }
    row.push(cell); if (row.some(function (x) { return x.trim(); })) rows.push(row);
    return rows;
  }
  function inflate(bytes) {
    var stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    return new Response(stream).arrayBuffer();
  }
  function unzip(buf) {
    var v = new DataView(buf), u8 = new Uint8Array(buf), end = -1;
    for (var i = buf.byteLength - 22; i >= 0 && i > buf.byteLength - 66000; i--) if (v.getUint32(i, true) === 0x06054b50) { end = i; break; }
    if (end < 0) throw new Error('This does not look like a valid .xlsx file');
    var count = v.getUint16(end + 10, true), p = v.getUint32(end + 16, true), files = {};
    for (var n = 0; n < count; n++) {
      if (v.getUint32(p, true) !== 0x02014b50) break;
      var method = v.getUint16(p + 10, true), size = v.getUint32(p + 20, true), nl = v.getUint16(p + 28, true), xl = v.getUint16(p + 30, true), cl = v.getUint16(p + 32, true), off = v.getUint32(p + 42, true);
      files[new TextDecoder().decode(u8.subarray(p + 46, p + 46 + nl))] = { method: method, size: size, off: off };
      p += 46 + nl + xl + cl;
    }
    return function read(name) {
      var f = files[name];
      if (!f) return Promise.resolve(null);
      var start = f.off + 30 + v.getUint16(f.off + 26, true) + v.getUint16(f.off + 28, true);
      var raw = u8.subarray(start, start + f.size);
      return (f.method === 0 ? Promise.resolve(raw.slice().buffer) : inflate(raw)).then(function (b) { return new TextDecoder().decode(b); });
    };
  }
  function xmlOf(text) { return new DOMParser().parseFromString(text, 'application/xml'); }
  function parseXlsx(buf) {
    var read = unzip(buf);
    return Promise.all([read('xl/sharedStrings.xml'), read('xl/workbook.xml'), read('xl/_rels/workbook.xml.rels')]).then(function (r) {
      var shared = [];
      if (r[0]) [].forEach.call(xmlOf(r[0]).getElementsByTagName('si'), function (si) { shared.push([].map.call(si.getElementsByTagName('t'), function (t) { return t.textContent; }).join('')); });
      // first worksheet in the workbook's own order
      var path = 'xl/worksheets/sheet1.xml';
      if (r[1] && r[2]) {
        var first = xmlOf(r[1]).getElementsByTagName('sheet')[0];
        var rid = first && (first.getAttribute('r:id') || first.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id'));
        [].forEach.call(xmlOf(r[2]).getElementsByTagName('Relationship'), function (x) {
          if (x.getAttribute('Id') === rid) { var t = x.getAttribute('Target'); path = t.charAt(0) === '/' ? t.slice(1) : 'xl/' + t; }
        });
      }
      return read(path).then(function (sheet) {
        if (!sheet) throw new Error('Could not find a worksheet in this file');
        var rows = [];
        [].forEach.call(xmlOf(sheet).getElementsByTagName('row'), function (rowEl) {
          var row = [];
          [].forEach.call(rowEl.getElementsByTagName('c'), function (c) {
            var col = 0, ref = (c.getAttribute('r') || '').replace(/[0-9]/g, '');
            for (var i = 0; i < ref.length; i++) col = col * 26 + ref.charCodeAt(i) - 64;
            var type = c.getAttribute('t'), vEl = c.getElementsByTagName('v')[0], val = '';
            if (type === 's' && vEl) val = shared[+vEl.textContent] || '';
            else if (type === 'inlineStr') val = [].map.call(c.getElementsByTagName('t'), function (t) { return t.textContent; }).join('');
            else if (vEl) val = vEl.textContent;
            row[(col || row.length + 1) - 1] = val;
          });
          for (var k = 0; k < row.length; k++) if (row[k] == null) row[k] = '';
          if (row.some(function (x) { return String(x).trim(); })) rows.push(row);
        });
        return rows;
      });
    });
  }
  function rowsFromText(text) {
    var t = text.trim();
    if (/^[\[{]/.test(t)) {
      try {
        var j = JSON.parse(t), arr = Array.isArray(j) ? j : (Object.values(j).filter(Array.isArray)[0] || []);
        if (arr.length && typeof arr[0] === 'object') {
          var keys = []; arr.forEach(function (o) { Object.keys(o || {}).forEach(function (k) { if (keys.indexOf(k) < 0 && typeof o[k] !== 'object') keys.push(k); }); });
          return [keys].concat(arr.map(function (o) { return keys.map(function (k) { return o && o[k] != null ? String(o[k]) : ''; }); }));
        }
      } catch (e) {}
    }
    var rows = parseDelimited(text);
    // a table has an email column. Otherwise (a pasted email thread, a vCard, notes) just collect the addresses.
    var clean = function (c) { return /^\s*[^\s@]+@[^\s@]+\.[^\s@]+\s*$/.test(c); };
    var data = rows.length && rows[0].some(function (c) { return /@/.test(c); }) ? rows : rows.slice(1); // the first row is a header unless it holds an address
    var width = rows.reduce(function (n, r) { return Math.max(n, r.length); }, 0), best = 0;
    for (var col = 0; col < width; col++) best = Math.max(best, data.filter(function (r) { return clean(r[col] || ''); }).length);
    var severalPerRow = rows.length <= 3 && rows.some(function (r) { return r.filter(clean).length > 1; }); // a short pasted list: a@x.com, b@y.com
    if (data.length && best / data.length > 0.5 && !severalPerRow) return rows;
    var seen = {}, found = (text.match(EMAIL_RE) || []).filter(function (e) { var k = e.toLowerCase(); if (seen[k]) return false; seen[k] = 1; return true; });
    return found.length ? [['Email']].concat(found.map(function (e) { return [e]; })) : [];
  }
  function readFile(file) {
    return file.arrayBuffer().then(function (buf) {
      var head = new Uint8Array(buf.slice(0, 8));
      if (head[0] === 0x50 && head[1] === 0x4B) {
        if (typeof DecompressionStream === 'undefined') throw new Error('This browser cannot open .xlsx files. Save it as CSV and try again.');
        return parseXlsx(buf);
      }
      if (head[0] === 0xD0 && head[1] === 0xCF) throw new Error('Old .xls files cannot be read. In Excel use Save As and choose .xlsx or CSV.');
      if (head[0] === 0x25 && head[1] === 0x50) throw new Error('PDF files cannot be read. Export the list as CSV or Excel instead.');
      return rowsFromText(decodeText(buf));
    });
  }
  window.CSCampaignParse = { rowsFromText: rowsFromText, parseXlsx: parseXlsx }; // for tests

  var FIELD_OPTS = [['', "Don't import"], ['email', 'Email'], ['name', 'Full name'], ['first_name', 'First name'], ['last_name', 'Last name'], ['company', 'Company'], ['phone', 'Phone'], ['country', 'Country'], ['industry', 'Industry'], ['extra', 'Keep as a merge field']];
  function guessField(h) {
    var s = String(h).toLowerCase().replace(/[^a-z]/g, '');
    if (/^(email|emailaddress|mail|emailid|workemail|personalemail|email1)$/.test(s) || /email/.test(s)) return 'email';
    if (/^(firstname|first|givenname|fname)$/.test(s)) return 'first_name';
    if (/^(lastname|last|surname|familyname|lname)$/.test(s)) return 'last_name';
    if (/^(name|fullname|contactname|contact|customer|customername|clientname)$/.test(s)) return 'name';
    if (/company|organi[sz]ation|business|employer|account/.test(s)) return 'company';
    if (/phone|mobile|tel|whatsapp/.test(s)) return 'phone';
    if (/country|nation/.test(s)) return 'country';
    if (/industry|sector|niche/.test(s)) return 'industry';
    return 'extra';
  }

  // ---------------- import ----------------
  function viewImport() {
    var run = state.run;
    loadLists().then(function () {
      if (run !== state.run) return;
      $('cpBody').innerHTML = '<section class="tl-card"><h3>Upload a list</h3><p class="muted small">CSV, Excel (.xlsx), TSV, JSON or text. You can also paste below, in any layout: if there is no table, every email address found is picked up.</p>' +
        '<div class="tl-form"><input type="file" id="imFile" accept=".csv,.tsv,.txt,.xlsx,.json,.vcf,text/*"></div><div class="tl-form col"><textarea id="imPaste" rows="4" placeholder="Or paste here..."></textarea></div><div class="tl-actions"><button class="btn-sm" id="imPasteBtn">Read pasted text</button></div><div id="imStep"></div></section>' +
        '<section class="tl-card"><h3>Add from your website</h3><p class="muted small">Website leads and newsletter subscribers are already in your contacts. This puts them in a list. Vendor pitches are never included.</p>' +
        '<form class="tl-form" id="siForm"><label>Who<select id="siSource"><option value="leads">Website leads</option><option value="subscribers">Newsletter subscribers</option></select></label><label id="siStatusL">Lead status<select id="siStatus"><option value="">Any</option><option value="new">New</option><option value="contacted">Contacted</option><option value="qualified">Qualified</option><option value="proposal">Proposal sent</option><option value="won">Won</option><option value="lost">Lost</option></select></label><label id="siSinceL">Since<input type="date" id="siSince"></label><label>Into list<select id="siList" required>' + listOptions(null, 'Choose a list') + '</select></label><button class="btn-sm primary" type="submit">Add to list</button></form><div id="siOut"></div></section>';
      $('imFile').addEventListener('change', function () {
        var f = $('imFile').files[0];
        if (!f) return;
        $('imStep').innerHTML = '<div class="muted small">Reading ' + esc(f.name) + '…</div>';
        readFile(f).then(function (rows) { mapping(rows, f.name); }).catch(function (e) { $('imStep').innerHTML = '<div class="cp-warn">' + esc(e.message) + '</div>'; });
      });
      $('imPasteBtn').addEventListener('click', function () { mapping(rowsFromText($('imPaste').value), 'Pasted list'); });
      $('siSource').addEventListener('change', function () { var l = $('siSource').value === 'leads'; $('siStatusL').style.display = l ? '' : 'none'; $('siSinceL').style.display = l ? '' : 'none'; });
      $('siForm').addEventListener('submit', function (e) {
        e.preventDefault();
        post('audience_import_site', { source: $('siSource').value, status: $('siStatus').value, since: $('siSince').value, list_id: +$('siList').value }).then(function (d) {
          $('siOut').innerHTML = '<div class="cp-count"><b>' + d.added + '</b> added to the list (' + d.matched + ' matched; the others were already in it).</div>';
        }).catch(fail);
      });
    }).catch(fail);
  }
  function mapping(rows, source) {
    var el = $('imStep');
    if (!rows.length) { el.innerHTML = '<div class="cp-warn">No email addresses found in that.</div>'; return; }
    var hasHeader = !rows[0].some(function (c) { return /@/.test(c); });
    var header = hasHeader ? rows[0] : rows[0].map(function (_, i) { return 'Column ' + (i + 1); });
    var body = hasHeader ? rows.slice(1) : rows;
    var fields = header.map(function (h, i) {
      var sample = body.slice(0, 20).map(function (r) { return r[i] || ''; });
      if (sample.some(function (c) { return /^\s*[^\s@]+@[^\s@]+\.[^\s@]+\s*$/.test(c); })) return 'email';
      return hasHeader ? guessField(h) : '';
    });
    var firstEmail = fields.indexOf('email');
    fields = fields.map(function (f, i) { return f === 'email' && i !== firstEmail ? '' : f; }); // only one email column
    el.innerHTML = '<h3 class="cp-h">' + esc(source) + ': ' + body.length + ' rows</h3><p class="muted small">Check each column.</p><div class="table-wrap"><table class="table cp-map"><thead><tr>' + header.map(function (h, i) {
      return '<th><div class="small">' + esc(h) + '</div><select data-col="' + i + '">' + FIELD_OPTS.map(function (o) { return '<option value="' + o[0] + '"' + (o[0] === fields[i] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select></th>';
    }).join('') + '</tr></thead><tbody>' + body.slice(0, 5).map(function (r) { return '<tr>' + header.map(function (_, i) { return '<td class="small">' + esc(r[i] || '') + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table></div>' +
      '<div class="tl-form col"><div class="tl-row"><label>Add to a list<select id="imList">' + listOptions(null, 'No list') + '</select></label><label>Or a new list<input id="imNewList" maxlength="60" placeholder="New list name"></label></div>' +
      '<label>Tags for everyone in this file (optional)<input id="imTags" placeholder="spring-2026, webinar"></label>' +
      '<label>How did you get these people?<select id="imConsent"><option value="">Choose one</option><option value="opted_in">They signed up to hear from us</option><option value="customer">They are current or past clients</option><option value="enquiry">They contacted us</option><option value="event">We met them (event, referral, business card)</option><option value="unknown">Not sure, or bought / scraped</option></select></label>' +
      '<p class="muted small">Importing is fine either way, and this is recorded per person. Resend\'s rules do not allow purchased or scraped lists, and sending to them can get your domain blocked.</p>' +
      '<button class="btn-sm primary" id="imGo" type="button">Import ' + body.length + ' rows</button></div><div id="imOut"></div>';
    $('imGo').addEventListener('click', function () {
      var cols = {};
      el.querySelectorAll('[data-col]').forEach(function (s) { cols[s.getAttribute('data-col')] = s.value; });
      var emails = Object.keys(cols).filter(function (k) { return cols[k] === 'email'; });
      if (emails.length !== 1) return toast('Choose exactly one Email column');
      var consent = $('imConsent').value;
      if (!consent) return toast('Choose how you got these people');
      var mapped = body.map(function (r) {
        var o = { extra: {} };
        Object.keys(cols).forEach(function (k) {
          var f = cols[k], v = String(r[k] == null ? '' : r[k]).trim();
          if (!f || !v) return;
          if (f === 'extra') o.extra[header[k]] = v; else o[f] = v;
        });
        if (o.email) { var m = o.email.match(EMAIL_RE); if (m) o.email = m[0]; }
        return o;
      });
      $('imGo').disabled = true;
      var totals = { created: 0, updated: 0, invalid: 0, duplicates: 0, suppressed: 0, added: 0 };
      var listId = $('imList').value;
      var ready = $('imNewList').value.trim() ? post('list_create', { name: $('imNewList').value.trim() }).then(function (d) { listId = d.id; }) : Promise.resolve();
      var size = 500, at = 0;
      var next = function () {
        if (at >= mapped.length) return finish();
        $('imOut').innerHTML = '<div class="muted small">Importing… ' + at + ' of ' + mapped.length + '</div>';
        return post('audience_import', { rows: mapped.slice(at, at + size), list_id: +listId || 0, tags: $('imTags').value, source: source, consent: consent }).then(function (d) {
          Object.keys(totals).forEach(function (k) { totals[k] += d[k] || 0; });
          at += size;
          return next();
        });
      };
      var finish = function () {
        var t = totals;
        $('imOut').innerHTML = '<div class="cp-count"><b>Import finished.</b> ' + t.created + ' new, ' + t.updated + ' already in contacts, ' + t.added + ' added to the list.<br>' +
          (t.invalid ? t.invalid + ' rows had no valid email and were skipped. ' : '') + (t.duplicates ? t.duplicates + ' duplicates in the file were merged. ' : '') + (t.suppressed ? t.suppressed + ' are on your do-not-email list and will not be emailed.' : '') + '</div>';
        $('imGo').disabled = false;
      };
      ready.then(next).catch(function (e) { $('imOut').innerHTML = '<div class="cp-warn">' + esc(e.message) + ' (imported ' + at + ' rows before this)</div>'; $('imGo').disabled = false; });
    });
  }

  // ---------------- suppressed ----------------
  var REASON = { unsubscribed: 'Unsubscribed', bounced: 'Bounced', complained: 'Spam complaint', manual: 'Added by you' };
  function viewSuppressed() {
    var run = state.run, q = '', offset = 0;
    $('cpBody').innerHTML = '<section class="tl-card"><h3>Do not email</h3><p class="muted small">These addresses are never sent campaigns or broadcasts. People who unsubscribed or complained cannot be put back.</p><div class="cp-tiles" id="spStats"></div>' +
      (canSend() ? '<div class="tl-form"><input id="spAdd" placeholder="Add addresses, separated by commas"><button class="btn-sm" id="spAddBtn">Add</button></div>' : '') + '</section><div class="leads-toolbar"><input type="text" class="search-box" id="spSearch" placeholder="Search email..."></div><div id="spList"></div>';
    function draw() {
      api('GET', '?view=suppressions&limit=50&offset=' + offset + '&q=' + encodeURIComponent(q)).then(function (d) {
        if (run !== state.run) return;
        var by = d.byReason || {};
        $('spStats').innerHTML = Object.keys(REASON).map(function (k) { return '<div class="cp-tile"><span>' + REASON[k] + '</span><b>' + (by[k] || 0) + '</b></div>'; }).join('');
        $('spList').innerHTML = '<div class="table-wrap"><table class="table"><thead><tr><th>Email</th><th>Why</th><th>Since</th><th></th></tr></thead><tbody>' + (d.rows.length ? d.rows.map(function (r) {
          return '<tr><td>' + esc(r.email) + '</td><td>' + esc(REASON[r.reason] || r.reason) + (r.detail ? '<div class="muted small">' + esc(r.detail) + '</div>' : '') + '</td><td class="small">' + when(r.created_at) + '</td><td class="cp-acts">' + (canSend() && (r.reason === 'manual' || r.reason === 'bounced') ? '<button class="btn-sm ghost" data-lift="' + esc(r.email) + '">Remove</button>' : '') + '</td></tr>';
        }).join('') : '<tr><td colspan="4" class="empty-state">Nobody here.</td></tr>') + '</tbody></table></div>' +
          (d.total > 50 ? '<div class="pager"><span>' + (offset + 1) + '-' + Math.min(offset + 50, d.total) + ' of ' + d.total + '</span><button id="spPrev"' + (offset <= 0 ? ' disabled' : '') + '>Prev</button><button id="spNext"' + (offset + 50 >= d.total ? ' disabled' : '') + '>Next</button></div>' : '');
        if ($('spPrev')) $('spPrev').addEventListener('click', function () { offset = Math.max(0, offset - 50); draw(); });
        if ($('spNext')) $('spNext').addEventListener('click', function () { offset += 50; draw(); });
        $('spList').querySelectorAll('[data-lift]').forEach(function (b) { b.addEventListener('click', function () { post('suppression_remove', { email: b.getAttribute('data-lift') }).then(draw).catch(fail); }); });
      }).catch(fail);
    }
    if ($('spAddBtn')) $('spAddBtn').addEventListener('click', function () { post('suppression_add', { emails: $('spAdd').value }).then(function (d) { toast(d.added + ' added'); $('spAdd').value = ''; draw(); }).catch(fail); });
    var t; $('spSearch').addEventListener('input', function () { clearTimeout(t); t = setTimeout(function () { q = $('spSearch').value.trim(); offset = 0; draw(); }, 300); });
    draw();
  }

  // ---------------- settings ----------------
  function viewSettings() {
    var run = state.run;
    api('GET', '?view=campaign_settings').then(function (s) {
      if (run !== state.run) return;
      var hook = location.origin + '/api/unsubscribe?webhook=resend';
      var yes = function (ok) { return ok ? '<span class="tl-pill ok">Connected</span>' : '<span class="tl-pill warn">Not connected</span>'; };
      $('cpBody').innerHTML = '<div class="tl-grid"><section class="tl-card"><h3>Sending</h3><form class="tl-form col" id="seForm">' +
        '<label>Your postal address (required by law, shown in every email)<textarea id="seAddr" rows="2" maxlength="300" placeholder="Street, city, region, postcode, country">' + esc(s.postal_address) + '</textarea></label>' +
        '<label>Most emails to send per day<input type="number" id="seLimit" min="1" value="' + s.daily_limit + '"></label><p class="muted small">Resend\'s free plan allows 100 a day and 3,000 a month. Paid plans remove the daily cap. When a campaign reaches this limit, it continues the next day.</p>' +
        '<div class="tl-row"><label>Default from name<input id="seFrom" maxlength="80" value="' + esc(s.from_name) + '" placeholder="CleverStack"></label><label>Default reply address<input id="seReply" type="email" maxlength="200" value="' + esc(s.reply_to) + '"></label></div>' +
        '<label>Your test mailboxes (up to 10)<input id="seSeeds" value="' + esc(s.seeds) + '" placeholder="you@gmail.com, you@outlook.com, you@yahoo.com"></label><p class="muted small">Pre-filled on "Send test", so you can check whether a campaign lands in the inbox or spam before sending it.</p>' +
        '<button class="btn-sm primary" type="submit">Save settings</button></form></section>' +
        '<section class="tl-card"><h3>Connections</h3><div class="tl-saved"><span style="flex:1">Resend (sending)</span>' + yes(s.email_ready) + '</div><div class="tl-saved"><span style="flex:1">Resend webhook (delivered, bounces, complaints)</span>' + yes(s.webhook_ready) + '</div>' +
        '<h3 class="cp-h">Connect the webhook</h3><ol class="tl-roles"><li>In Resend, open Webhooks and add this endpoint:<div class="tl-out">' + esc(hook) + '</div></li><li>Tick <b>email.delivered</b>, <b>email.bounced</b> and <b>email.complained</b>.</li><li>Copy its signing secret into Vercel as <b>RESEND_WEBHOOK_SECRET</b>, then redeploy.</li></ol><p class="muted small">Until this is done, bounced addresses stay on your lists and spam complaints go unseen. Do this before your first large send.</p></section></div>';
      $('seForm').addEventListener('submit', function (e) {
        e.preventDefault();
        post('camp_settings', { postal_address: $('seAddr').value, daily_limit: $('seLimit').value, from_name: $('seFrom').value, reply_to: $('seReply').value, seeds: $('seSeeds').value }).then(function () { toast('Settings saved'); viewSettings(); }).catch(fail);
      });
    }).catch(fail);
  }

  // ---------------- audience chips: Contact modal, Lead modal, Inbox header ----------------
  function chips(el, email, name) {
    if (!el) return;
    if (!email || !/@/.test(email)) { el.innerHTML = ''; return; }
    var key = el.getAttribute('data-email-key') !== email;
    el.setAttribute('data-email-key', email);
    if (key) el.innerHTML = '';
    var set = function (body) { post('audience_set', Object.assign({ email: email, name: name || '' }, body)).then(function () { chips(el, email, name); }).catch(fail); };
    api('GET', '?view=audience&email=' + encodeURIComponent(email)).then(function (a) {
      var edit = canWrite();
      var tags = Array.isArray(a.tags) ? a.tags : String(a.tags || '').split(',').filter(Boolean);
      var lists = a.lists || [], inList = lists.map(function (l) { return +l.id; });
      el.className = 'cp-chips';
      el.innerHTML = '<span class="cp-chips-l">Lists &amp; tags</span>' + lists.map(function (l) { return '<span class="cp-chip list">' + esc(l.name) + (edit ? '<button type="button" data-rml="' + l.id + '" aria-label="Remove from ' + esc(l.name) + '">×</button>' : '') + '</span>'; }).join('') +
        tags.map(function (t) { return '<span class="cp-chip">' + esc(t) + (edit ? '<button type="button" data-rmt="' + esc(t) + '" aria-label="Remove tag ' + esc(t) + '">×</button>' : '') + '</span>'; }).join('') +
        (a.suppressed ? '<span class="tl-pill warn">Do not email: ' + esc(REASON[a.suppressed] || a.suppressed) + '</span>' : '') +
        (edit ? '<select class="cp-chip-add" aria-label="Add to a list"><option value="">+ List</option>' + (a.all_lists || []).filter(function (l) { return inList.indexOf(+l.id) < 0; }).map(function (l) { return '<option value="' + l.id + '">' + esc(l.name) + '</option>'; }).join('') + '<option value="new">New list…</option></select><input class="cp-chip-tag" placeholder="+ Tag" maxlength="30" aria-label="Add a tag">' : '');
      el.querySelectorAll('[data-rml]').forEach(function (b) { b.addEventListener('click', function () { set({ list_id: +b.getAttribute('data-rml'), add: false }); }); });
      el.querySelectorAll('[data-rmt]').forEach(function (b) { b.addEventListener('click', function () { set({ remove_tag: b.getAttribute('data-rmt') }); }); });
      var sel = el.querySelector('.cp-chip-add');
      if (sel) sel.addEventListener('change', function () {
        if (sel.value === 'new') {
          var n = window.prompt('Name of the new list:');
          if (n && n.trim()) post('list_create', { name: n.trim() }).then(function (d) { set({ list_id: d.id, add: true }); }).catch(fail); else sel.value = '';
        } else if (sel.value) set({ list_id: +sel.value, add: true });
      });
      var tag = el.querySelector('.cp-chip-tag');
      if (tag) tag.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); if (tag.value.trim()) set({ add_tag: tag.value.trim() }); } });
    }).catch(function () { el.innerHTML = ''; });
  }

  // ---------------- Dashboard, Analytics and A/B tests panels ----------------
  function channelPanel(el) {
    if (!el) return;
    api('GET', '?view=campaigns_overview').then(function (o) {
      if (!o.count) { el.innerHTML = ''; return; }
      var t = o.totals;
      el.innerHTML = '<section class="tl-card"><div class="cp-head"><h3>Email campaigns</h3><button class="btn-sm ghost" data-allc>All campaigns</button></div><div class="cp-tiles">' +
        '<div class="cp-tile"><span>Emails sent</span><b>' + t.sent + '</b></div><div class="cp-tile"><span>Open rate</span><b>' + t.open_rate + '%</b></div><div class="cp-tile"><span>Click rate</span><b>' + t.click_rate + '%</b></div><div class="cp-tile"><span>Leads from email</span><b>' + t.leads + '</b></div></div>' +
        o.campaigns.map(function (c) { return '<div class="tl-saved"><a href="#" data-rep="' + c.id + '" style="flex:1;color:inherit"><b>' + esc(c.name) + '</b></a><span class="small muted">' + when(c.started_at) + '</span><span class="small">' + c.stats.sent + ' sent, ' + c.stats.rates.open + '% opened, ' + c.stats.rates.click + '% clicked</span></div>'; }).join('') + '</section>';
      el.querySelector('[data-allc]').addEventListener('click', function () { showView(); });
      el.querySelectorAll('[data-rep]').forEach(function (a) { a.addEventListener('click', function (e) { e.preventDefault(); openReport(+a.getAttribute('data-rep')); }); });
    }).catch(function () { el.innerHTML = ''; });
  }
  function abList(el) {
    if (!el) return;
    api('GET', '?view=campaigns').then(function (d) {
      var t = (d.campaigns || []).filter(function (c) { return c.ab && !c.is_template && ['draft', 'scheduled'].indexOf(c.status) < 0; });
      el.innerHTML = t.length ? t.map(function (c) {
        return '<div class="tl-saved"><a href="#" data-rep="' + c.id + '" style="flex:1;color:inherit"><b>' + esc(c.name) + '</b></a>' + statusPill(c.status) + (c.winner ? '<span class="tl-pill ok">Version ' + esc(String(c.winner).toUpperCase()) + ' won</span>' : '') + '</div>';
      }).join('') : '<div class="muted small">No email tests yet. Turn on the A/B test when composing a campaign.</div>';
      el.querySelectorAll('[data-rep]').forEach(function (a) { a.addEventListener('click', function (e) { e.preventDefault(); openReport(+a.getAttribute('data-rep')); }); });
    }).catch(function () {});
  }

  window.CSCampaigns = {
    load: function () { go('campaigns'); },
    openReport: openReport,
    newFor: function (audience) { showView(); compose({ audience: audience }); },
    chips: chips, channelPanel: channelPanel, abList: abList, lists: loadLists
  };
})();
