// Little celebrations for milestones (lib/milestones.js), starring the mascot from the routine player:
// watering a sprout after the first check-in, juggling three balls for three days, a party for a week, flexing at two weeks, a trophy at a
// month, a backflip at three months, a flag on a summit at six. A week without a flare is a backbend,
// two weeks a hula hoop, and a month a deckchair in the sun. Each is a run of poses (in figure-moves.js's angles) with its
// own props, and most play an opening once and then loop their happiest part.
import { s } from '../lib/ui.js';
import { mascot } from './figure.js';
import { body, lerpPose, on, reach, FLOOR } from './figure-moves.js';

const FLOOR_LINE = 133.5;
const inOut = t => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const out = t => 1 - (1 - t) ** 3;
const inn = t => t * t * t;
const lin = t => t;
const pt = p => `${p[0].toFixed(1)},${p[1].toFixed(1)}`;
const clamp01 = v => Math.max(0, Math.min(1, v));
// Where t is between a and b, 0 to 1
const span = (t, a, b) => clamp01((t - a) / (b - a));

// turn: a front-facing figure turns its face to the side (past 0.5), to kiss a bicep
const BASE = { hip: [100, 75], torso: -90, head: -90, bend: 0, armN: [92, 88], armF: [88, 92], legN: [90, 90], legF: [90, 90], lift: 0, rot: 0, turn: 0 };
const P = (patch, base = BASE) => ({ ...base, ...patch });

/**
 * The pose at t along keys [[ms, pose, ease?, via?]], each eased in from the one before. A key with a
 * via pose passes through it on the way, in one movement with no stop there.
 */
function track(keys, t) {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 0; i < keys.length - 1; i++) {
    const [a, pa] = keys[i], [b, pb, e = inOut, via] = keys[i + 1];
    if (t >= b) continue;
    const k = e((t - a) / (b - a));
    if (!via) return lerpPose(pa, pb, k);
    // A curve through the via pose (its control point puts the curve's middle there), so there's no corner
    const ctrl = lerpPose(lerpPose(pa, pb, 0.5), via, 2);
    return lerpPose(lerpPose(pa, ctrl, k), lerpPose(ctrl, pb, k), k);
  }
  return keys.at(-1)[1];
}

/** A four-point sparkle, centred on 0,0. */
const SPARK = r => `M0 ${-r} Q${r * 0.18} ${-r * 0.18} ${r} 0 Q${r * 0.18} ${r * 0.18} 0 ${r} Q${-r * 0.18} ${r * 0.18} ${-r} 0 Q${-r * 0.18} ${-r * 0.18} 0 ${-r}Z`;

/** Sparkles that pop in and fade at places [x, y, at ms, size], each `every` ms. */
function sparkles(g, spots, every) {
  const els = spots.map(([x, y, , r = 5]) => { const el = s('path', { class: 'cheer-spark', d: SPARK(r) }); el.dataset.x = x; el.dataset.y = y; g.append(el); return el; });
  return t => spots.forEach(([x, y, at], i) => {
    const u = ((t - at) % every + every) % every / 700;
    const k = u < 1 ? Math.sin(u * Math.PI) : 0;
    els[i].setAttribute('transform', `translate(${x} ${y}) scale(${(0.2 + k * 0.8).toFixed(2)}) rotate(${(u * 90).toFixed(0)})`);
    els[i].style.opacity = k.toFixed(2);
  });
}

/** Confetti drifting down through the box, round and round. */
function confetti(g, n, { top = -40, bottom = 130, x0 = 20, x1 = 180, fall = 3400 } = {}) {
  const bits = Array.from({ length: n }, (_, i) => {
    const r = (i * 7919) % 1000 / 1000, q = (i * 104729) % 1000 / 1000;
    const el = s('rect', { class: `cheer-bit c${i % 3}`, width: 3.2, height: 5.5, x: -1.6, y: -2.75, rx: 0.8 });
    g.append(el);
    return { el, x: x0 + (x1 - x0) * r, delay: q * fall, sway: 4 + q * 6, spin: 200 + r * 300 };
  });
  return t => {
    for (const b of bits) {
      const u = ((t + b.delay) % fall) / fall;
      const y = top + (bottom - top) * u, x = b.x + Math.sin(u * 9 + b.delay) * b.sway;
      b.el.setAttribute('transform', `translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${((u * b.spin) % 360).toFixed(0)}) scale(1 ${Math.cos(u * 14 + b.delay).toFixed(2)})`);
      b.el.style.opacity = (u < 0.1 ? u * 10 : u > 0.85 ? (1 - u) / 0.15 : 1).toFixed(2);
    }
  };
}

const ground = (x1 = 22, x2 = 178) => s('line', { class: 'fig-floor', x1, x2, y1: FLOOR_LINE, y2: FLOOR_LINE });

