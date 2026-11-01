import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildExport, toCSV, ANALYSIS_PROMPT } from '../web/lib/export.js';

const data = {
  schemaVersion: 1,
  factors: [{ id: 'f1', name: 'Desk sitting' }],
  factorChanges: [],
  dailyEntries: [{ id: 'e1', date: '2026-10-01', painScore: 3 }, { id: 'e2', date: '2026-10-20', painScore: 5 }],
  factorLogs: [{ factorId: 'f1', date: '2026-10-01', value: 120 }, { factorId: 'f1', date: '2026-10-20', value: 60 }],
  painMarkers: [{ dailyEntryId: 'e1', regionId: 'lower_back_centre' }, { dailyEntryId: 'e2', regionId: 'neck' }],
  flares: [],
  routines: [],
  routineCompletions: [],
  reminderEvents: [],
};

test('export filters by date range and keeps related markers', () => {
  const out = buildExport(data, { from: '2026-10-10', to: '2026-10-31' });
  assert.equal(out.analysisPrompt, ANALYSIS_PROMPT);
  assert.deepEqual(out.dailyEntries.map(e => e.id), ['e2']);
  assert.deepEqual(out.painMarkers.map(m => m.regionId), ['neck']);
  assert.equal(out.factorLogs.length, 1);
  assert.equal(out.factorLogs[0].factorName, 'Desk sitting');
  assert.doesNotThrow(() => JSON.parse(JSON.stringify(out)));
});

test('CSV escapes quotes, commas and newlines, and serialises objects', () => {
  const csv = toCSV([{ a: 'x, y', b: 'say "hi"' }, { a: 'line\nbreak', c: { k: 1 } }]);
  assert.equal(csv, 'a,b,c\n"x, y","say ""hi""",\n"line\nbreak",,"{""k"":1}"');
  assert.equal(toCSV([]), '');
});
