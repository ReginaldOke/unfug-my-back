// Turning a routine from anywhere into moves: a note, a message, an email, a web page, a spreadsheet, a
// coach's plan, or an export from another workout app (Strong, Hevy and the like). Whatever comes in is
// read as text, tables or JSON, and each line becomes a move with its sets, reps or time as the target and
// any weight or note in the second box. Headings like "Day 1" or "Push" become variations; a warm-up goes
// first and a cool-down last. Pure, unit-tested in test/routine-import.test.js. Runs on the phone only.

import { nameForMoves } from './routine-name.js';

// ---------- Words ----------

const UNIT_S = '(?:s|sec|secs|second|seconds|")';
const UNIT_MIN = "(?:m|min|mins|minute|minutes|')";
const NUM = '\\d+(?:[.,]\\d+)?';
const RANGE = `\\d+(?:\\s*[-–]\\s*\\d+)?`;
const SIDE = /\b(?:each|per|a|ea\.?)\s*(?:side|leg|arm|way|direction)s?\b|\/\s*(?:side|leg|arm)\b|\b(?:e\/s|l\s*[&+/]\s*r|both\s+sides|each)\b/i;
const GREETING = /^(?:hi|hey|hello|dear|thanks|thank you|cheers|regards|best|kind regards|sent from|here(?:'|’)?s|here is|enjoy|let me know|see you|good luck|have fun|any questions|cheers|xx?|love)\b/i;
const NOTE_LINE = /^(?:note|notes|rest|tip|tips|focus|goal|cue|cues|aim|remember|instructions?)\b\s*[:-]?/i;
const WARMUP = /\b(?:warm[\s-]?up|activation|prep|primer|pre[\s-]?hab)\b/i;
const COOLDOWN = /\b(?:cool[\s-]?down|warm[\s-]?down|stretch(?:es|ing)?|recovery|mobility finisher)\b/i;
// Parts of one session, as opposed to separate days: run together in order
const PART = /\b(?:superset|super set|circuit|tri[\s-]?set|giant set|block|finisher|main|strength|accessor(?:y|ies)|conditioning|core|skill|power|metcon|emom|amrap|part\s*[a-z0-9]|round)\b/i;
const DAY = /^(?:(?:day|week)\s*\d+\b.*|(?:mon|tues?|wed(?:nes)?|thu(?:rs)?|fri|sat(?:ur)?|sun)(?:day)?(?:\s*[-–:]\s*[a-z &+/]+)?|(?:push|pull|legs?|upper|lower|full[\s-]?body|chest|back|arms|shoulders|glutes?)(?:\s*(?:body|day|workout|session|[a-d]|\d|(?:&|and|\+|\/)\s*\w+))*|(?:workout|session|routine|program(?:me)?)\s*[a-z0-9]?|[a-z]+\s+day(?:\s*[a-d0-9])?)\s*:?$/i;
// A date or time on its own line ("Tuesday, Nov 18, 2026 at 6:02pm"), as workout apps put under a title
const DATE_LINE = /\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+\d{1,2}\b|\b\d{1,2}(?:st|nd|rd|th)?\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\b|\b\d{4}-\d{2}-\d{2}\b|\b\d{1,2}\/\d{1,2}\/\d{2,4}\b|\bat\s+\d{1,2}:\d{2}\s*(?:am|pm)?\b/i;
const SIGN_OFF = /^(?:thanks|thank you|cheers|regards|best|kind regards|best wishes|speak soon|talk soon|all the best|sent from my \w+)[,!. ]*$/i;
// Words left behind that aren't a move ("Do 3 rounds", "Repeat x3")
const NOT_A_MOVE = /^(?:do|then|repeat|complete|perform|and|rounds?|total|x|of|sets?|reps?|each|times?|go|rest|finish|start|between)$/i;

const ABBREV = [[/\bdb\b/gi, 'dumbbell'], [/\bdbs\b/gi, 'dumbbell'], [/\bbb\b/gi, 'barbell'], [/\bkb\b/gi, 'kettlebell'], [/\bkbs\b/gi, 'kettlebell'],
  [/\bsl\b/gi, 'single leg'], [/\bsa\b/gi, 'single arm'], [/\bbss\b/gi, 'Bulgarian split squat'], [/\bohp\b/gi, 'overhead press'], [/\bghr\b/gi, 'glute ham raise'],
  [/\bpull[\s-]?ups?\b/gi, 'pull-up'], [/\bpush[\s-]?ups?\b/gi, 'push-up'], [/\bchin[\s-]?ups?\b/gi, 'chin-up'], [/\bsit[\s-]?ups?\b/gi, 'sit-up']];
const PROPER = Object.fromEntries(['Bulgarian', 'McKenzie', 'Copenhagen', 'Romanian', 'Pallof', 'Arnold', 'Zercher', 'Jefferson', 'Turkish', 'Russian', 'Nordic', 'Cossack', 'Jefferson', 'Williams', 'Kegel', 'Pilates', 'Superman', 'Spiderman', 'Cuban', 'Bayesian', 'Larsen', 'Seal', 'Pendlay', 'Meadows', 'Kroc', 'Svend', 'Tate', 'JM', 'Dragon'].map(w => [w.toLowerCase(), w]));
const ACRONYM = /^(?:RDL|TRX|TKE|EMOM|AMRAP|HIIT|ATG|SLR|RKC|SMR|PNF|TVA|IYT|YTW|ITB|DNS|JM|T|Y|W|V|L)$/;

// ---------- Small helpers ----------

const num = s => Number(String(s).replace(',', '.'));
const fmtNum = n => (Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100));
const fmtRange = s => s.replace(/\s*[-–]\s*/, '–');
/** 90 → "90 s"; 60 → "1 min"; 150 → "2 min 30 s" */
export function fmtSeconds(sec) {
  sec = Math.round(sec);
  if (sec < 60 || (sec < 120 && sec % 60)) return `${sec} s`;
  const m = Math.floor(sec / 60), r = sec % 60;
  return r ? `${m} min ${r} s` : `${m} min`;
}
const cut = (text, m) => text.slice(0, m.index) + ' '.repeat(m[0].length) + text.slice(m.index + m[0].length);

/** Sentence case like the app's own names ("Glute bridge"), keeping short acronyms (RDL, TRX) as they are. */
export function tidyName(raw) {
  let t = raw.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, ' ')
    .replace(/\(\s*\)|\[\s*\]/g, ' ').replace(/[*_`~]+/g, ' ').replace(/\s+/g, ' ').trim()
    .replace(/^[\s:,;|@–—\-.)>]+|[\s:,;|@–—\-(<]+$/g, '').trim();
  for (const [re, to] of ABBREV) t = t.replace(re, to);
  const allCaps = t === t.toUpperCase();
  const words = t.split(' ').map((w, i) => {
    const bare = w.replace(/[^A-Za-z]/g, '');
    if (bare.length >= 2 && ACRONYM.test(bare.toUpperCase()) && (bare === bare.toUpperCase() || /^(?:rdl|trx|tke|emom|amrap|hiit|slr|ytw|iyt)$/i.test(bare))) return w.toUpperCase();
    // "Workout A", "Upper B"
    if (i > 0 && /^[A-Z]$/.test(w)) return w;
    const proper = PROPER[bare.toLowerCase()];
    if (proper) return w.replace(bare, proper);
    return i === 0 ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : w.toLowerCase();
  });
  return words.join(' ').replace(/\bi\b/g, 'I');
}

// ---------- One line: a move, its target and its extra ----------

/**
 * Reads the numbers in a line: { dose, extra, rest } where rest is the line with them taken out (the
 * move's name, usually). dose is in the app's style: "3 × 10", "10 reps", "30 s each side", "3 × 30 s".
 */
export function readNumbers(line) {
  let text = ` ${line} `;
  const notes = [];
  let m;
  // Notes first, so their numbers aren't read as the target
  if ((m = text.match(/\b(?:rest|recover(?:y)?)\s*[:=]?\s*(\d+(?:[.,]\d+)?)\s*(s|sec|secs|seconds?|m|min|mins|minutes?|'|")?(?:\s*between\s*sets)?/i))) {
    const v = num(m[1]), u = m[2] ?? (v > 10 ? 's' : 'min');
    notes.push(`rest ${fmtSeconds(/^m|'/i.test(u) ? v * 60 : v)}`); text = cut(text, m);
  }
  if ((m = text.match(/\b(rpe|rir)\s*[:@]?\s*(\d+(?:[.,]\d+)?(?:\s*[-–]\s*\d+)?)/i))) { notes.push(`${m[1].toUpperCase()} ${fmtRange(m[2])}`); text = cut(text, m); }
  if ((m = text.match(/\btempo\s*[:=]?\s*([\dxX](?:\s*[-:/]\s*[\dxX]){2,3})/i))) { notes.push(`tempo ${m[1].replace(/\s*[:/]\s*/g, '-').replace(/\s/g, '')}`); text = cut(text, m); }
  if ((m = text.match(/\b(light|medium|heavy|extra heavy|red|green|blue|black|yellow|purple|orange|pink|grey|gray)\s+(?:resistance\s+)?band\b/i))) { notes.push(`${m[1].toLowerCase()} band`); text = cut(text, m); }

  // Weight: "2x16kg" (a pair), "60 kg", "@135lbs", "+10 kg", "bodyweight"
  let weight = '';
  if ((m = text.match(new RegExp(`(\\d+)\\s*[x×]\\s*(${NUM})\\s*(kg|kgs|kilos?|lb|lbs|pounds?)\\b`, 'i')))) {
    weight = `${m[1]} × ${fmtNum(num(m[2]))} ${/^k/i.test(m[3]) ? 'kg' : 'lb'}`; text = cut(text, m);
  } else if ((m = text.match(new RegExp(`([+@]\\s*)?(${NUM}(?:\\s*[-–/]\\s*${NUM})*)\\s*(kg|kgs|kilos?|kilograms?|lb|lbs|pounds?|#)(?![a-z])`, 'i')))) {
    weight = `${m[1]?.includes('+') ? '+' : ''}${m[2].replace(/\s*([-–/])\s*/g, '$1').replace(/,/g, '.')} ${/^k/i.test(m[3]) ? 'kg' : 'lb'}`; text = cut(text, m);
  } else if ((m = text.match(/\b(?:body\s?weight|bw)\b/i))) { weight = 'bodyweight'; text = cut(text, m); }
  else if ((m = text.match(/@\s*(\d+(?:[.,]\d+)?\s*%(?:\s*(?:of\s*)?1rm)?)/i))) { weight = m[1].replace(/\s+/g, ' '); text = cut(text, m); }

  let side = '';
  if ((m = text.match(SIDE)) && /\d|reps?|sets?|hold|amrap/i.test(text)) { side = ' each side'; text = cut(text, m); }

  let sets = null, reps = null, secs = null, other = null;
  const timeOf = (v, u) => (new RegExp(`^${UNIT_MIN}$`, 'i').test(u) ? num(v) * 60 : num(v));
  // "3 x 30s", "3 sets of 45 seconds", "4x1min"
  if ((m = text.match(new RegExp(`\\b(\\d+)\\s*(?:sets?\\s*(?:of|x|×|,)?|rounds?\\s*(?:of|x|×)?|[x×*])\\s*(${NUM})\\s*(${UNIT_S}|${UNIT_MIN})(?![a-z])`, 'i'))) && !/^m$/i.test(m[3]) || (m && num(m[2]) < 30)) {
    sets = m[1]; secs = timeOf(m[2], m[3]); text = cut(text, m);
  // "3x10", "3 x 8-12", "4 sets of 6", "3 sets x 10 reps", "5×5"
  } else if ((m = text.match(new RegExp(`\\b(\\d+)\\s*(?:sets?\\s*(?:of|x|×|,|:)?\\s*|rounds?\\s*(?:of|x|×)?\\s*|[x×*]\\s*)(${RANGE})\\s*(?:reps?|repetitions|r\\b)?`, 'i')))) {
    sets = m[1]; reps = m[2]; text = cut(text, m);
  // "10 reps x 3 sets", "10 x 3 sets", "12, 3 sets"
  } else if ((m = text.match(new RegExp(`\\b(${RANGE})\\s*(?:reps?)?\\s*[x×,]?\\s*(\\d+)\\s*sets?\\b`, 'i')))) {
    reps = m[1]; sets = m[2]; text = cut(text, m);
  }
  if (!reps && !secs && (m = text.match(new RegExp(`\\b(${RANGE})\\s*(?:reps?|repetitions|times|r\\b)`, 'i')))) { reps = m[1]; text = cut(text, m); }
  if (!sets && (m = text.match(/\b(\d+)\s*(?:sets?|rounds?)\b/i))) { sets = m[1]; text = cut(text, m); }
  // "1:30" as a time, "hold 30", "30 sec", "2 min", "90s"
  if (!secs && !reps && (m = text.match(/\b(\d{1,2}):([0-5]\d)\b/))) { secs = Number(m[1]) * 60 + Number(m[2]); text = cut(text, m); }
  if (!secs && !reps && (m = text.match(new RegExp(`(${NUM})\\s*(${UNIT_S}|${UNIT_MIN})(?![a-z])`, 'i')))) {
    // "400m" is a distance, "5m" five minutes
    if (/^m$/i.test(m[2]) && num(m[1]) >= 50) other = `${m[1]} m`;
    else secs = timeOf(m[1], m[2]);
    text = cut(text, m);
  }
  if (!secs && !reps && !other && (m = text.match(new RegExp(`(${NUM})\\s*(km|mi|miles?|metres?|meters?|yards?|yds?)\\b`, 'i')))) {
    other = `${m[1]} ${/^k/i.test(m[2]) ? 'km' : /^mi/i.test(m[2]) ? 'mi' : /^y/i.test(m[2]) ? 'yd' : 'm'}`; text = cut(text, m);
  }
  if (!secs && (m = text.match(/\bhold\s*(?:for\s*)?(\d+)\b/i))) { secs = num(m[1]); text = cut(text, m); }
  if (!reps && !secs && !other && (m = text.match(/\b(?:(\d+)\s*(?:sets?\s*(?:of|to|x|×)?|[x×])\s*)?(amrap|max(?:\s*reps)?|to failure|failure|as many as possible)\b/i))) {
    other = /amrap|as many/i.test(m[2]) ? 'AMRAP' : /fail/i.test(m[2]) ? 'to failure' : 'max reps';
    if (m[1]) sets = m[1];
    text = cut(text, m);
  }
  // "x10", "10x", "×12" on their own
  if (!reps && !secs && (m = text.match(/(?:^|\s)[x×]\s*(\d+(?:\s*[-–]\s*\d+)?)\b/i) ?? text.match(/\b(\d+)\s*[x×](?=\s|$)/i))) { reps = m[1]; text = cut(text, m); }
  // A time then how many: "45s each side x 3"
  if (secs && !sets && (m = text.match(/(?:^|\s)[x×]\s*(\d+)\b/))) { sets = m[1]; text = cut(text, m); }
  // A bare number before the name or after it ("10 push-ups", "Clamshells - 15 each side", "20 total") is reps
  if (!reps && !secs && !other && (m = text.match(/^\s*(\d+(?:\s*[-–]\s*\d+)?)\s+(?=[a-z])/i) ?? text.match(/(?:[-–:,]\s*|\s)(\d+(?:\s*[-–]\s*\d+)?)\s*(?:total)?\s*$/i))) {
    if (!/\b(?:figure|number|no\.?)\s*$/i.test(text.slice(0, m.index))) { reps = m[1]; text = cut(text, m).replace(/\btotal\b/i, ' '); }
  }

  let dose = '';
  const t = secs != null ? fmtSeconds(secs) : null;
  const r = reps ? fmtRange(reps) : null;
  if (sets && (r || t)) dose = `${sets} × ${r ?? t}`;
  else if (r) dose = `${r} reps`;
  else if (t) dose = t;
  else if (other) dose = sets ? (other === 'to failure' ? `${sets} sets to failure` : `${sets} × ${other}`) : other;
  else if (sets) dose = `${sets} sets`;
  if (dose) dose += side;
  const extra = [weight, ...notes].filter(Boolean).join(', ');
  return { dose, extra, rest: text.replace(/\s+/g, ' ').trim() };
}

const BULLET = /^\s*(?:[-*•–—·▪◦‣⁃○●■□►▶︎✓✔️✅☐☑️]+|\(?\d{1,2}[.):]\)?(?!\d)|\(?[a-z]\)|[A-Z]\d{1,2}[.):]?|[A-Z][.)](?=\s)|\[[ xX]?\])\s*/u;

