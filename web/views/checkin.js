// Daily survey: a few quick steps, with a streak at the end.
import { h, toast, iconButton } from '../lib/ui.js';
import * as R from '../lib/repos.js';
import { localDate, addDays, dayLabel, weekdayLetter } from '../lib/dates.js';
import { VSlider, FactorTile, defaultAmount, PENCIL } from './controls.js';
import { HEALTH_IMPORT } from '../lib/health.js';
import { sleepWord } from '../lib/labels.js';
import { Body3D, RegionList, webglAvailable } from './body3d.js';
import { quickAddFactor } from './factor.js';
import { voiceSupported, startDictation } from '../lib/voice.js';

const STEPS = [
  { id: 'pain', title: 'How much does your back hurt?' },
  { id: 'stress', title: 'How stressed were you today?' },
  { id: 'sleep', title: 'How did you sleep last night?' },
  { id: 'where', title: 'Where do you feel it most?', sub: 'Tap where it hurts.' },
  { id: 'move', title: 'Exercise', sub: 'Tap what you did. Swipe for how hard or how long.' },
  { id: 'stressors', title: 'Stressors', sub: 'Anything that might have strained your back. Swipe right to add time.' },
  { id: 'helpers', title: 'Helpers', sub: 'Anything you did for your back.' },
  { id: 'notes', title: 'Anything else?', sub: 'Optional.' },
];

// Drafts survive leaving the survey (e.g. to add a factor or log a routine) within this session
const drafts = new Map();

/** The check-in in progress for a date, if any (the routine log updates it rather than saving twice). */
export const checkinDraft = date => drafts.get(date);

// 3D body map; a plain list of regions only where the phone can't draw 3D
const has3D = webglAvailable();

function freshDraft(date) {
  const existing = R.checkins.entryFor(date);
  return {
    startedAt: Date.now(), step: 0,
    pain: existing?.painScore ?? null, stress: existing?.stressScore ?? null,
    sleep: existing?.sleepQuality ?? null,
    intensity: R.checkins.intensities(date),
    notes: existing?.notes ?? '',
    selections: R.checkins.factorValues(date),
    markers: existing ? R.checkins.markersFor(existing.id).map(({ regionId, side, intensity, quality, modelPoint }) => ({ regionId, side, intensity, quality, modelPoint })) : [],
  };
}

