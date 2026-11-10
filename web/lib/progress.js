// A routine's moves over time: what to chart for each, read from how it was logged. Pure, unit-tested
// in test/progress.test.js.

const NUM = '(\\d+(?:[.,]\\d+)?)';
const n = v => Number(v.replace(',', '.'));

/**
 * The one number worth charting for a logged move, or null: weight if there is one ("75 kg"), else a
 * time ("0:45", "30 s", "2 min" as seconds), else reps ("3 × 8" is 24, "× 6 each side" is 6).
 */
export function moveValue({ did = '', extra = '' } = {}) {
  const both = `${did} ${extra}`;
  const weight = new RegExp(`${NUM}\\s*(kg|lbs?)\\b`, 'i').exec(both);
  if (weight) return { value: n(weight[1]), unit: weight[2].toLowerCase().startsWith('lb') ? 'lb' : 'kg' };
  const clock = /^(?:(\d+):)?(\d{1,2}):(\d{2})$/.exec(did.trim());
  if (clock) return { value: (Number(clock[1] ?? 0) * 60 + Number(clock[2])) * 60 + Number(clock[3]), unit: 's' };
  const secs = new RegExp(`${NUM}\\s*(s|secs?|seconds?)\\b`, 'i').exec(did);
  if (secs) return { value: n(secs[1]), unit: 's' };
  const mins = new RegExp(`${NUM}\\s*(m|mins?|minutes?)\\b`, 'i').exec(did);
  if (mins) return { value: n(mins[1]) * 60, unit: 's' };
  const sets = /(\d+)\s*[×x*]\s*(\d+)/i.exec(did);
  if (sets) return { value: Number(sets[1]) * Number(sets[2]), unit: 'reps' };
  const plain = new RegExp(NUM).exec(did);
  return plain ? { value: n(plain[1]), unit: 'reps' } : null;
}

/** How a logged move reads for one day: "3 × 8 · 75 kg", or "Done" for a plain tick. */
export const moveText = x => [x.did === '✓' ? 'Done' : x.did, x.extra].filter(Boolean).join(' · ');

/**
 * One row per move, in the routine's order, then anything else logged (like a timed hang). Each row
 * has every session's entry (or null where it wasn't done) and the values to chart.
 * sessions: oldest first, each { date, log: [{ name, did, extra }] }.
 */
export function progressRows(names, sessions) {
  const key = s => s.trim().toLowerCase();
  const order = [...names.filter(Boolean)];
  for (const s of sessions) for (const x of s.log ?? []) if (!order.some(o => key(o) === key(x.name))) order.push(x.name);
  return order.map(name => {
    const entries = sessions.map(s => (s.log ?? []).find(x => key(x.name) === key(name)) ?? null);
    const values = entries.map(x => (x ? moveValue(x) : null));
    return { name, entries, values };
  });
}
