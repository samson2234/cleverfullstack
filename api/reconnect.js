export const config = { runtime: 'nodejs' };

// api/reconnect.js — "Worked with us before? Welcome back" form.
//
// Many past clients (e.g. from Fiverr) can no longer be reached. This lets them find the
// site and identify themselves, which puts them into the CRM as a past client so the owner can
// follow up, invite a review, or offer a returning-client deal. Nothing is auto-published.

import { upsertReturningClient } from '../lib/contacts.js';
import { sendResendEmail, ownerEmail, esc } from '../lib/email.js';
import { rateLimit } from '../lib/rate-limit.js';
import { isBotPayload } from '../lib/honeypot.js';

const clip = (v, n) => String(v == null ? '' : v).trim().slice(0, n);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (isBotPayload(req.body)) return res.status(200).json({ success: true });

  const rl = await rateLimit(req, { limit: 5, windowMs: 3600000, key: 'reconnect' });
  if (!rl.allowed) {
    res.setHeader('Retry-After', String(rl.retryAfter));
    return res.status(429).json({ error: 'Too many requests — please try again later.' });
  }
  if (!process.env.TURSO_DATABASE_URL) return res.status(503).json({ error: 'Temporarily unavailable.' });

  const b = req.body || {};
  const d = {
    name: clip(b.name, 120), email: clip(b.email, 200), company: clip(b.company, 160), country: clip(b.country, 80),
    channel: clip(b.channel, 80), project: clip(b.project, 200), need: clip(b.need, 1000)
  };
  if (d.name.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email)) {
    return res.status(400).json({ error: 'Please enter your name and a valid email.' });
  }

  try {
    await upsertReturningClient(d);
  } catch (err) {
    console.error('Reconnect save failed:', err);
    return res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }

  // Best-effort owner notification; the CRM record is the source of truth.
  try {
    await sendResendEmail({
      to: ownerEmail(),
      subject: 'Returning client: ' + d.name,
      html: '<p><strong>' + esc(d.name) + '</strong> (' + esc(d.email) + ') says they worked with you before.</p>' +
        (d.project ? '<p>Project: ' + esc(d.project) + '</p>' : '') + (d.channel ? '<p>Found you via: ' + esc(d.channel) + '</p>' : '') +
        (d.need ? '<p>Needs now: ' + esc(d.need) + '</p>' : ''),
      replyTo: d.email
    });
  } catch (e) { /* never fail the visitor because of the notification */ }

  return res.status(200).json({ success: true });
}
