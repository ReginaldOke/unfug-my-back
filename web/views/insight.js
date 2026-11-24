// The page behind each pattern in Patterns, laid out like a factor's page: a short title, one sentence with
// the numbers that back it, then the days themselves on the Home chart. Four kinds:
//   lag: pain a day or two after something (each time it happened, its own chart, with an arc from the
//        thing to the pain it led to)
//   combo: two things worse together (the last fortnight, faded except on days with both)
//   flare: what came in the two days before flares (each flare, its own chart)
//   trend: pain since a routine started (the weeks before and since, with the routine's days)
import { h, iconButton } from '../lib/ui.js';
import * as R from '../lib/repos.js';
import { explainLag, explainCombo, subjectById, subjectPhrase, amountsOf, LATER } from '../lib/insights.js';
import { flareRunUp, routineShifts } from '../lib/patterns.js';
import { painByDate } from '../lib/analysis.js';
import { addDays, localDate, daysBetween, parseDate } from '../lib/dates.js';
import { fmtAmount } from '../lib/labels.js';
import { TrendChart, PALETTES, WARM, COOL } from './chart.js';

const lower = n => (/^[A-Z][a-z]/.test(n) ? n[0].toLowerCase() + n.slice(1) : n);
const pts = v => v.toFixed(1);
const dayTitle = d => parseDate(d).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
const longDay = d => parseDate(d).toLocaleDateString(undefined, { day: 'numeric', month: 'long' });

export function InsightView(ctx) {
  const [kind, ...ids] = ctx.args[0].split('.');
  const data = R.snapshot(), today = localDate(), factors = R.factors.all();
  const page = kind === 'lag' ? lagPage(subjectById(ids[0], factors), Number(ids[1]), data, today)
    : kind === 'combo' ? comboPage(subjectById(ids[0], factors), subjectById(ids[1], factors), data, today)
      : kind === 'flare' ? flarePage(data, factors, today)
        : kind === 'trend' ? trendPage(ids[0], data, today) : null;
  return h('div', { class: 'view factor-page insight-page' },
    h('header', { class: 'top-bar' }, iconButton('‹', 'Back', () => history.back()), h('span', { class: 'eyebrow' }, 'Pattern'), h('span')),
    ...(page ? [h('h1', { class: 'score-title' }, page.title), ...page.body] : [h('p', { class: 'muted' }, 'This pattern is no longer in your diary.')]));
}

// ---------- Parts ----------

/** The first card: the sentence, then average pain as bars (the pattern's own in pain's colour, teal when lower). */
function storyCard(sentence, eyebrow, rows) {
  return h('section', { class: 'card glass stack' },
    h('p', { class: 'lead story' }, sentence),
    h('div', { class: `cmp${rows.length > 2 ? ' wide' : ''}` }, h('span', { class: 'eyebrow' }, eyebrow),
      rows.map(([label, v, cls, shown]) => h('div', { class: 'cmp-row' },
        h('span', { class: 'hint cmp-label' }, label),
        h('span', { class: 'cmp-track' }, h('i', { class: cls, style: `--w:${Math.max(0, Math.min(10, v)) * 10}%` })),
        h('strong', {}, shown ?? pts(v))))));
}
const chartCard = (title, chart) => h('section', { class: 'card glass' }, h('h2', {}, title), chart);

/** A line for a logged item or a check-in score: its colour, its values (0 to 1) by date, and how it reads. */
function lineFor(subject, data, dates, k = 0) {
  if (subject.measureType === 'score') {
    const by = new Map(data.dailyEntries.filter(e => e[subject.key] != null).map(e => [e.date, e[subject.key]]));
    const isSleep = subject.key === 'sleepQuality';
    return { key: subject.id, label: isSleep ? 'Sleep' : 'Stress', palette: isSleep ? COOL[0] : WARM[k % WARM.length],
      values: dates.map(d => (by.has(d) ? by.get(d) / 10 : null)), format: i => (by.has(dates[i]) ? `${by.get(dates[i])}/10` : '–') };
  }
  const amounts = amountsOf(subject, data);
  const max = Math.max(1, ...[...amounts.values()]);
  const at = i => amounts.get(dates[i]) || 0;
  return { key: subject.id, label: subject.name, palette: subject.role === 'helper' ? COOL[(k + 1) % COOL.length] : WARM[(k + 3) % WARM.length],
    values: dates.map((_, i) => (subject.measureType === 'yesno' ? (at(i) ? 0.6 : 0.05) : 0.05 + (at(i) / max) * 0.85)), format: i => (at(i) ? fmtAmount(subject, at(i)) : 'none') };
}

