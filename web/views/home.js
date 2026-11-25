// Dashboard: today's pain, trend, patterns, movement, routine, and sharing the diary with an AI chat.
import { h, s as svgEl, segmented, sheet, toast, iconButton } from '../lib/ui.js';
import * as R from '../lib/repos.js';
import * as reminders from '../lib/reminders.js';
import { shareDiary, copyDiary } from '../lib/ai.js';
import { HEALTH_IMPORT } from '../lib/health.js';
import { HEALTH_LINES } from '../lib/health-days.js';
import { notificationStatus, onBanners, dismiss, countVisit } from '../lib/notify.js';
import { quickSummary, trendFindings, factorStory, scoreSplits, painLink, patternWeight, painRisks, daysSinceLogged } from '../lib/analysis.js';
import { findInsights } from '../lib/insights.js';
import { careNotice } from '../lib/care.js';
import { localDate, addDays, daysBetween, fmtTime, minutesSince, parseDate } from '../lib/dates.js';
import { fmtAmount, reminderOn } from '../lib/labels.js';
import { TrendChart, PALETTES, extraPalettes } from './chart.js';
import { PainCalendar } from './calendar.js';
import { Ruler, SelectCard, PENCIL, healthSwitch } from './controls.js';
import { openReminderSheet, hoursSummary } from './reminder-sheet.js';
import { justFinished } from './routines.js';
import { dragHandles } from './sortable.js';
import { patternsFor } from './insight.js';
import { calmBanner } from '../lib/milestones.js';
import { Cheer, CHEER_TEXT, cheerPreview } from './cheer.js';

// View state that should survive the periodic re-render
const ui = { range: 7, hidden: null, view: 'chart', month: localDate().slice(0, 7), day: null, drawn: null };
// Lines switched off in the chart, remembered between visits (read once the diary has loaded)
const hiddenLines = () => (ui.hidden ??= new Set(R.settings().chartHidden ?? []));
// Lines switched off in Chart data: gone from the chart and its key (a tap on the key only dims a line)
const removedLines = () => new Set(R.settings().chartRemoved ?? []);
let rerender = () => {};

// Sections the user can rearrange by holding and dragging, in the default order.
// The notes pad (pad.js) is left out for now.
const SECTIONS = ['hero', 'tiles', 'trend', 'patterns', 'ai'];

/** The tiles moved above Trends by default; saved orders get the same move once. */
function moveTilesUp() {
  const order = R.settings().homeOrder;
  if (R.settings().tilesFirst) return;
  if (Array.isArray(order) && order.includes('tiles') && order.includes('trend')) {
    const rest = order.filter(k => k !== 'tiles');
    rest.splice(rest.indexOf('trend'), 0, 'tiles');
    R.setSettings({ homeOrder: rest });
  }
  R.setSettings({ tilesFirst: true });
}

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
  ui.drawn = null; // a fresh visit draws the chart in again
  // Header, notices and sections are built once and filled on each render, so a notice that's
  // sliding in isn't restarted by the periodic redraw
  const head = h('div', { class: 'home-head' });
  const notices = NoticeSlot(ctx);
  // One container for the sections, so the drag listeners survive re-renders
  const sections = h('div', { class: 'home-sections' });
  const root = h('div', { class: 'view home' }, head, notices.el, sections);
  moveTilesUp();
  let dragging = false;
  dragHandles(sections, {
    hold: true,
    onLift: () => { dragging = true; },
    // Redraw once the card has glided into its slot (the save during the drag was skipped)
    onDrop: () => { dragging = false; setTimeout(() => render(), 360); },
    onReorder: rows => R.setSettings({ homeOrder: rows.map(r => r.dataset.section) }),
  });
  const render = () => {
    // Never rebuild under the finger
    if (dragging) return;
    const { top, parts } = build();
    head.replaceChildren(...top.filter(Boolean));
    sections.replaceChildren(...sectionOrder().map(k => parts[k]));
    notices.update();
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
      h('header', { class: 'top-bar' }, h('h1', { class: 'wordmark' }, 'Back Story')),
      notifyNudge(),
    ],
    parts: {
      hero: section('hero', hero(entry, today)),
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
  // Within a twentieth of a point of the average it's the same, so no ↑ or ↓
  const delta = entry?.painScore != null && avg != null && Math.abs(entry.painScore - avg) >= 0.05 ? entry.painScore - avg : null;

  return h('section', { class: `hero${entry ? '' : ' empty'}` },
    h('div', { class: 'hero-num' },
      entry ? h('span', { class: 'eyebrow' }, 'Pain today') : null,
      h('div', {}, h('span', { class: 'giant' }, entry?.painScore ?? '–'), h('span', { class: 'unit' }, '/10')),
      delta != null ? h('span', { class: `pill-badge ${delta > 0 ? 'up' : 'down'}` }, `${delta > 0 ? '↑' : '↓'} ${Math.abs(delta).toFixed(1)} vs 7-day avg`) : null),
    h('div', { class: 'hero-side' },
      h('div', { class: 'streak' }, h('span', { class: 'num' }, String(streak)), h('span', { class: 'hint' }, 'day streak')),
      // Before the first check-in, the big button over the sample chart is the call to action
      R.checkins.all().length ? h('a', { class: 'btn primary hero-cta', href: '#/checkin' }, entry ? 'Edit check-in' : 'Check in') : null));
}

