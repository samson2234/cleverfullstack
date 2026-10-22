// FR: project conversations — enquiry starts a thread, client and team exchange messages, emails both ways,
// private links are required, rotated links stop working, roles and limits apply.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { call, cleanup, ADMIN, mockFetch } from './helpers.mjs';
import contact from '../api/contact.js';
import portal from '../api/portal.js';
import admin from '../api/admin.js';
import { getClient } from '../lib/db.js';

after(cleanup);
let n = 0; const ip = () => '60.0.' + Math.floor(++n / 200) + '.' + (n % 200);
const tokenFrom = (link) => new URL(link).searchParams.get('c');

let convId, token;
test('an enquiry creates a conversation with the client\'s message, and the confirmation email links to it', async () => {
  process.env.RESEND_API_KEY = 're_test';
  const sent = [];
  const restore = mockFetch(async (url, o) => { if (String(url).includes('resend')) sent.push(JSON.parse(o.body)); return new Response('{"id":"1"}', { status: 200 }); });
  try {
    const r = await call(contact, { method: 'POST', ip: ip(), body: { name: 'Clara Client', email: 'clara@client.test', message: 'We need a new booking site for our salon.', source: 'contact form' } });
    assert.equal(r.code, 200);
  } finally { restore(); delete process.env.RESEND_API_KEY; }
  const confirm = sent.find((m) => m.to.includes('clara@client.test'));
  assert.ok(confirm, 'confirmation email sent');
  const link = (confirm.html.match(/href="([^"]*\/messages\?c=[^"]+)"/) || [])[1];
  assert.ok(link, 'confirmation email has the conversation link');
  token = tokenFrom(link);
  const inbox = await call(admin, { url: '/api/admin?view=inbox', headers: ADMIN, ip: ip() });
  convId = inbox.body.conversations[0].id;
  assert.equal(inbox.body.unread, 1);
  assert.equal(inbox.body.conversations[0].subject, 'Your enquiry');
});

test('the client sees the thread with their link only; bad or missing links are refused', async () => {
  const r = await call(portal, { url: '/api/portal?t=' + token, ip: ip() });
  assert.equal(r.code, 200);
  assert.equal(r.body.messages.length, 1);
  assert.equal(r.body.messages[0].from, 'you');
  assert.ok(!('client_email' in r.body.conversation), 'portal does not expose internal fields');
  assert.equal((await call(portal, { url: '/api/portal?t=' + 'x'.repeat(43), ip: ip() })).code, 404);
  assert.equal((await call(portal, { url: '/api/portal', ip: ip() })).code, 404);
  assert.equal((await call(portal, { method: 'POST', body: { t: 'nope', body: 'hi' }, ip: ip() })).code, 404);
});

test('team reply -> client email with the same link; client reply -> owner email + unread in the inbox', async () => {
  process.env.RESEND_API_KEY = 're_test';
  const sent = [];
  const restore = mockFetch(async (url, o) => { if (String(url).includes('resend')) sent.push(JSON.parse(o.body)); return new Response('{"id":"1"}', { status: 200 }); });
  try {
    const t = await call(admin, { url: '/api/admin?view=thread&id=' + convId, headers: ADMIN, ip: ip() });
    assert.equal(t.body.conversation.unread_staff, 0, 'opening the thread marks it read');
    assert.equal(tokenFrom(t.body.link), token);
    const s = await call(admin, { method: 'POST', headers: ADMIN, ip: ip(), body: { action: 'msg_send', id: convId, body: 'Thanks Clara! What dates work for a call? <b>not html</b>' } });
    assert.equal(s.code, 200);
    assert.equal(s.body.emailed, true);
    const toClient = sent.find((m) => m.to.includes('clara@client.test'));
    assert.ok(toClient.html.includes('/messages?c=' + token));
    assert.ok(toClient.html.includes('&lt;b&gt;not html&lt;/b&gt;'), 'message is escaped in email');
    const p = await call(portal, { method: 'POST', ip: ip(), body: { t: token, body: 'Tuesday 3pm works.' } });
    assert.equal(p.code, 200);
    assert.ok(sent.some((m) => /New message from Clara Client/.test(m.subject)), 'owner notified');
  } finally { restore(); delete process.env.RESEND_API_KEY; }
  const thread = await call(portal, { url: '/api/portal?t=' + token, ip: ip() });
  assert.deepEqual(thread.body.messages.map((m) => m.from), ['you', 'staff', 'you']);
  assert.equal(thread.body.conversation.status, 'open', 'client reply re-opens');
  const after = await call(portal, { url: '/api/portal?t=' + token + '&after=' + thread.body.messages[1].id, ip: ip() });
  assert.equal(after.body.messages.length, 1, 'polling returns only newer messages');
  assert.equal((await call(admin, { url: '/api/admin?view=inbox&status=unread', headers: ADMIN, ip: ip() })).body.total, 1);
  const tl = await getClient().execute("SELECT COUNT(*) AS n FROM activities WHERE type = 'message'");
  assert.equal(Number(tl.rows[0].n), 2, 'replies appear on the client timeline (the enquiry itself is already the form entry)');
});

test('rotating the link kills the old one; empty and oversized messages are rejected', async () => {
  const r = await call(admin, { method: 'POST', headers: ADMIN, ip: ip(), body: { action: 'conv_rotate', id: convId } });
  const fresh = tokenFrom(r.body.link);
  assert.notEqual(fresh, token);
  assert.equal((await call(portal, { url: '/api/portal?t=' + token, ip: ip() })).code, 404);
  assert.equal((await call(portal, { url: '/api/portal?t=' + fresh, ip: ip() })).code, 200);
  assert.equal((await call(portal, { method: 'POST', ip: ip(), body: { t: fresh, body: '   ' } })).code, 400);
  const big = await call(portal, { method: 'POST', ip: ip(), body: { t: fresh, body: 'x'.repeat(9000) } });
  assert.equal(big.code, 200);
  const last = (await call(portal, { url: '/api/portal?t=' + fresh, ip: ip() })).body.messages.pop();
  assert.equal(last.body.length, 5000, 'long messages are capped');
});

test('team can start a conversation with anyone; viewers cannot send', async () => {
  const c = await call(admin, { method: 'POST', headers: ADMIN, ip: ip(), body: { action: 'conv_create', name: 'Past Client', email: 'past@client.test', subject: 'Checking in', body: 'Hi! How is the site doing?' } });
  assert.equal(c.code, 200);
  assert.equal((await call(admin, { method: 'POST', headers: ADMIN, ip: ip(), body: { action: 'conv_create', email: 'not-an-email', body: 'x' } })).code, 400);
  await call(admin, { method: 'POST', headers: ADMIN, ip: ip(), body: { action: 'conv_status', id: c.body.id, status: 'won' } });
  const won = await call(admin, { url: '/api/admin?view=inbox&status=won', headers: ADMIN, ip: ip() });
  assert.deepEqual(won.body.conversations.map((x) => x.client_email), ['past@client.test']);
  const v = await call(admin, { method: 'POST', headers: ADMIN, ip: ip(), body: { action: 'team_create', email: 'viewer@cleverstack.test', name: 'V', role: 'viewer' } });
  const login = await call(admin, { method: 'POST', ip: ip(), body: { action: 'login', email: 'viewer@cleverstack.test', password: v.body.password } });
  const blocked = await call(admin, { method: 'POST', ip: ip(), headers: { authorization: 'Bearer ' + login.body.token }, body: { action: 'msg_send', id: convId, body: 'hi' } });
  assert.equal(blocked.code, 403);
});