/**
 * The Home chart over some days, with tapping a key turning its line off and on. Extras drawn on top (an
 * arc, a spotlight) are put back whenever the chart redraws, as it does while a finger moves along it.
 */
function chart(data, dates, lines, focus, { arc = null, spot = null, routineDays = [], marks = [] } = {}) {
  const pain = painByDate(data.dailyEntries);
  const series = [{ key: 'pain', label: 'Pain', palette: PALETTES.pain, values: dates.map(d => (pain.get(d) == null ? null : pain.get(d) / 10)), format: i => `${pain.get(dates[i]) ?? '–'}/10` }, ...lines];
  const days = dates.map(d => ({ date: d, logged: pain.has(d) }));
  const hidden = new Set(), wrap = h('div', {});
  const decorate = () => {
    const svg = wrap.querySelector('svg.trend');
    if (!svg) return;
    if (spot && !svg.querySelector('.spot')) spotlight(svg, dates.length, spot);
    if (arc && !svg.querySelector('.spike-arc') && !hidden.has('pain') && !hidden.has(arc.from.key)) {
      const v = arc.from.values[arc.i];
      const p = series[0].values[arc.i + arc.lag];
      if (v != null && p != null) arcTo(svg, dates.length, [arc.i, v], [arc.i + arc.lag, p], arc.from.palette[0]);
    }
  };
  const draw = animate => {
    wrap.replaceChildren(TrendChart({ days, series, hidden, focus, fadeLeft: true, animate, routineDays, marks,
      onToggle: k => { if (hidden.has(k)) hidden.delete(k); else hidden.add(k); draw(false); } }));
    decorate();
  };
  if (arc || spot) new MutationObserver(decorate).observe(wrap, { childList: true, subtree: true });
  draw(true);
  return wrap;
}

// The Home chart's plot runs from y 46 to 176, 4 in from each side (see chart.js)
const plotX = (svg, n) => { const W = svg.viewBox.baseVal.width; return i => 4 + (n === 1 ? (W - 8) / 2 : (i / (n - 1)) * (W - 8)); };
const plotY = v => 176 - v * 130;
const NS = 'http://www.w3.org/2000/svg';

/** The dotted arc from the thing to the pain it led to, a dot at each end. */
function arcTo(svg, n, [i0, v0], [i1, v1], colour) {
  const x = plotX(svg, n), a = [x(i0), plotY(v0)], b = [x(i1), plotY(v1)];
  const g = document.createElementNS(NS, 'g');
  g.setAttribute('class', 'spike-arc');
  g.innerHTML = `<path d="M${a[0]} ${a[1]} Q${a[0] + (b[0] - a[0]) * 0.35} ${Math.min(a[1], b[1]) - 34} ${b[0]} ${b[1]}" style="stroke:${colour}"/>
    <circle cx="${a[0]}" cy="${a[1]}" r="4.5" style="fill:${colour}"/><circle cx="${b[0]}" cy="${b[1]}" r="4.5" style="fill:${PALETTES.pain[0]}"/>`;
  svg.append(g);
}