// ---------- Three days: juggling three balls, seen from the front ----------
const JUGGLE_BEAT = 1800; // one full round for each ball
const juggle = {
  box: '20 -24 160 166', view: 'front', feet: false, loop: [0, JUGGLE_BEAT * 2], still: 500,
  // Feet planted a little apart, elbows in at the sides, forearms out in front (drawn short, as they
  // point at you). Each hand scoops: it dips out to catch, then rises in to throw, taking turns.
  pose(t) {
    const hand = phase => {
      const a = (((t / JUGGLE_BEAT) * 3 + phase) % 1) * Math.PI * 2;
      return { angle: -4 - Math.cos(a) * 18, len: 11 + Math.sin(a) * 1.5 };
    };
    const n = hand(0.5), f = hand(0);
    return P({ armN: [72, n.angle, 18, n.len], armF: [108, 180 - f.angle, 18, f.len], legN: [86, 90], legF: [94, 90] });
  },
  props({ front, back }) {
    back.append(ground(50, 150));
    const balls = [0, 1, 2].map(i => { const el = s('circle', { class: `cheer-ball b${i}`, r: 4.6 }); front.append(el); return el; });
    return (t, j) => balls.forEach((el, i) => {
      // Thrown from the left hand, caught in the right, then back again (a cascade, the throws taking turns)
      const u = ((t / JUGGLE_BEAT) + i / 3) % 1;
      const L = [j.hF[0], j.hF[1] - 4.5], R = [j.hN[0], j.hN[1] - 4.5];
      const arc = (a, b, v, hgt) => [a[0] + (b[0] - a[0]) * v, a[1] + (b[1] - a[1]) * v - 4 * hgt * v * (1 - v)];
      const at = u < 0.375 ? arc(L, R, u / 0.375, 52 + i * 3) : u < 0.5 ? R : u < 0.875 ? arc(R, L, (u - 0.5) / 0.375, 48 + i * 3) : L;
      el.setAttribute('cx', at[0].toFixed(1)); el.setAttribute('cy', at[1].toFixed(1));
    });
  },
};

// ---------- The first check-in: a seed watered, and a sprout coming up ----------
const SOIL = [134, FLOOR_LINE];
const CAN_DOWN = P({ hip: [80, 75], armN: [74, 52], armF: [96, 86] });
const POUR = P({ hip: [82, 75], torso: -80, head: -60, bend: -2, armN: [12, 4], armF: [96, 86], legN: [84, 96], legF: [98, 86] });
const PROUD_SPROUT = P({ hip: [80, 75], head: -76, armN: [74, 52], armF: [96, 86], legN: [88, 92], legF: [94, 88] });
const sprout = {
  box: '24 -2 152 150', loop: [3600, 6400], still: 4200,
  keys: [[0, CAN_DOWN], [500, CAN_DOWN], [1100, POUR], [2600, P({ ...POUR, armN: [6, -2] })], [3100, CAN_DOWN],
    [3400, P({ ...PROUD_SPROUT, lift: 5 }), out], [3600, PROUD_SPROUT, inn], [5000, P({ ...PROUD_SPROUT, head: -82 })], [6400, PROUD_SPROUT]],
  props({ back, front }) {
    back.append(ground(), s('path', { class: 'cheer-soil', d: `M${SOIL[0] - 13} ${SOIL[1]} Q${SOIL[0]} ${SOIL[1] - 7} ${SOIL[0] + 13} ${SOIL[1]} Z` }));
    const stem = s('path', { class: 'cheer-stem' });
    const leaves = [0, 1].map(() => { const el = s('path', { class: 'cheer-leaf', d: 'M0 0 Q5 -5 11 -1 Q5 3 0 0 Z' }); back.append(el); return el; });
    back.prepend(stem);
    const drops = Array.from({ length: 5 }, () => { const el = s('circle', { class: 'cheer-drop', r: 1.4 }); front.append(el); return el; });
    const can = s('g', { class: 'cheer-can' },
      s('path', { class: 'body', d: 'M-6 -7 L6 -7 L5 5 L-5 5 Z' }),
      s('path', { class: 'spout', d: 'M5 -2 L15 -9' }),
      s('path', { class: 'handle', d: 'M-6 -4 Q-11 -1 -6 3' }));
    front.append(can);
    // Sparkles round the sprout once it's up
    const glint = s('g');
    front.append(glint);
    const shine = sparkles(glint, [[150, 82, 3700, 4], [120, 92, 4300, 3.5], [146, 104, 5000, 3]], 2800);
    return (t, j) => {
      // The can is held by its handle and tips forward to pour
      const tip = span(t, 700, 1100) * (1 - span(t, 2600, 3100));
      const at = [j.hN[0] + 5, j.hN[1] + 1];
      can.setAttribute('transform', `translate(${pt(at)}) rotate(${(tip * 62).toFixed(1)})`);
      // Water comes from the end of the spout (15, -9 on the can), turned with it
      const r = tip * 62 * Math.PI / 180, mouth = [at[0] + 15 * Math.cos(r) + 9 * Math.sin(r), at[1] + 15 * Math.sin(r) - 9 * Math.cos(r)];
      drops.forEach((el, i) => {
        const u = ((t / 420) + i / drops.length) % 1;
        el.setAttribute('cx', (mouth[0] + u * 6).toFixed(1));
        el.setAttribute('cy', (mouth[1] + u * (SOIL[1] - 6 - mouth[1])).toFixed(1));
        el.style.opacity = (tip > 0.8 ? 1 - u * 0.4 : 0).toFixed(2);
      });
      // The sprout comes up while it's watered, opens its leaves, then sways a little
      const grow = out(span(t, 1300, 3200)), open = out(span(t, 2400, 3600));
      const sway = t > 3600 ? Math.sin(t / 500) * 2 : 0;
      const top = [SOIL[0] + sway, SOIL[1] - 4 - grow * 30];
      stem.setAttribute('d', `M${SOIL[0]} ${SOIL[1] - 3} Q${SOIL[0] - 3} ${(SOIL[1] - 4 - grow * 15).toFixed(1)} ${pt(top)}`);
      stem.style.opacity = grow > 0.02 ? 1 : 0;
      leaves.forEach((el, i) => {
        el.setAttribute('transform', `translate(${pt(top)}) rotate(${i ? 200 - open * 10 : -20 + open * 10}) scale(${(open * (i ? 1.3 : 1.5)).toFixed(2)}${i ? ' -1' : ''})`);
      });
      glint.style.opacity = t > 3500 ? 1 : 0;
      shine(t);
    };
  },
};

