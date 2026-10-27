// NFR security: staff accounts — roles enforced on the server, sessions revocable, owner password still works.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { call, cleanup, ADMIN, sessionToken } from './helpers.mjs';
import admin from '../api/admin.js';
import { getClient } from '../lib/db.js';

after(cleanup);
let ipN = 0;
const ip = () => '40.0.' + Math.floor(++ipN / 200) + '.' + (ipN % 200);
const asOwner = (body) => call(admin, { method: 'POST', body, headers: ADMIN, ip: ip() });
const as = (token, opts) => call(admin, { ...opts, headers: { authorization: 'Bearer ' + token }, ip: ip() });
const login = async (email, password) => { const r = await call(admin, { method: 'POST', body: { action: 'login', email, password }, ip: ip() }); r.token = sessionToken(r); return r; };

let salesPw, viewerPw, salesId;
test('owner creates team members; passwords are generated, shown once and never stored in plain text', async () => {
  const s = await asOwner({ action: 'team_create', email: 'Sam@CleverStack.test', name: 'Sam', role: 'sales' });
  assert.equal(s.code, 200);
  salesPw = s.body.password;
  assert.ok(salesPw.length >= 10);
  assert.equal(typeof s.body.emailed, 'boolean', 'reports whether the invite email went out');
  viewerPw = (await asOwner({ action: 'team_create', email: 'vee@cleverstack.test', name: 'Vee', role: 'viewer' })).body.password;
  assert.equal((await asOwner({ action: 'team_create', email: 'sam@cleverstack.test', name: 'Dup', role: 'sales' })).code, 409);
  assert.equal((await asOwner({ action: 'team_create', email: 'x@cleverstack.test', role: 'owner' })).code, 400, 'nobody can be made owner');
  const rows = (await getClient().execute('SELECT * FROM staff_users')).rows;
  assert.ok(!JSON.stringify(rows).includes(salesPw) && !JSON.stringify(rows).includes(viewerPw));
  salesId = Number(rows.find((r) => r.email === 'sam@cleverstack.test').id);
});

test('login: right password works (email is case-insensitive), wrong one does not', async () => {
  assert.equal((await login('sam@cleverstack.test', 'wrong-password-1')).code, 401);
  assert.equal((await login('nobody@cleverstack.test', salesPw)).code, 401);
  const ok = await login('SAM@cleverstack.test', salesPw);
  assert.equal(ok.code, 200);
  assert.match(ok.token, /^st_/);
  assert.equal(ok.body.user.role, 'sales');
});

test('sales: can work leads but cannot delete, export, mass-send or manage the team', async () => {
  const t = (await login('sam@cleverstack.test', salesPw)).token;
  assert.equal((await as(t, { url: '/api/admin?view=me' })).body.user.role, 'sales');
  assert.equal((await as(t, { url: '/api/admin?limit=5' })).code, 200);
  assert.equal((await as(t, { url: '/api/admin?view=analytics&range=week' })).code, 200);
  await getClient().execute("INSERT INTO submissions (name, email, message) VALUES ('Lead', 'l@x.test', 'hi')");
  assert.equal((await as(t, { method: 'POST', body: { action: 'add_note', id: 1, note: 'called' } })).code, 200);
  for (const action of ['delete', 'broadcast', 'campaign_send', 'contact_import', 'delete_subscriber', 'review_delete', 'team_list', 'team_create']) {
    assert.equal((await as(t, { method: 'POST', body: { action, id: 1 } })).code, 403, action);
  }
  assert.equal((await as(t, { url: '/api/admin?export=leads' })).code, 403);
});

test('viewer: read-only', async () => {
  const t = (await login('vee@cleverstack.test', viewerPw)).token;
  assert.equal((await as(t, { url: '/api/admin?limit=5' })).code, 200);
  assert.equal((await as(t, { method: 'POST', body: { action: 'add_note', id: 1, note: 'x' } })).code, 403);
  assert.equal((await as(t, { method: 'POST', body: { action: 'set_status', id: 1, status: 'won' } })).code, 403);
});

test('sessions end on logout, password reset and deactivation; staff can change their own password', async () => {
  let t = (await login('sam@cleverstack.test', salesPw)).token;
  assert.equal((await as(t, { method: 'POST', body: { action: 'change_password', current: salesPw, next: 'short' } })).code, 400);
  assert.equal((await as(t, { method: 'POST', body: { action: 'change_password', current: 'wrong', next: 'NewPassword123' } })).code, 400);
  assert.equal((await as(t, { method: 'POST', body: { action: 'change_password', current: salesPw, next: 'NewPassword123' } })).code, 200);
  assert.equal((await login('sam@cleverstack.test', 'NewPassword123')).code, 200);
  await as(t, { method: 'POST', body: { action: 'logout' } });
  assert.equal((await as(t, { url: '/api/admin?view=me' })).code, 401, 'logged-out token is dead');

  t = (await login('sam@cleverstack.test', 'NewPassword123')).token;
  const reset = await asOwner({ action: 'team_reset_password', id: salesId });
  assert.equal((await as(t, { url: '/api/admin?view=me' })).code, 401, 'reset revokes sessions');
  assert.equal(typeof reset.body.emailed, 'boolean');
  t = (await login('sam@cleverstack.test', reset.body.password)).token;
  await asOwner({ action: 'team_update', id: salesId, active: false });
  assert.equal((await as(t, { url: '/api/admin?view=me' })).code, 401, 'deactivation revokes sessions');
  assert.equal((await login('sam@cleverstack.test', reset.body.password)).code, 401, 'deactivated cannot log in');
});

test('the owner password keeps full access; forged or garbage tokens are refused', async () => {
  assert.equal((await call(admin, { url: '/api/admin?view=me', headers: ADMIN, ip: ip() })).body.user.role, 'owner');
  assert.equal((await as('st_' + 'A'.repeat(43), { url: '/api/admin?view=me' })).code, 401);
  assert.equal((await as('not-the-password', { url: '/api/admin?view=me' })).code, 401);
  assert.equal((await asOwner({ action: 'team_list' })).body.team.length, 2);
});
