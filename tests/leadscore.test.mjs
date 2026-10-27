// FR: lead scoring — explainable, deterministic, uses budget/ROI/journey; hot leads flagged in the owner email.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { call, cleanup, ADMIN, mockFetch } from './helpers.mjs';
import { scoreLead, parseBudget, parseRoiProfit, countryCode, HOT, WARM } from '../lib/lead-score.js';
import { recordEvents } from '../lib/analytics.js';
import contact from '../api/contact.js';
import admin from '../api/admin.js';

after(cleanup);
const CHROME = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';

test('parsers read the budget planner and ROI calculator messages', () => {
  assert.deepEqual(parseBudget('Budget planner request\nBudget: 1,800 GBP\nBudget type: Starting budget (flexible)'), { amount: 1800, currency: 'GBP', usd: 2286, flexible: true });
  assert.equal(parseBudget('no budget here'), null);
  assert.equal(parseRoiProfit('... -> extra revenue $3,240/month, extra profit $1,134/month, pays for itself'), 1134);
  assert.equal(countryCode('United Kingdom'), 'GB');
  assert.equal(countryCode('de'), 'DE');
});

test('scores are explainable, bounded and rank a strong lead above a weak one', () => {
  const strong = scoreLead({ name: 'Ada', email: 'ada@adabakes.co.uk', phone: '+44 20 1234', company: 'Ada Bakes', country: 'United Kingdom', source: 'budget-planner',
    message: 'Budget planner request\nBudget: 3,000 GBP\nBudget type: Starting budget (flexible)\nNeeds: An online store\n\nDetails:\nWe want to launch next week.' },
    { pages: 6, engagedSec: 300, explored: true, intentClicks: 1, paid: true });
  const weak = scoreLead({ name: 'X', email: 'x@gmail.com', source: 'contact form', message: 'hi' }, null);
  assert.ok(strong.score >= HOT && strong.tier === 'hot', 'strong lead is hot: ' + strong.score);
  assert.ok(weak.score < WARM && weak.tier === 'cold', 'weak lead is cold: ' + weak.score);
  assert.ok(strong.score <= 100);
  assert.equal(strong.reasons.reduce((a, r) => a + r.pts, 0) >= strong.score, true);
  assert.ok(strong.reasons.every((r) => r.why && r.pts > 0));
  assert.ok(strong.reasons.some((r) => /Viewed 6 pages/.test(r.why)));
});

test('a form post is linked to the visit and the CRM shows its score; hot leads get a 🔥 subject', async () => {
  // the visitor browsed first (session "visit1"): 4 pages incl. services, a booking click, 3 minutes
  const ctx = { ip: '5.5.5.5', ua: CHROME, country: 'US', ownHosts: ['cleverfullstack.vercel.app'] };
  for (const p of ['/', '/services', '/portfolio', '/contact']) await recordEvents({ s: 'visit1', e: [{ t: 'pageview', p, pid: 'x' + p.length }] }, ctx);
  await recordEvents({ s: 'visit1', e: [{ t: 'click', p: '/', tg: 'Book a Call', k: 'booking' }, { t: 'engage', p: '/services', pid: 'x9', v: 180000, dp: 90 }] }, ctx);

  process.env.RESEND_API_KEY = 're_test';
  const sent = [];
  const restore = mockFetch(async (url, opts) => { if (String(url).includes('resend')) sent.push(JSON.parse(opts.body)); return new Response('{"id":"1"}', { status: 200 }); });
  try {
    const r = await call(contact, { method: 'POST', ip: '30.0.0.1', body: { name: 'Big Buyer', email: 'owner@bigbuyer.com', phone: '+1 555 0100', company: 'Big Buyer Inc', country: 'United States',
      message: 'Budget planner request\nBudget: 4,000 USD\nBudget type: Maximum budget (fixed)\nNeeds: A new business website', source: 'budget-planner', _asid: 'visit1' } });
    assert.equal(r.code, 200);
    const owner = sent.find((m) => /HOT lead/.test(m.subject));
    assert.ok(owner, 'owner email flagged hot: ' + sent.map((m) => m.subject).join(' | '));
    assert.match(owner.html, /Lead score \d+\/100/);
    assert.match(owner.html, /Viewed 4 pages/);
  } finally { restore(); delete process.env.RESEND_API_KEY; }

  const cold = await call(contact, { method: 'POST', ip: '30.0.0.2', body: { name: 'Small Ask', email: 'a@gmail.com', message: 'hello there', source: 'contact form' } });
  assert.equal(cold.code, 200);

  const list = await call(admin, { url: '/api/admin?limit=10&sort=score', headers: ADMIN });
  assert.equal(list.code, 200);
  const [first, second] = list.body.submissions;
  assert.equal(first.name, 'Big Buyer');
  assert.equal(first.tier, 'hot');
  assert.equal(first.journey.pages, 4);
  assert.equal(first.journey.landing, '/', 'first page of the visit');
  assert.deepEqual(first.journey.path, ['/', '/services', '/portfolio', '/contact'], 'pages read, in order');
  assert.equal(first.journey.referrer, '', 'no referrer = direct');
  assert.ok(first.score > second.score);
  const hot = await call(admin, { url: '/api/admin?limit=10&tier=hot', headers: ADMIN });
  assert.deepEqual(hot.body.submissions.map((s) => s.name), ['Big Buyer']);
  const one = await call(admin, { method: 'POST', body: { action: 'get', id: first.id }, headers: ADMIN });
  assert.ok(one.body.submission.score_reasons.length > 3);
});
