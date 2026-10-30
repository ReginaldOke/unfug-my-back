// Repositories: the domain API the views use. Views never touch store.js directly.
import * as S from './store.js';
import { localDate, addDays } from './dates.js';
import { SEED_FACTORS, SEED_ROUTINE, SEED_GYM } from './seed.js';
import { defaultUnit, emojiFor } from './labels.js';
import { regionAt, H } from './regions3d.js';
import { regionById } from './regions.js';
import { planImport } from './import.js';

export const settings = S.settings;
export const setSettings = S.setSettings;
export const subscribe = S.subscribe;
export const snapshot = S.snapshot;
export const uuid = S.uuid;

export function init() {
  S.load();
  if (!S.settings().seeded) seed();
  retireSeeds();
  addNewSeeds();
  trimDefaultRoutine();
  addGymRoutine();
  fixMarkerFrame();
  giveRoutinesFactors();
}

// Each routine is tracked as its own exercise (done or not, with how hard), so it shows up in the
// check-in, the chart and the patterns like anything else. Older routines pointed at a shared helper
// such as Stretching; past logs stay with that helper.
function giveRoutinesFactors() {
  const missing = S.table('routines').filter(r => !r.isArchived && !factors.get(r.linkedFactorId)?.routineId);
  if (missing.length) S.batch(() => { for (const r of missing) S.update('routines', r.id, { linkedFactorId: routineFactor(r).id }); });
  // Routine items made before routines had their own emoji all wore the barbell
  const plain = S.table('routines').filter(r => factors.get(r.linkedFactorId)?.icon === '🏋️' && routineIcon(r) !== '🏋️');
  if (plain.length) S.batch(() => { for (const r of plain) S.update('factors', r.linkedFactorId, { icon: routineIcon(r) }); });
}
/** "Calisthenics · Push" for a variation in a group, otherwise just the name. */
export const routineLabel = r => (r.group ? `${r.group} · ${r.name}` : r.name);
/** A routine's emoji: chosen from its group and name ("Daily mobility" → 🤸), or a flexed arm. */
export const routineIcon = r => r.icon || emojiFor(`${r.group ?? ''} ${r.name}`, { exercise: true });

function routineFactor(r) {
  return S.insert('factors', {
    name: routineLabel(r), role: 'helper', measureType: 'yesno', unit: '', category: 'exercise', icon: routineIcon(r),
    status: 'suspected', isArchived: false, source: 'routine', routineId: r.id,
    sortWeight: Math.min(0, ...S.table('factors').map(f => f.sortWeight ?? 0)) - 1,
  });
}

// Body map spots saved before the model was turned the right way round were stored mirrored front to
// back (and left to right). Flip their tap points once and label them again from where they really are.
function fixMarkerFrame() {
  if (S.settings().markerFrame === 2) return;
  S.batch(() => {
    for (const m of S.table('painMarkers')) {
      if (!m.modelPoint) continue;
      const p = { x: -m.modelPoint.x, y: m.modelPoint.y, z: -m.modelPoint.z };
      const regionId = regionAt(p, null, H);
      S.update('painMarkers', m.id, { modelPoint: p, regionId, side: regionById[regionId]?.side ?? m.side });
    }
    S.settings().markerFrame = 2;
  });
}

// Seeds that were renamed, applied once to existing diaries
const RENAMED = { 'Extension breaks': 'Sitting breaks', 'Guitar (seated)': 'Guitar' };
// Seed factors taken out of the app: deleted for people who never logged them, otherwise switched off
// once (history kept, and they can switch them back on). Matched loosely, as people rename them.
const RETIRED = [/^hunched over phone or laptop$/i, /^poor sleep$/i, /^heavy lifting or bending$/i, /^manual work/i, /^crossed-leg sitting$/i, /^training volume above plan$/i, /^mobility routine$/i];
function retireSeeds() {
  const done = S.settings().retiredSeeds ?? [];
  const hit = S.table('factors').filter(f => f.source === 'seed' && RETIRED.some(re => re.test(f.name)) && !done.includes(f.id));
  const renames = S.table('factors').filter(f => f.source === 'seed' && RENAMED[f.name]);
  if (!hit.length && !renames.length) return;
  S.batch(() => {
    for (const f of renames) S.update('factors', f.id, { name: RENAMED[f.name] });
    for (const f of hit) {
      if (S.table('factorLogs').some(l => l.factorId === f.id)) S.update('factors', f.id, { isArchived: true, retired: true });
      else S.removeWhere('factors', x => x.id === f.id);
    }
    S.settings().retiredSeeds = [...done, ...hit.map(f => f.id)];
  });
}

