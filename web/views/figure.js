// Animated line figure for routine moves: a side-on body that eases between two poses, with a soft red
// glow where the move works. Poses are joint positions in a 200 × 140 box, facing right, floor at y 130.
// Far-side limbs are drawn fainter. Unknown moves get no figure.
import { s } from '../lib/ui.js';
import { findByName } from '../lib/move-names.js';
import { MORE_MOVES, body, lerpPose } from './figure-moves.js';

const STAND = {
  head: [102, 22], sh: [100, 40], mid: [100, 58], hip: [100, 76],
  eN: [101, 58], hN: [102, 76], kN: [101, 103], fN: [103, 130],
  eF: [99, 58], hF: [98, 76], kF: [99, 103], fF: [97, 130],
};
const QUAD = {
  head: [146, 80], sh: [130, 88], mid: [100, 88], hip: [70, 88],
  eN: [131, 108], hN: [132, 128], kN: [71, 128], fN: [38, 128],
  eF: [129, 108], hF: [128, 128], kF: [69, 128], fF: [36, 128],
};
const SUPINE = {
  head: [160, 117], sh: [142, 121], mid: [121, 122], hip: [100, 123],
  eN: [124, 126], hN: [108, 127], kN: [72, 124], fN: [42, 126],
  eF: [124, 126], hF: [108, 127], kF: [72, 124], fF: [42, 126],
};
const pose = (base, patch) => ({ ...base, ...patch });

const MOVES = [
  {
    names: ['cat cow', 'cat camel', 'cat and cow', 'cat', 'cow', 'spinal flexion extension'], accent: 'mid', hold: 700,
    a: pose(QUAD, { mid: [100, 99], head: [149, 75] }), // cow: back drops, head lifts
    b: pose(QUAD, { mid: [100, 72], head: [140, 101], hip: [70, 91] }), // cat: back rounds, head tucks
  },
  {
    names: ['bird dog', 'birddog', 'quadruped opposite arm leg', 'opposite arm and leg'], accent: 'mid', hold: 900,
    a: QUAD,
    b: pose(QUAD, { eF: [155, 82], hF: [178, 78], kN: [44, 88], fN: [14, 86] }),
  },
  {
    names: ['cobra and downward dog', 'cobra', 'downward dog', 'down dog', 'downdog', 'upward dog', 'up dog'], accent: 'mid', hold: 1100,
    a: { // cobra
      head: [140, 78], sh: [126, 96], mid: [106, 116], hip: [82, 124],
      eN: [128, 112], hN: [130, 128], kN: [52, 126], fN: [22, 127],
      eF: [126, 112], hF: [128, 128], kF: [52, 126], fF: [22, 127],
    },
    b: { // downward dog
      head: [138, 108], sh: [130, 96], mid: [113, 75], hip: [96, 54],
      eN: [141, 112], hN: [152, 128], kN: [77, 91], fN: [58, 128],
      eF: [139, 112], hF: [150, 128], kF: [75, 91], fF: [56, 128],
    },
  },
  {
    // Seen from above: lying on one side, knees bent forward, arms out in front together
    names: ['open book', 'thoracic rotation', 'side lying rotation', 'book opener', 't spine rotation'], accent: 'sh', hold: 1000, floor: false,
    a: {
      head: [150, 84], sh: [132, 84], mid: [106, 84], hip: [80, 84],
      eN: [134, 60], hN: [136, 36], kN: [84, 56], fN: [58, 54],
      eF: [130, 61], hF: [130, 37], kF: [80, 57], fF: [54, 55],
    },
    // The top arm lifts over (seen end-on) and opens to the floor behind; the head turns with it
    via: {
      head: [150, 84], sh: [132, 84], mid: [106, 84], hip: [80, 84],
      eN: [134, 80], hN: [136, 76], kN: [84, 56], fN: [58, 54],
      eF: [130, 61], hF: [130, 37], kF: [80, 57], fF: [54, 55],
    },
    b: {
      head: [149, 86], sh: [132, 85], mid: [106, 84], hip: [80, 84],
      eN: [134, 109], hN: [136, 133], kN: [84, 56], fN: [58, 54],
      eF: [130, 61], hF: [130, 37], kF: [80, 57], fF: [54, 55],
    },
  },
  {
    names: ['hip flexor', 'half kneeling', 'kneeling lunge', 'couch stretch', 'lunge', 'psoas'], accent: 'hip', hold: 1400,
    a: {
      head: [94, 30], sh: [92, 47], mid: [91, 68], hip: [90, 90],
      eN: [93, 66], hN: [95, 86], kN: [120, 96], fN: [124, 128],
      eF: [91, 66], hF: [89, 86], kF: [76, 127], fF: [50, 126],
    },
    b: pose({
      head: [104, 33], sh: [102, 50], mid: [101, 71], hip: [101, 94],
      eN: [103, 69], hN: [105, 89], kN: [124, 99], fN: [124, 128],
      eF: [101, 69], hF: [99, 89], kF: [78, 127], fF: [52, 126],
    }, {}),
  },
  {
    names: ['hinge', 'hip hinge', 'deadlift', 'rdl', 'romanian deadlift', 'single leg hinge', 'kettlebell swing', 'kb swing'], accent: 'hip', hold: 600,
    a: STAND,
    b: pose(STAND, {
      head: [151, 63], sh: [136, 68], mid: [117, 72], hip: [98, 77],
      eN: [137, 86], hN: [138, 104], eF: [135, 86], hF: [136, 104],
      kF: [72, 79], fF: [44, 82],
    }),
  },
  {
    names: ['hamstring', 'hamstring stretch', 'supine hamstring', 'strap hamstring'], accent: 'kN', hold: 1500,
    a: SUPINE,
    b: pose(SUPINE, { kN: [94, 96], fN: [88, 68], eN: [118, 108], hN: [96, 98] }),
  },
  {
    names: ['squat', 'deep squat', 'goblet squat', 'air squat', 'bodyweight squat', 'sumo squat', 'squat hold'], accent: 'hip', hold: 1600,
    a: pose(STAND, { eN: [112, 56], hN: [124, 58], eF: [110, 56], hF: [122, 58] }),
    b: {
      head: [118, 57], sh: [111, 73], mid: [102, 90], hip: [92, 108],
      eN: [126, 86], hN: [134, 76], kN: [121, 99], fN: [106, 130],
      eF: [124, 86], hF: [132, 76], kF: [119, 101], fF: [104, 130],
    },
  },
];