// ---------- A week: party hat, a sign on a stick, bouncing to the beat ----------
const partyPose = (k, wave) => P({
  hip: [100, 76 + k * 4], head: -90 + (k - 0.5) * 10,
  armN: [-30, -100], armF: [-160, -110 + wave * 22],
  legN: [86 - k * 5, 90 + k * 10], legF: [94 + k * 5, 90 - k * 10],
});
const party = {
  box: '14 -46 172 188', view: 'front', feet: false,
  pose(t) {
    const beat = (t % 520) / 520, k = 1 - Math.abs(Math.sin(beat * Math.PI));
    return partyPose(k, Math.sin(t / 180));
  },
  props({ back, front }) {
    back.append(ground(40, 160));
    const conf = confetti(back, 22);
    // A little stick with a placard, in the right hand
    const stick = s('line', { class: 'cheer-stick' });
    const sign = s('g', { class: 'cheer-sign' },
      s('rect', { x: -27, y: -14, width: 54, height: 24, rx: 5 }),
      s('text', { x: 0, y: 3.6, 'text-anchor': 'middle' }, '1 week'));
    const hat = s('g', { class: 'cheer-hat' },
      s('path', { class: 'cone', d: 'M-8 0 L0 -21 L8 0 Z' }),
      s('path', { class: 'stripe', d: 'M-5.6 -6.5 L5.6 -6.5 M-3.2 -13 L3.2 -13' }),
      s('circle', { class: 'pom', cx: 0, cy: -22, r: 3.2 }));
    front.append(stick, sign, hat);
    return (t, j) => {
      conf(t);
      const hand = j.hN, tilt = Math.sin(t / 260) * 6;
      const a = (-90 + tilt) * Math.PI / 180, top = [hand[0] + Math.cos(a) * 26, hand[1] + Math.sin(a) * 26];
      stick.setAttribute('x1', hand[0] - Math.cos(a) * 9); stick.setAttribute('y1', hand[1] - Math.sin(a) * 9);
      stick.setAttribute('x2', top[0]); stick.setAttribute('y2', top[1]);
      sign.setAttribute('transform', `translate(${pt(top)}) rotate(${tilt.toFixed(1)}) translate(0 -8)`);
      const ha = Math.atan2(j.head[1] - j.sh[1], j.head[0] - j.sh[0]) * 180 / Math.PI + 90;
      const at = [j.head[0] + Math.cos((ha - 90) * Math.PI / 180) * 9.5, j.head[1] + Math.sin((ha - 90) * Math.PI / 180) * 9.5];
      hat.setAttribute('transform', `translate(${pt(at)}) rotate(${(ha + 12).toFixed(1)})`);
    };
  },
};

// ---------- Two weeks: a double biceps, a pump, and a kiss for the right arm ----------
// Upper arms drawn a little long, so the fists clear the head
const RELAX = P({ armN: [76, 96, 25, 17], armF: [104, 84, 25, 17], legN: [84, 90], legF: [96, 90] });
const FLEX = P({ armN: [8, -84, 25, 17], armF: [172, -96, 25, 17], legN: [80, 90], legF: [100, 90] });
const PUMP = P({ armN: [2, -110, 25, 17], armF: [178, -70, 25, 17], legN: [78, 92], legF: [102, 88], hip: [100, 77] });
const KISS = P({ armN: [-4, -128, 25, 17], armF: [172, -96, 25, 17], head: -58, torso: -86, legN: [80, 90], legF: [100, 90], turn: 1 });
const flex = {
  box: '14 -24 172 166', view: 'front', feet: false, loop: [0, 4800], still: 1000,
  keys: [[0, RELAX], [500, RELAX], [900, FLEX, out], [1200, PUMP], [1450, FLEX], [1700, PUMP], [1950, FLEX], [2700, FLEX], [3100, KISS], [3700, KISS], [4100, FLEX], [4400, FLEX], [4800, RELAX]],
  props({ back, front }) {
    back.append(ground(40, 160));
    // Biceps that swell as the arms bend
    const muscles = [0, 1].map(() => { const el = s('ellipse', { class: 'cheer-bicep' }); front.append(el); return el; });
    const shine = sparkles(front, [[136, 14, 1000, 5], [64, 18, 1300, 4], [142, 34, 2200, 3.5], [58, 6, 2000, 5]], 4800);
    const kiss = s('path', { class: 'cheer-heart', d: 'M0 2.6 C-4.4 -0.6 -3.6 -4.6 -1.2 -4.6 C-0.4 -4.6 0 -4 0 -3.4 C0 -4 0.4 -4.6 1.2 -4.6 C3.6 -4.6 4.4 -0.6 0 2.6Z' });
    front.append(kiss);
    return (t, j) => {
      shine(t);
      for (const [el, sh, e, hand] of [[muscles[0], j.sh, j.eN, j.hN], [muscles[1], j.sh, j.eF, j.hF]]) {
        const bentness = clamp01((Math.PI - Math.acos(Math.max(-1, Math.min(1, ((sh[0] - e[0]) * (hand[0] - e[0]) + (sh[1] - e[1]) * (hand[1] - e[1])) / (Math.hypot(sh[0] - e[0], sh[1] - e[1]) * 18))))) / 2.2);
        const ang = Math.atan2(e[1] - sh[1], e[0] - sh[0]);
        // The bulge sits on top of the middle of the upper arm, just past the sleeve
        const mid = [sh[0] + (e[0] - sh[0]) * 0.64, sh[1] + (e[1] - sh[1]) * 0.64 - 2.6 - bentness * 1.6];
        el.setAttribute('cx', mid[0].toFixed(1)); el.setAttribute('cy', mid[1].toFixed(1));
        el.setAttribute('rx', (2.8 + bentness * 1).toFixed(1)); el.setAttribute('ry', (1.8 + bentness * 2.2).toFixed(1));
        el.setAttribute('transform', `rotate(${(ang * 180 / Math.PI).toFixed(0)} ${pt(mid)})`);
      }
      const u = span(t, 3350, 4300);
      kiss.style.opacity = (u > 0 && u < 1 ? Math.sin(u * Math.PI) : 0).toFixed(2);
      kiss.setAttribute('transform', `translate(${(124 + u * 10).toFixed(1)} ${(10 - u * 22).toFixed(1)}) scale(${(1 + u * 0.8).toFixed(2)})`);
    };
  },
};

