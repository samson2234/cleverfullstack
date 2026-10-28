// admin-analytics.js — the CRM's Analytics tab: KPIs with period-over-period change, traffic chart,
// breakdowns, funnel and recent visitor journeys. Data from /api/admin?view=analytics (first-party, cookieless).
// Everything that came from a visitor (paths, titles, click labels, referrers) is escaped before rendering.
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var state = { range: 'week', data: null, pagesTab: 'pages', techTab: 'devices', geoTab: 'countries', busy: false };
  var GA_URL = 'https://analytics.google.com/analytics/web/';
  var VERCEL_URL = 'https://vercel.com/dashboard';

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function clean(s) { return String(s == null ? '' : s).replace(/[\s\u2192\u203A\u00BB>]+$/, '').trim(); }
  function n(v) { return Number(v || 0).toLocaleString('en-US'); }
  function dur(s) { s = Math.round(s || 0); return s >= 60 ? Math.floor(s / 60) + 'm ' + String(s % 60).padStart(2, '0') + 's' : s + 's'; }
  function token() { try { return sessionStorage.getItem('admin_token') || ''; } catch (e) { return ''; } }
  function api(method, path, body) {
    var o = { method: method, headers: { Authorization: 'Bearer ' + token(), 'Content-Type': 'application/json' } };
    if (body) o.body = JSON.stringify(body);
    return fetch('/api/admin' + path, o).then(function (r) { return r.json().then(function (d) { if (!r.ok) throw new Error(d.error || 'Request failed'); return d; }); });
  }
  var regionNames = null;
  try { regionNames = new Intl.DisplayNames(['en'], { type: 'region' }); } catch (e) {}
  function flag(cc) { return '<span class="an-cc">' + (/^[A-Z]{2}$/.test(cc || '') ? cc : '··') + '</span>'; }
  function countryName(cc) { if (!cc) return 'Unknown'; try { return regionNames ? regionNames.of(cc) : cc; } catch (e) { return cc; } }
  var SOURCES = { 'google.com': 'Google', 'bing.com': 'Bing', 'duckduckgo.com': 'DuckDuckGo', 'facebook.com': 'Facebook', 'l.facebook.com': 'Facebook', 'm.facebook.com': 'Facebook', 'instagram.com': 'Instagram', 'l.instagram.com': 'Instagram', 't.co': 'X (Twitter)', 'x.com': 'X (Twitter)', 'linkedin.com': 'LinkedIn', 'lnkd.in': 'LinkedIn', 'youtube.com': 'YouTube', 'chatgpt.com': 'ChatGPT', 'perplexity.ai': 'Perplexity', 'fiverr.com': 'Fiverr' };
  var BARE = { google: 'Google', bing: 'Bing', facebook: 'Facebook', fb: 'Facebook', meta: 'Facebook', instagram: 'Instagram', ig: 'Instagram', linkedin: 'LinkedIn', twitter: 'X (Twitter)', x: 'X (Twitter)', youtube: 'YouTube', tiktok: 'TikTok', newsletter: 'Newsletter', email: 'Email', chatgpt: 'ChatGPT', fiverr: 'Fiverr' };
  function sourceName(s) { s = String(s || '').toLowerCase(); return !s ? 'Direct / none' : SOURCES[s] || BARE[s] || (/^google\./.test(s) ? 'Google' : s); }
  var ICON = { 'Google': 'google.com', 'Bing': 'bing.com', 'Facebook': 'facebook.com', 'Instagram': 'instagram.com', 'LinkedIn': 'linkedin.com', 'X (Twitter)': 'x.com', 'YouTube': 'youtube.com', 'TikTok': 'tiktok.com', 'ChatGPT': 'chatgpt.com', 'Fiverr': 'fiverr.com', 'Perplexity': 'perplexity.ai', 'DuckDuckGo': 'duckduckgo.com' };
  function mergeSources(list) { var m = {}, out = []; list.forEach(function (r) { var k = sourceName(r.source); if (!m[k]) { m[k] = { name: k, host: ICON[k] || r.source, sessions: 0, leads: 0, raw: [] }; out.push(m[k]); } m[k].sessions += r.sessions; m[k].leads += r.leads; m[k].raw.push(r.source || '(none)'); }); return out.sort(function (a, b) { return b.sessions - a.sessions; }); }
  function favicon(host) { return /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(host || '') ? '<img alt="" loading="lazy" src="https://www.google.com/s2/favicons?sz=32&domain=' + encodeURIComponent(host) + '">' : ''; }

  // ---------- skeleton ----------
  function shell() {
    var v = $('view-analytics');
    if (v.getAttribute('data-ready')) return;
    v.setAttribute('data-ready', '1');
    v.innerHTML =
      '<div class="an-top an-glass">' +
        '<div class="an-title"><h2>Website analytics</h2><p id="anPeriod">Loading…</p></div>' +
        '<span class="an-live" title="Visitors active in the last 5 minutes"><span class="dot"></span><b id="anLive">0</b>&nbsp;online now</span>' +
        '<div class="an-seg" role="group" aria-label="Date range">' +
          [['day', 'Today'], ['week', '7 days'], ['month', '30 days'], ['quarter', '90 days']].map(function (r) { return '<button type="button" data-range="' + r[0] + '" aria-pressed="' + (r[0] === state.range) + '">' + r[1] + '</button>'; }).join('') +
        '</div>' +
        '<div class="an-actions">' +
          '<button type="button" class="btn-sm primary" id="anEmail">Email me this week\'s report</button>' +
          '<button type="button" class="btn-sm" id="anEmailMonth" title="Leads by channel and Google Search data for last month (sent automatically on the 3rd)">Email me last month\'s SEO report</button>' +
          '<button type="button" class="btn-sm" id="anExclude"></button>' +
          '<a class="btn-sm ghost" href="' + GA_URL + '" target="_blank" rel="noopener">Google Analytics ↗</a>' +
          '<a class="btn-sm ghost" href="' + VERCEL_URL + '" target="_blank" rel="noopener">Vercel ↗</a>' +
          '<span class="an-note">Cookieless first-party data · visitors counted once per day</span>' +
        '</div>' +
      '</div>' +
      '<div class="an-kpis" id="anKpis"></div>' +
      '<div class="an-chart an-glass"><div class="an-chart-head"><h3>Traffic</h3><div class="an-legend"><span><i style="background:rgba(99,102,241,.75)"></i>Page views</span><span><i style="background:#2dd4bf"></i>Visitors</span><span><i style="background:#fbbf24"></i>Leads</span></div></div><div id="anChart"><div class="an-skel"></div></div><div class="an-tip" id="anTip"></div></div>' +
      '<div class="an-grid">' +
        panel('anPages', 'wide', 'Pages', '<div class="an-tabs" data-tabs="pagesTab">' + tabBtns([['pages', 'Top'], ['entry', 'Entry'], ['exit', 'Exit']], 'pagesTab') + '</div>') +
        panel('anFunnel', '', 'Conversion funnel', '<small>sessions</small>') +
        panel('anSources', '', 'Sources', '<small>sessions · leads</small>') +
        panel('anGeo', '', 'Locations', '<div class="an-tabs" data-tabs="geoTab">' + tabBtns([['countries', 'Countries'], ['cities', 'Cities']], 'geoTab') + '</div>') +
        panel('anTech', '', 'Technology', '<div class="an-tabs" data-tabs="techTab">' + tabBtns([['devices', 'Devices'], ['browsers', 'Browsers'], ['os', 'OS']], 'techTab') + '</div>') +
        panel('anClicks', 'wide', 'What people click', '<small>clicks · people</small>') +
        panel('anFlows', '', 'Where they go next', '<small>page → page</small>') +
        panel('anCampaigns', '', 'Ad campaigns (UTM)', '<small>sessions · leads</small>') +
        panel('anLivePages', '', 'Right now', '<small>last 5 minutes</small>') +
        panel('anClickKinds', '', 'Actions that signal intent', '<small>clicks · people</small>') +
        panel('anJourneys', 'full', 'Recent visitor journeys', '<small>latest sessions, newest first</small>') +
      '</div>';
    v.querySelectorAll('.an-seg button').forEach(function (b) { b.addEventListener('click', function () { if (state.busy) return; state.range = b.getAttribute('data-range'); v.querySelectorAll('.an-seg button').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); }); load(); }); });
    v.querySelectorAll('[data-tabs]').forEach(function (g) {
      var key = g.getAttribute('data-tabs');
      g.querySelectorAll('button').forEach(function (b) { b.addEventListener('click', function () { state[key] = b.getAttribute('data-v'); g.querySelectorAll('button').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); }); render(); }); });
    });
    $('anEmail').addEventListener('click', sendReport);
    $('anEmailMonth').addEventListener('click', function () { sendReport('anEmailMonth', 'send_leads_report'); });
    // the colour glows live on the page background only while this tab is open
    new MutationObserver(function () { document.body.classList.toggle('an-active', v.classList.contains('active')); }).observe(v, { attributes: true, attributeFilter: ['class'] });
    $('anExclude').addEventListener('click', toggleExclude);
    paintExclude();
  }
  function panel(id, cls, title, right) { return '<section class="an-panel an-glass ' + cls + '"><div class="an-panel-head"><h3>' + title + '</h3>' + (right || '') + '</div><div id="' + id + '"><div class="an-skel"></div></div></section>'; }
  function tabBtns(list, key) { return list.map(function (t) { return '<button type="button" data-v="' + t[0] + '" aria-pressed="' + (state[key] === t[0]) + '">' + t[1] + '</button>'; }).join(''); }

  // ---------- this browser is excluded so the owner's own visits never count ----------
  function excluded() { try { return localStorage.getItem('cs_notrack') === '1'; } catch (e) { return false; } }
  function paintExclude() { var b = $('anExclude'); if (b) b.textContent = excluded() ? '✓ Your visits are excluded on this browser' : 'Exclude my visits on this browser'; }
  function toggleExclude() { try { if (excluded()) localStorage.removeItem('cs_notrack'); else localStorage.setItem('cs_notrack', '1'); } catch (e) {} paintExclude(); }

  function sendReport(id, action) {
    var b = $(typeof id === 'string' ? id : 'anEmail'); b.disabled = true; var old = b.textContent; b.textContent = 'Sending…';
    api('POST', '', { action: typeof action === 'string' ? action : 'send_analytics_report' }).then(function (r) { b.textContent = '✓ ' + (r.message || 'Sent'); })
      .catch(function (e) { b.textContent = old; alert('Could not send the report: ' + e.message); })
      .then(function () { setTimeout(function () { b.disabled = false; b.textContent = old; }, 4000); });
  }

  // ---------- data ----------
  function load() {
    shell();
    document.body.classList.add('an-active');
    state.busy = true;
    ['anChart', 'anPages', 'anFunnel', 'anSources', 'anGeo', 'anTech', 'anClicks', 'anFlows', 'anCampaigns', 'anLivePages', 'anClickKinds'].forEach(function (id) { $(id).innerHTML = '<div class="an-skel"></div>'; });
    $('anKpis').innerHTML = new Array(7).join('<div class="an-kpi an-glass"><div class="an-skel" style="height:86px"></div></div>');
    return Promise.all([api('GET', '?view=analytics&range=' + state.range), api('GET', '?view=journeys&limit=15')])
      .then(function (res) { state.data = res[0]; state.journeys = res[1].journeys || []; render(); })
      .catch(function (e) { $('anKpis').innerHTML = '<div class="an-glass an-panel" style="grid-column:1/-1"><div class="an-empty">Could not load analytics: ' + esc(e.message) + '</div></div>'; })
      .then(function () { state.busy = false; });
  }

  // ---------- render ----------
  function delta(cur, prev, lowerIsBetter) {
    if (!prev && !cur) return '<span class="an-delta flat">–</span>';
    if (!prev) return '<span class="an-delta up">new</span>';
    var pct = Math.round(((cur - prev) / prev) * 100);
    if (!pct) return '<span class="an-delta flat">0%</span>';
    var good = lowerIsBetter ? pct < 0 : pct > 0;
    return '<span class="an-delta ' + (good ? 'up' : 'down') + '" title="vs previous period">' + (pct > 0 ? '▲' : '▼') + ' ' + Math.abs(pct) + '%</span>';
  }
  function spark(values, color) {
    if (!values.length) return '';
    var max = Math.max.apply(null, values.concat([1])), w = 120, h = 34, step = values.length > 1 ? w / (values.length - 1) : w;
    var pts = values.map(function (v, i) { return (i * step).toFixed(1) + ',' + (h - 3 - (v / max) * (h - 6)).toFixed(1); });
    return '<svg viewBox="0 0 ' + w + ' ' + h + '" preserveAspectRatio="none" aria-hidden="true"><polyline fill="none" stroke="' + color + '" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" points="' + pts.join(' ') + '"/>' +
      '<polygon fill="' + color + '" opacity=".12" points="0,' + h + ' ' + pts.join(' ') + ' ' + w + ',' + h + '"/></svg>';
  }
  function kpis(d) {
    var c = d.current, p = d.previous, s = d.series;
    var col = function (k) { return s.map(function (x) { return x[k]; }); };
    var cards = [
      ['Visitors', n(c.visitors), delta(c.visitors, p.visitors), 'unique per day', spark(col('visitors'), '#2dd4bf')],
      ['Page views', n(c.pageviews), delta(c.pageviews, p.pageviews), (c.sessions ? (c.pageviews / c.sessions).toFixed(1) : '0') + ' per session', spark(col('pageviews'), '#818cf8')],
      ['Sessions', n(c.sessions), delta(c.sessions, p.sessions), n(c.clicks) + ' clicks', spark(col('sessions'), '#a78bfa')],
      ['Engaged time', dur(c.avgEngagedSec), delta(c.avgEngagedSec, p.avgEngagedSec), 'visible time per session', spark(col('engagedSec'), '#60a5fa')],
      ['Bounce rate', c.bounceRate + '%', delta(c.bounceRate, p.bounceRate, true), 'single-page sessions', ''],
      ['Leads', n(c.leads), delta(c.leads, p.leads), c.conversionRate + '% of sessions convert', spark(col('leads'), '#fbbf24')]
    ];
    $('anKpis').innerHTML = cards.map(function (k) { return '<div class="an-kpi an-glass"><div class="k"><span>' + k[0] + '</span>' + k[2] + '</div><div class="v">' + k[1] + '</div><div class="sub">' + k[3] + '</div>' + k[4] + '</div>'; }).join('');
  }

  function chart(d) {
    var s = d.series, box = $('anChart');
    if (!s.length) { box.innerHTML = '<div class="an-empty">No data in this range yet.</div>'; return; }
    var W = 1000, H = 260, L = 40, R = 12, T = 12, B = 30;
    var max = Math.max.apply(null, s.map(function (x) { return Math.max(x.pageviews, x.visitors); }).concat([4]));
    var nice = Math.pow(10, Math.floor(Math.log10(max))); max = Math.ceil(max / nice) * nice;
    var iw = W - L - R, ih = H - T - B, bw = iw / s.length;
    var y = function (v) { return T + ih - (v / max) * ih; };
    var g = '';
    for (var i = 0; i <= 4; i++) { var gv = (max / 4) * i, gy = y(gv); g += '<line class="grid" x1="' + L + '" x2="' + (W - R) + '" y1="' + gy + '" y2="' + gy + '"/><text class="axis" x="' + (L - 6) + '" y="' + (gy + 4) + '" text-anchor="end">' + (gv >= 1000 ? (gv / 1000) + 'k' : Math.round(gv)) + '</text>'; }
    var bars = s.map(function (x, i) { var h = (x.pageviews / max) * ih; return '<rect x="' + (L + i * bw + bw * 0.18).toFixed(1) + '" y="' + (T + ih - h).toFixed(1) + '" width="' + (bw * 0.64).toFixed(1) + '" height="' + Math.max(0, h).toFixed(1) + '" rx="3" fill="url(#anBar)"/>'; }).join('');
    var line = s.map(function (x, i) { return (L + i * bw + bw / 2).toFixed(1) + ',' + y(x.visitors).toFixed(1); }).join(' ');
    var dots = s.map(function (x, i) { return x.leads ? '<circle cx="' + (L + i * bw + bw / 2).toFixed(1) + '" cy="' + (y(x.visitors) - 12).toFixed(1) + '" r="4.5" fill="#fbbf24" stroke="rgba(0,0,0,.5)"/>' : ''; }).join('');
    var every = Math.max(1, Math.ceil(s.length / (window.innerWidth < 700 ? 5 : 10)));
    var labels = s.map(function (x, i) { if (i % every && i !== s.length - 1) return ''; var lab = d.range === 'day' ? x.label : x.label.slice(5).replace('-', '/'); return '<text class="axis" x="' + (L + i * bw + bw / 2).toFixed(1) + '" y="' + (H - 10) + '" text-anchor="middle">' + esc(lab) + '</text>'; }).join('');
    var hits = s.map(function (x, i) { return '<rect data-i="' + i + '" x="' + (L + i * bw).toFixed(1) + '" y="' + T + '" width="' + bw.toFixed(1) + '" height="' + ih + '" fill="transparent"/>'; }).join('');
    box.innerHTML = '<svg viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" role="img" aria-label="Page views and visitors over time">' +
      '<defs><linearGradient id="anBar" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#818cf8" stop-opacity=".85"/><stop offset="1" stop-color="#6366f1" stop-opacity=".35"/></linearGradient></defs>' +
      g + bars + '<polyline fill="none" stroke="#2dd4bf" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" points="' + line + '"/>' + dots + labels + '<g class="hits">' + hits + '</g></svg>';
    var tip = $('anTip'), svg = box.querySelector('svg');
    svg.querySelectorAll('.hits rect').forEach(function (r) {
      r.addEventListener('mouseenter', function () {
        var x = s[+r.getAttribute('data-i')];
        tip.innerHTML = '<b>' + esc(d.range === 'day' ? 'Today ' + x.label : x.label) + '</b><div class="r"><span>Page views</span><span>' + n(x.pageviews) + '</span></div><div class="r"><span>Visitors</span><span>' + n(x.visitors) + '</span></div><div class="r"><span>Sessions</span><span>' + n(x.sessions) + '</span></div><div class="r"><span>Leads</span><span>' + n(x.leads) + '</span></div>';
        var rb = r.getBoundingClientRect(), cb = box.parentNode.getBoundingClientRect();
        var left = rb.left - cb.left + rb.width / 2 + 12; if (left > cb.width - 170) left = rb.left - cb.left - 170;
        tip.style.left = left + 'px'; tip.style.top = '52px'; tip.style.opacity = '1';
        r.setAttribute('fill', 'rgba(255,255,255,.04)');
      });
      r.addEventListener('mouseleave', function () { tip.style.opacity = '0'; r.setAttribute('fill', 'transparent'); });
    });
  }

  function rows(list, cols, opts) {
    opts = opts || {};
    if (!list.length) return '<div class="an-empty">' + (opts.empty || 'No data in this range yet.') + '</div>';
    var max = Math.max.apply(null, list.map(function (r) { return r._v; }).concat([1]));
    return (opts.head ? '<div class="an-head-row">' + opts.head.map(function (h) { return '<span>' + h + '</span>'; }).join('') + '</div>' : '') +
      '<div class="an-rows">' + list.map(function (r) {
        return '<div class="an-row ' + (opts.tone || '') + '"><span class="fill" style="width:' + Math.max(2, Math.round((r._v / max) * 100)) + '%"></span>' +
          '<span class="name" title="' + esc(r._title || '') + '">' + r._name + '</span>' + cols(r) + '</div>';
      }).join('') + '</div>';
  }
  function pages(d) {
    var tab = state.pagesTab, list;
    if (tab === 'entry') list = d.entryPages.filter(function (r) { return r.entries; }).map(function (r) { return { _v: r.entries, _name: esc(r.path), _title: r.path, a: r.entries }; });
    else if (tab === 'exit') list = d.exitPages.filter(function (r) { return r.exits; }).map(function (r) { return { _v: r.exits, _name: esc(r.path), _title: r.path, a: r.exits }; });
    else list = d.pages.map(function (r) { return { _v: r.pageviews, _name: esc(r.path), _title: r.title || r.path, a: r.pageviews, b: r.visitors, t: r.avgTimeSec, dp: r.avgDepth }; });
    $('anPages').innerHTML = rows(list, function (r) {
      return tab === 'pages'
        ? '<span class="meta" title="Average visible time · average scroll depth">' + dur(r.t) + ' · ' + r.dp + '%</span><span class="num" title="Visitors">' + n(r.b) + '</span><span class="num" title="Page views">' + n(r.a) + '</span>'
        : '<span class="num">' + n(r.a) + '</span>';
    }, { head: tab === 'pages' ? ['Page', 'Time · scroll', 'Visitors', 'Views'] : ['Page', tab === 'entry' ? 'Entrances' : 'Exits'] });
  }
  function funnel(d) {
    var f = d.funnel, base = f.visited || 0;
    var steps = [['Visited the site', f.visited], ['Explored services, work or reviews', f.explored], ['Showed intent (contact page, call, WhatsApp, booking)', f.intent], ['Became a lead', f.converted]];
    $('anFunnel').innerHTML = !base ? '<div class="an-empty">No sessions in this range yet.</div>' : '<div class="an-funnel">' + steps.map(function (s, i) {
      var pct = base ? Math.round((s[1] / base) * 1000) / 10 : 0;
      var prev = i ? steps[i - 1][1] : 0, drop = i && prev ? Math.round(((prev - s[1]) / prev) * 100) : 0;
      return '<div class="an-step"><div class="lbl"><span>' + s[0] + '</span><span>' + n(s[1]) + ' · ' + pct + '%' + (i ? ' <span title="drop-off from the previous step">(−' + drop + '%)</span>' : '') + '</span></div><div class="bar"><i style="width:' + Math.max(pct, s[1] ? 2 : 0) + '%"></i></div></div>';
    }).join('') + '</div>';
  }
  function sources(d) {
    $('anSources').innerHTML = rows(mergeSources(d.sources).map(function (r) { return { _v: r.sessions, _name: favicon(r.host) + esc(r.name), _title: r.name === 'Direct / none' ? 'No referrer: typed, bookmarked, apps, some ads' : r.raw.join(', '), a: r.sessions, l: r.leads }; }),
      function (r) { return '<span class="meta">' + (r.l ? '<span class="an-badge">' + n(r.l) + ' lead' + (r.l > 1 ? 's' : '') + '</span>' : '') + '</span><span class="num">' + n(r.a) + '</span>'; }, { tone: 'teal' });
  }
  function geo(d) {
    if (state.geoTab === 'cities') {
      $('anGeo').innerHTML = rows(d.cities.map(function (r) { return { _v: r.visitors, _name: flag(r.country) + ' ' + esc(r.city) + (r.region ? ' <span class="meta">' + esc(r.region) + '</span>' : ''), _title: r.city + ', ' + countryName(r.country), a: r.visitors }; }),
        function (r) { return '<span class="num">' + n(r.a) + '</span>'; }, { tone: 'rose' });
    } else {
      $('anGeo').innerHTML = rows(d.countries.map(function (r) { return { _v: r.visitors, _name: flag(r.country) + ' ' + esc(countryName(r.country)), _title: countryName(r.country), a: r.visitors }; }),
        function (r) { return '<span class="num">' + n(r.a) + '</span>'; }, { tone: 'rose', head: ['Country', 'Visitors'] });
    }
  }
  function tech(d) {
    var list = d[state.techTab] || [], total = list.reduce(function (a, r) { return a + r.visitors; }, 0) || 1;
    var colors = ['#818cf8', '#2dd4bf', '#fbbf24', '#fb7185', '#a78bfa', '#60a5fa', '#34d399', '#f472b6'];
    $('anTech').innerHTML = !list.length ? '<div class="an-empty">No data in this range yet.</div>' :
      '<div class="an-stack">' + list.map(function (r, i) { return '<i title="' + esc(r.name) + '" style="width:' + (r.visitors / total * 100) + '%;background:' + colors[i % colors.length] + '"></i>'; }).join('') + '</div>' +
      rows(list.map(function (r, i) { return { _v: r.visitors, _name: '<i style="width:9px;height:9px;border-radius:3px;display:inline-block;background:' + colors[i % colors.length] + '"></i>' + esc(r.name), a: r.visitors, pct: Math.round(r.visitors / total * 100) }; }),
        function (r) { return '<span class="meta">' + r.pct + '%</span><span class="num">' + n(r.a) + '</span>'; }, { tone: 'amber' });
  }
  function clicks(d) {
    $('anClicks').innerHTML = rows(d.clicks.map(function (r) { return { _v: r.count, _name: '<span class="an-chip ' + esc(r.kind) + '">' + esc(r.kind || 'click') + '</span>' + esc(clean(r.label) || '(no label)') + (r.dest ? ' <span class="meta">→ ' + esc(r.dest) + '</span>' : ''), _title: r.label + (r.dest ? ' → ' + r.dest : ''), a: r.count, s: r.sessions }; }),
      function (r) { return '<span class="num" title="People (sessions)">' + n(r.s) + '</span><span class="num" title="Clicks">' + n(r.a) + '</span>'; }, { head: ['Element', 'People', 'Clicks'] });
  }
  function flows(d) {
    $('anFlows').innerHTML = rows(d.flows.map(function (r) { return { _v: r.count, _name: esc(r.from) + ' <span class="meta">→</span> ' + esc(r.to), _title: r.from + ' → ' + r.to, a: r.count }; }),
      function (r) { return '<span class="num">' + n(r.a) + '</span>'; }, { tone: 'teal', empty: 'Appears once visitors view more than one page.' });
  }
  function campaigns(d) {
    $('anCampaigns').innerHTML = rows(d.campaigns.map(function (r) { return { _v: r.sessions, _name: esc(r.campaign) + ' <span class="meta">' + esc(r.source) + (r.medium ? ' / ' + esc(r.medium) : '') + '</span>', _title: r.source + ' / ' + r.medium + ' / ' + r.campaign, a: r.sessions, l: r.leads }; }),
      function (r) { return '<span class="meta">' + (r.l ? '<span class="an-badge">' + n(r.l) + '</span>' : '') + '</span><span class="num">' + n(r.a) + '</span>'; },
      { tone: 'amber', empty: 'Add utm_source, utm_medium and utm_campaign to your ad links and each campaign shows here with its leads.' });
  }
  function live(d) {
    $('anLive').textContent = n(d.live.visitors);
    $('anLivePages').innerHTML = rows(d.live.pages.map(function (r) { return { _v: r.visitors, _name: esc(r.path), a: r.visitors }; }), function (r) { return '<span class="num">' + n(r.a) + '</span>'; }, { tone: 'teal', empty: 'Nobody on the site in the last 5 minutes.' });
  }
  var KIND_LABEL = { booking: 'Book a call (Calendly)', whatsapp: 'WhatsApp', phone: 'Phone call', email: 'Email', cta: 'Call-to-action buttons', outbound: 'Links to other sites', nav: 'Internal links', button: 'Other buttons', submit: 'Form submits', anchor: 'On-page jumps' };
  function clickKinds(d) {
    var order = ['booking', 'whatsapp', 'phone', 'email', 'cta', 'submit', 'outbound', 'nav', 'button', 'anchor'];
    var list = d.clickKinds.slice().sort(function (a, b) { return order.indexOf(a.kind) - order.indexOf(b.kind); });
    $('anClickKinds').innerHTML = rows(list.map(function (r) { return { _v: r.count, _name: '<span class="an-chip ' + esc(r.kind) + '">' + esc(r.kind) + '</span>' + esc(KIND_LABEL[r.kind] || r.kind), a: r.count, s: r.sessions }; }),
      function (r) { return '<span class="num" title="People">' + n(r.s) + '</span><span class="num" title="Clicks">' + n(r.a) + '</span>'; });
  }
  function ago(ts) { var s = Math.round((Date.now() - ts) / 1000); return s < 60 ? 'just now' : s < 3600 ? Math.round(s / 60) + ' min ago' : s < 86400 ? Math.round(s / 3600) + ' h ago' : Math.round(s / 86400) + ' d ago'; }
  function clock(ts) { var d = new Date(ts); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); }
  function journeys() {
    var list = state.journeys || [];
    $('anJourneys').innerHTML = !list.length ? '<div class="an-empty">Journeys appear here as visitors browse the site.</div>' : '<div class="an-journeys">' + list.map(function (j) {
      var first = j.steps[0] || {};
      var src = first.ref ? sourceName(first.ref) : 'Direct';
      return '<details class="an-journey"><summary><span class="who">' + flag(j.country) + ' ' + esc(j.city || countryName(j.country)) + '</span>' +
        '<span class="muted">' + esc(j.device) + ' · ' + esc(j.browser) + ' · ' + esc(j.os) + '</span><span class="muted">from ' + esc(src) + '</span>' +
        '<span class="grow"></span>' + (j.leads ? '<span class="an-badge">Lead</span>' : '') + '<span class="muted">' + n(j.pageviews) + ' page' + (j.pageviews === 1 ? '' : 's') + ' · ' + ago(j.last) + '</span></summary>' +
        '<ol class="an-steps">' + j.steps.map(function (s) {
          var ic = s.type === 'pageview' ? '📄' : s.type === 'lead' ? '✅' : s.type === 'review' ? '⭐' : '👆';
          var txt = s.type === 'pageview' ? esc(s.path) : s.type === 'lead' ? 'Sent the ' + esc(s.target || 'form') : s.type === 'review' ? 'Left a review' : '<span class="an-chip ' + esc(s.kind) + '">' + esc(s.kind) + '</span> ' + esc(clean(s.target)) + (s.dest ? ' <span class="muted">→ ' + esc(s.dest) + '</span>' : '');
          return '<li><span class="t">' + clock(s.ts) + '</span><span class="ic">' + ic + '</span><span>' + txt + '</span></li>';
        }).join('') + '</ol></details>';
    }).join('') + '</div>';
  }

  function render() {
    var d = state.data; if (!d) return;
    var f = function (t) { return new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }); };
    $('anPeriod').textContent = d.label + ' · ' + (d.range === 'day' ? 'since midnight' : f(d.period.start) + ' – ' + f(d.period.end)) + ' · compared with the previous ' + (d.range === 'day' ? 'day (same hours)' : 'period') + ' · ' + d.tz.replace('_', ' ');
    kpis(d); chart(d); pages(d); funnel(d); sources(d); geo(d); tech(d); clicks(d); flows(d); campaigns(d); live(d); clickKinds(d); journeys();
  }

  window.CSAnalytics = { load: load };
})();
