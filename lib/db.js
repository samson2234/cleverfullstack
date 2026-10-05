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
import { createHash, randomBytes } from 'node:crypto';

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

// Initialize tables (safe to call multiple times) — runs at most once per cold start
let tablesReady = false;
export async function ensureTable() {
  if (tablesReady) return;
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
  // Performance indexes — critical for filter/sort queries on remote Turso
  const indexes = [
    'CREATE INDEX IF NOT EXISTS idx_submissions_status ON submissions(status)',
    'CREATE INDEX IF NOT EXISTS idx_submissions_created_at ON submissions(created_at)',
    'CREATE INDEX IF NOT EXISTS idx_submissions_is_read ON submissions(is_read)',
    'CREATE INDEX IF NOT EXISTS idx_submissions_industry ON submissions(industry)',
    'CREATE INDEX IF NOT EXISTS idx_submissions_country ON submissions(country)',
    'CREATE INDEX IF NOT EXISTS idx_submissions_follow_up ON submissions(follow_up_date)',
    'CREATE INDEX IF NOT EXISTS idx_subscribers_status ON subscribers(status)',
    'CREATE INDEX IF NOT EXISTS idx_subscribers_created_at ON subscribers(created_at)',
    'CREATE INDEX IF NOT EXISTS idx_email_log_created_at ON email_log(created_at)'
  ];
  for (const sql of indexes) {
    try { await db.execute(sql); } catch (e) { /* index already exists or table missing */ }
  }
  tablesReady = true;
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

// ---- Filter options (lightweight — used by ensureFilters) ----

export async function getFilterOptions() {
  const db = getClient();
  await ensureTable();

  const [countryRows, industryRows] = await Promise.all([
    db.execute("SELECT COALESCE(NULLIF(country, ''), 'Unknown') as c, COUNT(*) as n FROM submissions GROUP BY c ORDER BY n DESC LIMIT 50"),
    db.execute("SELECT COALESCE(NULLIF(industry, ''), 'Other') as i, COUNT(*) as c FROM submissions GROUP BY i ORDER BY c DESC LIMIT 50")
  ]);

  return {
    topCountries: countryRows.rows.map(r => ({ label: r.c, count: Number(r.n) })),
    topIndustries: industryRows.rows.map(r => ({ label: r.i, count: Number(r.c) }))
  };
}

// ---- Dashboard stats (consolidated into 3 queries instead of 10+) ----

export async function getDashboardStats() {
  const db = getClient();
  await ensureTable();

  // Query 1: Submission aggregations — total, unread, today, this week, status breakdown, source, industry, country, follow-ups
  const agg = await db.execute(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN is_read = 0 THEN 1 ELSE 0 END) as unread,
      SUM(CASE WHEN date(created_at) = date('now') THEN 1 ELSE 0 END) as today,
      SUM(CASE WHEN created_at >= datetime('now', '-7 days') THEN 1 ELSE 0 END) as this_week,
      SUM(CASE WHEN status = 'won' THEN 1 ELSE 0 END) as won
    FROM submissions
  `);

  const statusRows = await db.execute('SELECT status, COUNT(*) as c FROM submissions GROUP BY status');
  const statusBreakdown = {};
  for (const r of statusRows.rows) statusBreakdown[r.status] = Number(r.c);

  const [sourceRows, industryRows, countryRows] = await Promise.all([
    db.execute("SELECT COALESCE(source, 'unknown') as s, COUNT(*) as c FROM submissions GROUP BY s ORDER BY c DESC LIMIT 8"),
    db.execute("SELECT COALESCE(NULLIF(industry, ''), 'Other') as i, COUNT(*) as c FROM submissions GROUP BY i ORDER BY c DESC LIMIT 8"),
    db.execute("SELECT COALESCE(NULLIF(country, ''), 'Unknown') as c, COUNT(*) as n FROM submissions GROUP BY c ORDER BY n DESC LIMIT 8")
  ]);

  // Query 2: Subscriber stats
  const [subCount, newSubsWeek] = await Promise.all([
    db.execute("SELECT COUNT(*) as c FROM subscribers WHERE status = 'active'"),
    db.execute("SELECT COUNT(*) as c FROM subscribers WHERE created_at >= datetime('now', '-7 days')")
  ]);

  // Query 3: Follow-ups
  const followUps = await db.execute("SELECT id, name, email, follow_up_date FROM submissions WHERE follow_up_date IS NOT NULL AND follow_up_date != '' AND status NOT IN ('won','lost') AND date(follow_up_date) <= date('now') ORDER BY follow_up_date ASC LIMIT 10");

  const aggRow = agg.rows[0];
  const total = Number(aggRow.total);
  const won = Number(aggRow.won);
  const conversionRate = total > 0 ? Math.round((won / total) * 100) : 0;

  return {
    total,
    unread: Number(aggRow.unread),
    today: Number(aggRow.today),
    thisWeek: Number(aggRow.this_week),
    subscribers: Number(subCount.rows[0].c),
    newSubscribersWeek: Number(newSubsWeek.rows[0].c),
    statusBreakdown,
    sourceBreakdown: sourceRows.rows.map(r => ({ source: r.s, count: Number(r.c) })),
    topIndustries: industryRows.rows.map(r => ({ label: r.i, count: Number(r.c) })),
    topCountries: countryRows.rows.map(r => ({ label: r.c, count: Number(r.n) })),
    conversionRate,
    won,
    followUps: followUps.rows
  };
}

// ============================================================
// REVIEWS — verified client reviews
// ------------------------------------------------------------
// A review is "verified" when it is submitted through a one-time invite link
// that the owner sent to a real client. Only the sha256 of the link token is
// stored. Reviews without an invite wait as 'pending' until the owner confirms
// the person was a client. Moderation is for spam/fakes — not for hiding
// honest negative feedback.
// ============================================================

let reviewTablesReady = false;
async function ensureReviewTables() {
  if (reviewTablesReady) return;
  const db = getClient();
  await db.execute(`
    CREATE TABLE IF NOT EXISTS review_invites (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      token_hash TEXT NOT NULL UNIQUE,
      client_name TEXT NOT NULL,
      client_email TEXT DEFAULT '',
      project TEXT DEFAULT '',
      expires_at TEXT NOT NULL,
      used_at TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);
  await db.execute(`
    CREATE TABLE IF NOT EXISTS reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invite_id INTEGER,
      author_name TEXT NOT NULL,
      author_role TEXT DEFAULT '',
      country TEXT DEFAULT '',
      project TEXT DEFAULT '',
      rating INTEGER NOT NULL,
      title TEXT DEFAULT '',
      body TEXT NOT NULL,
      verified INTEGER DEFAULT 0,
      status TEXT DEFAULT 'pending',
      reply TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now')),
      published_at TEXT
    )
  `);
  await db.execute('CREATE INDEX IF NOT EXISTS idx_reviews_status_pub ON reviews(status, published_at)');
  await db.execute('CREATE INDEX IF NOT EXISTS idx_reviews_created ON reviews(created_at)');
  reviewTablesReady = true;
}

const hashToken = (t) => createHash('sha256').update(String(t)).digest('hex');

// Create a one-time invite. Returns the RAW token (shown/emailed once, never stored).
export async function createReviewInvite({ client_name, client_email, project, days }) {
  await ensureReviewTables();
  const token = randomBytes(24).toString('base64url');
  const expires = new Date(Date.now() + (Number(days) || 30) * 86400000).toISOString().slice(0, 19).replace('T', ' ');
  const r = await getClient().execute({
    sql: 'INSERT INTO review_invites (token_hash, client_name, client_email, project, expires_at) VALUES (?, ?, ?, ?, ?)',
    args: [hashToken(token), client_name, client_email || '', project || '', expires]
  });
  return { id: Number(r.lastInsertRowid), token, expires_at: expires };
}

// Look up a usable invite from a raw token (null if unknown, used or expired)
export async function getValidInvite(token) {
  await ensureReviewTables();
  const r = await getClient().execute({
    sql: "SELECT * FROM review_invites WHERE token_hash = ? AND used_at IS NULL AND expires_at > datetime('now')",
    args: [hashToken(token)]
  });
  return r.rows[0] || null;
}

// Verified path: marks the invite used and publishes the review immediately.
export async function submitVerifiedReview(invite, data) {
  await ensureReviewTables();
  const db = getClient();
  // Claim the invite atomically so one link can only ever produce one review.
  const claim = await db.execute({
    sql: "UPDATE review_invites SET used_at = datetime('now') WHERE id = ? AND used_at IS NULL",
    args: [invite.id]
  });
  if (!claim.rowsAffected) return null;
  const r = await db.execute({
    sql: `INSERT INTO reviews (invite_id, author_name, author_role, country, project, rating, title, body, verified, status, published_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, 'approved', datetime('now'))`,
    args: [invite.id, data.author_name, data.author_role || '', data.country || '', invite.project || '', data.rating, data.title || '', data.body]
  });
  return Number(r.lastInsertRowid);
}

// Unverified path: waits for the owner to confirm.
export async function submitPendingReview(data) {
  await ensureReviewTables();
  const r = await getClient().execute({
    sql: `INSERT INTO reviews (author_name, author_role, country, rating, title, body, verified, status)
          VALUES (?, ?, ?, ?, ?, ?, 0, 'pending')`,
    args: [data.author_name, data.author_role || '', data.country || '', data.rating, data.title || '', data.body]
  });
  return Number(r.lastInsertRowid);
}

// Public list of approved reviews + aggregate (computed from the reviews shown)
export async function getPublicReviews(limit) {
  await ensureReviewTables();
  const db = getClient();
  const rows = (await db.execute({
    sql: `SELECT id, author_name, author_role, country, project, rating, title, body, verified, reply, published_at
          FROM reviews WHERE status = 'approved' ORDER BY published_at DESC, id DESC LIMIT ?`,
    args: [Math.min(Number(limit) || 50, 200)]
  })).rows;
  const agg = (await db.execute("SELECT COUNT(*) AS n, AVG(rating) AS avg FROM reviews WHERE status = 'approved'")).rows[0];
  return { reviews: rows, count: Number(agg.n) || 0, average: agg.avg ? Math.round(Number(agg.avg) * 10) / 10 : 0 };
}

export async function getAdminReviews({ status, limit, offset }) {
  await ensureReviewTables();
  const where = status ? 'WHERE status = ?' : '';
  const args = status ? [status] : [];
  const rows = (await getClient().execute({
    sql: `SELECT * FROM reviews ${where} ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?`,
    args: [...args, Math.min(Number(limit) || 100, 500), Number(offset) || 0]
  })).rows;
  const total = Number((await getClient().execute({ sql: `SELECT COUNT(*) AS n FROM reviews ${where}`, args })).rows[0].n);
  return { rows, total };
}

export async function getAdminInvites(limit) {
  await ensureReviewTables();
  return (await getClient().execute({
    sql: 'SELECT id, client_name, client_email, project, expires_at, used_at, created_at FROM review_invites ORDER BY id DESC LIMIT ?',
    args: [Math.min(Number(limit) || 100, 500)]
  })).rows;
}

export async function setReviewStatus(id, status, verified) {
  await ensureReviewTables();
  const sets = ['status = ?', status === 'approved' ? "published_at = COALESCE(published_at, datetime('now'))" : 'published_at = NULL'];
  const args = [status];
  if (verified === true || verified === false) { sets.push('verified = ?'); args.push(verified ? 1 : 0); }
  args.push(id);
  await getClient().execute({ sql: `UPDATE reviews SET ${sets.join(', ')} WHERE id = ?`, args });
}

export async function setReviewReply(id, reply) {
  await ensureReviewTables();
  await getClient().execute({ sql: 'UPDATE reviews SET reply = ? WHERE id = ?', args: [reply, id] });
}

export async function deleteReview(id) {
  await ensureReviewTables();
  await getClient().execute({ sql: 'DELETE FROM reviews WHERE id = ?', args: [id] });
}

export async function getPendingReviewCount() {
  await ensureReviewTables();
  return Number((await getClient().execute("SELECT COUNT(*) AS n FROM reviews WHERE status = 'pending'")).rows[0].n);
}
