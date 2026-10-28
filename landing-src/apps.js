// App and extension services (added Oct 2026: mobile, desktop, plugins and browser extensions).
// Same rules as services.js: real projects only. Starting prices confirmed by the owner on 27 Oct 2026.
module.exports = [
  {
    slug: 'mobile-app-development',
    kind: 'service',
    name: 'Mobile App Development',
    title: 'Mobile App Development: iOS & Android Apps | CleverStack',
    description: 'Mobile app development for iOS and Android with React Native: one codebase, native feel, backend and App Store launch included. Fixed quote after a free call.',
    eyebrow: 'Mobile App Development',
    h1: 'Mobile app development for iOS and Android',
    sub: 'Cross-platform apps built with React Native, with the backend, admin panel and app store launch handled by the same team.',
    price: { from: 3000, label: 'Starting price, iOS + Android', delivery: 'Agreed in your proposal', includes: 'Mobile apps start from $3,000 for iOS and Android together. Apps vary a lot in size, so we scope yours on a free call and send a fixed quote with milestones. The quote covers design, the app, its backend and the App Store and Google Play submission.' },
    intro: [
      'A mobile app puts your product in your customer\'s pocket: on their home screen, with notifications that bring them back, and features that use the camera, location and offline storage. Done badly, it is also an expensive way to collect one-star reviews.',
      'We build mobile apps with React Native, so one codebase runs on both iPhone and Android with a native look and feel. You get a single team for the app, the backend it talks to and the admin tools you use to run it, which keeps cost down and stops features falling between separate vendors.'
    ],
    forWho: [
      'Startups launching a new app product or MVP',
      'Businesses whose customers keep asking for an app',
      'Companies with a web app that need a mobile version',
      'Teams with an outdated or unstable app that needs a rebuild',
      'Founders who need an app with AI features such as image analysis or recommendations'
    ],
    deliverables: [
      ['App design', 'Screens and user flows designed for small screens and thumbs, agreed with you before we build.'],
      ['iOS and Android app', 'One React Native codebase that runs natively on both platforms, including tablets where needed.'],
      ['Backend and API', 'User accounts, data, payments and notifications on a secure backend, with an admin panel for your team.'],
      ['Device features', 'Camera, photos, location, push notifications, offline mode and in-app purchases, as your app needs them.'],
      ['App store launch', 'Store listings, screenshots, privacy details and submission to the App Store and Google Play.'],
      ['Updates and support', 'Bug fixes, OS updates and new features after launch, quoted as a monthly plan if you want it.']
    ],
    sections: [
      ['Why React Native', [
        'React Native lets us write the app once and ship it to both iOS and Android, instead of building and maintaining two separate apps. For most business apps that means a faster launch and lower running costs, without users noticing any difference. Where a feature needs native code, such as a hardware integration, we write that part natively.',
        'It also shares a language with the web, so the same team can build your website, web app and mobile app, and share logic between them.'
      ]],
      ['From idea to the app stores', [
        'We start by agreeing the core features for the first release: what a user must be able to do on day one, and what can wait. Then we design the key screens, build in short milestones you can test on your own phone, and prepare the store listings while the app is in final testing.',
        'Apple and Google both review apps before they go live. We know their guidelines and prepare privacy details, permissions and test accounts in advance, so reviews pass quickly.'
      ]],
      ['After launch', [
        'Real users find problems no test plan does. We set up crash reporting and analytics before launch, so we see what breaks and which features people actually use, and plan the next release with you based on that.'
      ]]
    ],
    cases: ['ai-skincare-mobile-app', 'fittrack-fitness-tracking-app'],
    faqs: [
      ['How much does a mobile app cost?', 'Mobile apps start from $3,000 for iOS and Android. The final price depends on the features, so we scope it on a free call and give you a fixed quote with milestones before any work starts.'],
      ['Do you build for both iPhone and Android?', 'Yes. We use React Native, so one codebase runs on both, which is faster and cheaper than two separate apps.'],
      ['Will you publish the app to the App Store and Google Play?', 'Yes. We prepare the listings and handle submission, under your own developer accounts so the app belongs to you.'],
      ['Can you add AI features?', 'Yes. We have built apps with on-device image analysis and personalised recommendations, and we integrate AI models where they help users.'],
      ['Can you take over an existing app?', 'Yes. We review the code and its dependencies first, then fix, update or gradually rebuild it.'],
      ['Who owns the code?', 'You do. The code, designs and store accounts are yours.']
    ],
    related: ['desktop-app-development', 'saas-mvp-development', 'hire-full-stack-developers']
  },
  {
    slug: 'desktop-app-development',
    kind: 'service',
    name: 'Desktop App Development',
    title: 'Desktop App Development: Windows, macOS & Linux | CleverStack',
    description: 'Desktop app development for Windows, macOS and Linux with Electron or Tauri: offline-ready tools, auto-updates, installers and secure sync. Fixed quotes.',
    eyebrow: 'Desktop App Development',
    h1: 'Desktop app development for Windows, macOS and Linux',
    sub: 'Cross-platform desktop applications built with Electron or Tauri: installers, auto-updates, offline work and sync with your systems.',
    price: { from: 5000, label: 'Starting price, Windows, macOS & Linux', delivery: 'Agreed in your proposal', includes: 'Desktop apps start from $5,000. Each one is scoped on a free call and quoted as a fixed price with milestones. The quote covers design, the app, installers and code signing for each platform, and auto-updates.' },
    intro: [
      'Some software belongs on the desktop: tools people use all day, work that has to continue without an internet connection, apps that read and write local files, talk to hardware or need more power than a browser tab gives them.',
      'We build cross-platform desktop apps that install like any other program, update themselves, and work on Windows, macOS and Linux from one codebase. Because they are built with web technology, they can share code and design with your website or web app.'
    ],
    forWho: [
      'Companies that need an internal tool their team uses all day',
      'Software products that need a desktop version alongside the web app',
      'Businesses replacing old desktop software or spreadsheets',
      'Teams that need to work offline and sync when back online',
      'Products that need local files, printers or connected hardware'
    ],
    deliverables: [
      ['Cross-platform app', 'One codebase for Windows, macOS and Linux, built with Electron or Tauri depending on size and performance needs.'],
      ['Installers and signing', 'Signed installers for each platform, so users can install without security warnings.'],
      ['Auto-updates', 'Updates delivered automatically in the background, so everyone runs the latest version.'],
      ['Offline and sync', 'Local data storage that keeps working offline and syncs with your server when a connection is available.'],
      ['System integration', 'Local files, notifications, system tray, printing, and connected devices where your app needs them.'],
      ['Security', 'Sandboxing, secure storage of credentials and safe communication with your backend.']
    ],
    sections: [
      ['Electron or Tauri?', [
        'Electron is mature and widely used, and the right choice when the app needs a large ecosystem of libraries or must match an existing web app exactly. Tauri produces much smaller, lighter apps by using the operating system\'s own web view, and suits tools that should start fast and use little memory.',
        'We recommend one based on your app, not habit, and explain the trade-off in plain language before we start.'
      ]],
      ['Built to be maintained', [
        'Desktop apps live on users\' machines for years, across operating system updates. We keep dependencies up to date, test on each platform you support, and set up crash reporting so problems are visible to us before users report them.'
      ]],
      ['Web, mobile and desktop from one team', [
        'Because our desktop apps use the same technology as our web and mobile work, one team can build your product on every platform and share logic and design between them. Features stay consistent and bug fixes reach every version.',
        'If you already have a web app, a desktop version can often reuse much of its interface, which shortens the build considerably.'
      ]],
      ['How a desktop project runs', [
        'We start with a free call about who will use the app, on which operating systems, and what it must do offline. You get a written scope and fixed quote with milestones. During the build you receive test versions to install on your own machines after each milestone, so feedback comes from real use rather than screenshots.',
        'Before release we set up code signing certificates, the update server and crash reporting, and test installation and updates on every platform you support. After launch, the code, signing keys and accounts are handed over to you.'
      ]]
    ],
    faqs: [
      ['How much does a desktop app cost?', 'Desktop apps start from $5,000. We scope yours on a free call and send a fixed quote with milestones before work starts.'],
      ['Which operating systems do you support?', 'Windows, macOS and Linux, from one codebase. You choose which ones to release on.'],
      ['Can the app work offline?', 'Yes. Data is stored locally and synced with your server when the connection returns.'],
      ['Can you turn our web app into a desktop app?', 'Usually, yes, and much of the existing interface can often be reused.'],
      ['How are updates delivered?', 'Automatically. The app checks for updates and installs them in the background, with release notes if you want them.'],
      ['Who owns the app and the code?', 'You do. The code, code signing certificates and distribution accounts are set up in your name or handed over at the end.']
    ],
    related: ['mobile-app-development', 'plugin-extension-development', 'react-nextjs-development']
  },
  {
    slug: 'plugin-extension-development',
    kind: 'service',
    name: 'Plugin & Extension Development',
    title: 'Plugin & Browser Extension Development | CleverStack',
    description: 'Custom plugin and extension development: WordPress and WooCommerce plugins, Shopify apps, and Chrome, Edge and Firefox browser extensions. Fixed quotes.',
    eyebrow: 'Plugins & Extensions',
    h1: 'Custom plugin and browser extension development',
    sub: 'WordPress and WooCommerce plugins, Shopify apps and Chrome, Edge and Firefox extensions, built cleanly, securely and ready for their marketplaces.',
    price: { from: 1000, label: 'Starting price', delivery: 'Agreed in your proposal', includes: 'Plugins and browser extensions start from $1,000. Each one is scoped on a free call and quoted as a fixed price. Marketplace submission, documentation and a support plan can be included.' },
    intro: [
      'Sometimes the software you use does almost everything you need. A plugin or extension adds the missing piece, without replacing a system your team already knows. It can also be a product in its own right, sold or offered free on a marketplace to reach users where they already are.',
      'We build plugins and extensions that follow each platform\'s rules and coding standards, so they pass review, stay compatible with updates, and do not slow down the site or browser they run in.'
    ],
    forWho: [
      'Businesses that need a feature their WordPress, WooCommerce or Shopify site cannot do',
      'Software companies that want a browser extension for their product',
      'Founders launching a plugin or extension as a product',
      'Teams relying on an abandoned plugin that needs replacing',
      'Companies automating repetitive work in the browser'
    ],
    deliverables: [
      ['WordPress and WooCommerce plugins', 'Custom plugins built to WordPress coding standards, with settings pages, blocks, shortcodes, and checkout or product extensions.'],
      ['Shopify apps', 'Custom and public Shopify apps and theme app extensions, using Shopify\'s APIs and billing.'],
      ['Browser extensions', 'Extensions for Chrome, Edge and Firefox built on Manifest V3, with popups, side panels and page integrations.'],
      ['Integrations', 'Connections to your CRM, payment provider, AI models or internal systems through their APIs.'],
      ['Marketplace submission', 'Listings, screenshots, privacy details and submission to the WordPress directory, Shopify App Store or browser stores.'],
      ['Maintenance', 'Compatibility updates when the platform changes, plus bug fixes and new features on a support plan.']
    ],
    sections: [
      ['Security and performance first', [
        'A plugin runs inside someone else\'s website and an extension runs inside someone\'s browser, so mistakes affect far more than your own code. We validate and escape all input and output, ask only for the permissions the feature needs, and load code only on the pages that use it.',
        'That keeps sites fast, protects users\' data, and makes marketplace reviews much smoother.'
      ]],
      ['Keeping up with platform changes', [
        'WordPress, Shopify and the browsers change their rules regularly: Chrome\'s move to Manifest V3 is a recent example that broke many older extensions. We build on current standards and offer a maintenance plan that tests and updates your plugin or extension when platforms change.'
      ]],
      ['Plugin or custom build?', [
        'If you need something many other businesses also need, an existing plugin may do the job and we will tell you so. A custom plugin makes sense when the feature is specific to how you work, when existing options are slow or insecure, or when the plugin is your product.'
      ]],
      ['How a plugin or extension project runs', [
        'We agree the scope on a free call and send a fixed quote. You then get a test version to install on a staging site or your own browser after each milestone. Before release we test against the platform versions your users run, prepare documentation and settings help, and, for marketplace products, set up the listing, support contact and update process.'
      ]]
    ],
    faqs: [
      ['How much does a custom plugin or extension cost?', 'Plugins and extensions start from $1,000. The final price depends on what it needs to do, so we scope it on a free call and send a fixed quote before work starts.'],
      ['Which browsers do you support?', 'Chrome, Edge and Firefox, and other Chromium-based browsers. Extensions are built on Manifest V3.'],
      ['Can you publish it to the marketplace?', 'Yes. We prepare the listing and handle submission to the WordPress directory, Shopify App Store or browser extension stores.'],
      ['Can you fix or replace a plugin we already use?', 'Yes. We can fix an existing plugin, or build a cleaner replacement and migrate its data.'],
      ['Will it slow down my website?', 'No. We load code only where it is needed and test the effect on page speed before release.'],
      ['Who owns the plugin or extension?', 'You do. The code and marketplace listings are yours, published under your own developer accounts.']
    ],
    related: ['wordpress-woocommerce-development', 'shopify-development', 'desktop-app-development']
  }
];
