// lib/ab.js — A/B tests on the live site, measured with the first-party analytics.
//
// A test swaps the TEXT of one element (e.g. the homepage headline or a button) for half of the visitors.
// Visitors are split 50/50 in the browser and keep their group; only the letter "a"/"b" is stored there.
// Exposure is recorded as an analytics event (type "exp", target = test id, kind = variant); a conversion is a
// session that reached the goal (lead / booking or WhatsApp click / any call-to-action click).

import { getClient } from './db.js';
import { ensureAnalyticsTables } from './analytics.js';

const rowsOf = (r) => (r && r.rows) || [];
const num = (v) => Number(v) || 0;
const clip = (v, n) => String(v == null ? '' : v).trim().slice(0, n);
export const GOALS = { lead: 'Became a lead', contact: 'Clicked booking, WhatsApp, call or email', cta: 'Clicked any call-to-action' };

let setupPromise = null;
export function ensureAbTables() {
  if (!setupPromise) setupPromise = getClient().execute(`CREATE TABLE IF NOT EXISTS ab_tests (
    id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, page TEXT NOT NULL, selector TEXT NOT NULL,
    text_b TEXT NOT NULL, goal TEXT NOT NULL DEFAULT 'lead', status TEXT NOT NULL DEFAULT 'running',
    created_at TEXT DEFAULT (datetime('now')), ended_at TEXT)`).catch((e) => { setupPromise = null; throw e; });
  return setupPromise;
}

// selectors are limited to a safe subset (ids, classes, tags, descendant/child, :nth-of-type) — no attributes
const SAFE_SELECTOR = /^[a-zA-Z0-9_\-.#\s>:()]+$/;
export function validTest(t) {
  if (!clip(t.name, 80)) return 'Give the test a name';
  if (!/^\/[a-z0-9\-/?=]*$/i.test(t.page || '')) return 'Page must be a site path like / or /services';
  if (!SAFE_SELECTOR.test(t.selector || '') || t.selector.length > 120) return 'Element must be a simple CSS selector like .hero h1';
  if (!clip(t.text_b, 300)) return 'Write the text for version B';
  if (!GOALS[t.goal]) return 'Pick a goal';
  return '';
}

export async function createTest(t) {
  await ensureAbTables();
  const err = validTest(t);
  if (err) throw Object.assign(new Error(err), { status: 400 });
  const r = await getClient().execute({ sql: 'INSERT INTO ab_tests (name, page, selector, text_b, goal) VALUES (?, ?, ?, ?, ?)', args: [clip(t.name, 80), t.page, t.selector.trim(), clip(t.text_b, 300), t.goal] });
  return Number(r.lastInsertRowid);
}
export async function setTestStatus(id, status) {
  if (!['running', 'paused', 'ended'].includes(status)) throw Object.assign(new Error('Unknown status'), { status: 400 });
  await ensureAbTables();
  await getClient().execute({ sql: "UPDATE ab_tests SET status = ?, ended_at = CASE WHEN ? = 'ended' THEN datetime('now') ELSE ended_at END WHERE id = ?", args: [status, status, id] });
}
export async function deleteTest(id) {
  await ensureAbTables();
  await getClient().execute({ sql: 'DELETE FROM ab_tests WHERE id = ?', args: [id] });
}

// what the website needs (public): running tests only, no names
export async function activeTests() {
  await ensureAbTables();
  return rowsOf(await getClient().execute("SELECT id, page, selector, text_b FROM ab_tests WHERE status = 'running' ORDER BY id")).map((t) => ({ id: Number(t.id), page: t.page, sel: t.selector, b: t.text_b }));
}

// Two-proportion z-test -> probability that the difference is real (two-sided), as a percentage.
export function confidence(n1, c1, n2, c2) {
  if (n1 < 1 || n2 < 1) return 0;
  const p1 = c1 / n1, p2 = c2 / n2, p = (c1 + c2) / (n1 + n2);
  const se = Math.sqrt(p * (1 - p) * (1 / n1 + 1 / n2));
  if (!se) return 0;
  const z = Math.abs(p1 - p2) / se;
  // normal CDF via erf approximation (Abramowitz & Stegun 7.1.26)
  const t = 1 / (1 + 0.3275911 * (z / Math.SQRT2));
  const erf = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-(z * z) / 2);
  return Math.round(erf * 1000) / 10;
}

export async function listTestsWithResults() {
  await ensureAbTables();
  await ensureAnalyticsTables();
  const db = getClient();
  const tests = rowsOf(await db.execute('SELECT * FROM ab_tests ORDER BY id DESC'));
  if (!tests.length) return [];
  const goalSql = { lead: "c.type = 'lead'", contact: "c.type = 'click' AND c.kind IN ('booking','whatsapp','phone','email')", cta: "c.type = 'click' AND c.kind IN ('booking','whatsapp','phone','email','cta','submit')" };
  const stmts = tests.map((t) => ({
    sql: `WITH e AS (SELECT session, MIN(kind) AS v, MIN(ts) AS first FROM analytics_events WHERE type = 'exp' AND target = ? GROUP BY session)
      SELECT e.v AS variant, COUNT(*) AS sessions,
        SUM(CASE WHEN EXISTS (SELECT 1 FROM analytics_events c WHERE c.session = e.session AND c.ts >= e.first AND ${goalSql[t.goal] || goalSql.lead}) THEN 1 ELSE 0 END) AS conversions
      FROM e GROUP BY e.v`,
    args: [String(t.id)]
  }));
  const res = await db.batch(stmts, 'read');
  return tests.map((t, i) => {
    const by = Object.fromEntries(rowsOf(res[i]).map((r) => [r.variant, { sessions: num(r.sessions), conversions: num(r.conversions) }]));
    const a = by.a || { sessions: 0, conversions: 0 }, b = by.b || { sessions: 0, conversions: 0 };
    const rate = (x) => (x.sessions ? Math.round((x.conversions / x.sessions) * 1000) / 10 : 0);
    const conf = confidence(a.sessions, a.conversions, b.sessions, b.conversions);
    const enough = a.sessions >= 100 && b.sessions >= 100;
    const winner = enough && conf >= 95 ? (rate(b) > rate(a) ? 'b' : rate(a) > rate(b) ? 'a' : '') : '';
    return { id: Number(t.id), name: t.name, page: t.page, selector: t.selector, text_b: t.text_b, goal: t.goal, goalLabel: GOALS[t.goal], status: t.status, created_at: t.created_at, ended_at: t.ended_at,
      a: { ...a, rate: rate(a) }, b: { ...b, rate: rate(b) }, confidence: conf, enough, winner };
  });
}