// ---------- A month: crouch, spring, a tucked backflip, and a landing stuck with arms up ----------
const STAND_UP = P({ armN: [-62, -70], armF: [-58, -66] });
const CROUCH = P({ hip: [92, 98], torso: -62, head: -70, armN: [140, 150], armF: [136, 146], legN: [12, 112], legF: [14, 114] });
const LAUNCH = P({ torso: -96, head: -100, armN: [-100, -105], armF: [-96, -100], lift: 26 });
const TUCK = P({ hip: [96, 75], torso: -100, head: -80, bend: -6, armN: [-10, 80], armF: [-6, 84], legN: [-40, 92], legF: [-36, 96], lift: 52 });
const LAND = P({ hip: [96, 96], torso: -70, head: -78, armN: [-10, -10], armF: [-14, -14], legN: [20, 116], legF: [22, 118], rot: -360 });
const flip = {
  box: '14 -52 172 194', loop: [0, 4200], still: 2600,
  keys: [
    [0, BASE], [500, BASE], [950, CROUCH], [1150, LAUNCH, out],
    [1300, P({ ...TUCK, rot: -40, lift: 46 }), lin], [1520, P({ ...TUCK, rot: -180, lift: 62 }), lin], [1740, P({ ...TUCK, rot: -320, lift: 44 }), lin],
    [1880, P({ ...LAND, lift: 0 }), out], [2250, P({ ...STAND_UP, rot: -360 })], [3700, P({ ...STAND_UP, rot: -360 })], [4200, P({ ...BASE, rot: -360 })],
  ],
  // Spins round the middle of the body
  pivot: j => [(j.hip[0] + j.sh[0]) / 2, (j.hip[1] + j.sh[1]) / 2 + 6],
  props({ back, front }) {
    back.append(ground());
    const swoosh = s('path', { class: 'cheer-swoosh' });
    back.append(swoosh);
    const stars = sparkles(front, [[60, 30, 2000, 6], [140, 20, 2150, 5], [150, 60, 2300, 4], [52, 66, 2250, 4.5]], 4200);
    const dust = [0, 1].map(() => { const el = s('circle', { class: 'cheer-dust', r: 3 }); back.append(el); return el; });
    return (t, j) => {
      stars(t);
      // A faint arc where the flip went
      const u = span(t, 1250, 1880), fade = span(t, 1880, 2300);
      const r = 40, cx = 96, cy = 46, to = -90 - 330 * u, from = Math.min(-90, to + 140);
      if (u > 0 && fade < 1) {
        const a0 = from * Math.PI / 180, a1 = to * Math.PI / 180;
        swoosh.setAttribute('d', `M${pt([cx + r * Math.cos(a0), cy + r * Math.sin(a0)])} A${r} ${r} 0 0 0 ${pt([cx + r * Math.cos(a1), cy + r * Math.sin(a1)])}`);
        swoosh.style.opacity = ((1 - fade) * 0.5).toFixed(2);
      } else swoosh.style.opacity = 0;
      const d = span(t, 1860, 2400);
      dust.forEach((el, i) => {
        el.setAttribute('cx', (96 + (i ? 1 : -1) * (6 + d * 22)).toFixed(1)); el.setAttribute('cy', (FLOOR_LINE - 2 - d * 5).toFixed(1));
        el.setAttribute('r', (2 + d * 4).toFixed(1)); el.style.opacity = (d > 0 && d < 1 ? (1 - d) * 0.6 : 0).toFixed(2);
      });
    };
  },
};

