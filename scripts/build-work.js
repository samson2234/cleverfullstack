// scripts/build-work.js — one real, indexable page per portfolio project: /work/<slug>.
//
// Source of truth: work-src/projects.json. Layout: portfolio-detail.html (header, footer, styles), so site-wide
// edits and `npm run assets` keep flowing into these pages. Every page is server-rendered HTML with its own title,
// description, canonical, CreativeWork + BreadcrumbList structured data and links to related projects.
// Old links (portfolio-detail?id=<id>) are 301-redirected in vercel.json, which this script keeps in sync.
//
//   node scripts/build-work.js     then: npm run assets && npm test
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const SITE = 'https://cleverstack.dev';
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const write = (f, s) => fs.writeFileSync(path.join(root, f), s);
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const projects = JSON.parse(read('work-src/projects.json'));
const url = (p) => SITE + '/work/' + p.slug;

// meta description: the opening of the goal, cut on a word boundary (Google shows ~155 characters)
function describe(p) {
  let d = p.title + ': ' + p.subtitle.split('•').pop().trim() + ' for a ' + p.industry + ' client. ' + p.goal;
  if (d.length <= 155) return d;
  d = d.slice(0, 152);
  return d.slice(0, d.lastIndexOf(' ')).replace(/[,;:—-]$/, '') + '…';
}

// related: same industry first, then the next projects in portfolio order
function related(p) {
  const others = projects.filter((q) => q.slug !== p.slug);
  const same = others.filter((q) => q.industry === p.industry);
  const i = projects.indexOf(p);
  const next = projects.slice(i + 1).concat(projects.slice(0, i)).filter((q) => !same.includes(q));
  return same.concat(next).slice(0, 3);
}

function body(p) {
  const h1 = p.title + ' — ' + p.subtitle.split('•').pop().trim() + ' Case Study';
  let h = '<div class="pd-hero">'; // on screen at load: no reveal animation (Core Web Vitals)
  h += '<h1 class="pd-h1" style="font-size:34px;line-height:1.25;margin:0 0 18px;color:var(--text-dark);">' + esc(h1) + '</h1>';
  h += '<div class="pd-img-wrap"><img src="' + p.img + '" alt="' + esc(p.imgAlt) + '" data-lightbox loading="eager" fetchpriority="high" decoding="async" width="1200" height="800"></div>';
  h += '<div class="pd-meta"><span><strong>' + esc(p.subtitle) + '</strong></span><span>Industry: ' + esc(p.industry) + '</span><span>Duration: ' + esc(p.duration) + '</span><span>Price Range: ' + esc(p.price) + '</span>';
  if (p.liveUrl) h += '<a href="' + esc(p.liveUrl) + '" target="_blank" rel="noopener" class="btn btn-primary" style="padding:8px 20px;font-size:13px;margin-left:auto;">Visit Live Site →</a>';
  h += '</div></div>';
  h += '<div class="pd-body" style="margin-top:40px;">';
  h += '<div class="pd-client-card"><div class="info"><b>' + esc(p.client.name) + '</b><span>' + esc(p.client.title) + ' — ' + esc(p.client.country) + '</span></div><div class="stars">★★★★★</div></div>';
  h += '<h2>The Goal</h2><p>' + esc(p.goal) + '</p>';
  h += '<h2>Challenges</h2><p>' + esc(p.challenges) + '</p>';
  h += '<h2>Solutions</h2><p>' + esc(p.solutions) + '</p>';
  h += '<h2>The Result</h2><p>' + esc(p.outcome) + '</p>';
  h += '<h2>Role & Skills</h2><div class="pd-skills">' + p.skills.map((s) => '<span>' + esc(s) + '</span>').join('') + '</div>';
  h += '<div class="pd-stats">' +
    '<div class="pd-stat"><div class="val">' + esc(p.price) + '</div><div class="lbl">Price Range</div></div>' +
    '<div class="pd-stat"><div class="val">' + esc(p.duration) + '</div><div class="lbl">Project Duration</div></div>' +
    '<div class="pd-stat"><div class="val">' + esc(p.industry) + '</div><div class="lbl">Industry</div></div>' +
    '<div class="pd-stat"><div class="val">' + p.skills.length + '</div><div class="lbl">Core Skills</div></div></div>';
  h += '<h2>More projects</h2><div class="pd-nav" style="flex-wrap:wrap;">' + related(p).map((q) => '<a href="/work/' + q.slug + '">' + esc(q.title) + ' — ' + esc(q.subtitle.replace(/\s*•\s*/g, ' ')) + ' →</a>').join('') + '</div>';
  h += '<div style="text-align:center;margin-top:20px;"><p style="font-size:16px;color:var(--text-dark);font-weight:500;">Need something similar built for your business?</p><div class="ctas" style="justify-content:center;">' +
    '<a href="https://calendly.com/henryygeorge25/30min" class="btn btn-primary" target="_blank" rel="noopener">Book a Free Call <span class="btn-arrow">→</span></a>' +
    '<a href="https://wa.me/2349165400534?text=Hi%20CleverStack%2C%20I%27d%20like%20to%20discuss%20a%20project" class="btn-wa" target="_blank" rel="noopener">Chat on WhatsApp</a></div></div>';
  h += '<div class="pd-nav"><a href="portfolio.html">← Back to Portfolio</a><a href="blog/website-cost-2026.html">What should a project like this cost? →</a><a href="contact.html">Start Your Project →</a></div>';
  h += '</div>';
  return { h1, html: h };
}

