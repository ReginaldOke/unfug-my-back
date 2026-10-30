// Check-ins: every past check-in, newest first, with today's button by the thumb until it's done;
// and a page per check-in that sets out everything logged that day (all of it goes into the export).
import { h, iconButton } from '../lib/ui.js';
import * as R from '../lib/repos.js';
import { localDate, dayLabel, parseDate, fmtTime, fmtMinutes } from '../lib/dates.js';
import { fmtAmount, sleepWord, ROLE_ICON } from '../lib/labels.js';
import { regionById } from '../lib/regions.js';
import { painColour } from './calendar.js';
import { PENCIL, INTENSITY } from './controls.js';

export function CheckinsView() {
  const today = localDate();
  const entries = R.checkins.all().reverse();
  // Nothing to list yet: the tab goes straight to the first check-in
  if (!entries.length) { location.replace('#/checkin'); return h('div'); }
  const doneToday = entries[0]?.date === today;

  // Grouped by month, the month named once above its days
  const groups = new Map();
  for (const e of entries) {
    const month = parseDate(e.date).toLocaleDateString(undefined, { month: 'long', year: e.date.slice(0, 4) === today.slice(0, 4) ? undefined : 'numeric' });
    if (!groups.has(month)) groups.set(month, []);
    groups.get(month).push(e);
  }

  return h('div', { class: `view checkins-view${doneToday ? '' : ' has-dock'}` },
    h('header', { class: 'top-bar' }, h('h1', {}, 'Check-ins')),
    [...groups].map(([month, list]) => h('section', { class: 'checkin-group' },
      h('h2', { class: 'section-label' }, month),
      h('div', { class: 'card glass checkin-list' }, list.map(e => checkinRow(e, today))))),
    // Today's check-in waits just above the tab bar, where the thumb is
    doneToday ? null : h('div', { class: 'checkin-dock' }, h('a', { class: 'btn primary big wide hero-cta', href: '#/checkin' }, 'Check in')));
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
  return h('a', { class: 'checkin-row', href: `#/checkins/${e.date}`, 'aria-label': `${when}: pain ${e.painScore} out of 10. Open` },
    h('span', { class: 'checkin-dot', style: `--dot:${c.light};--dot2:${c.deep}` }, String(e.painScore)),
    h('span', { class: 'grow' },
      h('span', { class: 'checkin-when' }, when,
        h('span', { class: 'hint' }, [e.stressScore != null ? `Stress ${e.stressScore}` : null, e.sleepQuality != null ? `Sleep ${e.sleepQuality}` : null].filter(Boolean).join(' · '))),
      detail ? h('span', { class: 'hint block checkin-detail' }, detail) : null),
    h('span', { class: 'chev', 'aria-hidden': 'true' }, '›'));
}

// ---------- One check-in, set out to read ----------

const editHref = (date, step) => `#/checkin?date=${date}&from=detail${step ? `&step=${step}` : ''}`;

/** A titled section (a label and hairline rows, no card); its pencil opens the check-in at the step that changes it. */
function block(title, date, step, ...children) {
  const edit = step ? h('a', { class: 'block-edit', href: editHref(date, step), 'aria-label': `Edit ${title.toLowerCase()}` }, PENCIL()) : null;
  return h('section', { class: 'detail-block' }, h('div', { class: 'detail-head' }, h('h2', { class: 'section-label' }, title), edit), h('div', { class: 'detail-body' }, ...children));
}

const lineRow = (lead, name, value, sub) => h('div', { class: 'detail-row' },
  lead ? h('span', { class: 'detail-lead', 'aria-hidden': 'true' }, lead) : null,
  h('span', { class: 'grow' }, name, sub ? h('span', { class: 'hint block' }, sub) : null),
  value != null ? h('span', { class: 'detail-value' }, value) : null);

