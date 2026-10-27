// Phase 5: vendor pitches (people selling to us) are kept but filtered out of leads, counts and alerts;
// monthly leads-by-channel report.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { call, cleanup, ADMIN, sessionToken } from './helpers.mjs';
import admin from '../api/admin.js';
import contact from '../api/contact.js';
import { getClient, saveSubmission } from '../lib/db.js';
import { detectPitch, intentLabel, INTENTS } from '../lib/pitch.js';
import { channelOf, getMonthlyLeads, leadsReportTemplate } from '../lib/analytics-report.js';
import fs from 'node:fs';

after(cleanup);
let ipN = 0;
const ip = () => '50.0.' + Math.floor(++ipN / 200) + '.' + (ipN % 200);
const get = (q) => call(admin, { url: '/api/admin?' + q, headers: ADMIN, ip: ip() });
const post = (b) => call(admin, { method: 'POST', body: b, headers: ADMIN, ip: ip() });
const send = (body) => call(contact, { method: 'POST', ip: ip(), body: { country: 'United States', industry: 'Retail', ...body } });
const statsOf = (r) => r.body.stats || r.body;

const PITCHES = [
  'Hi, we provide high quality guest posts on DA 50+ sites. Are you interested?',
  'Our agency offers white label development for agencies like yours at low rates.',
  'I noticed errors on your website that are hurting your Google ranking. We can get you to the first page of Google.',
  "I'm a freelance WordPress developer with 6 years of experience. My rates start at $15/hour.",
  'We can bring more traffic to your website with our SEO packages. Reply for a free audit of your site.',
  'Hire our dedicated developers in India, outsourcing at 60% lower cost.',
  'I am looking for a job as a junior web developer, please find my CV.',
  'We offer lead generation services and appointment setting campaigns for agencies.',
  'Hello, I noticed several errors on your website. Can I send you the report?',
  'We analyzed your website and it loads slowly on mobile. Shall I send details?'
];
const LEADS = [
  'We need a new website for our law firm in Chicago. What would it cost?',
  'Our Shopify store is slow and we want it faster before Black Friday. Budget around $3k.',
  'I would like a quote for a booking web app for my clinic.',
  'Can you redesign our restaurant site? We are interested in online ordering too.',
  'I need SEO help, we want to rank higher on Google for our plumbing business.',
  'Looking for a partner to build our SaaS MVP. We have funding.',
  'Hello, how much does it cost to build an e-commerce site with about 200 products?',
  'Our company website was built in 2015 and needs a refresh. We are in Toronto.',
  'Looking for a position on the first page of Google for my bakery.',
  'I found your website on Google. Can you call me tomorrow about a project?',
  'I checked your website and love your work. Can you build something similar for us?'
];

test('detector: catches sales pitches, never real client enquiries', () => {
  for (const m of PITCHES) assert.ok(detectPitch({ message: m }).pitch, 'pitch missed: ' + m);
  for (const m of LEADS) assert.ok(!detectPitch({ message: m }).pitch, 'false positive: ' + m);
  assert.ok(detectPitch({ message: 'Hello', intent: INTENTS.offering }).pitch, 'the "offering" choice is a pitch');
  assert.ok(detectPitch({ message: PITCHES[0] }).reasons.length > 0, 'a reason is given');
});

test('intent: only known choices are stored (as their label)', () => {
  assert.equal(intentLabel('ecommerce'), 'An online store');
  assert.equal(intentLabel('An online store'), 'An online store');
  assert.equal(intentLabel('<script>'), '');
  assert.equal(intentLabel(''), '');
});

