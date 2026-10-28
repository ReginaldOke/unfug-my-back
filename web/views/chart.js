// Multi-series trend chart in the style of the reference (Figma 1:372): overlapping glowing area curves,
// day names along the top with hairlines, a bright line on the selected day, and legend pills below.
import { h, s } from '../lib/ui.js';
import { dayLabel, parseDate } from '../lib/dates.js';

let uid = 0;
const DASH = 18;

// Muted palettes that read well on charcoal; each series is a two-stop gradient
export const PALETTES = {
  pain: ['#f6a091', '#e2687f'],
  stressor: ['#f3c27a', '#e8875a'],
  helper: ['#7fd6c8', '#7b86f0'],
};
// For extra series the user adds to the chart, in order
export const EXTRA_PALETTES = [['#c9a8ff', '#8f6cf0'], ['#a6e39a', '#4fb39a'], ['#9fd0ff', '#5a8cf0'], ['#ffb0d6', '#e46aa6']];

/** Catmull-Rom spline through points, as cubic Béziers, with control points clamped to the plot. */
function smoothPath(pts, top, bottom) {
  // A single day is drawn as a short level line, so the first check-in reads as the start of a trend
  if (pts.length === 1) return `M${pts[0].x - DASH},${pts[0].y} L${pts[0].x + DASH},${pts[0].y}`;
  const cy = y => Math.min(bottom, Math.max(top, y));
  let d = `M${pts[0].x},${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
    d += ` C${p1.x + (p2.x - p0.x) / 6},${cy(p1.y + (p2.y - p0.y) / 6)} ${p2.x - (p3.x - p1.x) / 6},${cy(p2.y - (p3.y - p1.y) / 6)} ${p2.x},${p2.y}`;
  }
  return d;
}

/**
 * days: [{ date, logged }] oldest first (logged = there's a check-in that day; future days are never logged).
 * series: [{ key, label, palette, values: [0..1 | null] per day, format: i => string }]
 * hidden: Set of series keys to hide. onToggle(key) flips one. onAdd: opens the picker for more lines.
 * focus: index of the day the key shows by default (today). fadeLeft: the data carries on before the first day.
 */
export function TrendChart({ days, series, hidden = new Set(), onToggle = () => {}, onAdd = null, focus: home = days.length - 1, fadeLeft = true }) {
  const id = ++uid;
  // Side padding keeps the first and last day labels whole instead of clipped by the card edge
  const W = 340, H = 196, top = 46, bottom = 176, left = 16 + (fadeLeft ? 0 : DASH), right = W - 16;
  const n = days.length;
  const x = i => left + (n === 1 ? (right - left) / 2 : (i / (n - 1)) * (right - left));
  const y = v => bottom - v * (bottom - top);
  const labelEvery = n <= 14 ? 1 : 7;
  const showLabel = i => (n - 1 - i) % labelEvery === 0;
  const visible = series.filter(sr => !hidden.has(sr.key));

  const defs = s('defs', {},
    // Curves soften into the left and right edges; day labels sit outside the mask and stay crisp
    s('linearGradient', { id: `edge-${id}`, x1: 0, y1: 0, x2: 1, y2: 0 },
      s('stop', { offset: '0%', 'stop-color': '#fff', 'stop-opacity': fadeLeft ? 0 : 1 }),
      s('stop', { offset: '7%', 'stop-color': '#fff', 'stop-opacity': 1 }),
      s('stop', { offset: '93%', 'stop-color': '#fff', 'stop-opacity': 1 }),
      s('stop', { offset: '100%', 'stop-color': '#fff', 'stop-opacity': 0 })),
    s('mask', { id: `fade-${id}`, maskUnits: 'userSpaceOnUse', x: 0, y: 0, width: W, height: H },
      s('rect', { x: 0, y: 0, width: W, height: H, fill: `url(#edge-${id})` })),
    // User-space regions: a level line has a zero-height bounding box, which would hide it under
    // bounding-box filters and gradients
    s('filter', { id: `glow-${id}`, filterUnits: 'userSpaceOnUse', x: 0, y: 0, width: W, height: H },
      s('feGaussianBlur', { stdDeviation: 3.5, result: 'b' }), s('feMerge', {}, s('feMergeNode', { in: 'b' }), s('feMergeNode', { in: 'SourceGraphic' }))),
    series.map(sr => [
      s('linearGradient', { id: `fill-${sr.key}-${id}`, x1: 0, y1: 0, x2: 0, y2: 1 },
        s('stop', { offset: '0%', 'stop-color': sr.palette[0], 'stop-opacity': 0.6 }),
        s('stop', { offset: '55%', 'stop-color': sr.palette[1], 'stop-opacity': 0.22 }),
        s('stop', { offset: '100%', 'stop-color': sr.palette[1], 'stop-opacity': 0 })),
      s('linearGradient', { id: `stroke-${sr.key}-${id}`, gradientUnits: 'userSpaceOnUse', x1: left, y1: 0, x2: right, y2: 0 },
        s('stop', { offset: '0%', 'stop-color': sr.palette[0] }), s('stop', { offset: '100%', 'stop-color': sr.palette[1] })),
    ]));

  // Each series joins its logged days with one continuous curve; days without a check-in are bridged
  // (and dimmed in the day ruler) rather than leaving a hole in the chart
  const areas = visible.map(sr => {
    const pts = sr.values.flatMap((v, i) => (v == null || !days[i].logged ? [] : [{ x: x(i), y: y(v) }]));
    const runs = pts.length ? [pts] : [];
    return s('g', { class: 'series' }, runs.map(pts => {
      const line = smoothPath(pts, top, bottom);
      return [
        // A lone first day is just its level line; the area starts once there's a curve
        pts.length > 1 ? s('path', { class: 'area', fill: `url(#fill-${sr.key}-${id})`, d: `${line} L${pts.at(-1).x},${bottom} L${pts[0].x},${bottom} Z` }) : null,
        s('path', { class: 'line', stroke: `url(#stroke-${sr.key}-${id})`, filter: `url(#glow-${id})`, d: line }),
      ];
    }));
  });

  const hair = s('line', { class: 'hair', y1: 30, y2: bottom + 6 });
  const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, class: 'trend', role: 'img', 'aria-label': summaryLabel(days, series) },
    defs,
    days.map((d, i) => (showLabel(i) ? s('line', { class: 'day-line', x1: x(i), x2: x(i), y1: 34, y2: bottom }) : null)),
    days.map((d, i) => (showLabel(i) ? s('g', { class: `day-label${d.logged ? '' : ' missing'}`, 'data-i': i },
      s('text', { x: x(i), y: 10, 'text-anchor': 'middle', class: 'dow' }, parseDate(d.date).toLocaleDateString(undefined, { weekday: 'short' }).slice(0, 3).toUpperCase()),
      s('text', { x: x(i), y: 24, 'text-anchor': 'middle', class: 'dom' }, String(parseDate(d.date).getDate()))) : null)),
    s('line', { class: 'baseline', x1: left, x2: right, y1: bottom, y2: bottom }),
    s('g', { class: 'plot', mask: `url(#fade-${id})` }, areas),
    hair);

  // One key: each line's name and its value on the focused day (today unless the finger is on the chart)
  const when = h('span', { class: 'when' });
  const keys = series.map(sr => {
    const val = h('strong');
    const btn = h('button', {
      type: 'button', class: `key${hidden.has(sr.key) ? '' : ' on'}`, 'aria-pressed': String(!hidden.has(sr.key)),
      style: `--c1:${sr.palette[0]};--c2:${sr.palette[1]}`, onclick: () => onToggle(sr.key),
    }, h('i', { 'aria-hidden': 'true' }), h('span', { class: 'key-name' }, sr.label), val);
    return { sr, btn, val };
  });
  const add = onAdd ? h('button', { type: 'button', class: 'key-add', 'aria-label': 'Add a line to the chart', title: 'Add a line', onclick: onAdd }, '+') : null;
  const legend = h('div', { class: 'legend', role: 'group', 'aria-label': 'Lines on the chart' }, keys.map(k => k.btn), add);

  function focus(i) {
    hair.setAttribute('x1', x(i));
    hair.setAttribute('x2', x(i));
    for (const g of svg.querySelectorAll('.day-label')) g.classList.toggle('on', Number(g.dataset.i) === i);
    const d = days[i];
    when.textContent = d.logged ? dayLabel(d.date) : `${dayLabel(d.date)} · no check-in`;
    for (const k of keys) k.val.textContent = d.logged ? k.sr.format(i) : '–';
  }
  const pick = e => {
    const r = svg.getBoundingClientRect();
    const fx = ((e.clientX - r.left) / r.width) * W;
    focus(Math.max(0, Math.min(n - 1, Math.round(((fx - left) / (right - left)) * (n - 1)))));
  };
  svg.addEventListener('pointermove', pick);
  svg.addEventListener('pointerdown', pick);
  svg.addEventListener('pointerleave', () => focus(home));
  focus(home);

  return h('div', { class: 'trend-wrap' }, svg, h('div', { class: 'trend-readout', 'aria-live': 'polite' }, when), legend);
}

function summaryLabel(days, series) {
  const logged = days.filter(d => d.logged).length;
  if (!logged) return 'Trend chart: no check-ins in this period yet.';
  return `Trend over ${days.length} days with ${logged} check-ins, showing ${series.map(sr => sr.label).join(', ')}.`;
}
