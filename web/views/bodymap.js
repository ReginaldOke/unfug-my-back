// 2D body map (front / back / list). Region IDs match the planned 3D model, so data carries over.
import { h, s, vibrate } from '../lib/ui.js';
import { REGIONS, regionById, SHAPES, SILHOUETTE } from '../lib/regions.js';
import { QUALITIES } from '../lib/labels.js';

export function intensityColor(i) {
  return `rgba(255, ${Math.round(90 - i * 6)}, ${Math.round(70 - i * 5)}, ${0.35 + i * 0.065})`;
}

/** markers: array of { regionId, side, intensity, quality }, mutated in place. */
export function BodyMap({ markers, defaultIntensity = () => 5, onChange = () => {}, onAdd = () => {} }) {
  let view = 'back';
  let editing = null;
  const root = h('div', { class: 'bodymap' });

  function toggle(id) {
    const i = markers.findIndex(m => m.regionId === id);
    if (i >= 0) { markers.splice(i, 1); if (editing === id) editing = null; }
    else { markers.push({ regionId: id, side: regionById[id].side, intensity: defaultIntensity(), quality: 'ache' }); editing = id; }
    vibrate(6);
    render();
    onChange(markers);
    if (i < 0) onAdd(id);
  }

  function figure() {
    const sideLabels = view === 'front' ? ['R', 'L'] : ['L', 'R'];
    return s('svg', { viewBox: '0 0 200 450', class: 'figure', role: 'group', 'aria-label': `${view === 'back' ? 'Back' : 'Front'} of body. Tap where it hurts.` },
      s('defs', {}, s('filter', { id: 'region-glow', x: '-50%', y: '-50%', width: '200%', height: '200%' },
        s('feGaussianBlur', { stdDeviation: 5, result: 'b' }), s('feMerge', {}, s('feMergeNode', { in: 'b' }), s('feMergeNode', { in: 'SourceGraphic' })))),
      SILHOUETTE.map(p => s(p.type, { ...p.attrs, class: 'silhouette' })),
      SHAPES[view].map(sh => {
        const m = markers.find(x => x.regionId === sh.id);
        const name = regionById[sh.id].displayName;
        return s('rect', {
          x: sh.x, y: sh.y, width: sh.w, height: sh.h, rx: 7,
          class: `region${m ? ' on' : ''}`, style: m ? `fill:${intensityColor(m.intensity)}` : null, filter: m ? 'url(#region-glow)' : null,
          'data-region': sh.id, tabindex: 0, role: 'button', 'aria-pressed': String(!!m), 'aria-label': name,
          onclick: () => toggle(sh.id),
          onkeydown: e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(sh.id); } },
        }, s('title', {}, name));
      }),
      s('text', { x: 14, y: 444, class: 'side-label' }, sideLabels[0]),
      s('text', { x: 186, y: 444, class: 'side-label', 'text-anchor': 'end' }, sideLabels[1]));
  }

  function list() {
    return h('div', { class: 'chips wrap region-list' }, REGIONS.map(r => {
      const on = markers.some(m => m.regionId === r.regionId);
      return h('button', { type: 'button', class: `chip${on ? ' on' : ''}`, 'aria-pressed': String(on), onclick: () => toggle(r.regionId) }, r.displayName);
    }));
  }

  function editor() {
    if (!markers.length) return h('p', { class: 'hint center' }, 'Tap the body where it hurts. Tap again to remove.');
    return h('div', { class: 'marker-chips' }, markers.map(m => {
      const open = editing === m.regionId;
      const chip = h('button', { type: 'button', class: `chip${open ? ' on' : ''}`, 'aria-expanded': String(open), onclick: () => { editing = open ? null : m.regionId; render(); } },
        h('span', { class: 'dot', style: `background:${intensityColor(m.intensity)}` }), regionById[m.regionId].displayName, h('span', { class: 'muted' }, ` · ${m.intensity}`));
      if (!open) return chip;
      const out = h('output', {}, String(m.intensity));
      return h('div', { class: 'marker-edit glass' }, chip,
        h('label', { class: 'row' }, h('span', { class: 'hint' }, 'Intensity'),
          h('input', {
            type: 'range', min: 0, max: 10, value: m.intensity, class: 'grow', 'aria-label': `${regionById[m.regionId].displayName} intensity`,
            oninput: e => {
              m.intensity = Number(e.target.value);
              out.textContent = e.target.value;
              const rect = root.querySelector(`[data-region="${m.regionId}"]`);
              if (rect) rect.style.fill = intensityColor(m.intensity);
              onChange(markers);
            },
          }), out),
        h('div', { class: 'chips wrap small' }, QUALITIES.map(q => h('button', {
          type: 'button', class: `chip${m.quality === q ? ' on' : ''}`, 'aria-pressed': String(m.quality === q),
          onclick: () => { m.quality = q; render(); onChange(markers); },
        }, q))),
        h('button', { type: 'button', class: 'btn ghost small', onclick: () => toggle(m.regionId) }, 'Remove'));
    }));
  }

  function tabs() {
    return h('div', { class: 'segmented small', role: 'tablist', 'aria-label': 'Body view' }, [['back', 'Back'], ['front', 'Front'], ['list', 'List']].map(([v, l]) =>
      h('button', { type: 'button', role: 'tab', 'aria-selected': String(view === v), class: view === v ? 'on' : '', onclick: () => { view = v; render(); } }, l)));
  }

  function render() {
    root.replaceChildren(tabs(), view === 'list' ? list() : figure(), editor());
  }

  root.setMarkers = arr => { markers.splice(0, markers.length, ...arr.map(m => ({ ...m }))); editing = null; render(); onChange(markers); };
  render();
  return root;
}
