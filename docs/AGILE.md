# CleverStack — Agile delivery plan

Method: Scrum-style, scaled down for a small team. **One-week sprints**, one potentially shippable increment per sprint, requirements tracked in `docs/SRS.md` (FR/NFR IDs), backlog below.

## Roles
| Role | Who | Responsibility |
|---|---|---|
| Product Owner | Henry George | Owns the backlog order and acceptance; decides what is true/publishable |
| Developer(s) | Henry + Claude (pair) → team experts later | Build, test, demo |
| Scrum Master | Rotates / Henry | Keeps sprint scope honest, removes blockers |

## Cadence (weekly)
- **Planning (30 min, Monday):** pick the top backlog items that fit; each needs acceptance criteria.
- **Daily check (async):** what shipped, what is blocked.
- **Review / demo (Friday):** show working software on a preview deployment; accept or reject against criteria.
- **Retrospective (15 min):** one thing to keep, one to change. Log it in the table at the bottom.

## Branching and release
- `main` = always deployable (Vercel production). Work happens on short-lived branches (`feature/…`, `fix/…`) → pull request → merge.
- Every merge runs `npm test`. Vercel gives each branch a **preview URL**: the Product Owner accepts there before merging.
- Release = merge to `main`. Rollback = redeploy the previous Vercel deployment (one click). Database changes are additive (new tables/columns, `IF NOT EXISTS`) so a rollback never breaks data.

## Definition of Ready (a story may enter a sprint when…)
1. Written as: *As a <user>, I want <goal> so that <benefit>*.
2. Acceptance criteria are testable and linked to an FR/NFR ID.
3. Dependencies/secrets known (e.g. needs Resend key). Size fits in a few days.

## Definition of Done (a story is done when…)
1. Acceptance criteria met and demonstrated on a preview deployment.
2. Automated tests added/updated and **`npm test` is green**; performance-sensitive work also passes `npm run test:scale`.
3. No new console errors; forms keyboard-usable with labels; works at 375 px width.
4. Blog: add posts as `blog-src/<id>.js`, then `npm run blog` (never hand-edit the lists). If `style.css`, `script.js`, `i18n.js` or `analytics.js` changed, run **`npm run assets`** and commit the result (it re-versions the file URLs so visitors never get stale styles/translations; `npm test` fails if you forget). Page weight does not regress (`weight.js` audit) — no new heavy dependency without justification.
5. No secrets in code; new env vars documented in `docs/SRS.md`/README.
6. Security reviewed for anything touching auth, email, or personal data (consent, unsubscribe, rate limits).
7. SRS status column updated honestly (✅ only with evidence).

## Product backlog (ordered)
Estimate in ideal days (1 = small). MoSCoW from the SRS.

| # | Item | FR/NFR | Pri | Est |
|---|---|---|---|---|
| 1 | Deploy `upgrade/platform`; set `SITE_URL`, Turso, Resend domain, Upstash; smoke-test on a preview | NFR-05/08/17 | M | 1 |
| 2 | Import past clients (Fiverr export/CSV) and send first Welcome-back campaign | FR-06, FR-13 | M | 1 |
| 3 | Measure Core Web Vitals + Lighthouse on the deployed URL; fix top 3 findings | NFR-01/02 | M | 2 |
| 4 | Deals pipeline (stages, value, owner), tasks and follow-up reminders on contacts | FR-18 | S | 3 |
| 5 | Domain switch script (replace hard-coded URLs, sitemap, canonical, OG) | NFR-14/17 | M | 1 |
| 6 | Services / industries / countries as data + admin screen; generate niche × country landing pages | FR-17, NFR-14 | S | 4 |
| 7 | Ad landing pages (one CTA, per audience), conversion labels wired | FR-15 | M | 2 |
| 8 | Staff accounts + roles, individual logins, audit log; remove shared admin password and `CORS *` on admin | FR-19, NFR-09 | S | 4 |
| 9 | Accessibility audit (axe/Lighthouse + keyboard pass) and fixes | NFR-13 | S | 2 |
| 10 | Lazy-load the French dictionary and defer animation JS on non-home pages (≈ −40 KB on every page) | NFR-01 | C | 1 |
| 11 | Client portal MVP (project status, files, review, re-order) | FR-20 | C | 8 |
| 12 | Alerting (error rate/email failures) beyond the uptime check | NFR-16 | C | 2 |

## Sprint log
### Sprint 1 — “Trust + retention foundation” (this sprint, branch `upgrade/platform`) — **done**
Goal: make the existing site credible and ready to retain past clients without changing its design.
Delivered: verified-review system (FR-07..11), unified CRM with import/export (FR-02..06), returning-client page + win-back campaigns + unsubscribe (FR-12..14), conversion tracking hooks (FR-15), emails fixed to use `SITE_URL`, per-endpoint + shared rate limiting, single-flight database setup (fixed a cold-start crash), 3D hero skipped on constrained devices, About image 1.6 MB → 58 KB, asset caching, `68+ projects` made consistent, self-awarded rating markup removed, 41 automated tests.
Not done / carried over: items 1–3 above need production accounts (Vercel preview, Resend domain, Upstash).

