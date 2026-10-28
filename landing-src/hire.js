// "Hire a developer" pages (SEO plan Phase 2: full-stack, frontend, backend developer and software engineer searches).
// Same rules as services.js: published prices only, real projects only, no unverified numbers.
module.exports = [
  {
    slug: 'hire-full-stack-developers',
    kind: 'service',
    name: 'Hire Full-Stack Developers',
    title: 'Hire Full-Stack Developers & Software Engineers | CleverStack',
    description: 'Hire full-stack developers and software engineers for your website, SaaS or web app: React, Next.js, Node.js and databases. Fixed quotes or ongoing support.',
    eyebrow: 'Hire Full-Stack Developers',
    h1: 'Hire full-stack developers who ship your whole product',
    sub: 'One remote team of full-stack developers and software engineers for the frontend, backend, database and deployment of your website, SaaS or web app.',
    price: { from: 3000, label: 'Custom Web App package', delivery: '14–28 days', includes: 'Fixed-price projects start at $499 for a website and $3,000 for a custom web app with logins, roles, a database, an API integration and an admin panel. Ongoing development and maintenance are quoted as a monthly plan after a free call.' },
    intro: [
      'Hiring separate frontend, backend and DevOps people for one product means more interviews, more handoffs and more places for things to fall through the cracks. A full-stack developer understands the whole system, from the button a user clicks to the database row it changes, so features ship complete and bugs get fixed at the source.',
      'CleverStack is a team of full-stack developers and software engineers. You get the speed of a small team that owns the whole product, without having to recruit, manage and keep a full in-house engineering team busy.'
    ],
    forWho: [
      'Founders who need a technical team without hiring one in-house',
      'Companies with a product that needs new features and someone to own it',
      'Agencies that need reliable full-stack capacity for client projects',
      'Teams whose single developer has left and the code needs a new owner',
      'Businesses replacing freelancers who only cover part of the stack'
    ],
    deliverables: [
      ['Frontend development', 'Fast, accessible interfaces in React and Next.js that work on every screen size, built from your designs or ours.'],
      ['Backend development', 'APIs and business logic in Node.js, with authentication, roles, background jobs and integrations.'],
      ['Databases', 'PostgreSQL, MySQL, MongoDB or SQLite, designed around your data, with migrations and backups.'],
      ['DevOps and hosting', 'Deployment on Vercel or your cloud, environments, monitoring, error tracking and automated tests in CI.'],
      ['Code you own', 'Clean, documented code in a repository in your name, so any good developer can pick it up later.'],
      ['Clear communication', 'Written updates, demos of working software and a single point of contact who understands your product.']
    ],
    sections: [
      ['Project or ongoing team?', [
        'For a defined piece of work, such as a new web app, a rebuild or a set of features, we agree the scope and give you a fixed quote. You know the cost before we start, and we carry the risk of our own estimates.',
        'For a product that keeps evolving, an ongoing monthly plan works better: we keep a steady amount of development time for you each month, handle maintenance and security updates, and plan the next features with you. You can change the plan as your needs change.'
      ]],
      ['What a full-stack developer from CleverStack works with', [
        'Our core stack is TypeScript and JavaScript, React and Next.js on the frontend, Node.js and Express on the backend, PostgreSQL for data, and Vercel for hosting. We also work with Laravel, WordPress, Shopify and WooCommerce when they suit the job better, and with third-party APIs such as Stripe, Google, Zoho and AI models.',
        'We choose well-supported technology on purpose, so your product is easy to hire for and maintain long after we have built it.'
      ]],
      ['Freelancer, agency or in-house?', [
        'A single freelancer can be cost-effective for small jobs, but you depend on one person\'s availability and skills. A large agency brings process, often with a higher price and layers between you and the developers. An in-house team gives you full control, at the cost of recruiting, salaries and management.',
        'We sit in between: a small, senior team that works directly with you, covers the whole stack, and scales up or down without hiring.'
      ]]
    ],
    cases: ['researchhub-academic-web-app', 'meloforge-ai-music-web3-app'],
    faqs: [
      ['How much does it cost to hire full-stack developers?', 'Fixed-price projects start at $499 for a website and $3,000 for a custom web app. Ongoing development is quoted as a monthly plan after a free call, based on how much work you have each month.'],
      ['Can I hire a full-stack developer for an existing codebase?', 'Yes. We start with a short review of the code, infrastructure and open issues, then fix, extend or gradually improve it.'],
      ['Which time zone do you work in?', 'Our team works in UTC+1 and works with clients in the USA, UK, Canada and Europe. We arrange calls at times that suit you and send written updates.'],
      ['Do you sign NDAs and assign IP?', 'Yes. We sign an NDA before you share details, and the code and intellectual property are yours.'],
      ['Are you a staffing agency?', 'No. We do not place individual contractors in your team. You work with our team, and we take responsibility for delivery.'],
      ['How quickly can you start?', 'Usually within one to two weeks of agreeing the scope, depending on our current projects.']
    ],
    related: ['hire-frontend-developers', 'hire-backend-developers', 'react-nextjs-development']
  },
  {
    slug: 'hire-frontend-developers',
    kind: 'service',
    name: 'Hire Frontend Developers',
    title: 'Hire Frontend Developers: React & Next.js | CleverStack',
    description: 'Hire frontend developers for fast, accessible React and Next.js interfaces: pixel-accurate builds from Figma, Core Web Vitals and design systems.',
    eyebrow: 'Hire Frontend Developers',
    h1: 'Hire frontend developers for fast, polished interfaces',
    sub: 'React and Next.js developers who turn your designs into fast, accessible interfaces that work on every device and pass Core Web Vitals.',
    price: { from: 499, label: 'Starter Website package', delivery: '5–7 days', includes: 'Fixed-price frontend work starts at $499 for a starter site of up to 5 pages, $999 for a business website and $3,000 for a custom web app. Frontend work on your existing product is quoted after a free call.' },
    intro: [
      'The frontend is the part of your product people actually see and touch. It decides whether a visitor trusts you in the first seconds, whether a sign-up form gets finished, and whether your pages load fast enough for Google to rank them. A good design built badly loses all of that.',
      'Our frontend developers build interfaces that look like the design, feel fast and work for everyone: on a small phone, with a keyboard, with a screen reader, and on a slow connection.'
    ],
    forWho: [
      'Teams with designs in Figma that need a faithful, production-ready build',
      'Products whose interface has become slow, inconsistent or hard to change',
      'Marketing teams that need fast landing pages and a site they can update',
      'Startups that need a frontend for an existing backend or API',
      'Companies building a design system or component library'
    ],
    deliverables: [
      ['React and Next.js builds', 'Component-based interfaces with TypeScript, server rendering where it helps speed and SEO, and clean state management.'],
      ['Figma to code', 'Pixel-accurate builds from your designs, including responsive layouts, hover and focus states, and animations.'],
      ['Performance', 'Images, fonts and scripts loaded in the right order, so pages pass Core Web Vitals on mobile.'],
      ['Accessibility', 'Semantic HTML, keyboard navigation, colour contrast and screen-reader labels to WCAG 2.1 AA guidelines.'],
      ['Design systems', 'Reusable components with documented variants, so new pages stay consistent and quick to build.'],
      ['API integration', 'Frontends connected to your backend, CMS or third-party APIs, with loading, empty and error states handled.']
    ],
    sections: [
      ['Speed is a frontend job', [
        'Most slow websites are slow because of the frontend: oversized images, render-blocking scripts, heavy animation libraries and layouts that jump while loading. On our own site, removing a full-screen loader, loading the main image first and inlining critical styles took the homepage\'s largest contentful paint from 5.6 to 1.6 seconds in a throttled mobile lab test.',
        'We measure first, fix the biggest causes, and check the result in real-user data over the following weeks.'
      ]],
      ['Frameworks we use', [
        'Our main frontend stack is React and Next.js with TypeScript and Tailwind CSS or plain CSS, with GSAP or Framer Motion for animation when it adds something. For content sites we also build on WordPress, Shopify and headless CMSs such as Sanity, so your team can edit pages without a developer.'
      ]],
      ['How we work with your team', [
        'We start with a short call to understand your product, users and deadlines, then agree the scope in writing. You see working pages on a preview link from the first week, comment directly on them, and approve each part before we move on. When the work is done, the code, documentation and accounts are handed over to you.'
      ]]
    ],
    cases: ['ab-cleaning-solution-website', 'spice-and-savor-restaurant-web-app'],
    faqs: [
      ['How much does it cost to hire a frontend developer?', 'Fixed-price builds start at $499 for a starter site, $999 for a business website and $3,000 for a custom web app. Frontend work on an existing product is quoted after a free call.'],
      ['Can you build from our Figma designs?', 'Yes. Send the Figma file and we will build it faithfully, raising anything that will not work well on small screens before we start.'],
      ['Do you also design?', 'Yes. If you do not have designs yet, we design the interface first and agree it with you before building.'],
      ['Can you improve our Core Web Vitals?', 'Usually, yes. We find what slows your pages down and fix it at the source. See our SEO and speed optimisation service.'],
      ['Which frameworks do you use?', 'React and Next.js with TypeScript are our default. We also work with WordPress, Shopify and headless CMSs.']
    ],
    related: ['hire-full-stack-developers', 'react-nextjs-development', 'seo-speed-optimization']
  },
  {
    slug: 'hire-backend-developers',
    kind: 'service',
    name: 'Hire Backend Developers',
    title: 'Hire Backend Developers: Node.js APIs & Databases | CleverStack',
    description: 'Hire backend developers for secure Node.js APIs, databases, authentication, payments and integrations. Software engineers who build systems that scale.',
    eyebrow: 'Hire Backend Developers',
    h1: 'Hire backend developers for secure APIs and reliable systems',
    sub: 'Node.js developers and software engineers who design the APIs, databases and integrations your product runs on, and keep them secure as you grow.',
    price: { from: 3000, label: 'Custom Web App package', delivery: '14–28 days', includes: 'Backend builds start with the Custom Web App package at $3,000: database design, logins and roles, one API integration and an admin panel. Integrations and backend work on existing systems are quoted after a free call.' },
    intro: [
      'Users never see the backend, but they feel it. Slow pages, failed payments, duplicate orders, lost data and security holes almost always start there. A good backend is boring in the best way: it does the same thing correctly every time, tells you when something goes wrong, and keeps working when traffic grows.',
      'Our backend developers design APIs and databases around your data and business rules, with security, error handling and monitoring built in from the start rather than added after an incident.'
    ],
    forWho: [
      'Products that need a new API or backend for a web or mobile app',
      'Companies connecting systems that do not talk to each other',
      'Teams whose backend is slow, fragile or hard to change',
      'Businesses that need payments, subscriptions or webhooks done properly',
      'Startups moving from a no-code backend to their own'
    ],
    deliverables: [
      ['API design and build', 'REST or GraphQL APIs in Node.js and TypeScript, documented, versioned and tested.'],
      ['Database design', 'PostgreSQL, MySQL or MongoDB schemas designed for your data, with indexes, migrations and backups.'],
      ['Authentication and security', 'Secure logins, roles and permissions, input validation, rate limiting and secrets kept out of code.'],
      ['Payments and webhooks', 'Stripe and PayPal payments and subscriptions, with webhooks handled idempotently so nothing is charged twice.'],
      ['Integrations', 'CRMs, email, accounting, AI models and third-party APIs connected reliably, with retries and logging.'],
      ['Monitoring and performance', 'Error tracking, health checks and query tuning, so you hear about problems before your users do.']
    ],
    sections: [
      ['Built to handle failure', [
        'Every external service fails sometimes: payment providers time out, email APIs reject messages, databases restart. Backends that assume everything works lose data when it does not. We design for failure: requests that can be retried safely, jobs that resume where they stopped, and logs that tell you exactly what happened.'
      ]],
      ['Real-time and data-heavy systems', [
        'For live features we use WebSockets and event-driven designs, as in ResearchHUB, where every collaborator sees changes as they happen. For analytics and reporting we design databases and summary tables that stay fast as data grows, instead of slowing down every month.'
      ]],
      ['Taking over an existing backend', [
        'If you inherited a backend nobody understands, we start with a review: architecture, data model, security, dependencies and hosting. You get a plain-language report of the risks and a plan, and we fix the most important problems first.'
      ]]
    ],
    cases: ['researchhub-academic-web-app', 'enterprise-analytics-dashboard'],
    faqs: [
      ['How much does it cost to hire a backend developer?', 'Backend builds start with our Custom Web App package at $3,000. Integrations and work on existing systems are quoted after a free call, with a fixed price before work starts.'],
      ['Which backend technologies do you use?', 'Mainly Node.js with TypeScript, Express or Next.js API routes, and PostgreSQL. We also work with Laravel, MongoDB and serverless platforms when they suit the job.'],
      ['Can you build an API for our mobile app?', 'Yes. We design APIs for web and mobile clients, with authentication, versioning and documentation.'],
      ['Can you review our backend for security issues?', 'Yes. We review authentication, permissions, input handling, secrets and dependencies, and fix the issues in order of risk.'],
      ['Do you write tests?', 'Yes. We write automated tests for the parts of the system where mistakes are expensive, such as payments, permissions and data changes, and run them on every change.']
    ],
    related: ['hire-full-stack-developers', 'saas-mvp-development', 'zoho-crm-automation']
  }
];
