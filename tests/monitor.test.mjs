// NFR reliability: problems reach the owner before visitors notice. Server crashes, lost leads and browser errors
// are sent to Sentry (when SENTRY_DSN is set) in the format Sentry accepts; monitoring never breaks a request;
// the health check reports the database so an uptime monitor can alert.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { call, cleanup, mockFetch } from './helpers.mjs';
import { reportError, withMonitor, parseStack } from '../lib/monitor.js';
import pulse from '../api/pulse.js';
import health from '../api/health.js';

after(cleanup);
const DSN = 'https://abc123def456@o42.ingest.us.sentry.io/777';
function capture() {
  const sent = [];
  const restore = mockFetch(async (url, o) => { sent.push({ url: String(url), headers: o.headers, lines: String(o.body).trim().split('\n').map((l) => JSON.parse(l)) }); return new Response('{}', { status: 200 }); });
  return { sent, restore };
}

test('no DSN configured: errors are only logged, nothing is sent', async () => {
  delete process.env.SENTRY_DSN;
  const { sent, restore } = capture();
  try { assert.equal(await reportError(new Error('quiet'), { where: 'test' }), false); } finally { restore(); }
  assert.equal(sent.length, 0);
});

test('an error becomes a Sentry envelope with message, stack frames and where it happened; repeats are throttled', async () => {
  process.env.SENTRY_DSN = DSN;
  const { sent, restore } = capture();
  try {
    const err = new TypeError('lead.email is undefined');
    assert.equal(await reportError(err, { where: 'contact: lead not saved to database', tags: { method: 'POST' } }), true);
    assert.equal(await reportError(err, { where: 'contact: lead not saved to database' }), false, 'same error within a minute is not resent');
  } finally { restore(); delete process.env.SENTRY_DSN; }
  assert.equal(sent.length, 1);
  const [s] = sent;
  assert.equal(s.url, 'https://o42.ingest.us.sentry.io/api/777/envelope/');
  assert.match(s.headers['X-Sentry-Auth'], /sentry_key=abc123def456/);
  const [head, item, ev] = s.lines;
  assert.equal(head.dsn, DSN); assert.equal(item.type, 'event'); assert.equal(head.event_id, ev.event_id);
  assert.equal(ev.exception.values[0].type, 'TypeError');
  assert.equal(ev.exception.values[0].value, 'lead.email is undefined');
  assert.ok(ev.exception.values[0].stacktrace.frames.length > 0, 'stack frames parsed');
  assert.equal(ev.tags.where, 'contact: lead not saved to database');
  assert.equal(ev.tags.method, 'POST');
});

test('Sentry being down or slow never breaks the request', async () => {
  process.env.SENTRY_DSN = DSN;
  const restore = mockFetch(async () => { throw new Error('network down'); });
  try { assert.equal(await reportError(new Error('unique ' + Math.random()), { where: 'x' }), false); } finally { restore(); delete process.env.SENTRY_DSN; }
});

test('a crashing API handler answers a plain 500 and is reported', async () => {
  process.env.SENTRY_DSN = DSN;
  const { sent, restore } = capture();
  let r;
  try { r = await call(withMonitor('api/test', async () => { throw new Error('boom ' + Math.random()); }), { method: 'POST', url: '/api/test' }); }
  finally { restore(); delete process.env.SENTRY_DSN; }
  assert.equal(r.code, 500);
  assert.doesNotMatch(JSON.stringify(r.body), /boom/, 'no internal details to the visitor');
  assert.equal(sent.length, 1);
  assert.equal(sent[0].lines[2].tags.where, 'api/test');
});

test('browser JavaScript errors sent by analytics.js reach Sentry, tagged with the page', async () => {
  process.env.SENTRY_DSN = DSN;
  const { sent, restore } = capture();
  try {
    const body = JSON.stringify({ s: 'abc', w: 390, e: [{ t: 'err', p: '/pricing', m: "Uncaught TypeError: Cannot read properties of null (reading 'value')", f: 'https://cleverstack.dev/script.js', l: 1, c: 4521, st: 'TypeError: x\n    at calc (https://cleverstack.dev/script.js:1:4521)', k: 'error' }] });
    const r = await call(pulse, { method: 'POST', url: '/api/pulse', body, headers: { 'user-agent': 'Mozilla/5.0 (iPhone; Mobile) Safari', origin: 'https://cleverstack.dev' }, ip: '52.1.1.1' });
    assert.equal(r.code, 204);
  } finally { restore(); delete process.env.SENTRY_DSN; }
  const toSentry = sent.filter((s) => /sentry\.io/.test(s.url));
  assert.equal(toSentry.length, 1);
  const ev = toSentry[0].lines[2];
  assert.equal(ev.platform, 'javascript');
  assert.equal(ev.tags.source, 'browser');
  assert.equal(ev.tags.page, '/pricing');
  assert.equal(ev.tags.device, 'mobile');
  assert.equal(ev.exception.values[0].type, 'TypeError');
  assert.equal(ev.exception.values[0].stacktrace.frames[0].filename, 'https://cleverstack.dev/script.js');
});

test('stack parser reads Chrome and Firefox/Safari formats', () => {
  assert.deepEqual(parseStack('Error: x\n    at a (https://s/x.js:1:2)\n    at https://s/y.js:3:4').map((f) => f.lineno), [3, 1]);
  assert.deepEqual(parseStack('b@https://s/x.js:5:6\n@https://s/y.js:7:8').map((f) => f.lineno), [7, 5]);
});

test('health: light check is fast; deep check confirms the database and shows what is configured', async () => {
  const light = await call(health, { url: '/api/health' });
  assert.equal(light.code, 200); assert.equal(light.body.ok, true); assert.equal(light.body.database, undefined);
  const deep = await call(health, { url: '/api/health?deep=1' });
  assert.equal(deep.code, 200);
  assert.equal(deep.body.database, 'ok');
  assert.equal(deep.body.email, 'not configured');
  assert.equal(deep.body.error_alerts, 'not configured');
  assert.equal(deep.headers['cache-control'], 'no-store');
});
