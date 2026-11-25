// On-device per-factor analysis. Pure functions, unit-tested in test/analysis.test.js.
// Results are associations between a factor and pain, never causes.

import { addDays, localDate, fmtMinutes, daysBetween } from './dates.js';
import { sleepWord } from './labels.js';

export const MIN_DAYS = 5; // days with AND days without, before a result counts as an established pattern
export const EARLY_MIN_DAYS = 2; // enough to show an "early sign" from the first few check-ins
export const LAGS = [0, 1, 2];

const mean = xs => xs.reduce((a, b) => a + b, 0) / xs.length;
const sd = xs => { const m = mean(xs); return Math.sqrt(xs.reduce((a, x) => a + (x - m) ** 2, 0) / Math.max(1, xs.length - 1)); };

/** date -> pain score, from check-ins that have one. */
export function painByDate(entries) {
  const m = new Map();
  for (const e of entries) if (e.painScore != null) m.set(e.date, e.painScore);
  return m;
}

/** date -> total amount of one factor. Days with a check-in but no log count as "without". */
export function amountsByDate(logs, factorId) {
  const m = new Map();
  for (const l of logs) if (l.factorId === factorId) m.set(l.date, (m.get(l.date) || 0) + Number(l.value));
  return m;
}

/**
 * Mean pain on days after the factor occurred vs days after it didn't.
 * lag 0 = same day, 1 = next day, 2 = two days later. Only days with a check-in on the factor day
 * count, so a missing check-in isn't mistaken for "didn't happen".
 */
export function lagComparison(pain, amounts, checkinDates, lag, minDays = MIN_DAYS) {
  const withP = [], withoutP = [];
  for (const d of checkinDates) {
    const p = pain.get(addDays(d, lag));
    if (p == null) continue;
    ((amounts.get(d) || 0) > 0 ? withP : withoutP).push(p);
  }
  const enough = withP.length >= minDays && withoutP.length >= minDays;
  const result = {
    lag, nWith: withP.length, nWithout: withoutP.length, enough,
    needWith: Math.max(0, MIN_DAYS - withP.length), needWithout: Math.max(0, MIN_DAYS - withoutP.length),
  };
  if (!enough) return result;
  const meanWith = mean(withP), meanWithout = mean(withoutP);
  const delta = meanWith - meanWithout;
  const pooled = Math.sqrt((sd(withP) ** 2 + sd(withoutP) ** 2) / 2) || 1;
  return { ...result, meanWith, meanWithout, delta, effect: delta / pooled, confidence: confidence(withP.length, withoutP.length, delta / pooled) };
}

/** Rough label from sample size and standardised effect size. Not a significance test. */
export function confidence(nWith, nWithout, effect) {
  const n = Math.min(nWith, nWithout), e = Math.abs(effect);
  if (n >= 15 && e >= 0.8) return 'high';
  if (n >= 8 && e >= 0.5) return 'medium';
  return 'low';
}

/** Pain by amount bucket for minutes / count factors: none, then thirds of the non-zero amounts. */
export function doseResponse(pain, amounts, checkinDates, lag = 0) {
  const rows = checkinDates.map(d => ({ a: amounts.get(d) || 0, p: pain.get(addDays(d, lag)) })).filter(r => r.p != null);
  const nonZero = rows.filter(r => r.a > 0).map(r => r.a).sort((a, b) => a - b);
  if (nonZero.length < 3) return [];
  const q1 = nonZero[Math.floor(nonZero.length / 3)], q2 = nonZero[Math.floor((2 * nonZero.length) / 3)];
  const buckets = [
    { label: 'None', test: a => a === 0 },
    { label: 'Low', test: a => a > 0 && a < q1, max: q1 },
    { label: 'Medium', test: a => a >= q1 && a < q2, min: q1, max: q2 },
    { label: 'High', test: a => a >= q2, min: q2 },
  ];
  return buckets.map(b => {
    const ps = rows.filter(r => b.test(r.a)).map(r => r.p);
    return { label: b.label, min: b.min, max: b.max, n: ps.length, meanPain: ps.length ? mean(ps) : null };
  });
}

export const FLARE_PAIN = 5; // a check-in at this pain or more counts as a flare day

/**
 * Flares: any day with pain at FLARE_PAIN or more, plus any flare logged on its own. Days in a row
 * make one flare, as { start, end, days, peakPain }, oldest first.
 */
