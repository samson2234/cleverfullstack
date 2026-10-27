// NFR: technical SEO can never silently break. Every indexable page is checked for the signals Google reads
// (one H1, unique title and description, self-canonical, consistent og:url/hreflang, valid structured data that
// tells the truth), and the sitemap, redirects, IndexNow key and deploy exclusions are checked against the pages.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE = 'https://cleverstack.dev';
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const SKIP = ['node_modules', 'vendor', 'scripts', 'tests', 'docs', 'api', 'lib', 'images', 'blog-src', 'work-src'];
const files = [];
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    if (e.name.startsWith('.') || SKIP.includes(e.name)) continue;
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p); else if (e.name.endsWith('.html')) files.push(path.relative(root, p).replace(/\\/g, '/'));
  }
})(root);
const pages = files.map((rel) => {
  const html = read(rel);
  const get = (re) => ((html.match(re) || [])[1] || '').replace(/&amp;/g, '&');
  return { rel, html, robots: get(/<meta name="robots" content="([^"]*)"/), canonical: get(/<link rel="canonical" href="([^"]*)"/),
    title: get(/<title>([^<]*)<\/title>/), desc: get(/<meta name="description" content="([^"]*)"/), ogUrl: get(/<meta property="og:url" content="([^"]*)"/) };
});
const indexable = pages.filter((p) => /\bindex\b/.test(p.robots) && !/noindex/.test(p.robots));
const own = (rel) => SITE + (rel === 'index.html' ? '/' : rel === 'blog/index.html' ? '/blog' : '/' + rel.replace(/\.html$/, ''));
const ld = (html) => [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]));
const types = (j) => [].concat(j['@type'] || []).concat((j['@graph'] || []).flatMap((g) => [].concat(g['@type'] || [])));

test('enough indexable pages, each pointing at itself: canonical, og:url and hreflang agree', () => {
  assert.ok(indexable.length >= 50, 'only ' + indexable.length + ' indexable pages');
  for (const p of indexable) {
    assert.equal(p.canonical, own(p.rel), p.rel + ': canonical');
    assert.equal(p.ogUrl, p.canonical, p.rel + ': og:url');
    for (const m of p.html.matchAll(/<link rel="alternate" hreflang="(en|x-default)" href="([^"]*)"/g)) {
      if (!/^web-development-/.test(p.rel)) assert.equal(m[2], p.canonical, p.rel + ': hreflang ' + m[1]);
    }
  }
});

test('no French hreflang: the server only sends English HTML (Option A in docs/SEO-PLAN.md)', () => {
  for (const p of pages) assert.ok(!/hreflang="fr"/.test(p.html), p.rel);
});

test('one H1, a unique title and a unique, useful meta description on every indexable page', () => {
  const titles = new Map(), descs = new Map();
  for (const p of indexable) {
    assert.equal((p.html.match(/<h1[ >]/g) || []).length, 1, p.rel + ': H1 count');
    assert.ok(p.title.length >= 15 && p.title.length <= 110, p.rel + ': title length ' + p.title.length);
    assert.ok(p.desc.length >= 70 && p.desc.length <= 175, p.rel + ': description length ' + p.desc.length);
    assert.ok(!titles.has(p.title), p.rel + ': same title as ' + titles.get(p.title)); titles.set(p.title, p.rel);
    assert.ok(!descs.has(p.desc), p.rel + ': same description as ' + descs.get(p.desc)); descs.set(p.desc, p.rel);
  }
});

test('structured data is valid JSON, truthful and has breadcrumbs', () => {
  for (const p of pages) {
    let blocks; try { blocks = ld(p.html); } catch (e) { assert.fail(p.rel + ': invalid JSON-LD: ' + e.message); }
    const all = blocks.flatMap(types);
    if (p.rel !== '404.html') assert.ok(!all.includes('ErrorPage'), p.rel + ': marked as an error page');
    for (const b of blocks) {
      assert.ok(!JSON.stringify(b).includes(SITE + '/404"') || p.rel === '404.html', p.rel + ': structured data points at /404');
      // the only office address we may state is the real one
      const addr = JSON.stringify(b.address || '');
      if (b.address) assert.ok(/"addressCountry":"NG"/.test(addr) && !/London|New York/.test(addr), p.rel + ': address ' + addr);
    }
    if (indexable.includes(p) && p.rel !== 'index.html') assert.ok(all.includes('BreadcrumbList'), p.rel + ': no BreadcrumbList');
  }
  const org = ld(read('index.html')).find((b) => b['@id'] === SITE + '/#organization');
  assert.ok(org && types(org).includes('ProfessionalService') && types(org).includes('Organization'), 'homepage organization');
  for (const c of ['United States', 'United Kingdom', 'Germany', 'Canada']) assert.ok(org.areaServed.some((a) => a.name === c), 'areaServed ' + c);
  assert.ok(!JSON.stringify(org.sameAs).includes('wwwclutch') && !JSON.stringify(org.sameAs).includes('goodfirms'), 'sameAs only lists profiles that exist');
});

