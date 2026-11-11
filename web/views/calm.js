// Soft, abstract guides for calm activities, drawn where a move's stick figure would be. A breath is a
// liquid orb: warm colours swirl slowly inside a glossy sphere that swells as you breathe in, rests, and
// settles as you breathe out, with the word for each part beneath. A body scan, full size, is the 3D
// figure with light rising slowly through it (body3d.js); as a thumbnail, the orb with a band of light.
// Patterns live in lib/calm.js.
import { s, h } from '../lib/ui.js';

// Checked here rather than imported, so the 3D code only loads for a body scan
const webglAvailable = () => { try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch { return false; } };

const PHASES = ['Breathe in', 'Hold', 'Breathe out', 'Hold'];
const SCAN_MS = 30_000;
const ease = t => 0.5 - Math.cos(Math.PI * t) / 2;
// The colours that swirl inside the orb: peach, coral, rose, lilac and a little sea green
const BLOBS = [
  { c: '#ffc59e', r: 30, orbit: 14, speed: 0.00021, phase: 0 },
  { c: '#ff8f86', r: 26, orbit: 18, speed: -0.00016, phase: 2.1 },
  { c: '#f6a6c8', r: 24, orbit: 12, speed: 0.00027, phase: 4.2 },
  { c: '#a996ee', r: 28, orbit: 20, speed: -0.00012, phase: 1.1 },
  { c: '#8fd8cb', r: 16, orbit: 22, speed: 0.00019, phase: 3.3 },
];
let uid = 0;

export function CalmGuide(guide, { small = false } = {}) {
  // The body scan, full size, is the 3D figure with light moving up through it (loaded only when needed)
  if (guide.kind === 'scan' && !small && webglAvailable()) {
    const slot = h('div', { class: 'scan3d-slot' });
    import('./body3d.js').then(m => slot.replaceWith(m.BodyScan()));
    return slot;
  }
  const id = `calm${++uid}`;
  const cx = 100, cy = small ? 70 : 62;
  const clip = s('circle', { cx, cy, r: 34 });
  const blobs = BLOBS.map(b => s('circle', { r: b.r, fill: b.c }));
  const halo = s('circle', { class: 'calm-halo', cx, cy, r: 40, fill: `url(#${id}-halo)` });
  const rim = s('circle', { cx, cy, r: 34, fill: `url(#${id}-rim)` });
  const shine = s('ellipse', { rx: 13, ry: 8, fill: `url(#${id}-shine)` });
  const band = s('rect', { x: cx - 50, width: 100, height: 22, fill: `url(#${id}-band)` });
  const word = small ? null : s('text', { class: 'calm-word', x: cx, y: 134, 'text-anchor': 'middle' });
  const svg = s('svg', { viewBox: '0 0 200 140', class: `move-figure calm-guide${small ? ' small' : ''}`, 'aria-hidden': 'true' },
    s('defs', {},
      s('clipPath', { id: `${id}-clip` }, clip),
      // Soft, liquid edges between the colours
      s('filter', { id: `${id}-melt`, x: '-50%', y: '-50%', width: '200%', height: '200%' }, s('feGaussianBlur', { stdDeviation: small ? 6 : 7 })),
      s('radialGradient', { id: `${id}-halo` },
        s('stop', { offset: '55%', 'stop-color': '#ff9f8f', 'stop-opacity': 0.28 }),
        s('stop', { offset: '100%', 'stop-color': '#b79ae2', 'stop-opacity': 0 })),
      // A darker edge and a bright highlight make it read as a glossy sphere
      s('radialGradient', { id: `${id}-rim`, cx: '45%', cy: '40%', r: '60%' },
        s('stop', { offset: '70%', 'stop-color': '#3b2a4a', 'stop-opacity': 0 }),
        s('stop', { offset: '100%', 'stop-color': '#3b2a4a', 'stop-opacity': 0.22 })),
      s('radialGradient', { id: `${id}-shine` },
        s('stop', { offset: '0%', 'stop-color': '#fff', 'stop-opacity': 0.75 }),
        s('stop', { offset: '100%', 'stop-color': '#fff', 'stop-opacity': 0 })),
      s('linearGradient', { id: `${id}-band`, x1: 0, y1: 0, x2: 0, y2: 1 },
        s('stop', { offset: '0%', 'stop-color': '#fff', 'stop-opacity': 0 }),
        s('stop', { offset: '50%', 'stop-color': '#fff', 'stop-opacity': 0.7 }),
        s('stop', { offset: '100%', 'stop-color': '#fff', 'stop-opacity': 0 }))),
    halo,
    s('g', { 'clip-path': `url(#${id}-clip)` },
      s('circle', { cx, cy, r: 40, fill: '#ffb7a0' }),
      s('g', { filter: `url(#${id}-melt)` }, blobs),
      guide.kind === 'scan' ? band : null,
      rim),
    shine, word);

  // A breath's size at time t (ms): in, held big, out, held small
  const pace = (guide.pace ?? [4, 0, 4, 0]).map(x => x * 1000);
  const cycle = pace.reduce((a, b) => a + b, 0);
  const breath = t => {
    let at = t % cycle;
    for (let i = 0; i < 4; i++) {
      if (at < pace[i]) {
        const f = ease(at / pace[i]);
        return { i, size: i === 0 ? f : i === 1 ? 1 : i === 2 ? 1 - f : 0 };
      }
      at -= pace[i];
    }
    return { i: 0, size: 0 };
  };

  const draw = t => {
    let r, label = '';
    if (guide.kind === 'scan') {
      const f = (t % SCAN_MS) / SCAN_MS;
      r = 34 + Math.sin(t / 1600) * 1.2;
      band.setAttribute('y', (cy + r - 11 - f * 2 * r).toFixed(2));
      band.style.opacity = String(Math.min(1, f * 8, (1 - f) * 8));
    } else {
      const { i, size } = breath(t);
      r = 22 + size * 22;
      if (guide.kind !== 'rest') label = PHASES[i];
    }
    clip.setAttribute('r', r.toFixed(2));
    rim.setAttribute('r', r.toFixed(2));
    halo.setAttribute('r', (r * 1.35).toFixed(2));
    shine.setAttribute('cx', (cx - r * 0.36).toFixed(2));
    shine.setAttribute('cy', (cy - r * 0.42).toFixed(2));
    shine.setAttribute('rx', (r * 0.36).toFixed(2));
    shine.setAttribute('ry', (r * 0.22).toFixed(2));
    // The colours drift round each other, slowly, scaled to the orb as it breathes
    const k = r / 34;
    BLOBS.forEach((b, j) => {
      const a = b.phase + t * b.speed, wob = 1 + Math.sin(t * 0.0007 + j) * 0.18;
      blobs[j].setAttribute('cx', (cx + Math.cos(a) * b.orbit * k * wob).toFixed(2));
      blobs[j].setAttribute('cy', (cy + Math.sin(a * 1.3) * b.orbit * k * 0.85).toFixed(2));
      blobs[j].setAttribute('r', (b.r * k * (0.9 + 0.1 * Math.sin(t * 0.0009 + j * 2))).toFixed(2));
    });
    if (word) word.textContent = label;
  };

  if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
    draw(guide.kind === 'scan' ? SCAN_MS / 2 : pace[0]);
    if (word) word.textContent = '';
    return svg;
  }
  const t0 = performance.now();
  const frame = now => {
    if (!svg.isConnected && now - t0 > 500) return;
    draw(now - t0);
    requestAnimationFrame(frame);
  };
  draw(0);
  requestAnimationFrame(frame);
  return svg;
}
