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
import { keepAwake, openVideo } from '../lib/native.js';
import { dragHandles } from './sortable.js';
import { libraryRoutine } from '../lib/routine-library.js';
import { emojiFor } from '../lib/labels.js';
import { readRoutine } from '../lib/routine-import.js';
import { readRoutineFile } from '../lib/routine-files.js';
import { nameForMoves, nameForSplit, nameDays, freshName } from '../lib/routine-name.js';
import { spokenMoves, matchMove, spokenNumber, splitTyped } from '../lib/voice-moves.js';
import { normName } from '../lib/move-names.js';
import { voiceSupported, startDictation } from '../lib/voice.js';

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
  const now = new Map((logged?.log ?? []).map(x => [x.name, x]));
  const before = r ? R.routines.lastEntries(r.id, date) : new Map();
  const draft = fromCheckin && r ? checkinDraft(date) : null;
  // Each box starts with what you did today if logged, else last time, else the target. A move done in
  // sets has a row for each set after the first.
  const s = {
    key, id: r?.id ?? null, date, name: r?.name ?? '', group: r?.group ?? null, schedule: [...(r?.schedule ?? [])], icon: r?.icon ?? null,
    items: (r?.items ?? []).map(it => {
      const today = now.get(it.name), last = before.get(it.name);
      const first = x => x?.sets?.[0] ?? x;
      const pick = (k, plan) => first(today)?.[k] || first(last)?.[k] || plan || '';
      const sets = today?.sets ?? last?.sets ?? (it.sets ? [{}, ...it.sets.map(x => ({ did: x.dose, extra: x.extra, label: x.label }))] : null);
      // extraDose is the routine's own second box (a hold, say), kept apart from what's typed today
      return {
        name: it.name, dose: it.dose, extraDose: it.extra, done: !!today,
        did: pick('did', it.dose), extra: first(today)?.extra ?? first(last)?.extra ?? it.extra ?? '',
        rows: (sets ?? []).slice(1).map(x => ({ did: x.did ?? x.dose ?? '', extra: x.extra ?? '', ...(x.label ? { label: x.label } : {}) })),
      };
    }),
    intensity: draft?.intensity.get(r.linkedFactorId) ?? logged?.intensity ?? 2,
    measure: r?.measure ?? defaultMeasure(`${r?.group ?? ''} ${r?.name ?? ''}`),
    times: logged?.times ?? 1,
    // Timed on this day, with the routine page's stopwatch or in the player (today's log only)
    timed: (logged?.log ?? []).filter(x => x.timed && (x.loose || !(r?.items ?? []).some(it => it.name === x.name)))
      .map(x => ({ id: R.uuid(), name: x.name === LOOSE ? '' : x.name, did: x.did })),
    timedMoves: new Set((logged?.log ?? []).filter(x => x.timed && !x.loose).map(x => x.name)),
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
      ...items.map(it => ({ name: it.name.trim(), ...logOf(it), ...(isTimedEntry(s, it) ? { timed: true } : {}) })),
      // Timings of the routine's own moves are already in their rows above
      ...looseLog(s),
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
  // Sets after the first are part of the routine too, as they were last filled in
  const sets = (it.rows ?? []).map(x => ({ dose: x.did.trim(), ...(x.extra?.trim() ? { extra: x.extra.trim() } : {}), ...(x.label?.trim() ? { label: x.label.trim() } : {}) }));
  return { name: it.name.trim(), dose: it.dose || it.did.trim(), ...(extra ? { extra } : {}), ...(sets.length ? { sets } : {}) };
};

/**
 * What a move logs for the day. In sets, each set is kept ({ did, extra }) and `did` reads them all
 * ("10, 10, 8"), so the history and charts still have one line per move.
 */
