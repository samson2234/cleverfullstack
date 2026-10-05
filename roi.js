/* roi.js — homepage "What is a better website worth?" calculator.
 *
 * Two honest paths instead of one flat multiplier:
 *   - "Just starting out": no traffic data needed -> how many extra customers pay for the site?
 *   - "I already have customers": visitors x enquiry rate x close rate x customer value, with a
 *     improvement assumption the VISITOR chooses (15 / 30 / 50 %), profit margin, payback and
 *     12-month return against the actual website cost.
 * Works from a tiny local business to a large one (log-scale sliders from 100 to 1,000,000 visitors
 * and $10 to $100,000 per customer, plus exact number entry). Currency + English/French aware.
 * Results are estimates built only from numbers the visitor enters; nothing is promised.
 * The math is pure and tested (tests/roi.test.js); the UI below is plain DOM, no dependencies.
 */
(function (root) {
  'use strict';

  // ------------------------------------------------------------------ pure calculation
  var RATES = { USD: 1, GBP: 0.79, EUR: 0.92, CAD: 1.37, AUD: 1.52 }; // indicative only (we quote in USD)
  var PACKAGES = [
    { id: 'starter', usd: 499 },
    { id: 'business', usd: 999 },
    { id: 'store', usd: 1749 },
    { id: 'app', usd: 3000 }
  ];
  var UPLIFT = { low: 0.15, mid: 0.3, high: 0.5 };
  var PRESETS = {
    local: { visitors: 2000, conv: 3, close: 30, value: 1200, direct: false, margin: 35 },
    store: { visitors: 8000, conv: 1.8, close: 100, value: 85, direct: true, margin: 30 },
    b2b: { visitors: 1500, conv: 1.2, close: 15, value: 15000, direct: false, margin: 40 }
  };

  function num(v, d) { var n = typeof v === 'number' ? v : parseFloat(v); return isFinite(n) ? n : d; }
  function clamp(n, lo, hi) { return Math.min(hi, Math.max(lo, n)); }

  function payback(cost, extraProfit) { return extraProfit > 0 && cost >= 0 ? cost / extraProfit : null; }

  // Established business: visitors -> enquiries -> customers -> revenue, before and after.
  function calcGrow(i) {
    var visitors = clamp(num(i.visitors, 0), 0, 1e9);
    var conv = clamp(num(i.conv, 0), 0, 100);
    var close = i.direct ? 100 : clamp(num(i.close, 0), 0, 100);
    var value = clamp(num(i.value, 0), 0, 1e8);
    var margin = clamp(num(i.margin, 0), 0, 100);
    var uplift = clamp(num(i.uplift, 0), 0, 5);
    var cost = clamp(num(i.cost, 0), 0, 1e9);

    var customers = visitors * (conv / 100) * (close / 100);
    var revenue = customers * value;
    var newConv = Math.min(100, conv * (1 + uplift));
    var newCustomers = visitors * (newConv / 100) * (close / 100);
    var newRevenue = newCustomers * value;
    var extraRevenue = newRevenue - revenue;
    var extraProfit = extraRevenue * (margin / 100);
    var months = payback(cost, extraProfit);
    return {
      mode: 'grow', customers: customers, newCustomers: newCustomers, revenue: revenue, newRevenue: newRevenue,
      extraRevenue: extraRevenue, extraProfit: extraProfit, cost: cost, paybackMonths: months,
      net12: extraProfit * 12 - cost, roiPct: cost > 0 ? ((extraProfit * 12 - cost) / cost) * 100 : null,
      valid: revenue > 0
    };
  }

  // Just starting: no traffic data, so ask how many extra customers the site might bring.
  function calcStart(i) {
    var value = clamp(num(i.value, 0), 0, 1e8);
    var margin = clamp(num(i.margin, 0), 0, 100);
    var n = clamp(num(i.customers, 0), 0, 1e6);
    var cost = clamp(num(i.cost, 0), 0, 1e9);
    var extraRevenue = n * value;
    var extraProfit = extraRevenue * (margin / 100);
    var perCustomer = value * (margin / 100);
    return {
      mode: 'start', customers: n, extraRevenue: extraRevenue, extraProfit: extraProfit, cost: cost,
      breakEvenCustomers: perCustomer > 0 ? Math.max(1, Math.ceil(cost / perCustomer)) : null,
      paybackMonths: payback(cost, extraProfit), net12: extraProfit * 12 - cost,
      roiPct: cost > 0 ? ((extraProfit * 12 - cost) / cost) * 100 : null, valid: extraProfit > 0
    };
  }

  // Package price in the chosen currency, rounded to a tidy figure.
  // USD is exact (it is our real price); other currencies are indicative and rounded to the nearest 10.
  function packageCost(usd, currency) { return currency === 'USD' || !RATES[currency] ? usd : Math.round((usd * RATES[currency]) / 10) * 10; }

  // Log-scale slider helpers: position 0..1000 <-> value min..max (rounded to 2 significant digits)
  function niceRound(v) {
    if (v <= 0) return 0;
    var step = Math.pow(10, Math.floor(Math.log(v) / Math.LN10) - 1);
    return Math.round(v / step) * step;
  }
  function posToValue(pos, min, max) { return niceRound(min * Math.pow(max / min, clamp(pos, 0, 1000) / 1000)); }
  function valueToPos(v, min, max) { return Math.round(clamp(Math.log(clamp(v, min, max) / min) / Math.log(max / min), 0, 1) * 1000); }

  // Formatting
  function money(n, cur, lang) {
    var big = Math.abs(n) >= 1e7;
    try {
      return new Intl.NumberFormat(lang === 'fr' ? 'fr-FR' : 'en-US', {
        style: 'currency', currency: cur, maximumFractionDigits: big ? 1 : 0, notation: big ? 'compact' : 'standard'
      }).format(n);
    } catch (e) { return (cur === 'USD' ? '$' : cur + ' ') + Math.round(n).toLocaleString(); }
  }
  function plain(n, lang) { return Math.round(n).toLocaleString(lang === 'fr' ? 'fr-FR' : 'en-US'); }

  var T = {
    en: {
      tabStart: 'Just starting out', tabGrow: 'I already have customers', currency: 'Currency', invest: 'Website investment',
      pk_starter: 'Starter website', pk_business: 'Business website', pk_store: 'Online store', pk_app: 'Custom web app', pk_custom: 'My own budget',
      approx: 'Indicative prices. We quote in USD.', presets: 'Start from an example, then change the numbers:',
      pr_local: 'Local services', pr_store: 'Online store', pr_b2b: 'High-value B2B',
      value: 'Average value of one customer', customersNew: 'Extra customers a month you would like from your site', margin: 'Profit margin',
      visitors: 'Website visitors per month', conv: 'Visitors who enquire or buy', close: 'Enquiries that become customers',
      direct: 'Visitors buy directly online (store)', uplift: 'Improvement you assume', up_low: 'Small +15%', up_mid: 'Medium +30%', up_high: 'Big +50%',
      hGrow: 'A better website could add about {x} profit every month', hStart: 'If your site brings {n} extra {c} a month, that is about {x} profit',
      customer: 'customer', customers: 'customers', rToday: 'Revenue today (est.)', rAfter: 'With a better site', rExtraRev: 'Extra revenue / month',
      rExtraProfit: 'Extra profit / month', rBreak: 'Customers to cover the cost', rPayback: 'Pays for itself in', rNet: 'Net gain in 12 months',
      under1w: 'under a week', weeks: 'about {n} weeks', months: '{n} months', years: '2+ years', none: '-',
      empty: 'Enter numbers above zero to see your result.', how: 'How this is calculated',
      howGrow: 'Customers = visitors x enquiry rate x close rate. Revenue = customers x customer value. A better site is assumed to raise the enquiry rate by the improvement you pick, so extra revenue = revenue x improvement. Profit = extra revenue x margin. Payback = website cost / extra monthly profit.',
      howStart: 'Extra profit = extra customers x customer value x margin. Payback = website cost / extra monthly profit. Customers to cover the cost = cost / profit per customer.',
      disclaimer: 'Estimates based only on the numbers you enter. This is not a guarantee of results.',
      cta: 'Get a free audit using these numbers', or: 'or', book: 'book a call',
      fName: 'Your name', fEmail: 'Email', fSend: 'Send me the audit', sending: 'Sending...',
      doneT: 'Thanks. We have your numbers.', doneB: 'We will review your situation and reply within one business day.', doneBook: 'Prefer to talk now? Book a call',
      err: 'Something went wrong. Please try again.', errField: 'Please enter your name and a valid email.', note: 'No spam. We only use this to send your audit.'
    },
    fr: {
      tabStart: 'Je démarre', tabGrow: "J'ai déjà des clients", currency: 'Devise', invest: 'Investissement site web',
      pk_starter: 'Site vitrine', pk_business: "Site d'entreprise", pk_store: 'Boutique en ligne', pk_app: 'Application web sur mesure', pk_custom: 'Mon propre budget',
      approx: 'Prix indicatifs. Nos devis sont en USD.', presets: 'Partez d’un exemple, puis modifiez les chiffres :',
      pr_local: 'Services locaux', pr_store: 'Boutique en ligne', pr_b2b: 'B2B à forte valeur',
      value: "Valeur moyenne d'un client", customersNew: 'Clients supplémentaires par mois souhaités grâce au site', margin: 'Marge bénéficiaire',
      visitors: 'Visiteurs du site par mois', conv: 'Visiteurs qui contactent ou achètent', close: 'Demandes qui deviennent clients',
      direct: 'Les visiteurs achètent directement en ligne (boutique)', uplift: 'Amélioration supposée', up_low: 'Faible +15 %', up_mid: 'Moyenne +30 %', up_high: 'Forte +50 %',
      hGrow: 'Un meilleur site pourrait ajouter environ {x} de bénéfice par mois', hStart: 'Si votre site apporte {n} {c} de plus par mois, cela représente environ {x} de bénéfice',
      customer: 'client', customers: 'clients', rToday: "Chiffre d'affaires actuel (est.)", rAfter: 'Avec un meilleur site', rExtraRev: 'CA supplémentaire / mois',
      rExtraProfit: 'Bénéfice supplémentaire / mois', rBreak: 'Clients pour couvrir le coût', rPayback: 'Rentabilisé en', rNet: 'Gain net sur 12 mois',
      under1w: "moins d'une semaine", weeks: 'environ {n} semaines', months: '{n} mois', years: 'plus de 2 ans', none: '-',
      empty: 'Saisissez des valeurs supérieures à zéro pour voir votre résultat.', how: "Comment c'est calculé",
      howGrow: "Clients = visiteurs x taux de demande x taux de conversion en client. CA = clients x valeur d'un client. On suppose qu'un meilleur site augmente le taux de demande selon l'amélioration choisie : CA supplémentaire = CA x amélioration. Bénéfice = CA supplémentaire x marge. Retour = coût du site / bénéfice mensuel supplémentaire.",
      howStart: "Bénéfice supplémentaire = clients supplémentaires x valeur d'un client x marge. Retour = coût du site / bénéfice mensuel supplémentaire.",
      disclaimer: "Estimations basées uniquement sur vos chiffres. Aucune garantie de résultat.",
      cta: 'Recevoir un audit gratuit avec ces chiffres', or: 'ou', book: 'réserver un appel',
      fName: 'Votre nom', fEmail: 'E-mail', fSend: "Envoyez-moi l'audit", sending: 'Envoi...',
      doneT: 'Merci. Nous avons vos chiffres.', doneB: 'Nous étudions votre situation et répondons sous un jour ouvré.', doneBook: 'Envie d’en parler ? Réserver un appel',
      err: 'Une erreur est survenue. Veuillez réessayer.', errField: 'Veuillez saisir votre nom et un e-mail valide.', note: "Pas de spam. Utilisé uniquement pour vous envoyer l'audit."
    }
  };

  function paybackText(m, t) {
    if (m == null) return t.none;
    if (m < 0.25) return t.under1w;
    if (m < 1) return t.weeks.replace('{n}', Math.max(1, Math.round(m * 4.345)));
    if (m >= 24) return t.years;
    return t.months.replace('{n}', (Math.round(m * 10) / 10).toString().replace(/\.0$/, ''));
  }

  var api = {
    calcGrow: calcGrow, calcStart: calcStart, packageCost: packageCost, posToValue: posToValue, valueToPos: valueToPos,
    money: money, paybackText: paybackText, niceRound: niceRound, PRESETS: PRESETS, UPLIFT: UPLIFT, PACKAGES: PACKAGES, RATES: RATES, T: T
  };
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.CSRoi = api;
  if (typeof document === 'undefined') return;

  // ------------------------------------------------------------------ UI
  var mount = document.getElementById('roiCalculator');
  if (!mount) return;

  var S = {
    mode: 'grow', cur: 'USD', pkg: 'starter', custom: 499,
    // established
    visitors: 2000, conv: 3, close: 30, value: 1200, margin: 35, direct: false, uplift: 'low',
    // starting out
    sValue: 800, sMargin: 35, sCustomers: 2
  };
  var started = false, liveTimer = null, lang = 'en';
  function t() { return T[lang] || T.en; }
  function ev(name, p) { try { if (root.csEvent) root.csEvent(name, p || {}); } catch (e) { /* ignore */ } }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  function cost() { return S.pkg === 'custom' ? clamp(num(S.custom, 0), 0, 1e9) : packageCost(PACKAGES.filter(function (p) { return p.id === S.pkg; })[0].usd, S.cur); }

  // field spec: slider (log or linear) + number box
  var LOG = { visitors: [100, 1000000], value: [10, 100000], sValue: [10, 100000] };
  var LIN = { conv: [0.1, 10, 0.1], close: [5, 100, 5], margin: [5, 90, 5], sMargin: [5, 90, 5], sCustomers: [1, 20, 1] };

  function fieldHtml(key, labelKey, suffix) {
    var log = LOG[key], lin = LIN[key];
    var min = log ? 0 : lin[0], max = log ? 1000 : lin[1], step = log ? 1 : lin[2];
    var id = 'roi_' + key;
    return '<div class="roi2-field" data-field="' + key + '"><div class="roi2-labelrow"><label for="' + id + '">' + esc(t()[labelKey]) + '</label>' +
      '<span class="roi2-num"><span class="roi2-pre"></span><input type="number" inputmode="decimal" min="0" step="any" id="' + id + '_n" aria-label="' + esc(t()[labelKey]) + '"><span class="roi2-suf">' + (suffix || '') + '</span></span></div>' +
      '<input type="range" id="' + id + '" min="' + min + '" max="' + max + '" step="' + step + '"></div>';
  }

  function build() {
    var L = t();
    var pk = PACKAGES.map(function (p) { return '<option value="' + p.id + '">' + esc(L['pk_' + p.id]) + '</option>'; }).join('') + '<option value="custom">' + esc(L.pk_custom) + '</option>';
    var cur = Object.keys(RATES).map(function (c) { return '<option value="' + c + '">' + c + '</option>'; }).join('');
    mount.innerHTML =
      '<div class="roi2-tabs" role="tablist" aria-label="' + esc(L.tabStart + ' / ' + L.tabGrow) + '">' +
        '<button type="button" role="tab" class="roi2-tab" id="roiTabStart" data-mode="start">' + esc(L.tabStart) + '</button>' +
        '<button type="button" role="tab" class="roi2-tab" id="roiTabGrow" data-mode="grow">' + esc(L.tabGrow) + '</button></div>' +
      '<div class="roi2-grid"><div class="roi2-inputs"><div class="roi2-mini" id="roiMini" aria-hidden="true"></div>' +
        '<div class="roi2-pair"><div class="roi2-field"><label for="roiPkg">' + esc(L.invest) + '</label><select id="roiPkg">' + pk + '</select></div>' +
        '<div class="roi2-field roi2-cur"><label for="roiCur">' + esc(L.currency) + '</label><select id="roiCur">' + cur + '</select></div></div>' +
        '<div class="roi2-field" id="roiCustomWrap" hidden><span class="roi2-num"><span class="roi2-pre"></span><input type="number" min="0" step="any" inputmode="decimal" id="roiCustom" aria-label="' + esc(L.pk_custom) + '"></span></div>' +
        '<p class="roi2-hint">' + esc(L.approx) + '</p>' +
        '<div id="roiPanelGrow" role="tabpanel" aria-labelledby="roiTabGrow">' +
          '<div class="roi2-presets"><span>' + esc(L.presets) + '</span>' +
            ['local', 'store', 'b2b'].map(function (k) { return '<button type="button" class="roi2-chip" data-preset="' + k + '">' + esc(L['pr_' + k]) + '</button>'; }).join('') + '</div>' +
          fieldHtml('visitors', 'visitors') + fieldHtml('conv', 'conv', '%') +
          '<label class="roi2-check"><input type="checkbox" id="roiDirect"> ' + esc(L.direct) + '</label>' +
          '<div id="roiCloseWrap">' + fieldHtml('close', 'close', '%') + '</div>' +
          fieldHtml('value', 'value') + fieldHtml('margin', 'margin', '%') +
          '<div class="roi2-field"><span class="roi2-lbl" id="roiUpLbl">' + esc(L.uplift) + '</span><div class="roi2-pills" role="radiogroup" aria-labelledby="roiUpLbl">' +
            ['low', 'mid', 'high'].map(function (k) { return '<button type="button" role="radio" class="roi2-pill" data-up="' + k + '">' + esc(L['up_' + k]) + '</button>'; }).join('') + '</div></div>' +
        '</div>' +
        '<div id="roiPanelStart" role="tabpanel" aria-labelledby="roiTabStart" hidden>' +
          fieldHtml('sValue', 'value') + fieldHtml('sCustomers', 'customersNew') + fieldHtml('sMargin', 'margin', '%') +
        '</div></div>' +
        '<div class="roi2-results"><p class="roi2-head" id="roiHead"></p><div class="roi2-rows" id="roiRows"></div>' +
          '<div class="roi2-bars" id="roiBars" aria-hidden="true"></div>' +
          '<div class="roi2-sr" id="roiLive" aria-live="polite" aria-atomic="true"></div>' +
          '<details class="roi2-how"><summary>' + esc(L.how) + '</summary><p id="roiHow"></p></details>' +
          '<p class="roi2-disc">' + esc(L.disclaimer) + '</p>' +
          '<div class="roi2-cta"><button type="button" class="btn btn-primary" id="roiCtaBtn">' + esc(L.cta) + ' <span class="btn-arrow">&rarr;</span></button>' +
          '<span class="roi2-or">' + esc(L.or) + ' <a href="https://calendly.com/henryygeorge25/30min" target="_blank" rel="noopener">' + esc(L.book) + '</a></span></div>' +
          '<form class="roi2-form" id="roiForm" hidden novalidate>' +
            '<input type="text" name="company_website" tabindex="-1" autocomplete="off" aria-hidden="true" class="roi2-hp">' +
            '<div class="roi2-field"><label for="roiName">' + esc(L.fName) + '</label><input type="text" id="roiName" name="name" autocomplete="name" maxlength="120"></div>' +
            '<div class="roi2-field"><label for="roiEmail">' + esc(L.fEmail) + '</label><input type="email" id="roiEmail" name="email" autocomplete="email" maxlength="200"></div>' +
            '<button type="submit" class="btn btn-primary" id="roiSend">' + esc(L.fSend) + '</button><p class="roi2-hint">' + esc(L.note) + '</p><p class="roi2-err" id="roiErr" role="alert"></p></form>' +
          '<div class="roi2-done" id="roiDone" hidden><strong>' + esc(L.doneT) + '</strong><p>' + esc(L.doneB) + '</p>' +
            '<a href="https://calendly.com/henryygeorge25/30min" target="_blank" rel="noopener">' + esc(L.doneBook) + '</a></div>' +
        '</div></div>';
    bind();
    syncInputs();
    render();
  }

  function q(id) { return document.getElementById(id); }

  function setField(key, value, silent) {
    var wrap = mount.querySelector('[data-field="' + key + '"]'); if (!wrap) return;
    var r = wrap.querySelector('input[type=range]'), n = wrap.querySelector('input[type=number]');
    var log = LOG[key];
    r.value = log ? valueToPos(value, log[0], log[1]) : clamp(value, LIN[key][0], LIN[key][1]);
    if (n && !silent) n.value = log ? String(Math.round(value)) : String(value);
  }

  function syncInputs() {
    var cs = ({ USD: '$', GBP: '£', EUR: '€', CAD: 'C$', AUD: 'A$' })[S.cur] || '';
    ['visitors', 'conv', 'close', 'value', 'margin', 'sValue', 'sMargin', 'sCustomers'].forEach(function (k) {
      var v = ({ visitors: S.visitors, conv: S.conv, close: S.close, value: S.value, margin: S.margin, sValue: S.sValue, sMargin: S.sMargin, sCustomers: S.sCustomers })[k];
      setField(k, v);
    });
    mount.querySelectorAll('[data-field="value"] .roi2-pre, [data-field="sValue"] .roi2-pre').forEach(function (e) { e.textContent = cs; });
    var cw = q('roiCustomWrap'); cw.hidden = S.pkg !== 'custom'; cw.querySelector('.roi2-pre').textContent = cs;
    q('roiPkg').value = S.pkg; q('roiCur').value = S.cur; q('roiCustom').value = S.custom;
    q('roiDirect').checked = S.direct; q('roiCloseWrap').hidden = S.direct;
    mount.querySelectorAll('.roi2-tab').forEach(function (b) { var on = b.dataset.mode === S.mode; b.classList.toggle('on', on); b.setAttribute('aria-selected', on); b.tabIndex = on ? 0 : -1; });
    q('roiPanelGrow').hidden = S.mode !== 'grow'; q('roiPanelStart').hidden = S.mode !== 'start';
    mount.querySelectorAll('.roi2-pill').forEach(function (b) { var on = b.dataset.up === S.uplift; b.classList.toggle('on', on); b.setAttribute('aria-checked', on); });
  }

  function interacted(what) { if (!started) { started = true; ev('roi_start', { mode: S.mode }); } if (what) ev(what, { mode: S.mode }); }

  function bind() {
    var map = { visitors: 'visitors', conv: 'conv', close: 'close', value: 'value', margin: 'margin', sValue: 'sValue', sMargin: 'sMargin', sCustomers: 'sCustomers' };
    Object.keys(map).forEach(function (k) {
      var wrap = mount.querySelector('[data-field="' + k + '"]'), r = wrap.querySelector('input[type=range]'), n = wrap.querySelector('input[type=number]');
      r.addEventListener('input', function () {
        var v = LOG[k] ? posToValue(+r.value, LOG[k][0], LOG[k][1]) : +r.value;
        S[map[k]] = v; n.value = String(LOG[k] ? Math.round(v) : v); interacted(); render();
      });
      n.addEventListener('input', function () {
        var v = clamp(num(n.value, 0), 0, k === 'margin' || k === 'sMargin' || k === 'close' ? 100 : (k === 'conv' ? 100 : 1e9));
        S[map[k]] = v; setField(k, v, true); interacted(); render();
      });
    });
    q('roiPkg').addEventListener('change', function () { S.pkg = this.value; interacted(); syncInputs(); render(); });
    q('roiCur').addEventListener('change', function () { S.cur = this.value; if (S.pkg === 'custom') {/* keep user's own number */} interacted(); syncInputs(); render(); });
    q('roiCustom').addEventListener('input', function () { S.custom = num(this.value, 0); interacted(); render(); });
    q('roiDirect').addEventListener('change', function () { S.direct = this.checked; interacted(); syncInputs(); render(); });
    mount.querySelectorAll('.roi2-tab').forEach(function (b, i, all) {
      b.addEventListener('click', function () { if (S.mode !== b.dataset.mode) { S.mode = b.dataset.mode; interacted('roi_mode_change'); syncInputs(); render(); } });
      b.addEventListener('keydown', function (e) { if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { var o = all[(i + 1) % all.length]; o.focus(); o.click(); e.preventDefault(); } });
    });
    mount.querySelectorAll('.roi2-chip').forEach(function (b) {
      b.addEventListener('click', function () {
        var p = PRESETS[b.dataset.preset]; S.visitors = p.visitors; S.conv = p.conv; S.close = p.close; S.value = p.value; S.direct = p.direct; S.margin = p.margin;
        S.mode = 'grow'; interacted('roi_preset'); syncInputs(); render();
      });
    });
    mount.querySelectorAll('.roi2-pill').forEach(function (b) { b.addEventListener('click', function () { S.uplift = b.dataset.up; interacted(); syncInputs(); render(); }); });
    q('roiCtaBtn').addEventListener('click', function () { var f = q('roiForm'); f.hidden = false; this.setAttribute('aria-expanded', 'true'); q('roiName').focus(); ev('roi_cta_open', { mode: S.mode }); });
    q('roiForm').addEventListener('submit', submit);
  }

  function result() {
    return S.mode === 'start'
      ? calcStart({ value: S.sValue, margin: S.sMargin, customers: S.sCustomers, cost: cost() })
      : calcGrow({ visitors: S.visitors, conv: S.conv, close: S.close, direct: S.direct, value: S.value, margin: S.margin, uplift: UPLIFT[S.uplift], cost: cost() });
  }

  function row(label, val, cls) { return '<div class="roi2-row ' + (cls || '') + '"><span>' + esc(label) + '</span><strong>' + esc(val) + '</strong></div>'; }

  function summary(r) {
    var L = t(), m = function (x) { return money(x, S.cur, lang); };
    return r.mode === 'start'
      ? 'ROI calculator (just starting out): value per customer ' + m(S.sValue) + ', margin ' + S.sMargin + '%, extra customers/month ' + S.sCustomers + ', website cost ' + m(r.cost) + ' -> extra profit ' + m(r.extraProfit) + '/month, pays for itself in ' + paybackText(r.paybackMonths, T.en) + '.'
      : 'ROI calculator (established): visitors/month ' + plain(S.visitors, 'en') + ', enquiry rate ' + S.conv + '%, ' + (S.direct ? 'buys directly online' : 'close rate ' + S.close + '%') + ', value per customer ' + m(S.value) + ', margin ' + S.margin + '%, assumed improvement +' + Math.round(UPLIFT[S.uplift] * 100) + '%, website cost ' + m(r.cost) + ' -> extra revenue ' + m(r.extraRevenue) + '/month, extra profit ' + m(r.extraProfit) + '/month, pays for itself in ' + paybackText(r.paybackMonths, T.en) + '. (currency ' + S.cur + ')';
  }

  function render() {
    var L = t(), r = result(), m = function (x) { return money(x, S.cur, lang); };
    var head = q('roiHead'), rows = q('roiRows'), bars = q('roiBars');
    q('roiHow').textContent = S.mode === 'start' ? L.howStart : L.howGrow;
    if (!r.valid || !(r.extraProfit > 0)) { head.textContent = L.empty; rows.innerHTML = ''; bars.innerHTML = ''; q('roiLive').textContent = ''; q('roiMini').textContent = L.empty; return; }
    var h;
    if (r.mode === 'start') {
      h = L.hStart.replace('{n}', plain(r.customers, lang)).replace('{c}', r.customers === 1 ? L.customer : L.customers).replace('{x}', m(r.extraProfit));
      rows.innerHTML = row(L.rExtraRev, m(r.extraRevenue)) + row(L.rExtraProfit, m(r.extraProfit), 'strong') +
        row(L.rBreak, r.breakEvenCustomers == null ? L.none : plain(r.breakEvenCustomers, lang)) + row(L.rPayback, paybackText(r.paybackMonths, L), 'accent') + row(L.rNet, m(r.net12));
      bars.innerHTML = '';
    } else {
      h = L.hGrow.replace('{x}', m(r.extraProfit));
      rows.innerHTML = row(L.rToday, m(r.revenue)) + row(L.rAfter, m(r.newRevenue)) + row(L.rExtraRev, m(r.extraRevenue)) + row(L.rExtraProfit, m(r.extraProfit), 'strong') +
        row(L.rPayback, paybackText(r.paybackMonths, L), 'accent') + row(L.rNet, m(r.net12));
      var pct = Math.max(8, Math.round((r.revenue / r.newRevenue) * 100));
      bars.innerHTML = '<div class="roi2-bar"><i style="width:' + pct + '%"></i></div><div class="roi2-bar after"><i style="width:100%"></i></div>';
    }
    head.textContent = h;
    q('roiMini').innerHTML = '<span>' + esc(L.rExtraProfit) + '</span><strong>' + esc(m(r.extraProfit)) + '</strong><em>' + esc(paybackText(r.paybackMonths, L)) + '</em>';
    clearTimeout(liveTimer); liveTimer = setTimeout(function () { q('roiLive').textContent = h + ' ' + L.rPayback + ' ' + paybackText(r.paybackMonths, L) + '.'; }, 700);
  }

  function submit(e) {
    e.preventDefault();
    var L = t(), f = q('roiForm'), name = q('roiName').value.trim(), email = q('roiEmail').value.trim(), err = q('roiErr'), btn = q('roiSend');
    err.textContent = '';
    if (name.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { err.textContent = L.errField; return; }
    btn.disabled = true; btn.textContent = L.sending;
    var u = root.csUtm || {};
    var body = {
      name: name, email: email, phone: '', country: '', company: '', industry: '', message: summary(result()), subscribe: false,
      company_website: f.querySelector('[name="company_website"]').value, source: 'roi-calculator', utm_source: u.utm_source || '', utm_medium: u.utm_medium || '', utm_campaign: u.utm_campaign || ''
    };
    fetch('/api/contact', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      .then(function (r) { if (!r.ok) throw new Error('http ' + r.status); ev('roi_lead', { mode: S.mode }); f.hidden = true; q('roiCtaBtn').hidden = true; q('roiDone').hidden = false; })
      .catch(function () { err.textContent = L.err; btn.disabled = false; btn.textContent = L.fSend; });
  }

  function currentLang() { return (document.documentElement.getAttribute('lang') || 'en').slice(0, 2) === 'fr' ? 'fr' : 'en'; }

  function init() {
    lang = currentLang(); build();
    // follow the site's language toggle
    new MutationObserver(function () { var l = currentLang(); if (l !== lang) { lang = l; build(); } }).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})(typeof window !== 'undefined' ? window : globalThis);
