// lib/analytics.js — first-party, cookieless website analytics (stored in the same Turso database as the CRM).
//
// Privacy model (same approach as Plausible/Fathom, so no consent banner is needed for it):
//   * no cookies, no localStorage identifiers, no IP addresses stored
//   * a visitor is an anonymous hash of (day + IP + user agent + secret salt) that changes every day,
//     so "visitors" are unique per day and nobody can be followed across days
//   * country / region / city come from Vercel's edge geolocation headers at request time
//   * a "session" is a random id kept in sessionStorage for one browser tab (30 min inactivity timeout)
//
// Event types: pageview, click, engage (visible time + scroll depth), lead (form accepted), review.

import { createHash } from 'node:crypto';
import { getClient } from './db.js';

export const TYPES = ['pageview', 'click', 'engage', 'lead', 'review'];
export const RANGES = { day: 'Today', week: 'Last 7 days', month: 'Last 30 days', quarter: 'Last 90 days' };
const DAY_MS = 86400000;
export const TZ = process.env.ANALYTICS_TZ || 'Africa/Lagos';

const clip = (v, n) => String(v == null ? '' : v).replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, n);

// ---------- setup (single-flight, like lib/contacts.js) ----------
let setupPromise = null;
export function ensureAnalyticsTables() {
  if (!setupPromise) setupPromise = setup().catch((e) => { setupPromise = null; throw e; });
  return setupPromise;
}
async function setup() {
  const db = getClient();
  await db.execute(`CREATE TABLE IF NOT EXISTS analytics_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ts INTEGER NOT NULL,
    day TEXT NOT NULL,
    hour INTEGER NOT NULL,
    type TEXT NOT NULL,
    path TEXT NOT NULL DEFAULT '',
    title TEXT NOT NULL DEFAULT '',
    ref TEXT NOT NULL DEFAULT '',
    utm_source TEXT NOT NULL DEFAULT '',
    utm_medium TEXT NOT NULL DEFAULT '',
    utm_campaign TEXT NOT NULL DEFAULT '',
    country TEXT NOT NULL DEFAULT '',
    region TEXT NOT NULL DEFAULT '',
    city TEXT NOT NULL DEFAULT '',
    device TEXT NOT NULL DEFAULT '',
    browser TEXT NOT NULL DEFAULT '',
    os TEXT NOT NULL DEFAULT '',
    session TEXT NOT NULL DEFAULT '',
    visitor TEXT NOT NULL DEFAULT '',
    pid TEXT NOT NULL DEFAULT '',
    target TEXT NOT NULL DEFAULT '',
    kind TEXT NOT NULL DEFAULT '',
    dest TEXT NOT NULL DEFAULT '',
    value INTEGER NOT NULL DEFAULT 0,
    depth INTEGER NOT NULL DEFAULT 0
  )`);
  for (const sql of [
    'CREATE INDEX IF NOT EXISTS idx_ae_ts ON analytics_events(ts)',
    'CREATE INDEX IF NOT EXISTS idx_ae_type_ts ON analytics_events(type, ts)',
    'CREATE INDEX IF NOT EXISTS idx_ae_session_ts ON analytics_events(session, ts)',
    'CREATE INDEX IF NOT EXISTS idx_ae_day_type ON analytics_events(day, type)',
    // Finished days are summarised once into small rollup rows (they never change after midnight), so long
    // ranges read a few hundred summary rows instead of every raw event. Rollups outlive raw-event pruning.
    `CREATE TABLE IF NOT EXISTS analytics_rollup (day TEXT NOT NULL, dim TEXT NOT NULL, key TEXT NOT NULL, key2 TEXT NOT NULL DEFAULT '',
      a INTEGER NOT NULL DEFAULT 0, b INTEGER NOT NULL DEFAULT 0, c INTEGER NOT NULL DEFAULT 0, d INTEGER NOT NULL DEFAULT 0, e INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (day, dim, key, key2))`,
    'CREATE TABLE IF NOT EXISTS analytics_rollup_days (day TEXT PRIMARY KEY, built_at INTEGER NOT NULL)'
  ]) await db.execute(sql);
}

