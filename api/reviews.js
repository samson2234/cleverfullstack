export const config = { runtime: 'nodejs' };

// api/reviews.js — public reviews API
//
//   GET  /api/reviews            -> approved reviews + count + average
//   GET  /api/reviews?t=TOKEN    -> checks an invite link (returns client first name if valid)
//   POST /api/reviews            -> submit a review
//        with `token`   : verified client (from a one-time invite link) -> published immediately
//        without token  : waits as "pending" until the owner confirms they were a client

import { getPublicReviews, getValidInvite, submitVerifiedReview, submitPendingReview } from '../lib/db.js';
import { rateLimit } from '../lib/rate-limit.js';
import { isBotPayload } from '../lib/honeypot.js';

const clip = (v, n) => String(v == null ? '' : v).trim().slice(0, n);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (!process.env.TURSO_DATABASE_URL) {
    return res.status(503).json({ error: 'Reviews are temporarily unavailable.' });
  }

  try {
    if (req.method === 'GET') {
      const url = new URL(req.url || '', 'http://x');
      const t = url.searchParams.get('t');
      if (t) {
        const rl = await rateLimit(req, { limit: 30, windowMs: 60000, key: 'reviews-token' });
        if (!rl.allowed) return res.status(429).json({ error: 'Too many requests.' });
        const invite = await getValidInvite(t);
        if (!invite) return res.status(410).json({ valid: false });
        return res.status(200).json({ valid: true, name: String(invite.client_name).split(' ')[0], project: invite.project });
      }
      const data = await getPublicReviews(parseInt(url.searchParams.get('limit')) || 50);
      res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=60, stale-while-revalidate=300');
      return res.status(200).json(data);
    }

    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    if (isBotPayload(req.body)) return res.status(200).json({ success: true, published: false });

    const rl = await rateLimit(req, { limit: 5, windowMs: 3600000, key: 'reviews-post' });
    if (!rl.allowed) {
      res.setHeader('Retry-After', String(rl.retryAfter));
      return res.status(429).json({ error: 'Too many submissions — please try again later.' });
    }

    const b = req.body || {};
    const rating = parseInt(b.rating, 10);
    const data = {
      author_name: clip(b.name, 120),
      author_role: clip(b.role, 160),
      country: clip(b.country, 80),
      title: clip(b.title, 120),
      body: clip(b.body, 3000),
      rating
    };
    if (data.author_name.length < 2 || data.body.length < 20 || !(rating >= 1 && rating <= 5)) {
      return res.status(400).json({ error: 'Please add your name, a rating and at least a couple of sentences.' });
    }

    if (b.token) {
      const invite = await getValidInvite(String(b.token));
      if (!invite) return res.status(410).json({ error: 'This review link is invalid, expired or already used.' });
      const id = await submitVerifiedReview(invite, data);
      if (!id) return res.status(410).json({ error: 'This review link has already been used.' });
      return res.status(200).json({ success: true, published: true });
    }

    await submitPendingReview(data);
    return res.status(200).json({ success: true, published: false });
  } catch (err) {
    console.error('Reviews API error:', err);
    return res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
}
