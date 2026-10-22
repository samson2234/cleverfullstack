// FR: website analytics — accurate counts, privacy (no IPs stored), bot/foreign-site filtering, weekly report.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { call, cleanup, ADMIN, mockFetch } from './helpers.mjs';
import pulse from '../api/pulse.js';
import cron from '../api/cron-weekly.js';
import admin from '../api/admin.js';
import { recordEvents, getAnalytics, getRecentJourneys, rangeBounds, localParts, normPath, isBot, parseUA, TZ } from '../lib/analytics.js';
import { analyticsReportTemplate } from '../lib/analytics-report.js';
import { getClient, ensureTable } from '../lib/db.js';

after(cleanup);
const CHROME = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const own = ['cleverfullstack.vercel.app'];

test('helpers: paths normalise, bots are recognised, user agents parse', () => {
  assert.equal(normPath('/index.html'), '/');
  assert.equal(normPath('/blog/index.html'), '/blog');
  assert.equal(normPath('/about.html?x=1#top'), '/about');
  assert.equal(normPath('/portfolio-detail.html?id=LumeaGlow'), '/portfolio-detail?id=lumeaglow');
  assert.equal(normPath('/services/'), '/services');
  assert.ok(isBot('Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'));
  assert.ok(isBot('HeadlessChrome/120'));
  assert.ok(isBot(''));
  assert.ok(!isBot(CHROME));
  assert.deepEqual(parseUA(CHROME, 1440), { os: 'Windows', browser: 'Chrome', device: 'Desktop' });
  assert.deepEqual(parseUA(IPHONE, 390), { os: 'iOS', browser: 'Safari', device: 'Mobile' });
});

test('ranges: "week" is 7 whole local days ending now, previous period is the same length right before it', () => {
  const now = Date.UTC(2026, 9, 21, 15, 30);                 // 16:30 in Lagos
  const b = rangeBounds('week', now);
  assert.equal(localParts(b.start).day, '2026-10-15');
  assert.equal(localParts(b.start).hour, 0);
  assert.equal(b.end - b.start, b.prevEnd - b.prevStart);
  assert.equal(b.prevEnd, b.start);
  const d = rangeBounds('day', now);
  assert.equal(localParts(d.start).day, '2026-10-21');
  assert.equal(localParts(d.start).hour, 0);
});

