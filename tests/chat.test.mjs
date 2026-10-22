// FR: chat features — files both ways (type/content/size checks, private to the conversation), edit/delete with
// sync to the other side, Seen receipts, typing indicator, roles.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { call, cleanup, ADMIN } from './helpers.mjs';
import portal from '../api/portal.js';
import admin from '../api/admin.js';

after(cleanup);
let n = 0; const ip = () => '61.0.' + Math.floor(++n / 200) + '.' + (n % 200);
const tokenFrom = (link) => new URL(link).searchParams.get('c');
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(600 * 1024, 7)]); // spans two chunks
const PDF = Buffer.from('%PDF-1.4\n% test\n');

async function newConversation(email) {
  const c = await call(admin, { method: 'POST', headers: ADMIN, ip: ip(), body: { action: 'conv_create', name: 'Dana Client', email, subject: 'Your project', body: 'Hi Dana, welcome!' } });
  const t = await call(admin, { url: '/api/admin?view=thread&id=' + c.body.id, headers: ADMIN, ip: ip() });
  return { id: c.body.id, token: tokenFrom(t.body.link) };
}
const upload = (token, name, data) => call(portal, { method: 'POST', url: '/api/portal?t=' + token + '&name=' + encodeURIComponent(name), body: data, ip: ip() });

let A, B;
test('client sends files; the team and the client can open them; other conversations cannot', async () => {
  A = await newConversation('dana@client.test');
  B = await newConversation('other@client.test');
  const r = await upload(A.token, 'logo.png', PNG);
  assert.equal(r.code, 200, JSON.stringify(r.body));
  assert.equal(r.body.file.image, true);
  const fileId = r.body.file.id;

  const thread = await call(portal, { url: '/api/portal?t=' + A.token, ip: ip() });
  const msg = thread.body.messages.pop();
  assert.equal(msg.file.name, 'logo.png');
  assert.equal(msg.body, '');

  const got = await call(portal, { url: '/api/portal?t=' + A.token + '&file=' + fileId, ip: ip() });
  assert.equal(got.code, 200);
  assert.ok(Buffer.compare(got.body, PNG) === 0, 'bytes come back intact across chunks');
  assert.equal(got.headers['content-type'], 'image/png');
  assert.match(got.headers['content-disposition'], /^inline/);
  assert.equal(got.headers['x-content-type-options'], 'nosniff');
  const dl = await call(portal, { url: '/api/portal?t=' + A.token + '&file=' + fileId + '&dl=1', ip: ip() });
  assert.match(dl.headers['content-disposition'], /^attachment/);

  assert.equal((await call(portal, { url: '/api/portal?t=' + B.token + '&file=' + fileId, ip: ip() })).code, 404, 'another client cannot open it');
  const staff = await call(admin, { url: '/api/admin?view=file&conv=' + A.id + '&id=' + fileId, headers: ADMIN, ip: ip() });
  assert.equal(staff.code, 200);
  assert.equal(staff.body.length, PNG.length);
  assert.equal((await call(admin, { url: '/api/admin?view=file&conv=' + B.id + '&id=' + fileId, headers: ADMIN, ip: ip() })).code, 404);

  const inbox = await call(admin, { url: '/api/admin?view=inbox', headers: ADMIN, ip: ip() });
  assert.equal(inbox.body.conversations.find((c) => c.id === A.id).preview, '📎 logo.png');
});

test('unsupported, disguised, empty and oversized files are refused', async () => {
  assert.equal((await upload(A.token, 'run.exe', Buffer.from('MZ....'))).code, 415);
  assert.equal((await upload(A.token, 'page.html', Buffer.from('<script>alert(1)</script>'))).code, 415);
  assert.equal((await upload(A.token, 'fake.png', Buffer.from('<svg onload=alert(1)>'))).code, 415, 'content must match the extension');
  const renamed = await upload(A.token, 'photo.png', Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]));
  assert.equal(renamed.code, 200, 'a real JPEG saved as .png is accepted');
  assert.equal(renamed.body.file.name, 'photo.jpg');
  assert.equal(renamed.body.file.mime, 'image/jpeg');
  assert.equal((await upload(A.token, 'empty.pdf', Buffer.alloc(0))).code, 400);
  const big = Buffer.concat([PDF, Buffer.alloc(4 * 1024 * 1024)]);
  assert.equal((await upload(A.token, 'big.pdf', big)).code, 413);
  assert.equal((await upload('x'.repeat(43), 'a.pdf', PDF)).code, 404, 'needs a valid link');
  // a file served as a download never renders as a page
  const ok = await upload(A.token, 'brief.pdf', PDF);
  const got = await call(portal, { url: '/api/portal?t=' + A.token + '&file=' + ok.body.file.id, ip: ip() });
  assert.match(got.headers['content-disposition'], /^attachment/);
  assert.match(got.headers['content-security-policy'], /sandbox/);
});

