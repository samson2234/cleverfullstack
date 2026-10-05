# CleverStack — Software Requirements Specification (living document)

Version 0.2 · 2026-10-05 · Owner: Henry George (product owner) · Status key: ✅ verified by automated test · 🟡 implemented, not yet verified at production scale · ⬜ planned

## 1. Purpose and scope
CleverStack is an agency platform: a fast public marketing site that ranks on Google and converts paid traffic, plus a back office (CRM) that manages leads, clients and past clients, collects verified reviews, and re-engages past clients. It must stay light, keep working under traffic spikes, and be extended by adding data (services, niches, countries) rather than rewriting pages.

In scope: public website, serverless API (`/api/*`), Turso (libSQL) database, Resend email, admin CRM (`/admin.html`).
Out of scope for now: client portal login, invoicing/payments, multi-user staff accounts (planned, see AGILE.md).

## 2. Stakeholders and users
| Role | Needs |
|---|---|
| Visitor / prospect (business owner, any country) | Understand services and price fast, contact or book a call, trust the agency |
| Past client | Reconnect easily, leave a review, hear about updates/offers |
| Owner / admin | See every lead and client in one place, follow up, request reviews, run win-back emails |
| Team expert (future) | Be assigned work by service skill |
| Search engines / ad platforms | Crawlable, fast, correctly marked-up pages; measurable conversions |

## 3. Functional requirements
Priority: M = must, S = should, C = could.

| ID | Requirement | Pri | Acceptance criteria | Status | Verified by |
|---|---|---|---|---|---|
| FR-01 | Visitors can submit a contact enquiry (name, email, country, industry, message) | M | Valid post returns 200 and is stored; invalid returns 400; bots (honeypot) are silently dropped | ✅ | crm.test (form post), resilience.test |
| FR-02 | Every enquiry attaches to ONE person record; repeat enquiries never duplicate or downgrade a client | M | Same email in any letter case → one contact; a client stays a client | ✅ | crm.test |
| FR-03 | Existing submissions are migrated into person records | M | Legacy rows are backfilled once, idempotently, even under concurrent first requests | ✅ | crm.test, resilience.test |
| FR-04 | Admin can search, filter (type, country, industry, tag, inactivity), sort and paginate contacts | M | Combined filters return correct sets; archived hidden | ✅ | crm.test, retention.test |
| FR-05 | Admin can add/edit contacts, change type, tag, assign owner, archive, and log notes on a timeline | M | Changes persist; type changes are logged | ✅ | crm.test |
| FR-06 | Admin can import contacts from CSV and export filtered CSV | M | Import dedupes on email, skips invalid rows, is idempotent, never downgrades a client; export is Excel-safe | ✅ | crm.test |
| FR-07 | Admin can invite a client to review via a private one-time link (emailed or copied) | M | Link works once, expires in 30 days, only its hash is stored | ✅ | reviews.test |
| FR-08 | Clients submit star rating + text through the link; the review is published as “Verified client” | M | Published immediately; reuse of link returns 410; concurrent reuse yields exactly one review | ✅ | reviews.test, resilience.test |
| FR-09 | Unverified review submissions wait for admin approval | M | Pending reviews never appear publicly until approved | ✅ | reviews.test |
| FR-10 | Admin can publish, reject, reply to, and delete reviews | M | State changes reflect on the public page | ✅ | reviews.test |
| FR-11 | Public page lists approved reviews with average and count (no self-awarded structured-data rating) | M | `/reviews` shows only approved reviews; no `aggregateRating` markup site-wide | 🟡 | manual check (no automated page test yet) |
| FR-12 | Past clients can identify themselves on a “Welcome back” page | M | Creates/updates a `past_client` tagged `self-identified`, logs context, never downgrades | ✅ | retention.test |
| FR-13 | Admin can email a filtered segment (win-back/check-in) in safe batches | M | Skips unsubscribed + archived, never double-sends a named campaign, retries failures, requires an email key | ✅ | retention.test |
| FR-14 | Every campaign email carries an unsubscribe link; unsubscribing excludes the person from all future campaigns | M | Link present in each message; unsubscribed contact not in recipient count | ✅ | retention.test |
| FR-15 | Conversions are measurable: accepted lead, booking click, WhatsApp/phone/email click | M | Events fire only on success (lead) / on click; Google Ads & Meta IDs configurable | 🟡 | manual (needs real ad accounts) |
| FR-16 | Site content is available in English and French | S | Language toggle works on all pages | 🟡 | existing feature, no new test |
| FR-21 | Homepage ROI calculator that works for beginners and large businesses, shows payback against the real website cost, uses only visitor-entered assumptions, and captures a lead with the numbers | M | “Just starting” and “established” paths; log-scale inputs 100–1,000,000 visitors and 10–100,000 per customer plus exact entry; 5 currencies; EN/FR; improvement assumption chosen by the visitor (15/30/50 %); lead lands in the CRM with the scenario in the timeline; no NaN for any input | ✅ | roi.test (13), manual end-to-end in browser (both themes, 375 px, FR) |
| FR-17 | Services, industries and countries are managed as data (add a service/niche without code) | S | Admin can add rows; pages render from them | ⬜ | Sprint 3 |
| FR-18 | Deal pipeline, tasks and follow-up reminders per contact | S | Stages, owner, value, due dates | ⬜ | Sprint 2 |
| FR-19 | Staff accounts with roles (owner, expert, support) | S | Individual logins, audit trail | ⬜ | Sprint 4 |
| FR-20 | Client portal (project status, files, review, re-order) | C | Authenticated clients only | ⬜ | Later |

