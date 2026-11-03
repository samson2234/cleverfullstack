export const config = { runtime: 'nodejs' };

// api/unsubscribe.js — One-click unsubscribe from the newsletter
// Called from the unsubscribe link in welcome/broadcast emails.
// GET /api/unsubscribe?email=user@example.com

import { getClient } from '../lib/db.js';
import { siteUrl } from '../lib/email.js';
import { markUnsubscribed } from '../lib/contacts.js';
import { unsubscribeByToken, recordProviderEvent, verifyWebhook } from '../lib/campaigns.js';
import { withMonitor } from '../lib/monitor.js';

const pageHtml = (title, html) => '<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' + title + ' — CleverStack</title></head>' +
  '<body style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;background:#f6f7fb;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;"><div style="max-width:480px;background:#fff;border-radius:12px;padding:40px;text-align:center;box-shadow:0 10px 30px rgba(0,0,0,.08);color:#5B6079;line-height:1.6;">' + html + '</div></body></html>';

// the signature covers the exact bytes Resend sent
async function rawBodyOf(req) {
  if (typeof req[Symbol.asyncIterator] === 'function' && req.readable !== false) {
    const chunks = [];
    for await (const c of req) chunks.push(Buffer.from(c));
    if (chunks.length) return Buffer.concat(chunks).toString('utf8');
  }
  if (typeof req.body === 'string') return req.body;
  if (Buffer.isBuffer(req.body)) return req.body.toString('utf8');
  return JSON.stringify(req.body || {});
}

async function handler(req, res) {
  const q = new URL(req.url || '/', 'http://x').searchParams;

  // Resend webhooks: delivered, bounced, complained (POST /api/unsubscribe?webhook=resend)
  if (req.method === 'POST' && q.get('webhook') === 'resend') {
    const secret = process.env.RESEND_WEBHOOK_SECRET;
    if (!secret) return res.status(503).json({ error: 'RESEND_WEBHOOK_SECRET is not set' });
    const raw = await rawBodyOf(req);
    if (!verifyWebhook(raw, req.headers, secret)) return res.status(401).json({ error: 'Bad signature' });
    let ev;
    try { ev = JSON.parse(raw); } catch (e) { return res.status(400).json({ error: 'Bad JSON' }); }
    await recordProviderEvent(ev);
    return res.status(200).json({ ok: true });
  }

  // Campaign emails: one-click from the mail app (POST), or a link that asks first, because mail scanners open links
  const token = q.get('t');
  if (token && req.method === 'POST') {
    await unsubscribeByToken(token);
    return res.status(200).json({ ok: true });
  }
  if (token && req.method === 'GET') {
    res.setHeader('Content-Type', 'text/html');
    if (q.get('confirm') === '1') {
      const email = await unsubscribeByToken(token);
      return res.status(email ? 200 : 404).send(pageHtml('Unsubscribed', email
        ? '<h1 style="color:#4F46E5;font-size:22px;">You\'re unsubscribed</h1><p>You will not get these emails again. Sorry to see you go.</p>'
        : '<h1 style="color:#4F46E5;font-size:22px;">Link not recognised</h1><p>Email hello@cleverstack.dev and we will remove you straight away.</p>'));
    }
    return res.status(200).send(pageHtml('Unsubscribe', '<h1 style="color:#4F46E5;font-size:22px;">Unsubscribe?</h1><p>Stop receiving these emails from CleverStack.</p><p><a href="?t=' + encodeURIComponent(token) + '&amp;confirm=1" style="display:inline-block;background:#4F46E5;color:#fff;text-decoration:none;font-weight:600;padding:12px 22px;border-radius:8px;">Yes, unsubscribe me</a></p>'));
  }

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const email = (req.query && req.query.email ? String(req.query.email) : '').trim().toLowerCase();
  if (!email) {
    return res.status(400).send('<h3>Missing email parameter</h3><p>Add ?email=you@example.com to unsubscribe.</p>');
  }

  if (process.env.TURSO_DATABASE_URL) {
    try {
      const db = getClient();
      await db.execute({ sql: 'DELETE FROM subscribers WHERE email = ?', args: [email] });
      await markUnsubscribed(email); // CRM contact: never include in campaigns again
    } catch (err) {
      console.error('Unsubscribe DB update failed:', err.message);
    }
  }

  res.setHeader('Content-Type', 'text/html');
  res.status(200).send(
    '<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>Unsubscribed — CleverStack</title>' +
    '<style>body{font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;background:#f6f7fb;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;}card{max-width:480px;background:#fff;border-radius:12px;padding:40px;text-align:center;box-shadow:0 10px 30px rgba(0,0,0,.08);}h1{color:#4F46E5;font-size:22px;}p{color:#5B6079;font-size:15px;line-height:1.6;}a{color:#4F46E5;}</style>' +
    '</head><body><div style="max-width:480px;background:#fff;border-radius:12px;padding:40px;text-align:center;box-shadow:0 10px 30px rgba(0,0,0,.08);">' +
    '<h1>You\'re unsubscribed</h1>' +
    '<p>You\'ve been removed from the CleverStack newsletter. No hard feelings — our <a href="' + siteUrl() + '/portfolio.html">portfolio</a> is always open if you want to see what we\'re building.</p>' +
    '<p style="font-size:13px;color:#8a90a6;">If this was a mistake, you can re-subscribe anytime on <a href="' + siteUrl() + '/">' + siteUrl().replace(/^https?:\/\//, '') + '</a>.</p>' +
    '</div></body></html>'
  );
}

export default withMonitor('api/unsubscribe', handler);
