# Live chat on cleverstack.dev: plan

Goal: replace every WhatsApp button with a chat that lives on our own site. A visitor starts a chat the way they
would start a new WhatsApp chat, it lands in the CRM Inbox as a lead, and the conversation continues until it
converts. Owner decisions (13 Nov 2026) are recorded at the bottom.

## What already exists (and is reused)
- Two-way project conversations: CRM Inbox (`admin.html` + `admin-inbox.js`) and the client page
  (`messages.html`), sharing `chat-ui.js` / `chat-ui.css`: bubbles, read receipts, typing, files up to 4 MB,
  emoji, edit/delete, day dividers.
- Server: `lib/messages.js` (conversations, messages, files), `api/portal.js` (client side, secret link token),
  `api/admin.js` (team side).
- Every contact-form enquiry already becomes a CRM contact, a lead score, a conversation and two emails
  (`api/contact.js`).
- Limit: Vercel Hobby allows 12 functions and we use all 12. New server work goes into existing functions.

## Phase 1: "Chat with Henry" on every page, WhatsApp removed
- The WhatsApp floating bubble, header button, hero buttons, mobile bar button and in-text links become chat
  buttons (links to `/contact?chat=1` so they still work without JavaScript).
- Clicking opens a chat window styled like WhatsApp / Messenger: Henry George's avatar, "Typically replies within
  an hour", a welcome message.
- Before the first message the visitor gives their name and email ("so we can reply if you leave"), then writes.
- Starting a chat goes through the contact pipeline with `chat: true`: CRM contact, lead score (page, UTM,
  journey), conversation, owner email ("New chat"), and an email to the visitor with a link back to the chat.
- An automatic reply lands in the chat straight away and says Henry usually replies within an hour and will
  email them if they leave.
- The chat stays on the page while they browse; returning visitors see their conversation (secret token kept
  in their browser).
- Tracking: chat started = a lead (Meta `Lead`, GA4 `generate_lead`, Google Ads conversion that used to be
  "WhatsApp click").
- Spam: honeypot, rate limits and vendor-pitch filtering, same as the contact form.
- Tests guard that no `wa.me` link is left and that every page has the chat entry points.

## Phase 2: CRM Inbox polish
- WhatsApp-style two-pane layout: conversation list (avatars, last message preview, unread badges, search,
  filters Open / Waiting / Won) and the thread.
- Lead panel: lead score, page the chat started on, UTM source, country, history.
- Phone layout: list and thread slide like the WhatsApp app. Sound alert, quick replies, "Website chat" label.

## Phase 3: installable apps (PWA)
- The visitor chat page becomes "CleverStack Chat": web app manifest, icons, service worker, opens full screen
  from the home screen.
- The CRM Inbox can be installed by the owner too, so replies can be sent from the phone.

## Phase 4: phone notifications (Web Push)
- New visitor message: owner gets email and a push notification. Owner reply: the visitor gets a push
  notification, with email as the fallback.
- Needs two VAPID keys as Vercel environment variables (generated locally, never pasted in chat or git).
- iPhone: Apple only allows web push after the app is added to the home screen (iOS 16.4+), so Phase 3 comes
  first. Android works in the browser.

Every phase: tests, deploy, live check before the next one.

## Owner decisions (13 Nov 2026)
1. Name and email are asked before the first message.
2. The chat shows Henry George (a real person builds more trust). A photo is needed; until then the avatar uses
   his initials.
3. Reply promise: "Typically replies within an hour".
4. Automatic reply when a chat starts, so nobody waits in silence; the owner is notified and replies.
