// Routines: your list, a day's log (sets and reps), the editor, and a one-move-at-a-time player.
import { h, toast, iconButton, confirmSheet, segmented, vibrate } from '../lib/ui.js';
import * as R from '../lib/repos.js';
import { localDate, dayLabel } from '../lib/dates.js';
import { bumpLastNumber } from '../lib/labels.js';
import { checkinDraft } from './checkin.js';
import { MoveFigure } from './figure.js';
import { dragHandles } from './sortable.js';

/** Set when a routine is finished, read once by the Today screen to play its celebration. */
export const justFinished = { id: null };

export function RoutinesView() {
  const today = localDate();
  const list = R.routines.all();
  return h('div', { class: 'view' },
    h('header', { class: 'top-bar' }, h('h1', {}, 'Routines')),
    list.length ? null : h('p', { class: 'muted' }, 'Keep your gym, stretching or calisthenics routines here. Tick one off in your check-in, or open it to log your sets.'),
    list.map(r => {
      const done = R.routines.completionsOn(today, r.id).length > 0;
      const last = lastDone(r.id);
      return h('a', { class: 'card glass routine-card', href: `#/routine/${r.id}`, 'aria-label': `${r.name}, ${r.items.length} moves${done ? ', done today' : ''}. Open` },
        h('div', { class: 'row between' },
          h('div', {}, h('h2', {}, r.name),
            h('p', { class: 'hint' }, [`${r.items.length} move${r.items.length === 1 ? '' : 's'}`, done ? 'done today' : last ? `last done ${dayLabel(last).toLowerCase()}` : null].filter(Boolean).join(' · '))),
          // The whole card opens it; the corner only says when it's done today
          done ? h('span', { class: 'well action done-mark', 'aria-hidden': 'true' }, '✓') : null),
        h('ol', { class: 'moves' }, r.items.map(it => h('li', {}, h('span', {}, it.name), h('span', { class: 'hint' }, it.dose)))));
    }),
    h('a', { class: 'add-card', href: '#/routine/new' }, '+ New routine'));
}

const lastDone = id => R.routines.lastDoneDate(id);

/**
 * A routine's log for one day: every move with what you did (last time's numbers shown faintly),
 * drag to reorder, add a move, save. Opened from the Routines tab, Today, or a check-in's Edit.
 */
