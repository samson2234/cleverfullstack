// lib/push.js — phone / desktop notifications (Web Push) for the website chat and the CRM Inbox.
//
// Two kinds of subscriber:
//   'client' — a visitor, for ONE conversation (subscribed from the chat button, /messages or the installed chat app)
//   'staff'  — a CRM user (owner or team member), for every conversation (subscribed from the Inbox)
// Pushes: team reply -> that conversation's client subscriptions; client message / new website chat -> all staff.
//
// Env (Vercel): VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (mailto: or https: contact for the push services).
// Without the keys everything here is a no-op and the "turn on notifications" buttons stay hidden.
// Payloads are short (title, a 120-character preview, the page to open). Subscriptions the push service reports as
// gone (404/410) are deleted.
import webpush from 'web-push';
import { getClient } from './db.js';

const rowsOf = (r) => (r && r.rows) || [];
const clip = (s, n) => { const t = String(s == null ? '' : s).replace(/\s+/g, ' ').trim(); return t.length > n ? t.slice(0, n - 1) + '…' : t; };

export function pushKey() { return process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY ? process.env.VAPID_PUBLIC_KEY : null; }

let configured = '';
let sender = async (sub, payload) => {
  const key = process.env.VAPID_PUBLIC_KEY + process.env.VAPID_PRIVATE_KEY;
  if (configured !== key) {
    webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'https://cleverstack.dev', process.env.VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);
    configured = key;
  }
  return webpush.sendNotification(sub, payload, { TTL: 60 * 60 * 24, urgency: 'high', timeout: 5000 });
};
// tests replace the network call
export function setPushSender(fn) { sender = fn; }

let ready = null;
function ensureTable() {
  if (!ready) ready = getClient().execute(`CREATE TABLE IF NOT EXISTS push_subs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      kind TEXT NOT NULL,
      conversation_id INTEGER,
      staff_id INTEGER,
      endpoint TEXT NOT NULL UNIQUE,
      p256dh TEXT NOT NULL,
      auth TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    )`).then(() => getClient().execute('CREATE INDEX IF NOT EXISTS idx_push_subs_conv ON push_subs (kind, conversation_id)'))
    .catch((e) => { ready = null; throw e; });
  return ready;
}

function valid(sub) {
  const s = sub || {}, k = s.keys || {};
  return typeof s.endpoint === 'string' && /^https:\/\/[^\s]{10,1000}$/.test(s.endpoint) &&
    /^[A-Za-z0-9_-]{40,200}={0,2}$/.test(k.p256dh || '') && /^[A-Za-z0-9_-]{10,100}={0,2}$/.test(k.auth || '');
}

// Save (or move) a subscription. The same browser re-subscribing replaces its old row (endpoint is unique).
export async function subscribe({ kind, conversationId = null, staffId = null, sub }) {
  if (!pushKey()) throw Object.assign(new Error('Notifications are not set up yet.'), { status: 503 });
  if (!valid(sub)) throw Object.assign(new Error('Invalid notification subscription'), { status: 400 });
  if (kind !== 'client' && kind !== 'staff') throw Object.assign(new Error('Unknown kind'), { status: 400 });
  await ensureTable();
  await getClient().execute({
    sql: `INSERT INTO push_subs (kind, conversation_id, staff_id, endpoint, p256dh, auth) VALUES (?, ?, ?, ?, ?, ?)
          ON CONFLICT(endpoint) DO UPDATE SET kind = excluded.kind, conversation_id = excluded.conversation_id, staff_id = excluded.staff_id,
            p256dh = excluded.p256dh, auth = excluded.auth`,
    args: [kind, kind === 'client' ? conversationId : null, kind === 'staff' ? staffId : null, sub.endpoint, sub.keys.p256dh, sub.keys.auth]
  });
}

// Remove by endpoint; a client may only remove its own conversation's row.
export async function unsubscribe(endpoint, { conversationId } = {}) {
  await ensureTable();
  if (conversationId) await getClient().execute({ sql: "DELETE FROM push_subs WHERE endpoint = ? AND kind = 'client' AND conversation_id = ?", args: [String(endpoint), conversationId] });
  else await getClient().execute({ sql: 'DELETE FROM push_subs WHERE endpoint = ?', args: [String(endpoint)] });
}

async function sendTo(rows, message) {
  if (!rows.length) return { sent: 0, removed: 0 };
  const payload = JSON.stringify(message);
  let sent = 0, removed = 0;
  await Promise.allSettled(rows.map(async (r) => {
    try {
      await sender({ endpoint: r.endpoint, keys: { p256dh: r.p256dh, auth: r.auth } }, payload);
      sent++;
    } catch (e) {
      if (e && (e.statusCode === 404 || e.statusCode === 410)) { removed++; await getClient().execute({ sql: 'DELETE FROM push_subs WHERE id = ?', args: [r.id] }); }
      else console.error('push failed:', e && (e.statusCode || e.message));
    }
  }));
  return { sent, removed };
}

// Never throws: a notification problem must not break sending a message.
async function safe(fn) {
  if (!pushKey()) return { sent: 0, removed: 0 };
  try { await ensureTable(); return await fn(); } catch (e) { console.error('push error:', e.message); return { sent: 0, removed: 0, error: e.message }; }
}

// Team replied -> the visitor's phone. The link inside is opened by the service worker (the chat app / page).
export function pushToClient(conv, { staffName = 'Henry', text = '' } = {}) {
  return safe(async () => {
    const rows = rowsOf(await getClient().execute({ sql: "SELECT id, endpoint, p256dh, auth FROM push_subs WHERE kind = 'client' AND conversation_id = ?", args: [conv.id] }));
    return sendTo(rows, { title: String(staffName).split(' ')[0] + ' replied · CleverStack', body: clip(text, 120) || 'You have a new message.', url: '/messages', tag: 'cs-chat-' + conv.id });
  });
}

// Client wrote (or a new website chat started) -> every staff device.
export function pushToStaff(conv, { text = '', isNew = false } = {}) {
  return safe(async () => {
    const rows = rowsOf(await getClient().execute("SELECT id, endpoint, p256dh, auth FROM push_subs WHERE kind = 'staff'"));
    const who = conv.client_name || conv.client_email || 'A visitor';
    const label = !isNew ? '💬 ' : conv.subject === 'Website chat' ? '💬 New website chat: ' : '📩 New enquiry: ';
    return sendTo(rows, { title: label + who, body: clip(text, 120) || 'New message', url: '/admin#inbox-' + conv.id, tag: 'cs-inbox-' + conv.id });
  });
}
