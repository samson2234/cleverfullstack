// Phase 3: installable apps. "CleverStack Chat" (/messages, per-visitor manifest from api/portal) and
// "CleverStack CRM" (/admin, crm.webmanifest). One service worker (sw.js) registered only for those two scopes.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { call, cleanup, ADMIN } from './helpers.mjs';
import contact from '../api/contact.js';
import portal from '../api/portal.js';
import admin from '../api/admin.js';

after(cleanup);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
let n = 0; const ip = () => '62.0.' + Math.floor(++n / 200) + '.' + (n % 200);
const pngSize = (f) => { const b = fs.readFileSync(path.join(root, f)); assert.equal(b.toString('ascii', 1, 4), 'PNG', f + ' is a PNG'); return b.readUInt32BE(16) + 'x' + b.readUInt32BE(20); };
function checkManifest(m, scope) {
  assert.ok(m.name && m.short_name && m.short_name.length <= 12, 'name and a short home-screen name');
  assert.equal(m.display, 'standalone');
  assert.equal(m.scope, scope);
  assert.ok(m.start_url.startsWith(scope), 'start_url inside the scope');
  assert.ok(m.icons.some((i) => i.sizes === '192x192') && m.icons.some((i) => i.sizes === '512x512' && i.purpose === 'any') && m.icons.some((i) => i.purpose === 'maskable'), 'installable icon set');
  for (const i of m.icons) assert.equal(pngSize(i.src.replace(/^\//, '')), i.sizes, i.src);
}

test('chat app: the install file is built for the visitor, opens their chat, and never marks messages as seen', async () => {
  const r = await call(contact, { method: 'POST', ip: ip(), body: { chat: true, name: 'Ivy App', email: 'ivy@app.test', message: 'Can I get this on my phone?', page: '/' } });
  const token = r.body.chat.token;
  const inbox = await call(admin, { url: '/api/admin?view=inbox', headers: ADMIN, ip: ip() });
  const id = inbox.body.conversations[0].id;
  await call(admin, { method: 'POST', headers: ADMIN, ip: ip(), body: { action: 'msg_send', id, body: 'Yes! Tap Install.' } });
  const seen = async () => (await call(admin, { url: '/api/admin?view=thread&id=' + id, headers: ADMIN, ip: ip() })).body.seen;
  const before = await seen();

  const m = await call(portal, { url: '/api/portal?manifest=1&t=' + token, ip: ip() });
  assert.equal(m.code, 200);
  assert.match(m.headers['content-type'], /application\/manifest\+json/);
  const man = JSON.parse(m.body);
  checkManifest(man, '/messages');
  assert.equal(man.start_url, '/messages#c=' + token, 'the installed app opens this chat (token in the hash, never sent to the server)');
  assert.equal(man.id, '/messages', 'one app id, so reinstalling never makes a second icon');
  assert.equal(await seen(), before, 'fetching the install file does not mark the reply as seen');

  assert.equal((await call(portal, { url: '/api/portal?manifest=1&t=' + 'x'.repeat(43), ip: ip() })).code, 404, 'no install file for a wrong link');
});

test('CRM app: crm.webmanifest is valid and opens the Inbox', () => {
  const m = JSON.parse(read('crm.webmanifest'));
  checkManifest(m, '/admin');
  assert.equal(m.start_url, '/admin#inbox');
  for (const k of ['chat', 'crm']) assert.equal(pngSize('images/app/' + k + '-apple-180.png'), '180x180');
});

test('pages: both apps are linked with icons, theme colour and the install helper (versioned)', () => {
  const msg = read('messages.html'), adm = read('admin.html');
  assert.match(msg, /<link rel="manifest" id="ptManifest">/);
  assert.match(msg, /ptManifest'\)\.href = '\/api\/portal\?manifest=1&t=' \+ T/);
  assert.match(adm, /<link rel="manifest" href="\/crm\.webmanifest">/);
  for (const [html, icon, scope] of [[msg, 'chat', '/messages'], [adm, 'crm', '/admin']]) {
    assert.match(html, new RegExp('<link rel="apple-touch-icon" href="/images/app/' + icon + '-apple-180\\.png">'));
    assert.match(html, /<meta name="theme-color" content="#[0-9a-fA-F]{6}">/);
    assert.match(html, new RegExp('<script src="app-install\\.js\\?v=[0-9a-f]{8}" defer data-scope="' + scope + '"'));
  }
  // the rest of the website is not an app and gets no service worker
  for (const f of ['index.html', 'contact.html', 'services.html']) {
    assert.doesNotMatch(read(f), /rel="manifest"|app-install\.js|serviceWorker/, f);
  }
});

test('service worker: only page loads of /messages and /admin, no caching of private data, never site-wide', () => {
  const sw = read('sw.js'), inst = read('app-install.js');
  assert.match(sw, /req\.mode !== 'navigate'/);
  assert.match(sw, /\^\\\/\(messages\|admin\)/);
  assert.doesNotMatch(sw, /cache\.put|cache\.add|caches\.open/, 'nothing is stored in the cache');
  assert.match(inst, /register\('\/sw\.js', \{ scope: scope \}\)/);
  assert.doesNotMatch(read('messages.html') + read('admin.html'), /data-scope="\/"/);
});

test('security headers allow the app files (manifest-src, worker-src) and sw.js is always re-checked', () => {
  const v = JSON.parse(read('vercel.json'));
  const csp = v.headers.find((h) => h.source === '/(.*)').headers.find((h) => h.key === 'Content-Security-Policy').value;
  assert.match(csp, /manifest-src 'self'/);
  assert.match(csp, /worker-src 'self'/);
  const sw = v.headers.find((h) => h.source === '/sw.js');
  assert.ok(sw && sw.headers.some((h) => h.key === 'Cache-Control' && /no-cache/.test(h.value)));
});
