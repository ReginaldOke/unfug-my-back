// Routines: your list, one page per routine (edit it and log a day's session in the same place),
// and a one-move-at-a-time player that shares the session in progress.
import { h, s as svg, toast, iconButton, confirmSheet, sheet, vibrate } from '../lib/ui.js';
import { progressRows, moveText } from '../lib/progress.js';
import { smoothPath } from './chart.js';
import * as R from '../lib/repos.js';
import { localDate, dayLabel, parseDate } from '../lib/dates.js';
import { bumpLastNumber, parseReminder, formatReminder } from '../lib/labels.js';
import { checkinDraft } from './checkin.js';
import { MoveFigure, figureTop } from './figure.js';
import { isTimed, formVideoUrl, startIndex } from '../lib/play.js';
import { calmFor } from '../lib/calm.js';
import { keepAwake } from '../lib/native.js';
import { dragHandles } from './sortable.js';
import { libraryRoutine } from '../lib/routine-library.js';
import { emojiFor } from '../lib/labels.js';
import { readRoutine } from '../lib/routine-import.js';
import { readRoutineFile } from '../lib/routine-files.js';
import { nameForMoves, nameForSplit, nameDays, freshName } from '../lib/routine-name.js';

/** Set when a routine is finished, read once by the Today screen to play its celebration. */
export const justFinished = { id: null };

// Redraws the list in place after a tick, so the page doesn't reload (or replay its entrance)
let repaintList = () => {};

export function RoutinesView() {
  const cards = h('div', { class: 'routine-list' });
  repaintList = () => {
    const today = localDate();
    cards.replaceChildren(...groupsOf(R.routines.all()).map(days => {
      const card = days.length > 1 || days[0].group ? groupCard(days, today) : routineCard(days[0], today);
      card.classList.add('drag-row');
      card.dataset.ids = days.map(r => r.id).join(',');
      return card;
    }));
  };
  repaintList();
  // Hold a card, then drag, to move it; hold and let go for its options
  dragHandles(cards, {
    hold: true, skip: '.done-toggle',
    onReorder: rows => R.routines.reorder(rows.flatMap(r => r.dataset.ids.split(','))),
    onHold: row => routineMenu(row.dataset.ids.split(',').map(R.routines.get)),
  });
  return h('div', { class: 'view' },
    h('header', { class: 'top-bar' }, h('h1', {}, 'Routines')),
    R.routines.all().length ? null : h('p', { class: 'muted' }, 'Keep your gym, stretching or calisthenics routines here. Tick one off in your check-in, or open it to log your sets.'),
    cards,
    // Making one and finding one, side by side as a matching pair
    h('div', { class: 'routine-ctas' },
      h('a', { class: 'btn dashed', href: '#/routine/new' }, '+ New routine'),
      h('a', { class: 'btn glass', href: '#/routines/browse' }, 'Browse routines')));
}

/** A held card's options: show it on Home, or delete it (a group goes with all its variations). */
function routineMenu(list) {
  const name = list[0].group ?? list[0].name;
  const onHome = list.some(r => r.id === R.routines.onHome()?.id);
  sheet(close => h('div', { class: 'stack' },
    h('h2', {}, name),
    onHome
      ? h('p', { class: 'hint' }, 'Showing on Home')
      : h('button', { type: 'button', class: 'btn glass', onclick: () => { R.routines.showOnHome(list[0].id); close(); toast(`${name} is on Home`); } }, 'Show on Home'),
    h('button', {
      type: 'button', class: 'btn danger', onclick: async () => {
        close();
        const more = list.length > 1 ? `Its ${list.length} variations go too. ` : '';
        if (!(await confirmSheet(`Delete ${name}?`, `${more}Past sessions stay in your history.`, 'Delete', { danger: true }))) return;
        list.forEach(r => R.routines.archive(r.id));
        repaintList();
      },
    }, 'Delete routine')));
}

/** Routines in list order, the variations of a group kept together where the group first appears. */
function groupsOf(list) {
  const out = [], seen = new Map();
  for (const r of list) {
    if (!r.group) { out.push([r]); continue; }
    if (!seen.has(r.group)) { seen.set(r.group, []); out.push(seen.get(r.group)); }
    seen.get(r.group).push(r);
  }
  for (const days of seen.values()) days.sort((a, b) => (a.groupOrder ?? 0) - (b.groupOrder ?? 0));
  return out;
}

/**
 * One card for the group: its name opens the first variation; below, a row per variation. Each row
 * opens that variation; the tick sits apart at the far end, so opening one never ticks it by accident.
 */
function groupCard(days, today) {
  const status = doneStatus(days, today);
  const first = `#/routine/${days[0].id}`;
  return h('section', { class: 'card glass routine-card group-card' },
    h('a', { class: 'routine-head', href: first, 'aria-label': `${days[0].group}. Open ${days[0].name}` },
      h('span', { class: 'well', 'aria-hidden': 'true' }, R.routineIcon({ name: days[0].group })),
      h('div', { class: 'grow' }, h('h2', {}, days[0].group), status ? h('p', { class: 'hint' }, status) : null)),
    h('ul', { class: 'variation-list' }, days.map(r => {
      const done = R.routines.completionsOn(today, r.id).length > 0;
      return h('li', { class: `variation-row${done ? ' done' : ''}` },
        h('a', { class: 'variation-open', href: `#/routine/${r.id}`, 'aria-label': `${R.routineLabel(r)}. Open` },
          h('span', { class: 'variation-name' }, r.name),
          h('span', { class: 'hint' }, `${r.items.length} move${r.items.length === 1 ? '' : 's'}`),
          h('span', { class: 'chev', 'aria-hidden': 'true' }, '›')),
        doneToggle(r, today, done));
    })));
}

function routineCard(r, today) {
  const status = doneStatus([r], today);
  const done = R.routines.completionsOn(today, r.id).length > 0;
  return h('a', { class: 'card glass routine-card', href: `#/routine/${r.id}`, 'aria-label': `${r.name}${status ? `, ${status}` : ''}. Open` },
    h('div', { class: 'routine-head' },
      h('span', { class: 'well', 'aria-hidden': 'true' }, R.routineIcon(r)),
      h('div', { class: 'grow' }, h('h2', {}, r.name), status ? h('p', { class: 'hint' }, status) : null),
      doneToggle(r, today, done)),
    h('ol', { class: 'moves' }, r.items.map(it => h('li', {}, h('span', {}, it.name), h('span', { class: 'hint' }, doseText(it))))));
}

/** "3 × 4 · 10 s hold": a move's target, with its second box when it has one. */
export const doseText = it => [it.dose, it.extra].filter(Boolean).join(' · ');

/** The quick way: a circle that marks the routine done for today (with its usual reps), or undoes it. */
// The list is redrawn on every tick: this is the one that just went on, so only it pops
let justTicked = null;

function doneToggle(r, today, done) {
  const fresh = done && justTicked === r.id;
  if (fresh) justTicked = null;
  return h('button', {
    type: 'button', class: `done-toggle${done ? ' on' : ''}${fresh ? ' fresh' : ''}`, 'aria-pressed': String(done),
    'aria-label': done ? `Unmark ${R.routineLabel(r)} for today` : `Mark ${R.routineLabel(r)} done for today`,
    onclick: e => {
      e.preventDefault(); e.stopPropagation();
      if (done) { R.routines.undo(r.id, today); toast(`${R.routineLabel(r)} unmarked`); }
      else {
        R.routines.logSession(r.id, today, { log: r.items.map(it => ({ name: it.name, did: it.dose || '✓', ...(it.extra ? { extra: it.extra } : {}) })) });
        vibrate(10);
        justTicked = r.id;
        toast(`${R.routineLabel(r)} done`);
      }
      repaintList();
    },
  });
}

