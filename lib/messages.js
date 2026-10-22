// lib/messages.js — project conversations between the team (CRM Inbox) and a client (private-link portal).
//
// * One conversation per client thread; messages are plain text (never HTML), escaped on display.
// * Client access is a secret link (32 random bytes). Anyone with the link can read and reply, like a shared
//   document link. The token is stored so every email can carry the same link (lookups use its sha256 index);
//   the owner can rotate it from the CRM, which kills the old link immediately.
// * sender: 'client' | 'staff' | 'system' (and 'ai' later). staff messages record the staff member's name.
// * Every message is also logged on the client's CRM timeline (activities) when the conversation has a contact.

import crypto from 'node:crypto';
import { getClient } from './db.js';
import { ensureContactTables, addActivity } from './contacts.js';

export const STATUSES = ['open', 'waiting', 'won', 'closed'];
const rowsOf = (r) => (r && r.rows) || [];
const num = (v) => Number(v) || 0;
const clip = (v, n) => String(v == null ? '' : v).replace(/\r\n/g, '\n').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').trim().slice(0, n);
const sha = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');
export const MAX_BODY = 5000;

let setupPromise = null;
export function ensureMessageTables() {
  if (!setupPromise) setupPromise = (async () => {
    const db = getClient();
    await db.execute(`CREATE TABLE IF NOT EXISTS conversations (
      id INTEGER PRIMARY KEY AUTOINCREMENT, contact_id INTEGER, submission_id INTEGER,
      client_name TEXT NOT NULL DEFAULT '', client_email TEXT NOT NULL DEFAULT '', subject TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'open', token_hash TEXT NOT NULL UNIQUE, token TEXT NOT NULL DEFAULT '',
      unread_staff INTEGER NOT NULL DEFAULT 0, unread_client INTEGER NOT NULL DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')), last_message_at TEXT DEFAULT (datetime('now')), last_sender TEXT NOT NULL DEFAULT '')`);
    await db.execute(`CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT, conversation_id INTEGER NOT NULL, sender TEXT NOT NULL,
      staff_name TEXT NOT NULL DEFAULT '', body TEXT NOT NULL, created_at TEXT DEFAULT (datetime('now')))`);
    for (const sql of ['CREATE INDEX IF NOT EXISTS idx_msg_conv ON messages(conversation_id, id)',
      'CREATE INDEX IF NOT EXISTS idx_conv_last ON conversations(last_message_at)',
      'CREATE INDEX IF NOT EXISTS idx_conv_email ON conversations(client_email)']) await db.execute(sql);
  })().catch((e) => { setupPromise = null; throw e; });
  return setupPromise;
}

function newToken() { return crypto.randomBytes(32).toString('base64url'); }
const pub = (c) => c && ({ id: num(c.id), contact_id: c.contact_id == null ? null : num(c.contact_id), submission_id: c.submission_id == null ? null : num(c.submission_id),
  client_name: c.client_name, client_email: c.client_email, subject: c.subject, status: c.status, unread_staff: num(c.unread_staff), unread_client: num(c.unread_client),
  created_at: c.created_at, last_message_at: c.last_message_at, last_sender: c.last_sender });

async function contactIdFor(email) {
  try {
    await ensureContactTables();
    const r = rowsOf(await getClient().execute({ sql: 'SELECT id FROM contacts WHERE email = ?', args: [String(email || '').toLowerCase()] }))[0];
    return r ? num(r.id) : null;
  } catch (e) { return null; }
}
async function logActivity(contactId, text) {
  if (!contactId) return;
  try { await addActivity(contactId, 'message', text.slice(0, 2000)); } catch (e) { /* timeline is best-effort */ }
}

// Creates a conversation; returns { conversation, token } — the token is only available now (it is not stored).
export async function createConversation({ name, email, subject, submissionId, firstMessage, firstSender = 'client', staffName = '' }) {
  await ensureMessageTables();
  email = clip(email, 200).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw Object.assign(new Error('A valid client email is required'), { status: 400 });
  const token = newToken();
  const contactId = await contactIdFor(email);
  const db = getClient();
  const r = await db.execute({ sql: 'INSERT INTO conversations (contact_id, submission_id, client_name, client_email, subject, token_hash, token) VALUES (?, ?, ?, ?, ?, ?, ?)',
    args: [contactId, submissionId || null, clip(name, 120), email, clip(subject, 140) || 'Your project', sha(token), token] });
  const id = num(r.lastInsertRowid);
  // An enquiry is already on the timeline as the form entry, so its first message is not logged twice.
  if (firstMessage && clip(firstMessage, MAX_BODY)) await addMessage(id, { sender: firstSender, body: firstMessage, staffName, log: !submissionId });
  return { conversation: await getConversation(id), token };
}