test('contact form: a pitch is saved as vendor, a lead as new, with the intent', async () => {
  assert.equal((await send({ name: 'Real Client', email: 'client@example.com', intent: 'new-website', message: LEADS[0] })).code, 200);
  assert.equal((await send({ name: 'SEO Seller', email: 'seller@example.com', intent: 'seo-speed', message: PITCHES[0] })).code, 200);
  assert.equal((await send({ name: 'Partner Pitch', email: 'partner@example.com', intent: 'offering', message: 'Hello there, quick question for you' })).code, 200);
  const rows = (await getClient().execute('SELECT name, status, intent, pitch_reason FROM submissions ORDER BY id')).rows;
  const by = Object.fromEntries(rows.map((r) => [r.name, r]));
  assert.equal(by['Real Client'].status, 'new');
  assert.equal(by['Real Client'].intent, 'A new website');
  assert.equal(by['Real Client'].pitch_reason, '');
  assert.equal(by['SEO Seller'].status, 'vendor');
  assert.match(by['SEO Seller'].pitch_reason, /links or guest posts/i);
  assert.equal(by['Partner Pitch'].status, 'vendor');
  assert.equal(by['Partner Pitch'].intent, "I'm offering services / partnership");
});

test('CRM: vendor pitches are out of All, counts and stats; listed under their own filter', async () => {
  const all = await get('limit=50');
  assert.deepEqual(all.body.submissions.map((s) => s.name), ['Real Client']);
  assert.equal(all.body.total, 1);
  const v = await get('limit=50&status=vendor');
  assert.equal(v.body.total, 2);
  assert.ok(v.body.submissions.every((s) => s.status === 'vendor' && s.pitch_reason));
  assert.equal(statsOf(await get('stats=true')).total, 1, 'dashboard total excludes vendor pitches');
});

test('"Not a pitch" restores a lead; marking a pitch by hand gives a reason', async () => {
  const seller = (await get('limit=50&status=vendor')).body.submissions.find((s) => s.name === 'SEO Seller');
  assert.equal((await post({ action: 'set_status', id: seller.id, status: 'new' })).code, 200);
  let row = (await getClient().execute({ sql: 'SELECT status, pitch_reason FROM submissions WHERE id = ?', args: [seller.id] })).rows[0];
  assert.equal(row.status, 'new');
  assert.equal(row.pitch_reason, '');
  assert.equal((await get('limit=50')).body.total, 2);
  assert.equal((await post({ action: 'set_status', id: seller.id, status: 'vendor' })).code, 200);
  row = (await getClient().execute({ sql: 'SELECT status, pitch_reason FROM submissions WHERE id = ?', args: [seller.id] })).rows[0];
  assert.equal(row.status, 'vendor');
  assert.equal(row.pitch_reason, 'Marked as a pitch in the CRM');
});

test('scan_pitches tags older New leads only, and only pitches', async () => {
  await saveSubmission({ name: 'Old Pitch', email: 'old1@example.com', message: PITCHES[1] });
  await saveSubmission({ name: 'Old Lead', email: 'old2@example.com', message: LEADS[1] });
  await saveSubmission({ name: 'Worked Pitch', email: 'old3@example.com', message: PITCHES[3] });
  await getClient().execute("UPDATE submissions SET status = 'contacted' WHERE name = 'Worked Pitch'");
  const r = await post({ action: 'scan_pitches' });
  assert.equal(r.code, 200);
  assert.deepEqual(r.body.tagged.map((t) => t.name), ['Old Pitch']);
  const st = Object.fromEntries((await getClient().execute('SELECT name, status FROM submissions')).rows.map((x) => [x.name, x.status]));
  assert.equal(st['Old Lead'], 'new');
  assert.equal(st['Worked Pitch'], 'contacted', 'leads someone already worked are left alone');
  assert.equal((await post({ action: 'scan_pitches' })).body.tagged.length, 0, 'running it again changes nothing');
});

test('scan_pitches is owner/admin only', async () => {
  const pw = (await post({ action: 'team_create', email: 'rep@cleverstack.test', name: 'Rep', role: 'sales' })).body.password;
  const t = sessionToken(await call(admin, { method: 'POST', body: { action: 'login', email: 'rep@cleverstack.test', password: pw }, ip: ip() }));
  assert.equal((await call(admin, { method: 'POST', body: { action: 'scan_pitches' }, headers: { authorization: 'Bearer ' + t }, ip: ip() })).code, 403);
});

