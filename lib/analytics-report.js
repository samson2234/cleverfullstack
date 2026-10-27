// lib/analytics-report.js — the weekly analytics email (sent by the Monday cron, or on demand from the CRM).
import { getAnalytics, pruneAnalytics, getJourneySummaries } from './analytics.js';
import { sendResendEmail, ownerEmail, emailShell, esc, siteUrl } from './email.js';
import { logEmail, getClient } from './db.js';
import { getSearchMonth, gscConfigured } from './search-console.js';

const fmtNum = (n) => Number(n || 0).toLocaleString('en-US');
const fmtSec = (s) => (s >= 60 ? Math.floor(s / 60) + 'm ' + String(s % 60).padStart(2, '0') + 's' : s + 's');
// change vs previous period; `lowerIsBetter` flips the colour (bounce rate)
function delta(cur, prev, lowerIsBetter) {
  if (!prev && !cur) return '<span style="color:#8a90a6;">no change</span>';
  if (!prev) return '<span style="color:#059669;">new</span>';
  const pct = Math.round(((cur - prev) / prev) * 100);
  if (pct === 0) return '<span style="color:#8a90a6;">no change</span>';
  const good = lowerIsBetter ? pct < 0 : pct > 0;
  return `<span style="color:${good ? '#059669' : '#dc2626'};">${pct > 0 ? '▲' : '▼'} ${Math.abs(pct)}%</span>`;
}
const SOURCE_NAMES = { 'google.com': 'Google', 'bing.com': 'Bing', 'duckduckgo.com': 'DuckDuckGo', 'facebook.com': 'Facebook', 'l.facebook.com': 'Facebook', 'm.facebook.com': 'Facebook', 'instagram.com': 'Instagram', 'l.instagram.com': 'Instagram', 't.co': 'X (Twitter)', 'x.com': 'X (Twitter)', 'linkedin.com': 'LinkedIn', 'lnkd.in': 'LinkedIn', 'youtube.com': 'YouTube', 'chatgpt.com': 'ChatGPT', 'perplexity.ai': 'Perplexity', 'fiverr.com': 'Fiverr' };
const BARE = { google: 'Google', bing: 'Bing', facebook: 'Facebook', fb: 'Facebook', meta: 'Facebook', instagram: 'Instagram', ig: 'Instagram', linkedin: 'LinkedIn', twitter: 'X (Twitter)', x: 'X (Twitter)', youtube: 'YouTube', tiktok: 'TikTok', chatgpt: 'ChatGPT', fiverr: 'Fiverr' };
export const sourceName = (s) => { s = String(s || '').toLowerCase(); return !s ? 'Direct / none' : SOURCE_NAMES[s] || BARE[s] || (/^google\./.test(s) ? 'Google' : s); };
export function mergeSources(list) { const m = new Map(); for (const r of list) { const k = sourceName(r.source); const e = m.get(k) || { source: k, sessions: 0, leads: 0 }; e.sessions += r.sessions; e.leads += r.leads; m.set(k, e); } return [...m.values()].sort((a, b) => b.sessions - a.sessions); }

function table(title, head, rows) {
  if (!rows.length) return `<h3 style="font-size:15px;margin:22px 0 8px;">${title}</h3><p style="color:#8a90a6;font-size:13px;margin:0;">No data yet.</p>`;
  return `<h3 style="font-size:15px;margin:22px 0 8px;">${title}</h3><table style="width:100%;border-collapse:collapse;font-size:13px;">
    <tr>${head.map((h, i) => `<th style="text-align:${i ? 'right' : 'left'};color:#8a90a6;font-weight:600;padding:6px 0;border-bottom:1px solid #eee;">${h}</th>`).join('')}</tr>
    ${rows.map((r) => `<tr>${r.map((c, i) => `<td style="text-align:${i ? 'right' : 'left'};padding:6px 0;border-bottom:1px solid #f3f3f3;">${c}</td>`).join('')}</tr>`).join('')}</table>`;
}

