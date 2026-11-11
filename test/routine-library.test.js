import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ROUTINE_LIBRARY, DEFAULT_ROUTINES, libraryRoutine } from '../web/lib/routine-library.js';
import { findByName } from '../web/lib/move-names.js';
import { ALL_MOVES } from '../web/views/figure.js';

test('ten routines, each complete, with unique ids', () => {
  assert.equal(ROUTINE_LIBRARY.length, 10);
  assert.equal(new Set(ROUTINE_LIBRARY.map(r => r.id)).size, 10);
  for (const r of ROUTINE_LIBRARY) {
    for (const k of ['name', 'kind', 'tagline', 'goodFor', 'research', 'cover', 'often']) assert.ok(r[k], `${r.id} ${k}`);
    assert.ok(r.items.length >= 3, r.id);
    for (const it of r.items) assert.ok(it.name && it.dose, `${r.id} ${it.name}`);
  }
});

test('every move in every routine has an animation, and so does each cover', () => {
  for (const r of ROUTINE_LIBRARY) {
    for (const it of r.items) assert.ok(findByName(ALL_MOVES, it.name), `${r.name}: ${it.name}`);
    assert.ok(findByName(ALL_MOVES, r.cover), `${r.name} cover ${r.cover}`);
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
