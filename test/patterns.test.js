import { test } from 'node:test';
import assert from 'node:assert/strict';
import { flareRunUp, routineShifts, binomialTail } from '../web/lib/patterns.js';
import { addDays } from '../web/lib/dates.js';

const T = '2026-11-24';

test('binomial tail', () => {
  assert.ok(Math.abs(binomialTail(3, 3, 0.2) - 0.008) < 1e-9);
  assert.ok(Math.abs(binomialTail(0, 5, 0.3) - 1) < 1e-9);
});

/** 90 days, pain 3 and sleep 7, with flares (pain 7) on the given days ago, poor sleep (3) on `poor` days ago. */
function diary({ flares = [], poor = [] }) {
  const dailyEntries = [];
  for (let i = 89; i >= 0; i--) {
    const date = addDays(T, -i);
    dailyEntries.push({ date, painScore: flares.includes(i) ? 7 : 3, sleepQuality: poor.includes(i) ? 3 : 7, stressScore: 4 });
  }
  return { dailyEntries, factorLogs: [], flares: [], routineCompletions: [] };
}

test('poor sleep in the two days before most flares is a pattern; before only one, it is not', () => {
  const flares = [10, 30, 50, 70];
  const before = flares.flatMap(f => [f + 1, f + 2]);
  const x = flareRunUp(diary({ flares, poor: before }), [], T);
  assert.equal(x?.subject.id, 'score-sleepQuality');
  assert.equal(x.k, 4);
  assert.equal(x.flares[0].start, addDays(T, -10));
  assert.equal(flareRunUp(diary({ flares, poor: [11, 12] }), [], T), null);
  // Too few flares to say
  assert.equal(flareRunUp(diary({ flares: [10, 30], poor: [11, 12, 31, 32] }), [], T), null);
  // Poor sleep all the time isn't a warning sign
  assert.equal(flareRunUp(diary({ flares, poor: Array.from({ length: 90 }, (_, i) => i) }), [], T), null);
});

test('pain moving after a routine starts, only when it is clear', () => {
  const r = { id: 'r1', name: 'Daily mobility' };
  const make = (beforePain, afterPain) => {
    const d = diary({});
    d.dailyEntries.forEach((e, i) => { e.painScore = i < 60 ? beforePain + (i % 3) - 1 : afterPain + (i % 3) - 1; });
    return d;
  };
  const done = Array.from({ length: 30 }, (_, i) => ({ routineId: 'r1', date: addDays(T, -29 + i) }));
  const x = routineShifts(make(5, 3), [r], done, T);
  assert.equal(x.length, 1);
  assert.ok(Math.abs(x[0].delta + 2) < 0.1);
  assert.deepEqual(routineShifts(make(4, 3.8), [r], done, T), []);
  // Hardly done since it started
  assert.deepEqual(routineShifts(make(5, 3), [r], done.slice(0, 5), T), []);
});
