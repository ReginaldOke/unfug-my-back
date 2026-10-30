// The iOS app: the same web code runs inside a Capacitor shell, which adds real notifications (they
// fire with the app closed, with action buttons) and Apple Health. In a browser all of this is a no-op.
import * as R from './repos.js';
import { localDate } from './dates.js';
import { parseHM } from './reminders-core.js';
import { parseReminder, reminderOn, stillFor } from './labels.js';

const Cap = globalThis.Capacitor;
export const isNative = !!Cap?.isNativePlatform?.();
const plugin = name => (isNative ? Cap.registerPlugin(name) : null);
const Notes = plugin('LocalNotifications');
const Health = plugin('Health');

// Found by the notifications plugin in the app's bundled web files
const SOUND = 'nudge.wav';
const DAYS_AHEAD = 7; // iOS keeps at most 64 pending notifications
const MOVE_ID = 1;

/** Ask for notification permission and listen for taps. respond(eventId, outcome) handles the move buttons. */
export async function startNative({ respond }) {
  if (!isNative) return;
  await Notes.registerActionTypes({
    types: [
      { id: 'MOVE', actions: [{ id: 'moved', title: 'Moving now' }, { id: 'snoozed', title: 'Snooze 10 min' }] },
      { id: 'ROUTINE', actions: [{ id: 'start', title: 'Start', foreground: true }] },
    ],
  });
  Notes.addListener('localNotificationActionPerformed', ({ actionId, notification: n }) => {
    const x = n.extra ?? {};
    if (x.eventId && ['moved', 'already_moved', 'snoozed'].includes(actionId)) return respond(x.eventId, actionId);
    if (x.hash) location.hash = x.hash;
  });
  const { display } = await Notes.checkPermissions();
  if (display === 'prompt' || display === 'prompt-with-rationale') await Notes.requestPermissions();
  syncNotifications();
  if (R.settings().healthSync) syncHealth().catch(() => {});
  document.addEventListener('visibilitychange', () => { if (!document.hidden && R.settings().healthSync) syncHealth().catch(() => {}); });
}

export async function notificationPermission() {
  if (!isNative) return null;
  return (await Notes.checkPermissions()).display;
}

let timer = 0, lastPlan = '';
/** Re-plans every pending system notification from what's stored. Cheap; called after any change. */
export function syncNotifications() {
  if (!isNative) return;
  clearTimeout(timer);
  timer = setTimeout(plan, 300);
}

async function plan() {
  const s = R.settings();
  const now = new Date();
  const list = [];
  const at = (date, hm) => { const d = new Date(`${date}T00:00:00`); const m = parseHM(hm); d.setHours(Math.floor(m / 60), m % 60); return d; };

  // The movement reminder ahead, if there is one
  const move = R.reminders.pending();
  if (move && new Date(move.scheduledFor) > now) {
    const still = s.lastMovementAt ? (new Date(move.scheduledFor) - new Date(s.lastMovementAt)) / 60_000 : s.reminder.intervalMin;
    list.push({ id: MOVE_ID, title: 'Time to move', body: `You've been still for ${stillFor(still)}. A short walk or stretch will do.`, actionTypeId: 'MOVE', schedule: { at: new Date(move.scheduledFor) }, extra: { eventId: move.id } });
  }
  // Check-ins and routines for the next week, skipping today's if they're already done
  let id = 100;
  for (let k = 0; k < DAYS_AHEAD; k++) {
    const date = localDate(new Date(now.getTime() + k * 86_400_000));
    if (s.checkinTime && !R.checkins.entryFor(date)) {
      const when = at(date, s.checkinTime);
      if (when > now) list.push({ id: id++, title: 'Time to check in', body: 'Takes about a minute.', schedule: { at: when }, extra: { hash: '#/checkin' } });
    }
    for (const r of R.routines.all()) {
      r.schedule.filter(e => reminderOn(e, date)).forEach((e, i) => {
        const when = at(date, parseReminder(e).time);
        if (when <= now || R.routines.completionsOn(date, r.id).length > i) return;
        list.push({ id: id++, title: R.routineLabel(r), body: `${r.items.length} moves. Tap to start.`, actionTypeId: 'ROUTINE', schedule: { at: when }, extra: { hash: `#/routine/${r.id}` } });
      });
    }
  }
  // Ticks run every 20 seconds; only touch iOS when the plan changes
  const sig = JSON.stringify(list.map(n => [n.title, +n.schedule.at]));
  if (sig === lastPlan) return;
  lastPlan = sig;
  const { notifications: pending } = await Notes.getPending();
  if (pending.length) await Notes.cancel({ notifications: pending.map(n => ({ id: n.id })) });
  // iOS plays nothing unless a sound is named: the app's own chime (nudge.wav, at the top of the web files), and a buzz on silent
  if (list.length) await Notes.schedule({ notifications: list.slice(0, 60).map(n => ({ sound: SOUND, ...n })) });
}

