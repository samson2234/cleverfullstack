// scripts/version-assets.js — cache-busting for the site's shared CSS/JS.
//
// Problem: style.css / script.js / i18n.js / analytics.js are cached by browsers and the CDN
// (see vercel.json). After a deploy, returning visitors could get NEW html with OLD css/js
// (e.g. new markup but old translations or missing styles) for up to a day.
//
// Fix: every reference becomes  style.css?v=<hash of the file's content>. When a file changes its
// URL changes, so nobody can be served a stale copy; unchanged files keep their URL and stay cached.
//
// Usage:   npm run assets         (rewrites the html files in place; safe to run repeatedly)
//          npm run assets:check   (exit 1 if anything is out of date; used by the tests/CI)

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const root = path.resolve(__dirname, '..');
const ASSETS = ['style.css', 'script.js', 'i18n.js', 'analytics.js'];
const check = process.argv.includes('--check');

const hash = (file) => crypto.createHash('sha1').update(fs.readFileSync(path.join(root, file))).digest('hex').slice(0, 8);
const versions = Object.fromEntries(ASSETS.map((a) => [a, hash(a)]));

function walk(dir, out) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.') || ['node_modules', 'vendor', 'scripts', 'tests', 'docs', 'api', 'lib', 'images'].includes(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out); else if (e.name.endsWith('.html')) out.push(p);
  }
  return out;
}

// href="style.css", href="../style.css?v=old", src='script.js' ... (inline onerror strings are untouched)
const re = new RegExp('((?:src|href)=["\'](?:\\.\\./)?)(' + ASSETS.map((a) => a.replace('.', '\\.')).join('|') + ')(?:\\?v=[0-9a-f]+)?(["\'])', 'g');

let changed = 0, refs = 0;
const stale = [];
for (const file of walk(root, [])) {
  const rel = path.relative(root, file).replace(/\\/g, '/');
  const before = fs.readFileSync(file, 'utf8');
  const after = before.replace(re, (all, pre, asset, post) => { refs++; return pre + asset + '?v=' + versions[asset] + post; });
  if (after !== before) {
    changed++;
    stale.push(rel);
    if (!check) fs.writeFileSync(file, after);
  }
}

if (check) {
  if (stale.length) { console.error('Out-of-date asset versions in: ' + stale.join(', ') + '\nRun: npm run assets'); process.exit(1); }
  console.log('Asset versions are up to date (' + refs + ' references).');
} else {
  console.log('Versioned ' + refs + ' references; updated ' + changed + ' html files.');
  console.log(versions);
}
