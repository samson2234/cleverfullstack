// FR: verified client reviews (invite links, moderation, public listing)
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { call, cleanup, ADMIN } from './helpers.mjs';
import reviews from '../api/reviews.js';
import admin from '../api/admin.js';
import { getClient, getValidInvite } from '../lib/db.js';

after(cleanup);
const post = (b) => call(admin, { method: 'POST', body: b, headers: ADMIN });
const list = () => call(reviews, { url: '/api/reviews' });
let ipN = 0;
const freshIp = () => '20.0.0.' + (++ipN);

test('public list starts empty', async () => {
  const r = await list();
  assert.equal(r.code, 200);
  assert.equal(r.body.count, 0);
});

test('invalid review is rejected', async () => {
  const r = await call(reviews, { method: 'POST', ip: freshIp(), body: { name: 'A', rating: 9, body: 'x' } });
  assert.equal(r.code, 400);
});

test('honeypot submissions are swallowed and never stored', async () => {
  const r = await call(reviews, { method: 'POST', ip: freshIp(), body: { name: 'Bot Bot', rating: 5, body: 'spam spam spam spam spam', company_website: 'x' } });
  assert.equal(r.code, 200);
  assert.equal((await list()).body.count, 0);
});

test('open review waits as pending, then admin publishes it (unverified)', async () => {
  const r = await call(reviews, { method: 'POST', ip: freshIp(), body: { name: 'Pat Open', rating: 4, body: 'Good work overall, would hire again.' } });
  assert.equal(r.body.published, false);
  assert.equal((await list()).body.count, 0, 'pending must be hidden');
  const a = await call(admin, { url: '/api/admin?view=reviews', headers: ADMIN });
  assert.equal(a.body.pending, 1);
  await post({ action: 'review_status', id: a.body.reviews[0].id, status: 'approved' });
  const pub = await list();
  assert.equal(pub.body.count, 1);
  assert.equal(pub.body.reviews[0].verified, 0);
});

test('admin endpoints require authentication', async () => {
  assert.equal((await call(admin, { url: '/api/admin?view=reviews' })).code, 401);
  assert.equal((await call(admin, { method: 'POST', body: { action: 'review_delete', id: 1 } })).code, 401);
});

test('invite flow: one-time link, verified review publishes immediately, link cannot be reused', async () => {
  const inv = await post({ action: 'create_invite', client_name: 'Dana Client', client_email: 'dana@example.com', project: 'Shop redesign' });
  assert.match(inv.body.link, /review\.html\?t=/);
  const token = new URL(inv.body.link).searchParams.get('t');

  const check = await call(reviews, { url: '/api/reviews?t=' + token, ip: freshIp() });
  assert.equal(check.body.valid, true);
  assert.equal(check.body.name, 'Dana');
  assert.equal((await call(reviews, { url: '/api/reviews?t=nope', ip: freshIp() })).code, 410);

  const ok = await call(reviews, { method: 'POST', ip: freshIp(), body: { token, name: 'Dana Client', rating: 5, body: 'Excellent communication and delivery.' } });
  assert.equal(ok.body.published, true);
  const again = await call(reviews, { method: 'POST', ip: freshIp(), body: { token, name: 'Dana', rating: 1, body: 'Trying to reuse the link twice.' } });
  assert.equal(again.code, 410);

  const pub = await list();
  assert.equal(pub.body.count, 2);
  assert.equal(pub.body.average, 4.5);
  assert.ok(pub.body.reviews.some((x) => x.verified === 1 && x.project === 'Shop redesign'));
});

test('raw invite tokens are never stored (only a sha256 hash)', async () => {
  const inv = await post({ action: 'create_invite', client_name: 'Hash Check' });
  const token = new URL(inv.body.link).searchParams.get('t');
  const rows = (await getClient().execute({ sql: 'SELECT token_hash FROM review_invites WHERE client_name = ?', args: ['Hash Check'] })).rows;
  assert.equal(rows.length, 1);
  assert.notEqual(rows[0].token_hash, token);
  assert.equal(rows[0].token_hash.length, 64);
});

test('expired invites are unusable', async () => {
  await getClient().execute("INSERT INTO review_invites (token_hash, client_name, expires_at) VALUES ('deadbeef', 'Old', datetime('now','-1 day'))");
  assert.equal(await getValidInvite('anything'), null);
});

test('reply, reject and delete work; rejected reviews leave the public page', async () => {
  const pub = (await list()).body.reviews[0];
  assert.equal((await post({ action: 'review_reply', id: pub.id, reply: 'Thank you!' })).code, 200);
  await post({ action: 'review_status', id: pub.id, status: 'rejected' });
  assert.ok(!(await list()).body.reviews.some((r) => r.id === pub.id));
  assert.equal((await post({ action: 'review_delete', id: pub.id })).code, 200);
});

test('NFR security: review submissions are rate limited per IP', async () => {
  let last;
  for (let i = 0; i < 6; i++) last = await call(reviews, { method: 'POST', ip: '99.9.9.9', body: { name: 'Rate Test', rating: 5, body: 'Rate limit probe number ' + i + ' ok' } });
  assert.equal(last.code, 429);
});
