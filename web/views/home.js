// Dashboard: today's pain, trend, patterns, movement, routine, and one-tap Claude analysis.
import { h, segmented, sheet, toast, iconButton } from '../lib/ui.js';
import * as R from '../lib/repos.js';
import * as reminders from '../lib/reminders.js';
import { analyse, copyForClaude, aiStatus } from '../lib/ai.js';
import { rankInsights, quickSummary, MIN_DAYS } from '../lib/analysis.js';
import { renderMarkdown } from '../lib/markdown.js';
import { localDate, addDays, fmtTime, fmtMinutes, minutesSince, dayLabel } from '../lib/dates.js';
import { ROLE_ICON, fmtAmount } from '../lib/labels.js';
import { TrendChart, PALETTES } from './chart.js';
import { Ruler } from './controls.js';
import { insightSentence } from './factor.js';
import { justFinished } from './routines.js';

// View state that should survive the periodic re-render
const ui = { range: 14, hidden: new Set() };
let rerender = () => {};

export function HomeView(ctx) {
  const root = h('div', { class: 'view home' });
  const render = () => root.replaceChildren(...build().filter(Boolean));
  rerender = render;
  render();
  ctx.onCleanup(R.subscribe(render));
  const t = setInterval(render, 30_000);
  ctx.onCleanup(() => clearInterval(t));
  return root;
}

function build() {
  const today = localDate();
  const entry = R.checkins.entryFor(today);
  return [
    h('header', { class: 'top-bar' },
      h('div', {}, h('p', { class: 'eyebrow' }, new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })), h('h1', { class: 'wordmark' }, 'Unfug My Back'))),
    hero(entry, today),
    trendCard(today),
    patternsCard(today),
    h('div', { class: 'tile-grid quad' }, movementTile(), routineTile(today), claudeTile()),
  ];
}

function hero(entry, today) {
  const streak = R.checkins.streak(today);
  const last7 = R.checkins.all().filter(e => e.date < today && e.date >= addDays(today, -7) && e.painScore != null);
  const avg = last7.length ? last7.reduce((a, e) => a + e.painScore, 0) / last7.length : null;
  const delta = entry?.painScore != null && avg != null ? entry.painScore - avg : null;

  return h('section', { class: 'hero' },
    h('div', { class: 'hero-num' },
      h('span', { class: 'eyebrow' }, entry ? 'Pain today' : 'Not checked in yet'),
      h('div', {}, h('span', { class: 'giant' }, entry?.painScore ?? '–'), h('span', { class: 'unit' }, '/10')),
      delta != null ? h('span', { class: `pill-badge ${delta > 0 ? 'up' : 'down'}` }, `${delta > 0 ? '↑' : '↓'} ${Math.abs(delta).toFixed(1)} vs 7-day avg`) : null),
    h('div', { class: 'hero-side' },
      h('div', { class: 'streak' }, h('span', { class: 'num' }, String(streak)), h('span', { class: 'hint' }, 'day streak')),
      // Before the first check-in, the big button over the sample chart is the call to action
      R.checkins.all().length ? h('a', { class: 'btn primary', href: '#/checkin' }, entry ? 'Edit check-in' : 'Check in · 1 min') : null));
}

/** Before the first check-in: sample curves under frosted glass, with the one thing to do next. */
function sampleTrendCard(today) {
  const days = Array.from({ length: 14 }, (_, i) => ({ date: addDays(today, i - 13), logged: true }));
  const wave = (a, b, c) => days.map((_, i) => Math.max(0.05, Math.min(0.95, a + b * Math.sin(i / 2.1 + c) + 0.08 * Math.sin(i * 1.3 + c * 2))));
  const series = [
    { key: 'pain', label: 'Pain', palette: PALETTES.pain, values: wave(0.45, 0.2, 0.4), format: () => '' },
    { key: 'stressor', label: 'Long sitting', palette: PALETTES.stressor, values: wave(0.5, 0.25, -0.6), format: () => '' },
    { key: 'helper', label: 'Walking', palette: PALETTES.helper, values: wave(0.3, 0.16, 2.2), format: () => '' },
  ];
  return h('section', { class: 'card glass trend-card is-sample' },
    h('div', { class: 'row between' }, h('h2', {}, 'Trends'), h('span', { class: 'tag' }, 'Sample')),
    h('div', { class: 'sample-wrap' },
      h('div', { class: 'sample-chart', 'aria-hidden': 'true', inert: true }, TrendChart({ days, series })),
      h('div', { class: 'frost' }, h('a', { class: 'btn primary big', href: '#/checkin' }, 'Check in · 1 min'))));
}

