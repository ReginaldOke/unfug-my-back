// Seed data. New users start with the most common back pain stressors and helpers switched on
// (`defaultOn`); the rest are offered in Settings › Stressors & helpers but start switched off.

const f = (name, role, measureType, unit, category, icon, defaultOn = false) => ({ name, role, measureType, unit, category, icon, defaultOn });

export const SEED_FACTORS = [
  // Most common stressors (on by default)
  f('Long sitting', 'trigger', 'minutes', 'min', 'posture', '🪑', true),
  f('Driving', 'trigger', 'minutes', 'min', 'activity', '🚗', true),
  f('Screen time', 'trigger', 'minutes', 'min', 'lifestyle', '📱', true),
  // Most common helpers (on by default)
  f('Walking', 'helper', 'minutes', 'min', 'exercise', '🚶', true),
  f('Stretching', 'helper', 'minutes', 'min', 'recovery', '🧘', true),
  f('Strength exercise', 'helper', 'minutes', 'min', 'exercise', '🏋️', true),
  // More options, off until chosen
  f('Guitar (seated)', 'trigger', 'minutes', 'min', 'activity', '🎸'),
  f('Crunches or sit-ups', 'trigger', 'count', 'reps', 'exercise', '🔁'),
  f('Heavy bag carrying', 'trigger', 'minutes', 'min', 'activity', '🎒'),
  f('Lying propped up in bed', 'unsure', 'minutes', 'min', 'posture', '🛏️'),
  f('Handstands', 'unsure', 'count', 'times', 'exercise', '🤸'),
  f('Glute bridges', 'unsure', 'count', 'reps', 'exercise', '🌉'),
  f('Calisthenics session', 'unsure', 'minutes', 'min', 'exercise', '💪'),
  f('Yoga or pilates', 'helper', 'minutes', 'min', 'exercise', '🧘‍♀️'),
  f('Team sport', 'unsure', 'minutes', 'min', 'exercise', '⚽'),
  f('Mobility routine', 'helper', 'count', 'times', 'recovery', '🔄'),
  f('Sitting breaks', 'helper', 'count', 'times', 'recovery', '🐍'),
  f('Meditation', 'helper', 'minutes', 'min', 'recovery', '🪷', true),
  f('Running', 'helper', 'minutes', 'min', 'exercise', '🏃'),
  f('Cycling', 'helper', 'minutes', 'min', 'exercise', '🚴'),
  f('Swimming', 'helper', 'minutes', 'min', 'exercise', '🏊'),
  f('Heat pack', 'helper', 'yesno', '', 'recovery', '♨️'),
  f('Standing desk', 'helper', 'minutes', 'min', 'posture', '🧍'),
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
