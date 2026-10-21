// scripts/set-domain.js — switch the whole site to a new domain in one go.
//
// Usage:   node scripts/set-domain.js https://www.example.com          (dry run: lists what would change)
//          node scripts/set-domain.js https://www.example.com --write  (rewrites the files)
//
// Rewrites every https://cleverfullstack.vercel.app reference (canonical/hreflang/og tags, structured data,
// sitemap.xml, robots.txt, feed.xml, llms.txt, emails, tests, build scripts). After running it:
//   1. add the domain in Vercel (Project → Settings → Domains) and set the env var SITE_URL to the same origin;
//   2. keep cleverfullstack.vercel.app attached so old links still work (Vercel can redirect it to the new domain);
//   3. npm test, deploy, then submit the new sitemap in Google Search Console.
const fs = require('fs');
const path = require('path');

const OLD = 'https://cleverfullstack.vercel.app';
const root = path.resolve(__dirname, '..');
const arg = process.argv[2];
const write = process.argv.includes('--write');
if (!arg || !/^https:\/\/[a-z0-9.-]+\.[a-z]{2,}$/i.test(arg)) {
  console.error('Give the new origin, e.g. https://www.example.com (https, no trailing slash)');
  process.exit(1);
}
const NEW = arg.toLowerCase();
const SKIP = new Set(['node_modules', '.git', 'images', 'vendor']);
const EXT = /\.(html|xml|txt|json|js|mjs|md|yml)$/;
let files = 0, refs = 0;
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(e.name) || e.name === 'set-domain.js') continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { walk(p); continue; }
    if (!EXT.test(e.name)) continue;
    const t = fs.readFileSync(p, 'utf8');
    const n = t.split(OLD).length - 1;
    if (!n) continue;
    files++; refs += n;
    console.log(String(n).padStart(4), path.relative(root, p));
    if (write) fs.writeFileSync(p, t.split(OLD).join(NEW));
  }
})(root);
console.log(`${write ? 'Rewrote' : 'Would rewrite'} ${refs} references in ${files} files: ${OLD} -> ${NEW}`);
if (!write) console.log('Dry run only. Add --write to apply.');
