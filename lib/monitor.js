// lib/monitor.js — error alerts via Sentry, without the Sentry SDK (keeps serverless cold starts small).
//
// reportError(err, ctx) sends one event to Sentry's ingest API when SENTRY_DSN is set (Vercel env, never in git),
// and always logs to the console (Vercel logs). It never throws and gives up after 2.5 s, so monitoring can never
// break the request it is reporting on. withMonitor(name, handler) wraps an API handler: anything it throws is
// reported and answered with a plain 500 instead of a crashed function.
//
// Browser errors arrive through /api/pulse (first-party, so ad blockers cannot hide them) and are sent from here,
// tagged source=browser. Sentry then emails / pushes an alert for every new issue (see docs/MONITORING.md).
import crypto from 'node:crypto';

const recent = new Map(); // fingerprint -> last sent (per instance): stops one bug in a loop from burning the quota
const QUIET_MS = 60 * 1000;

function parseDsn(dsn) {
  const m = /^https:\/\/([0-9a-f]+)(?::[0-9a-f]*)?@([^/]+)\/(?:.*\/)?(\d+)$/i.exec(String(dsn || '').trim());
  return m ? { key: m[1], host: m[2], project: m[3], dsn: String(dsn).trim() } : null;
}

// V8 ("at fn (file:1:2)") and Firefox/Safari ("fn@file:1:2") stack lines -> Sentry frames, oldest first
export function parseStack(stack) {
  const frames = [];
  for (const line of String(stack || '').split('\n').slice(0, 40)) {
    let m = /^\s*at (?:(.+?) \()?(.+?):(\d+):(\d+)\)?\s*$/.exec(line);
    if (m) { frames.push({ function: m[1] || '?', filename: m[2], lineno: +m[3], colno: +m[4] }); continue; }
    m = /^\s*(.*?)@(.+?):(\d+):(\d+)\s*$/.exec(line);
    if (m) frames.push({ function: m[1] || '?', filename: m[2], lineno: +m[3], colno: +m[4] });
  }
  for (const f of frames) f.in_app = !/node_modules|node:internal|^node:/.test(f.filename);
  return frames.reverse();
}

const clip = (s, n) => String(s == null ? '' : s).slice(0, n);

export function buildEvent(err, ctx = {}) {
  const e = err instanceof Error ? err : new Error(typeof err === 'string' ? err : JSON.stringify(err));
  const frames = parseStack(ctx.stack || e.stack);
  const tags = { where: clip(ctx.where || 'unknown', 64), source: ctx.source || 'server' };
  for (const [k, v] of Object.entries(ctx.tags || {})) if (v != null && v !== '') tags[clip(k, 32)] = clip(v, 200);
  const event = {
    event_id: crypto.randomBytes(16).toString('hex'),
    timestamp: Date.now() / 1000,
    platform: ctx.source === 'browser' ? 'javascript' : 'node',
    level: ctx.level || 'error',
    environment: process.env.VERCEL_ENV || process.env.NODE_ENV || 'development',
    transaction: tags.where,
    tags,
    exception: { values: [{ type: clip(ctx.type || e.name || 'Error', 100), value: clip(e.message, 1000), ...(frames.length ? { stacktrace: { frames } } : {}) }] },
    extra: ctx.extra || {}
  };
  const sha = process.env.VERCEL_GIT_COMMIT_SHA;
  if (sha) event.release = 'cleverstack@' + sha.slice(0, 7);
  if (ctx.url || ctx.ua) event.request = { url: clip(ctx.url, 500), headers: ctx.ua ? { 'User-Agent': clip(ctx.ua, 300) } : {} };
  if (ctx.fingerprint) event.fingerprint = ctx.fingerprint;
  return event;
}

export async function reportError(err, ctx = {}) {
  try { console.error('[' + (ctx.where || 'error') + ']', err && err.stack ? err.stack : err); } catch (e) {}
  const d = parseDsn(process.env.SENTRY_DSN);
  if (!d) return false;
  try {
    const event = buildEvent(err, ctx);
    const v = event.exception.values[0];
    const fp = event.tags.where + '|' + v.type + '|' + v.value;
    const now = Date.now();
    if (now - (recent.get(fp) || 0) < QUIET_MS) return false;
    recent.set(fp, now);
    if (recent.size > 500) recent.clear();
    const body = JSON.stringify({ event_id: event.event_id, sent_at: new Date().toISOString(), dsn: d.dsn }) + '\n' +
      JSON.stringify({ type: 'event' }) + '\n' + JSON.stringify(event) + '\n';
    const r = await fetch('https://' + d.host + '/api/' + d.project + '/envelope/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-sentry-envelope', 'X-Sentry-Auth': 'Sentry sentry_version=7, sentry_key=' + d.key + ', sentry_client=cleverstack-monitor/1.0' },
      body,
      signal: AbortSignal.timeout(2500)
    });
    return r.ok;
  } catch (e) {
    try { console.error('monitor: could not reach Sentry:', e.message); } catch (x) {}
    return false;
  }
}

export function withMonitor(where, handler) {
  return async function monitored(req, res) {
    try {
      return await handler(req, res);
    } catch (err) {
      await reportError(err, { where, url: req && req.url, ua: req && req.headers && req.headers['user-agent'], tags: { method: req && req.method } });
      if (res && !res.headersSent) { try { return res.status(500).json({ error: 'Something went wrong. Please try again.' }); } catch (e) {} }
    }
  };
}
