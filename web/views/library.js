// Routines › Browse: the research-backed routines, one card each with a wash of colour and its length,
// and a page for each with what it's good for, its moves, and the research behind it with links to the studies.
import { h, iconButton, toast, vibrate } from '../lib/ui.js';
import * as R from '../lib/repos.js';
import { ROUTINE_LIBRARY, libraryRoutine } from '../lib/routine-library.js';
import { MoveFigure } from './figure.js';

const added = id => R.routines.all().find(r => r.libraryId === id);
const tone = kind => ({ Strength: 'warm', Stretch: 'cool', Mixed: 'violet', Activity: 'green' })[kind] ?? 'cool';

export function BrowseView() {
  const cards = ROUTINE_LIBRARY.map((r, i) => {
    const mine = added(r.id);
    return h('a', { class: `lib-card glass tone-${tone(r.kind)}`, href: `#/routines/browse/${r.id}`, style: `--i:${i}` },
      // A wash of colour with the session length set large, in place of a picture
      h('div', { class: 'lib-art' }, h('span', { class: 'lib-mins' }, String(r.minutes), h('small', {}, 'min'))),
      h('div', { class: 'lib-text' },
        h('strong', {}, r.name),
        h('span', { class: 'lib-tag' }, r.tagline),
        h('span', { class: 'lib-meta' }, r.kind, ' · ', r.often, mine ? h('span', { class: 'lib-added' }, 'Added') : null)));
  });
  return h('div', { class: 'view library' },
    h('header', { class: 'top-bar' }, iconButton('‹', 'Back', () => { location.hash = '#/routines'; }), h('span'), h('span')),
    h('h1', { class: 'lib-title' }, 'Research-backed routines'),
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
    h('header', { class: 'top-bar' }, iconButton('‹', 'Back', () => history.back()), h('span'), h('span')),
    h('div', { class: `lib-hero glass tone-${tone(r.kind)}` }, MoveFigure(r.cover)),
    h('h1', { class: 'lib-name' }, r.name),
    h('p', { class: 'lead' }, r.tagline),
    h('p', { class: 'lib-facts' }, r.kind, h('i', {}, '·'), `${r.minutes} min`, h('i', {}, '·'), r.often),
    h('div', { class: 'lib-action' }, mine
      ? h('a', { class: 'btn glass wide', href: `#/routine/${mine.id}` }, 'Open in your routines')
      : h('button', { type: 'button', class: 'btn primary wide', onclick: add }, 'Add to my routines')),
    // Plain sections split by hairlines rather than more cards
    h('section', { class: 'lib-section' }, h('h2', {}, 'Good for'), h('p', {}, r.goodFor)),
    h('section', { class: 'lib-section' }, h('h2', {}, 'The moves'),
      h('ol', { class: 'lib-moves' }, r.items.map(it => h('li', {}, h('span', {}, it.name), h('span', { class: 'hint' }, it.dose))))),
    h('section', { class: 'lib-section' }, h('h2', {}, 'The research'), h('p', {}, r.research),
      h('ul', { class: 'lib-studies' }, r.studies.map(st => h('li', {},
        h('a', { href: st.url, target: '_blank', rel: 'noopener' },
          h('span', {}, h('strong', {}, st.name), h('small', {}, st.size)), h('span', { class: 'lib-out', 'aria-hidden': 'true' }, '↗')))))));
}
