import { test } from 'node:test';
import assert from 'node:assert/strict';
import { describeRoutineChange } from '../web/lib/repos.js';

const m = (...names) => names.map(n => (Array.isArray(n) ? { name: n[0], dose: n[1] } : { name: n, dose: '× 4' }));

test('routine changes read as one short line', () => {
  assert.equal(describeRoutineChange(m('Cat-cow'), m('Cat-cow', 'Bird dog')), 'Added Bird dog');
  assert.equal(describeRoutineChange(m('Cat-cow', 'Bird dog'), m('Bird dog')), 'Removed Cat-cow');
  assert.equal(describeRoutineChange(m('A', 'B'), m('B', 'C')), 'Added C, removed A');
  assert.equal(describeRoutineChange(m('A', 'B'), m('B', 'A')), 'New order');
  assert.equal(describeRoutineChange(m('A'), m(['A', '× 8'])), 'Changed the dose of A');
  assert.equal(describeRoutineChange(m('A', 'B'), m('A', 'B')), null);
});