test('the team sends a file; viewers cannot', async () => {
  const r = await call(admin, { method: 'POST', url: '/api/admin?action=msg_upload&id=' + A.id + '&name=proposal.pdf&email=0', headers: ADMIN, body: PDF, ip: ip() });
  assert.equal(r.code, 200, JSON.stringify(r.body));
  const thread = await call(portal, { url: '/api/portal?t=' + A.token, ip: ip() });
  const last = thread.body.messages.pop();
  assert.equal(last.from, 'staff');
  assert.equal(last.file.name, 'proposal.pdf');

  const v = await call(admin, { method: 'POST', headers: ADMIN, ip: ip(), body: { action: 'team_create', email: 'viewer2@cleverstack.test', name: 'V', role: 'viewer' } });
  const login = await call(admin, { method: 'POST', ip: ip(), body: { action: 'login', email: 'viewer2@cleverstack.test', password: v.body.password } });
  const vh = { authorization: 'Bearer ' + login.body.token };
  assert.equal((await call(admin, { method: 'POST', url: '/api/admin?action=msg_upload&id=' + A.id + '&name=x.pdf', headers: vh, body: PDF, ip: ip() })).code, 403);
  assert.equal((await call(admin, { method: 'POST', headers: vh, ip: ip(), body: { action: 'msg_delete', id: A.id, message_id: last.id } })).code, 403);
});

test('edits and deletions reach the other side; clients can only change their own messages', async () => {
  const sent = await call(portal, { method: 'POST', ip: ip(), body: { t: A.token, body: 'Budget is 2k' } });
  const first = await call(admin, { url: '/api/admin?view=thread&id=' + A.id, headers: ADMIN, ip: ip() });
  const lastId = first.body.messages[first.body.messages.length - 1].id;
  const since = first.body.now;

  assert.equal((await call(portal, { method: 'POST', ip: ip(), body: { t: A.token, op: 'edit', id: sent.body.id, body: 'Budget is 3k' } })).code, 200);
  const poll = await call(admin, { url: '/api/admin?view=thread&id=' + A.id + '&after=' + lastId + '&since=' + encodeURIComponent(since), headers: ADMIN, ip: ip() });
  assert.equal(poll.body.messages.length, 0);
  const edited = poll.body.changed.find((m) => m.id === sent.body.id);
  assert.equal(edited.body, 'Budget is 3k');
  assert.equal(edited.edited, true);

  const staffMsg = first.body.messages.find((m) => m.sender === 'staff');
  assert.equal((await call(portal, { method: 'POST', ip: ip(), body: { t: A.token, op: 'delete', id: staffMsg.id } })).code, 403, 'client cannot delete the team\'s message');
  assert.equal((await call(portal, { method: 'POST', ip: ip(), body: { t: B.token, op: 'delete', id: sent.body.id } })).code, 404, 'nor anything in another conversation');

  // deleting a file message removes the file too
  const withFile = first.body.messages.find((m) => m.file && m.file.name === 'logo.png');
  assert.equal((await call(portal, { method: 'POST', ip: ip(), body: { t: A.token, op: 'delete', id: withFile.id } })).code, 200);
  assert.equal((await call(portal, { url: '/api/portal?t=' + A.token + '&file=' + withFile.file.id, ip: ip() })).code, 404);
  const p2 = await call(portal, { url: '/api/portal?t=' + A.token + '&after=' + lastId + '&since=' + encodeURIComponent(since), ip: ip() });
  const gone = p2.body.changed.find((m) => m.id === withFile.id);
  assert.equal(gone.deleted, true);
  assert.equal(gone.file, null);

  // the team edits its own message
  assert.equal((await call(admin, { method: 'POST', headers: ADMIN, ip: ip(), body: { action: 'msg_edit', id: A.id, message_id: staffMsg.id, body: 'Hi Dana, welcome aboard!' } })).code, 200);
  assert.equal((await call(admin, { method: 'POST', headers: ADMIN, ip: ip(), body: { action: 'msg_edit', id: A.id, message_id: sent.body.id, body: 'hijack' } })).code, 403, 'the team cannot rewrite the client\'s words');
});

test('Seen receipts and the typing indicator', async () => {
  const s = await call(admin, { method: 'POST', headers: ADMIN, ip: ip(), body: { action: 'msg_send', id: B.id, body: 'Are you around today?', email: false } });
  assert.equal(s.code, 200);
  let staffView = await call(admin, { url: '/api/admin?view=thread&id=' + B.id, headers: ADMIN, ip: ip() });
  const newest = staffView.body.messages[staffView.body.messages.length - 1].id;
  assert.ok(staffView.body.seen < newest, 'not seen before the client opens it');
  await call(portal, { url: '/api/portal?t=' + B.token, ip: ip() });
  staffView = await call(admin, { url: '/api/admin?view=thread&id=' + B.id, headers: ADMIN, ip: ip() });
  assert.equal(staffView.body.seen, newest, 'Seen after the client opened the page');

  assert.equal(staffView.body.typing, false);
  await call(portal, { method: 'POST', ip: ip(), body: { t: B.token, op: 'typing' } });
  staffView = await call(admin, { url: '/api/admin?view=thread&id=' + B.id, headers: ADMIN, ip: ip() });
  assert.equal(staffView.body.typing, true, 'team sees the client typing');
  await call(portal, { method: 'POST', ip: ip(), body: { t: B.token, body: 'Yes!' } });
  staffView = await call(admin, { url: '/api/admin?view=thread&id=' + B.id, headers: ADMIN, ip: ip() });
  assert.equal(staffView.body.typing, false, 'sending clears typing');

  await call(admin, { method: 'POST', headers: ADMIN, ip: ip(), body: { action: 'msg_typing', id: B.id } });
  const clientView = await call(portal, { url: '/api/portal?t=' + B.token, ip: ip() });
  assert.equal(clientView.body.typing, true, 'client sees the team typing');
  const clientNewest = clientView.body.messages[clientView.body.messages.length - 1].id;
  assert.equal(clientView.body.seen, clientNewest, 'the team has seen the client\'s reply');
});