// ---------- Three months: up on the podium, a trophy lifted high ----------
const PODIUM = 18;
// Side on, the cup goes up and forward, so it never hides the face
const HOLD_CUP = P({ hip: [100, 75 - PODIUM], armN: [70, -20], armF: [66, -24], legN: [88, 92], legF: [92, 88] });
const RAISE_CUP = P({ hip: [100, 75 - PODIUM], torso: -94, head: -104, armN: [-58, -74], armF: [-54, -70], legN: [88, 92], legF: [92, 88] });
const PUMP_CUP = P({ ...RAISE_CUP, hip: [100, 79 - PODIUM], torso: -88, head: -96, armN: [-40, -64], armF: [-36, -60], legN: [70, 112], legF: [74, 108] });
const trophy = {
  box: '16 -50 168 192', ground: FLOOR - PODIUM, loop: [1600, 3200], still: 1700,
  keys: [[0, HOLD_CUP], [500, HOLD_CUP], [1100, RAISE_CUP, out], [1600, RAISE_CUP], [2000, PUMP_CUP], [2400, RAISE_CUP], [2800, PUMP_CUP], [3200, RAISE_CUP]],
  props({ back, front }) {
    back.append(ground());
    back.append(s('g', { class: 'cheer-podium' },
      s('rect', { x: 70, y: FLOOR_LINE - PODIUM - 1, width: 60, height: PODIUM + 1, rx: 3 }),
      s('text', { x: 100, y: FLOOR_LINE - 5, 'text-anchor': 'middle' }, '1')));
    const conf = confetti(back, 18, { top: -64 });
    const cup = s('g', { class: 'cheer-cup' },
      s('path', { class: 'bowl', d: 'M-10 -26 L10 -26 Q10 -12 0 -9 Q-10 -12 -10 -26 Z' }),
      s('path', { class: 'handles', d: 'M-10 -23 Q-16 -23 -14 -17 Q-13 -14 -8 -14 M10 -23 Q16 -23 14 -17 Q13 -14 8 -14' }),
      s('path', { class: 'bowl', d: 'M-1.6 -9 L1.6 -9 L2 -3 L-2 -3 Z M-6 -3 L6 -3 L6 0 L-6 0 Z' }),
      s('path', { class: 'shine', d: 'M-6 -23 Q-6 -16 -2 -12' }));
    const glint = sparkles(cup, [[6, -22, 300, 4.5]], 1600);
    front.append(cup);
    return (t, j) => {
      conf(t);
      glint(t);
      cup.setAttribute('transform', `translate(${pt([(j.hN[0] + j.hF[0]) / 2, (j.hN[1] + j.hF[1]) / 2 + 3])}) scale(1.15)`);
    };
  },
};

// ---------- Six months: a flag planted on top of a mountain ----------
const PEAK = 90;
const up = P({ hip: [96, 75 - (FLOOR - PEAK)] });
const CARRY = P({ ...up, torso: -86, armN: [40, -40], armF: [36, -44], legN: [80, 96], legF: [98, 86] });
const LIFT_FLAG = P({ ...up, torso: -92, head: -96, armN: [-40, -70], armF: [-46, -74], legN: [84, 92], legF: [96, 88] });
const PLANT = P({ ...up, hip: [98, 78 - (FLOOR - PEAK)], torso: -80, head: -84, armN: [40, 70], armF: [36, 66], legN: [76, 104], legF: [100, 84] });
const PROUD = P({ ...up, torso: -92, head: -100, armN: [120, -40], armF: [124, -36], legN: [84, 92], legF: [98, 88] });
const summit = {
  box: '8 -40 184 182', ground: PEAK, loop: [2600, 6600], still: 3000,
  keys: [[0, CARRY], [700, CARRY], [1300, LIFT_FLAG, out], [1650, PLANT, inn], [2100, PLANT], [2600, PROUD], [4600, P({ ...PROUD, head: -82 })], [6600, PROUD]],
  props({ back, front }) {
    back.append(s('path', { class: 'cheer-peak', d: `M10 ${FLOOR_LINE} L70 ${PEAK + 26} L84 ${PEAK + 14} L96 ${PEAK + 4.5} L108 ${PEAK + 12} L130 ${PEAK + 30} L190 ${FLOOR_LINE} Z` }),
      s('path', { class: 'cheer-snow', d: `M84 ${PEAK + 14} L96 ${PEAK + 4.5} L108 ${PEAK + 12} L102 ${PEAK + 15} L96 ${PEAK + 11} L90 ${PEAK + 16} Z` }));
    const pole = s('line', { class: 'cheer-pole' });
    const flag = s('path', { class: 'cheer-flag' });
    front.append(pole, flag);
    const base = [122, PEAK + 20];
    return (t, j) => {
      // Carried in the hands until it's planted, then it stays put and the flag unfurls
      const planted = t >= 1650;
      const hand = j.hN;
      const a = planted ? -88 * Math.PI / 180 : Math.atan2(-1, 0.25 + span(t, 0, 1650) * 0.1);
      const bottom = planted ? base : [hand[0] + 10 * Math.cos(a + Math.PI), hand[1] + 10 * Math.sin(a + Math.PI) + (t > 1300 ? span(t, 1300, 1650) * 4 : 0)];
      const top = planted ? [base[0] + 1.6, base[1] - 56] : [bottom[0] + Math.cos(a) * 56, bottom[1] + Math.sin(a) * 56];
      pole.setAttribute('x1', bottom[0].toFixed(1)); pole.setAttribute('y1', bottom[1].toFixed(1));
      pole.setAttribute('x2', top[0].toFixed(1)); pole.setAttribute('y2', top[1].toFixed(1));
      const open = planted ? out(span(t, 1650, 2400)) : 0.12;
      const w = 34 * open, hgt = 20;
      const wave = x => Math.sin(x / 7 - t / 160) * 2.2 * (x / 34);
      const pts = [];
      for (let x = 0; x <= w; x += 2) pts.push([top[0] + x, top[1] + wave(x)]);
      for (let x = w; x >= 0; x -= 2) pts.push([top[0] + x, top[1] + hgt * (0.8 + 0.2 * open) + wave(x)]);
      flag.setAttribute('d', `M${pts.map(pt).join(' L')} Z`);
    };
  },
  // Hands on hips once the flag is in
  adjust(p, t) {
    const k = span(t, 2100, 2600);
    if (!k) return p;
    const j = body(p), hip = j.hip;
    const toward = (end, x) => { const h = j[end]; return [h[0] + (hip[0] + x - h[0]) * k, h[1] + (hip[1] - 4 - h[1]) * k]; };
    return reach(reach(p, 'hN', toward('hN', -2)), 'hF', toward('hF', -4));
  },
};

