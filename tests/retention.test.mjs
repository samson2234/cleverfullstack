// FR: retain past clients — returning-client page, unsubscribe, inactive filter, win-back campaigns
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { call, cleanup, ADMIN, mockFetch } from './helpers.mjs';
import admin from '../api/admin.js';
import reconnect from '../api/reconnect.js';
import unsubscribe from '../api/unsubscribe.js';
import { getClient } from '../lib/db.js';

after(cleanup);
const get = (q) => call(admin, { url: '/api/admin?' + q, headers: ADMIN });
const post = (b) => call(admin, { method: 'POST', body: b, headers: ADMIN });
let ipN = 0;
const freshIp = () => '40.0.0.' + (++ipN);

test('returning client identifies themselves => past_client, tagged self-identified, timeline shows context', async () => {
  const r = await call(reconnect, { method: 'POST', ip: freshIp(), body: { name: 'Ruth Returning', email: 'ruth@example.com', company: 'Ruth LLC', country: 'United States', channel: 'Fiverr', project: 'Shopify store', need: 'Add a booking page' } });
  assert.equal(r.code, 200);
  const l = await get('view=contacts&q=ruth');
  assert.equal(l.body.rows[0].kind, 'past_client');
  assert.equal(l.body.rows[0].tags, 'self-identified');
  const d = await get('view=contact&id=' + l.body.rows[0].id);
  assert.match(d.body.activities[0].body, /Fiverr/);
  assert.match(d.body.activities[0].body, /booking page/);
});

test('reconnect never downgrades an existing client and validates input', async () => {
  await post({ action: 'contact_create', name: 'Carl Client', email: 'carl@example.com', kind: 'client' });
  await call(reconnect, { method: 'POST', ip: freshIp(), body: { name: 'Carl Client', email: 'carl@example.com' } });
  assert.equal((await get('view=contacts&q=carl')).body.rows[0].kind, 'client');
  assert.equal((await call(reconnect, { method: 'POST', ip: freshIp(), body: { name: 'X', email: 'nope' } })).code, 400);
  assert.equal((await call(reconnect, { method: 'GET' })).code, 405);
});

test('reconnect: honeypot swallowed, and rate limited per IP', async () => {
  const bot = await call(reconnect, { method: 'POST', ip: freshIp(), body: { name: 'Bot Bot', email: 'bot@example.com', company_website: 'x' } });
  assert.equal(bot.code, 200);
  assert.equal((await get('view=contacts&q=bot@example.com')).body.total, 0);
  let last;
  for (let i = 0; i < 6; i++) last = await call(reconnect, { method: 'POST', ip: '41.1.1.1', body: { name: 'Rate Limited', email: `rl${i}@example.com` } });
  assert.equal(last.code, 429);
});

test('inactive filter finds people we have not touched for N days', async () => {
  const id = (await get('view=contacts&q=carl')).body.rows[0].id;
  await getClient().execute({ sql: "UPDATE contacts SET last_activity_at = datetime('now','-200 days') WHERE id = ?", args: [id] });
  const quiet = await get('view=contacts&inactive_days=180');
  assert.deepEqual(quiet.body.rows.map((r) => r.email), ['carl@example.com']);
  assert.equal((await get('view=contacts&inactive_days=365')).body.total, 0);
});

test('win-back campaign: needs a key; sends in batches; never double-sends; skips unsubscribed + archived', async () => {
  // seed a segment of 5 past clients, one of whom unsubscribes and one archived
  for (let i = 0; i < 5; i++) await post({ action: 'contact_create', name: 'Past Client ' + i, email: `pc${i}@example.com`, kind: 'past_client', country: 'Canada' });
  const filters = { kind: 'past_client', country: 'Canada' };
  const base = { campaign: 'Winback Test', filters };

  // preview does not need an email key
  assert.equal((await post({ action: 'campaign_preview', ...base })).body.total, 5);
  // sending without a key fails loudly instead of pretending
  assert.equal((await post({ action: 'campaign_send', ...base, subject: 'Hi', body: 'Hello' })).code, 503);

  process.env.RESEND_API_KEY = 're_test';
  const sentTo = [];
  const restore = mockFetch(async (url, init) => {
    if (String(url).includes('api.resend.com')) {
      const b = JSON.parse(init.body);
      sentTo.push(b.to[0]);
      assert.match(b.html, /unsubscribe/i, 'every campaign email carries an unsubscribe link');
      return { ok: true, json: async () => ({ id: 'x' }) };
    }
    throw new Error('unexpected fetch ' + url);
  });
  try {
    // one person unsubscribes via the link in their email; another is archived
    await call(unsubscribe, { url: '/api/unsubscribe?email=pc0@example.com' });
    const pc1 = (await get('view=contacts&q=pc1@example.com')).body.rows[0].id;
    await post({ action: 'contact_update', id: pc1, archived: true });

    assert.equal((await post({ action: 'campaign_preview', ...base })).body.total, 3);
    const r = await post({ action: 'campaign_send', ...base, subject: 'It has been a while', body: 'Can we help with your site?' });
    assert.equal(r.code, 200);
    assert.equal(r.body.sent, 3);
    assert.equal(r.body.remaining, 0);
    assert.deepEqual(sentTo.sort(), ['pc2@example.com', 'pc3@example.com', 'pc4@example.com']);

    // re-running the same campaign is a no-op (nobody gets it twice)
    const again = await post({ action: 'campaign_send', ...base, subject: 'It has been a while', body: 'Can we help with your site?' });
    assert.equal(again.body.sent, 0);
    assert.equal(sentTo.length, 3);

    // a different campaign name reaches them again, and each send is on the contact's timeline
    assert.equal((await post({ action: 'campaign_preview', campaign: 'Spring Offer', filters })).body.total, 3);
    const id = (await get('view=contacts&q=pc2@example.com')).body.rows[0].id;
    const tl = await get('view=contact&id=' + id);
    assert.ok(tl.body.activities.some((a) => a.type === 'campaign' && /Winback Test/.test(a.body)));
  } finally { restore(); delete process.env.RESEND_API_KEY; }
});

test('failed sends stay in the queue and are retried next time', async () => {
  await post({ action: 'contact_create', name: 'Flaky One', email: 'flaky@example.com', kind: 'partner' });
  process.env.RESEND_API_KEY = 're_test';
  let fail = true;
  const restore = mockFetch(async () => (fail ? { ok: false, json: async () => ({ message: 'boom' }) } : { ok: true, json: async () => ({ id: 'y' }) }));
  try {
    const args = { campaign: 'Flaky Retry', filters: { kind: 'partner' }, subject: 'Hi', body: 'Hello' };
    const a = await post({ action: 'campaign_send', ...args });
    assert.equal(a.body.sent, 0);
    assert.equal(a.body.failed, 1);
    fail = false;
    const b = await post({ action: 'campaign_send', ...args });
    assert.equal(b.body.sent, 1);
  } finally { restore(); delete process.env.RESEND_API_KEY; }
});
