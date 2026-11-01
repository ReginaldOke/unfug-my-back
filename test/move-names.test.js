import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findByName, normName } from '../web/lib/move-names.js';

const MOVES = [
  { id: 'plank', names: ['plank', 'front plank', 'forearm plank'] },
  { id: 'side', names: ['side plank', 'side bridge'] },
  { id: 'bridge', names: ['glute bridge', 'bridge', 'hip bridge'] },
  { id: 'pull', names: ['pull up', 'pullup', 'chin up'] },
  { id: 'child', names: ['child pose', 'childs pose', 'balasana'] },
  { id: 'hinge', names: ['hinge', 'deadlift', 'rdl', 'romanian deadlift'] },
  { id: 'row', names: ['bent over row', 'row'] },
  { id: 'knee', names: ['knee to chest'] },
  { id: 'knees', names: ['double knee to chest', 'knees to chest'] },
  { id: 'bird', names: ['bird dog'] },
  { id: 'dog', names: ['cobra and downward dog', 'downward dog'] },
];
const id = name => findByName(MOVES, name)?.id ?? null;

test('names are matched however they are written', () => {
  assert.equal(normName("Child's Poses"), 'child pose');
  assert.equal(id('Pull-ups'), 'pull');
  assert.equal(id('pullups'), 'pull');
  assert.equal(id('Weighted pull ups'), 'pull');
  assert.equal(id('Chin-up'), 'pull');
  assert.equal(id("Child's pose"), 'child');
  assert.equal(id('Balasana (child)'), 'child');
  assert.equal(id('RDL'), 'hinge');
  assert.equal(id('Romanian deadlifts 3x8'), 'hinge');
  assert.equal(id('Glute bridges'), 'bridge');
});

test('the most specific name wins', () => {
  assert.equal(id('Side plank'), 'side');
  assert.equal(id('Forearm plank'), 'plank');
  assert.equal(id('Double knee to chest'), 'knees');
  assert.equal(id('Single knee to chest'), 'knee');
  assert.equal(id('Bird dog'), 'bird');
  assert.equal(id('Downward dog'), 'dog');
});

test('small typos still match; unrelated names do not', () => {
  assert.equal(id('glute brdige'), 'bridge');
  assert.equal(id('deadlfit'), 'hinge');
  assert.equal(id('Throw'), null); // "row" only as a whole word
  assert.equal(id('Tennis'), null);
  assert.equal(id(''), null);
});
