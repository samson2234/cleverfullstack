export const config = { runtime: 'nodejs' };

// api/contact.js — Contact Form Handler with Database + Email + CRM
//
// LAYER 1 (PRIMARY): Turso database — every submission saved permanently
// LAYER 2 (BACKUP): Resend email — instant notification to your inbox
// LAYER 3: Auto-responder — confirmation to the submitter
// LAYER 4: Newsletter opt-in — if the visitor checked "subscribe", they're
//          added to the subscribers table and get the welcome email.
// LAYER 5 (FALLBACK): Web3Forms if no Resend configured
//
// Even if email fails, the submission is in the database.
// Even if the database has issues, the email was sent.
// Zero lost contacts.
//
// SETUP:
//   1. Turso DB (free): https://turso.tech
//      - turso db create cleverstack-contacts
//      - turso db tokens create cleverstack-contacts
//      - Vercel Env Vars: TURSO_DATABASE_URL, TURSO_AUTH_TOKEN
//
//   2. Resend email (free tier): https://resend.com
//      - Vercel Env Vars: RESEND_API_KEY, CONTACT_EMAIL=cleverdigitals70@gmail.com
//      - Optional: RESEND_FROM for a verified domain (see lib/email.js)
//
//   3. Database auto-initializes on first request (creates tables)

