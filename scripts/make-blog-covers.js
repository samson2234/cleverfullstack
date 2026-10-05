// scripts/make-blog-covers.js — generates branded blog cover images (images/blog/<id>.webp, 1400x700, ~20-30 KB each).
// Needs `sharp` (not a site dependency):  npm i --no-save sharp   then   node scripts/make-blog-covers.js
// Text-free on purpose (no font dependency): the post title is shown by the page itself.
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const root = path.resolve(__dirname, '..');
const outDir = path.join(root, 'images', 'blog');
fs.mkdirSync(outDir, { recursive: true });

const star = (cx, cy, r) => {
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const a = (Math.PI / 5) * i - Math.PI / 2;
    const rr = i % 2 === 0 ? r : r * 0.42;
    pts.push((cx + Math.cos(a) * rr).toFixed(1) + ',' + (cy + Math.sin(a) * rr).toFixed(1));
  }
  return pts.join(' ');
};

const icons = {
  funnel: `
    <path d="M-190 -170 H190 L48 10 V150 L-48 190 V10 Z" fill="url(#ic)" stroke="#fff" stroke-opacity=".3" stroke-width="3"/>
    <circle cx="-120" cy="-222" r="11" fill="#2AA79F"/><circle cx="0" cy="-232" r="13" fill="#FF6B4A"/><circle cx="112" cy="-218" r="10" fill="#F5A524"/>
    <circle cx="0" cy="232" r="20" fill="#2AA79F"/><circle cx="0" cy="232" r="38" fill="none" stroke="#2AA79F" stroke-opacity=".5" stroke-width="4"/>`,
  gauge: `
    <path d="M-175 95 A175 175 0 0 1 175 95" fill="none" stroke="url(#ic)" stroke-width="30" stroke-linecap="round"/>
    <g stroke="#fff" stroke-opacity=".35" stroke-width="6" stroke-linecap="round"><line x1="-150" y1="-10" x2="-130" y2="3"/><line x1="-85" y1="-95" x2="-72" y2="-75"/><line x1="0" y1="-125" x2="0" y2="-100"/><line x1="85" y1="-95" x2="72" y2="-75"/><line x1="150" y1="-10" x2="130" y2="3"/></g>
    <line x1="0" y1="95" x2="98" y2="-52" stroke="#fff" stroke-width="13" stroke-linecap="round"/><circle cx="0" cy="95" r="24" fill="#fff"/>
    <g stroke="#2AA79F" stroke-width="8" stroke-linecap="round" stroke-opacity=".8"><line x1="-250" y1="30" x2="-205" y2="30"/><line x1="-270" y1="70" x2="-215" y2="70"/><line x1="-240" y1="110" x2="-200" y2="110"/></g>`,
  pin: `
    <path d="M0 -190 C-85 -190 -140 -125 -140 -50 C-140 55 0 190 0 190 C0 190 140 55 140 -50 C140 -125 85 -190 0 -190 Z" fill="url(#ic)" stroke="#fff" stroke-opacity=".3" stroke-width="3"/>
    <circle cx="0" cy="-50" r="54" fill="#fff" fill-opacity=".95"/>
    <ellipse cx="0" cy="222" rx="125" ry="26" fill="none" stroke="#2AA79F" stroke-width="5" stroke-opacity=".8"/><ellipse cx="0" cy="222" rx="68" ry="14" fill="none" stroke="#2AA79F" stroke-width="5" stroke-opacity=".5"/>`,
  stars: `
    <polygon points="${star(0, -15, 118)}" fill="#F5A524" stroke="#fff" stroke-opacity=".35" stroke-width="3"/>
    <polygon points="${star(-190, 70, 82)}" fill="#F5A524" fill-opacity=".85" stroke="#fff" stroke-opacity=".25" stroke-width="3"/>
    <polygon points="${star(190, 70, 82)}" fill="#F5A524" fill-opacity=".85" stroke="#fff" stroke-opacity=".25" stroke-width="3"/>
    <circle cx="-110" cy="-170" r="9" fill="#2AA79F"/><circle cx="120" cy="-175" r="12" fill="#FF6B4A"/><circle cx="230" cy="-60" r="8" fill="#6366F1"/>`,
  compare: `
    <rect x="-245" y="-120" width="215" height="250" rx="20" fill="#fff" fill-opacity=".07" stroke="#fff" stroke-opacity=".3" stroke-width="3"/>
    <circle cx="-218" cy="-95" r="7" fill="#fff" fill-opacity=".4"/><circle cx="-196" cy="-95" r="7" fill="#fff" fill-opacity=".4"/>
    <line x1="-205" y1="-30" x2="-70" y2="85" stroke="#FF6B4A" stroke-width="16" stroke-linecap="round"/><line x1="-70" y1="-30" x2="-205" y2="85" stroke="#FF6B4A" stroke-width="16" stroke-linecap="round"/>
    <rect x="20" y="-160" width="240" height="300" rx="22" fill="#fff" fill-opacity=".13" stroke="#2AA79F" stroke-width="5"/>
    <circle cx="48" cy="-132" r="8" fill="#FF6B4A"/><circle cx="72" cy="-132" r="8" fill="#F5A524"/><circle cx="96" cy="-132" r="8" fill="#2AA79F"/>
    <polyline points="75,0 125,50 210,-45" fill="none" stroke="#2AA79F" stroke-width="20" stroke-linecap="round" stroke-linejoin="round"/>`,
  shield: `
    <path d="M0 -195 L152 -138 V-8 C152 92 92 162 0 205 C-92 162 -152 92 -152 -8 V-138 Z" fill="url(#ic)" stroke="#fff" stroke-opacity=".3" stroke-width="3"/>
    <rect x="-48" y="-12" width="96" height="86" rx="16" fill="#fff"/>
    <path d="M-30 -12 V-42 A30 30 0 0 1 30 -42 V-12" fill="none" stroke="#fff" stroke-width="15" stroke-linecap="round"/>
    <circle cx="0" cy="30" r="12" fill="#4F46E5"/><rect x="-4" y="30" width="8" height="26" rx="4" fill="#4F46E5"/>`
};

