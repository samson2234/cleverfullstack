// scripts/build-blog.js — builds blog posts from blog-src/*.js and keeps every place that lists posts in sync.
//
//   npm run blog          builds/rebuilds all posts in blog-src/ (idempotent)
//
// For each source it writes blog/<id>.html (same layout, header, footer and styles as the existing posts) and then
// updates: blog/posts.json, the post list inside blog/index.html, blog/feed.xml (RSS), sitemap.xml, the
// previous/next navigation inside EVERY post page, and the "Latest Insights" preview on the homepage (script.js).
// After running it, run `npm run assets` (script.js changes) and `npm test`.
//
// To add a post: create blog-src/<id>.js (copy an existing one), add a cover with `node scripts/make-blog-covers.js`,
// run `npm run blog`.

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const BASE = 'https://cleverfullstack.vercel.app';
const AUTHOR = 'Henry George';
const TEMPLATE = path.join(root, 'blog', 'website-mistakes-conversions.html'); // layout donor (head styles, footer, scripts)
const ORDER = [ // tie-break for posts published the same day (first = shown first)
  'website-no-enquiries-fix', 'why-is-my-website-slow', 'google-maps-local-seo-checklist',
  'how-to-get-more-client-reviews', 'should-i-fix-or-rebuild-my-website', 'website-security-basics-small-business'
];

const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const write = (f, s) => fs.writeFileSync(path.join(root, f), s);
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const url = (id) => BASE + '/blog/' + id;
const cover = (id) => '/images/blog/' + id + '.webp';

function loadSources() {
  const dir = path.join(root, 'blog-src');
  const list = fs.readdirSync(dir).filter((f) => f.endsWith('.js')).map((f) => require(path.join(dir, f)));
  const seen = new Set();
  for (const p of list) {
    for (const k of ['id', 'title', 'excerpt', 'description', 'category', 'date', 'iso', 'body', 'cta', 'related']) if (!p[k]) throw new Error((p.id || '?') + ': missing ' + k);
    // reading time comes from the real word count (about 200 words a minute), never guessed
    const words = p.body.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length;
    p.readingTime = Math.max(3, Math.round(words / 200)) + ' min read';
    if (seen.has(p.id)) throw new Error('duplicate id ' + p.id);
    seen.add(p.id);
    if (!fs.existsSync(path.join(root, 'images', 'blog', p.id + '.webp'))) throw new Error(p.id + ': cover missing (run node scripts/make-blog-covers.js)');
  }
  const ord = (id) => { const i = ORDER.indexOf(id); return i < 0 ? 999 : i; };
  return list.sort((a, b) => (b.iso > a.iso ? 1 : b.iso < a.iso ? -1 : ord(a.id) - ord(b.id) || a.id.localeCompare(b.id)));
}

