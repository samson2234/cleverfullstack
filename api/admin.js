export const config = { runtime: 'nodejs' };

// api/admin.js — Admin Dashboard API (Mini-CRM)
//
// Handles: dashboard stats, lead pipeline (list/search/filter/status/notes/
// follow-up/reply-by-email/delete), subscribers (list/delete/broadcast),
// email log, and CSV export.
//
// Auth: Bearer token using ADMIN_PASSWORD env var.
//
// SETUP:
//   1. Vercel Env Var: ADMIN_PASSWORD = choose_a_strong_password
//   2. Access at: cleverstack.dev/admin.html
//   3. Login with your admin password
//
// Email features require RESEND_API_KEY (+ RESEND_FROM for real delivery).

import {
  getSubmissions,
  getSubmissionCount,
  getDashboardStats,
  markAsRead,
  getSubmission,
  deleteSubmission,
  updateSubmissionStatus,
  addSubmissionNote,
  setSubmissionFollowUp,
  getSubscribers,
  getSubscriberCount,
  deleteSubscriber,
  getEmailLog,
  logEmail
} from '../lib/db.js';
import {
  sendResendEmail,
  replyEmailTemplate,
  broadcastEmailTemplate
} from '../lib/email.js';
import { rateLimit, clientIp } from '../lib/rate-limit.js';
import crypto from 'node:crypto';

// Failed-login lockout: after MAX_FAILS wrong passwords from an IP, the IP is
// blocked for LOCKOUT_MS. Stored in-memory (per instance) — same threat model
// as lib/rate-limit.js, and pairing with the 30 req/min limiter keeps a
// distributed brute-force impractical.
const MAX_FAILS = 5;
const LOCKOUT_MS = 5 * 60 * 1000;
const authFailures = new Map();

function getFailureState(ip) {
  const now = Date.now();
  let state = authFailures.get(ip);
  if (!state) {
    state = { count: 0, lockedUntil: 0 };
    authFailures.set(ip, state);
  } else if (state.lockedUntil && state.lockedUntil <= now) {
    state.count = 0;
    state.lockedUntil = 0;
  }
  if (authFailures.size > 1000) {
    for (const [k, s] of authFailures) {
      if (s.lockedUntil <= now && s.count === 0) authFailures.delete(k);
    }
  }
  return state;
}

function isLockedOut(ip) {
  const state = getFailureState(ip);
  return state.lockedUntil > Date.now();
}

function recordFailure(ip) {
  const state = getFailureState(ip);
  state.count += 1;
  if (state.count >= MAX_FAILS) {
    state.lockedUntil = Date.now() + LOCKOUT_MS;
  }
}

function clearFailures(ip) {
  const state = authFailures.get(ip);
  if (state) {
    state.count = 0;
    state.lockedUntil = 0;
  }
}

function verifyAuth(req) {
  const auth = req.headers.authorization || '';
  const token = auth.replace(/^Bearer\s+/i, '');
  const password = process.env.ADMIN_PASSWORD;

  if (!password) {
    return { ok: false, error: 'ADMIN_PASSWORD env var not set' };
  }

  // timingSafeEqual requires equal-length inputs, so both sides are hashed
  // to a fixed-length sha256 digest before comparison.
  const a = crypto.createHash('sha256').update(token).digest();
  const b = crypto.createHash('sha256').update(password).digest();
  if (!crypto.timingSafeEqual(a, b)) {
    return { ok: false, error: 'Invalid password' };
  }

  return { ok: true };
}

function readParams(req) {
  const url = req.url || '';
  return new URLSearchParams(url.split('?')[1] || '');
}

