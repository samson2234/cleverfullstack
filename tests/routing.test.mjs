// FR/NFR: every page is reachable — no redirect loops, and no internal link on any page points at a missing page or file.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cfg = JSON.parse(fs.readFileSync(path.join(root, 'vercel.json'), 'utf8'));
const SITE = 'https://cleverstack.dev';
const SKIP = ['node_modules', 'vendor', 'scripts', 'tests', 'docs', 'api', 'lib', 'blog-src', 'images'];

function htmlFiles(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.') || SKIP.includes(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) htmlFiles(p, out); else if (e.name.endsWith('.html')) out.push(p);
  }
  return out;
}

test('no redirect loops: with cleanUrls on, nothing may redirect to a *.html address', () => {
  assert.equal(cfg.cleanUrls, true);
  for (const r of cfg.redirects || []) {
    assert.ok(!/\.html$/.test(r.destination), `${r.source} -> ${r.destination} loops with cleanUrls (which redirects .html back)`);
    assert.notEqual(r.source, r.destination, `${r.source} redirects to itself`);
  }
});

test('SEO head tags: one canonical per page, no duplicate hreflang, country pages share one reciprocal hreflang set', () => {
  const sets = {};
  for (const file of htmlFiles(root)) {
    const rel = path.relative(root, file).replace(/\\/g, '/');
    const html = fs.readFileSync(file, 'utf8');
    assert.ok((html.match(/<link rel="canonical"/g) || []).length <= 1, `${rel}: more than one canonical`);
    const langs = [...html.matchAll(/<link rel="alternate" hreflang="([^"]*)" href="([^"]*)"/g)];
    assert.equal(new Set(langs.map((m) => m[1])).size, langs.length, `${rel}: duplicate hreflang`);
    if (/^web-development-(usa|uk|europe)\.html$/.test(rel)) {
      sets[rel] = langs.map((m) => m[1] + '=' + m[2]).sort().join(' ');
      assert.ok(langs.some((m) => m[2] === SITE + '/' + rel.replace('.html', '')), `${rel}: hreflang set does not include itself`);
    }
  }
  assert.equal(new Set(Object.values(sets)).size, 1, 'the USA/UK/Europe pages must carry the same hreflang set');
});

test('no mojibake: no UTF-8 text saved through the wrong encoding (e.g. a checkmark showing as "âœ“")', () => {
  const files = htmlFiles(root).concat(['style.css', 'script.js', 'i18n.js', 'roi.js', 'analytics.js'].map((f) => path.join(root, f)));
  const bad = files.filter((f) => /â€|âœ|â†|Ã[ -¿]/.test(fs.readFileSync(f, 'utf8'))).map((f) => path.relative(root, f));
  assert.deepEqual(bad, []);
});

test('header: every page highlights exactly the section it belongs to', () => {
  const MAP = { 'index.html': 'index', 'about.html': 'about', 'services.html': 'services', 'portfolio.html': 'portfolio', 'portfolio-detail.html': 'portfolio', 'case-studies.html': 'portfolio', 'reviews.html': 'reviews', 'review.html': 'reviews', 'contact.html': 'contact', 'welcome-back.html': 'contact' };
  const norm = (href, rel) => (rel.startsWith('blog/') && href === 'index.html') ? 'blog' : (href.replace(/^\.\.\//, '').replace(/\/index\.html$/, '').replace(/\.html$/, '') || 'index');
  for (const file of htmlFiles(root)) {
    const rel = path.relative(root, file).replace(/\\/g, '/');
    const html = fs.readFileSync(file, 'utf8');
    const nav = (html.match(/<nav class="main-nav"[^>]*>([\s\S]*?)<\/nav>/) || [])[1];
    if (!nav) continue;
    const active = [...nav.matchAll(/<a href="([^"]+)" class="active"/g)].map((m) => norm(m[1], rel));
    // service and industry pages (scripts/build-landing.js) belong to Services
    const want = rel.startsWith('blog/') ? 'blog' : rel.startsWith('work/') ? 'portfolio' : html.includes('<main id="main" data-landing="') ? 'services' : MAP[rel];
    assert.deepEqual(active, want ? [want] : [], `${rel}: active nav ${JSON.stringify(active)}`);
  }
});

test('no hard-coded Google Fonts file preloads (their versioned URLs go stale and 404)', () => {
  for (const file of htmlFiles(root)) {
    assert.ok(!/<link rel="preload" as="font"[^>]*fonts\.gstatic\.com/.test(fs.readFileSync(file, 'utf8')), path.relative(root, file) + ': stale font preload');
  }
});

// Resolves a site path the way Vercel would (cleanUrls + redirects + rewrites) to a file on disk.
function resolves(p) {
  p = decodeURIComponent(p.split('#')[0].split('?')[0]);
  if (p === '' || p === '/') return fs.existsSync(path.join(root, 'index.html'));
  const red = (cfg.redirects || []).find((r) => r.source === p);
  if (red) p = red.destination;
  const f = path.join(root, p);
  if (fs.existsSync(f) && fs.statSync(f).isFile()) return true;
  if (fs.existsSync(f + '.html')) return true;
  if (fs.existsSync(path.join(f, 'index.html'))) return true;
  if (p.startsWith('/api/')) return fs.existsSync(path.join(root, p.replace(/\/$/, '') + '.js'));
  return false;
}

test('every internal link, image and script on every page resolves to a real file', () => {
  const broken = [];
  for (const file of htmlFiles(root)) {
    const rel = path.relative(root, file).replace(/\\/g, '/');
    if (rel === 'admin.html') continue;
    const html = fs.readFileSync(file, 'utf8').replace(/<script>[\s\S]*?<\/script>/g, '');
    for (const m of html.matchAll(/\s(?:href|src)="([^"]+)"/g)) {
      let u = m[1].replace(/&amp;/g, '&');
      // /_vercel/* is served by the platform (Vercel Web Analytics), not a file in the repo
      if (/^(mailto:|tel:|javascript:|#|data:|\/_vercel\/|https?:\/\/(?!cleverfullstack\.vercel\.app))/i.test(u) || u.includes('${')) continue;
      if (u.startsWith(SITE)) u = u.slice(SITE.length) || '/';
      const site = u.startsWith('/') ? u : '/' + path.posix.join(path.posix.dirname(rel), u);
      if (!resolves(site)) broken.push(`${rel}: ${m[1]}`);
    }
  }
  assert.deepEqual([...new Set(broken)], [], 'broken links');
});
