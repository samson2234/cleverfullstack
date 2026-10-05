// NFR security/availability: the Content-Security-Policy must be well-formed.
// A single missing space once glued two hosts together and silently blocked the blog images and the chat widget.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cfg = JSON.parse(fs.readFileSync(path.join(root, 'vercel.json'), 'utf8'));
const csp = cfg.headers.flatMap((h) => h.headers).find((h) => h.key === 'Content-Security-Policy').value;
const directives = Object.fromEntries(csp.split(';').map((d) => d.trim()).filter(Boolean).map((d) => { const [name, ...src] = d.split(/\s+/); return [name, src]; }));

test('no source expression is two hosts glued together (missing space)', () => {
  for (const [name, sources] of Object.entries(directives)) {
    for (const s of sources) assert.ok(!/[a-z0-9*]https?:\/\//i.test(s), `${name}: "${s}" looks like two sources without a space`);
  }
});

test('every source is a keyword, scheme or a single valid host', () => {
  const ok = /^('self'|'none'|'unsafe-inline'|'unsafe-eval'|data:|blob:|https:|wss:|https:\/\/(\*\.)?[a-z0-9.-]+\.[a-z]{2,}|wss:\/\/(\*\.)?[a-z0-9.-]+\.[a-z]{2,})$/i;
  for (const [name, sources] of Object.entries(directives)) {
    if (name === 'upgrade-insecure-requests') continue;
    for (const s of sources) assert.match(s, ok, `${name}: invalid source "${s}"`);
  }
});

test('the third parties the site actually uses are allowed', () => {
  assert.ok(directives['script-src'].includes('https://embed.tawk.to'), 'chat widget script');
  assert.ok(directives['frame-src'].includes('https://*.tawk.to'), 'chat widget frame');
  assert.ok(directives['img-src'].includes('https://images.unsplash.com'), 'blog thumbnails');
  assert.ok(directives['script-src'].includes('https://www.googletagmanager.com'), 'analytics');
  assert.ok(directives['script-src'].includes('https://www.googleadservices.com'), 'google ads');
});
