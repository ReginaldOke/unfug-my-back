// Check-ins: a big button for today's (until it's done), then every past check-in, newest first.
import { h } from '../lib/ui.js';
import * as R from '../lib/repos.js';
import { localDate, dayLabel, parseDate } from '../lib/dates.js';
import { fmtAmount } from '../lib/labels.js';
import { regionById } from '../lib/regions.js';
import { painColour } from './calendar.js';

export function CheckinsView() {
  const today = localDate();
  const entries = R.checkins.all().reverse();
  const doneToday = entries[0]?.date === today;

  // Grouped by month, the month named once above its days
  const groups = new Map();
  for (const e of entries) {
    const month = parseDate(e.date).toLocaleDateString(undefined, { month: 'long', year: e.date.slice(0, 4) === today.slice(0, 4) ? undefined : 'numeric' });
    if (!groups.has(month)) groups.set(month, []);
    groups.get(month).push(e);
  }

  return h('div', { class: 'view checkins-view' },
    h('header', { class: 'top-bar' }, h('h1', {}, 'Check-ins')),
    doneToday ? null : h('a', { class: 'btn primary big wide checkin-cta', href: '#/checkin' }, 'Check in'),
    entries.length ? null : h('p', { class: 'hint center' }, 'Each check-in you do is kept here.'),
    [...groups].map(([month, list]) => h('section', { class: 'checkin-group' },
      h('h2', { class: 'section-label' }, month),
      h('div', { class: 'card glass checkin-list' }, list.map(e => checkinRow(e, today))))));
}

function checkinRow(e, today) {
  const c = painColour(e.painScore);
  // What else went in: where it hurt, then what was logged, kept to a line
  const where = [...new Set(R.checkins.markersFor(e.id).map(m => regionById[m.regionId]?.displayName).filter(Boolean))];
  const logged = [...R.checkins.factorValues(e.date)].map(([id, v]) => {
    const f = R.factors.get(id);
    return f && !f.isArchived ? (f.measureType === 'yesno' ? f.name : `${f.name} ${fmtAmount(f, v)}`) : null;
  }).filter(Boolean);
  const detail = [...where, ...logged].join(' · ') || e.notes || '';
  const when = e.date === today ? 'Today' : dayLabel(e.date);
  return h('a', { class: 'checkin-row', href: `#/checkin?date=${e.date}`, 'aria-label': `${when}: pain ${e.painScore} out of 10. Open` },
    h('span', { class: 'checkin-dot', style: `--dot:${c.light};--dot2:${c.deep}` }, String(e.painScore)),
    h('span', { class: 'grow' },
      h('span', { class: 'checkin-when' }, when,
        h('span', { class: 'hint' }, [e.stressScore != null ? `Stress ${e.stressScore}` : null, e.sleepQuality != null ? `Sleep ${e.sleepQuality}` : null].filter(Boolean).join(' · '))),
      detail ? h('span', { class: 'hint block checkin-detail' }, detail) : null),
    h('span', { class: 'chev', 'aria-hidden': 'true' }, '›'));
}