// The starter routine used to have eight moves; any routine still holding exactly those, untouched,
// gets the shorter four. Edited routines are left alone.
const OLD_DEFAULT_MOVES = ['Half-kneeling hip flexor stretch', 'Single-leg hinge', 'Cat-cow', 'Open book', 'Cobra and downward dog', 'Bird dog', 'Hamstring stretch', 'Deep squat hold'];
function trimDefaultRoutine() {
  const old = S.table('routines').filter(r => r.items?.map(it => it.name).join('|') === OLD_DEFAULT_MOVES.join('|'));
  if (old.length) S.batch(() => { for (const r of old) S.update('routines', r.id, { items: structuredClone(SEED_ROUTINE.items) }); });
}

// Everyone gets the Gym split once (new diaries and existing ones), unless they already have a Gym routine
function addGymRoutine() {
  if (S.settings().gymAdded) return;
  S.batch(() => {
    if (!S.table('routines').some(r => !r.isArchived && /^gym$/i.test(r.group ?? r.name))) {
      for (const v of SEED_GYM) S.insert('routines', { ...structuredClone(v), measure: 'effort', schedule: [], linkedFactorId: null, isArchived: false });
    }
    S.settings().gymAdded = true;
  });
}

// Seed factors added after launch reach existing diaries once (switched on if they're on for new
// users), and never come back after being deleted
const ADDED_SEEDS = ['Screen time', 'Yoga or pilates', 'Team sport', 'Meditation', 'Standing for a long time', 'Lifting and bending', 'Slouching on the sofa', 'Housework or gardening', 'Long flight or train', 'Massage'];
function addNewSeeds() {
  const done = S.settings().seedsAdded ?? [];
  const todo = ADDED_SEEDS.filter(n => !done.includes(n));
  if (!todo.length) return;
  S.batch(() => {
    const top = Math.max(0, ...S.table('factors').map(f => f.sortWeight ?? 0));
    todo.forEach((name, i) => {
      const seed = SEED_FACTORS.find(f => f.name === name);
      if (!seed || S.table('factors').some(f => f.name === name)) return;
      const { defaultOn, ...f } = seed;
      S.insert('factors', { ...f, status: 'suspected', isArchived: !defaultOn, sortWeight: top + 1 + i, source: 'seed' });
    });
    S.settings().seedsAdded = [...done, ...todo];
  });
}

/** Merges an exported diary into this one (see import.js). Returns the plan's summary. */
export function importDiary(data, plan = planImport(S.snapshot(), data)) {
  S.batch(() => {
    for (const [name, rows] of Object.entries(plan.add)) S.table(name)?.push(...rows);
  });
  giveRoutinesFactors();
  return plan.summary;
}

export function wipeEverything() {
  S.wipe();
  init();
}

function seed() {
  S.batch(() => {
    SEED_FACTORS.forEach(({ defaultOn, ...f }, i) =>
      S.insert('factors', { ...f, status: 'suspected', isArchived: !defaultOn, sortWeight: i, source: 'seed' }));
    S.insert('routines', { ...SEED_ROUTINE, schedule: [], linkedFactorId: null, isArchived: false });
    S.settings().seeded = true;
    S.settings().seedsAdded = [...ADDED_SEEDS];
  });
}

export const isExercise = f => f.category === 'exercise';

const byNewest = (a, b) => (b.date || b.timestamp || b.createdAt).localeCompare(a.date || a.timestamp || a.createdAt);

