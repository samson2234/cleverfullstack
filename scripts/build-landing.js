#!/usr/bin/env node
// scripts/build-landing.js — builds the service and industry pages (SEO plan Phase 2) as static HTML.
//
//   landing-src/services.js + landing-src/industries.js  ->  /<slug>.html at the site root
//
// The layout (head, header, footer, critical CSS, scripts) comes from web-development-usa.html, so the pages always
// match the live design. Each page gets its own title, description, canonical, self hreflang, Service + FAQ +
// breadcrumb schema, and links to real case studies (work-src/projects.json) and related pages. It also refreshes
// the "Specialist services" and "Industries" links on services.html and regenerates the sitemap.
// Run: npm run landing   (then npm run assets)

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SITE = 'https://cleverstack.dev';
const BOOK = 'https://calendly.com/henryygeorge25/30min';
const PAGES = [...require('../landing-src/services.js'), ...require('../landing-src/industries.js')];
const PROJECTS = Object.fromEntries(JSON.parse(fs.readFileSync(path.join(ROOT, 'work-src/projects.json'), 'utf8')).map((p) => [p.slug, p]));
const BY_SLUG = Object.fromEntries(PAGES.map((p) => [p.slug, p]));

const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const money = (n) => '$' + Number(n).toLocaleString('en-US');

// Honest one-line descriptions of the projects we link to (what was built; no unverified results)
const CASE_BLURB = {
  'sonic-audio-shopify-store': 'A custom Shopify theme in Liquid for an audio equipment brand, with AJAX collection filtering, product videos, spec comparison tables and a streamlined checkout.',
  'bouhan-falligant-law-firm-website': 'A WordPress site for one of Georgia\'s oldest law firms: 20+ practice areas, a filterable attorney directory and clear contact paths.',
  'lumea-glow-skin-clinic-website': 'A WordPress site for a nurse-led skin clinic in Sydney: treatment pages, a Find My Treatment path and booking always within reach.',
  'researchhub-academic-web-app': 'A real-time collaborative web app for research teams, built with Next.js, Express and WebSockets, with live document sync and per-project permissions.',
  'meloforge-ai-music-web3-app': 'An AI music platform built with Next.js, Google Gemini recommendations and Solana minting.',
  'ab-cleaning-solution-website': 'A fast React site for a commercial cleaning company in the Portland metro, with click-to-call, estimate requests and local business schema.',
  'dc-carpet-cleaning-website': 'A conversion-focused site for an Australian carpet cleaning business, with service pages, quote requests on every page and local SEO foundations.',
  'pure-energy-smoothie-landing-page': 'A launch landing page for a smoothie brand, with scroll-driven product storytelling, a sticky call to action and Mailchimp sign-up.',
  'spice-and-savor-restaurant-web-app': 'A React restaurant web app with a dynamic menu, dietary filters and online reservations.',
  'enterprise-analytics-dashboard': 'A Next.js and PostgreSQL analytics dashboard with real-time updates, role-based access and admin tools.'
};

const AREAS = ['United States', 'United Kingdom', 'Canada', 'Germany', 'Ireland', 'Netherlands', 'France', 'Europe'];
const PROCESS = [
  ['Free discovery call', '30 minutes to understand your goals, your customers and what is not working today.'],
  ['Fixed quote and plan', 'A written scope, timeline and fixed price, so you know the full cost before work starts.'],
  ['Build and review', 'You see progress early and often, and give feedback while it is still cheap to change.'],
  ['Launch and support', 'We test, launch, check tracking and stay on hand during the post-launch window.']
];