export function flareEpisodes(entries, logged = []) {
  const peak = new Map();
  for (const e of entries) if (e.painScore >= FLARE_PAIN) peak.set(e.date, Math.max(peak.get(e.date) ?? 0, e.painScore));
  for (const f of logged) { const d = localDate(new Date(f.timestamp)); peak.set(d, Math.max(peak.get(d) ?? 0, f.intensity ?? FLARE_PAIN)); }
  const out = [];
  for (const d of [...peak.keys()].sort()) {
    const last = out.at(-1);
    if (last && addDays(last.end, 1) === d) { last.end = d; last.days++; last.peakPain = Math.max(last.peakPain, peak.get(d)); }
    else out.push({ start: d, end: d, days: 1, peakPain: peak.get(d) });
  }
  return out;
}

/** Share of flares that had the factor logged within the 24 hours before (same or previous calendar day). */
export function flareAssociation(flares, amounts) {
  if (!flares.length) return null;
  // Each flare counts once, from the day it started
  const hits = flares.filter(f => {
    const d = f.start;
    return (amounts.get(d) || 0) > 0 || (amounts.get(addDays(d, -1)) || 0) > 0;
  }).length;
  return { hits, total: flares.length };
}

/** How many of the last `days` days a helper was done. */
export function consistency(amounts, today, days = 14) {
  let done = 0;
  for (let i = 0; i < days; i++) if ((amounts.get(addDays(today, -i)) || 0) > 0) done++;
  return { done, days };
}

/**
 * How closely something rises and falls with pain, from -1 to 1 (Pearson's r over days with a check-in
 * and a value), or null with fewer than five such days or nothing changing. value(date) → number or null.
 */
export function painLink(entries, value) {
  const pairs = entries.filter(e => e.painScore != null).map(e => [value(e.date), e.painScore]).filter(([v]) => v != null && Number.isFinite(v));
  if (pairs.length < 5) return null;
  const mx = mean(pairs.map(p => p[0])), my = mean(pairs.map(p => p[1]));
  let sxy = 0, sxx = 0, syy = 0;
  for (const [x, y] of pairs) { sxy += (x - mx) * (y - my); sxx += (x - mx) ** 2; syy += (y - my) ** 2; }
  return sxx && syy ? sxy / Math.sqrt(sxx * syy) : null;
}

/** Full analysis for one factor. */
export function analyseFactor(factor, data, today = localDate(), minDays = MIN_DAYS) {
  const pain = painByDate(data.dailyEntries);
  const checkinDates = data.dailyEntries.map(e => e.date);
  const amounts = amountsByDate(data.factorLogs, factor.id);
  const lags = LAGS.map(lag => lagComparison(pain, amounts, checkinDates, lag, minDays));
  const usable = lags.filter(l => l.enough);
  // Headline: the lag with the largest standardised effect in the direction the role expects (or either for unsure)
  const sign = factor.role === 'helper' ? -1 : factor.role === 'trigger' ? 1 : 0;
  const best = usable.length
    ? usable.reduce((a, b) => (score(b, sign) > score(a, sign) ? b : a))
    : null;
  return {
    factor, lags, best, early: !!best && (best.nWith < MIN_DAYS || best.nWithout < MIN_DAYS),
    dose: ['minutes', 'count'].includes(factor.measureType) ? doseResponse(pain, amounts, checkinDates, best?.lag ?? 0) : [],
    flares: flareAssociation(flareEpisodes(data.dailyEntries, data.flares ?? []), amounts),
    consistency: consistency(amounts, today),
    daysLogged: amounts.size,
  };
}

const score = (l, sign) => (sign === 0 ? Math.abs(l.effect) : sign * l.effect);

/**
 * Insights for the dashboard, ranked by how strongly pain differs. Established patterns come first;
 * "early" ones (EARLY_MIN_DAYS with and without) are shown from the first few check-ins and labelled as such.
 */
export function rankInsights(data, factors, today = localDate()) {
  const all = factors.map(f => analyseFactor(f, data, today, EARLY_MIN_DAYS));
  const byStrength = (a, b) => Math.abs(b.best.effect) - Math.abs(a.best.effect);
  const withBest = all.filter(a => a.best && Math.abs(a.best.delta) >= 0.5);
  const ready = [...withBest.filter(a => !a.early).sort(byStrength), ...withBest.filter(a => a.early).sort(byStrength)];
  const pending = all.filter(a => !a.best && a.daysLogged > 0).sort((a, b) => minNeed(a) - minNeed(b));
  return { ready, pending };
}

