#!/usr/bin/env node
// scripts/add-chat-widget.js — loads the website chat (chat-widget.js) on every page that has a chat link
// ([data-chat-open]), just before </body>. Idempotent: an existing tag is replaced, so rerunning keeps it current.
// The blog, landing and work builders copy pages from donors that already carry it; rerun this after them anyway.
// Then run `npm run assets` so the ?v= hashes (including the data-ui-* ones) are refreshed.
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const tag = (pre) => '<script src="' + pre + 'chat-widget.js" defer data-ui-src="' + pre + 'chat-ui.js" data-ui-href="' + pre + 'chat-ui.css" data-css-href="' + pre + 'chat-widget.css"></script>';
const OLD = /<script src="(?:\.\.\/)?chat-widget\.js[^"]*"[^>]*><\/script>\n?/g;

let added = 0, kept = 0;
for (const d of ['', 'blog', 'work']) for (const f of fs.readdirSync(path.join(ROOT, d))) {
  if (!f.endsWith('.html')) continue;
  const file = path.join(ROOT, d, f), s = fs.readFileSync(file, 'utf8');
  if (!s.includes('data-chat-open')) continue;
  if (!s.includes('</body>')) throw new Error(path.join(d, f) + ': no </body>');
  const clean = s.replace(OLD, '');
  const out = clean.replace(/<\/body>(?![\s\S]*<\/body>)/, () => tag(d ? '../' : '') + '\n</body>');
  if (out.replace(/\?v=[0-9a-f]+/g, '') === s.replace(/\?v=[0-9a-f]+/g, '')) { kept++; continue; }
  fs.writeFileSync(file, out);
  added++;
}
console.log('chat widget: ' + added + ' page(s) updated, ' + kept + ' already current');
