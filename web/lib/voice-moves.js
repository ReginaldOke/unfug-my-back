// Moves said out loud while training ("20 Bulgarian split squats", "ten push ups and a 45 second plank"),
// turned into moves with their reps. Pure, unit-tested in test/voice-moves.test.js.
import { readNumbers, tidyName } from './routine-import.js';
import { normName } from './move-names.js';

const UNITS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const TENS = { twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };

/** "twenty five push ups" → "25 push ups"; "a dozen" → 12; "a minute" → 1 minute. */
export function digits(text) {
  return text.toLowerCase()
    .replace(/\ba dozen\b/g, '12').replace(/\bhalf a minute\b/g, '30 seconds').replace(/\ba minute\b/g, '1 minute')
    .replace(new RegExp(`\\b(${Object.keys(TENS).join('|')})(?:[\\s-](${UNITS.slice(1, 10).join('|')}))?\\b`, 'g'), (_, t, u) => String(TENS[t] + (u ? UNITS.indexOf(u) : 0)))
    .replace(new RegExp(`\\b(${UNITS.join('|')})\\b`, 'g'), w => String(UNITS.indexOf(w)))
    .replace(/(\d+)\s+hundred\b/g, (_, n) => String(Number(n) * 100));
}

/** One thing said, as moves: [{ name, did }]. Several can be said at once ("10 push ups and 20 squats"). */
export function spokenMoves(text) {
  const out = [];
  for (const part of digits(text).split(/\s*(?:,|;|\band then\b|\bthen\b|\band\b(?=\s*(?:a\s+)?\d))\s*/)) {
    // Filler first, so the number leads ("I did 12 more squats" is 12 squats)
    const said = part.replace(/\b(?:i did|i've done|i have done|did|done|just|another|more|okay|ok|um|uh|so|right|that's|that was|and)\b/gi, ' ').replace(/\s+/g, ' ').trim();
    const { dose, extra, rest } = readNumbers(said);
    const name = tidyName(rest.replace(/\b(?:of|reps?|sets?|times|a|an)\b/gi, ' '));
    if (!/[a-z]{3}/i.test(name)) continue;
    out.push({ name, did: dose.replace(/ reps\b/, ''), ...(extra ? { extra } : {}) });
  }
  return out;
}

/** The routine's move a spoken name means ("pushup" is "Push-ups"), or null. */
export function matchMove(items, name) {
  const key = s => normName(s).replace(/ /g, '');
  const k = key(name);
  if (k.length < 3) return null;
  return items.find(it => key(it.name) === k)
    ?? items.find(it => { const m = key(it.name); return m.length >= 4 && k.length >= 4 && (m.startsWith(k) || k.startsWith(m)); })
    ?? null;
}

/** Reps alone, for the player's box: "twelve" → "12", "three sets of ten" → "3 × 10", "forty five seconds" → "45 s". */
export function spokenAmount(text) {
  const t = digits(text);
  const { dose } = readNumbers(t);
  return dose.replace(/ reps$/, '') || t.match(/\d+(?:[.,]\d+)?/)?.[0] || '';
}
