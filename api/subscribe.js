export const config = { runtime: 'nodejs' };

// api/subscribe.js — Newsletter signup
//
// Flow:
//   1. Save email to subscribers table (deduped by email)
//   2. Send welcome email to the subscriber
//   3. Send instant notification email to you (owner)
//   4. Log every email to email_log
//
// SETUP: requires TURSO_DATABASE_URL, TURSO_AUTH_TOKEN, RESEND_API_KEY
// and a verified RESEND_FROM domain (see lib/email.js).

import { addSubscriber, logEmail } from '../lib/db.js';
import {
  sendResendEmail,
  welcomeEmailTemplate,
  subscriberNotificationTemplate,
  ownerEmail
} from '../lib/email.js';
import { rateLimit } from '../lib/rate-limit.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const rl = rateLimit(req, { limit: 10, windowMs: 60000 });
  if (!rl.allowed) {
    res.setHeader('Retry-After', String(rl.retryAfter));
    return res.status(429).json({ error: 'Too many requests — please wait a moment and try again.' });
  }

  const body = req.body || {};
  const email = (body.email || '').trim().toLowerCase();
  const name = (body.name || '').trim();
  const source = (body.source || '').trim() || 'newsletter';

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email) return res.status(400).json({ error: 'Email is required' });
  if (!emailRegex.test(email)) return res.status(400).json({ error: 'Invalid email address' });
  if (email.length > 200 || name.length > 200) {
    return res.status(400).json({ error: 'Input too long' });
  }

  // 1. Save to DB (dedupes by email)
  let saved = false;
  let subscriberId = null;
  if (process.env.TURSO_DATABASE_URL) {
    try {
      const result = await addSubscriber(email, name, source);
      subscriberId = result.id;
      saved = true;
      if (!result.added) {
        // Re-subscribing is not an error, but no need for a second welcome email
        return res.status(200).json({
          success: true,
          message: 'You are already subscribed — welcome back!',
          _meta: { subscriber_id: subscriberId, already_subscribed: true }
        });
      }
    } catch (err) {
      console.error('Subscriber DB save failed:', err.message);
    }
  } else {
    console.log('TURSO_DATABASE_URL not set — skipping subscriber DB save');
  }

  let welcomeSent = false;
  let notified = false;

  // 2. Welcome email to the subscriber
  if (process.env.RESEND_API_KEY) {
    try {
      const result = await sendResendEmail({
        to: email,
        subject: 'Welcome to CleverStack!',
        html: welcomeEmailTemplate(name, email)
      });
      welcomeSent = result.ok;
      await logEmail({
        to_email: email,
        type: 'welcome',
        subject: 'Welcome to CleverStack!',
        status: result.ok ? 'sent' : 'failed',
        error: result.ok ? '' : result.error
      });
      if (!result.ok) console.error('Welcome email failed:', result.error);
    } catch (err) {
      console.error('Welcome email request failed:', err.message);
    }

    // 3. Instant owner notification
    try {
      const result = await sendResendEmail({
        to: ownerEmail(),
        subject: 'New Subscriber: ' + email + ' — CleverStack',
        html: subscriberNotificationTemplate(email, name, source)
      });
      notified = result.ok;
      await logEmail({
        to_email: ownerEmail(),
        type: 'subscriber_notify',
        subject: 'New Subscriber: ' + email,
        status: result.ok ? 'sent' : 'failed',
        error: result.ok ? '' : result.error
      });
      if (!result.ok) console.error('Owner notification failed:', result.error);
    } catch (err) {
      console.error('Owner notification request failed:', err.message);
    }
  }

  if (saved || welcomeSent) {
    return res.status(200).json({
      success: true,
      message: 'You\'re in! Check your inbox for a welcome email.',
      _meta: {
        saved_to_db: saved,
        welcome_sent: welcomeSent,
        owner_notified: notified,
        subscriber_id: subscriberId
      }
    });
  }

  console.log('=== NEW SUBSCRIBER (no DB or email configured) ===');
  console.log(JSON.stringify({ email, name, source }, null, 2));
  console.log('=====================================================');

  return res.status(200).json({
    success: true,
    message: 'Thank you for subscribing!'
  });
}
