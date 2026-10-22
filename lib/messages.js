// lib/messages.js — project conversations between the team (CRM Inbox) and a client (private-link portal).
//
// * One conversation per client thread; messages are plain text (never HTML), escaped on display.
// * Client access is a secret link (32 random bytes). Anyone with the link can read and reply, like a shared
//   document link. The token is stored so every email can carry the same link (lookups use its sha256 index);
//   the owner can rotate it from the CRM, which kills the old link immediately.
// * sender: 'client' | 'staff' | 'system' (and 'ai' later). staff messages record the staff member's name.
// * Every message is also logged on the client's CRM timeline (activities) when the conversation has a contact.
// * Files (images, PDFs, office documents, zip) up to 4 MB live in the database in 512 KB chunks, so nothing
//   else has to be set up. Only listed types are accepted, their content must match the extension, and anything
//   that is not a plain image is always served as a download.
// * Read receipts: *_seen_id is the newest message id each side has opened. Typing: *_typing_at, shown for a
//   few seconds. Edits and deletions set updated_at so polling clients pick them up (changedSince).

import crypto from 'node:crypto';
import { getClient } from './db.js';
import { ensureContactTables, addActivity } from './contacts.js';

export const STATUSES = ['open', 'waiting', 'won', 'closed'];
const rowsOf = (r) => (r && r.rows) || [];
const num = (v) => Number(v) || 0;
const clip = (v, n) => String(v == null ? '' : v).replace(/\r\n/g, '\n').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').trim().slice(0, n);
const sha = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');
const fail = (message, status) => Object.assign(new Error(message), { status });
const tolerant = async (p) => { try { await p; } catch (e) { if (!/duplicate column|already exists/i.test(String(e.message))) throw e; } };
export const MAX_BODY = 5000;
export const MAX_FILE = 4 * 1024 * 1024;       // Vercel caps a request/response at 4.5 MB
export const CLIENT_EDIT_MINUTES = 15;          // clients can fix or remove a message for this long
const CHUNK = 512 * 1024;
const TYPING_SECONDS = 6;

