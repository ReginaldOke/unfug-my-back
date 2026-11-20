import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sumByDay, averageByDay, standHoursByDay, workoutsByDay, workoutName, workoutTicks, daysWith, EXTRA_FIELDS, HEALTH_LINES } from '../web/lib/health-days.js';

const at = (d, h, m = 0) => new Date(2026, 10, d, h, m).toISOString();

test('workouts group by day, with a copy saved by a second app dropped', () => {
  const surf = { workoutType: 'surfing', duration: 3600, totalDistance: 2400, startDate: at(10, 7), endDate: at(10, 8) };
  const again = { ...surf, startDate: at(10, 7, 5), endDate: at(10, 7, 55), sourceName: 'Surf app' };
  const run = { workoutType: 'running', duration: 1500, startDate: at(11, 18), endDate: at(11, 18, 25) };
  const days = workoutsByDay([run, again, surf]);
  assert.deepEqual(days.get('2026-11-10'), [{ type: 'surfing', name: 'Surfing', minutes: 60, km: 2.4, start: surf.startDate }]);
  assert.equal(days.get('2026-11-11')[0].minutes, 25);
  assert.equal(workoutName('highIntensityIntervalTraining'), 'High intensity interval training');
});

test('stand hours, totals and averages per day', () => {
  const stand = [{ standState: 'stood', startDate: at(10, 9) }, { standState: 'idle', startDate: at(10, 10) }, { standState: 'stood', startDate: at(10, 11) }];
  assert.equal(standHoursByDay(stand).get('2026-11-10'), 2);
  assert.equal(sumByDay([{ value: 12, startDate: at(10, 9) }, { value: 8, startDate: at(10, 17) }]).get('2026-11-10'), 20);
  assert.equal(averageByDay([{ value: 40, startDate: at(10, 2) }, { value: 60, startDate: at(10, 4) }]).get('2026-11-10'), 50);
});

test('workouts tick the check-in items they fit', () => {
  const workouts = [{ type: 'surfing', minutes: 50 }, { type: 'surfing', minutes: 30 }, { type: 'swimmingOpenWater', minutes: 20 }, { type: 'bikingStationary', minutes: 15 }];
  const items = [
    { id: 'surf', name: 'Surf', measureType: 'minutes' }, { id: 'swim', name: 'Ocean swim', measureType: 'yesno' },
    { id: 'bike', name: 'Bike ride', measureType: 'count' }, { id: 'run', name: 'Run', measureType: 'minutes' },
    { id: 'sit', name: 'Desk sitting', measureType: 'minutes' },
  ];
  assert.deepEqual([...workoutTicks(workouts, items)], [['surf', 80], ['swim', 1], ['bike', 1]]);
  assert.equal(workoutTicks(undefined, items).size, 0);
});

test('each Health switch counts the days its data came in, and chart lines read clearly', () => {
  const days = [{ date: 'a', walkingKm: 3.2, workouts: [] }, { date: 'b', walkingKm: 1, restingHeartRate: 58 }, { date: 'c', hrvMs: 40, workouts: [{ name: 'Surfing', minutes: 60 }] }];
  assert.equal(daysWith(days, EXTRA_FIELDS.distance), 2);
  assert.equal(daysWith(days, EXTRA_FIELDS.heart), 2);
  assert.equal(daysWith(days, EXTRA_FIELDS.workouts), 1);
  assert.equal(daysWith(days, EXTRA_FIELDS.stand), 0);
  const workouts = HEALTH_LINES.find(l => l.key === 'workouts');
  assert.equal(workouts.fmt(workouts.value(days[2]), days[2]), 'Surfing · 60 min');
});
