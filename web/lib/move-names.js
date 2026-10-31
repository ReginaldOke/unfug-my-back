// Matching a move as people write it ("Pull-ups", "pullup", "Childs pose", "glute brdige", "RDL") to the
// animation for it. Pure, unit-tested in test/move-names.test.js.

/** Lower case, punctuation and plurals gone: "Child's Poses" → "child pose", "Pull-Ups" → "pull up". */
export function normName(text) {
  return String(text ?? '').toLowerCase().replace(/&/g, ' and ').replace(/['’]/g, '').replace(/[^a-z0-9]+/g, ' ').trim()
    .split(' ').map(w => (w.length > 3 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w)).join(' ');
}

/** Fewest edits (a swapped pair of letters counts as one) to turn `pattern` into some stretch of `text`. */
function nearest(pattern, text) {
  let before = null, prev = new Array(text.length + 1).fill(0);
  for (let i = 1; i <= pattern.length; i++) {
    const row = [i];
    for (let j = 1; j <= text.length; j++) {
      row[j] = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + (pattern[i - 1] === text[j - 1] ? 0 : 1));
      if (before && i > 1 && j > 1 && pattern[i - 1] === text[j - 2] && pattern[i - 2] === text[j - 1]) row[j] = Math.min(row[j], before[j - 2] + 1);
    }
    before = prev;
    prev = row;
  }
  return Math.min(...prev);
}

/**
 * The entry whose names best fit `name`, or null. Each entry has `names`. An exact name (as a whole
 * word, or run together: "pullup") wins, the longest first, so "side plank" beats "plank"; failing
 * that, a name within a typo or two of part of it ("glute brdige").
 */
export function findByName(entries, name) {
  const n = normName(name);
  if (!n) return null;
  const words = ` ${n} `, joined = n.replace(/ /g, '');
  let best = null, bestLen = 0;
  for (const entry of entries) {
    for (const alias of entry.names) {
      const a = normName(alias), aj = a.replace(/ /g, '');
      const hit = words.includes(` ${a} `) || (aj.length >= 5 && joined.includes(aj));
      if (hit && aj.length > bestLen) { best = entry; bestLen = aj.length; }
    }
  }
  if (best) return best;
  let bestDist = Infinity;
  for (const entry of entries) {
    for (const alias of entry.names) {
      const aj = normName(alias).replace(/ /g, '');
      if (aj.length < 6) continue;
      const allowed = aj.length >= 10 ? 2 : 1;
      const d = nearest(aj, joined);
      if (d <= allowed && (d < bestDist || (d === bestDist && aj.length > bestLen))) { best = entry; bestDist = d; bestLen = aj.length; }
    }
  }
  return best;
}
