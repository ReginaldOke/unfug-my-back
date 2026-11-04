// Dashboard: today's pain, trend, patterns, movement, routine, and sharing the diary with an AI chat.
import { h, segmented, sheet, toast, iconButton } from '../lib/ui.js';
import * as R from '../lib/repos.js';
import * as reminders from '../lib/reminders.js';
import { shareDiary, copyDiary } from '../lib/ai.js';
import { HEALTH_IMPORT } from '../lib/health.js';
import { notificationStatus, onBanners, dismiss, countVisit } from '../lib/notify.js';
import { quickSummary, trendFindings, factorStory } from '../lib/analysis.js';
import { careNotice } from '../lib/care.js';
import { localDate, addDays, daysBetween, fmtTime, minutesSince, parseDate } from '../lib/dates.js';
import { fmtAmount, reminderOn } from '../lib/labels.js';
import { TrendChart, PALETTES, EXTRA_PALETTES } from './chart.js';
import { PainCalendar } from './calendar.js';
import { Ruler, SelectCard, PENCIL, healthSwitch } from './controls.js';
import { openReminderSheet, hoursSummary } from './reminder-sheet.js';
import { justFinished } from './routines.js';
import { dragHandles } from './sortable.js';

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
  // Opening Home counts as a visit for each notice
  countVisit();
  const first = topFinding();
  if (first) markFinding(first.key, (R.settings().findingSeen?.[first.key] ?? 0) + 1);

  const notice = (key, { title, body, href, actions = [], onClose, full }) => {
    const text = h(href ? 'a' : 'div', { class: 'notice-text', href }, h('strong', {}, title), body ? h('span', {}, body) : null);
    const card = h('div', { class: `notice glass${full ? ' full' : ''}`, role: 'status' },
      h('div', { class: 'notice-main' }, text,
        h('button', { type: 'button', class: 'notice-x', 'aria-label': 'Dismiss', onclick: onClose }, '✕')),
      actions.length ? h('div', { class: 'notice-actions' }, actions.map(a => h('button', {
        type: 'button', class: `btn small ${a.primary ? 'primary' : 'glass'}`, onclick: () => { onClose(); a.run?.(); },
      }, a.label))) : null);
    return h('div', { class: 'notice-wrap', 'data-key': key }, h('div', { class: 'notice-inner' }, card));
  };

  function update() {
    const want = new Map();
    for (const b of banners) want.set(`b${b.id}`, () => notice(`b${b.id}`, { ...b, onClose: () => dismiss(b.id) }));
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
        title: f.title, body: f.body, href: `#/factor/${f.factor.id}`,
        onClose: () => { markFinding(f.key, FINDING_VISITS); update(); },
      }));
    }
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
  // Ranges appear as there's enough history for them: a week, a month, two months for 3M, a year
  const first = all[0].date;
  const span = daysBetween(first, today) + 1;
  const ranges = [[7, '1W', 7], [30, '1M', 30], [90, '3M', 60], [365, '1Y', 365]].filter(([, , need]) => span >= need);
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
        ranges.length > 1 ? segmented(ranges.map(([v, label]) => [v, label]), ui.range, v => { ui.range = v; rerender(); }, 'Range') : null)),
    // The lines draw in when Home opens or the range changes, not on every quiet redraw
    TrendChart({
      animate: ui.drawn !== ui.range && !!(ui.drawn = ui.range), days, series: shownSeries, hidden: hiddenLines(),
      focus: dates.indexOf(today), fadeLeft: start > first, marks, routineDays,
      onMark: m => openChangeSheet(marks, m?.date),
      onToggle: key => { toggleHidden(key); rerender(); },
      onAdd: () => openDataSheet(autoLines, [...auto].filter(Boolean)),
    }));
}

// Chart lines that aren't stressors or helpers
const METRICS = ['stress', 'sleep', 'sleepHours', 'steps'];

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
 * Everything the chart can show, each with a switch: pain and your main stressor and top helper
 * (switching these hides them), then stress, sleep and every other stressor or helper (switching
 * these adds them).
 */
