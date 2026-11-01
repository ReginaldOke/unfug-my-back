// Reading other people's data: a workout written as notes, a workout log or daily tracker from another
// app (CSV), or our own export. Each reader returns a diary fragment in the export's shape, so it goes
// through the same merge and preview as an export (import.js). Pure, unit-tested in test/interpret.test.js.
// Everything runs on the phone; nothing is sent anywhere to be read.

const newId = () => globalThis.crypto?.randomUUID?.() ?? `id-${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
const fragment = () => ({ factors: [], routines: [], dailyEntries: [], painMarkers: [], factorLogs: [], factorChanges: [], flares: [], routineCompletions: [], routineChanges: [], healthDays: [] });
const titleCase = s => s.charAt(0).toUpperCase() + s.slice(1);
const routine = (fields, items) => ({ id: newId(), measure: 'effort', schedule: [], linkedFactorId: null, isArchived: false, ...fields, items });

// ---------- Workouts written as text (a note, a message, a list) ----------

// "3x8", "3 × 8", "4 sets of 10", "10 reps", "30 s", "2 min", "x 6 each side"
const DOSE = /(\d+\s*[x×]\s*\d+|\b[x×]\s*\d+|\d+\s*sets?\b|\d+\s*(?:reps?|rounds?|s|secs?|seconds?|mins?|minutes?)\b)/i;
// "60kg", "135 lb", "@ 20 kg", "bodyweight"
const WEIGHT = /@?\s*(\d+(?:\.\d+)?\s*(?:kg|kgs|lb|lbs|pounds?)\b|bodyweight|bw\b)/i;
const SECTION_WORDS = /^(day\s*\d+|week\s*\d+|push|pull|legs?|upper|lower|full\s*body|chest|back|arms|shoulders|core|cardio|warm[\s-]?up|cool[\s-]?down|mobility|stretch(?:ing)?|workout\s*[a-z0-9]?|session\s*[a-z0-9]?|[a-z]+\s+day)\b/i;

/** Splits one line into a move: { name, dose, extra }, or null for a blank line. */
function moveFrom(line) {
  let text = line.replace(/^\s*(?:[-*•–]|\d+[.)]|\[[ x]\])\s*/i, '').trim();
  if (!text) return null;
  const weight = text.match(WEIGHT);
  if (weight) text = (text.slice(0, weight.index) + text.slice(weight.index + weight[0].length)).trim();
  const dose = text.match(DOSE);
  const name = (dose ? text.slice(0, dose.index) : text).replace(/[\s:,–-]+$/, '').trim();
  return { name: titleCase(name || text), dose: dose ? text.slice(dose.index).replace(/^[\s:,–-]+/, '').trim() : '', extra: weight ? weight[1].replace(/\s+/g, ' ').trim() : '' };
}

const isHeading = (line, next) => {
  const t = line.trim();
  if (/^#{1,6}\s/.test(t) || /:\s*$/.test(t)) return true;
  if (DOSE.test(t) || WEIGHT.test(t) || /^\s*(?:[-*•–]|\d+[.)]|\[[ x]\])\s/.test(line)) return false;
  return SECTION_WORDS.test(t) || (t === t.toUpperCase() && /[A-Z]/.test(t)) || (next !== undefined && next.trim() === '');
};
const cleanHeading = t => titleCase(t.replace(/^#{1,6}\s*/, '').replace(/:\s*$/, '').trim());

/**
 * Reads a workout written in plain text into routines. Headings ("Push:", "Day 1", "## Legs") become
 * variations of one routine named by the first line (or "Imported workout"); lines under them become moves,
 * with sets and reps as the target and any weight in the extra box.
 */
export function readWorkoutText(text) {
  const lines = text.replace(/\r/g, '').split('\n');
  const sections = [];
  let title = null, current = null;
  const plain = l => !DOSE.test(l) && !WEIGHT.test(l) && !/^\s*(?:[-*•–]|\d+[.)]|\[[ x]\])\s/.test(l);
  lines.forEach((line, i) => {
    if (!line.trim()) return;
    // A first line with no sets or reps, with more after it, names the whole thing
    if (!title && !sections.length && plain(line) && lines.slice(i + 1).some(l => l.trim())) { title = cleanHeading(line); return; }
    if (isHeading(line, lines[i + 1])) {
      // The very first heading is the routine's name when another heading or a plain list follows it
      if (!title && !sections.length && !current) { title = cleanHeading(line); return; }
      current = { name: cleanHeading(line), items: [] };
      sections.push(current);
      return;
    }
    const move = moveFrom(line);
    if (!move?.name) return;
    if (!current) { current = { name: null, items: [] }; sections.push(current); }
    current.items.push(move);
  });
  const filled = sections.filter(s => s.items.length);
  if (!filled.length) return null;
  // A weight in the note starts off the move's second box (the routine page fills it in)
  const items = list => list.map(({ extra, ...m }) => (extra ? { ...m, extra } : m));
  const out = fragment();
  if (filled.length === 1) {
    const name = filled[0].name ?? title ?? 'Imported workout';
    const group = filled[0].name && title ? title : null;
    out.routines.push(routine(group ? { group, name, groupOrder: 0 } : { name }, items(filled[0].items)));
  } else {
    const group = title ?? 'Imported workout';
    filled.forEach((s, i) => out.routines.push(routine({ group, name: s.name ?? `Day ${i + 1}`, groupOrder: i }, items(s.items))));
  }
  return out;
}

// ---------- CSV from another app ----------

/** CSV (or tab-separated) text to rows of strings; quoted fields may hold commas and newlines. */
export function parseCSV(text) {
  const sep = (text.split('\n')[0].match(/\t/g)?.length ?? 0) > (text.split('\n')[0].match(/,/g)?.length ?? 0) ? '\t' : text.split('\n')[0].includes(';') && !text.split('\n')[0].includes(',') ? ';' : ',';
  const rows = [];
  let row = [], field = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; } else if (c === '"') quoted = false; else field += c;
    } else if (c === '"') quoted = true;
    else if (c === sep) { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(field); rows.push(row); row = []; field = ''; }
    else field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows.filter(r => r.some(x => x.trim()));
}

/** "2026-10-29", "29/10/2026", "10/29/2026", "2026-10-29 07:12:00", "Oct 29, 2026" → "2026-10-29", or null. */
export function toDate(s) {
  const t = String(s ?? '').trim();
  let m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  m = t.match(/^(\d{1,2})[/.](\d{1,2})[/.](\d{2,4})/);
  if (m) {
    const y = m[3].length === 2 ? `20${m[3]}` : m[3];
    // Day first unless that's impossible (UK and most of the world; US files show it with a day over 12)
    const [d, mo] = Number(m[2]) > 12 ? [m[2], m[1]] : [m[1], m[2]];
    return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  const d = new Date(t);
  return Number.isNaN(+d) || !/\d{4}/.test(t) ? null : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const col = (headers, ...patterns) => headers.findIndex(h => patterns.some(p => p.test(h)));
const num = s => { const v = parseFloat(String(s).replace(',', '.')); return Number.isFinite(v) ? v : null; };
const median = xs => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : null; };

/** A set-by-set workout log (Strong, Hevy, FitNotes and the like): routines from its workouts, sessions from its days. */
function readWorkoutLog(rows, headers) {
  const iDate = col(headers, /date|start_time|start time/), iEx = col(headers, /exercise/), iWorkout = col(headers, /workout|^title$|routine/);
  const iReps = col(headers, /^reps$|reps/), iWeight = col(headers, /weight/), iUnit = col(headers, /unit/);
  const unit = iUnit >= 0 ? rows[0]?.[iUnit] : /lb/.test(headers[iWeight] ?? '') ? 'lb' : 'kg';
  const workouts = new Map(); // name -> { exercises: Map(name -> { sets by day, reps[], weight }), days: Set }
  for (const r of rows) {
    const date = toDate(r[iDate]), ex = r[iEx]?.trim();
    if (!date || !ex) continue;
    const wName = (iWorkout >= 0 && r[iWorkout]?.trim()) || 'Workout';
    const w = workouts.get(wName) ?? workouts.set(wName, { exercises: new Map(), days: new Set() }).get(wName);
    w.days.add(date);
    const e = w.exercises.get(ex) ?? w.exercises.set(ex, { sets: new Map(), reps: [], weight: null, lastDay: '' }).get(ex);
    e.sets.set(date, (e.sets.get(date) ?? 0) + 1);
    const reps = num(r[iReps]);
    if (reps) e.reps.push(reps);
    const weight = num(r[iWeight]);
    if (weight && date >= e.lastDay) { e.weight = weight; e.lastDay = date; }
  }
  if (!workouts.size) return null;
  const out = fragment();
  const many = workouts.size > 1;
  [...workouts].forEach(([wName, w], i) => {
    const items = [...w.exercises].map(([name, e]) => {
      const sets = median([...e.sets.values()]), reps = median(e.reps);
      return { name, dose: sets && reps ? `${sets} × ${Math.round(reps)}` : reps ? `× ${Math.round(reps)}` : '' };
    });
    const r = routine(many ? { group: 'Imported workouts', name: wName, groupOrder: i } : { name: wName }, items);
    out.routines.push(r);
    for (const day of w.days) {
      out.routineCompletions.push({
        id: newId(), routineId: r.id, date: day, timestamp: new Date(`${day}T12:00:00`).toISOString(), completed: true, intensity: null, times: null,
        log: [...w.exercises].filter(([, e]) => e.sets.has(day)).map(([name, e]) => ({ name, did: `${e.sets.get(day)} sets`, ...(e.weight && e.lastDay === day ? { extra: `${e.weight} ${unit}` } : {}) })),
      });
    }
  });
  return out;
}

/**
 * A daily tracker (one row a day): pain, stress and sleep go into check-ins, steps and hours slept into
 * Apple Health days, and every other column with numbers or yes/no becomes something you track.
 */
function readDailyTracker(rows, headers) {
  const iDate = col(headers, /date|day/);
  if (iDate < 0) return null;
  const iPain = col(headers, /pain/), iStress = col(headers, /stress|anxiety/), iSleepQ = col(headers, /sleep\s*(quality|score|rating)|^sleep$/);
  const iSteps = col(headers, /steps/), iSleepH = col(headers, /sleep.*(hours|hrs|duration|time)|hours.*slept|time in bed/);
  const used = new Set([iDate, iPain, iStress, iSleepQ, iSteps, iSleepH]);
  const yes = v => /^(yes|y|true|1|✓|x)$/i.test(String(v).trim());
  const no = v => /^(no|n|false|0|)$/i.test(String(v).trim());
  // A 0–100 or 1–5 column is put on the app's 0–10 scale
  const scaler = i => {
    const vals = rows.map(r => num(r[i])).filter(v => v != null);
    const max = Math.max(...vals);
    return v => (v == null ? null : Math.round(max > 10 ? v / 10 : max <= 5 && Math.min(...vals) >= 1 ? (v - 1) * 2.5 : v));
  };
  const out = fragment();
  const pain = iPain >= 0 ? scaler(iPain) : null, stress = iStress >= 0 ? scaler(iStress) : null, sleepQ = iSleepQ >= 0 ? scaler(iSleepQ) : null;
  const extras = headers.map((h, i) => i).filter(i => !used.has(i) && headers[i]).flatMap(i => {
    const vals = rows.map(r => r[i]).filter(v => String(v ?? '').trim() !== '');
    if (!vals.length) return [];
    const isYesNo = vals.every(v => yes(v) || no(v));
    const isNum = vals.every(v => num(v) != null);
    if (!isYesNo && !isNum) return [];
    const name = titleCase(headers[i].replace(/[_-]+/g, ' ').trim());
    const minutes = /min|minutes|duration|time/i.test(headers[i]);
    const f = { id: newId(), name, role: /pain|stress|sitting|screen|drive|driving|lift/i.test(name) ? 'trigger' : 'unsure', measureType: isYesNo ? 'yesno' : minutes ? 'minutes' : 'count', unit: isYesNo ? '' : minutes ? 'min' : '', category: 'activity', status: 'suspected', isArchived: false, source: 'import' };
    out.factors.push(f);
    return [{ i, f, isYesNo }];
  });
  for (const r of rows) {
    const date = toDate(r[iDate]);
    if (!date) continue;
    const p = pain?.(num(r[iPain]));
    if (p != null) {
      const s = stress?.(num(r[iStress])) ?? null, q = sleepQ?.(num(r[iSleepQ])) ?? null;
      out.dailyEntries.push({ id: newId(), date, painScore: Math.max(0, Math.min(10, p)), stressScore: s == null ? null : Math.max(0, Math.min(10, s)), sleepQuality: q == null ? null : Math.max(0, Math.min(10, q)), notes: '', completedAt: new Date(`${date}T21:00:00`).toISOString() });
    }
    const steps = iSteps >= 0 ? num(r[iSteps]) : null, hours = iSleepH >= 0 ? num(r[iSleepH]) : null;
    if (steps != null || hours != null) out.healthDays.push({ id: newId(), date, ...(steps != null ? { steps: Math.round(steps) } : {}), ...(hours != null ? { sleepHours: hours > 24 ? Math.round(hours / 6) / 10 : hours } : {}), source: 'import' });
    for (const { i, f, isYesNo } of extras) {
      const v = isYesNo ? (yes(r[i]) ? 1 : 0) : num(r[i]);
      if (v) out.factorLogs.push({ id: newId(), factorId: f.id, date, timestamp: null, value: v, source: 'manual', dailyEntryId: null, intensity: null });
    }
  }
  return out.dailyEntries.length || out.healthDays.length || out.factorLogs.length ? out : null;
}

/** Reads CSV text from another app: a workout log if it has exercises, otherwise a daily tracker. */
export function readCSV(text) {
  const rows = parseCSV(text);
  if (rows.length < 2) return null;
  const headers = rows[0].map(h => h.trim().toLowerCase());
  const body = rows.slice(1);
  return col(headers, /exercise/) >= 0 ? readWorkoutLog(body, headers) : readDailyTracker(body, headers);
}
