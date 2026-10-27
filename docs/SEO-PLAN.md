# CleverStack SEO Plan: rank for buyer searches, bring paying clients

**Goal:** be on page 1 of Google (and in AI answers such as ChatGPT and Perplexity) for searches made by businesses that are ready to pay for a website or web app, and turn that traffic into qualified leads.

**Status:** plan only. Nothing here is executed until you approve it, phase by phase.

---

## 0. Honest expectations (read first)

- **SEO is a 3–6 month game.** Technical fixes show results in weeks. New pages usually take 2–4 months to rank. Competitive terms ("web development company USA") take 6–12 months plus backlinks. **Google Ads covers the gap.**
- **Nobody can guarantee position #1.** Anyone who promises it is selling something. We will win by publishing better pages than the competition for **specific, high-intent searches**, and by earning trust signals (reviews, links, mentions).
- **Not all traffic is equal.** "What is HTML" brings students. "Shopify developer for my store" brings buyers. Every page in this plan targets a **buyer intent**.
- **Lead quality matters as much as volume.** Jack and Joel are freelancers pitching services, not clients. Phase 5 adds filtering, so pitches stop polluting the pipeline and your numbers.

## 1. What I found on the site today (audit, 27 Oct 2026)

**Good already in place:**
- All public pages have one H1, a unique title and a meta description.
- Canonical tags, a sitemap (34 URLs) and robots.txt are set. Search Console is verified and the sitemap is accepted.
- Structured data is present: Organization, LocalBusiness, Article, Breadcrumb, FAQ, Service with prices.
- There are location pages (UK, USA, Europe), 17 blog posts, llms.txt and fast static hosting.
- The site is HTTPS-only with security headers, and image alt text is present.

**Problems that hold rankings back (fix in Phase 1):**

| # | Problem | Why it hurts |
|---|---|---|
| T1 | The French version (`?lang=fr`) is listed in hreflang, but the server sends **English** HTML. The translation happens in the browser. | Google sees a duplicate English page claiming to be French. That is a wasted crawl and a mixed signal. |
| T2 | **About 30 portfolio projects** live at one URL (`portfolio-detail?id=…`), built in the browser, with one canonical for all. | Google indexes at most one of them. All that proof of work is invisible to search. |
| T3 | Only **one Services page** covers every service. | There is no page that can rank for "Shopify developer", "Next.js development agency", "Zoho CRM consultant", "SaaS MVP development" and so on. |
| T4 | The homepage HTML is 122 KB, with a full-screen preloader and 115 KB of animation scripts. | Likely hurts LCP (Core Web Vitals), especially on mobile. Must be measured in Search Console or PageSpeed and fixed. |
| T5 | The sitemap `lastmod` dates are stale (June–July), and there is no image sitemap. | Google re-crawls changed pages more slowly, and portfolio images don't show in Google Images. |
| T6 | Schema says **LocalBusiness in Ibadan, NG**, while the pages target the USA, UK and Europe. | It mixes local and international signals. ProfessionalService with `areaServed` set to US, GB and EU fits better. |
| T7 | `welcome-back.html` is marked index,follow. | A thin utility page competing in the index. |
| T8 | There are no author pages, and team bios are short. | This is weak E-E-A-T (experience, expertise, authority, trust): Google wants real people behind expert content. |

## 2. Keyword strategy (who we target)

We go after **4 intent clusters**, in this order of money value:

1. **Hire intent, by service and platform** (highest value):
   - "Shopify developer", "Shopify store setup service", "WooCommerce developer"
   - "WordPress developer for small business", "Elementor expert"
   - "Next.js development agency", "React developer for hire", "Node.js backend developer"
   - "SaaS MVP development", "web app development company"
   - "Zoho CRM consultant / implementation", "CRM integration developer"
   - "website redesign service", "landing page design service"
2. **Hire intent, by location:**
   - "web development company USA / UK / Europe" (pages exist; strengthen them)
   - Later, high-value cities with unique content only: London, Manchester, New York, Austin, Toronto, Dublin, Lagos.
   - This is **not** a copy-paste page per city. Google penalises doorway pages.