### Sprint 1b — hero polish (done, same week)
Hero stack card made readable in light and dark mode and on phones; the 600 KB WebGL knot replaced by a 40 KB pre-rendered still (same look on every device, desktop homepage 268 → 161 KB); caption now states the offer ("from $499 · fixed price · free audit") and is translated in French (it was never wired to i18n); static trust strip corrected from 31 to 60 reviews to match the displayed number.

### Sprint 1c — ROI calculator rebuild (done)
Replaced the single flat ×1.6 multiplier (every visitor “gained 60%”, no cost, no payback, US-only, no lead capture) with two honest paths: “just starting out” (customers needed to pay for the site) and “I already have customers” (visitors → enquiries → customers → revenue/profit, visitor-chosen improvement, payback and 12-month return vs the real package price). Small-to-large business range, 5 currencies, English/French, accessible controls, sticky live result on phones, lead form posting the visitor’s numbers to the CRM, analytics events (`roi_start`, `roi_preset`, `roi_mode_change`, `roi_cta_open`, `roi_lead`). 13 new tests.

### Sprint 1d — blog repair + 6 problem-solving guides (done)
Production bug found and fixed first: my own ad-domain edit had dropped a space in three Content-Security-Policy sources, blocking the blog thumbnails AND the live-chat widget; a new CSP test now guards it. Then six new guides, each solving one or two real client problems: no enquiries (conversion), slow site (speed), Google Maps / local search, getting and using reviews, fix vs refresh vs rebuild, website security basics. Built from `blog-src/` with `npm run blog` (pages, index, RSS, sitemap, prev/next on all 18 posts, homepage preview all stay in sync), branded covers hosted locally (7–9 KB each instead of third-party photos), reading time computed from word count, 8 new blog tests. Found along the way: one older post was never in the sitemap (fixed).

### Sprint 1e — team, testimonials and pre-ads QA (done)
Team page: Clever Web, Mike and Vicky added beside Henry and Clevian (initials-only placeholder cards removed, last row centred). Testimonials: Mike's five complete Fiverr reviews added word for word (20 total); `npm run testimonials` now also keeps the carousel dots in step and the Reviews page wall in sync (checked by `tests/assets.test.mjs`). Review pages: shared theme-aware styles in `style.css` replace three copies of hard-coded dark CSS (light mode was unreadable). Full-site audit (22 pages × light/dark × desktop/phone, contrast + overflow + errors) found and fixed: `/privacy`, `/terms`, `/case-studies` stuck in a redirect loop on production; white-on-white headings and names in light mode (UK, Press); dark-on-dark buttons and notes in the dark CTA panels and footer; invisible CTA buttons in the six new blog posts; 106 stale Google-font preloads that 404'd on every page; inconsistent footers; contradictory canonical/hreflang tags on the country pages; the Europe landing page rebuilt on the USA template (it rendered unstyled with a script error). Portfolio: real client work first, homepage features six real projects, heavy PNG/GIF screenshots → WebP. New `tests/routing.test.mjs` (redirect loops, every internal link resolves, canonical/hreflang, no stale font preloads).

### Sprint 1f — analytics dashboard, weekly report, glass header (done)
First-party, cookieless analytics (`analytics.js` tracker → `api/pulse.js` → `lib/analytics.js`): page views, every click (classified booking/WhatsApp/phone/email/CTA/nav/outbound), visible time and scroll depth, accepted leads/reviews, UTM campaigns, referrers, country/region/city (Vercel edge headers), device/browser/OS. No cookies, no IPs stored; visitors = daily-rotating salted hash. Bots, automation, foreign origins and the owner's own browser (auto-excluded on CRM login) are ignored. Finished days are summarised once into `analytics_rollup` (nightly `api/cron-daily.js`, lazily on read) so 90-day views stay fast at any traffic; raw events pruned after ~13 months. CRM Analytics tab (`admin-analytics.js/.css`, dark glass): range switch day/week/month/quarter with period-over-period deltas and sparklines, traffic chart, pages (time + scroll), entry/exit, funnel, sources with leads, campaigns, locations, technology, clicks, flows, live, recent visitor journeys. Weekly email (`api/cron-weekly.js`, Mondays 07:00 UTC; also "Email me this week's report" in the CRM). `tests/analytics.test.mjs` (10) proves exact counts, rollup = live equality, privacy, filtering, auth and the report. Light mode: floating glass header capsule on every page (phone menu as a drop-down sheet). CRM fonts restored (had fallen back to a serif since the August redesign). Privacy policy updated. Needs `CRON_SECRET` (+ `RESEND_API_KEY`) in Vercel.