const lastDone = id => R.routines.lastDoneDate(id);

/** "Completed 2× today", or "Last done Tuesday", or nothing if it's never been done. */
function doneStatus(routines, today) {
  const times = routines.reduce((n, r) => n + R.routines.completionsOn(today, r.id).reduce((k, c) => k + (c.times ?? 1), 0), 0);
  if (times) return `Completed ${times}× today`;
  const last = routines.map(r => lastDone(r.id)).filter(Boolean).sort().at(-1);
  return last ? `Last done ${dayLabel(last).toLowerCase()}` : null;
}

// Sessions in progress, by routine and day, shared by the routine page and the player, so reps
// adjusted in one show up in the other. Cleared when the session is saved.
const sessions = new Map();
// How hard you went: 1 (easy) to 3 (all out), in fine steps; the word is the nearest half step
// Whole steps match the check-in's Easy, Moderate and Hard
const EFFORT_WORDS = ['Easy', 'Light', 'Moderate', 'Tough', 'Hard'];
const effortWord = v => EFFORT_WORDS[Math.round((v - 1) * 2)];
const MAX_TIMES = 10;
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const timesWord = n => (n === 1 ? 'Once' : n === 2 ? 'Twice' : `${n} times`);
// Mobility and stretching are counted (how many times today); everything else is how hard
const defaultMeasure = name => R.measureOf({ name });

function sessionFor(r, date, fromCheckin) {
  const key = `${r?.id ?? 'new'}|${date}`;
  if (sessions.has(key)) return sessions.get(key);
  const logged = r ? R.routines.sessionOn(r.id, date) : null;
  const before = r ? R.routines.lastDid(r.id, date) : new Map();
  const didNow = new Map((logged?.log ?? []).map(x => [x.name, x.did]));
  const extraNow = new Map((logged?.log ?? []).filter(x => x.extra).map(x => [x.name, x.extra]));
  const extraBefore = r ? R.routines.lastExtra(r.id, date) : new Map();
  const draft = fromCheckin && r ? checkinDraft(date) : null;
  // Each box starts with what you did today if logged, else last time, else the target
  const s = {
    key, id: r?.id ?? null, date, name: r?.name ?? '', group: r?.group ?? null, schedule: [...(r?.schedule ?? [])], icon: r?.icon ?? null,
    items: (r?.items ?? []).map(it => {
      const now = didNow.get(it.name);
      // extraDose is the routine's own second box (a hold, say), kept apart from what's typed today
      return { name: it.name, dose: it.dose, extraDose: it.extra, did: now || before.get(it.name) || it.dose || '', done: !!now, extra: extraNow.get(it.name) ?? extraBefore.get(it.name) ?? it.extra ?? '' };
    }),
    intensity: draft?.intensity.get(r.linkedFactorId) ?? logged?.intensity ?? 2,
    measure: r?.measure ?? defaultMeasure(`${r?.group ?? ''} ${r?.name ?? ''}`),
    times: logged?.times ?? 1,
    // Timed on this day, with the routine page's stopwatch or in the player (today's log only)
    timed: (logged?.log ?? []).filter(x => x.timed).map(x => ({ name: x.name, did: x.did })),
  };
  sessions.set(key, s);
  return s;
}

/**
 * Saves the routine (name, moves, reminders) and, if any move is ticked, that day's session.
 * Returns the routine, or null if it can't be saved yet.
 */
function saveSession(s, { fromCheckin }) {
  // Other variations edited in this visit save too, so switching tabs never loses anything
  const others = s.group ? [...sessions.values()].filter(x => x !== s && x.date === s.date && x.group === s.group && x.id) : [];
  const r = saveOne(s, { markDone: true });
  if (!r) return null;
  const logged = [s, ...others].filter(x => x === s || saveOne(x)).some(x => x.logged);
  toast(logged ? `${R.routineLabel(r)} logged` : 'Routine saved');
  if (fromCheckin) location.hash = `#/checkin?date=${s.date}`;
  else if (logged && s.date === localDate()) { justFinished.id = r.id; location.hash = '#/'; }
  else location.hash = '#/routines';
  return r;
}

/** A new routine left unnamed is named for what's in it ("Push", "Hip and hamstring stretch"), unlike any other. */
function autoName(s) {
  const n = nameForMoves(s.items);
  return n ? freshName(n, R.routines.all().filter(r => r.id !== s.id).map(R.routineLabel)) : '';
}

/** Saves one routine (or variation) and, if any move is ticked, its session. Returns the routine, or null. */
/** markDone: Done on an existing routine's own page logs it as done today, whatever was entered. */
function saveOne(s, { markDone = false } = {}) {
  if (!s.name.trim() && s.group === null && !s.id) s.name = autoName(s);
  const name = s.name.trim();
  const items = s.items.filter(it => it.name.trim());
  if (s.group !== null && !s.group.trim()) { toast('Give the routine a name'); return null; }
  if (!name) { toast(s.group ? 'Give this variation a name' : 'Give the routine a name'); return null; }
  if (!items.length) { toast(s.group ? `Add a move to ${name}` : 'Add at least one move'); return null; }
  const moves = items.map(templateOf);
  const existing = s.id ? R.routines.get(s.id) : null;
  const group = s.group?.trim() || null;
  if (existing?.group && group && existing.group !== group) R.routines.renameGroup(existing.group, group);
  const changed = !existing || existing.name !== name || (existing.group ?? null) !== group || (existing.measure ?? defaultMeasure(`${existing.group ?? ''} ${existing.name}`)) !== s.measure || JSON.stringify(existing.items) !== JSON.stringify(moves)
    || existing.schedule.join() !== [...new Set(s.schedule)].sort().join() || (s.icon && existing.icon !== s.icon);
  const r = changed ? R.routines.save(s.id, { name, group, measure: s.measure, items: moves, schedule: [...new Set(s.schedule)].sort(), ...(s.icon ? { icon: s.icon } : {}) }) : R.routines.get(s.id);
  // Done on a routine's page marks it done; a brand-new routine isn't (making it isn't doing it). Other
  // variations edited on the way only log if something was entered for them.
  const logIt = (markDone && !!s.id) || s.touched || items.some(it => it.done);
  if (logIt) {
    const log = [
      ...items.map(it => ({ name: it.name.trim(), did: it.did.trim() || '✓', ...(it.extra?.trim() ? { extra: it.extra.trim() } : {}), ...(isTimedEntry(s, it) ? { timed: true } : {}) })),
      // Timings of the routine's own moves are already in their rows above
      ...(s.timed ?? []).filter(t => !items.some(it => it.name.trim() === t.name)).map(t => ({ name: t.name, did: t.did, timed: true })),
    ];
    // A check-in in progress saves the tick itself; otherwise the routine is ticked for that day now
    const live = checkinDraft(s.date);
    R.routines.logSession(r.id, s.date, s.measure === 'count' ? { log, times: s.times } : { log, intensity: s.intensity }, { writeLog: !live });
    if (live) { live.selections.set(r.linkedFactorId, 1); live.intensity.set(r.linkedFactorId, s.intensity); }
  }
  sessions.delete(s.key);
  s.logged = logIt;
  return r;
}

/**
 * A move as the routine keeps it: its target, and its second box (a hold, a weight) when it has one.
 * A second box added for a new move becomes part of it; emptying one takes it away.
 */
const templateOf = it => {
  const extra = it.extraDose !== undefined ? it.extraDose : it.extra?.trim();
  return { name: it.name.trim(), dose: it.dose || it.did.trim(), ...(extra ? { extra } : {}) };
};