3. **Industry intent:** "website for dentists", "law firm website design", "real estate website developer", "restaurant website", "SaaS startup website", "e-commerce for fashion brands". Each page gets a matching case study.
4. **Problem and cost intent** (blog; converts to leads with the ROI calculator and budget planner):
   - "how much does a website cost", "website gets no enquiries", "fix or rebuild website", "Shopify vs WooCommerce", "website slow"
   - Several of these exist already; we deepen and interlink them.

For every target we record: the search phrase, the page that owns it (one page per phrase, so we don't compete with ourselves), the current position, and the target.

## 3. Phases

### Phase 1: Technical SEO (week 1–2) · effort: me · risk: low · ✅ DONE 27 Oct 2026

> **Result (live, verified; all 117 tests pass, CI green):**
> - **T1 French:** Option A, `fr` hreflang removed from all 28 pages.
> - **T2 Portfolio:** 18 real pages at `/work/<project>`, each with its own title, description, canonical, CreativeWork and breadcrumb schema, and related projects. Old `?id=` links 301 there; 40 internal links re-pointed. (There were 18 projects, not ~30.)
> - **Bugs found and fixed on the way:**
>   - `reviews`, `review` and `welcome-back` had their canonical set to **/404**, and their schema called them "404 Page Not Found".
>   - 5 pages had `og:url` on the `.html` address.
>   - The UK page claimed a **London office address** in its schema.
>   - The Organization `sameAs` listed a GoodFirms profile that doesn't exist and a mistyped Clutch link.
>   - The blog description targeted "Nigerian businesses".
>   - `docs/`, `tests/`, `scripts/` and `lib/` were publicly readable.
> - **T4 Core Web Vitals** (throttled mobile lab test, same connection before and after):
>   - Home LCP **5.6 s → 1.6 s**, CLS **0.28 → 0.03**
>   - Services LCP **3.4 s → 1.3 s**
>   - Blog LCP **3.4 s → 2.1 s**
>   - Every page measured has CLS < 0.05
>   - How: the full-screen preloader is gone, the theme is set before first paint, the hero is no longer hidden behind animations, the header layout is in the critical CSS, and LCP images get priority.
> - **T5 Sitemap:** generated from the pages (`scripts/build-sitemap.js`), 34 → **50 URLs**, real `lastmod`, 91 image entries. It regenerates whenever the blog or portfolio builders run.
> - **T6 Schema:** Organization + ProfessionalService with the real address and the target markets (US, GB, DE, CA, IE, NL, FR, Nordics, AU, NZ, Europe). Location pages are Services provided by it.
> - **T7:** `welcome-back` is now noindex. robots.txt fixed.
> - **IndexNow:** a GitHub Action pings changed pages after each deploy. The first run sent 50 pages, answer 202 (accepted).
> - **Internal linking:** every post links to a matching case study and the services page; reviews got breadcrumbs.
> - **Monitoring:** `tests/seo.test.mjs` (9 tests) now guards canonicals, H1, titles and descriptions, schema truthfulness, sitemap freshness, redirects, IndexNow, deploy exclusions and the CWV fixes.
>
> **Carried forward:**
> - Service schema per service page arrives with the service pages (Phase 2), as do team Person entities (they need your team details) and the title/description rewrites (several are still over 60/160 characters).
> - The weekly Search Console check is manual until Phase 5's monthly report.

1. **Fix the French problem (T1).**
   - Option A (recommended now): remove the `fr` hreflang and keep French as an on-page convenience only.
   - Option B (later): real server-rendered `/fr/` pages, only if France and Canada become a target market.
2. **Turn the portfolio into real pages (T2):** build `/work/<project>` static pages, each with:
   - title, description, problem, solution, stack, results, images and a CTA;
   - a self-canonical, CreativeWork schema and breadcrumbs.

   Old `?id=` links 301-redirect to them. *Biggest quick win: about 30 new indexable pages of proof.*
3. **Core Web Vitals (T4).**
   - Measure (PageSpeed and Search Console), then cut what's slow: drop the preloader for first paint, lazy-load the animation scripts, inline only the critical CSS and preload the hero image.
   - Target: LCP < 2.5 s on mobile, CLS < 0.1, INP < 200 ms.
4. **Sitemaps (T5):** real `lastmod` from file changes; add the `/work/` pages and an image sitemap, regenerated on every deploy.
5. **Schema upgrade (T6):**
   - ProfessionalService plus Organization with `areaServed`, `sameAs` (LinkedIn, Clutch, GBP and so on), `founder` and team Person entities, plus a logo;
   - Service schema on each service page;
   - Review and AggregateRating only where Google allows it. Self-hosted reviews don't get stars, so we won't fake it.
6. **Indexing hygiene:** set `welcome-back`, utility and thank-you pages to noindex. Check that every page returns the right status (200, 301 or 404), with one URL per page (trailing-slash and `.html` consistency).
7. **IndexNow (Bing, Yandex, also feeds ChatGPT search):** ping on deploy so new pages are found in hours.
8. **Internal linking engine:** every blog post links to 1–2 service pages and 1 case study. Service pages link to the related industry pages and posts. Breadcrumbs everywhere.
9. **Monitoring:** weekly Search Console check (coverage, CWV, queries), plus a broken-link and redirect check in the test suite so SEO can never silently break.

### Phase 2: On-page SEO, money pages (week 2–6) · effort: me + your input · risk: low

1. **8 service pages**, one per buyer intent:
   - Shopify, WooCommerce/WordPress, Next.js/React web apps, SaaS MVP, Zoho CRM and automation, website redesign, landing pages, SEO and speed optimisation.

   Each one has:
   - a clear H1 matching the search, and who it's for;
   - deliverables and process, a price range or "from" price, timelines;
   - 1–2 relevant case studies, an FAQ (real questions from leads), a strong CTA (call, budget planner, WhatsApp);
   - 1,000–1,800 words, unique, no fluff.
2. **6 industry pages:** dentists and clinics, law firms, real estate, restaurants and hospitality, SaaS startups, e-commerce brands. Each gets industry-specific pains, the features they need, a case study and a CTA.
3. **Upgrade the USA, UK and Europe pages:**
   - local proof (clients there, time-zone overlap, currency pricing, payment methods);
   - local FAQs, links to case studies with clients in that country.
4. **Titles and descriptions rewritten for clicks:**
   - include the keyword, a benefit and a proof point. Example: "Shopify Developer for Hire — Stores That Sell | From $1,200 | CleverStack".
   - A/B test titles with Search Console CTR.
5. **E-E-A-T (T8):**
   - real team pages with photos, roles, years of experience, skills and LinkedIn;
   - author bylines on posts linking to them;
   - an "about our process" page; real client logos (with permission).
6. **Conversion on every SEO page:**
   - a sticky CTA, the budget planner, the ROI calculator, a WhatsApp click and social proof near the form.
   - Rankings without conversions are worthless.

### Phase 3: Content engine (week 4 onwards, ongoing) · effort: me drafts, you approve · risk: low

- **2 posts per week**, each targeting one buyer-adjacent question, for example:
  - "Shopify setup cost 2026"
  - "how long does it take to build a web app"
  - "WordPress vs custom website for law firms"
  - "best CRM for small agencies, Zoho vs HubSpot"
- Each post ends in a service page or the budget planner.
- **Refresh, don't just add.** Every month, update the posts that are sliding in Search Console (new data, better answer, new internal links).
- **Comparison pages that win buyers:** "Hiring a freelancer vs an agency", "CleverStack vs Upwork / Fiverr freelancers", "Wix vs custom website". These are honest, useful and high-converting.
- **Free tools and lead magnets** (they attract links naturally):
  - website cost calculator (exists, so we promote it)
  - website speed and SEO checker
  - downloadable "website launch checklist"

### Phase 4: Off-page SEO, authority and trust (week 2 onwards, ongoing) · effort: shared · risk: low (white-hat only)

1. **Google Business Profile:**
   - finish verification; add categories, services with prices, photos and weekly posts;
   - **ask every happy client for a Google review** (the CRM review-invite flow can include the GBP link).
2. **B2B directories that also send leads:** Clutch, GoodFirms, DesignRush, Sortlist, UpCity, Bark, Techreviewer, Manifest.
   - Complete profiles and portfolio; **verified client reviews on Clutch** carry huge weight for "top web development company" lists.
3. **"Built by CleverStack" credit links:**
   - a small footer credit on client sites (with their consent) linking to the matching case study;
   - this gives relevant, natural backlinks at scale.
4. **Digital PR:**
   - answer journalist requests (Qwoted, Featured.com, Help a B2B Writer) as a web development expert;
   - publish one data piece per quarter (for example "We analysed 100 small-business websites: here's why they don't get enquiries"), which journalists link to.
5. **Guest posts and podcasts:** 1–2 per month on business, marketing and e-commerce sites your clients read, not link farms.
6. **Consistent identity (NAP and entity):**
   - the same name, logo, description, links and contact everywhere: LinkedIn company page, Facebook, Instagram, X, YouTube, Crunchbase, GitHub.
   - Google and AI assistants trust brands that are consistent across the web.
7. **Partnerships:** referral swaps with marketing agencies, accountants and business coaches who serve the same clients.
8. **Never:** buy links, use PBNs, comment spam or "1,000 backlinks for $20". These get sites penalised.

### Phase 5: Lead quality and measurement (week 1–2) · effort: me · risk: low

1. **Stop vendor pitches polluting leads (Jack and Joel):**
   - Add a required "What can we help you with?" choice, including "I'm offering services / partnership".
   - Detect pitch language ("I can help you rank", "our agency offers", "white-label", "guest post"), auto-tag those as **Vendor pitch** and keep them out of your pipeline and lead counts. Nothing is deleted; they're just separated.
2. **Every lead shows its source.** The new **"How they found you"** on each lead card shows the channel, first page, location and pages read.
   - Add a monthly "leads by channel" report (Google organic, Ads, Meta, direct, referral, AI assistants).
3. **Track rankings** for the 40–60 target phrases monthly, using a Search Console export. A paid tool is optional.
4. **One monthly SEO report** (auto-emailed like the weekly analytics): clicks, impressions, top queries, new pages indexed, CWV, leads from organic, and what we'll do next month.

### Phase 6: AI search visibility (ChatGPT, Perplexity, Google AI Overviews) (week 3 onwards)

- Write clear, quotable answers on service and FAQ pages (prices, timelines, process). AI assistants quote pages that answer directly.
- Keep `llms.txt` and the structured data current. Be listed on the directories and "best agencies" lists AI tools read (Phase 4).
- Track "AI assistant" as a lead source (it's already detected on the lead card).

## 4. Timeline (first 90 days)

| Weeks | Work |
|---|---|
| 1–2 | Phase 1 technical fixes · Phase 5 lead filtering · GBP and directory profiles started |
| 2–4 | Portfolio → `/work/` pages · first 4 service pages · schema upgrade · CWV fixes |
| 4–6 | Remaining 4 service pages · 3 industry pages · location page upgrades · start 2 posts/week |
| 6–8 | Last 3 industry pages · comparison pages · first data/PR piece · credit links on client sites |
| 8–12 | Refresh sliding pages · outreach (guest posts, podcasts) · monthly report · city pages only where we have proof |

## 5. Targets (how we judge success)

| By | Target |
|---|---|
| Day 30 | All technical issues fixed; 60+ pages indexed; CWV "good" on mobile |
| Day 60 | Impressions ×3 vs today; first page-1 rankings for long-tail service phrases |
| Day 90 | Organic clicks ×3; 10+ page-1 keywords; organic leads ≥ 30% of all leads; vendor pitches filtered out |
| Month 6 | Page 1 for several platform and service terms ("Shopify developer UK" type); organic becomes the #1 lead source |

## 6. What I need from you

1. **Approval per phase.** I start with Phase 1 + Phase 5 when you say go.
2. **Case-study facts** for 6–10 best projects:
   - what the client needed, what we built, and results (traffic, sales, leads, speed);
   - permission to name them, plus a short quote if possible.
3. **Team details:** real names, photos, years of experience and LinkedIn links for the team page and author bylines.
4. **Accounts only you can create:** Clutch, GoodFirms and DesignRush profiles; LinkedIn company page; GBP verification. I'll give exact steps and the copy to paste.
5. **Client outreach:** ask 3–5 happy clients for a Google or Clutch review, and for a footer credit link.
6. **Decision:** is French a real target market? If not, we take Option A in Phase 1.

## 7. Rules we follow (so nothing breaks)

- Every change goes through the existing test suite, plus new SEO tests: one H1, unique titles, canonicals, no broken links, sitemap valid, redirects correct.
- No change to the design system; new pages use the existing layout and components.
- Redirects for every URL that moves, so no lost rankings or 404s.
- Only claims we can prove (no fake reviews, numbers or awards).
