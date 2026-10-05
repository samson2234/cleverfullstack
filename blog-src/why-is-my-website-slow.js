// Source for blog/why-is-my-website-slow.html — built by `npm run blog`
module.exports = {
  id: 'why-is-my-website-slow',
  title: 'Why Is My Website Slow? How to Find the Cause and Fix It Without Being Technical',
  excerpt: 'A slow site quietly loses enquiries. Learn how to test your speed properly, read the report in plain English, and fix the usual causes in order.',
  description: 'Slow website? Test it with PageSpeed Insights, read the results in plain English and fix the usual culprits: huge images, too many plugins and heavy scripts.',
  category: 'Performance',
  readingTime: '8 min read',
  date: 'October 5, 2026',
  iso: '2026-10-05',
  icon: 'gauge',
  related: [
    ['website-no-enquiries-fix.html', 'Visitors but no enquiries? 9 fixes'],
    ['should-i-fix-or-rebuild-my-website.html', 'Fix or rebuild your website?'],
    ['optimized-website-advantages.html', 'The real advantages of an optimized website']
  ],
  cta: {
    h3: 'Not sure why your site is slow?',
    p: 'Send us the address and we will run a proper speed check, tell you the real cause in plain English, and quote a fixed price if it needs fixing. Our Fix & Redesign service starts from $799.',
    btn: 'Get a free speed check',
    href: '../contact.html'
  },
  body: `
<div class="callout"><p><strong>In short:</strong> test your site on mobile with Google's free PageSpeed Insights, look at the three or four items it flags as biggest, and fix them in this order: oversized images, unnecessary plugins and scripts, hosting, then everything else. Do not chase a perfect score.</p></div>

<p>You click your own website and it takes a moment to appear. Or a customer mentions it was slow. Or a developer says "it needs optimising" and you are not sure what that means or whether it is worth paying for.</p>
<p>Speed matters because visitors on phones are impatient and search engines take page experience into account. But the fix is rarely mysterious. Most slow sites are slow for the same handful of reasons, and you can find yours without writing a line of code.</p>

<h2>Step 1: Test it properly</h2>
<p>Do not judge speed by loading your site on your office Wi-Fi. Your computer has the site partly saved already and a fast connection. Instead:</p>
<ol>
  <li>Open <strong>pagespeed.web.dev</strong> (Google's free tool) and enter your homepage address.</li>
  <li>Look at the <strong>Mobile</strong> results first. That is where most of your visitors are, and it is the harder test.</li>
  <li>Repeat for your most important page (often your main service or product page).</li>
  <li>Take a screenshot of the results, so you can compare after your fixes.</li>
</ol>

<h2>Step 2: Read the results in plain English</h2>
<p>The report is long, but three measures matter most. Google calls them Core Web Vitals, and publishes the thresholds it considers "good":</p>
<ul>
  <li><strong>Loading (LCP):</strong> how long until the main content appears. Good is 2.5 seconds or less.</li>
  <li><strong>Responsiveness (INP):</strong> how quickly the page reacts when someone taps or clicks. Good is 200 milliseconds or less.</li>
  <li><strong>Visual stability (CLS):</strong> whether things jump around while loading. Good is 0.1 or less.</li>
</ul>
<p>Below those you will find a list called "Opportunities" or "Diagnostics". Ignore the long tail. Look at the top three items. That is your starting list.</p>

<h2>The usual causes, in the order we check them</h2>

<h3>1. Images that are far bigger than they need to be</h3>
<p>This is the most common cause by a wide margin. A photo straight from a phone or camera can be several megabytes, but a space on your page that is 600 pixels wide needs a file a fraction of that size. Fixes: resize images to roughly the size they are displayed, save them in a modern format such as WebP, compress them, and make sure images lower down the page load only when someone scrolls to them ("lazy loading"). Never put a huge image in just to shrink it with the page.</p>

<h3>2. Too many plugins, apps or add-ons</h3>
<p>On WordPress, Shopify and similar platforms, every plugin or app can add code that loads on every page. Sites often collect many over the years and forget about them. List what you have installed, remove anything you do not actively use, and replace heavy ones with lighter alternatives where you can.</p>

<h3>3. Third-party scripts</h3>
<p>Live chat, tracking pixels, review widgets, social feeds, maps and font libraries each load code from another company's server. Individually they seem harmless; together they can double your load time. Keep what earns its place. Delay non-essential ones until after the page has loaded, and load chat only when someone asks for it.</p>

<h3>4. Cheap or overloaded hosting</h3>
<p>If your site is slow even when it is simple, the server may be the bottleneck. Signs include a long wait before anything starts to appear and slowness at busy times. Moving to better hosting, or putting a content delivery network (CDN) in front of the site so visitors get files from a server near them, often helps a great deal. A static site (plain files served from a CDN) is the fastest and cheapest option when you do not need a content management system.</p>

<h3>5. A heavy theme or page builder</h3>
<p>Some themes and page builders load a lot of code to offer flexibility you may never use: sliders, animations, dozens of fonts and icon sets. If your report shows a lot of unused code, the honest fix may be a lighter design rather than more tuning.</p>

<h3>6. Video and animation</h3>
<p>Autoplaying background video looks impressive and is expensive. If you need it, compress it heavily, use it sparingly and provide a still image for phones. Otherwise use a good photo.</p>

<h2>A one-week speed plan</h2>
<ul class="checklist">
  <li>Test mobile and desktop on your top two pages and save the results.</li>
  <li>Resize and compress your ten largest images (the report tells you which).</li>
  <li>Turn on lazy loading for images below the first screen.</li>
  <li>Remove unused plugins, apps and themes.</li>
  <li>Review third-party scripts and remove or delay at least one.</li>
  <li>Check your hosting plan and ask them about caching and a CDN.</li>
  <li>Test again. Keep a simple log of what you changed and what happened.</li>
</ul>

<h2>What not to do</h2>
<ul>
  <li><strong>Do not chase 100/100.</strong> A fast, readable site that loads in a couple of seconds on a phone is the goal. The last few points of the score rarely matter to customers.</li>
  <li><strong>Do not compress images until they look blurry.</strong> A sharp image that is the right size beats a blurry tiny one.</li>
  <li><strong>Do not buy a bigger hosting plan first.</strong> Heavy images and plugins will still be heavy.</li>
  <li><strong>Do not install a "speed plugin" that adds more code than it removes.</strong></li>
</ul>

<h2>When it is the platform, not the settings</h2>
<p>Sometimes a site is slow because of how it was built: an old theme, years of layered plugins, or a design that cannot be lightened without breaking it. Then tuning only goes so far, and you face a choice between a targeted fix and a rebuild. Our <a href="should-i-fix-or-rebuild-my-website.html">fix-or-rebuild guide</a> gives you a simple scorecard for deciding. And if low enquiries are the real worry, read <a href="website-no-enquiries-fix.html">why visitors do not contact you</a>, because speed is one cause among several.</p>
`
};