/** Whether a move's time came from a timer, so it's listed under the routine page's stopwatch. */
const isTimedEntry = (s, it) => (s.timed ?? []).some(t => t.name === it.name.trim());

/**
 * A timed hold, from the player or the routine page's timer: a move's box takes the time, it's listed with
 * the routine page's timings, and it's saved to the day's session straight away, so it's kept (and on the
 * progress chart) the moment the timer stops, without Finish or Done.
 */
function keepTime(s, name, did) {
  const it = s.items.find(x => x.name.trim().toLowerCase() === name.trim().toLowerCase());
  name = it ? it.name.trim() : name.trim();
  if (it) { it.did = did; it.done = true; }
  s.touched = true;
  s.timed = [...(s.timed ?? []).filter(t => t.name !== name), { name, did }];
  if (!s.id) return; // a routine not saved yet keeps the time with the session until it is
  const before = R.routines.sessionOn(s.id, s.date)?.log ?? [];
  const log = [...before.filter(x => x.name !== name), { name, did, timed: true }];
  const live = checkinDraft(s.date);
  R.routines.logSession(s.id, s.date, s.measure === 'count' ? { log, times: s.times } : { log, intensity: s.intensity }, { writeLog: !live });
}

/** 0:07, 1:45, 1:02:10 */
export function fmtClock(ms) {
  const t = Math.floor(ms / 1000), hr = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), sec = String(t % 60).padStart(2, '0');
  return hr ? `${hr}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
}

const CLOCK = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="13.5" r="7.5"/><path d="M12 9.5v4l2.5 1.5M10 2.5h4"/></svg>';

/**
 * A small stopwatch under the moves, on the right, for timed holds like a dead hang. Tap to start, tap to
 * stop, name it, save. A name that matches a move fills that move's box (so it's tracked like reps);
 * any other name joins today's session only, listed under the timer. The clock lives in the session,
 * so it keeps running while you switch variations or open the player.
 */
function stopwatch(s, repaintMoves, ctx) {
  s.clock ??= { start: null, held: 0, label: '' };
  const c = s.clock;
  const el = h('div', { class: 'stopwatch' });
  const now = () => c.held + (c.start ? Date.now() - c.start : 0);
  let tick = 0;
  const run = () => { clearInterval(tick); if (c.start) tick = setInterval(() => { const t = el.querySelector('.sw-time'); if (t) t.textContent = fmtClock(now()); }, 250); };
  ctx.onCleanup(() => clearInterval(tick));

  const save = label => {
    const name = label.trim();
    if (!name) return toast('Name it first');
    keepTime(s, name, fmtClock(now()));
    if (s.items.some(it => it.name.trim().toLowerCase() === name.toLowerCase())) repaintMoves();
    Object.assign(c, { start: null, held: 0, label: name });
    vibrate(8);
    paint();
  };

  function paint() {
    const ms = now();
    const pill = (cls, label, onclick, inner) => {
      const b = h('button', { type: 'button', class: `sw-pill glass ${cls}`, 'aria-label': label, onclick }, ...inner);
      return b;
    };
    let row;
    if (c.start) {
      // Running: the time, and a tap stops it
      row = pill('running', 'Stop the timer', () => { c.held = now(); c.start = null; vibrate(6); paint(); },
        [h('span', { class: 'sw-dot', 'aria-hidden': 'true' }), h('span', { class: 'sw-time' }, fmtClock(ms))]);
    } else if (ms > 0) {
      // Stopped: name it and save, carry on, or let it go
      const name = h('input', {
        type: 'text', class: 'sw-name', value: c.label, placeholder: 'What was it?', maxlength: 40, 'aria-label': 'What you timed', enterkeyhint: 'done',
        onkeydown: e => { if (e.key === 'Enter') { e.preventDefault(); save(name.value); } },
      });
      row = h('div', { class: 'sw-stopped glass' },
        h('button', { type: 'button', class: 'sw-time', 'aria-label': 'Carry on timing', onclick: () => { c.start = Date.now(); paint(); } }, fmtClock(ms)),
        name,
        h('button', { type: 'button', class: 'sw-save', onclick: () => save(name.value) }, 'Save'),
        h('button', { type: 'button', class: 'sw-x', 'aria-label': 'Discard this time', onclick: () => { c.held = 0; paint(); } }, '✕'));
      setTimeout(() => { if (!c.label) name.focus({ preventScroll: true }); }, 30);
    } else {
      const b = pill('idle', 'Start a timer', () => { c.start = Date.now(); vibrate(6); paint(); }, [h('span', { class: 'sw-icon' }), h('span', {}, 'Timer')]);
      b.querySelector('.sw-icon').innerHTML = CLOCK;
      row = b;
    }
    // What's been timed today that isn't one of the moves
    const saved = (s.timed ?? []).map(t => h('div', { class: 'sw-saved' },
      h('span', { class: 'grow' }, t.name), h('span', { class: 'sw-saved-time' }, t.did),
      h('button', { type: 'button', class: 'sw-x', 'aria-label': `Remove ${t.name}`, onclick: () => { s.timed = s.timed.filter(x => x !== t); s.touched = true; paint(); } }, '✕')));
    el.replaceChildren(row, ...saved);
    run();
  }
  paint();
  return el;
}

const CHART = '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 17l5-5 4 3 8-8"/><path d="M15 7h5v5"/></svg>';

/**
 * How each move has gone over the last dozen sessions, in the routine's order, one line per move like
 * the routine itself: its name, a small glowing line like Home's chart, and what you did on the chosen
 * day in a column of fixed width, so nothing shifts as the day changes. Touch or drag along any line to
 * choose a day; every row follows. Starts on the latest session.
 */
function progressView(session, past) {
  const shown = past.slice(-12);
  const rows = progressRows(session.items.map(it => it.name), shown);
  const W = 120, H = 34, pad = 4, n = shown.length;
  const x = i => pad + (n === 1 ? (W - 2 * pad) / 2 : (i * (W - 2 * pad)) / (n - 1));
  let sel = n - 1;
  const el = h('div', { class: 'prog' });

  // Every line sits in the same column, so any one is the ruler (they're redrawn as you drag)
  const choose = e => {
    const ruler = el.querySelector('.prog-chart');
    if (!ruler) return;
    const box = ruler.getBoundingClientRect();
    const f = (e.clientX - box.left) / box.width;
    const i = Math.max(0, Math.min(n - 1, Math.round(((f * W - pad) / (W - 2 * pad)) * (n - 1))));
    if (i !== sel) { sel = i; vibrate(3); paint(); }
  };

  function line(row) {
    const pts = row.values.map((v, i) => (v ? { i, v: v.value } : null)).filter(Boolean);
    if (pts.length < 2) return h('div', { class: 'prog-chart empty' });
    const lo = Math.min(...pts.map(p => p.v)), hi = Math.max(...pts.map(p => p.v));
    const y = v => (hi === lo ? H / 2 : H - pad - ((v - lo) / (hi - lo)) * (H - 2 * pad));
    const xy = pts.map(p => ({ x: x(p.i), y: y(p.v) }));
    const d = smoothPath(xy, pad, H - pad);
    const here = pts.find(p => p.i === sel);
    const chart = svg('svg', { class: 'prog-chart', viewBox: `0 0 ${W} ${H}`, 'aria-hidden': 'true' },
      svg('path', { class: 'prog-area', d: `${d} L${xy.at(-1).x},${H} L${xy[0].x},${H} Z` }),
      svg('line', { class: 'prog-hair', x1: x(sel), x2: x(sel), y1: 0, y2: H }),
      svg('path', { class: 'prog-line', d }),
      here ? svg('circle', { class: 'prog-dot', cx: x(sel), cy: y(here.v), r: 2.6 }) : null);
    return chart;
  }

  function paint() {
    const day = shown[sel].date;
    el.replaceChildren(
      h('div', { class: 'prog-head' },
        h('span', {}, parseDate(day).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })),
        h('span', { class: 'hint' }, `${sel + 1} of ${n}`)),
      ...rows.map(row => {
        const e = row.entries[sel];
        return h('div', { class: 'prog-row' },
          h('span', { class: 'prog-name' }, row.name),
          line(row),
          h('span', { class: `prog-val${e ? '' : ' none'}` }, e ? moveText(e) : '–'));
      }));
  }
  // One gesture for the whole view: touch a line, drag along it
  let dragging = false;
  el.addEventListener('pointerdown', e => { if (!e.target.closest('.prog-chart')) return; dragging = true; el.setPointerCapture?.(e.pointerId); choose(e); });
  el.addEventListener('pointermove', e => { if (dragging) choose(e); });
  el.addEventListener('pointerup', () => { dragging = false; });
  el.addEventListener('pointercancel', () => { dragging = false; });
  paint();
  return el;
}

// A play mark in a rounded frame: watch a video
const WATCH = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="4"/><path d="M10.5 9.5v5l4.2-2.5z" fill="currentColor"/></svg>';
const PLAY = '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M8 5.5v13l11-6.5-11-6.5Z"/></svg>';
const INFO = '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.2"/><circle cx="12" cy="7.8" r=".6" fill="currentColor"/></svg>';
// Emoji offered when changing a routine's own; any other can be typed in the box after them
const ROUTINE_EMOJI = ['🧘', '🤸', '🏋️', '💪', '🛡️', '🎯', '🦵', '🚶', '🏊', '☯️', '🪷', '🌬️', '🌿'];

/**
 * The routine's emoji beside its name: tap it to pick another from a short row, or type any emoji
 * into the box at the end of the row.
 */
function emojiPicker(s) {
  const current = () => s.icon || emojiFor(`${s.group ?? ''} ${s.name}`, { exercise: true });
  const btn = h('button', { type: 'button', class: 'well emoji-btn', 'aria-label': 'Change the emoji', 'aria-expanded': 'false' }, current());
  const own = h('input', {
    type: 'text', class: 'emoji-own', placeholder: '🙂', 'aria-label': 'Any emoji', maxlength: 8, enterkeyhint: 'done',
    oninput: e => { const m = e.target.value.match(/\p{Extended_Pictographic}(\u200d\p{Extended_Pictographic}|\ufe0f)*/u); if (m) choose(m[0]); },
  });
  const row = h('div', { class: 'emoji-row', hidden: true, role: 'group', 'aria-label': 'Emoji' },
    ROUTINE_EMOJI.map(e => h('button', { type: 'button', class: 'emoji-opt', 'aria-label': e, onclick: () => choose(e) }, e)), own);
  const open = on => { row.hidden = !on; btn.setAttribute('aria-expanded', String(on)); if (on) row.querySelectorAll('.emoji-opt').forEach(b => b.classList.toggle('on', b.textContent === current())); };
  function choose(e) { s.icon = e; btn.textContent = e; own.value = ''; vibrate(6); open(false); }
  btn.onclick = () => { open(row.hidden); vibrate(4); };
  return { btn, row };
}

/**
 * One page per routine: tap the title to rename it, set reps by typing or swiping the box (+ adds a
 * second box, for weight or a note), hold a row to drag it, swipe a row left to delete it, set how hard
 * you went and the reminders, then Done (which logs the day if you entered anything). ▶ plays it one move at a time.
 */
export function RoutineView(ctx) {
  const r = ctx.args[0] && ctx.args[0] !== 'new' ? R.routines.get(ctx.args[0]) : null;
  if (ctx.args[0] && ctx.args[0] !== 'new' && !r) return h('div', { class: 'view' }, h('p', {}, 'Routine not found.'), h('a', { href: '#/routines' }, 'Routines'));
  const date = ctx.params.get('date') || localDate();
  const fromCheckin = ctx.params.get('from') === 'checkin';
  const s = sessionFor(r, date, fromCheckin);
  if (!s.items.length) s.items.push({ name: '', dose: '', did: '', done: false });
  const stay = `date=${date}${fromCheckin ? '&from=checkin' : ''}`;

  // The title is the routine's name, or the group's when it has days
  const title = h('input', {
    type: 'text', class: 'title-input routine-title', value: s.group ?? s.name, placeholder: 'Routine name', 'aria-label': 'Routine name', maxlength: 60,
    oninput: e => { if (s.group !== null) s.group = e.target.value; else s.name = e.target.value; },
    onkeydown: e => { if (e.key === 'Enter') e.target.blur(); },
  });

  // Variations: a tab for each (this one's name is editable), and + to add one
  function variationTabs() {
    const add = h('button', {
      type: 'button', class: `chip add day-add${s.group === null ? '' : ' round'}`, 'aria-label': 'Add a variation', onclick: () => {
        if (!s.id && !saveDraftRoutine()) return;
        if (s.group === null) { s.group = s.name.trim(); s.name = 'A'; }
        R.routines.save(s.id, { group: s.group.trim(), name: s.name.trim() || 'A', groupOrder: R.routines.get(s.id).groupOrder ?? 0 });
        const next = R.routines.addVariation(s.id);
        location.replace(`#/routine/${next.id}?${stay}&rename=1`);
      },
    }, s.group === null ? '+ Add a variation' : '+');
    if (s.group === null) return h('div', { class: 'day-tabs' }, add);
    const nameBox = h('input', {
      type: 'text', class: 'chip day-tab on', value: s.name, size: Math.max(2, s.name.length), 'aria-label': 'Variation name', maxlength: 40,
      oninput: e => { s.name = e.target.value; e.target.size = Math.max(2, e.target.value.length); },
      onkeydown: e => { if (e.key === 'Enter') e.target.blur(); },
    });
    // A new variation opens with its name selected, ready to type over
    if (ctx.params.get('rename')) setTimeout(() => { nameBox.focus(); nameBox.select(); }, 80);
    return h('div', { class: 'day-tabs', role: 'tablist' },
      R.routines.group(R.routines.get(s.id)).map(d => d.id === s.id ? nameBox
        : h('a', { class: 'chip glass day-tab', role: 'tab', href: `#/routine/${d.id}?${stay}`, onclick: e => { e.preventDefault(); location.replace(e.currentTarget.getAttribute('href')); } }, sessions.get(`${d.id}|${date}`)?.name ?? d.name)),
      add);
  }

  const list = h('div', { class: 'log-list' });
  const rowItem = new Map();
  let openRow = null; // the row swiped open to show Delete
  const closeOpen = () => { if (openRow) { openRow.slide(0); openRow = null; } };

  function moveRow(it) {
    const name = h('input', {
      type: 'text', class: 'log-name', value: it.name, placeholder: 'Move', 'aria-label': 'Move name', enterkeyhint: 'next',
      oninput: e => { it.name = e.target.value; paintActions(); },
      onkeydown: e => { if (e.key === 'Enter') e.target.blur(); },
    });
    // Touching the name doesn't open the keyboard straight away, so a hold can still lift the row
    name.addEventListener('pointerdown', e => {
      if (document.activeElement === name || !it.name) return;
      e.preventDefault();
    });
    name.addEventListener('click', () => { if (document.activeElement !== name) name.focus(); });
    const did = h('input', {
      type: 'text', class: 'did-input', value: it.did, inputmode: 'text', enterkeyhint: 'next', placeholder: 'Reps',
      'aria-label': `Reps: ${it.name}`,
      oninput: e => { it.did = e.target.value; s.touched = true; fitWidth(did); },
      onkeydown: e => { if (e.key === 'Enter') { e.preventDefault(); const next = row.nextElementSibling?.querySelector('.did-input'); next ? next.focus() : e.target.blur(); } },
    });
    scrubNumber(did, () => it.dose || '0', () => { s.touched = true; fitWidth(did); });
    // A second box for anything else (weight, a note…): + adds it, emptying it takes it away again
    const extra = h('input', {
      type: 'text', class: 'did-input extra-input', value: it.extra ?? '', placeholder: '…', enterkeyhint: 'done',
      'aria-label': `Extra for ${it.name}, like weight or a note`,
      oninput: e => { it.extra = e.target.value; s.touched = true; fitWidth(extra); },
      onkeydown: e => { if (e.key === 'Enter') { e.preventDefault(); e.target.blur(); } },
      onblur: () => { if (!extra.value.trim()) { it.extra = ''; if (it.extraDose) it.extraDose = ''; showExtra(false); } },
    });
    const plus = h('button', { type: 'button', class: 'extra-add', 'aria-label': `Add another box for ${it.name || 'this move'}`, onclick: () => { showExtra(true); extra.focus(); } }, '+');
    const showExtra = on => { extra.hidden = !on; plus.hidden = on; };
    showExtra(!!it.extra);
    requestAnimationFrame(() => { fitWidth(did); fitWidth(extra); });

    const inner = h('div', { class: 'log-inner' }, name, plus, did, extra);
    const del = h('button', { type: 'button', class: 'log-del', 'aria-label': `Delete ${it.name || 'move'}`, onclick: () => remove() }, 'Delete');
    const row = h('div', { class: 'log-row drag-row' }, del, inner);
    rowItem.set(row, it);

    function remove() {
      row.style.height = `${row.offsetHeight}px`;
      row.classList.add('removing');
      requestAnimationFrame(() => { row.style.height = '0px'; });
      setTimeout(() => { s.items.splice(s.items.indexOf(it), 1); row.remove(); openRow = null; paintActions(); }, 240);
      vibrate(8);
    }

    // Swipe left to reveal Delete; a short swipe springs back
    let sw = null;
    row.slide = x => { inner.style.transform = x ? `translateX(${x}px)` : ''; row.classList.toggle('open', x < 0); };
    let swallowUntil = 0;
    inner.addEventListener('pointerdown', e => {
      if (e.target.closest('.did-input, .extra-add') || e.button > 0) return;
      sw = { x: e.clientX, y: e.clientY, base: openRow === row ? -84 : 0, on: false };
    });
    inner.addEventListener('pointermove', e => {
      if (!sw || list.classList.contains('dragging')) return;
      if (!e.buttons) { sw = null; return; }
      const dx = e.clientX - sw.x, dy = e.clientY - sw.y;
      if (!sw.on) {
        if (Math.abs(dx) < 10 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
        sw.on = true;
        if (openRow && openRow !== row) closeOpen();
        row.classList.add('swiping');
      }
      row.slide(Math.max(-110, Math.min(0, sw.base + dx)));
    });
    const endSwipe = e => {
      if (!sw) return;
      const wasSwipe = sw.on;
      const x = sw.base + (e.clientX - sw.x);
      sw = null;
      row.classList.remove('swiping');
      if (!wasSwipe) return;
      if (x < -42) { row.slide(-84); openRow = row; } else { row.slide(0); if (openRow === row) openRow = null; }
      swallowUntil = performance.now() + 350; // a swipe isn't a tap on the name
    };
    inner.addEventListener('click', e => { if (performance.now() < swallowUntil) { e.stopPropagation(); e.preventDefault(); } }, true);
    inner.addEventListener('pointerup', endSwipe);
    inner.addEventListener('pointercancel', endSwipe);
    return row;
  }

  const paint = () => list.replaceChildren(...s.items.map(moveRow));
  paint();
  // Hold a row (its name or the space around it, not the box) to lift it, then drag
  dragHandles(list, {
    hold: true, skip: '.did-input, .extra-add, .log-name:focus, .log-del', onLift: closeOpen,
    onReorder: rows => { s.items.splice(0, s.items.length, ...rows.map(x => rowItem.get(x))); },
  });
  const closeOnTapAway = e => { if (openRow && !openRow.contains(e.target)) closeOpen(); };
  document.addEventListener('pointerdown', closeOnTapAway, { capture: true });
  ctx.onCleanup(() => document.removeEventListener('pointerdown', closeOnTapAway, { capture: true }));

  // Adding a move: its name, then how many; Enter goes from one to the other, then adds it
  const addName = h('input', {
    type: 'text', class: 'log-add-input', placeholder: '+ Add a move', 'aria-label': 'New move', enterkeyhint: 'next',
    onkeydown: e => { if (e.key === 'Enter') { e.preventDefault(); addReps.focus(); } },
  });
  const addReps = h('input', {
    type: 'text', class: 'did-input log-add-reps', placeholder: 'Reps', 'aria-label': 'Reps for the new move', enterkeyhint: 'done',
    onkeydown: e => { if (e.key === 'Enter') { e.preventDefault(); commitAdd(); addName.focus(); } },
  });
  const add = h('div', { class: 'log-add-row' }, addName, addReps);
  // Leaving the pair (not moving between its two boxes) adds what's there
  add.addEventListener('focusout', e => { if (!add.contains(e.relatedTarget)) commitAdd(); });
  function commitAdd() {
    const name = addName.value.trim();
    if (!name) return;
    const dose = addReps.value.trim();
    const it = { name, dose, did: dose, done: false };
    s.items.push(it);
    list.append(moveRow(it));
    addName.value = ''; addReps.value = '';
    paintActions();
  }

  // How it went: how hard (Easy to Hard), or how many times today, whichever this routine measures
  const word = h('span', { class: 'effort-word' });
  const field = h('div', { class: 'effort-field' });
  const counted = () => s.measure === 'count';
  const wordFor = v => (counted() ? timesWord(Math.round(v)) : effortWord(v));
  const value = () => (counted() ? s.times : s.intensity);
  const range = h('input', {
    type: 'range', class: 'effort-range', step: 0.01,
    oninput: e => {
      const before = wordFor(value());
      const v = Number(e.target.value);
      if (counted()) s.times = Math.round(v); else s.intensity = Math.round(v * 10) / 10;
      paintHow(v);
      if (wordFor(value()) !== before) vibrate(4); // a tick as the word changes, not on every pixel
    },
  });
  // The fill follows the finger exactly; effort runs green to red, a count stays teal
  const paintHow = (v = value()) => {
    const [lo, hi] = counted() ? [1, MAX_TIMES] : [1, 3];
    const f = (v - lo) / (hi - lo);
    word.textContent = wordFor(v);
    range.setAttribute('aria-valuetext', wordFor(v));
    range.setAttribute('aria-label', counted() ? 'How many times?' : 'How hard did you go?');
    range.style.setProperty('--pct', `${f * 100}%`);
    field.classList.toggle('counted', counted());
    field.style.setProperty('--h', String(counted() ? 168 : Math.round(f < 0.5 ? 135 - 87 * f * 2 : 48 - 46 * (f - 0.5) * 2)));
  };
  // What the slider measures, with a swap button beside it to switch between intensity and a count
  const question = h('span', { class: 'effort-question' });
  const switcher = h('button', { type: 'button', class: 'measure-swap', onclick: () => { setMeasure(counted() ? 'effort' : 'count'); vibrate(4); } });
  switcher.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 4 3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7"/></svg>';
  const setMeasure = m => {
    s.measure = m;
    range.min = 1; range.max = counted() ? MAX_TIMES : 3; range.value = value();
    question.textContent = counted() ? 'Times today' : 'Workout intensity';
    const other = counted() ? 'workout intensity' : 'times today';
    switcher.setAttribute('aria-label', `Track ${other} instead`);
    switcher.title = `Track ${other} instead`;
    paintHow();
  };
  field.append(h('div', { class: 'row between' }, h('span', { class: 'row tight' }, question, switcher), word), range);
  setMeasure(s.measure);

  // Reminders, as chips; + adds one
  const times = h('div', { class: 'reminder-list' });
  const paintTimes = () => times.replaceChildren(
    ...s.schedule.map((entry, i) => {
      // Each reminder: its time, the days it's on (all lit means every day), and ✕
      const { time, days } = parseReminder(entry);
      const on = new Set(days ?? [0, 1, 2, 3, 4, 5, 6]);
      const set = (t, d) => { s.schedule[i] = formatReminder(t, d.size ? [...d] : [0, 1, 2, 3, 4, 5, 6]); };
      return h('div', { class: 'reminder-row' },
        h('input', { type: 'time', class: 'reminder-time', value: time, 'aria-label': `Reminder ${i + 1} time`, onchange: e => set(e.target.value, on) }),
        h('div', { class: 'reminder-days', role: 'group', 'aria-label': `Reminder ${i + 1} days` }, [1, 2, 3, 4, 5, 6, 0].map(d => h('button', {
          type: 'button', class: on.has(d) ? 'on' : '', 'aria-pressed': String(on.has(d)), 'aria-label': WEEKDAYS[d],
          onclick: e => { on.has(d) ? on.delete(d) : on.add(d); e.currentTarget.classList.toggle('on', on.has(d)); e.currentTarget.setAttribute('aria-pressed', String(on.has(d))); set(parseReminder(s.schedule[i]).time, on); vibrate(3); },
        }, WEEKDAYS[d][0]))),
        h('button', { type: 'button', class: 'x', 'aria-label': `Remove reminder ${i + 1}`, onclick: () => { s.schedule.splice(i, 1); paintTimes(); } }, '✕'));
    }),
    h('button', { type: 'button', class: 'chip add', onclick: () => { s.schedule.push('18:00'); paintTimes(); } }, '+ Reminder'));
  paintTimes();

  const play = h('button', {
    type: 'button', class: 'icon-btn glass play-btn', 'aria-label': 'Follow along, one move at a time', title: 'Follow along',
    onclick: () => {
      if (!s.items.some(it => it.name.trim())) return toast('Add a move first');
      if (!s.id) { const saved = saveDraftRoutine(); if (!saved) return; }
      // The player and the routine page swap in place, so Back leaves the routine rather than bouncing between them
      location.replace(`#/routine/${s.id}/run?date=${date}${fromCheckin ? '&from=checkin' : ''}`);
    },
  });
  play.innerHTML = PLAY;
  const done = h('button', { type: 'button', class: 'icon-btn glass done-btn', onclick: () => saveSession(s, { fromCheckin }) }, 'Done');
  // A routine with no moves yet can't be played or done: Import takes their place until a move is added
  const importBtn = h('button', { type: 'button', class: 'icon-btn glass done-btn import-btn', onclick: () => importSheet(s, imported) }, 'Import');
  function paintActions() {
    const empty = !s.items.some(it => it.name.trim());
    importBtn.hidden = !empty; play.hidden = empty; done.hidden = empty;
    // Unnamed, a new routine shows the name it'll get from its moves, kept unless one is typed
    if (!s.id) title.placeholder = autoName(s) || 'Routine name';
  }
  paintActions();
  // What came in: one day fills this page to look over; several become variations, saved straight away
  function imported({ title: name, days }) {
    const items = d => d.items.map(it => ({ name: it.name, dose: it.dose, did: it.dose, done: false, extra: it.extra ?? '', extraDose: it.extra ?? '' }));
    if (days.length === 1) {
      s.items.splice(0, s.items.length, ...items(days[0]));
      const named = name ?? days[0].name ?? autoName(s);
      if (!title.value.trim() && named) { title.value = named; if (s.group !== null) s.group = named; else s.name = named; }
      paint(); paintActions();
      return;
    }
    const group = title.value.trim() || name || freshName(nameForSplit(days) ?? 'Imported routine', R.routines.all().map(r => r.group ?? r.name));
    const dayNames = nameDays(days);
    const made = days.map((d, i) => R.routines.save(null, {
      group, name: dayNames[i], groupOrder: i, schedule: [], items: items(d).map(templateOf), ...(s.icon ? { icon: s.icon } : {}),
    }));
    sessions.delete(s.key);
    toast(`${days.length} variations added`);
    location.replace(`#/routine/${made[0].id}?${stay}`);
  }

  // A new routine has to exist before the player can open it
  function saveDraftRoutine() {
    if (!s.name.trim()) { s.name = autoName(s); title.value = s.name; }
    if (!s.name.trim()) { toast('Give the routine a name'); title.focus(); return null; }
    const r2 = R.routines.save(null, { name: s.name.trim(), items: s.items.filter(it => it.name.trim()).map(templateOf), schedule: s.schedule, ...(s.icon ? { icon: s.icon } : {}) });
    sessions.delete(s.key);
    s.id = r2.id;
    s.key = `${r2.id}|${date}`;
    sessions.set(s.key, s);
    return r2;
  }

  if (!r) setTimeout(() => title.focus(), 50);
  const picker = emojiPicker(s);
  // A routine from the library links back to its page: what it's for and the research behind it
  const lib = r?.libraryId ? libraryRoutine(r.libraryId) : null;
  const info = lib ? h('a', { class: 'icon-btn glass info-btn', href: `#/routines/browse/${lib.id}`, 'aria-label': `About ${lib.name}`, title: 'About this routine' }) : null;
  if (info) info.innerHTML = INFO;
  // Progress: once there are two sessions, a chart button swaps the moves for how each has changed
  const past = r ? R.routines.history(r.id) : [];
  const body = h('div', { class: 'routine-body' });
  const progress = h('div', { class: 'routine-progress', hidden: true });
  const chartBtn = past.length >= 2 ? h('button', {
    type: 'button', class: 'icon-btn glass chart-btn', 'aria-pressed': 'false', 'aria-label': 'Show progress', title: 'Progress',
    onclick: () => {
      const on = progress.hidden;
      if (on) progress.replaceChildren(progressView(s, past));
      progress.hidden = !on; body.hidden = on;
      chartBtn.classList.toggle('on', on);
      chartBtn.setAttribute('aria-pressed', String(on));
      chartBtn.setAttribute('aria-label', on ? 'Back to the routine' : 'Show progress');
      vibrate(4);
    },
  }) : null;
  if (chartBtn) chartBtn.innerHTML = CHART;
  return h('div', { class: 'view routine-page' },
    h('header', { class: 'top-bar' },
      iconButton('‹', 'Back', () => history.back()),
      date === localDate() ? h('span') : h('span', { class: 'eyebrow' }, dayLabel(date)),
      h('div', { class: 'row tight' }, chartBtn, info, importBtn, play, done)),
    h('div', { class: 'title-row' }, picker.btn, title),
    picker.row,
    variationTabs(),
    progress,
    fillBody());

  // The routine itself: moves, how it went, the timer, reminders
  function fillBody() {
    body.append(
    list,
    add,
    stopwatch(s, paint, ctx),
    field,
    h('div', { class: 'field' }, h('span', { class: 'field-label' }, 'Reminders'), times),
    ...[r ? h('button', {
      type: 'button', class: 'link-danger', onclick: async () => {
        if (await confirmSheet(`Delete ${R.routineLabel(r)}?`, 'Past sessions stay in your history.', 'Delete', { danger: true })) {
          sessions.delete(s.key);
          R.routines.archive(r.id);
          // Deleting a variation goes to the next one left in the group
          const left = r.group ? R.routines.group(r) : [];
          location.hash = left.length ? `#/routine/${left[0].id}?${stay}` : '#/routines';
        }
      },
    }, r.group ? 'Delete this variation' : 'Delete routine') : null].filter(Boolean));
    return body;
  }
}

