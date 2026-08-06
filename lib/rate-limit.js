// lib/rate-limit.js — lightweight per-IP in-memory rate limiter.
//
// Purpose (README NFR tracker — Scalability): stop a spam flood from burning
// Turso rows + Resend quota on /api/contact, /api/subscribe, /api/admin.
//
// Design notes:
//   - In-memory Map, one bucket per IP (sliding window of timestamps).
//   - Per serverless-instance state: acceptable for this threat model — it
//     blunts floods from a single IP and brute-force attempts, costs zero
//     external resources, and adds no latency when under the limit.
//   - Memory is kept bounded: expired timestamps are pruned on access and
//     stale buckets are swept once the map grows past MAX_ENTRIES.

const buckets = new Map();
const MAX_ENTRIES = 1000;

export function clientIp(req) {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string') {
    const first = fwd.split(',')[0].trim();
    if (first) return first;
  }
  const real = req.headers['x-real-ip'];
  if (typeof real === 'string' && real) return real;
  if (req.socket && req.socket.remoteAddress) return req.socket.remoteAddress;
  return 'unknown';
}

export function rateLimit(req, { limit = 10, windowMs = 60000 } = {}) {
  const ip = clientIp(req);
  const now = Date.now();

  let hits = buckets.get(ip);
  if (!hits) {
    hits = [];
    buckets.set(ip, hits);
  } else {
    while (hits.length && hits[0] <= now - windowMs) hits.shift();
  }

  if (hits.length >= limit) {
    const retryAfter = Math.max(1, Math.ceil((hits[0] + windowMs - now) / 1000));
    if (buckets.size > MAX_ENTRIES) {
      for (const [k, arr] of buckets) {
        while (arr.length && arr[0] <= now - windowMs) arr.shift();
        if (!arr.length) buckets.delete(k);
      }
    }
    return { allowed: false, retryAfter };
  }

  hits.push(now);
  return { allowed: true };
}
