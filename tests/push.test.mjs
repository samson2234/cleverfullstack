// Phase 4: phone notifications (Web Push). The push network call is replaced (setPushSender), nothing leaves the machine.
//   visitor subscribes (portal push_sub) -> team reply pushes to the visitor
//   staff device subscribes (admin push_sub) -> client message / new website chat pushes to staff
//   expired subscriptions (410) are removed; no VAPID keys = everything off, nothing breaks
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import webpush from 'web-push';
import { call, cleanup, ADMIN } from './helpers.mjs';
import contact from '../api/contact.js';
import portal from '../api/portal.js';
import admin from '../api/admin.js';
import { setPushSender } from '../lib/push.js';
import { can } from '../lib/staff.js';

after(cleanup);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
let n = 0; const ip = () => '63.0.' + Math.floor(++n / 200) + '.' + (n % 200);
const sub = (name) => ({ endpoint: 'https://push.example.test/send/' + name + '-' + 'x'.repeat(20), keys: { p256dh: 'B' + 'a'.repeat(86), auth: 'c'.repeat(22) } });
let sent = [], fail = null;
setPushSender(async (s, payload) => { if (fail) throw fail; sent.push({ endpoint: s.endpoint, msg: JSON.parse(payload) }); });

let token, convId;
test('without VAPID keys: no key is offered, subscribing is refused, and messaging still works', async () => {
  delete process.env.VAPID_PUBLIC_KEY; delete process.env.VAPID_PRIVATE_KEY;
  assert.equal((await call(portal, { url: '/api/portal?push_key=1', ip: ip() })).body.key, null);
  assert.equal((await call(admin, { url: '/api/admin?view=push_key', headers: ADMIN, ip: ip() })).body.key, null);
  const r = await call(contact, { method: 'POST', ip: ip(), body: { chat: true, name: 'Pia Push', email: 'pia@push.test', message: 'Do you build booking apps?', page: '/' } });
  token = r.body.chat.token;
  convId = (await call(admin, { url: '/api/admin?view=inbox', headers: ADMIN, ip: ip() })).body.conversations[0].id;
  assert.equal((await call(portal, { method: 'POST', ip: ip(), body: { t: token, op: 'push_sub', sub: sub('pia') } })).code, 503);
  assert.equal((await call(admin, { method: 'POST', headers: ADMIN, ip: ip(), body: { action: 'msg_send', id: convId, body: 'Yes we do!' } })).code, 200);
  assert.equal(sent.length, 0);
});

test('with keys: the visitor subscribes and gets the team reply on their phone', async () => {
  const k = webpush.generateVAPIDKeys();
  process.env.VAPID_PUBLIC_KEY = k.publicKey; process.env.VAPID_PRIVATE_KEY = k.privateKey;
  assert.equal((await call(portal, { url: '/api/portal?push_key=1', ip: ip() })).body.key, k.publicKey);
  assert.equal((await call(portal, { method: 'POST', ip: ip(), body: { t: token, op: 'push_sub', sub: { endpoint: 'http://bad', keys: {} } } })).code, 400, 'bad subscription refused');
  assert.equal((await call(portal, { method: 'POST', ip: ip(), body: { t: 'x'.repeat(43), op: 'push_sub', sub: sub('nobody') } })).code, 404, 'wrong link refused');
  assert.equal((await call(portal, { method: 'POST', ip: ip(), body: { t: token, op: 'push_sub', sub: sub('pia') } })).code, 200);
  sent = [];
  await call(admin, { method: 'POST', headers: ADMIN, ip: ip(), body: { action: 'msg_send', id: convId, body: 'Great question! Here is how our booking apps work, with online payments and reminders included.' } });
  assert.equal(sent.length, 1);
  assert.match(sent[0].endpoint, /pia-/);
  assert.match(sent[0].msg.title, /replied · CleverStack$/);
  assert.ok(sent[0].msg.body.length <= 120 && sent[0].msg.body.startsWith('Great question!'), 'short preview');
  assert.equal(sent[0].msg.url, '/messages');
});

