// NFR: freshness — every shared CSS/JS reference is versioned by content so deploys never serve stale assets
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('all html references to style.css / script.js / i18n.js / analytics.js carry the current content hash', () => {
  const r = spawnSync(process.execPath, ['scripts/version-assets.js', '--check'], { cwd: root, encoding: 'utf8' });
  assert.equal(r.status, 0, (r.stderr || '') + (r.stdout || '') + '\n→ run `npm run assets` and commit the result');
});
