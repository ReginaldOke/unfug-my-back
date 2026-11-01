// Liquid-glass controls modelled on the iOS 26 Control Center kit in the Figma file:
// vertical fill slider (Slider 1×2), swipeable factor tile (Label 2×2), pill toggle (Label 2×1).
import { h, clamp, vibrate } from '../lib/ui.js';
import { ROLE_ICON, fmtAmount } from '../lib/labels.js';
import * as R from '../lib/repos.js';

const GLYPHS = {
  bolt: '<svg viewBox="0 0 24 24" width="26" height="26"><path d="M13.5 2 5 13.5h6L10 22l9-12h-6.2L13.5 2Z" fill="currentColor"/></svg>',
  moon: '<svg viewBox="0 0 24 24" width="26" height="26"><path d="M20.5 14.6A8.5 8.5 0 1 1 9.4 3.5a7 7 0 0 0 11.1 11.1Z" fill="currentColor"/></svg>',
  wave: '<svg viewBox="0 0 24 24" width="26" height="26"><path d="M2 12c2.2-4.5 4.3-4.5 6.5 0s4.3 4.5 6.5 0 4.3-4.5 6.5 0" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>',
};

/**
 * Control Center slider (Figma "Slider 1×2"): a glass capsule with a light fill and one glyph.
 * The fill tracks the finger continuously and settles on the whole number when released.
 * value may be null (not set yet). Defaults to a 0–10 score; step and unit suit other scales.
 * describe(v): optional word for the value ("Well"), shown under the bar in place of the label once set.
 * colours: 'highIsBad' (pain, stress) or 'highIsGood' (sleep) tints the fill green → yellow → red as it
 * rises, or the other way round; leave it out for the plain tint.
 */
export function VSlider({ label, value = null, onChange, onCommit = () => {}, glyph = 'bolt', tint = 'neutral', max = 10, step = 1, unit = '/10', spoken = v => `${v} out of ${max}`, describe = null, colours = null }) {
  const snap = v => Math.round(v / step) * step;
  const num = h('span', { class: 'vs-num' });
  const caption = h('div', { class: 'vs-label' }, label);
  const fill = h('div', { class: 'vs-fill', 'aria-hidden': 'true' });
  // The glyph is drawn twice: light on the empty track, dark on the fill (clipped to the filled part)
  const icon = h('span', { class: 'vs-glyph', 'aria-hidden': 'true' });
  icon.innerHTML = GLYPHS[glyph];
  const iconOnFill = h('div', { class: 'vs-glyph-clip', 'aria-hidden': 'true' }, h('span', { class: 'vs-glyph dark' }));
  iconOnFill.firstChild.innerHTML = GLYPHS[glyph];
  const track = h('div', {
    class: `vslider sprung tint-${tint}${colours ? ' hued' : ''}`, role: 'slider', tabindex: 0, 'aria-label': label,
    'aria-valuemin': 0, 'aria-valuemax': max,
  }, icon, fill, iconOnFill);

  // Green (hue 135) at the good end, through yellow (48) to red (2) at the bad end
  const hueAt = f => {
    const bad = colours === 'highIsGood' ? 1 - f : f;
    return bad <= 0.5 ? 135 - bad * 2 * 87 : 48 - (bad - 0.5) * 2 * 46;
  };
  const draw = frac => {
    const f = clamp(frac, 0, 1);
    fill.style.transform = `scaleY(${frac < 0 ? 0 : Math.min(frac, 1.015)})`;
    iconOnFill.style.clipPath = `inset(${(1 - f) * 100}% 0 0 0)`;
    if (colours) track.style.setProperty('--h', hueAt(f).toFixed(1));
  };

  // A small spring moves the fill: stiff while dragging so it stays under the finger with a touch of
  // weight, softer on release so it settles onto the whole number with a slight overshoot
  let cur = 0, vel = 0, target = 0, raf = 0, held = false;
  function tick() {
    const k = held ? 0.34 : 0.13, damping = held ? 0.56 : 0.74;
    vel = (vel + (target - cur) * k) * damping;
    cur += vel;
    if (Math.abs(target - cur) < 0.0006 && Math.abs(vel) < 0.0006) { cur = target; draw(cur); raf = 0; return; }
    draw(cur);
    raf = requestAnimationFrame(tick);
  }
  const paint = frac => { target = frac; if (!raf) raf = requestAnimationFrame(tick); };

  function setValue(v, fromUser) {
    const changed = v !== value;
    value = v;
    num.textContent = v == null ? '–' : String(v);
    track.setAttribute('aria-valuenow', v ?? '');
    track.setAttribute('aria-valuetext', v == null ? 'Not set' : describe ? `${spoken(v)}, ${describe(v)}` : spoken(v));
    if (describe) caption.textContent = v == null ? label : describe(v);
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
    setValue(snap(frac * max), true);
  };
  track.addEventListener('pointerdown', e => {
    track.setPointerCapture(e.pointerId);
    track.classList.add('dragging');
    held = true;
    drag(e);
  });
  track.addEventListener('pointermove', e => { if (track.hasPointerCapture(e.pointerId)) drag(e); });
  const release = () => {
    held = false;
    track.classList.remove('dragging');
    if (value != null) paint(value / max); // settle onto the whole number
  };
  // Letting go commits the value (the survey uses this to move on)
  track.addEventListener('pointerup', () => { release(); if (value != null) onCommit(value); });
  track.addEventListener('pointercancel', release);
  track.addEventListener('keydown', e => {
    if (e.key === 'Enter' && value != null) { e.preventDefault(); onCommit(value); return; }
    const dir = { ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1 }[e.key];
    let next = null;
    if (dir) next = clamp((value ?? 0) + dir * step, 0, max);
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
    h('div', { class: 'vs-readout' }, num, h('span', { class: 'vs-unit' }, unit)),
    track,
    caption);
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
// Average colour of an emoji, sampled from its rendered pixels (saturated pixels count more), cached.
// Used for a very faint tint on each tile, so custom factors get one too.
const tintCache = new Map();
/** An emoji's average colour is often muddy (browns, olives): keep its hue, make it clear and light. */
function cleanTint(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  let hue = 0;
  if (d) hue = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  hue = (hue * 60 + 360) % 360;
  // Near-grey emoji stay a soft neutral; the rest get a gentle, even saturation
  const sat = d < 0.08 ? 0.08 : 0.62, light = 0.66;
  const k = n => (n + hue / 30) % 12, a = sat * Math.min(light, 1 - light);
  const f = n => Math.round(255 * (light - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1))));
  return `${f(0)}, ${f(8)}, ${f(4)}`;
}

