// The page behind each insight in Patterns: a delay ("worse two days after more long sitting") or a
// combination ("worse on days you combine long sitting with driving"), set out so it can be checked.
import { h, iconButton } from '../lib/ui.js';
import * as R from '../lib/repos.js';
import { explainLag, explainCombo, lagTitle, comboTitle, howSure, LATER } from '../lib/insights.js';
import { amountsByDate, STRIP_DAYS } from '../lib/analysis.js';
import { addDays, localDate, daysBetween, dayLabel } from '../lib/dates.js';
import { fmtAmount } from '../lib/labels.js';
import { TrendChart, PALETTES, WARM, COOL } from './chart.js';

const lower = n => (/^[A-Z][a-z]/.test(n) ? n[0].toLowerCase() + n.slice(1) : n);
/** "over 5 h of long sitting" for time and counts (its bigger days), or "guitar" for yes or no. */
const amountOf = (f, cut) => (f.measureType === 'yesno' || !(cut > 0) ? lower(f.name) : `over ${short(f, cut)} of ${lower(f.name)}`);
const short = (f, v) => (f.measureType === 'minutes' ? (v >= 60 ? `${Math.round(v / 30) / 2} h` : `${Math.round(v)} min`) : fmtAmount(f, Math.round(v)));
const pts = v => v.toFixed(1);

export function InsightView(ctx) {
  const [kind, ...ids] = ctx.args[0].split('.');
  const data = R.snapshot(), today = localDate();
  const body = kind === 'lag' ? lagPage(R.factors.get(ids[0]), Number(ids[1]), data, today)
    : kind === 'combo' ? comboPage(R.factors.get(ids[0]), R.factors.get(ids[1]), data, today) : null;
  return h('div', { class: 'view factor-page insight-page' },
    h('header', { class: 'top-bar' }, iconButton('‹', 'Back', () => history.back()), h('span', { class: 'eyebrow' }, 'Pattern'), h('span')),
    ...(body ?? [h('p', { class: 'muted' }, 'This pattern is no longer in your diary.')]));
}

/** Pain a day or two after more of something: the two averages, what the same day showed, and the days lined up. */
function lagPage(f, lag, data, today) {
  const x = f && explainLag(f, data, lag, today);
  if (!x) return null;
  const what = amountOf(f, x.cut);
  const when = LATER[lag];
  const labels = f.measureType === 'yesno' || !(x.cut > 0) ? ['After it', 'After none'] : [`After over ${short(f, x.cut)}`, `After ${short(f, x.cut)} or less`];
  return [
    h('h1', { class: 'score-title' }, lagTitle(f, x)),
    h('section', { class: 'card glass stack' },
      h('p', { class: 'lead story' }, `${when[0].toUpperCase()}${when.slice(1)} a day with ${what}, your pain averages ${pts(x.meanWith)}. After other days it's ${pts(x.meanWithout)}.`),
      bars([[labels[0], x.meanWith, true], [labels[1], x.meanWithout, false]]),
      h('p', { class: 'hint' }, Math.abs(x.sameDelta) < 0.5 ? 'On the day itself there’s little difference, so it shows up later.' : `On the day itself the gap is smaller, ${pts(Math.abs(x.sameDelta))} points.`),
      h('p', { class: 'hint' }, `${howSure(x)}, from ${x.nWith + x.nWithout} days.`)),
    h('section', { class: 'card glass' },
      h('h2', {}, `${f.name}, moved ${lag === 1 ? 'a day' : 'two days'} later`),
      chart(f.measureType, [[f, lag]], data, today)),
  ];
}

