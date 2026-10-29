// Multi-series trend chart in the style of the reference (Figma 1:372): overlapping glowing area curves,
// day names along the top with hairlines, a bright line on the selected day, and legend pills below.
import { h, s } from '../lib/ui.js';
import { dayLabel, parseDate } from '../lib/dates.js';

let uid = 0;
const DASH = 18;

// Muted palettes that read well on charcoal. The line and its key are drawn in the first colour, so
// a line looks the same wherever it sits; the second only deepens the area fill underneath.
export const PALETTES = {
  pain: ['#f4908a', '#e2687f'],
  stressor: ['#f3b46e', '#e8875a'],
  helper: ['#74d4c0', '#4fb3a6'],
};
// For extra series the user adds to the chart, in order; each a hue none of the above use
export const EXTRA_PALETTES = [['#b9a0ff', '#8f6cf0'], ['#8fc4ff', '#5a8cf0'], ['#ff9fcf', '#e46aa6'], ['#dfe07a', '#b8b84a']];

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
 * marks: [{ i, texts }] days to flag (routine changes): a soft white dot on the baseline, with a key entry. onMark(mark) on tap.
 */
export function TrendChart({ days, series, hidden = new Set(), onToggle = () => {}, onAdd = null, focus: home = days.length - 1, fadeLeft = true, marks = [], onMark = () => {} }) {
  const id = ++uid;
  // Even side padding, just enough to keep the first and last day labels whole
  const W = 340, H = 196, top = 46, bottom = 176, left = 22, right = W - 22;
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
    ]));

  // Each series joins its logged days with one continuous curve; days without a check-in are bridged
  // (and dimmed in the day ruler) rather than leaving a hole in the chart
  // A lone day is a flat dash, so two lines with the same value would draw exactly on top of each
  // other; dashes that would touch are spread a few pixels apart so every colour shows
  const taken = [];
  const apart = yy => {
    const free = c => c >= top && c <= bottom && !taken.some(t => Math.abs(t - c) < 5);
    const out = [0, -5, 5, -10, 10, -15, 15, -20, 20].map(d => yy + d).find(free) ?? yy;
    taken.push(out);
    return out;
  };
  const areas = visible.map(sr => {
    let pts = sr.values.flatMap((v, i) => (v == null || !days[i].logged ? [] : [{ x: x(i), y: y(v) }]));
    if (pts.length === 1) pts = [{ ...pts[0], y: apart(pts[0].y) }];
    const runs = pts.length ? [pts] : [];
    return s('g', { class: 'series' }, runs.map(pts => {
      const line = smoothPath(pts, top, bottom);
      return [
        // A lone first day is just its level line; the area starts once there's a curve
        pts.length > 1 ? s('path', { class: 'area', fill: `url(#fill-${sr.key}-${id})`, d: `${line} L${pts.at(-1).x},${bottom} L${pts[0].x},${bottom} Z` }) : null,
        s('path', { class: 'line', stroke: sr.palette[0], filter: `url(#glow-${id})`, d: line }),
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
    hair,
    // Routine changes: a small glowing white dot just under the baseline (clear of the selected day's knob), with a faint line up
    marks.map(m => s('g', { class: 'mark', 'data-i': m.i, role: 'button', tabindex: 0, 'aria-label': `Routine change: ${m.texts.join(', ')}. Show details` },
      s('line', { x1: x(m.i), x2: x(m.i), y1: 36, y2: bottom }),
      s('circle', { class: 'mark-hit', cx: x(m.i), cy: bottom + 11, r: 14 }),
      s('circle', { class: 'mark-glow', cx: x(m.i), cy: bottom + 11, r: 7 }),
      s('circle', { class: 'mark-dot', cx: x(m.i), cy: bottom + 11, r: 3.2 }))));

  // One key: each line's name and its value on the focused day (today unless the finger is on the chart)
  const when = h('span', { class: 'when' });
  for (const g of svg.querySelectorAll('.mark')) {
    const m = marks.find(x => x.i === Number(g.dataset.i));
    g.addEventListener('click', e => { e.stopPropagation(); onMark(m); });
    g.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onMark(m); } });
  }
  const keys = series.map(sr => {
    const val = h('strong');
    const btn = h('button', {
      type: 'button', class: `key${hidden.has(sr.key) ? '' : ' on'}`, 'aria-pressed': String(!hidden.has(sr.key)),
      style: `--c:${sr.palette[0]}`, onclick: () => onToggle(sr.key),
    }, h('i', { 'aria-hidden': 'true' }), h('span', { class: 'key-name' }, sr.label), val);
    return { sr, btn, val };
  });
  const add = onAdd ? h('button', { type: 'button', class: 'key-add', 'aria-label': 'Choose what the chart shows', title: 'Chart data', onclick: onAdd }, '•••') : null;
  // The dot gets its own key, but only when there's one in view
  const changeKey = marks.length ? h('button', { type: 'button', class: 'key change-key', onclick: () => onMark(null) }, h('i', { 'aria-hidden': 'true' }), h('span', { class: 'key-name' }, 'Routine change')) : null;
  const legend = h('div', { class: 'legend', role: 'group', 'aria-label': 'Lines on the chart' }, keys.map(k => k.btn), changeKey, add);

  function focus(i) {
    hair.setAttribute('x1', x(i));
    hair.setAttribute('x2', x(i));
    for (const g of svg.querySelectorAll('.day-label')) g.classList.toggle('on', Number(g.dataset.i) === i);
    const d = days[i];
    when.textContent = d.logged ? dayLabel(d.date) : `${dayLabel(d.date)} · no check-in`;
    // Days without a value just show the name; no placeholder dashes
    for (const k of keys) { const v = d.logged ? k.sr.format(i) : ''; k.val.textContent = /^–/.test(v) ? '' : v; }
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