function validate() {
  const seen = new Set();
  for (const p of PAGES) {
    for (const k of ['slug', 'kind', 'name', 'title', 'description', 'h1', 'sub', 'price', 'intro', 'forWho', 'deliverables', 'faqs', 'related']) {
      if (!p[k]) throw new Error(p.slug + ': missing ' + k);
    }
    if (!/^[a-z0-9-]+$/.test(p.slug) || seen.has(p.slug)) throw new Error('bad or duplicate slug: ' + p.slug);
    seen.add(p.slug);
    if (fs.existsSync(path.join(ROOT, p.slug + '.html')) && !fs.readFileSync(path.join(ROOT, p.slug + '.html'), 'utf8').includes('data-landing="')) {
      throw new Error(p.slug + '.html already exists and is not a generated page');
    }
    if (p.title.length > 110) throw new Error(p.slug + ': title over 110 characters');
    if (p.description.length < 70 || p.description.length > 175) throw new Error(p.slug + ': description must be 70-175 characters (' + p.description.length + ')');
    for (const c of p.cases || []) if (!PROJECTS[c] || !CASE_BLURB[c]) throw new Error(p.slug + ': unknown case study ' + c);
    for (const r of p.related) if (!BY_SLUG[r]) throw new Error(p.slug + ': unknown related page ' + r);
  }
}

// ---------- page parts ----------
const card = (h, body, extra = '') => `<div class="card reveal" style="padding:28px;${extra}"><h3 style="margin-bottom:8px;">${esc(h)}</h3><p style="color:var(--text-muted);">${esc(body)}</p></div>`;
const head2 = (eyebrow, h2, sub) => `<div class="section-head reveal"><div class="eyebrow">${esc(eyebrow)}</div><h2>${esc(h2)}</h2>${sub ? `<p>${esc(sub)}</p>` : ''}</div>`;
const prose = (paras) => paras.map((t) => `<p style="margin-bottom:16px;line-height:1.75;">${esc(t)}</p>`).join('');

function hero(p, wa) {
  const chips = p.price.from
    ? `<div><div style="font-size:2rem; font-weight:700; color:var(--indigo);">From ${money(p.price.from)}</div><div style="font-size:0.9rem; color:var(--text-muted);">${esc(p.price.label)}</div></div><div><div style="font-size:2rem; font-weight:700; color:var(--teal);">${esc(p.price.delivery)}</div><div style="font-size:0.9rem; color:var(--text-muted);">Typical delivery</div></div>`
    : `<div><div style="font-size:2rem; font-weight:700; color:var(--indigo);">Fixed quote</div><div style="font-size:0.9rem; color:var(--text-muted);">Agreed before work starts</div></div>`;
  return `<section class="hero"><div class="mesh-bg"><div class="orb"></div><div class="orb"></div><div class="orb"></div></div><div class="container hero-grid" style="position:relative; z-index:1;"><div>` +
    `<nav aria-label="Breadcrumb" style="font-size:0.85rem; color:var(--text-muted); margin-bottom:14px;"><a href="/" style="color:inherit;">Home</a> / <a href="/services" style="color:inherit;">Services</a> / <span aria-current="page">${esc(p.name)}</span></nav>` +
    `<div class="eyebrow">${esc(p.eyebrow)}</div><h1>${esc(p.h1)}</h1><p class="hero-sub">${esc(p.sub)}</p>` +
    `<div class="hero-ctas"><a href="${BOOK}" class="btn btn-primary btn-glow" target="_blank" rel="noopener">Book a Free Call <span class="btn-arrow">&#8594;</span></a> ${wa}</div>` +
    `<div class="hero-stats" style="margin-top:32px; display:flex; gap:40px; flex-wrap:wrap;">${chips}</div></div></div></section>`;
}

