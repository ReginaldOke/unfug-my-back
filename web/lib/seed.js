// Personal-build seed data (SPEC.md › Seed data). `defaultOn` controls what's pre-selected in setup;
// everything else is offered but switched off until chosen.

const f = (name, role, measureType, unit, category, icon, defaultOn = true) => ({ name, role, measureType, unit, category, icon, defaultOn });

export const SEED_FACTORS = [
  // Stressors
  f('Desk sitting', 'trigger', 'minutes', 'min', 'posture', '🪑'),
  f('Driving', 'trigger', 'minutes', 'min', 'activity', '🚗'),
  f('Guitar (seated)', 'trigger', 'minutes', 'min', 'activity', '🎸'),
  f('Poor sleep', 'trigger', 'yesno', '', 'lifestyle', '🌙'),
  f('Crossed-leg sitting', 'trigger', 'yesno', '', 'posture', '🦵'),
  f('Crunches or sit-ups', 'trigger', 'count', 'reps', 'exercise', '🔁'),
  f('Training volume above plan', 'trigger', 'yesno', '', 'exercise', '📈'),
  f('Lying propped up in bed', 'unsure', 'minutes', 'min', 'posture', '🛏️'),
  f('Manual work (lifting, bending)', 'unsure', 'minutes', 'min', 'activity', '🔨'),
  f('Handstands', 'unsure', 'count', 'times', 'exercise', '🤸'),
  f('Glute bridges', 'unsure', 'count', 'reps', 'exercise', '🌉'),
  f('Calisthenics session', 'unsure', 'minutes', 'min', 'exercise', '💪'),
  f('Long phone scrolling', 'trigger', 'minutes', 'min', 'posture', '📱', false),
  f('Heavy bag carrying', 'trigger', 'minutes', 'min', 'activity', '🎒', false),
  // Helpers
  f('Walking', 'helper', 'minutes', 'min', 'exercise', '🚶'),
  f('Stretching', 'helper', 'minutes', 'min', 'recovery', '🧘'),
  f('Mobility routine', 'helper', 'count', 'times', 'recovery', '🔄'),
  f('Extension breaks', 'helper', 'count', 'times', 'recovery', '🐍'),
  f('Running', 'helper', 'minutes', 'min', 'exercise', '🏃'),
  f('Cycling', 'helper', 'minutes', 'min', 'exercise', '🚴'),
  f('Swimming', 'helper', 'minutes', 'min', 'exercise', '🏊', false),
  f('Heat pack', 'helper', 'yesno', '', 'recovery', '♨️', false),
  f('Standing desk', 'helper', 'minutes', 'min', 'posture', '🧍', false),
];

export const SEED_ROUTINE = {
  name: 'Daily mobility',
  schedule: ['09:00', '18:00'],
  items: [
    { name: 'Half-kneeling hip flexor stretch', dose: '2 × 30 s each side' },
    { name: 'Single-leg hinge', dose: '× 6 each side' },
    { name: 'Cat-cow', dose: '× 4' },
    { name: 'Open book', dose: '× 6 each side' },
    { name: 'Cobra and downward dog', dose: '× 4' },
    { name: 'Bird dog', dose: '× 4 each side' },
    { name: 'Hamstring stretch', dose: '× 2' },
    { name: 'Deep squat hold', dose: '× 2' },
  ],
};
