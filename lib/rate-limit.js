// lib/rate-limit.js — per-IP rate limiter: shared (Upstash Redis) when configured, in-memory otherwise.
//
// SHARED MODE (recommended for production traffic): set UPSTASH_REDIS_REST_URL and
// UPSTASH_REDIS_REST_TOKEN in Vercel. Limits are then enforced across ALL serverless
// instances, so a flood cannot slip through just because it was spread over many instances.
// If Redis is slow or down the limiter fails OPEN to the in-memory limiter (visitors are never
// blocked because of an outage in the limiter itself).
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

// `key` gives each endpoint its own bucket, so e.g. admin calls and review
// submissions from the same IP do not eat each other's allowance.
export async function rateLimit(req, { limit = 10, windowMs = 60000, key = '' } = {}) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (url && token) {
    try {
      const k = 'rl:' + (key ? key + ':' : '') + clientIp(req);
      const ttl = Math.max(1, Math.ceil(windowMs / 1000));
      // INCR + EXPIRE NX in one round trip; the window starts at the first hit
      const r = await fetch(url.replace(/\/$/, '') + '/pipeline', {
        method: 'POST',
        signal: AbortSignal.timeout(800),
        headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify([['INCR', k], ['EXPIRE', k, ttl, 'NX'], ['TTL', k]])
      });
      if (r.ok) {
        const out = await r.json();
        const count = Number(out && out[0] && out[0].result);
        if (Number.isFinite(count)) {
          if (count > limit) return { allowed: false, retryAfter: Math.max(1, Number(out[2] && out[2].result) || ttl) };
          return { allowed: true };
        }
      }
    } catch (e) { /* fall through to the in-memory limiter */ }
  }
  return memoryLimit(req, { limit, windowMs, key });
}

function memoryLimit(req, { limit, windowMs, key }) {
  const bucketId = (key ? key + ':' : '') + clientIp(req);
  const now = Date.now();

  let hits = buckets.get(bucketId);
  if (!hits) {
    hits = [];
    buckets.set(bucketId, hits);
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