// extension -> served type. Images are shown inline; everything else downloads.
const TYPES = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif',
  pdf: 'application/pdf', txt: 'text/plain', csv: 'text/csv', zip: 'application/zip',
  doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint', pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
};
export const ALLOWED_EXTENSIONS = Object.keys(TYPES);
const startsWith = (b, bytes) => bytes.every((x, i) => b[i] === x);
// The real image type from its bytes (null when it is not one of the images we show).
function imageType(b) {
  if (startsWith(b, [0xff, 0xd8, 0xff])) return 'jpg';
  if (startsWith(b, [0x89, 0x50, 0x4e, 0x47])) return 'png';
  if (startsWith(b, [0x47, 0x49, 0x46, 0x38])) return 'gif';
  if (startsWith(b, [0x52, 0x49, 0x46, 0x46]) && b.subarray(8, 12).toString('latin1') === 'WEBP') return 'webp';
  return null;
}
const IMAGE_EXT = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp']);
// Content checks: the bytes must match the extension (txt/csv have no signature and always download).
function contentMatches(ext, b) {
  if (IMAGE_EXT.has(ext)) return !!imageType(b);
  if (ext === 'pdf') return startsWith(b, [0x25, 0x50, 0x44, 0x46]);
  if (ext === 'zip' || ext === 'docx' || ext === 'xlsx' || ext === 'pptx') return startsWith(b, [0x50, 0x4b]);
  if (ext === 'doc' || ext === 'xls' || ext === 'ppt') return startsWith(b, [0xd0, 0xcf, 0x11, 0xe0]);
  return true;
}
function cleanName(name) {
  const n = clip(name, 140).replace(/[\\/:*?"<>|]+/g, '_').replace(/^\.+/, '');
  return n || 'file';
}

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
    await db.execute(`CREATE TABLE IF NOT EXISTS message_files (
      id INTEGER PRIMARY KEY AUTOINCREMENT, conversation_id INTEGER NOT NULL, name TEXT NOT NULL, ext TEXT NOT NULL,
      mime TEXT NOT NULL, size INTEGER NOT NULL, ready INTEGER NOT NULL DEFAULT 0, created_at TEXT DEFAULT (datetime('now')))`);
    await db.execute(`CREATE TABLE IF NOT EXISTS message_file_chunks (
      file_id INTEGER NOT NULL, idx INTEGER NOT NULL, data BLOB NOT NULL, PRIMARY KEY (file_id, idx))`);
    // columns added after the first release
    for (const sql of ['ALTER TABLE conversations ADD COLUMN staff_seen_id INTEGER NOT NULL DEFAULT 0',
      'ALTER TABLE conversations ADD COLUMN client_seen_id INTEGER NOT NULL DEFAULT 0',
      'ALTER TABLE conversations ADD COLUMN staff_typing_at TEXT',
      'ALTER TABLE conversations ADD COLUMN client_typing_at TEXT',
      'ALTER TABLE messages ADD COLUMN file_id INTEGER',
      'ALTER TABLE messages ADD COLUMN edited INTEGER NOT NULL DEFAULT 0',
      'ALTER TABLE messages ADD COLUMN deleted INTEGER NOT NULL DEFAULT 0',
      'ALTER TABLE messages ADD COLUMN updated_at TEXT']) await tolerant(db.execute(sql));
    for (const sql of ['CREATE INDEX IF NOT EXISTS idx_msg_conv ON messages(conversation_id, id)',
      'CREATE INDEX IF NOT EXISTS idx_msg_updated ON messages(conversation_id, updated_at)',
      'CREATE INDEX IF NOT EXISTS idx_conv_last ON conversations(last_message_at)',
      'CREATE INDEX IF NOT EXISTS idx_conv_email ON conversations(client_email)',
      'CREATE INDEX IF NOT EXISTS idx_files_conv ON message_files(conversation_id)']) await db.execute(sql);
  })().catch((e) => { setupPromise = null; throw e; });
  return setupPromise;
}

function newToken() { return crypto.randomBytes(32).toString('base64url'); }
const secondsSince = (s) => { const t = Date.parse(String(s || '').replace(' ', 'T') + 'Z'); return isNaN(t) ? Infinity : (Date.now() - t) / 1000; };
const pub = (c) => c && ({ id: num(c.id), contact_id: c.contact_id == null ? null : num(c.contact_id), submission_id: c.submission_id == null ? null : num(c.submission_id),
  client_name: c.client_name, client_email: c.client_email, subject: c.subject, status: c.status, unread_staff: num(c.unread_staff), unread_client: num(c.unread_client),
  created_at: c.created_at, last_message_at: c.last_message_at, last_sender: c.last_sender,
  staff_seen_id: num(c.staff_seen_id), client_seen_id: num(c.client_seen_id),
  staff_typing: secondsSince(c.staff_typing_at) < TYPING_SECONDS, client_typing: secondsSince(c.client_typing_at) < TYPING_SECONDS });

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