const tpl = read('portfolio-detail.html');
const crlf = tpl.includes('\r\n');
fs.mkdirSync(path.join(root, 'work'), { recursive: true });
const keep = new Set();

for (const p of projects) {
  const u = url(p);
  const { h1, html } = body(p);
  const title = h1 + ' | CleverStack';
  const desc = describe(p);
  const img = SITE + p.img;
  let s = tpl;
  const sub = (re, val) => { if (!re.test(s)) throw new Error('template is missing ' + re); s = s.replace(re, () => val); };
  sub(/<title>[^<]*<\/title>/, '<title>' + esc(title) + '</title>');
  sub(/<meta name="description" content="[^"]*">/, '<meta name="description" content="' + esc(desc) + '">');
  sub(/<meta property="og:title" content="[^"]*">/, '<meta property="og:title" content="' + esc(title) + '">');
  sub(/<meta property="og:description" content="[^"]*">/, '<meta property="og:description" content="' + esc(desc) + '">');
  sub(/<meta property="og:type" content="[^"]*">/, '<meta property="og:type" content="article">');
  sub(/<meta property="og:url" content="[^"]*">/, '<meta property="og:url" content="' + u + '">');
  sub(/<meta property="og:image" content="[^"]*">/, '<meta property="og:image" content="' + img + '">');
  sub(/<meta name="twitter:title" content="[^"]*">/, '<meta name="twitter:title" content="' + esc(title) + '">');
  sub(/<meta name="twitter:description" content="[^"]*">/, '<meta name="twitter:description" content="' + esc(desc) + '">');
  sub(/<link rel="canonical" href="[^"]*">/, '<link rel="canonical" href="' + u + '">');
  sub(/<meta name="robots" content="[^"]*">/, '<meta name="robots" content="index, follow">');
  s = s.replace(/<link rel="alternate" hreflang="(en|x-default)" href="[^"]*">/g, (m, l) => '<link rel="alternate" hreflang="' + l + '" href="' + u + '">');
  const crumbs = { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: SITE + '/' },
    { '@type': 'ListItem', position: 2, name: 'Portfolio', item: SITE + '/portfolio' },
    { '@type': 'ListItem', position: 3, name: p.title, item: u }] };
  const work = { '@context': 'https://schema.org', '@type': 'CreativeWork', '@id': u + '#work', name: p.title, headline: h1, description: desc, url: u,
    image: img, genre: p.industry, keywords: p.skills.join(', '), inLanguage: 'en', creator: { '@id': SITE + '/#organization' } };
  sub(/<script type="application\/ld\+json">\s*\{\s*"@context": "https:\/\/schema\.org",\s*"@type": "BreadcrumbList"[\s\S]*?<\/script>/,
    '<script type="application/ld+json">' + JSON.stringify(crumbs) + '</script><script type="application/ld+json">' + JSON.stringify(work) + '</script>');
  sub(/<script id="pd-redirect">[\s\S]*?<\/script>/, '');
  sub(/<main id="main">[\s\S]*?<\/main>/, '<main id="main"><section class="pd-hero section-light"><div class="container" id="pd-content">' + html + '</div></section></main>');
  // the page lives one folder down (/work/<slug>): relative links and assets need ../ like the blog posts
  s = s.replace(/((?:href|src)=")(?!https?:|\/|#|mailto:|tel:|data:|\.\.\/)([^"]+")/g, '$1../$2');
  const file = 'work/' + p.slug + '.html';
  write(file, crlf ? s.replace(/\r?\n/g, '\r\n') : s);
  keep.add(p.slug + '.html');
}
for (const f of fs.readdirSync(path.join(root, 'work'))) if (f.endsWith('.html') && !keep.has(f)) { fs.unlinkSync(path.join(root, 'work', f)); console.log('removed stale work/' + f); }
console.log('wrote', projects.length, 'pages in /work');

// old portfolio-detail?id=<id> links -> /work/<slug> (301), on every page
let links = 0;
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.') || ['node_modules', 'vendor', 'scripts', 'tests', 'docs', 'api', 'lib', 'images', 'blog-src', 'work-src', 'work'].includes(e.name)) continue;
    const f = path.join(dir, e.name);
    if (e.isDirectory()) { walk(f); continue; }
    if (!e.name.endsWith('.html') || e.name === 'portfolio-detail.html') continue;
    const s = fs.readFileSync(f, 'utf8');
    const t = s.replace(/(?:\.\.\/)?portfolio-detail(?:\.html)?\?id=([A-Za-z0-9]+)/g, (m, id) => {
      const p = projects.find((q) => q.id === id.toLowerCase());
      if (!p) throw new Error(path.relative(root, f) + ': link to unknown project ' + id);
      links++; return '/work/' + p.slug;
    });
    if (t !== s) fs.writeFileSync(f, t);
  }
})(root);
console.log('re-pointed', links, 'links to /work/');

