import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readRoutine, readNumbers, tidyName } from '../web/lib/routine-import.js';
import S from './routine-import-samples.js';

// Each day as "Name | dose | extra" lines, to compare at a glance
const read = (text, opts) => {
  const r = readRoutine(text, opts);
  return r && { title: r.title, days: r.days.map(d => [d.name, ...d.items.map(it => [it.name, it.dose, it.extra].filter(Boolean).join(' | '))]) };
};

test('targets read the way the app writes them', () => {
  const dose = line => readNumbers(line).dose;
  assert.equal(dose('3x10'), '3 × 10');
  assert.equal(dose('4 sets of 6-8'), '4 × 6–8');
  assert.equal(dose('10 reps x 3 sets'), '3 × 10');
  assert.equal(dose('3 x 30 sec each side'), '3 × 30 s each side');
  assert.equal(dose('45s/side x 3'), '3 × 45 s each side');
  assert.equal(dose('1:30'), '90 s');
  assert.equal(dose('2:30'), '2 min 30 s');
  assert.equal(dose('2 min'), '2 min');
  assert.equal(dose('x15'), '15 reps');
  assert.equal(dose('10 each leg'), '10 reps each side');
  assert.equal(dose('4 x AMRAP'), '4 × AMRAP');
  assert.equal(dose('3 sets to failure'), '3 sets to failure');
  assert.equal(dose('400m'), '400 m');
  assert.equal(readNumbers('Squat 5x5 @ 100kg').extra, '100 kg');
  assert.equal(readNumbers('Swings 2x16kg').extra, '2 × 16 kg');
  assert.equal(readNumbers('RDL 3x10 RPE 8 rest 90s').extra, 'rest 90 s, RPE 8');
});

test('names are tidied, with shorthand spelt out', () => {
  assert.equal(tidyName('INCLINE DB PRESS'), 'Incline dumbbell press');
  assert.equal(tidyName('RDL'), 'RDL');
  assert.equal(tidyName('mckenzie press up'), 'McKenzie press up');
  assert.equal(tidyName('Pull ups'), 'Pull-up');
});

test('a note with a title and a list', () => {
  assert.deepEqual(read(S.notes), { title: 'Morning mobility', days: [[null,
    'Cat cow | 10 reps', "Child's pose | 1 min", "World's greatest stretch | 5 reps each side", 'Dead bug | 3 × 10', 'Bird dog | 2 × 8 each side', 'Plank | 3 × 30 s']] });
});

test('a split becomes one variation per day, weights in the second box', () => {
  const r = read(S.gym);
  assert.deepEqual(r.days.map(d => d[0]), ['Push day', 'Pull day', 'Legs']);
  assert.deepEqual(r.days[1].slice(1, 3), ['Deadlift | 3 × 5 | 140 kg', 'Pull-up | 4 × AMRAP']);
  assert.equal(r.days[2][3], 'Bulgarian split squats | 3 × 10 each side | 20 kg dumbbells');
});

test("a coach's email: greeting and sign-off left out, warm-up first and cool-down last", () => {
  const r = read(S.coach);
  assert.equal(r.days.length, 1);
  const names = r.days[0].slice(1).map(x => x.split(' | ')[0]);
  assert.deepEqual(names, ['Foam roll quads and glutes', 'Glute bridges', 'Clamshells', 'Goblet squat', 'Push-up', 'Romanian deadlift', 'Pallof press', 'Side plank', 'Hip flexor stretch', 'Figure 4 stretch']);
  assert.equal(r.days[0][3], 'Clamshells | 15 reps each side');
});

test('workouts shared from Hevy and Strong: sets gathered into one target', () => {
  assert.deepEqual(read(S.hevy).days, [['Upper A', 'Bench press (barbell) | 10, 8, 8, 7 | 80 kg', 'Lat pulldown (cable) | 12, 10, 10 | 55 kg', 'Plank | 2 × 1 min']]);
  assert.deepEqual(read(S.strong), { title: 'Evening workout', days: [[null, 'Squat (barbell) | 3 × 5 | 100 kg', 'Leg press | 2 × 12 | 160 kg']] });
});

test('CSV exports: the latest session of each workout, warm-up sets left out', () => {
  assert.deepEqual(read(S.csvStrong, { fileName: 'strong.csv' }).days, [
    ['Legs', 'Squat (barbell) | 3 × 5 | 100 kg', 'Romanian deadlift (barbell) | 2 × 10 | 80 kg', 'Plank | 1 min'],
    ['Push', 'Bench press (barbell) | 8 reps | 70 kg']]);
  assert.deepEqual(read(S.csvHevy, { fileName: 'hevy.csv' }).days, [['Full body', 'Goblet squat | 2 × 12 | 20 kg', 'Dead hang | 45 s']]);
});

test('spreadsheets and markdown tables', () => {
  assert.deepEqual(read(S.sheet).days[0].slice(1), ['Hip thrust | 3 × 12 | 60 kg, pause at top', 'Step ups | 3 × 10 each side | 12 kg', 'Copenhagen plank | 3 × 20 s', 'Nordic curls | 3 × 5']);
  assert.deepEqual(read(S.markdown), { title: 'Back rehab', days: [[null, 'McKenzie press up | 10 reps', 'Bird dog | 3 × 8 each side | slow', 'Glute bridge | 3 × 12']] });
});

test('one line, two-line moves and numbers first', () => {
  assert.deepEqual(read(S.oneLine).days[0].slice(1), ['Squats | 3 × 10', 'Lunges | 3 × 12 each side', 'Plank | 3 × 30 s', 'Burpees | 15 reps']);
  assert.deepEqual(read(S.twoLine).days[0].slice(1), ['Squats | 3 × 10', 'Lunges | 3 × 12 each side', 'Plank | 45 s']);
  assert.deepEqual(read(S.timeFirst).days[0].slice(1), ['Jumping jacks | 30 s', 'Squats | 3 × 10', 'Wall sit | 1 min', 'Push-up | 10 reps']);
});

test('web pages, emails, rich text and JSON', () => {
  assert.deepEqual(read(S.html).days[0].slice(1), ['Dead bug | 10 reps', 'Hollow hold | 20 s', 'Russian twists | 3 × 20']);
  assert.deepEqual(read(S.eml, { fileName: 'coach.eml' }), { title: 'Your stretching routine', days: [[null, 'Hamstring stretch | 30 s each side', 'Pigeon pose | 1 min each side', 'Cat-cow | 10 reps']] });
  assert.equal(read(S.rtf).title, 'Lower back routine');
  assert.deepEqual(read(S.json).days[0].slice(1), ['Kettlebell swing | 5 × 15 | 16 kg', 'Turkish get up | 3 × 2 each side', 'Goblet squat | 3 × 10']);
});

test('messy notes with days, kit and distances', () => {
  const r = read(S.messy);
  assert.deepEqual(r.days.map(d => d[0]), ['Day 1 - upper', 'Day 2 - lower + core']);
  assert.deepEqual(r.days[1].slice(1), ['Goblet squats | 4 × 12 | 24 kg kettlebell', 'Walking lunges | 3 × 20', 'Run | 400 m', 'Side plank | 3 × 45 s each side']);
});

test('nothing to read gives null', () => {
  assert.equal(readRoutine(''), null);
  assert.equal(readRoutine('Hi, hope you are well. Speak soon!'), null);
});