function caseCards(p) {
  if (!(p.cases || []).length && !p.caseNote) return '';
  const cards = (p.cases || []).map((slug) => {
    const pr = PROJECTS[slug];
    return `<a href="/work/${slug}" class="card reveal" style="display:block; padding:0; overflow:hidden; color:inherit; text-decoration:none;">` +
      `<img src="${esc(pr.img)}" alt="${esc(pr.imgAlt || pr.title)}" width="800" height="533" loading="lazy" decoding="async" style="width:100%; height:auto; aspect-ratio:3/2; object-fit:cover; display:block;">` +
      `<div style="padding:24px;"><div style="font-size:0.8rem; color:var(--text-muted); margin-bottom:6px;">${esc(pr.subtitle)}</div><h3 style="margin-bottom:8px;">${esc(pr.title)}</h3><p style="color:var(--text-muted); margin-bottom:12px;">${esc(CASE_BLURB[slug])}</p><span class="card-link">Read the case study &#8594;</span></div></a>`;
  }).join('');
  return `<section class="section-pad section-light" style="background:var(--paper-3)"><div class="container">${head2('Our work', 'Related projects', p.caseNote)}` +
    (cards ? `<div class="grid grid-2" style="gap:24px;">${cards}</div>` : '') +
    `<p class="reveal" style="margin-top:24px;"><a href="/portfolio" class="card-link">See all projects &#8594;</a></p></div></section>`;
}

function priceBlock(p) {
  const big = p.price.from ? `From ${money(p.price.from)} USD` : esc(p.price.label);
  return `<section class="section-pad section-light" id="pricing"><div class="container">${head2('Pricing', p.price.from ? 'What it costs' : 'How pricing works', 'Every project gets a fixed quote in writing before any work starts. We quote in USD, GBP or EUR.')}` +
    `<div class="card reveal" style="padding:32px; max-width:760px;"><div style="font-size:1.8rem; font-weight:700; color:var(--indigo); margin-bottom:4px;">${big}</div>` +
    `<div style="color:var(--text-muted); margin-bottom:14px;">${p.price.from ? esc(p.price.label) + ' &#183; ' : ''}Delivery: ${esc(p.price.delivery)}</div><p style="margin-bottom:18px;">${esc(p.price.includes)}</p>` +
    `<div class="hero-ctas" style="margin:0;"><a href="${BOOK}" class="btn btn-primary" target="_blank" rel="noopener">Get a fixed quote <span class="btn-arrow">&#8594;</span></a> <a href="/services#budget" class="btn btn-ghost">Plan around your budget</a></div>` +
    `<p style="font-size:0.85rem; color:var(--text-muted); margin-top:14px;">Not sure what you need? Try the <a href="/services#calculator">package calculator</a>.</p></div></div></section>`;
}

function faq(p) {
  return `<section class="section-pad section-light"><div class="container">${head2('Common questions', p.name + ': answered')}<div class="reveal" style="max-width:760px;">` +
    p.faqs.map(([q, a]) => `<div class="faq-item"><div class="faq-q"><span>${esc(q)}</span><span class="plus">+</span></div><div class="faq-a"><p>${esc(a)}</p></div></div>`).join('') + '</div></div></section>';
}

function related(p) {
  return `<section class="section-pad section-light" style="background:var(--paper-3)"><div class="container">${head2('Related', 'You might also need')}<div class="grid grid-2" style="gap:24px;">` +
    p.related.map((s) => { const r = BY_SLUG[s]; return `<a href="/${s}" class="card reveal" style="display:block; padding:28px; color:inherit; text-decoration:none;"><h3 style="margin-bottom:8px;">${esc(r.name)}</h3><p style="color:var(--text-muted); margin-bottom:10px;">${esc(r.sub)}</p><span class="card-link">Learn more &#8594;</span></a>`; }).join('') +
    '</div></div></section>';
}

