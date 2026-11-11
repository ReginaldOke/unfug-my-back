import { test } from 'node:test';
import assert from 'node:assert/strict';
import { moveValue, moveText, progressRows } from '../web/lib/progress.js';

test('the number charted for a move: weight, then time, then reps', () => {
  assert.deepEqual(moveValue({ did: '3 × 8', extra: '75 kg' }), { value: 75, unit: 'kg' });
  assert.deepEqual(moveValue({ did: '3 × 8' }), { value: 24, unit: 'reps' });
  assert.deepEqual(moveValue({ did: '× 6 each side' }), { value: 6, unit: 'reps' });
  assert.deepEqual(moveValue({ did: '0:45' }), { value: 45, unit: 's' });
  assert.deepEqual(moveValue({ did: '1:02:10' }), { value: 3730, unit: 's' });
  assert.deepEqual(moveValue({ did: '30 s each side' }), { value: 30, unit: 's' });
  assert.deepEqual(moveValue({ did: '2 min' }), { value: 120, unit: 's' });
  assert.deepEqual(moveValue({ did: '12', extra: '22.5 lbs' }), { value: 22.5, unit: 'lb' });
  assert.equal(moveValue({ did: '✓' }), null);
});

test('rows keep the routine’s order, then add anything else that was logged', () => {
  const sessions = [
    { date: '2026-11-01', log: [{ name: 'Bench press', did: '3 × 8', extra: '70 kg' }] },
    { date: '2026-11-04', log: [{ name: 'Bench press', did: '3 × 8', extra: '72.5 kg' }, { name: 'Dead hang', did: '0:40', timed: true }] },
  ];
  const rows = progressRows(['Bench press', 'Squats'], sessions);
  assert.deepEqual(rows.map(r => r.name), ['Bench press', 'Squats', 'Dead hang']);
  assert.deepEqual(rows[0].values.map(v => v.value), [70, 72.5]);
  assert.deepEqual(rows[1].entries, [null, null]);
  assert.deepEqual(rows[2].values.map(v => v?.value ?? null), [null, 40]);
  assert.equal(moveText(sessions[1].log[0]), '3 × 8 · 72.5 kg');
  assert.equal(moveText({ did: '✓' }), 'Done');
});

test('a move dropped from the routine without ever being done gets no row', () => {
  const sessions = [
    { date: '2026-11-01', log: [{ name: 'Bench press', did: '3 × 8' }, { name: 'Cable fly', did: '' }] },
    { date: '2026-11-03', log: [{ name: 'Bench press', did: '3 × 8' }, { name: 'Dead hang', did: '0:40' }] },
  ];
  const names = progressRows(['Bench press', 'Push-ups'], sessions).map(r => r.name);
  // Cable fly was removed and never had a value; Push-ups is new but still in the routine; the hang was done
  assert.deepEqual(names, ['Bench press', 'Push-ups', 'Dead hang']);
});
