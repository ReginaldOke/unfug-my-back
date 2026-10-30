// Import: merges an exported diary (Settings › Export, from this app or the website) into this one.
// Pure, unit-tested in test/import.test.js; repos.importDiary applies the plan.
//
// Nothing already here is changed or removed. Each diary was seeded separately, so stressors, helpers
// and routines are matched by name rather than id. A day already checked in here keeps this diary's
// version: the imported check-in for that day, with its body map spots and logs, is left out.

const norm = s => (s ?? '').trim().toLowerCase();
const routineKey = r => `${norm(r.group)}|${norm(r.name)}`;
const dayOf = c => c.date ?? new Date(c.timestamp).toISOString().slice(0, 10);

/** True if the parsed JSON looks like one of our exports. */
export const isDiaryExport = x => !!x && typeof x === 'object' && Array.isArray(x.dailyEntries) && Array.isArray(x.factors);

/**
 * What importing `incoming` into `current` would add: { add: { table: rows }, summary }.
 * Rows keep their ids, with references remapped to the matching rows already here.
 */
export function planImport(current, incoming) {
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
  const haveDays = new Set(current.dailyEntries.map(e => e.date));
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
  const haveLog = new Set(current.factorLogs.map(l => `${l.factorId}|${l.date}`));
  for (const { factorName, ...l } of t('factorLogs')) {
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
    add,
    summary: {
      checkins: n('dailyEntries'), skippedDays: skippedDays.size, factors: n('factors'), routines: n('routines'),
      sessions: n('routineCompletions'), healthDays: n('healthDays'),
    },
  };
}
