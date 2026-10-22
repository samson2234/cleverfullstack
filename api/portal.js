export const config = { runtime: 'nodejs' };

// api/portal.js — the CLIENT side of project conversations (messages.html).
// Auth is the private conversation link token (?t= / body.t); lookups use its hash (lib/messages.js).
//
//   GET  /api/portal?t=TOKEN[&after=ID&since=TS] -> conversation, new messages, edited/deleted ones since TS,
//                                                  whether the team has seen them / is typing; marks read
//   GET  /api/portal?t=TOKEN&file=ID[&dl=1]      -> an attached file (images inline, everything else downloads)
//   POST /api/portal { t, body }                 -> client message; emails the owner
//   POST /api/portal { t, op: 'typing' | 'edit' | 'delete', id?, body? }
//   POST /api/portal?t=TOKEN&name=FILE           -> raw file bytes (application/octet-stream, max 4 MB) as a message
//
// NOTE: this is function 12 of the 12 allowed on Vercel's Hobby plan. New server features must be added to an
// existing function (or the project moved to Pro).

import { conversationForToken, getMessages, changedSince, serverNow, addMessage, editMessage, deleteMessage, setTyping,
  saveFile, getFile, sendFile, markRead, needsRead, CLIENT_EDIT_MINUTES } from '../lib/messages.js';
import { sendResendEmail, ownerEmail, ownerMessageTemplate } from '../lib/email.js';
import { rateLimit } from '../lib/rate-limit.js';
import { isBotPayload } from '../lib/honeypot.js';

const publicMessage = (m) => ({ id: m.id, from: m.sender === 'client' ? 'you' : m.sender, name: m.sender === 'client' ? '' : (m.staff_name || 'CleverStack'),
  body: m.body, at: m.created_at, edited: m.edited, deleted: m.deleted, file: m.file });
const INVALID = 'This conversation link is not valid. Ask us for a new one.';

async function limited(req, res, key, limit, windowMs, message) {
  const rl = await rateLimit(req, { limit, windowMs, key });
  if (rl.allowed) return false;
  if (rl.retryAfter) res.setHeader('Retry-After', String(rl.retryAfter));
  res.status(429).json({ error: message || 'Too many requests, please slow down.' });
  return true;
}

async function emailOwner(conv, text) {
  if (!process.env.RESEND_API_KEY) return;
  try {
    const r = await sendResendEmail({ to: ownerEmail(), subject: 'New message from ' + (conv.client_name || conv.client_email) + ': ' + conv.subject, html: ownerMessageTemplate(conv, text), replyTo: conv.client_email });
    if (!r.ok) console.error('portal owner email failed:', r.error);
  } catch (e) { console.error('portal owner email failed:', e.message); }
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Robots-Tag', 'noindex');
  if (!process.env.TURSO_DATABASE_URL) return res.status(503).json({ error: 'Messaging is temporarily unavailable.' });
  try {
    const u = new URL(req.url || '/', 'http://x');

    if (req.method === 'GET') {
      const fileId = parseInt(u.searchParams.get('file'), 10);
      if (fileId) {
        if (await limited(req, res, 'portal-file', 120, 60000)) return;
        const conv = await conversationForToken(u.searchParams.get('t'));
        if (!conv) return res.status(404).json({ error: INVALID });
        const file = await getFile(conv.id, fileId);
        if (!file) return res.status(404).json({ error: 'File not found' });
        return sendFile(res, file, { download: u.searchParams.get('dl') === '1' });
      }
      if (await limited(req, res, 'portal-read', 60, 60000)) return;
      const conv = await conversationForToken(u.searchParams.get('t'));
      if (!conv) return res.status(404).json({ error: INVALID });
      const after = parseInt(u.searchParams.get('after'), 10) || 0;
      const now = await serverNow();
      const messages = (await getMessages(conv.id, after)).map(publicMessage);
      const changed = after ? (await changedSince(conv.id, u.searchParams.get('since'), after)).map(publicMessage) : [];
      const newest = messages.length ? messages[messages.length - 1].id : after;
      if (await needsRead(conv, 'client', newest)) await markRead(conv.id, 'client');
      return res.status(200).json({ conversation: { subject: conv.subject, status: conv.status, name: conv.client_name },
        messages, changed, now, seen: conv.staff_seen_id, typing: conv.staff_typing, editMinutes: CLIENT_EDIT_MINUTES });
    }

    if (req.method === 'POST') {
      // file upload: raw bytes, token and file name in the query string
      if (Buffer.isBuffer(req.body)) {
        if (await limited(req, res, 'portal-upload', 15, 600000, 'You are sending files very quickly. Please wait a few minutes.')) return;
        const conv = await conversationForToken(u.searchParams.get('t'));
        if (!conv) return res.status(404).json({ error: INVALID });
        const file = await saveFile(conv.id, { name: u.searchParams.get('name'), data: req.body });
        const id = await addMessage(conv.id, { sender: 'client', body: '', fileId: file.id });
        await emailOwner(conv, '📎 Sent a file: ' + file.name);
        return res.status(200).json({ success: true, id, file });
      }

      const b = req.body || {};
      if (b.op === 'typing') {
        if (await limited(req, res, 'portal-typing', 40, 60000)) return;
        const conv = await conversationForToken(b.t);
        if (!conv) return res.status(404).json({ error: INVALID });
        await setTyping(conv.id, 'client');
        return res.status(200).json({ success: true });
      }
      if (await limited(req, res, 'portal-post', 30, 600000, 'You are sending messages very quickly. Please wait a moment.')) return;
      if (b.op === 'edit' || b.op === 'delete') {
        const conv = await conversationForToken(b.t);
        if (!conv) return res.status(404).json({ error: INVALID });
        if (b.op === 'edit') await editMessage(conv.id, parseInt(b.id, 10), 'client', b.body);
        else await deleteMessage(conv.id, parseInt(b.id, 10), 'client');
        return res.status(200).json({ success: true });
      }
      if (isBotPayload(b)) return res.status(200).json({ success: true });
      const conv = await conversationForToken(b.t);
      if (!conv) return res.status(404).json({ error: INVALID });
      const id = await addMessage(conv.id, { sender: 'client', body: b.body });
      await emailOwner(conv, String(b.body));
      return res.status(200).json({ success: true, id });
    }
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    console.error('portal error:', err);
    return res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
}
