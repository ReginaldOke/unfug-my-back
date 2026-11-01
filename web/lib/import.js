// Import: merges an exported diary (Settings › Export, from this app or the website) into this one.
// Pure, unit-tested in test/import.test.js; repos.importDiary applies the plan.
//
// Nothing already here is changed or removed. Each diary was seeded separately, so stressors, helpers
// and routines are matched by name rather than id. A day already checked in here keeps this diary's
// version: the imported check-in for that day, with its body map spots and logs, is left out.

import { regionById } from './regions.js';

const norm = s => (s ?? '').trim().toLowerCase();

// ---------- Checking what comes in ----------
// A file from anywhere could be malformed, or doctored to break the app. Every row is rebuilt from the
// fields the app knows, each checked and bounded; anything that can't be made sound is left out.

const MAX_ROWS = 20000;
const str = (v, max = 200) => (typeof v === 'string' ? v.slice(0, max) : v == null ? null : String(v).slice(0, max));
const text = (v, max) => str(v, max) ?? '';
const num = (v, lo, hi) => { const n = typeof v === 'number' ? v : Number(v); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : null; };
const bool = v => v === true || v === 1 || v === 'true';
const id = v => (typeof v === 'string' && /^[\w.:-]{1,64}$/.test(v) ? v : null);
const day = v => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
const when = v => (typeof v === 'string' && !Number.isNaN(Date.parse(v)) ? new Date(v).toISOString() : null);
const oneOf = (v, options, fallback) => (options.includes(v) ? v : fallback);
const list = (v, max) => (Array.isArray(v) ? v.slice(0, max) : []);
const REMINDER = /^\d{2}:\d{2}(@[0-6](,[0-6])*)?$/;