/**
 * Import: paste a routine (from Notes, Messages, an email, a web page) or open a file (a document, a
 * spreadsheet, a PDF, an export from another workout app). What it reads shows as it's read, so it can be
 * checked before it's added.
 */
function importSheet(s, onImport) {
  let found = null;
  sheet(close => {
    const text = h('textarea', { class: 'notes glass import-text', rows: 6, placeholder: 'Paste it here', 'aria-label': 'Routine to import', oninput: () => show(readRoutine(text.value)) });
    const preview = h('div', { class: 'import-preview', 'aria-live': 'polite' });
    const add = h('button', { type: 'button', class: 'btn primary', disabled: true, onclick: () => { if (found) { close(); onImport(found); } } }, 'Add');
    const file = h('input', {
      type: 'file', hidden: true, accept: '.txt,.text,.md,.csv,.tsv,.json,.html,.htm,.rtf,.eml,.docx,.xlsx,.pdf,text/*,application/pdf,application/json',
      onchange: async () => {
        const f = file.files[0];
        file.value = '';
        if (!f) return;
        try {
          const t = await readRoutineFile(f);
          const read = t && readRoutine(t, { fileName: f.name });
          if (!read) return toast(/\.pdf$/i.test(f.name) ? 'Couldn’t read this PDF. Copy its text and paste it instead.' : 'No moves found in that file');
          text.value = t.trim();
          show(read);
        } catch { toast('Couldn’t open that file'); }
      },
    });
    const paste = h('button', {
      type: 'button', class: 'chip glass', onclick: async () => {
        try {
          const t = await navigator.clipboard.readText();
          if (t?.trim()) { text.value = t; show(readRoutine(t)); return; }
        } catch { /* not allowed: paste by hand */ }
        text.focus();
      },
    }, 'Paste');
    const open = h('button', { type: 'button', class: 'chip glass', onclick: () => file.click() }, 'Open a file');

    function show(read) {
      found = read;
      add.disabled = !read;
      // Once something's read, the text steps back to a few lines and what was found takes the room
      text.classList.toggle('read', !!read);
      if (!read) { preview.replaceChildren(text.value.trim() ? h('p', { class: 'hint' }, 'No moves found yet') : ''); add.textContent = 'Add'; return; }
      const moves = read.days.reduce((n, d) => n + d.items.length, 0);
      add.textContent = read.days.length > 1 ? `Add ${read.days.length} variations` : `Add ${moves} move${moves === 1 ? '' : 's'}`;
      // Named as it will be: its own title, else from what's in it; days the same way
      const name = s.group ?? s.name;
      const title = name?.trim() || read.title || (read.days.length > 1 ? nameForSplit(read.days) : nameForMoves(read.days[0].items));
      const days = nameDays(read.days);
      preview.replaceChildren(
        title ? h('p', { class: 'import-title' }, title) : '',
        ...read.days.map((d, i) => h('div', { class: 'import-day' },
          read.days.length > 1 ? h('h3', { class: 'section-label' }, days[i]) : '',
          h('ul', { class: 'import-moves' }, d.items.map(it => h('li', {},
            h('span', { class: 'import-name' }, it.name),
            h('span', { class: 'import-dose' }, [it.dose, it.extra].filter(Boolean).join(' · ')))))))
      );
    }
    setTimeout(() => text.focus(), 300);
    return h('div', { class: 'stack import-sheet' },
      h('h2', {}, 'Import a routine'),
      h('div', { class: 'row tight' }, paste, open, file),
      text, preview,
      // Always in reach, however long the list
      h('div', { class: 'row end import-actions' }, h('button', { type: 'button', class: 'btn ghost', onclick: close }, 'Cancel'), add));
  }, { full: true });
}

