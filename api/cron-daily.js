export const config = { runtime: 'nodejs' };

// api/cron-daily.js — Vercel Cron (see "crons" in vercel.json), every day at 00:15 UTC:
// summarises the day that just finished into analytics rollups so the CRM dashboard stays fast at any traffic.
// On the 3rd of each month it also emails the owner the SEO and leads report for last month (Search Console data
// is final about 2 days after the month ends).
// Same protection as the weekly job: requires "Authorization: Bearer <CRON_SECRET>".

import crypto from 'node:crypto';
import { buildPendingRollups } from '../lib/analytics.js';
import { sendMonthlyLeadsReport } from '../lib/analytics-report.js';

function authorised(req) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const a = crypto.createHash('sha256').update(String(req.headers.authorization || '')).digest();
  const b = crypto.createHash('sha256').update('Bearer ' + secret).digest();
  return crypto.timingSafeEqual(a, b);
}

export default async function handler(req, res) {
  if (!process.env.CRON_SECRET) return res.status(503).json({ error: 'CRON_SECRET is not set' });
  if (!authorised(req)) return res.status(401).json({ error: 'Unauthorised' });
  if (!process.env.TURSO_DATABASE_URL) return res.status(503).json({ error: 'Database not configured' });
  try {
    const checkedDays = await buildPendingRollups();
    let monthly;
    if (new Date().getUTCDate() === 3 && process.env.RESEND_API_KEY) {
      try { monthly = await sendMonthlyLeadsReport(); } catch (e) { console.error('monthly leads report failed:', e); monthly = { ok: false }; }
    }
    return res.status(200).json({ ok: true, checkedDays, monthly });
  } catch (err) {
    console.error('daily rollup failed:', err);
    return res.status(500).json({ error: 'Rollup failed' });
  }
}
