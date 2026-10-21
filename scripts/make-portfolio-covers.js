// scripts/make-portfolio-covers.js — branded cover images for portfolio projects that have no screenshot yet
// (images/portfolio-<id>.webp, 800x600, text-free: the card shows the project name itself).
// Replace a cover with a real screenshot whenever you have one. Needs `sharp`: npm i --no-save sharp
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const outDir = path.resolve(__dirname, '..', 'images');

const bars = [60, 130, 90, 190, 140, 230, 110, 170, 80, 140, 60].map((h, i) =>
  `<rect x="${150 + i * 42}" y="${300 - h / 2}" width="22" height="${h}" rx="11" fill="${i % 3 === 0 ? '#FF6B4A' : i % 3 === 1 ? '#2AA79F' : '#6366F1'}" opacity=".9"/>`).join('');
const nodes = [[250, 200], [400, 140], [560, 230], [330, 360], [500, 400]];
const links = [[0, 1], [1, 2], [0, 3], [3, 4], [2, 4], [1, 3]];
const graph = links.map(([a, b]) => `<line x1="${nodes[a][0]}" y1="${nodes[a][1]}" x2="${nodes[b][0]}" y2="${nodes[b][1]}" stroke="#fff" stroke-opacity=".3" stroke-width="3"/>`).join('') +
  nodes.map(([x, y], i) => `<circle cx="${x}" cy="${y}" r="${i === 1 ? 34 : 24}" fill="${['#6366F1', '#2AA79F', '#FF6B4A', '#F5A524', '#6366F1'][i]}"/>`).join('');

const covers = { meloforge: bars, researchhub: graph };
const svg = (art) => `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600"><defs>
<linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0E1330"/><stop offset="1" stop-color="#232A6B"/></linearGradient>
<pattern id="g" width="48" height="48" patternUnits="userSpaceOnUse"><path d="M48 0H0V48" fill="none" stroke="#fff" stroke-opacity=".05"/></pattern></defs>
<rect width="800" height="600" fill="url(#bg)"/><rect width="800" height="600" fill="url(#g)"/>${art}</svg>`;

(async () => {
  for (const [id, art] of Object.entries(covers)) {
    const out = path.join(outDir, `portfolio-${id}.webp`);
    await sharp(Buffer.from(svg(art))).webp({ quality: 74, effort: 6 }).toFile(out);
    console.log(id.padEnd(14), (fs.statSync(out).size / 1024).toFixed(1) + ' KB');
  }
})();