const ease = t => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const lerp = (a, b, t) => Object.fromEntries(Object.keys(a).map(k => [k, [a[k][0] + (b[k][0] - a[k][0]) * t, a[k][1] + (b[k][1] - a[k][1]) * t]]));
// Through an optional middle pose, so a limb can swing round instead of cutting across. Moves described
// by angles (figure-moves.js) blend their angles, so limbs bend rather than shrink on the way.
const mix = (move, t) => (move.pa ? body(lerpPose(move.pa, move.pb, t))
  : move.via ? (t < 0.5 ? lerp(move.a, move.via, t * 2) : lerp(move.via, move.b, t * 2 - 1))
    : lerp(move.a, move.b, t));
const ALL_MOVES = [...MOVES, ...MORE_MOVES];

/** Whether there's an animation for a move name (however it's spelt). */
export const hasFigure = name => !!findByName(ALL_MOVES, name);
const pt = p => `${p[0].toFixed(1)},${p[1].toFixed(1)}`;
// Quadratic through the middle point: control = 2·mid − (start + end) / 2
const through = (a, m, b) => `M${pt(a)} Q${pt([2 * m[0] - (a[0] + b[0]) / 2, 2 * m[1] - (a[1] + b[1]) / 2])} ${pt(b)}`;

/** Animated figure for a move name, or null when there isn't one. */
export function MoveFigure(name) {
  const move = findByName(ALL_MOVES, name);
  if (!move) return null;

  const limb = cls => s('path', { class: `fig-limb ${cls}` });
  const far = { arm: limb('far'), leg: limb('far') };
  const near = { arm: limb('near'), leg: limb('near') };
  const torso = s('path', { class: 'fig-torso' });
  const head = s('circle', { class: 'fig-head', r: 8.5 });
  const glow = s('circle', { class: 'fig-glow', r: 13 });
  const svg = s('svg', { viewBox: '0 0 200 140', class: 'move-figure', 'aria-hidden': 'true' },
    s('defs', {}, s('radialGradient', { id: 'fig-glow' },
      s('stop', { offset: '0%', 'stop-color': '#ff5a4f', 'stop-opacity': 0.7 }),
      s('stop', { offset: '100%', 'stop-color': '#ff5a4f', 'stop-opacity': 0 }))),
    move.floor === false ? null : s('line', { class: 'fig-floor', x1: 14, x2: 186, y1: 131.5, y2: 131.5 }),
    (move.props ?? []).map(([x1, y1, x2, y2]) => s('line', { class: 'fig-floor fig-prop', x1, y1, x2, y2 })),
    far.leg, far.arm, glow, torso, head, near.leg, near.arm);

  const draw = (p, strength) => {
    far.arm.setAttribute('d', `M${pt(p.sh)} L${pt(p.eF)} L${pt(p.hF)}`);
    far.leg.setAttribute('d', `M${pt(p.hip)} L${pt(p.kF)} L${pt(p.fF)}`);
    near.arm.setAttribute('d', `M${pt(p.sh)} L${pt(p.eN)} L${pt(p.hN)}`);
    near.leg.setAttribute('d', `M${pt(p.hip)} L${pt(p.kN)} L${pt(p.fN)}`);
    torso.setAttribute('d', `${through(p.sh, p.mid, p.hip)} M${pt(p.sh)} L${pt([(p.sh[0] * 2 + p.head[0]) / 3, (p.sh[1] * 2 + p.head[1]) / 3])}`);
    head.setAttribute('cx', p.head[0].toFixed(1));
    head.setAttribute('cy', p.head[1].toFixed(1));
    glow.setAttribute('cx', p[move.accent][0].toFixed(1));
    glow.setAttribute('cy', p[move.accent][1].toFixed(1));
    glow.style.opacity = (0.35 + 0.65 * strength).toFixed(2);
  };

  const end = move.pa ? body(move.pb) : move.b;
  // Still image for reduced motion: the stretched pose
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
    draw(end, 1);
    return svg;
  }

  // Cycle: hold A, ease to B, hold B (the stretch), ease back
  const travel = move.travel ?? 1300, hold = move.hold, cycle = 2 * (travel + hold);
  const t0 = performance.now();
  const frame = now => {
    if (!svg.isConnected && now - t0 > 500) return; // left the screen
    const t = (now - t0) % cycle;
    let k;
    if (t < hold * 0.6) k = 0;
    else if (t < hold * 0.6 + travel) k = ease((t - hold * 0.6) / travel);
    else if (t < hold * 1.6 + travel) k = 1;
    else if (t < hold * 1.6 + 2 * travel) k = 1 - ease((t - hold * 1.6 - travel) / travel);
    else k = 0;
    draw(mix(move, k), k);
    requestAnimationFrame(frame);
  };
  draw(mix(move, 0), 0);
  requestAnimationFrame(frame);
  return svg;
}
