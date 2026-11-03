// FR: email campaigns: lists, suppression, import, audience, batched sending, tracking, A/B tests, reports
import { test, after, before } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { call, cleanup, ADMIN, mockFetch, sessionToken } from './helpers.mjs';
import admin from '../api/admin.js';
import pulse from '../api/pulse.js';
import unsubscribe from '../api/unsubscribe.js';
import subscribe from '../api/subscribe.js';
import { getClient, saveSubmission } from '../lib/db.js';
import { linkSubmissionToContact } from '../lib/contacts.js';
import { runDue, verifyWebhook } from '../lib/campaigns.js';

after(cleanup);
let ipN = 0;
const ip = () => '60.' + (++ipN >> 8) + '.' + (ipN & 255) + '.1'; // one IP per request: the admin rate limit is not under test here
const get = (q) => call(admin, { url: '/api/admin?' + q, headers: ADMIN, ip: ip() });
const post = (b) => call(admin, { method: 'POST', body: b, headers: ADMIN, ip: ip() });
const lead = async (d) => { const id = await saveSubmission(d); const row = (await getClient().execute({ sql: 'SELECT id FROM submissions WHERE email = ? ORDER BY id DESC LIMIT 1', args: [d.email] })).rows[0]; await linkSubmissionToContact(Number(row.id), d); return Number(row.id) || id; };
const UA = { 'user-agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Safari/604.1' };
const BLOCKS = [{ type: 'heading', text: 'Hello {{first_name|there}}' }, { type: 'text', text: 'Read **this** [guide](https://cleverstack.dev/blog)' }, { type: 'button', text: 'Book', url: 'https://cleverstack.dev/contact' }];

// a fake Resend: records every batch and answers with ids
let batches = [];
let answer = null;
let restore;
before(() => {
  process.env.RESEND_API_KEY = 'test-key';
  restore = mockFetch(async (url, opts) => {
    if (!String(url).includes('api.resend.com')) return new Response('{}', { status: 200 });
    const body = JSON.parse(opts.body);
    const custom = answer && answer(url, body);
    if (custom) return custom;
    batches.push({ url: String(url), body, key: opts.headers['Idempotency-Key'] });
    const ids = (Array.isArray(body) ? body : [body]).map((_, i) => ({ id: 'rs-' + batches.length + '-' + i }));
    return new Response(JSON.stringify(Array.isArray(body) ? { data: ids } : ids[0]), { status: 200, headers: { 'Content-Type': 'application/json' } });
  });
});
after(() => { restore(); delete process.env.RESEND_API_KEY; });

const newCampaign = async (over = {}) => (await post({ action: 'camp_save', name: 'C ' + Math.random(), subject: 'Hi {{first_name|friend}}', blocks: BLOCKS, audience: { all: true }, ...over })).body.id;
const listId = async (name) => (await get('view=lists')).body.lists.find((l) => l.name === name).id;
const recipients = async (id, filter = '') => (await get('view=campaign_recipients&limit=200&id=' + id + '&filter=' + filter)).body;

test('starter lists exist and lists can be created, renamed and deleted', async () => {
  const names = (await get('view=lists')).body.lists.map((l) => l.name);
  for (const n of ['Follow-up client', 'Upsell client', 'Interested but not ready']) assert.ok(names.includes(n), n);
  const r = await post({ action: 'list_create', name: 'VIP' });
  assert.equal(r.code, 200);
  assert.equal((await post({ action: 'list_create', name: 'vip' })).code, 400, 'duplicate name');
  await post({ action: 'list_update', id: r.body.id, name: 'VIPs' });
  assert.ok((await get('view=lists')).body.lists.some((l) => l.name === 'VIPs'));
  await post({ action: 'list_delete', id: r.body.id });
  assert.ok(!(await get('view=lists')).body.lists.some((l) => l.name === 'VIPs'));
});

