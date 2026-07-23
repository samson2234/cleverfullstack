# CleverStack — Full-Stack Web & App Development Studio

A static marketing website for CleverStack, a full-stack development studio based in Ibadan, Nigeria. Built for international ad campaigns — this site must convert visitors into booked calls and paying clients across borders.

---

## Pages

| Page | File | Description |
|------|------|-------------|
| Home | `index.html` | Landing page with hero, benefits, services preview, portfolio preview, testimonials |
| About | `about.html` | Company story, mission/vision, differentiators, team |
| Services | `services.html` | Service cards, pricing tiers, FAQ accordion |
| Portfolio | `portfolio.html` | Project showcase with category filters |
| Contact | `contact.html` | Contact form, direct contact info |

## Tech Stack

- **HTML5** — Semantic markup
- **CSS3** — Custom properties, Grid, Flexbox, animations
- **JavaScript** — Vanilla, no dependencies
- **Hosting** — Vercel (static)

## Getting Started

Open `index.html` in a browser — no build step required.

## Deployment

Connect the repo to [Vercel](https://vercel.com) for automatic deployments on every push.

---

# FULL WEBSITE AUDIT & IMPROVEMENT PLAN

> **Purpose:** Comprehensive audit of faults, layout improvements, color system, frontend/backend features, SEO, ad-readiness, and step-by-step implementation roadmap. Each section is a checklist item you can complete and validate through CI/CD (lint, build, deploy preview).

---

## Table of Contents

1. [Critical Faults](#1-critical-faults)
2. [Color System — Optimized Palette](#2-color-system--optimized-palette)
3. [Layout & UX Improvements](#3-layout--ux-improvements)
4. [Frontend Functionality Improvements](#4-frontend-functionality-improvements)
5. [Backend Functionality Needed](#5-backend-functionality-needed)
6. [SEO & International Readiness](#6-seo--international-readiness)
7. [Ad-Readiness Checklist](#7-ad-readiness-checklist)
8. [Competitive Benchmarks](#8-competitive-benchmarks)
9. [Implementation Roadmap (Sprints)](#9-implementation-roadmap-sprints)
10. [CI/CD Validation Rules](#10-cicd-validation-rules)

---

## 1. Critical Faults

### 1.1 Conversion & Trust Killers

- [ ] **Working contact form** — Current form (`script.js:176-191`) is front-end only, shows "Message sent" with no backend. Every ad dollar producing zero leads. Fix: Add Formspree, Web3Forms, or Vercel Serverless Function.
- [ ] **Real client logos** — All current logos (Orbital Finance, Northloom Studio, Marlow & Reid, Fieldwork Ops, Havenpoint Realty, Bare Botanicals) are fictional. Sophisticated buyers will Google them and find nothing. Fix: Replace with real client logos with permission, or remove the strip entirely.
- [ ] **Real testimonials** — All testimonials (Amara Chukwu, David Reyes, Priya Anand) are fabricated with Unsplash stock photos. Research shows video testimonials with specific results lift conversion 24-34%. Fix: Collect real testimonials or remove fake ones.
- [ ] **Real project case studies** — Portfolio items use Unsplash stock images with no actual client work, no metrics, no "before/after". Case studies with specific metrics convert 20-35% better. Fix: Replace with real projects or detailed case study pages with quantified outcomes.
- [ ] **Real phone number** — "+234 000 000 0000" on every page footer and contact page. 67% of users abandon sites without visible real contact info. Fix: Replace with actual phone number.
- [ ] **Real email address** — Verify `hello@cleverstack.dev` is functional and monitored.

### 1.2 Missing Critical Pages

- [ ] **Privacy Policy page** (`privacy.html`) — Required for GDPR compliance (EU/UK ad traffic), Meta Ads, Google Ads.
- [ ] **Terms of Service page** (`terms.html`) — Required for ad platform compliance.
- [ ] **404 error page** (`404.html`) — Custom branded page with navigation back to home. Vercel supports this via `rewrites` in `vercel.json`.
- [ ] **Case Studies page** (`case-studies.html`) — Individual detailed pages per project with metrics, process, and outcomes.

### 1.3 Missing Legal & Compliance

- [ ] **Cookie consent banner** — Vanilla JS banner with accept/reject. Store preference in `localStorage`. Required for EU/UK traffic from ads.
- [ ] **GDPR-compliant data handling** — Clear statement near contact form: "We do not sell your email or share it with partners."
- [ ] **Real address/company registration info** in footer — Required for Meta Ads and builds trust.

---

## 2. Color System — Optimized Palette

Your current indigo/teal/coral palette is already distinctive and aligns with 2026 research on standing out from generic blue. Here is the optimized system:

### 2.1 Recommended CSS Custom Properties

```css
:root {
  /* PRIMARY — Trust + Authority (keep, already strong) */
  --indigo:        #4F46E5;  /* Main brand — not generic blue, memorable */
  --indigo-dark:   #3730A3;  /* Add — hover states, darker variant */
  --indigo-light:  #7C74F0;  /* Keep — lighter variant */

  /* SECONDARY — Action + Growth */
  --teal:          #00C2A8;  /* Keep — CTA contrast, signals growth */
  --teal-dark:     #00A68E;  /* Add — hover state */
  --teal-light:    #33D4BC;  /* Add — light backgrounds */

  /* ACCENT — Urgency + Personality */
  --coral:         #FF6B4A;  /* Keep — use sparingly for urgency */

  /* DARKS — Authority */
  --ink:           #0E1330;  /* Keep — deep navy, authoritative */
  --ink-2:         #171D45;  /* Keep */
  --ink-3:         #232A5E;  /* Keep */

  /* LIGHTS — Clean foundation */
  --paper:         #F6F7FB;  /* Keep — clean, not stark white */
  --paper-2:       #FFFFFF;  /* Keep */
  --paper-3:       #ECEEF7;  /* Keep */

  /* TEXT */
  --text-dark:     #10142B;  /* Keep */
  --text-muted:    #5B6079;  /* Keep */
  --text-light:    #C7CBE8;  /* Keep */

  /* NEW — Semantic Colors */
  --success:       #10B981;  /* Trust signals, checkmarks */
  --warning:       #F59E0B;  /* Attention indicators */
  --error:         #EF4444;  /* Form validation errors */
}
```

### 2.2 Why This Works for International Ads

- **Indigo over blue** — 70%+ of SaaS uses generic blue. #4F46E5 signals trust while being memorable across cultures
- **Teal CTA** — Green-spectrum CTAs perform 15-31% better for service businesses (research-backed)
- **Coral sparingly** — Only for urgency: "3 spots left this month", pricing highlights, critical notifications
- **Deep navy dark mode** — More authoritative than pure black, less harsh for international audiences browsing at night

### 2.3 Color Usage Rules

- [ ] CTAs use `--teal` or `--indigo` gradient — never `--coral` as primary button color
- [ ] `--coral` reserved for max 1-2 elements per page (urgency badges, notification dots)
- [ ] All text meets WCAG AA contrast ratio (4.5:1 minimum)
- [ ] Focus states visible on all interactive elements (keyboard accessibility)

---

## 3. Layout & UX Improvements

### 3.1 Homepage Above-the-Fold (7-Second Test)

The hero must pass this test in 7 seconds: "What do you do, for whom, why should I trust you, and what do I do next?"

- [ ] **Headline** — Current is good: "turn visitors into revenue" (outcome-first). Keep.
- [ ] **Add real client logo strip immediately below hero** — 5-7 recognizable logos with permission. Research: 7-14% conversion lift.
- [ ] **Add founder photo + 1-line bio near CTA** — Research: 15-30% conversion lift. Move from About page to homepage.
- [ ] **Two CTAs above fold** — Primary: "Book a Free 20-Minute Audit Call" (high-commitment). Secondary: "See Our Case Studies" (low-commitment, for evaluators).
- [ ] **Trust badge under headline** — "30+ projects shipped | 98% on-time delivery | 5.0 avg rating" (quantified credibility).

### 3.2 Trust Signal Placement Hierarchy

Research-backed placement (signals convert 18-28% when near CTA vs 2-5% in footer):

- [ ] **Above fold:** Logo strip + one quantified result
- [ ] **Adjacent to CTA:** Video testimonial OR text testimonial with real photo + specific metrics
- [ ] **Mid-page:** Case study card with "Before → After" metrics
- [ ] **Near contact form:** "We respond within 4 business hours" + real phone number
- [ ] **Footer:** Full credentials list, social links, legal links

### 3.3 New Sections to Add

- [ ] **"As Featured In" press/media strip** — Even 3-5 mentions lift conversion 8-13%
- [ ] **Real-time activity indicator** — "Last project delivered: 3 days ago" (5-12% lift)
- [ ] **ROI Calculator widget** — Interactive tool showing potential savings/leads
- [ ] **Process timeline** — Visual "How We Work" with milestones
- [ ] **Client success metrics** — Before/after dashboard screenshots with real data

### 3.4 Inner Pages

- [ ] **Services page** — Add comparison table (Our approach vs typical agency), ROI metrics per service
- [ ] **Portfolio page** — Transform each card into mini case study with metrics (traffic before/after, conversion rate, load time)
- [ ] **Contact page** — Add Calendly/Cal.com embed for instant booking alongside form
- [ ] **About page** — Add founder video (60 seconds), team LinkedIn links, company timeline/milestones

---

## 4. Frontend Functionality Improvements

### 4.1 Must-Have (Before Running Ads)

- [ ] **Working contact form** — Add Formspree (`https://formspree.io/f/YOUR_ID`) or Vercel Serverless Function
- [ ] **Calendly/scheduling embed** — Add to contact page and as popup CTA (reduces friction 40-60%)
- [ ] **Cookie consent banner** — Lightweight vanilla JS with accept/reject. Store in `localStorage`. Required for EU/UK.
- [ ] **WhatsApp floating button** — Huge for Nigeria + international. Use `https://wa.me/234XXXXXXXXXX`
- [ ] **Live chat widget** — Tawk.to (free) or Crisp for real-time engagement
- [ ] **404 page** — Custom branded with navigation
- [ ] **Smooth scroll offset** — Fix anchor scrolling with fixed header (currently no offset calculation)
- [ ] **Page preloader** — Minimal branded loading screen (show only on first visit, cache in sessionStorage)

### 4.2 Should-Have (Post-Launch)

- [ ] **Dark mode toggle** — CSS custom properties already support it. Add `prefers-color-scheme` detection + manual toggle with `localStorage` persistence
- [ ] **Multi-language support** — English + French (West Africa + Europe). Use `hreflang` tags for SEO
- [ ] **Scroll progress indicator** — Thin bar at top showing page scroll progress
- [ ] **Back-to-top button** — Appears after scrolling past hero
- [ ] **Skeleton loading screens** — For any dynamic content
- [ ] **Image lightbox** — For portfolio items (click to expand full screenshot)
- [ ] **Before/after slider** — For case studies showing site before vs after CleverStack work

### 4.3 Advanced (Month 2+)

- [ ] **GSAP scroll animations** — Replace simple CSS reveals with production-grade scroll-triggered animations
- [ ] **3D interactive hero** — WebGL/Three.js element showing tech stack (inspired by Lusion/Up Digital)
- [ ] **Micro-interactions** — Button hover states, card tilt on mouse move, cursor effects
- [ ] **Page transitions** — View Transitions API for smooth page-to-page navigation

---

## 5. Backend Functionality Needed

### 5.1 Phase 1: Lead Capture (Before Ads)

- [ ] **Contact form backend** — Vercel Serverless Function + Resend/SendGrid for email delivery. Or Formspree/Netlify Forms for zero-code.
- [ ] **Email auto-responder** — Instant confirmation: "We received your message. Expect response within 24 business hours."
- [ ] **Lead notification** — Email/SMS alert to team on form submission
- [ ] **Calendly integration** — Free tier handles scheduling, timezone conversion, calendar sync

### 5.2 Phase 2: Content & SEO

- [ ] **Blog system** — Static blog using Eleventy, Hugo, or Astro. Markdown-based. Critical for SEO.
- [ ] **Sitemap generation** — Auto-generate `sitemap.xml` for Google Search Console
- [ ] **RSS feed** — For blog subscribers
- [ ] **Structured data** — JSON-LD for FAQ, Service, LocalBusiness, BreadcrumbList, AggregateRating
- [ ] **OG image generation** — Auto-generate branded Open Graph images for each page/blog post

### 5.3 Phase 3: Analytics & Optimization

- [ ] **Conversion tracking** — GA4 events: form_submission, cta_click, page_view, scroll_depth
- [ ] **Heatmap tracking** — Microsoft Clarity (free) or Hotjar
- [ ] **A/B testing** — Test headlines, CTAs, layouts with real data
- [ ] **Uptime monitoring** — BetterStack or UptimeRobot
- [ ] **Performance monitoring** — Web Vitals tracking (LCP, FID, CLS)

---

## 6. SEO & International Readiness

### 6.1 Technical SEO

- [ ] **XML Sitemap** — Create `sitemap.xml` and submit to Google Search Console + Bing Webmaster Tools
- [ ] **Robots.txt** — Add proper `robots.txt` with sitemap reference
- [ ] **Canonical URLs** — Add `<link rel="canonical">` to every page to prevent duplicate content
- [ ] **Meta robots** — Ensure `index, follow` on all public pages
- [ ] **Hreflang tags** — Prepare for multi-language: `<link rel="alternate" hreflang="en" href="...">`
- [ ] **Internal linking** — Link between pages contextually (services → portfolio, portfolio → case studies)

### 6.2 Schema Markup

- [ ] **FAQPage schema** — For services.html FAQ section (already has 6 questions)
- [ ] **Service schema** — For each service offered
- [ ] **LocalBusiness schema** — For Nigeria office location
- [ ] **BreadcrumbList schema** — For all inner pages
- [ ] **AggregateRating schema** — For testimonials/reviews
- [ ] **Organization schema** — Already exists on index.html, enhance with sameAs social links

### 6.3 Content SEO

- [ ] **Blog posts** — 4-6 posts targeting keywords: "web development Nigeria", "full-stack agency", "Shopify developer Africa", etc.
- [ ] **Case study pages** — Each with H1 targeting service + industry keywords
- [ ] **Meta descriptions** — Include CTA language ("Book a free call") on every page
- [ ] **Alt text audit** — Ensure all images have descriptive, keyword-relevant alt text

### 6.4 Performance SEO

- [ ] **Image optimization** — Convert all Unsplash images to WebP/AVIF, serve via CDN, add `srcset` for responsive sizes
- [ ] **Core Web Vitals** — Target LCP < 2.5s, FID < 100ms, CLS < 0.1
- [ ] **Preload critical resources** — Hero image, above-fold CSS
- [ ] **Font optimization** — Use `font-display: swap` (already set), consider subsetting fonts
- [ ] **Minification** — Minify CSS and JS for production

---

## 7. Ad-Readiness Checklist

Before running international ad campaigns (Meta, Google, LinkedIn):

### Legal & Compliance
- [ ] Privacy Policy page live and accessible
- [ ] Terms of Service page live
- [ ] Cookie consent banner functional
- [ ] GDPR compliance for EU/UK traffic
- [ ] Real company address in footer

### Conversion Infrastructure
- [ ] Working contact form with email delivery
- [ ] Real phone number displayed (replace "+234 000 000 0000")
- [ ] Calendly or instant booking option
- [ ] WhatsApp button for quick contact

### Tracking & Analytics
- [ ] GA4 installed and configured
- [ ] Conversion events: form_submission, cta_click, booking_confirmed
- [ ] Meta Pixel installed (for Facebook/Instagram ads)
- [ ] Google Ads conversion tag installed
- [ ] Microsoft Clarity or Hotjar for heatmaps

### Content Quality
- [ ] All fake client logos removed or replaced with real ones
- [ ] All fake testimonials removed or replaced with real ones
- [ ] At least 2-3 real case studies with specific metrics
- [ ] Branded OG images for social ad previews
- [ ] Real project screenshots (not Unsplash stock)

### Technical
- [ ] Mobile-optimized (test on 320px width minimum)
- [ ] Page load under 3 seconds on mobile
- [ ] Favicon + apple-touch-icon working
- [ ] 404 page branded and functional
- [ ] HTTPS enforced site-wide (Vercel default)

### Ad Platform Requirements
- [ ] Meta Pixel base code on all pages
- [ ] Meta Conversions API (server-side) for iOS tracking
- [ ] Google Ads conversion linker tag
- [ ] UTM parameter handling in analytics
- [ ] Landing page speed score > 80 on PageSpeed Insights

---

## 8. Competitive Benchmarks

Study these agency websites for design/UX inspiration:

| Agency | URL | Why Study Them |
|--------|-----|----------------|
| Clay | clay.global | Clean layout, high-quality project visuals, intuitive navigation |
| Baunfire | baunfire.com | Minimalist design, bold typography, strong portfolio presentation |
| Lusion | lusion.co | WebGL/3D effects, immersive hero, award-winning visual design |
| Noomo Agency | noomo.agency | AI/3D/AR integration, futuristic aesthetic, shows capability through site |
| Major Tom | majortom.com | Strategy + creativity positioning, strong case studies |
| Propeller | propeller.co.uk | Bold visuals, clear service paths, performance-led case studies |
| Up Digital | updigital.co | Awwwards nominee — interactive elements, AI-powered creativity |
| Humaan | humaan.com | Award-winning design, websites, apps, digital products since 2010 |
| Crowd | thisis crowd.com | Global marketing, clear design, accent color for CTAs |
| Bleech | bleech.de | Cold blue/green tones, WordPress expertise, super-efficient display |

---

## 9. Implementation Roadmap (Sprints)

### Sprint 1 — Emergency Fixes (Week 1)

> Goal: Make the site functional for ad traffic. Without this, ad spend is wasted.

- [ ] **1.1** Add working contact form (Formspree or Vercel Serverless Function)
- [ ] **1.2** Replace "+234 000 000 0000" with real phone number on all pages
- [ ] **1.3** Create `privacy.html` — Privacy Policy page
- [ ] **1.4** Create `terms.html` — Terms of Service page
- [ ] **1.5** Add cookie consent banner (vanilla JS + `localStorage`)
- [ ] **1.6** Create `404.html` — Custom branded 404 page
- [ ] **1.7** Verify `hello@cleverstack.dev` is functional
- [ ] **1.8** Add real company address to footer (replace "Ibadan, Nigeria" with actual address)

**Validation:** `vercel build` passes, all pages load, form submits successfully, 404 page renders on invalid URL.

### Sprint 2 — Trust & Conversion (Week 2-3)

> Goal: Replace all fake content with real proof. This is the #1 factor in conversion.

- [ ] **2.1** Remove all fake client logos OR replace with real ones (with written permission)
- [ ] **2.2** Remove all fake testimonials OR replace with real ones (full names, company, real photos)
- [ ] **2.3** Remove fake portfolio items OR replace with real project screenshots
- [ ] **2.4** Write 2-3 real case studies with specific metrics (traffic, conversion, load time improvements)
- [ ] **2.5** Add founder bio + real photo near primary CTAs on homepage
- [ ] **2.6** Add Calendly embed to contact page
- [ ] **2.7** Add "As Featured In" strip (only with real mentions)
- [ ] **2.8** Add WhatsApp floating button

**Validation:** All placeholder/fake content is either removed or replaced. Form submission sends real email. Calendly booking works.

### Sprint 3 — SEO & Performance (Week 3-4)

> Goal: Rank on Google and pass Core Web Vitals.

- [ ] **3.1** Create `sitemap.xml` with all pages
- [ ] **3.2** Create `robots.txt` with sitemap reference
- [ ] **3.3** Add FAQPage schema to services.html
- [ ] **3.4** Add Service schema for each service
- [ ] **3.5** Add LocalBusiness schema
- [ ] **3.6** Add BreadcrumbList schema to all inner pages
- [ ] **3.7** Add `<link rel="canonical">` to every page
- [ ] **3.8** Optimize all images (WebP format, proper `width`/`height` attributes, `loading="lazy"`)
- [ ] **3.9** Add internal links between pages (services ↔ portfolio ↔ case studies)
- [ ] **3.10** Submit sitemap to Google Search Console + Bing Webmaster Tools

**Validation:** Lighthouse score > 90 on all pages. All schema validates via Google Rich Results Test. Sitemap accessible at `/sitemap.xml`.

### Sprint 4 — Analytics & Ads (Week 4)

> Goal: Track every visitor action and be ready to run paid campaigns.

- [ ] **4.1** Install GA4 + configure conversion events
- [ ] **4.2** Install Meta Pixel on all pages
- [ ] **4.3** Install Google Ads conversion tag
- [ ] **4.4** Set up Microsoft Clarity for heatmaps (free)
- [ ] **4.5** Create branded OG images for all pages
- [ ] **4.6** Add UTM parameter handling
- [ ] **4.7** Test Meta Pixel fires correctly (use Meta Pixel Helper extension)
- [ ] **4.8** Test GA4 events fire correctly (use GA4 DebugView)
- [ ] **4.9** Set up uptime monitoring (BetterStack or UptimeRobot)

**Validation:** Meta Pixel Helper shows all events firing. GA4 DebugView shows form_submission events. PageSpeed Insights score > 80.

### Sprint 5 — Enhancement (Month 2+)

> Goal: Differentiate from competitors with premium features.

- [ ] **5.1** Add blog section (static site generator or manual HTML)
- [ ] **5.2** Add French language version (`fr/index.html`, etc.)
- [ ] **5.3** Add dark mode toggle
- [ ] **5.4** Upgrade animations to GSAP or Framer Motion
- [ ] **5.5** Add interactive ROI calculator
- [ ] **5.6** Add before/after sliders for case studies
- [ ] **5.7** Add image lightbox for portfolio
- [ ] **5.8** Add page transition effects (View Transitions API)
- [ ] **5.9** Add 3D/interactive hero element (WebGL/Three.js)
- [ ] **5.10** Consider migration to Next.js/Astro for SSR, ISR, and better SEO

**Validation:** All new features functional on mobile and desktop. No accessibility regressions. Lighthouse scores maintained > 90.

---

## 10. CI/CD Validation Rules

Every push should be validated automatically. Add these checks:

### Automated Checks (GitHub Actions / Vercel)

```yaml
# Example GitHub Actions workflow (.github/workflows/validate.yml)
name: Validate
on: [push, pull_request]
jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: HTML Validation
        run: npx html-validate "**/*.html"

      - name: CSS Validation
        run: npx stylelint "**/*.css"

      - name: JavaScript Lint
        run: npx eslint "**/*.js"

      - name: Check for placeholder content
        run: |
          ! grep -r "000 000 0000" *.html
          ! grep -r "Unsplash" *.html
          ! grep -r "Lorem ipsum" *.html

      - name: Check for real contact info
        run: grep -r "mailto:" *.html
        run: grep -r "tel:" *.html

      - name: Check all pages exist
        run: |
          test -f index.html
          test -f about.html
          test -f services.html
          test -f portfolio.html
          test -f contact.html
          test -f privacy.html
          test -f terms.html
          test -f 404.html
          test -f sitemap.xml
          test -f robots.txt

      - name: Check no broken internal links
        run: npx html-validate --rules link-check **/*.html

      - name: Lighthouse CI
        run: npx lhci autorun
        # Tests: Performance > 90, Accessibility > 90, Best Practices > 90, SEO > 90
```

### Manual Validation Checklist

After each sprint, verify:

- [ ] All pages load without console errors
- [ ] Contact form submits and sends email
- [ ] No placeholder text ("000 000 0000", "Lorem ipsum", stock content)
- [ ] All images have alt text
- [ ] Mobile responsive (test 320px, 768px, 1024px, 1440px)
- [ ] Keyboard navigation works (Tab through all interactive elements)
- [ ] Screen reader friendly (test with VoiceOver or NVDA)
- [ ] Page load < 3 seconds on 3G
- [ ] Lighthouse score > 90 across all categories

### Post-Sprint Deployment Verification

After each sprint merge to `main`:

1. Vercel auto-deploys preview URL
2. Run Lighthouse on preview URL
3. Test contact form on preview URL
4. Verify no visual regressions (screenshot comparison)
5. Merge to production after approval

---

## Color Palette Quick Reference

```
Primary:    #4F46E5 (Indigo)     — Trust, authority, brand anchor
Secondary:  #00C2A8 (Teal)       — CTAs, growth, success states
Accent:     #FF6B4A (Coral)      — Urgency, notifications, highlights

Dark BG:    #0E1330 (Ink)        — Hero, footer, dark sections
Dark Card:  #171D45 (Ink 2)      — Elevated dark surfaces
Light BG:   #F6F7FB (Paper)      — Default page background
White:      #FFFFFF (Paper 2)    — Card backgrounds

Text:       #10142B (Dark)       — Primary text
Muted:      #5B6079 (Muted)      — Secondary text
Light:      #C7CBE8 (Light)      — Text on dark backgrounds

Success:    #10B981 (Green)      — Checkmarks, positive states
Warning:    #F59E0B (Amber)      — Attention, caution
Error:      #EF4444 (Red)        — Form errors, critical alerts
```

---

## File Structure (Target)

```
cleverstack/
  index.html              # Home
  about.html              # About
  services.html           # Services + pricing + FAQ
  portfolio.html          # Portfolio showcase
  contact.html            # Contact form + Calendly
  case-studies.html       # Detailed case studies (NEW)
  privacy.html            # Privacy Policy (NEW)
  terms.html              # Terms of Service (NEW)
  blog.html               # Blog listing (NEW - Sprint 5)
  404.html                # Custom 404 (NEW)
  style.css               # Main stylesheet
  script.js               # Main JavaScript
  sitemap.xml             # XML Sitemap (NEW)
  robots.txt              # Robots file (NEW)
  favicon.ico             # Proper favicon (NEW)
  apple-touch-icon.png    # Apple touch icon (NEW)
  og-image.png            # Branded OG image (NEW)
  vercel.json             # Vercel config
  README.md               # This file
  .github/
    workflows/
      validate.yml        # CI/CD validation (NEW)
```

---

## License

All rights reserved. &copy; 2026 CleverStack