export const factors = {
  all: ({ archived = false } = {}) => S.table('factors').filter(f => archived || !f.isArchived),
  get: id => S.table('factors').find(f => f.id === id),

  /**
   * Active factors for a check-in step, in the order the user arranged them. Exercise has its own
   * step, whatever its role; the stressor and helper steps get everything else.
   */
  forCheckin: (roles, { exercise = false } = {}) => factors.all()
    .filter(f => !f.routineId && (exercise ? isExercise(f) : roles.includes(f.role) && !isExercise(f)))
    .sort((a, b) => a.sortWeight - b.sortWeight),

  /** Saves a new order: ids listed first, in that order, keeping everyone else's relative order after. */
  reorder(ids) {
    S.batch(() => ids.forEach((id, i) => S.update('factors', id, { sortWeight: i - ids.length })));
  },

  /** Deletes a factor and everything logged for it. */
  remove(id) {
    S.batch(() => {
      S.removeWhere('factorLogs', l => l.factorId === id);
      S.removeWhere('factorChanges', c => c.factorId === id);
      for (const r of S.table('routines')) if (r.linkedFactorId === id) S.update('routines', r.id, { linkedFactorId: null });
      S.removeWhere('factors', f => f.id === id);
    });
  },

  create(fields) {
    return S.insert('factors', {
      status: 'suspected', isArchived: false, sortWeight: Math.max(0, ...S.table('factors').map(f => f.sortWeight ?? 0)) + 1, source: 'user',
      category: fields.role === 'helper' ? 'recovery' : 'activity', unit: defaultUnit(fields.measureType),
      ...fields,
      icon: fields.icon || emojiFor(fields.name, { role: fields.role, exercise: fields.category === 'exercise' }),
    });
  },

  /** Updates a factor, logging role/status changes so past analysis can be reproduced. */
  save(id, patch) {
    const f = factors.get(id);
    return S.batch(() => {
      for (const field of ['role', 'status']) {
        if (patch[field] !== undefined && patch[field] !== f[field]) {
          S.insert('factorChanges', { factorId: id, field, from: f[field], to: patch[field], changedAt: S.nowISO() });
        }
      }
      return S.update('factors', id, patch);
    });
  },

  setArchived: (id, isArchived) => S.update('factors', id, { isArchived }),
  logs: id => S.table('factorLogs').filter(l => l.factorId === id).sort(byNewest),
  changes: id => S.table('factorChanges').filter(c => c.factorId === id).sort(byNewest),
  lastValue: id => factors.logs(id)[0]?.value ?? null,
};

export const checkins = {
  entryFor: date => S.table('dailyEntries').find(e => e.date === date),
  all: () => [...S.table('dailyEntries')].sort((a, b) => a.date.localeCompare(b.date)),
  markersFor: entryId => S.table('painMarkers').filter(m => m.dailyEntryId === entryId),

  /** Total amount logged per factor on a date (check-in plus anything logged during the day, e.g. routines). */
  factorValues(date) {
    const m = new Map();
    for (const l of S.table('factorLogs')) if (l.date === date) m.set(l.factorId, (m.get(l.factorId) || 0) + Number(l.value));
    return m;
  },

  /** Intensity (1 easy, 2 moderate, 3 hard) logged per factor on a date, where one was given. */
  intensities(date) {
    const m = new Map();
    for (const l of S.table('factorLogs')) if (l.date === date && l.intensity) m.set(l.factorId, l.intensity);
    return m;
  },

  /** How well you slept the night before a date, 0–10, from the check-in. */
  sleepFor: date => checkins.entryFor(date)?.sleepQuality ?? null,

  /** Consecutive days with a check-in, ending today (or yesterday if today isn't done yet). */
  streak(today = localDate()) {
    const done = new Set(S.table('dailyEntries').map(e => e.date));
    let d = done.has(today) ? today : addDays(today, -1);
    let n = 0;
    while (done.has(d)) { n++; d = addDays(d, -1); }
    return n;
  },

  /** Deletes a day's check-in with its body map spots and what was logged in it. Routine sessions stay. */
  remove(date) {
    const e = checkins.entryFor(date);
    if (!e) return;
    S.batch(() => {
      S.removeWhere('painMarkers', m => m.dailyEntryId === e.id);
      S.removeWhere('factorLogs', l => l.dailyEntryId === e.id);
      S.removeWhere('dailyEntries', x => x.id === e.id);
    });
  },

  save(date, draft) {
    return S.batch(() => {
      const existing = checkins.entryFor(date);
      const fields = {
        date, painScore: draft.pain, stressScore: draft.stress, sleepQuality: draft.sleep ?? null,
        notes: draft.notes.trim(), completedAt: S.nowISO(), durationSeconds: draft.durationSeconds ?? null,
      };
      const entry = existing ? S.update('dailyEntries', existing.id, fields) : S.insert('dailyEntries', fields);

      S.removeWhere('painMarkers', m => m.dailyEntryId === entry.id);
      for (const m of draft.markers) {
        S.insert('painMarkers', { dailyEntryId: entry.id, flareId: null, regionId: m.regionId, side: m.side, intensity: m.intensity, quality: m.quality, modelPoint: m.modelPoint ?? null });
      }

      // One log per factor per day. Replaces earlier manual logs for the date, including routine
      // completions, whose total the draft was pre-filled with.
      S.removeWhere('factorLogs', l => l.date === date && l.source === 'manual');
      for (const [factorId, value] of draft.selections) {
        const f = factors.get(factorId);
        if (!f || (value <= 0 && f.measureType !== 'rating')) continue;
        S.insert('factorLogs', {
          factorId, date, timestamp: null, value: f.measureType === 'yesno' ? 1 : value, source: 'manual', dailyEntryId: entry.id,
          intensity: draft.intensity?.get(factorId) ?? null,
        });
      }
      return entry;
    });
  },
};