// ---------- Notices at the top of Home ----------
// Reminders and the odd key finding slide in above the sections, pushing them down, and slide away
// when dismissed. Each clears itself after a while or a few visits (see notify.js).

const FINDING_VISITS = 3;

/** The strongest finding worth putting at the top of Home, if one hasn't been seen enough. */
function topFinding() {
  const seen = R.settings().findingSeen ?? {};
  return trendFindings(R.snapshot(), R.factors.all(), localDate()).find(f => f.strong && (seen[f.key] ?? 0) < FINDING_VISITS) ?? null;
}
const markFinding = (key, n) => R.setSettings({ findingSeen: { ...(R.settings().findingSeen ?? {}), [key]: n } });

function NoticeSlot(ctx) {
  const el = h('div', { class: 'notices', 'aria-live': 'polite' });
  const shown = new Map(); // key -> wrapper element
  let banners = [];
  let preview = cheerPreview(ctx.params.get('cheer'));
  // Opening Home counts as a visit for each notice
  countVisit();
  const first = topFinding();
  if (first) markFinding(first.key, (R.settings().findingSeen?.[first.key] ?? 0) + 1);

  const notice = (key, { title, body, href, actions = [], onClose, full, art }) => {
    const text = h(href ? 'a' : 'div', { class: 'notice-text', href }, h('strong', {}, title), body ? h('span', {}, body) : null);
    const card = h('div', { class: `notice glass${full ? ' full' : ''}${art ? ' with-art' : ''}`, role: 'status' },
      h('div', { class: 'notice-main' }, art ? h('div', { class: 'notice-art', 'aria-hidden': 'true' }, art) : null, text,
        h('button', { type: 'button', class: 'notice-x', 'aria-label': 'Dismiss', onclick: onClose }, '✕')),
      actions.length ? h('div', { class: 'notice-actions' }, actions.map(a => h('button', {
        type: 'button', class: `btn small ${a.primary ? 'primary' : 'glass'}`, onclick: () => { onClose(); a.run?.(); },
      }, a.label))) : null);
    return h('div', { class: 'notice-wrap', 'data-key': key }, h('div', { class: 'notice-inner' }, card));
  };

  function update() {
    const want = new Map();
    for (const b of banners) want.set(`b${b.id}`, () => notice(`b${b.id}`, { ...b, onClose: () => dismiss(b.id) }));
    // A week or a month without a flare: a little celebration, until dismissed or a few days have passed
    const calm = preview ? { id: preview, key: 'preview' } : calmBanner(R.checkins.all(), R.flares.all(), localDate(), R.settings().cheersDismissed ?? {});
    if (calm) {
      const [title, body] = CHEER_TEXT[calm.id];
      want.set(`m${calm.key}`, () => notice(`m${calm.key}`, {
        title, body, full: true, art: Cheer(calm.id, { small: true }),
        onClose: () => { if (calm.key !== 'preview') R.setSettings({ cheersDismissed: { ...(R.settings().cheersDismissed ?? {}), [calm.key]: true } }); preview = null; update(); },
      }));
    }
    // Pain that stays high, or a warning sign in the notes: stays until dismissed
    const dismissed = R.settings().careDismissed ?? {};
    const care = careNotice(R.checkins.all(), localDate(), dismissed);
    if (care) {
      want.set(`c${care.key}`, () => notice(`c${care.key}`, {
        title: care.title, body: care.body, href: '#/help', full: true,
        onClose: () => { R.setSettings({ careDismissed: { ...(R.settings().careDismissed ?? {}), [care.key]: true } }); update(); },
      }));
    }
    const f = topFinding();
    if (f && (R.settings().findingSeen?.[f.key] ?? 0) > 0) {
      want.set(`f${f.key}`, () => notice(`f${f.key}`, {
        title: f.title, href: `#/factor/${f.factor.id}`,
        onClose: () => { markFinding(f.key, FINDING_VISITS); update(); },
      }));
    }
    // One at a time: the newest banner, else the care note, else a finding. The rest wait their turn.
    const pick = [...want.keys()].filter(k => k.startsWith('b')).at(-1) ?? [...want.keys()][0];
    for (const k of [...want.keys()]) if (k !== pick) want.delete(k);
    // Gone: fold away, then remove
    for (const [key, w] of shown) {
      if (want.has(key)) continue;
      shown.delete(key);
      w.classList.add('out');
      setTimeout(() => w.remove(), 420);
    }
    // New: unfold into place
    for (const [key, make] of want) {
      if (shown.has(key)) continue;
      const w = make();
      w.classList.add('out');
      el.append(w);
      shown.set(key, w);
      requestAnimationFrame(() => requestAnimationFrame(() => w.classList.remove('out')));
    }
  }
  ctx.onCleanup(onBanners(list => { banners = list; update(); }));
  return { el, update };
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
    h('div', { class: 'row between' }, h('h2', {}, 'Calendar'), viewToggle()),
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
  // Ranges appear as there's history for them, and never just one on its own
  const first = all[0].date;
  const span = daysBetween(first, today) + 1;
  const ranges = chartRanges(span);
  if (!ranges.some(([v]) => v === ui.range)) ui.range = ranges.at(-1)?.[0] ?? 7;
  // Until there's a full range of history, the range starts at the first check-in, so early data sits
  // on the left with the coming days still empty on the right
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
      key, label: f.name, palette, factorId: f.id,
      values: smooth.map(v => 0.04 + v * 0.86),
      format: i => (amounts[i] ? fmtAmount(f, amounts[i]) : 'none'),
    };
  };
  if (mainStressor) series.push(factorSeries('stressor', mainStressor.factor, PALETTES.stressor));
  if (topHelper) series.push(factorSeries('helper', topHelper.factor, PALETTES.helper));

  // Lines the user added from the + in the key
  const auto = new Set([mainStressor?.factor.id, topHelper?.factor.id]);
  const extras = (R.settings().chartExtras ?? []).filter(x => isMetric(x) || (R.factors.get(x) && !R.factors.get(x).isArchived && !auto.has(x)));
  const colours = extraPalettes(extras, isBadLine);
  extras.forEach(x => {
    const palette = colours.get(x);
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
        key: 'sleepHours', label: R.health.sleepWord() === 'In bed' ? 'Time in bed' : 'Hours slept', palette,
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
    } else if (healthLine(x)) {
      // Workouts, walking, stand hours, heart rate… from Apple Health; a day with no workout reads as none
      const line = healthLine(x);
      const days = dates.map(d => R.health.day(d));
      const vals = days.map(d => line.value(d) ?? (x === 'workouts' && d ? 0 : null));
      const lo = line.bottom ?? 0, hi = line.top(vals.filter(v => v != null));
      series.push({
        key: x, label: line.title, palette,
        values: vals.map(v => (v == null ? null : 0.04 + Math.max(0, Math.min(1, (v - lo) / (hi - lo))) * 0.86)),
        format: i => (vals[i] == null ? '–' : line.fmt(vals[i], days[i])),
      });
    } else if (x === 'food') {
      const food = entries.map(e => e?.dietScore ?? null);
      series.push({
        key: 'food', label: 'Eating', palette,
        values: food.map(v => (v == null ? null : v / 10)),
        format: i => (food[i] == null ? '–' : `${food[i]}/10`),
      });
    } else if (x.startsWith('c:')) {
      const sl = customSlider(x);
      const vals = entries.map(e => e?.custom?.[sl.id] ?? null);
      series.push({
        key: x, label: sl.name, palette,
        values: vals.map(v => (v == null ? null : v / 10)),
        format: i => (vals[i] == null ? '–' : `${vals[i]}/10`),
      });
    } else series.push(factorSeries(`x-${x}`, R.factors.get(x), palette));
  });

  // Chart data can take pain, the main stressor and top helper off the chart altogether
  const autoLines = series.slice(0, 1 + !!mainStressor + !!topHelper);
  const removed = removedLines();
  const shownSeries = series.filter(sr => !removed.has(sr.key));
  const changes = R.routines.changesByDate();
  const marks = dates.flatMap((d, i) => (d <= today && changes.has(d)
    ? [{ i, date: d, changes: changes.get(d), texts: changes.get(d).map(c => c.text) }] : []));
  // Each day's routines: done (a session, or ticked in the check-in) and changed
  const routineList = R.routines.all();
  const routineDays = dates.flatMap((d, i) => {
    if (d > today) return [];
    const changed = new Set((changes.get(d) ?? []).map(c => c.routineId));
    const ticked = R.checkins.factorValues(d);
    const items = routineList.map(r => ({
      label: R.routineLabel(r), changed: changed.has(r.id),
      done: R.routines.completionsOn(d, r.id).length > 0 || ticked.has(r.linkedFactorId),
    }));
    // A change to a routine since deleted still shows, as a change
    for (const c of changes.get(d) ?? []) if (!routineList.some(r => r.id === c.routineId)) items.push({ label: c.name, changed: true, done: false });
    const shown = items.filter(it => it.done || it.changed);
    return shown.length ? [{ i, items: shown }] : [];
  });

  return h('section', { class: 'card glass trend-card' },
    h('div', { class: 'row between' }, h('h2', {}, 'Trends'),
      h('div', { class: 'row tight' },
        viewToggle(),
        rangeControl(ranges))),
    // The lines draw in when Home opens or the range changes, not on every quiet redraw
    TrendChart({
      animate: ui.drawn !== ui.range && !!(ui.drawn = ui.range), days, series: shownSeries, hidden: hiddenLines(),
      focus: dates.indexOf(today), fadeLeft: start > first, marks, routineDays,
      onMark: m => openChangeSheet(marks, m?.date),
      onToggle: key => { toggleHidden(key); rerender(); },
      onAdd: () => openDataSheet(autoLines, [...auto].filter(Boolean)),
    }));
}

