// Soft, abstract guides for calm activities, drawn where a move's stick figure would be. A breath is a
// liquid orb: warm colours swirl slowly inside a glossy sphere that swells as you breathe in, rests, and
// settles as you breathe out, with the word for each part beneath. Its shadow is a soft pool of its own
// colours. The colours are soft-edged gradients rather than a blur filter, so the motion stays smooth. A body scan, full size, is the 3D
// figure with light rising slowly through it (body3d.js); as a thumbnail, the orb with a band of light.
// Patterns live in lib/calm.js.
import { s, h } from '../lib/ui.js';

// Checked here rather than imported, so the 3D code only loads for a body scan
const webglAvailable = () => { try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch { return false; } };

const PHASES = ['Breathe in', 'Hold', 'Breathe out', 'Hold'];
const SCAN_MS = 30_000;
// Half steady, half eased: it starts and stops gently but keeps moving through the whole count, so a
// 4 second breath in looks like 4 seconds
const ease = t => 0.5 * t + 0.25 - Math.cos(Math.PI * t) / 4;
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
  // Each colour fades out at its edge, so they melt into one another where they overlap
  const blobs = BLOBS.map((b, j) => s('circle', { r: b.r * 1.6, fill: `url(#${id}-b${j})` }));
  const pool = BLOBS.map((b, j) => s('circle', { r: b.r * 1.6, fill: `url(#${id}-b${j})` }));
  const halo = s('circle', { class: 'calm-halo', cx, cy, r: 40, fill: `url(#${id}-halo)` });
  const rim = s('circle', { cx, cy, r: 34, fill: `url(#${id}-rim)` });
  const shine = s('ellipse', { rx: 13, ry: 8, fill: `url(#${id}-shine)` });
  const band = s('rect', { x: cx - 50, width: 100, height: 22, fill: `url(#${id}-band)` });
  const reflection = s('g', { opacity: 0.55 }, pool);
  const phase = s('tspan', {}), secs = s('tspan', { class: 'calm-count', dx: 6 });
  const word = small ? null : s('text', { class: 'calm-word', x: cx, y: 134, 'text-anchor': 'middle' }, phase, secs);
  const svg = s('svg', { viewBox: '0 0 200 140', class: `move-figure calm-guide${small ? ' small' : ''}`, 'aria-hidden': 'true' },
    s('defs', {},
      s('clipPath', { id: `${id}-clip` }, clip),
      BLOBS.map((b, j) => s('radialGradient', { id: `${id}-b${j}` },
        s('stop', { offset: '0%', 'stop-color': b.c, 'stop-opacity': 1 }),
        s('stop', { offset: '45%', 'stop-color': b.c, 'stop-opacity': 0.85 }),
        s('stop', { offset: '100%', 'stop-color': b.c, 'stop-opacity': 0 }))),
      s('radialGradient', { id: `${id}-halo` },
        s('stop', { offset: '55%', 'stop-color': '#ff9f8f', 'stop-opacity': 0.28 }),
        s('stop', { offset: '100%', 'stop-color': '#b79ae2', 'stop-opacity': 0 })),
      // A lilac edge and a bright highlight make it read as a glossy sphere, with no grey in it
      s('radialGradient', { id: `${id}-rim`, cx: '45%', cy: '40%', r: '60%' },
        s('stop', { offset: '72%', 'stop-color': '#a996ee', 'stop-opacity': 0 }),
        s('stop', { offset: '100%', 'stop-color': '#a996ee', 'stop-opacity': 0.3 })),
      s('radialGradient', { id: `${id}-shine` },
        s('stop', { offset: '0%', 'stop-color': '#fff', 'stop-opacity': 0.75 }),
        s('stop', { offset: '100%', 'stop-color': '#fff', 'stop-opacity': 0 })),
      s('linearGradient', { id: `${id}-band`, x1: 0, y1: 0, x2: 0, y2: 1 },
        s('stop', { offset: '0%', 'stop-color': '#fff', 'stop-opacity': 0 }),
        s('stop', { offset: '50%', 'stop-color': '#fff', 'stop-opacity': 0.7 }),
        s('stop', { offset: '100%', 'stop-color': '#fff', 'stop-opacity': 0 }))),
    small ? null : reflection,
    halo,
    s('g', { 'clip-path': `url(#${id}-clip)` },
      s('circle', { cx, cy, r: 40, fill: '#ffb7a0' }),
      blobs,
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
        return { i, size: i === 0 ? f : i === 1 ? 1 : i === 2 ? 1 - f : 0, left: Math.ceil((pace[i] - at) / 1000) };
      }
      at -= pace[i];
    }
    return { i: 0, size: 0 };
  };

  const draw = t => {
    let r, label = '', count = '';
    if (guide.kind === 'scan') {
      const f = (t % SCAN_MS) / SCAN_MS;
      r = 34 + Math.sin(t / 1600) * 1.2;
      band.setAttribute('y', (cy + r - 11 - f * 2 * r).toFixed(2));
      band.style.opacity = String(Math.min(1, f * 8, (1 - f) * 8));
    } else {
      const { i, size, left } = breath(t);
      r = 22 + size * 22;
      // The word for this part of the breath, and the seconds left in it
      if (guide.kind !== 'rest') { label = PHASES[i]; count = String(left); }
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
      blobs[j].setAttribute('r', (b.r * 1.6 * k * (0.9 + 0.1 * Math.sin(t * 0.0009 + j * 2))).toFixed(2));
    });
    // The reflection: the same colours, squashed flat and spread wide on the ground below the orb
    const ground = cy + r + 5;
    reflection.setAttribute('transform', `translate(${cx} ${ground.toFixed(2)}) scale(0.62 0.15) translate(${-cx} ${-cy})`);
    reflection.setAttribute('opacity', (0.25 + 0.2 * k).toFixed(3));
    pool.forEach((c, j) => { for (const a of ['cx', 'cy', 'r']) c.setAttribute(a, blobs[j].getAttribute(a)); });
    if (word) { phase.textContent = label; secs.textContent = count; }
  };

  if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
    draw(guide.kind === 'scan' ? SCAN_MS / 2 : pace[0]);
    if (word) { phase.textContent = ''; secs.textContent = ''; }
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
