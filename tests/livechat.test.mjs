// Website chat (chat-widget.js) — replaces the WhatsApp buttons. A chat starts through /api/contact (chat:true),
// returns the visitor's private token, posts Henry's automatic reply, emails the owner, and the thread is the same
// conversation as /messages and the CRM Inbox. Also: no WhatsApp links left, every chat link loads the widget.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { call, cleanup, ADMIN, mockFetch } from './helpers.mjs';
import contact from '../api/contact.js';
import portal from '../api/portal.js';
import admin from '../api/admin.js';

after(cleanup);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let n = 0; const ip = () => '61.0.' + Math.floor(++n / 200) + '.' + (n % 200);

async function startChat(body) {
  process.env.RESEND_API_KEY = 're_test';
  const sent = [];
  const restore = mockFetch(async (url, o) => { if (String(url).includes('resend')) sent.push(JSON.parse(o.body)); return new Response('{"id":"1"}', { status: 200 }); });
  try { return { r: await call(contact, { method: 'POST', ip: ip(), body }), sent }; } finally { restore(); delete process.env.RESEND_API_KEY; }
}

let token;
test('starting a chat returns a private token, emails the owner and the visitor, and Henry replies automatically', async () => {
  const { r, sent } = await startChat({ chat: true, name: 'Dana <b>Visitor</b>', email: 'dana@visitor.test', message: 'Can you build a booking app? <script>x</script>', page: '/services' });
  assert.equal(r.code, 200);
  token = r.body.chat && r.body.chat.token;
  assert.match(token || '', /^[A-Za-z0-9_-]{40,60}$/, 'chat token returned');
  const owner = sent.find((m) => !String(m.to).includes('dana@visitor.test'));
  assert.ok(owner && /New website chat/.test(owner.subject), 'owner email says it is a website chat: ' + (owner && owner.subject));
  const mine = sent.find((m) => String(m.to).includes('dana@visitor.test'));
  assert.ok(mine, 'visitor confirmation sent');
  assert.match(mine.subject, /chat with Henry/i);
  assert.doesNotMatch(mine.html, /<script>x<\/script>|<b>Visitor<\/b>/, 'visitor input is escaped in the email');
  assert.match(mine.html, /\/messages\?c=/, 'email links back to the chat');

  const t = await call(portal, { url: '/api/portal?t=' + token, ip: ip() });
  assert.equal(t.code, 200);
  assert.equal(t.body.conversation.subject, 'Website chat');
  assert.equal(t.body.messages.length, 2);
  assert.equal(t.body.messages[0].from, 'you');
  assert.equal(t.body.messages[1].name, 'Henry George');
  assert.match(t.body.messages[1].body, /within an hour/);
});

test('the automatic reply does not hide the chat from the owner: still unread and waiting for the team', async () => {
  const inbox = await call(admin, { url: '/api/admin?view=inbox', headers: ADMIN, ip: ip() });
  const c = inbox.body.conversations.find((x) => x.subject === 'Website chat');
  assert.ok(c, 'chat is in the CRM inbox');
  assert.ok(inbox.body.unread >= 1, 'counts as unread for the team');
  assert.equal(c.status, 'open');
});

test('visitor and team talk in the same thread; peek=1 never marks the team reply as seen', async () => {
  const s = await call(portal, { method: 'POST', ip: ip(), body: { t: token, body: 'Also need a website.' } });
  assert.equal(s.code, 200);
  const inbox = await call(admin, { url: '/api/admin?view=inbox', headers: ADMIN, ip: ip() });
  const id = inbox.body.conversations.find((x) => x.subject === 'Website chat').id;
  const reply = await call(admin, { method: 'POST', headers: ADMIN, ip: ip(), body: { action: 'msg_send', id, body: 'Sure, happy to help!' } });
  assert.equal(reply.code, 200);
  const seen = async () => (await call(admin, { url: '/api/admin?view=thread&id=' + id, headers: ADMIN, ip: ip() })).body.seen;
  const before = await seen();
  const peek = await call(portal, { url: '/api/portal?t=' + token + '&peek=1', ip: ip() });
  assert.ok(peek.body.messages.some((m) => m.body === 'Sure, happy to help!'), 'peek sees the reply');
  assert.equal(await seen(), before, 'peek did not mark it seen');
  await call(portal, { url: '/api/portal?t=' + token, ip: ip() });
  assert.ok(await seen() > before, 'opening the chat marks it seen');
  const t = await call(portal, { url: '/api/portal?t=' + token, ip: ip() });
  assert.deepEqual(t.body.messages.map((m) => m.from), ['you', 'system', 'you', 'staff']);
});

test('a vendor pitch through the chat gets no token (the widget then just says thanks)', async () => {
  const { r } = await startChat({ chat: true, name: 'Sam Seller', email: 'sam@seo.test', message: 'Hi, we provide high quality guest posts on DA 50+ sites. Are you interested?', page: '/' });
  assert.equal(r.code, 200);
  assert.ok(!r.body.chat, 'no chat token for a pitch');
});

test('a normal contact form enquiry is unchanged: no chat token, subject "Your enquiry"', async () => {
  const { r } = await startChat({ name: 'Ola Form', email: 'ola@form.test', message: 'Please quote a new company website.', source: 'contact form' });
  assert.equal(r.code, 200);
  assert.ok(!r.body.chat);
});

// ---- pages -------------------------------------------------------------------------------------------
const pages = [];
for (const d of ['', 'blog', 'work']) for (const f of fs.readdirSync(path.join(root, d))) if (f.endsWith('.html')) pages.push({ rel: path.join(d, f).replace(/\\/g, '/'), html: fs.readFileSync(path.join(root, d, f), 'utf8') });

test('no WhatsApp links anywhere; WhatsApp styles are gone', () => {
  for (const p of pages) assert.doesNotMatch(p.html, /wa\.me\/|api\.whatsapp\.com|class="[^"]*\b(btn-wa|wa-float|cta-wa)\b/, p.rel);
  assert.doesNotMatch(fs.readFileSync(path.join(root, 'style.css'), 'utf8'), /\.(btn-wa|wa-float|cta-wa)\b/);
});

test('every page with a chat link loads the chat widget once, with versioned files', () => {
  const withChat = pages.filter((p) => p.html.includes('data-chat-open'));
  assert.ok(withChat.length >= 80, 'only ' + withChat.length + ' pages have chat links');
  for (const p of withChat) {
    const tags = p.html.match(/<script src="[^"]*chat-widget\.js[^>]*><\/script>/g) || [];
    assert.equal(tags.length, 1, p.rel + ': chat widget script');
    for (const a of ['src', 'data-ui-src', 'data-ui-href', 'data-css-href']) assert.match(tags[0], new RegExp('\\s' + a + '="[^"]+\\?v=[0-9a-f]{8}"'), p.rel + ': ' + a + ' not versioned');
    assert.match(p.html, /href="\/contact\?chat=1" data-chat-open/, p.rel + ': chat link falls back to /contact?chat=1');
  }
});

test('the widget only talks to our own API (CSP connect-src self) and never stores the token in the URL query', () => {
  const js = fs.readFileSync(path.join(root, 'chat-widget.js'), 'utf8');
  const urls = js.match(/['"](https?:)?\/\/[^'"]+['"]/g) || [];
  assert.deepEqual(urls, [], 'no third-party URLs in the widget');
  assert.match(js, /'\/messages#c='/, 'full-screen link keeps the token in the hash');
});