test('channels: ads, search, AI, social, referral and direct are told apart', () => {
  assert.equal(channelOf({ utm_source: 'google', utm_medium: 'cpc' }), 'Google Ads');
  assert.equal(channelOf({ utm_source: 'facebook', utm_medium: 'paid_social' }), 'Meta ads');
  assert.equal(channelOf({}, { referrer: 'www.google.com' }), 'Google search');
  assert.equal(channelOf({}, { referrer: 'www.google.co.uk' }), 'Google search');
  assert.equal(channelOf({}, { referrer: 'bing.com' }), 'Other search engines');
  assert.equal(channelOf({}, { referrer: 'chatgpt.com' }), 'AI assistants');
  assert.equal(channelOf({ utm_source: 'chatgpt.com' }), 'AI assistants');
  assert.equal(channelOf({}, { referrer: 'linkedin.com' }), 'Social media');
  assert.equal(channelOf({}, { referrer: 'clutch.co' }), 'Other websites');
  assert.equal(channelOf({}, null), 'Direct / unknown');
});

test('monthly report: last calendar month, real leads by channel, vendor pitches counted apart', async () => {
  const db = getClient();
  await db.execute('DELETE FROM submissions');
  const add = (status, src, med, at) => db.execute({ sql: 'INSERT INTO submissions (name, email, message, status, utm_source, utm_medium, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)', args: ['N', 'n@x.test', 'm', status, src, med, at] });
  await add('new', 'google', 'cpc', '2026-09-03 10:00:00');
  await add('won', 'google', 'cpc', '2026-09-20 10:00:00');
  await add('new', '', '', '2026-09-30 23:59:59');
  await add('vendor', '', '', '2026-09-10 10:00:00');
  await add('new', 'facebook', 'paid', '2026-08-15 10:00:00');
  await add('new', 'google', 'cpc', '2026-10-01 00:00:00'); // this month: not in the report
  const d = await getMonthlyLeads(Date.UTC(2026, 9, 1, 0, 15));
  assert.equal(d.month, 'September 2026');
  assert.equal(d.leads, 3);
  assert.equal(d.won, 1);
  assert.equal(d.vendor, 1);
  assert.equal(d.current['Google Ads'], 2);
  assert.equal(d.current['Direct / unknown'], 1);
  assert.equal(d.previous['Meta ads'], 1);
  const html = leadsReportTemplate(d);
  assert.match(html, /SEO and leads: September 2026/);
  assert.match(html, /1 vendor pitch was filtered/);
});