// ---------- A week without a flare: arms up, a full backbend to a wheel, and back up ----------
const REACH_UP = P({ armN: [-96, -96], armF: [-94, -94], head: -100, bend: 3 });
// A real wheel: hips the highest point, arms straight down to hands flat on the floor behind, the head
// hanging between them, knees over the feet
const HALF_BACK = P({ hip: [110, 78], torso: -140, head: -172, bend: 8, armN: [-168, -172], armF: [-166, -170], legN: [66, 106], legF: [68, 108] });
const WHEEL = P({ hip: [108, 80], torso: -210, head: -290, bend: 10, armN: [-238, -236], armF: [-236, -234], legN: [58, 92], legF: [60, 94] });
const JOY = P({ armN: [-62, -72], armF: [-58, -68], head: -96, lift: 0 });
const backbend = {
  box: '20 -20 160 162', smallBox: '36 -6 112 139.5', loop: [0, 6600], still: 3000,
  // Back, hips and knees all bend in one smooth movement, down and back up
  keys: [[0, BASE], [400, BASE], [1100, REACH_UP], [2700, WHEEL, inOut, HALF_BACK], [3800, P({ ...WHEEL, bend: 13 })], [5300, REACH_UP, inOut, HALF_BACK],
    [5500, P({ ...JOY, lift: 8 }), out], [5750, JOY, inn], [6200, JOY], [6600, BASE]],
  // Hands land on the floor behind, rather than through it
  adjust(p) {
    const j = body(p);
    for (const end of ['hN', 'hF']) if (j[end][1] > FLOOR) p = reach(p, end, [j[end][0], FLOOR]);
    return p;
  },
  props({ back, front }) {
    back.append(ground());
    const glow = sparkles(front, [[68, 64, 2700, 5], [96, 48, 2900, 6], [124, 70, 3100, 4.5], [40, 96, 3300, 4], [104, 20, 5600, 5.5], [72, 14, 5700, 4.5]], 6600);
    return t => glow(t);
  },
};

// ---------- Two weeks without a flare: a hula hoop, hips swinging freely, seen from the front ----------
const HOOP_BEAT = 760; // once round the waist
const hula = {
  box: '24 -14 152 156', smallBox: '42 -6 116 139.5', view: 'front', feet: false, still: 200,
  pose(t) {
    // The hips circle (side to side, seen from the front) and the shoulders lean the other way a touch
    const sway = Math.sin((t / HOOP_BEAT) * Math.PI * 2) * 5;
    return P({ hip: [100 + sway, 75], torso: -90 - sway * 0.9, head: -90 + sway * 0.7, armN: [-46, -64], armF: [-134, -116], legN: [84, 90], legF: [96, 90], sway });
  },
  // Feet stay planted while the hips move over them
  adjust(p) {
    p = reach(p, 'fN', [107, FLOOR], { free: true });
    return reach(p, 'fF', [93, FLOOR], { free: true });
  },
  props({ back, front }) {
    back.append(ground(50, 150));
    const hoopBack = s('path', { class: 'cheer-hoop far' }), hoopFront = s('path', { class: 'cheer-hoop' });
    const bead = s('circle', { class: 'cheer-bead', r: 2.2 });
    back.append(hoopBack);
    front.append(hoopFront, bead);
    const shine = sparkles(front, [[60, 20, 400, 4.5], [142, 34, 1300, 5], [66, 70, 2100, 4]], 2800);
    return (t, j) => {
      shine(t);
      // The hoop rides a little behind the hips' swing, tipping as it goes
      const a = (t / HOOP_BEAT) * Math.PI * 2;
      const cx = j.hip[0] - Math.sin(a - 0.6) * 7, cy = j.hip[1] - 8, rx = 24, ry = 5.5, tilt = Math.sin(a - 0.6) * -6;
      const L = `${(cx - rx).toFixed(1)} ${cy.toFixed(1)}`, R = `${(cx + rx).toFixed(1)} ${cy.toFixed(1)}`;
      const turn = `rotate(${tilt.toFixed(1)} ${cx.toFixed(1)} ${cy.toFixed(1)})`;
      hoopBack.setAttribute('d', `M${L} A${rx} ${ry} 0 0 1 ${R}`);
      hoopFront.setAttribute('d', `M${L} A${rx} ${ry} 0 0 0 ${R}`);
      hoopBack.setAttribute('transform', turn); hoopFront.setAttribute('transform', turn);
      // A bead on the hoop shows it spinning: in front on the way round, behind on the way back
      const bx = cx + Math.cos(a) * rx, by = cy + Math.sin(a) * ry;
      bead.setAttribute('cx', bx.toFixed(1)); bead.setAttribute('cy', by.toFixed(1));
      bead.setAttribute('transform', turn);
      (Math.sin(a) > 0 ? front : back).append(bead);
    };
  },
};

