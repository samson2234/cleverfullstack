// lib/contacts.js — CRM core: people (leads, clients, past clients, partners) + activity timeline.
//
// Why this exists: `submissions` is one row per form post. A real CRM needs ONE record per
// person/company with their whole history, so repeat enquiries, existing clients, imported
// Fiverr clients and future portal users all live in the same place. Built for 10k+ rows:
// every filter column is indexed and lists are paginated server-side.

import { getClient, ensureTable } from './db.js';

export const KINDS = ['lead', 'prospect', 'client', 'past_client', 'partner'];

// Single-flight: concurrent first requests on a cold instance share ONE setup run,
// and a failed setup is retried by the next request instead of being cached.
let setupPromise = null;
export function ensureContactTables() {
  if (!setupPromise) setupPromise = setupContactTables().catch((e) => { setupPromise = null; throw e; });
  return setupPromise;
}

// Another instance may race us on a brand-new database; "already exists" is success.
const tolerant = async (p) => { try { await p; } catch (e) { if (!/duplicate column|already exists/i.test(String(e.message))) throw e; } };

async function setupContactTables() {
  await ensureTable();
  const db = getClient();
  await db.execute(`
    CREATE TABLE IF NOT EXISTS contacts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL COLLATE NOCASE UNIQUE,
      phone TEXT DEFAULT '',
      company TEXT DEFAULT '',
      country TEXT DEFAULT '',
      industry TEXT DEFAULT '',
      kind TEXT DEFAULT 'lead',
      source TEXT DEFAULT '',
      owner TEXT DEFAULT '',
      tags TEXT DEFAULT '',
      lifetime_value INTEGER DEFAULT 0,
      archived INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      last_activity_at TEXT
    )
  `);
  await db.execute(`
    CREATE TABLE IF NOT EXISTS activities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      contact_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      body TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);
  for (const sql of [
    'CREATE INDEX IF NOT EXISTS idx_contacts_kind ON contacts(archived, kind, created_at)',
    'CREATE INDEX IF NOT EXISTS idx_contacts_country ON contacts(country)',
    'CREATE INDEX IF NOT EXISTS idx_contacts_industry ON contacts(industry)',
    'CREATE INDEX IF NOT EXISTS idx_contacts_name ON contacts(name COLLATE NOCASE)',
    'CREATE INDEX IF NOT EXISTS idx_contacts_activity ON contacts(last_activity_at)',
    'CREATE INDEX IF NOT EXISTS idx_activities_contact ON activities(contact_id, created_at)'
  ]) await db.execute(sql);

  // Link submissions -> contacts (column added once; harmless if it already exists)
  const cols = (await db.execute('PRAGMA table_info(submissions)')).rows.map((r) => r.name);
  if (!cols.includes('contact_id')) {
    await tolerant(db.execute('ALTER TABLE submissions ADD COLUMN contact_id INTEGER'));
    await db.execute('CREATE INDEX IF NOT EXISTS idx_submissions_contact ON submissions(contact_id)');
  }
  // Email consent: set when someone clicks unsubscribe in any email we send them
  const ccols = (await db.execute('PRAGMA table_info(contacts)')).rows.map((r) => r.name);
  if (!ccols.includes('unsubscribed_at')) await tolerant(db.execute('ALTER TABLE contacts ADD COLUMN unsubscribed_at TEXT'));

  // One-time backfill of existing submissions into contacts (idempotent: only unlinked rows)
  const unlinked = (await db.execute('SELECT id FROM submissions WHERE contact_id IS NULL LIMIT 1')).rows.length;
  if (unlinked) {
    await db.execute(`
      INSERT OR IGNORE INTO contacts (name, email, phone, company, country, industry, kind, source, created_at, last_activity_at)
      SELECT s.name, s.email, CASE WHEN s.phone = 'Not provided' THEN '' ELSE s.phone END,
             s.company, s.country, s.industry,
             CASE WHEN s.status = 'won' THEN 'client' ELSE 'lead' END,
             COALESCE(s.source, 'website'), MIN(s.created_at), MAX(s.created_at)
      FROM submissions s WHERE s.contact_id IS NULL GROUP BY lower(s.email)
    `);
    await db.execute(`
      UPDATE submissions SET contact_id = (SELECT c.id FROM contacts c WHERE c.email = submissions.email COLLATE NOCASE)
      WHERE contact_id IS NULL
    `);
  }
}

const clip = (v, n) => String(v == null ? '' : v).trim().slice(0, n);
const normTags = (t) => [...new Set(String(t || '').split(',').map((x) => x.trim().toLowerCase().replace(/[^a-z0-9 _-]/g, '')).filter(Boolean))].slice(0, 12).join(',');
const kindOrLead = (k) => (KINDS.includes(k) ? k : 'lead');

// Called by saveSubmission: every form post attaches to ONE person, creating them if new.
export async function linkSubmissionToContact(submissionId, s) {
  await ensureContactTables();
  const db = getClient();
  const email = clip(s.email, 200).toLowerCase();
  const phone = s.phone && s.phone !== 'Not provided' ? clip(s.phone, 40) : '';
  await db.execute({
    sql: `INSERT INTO contacts (name, email, phone, company, country, industry, kind, source, last_activity_at)
          VALUES (?, ?, ?, ?, ?, ?, 'lead', ?, datetime('now'))
          ON CONFLICT(email) DO UPDATE SET
            phone = CASE WHEN contacts.phone = '' THEN excluded.phone ELSE contacts.phone END,
            company = CASE WHEN contacts.company = '' THEN excluded.company ELSE contacts.company END,
            country = CASE WHEN contacts.country = '' THEN excluded.country ELSE contacts.country END,
            industry = CASE WHEN contacts.industry = '' THEN excluded.industry ELSE contacts.industry END,
            archived = 0, updated_at = datetime('now'), last_activity_at = datetime('now')`,
    args: [clip(s.name, 120), email, phone, clip(s.company, 160), clip(s.country, 80), clip(s.industry, 100), clip(s.source, 120)]
  });
  const row = (await db.execute({ sql: 'SELECT id FROM contacts WHERE email = ?', args: [email] })).rows[0];
  await db.execute({ sql: 'UPDATE submissions SET contact_id = ? WHERE id = ?', args: [row.id, submissionId] });
  await addActivity(Number(row.id), 'form', clip(s.message, 500) || 'Submitted the contact form');
  return Number(row.id);
}

export async function addActivity(contactId, type, body) {
  await ensureContactTables();
  const db = getClient();
  await db.execute({ sql: 'INSERT INTO activities (contact_id, type, body) VALUES (?, ?, ?)', args: [contactId, clip(type, 30), clip(body, 2000)] });
  await db.execute({ sql: "UPDATE contacts SET last_activity_at = datetime('now'), updated_at = datetime('now') WHERE id = ?", args: [contactId] });
}

function buildWhere({ q, kind, country, industry, tag, archived, inactiveDays, subscribedOnly }) {
  const w = [archived ? 'archived = 1' : 'archived = 0'];
  const a = [];
  const days = parseInt(inactiveDays);
  if (days > 0) { w.push("COALESCE(last_activity_at, created_at) < datetime('now', ?)"); a.push('-' + Math.min(days, 3650) + ' days'); }
  if (subscribedOnly) w.push('unsubscribed_at IS NULL');
  if (kind && KINDS.includes(kind)) { w.push('kind = ?'); a.push(kind); }
  if (country) { w.push('country = ?'); a.push(country); }
  if (industry) { w.push('industry = ?'); a.push(industry); }
  if (tag) { w.push("(',' || tags || ',') LIKE ?"); a.push('%,' + String(tag).toLowerCase() + ',%'); }
  if (q) {
    const like = '%' + String(q).replace(/[%_]/g, ' ').trim() + '%';
    w.push('(name LIKE ? OR email LIKE ? OR company LIKE ? OR phone LIKE ?)');
    a.push(like, like, like, like);
  }
  return { where: 'WHERE ' + w.join(' AND '), args: a };
}

export async function listContacts(opts) {
  await ensureContactTables();
  const db = getClient();
  const { where, args } = buildWhere(opts);
  const sorts = { recent: 'COALESCE(last_activity_at, created_at) DESC', newest: 'created_at DESC', name: 'name COLLATE NOCASE ASC', value: 'lifetime_value DESC' };
  const order = sorts[opts.sort] || sorts.recent;
  const limit = Math.min(Math.max(parseInt(opts.limit) || 50, 1), 200);
  const offset = Math.max(parseInt(opts.offset) || 0, 0);
  const rows = (await db.execute({
    sql: `SELECT id, name, email, phone, company, country, industry, kind, source, owner, tags, lifetime_value, created_at, last_activity_at, unsubscribed_at
          FROM contacts ${where} ORDER BY ${order} LIMIT ? OFFSET ?`,
    args: [...args, limit, offset]
  })).rows;
  const total = Number((await db.execute({ sql: `SELECT COUNT(*) AS n FROM contacts ${where}`, args })).rows[0].n);
  return { rows, total, limit, offset };
}

export async function getContactStats() {
  await ensureContactTables();
  const db = getClient();
  const byKind = {};
  for (const r of (await db.execute('SELECT kind, COUNT(*) AS n FROM contacts WHERE archived = 0 GROUP BY kind')).rows) byKind[r.kind] = Number(r.n);
  const countries = (await db.execute("SELECT country AS v, COUNT(*) AS n FROM contacts WHERE archived = 0 AND country <> '' GROUP BY country ORDER BY n DESC LIMIT 60")).rows.map((r) => ({ label: r.v, count: Number(r.n) }));
  const industries = (await db.execute("SELECT industry AS v, COUNT(*) AS n FROM contacts WHERE archived = 0 AND industry <> '' GROUP BY industry ORDER BY n DESC LIMIT 60")).rows.map((r) => ({ label: r.v, count: Number(r.n) }));
  return { byKind, total: Object.values(byKind).reduce((a, b) => a + b, 0), countries, industries };
}

export async function getContact(id) {
  await ensureContactTables();
  const db = getClient();
  const c = (await db.execute({ sql: 'SELECT * FROM contacts WHERE id = ?', args: [id] })).rows[0];
  if (!c) return null;
  const activities = (await db.execute({ sql: 'SELECT id, type, body, created_at FROM activities WHERE contact_id = ? ORDER BY id DESC LIMIT 100', args: [id] })).rows;
  const submissions = (await db.execute({ sql: 'SELECT id, message, status, created_at FROM submissions WHERE contact_id = ? ORDER BY id DESC LIMIT 20', args: [id] })).rows;
  return { contact: c, activities, submissions };
}

export async function createContact(d) {
  await ensureContactTables();
  const db = getClient();
  const email = clip(d.email, 200).toLowerCase();
  const r = await db.execute({
    sql: `INSERT INTO contacts (name, email, phone, company, country, industry, kind, source, owner, tags, lifetime_value, last_activity_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
    args: [clip(d.name, 120), email, clip(d.phone, 40), clip(d.company, 160), clip(d.country, 80), clip(d.industry, 100),
      kindOrLead(d.kind), clip(d.source, 120) || 'manual', clip(d.owner, 80), normTags(d.tags), Math.max(0, parseInt(d.lifetime_value) || 0)]
  });
  return Number(r.lastInsertRowid);
}

