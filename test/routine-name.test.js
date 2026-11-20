import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nameForMoves, nameForSplit, nameDays, freshName } from '../web/lib/routine-name.js';
import { readRoutine } from '../web/lib/routine-import.js';
import S from './routine-import-samples.js';

const m = (...names) => names.map(name => ({ name }));

test('a routine is named for what most of it does', () => {
  assert.equal(nameForMoves(m('Bench press', 'Incline dumbbell press', 'Overhead press', 'Lateral raises', 'Tricep pushdown')), 'Push');
  assert.equal(nameForMoves(m('Pull-up', 'Barbell row', 'Face pulls', 'Bicep curls', 'Deadlift')), 'Pull');
  assert.equal(nameForMoves(m('Squat', 'RDL', 'Bulgarian split squats', 'Calf raises')), 'Legs');
  assert.equal(nameForMoves(m('Squat', 'Bench press', 'Barbell row', 'Overhead press', 'Lunges')), 'Full body');
  assert.equal(nameForMoves(m('Bench press', 'Pull-up', 'Overhead press', 'Barbell row')), 'Upper body');
  assert.equal(nameForMoves(m('Plank', 'Dead bug', 'Bird dog', 'Side plank', 'Russian twists')), 'Core');
  assert.equal(nameForMoves(m('Pigeon pose', 'Hamstring stretch', 'Hip flexor stretch', 'Figure 4 stretch', 'Seated forward fold')), 'Hip and hamstring stretch');
  assert.equal(nameForMoves(m('Cat cow', "Child's pose", 'Cobra', 'Knee to chest', 'Supine twist')), 'Back stretch');
  assert.equal(nameForMoves(m('Cat cow', "World's greatest stretch", 'Open book', 'Thoracic rotation')), 'Back mobility');
  assert.equal(nameForMoves(m('Arm circles', 'Hip circles', 'Thoracic rotation')), 'Mobility');
  assert.equal(nameForMoves(m('Brisk walk', 'March in place')), 'Walking');
  assert.equal(nameForMoves(m('Box breathing', 'Body scan')), 'Breathing');
  assert.equal(nameForMoves(m('McKenzie press up', 'Sphinx', 'Prone lying')), 'McKenzie extensions');
  assert.equal(nameForMoves(m('Glute bridge', 'Plank', 'Cat cow', 'Bird dog', 'Hamstring stretch')), 'Core and mobility');
  assert.equal(nameForMoves(m('Kettlebell swing')), 'Kettlebell swing');
  assert.equal(nameForMoves(m('Thing one', 'Thing two')), null);
  assert.equal(nameForMoves([]), null);
});

test('a split is named for its days, and unnamed days for what they hold', () => {
  assert.equal(nameForSplit([{ name: 'Push day', items: [] }, { name: 'Pull day', items: [] }, { name: 'Legs', items: [] }]), 'Push pull legs');
  assert.equal(nameForSplit([{ name: 'Upper A', items: [] }, { name: 'Lower A', items: [] }]), 'Upper lower');
  const days = [{ name: null, items: m('Bench press', 'Overhead press', 'Dips') }, { name: null, items: m('Squat', 'Lunges', 'Calf raises') }];
  assert.deepEqual(nameDays(days), ['Push', 'Legs']);
  assert.deepEqual(nameDays([{ name: null, items: m('Squat', 'Bench press', 'Row') }, { name: null, items: m('Deadlift', 'Overhead press', 'Pull-up') }]), ['A', 'B']);
});

test('imported routines get a fitting name', () => {
  const named = text => { const r = readRoutine(text); return r.days.length > 1 ? nameForSplit(r.days) : nameForMoves(r.days[0].items); };
  assert.equal(named(S.gym), 'Push pull legs');
  assert.equal(named(S.oneLine), 'Legs and core');
  assert.equal(named(S.eml.split('\n\n').slice(1).join('\n\n')), 'Stretches');
  assert.equal(named(S.notes), 'Core and mobility');
});

test('blocks split by blank lines become days only when they are clearly different training days', () => {
  const split = readRoutine('Bench press 4x8 80kg\nOverhead press 3x8\nDips 3x10\n\nSquat 5x5 100kg\nLunges 3x10 each leg\nCalf raises 4x15\n\nPull-ups 4x6\nBarbell row 4x8\nCurls 3x12');
  assert.deepEqual(nameDays(split.days), ['Push', 'Legs', 'Pull']);
  assert.equal(nameForSplit(split.days), 'Push pull legs');
  assert.equal(readRoutine('Cat cow x10\nBird dog 3x8\n\nPlank 30s\nDead bug 3x10').days.length, 1);
});

test('a name already in use gets a number', () => {
  assert.equal(freshName('Legs', ['Push', 'Legs']), 'Legs 2');
  assert.equal(freshName('Legs', ['legs', 'Legs 2']), 'Legs 3');
  assert.equal(freshName('Core', ['Legs']), 'Core');
});