/** Descriptive picture that works from day one: most frequent stressor and helper in the last two weeks. */
export function quickSummary(data, factors, today = localDate(), days = 14) {
  const since = addDays(today, -(days - 1));
  const stats = factors.map(f => {
    const logs = data.factorLogs.filter(l => l.factorId === f.id && l.date >= since && l.date <= today);
    const dayCount = new Set(logs.map(l => l.date)).size;
    const total = logs.reduce((a, l) => a + Number(l.value), 0);
    return { factor: f, days: dayCount, avg: dayCount ? total / dayCount : 0 };
  }).filter(x => x.days);
  const top = isHelper => stats.filter(x => (x.factor.role === 'helper') === isHelper)
    .sort((a, b) => b.days - a.days || b.avg - a.avg)[0] ?? null;
  const checkins = data.dailyEntries.filter(e => e.date >= since && e.date <= today).length;
  return { mainStressor: top(false), topHelper: top(true), checkins, days };
}

export const minNeed = a => Math.min(...a.lags.map(l => l.needWith + l.needWithout));

// ---------- The one-line summary on Today ----------

export const LINK_MIN = 0.3; // correlation needed before a factor is named in the sentence

function pearson(xs, ys) {
  const mx = mean(xs), my = mean(ys);
  let sxy = 0, sxx = 0, syy = 0;
  xs.forEach((x, i) => { sxy += (x - mx) * (ys[i] - my); sxx += (x - mx) ** 2; syy += (ys[i] - my) ** 2; });
  return sxx && syy ? sxy / Math.sqrt(sxx * syy) : 0;
}

// "Long sitting" reads "long sitting" mid-sentence; names that start with an acronym ("TV time") stay as they are
const midSentence = name => (/^[A-Z][a-z]/.test(name) ? name[0].toLowerCase() + name.slice(1) : name);

/**
 * A plain sentence about what goes with higher and lower pain, from the first check-in on. Returns
 * { parts, basis } where parts mix strings and { b: text } (shown bold), or null with no check-ins.
 * Every candidate (stressors, helpers, sleep, steps) is ranked by how its amount moves with pain across
 * check-in days; the sentence only names a link in the direction the data shows, whatever its role.
 */
