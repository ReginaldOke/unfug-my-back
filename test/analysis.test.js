import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lagComparison, painByDate, amountsByDate, doseResponse, flareAssociation, consistency, analyseFactor, rankInsights, MIN_DAYS } from '../web/lib/analysis.js';
import { addDays } from '../web/lib/dates.js';

const START = '2026-09-01';

/** Synthetic diary: factor on even days; pain is `base`, plus `bump` on days `lag` after the factor. */
function synth({ days = 20, lag = 1, bump = 3, base = 2 } = {}) {
  const dailyEntries = [], factorLogs = [];
  const on = i => i % 2 === 0;
  for (let i = 0; i < days; i++) {
    const date = addDays(START, i);
    const pain = base + (i - lag >= 0 && on(i - lag) ? bump : 0);
    dailyEntries.push({ date, painScore: pain });
    if (on(i)) factorLogs.push({ factorId: 'f1', date, value: 60 });
  }
  return { dailyEntries, factorLogs, flares: [] };
}

test('lag 1 effect is found at lag 1 and not at lag 0', () => {
  const d = synth({ lag: 1, bump: 3 });
  const pain = painByDate(d.dailyEntries);
  const amounts = amountsByDate(d.factorLogs, 'f1');
  const dates = d.dailyEntries.map(e => e.date);

  const l1 = lagComparison(pain, amounts, dates, 1);
  assert.equal(l1.enough, true);
  assert.equal(l1.meanWith, 5);
  assert.equal(l1.meanWithout, 2);
  assert.equal(l1.delta, 3);

  const l0 = lagComparison(pain, amounts, dates, 0);
  assert.equal(l0.enough, true);
  // On factor days (even) pain is base (bump lands on odd days), so same-day delta is negative
  assert.ok(l0.delta < 0);
});

test('lag 2 matches a manual check', () => {
  const d = synth({ lag: 2, bump: 4, days: 16 });
  const pain = painByDate(d.dailyEntries);
  const amounts = amountsByDate(d.factorLogs, 'f1');
  const dates = d.dailyEntries.map(e => e.date);
  const l2 = lagComparison(pain, amounts, dates, 2);
  // Manual: factor days 0,2,...,14 -> pain on day+2 (2,4,...,16); day 16 has no entry, so 7 pairs, all 6.
  // Without days 1,3,...,13 (15 -> 17 missing) -> 7 pairs, all 2.
  assert.equal(l2.nWith, 7);
  assert.equal(l2.nWithout, 7);
  assert.equal(l2.meanWith, 6);
  assert.equal(l2.meanWithout, 2);
});

test('below the threshold reports not enough data and how many more days are needed', () => {
  const d = synth({ days: 7 }); // factor on days 0,2,4,6 = 4 days with
  const r = lagComparison(painByDate(d.dailyEntries), amountsByDate(d.factorLogs, 'f1'), d.dailyEntries.map(e => e.date), 0);
  assert.equal(r.enough, false);
  assert.equal(r.nWith, 4);
  assert.equal(r.needWith, MIN_DAYS - 4);
  assert.equal(r.meanWith, undefined);
});

test('exactly the threshold is enough', () => {
  const d = synth({ days: 10 }); // 5 with, 5 without
  const r = lagComparison(painByDate(d.dailyEntries), amountsByDate(d.factorLogs, 'f1'), d.dailyEntries.map(e => e.date), 0);
  assert.equal(r.nWith, 5);
  assert.equal(r.nWithout, 5);
  assert.equal(r.enough, true);
});

test('days without a check-in are not counted as "without"', () => {
  const pain = new Map([[START, 3]]);
  const amounts = new Map();
  const r = lagComparison(pain, amounts, [START], 1); // no pain entry the next day
  assert.equal(r.nWith + r.nWithout, 0);
});

test('dose response buckets pain by amount', () => {
  const dates = [], pain = new Map(), amounts = new Map();
  const rows = [[0, 1], [0, 1], [10, 2], [20, 3], [60, 5], [90, 6], [240, 8], [300, 9]];
  rows.forEach(([a, p], i) => { const d = addDays(START, i); dates.push(d); pain.set(d, p); if (a) amounts.set(d, a); });
  const buckets = doseResponse(pain, amounts, dates);
  assert.deepEqual(buckets.map(b => b.label), ['None', 'Low', 'Medium', 'High']);
  assert.equal(buckets[0].meanPain, 1);
  assert.ok(buckets[3].meanPain > buckets[1].meanPain);
  assert.equal(buckets.reduce((n, b) => n + b.n, 0), rows.length);
});

