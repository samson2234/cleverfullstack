// lib/email.js — Shared email layer via Resend
//
// SETUP:
//   1. Vercel Env Vars:
//        RESEND_API_KEY  = from https://resend.com/api-keys
//        RESEND_FROM     = e.g. "CleverStack <hello@cleverstack.dev>" (verified domain)
//        CONTACT_EMAIL   = your inbox for notifications (defaults to henryygeorge25@gmail.com)
//
//   2. Verify a sending domain in Resend: https://resend.com/domains
//      (required before welcome emails can reach arbitrary subscribers)

const RESEND_API = 'https://api.resend.com/emails';

function fromAddress() {
  return process.env.RESEND_FROM || 'CleverStack <onboarding@resend.dev>';
}

function ownerEmail() {
  return process.env.CONTACT_EMAIL || 'henryygeorge25@gmail.com';
}

export async function sendResendEmail({ to, subject, html, replyTo }) {
  if (!process.env.RESEND_API_KEY) {
    return { ok: false, error: 'RESEND_API_KEY not set' };
  }
  const res = await fetch(RESEND_API, {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + process.env.RESEND_API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: fromAddress(),
      to: Array.isArray(to) ? to : [to],
      subject: subject,
      html: html,
      reply_to: replyTo || undefined
    })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { ok: false, error: (data.message || data.name || 'Resend error') + (data.statusCode ? ' (' + data.statusCode + ')' : '') };
  }
  return { ok: true, id: data.id };
}

const brandStyle = 'font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;';

function shell(innerHtml) {
  return '<div style="' + brandStyle + 'max-width:560px;margin:0 auto;color:#1a1d2e;">' +
    innerHtml +
    '<p style="color:#8a90a6;font-size:12px;margin-top:28px;border-top:1px solid #eee;padding-top:16px;">' +
    'CleverStack — University of Ibadan (Premier University), Oyo State, Nigeria · <a href="https://cleverstack.dev" style="color:#4F46E5;">cleverstack.dev</a></p>' +
    '</div>';
}

export function welcomeEmailTemplate(name, email) {
  const firstName = (name || '').split(' ')[0] || 'there';
  return shell(
    '<div style="background:#4F46E5;color:#fff;border-radius:12px;padding:28px 24px;margin-bottom:20px;">' +
    '<h1 style="margin:0;font-size:22px;">Welcome to CleverStack! 🎉</h1>' +
    '<p style="margin:8px 0 0;opacity:0.9;font-size:14px;">You\'re on the list, ' + firstName + '.</p>' +
    '</div>' +
    '<p style="font-size:15px;line-height:1.7;">Thanks for subscribing to the CleverStack newsletter. You\'ll get:</p>' +
    '<ul style="font-size:14px;line-height:1.9;color:#3a3f58;">' +
    '<li>Practical web development & conversion tips</li>' +
    '<li>Early access to our best case studies and guides</li>' +
    '<li>Occasional exclusive offers from the studio</li>' +
    '</ul>' +
    '<p style="font-size:14px;line-height:1.7;">We build fast, high-converting websites — take a look at our <a href="https://cleverstack.dev/portfolio.html" style="color:#4F46E5;">recent work</a> or <a href="https://cleverstack.dev/contact.html" style="color:#4F46E5;">start a project</a>.</p>' +
    '<p style="font-size:13px;color:#8a90a6;">You can unsubscribe anytime: <a href="https://cleverstack.dev/api/unsubscribe?email=' + encodeURIComponent(email) + '" style="color:#4F46E5;">unsubscribe here</a>.</p>'
  );
}

export function contactNotificationTemplate(sub) {
  const statusBadge = sub.status ? '<p><strong>Status:</strong> ' + sub.status + '</p>' : '';
  return shell(
    '<h2 style="color:#4F46E5;margin-top:0;">New Contact Submission</h2>' +
    '<p><strong>Name:</strong> ' + escapeHtml(sub.name) + '</p>' +
    '<p><strong>Email:</strong> ' + escapeHtml(sub.email) + '</p>' +
    '<p><strong>Phone:</strong> ' + escapeHtml(sub.phone) + '</p>' +
    (sub.company ? '<p><strong>Brand / Company:</strong> ' + escapeHtml(sub.company) + '</p>' : '') +
    (sub.country ? '<p><strong>Country:</strong> ' + escapeHtml(sub.country) + '</p>' : '') +
    (sub.industry ? '<p><strong>Industry / Niche:</strong> ' + escapeHtml(sub.industry) + '</p>' : '') +
    '<p><strong>Source:</strong> ' + escapeHtml(sub.source) + '</p>' +
    (sub.utm_source || sub.utm_campaign ? '<p><strong>UTM:</strong> ' + escapeHtml(sub.utm_source || '') + ' / ' + escapeHtml(sub.utm_medium || '') + ' / ' + escapeHtml(sub.utm_campaign || '') + '</p>' : '') +
    statusBadge +
    '<hr style="border:none;border-top:1px solid #eee;">' +
    '<p style="font-size:14px;color:#3a3f58;white-space:pre-wrap;">' + escapeHtml(sub.message) + '</p>' +
    '<hr style="border:none;border-top:1px solid #eee;">' +
    '<p style="font-size:13px;color:#8a90a6;">Submitted at ' + new Date().toISOString() + ' · Manage in the <a href="https://cleverstack.dev/admin.html" style="color:#4F46E5;">admin CRM</a>.</p>'
  );
}

export function subscriberNotificationTemplate(email, name, source) {
  return shell(
    '<h2 style="color:#4F46E5;margin-top:0;">New Newsletter Subscriber</h2>' +
    '<p><strong>Email:</strong> ' + escapeHtml(email) + '</p>' +
    '<p><strong>Name:</strong> ' + escapeHtml(name || '—') + '</p>' +
    '<p><strong>Source:</strong> ' + escapeHtml(source || '—') + '</p>' +
    '<p style="font-size:13px;color:#8a90a6;">Subscribed at ' + new Date().toISOString() + ' · Manage in the <a href="https://cleverstack.dev/admin.html" style="color:#4F46E5;">admin CRM</a>.</p>'
  );
}

export function replyEmailTemplate(lead, body) {
  return shell(
    '<p style="font-size:15px;line-height:1.7;">Hi ' + escapeHtml((lead.name || '').split(' ')[0] || 'there') + ',</p>' +
    '<div style="font-size:15px;line-height:1.7;white-space:pre-wrap;">' + escapeHtml(body) + '</div>' +
    '<p style="font-size:15px;line-height:1.7;">— The CleverStack team</p>' +
    '<p style="font-size:12px;color:#8a90a6;">This is a reply to your message via cleverstack.dev.</p>'
  );
}

export function broadcastEmailTemplate(body) {
  return shell(
    '<div style="font-size:15px;line-height:1.7;white-space:pre-wrap;">' + escapeHtml(body) + '</div>' +
    '<p style="font-size:13px;color:#8a90a6;margin-top:24px;">You\'re receiving this because you subscribed to CleverStack updates. <a href="https://cleverstack.dev/api/unsubscribe?email=__EMAIL__" style="color:#4F46E5;">Unsubscribe</a>.</p>'
  );
}

function escapeHtml(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

export { ownerEmail, fromAddress };
