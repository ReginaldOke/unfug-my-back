import { test } from 'node:test';
import assert from 'node:assert/strict';
import { describeRoutineChange, meaningfulChanges } from '../web/lib/routine-changes.js';

const m = (...names) => names.map(n => (Array.isArray(n) ? { name: n[0], dose: n[1] } : { name: n, dose: '× 4' }));

test('routine changes read as one short line', () => {
  assert.equal(describeRoutineChange(m('Cat-cow'), m('Cat-cow', 'Bird dog')), 'Added Bird dog');
  assert.equal(describeRoutineChange(m('Cat-cow', 'Bird dog'), m('Bird dog')), 'Removed Cat-cow');
  assert.equal(describeRoutineChange(m('A', 'B'), m('B', 'C')), 'Added C, removed A');
  // New orders, doses and renamed moves aren't changes worth comparing before and after
  assert.equal(describeRoutineChange(m('A', 'B'), m('B', 'A')), null);
  assert.equal(describeRoutineChange(m('A'), m(['A', '× 8'])), null);
  assert.equal(describeRoutineChange(m('Cat cow', 'B'), m('Cat-cow stretch', 'B')), null);
  assert.equal(describeRoutineChange(m('A', 'B'), m('A', 'B')), null);
});

test('only big changes count, from the first time a routine was done', () => {
  const changes = [
    { routineId: 'r1', date: '2026-11-01', summary: 'Started Mobility' },
    { routineId: 'r1', date: '2026-11-02', summary: 'Added Bird dog' }, // set up before it was ever done
    { routineId: 'r1', date: '2026-11-05', summary: 'Changed the dose of Bird dog' },
    { routineId: 'r1', date: '2026-11-06', summary: 'New order' },
    { routineId: 'r1', date: '2026-11-07', summary: 'Added Cat-cow stretch, removed Cat cow' },
    { routineId: 'r1', date: '2026-11-08', summary: 'Added Plank' },
    { routineId: 'r2', date: '2026-11-03', summary: 'Started Gym' }, // never done
  ];
  const done = [{ routineId: 'r1', date: '2026-11-04' }, { routineId: 'r1', date: '2026-11-09' }];
  assert.deepEqual(meaningfulChanges(changes, done).map(c => `${c.date} ${c.summary}`), ['2026-11-04 Started Mobility', '2026-11-08 Added Plank']);
});
