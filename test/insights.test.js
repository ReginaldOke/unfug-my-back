import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findInsights, explainLag, explainCombo } from '../web/lib/insights.js';
import { addDays } from '../web/lib/dates.js';

const today = '2026-11-28';
const span = n => Array.from({ length: n }, (_, i) => addDays(today, i - (n - 1)));
const minutes = (id, name) => ({ id, name, role: 'trigger', measureType: 'minutes' });
const sitting = minutes('sit', 'Long sitting'), driving = minutes('drive', 'Driving');
// Fixed but well-mixed random draws (mulberry32), so the "noise" really is noise
const rand = (a => () => {
  a = (a + 0x6d2b79f5) >>> 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
})(42);

test('pain two days after more sitting is found; the same day showing nothing is kept too', () => {
  const dates = span(28);
  const big = dates.map(() => rand() < 0.45);
  const factorLogs = dates.map((date, i) => ({ factorId: 'sit', date, value: big[i] ? 480 : 60 }));
  const dailyEntries = dates.map((date, i) => ({ date, painScore: i >= 2 && big[i - 2] ? 7 : 3 }));
  const x = explainLag(sitting, { dailyEntries, factorLogs }, 2, today);
  assert.equal(x.shaped, true);
  assert.ok(x.delta > 3.5);
  assert.ok(Math.abs(x.sameDelta) < x.delta - 1);
  assert.ok(x.p < 0.01);
  const [first] = findInsights({ dailyEntries, factorLogs }, [sitting], today);
  assert.deepEqual([first.id, first.title], ['lag.sit.2', 'Pain is worse two days after more long sitting']);
});

test('a combination counts only when together goes beyond each alone, added up', () => {
  // Combinations ask more of the data than a single comparison, so they need the full four weeks
  const dates = span(28);
  const sit = dates.map(() => rand() < 0.5), drive = dates.map(() => rand() < 0.5);
  const factorLogs = dates.flatMap((date, i) => [
    { factorId: 'sit', date, value: sit[i] ? 480 : 30 },
    { factorId: 'drive', date, value: drive[i] ? 90 : 10 },
  ]);
  const together = dates.map((date, i) => ({ date, painScore: sit[i] && drive[i] ? 8 : 3 }));
  const c = explainCombo(sitting, driving, { dailyEntries: together, factorLogs }, today);
  assert.equal(c.shaped, true);
  assert.equal(c.means.both, 8);
  assert.ok(c.p < 0.01);
  assert.ok(findInsights({ dailyEntries: together, factorLogs }, [sitting, driving], today)
    .some(x => x.title === 'Pain is worse on days you combine long sitting with driving'));

  // Sitting alone doing the harm, driving adding nothing: not a combination
  const sittingOnly = dates.map((date, i) => ({ date, painScore: sit[i] ? 8 : 3 }));
  assert.equal(explainCombo(sitting, driving, { dailyEntries: sittingOnly, factorLogs }, today).shaped, false);
  // Each adding its own share (2 + 2), nothing more together: not a combination either
  const added = dates.map((date, i) => ({ date, painScore: 2 + (sit[i] ? 2 : 0) + (drive[i] ? 2 : 0) }));
  assert.equal(explainCombo(sitting, driving, { dailyEntries: added, factorLogs }, today).shaped, false);
});

test('diaries of pure noise almost never offer anything, however many things are tracked', () => {
  // With 8 things tracked, 16 delays and 15 pairings are checked each time. The bar for chance is set so
  // that a diary with nothing real in it shows something about one time in twenty at most
  const dates = span(28);
  const factors = Array.from({ length: 8 }, (_, k) => minutes(`f${k}`, `Thing ${k}`));
  let fooled = 0;
  for (let trial = 0; trial < 40; trial++) {
    const factorLogs = dates.flatMap(date => factors.filter(() => rand() < 0.5).map(f => ({ factorId: f.id, date, value: 30 + Math.round(rand() * 300) })));
    const dailyEntries = dates.map(date => ({ date, painScore: 1 + Math.floor(rand() * 9) }));
    if (findInsights({ dailyEntries, factorLogs }, factors, today).length) fooled++;
  }
  assert.ok(fooled <= 3, `${fooled} of 40 noise diaries offered an insight`);
});

test('a real but moderate delay is found in most four-week diaries, despite everyday ups and downs', () => {
  // Pain two points higher two days after a long sitting day, with day-to-day noise of about a point either way
  const dates = span(28);
  let found = 0;
  for (let trial = 0; trial < 30; trial++) {
    const big = dates.map(() => rand() < 0.5);
    const factorLogs = dates.map((date, i) => ({ factorId: 'sit', date, value: big[i] ? 420 + Math.round(rand() * 120) : 60 + Math.round(rand() * 120) }));
    const dailyEntries = dates.map((date, i) => ({ date, painScore: Math.max(1, Math.min(9, Math.round(3 + (i >= 2 && big[i - 2] ? 2 : 0) + (rand() - 0.5) * 2.4))) }));
    if (findInsights({ dailyEntries, factorLogs }, [sitting, driving], today).some(x => x.id === 'lag.sit.2')) found++;
  }
  assert.ok(found >= 21, `found in ${found} of 30`);
});

test('a short diary offers nothing', () => {
  assert.deepEqual(findInsights({ dailyEntries: [{ date: today, painScore: 4 }], factorLogs: [] }, [sitting], today), []);
});