export async function addMessage(conversationId, { sender, body, staffName = '', log = true }) {
  await ensureMessageTables();
  if (!['client', 'staff', 'system', 'ai'].includes(sender)) throw Object.assign(new Error('Unknown sender'), { status: 400 });
  body = clip(body, MAX_BODY);
  if (!body) throw Object.assign(new Error('Write a message first'), { status: 400 });
  const db = getClient();
  const conv = rowsOf(await db.execute({ sql: 'SELECT * FROM conversations WHERE id = ?', args: [conversationId] }))[0];
  if (!conv) throw Object.assign(new Error('Conversation not found'), { status: 404 });
  const fromClient = sender === 'client';
  const res = await db.batch([
    { sql: 'INSERT INTO messages (conversation_id, sender, staff_name, body) VALUES (?, ?, ?, ?)', args: [conversationId, sender, clip(staffName, 120), body] },
    { sql: `UPDATE conversations SET last_message_at = datetime('now'), last_sender = ?,
        unread_staff = unread_staff + ?, unread_client = unread_client + ?,
        status = CASE WHEN ? = 1 AND status IN ('waiting','closed') THEN 'open' WHEN ? = 0 AND status = 'open' THEN 'waiting' ELSE status END
        WHERE id = ?`, args: [sender, fromClient ? 1 : 0, fromClient ? 0 : 1, fromClient ? 1 : 0, fromClient ? 1 : 0, conversationId] }
  ], 'write');
  if (log) await logActivity(conv.contact_id, (fromClient ? 'Client message: ' : 'Message sent' + (staffName ? ' by ' + staffName : '') + ': ') + body);
  return num(res[0].lastInsertRowid);
}

export async function getConversation(id) {
  await ensureMessageTables();
  return pub(rowsOf(await getClient().execute({ sql: 'SELECT * FROM conversations WHERE id = ?', args: [id] }))[0]);
}
export async function getMessages(conversationId, afterId = 0) {
  await ensureMessageTables();
  return rowsOf(await getClient().execute({ sql: 'SELECT id, sender, staff_name, body, created_at FROM messages WHERE conversation_id = ? AND id > ? ORDER BY id LIMIT 500', args: [conversationId, afterId || 0] }))
    .map((m) => ({ id: num(m.id), sender: m.sender, staff_name: m.staff_name, body: m.body, created_at: m.created_at }));
}

// Client side: resolve a portal token. Returns the conversation or null.
export async function conversationForToken(token) {
  if (!/^[A-Za-z0-9_-]{40,60}$/.test(token || '')) return null;
  await ensureMessageTables();
  return pub(rowsOf(await getClient().execute({ sql: 'SELECT * FROM conversations WHERE token_hash = ?', args: [sha(token)] }))[0]);
}
export async function markRead(conversationId, who) {
  await ensureMessageTables();
  await getClient().execute({ sql: `UPDATE conversations SET ${who === 'client' ? 'unread_client' : 'unread_staff'} = 0 WHERE id = ?`, args: [conversationId] });
}
export async function setStatus(id, status) {
  if (!STATUSES.includes(status)) throw Object.assign(new Error('Unknown status'), { status: 400 });
  await ensureMessageTables();
  await getClient().execute({ sql: 'UPDATE conversations SET status = ? WHERE id = ?', args: [status, id] });
}
// New private link (the old one stops working immediately). Returns the token.
export async function rotateToken(id) {
  await ensureMessageTables();
  const token = newToken();
  const r = await getClient().execute({ sql: 'UPDATE conversations SET token_hash = ?, token = ? WHERE id = ?', args: [sha(token), token, id] });
  if (!r.rowsAffected) throw Object.assign(new Error('Conversation not found'), { status: 404 });
  return token;
}

export async function listConversations({ status = '', q = '', limit = 50, offset = 0 } = {}) {
  await ensureMessageTables();
  const where = [], args = [];
  if (status === 'unread') where.push('unread_staff > 0');
  else if (STATUSES.includes(status)) { where.push('status = ?'); args.push(status); }
  if (q) { where.push('(client_name LIKE ? OR client_email LIKE ? OR subject LIKE ?)'); const l = '%' + clip(q, 100) + '%'; args.push(l, l, l); }
  const w = where.length ? ' WHERE ' + where.join(' AND ') : '';
  const db = getClient();
  const [rows, total, unread] = await db.batch([
    { sql: `SELECT c.*, (SELECT body FROM messages m WHERE m.conversation_id = c.id ORDER BY m.id DESC LIMIT 1) AS preview
            FROM conversations c${w} ORDER BY (c.unread_staff > 0) DESC, c.last_message_at DESC LIMIT ? OFFSET ?`, args: [...args, Math.min(200, limit), offset] },
    { sql: `SELECT COUNT(*) AS n FROM conversations${w}`, args },
    { sql: 'SELECT COUNT(*) AS n FROM conversations WHERE unread_staff > 0', args: [] }
  ], 'read');
  return { conversations: rowsOf(rows).map((c) => ({ ...pub(c), preview: String(c.preview || '').slice(0, 160) })), total: num(rowsOf(total)[0].n), unread: num(rowsOf(unread)[0].n) };
}

export async function conversationsForSubmission(submissionId) {
  await ensureMessageTables();
  return rowsOf(await getClient().execute({ sql: 'SELECT * FROM conversations WHERE submission_id = ? ORDER BY id', args: [submissionId] })).map(pub);
}

// The client's private link for a conversation (for emails and "copy link" in the CRM).
export async function linkFor(id, base) {
  await ensureMessageTables();
  const r = rowsOf(await getClient().execute({ sql: 'SELECT token FROM conversations WHERE id = ?', args: [id] }))[0];
  return r && r.token ? base.replace(/\/$/, '') + '/messages?c=' + r.token : null;
}