function main(p, wa) {
  const forWho = `<ul style="list-style:none; padding:0; display:grid; gap:12px;">${p.forWho.map((w) => `<li style="display:flex; gap:10px;"><span style="color:var(--teal); font-weight:700;">&#10003;</span><span>${esc(w)}</span></li>`).join('')}</ul>`;
  return `<main id="main" data-landing="${p.slug}">` + hero(p, wa) +
    `<section class="section-pad section-light"><div class="container"><div class="grid grid-2" style="gap:40px; align-items:start;"><div class="reveal">${head2(p.kind === 'industry' ? 'The challenge' : 'The problem', p.introH2 || (p.kind === 'industry' ? 'What your website has to do' : 'Why this is worth doing properly')).replace('reveal', '')}${prose(p.intro)}</div>` +
    `<div class="card reveal" style="padding:32px;"><h3 style="margin-bottom:16px;">Who this is for</h3>${forWho}</div></div></div></section>` +
    `<section class="section-pad section-light" style="background:var(--paper-3)"><div class="container">${head2('What you get', "What's included")}<div class="grid grid-2" style="gap:24px;">${p.deliverables.map(([h, b]) => card(h, b)).join('')}</div></div></section>` +
    (p.sections || []).map(([h, paras], i) => `<section class="section-pad section-light"${i % 2 ? ' style="background:var(--paper-3)"' : ''}><div class="container"><div class="reveal" style="max-width:820px;"><h2 style="margin-bottom:18px;">${esc(h)}</h2>${prose(paras)}</div></div></section>`).join('') +
    priceBlock(p) +
    `<section class="section-pad section-dark"><div class="container">${head2('How we work', 'From first call to launch, in four steps')}<div class="grid grid-2" style="gap:24px;">${PROCESS.map(([h, b], i) => card((i + 1) + '. ' + h, b)).join('')}</div></div></section>` +
    caseCards(p) + faq(p) + related(p) +
    `<section class="section-pad section-light"><div class="container"><div class="final-cta reveal"><div class="eyebrow" style="color:var(--teal); justify-content:center;">Ready to start?</div><h2>${esc(p.ctaHeading || "Tell us what you need. We'll tell you what it takes.")}</h2><p>Book a free 30-minute call. You'll get honest advice and a fixed quote, with no obligation.</p>` +
    `<div class="ctas"><a href="${BOOK}" class="btn btn-primary" target="_blank" rel="noopener">Book a Free Call <span class="btn-arrow">&#8594;</span></a> <a href="/contact" class="btn btn-ghost" style="border-color:rgba(255,255,255,.25); color:#fff;">Send us a message</a></div></div></div></section></main>`;
}

function schema(p) {
  const url = SITE + '/' + p.slug;
  const service = {
    '@context': 'https://schema.org', '@type': 'Service', '@id': url + '#service', name: p.name, serviceType: p.name, description: p.description, url,
    provider: { '@id': SITE + '/#organization' }, areaServed: AREAS.map((n) => (n === 'Europe' ? { '@type': 'Place', name: n } : { '@type': 'Country', name: n }))
  };
  if (p.price.from) service.offers = { '@type': 'Offer', price: String(p.price.from), priceCurrency: 'USD', description: p.price.label + ' (from)', url: url + '#pricing' };
  const crumbs = { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: SITE + '/' },
    { '@type': 'ListItem', position: 2, name: 'Services', item: SITE + '/services' },
    { '@type': 'ListItem', position: 3, name: p.name, item: url }] };
  const faqs = { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: p.faqs.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) };
  return [service, crumbs, faqs].map((j) => '<script type="application/ld+json">' + JSON.stringify(j).replace(/</g, '\\u003c') + '</script>').join('');
}

