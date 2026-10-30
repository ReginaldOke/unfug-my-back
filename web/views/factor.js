// Factor quick-add sheet and the factor detail screen (settings + analysis).
import { h, sheet, segmented, field, toast, iconButton } from '../lib/ui.js';
import * as R from '../lib/repos.js';
import { ROLE_OPTIONS, ROLE_LABEL, ROLE_ICON, MEASURE_OPTIONS, fmtAmount } from '../lib/labels.js';
import { analyseFactor } from '../lib/analysis.js';
import { dayLabel } from '../lib/dates.js';
import { SelectCard } from './controls.js';

/**
 * Tall drawer to add a stressor or helper: your own at the top, common ones you haven't switched on below.
 * Resolves with every factor added or switched on (possibly none). exercise: adds to the check-in's
 * exercise step instead (counted as a helper until the patterns say otherwise).
 */
export function quickAddFactor({ role = 'trigger', status = 'suspected', title, exercise = false } = {}) {
  return new Promise(resolve => {
    const added = [];
    let measure = 'minutes';
    if (exercise) role = 'helper';
    const roles = role === 'helper' ? ['helper'] : ['trigger', 'unsure'];
    const kind = exercise ? 'exercise' : role === 'helper' ? 'helper' : 'stressor';
    sheet(close => {
      const name = h('input', { type: 'text', class: 'glass-input', required: true, maxlength: 60, placeholder: { exercise: 'Climbing', helper: 'Foam rolling', stressor: 'Doomscrolling' }[kind], 'aria-label': 'Name', enterkeyhint: 'done' });
      const form = h('form', {
        class: 'stack', onsubmit: e => {
          e.preventDefault();
          if (!name.value.trim()) return name.focus();
          added.push(R.factors.create({ name: name.value.trim(), role, measureType: measure, status, ...(exercise ? { category: 'exercise' } : {}) }));
          close();
        },
      },
      name,
      field('Track it as', segmented([['minutes', 'Time'], ['count', 'Count'], ['yesno', 'Yes / no']], measure, v => { measure = v; }, 'Track it as')),
      h('button', { type: 'submit', class: 'btn primary' }, 'Add'));

      const suggestions = R.factors.all({ archived: true }).filter(f => f.isArchived && !f.routineId && !f.retired && (exercise ? R.isExercise(f) : roles.includes(f.role) && !R.isExercise(f)));
      // Typing focuses the field straight away on desktop; on phones the keyboard would cover the suggestions
      if (!matchMedia('(pointer: coarse)').matches) setTimeout(() => name.focus({ preventScroll: true }), 50);
      return h('div', { class: 'stack' },
        h('h2', {}, title || { exercise: 'Add exercise', helper: 'Add a helper', stressor: 'Add a stressor' }[kind]),
        form,
        suggestions.length ? h('div', { class: 'stack' },
          h('h3', { class: 'section-label' }, { exercise: 'More kinds', helper: 'Common helpers', stressor: 'Common stressors' }[kind]),
          h('div', { class: 'card-grid' }, suggestions.map(f => SelectCard({
            icon: f.icon || ROLE_ICON[f.role], title: f.name, on: false,
            onToggle: on => {
              R.factors.setArchived(f.id, !on);
              const i = added.indexOf(f);
              if (on && i < 0) added.push(f); else if (!on && i >= 0) added.splice(i, 1);
            },
          })))) : null);
    }, { onClose: () => resolve(added.map(f => R.factors.get(f.id)).filter(Boolean)), tall: true });
  });
}