/** The days a pattern is about stay bright; the rest fades back, with a glow and a label on each of those days. */
function spotlight(svg, n, { days, label }) {
  const W = svg.viewBox.baseVal.width, x = plotX(svg, n), w = ((W - 8) / Math.max(1, n - 1)) * 1.9;
  const id = `spot-${Math.random().toString(36).slice(2, 8)}`;
  const g = document.createElementNS(NS, 'g');
  g.setAttribute('class', 'spot');
  g.innerHTML = `<defs>
      <mask id="${id}" maskUnits="userSpaceOnUse" x="0" y="0" width="${W}" height="196"><rect width="${W}" height="196" fill="#fff"/>${days.map(i => `<rect x="${x(i) - w / 2}" y="30" width="${w}" height="160" rx="${w / 2}" fill="#000"/>`).join('')}</mask>
      <linearGradient id="${id}-g" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#f4908a" stop-opacity="0"/><stop offset=".5" stop-color="#f4908a" stop-opacity=".14"/><stop offset="1" stop-color="#f4908a" stop-opacity="0"/></linearGradient>
    </defs>
    <rect class="spot-veil" x="0" y="40" width="${W}" height="140" mask="url(#${id})"/>
    ${days.map(i => `<rect x="${x(i) - w / 2}" y="40" width="${w}" height="140" rx="${w / 2}" fill="url(#${id}-g)"/><text class="spot-tag" x="${x(i)}" y="194" text-anchor="middle">${label}</text>`).join('')}`;
  const hair = svg.querySelector('.hair');
  if (hair) hair.before(g); else svg.append(g);
}

const daysFrom = (start, n) => Array.from({ length: n }, (_, i) => addDays(start, i));

// ---------- The four kinds ----------

/** Pain a day or two after something: the averages, then each of the last three times on its own chart. */
function lagPage(f, lag, data, today) {
  const x = f && explainLag(f, data, lag, today);
  if (!x) return null;
  const up = x.delta > 0, when = LATER[lag];
  const pain = painByDate(data.dailyEntries);
  // The times it happened: days with it, newest first, where the pain came the way the pattern goes
  const p = amountsOf(f, data);
  const on = d => (f.measureType === 'yesno' ? (p.get(d) || 0) > 0 : (p.get(d) || 0) > x.cut);
  const times = [];
  for (let d = addDays(today, -lag); times.length < 3 && d >= addDays(today, -56); d = addDays(d, -1)) {
    const later = pain.get(addDays(d, lag));
    if (on(d) && later != null && (up ? later > x.meanWithout : later < x.meanWithout)) times.push(d);
  }
  const sentence = `Your pain is ${pts(Math.abs(x.delta))} points ${up ? 'higher' : 'lower'} ${when} ${subjectPhrase(f)}.`;
  return {
    title: f.name,
    body: [
      storyCard(sentence, lag === 1 ? 'Pain the next day' : 'Pain two days later',
        [[`After ${lower(f.name)}`, x.meanWith, `with${up ? '' : ' lower'}`], ['Other days', x.meanWithout, 'without']]),
      ...times.map(d => {
        const dates = daysFrom(addDays(d, -2), 4 + lag + 1).filter(x => x <= today);
        const line = lineFor(f, data, dates);
        return chartCard(dayTitle(d), chart(data, dates, [line], dates.indexOf(addDays(d, lag)), { arc: { from: line, i: 2, lag } }));
      }),
    ],
  };
}

/** Two things together: the four averages, then the last fortnight, bright only on days with both. */
function comboPage(a, b, data, today) {
  const x = a && b && explainCombo(a, b, data, today);
  if (!x) return null;
  const up = x.delta > 0;
  const last = x.bothDays.at(-1);
  // The last fortnight, unless it has fewer than two days with both: then the fortnight around the latest
  const recent = x.bothDays.filter(d => daysBetween(d, today) < 14).length;
  const end = recent >= 2 || !last ? today : [addDays(last, 3), today].sort()[0];
  const dates = daysFrom(addDays(end, -13), 14);
  const both = x.bothDays.map(d => dates.indexOf(d)).filter(i => i >= 0);
  return {
    title: `${a.name} and ${lower(b.name)}`,
    body: [
      storyCard(`${a.name} and ${lower(b.name)} ${up ? 'hurt more' : 'help more'} together than either does alone.`, 'Average pain', [
        ['Both', x.means.both, `with${up ? '' : ' lower'}`],
        [`${a.name} only`, x.means.aOnly, 'without'],
        [`${b.name} only`, x.means.bOnly, 'without'],
        ['Neither', x.means.neither, 'without'],
      ]),
      chartCard('Last two weeks', chart(data, dates, [lineFor(a, data, dates, 0), lineFor(b, data, dates, 1)], both.at(-1) ?? dates.length - 1, { spot: both.length ? { days: both, label: 'Both' } : null })),
    ],
  };
}

