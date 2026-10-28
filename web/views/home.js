// Dashboard: today's pain, trend, patterns, movement, routine, and sharing the diary with an AI chat.
import { h, segmented, sheet, toast, iconButton } from '../lib/ui.js';
import * as R from '../lib/repos.js';
import * as reminders from '../lib/reminders.js';
import { shareDiary, copyDiary } from '../lib/ai.js';
import { HEALTH_IMPORT } from '../lib/health.js';
import { notificationStatus } from '../lib/notify.js';
import { rankInsights, quickSummary, painSentence, MIN_DAYS } from '../lib/analysis.js';
import { localDate, addDays, fmtTime, fmtMinutes, minutesSince } from '../lib/dates.js';
import { ROLE_ICON, fmtAmount } from '../lib/labels.js';
import { TrendChart, PALETTES, EXTRA_PALETTES } from './chart.js';
import { PainCalendar } from './calendar.js';
import { Ruler, SelectCard, PENCIL } from './controls.js';
import { openReminderSheet, hoursSummary } from './reminder-sheet.js';
import { insightSentence } from './factor.js';
import { justFinished } from './routines.js';
import { dragHandles } from './sortable.js';
import { ScratchPad, seedNotes } from './pad.js';

// View state that should survive the periodic re-render
const ui = { range: 7, hidden: new Set(), view: 'chart', month: localDate().slice(0, 7), day: null };
let rerender = () => {};

// Sections the user can rearrange by holding and dragging, in the default order
const SECTIONS = ['hero', 'trend', 'tiles', 'patterns', 'pad', 'ai'];

/** The saved order. Sections added since go in after the one they follow by default. */
function sectionOrder() {
  const order = (R.settings().homeOrder ?? []).filter(k => SECTIONS.includes(k));
  SECTIONS.forEach((k, i) => {
    if (order.includes(k)) return;
    const after = SECTIONS.slice(0, i).reverse().find(p => order.includes(p));
    order.splice(after ? order.indexOf(after) + 1 : 0, 0, k);
  });
  return order;
}

export function HomeView(ctx) {
  const root = h('div', { class: 'view home' });
  // One container for the sections, so the drag listeners survive re-renders
  const sections = h('div', { class: 'home-sections' });
  let dragging = false;
  dragHandles(sections, {
    hold: true,
    onLift: () => { dragging = true; },
    // Redraw once the card has glided into its slot (the save during the drag was skipped)
    onDrop: () => { dragging = false; setTimeout(() => render(), 360); },
    onReorder: rows => R.setSettings({ homeOrder: rows.map(r => r.dataset.section) }),
  });
  seedNotes();
  const render = () => {
    // Never rebuild under the finger, or while a note is being typed
    if (dragging || sections.querySelector('.pad-input')) return;
    const { top, parts } = build();
    sections.replaceChildren(...sectionOrder().map(k => parts[k]));
    root.replaceChildren(...[...top, sections].filter(Boolean));
  };
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
  const section = (key, el) => { el.classList.add('drag-row', 'home-section'); el.dataset.section = key; return el; };
  return {
    top: [
      h('header', { class: 'top-bar' }, h('h1', { class: 'wordmark' }, 'Unfug My Back')),
      notifyNudge(),
    ],
    parts: {
      hero: section('hero', hero(entry, today)),
      pad: section('pad', ScratchPad()),
      trend: section('trend', trendCard(today)),
      tiles: section('tiles', h('div', { class: 'tile-grid quad' }, movementTile(), routineTile(today))),
      patterns: section('patterns', patternsCard(today)),
      ai: section('ai', h('div', { class: 'tile-grid' }, aiTile())),
    },
  };
}

