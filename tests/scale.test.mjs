// NFR: performance budgets at CRM scale (10,000 contacts). Run with: npm run test:scale
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { call, cleanup, ADMIN } from './helpers.mjs';
import admin from '../api/admin.js';

after(cleanup);
const get = (q) => call(admin, { url: '/api/admin?' + q, headers: ADMIN });
const post = (b) => call(admin, { method: 'POST', body: b, headers: ADMIN });
const BUDGET_MS = 500; // generous: local SQLite; production Turso adds network latency but the queries are index-backed

test('import 10,000 contacts in batches', async () => {
  const kinds = ['lead', 'prospect', 'client', 'past_client', 'partner'];
  const countries = ['United States', 'Canada', 'United Kingdom', 'Germany', 'Australia', 'Netherlands'];
  const rows = Array.from({ length: 10000 }, (_, i) => ({
    name: 'Person ' + i, email: `person${i}@mail${i % 97}.com`, company: 'Company ' + (i % 500),
    country: countries[i % 6], industry: 'Industry ' + (i % 20), kind: kinds[i % 5], tags: i % 10 === 0 ? 'vip' : ''
  }));
  let created = 0;
  for (let i = 0; i < rows.length; i += 2500) created += (await post({ action: 'contact_import', rows: rows.slice(i, i + 2500) })).body.created;
  assert.equal(created, 10000);
});

for (const [name, q] of [
  ['list page 1', 'view=contacts&limit=50'],
  ['text search', 'view=contacts&q=person9999'],
  ['kind + country filter, deep page', 'view=contacts&kind=client&country=Canada&limit=50&offset=100'],
  ['tag filter', 'view=contacts&tag=vip&limit=50'],
  ['inactive filter', 'view=contacts&inactive_days=90&limit=50'],
  ['stats', 'view=contact_stats']
]) {
  test(`query stays under ${BUDGET_MS} ms: ${name}`, async () => {
    const t = Date.now();
    const r = await get(q);
    const ms = Date.now() - t;
    assert.equal(r.code, 200);
    assert.ok(ms < BUDGET_MS, `${name} took ${ms} ms`);
  });
}

test('campaign recipient count over 10,000 contacts stays under budget', async () => {
  const t = Date.now();
  const r = await post({ action: 'campaign_preview', campaign: 'Scale Check', filters: { kind: 'past_client' } });
  assert.equal(r.body.total, 2000);
  assert.ok(Date.now() - t < BUDGET_MS * 2);
});
