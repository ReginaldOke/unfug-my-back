// Turns what HealthKit hands back into one row per day. Pure, unit-tested in test/health-days.test.js.
import { localDate } from './dates.js';

const dayOf = iso => localDate(new Date(iso));
const round = (v, dp = 0) => Math.round(v * 10 ** dp) / 10 ** dp;

/** Totals per day: { date → sum of value }, by each sample's start. */
export function sumByDay(samples) {
  const m = new Map();
  for (const x of samples) if (Number.isFinite(x.value)) m.set(dayOf(x.startDate), (m.get(dayOf(x.startDate)) ?? 0) + x.value);
  return m;
}

/** Averages per day: { date → mean value }. */
export function averageByDay(samples) {
  const m = new Map();
  for (const x of samples) {
    if (!Number.isFinite(x.value)) continue;
    const d = dayOf(x.startDate), [sum, n] = m.get(d) ?? [0, 0];
    m.set(d, [sum + x.value, n + 1]);
  }
  return new Map([...m].map(([d, [sum, n]]) => [d, sum / n]));
}

/** Hours with a stand logged by Apple Watch, per day. */
export function standHoursByDay(samples) {
  const m = new Map();
  for (const x of samples) if (x.standState === 'stood' || (x.standState == null && x.value === 1)) m.set(dayOf(x.startDate), (m.get(dayOf(x.startDate)) ?? 0) + 1);
  return m;
}

/** "highIntensityIntervalTraining" → "High intensity interval training" */
export const workoutName = type => {
  const words = String(type ?? 'other').replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase();
  return words[0].toUpperCase() + words.slice(1);
};

/**
 * Workouts per day, as { type, name, minutes, km?, start }. A workout recorded by both the Watch and
 * an app (Strava, a surf app) shows up twice; any that overlaps an earlier one of the same type is dropped.
 */
export function workoutsByDay(workouts) {
  const m = new Map(), kept = [];
  for (const w of [...workouts].sort((a, b) => a.startDate.localeCompare(b.startDate))) {
    const start = +new Date(w.startDate), end = +new Date(w.endDate);
    if (!(end > start)) continue;
    if (kept.some(k => k.type === w.workoutType && start < k.end && end > k.start)) continue;
    kept.push({ type: w.workoutType, start, end });
    const d = dayOf(w.startDate);
    const row = { type: w.workoutType, name: workoutName(w.workoutType), minutes: round((w.duration ?? (end - start) / 1000) / 60), start: w.startDate };
    if (w.totalDistance > 0) row.km = round(w.totalDistance / 1000, 1);
    m.set(d, [...(m.get(d) ?? []), row]);
  }
  return m;
}

// Which check-in items a workout type fits: [workout type, words in the item's name]
const WORKOUT_ITEMS = [
  [/^surf/, /surf/], [/^swim/, /swim/], [/^running|^track/, /\brun|jog/], [/cycl|biking|handcycling/, /cycl|bike|biking|\bride|riding/],
  [/^walking$/, /walk/], [/^hiking/, /hike|hiking|bushwalk|trek/], [/^yoga/, /yoga/], [/^pilates/, /pilates/],
  [/strength|weightlifting|crosstraining/, /gym|weight|strength|lift/], [/^rowing/, /\brow/], [/climbing/, /climb|boulder/],
  [/^tennis/, /tennis/], [/boxing/, /box/], [/danc/, /danc/], [/^soccer/, /soccer|football/], [/^golf/, /golf/],
  [/skiing|snowboard/, /\bski|snowboard/], [/martialarts/, /martial|jiu|bjj|karate|judo/],
];

/**
 * Check-in items a day's workouts already answer, as Map factorId → amount: minutes for a timed item,
 * how many workouts for a counted one, and done for a yes/no one. Each item matches at most once.
 */
export function workoutTicks(workouts, factors) {
  const out = new Map();
  for (const f of factors) {
    if (!['minutes', 'count', 'yesno'].includes(f.measureType)) continue;
    const name = String(f.name ?? '').toLowerCase();
    const fits = (workouts ?? []).filter(w => WORKOUT_ITEMS.some(([type, words]) => type.test(String(w.type).toLowerCase()) && words.test(name)));
    if (!fits.length) continue;
    const minutes = Math.round(fits.reduce((n, w) => n + (w.minutes ?? 0), 0));
    out.set(f.id, f.measureType === 'minutes' ? minutes : f.measureType === 'count' ? fits.length : 1);
  }
  for (const [id, v] of out) if (!(v > 0)) out.delete(id);
  return out;
}
