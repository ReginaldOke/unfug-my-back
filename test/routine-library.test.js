import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ROUTINE_LIBRARY, DEFAULT_ROUTINES, libraryRoutine } from '../web/lib/routine-library.js';
import { findByName } from '../web/lib/move-names.js';
import { ALL_MOVES } from '../web/views/figure.js';
import { CALM } from '../web/lib/calm.js';
import { parseReminder } from '../web/lib/labels.js';

test('thirteen routines, each complete, with unique ids and emoji', () => {
  assert.equal(ROUTINE_LIBRARY.length, 13);
  assert.equal(new Set(ROUTINE_LIBRARY.map(r => r.id)).size, 13);
  assert.equal(new Set(ROUTINE_LIBRARY.map(r => r.icon)).size, 13);
  for (const r of ROUTINE_LIBRARY) {
    for (const k of ['name', 'kind', 'icon', 'tagline', 'goodFor', 'research', 'often']) assert.ok(r[k], `${r.id} ${k}`);
    assert.ok(r.items.length >= 3, r.id);
    for (const it of r.items) assert.ok(it.name && it.dose, `${r.id} ${it.name}`);
  }
});

test('doses read one way: sets × reps, reps, or a time, then each side; holds in their own box', () => {
  const DOSE = /^(\d+ × )?\d+( reps| s| min| m| breaths)?( each side)?$/;
  for (const r of ROUTINE_LIBRARY) {
    for (const it of r.items) {
      assert.match(it.dose, DOSE, `${r.id}: ${it.name} "${it.dose}"`);
      if (it.extra) assert.match(it.extra, /^\d+ s hold$/, `${r.id}: ${it.name}`);
    }
  }
});

test('every library routine comes with reminders, as often as its research did it', () => {
  for (const r of ROUTINE_LIBRARY) {
    assert.ok(r.schedule.length, r.id);
    for (const e of r.schedule) assert.match(parseReminder(e).time, /^\d\d:\d\d$/, r.id);
  }
});

test('every move in every routine has an animation (a calm guide for breathing and meditation)', () => {
  for (const r of ROUTINE_LIBRARY) {
    for (const it of r.items) {
      const hit = findByName([...ALL_MOVES, ...CALM], it.name);
      assert.ok(hit, `${r.name}: ${it.name}`);
      assert.equal(!!hit.kind, r.kind === 'Mind', `${r.name}: ${it.name}`);
    }
  }
});

test('the defaults are one strength routine and one stretching routine', () => {
  assert.deepEqual(DEFAULT_ROUTINES.map(id => libraryRoutine(id).kind).sort(), ['Strength', 'Stretch']);
});

test('every library routine links to at least one study, with its size', () => {
  for (const r of ROUTINE_LIBRARY) {
    assert.ok(r.studies?.length, r.id);
    for (const st of r.studies) {
      assert.match(st.url, /^https:\/\/pubmed\.ncbi\.nlm\.nih\.gov\/\d+\/$/, `${r.id} ${st.name}`);
      assert.ok(st.name && st.size, `${r.id} ${st.name}`);
    }
  }
});
