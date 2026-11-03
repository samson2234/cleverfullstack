// lib/campaigns.js — email campaigns: audience, composing, batched sending, tracking, A/B tests and reports.
//
// A campaign's recipients are written to campaign_recipients when it starts, then sent in batches of 100 through
// Resend's batch API. Nothing depends on one long request: the campaign screen keeps calling tick while it is open,
// and the daily cron continues whatever is left. A daily limit (settings) keeps a blast inside the Resend plan.
//
// What is measured: sent, delivered, bounced, complained (Resend webhooks), opened (pixel), clicked (redirect),
// unsubscribed. No email tool can see inbox vs spam placement; the seed test sends to the owner's own mailboxes so
// they can look. Opens are over-counted by Apple Mail privacy protection; clicks are the reliable signal.
import crypto from 'node:crypto';
import { getClient } from './db.js';
import { ensureContactTables, markUnsubscribed, suppress } from './contacts.js';
import { siteUrl, fromAddress } from './email.js';
import { confidence } from './ab.js';

const RESEND_BATCH = 'https://api.resend.com/emails/batch';
const RESEND_ONE = 'https://api.resend.com/emails';
const BATCH = 100;
const STALE_MS = 10 * 60 * 1000;
const clip = (v, n) => String(v == null ? '' : v).trim().slice(0, n);
const num = (v) => Number(v) || 0;
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pct = (a, b) => (b > 0 ? Math.round((a / b) * 1000) / 10 : 0);

let setupPromise = null;
export function ensureCampaignTables() {
  if (!setupPromise) setupPromise = setup().catch((e) => { setupPromise = null; throw e; });
  return setupPromise;
}
async function setup() {
  await ensureContactTables();
  const db = getClient();
  await db.execute(`CREATE TABLE IF NOT EXISTS campaigns (
    id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, subject TEXT DEFAULT '', preview TEXT DEFAULT '',
    from_name TEXT DEFAULT '', reply_to TEXT DEFAULT '', blocks TEXT DEFAULT '[]', audience TEXT DEFAULT '{}', ab TEXT DEFAULT '',
    status TEXT NOT NULL DEFAULT 'draft', schedule_at TEXT, started_at TEXT, test_sent_at TEXT, finished_at TEXT, winner TEXT DEFAULT '',
    last_error TEXT DEFAULT '', permission_confirmed INTEGER DEFAULT 0, is_template INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')))`);
  await db.execute(`CREATE TABLE IF NOT EXISTS campaign_recipients (
    id INTEGER PRIMARY KEY AUTOINCREMENT, campaign_id INTEGER NOT NULL, contact_id INTEGER, email TEXT NOT NULL COLLATE NOCASE,
    variant TEXT DEFAULT 'a', status TEXT NOT NULL DEFAULT 'queued', token TEXT NOT NULL, resend_id TEXT, error TEXT DEFAULT '',
    claimed_at INTEGER, sent_at TEXT, delivered_at TEXT, opened_at TEXT, open_count INTEGER DEFAULT 0, clicked_at TEXT, click_count INTEGER DEFAULT 0,
    bounced_at TEXT, complained_at TEXT, unsubscribed_at TEXT, UNIQUE (campaign_id, email))`);
  await db.execute(`CREATE TABLE IF NOT EXISTS campaign_links (
    id INTEGER PRIMARY KEY AUTOINCREMENT, campaign_id INTEGER NOT NULL, url TEXT NOT NULL, UNIQUE (campaign_id, url))`);
  await db.execute(`CREATE TABLE IF NOT EXISTS campaign_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT, campaign_id INTEGER NOT NULL, recipient_id INTEGER NOT NULL, type TEXT NOT NULL,
    link_id INTEGER, device TEXT DEFAULT '', created_at TEXT DEFAULT (datetime('now')))`);
  await db.execute('CREATE TABLE IF NOT EXISTS campaign_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)');
  for (const sql of [
    'CREATE INDEX IF NOT EXISTS idx_cr_status ON campaign_recipients(campaign_id, status, id)',
    'CREATE UNIQUE INDEX IF NOT EXISTS idx_cr_token ON campaign_recipients(token)',
    'CREATE INDEX IF NOT EXISTS idx_cr_resend ON campaign_recipients(resend_id)',
    'CREATE INDEX IF NOT EXISTS idx_cr_sent ON campaign_recipients(sent_at)',
    'CREATE INDEX IF NOT EXISTS idx_ce_campaign ON campaign_events(campaign_id, type, created_at)'
  ]) await db.execute(sql);
}

// ---------------------------------------------------------------------------
// Settings: postal address (legally required in marketing email), daily limit, sender defaults, seed mailboxes
// ---------------------------------------------------------------------------
const SETTING_DEFAULTS = { postal_address: '', daily_limit: '100', from_name: '', reply_to: '', seeds: '' };
export async function getSettings() {
  await ensureCampaignTables();
  const out = { ...SETTING_DEFAULTS };
  for (const r of (await getClient().execute('SELECT key, value FROM campaign_settings')).rows) if (r.key in out) out[r.key] = r.value;
  return { ...out, daily_limit: Math.max(1, parseInt(out.daily_limit) || 100), email_ready: !!process.env.RESEND_API_KEY, webhook_ready: !!process.env.RESEND_WEBHOOK_SECRET };
}
export async function saveSettings(d) {
  await ensureCampaignTables();
  const vals = {
    postal_address: clip(d.postal_address, 300), daily_limit: String(Math.min(Math.max(parseInt(d.daily_limit) || 100, 1), 1000000)),
    from_name: clip(d.from_name, 80), reply_to: clip(d.reply_to, 200),
    seeds: String(d.seeds || '').split(/[\s,;]+/).map((x) => x.trim().toLowerCase()).filter(validEmail).slice(0, 10).join(', ')
  };
  for (const [k, v] of Object.entries(vals)) await getClient().execute({ sql: 'INSERT INTO campaign_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', args: [k, v] });
  return getSettings();
}
const validEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(e || ''));