export function CheckinView(ctx) {
  const today = localDate();
  let date = ctx.params.get('date') || today;
  if (date > today || date < addDays(today, -3)) date = today;
  if (!drafts.has(date)) drafts.set(date, freshDraft(date));
  const draft = drafts.get(date);
  const existing = R.checkins.entryFor(date);
  const yesterday = addDays(date, -1);

  const root = h('div', { class: 'flow' });
  const progress = h('div', { class: 'progress', role: 'progressbar', 'aria-valuemin': 1, 'aria-valuemax': STEPS.length });
  const body = h('div', { class: 'flow-body' });
  const footer = h('div', { class: 'flow-footer' });

  const dateSelect = h('select', {
    class: 'date-pill', 'aria-label': 'Day you’re logging',
    onchange: e => { location.hash = `#/checkin?date=${e.target.value}`; },
    value: date,
  }, [0, -1, -2, -3].map(n => { const d = addDays(today, n); return h('option', { value: d }, dayLabel(d, today) + (R.checkins.entryFor(d) ? ' ✓' : '')); }));

  root.append(
    h('header', { class: 'flow-head' },
      iconButton('✕', 'Close check-in', () => { location.hash = '#/'; }),
      dateSelect, h('span', { class: 'head-spacer', 'aria-hidden': 'true' })),
    progress, body, footer);

  function go(step) {
    if (step > draft.step && STEPS[draft.step].id === 'pain' && draft.pain == null) {
      toast('Set your pain level first');
      return;
    }
    draft.step = step;
    render();
  }

  function render() {
    const st = STEPS[draft.step];
    progress.replaceChildren(...STEPS.map((_, i) => h('i', { class: i < draft.step ? 'done' : i === draft.step ? 'now' : '' })));
    progress.setAttribute('aria-valuenow', draft.step + 1);
    progress.setAttribute('aria-valuetext', `Step ${draft.step + 1} of ${STEPS.length}: ${st.title}`);
    body.replaceChildren(
      h('div', { class: 'step-head' }, h('h1', { tabindex: -1 }, st.title), st.sub ? h('p', { class: 'muted' }, st.sub) : null),
      stepContent(st.id));
    renderFooter();
    body.scrollTop = 0;
    body.querySelector('h1').focus({ preventScroll: true });
  }

  function renderFooter() {
    const st = STEPS[draft.step];
    const last = draft.step === STEPS.length - 1;
    const back = draft.step > 0 ? iconButton('‹', 'Back', () => go(draft.step - 1)) : h('span');
    // Slider steps advance on release; Next only appears when revisiting a step that already has a value
    if (isSlider(st.id)) {
      footer.replaceChildren(back, draft[st.id] == null
        ? h('span', { class: 'hint grow center' }, 'Drag the bar, then let go')
        : h('button', { type: 'button', class: 'btn primary wide', onclick: () => go(draft.step + 1) }, 'Next'));
      return;
    }
    // Body map advances on the first tap; with nothing marked, a quiet link skips it
    if (st.id === 'where' && !draft.markers.length) {
      footer.replaceChildren(back, h('button', { type: 'button', class: 'btn ghost wide', onclick: () => go(draft.step + 1) }, 'Nowhere specific ›'));
      return;
    }
    footer.replaceChildren(back,
      h('button', { type: 'button', class: 'btn primary wide', onclick: () => (last ? finish() : go(draft.step + 1)) },
        last ? (existing ? 'Update' : 'Finish') : 'Next'));
  }

  const isSlider = id => id === 'pain' || id === 'stress' || id === 'sleep';

  /** Move to the next step after a beat, so the user sees their answer land. */
  function advanceSoon(delay) {
    const stepAtStart = draft.step;
    setTimeout(() => { if (draft.step === stepAtStart) go(stepAtStart + 1); }, delay);
  }

  function sliderStep(key, label, glyph, scale = {}) {
    return h('div', { class: 'levels single' }, VSlider({
      label, value: draft[key], glyph, tint: key, colours: key === 'sleep' ? 'highIsGood' : 'highIsBad', ...scale,
      onChange: v => { draft[key] = v; },
      onCommit: () => advanceSoon(320),
    }));
  }

  function stepContent(id) {
    switch (id) {
      case 'pain': return sliderStep('pain', 'Pain', 'bolt');
      case 'stress': return sliderStep('stress', 'Stress', 'wave');
      case 'sleep': return h('div', { class: 'sleep-step' }, sliderStep('sleep', 'Sleep', 'moon', { describe: sleepWord }), healthStrip('sleep'));
      case 'where': {
        const yEntry = R.checkins.entryFor(yesterday);
        const yMarkers = yEntry ? R.checkins.markersFor(yEntry.id) : [];
        // Revisiting with spots already marked: let them add or edit without being whisked away
        const revisit = draft.markers.length > 0;
        const opts = {
          markers: draft.markers, defaultIntensity: () => draft.pain ?? 5, onChange: renderFooter,
          onAdd: () => { if (!revisit) advanceSoon(650); },
        };
        const map = has3D ? Body3D(opts) : RegionList(opts);
        return h('div', {},
          yMarkers.length ? h('div', { class: 'map-tools' },
            h('button', { type: 'button', class: 'chip glass', onclick: () => { map.setMarkers(yMarkers); toast('Same spots as yesterday'); advanceSoon(650); } }, '↺ Same as yesterday')) : null,
          map);
      }
      case 'move': {
        const ids = [...R.routines.all().map(r => r.linkedFactorId), ...R.factors.forCheckin([], { exercise: true }).map(f => f.id)];
        return h('div', { class: 'stack' }, sameAsYesterday(ids), healthStrip('steps'), routinesSection(), factorGrid([], { exercise: true, label: 'Other exercise', same: false }));
      }
      case 'stressors': return factorGrid(['trigger', 'unsure'], { role: 'trigger' });
      case 'helpers': return factorGrid(['helper'], { role: 'helper' });
      case 'notes': return notesStep();
    }
  }

  /** The day's steps or last night's hours asleep from Apple Health, or a way to bring them in. */
  function healthStrip(kind) {
    if (!HEALTH_IMPORT) return null;
    const [key, icon, fmt, ask] = kind === 'sleep'
      ? ['sleepHours', '🛌', v => [h('strong', {}, `${v} h`), ' asleep'], 'Show your sleep here']
      : ['steps', '👟', v => [h('strong', {}, v.toLocaleString()), ' steps'], 'Show your steps here'];
    const v = R.health.day(date)?.[key];
    if (v != null) {
      return h('div', { class: 'steps-strip glass' },
        h('span', { class: 'well', 'aria-hidden': 'true' }, icon),
        h('span', { class: 'grow' }, fmt(v)),
        h('span', { class: 'hint' }, 'Apple Health'));
    }
    return R.health.has(key) ? null : h('a', { class: 'steps-strip link', href: '#/health' },
      h('span', { class: 'well', 'aria-hidden': 'true' }, icon),
      h('span', { class: 'grow' }, ask),
      h('span', { class: 'hint' }, 'Apple Health ›'));
  }

  /** Your routines first: tick the one you did, swipe for how hard, Edit to log that day's session. */
  function routinesSection() {
    const list = R.routines.all();
    const back = encodeURIComponent(date);
    const tiles = list.map(r => FactorTile({
      factor: R.routines.factorFor(r), title: R.routineLabel(r), selections: draft.selections, intensities: draft.intensity,
      action: h('a', { class: 'well action tile-action', href: `#/routine/${r.id}?date=${back}&from=checkin`, 'aria-label': `Edit ${R.routineLabel(r)} for this day`, title: 'Edit' }, PENCIL()),
    }));
    return h('div', { class: 'stack tight' },
      h('h3', { class: 'section-label' }, 'Routines'),
      h('div', { class: 'tile-grid' }, tiles,
        h('a', { class: 'tile add routine-add', href: `#/routine/new?from=checkin&date=${back}` },
          h('span', { class: 'well' }, '+'),
          h('span', { class: 'tile-title' }, list.length ? 'New routine' : 'Add your routine'),
          list.length ? null : h('span', { class: 'tile-hint' }, 'Gym, stretching, anything you repeat'))));
  }

  /** Copies yesterday's amounts (and how hard) for these items, if yesterday had any of them. */
  function sameAsYesterday(ids) {
    const want = new Set(ids);
    const yValues = [...R.checkins.factorValues(yesterday)].filter(([fid]) => want.has(fid));
    if (!yValues.length) return null;
    const yIntensity = R.checkins.intensities(yesterday);
    return h('button', {
      type: 'button', class: 'chip glass same', onclick: () => {
        for (const [fid, v] of yValues) {
          draft.selections.set(fid, v);
          if (yIntensity.has(fid)) draft.intensity.set(fid, yIntensity.get(fid));
        }
        render();
        toast('Copied yesterday');
      },
    }, '↺ Same as yesterday');
  }

  function factorGrid(roles, { role = 'helper', exercise = false, label = null, same = true }) {
    const grid = h('div', { class: 'tile-grid' });
    const intensities = exercise ? draft.intensity : null;
    const fill = () => grid.replaceChildren(
      ...R.factors.forCheckin(roles, { exercise }).map(f => FactorTile({ factor: f, selections: draft.selections, intensities })),
      h('button', {
        type: 'button', class: 'tile add', onclick: async () => {
          const added = await quickAddFactor({ role, exercise });
          for (const f of added) draft.selections.set(f.id, defaultAmount(f));
          if (added.length) fill();
        },
      }, h('span', { class: 'well' }, '+'), h('span', { class: 'tile-title' }, exercise ? 'Add exercise' : role === 'helper' ? 'Add a helper' : 'Add a stressor')));
    fill();
    return h('div', { class: label ? 'stack tight' : '' },
      label ? h('h3', { class: 'section-label' }, label) : null,
      same ? sameAsYesterday(R.factors.forCheckin(roles, { exercise }).map(f => f.id)) : null,
      grid);
  }

  function notesStep() {
    const ta = h('textarea', {
      class: 'notes glass', rows: 5, placeholder: 'e.g. Carried boxes all afternoon. Sore after the long drive.',
      'aria-label': 'Notes about today', oninput: e => { draft.notes = e.target.value; },
    }, draft.notes);
    let stop = null;
    const live = h('p', { class: 'hint', 'aria-live': 'polite' });
    const mic = h('button', {
      type: 'button', class: 'mic', 'aria-pressed': 'false', 'aria-label': 'Record a voice note',
      onclick: () => {
        if (stop) { stop(); return; }
        const before = draft.notes ? `${draft.notes.trimEnd()} ` : '';
        mic.classList.add('rec');
        mic.setAttribute('aria-pressed', 'true');
        live.textContent = 'Listening…';
        stop = startDictation({
          onText: (final, interim) => { draft.notes = before + final; ta.value = draft.notes + interim; },
          onEnd: err => {
            stop = null;
            mic.classList.remove('rec');
            mic.setAttribute('aria-pressed', 'false');
            ta.value = draft.notes;
            live.textContent = err === 'not-allowed' ? 'Microphone access was blocked.' : err ? 'Voice note stopped.' : '';
          },
        });
      },
    }, h('span', { 'aria-hidden': 'true' }, '●'));
    ctx.onCleanup(() => stop?.());
    return h('div', { class: 'stack' }, ta,
      voiceSupported ? h('div', { class: 'mic-row' }, mic, h('span', { class: 'muted' }, 'Tap to talk, tap again to stop'))
        : h('p', { class: 'hint' }, 'Voice notes need Chrome or Safari.'),
      live);
  }

  function finish() {
    const seconds = Math.round((Date.now() - draft.startedAt) / 1000);
    R.checkins.save(date, { ...draft, durationSeconds: seconds });
    drafts.delete(date);
    root.replaceChildren(doneScreen());
  }

  function doneScreen() {
    const streak = R.checkins.streak();
    const week = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6));
    return h('div', { class: 'done-screen' },
      h('div', { class: 'burst', 'aria-hidden': 'true' }, Array.from({ length: 14 }, (_, i) => h('i', { style: `--a:${i * (360 / 14)}deg` }))),
      h('div', { class: 'done-ring' }, h('span', { class: 'big-num' }, String(streak)), h('span', { class: 'unit' }, streak === 1 ? 'day' : 'days')),
      h('h1', {}, streak > 1 ? `${streak}-day streak` : 'Day one'),
      h('div', { class: 'week-dots', 'aria-label': 'This week' }, week.map(d => h('span', { class: R.checkins.entryFor(d) ? 'on' : '' }, h('i'), h('small', {}, weekdayLetter(d))))),
      h('div', { class: 'stats-row' },
        stat(draft.pain ?? '–', '/10', 'Pain'),
        stat(draft.stress ?? '–', '/10', 'Stress'),
        stat(draft.sleep ?? '–', '/10', 'Sleep')),
      h('a', { class: 'btn primary wide', href: '#/' }, 'See your dashboard'));
  }

  const stat = (v, unit, label) => h('div', { class: 'stat glass' }, h('div', {}, h('span', { class: 'num' }, String(v)), h('span', { class: 'unit' }, unit)), h('span', { class: 'hint' }, label));

  render();
  return root;
}
