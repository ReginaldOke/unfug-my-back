// Dashboard: today's pain, trend, patterns, movement, routine, and one-tap Claude analysis.
import { h, segmented, sheet, toast, iconButton } from '../lib/ui.js';
import * as R from '../lib/repos.js';
import * as reminders from '../lib/reminders.js';
import { analyse, copyForClaude, aiStatus } from '../lib/ai.js';
import { rankInsights, quickSummary, MIN_DAYS } from '../lib/analysis.js';
import { renderMarkdown } from '../lib/markdown.js';
import { localDate, addDays, fmtTime, fmtMinutes, minutesSince, dayLabel } from '../lib/dates.js';
import { ROLE_ICON } from '../lib/labels.js';
import { PainChart } from './chart.js';
import { Ruler } from './controls.js';
import { insightSentence } from './factor.js';

// View state that should survive the periodic re-render
const ui = { range: 14 };
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
    h('div', { class: 'streak' }, h('span', { class: 'num' }, String(streak)), h('span', { class: 'hint' }, 'day streak')));
}

function trendCard(today) {
  const days = Array.from({ length: ui.range }, (_, i) => addDays(today, i - ui.range + 1))
    .map(date => ({ date, pain: R.checkins.entryFor(date)?.painScore ?? null }));
  const flareDates = new Set(R.flares.all().map(f => localDate(new Date(f.timestamp))));

  return h('section', { class: 'card glass' },
    h('div', { class: 'row between' }, h('h2', {}, 'Pain trend'),
      segmented([[14, '2W'], [30, '1M'], [90, '3M']], ui.range, v => { ui.range = v; rerender(); }, 'Range')),
    PainChart({ days, flareDates }));
}

function patternsCard(today) {
  const data = R.snapshot();
  const factors = R.factors.all();
  const { ready } = rankInsights(data, factors, today);
  const quick = quickSummary(data, factors, today);
  const checkins = data.dailyEntries.length;

  if (!checkins) {
    return h('section', { class: 'card glass' }, h('h2', {}, 'Patterns'),
      h('p', { class: 'muted' }, 'Do your first check-in tonight. Your main stressors show straight away; links with pain sharpen over the following days.'));
  }

  const summaryTile = (label, s, empty) => h('div', { class: 'mini-tile' },
    h('span', { class: 'eyebrow' }, label),
    s ? h('a', { class: 'mini-title', href: `#/factor/${s.factor.id}` }, s.factor.name) : h('span', { class: 'mini-title muted' }, empty),
    s ? h('span', { class: 'hint' }, `${s.days} of last ${Math.min(quick.days, checkins)} days${s.factor.measureType === 'minutes' ? ` · avg ${fmtMinutes(s.avg)}` : ''}`) : null);

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
    h('div', { class: 'mini-grid' },
      summaryTile('Main stressor', quick.mainStressor, 'None logged yet'),
      summaryTile('Top helper', quick.topHelper, 'None logged yet')),
    list.length ? h('ul', { class: 'list' }, list)
      : h('p', { class: 'hint' }, 'Links with pain appear once a stressor has been logged on at least 2 days, and skipped on 2.'),
    ready.some(a => a.early) ? h('p', { class: 'hint' }, `Early signs are based on a few days and may change. They firm up after ${MIN_DAYS} days with and ${MIN_DAYS} without.`) : null);
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
      h('button', { type: 'button', class: 'well action', 'aria-label': 'I just moved', title: 'I just moved', onclick: () => { reminders.markMoved(); toast('Nice. Timer reset.'); } }, '↻')),
    h('div', {}, h('span', { class: 'num' }, still == null ? '–' : String(Math.min(999, Math.round(still)))), h('span', { class: 'unit' }, 'min')),
    Ruler({ value: still ?? 0, max: s.reminder.intervalMin, alertAt: s.reminder.intervalMin }),
    h('span', { class: 'hint' }, next),);
}

function routineTile(today) {
  const r = R.routines.all()[0];
  if (!r) return h('a', { class: 'tile static', href: '#/routine/new' }, h('span', { class: 'eyebrow' }, 'Routine'), h('span', { class: 'tile-title' }, '+ Create a movement routine'));
  const done = R.routines.completionsOn(today, r.id).length;
  return h('div', { class: 'tile static' },
    h('div', { class: 'tile-top' }, h('span', { class: 'eyebrow' }, 'Routine'), h('a', { class: 'well action', href: `#/routine/${r.id}/run`, 'aria-label': `Start ${r.name}` }, '▶')),
    h('div', {}, h('span', { class: 'num' }, String(done)), h('span', { class: 'unit' }, `/${r.schedule.length} today`)),
    h('div', { class: 'seg-dots', 'aria-hidden': 'true' }, r.schedule.map((_, i) => h('i', { class: i < done ? 'on' : '' }))),
    h('span', { class: 'tile-title link' }, r.name));
}

function claudeTile() {
  const last = R.aiSummaries.latest();
  return h('button', { type: 'button', class: 'tile static claude', onclick: () => (last ? showSummary(last) : openAnalysis()) },
    h('div', { class: 'tile-top' }, h('span', { class: 'eyebrow' }, 'Claude'), h('span', { class: 'well action', 'aria-hidden': 'true' }, '✳︎')),
    h('span', { class: 'tile-title' }, 'Analyse my data'),
    h('span', { class: 'hint' }, last ? `Read ${dayLabel(localDate(new Date(last.createdAt))).toLowerCase()}’s summary` : 'Trends + routine tips'));
}

/** One tap from the dashboard. First time only, a consent step: what is sent, and where. */
async function openAnalysis() {
  const s = R.settings();
  const n = R.checkins.all().length;
  if (!n) return toast('Do a check-in first, then Claude has something to read.');
  if (!s.aiConsent) {
    sheet(close => h('div', { class: 'stack' },
      h('h2', {}, 'Send your diary to Claude?'),
      h('p', { class: 'muted' }, `Your ${n} check-ins, stressors, helpers, notes and pain spots go to Claude (Anthropic) through this computer’s local server. Nothing is sent until you tap Analyse, and nothing is sent automatically.`),
      h('div', { class: 'row end' },
        h('button', { type: 'button', class: 'btn ghost', onclick: close }, 'Not now'),
        h('button', { type: 'button', class: 'btn primary', onclick: () => { R.setSettings({ aiConsent: true }); close(); runAnalysis(); } }, 'Analyse'))));
    return;
  }
  runAnalysis();
}

async function runAnalysis() {
  const status = h('p', { class: 'muted center' }, `Claude is reading ${R.checkins.all().length} days…`);
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
      h('h2', {}, noKey ? 'Claude isn’t connected yet' : 'That didn’t work'),
      h('p', { class: 'muted' }, noKey && !ai
        ? 'Start the server with an Anthropic API key to see the summary here. For now, copy your diary and paste it into Claude.'
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
    h('div', { class: 'row between' }, h('h2', {}, 'Claude’s take'), iconButton('✕', 'Close', close)),
    h('p', { class: 'hint' }, `${dayLabel(localDate(new Date(summary.createdAt)))} · ${summary.checkins} check-ins · Not medical advice.`),
    md,
    h('button', { type: 'button', class: 'btn glass', onclick: () => { close(); openAnalysis(); } }, 'Analyse again with latest data')));
}

