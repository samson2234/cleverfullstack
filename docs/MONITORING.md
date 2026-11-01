# Monitoring: know before visitors do

Two free tools, each catching what the other cannot:

| | UptimeRobot | Sentry |
|---|---|---|
| Answers | "Is the site up?" | "Is something broken while the site is up?" |
| Catches | Site down, Vercel outage, database down, SSL/domain problems | JavaScript errors on pages, contact form failing to save a lead, lead emails not sent, crashing API functions, failed daily/weekly jobs |
| How | Checks the site from outside every 5 minutes | The site reports its own errors |
| Alerts | Email + mobile app push (also Telegram/Slack) | Email + mobile app push |
| Free plan | 50 monitors, 5-minute checks | 5,000 errors a month, 1 user |

The site side is already built (no code changes needed when you connect them):

- `GET /api/health?deep=1` checks the server and the database; it answers **503** when the database is down.
- Every API function reports crashes, and the contact form, newsletter, review and cron jobs report the failures that matter (a lead not saved, a lead email not sent, a report that failed).
- Browser errors are captured by `analytics.js` and sent through `/api/pulse` (our own address, so ad blockers cannot hide them). Only errors from our own scripts, max 5 per page view, max 20 per visitor per hour. No extra script is loaded on the pages, so speed is unchanged.
- The Sentry key lives only in Vercel (`SENTRY_DSN`), never in the code.
- The existing GitHub check (every 15 minutes) also uses the deep health check and opens an issue if it fails.

## 1. Sentry (about 5 minutes)

1. Sign up at sentry.io (free Developer plan).
2. Create a project. Platform: **Node.js** (browser and server errors both go to this one project). Name it `cleverstack`.
3. Copy the **DSN** (Project Settings → Client Keys (DSN)). It looks like `https://abc123@o123456.ingest.us.sentry.io/1234567`.
4. In Vercel: Project → Settings → Environment Variables → add `SENTRY_DSN` with that value, for **Production**. Then redeploy (Deployments → ⋯ → Redeploy).
5. Check: open `https://cleverstack.dev/api/health?deep=1`. It should show `"error_alerts":"configured"`.
6. Alerts: Sentry emails you about new issues by default. In Alerts, make sure there is a rule "A new issue is created → send a notification" to your email. Install the **Sentry app** on your phone for push alerts.

Do not paste the DSN in chat or commit it; Vercel is the only place it belongs.

## 2. UptimeRobot (about 5 minutes)

1. Sign up at uptimerobot.com (free plan). Install the **UptimeRobot app** on your phone and allow notifications.
2. Add these monitors (5-minute interval):

| Name | Type | URL | Setting |
|---|---|---|---|
| Site + database | Keyword | `https://cleverstack.dev/api/health?deep=1` | Alert when keyword `"ok":true` **does not exist** |
| Homepage | HTTP(s) | `https://cleverstack.dev/` | |
| Contact page | HTTP(s) | `https://cleverstack.dev/contact` | |
| Blog | HTTP(s) | `https://cleverstack.dev/blog` | |

3. Alert contacts: your email and the mobile app. Optional: Telegram or Slack.
4. Optional: create a public status page and keep the link for clients.

## What to do when an alert comes in

1. **UptimeRobot "Site + database" down:** open the health link. `"database":"down"` means Turso; check the Turso dashboard. If the whole site is down, check vercel.com/status and the latest deployment in Vercel (roll back with "Promote" on the previous deployment if a deploy caused it).
2. **Sentry issue:** the title says where (`contact: lead not saved to database`, `page /pricing`, `cron: daily job`...). Open it for the message, the page, the device and the stack trace. Errors tagged `where: contact` mean a lead may need to be recovered: check Vercel logs and the email inbox.
3. After fixing, mark the Sentry issue resolved; it alerts again if it comes back.
