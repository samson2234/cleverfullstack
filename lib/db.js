// lib/db.js — Turso (libSQL) database connection
//
// SETUP:
//   1. Create a free Turso account at https://turso.tech
//   2. Create a database: turso db create cleverstack-contacts
//   3. Get your auth token: turso db tokens create cleverstack-contacts
//   4. Get your database URL: turso db show cleverstack-contacts --url
//   5. In Vercel Dashboard -> Settings -> Environment Variables, add:
//        TURSO_DATABASE_URL = libsql://cleverstack-contacts-yourorg.turso.io
//        TURSO_AUTH_TOKEN = your_token_here

import { createClient } from '@libsql/client';

let client = null;

export function getClient() {
  if (client) return client;

  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;

  if (!url) {
    throw new Error('TURSO_DATABASE_URL environment variable is not set');
  }

  client = createClient({
    url: url,
    authToken: authToken || undefined
  });

  return client;
}

// Initialize tables (safe to call multiple times)
export async function ensureTable() {
  const db = getClient();
  await db.execute(`
    CREATE TABLE IF NOT EXISTS submissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT DEFAULT 'Not provided',
      country TEXT DEFAULT '',
      company TEXT DEFAULT '',
      industry TEXT DEFAULT '',
      message TEXT NOT NULL,
      source TEXT DEFAULT 'cleverstack.dev contact form',
      utm_source TEXT,
      utm_medium TEXT,
      utm_campaign TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      is_read INTEGER DEFAULT 0,
      status TEXT DEFAULT 'new',
      notes TEXT DEFAULT '',
      follow_up_date TEXT
    )
  `);
  await db.execute(`
    CREATE TABLE IF NOT EXISTS subscribers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      name TEXT DEFAULT '',
      source TEXT DEFAULT 'newsletter',
      created_at TEXT DEFAULT (datetime('now')),
      status TEXT DEFAULT 'active'
    )
  `);
  await db.execute(`
    CREATE TABLE IF NOT EXISTS email_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      to_email TEXT NOT NULL,
      type TEXT NOT NULL,
      subject TEXT DEFAULT '',
      status TEXT DEFAULT 'sent',
      error TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);
  // Add columns to pre-existing tables (ignore duplicate-column errors)
  const extra = [
    'ALTER TABLE submissions ADD COLUMN utm_source TEXT',
    'ALTER TABLE submissions ADD COLUMN utm_medium TEXT',
    'ALTER TABLE submissions ADD COLUMN utm_campaign TEXT',
    "ALTER TABLE submissions ADD COLUMN country TEXT DEFAULT ''",
    "ALTER TABLE submissions ADD COLUMN company TEXT DEFAULT ''",
    "ALTER TABLE submissions ADD COLUMN industry TEXT DEFAULT ''",
    "ALTER TABLE submissions ADD COLUMN status TEXT DEFAULT 'new'",
    "ALTER TABLE submissions ADD COLUMN notes TEXT DEFAULT ''",
    'ALTER TABLE submissions ADD COLUMN follow_up_date TEXT'
  ];
  for (const sql of extra) {
    try { await db.execute(sql); } catch (e) { /* column already exists */ }
  }
}

// Save a new submission
export async function saveSubmission(data) {
  const db = getClient();
  await ensureTable();

  const result = await db.execute({
    sql: 'INSERT INTO submissions (name, email, phone, country, company, industry, message, source, utm_source, utm_medium, utm_campaign) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    args: [
      data.name,
      data.email,
      data.phone || 'Not provided',
      data.country || '',
      data.company || '',
      data.industry || '',
      data.message,
      data.source || 'cleverstack.dev contact form',
      data.utm_source || null,
      data.utm_medium || null,
      data.utm_campaign || null
    ]
  });

  return Number(result.lastInsertRowid);
}

// Get submissions (newest first) with optional search + status filters
export async function getSubmissions(options) {
  const db = getClient();
  await ensureTable();

  const limit = (options && options.limit) || 100;
  const offset = (options && options.offset) || 0;
  const unreadOnly = (options && options.unread) || false;
  const status = (options && options.status) || '';
  const search = (options && options.search && options.search.trim()) || '';
  const industry = (options && options.industry) || '';
  const country = (options && options.country) || '';

  let sql = 'SELECT * FROM submissions';
  const args = [];
  const where = [];

  if (unreadOnly) {
    where.push('is_read = 0');
  }
  if (status && status !== 'all') {
    where.push('status = ?');
    args.push(status);
  }
  if (industry && industry !== 'all') {
    where.push('industry = ?');
    args.push(industry);
  }
  if (country && country !== 'all') {
    where.push('country = ?');
    args.push(country);
  }
  if (search) {
    where.push('(name LIKE ? OR email LIKE ? OR message LIKE ? OR phone LIKE ? OR company LIKE ? OR country LIKE ? OR industry LIKE ?)');
    const like = '%' + search + '%';
    args.push(like, like, like, like, like, like, like);
  }
  if (where.length) {
    sql += ' WHERE ' + where.join(' AND ');
  }

  sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  args.push(limit, offset);

  const result = await db.execute({ sql: sql, args: args });
  return result.rows;
}

// Get total count (with optional unread / status / search filters)
export async function getSubmissionCount(options) {
  const db = getClient();
  await ensureTable();

  const unreadOnly = (options && options.unread) || false;
  const status = (options && options.status) || '';
  const search = (options && options.search && options.search.trim()) || '';
  const industry = (options && options.industry) || '';
  const country = (options && options.country) || '';

  let sql = 'SELECT COUNT(*) as total FROM submissions';
  const args = [];
  const where = [];

  if (unreadOnly) {
    where.push('is_read = 0');
  }
  if (status && status !== 'all') {
    where.push('status = ?');
    args.push(status);
  }
  if (industry && industry !== 'all') {
    where.push('industry = ?');
    args.push(industry);
  }
  if (country && country !== 'all') {
    where.push('country = ?');
    args.push(country);
  }
  if (search) {
    where.push('(name LIKE ? OR email LIKE ? OR message LIKE ? OR phone LIKE ? OR company LIKE ? OR country LIKE ? OR industry LIKE ?)');
    const like = '%' + search + '%';
    args.push(like, like, like, like, like, like, like);
  }
  if (where.length) {
    sql += ' WHERE ' + where.join(' AND ');
  }

  const result = await db.execute({ sql: sql, args: args });
  return Number(result.rows[0].total);
}

// Mark submission as read
export async function markAsRead(id) {
  const db = getClient();
  await db.execute({ sql: 'UPDATE submissions SET is_read = 1 WHERE id = ?', args: [id] });
}

// Update submission status (pipeline: new -> contacted -> proposal -> won/lost)
export async function updateSubmissionStatus(id, status) {
  const db = getClient();
  await db.execute({ sql: 'UPDATE submissions SET status = ? WHERE id = ?', args: [status, id] });
}

// Append a note to a submission
export async function addSubmissionNote(id, note) {
  const db = getClient();
  const row = await db.execute({ sql: 'SELECT notes FROM submissions WHERE id = ?', args: [id] });
  const existing = (row.rows[0] && row.rows[0].notes) || '';
  const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 16);
  const combined = existing ? existing + '\n[' + timestamp + '] ' + note : '[' + timestamp + '] ' + note;
  await db.execute({ sql: 'UPDATE submissions SET notes = ? WHERE id = ?', args: [combined, id] });
}

// Set follow-up due date
export async function setSubmissionFollowUp(id, date) {
  const db = getClient();
  await db.execute({ sql: 'UPDATE submissions SET follow_up_date = ? WHERE id = ?', args: [date, id] });
}

// Get single submission by ID
export async function getSubmission(id) {
  const db = getClient();
  const result = await db.execute({ sql: 'SELECT * FROM submissions WHERE id = ?', args: [id] });
  return result.rows[0] || null;
}

// Delete a submission
export async function deleteSubmission(id) {
  const db = getClient();
  await db.execute({ sql: 'DELETE FROM submissions WHERE id = ?', args: [id] });
}

// ---- Subscribers (newsletter) ----

// Add a subscriber, deduping on email. Returns { added: bool, id }
export async function addSubscriber(email, name, source) {
  const db = getClient();
  await ensureTable();

  const existing = await db.execute({ sql: 'SELECT id, status FROM subscribers WHERE email = ?', args: [email] });
  if (existing.rows[0]) {
    const id = existing.rows[0].id;
    if (existing.rows[0].status !== 'active') {
      await db.execute({ sql: "UPDATE subscribers SET status = 'active' WHERE id = ?", args: [id] });
    }
    return { added: false, id: id };
  }

  const result = await db.execute({
    sql: 'INSERT INTO subscribers (email, name, source) VALUES (?, ?, ?)',
    args: [email, name || '', source || 'newsletter']
  });
  return { added: true, id: Number(result.lastInsertRowid) };
}

export async function getSubscribers(options) {
  const db = getClient();
  await ensureTable();

  const limit = (options && options.limit) || 100;
  const offset = (options && options.offset) || 0;
  const search = (options && options.search && options.search.trim()) || '';

  let sql = 'SELECT * FROM subscribers';
  const args = [];
  if (search) {
    sql += ' WHERE (email LIKE ? OR name LIKE ?)';
    const like = '%' + search + '%';
    args.push(like, like);
  }
  sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  args.push(limit, offset);

  const result = await db.execute({ sql: sql, args: args });
  return result.rows;
}

export async function getSubscriberCount() {
  const db = getClient();
  await ensureTable();
  const result = await db.execute('SELECT COUNT(*) as total FROM subscribers WHERE status = \'active\'');
  return Number(result.rows[0].total);
}

export async function deleteSubscriber(id) {
  const db = getClient();
  await db.execute({ sql: 'DELETE FROM subscribers WHERE id = ?', args: [id] });
}

// ---- Email log ----

export async function logEmail(entry) {
  const db = getClient();
  await ensureTable();
  try {
    await db.execute({
      sql: 'INSERT INTO email_log (to_email, type, subject, status, error) VALUES (?, ?, ?, ?, ?)',
      args: [entry.to_email, entry.type, entry.subject || '', entry.status || 'sent', entry.error || '']
    });
  } catch (e) { /* logging must never break the request */ }
}

export async function getEmailLog(limit) {
  const db = getClient();
  await ensureTable();
  const n = limit || 100;
  const result = await db.execute({
    sql: 'SELECT * FROM email_log ORDER BY created_at DESC LIMIT ?',
    args: [n]
  });
  return result.rows;
}

// ---- Dashboard stats ----

export async function getDashboardStats() {
  const db = getClient();
  await ensureTable();

  const total = await getSubmissionCount();
  const unread = await getSubmissionCount({ unread: true });

  const today = await db.execute("SELECT COUNT(*) as c FROM submissions WHERE date(created_at) = date('now')");
  const week = await db.execute("SELECT COUNT(*) as c FROM submissions WHERE created_at >= datetime('now', '-7 days')");

  const statusRows = await db.execute('SELECT status, COUNT(*) as c FROM submissions GROUP BY status');
  const statusBreakdown = {};
  for (const r of statusRows.rows) statusBreakdown[r.status] = Number(r.c);

  const sourceRows = await db.execute("SELECT COALESCE(source, 'unknown') as s, COUNT(*) as c FROM submissions GROUP BY s ORDER BY c DESC LIMIT 8");
  const sourceBreakdown = sourceRows.rows.map(r => ({ source: r.s, count: Number(r.c) }));

  const industryRows = await db.execute("SELECT COALESCE(NULLIF(industry, ''), 'Other') as i, COUNT(*) as c FROM submissions GROUP BY i ORDER BY c DESC LIMIT 8");
  const topIndustries = industryRows.rows.map(r => ({ label: r.i, count: Number(r.c) }));

  const countryRows = await db.execute("SELECT COALESCE(NULLIF(country, ''), 'Unknown') as c, COUNT(*) as n FROM submissions GROUP BY c ORDER BY n DESC LIMIT 8");
  const topCountries = countryRows.rows.map(r => ({ label: r.c, count: Number(r.n) }));

  const won = Number((statusBreakdown.won || 0));
  const conversionRate = total > 0 ? Math.round((won / total) * 100) : 0;

  const subscribers = await getSubscriberCount();
  const newSubsWeek = await db.execute("SELECT COUNT(*) as c FROM subscribers WHERE created_at >= datetime('now', '-7 days')");

  const followUps = await db.execute("SELECT id, name, email, follow_up_date FROM submissions WHERE follow_up_date IS NOT NULL AND follow_up_date != '' AND status NOT IN ('won','lost') AND date(follow_up_date) <= date('now') ORDER BY follow_up_date ASC LIMIT 10");

  return {
    total,
    unread,
    today: Number(today.rows[0].c),
    thisWeek: Number(week.rows[0].c),
    subscribers,
    newSubscribersWeek: Number(newSubsWeek.rows[0].c),
    statusBreakdown,
    sourceBreakdown,
    topIndustries,
    topCountries,
    conversionRate,
    won,
    followUps: followUps.rows
  };
}
