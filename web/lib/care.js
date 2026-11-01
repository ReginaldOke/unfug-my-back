// When to suggest seeing a doctor: pain that stays high, or notes mentioning a warning sign. Pure,
// unit-tested in test/care.test.js. It suggests; it never assesses or diagnoses.

export const HIGH_PAIN = 7;
const RUN = 3; // this many check-ins in a row
const NOTE_DAYS = 14;

// [what to look for, what to call it, urgent?]. The urgent ones are the recognised red flags for back pain.
const WARNINGS = [
  [/\b(groin|saddle|genital)\b/, 'numbness or changes around your groin', true],
  [/\b(bladder|incontinen\w*|wet myself|can(no|')?t (pee|urinate)|trouble (peeing|urinating))\b/, 'changes in your bladder', true],
  [/\b(bowel|poo(ed)? myself|lost control)\b/, 'changes in your bowel control', true],
  [/\b(leg|legs|foot|feet) (is |are |feel |feels |going |gone |giving )?(weak|numb|dead|out|way)\b|\bweak (leg|legs|foot|feet)\b|\bfoot drop\b|\bweakness\b/, 'weakness in your legs', true],
  [/\bcan(no|')?t (walk|stand|move)\b/, 'trouble walking or standing', true],
  [/\bboth legs\b/, 'symptoms in both legs', true],
  [/\bchest pain\b/, 'chest pain', true],
  [/\bnumb(ness)?\b|\btingl\w*\b|pins and needles/, 'numbness or tingling', false],
  [/\bfever\b|\bchills\b|\bnight sweats?\b/, 'fever or night sweats', false],
  [/\bweight loss\b|\blost weight\b/, 'unexplained weight loss', false],
  [/\bcancer\b|\btumou?r\b/, 'a history of cancer', false],
  [/\b(fell|fall|fallen|accident|crash|injured|injury)\b/, 'a fall or injury', false],
  [/\b(unbearable|excruciating|agony|worst pain)\b/, 'severe pain', false],
];
const NEGATED = /\b(no|not|without|never|isn't|hasn't|don't|didn't|zero)\s+(\w+\s+){0,2}$/;

/** Warning signs mentioned in some text, ignoring "no numbness" and the like. */
export function warningsIn(text) {
  const t = String(text ?? '').toLowerCase().replace(/’/g, "'");
  return WARNINGS.flatMap(([re, label, urgent]) => {
    const m = t.match(re);
    return m && !NEGATED.test(t.slice(0, m.index)) ? [{ label, urgent }] : [];
  });
}

/**
 * The one thing to raise right now, or null: { key, title, body, urgent }. Most urgent first; notes from
 * the last two weeks, then pain at 7 or above on the last three check-ins. Keys stay the same for the same
 * mention or run of days, so dismissing one stays dismissed.
 */
export function careNotice(entries, today, dismissed = {}) {
  const sorted = [...entries].sort((a, b) => b.date.localeCompare(a.date));
  const since = new Date(`${today}T12:00:00`);
  since.setDate(since.getDate() - NOTE_DAYS);
  const recent = sorted.filter(e => new Date(`${e.date}T12:00:00`) >= since);
  const found = recent.flatMap(e => warningsIn(e.notes).map(w => ({ ...w, key: `note:${e.date}:${w.label}` })));
  const urgent = found.find(w => w.urgent && !dismissed[w.key]);
  if (urgent) {
    return { key: urgent.key, urgent: true, title: 'Get this checked promptly', body: `Your notes mention ${urgent.label}. If this is new or getting worse, see a doctor straight away or call emergency services.` };
  }
  const run = sorted.slice(0, RUN);
  if (run.length === RUN && run.every(e => e.painScore >= HIGH_PAIN) && recent.includes(run[0])) {
    // Named by where this run of high days began, so it isn't raised afresh every day
    let start = RUN - 1;
    while (sorted[start + 1]?.painScore >= HIGH_PAIN) start++;
    const key = `pain:${sorted[start].date}`;
    if (!dismissed[key]) return { key, urgent: false, title: 'Worth seeing a doctor', body: `Your pain has been ${HIGH_PAIN} or higher at your last ${RUN} check-ins. A doctor or physio can look into it with you.` };
  }
  const note = found.find(w => !w.urgent && !dismissed[w.key]);
  return note ? { key: note.key, urgent: false, title: 'Worth mentioning to a doctor', body: `Your notes mention ${note.label}. If it's new or worrying you, check with a doctor.` } : null;
}
