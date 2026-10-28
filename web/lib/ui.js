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

/** Bottom sheet built on <dialog>, so focus trapping and Escape come for free. */
export function sheet(build, { onClose, tall = false } = {}) {
  const dlg = h('dialog', { class: `sheet${tall ? ' tall' : ''}` });
  const close = () => dlg.close();
  dlg.append(h('div', { class: 'sheet-grabber', 'aria-hidden': 'true' }), build(close));
  dlg.addEventListener('close', () => { dlg.remove(); onClose?.(); });
  dlg.addEventListener('click', e => { if (e.target === dlg) close(); });
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

export const vibrate = ms => { try { navigator.vibrate?.(ms); } catch { /* not supported */ } };

export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
