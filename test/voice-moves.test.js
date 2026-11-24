import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spokenMoves, matchMove, spokenAmount, digits } from '../web/lib/voice-moves.js';

test('numbers said as words become digits', () => {
  assert.equal(digits('twenty five push ups'), '25 push ups');
  assert.equal(digits('a dozen squats'), '12 squats');
  assert.equal(digits('half a minute plank'), '30 seconds plank');
});

test('what was said becomes moves with their reps', () => {
  assert.deepEqual(spokenMoves('20 Bulgarian split squats'), [{ name: 'Bulgarian split squats', did: '20' }]);
  assert.deepEqual(spokenMoves('I did 12 more squats'), [{ name: 'Squats', did: '12' }]);
  assert.deepEqual(spokenMoves('twenty five pushups and a forty five second plank'), [{ name: 'Push-up', did: '25' }, { name: 'Plank', did: '45 s' }]);
  assert.deepEqual(spokenMoves('side plank 30 seconds each side'), [{ name: 'Side plank', did: '30 s each side' }]);
  assert.deepEqual(spokenMoves('um'), []);
});

test('a spoken name finds the move it means', () => {
  const items = [{ name: 'Push-ups' }, { name: 'Plank + side plank' }, { name: 'Squats' }];
  assert.equal(matchMove(items, 'Pushup').name, 'Push-ups');
  assert.equal(matchMove(items, 'Squat').name, 'Squats');
  assert.equal(matchMove(items, 'Plank').name, 'Plank + side plank');
  assert.equal(matchMove(items, 'Lunges'), null);
});

test('reps for the player box', () => {
  assert.equal(spokenAmount('twelve'), '12');
  assert.equal(spokenAmount('three sets of ten'), '3 × 10');
  assert.equal(spokenAmount('forty five seconds'), '45 s');
});
