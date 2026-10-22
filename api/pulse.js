export const config = { runtime: 'nodejs' };

// api/pulse.js — receives first-party analytics beacons from analytics.js (page views, clicks, engagement, leads).
// Cookieless and privacy-first: see lib/analytics.js. Named "pulse" rather than "track" because ad blockers
// commonly block URLs containing "track", which would make the numbers inaccurate.
//
// Accepts POST text/plain (navigator.sendBeacon) or application/json: { s: sessionId, w: screenWidth, e: [events] }
// Ignores bots, requests from other websites, and anything malformed. Always answers 204 so it never affects pages.

import { recordEvents, isBot } from '../lib/analytics.js';
import { rateLimit, clientIp } from '../lib/rate-limit.js';
import { siteUrl } from '../lib/email.js';
import { activeTests } from '../lib/ab.js';

function ownHosts() {
  const hosts = ['cleverfullstack.vercel.app'];
  try { hosts.push(new URL(siteUrl()).hostname.replace(/^www\./, '')); } catch (e) {}
  for (const h of String(process.env.ANALYTICS_HOSTS || '').split(',')) if (h.trim()) hosts.push(h.trim().toLowerCase().replace(/^www\./, ''));
  return [...new Set(hosts)];
}
const hostOf = (u) => { try { return new URL(u).hostname.toLowerCase().replace(/^www\./, ''); } catch (e) { return ''; } };
const header = (req, k) => { const v = req.headers[k]; return Array.isArray(v) ? v[0] : v || ''; };
const decode = (v) => { try { return decodeURIComponent(v); } catch (e) { return v; } };

export default async function handler(req, res) {
  if (req.method === 'GET' && /[?&]ab=1/.test(req.url || '')) {
    // running A/B tests for the website (no names or results); cached at the edge for a minute
    let tests = [];
    try { if (process.env.TURSO_DATABASE_URL) tests = await activeTests(); } catch (e) { console.error('ab config:', e && e.message); }
    res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=60, stale-while-revalidate=300');
    return res.status(200).json({ tests });
  }
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).end(); }
  try {
    if (!process.env.TURSO_DATABASE_URL) return res.status(204).end();
    const ua = header(req, 'user-agent');
    if (isBot(ua)) return res.status(204).end();

    const hosts = ownHosts();
    const from = hostOf(header(req, 'origin')) || hostOf(header(req, 'referer'));
    if (from && !hosts.some((h) => from === h || from.endsWith('.' + h))) return res.status(204).end();

    const rl = await rateLimit(req, { limit: 120, windowMs: 60000, key: 'pulse' });
    if (!rl.allowed) return res.status(204).end();

    let body = req.body;
    if (typeof body === 'string') { if (body.length > 16000) return res.status(204).end(); try { body = JSON.parse(body); } catch (e) { return res.status(204).end(); } }
    if (!body || typeof body !== 'object' || body.wd) return res.status(204).end();

    await recordEvents(body, {
      ip: clientIp(req), ua,
      country: header(req, 'x-vercel-ip-country'),
      region: decode(header(req, 'x-vercel-ip-country-region')),
      city: decode(header(req, 'x-vercel-ip-city')),
      ownHosts: hosts
    });
  } catch (err) {
    console.error('pulse error:', err && err.message);
  }
  return res.status(204).end();
}
