export const config = { runtime: 'nodejs' };

// api/admin.js — Admin Dashboard API
//
// Handles listing, marking as read, and deleting submissions.
// Auth: Bearer token using ADMIN_PASSWORD env var.
//
// SETUP:
//   1. Vercel Env Var: ADMIN_PASSWORD = choose_a_strong_password
//   2. Access at: cleverstack.dev/admin.html
//   3. Login with your admin password

import { getSubmissions, getSubmissionCount, markAsRead, getSubmission, deleteSubmission, getClient } from '../lib/db.js';

function verifyAuth(req) {
  const auth = req.headers.authorization || '';
  const token = auth.replace('Bearer ', '');
  const password = process.env.ADMIN_PASSWORD;

  if (!password) {
    return { ok: false, error: 'ADMIN_PASSWORD env var not set' };
  }

  if (token !== password) {
    return { ok: false, error: 'Invalid password' };
  }

  return { ok: true };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const auth = verifyAuth(req);
  if (!auth.ok) {
    return res.status(401).json({ error: auth.error });
  }

  if (!process.env.TURSO_DATABASE_URL) {
    return res.status(503).json({
      error: 'Database not configured. Set TURSO_DATABASE_URL in Vercel env vars.'
    });
  }

  try {
    // GET — list submissions
    if (req.method === 'GET') {
      const url = req.url || '';
      const params = new URLSearchParams(url.split('?')[1] || '');

      const limit = parseInt(params.get('limit')) || 50;
      const offset = parseInt(params.get('offset')) || 0;
      const unreadOnly = params.get('unread') === 'true';
      const countOnly = params.get('count') === 'true';

      if (countOnly) {
        const total = await getSubmissionCount(false);
        const unread = await getSubmissionCount(true);
        return res.status(200).json({ total: total, unread: unread });
      }

      const submissions = await getSubmissions({
        limit: limit,
        offset: offset,
        unread: unreadOnly
      });

      const total = await getSubmissionCount(false);
      const unread = await getSubmissionCount(true);

      return res.status(200).json({
        submissions: submissions,
        total: total,
        unread: unread,
        limit: limit,
        offset: offset
      });
    }

    // POST — mark as read, get, or delete
    if (req.method === 'POST') {
      const body = req.body || {};
      const action = body.action;
      const id = body.id;

      if (!action || !id) {
        return res.status(400).json({ error: 'action and id are required' });
      }

      if (action === 'mark_read') {
        await markAsRead(id);
        return res.status(200).json({ success: true, message: 'Marked as read' });
      }

      if (action === 'get') {
        const submission = await getSubmission(id);
        if (!submission) {
          return res.status(404).json({ error: 'Submission not found' });
        }
        await markAsRead(id);
        return res.status(200).json({ submission: submission });
      }

      if (action === 'delete') {
        await deleteSubmission(id);
        return res.status(200).json({ success: true, message: 'Deleted' });
      }

      return res.status(400).json({ error: 'Unknown action: ' + action });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('Admin API error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
