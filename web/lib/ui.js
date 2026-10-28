// Tiny DOM helpers. Views build elements with h() and own their own re-rendering.

function setProps(el, props, isSvg) {
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (!isSvg && k === 'class') el.className = v;
    else if (!isSvg && (k === 'value' || k === 'checked')) el[k] = v;
    else el.setAttribute(k, v === true ? '' : String(v));
  }
}

function appendChildren(el, children) {
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : String(c));
  }
}

/** HTML element. Children go in before props so <select value> and range min/max apply in order. */
export function h(tag, props, ...children) {
  const el = document.createElement(tag);
  appendChildren(el, children);
  setProps(el, props, false);
  return el;
}

/** SVG element. */
export function s(tag, props, ...children) {
  const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
  setProps(el, props, true);
  appendChildren(el, children);
  return el;
}

let toastTimer;
export function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
}

export function select(options, value, props = {}) {
  return h('select', { ...props, value }, options.map(([v, label]) => h('option', { value: v }, label)));
}

export function field(label, control, hint) {
  return h('label', { class: 'field' }, h('span', { class: 'field-label' }, label), control, hint ? h('span', { class: 'hint' }, hint) : null);
}

/** Segmented control. options: [[value, label]] */
export function segmented(options, value, onChange, label) {
  const el = h('div', { class: 'segmented', role: 'radiogroup', 'aria-label': label });
  const render = () => el.replaceChildren(...options.map(([v, l]) => h('button', {
    type: 'button', role: 'radio', 'aria-checked': String(v === value), class: v === value ? 'on' : '',
    onclick: () => { value = v; render(); onChange(v); },
  }, l)));
  render();
  return el;
}

// Text glyphs like ‹ sit off-centre in most fonts, so common icons are drawn as SVG
const SVG_ICONS = {
  '‹': '<path d="M15.25 5.5 8.75 12l6.5 6.5" />',
  '✕': '<path d="M6.5 6.5l11 11M17.5 6.5l-11 11" />',
};

export function iconButton(icon, label, onclick, props = {}) {
  const btn = h('button', { type: 'button', class: 'icon-btn glass', 'aria-label': label, title: label, onclick, ...props });
  if (SVG_ICONS[icon]) {
    btn.innerHTML = `<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${SVG_ICONS[icon]}</svg>`;
  } else {
    btn.append(icon);
  }
  return btn;
}

const SHEET_EASE = 'cubic-bezier(.32, .72, 0, 1)'; // the iOS sheet curve

/**
 * Bottom sheet built on <dialog>, so focus trapping and Escape come for free. It slides up on open;
 * swipe it down (it follows the finger) or tap outside to close.
 */