/**
 * The range buttons for this much history: none for a week or less, then 1W and 2W (so every day can be
 * seen), adding 1M past two weeks, and longer ranges as the diary grows. Four at most: 1W and the three longest.
 */
export function chartRanges(span) {
  const all = [[7, '1W', 0], [14, '2W', 8], [30, '1M', 15], [90, '3M', 31], [180, '6M', 91], [365, '1Y', 181]];
  const fit = all.filter(([, , need]) => span >= need);
  const shown = fit.length > 4 ? [fit[0], ...fit.slice(-3)] : fit;
  return shown.length > 1 ? shown : [];
}

const RANGE_WORDS = { 7: '1 week', 14: '2 weeks', 30: '1 month', 90: '3 months', 180: '6 months', 365: '1 year' };

/**
 * Up to three ranges are buttons; past that, one quiet pill that opens the phone's own picker,
 * showing the range in words. Nothing at all while there's only one range.
 */
function rangeControl(ranges) {
  const pick = v => { ui.range = Number(v); rerender(); };
  if (ranges.length < 2) return null;
  if (ranges.length <= 3) return segmented(ranges.map(([v, label]) => [v, label]), ui.range, pick, 'Range');
  const select = h('select', { 'aria-label': 'Range', onchange: e => pick(e.target.value) },
    ranges.map(([v]) => h('option', { value: v }, RANGE_WORDS[v])));
  select.value = String(ui.range);
  return h('label', { class: 'range-pick glass' }, select, h('span', { class: 'range-chev', 'aria-hidden': 'true' }));
}

