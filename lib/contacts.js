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

const STARTER_LISTS = [
  ['Follow-up client', 'People to follow up with'],
  ['Upsell client', 'Existing clients to offer more to'],
  ['Interested but not ready', 'Keen, but not ready to start yet']
];

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
  if (!ccols.includes('consent')) await tolerant(db.execute("ALTER TABLE contacts ADD COLUMN consent TEXT DEFAULT ''")); // how we got permission to email them
  if (!ccols.includes('fields')) await tolerant(db.execute("ALTER TABLE contacts ADD COLUMN fields TEXT DEFAULT ''")); // extra import columns, for merge fields

  // Audience: lists the owner creates, and the suppression list every campaign must respect
  const hadLists = (await db.execute("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'lists'")).rows.length > 0;
  await db.execute(`CREATE TABLE IF NOT EXISTS lists (
    id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL COLLATE NOCASE UNIQUE, description TEXT DEFAULT '', created_at TEXT DEFAULT (datetime('now')))`);
  await db.execute(`CREATE TABLE IF NOT EXISTS list_members (
    list_id INTEGER NOT NULL, contact_id INTEGER NOT NULL, added_at TEXT DEFAULT (datetime('now')), PRIMARY KEY (list_id, contact_id))`);
  await db.execute('CREATE INDEX IF NOT EXISTS idx_list_members_contact ON list_members(contact_id)');
  await db.execute(`CREATE TABLE IF NOT EXISTS email_suppressions (
    email TEXT PRIMARY KEY COLLATE NOCASE, reason TEXT NOT NULL, detail TEXT DEFAULT '', created_at TEXT DEFAULT (datetime('now')))`);
  if (!hadLists) { // starter lists, once only: a list the owner deletes must not come back
    for (const [name, description] of STARTER_LISTS) await db.execute({ sql: 'INSERT OR IGNORE INTO lists (name, description) VALUES (?, ?)', args: [name, description] });
  }
  // One audience: every active newsletter subscriber is a contact tagged "newsletter"; past unsubscribes are suppressed
  await db.execute(`INSERT OR IGNORE INTO contacts (name, email, kind, source, tags, created_at, last_activity_at)
    SELECT CASE WHEN s.name <> '' THEN s.name ELSE substr(s.email, 1, instr(s.email, '@') - 1) END, lower(s.email), 'lead', COALESCE(s.source, 'newsletter'), 'newsletter', s.created_at, s.created_at
    FROM subscribers s WHERE s.status = 'active'`);
  await db.execute(`UPDATE contacts SET tags = CASE WHEN tags = '' THEN 'newsletter' ELSE tags || ',newsletter' END
    WHERE (',' || tags || ',') NOT LIKE '%,newsletter,%' AND email IN (SELECT email FROM subscribers WHERE status = 'active')`);
  await db.execute(`INSERT OR IGNORE INTO email_suppressions (email, reason, created_at)
    SELECT email, 'unsubscribed', unsubscribed_at FROM contacts WHERE unsubscribed_at IS NOT NULL`);

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

