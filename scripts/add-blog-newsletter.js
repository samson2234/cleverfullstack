// scripts/add-blog-newsletter.js — Adds a newsletter CTA section to blog/index.html
// Run: node scripts/add-blog-newsletter.js

const fs = require('fs');
const path = require('path');

const root = process.argv[2] ? path.resolve(process.argv[2]) : (__dirname + '/..');
const f = path.join(root, 'blog/index.html');

let t = fs.readFileSync(f, 'utf8');
if (t.indexOf('blog-newsletter') !== -1) {
  console.log('Already present — skipping.');
  process.exit(0);
}

const anchor = '<footer';
const i = t.indexOf(anchor);
if (i === -1) {
  console.log('ERROR: <footer not found');
  process.exit(1);
}

const sec =
  '<section class="section-pad section-light"><div class="container blog-newsletter"><div class="newsletter-cta">' +
  '<h2 data-i18n="blog.newsletter_heading">Get web growth tips in your inbox</h2>' +
  '<p data-i18n="blog.newsletter_text">One practical email per month on building websites that convert. No spam, unsubscribe anytime.</p>' +
  '<form class="subscribe-form" action="/api/subscribe" method="POST" novalidate>' +
  '<input type="email" name="email" placeholder="you@company.com" required aria-label="Email address" data-i18n-placeholder="footer.newsletter_placeholder">' +
  '<button type="submit" data-i18n="footer.newsletter_btn">Subscribe</button>' +
  '</form>' +
  '<p class="subscribe-status" role="status" aria-live="polite"></p>' +
  '</div></div></section>';

t = t.slice(0, i) + sec + t.slice(i);
fs.writeFileSync(f, t);
console.log('Blog newsletter section added at index', i);