// vercel.json: one permanent redirect per old id, then anything else on portfolio-detail goes to the portfolio.
// Edited line by line so the hand-formatted file keeps its layout.
const line = (r) => '    ' + JSON.stringify(r).replace(/":/g, '": ').replace(/,"/g, ', "').replace(/^\{/, '{ ').replace(/\}$/, ' }').replace(/\[\{/g, '[{ ').replace(/\}\]/g, ' }]');
const old = [];
for (const src of ['/portfolio-detail', '/portfolio-detail.html']) {
  for (const p of projects) old.push({ source: src, has: [{ type: 'query', key: 'id', value: p.id }], destination: '/work/' + p.slug, statusCode: 301 });
}
for (const src of ['/portfolio-detail', '/portfolio-detail.html']) old.push({ source: src, destination: '/portfolio', statusCode: 301 });
let vj = read('vercel.json');
const vcrlf = vj.includes('\r\n');
vj = vj.replace(/\r\n/g, '\n').replace(/\n    \{ "source": "\/portfolio-detail[^\n]*/g, '').replace(/(\n  "redirects": \[[\s\S]*?)(\n  \],)/, (m, list, close) => list.replace(/ \}$/, ' },') + '\n' + old.map(line).join(',\n') + close);
JSON.parse(vj); // still valid
write('vercel.json', vcrlf ? vj.replace(/\n/g, '\r\n') : vj);
console.log('vercel.json:', old.length, 'portfolio-detail redirects');

require('./build-sitemap')();
