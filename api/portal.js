export const config = { runtime: 'nodejs' };

// api/portal.js — the CLIENT side of project conversations (messages.html).
// Auth is the private conversation link token (?t= / body.t); only its hash is stored (lib/messages.js).
//
//   GET  /api/portal?t=TOKEN[&after=ID]  -> conversation + messages (newer than ID); marks staff messages read
//   POST /api/portal { t, body }         -> client message; emails the owner
//
// NOTE: this is function 12 of the 12 allowed on Vercel's Hobby plan. New server features must be added to an
// existing function (or the project moved to Pro).

import { conversationForToken, getMessages, addMessage, markRead } from '../lib/messages.js';
import { sendResendEmail, ownerEmail, ownerMessageTemplate } from '../lib/email.js';
import { rateLimit } from '../lib/rate-limit.js';
import { isBotPayload } from '../lib/honeypot.js';

const publicMessage = (m) => ({ id: m.id, from: m.sender === 'client' ? 'you' : m.sender, name: m.sender === 'client' ? '' : (m.staff_name || 'CleverStack'), body: m.body, at: m.created_at });

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Robots-Tag', 'noindex');
  if (!process.env.TURSO_DATABASE_URL) return res.status(503).json({ error: 'Messaging is temporarily unavailable.' });
  try {
    if (req.method === 'GET') {
      const rl = await rateLimit(req, { limit: 60, windowMs: 60000, key: 'portal-read' });
      if (!rl.allowed) return res.status(429).json({ error: 'Too many requests, please slow down.' });
      const u = new URL(req.url || '/', 'http://x');
      const conv = await conversationForToken(u.searchParams.get('t'));
      if (!conv) return res.status(404).json({ error: 'This conversation link is not valid. Ask us for a new one.' });
      const after = parseInt(u.searchParams.get('after'), 10) || 0;
      const messages = (await getMessages(conv.id, after)).map(publicMessage);
      if (conv.unread_client) await markRead(conv.id, 'client');
      return res.status(200).json({ conversation: { subject: conv.subject, status: conv.status, name: conv.client_name }, messages });
    }

    if (req.method === 'POST') {
      const b = req.body || {};
      if (isBotPayload(b)) return res.status(200).json({ success: true });
      const rl = await rateLimit(req, { limit: 20, windowMs: 600000, key: 'portal-post' });
      if (!rl.allowed) { res.setHeader('Retry-After', String(rl.retryAfter)); return res.status(429).json({ error: 'You are sending messages very quickly. Please wait a moment.' }); }
      const conv = await conversationForToken(b.t);
      if (!conv) return res.status(404).json({ error: 'This conversation link is not valid. Ask us for a new one.' });
      const id = await addMessage(conv.id, { sender: 'client', body: b.body });
      if (process.env.RESEND_API_KEY) {
        try {
          const r = await sendResendEmail({ to: ownerEmail(), subject: 'New message from ' + (conv.client_name || conv.client_email) + ': ' + conv.subject, html: ownerMessageTemplate(conv, String(b.body)), replyTo: conv.client_email });
          if (!r.ok) console.error('portal owner email failed:', r.error);
        } catch (e) { console.error('portal owner email failed:', e.message); }
      }
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
