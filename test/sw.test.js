import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const web = fileURLToPath(new URL('../web/', import.meta.url));

function filesIn(dir) {
  return readdirSync(dir).flatMap(name => {
    const p = join(dir, name);
    if (name.startsWith('.') || name === 'vendor') return [];
    return statSync(p).isDirectory() ? filesIn(p) : [relative(web, p)];
  });
}

test('service worker precaches every file the app needs offline', () => {
  const src = readFileSync(join(web, 'sw.js'), 'utf8');
  const list = JSON.parse(src.match(/const ASSETS = (\[[\s\S]*?\]);/)[1].replace(/'/g, '"').replace(/,\s*\]/, ']'));
  const needed = filesIn(web).filter(f => f !== 'sw.js');
  const missing = needed.filter(f => !list.includes(f));
  assert.deepEqual(missing, [], `Add these to ASSETS in web/sw.js: ${missing.join(', ')}`);
});
