// Daily survey: five quick steps, aimed at under a minute, with a streak at the end.
import { h, toast, iconButton } from '../lib/ui.js';
import * as R from '../lib/repos.js';
import { localDate, addDays, dayLabel, pad, weekdayLetter } from '../lib/dates.js';
import { VSlider, FactorTile } from './controls.js';
import { Body3D, RegionList, webglAvailable } from './body3d.js';
import { quickAddFactor } from './factor.js';
import { voiceSupported, startDictation } from '../lib/voice.js';

const STEPS = [
  { id: 'pain', title: 'How much does your back hurt?', sub: 'Right now, in your back or legs. 0 is none, 10 is the worst you’ve had.' },
  { id: 'stress', title: 'How stressed were you today?', sub: 'Work, money, people, anything. 0 is calm, 10 is overwhelmed.' },
  { id: 'where', title: 'Where do you feel it most?', sub: 'Tap where it hurts.' },
  { id: 'stressors', title: 'What did you do today?', sub: 'Tap what you did. Swipe right to add time.' },
  { id: 'helpers', title: 'What did you do for your back?', sub: 'Tap anything that counts.' },
  { id: 'notes', title: 'Anything else?', sub: 'Optional.' },
];

// Drafts survive leaving the survey (e.g. to add a factor) within this session
const drafts = new Map();

// 3D body map; a plain list of regions only where the phone can't draw 3D
const has3D = webglAvailable();

function freshDraft(date) {
  const existing = R.checkins.entryFor(date);
  return {
    startedAt: Date.now(), step: 0,
    pain: existing?.painScore ?? null, stress: existing?.stressScore ?? null, sleep: existing?.sleepQuality ?? null,
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
  const timer = h('span', { class: 'timer', 'aria-hidden': 'true' });
  const body = h('div', { class: 'flow-body' });
  const footer = h('div', { class: 'flow-footer' });

  const tick = () => {
    const sec = Math.floor((Date.now() - draft.startedAt) / 1000);
    timer.textContent = `${Math.floor(sec / 60)}:${pad(sec % 60)}`;
    timer.classList.toggle('over', sec > 60);
  };
  tick();
  const iv = setInterval(tick, 1000);
  ctx.onCleanup(() => clearInterval(iv));

  const dateSelect = h('select', {
    class: 'date-pill', 'aria-label': 'Day you’re logging',
    onchange: e => { location.hash = `#/checkin?date=${e.target.value}`; },
    value: date,
  }, [0, -1, -2, -3].map(n => { const d = addDays(today, n); return h('option', { value: d }, dayLabel(d, today) + (R.checkins.entryFor(d) ? ' ✓' : '')); }));

  root.append(
    h('header', { class: 'flow-head' },
      iconButton('✕', 'Close check-in', () => { location.hash = '#/'; }),
      dateSelect, timer),
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
      h('div', { class: 'step-head' }, h('h1', { tabindex: -1 }, st.title), h('p', { class: 'muted' }, st.sub)),
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

  const isSlider = id => id === 'pain' || id === 'stress';

  /** Move to the next step after a beat, so the user sees their answer land. */
  function advanceSoon(delay) {
    const stepAtStart = draft.step;
    setTimeout(() => { if (draft.step === stepAtStart) go(stepAtStart + 1); }, delay);
  }

  function sliderStep(key, label, glyph) {
    return h('div', { class: 'levels single' }, VSlider({
      label, value: draft[key], glyph, tint: key,
      onChange: v => { draft[key] = v; },
      onCommit: () => advanceSoon(320),
    }));
  }

  function stepContent(id) {
    switch (id) {
      case 'pain': return sliderStep('pain', 'Pain', 'bolt');
      case 'stress': return sliderStep('stress', 'Stress', 'wave');
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
      case 'stressors': return factorGrid(['trigger', 'unsure'], 'trigger');
      case 'helpers': return factorGrid(['helper'], 'helper');
      case 'notes': return notesStep();
    }
  }

  function factorGrid(roles, addRole) {
    const grid = h('div', { class: 'tile-grid' });
    const fill = () => grid.replaceChildren(
      ...R.factors.forCheckin(roles, date).map(f => FactorTile({ factor: f, selections: draft.selections })),
      h('button', {
        type: 'button', class: 'tile add', onclick: async () => {
          const f = await quickAddFactor({ role: addRole });
          if (f) { draft.selections.set(f.id, f.measureType === 'yesno' ? 1 : 0); fill(); }
        },
      }, h('span', { class: 'well' }, '+'), h('span', { class: 'tile-title' }, addRole === 'helper' ? 'Add a helper' : 'Add a stressor')));
    fill();
    const yValues = R.checkins.factorValues(yesterday);
    const yForRoles = [...yValues].filter(([fid]) => { const f = R.factors.get(fid); return f && !f.isArchived && roles.includes(f.role); });
    return h('div', {},
      yForRoles.length ? h('button', {
        type: 'button', class: 'chip glass same', onclick: () => {
          for (const [fid, v] of yForRoles) draft.selections.set(fid, v);
          fill();
          toast('Copied yesterday');
        },
      }, '↺ Same as yesterday') : null,
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
    clearInterval(iv);
    root.replaceChildren(doneScreen(seconds));
  }

  function doneScreen(seconds) {
    const streak = R.checkins.streak();
    const week = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6));
    const fast = seconds <= 60;
    return h('div', { class: 'done-screen' },
      h('div', { class: 'burst', 'aria-hidden': 'true' }, Array.from({ length: 14 }, (_, i) => h('i', { style: `--a:${i * (360 / 14)}deg` }))),
      h('div', { class: 'done-ring' }, h('span', { class: 'big-num' }, String(streak)), h('span', { class: 'unit' }, streak === 1 ? 'day' : 'days')),
      h('h1', {}, streak > 1 ? `${streak}-day streak` : 'Day one'),
      h('div', { class: 'week-dots', 'aria-label': 'This week' }, week.map(d => h('span', { class: R.checkins.entryFor(d) ? 'on' : '' }, h('i'), h('small', {}, weekdayLetter(d))))),
      h('div', { class: 'stats-row' },
        stat(`${seconds}`, 's', fast ? 'Under a minute' : 'Time taken'),
        stat(draft.pain ?? '–', '/10', 'Pain'),
        stat(draft.stress ?? '–', '/10', 'Stress')),
      h('a', { class: 'btn primary wide', href: '#/' }, 'See your dashboard'));
  }

  const stat = (v, unit, label) => h('div', { class: 'stat glass' }, h('div', {}, h('span', { class: 'num' }, String(v)), h('span', { class: 'unit' }, unit)), h('span', { class: 'hint' }, label));

  render();
  return root;
}
