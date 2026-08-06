// lib/honeypot.js — Spam-bot honeypot helper
//
// The forms include a hidden text field (`company_website`) that real users
// never see or fill. Bots that auto-fill every field land in this field, and
// the API silently drops the submission while still returning a 200 "success"
// so the bot believes it worked.

export const HONEYPOT_FIELD = 'company_website';

export function isBotPayload(body) {
  if (!body || typeof body !== 'object') return false;
  const value = String(body[HONEYPOT_FIELD] || '');
  return value.length > 0;
}
