// lib/pitch.js — tells real enquiries apart from people selling to us (SEO/link-building offers, agencies,
// outsourcing, "I noticed errors on your site", job applications). Pitches are tagged, never deleted: the CRM keeps
// them under "Vendor pitches", out of the pipeline, lead counts and hot-lead alerts, with one click to undo.
//
// It looks for OFFER language (we/I can do X for you), not NEED language: "I need SEO to rank on Google" is a lead.
// A message that also describes a real need must carry much stronger evidence before it is called a pitch.

// What the visitor picked in "What can we help you with?" (contact form). Stored as the label.
export const INTENTS = {
  'new-website': 'A new website',
  'redesign': 'Redesign or fix my website',
  'ecommerce': 'An online store',
  'web-app': 'A web app or SaaS',
  'seo-speed': 'SEO or site speed',
  'support': 'Ongoing support',
  'other': 'Something else',
  'offering': "I'm offering services / partnership"
};

// [weight, pattern, reason] — weight 2 = clear on its own, 1 = needs another signal (4 = clear even next to need language)
const SIGNALS = [
  [2, /\b(guest[- ]?posts?|sponsored (posts?|articles?)|link[- ]?building|backlinks?|link insertions?|high[- ](da|dr)\b|\bd[ar]\s?\d{2}\b|domain authority)/i, 'Sells links or guest posts'],
  [2, /\bwhite[- ]?label(led|ed)?\b/i, 'Offers white-label work'],
  [2, /\b(we|i|our team)\s+(can|could|will|would)\s+(help\s+(you\s+)?)?(rank|get|put|bring|take|boost|increase|improve|grow|double|triple)\s+(higher|better|you(r)?\b|traffic|sales|leads|rankings?|seo)/i, 'Offers to grow our rankings or sales'],
  [2, /\b(more|higher|targeted|organic)\s+(traffic|leads|sales|customers|visitors|clients)\s+(to|for)\s+your\s+(site|website|business|company|agency)/i, 'Offers us more traffic or leads'],
  [2, /\b(get|put|bring|rank)\s+your\s+(website|site|business|page|company)\s+(on|to|at|in)\s+(the\s+)?(first|1st|top|#1|page 1|number one)/i, 'Promises page-one rankings'],
  [2, /\bour\s+(agency|company|firm|team|studio)\s+(offers|provides|speciali[sz]es|has helped|helps|can|delivers|builds)\b/i, 'Describes their own agency services'],
  [2, /\b(i am|i'm|i’m)\s+an?\s+((freelance|professional|senior|junior|experienced|certified|skilled|expert)\s+)*(web|wordpress|shopify|seo|full[- ]?stack|front[- ]?end|back[- ]?end|ui\/?ux|graphic|software|app)?\s*(developer|designer|engineer|expert|specialist|consultant|marketer|virtual assistant|va)\b/i, 'Introduces themselves as a freelancer'],
  [2, /\b(outsourc(e|ing)|offshore|staff augmentation|dedicated (developers?|resources?|team)|hire our (team|developers?|experts?))\b/i, 'Offers outsourcing or dedicated developers'],
  // not "I found your website" (that is how clients find us): only found problems, or an audit they ran
  [2, /\b(i|we)\s+(noticed|found|spotted|identified|detected|saw)\s+(that\s+)?(there are\s+)?((some|a few|several|many|few|multiple|\d+)\s+)?(critical\s+|major\s+|technical\s+|seo\s+)?(errors|issues|mistakes|problems|bugs|broken links)\b|\b(i|we)\s+(audited|analy[sz]ed|ran an audit on)\s+your\s+(website|site)/i, 'Unsolicited "I found issues on your website"'],
  [2, /\b(lead generation|appointment setting|cold (email|outreach)|email marketing|social media management|ppc management)\s+(services?|campaigns?|agency)\b/i, 'Offers marketing services'],
  // weight 4: "I am looking for a job" also reads as need language, so this must be decisive on its own
  [4, /\b(looking for|seeking|apply(ing)? for)\s+(a\s+|an\s+)?((full|part)[- ]time\s+|remote\s+)?(job|position(?!\s+(on|in|at|for)\b)|role|internship|employment|vacanc(y|ies))\b/i, 'Job application, not a client'],
  [1, /\b(are you|would you be)\s+(interested|open)\s+(in|to)\b/i, 'Asks if we are interested in an offer'],
  [1, /\b(partnership|partner with you|collaborat(e|ion)|affiliate (program|partnership)|reseller|referral fee|revenue share|commission)\b/i, 'Proposes a partnership'],
  [1, /\b(my|our)\s+(services|rates|pricing|packages?|portfolio)\s+(include|start|are|is|covers?)\b/i, 'Lists their own services or rates'],
  [1, /\b(free (seo )?audit|free (website )?analysis|free trial)\s+(for you|of your)/i, 'Offers us a free audit'],
  [1, /\b(we|i)\s+(offer|provide|specialize|specialise)\s+(in\s+)?(seo|web|website|app|digital|marketing|design|development|content)/i, 'Offers web or marketing services']
];

// signs of a genuine buyer: they describe THEIR project
const NEED = /\b(i|we)\s+(need|want|would like|'d like|am looking for|are looking for|'m looking for|require)\b|\b(my|our)\s+(website|site|store|shop|business|company|app|brand|clinic|practice|firm|restaurant)\b|\bhow much (would|does|will) it cost\b|\bquote\b|\bbudget\b/i;

// -> { pitch: boolean, reasons: [string] }
export function detectPitch(sub) {
  const intent = String(sub.intent || '');
  if (intent === INTENTS.offering || intent === 'offering') return { pitch: true, reasons: ['Chose "I\'m offering services / partnership"'] };
  const text = [sub.message, sub.company].filter(Boolean).join(' \n ').replace(/\s+/g, ' ');
  let pts = 0;
  const reasons = [];
  for (const [w, re, why] of SIGNALS) if (re.test(text)) { pts += w; reasons.push(why); }
  const need = NEED.test(text);
  const pitch = need ? pts >= 4 : pts >= 2;
  return { pitch, reasons: pitch ? reasons : [] };
}

export function intentLabel(v) {
  const s = String(v || '').trim();
  return INTENTS[s] || (Object.values(INTENTS).includes(s) ? s : '');
}
