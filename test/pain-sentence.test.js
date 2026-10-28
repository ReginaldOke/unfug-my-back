import { test } from 'node:test';
import assert from 'node:assert/strict';
import { painSentence } from '../web/lib/analysis.js';

const TODAY = '2026-10-29';
const F = [
  { id: 'sit', name: 'Long sitting', measureType: 'minutes' },
  { id: 'walk', name: 'Walking', measureType: 'minutes' },
  { id: 'cross', name: 'Crossed-leg sitting', measureType: 'yesno' },
];
const text = s => s.parts.map(p => (typeof p === 'string' ? p : p.b)).join('');

/** days: [[pain, { factorId: amount }], …] ending today */
function diary(days) {
  const dailyEntries = [], factorLogs = [];
  days.forEach(([pain, amounts], i) => {
    const date = `2026-10-${String(29 - (days.length - 1 - i)).padStart(2, '0')}`;
    dailyEntries.push({ date, painScore: pain });
    for (const [factorId, value] of Object.entries(amounts ?? {})) factorLogs.push({ factorId, date, value });
  });
  return { dailyEntries, factorLogs };
}

test('no check-ins: nothing to say', () => {
  assert.equal(painSentence(diary([]), F, TODAY), null);
});

test('first check-in: sets out a baseline with amounts, makes no claim', () => {
  const F2 = [{ ...F[0], role: 'trigger' }, { ...F[1], role: 'helper' }, { id: 'drive', name: 'Driving', measureType: 'minutes', role: 'trigger' }];
  const s = painSentence(diary([[4, { sit: 180, walk: 30, drive: 20 }]]), F2, TODAY);
  assert.equal(text(s), 'Your baseline: pain 4/10 on a day with 3 h of long sitting and 30 min of walking.');
  assert.equal(s.basis, 'Check in more often to see more meaningful trends and correlations.');
  const d = diary([[6]]);
  d.dailyEntries[0].sleepQuality = 3;
  assert.equal(text(painSentence(d, F2, TODAY)), 'Your baseline: pain 6/10 after sleeping poorly.');
});

test('names the stressor that goes with higher pain and the helper that goes with lower', () => {
  const s = painSentence(diary([
    [6, { sit: 240 }], [3, { sit: 60, walk: 60 }], [5, { sit: 180 }], [2, { walk: 90 }], [6, { sit: 200, walk: 10 }],
  ]), F, TODAY);
  assert.equal(text(s), 'Your pain tends to be higher on days with more long sitting and lower on days with more walking.');
  assert.equal(s.basis, 'Based on 5 check-ins. Check in more often to see more meaningful trends and correlations.');
});

test('follows the data, not the role: a helper that goes with higher pain is named as such', () => {
  const s = painSentence(diary([[7, { walk: 120 }], [2, {}], [6, { walk: 90 }], [3, {}]]), F, TODAY);
  assert.equal(text(s), 'So far, your pain has been higher on days with more walking. Nothing you log lines up with lower pain yet.');
});

test('yes/no factors read "on days with", and only-lower links are worded the other way round', () => {
  const s = painSentence(diary([[2, { cross: 1 }], [6, {}], [1, { cross: 1 }], [7, {}]]), F, TODAY);
  assert.equal(text(s), 'So far, your pain has been lower on days with crossed-leg sitting. Nothing you log lines up with higher pain yet.');
});

test('flat pain or no link: says so instead of guessing', () => {
  assert.equal(text(painSentence(diary([[4, { sit: 60 }], [4, { sit: 200 }]]), F, TODAY)), 'Your pain has been 4/10 every time, so nothing stands out yet.');
  // Logged the same every day: no variation to learn from
  assert.equal(text(painSentence(diary([[3, { sit: 60 }], [6, { sit: 60 }], [4, { sit: 60 }]]), F, TODAY)), 'No clear link yet between your pain and what you log.');
});

test('sleep counts when it was logged on most check-ins', () => {
  const d = diary([[7], [3], [6], [2]]);
  [3, 8, 4, 9].forEach((q, i) => { d.dailyEntries[i].sleepQuality = q; });
  assert.equal(text(painSentence(d, F, TODAY)), 'So far, your pain has been lower after better sleep. Nothing you log lines up with higher pain yet.');
  // Hours from Apple Health read as "more sleep"
  const e = diary([[7], [3], [6], [2]]);
  e.healthDays = e.dailyEntries.map((x, i) => ({ date: x.date, sleepHours: [5, 8, 5.5, 8.5][i] }));
  assert.equal(text(painSentence(e, F, TODAY)), 'So far, your pain has been lower after more sleep. Nothing you log lines up with higher pain yet.');
});
