// Movement reminder rules (SPEC.md › Movement reminders). Pure, unit-tested in test/reminders.test.js.
//
// "Dead man's switch": exactly one reminder is always scheduled `intervalMin` ahead, and every wake
// pushes it back if the user has moved since the last check.

export function parseHM(hm) {
  const [h, m] = hm.split(':').map(Number);
  return h * 60 + m;
}

function atMinutes(day, mins) {
  const d = new Date(day);
  d.setHours(0, 0, 0, 0);
  d.setMinutes(mins);
  return d;
}

/** Earliest time at or after `date` inside the active hours (indexed by getDay()), or null if no day is active. */
export function nextActiveTime(date, activeHours) {
  for (let i = 0; i < 8; i++) {
    const day = new Date(date.getFullYear(), date.getMonth(), date.getDate() + i);
    const ah = activeHours[day.getDay()];
    if (!ah?.on) continue;
    const start = atMinutes(day, parseHM(ah.start)), end = atMinutes(day, parseHM(ah.end));
    if (i === 0) {
      if (date < start) return start;
      if (date < end) return new Date(date);
      continue;
    }
    return start;
  }
  return null;
}

/** Real movement: at least `minWalkMin` of walking/running, or at least `minSteps` steps. */
export function isRealMovement(sample, cfg) {
  const moving = sample.type === 'walking' || sample.type === 'running';
  return (moving && sample.minutes >= cfg.minWalkMin) || (sample.steps ?? 0) >= cfg.minSteps;
}

/** When the next reminder should fire, counting from `from` (usually the end of the last movement). */
export function nextReminderTime(from, cfg, pausedUntil = null) {
  let t = new Date(from.getTime() + cfg.intervalMin * 60_000);
  if (pausedUntil && t < new Date(pausedUntil)) t = new Date(pausedUntil);
  return nextActiveTime(t, cfg.activeHours);
}

/**
 * The rescheduling rule that runs on every wake.
 * samples: motion since the last wake, as { type, end, minutes, steps }.
 * Returns { action: 'reschedule' | 'pushBack' | 'keep', at?, movementEndedAt? }.
 */
export function evaluateWake({ now, samples, cfg, pausedUntil = null, pendingAt = null, drivingNow = false }) {
  const moves = samples.filter(s => isRealMovement(s, cfg));
  if (moves.length) {
    const end = new Date(Math.max(...moves.map(s => +new Date(s.end))));
    return { action: 'reschedule', at: nextReminderTime(end, cfg, pausedUntil), movementEndedAt: end };
  }
  // Don't fire mid-drive: push back and check again shortly
  if (pendingAt && pendingAt <= now && drivingNow) {
    return { action: 'pushBack', at: nextActiveTime(new Date(+now + cfg.snoozeMin * 60_000), cfg.activeHours) };
  }
  return { action: 'keep' };
}