function logOf(it) {
  const one = { did: it.did.trim() || '✓', ...(it.extra?.trim() ? { extra: it.extra.trim() } : {}) };
  if (!it.rows?.length) return one;
  const sets = [{ did: it.did.trim(), extra: it.extra?.trim() ?? '' }, ...it.rows.map(x => ({ did: x.did.trim(), extra: x.extra?.trim() ?? '', label: x.label?.trim() ?? '' }))];
  return { ...one, did: sets.map(x => x.did || '✓').join(', '), sets: sets.map(x => ({ did: x.did || '✓', ...(x.extra ? { extra: x.extra } : {}), ...(x.label ? { label: x.label } : {}) })) };
}

/** Whether a move's time came from a timer, so it's listed under the routine page's stopwatch. */
const isTimedEntry = (s, it) => s.timedMoves?.has(it.name.trim());

// A recording with no name yet is kept under this name, and shown blank
const LOOSE = 'Timed';
/** Today's recordings that aren't (yet) a move's, as they're logged. */
const looseLog = s => (s.timed ?? []).filter(t => t.did?.trim()).map(t => ({ name: t.name.trim() || LOOSE, did: t.did.trim(), timed: true, loose: true }));

/**
 * Saves the day's recordings straight away, so a time is kept the moment it's taken, edited or moved.
 * moved: a move a recording was just dropped onto, saved with it.
 */
function saveRecordings(s, moved = null) {
  s.touched = true;
  if (!s.id) return;
  const before = R.routines.sessionOn(s.id, s.date)?.log ?? [];
  const isMove = name => s.items.some(it => it.name.trim() === name);
  const log = [
    ...before.filter(x => !(x.timed && (x.loose || !isMove(x.name))) && x.name !== moved?.name.trim()),
    ...(moved ? [{ name: moved.name.trim(), ...logOf(moved) }] : []),
    ...looseLog(s),
  ];
  const live = checkinDraft(s.date);
  R.routines.logSession(s.id, s.date, s.measure === 'count' ? { log, times: s.times } : { log, intensity: s.intensity }, { writeLog: !live });
}

/**
 * A timed hold, from the player or the routine page's timer: a move's box takes the time, it's listed with
 * the routine page's timings, and it's saved to the day's session straight away, so it's kept (and on the
 * progress chart) the moment the timer stops, without Finish or Done.
 */
function keepTime(s, name, did) {
  const it = s.items.find(x => x.name.trim().toLowerCase() === name.trim().toLowerCase());
  name = it ? it.name.trim() : name.trim();
  if (it) { it.did = did; it.done = true; (s.timedMoves ??= new Set()).add(name); }
  else s.timed = [...(s.timed ?? []).filter(t => t.name !== name), { id: R.uuid(), name, did }];
  s.touched = true;
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
 * A small stopwatch under the moves, on the right, for timing anything. Tap to start, tap to stop: the time
 * is kept straight away as a row like a move's, with an optional name, both editable. Hold a row and drag
 * it onto a move to make it that move's (its box if empty, else another set, named by the row's name).
 * Swipe a row left to delete it. The clock lives in the session, so it keeps running while you switch
 * variations or open the player.
 */