// ---------- A month without a flare: a deckchair in the sun, sunglasses, a drink with a straw ----------
const LOUNGE = { hip: [98, 113], torso: -146, head: -118, bend: 2, armN: [70, -10], armF: [-150, -10], legN: [-14, 28], legF: [-6, 36], lift: 0, rot: 0 };
// Every few seconds the drink comes up for a sip: 0 resting, 1 at the lips
const sipAt = t => Math.sin(span(t % 5200, 2600, 4200) * Math.PI);
// The glass tips toward the face as it comes up; the straw's tip is at (-4, -18) on the glass
const glassTilt = sip => -6 - sip * 24;
const STRAW_TIP = [-4, -18];
const turn = ([x, y], deg) => { const a = deg * Math.PI / 180; return [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)]; };
const deckchair = {
  box: '10 -6 180 148', smallBox: '42 44 124 92', ground: false,
  pose(t) {
    // The top foot bobs along to something, and every few seconds the drink comes up for a sip
    const sip = sipAt(t);
    return { ...LOUNGE, legN: [-14, 28 + Math.sin(t / 230) * 10], head: LOUNGE.head + sip * 6 - Math.sin(t / 1300) * 2, sip };
  },
  adjust(p) {
    const j = body(p);
    // The far hand rests behind the head; the near one brings the straw to the mouth
    p = reach(p, 'hF', [j.head[0] - 9, j.head[1] - 2]);
    // The hand goes where the straw's tip meets the lips, with the glass tipped as it will be
    const face = Math.atan2(j.head[1] - j.sh[1], j.head[0] - j.sh[0]) + Math.PI / 2;
    const lips = [j.head[0] + Math.cos(face) * 8.4 - Math.sin(face) * 5, j.head[1] + Math.sin(face) * 8.4 + Math.cos(face) * 5];
    const tip = turn(STRAW_TIP, glassTilt(1)), atLips = [lips[0] - tip[0], lips[1] - tip[1]];
    const rest = [j.hip[0] + 16, j.hip[1] - 6];
    return reach(p, 'hN', [rest[0] + (atLips[0] - rest[0]) * p.sip, rest[1] + (atLips[1] - rest[1]) * p.sip]);
  },
  props({ back, front, face, small }) {
    // In a banner the scene is framed close, so the sun sits lower, by the chair
    const sun = small ? [150, 60] : [160, 22];
    back.append(s('g', { class: 'cheer-sun' }, s('circle', { cx: sun[0], cy: sun[1], r: small ? 8 : 11 })));
    const rays = s('g', { class: 'cheer-rays' }, Array.from({ length: 8 }, (_, i) => s('line', { x1: 0, y1: -16, x2: 0, y2: -21, transform: `rotate(${i * 45})` })));
    back.append(rays, ground(16, 184),
      // A deckchair side on: a striped sling from the top of the back down under the seat, on two legs
      s('g', { class: 'cheer-chair' },
        s('path', { class: 'cloth', d: 'M60 93 L99 119 Q103 121 107 120 L127 116' }),
        s('path', { class: 'cloth stripes', d: 'M60 93 L99 119 Q103 121 107 120 L127 116' }),
        s('path', { class: 'frame', d: `M72 101 L64 ${FLOOR_LINE} M124 117 L131 ${FLOOR_LINE}` })));
    face.append(s('path', { class: 'cheer-shades', d: 'M2.4 -2.6 L9.6 -2.8 Q10 1.4 6.8 1.6 Q3.4 1.6 2.4 -2.6 Z M-2 -2.4 L2.4 -2.6' }));
    const drink = s('g', { class: 'cheer-drink' },
      s('path', { class: 'glass', d: 'M-4 -9 L4 -9 L3 1 L-3 1 Z' }),
      s('path', { class: 'juice', d: 'M-3.5 -5 L3.5 -5 L3 1 L-3 1 Z' }),
      s('path', { class: 'straw', d: 'M0.5 -6 L-0.5 -15 L-4 -18' }));
    const mouth = face.querySelector('.fig-grin');
    front.append(drink);
    return (t, j) => {
      rays.setAttribute('transform', `translate(${sun[0]} ${sun[1]}) rotate(${(t / 60) % 360}) scale(${small ? 0.75 : 1})`);
      const sip = sipAt(t);
      drink.setAttribute('transform', `translate(${pt(j.hN)}) rotate(${glassTilt(sip).toFixed(1)})`);
      // Lips round the straw for the sip
      if (sip > 0.85) mouth.setAttribute('d', 'M8.4 4.4 a1.5 1.5 0 1 0 0.01 0 Z');
    };
  },
};