function renderPost(p, tpl) {
  let html = tpl;
  const title = esc(p.title);
  const sub = (re, to) => { if (!re.test(html)) throw new Error('template anchor missing: ' + re); html = html.replace(re, () => to); };

  sub(/<title>[\s\S]*?<\/title>/, '<title>' + title + ' | CleverStack</title>');
  sub(/<meta name="description" content="[^"]*">/, '<meta name="description" content="' + esc(p.description) + '">');
  sub(/<meta property="og:title" content="[^"]*">/, '<meta property="og:title" content="' + title + '">');
  sub(/<meta property="og:description" content="[^"]*">/, '<meta property="og:description" content="' + esc(p.description) + '">');
  sub(/<meta property="og:url" content="[^"]*">/, '<meta property="og:url" content="' + url(p.id) + '">');
  sub(/<meta property="og:image" content="[^"]*">/, '<meta property="og:image" content="' + BASE + cover(p.id) + '">');
  sub(/<meta name="twitter:title" content="[^"]*">/, '<meta name="twitter:title" content="' + title + '">');
  sub(/<meta name="twitter:description" content="[^"]*">/, '<meta name="twitter:description" content="' + esc(p.description) + '">');
  sub(/<link rel="canonical" href="[^"]*">/, '<link rel="canonical" href="' + url(p.id) + '">');
  sub(/<link rel="preload" as="image" href="[^"]*">/, '<link rel="preload" as="image" href="' + cover(p.id) + '">');
  sub(/<link rel="alternate" hreflang="en" href="[^"]*">/, '<link rel="alternate" hreflang="en" href="' + url(p.id) + '">');
  sub(/<link rel="alternate" hreflang="x-default" href="[^"]*">/, '<link rel="alternate" hreflang="x-default" href="' + url(p.id) + '">');

  // structured data: replace both JSON-LD blocks (breadcrumbs + article)
  const ld = (o) => '<script type="application/ld+json">' + JSON.stringify(o) + '</script>';
  const crumbs = ld({ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: BASE + '/' },
    { '@type': 'ListItem', position: 2, name: 'Blog', item: BASE + '/blog' },
    { '@type': 'ListItem', position: 3, name: p.title, item: url(p.id) }] });
  const article = ld({ '@context': 'https://schema.org', '@type': 'Article', headline: p.title, description: p.description,
    author: { '@type': 'Person', name: AUTHOR }, publisher: { '@type': 'Organization', '@id': BASE + '/#organization' },
    datePublished: p.iso, dateModified: p.iso, mainEntityOfPage: { '@type': 'WebPage', '@id': url(p.id) }, image: BASE + cover(p.id) });
  let n = 0;
  html = html.replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/g, () => (n++ === 0 ? crumbs + article : ''));
  if (n !== 2) throw new Error('expected 2 JSON-LD blocks in template, found ' + n);

  const related = p.related.map(([href, label]) => '<a href="' + esc(href) + '" style="color:var(--indigo);font-weight:600">' + esc(label) + '</a>').join('');
  const main = '<main id="main"><div class="post-hero" style="background-image:url(\'' + cover(p.id) + '\')"><div class="overlay"></div><div class="content"><div class="meta"><span class="cat">' + esc(p.category) + '</span><span>' + esc(p.date) + '</span><span>' + esc(p.readingTime) + '</span></div><h1>' + title + '</h1><div class="author-line">By ' + AUTHOR + '</div></div></div>' +
    '<div class="post-body rich"><div class="back-bar"><a href="index.html">&larr; Back to all articles</a></div>' + p.body.trim() +
    '<div class="keep-reading" style="display:flex;flex-wrap:wrap;gap:8px 20px;margin:32px 0 0;padding-top:24px;border-top:1px solid var(--border);font-size:14px;color:var(--text-muted)"><span style="font-weight:600;color:var(--text-dark)">Keep reading:</span>' + related + '</div>' +
    '<div class="cta-section"><h3>' + esc(p.cta.h3) + '</h3><p>' + esc(p.cta.p) + '</p><a href="' + esc(p.cta.href) + '" class="btn btn-primary btn-glow">' + esc(p.cta.btn) + ' <span class="btn-arrow">&rarr;</span></a></div>' +
    '<div class="post-nav" id="postNav"></div></div></main>';
  html = html.replace(/<main id="main">[\s\S]*?<\/main>/, () => main);
  sub(/var cur="[^"]*"/, 'var cur="' + p.id + '"');
  return html;
}