export const flares = {
  all: () => [...S.table('flares')].sort(byNewest),
  onDate: date => S.table('flares').filter(f => localDate(new Date(f.timestamp)) === date),
  create({ markers, ...fields }) {
    return S.batch(() => {
      const flare = S.insert('flares', fields);
      for (const m of markers) {
        S.insert('painMarkers', { dailyEntryId: null, flareId: flare.id, regionId: m.regionId, side: m.side, intensity: m.intensity, quality: m.quality, modelPoint: m.modelPoint ?? null });
      }
      return flare;
    });
  },
};

/** "Added Bird dog", "Removed Cat-cow and Open book", "New order"… for a routine's moves before and after. */
export function describeRoutineChange(before, after) {
  const names = items => items.map(it => it.name);
  const b = names(before), a = names(after);
  const list = xs => (xs.length <= 2 ? xs.join(' and ') : `${xs.length} moves`);
  const added = a.filter(n => !b.includes(n)), removed = b.filter(n => !a.includes(n));
  const parts = [];
  if (added.length) parts.push(`Added ${list(added)}`);
  if (removed.length) parts.push(`${parts.length ? 'removed' : 'Removed'} ${list(removed)}`);
  if (parts.length) return parts.join(', ');
  const doses = after.filter(it => before.find(x => x.name === it.name)?.dose !== it.dose).map(it => it.name);
  if (doses.length) return `Changed ${doses.length <= 2 ? `the dose of ${doses.join(' and ')}` : `${doses.length} doses`}`;
  return b.join() !== a.join() ? 'New order' : null;
}

