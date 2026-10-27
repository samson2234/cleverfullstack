#!/usr/bin/env node
// scripts/add-mobile-cta.js — puts the phone sticky bar (WhatsApp + Book a Free Call, styled by .mobile-cta-bar in
// style.css) on every indexable page that lacks it, right after the footer. Idempotent. The blog and landing-page
// builders copy it from their layout donors, so generated pages keep it.
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const donor = fs.readFileSync(path.join(ROOT, 'services.html'), 'utf8');
const start = donor.indexOf('<div class="mobile-cta-bar">');
const end = donor.indexOf('</div></div>', start) + '</div></div>'.length;
const BAR = donor.slice(start, end);
if (start < 0 || !BAR.includes('cta-book')) throw new Error('mobile CTA bar not found in services.html');

const files = [];
for (const d of ['', 'blog', 'work']) for (const f of fs.readdirSync(path.join(ROOT, d))) if (f.endsWith('.html')) files.push(path.join(d, f));
let added = 0;
for (const rel of files) {
  const f = path.join(ROOT, rel);
  const s = fs.readFileSync(f, 'utf8');
  if (s.includes('class="mobile-cta-bar"') || /noindex/.test((s.match(/<meta name="robots" content="([^"]*)"/) || [])[1] || 'noindex')) continue;
  if (!s.includes('</footer>')) throw new Error(rel + ': no footer');
  fs.writeFileSync(f, s.replace('</footer>', () => '</footer>' + BAR));
  console.log('added:', rel.replace(/\\/g, '/'));
  added++;
}
console.log(added, 'page(s) updated');