// ---------------------------------------------------------------------------
// Audience: anyone in the selected lists / tags / types (OR), narrowed by country and industry, minus everyone
// archived, unsubscribed or suppressed, and minus people who only ever sent a vendor pitch.
// ---------------------------------------------------------------------------
function normAudience(a) {
  const ints = (x) => (Array.isArray(x) ? x : []).map((v) => parseInt(v)).filter((v) => v > 0).slice(0, 50);
  const strs = (x) => (Array.isArray(x) ? x : String(x || '').split(',')).map((v) => clip(v, 40).toLowerCase()).filter(Boolean).slice(0, 50);
  return { all: !!(a && a.all), subscribers: !!(a && a.subscribers), leads: !!(a && a.leads), lists: ints(a && a.lists), tags: strs(a && a.tags), kinds: strs(a && a.kinds), country: clip(a && a.country, 80), industry: clip(a && a.industry, 100) };
}
function audienceSql(spec) {
  const a = normAudience(spec);
  const or = [], args = [];
  if (a.all) or.push('1 = 1');
  if (a.subscribers) or.push("(',' || c.tags || ',') LIKE '%,newsletter,%'");
  if (a.leads) or.push("EXISTS (SELECT 1 FROM submissions s WHERE s.contact_id = c.id AND COALESCE(s.status, 'new') != 'vendor')");
  if (a.lists.length) { or.push(`EXISTS (SELECT 1 FROM list_members m WHERE m.contact_id = c.id AND m.list_id IN (${a.lists.map(() => '?').join(',')}))`); args.push(...a.lists); }
  for (const t of a.tags) { or.push("(',' || c.tags || ',') LIKE ?"); args.push('%,' + t.replace(/[%_]/g, ' ') + ',%'); }
  if (a.kinds.length) { or.push(`c.kind IN (${a.kinds.map(() => '?').join(',')})`); args.push(...a.kinds); }
  if (!or.length) return null;
  const w = ['c.archived = 0', '(' + or.join(' OR ') + ')', "c.email LIKE '%@%'",
    "NOT (EXISTS (SELECT 1 FROM submissions s WHERE s.contact_id = c.id AND s.status = 'vendor') AND NOT EXISTS (SELECT 1 FROM submissions s WHERE s.contact_id = c.id AND COALESCE(s.status, 'new') != 'vendor'))"];
  if (a.country) { w.push('c.country = ?'); args.push(a.country); }
  if (a.industry) { w.push('c.industry = ?'); args.push(a.industry); }
  return { where: w.join(' AND '), args };
}
const MAILABLE = 'c.unsubscribed_at IS NULL AND NOT EXISTS (SELECT 1 FROM email_suppressions x WHERE x.email = c.email)';
// nobody recorded how we got this address: not a subscriber, enquiry or client, and the import did not say
const NO_PERMISSION = `COALESCE(c.consent, '') IN ('', 'unknown') AND (',' || c.tags || ',') NOT LIKE '%,newsletter,%' AND c.kind NOT IN ('client', 'past_client', 'partner')
  AND NOT EXISTS (SELECT 1 FROM submissions s WHERE s.contact_id = c.id)`;

export async function audienceSummary(spec) {
  await ensureCampaignTables();
  const q = audienceSql(spec);
  if (!q) return { total: 0, matched: 0, excluded: 0, no_permission: 0 };
  const r = (await getClient().execute({
    sql: `SELECT COUNT(*) AS matched, SUM(CASE WHEN ${MAILABLE} THEN 1 ELSE 0 END) AS total,
            SUM(CASE WHEN ${MAILABLE} AND ${NO_PERMISSION} THEN 1 ELSE 0 END) AS no_permission FROM contacts c WHERE ${q.where}`,
    args: q.args
  })).rows[0];
  const matched = num(r.matched), total = num(r.total);
  return { total, matched, excluded: matched - total, no_permission: num(r.no_permission) };
}

// ---------------------------------------------------------------------------
// Composing: blocks -> email HTML. Everything the owner types is escaped; **bold** and [text](url) are the only markup.
// ---------------------------------------------------------------------------
const BLOCK_TYPES = ['heading', 'text', 'button', 'image', 'divider'];
const safeUrl = (u, schemes = /^(https?:|mailto:)/i) => { const s = clip(u, 1000); return schemes.test(s) ? s : ''; };
function normBlocks(list) {
  return (Array.isArray(list) ? list : []).slice(0, 60).filter((b) => b && BLOCK_TYPES.includes(b.type)).map((b) => ({
    type: b.type, text: clip(b.text, 5000), url: b.type === 'image' ? safeUrl(b.url, /^https:/i) : safeUrl(b.url), alt: clip(b.alt, 200)
  }));
}
export function parseAb(raw) {
  let a = raw;
  if (typeof raw === 'string') { try { a = raw ? JSON.parse(raw) : null; } catch (e) { a = null; } }
  if (!a || !a.enabled) return null;
  const field = a.field === 'content' ? 'content' : 'subject';
  return {
    enabled: true, field, subject_b: clip(a.subject_b, 200), blocks_b: normBlocks(a.blocks_b),
    test_pct: Math.min(Math.max(parseInt(a.test_pct) || 20, 10), 50), metric: a.metric === 'click' ? 'click' : 'open',
    wait_hours: Math.min(Math.max(parseInt(a.wait_hours) || 4, 1), 168)
  };
}
function inline(text, link) {
  let s = esc(text);
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, label, url) => {
    const u = safeUrl(url.replace(/&amp;/g, '&'));
    return u ? '<a href="' + esc(link(u)) + '" style="color:#4F46E5">' + label + '</a>' : label;
  });
  return s.replace(/\n/g, '<br>');
}
function renderBody(blocks, link) {
  return blocks.map((b) => {
    if (b.type === 'heading') return '<h2 style="margin:0 0 14px;font-size:22px;line-height:1.3;color:#111827">' + inline(b.text, link) + '</h2>';
    if (b.type === 'text') return '<p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#374151">' + inline(b.text, link) + '</p>';
    if (b.type === 'divider') return '<hr style="border:none;border-top:1px solid #E5E7EB;margin:22px 0">';
    if (b.type === 'button' && b.url) return '<p style="margin:6px 0 20px"><a href="' + esc(link(b.url)) + '" style="display:inline-block;background:#4F46E5;color:#fff;text-decoration:none;font-weight:600;font-size:16px;padding:12px 22px;border-radius:8px">' + esc(b.text || 'Learn more') + '</a></p>';
    if (b.type === 'image' && b.url) {
      const img = '<img src="' + esc(b.url) + '" alt="' + esc(b.alt) + '" width="560" style="display:block;width:100%;max-width:560px;height:auto;border-radius:8px;border:0">';
      return '<p style="margin:0 0 18px">' + img + '</p>';
    }
    return '';
  }).join('');
}
function plainBody(blocks) {
  return blocks.map((b) => {
    const t = String(b.text || '').replace(/\*\*/g, '').replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '$1 ($2)');
    if (b.type === 'button') return t + ': ' + b.url;
    if (b.type === 'divider') return '---';
    if (b.type === 'image') return b.alt || '';
    return t;
  }).filter(Boolean).join('\n\n');
}
function mergeValues(r) {
  let extra = {};
  try { extra = r.fields ? JSON.parse(r.fields) : {}; } catch (e) {}
  const name = clip(r.name, 120);
  const emailish = name.includes('@') || name === clip(r.email, 200).split('@')[0];
  const parts = emailish ? [] : name.split(/\s+/).filter(Boolean);
  return { ...extra, first_name: parts[0] || extra.first_name || '', last_name: parts.slice(1).join(' ') || extra.last_name || '', name: emailish ? '' : name, email: r.email || '', company: r.company || extra.company || '', country: r.country || '', industry: r.industry || '', phone: r.phone || '' };
}
function merge(text, values, html) {
  return String(text).replace(/\{\{\s*([a-z0-9_]+)\s*(?:\|([^}]*))?\}\}/gi, (m, key, fallback) => {
    const v = values[String(key).toLowerCase()];
    if (v != null && String(v).trim() !== '') return html ? esc(v) : String(v);
    const f = (fallback == null ? '' : fallback).trim(); // fallback text inside HTML was already escaped with the block
    return f;
  });
}
const variantOf = (c, variant) => {
  const ab = parseAb(c.ab);
  const blocks = normBlocks(typeof c.blocks === 'string' ? safeParse(c.blocks) : c.blocks);
  if (!ab || variant !== 'b') return { subject: c.subject, blocks };
  return ab.field === 'subject' ? { subject: ab.subject_b || c.subject, blocks } : { subject: c.subject, blocks: ab.blocks_b.length ? ab.blocks_b : blocks };
};
const safeParse = (s) => { try { return JSON.parse(s || '[]'); } catch (e) { return []; } };

