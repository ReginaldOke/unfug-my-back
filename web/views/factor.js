// Factor quick-add sheet and the factor detail screen (settings + analysis).
import { h, sheet, segmented, field, toast, iconButton } from '../lib/ui.js';
import * as R from '../lib/repos.js';
import { ROLE_OPTIONS, ROLE_LABEL, ROLE_ICON, MEASURE_OPTIONS, fmtAmount } from '../lib/labels.js';
import { analyseFactor, factorStory, SAME_BAND } from '../lib/analysis.js';
import { dayLabel, addDays, localDate } from '../lib/dates.js';
import { SelectCard } from './controls.js';
import { TrendChart, PALETTES } from './chart.js';

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
  const data = R.snapshot();
  const story = factorStory(f, data);
  const a = analyseFactor(f, data);
  const dose = a.dose.filter(b => b.n);
  const logged = R.factors.logs(f.id);
  const recent = logged.filter(l => l.date >= addDays(localDate(), -13));
  const amounts = recent.filter(l => l.value > 0).map(l => Number(l.value));

  const name = h('input', {
    type: 'text', class: 'title-input', value: f.name, 'aria-label': 'Name', maxlength: 60,
    onchange: e => { if (e.target.value.trim()) { R.factors.save(f.id, { name: e.target.value.trim() }); toast('Renamed'); } },
  });

  // The summary reads the role, so it's redrawn when the type changes
  const summary = () => {
    const now = R.factors.get(f.id);
    return h('section', { class: 'card glass stack' },
      h('p', { class: 'lead story' }, headline(now, story)),
      story.best ? compare(now, story) : null);
  };
  let top = summary();

  return h('div', { class: 'view factor-page' },
    h('header', { class: 'top-bar' }, iconButton('‹', 'Back', () => history.back()), h('span', { class: 'eyebrow' }, `${ROLE_ICON[f.role]} ${ROLE_LABEL[f.role]}`), h('span')),
    h('div', { class: 'title-row' }, h('span', { class: 'well big' }, f.icon || ROLE_ICON[f.role]), name),

    top,

    story.state === 'none' ? null : h('section', { class: 'card glass' },
      h('h2', {}, story.strip.length >= 14 ? 'Last two weeks' : 'Since you started'),
      dayChart(f, story)),

    dose.length >= 3 && dose.filter(b => b.label !== 'None').every(b => b.n >= 2) ? h('section', { class: 'card glass' },
      h('h2', {}, 'By amount'),
      h('div', { class: 'dose' }, dose.map(b => h('div', { class: 'dose-col' },
        h('div', { class: 'dose-bar' }, h('i', { style: `height:${b.meanPain * 10}%` })),
        h('strong', {}, b.meanPain.toFixed(1)),
        h('span', { class: 'hint' }, b.label === 'None' ? 'None' : doseRange(f, b)), h('span', { class: 'hint' }, `${b.n} ${b.n === 1 ? 'day' : 'days'}`)))),
      h('p', { class: 'hint' }, 'Average pain for each amount.')) : null,

    h('section', { class: 'card glass stats-grid' },
      miniStat(`${a.consistency.done}/${a.consistency.days}`, 'days in the last 2 weeks'),
      f.measureType !== 'yesno' && amounts.length
        ? miniStat(fmtAmount(f, Math.round(amounts.reduce((x, y) => x + y, 0) / amounts.length)), 'on a typical day')
        : miniStat(logged[0] ? dayLabel(logged[0].date) : '–', 'last logged')),

    h('section', { class: 'card glass stack' },
      h('h2', {}, 'Settings'),
      field('Type', segmented(ROLE_OPTIONS, f.role, v => { R.factors.save(f.id, { role: v }); toast('Saved'); const next = summary(); top.replaceWith(next); top = next; }, 'Type')),
      field('Track it as', segmented(MEASURE_OPTIONS.slice(0, 3), f.measureType, v => { R.factors.save(f.id, { measureType: v }); toast('Saved'); }, 'Track it as'),
        'Past entries will show in the new format.'),
      h('button', {
        type: 'button', class: 'btn ghost', onclick: () => {
          R.factors.setArchived(f.id, !f.isArchived);
          toast(f.isArchived ? 'Back in your check-in' : 'Hidden. Past entries are kept.');
          history.back();
        },
      }, f.isArchived ? 'Show in check-ins again' : 'Hide from check-ins')));
}