import { saveSubmission, addSubscriber, logEmail } from '../lib/db.js';
import {
  sendResendEmail,
  contactNotificationTemplate,
  welcomeEmailTemplate,
  ownerEmail
} from '../lib/email.js';
import { rateLimit } from '../lib/rate-limit.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const rl = rateLimit(req, { limit: 10, windowMs: 60000 });
  if (!rl.allowed) {
    res.setHeader('Retry-After', String(rl.retryAfter));
    return res.status(429).json({ error: 'Too many requests — please wait a moment and try again.' });
  }

  const body = req.body || {};
  const name = (body.name || '').trim();
  const email = (body.email || '').trim();
  const phone = (body.phone || '').trim();
  const message = (body.message || '').trim();
  const subscribeOptIn = body.subscribe === true || body.subscribe === 'true';

  if (!name || !email || !message) {
    return res.status(400).json({
      error: 'Missing required fields',
      required: ['name', 'email', 'message']
    });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: 'Invalid email address' });
  }

  if (name.length > 200 || email.length > 200 || message.length > 5000) {
    return res.status(400).json({ error: 'Input too long' });
  }

  const submission = {
    name: name,
    email: email,
    phone: phone || 'Not provided',
    message: message,
    source: body.source || 'cleverstack.dev contact form',
    utm_source: (body.utm_source || '').trim(),
    utm_medium: (body.utm_medium || '').trim(),
    utm_campaign: (body.utm_campaign || '').trim()
  };

  let dbSaved = false;
  let submissionId = null;

  // LAYER 1: Save to Turso database (PRIMARY)
  if (process.env.TURSO_DATABASE_URL) {
    try {
      submissionId = await saveSubmission(submission);
      dbSaved = true;
      console.log('Submission saved to DB. ID:', submissionId);
    } catch (err) {
      console.error('Database save failed:', err.message);
    }
  } else {
    console.log('TURSO_DATABASE_URL not set — skipping database save');
  }

  // LAYER 2: Send email notification via Resend (BACKUP)
  let emailSent = false;
  if (process.env.RESEND_API_KEY) {
    try {
      const result = await sendResendEmail({
        to: ownerEmail(),
        subject: 'New Contact: ' + submission.name + ' — CleverStack',
        html: contactNotificationTemplate(submission),
        replyTo: submission.email
      });
      emailSent = result.ok;
      await logEmail({
        to_email: ownerEmail(),
        type: 'contact_notify',
        subject: 'New Contact: ' + submission.name,
        status: result.ok ? 'sent' : 'failed',
        error: result.ok ? '' : result.error
      });
      if (!result.ok) console.error('Resend error:', result.error);
    } catch (err) {
      console.error('Resend request failed:', err.message);
    }
  }

  // LAYER 3: Auto-responder — send confirmation to the submitter
  let autoResponded = false;
  if (process.env.RESEND_API_KEY && submission.email) {
    try {
      const autoRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + process.env.RESEND_API_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: process.env.RESEND_FROM || 'CleverStack <onboarding@resend.dev>',
          to: [submission.email],
          subject: 'We received your message — CleverStack',
          html: '<div style="font-family:sans-serif;max-width:520px;margin:0 auto;">' +
            '<h2 style="color:#4F46E5;">Thank you, ' + submission.name + '!</h2>' +
            '<p>We received your message and will respond within <strong>24 business hours</strong>.</p>' +
            '<p>Here is a copy of what you sent:</p>' +
            '<blockquote style="border-left:3px solid #4F46E5;padding:12px 16px;margin:16px 0;background:#f6f7fb;border-radius:6px;">' +
            '<p style="margin:0 0 4px;"><strong>Message:</strong></p>' +
            '<p style="margin:0;color:#5B6079;">' + submission.message.replace(/\n/g, '<br>') + '</p>' +
            '</blockquote>' +
            '<p style="color:#5B6079;font-size:14px;">In the meantime, you can book a free strategy call:</p>' +
            '<a href="https://calendly.com/samsonfalope326/30min" style="display:inline-block;background:#00C2A8;color:#fff;padding:12px 24px;border-radius:100px;text-decoration:none;font-weight:600;">Book a Free Call</a>' +
            '<p style="color:#aaa;font-size:12px;margin-top:24px;">CleverStack — Lagos, Nigeria</p>' +
            '</div>'
        })
      });
      if (autoRes.ok) {
        autoResponded = true;
        console.log('Auto-response sent to', submission.email);
      }
    } catch (err) {
      console.error('Auto-responder failed:', err.message);
    }
  }

  // LAYER 4: Newsletter opt-in — add subscriber + send welcome email
  let subscribed = false;
  if (subscribeOptIn && process.env.TURSO_DATABASE_URL && submission.email) {
    try {
      const result = await addSubscriber(submission.email, submission.name, 'contact form opt-in');
      if (result.added) {
        subscribed = true;
        if (process.env.RESEND_API_KEY) {
          try {
            const wRes = await sendResendEmail({
              to: submission.email,
              subject: 'Welcome to CleverStack!',
              html: welcomeEmailTemplate(submission.name, submission.email)
            });
            await logEmail({
              to_email: submission.email,
              type: 'welcome',
              subject: 'Welcome to CleverStack!',
              status: wRes.ok ? 'sent' : 'failed',
              error: wRes.ok ? '' : wRes.error
            });
          } catch (err) {
            console.error('Welcome email (opt-in) failed:', err.message);
          }
        }
      }
    } catch (err) {
      console.error('Newsletter opt-in failed:', err.message);
    }
  }

  // LAYER 5 (FALLBACK): Web3Forms if no Resend configured
  if (!emailSent && process.env.WEB3FORMS_ACCESS_KEY) {
    try {
      const w3Res = await fetch('https://api.web3forms.com/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          access_key: process.env.WEB3FORMS_ACCESS_KEY,
          name: submission.name,
          email: submission.email,
          phone: submission.phone,
          message: submission.message,
          subject: 'New Contact from ' + submission.name + ' — CleverStack',
          from_name: 'CleverStack Contact Form'
        })
      });
      const w3Result = await w3Res.json();
      if (w3Result.success) {
        emailSent = true;
        console.log('Email sent via Web3Forms');
      }
    } catch (err) {
      console.error('Web3Forms request failed:', err.message);
    }
  }

  if (dbSaved || emailSent) {
    return res.status(200).json({
      success: true,
      message: 'Thank you! We received your message and will respond within 24 hours.',
      _meta: {
        saved_to_db: dbSaved,
        email_sent: emailSent,
        submission_id: submissionId,
        subscribed: subscribed
      }
    });
  }

  // Last resort: log to console
  console.log('=== NEW CONTACT FORM SUBMISSION (no DB or email configured) ===');
  console.log(JSON.stringify(submission, null, 2));
  console.log('================================================================');

  return res.status(200).json({
    success: true,
    message: 'Thank you! We received your message and will respond within 24 hours.'
  });
}