// Chart lines that aren't stressors or helpers; the user's own sliders are 'c:<id>'
const METRICS = ['stress', 'sleep', 'sleepHours', 'steps', 'food', ...HEALTH_LINES.map(l => l.key)];
const healthLine = key => HEALTH_LINES.find(l => l.key === key);
const customSlider = key => (R.settings().customSliders ?? []).find(c => `c:${c.id}` === key) ?? null;
const isMetric = x => METRICS.includes(x) || !!customSlider(x);
/** Whether more of a line is bad: stressors, stress and sliders where higher is worse are drawn warm. */
const isBadLine = x => (x === 'stress' || healthLine(x)?.warm ? true : METRICS.includes(x) ? false
  : x.startsWith('c:') ? customSlider(x)?.good === 'low' : R.factors.get(x)?.role !== 'helper');

/** Pick extra lines for the chart: stress, sleep, steps, or any stressor or helper. */
/** Takes one of the automatic lines off the chart and its key, or puts it back (shown, not dimmed). */
function setRemoved(key, off) {
  const removed = removedLines();
  if (off) removed.add(key); else { removed.delete(key); hiddenLines().delete(key); R.setSettings({ chartHidden: [...hiddenLines()] }); }
  R.setSettings({ chartRemoved: [...removed] });
}

function toggleHidden(key) {
  const hidden = hiddenLines();
  hidden.has(key) ? hidden.delete(key) : hidden.add(key);
  R.setSettings({ chartHidden: [...hidden] });
}

/**
 * Everything the chart can show, each with a switch, in groups: pain, then Apple Health, the check-in's
 * own scores, stressors and helpers. Within a group, whatever rises and falls most closely with pain comes
 * first. The automatic lines (your main stressor and top helper) sit in their groups; switching them off
 * hides them, while switching anything else on adds it.
 */