test('sitemap.xml lists exactly the indexable pages and is up to date', () => {
  const sm = read('sitemap.xml');
  const locs = [...sm.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  assert.deepEqual([...locs].sort(), indexable.map((p) => p.canonical).sort());
  assert.ok(/xmlns:image=/.test(sm) && /<image:loc>/.test(sm), 'image sitemap entries');
  for (const m of sm.matchAll(/<lastmod>([^<]+)<\/lastmod>/g)) assert.match(m[1], /^\d{4}-\d{2}-\d{2}$/);
  execFileSync(process.execPath, [path.join(root, 'scripts/build-sitemap.js'), '--check'], { cwd: root, stdio: 'pipe' });
  const robots = read('robots.txt');
  assert.ok(robots.includes('Sitemap: ' + SITE + '/sitemap.xml'));
  for (const line of robots.split('\n').filter((l) => /^Disallow:/.test(l))) {
    const pathRule = line.replace('Disallow:', '').trim();
    for (const p of indexable) assert.ok(!new URL(p.canonical).pathname.startsWith(pathRule) || pathRule === '', p.rel + ' blocked by ' + line);
  }
});

test('portfolio: one indexable page per project, old ?id= links 301 to it, nothing links to the old URL', () => {
  const projects = JSON.parse(read('work-src/projects.json'));
  const cfg = JSON.parse(read('vercel.json'));
  for (const p of projects) {
    assert.ok(fs.existsSync(path.join(root, 'work', p.slug + '.html')), p.slug + ': page missing');
    for (const src of ['/portfolio-detail', '/portfolio-detail.html']) {
      const r = cfg.redirects.find((x) => x.source === src && x.has && x.has[0].key === 'id' && x.has[0].value === p.id);
      assert.ok(r && r.destination === '/work/' + p.slug && r.statusCode === 301, src + '?id=' + p.id + ' redirect');
    }
  }
  assert.equal(fs.readdirSync(path.join(root, 'work')).filter((f) => f.endsWith('.html')).length, projects.length, 'stale pages in /work');
  for (const p of pages) if (p.rel !== 'portfolio-detail.html') assert.ok(!/portfolio-detail(\.html)?\?id=/.test(p.html), p.rel + ': links to portfolio-detail?id=');
  assert.match(read('portfolio-detail.html'), /<meta name="robots" content="noindex/);
});

test('every blog post links to a case study and to the services page', () => {
  for (const p of JSON.parse(read('blog/posts.json'))) {
    const html = read('blog/' + p.id + '.html');
    assert.match(html, /class="work-links"[\s\S]*?href="\/work\/[a-z0-9-]+"/, p.id + ': case study link');
    assert.ok(html.includes('href="../services.html"'), p.id + ': services link');
  }
});

test('IndexNow key file is valid; internal files are not deployed or served', () => {
  const key = fs.readdirSync(root).filter((f) => /^[0-9a-f]{32}\.txt$/.test(f));
  assert.equal(key.length, 1, 'exactly one IndexNow key file');
  assert.equal(read(key[0]).trim(), key[0].slice(0, -4));
  const ignore = read('.vercelignore').split(/\r?\n/);
  for (const d of ['docs/', 'tests/', 'scripts/', 'blog-src/', 'work-src/']) assert.ok(ignore.includes(d), '.vercelignore misses ' + d);
  for (const d of ['api/', 'lib/', 'blog/', 'work/', 'images/', 'vendor/']) assert.ok(!ignore.includes(d), '.vercelignore must not exclude ' + d);
  const cfg = JSON.parse(read('vercel.json'));
  assert.ok(cfg.redirects.some((r) => r.source === '/lib/:path*'), 'lib/ is not blocked from direct requests');
});

test('Core Web Vitals guards: no full-screen preloader, theme set before first paint, on-screen content not hidden', () => {
  for (const p of pages.filter((x) => /script\.js\?v=/.test(x.html))) {
    assert.ok(!p.html.includes('<div class="page-preloader">'), p.rel + ': preloader is back');
    assert.ok(p.html.indexOf('theme before first paint') > -1 && p.html.indexOf('theme before first paint') < p.html.indexOf('</head>'), p.rel + ': theme not set in <head>');
    const hero = (p.html.match(/<main id="main">\s*<section class="(?:hero|page-hero|post-hero|pd-hero)[^"]*"[\s\S]*?<\/section>/) || [''])[0];
    assert.ok(!/class="[^"]*\breveal(-left|-right|-scale)?\b/.test(hero), p.rel + ': hero hidden behind a reveal animation');
  }
  assert.ok(!read('script.js').includes('gsap.fromTo(t,{autoAlpha:0,y:26}'), 'script.js re-hides the hero');
});