function hero(entry, today) {
  const streak = R.checkins.streak(today);
  const last7 = R.checkins.all().filter(e => e.date < today && e.date >= addDays(today, -7) && e.painScore != null);
  const avg = last7.length ? last7.reduce((a, e) => a + e.painScore, 0) / last7.length : null;
  const delta = entry?.painScore != null && avg != null ? entry.painScore - avg : null;

  return h('section', { class: 'hero' },
    h('div', { class: 'hero-num' },
      entry ? h('span', { class: 'eyebrow' }, 'Pain today') : null,
      h('div', {}, h('span', { class: 'giant' }, entry?.painScore ?? '–'), h('span', { class: 'unit' }, '/10')),
      delta != null ? h('span', { class: `pill-badge ${delta > 0 ? 'up' : 'down'}` }, `${delta > 0 ? '↑' : '↓'} ${Math.abs(delta).toFixed(1)} vs 7-day avg`) : null),
    h('div', { class: 'hero-side' },
      h('div', { class: 'streak' }, h('span', { class: 'num' }, String(streak)), h('span', { class: 'hint' }, 'day streak')),
      // Before the first check-in, the big button over the sample chart is the call to action
      R.checkins.all().length ? h('a', { class: 'btn primary', href: '#/checkin' }, entry ? 'Edit check-in' : 'Check in') : null));
}

const BELL = () => {
  const el = h('span', { class: 'nudge-icon', 'aria-hidden': 'true' });
  el.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15L6 16Z"/><path d="M10 20.5a2 2 0 0 0 4 0"/></svg>';
  return el;
};

/** After the first check-in, a quiet prompt to allow notifications, until it's answered or dismissed. */
function notifyNudge() {
  if (!R.checkins.all().length || notificationStatus() !== 'default' || R.settings().notifyNudgeDismissed) return null;
  const dismiss = () => R.setSettings({ notifyNudgeDismissed: true });
  return h('div', { class: 'nudge glass' },
    BELL(),
    h('span', { class: 'grow' }, 'Get a nudge to move, and one to check in each evening.'),
    h('button', { type: 'button', class: 'btn small glass', onclick: async () => { await Notification.requestPermission(); dismiss(); } }, 'Turn on'),
    iconButton('✕', 'Not now', dismiss, { class: 'icon-btn plain' }));
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
      h('div', { class: 'frost' }, h('a', { class: 'btn primary big', href: '#/checkin' }, 'Check in'))));
}

const CAL_ICON = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><rect x="3.5" y="5" width="17" height="15.5" rx="3.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/></svg>';
const CHART_ICON = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M3 17c3-6 5-8 8-4s5 1 10-7"/><path d="M3 21h18"/></svg>';

/** Switches the Trends card between the line chart and the pain calendar. */
function viewToggle() {
  const cal = ui.view === 'calendar';
  const btn = h('button', {
    type: 'button', class: 'icon-btn glass view-toggle', 'aria-label': cal ? 'Show chart' : 'Show calendar', title: cal ? 'Chart' : 'Calendar',
    onclick: () => { ui.view = cal ? 'chart' : 'calendar'; ui.day = null; rerender(); },
  });
  btn.innerHTML = cal ? CHART_ICON : CAL_ICON;
  return btn;
}

function calendarCard() {
  return h('section', { class: 'card glass trend-card' },
    h('div', { class: 'row between' }, h('h2', {}, 'Pain calendar'), viewToggle()),
    PainCalendar({
      month: ui.month, selected: ui.day,
      onMonth: m => { ui.month = m; ui.day = null; rerender(); },
      onSelect: d => { ui.day = d; rerender(); },
    }));
}