function openDataSheet(autoLines, autoIds) {
  const chosen = new Set(R.settings().chartExtras ?? []);
  const entries = R.snapshot().dailyEntries;
  const entryOn = new Map(entries.map(e => [e.date, e]));
  const link = value => Math.abs(painLink(entries, value) ?? 0);
  const health = key => d => { const day = R.health.day(d); return healthLine(key) ? healthLine(key).value(day) ?? (key === 'workouts' && day ? 0 : null) : day?.[key] ?? null; };
  const amount = id => d => R.checkins.factorValues(d).get(id) ?? 0;
  const autoBy = new Map(autoLines.map(sr => [sr.key === 'pain' ? 'pain' : sr.factorId, sr]));
  const AUTO_DETAIL = { stressor: 'Main stressor', helper: 'Top helper' };

  const healthItems = HEALTH_IMPORT ? [
    ...(R.health.has('sleepHours') ? [{ id: 'sleepHours', title: R.health.sleepWord() === 'In bed' ? 'Time in bed' : 'Hours slept', value: health('sleepHours') }] : []),
    ...(R.health.has('steps') ? [{ id: 'steps', title: 'Steps', value: health('steps') }] : []),
    ...HEALTH_LINES.filter(l => R.health.has(l.key)).map(l => ({ id: l.key, title: l.title, value: health(l.key) })),
  ] : [];
  const score = field => d => entryOn.get(d)?.[field] ?? null;
  const checkinItems = [
    { id: 'stress', title: 'Stress', detail: 'Out of 10', value: score('stressScore') },
    { id: 'sleep', title: 'Sleep', detail: 'How well, out of 10', value: score('sleepQuality') },
    { id: 'food', title: 'Eating', detail: 'How well, out of 10', value: score('dietScore') },
    ...(R.settings().customSliders ?? []).map(c => ({ id: `c:${c.id}`, title: c.name, detail: 'Your slider, out of 10', value: d => entryOn.get(d)?.custom?.[c.id] ?? null })),
  ];
  const factorItem = f => ({ id: f.id, title: f.name, auto: autoBy.get(f.id), detail: AUTO_DETAIL[autoBy.get(f.id)?.key], value: amount(f.id) });
  const factors = R.factors.all();
  const byLink = list => list.map(o => [o, link(o.value)]).sort((a, b) => b[1] - a[1]).map(([o]) => o);
  const groups = [
    ['Apple Health', byLink(healthItems)],
    ['Check-in', byLink(checkinItems)],
    ['Stressors', byLink(factors.filter(f => f.role !== 'helper').map(factorItem))],
    ['Helpers', byLink(factors.filter(f => f.role === 'helper').map(factorItem))],
  ].filter(([, list]) => list.length);

  const swatch = c => h('i', { class: `data-swatch${c ? '' : ' off'}`, style: c ? `--c:${c}` : null, 'aria-hidden': 'true' });
  // Each added line shows the colour it has on the chart: warm if more is bad, cool if more is good
  const added = groups.flatMap(([, list]) => list).filter(o => !o.auto);
  const swatches = new Map(added.map(o => [o.id, swatch(null)]));
  const paintSwatches = () => {
    const colours = extraPalettes([...chosen].filter(id => swatches.has(id)), isBadLine);
    for (const [id, el] of swatches) el.replaceWith(swatches.set(id, swatch(colours.get(id)?.[0] ?? null)).get(id));
  };
  const row = (lead, title, detail, on, onChange) => h('label', { class: 'data-row' },
    lead, h('span', { class: 'grow' }, title, detail ? h('span', { class: 'hint block' }, detail) : null),
    h('input', { type: 'checkbox', class: 'switch', checked: on, 'aria-label': `Show ${title}`, onchange: e => onChange(e.target.checked) }));
  const itemRow = o => (o.auto
    ? row(swatch(o.auto.palette[0]), o.title, o.detail, !removedLines().has(o.auto.key), on => setRemoved(o.auto.key, !on))
    : row(swatches.get(o.id), o.title, o.detail, chosen.has(o.id), on => { on ? chosen.add(o.id) : chosen.delete(o.id); R.setSettings({ chartExtras: [...chosen] }); paintSwatches(); }));
  const pain = autoBy.get('pain');
  const body = h('div', { class: 'stack data-sheet' },
    h('h2', {}, 'Chart data'),
    pain ? h('div', { class: 'data-list' }, row(swatch(pain.palette[0]), pain.label, null, !removedLines().has('pain'), on => setRemoved('pain', !on))) : null,
    groups.map(([name, list]) => h('div', { class: 'data-group' },
      h('h3', { class: 'section-label' }, name),
      h('div', { class: 'data-list' }, list.map(itemRow)))));
  paintSwatches();
  sheet(() => body,
  { onClose: () => rerender(), tall: true });
}

/** Every routine change in view, newest first, grouped by day; each change opens its routine. */
function openChangeSheet(marks, first = null) {
  const days = [...marks].sort((a, b) => (a.date === first ? -1 : b.date === first ? 1 : b.date.localeCompare(a.date)));
  sheet(close => h('div', { class: 'stack change-sheet', tabindex: -1 },
    h('h2', {}, days.length > 1 || days[0]?.changes.length > 1 ? 'Routine changes' : 'Routine change'),
    days.map(m => h('div', { class: 'change-day' },
      h('p', { class: 'hint change-date' }, parseDate(m.date).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })),
      h('div', { class: 'change-list' }, m.changes.map(c => {
        const live = R.routines.get(c.routineId) && !R.routines.get(c.routineId).isArchived;
        return h(live ? 'a' : 'div', { class: 'change-item', href: live ? `#/routine/${c.routineId}` : null, onclick: live ? close : null },
          h('span', { class: 'change-dot', 'aria-hidden': 'true' }),
          h('span', { class: 'grow' }, h('strong', {}, c.name), h('span', { class: 'hint block' }, changeWhat(c))),
          live ? h('span', { class: 'chev', 'aria-hidden': 'true' }, '›') : null);
      }))))));
}

// "Started Daily mobility" under the heading "Daily mobility" reads as just "Started"
const changeWhat = c => (c.summary.endsWith(c.name) ? c.summary.slice(0, -c.name.length).trim() : c.summary);

