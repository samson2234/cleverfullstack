// scripts/sync-testimonials.js — keeps the Reviews page showing every testimonial from the homepage carousel.
// Source of truth: the .testimonial-card blocks in index.html. Output: the block between the
// <!--testimonials:start--> and <!--testimonials:end--> markers in reviews.html.
//
// Usage:   npm run testimonials         (rewrites reviews.html)
//          npm run testimonials:check   (exit 1 if reviews.html is out of date; used by the tests/CI)
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const check = process.argv.includes('--check');
const START = '<!--testimonials:start-->';
const END = '<!--testimonials:end-->';

const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const re = /<div class="testimonial-card"[^>]*><div class="stars">([^<]*)<\/div><blockquote>([\s\S]*?)<\/blockquote><div class="person"><div class="who"><b>([^<]*)<\/b><span>([^<]*)<\/span>/g;
const cards = [...index.matchAll(re)].map((m) => ({ stars: m[1], quote: m[2].trim().replace(/^"|"$/g, ''), name: m[3], label: m[4] }));
if (!cards.length) throw new Error('no testimonial cards found in index.html');

const block = START + '\n<div class="rv-wall">' + cards.map((c) =>
  `<article class="rv-card"><div class="rv-stars" aria-label="${c.stars.length} out of 5 stars">${c.stars}</div><p>${c.quote}</p><div class="rv-meta">${c.name}<span style="display:block">${c.label}</span></div></article>`
).join('') + '</div>\n' + END;

const file = path.join(root, 'reviews.html');
let html = fs.readFileSync(file, 'utf8');
const nl = html.includes('\r\n') ? '\r\n' : '\n';
const re2 = new RegExp(START + '[\\s\\S]*?' + END);
if (!re2.test(html)) throw new Error('markers missing in reviews.html');
const next = html.replace(re2, () => block.replace(/\n/g, nl));
if (next === html) { console.log('Testimonials up to date (' + cards.length + ' cards).'); process.exit(0); }
if (check) { console.error('reviews.html is out of date. Run: npm run testimonials'); process.exit(1); }
fs.writeFileSync(file, next);
console.log('Wrote ' + cards.length + ' testimonials to reviews.html');
