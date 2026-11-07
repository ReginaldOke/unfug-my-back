// Export for analysis in an AI chat. Pure, unit-tested in test/export.test.js.
import { localDate } from './dates.js';

export const ANALYSIS_PROMPT = `You are analysing a personal back pain diary exported as JSON.
Pain, stress, sleepQuality and dietScore are 0 to 10 (sleepQuality is the night before; 10 is slept well; dietScore 10 is ate well, with meals as optional text). custom holds the user's own 0 to 10 sliders, named in customSliders. healthDays has daily steps and sleep from Apple Health.
factorLogs may carry intensity from 1 (easy) through 2 (moderate) to 3 (all out), sometimes in between (e.g. 2.4). routineChanges marks days the movement routine changed: compare pain before and after. Factors have a role (trigger, helper, unsure); the app calls triggers "stressors".
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
    factorLogs: data.factorLogs.filter(l => inRange(l.date)).map(l => ({ ...l, factorName: factorName[l.factorId] ?? null })),
    painMarkers: data.painMarkers.filter(m => entryIds.has(m.dailyEntryId) || flareIds.has(m.flareId)),
    flares,
    routines: data.routines,
    routineCompletions: data.routineCompletions.filter(c => inRange(dayOf(c.timestamp))),
    reminderEvents: data.reminderEvents.filter(e => e.firedAt && inRange(dayOf(e.firedAt))),
    healthDays: (data.healthDays ?? []).filter(d => inRange(d.date)),
    routineChanges: (data.routineChanges ?? []).filter(c => inRange(c.date)),
    customSliders: (data.settings?.customSliders ?? []).map(({ id, name, good }) => ({ id, name, higherIsBetter: good !== 'low' })),
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