function trendCard(today) {
  if (!R.checkins.all().length) return sampleTrendCard(today);
  const dates = Array.from({ length: ui.range }, (_, i) => addDays(today, i - ui.range + 1));
  const entries = dates.map(d => R.checkins.entryFor(d));
  const days = dates.map((date, i) => ({ date, logged: !!entries[i] }));
  const { mainStressor, topHelper } = quickSummary(R.snapshot(), R.factors.all(), today, ui.range);

  // Pain on its 0–10 scale; each factor scaled to its own busiest day in the range, so shapes compare
  const series = [{
    key: 'pain', label: 'Pain', palette: PALETTES.pain,
    values: entries.map(e => (e?.painScore == null ? null : e.painScore / 10)),
    format: i => `${entries[i]?.painScore ?? '–'}/10`,
  }];
  for (const [key, pick] of [['stressor', mainStressor], ['helper', topHelper]]) {
    if (!pick) continue;
    const f = pick.factor;
    const amounts = dates.map(d => R.checkins.factorValues(d).get(f.id) ?? 0);
    const max = Math.max(...amounts, 1);
    const raw = amounts.map(a => (f.measureType === 'yesno' ? (a ? 0.6 : 0) : a / max));
    // Light smoothing over neighbouring logged days so the curve reads as a trend, not spikes;
    // the readout still shows each day's real amount
    const smooth = raw.map((v, i) => {
      const near = [[i - 1, 0.25], [i, 0.5], [i + 1, 0.25]].filter(([j]) => days[j]?.logged);
      const w = near.reduce((t, [, k]) => t + k, 0);
      return w ? near.reduce((t, [j, k]) => t + raw[j] * k, 0) / w : v;
    });
    series.push({
      key, label: f.name, palette: PALETTES[key],
      values: smooth.map(v => 0.04 + v * 0.86),
      format: i => (amounts[i] ? fmtAmount(f, amounts[i]) : 'none'),
    });
  }

  return h('section', { class: 'card glass trend-card' },
    h('div', { class: 'row between' }, h('h2', {}, 'Trends'),
      segmented([[14, '2W'], [30, '1M'], [90, '3M']], ui.range, v => { ui.range = v; rerender(); }, 'Range')),
    TrendChart({
      days, series, hidden: ui.hidden,
      onToggle: key => { ui.hidden.has(key) ? ui.hidden.delete(key) : ui.hidden.add(key); rerender(); },
    }));
}