/**
 * See form sits exactly halfway between the progress bar and the highest point the figure reaches as it
 * moves (a figure lying on a bench sits low in its box; one hanging from a bar reaches the top).
 */
function centreForm(name, figure, video, bar, tries = 20) {
  // The first move is drawn before the player is on screen: wait for it
  if (!figure.isConnected) { if (tries) setTimeout(() => centreForm(name, figure, video, bar, tries - 1), 30); return; }
  const units = figureTop(name);
  if (units == null) return;
  // From the layout, not the screen, so the slide-in as the move arrives doesn't throw it off
  const top = el => { let y = 0; for (let e = el; e; e = e.offsetParent) y += e.offsetTop; return y; };
  const art = figure.closest('.move-art'), room = video.parentElement;
  const box = figure.getBoundingClientRect(), artBox = art.getBoundingClientRect();
  const scale = Math.min(box.width / 200, box.height / 140);
  const figureTopPx = top(art) + (box.top - artBox.top) + (box.height - 140 * scale) / 2 + units * scale;
  const want = (top(bar) + bar.offsetHeight + figureTopPx) / 2;
  video.style.transform = `translateY(${Math.round(want - (top(room) + room.offsetHeight / 2))}px)`;
}

const SCRUB_STEP = 14; // px of finger travel per step