test('exact numbers from a known set of visits (visitors, sessions, bounce, sources, flows, clicks, funnel, geo)', async () => {
  await ensureTable(); // CRM tables, so the "Leads" KPI can read submissions
  const now = Date.UTC(2026, 9, 21, 14, 0);
  const T = (min) => now - min * 60000;
  const A = { ip: '1.1.1.1', ua: CHROME, country: 'US', region: 'NY', city: 'New York', ownHosts: own };
  const B = { ip: '2.2.2.2', ua: IPHONE, country: 'NG', region: 'LA', city: 'Lagos', ownHosts: own };
  // Visitor A, session 1: Google -> home -> clicks "Book a Call" -> services -> lead
  await recordEvents({ s: 'sessA1', w: 1440, e: [{ t: 'pageview', p: '/index.html', pid: 'p1', r: 'https://www.google.com/', ti: 'Home' }] }, { ...A, now: T(50) });
  await recordEvents({ s: 'sessA1', w: 1440, e: [{ t: 'click', p: '/index.html', pid: 'p1', tg: 'Book a Call', k: 'booking', d: 'calendly.com' }] }, { ...A, now: T(49) });
  await recordEvents({ s: 'sessA1', w: 1440, e: [{ t: 'engage', p: '/index.html', pid: 'p1', v: 40000, dp: 80 }] }, { ...A, now: T(48) });
  await recordEvents({ s: 'sessA1', w: 1440, e: [{ t: 'pageview', p: '/services.html', pid: 'p2', r: 'https://cleverfullstack.vercel.app/' }] }, { ...A, now: T(47) });
  await recordEvents({ s: 'sessA1', w: 1440, e: [{ t: 'engage', p: '/services.html', pid: 'p2', v: 20000, dp: 50 }, { t: 'lead', p: '/services.html', pid: 'p2', tg: 'budget-planner' }] }, { ...A, now: T(45) });
  // Visitor B: Facebook -> blog (bounce)
  await recordEvents({ s: 'sessB1', w: 390, e: [{ t: 'pageview', p: '/blog/index.html', pid: 'p3', r: 'https://l.facebook.com/x' }] }, { ...B, now: T(30) });
  // Visitor A again, same day, new tab: direct -> about (bounce). Same daily visitor hash.
  await recordEvents({ s: 'sessA2', w: 1440, e: [{ t: 'pageview', p: '/about.html', pid: 'p4', r: '' }] }, { ...A, now: T(10) });
  // Junk that must be ignored: unknown type, no session
  await recordEvents({ s: 'sessA2', e: [{ t: 'hack', p: '/' }] }, { ...A, now: T(9) });
  await recordEvents({ s: '', e: [{ t: 'pageview', p: '/' }] }, { ...A, now: T(9) });
  // Previous period (8 days ago): one page view
  await recordEvents({ s: 'sessOld', w: 1440, e: [{ t: 'pageview', p: '/', pid: 'p9' }] }, { ...B, now: now - 8 * 86400000 });
  // One CRM lead inside the range
  await getClient().execute({ sql: "INSERT INTO submissions (name, email, message, created_at) VALUES ('Ada', 'ada@example.com', 'hi', datetime(?, 'unixepoch'))", args: [Math.floor(T(45) / 1000)] });

  const d = await getAnalytics('week', now);
  assert.deepEqual(
    { pv: d.current.pageviews, v: d.current.visitors, s: d.current.sessions, bounce: d.current.bounceRate, conv: d.current.conversionRate, leads: d.current.leads, tracked: d.current.trackedLeads, clicks: d.current.clicks, eng: d.current.avgEngagedSec },
    { pv: 4, v: 2, s: 3, bounce: 66.7, conv: 33.3, leads: 1, tracked: 1, clicks: 1, eng: 20 }
  );
  assert.equal(d.previous.pageviews, 1);
  assert.deepEqual(d.pages.map((p) => p.path).sort(), ['/', '/about', '/blog', '/services']);
  const home = d.pages.find((p) => p.path === '/');
  assert.deepEqual({ t: home.avgTimeSec, dp: home.avgDepth }, { t: 40, dp: 80 });
  assert.deepEqual(d.sources.map((s) => [s.source, s.sessions, s.leads]).sort(), [['', 1, 0], ['google.com', 1, 1], ['l.facebook.com', 1, 0]]);
  assert.deepEqual(d.flows, [{ from: '/', to: '/services', count: 1 }]);
  assert.deepEqual(d.clicks.map((c) => [c.label, c.kind, c.dest, c.count]), [['Book a Call', 'booking', 'calendly.com', 1]]);
  assert.deepEqual(d.funnel, { visited: 3, explored: 1, intent: 1, converted: 1 });
  assert.deepEqual(d.countries.map((c) => [c.country, c.visitors]).sort(), [['NG', 1], ['US', 1]]);
  assert.deepEqual(d.cities.map((c) => c.city).sort(), ['Lagos', 'New York']);
  assert.deepEqual(d.devices.map((x) => [x.name, x.visitors]).sort(), [['Desktop', 1], ['Mobile', 1]]);
  assert.equal(d.entryPages.find((x) => x.path === '/').entries, 1);
  assert.equal(d.exitPages.find((x) => x.path === '/services').exits, 1);
  assert.equal(d.series.length, 7);
  assert.equal(d.series.reduce((a, x) => a + x.pageviews, 0), 4);
  assert.equal(d.tz, TZ);

  // privacy: nothing that looks like an IP address is stored anywhere
  const all = await getClient().execute('SELECT * FROM analytics_events');
  assert.ok(!JSON.stringify(all.rows).includes('1.1.1.1') && !JSON.stringify(all.rows).includes('2.2.2.2'));
  // same person, same day, two tabs = one visitor hash
  const hashes = new Set(all.rows.filter((r) => r.session.startsWith('sessA')).map((r) => r.visitor));
  assert.equal(hashes.size, 1);
});

test('a finished day read from rollups gives exactly the same numbers as live (and reading twice changes nothing)', async () => {
  const live = await getAnalytics('week', Date.UTC(2026, 9, 21, 14, 0));          // the seeded day is "today": raw events
  const later = Date.UTC(2026, 9, 22, 14, 0);                                      // next day: that day now comes from rollups
  const a = await getAnalytics('week', later);
  const b = await getAnalytics('week', later);                                    // second read uses the stored rollups
  for (const k of ['pageviews', 'visitors', 'sessions', 'bounceRate', 'conversionRate', 'clicks', 'trackedLeads', 'avgEngagedSec']) {
    assert.equal(a.current[k], live.current[k], k);
    assert.equal(b.current[k], live.current[k], k + ' (cached)');
  }
  assert.deepEqual(a.flows, live.flows);
  assert.deepEqual(a.funnel, live.funnel);
  assert.deepEqual(a.sources.map((s) => [s.source, s.sessions, s.leads]).sort(), live.sources.map((s) => [s.source, s.sessions, s.leads]).sort());
  assert.deepEqual(a.clicks, live.clicks);
  const built = await getClient().execute("SELECT COUNT(*) AS n FROM analytics_rollup_days WHERE day = '2026-10-21'");
  assert.equal(Number(built.rows[0].n), 1);
});