function patternsCard(today) {
  const data = R.snapshot();
  const factors = R.factors.all();
  const { ready } = rankInsights(data, factors, today);
  const quick = quickSummary(data, factors, today);
  const checkins = data.dailyEntries.length;

  if (!checkins) {
    return h('section', { class: 'card glass' }, h('h2', {}, 'Patterns'),
      h('p', { class: 'muted' }, 'Check in tonight. After a few days you’ll see which activities line up with worse pain.'));
  }

  const span = Math.min(quick.days, checkins);
  const summaryCol = (label, s, palette) => h('div', { class: 'sum-col' },
    h('span', { class: 'sum-label' }, h('i', { style: `background:linear-gradient(90deg,${palette[0]},${palette[1]})` }), label),
    s ? h('a', { class: 'sum-name', href: `#/factor/${s.factor.id}` }, s.factor.name) : h('span', { class: 'sum-name muted' }, 'Nothing yet'),
    s ? h('span', { class: 'hint' }, [
      s.days === span ? (span === 1 ? 'Today' : 'Every day') : `${s.days} of ${span} days`,
      s.factor.measureType === 'minutes' ? `avg ${fmtMinutes(s.avg)}` : null,
    ].filter(Boolean).join(' · ')) : null);

  const list = ready.slice(0, 4).map(a => h('li', {},
    h('a', { class: 'list-row insight', href: `#/factor/${a.factor.id}` },
      h('span', { class: `role-dot role-${a.factor.role}`, 'aria-hidden': 'true' }, ROLE_ICON[a.factor.role]),
      h('span', { class: 'grow' },
        h('strong', {}, a.factor.name), a.early ? h('span', { class: 'tag' }, 'Early sign') : null,
        h('span', { class: 'hint block' }, insightSentence(a))),
      h('span', { class: `delta ${a.best.delta > 0 ? 'up' : 'down'}` }, `${a.best.delta > 0 ? '+' : ''}${a.best.delta.toFixed(1)}`),
      h('span', { class: 'chev', 'aria-hidden': 'true' }, '›'))));

  return h('section', { class: 'card glass' },
    h('div', { class: 'row between' }, h('h2', {}, 'Patterns'), h('span', { class: 'hint' }, `${checkins} check-in${checkins === 1 ? '' : 's'}`)),
    h('div', { class: 'sum-row' },
      summaryCol('Main stressor', quick.mainStressor, PALETTES.stressor),
      summaryCol('Top helper', quick.topHelper, PALETTES.helper)),
    list.length ? h('ul', { class: 'list' }, list)
      : h('p', { class: 'hint' }, 'Nothing to compare yet. Each activity needs at least 2 days with it and 2 without.'),
    ready.some(a => a.early) ? h('p', { class: 'hint' }, `Early signs come from only a few days, so they may change. They’re more reliable after ${MIN_DAYS} days with and ${MIN_DAYS} without.`) : null);
}

function movementTile() {
  const s = R.settings();
  const { pending } = reminders.status();
  const still = s.lastMovementAt ? minutesSince(s.lastMovementAt) : null;
  const paused = s.pausedUntil && new Date(s.pausedUntil) > new Date();
  let next = 'Off';
  if (s.reminder.enabled && paused) next = `Paused until ${fmtTime(s.pausedUntil)}`;
  else if (s.reminder.enabled && pending) next = `Next nudge ${fmtTime(pending.scheduledFor)}`;

  return h('div', { class: 'tile static' },
    h('div', { class: 'tile-top' }, h('span', { class: 'eyebrow' }, 'Still for'),
      h('button', { type: 'button', class: 'well action', 'aria-label': 'I just moved', title: 'I just moved', onclick: () => { reminders.markMoved(); toast('Timer reset'); } }, '↻')),
    h('div', {}, h('span', { class: 'num' }, still == null ? '–' : String(Math.min(999, Math.round(still)))), h('span', { class: 'unit' }, 'min')),
    Ruler({ value: still ?? 0, max: s.reminder.intervalMin, alertAt: s.reminder.intervalMin }),
    h('span', { class: 'hint' }, next),);
}

function routineTile(today) {
  const r = R.routines.all()[0];
  if (!r) return h('a', { class: 'tile static', href: '#/routine/new' }, h('span', { class: 'eyebrow' }, 'Routine'), h('span', { class: 'tile-title' }, '+ Create a movement routine'));
  const done = R.routines.completionsOn(today, r.id).length;
  const target = Math.max(1, r.schedule.length);
  const allDone = done >= target;
  const week = Array.from({ length: 7 }, (_, i) => R.routines.completionsOn(addDays(today, -i), r.id).length).reduce((a, b) => a + b, 0);
  // Play the celebration once, on the first render after finishing a routine
  const celebrate = justFinished.id === r.id;
  if (celebrate) setTimeout(() => { justFinished.id = null; }, 1600);
  return h('div', { class: `tile static routine-tile${allDone ? ' all-done' : ''}${celebrate ? ' celebrate' : ''}` },
    h('div', { class: 'tile-top' }, h('span', { class: 'eyebrow' }, 'Routine'),
      allDone
        ? h('span', { class: 'well action done-mark', 'aria-hidden': 'true' }, '✓')
        : h('a', { class: 'well action', href: `#/routine/${r.id}/run`, 'aria-label': `Start ${r.name}` }, '▶')),
    allDone
      ? h('div', {}, h('span', { class: 'done-title' }, 'Done for today'))
      : h('div', {}, h('span', { class: 'num' }, String(done)), h('span', { class: 'unit' }, `/${target} today`)),
    h('div', { class: 'seg-dots', 'aria-label': `${done} of ${target} done today` },
      Array.from({ length: target }, (_, i) => h('i', { class: `${i < done ? 'on' : ''}${celebrate && i === done - 1 ? ' fresh' : ''}` }))),
    h('span', { class: 'tile-title link' }, `${r.name} · ${week} this week`),
    celebrate ? h('span', { class: 'sr-only', role: 'status' }, `${r.name} done. Logged as a helper.`) : null);
}