export function painSentence(data, factors, today = localDate(), windowDays = 90) {
  const since = addDays(today, -(windowDays - 1));
  const days = data.dailyEntries.filter(e => e.painScore != null && e.date >= since && e.date <= today).sort((a, b) => a.date.localeCompare(b.date));
  const n = days.length;
  if (!n) return null;
  const more = 'Check in more often to see more meaningful trends and correlations.';
  const basis = n === 1 ? more : `Based on ${n} check-ins.${n < 7 ? ` ${more}` : ''}`;
  const logs = data.factorLogs.filter(l => l.date >= since && l.date <= today);
  const amount = (f, date) => logs.filter(l => l.factorId === f.id && l.date === date).reduce((a, l) => a + Number(l.value), 0);

  // One day can't show a trend, so it's set out as the baseline the next days are compared with:
  // pain, the biggest stressor and helper with their amounts, and sleep if it was logged
  if (n === 1) {
    const [e] = days;
    const top = isHelper => factors.filter(f => (f.role === 'helper') === isHelper && amount(f, e.date) > 0)
      .sort((a, b) => amount(b, e.date) - amount(a, e.date))[0];
    const did = [top(false), top(true)].filter(Boolean).map(f => withAmount(f, amount(f, e.date)));
    const slept = e.sleepQuality != null ? sleepWord(e.sleepQuality).toLowerCase() : null;
    return {
      parts: ['Your baseline: pain ', { b: `${e.painScore}/10` },
        ...(did.length ? [' on a day with ', ...joinNames(did)] : []),
        ...(slept ? [`${did.length ? ',' : ''} after sleeping `, { b: slept === 'ok' ? 'OK' : slept === 'great' ? 'really well' : slept }] : []), '.'],
      basis,
    };
  }

  const pain = days.map(e => e.painScore);
  if (pain.every(p => p === pain[0])) {
    return { parts: ['Your pain has been ', { b: `${pain[0]}/10` }, ' every time, so nothing stands out yet.'], basis };
  }

  // Candidates: each factor's daily amount (0 on check-ins without it), plus sleep and steps where known
  const candidates = factors.map(f => ({
    name: midSentence(f.name), yesno: f.measureType === 'yesno',
    pairs: days.map(e => [f.measureType === 'yesno' ? (amount(f, e.date) > 0 ? 1 : 0) : amount(f, e.date), e.painScore]),
  }));
  const health = new Map((data.healthDays ?? []).map(d => [d.date, d]));
  const metric = (name, value) => {
    const pairs = days.flatMap(e => { const v = value(e); return v == null ? [] : [[v, e.painScore]]; });
    return pairs.length >= Math.max(2, Math.ceil(n * 0.6)) ? { name, pairs, metric: true } : null;
  };
  candidates.push(...[
    metric('sleep', e => e.sleepQuality ?? null),
    metric('sleep hours', e => health.get(e.date)?.sleepHours ?? null),
    metric('steps', e => health.get(e.date)?.steps ?? null),
  ].filter(Boolean));

  const ranked = candidates.map(c => ({ ...c, r: pearson(c.pairs.map(p => p[0]), c.pairs.map(p => p[1])) }));
  const up = ranked.filter(c => c.r >= LINK_MIN).sort((a, b) => b.r - a.r)[0];
  const down = ranked.filter(c => c.r <= -LINK_MIN).sort((a, b) => a.r - b.r)[0];

  // "on days with more walking", "on days with a heat pack" (yes/no), "after more sleep"
  const phrase = c => (c.name === 'sleep' ? ['after ', { b: 'better sleep' }] : c.name === 'sleep hours' ? ['after more ', { b: 'sleep' }]
    : c.yesno ? ['on days with ', { b: c.name }] : ['on days with more ', { b: c.name }]);
  const lead = n < 5 ? 'So far, your pain has been' : 'Your pain tends to be';

  let parts;
  if (up && down) parts = [`${lead} higher `, ...phrase(up), ' and lower ', ...phrase(down), '.'];
  else if (up) parts = [`${lead} higher `, ...phrase(up), '. Nothing you log lines up with lower pain yet.'];
  else if (down) parts = [`${lead} lower `, ...phrase(down), '. Nothing you log lines up with higher pain yet.'];
  else parts = ['No clear link yet between your pain and what you log.'];
  return { parts, basis };
}

/** "3 h of long sitting", "lifting and bending (4 times)", "heat pack" */
function withAmount(f, v) {
  const name = midSentence(f.name);
  if (f.measureType === 'minutes') return `${fmtMinutes(v)} of ${name}`;
  if (f.measureType === 'count') return `${name} (${v} ${f.unit || 'times'})`;
  return name;
}

function joinNames(names) {
  return names.flatMap((nm, i) => [i ? ' and ' : '', { b: nm }]).filter(x => x !== '');
}

// ---------- Findings you can act on ----------

export const TREND_DAYS = 14; // look back two weeks, so a finding reflects a run of days, not one bad day
export const TREND_MIN_CHECKINS = 7;
const STRONG = 0.45, WEAK_COUNTER = 0.3;

/**
 * Longer-run links between what you log and your pain, each phrased as something to try. Uses the last
 * TREND_DAYS of check-ins; needs a week's worth of them, and the factor both logged and missed on a few.
 * Returns findings, strongest first: { key, factor, kind, title, body, r, n, strong }.
 *   stressor + pain rises with it  → 'avoid'     suggest trying less, to see if the pattern changes
 *   stressor + pain falls with it  → 'not-stressor' it doesn't line up with more pain
 *   helper + pain falls with it    → 'keep'      less pain goes with it
 *   helper + pain rises with it    → 'rethink'   more pain goes with it; suggest trying a change
 */
