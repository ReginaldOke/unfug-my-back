// Routines › Browse: the research-backed routines, as a two-column board of cards, each with its moving
// figure, and a page for each with what it's good for, the research behind it and its moves.
import { h, iconButton, toast, vibrate } from '../lib/ui.js';
import * as R from '../lib/repos.js';
import { ROUTINE_LIBRARY, libraryRoutine } from '../lib/routine-library.js';
import { MoveFigure } from './figure.js';

const added = id => R.routines.all().find(r => r.libraryId === id);
// The figure panel's height varies from card to card, so the board has the staggered look of a pinboard
const TALL = [168, 210, 186, 228, 176, 200];
const tone = kind => ({ Strength: 'warm', Stretch: 'cool', Mixed: 'violet', Activity: 'green' })[kind] ?? 'cool';

export function BrowseView() {
  const cards = ROUTINE_LIBRARY.map((r, i) => {
    const mine = added(r.id);
    return h('a', { class: `lib-card glass tone-${tone(r.kind)}`, href: `#/routines/browse/${r.id}`, style: `--i:${i}` },
      h('div', { class: 'lib-art', style: `height:${TALL[i % TALL.length]}px` }, MoveFigure(r.cover), mine ? h('span', { class: 'lib-added' }, 'Added') : null),
      h('div', { class: 'lib-text' },
        h('strong', {}, r.name),
        h('span', { class: 'lib-tag' }, r.tagline),
        h('span', { class: 'lib-meta' }, `${r.kind} · ${r.minutes} min`)));
  });
  return h('div', { class: 'view library' },
    h('header', { class: 'top-bar' }, iconButton('‹', 'Back', () => { location.hash = '#/routines'; }), h('span', { class: 'eyebrow' }, 'Browse'), h('span')),
    h('h1', { class: 'lib-title' }, 'Routines with research behind them'),
    h('div', { class: 'lib-board' }, cards));
}

export function LibraryRoutineView(ctx) {
  const r = libraryRoutine(ctx.args[0]);
  if (!r) return h('div', { class: 'view' }, h('p', {}, 'Routine not found.'), h('a', { href: '#/routines/browse' }, 'Browse routines'));
  const mine = added(r.id);
  const add = () => {
    const made = R.routines.save(null, { name: r.name, items: structuredClone(r.items), schedule: [], libraryId: r.id });
    vibrate(8);
    toast(`${r.name} added to your routines`);
    location.hash = `#/routine/${made.id}`;
  };
  return h('div', { class: 'view library-detail' },
    h('header', { class: 'top-bar' }, iconButton('‹', 'Back', () => history.back()), h('span', { class: 'eyebrow' }, r.kind), h('span')),
    h('div', { class: `lib-hero glass tone-${tone(r.kind)}` }, MoveFigure(r.cover)),
    h('h1', { class: 'lib-name' }, r.name),
    h('p', { class: 'lead' }, r.tagline),
    h('div', { class: 'lib-chips' }, h('span', { class: 'chip glass' }, `${r.minutes} min`), h('span', { class: 'chip glass' }, r.often)),
    h('div', { class: 'lib-action' }, mine
      ? h('a', { class: 'btn glass wide', href: `#/routine/${mine.id}` }, 'Open in your routines')
      : h('button', { type: 'button', class: 'btn primary wide', onclick: add }, 'Add to my routines')),
    h('section', { class: 'card glass' }, h('h2', {}, 'Good for'), h('p', {}, r.goodFor)),
    h('section', { class: 'card glass' }, h('h2', {}, 'The research'), h('p', {}, r.research)),
    h('section', { class: 'card glass' }, h('h2', {}, 'The moves'),
      h('ol', { class: 'lib-moves' }, r.items.map(it => h('li', {}, h('span', {}, it.name), h('span', { class: 'hint' }, it.dose))))));
}