export function analyticsReportTemplate(d) {
  const c = d.current, p = d.previous;
  const kpi = (label, value, dl) => `<td style="padding:12px;border:1px solid #eee;border-radius:10px;width:33%;vertical-align:top;">
    <div style="font-size:12px;color:#8a90a6;">${label}</div><div style="font-size:22px;font-weight:700;margin:2px 0;">${value}</div><div style="font-size:12px;">${dl}</div></td>`;
  const from = new Date(d.period.start).toISOString().slice(0, 10), to = new Date(d.period.end).toISOString().slice(0, 10);
  return emailShell(
    `<h2 style="color:#4F46E5;margin:0 0 4px;">Your website this week</h2>
     <p style="color:#8a90a6;font-size:13px;margin:0 0 16px;">${from} to ${to} · compared with the 7 days before</p>
     <table style="width:100%;border-collapse:separate;border-spacing:6px;">
       <tr>${kpi('Visitors', fmtNum(c.visitors), delta(c.visitors, p.visitors))}${kpi('Page views', fmtNum(c.pageviews), delta(c.pageviews, p.pageviews))}${kpi('Leads', fmtNum(c.leads), delta(c.leads, p.leads))}</tr>
       <tr>${kpi('Sessions', fmtNum(c.sessions), delta(c.sessions, p.sessions))}${kpi('Avg. engaged time', fmtSec(c.avgEngagedSec), delta(c.avgEngagedSec, p.avgEngagedSec))}${kpi('Bounce rate', c.bounceRate + '%', delta(c.bounceRate, p.bounceRate, true))}</tr>
     </table>` +
    table('Top pages', ['Page', 'Views', 'Visitors'], d.pages.slice(0, 6).map((r) => [esc(r.path), fmtNum(r.pageviews), fmtNum(r.visitors)])) +
    table('Where visitors came from', ['Source', 'Sessions', 'Leads'], mergeSources(d.sources).slice(0, 6).map((r) => [esc(r.source), fmtNum(r.sessions), fmtNum(r.leads)])) +
    table('Countries', ['Country', 'Visitors'], d.countries.slice(0, 6).map((r) => [esc(r.country || 'Unknown'), fmtNum(r.visitors)])) +
    table('Most-clicked', ['Element', 'Clicks'], d.clicks.slice(0, 6).map((r) => [esc(r.label || '(no label)') + (r.kind ? ` <span style="color:#8a90a6;">· ${esc(r.kind)}</span>` : ''), fmtNum(r.count)])) +
    `<p style="margin:24px 0 0;"><a href="${siteUrl()}/admin.html" style="background:#4F46E5;color:#fff;padding:11px 20px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">Open the full dashboard</a></p>`
  );
}

// Builds the weekly report and emails it to the owner. Also prunes events older than ~13 months.
export async function sendWeeklyReport() {
  const data = await getAnalytics('week');
  const subject = `Weekly website report: ${fmtNum(data.current.visitors)} visitors, ${fmtNum(data.current.leads)} lead${data.current.leads === 1 ? '' : 's'}`;
  const result = await sendResendEmail({ to: ownerEmail(), subject, html: analyticsReportTemplate(data) });
  try { await logEmail({ to_email: ownerEmail(), type: 'analytics_weekly', subject, status: result.ok ? 'sent' : 'failed', error: result.ok ? '' : result.error }); } catch (e) {}
  let pruned = 0;
  try { pruned = await pruneAnalytics(400); } catch (e) {}
  return { ok: result.ok, error: result.ok ? undefined : result.error, subject, pruned, visitors: data.current.visitors, leads: data.current.leads };
}

// ---------- monthly SEO and leads report (3rd of each month, from the daily cron: Search Console data needs ~2 days) ----------
// Real leads only: vendor pitches are counted separately and never as a channel's lead.
export const CHANNELS = ['Google Ads', 'Meta ads', 'Google search', 'Other search engines', 'AI assistants', 'Social media', 'Other websites', 'Direct / unknown'];
// sub: the submission row (its own utm_* first), j: its website journey (first touch) if one was recorded
export function channelOf(sub, j) {
  j = j || {};
  const src = String(sub.utm_source || j.utmSource || '').toLowerCase(), med = String(sub.utm_medium || j.utmMedium || '').toLowerCase();
  const ref = String(j.referrer || '').toLowerCase(), paid = /cpc|ppc|paid|display/.test(med);
  if (paid && /google|adwords|gads/.test(src)) return 'Google Ads';
  if (paid && /facebook|fb|meta|instagram|ig/.test(src)) return 'Meta ads';
  if (/chatgpt|openai|perplexity|claude|gemini|copilot/.test(src + ' ' + ref)) return 'AI assistants';
  if (/(^|\.)google\./.test(ref) || (src === 'google' && !paid)) return 'Google search';
  if (/bing\.|duckduckgo\.|yahoo\.|yandex\.|ecosia\.|brave\./.test(ref) || /^(bing|duckduckgo|yahoo|ecosia)$/.test(src)) return 'Other search engines';
  if (/facebook|fb\.|instagram|linkedin|lnkd|t\.co$|twitter|x\.com|tiktok|youtube|reddit|whatsapp|pinterest/.test(ref) || /^(facebook|fb|meta|instagram|ig|linkedin|twitter|x|tiktok|youtube|reddit)$/.test(src)) return 'Social media';
  if (ref || src) return 'Other websites';
  return 'Direct / unknown';
}