const EDITABLE = { name: 120, phone: 40, company: 160, country: 80, industry: 100, source: 120, owner: 80 };
export async function updateContact(id, d) {
  await ensureContactTables();
  const sets = [];
  const args = [];
  for (const [k, max] of Object.entries(EDITABLE)) if (d[k] !== undefined) { sets.push(k + ' = ?'); args.push(clip(d[k], max)); }
  if (d.kind !== undefined && KINDS.includes(d.kind)) { sets.push('kind = ?'); args.push(d.kind); }
  if (d.tags !== undefined) { sets.push('tags = ?'); args.push(normTags(d.tags)); }
  if (d.lifetime_value !== undefined) { sets.push('lifetime_value = ?'); args.push(Math.max(0, parseInt(d.lifetime_value) || 0)); }
  if (d.archived !== undefined) { sets.push('archived = ?'); args.push(d.archived ? 1 : 0); }
  if (!sets.length) return;
  sets.push("updated_at = datetime('now')");
  await getClient().execute({ sql: `UPDATE contacts SET ${sets.join(', ')} WHERE id = ?`, args: [...args, id] });
}

// Bulk import (CSV from the admin UI, Fiverr export, etc). Dedupes on email; never downgrades an existing client.
export async function importContacts(rows, defaults = {}) {
  await ensureContactTables();
  const db = getClient();
  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  let created = 0, updated = 0, skipped = 0;
  const seen = new Set();
  const stmts = [];
  for (const r of rows.slice(0, 5000)) {
    const email = clip(r.email, 200).toLowerCase();
    const name = clip(r.name, 120) || email.split('@')[0];
    if (!emailRe.test(email) || seen.has(email)) { skipped++; continue; }
    seen.add(email);
    stmts.push({
      sql: `INSERT INTO contacts (name, email, phone, company, country, industry, kind, source, tags, lifetime_value, last_activity_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
            ON CONFLICT(email) DO UPDATE SET
              phone = CASE WHEN contacts.phone = '' THEN excluded.phone ELSE contacts.phone END,
              company = CASE WHEN contacts.company = '' THEN excluded.company ELSE contacts.company END,
              country = CASE WHEN contacts.country = '' THEN excluded.country ELSE contacts.country END,
              industry = CASE WHEN contacts.industry = '' THEN excluded.industry ELSE contacts.industry END,
              archived = 0, updated_at = datetime('now')`,
      args: [name, email, clip(r.phone, 40), clip(r.company, 160), clip(r.country, 80), clip(r.industry, 100),
        kindOrLead(r.kind || defaults.kind), clip(r.source || defaults.source, 120) || 'import', normTags(r.tags || defaults.tags),
        Math.max(0, parseInt(r.lifetime_value) || 0)]
    });
  }
  const before = Number((await db.execute('SELECT COUNT(*) AS n FROM contacts')).rows[0].n);
  for (let i = 0; i < stmts.length; i += 200) await db.batch(stmts.slice(i, i + 200), 'write');
  const after = Number((await db.execute('SELECT COUNT(*) AS n FROM contacts')).rows[0].n);
  created = after - before;
  updated = stmts.length - created;
  return { created, updated, skipped };
}

