// NFR: reliability & scalability under concurrency, cold starts and dependency failures
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { call, cleanup, ADMIN, mockFetch } from './helpers.mjs';
import { getClient, saveSubmission } from '../lib/db.js';
import { listContacts } from '../lib/contacts.js';
import { rateLimit } from '../lib/rate-limit.js';
import { sendResendEmail } from '../lib/email.js';
import admin from '../api/admin.js';
import contact from '../api/contact.js';
import reviews from '../api/reviews.js';

after(cleanup);
const post = (b) => call(admin, { method: 'POST', body: b, headers: ADMIN });

test('cold-start race: 25 simultaneous first requests on a database with legacy data all succeed', async () => {
  // Legacy rows exist BEFORE any CRM table does; then a traffic spike hits a fresh instance.
  await saveSubmission({ name: 'Legacy One', email: 'legacy1@example.com', message: 'old enquiry one' });
  await saveSubmission({ name: 'Legacy Two', email: 'legacy2@example.com', message: 'old enquiry two' });
  const results = await Promise.allSettled(Array.from({ length: 25 }, () => listContacts({ limit: 10 })));
  const failed = results.filter((r) => r.status === 'rejected');
  assert.equal(failed.length, 0, failed.map((f) => f.reason && f.reason.message).join('; '));
  assert.equal(results[0].value.total, 2, 'backfilled exactly once, no duplicates');
});

test('50 concurrent enquiries from the same person produce exactly one contact', async () => {
  const rs = await Promise.all(Array.from({ length: 50 }, (_, i) =>
    call(contact, { method: 'POST', ip: `50.0.${i}.1`, body: { name: 'Burst Person', email: 'burst@example.com', message: 'Burst enquiry number ' + i } })));
  assert.ok(rs.every((r) => r.code === 200), 'all accepted: ' + rs.map((r) => r.code).join(','));
  const n = (await getClient().execute("SELECT COUNT(*) AS n FROM contacts WHERE email = 'burst@example.com'")).rows[0].n;
  assert.equal(Number(n), 1);
  const subs = (await getClient().execute("SELECT COUNT(*) AS n FROM submissions WHERE email = 'burst@example.com'")).rows[0].n;
  assert.equal(Number(subs), 50, 'every submission is still recorded');
});

test('a review link raced by 30 simultaneous submits publishes exactly one review', async () => {
  const inv = await post({ action: 'create_invite', client_name: 'Race Client' });
  const token = new URL(inv.body.link).searchParams.get('t');
  const rs = await Promise.all(Array.from({ length: 30 }, (_, i) =>
    call(reviews, { method: 'POST', ip: `60.0.${i}.1`, body: { token, name: 'Race Client', rating: 5, body: 'Racing the one-time link, attempt ' + i } })));
  assert.equal(rs.filter((r) => r.code === 200).length, 1);
  assert.equal(rs.filter((r) => r.code === 410).length, 29);
  const n = (await getClient().execute("SELECT COUNT(*) AS n FROM reviews WHERE author_name = 'Race Client'")).rows[0].n;
  assert.equal(Number(n), 1);
});

test('rate limiter (in-memory): blocks after the limit, buckets are per-endpoint and per-IP', async () => {
  const req = (ip) => ({ headers: { 'x-forwarded-for': ip }, socket: {} });
  for (let i = 0; i < 3; i++) assert.equal((await rateLimit(req('70.0.0.1'), { limit: 3, windowMs: 60000, key: 'a' })).allowed, true);
  assert.equal((await rateLimit(req('70.0.0.1'), { limit: 3, windowMs: 60000, key: 'a' })).allowed, false);
  assert.equal((await rateLimit(req('70.0.0.1'), { limit: 3, windowMs: 60000, key: 'b' })).allowed, true, 'other endpoint unaffected');
  assert.equal((await rateLimit(req('70.0.0.2'), { limit: 3, windowMs: 60000, key: 'a' })).allowed, true, 'other IP unaffected');
});

test('rate limiter (shared Redis): enforces the limit across instances when Upstash is configured', async () => {
  process.env.UPSTASH_REDIS_REST_URL = 'https://redis.example';
  process.env.UPSTASH_REDIS_REST_TOKEN = 'tok';
  let count = 0;
  const restore = mockFetch(async (url, init) => {
    assert.match(String(url), /\/pipeline$/);
    count += 1; // as if other instances had already used some of the allowance
    return { ok: true, json: async () => [{ result: count }, { result: 1 }, { result: 42 }] };
  });
  try {
    const req = { headers: { 'x-forwarded-for': '71.0.0.1' }, socket: {} };
    assert.equal((await rateLimit(req, { limit: 2, windowMs: 60000, key: 'shared' })).allowed, true);
    assert.equal((await rateLimit(req, { limit: 2, windowMs: 60000, key: 'shared' })).allowed, true);
    const blocked = await rateLimit(req, { limit: 2, windowMs: 60000, key: 'shared' });
    assert.equal(blocked.allowed, false);
    assert.equal(blocked.retryAfter, 42);
  } finally { restore(); delete process.env.UPSTASH_REDIS_REST_URL; delete process.env.UPSTASH_REDIS_REST_TOKEN; }
});

test('rate limiter fails OPEN to memory if Redis is down (visitors are never locked out by an outage)', async () => {
  process.env.UPSTASH_REDIS_REST_URL = 'https://redis.example';
  process.env.UPSTASH_REDIS_REST_TOKEN = 'tok';
  const restore = mockFetch(async () => { throw new Error('ECONNREFUSED'); });
  try {
    const req = { headers: { 'x-forwarded-for': '72.0.0.1' }, socket: {} };
    assert.equal((await rateLimit(req, { limit: 1, windowMs: 60000, key: 'down' })).allowed, true);
    assert.equal((await rateLimit(req, { limit: 1, windowMs: 60000, key: 'down' })).allowed, false, 'memory limiter still protects');
  } finally { restore(); delete process.env.UPSTASH_REDIS_REST_URL; delete process.env.UPSTASH_REDIS_REST_TOKEN; }
});

test('a hung email provider is cut off with a timeout instead of pinning the function', async () => {
  process.env.RESEND_API_KEY = 're_test';
  const restore = mockFetch((url, init) => new Promise((_, reject) => {
    init.signal.addEventListener('abort', () => { const e = new Error('timed out'); e.name = 'TimeoutError'; reject(e); });
  }));
  try {
    const t = Date.now();
    const r = await sendResendEmail({ to: 'a@b.co', subject: 's', html: 'h' });
    assert.equal(r.ok, false);
    assert.match(r.error, /timed out/i);
    assert.ok(Date.now() - t < 12000, 'returned within the timeout budget');
  } finally { restore(); delete process.env.RESEND_API_KEY; }
});

test('the contact form still succeeds (and the lead is saved) when email delivery fails', async () => {
  process.env.RESEND_API_KEY = 're_test';
  const restore = mockFetch(async () => { throw new Error('network down'); });
  try {
    const r = await call(contact, { method: 'POST', ip: '73.0.0.1', body: { name: 'Resilient Lead', email: 'resilient@example.com', message: 'Is the site still taking leads?' } });
    assert.equal(r.code, 200);
    const n = (await getClient().execute("SELECT COUNT(*) AS n FROM contacts WHERE email = 'resilient@example.com'")).rows[0].n;
    assert.equal(Number(n), 1);
  } finally { restore(); delete process.env.RESEND_API_KEY; }
});
