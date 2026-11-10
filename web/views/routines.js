// Routines: your list, one page per routine (edit it and log a day's session in the same place),
// and a one-move-at-a-time player that shares the session in progress.
import { h, s as svg, toast, iconButton, confirmSheet, vibrate } from '../lib/ui.js';
import { progressRows, moveText } from '../lib/progress.js';
import { smoothPath } from './chart.js';
import * as R from '../lib/repos.js';
import { localDate, dayLabel, parseDate } from '../lib/dates.js';
import { bumpLastNumber, parseReminder, formatReminder } from '../lib/labels.js';
import { checkinDraft } from './checkin.js';
import { MoveFigure } from './figure.js';
import { dragHandles } from './sortable.js';

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
  // Hold a card, then drag, to move it; the first one is the routine on Home
  dragHandles(cards, {
    hold: true, skip: '.done-toggle',
    onReorder: rows => R.routines.reorder(rows.flatMap(r => r.dataset.ids.split(','))),
  });
  return h('div', { class: 'view' },
    h('header', { class: 'top-bar' }, h('h1', {}, 'Routines')),
    R.routines.all().length ? null : h('p', { class: 'muted' }, 'Keep your gym, stretching or calisthenics routines here. Tick one off in your check-in, or open it to log your sets.'),
    cards,
    h('a', { class: 'add-card', href: '#/routine/new' }, '+ New routine'));
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
    h('ol', { class: 'moves' }, r.items.map(it => h('li', {}, h('span', {}, it.name), h('span', { class: 'hint' }, it.dose)))));
}

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
        R.routines.logSession(r.id, today, { log: r.items.map(it => ({ name: it.name, did: it.dose || '✓' })) });
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
    key, id: r?.id ?? null, date, name: r?.name ?? '', group: r?.group ?? null, schedule: [...(r?.schedule ?? [])],
    items: (r?.items ?? []).map(it => {
      const now = didNow.get(it.name);
      return { name: it.name, dose: it.dose, did: now || before.get(it.name) || it.dose || '', done: !!now, extra: extraNow.get(it.name) ?? extraBefore.get(it.name) ?? it.extra ?? '' };
    }),
    intensity: draft?.intensity.get(r.linkedFactorId) ?? logged?.intensity ?? 2,
    measure: r?.measure ?? defaultMeasure(`${r?.group ?? ''} ${r?.name ?? ''}`),
    times: logged?.times ?? 1,
    // Timed with the stopwatch on this day, beyond the routine's own moves (today's log only)
    timed: (logged?.log ?? []).filter(x => x.timed && !(r?.items ?? []).some(it => it.name === x.name)).map(x => ({ name: x.name, did: x.did })),
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

