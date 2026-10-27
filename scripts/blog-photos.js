// scripts/blog-photos.js — real stock photos (Unsplash, free licence) as blog covers, one distinct photo per post.
// Downloads each photo once, crops it to 3:2 and writes /images/blog/<post>-photo-<480|800|1200|1400>.webp, then points
// every reference (posts.json, the blog index, the post page, feed and sitemap) at it. New file names, so the
// 30-day image cache can never show the old cover. Safe to re-run.
//
// Needs `sharp`:  npm i --no-save sharp   then:  node scripts/blog-photos.js
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const root = path.resolve(__dirname, '..');
// post id -> [Unsplash photo id, alt text describing the photo for this article]
const PHOTOS = {
  'website-no-enquiries-fix': ['1526628953301-3e589a6a8b74', 'Website analytics on a screen showing visitors who never get in touch'],
  'why-is-my-website-slow': ['1607434472257-d9f8e57a643d', 'A loading bar, the wait visitors have on a slow website'],
  'google-maps-local-seo-checklist': ['1637504577505-f412b971d911', 'A customer searching for a local business on her phone in the city'],
  'how-to-get-more-client-reviews': ['1633613286991-611fe299c4be', 'A row of five gold stars, like a five-star client review'],
  'should-i-fix-or-rebuild-my-website': ['1600132806608-231446b2e7af', 'A hand-drawn website wireframe for planning a redesign'],
  'website-security-basics-small-business': ['1614064641938-3bbee52942c7', 'A red padlock on a laptop keyboard, website security'],
  'poor-website-killing-business': ['1758519288176-0cde8339e06f', 'A business owner reviewing his website on a laptop'],
  'optimized-website-advantages': ['1426024084828-5da21e13f5dc', 'A website shown on a laptop, tablet and phone'],
  'how-much-does-business-website-cost': ['1626266061368-46a8f578ddd6', 'Working out a website budget with a calculator'],
  'why-small-business-needs-website': ['1753351052363-53ce102830eb', 'A small business owner in her coffee shop']
};
const WIDTHS = [480, 800, 1200, 1400];
const name = (id, w) => id + '-photo-' + w + '.webp';

async function download(photo) {
  const url = 'https://images.unsplash.com/photo-' + photo + '?w=1600&q=85&fm=jpg&fit=crop&ar=3:2&crop=entropy';
  const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/141', Accept: 'image/*' } });
  if (!r.ok) throw new Error(photo + ': HTTP ' + r.status);
  const buf = Buffer.from(await r.arrayBuffer());
  if (buf.length < 10000) throw new Error(photo + ': suspiciously small download');
  return buf;
}

const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const write = (f, s) => fs.writeFileSync(path.join(root, f), s);

(async () => {
  const posts = JSON.parse(read('blog/posts.json'));
  for (const [id, [photo, alt]] of Object.entries(PHOTOS)) {
    const post = posts.find((p) => p.id === id);
    if (!post) throw new Error('unknown post ' + id);
    if (!fs.existsSync(path.join(root, 'images/blog', name(id, 1400)))) {
      const src = await download(photo);
      for (const w of WIDTHS) {
        await sharp(src).resize(w, Math.round(w * 2 / 3), { fit: 'cover', position: 'attention' }).webp({ quality: 78 }).toFile(path.join(root, 'images/blog', name(id, w)));
      }
    }
    const old = post.image; // e.g. /images/blog/<id>.webp or /images/blog/u-<photo>-800.webp
    post.image = '/images/blog/' + name(id, 800);
    post.imageAlt = alt;

    // the post page: hero, og:image, preload, schema, srcset
    const file = 'blog/' + id + '.html';
    let html = read(file);
    const before = html;
    const m = old.match(/\/images\/blog\/(u-[0-9a-f-]+)-\d+\.webp$/);
    if (m) html = html.replace(new RegExp('/images/blog/' + m[1] + '-(\\d+)\\.webp', 'g'), (_, w) => '/images/blog/' + name(id, WIDTHS.includes(+w) ? w : 1200));
    else html = html.split('/images/blog/' + id + '.webp').join('/images/blog/' + name(id, 1200));
    html = html.replace(/(<img[^>]*src="\/images\/blog\/[^"]*-photo-\d+\.webp"[^>]*alt=")[^"]*(")/, '$1' + alt.replace(/"/g, '&quot;') + '$2');
    if (html === before) throw new Error(file + ': no cover reference replaced');
    write(file, html);
    console.log('cover ->', id);
  }
  write('blog/posts.json', JSON.stringify(posts, null, 2) + '\n');

  // the blog index cards are written by scripts/build-blog.js from posts.json — run `npm run blog` after this

  // feed + any other listing that names the old covers
  for (const f of ['blog/feed.xml', 'sitemap.xml', 'index.html']) {
    if (!fs.existsSync(path.join(root, f))) continue;
    let s = read(f); const b = s;
    for (const id of Object.keys(PHOTOS)) s = s.split('/images/blog/' + id + '.webp').join('/images/blog/' + name(id, 1200));
    if (s !== b) { write(f, s); console.log('updated', f); }
  }
})().catch((e) => { console.error(e.message); process.exit(1); });