function patternsCard(today) {
  const data = R.snapshot();
  const factors = R.factors.all();
  const head = h('h2', {}, 'Patterns');

  // Before the first check-in: the shape of what's coming, softly tinted
  if (!data.dailyEntries.length) {
    return h('section', { class: 'card glass patterns' }, head,
      h('div', { class: 'pat-list ghost', 'aria-hidden': 'true' }, [0.55, -0.4, 0.22].map(w => patRow(null, w))),
      h('p', { class: 'hint' }, 'Check in to start seeing what moves your pain.'));
  }

  // Whatever goes most with pain: the three biggest rises, then the three biggest falls, by the same
  // numbers as each one's own page. Time and counts compare days with more against less; yes or no,
  // days with and without; stress, sleep and eating, higher days against lower. Small differences
  // count too, so there are three of each whenever the diary has them.
  const all = [
    ...factors.map(f => {
      const st = factorStory(f, data, today);
      const n = midName(f.name);
      // Time and counts read "with more long sitting"; yes or no reads "with a heat pack"
      return st.best && { name: f.name, href: `#/factor/${f.id}`, delta: st.best.delta, early: st.early, phrase: st.amount ? `on days with more ${n}` : `on days with ${n}`,
        weight: patternWeight(st.best.delta, Math.min(st.best.nWith, st.best.nWithout), st.nCheckins, daysSinceLogged(f.id, data, today)) };
    }),
    ...scoreSplits(data, today).map(x => ({ name: x.name, href: `#/score/${x.key}`, delta: x.split.delta, early: x.split.early, phrase: SCORE_PHRASE[x.key],
      weight: patternWeight(x.split.delta, Math.min(x.split.nMore, x.split.nLess), x.split.nMore + x.split.nLess) })),
  ].filter(a => a && a.weight != null && Math.abs(a.delta) >= 0.05);
  // Ranked by how much each counts, so what's logged on most days comes before what's logged once or twice
  const rows = [
    ...all.filter(a => a.delta > 0).sort((a, b) => b.weight - a.weight).slice(0, 3),
    ...all.filter(a => a.delta < 0).sort((a, b) => a.weight - b.weight).slice(0, 3),
  ];
  if (!rows.length) {
    return h('section', { class: 'card glass patterns' }, head,
      h('div', { class: 'pat-list ghost', 'aria-hidden': 'true' }, [0.55, -0.4, 0.22].map(w => patRow(null, w))),
      h('p', { class: 'hint' }, data.dailyEntries.length < 4 ? 'A few more check-ins and patterns show here.' : 'Nothing stands out yet.'));
  }

  const shown = rows;
  const allEarly = rows.every(a => a.early);
  const scale = Math.max(2, ...shown.map(a => Math.abs(a.delta)));
  // Up top: patterns that cleared the bar, each with a tiny sketch of its chart and its own page: what
  // comes before flares, delays, combinations, and pain since a routine started. Without any, the longest
  // bar below, in words, once it's a real difference
  const insights = patternsFor(data, factors, findInsights(data, factors, today), today).map(x => ({ title: x.title, href: `#/insight/${x.id}`, bad: x.bad, kind: x.kind }));
  // The one most worth saying: the strongest by the same weighing as the bars, not just the biggest gap
  const top = [...shown].sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight))[0];
  const leads = insights.length ? insights
    : Math.abs(top.delta) >= 0.5 ? [{ title: `${top.delta > 0 ? 'More' : 'Less'} pain ${top.phrase}`, href: top.href, bad: top.delta > 0 }] : [];
  const warn = headsUp(factors, data, today);
  const above = leads.length || warn;
  return h('section', { class: 'card glass patterns' },
    above ? h('div', { class: 'findings' }, head, warn, leads.map(findingRow)) : null,
    h('div', { class: 'pat-head' }, above ? h('span', {}) : head,
      h('span', { class: 'pat-axis', 'aria-hidden': 'true' }, h('small', {}, '← Less pain'), h('small', {}, 'More pain →'))),
    h('div', { class: 'pat-list' }, shown.map(a => patRow(a, (a.delta ?? 0) / scale))),
    allEarly ? h('p', { class: 'hint pat-note' }, 'Only a few days so far, so these could change.') : null);
}

// Things you'd sit through, where a nudge to get up helps
const SITTING = /sit|desk|driv|screen|couch|sofa|computer|commut|gaming|tv\b/i;

/** A heads-up when something that's gone with more pain is up the last two check-ins, with a way to act where there is one. */
function headsUp(factors, data, today) {
  // While developing, ?headsup shows one for the item most tied to more pain, ignoring the last two
  // days, so it can be looked at (it never picks something whose own page says it makes no difference)
  const preview = /^(localhost|127\.0\.0\.1)$/.test(location.hostname) && new URLSearchParams(location.hash.split('?')[1]).has('headsup');
  const risk = preview
    ? factors.map(f => ({ factor: f, st: factorStory(f, data, today) })).filter(x => x.st.state === 'up').sort((a, b) => b.st.best.delta - a.st.best.delta).map(x => ({ factor: x.factor, amount: x.st.amount }))[0]
    : painRisks(factors, data, today)[0];
  if (!risk) return null;
  const f = risk.factor;
  const nudge = SITTING.test(f.name) && !R.settings().reminder.enabled;
  return h('div', { class: 'heads-up' },
    h('a', { class: 'finding', href: `#/factor/${f.id}` },
      h('i', { class: 'finding-dot bad', 'aria-hidden': 'true' }),
      h('span', { class: 'grow' }, h('span', { class: 'finding-title' }, risk.amount === false ? `${f.name} two days running` : `More ${midName(f.name)} than usual`), h('small', {}, 'It’s gone with more pain before.')),
      h('span', { class: 'chev', 'aria-hidden': 'true' }, '›')),
    nudge ? h('button', { type: 'button', class: 'btn small glass', onclick: openReminderSheet }, 'Turn on move nudges') : null);
}