function openDataSheet(autoLines, autoIds) {
  const chosen = new Set(R.settings().chartExtras ?? []);
  const options = [
    { id: 'stress', title: 'Stress', detail: 'From your check-ins' },
    { id: 'sleep', title: 'Sleep', detail: 'How well, out of 10' },
    ...(HEALTH_IMPORT && R.health.has('sleepHours') ? [{ id: 'sleepHours', title: R.health.sleepWord() === 'In bed' ? 'Time in bed' : 'Hours slept', detail: 'From Apple Health' }] : []),
    ...(HEALTH_IMPORT && R.health.has('steps') ? [{ id: 'steps', title: 'Steps', detail: 'From Apple Health' }] : []),
    ...R.factors.all().filter(f => !autoIds.includes(f.id)).map(f => ({
      id: f.id, title: f.name, detail: f.role === 'helper' ? 'Helper' : 'Stressor',
    })),
  ];
  const AUTO_DETAIL = { pain: 'From your check-ins', stressor: 'Main stressor', helper: 'Top helper' };
  const swatch = c => h('i', { class: `data-swatch${c ? '' : ' off'}`, style: c ? `--c:${c}` : null, 'aria-hidden': 'true' });
  // Each added line shows the colour it has on the chart (colours go in the order lines were added)
  const swatches = new Map(options.map(o => [o.id, swatch(null)]));
  const paintSwatches = () => {
    const order = [...chosen].filter(id => swatches.has(id));
    for (const [id, el] of swatches) {
      const i = order.indexOf(id);
      el.replaceWith(swatches.set(id, swatch(i < 0 ? null : EXTRA_PALETTES[i % EXTRA_PALETTES.length][0])).get(id));
    }
  };
  const row = (lead, title, detail, on, onChange) => h('label', { class: 'data-row' },
    lead, h('span', { class: 'grow' }, title, h('span', { class: 'hint block' }, detail)),
    h('input', { type: 'checkbox', class: 'switch', checked: on, 'aria-label': `Show ${title}`, onchange: e => onChange(e.target.checked) }));
  const body = h('div', { class: 'stack data-sheet' },
    h('h2', {}, 'Chart data'),
    h('div', { class: 'data-list' },
      autoLines.map(sr => row(swatch(sr.palette[0]), sr.label, AUTO_DETAIL[sr.key],
        !removedLines().has(sr.key), on => setRemoved(sr.key, !on))),
      options.map(o => row(swatches.get(o.id), o.title, o.detail,
        chosen.has(o.id), on => { on ? chosen.add(o.id) : chosen.delete(o.id); R.setSettings({ chartExtras: [...chosen] }); paintSwatches(); }))));
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

  // Only factors whose pain differs with and without, by the same numbers as their own page
  const rows = factors.map(f => ({ factor: f, st: factorStory(f, data, today) }))
    .filter(x => x.st.state === 'up' || x.st.state === 'down')
    .map(x => ({ factor: x.factor, delta: x.st.best.delta, early: x.st.early }))
    .sort((a, b) => (a.early - b.early) || Math.abs(b.delta) - Math.abs(a.delta))
    .slice(0, 5);
  if (!rows.length) {
    return h('section', { class: 'card glass patterns' }, head,
      h('div', { class: 'pat-list ghost', 'aria-hidden': 'true' }, [0.55, -0.4, 0.22].map(w => patRow(null, w))),
      h('p', { class: 'hint' }, data.dailyEntries.length < 4 ? 'A few more check-ins and patterns show here.' : 'Nothing stands out yet.'));
  }

  const shown = rows;
  const allEarly = rows.every(a => a.early);
  const scale = Math.max(2, ...shown.map(a => Math.abs(a.delta)));
  // Over a couple of weeks, what to try: up to two, the clearest first
  const findings = trendFindings(data, factors, today).slice(0, 2);
  return h('section', { class: 'card glass patterns' },
    findings.length ? h('div', { class: 'findings' }, head, findings.map(findingRow)) : null,
    h('div', { class: 'pat-head' }, findings.length ? h('span', {}) : head,
      h('span', { class: 'pat-axis', 'aria-hidden': 'true' }, h('small', {}, '← Less pain'), h('small', {}, 'More pain →'))),
    h('div', { class: 'pat-list' }, shown.map(a => patRow(a, (a.delta ?? 0) / scale))),
    allEarly ? h('p', { class: 'hint pat-note' }, 'Early reads. They firm up as you check in.') : null,
    h('p', { class: 'hint pat-note' }, 'Patterns from your diary, not medical advice.'));
}

