// FR: unified CRM (contacts, timeline, filters, import/export, backfill from legacy submissions)
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { call, cleanup, ADMIN } from './helpers.mjs';
import admin from '../api/admin.js';
import contact from '../api/contact.js';
import { getClient, saveSubmission } from '../lib/db.js';

after(cleanup);
const get = (q) => call(admin, { url: '/api/admin?' + q, headers: ADMIN });
const post = (b) => call(admin, { method: 'POST', body: b, headers: ADMIN });
let ipN = 0;
const freshIp = () => '30.0.0.' + (++ipN);
let freshId;

test('legacy submissions are backfilled: same email (any case) => one contact; won => client', async () => {
  await saveSubmission({ name: 'Old Lead', email: 'Old@Example.com', phone: '+1 555', country: 'United States', company: 'Old Co', industry: 'Retail', message: 'Hi there, legacy enquiry' });
  await saveSubmission({ name: 'Old Lead', email: 'old@example.com', message: 'Second enquiry, same person' });
  await getClient().execute("UPDATE submissions SET status='won' WHERE id=1");
  const r = await get('view=contact_stats');
  assert.equal(r.body.total, 1);
  assert.equal(r.body.byKind.client, 1);
});

test('a new contact-form post creates a lead with a timeline entry', async () => {
  const r = await call(contact, { method: 'POST', ip: freshIp(), body: { name: 'Fresh Lead', email: 'fresh@example.com', message: 'We need a new website please', country: 'Canada', industry: 'Law' } });
  assert.equal(r.code, 200);
  const l = await get('view=contacts&q=fresh');
  assert.equal(l.body.total, 1);
  assert.equal(l.body.rows[0].kind, 'lead');
  freshId = l.body.rows[0].id;
  const d = await get('view=contact&id=' + freshId);
  assert.equal(d.body.activities[0].type, 'form');
  assert.equal(d.body.submissions.length, 1);
});

test('repeat enquiry never duplicates and never downgrades a client', async () => {
  await post({ action: 'contact_update', id: freshId, kind: 'client' });
  await call(contact, { method: 'POST', ip: freshIp(), body: { name: 'Fresh Lead', email: 'FRESH@example.com', message: 'Another question about hosting' } });
  const s = await get('view=contact_stats');
  assert.equal(s.body.total, 2);
  const d = await get('view=contact&id=' + freshId);
  assert.equal(d.body.contact.kind, 'client');
  assert.ok(d.body.activities.some((a) => a.type === 'status'), 'kind change is logged');
});

test('create validates input and rejects duplicate emails', async () => {
  const ok = await post({ action: 'contact_create', name: 'Manual Person', email: 'manual@example.com', kind: 'past_client', tags: 'Fiverr, VIP, vip', country: 'United Kingdom', lifetime_value: '1200' });
  assert.equal(ok.code, 200);
  assert.equal((await post({ action: 'contact_create', name: 'Dup', email: 'MANUAL@example.com' })).code, 409);
  assert.equal((await post({ action: 'contact_create', name: 'X', email: 'bad' })).code, 400);
});

test('filters: tag (normalised + deduped), kind, country; archived are hidden', async () => {
  const t = await get('view=contacts&tag=vip');
  assert.equal(t.body.total, 1);
  assert.equal(t.body.rows[0].tags, 'fiverr,vip');
  assert.equal((await get('view=contacts&kind=past_client')).body.total, 1);
  assert.equal((await get('view=contacts&country=United%20Kingdom')).body.total, 1);
  await post({ action: 'contact_update', id: freshId, archived: true });
  assert.equal((await get('view=contacts&q=fresh')).body.total, 0);
});

test('notes land on the timeline', async () => {
  const id = (await get('view=contacts&q=manual')).body.rows[0].id;
  await post({ action: 'contact_note', id, note: 'Called, wants a quote' });
  const d = await get('view=contact&id=' + id);
  assert.equal(d.body.activities[0].body, 'Called, wants a quote');
});

test('NFR security: CRM endpoints require auth', async () => {
  assert.equal((await call(admin, { url: '/api/admin?view=contacts' })).code, 401);
});

test('import is idempotent, dedupes, skips bad rows and never downgrades an existing client', async () => {
  const rows = [
    { name: 'A One', email: 'a1@example.com', kind: 'past_client', tags: 'fiverr' },
    { name: 'B Two', email: 'b2@example.com' },
    { email: 'a1@example.com' },       // duplicate in same batch
    { name: 'No Email' },               // invalid
    { email: 'old@example.com', kind: 'lead', phone: '123' } // existing client must stay a client
  ];
  const first = await post({ action: 'contact_import', rows, kind: 'past_client', source: 'test' });
  assert.deepEqual([first.body.created, first.body.skipped], [2, 2]);
  const again = await post({ action: 'contact_import', rows, kind: 'past_client' });
  assert.equal(again.body.created, 0);
  const old = await get('view=contacts&q=old@example.com');
  assert.equal(old.body.rows[0].kind, 'client');
});

test('CSV export honours filters and starts with a UTF-8 BOM (Excel-safe)', async () => {
  const r = await get('export=contacts&kind=past_client');
  assert.equal(r.code, 200);
  assert.ok(String(r.body).startsWith('﻿"id"'));
  assert.ok(String(r.body).split('\r\n').length >= 3);
});
