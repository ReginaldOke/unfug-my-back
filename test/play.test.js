import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isTimed, formVideoUrl, startIndex } from '../web/lib/play.js';

test('moves done for time are told apart from moves done for reps', () => {
  for (const [name, dose] of [['Plank', ''], ['Dead hang', ''], ['Wall sit', '3 × 1'], ['Hamstring stretch', '30 s each side'],
    ['Child pose', '1 min'], ['Side plank', '0:45'], ['L-sit', ''], ['Hollow body hold', ''], ['Run', '20 minutes']]) {
    assert.equal(isTimed(name, dose), true, `${name} ${dose}`);
  }
  for (const [name, dose] of [['Bench press', '3 × 8'], ['Squats', '5 × 5'], ['Bird dog', '× 6 each side'], ['Push-ups', '3 × 15'], ['Hanging leg raise', '3 × 10']]) {
    assert.equal(isTimed(name, dose), false, `${name} ${dose}`);
  }
  // What was actually done counts too: a time typed into the box
  assert.equal(isTimed('Farmer carry', '3 × 40 m', '1:10'), true);
});

test('the form video link searches short videos of the move, as if typed into YouTube', () => {
  const url = new URL(formVideoUrl(' Romanian deadlift '));
  assert.equal(url.hostname, 'www.youtube.com');
  assert.equal(url.searchParams.get('search_query'), 'Romanian deadlift form #shorts');
  assert.equal(url.searchParams.get('sp'), null);
});

test('a session picks up at the first move not yet done', () => {
  assert.equal(startIndex([{ done: true }, { done: false }, { done: false }]), 1);
  assert.equal(startIndex([{ done: false }, { done: false }]), 0);
  // All done (an earlier run today): start again from the top
  assert.equal(startIndex([{ done: true }, { done: true }]), 0);
});

test('breathing and meditation link to short guided sessions instead of form videos', () => {
  assert.equal(new URL(formVideoUrl('Box breathing')).searchParams.get('search_query'), 'Box breathing guided breathing #shorts');
  assert.equal(new URL(formVideoUrl('Body scan')).searchParams.get('search_query'), 'Body scan guided meditation #shorts');
});