### Sprint 1g — glass everywhere, sidebar CRM, lead scoring, staff roles, A/B tests (done)
Glass: floating capsule header in both themes on every device (phone menu = drop-down sheet); dark-mode frosted testimonial cards/panels/bars; light-mode glass panels + colour wash on every page. Header now highlights the current section on every page (Reviews, blog posts, portfolio detail, etc. were missing it; terms wrongly highlighted About) — guarded by a routing test. CRM: Mailchimp-style left sidebar (grouped, icons, collapsible, phone drawer, page title in the top bar). Lead scoring (`lib/lead-score.js`): explainable 0–100 Hot/Warm/Cold from budget (FX-normalised), ROI profit, form used, completeness, business email, market, urgency and the visitor's journey (tracker attaches the anonymous session id to form posts → `submissions.analytics_session`); "Hottest first" sort and tier filter; reasons in the lead window; hot leads get a 🔥 email subject and optional WhatsApp ping (`lib/hot-lead.js`, CallMeBot env). Staff accounts (`lib/staff.js`): owner/admin/sales/viewer, scrypt passwords, hashed 12h sessions, revocation on logout/reset/disable, server-side permission check on every request; Team and My account screens. Campaign links (UTM builder). A/B tests (`lib/ab.js`): text variants on chosen elements, 50/50 sticky split, exposures as analytics events, conversion + two-proportion confidence, preview links; config served by `api/pulse` GET (function count stays 11). Tests: `leadscore`, `staff`, `ab` (+ routing nav test).

### Sprint 1h — client messaging (done)
Every enquiry (contact form, budget planner, ROI calculator) opens a private conversation (`lib/messages.js`: `conversations` + `messages`). The auto-reply email carries an "Open your conversation" link to `/messages` (`messages.html`, noindex, no tracking; the link token moves to the URL hash and is looked up by sha256). Clients reply there (`api/portal`, rate-limited, honeypot); the owner is emailed with a deep link to the CRM. CRM Inbox (`admin-inbox.js/.css`): list with filters and search, unread badge, thread view, status (open / waiting on client / won / closed), quick replies, optional email copy ("Email the client too" — always carries the same link), new conversation, link copy and link rotation; "Message on platform" from any lead. Replies are logged on the client timeline (the enquiry itself is not logged twice); viewers cannot send. Senders include `ai` for the later assistant. Vercel functions are now **12/12** on Hobby: any new endpoint must be folded into an existing one. Later (needs the domain): reply-by-email via inbound mail, attachments. Tests: `messages`.

### Sprint 1i — full chat (done)
Shared chat UI for the client page and the CRM Inbox (`chat-ui.js/.css`). Files both ways: images, PDF, Word, Excel, PowerPoint, TXT, CSV, ZIP up to 4 MB (Vercel request limit), stored in Turso in 512 KB chunks (`message_files`, `message_file_chunks`) — no extra service. Server checks the bytes match the type (a real image with the wrong extension is kept under its true type), non-images always download, files are sandboxed and only readable inside their own conversation; large photos are shrunk in the browser. Also: Seen / Sent receipts, typing indicator, edit and delete (client: own messages for 15 min; team: team messages), edits/deletions sync via `since`, clickable links (http/https only, built as elements), emoji picker, paste and drag-and-drop, upload progress, failed-send Retry, "New messages" jump, tab-title count + soft sound when the tab is hidden, image lightbox. Polling every 4 s while open. Admin API rate limit raised 30 → 120/min (inbox polling); failed logins keep their own lockout. CSP img-src adds `blob:` (CRM shows token-protected files). Still 12/12 functions. Tests: `chat`.

### Sprint 2 — plan
Goal: *“Ship it and get the first past clients back.”* Items 1, 2, 3, 5. Exit criteria: preview accepted, `npm test` green in CI, Core Web Vitals recorded in the SRS, first campaign sent to an imported segment.

### Sprint 3 — plan
Goal: *“Scale content with data.”* Items 4, 6, 7.

### Sprint 4 — plan
Goal: *“Team-ready back office.”* Items 8, 9, 10.

## Risks
| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Unverified marketing claims (case studies) trigger ad disapproval or reputational harm | M | H | Product owner confirms or removes figures before ads run |
| Emailing Fiverr-sourced clients conflicts with Fiverr terms | M | M | Check current terms; prefer in-platform messages; use opt-in Welcome-back page |
| Single shared admin password | H | H | Sprint 4; until then long random password, IP lockout exists |
| Free-tier limits (Turso/Resend/Upstash) under heavy ad traffic | M | M | Monitor usage; static pages unaffected; shared rate limiter protects quotas |
| Dev machine 4 GB RAM slows builds | H | L | Keep dependencies minimal; build on Vercel |

## Retrospective log
| Sprint | Keep | Change |
|---|---|---|
| 1 | Writing tests that reproduce the bug first (the cold-start race) | Avoid editing source with PowerShell `Set-Content` (it corrupted UTF-8 twice); use Node scripts or the editor tool |