function buildWhere({ q, kind, country, industry, tag, list, archived, inactiveDays, subscribedOnly }) {
  const w = [archived ? 'archived = 1' : 'archived = 0'];
  const a = [];
  const days = parseInt(inactiveDays);
  if (days > 0) { w.push("COALESCE(last_activity_at, created_at) < datetime('now', ?)"); a.push('-' + Math.min(days, 3650) + ' days'); }
  if (subscribedOnly) w.push('unsubscribed_at IS NULL AND NOT EXISTS (SELECT 1 FROM email_suppressions x WHERE x.email = contacts.email)');
  if (parseInt(list) > 0) { w.push('EXISTS (SELECT 1 FROM list_members m WHERE m.contact_id = contacts.id AND m.list_id = ?)'); a.push(parseInt(list)); }
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
    sql: `SELECT id, name, email, phone, company, country, industry, kind, source, owner, tags, lifetime_value, created_at, last_activity_at, unsubscribed_at,
                 (SELECT group_concat(l.name, '|') FROM list_members m JOIN lists l ON l.id = m.list_id WHERE m.contact_id = contacts.id) AS list_names
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
  await suppress(e, 'unsubscribed');
}

// ---------------------------------------------------------------------------
// Suppression: unsubscribed, bounced and complained addresses are never emailed by a campaign
// ---------------------------------------------------------------------------
export const SUPPRESSION_REASONS = ['unsubscribed', 'bounced', 'complained', 'manual'];

export async function suppress(email, reason, detail) {
  await ensureContactTables();
  const e = clip(email, 200).toLowerCase();
  if (!e || !SUPPRESSION_REASONS.includes(reason)) return;
  // a complaint outranks anything already recorded; otherwise the first reason stands
  await getClient().execute({
    sql: `INSERT INTO email_suppressions (email, reason, detail) VALUES (?, ?, ?)
          ON CONFLICT(email) DO UPDATE SET reason = CASE WHEN excluded.reason = 'complained' THEN 'complained' ELSE email_suppressions.reason END`,
    args: [e, reason, clip(detail, 300)]
  });
}

// Only the owner's own additions and bounces can be lifted by hand. Someone who unsubscribed or reported spam
// stays out until they sign up again themselves.
export async function unsuppress(email) {
  await ensureContactTables();
  const db = getClient();
  const e = clip(email, 200).toLowerCase();
  const row = (await db.execute({ sql: 'SELECT reason FROM email_suppressions WHERE email = ?', args: [e] })).rows[0];
  if (!row) return { removed: false, error: 'That address is not on the list' };
  if (row.reason === 'unsubscribed' || row.reason === 'complained') return { removed: false, error: 'This person ' + (row.reason === 'complained' ? 'reported spam' : 'unsubscribed') + ', so they cannot be added back by hand' };
  await db.execute({ sql: 'DELETE FROM email_suppressions WHERE email = ?', args: [e] });
  return { removed: true };
}

export async function listSuppressions({ q, limit, offset } = {}) {
  await ensureContactTables();
  const db = getClient();
  const like = q ? '%' + likeEsc(q).trim() + '%' : '';
  const where = like ? 'WHERE email LIKE ?' : '';
  const args = like ? [like] : [];
  const rows = (await db.execute({ sql: `SELECT email, reason, detail, created_at FROM email_suppressions ${where} ORDER BY created_at DESC, email LIMIT ? OFFSET ?`,
    args: [...args, Math.min(Math.max(parseInt(limit) || 100, 1), 200), Math.max(parseInt(offset) || 0, 0)] })).rows;
  const byReason = {};
  for (const r of (await db.execute('SELECT reason, COUNT(*) AS n FROM email_suppressions GROUP BY reason')).rows) byReason[r.reason] = Number(r.n);
  const total = Number((await db.execute({ sql: `SELECT COUNT(*) AS n FROM email_suppressions ${where}`, args })).rows[0].n);
  return { rows, total, byReason };
}

// Someone signed up for the newsletter: they are one contact, tagged "newsletter". Signing up again after an
// unsubscribe is their own choice, so it lifts that (never a bounce or a spam complaint).
export async function syncSubscriberToContact(email, name, source) {
  await ensureContactTables();
  const db = getClient();
  const e = clip(email, 200).toLowerCase();
  await db.execute({
    sql: `INSERT INTO contacts (name, email, kind, source, tags, last_activity_at) VALUES (?, ?, 'lead', ?, 'newsletter', datetime('now'))
          ON CONFLICT(email) DO UPDATE SET archived = 0, unsubscribed_at = NULL, updated_at = datetime('now'),
            tags = CASE WHEN (',' || contacts.tags || ',') LIKE '%,newsletter,%' THEN contacts.tags WHEN contacts.tags = '' THEN 'newsletter' ELSE contacts.tags || ',newsletter' END`,
    args: [clip(name, 120) || e.split('@')[0], e, clip(source, 120) || 'newsletter']
  });
  await db.execute({ sql: "DELETE FROM email_suppressions WHERE email = ? AND reason = 'unsubscribed'", args: [e] });
}

export async function removeNewsletterTag(email) {
  await ensureContactTables();
  await getClient().execute({
    sql: "UPDATE contacts SET tags = trim(replace(',' || tags || ',', ',newsletter,', ','), ',') WHERE email = ?",
    args: [clip(email, 200).toLowerCase()]
  });
}

// ---------------------------------------------------------------------------
// Lists (Follow-up client, Upsell client, ...): one person can be on many
// ---------------------------------------------------------------------------
export async function listLists() {
  await ensureContactTables();
  return (await getClient().execute(`
    SELECT l.id, l.name, l.description, l.created_at, COUNT(c.id) AS members,
      SUM(CASE WHEN c.id IS NOT NULL AND c.unsubscribed_at IS NULL AND x.email IS NULL THEN 1 ELSE 0 END) AS mailable
    FROM lists l
    LEFT JOIN list_members m ON m.list_id = l.id
    LEFT JOIN contacts c ON c.id = m.contact_id AND c.archived = 0
    LEFT JOIN email_suppressions x ON x.email = c.email
    GROUP BY l.id ORDER BY l.name COLLATE NOCASE`)).rows.map((r) => ({ ...r, id: Number(r.id), members: Number(r.members), mailable: Number(r.mailable || 0) }));
}

export async function createList(name, description) {
  await ensureContactTables();
  const n = clip(name, 60);
  if (n.length < 2) return { error: 'Give the list a name' };
  try {
    const r = await getClient().execute({ sql: 'INSERT INTO lists (name, description) VALUES (?, ?)', args: [n, clip(description, 200)] });
    return { id: Number(r.lastInsertRowid) };
  } catch (e) {
    if (/unique/i.test(e.message)) return { error: 'A list with that name already exists' };
    throw e;
  }
}

export async function updateList(id, { name, description }) {
  await ensureContactTables();
  const n = clip(name, 60);
  if (n.length < 2) return { error: 'Give the list a name' };
  try {
    await getClient().execute({ sql: 'UPDATE lists SET name = ?, description = ? WHERE id = ?', args: [n, clip(description, 200), id] });
    return {};
  } catch (e) {
    if (/unique/i.test(e.message)) return { error: 'A list with that name already exists' };
    throw e;
  }
}

export async function deleteList(id) {
  await ensureContactTables();
  await getClient().batch([
    { sql: 'DELETE FROM list_members WHERE list_id = ?', args: [id] },
    { sql: 'DELETE FROM lists WHERE id = ?', args: [id] }
  ], 'write');
}

// Who to add: contact ids, emails (only people who are already contacts), and/or everyone matching contact filters
export async function addToList(listId, { contactIds, emails, filters } = {}) {
  await ensureContactTables();
  const db = getClient();
  if (!(await db.execute({ sql: 'SELECT 1 FROM lists WHERE id = ?', args: [listId] })).rows.length) return { error: 'List not found' };
  const count = async () => Number((await db.execute({ sql: 'SELECT COUNT(*) AS n FROM list_members WHERE list_id = ?', args: [listId] })).rows[0].n);
  const before = await count();
  const ids = (contactIds || []).map((x) => parseInt(x)).filter((x) => x > 0);
  for (let i = 0; i < ids.length; i += 200) {
    const chunk = ids.slice(i, i + 200);
    await db.execute({ sql: `INSERT OR IGNORE INTO list_members (list_id, contact_id) SELECT ?, id FROM contacts WHERE id IN (${chunk.map(() => '?').join(',')})`, args: [listId, ...chunk] });
  }
  const mails = (emails || []).map((x) => clip(x, 200).toLowerCase()).filter(Boolean);
  for (let i = 0; i < mails.length; i += 200) {
    const chunk = mails.slice(i, i + 200);
    await db.execute({ sql: `INSERT OR IGNORE INTO list_members (list_id, contact_id) SELECT ?, id FROM contacts WHERE email IN (${chunk.map(() => '?').join(',')})`, args: [listId, ...chunk] });
  }
  if (filters) {
    const { where, args } = buildWhere(filters);
    await db.execute({ sql: `INSERT OR IGNORE INTO list_members (list_id, contact_id) SELECT ?, id FROM contacts ${where}`, args: [listId, ...args] });
  }
  return { added: (await count()) - before };
}

export async function removeFromList(listId, contactIds) {
  await ensureContactTables();
  const ids = (contactIds || []).map((x) => parseInt(x)).filter((x) => x > 0);
  const db = getClient();
  for (let i = 0; i < ids.length; i += 200) {
    const chunk = ids.slice(i, i + 200);
    await db.execute({ sql: `DELETE FROM list_members WHERE list_id = ? AND contact_id IN (${chunk.map(() => '?').join(',')})`, args: [listId, ...chunk] });
  }
}

// A person's lists and tags by email, for the chips on the contact, lead and Inbox screens
export async function audienceOf(email) {
  await ensureContactTables();
  const db = getClient();
  const e = clip(email, 200).toLowerCase();
  const c = (await db.execute({ sql: 'SELECT id, name, tags, kind FROM contacts WHERE email = ?', args: [e] })).rows[0];
  const all = (await db.execute('SELECT id, name FROM lists ORDER BY name COLLATE NOCASE')).rows.map((l) => ({ id: Number(l.id), name: l.name }));
  const x = (await db.execute({ sql: 'SELECT reason FROM email_suppressions WHERE email = ?', args: [e] })).rows[0];
  if (!c) return { contact_id: null, email: e, tags: [], lists: [], all_lists: all, suppressed: x ? x.reason : null };
  const mine = (await db.execute({ sql: 'SELECT list_id FROM list_members WHERE contact_id = ?', args: [c.id] })).rows.map((r) => Number(r.list_id));
  return { contact_id: Number(c.id), email: e, kind: c.kind, tags: String(c.tags || '').split(',').filter(Boolean), lists: all.filter((l) => mine.includes(l.id)), all_lists: all, suppressed: x ? x.reason : null };
}

// Change one person's list or tag from any screen; a person who is not a contact yet becomes one
export async function setAudience(email, { name, listId, addTag, removeTag, add } = {}) {
  await ensureContactTables();
  const db = getClient();
  const e = clip(email, 200).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return { error: 'A valid email is needed' };
  await db.execute({ sql: "INSERT OR IGNORE INTO contacts (name, email, kind, source, last_activity_at) VALUES (?, ?, 'lead', 'crm', datetime('now'))", args: [clip(name, 120) || e.split('@')[0], e] });
  const c = (await db.execute({ sql: 'SELECT id, tags FROM contacts WHERE email = ?', args: [e] })).rows[0];
  const id = Number(c.id);
  if (parseInt(listId) > 0) {
    if (add) { const r = await addToList(parseInt(listId), { contactIds: [id] }); if (r.error) return r; }
    else await removeFromList(parseInt(listId), [id]);
  }
  if (addTag || removeTag) {
    let tags = String(c.tags || '').split(',').filter(Boolean);
    if (addTag) tags.push(addTag);
    if (removeTag) tags = tags.filter((t) => t !== String(removeTag).toLowerCase());
    await updateContact(id, { tags: tags.join(',') });
  }
  return { contact_id: id };
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

// ---------------------------------------------------------------------------
// Import for campaigns: rows already mapped by the screen. Merges duplicates, never downgrades anyone, records how
// we got permission, adds to a list and tags, and reports what happened.
// ---------------------------------------------------------------------------
export const CONSENT = ['opted_in', 'customer', 'enquiry', 'event', 'unknown'];
export async function importAudience(rows, { listId, tags, source, consent } = {}) {
  await ensureContactTables();
  const db = getClient();
  const emailRe = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;
  const how = CONSENT.includes(consent) ? consent : 'unknown';
  const seen = new Set();
  let invalid = 0, duplicates = 0;
  const good = [];
  for (const r of (Array.isArray(rows) ? rows : []).slice(0, 1000)) {
    const email = clip(r && r.email, 200).toLowerCase();
    if (!emailRe.test(email)) { invalid++; continue; }
    if (seen.has(email)) { duplicates++; continue; }
    seen.add(email);
    good.push({ ...r, email });
  }
  const before = Number((await db.execute('SELECT COUNT(*) AS n FROM contacts')).rows[0].n);
  const stmts = good.map((r) => {
    const name = clip(r.name || [r.first_name, r.last_name].filter(Boolean).join(' '), 120) || r.email.split('@')[0];
    const extra = {};
    for (const [k, v] of Object.entries(r.extra || {}).slice(0, 20)) { const key = clip(k, 40).toLowerCase().replace(/[^a-z0-9]+/g, '_'); if (key && clip(v, 300)) extra[key] = clip(v, 300); }
    return {
      sql: `INSERT INTO contacts (name, email, phone, company, country, industry, kind, source, consent, fields, last_activity_at)
            VALUES (?, ?, ?, ?, ?, ?, 'lead', ?, ?, ?, datetime('now'))
            ON CONFLICT(email) DO UPDATE SET
              phone = CASE WHEN contacts.phone = '' THEN excluded.phone ELSE contacts.phone END,
              company = CASE WHEN contacts.company = '' THEN excluded.company ELSE contacts.company END,
              country = CASE WHEN contacts.country = '' THEN excluded.country ELSE contacts.country END,
              industry = CASE WHEN contacts.industry = '' THEN excluded.industry ELSE contacts.industry END,
              consent = CASE WHEN COALESCE(contacts.consent, '') IN ('', 'unknown') THEN excluded.consent ELSE contacts.consent END,
              fields = CASE WHEN excluded.fields = '' THEN contacts.fields ELSE excluded.fields END,
              archived = 0, updated_at = datetime('now')`,
      args: [name, r.email, clip(r.phone, 40), clip(r.company, 160), clip(r.country, 80), clip(r.industry, 100), clip(source, 120) || 'import', how, Object.keys(extra).length ? JSON.stringify(extra) : '']
    };
  });
  for (let i = 0; i < stmts.length; i += 200) await db.batch(stmts.slice(i, i + 200), 'write');
  const created = Number((await db.execute('SELECT COUNT(*) AS n FROM contacts')).rows[0].n) - before;
  const emails = good.map((r) => r.email);
  let suppressed = 0;
  for (let i = 0; i < emails.length; i += 200) {
    const chunk = emails.slice(i, i + 200);
    const marks = chunk.map(() => '?').join(',');
    suppressed += Number((await db.execute({ sql: `SELECT COUNT(*) AS n FROM email_suppressions WHERE email IN (${marks})`, args: chunk })).rows[0].n);
    for (const t of String(normTags(tags)).split(',').filter(Boolean)) {
      await db.execute({ sql: `UPDATE contacts SET tags = CASE WHEN tags = '' THEN ? ELSE tags || ',' || ? END WHERE email IN (${marks}) AND (',' || tags || ',') NOT LIKE ?`, args: [t, t, ...chunk, '%,' + t + ',%'] });
    }
  }
  let added = 0;
  if (parseInt(listId) > 0 && emails.length) { const r = await addToList(parseInt(listId), { emails }); added = r.added || 0; }
  return { created, updated: good.length - created, invalid, duplicates, suppressed, added };
}

// One click: website leads or newsletter subscribers into a list. They are contacts already (see syncSubscriberToContact).
export async function importFromSite({ source, status, since, listId, tags }) {
  await ensureContactTables();
  const db = getClient();
  if (!(await db.execute({ sql: 'SELECT 1 FROM lists WHERE id = ?', args: [parseInt(listId) || 0] })).rows.length) return { error: 'Choose a list' };
  const w = ['c.archived = 0'], a = [];
  if (source === 'subscribers') w.push("(',' || c.tags || ',') LIKE '%,newsletter,%'");
  else {
    const sub = ["s.contact_id = c.id", "COALESCE(s.status, 'new') != 'vendor'"];
    if (status) { sub.push("COALESCE(s.status, 'new') = ?"); a.push(clip(status, 30)); }
    if (/^\d{4}-\d{2}-\d{2}$/.test(String(since || ''))) { sub.push('s.created_at >= ?'); a.push(since); }
    w.push('EXISTS (SELECT 1 FROM submissions s WHERE ' + sub.join(' AND ') + ')');
  }
  const ids = (await db.execute({ sql: 'SELECT c.id FROM contacts c WHERE ' + w.join(' AND '), args: a })).rows.map((r) => Number(r.id));
  const r = await addToList(parseInt(listId), { contactIds: ids });
  for (const t of String(normTags(tags)).split(',').filter(Boolean)) {
    for (let i = 0; i < ids.length; i += 200) {
      const chunk = ids.slice(i, i + 200);
      await db.execute({ sql: `UPDATE contacts SET tags = CASE WHEN tags = '' THEN ? ELSE tags || ',' || ? END WHERE id IN (${chunk.map(() => '?').join(',')}) AND (',' || tags || ',') NOT LIKE ?`, args: [t, t, ...chunk, '%,' + t + ',%'] });
    }
  }
  return { matched: ids.length, added: r.added || 0 };
}