/**
 * Swipe up or down on a log box to change its number; a plain tap still opens the keyboard to type.
 * An empty box starts from seed() (last time's value, or the target).
 */
// Boxes are as wide as their text (or placeholder), within limits, measured in the box's own font
const measure = document.createElement('canvas').getContext('2d');
function fitWidth(input) {
  if (!input.isConnected) return;
  const cs = getComputedStyle(input);
  measure.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
  const text = input.value || input.placeholder || '';
  const pad = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight) + 2;
  const w = Math.min(190, Math.max(48, Math.ceil(measure.measureText(text).width + pad)));
  input.style.width = `${w}px`;
  // The boxes use even-width digits, which the measuring doesn't: widen by whatever still doesn't fit
  const over = input.scrollWidth - input.clientWidth;
  if (over > 0) input.style.width = `${Math.min(190, w + over + 2)}px`;
}

function scrubNumber(input, seed, onChange = () => {}) {
  let start = null;
  input.addEventListener('pointerdown', e => {
    if (e.button > 0 || document.activeElement === input) return; // already typing: leave it alone
    e.preventDefault(); // no keyboard yet: this might be a swipe
    try { input.setPointerCapture(e.pointerId); } catch { /* pointer already gone */ }
    start = { y: e.clientY, x: e.clientX, steps: 0, text: input.value || seed(), moved: false };
  });
  input.addEventListener('pointermove', e => {
    if (!start) return;
    const dy = start.y - e.clientY;
    if (!start.moved && Math.abs(dy) < 6) return;
    start.moved = true;
    input.classList.add('scrubbing');
    const steps = Math.trunc(dy / SCRUB_STEP);
    if (steps === start.steps) return;
    start.steps = steps;
    input.value = bumpLastNumber(start.text, steps);
    input.dispatchEvent(new Event('input'));
    vibrate(3);
  });
  const end = () => {
    if (!start) return;
    const tapped = !start.moved;
    start = null;
    input.classList.remove('scrubbing');
    if (tapped) { input.focus(); input.setSelectionRange(input.value.length, input.value.length); }
  };
  input.addEventListener('pointerup', end);
  input.addEventListener('pointercancel', end);
}

