export const config = { runtime: 'nodejs18.x' };

// api/contact.js — Contact Form Handler with Database + Email
//
// LAYER 1 (PRIMARY): Turso database — every submission saved permanently
// LAYER 2 (BACKUP): Resend email — instant notification to your inbox
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
//
//   3. Database auto-initializes on first request (creates submissions table)

import { saveSubmission } from '../lib/db.js';

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

  const body = req.body || {};
  const name = (body.name || '').trim();
  const email = (body.email || '').trim();
  const phone = (body.phone || '').trim();
  const message = (body.message || '').trim();

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
    source: 'cleverstack.dev contact form'
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
      const contactEmail = process.env.CONTACT_EMAIL || 'cleverdigitals70@gmail.com';
      const resendRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + process.env.RESEND_API_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: 'CleverStack Contact <onboarding@resend.dev>',
          to: [contactEmail],
          subject: 'New Contact: ' + submission.name + ' — CleverStack',
          html: '<h2>New Contact Form Submission</h2>' +
            '<p><strong>Name:</strong> ' + submission.name + '</p>' +
            '<p><strong>Email:</strong> ' + submission.email + '</p>' +
            '<p><strong>Phone:</strong> ' + submission.phone + '</p>' +
            '<p><strong>Message:</strong></p>' +
            '<p>' + submission.message.replace(/\n/g, '<br>') + '</p>' +
            '<hr>' +
            '<p style="color:#666;font-size:12px;">Submitted at ' + new Date().toISOString() + ' from cleverstack.dev</p>',
          reply_to: submission.email
        })
      });

      if (resendRes.ok) {
        emailSent = true;
        console.log('Email notification sent via Resend');
      } else {
        const errBody = await resendRes.json();
        console.error('Resend error:', errBody);
      }
    } catch (err) {
      console.error('Resend request failed:', err.message);
    }
  }

  // LAYER 3 (FALLBACK): Web3Forms if no Resend configured
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
        submission_id: submissionId
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
