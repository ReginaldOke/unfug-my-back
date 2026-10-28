import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCollector, parseHealthDate, parseShortcut } from '../web/lib/health.js';

const rec = (type, source, start, end, value) =>
  ` <Record type="${type}" sourceName="${source}" unit="count" startDate="${start}" endDate="${end}" value="${value}"/>`;
const STEPS = 'HKQuantityTypeIdentifierStepCount';
const SLEEP = 'HKCategoryTypeIdentifierSleepAnalysis';

test('steps: totals per source, and the day takes the larger source (phone and watch overlap)', () => {
  const c = createCollector();
  c.line(rec(STEPS, 'iPhone', '2026-10-28 08:00:00 +0100', '2026-10-28 08:10:00 +0100', 3000));
  c.line(rec(STEPS, 'iPhone', '2026-10-28 18:00:00 +0100', '2026-10-28 18:10:00 +0100', 2000));
  c.line(rec(STEPS, 'Watch', '2026-10-28 08:00:00 +0100', '2026-10-28 08:10:00 +0100', 5600));
  c.line(rec(STEPS, 'iPhone', '2026-10-29 08:00:00 +0100', '2026-10-29 08:10:00 +0100', 800));
  assert.deepEqual(c.days().map(d => [d.date, d.steps]), [['2026-10-28', 5600], ['2026-10-29', 800]]);
});

test('sleep: asleep stages count towards the morning you woke up, in bed and naps do not', () => {
  const c = createCollector();
  c.line(rec(SLEEP, 'Watch', '2026-10-27 23:30:00 +0100', '2026-10-28 03:00:00 +0100', 'HKCategoryValueSleepAnalysisAsleepCore'));
  c.line(rec(SLEEP, 'Watch', '2026-10-28 03:00:00 +0100', '2026-10-28 06:30:00 +0100', 'HKCategoryValueSleepAnalysisAsleepREM'));
  c.line(rec(SLEEP, 'Watch', '2026-10-27 23:00:00 +0100', '2026-10-28 07:00:00 +0100', 'HKCategoryValueSleepAnalysisInBed'));
  c.line(rec(SLEEP, 'Watch', '2026-10-28 14:00:00 +0100', '2026-10-28 14:30:00 +0100', 'HKCategoryValueSleepAnalysisAsleepCore'));
  const [day] = c.days();
  assert.equal(day.date, '2026-10-28');
  assert.equal(day.sleepHours, 7.5);
});

test('health dates keep their offset', () => {
  assert.equal(parseHealthDate('2026-10-28 07:12:03 +0100').toISOString(), '2026-10-28T06:12:03.000Z');
  assert.equal(parseHealthDate('nonsense'), null);
});

test('shortcut links: steps and sleep by day, junk ignored', () => {
  const rows = parseShortcut(new URLSearchParams('steps=2026-10-28:8412.4,2026-10-29: 10233,bad,2026-10-30:-5&sleep=2026-10-29:7.4'));
  assert.deepEqual(rows, [
    { date: '2026-10-28', steps: 8412 },
    { date: '2026-10-29', steps: 10233, sleepHours: 7.4 },
  ]);
});