function main() {
  const sources = loadSources();
  const tpl = read(path.relative(root, TEMPLATE));
  const log = [];

  // 1) pages
  for (const p of sources) { write('blog/' + p.id + '.html', renderPost(p, tpl)); log.push('wrote blog/' + p.id + '.html'); }

  // 2) posts.json (new posts first; existing ones keep their order)
  const entry = (p) => ({ id: p.id, title: p.title, excerpt: p.excerpt, author: AUTHOR, date: p.date, category: p.category, image: cover(p.id), readingTime: p.readingTime });
  const ids = new Set(sources.map((p) => p.id));
  const existing = JSON.parse(read('blog/posts.json')).filter((p) => !ids.has(p.id));
  const posts = sources.map(entry).concat(existing);
  write('blog/posts.json', JSON.stringify(posts, null, 2) + '\n');
  log.push('posts.json: ' + posts.length + ' posts');

  // 3) blog index list
  let idx = read('blog/index.html');
  const list = '[\n' + posts.map((p) => '  ' + JSON.stringify(p)).join(',\n') + '\n];';
  if (!/var posts = \[[\s\S]*?\r?\n\];/.test(idx)) throw new Error('posts array not found in blog/index.html');
  idx = idx.replace(/var posts = \[[\s\S]*?\r?\n\];/, () => 'var posts = ' + list);
  write('blog/index.html', idx);

  // 4) RSS feed (newest first)
  const rfc = (d) => new Date(d + ' 00:00:00 UTC').toUTCString().replace('GMT', '+0000');
  const sorted = posts.slice().sort((a, b) => new Date(b.date + ' 00:00:00 UTC') - new Date(a.date + ' 00:00:00 UTC'));
  const items = sorted.map((p) => '    <item>\n      <title>' + esc(p.title).replace(/&quot;/g, '"') + '</title>\n      <link>' + url(p.id) + '</link>\n      <guid isPermaLink="true">' + url(p.id) + '</guid>\n      <pubDate>' + rfc(p.date) + '</pubDate>\n      <category>' + esc(p.category) + '</category>\n      <author>henryygeorge25@gmail.com (' + AUTHOR + ')</author>\n      <description><![CDATA[' + p.excerpt + ']]></description>\n    </item>').join('\n');
  let feed = read('blog/feed.xml');
  feed = feed.replace(/<lastBuildDate>[^<]*<\/lastBuildDate>/, () => '<lastBuildDate>' + rfc(sorted[0].date) + '</lastBuildDate>');
  feed = feed.replace(/(<atom:link[^>]*\/>\r?\n)[\s\S]*<\/channel>/, (m, head) => head + items + '\n  </channel>');
  write('blog/feed.xml', feed);

  // 5) sitemap
  let sm = read('sitemap.xml');
  for (const p of posts) { // every post, so older posts that were never listed get added too
    if (sm.includes('<loc>' + url(p.id) + '</loc>')) continue;
    const iso = new Date(p.date + ' 00:00:00 UTC').toISOString().slice(0, 10);
    sm = sm.replace('</urlset>', '  <url>\n    <loc>' + url(p.id) + '</loc>\n    <lastmod>' + iso + '</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>0.7</priority>\n  </url>\n</urlset>');
  }
  write('sitemap.xml', sm);

  // 6) previous/next navigation inside every post page
  const nav = '[' + posts.map((p) => '{id:' + JSON.stringify(p.id) + ',title:' + JSON.stringify(p.title) + ',cat:' + JSON.stringify(p.category) + '}').join(',') + ']';
  let navPages = 0;
  for (const f of fs.readdirSync(path.join(root, 'blog')).filter((x) => x.endsWith('.html') && x !== 'index.html')) {
    const s = read('blog/' + f);
    // two layouts exist: minified `var blogPosts=[...];var cur=` and a spaced `var blogPosts = [...]; var cur = `
    const re = /var blogPosts\s*=\s*\[[\s\S]*?\];(?=\s*var cur\s*=)/;
    if (!re.test(s)) continue;
    write('blog/' + f, s.replace(re, () => 'var blogPosts=' + nav + ';'));
    navPages++;
  }
  log.push('prev/next updated in ' + navPages + ' pages');

  // 7) homepage "Latest Insights" (3 newest)
  let sc = read('script.js');
  const prev = sorted.slice(0, 3).map((p) => ({ id: p.id, title: p.title, excerpt: p.excerpt, category: p.category, date: p.date, image: p.image }));
  if (!/previewPosts=\[[\s\S]*?\}\](?=,html="")/.test(sc)) throw new Error('previewPosts not found in script.js');
  sc = sc.replace(/previewPosts=\[[\s\S]*?\}\](?=,html="")/, () => 'previewPosts=' + JSON.stringify(prev));
  write('script.js', sc);
  log.push('homepage preview: ' + prev.map((p) => p.id).join(', '));

  console.log(log.join('\n'));
  console.log('Next: npm run assets && npm test');
}

main();
