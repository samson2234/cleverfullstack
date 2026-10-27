// scripts/indexnow.js — tells IndexNow search engines (Bing, Yandex, Seznam, Naver; Bing also feeds ChatGPT search)
// which pages are new or changed, so they are crawled in hours instead of weeks.
//
// The key is public by design: it is the name and content of /<key>.txt at the site root, which proves we own the
// domain. Pages to submit come from sitemap.xml: new URLs or a changed <lastmod> since the given git ref.
//
//   node scripts/indexnow.js --since HEAD~1   (GitHub Actions, after each push that changes sitemap.xml)
//   node scripts/indexnow.js --all            (submit every page once)
//   add --dry-run to print the list without sending
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const SITE = 'https://cleverstack.dev';
const HOST = 'cleverstack.dev';
const args = process.argv.slice(2);
const dry = args.includes('--dry-run');

const keyFile = fs.readdirSync(root).find((f) => /^[0-9a-f]{32}\.txt$/.test(f));
if (!keyFile) throw new Error('no IndexNow key file (<32 hex>.txt) at the site root');
const key = keyFile.slice(0, -4);
if (fs.readFileSync(path.join(root, keyFile), 'utf8').trim() !== key) throw new Error(keyFile + ' must contain exactly its own key');

const local = fs.readFileSync(path.join(root, 'sitemap.xml'), 'utf8');
const lastmods = (xml) => Object.fromEntries([...xml.matchAll(/<loc>([^<]+)<\/loc>\s*<lastmod>([^<]+)<\/lastmod>/g)].map((m) => [m[1], m[2]]));

function changedUrls() {
  const now = lastmods(local);
  if (args.includes('--all')) return Object.keys(now);
  const i = args.indexOf('--since');
  if (i < 0) throw new Error('pass --since <git ref> or --all');
  let before = '';
  try { before = execFileSync('git', ['show', args[i + 1] + ':sitemap.xml'], { cwd: root, encoding: 'utf8' }); } catch (e) { return Object.keys(now); }
  const old = lastmods(before);
  return Object.keys(now).filter((u) => old[u] !== now[u]);
}

// only ping once the deployment is live: the published sitemap must match this commit's sitemap
async function waitForDeploy() {
  const norm = (s) => s.replace(/\r\n/g, '\n').trim();
  for (let t = 0; t < 40; t++) {
    try {
      const r = await fetch(SITE + '/sitemap.xml', { headers: { 'Cache-Control': 'no-cache' } });
      const k = await fetch(SITE + '/' + keyFile);
      if (r.ok && norm(await r.text()) === norm(local) && k.ok && (await k.text()).trim() === key) return true;
    } catch (e) { /* retry */ }
    await new Promise((res) => setTimeout(res, 15000));
  }
  return false;
}

(async () => {
  const urls = changedUrls();
  console.log(urls.length + ' changed page(s)' + (urls.length ? ':\n  ' + urls.join('\n  ') : ''));
  if (!urls.length || dry) return;
  if (!(await waitForDeploy())) { console.error('the live sitemap never matched this commit (deploy failed or still running); nothing sent'); process.exit(1); }
  const r = await fetch('https://api.indexnow.org/indexnow', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ host: HOST, key, keyLocation: SITE + '/' + keyFile, urlList: urls.slice(0, 10000) })
  });
  console.log('IndexNow answered HTTP ' + r.status + (r.status === 200 || r.status === 202 ? ' (accepted)' : ': ' + (await r.text()).slice(0, 300)));
  if (r.status >= 400) process.exit(1);
})().catch((e) => { console.error(e.message); process.exit(1); });
