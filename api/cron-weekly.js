export const config = { runtime: 'nodejs' };

// api/cron-weekly.js — Vercel Cron (see "crons" in vercel.json): every Monday 07:00 UTC (08:00 in Lagos)
// emails the owner the weekly analytics report and prunes analytics events older than ~13 months.
//
// SETUP: add CRON_SECRET (any long random string) in Vercel -> Settings -> Environment Variables.
// Vercel sends it as "Authorization: Bearer <CRON_SECRET>" on every cron call; anything else is refused.
// Needs RESEND_API_KEY for the email (and TURSO_DATABASE_URL for the data).

import crypto from 'node:crypto';
import { sendWeeklyReport } from '../lib/analytics-report.js';

function authorised(req) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const got = String(req.headers.authorization || '');
  const a = crypto.createHash('sha256').update(got).digest();
  const b = crypto.createHash('sha256').update('Bearer ' + secret).digest();
  return crypto.timingSafeEqual(a, b);
}

export default async function handler(req, res) {
  if (!process.env.CRON_SECRET) return res.status(503).json({ error: 'CRON_SECRET is not set' });
  if (!authorised(req)) return res.status(401).json({ error: 'Unauthorised' });
  if (!process.env.TURSO_DATABASE_URL) return res.status(503).json({ error: 'Database not configured' });
  try {
    const r = await sendWeeklyReport();
    return res.status(r.ok ? 200 : 502).json(r);
  } catch (err) {
    console.error('weekly report failed:', err);
    return res.status(500).json({ error: 'Report failed' });
  }
}