export function trendFindings(data, factors, today = localDate()) {
  const since = addDays(today, -(TREND_DAYS - 1));
  const days = data.dailyEntries.filter(e => e.painScore != null && e.date >= since && e.date <= today);
  const n = days.length;
  if (n < TREND_MIN_CHECKINS) return [];
  const painUp = weekShift(days.map(e => [e.date, e.painScore]), today);

  const out = [];
  for (const f of factors) {
    const amounts = amountsByDate(data.factorLogs.filter(l => l.date >= since && l.date <= today), f.id);
    const xs = days.map(e => (f.measureType === 'yesno' ? ((amounts.get(e.date) || 0) > 0 ? 1 : 0) : amounts.get(e.date) || 0));
    const withDays = xs.filter(x => x > 0).length;
    // Needs a few days with it, and enough variety to compare: days without, or a spread of amounts
    const distinct = new Set(xs).size;
    if (withDays < 3 || distinct < 2 || (n - withDays < 2 && distinct < 3)) continue;
    const r = pearson(xs, days.map(e => e.painScore));
    const helper = f.role === 'helper';
    const name = midSentence(f.name);
    const more = f.measureType === 'yesno' ? `on days with ${name}` : `on days with more ${name}`;
    let kind = null, title, body;
    if (!helper && r >= STRONG) {
      kind = 'avoid';
      const rising = painUp > 0.5 && weekShift(days.map((e, i) => [e.date, xs[i]]), today) > 0;
      title = rising ? `Your pain has risen along with ${name}` : `More pain ${more}`;
      body = `These go together in your diary. You could try less ${name} for a week or two and see if the pattern changes.`;
    } else if (!helper && r <= -WEAK_COUNTER) {
      kind = 'not-stressor';
      title = `${f.name} doesn't line up with more pain`;
      body = `Your pain has been lower ${more}, not higher.`;
    } else if (helper && r <= -STRONG) {
      kind = 'keep';
      title = `Less pain ${more}`;
      body = 'These go together in your diary, though one may not be causing the other.';
    } else if (helper && r >= STRONG) {
      kind = 'rethink';
      title = `More pain ${more}`;
      body = 'These go together in your diary. You could try easing off or changing how you do it, and see if the pattern changes.';
    }
    if (kind) out.push({ key: `${f.id}:${kind}`, factor: f, kind, title, body, r, n, strong: Math.abs(r) >= 0.6 && n >= 10 });
  }
  return out.sort((a, b) => Math.abs(b.r) - Math.abs(a.r));
}

/** How much the second week's average is above the first's (dates and values in the TREND_DAYS window). */
function weekShift(pairs, today) {
  const mid = addDays(today, -6);
  const early = pairs.filter(([d]) => d < mid).map(p => p[1]), late = pairs.filter(([d]) => d >= mid).map(p => p[1]);
  return early.length && late.length ? mean(late) - mean(early) : 0;
}

// ---------- One stressor or helper, told from the first few check-ins ----------

export const STORY_DAYS = 28; // window for the comparison
export const STRIP_DAYS = 14; // days drawn on the factor page
export const SAME_BAND = 0.5; // a gap smaller than this reads as "about the same"

/**
 * How pain moves with the amount of something: the check-in days split at the middle amount, days with
 * more against days with less, and the straight-line rate (pain per unit) across all of them. Days without
 * a log count as none of it (for a score, they sit out). Needs EARLY_MIN_DAYS on each side and at least
 * two different amounts; otherwise null.
 * { delta, meanMore, meanLess, nMore, nLess, cut, perUnit, r, early }: cut is the most a "less" day had.
 */
export function amountSplit(pain, amounts, dates, { scores = false } = {}) {
  const days = dates.map(d => ({ a: scores ? amounts.get(d) ?? null : amounts.get(d) || 0, p: pain.get(d) })).filter(x => x.p != null && x.a != null);
  const cut = balancedCut(days.map(x => x.a));
  if (cut == null) return null;
  const more = days.filter(x => x.a > cut).map(x => x.p), less = days.filter(x => x.a <= cut).map(x => x.p);
  if (more.length < EARLY_MIN_DAYS || less.length < EARLY_MIN_DAYS) return null;
  const meanMore = mean(more), meanLess = mean(less);
  const { slope, r } = fit(days.map(x => x.a), days.map(x => x.p));
  return { delta: meanMore - meanLess, meanMore, meanLess, nMore: more.length, nLess: less.length, cut, perUnit: slope, r, early: Math.min(more.length, less.length) < MIN_DAYS };
}

/**
 * Where to split amounts into "less" (at or under) and "more" (over): the value that divides the days
 * most evenly. Plain median fails when many days share an amount (if most were 8 hours, nothing would be
 * over the median). Null when every amount is the same.
 */