export function CheckinDetailView(ctx) {
  const date = ctx.args[0];
  const e = R.checkins.entryFor(date);
  const back = iconButton('‹', 'Back', () => { location.hash = '#/checkins'; });
  const title = parseDate(date).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
  if (!e) {
    return h('div', { class: 'view checkin-detail' },
      h('header', { class: 'top-bar' }, back, h('span')),
      h('h1', {}, title), h('p', { class: 'muted' }, 'No check-in on this day.'));
  }

  // The three scores, each in its own colour
  const c = painColour(e.painScore);
  const score = (label, v, extra, style) => h('div', { class: 'detail-score' },
    h('span', { class: 'detail-num', style }, v ?? '–', h('small', {}, '/10')), h('span', { class: 'hint' }, extra ? `${label} · ${extra}` : label));

  // Everything logged that day, split as the check-in splits it
  const values = R.checkins.factorValues(date), levels = R.checkins.intensities(date);
  const logged = [...values].map(([id, v]) => ({ f: R.factors.get(id), v, lvl: levels.get(id) })).filter(x => x.f);
  const factorRows = list => list.map(({ f, v, lvl }) => lineRow(f.icon || ROLE_ICON[f.role], f.name,
    f.measureType === 'yesno' ? null : fmtAmount(f, v), lvl ? INTENSITY[Math.round(lvl)] : null));
  const sessions = R.routines.all().map(r => ({ r, s: R.routines.sessionOn(r.id, date) })).filter(x => x.s);
  // A routine with a logged session shows with its moves below, so not twice
  const exercise = logged.filter(x => x.f.category === 'exercise' && !sessions.some(({ r }) => r.linkedFactorId === x.f.id));
  const stressors = logged.filter(x => x.f.category !== 'exercise' && x.f.role !== 'helper');
  const helpers = logged.filter(x => x.f.category !== 'exercise' && x.f.role === 'helper');

  const markers = R.checkins.markersFor(e.id);
  const health = R.health.day(date);
  const flares = R.flares.onDate(date);
  const changes = R.routines.changesByDate().get(date) ?? [];

  return h('div', { class: 'view checkin-detail' },
    h('header', { class: 'top-bar' }, back, h('a', { class: 'btn glass small', href: editHref(date) }, 'Edit')),
    h('h1', {}, title),
    h('section', { class: 'detail-scores' },
      score('Pain', e.painScore, null, `--dot:${c.light};--dot2:${c.deep}`),
      score('Stress', e.stressScore),
      score('Sleep', e.sleepQuality, e.sleepQuality != null ? sleepWord(e.sleepQuality) : null)),

    block('Where it hurt', date, 'where', markers.length
      ? markers.map(m => lineRow(null, regionById[m.regionId]?.displayName ?? m.regionId, m.intensity != null ? `${m.intensity}/10` : null, m.quality ? m.quality[0].toUpperCase() + m.quality.slice(1) : null))
      : h('p', { class: 'hint' }, 'Nowhere specific')),

    exercise.length || sessions.length ? block('Exercise', date, 'move',
      factorRows(exercise),
      sessions.map(({ r, s }) => h('div', { class: 'detail-session' },
        lineRow(R.routineIcon(r), R.routineLabel(r), s.times > 1 ? `${s.times}×` : null, s.intensity ? INTENSITY[Math.round(s.intensity)] : null),
        s.log?.length ? h('ul', { class: 'detail-moves' }, s.log.map(x => h('li', {}, h('span', {}, x.name), h('span', { class: 'hint' }, [x.did === '✓' ? '' : x.did, x.extra].filter(Boolean).join(' · '))))) : null))) : null,

    block('Stressors', date, 'stressors', stressors.length ? factorRows(stressors) : h('p', { class: 'hint' }, 'None logged')),
    block('Helpers', date, 'helpers', helpers.length ? factorRows(helpers) : h('p', { class: 'hint' }, 'None logged')),

    health && (health.steps != null || health.sleepHours != null) ? block('Apple Health', date, null,
      health.steps != null ? lineRow('👟', 'Steps', health.steps.toLocaleString()) : null,
      health.sleepHours != null ? lineRow('🛌', health.inBed ? 'In bed' : 'Asleep', fmtMinutes(health.sleepHours * 60)) : null) : null,

    flares.length ? block('Flares', date, null, flares.map(f => lineRow('⚡', fmtTime(f.timestamp), f.intensity != null ? `${f.intensity}/10` : null, f.notes || null))) : null,

    changes.length ? block('Routine changes', date, null, changes.map(ch => lineRow(null, ch.name, null, ch.summary))) : null,

    block('Notes', date, 'notes', e.notes ? h('p', { class: 'detail-notes' }, e.notes) : h('p', { class: 'hint' }, 'No notes')));
}
