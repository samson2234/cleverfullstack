// FR/NFR: blog integrity — every post exists, is discoverable (index, feed, sitemap, prev/next), is well-formed and links nothing broken.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const BASE = 'https://cleverfullstack.vercel.app';
const posts = JSON.parse(read('blog/posts.json'));
const cfg = JSON.parse(read('vercel.json'));
const csp = cfg.headers.flatMap((h) => h.headers).find((h) => h.key === 'Content-Security-Policy').value;
const imgSrc = csp.split(';').map((s) => s.trim()).find((s) => s.startsWith('img-src')).split(/\s+/).slice(1);

test('posts.json: unique ids, required fields, a page for each', () => {
  assert.ok(posts.length >= 18, 'expected at least 18 posts, got ' + posts.length);
  assert.equal(new Set(posts.map((p) => p.id)).size, posts.length, 'duplicate ids');
  for (const p of posts) {
    for (const k of ['id', 'title', 'excerpt', 'author', 'date', 'category', 'image', 'readingTime']) assert.ok(p[k], `${p.id}: missing ${k}`);
    assert.ok(fs.existsSync(path.join(root, 'blog', p.id + '.html')), `${p.id}: page missing`);
  }
});

test('every post image loads: local file exists, or the host is allowed by the Content-Security-Policy', () => {
  for (const p of posts) {
    if (p.image.startsWith('/')) assert.ok(fs.existsSync(path.join(root, p.image)), `${p.id}: ${p.image} missing`);
    else assert.ok(imgSrc.includes(new URL(p.image).origin), `${p.id}: image host ${new URL(p.image).origin} blocked by CSP`);
  }
});

test('the blog index lists exactly the posts in posts.json, in the same order', () => {
  const m = read('blog/index.html').match(/var posts = (\[[\s\S]*?\r?\n\]);/);
  assert.ok(m, 'posts array not found in blog/index.html');
  const inline = JSON.parse(m[1]);
  assert.deepEqual(inline.map((p) => p.id), posts.map((p) => p.id));
});

test('feed and sitemap contain every post', () => {
  const feed = read('blog/feed.xml'), sm = read('sitemap.xml');
  for (const p of posts) {
    assert.ok(feed.includes(`${BASE}/blog/${p.id}</link>`), `${p.id}: not in feed.xml`);
    assert.ok(sm.includes(`<loc>${BASE}/blog/${p.id}</loc>`), `${p.id}: not in sitemap.xml`);
  }
});

test('every post page is well-formed: one h1, good title/description, canonical, valid structured data', () => {
  for (const p of posts) {
    const html = read('blog/' + p.id + '.html');
    assert.equal((html.match(/<h1[ >]/g) || []).length, 1, `${p.id}: needs exactly one h1`);
    const title = (html.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || '';
    assert.ok(title.length > 10 && title.length <= 110, `${p.id}: title length ${title.length}`);
    const desc = (html.match(/<meta name="description" content="([^"]*)"/) || [])[1] || '';
    const isNew = fs.existsSync(path.join(root, 'blog-src', p.id + '.js'));
    assert.ok(desc.length >= 70 && desc.length <= (isNew ? 160 : 175), `${p.id}: meta description length ${desc.length}`);
    assert.ok(html.includes(`<link rel="canonical" href="${BASE}/blog/${p.id}">`), `${p.id}: canonical`);
    const ld = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
    assert.ok(ld.length >= 2, `${p.id}: structured data`);
    for (const b of ld) JSON.parse(b[1]);
    assert.ok(!/TODO|lorem ipsum|undefined|\[object Object\]/i.test(html.replace(/<script[\s\S]*?<\/script>/g, '')), `${p.id}: placeholder text`);
  }
});

test('previous/next navigation on every post page knows about every post', () => {
  for (const p of posts) {
    const html = read('blog/' + p.id + '.html');
    const m = html.match(/var blogPosts\s*=\s*\[([\s\S]*?)\];\s*var cur\s*=\s*"([^"]*)"/);
    assert.ok(m, `${p.id}: nav array missing`);
    assert.equal(m[2], p.id, `${p.id}: nav "cur" is ${m[2]}`);
    for (const q of posts) assert.ok(m[1].includes(`id:"${q.id}"`), `${p.id}: nav is missing ${q.id}`);
  }
});

test('internal links inside the new posts all resolve', () => {
  const dir = path.join(root, 'blog-src');
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.js'))) {
    const src = fs.readFileSync(path.join(dir, f), 'utf8');
    const html = (src.match(/body: `([\s\S]*)`\s*\};?\s*$/) || [])[1] || '';
    const rel = src.match(/related: \[([\s\S]*?)\n  \],/);
    const hrefs = [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1]).concat(rel ? [...rel[1].matchAll(/\['([^']+)'/g)].map((m) => m[1]) : []);
    assert.ok(hrefs.length > 0, `${f}: no links found`);
    for (const h of hrefs) {
      if (/^(https?:|mailto:|tel:)/.test(h)) continue;
      const target = h.split('#')[0];
      assert.ok(fs.existsSync(path.join(root, 'blog', target)), `${f}: broken link ${h}`);
    }
  }
});

test('new posts: each solves a stated problem, with a useful length and a call to action', () => {
  const dir = path.join(root, 'blog-src');
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.js'))) {
    const src = fs.readFileSync(path.join(dir, f), 'utf8');
    const body = (src.match(/body: `([\s\S]*)`\s*\};?\s*$/) || [])[1] || '';
    const words = body.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length;
    assert.ok(words >= 900, `${f}: only ${words} words`);
    assert.ok(/class="callout"/.test(body), `${f}: needs an "In short" summary`);
    assert.ok((body.match(/<h2>/g) || []).length >= 5, `${f}: needs at least 5 sections`);
    assert.ok(/cta:\s*\{/.test(src), `${f}: needs a call to action`);
    const id = (src.match(/id: '([^']+)'/) || [])[1];
    const mins = parseInt(posts.find((p) => p.id === id).readingTime, 10);
    assert.ok(Math.abs(mins - words / 200) <= 1, `${f}: reading time ${mins} min vs ${Math.round(words / 200)} by word count`);
  }
});