// How each of the check-in's scores reads in a sentence
const SCORE_PHRASE = { stressScore: 'on days with more stress', sleepQuality: 'after better sleep', dietScore: 'on days you ate better' };
// "Long sitting" reads "long sitting" mid-sentence; names that start with an acronym ("TV time") stay as they are
const midName = n => (/^[A-Z][a-z]/.test(n) ? n[0].toLowerCase() + n.slice(1) : n);

/** "Pain is worse two days after more long sitting": a dot for which way it points, the pattern, a chevron. */
function findingRow(x) {
  const sketch = x.kind ? svgEl('svg', { class: 'finding-sketch', viewBox: '0 0 34 20', 'aria-hidden': 'true' }) : null;
  if (sketch) sketch.innerHTML = SKETCH[x.kind];
  return h('a', { class: `finding${sketch ? ' with-sketch' : ''}`, href: x.href },
    h('i', { class: `finding-dot ${x.bad ? 'bad' : 'good'}`, 'aria-hidden': 'true' }),
    h('span', { class: 'grow finding-title' }, x.title),
    sketch,
    h('span', { class: 'chev', 'aria-hidden': 'true' }, '›'));
}

// Each kind of pattern as a tiny version of its chart
const SKETCH = {
  flare: '<path d="M0 5 C7 5 10 13 15 14 C21 15 27 9 34 9" class="s-line s-teal"/><path d="M0 16 C8 16 12 15.5 16 15 C21 14 22 4 26 4 C30 4 31 12 34 13" class="s-line"/><circle cx="15" cy="14" r="2.2" class="s-teal-dot"/>',
  lag: '<path d="M0 15 C6 15 9 14.5 13 14 C18 13.5 19 4 23 4 C27 4 28 13 34 14 L34 20 L0 20 Z" class="s-area"/><path d="M0 15 C6 15 9 14.5 13 14 C18 13.5 19 4 23 4 C27 4 28 13 34 14" class="s-line"/><circle cx="13" cy="14" r="2.2" class="s-cause"/>',
  combo: '<line x1="10" x2="10" y1="0" y2="20" class="s-axis"/><rect x="10" y="2" width="6" height="3.6" rx="1.8" class="s-soft"/><rect x="10" y="8.2" width="7.5" height="3.6" rx="1.8" class="s-soft"/><rect x="10" y="14.4" width="22" height="3.6" rx="1.8" class="s-hot"/>',
  trend: '<path d="M0 6 C5 4 7 8 11 6 C15 4 16 9 19 12 C23 15 27 12 34 14 L34 20 L0 20 Z" class="s-area"/><path d="M0 6 C5 4 7 8 11 6 C15 4 16 9 19 12 C23 15 27 12 34 14" class="s-line"/><line x1="16" x2="16" y1="1" y2="19" class="s-axis"/>',
};

/** One factor: its name, then a bar growing out from the centre line (w is -1..1 of the half width).
    No difference to show yet (only days with it so far): a dot on the line in its role's colour. */
function patRow(a, w) {
  const name = h('span', { class: 'pat-name' }, a ? a.name : '');
  const up = w > 0;
  const bar = h('span', { class: `pat-bar ${up ? 'up' : 'down'}${a?.early ? ' early' : ''}`, style: `--w:${Math.abs(w) * 100}%` },
    a ? h('b', {}, `${up ? '+' : '−'}${Math.abs(a.delta).toFixed(1)}`) : null);
  if (!a) return h('div', { class: 'pat-row' }, name, h('span', { class: 'pat-track' }, bar));
  const label = `${a.name}: pain ${Math.abs(a.delta).toFixed(1)} ${up ? 'higher' : 'lower'} with more of it${a.early ? ', early read' : ''}`;
  // Stressors and helpers open their own page; stress, sleep and eating have none
  return h(a.href ? 'a' : 'div', { class: 'pat-row', href: a.href, 'aria-label': label }, name, h('span', { class: 'pat-track' }, bar));
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
    h('div', { class: 'tile-top' }, h('h2', {}, eyebrow), h('span', { class: 'well action', 'aria-hidden': 'true' }, PENCIL())),
    h('div', {}, h('span', { class: `num${big.length > 4 ? ' small' : ''}` }, big), unit ? h('span', { class: 'unit' }, unit) : null),
    Ruler({ value: s.reminder.enabled && !paused && !later ? Math.min(sinceMove, s.reminder.intervalMin) : 0, max: s.reminder.intervalMin }),
    h('span', { class: 'tile-title link' }, hint));
}


