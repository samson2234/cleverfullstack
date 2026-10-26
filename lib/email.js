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

// Public site URL — set SITE_URL in Vercel when the new domain is live (no trailing slash).
export function siteUrl() {
  return (process.env.SITE_URL || 'https://cleverstack.dev').replace(/\/$/, '');
}
function siteHost() {
  return siteUrl().replace(/^https?:\/\//, '');
}

function ownerEmail() {
  return process.env.CONTACT_EMAIL || 'henryygeorge25@gmail.com';
}

export async function sendResendEmail({ to, subject, html, replyTo }) {
  if (!process.env.RESEND_API_KEY) {
    return { ok: false, error: 'RESEND_API_KEY not set' };
  }
  // Hard timeout: a slow email provider must never pin a serverless function (and its DB
  // connection) for the full platform limit while traffic is spiking.
  let res;
  try {
    res = await fetch(RESEND_API, {
      method: 'POST',
      signal: AbortSignal.timeout(8000),
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
  } catch (err) {
    return { ok: false, error: err && err.name === 'TimeoutError' ? 'Email provider timed out' : 'Email request failed: ' + (err && err.message) };
  }
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
    'CleverStack — Remote, worldwide · <a href="' + siteUrl() + '" style="color:#4F46E5;">' + siteHost() + '</a></p>' +
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
    '<p style="font-size:14px;line-height:1.7;">We build fast, high-converting websites — take a look at our <a href="' + siteUrl() + '/portfolio.html" style="color:#4F46E5;">recent work</a> or <a href="' + siteUrl() + '/contact.html" style="color:#4F46E5;">start a project</a>.</p>' +
    '<p style="font-size:13px;color:#8a90a6;">You can unsubscribe anytime: <a href="' + siteUrl() + '/api/unsubscribe?email=' + encodeURIComponent(email) + '" style="color:#4F46E5;">unsubscribe here</a>.</p>'
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
    (sub.lead ? leadScoreBlock(sub.lead) : '') +
    '<hr style="border:none;border-top:1px solid #eee;">' +
    '<p style="font-size:14px;color:#3a3f58;white-space:pre-wrap;">' + escapeHtml(sub.message) + '</p>' +
    '<hr style="border:none;border-top:1px solid #eee;">' +
    '<p style="font-size:13px;color:#8a90a6;">Submitted at ' + new Date().toISOString() + ' · Manage in the <a href="' + siteUrl() + '/admin.html" style="color:#4F46E5;">admin CRM</a>.</p>'
  );
}

function leadScoreBlock(l) {
  const c = l.tier === 'hot' ? ['#fef2f2', '#b91c1c', '🔥 Hot'] : l.tier === 'warm' ? ['#fffbeb', '#b45309', 'Warm'] : ['#f1f5f9', '#475569', 'Cold'];
  return '<div style="margin:14px 0;padding:12px 14px;border-radius:10px;background:' + c[0] + ';">' +
    '<p style="margin:0 0 6px;font-weight:700;color:' + c[1] + ';">Lead score ' + l.score + '/100 · ' + c[2] + '</p>' +
    '<p style="margin:0;font-size:13px;color:#3a3f58;">' + l.reasons.slice(0, 6).map((r) => escapeHtml(r.why) + ' (+' + r.pts + ')').join(' · ') + '</p></div>';
}

export function subscriberNotificationTemplate(email, name, source) {
  return shell(
    '<h2 style="color:#4F46E5;margin-top:0;">New Newsletter Subscriber</h2>' +
    '<p><strong>Email:</strong> ' + escapeHtml(email) + '</p>' +
    '<p><strong>Name:</strong> ' + escapeHtml(name || '—') + '</p>' +
    '<p><strong>Source:</strong> ' + escapeHtml(source || '—') + '</p>' +
    '<p style="font-size:13px;color:#8a90a6;">Subscribed at ' + new Date().toISOString() + ' · Manage in the <a href="' + siteUrl() + '/admin.html" style="color:#4F46E5;">admin CRM</a>.</p>'
  );
}

// Client: a new message from the team in their project conversation (with the private link to reply).
export function clientMessageTemplate(name, staffName, body, link) {
  const first = escapeHtml((name || '').split(' ')[0] || 'there');
  return shell(
    '<p style="font-size:15px;line-height:1.7;">Hi ' + first + ',</p>' +
    '<p style="font-size:15px;line-height:1.7;">' + escapeHtml(staffName || 'The CleverStack team') + ' sent you a message about your project:</p>' +
    '<div style="font-size:15px;line-height:1.7;white-space:pre-wrap;border-left:3px solid #4F46E5;padding:10px 14px;background:#f6f7fb;border-radius:0 8px 8px 0;">' + escapeHtml(body) + '</div>' +
    '<p style="margin:24px 0;"><a href="' + link + '" style="background:#4F46E5;color:#fff;padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:600;">Reply on CleverStack</a></p>' +
    '<p style="font-size:12px;color:#8a90a6;">This private link opens your conversation with us. Please do not forward it.</p>'
  );
}

// Team member: added to the CRM (or password reset) — role, temporary password and how to sign in.
const ROLE_INFO = {
  admin: { label: 'Admin', can: ['See and work every lead, contact, subscriber and conversation', 'Reply to clients, send campaigns and broadcasts', 'Export data and delete records'], cannot: 'manage the team (only the owner can)' },
  sales: { label: 'Sales', can: ['See and work leads, contacts and reviews', 'Reply to clients in the Inbox and send files', 'Update lead stages, notes and follow-ups'], cannot: 'delete records, export data or send mass campaigns' },
  viewer: { label: 'Viewer', can: ['See leads, contacts, conversations and analytics', 'Follow the pipeline and reports'], cannot: 'change, send or delete anything (read-only)' }
};
export function teamInviteTemplate({ name, email, role, password, reset }) {
  const first = escapeHtml((name || '').split(' ')[0] || 'there');
  const info = ROLE_INFO[role] || ROLE_INFO.viewer;
  const url = siteUrl() + '/admin.html';
  const step = (n, html) => '<tr><td style="vertical-align:top;padding:6px 10px 6px 0;"><span style="display:inline-block;width:24px;height:24px;line-height:24px;text-align:center;border-radius:50%;background:#4F46E5;color:#fff;font-size:12px;font-weight:700;">' + n + '</span></td><td style="padding:6px 0;font-size:14px;line-height:1.6;">' + html + '</td></tr>';
  return shell(
    '<div style="background:#4F46E5;color:#fff;border-radius:12px;padding:24px;margin-bottom:20px;">' +
    '<h1 style="margin:0;font-size:21px;">' + (reset ? 'Your CleverStack password was reset' : 'Welcome to the CleverStack team 👋') + '</h1>' +
    '<p style="margin:8px 0 0;opacity:0.9;font-size:14px;">' + (reset ? 'Here is a new temporary password for the CRM.' : 'You now have access to the CleverStack CRM as <b>' + info.label + '</b>.') + '</p></div>' +
    '<p style="font-size:15px;line-height:1.7;">Hi ' + first + ',</p>' +
    '<p style="font-size:15px;line-height:1.7;">' + (reset ? 'Your password was reset by the account owner, and any open sessions were signed out.' : 'You have been added to the CleverStack CRM with the <b>' + info.label + '</b> role.') + '</p>' +
    '<div style="background:#f6f7fb;border:1px solid #e4e6f0;border-radius:10px;padding:14px 16px;margin:18px 0;font-size:14px;line-height:1.9;">' +
    '<div><span style="color:#8a90a6;">Sign-in page:</span> <a href="' + url + '" style="color:#4F46E5;">' + siteHost() + '/admin.html</a></div>' +
    '<div><span style="color:#8a90a6;">Email:</span> <b>' + escapeHtml(email) + '</b></div>' +
    '<div><span style="color:#8a90a6;">Temporary password:</span> <code style="font-family:Consolas,Menlo,monospace;font-size:15px;background:#fff;border:1px solid #e4e6f0;border-radius:6px;padding:2px 8px;">' + escapeHtml(password) + '</code></div>' +
    '<div><span style="color:#8a90a6;">Role:</span> <b>' + info.label + '</b></div></div>' +
    '<h3 style="font-size:16px;margin:22px 0 6px;">How to sign in</h3><table style="border-collapse:collapse;">' +
    step(1, 'Open <a href="' + url + '" style="color:#4F46E5;">' + siteHost() + '/admin.html</a> (bookmark it).') +
    step(2, 'Enter your email <b>' + escapeHtml(email) + '</b> and the temporary password above, then click <b>Sign In</b>. Tap the eye icon to check what you typed.') +
    step(3, 'You will see a yellow notice: <i>"You are using a temporary password"</i>. Click <b>Choose your own</b>, or open <b>My account</b> in the sidebar.') +
    step(4, 'Enter the temporary password as the current one, then your new password (at least 10 characters, with letters and numbers).') +
    '</table>' +
    '<p style="margin:22px 0;"><a href="' + url + '" style="background:#4F46E5;color:#fff;padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:600;">Sign in to the CRM</a></p>' +
    (reset ? '' : '<h3 style="font-size:16px;margin:22px 0 6px;">What you can do as ' + info.label + '</h3>' +
    '<ul style="font-size:14px;line-height:1.8;color:#3a3f58;padding-left:20px;margin:0;">' + info.can.map((c) => '<li>' + c + '</li>').join('') + '</ul>' +
    '<p style="font-size:14px;line-height:1.7;color:#3a3f58;">You cannot ' + info.cannot + '.</p>') +
    '<p style="font-size:12px;color:#8a90a6;line-height:1.6;">For security: change the temporary password on your first sign-in, never share it, and delete this email afterwards. Sessions sign out automatically after 12 hours. If you did not expect this email, reply and let us know.</p>'
  );
}

// Owner: the client replied in the portal.
export function ownerMessageTemplate(conv, body) {
  return shell(
    '<h2 style="color:#4F46E5;margin-top:0;">New message from ' + escapeHtml(conv.client_name || conv.client_email) + '</h2>' +
    '<p style="font-size:13px;color:#8a90a6;margin:0 0 12px;">' + escapeHtml(conv.client_email) + ' · ' + escapeHtml(conv.subject) + '</p>' +
    '<div style="font-size:15px;line-height:1.7;white-space:pre-wrap;border-left:3px solid #2AA79F;padding:10px 14px;background:#f6f7fb;border-radius:0 8px 8px 0;">' + escapeHtml(body) + '</div>' +
    '<p style="margin:22px 0 0;"><a href="' + siteUrl() + '/admin.html#inbox-' + conv.id + '" style="background:#4F46E5;color:#fff;padding:11px 20px;border-radius:8px;text-decoration:none;font-weight:600;">Reply in the CRM Inbox</a></p>'
  );
}

// Owner alert for a new review. Verified reviews are already live; open ones wait for approval in the admin.
export function reviewNotificationTemplate(r, published) {
  const stars = '★'.repeat(r.rating) + '☆'.repeat(5 - r.rating);
  return shell(
    '<h2 style="color:#4F46E5;margin-top:0;">New ' + r.rating + '-star review</h2>' +
    '<p style="margin:0 0 14px;font-size:14px;"><span style="display:inline-block;padding:4px 10px;border-radius:100px;background:' + (published ? '#d1fae5;color:#065f46' : '#fef3c7;color:#92400e') + ';font-weight:600;">' +
    (published ? 'Verified client · already published' : 'Waiting for your approval') + '</span></p>' +
    '<p style="font-size:20px;color:#F5A524;letter-spacing:2px;margin:0 0 8px;">' + stars + '</p>' +
    '<p><strong>Name:</strong> ' + escapeHtml(r.author_name) + '</p>' +
    (r.author_role ? '<p><strong>Role &amp; company:</strong> ' + escapeHtml(r.author_role) + '</p>' : '') +
    (r.country ? '<p><strong>Country:</strong> ' + escapeHtml(r.country) + '</p>' : '') +
    (r.title ? '<p><strong>Headline:</strong> ' + escapeHtml(r.title) + '</p>' : '') +
    '<hr style="border:none;border-top:1px solid #eee;">' +
    '<p style="font-size:14px;color:#3a3f58;white-space:pre-wrap;">' + escapeHtml(r.body) + '</p>' +
    '<hr style="border:none;border-top:1px solid #eee;">' +
    '<p style="font-size:13px;color:#8a90a6;">' + (published ? 'It is live on your Reviews page.' : 'Approve or reject it in the') +
    ' <a href="' + siteUrl() + '/admin.html" style="color:#4F46E5;">admin' + (published ? '' : ' Reviews tab') + '</a>' + (published ? ' if you want to reply to it.' : '.') + '</p>'
  );
}

export function replyEmailTemplate(lead, body) {
  return shell(
    '<p style="font-size:15px;line-height:1.7;">Hi ' + escapeHtml((lead.name || '').split(' ')[0] || 'there') + ',</p>' +
    '<div style="font-size:15px;line-height:1.7;white-space:pre-wrap;">' + escapeHtml(body) + '</div>' +
    '<p style="font-size:15px;line-height:1.7;">— The CleverStack team</p>' +
    '<p style="font-size:12px;color:#8a90a6;">This is a reply to your message via ' + siteHost() + '.</p>'
  );
}

export function reviewInviteTemplate(name, link, project) {
  return shell(
    '<p style="font-size:15px;line-height:1.7;">Hi ' + escapeHtml((name || '').split(' ')[0] || 'there') + ',</p>' +
    '<p style="font-size:15px;line-height:1.7;">Thank you for working with us' + (project ? ' on <strong>' + escapeHtml(project) + '</strong>' : '') + '. If you have two minutes, we would really value an honest review. It helps other business owners decide, and it helps us improve.</p>' +
    '<p style="margin:24px 0;"><a href="' + link + '" style="background:#4F46E5;color:#fff;padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:600;">Write your review</a></p>' +
    '<p style="font-size:13px;color:#8a90a6;">This private link works once and expires in 30 days. We publish every genuine review, good or critical.</p>'
  );
}

// Personalised one-to-one style message to a segment (win-back, check-in). Always carries an unsubscribe link.
export function campaignEmailTemplate(name, body, email) {
  const first = escapeHtml((name || '').split(' ')[0] || 'there');
  return shell(
    '<p style="font-size:15px;line-height:1.7;">Hi ' + first + ',</p>' +
    '<div style="font-size:15px;line-height:1.7;white-space:pre-wrap;">' + escapeHtml(body) + '</div>' +
    '<p style="font-size:15px;line-height:1.7;">— The CleverStack team</p>' +
    '<p style="font-size:12px;color:#8a90a6;margin-top:24px;">You are receiving this because you worked with or contacted CleverStack. <a href="' + siteUrl() + '/api/unsubscribe?email=' + encodeURIComponent(email) + '" style="color:#4F46E5;">Unsubscribe</a>.</p>'
  );
}

export function broadcastEmailTemplate(body) {
  return shell(
    '<div style="font-size:15px;line-height:1.7;white-space:pre-wrap;">' + escapeHtml(body) + '</div>' +
    '<p style="font-size:13px;color:#8a90a6;margin-top:24px;">You\'re receiving this because you subscribed to CleverStack updates. <a href="' + siteUrl() + '/api/unsubscribe?email=__EMAIL__" style="color:#4F46E5;">Unsubscribe</a>.</p>'
  );
}

function escapeHtml(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

export { ownerEmail, fromAddress, escapeHtml as esc, shell as emailShell };
