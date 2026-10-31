# Plan: blog images, CRM fixes, owner password, and the email campaign system

Requested 31 Oct 2026. Executed step by step; each step is tested (automated tests + a real browser check) and ticked here before the next starts.

## Constraints we build within

- **12/12 server functions used (Vercel Hobby).** No new files in `api/`. New server work goes into existing endpoints: admin actions in `api/admin.js`; open/click tracking in `api/pulse.js`; email-provider webhooks and one-click unsubscribe in `api/unsubscribe.js`. New screens are static files (`admin-campaigns.js/.css`), which are not functions.
- **Function time limit (60 s).** Big sends go in batches of 100 (Resend's batch API). The campaign screen keeps sending while it is open, and the daily cron finishes anything left over, so a 2,000-contact blast never depends on one long request.
- **Hobby crons run once a day.** "Schedule for later" therefore means "starts at the next daily run (00:15 UTC) or when you open the campaign screen", not an exact minute.
- **What email tracking can and cannot see.** We can measure: sent, delivered, bounced, spam complaints (people pressing "Report spam"), opens, clicks, unsubscribes, and the replies and leads a campaign produces. **No email tool can see which folder an email landed in** (inbox vs spam); tools that claim this use "seed tests", sending to their own test mailboxes. We add the same: a seed test that sends the campaign to your own Gmail/Outlook/Yahoo addresses so you can check where it lands before a blast. Opens are also over-counted by Apple Mail privacy protection; clicks are the reliable signal, as in every email tool.

## Decisions needed from you before the first big blast (building does not wait for these)

1. **Where the 2,000 leads come from.** Resend (our email provider) forbids purchased or scraped lists and suspends accounts for it. Cold emailing from `cleverstack.dev` also risks the domain's reputation, which would push your lead notifications and client emails into spam. If the list is cold, the safe setup is a separate sending domain (e.g. `trycleverstack.com`) on a cold-outreach tool, with warm-up. If the contacts opted in (website leads, subscribers, past clients, event contacts), Resend is fine. The tool shows a warning for imported lists without a recorded consent source.
2. **A postal address for the email footer.** US law (CAN-SPAM) requires a physical postal address in every marketing email; UK/EU rules require clear sender identity. A P.O. box or virtual mailbox address is acceptable and does not have to appear on the website.
3. **Your Resend plan.** The free plan allows 100 emails a day / 3,000 a month; Pro allows far more. The tool reads a daily limit from settings so a blast never fails halfway on quota.

## Steps

### 1. Readable dropdowns (quick) — DONE (31 Oct)
- Dark background and light text for every dropdown option in the CRM (Campaign links, Leads, Contacts, A/B tests, Analytics, filters), consistent in light and dark theme.
- Test: style check on all admin selects; browser screenshot.

### 2. Edit review replies — DONE (31 Oct)
- "Edit reply" on reviews that already have a reply; same box, pre-filled; saves over the old reply; "Remove reply" too. Updates the public review instantly.
- Test: reply → edit → public reviews page shows the corrected text.

### 3. Owner password from the Account page — DONE (31 Oct)
- Change password: current password + new password (12+ characters). Stored as a scrypt hash in the database; replaces `ADMIN_PASSWORD` from then on. All other owner sessions are signed out.
- Forgot password: sends a one-time reset link (valid 30 minutes) to the owner email. `ADMIN_PASSWORD` in Vercel keeps working until you set a new password here.
- Test: change, old password rejected, new accepted, other sessions revoked, reset link single-use and expiring.

### 4. Blog: new posts with real images — DONE (31 Oct)
- Real stock photos (free licence) that show what the post is about on every recent post, including the four published this week: a store on screen for Shopify, a site editor for WordPress, a CRM dashboard for Zoho/HubSpot, and so on.
- New posts: Shopify store setup cost, WordPress vs custom website for law firms, Zoho vs HubSpot for small agencies, Wix vs custom website.

### 5. Email campaign system (Tools → Campaigns), built in stages

**5a. Audience: lists, tags, contacts**
- One audience: CRM contacts, website leads and newsletter subscribers are connected (a subscriber is a contact tagged `newsletter`; unsubscribing anywhere unsubscribes everywhere).
- **Lists** you create (e.g. *Follow-up client, Upsell client, Interested but not ready*, any custom list). **Tags** for anything else. Both work in Leads, Contacts, Subscribers and the Inbox.
- **Suppression list:** unsubscribes, hard bounces and spam complaints are never emailed again by any campaign.

**5b. Import**
- Upload CSV, Excel (.xlsx/.xls), TSV or TXT, or paste emails. Column mapping (email, first name, last name, company, phone, country, industry, any extra field), preview, duplicate merge, invalid-email check, and suppression check. Add to a list and tags in the same step. 2,000+ rows in one go.
- "Import from website": website leads (by status/date) and newsletter subscribers into a list with one click.

**5c. Compose**
- Subject, preview text, from name, reply-to; editor with headings, text, buttons, images and links; merge fields (`{{first_name}}`, `{{company}}`, ...) with fallbacks; saved templates; desktop and mobile preview; **test send**; **seed test** (inbox placement check).
- Every email gets an unsubscribe link, one-click unsubscribe headers (required by Gmail and Yahoo for bulk senders) and the postal-address footer.

**5d. Send**
- Choose audience (lists, tags, leads, subscribers, filters); recipient count after suppression; send now or schedule; batches with throttling; daily limit; pause, resume and cancel; per-recipient status.

**5e. Tracking**
- Opens (pixel via `/api/pulse`), clicks (redirect via `/api/pulse`, each link tagged with `utm_source=email&utm_campaign=<campaign>` so website visits and leads are credited to the campaign), delivered/bounced/complained (Resend webhooks via `/api/unsubscribe`, signature-checked), unsubscribes, replies.
- Rates: delivery, open, click, click-to-open, bounce, spam complaint, unsubscribe; with warnings when bounce > 2% or complaints > 0.1% (Gmail's limit is 0.3%).

**5f. Campaign analytics**
- Each campaign has its own report link (a mini dashboard): timeline of opens and clicks, rates, top links, devices, recipients with their status, and leads and revenue it produced.
- A campaigns overview sorted by send date, and campaign results on the main Dashboard and in Analytics (email as a channel).

**5g. A/B tests in campaigns**
- Test subject lines or content: send variants to a test share (e.g. 20%), choose the winner by open or click rate after a set time, then send the winner to the rest. Campaign tests appear in the A/B tests tab next to the website tests.

**5h. Lists and tags in the Inbox**
- In a conversation, the client's lists and tags show at the top (e.g. *Upsell client*), and you can add or remove them there.

### 6. Final check
- All automated tests, a full browser walk-through of every new screen, live check after deploy, and this plan marked done.
