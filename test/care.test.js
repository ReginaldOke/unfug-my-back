import { test } from 'node:test';
import assert from 'node:assert/strict';
import { careNotice, warningsIn } from '../web/lib/care.js';

const day = (date, painScore, notes = '') => ({ date, painScore, notes });

test('warning signs are found in notes, and denials are not', () => {
  assert.equal(warningsIn('Numbness in my groin today')[0].urgent, true);
  assert.ok(warningsIn('lost control of my bladder').some(w => w.urgent));
  assert.ok(warningsIn('My legs feel weak').some(w => w.urgent));
  assert.equal(warningsIn('some tingling in my foot')[0].urgent, false);
  assert.deepEqual(warningsIn('no numbness today'), []);
  assert.deepEqual(warningsIn('Long walk at lunch. Felt loose.'), []);
  assert.deepEqual(warningsIn(''), []);
});

test('three check-ins at 7 or above suggest a doctor; dismissing holds for that run', () => {
  const days = [day('2026-10-28', 7), day('2026-10-29', 8), day('2026-10-30', 7)];
  const n = careNotice(days, '2026-10-30');
  assert.match(n.title, /doctor/);
  assert.equal(n.key, 'pain:2026-10-28');
  assert.equal(careNotice(days, '2026-10-30', { [n.key]: true }), null);
  assert.equal(careNotice([...days, day('2026-10-31', 8)], '2026-10-31', { [n.key]: true }), null);
  assert.equal(careNotice([day('2026-10-28', 7), day('2026-10-29', 6), day('2026-10-30', 7)], '2026-10-30'), null);
});

test('an urgent note comes first; old notes and old pain are left alone', () => {
  const days = [day('2026-10-28', 8), day('2026-10-29', 8), day('2026-10-30', 8, 'trouble with my bladder')];
  assert.equal(careNotice(days, '2026-10-30').urgent, true);
  assert.equal(careNotice([day('2026-09-01', 2, 'numb groin')], '2026-10-30'), null);
  assert.equal(careNotice([day('2026-08-01', 8), day('2026-08-02', 8), day('2026-08-03', 8)], '2026-10-30'), null);
});