export function emojiTint(emoji) {
  if (!emoji) return null;
  if (tintCache.has(emoji)) return tintCache.get(emoji);
  let tint = null;
  try {
    const c = document.createElement('canvas');
    c.width = c.height = 32;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.font = '26px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(emoji, 16, 18);
    const px = ctx.getImageData(0, 0, 32, 32).data;
    let r = 0, g = 0, b = 0, w = 0;
    for (let i = 0; i < px.length; i += 4) {
      if (px[i + 3] < 128) continue;
      const max = Math.max(px[i], px[i + 1], px[i + 2]), min = Math.min(px[i], px[i + 1], px[i + 2]);
      const weight = 0.15 + (max - min) / 255; // favour the colourful parts over outlines and greys
      r += px[i] * weight; g += px[i + 1] * weight; b += px[i + 2] * weight; w += weight;
    }
    if (w) tint = cleanTint(r / w, g / w, b / w);
  } catch { /* canvas unavailable: no tint */ }
  tintCache.set(emoji, tint);
  return tint;
}

export const INTENSITY = ['', 'Easy', 'Moderate', 'Hard'];

/** The small pencil used for "edit" on cards and tiles. */
export const PENCIL = () => {
  const el = h('span', { class: 'glyph' });
  el.innerHTML = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4Z"/><path d="m13.5 6.5 4 4"/></svg>';
  return el;
};

/** Intensity last logged for a factor, else moderate. */
const lastIntensity = f => R.factors.logs(f.id).find(l => l.intensity)?.intensity ?? 2;