// ---------- time helpers (owner's timezone) ----------
const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
export function localParts(ts) {
  const p = Object.fromEntries(fmt.formatToParts(new Date(ts)).map((x) => [x.type, x.value]));
  return { day: `${p.year}-${p.month}-${p.day}`, hour: +p.hour, minute: +p.minute, second: +p.second };
}
function localMidnight(ts) {
  const p = localParts(ts);
  return ts - ((p.hour * 60 + p.minute) * 60 + p.second) * 1000 - (ts % 1000);
}
export function rangeBounds(range, now = Date.now()) {
  if (!RANGES[range]) range = 'week';
  if (range === 'day') {
    const start = localMidnight(now);
    return { range, start, end: now + 1, prevStart: start - DAY_MS, prevEnd: now - DAY_MS + 1, bucket: 'hour' };
  }
  const days = { week: 7, month: 30, quarter: 90 }[range];
  const start = localMidnight(now) - (days - 1) * DAY_MS;            // whole local days, today included
  const span = now + 1 - start;
  return { range, start, end: now + 1, prevStart: start - span, prevEnd: start, bucket: 'day', days };
}

// ---------- ingest ----------
const BOT_UA = /bot|crawl|spider|slurp|headless|lighthouse|pagespeed|preview|facebookexternalhit|embedly|quora link|whatsapp|telegrambot|discordbot|curl|wget|python|go-http|java\/|okhttp|axios|node-fetch|undici|phantom|selenium|puppeteer|playwright|vercel-screenshot|uptime|monitor|pingdom|statuscake/i;
export function isBot(ua) { return !ua || ua.length < 20 || BOT_UA.test(ua); }

export function parseUA(ua, width) {
  ua = ua || '';
  const os = /windows/i.test(ua) ? 'Windows' : /iphone|ipad|ipod/i.test(ua) ? 'iOS' : /android/i.test(ua) ? 'Android'
    : /cros/i.test(ua) ? 'ChromeOS' : /mac os x|macintosh/i.test(ua) ? 'macOS' : /linux/i.test(ua) ? 'Linux' : 'Other';
  const browser = /edg\//i.test(ua) ? 'Edge' : /opr\/|opera/i.test(ua) ? 'Opera' : /samsungbrowser/i.test(ua) ? 'Samsung Internet'
    : /firefox|fxios/i.test(ua) ? 'Firefox' : /chrome|crios/i.test(ua) ? 'Chrome' : /safari/i.test(ua) ? 'Safari' : 'Other';
  const w = Number(width) || 0;
  const device = /ipad|tablet/i.test(ua) || (/android/i.test(ua) && !/mobile/i.test(ua)) ? 'Tablet'
    : /mobi|iphone|ipod|android/i.test(ua) ? 'Mobile' : (w && w < 768 ? 'Mobile' : 'Desktop');
  return { os, browser, device };
}

// /index.html -> /, /blog/index.html -> /blog, /about.html -> /about; keeps ?id= on portfolio-detail only
export function normPath(p) {
  let s = clip(p, 300) || '/';
  let id = '';
  const q = s.indexOf('?');
  if (q >= 0) { const m = s.slice(q).match(/[?&]id=([a-z0-9-]{1,60})/i); id = m ? m[1] : ''; s = s.slice(0, q); }
  s = s.split('#')[0];
  try { s = decodeURIComponent(s); } catch (e) {}
  s = s.replace(/\/index\.html$/i, '/').replace(/\.html$/i, '').replace(/\/+$/, '') || '/';
  if (!s.startsWith('/')) s = '/' + s;
  if (id && /portfolio-detail$/.test(s)) s += '?id=' + id.toLowerCase();
  return s.slice(0, 200);
}

export function refHost(ref, ownHosts) {
  if (!ref) return '';
  try {
    const h = new URL(ref).hostname.toLowerCase().replace(/^www\./, '');
    return ownHosts.some((o) => h === o || h.endsWith('.' + o)) ? '' : h.slice(0, 120);
  } catch (e) { return ''; }
}

