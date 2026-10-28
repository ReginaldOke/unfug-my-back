// Liquid-glass controls modelled on the iOS 26 Control Center kit in the Figma file:
// vertical fill slider (Slider 1×2), swipeable factor tile (Label 2×2), pill toggle (Label 2×1).
import { h, clamp, vibrate } from '../lib/ui.js';
import { ROLE_ICON, fmtAmount } from '../lib/labels.js';
import * as R from '../lib/repos.js';

const GLYPHS = {
  bolt: '<svg viewBox="0 0 24 24" width="26" height="26"><path d="M13.5 2 5 13.5h6L10 22l9-12h-6.2L13.5 2Z" fill="currentColor"/></svg>',
  wave: '<svg viewBox="0 0 24 24" width="26" height="26"><path d="M2 12c2.2-4.5 4.3-4.5 6.5 0s4.3 4.5 6.5 0 4.3-4.5 6.5 0" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>',
};

/**
 * Control Center slider (Figma "Slider 1×2"): a glass capsule with a light fill and one glyph.
 * The fill tracks the finger continuously and settles on the whole number when released.
 * value may be null (not set yet).
 */
export function VSlider({ label, value = null, onChange, onCommit = () => {}, glyph = 'bolt' }) {
  const max = 10;
  const num = h('span', { class: 'vs-num' });
  const fill = h('div', { class: 'vs-fill', 'aria-hidden': 'true' });
  const icon = h('span', { class: 'vs-glyph', 'aria-hidden': 'true' });
  icon.innerHTML = GLYPHS[glyph];
  const track = h('div', {
    class: 'vslider', role: 'slider', tabindex: 0, 'aria-label': label,
    'aria-valuemin': 0, 'aria-valuemax': max,
  }, fill, icon);

  const paint = frac => { fill.style.transform = `scaleY(${frac})`; };

  function setValue(v, fromUser) {
    const changed = v !== value;
    value = v;
    num.textContent = v == null ? '–' : String(v);
    track.setAttribute('aria-valuenow', v ?? '');
    track.setAttribute('aria-valuetext', v == null ? 'Not set' : `${v} out of 10`);
    if (fromUser && changed) {
      vibrate(4);
      num.animate?.([{ transform: 'scale(1.1)' }, { transform: 'scale(1)' }], { duration: 180, easing: 'ease-out' });
      onChange(v);
    }
  }

  const fracAt = e => {
    const r = track.getBoundingClientRect();
    return clamp((r.bottom - e.clientY) / r.height, 0, 1);
  };
  const drag = e => {
    const frac = fracAt(e);
    paint(frac);
    setValue(Math.round(frac * max), true);
  };
  track.addEventListener('pointerdown', e => {
    track.setPointerCapture(e.pointerId);
    track.classList.add('dragging');
    drag(e);
  });
  track.addEventListener('pointermove', e => { if (track.hasPointerCapture(e.pointerId)) drag(e); });
  const release = () => {
    track.classList.remove('dragging');
    if (value != null) paint(value / max); // settle onto the whole number
  };
  // Letting go commits the value (the survey uses this to move on)
  track.addEventListener('pointerup', () => { release(); if (value != null) onCommit(value); });
  track.addEventListener('pointercancel', release);
  track.addEventListener('keydown', e => {
    if (e.key === 'Enter' && value != null) { e.preventDefault(); onCommit(value); return; }
    const step = { ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1 }[e.key];
    let next = null;
    if (step) next = clamp((value ?? 0) + step, 0, max);
    if (e.key === 'Home') next = 0;
    if (e.key === 'End') next = max;
    if (next == null) return;
    e.preventDefault();
    setValue(next, true);
    paint(next / max);
  });

  setValue(value, false);
  // Entrance: the capsule springs in, then an existing value fills up from empty
  paint(0);
  requestAnimationFrame(() => requestAnimationFrame(() => { if (value != null) paint(value / max); }));

  return h('div', { class: 'vslider-wrap' },
    h('div', { class: 'vs-readout' }, num, h('span', { class: 'vs-unit' }, '/10')),
    track,
    h('div', { class: 'vs-label' }, label));
}

