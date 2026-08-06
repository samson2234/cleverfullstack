export const config = { runtime: 'nodejs' };

// api/health.js — uptime-monitoring endpoint
// Returns a lightweight 200 so external monitors (or the bundled GitHub
// Actions check) can confirm the site + serverless runtime are alive.

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Access-Control-Allow-Origin', '*');
  return res.status(200).json({
    ok: true,
    status: 'ok',
    time: new Date().toISOString()
  });
}