/** What came before flares: how often, then each of the last three flares on its own chart. */
function flarePage(data, factors, today) {
  const x = flareRunUp(data, factors, today);
  if (!x) return null;
  const s = x.subject, phrase = s.measureType === 'minutes' || s.measureType === 'count' ? `${subjectPhrase(s)} than usual` : subjectPhrase(s);
  const sentence = x.k === x.n ? `Your last ${x.n} flares each came after two days of ${phrase}.` : `${x.k} of your last ${x.n} flares came after two days of ${phrase}.`;
  const base = x.base > 0 ? `1 in ${Math.max(2, Math.round(1 / x.base))}` : 'Rarely';
  return {
    title: `${s.name} before flares`,
    body: [
      storyCard(sentence, 'The two days before', [['Before a flare', (x.k / x.n) * 10, 'with', `${x.k} of ${x.n}`], ['Other times', x.base * 10, 'without', base]]),
      ...x.flares.filter(f => f.runUp).slice(0, 3).map(f => {
        const dates = daysFrom(addDays(f.start, -3), 6).filter(d => d <= today);
        const line = lineFor(s, data, dates);
        return chartCard(dayTitle(f.start), chart(data, dates, [line], 3, { arc: { from: line, i: 2, lag: 1 } }));
      }),
    ],
  };
}

/** Pain since a routine started: before and since, then the weeks either side with the routine's days. */
function trendPage(id, data, today) {
  const x = routineShifts(data, R.routines.all().filter(r => r.id === id), R.routines.doneDays(), today)[0];
  if (!x) return null;
  const up = x.delta > 0, name = x.routine.name;
  const startI = Math.min(28, daysBetween(addDays(x.start, -28), x.start));
  const dates = daysFrom(addDays(x.start, -startI), Math.min(56, startI + daysBetween(x.start, today) + 1));
  const done = new Set(R.routines.doneDays().filter(d => d.routineId === id).map(d => d.date));
  const routineDays = dates.map((d, i) => ({ i, items: [{ label: name, done: done.has(d), changed: d === x.start }] })).filter(d => d.items[0].done || d.items[0].changed);
  return {
    title: name,
    body: [
      storyCard(`Your pain has been ${pts(Math.abs(x.delta))} ${up ? 'higher' : 'lower'} since you started ${name} on ${longDay(x.start)}.`, 'Average pain',
        [['Since you started', x.since, up ? 'with' : 'with lower'], ['Before', x.before, 'without']]),
      chartCard(dates.length > 35 ? 'Before and since' : 'Since you started', chart(data, dates, [], startI, { routineDays, marks: [{ i: startI, texts: [`Started ${name}`] }] })),
    ],
  };
}

/** Every pattern for Home, newest kinds first: [{ id, kind, title, bad }]. */
export function patternsFor(data, factors, insights, today = localDate()) {
  const out = [];
  const flare = flareRunUp(data, factors, today);
  if (flare) out.push({ id: 'flare', kind: 'flare', title: flare.k === flare.n ? `Last ${flare.n} flares followed ${subjectPhrase(flare.subject)}` : `${subjectPhrase(flare.subject)[0].toUpperCase()}${subjectPhrase(flare.subject).slice(1)} before most flares`, bad: true });
  for (const x of insights) out.push({ id: x.id, kind: x.kind, title: x.title, bad: x.delta > 0 });
  for (const t of routineShifts(data, R.routines.all(), R.routines.doneDays(), today).slice(0, 1)) {
    out.push({ id: `trend.${t.routine.id}`, kind: 'trend', title: `Pain is ${t.delta < 0 ? 'down' : 'up'} ${pts(Math.abs(t.delta))} since ${t.routine.name}`, bad: t.delta > 0 });
  }
  return out.slice(0, 3);
}