/** A line that's one set of the move above it, as workout apps share them: "Set 1: 60 kg × 10", "2. 10 reps", "W: 20kg x 12" */
const SET_LINE = /^\s*(?:set\s*\d+|\d+\s*[.):]|w(?:arm[\s-]?up)?\s*\d*\s*[.):]|[dDfF]\s*[.):])\s*[:.-]?\s*(?:\d+(?:[.,]\d+)?\s*(?:kg|kgs|lb|lbs)?\s*[x×]\s*\d+|\d+\s*reps?|\d+(?:[.,]\d+)?\s*(?:kg|kgs|lb|lbs)\s*,?\s*\d+\s*reps?|\d{1,2}:[0-5]\d|\d+\s*(?:s|sec|secs|seconds|min|mins)\b)(?:\s*(?:\(.*\)|@?\s*rpe\s*\d+(?:\.\d+)?|\[.*\]))?\s*$/i;

/** Reads a set line into { reps?, secs?, weight?, warm } */
function readSet(line) {
  const warm = /^\s*w/i.test(line);
  const body = line.replace(/^\s*(?:set\s*\d+|\d+\s*[.):]|w(?:arm[\s-]?up)?\s*\d*\s*[.):]|[dDfF]\s*[.):])\s*[:.-]?\s*/i, '');
  let m;
  if ((m = body.match(/(\d+(?:[.,]\d+)?)\s*(kg|kgs|lb|lbs)?\s*[x×]\s*(\d+)/i))) return { weight: m[2] ? `${fmtNum(num(m[1]))} ${/^k/i.test(m[2]) ? 'kg' : 'lb'}` : (num(m[1]) > 0 ? `${fmtNum(num(m[1]))}` : ''), reps: m[3], warm };
  if ((m = body.match(/(\d+(?:[.,]\d+)?)\s*(kg|kgs|lb|lbs)\s*,?\s*(\d+)\s*reps?/i))) return { weight: `${fmtNum(num(m[1]))} ${/^k/i.test(m[2]) ? 'kg' : 'lb'}`, reps: m[3], warm };
  if ((m = body.match(/(\d+)\s*reps?/i))) return { reps: m[1], warm };
  if ((m = body.match(/(\d{1,2}):([0-5]\d)/))) return { secs: Number(m[1]) * 60 + Number(m[2]), warm };
  if ((m = body.match(/(\d+)\s*(s|sec|secs|seconds|min|mins)\b/i))) return { secs: /^m/i.test(m[2]) ? Number(m[1]) * 60 : Number(m[1]), warm };
  return null;
}

