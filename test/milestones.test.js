import { test } from 'node:test';
import assert from 'node:assert/strict';
import { streakMilestone, calmMilestone, calmBanner } from '../web/lib/milestones.js';
import { addDays } from '../web/lib/dates.js';

const T = '2026-11-24';
const days = (n, end = T, skip = []) => Array.from({ length: n }, (_, i) => addDays(end, -i)).filter(d => !skip.includes(d));
const entries = (dates, pain = () => 2) => dates.map(date => ({ date, painScore: pain(date) }));

test('a streak milestone lands only on the day it is reached', () => {
  assert.equal(streakMilestone(days(3), T).id, 'streak-3');
  assert.equal(streakMilestone(days(7), T).id, 'streak-7');
  assert.equal(streakMilestone(days(8), T), null);
  assert.equal(streakMilestone(days(30), T).days, 30);
  assert.equal(streakMilestone(days(2), T), null);
  // A gap starts a new streak, with its own key
  const again = streakMilestone([...days(3), ...days(5, addDays(T, -5))], T);
  assert.equal(again.key, `streak-3-${addDays(T, -2)}`);
});

test('a calm stretch is seven or thirty days without a flare, mostly checked in', () => {
  assert.equal(calmMilestone(entries(days(6)), [], T), null);
  assert.equal(calmMilestone(entries(days(7)), [], T).id, 'calm-7');
  assert.equal(calmMilestone(entries(days(7)), [], T).reached, T);
  // A day or two missed is fine, a week mostly missed isn't
  assert.equal(calmMilestone(entries(days(7, T, [addDays(T, -3)])), [], T).id, 'calm-7');
  assert.equal(calmMilestone(entries([T, addDays(T, -6)]), [], T), null);
  assert.equal(calmMilestone(entries(days(14)), [], T).id, 'calm-14');
  assert.equal(calmMilestone(entries(days(30)), [], T).id, 'calm-30');
  // A flare day (pain 5 or more) starts the count again
  const flare = addDays(T, -5);
  assert.equal(calmMilestone(entries(days(20), d => (d === flare ? 6 : 2)), [], T), null);
  assert.equal(calmMilestone(entries(days(20), d => (d === addDays(T, -7) ? 6 : 2)), [], T).key, `calm-7-${addDays(T, -6)}`);
  // So does a flare logged on its own, and there's nothing to celebrate on a flare day
  assert.equal(calmMilestone(entries(days(20)), [{ timestamp: `${flare}T10:00:00`, intensity: 7 }], T), null);
  assert.equal(calmMilestone(entries(days(20), d => (d === T ? 7 : 2)), [], T), null);
});

test('the calm banner shows for a few days after, until dismissed', () => {
  const e = entries(days(9));
  const m = calmBanner(e, [], T);
  assert.equal(m.id, 'calm-7');
  assert.equal(m.reached, addDays(T, -2));
  assert.equal(calmBanner(e, [], T, { [m.key]: true }), null);
  assert.equal(calmBanner(entries(days(12)), [], T), null);
});
