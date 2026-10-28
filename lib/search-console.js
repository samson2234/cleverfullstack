// lib/search-console.js — Google Search Console data for the monthly report (clicks, impressions, queries, pages,
// countries and positions for the phrases we target). Read-only; no npm packages (signs the Google token itself).
//
// SETUP (once, by the site owner):
//   1. Google Cloud console -> create a project -> enable "Google Search Console API".
//   2. IAM -> Service accounts -> create one -> Keys -> Add key -> JSON (download).
//   3. Search Console -> Settings -> Users and permissions -> Add user: the service account's email, "Restricted".
//   4. Vercel -> Settings -> Environment Variables:
//        GSC_CLIENT_EMAIL = client_email from the JSON
//        GSC_PRIVATE_KEY  = private_key from the JSON (paste as is; "\n" escapes are fine)
//        GSC_SITE         = optional, e.g. "sc-domain:cleverstack.dev" or "https://cleverstack.dev/"
// Until then the report says Search Console is not connected; nothing else is affected.

import crypto from 'node:crypto';

// The phrases we track every month (docs/SEO-PLAN.md section 2). A query counts when it contains the phrase.
export const TRACKED = [
  'shopify developer', 'shopify store setup', 'woocommerce developer', 'wordpress developer', 'elementor expert',
  'next.js development', 'react developer', 'node.js developer', 'saas mvp development', 'web app development',
  'zoho crm', 'crm integration', 'website redesign', 'landing page design',
  'web development company usa', 'web development company uk', 'web development company europe', 'web development agency',
  'website for dentists', 'law firm website', 'real estate website', 'restaurant website', 'saas website', 'fashion ecommerce',
  'how much does a website cost', 'website cost', 'website no enquiries', 'fix or rebuild website', 'shopify vs woocommerce', 'website slow',
  'full stack developer', 'full-stack developer', 'frontend developer', 'front end developer', 'backend developer', 'back end developer',
  'software engineer', 'web developer', 'hire developer', 'freelance developer',
  'cleverstack'
];
// Target markets first in the country table (ISO 3166-1 alpha-3, as Search Console reports them)
const COUNTRY = { usa: 'United States', gbr: 'United Kingdom', deu: 'Germany', can: 'Canada', fra: 'France', nld: 'Netherlands', irl: 'Ireland', esp: 'Spain', ita: 'Italy', swe: 'Sweden', che: 'Switzerland', aus: 'Australia', bel: 'Belgium', aut: 'Austria', dnk: 'Denmark', nor: 'Norway', fin: 'Finland', pol: 'Poland', prt: 'Portugal', nzl: 'New Zealand', nga: 'Nigeria', ind: 'India',
  bgd: 'Bangladesh', rus: 'Russia', pak: 'Pakistan', phl: 'Philippines', bra: 'Brazil', mex: 'Mexico', zaf: 'South Africa', are: 'United Arab Emirates', sgp: 'Singapore', jpn: 'Japan', chn: 'China', idn: 'Indonesia', egy: 'Egypt', ken: 'Kenya', gha: 'Ghana', tur: 'Turkey', ukr: 'Ukraine', cze: 'Czechia', rou: 'Romania', grc: 'Greece', hun: 'Hungary', lux: 'Luxembourg', isl: 'Iceland', est: 'Estonia', ltu: 'Lithuania', lva: 'Latvia', svk: 'Slovakia', svn: 'Slovenia', hrv: 'Croatia', bgr: 'Bulgaria', mlt: 'Malta', cyp: 'Cyprus', isr: 'Israel', sau: 'Saudi Arabia', kor: 'South Korea', vnm: 'Vietnam', mys: 'Malaysia', tha: 'Thailand', arg: 'Argentina', col: 'Colombia', chl: 'Chile' };
export const countryName = (c) => COUNTRY[String(c || '').toLowerCase()] || String(c || '').toUpperCase();

export const gscConfigured = () => !!(process.env.GSC_CLIENT_EMAIL && process.env.GSC_PRIVATE_KEY);

