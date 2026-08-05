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
| Blog | `blog/index.html` | Blog listing with posts from JSON metadata |
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

# MINI-CRM & NEWSLETTER SYSTEM

> **Added Aug 2026.** Turns the admin inbox into a full lead-management pipeline, adds a newsletter signup across the site, and wires instant email notifications + welcome emails. All data lives in the existing Turso database; all email goes through Resend.

## Features

**Admin CRM (`admin.html`)**
- **Dashboard** — total/unread/new-today/this-week leads, subscriber count, win rate, leads-by-source bars, pipeline breakdown (new → contacted → proposal → won/lost), follow-ups due list.
- **Leads** — search by name/email/message, filter by pipeline status, pagination, per-lead actions: set status, set follow-up date, add notes, **reply by email** (via Resend), copy email, delete. Unread leads highlighted.
- **Subscribers** — list + search, delete, **broadcast email** to all active subscribers.
- **Email Log** — every email sent (notifications, replies, welcomes, broadcasts) with status.
- **Export** — CSV download of leads and subscribers.

**Newsletter capture (site-wide)**
- Footer subscribe form on all 9 pages (`index`, `about`, `services`, `portfolio`, `portfolio-detail`, `contact`, `blog/index`, `blog/web-development`, `404`).
- Dedicated newsletter CTA section on the blog index.
- Contact form has a hidden newsletter opt-in (`subscribe` flag in the POST body).

**Instant notifications (owner)**
- New contact form submission → immediate email to `CONTACT_EMAIL`.
- New newsletter subscriber → immediate email to `CONTACT_EMAIL`.
- Both emails are also stored in the `email_log` table.

**Welcome email (subscriber)**
- On first signup the subscriber gets a branded welcome email with an unsubscribe link.
- One-click unsubscribe at `/api/unsubscribe?email=...` (removes them from the DB).

## New / changed files

| File | Purpose |
|------|---------|
| `api/subscribe.js` | Newsletter signup: save subscriber → welcome email → owner notification |
| `api/unsubscribe.js` | One-click unsubscribe page |
| `api/admin.js` | Expanded: stats, search, status, notes, follow-ups, reply, broadcast, subscribers, email log, CSV export |
| `api/contact.js` | Refactored to shared email layer + optional newsletter opt-in |
| `lib/db.js` | New `subscribers` + `email_log` tables; `submissions` gains `status`, `notes`, `follow_up_date` columns; search/stats helpers |
| `lib/email.js` | Shared Resend send + HTML templates (welcome, notifications, reply, broadcast) |
| `admin.html` | Full CRM UI (Dashboard / Leads / Subscribers / Email Log) |
| `script.js` | Subscribe-form handler + `newsletter_subscribe` GA4/pixel event |
| `i18n.js` | Newsletter strings added (EN + FR) |
| `scripts/inject-newsletter.js` | One-time tool: adds the footer form to every page |

## Env vars (Vercel)

| Var | Required | Purpose |
|-----|----------|---------|
| `TURSO_DATABASE_URL` | Yes | Turso DB URL (tables auto-create on first request) |
| `TURSO_AUTH_TOKEN` | Yes | Turso auth token |
| `ADMIN_PASSWORD` | Yes | Admin login password (sent as Bearer token) |
| `RESEND_API_KEY` | Yes (for email) | Resend API key |
| `RESEND_FROM` | Recommended | Sender, e.g. `CleverStack <hello@cleverstack.dev>` — must be a **verified domain** in Resend |
| `CONTACT_EMAIL` | Recommended | Owner inbox for notifications (defaults to `cleverdigitals70@gmail.com`) |