/** Sets logged one by one, as a target: "3 × 10" when they match, "10, 8, 6" when they don't; the top weight as the extra. */
export function fromSets(sets) {
  const work = sets.filter(x => !x.warm);
  const list = work.length ? work : sets;
  if (!list.length) return { dose: '', extra: '' };
  const reps = list.map(x => x.reps).filter(Boolean), secs = list.map(x => x.secs).filter(Boolean);
  let dose = '';
  if (reps.length) dose = new Set(reps).size === 1 ? (reps.length > 1 ? `${reps.length} × ${reps[0]}` : `${reps[0]} reps`) : reps.join(', ');
  else if (secs.length) dose = new Set(secs).size === 1 ? (secs.length > 1 ? `${secs.length} × ${fmtSeconds(secs[0])}` : fmtSeconds(secs[0])) : secs.map(fmtSeconds).join(', ');
  const weights = list.map(x => x.weight).filter(w => w && /\d/.test(w) && !/^0(\s|$)/.test(w));
  const heaviest = weights.sort((a, b) => parseFloat(b) - parseFloat(a))[0];
  return { dose, extra: heaviest && /kg|lb/.test(heaviest) ? heaviest : heaviest ? `${heaviest} kg` : '' };
}

// ---------- Turning anything into lines of text ----------

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', times: '×', ndash: '–', mdash: '—', bull: '•', hellip: '…', rsquo: '’', lsquo: '‘', ldquo: '“', rdquo: '”', deg: '°' };
const decodeEntities = s => s.replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (all, e) => (e[0] === '#' ? String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : Number(e.slice(1))) : ENTITIES[e.toLowerCase()] ?? all));

