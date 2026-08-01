var i18n = (function () {
  var lang = { current: 'en' };
  var key = 'cleverstack_lang';

  var dict = {
    en: {
      /* Navigation */
      'nav.home': 'Home',
      'nav.about': 'About',
      'nav.services': 'Services',
      'nav.portfolio': 'Portfolio',
      'nav.contact': 'Contact',
      'nav.blog': 'Blog',
      'nav.book_call': 'Book a Call',
      'nav.chat_wa': 'Chat on WhatsApp',
      'nav.lang_switch': 'FR',

      /* Hero (index) */
      'hero.eyebrow': 'Full-Stack Development Studio',
      'hero.heading': 'Websites and web apps built to <span class="hl">turn visitors into revenue.</span><span class="typing-cursor"></span>',
      'hero.sub': 'We design, build, and optimize every layer of your product — frontend, backend, database, and SEO — so your site loads fast, ranks well, and converts the traffic you\'re already paying for.',
      'hero.cta_primary': 'Book a Free Call',
      'hero.cta_secondary': 'Chat on WhatsApp',
      'hero.trust_label': 'Built by Henry',
      'hero.trust_1': '200+ websites',
      'hero.trust_2': '5+ years',
      'hero.trust_3': '5.0 rating',
      'hero.stack_caption': '$ deploying your competitive advantage',

      /* Trust Strip */
      'trust.heading': 'Trusted By',
      'trust.title': 'Companies that chose CleverStack.',

      /* Benefits */
      'benefits.eyebrow': 'Why It Matters',
      'benefits.heading': 'Every layer of your stack, working for your bottom line.',
      'benefits.sub': 'We don\'t just ship code — we engineer outcomes. Here\'s what changes when your website is built right.',
      'benefit.1.title': 'Faster load times',
      'benefit.1.desc': 'Optimized frontend architecture means visitors stay instead of bouncing to a competitor.',
      'benefit.2.title': 'Conversion-first design',
      'benefit.2.desc': 'Every page is structured around a single job: turning a visit into a booked call or sale.',
      'benefit.3.title': 'Automated workflows',
      'benefit.3.desc': 'From lead capture to order fulfillment, we connect the tools that save you hours every week.',
      'benefit.4.title': 'Infrastructure that grows',
      'benefit.4.desc': 'Your app handles 10 users or 10,000 without a rebuild — the architecture is right from day one.',

      /* Services Preview */
      'services_preview.eyebrow': 'What We Build',
      'services_preview.heading': 'One team, every layer of the stack.',
      'services_preview.sub': 'No handoffs between three different freelancers. We plan, build, and ship the entire product.',
      'service.1.tag': 'Frontend',
      'service.1.title': 'Web Development',
      'service.1.desc': 'Fast, responsive marketing sites and landing pages built to convert — on WordPress, Wix, Squarespace, or custom code.',
      'service.2.tag': 'Backend',
      'service.2.title': 'Web App Development',
      'service.2.desc': 'Custom dashboards, portals, and internal tools built with React, Next.js, Node.js, and Laravel.',
      'service.3.tag': 'Commerce',
      'service.3.title': 'E-Commerce Development',
      'service.3.desc': 'Shopify and WooCommerce builds engineered to reduce cart abandonment and raise average order value.',
      'service.4.tag': 'Integrations',
      'services.svc.5.tag': 'Growth',
      'services.svc.6.tag': 'CMS',
      'services.svc.7.tag': 'Marketing',
      'services.svc.8.tag': 'Growth',

      /* Portfolio Preview */
      'portfolio.eyebrow': 'Recent Work',
      'portfolio.heading': 'Products we\'ve taken from brief to launch.',
      'portfolio.view_all': 'View Full Portfolio',

      /* Testimonials */
      'testimonials.eyebrow': 'Client Results',
      'testimonials.heading': 'Trusted by founders who needed more than "a website."',

      /* About Preview */
      'about_preview.eyebrow': 'Why CleverStack',
      'about_preview.heading': 'One partner across the entire build — not three vendors pointing fingers.',
      'about_preview.sub': 'Most agencies hand you off between a designer, a developer, and a marketer. We own frontend, backend, database, and SEO under one roof, so nothing gets lost in translation — and nothing slows down waiting on someone else\'s timeline.',
      'about_preview.cta_1': 'Read Our Story',
      'about_preview.cta_2': 'View Portfolio',
      'about_preview.stat_1': 'Projects shipped',
      'about_preview.stat_2': 'On-time delivery',
      'about_preview.stat_3': 'Core technologies',
      'about_preview.stat_4': 'Avg. client rating',

      /* ROI Calculator */
      'roi.eyebrow': 'ROI Calculator',
      'roi.heading': 'What is your website actually worth to you?',
      'roi.sub': 'Drag the sliders. See what a conversion-optimized site could add to your revenue every single month.',
      'roi.visitors.label': 'Monthly website visitors',
      'roi.conv.label': 'Current conversion rate',
      'roi.aov.label': 'Avg. value per lead / sale',
      'roi.results.current': 'Current monthly revenue',
      'roi.results.project': 'With CleverStack (est.)',
      'roi.results.diff': 'Extra revenue / month',
      'roi.note': 'Assumes an average 60% conversion uplift after performance + conversion optimization. Estimates only.',
      'roi.cta': 'Get a Free Audit',

      /* Final CTA */
      'cta.eyebrow': 'Let\'s Build',
      'cta.heading': 'Your competitors already have a fast, optimized website. Do you?',
      'cta.sub': 'Book a free 20-minute strategy call. We\'ll audit your current site or app and tell you exactly what\'s costing you leads.',
      'cta.primary': 'Book a Free Call',
      'cta.secondary': 'Chat on WhatsApp',

      /* Footer */
      'footer.desc': 'A full-stack development studio building fast, scalable websites and web applications for founders and growing businesses.',
      'footer.quick_links': 'Quick Links',
      'footer.link_home': 'Home',
      'footer.link_about': 'About',
      'footer.link_portfolio': 'Portfolio',
      'footer.link_blog': 'Blog',
      'footer.link_contact': 'Contact',
      'footer.link_privacy': 'Privacy Policy',
      'footer.link_terms': 'Terms of Service',
      'footer.services': 'Services',
      'footer.svc_web': 'Web Development',
      'footer.svc_app': 'Web App Development',
      'footer.svc_ecom': 'E-Commerce',
      'footer.svc_cms': 'CMS Development',
      'footer.svc_seo': 'SEO & Marketing',
      'footer.contact_heading': 'Contact',
      'footer.copyright': '© 2026 CleverStack. All rights reserved.',
      'footer.tagline': 'Built with the stack we sell.',

      /* Cookie Banner */
      'cookie.text': 'We use cookies to improve your experience and analyze site traffic. By continuing, you agree to our use of cookies. Read our <a href="privacy.html">Privacy Policy</a> for details.',
      'cookie.accept': 'Accept',
      'cookie.reject': 'Reject',

      /* Mobile CTA */
      'mobile.wa': 'WhatsApp',
      'mobile.book': 'Book a Free Call',

      /* Preloader */
      'preloader.loading': 'Loading\u2026',

      /* 404 Page */
      '404.eyebrow': 'Error 404',
      '404.heading': 'Page not found',
      '404.sub': 'The page you\'re looking for doesn\'t exist or has been moved.',
      '404.cta_home': 'Go to Homepage',
      '404.cta_book': 'Book a Call',
      '404.link_svcs': 'Services',
      '404.link_portfolio': 'Portfolio',
      '404.link_about': 'About',
      '404.link_privacy': 'Privacy',

      /* About Page */
      'about.eyebrow': 'About CleverStack',
      'about.h1': 'I got tired of watching good businesses run on bad websites.',
      'about.lead': 'I\'m Henry — the founder and lead developer behind CleverStack. I started this studio after years of freelancing on Fiverr and contracting for companies that needed more than a "web guy." I own the entire build from frontend to database so you work with one accountable partner, not three disconnected vendors.',
      'about.bio.heading': 'Full-stack developer. 5+ years. 200+ websites shipped.',
      'about.bio.p1': 'I\'m a full-stack web developer helping brands and businesses develop, design, fix, and optimize websites that look stunning and perform flawlessly. I specialize in website and app development, redesign, SEO, and speed optimization — building modern, mobile-responsive sites that load fast, rank higher, and convert better.',
      'about.bio.p2': 'Whether you need to fix broken layouts, repair mobile issues, optimize SEO, integrate eCommerce, or revamp your site entirely, I deliver clean, high-converting solutions built for growth.',
      'about.bio.see_portfolio': 'See recent projects',
      'about.badge_num': '200+',
      'about.badge_txt': 'Webships delivered across 5+ years',
      'about.experience.eyebrow': 'Experience',
      'about.experience.heading': 'Built for real companies, not just freelance gigs.',
      'about.experience.sub': 'I\'ve delivered full-stack solutions for banks, e-commerce brands, and startups across the US.',
      'about.exp.1.title': 'Frontend & Headless CMS Developer',
      'about.exp.1.detail': 'Independent Bank Group — Mar 2023 - Present. Building high-performance frontend applications with Next.js, React, and Tailwind CSS, integrating headless CMS platforms like Sanity and Contentful.',
      'about.exp.2.title': 'Full-Stack Web Developer',
      'about.exp.2.detail': 'Fiverr — Jul 2022 - Present. Delivering modern, scalable, conversion-focused web applications using Next.js, React, Node.js, and PostgreSQL.',
      'about.exp.3.title': 'eCommerce Web Developer',
      'about.exp.3.detail': 'Store Fixtures Direct — Jun 2022 - Present. Develop and optimize Shopify, WooCommerce, and custom-built stores.',
      'about.diff.eyebrow': 'What Makes Us Different',
      'about.diff.heading': 'Four things most agencies don\'t offer you.',
      'about.diff.1.title': 'One accountable team, not a relay race',
      'about.diff.1.desc': 'The same person who designs your site builds it, ships it, and optimizes it after launch — nothing gets lost in handoffs between contractors.',
      'about.diff.2.title': 'Business outcomes over deliverables',
      'about.diff.2.desc': 'We measure success in leads, load time, and conversion rate — not just "pages completed." Every decision traces back to revenue.',
      'about.diff.3.title': 'Platform-flexible, not platform-locked',
      'about.diff.3.desc': 'WordPress, Shopify, Wix, Squarespace, or fully custom React — we recommend what actually fits your budget and growth stage.',
      'about.diff.4.title': 'SEO and performance built in, not bolted on',
      'about.diff.4.desc': 'Speed and search visibility are engineered into the build from day one, not handed off as a separate "marketing" afterthought.',
      'about.skills.eyebrow': 'Skills & Tools',
      'about.skills.heading': 'The full stack, covered.',
      'about.skills.sub': 'Every layer of a modern web product, handled in-house.',
      'about.cta.eyebrow': 'Work With Us',
      'about.cta.heading': 'Ready to see what a full-stack team can do for your business?',
      'about.cta.sub': 'Book a free call — no pitch deck, just a straight conversation about what your website should be doing for you.',
      'about.team.eyebrow': 'The Team',
      'about.team.heading': 'A team of specialists, not a one-man show.',
      'about.team.sub': 'Design, development, SEO, and e-commerce — covered by people who do it every day.',

      /* Services Page */
      'services.page.eyebrow': 'Services',
      'services.page.h1': 'Every layer of your product, built by one team.',
      'services.page.sub': 'From the pixels a visitor sees to the database your app runs on, we design, build, and optimize the whole stack — so your site doesn\'t just look good, it performs.',
      'services.svc.1.title': 'Web Development',
      'services.svc.1.desc': 'Marketing sites and landing pages built on WordPress, Wix, Squarespace, or hand-coded HTML/React — fast, responsive, and structured to convert.',
      'services.svc.1.benefit': 'Benefit: more qualified leads per visitor, without spending more on ads.',
      'services.svc.2.title': 'Web App Development',
      'services.svc.2.desc': 'Custom dashboards, client portals, and internal tools built with React, Next.js, Node.js, and Laravel — tailored to how your business actually operates.',
      'services.svc.2.benefit': 'Benefit: automate manual work and scale operations without hiring.',
      'services.svc.3.title': 'E-Commerce Development',
      'services.svc.3.desc': 'Shopify and WooCommerce stores engineered for checkout completion — clean product pages, fast load times, and payment flows that don\'t leak sales.',
      'services.svc.3.benefit': 'Benefit: lower cart abandonment and higher average order value.',
      'services.svc.4.title': 'API & Integrations',
      'services.svc.4.desc': 'Payment gateways, CRMs, GTM/GA4 tracking, email marketing, and third-party APIs connected cleanly so your tools actually talk to each other.',
      'services.svc.4.benefit': 'Benefit: accurate data and fewer manual handoffs between systems.',
      'services.svc.5.title': 'Optimization & SEO',
      'services.svc.5.desc': 'Technical SEO, Core Web Vitals, and performance tuning that gets your site found on Google and keeps it fast once it is.',
      'services.svc.5.benefit': 'Benefit: more organic traffic, without an ongoing ad budget.',
      'services.svc.6.title': 'CMS Development & Migration',
      'services.svc.6.desc': 'WordPress, Wix, Squarespace, or headless CMS (Sanity, Contentful) — we build, migrate, or fix sites on any platform so your team can manage content without developer support.',
      'services.svc.6.benefit': 'Benefit: full editorial control without monthly dev fees.',
      'services.svc.7.title': 'SEO & Search Marketing',
      'services.svc.7.desc': 'On-page SEO, technical audits, keyword strategy, Google Business optimization, and local SEO — engineered to get your site ranking before you spend a dollar on ads.',
      'services.svc.7.benefit': 'Benefit: predictable organic traffic growth without ongoing ad spend.',
      'services.svc.8.title': 'Website Marketing & Growth',
      'services.svc.8.desc': 'Conversion rate optimization, email capture flows, analytics setup (GA4/GSC), A/B testing, and lead generation systems — turn your site into a 24/7 sales machine.',
      'services.svc.8.benefit': 'Benefit: more revenue from the same traffic you already have.',
      'services.call_link': 'Book a call about this',
      'services.process.eyebrow': 'How It Works',
      'services.process.heading': 'From first call to launch, in four steps.',
      'services.step.1': 'Discovery call',
      'services.step.1.desc': 'We learn your business goals, current pain points, and what "success" looks like in numbers.',
      'services.step.2': 'Proposal & plan',
      'services.step.2.desc': 'You get a clear scope, timeline, and fixed price — no vague hourly estimates.',
      'services.step.3': 'Build & review',
      'services.step.3.desc': 'We build in stages with regular check-ins, so you see progress and can course-correct early.',
      'services.step.4': 'Launch & optimize',
      'services.step.4.desc': 'We ship, monitor performance, and hand over documentation — or stay on for ongoing support.',
      'services.pricing.eyebrow': 'Investment',
      'services.pricing.heading': 'Clear pricing. No hidden fees.',
      'services.pricing.sub': 'Pick a package that fits your budget. Every plan includes responsive design, SEO basics, and a satisfaction guarantee.',
      'services.pricing.cta': 'Get Started',
      'services.calc.eyebrow': 'Build Your Own',
      'services.calc.heading': 'Not sure what you need? Build a custom package.',
      'services.calc.sub': 'Select the services and features you want, and we\'ll give you an instant price estimate — no commitment required.',
      'services.calc.base': '1. Choose your base service',
      'services.calc.features': '2. Add features you need',
      'services.calc.estimate': 'Your Estimate',
      'services.calc.total': 'Estimated Total',
      'services.calc.note': 'This is a rough estimate. Final pricing is confirmed after a quick discovery call.',
      'services.calc.note2': 'No commitment — we\'ll discuss your needs first.',
      'services.faq.eyebrow': 'Common Questions',
      'services.faq.heading': 'Before you book a call.',
      'services.faq.1.q': 'How long does a typical project take?',
      'services.faq.1.a': 'A marketing website usually takes 2\u20134 weeks. Web applications and e-commerce builds typically run 4\u201310 weeks depending on scope. You\'ll get a specific timeline in your proposal before any work starts.',
      'services.faq.2.q': 'What if I already have a website that just needs fixing?',
      'services.faq.2.a': 'We regularly take over existing sites — auditing performance, fixing broken flows, and rebuilding only what\'s actually holding you back, instead of starting from zero.',
      'services.faq.3.q': 'Do you work with WordPress, or only custom code?',
      'services.faq.3.a': 'Both. We\'ll recommend WordPress, Wix, or Squarespace when it fits your budget and maintenance needs, and custom React/Next.js when your product needs more flexibility than a CMS can offer.',
      'services.faq.4.q': 'How much does a project cost?',
      'services.faq.4.a': 'It depends on scope — a landing page and a multi-role web application are priced very differently. We give a fixed quote after the discovery call, once we understand exactly what you need.',
      'services.faq.5.q': 'Will I be able to update the site myself after launch?',
      'services.faq.5.a': 'Yes. We build with content management in mind and provide a short walkthrough so your team can update text, images, and products without calling us for every small change.',
      'services.faq.6.q': 'Do you offer support after launch?',
      'services.faq.6.a': 'Yes — every project includes a post-launch check-in window, and we offer ongoing maintenance plans for clients who want continuous updates, monitoring, and optimization.',
      'services.cta.eyebrow': 'Get Started',
      'services.cta.heading': 'Tell us what you\'re building. We\'ll tell you what it takes.',
      'services.cta.sub': 'Book a free 20-minute call and walk away with a clear plan, whether or not you hire us.',

      /* Contact Page */
      'contact.page.eyebrow': 'Contact',
      'contact.page.h1': 'Let\'s talk about what your website should be doing for you.',
      'contact.page.sub': 'Tell us a bit about your project. We reply within one business day, and there\'s no obligation attached to the first call.',
      'contact.form.name': 'Name',
      'contact.form.email': 'Email',
      'contact.form.phone': 'Phone',
      'contact.form.message': 'Message',
      'contact.form.name_placeholder': 'Your full name',
      'contact.form.email_placeholder': 'you@company.com',
      'contact.form.phone_placeholder': '+234 800 000 0000',
      'contact.form.message_placeholder': 'Tell us about your project, timeline, and budget range.',
      'contact.form.privacy': 'Your information is secure. We do not sell or share your data. Read our <a href="privacy.html" style="color:var(--indigo); text-decoration:underline;">Privacy Policy</a>.',
      'contact.form.submit': 'Send Message',
      'contact.form.sending': 'Sending\u2026',
      'contact.form.success': 'Message Sent',
      'contact.form.success_msg': 'Thank you! We will respond within 24 hours.',
      'contact.form.fail': 'Failed',
      'contact.sidebar.eyebrow': 'Direct Contact',
      'contact.sidebar.email': 'Email',
      'contact.sidebar.phone': 'Phone',
      'contact.sidebar.location': 'Location',
      'contact.sidebar.location_val': 'Ibadan, Nigeria — working with clients worldwide',
      'contact.sidebar.chat': 'Chat on WhatsApp',
      'contact.calendly.eyebrow': 'Prefer to Talk?',
      'contact.calendly.heading': 'Book a Free 30-Minute Strategy Call',
      'contact.calendly.sub': 'Pick a time that works for you. No obligation — just a conversation about your project.',
      'contact.calendly.cta': 'Book Your Free Call',
      'contact.calendly.note': 'Takes 30 seconds. No credit card required.',

      /* Portfolio Page */
      'portfolio.page.eyebrow': 'Our Work',
      'portfolio.page.h1': 'Websites and apps we\'ve built for real businesses.',
      'portfolio.page.sub': 'Each project represents a different challenge — e-commerce, membership sites, blogs, lead generation, and custom web apps.',
      'portfolio.filter.all': 'All',
      'portfolio.filter.web': 'Websites',
      'portfolio.filter.ai': 'AI / Web3',
      'portfolio.filter.fullstack': 'Fullstack',
      'portfolio.filter.ecom': 'E-Commerce',
      'portfolio.filter.app': 'Web Apps',
      'portfolio.filter.seo': 'SEO',

      /* Page titles */
      'page.title.index': 'CleverStack — Full-Stack Web & App Development That Grows Revenue',
      'page.title.about': 'About CleverStack — Full-Stack Development Studio',
      'page.title.services': 'Services — Web, App, E-Commerce & SEO Development | CleverStack',
      'page.title.portfolio': 'Portfolio — Websites & Web Apps Built by CleverStack',
      'page.title.contact': 'Contact CleverStack — Book a Free Strategy Call',
      'page.title.privacy': 'Privacy Policy | CleverStack',
      'page.title.terms': 'Terms of Service | CleverStack',
      'page.title.404': 'Page Not Found | CleverStack',
      'page.title.blog': 'Blog — CleverStack',
      'blog.eyebrow': 'Insights',
      'blog.heading': 'Guides & insights for founders who ship.',
      'blog.sub': 'Web development, e-commerce, and growth tactics — written by the team that builds them.',
    },

    fr: {
      /* Navigation */
      'nav.home': 'Accueil',
      'nav.about': 'À propos',
      'nav.services': 'Services',
      'nav.portfolio': 'Réalisations',
      'nav.contact': 'Contact',
      'nav.blog': 'Blog',
      'nav.book_call': 'Réserver un appel',
      'nav.chat_wa': 'Discuter sur WhatsApp',
      'nav.lang_switch': 'EN',

      /* Hero (index) */
      'hero.eyebrow': 'Studio de développement Full-Stack',
      'hero.heading': 'Des sites et apps conçus pour <span class="hl">transformer vos visiteurs en revenus.</span><span class="typing-cursor"></span>',
      'hero.sub': 'Nous concevons, construisons et optimisons chaque couche de votre produit — frontend, backend, base de données et SEO — pour que votre site charge rapidement, soit bien classé et convertisse le trafic pour lequel vous payez déjà.',
      'hero.cta_primary': 'Appel gratuit',
      'hero.cta_secondary': 'Discuter sur WhatsApp',
      'hero.trust_label': 'Créé par Henry',
      'hero.trust_1': '200+ sites web',
      'hero.trust_2': '5+ ans',
      'hero.trust_3': 'Note 5.0',
      'hero.stack_caption': '$ déployer votre avantage concurrentiel',

      /* Trust Strip */
      'trust.heading': 'Ils nous font confiance',
      'trust.title': 'Des entreprises qui ont choisi CleverStack.',

      /* Benefits */
      'benefits.eyebrow': 'Pourquoi c\'est important',
      'benefits.heading': 'Chaque couche de votre stack au service de vos résultats.',
      'benefits.sub': 'Nous ne livrons pas que du code — nous construisons des résultats. Voici ce qui change quand votre site est bien construit.',
      'benefit.1.title': 'Temps de chargement réduits',
      'benefit.1.desc': 'Une architecture frontend optimisée fait que vos visiteurs restent au lieu de partir chez un concurrent.',
      'benefit.2.title': 'Design orienté conversion',
      'benefit.2.desc': 'Chaque page est structurée autour d\'un seul objectif : transformer une visite en appel ou en vente.',
      'benefit.3.title': 'Workflows automatisés',
      'benefit.3.desc': 'De la capture de leads à l\'exécution des commandes, nous connectons les outils qui vous font gagner des heures chaque semaine.',
      'benefit.4.title': 'Une infrastructure qui évolue',
      'benefit.4.desc': 'Votre app gère 10 ou 10 000 utilisateurs sans reconstruction — l\'architecture est bonne dès le premier jour.',

      /* Services Preview */
      'services_preview.eyebrow': 'Ce que nous construisons',
      'services_preview.heading': 'Une seule équipe, toutes les couches de la stack.',
      'services_preview.sub': 'Pas de transfert entre trois freelances différents. Nous planifions, construisons et livrons l\'intégralité du produit.',
      'service.1.tag': 'Frontend',
      'service.1.title': 'Développement Web',
      'service.1.desc': 'Sites marketing et pages d\'atterrissage rapides et responsifs conçus pour convertir — sur WordPress, Wix, Squarespace ou code personnalisé.',
      'service.2.tag': 'Backend',
      'service.2.title': 'Développement d\'apps Web',
      'service.2.desc': 'Tableaux de bord personnalisés, portails et outils internes construits avec React, Next.js, Node.js et Laravel.',
      'service.3.tag': 'Commerce',
      'service.3.title': 'Développement E-Commerce',
      'service.3.desc': 'Boutiques Shopify et WooCommerce conçues pour réduire les abandons de panier et augmenter le panier moyen.',
      'service.4.tag': 'Intégrations',
      'services.svc.5.tag': 'Croissance',
      'services.svc.6.tag': 'CMS',
      'services.svc.7.tag': 'Marketing',
      'services.svc.8.tag': 'Croissance',

      /* Portfolio Preview */
      'portfolio.eyebrow': 'Travaux récents',
      'portfolio.heading': 'Des produits que nous avons menés du brief au lancement.',
      'portfolio.view_all': 'Voir toutes les réalisations',

      /* Testimonials */
      'testimonials.eyebrow': 'Résultats clients',
      'testimonials.heading': 'Recommandé par des fondateurs qui voulaient plus qu\'« un site web ».',

      /* About Preview */
      'about_preview.eyebrow': 'Pourquoi CleverStack',
      'about_preview.heading': 'Un seul partenaire pour l\'ensemble du projet — pas trois prestataires qui se renvoient la balle.',
      'about_preview.sub': 'La plupart des agences vous font passer d\'un designer à un développeur puis à un spécialiste marketing. Nous maîtrisons frontend, backend, base de données et SEO sous un même toit.',
      'about_preview.cta_1': 'Notre histoire',
      'about_preview.cta_2': 'Voir les réalisations',
      'about_preview.stat_1': 'Projets livrés',
      'about_preview.stat_2': 'Livraison à temps',
      'about_preview.stat_3': 'Technologies maîtrisées',
      'about_preview.stat_4': 'Note client moyenne',

      /* ROI Calculator */
      'roi.eyebrow': 'Calculateur de ROI',
      'roi.heading': 'Combien vaut réellement votre site web ?',
      'roi.sub': 'Déplacez les curseurs. Découvrez ce qu\'un site optimisé pour la conversion pourrait ajouter à votre chiffre d\'affaires chaque mois.',
      'roi.visitors.label': 'Visiteurs mensuels du site',
      'roi.conv.label': 'Taux de conversion actuel',
      'roi.aov.label': 'Valeur moyenne par lead / vente',
      'roi.results.current': 'Revenu mensuel actuel',
      'roi.results.project': 'Avec CleverStack (est.)',
      'roi.results.diff': 'Revenu supplémentaire / mois',
      'roi.note': 'Hypothèse : +60 % de conversion après optimisation des performances et de la conversion. Estimations uniquement.',
      'roi.cta': 'Obtenir un audit gratuit',

      /* Final CTA */
      'cta.eyebrow': 'Construisons ensemble',
      'cta.heading': 'Vos concurrents ont déjà un site rapide et optimisé. Et vous ?',
      'cta.sub': 'Réservez un appel stratégique gratuit de 20 minutes. Nous auditerons votre site ou app et vous dirons exactement ce qui vous coûte des leads.',
      'cta.primary': 'Réserver un appel gratuit',
      'cta.secondary': 'Discuter sur WhatsApp',

      /* Footer */
      'footer.desc': 'Un studio de développement full-stack construisant des sites et applications web rapides et évolutifs pour les fondateurs et les entreprises en croissance.',
      'footer.quick_links': 'Liens rapides',
      'footer.link_home': 'Accueil',
      'footer.link_about': 'À propos',
      'footer.link_portfolio': 'Réalisations',
      'footer.link_blog': 'Blog',
      'footer.link_contact': 'Contact',
      'footer.link_privacy': 'Politique de confidentialité',
      'footer.link_terms': 'Conditions d\'utilisation',
      'footer.services': 'Services',
      'footer.svc_web': 'Développement Web',
      'footer.svc_app': 'Développement d\'apps',
      'footer.svc_ecom': 'E-Commerce',
      'footer.svc_cms': 'Développement CMS',
      'footer.svc_seo': 'SEO & Marketing',
      'footer.contact_heading': 'Contact',
      'footer.copyright': '© 2026 CleverStack. Tous droits réservés.',
      'footer.tagline': 'Construit avec la stack que nous vendons.',

      /* Cookie Banner */
      'cookie.text': 'Nous utilisons des cookies pour améliorer votre expérience et analyser le trafic du site. En continuant, vous acceptez notre utilisation des cookies. Lisez notre <a href="privacy.html">Politique de confidentialité</a> pour plus de détails.',
      'cookie.accept': 'Accepter',
      'cookie.reject': 'Refuser',

      /* Mobile CTA */
      'mobile.wa': 'WhatsApp',
      'mobile.book': 'Appel gratuit',

      /* Preloader */
      'preloader.loading': 'Chargement\u2026',

      /* 404 Page */
      '404.eyebrow': 'Erreur 404',
      '404.heading': 'Page introuvable',
      '404.sub': 'La page que vous recherchez n\'existe pas ou a été déplacée.',
      '404.cta_home': 'Retour à l\'accueil',
      '404.cta_book': 'Réserver un appel',
      '404.link_svcs': 'Services',
      '404.link_portfolio': 'Réalisations',
      '404.link_about': 'À propos',
      '404.link_privacy': 'Confidentialité',

      /* About Page */
      'about.eyebrow': 'À propos de CleverStack',
      'about.h1': 'J\'en avais assez de voir de bonnes entreprises tourner avec de mauvais sites web.',
      'about.lead': 'Je suis Henry — le fondateur et développeur principal de CleverStack. J\'ai lancé ce studio après des années de freelance sur Fiverr et de missions pour des entreprises qui avaient besoin de plus qu\'un « gars du web ».',
      'about.bio.heading': 'Développeur full-stack. 5+ ans. 200+ sites livrés.',
      'about.bio.p1': 'Je suis un développeur web full-stack qui aide les marques et les entreprises à créer, concevoir, réparer et optimiser des sites web à la fois esthétiques et performants.',
      'about.bio.p2': 'Que vous ayez besoin de réparer des mises en page, d\'optimiser le SEO, d\'intégrer l\'e-commerce ou de refaire entièrement votre site, je livre des solutions propres et optimisées pour la croissance.',
      'about.bio.see_portfolio': 'Voir les projets récents',
      'about.badge_num': '200+',
      'about.badge_txt': 'Sites livrés en 5+ ans',
      'about.experience.eyebrow': 'Expérience',
      'about.experience.heading': 'Construit pour de vraies entreprises, pas que des missions freelance.',
      'about.experience.sub': 'J\'ai livré des solutions full-stack pour des banques, des marques e-commerce et des startups aux États-Unis.',
      'about.exp.1.title': 'Développeur Frontend & CMS Headless',
      'about.exp.1.detail': 'Independent Bank Group — Mars 2023 - Présent. Applications frontend haute performance avec Next.js, React, Tailwind CSS et CMS headless.',
      'about.exp.2.title': 'Développeur Web Full-Stack',
      'about.exp.2.detail': 'Fiverr — Juillet 2022 - Présent. Applications web modernes, évolutives et orientées conversion avec Next.js, React, Node.js et PostgreSQL.',
      'about.exp.3.title': 'Développeur Web E-Commerce',
      'about.exp.3.detail': 'Store Fixtures Direct — Juin 2022 - Présent. Développement et optimisation de boutiques Shopify, WooCommerce et sites sur mesure.',
      'about.diff.eyebrow': 'Ce qui nous rend différents',
      'about.diff.heading': 'Quatre choses que la plupart des agences ne vous offrent pas.',
      'about.diff.1.title': 'Une seule équipe responsable',
      'about.diff.1.desc': 'La même personne qui conçoit votre site le construit, le livre et l\'optimise après le lancement — rien ne se perd entre les intermédiaires.',
      'about.diff.2.title': 'Des résultats business avant tout',
      'about.diff.2.desc': 'Nous mesurons le succès en leads, temps de chargement et taux de conversion — pas juste en « pages terminées ».',
      'about.diff.3.title': 'Flexible, pas verrouillé',
      'about.diff.3.desc': 'WordPress, Shopify, Wix, Squarespace ou React sur mesure — nous recommandons ce qui correspond à votre budget et à votre stade de croissance.',
      'about.diff.4.title': 'SEO et performance intégrés d\'origine',
      'about.diff.4.desc': 'La vitesse et la visibilité dans les moteurs de recherche sont conçues dès le premier jour, pas ajoutées après coup.',
      'about.skills.eyebrow': 'Compétences & Outils',
      'about.skills.heading': 'La stack complète, maîtrisée.',
      'about.skills.sub': 'Chaque couche d\'un produit web moderne, gérée en interne.',
      'about.cta.eyebrow': 'Travaillez avec nous',
      'about.cta.heading': 'Prêt à voir ce qu\'une équipe full-stack peut faire pour votre entreprise ?',
      'about.cta.sub': 'Réservez un appel gratuit — pas de pitch commercial, juste une conversation franche sur ce que votre site devrait faire pour vous.',
      'about.team.eyebrow': 'L\'équipe',
      'about.team.heading': 'Une équipe de spécialistes, pas un one-man show.',
      'about.team.sub': 'Design, développement, SEO et e-commerce — assurés par des experts qui le pratiquent chaque jour.',

      /* Services Page */
      'services.page.eyebrow': 'Services',
      'services.page.h1': 'Chaque couche de votre produit, construite par une seule équipe.',
      'services.page.sub': 'Des pixels que vos visiteurs voient à la base de données sur laquelle votre app tourne, nous concevons, construisons et optimisons toute la stack.',
      'services.svc.1.title': 'Développement Web',
      'services.svc.1.desc': 'Sites marketing et pages d\'atterrissage sur WordPress, Wix, Squarespace ou HTML/React sur mesure — rapides, responsifs et conçus pour convertir.',
      'services.svc.1.benefit': 'Avantage : plus de leads qualifiés par visiteur, sans dépenser plus en publicité.',
      'services.svc.2.title': 'Développement d\'apps Web',
      'services.svc.2.desc': 'Tableaux de bord, portails clients et outils internes avec React, Next.js, Node.js et Laravel — adaptés à votre fonctionnement.',
      'services.svc.2.benefit': 'Avantage : automatiser le travail manuel et passer à l\'échelle sans embauche.',
      'services.svc.3.title': 'Développement E-Commerce',
      'services.svc.3.desc': 'Boutiques Shopify et WooCommerce optimisées pour finaliser les achats — pages produits soignées, chargement rapide.',
      'services.svc.3.benefit': 'Avantage : réduire les abandons de panier et augmenter le panier moyen.',
      'services.svc.4.title': 'API & Intégrations',
      'services.svc.4.desc': 'Passerelles de paiement, CRM, suivi GTM/GA4, email marketing et API tierces connectées proprement.',
      'services.svc.4.benefit': 'Avantage : des données précises et moins de transferts manuels entre systèmes.',
      'services.svc.5.title': 'Optimisation & SEO',
      'services.svc.5.desc': 'SEO technique, Core Web Vitals et réglages de performance pour être trouvé sur Google et rester rapide.',
      'services.svc.5.benefit': 'Avantage : plus de trafic organique, sans budget publicitaire continu.',
      'services.svc.6.title': 'Développement & Migration CMS',
      'services.svc.6.desc': 'WordPress, Wix, Squarespace ou CMS headless (Sanity, Contentful) — nous construisons, migrons ou réparons des sites sur toute plateforme.',
      'services.svc.6.benefit': 'Avantage : contrôle éditorial complet sans frais de développement mensuels.',
      'services.svc.7.title': 'SEO & Marketing de recherche',
      'services.svc.7.desc': 'SEO on-page, audits techniques, stratégie de mots-clés, optimisation Google Business et SEO local.',
      'services.svc.7.benefit': 'Avantage : croissance prévisible du trafic organique sans dépenses publicitaires.',
      'services.svc.8.title': 'Marketing & Croissance Web',
      'services.svc.8.desc': 'Optimisation du taux de conversion, flux de capture d\'emails, configuration analytics (GA4/GSC), tests A/B.',
      'services.svc.8.benefit': 'Avantage : plus de revenus avec le même trafic que vous avez déjà.',
      'services.call_link': 'Réserver un appel',
      'services.process.eyebrow': 'Comment ça marche',
      'services.process.heading': 'Du premier appel au lancement, en quatre étapes.',
      'services.step.1': 'Appel découverte',
      'services.step.1.desc': 'Nous apprenons vos objectifs, vos difficultés et ce à quoi ressemble le « succès » en chiffres.',
      'services.step.2': 'Proposition & plan',
      'services.step.2.desc': 'Vous recevez un périmètre clair, un calendrier et un prix fixe — pas d\'estimations vagues à l\'heure.',
      'services.step.3': 'Construction & révision',
      'services.step.3.desc': 'Nous construisons par étapes avec des points réguliers pour que vous puissiez ajuster le cap tôt.',
      'services.step.4': 'Lancement & optimisation',
      'services.step.4.desc': 'Nous livrons, surveillons les performances et remettons la documentation — ou restons pour du support continu.',
      'services.pricing.eyebrow': 'Investissement',
      'services.pricing.heading': 'Prix clairs. Sans frais cachés.',
      'services.pricing.sub': 'Choisissez un forfait adapté à votre budget. Chaque formule inclut design responsive, bases SEO et garantie de satisfaction.',
      'services.pricing.cta': 'Commencer',
      'services.calc.eyebrow': 'Créez votre offre',
      'services.calc.heading': 'Vous ne savez pas ce qu\'il vous faut ? Créez un forfait personnalisé.',
      'services.calc.sub': 'Sélectionnez les services et fonctionnalités souhaités, et obtenez un prix instantané — sans engagement.',
      'services.calc.base': '1. Choisissez votre service de base',
      'services.calc.features': '2. Ajoutez des fonctionnalités',
      'services.calc.estimate': 'Votre devis',
      'services.calc.total': 'Total estimé',
      'services.calc.note': 'Ceci est une estimation. Le prix final est confirmé après un appel découverte.',
      'services.calc.note2': 'Sans engagement — nous discuterons de vos besoins.',
      'services.faq.eyebrow': 'Questions fréquentes',
      'services.faq.heading': 'Avant de réserver un appel.',
      'services.faq.1.q': 'Combien de temps prend un projet typique ?',
      'services.faq.1.a': 'Un site marketing prend généralement 2 à 4 semaines. Les apps web et l\'e-commerce prennent 4 à 10 semaines selon le périmètre.',
      'services.faq.2.q': 'Et si j\'ai déjà un site qui a juste besoin d\'être réparé ?',
      'services.faq.2.a': 'Nous reprenons régulièrement des sites existants — audit des performances, correction des dysfonctionnements et reconstruction de ce qui vous freine.',
      'services.faq.3.q': 'Travaillez-vous avec WordPress ou uniquement du code sur mesure ?',
      'services.faq.3.a': 'Les deux. Nous recommandons WordPress, Wix ou Squarespace quand cela correspond à votre budget, et React/Next.js sur mesure quand votre produit a besoin de plus de flexibilité.',
      'services.faq.4.q': 'Combien coûte un projet ?',
      'services.faq.4.a': 'Cela dépend du périmètre — une page d\'atterrissage et une app web multi-rôles sont tarifées très différemment. Nous donnons un devis fixe après l\'appel découverte.',
      'services.faq.5.q': 'Pourrai-je mettre à jour le site moi-même après le lancement ?',
      'services.faq.5.a': 'Oui. Nous construisons avec la gestion de contenu en tête et fournissons une courte formation pour que votre équipe puisse mettre à jour textes, images et produits.',
      'services.faq.6.q': 'Offrez-vous du support après le lancement ?',
      'services.faq.6.a': 'Oui — chaque projet inclut une fenêtre post-lancement, et nous proposons des forfaits de maintenance continue.',
      'services.cta.eyebrow': 'Commencez',
      'services.cta.heading': 'Dites-nous ce que vous construisez. Nous vous dirons ce qu\'il faut.',
      'services.cta.sub': 'Réservez un appel gratuit de 20 minutes et repartez avec un plan clair, que vous nous engagiez ou non.',

      /* Contact Page */
      'contact.page.eyebrow': 'Contact',
      'contact.page.h1': 'Parlons de ce que votre site web devrait faire pour vous.',
      'contact.page.sub': 'Parlez-nous un peu de votre projet. Nous répondons sous 24 heures ouvrées, sans obligation.',
      'contact.form.name': 'Nom',
      'contact.form.email': 'Email',
      'contact.form.phone': 'Téléphone',
      'contact.form.message': 'Message',
      'contact.form.name_placeholder': 'Votre nom complet',
      'contact.form.email_placeholder': 'vous@entreprise.com',
      'contact.form.phone_placeholder': '+234 800 000 0000',
      'contact.form.message_placeholder': 'Parlez-nous de votre projet, calendrier et budget.',
      'contact.form.privacy': 'Vos informations sont sécurisées. Nous ne vendons ni ne partageons vos données. Lisez notre <a href="privacy.html" style="color:var(--indigo); text-decoration:underline;">Politique de confidentialité</a>.',
      'contact.form.submit': 'Envoyer le message',
      'contact.form.sending': 'Envoi en cours\u2026',
      'contact.form.success': 'Message envoyé',
      'contact.form.success_msg': 'Merci ! Nous répondrons sous 24 heures.',
      'contact.form.fail': 'Échec',
      'contact.sidebar.eyebrow': 'Contact direct',
      'contact.sidebar.email': 'Email',
      'contact.sidebar.phone': 'Téléphone',
      'contact.sidebar.location': 'Localisation',
      'contact.sidebar.location_val': 'Ibadan, Nigéria — clients dans le monde entier',
      'contact.sidebar.chat': 'Discuter sur WhatsApp',
      'contact.calendly.eyebrow': 'Vous préférez parler ?',
      'contact.calendly.heading': 'Réservez un appel stratégique gratuit de 30 minutes',
      'contact.calendly.sub': 'Choisissez un créneau qui vous convient. Aucune obligation — juste une conversation sur votre projet.',
      'contact.calendly.cta': 'Réserver votre appel gratuit',
      'contact.calendly.note': '30 secondes suffisent. Carte de crédit non requise.',

      /* Portfolio Page */
      'portfolio.page.eyebrow': 'Nos réalisations',
      'portfolio.page.h1': 'Sites web et apps que nous avons construits pour de vraies entreprises.',
      'portfolio.page.sub': 'Chaque projet représente un défi différent — e-commerce, site d\'adhésion, blog, génération de leads et apps web sur mesure.',
      'portfolio.filter.all': 'Tous',
      'portfolio.filter.web': 'Sites web',
      'portfolio.filter.ai': 'IA / Web3',
      'portfolio.filter.fullstack': 'Fullstack',
      'portfolio.filter.ecom': 'E-Commerce',
      'portfolio.filter.app': 'Apps Web',
      'portfolio.filter.seo': 'SEO',

      /* Page titles */
      'page.title.index': 'CleverStack — Développement Web & Apps Full-Stack',
      'page.title.about': 'À propos de CleverStack — Studio de développement Full-Stack',
      'page.title.services': 'Services — Développement Web, App, E-Commerce & SEO | CleverStack',
      'page.title.portfolio': 'Réalisations — Sites Web & Apps par CleverStack',
      'page.title.contact': 'Contact CleverStack — Réserver un appel stratégique gratuit',
      'page.title.privacy': 'Politique de confidentialité | CleverStack',
      'page.title.terms': 'Conditions d\'utilisation | CleverStack',
      'page.title.404': 'Page introuvable | CleverStack',
      'page.title.blog': 'Blog — CleverStack',
      'blog.eyebrow': 'Actualités',
      'blog.heading': 'Guides et conseils pour les fondateurs qui lancent.',
      'blog.sub': 'Développement web, e-commerce et croissance — écrits par l\'équipe qui les construit.',
    }
  };

  function get(key) {
    return dict[lang.current] && dict[lang.current][key] !== undefined ? dict[lang.current][key] : (dict.en[key] || '');
  }

  function setLang(code) {
    if (dict[code]) {
      lang.current = code;
      localStorage.setItem(key, code);
      document.documentElement.setAttribute('lang', code === 'fr' ? 'fr' : 'en');
      translatePage();
      updateLangToggle();
    }
  }

  function getSavedLang() {
    var saved = localStorage.getItem(key);
    if (saved && dict[saved]) return saved;
    return 'en';
  }

  function init() {
    var saved = getSavedLang();
    lang.current = saved;
    document.documentElement.setAttribute('lang', saved === 'fr' ? 'fr' : 'en');
  }

  function translatePage() {
    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      var key = el.getAttribute('data-i18n');
      var translation = get(key);
      if (translation) {
        if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
          var placeholderKey = el.getAttribute('data-i18n-placeholder');
          if (placeholderKey) {
            var ph = get(placeholderKey);
            if (ph) el.setAttribute('placeholder', ph);
          } else {
            el.value = translation;
          }
        } else if (el.tagName === 'META') {
          el.setAttribute('content', translation);
        } else if (el.tagName === 'TITLE') {
          el.textContent = translation;
        } else {
          el.innerHTML = translation;
        }
      }
    });
  }

  function updateLangToggle() {
    var btn = document.querySelector('.lang-toggle');
    if (btn) {
      var next = lang.current === 'en' ? 'fr' : 'en';
      btn.textContent = get('nav.lang_switch');
      btn.setAttribute('aria-label', 'Switch to ' + (next === 'fr' ? 'French' : 'English'));
    }
  }

  return {
    init: init,
    get: get,
    setLang: setLang,
    getLang: function () { return lang.current; },
    translatePage: translatePage,
    updateLangToggle: updateLangToggle,
    getSavedLang: getSavedLang,
  };
})();
