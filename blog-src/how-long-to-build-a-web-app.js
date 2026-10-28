// Source for blog/how-long-to-build-a-web-app.html — built by `npm run blog`
module.exports = {
  id: 'how-long-to-build-a-web-app',
  title: 'How Long Does It Take to Build a Web App? Realistic Timelines, Stage by Stage',
  excerpt: 'From a simple internal tool to a full SaaS product: what each stage involves, how long it usually takes, and the decisions that speed it up or slow it down.',
  description: 'How long does it take to build a web app? Realistic timelines for each stage, from scoping and design to launch, and what makes projects faster or slower.',
  category: 'Web Development',
  date: 'October 27, 2026',
  iso: '2026-10-27',
  icon: 'gauge',
  related: [
    ['cost-to-hire-full-stack-developer.html', 'What it costs to hire a full-stack developer'],
    ['custom-vs-nocode.html', 'Custom code vs no-code'],
    ['businesses-refuse-to-scale.html', 'Why some businesses refuse to scale']
  ],
  cta: {
    h3: 'Planning a web app?',
    p: 'Tell us what it needs to do. We will suggest what belongs in the first version and send a fixed quote with a timeline. Custom web apps start from $3,000, typically delivered in 14 to 28 days.',
    btn: 'Plan my web app',
    href: '../react-nextjs-development.html'
  },
  body: `
<div class="callout"><p><strong>In short:</strong> a focused web app with logins, a database and an admin panel typically takes two to four weeks with an experienced team. A SaaS MVP with billing and onboarding usually takes one to two and a half months. Larger platforms take longer and are best released in stages. The biggest factor is not the code. It is how clearly the first version is defined.</p></div>

<p>Ask ten developers how long a web app takes and you will hear ten answers, from "a weekend" to "a year". They are not all wrong: "web app" covers everything from a simple booking tool to a platform with thousands of users and complex permissions.</p>
<p>This guide breaks a typical project into stages, gives realistic ranges for each, and explains what moves the timeline. The ranges come from how we plan our own projects. Your project's actual timeline should always come from a written scope.</p>

<h2>Three sizes of web app</h2>
<table>
  <thead><tr><th>Type</th><th>Examples</th><th>Typical timeline</th></tr></thead>
  <tbody>
    <tr><td>Focused app</td><td>Client portal, internal dashboard, booking or quoting tool</td><td>2–4 weeks</td></tr>
    <tr><td>SaaS MVP</td><td>A first sellable version with sign-up, billing and onboarding</td><td>4–10 weeks</td></tr>
    <tr><td>Platform</td><td>Marketplaces, multi-tenant products, heavy integrations</td><td>Several months, released in stages</td></tr>
  </tbody>
</table>
<p>For reference, our <a href="../react-nextjs-development.html">custom web app package</a> (logins and roles, database design, one API integration, an admin panel and data visualisation) is typically delivered in 14 to 28 days, and <a href="../saas-mvp-development.html">SaaS MVPs</a> in about 4 to 10 weeks.</p>

<h2>Stage 1: scoping (a few days to a week)</h2>
<p>Scoping turns an idea into a list of what the first version must do. It covers who the users are, what each type of user can see and change, what data the app stores, and which outside services it connects to.</p>
<p>This is the stage most often skipped, and skipping it is the main reason projects run late. A one-page scope that says "in the first version" and "later" for each feature saves weeks of rework.</p>

<h2>Stage 2: design (about one to two weeks)</h2>
<p>Design means agreeing the key screens and flows before building them: sign-up, the main dashboard, the forms people use every day. For internal tools a clean, consistent interface built from a component library is usually enough. Customer-facing products deserve more design time, because the interface is part of what you sell.</p>
<p>Clickable prototypes are worth it. Changing a screen in a design tool takes minutes, while changing it after it is built takes days.</p>

<h2>Stage 3: building (the largest part)</h2>
<p>Building usually runs in short milestones: accounts and permissions first, then the core features, then the admin tools and integrations. Each milestone ends with something you can try on a test site.</p>
<p>What makes this stage longer:</p>
<ul>
  <li><strong>Integrations.</strong> Every outside service (payments, CRM, accounting, email, AI) adds setup, error handling and testing.</li>
  <li><strong>Complex permissions.</strong> "Managers see their team, admins see everything, clients see only their own records" is common and needs care.</li>
  <li><strong>Importing old data.</strong> Moving data from spreadsheets or an old system is often underestimated.</li>
  <li><strong>Real-time features.</strong> Live updates and collaboration need more engineering than ordinary pages.</li>
</ul>

<h2>Stage 4: testing and launch (about one week)</h2>
<p>Before launch, the app is tested on real devices and browsers, with real-looking data, by people who did not build it. Payments and permissions get special attention, because mistakes there are expensive. Launch itself covers the production server, domain, backups, monitoring and error tracking.</p>
<p>Plan a short period after launch for fixes. Real users always find something no test plan did.</p>

<h2>What speeds a project up</h2>
<ul>
  <li><strong>A small first version.</strong> Launch the core workflow, learn from real users, then add features. This is the single biggest time saver.</li>
  <li><strong>One decision-maker.</strong> Feedback from one person who can say yes is faster than waiting for a committee.</li>
  <li><strong>Proven technology.</strong> Mainstream tools such as React, Next.js, Node.js and PostgreSQL have ready-made, tested solutions for logins, payments and admin screens.</li>
  <li><strong>Fast feedback.</strong> Reviewing each milestone within a day or two keeps the team moving.</li>
</ul>

<h2>What slows it down</h2>
<ul>
  <li>Adding features mid-build without moving others to "later".</li>
  <li>Waiting for content, logins to third-party services or design approval.</li>
  <li>Starting without a scope, so the definition of "done" keeps changing.</li>
  <li>Choosing unusual technology that the team has to learn first.</li>
</ul>

<h2>After launch: planning the second version</h2>
<p>Launch is the start of learning, not the end of the project. In the first weeks, watch which features people actually use, where they get stuck and what they ask for. Error tracking shows what breaks, and simple analytics show which screens matter.</p>
<p>Use that to plan the second version in the same way as the first: a short list of what matters most, a timeline tied to it, and milestones you can test. Many successful products ship small updates every week or two rather than saving everything for one big release. It keeps risk low, and users see the product improving.</p>
<p>Budget for maintenance too. Security updates, library upgrades and small fixes are part of running any web app, and they are much cheaper done steadily than left to pile up.</p>

<h2>How to get a reliable timeline</h2>
<p>Write a short description of what the app must do for each type of user, list the services it must connect to, and mark what can wait for a second version. Then ask for a timeline tied to that scope, with milestones you can test along the way. A team that gives a timeline without asking these questions is guessing.</p>
<p>If you are still deciding who should build it, our guide to <a href="cost-to-hire-full-stack-developer.html">what it costs to hire a full-stack developer</a> compares freelancers, agencies and in-house hiring.</p>
`
};
