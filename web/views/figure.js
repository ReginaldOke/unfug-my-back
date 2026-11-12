// Animated line figure for routine moves: a side-on body that eases between two poses, with a soft red
// glow where the move works. Limbs taper from thigh to shin and upper arm to forearm, the far side is
// drawn fainter, and hands or feet planted on the floor stay there while the joints bend around them.
// Calm activities (breathing, a body scan) get a soft abstract guide instead (calm.js). Poses live in
// figure-moves.js and figure-library.js; unknown moves get no figure.
import { s } from '../lib/ui.js';
import { findByName } from '../lib/move-names.js';
import { MORE_MOVES, FLOOR, body, lerpPose, reach } from './figure-moves.js';
import { LIBRARY_MOVES } from './figure-library.js';
import { CalmGuide } from './calm.js';
import { CALM } from '../lib/calm.js';

// Seen from above: lying on one side, knees bent forward, arms out in front together. The one move
// still given as points, as the top arm swings over (end-on) on its way round.
const OPEN_BOOK = {
  names: ['open book', 'thoracic rotation', 'side lying rotation', 'book opener', 't spine rotation'], accent: 'sh', hold: 1000, travel: 1700, floor: false, feet: false,
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
};

// Smootherstep: starts and stops with no jolt, for an unhurried, even glide
const ease = t => t * t * t * (t * (t * 6 - 15) + 10);
const lerp = (a, b, t) => Object.fromEntries(Object.keys(a).map(k => [k, [a[k][0] + (b[k][0] - a[k][0]) * t, a[k][1] + (b[k][1] - a[k][1]) * t]]));

/** The joints of a move at k (0 = first pose, 1 = second), with planted hands and feet kept in place. */
export function poseAt(move, k, breath = 0) {
  if (!move.pa) return move.via ? (k < 0.5 ? lerp(move.a, move.via, k * 2) : lerp(move.via, move.b, k * 2 - 1)) : lerp(move.a, move.b, k);
  // Through an optional middle pose (pm), so a foot or hand can keep its place on the way
  let p = move.pm ? (k < 0.5 ? lerpPose(move.pa, move.pm, k * 2) : lerpPose(move.pm, move.pb, k * 2 - 1)) : lerpPose(move.pa, move.pb, k);
  // A slow breath through the holds: the chest rises a touch
  if (breath) p = { ...p, bend: (p.bend ?? 0) + breath * 0.8 };
  const opts = { supine: move.supine, free: !!move.view };
  if (move.plant) {
    const start = body(move.pa);
    for (const end of move.plant) p = reach(p, end, start[end], opts);
  }
  // Hands that hold on to a leg (behind the thigh, round a knee) follow it
  for (const [end, [a, b, f]] of Object.entries(move.grip ?? {})) {
    const j = body(p);
    p = reach(p, end, [j[a][0] + (j[b][0] - j[a][0]) * f, j[a][1] + (j[b][1] - j[a][1]) * f], opts);
  }
  // Hands and feet slide along the floor rather than sinking into it on the way between poses
  if (move.floor !== false) {
    const j = body(p);
    for (const end of ['hN', 'hF', 'fN', 'fF']) if (j[end][1] > FLOOR + 0.5 && !move.plant?.includes(end)) p = reach(p, end, [j[end][0], FLOOR], opts);
  }
  return body(p);
}

export const ALL_MOVES = [...MORE_MOVES, OPEN_BOOK, ...LIBRARY_MOVES];

/** Whether there's an animation for a move name (however it's spelt). */
export const hasFigure = name => !!findByName([...ALL_MOVES, ...CALM], name);
const pt = p => `${p[0].toFixed(1)},${p[1].toFixed(1)}`;
// Quadratic through the middle point: control = 2·mid − (start + end) / 2
const through = (a, m, b) => `M${pt(a)} Q${pt([2 * m[0] - (a[0] + b[0]) / 2, 2 * m[1] - (a[1] + b[1]) / 2])} ${pt(b)}`;
const toward = (a, b, d) => { const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; return [a[0] + ((b[0] - a[0]) * d) / l, a[1] + ((b[1] - a[1]) * d) / l]; };
const HEAD_R = 11.5, FOOT = 7;
// Where the floor line sits: a little below the joints, as the chunky limbs have width
const FLOOR_LINE = 133.5;
let figId = 0;

