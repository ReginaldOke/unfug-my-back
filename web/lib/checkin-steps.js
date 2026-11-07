// Which steps the daily check-in has, and in what order. Pure, unit-tested in test/checkin-steps.test.js.
// The user can switch built-in steps off (all but pain) and add sliders of their own from the … menu.

export const BUILT_IN = [
  { id: 'pain', title: 'How much does your back hurt?', locked: true },
  { id: 'where', title: 'Where do you feel it most?', sub: 'Tap where it hurts.', name: 'Where it hurts' },
  { id: 'stress', title: 'How stressed were you today?', name: 'Stress' },
  { id: 'sleep', title: 'How did you sleep last night?', name: 'Sleep' },
  { id: 'food', title: 'How well did you eat today?', name: 'Eating' },
  { id: 'move', title: 'Exercise', sub: 'Tap what you did. Swipe for how hard or how long.', name: 'Exercise' },
  { id: 'stressors', title: 'Stressors', sub: 'Anything that might have strained your back. Swipe right to add time.', name: 'Stressors' },
  { id: 'helpers', title: 'Helpers', sub: 'Anything you did for your back.', name: 'Helpers' },
  { id: 'notes', title: 'Anything else?', sub: 'Optional.', name: 'Notes' },
];

const MAX_NAME = 40;

/** A custom slider as saved: { id, name, good: 'high' | 'low' }. Bad rows are dropped. */
export function cleanSlider(s) {
  const name = String(s?.name ?? '').trim().slice(0, MAX_NAME);
  if (!name || !/^[a-z0-9-]{1,40}$/i.test(String(s?.id ?? ''))) return null;
  return { id: String(s.id), name, good: s.good === 'low' ? 'low' : 'high' };
}

/**
 * The steps to show, in order: the built-in ones that aren't switched off, with the user's own
 * sliders just before Exercise (with the other sliders). Custom steps have ids `c:<id>`.
 */
export function checkinSteps(settings = {}) {
  const hidden = new Set(settings.checkinHidden ?? []);
  const custom = (settings.customSliders ?? []).map(cleanSlider).filter(Boolean)
    .filter(s => !hidden.has(`c:${s.id}`))
    .map(s => ({ id: `c:${s.id}`, title: s.name, name: s.name, slider: s }));
  const out = [];
  for (const st of BUILT_IN) {
    if (st.id === 'move') out.push(...custom);
    if (st.locked || !hidden.has(st.id)) out.push(st);
  }
  return out;
}

/** Sliders that advance on release (the eating step has a notes field, so it waits for Next). */
export const autoAdvances = id => id === 'pain' || id === 'stress' || id === 'sleep' || id.startsWith('c:');
export const isSliderStep = id => autoAdvances(id) || id === 'food';
