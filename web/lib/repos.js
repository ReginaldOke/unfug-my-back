// Repositories: the domain API the views use. Views never touch store.js directly.
import * as S from './store.js';
import { localDate, addDays } from './dates.js';
import { SEED_FACTORS, SEED_ROUTINE } from './seed.js';
import { defaultUnit } from './labels.js';

export const settings = S.settings;
export const setSettings = S.setSettings;
export const subscribe = S.subscribe;
export const snapshot = S.snapshot;

export function init() {
  S.load();
  if (!S.settings().seeded) seed();
}

export function wipeEverything() {
  S.wipe();
  init();
}

function seed() {
  S.batch(() => {
    SEED_FACTORS.forEach(({ defaultOn, ...f }, i) =>
      S.insert('factors', { ...f, status: 'suspected', isArchived: !defaultOn, sortWeight: i, source: 'seed' }));
    // The starter routine counts towards a helper that's on by default
    const stretching = S.table('factors').find(f => f.name === 'Stretching');
    S.insert('routines', { ...SEED_ROUTINE, linkedFactorId: stretching?.id ?? null, isArchived: false });
    S.settings().seeded = true;
  });
}

const byNewest = (a, b) => (b.date || b.timestamp || b.createdAt).localeCompare(a.date || a.timestamp || a.createdAt);

export const factors = {
  all: ({ archived = false } = {}) => S.table('factors').filter(f => archived || !f.isArchived),
  get: id => S.table('factors').find(f => f.id === id),

  /** Active factors for the given roles, most-logged in the 14 days before `date` first. */
  forCheckin(roles, date) {
    const since = addDays(date, -14);
    const counts = {};
    for (const l of S.table('factorLogs')) if (l.date > since && l.date <= date) counts[l.factorId] = (counts[l.factorId] || 0) + 1;
    return factors.all().filter(f => roles.includes(f.role))
      .sort((a, b) => (counts[b.id] || 0) - (counts[a.id] || 0) || a.sortWeight - b.sortWeight);
  },

  create(fields) {
    return S.insert('factors', {
      status: 'suspected', isArchived: false, sortWeight: S.table('factors').length, source: 'user',
      category: fields.role === 'helper' ? 'recovery' : 'activity', icon: '', unit: defaultUnit(fields.measureType),
      ...fields,
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

  /** Consecutive days with a check-in, ending today (or yesterday if today isn't done yet). */
  streak(today = localDate()) {
    const done = new Set(S.table('dailyEntries').map(e => e.date));
    let d = done.has(today) ? today : addDays(today, -1);
    let n = 0;
    while (done.has(d)) { n++; d = addDays(d, -1); }
    return n;
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
        S.insert('factorLogs', { factorId, date, timestamp: null, value: f.measureType === 'yesno' ? 1 : value, source: 'manual', dailyEntryId: entry.id });
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

export const routines = {
  all: () => S.table('routines').filter(r => !r.isArchived),
  get: id => S.table('routines').find(r => r.id === id),
  save(id, fields) { return id ? S.update('routines', id, fields) : S.insert('routines', { isArchived: false, ...fields }); },
  archive: id => S.update('routines', id, { isArchived: true }),
  completionsOn: (date, routineId) => S.table('routineCompletions')
    .filter(c => c.completed && c.routineId === routineId && localDate(new Date(c.timestamp)) === date),

  /** Logs a completion; a completed routine also counts towards its linked helper factor. */
  complete(routineId, completed = true) {
    const r = routines.get(routineId);
    return S.batch(() => {
      S.insert('routineCompletions', { routineId, timestamp: S.nowISO(), completed });
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
