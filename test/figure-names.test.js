import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findByName } from '../web/lib/move-names.js';
import { ALL_MOVES } from '../web/views/figure.js';

const first = name => findByName(ALL_MOVES, name)?.names[0];

test('common gym moves find their figure, however they are written', () => {
  const cases = {
    'Incline DB Press': 'incline bench press', 'Lat Raises': 'lateral raise', 'Hammer curls': 'bicep curl', 'EZ-bar skullcrushers': 'skull crusher',
    'Tricep Rope Pushdown': 'tricep pushdown', 'Barbell Hip Thrusts': 'hip thrust', 'Leg Press': 'leg press', 'Seated leg curl': 'leg curl',
    'Face Pulls': 'face pull', 'Romanian Deadlift': 'hinge', 'Back squat': 'squat', 'Front Squats': 'front squat', 'Power cleans': 'power clean',
    'Cable flyes': 'cable crossover', 'Pec Deck': 'pec deck', 'Standing calf raises': 'calf raise', 'Bulgarian split squats': 'bulgarian split squat',
    'Arnold Press': 'arnold press', 'Rowing machine': 'rowing machine', 'Treadmill run': 'run',
  };
  for (const [name, want] of Object.entries(cases)) assert.equal(first(name), want, name);
});

test('bodyweight and calisthenics moves find their figure', () => {
  const cases = {
    'Push-ups': 'push up', 'Press ups': 'push up', 'Diamond pushups': 'push up', 'Pike push-up': 'pike push up', 'HSPU': 'handstand',
    'Dips': 'dip', 'Australian pull-ups': 'inverted row', 'Muscle-ups': 'muscle up', 'Toes to bar': 'hanging leg raise', 'L-sit': 'l sit',
    'Pistol squats': 'pistol squat', 'Walking lunges': 'lunge', 'Jumping jacks': 'jumping jack', 'Mountain climbers': 'mountain climber',
    'Burpees': 'burpee', 'Hollow body hold': 'hollow hold', 'V-ups': 'v up', 'Flutter kicks': 'flutter kick', 'Nordic curls': 'nordic curl',
    'Box jumps': 'box jump', 'Skipping rope': 'jump rope',
  };
  for (const [name, want] of Object.entries(cases)) assert.equal(first(name), want, name);
});

test('small typos still find the move', () => {
  const cases = { 'bulgarain split squat': 'bulgarian split squat', 'pistol sqaut': 'pistol squat', 'mountian climbers': 'mountain climber', 'skull cruhser': 'skull crusher', 'jumping jakcs': 'jumping jack' };
  for (const [name, want] of Object.entries(cases)) assert.equal(first(name), want, name);
});

test('the kneeling lunge stretch and the McKenzie press-up keep their own figures', () => {
  assert.equal(first('Kneeling lunge'), 'hip flexor');
  assert.equal(first('Prone press up'), 'prone press up');
});