function wrapHtml(c, body, footer, pixel) {
  const preview = c.preview ? '<div style="display:none;max-height:0;overflow:hidden;opacity:0">' + esc(c.preview) + '</div>' : '';
  return '<!doctype html><html><body style="margin:0;padding:0;background:#F3F4F6">' + preview +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F3F4F6"><tr><td align="center" style="padding:24px 12px">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#fff;border-radius:12px"><tr><td style="padding:28px 28px 12px;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif">' + body + '</td></tr></table>' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px"><tr><td style="padding:16px 28px;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;font-size:12px;line-height:1.6;color:#6B7280;text-align:center">' + footer + '</td></tr></table>' +
    '</td></tr></table>' + (pixel || '') + '</body></html>';
}
const footerHtml = (settings, unsubUrl) => (settings.postal_address ? esc(settings.postal_address) + '<br>' : '') + 'Do not want these emails? <a href="' + esc(unsubUrl) + '" style="color:#6B7280">Unsubscribe</a>.';
function fromFor(c, settings) {
  const name = clip(c.from_name || settings.from_name, 80).replace(/[<>"\r\n]/g, '');
  if (!name) return fromAddress();
  const m = /<([^>]+)>/.exec(fromAddress());
  return name + ' <' + (m ? m[1] : fromAddress()) + '>';
}

// The email as one recipient gets it. link(url) wraps a link for tracking.
function buildEmail(c, variant, r, settings, { link, pixel, unsubUrl, oneClickUrl }) {
  const v = variantOf(c, variant);
  const values = mergeValues(r);
  const body = merge(renderBody(v.blocks, link), values, true);
  const text = merge(plainBody(v.blocks), values, false) + '\n\n--\n' + (settings.postal_address ? settings.postal_address + '\n' : '') + 'Unsubscribe: ' + unsubUrl;
  const out = {
    from: fromFor(c, settings), to: [r.email], subject: merge(v.subject, values, false),
    html: wrapHtml({ preview: merge(c.preview || '', values, false) }, body, footerHtml(settings, unsubUrl), pixel), text
  };
  const reply = clip(c.reply_to || settings.reply_to, 200);
  if (reply) out.reply_to = reply;
  if (oneClickUrl) out.headers = { 'List-Unsubscribe': '<' + oneClickUrl + '>', 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' };
  return out;
}

// Preview (no tracking) for the composer
export async function renderPreview(c, variant) {
  const settings = await getSettings();
  const sample = { name: 'Alex Morgan', email: 'alex@example.com', company: 'Example Ltd', country: 'United States', industry: 'Retail', phone: '' };
  const e = buildEmail(c, variant === 'b' ? 'b' : 'a', sample, settings, { link: (u) => u, unsubUrl: siteUrl() + '/api/unsubscribe' });
  return { subject: e.subject, html: e.html, from: e.from, text: e.text };
}

// Test / seed send: real email, no tracking, not counted in any report
export async function sendTest(c, emails) {
  const settings = await getSettings();
  const to = [...new Set((emails || []).map((e) => clip(e, 200).toLowerCase()).filter(validEmail))].slice(0, 10);
  if (!to.length) return { error: 'Add at least one valid email address' };
  if (!process.env.RESEND_API_KEY) return { error: 'RESEND_API_KEY is not set, so emails cannot be sent' };
  const results = [];
  for (const addr of to) {
    const sample = { name: '', email: addr, company: '', country: '', industry: '', phone: '' };
    const e = buildEmail(c, 'a', sample, settings, { link: (u) => u, unsubUrl: siteUrl() + '/api/unsubscribe' });
    e.subject = '[Test] ' + e.subject;
    const r = await resendPost(RESEND_ONE, e);
    results.push({ email: addr, ok: r.ok, error: r.ok ? '' : r.error });
  }
  return { results, sent: results.filter((x) => x.ok).length };
}

async function resendPost(url, body, idempotencyKey) {
  let res;
  try {
    res = await fetch(url, {
      method: 'POST', signal: AbortSignal.timeout(20000),
      headers: { Authorization: 'Bearer ' + process.env.RESEND_API_KEY, 'Content-Type': 'application/json', ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}) },
      body: JSON.stringify(body)
    });
  } catch (err) {
    return { ok: false, status: 0, error: err && err.name === 'TimeoutError' ? 'Email provider timed out' : 'Email request failed: ' + (err && err.message) };
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, status: res.status, error: (data.message || data.name || 'Resend error') + ' (' + res.status + ')' };
  return { ok: true, status: res.status, data };
}

// ---------------------------------------------------------------------------
// Campaign records
// ---------------------------------------------------------------------------
const rowToCampaign = (c) => c && ({ ...c, id: Number(c.id), blocks: safeParse(c.blocks), audience: safeParse(c.audience || '{}'), ab: parseAb(c.ab), is_template: !!num(c.is_template) });
export const slugOf = (c) => 'email-' + c.id + '-' + String(c.name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);

export async function saveCampaign(d) {
  await ensureCampaignTables();
  const db = getClient();
  const id = parseInt(d.id) || 0;
  const name = clip(d.name, 80);
  if (name.length < 2) return { error: 'Give the campaign a name' };
  const ab = parseAb(d.ab);
  const vals = [name, clip(d.subject, 200), clip(d.preview, 200), clip(d.from_name, 80), clip(d.reply_to, 200), JSON.stringify(normBlocks(d.blocks)), JSON.stringify(normAudience(d.audience)), ab ? JSON.stringify(ab) : ''];
  if (id) {
    const cur = (await db.execute({ sql: 'SELECT status FROM campaigns WHERE id = ?', args: [id] })).rows[0];
    if (!cur) return { error: 'Campaign not found' };
    if (!['draft', 'scheduled'].includes(cur.status)) return { error: 'This campaign has started and can no longer be edited' };
    await db.execute({ sql: "UPDATE campaigns SET name = ?, subject = ?, preview = ?, from_name = ?, reply_to = ?, blocks = ?, audience = ?, ab = ?, is_template = ?, updated_at = datetime('now') WHERE id = ?", args: [...vals, d.is_template ? 1 : 0, id] });
    return { id };
  }
  const r = await db.execute({ sql: 'INSERT INTO campaigns (name, subject, preview, from_name, reply_to, blocks, audience, ab, is_template) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', args: [...vals, d.is_template ? 1 : 0] });
  return { id: Number(r.lastInsertRowid) };
}
export async function getCampaign(id) {
  await ensureCampaignTables();
  return rowToCampaign((await getClient().execute({ sql: 'SELECT * FROM campaigns WHERE id = ?', args: [id] })).rows[0]) || null;
}
export async function deleteCampaign(id) {
  await ensureCampaignTables();
  const c = await getCampaign(id);
  if (!c) return { error: 'Campaign not found' };
  if (['sending', 'testing'].includes(c.status)) return { error: 'Pause or cancel this campaign first' };
  await getClient().batch([
    { sql: 'DELETE FROM campaign_events WHERE campaign_id = ?', args: [id] },
    { sql: 'DELETE FROM campaign_links WHERE campaign_id = ?', args: [id] },
    { sql: 'DELETE FROM campaign_recipients WHERE campaign_id = ?', args: [id] },
    { sql: 'DELETE FROM campaigns WHERE id = ?', args: [id] }
  ], 'write');
  return {};
}
// Copy (a template or an earlier campaign) into a new draft
export async function duplicateCampaign(id) {
  const c = await getCampaign(id);
  if (!c) return { error: 'Campaign not found' };
  return saveCampaign({ ...c, id: 0, name: (c.is_template ? '' : 'Copy of ') + c.name, is_template: false });
}

// ---------------------------------------------------------------------------
// Starting and sending
// ---------------------------------------------------------------------------
function readiness(c, settings) {
  if (!process.env.RESEND_API_KEY) return 'RESEND_API_KEY is not set, so emails cannot be sent';
  if (!clip(c.subject, 200)) return 'Add a subject line';
  if (!normBlocks(c.blocks).some((b) => b.type !== 'divider')) return 'Add some content to the email';
  if (!settings.postal_address) return 'Add your postal address in Campaign settings first. The law requires it in marketing email (CAN-SPAM).';
  const ab = parseAb(c.ab);
  if (ab && ab.field === 'subject' && !ab.subject_b) return 'Write subject line B for the A/B test';
  if (ab && ab.field === 'content' && !ab.blocks_b.length) return 'Write content B for the A/B test';
  return '';
}

export async function startCampaign(id, { schedule_at, confirm_permission } = {}) {
  const c = await getCampaign(id);
  if (!c) return { error: 'Campaign not found' };
  if (c.is_template) return { error: 'Templates cannot be sent. Use the template to create a campaign.' };
  if (!['draft', 'scheduled'].includes(c.status)) return { error: 'This campaign has already started' };
  const settings = await getSettings();
  const problem = readiness(c, settings);
  if (problem) return { error: problem };
  const summary = await audienceSummary(c.audience);
  if (!summary.total) return { error: 'Nobody can receive this campaign. Choose an audience with at least one person who has not unsubscribed.' };
  if (summary.no_permission && !confirm_permission) return { needs_confirmation: true, summary, error: summary.no_permission + ' of these people have no recorded permission. Confirm you are allowed to email them.' };
  const ab = parseAb(c.ab);
  if (ab && summary.total < 10) return { error: 'An A/B test needs at least 10 recipients. Turn the test off, or choose a larger audience.' };
  const db = getClient();
  await db.execute({ sql: 'UPDATE campaigns SET permission_confirmed = ? WHERE id = ?', args: [confirm_permission ? 1 : 0, id] });
  if (schedule_at) {
    const t = new Date(schedule_at);
    if (isNaN(t.getTime())) return { error: 'That date and time is not valid' };
    if (t.getTime() > Date.now()) {
      await db.execute({ sql: "UPDATE campaigns SET status = 'scheduled', schedule_at = ?, updated_at = datetime('now') WHERE id = ?", args: [t.toISOString(), id] });
      return { scheduled: t.toISOString(), summary };
    }
  }
  return begin(c, summary);
}

async function begin(c) {
  const db = getClient();
  const q = audienceSql(c.audience);
  const ab = parseAb(c.ab);
  // claim the start, so the cron and the screen cannot both do it
  const claimed = await db.execute({ sql: "UPDATE campaigns SET status = 'sending', started_at = datetime('now'), last_error = '', updated_at = datetime('now') WHERE id = ? AND status IN ('draft', 'scheduled')", args: [c.id] });
  if (!claimed.rowsAffected) return { error: 'This campaign has already started' };
  await db.execute({
    sql: `INSERT OR IGNORE INTO campaign_recipients (campaign_id, contact_id, email, status, token)
          SELECT ?, c.id, lower(c.email), ?, lower(hex(randomblob(16))) FROM contacts c WHERE ${q.where} AND ${MAILABLE}`,
    args: [c.id, ab ? 'held' : 'queued', ...q.args]
  });
  // tracked links, tagged so website visits and leads are credited to this campaign
  const urls = new Set();
  const blocksAll = [...normBlocks(c.blocks), ...(ab && ab.field === 'content' ? ab.blocks_b : [])];
  renderBody(blocksAll, (u) => { if (/^https?:/i.test(u)) urls.add(u); return u; });
  for (const u of urls) await db.execute({ sql: 'INSERT OR IGNORE INTO campaign_links (campaign_id, url) VALUES (?, ?)', args: [c.id, u] });
  const total = num((await db.execute({ sql: 'SELECT COUNT(*) AS n FROM campaign_recipients WHERE campaign_id = ?', args: [c.id] })).rows[0].n);
  if (ab) {
    // random test group, half on each version; the rest wait for the winner
    const size = Math.max(2, Math.round((total * ab.test_pct) / 100));
    const ids = (await db.execute({ sql: 'SELECT id FROM campaign_recipients WHERE campaign_id = ? ORDER BY random() LIMIT ?', args: [c.id, size] })).rows.map((r) => Number(r.id));
    const half = Math.ceil(ids.length / 2);
    for (const [variant, group] of [['a', ids.slice(0, half)], ['b', ids.slice(half)]]) {
      for (let i = 0; i < group.length; i += 200) {
        const chunk = group.slice(i, i + 200);
        await db.execute({ sql: `UPDATE campaign_recipients SET status = 'queued', variant = ? WHERE id IN (${chunk.map(() => '?').join(',')})`, args: [variant, ...chunk] });
      }
    }
  }
  return { started: true, total };
}

const sentToday = async () => num((await getClient().execute("SELECT COUNT(*) AS n FROM campaign_recipients WHERE sent_at >= date('now')")).rows[0].n);

// Send as much as the time budget and the daily limit allow. Safe to call repeatedly and at the same time as another
// call: rows are claimed before sending, and a retry of the same batch reuses Resend's idempotency key.
export async function runCampaign(id, budgetMs = 40000) {
  const deadline = Date.now() + budgetMs;
  const db = getClient();
  let c = await getCampaign(id);
  if (!c) return { error: 'Campaign not found' };
  const settings = await getSettings();
  let sent = 0, failed = 0, waiting = '';
  // interrupted mid-send: we cannot know if it went out, and sending twice is worse than missing one
  await db.execute({ sql: "UPDATE campaign_recipients SET status = 'failed', error = 'Interrupted while sending' WHERE campaign_id = ? AND status = 'sending' AND claimed_at < ?", args: [id, Date.now() - STALE_MS] });
  while (Date.now() < deadline) {
    c = await getCampaign(id);
    if (c.status !== 'sending') break;
    const room = settings.daily_limit - (await sentToday());
    if (room <= 0) { waiting = 'daily_limit'; break; }
    // someone unsubscribed or bounced after the campaign started
    await db.execute({ sql: `UPDATE campaign_recipients SET status = 'skipped', error = 'Unsubscribed or suppressed' WHERE campaign_id = ? AND status = 'queued' AND EXISTS (SELECT 1 FROM email_suppressions x WHERE x.email = campaign_recipients.email)`, args: [id] });
    const now = Date.now();
    const claim = await db.execute({
      sql: `UPDATE campaign_recipients SET status = 'sending', claimed_at = ? WHERE id IN (SELECT id FROM campaign_recipients WHERE campaign_id = ? AND status = 'queued' ORDER BY id LIMIT ?) RETURNING id`,
      args: [now, id, Math.min(BATCH, room)]
    });
    const ids = claim.rows.map((r) => Number(r.id)).sort((a, b) => a - b);
    if (!ids.length) break;
    const rows = (await db.execute({
      sql: `SELECT r.id, r.email, r.token, r.variant, c.name, c.company, c.country, c.industry, c.phone, c.fields FROM campaign_recipients r LEFT JOIN contacts c ON c.id = r.contact_id WHERE r.id IN (${ids.map(() => '?').join(',')}) ORDER BY r.id`,
      args: ids
    })).rows;
    const links = await linkMap(id);
    const emails = rows.map((r) => emailForRecipient(c, r, settings, links));
    const key = 'camp-' + id + '-' + crypto.createHash('sha256').update(ids.join(',')).digest('hex').slice(0, 32);
    const res = await resendPost(RESEND_BATCH, emails, key);
    if (res.ok) {
      const data = (res.data && res.data.data) || [];
      await db.batch(rows.map((r, i) => ({ sql: "UPDATE campaign_recipients SET status = 'sent', sent_at = datetime('now'), resend_id = ? WHERE id = ?", args: [(data[i] && data[i].id) || null, r.id] })), 'write');
      sent += rows.length;
      continue;
    }
    if (res.status === 422 || res.status === 400) {
      // one bad address rejects a whole batch: send this batch one by one, so only the bad one fails
      for (let i = 0; i < rows.length; i++) {
        const one = await resendPost(RESEND_ONE, emails[i], key + '-' + rows[i].id);
        if (one.ok) { await db.execute({ sql: "UPDATE campaign_recipients SET status = 'sent', sent_at = datetime('now'), resend_id = ? WHERE id = ?", args: [(one.data && one.data.id) || null, rows[i].id] }); sent++; }
        else { await db.execute({ sql: "UPDATE campaign_recipients SET status = 'failed', error = ? WHERE id = ?", args: [clip(one.error, 300), rows[i].id] }); failed++; }
      }
      continue;
    }
    // rate limit, provider down or a bad key: nothing was lost, put them back
    await db.execute({ sql: `UPDATE campaign_recipients SET status = 'queued', claimed_at = NULL WHERE id IN (${ids.map(() => '?').join(',')})`, args: ids });
    await db.execute({ sql: 'UPDATE campaigns SET last_error = ? WHERE id = ?', args: [clip(res.error, 300), id] });
    if (res.status === 401 || res.status === 403) await db.execute({ sql: "UPDATE campaigns SET status = 'paused' WHERE id = ?", args: [id] });
    waiting = 'provider';
    break;
  }
  await settle(id);
  return { sent, failed, waiting, ...(await progress(id)) };
}

async function linkMap(id) {
  const m = new Map();
  for (const l of (await getClient().execute({ sql: 'SELECT id, url FROM campaign_links WHERE campaign_id = ?', args: [id] })).rows) m.set(l.url, Number(l.id));
  return m;
}
function emailForRecipient(c, r, settings, links) {
  const base = siteUrl();
  const unsub = base + '/api/unsubscribe?t=' + r.token;
  return buildEmail(c, r.variant, r, settings, {
    link: (u) => (links.has(u) ? base + '/api/pulse?c=' + r.token + '&l=' + links.get(u) : u),
    pixel: '<img src="' + base + '/api/pulse?o=' + r.token + '" width="1" height="1" alt="" style="display:block;border:0">',
    unsubUrl: unsub, oneClickUrl: unsub
  });
}

// Finished this stage? A test group that has gone out waits for the winner; otherwise the campaign is done.
async function settle(id) {
  const db = getClient();
  const c = await getCampaign(id);
  if (!c || c.status !== 'sending') return;
  const n = (await db.execute({ sql: "SELECT SUM(status IN ('queued', 'sending')) AS open, SUM(status = 'held') AS held FROM campaign_recipients WHERE campaign_id = ?", args: [id] })).rows[0];
  if (num(n.open)) return;
  if (num(n.held)) await db.execute({ sql: "UPDATE campaigns SET status = 'testing', test_sent_at = datetime('now') WHERE id = ? AND status = 'sending'", args: [id] });
  else await db.execute({ sql: "UPDATE campaigns SET status = 'sent', finished_at = datetime('now'), last_error = '' WHERE id = ? AND status = 'sending'", args: [id] });
}

async function variantStats(id) {
  const rows = (await getClient().execute({
    sql: `SELECT variant, COUNT(*) AS sent, SUM(opened_at IS NOT NULL) AS opened, SUM(clicked_at IS NOT NULL) AS clicked
          FROM campaign_recipients WHERE campaign_id = ? AND sent_at IS NOT NULL GROUP BY variant`, args: [id]
  })).rows;
  const out = { a: { sent: 0, opened: 0, clicked: 0 }, b: { sent: 0, opened: 0, clicked: 0 } };
  for (const r of rows) if (out[r.variant]) out[r.variant] = { sent: num(r.sent), opened: num(r.opened), clicked: num(r.clicked) };
  for (const k of ['a', 'b']) { out[k].open_rate = pct(out[k].opened, out[k].sent); out[k].click_rate = pct(out[k].clicked, out[k].sent); }
  return out;
}

export async function pickWinner(id, forced) {
  const db = getClient();
  const c = await getCampaign(id);
  if (!c) return { error: 'Campaign not found' };
  if (c.status !== 'testing') return { error: 'This campaign is not waiting for a test result' };
  let winner = forced === 'a' || forced === 'b' ? forced : '';
  if (!winner) {
    const s = await variantStats(id);
    const key = c.ab && c.ab.metric === 'click' ? 'clicked' : 'opened';
    const rate = (v) => (s[v].sent ? s[v][key] / s[v].sent : 0);
    winner = rate('b') > rate('a') ? 'b' : 'a'; // a draw keeps version A
  }
  const claimed = await db.execute({ sql: "UPDATE campaigns SET status = 'sending', winner = ?, updated_at = datetime('now') WHERE id = ? AND status = 'testing'", args: [winner, id] });
  if (!claimed.rowsAffected) return { error: 'The winner was already chosen' };
  await db.execute({ sql: "UPDATE campaign_recipients SET status = 'queued', variant = ? WHERE campaign_id = ? AND status = 'held'", args: [winner, id] });
  return { winner };
}

export async function controlCampaign(id, op) {
  const db = getClient();
  const c = await getCampaign(id);
  if (!c) return { error: 'Campaign not found' };
  if (op === 'pause') {
    if (c.status !== 'sending') return { error: 'Only a sending campaign can be paused' };
    await db.execute({ sql: "UPDATE campaigns SET status = 'paused', updated_at = datetime('now') WHERE id = ? AND status = 'sending'", args: [id] });
  } else if (op === 'resume') {
    if (c.status !== 'paused') return { error: 'Only a paused campaign can be resumed' };
    await db.execute({ sql: "UPDATE campaigns SET status = 'sending', last_error = '', updated_at = datetime('now') WHERE id = ? AND status = 'paused'", args: [id] });
  } else if (op === 'cancel') {
    if (['draft', 'sent', 'cancelled'].includes(c.status)) return { error: 'There is nothing to cancel' };
    if (c.status === 'scheduled') { await db.execute({ sql: "UPDATE campaigns SET status = 'draft', schedule_at = NULL WHERE id = ?", args: [id] }); return {}; }
    await db.batch([
      { sql: "UPDATE campaign_recipients SET status = 'cancelled' WHERE campaign_id = ? AND status IN ('queued', 'held')", args: [id] },
      { sql: "UPDATE campaigns SET status = 'cancelled', finished_at = datetime('now') WHERE id = ?", args: [id] }
    ], 'write');
  } else return { error: 'Unknown action' };
  return {};
}

async function progress(id) {
  const c = await getCampaign(id);
  const n = (await getClient().execute({
    sql: "SELECT COUNT(*) AS total, SUM(status = 'sent') AS sent, SUM(status IN ('queued', 'sending')) AS queued, SUM(status = 'held') AS held, SUM(status = 'failed') AS failed, SUM(status = 'skipped') AS skipped FROM campaign_recipients WHERE campaign_id = ?", args: [id]
  })).rows[0];
  return { status: c.status, last_error: c.last_error, total: num(n.total), done: num(n.sent), queued: num(n.queued), held: num(n.held), failed_total: num(n.failed), skipped: num(n.skipped) };
}

// Everything due: scheduled campaigns that have reached their time, A/B tests past their wait, and sends in progress.
// Called by the campaign screen and the daily cron.
export async function runDue(budgetMs = 30000) {
  await ensureCampaignTables();
  const db = getClient();
  const deadline = Date.now() + budgetMs;
  const out = { started: 0, winners: 0, sent: 0 };
  for (const r of (await db.execute("SELECT id, schedule_at FROM campaigns WHERE status = 'scheduled'")).rows) {
    if (new Date(r.schedule_at).getTime() > Date.now()) continue;
    const c = await getCampaign(Number(r.id));
    const problem = readiness(c, await getSettings());
    if (problem) { await db.execute({ sql: "UPDATE campaigns SET status = 'paused', last_error = ? WHERE id = ?", args: [problem, c.id] }); continue; }
    const b = await begin(c);
    if (b.started) out.started++;
  }
  for (const r of (await db.execute("SELECT id, ab, test_sent_at FROM campaigns WHERE status = 'testing'")).rows) {
    const ab = parseAb(r.ab);
    const at = new Date(String(r.test_sent_at).replace(' ', 'T') + 'Z').getTime();
    if (ab && Date.now() >= at + ab.wait_hours * 3600000) { const w = await pickWinner(Number(r.id)); if (w.winner) out.winners++; }
  }
  for (const r of (await db.execute("SELECT id FROM campaigns WHERE status = 'sending' ORDER BY id")).rows) {
    const left = deadline - Date.now();
    if (left < 3000) break;
    const p = await runCampaign(Number(r.id), left);
    out.sent += p.sent || 0;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Tracking (called from /api/pulse and /api/unsubscribe)
// ---------------------------------------------------------------------------
const deviceOf = (ua) => (/mobi|iphone|android/i.test(ua || '') ? 'mobile' : /ipad|tablet/i.test(ua || '') ? 'tablet' : 'desktop');
const validToken = (t) => /^[0-9a-f]{32}$/.test(String(t || ''));
export const PIXEL = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');

export async function recordOpen(token, ua, isBot) {
  if (!validToken(token)) return;
  await ensureCampaignTables();
  const db = getClient();
  const r = (await db.execute({ sql: 'SELECT id, campaign_id FROM campaign_recipients WHERE token = ?', args: [token] })).rows[0];
  if (!r || isBot) return;
  await db.batch([
    { sql: "UPDATE campaign_recipients SET open_count = open_count + 1, opened_at = COALESCE(opened_at, datetime('now')) WHERE id = ?", args: [r.id] },
    { sql: "INSERT INTO campaign_events (campaign_id, recipient_id, type, device) VALUES (?, ?, 'open', ?)", args: [r.campaign_id, r.id, deviceOf(ua)] }
  ], 'write');
}

// The target comes from our own table (never from the URL), so this cannot be used as an open redirect.
export async function resolveClick(token, linkId, ua, isBot) {
  if (!validToken(token)) return null;
  await ensureCampaignTables();
  const db = getClient();
  const r = (await db.execute({ sql: 'SELECT id, campaign_id FROM campaign_recipients WHERE token = ?', args: [token] })).rows[0];
  if (!r) return null;
  const l = (await db.execute({ sql: 'SELECT id, url FROM campaign_links WHERE id = ? AND campaign_id = ?', args: [parseInt(linkId) || 0, r.campaign_id] })).rows[0];
  if (!l) return null;
  if (!isBot) {
    await db.batch([
      { sql: "UPDATE campaign_recipients SET click_count = click_count + 1, clicked_at = COALESCE(clicked_at, datetime('now')), opened_at = COALESCE(opened_at, datetime('now')) WHERE id = ?", args: [r.id] },
      { sql: "INSERT INTO campaign_events (campaign_id, recipient_id, type, link_id, device) VALUES (?, ?, 'click', ?, ?)", args: [r.campaign_id, r.id, l.id, deviceOf(ua)] }
    ], 'write');
  }
  const c = await getCampaign(Number(r.campaign_id));
  return taggedUrl(l.url, c);
}
function taggedUrl(url, c) {
  try {
    const u = new URL(url);
    if (!u.searchParams.has('utm_source')) { u.searchParams.set('utm_source', 'email'); u.searchParams.set('utm_medium', 'email'); u.searchParams.set('utm_campaign', slugOf(c)); }
    return u.href;
  } catch (e) { return url; }
}

export async function unsubscribeByToken(token) {
  if (!validToken(token)) return null;
  await ensureCampaignTables();
  const db = getClient();
  const r = (await db.execute({ sql: 'SELECT id, email FROM campaign_recipients WHERE token = ?', args: [token] })).rows[0];
  if (!r) return null;
  await db.execute({ sql: "UPDATE campaign_recipients SET unsubscribed_at = COALESCE(unsubscribed_at, datetime('now')) WHERE id = ?", args: [r.id] });
  await db.execute({ sql: 'DELETE FROM subscribers WHERE email = ?', args: [r.email] });
  await markUnsubscribed(r.email);
  return r.email;
}

// Resend webhook events: delivered, bounced, complained
export async function recordProviderEvent(ev) {
  await ensureCampaignTables();
  const db = getClient();
  const type = String((ev && ev.type) || '');
  const data = (ev && ev.data) || {};
  const id = clip(data.email_id, 100);
  const to = clip(Array.isArray(data.to) ? data.to[0] : data.to, 200).toLowerCase();
  if (type === 'email.delivered' && id) await db.execute({ sql: "UPDATE campaign_recipients SET delivered_at = COALESCE(delivered_at, datetime('now')) WHERE resend_id = ?", args: [id] });
  else if (type === 'email.bounced') {
    const b = data.bounce || {};
    const transient = /transient|temporary/i.test(String(b.type || ''));
    if (id) await db.execute({ sql: "UPDATE campaign_recipients SET bounced_at = COALESCE(bounced_at, datetime('now')), error = ? WHERE resend_id = ?", args: [clip(b.message || b.subType || b.type || 'Bounced', 300), id] });
    if (to && !transient) await suppress(to, 'bounced', clip(b.message || b.subType, 300));
  } else if (type === 'email.complained') {
    if (id) await db.execute({ sql: "UPDATE campaign_recipients SET complained_at = COALESCE(complained_at, datetime('now')) WHERE resend_id = ?", args: [id] });
    if (to) { await suppress(to, 'complained'); await markUnsubscribed(to); await db.execute({ sql: 'DELETE FROM subscribers WHERE email = ?', args: [to] }); }
  }
}

// Svix-style signature used by Resend webhooks (RESEND_WEBHOOK_SECRET = whsec_...)
export function verifyWebhook(rawBody, headers, secret, nowMs = Date.now()) {
  const id = headers['svix-id'], ts = headers['svix-timestamp'], sig = headers['svix-signature'];
  if (!secret || !id || !ts || !sig) return false;
  if (Math.abs(nowMs / 1000 - Number(ts)) > 300) return false;
  const key = Buffer.from(String(secret).replace(/^whsec_/, ''), 'base64');
  const want = crypto.createHmac('sha256', key).update(id + '.' + ts + '.' + rawBody).digest();
  return String(sig).split(/\s+/).some((part) => {
    const got = Buffer.from(part.replace(/^v1,/, ''), 'base64');
    return got.length === want.length && crypto.timingSafeEqual(got, want);
  });
}

// ---------------------------------------------------------------------------
// Reports
// ---------------------------------------------------------------------------
const STATS_SQL = `SELECT campaign_id, COUNT(*) AS recipients, SUM(sent_at IS NOT NULL) AS sent, SUM(delivered_at IS NOT NULL) AS delivered,
  SUM(opened_at IS NOT NULL) AS opened, SUM(clicked_at IS NOT NULL) AS clicked, SUM(bounced_at IS NOT NULL) AS bounced,
  SUM(complained_at IS NOT NULL) AS complained, SUM(unsubscribed_at IS NOT NULL) AS unsubscribed, SUM(status = 'failed') AS failed,
  SUM(status IN ('queued', 'sending')) AS queued, SUM(status = 'held') AS held FROM campaign_recipients`;
function shapeStats(r) {
  const s = {};
  for (const k of ['recipients', 'sent', 'delivered', 'opened', 'clicked', 'bounced', 'complained', 'unsubscribed', 'failed', 'queued', 'held']) s[k] = num(r && r[k]);
  // until delivery webhooks are connected, "delivered" is unknown: fall back to sent minus bounced
  const base = s.delivered || Math.max(s.sent - s.bounced, 0);
  s.delivery_known = s.delivered > 0;
  s.rates = {
    delivery: s.delivered ? pct(s.delivered, s.sent) : null, open: pct(s.opened, base), click: pct(s.clicked, base), click_to_open: pct(s.clicked, s.opened),
    bounce: pct(s.bounced, s.sent), complaint: pct(s.complained, s.sent), unsubscribe: pct(s.unsubscribed, base)
  };
  s.warnings = [];
  if (s.sent >= 20 && s.rates.bounce > 2) s.warnings.push('Bounce rate is ' + s.rates.bounce + '% (keep it under 2%). Clean this list before sending again.');
  if (s.sent >= 20 && s.rates.complaint > 0.1) s.warnings.push('Spam complaints are ' + s.rates.complaint + '% (keep them under 0.1%; Gmail acts at 0.3%). Slow down and review who you are emailing.');
  return s;
}
export async function listCampaigns() {
  await ensureCampaignTables();
  const db = getClient();
  const rows = (await db.execute("SELECT id, name, subject, status, schedule_at, started_at, finished_at, winner, ab, last_error, is_template, created_at FROM campaigns ORDER BY COALESCE(started_at, schedule_at, created_at) DESC, id DESC LIMIT 200")).rows;
  const stats = new Map();
  for (const r of (await db.execute(STATS_SQL + ' GROUP BY campaign_id')).rows) stats.set(Number(r.campaign_id), shapeStats(r));
  return rows.map((c) => ({ ...c, id: Number(c.id), is_template: !!num(c.is_template), ab: parseAb(c.ab), stats: stats.get(Number(c.id)) || shapeStats(null), report_link: '/admin.html#campaign-' + c.id }));
}

export async function campaignReport(id) {
  const c = await getCampaign(id);
  if (!c) return null;
  const db = getClient();
  const stats = shapeStats((await db.execute({ sql: STATS_SQL + ' WHERE campaign_id = ?', args: [id] })).rows[0]);
  const timeline = (await db.execute({
    sql: "SELECT strftime('%Y-%m-%d %H:00', created_at) AS hour, SUM(type = 'open') AS opens, SUM(type = 'click') AS clicks FROM campaign_events WHERE campaign_id = ? GROUP BY hour ORDER BY hour LIMIT 336", args: [id]
  })).rows.map((r) => ({ hour: r.hour, opens: num(r.opens), clicks: num(r.clicks) }));
  const links = (await db.execute({
    sql: `SELECT l.id, l.url, COUNT(e.id) AS clicks, COUNT(DISTINCT e.recipient_id) AS people FROM campaign_links l LEFT JOIN campaign_events e ON e.link_id = l.id AND e.type = 'click' WHERE l.campaign_id = ? GROUP BY l.id ORDER BY clicks DESC`, args: [id]
  })).rows.map((r) => ({ url: r.url, clicks: num(r.clicks), people: num(r.people) }));
  const devices = (await db.execute({ sql: "SELECT device, COUNT(DISTINCT recipient_id) AS people FROM campaign_events WHERE campaign_id = ? GROUP BY device ORDER BY people DESC", args: [id] })).rows.map((r) => ({ device: r.device || 'unknown', people: num(r.people) }));
  const slug = slugOf(c);
  const leads = (await db.execute({
    sql: "SELECT COUNT(*) AS leads, COUNT(DISTINCT s.contact_id) AS people, SUM(s.status = 'won') AS won FROM submissions s WHERE s.utm_campaign = ? AND COALESCE(s.status, 'new') != 'vendor'", args: [slug]
  })).rows[0];
  const revenue = (await db.execute({
    sql: "SELECT COALESCE(SUM(c.lifetime_value), 0) AS value FROM contacts c WHERE c.id IN (SELECT contact_id FROM submissions WHERE utm_campaign = ? AND status = 'won')", args: [slug]
  })).rows[0];
  let visits = 0;
  try { visits = num((await db.execute({ sql: "SELECT COUNT(*) AS n FROM analytics_events WHERE type = 'pageview' AND utm_campaign = ?", args: [slug] })).rows[0].n); } catch (e) {}
  const variants = c.ab ? await variantStats(id) : null;
  const ab = c.ab && variants ? { ...c.ab, variants, winner: c.winner, confidence: confidence(variants.a.sent, variants.a[c.ab.metric === 'click' ? 'clicked' : 'opened'], variants.b.sent, variants.b[c.ab.metric === 'click' ? 'clicked' : 'opened']) } : null;
  return { campaign: { ...c, slug, report_link: '/admin.html#campaign-' + c.id }, stats, timeline, links, devices, leads: num(leads.leads), won: num(leads.won), revenue: num(revenue.value), visits, ab, progress: await progress(id) };
}

const RECIPIENT_FILTERS = { opened: 'opened_at IS NOT NULL', clicked: 'clicked_at IS NOT NULL', bounced: 'bounced_at IS NOT NULL', complained: 'complained_at IS NOT NULL', unsubscribed: 'unsubscribed_at IS NOT NULL', failed: "status = 'failed'", queued: "status IN ('queued', 'sending', 'held')", not_opened: 'sent_at IS NOT NULL AND opened_at IS NULL' };
export async function campaignRecipientRows(id, { filter, limit, offset } = {}) {
  await ensureCampaignTables();
  const f = RECIPIENT_FILTERS[filter] ? ' AND ' + RECIPIENT_FILTERS[filter] : '';
  const db = getClient();
  const rows = (await db.execute({
    sql: `SELECT r.email, r.variant, r.status, r.error, r.sent_at, r.delivered_at, r.opened_at, r.open_count, r.clicked_at, r.click_count, r.bounced_at, r.complained_at, r.unsubscribed_at, c.name, c.id AS contact_id
          FROM campaign_recipients r LEFT JOIN contacts c ON c.id = r.contact_id WHERE r.campaign_id = ?${f} ORDER BY r.id LIMIT ? OFFSET ?`,
    args: [id, Math.min(Math.max(parseInt(limit) || 50, 1), 200), Math.max(parseInt(offset) || 0, 0)]
  })).rows;
  const total = num((await db.execute({ sql: `SELECT COUNT(*) AS n FROM campaign_recipients WHERE campaign_id = ?${f}`, args: [id] })).rows[0].n);
  return { rows, total };
}

// Dashboard / Analytics panel: recent campaigns and email as a channel
export async function campaignsOverview() {
  const all = (await listCampaigns()).filter((c) => !c.is_template && c.stats.sent > 0);
  const t = all.reduce((o, c) => { for (const k of ['sent', 'opened', 'clicked', 'bounced', 'complained', 'unsubscribed']) o[k] += c.stats[k]; return o; }, { sent: 0, opened: 0, clicked: 0, bounced: 0, complained: 0, unsubscribed: 0 });
  const db = getClient();
  const leads = num((await db.execute("SELECT COUNT(*) AS n FROM submissions WHERE utm_campaign LIKE 'email-%' AND COALESCE(status, 'new') != 'vendor'")).rows[0].n);
  return { campaigns: all.slice(0, 5).map((c) => ({ id: c.id, name: c.name, started_at: c.started_at, status: c.status, stats: c.stats, report_link: c.report_link })), count: all.length, totals: { ...t, open_rate: pct(t.opened, t.sent - t.bounced), click_rate: pct(t.clicked, t.sent - t.bounced), leads } };
}
