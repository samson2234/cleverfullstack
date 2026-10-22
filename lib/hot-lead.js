// lib/hot-lead.js — instant WhatsApp ping for hot leads (optional).
//
// Uses CallMeBot's free WhatsApp API, which can only message the phone that registered with it (yours):
//   1. Save +34 694 29 84 96 in your phone, send it the WhatsApp message "I allow callmebot to send me messages".
//   2. It replies with an API key. In Vercel add: CALLMEBOT_PHONE (your number with country code, digits only)
//      and CALLMEBOT_APIKEY. Without them this does nothing; the hot-lead email still goes out.
// The message contains only the lead's name, score, budget/source and a link to the CRM, no message body.

import { siteUrl } from './email.js';

export async function notifyHotLead(sub, lead) {
  const phone = String(process.env.CALLMEBOT_PHONE || '').replace(/\D/g, '');
  const key = process.env.CALLMEBOT_APIKEY;
  if (!phone || !key) return { sent: false, reason: 'not configured' };
  const budget = lead.budget ? ` · budget ${lead.budget.amount.toLocaleString('en-US')} ${lead.budget.currency}` : '';
  const text = `🔥 Hot lead (${lead.score}/100): ${String(sub.name).slice(0, 60)}${budget} · via ${String(sub.source || 'contact form').slice(0, 40)}${sub.country ? ' · ' + String(sub.country).slice(0, 30) : ''}\nOpen the CRM: ${siteUrl()}/admin.html`;
  const url = 'https://api.callmebot.com/whatsapp.php?phone=' + phone + '&text=' + encodeURIComponent(text) + '&apikey=' + encodeURIComponent(key);
  const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
  return { sent: res.ok };
}