## 4. Non-functional requirements
| ID | Category | Requirement (measurable) | Status | Evidence / how verified |
|---|---|---|---|---|
| NFR-01 | Performance — page weight | Typical page ≤ 100 KB gzipped (excl. images); homepage ≤ 200 KB; no WebGL/3D library | ✅ | Weight audit: homepage 161 KB incl. the 40 KB hero still (was 268 KB with the 3D library on capable desktops); other pages 85–92 KB; About 148 KB (was 1,753 KB). The 600 KB three.js layer was replaced by a pre-rendered still image |
| NFR-02 | Performance — Core Web Vitals | Mobile LCP ≤ 2.5 s, CLS ≤ 0.1, INP ≤ 200 ms (p75) | ⬜ | **Not yet measured.** PageSpeed API was rate-limited; run Lighthouse/PageSpeed on the deployed URL and record results here |
| NFR-03 | Performance — API | Index-backed queries; CRM list/search/filter ≤ 500 ms at 10,000 contacts | ✅ | scale.test: 6–67 ms locally (Turso adds network latency, budget has headroom) |
| NFR-04 | Scalability | Static pages served from the CDN; APIs stateless; concurrent bursts neither duplicate nor lose data | ✅ | resilience.test: 50 simultaneous enquiries → 1 contact + 50 submissions; 30 racing review links → 1 review |
| NFR-05 | Scalability — abuse control | Rate limits enforced across all serverless instances | 🟡 | Shared limiter implemented and unit-tested with a fake Redis; **activate by setting `UPSTASH_REDIS_REST_URL/TOKEN`** (free tier) |
| NFR-06 | Reliability | Cold-start races must not fail requests; dependency failures must not lose leads | ✅ | resilience.test: 25 simultaneous first requests succeed (24 failed before the fix); lead saved when email is down |
| NFR-07 | Reliability — timeouts | External calls time out (email 8 s, rate-limit store 0.8 s) and fail safe | ✅ | resilience.test |
| NFR-08 | Availability | Marketing site stays up if the database is down; uptime checked every 15 min | 🟡 | Static hosting + GitHub Action uptime monitor exist; API outage behaviour tested only for email/Redis |
| NFR-09 | Security — access | Admin API requires a bearer secret, constant-time comparison, lockout after 5 failures | 🟡 | Existing; admin auth tested. Known gaps: single shared password, CORS `*` on admin API, in-memory lockout → Sprint 4 |
| NFR-10 | Security — data | Review tokens stored hashed; secrets only in env vars; no PII in URLs except the one-time review token | ✅ | reviews.test (hash only) |
| NFR-11 | Security — web | CSP, HSTS, X-Frame-Options, nosniff, Referrer-Policy on every response | 🟡 | Configured in `vercel.json`; not re-scanned this sprint |
| NFR-12 | Privacy / compliance | Consent-gated analytics; unsubscribe honoured; honest, substantiated marketing claims | 🟡 | Consent mode exists; unsubscribe tested. **Open:** anonymous case-study figures are unverified; Fiverr terms may restrict off-platform solicitation of buyers; add postal address/company details required by some jurisdictions |
| NFR-13 | Accessibility | WCAG 2.1 AA: keyboard operable, labelled forms, sufficient contrast, reduced-motion respected | 🟡 | New forms have labels/ARIA live regions; reduced motion honoured. **No audit run yet** |
| NFR-14 | SEO | Unique titles/descriptions, canonical URLs, sitemap, no spammy markup | 🟡 | Existing; sitemap updated; hard-coded domain must be bulk-replaced at the domain switch |
| NFR-15 | Maintainability | Automated tests run with one command; changes small and reviewable | ✅ | `npm test` (33 tests), `npm run test:scale` (8) |
| NFR-16 | Observability | Errors logged with context; failed emails recorded | 🟡 | `email_log` table + server logs; no alerting beyond uptime check |
| NFR-17 | Portability | Domain is configuration, not code | 🟡 | Emails use `SITE_URL`; static HTML still hard-codes the domain (script planned for switch) |

## 5. Constraints and assumptions
- Serverless on Vercel; database is Turso (SQLite-compatible). Per-instance memory is not shared.
- Email via Resend; sending domain must be verified before real delivery to arbitrary recipients.
- The owner’s verified facts: 68+ completed projects (2022–2026). Review count/claims on the site must match real, citable sources.
- Team of experts will grow; roles and skills are modelled later (FR-19).

## 6. Traceability and test commands
```
npm install
npm test            # functional + concurrency + resilience (33 tests, ~20 s)
npm run test:scale  # 10,000-contact performance budgets (8 tests, ~20 s)
```
Tests use a throwaway local SQLite file and stubbed email/Redis — they never touch production.

## 7. Open questions
1. Which case-study figures are real and publishable with client consent?
2. Is soliciting Fiverr-originated clients off-platform acceptable under Fiverr’s current terms? (Safe default: reach out inside Fiverr; use the Welcome-back page as a passive channel.)
3. Which legal entity/postal address should appear in email footers and the privacy policy?
