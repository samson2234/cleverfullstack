// NFR security: the owner can change their password in the CRM (no Vercel trip), sign-outs follow, the old password
// stops working everywhere (sign-in and API Bearer), and "forgot password" links are single-use and expire.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { call, cleanup, sessionToken, mockFetch } from './helpers.mjs';
import admin from '../api/admin.js';
import { getClient } from '../lib/db.js';
import { ownerEmail } from '../lib/email.js';

after(cleanup);
let ipN = 0;
const ip = () => '41.0.' + Math.floor(++ipN / 200) + '.' + (ipN % 200);
const post = (body, token) => call(admin, { method: 'POST', body, headers: token ? { authorization: 'Bearer ' + token } : {}, ip: ip() });
const ownerLogin = async (password) => { const r = await post({ action: 'login', password }); r.token = sessionToken(r); return r; };
const me = (token) => call(admin, { url: '/api/admin?view=me', headers: { authorization: 'Bearer ' + token }, ip: ip() });
const ENV_PW = 'test-admin-password';
const NEW_PW = 'Better-owner-pass-2026';

test('owner changes the password: needs the current one, a strong new one, and signs other devices out', async () => {
  const laptop = (await ownerLogin(ENV_PW)).token;
  const phone = (await ownerLogin(ENV_PW)).token;
  assert.equal((await post({ action: 'change_password', current: 'wrong', next: NEW_PW }, laptop)).code, 400);
  assert.equal((await post({ action: 'change_password', current: ENV_PW, next: 'short1' }, laptop)).code, 400, 'under 12 characters');
  assert.equal((await post({ action: 'change_password', current: ENV_PW, next: 'nodigitsatallhere' }, laptop)).code, 400, 'needs a number');
  const ok = await post({ action: 'change_password', current: ENV_PW, next: NEW_PW }, laptop);
  assert.equal(ok.code, 200);
  const fresh = sessionToken(ok);
  assert.match(fresh, /^st_/, 'this browser gets a new session');
  assert.equal((await me(fresh)).code, 200);
  assert.equal((await me(laptop)).code, 401, 'old sessions end');
  assert.equal((await me(phone)).code, 401, 'other devices are signed out');
  const row = (await getClient().execute('SELECT * FROM owner_auth')).rows[0];
  assert.ok(row && !JSON.stringify(row).includes(NEW_PW), 'stored hashed only');
});

test('after the change: old Vercel password fails (sign-in and API Bearer), new one works', async () => {
  assert.equal((await ownerLogin(ENV_PW)).code, 401);
  assert.equal((await me(ENV_PW)).code, 401, 'raw ADMIN_PASSWORD Bearer no longer works');
  const r = await ownerLogin(NEW_PW);
  assert.equal(r.code, 200);
  assert.equal((await me(r.token)).body.user.role, 'owner');
  assert.equal((await me(NEW_PW)).code, 200, 'API scripts use the new password');
});

test('forgot password: emails a one-time link that expires, and sets a new password', async () => {
  // without email configured it says so instead of pretending
  assert.equal((await post({ action: 'owner_reset_request' })).code, 503);
  process.env.RESEND_API_KEY = 're_test';
  const sent = [];
  const restore = mockFetch(async (url, o) => { sent.push({ url: String(url), body: JSON.parse(o.body) }); return new Response(JSON.stringify({ id: 'e1' }), { status: 200 }); });
  try {
    const r = await post({ action: 'owner_reset_request' });
    assert.equal(r.code, 200);
    assert.ok(!r.body.message.includes(ownerEmail()), 'address is masked');
    const html = sent.find((s) => /resend/.test(s.url)).body.html;
    const token = (html.match(/#reset=([A-Za-z0-9_-]+)/) || [])[1];
    assert.ok(token, 'link in the email');
    assert.equal((await post({ action: 'owner_reset_confirm', token: 'x'.repeat(40), next: 'Another-good-pass-77' })).code, 400, 'unknown token');
    assert.equal((await post({ action: 'owner_reset_confirm', token, next: 'weak' })).code, 400, 'still needs a strong password');
    const ok = await post({ action: 'owner_reset_confirm', token, next: 'Another-good-pass-77' });
    assert.equal(ok.code, 200);
    assert.equal((await me(sessionToken(ok))).code, 200, 'signed in after reset');
    assert.equal((await post({ action: 'owner_reset_confirm', token, next: 'Third-good-pass-88' })).code, 400, 'single use');
    assert.equal((await ownerLogin(NEW_PW)).code, 401);
    assert.equal((await ownerLogin('Another-good-pass-77')).code, 200);
    // expired links do not work
    await post({ action: 'owner_reset_request' });
    const t2 = (sent.filter((s) => /resend/.test(s.url)).pop().body.html.match(/#reset=([A-Za-z0-9_-]+)/) || [])[1];
    await getClient().execute('UPDATE owner_resets SET expires_at = 1');
    assert.equal((await post({ action: 'owner_reset_confirm', token: t2, next: 'Fourth-good-pass-99' })).code, 400, 'expired');
  } finally { restore(); delete process.env.RESEND_API_KEY; }
});

test('recovery: changing ADMIN_PASSWORD in Vercel makes the new Vercel value win', async () => {
  process.env.ADMIN_PASSWORD = 'rotated-in-vercel-123';
  try {
    assert.equal((await ownerLogin('Another-good-pass-77')).code, 401);
    assert.equal((await ownerLogin('rotated-in-vercel-123')).code, 200);
  } finally { process.env.ADMIN_PASSWORD = ENV_PW; }
});