function trendCard(today) {
  const all = R.checkins.all();
  if (!all.length) return sampleTrendCard(today);
  if (ui.view === 'calendar') return calendarCard();
  // Until there's a full range of history, the range starts at the first check-in, so early data sits
  // on the left with the coming days still empty on the right
  const first = all[0].date;
  const start = [addDays(today, 1 - ui.range), first].sort()[1];
  const dates = Array.from({ length: ui.range }, (_, i) => addDays(start, i));
  const entries = dates.map(d => (d <= today ? R.checkins.entryFor(d) : null));
  const days = dates.map((date, i) => ({ date, logged: !!entries[i] }));
  const { mainStressor, topHelper } = quickSummary(R.snapshot(), R.factors.all(), today, ui.range);

  // Pain on its 0–10 scale; each factor scaled to its own busiest day in the range, so shapes compare
  const series = [{
    key: 'pain', label: 'Pain', palette: PALETTES.pain,
    values: entries.map(e => (e?.painScore == null ? null : e.painScore / 10)),
    format: i => `${entries[i]?.painScore ?? '–'}/10`,
  }];
  const factorSeries = (key, f, palette) => {
    const amounts = dates.map(d => R.checkins.factorValues(d).get(f.id) ?? 0);
    // Scaled to the busiest day, but at least 2 hours (or 5 times), so a short first day sits low
    const max = Math.max(...amounts, { minutes: 120, count: 5 }[f.measureType] ?? 1);
    const raw = amounts.map(a => (f.measureType === 'yesno' ? (a ? 0.6 : 0) : a / max));
    // Light smoothing over neighbouring logged days so the curve reads as a trend, not spikes;
    // the key still shows each day's real amount
    const smooth = raw.map((v, i) => {
      const near = [[i - 1, 0.25], [i, 0.5], [i + 1, 0.25]].filter(([j]) => days[j]?.logged);
      const w = near.reduce((t, [, k]) => t + k, 0);
      return w ? near.reduce((t, [j, k]) => t + raw[j] * k, 0) / w : v;
    });
    return {
      key, label: f.name, palette,
      values: smooth.map(v => 0.04 + v * 0.86),
      format: i => (amounts[i] ? fmtAmount(f, amounts[i]) : 'none'),
    };
  };
  if (mainStressor) series.push(factorSeries('stressor', mainStressor.factor, PALETTES.stressor));
  if (topHelper) series.push(factorSeries('helper', topHelper.factor, PALETTES.helper));

  // Lines the user added from the + in the key
  const auto = new Set([mainStressor?.factor.id, topHelper?.factor.id]);
  const extras = (R.settings().chartExtras ?? []).filter(x => METRICS.includes(x) || (R.factors.get(x) && !R.factors.get(x).isArchived && !auto.has(x)));
  extras.forEach((x, i) => {
    const palette = EXTRA_PALETTES[i % EXTRA_PALETTES.length];
    if (x === 'stress') {
      series.push({
        key: 'stress', label: 'Stress', palette,
        values: entries.map(e => (e?.stressScore == null ? null : e.stressScore / 10)),
        format: i => `${entries[i]?.stressScore ?? '–'}/10`,
      });
    } else if (x === 'sleep') {
      const scores = dates.map(d => R.checkins.sleepFor(d));
      series.push({
        key: 'sleep', label: 'Sleep', palette,
        values: scores.map(v => (v == null ? null : v / 10)),
        format: i => (scores[i] == null ? '–' : `${scores[i]}/10`),
      });
    } else if (x === 'sleepHours') {
      const hours = dates.map(d => R.health.day(d)?.sleepHours ?? null);
      series.push({
        key: 'sleepHours', label: 'Hours slept', palette,
        values: hours.map(v => (v == null ? null : 0.04 + Math.min(1, v / 12) * 0.86)),
        format: i => (hours[i] == null ? '–' : `${hours[i]} h`),
      });
    } else if (x === 'steps') {
      const steps = dates.map(d => R.health.day(d)?.steps ?? null);
      // Scaled to the busiest day, but at least 10,000, so an ordinary day doesn't hit the top
      const max = Math.max(10_000, ...steps.filter(v => v != null));
      series.push({
        key: 'steps', label: 'Steps', palette,
        values: steps.map(v => (v == null ? null : 0.04 + (v / max) * 0.86)),
        format: i => (steps[i] == null ? '–' : steps[i].toLocaleString()),
      });
    } else series.push(factorSeries(`x-${x}`, R.factors.get(x), palette));
  });

  const changes = R.routines.changesByDate();
  const marks = dates.flatMap((d, i) => (d <= today && changes.has(d)
    ? [{ i, text: changes.get(d).map(c => `${c.name}: ${c.summary}`).join(' · ') }] : []));

  return h('section', { class: 'card glass trend-card' },
    h('div', { class: 'row between' }, h('h2', {}, 'Trends'),
      h('div', { class: 'row tight' },
        viewToggle(),
        segmented([[7, '1W'], [30, '1M'], [90, '3M']], ui.range, v => { ui.range = v; rerender(); }, 'Range'))),
    TrendChart({
      days, series, hidden: ui.hidden,
      focus: dates.indexOf(today), fadeLeft: start > first, marks,
      onToggle: key => { ui.hidden.has(key) ? ui.hidden.delete(key) : ui.hidden.add(key); rerender(); },
      onAdd: () => openLinePicker([...auto].filter(Boolean)),
    }));
}

