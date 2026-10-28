// Month calendar of pain: each checked-in day is a dot tinted by its pain score.
import { h } from '../lib/ui.js';
import { localDate, parseDate, pad } from '../lib/dates.js';
import * as R from '../lib/repos.js';

// Pain colour: muted green at 0, through yellow at 5, to red at 10, soft enough for white numbers on top
export const painColour = p => `hsla(${Math.round(p <= 5 ? 135 - p * 17 : 50 - (p - 5) * 9.6)}, 60%, ${p >= 3 && p <= 6 ? 50 : 46}%, 0.88)`;

/** month: 'YYYY-MM'. onMonth(month) moves; selected/onSelect: the day shown under the grid. */
export function PainCalendar({ month, onMonth, selected = null, onSelect }) {
  const today = localDate();
  const [y, m] = month.split('-').map(Number);
  const first = new Date(y, m - 1, 1);
  const daysIn = new Date(y, m, 0).getDate();
  const lead = (first.getDay() + 6) % 7; // Monday first
  const shift = n => { const d = new Date(y, m - 1 + n, 1); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; };
  const thisMonth = today.slice(0, 7);

  // Routine changes: a small dot under the day, explained when the day is tapped
  const changes = R.routines.changesByDate();
  const cells = [];
  for (let i = 0; i < lead; i++) cells.push(h('span', { class: 'cal-cell empty', 'aria-hidden': 'true' }));
  const logged = [];
  for (let d = 1; d <= daysIn; d++) {
    const date = `${month}-${pad(d)}`;
    const e = R.checkins.entryFor(date);
    if (e?.painScore != null) logged.push(e.painScore);
    const change = changes.get(date);
    const cls = ['cal-cell', e ? 'logged' : '', change ? 'changed' : '', date === today ? 'today' : '', date > today ? 'future' : '', date === selected ? 'sel' : ''].filter(Boolean).join(' ');
    cells.push(h('button', {
      type: 'button', class: cls, disabled: date > today,
      style: e?.painScore != null ? `--dot:${painColour(e.painScore)}` : null,
      'aria-label': `${parseDate(date).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}${e ? `, pain ${e.painScore}` : ', no check-in'}${change ? ', routine changed' : ''}`,
      'aria-pressed': String(date === selected),
      onclick: () => onSelect(date === selected ? null : date),
    }, h('span', {}, String(d))));
  }

  const avg = logged.length ? (logged.reduce((a, b) => a + b, 0) / logged.length).toFixed(1) : null;
  return h('div', { class: 'cal' },
    h('div', { class: 'cal-head' },
      h('button', { type: 'button', class: 'cal-nav', 'aria-label': 'Previous month', onclick: () => onMonth(shift(-1)) }, '‹'),
      h('strong', {}, first.toLocaleDateString(undefined, { month: 'long', year: y === new Date().getFullYear() ? undefined : 'numeric' })),
      h('button', { type: 'button', class: 'cal-nav', 'aria-label': 'Next month', disabled: month >= thisMonth, onclick: () => onMonth(shift(1)) }, '›')),
    h('div', { class: 'cal-grid', role: 'group', 'aria-label': 'Pain by day' },
      ['M', 'T', 'W', 'T', 'F', 'S', 'S'].map(l => h('span', { class: 'cal-dow', 'aria-hidden': 'true' }, l)),
      cells),
    selected ? dayDetail(selected, changes.get(selected)) : h('div', { class: 'cal-foot' },
      h('span', { class: 'hint' }, avg ? `${logged.length} check-in${logged.length === 1 ? '' : 's'} · avg pain ${avg}` : 'No check-ins this month',
        [...changes.keys()].some(d => d.startsWith(month)) ? h('span', { class: 'cal-key-change' }, 'Routine change') : null),
      h('span', { class: 'cal-scale', 'aria-hidden': 'true' }, h('small', {}, 'Low'), [0, 3, 5, 7, 10].map(p => h('i', { style: `background:${painColour(p)}` })), h('small', {}, 'High'))));
}

function dayDetail(date, change) {
  const e = R.checkins.entryFor(date);
  const sleep = R.checkins.sleepFor(date), hours = R.health.day(date)?.sleepHours, steps = R.health.day(date)?.steps;
  const label = parseDate(date).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
  const bits = e ? [`Pain ${e.painScore}`, e.stressScore != null ? `Stress ${e.stressScore}` : null] : ['No check-in'];
  if (sleep != null || hours != null) bits.push(`Sleep ${[sleep != null ? `${sleep}/10` : null, hours != null ? `${hours} h` : null].filter(Boolean).join(', ')}`);
  if (steps != null) bits.push(`${steps.toLocaleString()} steps`);
  return h('div', { class: 'cal-foot' },
    h('span', {}, h('strong', {}, label), h('span', { class: 'hint' }, ` · ${bits.filter(Boolean).join(' · ')}`),
      change ? h('span', { class: 'cal-change-note' }, change.map(c => `${c.name}: ${c.summary}`).join(' · ')) : null),
    date >= localDate(new Date(Date.now() - 3 * 86_400_000)) ? h('a', { class: 'chip glass', href: `#/checkin?date=${date}` }, e ? 'Edit' : 'Check in') : null);
}