// 0–60 min in 5s, then 75 min–8 h in 15s, so short and long days both get usable precision.
const MINUTE_STEPS = [...Array.from({ length: 13 }, (_, i) => i * 5), ...Array.from({ length: 28 }, (_, i) => 75 + i * 15)];
const nearestIndex = v => MINUTE_STEPS.reduce((best, s, i) => (Math.abs(s - v) < Math.abs(MINUTE_STEPS[best] - v) ? i : best), 0);

export function scaleFor(f) {
  if (f.measureType === 'minutes') {
    const n = MINUTE_STEPS.length - 1;
    return { fraction: v => nearestIndex(v) / n, fromFraction: fr => MINUTE_STEPS[Math.round(fr * n)], step: (v, d) => MINUTE_STEPS[clamp(nearestIndex(v) + d, 0, n)] };
  }
  const max = f.measureType === 'rating' ? 10 : 30;
  return { fraction: v => Math.min(1, v / max), fromFraction: fr => Math.round(fr * max), step: (v, d) => clamp(v + d, 0, Math.max(max, v)) };
}

export function defaultAmount(f) {
  return R.factors.lastValue(f.id) ?? { minutes: 30, count: 1, rating: 5, yesno: 1 }[f.measureType];
}

/**
 * Factor tile for the daily survey. Tap selects; swipe sideways sets how much (the fill grows with it).
 * touch-action: pan-y keeps vertical page scrolling with the browser while horizontal drags come to us.
 */
export function FactorTile({ factor: f, selections, onChange = () => {} }) {
  const scale = scaleFor(f);
  const fill = h('div', { class: 'tile-fill', 'aria-hidden': 'true' });
  const valueBtn = h('button', { type: 'button', class: 'tile-value', 'aria-label': `Type exact amount for ${f.name}` });
  const hint = h('span', { class: 'tile-hint' });
  const el = h('div', { class: `tile factor role-${f.role}`, role: 'button', tabindex: 0 },
    fill,
    h('div', { class: 'tile-top' },
      h('span', { class: 'well', 'aria-hidden': 'true' }, f.icon || ROLE_ICON[f.role]),
      h('span', { class: 'role-mark', 'aria-hidden': 'true' }, ROLE_ICON[f.role])),
    h('div', { class: 'tile-bottom' }, h('span', { class: 'tile-title' }, f.name), h('span', { class: 'tile-detail' }, valueBtn, hint)));

  function paint() {
    const on = selections.has(f.id), v = selections.get(f.id);
    el.classList.toggle('on', on);
    el.setAttribute('aria-pressed', String(on));
    fill.style.transform = `scaleX(${!on ? 0 : f.measureType === 'yesno' ? 1 : Math.max(0.06, scale.fraction(v))})`;
    valueBtn.textContent = on ? fmtAmount(f, v) : '';
    valueBtn.hidden = !on || f.measureType === 'yesno';
    hint.textContent = on ? (f.measureType === 'yesno' ? 'Yes' : '') : f.measureType === 'yesno' ? 'Tap' : 'Tap or swipe →';
    el.setAttribute('aria-label', `${f.name}, ${on ? fmtAmount(f, v) : 'not selected'}${f.measureType === 'yesno' ? '' : '. Use arrow keys to change the amount.'}`);
  }

  function setValue(v) {
    if (v > 0) selections.set(f.id, v); else selections.delete(f.id);
    paint();
    onChange();
  }

  function toggle() {
    if (selections.has(f.id)) selections.delete(f.id);
    else selections.set(f.id, defaultAmount(f));
    vibrate(6);
    paint();
    onChange();
  }

  let start = null, dragging = false;
  el.addEventListener('pointerdown', e => {
    if (e.target === valueBtn || e.target.closest('input')) return;
    start = { x: e.clientX, y: e.clientY, v: selections.get(f.id) ?? 0, w: el.getBoundingClientRect().width };
    dragging = false;
  });
  el.addEventListener('pointermove', e => {
    if (!start || f.measureType === 'yesno') return;
    const dx = e.clientX - start.x, dy = e.clientY - start.y;
    if (!dragging) {
      if (Math.abs(dx) < 8 || Math.abs(dx) < Math.abs(dy)) return;
      dragging = true;
      el.setPointerCapture(e.pointerId);
      el.classList.add('dragging');
    }
    const next = scale.fromFraction(clamp(scale.fraction(start.v) + dx / start.w, 0, 1));
    if (next !== (selections.get(f.id) ?? 0)) { vibrate(3); setValue(next); }
  });
  el.addEventListener('pointerup', () => {
    if (start && !dragging) toggle();
    start = null; dragging = false;
    el.classList.remove('dragging');
  });
  el.addEventListener('pointercancel', () => { start = null; dragging = false; el.classList.remove('dragging'); });
  el.addEventListener('keydown', e => {
    if (e.target !== el) return;
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); }
    const d = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1 }[e.key];
    if (d && f.measureType !== 'yesno') { e.preventDefault(); setValue(scale.step(selections.get(f.id) ?? 0, d)); }
  });

  // Tap the number to type an exact value
  valueBtn.addEventListener('click', e => {
    e.stopPropagation();
    const input = h('input', { type: 'number', inputmode: 'numeric', min: 0, class: 'tile-input', value: selections.get(f.id), 'aria-label': `${f.name} amount${f.measureType === 'minutes' ? ' in minutes' : ''}` });
    const commit = () => { setValue(Math.max(0, Math.round(Number(input.value) || 0))); input.replaceWith(valueBtn); };
    input.addEventListener('blur', commit);
    input.addEventListener('keydown', ev => { if (ev.key === 'Enter') input.blur(); });
    input.addEventListener('pointerdown', ev => ev.stopPropagation());
    valueBtn.replaceWith(input);
    input.focus();
    input.select();
  });

  paint();
  el.refresh = paint;
  return el;
}