export const routines = {
  all: () => S.table('routines').filter(r => !r.isArchived),
  get: id => S.table('routines').find(r => r.id === id),

  /** The routine's own exercise item (what the check-in ticks and the patterns count). */
  factorFor: r => factors.get(r.linkedFactorId),

  /** Saves a routine, logging what changed in its moves so the chart can mark the day. */
  save(id, fields) {
    return S.batch(() => {
      // A copy: the update below changes the stored row in place
      const before = id ? structuredClone(routines.get(id).items) : null;
      const row = id ? S.update('routines', id, fields) : S.insert('routines', { isArchived: false, schedule: [], ...fields });
      const f = factors.get(row.linkedFactorId);
      if (!f?.routineId) S.update('routines', row.id, { linkedFactorId: routineFactor(row).id });
      else if (f.name !== routineLabel(row)) S.update('factors', f.id, { name: routineLabel(row) });
      const what = before ? describeRoutineChange(before, row.items) : `Started ${routineLabel(row)}`;
      if (what) routines.logChange(row.id, what);
      return row;
    });
  },
  /** The variations of a group, in order (a routine on its own is a group of one). */
  group: r => (r.group ? routines.all().filter(x => x.group === r.group).sort((a, b) => (a.groupOrder ?? 0) - (b.groupOrder ?? 0)) : [r]),

  /**
   * Adds a variation after the last one: "Push" and "Pull", "Day 1" and "Day 2", a short version...
   * They start as A, B, C, like Workout A and B, ready to rename. A routine on its own becomes the
   * group, with itself as A.
   */
  addVariation(id) {
    return S.batch(() => {
      let r = routines.get(id);
      if (!r.group) r = routines.save(id, { group: r.name, name: 'A', groupOrder: 0 });
      const n = routines.group(r).length;
      return routines.save(null, { group: r.group, name: n < 26 ? String.fromCharCode(65 + n) : `Variation ${n + 1}`, groupOrder: n, items: [], schedule: [] });
    });
  },

  /** Renames a group across all its variations. */
  renameGroup(from, to) {
    S.batch(() => { for (const r of routines.all().filter(x => x.group === from)) routines.save(r.id, { group: to }); });
  },

  archive(id) {
    S.batch(() => {
      const r = S.update('routines', id, { isArchived: true });
      if (factors.get(r.linkedFactorId)?.routineId) S.update('factors', r.linkedFactorId, { isArchived: true });
      routines.logChange(id, `Stopped ${r.name}`);
    });
  },

  lastDoneDate: id => S.table('routineCompletions').filter(c => c.routineId === id && c.completed)
    .map(c => c.date ?? localDate(new Date(c.timestamp))).sort().at(-1) ?? null,

  /** That day's logged session, if any: { log: [{ name, did }], intensity }. */
  sessionOn: (id, date) => S.table('routineCompletions').find(c => c.routineId === id && c.completed && (c.date ?? localDate(new Date(c.timestamp))) === date),
  /** The extra box (weight, a note…) for each move last time (before `date`), by move name. */
  lastExtra(id, date = localDate()) {
    const past = S.table('routineCompletions')
      .filter(c => c.routineId === id && c.log?.some(x => x.extra) && (c.date ?? localDate(new Date(c.timestamp))) < date)
      .sort((a, b) => (b.date ?? b.timestamp).localeCompare(a.date ?? a.timestamp))[0];
    return new Map((past?.log ?? []).filter(x => x.extra).map(x => [x.name, x.extra]));
  },
  /** What you did for each move last time (before `date`), by move name. */
  lastDid(id, date = localDate()) {
    const past = S.table('routineCompletions')
      .filter(c => c.routineId === id && c.log?.length && (c.date ?? localDate(new Date(c.timestamp))) < date)
      .sort((a, b) => (b.date ?? b.timestamp).localeCompare(a.date ?? a.timestamp))[0];
    return new Map((past?.log ?? []).filter(x => x.did).map(x => [x.name, x.did]));
  },

  /**
   * Saves a day's session: what you did per move. writeLog also ticks the routine for that day (left
   * off when a check-in in progress will save it instead).
   */
  logSession(id, date, { log, intensity = null, times = null }, { writeLog = true } = {}) {
    const r = routines.get(id);
    return S.batch(() => {
      const timestamp = date === localDate() ? S.nowISO() : new Date(`${date}T12:00:00`).toISOString();
      const existing = routines.sessionOn(id, date);
      if (existing) S.update('routineCompletions', existing.id, { log, intensity: intensity ?? existing.intensity ?? null, times: times ?? existing.times ?? null });
      else S.insert('routineCompletions', { routineId: id, date, timestamp, completed: true, log, intensity, times });
      if (writeLog && r?.linkedFactorId) {
        const prev = S.table('factorLogs').find(l => l.factorId === r.linkedFactorId && l.date === date);
        S.removeWhere('factorLogs', l => l.factorId === r.linkedFactorId && l.date === date);
        S.insert('factorLogs', { factorId: r.linkedFactorId, date, timestamp: null, value: 1, source: 'manual', dailyEntryId: prev?.dailyEntryId ?? null, intensity: intensity ?? prev?.intensity ?? null });
      }
    });
  },

  /** One change per routine per day: later edits that day replace the description. */
  logChange(routineId, summary, date = localDate()) {
    const same = S.table('routineChanges').find(c => c.routineId === routineId && c.date === date);
    if (same) S.update('routineChanges', same.id, { summary: same.summary.startsWith('Started') ? same.summary : summary });
    else S.insert('routineChanges', { routineId, date, summary });
  },
  /** Changes by date: Map date → [{ routine name, summary }]. */
  changesByDate() {
    const m = new Map();
    for (const c of S.table('routineChanges')) {
      if (!m.has(c.date)) m.set(c.date, []);
      const r = routines.get(c.routineId), name = r ? routineLabel(r) : 'Routine';
      // "Started …" and "Stopped …" already name the routine
      m.get(c.date).push({ routineId: c.routineId, name, summary: c.summary, text: /^(Started|Stopped) /.test(c.summary) ? c.summary : `${name}: ${c.summary}` });
    }
    return m;
  },
  completionsOn: (date, routineId) => S.table('routineCompletions')
    .filter(c => c.completed && c.routineId === routineId && (c.date ?? localDate(new Date(c.timestamp))) === date),

  /** Unmarks a routine for a day: its sessions that day and the tick on its own exercise item. */
  undo(routineId, date) {
    const r = routines.get(routineId);
    S.batch(() => {
      S.removeWhere('routineCompletions', c => c.routineId === routineId && (c.date ?? localDate(new Date(c.timestamp))) === date);
      if (r?.linkedFactorId) S.removeWhere('factorLogs', l => l.factorId === r.linkedFactorId && l.date === date);
    });
  },

  /** Logs a completion; a completed routine also counts towards its linked helper factor. */
  complete(routineId, completed = true) {
    const r = routines.get(routineId);
    return S.batch(() => {
      S.insert('routineCompletions', { routineId, date: localDate(), timestamp: S.nowISO(), completed });
      if (completed && r?.linkedFactorId) {
        // Timed helpers get an estimate of ~1.5 min per move (rounded to 5); counted helpers get 1
        const f = factors.get(r.linkedFactorId);
        const value = f?.measureType === 'minutes' ? Math.max(5, Math.round((r.items.length * 1.5) / 5) * 5) : 1;
        S.insert('factorLogs', { factorId: r.linkedFactorId, date: localDate(), timestamp: S.nowISO(), value, source: 'manual', dailyEntryId: null });
      }
    });
  },
};

