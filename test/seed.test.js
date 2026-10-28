import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SEED_FACTORS } from '../web/lib/seed.js';

test('new users start with 4 stressors and 3 helpers switched on', () => {
  const on = SEED_FACTORS.filter(f => f.defaultOn);
  assert.equal(on.filter(f => f.role === 'trigger').length, 4);
  assert.equal(on.filter(f => f.role === 'helper').length, 3);
  assert.equal(on.length, 7);
});

test('seed factor names are unique', () => {
  const names = SEED_FACTORS.map(f => f.name);
  assert.equal(new Set(names).size, names.length);
});