export function sheet(build, { onClose, tall = false } = {}) {
  const dlg = h('dialog', { class: `sheet${tall ? ' tall' : ''}` });
  let closing = false;
  const close = () => slideOut(0);

  /** Slides the rest of the way down from `from` px, then closes. */
  function slideOut(from, velocity = 0) {
    if (closing) return;
    closing = true;
    dlg.classList.add('closing');
    const dist = dlg.offsetHeight - from;
    // A fast flick finishes faster; a tap outside takes the standard 300 ms
    const ms = velocity > 0 ? Math.max(140, Math.min(300, dist / velocity)) : 300;
    dlg.animate([{ transform: `translateY(${from}px)` }, { transform: 'translateY(100%)' }], { duration: ms, easing: velocity ? 'cubic-bezier(.2, .6, .4, 1)' : SHEET_EASE, fill: 'forwards' })
      .finished.then(() => dlg.close(), () => dlg.close());
  }

  dlg.append(h('div', { class: 'sheet-grabber', 'aria-hidden': 'true' }), build(close));
  dlg.addEventListener('close', () => { dlg.remove(); onClose?.(); });
  dlg.addEventListener('cancel', e => { e.preventDefault(); close(); }); // Escape slides out too
  dlg.addEventListener('click', e => { if (e.target === dlg) close(); });

  // Swipe down to dismiss. Starts only when the sheet is scrolled to the top and the finger moves down
  let drag = null, swallowUntil = 0;
  // The release of a drag isn't a tap on whatever was under the finger
  dlg.addEventListener('click', e => { if (performance.now() < swallowUntil) { e.stopPropagation(); e.preventDefault(); } }, true);
  const y = e => (e.touches ? e.touches[0].clientY : e.clientY);
  const x = e => (e.touches ? e.touches[0].clientX : e.clientX);
  const start = e => {
    if (closing || e.target.closest('input, textarea, select, .vslider, .sortable')) return;
    drag = { x0: x(e), y0: y(e), dy: 0, active: false, samples: [] };
  };
  const move = e => {
    if (!drag) return;
    const dx = x(e) - drag.x0, dy = y(e) - drag.y0;
    if (!drag.active) {
      if (Math.abs(dy) < 6 && Math.abs(dx) < 6) return;
      if (dy <= 0 || Math.abs(dx) > dy || dlg.scrollTop > 0) { drag = null; return; }
      drag.active = true;
      dlg.classList.add('dragging');
    }
    e.preventDefault();
    // Past the top it resists, like iOS
    drag.dy = dy > 0 ? dy : -Math.sqrt(-dy) * 2;
    drag.samples.push([performance.now(), drag.dy]);
    if (drag.samples.length > 5) drag.samples.shift();
    dlg.style.transform = `translateY(${drag.dy}px)`;
  };
  const end = () => {
    if (!drag?.active) { drag = null; return; }
    const { dy, samples } = drag;
    drag = null;
    dlg.classList.remove('dragging');
    const [t0, y0] = samples[0] ?? [0, 0], [t1, y1] = samples.at(-1) ?? [1, 0];
    const v = t1 > t0 ? (y1 - y0) / (t1 - t0) : 0; // px per ms
    dlg.style.transform = '';
    swallowUntil = performance.now() + 350;
    if (dy > dlg.offsetHeight * 0.3 || (v > 0.5 && dy > 20)) return slideOut(dy, Math.max(v, 1));
    dlg.animate([{ transform: `translateY(${dy}px)` }, { transform: 'translateY(0)' }], { duration: 380, easing: 'cubic-bezier(.2, 1.15, .4, 1)' });
  };
  dlg.addEventListener('touchstart', start, { passive: true });
  dlg.addEventListener('touchmove', move, { passive: false });
  dlg.addEventListener('touchend', end);
  dlg.addEventListener('touchcancel', end);
  dlg.addEventListener('mousedown', e => { start(e); if (!drag) return; const up = () => { end(); removeEventListener('mousemove', move); removeEventListener('mouseup', up); }; addEventListener('mousemove', move); addEventListener('mouseup', up); });

  document.body.append(dlg);
  dlg.showModal();
  return { dlg, close };
}

export function confirmSheet(title, body, okLabel = 'OK', { danger = false } = {}) {
  return new Promise(resolve => {
    let ok = false;
    sheet(close => h('div', { class: 'stack' },
      h('h2', {}, title), h('p', { class: 'muted' }, body),
      h('div', { class: 'row end' },
        h('button', { type: 'button', class: 'btn ghost', onclick: close }, 'Cancel'),
        h('button', { type: 'button', class: `btn ${danger ? 'danger' : 'primary'}`, onclick: () => { ok = true; close(); } }, okLabel))),
    { onClose: () => resolve(ok) });
  });
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = h('textarea', { style: 'position:fixed;opacity:0' }, text);
    document.body.append(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  }
}

/** Share sheet on touch devices (the iOS export path), plain download elsewhere. */
export async function shareOrDownload(filename, text, mime) {
  const file = new File([text], filename, { type: mime });
  if (matchMedia('(pointer: coarse)').matches && navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title: filename }); return; } catch (e) { if (e.name === 'AbortError') return; }
  }
  const url = URL.createObjectURL(file);
  const a = h('a', { href: url, download: filename });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// iPhone ignores navigator.vibrate; the app uses the Taptic Engine instead (light for ticks, medium for lifts)
const haptics = globalThis.Capacitor?.isNativePlatform?.() ? globalThis.Capacitor.registerPlugin('Haptics') : null;
export const vibrate = ms => {
  try {
    if (haptics) haptics.impact({ style: ms >= 10 ? 'MEDIUM' : 'LIGHT' });
    else navigator.vibrate?.(ms);
  } catch { /* not supported */ }
};

export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
