import { fmtMinutes } from './dates.js';

// Internally the roles are trigger / helper / unsure (see SPEC.md); the UI calls triggers "stressors".
export const ROLE_ICON = { trigger: '▲', helper: '✓', unsure: '?' };
export const ROLE_LABEL = { trigger: 'Stressor', helper: 'Helper', unsure: 'Unsure' };
export const ROLE_OPTIONS = [['trigger', 'Stressor'], ['helper', 'Helper'], ['unsure', 'Not sure yet']];

export const MEASURE_OPTIONS = [['minutes', 'Time'], ['count', 'Count'], ['yesno', 'Yes / no'], ['rating', 'Rating 0–10']];
export const CATEGORY_OPTIONS = [['activity', 'Activity'], ['exercise', 'Exercise'], ['posture', 'Posture'], ['lifestyle', 'Lifestyle'], ['recovery', 'Recovery']];
export const STATUS_OPTIONS = [['suspected', 'Suspected'], ['testing', 'Testing'], ['likely', 'Likely'], ['ruled_out', 'Ruled out']];
export const STATUS_LABEL = Object.fromEntries(STATUS_OPTIONS);

/** How a 0–10 night's sleep reads in words: 0 is terrible, 10 is great. */
export const sleepWord = v => (v <= 2 ? 'Terribly' : v <= 4 ? 'Poorly' : v <= 6 ? 'OK' : v <= 8 ? 'Well' : 'Great');

export const QUALITIES = ['ache', 'sharp', 'burning', 'tingling', 'numbness', 'stiffness'];

export function defaultUnit(measureType) {
  return { minutes: 'min', count: 'times', yesno: '', rating: '/10' }[measureType] ?? '';
}

export function fmtAmount(factor, value) {
  switch (factor.measureType) {
    case 'yesno': return 'Yes';
    case 'minutes': return fmtMinutes(value);
    case 'rating': return `${value}/10`;
    default: return value === 1 && factor.unit === 'times' ? '1 time' : `${value} ${factor.unit || '×'}`;
  }
}

/** Changes the last number in some text by `by`, never below 0: "3 × 10" → "3 × 11", "× 6 each side" → "× 7 each side". */
export function bumpLastNumber(text, by) {
  const m = [...text.matchAll(/\d+(?:\.\d+)?/g)].at(-1);
  if (!m) return String(Math.max(0, by));
  const n = Math.max(0, Number(m[0]) + by);
  return text.slice(0, m.index) + String(+n.toFixed(2)) + text.slice(m.index + m[0].length);
}

/** A routine reminder: "18:00" (every day) or "18:00@1,3,5" (only those weekdays, 0 = Sunday). */
export function parseReminder(entry) {
  const [time, days] = entry.split('@');
  return { time, days: days ? days.split(',').map(Number) : null };
}
export const formatReminder = (time, days) => (days && days.length && days.length < 7 ? `${time}@${[...days].sort((a, b) => a - b).join(',')}` : time);
/** Whether a reminder applies on a date (YYYY-MM-DD). */
export const reminderOn = (entry, date) => {
  const { days } = parseReminder(entry);
  return !days || days.includes(new Date(`${date}T12:00:00`).getDay());
};

// A fitting emoji for a new stressor or helper, from words in its name; first match wins
const EMOJI_WORDS = [
  [/guitar/, '🎸'], [/piano|keyboard/, '🎹'], [/gaming|game|console/, '🎮'], [/break|pause|rest\b/, '⏸️'],
  [/desk|sitting|seated|chair|office/, '🪑'], [/sofa|couch|lounging/, '🛋️'], [/bed|lying|sleep|nap/, '🛏️'],
  [/driv|car\b|commut/, '🚗'], [/flight|fly|travel|plane/, '✈️'], [/phone|scroll/, '📱'], [/screen|computer|laptop|typing/, '💻'],
  [/read|book/, '📖'],
  [/lift|weights|gym|deadlift|squat/, '🏋️'], [/carry|bag|backpack/, '🎒'], [/moving house|boxes|heavy/, '📦'],
  [/garden/, '🌱'], [/clean|vacuum|chores|housework/, '🧹'], [/cook|kitchen/, '🍳'], [/kid|child|baby/, '👶'],
  [/stand/, '🧍'], [/bend/, '🙇'], [/stress|work|deadline/, '💼'], [/alcohol|beer|wine|drink/, '🍷'], [/coffee|caffeine/, '☕'],
  [/run|jog/, '🏃'], [/walk|steps/, '🚶'], [/hik/, '🥾'], [/cycl|bike|spin/, '🚴'], [/swim/, '🏊'], [/row/, '🚣'],
  [/yoga|pilates|meditat|mindful/, '🧘'], [/breath/, '🌬️'], [/stretch|mobility|flexib/, '🤸'], [/massage/, '💆'],
  [/physio|chiro|osteo|doctor/, '🩺'], [/heat|hot water|sauna/, '🔥'], [/ice|cold/, '🧊'], [/bath|shower/, '🛁'],
  [/water|hydrat/, '💧'], [/football|soccer/, '⚽'], [/basketball/, '🏀'], [/tennis|padel|squash/, '🎾'], [/golf/, '⛳'],
  [/climb|boulder/, '🧗'], [/dance/, '💃'], [/box|martial|kick/, '🥊'],
  [/core|plank|crunch|sit-?up|push-?up|pull-?up|calisthen|strength/, '💪'],
];
export function emojiFor(name, { role, exercise } = {}) {
  const n = (name ?? '').toLowerCase();
  const hit = EMOJI_WORDS.find(([re]) => re.test(n));
  return hit ? hit[1] : exercise ? '💪' : role === 'helper' ? '🌿' : '📍';
}

/** "about 45 minutes", "about 1 hour 30 minutes"; past six hours it's most likely a night or a day away, so just "hours". */
export function stillFor(min) {
  if (min < 60) return `about ${Math.max(5, Math.round(min / 5) * 5)} minutes`;
  if (min >= 360) return 'hours';
  const q = Math.round(min / 15) * 15, h = Math.floor(q / 60), m = q % 60;
  return `about ${h} hour${h > 1 ? 's' : ''}${m ? ` ${m} minutes` : ''}`;
}
