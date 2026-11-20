// What counts as a change to a routine, for before and after comparisons: moves added or taken away,
// a routine started (from its first session) or stopped. New doses, a new order or a renamed move
// don't count. Pure, unit-tested in test/routine-changes.test.js.
import { normName } from './move-names.js';

/** Two names for the same move: "Cat cow" and "Cat-cow stretch", or a typo fixed. */
const sameMove = (a, b) => {
  const x = normName(a), y = normName(b);
  return x === y || (x.length > 3 && y.includes(x)) || (y.length > 3 && x.includes(y));
};

/** One short line for what changed in a routine's moves, or null when nothing big did. */
export function describeRoutineChange(before, after) {
  const b = before.map(it => it.name), a = after.map(it => it.name);
  let added = a.filter(n => !b.includes(n)), removed = b.filter(n => !a.includes(n));
  // A move renamed in place is the same move
  const renamed = new Set();
  for (const n of added) {
    const was = removed.find(r => !renamed.has(r) && sameMove(r, n));
    if (was) { renamed.add(was); renamed.add(n); }
  }
  added = added.filter(n => !renamed.has(n));
  removed = removed.filter(n => !renamed.has(n));
  const list = xs => (xs.length <= 2 ? xs.join(' and ') : `${xs.length} moves`);
  const parts = [];
  if (added.length) parts.push(`Added ${list(added)}`);
  if (removed.length) parts.push(`${parts.length ? 'removed' : 'Removed'} ${list(removed)}`);
  return parts.length ? parts.join(', ') : null;
}

/**
 * The changes worth comparing before and after, from what's stored (older versions of the app also
 * logged new doses, new orders and routines that were set up but never done). A routine's start is
 * moved to the day of its first session, and anything before that day is dropped.
 * changes: [{ routineId, date, summary }], completions: [{ routineId, date }].
 */
export function meaningfulChanges(changes, completions) {
  const first = new Map();
  for (const c of completions) if (c.date && (!first.has(c.routineId) || c.date < first.get(c.routineId))) first.set(c.routineId, c.date);
  const out = [];
  for (const c of changes) {
    const began = first.get(c.routineId);
    if (!began || /^(Changed the dose|Changed \d+ doses|New order)/.test(c.summary)) continue;
    if (c.summary.startsWith('Started ')) { out.push({ ...c, date: began }); continue; }
    // "Added X, removed Y" where X is Y renamed
    const m = c.summary.match(/^Added (.+), removed (.+)$/);
    if (m && !/ moves$/.test(m[1]) && !describeRoutineChange(m[2].split(' and ').map(name => ({ name })), m[1].split(' and ').map(name => ({ name })))) continue;
    // Setting a routine up on the day it was first done isn't a change to it
    if (c.date > began) out.push(c);
  }
  // One start per routine, and it comes first on its day
  const seen = new Set();
  return out.filter(c => !c.summary.startsWith('Started ') || (!seen.has(c.routineId) && seen.add(c.routineId)))
    .sort((a, b) => a.date.localeCompare(b.date));
}
