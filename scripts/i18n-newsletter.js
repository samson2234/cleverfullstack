// scripts/i18n-newsletter.js — Adds newsletter i18n keys to i18n.js (en + fr)
// Run: node scripts/i18n-newsletter.js

const fs = require('fs');
const path = require('path');

const root = process.argv[2] ? path.resolve(process.argv[2]) : (__dirname + '/..');
const f = path.join(root, 'i18n.js');

let t = fs.readFileSync(f, 'utf8');

if (t.indexOf('footer.newsletter_heading') !== -1) {
  console.log('Already present — skipping.');
  process.exit(0);
}

// EN keys (insert after footer.tagline in the en dict)
const enTagline = '"footer.tagline":"Built with the stack we sell."';
const enKeys =
  '"footer.newsletter_heading":"Stay in the loop",' +
  '"footer.newsletter_text":"Get web growth tips and studio updates — no spam, unsubscribe anytime.",' +
  '"footer.newsletter_placeholder":"you@company.com",' +
  '"footer.newsletter_btn":"Subscribe",' +
  '"blog.newsletter_heading":"Get web growth tips in your inbox",' +
  '"blog.newsletter_text":"One practical email per month on building websites that convert. No spam, unsubscribe anytime.",';

if (t.indexOf(enTagline) === -1) {
  console.log('ERROR: en footer.tagline not found');
  process.exit(1);
}
t = t.replace(enTagline, enTagline + ',' + enKeys);

// FR keys (insert after footer.tagline in the fr dict)
const frTagline = '"footer.tagline":"Construit avec la stack que nous vendons."';
const frKeys =
  '"footer.newsletter_heading":"Restez informé",' +
  '"footer.newsletter_text":"Des conseils de croissance web et des nouveautés du studio — pas de spam, désabonnement à tout moment.",' +
  '"footer.newsletter_placeholder":"vous@entreprise.com",' +
  '"footer.newsletter_btn":"S\'abonner",' +
  '"blog.newsletter_heading":"Recevez des conseils web dans votre boîte mail",' +
  '"blog.newsletter_text":"Un e-mail pratique par mois pour créer des sites qui convertissent. Pas de spam, désabonnement à tout moment.",';

if (t.indexOf(frTagline) === -1) {
  console.log('ERROR: fr footer.tagline not found');
  process.exit(1);
}
t = t.replace(frTagline, frTagline + ',' + frKeys);

fs.writeFileSync(f, t);
console.log('Newsletter i18n keys added (en + fr).');