export function balancedCut(values) {
  const distinct = [...new Set(values)].sort((a, b) => a - b);
  if (distinct.length < 2) return null;
  let best = null, bestGap = Infinity;
  for (const v of distinct.slice(0, -1)) {
    const under = values.filter(x => x <= v).length;
    const gap = Math.abs(under - values.length / 2);
    if (gap < bestGap) { best = v; bestGap = gap; }
  }
  return best;
}

/** Least-squares line through the points: its slope, and the correlation. */
function fit(xs, ys) {
  const mx = mean(xs), my = mean(ys);
  let sxy = 0, sxx = 0, syy = 0;
  xs.forEach((x, i) => { sxy += (x - mx) * (ys[i] - my); sxx += (x - mx) ** 2; syy += (ys[i] - my) ** 2; });
  return { slope: sxx ? sxy / sxx : 0, r: sxx && syy ? sxy / Math.sqrt(sxx * syy) : 0 };
}

/**
 * What one factor's page says: pain on check-in days with it against days without, the same day and
 * the next, from EARLY_MIN_DAYS of each. Returns { state, best, next, nCheckins, nWith, strip, early }:
 *   state 'none'   never logged in the window
 *   state 'always' logged on every check-in in the same amount, so nothing to compare
 * Time and counts (amount: true) compare days with more against days with less (best.kind 'amount',
 * with best.cut, the most a "less" day had, and best.perUnit, pain per minute or per time); yes/no
 * compares days with and without.
 *   state 'few'    not yet EARLY_MIN_DAYS with and without
 *   state 'up' | 'down' | 'same'   pain higher, lower or about the same with it (best: the clearer lag)
 * strip: the last 7 to STRIP_DAYS days (since the first check-in), oldest first, { date, pain, amount }.
 */
export function factorStory(factor, data, today = localDate()) {
  const since = addDays(today, -(STORY_DAYS - 1));
  const entries = data.dailyEntries.filter(e => e.painScore != null && e.date >= since && e.date <= today);
  const pain = painByDate(data.dailyEntries);
  const amounts = amountsByDate(data.factorLogs, factor.id);
  const dates = entries.map(e => e.date);
  const nWith = dates.filter(d => (amounts.get(d) || 0) > 0).length;
  // A week at least, growing to two weeks, so a new diary isn't mostly empty days
  const first = data.dailyEntries.reduce((m, e) => (e.date < m ? e.date : m), today);
  const len = Math.min(STRIP_DAYS, Math.max(7, daysBetween(first, today) + 1));
  const strip = Array.from({ length: len }, (_, i) => {
    const date = addDays(today, i - (len - 1));
    return { date, pain: pain.get(date) ?? null, amount: amounts.get(date) || 0 };
  });
  const base = { nCheckins: dates.length, nWith, strip, best: null, next: null, early: false, amount: false };
  if (!nWith) return { ...base, state: 'none' };

  // Time and counts: what matters is how much, so days with more of it are set against days with less
  if (factor.measureType !== 'yesno') {
    const split = amountSplit(pain, amounts, dates);
    if (!split) return { ...base, amount: true, state: nWith === dates.length ? 'always' : 'few', need: { with: Math.max(0, EARLY_MIN_DAYS - nWith), without: Math.max(0, EARLY_MIN_DAYS - (dates.length - nWith)) } };
    const best = { lag: 0, kind: 'amount', delta: split.delta, meanWith: split.meanMore, meanWithout: split.meanLess, nWith: split.nMore, nWithout: split.nLess, cut: split.cut, perUnit: split.perUnit, r: split.r };
    return { ...base, amount: true, state: Math.abs(best.delta) < SAME_BAND ? 'same' : best.delta > 0 ? 'up' : 'down', best, early: split.early };
  }
  if (nWith === dates.length) return { ...base, state: 'always' };

  // Next day only counts check-ins whose next day is in the diary too
  const [same, next] = [0, 1].map(lag => lagComparison(pain, amounts, dates.filter(d => d <= addDays(today, -lag)), lag, EARLY_MIN_DAYS));
  const usable = [same, next].filter(l => l.enough);
  if (!usable.length) return { ...base, state: 'few', need: { with: Math.max(0, EARLY_MIN_DAYS - same.nWith), without: Math.max(0, EARLY_MIN_DAYS - same.nWithout) } };
  // The same day unless the next day shows a clearly bigger gap
  const best = usable.length === 2 && Math.abs(next.delta) > Math.abs(same.delta) + 0.3 ? next : usable[0];
  const state = Math.abs(best.delta) < SAME_BAND ? 'same' : best.delta > 0 ? 'up' : 'down';
  return { ...base, state, best, next: next.enough && best !== next ? next : null, early: Math.min(best.nWith, best.nWithout) < MIN_DAYS };
}

