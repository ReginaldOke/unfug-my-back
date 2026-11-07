import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkinSteps, cleanSlider } from '../web/lib/checkin-steps.js';

const ids = s => checkinSteps(s).map(st => st.id);

test('the default check-in asks where it hurts straight after pain, then eating after sleep', () => {
  assert.deepEqual(ids(), ['pain', 'where', 'stress', 'sleep', 'food', 'move', 'stressors', 'helpers', 'notes']);
});

test('steps can be switched off, but never pain', () => {
  assert.deepEqual(ids({ checkinHidden: ['pain', 'stress', 'notes'] }), ['pain', 'where', 'sleep', 'food', 'move', 'stressors', 'helpers']);
});

test('custom sliders sit with the other sliders, before exercise, and can be switched off', () => {
  const customSliders = [{ id: 'energy', name: 'Energy', good: 'high' }, { id: 'mood', name: 'Mood' }];
  assert.deepEqual(ids({ customSliders }).slice(4, 8), ['food', 'c:energy', 'c:mood', 'move']);
  assert.ok(!ids({ customSliders, checkinHidden: ['c:mood'] }).includes('c:mood'));
});

test('bad custom sliders are dropped', () => {
  assert.equal(cleanSlider({ id: 'x', name: '  ' }), null);
  assert.equal(cleanSlider({ id: '../x', name: 'Bad' }), null);
  assert.deepEqual(cleanSlider({ id: 'a1', name: 'Energy', good: 'nope' }), { id: 'a1', name: 'Energy', good: 'high' });
});