/** A thumbnail's view: just the space the move uses, a little padded, in the thumbnail's shape (58 × 42). */
function fitBox(move) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (let k = 0; k <= 1; k += 0.125) {
    for (const p of Object.values(poseAt(move, k))) {
      if (!Array.isArray(p) || typeof p[0] !== 'number') continue;
      x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]);
    }
  }
  const pad = HEAD_R + 6;
  x0 -= pad; y0 -= pad; x1 += pad; y1 = Math.max(y1 + pad, move.floor === false ? y1 + pad : FLOOR_LINE + 3);
  let w = x1 - x0, hgt = y1 - y0;
  const ratio = 58 / 42;
  if (w / hgt < ratio) { const nw = hgt * ratio; x0 -= (nw - w) / 2; w = nw; } else { const nh = w / ratio; y0 -= nh - hgt; hgt = nh; }
  return `${x0.toFixed(1)} ${y0.toFixed(1)} ${w.toFixed(1)} ${hgt.toFixed(1)}`;
}

/**
 * Animated figure for a move name, or null when there isn't one. `small` draws a thumbnail (no glow,
 * framed tight on the figure so it reads at a glance); `at` draws a still at that point of the move.
 */
export function MoveFigure(name, { small = false, at = null } = {}) {
  // Movements and calm activities are matched together, so the closer name wins
  const move = findByName([...ALL_MOVES, ...CALM], name);
  if (!move) return null;
  if (move.kind) return CalmGuide(move, { small });

  // The mascot: a sporty little figure in a red top, sleeves and shoes, with a red headband whose tails
  // flap behind as it moves, and a calm, content face (an eye that blinks, a blush, a small smile that
  // tightens a touch at the hardest point)
  const seed = ++figId;
  const seg = cls => s('path', { class: `fig-seg ${cls}` });
  const side = cls => ({
    upper: seg(`${cls} arm-u`), fore: seg(`${cls} arm-l`), thigh: seg(`${cls} leg-u`), shin: seg(`${cls} leg-l`), foot: seg(`${cls} foot`),
    sleeve: seg(`${cls} kit sleeve`), shoe: seg(`${cls} kit shoe`),
  });
  const far = side('far'), near = side('near');
  const torso = s('path', { class: 'fig-torso' });
  const neck = s('path', { class: 'fig-neck' });
  const tails = s('path', { class: 'fig-tails' });
  const clipId = `fig-head-${seed}`;
  const face = s('g', {},
    s('circle', { class: 'fig-head', r: HEAD_R }),
    s('path', { class: 'fig-band', d: `M${-HEAD_R - 1} ${-HEAD_R * 0.5} L${HEAD_R + 1} ${-HEAD_R * 0.6}`, 'clip-path': `url(#${clipId})` }),
    s('circle', { class: 'fig-blush', cx: 4.6, cy: 3.4, r: 2.2 }));
  const eye = s('path', { class: 'fig-feature' });
  const mouth = s('path', { class: 'fig-feature' });
  face.append(eye, mouth);
  const glow = s('circle', { class: 'fig-glow', r: 15 });
  const svg = s('svg', { viewBox: small ? fitBox(move) : '0 0 200 140', class: `move-figure${small ? ' small' : ''}`, 'aria-hidden': 'true' },
    s('defs', {},
      s('radialGradient', { id: 'fig-glow' },
        s('stop', { offset: '0%', 'stop-color': '#ff5a4f', 'stop-opacity': 0.7 }),
        s('stop', { offset: '100%', 'stop-color': '#ff5a4f', 'stop-opacity': 0 })),
      s('clipPath', { id: clipId }, s('circle', { r: HEAD_R }))),
    move.floor === false ? null : s('line', { class: 'fig-floor', x1: 14, x2: 186, y1: FLOOR_LINE, y2: FLOOR_LINE }),
    (move.props ?? []).map(([x1, y1, x2, y2]) => s('line', { class: 'fig-floor fig-prop', x1, y1, x2, y2 })),
    small ? null : glow,
    s('g', {}, far.thigh, far.shin, far.foot, far.shoe, far.upper, far.fore, far.sleeve, torso, neck, tails, face,
      near.thigh, near.shin, near.foot, near.shoe, near.upper, near.fore, near.sleeve));

  // Feet point forward from the ankle (the other way for a body lying face up), along the shin when
  // pointed (lying face down), or are left off when the leg is seen end-on
  const footTo = (ankle, knee) => {
    const shin = Math.atan2(ankle[1] - knee[1], ankle[0] - knee[0]);
    const a = move.feet === 'point' ? shin : shin + (move.supine ? 1 : -1) * Math.PI / 2;
    return [ankle[0] + Math.cos(a) * FOOT, ankle[1] + Math.sin(a) * FOOT];
  };
  const line = (el, a, b) => el.setAttribute('d', `M${pt(a)} L${pt(b)}`);
  const along = (a, b, f) => [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
  // The face looks the way the body faces: forward when upright, up when lying face up. The face is drawn
  // side-on with x toward the front and y toward the chin, then turned (and flipped, lying face up) to fit.
  const faceAngle = p => Math.atan2(p.head[1] - p.sh[1], p.head[0] - p.sh[0]) + (move.supine ? -1 : 1) * Math.PI / 2 * (move.view ? 0.4 : 1);
  const onFace = (p, x, y) => {
    const a = faceAngle(p), f = move.supine ? -1 : 1;
    return [p.head[0] + Math.cos(a) * x - Math.sin(a) * y * f, p.head[1] + Math.sin(a) * x + Math.cos(a) * y * f];
  };
  // The headband's two tails trail from the back of the head, each end easing after the one before
  let tail = null;
  const flap = (p, t, settle) => {
    const knot = onFace(p, -HEAD_R + 1, -HEAD_R * 0.55), sway = Math.sin(t / 260) * 1.2;
    const goal = [[knot[0] - 7, knot[1] + 3], null, [knot[0] - 5, knot[1] + 6]];
    const follow = (from, to, f) => (settle || !from ? to : along(from, to, f));
    let a1 = follow(tail?.[0], goal[0], 0.25), b1 = follow(tail?.[2], goal[2], 0.22);
    let a2 = follow(tail?.[1], [a1[0] - 6, a1[1] + 4 + sway], 0.2), b2 = follow(tail?.[3], [b1[0] - 5, b1[1] + 5 - sway], 0.18);
    // They rest on the floor rather than sinking through it (lying down, the knot is near the floor)
    tail = [a1, a2, b1, b2].map(q => (move.floor === false ? q : [q[0], Math.min(q[1], FLOOR_LINE - 1.5)]));
    [a1, a2, b1, b2] = tail;
    tails.setAttribute('d', `M${pt(knot)} Q${pt(a1)} ${pt(a2)} M${pt(knot)} Q${pt(b1)} ${pt(b2)}`);
  };
  const draw = (p, strength, blink = 1, t = 0, settle = true) => {
    const limbs = (sd, e, h, k, f) => {
      line(sd.upper, p.sh, e); line(sd.fore, e, h); line(sd.thigh, p.hip, k); line(sd.shin, k, f);
      line(sd.sleeve, p.sh, along(p.sh, e, 0.45));
      if (move.feet !== false && p.angles) { const toe = footTo(f, k); line(sd.foot, f, toe); line(sd.shoe, along(f, k, 0.05), toe); }
    };
    limbs(far, p.eF, p.hF, p.kF, p.fF);
    limbs(near, p.eN, p.hN, p.kN, p.fN);
    torso.setAttribute('d', through(p.sh, p.mid, p.hip));
    // The neck runs from the shoulders right into the head, so the two never part
    line(neck, p.sh, toward(p.head, p.sh, HEAD_R * 0.6));
    face.setAttribute('transform', `translate(${pt(p.head)}) rotate(${(faceAngle(p) * 180 / Math.PI).toFixed(1)})${move.supine ? ' scale(1,-1)' : ''}`);
    eye.setAttribute('d', `M3.8 -0.6 Q5.8 ${(-0.6 - 1.6 * blink).toFixed(2)} 7.8 -0.6`);
    mouth.setAttribute('d', `M6 5 Q8.2 ${(6.8 - strength * 0.8).toFixed(2)} 10.2 4.6`);
    flap(p, t, settle);
    glow.setAttribute('cx', p[move.accent][0].toFixed(1));
    glow.setAttribute('cy', p[move.accent][1].toFixed(1));
    glow.style.opacity = (0.35 + 0.65 * strength).toFixed(2);
  };

  // A still at one point of the move (`at`, 0 to 1), or the stretched pose for reduced motion
  if (at != null || matchMedia('(prefers-reduced-motion: reduce)').matches) {
    draw(poseAt(move, at ?? 1), at ?? 1);
    return svg;
  }

  // Cycle: hold A, glide to B, hold B (the stretch), glide back, breathing softly all the while
  const travel = move.travel ?? 1500, hold = move.hold, cycle = 2 * (travel + hold);
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
    const b = (now - t0 + seed * 700) % 4600;
    draw(poseAt(move, k, Math.sin((now - t0) / 650)), k, b < 140 ? Math.abs(b - 70) / 70 : 1, now - t0, false);
    requestAnimationFrame(frame);
  };
  draw(poseAt(move, 0), 0);
  requestAnimationFrame(frame);
  return svg;
}