test('import merges duplicates, reports invalid rows, adds to a list, and never overwrites existing data', async () => {
  const list = (await post({ action: 'list_create', name: 'Imported' })).body.id;
  await lead({ name: 'Web Lead', email: 'web@acme.com', company: 'Acme', message: 'Hi' });
  const r = await post({
    action: 'audience_import', list_id: list, tags: 'spring, Promo', source: 'test.csv', consent: 'opted_in',
    rows: [
      { email: 'ANNA@one.com', name: 'Anna Smith', company: 'One', extra: { 'Favourite Colour': 'blue' } },
      { email: 'anna@one.com', name: 'Dup' }, { email: 'not-an-email', name: 'Bad' }, { email: 'ben@two.com', first_name: 'Ben', last_name: 'Jones' },
      { email: 'web@acme.com', name: 'Changed', company: 'Other' }
    ]
  });
  assert.equal(r.code, 200);
  assert.deepEqual([r.body.created, r.body.updated, r.body.invalid, r.body.duplicates, r.body.added], [2, 1, 1, 1, 3]);
  const c = await getClient().execute("SELECT * FROM contacts WHERE email IN ('anna@one.com', 'ben@two.com', 'web@acme.com') ORDER BY email");
  assert.equal(c.rows[0].name, 'Anna Smith'); assert.equal(c.rows[0].tags, 'spring,promo'); assert.equal(c.rows[0].consent, 'opted_in');
  assert.equal(JSON.parse(c.rows[0].fields).favourite_colour, 'blue');
  assert.equal(c.rows[1].name, 'Ben Jones');
  assert.equal(c.rows[2].name, 'Web Lead', 'existing name kept'); assert.equal(c.rows[2].company, 'Acme', 'existing company kept');
  // importing the same people again adds nobody and repeats no tags
  const again = await post({ action: 'audience_import', list_id: list, tags: 'spring', rows: [{ email: 'anna@one.com' }] });
  assert.equal(again.body.created, 0); assert.equal(again.body.added, 0);
  assert.equal((await getClient().execute("SELECT tags FROM contacts WHERE email='anna@one.com'")).rows[0].tags, 'spring,promo');
});

test('website subscribers become contacts tagged newsletter; deleting one removes only the tag', async () => {
  const r = await call(subscribe, { method: 'POST', body: { email: 'sub@news.com', name: 'Sue Sub' }, ip: '40.0.0.1' });
  assert.ok(r.code < 300, JSON.stringify(r.body));
  const c = (await getClient().execute("SELECT tags, name FROM contacts WHERE email='sub@news.com'")).rows[0];
  assert.match(c.tags, /newsletter/);
  const sub = (await getClient().execute("SELECT id FROM subscribers WHERE email='sub@news.com'")).rows[0];
  await post({ action: 'delete_subscriber', id: sub.id });
  assert.doesNotMatch((await getClient().execute("SELECT tags FROM contacts WHERE email='sub@news.com'")).rows[0].tags, /newsletter/);
  await call(subscribe, { method: 'POST', body: { email: 'sub@news.com', name: 'Sue Sub' }, ip: '40.0.0.2' });
});

test('inbox chips: audienceOf and setAudience add and remove lists and tags, creating the contact if needed', async () => {
  const follow = await listId('Follow-up client');
  await post({ action: 'audience_set', email: 'chat@visitor.com', name: 'Chat Visitor', list_id: follow, add: true });
  await post({ action: 'audience_set', email: 'chat@visitor.com', add_tag: 'hot' });
  let a = (await get('view=audience&email=chat@visitor.com')).body;
  assert.ok(a.lists.some((l) => l.id === follow)); assert.ok(a.tags.includes('hot'));
  await post({ action: 'audience_set', email: 'chat@visitor.com', list_id: follow, add: false });
  await post({ action: 'audience_set', email: 'chat@visitor.com', remove_tag: 'hot' });
  a = (await get('view=audience&email=chat@visitor.com')).body;
  assert.equal(a.lists.length, 0); assert.ok(!a.tags.includes('hot'));
});

test('import from the website: leads into a list, vendor pitches left out', async () => {
  const list = (await post({ action: 'list_create', name: 'Site leads' })).body.id;
  await lead({ name: 'Real Lead', email: 'real@lead.com', message: 'Need a site' });
  await lead({ name: 'Pitch', email: 'pitch@seo.com', message: 'We offer SEO' });
  await getClient().execute("UPDATE submissions SET status='vendor' WHERE email='pitch@seo.com'");
  const r = await post({ action: 'audience_import_site', source: 'leads', list_id: list });
  assert.equal(r.code, 200);
  const members = (await get('view=contacts&limit=100&list=' + list)).body.rows.map((c) => c.email);
  assert.ok(members.includes('real@lead.com')); assert.ok(!members.includes('pitch@seo.com'));
});

