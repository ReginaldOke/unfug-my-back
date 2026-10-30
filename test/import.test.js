import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planImport, isDiaryExport } from '../web/lib/import.js';

const empty = () => ({ factors: [], routines: [], dailyEntries: [], painMarkers: [], factorLogs: [], factorChanges: [], flares: [], routineCompletions: [], routineChanges: [], healthDays: [] });

// The phone: seeded on its own, so its "Long sitting" has a different id from the website's
const phone = () => ({
  ...empty(),
  factors: [{ id: 'p-sit', name: 'Long sitting' }, { id: 'p-mob', name: 'Daily mobility · Day 1', routineId: 'p-r1' }],
  routines: [{ id: 'p-r1', group: 'Daily mobility', name: 'Day 1', linkedFactorId: 'p-mob' }],
  dailyEntries: [{ id: 'p-e1', date: '2026-10-30', painScore: 4 }],
  factorLogs: [{ id: 'p-l1', factorId: 'p-sit', date: '2026-10-30', value: 60 }],
});

// The website: two days, one of them also checked in on the phone
const web = () => ({
  ...empty(),
  factors: [{ id: 'w-sit', name: 'Long sitting ' }, { id: 'w-guitar', name: 'Guitar' }, { id: 'w-mob', name: 'Daily mobility · Day 1', routineId: 'w-r1' }],
  routines: [{ id: 'w-r1', group: 'Daily mobility', name: 'Day 1', linkedFactorId: 'w-mob' }],
  dailyEntries: [{ id: 'w-e1', date: '2026-10-29', painScore: 7 }, { id: 'w-e2', date: '2026-10-30', painScore: 2 }],
  painMarkers: [{ id: 'w-m1', dailyEntryId: 'w-e1', regionId: 'mid_back_centre' }, { id: 'w-m2', dailyEntryId: 'w-e2', regionId: 'neck' }],
  factorLogs: [
    { id: 'w-l1', factorId: 'w-sit', factorName: 'Long sitting', date: '2026-10-29', value: 120 },
    { id: 'w-l2', factorId: 'w-guitar', factorName: 'Guitar', date: '2026-10-29', value: 30 },
    { id: 'w-l3', factorId: 'w-sit', factorName: 'Long sitting', date: '2026-10-30', value: 200 },
  ],
  routineCompletions: [{ id: 'w-c1', routineId: 'w-r1', date: '2026-10-29', completed: true, log: [] }],
});

test('import adds new days and matches stressors and routines by name', () => {
  const { add, summary } = planImport(phone(), web());
  assert.deepEqual(add.dailyEntries.map(e => e.date), ['2026-10-29']);
  assert.deepEqual(add.painMarkers.map(m => m.id), ['w-m1']);
  // Long sitting already exists here (despite the stray space); only Guitar is new
  assert.deepEqual(add.factors.map(f => f.name), ['Guitar']);
  assert.equal(add.routines, undefined);
  // Logs point at this phone's Long sitting, and the day the phone already has is left alone
  assert.deepEqual(add.factorLogs.map(l => [l.factorId, l.date]), [['p-sit', '2026-10-29'], ['w-guitar', '2026-10-29']]);
  assert.ok(add.factorLogs.every(l => !('factorName' in l)));
  assert.equal(add.routineCompletions[0].routineId, 'p-r1');
  assert.deepEqual(summary, { checkins: 1, skippedDays: 1, factors: 1, routines: 0, sessions: 1, healthDays: 0 });
});

test('importing the same file twice adds nothing the second time', () => {
  const here = phone();
  const first = planImport(here, web());
  for (const [name, rows] of Object.entries(first.add)) here[name].push(...rows);
  const again = planImport(here, web());
  assert.deepEqual(again.add, {});
});

test('only diary exports are accepted', () => {
  assert.equal(isDiaryExport(web()), true);
  assert.equal(isDiaryExport({ hello: 1 }), false);
  assert.equal(isDiaryExport(null), false);
});

test('a doctored file is cleaned: bad rows dropped, values bounded, unknown fields ignored', () => {
  const evil = {
    ...empty(),
    factors: [
      { id: 'x1', name: '<img src=x onerror=alert(1)>'.repeat(20), role: 'admin', measureType: 'script', icon: '💥', __proto__: { polluted: true } },
      { id: '../../etc', name: 'Bad id' },
      { id: 'x2', name: '' },
    ],
    routines: [{ id: 'r1', name: 'R', items: 'not a list', schedule: ['09:00', 'javascript:alert(1)', '25:99@9'] }],
    dailyEntries: [
      { id: 'e1', date: '2026-10-01', painScore: '99', notes: 'n'.repeat(5000), html: '<script>' },
      { id: 'e2', date: 'yesterday', painScore: 3 },
      { id: 'e3', date: '2026-10-02', painScore: 'lots' },
    ],
    painMarkers: [{ id: 'm1', dailyEntryId: 'e1', regionId: 'not_a_region' }],
    factorLogs: [{ id: 'l1', factorId: 'x1', date: '2026-10-01', value: 1e12 }],
  };
  const { add } = planImport(empty(), evil);
  assert.equal(add.factors.length, 1);
  assert.equal(add.factors[0].name.length, 80);
  assert.equal(add.factors[0].role, 'unsure');
  assert.equal(add.factors[0].measureType, 'count');
  assert.equal({}.polluted, undefined);
  assert.deepEqual(add.routines[0].items, []);
  assert.deepEqual(add.routines[0].schedule, ['09:00']);
  assert.deepEqual(add.dailyEntries.map(e => [e.id, e.painScore, e.notes.length, 'html' in e]), [['e1', 10, 2000, false]]);
  assert.equal(add.painMarkers, undefined);
  assert.equal(add.factorLogs[0].value, 100000);
});
