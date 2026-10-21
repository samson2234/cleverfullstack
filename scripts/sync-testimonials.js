// scripts/sync-testimonials.js — keeps every testimonial in step across the site.
// Source of truth: the .testimonial-card blocks in index.html (the homepage carousel). It keeps
//   1. the homepage carousel's page dots equal to the number of pages (3 cards per page), and
//   2. the Reviews page wall (between <!--testimonials:start--> and <!--testimonials:end--> in reviews.html)
// showing every testimonial.
//
// Usage:   npm run testimonials         (rewrites index.html dots and reviews.html)
//          npm run testimonials:check   (exit 1 if anything is out of date; used by the tests/CI)
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const check = process.argv.includes('--check');
const START = '<!--testimonials:start-->';
const END = '<!--testimonials:end-->';
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');

const index = read('index.html');
const re = /<div class="testimonial-card"[^>]*><div class="stars">([^<]*)<\/div><blockquote>([\s\S]*?)<\/blockquote><div class="person"><div class="who"><b>([^<]*)<\/b><span>([^<]*)<\/span>(?:<a class="who-link" href="([^"]+)"[^>]*>([^<]*)<\/a>)?/g;
const cards = [...index.matchAll(re)].map((m) => ({ stars: m[1], quote: m[2].trim().replace(/^"|"$/g, ''), name: m[3], label: m[4], link: m[5], linkText: m[6] }));
const total = (index.match(/class="testimonial-card"/g) || []).length;
if (!cards.length) throw new Error('no testimonial cards found in index.html');
if (cards.length !== total) throw new Error(`${total} testimonial cards in index.html but only ${cards.length} match the expected markup`);

// 1. homepage dots
const pages = Math.ceil(cards.length / 3);
const dots = '<div class="testimonial-dots reveal">' + Array.from({ length: pages }, (_, i) =>
  `<button class="testimonial-dot${i ? '' : ' active'}" aria-label="Page ${i + 1}"></button>`).join(' ') + '</div>';
const reDots = /<div class="testimonial-dots reveal">[\s\S]*?<\/div>/;
if (!reDots.test(index)) throw new Error('testimonial dots not found in index.html');
const nextIndex = index.replace(reDots, dots);

// 2. Reviews page wall
const block = START + '\n<div class="rv-wall">' + cards.map((c) =>
  `<article class="rv-card"><div class="rv-stars" aria-label="${c.stars.length} out of 5 stars">${c.stars}</div><p>${c.quote}</p><div class="rv-meta">${c.name}<span>${c.label}</span>${c.link ? `<a class="rv-link" href="${c.link}" target="_blank" rel="noopener">${c.linkText}</a>` : ''}</div></article>`
).join('') + '</div>\n' + END;
const reviews = read('reviews.html');
const nl = reviews.includes('\r\n') ? '\r\n' : '\n';
const reWall = new RegExp(START + '[\\s\\S]*?' + END);
if (!reWall.test(reviews)) throw new Error('markers missing in reviews.html');
const nextReviews = reviews.replace(reWall, () => block.replace(/\n/g, nl));

const stale = [];
if (nextIndex !== index) stale.push('index.html (carousel dots)');
if (nextReviews !== reviews) stale.push('reviews.html (testimonial wall)');
if (!stale.length) { console.log(`Testimonials up to date (${cards.length} cards, ${pages} carousel pages).`); process.exit(0); }
if (check) { console.error('Out of date: ' + stale.join(', ') + '. Run: npm run testimonials'); process.exit(1); }
if (nextIndex !== index) fs.writeFileSync(path.join(root, 'index.html'), nextIndex);
if (nextReviews !== reviews) fs.writeFileSync(path.join(root, 'reviews.html'), nextReviews);
console.log(`Wrote ${cards.length} testimonials (${pages} carousel pages): ` + stale.join(', '));