/** Pill toggle (Label 2×1): symbol well, title, detail. */
export function PillToggle({ icon, title, detail, on, onToggle, tone = 'red' }) {
  const el = h('button', { type: 'button', class: `pill-toggle tone-${tone}`, 'aria-pressed': String(on) },
    h('span', { class: 'well', 'aria-hidden': 'true' }, icon),
    h('span', { class: 'pill-text' }, h('span', { class: 'pill-title' }, title), detail ? h('span', { class: 'pill-detail' }, detail) : null));
  el.addEventListener('click', () => {
    on = !on;
    el.setAttribute('aria-pressed', String(on));
    vibrate(5);
    onToggle(on);
  });
  return el;
}

/** Selectable glass card for setup lists: icon well, tick, title, detail. */
export function SelectCard({ icon, title, detail, on, onToggle }) {
  const el = h('button', { type: 'button', class: 'select-card', 'aria-pressed': String(on) },
    h('span', { class: 'card-top' },
      h('span', { class: 'well', 'aria-hidden': 'true' }, icon),
      h('span', { class: 'tick', 'aria-hidden': 'true' }, '✓')),
    h('span', { class: 'card-text' }, h('span', { class: 'card-title' }, title), detail ? h('span', { class: 'card-detail' }, detail) : null));
  el.addEventListener('click', () => {
    on = !on;
    el.setAttribute('aria-pressed', String(on));
    vibrate(5);
    onToggle(on);
  });
  return el;
}

/** Tick-mark ruler (minimal data vis): `value` of `max` ticks lit, red past `alertAt`. */
export function Ruler({ value, max, alertAt = max, count = 30 }) {
  const lit = Math.round((Math.min(value, max) / max) * count);
  return h('div', { class: 'ruler', 'aria-hidden': 'true' },
    Array.from({ length: count }, (_, i) => h('i', { class: i < lit ? (value >= alertAt ? 'lit alert' : 'lit') : '' })));
}
