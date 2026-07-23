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

// Initialize the submissions table (safe to call multiple times)
export async function ensureTable() {
  const db = getClient();
  await db.execute(`
    CREATE TABLE IF NOT EXISTS submissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT DEFAULT 'Not provided',
      message TEXT NOT NULL,
      source TEXT DEFAULT 'cleverstack.dev contact form',
      created_at TEXT DEFAULT (datetime('now')),
      is_read INTEGER DEFAULT 0
    )
  `);
}

// Save a new submission
export async function saveSubmission(data) {
  const db = getClient();
  await ensureTable();

  const result = await db.execute({
    sql: 'INSERT INTO submissions (name, email, phone, message, source) VALUES (?, ?, ?, ?, ?)',
    args: [data.name, data.email, data.phone || 'Not provided', data.message, data.source || 'cleverstack.dev contact form']
  });

  return Number(result.lastInsertRowid);
}

// Get all submissions (newest first)
export async function getSubmissions(options) {
  const db = getClient();
  await ensureTable();

  const limit = (options && options.limit) || 100;
  const offset = (options && options.offset) || 0;
  const unreadOnly = (options && options.unread) || false;

  let sql = 'SELECT * FROM submissions';
  const args = [];

  if (unreadOnly) {
    sql += ' WHERE is_read = 0';
  }

  sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  args.push(limit, offset);

  const result = await db.execute({ sql: sql, args: args });
  return result.rows;
}

// Get total count
export async function getSubmissionCount(unreadOnly) {
  const db = getClient();
  await ensureTable();

  let sql = 'SELECT COUNT(*) as total FROM submissions';
  if (unreadOnly) {
    sql += ' WHERE is_read = 0';
  }

  const result = await db.execute(sql);
  return Number(result.rows[0].total);
}

// Mark submission as read
export async function markAsRead(id) {
  const db = getClient();
  await db.execute({ sql: 'UPDATE submissions SET is_read = 1 WHERE id = ?', args: [id] });
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