// What makes a pattern worth showing, beyond the size of the gap:
//   how often: once the window has PATTERN_FULL_WINDOW check-ins, each side needs at least PATTERN_MIN_SIDE
//     days, and at least PATTERN_MIN_SHARE of the check-ins, so something logged twice in a month stays out
//   how recently: something not logged for PATTERN_STALE days is left out, and from PATTERN_FRESH days it
//     counts for less, so what's in your life now comes first
const PATTERN_FULL_WINDOW = 10, PATTERN_MIN_SIDE = 3, PATTERN_MIN_SHARE = 0.15;
export const PATTERN_FRESH = 7, PATTERN_STALE = 14;

/**
 * How much a gap in pain counts when ranking what goes with it: the gap, scaled down when either side
 * rests on only a few days and when it hasn't been logged lately. Null when it's too thin or too old to
 * show. nSmall: days on the smaller side; nCheckins: check-ins in the window; daysSince: since last logged.
 */
export function patternWeight(delta, nSmall, nCheckins, daysSince = 0) {
  if (nCheckins >= PATTERN_FULL_WINDOW && nSmall < Math.max(PATTERN_MIN_SIDE, Math.ceil(nCheckins * PATTERN_MIN_SHARE))) return null;
  if (daysSince > PATTERN_STALE) return null;
  const recency = daysSince <= PATTERN_FRESH ? 1 : 1 - 0.5 * ((daysSince - PATTERN_FRESH) / (PATTERN_STALE - PATTERN_FRESH));
  return delta * (nSmall / (nSmall + 6)) * recency;
}

/** Days since a logged item was last logged (any amount), or Infinity if never. */
export function daysSinceLogged(factorId, data, today = localDate()) {
  let last = null;
  for (const l of data.factorLogs) if (l.factorId === factorId && Number(l.value) > 0 && l.date <= today && (!last || l.date > last)) last = l.date;
  return last ? daysBetween(last, today) : Infinity;
}

/**
 * Heads-ups: things that have gone with more pain, logged above their usual on each of the last two
 * check-ins (the latest today or yesterday). For an amount, above the usual is over the split between
 * more and less; for a yes or no, it has to be something done on fewer than most days. Biggest gap first,
 * as [{ factor, delta, amount }] (amount: measured in time or counts, not yes or no).
 */
export function painRisks(factors, data, today = localDate()) {
  const last = [...new Set(data.dailyEntries.filter(e => e.date <= today).map(e => e.date))].sort().slice(-2);
  if (last.length < 2 || last[1] < addDays(today, -1)) return [];
  const out = [];
  for (const factor of factors) {
    const st = factorStory(factor, data, today), b = st.best;
    if (!b || st.early || b.delta < SAME_BAND) continue;
    if (patternWeight(b.delta, Math.min(b.nWith, b.nWithout), st.nCheckins, daysSinceLogged(factor.id, data, today)) == null) continue;
    if (!st.amount && st.nWith >= st.nCheckins * 0.6) continue;
    const amounts = amountsByDate(data.factorLogs, factor.id);
    if (last.every(d => (amounts.get(d) || 0) > (st.amount ? b.cut : 0))) out.push({ factor, delta: b.delta, amount: st.amount });
  }
  return out.sort((a, b) => b.delta - a.delta);
}

/**
 * The check-in's own scores against pain, over the same four weeks as factorStory: days with higher
 * stress (or sleep, or eating) against days with lower. [{ key, name, split }] where there's enough.
 */
export function scoreSplits(data, today = localDate()) {
  const since = addDays(today, -(STORY_DAYS - 1));
  const entries = data.dailyEntries.filter(e => e.painScore != null && e.date >= since && e.date <= today);
  const pain = painByDate(entries), dates = entries.map(e => e.date);
  return [['stressScore', 'Stress'], ['sleepQuality', 'Sleep'], ['dietScore', 'Eating']].map(([key, name]) => {
    const values = new Map(entries.filter(e => e[key] != null).map(e => [e.date, e[key]]));
    return { key, name, split: amountSplit(pain, values, dates, { scores: true }) };
  }).filter(x => x.split);
}