// Chart lines that aren't stressors or helpers
const METRICS = ['stress', 'sleep', 'sleepHours', 'steps'];

/** Pick extra lines for the chart: stress, sleep, steps, or any stressor or helper. */
function openLinePicker(autoIds) {
  const chosen = new Set(R.settings().chartExtras ?? []);
  const save = () => { R.setSettings({ chartExtras: [...chosen] }); };
  const options = [
    { id: 'stress', icon: '🌀', title: 'Stress', detail: 'From your check-ins' },
    { id: 'sleep', icon: '🌙', title: 'Sleep', detail: 'How well, out of 10' },
    ...(HEALTH_IMPORT && R.health.has('sleepHours') ? [{ id: 'sleepHours', icon: '🛌', title: 'Hours slept', detail: 'From Apple Health' }] : []),
    ...(HEALTH_IMPORT && R.health.has('steps') ? [{ id: 'steps', icon: '👟', title: 'Steps', detail: 'From Apple Health' }] : []),
    ...R.factors.all().filter(f => !autoIds.includes(f.id)).map(f => ({
      id: f.id, icon: f.icon || ROLE_ICON[f.role], title: f.name, detail: f.role === 'helper' ? 'Helper' : 'Stressor',
    })),
  ];
  sheet(close => h('div', { class: 'stack' },
    h('h2', {}, 'Add to chart'),
    h('p', { class: 'hint' }, 'Pain, your main stressor and your top helper are always there.'),
    h('div', { class: 'card-grid' }, options.map(o => SelectCard({
      icon: o.icon, title: o.title, detail: o.detail, on: chosen.has(o.id),
      onToggle: on => { on ? chosen.add(o.id) : chosen.delete(o.id); save(); },
    }))),
    !HEALTH_IMPORT || R.health.has('steps') ? null : h('a', { class: 'list-row', href: '#/health', onclick: close },
      h('span', { class: 'grow' }, 'Steps', h('span', { class: 'hint block' }, 'Bring them in from Apple Health')), h('span', { class: 'chev', 'aria-hidden': 'true' }, '›'))), { onClose: () => rerender() });
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

  // The headline: what goes with higher and lower pain, in one plain sentence
  const said = painSentence(data, factors, today);
  const sentence = said && h('div', { class: 'pattern-sentence' },
    h('p', {}, said.parts.map(p => (typeof p === 'string' ? p : h('strong', {}, p.b)))),
    h('p', { class: 'hint' }, said.basis));

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
    sentence,
    list.length ? h('ul', { class: 'list' }, list) : null,
    ready.some(a => a.early) ? h('p', { class: 'hint' }, `Early signs come from only a few days, so they may change. They’re more reliable after ${MIN_DAYS} days with and ${MIN_DAYS} without.`) : null);
}