/** For the Reminders sheet: whether iOS lets the app notify, how many are lined up, and the next one. */
export async function notificationSummary() {
  if (!isNative) return null;
  const { display } = await Notes.checkPermissions();
  const { notifications = [] } = await Notes.getPending().catch(() => ({}));
  const when = n => +new Date(n.schedule?.at ?? 0);
  const next = [...notifications].sort((a, b) => when(a) - when(b))[0];
  return { allowed: display === 'granted', pending: notifications.length, next: next ? { title: next.title, at: new Date(when(next)) } : null };
}

/** A test notification in five seconds (lock the phone to see it arrive). Returns false if not allowed. */
export async function testNotification() {
  if (!isNative) return false;
  let { display } = await Notes.checkPermissions();
  if (display !== 'granted') display = (await Notes.requestPermissions()).display;
  if (display !== 'granted') return false;
  await Notes.schedule({ notifications: [{ id: 99, title: 'Time to move', body: 'This is how your nudges will look and sound.', sound: SOUND, actionTypeId: 'MOVE', schedule: { at: new Date(Date.now() + 5000) } }] });
  return true;
}

/** Minutes covered by a set of [start, end] ms intervals, overlaps counted once. */
function covered(spans) {
  let total = 0, end = -Infinity;
  for (const [a, b] of [...spans].sort((x, y) => x[0] - y[0])) {
    if (b <= end) continue;
    total += b - Math.max(a, end);
    end = b;
  }
  return total / 60_000;
}

/** Asks for read access to steps and sleep (iOS shows its own sheet the first time). */
export async function connectHealth() {
  if (!isNative) return false;
  const { available } = await Health.isAvailable();
  if (!available) return false;
  await Health.requestAuthorization({ read: ['steps', 'sleep'] });
  R.setSettings({ healthSync: true });
  return syncHealth();
}

/** Pulls the last 60 days of daily steps and nightly sleep into the diary. Returns how many days changed. */
export async function syncHealth(days = 60) {
  if (!isNative) return 0;
  const end = new Date(), start = new Date(end.getTime() - days * 86_400_000);
  const range = { startDate: start.toISOString(), endDate: end.toISOString() };
  const rows = new Map();
  const row = date => rows.get(date) ?? rows.set(date, { date }).get(date);

  // What came back is kept, so the Apple Health screen can say exactly what was found (or what failed)
  const report = { at: new Date().toISOString(), errors: [] };
  const failed = what => e => { report.errors.push(`${what}: ${e?.message ?? e}`); return {}; };
  const { samples: steps = [] } = await Health.queryAggregated({ dataType: 'steps', ...range, bucket: 'day', aggregation: 'sum' }).catch(failed('Steps'));
  report.stepDays = steps.filter(x => x.value > 0).length;
  for (const x of steps) if (x.value > 0) row(localDate(new Date(x.startDate))).steps = Math.round(x.value);

  // Sleep counts toward the morning you woke up. Apple Watch and sleep apps record time asleep; an
  // iPhone on its own only records time in bed (from the Sleep schedule), so that's used when it's all
  // there is. Overlapping samples (phone and watch, say) are merged so no minute counts twice.
  const { samples: sleep = [] } = await Health.readSamples({ dataType: 'sleep', ...range, limit: 5000 }).catch(failed('Sleep'));
  report.sleepSamples = sleep.length;
  report.sleepStates = [...new Set(sleep.map(x => x.sleepState ?? 'unknown'))];
  const nights = new Map(); // woke date -> { asleep: [[start, end]], inBed: [[start, end]] }
  for (const x of sleep) {
    if (x.sleepState === 'awake') continue;
    const night = nights.get(localDate(new Date(x.endDate))) ?? { asleep: [], inBed: [] };
    nights.set(localDate(new Date(x.endDate)), night);
    night[x.sleepState === 'inBed' ? 'inBed' : 'asleep'].push([+new Date(x.startDate), +new Date(x.endDate)]);
  }
  for (const [date, { asleep, inBed }] of nights) {
    const slept = covered(asleep) >= 60, min = slept ? covered(asleep) : covered(inBed);
    if (min >= 60) Object.assign(row(date), { sleepHours: Math.round(min / 6) / 10, inBed: slept ? 0 : 1 });
  }

  const n = R.health.merge([...rows.values()], 'healthkit');
  report.sleepNights = [...rows.values()].filter(r => r.sleepHours != null).length;
  R.setSettings({ healthReport: report });
  // The first time sleep or steps arrive, they go on Home's chart straight away (switch them off from its •••)
  const added = R.settings().healthOnChart ?? [];
  const fresh = ['sleepHours', 'steps'].filter(key => !added.includes(key) && R.health.has(key));
  if (fresh.length) R.setSettings({ chartExtras: [...new Set([...(R.settings().chartExtras ?? []), ...fresh])], healthOnChart: [...added, ...fresh] });
  return n;
}
