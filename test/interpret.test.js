import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readWorkoutText, readCSV, parseCSV, toDate } from '../web/lib/interpret.js';

test('a workout note with headings becomes a routine with variations', () => {
  const note = `My gym plan

Push:
- Bench press 3x8 60kg
- Overhead press 3 × 10
- Dips

Pull:
1. Pull-ups 4 sets of 6
2. Barbell row 3x8 @ 50 kg

Legs:
Squats 5x5 100kg
Romanian deadlift 3x10`;
  const { routines } = readWorkoutText(note);
  assert.deepEqual(routines.map(r => [r.group, r.name]), [['My gym plan', 'Push'], ['My gym plan', 'Pull'], ['My gym plan', 'Legs']]);
  assert.deepEqual(routines[0].items, [
    { name: 'Bench press', dose: '3x8', extra: '60kg' },
    { name: 'Overhead press', dose: '3 × 10' },
    { name: 'Dips', dose: '' },
  ]);
  assert.deepEqual(routines[1].items[1], { name: 'Barbell row', dose: '3x8', extra: '50 kg' });
  assert.equal(routines[2].items[0].dose, '5x5');
});

test('a plain list under one title is a single routine', () => {
  const { routines } = readWorkoutText('Morning stretches\nCat-cow x 6\nChild’s pose 30 s\nHamstring stretch 2 min');
  assert.equal(routines.length, 1);
  assert.equal(routines[0].name, 'Morning stretches');
  assert.equal(routines[0].group, undefined);
  assert.deepEqual(routines[0].items.map(i => i.dose), ['x 6', '30 s', '2 min']);
});

test('text with no moves in it is not a workout', () => {
  assert.equal(readWorkoutText('   \n\n'), null);
});

test('a set-by-set workout log (Strong style) becomes routines with past sessions', () => {
  const csv = `Date,Workout Name,Exercise Name,Set Order,Weight,Reps
2026-10-20 07:00:00,Push Day,Bench Press,1,60,8
2026-10-20 07:00:00,Push Day,Bench Press,2,60,8
2026-10-20 07:00:00,Push Day,Bench Press,3,60,7
2026-10-22 07:00:00,Leg Day,Squat,1,90,5
2026-10-22 07:00:00,Leg Day,Squat,2,95,5
2026-10-27 07:00:00,Push Day,Bench Press,1,62.5,8
2026-10-27 07:00:00,Push Day,Bench Press,2,62.5,8
2026-10-27 07:00:00,Push Day,Bench Press,3,62.5,8`;
  const data = readCSV(csv);
  assert.deepEqual(data.routines.map(r => r.name), ['Push Day', 'Leg Day']);
  assert.deepEqual(data.routines[0].items, [{ name: 'Bench Press', dose: '3 × 8' }]);
  assert.equal(data.routineCompletions.length, 3);
  const last = data.routineCompletions.find(c => c.date === '2026-10-27');
  assert.deepEqual(last.log, [{ name: 'Bench Press', did: '3 sets', extra: '62.5 kg' }]);
});

test('a daily tracker CSV becomes check-ins, Health days and things to track', () => {
  const csv = `date,pain,mood,stress (1-5),steps,hours slept,yoga,coffee cups
29/10/2026,7,3,4,5200,6.5,no,3
30/10/2026,4,4,2,9100,7.8,yes,1`;
  const data = readCSV(csv);
  assert.deepEqual(data.dailyEntries.map(e => [e.date, e.painScore, e.stressScore]), [['2026-10-29', 7, 8], ['2026-10-30', 4, 3]]);
  assert.deepEqual(data.healthDays.map(d => [d.date, d.steps, d.sleepHours]), [['2026-10-29', 5200, 6.5], ['2026-10-30', 9100, 7.8]]);
  assert.deepEqual(data.factors.map(f => [f.name, f.measureType]), [['Mood', 'count'], ['Yoga', 'yesno'], ['Coffee cups', 'count']]);
  const yoga = data.factors.find(f => f.name === 'Yoga');
  assert.deepEqual(data.factorLogs.filter(l => l.factorId === yoga.id).map(l => l.date), ['2026-10-30']);
});

test('CSV parsing copes with quotes, and dates come in many shapes', () => {
  assert.deepEqual(parseCSV('a,b\n"x, y","say ""hi"""\n'), [['a', 'b'], ['x, y', 'say "hi"']]);
  assert.equal(toDate('2026-10-29 07:12'), '2026-10-29');
  assert.equal(toDate('29/10/2026'), '2026-10-29');
  assert.equal(toDate('10/29/2026'), '2026-10-29');
  assert.equal(toDate('Oct 29, 2026'), '2026-10-29');
  assert.equal(toDate('soon'), null);
});
