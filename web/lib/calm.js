// Calm activities in routines: breathing patterns and meditation. Each gets a soft guide in place of
// a stick figure (views/calm.js), and its "See how" link searches guided sessions instead of form videos.
import { findByName } from './move-names.js';

// A breath: seconds in, held, out, held
export const CALM = [
  { names: ['belly breathing', 'diaphragmatic breathing', 'deep breathing', 'abdominal breathing', 'calm breathing'], kind: 'breathe', pace: [4, 0, 4, 0] },
  { names: ['box breathing', 'square breathing', 'four square breathing', 'tactical breathing'], kind: 'breathe', pace: [4, 4, 4, 4] },
  { names: ['long exhale', 'long exhale breathing', 'extended exhale', '4 6 breathing', 'resonant breathing', 'coherent breathing'], kind: 'breathe', pace: [4, 0, 6, 0] },
  { names: ['settle in', 'settling in', 'arrive', 'arriving', 'grounding breath'], kind: 'breathe', pace: [4, 0, 6, 0] },
  { names: ['body scan', 'body scan meditation', 'vipassana', 'vipassana body scan', 'mindful body scan'], kind: 'scan' },
  { names: ['rest in awareness', 'open awareness', 'sitting meditation', 'mindful breathing', 'meditation', 'mindfulness', 'breath awareness'], kind: 'rest', pace: [5, 0, 5, 0] },
];

/** The calm guide for an activity's name, or null when it's a movement. */
export const calmFor = name => findByName(CALM, name) ?? null;
