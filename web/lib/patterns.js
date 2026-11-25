// Two more kinds of pattern for Home, alongside the delays and combinations in insights.js: what comes
// before flares, and how pain has moved since a routine started. Pure, unit-tested in test/patterns.test.js.
//
// Both are held to a clear bar before they're offered, as the diary is small and has been asked many things:
//   Flares: at least 3 flares, the same two-day run-up before at least 3 of them and three quarters of all,
//     far rarer at other times, and unlikely by chance even after counting every item tried (Bonferroni).
//   Routines: enough days before and since, done on most days since, a gap of nearly a point or more, and
//     a shuffle test that chance alone rarely matches. Pain moving after a start isn't proof the routine did it.
import { addDays, daysBetween, localDate } from './dates.js';
import { flareEpisodes, painByDate, daysSinceLogged } from './analysis.js';
import { SCORES, presence, seeded, shuffled } from './insights.js';

const mean = xs => xs.reduce((a, b) => a + b, 0) / xs.length;
const FLARE_DAYS = 120; // how far back flares are looked at
const STILL_LOGGED = 21; // days since an item was last logged, at most, for it to be looked at
const MIN_FLARES = 3, RUNUP_SHARE = 0.75, BASE_MAX = 0.4, FLARE_ALPHA = 0.05;
const TREND_BEFORE = 28, TREND_MAX_SINCE = 56, NEED_BEFORE = 10, NEED_SINCE = 14, DONE_SHARE = 0.4, TREND_GAP = 0.8, TREND_ALPHA = 0.01, SHUFFLES = 1999;

/** P(X ≥ k) for X ~ Binomial(n, q). */
export function binomialTail(k, n, q) {
  let total = 0;
  for (let i = k; i <= n; i++) {
    let c = 1;
    for (let j = 0; j < i; j++) c = (c * (n - j)) / (j + 1);
    total += c * q ** i * (1 - q) ** (n - i);
  }
  return Math.min(1, total);
}

/**
 * What tends to come in the two days before a flare: the item (or stress, or sleep) that was on the bad
 * side on both of the two days before most flares, and rarely otherwise. Null when nothing clears the bar.
 * { subject, flares: [{ start, peakPain, runUp }], k, n, base, p }, the flares newest first.
 */
export function flareRunUp(data, factors, today = localDate()) {
  const since = addDays(today, -(FLARE_DAYS - 1));
  const entries = data.dailyEntries.filter(e => e.date >= since && e.date <= today);
  const flares = flareEpisodes(entries, (data.flares ?? []).filter(f => f.timestamp.slice(0, 10) >= since)).filter(f => f.start <= today);
  if (flares.length < MIN_FLARES) return null;
  const dates = entries.filter(e => e.painScore != null).map(e => e.date).sort();
  const logged = new Set(dates);
  const flareDays = new Set(flares.flatMap(f => Array.from({ length: f.days }, (_, i) => addDays(f.start, i))));
  // Only what's still being logged, as for delays and combinations
  const subjects = [...factors.filter(f => daysSinceLogged(f.id, data, today) <= STILL_LOGGED), ...SCORES];
  let best = null;
  for (const subject of subjects) {
    const p = presence(subject, data, dates);
    const runUp = d => logged.has(addDays(d, -1)) && logged.has(addDays(d, -2)) ? p.on(addDays(d, -1)) && p.on(addDays(d, -2)) : null;
    const seen = flares.map(f => ({ ...f, runUp: runUp(f.start) })).filter(f => f.runUp != null);
    const k = seen.filter(f => f.runUp).length, n = seen.length;
    // Other days: any day with its two days before logged, away from flares and the days just before them
    const others = dates.filter(d => !flareDays.has(d) && !flares.some(f => d === f.start || (d < f.start && daysBetween(d, f.start) <= 2))).map(runUp).filter(v => v != null);
    if (n < MIN_FLARES || k < MIN_FLARES || k / n < RUNUP_SHARE || others.length < 10) continue;
    const base = others.filter(Boolean).length / others.length;
    if (base > BASE_MAX) continue;
    const pv = binomialTail(k, n, Math.max(base, 1 / others.length));
    if (pv > FLARE_ALPHA / subjects.length) continue;
    if (!best || pv < best.p) best = { subject, flares: seen.reverse(), k, n, base, p: pv, cut: p.cut };
  }
  return best;
}

/**
 * How pain has moved since a routine was first done: [{ routine, start, before, since, delta, nBefore,
 * nSince, done, p }], only those that clear the bar, biggest change first.
 */
export function routineShifts(data, routines, doneDays, today = localDate()) {
  const pain = painByDate(data.dailyEntries);
  const out = [];
  for (const r of routines) {
    const days = [...new Set(doneDays.filter(d => d.routineId === r.id).map(d => d.date))].sort();
    if (!days.length) continue;
    const start = days[0];
    if (start > today || daysBetween(start, today) + 1 > TREND_MAX_SINCE + 30) continue;
    const before = [], sinceVals = [];
    for (let i = 1; i <= TREND_BEFORE; i++) { const v = pain.get(addDays(start, -i)); if (v != null) before.push(v); }
    for (let d = start; d <= today; d = addDays(d, 1)) { const v = pain.get(d); if (v != null) sinceVals.push(v); }
    const sinceDays = daysBetween(start, today) + 1;
    const done = days.filter(d => d <= today).length / sinceDays;
    if (before.length < NEED_BEFORE || sinceVals.length < NEED_SINCE || done < DONE_SHARE) continue;
    const delta = mean(sinceVals) - mean(before);
    if (Math.abs(delta) < TREND_GAP) continue;
    // Shuffle which days were before and since: how often does chance give a gap this big?
    const all = [...before, ...sinceVals], rand = seeded(`trend|${r.id}|${start}|${all.length}`);
    let as = 0;
    for (let i = 0; i < SHUFFLES; i++) {
      const sh = shuffled(all, rand);
      if (Math.abs(mean(sh.slice(before.length)) - mean(sh.slice(0, before.length))) >= Math.abs(delta) - 1e-9) as++;
    }
    const p = (as + 1) / (SHUFFLES + 1);
    if (p <= TREND_ALPHA) out.push({ routine: r, start, before: mean(before), since: mean(sinceVals), delta, nBefore: before.length, nSince: sinceVals.length, done, p });
  }
  return out.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
}