/** A web page or an HTML email to lines: headings marked with #, list items and rows on their own lines, table cells split by |. */
export function htmlToText(html) {
  return decodeEntities(html
    .replace(/<(script|style|head|title)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<h[1-6][^>]*>/gi, '\n# ').replace(/<\/h[1-6]>/gi, '\n')
    .replace(/<(?:strong|b)>([^<]{1,60})<\/(?:strong|b)>\s*(?:<br\s*\/?>|<\/p>)/gi, '\n# $1\n')
    .replace(/<li[^>]*>/gi, '\n• ').replace(/<\/(?:td|th)>\s*/gi, ' | ').replace(/<tr[^>]*>/gi, '\n| ')
    .replace(/<br\s*\/?>|<\/(?:p|div|li|tr|ul|ol|table|blockquote|h\d)>/gi, '\n')
    .replace(/<[^>]+>/g, ' '))
    .replace(/[ \t ]+/g, ' ').replace(/ *\n */g, '\n');
}

/** Rich text (.rtf) to plain text. */
export function rtfToText(rtf) {
  let depth = 0, skipAt = -1, out = '';
  for (let i = 0; i < rtf.length; i++) {
    const c = rtf[i];
    if (c === '{') { depth++; if (rtf.startsWith('{\\*', i) || /^\{\\(?:fonttbl|colortbl|stylesheet|info|pict|header|footer)/.test(rtf.slice(i, i + 12))) { if (skipAt < 0) skipAt = depth; } continue; }
    if (c === '}') { if (depth === skipAt) skipAt = -1; depth--; continue; }
    if (skipAt >= 0) continue;
    if (c === '\\') {
      const m = rtf.slice(i).match(/^\\(?:'([0-9a-f]{2})|u(-?\d+)\??|([a-z]+)(-?\d+)? ?|([\\{}]))/i);
      if (!m) continue;
      i += m[0].length - 1;
      if (m[1]) out += String.fromCharCode(parseInt(m[1], 16));
      else if (m[2]) out += String.fromCharCode((Number(m[2]) + 65536) % 65536);
      else if (m[5]) out += m[5];
      else if (/^(?:par|line|row)$/.test(m[3])) out += '\n';
      else if (m[3] === 'tab' || m[3] === 'cell') out += ' | ';
      else if (m[3] === 'bullet') out += '•';
      continue;
    }
    if (c !== '\r' && c !== '\n') out += c;
  }
  return out;
}

const qpDecode = s => s.replace(/=\r?\n/g, '').replace(/(?:=[0-9A-F]{2})+/g, seq => {
  try { return new TextDecoder().decode(new Uint8Array(seq.slice(1).split('=').map(h => parseInt(h, 16)))); } catch { return seq; }
});
const b64Decode = s => { try { return new TextDecoder().decode(Uint8Array.from(atob(s.replace(/\s+/g, '')), c => c.charCodeAt(0))); } catch { return ''; } };

/** An email saved as .eml (or pasted with its headers): { subject, body } with the body as plain text. */
export function readEmail(raw) {
  const text = raw.replace(/\r\n/g, '\n');
  const split = text.indexOf('\n\n');
  const head = text.slice(0, split).replace(/\n[ \t]+/g, ' ');
  let body = text.slice(split + 2);
  const header = name => head.match(new RegExp(`^${name}:\\s*(.*)$`, 'im'))?.[1]?.trim() ?? '';
  const subject = header('Subject').replace(/=\?[^?]+\?([bq])\?([^?]*)\?=/gi, (_, enc, v) => (enc.toLowerCase() === 'b' ? b64Decode(v) : qpDecode(v.replace(/_/g, ' '))))
    .replace(/^(?:re|fwd?|fw)\s*:\s*/i, '');
  const boundary = header('Content-Type').match(/boundary="?([^";]+)"?/i)?.[1];
  const decode = (part, headers) => {
    const enc = headers.match(/content-transfer-encoding:\s*(\S+)/i)?.[1]?.toLowerCase();
    const v = enc === 'base64' ? b64Decode(part) : enc === 'quoted-printable' ? qpDecode(part) : part;
    return /content-type:\s*text\/html/i.test(headers) ? htmlToText(v) : v;
  };
  if (boundary) {
    const parts = body.split(`--${boundary}`).map(p => { const at = p.indexOf('\n\n'); return { h: p.slice(0, at), b: p.slice(at + 2) }; });
    const plain = parts.find(p => /content-type:\s*text\/plain/i.test(p.h)) ?? parts.find(p => /content-type:\s*text\/html/i.test(p.h));
    body = plain ? decode(plain.b, plain.h) : body;
  } else body = decode(body, head);
  return { subject, body };
}

// ---------- Tables: CSV, tab-separated, markdown and pipe tables ----------

/** Rows of cells from CSV, TSV or | tables. Quoted CSV fields may hold commas and newlines. */
export function tableRows(text) {
  const lines = text.replace(/\r/g, '').split('\n').filter(l => l.trim());
  if (lines.filter(l => l.includes('|')).length >= Math.max(2, lines.length * 0.6)) {
    return lines.filter(l => !/^\s*\|?\s*:?-{2,}/.test(l)).map(l => l.replace(/^\s*\|/, '').replace(/\|\s*$/, '').split('|').map(c => c.trim()));
  }
  const delim = lines.filter(l => l.includes('\t')).length >= lines.length * 0.6 ? '\t' : lines.filter(l => l.includes(';')).length > lines.filter(l => l.includes(',')).length ? ';' : ',';
  const rows = [];
  let row = [], cell = '', q = false;
  const src = lines.join('\n');
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (q) { if (c === '"' && src[i + 1] === '"') { cell += '"'; i++; } else if (c === '"') q = false; else cell += c; }
    else if (c === '"' && !cell.trim()) q = true;
    else if (c === delim) { row.push(cell.trim()); cell = ''; }
    else if (c === '\n') { row.push(cell.trim()); rows.push(row); row = []; cell = ''; }
    else cell += c;
  }
  row.push(cell.trim()); rows.push(row);
  return rows.filter(r => r.some(Boolean));
}

const COL = {
  name: /^(?:exercise(?:\s*name|_title|_name|title)?|movement|move|name|lift|activity|exercise title)$/i,
  sets: /^(?:sets?|#\s*sets|no\.?\s*of\s*sets|rounds?)$/i,
  reps: /^(?:reps?|repetitions|rep\s*range|target\s*reps)$/i,
  weight: /^(?:weight|load|kg|lbs?|weight\s*\((?:kg|lbs?)\)|weight_kg|weight_lbs|resistance)$/i,
  secs: /^(?:seconds|duration_seconds|time\s*\(s\)|secs?)$/i,
  time: /^(?:time|duration|hold|work)$/i,
  dist: /^(?:distance(?:_km)?|distance\s*\(km\))$/i,
  notes: /^(?:notes?|comments?|cues?|instructions?)$/i,
  day: /^(?:workout(?:\s*name)?|title|day|session|routine(?:\s*name)?|block|template)$/i,
  setNo: /^(?:set\s*(?:order|#|number|no\.?)|set_index|set)$/i,
  setType: /^(?:set_type|set type)$/i,
  date: /^(?:date|start_time|start time|workout date)$/i,
  dose: /^(?:sets?\s*[x×]\s*reps?|prescription|dose|volume|target)$/i,
  unit: /^(?:weight\s*unit|unit)$/i,
};

/** Routine sections from table rows, or null when they don't look like a routine. */
export function readTable(rows) {
  if (rows.length < 1) return null;
  const head = rows[0].map(c => c.replace(/^"|"$/g, '').trim());
  const col = Object.fromEntries(Object.entries(COL).map(([k, re]) => [k, head.findIndex(c => re.test(c))]));
  const has = k => col[k] >= 0;
  const cell = (r, k) => (has(k) ? (r[col[k]] ?? '').trim() : '');
  let body = rows.slice(1);
  if (!has('name')) {
    // No header: a name then numbers ("Squat, 3, 10, 60kg")
    const looks = rows.filter(r => r.length >= 2 && /[a-z]/i.test(r[0]) && r.slice(1).some(c => /\d/.test(c)));
    if (looks.length < Math.max(1, rows.length * 0.6)) return null;
    const items = looks.map(r => {
      const nums = r.slice(1).join(' ');
      const bare = r.slice(1).filter(c => /^\d+(?:\s*[-–]\s*\d+)?$/.test(c));
      const read = bare.length >= 2 && !/[x×]|reps?|sets?/i.test(nums) ? readNumbers(`${bare[0]}x${bare[1]} ${r.slice(1).filter(c => !bare.slice(0, 2).includes(c)).join(' ')}`) : readNumbers(nums);
      return { name: tidyName(r[0]), dose: read.dose, extra: read.extra };
    }).filter(x => x.name);
    return items.length ? [{ name: null, items }] : null;
  }
  // A log of every set (Strong, Hevy and similar): the latest session of each workout, its sets gathered by move
  const perSet = has('setNo') || (body.length > 1 && !has('sets') && new Set(body.map(r => cell(r, 'name'))).size < body.length);
  if (perSet) {
    const latest = new Map();
    if (has('date')) for (const r of body) { const k = cell(r, 'day'), d = cell(r, 'date'); if (!latest.has(k) || d > latest.get(k)) latest.set(k, d); }
    body = body.filter(r => !has('date') || cell(r, 'date') === latest.get(cell(r, 'day')));
  }
  const sections = new Map();
  for (const r of body) {
    const name = tidyName(cell(r, 'name'));
    if (!name) continue;
    const day = has('day') ? cell(r, 'day') || null : null;
    if (!sections.has(day)) sections.set(day, new Map());
    const moves = sections.get(day);
    const unit = /lb/i.test(cell(r, 'unit') || head[col.weight] || '') ? 'lb' : 'kg';
    const w = cell(r, 'weight');
    const weight = w && /\d/.test(w) && num(w.replace(/[^\d.,]/g, '')) > 0 ? (/[a-z]/i.test(w) ? readNumbers(w).extra || w : `${fmtNum(num(w))} ${unit}`) : '';
    const secs = has('secs') && num(cell(r, 'secs')) > 0 ? num(cell(r, 'secs')) : null;
    if (perSet) {
      const set = { reps: cell(r, 'reps') && num(cell(r, 'reps')) > 0 ? String(num(cell(r, 'reps'))) : null, secs: secs ?? (has('time') ? toSecs(cell(r, 'time')) : null), weight, warm: /warm/i.test(cell(r, 'setType')) };
      if (!moves.has(name)) moves.set(name, { name, sets: [], notes: cell(r, 'notes') });
      moves.get(name).sets.push(set);
    } else {
      let dose = '', extra = weight;
      const sets = cell(r, 'sets'), reps = cell(r, 'reps'), time = cell(r, 'time') || (secs ? `${secs}s` : '');
      if (has('dose') && cell(r, 'dose')) ({ dose } = readNumbers(cell(r, 'dose')));
      else if (sets && reps) {
        const rr = readNumbers(/^\d/.test(reps) && !/[x×]|\d\s*(?:s|secs?|seconds?|mins?|minutes?|")\b/i.test(reps) ? reps.replace(/^(\d+(?:\s*[-–]\s*\d+)?)/, '$1 reps') : reps).dose || reps;
        dose = Number(sets) === 1 ? rr : `${sets} × ${rr.replace(/ reps/, '')}`;
      }
      else if (sets && time) dose = `${sets} × ${toSecs(time) ? fmtSeconds(toSecs(time)) : time}`;
      else if (reps) dose = readNumbers(/^\d+(?:\s*[-–]\s*\d+)?$/.test(reps) ? `${reps} reps` : reps).dose || reps;
      else if (time) dose = toSecs(time) ? fmtSeconds(toSecs(time)) : time;
      else if (sets) dose = `${sets} sets`;
      if (/each|per side|\/side/i.test(`${reps} ${cell(r, 'notes')}`) && dose && !/each side/.test(dose)) dose += ' each side';
      const note = cell(r, 'notes');
      if (note && note.length <= 40) extra = [extra, note].filter(Boolean).join(', ');
      moves.set(`${name}#${moves.size}`, { name, dose, extra });
    }
  }
  const out = [...sections].map(([day, moves]) => ({
    name: day ? tidyName(day) : null,
    items: [...moves.values()].map(m => (m.sets ? { name: m.name, ...fromSets(m.sets) } : m)),
  })).filter(s => s.items.length);
  return out.length ? out : null;
}

const toSecs = v => {
  if (v == null || v === '') return null;
  const s = String(v).trim();
  let m;
  if ((m = s.match(/^(\d{1,2}):([0-5]\d)$/))) return Number(m[1]) * 60 + Number(m[2]);
  if ((m = s.match(/^(\d+(?:\.\d+)?)\s*(m|min|mins|minutes)$/i))) return num(m[1]) * 60;
  if ((m = s.match(/^(\d+(?:\.\d+)?)\s*(s|sec|secs|seconds)?$/i))) return num(m[1]);
  return null;
};

// ---------- JSON from other apps ----------

const pick = (o, keys) => { for (const k of Object.keys(o)) if (keys.test(k)) return o[k]; return undefined; };
const NAME_KEY = /^(?:name|title|exercise(?:_?name|_?title)?|movement|exerciseName|exerciseTitle|label)$/i;

/** Routine sections from JSON (an export or a shared routine), or null. */
export function readJSON(data) {
  const sections = [];
  const asMove = o => {
    if (!o || typeof o !== 'object') return null;
    let name = pick(o, NAME_KEY);
    if (name && typeof name === 'object') name = pick(name, NAME_KEY);
    if (typeof name !== 'string' || !name.trim()) return null;
    const setsVal = pick(o, /^sets$/i);
    if (Array.isArray(setsVal)) {
      const sets = setsVal.map(x => ({ reps: x.reps ?? x.repetitions ?? null, secs: x.duration_seconds ?? x.seconds ?? x.duration ?? x.time ?? null, weight: (x.weight_kg ?? x.weight ?? x.weightKg) ? `${fmtNum(num(x.weight_kg ?? x.weight ?? x.weightKg))} ${x.weight_lbs || /lb/i.test(x.unit ?? '') ? 'lb' : 'kg'}` : '', warm: /warm/i.test(x.type ?? x.set_type ?? '') }));
      return { name: tidyName(name), ...fromSets(sets.map(x => ({ ...x, reps: x.reps != null ? String(x.reps) : null }))) };
    }
    const bits = [setsVal != null ? `${setsVal} sets` : '', pick(o, /^(?:reps?|repetitions)$/i) != null ? `${pick(o, /^(?:reps?|repetitions)$/i)} reps` : '',
      pick(o, /^(?:duration|seconds|time|hold)(?:_?s(?:ec(?:onds)?)?)?$/i) != null ? `${pick(o, /^(?:duration|seconds|time|hold)(?:_?s(?:ec(?:onds)?)?)?$/i)}s` : '',
      pick(o, /^(?:weight|load)(?:_?kg)?$/i) != null ? `${pick(o, /^(?:weight|load)(?:_?kg)?$/i)} kg` : ''].filter(Boolean).join(' ');
    const read = readNumbers(bits);
    const note = pick(o, /^(?:notes?|cues?)$/i);
    const side = typeof note === 'string' && SIDE.test(note) && read.dose && !/each side/.test(read.dose);
    return { name: tidyName(name), dose: side ? `${read.dose} each side` : read.dose, extra: read.extra || (typeof note === 'string' && note.length <= 40 && !side ? note : '') };
  };
  const walk = (node, label) => {
    if (Array.isArray(node)) {
      const moves = node.map(asMove).filter(Boolean);
      if (moves.length && moves.length >= node.length * 0.6 && !node.some(x => x && typeof x === 'object' && Object.values(x).some(v => Array.isArray(v) && v.some(y => asMove(y))))) {
        sections.push({ name: label, items: moves });
        return;
      }
      node.forEach(x => walk(x, label));
    } else if (node && typeof node === 'object') {
      const title = pick(node, /^(?:name|title|day|workout(?:_?name)?|routine(?:_?name)?)$/i);
      for (const [k, v] of Object.entries(node)) if (typeof v === 'object') walk(v, typeof title === 'string' && Array.isArray(v) ? title : label ?? (k !== 'exercises' && Number.isNaN(Number(k)) && Array.isArray(v) ? null : label));
    }
  };
  walk(data, null);
  return sections.length ? sections : null;
}

// ---------- Plain text ----------

const kindOf = name => (WARMUP.test(name) ? 'warmup' : COOLDOWN.test(name) ? 'cooldown' : DAY.test(name) ? 'day' : PART.test(name) ? 'part' : 'day');
const wordsIn = s => s.split(/\s+/).filter(w => /[a-z]/i.test(w)).length;

function isHeading(raw, next) {
  const t = raw.trim();
  if (/^#{1,6}\s/.test(t)) return true;
  if (/^\*\*[^*]+\*\*:?$|^__[^_]+__:?$/.test(t)) return true;
  if (SET_LINE.test(t) || DATE_LINE.test(t)) return false;
  const bare = t.replace(BULLET, '');
  const { dose } = readNumbers(bare);
  if (dose && !/^(?:day|week)\s*\d+\s*:?$/i.test(bare) && !/^\d+\s*rounds?/i.test(bare)) return false;
  if (/:\s*$/.test(t) && wordsIn(t) <= 6) return true;
  if (BULLET.test(raw) && !/^\s*#/.test(raw)) return false;
  if (DAY.test(bare) && wordsIn(bare) <= 6) return true;
  if ((WARMUP.test(bare) || COOLDOWN.test(bare) || PART.test(bare)) && wordsIn(bare) <= 4 && !/\b(?:stretch|hold)\b.+/i.test(bare.replace(COOLDOWN, ''))) return true;
  if (t === t.toUpperCase() && /[A-Z]{3}/.test(t) && wordsIn(t) <= 5) return true;
  return false;
}
const headingText = t => t.trim().replace(/^#{1,6}\s*/, '').replace(/^\*\*|\*\*:?$|^__|__:?$/g, '').replace(/:\s*$/, '').replace(/^[-–—=\s]+|[-–—=\s]+$/g, '').trim();

/** A line that's prose (a sentence of advice, an intro, a sign-off) rather than a move. */
function isProse(t) {
  if (GREETING.test(t) || NOTE_LINE.test(t) || /https?:\/\/|www\.|^@\w/i.test(t) || /^[-=_*~]{3,}$/.test(t)) return true;
  if (DATE_LINE.test(t) && !readNumbers(t.replace(DATE_LINE, ' ').replace(/\b(?:19|20)\d{2}\b|\b\d{1,2}(?::\d{2})?\s*(?:am|pm)\b/gi, ' ')).dose) return true;
  if (/^(?:from|to|sent|date|subject|cc):\s/i.test(t)) return true;
  const { dose } = readNumbers(t);
  const words = wordsIn(t);
  if (dose) return words > 14;
  return words > 7 || /[.!?]$/.test(t) && words > 4;
}

/** Plain text to sections of moves. */
export function readText(text) {
  const lines = text.replace(/\r/g, '').replace(/\u2028|\u2029/g, '\n').split('\n');
  const sections = [];
  let title = null, current = null, last = null, gap = false;
  const start = name => { current = { name, items: [] }; sections.push(current); last = null; };
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i], t = raw.trim();
    if (!t) { gap = true; continue; }
    // Everything after "Thanks," is a signature
    if (SIGN_OFF.test(t) && (current?.items.length || sections.length)) break;
    // Sets listed under a move (shared from a workout app)
    if (SET_LINE.test(t) && last) { (last.sets ??= []).push(readSet(t)); continue; }
    if (isHeading(raw, lines[i + 1])) {
      const name = headingText(raw);
      if (!name) continue;
      // The first heading names the whole routine when it's not a day or part of one
      if (!title && !sections.length && !current && kindOf(name) === 'day' && !DAY.test(name) && !/workout\s*[a-z0-9]$/i.test(name)) { title = name; continue; }
      start(name);
      continue;
    }
    // Several moves on one line: "Squats 3x10, lunges 3x12, plank 30s"
    const parts = t.split(/\s*[,;]\s*(?=[a-z])/i).filter(Boolean);
    const many = parts.length > 1 && parts.filter(p => readNumbers(p).dose && /[a-z]{3}/i.test(readNumbers(p).rest)).length >= 2;
    for (const part of many ? parts : [t]) {
      const line = part.replace(BULLET, '');
      if (!line || isProse(line)) continue;
      let { dose, extra, rest } = readNumbers(line);
      // "with a 24kg kettlebell": the kit goes with the weight
      const kit = rest.match(/\s(?:w\/|with)\s+(?:a\s+|an\s+|two\s+|2\s+)?((?:pair of\s+)?(?:kettlebells?|dumbbells?|barbell|band|plate|bench|box|ball|kb|db|bb))\b/i);
      // "20kg DBs": the kit named after the weight
      const after = extra && !kit && rest.match(/\s(dbs?|dumbbells?|kbs?|kettlebells?|bbs?|barbell)\s*$/i);
      if (after) { rest = cut(rest, after); extra += ` ${/^d/i.test(after[1]) ? 'dumbbells' : /^k/i.test(after[1]) ? 'kettlebell' : 'barbell'}`; }
      if (kit) { rest = cut(rest, kit); extra = [extra, tidyName(kit[1]).toLowerCase().replace(/^kb$/, 'kettlebell').replace(/^db$/, 'dumbbell').replace(/^bb$/, 'barbell')].filter(Boolean).join(' '); }
      const name = tidyName(rest.replace(/\b(?:reps?|sets?|of|each|x|×|steps?)\b|\s(?:w\/|with)\s*$/gi, ' '));
      if (NOT_A_MOVE.test(name.trim())) continue;
      // A line with just a target ("3x10") belongs to the move above
      if (!/[a-z]{2}/i.test(name)) { if (last && dose && !last.dose) { last.dose = dose; if (extra && !last.extra) last.extra = extra; } continue; }
      // The first plain line, with moves after it, can name the routine ("Morning mobility")
      const next = lines.slice(i + 1).find(l => l.trim()) ?? '';
      const nextIsTarget = !/[a-z]{3}/i.test(readNumbers(next.replace(BULLET, '')).rest.replace(/\b(?:reps?|sets?|of|each|x|seconds?|secs?|mins?|minutes?)\b/gi, ''));
      if (!title && !sections.length && !dose && !extra && !BULLET.test(raw) && !nextIsTarget && lines.slice(i + 1).some(l => readNumbers(l).dose) && wordsIn(name) <= 5 && !/^\s*[a-z]/.test(raw) && i === lines.findIndex(l => l.trim())) { title = headingText(raw); continue; }
      if (!current) start(null);
      last = { name, dose, extra };
      // Moves after a blank line start a new block, which may be a day of its own (see readRoutine)
      if (gap && current.items.length) last.block = true;
      gap = false;
      current.items.push(last);
    }
  }
  for (const s of sections) for (const it of s.items) if (it.sets) { const read = fromSets(it.sets.filter(Boolean)); it.dose ||= read.dose; it.extra ||= read.extra; delete it.sets; }
  const filled = sections.filter(s => s.items.length);
  // One heading over everything ("Morning stretches", "Core circuit") names the routine
  if (!title && filled.length === 1 && filled[0].name) title = filled[0].name;
  return filled.length ? { title, sections: filled } : null;
}

// ---------- Putting it together ----------

/**
 * Sections in order: parts of one session (warm-up, main, cool-down) run together, a warm-up first and
 * a cool-down last; separate days stay separate, as variations.
 */
export function arrange(sections) {
  const days = [];
  let day = null;
  for (const s of sections) {
    const kind = s.name ? kindOf(s.name) : 'part';
    if (kind === 'day' || !day) { day = { name: kind === 'day' ? s.name : null, parts: [] }; days.push(day); }
    day.parts.push({ kind, items: s.items });
    // A warm-up or cool-down written before the first day goes with every day
  }
  // Warm-ups or cool-downs on their own (before or after all the days) are shared by every day
  const shared = days.length > 1 ? days.filter(d => !d.name && d.parts.every(p => p.kind !== 'part' || !p.items.length)) : [];
  const real = days.filter(d => !shared.includes(d));
  const order = { warmup: 0, part: 1, day: 1, cooldown: 2 };
  return real.map(d => {
    const parts = [...shared.flatMap(x => x.parts.filter(p => p.kind === 'warmup')), ...d.parts, ...shared.flatMap(x => x.parts.filter(p => p.kind === 'cooldown'))];
    const items = parts.map((p, i) => [p, i]).sort(([a, i], [b, j]) => order[a.kind] - order[b.kind] || i - j).flatMap(([p]) => p.items);
    return { name: d.name, items: dedupe(items) };
  }).filter(d => d.items.length);
}

/** The same move twice in a row (sets written out one per line) becomes one. */
function dedupe(items) {
  const out = [];
  for (const it of items) {
    const prev = out.at(-1);
    if (prev && prev.name.toLowerCase() === it.name.toLowerCase() && prev.dose === it.dose && prev.extra === it.extra) continue;
    out.push({ name: it.name, dose: it.dose ?? '', ...(it.extra ? { extra: it.extra } : {}) });
  }
  return out;
}

/**
 * Anything pasted or opened, as text, to { title, days: [{ name, items: [{ name, dose, extra? }] }] }, or
 * null when no moves can be found. fileName helps tell a format apart.
 */
export function readRoutine(input, { fileName = '' } = {}) {
  let text = String(input ?? '').replace(/^﻿/, '');
  if (!text.trim()) return null;
  let title = null;
  // An email with its headers
  if (/\.eml$/i.test(fileName) || /^(?:(?:return-path|received|from|to|subject|date|mime-version|message-id|content-type):.*\n){2,}/im.test(text.slice(0, 2000)) && /^subject:/im.test(text)) {
    const mail = readEmail(text);
    title = mail.subject || null;
    text = mail.body;
  }
  if (/\.rtf$/i.test(fileName) || /^\{\\rtf/.test(text)) text = rtfToText(text);
  if (/\.html?$/i.test(fileName) || /<(?:html|body|div|p|li|table|br)\b/i.test(text)) text = htmlToText(text);
  // Quoted replies and signatures in a pasted email
  text = text.replace(/^>.*$/gm, '').replace(/\n-- \n[\s\S]*$/, '');
  // Pasted from code (a routine kept in a script): its wrapping lines and quotes go, the text stays
  if (/^\s*(?:export\s+default|module\.exports|const\s+\w+\s*=)|^\s*[\w$]+\s*:\s*`/m.test(text)) {
    text = text.split('\n')
      .filter(l => !/^\s*(?:export\s+default|module\.exports|import\s|const\s|let\s|var\s|function\s)|^\s*[{}[\]();,`]+\s*$|\{\s*$/.test(l))
      .map(l => l.replace(/^\s*[\w$]+\s*:\s*`/, '').replace(/`\s*[,;]?\s*$/, ''))
      .join('\n');
  }

  let sections = null;
  if (/^\s*[[{]/.test(text)) {
    try {
      const data = JSON.parse(text);
      sections = readJSON(data);
      title ??= typeof data?.name === 'string' ? data.name : typeof data?.title === 'string' ? data.title : null;
    } catch { /* not JSON after all */ }
  }
  const lines = text.split('\n').filter(l => l.trim());
  if (!sections && lines.length >= 2) {
    const delimited = lines.filter(l => (l.match(/,/g)?.length ?? 0) >= 2 || l.includes('\t') || (l.match(/\|/g)?.length ?? 0) >= 2).length >= lines.length * 0.7;
    const firstRow = lines.findIndex(l => (l.match(/,/g)?.length ?? 0) >= 2 || l.includes('\t') || (l.match(/\|/g)?.length ?? 0) >= 2);
    const above = firstRow > 0 ? lines.slice(0, firstRow) : [];
    const tabular = firstRow >= 0 && lines.slice(firstRow).filter(l => (l.match(/,/g)?.length ?? 0) >= 2 || l.includes('\t') || (l.match(/\|/g)?.length ?? 0) >= 2).length >= (lines.length - firstRow) * 0.7;
    if (delimited || tabular || /\.(?:csv|tsv)$/i.test(fileName)) {
      sections = readTable(tableRows(lines.slice(Math.max(0, firstRow)).join('\n')));
      if (sections && above.length && wordsIn(above[0]) <= 6) title ??= headingText(above[0]);
    }
  }
  if (!sections) {
    const read = readText(text);
    if (read) { sections = read.sections; title ??= read.title; }
  }
  if (!sections) return null;
  let days = arrange(sections).map(d => ({ ...d, name: d.name ? tidyName(d.name).slice(0, 40) : null }));
  if (!days.length) return null;
  // No headings, but blocks split by blank lines that are clearly different days (push, legs, pull)
  const plain = sections.length === 1 && !sections[0].name && sections[0].items;
  if (plain && plain.some(it => it.block)) {
    const blocks = [];
    for (const it of plain) { if (it.block || !blocks.length) blocks.push([]); blocks.at(-1).push(it); }
    const guesses = blocks.map(b => (b.length >= 2 ? nameForMoves(b) : null));
    // Only training days split this way: a stretch with a blank line in it stays one routine
    const dayLike = /^(?:push|pull|legs(?: and core)?|upper body|lower body|full body(?: strength)?)$/i;
    if (blocks.length >= 2 && guesses.every((g, i) => g && dayLike.test(g) && guesses.indexOf(g) === i)) days = blocks.map(b => ({ name: null, items: dedupe(b) }));
  }
  return { title: title ? tidyName(title).slice(0, 60) : null, days };
}