// Creates a conversation; returns { conversation, token }.
export async function createConversation({ name, email, subject, submissionId, firstMessage, firstSender = 'client', staffName = '' }) {
  await ensureMessageTables();
  email = clip(email, 200).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw fail('A valid client email is required', 400);
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

const fileInfo = (f) => f && ({ id: num(f.id), name: f.name, size: num(f.size), mime: f.mime, image: /^image\//.test(f.mime) });
async function removeFile(id) {
  await getClient().batch([{ sql: 'DELETE FROM message_file_chunks WHERE file_id = ?', args: [id] }, { sql: 'DELETE FROM message_files WHERE id = ?', args: [id] }], 'write');
}
// Stores an uploaded file for a conversation (attach it with addMessage({ fileId })). Returns its description.
export async function saveFile(conversationId, { name, data }) {
  await ensureMessageTables();
  const buf = Buffer.isBuffer(data) ? data : Buffer.from(data || []);
  if (!buf.length) throw fail('The file is empty', 400);
  if (buf.length > MAX_FILE) throw fail('Files can be up to 4 MB. For bigger files, share a Google Drive or WeTransfer link.', 413);
  name = cleanName(name);
  let e = ((name.match(/\.([A-Za-z0-9]{1,5})$/) || [])[1] || '').toLowerCase();
  if (!TYPES[e]) throw fail('This file type is not supported. You can send images, PDF, Word, Excel, PowerPoint, TXT, CSV or ZIP files.', 415);
  if (!contentMatches(e, buf)) throw fail('This file does not look like a real .' + e + ' file.', 415);
  // a real image with the wrong extension (e.g. a JPEG saved as .png) is kept, under its true type
  const real = IMAGE_EXT.has(e) && imageType(buf);
  if (real && real !== (e === 'jpeg' ? 'jpg' : e)) { e = real; name = name.replace(/\.[^.]+$/, '.' + real); }
  const db = getClient();
  const r = await db.execute({ sql: 'INSERT INTO message_files (conversation_id, name, ext, mime, size) VALUES (?, ?, ?, ?, ?)', args: [conversationId, name, e, TYPES[e], buf.length] });
  const id = num(r.lastInsertRowid);
  try {
    for (let i = 0, idx = 0; i < buf.length; i += CHUNK, idx++) {
      await db.execute({ sql: 'INSERT INTO message_file_chunks (file_id, idx, data) VALUES (?, ?, ?)', args: [id, idx, new Uint8Array(buf.subarray(i, i + CHUNK))] });
    }
    await db.execute({ sql: 'UPDATE message_files SET ready = 1 WHERE id = ?', args: [id] });
  } catch (err) {
    await removeFile(id).catch(() => {});
    throw err;
  }
  return fileInfo({ id, name, mime: TYPES[e], size: buf.length });
}
// The file's bytes, only when it belongs to this conversation. Returns { name, mime, size, image, data } or null.
export async function getFile(conversationId, fileId) {
  await ensureMessageTables();
  const db = getClient();
  const f = rowsOf(await db.execute({ sql: 'SELECT * FROM message_files WHERE id = ? AND conversation_id = ? AND ready = 1', args: [fileId, conversationId] }))[0];
  if (!f) return null;
  const parts = rowsOf(await db.execute({ sql: 'SELECT data FROM message_file_chunks WHERE file_id = ? ORDER BY idx', args: [fileId] })).map((p) => Buffer.from(p.data));
  return { ...fileInfo(f), data: Buffer.concat(parts) };
}

export async function addMessage(conversationId, { sender, body, staffName = '', log = true, fileId = null }) {
  await ensureMessageTables();
  if (!['client', 'staff', 'system', 'ai'].includes(sender)) throw fail('Unknown sender', 400);
  body = clip(body, MAX_BODY);
  const db = getClient();
  let file = null;
  if (fileId) {
    file = rowsOf(await db.execute({ sql: 'SELECT f.* FROM message_files f WHERE f.id = ? AND f.conversation_id = ? AND f.ready = 1 AND NOT EXISTS (SELECT 1 FROM messages m WHERE m.file_id = f.id)', args: [fileId, conversationId] }))[0];
    if (!file) throw fail('File not found', 404);
  }
  if (!body && !file) throw fail('Write a message first', 400);
  const conv = rowsOf(await db.execute({ sql: 'SELECT * FROM conversations WHERE id = ?', args: [conversationId] }))[0];
  if (!conv) throw fail('Conversation not found', 404);
  const fromClient = sender === 'client';
  const res = await db.batch([
    { sql: 'INSERT INTO messages (conversation_id, sender, staff_name, body, file_id) VALUES (?, ?, ?, ?, ?)', args: [conversationId, sender, clip(staffName, 120), body, file ? num(file.id) : null] },
    { sql: `UPDATE conversations SET last_message_at = datetime('now'), last_sender = ?,
        unread_staff = unread_staff + ?, unread_client = unread_client + ?,
        ${fromClient ? 'client_typing_at' : 'staff_typing_at'} = NULL,
        status = CASE WHEN ? = 1 AND status IN ('waiting','closed') THEN 'open' WHEN ? = 0 AND status = 'open' THEN 'waiting' ELSE status END
        WHERE id = ?`, args: [sender, fromClient ? 1 : 0, fromClient ? 0 : 1, fromClient ? 1 : 0, fromClient ? 1 : 0, conversationId] }
  ], 'write');
  const text = body || ('Sent a file: ' + file.name);
  if (log) await logActivity(conv.contact_id, (fromClient ? 'Client message: ' : 'Message sent' + (staffName ? ' by ' + staffName : '') + ': ') + text);
  return num(res[0].lastInsertRowid);
}

// Edit or delete a message. who: 'client' (own messages, for CLIENT_EDIT_MINUTES) or 'staff' (team messages).
async function ownMessage(conversationId, messageId, who) {
  const m = rowsOf(await getClient().execute({ sql: 'SELECT * FROM messages WHERE id = ? AND conversation_id = ?', args: [messageId, conversationId] }))[0];
  if (!m || num(m.deleted)) throw fail('Message not found', 404);
  const mine = who === 'client' ? m.sender === 'client' : m.sender !== 'client';
  if (!mine) throw fail('You can only change your own messages', 403);
  if (who === 'client' && secondsSince(m.created_at) > CLIENT_EDIT_MINUTES * 60) throw fail('Messages can only be changed for ' + CLIENT_EDIT_MINUTES + ' minutes after sending', 403);
  return m;
}
export async function editMessage(conversationId, messageId, who, body) {
  await ensureMessageTables();
  const m = await ownMessage(conversationId, messageId, who);
  body = clip(body, MAX_BODY);
  if (!body && !m.file_id) throw fail('Write a message first', 400);
  await getClient().execute({ sql: "UPDATE messages SET body = ?, edited = 1, updated_at = datetime('now') WHERE id = ?", args: [body, messageId] });
}
export async function deleteMessage(conversationId, messageId, who) {
  await ensureMessageTables();
  const m = await ownMessage(conversationId, messageId, who);
  await getClient().execute({ sql: "UPDATE messages SET body = '', file_id = NULL, deleted = 1, updated_at = datetime('now') WHERE id = ?", args: [messageId] });
  if (m.file_id) await removeFile(num(m.file_id));
}

export async function setTyping(conversationId, who) {
  await ensureMessageTables();
  await getClient().execute({ sql: `UPDATE conversations SET ${who === 'client' ? 'client_typing_at' : 'staff_typing_at'} = datetime('now') WHERE id = ?`, args: [conversationId] });
}

export async function getConversation(id) {
  await ensureMessageTables();
  return pub(rowsOf(await getClient().execute({ sql: 'SELECT * FROM conversations WHERE id = ?', args: [id] }))[0]);
}
const MSG_COLS = 'm.id, m.sender, m.staff_name, m.body, m.created_at, m.edited, m.deleted, f.id AS f_id, f.name AS f_name, f.size AS f_size, f.mime AS f_mime';
const msgOut = (m) => ({ id: num(m.id), sender: m.sender, staff_name: m.staff_name, body: m.body, created_at: m.created_at, edited: !!num(m.edited), deleted: !!num(m.deleted),
  file: m.f_id == null ? null : fileInfo({ id: m.f_id, name: m.f_name, size: m.f_size, mime: m.f_mime }) });
export async function getMessages(conversationId, afterId = 0) {
  await ensureMessageTables();
  return rowsOf(await getClient().execute({ sql: `SELECT ${MSG_COLS} FROM messages m LEFT JOIN message_files f ON f.id = m.file_id WHERE m.conversation_id = ? AND m.id > ? ORDER BY m.id LIMIT 500`, args: [conversationId, afterId || 0] })).map(msgOut);
}
// Messages edited or deleted at/after `since` (a timestamp from serverNow), up to message `uptoId`.
export async function changedSince(conversationId, since, uptoId) {
  if (!/^\d{4}-\d\d-\d\d \d\d:\d\d:\d\d$/.test(since || '') || !uptoId) return [];
  await ensureMessageTables();
  return rowsOf(await getClient().execute({ sql: `SELECT ${MSG_COLS} FROM messages m LEFT JOIN message_files f ON f.id = m.file_id WHERE m.conversation_id = ? AND m.updated_at >= ? AND m.id <= ? ORDER BY m.id LIMIT 200`, args: [conversationId, since, uptoId] })).map(msgOut);
}
export async function serverNow() {
  return String(rowsOf(await getClient().execute("SELECT datetime('now') AS n"))[0].n);
}

// Client side: resolve a portal token. Returns the conversation or null.
export async function conversationForToken(token) {
  if (!/^[A-Za-z0-9_-]{40,60}$/.test(token || '')) return null;
  await ensureMessageTables();
  return pub(rowsOf(await getClient().execute({ sql: 'SELECT * FROM conversations WHERE token_hash = ?', args: [sha(token)] }))[0]);
}
// Clears the unread count and records how far this side has read (for "Seen").
export async function markRead(conversationId, who) {
  await ensureMessageTables();
  const side = who === 'client' ? 'client' : 'staff';
  await getClient().execute({ sql: `UPDATE conversations SET unread_${side} = 0, ${side}_seen_id = COALESCE((SELECT MAX(id) FROM messages WHERE conversation_id = ?), 0) WHERE id = ?`, args: [conversationId, conversationId] });
}
// true when this side has messages it has not opened yet, so polling only writes when something changed.
// `newestId` is the newest message id the caller already knows about (0 = look it up).
export async function needsRead(conv, who, newestId = 0) {
  if (!conv) return false;
  if (who === 'client' ? conv.unread_client : conv.unread_staff) return true;
  let newest = newestId;
  if (!newest) newest = num(rowsOf(await getClient().execute({ sql: 'SELECT COALESCE(MAX(id), 0) AS n FROM messages WHERE conversation_id = ?', args: [conv.id] }))[0].n);
  return newest > (who === 'client' ? conv.client_seen_id : conv.staff_seen_id);
}
export async function setStatus(id, status) {
  if (!STATUSES.includes(status)) throw fail('Unknown status', 400);
  await ensureMessageTables();
  await getClient().execute({ sql: 'UPDATE conversations SET status = ? WHERE id = ?', args: [status, id] });
}
// New private link (the old one stops working immediately). Returns the token.
export async function rotateToken(id) {
  await ensureMessageTables();
  const token = newToken();
  const r = await getClient().execute({ sql: 'UPDATE conversations SET token_hash = ?, token = ? WHERE id = ?', args: [sha(token), token, id] });
  if (!r.rowsAffected) throw fail('Conversation not found', 404);
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
    { sql: `SELECT c.*, (SELECT CASE WHEN m.deleted = 1 THEN 'Message deleted'
                WHEN m.body = '' AND m.file_id IS NOT NULL THEN '📎 ' || COALESCE((SELECT name FROM message_files WHERE id = m.file_id), 'File') ELSE m.body END
              FROM messages m WHERE m.conversation_id = c.id ORDER BY m.id DESC LIMIT 1) AS preview
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

// Sends a stored file over a Vercel/Node response. Images display inline; everything else downloads.
export function sendFile(res, file, { download = false } = {}) {
  res.setHeader('Content-Type', file.mime);
  res.setHeader('Content-Length', String(file.data.length));
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Security-Policy', "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox");
  res.setHeader('Cache-Control', 'private, max-age=3600');
  const ascii = file.name.replace(/[^\x20-\x7e]/g, '_').replace(/"/g, '');
  res.setHeader('Content-Disposition', (file.image && !download ? 'inline' : 'attachment') + '; filename="' + ascii + '"; filename*=UTF-8\'\'' + encodeURIComponent(file.name));
  return res.status(200).send(file.data);
}
