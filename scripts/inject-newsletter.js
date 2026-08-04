// scripts/inject-newsletter.js — Adds the footer newsletter form to every page.
// Inserts the form right before the footer-bottom row.
// Run: node scripts/inject-newsletter.js

const fs = require('fs');
const path = require('path');

const root = process.argv[2] ? path.resolve(process.argv[2]) : (__dirname + '/..');

const pages = [
  'index.html',
  'about.html',
  'services.html',
  'portfolio.html',
  'portfolio-detail.html',
  'contact.html',
  'blog/index.html',
  'blog/web-development.html',
  '404.html'
];

const FORM_HTML =
  '<div class="footer-newsletter"><div class="container">' +
  '<h4 data-i18n="footer.newsletter_heading">Stay in the loop</h4>' +
  '<p data-i18n="footer.newsletter_text">Get web growth tips and studio updates — no spam, unsubscribe anytime.</p>' +
  '<form class="subscribe-form" action="/api/subscribe" method="POST" novalidate>' +
  '<input type="email" name="email" placeholder="you@company.com" required aria-label="Email address" data-i18n-placeholder="footer.newsletter_placeholder">' +
  '<button type="submit" data-i18n="footer.newsletter_btn">Subscribe</button>' +
  '</form>' +
  '<p class="subscribe-status" role="status" aria-live="polite"></p>' +
  '</div></div>';

function walk(dir, out) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.') || e.name === 'node_modules' || e.name === 'scripts' || e.name === 'vendor' || e.name === 'api' || e.name === 'lib') continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name.endsWith('.html')) out.push(p);
  }
}

const allHtml = [];
walk(root, allHtml);

let changed = 0;
let already = 0;

for (const f of allHtml) {
  const rel = path.relative(root, f).replace(/\\/g, '/');
  if (!pages.includes(rel)) continue;

  let src = fs.readFileSync(f, 'utf8');

  if (src.indexOf('footer-newsletter') !== -1) {
    already++;
    console.log('  SKIP (already has newsletter): ' + rel);
    continue;
  }

  const anchor = '<div class="footer-bottom">';
  const idx = src.indexOf(anchor);
  if (idx === -1) {
    console.log('  ERROR (footer-bottom not found): ' + rel);
    continue;
  }

  src = src.slice(0, idx) + FORM_HTML + src.slice(idx);
  fs.writeFileSync(f, src);
  changed++;
  console.log('  + newsletter added: ' + rel);
}

console.log('\nDone. ' + changed + ' updated, ' + already + ' already present.');