/**
 * intensities: optional Map of factorId → 1–3. When given, a selected tile shows a chip that cycles
 * Easy → Moderate → Hard (for exercise, where how hard matters as much as how long). On a done/not
 * tile (a routine) the swipe sets how hard instead of how much.
 * action: optional link or button for the top-right corner (a routine's edit pencil). On a routine
 * tile the effort isn't a button: it's set by the swipe and shown as bars and a word under the name,
 * with the fill tinted green, yellow or red.
 */
export function FactorTile({ factor: f, selections, intensities = null, onChange = () => {}, title = f.name, action = null, onHold = null }) {
  const scale = scaleFor(f);
  const swipeEffort = !!intensities && f.measureType === 'yesno';
  const bars = () => h('span', { class: 'bars', 'aria-hidden': 'true' }, h('i'), h('i'), h('i'));
  const effort = !intensities ? null : swipeEffort
    ? h('span', { class: 'tile-intensity static' }, bars(), h('span', { class: 'lbl' }))
    : h('button', { type: 'button', class: 'tile-intensity' }, bars(), h('span', { class: 'lbl' }));
  const tint = emojiTint(f.icon);
  const fill = h('div', { class: 'tile-fill', 'aria-hidden': 'true' });
  const valueBtn = h('button', { type: 'button', class: 'tile-value', 'aria-label': `Type exact amount for ${f.name}` });
  const hint = h('span', { class: 'tile-hint' });
  const el = h('div', { class: `tile factor role-${f.role}`, role: 'button', tabindex: 0, style: tint ? `--tint: ${tint}` : null },
    fill,
    h('div', { class: 'tile-top' },
      h('span', { class: 'well', 'aria-hidden': 'true' }, f.icon || ROLE_ICON[f.role]),
      action ? h('span', { class: 'tile-action-wrap' }, action) : (!swipeEffort && effort) || null),
    h('div', { class: 'tile-bottom' }, h('span', { class: 'tile-title' }, title), h('span', { class: 'tile-detail' }, valueBtn, hint, swipeEffort ? effort : null)));
  if (action) el.classList.add('has-action');

  function paint() {
    const on = selections.has(f.id), v = selections.get(f.id);
    el.classList.toggle('on', on);
    el.setAttribute('aria-pressed', String(on));
    const frac = !on ? 0 : swipeEffort ? (intensities.get(f.id) ?? 2) / 3 : f.measureType === 'yesno' ? 1 : Math.max(0.06, scale.fraction(v));
    fill.style.transform = `scaleX(${frac})`;
    valueBtn.textContent = on ? fmtAmount(f, v) : '';
    valueBtn.hidden = !on || f.measureType === 'yesno';
    hint.textContent = on ? (f.measureType === 'yesno' && !swipeEffort ? 'Yes' : '') : f.measureType === 'yesno' && !swipeEffort ? 'Tap' : 'Tap or swipe →';
    el.setAttribute('aria-label', `${f.name}, ${on ? fmtAmount(f, v) : 'not selected'}${f.measureType === 'yesno' ? '' : '. Use arrow keys to change the amount.'}`);
    if (effort) {
      const lvl = Math.round(intensities.get(f.id) ?? 0); // a routine's effort can sit between levels
      effort.hidden = !on;
      effort.dataset.level = lvl;
      effort.lastChild.textContent = swipeEffort ? effortWord(intensities.get(f.id) ?? 2) : INTENSITY[lvl];
      if (swipeEffort) {
        el.dataset.effort = on ? lvl : '';
        // The fill's colour follows the effort continuously: green when easy, through amber, to coral when hard
        if (on) el.style.setProperty('--eh', String(effortHue(intensities.get(f.id) ?? 2)));
      }
      else effort.setAttribute('aria-label', `${f.name} intensity: ${INTENSITY[lvl]}. Tap to change.`);
    }
  }

  const syncIntensity = () => {
    if (!intensities) return;
    if (!selections.has(f.id)) intensities.delete(f.id);
    else if (!intensities.has(f.id)) intensities.set(f.id, lastIntensity(f));
  };

  function setValue(v) {
    if (v > 0) selections.set(f.id, v); else selections.delete(f.id);
    syncIntensity();
    paint();
    onChange();
  }

  function setEffort(lvl) {
    if (!lvl) selections.delete(f.id);
    else { selections.set(f.id, 1); intensities.set(f.id, lvl); }
    syncIntensity();
    paint();
    onChange();
  }

  function toggle() {
    if (selections.has(f.id)) selections.delete(f.id);
    else selections.set(f.id, defaultAmount(f));
    syncIntensity();
    vibrate(6);
    paint();
    onChange();
  }

  // Holding still (no swipe) for a moment runs onHold: the check-in opens the editor for these tiles
  let start = null, dragging = false, holdTimer = 0;
  const HOLD_MS = 480;
  el.addEventListener('pointerdown', e => {
    if (e.target === valueBtn || e.target.closest('input, .tile-intensity, .tile-action-wrap')) return;
    const lvl = selections.has(f.id) ? intensities?.get(f.id) ?? 2 : 0;
    start = { x: e.clientX, y: e.clientY, v: selections.get(f.id) ?? 0, lvl, w: el.getBoundingClientRect().width };
    dragging = false;
    clearTimeout(holdTimer);
    if (onHold) holdTimer = setTimeout(() => { if (start && !dragging) { start = null; vibrate(12); onHold(); } }, HOLD_MS);
  });
  el.addEventListener('contextmenu', e => { if (onHold) e.preventDefault(); });
  el.addEventListener('pointermove', e => {
    if (!start || (f.measureType === 'yesno' && !swipeEffort)) return;
    const dx = e.clientX - start.x, dy = e.clientY - start.y;
    if (Math.hypot(dx, dy) > 8) clearTimeout(holdTimer); // moving: a swipe or a scroll, not a hold
    if (!dragging) {
      if (Math.abs(dx) < 8 || Math.abs(dx) < Math.abs(dy)) return;
      dragging = true;
      el.setPointerCapture(e.pointerId);
      el.classList.add('dragging');
    }
    if (swipeEffort) {
      // The fill follows the finger smoothly from easy (a third) to hard (full); back past a sixth un-ticks it.
      // A light tick each time the word changes, not on every pixel.
      const raw = clamp(start.lvl / 3 + dx / start.w, 0, 1) * 3;
      const lvl = raw < 0.5 ? 0 : Math.round(clamp(raw, 1, 3) * 20) / 20;
      const before = selections.has(f.id) ? effortWord(intensities.get(f.id)) : '';
      setEffort(lvl);
      if ((lvl ? effortWord(lvl) : '') !== before) vibrate(3);
      return;
    }
    const next = scale.fromFraction(clamp(scale.fraction(start.v) + dx / start.w, 0, 1));
    if (next !== (selections.get(f.id) ?? 0)) { vibrate(3); setValue(next); }
  });
  el.addEventListener('pointerup', () => {
    clearTimeout(holdTimer);
    if (start && !dragging) toggle();
    start = null; dragging = false;
    el.classList.remove('dragging');
  });
  el.addEventListener('pointercancel', () => { clearTimeout(holdTimer); start = null; dragging = false; el.classList.remove('dragging'); });
  el.addEventListener('keydown', e => {
    if (e.target !== el) return;
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); }
    const d = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1 }[e.key];
    if (d && swipeEffort) { e.preventDefault(); setEffort(clamp((selections.has(f.id) ? intensities.get(f.id) : 0) + d, 0, 3)); }
    else if (d && f.measureType !== 'yesno') { e.preventDefault(); setValue(scale.step(selections.get(f.id) ?? 0, d)); }
  });

  if (!swipeEffort) effort?.addEventListener('click', e => {
    e.stopPropagation();
    intensities.set(f.id, (intensities.get(f.id) ?? 2) % 3 + 1);
    vibrate(4);
    paint();
    onChange();
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

  syncIntensity();
  paint();
  el.refresh = paint;
  return el;
}

// Five words across the effort range (1 easy to 3 hard), matching the routine page
const EFFORT_WORDS = ['Easy', 'Light', 'Moderate', 'Tough', 'Hard'];
const effortWord = v => EFFORT_WORDS[clamp(Math.round((v - 1) * 2), 0, 4)];
/** Hue for an effort: 135 (green) at easy, 48 (amber) at moderate, 6 (coral) at hard. */
const effortHue = v => {
  const f = clamp((v - 1) / 2, 0, 1);
  return Math.round(f < 0.5 ? 135 - 87 * f * 2 : 48 - 42 * (f - 0.5) * 2);
};

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
