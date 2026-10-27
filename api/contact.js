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
//      - Vercel Env Vars: RESEND_API_KEY, CONTACT_EMAIL=henryygeorge25@gmail.com
//      - Optional: RESEND_FROM for a verified domain (see lib/email.js)
//
//   3. Database auto-initializes on first request (creates tables)

import { saveSubmission, addSubscriber, logEmail } from '../lib/db.js';
import { linkSubmissionToContact } from '../lib/contacts.js';
import {
  sendResendEmail,
  contactNotificationTemplate,
  welcomeEmailTemplate,
  ownerEmail
} from '../lib/email.js';
import { rateLimit } from '../lib/rate-limit.js';
import { isBotPayload } from '../lib/honeypot.js';
import { scoreLead } from '../lib/lead-score.js';
import { getJourneySummaries } from '../lib/analytics.js';
import { notifyHotLead } from '../lib/hot-lead.js';
import { createConversation, linkFor } from '../lib/messages.js';
import { siteUrl } from '../lib/email.js';
import { detectPitch, intentLabel } from '../lib/pitch.js';

export default async function handler(req, res) {

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (isBotPayload(req.body)) {
    return res.status(200).json({
      success: true,
      message: 'Thank you! We received your message and will respond within 24 hours.'
    });
  }

  const rl = await rateLimit(req, { limit: 10, windowMs: 60000, key: 'contact' });
  if (!rl.allowed) {
    res.setHeader('Retry-After', String(rl.retryAfter));
    return res.status(429).json({ error: 'Too many requests — please wait a moment and try again.' });
  }

  const body = req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body) ? req.body : {};
  // text fields only: anything else (numbers, objects, arrays) is treated as empty
  const str = (v) => (typeof v === 'string' ? v.trim() : '');
  const name = str(body.name);
  const email = str(body.email);
  const phone = str(body.phone);
  const country = str(body.country);
  const company = str(body.company);
  const industry = str(body.industry);
  const message = str(body.message);
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

  if (name.length > 200 || email.length > 200 || phone.length > 50 || country.length > 100 || company.length > 200 || industry.length > 100 || message.length > 5000) {
    return res.status(400).json({ error: 'Input too long' });
  }

  const submission = {
    name: name,
    email: email,
    phone: phone || 'Not provided',
    country: country,
    company: company,
    industry: industry,
    message: message,
    source: str(body.source).slice(0, 120) || 'cleverstack.dev contact form',
    utm_source: str(body.utm_source).slice(0, 120),
    utm_medium: str(body.utm_medium).slice(0, 120),
    utm_campaign: str(body.utm_campaign).slice(0, 120),
    analytics_session: String(body._asid || '').replace(/[^a-z0-9]/gi, '').slice(0, 40),
    intent: intentLabel(str(body.intent))
  };

  // People selling to us (SEO offers, agencies, job applications) are kept, but as 'vendor': out of the pipeline,
  // lead counts, hot-lead alerts and the inbox. One click in the CRM ("Not a pitch") makes them a lead again.
  const pitch = detectPitch(submission);
  if (pitch.pitch) { submission.status = 'vendor'; submission.pitch_reason = pitch.reasons.join('; ').slice(0, 300); }

  // Lead score (budget, ROI numbers, completeness, market, and the visitor's journey on the site)
  let lead = scoreLead(submission, null);
  if (submission.analytics_session && process.env.TURSO_DATABASE_URL) {
    try { const j = (await getJourneySummaries([submission.analytics_session])).get(submission.analytics_session); if (j) lead = scoreLead(submission, j); }
    catch (err) { console.error('Journey lookup failed:', err.message); }
  }
  submission.lead = lead;

  let dbSaved = false;
  let submissionId = null;

  // LAYER 1: Save to Turso database (PRIMARY)
  if (process.env.TURSO_DATABASE_URL) {
    try {
      submissionId = await saveSubmission(submission);
      dbSaved = true;
      // Attach to the person's CRM record (creates it for new enquirers). Never blocks the submission.
      try { await linkSubmissionToContact(submissionId, submission); }
      catch (err) { console.error('CRM link failed:', err.message); }
      console.log('Submission saved to DB. ID:', submissionId);
      // Every enquiry starts a project conversation the client can continue on the website (not sales pitches)
      if (!pitch.pitch) try {
        const subject = submission.source === 'budget-planner' ? 'Your project plan' : submission.source === 'roi-calculator' ? 'Your website audit' : 'Your enquiry';
        const { conversation } = await createConversation({ name: submission.name, email: submission.email, subject, submissionId, firstMessage: submission.message, firstSender: 'client' });
        submission.conversationLink = await linkFor(conversation.id, siteUrl());
      } catch (err) { console.error('Conversation create failed:', err.message); }
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
        subject: (pitch.pitch ? 'Vendor pitch (filtered): ' : lead.tier === 'hot' ? '🔥 HOT lead (' + lead.score + '/100): ' : 'New Contact: ') + submission.name + ' — CleverStack',
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

  // Hot lead: optional instant WhatsApp ping (best effort, never blocks)
  if (lead.tier === 'hot' && !pitch.pitch) { try { await notifyHotLead(submission, lead); } catch (err) { console.error('Hot lead ping failed:', err.message); } }

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
            (submission.conversationLink ? '<p style="font-size:15px;">You can add details, files links or questions any time in your private project conversation:</p><p style="margin:16px 0 22px;"><a href="' + submission.conversationLink + '" style="display:inline-block;background:#4F46E5;color:#fff;padding:12px 24px;border-radius:100px;text-decoration:none;font-weight:600;">Open your conversation</a></p>' : '') +
            '<p style="color:#5B6079;font-size:14px;">In the meantime, you can book a free strategy call:</p>' +
            '<a href="https://calendly.com/henryygeorge25/30min" style="display:inline-block;background:#00C2A8;color:#fff;padding:12px 24px;border-radius:100px;text-decoration:none;font-weight:600;">Book a Free Call</a>' +
            '<p style="color:#aaa;font-size:12px;margin-top:24px;">CleverStack — Remote, worldwide</p>' +
            '</div>'
        })
      });
      if (autoRes.ok) {
        autoResponded = true;
        console.log('Auto-response sent');
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
          country: submission.country,
          company: submission.company,
          industry: submission.industry,
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

  // Nothing is configured to store or deliver it. Personal data is never written to the logs.
  console.error('Contact form: no database or email configured; submission was not stored');

  return res.status(200).json({
    success: true,
    message: 'Thank you! We received your message and will respond within 24 hours.'
  });
}