test('flare association counts factor on the flare day or the day before', () => {
  const amounts = new Map([['2026-09-02', 30]]);
  const flares = [
    { timestamp: new Date(2026, 8, 2, 15).toISOString() }, // same day
    { timestamp: new Date(2026, 8, 3, 9).toISOString() },  // next day
    { timestamp: new Date(2026, 8, 6, 9).toISOString() },  // unrelated
  ];
  assert.deepEqual(flareAssociation(flares, amounts), { hits: 2, total: 3 });
  assert.equal(flareAssociation([], amounts), null);
});

test('helper consistency counts days done in the window', () => {
  const today = '2026-09-14';
  const amounts = new Map([[today, 1], [addDays(today, -1), 1], [addDays(today, -20), 1]]);
  assert.deepEqual(consistency(amounts, today, 14), { done: 2, days: 14 });
});

test('analyseFactor picks the strongest lag and ranks insights', () => {
  const d = synth({ lag: 1, bump: 3, days: 24 });
  const factor = { id: 'f1', name: 'Desk sitting', role: 'trigger', measureType: 'minutes' };
  const a = analyseFactor(factor, d, addDays(START, 23));
  assert.equal(a.best.lag, 1);
  assert.ok(a.best.delta > 0);
  const { ready } = rankInsights(d, [factor], addDays(START, 23));
  assert.equal(ready[0].factor.id, 'f1');
});

test('early signs show from a few check-ins and are labelled early', async () => {
  const { rankInsights, quickSummary } = await import('../web/lib/analysis.js');
  const d = synth({ lag: 0, bump: 3, days: 5 }); // factor on days 0,2,4 (3 with), 2 without
  // make same-day pain higher on factor days
  d.dailyEntries.forEach((e, i) => { e.painScore = i % 2 === 0 ? 6 : 2; });
  const factor = { id: 'f1', name: 'Desk sitting', role: 'trigger', measureType: 'minutes' };
  const { ready } = rankInsights(d, [factor], addDays(START, 4));
  assert.equal(ready.length, 1);
  assert.equal(ready[0].early, true);
  assert.equal(ready[0].best.lag, 0);
  assert.equal(ready[0].best.delta, 4);

  const q = quickSummary(d, [factor, { id: 'h1', name: 'Walking', role: 'helper', measureType: 'minutes' }], addDays(START, 4));
  assert.equal(q.mainStressor.factor.id, 'f1');
  assert.equal(q.mainStressor.days, 3);
  assert.equal(q.mainStressor.avg, 60);
  assert.equal(q.topHelper, null);
});

test('trend findings turn two weeks of links into something to try', async () => {
  const { trendFindings } = await import('../web/lib/analysis.js');
  const today = addDays(START, 13);
  const dailyEntries = [], factorLogs = [];
  for (let i = 0; i < 14; i++) {
    const date = addDays(START, i);
    const sit = (i * 37) % 5 * 60; // 0–240 minutes, mixed
    const walk = i % 3 === 0 ? 1 : 0;
    dailyEntries.push({ date, painScore: 2 + sit / 60 });
    if (sit) factorLogs.push({ factorId: 'sit', date, value: sit });
    if (walk) factorLogs.push({ factorId: 'coffee', date, value: 1 });
    // A "stressor" that comes with lower pain
    if (sit <= 60) factorLogs.push({ factorId: 'tv', date, value: 30 + i });
  }
  const factors = [
    { id: 'sit', name: 'Desk sitting', role: 'trigger', measureType: 'minutes' },
    { id: 'tv', name: 'TV time', role: 'trigger', measureType: 'minutes' },
    { id: 'coffee', name: 'Coffee', role: 'trigger', measureType: 'yesno' },
  ];
  const found = trendFindings({ dailyEntries, factorLogs }, factors, today);
  const byId = Object.fromEntries(found.map(f => [f.factor.id, f]));
  assert.equal(byId.sit.kind, 'avoid');
  assert.match(byId.sit.body, /cutting back on desk sitting/);
  assert.equal(byId.tv.kind, 'not-stressor');
  // Too few check-ins: nothing yet
  assert.deepEqual(trendFindings({ dailyEntries: dailyEntries.slice(0, 5), factorLogs }, factors, today), []);
});