/** Two things together: pain with both, with each alone, and with neither, and the days they were combined. */
function comboPage(a, b, data, today) {
  const x = a && b && explainCombo(a, b, data, today);
  if (!x) return null;
  const expected = x.means.aOnly + x.means.bOnly - x.means.neither;
  return [
    h('h1', { class: 'score-title' }, comboTitle(a, b, x)),
    h('section', { class: 'card glass stack' },
      h('p', { class: 'lead story' }, `On days with ${amountOf(a, x.cuts[0])} and ${amountOf(b, x.cuts[1])}, your pain averages ${pts(x.means.both)}.`),
      bars([
        ['Both', x.means.both, true],
        [`${a.name} only`, x.means.aOnly, false],
        [`${b.name} only`, x.means.bOnly, false],
        ['Neither', x.means.neither, false],
      ], 'wide'),
      h('p', { class: 'hint' }, `Each one alone would add up to about ${pts(Math.max(0, Math.min(10, expected)))}. Together it’s ${pts(x.means.both)}, so the pair ${x.delta > 0 ? 'does more harm' : 'helps more'} than either does by itself.`),
      h('p', { class: 'hint' }, `${howSure(x)}, from ${Object.values(x.counts).reduce((s, n) => s + n, 0)} days.`)),
    x.bothDays.length ? h('section', { class: 'card glass' },
      h('h2', {}, 'Days you combined them'),
      h('ul', { class: 'list' }, [...x.bothDays].reverse().map(d => {
        const pain = data.dailyEntries.find(e => e.date === d)?.painScore;
        return h('li', { class: 'list-row' }, h('span', { class: 'grow' }, dayLabel(d)), h('span', { class: 'muted' }, pain == null ? '' : `Pain ${pain}/10`));
      }))) : null,
    h('section', { class: 'card glass' }, h('h2', {}, 'Last two weeks'), chart(null, [[a, 0], [b, 0]], data, today)),
  ];
}

/** Average pain as bars out of 10; the first, the pattern's own group, in pain's colour. */
function bars(rows, cls = '') {
  return h('div', { class: `cmp ${cls}` }, h('span', { class: 'eyebrow' }, 'Average pain'),
    rows.map(([label, v, own]) => h('div', { class: 'cmp-row' },
      h('span', { class: 'hint cmp-label' }, label),
      h('span', { class: 'cmp-track' }, h('i', { class: own ? 'with' : 'without', style: `--w:${(v ?? 0) * 10}%` })),
      h('strong', {}, v == null ? '–' : pts(v)))));
}

/** Pain with each thing's amount over the last two weeks, each moved on by its delay so peaks line up. */
function chart(_, lines, data, today) {
  const first = data.dailyEntries.reduce((m, e) => (e.date < m ? e.date : m), today);
  const len = Math.min(STRIP_DAYS, Math.max(7, daysBetween(first, today) + 1));
  const dates = Array.from({ length: len }, (_, i) => addDays(today, i - (len - 1)));
  const pain = new Map(data.dailyEntries.map(e => [e.date, e.painScore]));
  const series = [{ key: 'pain', label: 'Pain', palette: PALETTES.pain, values: dates.map(d => (pain.get(d) == null ? null : pain.get(d) / 10)), format: i => `${pain.get(dates[i]) ?? '–'}/10` }];
  lines.forEach(([f, lag], k) => {
    const amounts = amountsByDate(data.factorLogs, f.id);
    const at = i => amounts.get(addDays(dates[i], -lag)) || 0;
    const max = Math.max(1, ...dates.map((_, i) => at(i)));
    series.push({
      key: `f${k}`, label: lag ? `${f.name}, ${lag === 1 ? 'the day before' : 'two days before'}` : f.name,
      palette: f.role === 'helper' ? COOL[k] : WARM[k],
      values: dates.map((_, i) => (f.measureType === 'yesno' ? (at(i) ? 0.6 : 0) : at(i) / max) * 0.86 + 0.04),
      format: i => (at(i) ? fmtAmount(f, at(i)) : 'none'),
    });
  });
  const hidden = new Set();
  const wrap = h('div', {});
  const draw = animate => wrap.replaceChildren(TrendChart({
    days: dates.map(d => ({ date: d, logged: pain.has(d) })), series, hidden, animate, fadeLeft: false,
    onToggle: k => { if (hidden.has(k)) hidden.delete(k); else hidden.add(k); draw(false); },
  }));
  draw(true);
  return wrap;
}
