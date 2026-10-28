// Minimal glowing area chart for pain over time (the mood board's "Bookings per day" / "Peak energy" style).
import { h, s } from '../lib/ui.js';
import { dayLabel, weekdayLetter, parseDate } from '../lib/dates.js';

let uid = 0;

/** Catmull-Rom spline through points, as cubic Béziers, with control points clamped to the plot. */
function smoothPath(pts, top, bottom) {
  if (pts.length === 1) return `M${pts[0].x},${pts[0].y}`;
  const cy = y => Math.min(bottom, Math.max(top, y));
  let d = `M${pts[0].x},${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
    d += ` C${p1.x + (p2.x - p0.x) / 6},${cy(p1.y + (p2.y - p0.y) / 6)} ${p2.x - (p3.x - p1.x) / 6},${cy(p2.y - (p3.y - p1.y) / 6)} ${p2.x},${p2.y}`;
  }
  return d;
}

/**
 * days: [{ date, pain|null }] oldest first. flareDates: Set of dates with flares.
 * markDates: Set of dates to tick along the baseline (the factor filter).
 */
export function PainChart({ days, flareDates = new Set(), markDates = null }) {
  const id = ++uid;
  const W = 340, H = 168, top = 18, bottom = 128, left = 6, right = W - 6;
  const x = i => left + (days.length === 1 ? (right - left) / 2 : (i / (days.length - 1)) * (right - left));
  const y = p => bottom - (p / 10) * (bottom - top);
  const pts = days.map((d, i) => (d.pain == null ? null : { x: x(i), y: y(d.pain), i }));

  // Contiguous runs of logged days become separate curve segments, so gaps stay visible
  const segments = [];
  let run = [];
  for (const p of pts) { if (p) run.push(p); else if (run.length) { segments.push(run); run = []; } }
  if (run.length) segments.push(run);

  const lastIdx = pts.reduce((acc, p) => (p ? p.i : acc), -1);
  const readout = h('div', { class: 'chart-readout' });
  const hair = s('line', { class: 'hair', x1: 0, x2: 0, y1: top - 8, y2: bottom });
  const dot = s('circle', { class: 'hot-dot', r: 4.5 });
  const halo = s('circle', { class: 'hot-halo', r: 11 });
  const hot = s('g', { class: 'hot' }, hair, halo, dot);

  const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, class: 'chart', role: 'img', 'aria-label': summaryLabel(days) },
    s('defs', {},
      s('linearGradient', { id: `area-${id}`, x1: 0, y1: 0, x2: 0, y2: 1 },
        s('stop', { offset: '0%', 'stop-color': 'var(--red)', 'stop-opacity': 0.28 }),
        s('stop', { offset: '100%', 'stop-color': 'var(--red)', 'stop-opacity': 0 })),
      s('filter', { id: `glow-${id}`, x: '-10%', y: '-30%', width: '120%', height: '160%' },
        s('feGaussianBlur', { stdDeviation: 4, result: 'b' }), s('feMerge', {}, s('feMergeNode', { in: 'b' }), s('feMergeNode', { in: 'SourceGraphic' })))),
    [0, 5, 10].map(v => s('line', { class: 'gridline', x1: left, x2: right, y1: y(v), y2: y(v) })),
    segments.map(seg => [
      s('path', { class: 'area', fill: `url(#area-${id})`, d: `${smoothPath(seg, top, bottom)} L${seg.at(-1).x},${bottom} L${seg[0].x},${bottom} Z` }),
      s('path', { class: 'line', filter: `url(#glow-${id})`, d: smoothPath(seg, top, bottom) }),
      seg.length === 1 ? s('circle', { class: 'solo', cx: seg[0].x, cy: seg[0].y, r: 3 }) : null,
    ]),
    days.map((d, i) => (flareDates.has(d.date) ? s('path', { class: 'flare-mark', d: `M${x(i)},${bottom + 9} l3,-5 l-2,0 l1,-4 l-4,6 l2,0 z` }) : null)),
    markDates ? days.map((d, i) => (markDates.has(d.date) ? s('rect', { class: 'factor-mark', x: x(i) - 1.5, y: bottom + 13, width: 3, height: 7, rx: 1.5 }) : null)) : null,
    days.map((d, i) => {
      if (!showLabel(days.length, i)) return null;
      const label = s('text', { class: `axis${i === days.length - 1 ? ' axis-today' : ''}`, x: x(i), y: H - 6, 'text-anchor': 'middle' }, axisLabel(days.length, d.date));
      // Today sits in a small white disc, like the day picker in the reference UI
      return i === days.length - 1 ? [s('circle', { class: 'axis-dot', cx: x(i), cy: H - 9, r: 8 }), label] : label;
    }),
    hot);

  function focus(i) {
    const d = days[i];
    hair.setAttribute('x1', x(i)); hair.setAttribute('x2', x(i));
    const p = pts[i];
    hot.classList.toggle('empty', !p);
    if (p) { for (const c of [dot, halo]) { c.setAttribute('cx', p.x); c.setAttribute('cy', p.y); } }
    readout.replaceChildren(h('span', {},
      h('span', { class: 'muted' }, `${dayLabel(d.date)} · `),
      d.pain == null ? h('span', { class: 'muted' }, 'no check-in') : h('strong', {}, `pain ${d.pain}`),
      flareDates.has(d.date) ? h('span', { class: 'muted' }, ' · flare') : null));
  }

  const pick = e => {
    const r = svg.getBoundingClientRect();
    const fx = ((e.clientX - r.left) / r.width) * W;
    const i = Math.round(((fx - left) / (right - left)) * (days.length - 1));
    focus(Math.max(0, Math.min(days.length - 1, i)));
  };
  svg.addEventListener('pointermove', pick);
  svg.addEventListener('pointerdown', pick);
  svg.addEventListener('pointerleave', () => focus(lastIdx >= 0 ? lastIdx : days.length - 1));
  focus(lastIdx >= 0 ? lastIdx : days.length - 1);

  return h('div', { class: 'chart-wrap' }, readout, svg);
}

const showLabel = (n, i) => n <= 14 || i % 7 === (n - 1) % 7;
const axisLabel = (n, date) => (n <= 14 ? weekdayLetter(date) : String(parseDate(date).getDate()));

function summaryLabel(days) {
  const logged = days.filter(d => d.pain != null);
  if (!logged.length) return 'Pain trend: no check-ins in this period yet.';
  const avg = logged.reduce((a, d) => a + d.pain, 0) / logged.length;
  return `Pain trend over ${days.length} days: ${logged.length} check-ins, average ${avg.toFixed(1)} out of 10, latest ${logged.at(-1).pain}.`;
}
