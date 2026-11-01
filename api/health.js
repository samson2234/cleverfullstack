export const config = { runtime: 'nodejs' };
import { withMonitor } from '../lib/monitor.js';
import { getClient } from '../lib/db.js';

// api/health.js — uptime-monitoring endpoint (UptimeRobot, the GitHub Actions check).
// GET /api/health          -> 200 when the serverless runtime is alive (fast, no database).
// GET /api/health?deep=1   -> also checks the database (where leads are saved) and that email is configured;
//                             503 when the database does not answer, so the uptime monitor alerts.
// Answers contain no secrets or data, only "ok"/"down"/"not configured".

const withTimeout = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('timed out after ' + ms + ' ms')), ms))]);

async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const deep = /[?&]deep=1\b/.test(req.url || '');
  const out = { ok: true, status: 'ok', time: new Date().toISOString() };
  if (deep) {
    if (!process.env.TURSO_DATABASE_URL) out.database = 'not configured';
    else {
      const t0 = Date.now();
      try { await withTimeout(getClient().execute('SELECT 1'), 5000); out.database = 'ok'; out.database_ms = Date.now() - t0; }
      catch (e) { out.database = 'down'; out.ok = false; out.status = 'degraded'; console.error('health: database check failed:', e.message); }
    }
    out.email = process.env.RESEND_API_KEY ? 'configured' : 'not configured';
    out.error_alerts = process.env.SENTRY_DSN ? 'configured' : 'not configured';
  }
  return res.status(out.ok ? 200 : 503).json(out);
}

export default withMonitor('api/health', handler);
