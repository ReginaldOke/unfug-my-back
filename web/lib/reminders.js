// Reminder service: runs the dead man's switch on every wake, plus check-in and routine reminders.
import * as R from './repos.js';
import * as core from './reminders-core.js';
import { motion } from './motion.js';
import { notify, dismissKey } from './notify.js';
import { localDate, minutesSince } from './dates.js';
import { startNative, syncNotifications } from './native.js';
import { parseReminder, reminderOn, stillFor } from './labels.js';

const TICK_MS = 20_000;

export function start() {
  // Re-show a movement reminder that fired before a reload
  const [awaiting] = R.reminders.awaiting();
  if (awaiting && minutesSince(awaiting.firedAt) < R.settings().reminder.intervalMin) showMovementBanner(awaiting);
  wake('open');
  document.addEventListener('visibilitychange', () => { if (!document.hidden) wake('foreground'); });
  setInterval(() => wake('tick'), TICK_MS);
  startNative({ respond });
}

export const status = () => ({ pending: R.reminders.pending(), awaiting: R.reminders.awaiting()[0] ?? null });

/** Runs on every wake: app open, foreground, timer tick, simulated motion, notification action. */
export function wake() {
  runWake();
  syncNotifications(); // the app hands what's ahead to iOS, so it fires with the app closed
}

function runWake() {
  const now = new Date();
  const s = R.settings();
  const cfg = s.reminder;
  const samples = motion.samplesSince(s.lastWakeAt);
  R.setSettings({ lastWakeAt: now.toISOString() });
  checkDailyReminders(now);

  if (!cfg.enabled) return cancelPending();

  let pending = R.reminders.pending();
  const d = core.evaluateWake({
    now, samples, cfg, pausedUntil: s.pausedUntil,
    pendingAt: pending ? new Date(pending.scheduledFor) : null, drivingNow: motion.isDriving(),
  });
  if (d.movementEndedAt) {
    R.setSettings({ lastMovementAt: d.movementEndedAt.toISOString() });
    dismissKey('move');
  }
  if (d.action === 'reschedule') schedule(d.at);
  else if (d.action === 'pushBack') R.reminders.update(pending.id, { scheduledFor: d.at.toISOString() });

  pending = R.reminders.pending();
  if (!pending) return schedule(core.nextReminderTime(now, cfg, s.pausedUntil));
  const due = new Date(pending.scheduledFor);
  if (due > now) return;
  // Due long ago (the page was closed): don't fire a stale reminder, start the interval again
  if (now - due > cfg.intervalMin * 60_000) return schedule(core.nextReminderTime(now, cfg, s.pausedUntil));
  fire(pending, now);
}

function fire(ev, now) {
  const s = R.settings();
  for (const old of R.reminders.awaiting()) R.reminders.update(old.id, { outcome: 'ignored' });
  const still = s.lastMovementAt ? Math.round(minutesSince(s.lastMovementAt, now)) : s.reminder.intervalMin;
  R.reminders.update(ev.id, { firedAt: now.toISOString(), stationaryMinutesBefore: still });
  showMovementBanner(R.reminders.awaiting()[0]);
  // Dead man's switch: there is always exactly one reminder ahead
  schedule(core.nextReminderTime(now, s.reminder, s.pausedUntil));
}

function showMovementBanner(ev) {
  const items = R.routines.all()[0]?.items ?? [];
  const idea = items.length ? ` Try: ${items[Math.floor(Math.random() * items.length)].name.toLowerCase()}.` : '';
  notify({
    key: 'move',
    title: 'Time to move',
    body: `You've been still for ${stillFor(ev.stationaryMinutesBefore ?? R.settings().reminder.intervalMin)}.${idea}`,
    actions: [
      { label: 'Moving now', primary: true, run: () => respond(ev.id, 'moved') },
      { label: 'Snooze 10 min', run: () => respond(ev.id, 'snoozed') },
    ],
  });
}

export function respond(eventId, outcome) {
  R.reminders.update(eventId, { outcome });
  if (outcome !== 'snoozed') return markMoved();
  const cfg = R.settings().reminder;
  schedule(core.nextActiveTime(new Date(Date.now() + cfg.snoozeMin * 60_000), cfg.activeHours));
}

/** The user says they just moved: resets the switch from now. */
export function markMoved() {
  const now = new Date();
  R.setSettings({ lastMovementAt: now.toISOString() });
  dismissKey('move');
  reschedule(now);
}

export function pause(hours) {
  R.setSettings({ pausedUntil: new Date(Date.now() + hours * 3_600_000).toISOString() });
  reschedule();
}

export function resume() {
  R.setSettings({ pausedUntil: null });
  reschedule();
}

/** Re-plan the pending reminder from `from` (after settings changes, pause, or movement). */
export function reschedule(from = new Date()) {
  const s = R.settings();
  if (!s.reminder.enabled) return cancelPending();
  schedule(core.nextReminderTime(from, s.reminder, s.pausedUntil));
}

function schedule(at) {
  cancelPending();
  syncNotifications();
  if (!at) return null;
  return R.reminders.create({ scheduledFor: at.toISOString(), firedAt: null, outcome: null, stationaryMinutesBefore: null });
}

function cancelPending() {
  const p = R.reminders.pending();
  if (p) R.reminders.update(p.id, { outcome: 'cancelled' });
}

/** Evening check-in and routine reminders, each at most once a day, within two hours of their time. */
function checkDailyReminders(now) {
  const s = R.settings();
  const today = localDate(now);
  const mins = now.getHours() * 60 + now.getMinutes();
  const sent = { ...s.lastNotified };
  let changed = false;
  const due = (key, hm) => {
    const t = core.parseHM(hm);
    if (mins < t || mins >= t + 120 || sent[key] === today) return false;
    sent[key] = today;
    changed = true;
    return true;
  };

  if (due('checkin', s.checkinTime) && !R.checkins.entryFor(today)) {
    notify({
      key: 'checkin', title: 'Time to check in', body: 'Takes about a minute.',
      actions: [{ label: 'Start', primary: true, run: () => { location.hash = '#/checkin'; } }],
    });
  }
  for (const r of R.routines.all()) {
    r.schedule.filter(e => reminderOn(e, today)).forEach((e, i) => {
      if (!due(`routine:${r.id}:${e}`, parseReminder(e).time) || R.routines.completionsOn(today, r.id).length > i) return;
      notify({
        key: `routine:${r.id}`, title: R.routineLabel(r), body: `${r.items.length} moves, about ${Math.max(5, Math.round(r.items.length * 1.5 / 5) * 5)} minutes.`,
        actions: [
          { label: 'Start', primary: true, run: () => { location.hash = `#/routine/${r.id}/run`; } },
          { label: 'Mark done', run: () => R.routines.complete(r.id, true) },
        ],
      });
    });
  }
  if (changed) R.setSettings({ lastNotified: sent });
}