function claudeTile() {
  const last = R.aiSummaries.latest();
  return h('button', { type: 'button', class: 'tile static claude', onclick: () => (last ? showSummary(last) : openAnalysis()) },
    h('div', { class: 'tile-top' }, h('span', { class: 'eyebrow' }, 'Claude'), h('span', { class: 'well action', 'aria-hidden': 'true' }, '✳︎')),
    h('span', { class: 'tile-title' }, 'Analyse my data'),
    h('span', { class: 'hint' }, last ? `Read ${dayLabel(localDate(new Date(last.createdAt))).toLowerCase()}’s summary` : 'Summary and routine ideas'));
}

/** One tap from the dashboard. First time only, a consent step: what is sent, and where. */
async function openAnalysis() {
  const s = R.settings();
  const n = R.checkins.all().length;
  if (!n) return toast('Check in at least once first');
  if (!s.aiConsent) {
    sheet(close => h('div', { class: 'stack' },
      h('h2', {}, 'Send your diary to Claude?'),
      h('p', { class: 'muted' }, `This sends your ${n} check-ins, including notes and pain spots, to Claude (Anthropic). Nothing is sent unless you tap Analyse.`),
      h('div', { class: 'row end' },
        h('button', { type: 'button', class: 'btn ghost', onclick: close }, 'Not now'),
        h('button', { type: 'button', class: 'btn primary', onclick: () => { R.setSettings({ aiConsent: true }); close(); runAnalysis(); } }, 'Analyse'))));
    return;
  }
  runAnalysis();
}

async function runAnalysis() {
  const status = h('p', { class: 'muted center' }, `Analysing ${R.checkins.all().length} days…`);
  const { close, dlg } = sheet(() => h('div', { class: 'stack center' }, h('div', { class: 'orb', 'aria-hidden': 'true' }), status));
  try {
    const summary = await analyse();
    if (!dlg.open) return;
    close();
    showSummary(summary);
  } catch (e) {
    if (!dlg.open) return;
    const noKey = e.code === 'no_credentials' || e.code === 'offline';
    const { ai } = noKey ? await aiStatus() : { ai: true };
    dlg.lastElementChild.replaceWith(h('div', { class: 'stack' },
      h('h2', {}, noKey ? 'Paste it into Claude instead' : 'That didn’t work'),
      h('p', { class: 'muted' }, noKey && !ai
        ? 'The app can’t reach Claude directly yet. Copy your diary and paste it into a new Claude chat.'
        : e.message),
      h('div', { class: 'row end' },
        h('button', { type: 'button', class: 'btn ghost', onclick: close }, 'Close'),
        noKey ? h('button', { type: 'button', class: 'btn primary', onclick: async () => { await copyForClaude(); toast('Copied. Paste it into Claude.'); close(); } }, 'Copy & open Claude')
          : h('button', { type: 'button', class: 'btn primary', onclick: () => { close(); runAnalysis(); } }, 'Try again'))));
  }
}

function showSummary(summary) {
  const md = h('div', { class: 'md' });
  md.innerHTML = renderMarkdown(summary.text);
  sheet(close => h('div', { class: 'stack' },
    h('div', { class: 'row between' }, h('h2', {}, 'Claude’s summary'), iconButton('✕', 'Close', close)),
    h('p', { class: 'hint' }, `${dayLabel(localDate(new Date(summary.createdAt)))} · ${summary.checkins} check-ins · Not medical advice.`),
    md,
    h('button', { type: 'button', class: 'btn glass', onclick: () => { close(); openAnalysis(); } }, 'Analyse again with latest data')));
}