// "Long sitting" reads "long sitting" mid-sentence; "TV time" stays as it is
const lower = n => (/^[A-Z][a-z]/.test(n) ? n[0].toLowerCase() + n.slice(1) : n);
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** The one sentence at the top: what the diary shows so far, in plain words. */
export function headline(f, st) {
  const n = lower(f.name);
  switch (st.state) {
    case 'none': return `You haven't logged ${n} in the last four weeks.`;
    case 'always': return `You've logged ${n} on all ${plural(st.nCheckins, 'check-in')}, so there are no days without it to compare with yet.`;
    case 'few': {
      const need = [st.need.with && `${st.need.with === 1 ? 'one more day' : `${st.need.with} more days`} with it`, st.need.without && `${st.need.without === 1 ? 'one' : st.need.without} without`].filter(Boolean).join(' and ');
      return `Logged on ${st.nWith} of ${plural(st.nCheckins, 'check-in')}. ${need[0].toUpperCase()}${need.slice(1)} and there's something to compare.`;
    }
    case 'same': return `Your pain is about the same with or without ${n}.`;
    default: {
      const gap = Math.abs(st.best.delta).toFixed(1);
      const when = st.best.lag ? `the day after ${n}` : `on days with ${n}`;
      return `Your pain is ${gap} points ${st.state === 'up' ? 'higher' : 'lower'} ${when}.`;
    }
  }
}

/** With and without, as two bars out of 10, then how many days that's from. */
function compare(f, st) {
  const b = st.best;
  const row = (label, v, cls) => h('div', { class: 'cmp-row' },
    h('span', { class: 'hint' }, label),
    h('span', { class: 'cmp-track' }, h('i', { class: cls, style: `--w:${v * 10}%` })),
    h('strong', {}, v.toFixed(1)));
  const nx = st.next;
  return h('div', { class: 'cmp' },
    h('span', { class: 'eyebrow' }, b.lag ? 'Pain the next day' : 'Average pain'),
    row('With', b.meanWith, 'with'),
    row('Without', b.meanWithout, 'without'),
    nx && Math.abs(nx.delta) >= SAME_BAND && Math.sign(nx.delta) === Math.sign(b.delta)
      ? h('p', { class: 'hint' }, `It carries into the next day too: ${nx.meanWith.toFixed(1)} after it, ${nx.meanWithout.toFixed(1)} after days without.`) : null);
}

/** Pain and this factor over the strip's days, drawn by the same chart as Home. */
function dayChart(f, st) {
  const days = st.strip.map(d => ({ date: d.date, logged: d.pain != null }));
  // Scaled to its own busiest day and left unsmoothed, so its peaks can be read against pain's
  const max = Math.max(...st.strip.map(d => d.amount), 1);
  const level = st.strip.map(d => (f.measureType === 'yesno' ? (d.amount ? 0.6 : 0) : d.amount / max));
  const series = [
    { key: 'pain', label: 'Pain', palette: PALETTES.pain, values: st.strip.map(d => (d.pain == null ? null : d.pain / 10)), format: i => `${st.strip[i].pain ?? '–'}/10` },
    { key: 'factor', label: f.name, palette: f.role === 'helper' ? PALETTES.helper : PALETTES.stressor, values: level.map(v => 0.04 + v * 0.86), format: i => (st.strip[i].amount ? fmtAmount(f, st.strip[i].amount) : 'none') },
  ];
  const hidden = new Set();
  const wrap = h('div', {});
  const draw = animate => wrap.replaceChildren(TrendChart({
    days, series, hidden, animate, fadeLeft: false,
    onToggle: key => { if (hidden.has(key)) hidden.delete(key); else hidden.add(key); draw(false); },
  }));
  draw(true);
  return wrap;
}

function doseRange(f, b) {
  const fmt = v => fmtAmount(f, Math.round(v));
  return b.max == null ? `${fmt(b.min)}+` : b.min == null ? `Under ${fmt(b.max)}` : `${fmt(b.min)}–${fmt(b.max)}`;
}

const miniStat = (v, label) => h('div', { class: 'mini-stat' }, h('span', { class: 'num' }, v), h('span', { class: 'hint' }, label));