const CLEAN = {
  factors: f => id(f.id) && text(f.name, 80).trim() && {
    id: f.id, name: text(f.name, 80).trim(), role: oneOf(f.role, ['trigger', 'helper', 'unsure'], 'unsure'),
    measureType: oneOf(f.measureType, ['minutes', 'count', 'yesno', 'rating'], 'count'), unit: text(f.unit, 12),
    category: oneOf(f.category, ['activity', 'exercise', 'posture', 'lifestyle', 'recovery'], 'activity'), icon: text(f.icon, 16),
    status: oneOf(f.status, ['suspected', 'testing', 'likely', 'ruled_out'], 'suspected'), isArchived: bool(f.isArchived),
    sortWeight: num(f.sortWeight, -1e6, 1e6) ?? 0, source: text(f.source, 20) || 'import', routineId: id(f.routineId),
  },
  routines: r => id(r.id) && text(r.name, 80).trim() && {
    id: r.id, name: text(r.name, 80).trim(), group: str(r.group, 80), groupOrder: num(r.groupOrder, 0, 1000) ?? 0,
    measure: oneOf(r.measure, ['effort', 'count'], 'effort'), isArchived: bool(r.isArchived), linkedFactorId: id(r.linkedFactorId),
    schedule: list(r.schedule, 12).filter(x => typeof x === 'string' && REMINDER.test(x)),
    items: list(r.items, 100).filter(it => it && text(it.name, 80).trim()).map(it => ({ name: text(it.name, 80).trim(), dose: text(it.dose, 40), ...(it.extra ? { extra: text(it.extra, 40) } : {}) })),
  },
  dailyEntries: e => id(e.id) && day(e.date) && num(e.painScore, 0, 10) != null && {
    id: e.id, date: e.date, painScore: Math.round(num(e.painScore, 0, 10)), stressScore: num(e.stressScore, 0, 10), sleepQuality: num(e.sleepQuality, 0, 10),
    notes: text(e.notes, 2000), completedAt: when(e.completedAt), durationSeconds: num(e.durationSeconds, 0, 86400),
  },
  painMarkers: m => id(m.id) && regionById[m.regionId] && {
    id: m.id, dailyEntryId: id(m.dailyEntryId), flareId: id(m.flareId), regionId: m.regionId, side: regionById[m.regionId].side,
    intensity: num(m.intensity, 0, 10), quality: text(m.quality, 20),
    modelPoint: m.modelPoint && ['x', 'y', 'z'].every(k => num(m.modelPoint[k], -10, 10) != null) ? { x: +m.modelPoint.x, y: +m.modelPoint.y, z: +m.modelPoint.z } : null,
  },
  factorLogs: l => id(l.id) && id(l.factorId) && day(l.date) && num(l.value, 0, 100000) != null && {
    id: l.id, factorId: l.factorId, date: l.date, timestamp: when(l.timestamp), value: num(l.value, 0, 100000),
    source: text(l.source, 20) || 'manual', dailyEntryId: id(l.dailyEntryId), intensity: num(l.intensity, 1, 3),
  },
  factorChanges: c => id(c.id) && id(c.factorId) && { id: c.id, factorId: c.factorId, field: text(c.field, 20), from: str(c.from, 40), to: str(c.to, 40), changedAt: when(c.changedAt) },
  flares: f => id(f.id) && when(f.timestamp) && { id: f.id, timestamp: when(f.timestamp), intensity: num(f.intensity, 0, 10), notes: text(f.notes, 2000) },
  routineCompletions: c => id(c.id) && id(c.routineId) && (day(c.date) || when(c.timestamp)) && {
    id: c.id, routineId: c.routineId, date: day(c.date), timestamp: when(c.timestamp) ?? new Date(`${c.date}T12:00:00`).toISOString(), completed: c.completed !== false,
    intensity: num(c.intensity, 1, 3), times: num(c.times, 1, 10),
    log: list(c.log, 100).filter(x => x && text(x.name, 80)).map(x => ({ name: text(x.name, 80), did: text(x.did, 40), ...(x.extra ? { extra: text(x.extra, 40) } : {}) })),
  },
  routineChanges: c => id(c.id) && id(c.routineId) && day(c.date) && { id: c.id, routineId: c.routineId, date: c.date, summary: text(c.summary, 200) },
  healthDays: d => day(d.date) && {
    id: id(d.id) ?? `h-${d.date}`, date: d.date, steps: num(d.steps, 0, 200000) ?? undefined, sleepHours: num(d.sleepHours, 0, 24) ?? undefined,
    inBed: d.inBed ? 1 : 0, source: text(d.source, 30) || 'import',
  },
};

/** The same diary with every row rebuilt from checked fields; rows that can't be are dropped. */
export function cleanDiary(raw) {
  const out = {};
  for (const [name, clean] of Object.entries(CLEAN)) {
    out[name] = list(raw?.[name], MAX_ROWS).map(row => (row && typeof row === 'object' ? clean(row) : null)).filter(Boolean)
      .map(row => Object.fromEntries(Object.entries(row).filter(([, v]) => v !== undefined)));
  }
  return out;
}
const routineKey = r => `${norm(r.group)}|${norm(r.name)}`;
const dayOf = c => c.date ?? new Date(c.timestamp).toISOString().slice(0, 10);

/** True if the parsed JSON looks like one of our exports. */
export const isDiaryExport = x => !!x && typeof x === 'object' && Array.isArray(x.dailyEntries) && Array.isArray(x.factors);

/**
 * What importing `incoming` into `current` would add: { add: { table: rows }, replace: [dates], summary }.
 * Rows keep their ids, with references remapped to the matching rows already here. A day checked in on
 * both keeps this diary's version, unless replaceDays: then the file's check-in for that day is used
 * instead (`replace` lists the days whose check-in here gets removed first).
 */
