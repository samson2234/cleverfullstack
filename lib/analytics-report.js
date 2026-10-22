// lib/analytics-report.js — the weekly analytics email (sent by the Monday cron, or on demand from the CRM).
import { getAnalytics, pruneAnalytics } from './analytics.js';
import { sendResendEmail, ownerEmail, emailShell, esc, siteUrl } from './email.js';
import { logEmail } from './db.js';

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
