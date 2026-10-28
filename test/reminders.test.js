import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nextActiveTime, isRealMovement, nextReminderTime, evaluateWake } from '../web/lib/reminders-core.js';

const allDays = (start = '08:00', end = '22:00') => Array.from({ length: 7 }, () => ({ on: true, start, end }));
const cfg = { intervalMin: 45, minWalkMin: 2, minSteps: 150, snoozeMin: 10, activeHours: allDays() };
const at = (h, m = 0, day = 28) => new Date(2026, 9, day, h, m); // 28 Oct 2026 is a Wednesday

test('inside active hours returns the same time', () => {
  assert.deepEqual(nextActiveTime(at(10), cfg.activeHours), at(10));
});

test('before start moves to start; after end moves to next day start', () => {
  assert.deepEqual(nextActiveTime(at(6), cfg.activeHours), at(8));
  assert.deepEqual(nextActiveTime(at(22, 30), cfg.activeHours), at(8, 0, 29));
});

test('skips inactive days', () => {
  const hours = allDays();
  hours[4].on = false; // Thursday 29 Oct
  assert.deepEqual(nextActiveTime(at(23), hours), at(8, 0, 30));
});

test('returns null when no day is active', () => {
  assert.equal(nextActiveTime(at(10), allDays().map(d => ({ ...d, on: false }))), null);
});

test('real movement thresholds', () => {
  assert.equal(isRealMovement({ type: 'walking', minutes: 2, steps: 0 }, cfg), true);
  assert.equal(isRealMovement({ type: 'walking', minutes: 1, steps: 90 }, cfg), false);
  assert.equal(isRealMovement({ type: 'unknown', minutes: 1, steps: 150 }, cfg), true);
  assert.equal(isRealMovement({ type: 'automotive', minutes: 30, steps: 0 }, cfg), false);
});

test('next reminder is the interval after movement, respecting pause and active hours', () => {
  assert.deepEqual(nextReminderTime(at(10), cfg), at(10, 45));
  assert.deepEqual(nextReminderTime(at(10), cfg, at(12).toISOString()), at(12));
  assert.deepEqual(nextReminderTime(at(21, 30), cfg), at(8, 0, 29));
});

test('a walk reschedules the reminder from when the walk ended', () => {
  const d = evaluateWake({ now: at(10, 20), samples: [{ type: 'walking', minutes: 5, steps: 500, end: at(10, 15).toISOString() }], cfg, pendingAt: at(10, 30) });
  assert.equal(d.action, 'reschedule');
  assert.deepEqual(d.at, at(11, 0));
  assert.deepEqual(d.movementEndedAt, at(10, 15));
});

test('a short walk leaves the pending reminder alone', () => {
  const d = evaluateWake({ now: at(10, 20), samples: [{ type: 'walking', minutes: 1, steps: 80, end: at(10, 15).toISOString() }], cfg, pendingAt: at(10, 30) });
  assert.equal(d.action, 'keep');
});

test('a due reminder is pushed back while driving', () => {
  const d = evaluateWake({ now: at(10, 31), samples: [], cfg, pendingAt: at(10, 30), drivingNow: true });
  assert.equal(d.action, 'pushBack');
  assert.deepEqual(d.at, at(10, 41));
});
