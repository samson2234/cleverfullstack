// NFR: security — CRM sessions in an HttpOnly cookie (owner included; the admin password never stays in the
// browser), CSRF origin check, sign-in rate limit, no wildcard CORS, input type checks, no personal data in logs.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { call, cleanup, ADMIN, sessionToken } from './helpers.mjs';
import admin from '../api/admin.js';
import contact from '../api/contact.js';
import subscribe from '../api/subscribe.js';

after(cleanup);
let n = 0; const ip = () => '71.0.' + Math.floor(++n / 200) + '.' + (n % 200);
const cookieFor = (t) => ({ cookie: 'cs_admin=' + encodeURIComponent(t) });
const ownerLogin = (password, extra = {}) => call(admin, { method: 'POST', ip: ip(), body: { action: 'login', email: '', password }, ...extra });

test('owner signs in once; gets an HttpOnly, Secure, SameSite=Strict cookie and no token or password in the response', async () => {
  const r = await ownerLogin('test-admin-password');
  assert.equal(r.code, 200);
  assert.equal(r.body.user.role, 'owner');
  assert.equal(r.body.token, undefined, 'token is not readable by page scripts');
  const c = r.headers['set-cookie'];
  assert.match(c, /^cs_admin=st_/);
  for (const flag of ['HttpOnly', 'Secure', 'SameSite=Strict', 'Path=/api/admin']) assert.ok(c.includes(flag), flag);
  assert.ok(!JSON.stringify(r.body).includes('test-admin-password'));

  const me = await call(admin, { url: '/api/admin?view=me', ip: ip(), headers: cookieFor(sessionToken(r)) });
  assert.equal(me.code, 200);
  assert.equal(me.body.user.role, 'owner');
  assert.equal((await ownerLogin('wrong-password')).code, 401);
});

test('changing ADMIN_PASSWORD signs every owner session out', async () => {
  const t = sessionToken(await ownerLogin('test-admin-password'));
  const old = process.env.ADMIN_PASSWORD;
  process.env.ADMIN_PASSWORD = 'a-brand-new-password-123';
  try {
    const r = await call(admin, { url: '/api/admin?view=me', ip: ip(), headers: cookieFor(t) });
    assert.equal(r.code, 401);
    assert.match(r.headers['set-cookie'], /Max-Age=0/, 'stale cookie is cleared');
  } finally { process.env.ADMIN_PASSWORD = old; }
  assert.equal((await call(admin, { url: '/api/admin?view=me', ip: ip(), headers: cookieFor(t) })).code, 200);
});

test('logout ends the session on the server and clears the cookie', async () => {
  const t = sessionToken(await ownerLogin('test-admin-password'));
  const out = await call(admin, { method: 'POST', ip: ip(), headers: cookieFor(t), body: { action: 'logout' } });
  assert.equal(out.code, 200);
  assert.match(out.headers['set-cookie'], /cs_admin=;.*Max-Age=0/);
  assert.equal((await call(admin, { url: '/api/admin?view=me', ip: ip(), headers: cookieFor(t) })).code, 401);
});

test('cookie sessions refuse writes from other websites (CSRF), allow our own pages', async () => {
  const t = sessionToken(await ownerLogin('test-admin-password'));
  const body = { action: 'team_list' };
  const evil = await call(admin, { method: 'POST', ip: ip(), headers: { ...cookieFor(t), host: 'cleverstack.dev', origin: 'https://evil.example' }, body });
  assert.equal(evil.code, 403);
  const fetchMeta = await call(admin, { method: 'POST', ip: ip(), headers: { ...cookieFor(t), 'sec-fetch-site': 'cross-site' }, body });
  assert.equal(fetchMeta.code, 403);
  const ours = await call(admin, { method: 'POST', ip: ip(), headers: { ...cookieFor(t), host: 'cleverstack.dev', origin: 'https://cleverstack.dev', 'sec-fetch-site': 'same-origin' }, body });
  assert.equal(ours.code, 200);
  const login = await ownerLogin('test-admin-password', { headers: { host: 'cleverstack.dev', origin: 'https://evil.example' } });
  assert.equal(login.code, 403, 'login cannot be driven from another site');
});

test('visiting the CRM signed out (or with an expired cookie) never locks the visitor out', async () => {
  const addr = '72.9.9.9';
  for (let i = 0; i < 8; i++) assert.equal((await call(admin, { url: '/api/admin?view=me', ip: addr })).code, 401);
  for (let i = 0; i < 8; i++) assert.equal((await call(admin, { url: '/api/admin?view=me', ip: addr, headers: cookieFor('st_' + 'x'.repeat(43)) })).code, 401);
  assert.equal((await call(admin, { url: '/api/admin?view=me', ip: addr, headers: ADMIN })).code, 200);
});

test('sign-in attempts are rate limited per IP', async () => {
  const addr = '73.1.1.1';
  const codes = [];
  for (let i = 0; i < 12; i++) codes.push((await call(admin, { method: 'POST', ip: addr, body: { action: 'login', email: 'x' + i + '@nobody.test', password: 'guess-' + i } })).code);
  assert.ok(codes.includes(429), 'blocked after repeated failures: ' + codes.join(','));
});

test('no wildcard CORS on the APIs; responses from the admin API are not cached', async () => {
  const a = await call(admin, { url: '/api/admin?view=me', ip: ip(), headers: ADMIN });
  assert.equal(a.headers['access-control-allow-origin'], undefined);
  assert.equal(a.headers['cache-control'], 'no-store');
  const pre = await call(admin, { method: 'OPTIONS', ip: ip() });
  assert.equal(pre.headers['access-control-allow-origin'], undefined);
  const c = await call(contact, { method: 'POST', ip: ip(), body: { name: 'A', email: 'a@b.co', message: 'hi there' } });
  assert.equal(c.headers['access-control-allow-origin'], undefined);
});

test('forms reject non-text values and over-long fields cleanly (no crash), and never log personal data', async () => {
  const logs = [];
  const orig = { log: console.log, error: console.error };
  console.log = (...a) => logs.push(a.join(' ')); console.error = (...a) => logs.push(a.join(' '));
  try {
    const obj = await call(contact, { method: 'POST', ip: ip(), body: { name: { $gt: '' }, email: ['x@y.co'], message: 12345 } });
    assert.equal(obj.code, 400);
    const long = await call(contact, { method: 'POST', ip: ip(), body: { name: 'Al', email: 'al@b.co', phone: '1'.repeat(80), message: 'hello' } });
    assert.equal(long.code, 400);
    const sub = await call(subscribe, { method: 'POST', ip: ip(), body: { email: { a: 1 } } });
    assert.equal(sub.code, 400);
    const ok = await call(contact, { method: 'POST', ip: ip(), body: { name: 'Private Person', email: 'private.person@example.test', phone: '+44 7700 900123', message: 'secret project details' } });
    assert.equal(ok.code, 200);
  } finally { console.log = orig.log; console.error = orig.error; }
  const all = logs.join('\n');
  for (const pii of ['private.person@example.test', '+44 7700 900123', 'secret project details']) assert.ok(!all.includes(pii), 'logged: ' + pii);
});