function stopwatch(s, ctx, { moveAt, onDrop }) {
  s.clock ??= { start: null, held: 0 };
  const c = s.clock;
  const el = h('div', { class: 'stopwatch' });
  const list = h('div', { class: 'log-list sw-list' });
  const now = () => c.held + (c.start ? Date.now() - c.start : 0);
  let tick = 0;
  const run = () => { clearInterval(tick); if (c.start) tick = setInterval(() => { const t = el.querySelector('.sw-time'); if (t) t.textContent = fmtClock(now()); }, 250); };
  ctx.onCleanup(() => clearInterval(tick));

  const stop = () => {
    const t = { id: R.uuid(), name: '', did: fmtClock(now()) };
    s.timed = [...(s.timed ?? []), t];
    Object.assign(c, { start: null, held: 0 });
    saveRecordings(s);
    vibrate(8);
    paint(t);
  };

  function paint(fresh = null) {
    let pill;
    if (c.start) {
      pill = h('button', { type: 'button', class: 'sw-pill glass running', 'aria-label': 'Stop the timer', onclick: stop },
        h('span', { class: 'sw-dot', 'aria-hidden': 'true' }), h('span', { class: 'sw-time' }, fmtClock(now())));
    } else {
      pill = h('button', { type: 'button', class: 'sw-pill glass idle', 'aria-label': 'Start a timer', onclick: () => { c.start = Date.now(); vibrate(6); paint(); } },
        h('span', { class: 'sw-icon' }), h('span', {}, 'Timer'));
      pill.querySelector('.sw-icon').innerHTML = CLOCK;
    }
    list.replaceChildren(...(s.timed ?? []).map(t => recording(t, t === fresh)));
    el.replaceChildren(pill, list);
    run();
  }

  /** One recording: its name and its time, both editable, like a move's row */
  function recording(t, fresh) {
    const name = h('input', {
      type: 'text', class: 'log-name', value: t.name, placeholder: 'What was it?', maxlength: 40, 'aria-label': 'What you timed', enterkeyhint: 'done',
      oninput: e => { t.name = e.target.value; }, onchange: () => saveRecordings(s),
      onkeydown: e => { if (e.key === 'Enter') e.target.blur(); },
    });
    const time = h('input', {
      type: 'text', class: 'did-input', value: t.did, inputmode: 'text', enterkeyhint: 'done', 'aria-label': `Time for ${t.name || 'this'}`,
      oninput: e => { t.did = e.target.value; fitWidth(time); }, onchange: () => saveRecordings(s),
      onkeydown: e => { if (e.key === 'Enter') e.target.blur(); },
    });
    requestAnimationFrame(() => fitWidth(time));
    // Touching a box doesn't open the keyboard straight away, so a hold can still pick the row up
    for (const box of [name, time]) {
      box.addEventListener('pointerdown', e => { if (document.activeElement !== box) e.preventDefault(); });
      box.addEventListener('click', () => { if (performance.now() > swallowUntil && document.activeElement !== box) box.focus(); });
    }
    const inner = h('div', { class: 'log-inner' }, h('div', { class: 'log-line' }, name, time));
    const row = h('div', { class: `log-row sw-row${fresh ? ' fresh' : ''}` },
      h('button', { type: 'button', class: 'log-del', 'aria-label': `Delete ${t.name || 'this time'}`, onclick: () => remove() }, 'Delete'), inner);
    function remove() {
      row.style.height = `${row.offsetHeight}px`;
      row.classList.add('removing');
      requestAnimationFrame(() => { row.style.height = '0px'; });
      setTimeout(() => { s.timed = s.timed.filter(x => x !== t); saveRecordings(s); row.remove(); }, 240);
      vibrate(8);
    }
    let swallowUntil = 0;
    gestures(row, inner, {
      onDelete: remove,
      drag: { moveAt, onDrop: target => { s.timed = s.timed.filter(x => x !== t); onDrop(t, target); paint(); }, label: () => t.name || t.did },
      swallow: ms => { swallowUntil = performance.now() + ms; },
    });
    return row;
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
// A move's boxes and sets: reps plus up to four more boxes, and up to ten sets
const MAX_BOXES = 5, MAX_SETS = 10, SEP = ' · ';
const MIC = '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/></svg>';
const REPEAT = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17 2l4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="M7 22l-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/></svg>';
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
    // Boxes: reps, then up to four more (weight, a hold, a note…), in the same columns on every set. A
    // move done in sets has a line for each set after the first, under its name. Too many boxes to fit
    // scroll sideways, all of a move's lines together.
    const cells = x => (x.extra ? x.extra.split(SEP) : []);
    const store = (x, arr) => { const a = [...arr]; while (a.length && !a.at(-1)?.trim()) a.pop(); x.extra = a.join(SEP); };
    const lines = () => [it, ...(it.rows ??= [])];
    let cols = Math.max(0, ...lines().map(x => cells(x).length));
    const scrollers = [];
    let syncing = false;
    const fitAll = () => requestAnimationFrame(() => {
      const byCol = new Map();
      for (const sc of scrollers) [...sc.children].forEach((el, k) => { fitWidth(el); byCol.set(k, [...(byCol.get(k) ?? []), el]); });
      // Each column as wide as its widest box, so sets line up
      for (const els of byCol.values()) { const w = Math.max(...els.map(el => parseFloat(el.style.width) || 0)); for (const el of els) el.style.width = `${w}px`; }
      scrollers.forEach(edges);
    });
    const edges = sc => {
      sc.classList.toggle('more-left', sc.scrollLeft > 2);
      sc.classList.toggle('more-right', sc.scrollLeft + sc.clientWidth < sc.scrollWidth - 2);
    };
    const onScroll = e => {
      edges(e.target);
      if (syncing) return;
      syncing = true;
      for (const sc of scrollers) if (sc !== e.target) { sc.scrollLeft = e.target.scrollLeft; edges(sc); }
      syncing = false;
    };
    const focusNext = from => {
      const all = [...row.querySelectorAll('.log-fields .did-input:not(.extra-input)')];
      const next = all[all.indexOf(from) + 1] ?? row.nextElementSibling?.querySelector('.did-input');
      next ? next.focus() : from.blur();
    };
    function fields(x, i) {
      const did = h('input', {
        type: 'text', class: 'did-input', value: x.did ?? '', inputmode: 'text', enterkeyhint: 'next', placeholder: 'Reps',
        'aria-label': i ? `Set ${i + 1} of ${it.name}` : `Reps: ${it.name}`,
        oninput: e => { x.did = e.target.value; s.touched = true; fitAll(); },
        onkeydown: e => { if (e.key === 'Enter') { e.preventDefault(); focusNext(did); } },
      });
      scrubNumber(did, () => it.dose || '0', () => { s.touched = true; fitAll(); });
      const extras = Array.from({ length: cols }, (_, k) => h('input', {
        type: 'text', class: 'did-input extra-input', value: cells(x)[k] ?? '', placeholder: '…', enterkeyhint: 'done',
        'aria-label': `Box ${k + 2} for ${it.name}${i ? `, set ${i + 1}` : ''}, like weight or a note`,
        oninput: e => { const a = cells(x); while (a.length <= k) a.push(''); a[k] = e.target.value; store(x, a); s.touched = true; fitAll(); },
        onkeydown: e => { if (e.key === 'Enter') { e.preventDefault(); e.target.blur(); } },
        onblur: () => setTimeout(() => dropEmpty(k), 0),
      }));
      const sc = h('div', { class: 'log-fields', onscroll: onScroll }, did, ...extras);
      scrollers.push(sc);
      return sc;
    }
    // A box emptied on every set (and not being typed in) goes; the routine keeps the boxes that are left
    function dropEmpty(k) {
      if (k >= cols || lines().some(x => cells(x)[k]?.trim()) || row.contains(document.activeElement) && document.activeElement.classList.contains('extra-input')) return;
      for (const x of lines()) { const a = cells(x); a.splice(k, 1); store(x, a); }
      cols--;
      it.extraDose = undefined;
      paintMove();
    }

    const repeatBtn = h('button', {
      type: 'button', class: 'extra-add sets-add', 'aria-label': `Add a set of ${it.name || 'this move'}`, title: 'Add a set',
      onclick: () => {
        // "3 × 8" becomes three sets of 8. After that a new set starts as a copy of the last, so it's
        // one tap for the same again
        const split = !it.rows.length && /^\s*(\d+)\s*[×x*]\s*(.+)$/i.exec(it.did ?? '');
        if (split && Number(split[1]) > 1 && Number(split[1]) <= MAX_SETS) {
          it.did = it.dose = split[2].trim();
          for (let k = 1; k < Number(split[1]); k++) it.rows.push({ did: it.did, extra: it.extra ?? '' });
        } else {
          const last = lines().at(-1);
          it.rows.push({ did: last.did ?? '', extra: last.extra ?? '' });
        }
        s.touched = true;
        vibrate(6);
        paintMove();
      },
    });
    repeatBtn.innerHTML = REPEAT;
    const plus = h('button', {
      type: 'button', class: 'extra-add', 'aria-label': `Add another box for ${it.name || 'this move'}`, title: 'Add a box',
      onclick: () => { cols++; it.extraDose = undefined; paintMove(); main.querySelectorAll('.extra-input')[cols - 1]?.focus(); },
    }, '+');
    const main = h('div', { class: 'log-line' });
    function setLabel(x, j) {
      const auto = () => `${it.name.trim() || 'Set'} (${j + 2})`;
      const input = h('input', {
        type: 'text', class: `log-gap set-label${x.label?.trim() ? '' : ' auto'}`, value: x.label?.trim() || auto(), 'data-n': j + 2, 'aria-label': `Name of set ${j + 2}`, maxlength: 40,
        oninput: e => {
          const v = e.target.value.trim();
          // Back to the usual name, or cleared: it follows the move again
          x.label = v && v !== auto() ? e.target.value : undefined;
          input.classList.toggle('auto', !x.label);
          s.touched = true;
        },
        onblur: e => { if (!e.target.value.trim()) e.target.value = auto(); },
        onkeydown: e => { if (e.key === 'Enter') e.target.blur(); },
      });
      return input;
    }
    const setLines = h('div', { class: 'log-sets' });
    // Renaming the move renames the sets still on their usual names
    name.addEventListener('input', () => setLines.querySelectorAll('.set-label.auto').forEach(el => { el.value = `${it.name.trim() || 'Set'} (${el.dataset.n})`; }));
    function paintMove() {
      scrollers.length = 0;
      plus.hidden = cols >= MAX_BOXES - 1;
      repeatBtn.hidden = it.rows.length >= MAX_SETS - 1;
      main.replaceChildren(name, h('span', { class: 'log-tools' }, repeatBtn, plus), fields(it, 0));
      setLines.replaceChildren(...it.rows.map((x, j) => h('div', { class: 'log-line log-set' },
        // Each set is named, lighter than the move: "Push-ups (2)", "(3)" and so on until it's renamed (a
        // different variation that time, or a recording dropped in from the timer)
        setLabel(x, j),
        h('span', { class: 'log-tools' },
          h('button', {
            type: 'button', class: 'extra-add set-remove', 'aria-label': `Remove set ${j + 2} of ${it.name}`, title: 'Remove this set',
            onclick: () => { it.rows.splice(j, 1); s.touched = true; vibrate(6); paintMove(); },
          }, '−'),
          h('span', { class: 'extra-add ghost', 'aria-hidden': 'true' })),
        fields(x, j + 1))));
      fitAll();
    }
    paintMove();

    const inner = h('div', { class: 'log-inner' }, main, setLines);
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
      if (e.target.closest('.did-input, .extra-add, .log-fields') || e.button > 0) return;
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
  // A recording from the timer, carried over a move
  const moveAt = (x, y) => {
    const el = document.elementFromPoint(x, y)?.closest('.log-row');
    return el && list.contains(el) && rowItem.get(el)?.name.trim() ? { el, it: rowItem.get(el) } : null;
  };
  // Dropped on a move: its box if nothing's in it yet today, else another set, named by the recording
  function dropRecording(t, { it }) {
    const fresh = !it.done && !it.rows?.length && (!it.did.trim() || it.did === it.dose);
    if (fresh) it.did = t.did;
    else (it.rows ??= []).push({ did: t.did, extra: '', ...(t.name.trim() && t.name.trim().toLowerCase() !== it.name.trim().toLowerCase() ? { label: t.name.trim() } : {}) });
    it.done = true;
    (s.timedMoves ??= new Set()).add(it.name.trim());
    saveRecordings(s, it);
    paint();
  }
  paint();
  // Hold a row (its name or the space around it, not the box) to lift it, then drag
  dragHandles(list, {
    hold: true, skip: '.did-input, .extra-add, .log-fields, .log-name:focus, .log-del', onLift: closeOpen,
    onReorder: rows => { s.items.splice(0, s.items.length, ...rows.map(x => rowItem.get(x))); },
  });
  const closeOnTapAway = e => { if (openRow && !openRow.contains(e.target)) closeOpen(); };
  document.addEventListener('pointerdown', closeOnTapAway, { capture: true });
  ctx.onCleanup(() => document.removeEventListener('pointerdown', closeOnTapAway, { capture: true }));

  // Adding a move: its name, then how many; Enter goes from one to the other, then adds it
  const addName = h('input', {
    type: 'text', class: 'log-add-input', placeholder: '+ Add a move', 'aria-label': 'New move', enterkeyhint: 'next',
    onkeydown: e => { if (e.key === 'Enter') { e.preventDefault(); splitName(); addReps.focus(); } },
  });
  const addReps = h('input', {
    type: 'text', class: 'did-input log-add-reps', placeholder: '', 'aria-label': 'Reps, weight or time for the new move', enterkeyhint: 'done',
    onkeydown: e => { if (e.key === 'Enter') { e.preventDefault(); commitAdd(); addName.focus(); } },
  });
  // Say moves as you do them ("20 Bulgarian split squats", "10 more push ups"): a new one gets a row, one
  // already here gets its box filled, or another set
  const voice = voiceSupported ? micButton({ label: 'Say what you did', onSaid: heard, onListen: on => { addName.placeholder = on ? 'Listening…' : '+ Add a move'; } }) : null;
  const add = h('div', { class: 'log-add-row' }, addName, voice, addReps);
  function heard(text) {
    const said = spokenMoves(text);
    if (!said.length) return;
    const touched = [];
    for (const m of said) {
      const it = matchMove(s.items.filter(x => x.name.trim()), m.name);
      if (it) {
        const fresh = !it.done && !it.rows?.length && (!it.did.trim() || it.did === it.dose);
        if (fresh || !it.did.trim()) { it.did = m.did || it.did; if (m.extra) it.extra = m.extra; }
        // Said as part of a move's name ("plank" for "Plank + side plank"): the set is named for what was said
        else {
          const part = normName(m.name).replace(/ /g, '') !== normName(it.name).replace(/ /g, '');
          (it.rows ??= []).push({ did: m.did || '✓', extra: m.extra ?? '', ...(part ? { label: m.name } : {}) });
        }
        it.done = true;
        touched.push(it);
      } else {
        // The first empty row (a new routine starts with one) takes it before a new one is added
        const blank = s.items.find(x => !x.name.trim());
        const item = blank ?? { name: '', dose: '', did: '', done: false };
        Object.assign(item, { name: m.name, dose: m.did, did: m.did, done: true, ...(m.extra ? { extra: m.extra } : {}) });
        if (!blank) s.items.push(item);
        touched.push(item);
      }
    }
    s.touched = true;
    vibrate(8);
    paint();
    paintActions();
    // What changed glows for a moment
    for (const [row, it] of rowItem) if (touched.includes(it) && row.isConnected) row.classList.add('heard');
  }
  ctx.onCleanup(() => voice?.stop());
  // Leaving the pair (not moving between its two boxes) adds what's there
  add.addEventListener('focusout', e => { if (!add.contains(e.relatedTarget)) commitAdd(); });
  // "10 push ups" typed or dictated into the name: the number goes in the box and the name keeps the move
  const splitName = () => {
    const x = !addReps.value.trim() && splitTyped(addName.value);
    if (x) { addName.value = x.name; addReps.value = x.did; }
  };
  addName.addEventListener('change', splitName);
  function commitAdd() {
    splitName();
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
    stopwatch(s, ctx, { moveAt, onDrop: dropRecording }),
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

/**
 * A small round mic. Tap to listen, tap again to stop. onSaid gets each finished phrase as it's heard
 * (with once, it stops after the first). onListen(on) tells when it starts and stops.
 */
/**
 * See form: shows it's been pressed straight away and spins until the video app takes over (or for a few
 * seconds, if it doesn't), then opens the search, in the YouTube app itself where there is one.
 */
function openForm(e) {
  e.preventDefault();
  const el = e.currentTarget;
  if (el.classList.contains('opening')) return;
  el.classList.add('opening');
  vibrate(6);
  const done = () => { el.classList.remove('opening'); document.removeEventListener('visibilitychange', back); };
  const back = () => { if (document.visibilityState === 'visible') done(); };
  document.addEventListener('visibilitychange', back);
  setTimeout(done, 4000);
  openVideo(el.href);
}

function micButton({ label, onSaid, onListen = () => {}, once = false }) {
  let stop = null;
  const b = h('button', {
    type: 'button', class: 'extra-add mic-btn', 'aria-label': label, 'aria-pressed': 'false', title: label,
    onclick: e => {
      e.preventDefault();
      if (stop) { stop(); return; }
      let used = 0;
      b.classList.add('rec'); b.setAttribute('aria-pressed', 'true');
      onListen(true);
      vibrate(6);
      stop = startDictation({
        onText: final => {
          if (final.length <= used) return;
          const phrase = final.slice(used);
          used = final.length;
          onSaid(phrase);
          if (once) stop?.();
        },
        onEnd: err => {
          stop = null;
          b.classList.remove('rec'); b.setAttribute('aria-pressed', 'false');
          onListen(false);
          if (err === 'not-allowed' || err === 'service-not-allowed') toast('Microphone access is off for Back Story');
        },
      });
    },
  });
  b.innerHTML = MIC;
  b.stop = () => stop?.();
  return b;
}

/**
 * A row's touch: swipe left to show Delete (a short swipe springs back), and, with drag, hold to pick it up
 * and carry it onto a move. The row floats under the finger; a move it's over lights up; letting go there
 * drops it in with a small settle, anywhere else it glides home.
 */
function gestures(row, inner, { onDelete, drag = null, swallow = () => {} }) {
  const HOLD = 380, SLOP = 8;
  let sw = null, hold = 0, lifted = null, target = null;
  row.slide = x => { inner.style.transform = x ? `translateX(${x}px)` : ''; row.classList.toggle('open', x < 0); };
  const end = () => { clearTimeout(hold); hold = 0; };
  inner.addEventListener('pointerdown', e => {
    if (e.button > 0 || e.target.closest('.log-del') || document.activeElement?.closest?.('.sw-row') === row && e.target === document.activeElement) return;
    sw = { x: e.clientX, y: e.clientY, base: row.classList.contains('open') ? -84 : 0, on: false, id: e.pointerId };
    if (drag) hold = setTimeout(() => { if (sw && !sw.on) lift(e); }, HOLD);
  });
  function lift(e) {
    try { inner.setPointerCapture(sw.id); } catch { /* gone */ }
    const box = row.getBoundingClientRect();
    const ghost = inner.cloneNode(true);
    ghost.classList.add('sw-ghost');
    Object.assign(ghost.style, { position: 'fixed', left: `${box.left}px`, top: `${box.top}px`, width: `${box.width}px`, margin: 0, zIndex: 50, pointerEvents: 'none' });
    document.body.append(ghost);
    lifted = { ghost, dx: sw.x - box.left, dy: sw.y - box.top, x: sw.x, y: sw.y };
    row.classList.add('carried');
    vibrate(12);
    ghost.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.04)' }], { duration: 180, easing: 'cubic-bezier(.2,.9,.25,1)', fill: 'forwards' });
  }
  const move = e => {
    if (lifted) {
      e.preventDefault();
      lifted.x = e.clientX; lifted.y = e.clientY;
      lifted.ghost.style.left = `${e.clientX - lifted.dx}px`;
      lifted.ghost.style.top = `${e.clientY - lifted.dy}px`;
      const next = drag.moveAt(e.clientX, e.clientY);
      if (next?.el !== target?.el) { target?.el.classList.remove('drop-target'); next?.el.classList.add('drop-target'); if (next) vibrate(4); }
      target = next;
      // Near the top or bottom of the screen, the page scrolls to reach moves out of view
      const edge = 80, speed = e.clientY < edge ? -(edge - e.clientY) / 5 : e.clientY > innerHeight - edge ? (e.clientY - (innerHeight - edge)) / 5 : 0;
      if (speed) scrollBy(0, speed);
      return;
    }
    if (!sw) return;
    const dx = e.clientX - sw.x, dy = e.clientY - sw.y;
    if (!sw.on) {
      if (Math.hypot(dx, dy) > SLOP) end();
      if (Math.abs(dx) < 10 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
      sw.on = true;
      row.classList.add('swiping');
    }
    row.slide(Math.max(-110, Math.min(0, sw.base + dx)));
  };
  const up = e => {
    end();
    if (lifted) {
      const { ghost } = lifted;
      swallow(400);
      if (target) {
        const to = target.el.getBoundingClientRect();
        ghost.animate([{ transform: 'scale(1.04)', opacity: 1 }, { transform: `translate(${to.left - ghost.offsetLeft}px, ${to.top + to.height / 2 - ghost.offsetTop - ghost.offsetHeight / 2}px) scale(.6)`, opacity: 0 }], { duration: 260, easing: 'cubic-bezier(.2,.9,.25,1)', fill: 'forwards' })
          .finished.then(() => ghost.remove());
        target.el.classList.remove('drop-target');
        target.el.animate([{ transform: 'scale(1.02)' }, { transform: 'none' }], { duration: 320, easing: 'cubic-bezier(.2,.9,.25,1)' });
        vibrate(10);
        const t = target;
        lifted = null; target = null; row.classList.remove('carried');
        drag.onDrop(t);
      } else {
        const home = row.getBoundingClientRect();
        ghost.animate([{ left: ghost.style.left, top: ghost.style.top }, { left: `${home.left}px`, top: `${home.top}px` }], { duration: 300, easing: 'cubic-bezier(.2,.9,.25,1)', fill: 'forwards' })
          .finished.then(() => { ghost.remove(); row.classList.remove('carried'); });
        lifted = null;
      }
      sw = null;
      return;
    }
    if (!sw) return;
    const wasSwipe = sw.on, x = sw.base + (e.clientX - sw.x);
    sw = null;
    row.classList.remove('swiping');
    if (!wasSwipe) return;
    if (x < -42) row.slide(-84); else row.slide(0);
    swallow(350);
  };
  inner.addEventListener('pointermove', move);
  inner.addEventListener('pointerup', up);
  inner.addEventListener('pointercancel', e => { if (lifted) up(e); else { end(); sw = null; row.classList.remove('swiping'); } });
  inner.addEventListener('touchmove', e => { if (lifted) e.preventDefault(); }, { passive: false });
  inner.addEventListener('contextmenu', e => e.preventDefault());
  // Tapping away closes Delete again (and the listener goes once the row has)
  const away = e => { if (!row.isConnected) return document.removeEventListener('pointerdown', away, true); if (row.classList.contains('open') && !row.contains(e.target)) row.slide(0); };
  document.addEventListener('pointerdown', away, true);
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
    video.addEventListener('click', openForm);
    // With no figure for the move, the circle itself is the way to see how it's done
    const figure = MoveFigure(it.name);
    let art;
    if (figure) art = h('div', { class: 'move-art' }, figure);
    else {
      const orb = h('a', { class: 'move-orb orb-form', href: formVideoUrl(it.name), target: '_blank', rel: 'noopener', 'aria-label': `See form videos for ${it.name}` },
        h('span', { class: 'fv-icon', 'aria-hidden': 'true' }), h('span', { class: 'orb-label' }, 'See form'));
      orb.addEventListener('click', openForm);
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
      (() => {
        // A mic in the reps box: say the number and it goes in
        const mic = voiceSupported ? micButton({ label: `Say reps for ${it.name}`, once: true, onSaid: text => { const v = spokenNumber(text); if (v) { amount.value = it.did = v; amount.dispatchEvent(new Event('input', { bubbles: true })); vibrate(8); } } }) : null;
        if (mic) ctx.onCleanup(() => mic.stop());
        const box = mic ? h('div', { class: 'did-mic' }, amount, mic) : amount;
        return extra ? h('div', { class: 'did-pair' }, box, extra) : box;
      })(), isTimed(it.name, it.dose, it.did) ? timer(it, amount) : null,
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