export function RoutineLogView(ctx) {
  const r = R.routines.get(ctx.args[0]);
  if (!r) return h('div', { class: 'view' }, h('p', {}, 'Routine not found.'), h('a', { href: '#/routines' }, 'Routines'));
  const date = ctx.params.get('date') || localDate();
  const fromCheckin = ctx.params.get('from') === 'checkin';
  const session = R.routines.sessionOn(r.id, date);
  const before = R.routines.lastDid(r.id, date);
  const didNow = new Map((session?.log ?? []).map(x => [x.name, x.did]));
  // Each box starts with what you did today if logged, else last time's numbers, else the target;
  // you adjust it rather than type from scratch. Ticked (done) is separate: tap the name, or change the value
  const items = structuredClone(r.items).map(it => {
    const logged = didNow.get(it.name);
    return { ...it, did: logged || before.get(it.name) || it.dose || '', done: !!logged };
  });
  const draft = fromCheckin ? checkinDraft(date) : null;
  const factorId = r.linkedFactorId;
  let intensity = draft?.intensity.get(factorId) ?? session?.intensity ?? null;

  const list = h('div', { class: 'log-list' });
  const rowItem = new Map();
  const paint = () => list.replaceChildren(
    ...items.map(it => {
      const tick = on => { it.done = on; row.classList.toggle('done', on); name.setAttribute('aria-pressed', String(on)); };
      const did = h('input', {
        type: 'text', class: 'did-input', value: it.did, inputmode: 'text', enterkeyhint: 'next',
        placeholder: 'Done', 'aria-label': `What you did: ${it.name}`,
        oninput: e => { it.did = e.target.value; tick(true); },
        onkeydown: e => { if (e.key === 'Enter') { e.preventDefault(); const next = row.nextElementSibling?.querySelector('.did-input'); next ? next.focus() : e.target.blur(); } },
      });
      scrubNumber(did, () => it.dose || '0');
      // Tapping the name ticks the move off (or back on)
      const name = h('button', { type: 'button', class: 'grow log-tick', 'aria-pressed': String(it.done), onclick: () => tick(!it.done) },
        h('span', { class: 'log-check', 'aria-hidden': 'true' }), h('span', { class: 'log-name' }, it.name));
      const row = h('div', { class: `log-row drag-row${it.done ? ' done' : ''}` },
        h('span', { class: 'grip', role: 'button', 'aria-label': `Drag to reorder ${it.name}`, title: 'Drag to reorder' }, h('i'), h('i'), h('i')),
        name,
        did);
      rowItem.set(row, it);
      return row;
    }),
    addRow());
  dragHandles(list, { onReorder: rows => { items.splice(0, items.length, ...rows.map(x => rowItem.get(x))); } });

  function addRow() {
    const input = h('input', {
      type: 'text', class: 'glass-input', placeholder: '+ Add a move', 'aria-label': 'Add a move', enterkeyhint: 'done',
      onkeydown: e => { if (e.key === 'Enter') { e.preventDefault(); input.blur(); } },
      onblur: () => { const name = input.value.trim(); if (name) { items.push({ name, dose: '', did: '', done: false }); paint(); } },
    });
    return h('div', { class: 'log-add' }, input);
  }
  paint();

  const effort = segmented([[1, 'Easy'], [2, 'Moderate'], [3, 'Hard']], intensity, v => { intensity = v; }, 'How hard');

  function save() {
    const moves = items.map(({ name, dose }) => ({ name, dose }));
    if (moves.map(m => m.name + m.dose).join() !== r.items.map(m => m.name + m.dose).join()) R.routines.save(r.id, { items: moves });
    // Only ticked moves count as done; a tick with nothing typed is saved as ✓
    const log = items.map(({ name, did, done }) => ({ name, did: done ? did.trim() || '✓' : '' }));
    // A check-in in progress saves the tick itself; otherwise the routine is ticked for that day now
    const liveDraft = checkinDraft(date);
    R.routines.logSession(r.id, date, { log, intensity }, { writeLog: !liveDraft });
    if (liveDraft) { liveDraft.selections.set(factorId, 1); liveDraft.intensity.set(factorId, intensity ?? liveDraft.intensity.get(factorId) ?? 2); }
    toast(`${r.name} logged`);
    if (fromCheckin) location.hash = `#/checkin?date=${date}`;
    else { justFinished.id = date === localDate() ? r.id : null; location.hash = '#/'; }
  }

  return h('div', { class: 'view routine-log' },
    h('header', { class: 'top-bar' },
      iconButton('‹', 'Back', () => history.back()),
      h('span', { class: 'eyebrow' }, dayLabel(date)),
      h('a', { class: 'chip glass', href: `#/routine/${r.id}/edit${fromCheckin ? `?from=checkin&date=${date}` : ''}` }, 'Edit')),
    h('h1', {}, r.name),
    list,
    h('div', { class: 'field' }, h('span', { class: 'field-label' }, 'How hard was it?'), effort),
    h('button', { type: 'button', class: 'btn primary wide', onclick: save }, session ? 'Save' : 'Done'),
    r.items.some(it => MoveFigure(it.name)) ? h('a', { class: 'btn ghost wide', href: `#/routine/${r.id}/run` }, '▶ Follow along') : null);
}

const SCRUB_STEP = 14; // px of finger travel per step

/**
 * Swipe up or down on a log box to change its number; a plain tap still opens the keyboard to type.
 * An empty box starts from seed() (last time's value, or the target).
 */