function jsonToCsv(headers, rows) {
  const esc = (v) => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
  const lines = [headers.map(esc).join(',')];
  for (const r of rows) {
    lines.push(headers.map((h) => esc(r[h])).join(','));
  }
  return '\uFEFF' + lines.join('\r\n');
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const rl = rateLimit(req, { limit: 30, windowMs: 60000 });
  if (!rl.allowed) {
    res.setHeader('Retry-After', String(rl.retryAfter));
    return res.status(429).json({ error: 'Too many requests — please wait a moment and try again.' });
  }

  const ip = clientIp(req);
  if (isLockedOut(ip)) {
    res.setHeader('Retry-After', String(Math.ceil((getFailureState(ip).lockedUntil - Date.now()) / 1000)));
    return res.status(429).json({ error: 'Too many failed attempts — please wait a few minutes and try again.' });
  }

  const auth = verifyAuth(req);
  if (!auth.ok) {
    recordFailure(ip);
    return res.status(401).json({ error: auth.error });
  }
  clearFailures(ip);

  if (!process.env.TURSO_DATABASE_URL) {
    return res.status(503).json({
      error: 'Database not configured. Set TURSO_DATABASE_URL in Vercel env vars.'
    });
  }

  try {
    // ===================== GET =====================
    if (req.method === 'GET') {
      const params = readParams(req);
      const view = params.get('view') || 'submissions';

      // Dashboard stats
      if (params.get('stats') === 'true') {
        const stats = await getDashboardStats();
        return res.status(200).json(stats);
      }

      // CSV export of leads
      if (params.get('export') === 'leads') {
        const all = await getSubmissions({ limit: 10000, offset: 0 });
        const csv = jsonToCsv(
          ['id', 'name', 'email', 'phone', 'status', 'source', 'utm_source', 'utm_medium', 'utm_campaign', 'is_read', 'created_at', 'message'],
          all.map((r) => ({ ...r }))
        );
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename="cleverstack-leads.csv"');
        return res.status(200).send(csv);
      }

      // CSV export of subscribers
      if (params.get('export') === 'subscribers') {
        const all = await getSubscribers({ limit: 10000, offset: 0 });
        const csv = jsonToCsv(
          ['id', 'email', 'name', 'source', 'status', 'created_at'],
          all.map((r) => ({ ...r }))
        );
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename="cleverstack-subscribers.csv"');
        return res.status(200).send(csv);
      }

      // Subscribers list
      if (view === 'subscribers') {
        const limit = parseInt(params.get('limit')) || 100;
        const offset = parseInt(params.get('offset')) || 0;
        const search = params.get('q') || '';
        const subscribers = await getSubscribers({ limit, offset, search });
        const total = await getSubscriberCount();
        return res.status(200).json({ subscribers, total, limit, offset });
      }

      // Email log
      if (view === 'email_log') {
        const limit = parseInt(params.get('limit')) || 100;
        const log = await getEmailLog(limit);
        return res.status(200).json({ log, limit });
      }

      // Submissions / leads list (default)
      const limit = parseInt(params.get('limit')) || 100;
      const offset = parseInt(params.get('offset')) || 0;
      const unreadOnly = params.get('unread') === 'true';
      const status = params.get('status') || '';
      const search = params.get('q') || '';

      const submissions = await getSubmissions({ limit, offset, unread: unreadOnly, status, search });
      const total = await getSubmissionCount({ unread: unreadOnly, status, search });
      const unread = await getSubmissionCount({ unread: true });
      const totalAll = await getSubmissionCount();

      return res.status(200).json({
        submissions,
        total,
        totalAll,
        unread,
        limit,
        offset
      });
    }

    // ===================== POST =====================
    if (req.method === 'POST') {
      const body = req.body || {};
      const action = body.action;

      if (!action) {
        return res.status(400).json({ error: 'action is required' });
      }

      // ---- Lead actions ----
      if (action === 'mark_read') {
        if (!body.id) return res.status(400).json({ error: 'id required' });
        await markAsRead(body.id);
        return res.status(200).json({ success: true, message: 'Marked as read' });
      }

      if (action === 'get') {
        if (!body.id) return res.status(400).json({ error: 'id required' });
        const submission = await getSubmission(body.id);
        if (!submission) return res.status(404).json({ error: 'Submission not found' });
        await markAsRead(body.id);
        return res.status(200).json({ submission });
      }

      if (action === 'delete') {
        if (!body.id) return res.status(400).json({ error: 'id required' });
        await deleteSubmission(body.id);
        return res.status(200).json({ success: true, message: 'Deleted' });
      }

      if (action === 'set_status') {
        if (!body.id || !body.status) return res.status(400).json({ error: 'id and status required' });
        await updateSubmissionStatus(body.id, body.status);
        return res.status(200).json({ success: true, message: 'Status updated to ' + body.status });
      }

      if (action === 'add_note') {
        if (!body.id || !body.note) return res.status(400).json({ error: 'id and note required' });
        await addSubmissionNote(body.id, String(body.note).slice(0, 2000));
        return res.status(200).json({ success: true, message: 'Note added' });
      }

      if (action === 'set_follow_up') {
        if (!body.id) return res.status(400).json({ error: 'id required' });
        const date = body.follow_up_date || '';
        if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
          return res.status(400).json({ error: 'follow_up_date must be YYYY-MM-DD' });
        }
        await setSubmissionFollowUp(body.id, date || null);
        return res.status(200).json({ success: true, message: date ? 'Follow-up set for ' + date : 'Follow-up cleared' });
      }

      if (action === 'reply') {
        if (!body.id || !body.body) return res.status(400).json({ error: 'id and body required' });
        const submission = await getSubmission(body.id);
        if (!submission) return res.status(404).json({ error: 'Submission not found' });

        const subject = body.subject || 'Re: Your message to CleverStack';
        const result = await sendResendEmail({
          to: submission.email,
          subject,
          html: replyEmailTemplate(submission, String(body.body).slice(0, 10000)),
          replyTo: process.env.CONTACT_EMAIL || 'henryygeorge25@gmail.com'
        });
        await logEmail({
          to_email: submission.email,
          type: 'reply',
          subject,
          status: result.ok ? 'sent' : 'failed',
          error: result.ok ? '' : result.error
        });
        if (result.ok) {
          await markAsRead(body.id);
          return res.status(200).json({ success: true, message: 'Reply sent to ' + submission.email });
        }
        return res.status(500).json({ error: 'Email failed: ' + result.error });
      }

      // ---- Subscriber actions ----
      if (action === 'delete_subscriber') {
        if (!body.id) return res.status(400).json({ error: 'id required' });
        await deleteSubscriber(body.id);
        return res.status(200).json({ success: true, message: 'Subscriber deleted' });
      }

      if (action === 'broadcast') {
        if (!body.subject || !body.body) return res.status(400).json({ error: 'subject and body required' });
        const all = await getSubscribers({ limit: 10000, offset: 0 });
        const active = all.filter((s) => s.status === 'active' || !s.status);
        const target = active.map((s) => s.email);

        if (target.length === 0) {
          return res.status(200).json({ success: true, message: 'No active subscribers to send to', sent: 0 });
        }

        let sent = 0;
        let failed = 0;
        const BATCH = 50;
        for (let i = 0; i < target.length; i += BATCH) {
          const batch = target.slice(i, i + BATCH);
          const htmlBatch = batch.map((email) =>
            broadcastEmailTemplate(String(body.body).slice(0, 10000)).replace('__EMAIL__', encodeURIComponent(email))
          );
          for (let j = 0; j < batch.length; j++) {
            try {
              const result = await sendResendEmail({
                to: batch[j],
                subject: String(body.subject),
                html: htmlBatch[j]
              });
              await logEmail({
                to_email: batch[j],
                type: 'broadcast',
                subject: String(body.subject),
                status: result.ok ? 'sent' : 'failed',
                error: result.ok ? '' : result.error
              });
              if (result.ok) sent++; else failed++;
            } catch (err) {
              failed++;
              await logEmail({
                to_email: batch[j],
                type: 'broadcast',
                subject: String(body.subject),
                status: 'failed',
                error: err.message
              });
            }
          }
        }

        return res.status(200).json({
          success: true,
          message: 'Broadcast complete: ' + sent + ' sent, ' + failed + ' failed',
          sent,
          failed,
          total: target.length
        });
      }

      return res.status(400).json({ error: 'Unknown action: ' + action });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('Admin API error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