/** Saves one routine (or variation) and, if any move is ticked, its session. Returns the routine, or null. */
/** markDone: Done on an existing routine's own page logs it as done today, whatever was entered. */
function saveOne(s, { markDone = false } = {}) {
  const name = s.name.trim();
  const items = s.items.filter(it => it.name.trim());
  if (s.group !== null && !s.group.trim()) { toast('Give the routine a name'); return null; }
  if (!name) { toast(s.group ? 'Give this variation a name' : 'Give the routine a name'); return null; }
  if (!items.length) { toast(s.group ? `Add a move to ${name}` : 'Add at least one move'); return null; }
  const moves = items.map(it => ({ name: it.name.trim(), dose: it.dose || it.did.trim() }));
  const existing = s.id ? R.routines.get(s.id) : null;
  const group = s.group?.trim() || null;
  if (existing?.group && group && existing.group !== group) R.routines.renameGroup(existing.group, group);
  const changed = !existing || existing.name !== name || (existing.group ?? null) !== group || (existing.measure ?? defaultMeasure(`${existing.group ?? ''} ${existing.name}`)) !== s.measure || JSON.stringify(existing.items) !== JSON.stringify(moves)
    || existing.schedule.join() !== [...new Set(s.schedule)].sort().join();
  const r = changed ? R.routines.save(s.id, { name, group, measure: s.measure, items: moves, schedule: [...new Set(s.schedule)].sort() }) : R.routines.get(s.id);
  // Done on a routine's page marks it done; a brand-new routine isn't (making it isn't doing it). Other
  // variations edited on the way only log if something was entered for them.
  const logIt = (markDone && !!s.id) || s.touched || items.some(it => it.done);
  if (logIt) {
    const log = [
      ...items.map(it => ({ name: it.name.trim(), did: it.did.trim() || '✓', ...(it.extra?.trim() ? { extra: it.extra.trim() } : {}) })),
      ...(s.timed ?? []).map(t => ({ name: t.name, did: t.did, timed: true })),
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

/** 0:07, 1:45, 1:02:10 */
export function fmtClock(ms) {
  const t = Math.floor(ms / 1000), hr = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), sec = String(t % 60).padStart(2, '0');
  return hr ? `${hr}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
}

const CLOCK = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="13.5" r="7.5"/><path d="M12 9.5v4l2.5 1.5M10 2.5h4"/></svg>';

/**
 * A small stopwatch at the foot of a routine, for timed holds like a dead hang. Tap to start, tap to
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
    const did = fmtClock(now());
    const move = s.items.find(it => it.name.trim().toLowerCase() === name.toLowerCase());
    if (move) { move.did = did; move.done = true; repaintMoves(); }
    else s.timed = [...(s.timed ?? []).filter(t => t.name !== name), { name, did }];
    s.touched = true;
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

const PLAY = '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M8 5.5v13l11-6.5-11-6.5Z"/></svg>';

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
      oninput: e => { it.name = e.target.value; },
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
      onblur: () => { if (!extra.value.trim()) { it.extra = ''; showExtra(false); } },
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
      setTimeout(() => { s.items.splice(s.items.indexOf(it), 1); row.remove(); openRow = null; }, 240);
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

  // A new routine has to exist before the player can open it
  function saveDraftRoutine() {
    if (!s.name.trim()) { toast('Give the routine a name'); title.focus(); return null; }
    const r2 = R.routines.save(null, { name: s.name.trim(), items: s.items.filter(it => it.name.trim()).map(it => ({ name: it.name.trim(), dose: it.did.trim() })), schedule: s.schedule });
    sessions.delete(s.key);
    s.id = r2.id;
    s.key = `${r2.id}|${date}`;
    sessions.set(s.key, s);
    return r2;
  }

  if (!r) setTimeout(() => title.focus(), 50);
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
      h('div', { class: 'row tight' }, chartBtn, play,
        h('button', { type: 'button', class: 'icon-btn glass done-btn', onclick: () => saveSession(s, { fromCheckin }) }, 'Done'))),
    title,
    variationTabs(),
    progress,
    fillBody());

  // The routine itself: moves, how it went, the timer, reminders
  function fillBody() {
    body.append(
    list,
    add,
    field,
    stopwatch(s, paint, ctx),
    h('div', { class: 'field' }, h('span', { class: 'field-label' }, 'Reminders'), times),
    r ? h('button', {
      type: 'button', class: 'link-danger', onclick: async () => {
        if (await confirmSheet(`Delete ${R.routineLabel(r)}?`, 'Past sessions stay in your history.', 'Delete', { danger: true })) {
          sessions.delete(s.key);
          R.routines.archive(r.id);
          // Deleting a variation goes to the next one left in the group
          const left = r.group ? R.routines.group(r) : [];
          location.hash = left.length ? `#/routine/${left[0].id}?${stay}` : '#/routines';
        }
      },
    }, r.group ? 'Delete this variation' : 'Delete routine') : null);
    return body;
  }
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
  input.style.width = `${Math.min(190, Math.max(48, Math.ceil(measure.measureText(text).width + pad)))}px`;
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
  let i = Math.max(0, moves.findIndex(it => !it.done));
  const root = h('div', { class: 'flow' });
  const back = () => { location.replace(`#/routine/${r.id}?date=${date}${fromCheckin ? '&from=checkin' : ''}`); };

  function render() {
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
    root.replaceChildren(
      h('header', { class: 'flow-head' }, iconButton('✕', 'Back to the routine', back), h('span', { class: 'eyebrow' }, R.routineLabel(r)), h('span', { class: 'timer' }, `${i + 1}/${moves.length}`)),
      h('div', { class: 'progress' }, moves.map((m, k) => h('i', { class: m.done ? 'done' : k === i ? 'now' : '' }))),
      h('div', { class: 'flow-body move-stage' },
        MoveFigure(it.name) ?? h('div', { class: 'move-orb', 'aria-hidden': 'true' }, String(i + 1)),
        h('h1', { tabindex: -1 }, it.name),
        amount),
      h('div', { class: 'flow-footer' },
        i > 0 ? iconButton('‹', 'Previous move', () => { i--; render(); }) : h('span'),
        h('button', {
          type: 'button', class: 'btn primary wide', onclick: () => {
            it.done = true;
            if (last) saveSession(s, { fromCheckin }); else { i++; render(); }
          },
        }, last ? 'Finish' : 'Next')));
    root.querySelector('h1').focus({ preventScroll: true });
  }
  render();
  return root;
}