// ---------------------------------------------------------------------------
// Retention: self-identified returning clients, unsubscribes, win-back campaigns
// ---------------------------------------------------------------------------

// A past client found the "welcome back" page. Never downgrades an existing client/partner,
// and never overwrites what we already know. Marked 'self-identified' until the owner confirms them.
export async function upsertReturningClient(d) {
  await ensureContactTables();
  const db = getClient();
  const email = clip(d.email, 200).toLowerCase();
  await db.execute({
    sql: `INSERT INTO contacts (name, email, company, country, kind, source, tags, last_activity_at)
          VALUES (?, ?, ?, ?, 'past_client', 'returning-client-page', 'self-identified', datetime('now'))
          ON CONFLICT(email) DO UPDATE SET
            company = CASE WHEN contacts.company = '' THEN excluded.company ELSE contacts.company END,
            country = CASE WHEN contacts.country = '' THEN excluded.country ELSE contacts.country END,
            kind = CASE WHEN contacts.kind IN ('lead','prospect') THEN 'past_client' ELSE contacts.kind END,
            archived = 0, updated_at = datetime('now'), last_activity_at = datetime('now')`,
    args: [clip(d.name, 120), email, clip(d.company, 160), clip(d.country, 80)]
  });
  const row = (await db.execute({ sql: 'SELECT id FROM contacts WHERE email = ?', args: [email] })).rows[0];
  const id = Number(row.id);
  const bits = [d.channel && 'Found us via: ' + clip(d.channel, 80), d.project && 'Past project: ' + clip(d.project, 200), d.need && 'Needs now: ' + clip(d.need, 800)].filter(Boolean);
  await addActivity(id, 'reconnect', bits.join('\n') || 'Used the returning-client page');
  return id;
}

