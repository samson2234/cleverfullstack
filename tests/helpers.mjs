// Shared test helpers. Each test file runs in its own process (node --test), so setting the
// env here gives every file its own throwaway SQLite database. Nothing touches production.
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';

const dbFile = path.join(os.tmpdir(), `cs-test-${process.pid}-${Date.now()}.db`);
process.env.TURSO_DATABASE_URL = 'file:' + dbFile.replace(/\\/g, '/');
process.env.ADMIN_PASSWORD = 'test-admin-password';
delete process.env.RESEND_API_KEY;
delete process.env.UPSTASH_REDIS_REST_URL;
delete process.env.UPSTASH_REDIS_REST_TOKEN;

export const ADMIN = { authorization: 'Bearer test-admin-password' };

export function cleanup() {
  for (const ext of ['', '-wal', '-shm', '-journal']) { try { fs.unlinkSync(dbFile + ext); } catch { /* ignore */ } }
}

// Minimal Vercel-style req/res so the real handlers run unmodified.
export function call(handler, { method = 'GET', url = '/', body, headers = {}, ip = '10.0.0.1' } = {}) {
  return new Promise((resolve, reject) => {
    const req = { method, url, body, headers: { 'x-forwarded-for': ip, ...headers }, socket: {} };
    const u = new URL(url, 'http://x');
    req.query = Object.fromEntries(u.searchParams);
    const res = {
      headers: {}, code: 200,
      setHeader(k, v) { this.headers[k.toLowerCase()] = v; },
      status(c) { this.code = c; return this; },
      json(o) { resolve({ code: this.code, body: o, headers: this.headers }); },
      send(t) { resolve({ code: this.code, body: t, headers: this.headers }); },
      end() { resolve({ code: this.code, headers: this.headers }); }
    };
    Promise.resolve(handler(req, res)).catch(reject);
  });
}

// Replace global fetch for the duration of a test (e.g. to fake Resend / Upstash).
export function mockFetch(fn) {
  const real = globalThis.fetch;
  globalThis.fetch = fn;
  return () => { globalThis.fetch = real; };
}
