// Movement routines: list, edit, and a one-move-at-a-time player.
import { h, toast, iconButton, select, confirmSheet } from '../lib/ui.js';
import * as R from '../lib/repos.js';
import { localDate } from '../lib/dates.js';

export function RoutinesView() {
  const today = localDate();
  const list = R.routines.all();
  return h('div', { class: 'view' },
    h('header', { class: 'top-bar' }, h('h1', {}, 'Routines'), h('a', { class: 'icon-btn glass', href: '#/routine/new', 'aria-label': 'New routine' }, '+')),
    list.length ? null : h('p', { class: 'muted' }, 'Define a short movement routine. It counts as a helper each time you finish it.'),
    list.map(r => {
      const done = R.routines.completionsOn(today, r.id).length;
      return h('section', { class: 'card glass routine-card' },
        h('div', { class: 'row between' },
          h('div', {}, h('h2', {}, r.name), h('p', { class: 'hint' }, `${r.items.length} moves · ${r.schedule.join(', ') || 'no reminders'}`)),
          h('a', { class: 'play', href: `#/routine/${r.id}/run`, 'aria-label': `Start ${r.name}` }, '▶')),
        h('div', { class: 'seg-dots', 'aria-label': `${done} of ${r.schedule.length} done today` }, r.schedule.map((_, i) => h('i', { class: i < done ? 'on' : '' }))),
        h('ol', { class: 'moves' }, r.items.map(it => h('li', {}, h('span', {}, it.name), h('span', { class: 'hint' }, it.dose)))),
        h('a', { class: 'btn ghost small', href: `#/routine/${r.id}/edit` }, 'Edit'));
    }));
}

export function RoutineEditView(ctx) {
  const r = ctx.args[0] ? R.routines.get(ctx.args[0]) : null;
  const model = {
    name: r?.name ?? '',
    items: structuredClone(r?.items ?? [{ name: '', dose: '' }]),
    schedule: [...(r?.schedule ?? ['09:00'])],
    linkedFactorId: r?.linkedFactorId ?? R.factors.all().find(f => f.name === 'Mobility routine')?.id ?? '',
  };
  const itemsBox = h('div', { class: 'stack tight' });
  const timesBox = h('div', { class: 'chips wrap' });

  const renderItems = () => itemsBox.replaceChildren(
    ...model.items.map((it, i) => h('div', { class: 'item-row' },
      h('span', { class: 'idx' }, String(i + 1)),
      h('input', { type: 'text', class: 'glass-input grow', value: it.name, placeholder: 'Move', 'aria-label': `Move ${i + 1}`, oninput: e => { it.name = e.target.value; } }),
      h('input', { type: 'text', class: 'glass-input dose-input', value: it.dose, placeholder: '× 6', 'aria-label': `Dose for move ${i + 1}`, oninput: e => { it.dose = e.target.value; } }),
      h('button', { type: 'button', class: 'icon-btn small', 'aria-label': `Move ${i + 1} up`, disabled: i === 0, onclick: () => { model.items.splice(i - 1, 0, ...model.items.splice(i, 1)); renderItems(); } }, '↑'),
      h('button', { type: 'button', class: 'icon-btn small', 'aria-label': `Remove move ${i + 1}`, onclick: () => { model.items.splice(i, 1); renderItems(); } }, '✕'))),
    h('button', { type: 'button', class: 'btn ghost small', onclick: () => { model.items.push({ name: '', dose: '' }); renderItems(); itemsBox.querySelector('.item-row:last-of-type input')?.focus(); } }, '+ Add a move'));

  const renderTimes = () => timesBox.replaceChildren(
    ...model.schedule.map((t, i) => h('span', { class: 'chip time' },
      h('input', { type: 'time', value: t, 'aria-label': `Reminder ${i + 1}`, onchange: e => { model.schedule[i] = e.target.value; } }),
      h('button', { type: 'button', class: 'x', 'aria-label': `Remove reminder ${i + 1}`, onclick: () => { model.schedule.splice(i, 1); renderTimes(); } }, '✕'))),
    h('button', { type: 'button', class: 'chip add', onclick: () => { model.schedule.push('12:00'); renderTimes(); } }, '+ Time'));

  renderItems();
  renderTimes();

  const save = () => {
    const items = model.items.filter(it => it.name.trim()).map(it => ({ name: it.name.trim(), dose: it.dose.trim() }));
    if (!model.name.trim()) return toast('Give the routine a name');
    if (!items.length) return toast('Add at least one move');
    R.routines.save(r?.id, { name: model.name.trim(), items, schedule: [...new Set(model.schedule)].sort(), linkedFactorId: model.linkedFactorId || null });
    toast('Routine saved');
    location.hash = '#/routines';
  };

  const helpers = R.factors.all().filter(f => f.role === 'helper');
  return h('div', { class: 'view' },
    h('header', { class: 'top-bar' }, iconButton('‹', 'Back', () => history.back()), h('h1', {}, r ? 'Edit routine' : 'New routine'), h('span')),
    h('input', { type: 'text', class: 'title-input', value: model.name, placeholder: 'Routine name', 'aria-label': 'Routine name', oninput: e => { model.name = e.target.value; } }),
    h('section', { class: 'card glass' }, h('h2', {}, 'Moves'), itemsBox),
    h('section', { class: 'card glass stack' }, h('h2', {}, 'Remind me at'), timesBox),
    h('section', { class: 'card glass stack' }, h('h2', {}, 'Counts as helper'),
      select([['', 'None'], ...helpers.map(f => [f.id, f.name])], model.linkedFactorId, { class: 'glass-input', 'aria-label': 'Helper this routine counts towards', onchange: e => { model.linkedFactorId = e.target.value; } })),
    h('button', { type: 'button', class: 'btn primary wide', onclick: save }, 'Save routine'),
    r ? h('button', {
      type: 'button', class: 'btn ghost wide', onclick: async () => {
        if (await confirmSheet('Remove this routine?', 'Past completions stay in your history.', 'Remove', { danger: true })) {
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
    toast(completed ? 'Routine done. Logged as a helper.' : 'Logged as partly done');
    location.hash = '#/';
  };

  function render() {
    const it = r.items[i];
    const last = i === r.items.length - 1;
    root.replaceChildren(
      h('header', { class: 'flow-head' }, iconButton('✕', 'Stop', () => (i > 0 ? finish(false) : history.back())), h('span', { class: 'eyebrow' }, r.name), h('span', { class: 'timer' }, `${i + 1}/${r.items.length}`)),
      h('div', { class: 'progress' }, r.items.map((_, k) => h('i', { class: k < i ? 'done' : k === i ? 'now' : '' }))),
      h('div', { class: 'flow-body move-stage' },
        h('div', { class: 'move-orb', 'aria-hidden': 'true' }, String(i + 1)),
        h('h1', { tabindex: -1 }, it.name),
        h('p', { class: 'dose-big' }, it.dose),
        r.items[i + 1] ? h('p', { class: 'hint' }, `Next: ${r.items[i + 1].name}`) : null),
      h('div', { class: 'flow-footer' },
        i > 0 ? h('button', { type: 'button', class: 'btn ghost', onclick: () => { i--; render(); } }, 'Back') : h('span'),
        h('button', { type: 'button', class: 'btn primary wide', onclick: () => (last ? finish(true) : (i++, render())) }, last ? 'Done' : 'Next')));
    root.querySelector('h1').focus({ preventScroll: true });
  }
  render();
  return root;
}
