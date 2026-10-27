// scripts/build-sitemap.js — writes sitemap.xml from the pages themselves, so it can never drift:
//   - every page whose robots meta says "index" is listed at its canonical URL; noindex pages never are
//   - <lastmod> is the day the page's content last really changed (asset ?v= hashes and the blog's prev/next
//     list are ignored), tracked in scripts/sitemap-lastmod.json; first seen pages start from their git history
//   - each page lists its local content images (image sitemap), so project shots and covers reach Google Images
//
//   node scripts/build-sitemap.js          (also run by build-blog.js and build-work.js)
//   node scripts/build-sitemap.js --check  exit 1 if sitemap.xml is out of date (used by the tests)
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const SITE = 'https://cleverstack.dev';
const STATE = path.join(__dirname, 'sitemap-lastmod.json');
const SKIP = ['node_modules', 'vendor', 'scripts', 'tests', 'docs', 'api', 'lib', 'images', 'blog-src', 'work-src'];
const xml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function pages(dir = root, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.') || SKIP.includes(e.name)) continue;
    const f = path.join(dir, e.name);
    if (e.isDirectory()) pages(f, out); else if (e.name.endsWith('.html')) out.push(f);
  }
  return out;
}

// what counts as a content change: not asset version hashes, not the blog's prev/next list, not line endings
const fingerprint = (html) => crypto.createHash('sha1').update(html.replace(/\r\n/g, '\n').replace(/\?v=[0-9a-f]+/g, '').replace(/var blogPosts\s*=\s*\[[\s\S]*?\];/, '')).digest('hex');

function gitDate(file) {
  try { return execFileSync('git', ['log', '-1', '--format=%cs', '--', file], { cwd: root, encoding: 'utf8' }).trim() || null; } catch (e) { return null; }
}

function images(html, rel) {
  const dir = path.posix.dirname(rel);
  const srcs = [...html.matchAll(/<img\b[^>]*\ssrc="([^"]+)"/g)].map((m) => m[1])
    .concat([...html.matchAll(/background-image:url\('([^']+)'\)/g)].map((m) => m[1]));
  const out = [];
  for (let s of srcs) {
    if (/^(https?:|data:)/.test(s)) continue;
    s = s.split('?')[0];
    const site = s.startsWith('/') ? s : '/' + path.posix.normalize(path.posix.join(dir, s));
    if (!/^\/images\//.test(site) || !fs.existsSync(path.join(root, site))) continue;
    if (!out.includes(site)) out.push(site);
  }
  return out.slice(0, 20).map((s) => SITE + s);
}

function build() {
  const state = fs.existsSync(STATE) ? JSON.parse(fs.readFileSync(STATE, 'utf8')) : {};
  const today = new Date().toISOString().slice(0, 10);
  const entries = [];
  for (const file of pages()) {
    const rel = path.relative(root, file).replace(/\\/g, '/');
    const html = fs.readFileSync(file, 'utf8');
    const robots = (html.match(/<meta name="robots" content="([^"]*)"/) || [])[1] || '';
    const canonical = (html.match(/<link rel="canonical" href="([^"]*)"/) || [])[1];
    if (!/\bindex\b/.test(robots) || /noindex/.test(robots) || !canonical) continue;
    if (!canonical.startsWith(SITE)) throw new Error(rel + ': canonical outside the site: ' + canonical);
    const fp = fingerprint(html);
    const prev = state[canonical];
    const lastmod = !prev ? (gitDate(rel) || today) : prev.fp === fp ? prev.lastmod : today;
    state[canonical] = { fp, lastmod };
    entries.push({ loc: canonical, lastmod, images: images(html, rel) });
  }
  const seen = new Set();
  for (const e of entries) { if (seen.has(e.loc)) throw new Error('two pages claim ' + e.loc); seen.add(e.loc); }
  for (const k of Object.keys(state)) if (!seen.has(k)) delete state[k];
  const rank = (u) => (u === SITE + '/' ? 0 : /\/blog(\/|$)/.test(u) ? 2 : /\/work\//.test(u) ? 3 : 1);
  entries.sort((a, b) => rank(a.loc) - rank(b.loc) || a.loc.localeCompare(b.loc));
  const body = entries.map((e) => '  <url>\n    <loc>' + xml(e.loc) + '</loc>\n    <lastmod>' + e.lastmod + '</lastmod>\n' +
    e.images.map((i) => '    <image:image><image:loc>' + xml(i) + '</image:loc></image:image>\n').join('') + '  </url>').join('\n');
  const out = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n' + body + '\n</urlset>\n';
  return { out, state, count: entries.length };
}

if (require.main === module && process.argv.includes('--check')) {
  const strip = (s) => s.replace(/\r\n/g, '\n').replace(/<lastmod>[^<]*<\/lastmod>/g, '');
  const { out } = build();
  const cur = fs.existsSync(path.join(root, 'sitemap.xml')) ? fs.readFileSync(path.join(root, 'sitemap.xml'), 'utf8') : '';
  if (strip(cur) !== strip(out)) { console.error('sitemap.xml is out of date: run node scripts/build-sitemap.js'); process.exit(1); }
  console.log('sitemap.xml is current');
} else {
  const run = () => {
    const { out, state, count } = build();
    fs.writeFileSync(path.join(root, 'sitemap.xml'), out);
    fs.writeFileSync(STATE, JSON.stringify(state, null, 2) + '\n');
    console.log('sitemap.xml: ' + count + ' pages');
  };
  if (require.main === module) run(); else module.exports = run;
}
