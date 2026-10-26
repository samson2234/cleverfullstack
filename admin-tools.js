// admin-tools.js — CRM: signed-in user & roles, Team (owner), My account, Campaign links (UTM builder), A/B tests.
// All data from /api/admin; the server enforces every permission, the UI only hides what a role cannot use.
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
  function toast(msg) { if (window.showToast) window.showToast(msg); }
  function copy(text, btn) {
    (navigator.clipboard ? navigator.clipboard.writeText(text) : Promise.reject()).then(function () { var o = btn.textContent; btn.textContent = 'Copied ✓'; setTimeout(function () { btn.textContent = o; }, 1500); })
      .catch(function () { window.prompt('Copy this:', text); });
  }
  var ROLE_LABEL = { owner: 'Owner', admin: 'Admin', sales: 'Sales', viewer: 'Viewer' };
  var ROLE_HELP = { admin: 'Everything except managing the team', sales: 'Works leads, contacts and reviews. Cannot delete, export or send campaigns', viewer: 'Read-only' };
  var me = null;

  // ---------------- show / hide password (every password field, incl. ones added later) ----------------
  var EYE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
  var EYE_OFF = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>';
  function addToggle(input) {
    if (input.dataset.pwToggle) return;
    input.dataset.pwToggle = '1';
    var wrap = document.createElement('span'); wrap.className = 'pw-wrap';
    input.parentNode.insertBefore(wrap, input); wrap.appendChild(input);
    var b = document.createElement('button'); b.type = 'button'; b.className = 'pw-eye'; b.innerHTML = EYE;
    b.setAttribute('aria-label', 'Show password'); b.setAttribute('aria-pressed', 'false'); b.title = 'Show password';
    b.addEventListener('mousedown', function (e) { e.preventDefault(); }); // keep focus and the caret in the field
    b.addEventListener('click', function () {
      var show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      b.innerHTML = show ? EYE_OFF : EYE;
      b.setAttribute('aria-label', show ? 'Hide password' : 'Show password'); b.title = b.getAttribute('aria-label');
      b.setAttribute('aria-pressed', show ? 'true' : 'false');
    });
    wrap.appendChild(b);
    // mask again on submit so the browser saves it as a password
    if (input.form) input.form.addEventListener('submit', function () { if (input.type === 'text') b.click(); });
  }
  function scanPasswords(root) { [].forEach.call(root.querySelectorAll('input[type=password]'), addToggle); }
  scanPasswords(document);
  if (window.MutationObserver) new MutationObserver(function (list) {
    list.forEach(function (m) { [].forEach.call(m.addedNodes, function (n) { if (n.nodeType !== 1) return; if (n.matches('input[type=password]')) addToggle(n); else scanPasswords(n); }); });
  }).observe(document.body, { childList: true, subtree: true });

  // ---------------- signed-in user ----------------
  function loadMe() {
    return api('GET', '?view=me').then(function (d) {
      me = d.user;
      document.body.setAttribute('data-role', me.role);
      var box = $('sideUser');
      if (box) box.innerHTML = '<span class="su-avatar">' + esc((me.name || me.role).charAt(0).toUpperCase()) + '</span><span class="su-text tab-label"><b>' + esc(me.name || 'Owner') + '</b><small>' + ROLE_LABEL[me.role] + '</small></span>';
      if (me.must_change) {
        var n = $('mustChange'); if (n) n.style.display = 'flex';
      }
    }).catch(function () {});
  }

  // ---------------- Team (owner) ----------------
  function team() {
    var v = $('view-team');
    v.innerHTML = '<div class="tl-grid">' +
      '<section class="tl-card"><h3>Add a team member</h3><p class="muted">They get their own login. We email them their role, a temporary password and how to sign in; they will be asked to choose their own password.</p>' +
      '<form id="tmForm" class="tl-form"><input id="tmName" placeholder="Full name" maxlength="120" required><input id="tmEmail" type="email" placeholder="Email address" required>' +
      '<select id="tmRole"><option value="sales">Sales</option><option value="admin">Admin</option><option value="viewer">Viewer</option></select><button class="btn-sm primary" type="submit">Add member</button></form>' +
      '<div id="tmRoleHelp" class="muted small"></div><div id="tmNew"></div></section>' +
      '<section class="tl-card"><h3>Roles</h3><ul class="tl-roles"><li><b>Owner</b> (you, the admin password): everything, including the team</li><li><b>Admin</b>: ' + ROLE_HELP.admin + '</li><li><b>Sales</b>: ' + ROLE_HELP.sales + '</li><li><b>Viewer</b>: ' + ROLE_HELP.viewer + '</li></ul></section></div>' +
      '<section class="tl-card"><h3>Team</h3><div id="tmList"><div class="loading"><div class="spinner"></div></div></div></section>';
    var help = function () { $('tmRoleHelp').textContent = ROLE_HELP[$('tmRole').value]; }; help();
    $('tmRole').addEventListener('change', help);
    $('tmForm').addEventListener('submit', function (e) {
      e.preventDefault();
      api('POST', '', { action: 'team_create', name: $('tmName').value, email: $('tmEmail').value, role: $('tmRole').value }).then(function (r) {
        showPassword($('tmNew'), $('tmEmail').value, r); $('tmForm').reset(); help(); listTeam();
      }).catch(function (er) { alert(er.message); });
    });
    listTeam();
  }
  function showPassword(box, email, r) {
    var pw = r.password;
    var note = r.emailed ? 'Emailed to ' + esc(email) + ' with their role and sign-in steps. Shown only now, in case they need it.'
      : 'The email could not be sent' + (r.emailError ? ' (' + esc(r.emailError) + ')' : '') + '. Shown only now: share it with them privately.';
    box.innerHTML = '<div class="tl-secret"><div><b>' + (r.emailed ? '✓ ' : '') + 'Temporary password for ' + esc(email) + '</b><small>' + note + '</small></div><code>' + esc(pw) + '</code><button class="btn-sm" type="button">Copy</button></div>';
    toast(r.emailed ? 'Invite emailed to ' + email : 'Saved, but the email was not sent');
    box.querySelector('button').addEventListener('click', function () { copy(pw, this); });
  }
  function listTeam() {
    api('POST', '', { action: 'team_list' }).then(function (d) {
      var t = d.team || [];
      $('tmList').innerHTML = !t.length ? '<div class="muted">No team members yet. You are the only one with access.</div>' :
        '<div class="table-wrap"><table class="table"><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Last login</th><th></th></tr></thead><tbody>' +
        t.map(function (u) {
          return '<tr data-id="' + u.id + '"><td>' + esc(u.name || '-') + '</td><td>' + esc(u.email) + '</td>' +
            '<td><select class="tm-role">' + ['admin', 'sales', 'viewer'].map(function (r) { return '<option value="' + r + '"' + (u.role === r ? ' selected' : '') + '>' + ROLE_LABEL[r] + '</option>'; }).join('') + '</select></td>' +
            '<td>' + (u.active ? '<span class="tl-pill ok">Active</span>' : '<span class="tl-pill off">Disabled</span>') + (u.must_change ? ' <span class="tl-pill warn">Temp password</span>' : '') + '</td>' +
            '<td>' + esc(u.last_login || 'Never') + '</td>' +
            '<td class="tl-actions"><button class="btn-sm ghost tm-toggle">' + (u.active ? 'Disable' : 'Enable') + '</button><button class="btn-sm ghost tm-reset">Reset password</button><button class="btn-sm danger tm-del">Remove</button></td></tr>';
        }).join('') + '</tbody></table></div><div id="tmReset"></div>';
      $('tmList').querySelectorAll('tr[data-id]').forEach(function (tr) {
        var id = tr.getAttribute('data-id'), u = t.find(function (x) { return String(x.id) === id; });
        tr.querySelector('.tm-role').addEventListener('change', function () { api('POST', '', { action: 'team_update', id: id, role: this.value }).then(function () { toast('Role updated'); listTeam(); }).catch(function (e) { alert(e.message); }); });
        tr.querySelector('.tm-toggle').addEventListener('click', function () { api('POST', '', { action: 'team_update', id: id, active: !u.active }).then(listTeam).catch(function (e) { alert(e.message); }); });
        tr.querySelector('.tm-reset').addEventListener('click', function () { if (!confirm('Reset the password for ' + u.email + '? They will be signed out and emailed a new temporary password.')) return; api('POST', '', { action: 'team_reset_password', id: id }).then(function (r) { showPassword($('tmReset'), u.email, r); listTeam(); }).catch(function (e) { alert(e.message); }); });
        tr.querySelector('.tm-del').addEventListener('click', function () { if (!confirm('Remove ' + u.email + ' from the team? This cannot be undone.')) return; api('POST', '', { action: 'team_delete', id: id }).then(listTeam).catch(function (e) { alert(e.message); }); });
      });
    }).catch(function (e) { $('tmList').innerHTML = '<div class="muted">' + esc(e.message) + '</div>'; });
  }

  // ---------------- My account ----------------
  function account() {
    var v = $('view-account');
    if (!me) { v.innerHTML = '<div class="loading"><div class="spinner"></div></div>'; loadMe().then(account); return; }
    var owner = me.role === 'owner';
    v.innerHTML = '<div class="tl-grid"><section class="tl-card"><h3>' + esc(me.name || 'Owner') + '</h3><p class="muted">' + (me.email ? esc(me.email) + ' · ' : '') + ROLE_LABEL[me.role] + '</p>' +
      (owner ? '<p>You sign in with the owner password, which is set in Vercel as <code>ADMIN_PASSWORD</code>. To change it, update that variable in Vercel and redeploy.</p>' :
      '<form id="pwForm" class="tl-form col"><label>Current password<input type="password" id="pwCur" autocomplete="current-password" required></label>' +
      '<label>New password<input type="password" id="pwNew" autocomplete="new-password" minlength="10" required></label><small class="muted">At least 10 characters, with letters and numbers.</small>' +
      '<button class="btn-sm primary" type="submit">Change password</button></form>') + '</section></div>';
    if (!owner) $('pwForm').addEventListener('submit', function (e) {
      e.preventDefault();
      api('POST', '', { action: 'change_password', current: $('pwCur').value, next: $('pwNew').value }).then(function () { toast('Password changed'); $('pwForm').reset(); var n = $('mustChange'); if (n) n.style.display = 'none'; })
        .catch(function (er) { alert(er.message); });
    });
  }

  // ---------------- Campaign links (UTM builder) ----------------
  var SOURCES = [['google', 'cpc', 'Google Ads'], ['facebook', 'paid_social', 'Facebook ads'], ['instagram', 'paid_social', 'Instagram ads'], ['linkedin', 'paid_social', 'LinkedIn ads'], ['tiktok', 'paid_social', 'TikTok ads'], ['newsletter', 'email', 'Email / newsletter'], ['whatsapp', 'social', 'WhatsApp'], ['fiverr', 'referral', 'Fiverr profile']];
  var PAGES = [['/', 'Homepage'], ['/services', 'Services & pricing'], ['/services#budget', 'Budget planner'], ['/portfolio', 'Portfolio'], ['/reviews', 'Reviews'], ['/contact', 'Contact'], ['/web-development-usa', 'Web development USA'], ['/web-development-uk', 'Web development UK'], ['/web-development-europe', 'Web development Europe']];
  function slug(s) { return String(s || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60); }
  function utm() {
    var v = $('view-utm');
    v.innerHTML = '<div class="tl-grid"><section class="tl-card"><h3>Build a tracked link</h3><p class="muted">Use these links in every ad, email and post. Each visit and lead is then credited to the right campaign in Analytics.</p>' +
      '<div class="tl-form col">' +
      '<label>Landing page<select id="uPage">' + PAGES.map(function (p) { return '<option value="' + p[0] + '">' + p[1] + ' (' + p[0] + ')</option>'; }).join('') + '</select></label>' +
      '<label>Where will the link be posted?</label><div class="tl-chips" id="uSources">' + SOURCES.map(function (s, i) { return '<button type="button" class="tl-chip' + (i ? '' : ' on') + '" data-i="' + i + '">' + s[2] + '</button>'; }).join('') + '</div>' +
      '<div class="tl-row"><label>Source<input id="uSource" value="google"></label><label>Medium<input id="uMedium" value="cpc"></label></div>' +
      '<label>Campaign name<input id="uCampaign" placeholder="e.g. us-web-design-november"></label>' +
      '<label>Ad / variation (optional)<input id="uContent" placeholder="e.g. video-1, headline-b"></label>' +
      '</div></section>' +
      '<section class="tl-card"><h3>Your link</h3><div class="tl-out" id="uOut"></div><div class="tl-actions"><button class="btn-sm primary" id="uCopy" type="button">Copy link</button><button class="btn-sm" id="uSave" type="button">Save to list</button></div>' +
      '<p class="muted small">Tip: use the same campaign name in the ad platform so the numbers match. Lowercase, no spaces.</p>' +
      '<h3 style="margin-top:22px">Saved links</h3><div id="uSaved"></div></section></div>';
    function url() {
      var base = location.origin + $('uPage').value.split('#')[0];
      var hash = $('uPage').value.indexOf('#') > -1 ? '#' + $('uPage').value.split('#')[1] : '';
      var q = new URLSearchParams();
      q.set('utm_source', slug($('uSource').value) || 'unknown'); q.set('utm_medium', slug($('uMedium').value).replace(/-/g, '_') || 'unknown');
      q.set('utm_campaign', slug($('uCampaign').value) || 'campaign');
      if (slug($('uContent').value)) q.set('utm_content', slug($('uContent').value));
      return base + '?' + q.toString() + hash;
    }
    function render() { $('uOut').textContent = url(); }
    v.querySelectorAll('#uSources .tl-chip').forEach(function (b) {
      b.addEventListener('click', function () { v.querySelectorAll('#uSources .tl-chip').forEach(function (x) { x.classList.remove('on'); }); b.classList.add('on'); var s = SOURCES[+b.getAttribute('data-i')]; $('uSource').value = s[0]; $('uMedium').value = s[1]; render(); });
    });
    ['uPage', 'uSource', 'uMedium', 'uCampaign', 'uContent'].forEach(function (id) { $(id).addEventListener('input', render); $(id).addEventListener('change', render); });
    $('uCopy').addEventListener('click', function () { copy(url(), this); });
    function saved() { try { return JSON.parse(localStorage.getItem('crm_utm_links') || '[]'); } catch (e) { return []; } }
    function showSaved() {
      var list = saved();
      $('uSaved').innerHTML = !list.length ? '<div class="muted small">Nothing saved yet (saved in this browser).</div>' : list.map(function (l, i) { return '<div class="tl-saved"><code>' + esc(l) + '</code><button class="btn-sm ghost" data-c="' + i + '" type="button">Copy</button><button class="btn-sm ghost" data-d="' + i + '" type="button">×</button></div>'; }).join('');
      $('uSaved').querySelectorAll('[data-c]').forEach(function (b) { b.addEventListener('click', function () { copy(saved()[+b.getAttribute('data-c')], b); }); });
      $('uSaved').querySelectorAll('[data-d]').forEach(function (b) { b.addEventListener('click', function () { var l = saved(); l.splice(+b.getAttribute('data-d'), 1); try { localStorage.setItem('crm_utm_links', JSON.stringify(l)); } catch (e) {} showSaved(); }); });
    }
    $('uSave').addEventListener('click', function () { var l = saved(); var u = url(); if (l.indexOf(u) < 0) l.unshift(u); try { localStorage.setItem('crm_utm_links', JSON.stringify(l.slice(0, 50))); } catch (e) {} showSaved(); toast('Saved'); });
    render(); showSaved();
  }

  // ---------------- A/B tests ----------------
  var PRESETS = [
    ['/', '.hero .hero-sub', 'Homepage: text under the headline'],
    ['/', '.hero .hero-ctas .btn-primary', 'Homepage: main button'],
    ['/', '.hero .eyebrow', 'Homepage: small label above the headline'],
    ['/services', '#pricing .section-head h2', 'Services: pricing heading'],
    ['/services', '#budget .section-head h2', 'Services: budget planner heading'],
    ['/contact', '.page-hero h1', 'Contact: main heading']
  ];
  function abtests() {
    var v = $('view-abtests');
    var canEdit = me && (me.role === 'owner' || me.role === 'admin');
    v.innerHTML = (canEdit ? '<section class="tl-card"><h3>New A/B test</h3><p class="muted">Half of English-speaking visitors see your version B of one piece of text; the rest see the current text. The winner is the version that gets more people to your goal.</p>' +
      '<form id="abForm" class="tl-form col"><label>Test name<input id="abName" placeholder="e.g. Shorter homepage promise" maxlength="80" required></label>' +
      '<label>What to test<select id="abPreset">' + PRESETS.map(function (p, i) { return '<option value="' + i + '">' + p[2] + '</option>'; }).join('') + '</select></label>' +
      '<div class="muted small" id="abCurrent"></div>' +
      '<label>Version B text<textarea id="abText" rows="2" maxlength="300" required></textarea></label>' +
      '<label>Goal<select id="abGoal"><option value="lead">Became a lead (sent a form)</option><option value="contact">Clicked booking, WhatsApp, call or email</option><option value="cta">Clicked any call-to-action</option></select></label>' +
      '<button class="btn-sm primary" type="submit">Start test</button></form></section>' : '') +
      '<section class="tl-card"><h3>Tests</h3><p class="muted small">A winner is only declared with at least 100 visitors per version and 95% confidence. Until then, keep the test running.</p><div id="abList"><div class="loading"><div class="spinner"></div></div></div></section>';
    if (canEdit) {
      var showCurrent = function () {
        var p = PRESETS[+$('abPreset').value];
        $('abCurrent').innerHTML = 'Page <code>' + esc(p[0]) + '</code>, element <code>' + esc(p[1]) + '</code>. Current text: <span id="abCurText">loading…</span>';
        fetch(p[0] === '/' ? '/index.html' : p[0] + '.html').then(function (r) { return r.text(); }).then(function (h) {
          var d = new DOMParser().parseFromString(h, 'text/html'), el = d.querySelector(p[1]);
          var t = $('abCurText'); if (t) t.textContent = el ? '"' + el.textContent.trim() + '"' : '(element not found on that page)';
        }).catch(function () {});
      };
      $('abPreset').addEventListener('change', showCurrent); showCurrent();
      $('abForm').addEventListener('submit', function (e) {
        e.preventDefault();
        var p = PRESETS[+$('abPreset').value];
        api('POST', '', { action: 'ab_create', name: $('abName').value, page: p[0], selector: p[1], text_b: $('abText').value, goal: $('abGoal').value })
          .then(function () { toast('Test started'); $('abForm').reset(); showCurrent(); listAb(canEdit); }).catch(function (er) { alert(er.message); });
      });
    }
    listAb(canEdit);
  }
  function listAb(canEdit) {
    api('GET', '?view=ab_tests').then(function (d) {
      var t = d.tests || [];
      $('abList').innerHTML = !t.length ? '<div class="muted">No tests yet.</div>' : t.map(function (x) {
        var verdict = x.winner ? '<span class="tl-pill ok">Version ' + x.winner.toUpperCase() + ' wins (' + x.confidence + '% confidence)</span>'
          : !x.enough ? '<span class="tl-pill">Collecting data (' + (x.a.sessions + x.b.sessions) + ' visitors so far)</span>'
          : '<span class="tl-pill warn">No clear winner yet (' + x.confidence + '% confidence)</span>';
        var bar = function (k, s) { var max = Math.max(x.a.rate, x.b.rate, 1); return '<div class="ab-row"><b>' + k + '</b><div class="ab-bar"><i style="width:' + Math.round(s.rate / max * 100) + '%"></i></div><span>' + s.rate + '%</span><small>' + s.conversions + ' / ' + s.sessions + '</small></div>'; };
        return '<div class="ab-test"><div class="ab-head"><div><b>' + esc(x.name) + '</b> <span class="tl-pill ' + (x.status === 'running' ? 'ok' : 'off') + '">' + esc(x.status) + '</span><div class="muted small">' + esc(x.page) + ' · ' + esc(x.selector) + ' · goal: ' + esc(x.goalLabel) + ' · <a href="' + esc(x.page) + '?ab_preview=' + x.id + '" target="_blank" rel="noopener">preview B</a></div><div class="small">B: "' + esc(x.text_b) + '"</div></div>' +
          (canEdit ? '<div class="tl-actions">' + (x.status === 'running' ? '<button class="btn-sm ghost" data-s="paused" data-id="' + x.id + '">Pause</button>' : x.status === 'paused' ? '<button class="btn-sm ghost" data-s="running" data-id="' + x.id + '">Resume</button>' : '') +
          (x.status !== 'ended' ? '<button class="btn-sm" data-s="ended" data-id="' + x.id + '">End test</button>' : '') + '<button class="btn-sm danger" data-del="' + x.id + '">Delete</button></div>' : '') + '</div>' +
          bar('A', x.a) + bar('B', x.b) + '<div style="margin-top:8px">' + verdict + '</div></div>';
      }).join('');
      $('abList').querySelectorAll('[data-s]').forEach(function (b) { b.addEventListener('click', function () { api('POST', '', { action: 'ab_status', id: b.getAttribute('data-id'), status: b.getAttribute('data-s') }).then(function () { listAb(canEdit); }).catch(function (e) { alert(e.message); }); }); });
      $('abList').querySelectorAll('[data-del]').forEach(function (b) { b.addEventListener('click', function () { if (!confirm('Delete this test and its results?')) return; api('POST', '', { action: 'ab_delete', id: b.getAttribute('data-del') }).then(function () { listAb(canEdit); }).catch(function (e) { alert(e.message); }); }); });
    }).catch(function (e) { $('abList').innerHTML = '<div class="muted">' + esc(e.message) + '</div>'; });
  }

  var VIEWS = { team: team, account: account, utm: utm, abtests: function () { (me ? Promise.resolve() : loadMe()).then(abtests); } };
  window.CSTools = { load: function (name) { if (VIEWS[name]) VIEWS[name](); }, loadMe: loadMe };
})();