export function FactorDetailView(ctx) {
  const f = R.factors.get(ctx.args[0]);
  if (!f) return h('div', { class: 'view' }, h('p', {}, 'That factor no longer exists.'), h('a', { href: '#/' }, 'Home'));
  const a = analyseFactor(f, R.snapshot());
  const logs = R.factors.logs(f.id).slice(0, 8);

  const name = h('input', {
    type: 'text', class: 'title-input', value: f.name, 'aria-label': 'Name', maxlength: 60,
    onchange: e => { if (e.target.value.trim()) { R.factors.save(f.id, { name: e.target.value.trim() }); toast('Renamed'); } },
  });

  return h('div', { class: 'view' },
    h('header', { class: 'top-bar' }, iconButton('‹', 'Back', () => history.back()), h('span', { class: 'eyebrow' }, `${ROLE_ICON[f.role]} ${ROLE_LABEL[f.role]}`), h('span')),
    h('div', { class: 'title-row' }, h('span', { class: 'well big' }, f.icon || ROLE_ICON[f.role]), name),

    h('section', { class: 'card glass' },
      h('h2', {}, 'Pain with vs without'),
      a.best
        ? h('p', { class: 'lead' }, insightSentence(a))
        : h('p', { class: 'muted' }, notEnoughSentence(a)),
      h('div', { class: 'lag-bars' }, a.lags.map(l => lagBar(l))),
      h('p', { class: 'hint' }, 'Shows what tends to go together, not what causes what.')),

    a.dose.length ? h('section', { class: 'card glass' },
      h('h2', {}, 'By amount'),
      h('div', { class: 'dose' }, a.dose.map(b => h('div', { class: 'dose-col' },
        h('div', { class: 'dose-bar' }, h('i', { style: `height:${b.meanPain == null ? 0 : b.meanPain * 10}%` })),
        h('strong', {}, b.meanPain == null ? '–' : b.meanPain.toFixed(1)),
        h('span', { class: 'hint' }, b.label), h('span', { class: 'hint' }, `${b.n} d`))))) : null,

    h('section', { class: 'card glass stats-grid' },
      miniStat(`${a.consistency.done}/${a.consistency.days}`, 'days in last 2 weeks'),
      miniStat(String(a.daysLogged), 'days logged in total')),

    h('section', { class: 'card glass stack' },
      h('h2', {}, 'Settings'),
      field('Type', segmented(ROLE_OPTIONS, f.role, v => { R.factors.save(f.id, { role: v }); toast('Saved'); }, 'Type')),
      field('Track it as', segmented(MEASURE_OPTIONS.slice(0, 3), f.measureType, v => { R.factors.save(f.id, { measureType: v }); toast('Saved'); }, 'Track it as'),
        'Past entries will show in the new format.'),
      h('button', {
        type: 'button', class: 'btn ghost', onclick: () => {
          R.factors.setArchived(f.id, !f.isArchived);
          toast(f.isArchived ? 'Back in your check-in' : 'Hidden. Past entries are kept.');
          history.back();
        },
      }, f.isArchived ? 'Show in check-ins again' : 'Hide from check-ins')),

    logs.length ? h('section', { class: 'card glass' }, h('h2', {}, 'Recent'),
      h('ul', { class: 'list' }, logs.map(l => h('li', { class: 'list-row' }, h('span', { class: 'grow' }, dayLabel(l.date)), h('span', { class: 'muted' }, fmtAmount(f, l.value)))))) : null);
}

const LAG_NAME = ['Same day', 'Next day', '2 days later'];

export function insightSentence(a) {
  const b = a.best;
  const when = ['On days with', 'The day after', 'Two days after'][b.lag];
  const sure = a.early ? 'early sign' : `${b.confidence} confidence`;
  return `${when} ${a.factor.name.toLowerCase()}, pain averages ${b.meanWith.toFixed(1)}, against ${b.meanWithout.toFixed(1)} without. ${b.nWith} days with, ${b.nWithout} without, ${sure}.`;
}

function notEnoughSentence(a) {
  const l = a.lags[0];
  const parts = [];
  if (l.needWith) parts.push(`${l.needWith} more day${l.needWith > 1 ? 's' : ''} with it`);
  if (l.needWithout) parts.push(`${l.needWithout} more without`);
  return `Not enough days yet. Needs ${parts.join(' and ')}.`;
}

function lagBar(l) {
  return h('div', { class: 'lag' },
    h('span', { class: 'hint' }, LAG_NAME[l.lag]),
    h('div', { class: 'pair' },
      h('div', { class: 'bar with' }, h('i', { style: `width:${l.enough ? l.meanWith * 10 : 0}%` })),
      h('div', { class: 'bar without' }, h('i', { style: `width:${l.enough ? l.meanWithout * 10 : 0}%` }))),
    h('span', { class: 'lag-num' }, l.enough ? `${l.delta > 0 ? '+' : ''}${l.delta.toFixed(1)}` : '–'));
}

const miniStat = (v, label) => h('div', { class: 'mini-stat' }, h('span', { class: 'num' }, v), h('span', { class: 'hint' }, label));