function routineTile(today) {
  const r = R.routines.onHome();
  if (!r) return h('a', { class: 'tile static', href: '#/routine/new' }, h('h2', {}, 'Routine'), h('span', { class: 'tile-title' }, '+ Create a movement routine'));
  // A session done more than once (mobility twice in a day) counts each time
  const timesOn = date => R.routines.completionsOn(date, r.id).reduce((n, c) => n + (c.times ?? 1), 0);
  const done = timesOn(today);
  const target = Math.max(1, r.schedule.filter(e => reminderOn(e, today)).length);
  const allDone = done >= target;
  // Play the celebration once, on the first render after finishing a routine
  const celebrate = justFinished.id === r.id;
  if (celebrate) setTimeout(() => { justFinished.id = null; }, 1600);
  return h('a', { class: `tile static routine-tile${allDone ? ' all-done' : ''}${celebrate ? ' celebrate' : ''}`, href: `#/routine/${r.id}`, 'aria-label': `${R.routineLabel(r)}, ${done} of ${target} today. Open` },
    h('div', { class: 'tile-top' }, h('h2', {}, 'Routine'),
      h('span', { class: `well action${allDone ? ' done-mark' : ''}`, 'aria-hidden': 'true' }, allDone ? '✓' : '▶')),
    allDone
      ? h('div', {}, h('span', { class: 'done-title' }, done > 1 ? `Done ${done}× today` : 'Done today'))
      : h('div', {}, h('span', { class: 'num' }, String(done)), h('span', { class: 'unit' }, `/${target} today`)),
    h('div', { class: 'seg-dots', 'aria-hidden': 'true' },
      Array.from({ length: target }, (_, i) => h('i', { class: `${i < done ? 'on' : ''}${celebrate && i === done - 1 ? ' fresh' : ''}` }))),
    // With more than one routine, the name is a button for picking which one shows here
    R.routines.all().length > 1
      ? h('button', {
        type: 'button', class: 'tile-title link routine-swap', 'aria-label': `${R.routineLabel(r)}. Show a different routine here`,
        onclick: e => { e.preventDefault(); e.stopPropagation(); pickHomeRoutine(r); },
      }, R.routineLabel(r), h('span', { class: 'swap-chev', 'aria-hidden': 'true' }))
      : h('span', { class: 'tile-title link' }, R.routineLabel(r)),
    celebrate ? h('span', { class: 'sr-only', role: 'status' }, `${R.routineLabel(r)} done. Logged as a helper.`) : null);
}

/** Which routine the Home card shows: tap one and it swaps in. */
function pickHomeRoutine(current) {
  sheet(close => h('div', { class: 'stack' },
    h('h2', {}, 'Show on Home'),
    h('div', { class: 'pick-list' }, R.routines.all().map(r => h('button', {
      type: 'button', class: `pick-row${r.id === current.id ? ' on' : ''}`, 'aria-pressed': String(r.id === current.id),
      onclick: () => { R.routines.showOnHome(r.id); close(); },
    }, h('span', { class: 'well', 'aria-hidden': 'true' }, R.routineIcon(r)), h('span', { class: 'grow' }, R.routineLabel(r)),
    r.id === current.id ? h('span', { class: 'pick-tick', 'aria-hidden': 'true' }, '✓') : null)))));
}

function aiTile() {
  return h('button', { type: 'button', class: 'tile static ai-tile', onclick: openShareSheet },
    h('div', { class: 'ai-text' },
      h('h2', {}, 'Analyse your data with AI'),
      h('span', { class: 'hint' }, 'Export your diary to an AI chat to spot trends and see what lines up with your pain.')),
    h('span', { class: 'well action', 'aria-hidden': 'true' }, '✳︎'));
}

/**
 * Sharing the diary with another app, usually an AI chat. Before anything goes, it says exactly what is sent and who receives
 * it, and nothing can be shared until the person agrees. The app sends nothing itself: the share sheet or
 * the clipboard hands it to the app the person picks. Apple Health data stays out unless switched on.
 */
function openShareSheet() {
  if (!R.checkins.all().length) return toast('Check in at least once first');
  const health = healthSwitch();
  const opts = () => ({ health: health?.input.checked });
  const share = h('button', { type: 'button', class: 'btn primary', disabled: true, onclick: async () => { await shareDiary(opts()); closeSheet(); } }, 'Share');
  const copy = h('button', { type: 'button', class: 'btn glass', disabled: true, onclick: async () => { toast((await copyDiary(opts())) ? 'Copied. Paste it into an AI chat.' : 'Couldn’t copy'); closeSheet(); } }, 'Copy as text');
  const agree = h('input', { type: 'checkbox', class: 'switch', 'aria-label': 'I agree to share this with the app I choose', onchange: e => { share.disabled = copy.disabled = !e.target.checked; } });
  let closeSheet = () => {};
  sheet(close => {
    closeSheet = close;
    return h('div', { class: 'stack ai-consent' },
      h('h2', {}, 'Share your diary'),
      h('div', { class: 'stack tight' },
        h('h3', { class: 'section-label' }, 'What’s sent'),
        h('p', {}, 'Your check-ins (pain, stress, sleep, eating, notes and meals), where it hurt, the stressors, helpers and routines you logged, and your reminders.'),
        health ? h('p', { class: 'muted' }, 'Apple Health steps, sleep and activity only if you switch them on below.') : null),
      h('div', { class: 'stack tight' },
        h('h3', { class: 'section-label' }, 'Where it goes'),
        h('p', {}, 'To the app you pick next, like ChatGPT (OpenAI), Gemini (Google), Notes or Mail, or wherever you paste it. The company behind that app receives it under its own privacy policy. Back Story never sends it anywhere itself.'),
        h('p', { class: 'muted' }, 'An AI’s answers aren’t medical advice.')),
      health?.row,
      h('label', { class: 'row between' }, h('span', {}, 'I agree to share this with the app I choose'), agree),
      share, copy);
  });
}