function scrubNumber(input, seed) {
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

export function RoutineEditView(ctx) {
  const r = ctx.args[0] ? R.routines.get(ctx.args[0]) : null;
  const fromCheckin = ctx.params.get('from') === 'checkin';
  const date = ctx.params.get('date');
  const model = {
    name: r?.name ?? '',
    items: structuredClone(r?.items ?? [{ name: '', dose: '' }, { name: '', dose: '' }, { name: '', dose: '' }]),
    schedule: [...(r?.schedule ?? [])],
  };
  const itemsBox = h('div', { class: 'stack tight' });
  const timesBox = h('div', { class: 'chips wrap' });

  // Press the grip and drag to reorder; rows keep their item, so only the numbers need redrawing
  const rowItem = new Map();
  const renumber = () => itemsBox.querySelectorAll('.drag-row .idx').forEach((n, i) => { n.textContent = String(i + 1); });
  const renderItems = () => itemsBox.replaceChildren(
    ...model.items.map((it, i) => {
      const row = h('div', { class: 'item-row drag-row' },
        h('span', { class: 'grip', role: 'button', 'aria-label': `Drag to reorder ${it.name || 'move'}`, title: 'Drag to reorder' }, h('i'), h('i'), h('i')),
        h('span', { class: 'idx' }, String(i + 1)),
        h('input', { type: 'text', class: 'glass-input grow', value: it.name, placeholder: ['Push-ups', 'Squats', 'Plank'][i] ?? 'Move', 'aria-label': `Move ${i + 1}`, oninput: e => { it.name = e.target.value; } }),
        h('input', { type: 'text', class: 'glass-input dose-input', value: it.dose, placeholder: ['3 × 10', '3 × 12', '45 s'][i] ?? '× 6', 'aria-label': `Target for move ${i + 1}`, oninput: e => { it.dose = e.target.value; } }),
        h('button', { type: 'button', class: 'icon-btn small', 'aria-label': `Remove move ${i + 1}`, onclick: () => { model.items.splice(model.items.indexOf(it), 1); renderItems(); } }, '✕'));
      rowItem.set(row, it);
      return row;
    }),
    h('button', { type: 'button', class: 'btn ghost small', onclick: () => { model.items.push({ name: '', dose: '' }); renderItems(); itemsBox.querySelector('.item-row:last-of-type input')?.focus(); } }, '+ Add a move'));
  dragHandles(itemsBox, { onReorder: rows => { model.items = rows.map(r => rowItem.get(r)); renumber(); } });

  const renderTimes = () => timesBox.replaceChildren(
    ...model.schedule.map((t, i) => h('span', { class: 'chip time' },
      h('input', { type: 'time', value: t, 'aria-label': `Reminder ${i + 1}`, onchange: e => { model.schedule[i] = e.target.value; } }),
      h('button', { type: 'button', class: 'x', 'aria-label': `Remove reminder ${i + 1}`, onclick: () => { model.schedule.splice(i, 1); renderTimes(); } }, '✕'))),
    h('button', { type: 'button', class: 'chip add', onclick: () => { model.schedule.push('18:00'); renderTimes(); } }, '+ Reminder'));

  renderItems();
  renderTimes();

  const save = () => {
    const items = model.items.filter(it => it.name.trim()).map(it => ({ name: it.name.trim(), dose: it.dose.trim() }));
    if (!model.name.trim()) return toast('Give the routine a name');
    if (!items.length) return toast('Add at least one move');
    const saved = R.routines.save(r?.id, { name: model.name.trim(), items, schedule: [...new Set(model.schedule)].sort() });
    toast('Routine saved');
    // Back to where it was opened: the check-in it was added from, or the routine's log
    if (fromCheckin && !r) location.hash = `#/checkin?date=${date ?? localDate()}`;
    else if (r) history.back();
    else location.hash = `#/routine/${saved.id}`;
  };

  return h('div', { class: 'view' },
    h('header', { class: 'top-bar' }, iconButton('‹', 'Back', () => history.back()), h('h1', {}, r ? 'Edit routine' : 'New routine'), h('span')),
    h('input', { type: 'text', class: 'title-input', value: model.name, placeholder: 'e.g. Calisthenics', 'aria-label': 'Routine name', oninput: e => { model.name = e.target.value; } }),
    h('section', { class: 'card glass' }, h('div', { class: 'row between' }, h('h2', {}, 'Moves'), h('span', { class: 'hint' }, 'Target')), itemsBox),
    h('section', { class: 'card glass stack' }, h('h2', {}, 'Reminders'), timesBox),
    h('button', { type: 'button', class: 'btn primary wide', onclick: save }, 'Save routine'),
    r ? h('button', {
      type: 'button', class: 'btn ghost wide', onclick: async () => {
        if (await confirmSheet('Remove this routine?', 'Past sessions stay in your history.', 'Remove', { danger: true })) {
          R.routines.archive(r.id);
          location.hash = '#/routines';
        }
      },
    }, 'Remove routine') : null);
}

export function RoutineRunView(ctx) {
  const r = R.routines.get(ctx.args[0]);
  if (!r) return h('div', { class: 'view' }, h('p', {}, 'Routine not found.'));
  let i = 0;
  const root = h('div', { class: 'flow' });

  const finish = completed => {
    R.routines.complete(r.id, completed);
    // Today celebrates the finish on the routine tile (see home.js); a partial session just gets a note
    if (completed) justFinished.id = r.id;
    else toast('Logged as partly done');
    location.hash = '#/';
  };

  function render() {
    const it = r.items[i];
    const last = i === r.items.length - 1;
    root.replaceChildren(
      h('header', { class: 'flow-head' }, iconButton('✕', 'Stop', () => (i > 0 ? finish(false) : history.back())), h('span', { class: 'eyebrow' }, r.name), h('span', { class: 'timer' }, `${i + 1}/${r.items.length}`)),
      h('div', { class: 'progress' }, r.items.map((_, k) => h('i', { class: k < i ? 'done' : k === i ? 'now' : '' }))),
      h('div', { class: 'flow-body move-stage' },
        MoveFigure(it.name) ?? h('div', { class: 'move-orb', 'aria-hidden': 'true' }, String(i + 1)),
        h('h1', { tabindex: -1 }, it.name),
        h('p', { class: 'dose-big' }, it.dose),
        r.items[i + 1] ? h('p', { class: 'hint' }, `Next: ${r.items[i + 1].name}`) : null),
      h('div', { class: 'flow-footer' },
        i > 0 ? iconButton('‹', 'Back', () => { i--; render(); }) : h('span'),
        h('button', { type: 'button', class: 'btn primary wide', onclick: () => (last ? finish(true) : (i++, render())) }, last ? 'Done' : 'Next')));
    root.querySelector('h1').focus({ preventScroll: true });
  }
  render();
  return root;
}
