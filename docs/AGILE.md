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
4. If `style.css`, `script.js`, `i18n.js` or `analytics.js` changed, run **`npm run assets`** and commit the result (it re-versions the file URLs so visitors never get stale styles/translations; `npm test` fails if you forget). Page weight does not regress (`weight.js` audit) — no new heavy dependency without justification.
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