/** "Try cutting back on desk sitting…": a dot for which way it points, the finding, then what to do. */
function findingRow(f) {
  const good = f.kind === 'keep' || f.kind === 'not-stressor';
  return h('a', { class: 'finding', href: `#/factor/${f.factor.id}` },
    h('i', { class: `finding-dot ${good ? 'good' : 'bad'}`, 'aria-hidden': 'true' }),
    h('span', { class: 'grow' }, h('span', { class: 'finding-title' }, f.title), h('span', { class: 'hint block' }, f.body)));
}

/** One factor: its name, then a bar growing out from the centre line (w is -1..1 of the half width).
    No difference to show yet (only days with it so far): a dot on the line in its role's colour. */
function patRow(a, w) {
  const name = h('span', { class: 'pat-name' }, a ? a.factor.name : '');
  if (a && a.delta == null) {
    const dot = h('span', { class: `pat-dot ${a.factor.role === 'helper' ? 'helper' : 'stressor'}` });
    return h('a', { class: 'pat-row', href: `#/factor/${a.factor.id}`, 'aria-label': `${a.factor.name}: logged, nothing to compare yet` }, name, h('span', { class: 'pat-track' }, dot));
  }
  const up = w > 0;
  const bar = h('span', { class: `pat-bar ${up ? 'up' : 'down'}${a?.early ? ' early' : ''}`, style: `--w:${Math.abs(w) * 100}%` },
    a ? h('b', {}, `${up ? '+' : '−'}${Math.abs(a.delta).toFixed(1)}`) : null);
  if (!a) return h('div', { class: 'pat-row' }, name, h('span', { class: 'pat-track' }, bar));
  const label = `${a.factor.name}: pain ${Math.abs(a.delta).toFixed(1)} ${up ? 'higher' : 'lower'} on days with it${a.early ? ', early read' : ''}`;
  return h('a', { class: 'pat-row', href: `#/factor/${a.factor.id}`, 'aria-label': label }, name, h('span', { class: 'pat-track' }, bar));
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
  const r = R.routines.all()[0];
  if (!r) return h('a', { class: 'tile static', href: '#/routine/new' }, h('h2', {}, 'Routine'), h('span', { class: 'tile-title' }, '+ Create a movement routine'));
  // A session done more than once (mobility twice in a day) counts each time
  const timesOn = date => R.routines.completionsOn(date, r.id).reduce((n, c) => n + (c.times ?? 1), 0);
  const done = timesOn(today);
  const target = Math.max(1, r.schedule.filter(e => reminderOn(e, today)).length);
  const allDone = done >= target;
  const week = Array.from({ length: 7 }, (_, i) => timesOn(addDays(today, -i))).reduce((a, b) => a + b, 0);
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
    h('span', { class: 'tile-title link' }, `${R.routineLabel(r)} · ${week} this week`),
    celebrate ? h('span', { class: 'sr-only', role: 'status' }, `${R.routineLabel(r)} done. Logged as a helper.`) : null);
}

function aiTile() {
  return h('button', { type: 'button', class: 'tile static ai-tile', onclick: openShareSheet },
    h('div', { class: 'ai-text' },
      h('h2', {}, 'Analyse your data with AI'),
      h('span', { class: 'hint' }, 'Export your diary to an AI chat to spot trends and see what lines up with your pain.')),
    h('span', { class: 'well action', 'aria-hidden': 'true' }, '✳︎'));
}

/**
 * Sharing the diary with an AI chat: says what goes and to whom, right above the buttons that send it.
 * The app sends nothing itself; the person picks where it goes. Apple Health data stays out unless switched on.
 */
function openShareSheet() {
  if (!R.checkins.all().length) return toast('Check in at least once first');
  const health = healthSwitch();
  const opts = () => ({ health: health?.input.checked });
  sheet(close => h('div', { class: 'stack' },
    h('h2', {}, 'Analyse with AI'),
    h('p', { class: 'muted' }, 'Shares your pain, notes and activity with the AI app you choose, under its own privacy terms. Its answers aren’t medical advice.'),
    health?.row,
    h('button', { type: 'button', class: 'btn primary', onclick: async () => { await shareDiary(opts()); close(); } }, 'Share'),
    h('button', { type: 'button', class: 'btn glass', onclick: async () => { toast((await copyDiary(opts())) ? 'Copied. Paste it into an AI chat.' : 'Couldn’t copy'); close(); } }, 'Copy as text')));
}