test('a campaign cannot start without a postal address, subject, content or audience', async () => {
  const id = await newCampaign();
  const r = await post({ action: 'camp_start', id, confirm_permission: true });
  assert.equal(r.code, 400); assert.match(r.body.error, /postal address/i);
  await post({ action: 'camp_settings', postal_address: '1 Main St, Austin, TX', daily_limit: 10000, seeds: 'me@x.com, bad' });
  const s = (await get('view=campaign_settings')).body;
  assert.equal(s.seeds, 'me@x.com'); assert.equal(s.postal_address, '1 Main St, Austin, TX');
  const noSub = await newCampaign({ subject: '' });
  assert.match((await post({ action: 'camp_start', id: noSub, confirm_permission: true })).body.error, /subject/i);
  const noBody = await newCampaign({ blocks: [] });
  assert.match((await post({ action: 'camp_start', id: noBody, confirm_permission: true })).body.error, /content/i);
  const empty = await newCampaign({ audience: { lists: [999999] } });
  assert.match((await post({ action: 'camp_start', id: empty, confirm_permission: true })).body.error, /Nobody/);
});

test('sending asks for confirmation when permission is unknown, then sends with merge fields, unsubscribe headers and tracking', async () => {
  const list = (await post({ action: 'list_create', name: 'Blast' })).body.id;
  const rows = []; for (let i = 0; i < 230; i++) rows.push({ email: 'p' + i + '@blast.com', name: 'Person' + i + ' Last' });
  await post({ action: 'audience_import', list_id: list, rows }); // consent left unknown
  const id = await newCampaign({ audience: { lists: [list] } });
  batches = [];
  const blocked = await post({ action: 'camp_start', id });
  assert.equal(blocked.code, 409); assert.equal(blocked.body.summary.no_permission, 230);
  assert.equal(batches.length, 0);

  batches = [];
  assert.equal((await post({ action: 'camp_start', id, confirm_permission: true })).code, 200);
  const t = await post({ action: 'camp_tick', id });
  assert.equal(t.code, 200); assert.equal(t.body.done, 230); assert.equal(t.body.status, 'sent');
  assert.equal(batches.length, 3, '100 + 100 + 30'); assert.equal(batches[0].body.length, 100);
  assert.ok(batches.every((b) => b.url.endsWith('/emails/batch') && b.key), 'batch API with idempotency keys');
  const e = batches[0].body[0];
  assert.equal(e.subject, 'Hi Person0');
  assert.match(e.html, /Hello Person0/); assert.match(e.html, /<strong>this<\/strong>/);
  assert.match(e.html, /1 Main St, Austin, TX/); assert.match(e.html, /api\/pulse\?o=[0-9a-f]{32}/); assert.match(e.html, /api\/pulse\?c=[0-9a-f]{32}&amp;l=\d+/);
  assert.doesNotMatch(e.html, /href="https:\/\/cleverstack\.dev\/blog/, 'links are wrapped');
  assert.match(e.headers['List-Unsubscribe'], /api\/unsubscribe\?t=/); assert.equal(e.headers['List-Unsubscribe-Post'], 'List-Unsubscribe=One-Click');
  assert.match(e.text, /Unsubscribe: /);
  // a second tick sends nothing more
  const before = batches.length;
  await post({ action: 'camp_tick', id });
  assert.equal(batches.length, before);
  assert.equal(new Set(batches.flatMap((b) => b.body.map((m) => m.to[0]))).size, 230, 'nobody twice');
});

test('typed content is escaped, unsafe links are dropped and merge values cannot inject HTML', async () => {
  await post({ action: 'audience_import', rows: [{ email: 'evil@x.com', name: '<img src=x onerror=alert(1)>' }], consent: 'opted_in', tags: 'evilcase' });
  const id = await newCampaign({ audience: { tags: ['evilcase'] }, blocks: [{ type: 'text', text: '<script>alert(1)</script> {{name}} [x](javascript:alert(1))' }, { type: 'button', text: 'b', url: 'javascript:alert(1)' }] });
  batches = [];
  await post({ action: 'camp_start', id });
  await post({ action: 'camp_tick', id });
  const html = batches[0].body[0].html;
  assert.doesNotMatch(html, /<script/); assert.doesNotMatch(html, /<img src=x/); assert.doesNotMatch(html, /javascript:/);
  assert.match(html, /&lt;script&gt;/);
});

test('opens and clicks are recorded per person, bots are not, and clicks redirect only to the campaign\'s own links', async () => {
  const list = (await post({ action: 'list_create', name: 'Track' })).body.id;
  await post({ action: 'audience_import', list_id: list, consent: 'opted_in', rows: [{ email: 'a@track.com', name: 'A' }, { email: 'b@track.com', name: 'B' }] });
  const id = await newCampaign({ name: 'Spring Offer', audience: { lists: [list] } });
  batches = [];
  await post({ action: 'camp_start', id });
  await post({ action: 'camp_tick', id });
  const html = batches[0].body[0].html;
  const token = /pulse\?o=([0-9a-f]{32})/.exec(html)[1];
  const link = /pulse\?c=[0-9a-f]{32}&amp;l=(\d+)/.exec(html)[1];

  const px = await call(pulse, { method: 'GET', url: '/api/pulse?o=' + token, headers: UA });
  assert.equal(px.code, 200); assert.equal(px.headers['content-type'] || px.headers['Content-Type'], 'image/gif');
  await call(pulse, { method: 'GET', url: '/api/pulse?o=' + token, headers: UA });
  await call(pulse, { method: 'GET', url: '/api/pulse?o=' + token, headers: { 'user-agent': 'Googlebot/2.1' } });
  const click = await call(pulse, { method: 'GET', url: '/api/pulse?c=' + token + '&l=' + link, headers: UA });
  assert.equal(click.code, 302);
  const loc = click.headers.location || click.headers.Location;
  assert.match(loc, /^https:\/\/cleverstack\.dev\/.*utm_source=email&utm_medium=email&utm_campaign=email-\d+-spring-offer/);
  // someone else's link id or a bad token goes home, not to an attacker's URL
  const bad = await call(pulse, { method: 'GET', url: '/api/pulse?c=' + token + '&l=999999&u=https://evil.com', headers: UA });
  assert.doesNotMatch(bad.headers.location || bad.headers.Location, /evil/);

  const report = (await get('view=campaign_report&id=' + id)).body;
  assert.equal(report.stats.sent, 2); assert.equal(report.stats.opened, 1); assert.equal(report.stats.clicked, 1);
  assert.equal(report.stats.rates.open, 50); assert.equal(report.stats.rates.click, 50);
  assert.ok(report.links.some((l) => l.clicks === 1)); assert.equal(report.devices[0].device, 'mobile');
  assert.ok(report.timeline.length >= 1);
  const r = (await recipients(id, 'opened')).rows[0];
  assert.equal(Number(r.open_count), 2, 'the bot open is not counted');
  assert.equal((await recipients(id, 'not_opened')).total, 1);
});

test('a lead from the campaign link and its value show on the report, dashboard and overview', async () => {
  const c = (await get('view=campaigns')).body.campaigns.find((x) => x.name === 'Spring Offer');
  const slug = (await get('view=campaign_report&id=' + c.id)).body.campaign.slug;
  const sid = await lead({ name: 'From Email', email: 'a@track.com', message: 'I clicked' });
  await getClient().execute({ sql: "UPDATE submissions SET status='won', utm_campaign=? WHERE id=?", args: [slug, sid] });
  await getClient().execute("UPDATE contacts SET lifetime_value=5000 WHERE email='a@track.com'");
  const r = (await get('view=campaign_report&id=' + c.id)).body;
  assert.equal(r.leads, 1); assert.equal(r.won, 1); assert.equal(r.revenue, 5000);
  const o = (await get('view=campaigns_overview')).body;
  assert.ok(o.campaigns.length >= 1); assert.ok(o.totals.leads >= 1); assert.ok(o.totals.sent >= 2);
});

test('unsubscribe link asks first; confirm and one-click POST stop future email; old links still work', async () => {
  const list = (await post({ action: 'list_create', name: 'Unsub' })).body.id;
  await post({ action: 'audience_import', list_id: list, consent: 'opted_in', rows: [{ email: 'u1@x.com' }, { email: 'u2@x.com' }, { email: 'u3@x.com' }] });
  const id = await newCampaign({ audience: { lists: [list] } });
  batches = [];
  await post({ action: 'camp_start', id });
  await post({ action: 'camp_tick', id });
  const tok = (i) => /unsubscribe\?t=([0-9a-f]{32})/.exec(batches[0].body[i].html)[1];

  const ask = await call(unsubscribe, { method: 'GET', url: '/api/unsubscribe?t=' + tok(0) });
  assert.equal(ask.code, 200); assert.match(String(ask.body), /Yes, unsubscribe me/);
  assert.equal((await get('view=audience&email=u1@x.com')).body.suppressed, null, 'a mail scanner opening the link changes nothing');
  await call(unsubscribe, { method: 'GET', url: '/api/unsubscribe?t=' + tok(0) + '&confirm=1' });
  await call(unsubscribe, { method: 'POST', url: '/api/unsubscribe?t=' + tok(1) });
  const stats = (await get('view=campaign_report&id=' + id)).body.stats;
  assert.equal(stats.unsubscribed, 2);
  const next = await newCampaign({ audience: { lists: [list] } });
  batches = [];
  await post({ action: 'camp_start', id: next });
  await post({ action: 'camp_tick', id: next });
  assert.deepEqual(batches.flatMap((b) => b.body.map((m) => m.to[0])), ['u3@x.com']);
  // can't be undone from the suppressed screen
  assert.equal((await post({ action: 'suppression_remove', email: 'u1@x.com' })).code, 400);
});

test('webhook: signature required; delivered, hard bounce and complaint update the campaign and suppress', async () => {
  const list = (await post({ action: 'list_create', name: 'Hook' })).body.id;
  await post({ action: 'audience_import', list_id: list, consent: 'opted_in', rows: [{ email: 'd@x.com' }, { email: 'h@x.com' }, { email: 'c@x.com' }, { email: 's@x.com' }] });
  const id = await newCampaign({ audience: { lists: [list] } });
  batches = [];
  await post({ action: 'camp_start', id });
  await post({ action: 'camp_tick', id });
  const rows = (await getClient().execute({ sql: 'SELECT email, resend_id FROM campaign_recipients WHERE campaign_id = ?', args: [id] })).rows;
  const rid = (e) => rows.find((r) => r.email === e).resend_id;
  const secret = 'whsec_' + Buffer.from('supersecretkey12').toString('base64');
  const send = async (ev, bad) => {
    process.env.RESEND_WEBHOOK_SECRET = secret;
    const raw = JSON.stringify(ev);
    const ts = String(Math.floor(Date.now() / 1000));
    const sig = crypto.createHmac('sha256', Buffer.from('supersecretkey12')).update('m1.' + ts + '.' + raw).digest('base64');
    const r = await call(unsubscribe, { method: 'POST', url: '/api/unsubscribe?webhook=resend', body: ev, headers: { 'svix-id': 'm1', 'svix-timestamp': ts, 'svix-signature': 'v1,' + (bad ? 'AAAA' : sig) } });
    delete process.env.RESEND_WEBHOOK_SECRET;
    return r;
  };
  assert.equal((await send({ type: 'email.delivered', data: { email_id: rid('d@x.com') } }, true)).code, 401);
  assert.equal((await send({ type: 'email.delivered', data: { email_id: rid('d@x.com'), to: ['d@x.com'] } })).code, 200);
  await send({ type: 'email.bounced', data: { email_id: rid('h@x.com'), to: ['h@x.com'], bounce: { type: 'Permanent', message: 'No such user' } } });
  await send({ type: 'email.bounced', data: { email_id: rid('s@x.com'), to: ['s@x.com'], bounce: { type: 'Transient', message: 'Mailbox full' } } });
  await send({ type: 'email.complained', data: { email_id: rid('c@x.com'), to: ['c@x.com'] } });
  const s = (await get('view=campaign_report&id=' + id)).body.stats;
  assert.deepEqual([s.delivered, s.bounced, s.complained], [1, 2, 1]);
  assert.equal(s.rates.delivery, 25); assert.ok(s.warnings.length === 0, 'too few sends to warn');
  const blocked = (await get('view=suppressions&limit=200')).body.rows.map((r) => r.email);
  assert.ok(blocked.includes('h@x.com')); assert.ok(blocked.includes('c@x.com')); assert.ok(!blocked.includes('s@x.com'), 'a soft bounce can be retried');
  assert.equal(verifyWebhook('{}', { 'svix-id': 'a', 'svix-timestamp': '1', 'svix-signature': 'v1,x' }, secret), false, 'old timestamps refused');
});

test('daily limit stops sending and the next day\'s run continues; nobody is sent twice', async () => {
  const list = (await post({ action: 'list_create', name: 'Limit' })).body.id;
  const rows = []; for (let i = 0; i < 25; i++) rows.push({ email: 'l' + i + '@limit.com' });
  await post({ action: 'audience_import', list_id: list, consent: 'opted_in', rows });
  await getClient().execute("UPDATE campaign_recipients SET sent_at = datetime('now', '-3 days')"); // earlier tests were not today
  await post({ action: 'camp_settings', postal_address: '1 Main St, Austin, TX', daily_limit: 10 });
  const id = await newCampaign({ audience: { lists: [list] } });
  batches = [];
  await post({ action: 'camp_start', id });
  const t = await post({ action: 'camp_tick', id });
  assert.equal(t.body.waiting, 'daily_limit'); assert.equal(t.body.done, 10); assert.equal(t.body.status, 'sending');
  // tomorrow
  await getClient().execute("UPDATE campaign_recipients SET sent_at = datetime('now', '-1 day') WHERE sent_at IS NOT NULL");
  await runDue(5000);
  assert.equal((await post({ action: 'camp_tick', id })).body.done, 20);
  await getClient().execute("UPDATE campaign_recipients SET sent_at = datetime('now', '-1 day') WHERE sent_at IS NOT NULL");
  const done = await post({ action: 'camp_tick', id });
  assert.equal(done.body.done, 25); assert.equal(done.body.status, 'sent');
  assert.equal(new Set(batches.flatMap((b) => b.body.map((m) => m.to[0]))).size, 25);
  assert.equal(batches.flatMap((b) => b.body).length, 25);
  await post({ action: 'camp_settings', postal_address: '1 Main St, Austin, TX', daily_limit: 100000 });
});

test('provider failures: 429 keeps people queued, one bad address fails alone, a bad key pauses, interrupted rows are not resent', async () => {
  const list = (await post({ action: 'list_create', name: 'Fail' })).body.id;
  await post({ action: 'audience_import', list_id: list, consent: 'opted_in', rows: [{ email: 'f1@x.com' }, { email: 'f2@x.com' }, { email: 'f3@x.com' }] });
  const id = await newCampaign({ audience: { lists: [list] } });
  await post({ action: 'camp_start', id });
  answer = () => new Response(JSON.stringify({ message: 'Too many requests' }), { status: 429 });
  let t = await post({ action: 'camp_tick', id });
  assert.equal(t.body.waiting, 'provider'); assert.equal(t.body.queued, 3); assert.equal(t.body.status, 'sending'); assert.match(t.body.last_error, /Too many/);
  // a batch rejected as invalid is retried singly
  answer = (url, body) => {
    if (url.endsWith('/batch')) return new Response(JSON.stringify({ message: 'invalid' }), { status: 422 });
    if (body.to[0] === 'f2@x.com') return new Response(JSON.stringify({ message: 'Invalid to' }), { status: 422 });
    return new Response(JSON.stringify({ id: 'one' }), { status: 200 });
  };
  t = await post({ action: 'camp_tick', id });
  assert.equal(t.body.done, 2); assert.equal(t.body.failed_total, 1); assert.equal(t.body.status, 'sent');
  // bad API key pauses rather than burning through the list
  const id2 = await newCampaign({ audience: { lists: [list] } });
  await post({ action: 'camp_start', id2, id: id2 });
  answer = () => new Response(JSON.stringify({ message: 'API key is invalid' }), { status: 401 });
  t = await post({ action: 'camp_tick', id: id2 });
  assert.equal(t.body.status, 'paused'); assert.equal(t.body.queued, 3);
  answer = null;
  // a crash mid-send: status stays 'sending'; later it is marked failed rather than sent again
  await getClient().execute({ sql: "UPDATE campaign_recipients SET status='sending', claimed_at=? WHERE campaign_id=? AND email='f1@x.com'", args: [Date.now() - 3600000, id2] });
  await post({ action: 'camp_control', id: id2, op: 'resume' });
  batches = [];
  t = await post({ action: 'camp_tick', id: id2 });
  assert.equal(t.body.failed_total, 1); assert.equal(t.body.done, 2);
  assert.ok(!batches.flatMap((b) => b.body.map((m) => m.to[0])).includes('f1@x.com'));
});

test('pause, resume, cancel and schedule', async () => {
  const list = (await post({ action: 'list_create', name: 'Ctl' })).body.id;
  await post({ action: 'audience_import', list_id: list, consent: 'opted_in', rows: [{ email: 'k1@x.com' }, { email: 'k2@x.com' }] });
  const id = await newCampaign({ audience: { lists: [list] } });
  const future = new Date(Date.now() + 86400000).toISOString();
  const s = await post({ action: 'camp_start', id, schedule_at: future });
  assert.equal(s.body.scheduled, future);
  batches = [];
  await runDue(2000);
  assert.equal(batches.length, 0, 'not yet');
  await getClient().execute({ sql: "UPDATE campaigns SET schedule_at = ? WHERE id = ?", args: [new Date(Date.now() - 1000).toISOString(), id] });
  await post({ action: 'camp_control', id, op: 'pause' }); // not sending yet: refused, harmless
  await runDue(5000);
  assert.equal(batches.flatMap((b) => b.body).length, 2);
  assert.equal((await get('view=campaign&id=' + id)).body.campaign.status, 'sent');
  assert.equal((await post({ action: 'camp_save', id, name: 'Changed', subject: 'x' })).code, 400, 'cannot edit after starting');

  const id2 = await newCampaign({ audience: { lists: [list] } });
  await post({ action: 'camp_start', id: id2 });
  assert.equal((await post({ action: 'camp_delete', id: id2 })).code, 400, 'must stop first');
  await post({ action: 'camp_control', id: id2, op: 'pause' });
  batches = [];
  await post({ action: 'camp_tick', id: id2 });
  assert.equal(batches.length, 0, 'paused sends nothing');
  await post({ action: 'camp_control', id: id2, op: 'cancel' });
  assert.equal((await get('view=campaign&id=' + id2)).body.campaign.status, 'cancelled');
  assert.equal((await post({ action: 'camp_delete', id: id2 })).code, 200);
});

test('A/B test: test group splits evenly, the rest wait, the better version wins and goes to everyone else', async () => {
  const list = (await post({ action: 'list_create', name: 'AB' })).body.id;
  const rows = []; for (let i = 0; i < 100; i++) rows.push({ email: 'ab' + i + '@x.com' });
  await post({ action: 'audience_import', list_id: list, consent: 'opted_in', rows });
  const small = await newCampaign({ audience: { tags: ['evilcase'] }, ab: { enabled: true, field: 'subject', subject_b: 'B', test_pct: 20 } });
  assert.match((await post({ action: 'camp_start', id: small })).body.error, /at least 10/);
  const noB = await newCampaign({ audience: { lists: [list] }, ab: { enabled: true, field: 'subject', subject_b: '' } });
  assert.match((await post({ action: 'camp_start', id: noB })).body.error, /subject line B/);

  const id = await newCampaign({ subject: 'Subject A', audience: { lists: [list] }, ab: { enabled: true, field: 'subject', subject_b: 'Subject B', test_pct: 20, metric: 'open', wait_hours: 4 } });
  batches = [];
  await post({ action: 'camp_start', id });
  const t = await post({ action: 'camp_tick', id });
  assert.equal(t.body.status, 'testing'); assert.equal(t.body.done, 20); assert.equal(t.body.held, 80);
  const sent = batches.flatMap((b) => b.body);
  assert.equal(sent.filter((m) => m.subject === 'Subject A').length, 10);
  assert.equal(sent.filter((m) => m.subject === 'Subject B').length, 10);
  // B gets more opens
  const bTokens = sent.filter((m) => m.subject === 'Subject B').slice(0, 6).map((m) => /pulse\?o=([0-9a-f]{32})/.exec(m.html)[1]);
  const aTokens = sent.filter((m) => m.subject === 'Subject A').slice(0, 2).map((m) => /pulse\?o=([0-9a-f]{32})/.exec(m.html)[1]);
  for (const tok of [...bTokens, ...aTokens]) await call(pulse, { method: 'GET', url: '/api/pulse?o=' + tok, headers: UA });
  // not time yet
  await runDue(2000);
  assert.equal((await get('view=campaign&id=' + id)).body.campaign.status, 'testing');
  let rep = (await get('view=campaign_report&id=' + id)).body;
  assert.equal(rep.ab.variants.b.open_rate, 60); assert.equal(rep.ab.variants.a.open_rate, 20);
  assert.ok(rep.ab.confidence != null);
  // the wait passes
  await getClient().execute({ sql: "UPDATE campaigns SET test_sent_at = datetime('now', '-5 hours') WHERE id = ?", args: [id] });
  batches = [];
  await runDue(10000);
  const after = (await get('view=campaign&id=' + id)).body.campaign;
  assert.equal(after.winner, 'b'); assert.equal(after.status, 'sent');
  const rest = batches.flatMap((b) => b.body);
  assert.equal(rest.length, 80); assert.ok(rest.every((m) => m.subject === 'Subject B'));
  rep = (await get('view=campaign_report&id=' + id)).body;
  assert.equal(rep.stats.sent, 100);
});

test('A/B test: choosing the winner by hand, and a content test', async () => {
  const list = (await post({ action: 'list_create', name: 'AB2' })).body.id;
  const rows = []; for (let i = 0; i < 20; i++) rows.push({ email: 'ac' + i + '@x.com' });
  await post({ action: 'audience_import', list_id: list, consent: 'opted_in', rows });
  const id = await newCampaign({ audience: { lists: [list] }, ab: { enabled: true, field: 'content', blocks_b: [{ type: 'text', text: 'Version B body' }], test_pct: 50, metric: 'click', wait_hours: 1 } });
  batches = [];
  await post({ action: 'camp_start', id });
  await post({ action: 'camp_tick', id });
  assert.equal(batches.flatMap((b) => b.body).filter((m) => /Version B body/.test(m.html)).length, 5);
  assert.equal((await post({ action: 'camp_winner', id, winner: 'b' })).body.winner, 'b');
  batches = [];
  await post({ action: 'camp_tick', id });
  const rest = batches.flatMap((b) => b.body);
  assert.equal(rest.length, 10); assert.ok(rest.every((m) => /Version B body/.test(m.html)));
  assert.equal((await post({ action: 'camp_winner', id, winner: 'a' })).code, 400);
});

test('test sends do not touch reports; preview, duplicate and templates; sales staff cannot send', async () => {
  const id = await newCampaign({ name: 'Tmpl', is_template: true });
  assert.match((await post({ action: 'camp_start', id })).body.error, /Templates/);
  const copy = await post({ action: 'camp_duplicate', id });
  const c = (await get('view=campaign&id=' + copy.body.id)).body.campaign;
  assert.equal(c.is_template, false); assert.equal(c.status, 'draft'); assert.equal(c.blocks.length, 3);
  batches = [];
  const t = await post({ action: 'camp_test', ...c, emails: ['seed@gmail.com', 'nope'] });
  assert.equal(t.body.sent, 1); assert.equal(batches.length, 1);
  assert.match(batches[0].body.subject, /^\[Test\]/); assert.doesNotMatch(batches[0].body.html, /api\/pulse/);
  assert.equal((await get('view=campaign_report&id=' + c.id)).body.stats.sent, 0);
  const p = await post({ action: 'camp_preview', ...c });
  assert.match(p.body.html, /Hello Alex/); assert.equal(p.body.subject, 'Hi Alex');
  // sales: read-only here
  const staff = await post({ action: 'team_create', name: 'Sal', email: 'sal@team.com', role: 'sales' });
  const login = await call(admin, { method: 'POST', body: { action: 'login', email: 'sal@team.com', password: staff.body.password }, ip: '50.0.0.1' });
  const H = { authorization: 'Bearer ' + sessionToken(login) };
  assert.ok(sessionToken(login), 'sales login works');
  for (const body of [{ action: 'camp_start', id: c.id }, { action: 'camp_save', name: 'Nope' }, { action: 'camp_settings' }, { action: 'audience_import', rows: [] }, { action: 'list_delete', id: 1 }, { action: 'suppression_remove', email: 'x@x.com' }]) {
    assert.equal((await call(admin, { method: 'POST', body, headers: H, ip: ip() })).code, 403, body.action);
  }
  assert.equal((await call(admin, { url: '/api/admin?view=campaign_report&id=' + c.id, headers: H, ip: ip() })).code, 200, 'can read reports');
});

test('the older broadcast skips suppressed subscribers; manual blocks can be lifted', async () => {
  await call(subscribe, { method: 'POST', body: { email: 'blocked@news.com', name: 'B' }, ip: '40.0.0.3' });
  await post({ action: 'suppression_add', emails: 'blocked@news.com, junk' });
  const list = (await get('view=suppressions&q=blocked')).body;
  assert.equal(list.total, 1);
  assert.equal((await post({ action: 'suppression_remove', email: 'blocked@news.com' })).code, 200, 'a manual block can be lifted');
  assert.equal((await get('view=suppressions&q=blocked')).body.total, 0);
  await post({ action: 'suppression_add', emails: 'blocked@news.com' });
  const s = (await post({ action: 'camp_audience', audience: { subscribers: true } })).body;
  assert.ok(s.excluded >= 1); assert.ok(s.matched >= s.total);
  batches = [];
  const b = await post({ action: 'broadcast', subject: 'News', body: 'Hello everyone' });
  assert.equal(b.code, 200, JSON.stringify(b.body));
  const to = batches.flatMap((x) => (Array.isArray(x.body) ? x.body : [x.body])).flatMap((m) => m.to);
  assert.ok(to.includes('sub@news.com'), 'an active subscriber still gets it');
  assert.ok(!to.includes('blocked@news.com'));
});
