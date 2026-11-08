import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

// The screenshot build fills the app with a made-up diary. It must never be left where a phone build picks it up.
test('the iOS app folder never holds the demo diary', () => {
  const pub = new URL('../ios/App/App/public/', import.meta.url);
  assert.equal(existsSync(new URL('demo.js', pub)), false, 'Rebuild: npm run build:app && npx cap sync ios');
  if (existsSync(new URL('index.html', pub))) assert.ok(!readFileSync(new URL('index.html', pub), 'utf8').includes('demo.js'));
});