const b64url = (b) => Buffer.from(b).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
async function accessToken() {
  const now = Math.floor(Date.now() / 1000);
  const claim = { iss: process.env.GSC_CLIENT_EMAIL, scope: 'https://www.googleapis.com/auth/webmasters.readonly', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 };
  const unsigned = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' })) + '.' + b64url(JSON.stringify(claim));
  const key = String(process.env.GSC_PRIVATE_KEY).replace(/\\n/g, '\n');
  const jwt = unsigned + '.' + b64url(crypto.createSign('RSA-SHA256').update(unsigned).sign(key));
  const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'grant_type=' + encodeURIComponent('urn:ietf:params:oauth:grant-type:jwt-bearer') + '&assertion=' + jwt });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.access_token) throw new Error('Google sign-in failed (' + r.status + '): ' + (j.error_description || j.error || 'no token'));
  return j.access_token;
}

async function query(token, site, body) {
  const r = await fetch('https://www.googleapis.com/webmasters/v3/sites/' + encodeURIComponent(site) + '/searchAnalytics/query', { method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { const e = new Error('Search Console ' + r.status + ': ' + ((j.error && j.error.message) || 'request failed')); e.status = r.status; throw e; }
  return j.rows || [];
}

const sum = (rows) => {
  const t = rows[0] || {};
  return { clicks: t.clicks || 0, impressions: t.impressions || 0, ctr: Math.round((t.ctr || 0) * 1000) / 10, position: Math.round((t.position || 0) * 10) / 10 };
};

// Month = { start: 'YYYY-MM-DD', end: 'YYYY-MM-DD' } (inclusive). Returns null when not configured.
export async function getSearchMonth(cur, prev) {
  if (!gscConfigured()) return null;
  const token = await accessToken();
  const sites = process.env.GSC_SITE ? [process.env.GSC_SITE] : ['sc-domain:cleverstack.dev', 'https://cleverstack.dev/'];
  let site, total;
  for (const s of sites) {
    try { total = await query(token, s, { startDate: cur.start, endDate: cur.end }); site = s; break; }
    catch (e) { if (s === sites[sites.length - 1] || ![403, 404].includes(e.status)) throw e; }
  }
  const range = { startDate: cur.start, endDate: cur.end };
  const [before, queries, pages, countries] = await Promise.all([
    query(token, site, { startDate: prev.start, endDate: prev.end }),
    query(token, site, { ...range, dimensions: ['query'], rowLimit: 1000 }),
    query(token, site, { ...range, dimensions: ['page'], rowLimit: 1000 }),
    query(token, site, { ...range, dimensions: ['country'], rowLimit: 50 })
  ]);
  const tracked = TRACKED.map((phrase) => {
    const hits = queries.filter((q) => String(q.keys[0]).toLowerCase().includes(phrase));
    if (!hits.length) return { phrase, seen: false };
    const imp = hits.reduce((a, q) => a + q.impressions, 0);
    return { phrase, seen: true, clicks: hits.reduce((a, q) => a + q.clicks, 0), impressions: imp,
      position: Math.round((hits.reduce((a, q) => a + q.position * q.impressions, 0) / (imp || 1)) * 10) / 10 }; // impression-weighted, like Search Console
  });
  return {
    site, current: sum(total), previous: sum(before),
    queries: queries.slice(0, 10).map((q) => ({ query: q.keys[0], clicks: q.clicks, impressions: q.impressions, position: Math.round(q.position * 10) / 10 })),
    pages: pages.slice(0, 10).map((p) => ({ page: String(p.keys[0]).replace(/^https?:\/\/[^/]+/, '') || '/', clicks: p.clicks, impressions: p.impressions })),
    pagesWithImpressions: pages.length,
    countries: countries.slice(0, 8).map((c) => ({ country: countryName(c.keys[0]), clicks: c.clicks, impressions: c.impressions })),
    tracked, page1: tracked.filter((t) => t.seen && t.position <= 10).length
  };
}
