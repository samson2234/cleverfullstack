// Translation & localization service page (/translation-services). Built by scripts/build-landing.js like the other
// service pages, but kept as its own kind ('translation'): it is linked from /services and llms.txt, not from the
// site-wide footer or the web-development country pages, so the site's web-development focus stays as it is.
// Every experience claim below comes from the localization lead's CV (Nov 2026). Client titles are under NDA:
// never name a game, publisher or agency here. No phone number, no percentages, no invented results.
module.exports = [
  {
    slug: 'translation-services',
    kind: 'translation',
    name: 'Translation & Localization Services',
    serviceType: 'Translation and localization',
    title: 'Game Localization & Translation Services: Japanese, English, Thai | CleverStack',
    description: 'Japanese, English and Thai translation for games, software, subtitles and manga. 450,000+ words of game text localized, in-build LQA, NDAs signed.',
    eyebrow: 'Translation & Localization',
    h1: 'Game localization and translation by people who play, test and ship',
    sub: 'Japanese, English and Thai translation for game studios, publishers, software teams and creators. We adapt the story, the jokes and the UI so your players read it as if it was written for them, and we check it inside the build before it ships.',
    heroStats: [['450,000+', 'Words of game text localized'], ['JA · EN · TH', 'Direct language pairs']],
    areas: ['United States', 'United Kingdom', 'Canada', 'Germany', 'Europe', 'Japan', 'Thailand'],
    price: {
      label: 'Quote per word or per project',
      delivery: 'about 2,500 words per day per linguist; larger releases are split across vetted linguists',
      includes: 'Translation and cultural adaptation, glossary and style guide, a second-pass review, delivery in your original file format and one round of changes. In-build LQA, subtitle timing and lettering-ready manga scripts are quoted with the project.'
    },
    introH2: 'Translation is only half the job',
    intro: [
      'A line can be translated correctly and still fail in the game. It overflows the dialogue box, a variable lands in the wrong place, the joke falls flat, or a character who sounded sharp in Japanese sounds flat in English. Players notice, reviews notice, and the fix after launch costs far more than doing it properly the first time.',
      'We translate with the finished screen in mind. Every project starts with a glossary and a character voice guide, every string is checked against its context, and where you can give us a build we play it and log every overflow, truncation and context error before your players ever see it.'
    ],
    forWho: [
      'Game studios and publishers releasing Japanese titles in English, or Western titles in Japan',
      'Mobile and live-service teams that need fast, consistent updates, events and patch notes',
      'Studios that want direct Japanese to Thai, with no English pivot in between',
      'Software and app teams localizing their interface, help text and store listings',
      'Manga, webtoon and light novel publishers and creators reaching English readers',
      'Agencies that need extra vetted Japanese, English or Thai linguists for a large release'
    ],
    deliverables: [
      ['Game localization', 'Dialogue, quests, skill trees, item text, UI strings and lore for PC, console and mobile. JRPGs, gacha RPGs, visual novels and tactical RPGs, with character voices kept consistent from the first line to the last patch.'],
      ['IT and software localization', 'Apps, websites and SaaS products: interface strings, error messages, onboarding, help articles and app store listings. We work in your JSON, PO or spreadsheet files, or directly in Lokalise, Crowdin or Phrase.'],
      ['Subtitling', 'Subtitles for trailers, cutscenes, promotional videos and creator content, written to be read at speed and kept within line and length limits. Delivered as SRT or VTT, or in your own template.'],
      ['Manga and light novel translation', 'Japanese to English manga, webtoon and light novel translation that keeps honorifics, tone and sound effects natural, delivered as a lettering-ready script with page and panel references.'],
      ['Linguistic quality assurance (LQA)', 'We test the translated text inside pre-release builds and log text overflows, variable truncation, font and rendering issues and context errors in Jira or your own tracker, with screenshots.'],
      ['Marketing and store adaptation', 'Trailers, patch notes, eShop and app store pages and launch posts adapted for North American, Japanese and Southeast Asian players, written to win wishlists and pre-orders rather than read like a translation.']
    ],
    pairs: [
      ['Japanese → English', 'Near-native Japanese, primary pair', 'JRPG dialogue, visual novels, skill trees, UI string optimization, manga'],
      ['English → Japanese', 'Full professional', 'Narrative adaptation, character voice bibles, Western IP culturalization'],
      ['Thai ⇄ English', 'Full professional', 'Gaming slang and registers, mobile gacha live-ops, community releases'],
      ['Japanese ⇄ Thai', 'Direct, no English pivot', 'Direct JA–TH adaptation, so nothing is lost in a second translation']
    ],
    lead: {
      name: 'Samson',
      role: 'Localization Lead, Japanese · English · Thai',
      bio: 'Samson leads translation and localization at CleverStack and has worked in game localization since 2020: first as a contract localization and LQA coordinator for a Japan and Asia-Pacific mobile and PC game publisher, then running an independent localization and translation scouting practice.',
      points: [
        'About 450,000 words localized across three Japanese mobile gacha RPGs, two visual novels and a tactical SRPG (titles under NDA)',
        'Full LQA on pre-release PC and mobile builds: text overflow, variable truncation and context errors logged in Jira',
        'Marketing trailers, patch notes and eShop listings adapted for North American, Japanese and Southeast Asian players',
        'Worked with UI engineers to check text rendering and dynamic tags in Japanese, Chinese, Korean and Thai typography',
        'Wrote lore bibles, character speech matrices and glossaries in memoQ and Gridly to cut context bugs',
        'Reviewed direct Japanese to Thai localization pipelines for live-service mobile RPGs',
        'Sources, tests and onboards English, Japanese and Thai game linguists and LQA testers for studios and agencies'
      ],
      education: [
        ['M.A. in International Languages and Cultures', 'Setsunan University, Osaka, Japan (2021). Japanese pop culture, applied translation, cross-cultural media.'],
        ['B.A. in Japanese Language and Literature', 'Oakland University, Michigan, USA (2019). Japanese to English and English to Japanese translation.']
      ],
      languages: ['ja', 'en', 'th']
    },
    tools: ['memoQ', 'Trados', 'Phrase (Memsource)', 'Gridly', 'Lokalise', 'Crowdin', 'Unity Localization', 'Unreal Engine', 'Jira', 'TestRail', 'JSON / PO files', 'SRT / VTT subtitles'],
    process: [
      ['Brief, NDA and test', 'Send the files, word count, target languages and deadline. We sign your NDA first, and a short translation test is available so you can judge the quality before you commit.'],
      ['Quote, glossary and style guide', 'A written quote per word or per project, then a shared glossary and character voice guide, so names, terms and tone stay the same across every file and every update.'],
      ['Translate and adapt', 'Translation and cultural adaptation in your CAT tool or file format, with questions batched and sent early so nothing is guessed.'],
      ['Review, LQA and delivery', 'A second-pass review, in-build checks where you give us a build, and delivery in the original format, ready to import. We stay on hand for patches and live-ops updates.']
    ],
    sections: [
      ['Why direct Japanese, English and Thai matters', [
        'When a Japanese game reaches Thai players through English, it has been translated twice: Japanese to English, then English to Thai. Every pass loses something, from a character\'s way of speaking to a pun that only works in the original. We translate Japanese to Thai directly, and we review existing Japanese to Thai pipelines for live-service games, so the Thai version is built from the source, not from a copy of a copy.',
        'The same care goes the other way. Western games entering Japan need more than correct Japanese: they need the right level of politeness for each character, names that read naturally in katakana, and UI text that fits the screen. We plan that before the first string is translated.'
      ]],
      ['Your text, inside the game, before your players see it', [
        'Most localization problems only show up on screen: a line that is too long for the box, a {player_name} tag in the wrong place, Thai or Japanese text cut off by a font that does not support it. Our LQA is done inside the build, and every issue is logged with a screenshot, the string ID and a suggested fix.',
        'Because CleverStack is also a full-stack web development studio, we understand string files, variables and how a UI handles different lengths of text. When a problem is in the code rather than the translation, we can say exactly where it is.'
      ]],
      ['Confidential by default', [
        'Unreleased games, scripts and builds stay private. We sign your NDA before receiving files, keep your material out of public machine translation tools, and never name a client or title without permission. That is also why our past titles are not listed here: samples and references are available under NDA on request.'
      ]]
    ],
    faqs: [
      ['Which languages do you translate?', 'Japanese, English and Thai. Our main pairs are Japanese to English, English to Japanese, Thai to and from English, and Japanese to and from Thai directly, without translating through English first.'],
      ['How much does game translation cost?', 'We quote per word or per project, depending on the type of text, the deadline and whether you need LQA, subtitles or lettering-ready scripts. You get a written quote before any work starts, with no hidden fees.'],
      ['How fast can you translate?', 'One linguist translates about 2,500 words per day at full quality. For larger releases we split the work across vetted linguists who follow the same glossary and style guide, so the voice stays consistent.'],
      ['Can we test your quality first?', 'Yes. We are happy to complete a short translation test on your own text, and samples of past work are available under NDA.'],
      ['Do you sign NDAs?', 'Yes, always before we receive any unreleased material. We never name a client or a title in public without written permission.'],
      ['What file formats and tools do you work with?', 'memoQ, Trados, Phrase, Gridly, Lokalise and Crowdin, plus JSON and PO files, spreadsheets, and Unity and Unreal localization tables. Subtitles are delivered as SRT or VTT, and manga as a script with page and panel references.'],
      ['Do you do LQA testing?', 'Yes. We test translated text inside pre-release PC and mobile builds and log text overflow, variable truncation, rendering and context errors in Jira, TestRail or your own tracker.'],
      ['Do you translate manga and subtitles as well as games?', 'Yes. We translate manga, webtoons and light novels from Japanese to English, and write subtitles for trailers, cutscenes and video content in Japanese, English and Thai.'],
      ['Can you also build the game website or app?', 'Yes. CleverStack is a full-stack web development studio, so the same team can build your game\'s website, a companion app or the tools around it, and localize them.']
    ],
    related: ['mobile-app-development', 'saas-mvp-development'],
    ctaHeading: 'Send us your text. We\'ll show you what it should read like.'
  }
];
