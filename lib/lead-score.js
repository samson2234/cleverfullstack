// lib/lead-score.js — explainable lead scoring (0–100, Hot / Warm / Cold).
// Every point comes with a plain-English reason so the owner can see why a lead is ranked where it is.
// Inputs: the CRM submission row, plus (optionally) a summary of that visitor's website journey.

const FX_TO_USD = { USD: 1, GBP: 1.27, EUR: 1.08, CAD: 0.73, AUD: 0.66 }; // indicative, only used to rank leads
const TIER1 = new Set(['US', 'GB', 'CA', 'AU', 'NZ', 'IE', 'DE', 'NL', 'CH', 'NO', 'SE', 'DK', 'FI', 'AT', 'BE', 'LU', 'FR', 'SG', 'AE', 'QA', 'IS']);
const TIER2 = new Set(['ES', 'IT', 'PT', 'PL', 'CZ', 'EE', 'SI', 'MT', 'CY', 'IL', 'JP', 'KR', 'HK', 'SA', 'KW', 'BH']);
const COUNTRY_NAMES = { 'united states': 'US', usa: 'US', 'united kingdom': 'GB', uk: 'GB', 'great britain': 'GB', england: 'GB', canada: 'CA', australia: 'AU', 'new zealand': 'NZ', ireland: 'IE', germany: 'DE', netherlands: 'NL', switzerland: 'CH', norway: 'NO', sweden: 'SE', denmark: 'DK', finland: 'FI', austria: 'AT', belgium: 'BE', luxembourg: 'LU', france: 'FR', singapore: 'SG', 'united arab emirates': 'AE', qatar: 'QA', iceland: 'IS', spain: 'ES', italy: 'IT', portugal: 'PT', poland: 'PL', 'czech republic': 'CZ', estonia: 'EE', slovenia: 'SI', malta: 'MT', cyprus: 'CY', israel: 'IL', japan: 'JP', 'south korea': 'KR', 'hong kong': 'HK', 'saudi arabia': 'SA', kuwait: 'KW', bahrain: 'BH' };
const FREE_MAIL = /@(gmail|googlemail|yahoo|ymail|hotmail|outlook|live|msn|icloud|me|mac|aol|proton(mail)?|gmx|mail|yandex|zoho)\./i;
const URGENT = /\b(asap|urgent|urgently|this week|next week|this month|deadline|launch(ing)?|ready to (start|go)|start (now|immediately)|as soon as possible)\b/i;
export const HOT = 60, WARM = 35;

export function countryCode(c) {
  const s = String(c || '').trim();
  if (/^[A-Za-z]{2}$/.test(s)) return s.toUpperCase();
  return COUNTRY_NAMES[s.toLowerCase()] || '';
}

// "Budget: 1,800 GBP" (budget planner) -> { amount, currency, usd, flexible }
export function parseBudget(message) {
  const m = String(message || '').match(/Budget:\s*([\d.,]+)\s*([A-Z]{3})/);
  if (!m) return null;
  const amount = Number(m[1].replace(/,/g, ''));
  const currency = m[2];
  if (!(amount > 0)) return null;
  const usd = Math.round(amount * (FX_TO_USD[currency] || 1));
  return { amount, currency, usd, flexible: /Budget type:\s*Starting budget/i.test(message) };
}

// ROI calculator summary "... extra profit $1,134/month ..." -> number (in the visitor's currency)
export function parseRoiProfit(message) {
  const m = String(message || '').match(/extra profit\s*[^\d-]{0,4}([\d.,]+)\s*(k)?/i);
  if (!m) return null;
  let v = Number(m[1].replace(/,/g, ''));
  if (m[2]) v *= 1000;
  return v > 0 ? v : null;
}

// journey: { pages, engagedSec, explored, intentClicks, paid } (from analytics, optional)
export function scoreLead(s, journey) {
  const reasons = [];
  let score = 0;
  const add = (pts, why) => { if (pts) { score += pts; reasons.push({ pts, why }); } };
  const msg = String(s.message || '');
  const source = String(s.source || '').toLowerCase();

  const budget = parseBudget(msg);
  if (budget) {
    const u = budget.usd;
    add(u >= 3000 ? 35 : u >= 1500 ? 28 : u >= 800 ? 20 : u >= 500 ? 12 : 4,
      `Budget ${budget.amount.toLocaleString('en-US')} ${budget.currency}${budget.currency !== 'USD' ? ' (≈ $' + u.toLocaleString('en-US') + ')' : ''}`);
    if (budget.flexible) add(3, 'Budget can grow');
  }
  const profit = source.includes('roi') ? parseRoiProfit(msg) : null;
  if (profit) add(profit >= 2000 ? 22 : profit >= 500 ? 15 : 8, `ROI calculator shows ${Math.round(profit).toLocaleString('en-US')}/month extra profit`);

  add(source.includes('budget') ? 10 : source.includes('roi') ? 8 : 5,
    source.includes('budget') ? 'Used the budget planner' : source.includes('roi') ? 'Used the ROI calculator' : 'Sent the contact form');

  if (s.phone && s.phone !== 'Not provided') add(6, 'Left a phone number');
  if (s.company) add(5, 'Named their company');
  if (s.industry) add(2, 'Told us their industry');
  if (s.email && !FREE_MAIL.test(s.email)) add(6, 'Business email address');

  const cc = countryCode(s.country);
  if (TIER1.has(cc)) add(12, `Based in a priority market (${cc})`);
  else if (TIER2.has(cc)) add(6, `Based in a strong market (${cc})`);

  const len = msg.replace(/\s+/g, ' ').trim().length;
  if (!budget && !profit) add(len >= 200 ? 8 : len >= 80 ? 4 : 0, len >= 200 ? 'Detailed message' : 'Clear message');
  if (URGENT.test(msg)) add(6, 'Mentions timing or urgency');

  if (journey) {
    if (journey.pages >= 4) add(8, `Viewed ${journey.pages} pages`);
    else if (journey.pages >= 2) add(4, `Viewed ${journey.pages} pages`);
    if (journey.explored) add(4, 'Looked at services, work or reviews');
    if (journey.engagedSec >= 120) add(5, `Spent ${Math.round(journey.engagedSec / 60)} min reading`);
    if (journey.intentClicks) add(5, 'Clicked booking, WhatsApp, call or email');
    if (journey.paid) add(3, 'Came from a paid campaign');
  }
  if (s.utm_medium && /cpc|ppc|paid/i.test(s.utm_medium) && !(journey && journey.paid)) add(3, 'Came from a paid campaign');

  score = Math.max(0, Math.min(100, score));
  return { score, tier: score >= HOT ? 'hot' : score >= WARM ? 'warm' : 'cold', reasons: reasons.sort((a, b) => b.pts - a.pts), budget };
}
