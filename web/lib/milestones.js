// Milestones worth a little party: check-in streaks, and stretches of days without a flare. Each has a
// key made from its run's first day, so a new streak (or a new calm stretch) can be celebrated again.
// Pure, unit-tested in test/milestones.test.js.
import { addDays, daysBetween } from './dates.js';
import { flareEpisodes } from './analysis.js';

export const STREAKS = [3, 7, 14, 30, 90, 180];
export const CALM_RUNS = [7, 14, 30];
// A calm stretch needs check-ins on most of its days, so a long break doesn't count as one
const CALM_COVER = 0.7;
// The Home banner for a calm stretch stays up for a few days after it's reached
export const CALM_SHOW_DAYS = 3;

/** Days in a row with a check-in, ending on `today`, and the first of them. */
export function streakRun(dates, today) {
  const done = new Set(dates);
  let d = today, n = 0;
  while (done.has(d)) { n++; d = addDays(d, -1); }
  return { days: n, start: addDays(today, 1 - n) };
}

/** The streak milestone `today`'s check-in makes, when it lands exactly on one. */
export function streakMilestone(dates, today) {
  const { days, start } = streakRun(dates, today);
  return STREAKS.includes(days) ? { id: `streak-${days}`, days, key: `streak-${days}-${start}` } : null;
}

/**
 * The longest calm stretch reached (7, 14 or 30 days with no flare, checked in on most of them) as of
 * `today`, with the day it was reached, or null. entries: [{ date, painScore }], logged: [{ timestamp, intensity }].
 */
export function calmMilestone(entries, logged, today) {
  const dates = entries.map(e => e.date).filter(d => d <= today).sort();
  if (!dates.length) return null;
  const lastFlare = flareEpisodes(entries.filter(e => e.date <= today), logged).filter(f => f.start <= today).at(-1);
  if (lastFlare && lastFlare.end >= today) return null;
  const start = lastFlare && addDays(lastFlare.end, 1) > dates[0] ? addDays(lastFlare.end, 1) : dates[0];
  const done = new Set(dates);
  for (const n of [...CALM_RUNS].reverse()) {
    // Reached on the first day the stretch was n days long with enough check-ins in it
    for (let reached = addDays(start, n - 1); reached <= today; reached = addDays(reached, 1)) {
      let checked = 0;
      for (let i = 0; i < n; i++) if (done.has(addDays(reached, -i))) checked++;
      if (checked >= Math.ceil(n * CALM_COVER) && done.has(reached)) return { id: `calm-${n}`, days: n, reached, key: `calm-${n}-${start}` };
    }
  }
  return null;
}

/** The calm milestone to show on Home today: reached in the last few days and not dismissed. */
export function calmBanner(entries, logged, today, dismissed = {}) {
  const m = calmMilestone(entries, logged, today);
  return m && !dismissed[m.key] && daysBetween(m.reached, today) < CALM_SHOW_DAYS ? m : null;
}