export const CHEERS = { first: sprout, 'streak-3': juggle, 'streak-7': party, 'streak-14': flex, 'streak-30': trophy, 'streak-90': flip, 'streak-180': summit, 'calm-7': backbend, 'calm-14': hula, 'calm-30': deckchair };

/** What each milestone says: a title and one line. */
export const CHEER_TEXT = {
  first: ['First check-in done', 'Great start. Keep going to see patterns emerge.'],
  'streak-3': ['3 day streak', 'Keep it up!'],
  'streak-7': ['1 week streak', 'Nice one!'],
  'streak-14': ['2 week streak', 'You’re on a roll.'],
  'streak-30': ['1 month streak', 'Amazing work.'],
  'streak-90': ['3 month streak', 'Incredible!'],
  'streak-180': ['6 month streak', 'You’re a legend.'],
  'calm-7': ['1 week without a flare', 'Your back says thanks.'],
  'calm-14': ['2 weeks without a flare', 'Look at those hips go.'],
  'calm-30': ['1 month without a flare', 'Enjoy it!'],
};

/** The happy face: eyes shut in a smile and an open grin. */
const happy = (eye, mouth) => {
  eye.setAttribute('d', 'M3.6 0.4 Q5.8 -2.6 8 0.4');
  mouth.setAttribute('d', 'M5.4 3.8 Q8.6 9.8 11.2 3.4 Z');
};

/** The animation for a milestone id, as an svg, or null. `small` frames it for a banner; `at` draws a still at that many ms. */
export function Cheer(id, { small = false, at = null } = {}) {
  const c = CHEERS[id];
  if (!c) return null;
  const { svg, draw, layer, eye, mouth, glow } = mascot({ accent: 'sh', view: c.view, feet: c.feet, floor: false }, { small, viewBox: small ? c.smallBox ?? c.box : c.box });
  svg.classList.add('cheer');
  // Seen from the front, both arms and legs are as near as each other
  if (c.view === 'front') svg.classList.add('from-back');
  glow.remove();
  mouth.classList.add('fig-grin');
  const back = s('g', {}), front = s('g', {});
  layer.before(back);
  layer.after(front);
  const face = eye.parentNode;
  const update = c.props?.({ back, front, svg, face, small }) ?? (() => {});
  // In a banner the card's bottom edge is the floor: no floor line, and the feet sit on the edge
  if (small) {
    svg.querySelectorAll('.fig-floor').forEach(el => el.remove());
    svg.setAttribute('preserveAspectRatio', 'xMidYMax meet');
  }
  const floorY = c.ground ?? FLOOR;

  const frame = t => {
    const raw = c.pose ? c.pose(t) : track(c.keys, t);
    let p = c.ground === false ? raw : on(raw, ['fN', 'fF'], floorY);
    if (raw.lift) p = { ...p, hip: [p.hip[0], p.hip[1] - raw.lift] };
    if (c.adjust) p = c.adjust(p, t);
    const j = body(p);
    draw(j, 1, 1, t, t === 0);
    happy(eye, mouth);
    // Seen from the front, the face looks straight out, upright on the neck, with both eyes
    const blush = face.querySelector('.fig-blush');
    if (c.view === 'front' && raw.turn > 0.5) {
      // Turned to the side: the profile face, lips puckered
      blush.style.display = '';
      mouth.setAttribute('d', 'M9.4 4.4 a1.6 1.6 0 1 0 0.01 0 Z');
    } else if (c.view === 'front') {
      blush.style.display = 'none';
      const tilt = Math.atan2(j.head[1] - j.sh[1], j.head[0] - j.sh[0]) * 180 / Math.PI + 90;
      face.setAttribute('transform', `translate(${pt(j.head)}) rotate(${tilt.toFixed(1)})`);
      eye.setAttribute('d', 'M-5.4 0.6 Q-3.4 -2.2 -1.4 0.6 M1.4 0.6 Q3.4 -2.2 5.4 0.6');
      mouth.setAttribute('d', 'M-3.4 3.6 Q0 9.4 3.4 3.6 Z');
    }
    const pv = c.pivot?.(j) ?? j.mid;
    layer.setAttribute('transform', raw.rot ? `rotate(${(raw.rot % 360).toFixed(1)} ${pt(pv)})` : '');
    update(t, j);
  };

  if (at != null) { frame(at); return svg; }
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) { frame(c.still ?? 0); return svg; }
  const [from, to] = c.loop ?? [0, c.keys?.at(-1)[0] ?? 6000];
  const t0 = performance.now();
  const tick = now => {
    if (!svg.isConnected && now - t0 > 500) return; // left the screen
    let t = now - t0;
    if (t > to) t = from + ((t - to) % (to - from));
    frame(t);
    requestAnimationFrame(tick);
  };
  frame(0);
  requestAnimationFrame(tick);
  return svg;
}

/** A milestone id asked for in the address, to preview its celebration while developing; else null. */
export const cheerPreview = id => (CHEERS[id] && /^(localhost|127\.0\.0\.1)$/.test(location.hostname) ? id : null);