test('staff device subscribes in the CRM and is pinged for client messages and new website chats', async () => {
  assert.equal((await call(admin, { method: 'POST', headers: ADMIN, ip: ip(), body: { action: 'push_sub', sub: sub('owner-phone') } })).code, 200);
  sent = [];
  await call(portal, { method: 'POST', ip: ip(), body: { t: token, body: 'Thanks! Can we talk tomorrow?' } });
  assert.deepEqual(sent.map((s) => s.endpoint.includes('owner-phone')), [true], 'only the staff device, not the visitor who wrote it');
  assert.equal(sent[0].msg.title, '💬 Pia Push');
  assert.equal(sent[0].msg.url, '/admin#inbox-' + convId);
  sent = [];
  await call(contact, { method: 'POST', ip: ip(), body: { chat: true, name: 'Noah New', email: 'noah@new.test', message: 'Hi, I need a shop.', page: '/' } });
  assert.equal(sent.length, 1);
  assert.equal(sent[0].msg.title, '💬 New website chat: Noah New');
  sent = [];
  await call(contact, { method: 'POST', ip: ip(), body: { chat: true, name: 'Sam Seller', email: 'sam@seo.test', message: 'Hi, we provide high quality guest posts on DA 50+ sites. Are you interested?', page: '/' } });
  assert.equal(sent.length, 0, 'vendor pitches never ping your phone');
});

test('a subscription the push service says is gone (410) is deleted; a visitor can only remove their own', async () => {
  fail = Object.assign(new Error('Gone'), { statusCode: 410 });
  await call(admin, { method: 'POST', headers: ADMIN, ip: ip(), body: { action: 'msg_send', id: convId, body: 'Tomorrow at 3pm works.' } });
  fail = null; sent = [];
  await call(admin, { method: 'POST', headers: ADMIN, ip: ip(), body: { action: 'msg_send', id: convId, body: 'See you then.' } });
  assert.equal(sent.length, 0, 'expired visitor subscription removed');
  // the visitor cannot remove the owner's device
  await call(portal, { method: 'POST', ip: ip(), body: { t: token, op: 'push_unsub', sub: sub('owner-phone') } });
  sent = [];
  await call(portal, { method: 'POST', ip: ip(), body: { t: token, body: 'Perfect.' } });
  assert.equal(sent.length, 1, 'owner device still subscribed');
  await call(admin, { method: 'POST', headers: ADMIN, ip: ip(), body: { action: 'push_unsub', sub: sub('owner-phone') } });
  sent = [];
  await call(portal, { method: 'POST', ip: ip(), body: { t: token, body: 'Bye!' } });
  assert.equal(sent.length, 0, 'turned off from the CRM');
});

test('a push failure never breaks sending a message', async () => {
  await call(admin, { method: 'POST', headers: ADMIN, ip: ip(), body: { action: 'push_sub', sub: sub('flaky') } });
  fail = new Error('network down');
  const r = await call(portal, { method: 'POST', ip: ip(), body: { t: token, body: 'Still there?' } });
  fail = null;
  assert.equal(r.code, 200);
});

test('every role can turn notifications on for their own device; viewers still cannot send messages', () => {
  for (const role of ['owner', 'admin', 'sales', 'viewer']) for (const a of ['push_sub', 'push_unsub']) assert.ok(can(role, { kind: 'action', action: a }), role + ' ' + a);
  assert.ok(!can('viewer', { kind: 'action', action: 'msg_send' }));
});

test('front end: service worker shows and opens notifications; pages load the push helper', () => {
  const sw = read('sw.js');
  assert.match(sw, /addEventListener\('push'/);
  assert.match(sw, /showNotification\(/);
  assert.match(sw, /addEventListener\('notificationclick'/);
  assert.match(read('messages.html'), /<script src="push-client\.js\?v=[0-9a-f]{8}"><\/script>/);
  assert.match(read('admin.html'), /<script src="push-client\.js\?v=[0-9a-f]{8}" defer><\/script>/);
  assert.match(read('index.html'), /data-push-src="push-client\.js\?v=[0-9a-f]{8}"/);
  assert.doesNotMatch(read('push-client.js'), /register\('\/sw\.js'\)/, 'never registered for the whole site');
  assert.doesNotMatch(read('lib/push.js') + read('push-client.js'), /BEGIN|PRIVATE KEY|VAPID_PRIVATE_KEY\s*=\s*['"]/, 'no keys in the code');
});
