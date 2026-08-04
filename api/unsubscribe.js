export const config = { runtime: 'nodejs' };

// api/unsubscribe.js — One-click unsubscribe from the newsletter
// Called from the unsubscribe link in welcome/broadcast emails.
// GET /api/unsubscribe?email=user@example.com

import { getClient } from '../lib/db.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

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
    '<p>You\'ve been removed from the CleverStack newsletter. No hard feelings — our <a href="https://cleverstack.dev/portfolio.html">portfolio</a> is always open if you want to see what we\'re building.</p>' +
    '<p style="font-size:13px;color:#8a90a6;">If this was a mistake, you can re-subscribe anytime on <a href="https://cleverstack.dev/">cleverstack.dev</a>.</p>' +
    '</div></body></html>'
  );
}