export function visitorHash(day, ip, ua) {
  const salt = process.env.ANALYTICS_SALT || process.env.TURSO_AUTH_TOKEN || 'cleverstack-analytics';
  return createHash('sha256').update(day + '|' + ip + '|' + ua + '|' + salt).digest('hex').slice(0, 20);
}

// ctx: { ip, ua, country, region, city, ownHosts, now }
export async function recordEvents(payload, ctx) {
  await ensureAnalyticsTables();
  const now = ctx.now || Date.now();
  const { day, hour } = localParts(now);
  const ua = ctx.ua || '';
  const { os, browser, device } = parseUA(ua, payload.w);
  const session = clip(payload.s, 40).replace(/[^a-z0-9]/gi, '');
  if (!session) return 0;
  const visitor = visitorHash(day, ctx.ip || '', ua);
  const events = (Array.isArray(payload.e) ? payload.e : []).slice(0, 25);
  const rows = [];
  for (const ev of events) {
    if (!ev || !TYPES.includes(ev.t)) continue;
    const u = ev.u || {};
    rows.push({
      sql: `INSERT INTO analytics_events (ts, day, hour, type, path, title, ref, utm_source, utm_medium, utm_campaign, country, region, city,
            device, browser, os, session, visitor, pid, target, kind, dest, value, depth) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      args: [now, day, hour, ev.t, normPath(ev.p), clip(ev.ti, 120), ev.t === 'pageview' ? refHost(ev.r, ctx.ownHosts || []) : '',
        clip(u.s, 60).toLowerCase(), clip(u.m, 60).toLowerCase(), clip(u.c, 80),
        clip(ctx.country, 2).toUpperCase(), clip(ctx.region, 40), clip(ctx.city, 60),
        device, browser, os, session, visitor, clip(ev.pid, 24).replace(/[^a-z0-9]/gi, ''),
        clip(ev.tg, 90), clip(ev.k, 20).toLowerCase(), clip(ev.d, 160),
        Math.max(0, Math.min(1800000, Math.round(Number(ev.v) || 0))), Math.max(0, Math.min(100, Math.round(Number(ev.dp) || 0)))]
    });
  }
  if (!rows.length) return 0;
  await getClient().batch(rows, 'write');
  return rows.length;
}

export async function buildPendingRollups(lookbackDays = 120, now = Date.now()) {
  await ensureAnalyticsTables();
  const today = localParts(now).day;
  const days = daysBetween(now - lookbackDays * DAY_MS, now).filter((d) => d < today);
  await ensureRollups(days);
  return days.length;
}

export async function pruneAnalytics(days = 400) {
  await ensureAnalyticsTables();
  const r = await getClient().execute({ sql: 'DELETE FROM analytics_events WHERE ts < ?', args: [Date.now() - days * DAY_MS] });
  return r.rowsAffected || 0;
}

// ---------- reporting ----------
const num = (v) => Number(v) || 0;
const rowsOf = (r) => (r && r.rows) || [];
const TAB = '\t';
const CAP = 250; // max rows kept per dimension per day (protects against junk paths/labels)

// All per-day aggregates, as uniform rows { dim, key, key2, a..e }. \`cond(alias)\` restricts to ONE local day
// (either "day = ?" for a finished day, or a ts window inside today / yesterday). Visitors are daily-unique, so
// every metric here is additive across days.
function aggregateStatements(cond, args) {
  const W = (x = 'analytics_events') => 'FROM ' + x + ' WHERE ' + cond('') ;
  const entryCte = 'WITH pv AS (SELECT id, ts, session, path, ref, utm_source, utm_medium, utm_campaign,' +
    ' ROW_NUMBER() OVER (PARTITION BY session ORDER BY ts, id) AS rn, ROW_NUMBER() OVER (PARTITION BY session ORDER BY ts DESC, id DESC) AS rd' +
    " FROM analytics_events WHERE type='pageview' AND " + cond('') + ')';
  const hasLead = "EXISTS (SELECT 1 FROM analytics_events l WHERE l.session = pv.session AND l.type='lead' AND " + cond('l.') + ')';
  const q = (sql, extra = 0) => ({ sql, args: [...args, ...Array(extra).fill(args).flat()] });
  return [
    q("SELECT 'total' AS dim, '' AS key, '' AS key2, SUM(type='pageview') AS a, COUNT(DISTINCT CASE WHEN type='pageview' THEN visitor END) AS b," +
      " COUNT(DISTINCT CASE WHEN type='pageview' THEN session END) AS c, SUM(CASE WHEN type='engage' THEN value ELSE 0 END) AS d, SUM(type='click') AS e " + W()),
    q("SELECT 'total2', '', '', SUM(type='lead'), COUNT(DISTINCT CASE WHEN type='lead' THEN session END), SUM(type='review'), 0, 0 " + W()),
    q("SELECT 'bounce', '', '', COUNT(*), 0, 0, 0, 0 FROM (SELECT session FROM analytics_events WHERE type='pageview' AND " + cond('') + ' GROUP BY session HAVING COUNT(*) = 1)'),
    q("SELECT 'page', path, '', COUNT(*), COUNT(DISTINCT visitor), 0, 0, 0 FROM analytics_events WHERE type='pageview' AND " + cond('') + ' GROUP BY path ORDER BY 4 DESC LIMIT ' + CAP),
    q("SELECT 'pageeng', path, '', SUM(ms), COUNT(*), SUM(mx), 0, 0 FROM (SELECT path, pid, SUM(value) AS ms, MAX(depth) AS mx FROM analytics_events WHERE type='engage' AND pid <> '' AND " + cond('') + ' GROUP BY path, pid) GROUP BY path ORDER BY 5 DESC LIMIT ' + CAP),
    q(entryCte + " SELECT 'entry', path, '', SUM(rn = 1), SUM(rd = 1), 0, 0, 0 FROM pv GROUP BY path ORDER BY 4 DESC LIMIT " + CAP),
    q("WITH pv AS (SELECT path, LAG(path) OVER (PARTITION BY session ORDER BY ts, id) AS prev FROM analytics_events WHERE type='pageview' AND " + cond('') + ')' +
      " SELECT 'flow', prev, path, COUNT(*), 0, 0, 0, 0 FROM pv WHERE prev IS NOT NULL AND prev <> path GROUP BY prev, path ORDER BY 4 DESC LIMIT " + CAP),
    q(entryCte + " SELECT 'source', CASE WHEN utm_source <> '' THEN utm_source ELSE ref END, '', COUNT(*), SUM(CASE WHEN " + hasLead + ' THEN 1 ELSE 0 END), 0, 0, 0 FROM pv WHERE rn = 1 GROUP BY 2 ORDER BY 4 DESC LIMIT ' + CAP, 1),
    q(entryCte + " SELECT 'campaign', utm_source, utm_medium || char(9) || utm_campaign, COUNT(*), SUM(CASE WHEN " + hasLead + " THEN 1 ELSE 0 END), 0, 0, 0 FROM pv WHERE rn = 1 AND utm_campaign <> '' GROUP BY 2, 3 ORDER BY 4 DESC LIMIT " + CAP, 1),
    q("SELECT 'country', country, '', COUNT(DISTINCT visitor), COUNT(*), 0, 0, 0 FROM analytics_events WHERE type='pageview' AND " + cond('') + ' GROUP BY country ORDER BY 4 DESC LIMIT ' + CAP),
    q("SELECT 'city', city, region || char(9) || country, COUNT(DISTINCT visitor), 0, 0, 0, 0 FROM analytics_events WHERE type='pageview' AND city <> '' AND " + cond('') + ' GROUP BY city, region, country ORDER BY 4 DESC LIMIT ' + CAP),
    q("SELECT 'device', device, '', COUNT(DISTINCT visitor), 0, 0, 0, 0 FROM analytics_events WHERE type='pageview' AND " + cond('') + ' GROUP BY device'),
    q("SELECT 'browser', browser, '', COUNT(DISTINCT visitor), 0, 0, 0, 0 FROM analytics_events WHERE type='pageview' AND " + cond('') + ' GROUP BY browser'),
    q("SELECT 'os', os, '', COUNT(DISTINCT visitor), 0, 0, 0, 0 FROM analytics_events WHERE type='pageview' AND " + cond('') + ' GROUP BY os'),
    q("SELECT 'click', target, kind || char(9) || dest, COUNT(*), COUNT(DISTINCT session), 0, 0, 0 FROM analytics_events WHERE type='click' AND " + cond('') + ' GROUP BY target, kind, dest ORDER BY 4 DESC LIMIT ' + CAP),
    q("SELECT 'clickkind', kind, '', COUNT(*), COUNT(DISTINCT session), 0, 0, 0 FROM analytics_events WHERE type='click' AND " + cond('') + ' GROUP BY kind'),
    q("SELECT 'funnel', '', ''," +
      " COUNT(DISTINCT CASE WHEN type='pageview' THEN session END)," +
      " COUNT(DISTINCT CASE WHEN type='pageview' AND (path LIKE '/services%' OR path LIKE '/portfolio%' OR path LIKE '/case-studies%' OR path LIKE '/web-development-%' OR path LIKE '/reviews%') THEN session END)," +
      " COUNT(DISTINCT CASE WHEN (type='click' AND kind IN ('booking','whatsapp','phone','email')) OR (type='pageview' AND path LIKE '/contact%') THEN session END)," +
      " COUNT(DISTINCT CASE WHEN type='lead' THEN session END), 0 " + W())
  ];
}
// read by column position: several aggregate queries return columns with identical names ('', 0)
const asRow = (r) => { const v = r.length != null ? Array.from({ length: 8 }, (_, i) => r[i]) : Object.values(r); return { dim: v[0], key: v[1] == null ? '' : String(v[1]), key2: v[2] == null ? '' : String(v[2]), a: num(v[3]), b: num(v[4]), c: num(v[5]), d: num(v[6]), e: num(v[7]) }; };
async function aggregateRaw(cond, args) {
  const res = await getClient().batch(aggregateStatements(cond, args), 'read');
  return res.flatMap((r) => rowsOf(r).map(asRow)).filter((r) => r.dim && (r.a || r.b || r.c || r.d || r.e));
}

// Build rollups for finished days that do not have them yet (each day once; atomic per day).
const buildingDays = new Map();
async function ensureRollups(days) {
  if (!days.length) return;
  const db = getClient();
  const have = new Set();
  for (let i = 0; i < days.length; i += 200) {
    const part = days.slice(i, i + 200);
    const r = await db.execute({ sql: 'SELECT day FROM analytics_rollup_days WHERE day IN (' + part.map(() => '?').join(',') + ')', args: part });
    rowsOf(r).forEach((x) => have.add(x.day));
  }
  const first = rowsOf(await db.execute('SELECT MIN(day) AS d FROM analytics_events'))[0];
  const firstDay = first && first.d ? String(first.d) : null;
  const missing = days.filter((d) => !have.has(d) && firstDay && d >= firstDay);
  for (let i = 0; i < missing.length; i += 4) {
    await Promise.all(missing.slice(i, i + 4).map((day) => {
      if (!buildingDays.has(day)) buildingDays.set(day, buildDay(day).finally(() => buildingDays.delete(day)));
      return buildingDays.get(day);
    }));
  }
}
async function buildDay(day) {
  const rows = await aggregateRaw((p) => p + 'day = ?', [day]);
  const stmts = [{ sql: 'DELETE FROM analytics_rollup WHERE day = ?', args: [day] }];
  for (const r of rows) stmts.push({ sql: 'INSERT OR REPLACE INTO analytics_rollup (day, dim, key, key2, a, b, c, d, e) VALUES (?,?,?,?,?,?,?,?,?)', args: [day, r.dim, r.key, r.key2, r.a, r.b, r.c, r.d, r.e] });
  stmts.push({ sql: 'INSERT OR REPLACE INTO analytics_rollup_days (day, built_at) VALUES (?, ?)', args: [day, Date.now()] });
  await getClient().batch(stmts, 'write');
}

function daysBetween(startTs, endTsExclusive) {
  const out = [];
  for (let t = startTs; t < endTsExclusive; t += DAY_MS) { const d = localParts(t + 3600000).day; if (out[out.length - 1] !== d) out.push(d); }
  return out;
}
function sumRows(lists) {
  const m = new Map();
  for (const list of lists) for (const r of list) {
    const k = r.dim + '\u0001' + r.key + '\u0001' + r.key2;
    const e = m.get(k) || { dim: r.dim, key: r.key, key2: r.key2, a: 0, b: 0, c: 0, d: 0, e: 0 };
    e.a += r.a; e.b += r.b; e.c += r.c; e.d += r.d; e.e += r.e; m.set(k, e);
  }
  return [...m.values()];
}
async function rollupSum(fromDay, toDay) {
  if (!fromDay || fromDay > toDay) return [];
  const r = await getClient().execute({ sql: 'SELECT dim, key, key2, SUM(a) AS a, SUM(b) AS b, SUM(c) AS c, SUM(d) AS d, SUM(e) AS e FROM analytics_rollup WHERE day >= ? AND day <= ? GROUP BY dim, key, key2', args: [fromDay, toDay] });
  return rowsOf(r).map(asRow);
}

// Aggregate rows for [start, end): finished days from rollups, today live from raw events.
async function periodRows(start, end, now) {
  const today = localParts(now).day;
  const days = daysBetween(start, end);
  const full = days.filter((d) => d < today);
  await ensureRollups(full);
  const parts = [await rollupSum(full[0], full[full.length - 1])];
  if (days.includes(today)) parts.push(await aggregateRaw((p) => p + 'day = ? AND ' + p + 'ts < ?', [today, end]));
  return sumRows(parts);
}

function totalsFrom(rows) {
  const one = (dim) => rows.find((r) => r.dim === dim) || { a: 0, b: 0, c: 0, d: 0, e: 0 };
  const t = one('total'), t2 = one('total2'), bo = one('bounce');
  const sessions = t.c;
  return {
    visitors: t.b, pageviews: t.a, sessions,
    avgEngagedSec: sessions ? Math.round(t.d / sessions / 1000) : 0,
    bounceRate: sessions ? Math.round((bo.a / sessions) * 1000) / 10 : 0,
    clicks: t.e, trackedLeads: t2.a, reviews: t2.c,
    conversionRate: sessions ? Math.round((t2.b / sessions) * 1000) / 10 : 0,
    leads: t2.a
  };
}
async function crmLeads(start, end) {
  try {
    const r = await getClient().execute({ sql: "SELECT COUNT(*) AS n FROM submissions WHERE created_at >= datetime(?, 'unixepoch') AND created_at < datetime(?, 'unixepoch')", args: [Math.floor(start / 1000), Math.ceil(end / 1000)] });
    return num(rowsOf(r)[0] && rowsOf(r)[0].n);
  } catch (e) { return null; } // CRM table not created yet
}

export async function getAnalytics(range = 'week', now = Date.now()) {
  await ensureAnalyticsTables();
  const db = getClient();
  const b = rangeBounds(range, now);
  let cur, prev;
  if (b.range === 'day') {
    const yday = localParts(b.prevStart + 3600000).day;
    [cur, prev] = await Promise.all([
      aggregateRaw((p) => p + 'ts >= ? AND ' + p + 'ts < ?', [b.start, b.end]),
      (async () => { await ensureRollups([yday]); return aggregateRaw((p) => p + 'ts >= ? AND ' + p + 'ts < ?', [b.prevStart, b.prevEnd]); })()
    ]);
  } else {
    cur = await periodRows(b.start, b.end, now);
    prev = await periodRows(b.prevStart, b.prevEnd, now);
  }
  const current = totalsFrom(cur), previous = totalsFrom(prev);
  const [crmCur, crmPrev] = await Promise.all([crmLeads(b.start, b.end), crmLeads(b.prevStart, b.prevEnd)]);
  if (crmCur != null) current.leads = crmCur;
  if (crmPrev != null) previous.leads = crmPrev;

  // time series: hours of today, or one point per day (finished days from rollups, today live)
  let series;
  if (b.bucket === 'hour') {
    const r = await db.execute({ sql: "SELECT hour AS h, SUM(type='pageview') AS pv, COUNT(DISTINCT CASE WHEN type='pageview' THEN visitor END) AS v," +
      " COUNT(DISTINCT CASE WHEN type='pageview' THEN session END) AS s, SUM(CASE WHEN type='engage' THEN value ELSE 0 END) AS eng, SUM(type='lead') AS leads, SUM(type='click') AS clicks" +
      ' FROM analytics_events WHERE ts >= ? AND ts < ? GROUP BY hour', args: [b.start, b.end] });
    const by = new Map(rowsOf(r).map((x) => [num(x.h), x]));
    series = [];
    for (let h = 0; h <= localParts(now).hour; h++) {
      const x = by.get(h) || {}; const s = num(x.s);
      series.push({ label: String(h).padStart(2, '0') + ':00', pageviews: num(x.pv), visitors: num(x.v), sessions: s, engagedSec: s ? Math.round(num(x.eng) / s / 1000) : 0, leads: num(x.leads), clicks: num(x.clicks) });
    }
  } else {
    const days = daysBetween(b.start, b.end), today = localParts(now).day;
    const r = await db.execute({ sql: "SELECT day, dim, a, b, c, d, e FROM analytics_rollup WHERE dim IN ('total','total2') AND day >= ? AND day <= ?", args: [days[0], days[days.length - 1]] });
    const by = new Map();
    for (const x of rowsOf(r)) { const o = by.get(x.day) || {}; o[x.dim] = x; by.set(x.day, o); }
    if (days.includes(today)) {
      const live = await aggregateRaw((p) => p + 'day = ? AND ' + p + 'ts < ?', [today, b.end]);
      by.set(today, { total: live.find((x) => x.dim === 'total'), total2: live.find((x) => x.dim === 'total2') });
    }
    series = days.map((d) => {
      const o = by.get(d) || {}, t = o.total || {}, t2 = o.total2 || {}; const s = num(t.c);
      return { label: d, pageviews: num(t.a), visitors: num(t.b), sessions: s, engagedSec: s ? Math.round(num(t.d) / s / 1000) : 0, leads: num(t2.a), clicks: num(t.e) };
    });
  }

  const pick = (dim) => cur.filter((r) => r.dim === dim);
  const top = (list, n, by = 'a') => list.sort((x, y) => y[by] - x[by] || String(x.key).localeCompare(String(y.key))).slice(0, n);
  const eng = new Map(pick('pageeng').map((r) => [r.key, r]));
  const entry = pick('entry');
  const clicks = new Map();
  for (const r of pick('click')) { // merge rows that differ only by destination
    const [kind, dest] = r.key2.split(TAB);
    const k = r.key + TAB + kind;
    const e = clicks.get(k) || { label: r.key, kind, dest: '', count: 0, sessions: 0, best: -1 };
    e.count += r.a; e.sessions += r.b; if (r.a > e.best) { e.best = r.a; e.dest = dest || ''; } clicks.set(k, e);
  }
  const live = await db.batch([
    { sql: 'SELECT COUNT(DISTINCT session) AS n FROM analytics_events WHERE ts >= ?', args: [now - 5 * 60000] },
    { sql: "SELECT path, COUNT(DISTINCT session) AS n FROM analytics_events WHERE type='pageview' AND ts >= ? GROUP BY path ORDER BY n DESC LIMIT 6", args: [now - 5 * 60000] }
  ], 'read');
  const f = pick('funnel')[0] || { a: 0, b: 0, c: 0, d: 0 };

  return {
    range: b.range, label: RANGES[b.range], tz: TZ, generatedAt: now,
    period: { start: b.start, end: b.end - 1, prevStart: b.prevStart, prevEnd: b.prevEnd - 1 },
    current, previous, series,
    live: { visitors: num(rowsOf(live[0])[0] && rowsOf(live[0])[0].n), pages: rowsOf(live[1]).map((r) => ({ path: r.path, visitors: num(r.n) })) },
    pages: top(pick('page'), 12).map((r) => { const e = eng.get(r.key); return { path: r.key, title: '', pageviews: r.a, visitors: r.b,
      avgTimeSec: e && e.b ? Math.round(e.a / e.b / 1000) : 0, avgDepth: e && e.b ? Math.round(e.c / e.b) : 0 }; }),
    entryPages: top(entry.filter((r) => r.a), 10, 'a').map((r) => ({ path: r.key, entries: r.a, exits: r.b })),
    exitPages: top(entry.filter((r) => r.b), 10, 'b').map((r) => ({ path: r.key, entries: r.a, exits: r.b })),
    flows: top(pick('flow'), 12).map((r) => ({ from: r.key, to: r.key2, count: r.a })),
    sources: top(pick('source'), 15).map((r) => ({ source: r.key || '', sessions: r.a, leads: r.b })),
    campaigns: top(pick('campaign'), 10).map((r) => { const [medium, campaign] = r.key2.split(TAB); return { source: r.key, medium: medium || '', campaign: campaign || '', sessions: r.a, leads: r.b }; }),
    countries: top(pick('country'), 15).map((r) => ({ country: r.key || '', visitors: r.a, pageviews: r.b })),
    cities: top(pick('city'), 12).map((r) => { const [region, country] = r.key2.split(TAB); return { city: r.key, region: region || '', country: country || '', visitors: r.a }; }),
    devices: top(pick('device'), 8).map((r) => ({ name: r.key || 'Other', visitors: r.a })),
    browsers: top(pick('browser'), 8).map((r) => ({ name: r.key || 'Other', visitors: r.a })),
    os: top(pick('os'), 8).map((r) => ({ name: r.key || 'Other', visitors: r.a })),
    clicks: [...clicks.values()].sort((x, y) => y.count - x.count).slice(0, 15).map(({ best, ...c }) => c),
    clickKinds: top(pick('clickkind'), 12).map((r) => ({ kind: r.key, count: r.a, sessions: r.b })),
    funnel: { visited: f.a, explored: f.b, intent: f.c, converted: f.d }
  };
}

// Recent visitor journeys: the latest sessions with every page they saw and everything they clicked, in order.
export async function getRecentJourneys(limit = 15) {
  await ensureAnalyticsTables();
  const db = getClient();
  const s = await db.execute({ sql: `SELECT session, MIN(ts) AS started, MAX(ts) AS last, MAX(country) AS country, MAX(city) AS city,
      MAX(device) AS device, MAX(browser) AS browser, MAX(os) AS os, SUM(type='pageview') AS pv, SUM(type='lead') AS leads
    FROM analytics_events WHERE ts >= ? GROUP BY session HAVING pv > 0 ORDER BY last DESC LIMIT ?`, args: [Date.now() - 7 * DAY_MS, Math.min(50, limit)] });
  const sessions = rowsOf(s);
  if (!sessions.length) return [];
  const ids = sessions.map((r) => r.session);
  const ev = await db.execute({ sql: `SELECT session, ts, type, path, ref, utm_source, target, kind, dest, value FROM analytics_events
    WHERE session IN (${ids.map(() => '?').join(',')}) AND type IN ('pageview','click','lead','review') ORDER BY session, ts, id`, args: ids });
  const by = new Map(ids.map((id) => [id, []]));
  for (const r of rowsOf(ev)) if (by.get(r.session).length < 40) by.get(r.session).push({ ts: num(r.ts), type: r.type, path: r.path, ref: r.ref || r.utm_source || '', target: r.target, kind: r.kind, dest: r.dest });
  return sessions.map((r) => ({ session: r.session.slice(0, 6), started: num(r.started), last: num(r.last), country: r.country, city: r.city,
    device: r.device, browser: r.browser, os: r.os, pageviews: num(r.pv), leads: num(r.leads), steps: by.get(r.session) }));
}
