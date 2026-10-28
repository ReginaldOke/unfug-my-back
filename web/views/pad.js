// Notes on Today: short reminders and affirmations. Everyone starts with a few; tap one to edit it,
// clear it to delete it, or add your own.
import { h, vibrate } from '../lib/ui.js';
import * as R from '../lib/repos.js';
import { dragHandles } from './sortable.js';

export const DEFAULT_NOTES = [
  'It’s tension, not damage.',
  'No need to brace every time you bend.',
  'Play the long game. Get stronger at the moves you avoid, like bending.',
];

/** Gives every diary the default notes once, existing ones included. Deleting them all keeps it empty. */
export function seedNotes() {
  if (!Array.isArray(R.settings().padNotes)) R.setSettings({ padNotes: DEFAULT_NOTES.map(text => ({ id: R.uuid(), text })) });
}
const notes = () => R.settings().padNotes ?? [];
const save = list => R.setSettings({ padNotes: list });

export function ScratchPad() {
  const list = h('ul', { class: 'pad-list' });
  const card = h('section', { class: 'card glass pad' },
    h('h2', {}, 'Notes'),
    list);

  function paint() {
    list.replaceChildren(
      ...notes().map(n => h('li', { class: 'pad-item drag-row', 'data-id': n.id },
        h('button', { type: 'button', class: 'pad-note', onclick: e => edit(e.currentTarget, n) }, n.text),
        h('span', { class: 'grip', role: 'button', 'aria-label': `Drag to reorder: ${n.text}`, title: 'Drag to reorder' }, h('i'), h('i'), h('i')))),
      h('li', {}, h('button', { type: 'button', class: 'pad-add', onclick: e => edit(e.currentTarget, null) }, '+ Add a note')));
  }
  // Drag a note by its grip to reorder
  dragHandles(list, {
    onReorder: rows => {
      const byId = new Map(notes().map(n => [n.id, n]));
      save(rows.map(r => byId.get(r.dataset.id)).filter(Boolean));
    },
  });

  /** Swaps a line for a text box; Enter or tapping away saves. ✕ (or clearing it) deletes the note. */
  function edit(btn, note) {
    const box = h('textarea', { class: 'pad-input', rows: 1, maxlength: 140, enterkeyhint: 'done', placeholder: 'A reminder to yourself', 'aria-label': note ? 'Edit note' : 'New note' }, note?.text ?? '');
    const fit = () => { box.style.height = 'auto'; box.style.height = `${box.scrollHeight}px`; };
    let done = false;
    const commit = () => {
      if (done) return;
      done = true;
      const text = box.value.replace(/\s+/g, ' ').trim();
      const all = notes();
      if (note) save(text ? all.map(n => (n.id === note.id ? { ...n, text } : n)) : all.filter(n => n.id !== note.id));
      else if (text) save([...all, { id: R.uuid(), text }]);
      if (note && !text) vibrate(6);
      paint();
    };
    box.addEventListener('input', fit);
    box.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); box.blur(); }
      if (e.key === 'Escape') { done = true; paint(); }
    });
    box.addEventListener('blur', commit);
    // pointerdown, not click: it runs before the text box loses focus and saves
    const del = note ? h('button', {
      type: 'button', class: 'pad-del', 'aria-label': 'Delete note',
      onpointerdown: e => { e.preventDefault(); box.value = ''; commit(); },
    }, '✕') : null;
    btn.replaceWith(h('div', { class: 'pad-edit' }, box, del));
    fit();
    box.focus();
    box.setSelectionRange(box.value.length, box.value.length);
  }

  paint();
  return card;
}