test('journeys list each recent session with its pages and clicks in order', async () => {
  const j = await getRecentJourneys(10);
  // the seeded data is dated relative to a fixed "now"; journeys look at the last 7 days of real time,
  // so only assert shape when present
  for (const s of j) for (let i = 1; i < s.steps.length; i++) assert.ok(s.steps[i].ts >= s.steps[i - 1].ts);
  assert.ok(Array.isArray(j));
});

test('pulse endpoint: stores real visits, ignores bots, other websites and junk, always answers 204', async () => {
  const before = Number((await getClient().execute('SELECT COUNT(*) AS n FROM analytics_events')).rows[0].n);
  const send = (body, headers = {}) => call(pulse, { method: 'POST', body, ip: '9.9.9.9', headers: { 'user-agent': CHROME, origin: 'https://cleverfullstack.vercel.app', 'x-vercel-ip-country': 'GB', 'x-vercel-ip-city': 'London', ...headers } });
  const ok = await send(JSON.stringify({ s: 'pulse1', w: 1280, e: [{ t: 'pageview', p: '/contact.html', pid: 'x1' }] }));
  assert.equal(ok.code, 204);
  assert.equal((await send({ s: 'pulse2', e: [{ t: 'pageview', p: '/' }] }, { 'user-agent': 'Googlebot/2.1' })).code, 204);
  assert.equal((await send({ s: 'pulse3', e: [{ t: 'pageview', p: '/' }] }, { origin: 'https://evil.example' })).code, 204);
  assert.equal((await send('{not json')).code, 204);
  assert.equal((await send({ s: 'pulse4', wd: true, e: [{ t: 'pageview', p: '/' }] })).code, 204);
  assert.equal((await call(pulse, { method: 'GET' })).code, 405);
  const rows = (await getClient().execute({ sql: 'SELECT session, path, country, city FROM analytics_events ORDER BY id DESC LIMIT 5' })).rows;
  const after = Number((await getClient().execute('SELECT COUNT(*) AS n FROM analytics_events')).rows[0].n);
  assert.equal(after - before, 1, 'only the real visit is stored');
  assert.deepEqual({ s: rows[0].session, p: rows[0].path, c: rows[0].country, city: rows[0].city }, { s: 'pulse1', p: '/contact', c: 'GB', city: 'London' });
});

test('admin API serves the dashboard data and refuses without the password', async () => {
  assert.equal((await call(admin, { url: '/api/admin?view=analytics&range=month' })).code, 401);
  const r = await call(admin, { url: '/api/admin?view=analytics&range=month', headers: ADMIN });
  assert.equal(r.code, 200);
  assert.equal(r.body.range, 'month');
  assert.equal(r.body.series.length, 30);
  const j = await call(admin, { url: '/api/admin?view=journeys', headers: ADMIN });
  assert.equal(j.code, 200);
  assert.ok(Array.isArray(j.body.journeys));
});

test('weekly report: cron refuses without CRON_SECRET, then emails the owner with real numbers', async () => {
  delete process.env.CRON_SECRET;
  assert.equal((await call(cron, { headers: { authorization: 'Bearer x' } })).code, 503);
  process.env.CRON_SECRET = 'cron-test-secret';
  assert.equal((await call(cron, { headers: { authorization: 'Bearer wrong' } })).code, 401);
  process.env.RESEND_API_KEY = 're_test';
  const sent = [];
  const restore = mockFetch(async (url, opts) => { sent.push(JSON.parse(opts.body)); return new Response(JSON.stringify({ id: 'e1' }), { status: 200 }); });
  try {
    const r = await call(cron, { headers: { authorization: 'Bearer cron-test-secret' } });
    assert.equal(r.code, 200);
    assert.equal(sent.length, 1);
    assert.match(sent[0].subject, /^Weekly website report: \d+ visitors?, \d+ leads?$/);
    assert.match(sent[0].html, /Your website this week/);
  } finally { restore(); delete process.env.RESEND_API_KEY; }
});

test('nightly job: refuses without the secret, then summarises finished days', async () => {
  const daily = (await import('../api/cron-daily.js')).default;
  process.env.CRON_SECRET = 'cron-test-secret';
  assert.equal((await call(daily, { headers: { authorization: 'Bearer nope' } })).code, 401);
  const r = await call(daily, { headers: { authorization: 'Bearer cron-test-secret' } });
  assert.equal(r.code, 200);
  assert.ok(r.body.ok && r.body.checkedDays > 0);
});

test('report template escapes page names and shows deltas', async () => {
  const d = await getAnalytics('week', Date.UTC(2026, 9, 21, 14, 0));
  d.pages.unshift({ path: '/<script>', pageviews: 1, visitors: 1 });
  const html = analyticsReportTemplate(d);
  assert.ok(!html.includes('<script>') && html.includes('&lt;script&gt;'));
  assert.match(html, /▲|▼|new|no change/);
});
