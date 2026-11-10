// Insights a single comparison misses: pain that follows a day or two later ("worse two days after more
// long sitting"), and things that matter in combination ("worse on days you combine long sitting with
// driving"). Pure, unit-tested in test/insights.test.js. Associations in your own diary, never causes.
//
// A diary of a few weeks, checked many ways, will show some differences by luck alone. So an insight has
// to clear three bars before it's offered:
//   1. Size: a difference of nearly a point of pain or more, with enough days on each side.
//   2. Not luck: shuffling the days 4,999 times shows how often chance alone gives a difference that big
//      (a permutation test), and that's judged against how many things were tried at once (Benjamini-
//      Hochberg, so trying many pairings doesn't let chance findings through).
//   3. The right shape: a delay has to show clearly more than the same day, and can't come from the thing
//      simply repeating day after day; a combination has to go beyond what each does alone, added up.
// Shuffles use a fixed seed per question, so the same diary always gives the same answer.

import { addDays, localDate } from './dates.js';
import { painByDate, amountsByDate, balancedCut, MIN_DAYS } from './analysis.js';

const mean = xs => xs.reduce((a, b) => a + b, 0) / xs.length;
export const NEED = 3; // days on each side (and with both together) before anything is said
const MEANINGFUL = 0.8; // pain points
const LAG_MARGIN = 0.5; // how much more a later day must show than the same day
const COMBO_MARGIN = 0.8; // how far both together must go beyond each alone, added up
const REPEATS = 0.5; // the thing repeating itself `lag` days later more than this, and a delay can't be told apart
const SHUFFLES = 4999;
// The share of offered insights allowed to be chance, at most. On a diary with nothing real in it, this is
// also about the chance of offering anything at all, so it's kept low
const FALSE_FINDS = 0.05;
const MAX_PAIRS_FROM = 6; // the most often logged things, paired with each other
// Insights look further back than a single comparison: more days is the honest way to be surer
export const INSIGHT_DAYS = 56;

// ---------- Small tools ----------