function movementTile() {
  const s = R.settings();
  const { pending } = reminders.status();
  const sinceMove = s.lastMovementAt ? minutesSince(s.lastMovementAt) : 0;
  const paused = s.pausedUntil && new Date(s.pausedUntil) > new Date();
  const left = pending ? Math.max(0, Math.ceil((new Date(pending.scheduledFor) - Date.now()) / 60_000)) : null;
  // Outside the nudge hours the next one is hours away: show its time instead of a countdown
  const later = left != null && left > s.reminder.intervalMin;

  let eyebrow = 'Move in', big = left == null ? '–' : String(left), unit = 'min', hint = hoursSummary(s.reminder);
  if (!s.reminder.enabled) { eyebrow = 'Move nudges'; big = 'Off'; unit = ''; hint = 'Tap to turn on'; }
  else if (paused) { eyebrow = 'Move nudges'; big = 'Paused'; unit = ''; hint = `Until ${fmtTime(s.pausedUntil)}`; }
  else if (later) { eyebrow = 'Next nudge'; big = fmtTime(pending.scheduledFor); unit = ''; }

  return h('button', { type: 'button', class: 'tile static move-tile', 'aria-label': `${eyebrow} ${big} ${unit}. Reminder settings`, onclick: openReminderSheet },
    h('div', { class: 'tile-top' }, h('span', { class: 'eyebrow' }, eyebrow), h('span', { class: 'well action', 'aria-hidden': 'true' }, PENCIL())),
    h('div', {}, h('span', { class: `num${big.length > 4 ? ' small' : ''}` }, big), unit ? h('span', { class: 'unit' }, unit) : null),
    Ruler({ value: s.reminder.enabled && !paused && !later ? Math.min(sinceMove, s.reminder.intervalMin) : 0, max: s.reminder.intervalMin }),
    h('span', { class: 'hint' }, hint));
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
  return h('a', { class: `tile static routine-tile${allDone ? ' all-done' : ''}${celebrate ? ' celebrate' : ''}`, href: `#/routine/${r.id}`, 'aria-label': `${r.name}, ${done} of ${target} today. Open` },
    h('div', { class: 'tile-top' }, h('span', { class: 'eyebrow' }, 'Routine'),
      h('span', { class: `well action${allDone ? ' done-mark' : ''}`, 'aria-hidden': 'true' }, allDone ? '✓' : '▶')),
    allDone
      ? h('div', {}, h('span', { class: 'done-title' }, 'Done for today'))
      : h('div', {}, h('span', { class: 'num' }, String(done)), h('span', { class: 'unit' }, `/${target} today`)),
    h('div', { class: 'seg-dots', 'aria-hidden': 'true' },
      Array.from({ length: target }, (_, i) => h('i', { class: `${i < done ? 'on' : ''}${celebrate && i === done - 1 ? ' fresh' : ''}` }))),
    h('span', { class: 'tile-title link' }, `${r.name} · ${week} this week`),
    celebrate ? h('span', { class: 'sr-only', role: 'status' }, `${r.name} done. Logged as a helper.`) : null);
}

function aiTile() {
  return h('button', { type: 'button', class: 'tile static ai-tile', onclick: openAIShare },
    h('div', { class: 'tile-top' }, h('span', { class: 'eyebrow' }, 'Analyse with AI'), h('span', { class: 'well action', 'aria-hidden': 'true' }, '✳︎')),
    h('span', { class: 'tile-title' }, 'Find your patterns'),
    h('span', { class: 'hint' }, 'Spot trends in your data with AI'));
}

/** Share sheet with the diary file (it carries its own instructions), or copy it as text to paste. */
function openAIShare() {
  const n = R.checkins.all().length;
  if (!n) return toast('Check in at least once first');
  sheet(close => h('div', { class: 'stack' },
    h('h2', {}, 'Analyse with AI'),
    h('p', { class: 'muted' }, 'Send your data to an AI chat to spot trends and what helps.'),
    h('p', { class: 'hint' }, `${n} check-in${n === 1 ? '' : 's'}. Nothing leaves your phone until you share it.`),
    h('button', { type: 'button', class: 'btn primary', onclick: async () => { await shareDiary(); close(); } }, 'Share'),
    h('button', { type: 'button', class: 'btn glass', onclick: async () => { toast((await copyDiary()) ? 'Copied. Paste it into an AI chat.' : 'Couldn’t copy'); close(); } }, 'Copy as text')));
}