export function planImport(current, raw, { replaceDays = false } = {}) {
  const incoming = cleanDiary(raw);
  const t = name => incoming[name] ?? [];
  const add = {};
  const push = (name, row) => (add[name] ??= []).push(row);

  // Stressors, helpers and routine items: same name, same thing
  const factorByName = new Map(current.factors.map(f => [norm(f.name), f.id]));
  const factorId = new Map();
  for (const f of t('factors')) {
    const here = factorByName.get(norm(f.name));
    if (here) factorId.set(f.id, here);
    else { factorId.set(f.id, f.id); factorByName.set(norm(f.name), f.id); push('factors', f); }
  }
  const mapFactor = id => factorId.get(id) ?? id;

  const routineByKey = new Map(current.routines.map(r => [routineKey(r), r.id]));
  const routineId = new Map();
  for (const r of t('routines')) {
    const here = routineByKey.get(routineKey(r));
    if (here) routineId.set(r.id, here);
    else { routineId.set(r.id, r.id); routineByKey.set(routineKey(r), r.id); push('routines', { ...r, linkedFactorId: r.linkedFactorId ? mapFactor(r.linkedFactorId) : null }); }
  }
  const mapRoutine = id => routineId.get(id) ?? id;

  // Check-ins: one per day; a day already here stays as it is
  const clash = new Set(current.dailyEntries.map(e => e.date));
  const theirs = new Set((raw?.dailyEntries ?? []).map(e => e?.date));
  const replace = replaceDays ? [...clash].filter(d => theirs.has(d)) : [];
  // Days being replaced count as free: the file's check-in, spots and logs for them come in
  const haveDays = new Set([...clash].filter(d => !replace.includes(d)));
  const newEntries = t('dailyEntries').filter(e => !haveDays.has(e.date));
  newEntries.forEach(e => push('dailyEntries', e));
  const entryIds = new Set(newEntries.map(e => e.id));
  const skippedDays = new Set(t('dailyEntries').filter(e => haveDays.has(e.date)).map(e => e.date));

  const haveFlares = new Set(current.flares.map(f => f.timestamp));
  const newFlares = t('flares').filter(f => !haveFlares.has(f.timestamp));
  newFlares.forEach(f => push('flares', f));
  const flareIds = new Set(newFlares.map(f => f.id));

  for (const m of t('painMarkers')) if (entryIds.has(m.dailyEntryId) || flareIds.has(m.flareId)) push('painMarkers', m);

  // Logs: not on days kept from this diary, and never a second log of the same thing on the same day
  const haveLog = new Set(current.factorLogs.filter(l => !replace.includes(l.date) || !l.dailyEntryId).map(l => `${l.factorId}|${l.date}`));
  for (const l of t('factorLogs')) {
    const row = { ...l, factorId: mapFactor(l.factorId) };
    const key = `${row.factorId}|${row.date}`;
    if (skippedDays.has(row.date) || haveLog.has(key)) continue;
    haveLog.add(key);
    push('factorLogs', row);
  }

  const haveIds = name => new Set(current[name]?.map(x => x.id) ?? []);
  const changeIds = haveIds('factorChanges');
  for (const c of t('factorChanges')) if (!changeIds.has(c.id)) push('factorChanges', { ...c, factorId: mapFactor(c.factorId) });

  const haveDone = new Set(current.routineCompletions.map(c => `${c.routineId}|${dayOf(c)}`));
  for (const c of t('routineCompletions')) {
    const row = { ...c, routineId: mapRoutine(c.routineId) };
    const key = `${row.routineId}|${dayOf(row)}`;
    if (haveDone.has(key)) continue;
    haveDone.add(key);
    push('routineCompletions', row);
  }

  const haveChange = new Set((current.routineChanges ?? []).map(c => `${c.routineId}|${c.date}`));
  for (const c of t('routineChanges')) {
    const row = { ...c, routineId: mapRoutine(c.routineId) };
    if (!haveChange.has(`${row.routineId}|${row.date}`)) push('routineChanges', row);
  }

  const haveHealth = new Set((current.healthDays ?? []).map(d => d.date));
  for (const d of t('healthDays')) if (!haveHealth.has(d.date)) push('healthDays', d);

  const n = name => add[name]?.length ?? 0;
  return {
    add, replace,
    summary: {
      checkins: n('dailyEntries'), skippedDays: skippedDays.size, replacedDays: replace.length, factors: n('factors'), routines: n('routines'),
      sessions: n('routineCompletions'), healthDays: n('healthDays'),
    },
  };
}