export const reminders = {
  /** The one scheduled-but-not-fired reminder (the dead man's switch). */
  pending: () => S.table('reminderEvents').find(e => !e.firedAt && !e.outcome),
  /** Fired reminders nobody has responded to yet, newest first. */
  awaiting: () => S.table('reminderEvents').filter(e => e.firedAt && !e.outcome).sort((a, b) => b.firedAt.localeCompare(a.firedAt)),
  create: fields => S.insert('reminderEvents', fields),
  update: (id, patch) => S.update('reminderEvents', id, patch),
};

/** Daily totals brought in from Apple Health (steps, and sleep for the night ending that morning). */
export const health = {
  day: date => S.table('healthDays').find(d => d.date === date),
  all: () => [...S.table('healthDays')].sort((a, b) => a.date.localeCompare(b.date)),
  has: key => S.table('healthDays').some(d => d[key] != null),
  /**
   * How a day compares with your usual: percent above (+) or below (−) the average of the seven days
   * before it that have the number. Null with fewer than three days to compare against.
   */
  vsUsual(date, key) {
    const v = health.day(date)?.[key];
    const before = health.all().filter(d => d.date < date && d[key] != null).slice(-7);
    if (v == null || before.length < 3) return null;
    const avg = before.reduce((a, d) => a + d[key], 0) / before.length;
    return avg ? Math.round(((v - avg) / avg) * 100) : null;
  },
  /** "In bed" when the sleep we have is mostly time in bed (an iPhone without a Watch), else "Asleep". */
  sleepWord: () => {
    const nights = S.table('healthDays').filter(d => d.sleepHours != null);
    return nights.filter(d => d.inBed).length > nights.length / 2 ? 'In bed' : 'Asleep';
  },

  /** Merges rows of { date, steps?, sleepHours? } into what's stored. Returns how many days changed. */
  merge(rows, source) {
    let n = 0;
    S.batch(() => {
      for (const { date, ...vals } of rows) {
        const clean = Object.fromEntries(Object.entries(vals).filter(([, v]) => v != null && Number.isFinite(v)));
        if (!Object.keys(clean).length) continue;
        const row = health.day(date);
        if (row) S.update('healthDays', row.id, { ...clean, source }); else S.insert('healthDays', { date, ...clean, source });
        n++;
      }
    });
    return n;
  },
};

export const aiSummaries = {
  latest: () => [...S.table('aiSummaries')].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null,
  create: fields => S.insert('aiSummaries', fields),
};

/** Earliest day with any data, for export defaults. */
export function firstDataDate() {
  const dates = [
    ...S.table('dailyEntries').map(e => e.date),
    ...S.table('factorLogs').map(l => l.date),
    ...S.table('flares').map(f => localDate(new Date(f.timestamp))),
  ].sort();
  return dates[0] ?? localDate();
}
