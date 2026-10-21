// scripts/localize-images.js — one-off migration: host every third-party image on this site instead of hot-linking it.
// Third-party image hosts (Fiverr CDN, Unsplash, other people's sites) fail intermittently and can remove files
// at any time; local WebP files are fast, cached for a year (see vercel.json) and cannot break.
//
// Needs `sharp`:   npm i --no-save sharp        then:   node scripts/localize-images.js
// Safe to re-run: already-downloaded files are reused and already-rewritten references are left alone.
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const root = path.resolve(__dirname, '..');
const BASE = 'https://cleverfullstack.vercel.app';
const UA = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130', Accept: 'image/*,*/*' };
const SKIP = ['node_modules', 'vendor', 'scripts', 'tests', 'docs', 'api', 'lib', 'blog-src', 'images'];

const files = [];
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    if (e.name.startsWith('.') || SKIP.includes(e.name)) continue;
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p); else if (/\.(html|js|json|xml)$/.test(e.name)) files.push(p);
  }
})(root);

const RE_UNS = /https:\/\/images\.unsplash\.com\/photo-([0-9a-f-]+)\?([^"'\s)<>\\]*)/g;
const RE_FIV = /https:\/\/fiverr-res\.cloudinary\.com\/image\/upload\/([^/]+)\/v1\/attachments\/project_item\/attachment\/([0-9a-f]+-\d+)\/([^"'\s)<>\\,]+)/g;
const RE_SUR = /https:\/\/ersurajverma\.in\/wp-content\/uploads\/2026\/05\/portfolio_([a-z]+)\.png/g;

const wOf = (s, re) => { const m = s.match(re); return m ? parseInt(m[1], 10) : null; };
const need = { unsplash: new Map(), fiverr: new Map(), demo: new Set() };
const read = (f) => fs.readFileSync(f, 'utf8');

for (const f of files) {
  const t = read(f);
  for (const m of t.matchAll(RE_UNS)) { const id = m[1]; if (!need.unsplash.has(id)) need.unsplash.set(id, new Set()); need.unsplash.get(id).add(wOf(m[2], /(?:^|&)w=(\d+)/) || 1200); }
  for (const m of t.matchAll(RE_FIV)) { if (!need.fiverr.has(m[2])) need.fiverr.set(m[2], { url: m[0], sizes: new Set() }); }
  for (const m of t.matchAll(RE_SUR)) need.demo.add(m[1]);
}

async function get(url) {
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(url, { headers: UA, redirect: 'follow', signal: AbortSignal.timeout(30000) });
      if (r.status === 200 && /^image\//.test(r.headers.get('content-type') || '')) return Buffer.from(await r.arrayBuffer());
      throw new Error('HTTP ' + r.status + ' ' + r.headers.get('content-type'));
    } catch (e) { if (i === 2) throw new Error(url + ' — ' + e.message); }
  }
}
async function save(buf, out, width, quality) {
  fs.mkdirSync(path.dirname(out), { recursive: true });
  await sharp(buf).resize({ width, withoutEnlargement: true }).webp({ quality, effort: 5 }).toFile(out);
  return (fs.statSync(out).size / 1024).toFixed(0) + ' KB';
}
const fivId = (a) => a.split('-')[0].slice(0, 8);

(async () => {
  let kb = 0;
  const log = (what, size) => { kb += parseInt(size, 10); console.log('  ' + what.padEnd(52) + size); };

  for (const [id, widths] of need.unsplash) {
    const sizes = [...new Set([...widths, 800])].sort((a, b) => a - b);
    if (sizes.every((w) => fs.existsSync(path.join(root, 'images/blog', `u-${id}-${w}.webp`)))) continue;
    const buf = await get(`https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=1600&q=80`);
    for (const w of sizes) log(`blog/u-${id}-${w}.webp`, await save(buf, path.join(root, 'images/blog', `u-${id}-${w}.webp`), w, 74));
  }
  for (const [att, v] of need.fiverr) {
    const out = (w) => path.join(root, 'images/portfolio', `fv-${fivId(att)}-${w}.webp`);
    if ([480, 800, 1200].every((w) => fs.existsSync(out(w)))) continue;
    const buf = await get(v.url.replace(/upload\/[^/]+\/v1/, 'upload/f_auto,q_auto,c_limit,w_1400/v1'));
    for (const w of [480, 800, 1200]) log(`portfolio/fv-${fivId(att)}-${w}.webp`, await save(buf, out(w), w, 76));
  }
  for (const name of need.demo) {
    const out = path.join(root, 'images/portfolio', `demo-${name}-800.webp`);
    if (fs.existsSync(out)) continue;
    const buf = await get(`https://ersurajverma.in/wp-content/uploads/2026/05/portfolio_${name}.png`);
    log(`portfolio/demo-${name}-800.webp`, await save(buf, out, 800, 76));
  }

  // rewrite references: root-relative for <img>/css, absolute for meta tags and structured data
  const snap = (w, set) => { const a = [...set].sort((x, y) => x - y); return a.find((x) => x >= w) || a[a.length - 1]; };
  let changed = 0;
  for (const f of files) {
    let t = read(f); const before = t;
    t = t.replace(RE_UNS, (m, id, q) => `/images/blog/u-${id}-${snap(wOf(q, /(?:^|&)w=(\d+)/) || 1200, [...need.unsplash.get(id), 800])}.webp`);
    t = t.replace(RE_FIV, (m, tr, att) => { const w = wOf(tr, /w_(\d+)/); return `/images/portfolio/fv-${fivId(att)}-${w ? snap(w, [480, 800, 1200]) : 1200}.webp`; });
    t = t.replace(RE_SUR, (m, name) => `/images/portfolio/demo-${name}-800.webp`);
    t = t.replace(/(content=["']|"image"\s*:\s*\[?\s*["']|<image:loc>)(\/images\/)/g, `$1${BASE}$2`);
    if (t !== before) { fs.writeFileSync(f, t); changed++; console.log('rewrote', path.relative(root, f)); }
  }
  console.log(`done: ${changed} files rewritten, ~${kb} KB of images added`);
})().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
