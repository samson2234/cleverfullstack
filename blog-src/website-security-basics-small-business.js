// Source for blog/website-security-basics-small-business.html — built by `npm run blog`
module.exports = {
  id: 'website-security-basics-small-business',
  title: 'Website Security for Small Businesses: 10 Basics That Prevent Most Hacks',
  excerpt: 'Hacked sites, spam and browser warnings cost small businesses leads and trust. Ten practical basics that stop most attacks, and what to do if you have already been hacked.',
  description: 'Website security basics for small businesses: HTTPS, updates, strong passwords, two-factor login, backups, spam protection and what to do if hacked.',
  category: 'Security',
  readingTime: '9 min read',
  date: 'October 5, 2026',
  iso: '2026-10-05',
  icon: 'shield',
  related: [
    ['custom-vs-nocode.html', 'Custom vs no-code: which is right for you?'],
    ['should-i-fix-or-rebuild-my-website.html', 'Fix or rebuild your website?'],
    ['why-is-my-website-slow.html', 'Why is my website slow?']
  ],
  cta: {
    h3: 'Worried your site is not secure?',
    p: 'We can check your site for the common weaknesses, clean up anything we find and put protections in place, so you are not relying on luck. Tell us about your site and we will reply within one business day.',
    btn: 'Get a free security check',
    href: '../contact.html'
  },
  body: `
<div class="callout"><p><strong>In short:</strong> most small-business sites are not attacked by clever human hackers. They are broken into by automated tools that look for outdated software and weak or reused passwords. Keep things updated, use unique passwords with two-factor login, and keep working backups, and you will block most of it.</p></div>

<p>Maybe your site was hacked and started sending spam. Maybe a customer told you their browser showed a scary warning. Or maybe you just worry that it could happen to you. Many owners assume their small business is too small to be a target. In practice that is exactly why they are targeted: automated tools scan millions of sites looking for easy ways in, and small sites are often the easiest.</p>
<p>The good news is that a short list of basics prevents the large majority of problems.</p>

<h2>What attackers actually want from a small site</h2>
<p>It is rarely your customer list or your secrets. Most attacks on small business sites are opportunistic and automated, and they aim to <strong>use your site</strong> rather than to harm you personally: to send spam from your server, to host a hidden page that sells something dubious, to redirect your visitors to another site, to steal logins and try them elsewhere, or to quietly add links that help someone else rank on Google. You often do not notice until a customer complains, your host suspends the account or Google shows a warning. That is why the boring basics below matter more than any clever tool.</p>

<h2>The ten basics</h2>

<h3>1. Use HTTPS everywhere</h3>
<p>HTTPS encrypts the connection between your visitors and your site, and browsers warn people away from sites without it. Most good hosts provide a free certificate. Check that your site loads with the padlock, that the plain "http" address redirects to "https", and that the certificate renews automatically.</p>

<h3>2. Keep everything updated</h3>
<p>Outdated software is the most common way sites get hacked. If you use WordPress or a similar system, update the core software, your theme and every plugin, ideally with automatic updates for security releases. Update your hosting software and server version when your host prompts you.</p>

<h3>3. Delete what you do not use</h3>
<p>An inactive plugin or old theme is still code on your server and can still be exploited. Remove unused plugins, themes, old test sites and forgotten user accounts. Only install add-ons from reputable sources, and avoid pirated "nulled" themes, which often contain malware.</p>

<h3>4. Strong, unique passwords</h3>
<p>Reusing one password across your hosting, website and email means a leak from any one service exposes the rest. Use a password manager to create long, random, different passwords for each account. Never share a single login between several people; give each person their own.</p>

<h3>5. Turn on two-factor authentication (2FA)</h3>
<p>Two-factor login asks for a second proof, such as a code from an app, in addition to your password. Turn it on for your hosting account, website admin, email, domain registrar and any payment or marketing tools. It stops most attacks that rely on stolen passwords. Use an authenticator app rather than text messages if you can.</p>

<h3>6. Limit who can do what</h3>
<p>Give each person the lowest level of access they need. A writer who adds blog posts does not need to be an administrator. Remove access promptly when someone leaves a project or company.</p>

<h3>7. Keep working backups</h3>
<p>Backups are your insurance, but only if they work. Aim for automatic daily backups, stored somewhere other than the same server (so a single failure cannot take out both), and test restoring one at least once. Know where your backups are and who can restore them.</p>

<h3>8. Protect your forms from spam and abuse</h3>
<p>Contact forms attract automated spam and can be abused to flood your inbox or send junk. Use measures such as a hidden "honeypot" field that real people never fill in, limits on how many submissions one visitor can send in a given time, and server-side checks. These are friendlier to real visitors than puzzles that make them prove they are human.</p>

<h3>9. Choose reputable hosting and protect your domain</h3>
<p>Cheap, neglected hosting is a common weakness. Choose a provider that keeps its servers patched, offers backups and gives you support. Separately, protect your domain name: enable registrar lock, turn on auto-renew, use 2FA on the registrar account and keep the contact email current. Losing control of your domain is one of the most damaging things that can happen to a business online.</p>

<h3>10. Handle payments the safe way</h3>
<p>If you take payments, use a hosted checkout from a trusted provider such as Stripe or PayPal, rather than collecting card details on your own pages. That way, sensitive card data never touches your site, which dramatically reduces your risk and your compliance burden.</p>

<h2>Check your own site in ten minutes</h2>
<ul class="checklist">
  <li>Does the padlock show, and does "http" redirect to "https"?</li>
  <li>When did you last update your software, theme and plugins?</li>
  <li>Are there plugins, themes or user accounts you no longer need?</li>
  <li>Do your hosting, website admin, email and domain accounts have 2FA?</li>
  <li>Do you know where your latest backup is, and have you tested restoring it?</li>
  <li>Does your form have spam protection?</li>
  <li>Is your domain set to auto-renew and locked?</li>
</ul>

<h2>What to do if you have been hacked</h2>
<ol>
  <li><strong>Do not panic and do not ignore it.</strong> Take the site offline or into maintenance mode if it is sending spam or harming visitors.</li>
  <li><strong>Change every password</strong> connected to the site: hosting, admin, database, email, FTP. Start with the ones you have reused.</li>
  <li><strong>Contact your host.</strong> They can often help identify and remove the problem.</li>
  <li><strong>Restore a clean backup</strong> from before the attack, then update everything immediately so the same hole is not reopened.</li>
  <li><strong>Scan and clean.</strong> Look for unknown admin users, strange files and injected code. If you are unsure, get a professional to clean it properly.</li>
  <li><strong>Ask Google to review the site</strong> if it was flagged, using Search Console.</li>
  <li><strong>Consider whether customer data was exposed.</strong> Many countries require you to notify the authorities and affected people within a set time. Under the GDPR, for example, certain breaches must be reported to the regulator within 72 hours of discovery. Check the rules where you and your customers are, and get advice if personal data was involved.</li>
</ol>

<h2>Why simpler sites are safer</h2>
<p>Every moving part is something that can break or be attacked. A site built from simple files served from a content delivery network has no admin login to guess, no database to breach and no plugins to patch, so a large share of common attacks do not apply. If you update your content rarely, or have a developer who does it for you, that can be a smart choice. If you need to edit pages yourself, a managed platform with automatic updates and good habits can be just as safe. The right option depends on how you work, which we cover in <a href="custom-vs-nocode.html">custom versus no-code</a>.</p>
<p>If your site is already limping along with security problems that keep coming back, it may be time to look at <a href="should-i-fix-or-rebuild-my-website.html">fixing or rebuilding it</a>.</p>
`
};