function render(tpl, p) {
  const url = SITE + '/' + p.slug, t = esc(p.title), d = esc(p.description);
  let h = tpl;
  const set = (re, val, what) => { if (!re.test(h)) throw new Error('template: ' + what); h = h.replace(re, () => val); };
  set(/<title>[\s\S]*?<\/title>/, `<title>${t}</title>`, 'title');
  set(/<meta name="description" content="[^"]*">/, `<meta name="description" content="${d}">`, 'description');
  h = h.replace(/<link rel="alternate" hreflang="[^"]*" href="[^"]*">/g, '');
  set(/<link rel="canonical" href="[^"]*">/, `<link rel="canonical" href="${url}"><link rel="alternate" hreflang="en" href="${url}"><link rel="alternate" hreflang="x-default" href="${url}">`, 'canonical');
  set(/<meta property="og:title" content="[^"]*">/, `<meta property="og:title" content="${t}">`, 'og:title');
  set(/<meta property="og:description" content="[^"]*">/, `<meta property="og:description" content="${d}">`, 'og:description');
  set(/<meta property="og:url" content="[^"]*">/, `<meta property="og:url" content="${url}">`, 'og:url');
  set(/<meta property="og:image" content="[^"]*">/, `<meta property="og:image" content="${SITE}/api/og?title=${encodeURIComponent(p.name).replace(/%20/g, '+')}&amp;type=website">`, 'og:image');
  set(/<meta name="twitter:title" content="[^"]*">/, `<meta name="twitter:title" content="${t}">`, 'twitter:title');
  set(/<meta name="twitter:description" content="[^"]*">/, `<meta name="twitter:description" content="${d}">`, 'twitter:description');
  set(/(?:<script type="application\/ld\+json">[\s\S]*?<\/script>)+/, schema(p), 'json-ld');
  set(/<a href="services.html" data-i18n="nav.services">/, '<a href="services.html" class="active" data-i18n="nav.services">', 'nav');
  const wa = (tpl.match(/<a href="https:\/\/wa\.me\/[^"]*" class="btn-wa"[\s\S]*?<\/a>/) || [])[0];
  if (!wa) throw new Error('template: WhatsApp button');
  set(/<main id="main">[\s\S]*<\/main>/, main(p, wa), 'main');
  return h;
}

// services.html: links to every service and industry page (between markers, rebuilt each run)
function linkHub() {
  const f = path.join(ROOT, 'services.html');
  let s = fs.readFileSync(f, 'utf8');
  s = s.replace(/<!--landing-links-->[\s\S]*?<!--\/landing-links-->/, '');
  const at = s.lastIndexOf('<section', s.indexOf('data-i18n="services.process.heading"'));
  if (at < 0) throw new Error('services.html: process section not found');
  const group = (kind) => PAGES.filter((p) => p.kind === kind).map((p) => `<a href="/${p.slug}" class="card" style="display:block; padding:22px; color:inherit; text-decoration:none;"><h3 style="font-size:1.05rem; margin-bottom:6px;">${esc(p.name)}</h3><span class="card-link">${p.price.from ? 'From ' + money(p.price.from) : 'Fixed quote'} &#8594;</span></a>`).join('');
  const block = '<!--landing-links--><section class="section-pad section-light" style="background:var(--paper-3)"><div class="container">' +
    head2('Specialist services', 'Find the right service for your project', 'Detailed pages with what is included, pricing, timelines and related projects.') +
    `<div class="grid grid-2" style="gap:16px;">${group('service')}</div>` +
    `<div class="section-head reveal" style="margin-top:56px;"><div class="eyebrow">Industries</div><h2>Websites built for your industry</h2></div><div class="grid grid-2" style="gap:16px;">${group('industry')}</div>` +
    '</div></section><!--/landing-links-->';
  fs.writeFileSync(f, s.slice(0, at) + block + s.slice(at));
}

function words(html) { return html.replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length; }

validate();
const tpl = fs.readFileSync(path.join(ROOT, 'web-development-usa.html'), 'utf8');
for (const p of PAGES) {
  const html = render(tpl, p);
  fs.writeFileSync(path.join(ROOT, p.slug + '.html'), html);
  const m = html.match(/<main[\s\S]*<\/main>/)[0];
  console.log(p.slug + '.html', words(m), 'words');
}
// remove pages whose source was deleted
for (const f of fs.readdirSync(ROOT)) {
  if (!f.endsWith('.html') || BY_SLUG[f.slice(0, -5)]) continue;
  const s = fs.readFileSync(path.join(ROOT, f), 'utf8');
  if (/<main id="main" data-landing="/.test(s)) { fs.unlinkSync(path.join(ROOT, f)); console.log('removed stale', f); }
}
linkHub();
console.log('services.html: links to', PAGES.length, 'pages');
require('./build-sitemap')();
console.log('Next: npm run assets');
