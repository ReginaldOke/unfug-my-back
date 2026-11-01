import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bumpLastNumber } from '../web/lib/labels.js';

test('swiping changes the last number and keeps the rest of the text', () => {
  assert.equal(bumpLastNumber('8', 1), '9');
  assert.equal(bumpLastNumber('3 × 10', 2), '3 × 12');
  assert.equal(bumpLastNumber('40 kg × 8', -3), '40 kg × 5');
  assert.equal(bumpLastNumber('× 6 each side', 1), '× 7 each side');
  assert.equal(bumpLastNumber('2', -5), '0');
  assert.equal(bumpLastNumber('', 3), '3');
  assert.equal(bumpLastNumber('✓', 1), '1');
});