export async function markUnsubscribed(email) {
  await ensureContactTables();
  const e = clip(email, 200).toLowerCase();
  await getClient().execute({ sql: "UPDATE contacts SET unsubscribed_at = COALESCE(unsubscribed_at, datetime('now')) WHERE email = ?", args: [e] });
}

const likeEsc = (s) => String(s).replace(/[%_\\]/g, ' ');
const campaignTag = (name) => 'Campaign "' + clip(name, 80) + '"';

// Who would receive this campaign? Excludes archived, unsubscribed, and anyone who already got it.
export async function campaignRecipients(filters, campaign, limit) {
  await ensureContactTables();
  const { where, args } = buildWhere({ ...filters, subscribedOnly: true });
  const sql = `FROM contacts ${where}
    AND NOT EXISTS (SELECT 1 FROM activities a WHERE a.contact_id = contacts.id AND a.type = 'campaign' AND a.body LIKE ?)`;
  const a2 = [...args, likeEsc(campaignTag(campaign)) + '%'];
  const db = getClient();
  const total = Number((await db.execute({ sql: 'SELECT COUNT(*) AS n ' + sql, args: a2 })).rows[0].n);
  const rows = limit ? (await db.execute({ sql: 'SELECT id, name, email ' + sql + ' ORDER BY id LIMIT ?', args: [...a2, limit] })).rows : [];
  return { total, rows };
}

export async function recordCampaignSent(contactId, campaign, subject) {
  await addActivity(contactId, 'campaign', campaignTag(campaign) + ': ' + clip(subject, 200));
}

export async function exportContacts(opts) {
  const all = [];
  for (let off = 0; off < 20000; off += 200) {
    const { rows } = await listContacts({ ...opts, limit: 200, offset: off, sort: 'newest' });
    all.push(...rows);
    if (rows.length < 200) break;
  }
  return all;
}
