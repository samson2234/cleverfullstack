// FR: A/B tests — safe definitions, public config shows only running tests, results and confidence are correct.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { call, cleanup, ADMIN } from './helpers.mjs';
import pulse from '../api/pulse.js';
import admin from '../api/admin.js';
import { confidence, validTest } from '../lib/ab.js';
import { recordEvents } from '../lib/analytics.js';

after(cleanup);
const CHROME = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';

test('confidence: identical rates ~0%, a big real difference ~100%', () => {
  assert.equal(confidence(1000, 50, 1000, 50), 0);
  assert.ok(confidence(1000, 50, 1000, 100) > 99.9);
  assert.ok(confidence(20, 1, 20, 2) < 70, 'tiny samples are not significant');
  assert.equal(confidence(0, 0, 10, 1), 0);
});

test('only safe, simple tests can be created', () => {
  const ok = { name: 'x', page: '/', selector: '.hero .hero-sub', text_b: 'Hi', goal: 'lead' };
  assert.equal(validTest(ok), '');
  assert.notEqual(validTest({ ...ok, selector: 'a[href^="javascript"]' }), '');
  assert.notEqual(validTest({ ...ok, page: 'https://evil.example/' }), '');
  assert.notEqual(validTest({ ...ok, goal: 'nope' }), '');
  assert.notEqual(validTest({ ...ok, text_b: '' }), '');
});

test('running tests are public (without names); results count exposures and conversions per version', async () => {
  const c = await call(admin, { method: 'POST', headers: ADMIN, body: { action: 'ab_create', name: 'Secret name', page: '/', selector: '.hero .hero-sub', text_b: 'Version B', goal: 'lead' } });
  assert.equal(c.code, 200);
  const id = c.body.id;
  const cfg = await call(pulse, { method: 'GET', url: '/api/pulse?ab=1' });
  assert.equal(cfg.code, 200);
  assert.deepEqual(cfg.body.tests, [{ id, page: '/', sel: '.hero .hero-sub', b: 'Version B' }]);
  assert.ok(!JSON.stringify(cfg.body).includes('Secret name'));

  // 3 sessions saw A (1 converted), 2 saw B (2 converted); a lead BEFORE exposure must not count
  const ctx = { ip: '7.7.7.7', ua: CHROME, ownHosts: ['cleverfullstack.vercel.app'] };
  const t0 = Date.now() - 60000;
  const ev = (s, e, dt) => recordEvents({ s, e }, { ...ctx, now: t0 + dt });
  await ev('sa1', [{ t: 'lead', p: '/contact' }], 0);
  await ev('sa1', [{ t: 'exp', p: '/', tg: String(id), k: 'a' }], 1000);
  await ev('sa2', [{ t: 'exp', p: '/', tg: String(id), k: 'a' }], 1000);
  await ev('sa3', [{ t: 'exp', p: '/', tg: String(id), k: 'a' }], 1000);
  await ev('sa3', [{ t: 'lead', p: '/contact' }], 5000);
  await ev('sb1', [{ t: 'exp', p: '/', tg: String(id), k: 'b' }], 1000);
  await ev('sb1', [{ t: 'lead', p: '/services' }], 5000);
  await ev('sb2', [{ t: 'exp', p: '/', tg: String(id), k: 'b' }], 1000);
  await ev('sb2', [{ t: 'lead', p: '/contact' }], 5000);

  const r = await call(admin, { url: '/api/admin?view=ab_tests', headers: ADMIN });
  const t = r.body.tests.find((x) => x.id === id);
  assert.deepEqual({ a: [t.a.sessions, t.a.conversions], b: [t.b.sessions, t.b.conversions] }, { a: [3, 1], b: [2, 2] });
  assert.equal(t.enough, false);
  assert.equal(t.winner, '');

  await call(admin, { method: 'POST', headers: ADMIN, body: { action: 'ab_status', id, status: 'paused' } });
  assert.deepEqual((await call(pulse, { method: 'GET', url: '/api/pulse?ab=1' })).body.tests, [], 'paused tests stop showing');
});