// UTC calendar month containing `ts`, as SQLite timestamps ('YYYY-MM-DD HH:MM:SS' like created_at)
function monthSpan(y, m) {
  const s = new Date(Date.UTC(y, m, 1)), e = new Date(Date.UTC(y, m + 1, 1));
  const q = (d) => d.toISOString().slice(0, 19).replace('T', ' ');
  const day = (d) => d.toISOString().slice(0, 10);
  return { from: q(s), to: q(e), start: day(s), end: day(new Date(e - 86400000)), label: s.toLocaleString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' }) };
}

// Leads per channel for the month before `now` (and the month before that, for the change column)
export async function getMonthlyLeads(now = Date.now()) {
  const d = new Date(now), y = d.getUTCFullYear(), m = d.getUTCMonth();
  const cur = monthSpan(y, m - 1), prev = monthSpan(y, m - 2);
  const r = await getClient().execute({ sql: "SELECT id, status, utm_source, utm_medium, analytics_session, created_at FROM submissions WHERE created_at >= ? AND created_at < ?", args: [prev.from, cur.to] });
  const rows = r.rows || [];
  let journeys = new Map();
  try { journeys = await getJourneySummaries(rows.map((x) => x.analytics_session)); } catch (e) { /* analytics tables missing: channels from utm only */ }
  const count = () => Object.fromEntries(CHANNELS.map((c) => [c, 0]));
  const out = { month: cur.label, previousMonth: prev.label, span: cur, previousSpan: prev, current: count(), previous: count(), leads: 0, previousLeads: 0, won: 0, vendor: 0 };
  for (const x of rows) {
    const inCur = String(x.created_at) >= cur.from;
    if (x.status === 'vendor') { if (inCur) out.vendor++; continue; }
    const ch = channelOf(x, journeys.get(x.analytics_session));
    if (inCur) { out.current[ch]++; out.leads++; if (x.status === 'won') out.won++; } else { out.previous[ch]++; out.previousLeads++; }
  }
  return out;
}

const pos = (p) => (p ? p.toFixed(1) : '-');
function searchSection(s, err) {
  if (!s) return `<h3 style="font-size:15px;margin:26px 0 8px;">Google Search</h3><p style="font-size:13px;margin:0;line-height:1.6;color:#8a90a6;">${err
    ? 'Search Console could not be read this month: ' + esc(err) + '.'
    : 'Search Console is not connected yet, so clicks, impressions and rankings are not in this email. See the setup steps in lib/search-console.js.'} Until then: <a href="https://search.google.com/search-console">Search Console → Performance</a>.</p>`;
  const c = s.current, p = s.previous;
  const kpi = (label, value, dl) => `<td style="padding:12px;border:1px solid #eee;border-radius:10px;width:25%;vertical-align:top;"><div style="font-size:12px;color:#8a90a6;">${label}</div><div style="font-size:20px;font-weight:700;margin:2px 0;">${value}</div><div style="font-size:12px;">${dl}</div></td>`;
  const seen = s.tracked.filter((t) => t.seen).sort((a, b) => a.position - b.position);
  return `<h3 style="font-size:15px;margin:26px 0 8px;">Google Search</h3>
    <table style="width:100%;border-collapse:separate;border-spacing:6px;"><tr>${kpi('Clicks', fmtNum(c.clicks), delta(c.clicks, p.clicks))}${kpi('Impressions', fmtNum(c.impressions), delta(c.impressions, p.impressions))}${kpi('CTR', c.ctr + '%', delta(c.ctr, p.ctr))}${kpi('Avg. position', pos(c.position), delta(c.position, p.position, true))}</tr></table>` +
    `<p style="color:#8a90a6;font-size:12px;margin:6px 0 0;">${fmtNum(s.pagesWithImpressions)} pages showed in Google this month · ${s.page1} tracked phrase${s.page1 === 1 ? '' : 's'} on page 1</p>` +
    table('Tracked phrases (seen in Google)', ['Phrase', 'Position', 'Impressions', 'Clicks'], seen.map((t) => [esc(t.phrase), pos(t.position), fmtNum(t.impressions), fmtNum(t.clicks)])) +
    (seen.length < s.tracked.length ? `<p style="color:#8a90a6;font-size:12px;margin:6px 0 0;">Not showing yet: ${s.tracked.filter((t) => !t.seen).map((t) => esc(t.phrase)).join(', ')}.</p>` : '') +
    table('Top searches', ['Query', 'Clicks', 'Impressions', 'Position'], s.queries.map((q) => [esc(q.query), fmtNum(q.clicks), fmtNum(q.impressions), pos(q.position)])) +
    table('Top pages from Google', ['Page', 'Clicks', 'Impressions'], s.pages.map((x) => [esc(x.page), fmtNum(x.clicks), fmtNum(x.impressions)])) +
    table('Google visitors by country', ['Country', 'Clicks', 'Impressions'], s.countries.map((x) => [esc(x.country), fmtNum(x.clicks), fmtNum(x.impressions)]));
}

export function leadsReportTemplate(d) {
  const rows = CHANNELS.filter((c) => d.current[c] || d.previous[c])
    .map((c) => [esc(c), fmtNum(d.current[c]), fmtNum(d.previous[c]), delta(d.current[c], d.previous[c])]);
  return emailShell(
    `<h2 style="color:#4F46E5;margin:0 0 4px;">SEO and leads: ${esc(d.month)}</h2>
     <p style="color:#8a90a6;font-size:13px;margin:0 0 16px;">${fmtNum(d.leads)} lead${d.leads === 1 ? '' : 's'} (${delta(d.leads, d.previousLeads)} vs ${esc(d.previousMonth)})${d.won ? ' · ' + fmtNum(d.won) + ' already won' : ''}</p>` +
    table('Where your leads came from', ['Channel', esc(d.month.split(' ')[0]), esc(d.previousMonth.split(' ')[0]), 'Change'], rows) +
    `<p style="color:#8a90a6;font-size:12px;margin:10px 0 0;line-height:1.6;">Channel = how the visitor first reached the site (ad tags first, then the referring site). "Direct / unknown" also covers visitors who block tracking and links opened from email or WhatsApp.</p>` +
    (d.vendor ? `<p style="font-size:13px;margin:16px 0 0;">${fmtNum(d.vendor)} vendor pitch${d.vendor === 1 ? ' was' : 'es were'} filtered out of these numbers (see <em>Vendor pitches</em> in the CRM).</p>` : '') +
    searchSection(d.search, d.searchError) +
    `<p style="margin:24px 0 0;"><a href="${siteUrl()}/admin.html" style="background:#4F46E5;color:#fff;padding:11px 20px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">Open the CRM</a></p>`
  );
}

export async function sendMonthlyLeadsReport(now = Date.now()) {
  const data = await getMonthlyLeads(now);
  if (gscConfigured()) {
    try { data.search = await getSearchMonth(data.span, data.previousSpan); }
    catch (e) { console.error('search console failed:', e); data.searchError = String(e.message || e).slice(0, 200); }
  }
  const subject = `Monthly SEO and leads report (${data.month}): ${fmtNum(data.leads)} lead${data.leads === 1 ? '' : 's'}` + (data.search ? `, ${fmtNum(data.search.current.clicks)} Google clicks` : '');
  const result = await sendResendEmail({ to: ownerEmail(), subject, html: leadsReportTemplate(data) });
  try { await logEmail({ to_email: ownerEmail(), type: 'leads_monthly', subject, status: result.ok ? 'sent' : 'failed', error: result.ok ? '' : result.error }); } catch (e) {}
  return { ok: result.ok, error: result.ok ? undefined : result.error, subject, leads: data.leads, vendor: data.vendor };
}
