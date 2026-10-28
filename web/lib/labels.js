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
    default: return `${value} ${factor.unit || '×'}`;
  }
}

/** Changes the last number in some text by `by`, never below 0: "3 × 10" → "3 × 11", "× 6 each side" → "× 7 each side". */
export function bumpLastNumber(text, by) {
  const m = [...text.matchAll(/\d+(?:\.\d+)?/g)].at(-1);
  if (!m) return String(Math.max(0, by));
  const n = Math.max(0, Number(m[0]) + by);
  return text.slice(0, m.index) + String(+n.toFixed(2)) + text.slice(m.index + m[0].length);
}