const svg = (icon) => `<svg xmlns="http://www.w3.org/2000/svg" width="1400" height="700" viewBox="0 0 1400 700">
<defs>
  <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0E1330"/><stop offset="1" stop-color="#232A6B"/></linearGradient>
  <linearGradient id="ic" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#6366F1"/><stop offset="1" stop-color="#2AA79F"/></linearGradient>
  <radialGradient id="g1" cx="70%" cy="48%" r="42%"><stop offset="0" stop-color="#6366F1" stop-opacity=".55"/><stop offset="1" stop-color="#6366F1" stop-opacity="0"/></radialGradient>
  <radialGradient id="g2" cx="12%" cy="92%" r="38%"><stop offset="0" stop-color="#2AA79F" stop-opacity=".35"/><stop offset="1" stop-color="#2AA79F" stop-opacity="0"/></radialGradient>
  <pattern id="grid" width="56" height="56" patternUnits="userSpaceOnUse"><path d="M56 0H0V56" fill="none" stroke="#fff" stroke-opacity=".05"/></pattern>
</defs>
<rect width="1400" height="700" fill="url(#bg)"/><rect width="1400" height="700" fill="url(#grid)"/>
<rect width="1400" height="700" fill="url(#g1)"/><rect width="1400" height="700" fill="url(#g2)"/>
<g><rect x="80" y="520" width="34" height="34" rx="8" fill="#6366F1"/><rect x="80" y="566" width="34" height="34" rx="8" fill="#2AA79F"/><rect x="80" y="612" width="34" height="34" rx="8" fill="#FF6B4A"/></g>
<g transform="translate(985 350)">${icon}</g>
</svg>`;

(async () => {
  const srcDir = path.join(root, 'blog-src');
  for (const f of fs.readdirSync(srcDir).filter((x) => x.endsWith('.js'))) {
    const post = require(path.join(srcDir, f));
    if (!icons[post.icon]) throw new Error(post.id + ': unknown icon ' + post.icon);
    const out = path.join(outDir, post.id + '.webp');
    await sharp(Buffer.from(svg(icons[post.icon]))).webp({ quality: 74, effort: 6 }).toFile(out);
    console.log(post.id.padEnd(44), (fs.statSync(out).size / 1024).toFixed(1) + ' KB');
  }
})();
