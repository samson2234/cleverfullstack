// Service pages (SEO plan Phase 2.1). Built by scripts/build-landing.js — edit here, then run `npm run landing`.
// Rules: prices and delivery times only from the published packages on /services; case studies only from
// work-src/projects.json (described by what was built, no unverified percentages); plain text (escaped by the builder).
module.exports = [
  {
    slug: 'shopify-development',
    kind: 'service',
    name: 'Shopify Development',
    title: 'Shopify Developer for Hire: Stores Built to Sell, From $1,749 | CleverStack',
    description: 'Hire a Shopify developer for a store that loads fast and converts: theme build, product setup, payments, shipping and tracking. Fixed quote, from $1,749.',
    eyebrow: 'Shopify Development',
    h1: 'Shopify developer for hire: stores that load fast and sell',
    sub: 'Custom Shopify stores for brands in the USA, UK, Canada and Europe. Clean product pages, a checkout that does not leak sales, and a store your team can run without calling a developer.',
    price: { from: 1749, label: 'E-Commerce Store package', delivery: '10–18 days', includes: 'Up to 20 products, cart and checkout, payment gateway, shipping and tax, product search and filtering, order management, 2 revisions.' },
    intro: [
      'Most Shopify stores do not fail because of the product. They fail because the store is slow on a phone, the product page leaves questions unanswered, and the checkout asks for too much too soon. Every one of those problems costs sales you already paid to attract with ads or content.',
      'We build Shopify stores the way a buyer shops: fast first screen, clear photos and specs, honest delivery and returns information, and a path to checkout with as few steps as Shopify allows. You get a store that is easy to manage, fully yours, and set up to measure what is actually selling.'
    ],
    forWho: [
      'Brands moving from Etsy, Amazon or social selling to their own store',
      'Existing Shopify stores that look dated or convert poorly on mobile',
      'Businesses moving from WooCommerce, Wix or Squarespace to Shopify',
      'Product launches that need a store ready by a fixed date',
      'Teams that want a custom theme without an agency-sized bill'
    ],
    deliverables: [
      ['Custom theme or tailored Online Store 2.0 theme', 'Built in Liquid with reusable sections, so your team can create new pages and promotions in the theme editor without code.'],
      ['Product, collection and filter setup', 'Variants, metafields for specs, collection filtering and search that helps shoppers find the right product in a few taps.'],
      ['Payments, shipping and tax', 'Shopify Payments, PayPal, Apple Pay and Google Pay where available, shipping zones and rates, and tax settings for the markets you sell in.'],
      ['Checkout and cart that convert', 'Clear delivery and returns information, trust signals near the buy button, and no surprise costs at the last step.'],
      ['Speed and SEO foundations', 'Compressed images, lean apps, clean URLs, product structured data and redirects from your old store so you keep your rankings.'],
      ['Tracking you can trust', 'Google Analytics 4, Meta Pixel and Google Ads conversion tracking connected and tested, so you know which channel actually sells.']
    ],
    sections: [
      ['Apps: fewer, chosen on purpose', [
        'Every Shopify app adds scripts to your store, and too many apps are the most common reason a store is slow. Before we install anything we check whether the theme can do the job natively. When an app is the right answer, we pick one with a good track record and set it up properly.',
        'If you are moving an existing store, we audit the apps you already have and remove the ones you pay for but do not use. That alone often makes a store noticeably faster.'
      ]],
      ['Migrating to Shopify without losing sales or rankings', [
        'Products, customers and order history can be moved from WooCommerce, Wix, Squarespace and most other platforms. We map every old product and page URL to its new address with 301 redirects, so search engines and old links send people to the right place.',
        'We launch at a quiet time for your business, test real orders end to end, and keep a close eye on the store in the first days after launch.'
      ]]
    ],
    cases: ['sonic-audio-shopify-store'],
    faqs: [
      ['How much does a Shopify store cost?', 'Our E-Commerce Store package starts at $1,749 and covers up to 20 products, cart and checkout, payments, shipping and tax, search and filtering, and order management. Larger catalogues, custom features or a migration from another platform are quoted after a free call. You get a fixed quote before any work starts.'],
      ['How long does it take to build a Shopify store?', 'Most stores are delivered in 10 to 18 days once we have your products, images and branding. A migration or a fully custom theme can take longer, and you will get a specific timeline in your proposal.'],
      ['Do I need a custom theme or can you customise an existing one?', 'Many stores do well on a well-chosen Online Store 2.0 theme that we tailor to your brand. A custom theme makes sense when your products need a layout that standard themes cannot do well. We will recommend the cheaper option when it fits.'],
      ['Can you move my store from WooCommerce or Wix to Shopify?', 'Yes. We move products, customers and order history where the platform allows it, and set up 301 redirects from every old URL so you keep your search rankings.'],
      ['Will I be able to manage the store myself?', 'Yes. You own the store and every account, and we give you a short walkthrough so your team can add products, run discounts and edit pages without a developer.'],
      ['Do you work with stores outside the USA?', 'Yes. We set up Shopify Markets, currencies, shipping zones and tax for stores selling in the USA, UK, Canada and across Europe.']
    ],
    related: ['wordpress-woocommerce-development', 'ecommerce-websites', 'seo-speed-optimization']
  },
  {
    slug: 'wordpress-woocommerce-development',
    kind: 'service',
    name: 'WordPress & WooCommerce Development',
    title: 'WordPress & WooCommerce Developer: Fast, Secure Sites From $999 | CleverStack',
    description: 'WordPress and WooCommerce development for small businesses: custom themes, Elementor builds, online stores, speed and security. Fixed quote, from $999.',
    eyebrow: 'WordPress & WooCommerce',
    h1: 'WordPress and WooCommerce developer for small businesses',
    sub: 'Business websites and online stores on WordPress that are fast, secure and easy for your team to update, built for firms in the USA, UK, Canada and Europe.',
    price: { from: 999, label: 'Business Website package', delivery: '7–14 days', includes: 'Up to 10 pages with a CMS, custom theme, blog setup, advanced SEO, Google Analytics 4, performance optimisation, cookie consent, 2 revisions and editor training. WooCommerce stores start at $1,749.' },
    intro: [
      'WordPress runs a large share of the web because it is flexible and easy to edit. That flexibility is also why so many WordPress sites end up slow, insecure and held together by thirty plugins nobody remembers installing.',
      'We build WordPress sites that stay fast and safe: a lean theme, only the plugins you need, structured content your team can update, and security and backups set up before launch. When you sell online, WooCommerce gives you a store on the same site, with no monthly platform fee.'
    ],
    forWho: [
      'Professional firms that need a credible site they can update themselves',
      'Businesses on an old WordPress site that is slow, broken or hacked',
      'Teams that want Elementor or the block editor without the bloat',
      'Shops that want to sell on their own site with WooCommerce',
      'Content-led businesses that publish often and need strong SEO'
    ],
    deliverables: [
      ['Custom theme or careful page-builder build', 'A theme built for your brand, or a clean Elementor or block-editor build when your team prefers to edit visually.'],
      ['Content structure your team can manage', 'Custom post types and fields for things like services, team members, locations or case studies, so updates stay consistent.'],
      ['WooCommerce store setup', 'Products, variations, payments with Stripe or PayPal, shipping, tax, emails and order management.'],
      ['Speed', 'Caching, image optimisation, lean plugins and good hosting advice, so the site passes Core Web Vitals on mobile.'],
      ['Security and backups', 'Updates, a security plugin set up properly, limited admin access, and automatic backups you can restore.'],
      ['SEO foundations', 'Clean URLs, meta titles and descriptions, schema markup, an XML sitemap and Search Console set up.']
    ],
    sections: [
      ['WordPress or something else?', [
        'WordPress is a strong choice when you publish regularly, need many pages, or want full control of your site and hosting. If you only need a few pages and never want to think about updates, a hosted builder such as Squarespace or Wix can be simpler, and if you sell many products with little content, Shopify may fit better.',
        'We work with all of these and will tell you which one suits your budget and how you work. We are not tied to one platform.'
      ]],
      ['Fixing an existing WordPress site', [
        'If your site is slow, throwing errors or was hacked, we start with an audit: plugins, theme, hosting, database and security. Often the fastest fix is removing what is not needed and updating what is out of date. When the theme itself is the problem, we rebuild only what is holding you back.'
      ]]
    ],
    cases: ['bouhan-falligant-law-firm-website', 'lumea-glow-skin-clinic-website'],
    faqs: [
      ['How much does a WordPress website cost?', 'Our Business Website package is $999 for up to 10 pages with a CMS, custom theme, blog, advanced SEO, analytics and editor training. A WooCommerce store starts at $1,749. Larger sites are quoted after a free call, and the quote is fixed before work starts.'],
      ['Do you use Elementor?', 'Yes, when it suits your team. Elementor makes visual editing easy, and we build with it carefully so pages stay fast. For sites where speed matters most, we often use a custom theme with the block editor instead.'],
      ['Can you speed up my slow WordPress site?', 'Usually, yes. Slow WordPress sites are most often caused by heavy themes, too many plugins, large images or weak hosting. Our Fix & Redesign and SEO & Growth packages cover this, starting at $549.'],
      ['Is WooCommerce better than Shopify?', 'It depends on your business. WooCommerce has no monthly platform fee and suits stores that publish a lot of content. Shopify is simpler to run and very reliable for larger catalogues. Read our Shopify vs WooCommerce guide or ask us on a call.'],
      ['Who hosts the site?', 'You do, on an account in your name. We recommend good managed WordPress hosting and can set it up for you.'],
      ['Can you look after the site after launch?', 'Yes. Every project includes a post-launch check-in window, and we offer ongoing maintenance plans for updates, backups, monitoring and small changes.']
    ],
    related: ['website-redesign', 'shopify-development', 'seo-speed-optimization']
  },
  {
    slug: 'react-nextjs-development',
    kind: 'service',
    name: 'React & Next.js Web App Development',
    title: 'React & Next.js Development Agency: Custom Web Apps From $3,000 | CleverStack',
    description: 'React and Next.js developers for dashboards, portals and SaaS products: Node.js APIs, databases, logins and roles. Fixed quote, from $3,000.',
    eyebrow: 'React & Next.js Web Apps',
    h1: 'React and Next.js development for custom web apps',
    sub: 'Dashboards, client portals and SaaS products built with React, Next.js and Node.js, for startups and growing businesses in the USA, UK, Canada and Europe.',
    price: { from: 3000, label: 'Custom Web App package', delivery: '14–28 days', includes: 'Custom dashboard or portal with React, Next.js or Laravel, user logins and roles, database design, 1 API integration, responsive UI, admin panel, data visualisation, form validation, 3 revisions.' },
    intro: [
      'Off-the-shelf tools get you started, but at some point your process does not fit a spreadsheet, a form builder or yet another SaaS subscription. A custom web app lets you run that process your way: the right data, the right screens for each role, and the integrations your team needs.',
      'We build these apps with React and Next.js on the front end and Node.js on the back end, with a database designed around your data. The result is fast, secure and maintainable, and the code is yours.'
    ],
    forWho: [
      'Businesses replacing spreadsheets and manual work with a proper tool',
      'Companies that need a client or partner portal with logins',
      'Teams that need dashboards over data spread across several systems',
      'Startups building the first version of a SaaS product',
      'Products on an ageing stack that need a modern rebuild'
    ],
    deliverables: [
      ['Next.js front end', 'Fast pages that work on any device, with server rendering where it helps speed and search visibility.'],
      ['Node.js API and database', 'An API designed around your data, with PostgreSQL or another database chosen for the job.'],
      ['Logins, roles and permissions', 'Secure sign-in, password resets and role-based access, so each user sees only what they should.'],
      ['Admin panel', 'Screens for your team to manage users, content and settings without touching the database.'],
      ['Integrations', 'Payments, CRMs, email, analytics and third-party APIs connected cleanly, with errors handled and logged.'],
      ['Deployment and handover', 'Hosting on Vercel or your cloud, environment settings, documentation, and a code repository you own.']
    ],
    sections: [
      ['How we keep a custom build under control', [
        'Custom software goes wrong when the scope is vague. Before we write code we agree the screens, the roles and the data in a short written plan, and price that plan as a fixed quote. You see working software early and often, so feedback lands while it is still cheap to change course.',
        'We choose boring, well-supported technology on purpose. React, Next.js, Node.js and PostgreSQL have large communities and plenty of developers, so you are never locked in to us.'
      ]],
      ['Real-time features when you need them', [
        'Live dashboards, activity feeds and collaborative editing need data that updates without a page refresh. We have built these with WebSockets, for example in ResearchHUB, where every collaborator sees changes as they happen.'
      ]]
    ],
    cases: ['researchhub-academic-web-app', 'meloforge-ai-music-web3-app'],
    faqs: [
      ['How much does a custom web app cost?', 'Our Custom Web App package starts at $3,000 for a dashboard or portal with logins and roles, database design, one API integration, an admin panel and data visualisation. Larger products are quoted after a free call, with a fixed quote before work starts.'],
      ['How long does it take to build a web app?', 'The starter package is delivered in 14 to 28 days. Larger web applications usually run 4 to 10 weeks depending on scope, and you get a specific timeline in your proposal.'],
      ['Do I own the code?', 'Yes. The code lives in a repository in your name, and the hosting and service accounts are yours.'],
      ['Why React and Next.js?', 'They are fast, widely used and well supported, which makes your product easier to hire for and maintain. When a different stack fits better, such as Laravel, we will say so.'],
      ['Can you work with our existing codebase?', 'Yes. We start with a short review of the code and infrastructure, then fix, extend or gradually replace parts of it rather than rebuilding everything at once.'],
      ['Can you sign an NDA?', 'Yes, we are happy to sign an NDA before you share details of your product.']
    ],
    related: ['saas-mvp-development', 'zoho-crm-automation', 'saas-startup-websites']
  },
  {
    slug: 'saas-mvp-development',
    kind: 'service',
    name: 'SaaS MVP Development',
    title: 'SaaS MVP Development: Launch Your First Version in Weeks | CleverStack',
    description: 'SaaS MVP development for founders: scope, design, build and launch a product real users can pay for. Next.js, Node.js, Stripe billing. From $3,000.',
    eyebrow: 'SaaS MVP Development',
    h1: 'SaaS MVP development for founders who need to launch',
    sub: 'We help founders turn an idea into a working product that real users can sign up for and pay for, without spending months building features nobody asked for.',
    price: { from: 3000, label: 'Custom Web App package', delivery: 'Typically 4–10 weeks', includes: 'The starter package (from $3,000) covers logins and roles, database design, one API integration, an admin panel and data visualisation. Most MVPs add billing and onboarding, and are quoted as a fixed price after a free call.' },
    intro: [
      'An MVP has one job: show whether people want what you are building, as quickly and cheaply as possible. The most common mistake is building too much before anyone has used it. The second is building something so rough that users cannot tell whether the idea is good.',
      'We help you cut the scope to the one workflow that proves the idea, then build that workflow properly: sign-up, the core feature, billing, and the admin tools you need to support your first customers. It is built on a stack that can grow with you, so you are not forced into a rewrite once it works.'
    ],
    forWho: [
      'Non-technical founders with a validated problem and a budget',
      'Founders with a prototype in no-code tools that has hit its limits',
      'Agencies and consultancies turning a service into a product',
      'Startups that need a working demo for investors or pilot customers'
    ],
    deliverables: [
      ['Scope workshop', 'We map the one workflow your MVP must do well, list what can wait, and agree it in writing.'],
      ['Product design', 'Simple, clean screens for onboarding and the core feature, designed for the users you are targeting.'],
      ['Accounts and billing', 'Sign-up, login, teams where needed, and Stripe subscriptions or one-off payments.'],
      ['The core feature', 'Built with Next.js and Node.js on a database designed for your data, with tests on the parts that matter.'],
      ['Admin and analytics', 'An admin panel to support customers, plus product analytics so you can see what people actually use.'],
      ['Launch', 'Hosting, a custom domain, transactional emails, error monitoring and a launch checklist.']
    ],
    sections: [
      ['What we will push back on', [
        'If a feature does not help you learn whether the product works, we will suggest leaving it for version two. Social logins, complex permissions, native mobile apps and AI features are all useful, but they can usually wait until you have paying users asking for them.',
        'This keeps your first version affordable and gets it in front of users sooner.'
      ]],
      ['After launch', [
        'Once real users arrive, we help you read the data, fix what confuses people and build the next features they ask for. You can keep working with us or hand the code to your own team. It is documented and in a repository you own.'
      ]]
    ],
    cases: ['meloforge-ai-music-web3-app', 'researchhub-academic-web-app'],
    faqs: [
      ['How much does an MVP cost?', 'Our Custom Web App package starts at $3,000. Most SaaS MVPs with billing and onboarding cost more, depending on the core workflow. After a free call we give you a fixed quote for an agreed scope, so the price does not creep.'],
      ['How long does it take to build an MVP?', 'Most MVPs take 4 to 10 weeks from agreed scope to launch. A tighter scope launches sooner.'],
      ['What tech stack do you use?', 'Usually Next.js, Node.js and PostgreSQL, with Stripe for billing and Vercel for hosting. It is a common, well-supported stack that any good developer can pick up later.'],
      ['Can you add AI features?', 'Yes. We have integrated AI models, for example Google Gemini in MeloForge. We recommend adding AI when it is central to the value of the product, not as decoration.'],
      ['Who owns the product and code?', 'You do. Code, accounts and data are in your name from day one.'],
      ['Do you take equity instead of payment?', 'No. We work on fixed quotes, which keeps the relationship simple and leaves your cap table to you.']
    ],
    related: ['react-nextjs-development', 'saas-startup-websites', 'landing-page-design']
  },
  {
    slug: 'zoho-crm-automation',
    kind: 'service',
    name: 'Zoho CRM Implementation & Automation',
    title: 'Zoho CRM Consultant: Setup, Automation & Integrations | CleverStack',
    description: 'Zoho CRM implementation and automation: setup, data migration, workflows, Deluge scripts and integrations with your website, email and payments.',
    eyebrow: 'Zoho CRM & Automation',
    h1: 'Zoho CRM consultant for setup, automation and integrations',
    sub: 'We set up Zoho CRM around how your team actually sells, automate the repetitive work, and connect it to your website, email and payment tools.',
    price: { label: 'Quoted per project', delivery: 'Agreed in your proposal', includes: 'CRM work depends heavily on your data and process, so we scope it on a free call and send a fixed quote. Website-to-CRM integrations can also be added to any website package.' },
    intro: [
      'A CRM only helps if your team uses it. Most CRM projects fail because the system was set up around a template, not the way the business actually sells. Fields nobody fills in, pipelines that do not match reality and leads that arrive by email instead of in the CRM all lead to the same place: a spreadsheet next to the CRM.',
      'We start with your process: where leads come from, who follows up, what a deal goes through and what you need to report on. Then we configure Zoho CRM to match it and automate the steps your team repeats every day.'
    ],
    forWho: [
      'Teams moving from spreadsheets or email to a real CRM',
      'Businesses on Zoho CRM that nobody really uses',
      'Companies whose website leads do not reach the CRM automatically',
      'Sales and service teams that repeat the same follow-up steps every day'
    ],
    deliverables: [
      ['Setup around your process', 'Modules, fields, layouts and pipelines that match how you sell, with only the fields your team needs.'],
      ['Data migration', 'Contacts, companies and deals moved from spreadsheets or another CRM, cleaned and de-duplicated.'],
      ['Workflow automation', 'Assignment rules, follow-up tasks, email sequences and alerts, plus Deluge scripts where the standard rules are not enough.'],
      ['Website and form integration', 'Leads from your website forms land in Zoho CRM with their source, so you know which channel works.'],
      ['Integrations', 'Connections to email, calendars, accounting, payments and other tools, using Zoho apps or custom API work.'],
      ['Training and handover', 'A short session for your team, written notes on how things are set up, and support while everyone gets used to it.']
    ],
    sections: [
      ['Beyond Zoho: custom tools when you need them', [
        'Sometimes a process does not fit any CRM well. In those cases we build a small custom tool, a portal or an integration with React and Node.js that connects to Zoho through its API. You keep Zoho as the system of record, and your team gets a screen designed for the job.'
      ]],
      ['What a typical Zoho CRM project looks like', [
        'Week one is about your process, not the software. We talk to the people who sell and support customers, map how a lead becomes a customer, and agree the fields, stages and reports that matter. Then we configure a test version of the CRM and walk your team through it with real examples.',
        'Once the setup is right, we import your data, switch on the automations one at a time and check each one with you. Going live is the start, not the end: we stay on hand while the team settles in and adjust anything that does not work in practice.'
      ]],
      ['Already on another CRM?', [
        'We also connect websites to HubSpot, Pipedrive and other CRMs. If you are deciding between CRMs, we will give you an honest view based on your team size, budget and the tools you already use.'
      ]]
    ],
    cases: [],
    faqs: [
      ['How much does a Zoho CRM setup cost?', 'It depends on how many modules, users and integrations you need and how much data has to be moved. After a free call we send a fixed quote, so you know the full cost before we start.'],
      ['Can you migrate our data from spreadsheets?', 'Yes. We clean, de-duplicate and import contacts, companies and deals, and check the result with you before switching over.'],
      ['Can website leads go straight into Zoho CRM?', 'Yes. We connect your website forms so each lead arrives in the CRM with its source and campaign, and can trigger an assignment and a follow-up task automatically.'],
      ['Do you write Deluge scripts?', 'Yes. When the standard workflow rules are not enough, we use Deluge functions and the Zoho API to automate the rest.'],
      ['Do you work with other Zoho apps?', 'We work with the Zoho apps that connect to CRM, such as Forms, Campaigns, Books and Desk, as part of a CRM project.']
    ],
    related: ['react-nextjs-development', 'wordpress-woocommerce-development', 'website-redesign']
  },
  {
    slug: 'website-redesign',
    kind: 'service',
    name: 'Website Redesign',
    title: 'Website Redesign Service: Faster, Modern Sites From $799 | CleverStack',
    description: 'Website redesign for businesses with an outdated or slow site: audit, redesign, speed fixes and content migration without losing rankings. From $799.',
    eyebrow: 'Website Redesign',
    h1: 'Website redesign service for outdated, slow or broken sites',
    sub: 'We redesign websites that no longer reflect the business, load slowly or stopped bringing in enquiries, and keep the search rankings you already have.',
    price: { from: 799, label: 'Fix & Redesign package', delivery: '5–10 days', includes: 'Full site audit, redesign of up to 5 pages, mobile fixes, speed optimisation to 80+ on Lighthouse, broken-link fixes, contact form repair, a security check, content migration and 2 revisions.' },
    intro: [
      'A dated website quietly costs you work. Visitors judge a business by its site within seconds, and an old design, a slow mobile page or a broken contact form sends them to a competitor without a word.',
      'A redesign does not have to mean starting from zero. We audit what you have, keep what works, and rebuild what is holding you back: the design, the structure, the speed and the path from first visit to enquiry. And we make sure you do not lose the search rankings the old site earned.'
    ],
    forWho: [
      'Businesses whose site looks older than the company really is',
      'Sites that are slow or hard to use on a phone',
      'Sites that get visitors but few enquiries',
      'Businesses that have changed what they sell or who they sell to',
      'Owners who cannot update their own site without paying someone'
    ],
    deliverables: [
      ['Audit first', 'Speed, mobile, structure, SEO, security and the enquiry path, with a short written report of what to keep and what to change.'],
      ['Modern design', 'A clean, on-brand design that makes it obvious within seconds what you do and who you do it for.'],
      ['Clear structure', 'Service pages that answer buyer questions, with a clear next step on every page.'],
      ['Speed and mobile', 'Images, code and hosting tuned so pages load fast on phones, aiming for 80+ on Lighthouse.'],
      ['Rankings protected', 'Every old URL redirected to its new address, titles and content carried over, Search Console checked after launch.'],
      ['Easy updates', 'A content system your team can use, with a short walkthrough at handover.']
    ],
    sections: [
      ['Redesign or rebuild?', [
        'If the platform is sound and the problems are mostly design and structure, a redesign is faster and cheaper. If the site is built on something you cannot update, is constantly breaking, or cannot do what you need, a rebuild on a better platform is usually the better long-term spend.',
        'Our guide Should I fix or rebuild my website walks through the decision, and we will give you a straight answer on a free call.'
      ]],
      ['How we keep your search rankings', [
        'Redesigns lose rankings when URLs change without redirects, when content that ranked is removed, or when the new site is slower. We list every page that gets search traffic before we start, keep or improve that content, redirect every old URL, and check Search Console after launch.'
      ]]
    ],
    cases: ['bouhan-falligant-law-firm-website', 'ab-cleaning-solution-website'],
    faqs: [
      ['How much does a website redesign cost?', 'Our Fix & Redesign package is $799 and covers an audit and a redesign of up to 5 pages, with speed, mobile, form and security fixes. Larger sites are quoted after a free call, with a fixed quote before work starts.'],
      ['Will I lose my Google rankings?', 'Not if the redesign is done carefully. We redirect every old URL, keep the content that ranks, and make the new site faster, which usually helps rankings.'],
      ['How long does a redesign take?', 'The Fix & Redesign package is delivered in 5 to 10 days. Larger redesigns usually take 2 to 4 weeks.'],
      ['Can you keep my current platform?', 'Yes, if it is sound. We redesign WordPress, Wix, Squarespace, Shopify and custom sites, and only recommend moving when the platform is the problem.'],
      ['Do I need new content?', 'Usually some. We help restructure and tighten your existing content, and can write new copy for key pages.']
    ],
    related: ['seo-speed-optimization', 'wordpress-woocommerce-development', 'landing-page-design']
  },
  {
    slug: 'landing-page-design',
    kind: 'service',
    name: 'Landing Page Design',
    title: 'Landing Page Design Service: Pages Built to Convert, From $499 | CleverStack',
    description: 'Landing page design and build for ads, launches and lead generation: fast, mobile-first, tracked and ready to A/B test. Delivered in 5–7 days, from $499.',
    eyebrow: 'Landing Page Design',
    h1: 'Landing page design for ads, launches and lead generation',
    sub: 'Fast, focused landing pages that turn paid and organic traffic into leads, sign-ups and pre-orders, with tracking that tells you what works.',
    price: { from: 499, label: 'Starter Website package', delivery: '5–7 days', includes: 'Up to 5 pages, mobile-responsive, SEO foundation, contact or sign-up form, social links, Google Maps where useful, basic analytics and 1 revision.' },
    intro: [
      'When you pay for every click, the page behind the ad decides whether that money comes back. A landing page should do one thing: get the visitor who clicked to take one clear action. Every extra link, slow image and vague headline lowers the chance they do.',
      'We design landing pages around the offer and the audience: a headline that matches the ad, proof near the call to action, answers to the questions that stop people, and a form that asks only for what you need. Then we track every conversion so you can see what each campaign actually returns.'
    ],
    forWho: [
      'Businesses running Google Ads or Meta ads to a general homepage',
      'Product launches collecting pre-orders or a waiting list',
      'Service businesses that want more enquiries from one offer',
      'Events, webinars and lead magnets that need a sign-up page fast'
    ],
    deliverables: [
      ['Message and structure', 'A page outline built around one offer and one action, matched to the ads or posts that send traffic.'],
      ['Design and build', 'A mobile-first page that loads fast, with a sticky call to action where it helps.'],
      ['Forms and integrations', 'Sign-up or enquiry forms connected to your email tool or CRM, with instant confirmations.'],
      ['Tracking', 'Google Analytics 4, Google Ads and Meta Pixel conversions set up and tested.'],
      ['Ready to test', 'Variants of the headline or offer ready for A/B testing once traffic arrives.'],
      ['Copy help', 'We tighten your copy, or write it from your notes, so the page reads clearly.']
    ],
    sections: [
      ['What makes a landing page convert', [
        'The best-performing pages we build share a few traits: the headline repeats the promise from the ad, the first screen shows what you get and what to do next, proof sits close to the button, and the form is short. Speed matters too, because visitors on a phone will not wait for a heavy page.',
        'Pure Energy, a smoothie brand launch page we built, combines a scroll-driven product story with a sticky call to action and an email sign-up connected to Mailchimp.'
      ]],
      ['Landing page or full website?', [
        'A landing page is the right tool when you are sending traffic to one offer: a campaign, a launch, a webinar or a single service. It removes everything that does not help that visitor act. A full website does a different job, answering many questions for many kinds of visitors, and it is where people go to check you out before they buy.',
        'Most businesses need both, and they should look like they belong together. We build landing pages that match your main site, or that live inside it, so the brand feels consistent from the ad to the thank-you page.'
      ]],
      ['Measuring what each page earns', [
        'A landing page is only as good as the numbers behind it. We set up conversion tracking for every form and button that matters, check it with test submissions, and make sure Google Ads and Meta receive the conversions so their bidding can improve. You will be able to see cost per lead by campaign, not just clicks.'
      ]]
    ],
    cases: ['pure-energy-smoothie-landing-page'],
    faqs: [
      ['How much does a landing page cost?', 'Landing pages start with our Starter Website package at $499, which covers up to 5 pages, a form, analytics and an SEO foundation. Extra integrations or A/B test variants are quoted on a free call.'],
      ['How fast can you deliver?', 'Most landing pages are delivered in 5 to 7 days once we have your offer, copy notes and branding.'],
      ['Can you connect the form to my email tool or CRM?', 'Yes. We connect to Mailchimp, HubSpot, Zoho CRM and most other tools, so leads arrive where your team works.'],
      ['Can you build it on my existing website?', 'Yes. We can build the page inside WordPress, Shopify, Webflow or your current site, or as a standalone page on its own address.'],
      ['Do you run the ads too?', 'We focus on the page and the tracking. We work alongside your ads team or freelancer and make sure conversions are reported correctly.']
    ],
    related: ['website-redesign', 'seo-speed-optimization', 'shopify-development']
  },
  {
    slug: 'seo-speed-optimization',
    kind: 'service',
    name: 'SEO & Site Speed Optimization',
    title: 'Technical SEO & Site Speed Optimization: Pass Core Web Vitals | CleverStack',
    description: 'Technical SEO and site speed optimization: Core Web Vitals, audits, schema, on-page fixes and Search Console setup. Results in 3–5 days, from $549.',
    eyebrow: 'SEO & Site Speed',
    h1: 'Technical SEO and site speed optimization',
    sub: 'We find and fix what stops your site ranking and loading fast: Core Web Vitals, crawl problems, weak pages and missing structured data.',
    price: { from: 549, label: 'SEO & Growth package', delivery: '3–5 days', includes: 'Technical SEO audit (50+ checkpoints), keyword research (20+ keywords), on-page optimisation of up to 10 pages, meta rewrites, Google Analytics 4 and Search Console setup, XML sitemap, performance recommendations and 1 revision.' },
    intro: [
      'Search engines rank pages they can crawl easily, understand clearly and load quickly. Many business sites fail at least one of these without the owner knowing: pages blocked by mistake, duplicate versions of the same page, titles that do not match what people search, or a mobile page that takes five seconds to show anything.',
      'We start with a technical audit, fix the problems in order of impact, and make the site fast on real phones. You get a written list of what we found and what we changed, so the work is clear and measurable.'
    ],
    forWho: [
      'Sites that get little traffic from Google despite good services',
      'Sites failing Core Web Vitals in Search Console',
      'Businesses that redesigned their site and lost rankings',
      'Local businesses that want to show up in their area',
      'Stores whose product pages are not being indexed'
    ],
    deliverables: [
      ['Technical audit', 'Crawlability, indexing, duplicate content, redirects, canonicals, sitemaps and robots rules checked against 50+ points.'],
      ['Core Web Vitals', 'LCP, CLS and INP measured and improved: image loading, render-blocking code, layout shifts and heavy scripts.'],
      ['On-page fixes', 'Titles, descriptions, headings and internal links on up to 10 key pages, matched to keyword research.'],
      ['Structured data', 'Organization, Service, Product, FAQ and breadcrumb schema where it fits, so search engines understand your pages.'],
      ['Search Console and analytics', 'Google Search Console and Google Analytics 4 set up, the sitemap submitted, and key conversions tracked.'],
      ['Clear report', 'What we found, what we fixed, and what to do next, in plain language.']
    ],
    sections: [
      ['Speed is part of SEO', [
        'Google uses Core Web Vitals as a ranking signal, and slow pages lose visitors before they see anything. The usual causes are large images, full-screen loaders, heavy animation scripts, too many third-party tags and fonts that load late. We fix these at the source, not with a plugin that hides them.',
        'On our own site, removing a full-screen loader, loading the main image first and putting critical styles inline took the homepage\'s largest contentful paint from 5.6 to 1.6 seconds in a throttled mobile lab test.'
      ]],
      ['Local SEO', [
        'For businesses that serve an area, we set up the local signals that matter: a complete Google Business Profile, consistent name, address and phone details, local structured data and service-area pages with real content. A&B Cleaning Solution\'s site, for example, uses local business schema with its full service area across the Portland metro.'
      ]]
    ],
    cases: ['ab-cleaning-solution-website', 'dc-carpet-cleaning-website'],
    faqs: [
      ['How much does an SEO audit and fix cost?', 'Our SEO & Growth package is $549 and covers a technical audit, keyword research, on-page optimisation of up to 10 pages, Search Console and analytics setup, and performance recommendations. Larger sites or deeper speed work are quoted after a free call.'],
      ['How long until I see results?', 'Technical fixes can show in Search Console within weeks, as pages are re-crawled. Ranking gains usually build over 2 to 6 months, depending on competition and content. Anyone who promises page one by a date is guessing.'],
      ['Can you guarantee first-page rankings?', 'No, and you should be wary of anyone who does. We fix what holds your site back and build the foundations that rankings depend on, and we report honestly on what changes.'],
      ['Can you make my site pass Core Web Vitals?', 'In most cases, yes. We measure your pages, fix the causes and check the result in field data over the following weeks.'],
      ['Do you build links?', 'We do not buy links. We help you earn them through real content, directory profiles and partners, which is safer and lasts.']
    ],
    related: ['website-redesign', 'wordpress-woocommerce-development', 'landing-page-design']
  }
];