test('contact form asks what they need (required) and sends it', () => {
  const html = fs.readFileSync(new URL('../contact.html', import.meta.url), 'utf8');
  const sel = html.match(/<select id="intent" name="intent" required>([\s\S]*?)<\/select>/);
  assert.ok(sel, 'required intent select');
  const values = [...sel[1].matchAll(/value="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(values, Object.keys(INTENTS));
  assert.match(fs.readFileSync(new URL('../script.js', import.meta.url), 'utf8'), /intent:\(C\.querySelector\('\[name="intent"\]'\)/);
  const i18n = fs.readFileSync(new URL('../i18n.js', import.meta.url), 'utf8');
  assert.equal(i18n.split('"contact.form.intent":').length - 1, 3, 'label in en, fr and de');
});

test('search console: signs in with the service account, falls back to the URL property, tracks our phrases', async () => {
  const { mockFetch } = await import('./helpers.mjs');
  const crypto = await import('node:crypto');
  const { getSearchMonth } = await import('../lib/search-console.js');
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  process.env.GSC_CLIENT_EMAIL = 'report@test.iam.gserviceaccount.com';
  process.env.GSC_PRIVATE_KEY = privateKey.export({ type: 'pkcs8', format: 'pem' }).replace(/\n/g, '\n'); // as pasted in Vercel
  const sitesAsked = [];
  const restore = mockFetch(async (url, opts) => {
    const ok = (o) => ({ ok: true, status: 200, json: async () => o });
    if (url === 'https://oauth2.googleapis.com/token') {
      const jwt = decodeURIComponent(String(opts.body).match(/assertion=([^&]+)/)[1]).split('.');
      const claim = JSON.parse(Buffer.from(jwt[1], 'base64url'));
      assert.equal(claim.iss, 'report@test.iam.gserviceaccount.com');
      assert.match(claim.scope, /webmasters\.readonly$/, 'read-only access');
      assert.ok(crypto.createVerify('RSA-SHA256').update(jwt[0] + '.' + jwt[1]).verify(publicKey, Buffer.from(jwt[2], 'base64url')), 'valid signature');
      return ok({ access_token: 'tok' });
    }
    const site = decodeURIComponent(url.split('/sites/')[1].split('/')[0]);
    sitesAsked.push(site);
    assert.equal(opts.headers.Authorization, 'Bearer tok');
    if (site === 'sc-domain:cleverstack.dev') return { ok: false, status: 403, json: async () => ({ error: { message: 'no access' } }) };
    const b = JSON.parse(opts.body), dim = (b.dimensions || [])[0];
    if (!dim) return ok({ rows: [b.startDate === '2026-09-01' ? { clicks: 40, impressions: 2000, ctr: 0.02, position: 18.24 } : { clicks: 20, impressions: 1000, ctr: 0.02, position: 25 }] });
    if (dim === 'query') return ok({ rows: [
      { keys: ['shopify developer uk'], clicks: 5, impressions: 300, position: 8 },
      { keys: ['hire shopify developer'], clicks: 1, impressions: 100, position: 12 },
      { keys: ['cleverstack'], clicks: 20, impressions: 50, position: 1 }] });
    if (dim === 'page') return ok({ rows: [{ keys: ['https://cleverstack.dev/services'], clicks: 9, impressions: 400 }, { keys: ['https://cleverstack.dev/'], clicks: 2, impressions: 90 }] });
    return ok({ rows: [{ keys: ['usa'], clicks: 10, impressions: 900 }, { keys: ['gbr'], clicks: 6, impressions: 500 }] });
  });
  try {
    const s = await getSearchMonth({ start: '2026-09-01', end: '2026-09-30' }, { start: '2026-08-01', end: '2026-08-31' });
    assert.equal(s.site, 'https://cleverstack.dev/');
    assert.equal(sitesAsked[0], 'sc-domain:cleverstack.dev');
    assert.equal(s.current.clicks, 40);
    assert.equal(s.previous.clicks, 20);
    assert.equal(s.current.position, 18.2);
    const shop = s.tracked.find((t) => t.phrase === 'shopify developer');
    assert.equal(shop.impressions, 400);
    assert.equal(shop.position, 9, 'impression-weighted (8x300 + 12x100) / 400');
    assert.equal(s.tracked.find((t) => t.phrase === 'website slow').seen, false);
    assert.equal(s.page1, 2, 'shopify developer (9) and cleverstack (1)');
    assert.deepEqual(s.pages.map((p) => p.page), ['/services', '/']);
    assert.deepEqual(s.countries.map((c) => c.country), ['United States', 'United Kingdom']);
    const html = leadsReportTemplate({ month: 'September 2026', previousMonth: 'August 2026', current: {}, previous: {}, leads: 0, previousLeads: 0, won: 0, vendor: 0, search: s });
    assert.match(html, /Tracked phrases/);
    assert.match(html, /shopify developer/);
    assert.match(html, /Not showing yet: .*website slow/);
  } finally {
    restore();
    delete process.env.GSC_CLIENT_EMAIL; delete process.env.GSC_PRIVATE_KEY;
  }
  const off = leadsReportTemplate({ month: 'September 2026', previousMonth: 'August 2026', current: {}, previous: {}, leads: 0, previousLeads: 0, won: 0, vendor: 0 });
  assert.match(off, /Search Console is not connected yet/);
});