/** One move at a time, with its animation. − and + adjust what you did, shared with the routine page. */
export function RoutineRunView(ctx) {
  const r = R.routines.get(ctx.args[0]);
  if (!r) return h('div', { class: 'view' }, h('p', {}, 'Routine not found.'));
  const date = ctx.params.get('date') || localDate();
  const fromCheckin = ctx.params.get('from') === 'checkin';
  const s = sessionFor(r, date, fromCheckin);
  const moves = s.items.filter(it => it.name.trim());
  let i = startIndex(moves), dir = 0;
  const clocks = new Map(); // a running or paused timer per move, so stepping away and back keeps it
  let tick = 0;
  ctx.onCleanup(() => clearInterval(tick));
  // Leaving with a timer still running stops it there, and its time is kept like any other
  ctx.onCleanup(() => clocks.forEach((c, it) => { if (c.start) keepTime(s, it.name, fmtClock(Date.now() - c.start)); }));
  // The screen stays on while you follow along, so the phone doesn't lock mid-move
  ctx.onCleanup(keepAwake());
  const root = h('div', { class: 'flow' });
  const back = () => { location.replace(`#/routine/${r.id}?date=${date}${fromCheckin ? '&from=checkin' : ''}`); };
  const go = to => { if (to < 0 || to >= moves.length || to === i) return; dir = Math.sign(to - i); i = to; vibrate(4); render(); };

  // A swipe sideways on the move steps through the routine, like turning a page
  let swipe = null;
  root.addEventListener('pointerdown', e => { if (!e.target.closest('input, button, a')) swipe = { x: e.clientX, y: e.clientY }; });
  root.addEventListener('pointerup', e => {
    if (!swipe) return;
    const dx = e.clientX - swipe.x, dy = e.clientY - swipe.y;
    swipe = null;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) go(i + (dx < 0 ? 1 : -1));
  });

  /** A small timer for holds: tap to start, tap to stop, and the time goes in the move's box. */
  function timer(it, amount) {
    const c = clocks.get(it) ?? { start: null };
    clocks.set(it, c);
    const el = h('div', { class: 'stopwatch run-timer' });
    const ms = () => (c.start ? Date.now() - c.start : 0);
    const paint = () => {
      clearInterval(tick);
      let b;
      if (c.start) {
        b = h('button', { type: 'button', class: 'sw-pill glass running', 'aria-label': 'Stop the timer', onclick: () => {
          keepTime(s, it.name, fmtClock(ms())); amount.value = it.did; c.start = null; vibrate(8); paint();
        } }, h('span', { class: 'sw-dot', 'aria-hidden': 'true' }), h('span', { class: 'sw-time' }, fmtClock(ms())));
        tick = setInterval(() => { const t = el.querySelector('.sw-time'); if (t) t.textContent = fmtClock(ms()); }, 250);
      } else {
        b = h('button', { type: 'button', class: 'sw-pill glass idle', 'aria-label': 'Time this move', onclick: () => { c.start = Date.now(); vibrate(6); paint(); } },
          h('span', { class: 'sw-icon' }), h('span', {}, 'Time it'));
        b.querySelector('.sw-icon').innerHTML = CLOCK;
      }
      el.replaceChildren(b);
    };
    paint();
    return el;
  }

  function render() {
    clearInterval(tick);
    const it = moves[i];
    const last = i === moves.length - 1;
    // The same box as the routine page: swipe up or down to change it, or tap to type
    const amount = h('input', {
      type: 'text', class: 'did-input did-big', value: it.did || it.dose || '', placeholder: 'Reps', enterkeyhint: 'done',
      'aria-label': `What you did: ${it.name}`,
      oninput: e => { it.did = e.target.value; },
      onkeydown: e => { if (e.key === 'Enter') e.target.blur(); },
    });
    scrubNumber(amount, () => it.dose || '0');
    // The second box (a hold, a weight) when the move has one, beside the first
    const extra = it.extra || it.extraDose ? h('input', {
      type: 'text', class: 'did-input did-big extra-input', value: it.extra || it.extraDose || '', enterkeyhint: 'done',
      'aria-label': `Second box for ${it.name}`,
      oninput: e => { it.extra = e.target.value; },
      onkeydown: e => { if (e.key === 'Enter') e.target.blur(); },
    }) : null;
    if (extra) scrubNumber(extra, () => it.extraDose || '0');
    // Its figure (or, for breathing and meditation, a calm guide), with a way to watch it above
    const calm = calmFor(it.name);
    const video = h('a', { class: 'glass form-video', href: formVideoUrl(it.name), target: '_blank', rel: 'noopener', 'aria-label': calm ? `Guided ${it.name} videos` : `See form videos for ${it.name}` },
      h('span', { class: 'fv-icon', 'aria-hidden': 'true' }), h('span', {}, calm ? 'Guided' : 'See form'));
    video.firstChild.innerHTML = WATCH;
    // With no figure for the move, the circle itself is the way to see how it's done
    const figure = MoveFigure(it.name);
    let art;
    if (figure) art = h('div', { class: 'move-art' }, figure);
    else {
      const orb = h('a', { class: 'move-orb orb-form', href: formVideoUrl(it.name), target: '_blank', rel: 'noopener', 'aria-label': `See form videos for ${it.name}` },
        h('span', { class: 'fv-icon', 'aria-hidden': 'true' }), h('span', { class: 'orb-label' }, 'See form'));
      orb.firstChild.innerHTML = WATCH;
      art = h('div', { class: 'move-art' }, orb);
    }
    // A line on how to do it, for the calm activities that come with one
    const how = r.items.find(x => x.name === it.name)?.how;
    // Story-style progress: done, this one, still to come; tap one to go to it
    const bar = h('div', { class: 'progress run-progress', role: 'tablist', 'aria-label': 'Moves' }, moves.map((m, k) => h('button', {
      type: 'button', class: k < i ? 'done' : k === i ? 'now' : '', role: 'tab', 'aria-selected': String(k === i), 'aria-label': `${k + 1}. ${m.name}`, onclick: () => go(k),
    })));
    // See form sits centred in the space above the figure, with the same space below the move, so the
    // move stays in the middle of the screen
    const stage = h('div', { class: `flow-body move-stage${dir ? ` enter-${dir > 0 ? 'next' : 'prev'}` : ''}` },
      h('div', { class: 'stage-room' }, figure ? video : null),
      art, h('h1', { tabindex: -1 }, it.name), how ? h('p', { class: 'run-how' }, how) : null,
      extra ? h('div', { class: 'did-pair' }, amount, extra) : amount, isTimed(it.name, it.dose, it.did) ? timer(it, amount) : null,
      h('div', { class: 'stage-room', 'aria-hidden': 'true' }));
    root.replaceChildren(
      h('header', { class: 'flow-head' }, iconButton('✕', 'Back to the routine', back), h('span', { class: 'eyebrow' }, R.routineLabel(r)), h('span', { class: 'timer' }, `${i + 1}/${moves.length}`)),
      bar, stage,
      h('div', { class: 'flow-footer' },
        i > 0 ? iconButton('‹', 'Previous move', () => go(i - 1)) : h('span'),
        h('button', {
          type: 'button', class: 'btn primary wide', onclick: () => {
            it.done = true;
            if (last) saveSession(s, { fromCheckin }); else go(i + 1);
          },
        }, last ? 'Finish' : 'Next')));
    root.querySelector('h1').focus({ preventScroll: true });
    if (figure && !calm) centreForm(it.name, figure, video, bar);
  }
  render();
  return root;
}
