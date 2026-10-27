// Country pages (SEO plan Phase 2.3) built by scripts/build-landing.js. They share one hreflang set with the
// hand-built USA, UK and Europe pages (see HREFLANG in the builder). Prices only from published packages:
// USD on /services, EUR on /web-development-europe. Legal points are stated as requirements the client's adviser
// confirms; we build the technical side.
module.exports = [
  {
    slug: 'web-development-germany',
    kind: 'location',
    name: 'Web Development Germany',
    title: 'Web Development for German Businesses: GDPR-Ready Sites in EUR | CleverStack',
    description: 'English and bilingual websites, online shops and web apps for businesses in Germany: GDPR-ready, accessible, fast. Fixed prices in EUR, from €449.',
    eyebrow: 'Web Development Germany',
    h1: 'Web development for businesses in Germany',
    sub: 'Websites, online shops and web apps for companies in Berlin, Munich, Hamburg and across Germany, built GDPR-ready and accessible, with fixed prices in euros.',
    price: { from: 449, currency: 'EUR', label: 'Starter website', delivery: '5–28 days', includes: '' },
    packages: [
      ['Business website', 449, 'Starter sites from €449, business sites with a CMS at €899. Delivery in 5–14 days.'],
      ['Online shop', 1599, 'Shopify or WooCommerce with cart, checkout, payments, shipping and tax. Delivery in 14–21 days.'],
      ['Custom web app', 2799, 'Dashboards, portals and SaaS products with React, Next.js and Node.js. Delivery from 14–28 days.']
    ],
    intro: [
      'Germany has some of the strictest rules for websites in Europe, and German buyers notice when a site gets them wrong. A cookie banner that loads tracking before consent, a missing Impressum or a slow, unclear shop all cost trust, and sometimes a warning letter.',
      'We build websites and shops for German companies that work in English, or in German and English, with the technical side of compliance handled from the start: consent before tracking, privacy-friendly embeds, accessible design and fast pages. Your legal texts come from your adviser, and we make sure the site does what they say.'
    ],
    forWho: [
      'Startups in Berlin, Munich and Hamburg with English-speaking teams',
      'Mittelstand companies that sell to international customers',
      'Online shops selling across Germany, Austria, Switzerland and the EU',
      'Companies that need a bilingual German and English site',
      'International firms opening a German office'
    ],
    deliverables: [
      ['GDPR-ready from day one', 'A consent banner that blocks analytics and marketing tags until visitors agree, privacy-friendly video and map embeds, and fonts served from your own domain.'],
      ['Impressum and privacy pages', 'Clearly linked legal notice and privacy policy pages, with the content supplied by your legal adviser.'],
      ['Accessible design', 'Built to WCAG 2.1 AA guidelines, which matters for online shops now that the Barrierefreiheitsstärkungsgesetz applies from June 2025.'],
      ['German and English', 'Bilingual sites with correct hreflang, so Google shows each visitor the right language. German copy from your team or a professional translator.'],
      ['Payments Germans use', 'PayPal, Klarna, SEPA direct debit and cards, through Shopify Payments, Stripe or WooCommerce.'],
      ['EU hosting options', 'Hosting in EU data centres where you need it, and a list of every service that processes visitor data.']
    ],
    sections: [
      ['Same working day', [
        'Our team works in UTC+1. That is the same time as Germany in winter and one hour behind in summer, so calls, reviews and quick fixes happen during your working day, not overnight.'
      ]],
      ['Why German companies choose an English-first site', [
        'Many German startups and exporters hire, sell and raise money in English. An English-first site with a German version for local customers reaches both audiences without two separate websites to maintain. We set up the structure so each language has its own pages and its own search rankings.',
        'For companies that mainly sell in Germany, a German-first site is the better choice, and we build that too, with your German copy.'
      ]],
      ['Shops for the German market', [
        'German shoppers expect clear prices including VAT, shipping costs before checkout, a right-of-withdrawal notice and the payment methods they trust. We set up Shopify or WooCommerce with these in place, and connect shipping and tax for Germany, Austria and the rest of the EU.'
      ]]
    ],
    cases: ['bouhan-falligant-law-firm-website', 'researchhub-academic-web-app'],
    caseNote: 'We have not yet published a project for a German client. These projects show the kind of work we would do for you: a large professional-services site and a real-time web app.',
    faqs: [
      ['How much does a website cost in Germany?', 'Our starter websites begin at €449 and business websites with a CMS are €899. Online shops start at €1,599 and custom web apps at €2,799. Every project gets a fixed quote in euros before work starts.'],
      ['Are your websites GDPR compliant?', 'We build the technical side for GDPR: consent before any tracking, privacy-friendly embeds, self-hosted fonts, minimal data collection and a record of the services used. The legal texts, such as the privacy policy and Impressum, should come from your legal adviser, and we make sure the site matches them.'],
      ['Do you build German-language websites?', 'Yes, we build German and bilingual sites. We are an English-speaking team, so German copy comes from your team or a professional translator, and we take care of the structure, hreflang and search setup.'],
      ['Do you build Shopware or TYPO3 sites?', 'No. We work with Shopify, WooCommerce, WordPress and custom React and Next.js. If you are on Shopware or TYPO3 and want to move, we can plan the migration.'],
      ['Can you make our shop accessible?', 'Yes. We build to WCAG 2.1 AA guidelines and test with keyboard navigation and screen-reader checks. If you sell to consumers, ask your adviser how the accessibility law applies to you.'],
      ['Which time zone do you work in?', 'UTC+1: the same as Germany in winter and one hour behind in summer.']
    ],
    related: ['shopify-development', 'react-nextjs-development', 'seo-speed-optimization']
  },
  {
    slug: 'web-development-canada',
    kind: 'location',
    name: 'Web Development Canada',
    title: 'Web Development Canada: Websites, Stores & Web Apps From $499 | CleverStack',
    description: 'Web development for Canadian businesses in Toronto, Vancouver, Montreal and beyond: websites, Shopify stores and web apps. Bilingual-ready. From $499.',
    eyebrow: 'Web Development Canada',
    h1: 'Web development for businesses across Canada',
    sub: 'Websites, online stores and web apps for companies in Toronto, Vancouver, Montreal, Calgary and across Canada, with fixed quotes and sites ready for English and French.',
    price: { from: 499, label: 'Starter Website package', delivery: '5–28 days', includes: '' },
    packages: [
      ['Business website', 499, 'Starter sites from $499, business sites with a CMS at $999. Delivery in 5–14 days.'],
      ['E-commerce store', 1749, 'Shopify or WooCommerce with checkout, payments, shipping and tax. Delivery in 10–18 days.'],
      ['Custom web app', 3000, 'Dashboards, portals and SaaS products with React, Next.js and Node.js. Delivery in 14–28 days.']
    ],
    intro: [
      'Canadian businesses compete with US companies for the same customers, often with smaller budgets. Your website has to look as credible as theirs, load as fast, and handle things US sites can ignore: French for customers in Quebec, Canadian privacy and anti-spam rules, and prices and shipping in Canadian dollars.',
      'We build websites, Shopify stores and web apps for Canadian companies with those details handled from the start, and a fixed quote so you know the full cost up front.'
    ],
    forWho: [
      'Small and growing businesses in Toronto, Vancouver, Calgary and Ottawa',
      'Quebec businesses that need English and French',
      'Canadian brands selling online to Canada and the USA',
      'Startups building their first product or marketing site',
      'Professional firms whose website no longer reflects their work'
    ],
    deliverables: [
      ['Bilingual-ready sites', 'English and French versions with their own pages and correct hreflang. French copy from your team or a professional translator.'],
      ['Stores that sell in CAD', 'Shopify Markets or WooCommerce set up for Canadian dollars, provincial taxes and shipping, and US customers too.'],
      ['Consent done properly', 'Cookie consent that respects Quebec\'s Law 25, and email sign-ups with the express consent CASL expects.'],
      ['Accessible design', 'Built to WCAG guidelines, which Ontario organisations covered by the AODA need to meet.'],
      ['Local SEO', 'Location pages, business schema and Google Business Profile basics for the cities you serve.'],
      ['Tracking you can trust', 'Google Analytics 4, Google Ads and Meta conversions set up and tested.']
    ],
    sections: [
      ['French for Quebec', [
        'Businesses that operate in Quebec are expected to offer their website in French, and French should be at least as prominent as other languages. We build sites with separate English and French pages, a clear language switch and the search setup each language needs. Your adviser can confirm exactly what applies to your business.'
      ]],
      ['Privacy and email rules', [
        'Canada\'s anti-spam law, CASL, requires consent before you send marketing emails, and Quebec\'s Law 25 sets out how cookies and tracking need consent. We set up sign-up forms with clear consent checkboxes and a cookie banner that only loads tracking after visitors agree.'
      ]],
      ['Working hours', [
        'Our team works in UTC+1, so our afternoon overlaps with Eastern Time mornings. We arrange calls at times that suit you, including for teams in Mountain and Pacific time.'
      ]]
    ],
    cases: ['bouhan-falligant-law-firm-website', 'ab-cleaning-solution-website'],
    caseNote: 'We have not yet published a project for a Canadian client. These North American projects show the kind of work we do: a large law firm site and a local service business site built to win enquiries.',
    faqs: [
      ['How much does a website cost in Canada?', 'Our Starter Website package is $499 USD and a business website with a CMS is $999 USD. E-commerce stores start at $1,749 and custom web apps at $3,000. Every project gets a fixed quote before work starts.'],
      ['Do you build French websites for Quebec?', 'Yes. We build English and French sites with separate pages for each language. French copy comes from your team or a professional translator, and we handle the structure and search setup.'],
      ['Can my Shopify store sell in Canadian dollars?', 'Yes. We set up Shopify Markets for CAD pricing, Canadian taxes and shipping, and can sell to the USA from the same store.'],
      ['Do your forms follow CASL?', 'We set up email sign-ups with clear, unticked consent checkboxes and a record of when consent was given. Your adviser can confirm what your business needs.'],
      ['Which time zone do you work in?', 'UTC+1. Our afternoon overlaps with Eastern Time mornings, and we schedule calls at times that work for you.']
    ],
    related: ['shopify-development', 'wordpress-woocommerce-development', 'website-redesign']
  }
];
