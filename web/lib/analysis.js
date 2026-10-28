// On-device per-factor analysis (SPEC.md › Analysis). Pure functions, unit-tested in test/analysis.test.js.
// Results are associations between a factor and pain, never causes.

import { addDays, localDate, fmtMinutes } from './dates.js';
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

/** Share of flares that had the factor logged within the 24 hours before (same or previous calendar day). */
export function flareAssociation(flares, amounts) {
  if (!flares.length) return null;
  const hits = flares.filter(f => {
    const d = localDate(new Date(f.timestamp));
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
    flares: flareAssociation(data.flares, amounts),
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

  // "on days with more walking", "on days with crossed-leg sitting" (yes/no), "after more sleep"
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

/** "3 h of desk sitting", "extension breaks (4 times)", "crossed-leg sitting" */
function withAmount(f, v) {
  const name = midSentence(f.name);
  if (f.measureType === 'minutes') return `${fmtMinutes(v)} of ${name}`;
  if (f.measureType === 'count') return `${name} (${v} ${f.unit || 'times'})`;
  return name;
}

function joinNames(names) {
  return names.flatMap((nm, i) => [i ? ' and ' : '', { b: nm }]).filter(x => x !== '');
}
