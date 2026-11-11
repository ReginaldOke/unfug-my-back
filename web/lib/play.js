// The routine player's small decisions: which moves are timed rather than counted, where a move's form
// video search goes, and which move to start on. Pure, unit-tested in test/play.test.js.
import { normName } from './move-names.js';

// "30 s", "45 sec", "1 min", "2 minutes", "0:45", "1:30"
const TIME_TEXT = /(\d+(\.\d+)?\s*(s|sec|secs|second|seconds|min|mins|minute|minutes)\b)|(\b\d{1,2}:\d{2}\b)/i;
// Holds named as such, whatever the box says
const TIMED_NAMES = ['plank', 'hang', 'hold', 'wall sit', 'l sit', 'lsit', 'hollow body', 'isometric', 'iso hold', 'static'];

/** Whether a move is done for time (a plank, a dead hang, "30 s each side") rather than for reps. */
export function isTimed(name, ...amounts) {
  if (amounts.some(a => TIME_TEXT.test(String(a ?? '')))) return true;
  const n = ` ${normName(name)} `;
  return TIMED_NAMES.some(k => n.includes(` ${k} `));
}

/**
 * A YouTube search for short videos on doing the move well, most watched first. On iPhone the link opens
 * in the YouTube app when it's installed, otherwise in the browser.
 */
export function formVideoUrl(name) {
  const q = `${String(name ?? '').trim()} form #shorts`;
  // sp=CAMSAhgB: sorted by view count, under four minutes long
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}&sp=CAMSAhgB`;
}

/** Where a session picks up: the first move not yet done, unless none or all are done, then the first. */
export function startIndex(moves) {
  const next = moves.findIndex(m => !m.done);
  return next < 0 ? 0 : next;
}