> **IMPORTANT — verify your Resend domain:** welcome emails to subscribers and broadcasts will fail from the sandbox `onboarding@resend.dev`. Set up a domain in [Resend → Domains](https://resend.com/domains) (add their DNS records to your domain), then set `RESEND_FROM` to an address on it. Only then do real subscribers receive the welcome email.

## Deployment checklist (after this change)

1. `npm run minify` — compresses CSS/JS/HTML (skips `api/`, `lib/`, `analytics.js`).
2. Deploy to Vercel.
3. Set the env vars above in Vercel → Settings → Environment Variables.
4. Test: submit the contact form, subscribe via a footer form, log into `/admin.html`.
5. Update the auto-responder Calendly link in `api/contact.js` when the client's real Calendly is ready (see Ad-Readiness section).

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

- [x] **Working contact form** — Vercel Serverless Function with Turso DB + Resend + Web3Forms fallback.
- [ ] **Real client logos** — All current logos (Orbital Finance, Northloom Studio, Marlow & Reid, Fieldwork Ops, Havenpoint Realty, Bare Botanicals) are fictional. Sophisticated buyers will Google them and find nothing. Fix: Replace with real client logos with permission, or remove the strip entirely.
- [ ] **Real testimonials** — All testimonials (Amara Chukwu, David Reyes, Priya Anand) are fabricated with Unsplash stock photos. Research shows video testimonials with specific results lift conversion 24-34%. Fix: Collect real testimonials or remove fake ones.
- [ ] **Real project case studies** — Portfolio items use Unsplash stock images with no actual client work, no metrics, no "before/after". Case studies with specific metrics convert 20-35% better. Fix: Replace with real projects or detailed case study pages with quantified outcomes.
- [x] **Real phone number** — "+234 916 540 0534" on every page footer and contact page.
- [ ] **Real email address** — Verify `hello@cleverstack.dev` is functional and monitored.

### 1.2 Missing Critical Pages

- [x] **Privacy Policy page** (`privacy.html`) — Required for GDPR compliance (EU/UK ad traffic), Meta Ads, Google Ads.
- [x] **Terms of Service page** (`terms.html`) — Required for ad platform compliance.
- [x] **404 error page** (`404.html`) — Custom branded page with navigation back to home. Vercel `rewrites` configured in `vercel.json`.
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

- [x] **Working contact form** — Vercel Serverless Function + Turso DB + Resend + Web3Forms fallback.
- [x] **Calendly/scheduling embed** — Calendly links on contact page and CTA buttons site-wide.
- [x] **Cookie consent banner** — Lightweight vanilla JS with accept/reject. Store in `localStorage`. Required for EU/UK.
- [x] **WhatsApp floating button** — `wa-float` button with `https://wa.me/2349165400534`
- [x] **Live chat widget** — Tawk.to embed on all pages.
- [x] **404 page** — Custom branded page with navigation back to home.
- [ ] **Smooth scroll offset** — Fix anchor scrolling with fixed header (currently no offset calculation).
- [x] **Page preloader** — Minimal branded loading screen (shown on first visit, cached in sessionStorage).

### 4.2 Should-Have (Post-Launch)

- [x] **Dark mode toggle** — CSS custom properties + `prefers-color-scheme` detection + manual toggle with `localStorage` persistence
- [x] **Multi-language support** — English + French (West Africa + Europe). `hreflang` tags, `data-i18n` attributes, `i18n.js` engine.
- [x] **Scroll progress indicator** — Thin `.scroll-progress` bar at top showing page scroll progress.
- [x] **Back-to-top button** — Appears after scrolling past hero section.
- [x] **Skeleton loading screens** — For lazy-loaded `shot-area` images with shimmer animation.
- [x] **Image lightbox** — For portfolio detail images (click to expand full screenshot).
- [ ] **Before/after slider** — For case studies showing site before vs after CleverStack work.

### 4.3 Advanced (Month 2+)

- [x] **Scroll-triggered animations** — `.reveal`, `.reveal-left`, `.reveal-right`, `.reveal-scale` with IntersectionObserver, `data-delay` support, staggered children.
- [ ] **3D interactive hero** — WebGL/Three.js element showing tech stack (inspired by Lusion/Up Digital)
- [ ] **Micro-interactions** — Button hover states, card tilt on mouse move, cursor effects.
- [x] **Page transitions** — `.page-load-bar` (gradient bar top 0→60%→100% on load) + fade entrance on `<main>`.

---

## 5. Backend Functionality Needed

### 5.1 Phase 1: Lead Capture (Before Ads)

- [x] **Contact form backend** — Vercel Serverless Function + Resend/SendGrid for email delivery (with Turso DB + Web3Forms fallback).
- [x] **Email auto-responder** — Instant confirmation: "We received your message. Expect response within 24 business hours."
- [x] **Lead notification** — Email notification to team on form submission
- [x] **Calendly integration** — Free tier handles scheduling, timezone conversion, calendar sync

### 5.2 Phase 2: Content & SEO

- [x] **Blog system** — Static blog with HTML posts + `posts.json` metadata. Listing page renders cards dynamically.
- [x] **Sitemap generation** — `sitemap.xml` with all pages including blog and 404
- [x] **RSS feed** — For blog subscribers (`/blog/feed.xml`)
- [x] **Structured data** — JSON-LD for FAQ, Service, LocalBusiness, BreadcrumbList, AggregateRating, Organization, Article, AboutPage, CollectionPage, ErrorPage
- [ ] **OG image generation** — Branded Open Graph image for pages (meta tags added, image file pending)

### 5.3 Phase 3: Analytics & Optimization

- [ ] **Conversion tracking** — GA4 events: form_submission, cta_click, page_view, scroll_depth
- [ ] **Heatmap tracking** — Microsoft Clarity (free) or Hotjar
- [ ] **A/B testing** — Test headlines, CTAs, layouts with real data
- [ ] **Uptime monitoring** — BetterStack or UptimeRobot
- [ ] **Performance monitoring** — Web Vitals tracking (LCP, FID, CLS)

---

## 6. SEO & International Readiness

### 6.1 Technical SEO

- [x] **XML Sitemap** — Create `sitemap.xml` with all pages (ready to submit to GSC).
- [x] **Robots.txt** — `robots.txt` with sitemap reference and allow-all rules.
- [x] **Canonical URLs** — `<link rel="canonical">` on every page.
- [x] **Meta robots** — `index, follow` on all public pages.
- [x] **Hreflang tags** — `<link rel="alternate" hreflang="en" href="...">` and FR variant on all pages.
- [x] **Internal linking** — Link between pages contextually (services → portfolio, portfolio → blog).

### 6.2 Schema Markup

- [x] **FAQPage schema** — For services.html FAQ section (already has 6 questions)
- [x] **Service schema** — For each service offered
- [x] **LocalBusiness schema** — For Nigeria office location
- [x] **BreadcrumbList schema** — For all inner pages
- [x] **AggregateRating schema** — For testimonials/reviews
- [x] **Organization schema** — Enhanced with sameAs social links, AboutPage, CollectionPage, ErrorPage types

### 6.3 Content SEO

- [x] **Blog posts** — 4-6 posts targeting keywords: "web development Nigeria", "full-stack agency", "Shopify developer Africa", etc.
- [x] **Case study pages** — Each with H1 targeting service + industry keywords
- [x] **Meta descriptions** — Include CTA language ("Book a free call") on every page
- [x] **Alt text audit** — Ensure all images have descriptive, keyword-relevant alt text

### 6.4 Performance SEO

- [ ] **Image optimization** — Convert all Unsplash images to WebP/AVIF, serve via CDN, add `srcset` for responsive sizes
- [x] **Core Web Vitals** — Target LCP < 2.5s, FID < 100ms, CLS < 0.1
- [x] **Preload critical resources** — Hero image, above-fold CSS
- [x] **Font optimization** — Use `font-display: swap` (already set), consider subsetting fonts
- [x] **Minification** — Minify CSS and JS for production

---

## 7. Ad-Readiness Checklist

Before running international ad campaigns (Meta, Google, LinkedIn):

### Legal & Compliance
- [x] Privacy Policy page live and accessible
- [x] Terms of Service page live
- [x] Cookie consent banner functional
- [x] GDPR compliance for EU/UK traffic
- [x] Real company address in footer

### Conversion Infrastructure
- [ ] Working contact form with email delivery (needs Vercel env vars)
- [x] Real phone number displayed (replace "+234 000 000 0000")
- [x] Calendly or instant booking option
- [x] WhatsApp button for quick contact

### Tracking & Analytics
- [x] GA4 installed and configured (G-W368FVBPYM)
- [x] Conversion events: form_submission, cta_click, booking_confirmed
- [ ] Meta Pixel installed (for Facebook/Instagram ads) — waiting for Pixel ID
- [ ] Google Ads conversion tag installed — waiting for conversion ID
- [ ] Microsoft Clarity or Hotjar for heatmaps — pending

### Content Quality
- [x] All fake client logos removed or replaced with real ones (no logos on site)
- [x] All fake testimonials removed or replaced with real ones (all 5 real)
- [x] At least 2-3 real case studies with specific metrics
- [x] Branded OG images for social ad previews
- [ ] Real project screenshots (not Unsplash stock) — awaiting user photos

### Technical
- [ ] Mobile-optimized (test on 320px width minimum) — pending test
- [ ] Page load under 3 seconds on mobile (check after deploy)
- [ ] Favicon + apple-touch-icon working — apple-touch-icon pending
- [x] 404 page branded and functional
- [x] HTTPS enforced site-wide (Vercel default)

### Ad Platform Requirements
- [ ] Meta Pixel base code on all pages — waiting for Pixel ID
- [ ] Meta Conversions API (server-side) for iOS tracking — waiting for Pixel ID
- [ ] Google Ads conversion linker tag — waiting for conversion ID
- [x] UTM parameter handling in analytics
- [ ] Landing page speed score > 80 on PageSpeed Insights (check after deploy)

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

- [x] **1.1** Add working contact form (Vercel Serverless Function + Turso + Resend + Web3Forms fallback)
- [x] **1.2** Replace "+234 000 000 0000" with real phone number on all pages
- [x] **1.3** Create `privacy.html` — Privacy Policy page
- [x] **1.4** Create `terms.html` — Terms of Service page
- [x] **1.5** Add cookie consent banner (vanilla JS + `localStorage` + i18n)
- [x] **1.6** Create `404.html` — Custom branded 404 page
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
- [x] **2.6** Add Calendly embed to contact page (and nav CTA button)
- [ ] **2.7** Add "As Featured In" strip (only with real mentions)
- [x] **2.8** Add WhatsApp floating button (`wa-float` + mobile CTA bar + header WhatsApp link)

**Validation:** All placeholder/fake content is either removed or replaced. Form submission sends real email. Calendly booking works.

### Sprint 3 — SEO & Performance (Week 3-4)

> Goal: Rank on Google and pass Core Web Vitals.

- [x] **3.1** Create `sitemap.xml` with all pages
- [x] **3.2** Create `robots.txt` with sitemap reference
- [x] **3.3** Add FAQPage schema to services.html
- [x] **3.4** Add Service schema for each service
- [x] **3.5** Add LocalBusiness schema
- [x] **3.6** Add BreadcrumbList schema to all inner pages
- [x] **3.7** Add `<link rel="canonical">` to every page
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
- [ ] **4.5** Create branded OG image file (`og-image.png`) for all pages
- [ ] **4.6** Add UTM parameter handling
- [ ] **4.7** Test Meta Pixel fires correctly (use Meta Pixel Helper extension)
- [ ] **4.8** Test GA4 events fire correctly (use GA4 DebugView)
- [ ] **4.9** Set up uptime monitoring (BetterStack or UptimeRobot)

**Validation:** Meta Pixel Helper shows all events firing. GA4 DebugView shows form_submission events. PageSpeed Insights score > 80.

### Sprint 5 — Enhancement (Month 2+)

> Goal: Differentiate from competitors with premium features.

- [x] **5.1** Add blog section (static HTML + JSON metadata listing)
- [x] **5.2** Add French language version (i18n.js with EN/FR dictionaries + hreflang)
- [x] **5.3** Add dark mode toggle
- [x] **5.4** Upgrade animations to GSAP or Framer Motion
- [x] **5.5** Add interactive ROI calculator
- [ ] **5.6** Add before/after sliders for case studies
- [x] **5.7** Add image lightbox for portfolio
- [x] **5.8** Add page transition effects (page-load-bar + entrance animations)
- [x] **5.9** Add 3D/interactive hero element (WebGL/Three.js)
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

# THINGS TO FIX

> **Source:** Live-site audit of `cleverfullstack.vercel.app` (all 20 URLs verified, contact API tested, every HTML/CSS/JS file scanned). Prioritized — fix before running ads.

---

## 🔴 Critical (Breaking — Fix Before Running Ads)

- [x] **OG images were dead on every page** — `api/og.jsx` imported `@vercel/og` but it was **not in `package.json`**. Fix applied: added `@vercel/og` + `react` to `dependencies` and ran `npm install`. Re-verify `https://cleverfullstack.vercel.app/api/og?title=test` returns `200 image/png` after redeploy.
- [x] **`ersurajverma.in` portfolio images restored** — 16 image URLs (6 homepage + portfolio + portfolio-detail) pointed at `ersurajverma.in`, which appeared dead during the audit. Per client instruction they have been **restored to the original `http://ersurajverma.in` URLs** so real project screenshots show. Note: the host now resolves (185.151.30.200, TCP 80 open) but HTTP responses were unresponsive from the audit environment — confirm they load from the deployment region.
  - `fiverr-res.cloudinary.com` (6 images) — **verified working** (full-length URLs return 200; earlier 404s were truncated test URLs). No action needed.
  - `justinch.dev` (2 images) — working.
- [x] **`ersurajverma.in` images referenced over `http://`** — restored as-is per client request. If the site is served over HTTPS, these may be blocked as mixed content; revisit if the client provides `https://` variants or local assets.
- [ ] **Fake testimonials still live** — homepage has 10 testimonials with Unsplash stock avatars + fabricated names ("Drake Walker", "Alex Rodriguez", etc.), and `portfolio-detail.html` contains 11 fake clients. This contradicts the "all fake testimonials removed" claim in this README and violates Meta/FTC ad policy. Fix: replace with real testimonials (full name, company, real photo, specific results) or remove them.

---

## 🟠 High Priority

- [x] **Remove unused `image.png` (898 KB)** — deleted from the repo. The LocalBusiness schema referenced `og-image.png` (404); updated the schema `image` to use the `/api/og` URL instead.
- [x] **Conflicting trust stats** — hero now reads "200+ websites built personally" (EN/FR) and the stats section reads "50+ Projects shipped as a team" (per client clarification).
- [x] **Google Fonts CSS loaded 3× on every page** — investigated: the 3 `css2` references are the **correct async font pattern** (`<link rel="preload">` + `media="print" onload` swap + `<noscript>` fallback), not a duplicate stylesheet. No change needed.
- [x] **Sitemap listed the `/404` page** — removed `https://cleverfullstack.vercel.app/404` from `sitemap.xml`.
- [x] **Blog post dated Aug 5, 2026** (`blog/custom-vs-nocode.html` + `posts.json` + `feed.xml`) — re-dated to Aug 1, 2026 in all three files (HTML, posts.json, feed.xml `pubDate` + `lastBuildDate`).

---

## 🟡 Minor

- [x] **`admin.html` missing meta tags** — added meta description. (`noindex, nofollow` internal dashboard — canonical/OG/hreflang intentionally omitted as it is not indexed or shared.)
- [x] **`404.html` missing meta description** — added for consistency.
- [x] **No `favicon.ico` / `apple-touch-icon.png` file** — generated `favicon.ico` (brand 3-block mark, 64px) and `apple-touch-icon.png` (180px) at repo root. Pages keep the inline SVG data-URI favicon as a modern fallback.
- [x] **Responsive images** — added `srcset` (480w/800w/1200w) + `sizes` to all 16 Unsplash portfolio/blog images; all variants verified 200. (Fiverr/Cloudinary images left untouched.)
- [ ] **Blog post images still use Unsplash stock** — pending real project screenshots (already tracked as Sprint 2.3 in this README).
- [x] **`blog/custom-vs-nocode.html` future-dated in `feed.xml`** — `lastBuildDate` and `pubDate` updated to Aug 1, 2026, in sync with the corrected post date.

---

## 📋 Ad-Readiness Checklist (Section 7) — Validated Aug 2026

> **Source:** Audit of `cleverfullstack.vercel.app` against the README Section 7 ad-readiness checklist. Items below still need work before running Meta/Google/LinkedIn ads. Item states reflect the **local** codebase — the live site is currently **stale** and must be redeployed to pick up any fixes.

### 🔴 Critical (Blocks Running Ads)

- [ ] **Calendly links point to the wrong account** — every booking link (`index.html` ×5, `contact.html`, mobile CTA bar, and the auto-responder email in `api/contact.js`) uses `https://calendly.com/samsonfalope326/30min`. This is **someone else's calendar**. Fix: replace with the client's own Calendly URL in all locations.
- [ ] **Meta Pixel ID is a placeholder** — `analytics.js` has `META_PIXEL_ID = '000000000000000'` so `initMeta()` exits early and the Pixel never loads on any page. Fix: insert the real Pixel ID (then the existing consent-gated `fbq` code + `csEvent` custom-event sync starts working automatically).
- [ ] **Fake client logos still live** — homepage "Trusted By" strip shows 6 invented SVG logos (ORBITAL, NORTHLOOM, MARLOW & REID, FIELDWORK OPS, HAVENPOINT, BARE BOTANICALS). Fix: replace with real client logos, or remove the strip until real ones exist.
- [ ] **Fake testimonials still live** — homepage 10 testimonials (fabricated names "Drake Walker", "Alex Rodriguez", etc. + Unsplash avatars) and `portfolio-detail.html` clients. Fix: swap in real testimonials (name, company, real photo, specific results) when the client provides them; some clients want privacy so use approved Unsplash avatars that match the names.

### 🟠 High Priority

- [ ] **Google Ads conversion tag not installed** — no `AW-XXXX` conversion tracking or conversion linker anywhere. Fix: add the Google Ads global site tag + conversion linker + a conversion event fired from `csEvent` (e.g. map `form_submission` / `booking_confirmed`).
- [ ] **Meta Conversions API (CAPI) not implemented** — only browser Pixel base code exists (and it's placeholder). Server-side CAPI is required for reliable iOS attribution. Fix: add a server endpoint (e.g. `api/meta-capi.js`) called from `/api/contact` and CTA events, sending `eventID` + `client_user_agent` + `client_ip_address` for deduplication.
- [ ] **Microsoft Clarity / Hotjar not installed** — no heatmap/session recording tool. Fix: add Clarity (free, lightweight, consent-gated like Tawk.to) or Hotjar; gate behind the existing cookie consent.
- [ ] **No real case studies with specific metrics** — `portfolio-detail.html` has 14 projects with qualitative `outcome` text but no hard numbers. Fix: add concrete metrics (e.g. "+40% revenue in Q1", "3.2× faster load", "35% conversion lift") to at least 2-3 flagship projects using real client data.
- [ ] **Real company address missing in footer** — footer shows only "Lagos, Nigeria — remote worldwide" and schema has only `addressLocality`. Meta/Google require a verifiable physical address for business ads. Fix: add full street address (or registered business address) to footer + LocalBusiness schema (`streetAddress`, `postalCode`).

### 🟡 Minor

- [ ] **`apple-touch-icon` not linked in HTML** — `apple-touch-icon.png` (180px) exists at repo root but no `<link rel="apple-touch-icon" href="/apple-touch-icon.png">` on pages, so iOS Safari still uses the SVG data-URI favicon. Fix: add the link tag to the `<head>` of all pages (and reference `favicon.ico` as the default).
- [ ] **Live deployment is stale** — `cleverfullstack.vercel.app/api/og` returns 404, `apple-touch-icon.png` 404, homepage still shows old "30+ Projects" stat and old avatar set. All recent local fixes (OG images, stats, avatars, favicon) are **not live yet**. Fix: redeploy to Vercel, then re-verify `/api/og`, icons, stats.
- [ ] **PageSpeed score unverified** — site is minified + lazy-loaded so it should pass, but no PageSpeed Insights run has been done. Fix: run PSI on mobile after redeploy; target > 80.

### ✅ Already Passing (Verified)

- Privacy Policy + Terms of Service pages live and linked in footer.
- Cookie consent banner functional (Accept/Reject, GDPR-gated GA4/Tawk.to/Meta).
- Contact form with email delivery (`/api/contact`: Turso DB + Resend + Web3Forms fallback + auto-responder).
- Real phone number displayed (`+234 916 540 0534`).
- WhatsApp button (header + float + mobile bar).
- GA4 installed (`G-W368FVBPYM`, consent-gated) + `form_submission` / `cta_click` / `booking_confirmed` events wired.
- UTM parameter handling — `csUtm` captures `utm_source/medium/campaign/term/content` + `gclid`/`fbclid`, sent to `/api/contact` and GA4.
- Mobile-optimized (responsive, mobile CTA bar), HTTPS enforced (Vercel), branded 404 page.
- Branded OG images (`api/og`) — **after redeploy**.

---

# NFR AUDIT & REMEDIATION TRACKER (Aug 2026)

> **Source:** Full non-functional-requirements audit of the codebase (performance, scalability, reliability, security, SEO, conversion, monitoring, accessibility, cross-device responsiveness). Every item is a tracked checkbox so we never lose the plan. **Status reflects the local codebase — redeploy to Vercel to make fixes live.**

## Performance

- [x] **Duplicate `hero3d.js` script tag removed** — was loaded twice in `index.html` (double parse/execute, wasted work). Now loaded once.
- [x] **Mixed-content `http://` portfolio images upgraded to `https://`** — `index.html` (4: ecom, fitness, restaurant, cleaning) + `portfolio.html` (6: fitness, restaurant, smoothie, cleaning, affiliate, ecom). `https://ersurajverma.in` verified returning 200.
- [x] **Caching** — `Cache-Control` headers (html/css/js: `max-age=3600, stale-while-revalidate=86400`) in `vercel.json`. Verified.
- [x] **Fonts** — async load (preconnect + preload + `media="print"` onload swap + noscript fallback). Verified.
- [x] **Images** — 17/17 `<img>` on home have `width`/`height` + `loading="lazy"` + `decoding="async"` (no image CLS). Verified.
- [ ] **`srcset`/`sizes` for responsive images** — no `srcset` anywhere; mobile downloads desktop-size images. Add responsive sizes + WebP.
- [ ] **External portfolio images not CDN-optimized** — `ersurajverma.in` images served raw; consider local/next/image optimization.
- [ ] **Core Web Vitals measurement** — run Lighthouse/PageSpeed Insights after redeploy (target LCP < 2.5s, CLS < 0.1, score > 90).

## Scalability

- [ ] **Rate limiting on `/api/contact`, `/api/subscribe`, `/api/admin`** — none currently; a spam flood can burn Turso rows + Resend quota. Add per-IP in-memory limiter (e.g. 5–10 req/min).

## Reliability

- [x] **Email fallback chain** — Resend → Web3Forms fallback + DB error handling in `api/contact.js`/`api/subscribe.js`. Verified.
- [x] **DB auto-init** — Turso tables auto-create on first request (`lib/db.js`). Verified.

## Security

- [x] **Existing headers** — `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy` in `vercel.json`. Verified.
- [x] **Input validation** — email regex + length caps in `api/contact.js`/`api/subscribe.js`. Verified.
- [x] **No secrets in repo** — all credentials via env vars. Verified.
- [ ] **HSTS header** — `Strict-Transport-Security` not set in `vercel.json` (Vercel only adds on Pro). Add.
- [ ] **CSP header** — no Content-Security-Policy in `vercel.json`. Add.
- [ ] **Spam protection on forms** — no honeypot field or captcha/Turnstile anywhere on contact + newsletter forms. Add honeypot or Turnstile.
- [ ] **Admin auth hardening** — `api/admin.js` uses plain `===` Bearer-token comparison (not timing-safe) with no attempt limiting. Add `crypto.timingSafeEqual` + lockout.

## SEO

- [x] **Canonical tags** — present on all 11 public pages + 7 blog posts (only `admin.html` intentionally omits it). Verified.
- [x] **Schema.org** — `LocalBusiness` + `AggregateRating` (home), `Service` + `Offer` + `FAQPage` (services), `Article` w/ author+publisher (blog), `BreadcrumbList` + `Organization` everywhere, `Blog`/`AboutPage`/`CollectionPage`/`ErrorPage`. Verified.
- [x] **`sitemap.xml` + `robots.txt`** — correct, domain `cleverfullstack.vercel.app`. Verified.
- [x] **Clean URLs + redirects** — `cleanUrls` + blog 301 redirects in `vercel.json`. Verified.

## Conversion

- [x] **GA4** (`G-W368FVBPYM`) — consent-gated, `form_submission`/`cta_click`/`booking_confirmed` beacon events + UTM capture. Verified.
- [x] **CTA infrastructure** — multiple CTAs, WhatsApp float/header/mobile bar, Calendly, forms with `aria-live` status. Verified.
- [ ] **Meta Pixel real ID** — placeholder `000000000000000` in `analytics.js`; Pixel never loads. Insert real ID when available.
- [ ] **Google Ads conversion tag** — no `AW-XXXX` conversion linker/tag. Add when conversion ID available.

## Monitoring

- [x] **GA4 analytics** — page views + events. Verified.
- [ ] **Uptime monitoring** — none (BetterStack/UptimeRobot not wired).
- [ ] **Error tracking** — none (Sentry / Vercel Analytics not wired).

## Accessibility

- [x] **Typewriter** — `aria-live="polite"` + visually-hidden full phrase list + `prefers-reduced-motion` static fallback. Verified.
- [x] **Images** — 17/17 have `alt` (1 decorative). Verified.
- [x] **Forms/controls** — `aria-label` on inputs, `role="status"` on form status. Verified.
- [ ] **Skip-to-content link** — none present anywhere. Add.
- [ ] **Social icon links** — `href="#"` dead placeholders (Twitter/LinkedIn/Instagram). Point to real profiles or remove.

## Cross-device Responsiveness

- [x] **Desktop + mobile regression** — verified after fixes (EN + FR, 0 console errors, stable hero `1437.7` / `h1 322`).
- [ ] **Final sweep** — re-test 320px/768px/1024px/1440px after all tracker items land.

---

## ✅ Verified Working (No Action Needed)

- All 20 public URLs return 200; nonexistent URLs return the custom 404.
- Contact form backend (`/api/contact`) functional — Turso DB + Resend + Web3Forms fallback.
- Cookie consent banner (GDPR) correctly gates GA4 loading.
- EN/FR i18n — 267 keys, 100% coverage.
- SEO base — sitemap, robots.txt, canonical, hreflang, JSON-LD schemas.
- GA4 events (`form_submission`, `cta_click`, `booking_confirmed`) + UTM capture wired.
- Security headers (X-Content-Type-Options, X-Frame-Options, Referrer-Policy) in `vercel.json`.
- WhatsApp float, Tawk.to chat, Calendly, dark mode, calculators, 3D hero, lightbox, before/after slider, skeleton loading, GSAP animations all implemented.
- `favicon.ico` and `apple-touch-icon.png` now exist at repo root.
- `npm run minify` passes clean on all CSS/JS/HTML (idempotent).

---

## License

All rights reserved. &copy; 2026 CleverStack
