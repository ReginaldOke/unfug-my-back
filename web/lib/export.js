// Export for analysis in an AI chat. Pure, unit-tested in test/export.test.js.
import { localDate } from './dates.js';
import { cleanSettings } from './import.js';
import { flareEpisodes, FLARE_PAIN } from './analysis.js';
import { meaningfulChanges } from './routine-changes.js';
import { stillMinutes } from './reminders-core.js';
import { measureOf } from './labels.js';

export const ANALYSIS_PROMPT = `You are analysing a personal back pain diary exported as JSON.
Pain, stress, sleepQuality and dietScore are 0 to 10 (sleepQuality is the night before; 10 is slept well; dietScore 10 is ate well, with meals as optional text). custom holds the user's own 0 to 10 sliders, named in customSliders. painMarkers are where it hurt, with intensity 0 to 10.
healthDays has daily data from Apple Health where it was recorded: steps, sleepHours (time asleep for the night ending that morning; inBed: 1 means only time in bed was recorded), workouts (type, minutes, km), standHours (hours with a stand, from Apple Watch, a sign of sitting breaks), exerciseMinutes, walkingKm, restingHeartRate and hrvMs (heart rate variability).
flares lists every flare: days in a row with pain ${FLARE_PAIN} or more, as start, end, days and peakPain.
factorLogs may carry intensity from 1 (easy) through 2 (moderate) to 3 (all out), sometimes in between (e.g. 2.4). Routines have a measure: "effort" ones log intensity, "count" ones log how many times that day (times) and no intensity. routineChanges marks days a routine started, stopped, or had moves added or removed: compare pain before and after. Factors have a role (trigger, helper, unsure); the app calls triggers "stressors". reminderEvents are movement nudges, with stationaryMinutesBefore counted from the start of the day.
1. Summarise pain trends and flare frequency over the period.
2. For each factor, compare pain on days with vs without it at same day, next day and two days later.
3. Check dose response for minute and count factors.
4. Identify factors most often present in the 24 hours before flares.
5. Note where pain was located (body map regions) and any changes.
6. Flag combinations (e.g. long sitting plus training on the same day).
7. State confidence and sample sizes. Treat findings as associations, not causes.
8. Suggest up to 3 experiments to test the strongest suspected triggers or helpers.
9. Suggest specific changes to the movement routine, based on what goes with lower pain.
Do not give a diagnosis.`;

const dayOf = iso => localDate(new Date(iso));

export function buildExport(data, { from, to, regions = [] }) {
  const inRange = d => (!from || d >= from) && (!to || d <= to);
  const dailyEntries = data.dailyEntries.filter(e => inRange(e.date));
  const flares = data.flares.filter(f => inRange(dayOf(f.timestamp)));
  const entryIds = new Set(dailyEntries.map(e => e.id));
  const flareIds = new Set(flares.map(f => f.id));
  const factorName = Object.fromEntries(data.factors.map(f => [f.id, f.name]));
  // A routine counted in times today: the count lives on its session, so it goes on the day's log too
  const countedBy = new Map(data.routines.filter(r => measureOf(r) === 'count' && r.linkedFactorId).map(r => [r.linkedFactorId, r.id]));
  const timesOn = (routineId, date) => data.routineCompletions.filter(c => c.routineId === routineId && (c.date ?? dayOf(c.timestamp)) === date).reduce((n, c) => n + (c.times ?? 1), 0);
  const doneDays = [
    ...data.routineCompletions.filter(c => c.completed).map(c => ({ routineId: c.routineId, date: c.date ?? dayOf(c.timestamp) })),
    ...data.factorLogs.filter(l => l.value > 0 && data.routines.some(r => r.linkedFactorId === l.factorId)).map(l => ({ routineId: data.routines.find(r => r.linkedFactorId === l.factorId).id, date: l.date })),
  ];
  const activeHours = data.settings?.reminder?.activeHours;
  return {
    app: 'Back Story',
    exportedAt: new Date().toISOString(),
    schemaVersion: data.schemaVersion,
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    range: { from, to },
    analysisPrompt: ANALYSIS_PROMPT,
    bodyRegions: regions,
    factors: data.factors,
    factorChanges: data.factorChanges,
    dailyEntries,
    factorLogs: data.factorLogs.filter(l => inRange(l.date)).map(l => ({
      ...l, factorName: factorName[l.factorId] ?? null, ...(countedBy.has(l.factorId) ? { times: timesOn(countedBy.get(l.factorId), l.date) || 1 } : {}),
    })),
    // Every spot used to be saved as an "ache" whatever it felt like, so that says nothing
    painMarkers: data.painMarkers.filter(m => entryIds.has(m.dailyEntryId) || flareIds.has(m.flareId))
      .map(({ quality, ...m }) => (quality && quality !== 'ache' ? { ...m, quality } : m)),
    // Flares as days in a row at pain FLARE_PAIN or more. Ones logged on their own (older versions) stay under loggedFlares.
    flares: flareEpisodes(dailyEntries, flares),
    loggedFlares: flares,
    routines: data.routines.map(r => ({ ...r, measure: measureOf(r) })),
    routineCompletions: data.routineCompletions.filter(c => inRange(dayOf(c.timestamp))),
    // Older versions counted the night as time sitting still
    reminderEvents: data.reminderEvents.filter(e => e.firedAt && inRange(dayOf(e.firedAt))).map(e => {
      const cap = stillMinutes(null, new Date(e.firedAt), activeHours);
      return e.stationaryMinutesBefore != null && cap != null && e.stationaryMinutesBefore > cap ? { ...e, stationaryMinutesBefore: cap } : e;
    }),
    healthDays: (data.healthDays ?? []).filter(d => inRange(d.date)).map(({ inBed, ...d }) => (inBed && d.sleepHours != null ? { ...d, inBed: 1 } : d)),
    routineChanges: meaningfulChanges(data.routineChanges ?? [], doneDays).filter(c => inRange(c.date)),
    customSliders: (data.settings?.customSliders ?? []).map(({ id, name, good }) => ({ id, name, higherIsBetter: good !== 'low' })),
    // Your setup (check-in steps, chart lines, reminders, theme), so a restore brings it back exactly
    settings: cleanSettings(data.settings),
  };
}

export const CSV_TABLES = ['dailyEntries', 'factorLogs', 'healthDays', 'painMarkers', 'flares', 'factors', 'factorChanges', 'routineCompletions', 'reminderEvents', 'routines', 'bodyRegions'];

export function toCSV(rows) {
  if (!rows.length) return '';
  const cols = [...new Set(rows.flatMap(r => Object.keys(r)))];
  const cell = v => {
    if (v == null) return '';
    const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [cols.join(','), ...rows.map(r => cols.map(c => cell(r[c])).join(','))].join('\n');
}
