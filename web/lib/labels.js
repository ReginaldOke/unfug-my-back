import { fmtMinutes } from './dates.js';

// Internally the roles are trigger / helper / unsure (see SPEC.md); the UI calls triggers "stressors".
export const ROLE_ICON = { trigger: '▲', helper: '✓', unsure: '?' };
export const ROLE_LABEL = { trigger: 'Stressor', helper: 'Helper', unsure: 'Unsure' };
export const ROLE_OPTIONS = [['trigger', 'Stressor'], ['helper', 'Helper'], ['unsure', 'Not sure yet']];

export const MEASURE_OPTIONS = [['minutes', 'Time'], ['count', 'Count'], ['yesno', 'Yes / no'], ['rating', 'Rating 0–10']];
export const CATEGORY_OPTIONS = [['activity', 'Activity'], ['exercise', 'Exercise'], ['posture', 'Posture'], ['lifestyle', 'Lifestyle'], ['recovery', 'Recovery']];
export const STATUS_OPTIONS = [['suspected', 'Suspected'], ['testing', 'Testing'], ['likely', 'Likely'], ['ruled_out', 'Ruled out']];
export const STATUS_LABEL = Object.fromEntries(STATUS_OPTIONS);

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