const hash = s => [...s].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0, 2166136261);
// mulberry32: small, fast and well mixed, so neighbouring draws don't lean on each other
function seeded(key) {
  let a = hash(key);
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function shuffled(xs, rand) {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
/** How often shuffling gives a statistic at least as far from zero as the real one (counting the real one). */
function chance(stat, shuffle, key) {
  const real = Math.abs(stat(null));
  const rand = seeded(key);
  let as = 0;
  for (let i = 0; i < SHUFFLES; i++) if (Math.abs(stat(shuffle(rand))) >= real - 1e-9) as++;
  return (as + 1) / (SHUFFLES + 1);
}
function correlation(xs, ys) {
  const mx = mean(xs), my = mean(ys);
  let sxy = 0, sxx = 0, syy = 0;
  xs.forEach((x, i) => { sxy += (x - mx) * (ys[i] - my); sxx += (x - mx) ** 2; syy += (ys[i] - my) ** 2; });
  return sxx && syy ? sxy / Math.sqrt(sxx * syy) : 0;
}

/** Check-in days in the last INSIGHT_DAYS, oldest first, with pain by date. */
function window(data, today) {
  const since = addDays(today, -(INSIGHT_DAYS - 1));
  const dates = data.dailyEntries.filter(e => e.painScore != null && e.date >= since && e.date <= today).map(e => e.date).sort();
  return { dates, pain: painByDate(data.dailyEntries) };
}

/**
 * Which days count as "with" a factor: any of it for yes or no; for time and counts, more than its middle
 * amount over the window (so for something logged daily, its bigger days). { on(date), cut }
 */
function presence(factor, data, dates) {
  const amounts = amountsByDate(data.factorLogs, factor.id);
  if (factor.measureType === 'yesno') return { on: d => (amounts.get(d) || 0) > 0, cut: 0 };
  const cut = balancedCut(dates.map(d => amounts.get(d) || 0)) ?? Infinity;
  return { on: d => (amounts.get(d) || 0) > cut, cut };
}

// ---------- A delay ----------

/** Pain `lag` days after days with the factor against `lag` days after days without, as paired lists. */
function lagPairs(p, dates, pain, lag, today) {
  const xs = [], ys = [];
  for (const d of dates) {
    const later = addDays(d, lag);
    if (later > today || pain.get(later) == null) continue;
    xs.push(p.on(d)); ys.push(pain.get(later));
  }
  return { xs, ys };
}
const gap = (xs, ys) => {
  const w = ys.filter((_, i) => xs[i]), wo = ys.filter((_, i) => !xs[i]);
  return w.length && wo.length ? mean(w) - mean(wo) : 0;
};

/**
 * How pain `lag` days later goes with a factor. Null with too few days. Otherwise the two averages and
 * day counts, what the same day shows, how much the factor repeats itself at that distance, whether it's
 * big and clearly delayed (`shaped`), and, when it is, how likely chance alone is (`p`).
 */
export function explainLag(factor, data, lag, today = localDate()) {
  const { dates, pain } = window(data, today);
  const p = presence(factor, data, dates);
  const { xs, ys } = lagPairs(p, dates, pain, lag, today);
  const nWith = xs.filter(Boolean).length, nWithout = xs.length - nWith;
  if (nWith < NEED || nWithout < NEED) return null;
  const delta = gap(xs, ys);
  const same = lagPairs(p, dates, pain, 0, today);
  const sameDelta = gap(same.xs, same.ys);
  // Does the thing itself come back `lag` days later? Then its delay and its same-day link are tangled
  const consecutive = dates.filter(d => dates.includes(addDays(d, lag)));
  const repeats = consecutive.length > 3 ? correlation(consecutive.map(d => +p.on(d)), consecutive.map(d => +p.on(addDays(d, lag)))) : 0;
  const shaped = Math.abs(delta) >= MEANINGFUL && Math.abs(delta) >= Math.abs(sameDelta) + LAG_MARGIN && Math.abs(repeats) <= REPEATS;
  return {
    lag, delta, sameDelta, repeats, shaped, cut: p.cut, nWith, nWithout,
    meanWith: mean(ys.filter((_, i) => xs[i])), meanWithout: mean(ys.filter((_, i) => !xs[i])),
    early: Math.min(nWith, nWithout) < MIN_DAYS,
    p: shaped ? chance(sh => gap(sh ? shuffled(xs, sh) : xs, ys), r => r, `lag|${factor.id}|${lag}|${dates.length}`) : null,
  };
}

// ---------- A combination ----------

/**
 * Pain on days with both factors, each alone, and neither. Null with too few days. A combination is
 * `shaped` when both together sit nearly a point or more from other days and beyond what each does alone,
 * added up (both − (a alone + b alone − neither)): that needs days of each kind to compare.
 */
export function explainCombo(a, b, data, today = localDate()) {
  const { dates, pain } = window(data, today);
  const pa = presence(a, data, dates), pb = presence(b, data, dates);
  const rows = dates.filter(d => pain.get(d) != null).map(d => ({ d, A: pa.on(d), B: pb.on(d), p: pain.get(d) }));
  const groupOf = r => (r.A ? (r.B ? 'both' : 'aOnly') : r.B ? 'bOnly' : 'neither');
  const stats = ps => {
    const g = { both: [], aOnly: [], bOnly: [], neither: [] };
    rows.forEach((r, i) => g[groupOf(r)].push(ps[i]));
    const m = k => (g[k].length ? mean(g[k]) : null);
    const others = [...g.aOnly, ...g.bOnly, ...g.neither];
    return { g, m, delta: g.both.length && others.length ? mean(g.both) - mean(others) : 0, extra: [m('both'), m('aOnly'), m('bOnly'), m('neither')].includes(null) ? 0 : m('both') - (m('aOnly') + m('bOnly') - m('neither')) };
  };
  const real = stats(rows.map(r => r.p));
  const counts = Object.fromEntries(Object.entries(real.g).map(([k, v]) => [k, v.length]));
  if (counts.both < NEED || counts.aOnly + counts.bOnly + counts.neither < NEED) return null;
  // Each alone and neither need days of their own, or there's no telling the pair from either one
  const comparable = counts.aOnly >= NEED && counts.bOnly >= NEED && counts.neither >= NEED;
  const shaped = comparable && Math.abs(real.delta) >= MEANINGFUL && Math.sign(real.extra) === Math.sign(real.delta) && Math.abs(real.extra) >= COMBO_MARGIN;
  return {
    delta: real.delta, extra: real.extra, comparable, shaped, counts, cuts: [pa.cut, pb.cut],
    means: { both: real.m('both'), aOnly: real.m('aOnly'), bOnly: real.m('bOnly'), neither: real.m('neither') },
    bothDays: rows.filter(r => r.A && r.B).map(r => r.d),
    early: counts.both < MIN_DAYS,
    p: shaped ? chance(sh => stats(sh ? shuffled(rows.map(r => r.p), sh) : rows.map(r => r.p)).extra, r => r, `combo|${a.id}|${b.id}|${dates.length}`) : null,
  };
}

// ---------- What to offer ----------

const mid = n => (/^[A-Z][a-z]/.test(n) ? n[0].toLowerCase() + n.slice(1) : n);
const more = f => (f.measureType === 'yesno' ? mid(f.name) : `more ${mid(f.name)}`);
export const LATER = { 1: 'the day after', 2: 'two days after' };

export const lagTitle = (f, x) => `Pain is ${x.delta > 0 ? 'worse' : 'better'} ${LATER[x.lag]} ${more(f)}`;
export const comboTitle = (a, b, x) => `Pain is ${x.delta > 0 ? 'worse' : 'better'} on days you combine ${mid(a.name)} with ${mid(b.name)}`;

/**
 * In words, how sure. Something that hasn't cleared the bar (opened from an old link, or with the diary
 * since changed) says so plainly; otherwise early (few days), clear, or strong.
 */
export const howSure = x => (!x.shaped || x.p == null || x.p > FALSE_FINDS ? 'Not clear yet, it could still be chance'
  : x.early ? 'An early sign' : x.p <= 0.01 ? 'A strong pattern' : 'A clear pattern');

const cache = new Map();

/**
 * The delays and combinations worth showing, strongest first: [{ id, kind, title, delta, early, p }].
 * id is what the insight page reads back: 'lag.<factorId>.<1|2>' or 'combo.<idA>.<idB>'. Every question
 * asked counts towards the bar for chance, whether or not it came to anything.
 */
export function findInsights(data, factors, today = localDate(), max = 3) {
  const { dates } = window(data, today);
  if (dates.length < NEED * 3) return [];
  const key = `${today}|${dates.length}|${data.dailyEntries.reduce((s, e) => s + (e.painScore ?? 0), 0)}|${data.factorLogs.length}|${data.factorLogs.reduce((s, l) => s + Number(l.value || 0), 0)}|${factors.map(f => f.id + f.measureType).join()}`;
  if (cache.has(key)) return cache.get(key);

  const found = [];
  let asked = 0;
  for (const f of factors) {
    for (const lag of [1, 2]) {
      const x = explainLag(f, data, lag, today);
      if (!x) continue;
      asked++;
      if (x.shaped) found.push({ id: `lag.${f.id}.${lag}`, kind: 'lag', title: lagTitle(f, x), delta: x.delta, early: x.early, p: x.p });
    }
  }
  const logged = factors.map(f => ({ f, n: dates.filter(d => (amountsByDate(data.factorLogs, f.id).get(d) || 0) > 0).length }))
    .filter(x => x.n >= NEED).sort((a, b) => b.n - a.n).slice(0, MAX_PAIRS_FROM).map(x => x.f);
  for (let i = 0; i < logged.length; i++) {
    for (let j = i + 1; j < logged.length; j++) {
      const x = explainCombo(logged[i], logged[j], data, today);
      if (!x) continue;
      asked++;
      if (x.shaped) found.push({ id: `combo.${logged[i].id}.${logged[j].id}`, kind: 'combo', title: comboTitle(logged[i], logged[j], x), delta: x.delta, early: x.early, p: x.p });
    }
  }
  // Keep only what clears the bar for chance, given how many questions were asked (Benjamini-Hochberg)
  const ranked = [...found].sort((a, b) => a.p - b.p);
  let keep = 0;
  ranked.forEach((x, i) => { if (x.p <= ((i + 1) / Math.max(asked, 1)) * FALSE_FINDS) keep = i + 1; });
  // A delay and the same thing's other delay say one thing: keep the stronger
  const out = [];
  for (const x of ranked.slice(0, keep).sort((a, b) => (a.early - b.early) || Math.abs(b.delta) - Math.abs(a.delta))) {
    const base = x.kind === 'lag' ? x.id.split('.').slice(0, 2).join('.') : x.id;
    if (!out.some(o => (o.kind === 'lag' ? o.id.split('.').slice(0, 2).join('.') : o.id) === base)) out.push(x);
  }
  const result = out.slice(0, max);
  if (cache.size > 20) cache.clear();
  cache.set(key, result);
  return result;
}
