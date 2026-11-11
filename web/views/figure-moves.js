// Moves for the routine player, described by angles rather than points so limbs keep their length (and
// bend at the joints) as they move. A pose: hip position, torso angle (hip to shoulder), head angle,
// spine bend (+ arches, − rounds), and per limb [upper, lower] angles, with optional lengths as a third
// and fourth number for a limb seen end-on (shorter). Near limbs face the viewer. Angles are degrees,
// 0 to the right, 90 down (screen space); a limb turning past 180 keeps counting (200, not −160), so it
// swings the way the body does. The figure faces right; the floor is at y 129.
//
// A move can plant hands or feet (`plant`): they stay put through the move, the elbows and knees
// bending to suit, the way a hand on the floor stays on the floor. `supine` marks moves lying face up
// (the feet point the other way); `feet: false` hides feet seen end-on.

export const LEN = { torso: 36, neck: 15, upper: 18, fore: 18, thigh: 27, shin: 27 };
export const FLOOR = 129;
const rad = d => (d * Math.PI) / 180;
const deg = r => (r * 180) / Math.PI;
const at = (p, a, len) => [p[0] + Math.cos(rad(a)) * len, p[1] + Math.sin(rad(a)) * len];

/** Joint positions for a pose (the shape figure.js draws). */
export function body({ hip, torso = -90, head = torso, bend = 0, armN = [90, 90], armF = armN, legN = [90, 90], legF = legN }) {
  const sh = at(hip, torso, LEN.torso);
  const mid = at([(hip[0] + sh[0]) / 2, (hip[1] + sh[1]) / 2], torso + 90, bend);
  const limb = (root, [a1, a2, l1, l2], u, l) => { const j = at(root, a1, l1 ?? u); return [j, at(j, a2, l2 ?? l)]; };
  const [eN, hN] = limb(sh, armN, LEN.upper, LEN.fore), [eF, hF] = limb(sh, armF, LEN.upper, LEN.fore);
  const [kN, fN] = limb(hip, legN, LEN.thigh, LEN.shin), [kF, fF] = limb(hip, legF, LEN.thigh, LEN.shin);
  return { head: at(sh, head, LEN.neck), sh, mid, hip, eN, hN, kN, fN, eF, hF, kF, fF, angles: { armN, armF, legN, legF } };
}

/** Halfway (t) between two poses' numbers. */
export function lerpPose(a, b, t) {
  const mix = (x, y) => (Array.isArray(x) ? x.map((v, i) => mix(v, y?.[i] ?? v)) : x + (y - x) * t);
  return Object.fromEntries(Object.keys(a).map(k => [k, mix(a[k], b[k] ?? a[k])]));
}

/** Moves the hip up or down so the lowest of the given joints rests at `y` (the floor by default). */
export function on(pose, joints = ['fN', 'fF'], y = FLOOR) {
  const j = body(pose);
  const low = Math.max(...joints.map(k => j[k][1]));
  return { ...pose, hip: [pose.hip[0], pose.hip[1] + (y - low)] };
}

const ENDS = { hN: ['armN', 'sh'], hF: ['armF', 'sh'], fN: ['legN', 'hip'], fF: ['legF', 'hip'] };
const LIMB_LEN = { armN: ['upper', 'fore'], armF: ['upper', 'fore'], legN: ['thigh', 'shin'], legF: ['thigh', 'shin'] };
const wrap = a => ((a % 360) + 540) % 360 - 180;

/**
 * Bends a limb so its hand or foot lands on `target`, keeping the elbow or knee on the side it was
 * already bending to (two-joint reach, by the law of cosines). Returns the pose with that limb changed.
 */
export function reach(pose, end, target, { supine = false, free = false } = {}) {
  const [limb, rootKey] = ENDS[end];
  const j = body(pose);
  const root = j[rootKey];
  // Far limbs left out of a pose copy the near ones (as body() draws them)
  const given = pose[limb] ?? pose[limb.replace('F', 'N')] ?? [90, 90];
  const [a1, a2, l1 = LEN[LIMB_LEN[limb][0]], l2 = LEN[LIMB_LEN[limb][1]]] = given;
  const dx = target[0] - root[0], dy = target[1] - root[1];
  const d = Math.min(Math.hypot(dx, dy), l1 + l2 - 0.01);
  const base = deg(Math.atan2(dy, dx));
  // Angle at the root between the line to the target and the upper bone
  const off = deg(Math.acos(Math.max(-1, Math.min(1, (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d)))));
  const pick = [base + off, base - off].map(u => {
    const e = at(root, u, l1);
    return { u, l: deg(Math.atan2(target[1] - e[1], target[0] - e[0])) };
  });
  // Knees and elbows bend the way they do in a body (the other way round lying face up); a limb seen
  // from the front or above keeps the bend it was given
  const leg = limb.startsWith('leg');
  const side = free ? Math.sign(wrap(a2 - a1)) || 1 : (leg ? 1 : -1) * (supine ? -1 : 1);
  const best = free
    ? pick.reduce((a, b) => (Math.abs(wrap(a.u - a1)) + Math.abs(wrap(a.l - a2)) <= Math.abs(wrap(b.u - a1)) + Math.abs(wrap(b.l - a2)) ? a : b))
    : pick.find(p => Math.sign(wrap(p.l - p.u)) === side) ?? pick[0];
  const u = a1 + wrap(best.u - a1), l = a2 + wrap(best.l - a2);
  return { ...pose, [limb]: [u, l, l1, l2] };
}

const P = (base, patch) => ({ ...base, ...patch });
// Starting positions
const STAND = { hip: [100, 75], torso: -90, head: -90, bend: 0, armN: [92, 88], armF: [88, 92], legN: [90, 90], legF: [90, 90] };
const HOOK = { hip: [92, 124], torso: 0, head: 0, bend: 0, armN: [178, 178], armF: [178, 178], legN: [-125, 100], legF: [-125, 100] }; // on the back, knees bent
const PRONE = { hip: [92, 124], torso: 0, head: -8, bend: 0, armN: [178, 178], armF: [178, 178], legN: [180, 180], legF: [180, 180] }; // face down
const QUAD = { hip: [80, 101], torso: -14, head: -14, bend: 0, armN: [90, 90], armF: [90, 90], legN: [90, 180], legF: [90, 180] }; // hands and knees
const PLANK_DOWN = { hip: [80, 124], torso: -23, head: -15, bend: 4, armN: [90, 0], armF: [90, 0], legN: [178, 180], legF: [178, 180] };
const PLANK_UP = { hip: [80, 112], torso: -3, head: -3, bend: 0, armN: [90, 0], armF: [90, 0], legN: [163, 163], legF: [163, 163] };
const STRIDE = { hip: [100, 75], torso: -88, head: -88, bend: 0, armN: [112, 96], armF: [68, 50], legN: [68, 96], legF: [112, 122] };
// Lying on the left side, seen from the front: head right, propped on the lower hand
const SIDE = { hip: [92, 121], torso: -2, head: -14, bend: 0, armN: [172, 170], armF: [-30, 205], legN: [179, 179], legF: [178, 178] };
const swap = p => ({ ...p, armN: p.armF, armF: p.armN, legN: p.legF, legF: p.legN });

// The bar for pull-ups, and a bench for pressing
const BAR = [[70, 16, 130, 16]];
const BENCH = [[64, 107, 142, 107], [72, 107, 72, 128], [134, 107, 134, 128]];

export const MORE_MOVES = [
  // ---- Hands and knees, lying, standing basics
  { names: ['cat cow', 'cat camel', 'cat and cow', 'cat', 'cow', 'spinal flexion extension'], accent: 'mid', hold: 700, travel: 1700, plant: ['hN', 'hF'],
    pa: P(QUAD, { bend: 7, head: -40 }), // cow: back drops, head lifts
    pb: P(QUAD, { bend: -9, head: 40 }) }, // cat: back rounds, head tucks
  { names: ['bird dog', 'birddog', 'quadruped opposite arm leg', 'opposite arm and leg'], accent: 'mid', hold: 1000, travel: 1500, plant: ['hN'],
    pa: QUAD, pb: P(QUAD, { armF: [-10, -12], legN: [176, 178] }) },
  // Cobra: hips down, arms pressing the chest up. Down dog: hips high, one straight line from hands to hips
  { names: ['cobra and downward dog', 'cobra', 'downward dog', 'down dog', 'downdog', 'upward dog', 'up dog'], accent: 'mid', hold: 1200, travel: 1900, plant: ['hN', 'hF'],
    pa: reach(reach({ hip: [84, 125], torso: -40, head: -32, bend: 12, armN: [100, 70], armF: [98, 68], legN: [180, 180], legF: [180, 180] }, 'hN', [116, 129]), 'hF', [114, 129]),
    pb: { hip: [67, 78], torso: 45, head: 58, bend: 0, armN: [45, 45], armF: [45, 45], legN: [109, 109], legF: [111, 111] } },
  { names: ['hip flexor', 'hip flexor stretch', 'half kneeling', 'kneeling lunge', 'couch stretch', 'psoas'], accent: 'hip', hold: 1500, travel: 1600, plant: ['fN'],
    pa: on({ hip: [92, 90], torso: -90, head: -90, bend: 0, armN: [96, 92], armF: [86, 90], legN: [-4, 90], legF: [112, 180] }, ['fN', 'kF']),
    pb: on({ hip: [100, 92], torso: -93, head: -92, bend: 3, armN: [96, 92], armF: [86, 90], legN: [-10, 74], legF: [128, 182] }, ['fN', 'kF']) },
  { names: ['hinge', 'hip hinge', 'deadlift', 'rdl', 'romanian deadlift', 'single leg hinge', 'kettlebell swing', 'kb swing', 'stiff leg deadlift'], accent: 'hip', hold: 600, travel: 1400, plant: ['fN', 'fF'],
    pa: STAND,
    pb: on({ hip: [86, 82], torso: -12, head: -4, bend: 0, armN: [90, 90], armF: [90, 90], legN: [78, 98], legF: [78, 98] }) },
  { names: ['hamstring', 'hamstring stretch', 'supine hamstring', 'strap hamstring', 'lying hamstring stretch'], accent: 'kN', hold: 1600, travel: 1700, supine: true,
    pa: P(HOOK, { legN: [180, 180], legF: [180, 180] }),
    pb: P(HOOK, { legN: [284, 284], legF: [180, 180], armN: [208, 250], armF: [208, 250] }), grip: { hN: ['hip', 'kN', 0.8], hF: ['hip', 'kN', 0.8] } },
  { names: ['squat', 'deep squat', 'goblet squat', 'air squat', 'bodyweight squat', 'sumo squat', 'squat hold', 'back squat', 'barbell squat', 'high bar squat', 'low bar squat', 'dumbbell squat', 'kettlebell squat'], accent: 'hip', hold: 900, travel: 1500, plant: ['fN', 'fF'],
    pa: P(STAND, { armN: [96, -74], armF: [94, -76] }),
    pb: on({ hip: [88, 100], torso: -62, head: -76, bend: 0, armN: [108, -52], armF: [106, -54], legN: [10, 112], legF: [10, 112] }) },
  { names: ['child pose', 'childs pose', 'balasana', 'extended child pose', 'rest pose', 'wide child pose'], accent: 'mid', hold: 1700, travel: 1900,
    pa: QUAD, pb: { hip: [66, 113], torso: 12, head: 4, bend: -7, armN: [5, 2], armF: [5, 2], legN: [24, 180], legF: [24, 180] } },
  { names: ['glute bridge', 'bridge', 'pelvic curl', 'hip bridge', 'pelvic bridge', 'hip lift', 'hip raise', 'bridging'], accent: 'hip', hold: 1200, travel: 1600, supine: true, plant: ['fN', 'fF'],
    pa: HOOK, pb: P(HOOK, { hip: [96, 106], torso: 26, head: 2, legN: [-158, 94], legF: [-158, 94] }) },
  { names: ['single leg bridge', 'single leg glute bridge', 'one leg bridge'], accent: 'hip', hold: 1200, travel: 1600, supine: true, plant: ['fF'],
    pa: P(HOOK, { legN: [-125, -125] }), pb: P(HOOK, { hip: [96, 106], torso: 26, head: 2, legN: [-170, -170], legF: [-158, 94] }) },
  { names: ['dead bug', 'deadbug', 'dying bug'], accent: 'mid', hold: 800, travel: 1500, supine: true,
    pa: P(HOOK, { hip: [92, 124], armN: [-90, -90], armF: [-90, -90], legN: [-90, 180], legF: [-90, 180] }),
    pb: P(HOOK, { hip: [92, 124], armN: [-6, -4], armF: [-90, -90], legN: [-90, 180], legF: [-176, 182] }) },
  { names: ['plank', 'front plank', 'forearm plank', 'elbow plank', 'plank hold', 'high plank', 'low plank'], accent: 'mid', hold: 1600, travel: 1600, plant: ['hN', 'hF', 'fN', 'fF'],
    pa: PLANK_DOWN, pb: PLANK_UP },
  // Seen from the front: the lower forearm on the floor (pointing your way, so it looks short), the
  // top arm reaching up and staying there, the top foot in front of the other; the hips lift until
  // the body is one straight line
  { names: ['side plank', 'side bridge', 'sideplank', 'copenhagen plank', 'side plank hold'], accent: 'hip', hold: 1600, travel: 1700, feet: false, view: 'front', plant: ['hF', 'fN', 'fF'],
    pa: { hip: [94, 124], torso: -23, head: -30, bend: 0, armF: [90, 10, 18, 7], armN: [-88, -90], legN: [176, 174], legF: [181, 183] },
    pb: { hip: [93, 116], torso: -12, head: -18, bend: 0, armF: [90, 10, 18, 7], armN: [-90, -90], legN: [164, 162], legF: [170, 172] } },
  { names: ['side plank on knees', 'kneeling side plank', 'modified side plank', 'side plank from knees'], accent: 'hip', hold: 1600, travel: 1700, feet: false, view: 'front', plant: ['hF'],
    pa: { hip: [94, 124], torso: -23, head: -30, bend: 0, armF: [90, 10, 18, 7], armN: [-88, -90], legN: [176, 150, 27, 9], legF: [178, 148, 27, 9] },
    pb: { hip: [93, 114], torso: -14, head: -20, bend: 0, armF: [90, 10, 18, 7], armN: [-90, -90], legN: [160, 150, 27, 9], legF: [162, 148, 27, 9] } },
  { names: ['curl up', 'mcgill curl up', 'mcgill curl', 'modified curl up', 'partial crunch', 'crunch', 'sit up', 'situp', 'ab curl', 'partial curl up'], accent: 'mid', hold: 1000, travel: 1300, supine: true, plant: ['fN'],
    pa: P(HOOK, { legF: [180, 180], armN: [174, 178], armF: [174, 178] }), pb: P(HOOK, { legF: [180, 180], torso: -14, head: -20, armN: [170, 176], armF: [170, 176] }) },
  { names: ['knee to chest', 'single knee to chest', 'one knee to chest', 'knee hug', 'knee to chest stretch'], accent: 'hip', hold: 1500, travel: 1600, supine: true,
    pa: HOOK, pb: P(HOOK, { legN: [-48, 150], armN: [222, 290] }), grip: { hN: ['kN', 'fN', 0.15] } },
  { names: ['double knee to chest', 'knees to chest', 'both knees to chest', 'double knee hug', 'apanasana'], accent: 'hip', hold: 1500, travel: 1600, supine: true,
    pa: HOOK, pb: P(HOOK, { legN: [-48, 150], legF: [-48, 150], armN: [222, 290], armF: [222, 290] }), grip: { hN: ['kN', 'fN', 0.15], hF: ['kF', 'fF', 0.15] } },
  { names: ['lower trunk rotation', 'trunk rotation', 'knee rock', 'knee rocks', 'windscreen wiper', 'windshield wiper', 'knee drop', 'supine twist', 'lumbar rotation'], accent: 'mid', hold: 1000, travel: 1700, supine: true, plant: ['fN', 'fF'],
    pa: HOOK, pb: P(HOOK, { legN: [-150, 118, 22, 27], legF: [-142, 108, 24, 27], bend: 2 }) },
  { names: ['pelvic tilt', 'posterior pelvic tilt', 'pelvic tuck', 'pelvic rock', 'pelvic clock'], accent: 'hip', hold: 900, travel: 1300, supine: true, plant: ['fN', 'fF'],
    pa: P(HOOK, { bend: 5 }), pb: P(HOOK, { bend: -5, torso: -1 }) },
  { names: ['figure 4', 'figure four', 'piriformis', 'piriformis stretch', 'figure 4 stretch', 'supine pigeon', 'reclined pigeon', 'glute stretch'], accent: 'hip', hold: 1500, travel: 1700, supine: true,
    pa: P(HOOK, { legN: [-82, 168] }), pb: P(HOOK, { legF: [-72, 176], legN: [-42, 172], armN: [228, 280], armF: [228, 280] }), grip: { hN: ['hip', 'kF', 0.85], hF: ['hip', 'kF', 0.85] } },
  { names: ['wall sit', 'wall squat', 'wall sits'], accent: 'hip', hold: 1800, travel: 1600, props: [[78, 30, 78, 129]], plant: ['fN', 'fF'],
    pa: { hip: [84, 76], torso: -90, head: -90, bend: 0, armN: [90, 90], armF: [90, 90], legN: [78, 100], legF: [78, 100] },
    pb: { hip: [84, 102], torso: -90, head: -90, bend: 0, armN: [80, 70], armF: [80, 70], legN: [0, 90], legF: [0, 90] } },
  { names: ['thread the needle', 'thread needle', 'quadruped rotation', 'needle threader'], accent: 'sh', hold: 1300, travel: 1700, plant: ['hF'],
    pa: QUAD, pb: P(QUAD, { torso: -6, head: 30, bend: -2, armN: [146, 146] }) },

  // ---- McKenzie: lying face down, then lifting the chest with the hips left on the floor
  // Relaxed on the front, forehead resting on folded hands, breathing slowly
  { names: ['prone lying', 'lying face down', 'prone lie', 'lie on your front', 'lying on stomach', 'prone relaxation'], accent: 'mid', hold: 1400, travel: 2400, feet: 'point',
    pa: { hip: [92, 125], torso: -2, head: -6, bend: 0, armN: [177, 179], armF: [176, 178], legN: [180, 180], legF: [180, 180] },
    pb: { hip: [92, 125], torso: -3.5, head: -7, bend: 1.8, armN: [176.5, 178.5], armF: [175.5, 177.5], legN: [180, 180], legF: [180, 180] } },
  { names: ['sphinx', 'sphinx pose', 'prone on elbows', 'prone prop', 'elbow prop', 'sphinx stretch'], accent: 'mid', hold: 1700, travel: 1900, feet: 'point', plant: ['hN', 'hF'],
    pa: { hip: [92, 125], torso: -3, head: -8, bend: 0, armN: [10, 2], armF: [8, 2], legN: [180, 180], legF: [180, 180] },
    pb: { hip: [92, 125], torso: -26, head: -12, bend: 6, armN: [84, 2], armF: [82, 2], legN: [180, 180], legF: [180, 180] } },
  // Hands stay under the shoulders; the arms straighten and the back arches in a smooth curve, the
  // pelvis staying down and the head in line with the spine
  { names: ['prone press up', 'mckenzie press up', 'mckenzie', 'extension in lying', 'prone extension', 'push up extension', 'press up extension'], accent: 'mid', hold: 1300, travel: 1900, feet: 'point', plant: ['hN', 'hF'],
    pa: { hip: [92, 125], torso: -3, head: -6, bend: 0, armN: [-171.6, 28.3], armF: [-169, 30], legN: [180, 180], legF: [180, 180] },
    pb: { hip: [92, 125], torso: -60, head: -46, bend: 12, armN: [-268, -270], armF: [-270, -272], legN: [180, 180], legF: [180, 180] } },
  { names: ['superman', 'superman hold', 'prone superman', 'swimmer', 'pilates swimming', 'flying superman', 'back raise'], accent: 'mid', hold: 1000, travel: 1400, feet: 'point',
    pa: P(PRONE, { armN: [0, 0], armF: [0, 0] }),
    pb: P(PRONE, { torso: -8, head: -10, bend: 4, armN: [-10, -12], armF: [-10, -12], legN: [174, 174], legF: [174, 174] }) },
  { names: ['standing back extension', 'standing extension', 'standing back bend', 'standing backbend', 'back bend', 'backbend', 'extension in standing', 'standing arch'], accent: 'mid', hold: 1100, travel: 1500, plant: ['fN', 'fF'],
    pa: P(STAND, { armN: [118, 64], armF: [116, 62] }),
    pb: { hip: [104, 75], torso: -110, head: -124, bend: 8, armN: [130, 60], armF: [128, 58], legN: [92, 88], legF: [92, 88] } },
  { names: ['forward fold', 'forward bend', 'toe touch', 'touch toes', 'standing forward bend', 'ragdoll', 'rag doll', 'uttanasana'], accent: 'hip', hold: 1500, travel: 1800, plant: ['fN', 'fF'],
    pa: STAND, pb: { hip: [88, 75], torso: 68, head: 84, bend: -9, armN: [94, 90], armF: [92, 88], legN: [84, 96], legF: [84, 96] } },

  // ---- On the side, seen from the front: the top leg lifts in front of you, never through the floor
  { names: ['clamshell', 'clam shell', 'clam', 'side lying clam', 'clamshells'], accent: 'hip', hold: 800, travel: 1400, feet: false, view: 'front',
    pa: P(SIDE, { legN: [158, 187, 15, 24], legF: [162, 186, 15, 24] }),
    pm: P(SIDE, { legN: [196, 158.6, 19, 21.2], legF: [162, 186, 15, 24] }),
    pb: P(SIDE, { legN: [228, 141, 22, 30], legF: [162, 186, 15, 24] }) },
  { names: ['side lying leg lift', 'side lying leg raise', 'side lying hip abduction', 'hip abduction', 'side leg raise', 'lying hip abduction', 'leg lift side'], accent: 'hip', hold: 700, travel: 1300, feet: false, view: 'front',
    pa: SIDE, pb: P(SIDE, { legN: [212, 212] }) },

  // ---- Hips on hands and knees: the working knee bends at a right angle, the leg lifts behind
  { names: ['donkey kick', 'quadruped hip extension', 'glute kickback', 'kickback', 'quadruped kickback', 'hip extension'], accent: 'hip', hold: 700, travel: 1300, plant: ['hN', 'hF'],
    pa: QUAD, pb: P(QUAD, { legN: [186, 276] }) },
  // The knee lifts out to the side, towards you: the thigh looks shorter as it turns your way
  { names: ['fire hydrant', 'quadruped hip abduction', 'hydrant'], accent: 'hip', hold: 700, travel: 1300, plant: ['hN', 'hF'],
    pa: QUAD, pb: P(QUAD, { legN: [128, 182, 11, 27] }) },
  { names: ['seated forward bend', 'spine stretch forward', 'spine stretch', 'sit and reach', 'seated hamstring stretch', 'seated toe touch', 'seated forward fold', 'paschimottanasana', 'long sit stretch'], accent: 'hip', hold: 1500, travel: 1800,
    pa: { hip: [80, 124], torso: -90, head: -90, armN: [90, 90], armF: [90, 90], legN: [0, 0], legF: [0, 0] },
    pb: { hip: [80, 124], torso: -28, head: -18, bend: -7, armN: [6, 6], armF: [6, 6], legN: [0, 0], legF: [0, 0] } },
  { names: ['pigeon', 'pigeon pose', 'pigeon stretch', 'sleeping pigeon', 'kapotasana'], accent: 'hip', hold: 1600, travel: 1900,
    pa: QUAD, pb: { hip: [84, 118], torso: -52, head: -56, bend: 0, armN: [80, 82], armF: [80, 82], legN: [14, 172, 20, 22], legF: [172, 176] } },
  { names: ['bear plank', 'bear hold', 'bear crawl', 'quadruped hover', 'bear'], accent: 'mid', hold: 1400, travel: 1300, plant: ['hN', 'hF'],
    pa: QUAD, pb: P(QUAD, { hip: [80, 95], torso: -4, legN: [92, 168], legF: [92, 168] }) },
  { names: ['good morning', 'goodmorning'], accent: 'hip', hold: 700, travel: 1400, plant: ['fN', 'fF'],
    pa: P(STAND, { armN: [-35, 160], armF: [-35, 160] }),
    pb: { hip: [92, 78], torso: -14, head: -6, bend: 0, armN: [12, 248], armF: [12, 248], legN: [82, 96], legF: [82, 96] } },
  { names: ['wall angel', 'overhead reach', 'arm raise', 'lat stretch', 'wall slide', 'shoulder flexion', 'reach up', 'y raise', 'overhead stretch'], accent: 'sh', hold: 1000, travel: 1600,
    pa: STAND, pb: P(STAND, { armN: [-95, -92], armF: [-95, -92], bend: 3 }) },
  { names: ['chin tuck', 'neck retraction', 'cervical retraction', 'double chin'], accent: 'head', hold: 1000, travel: 1100,
    pa: P(STAND, { head: -76 }), pb: P(STAND, { head: -100 }) },
  { names: ['walk', 'walking', 'brisk walk', 'march', 'marching', 'march in place', 'hike', 'stroll', 'water walking', 'walking in water', 'pool walking'], accent: 'hip', hold: 60, travel: 700,
    pa: STRIDE, pb: swap(STRIDE) },
  { names: ['farmer carry', 'farmers carry', 'farmer walk', 'farmers walk', 'suitcase carry', 'loaded carry', 'carry'], accent: 'mid', hold: 60, travel: 760,
    pa: P(STRIDE, { armN: [92, 90], armF: [88, 90] }), pb: P(swap(STRIDE), { armN: [88, 90], armF: [92, 90] }) },
  { names: ['pallof press', 'pallof', 'anti rotation press', 'band press out', 'cable press out'], accent: 'mid', hold: 1200, travel: 1200,
    pa: { hip: [98, 77], torso: -90, head: -90, armN: [100, -12], armF: [100, -12], legN: [80, 100], legF: [96, 102] },
    pb: { hip: [98, 77], torso: -90, head: -90, armN: [-4, -2], armF: [-4, -2], legN: [80, 100], legF: [96, 102] } },
  { names: ['bent over row', 'bentover row', 'barbell row', 'dumbbell row', 'db row', 'row', 'single arm row', 'one arm row', 'cable row', 'seated row'], accent: 'sh', hold: 600, travel: 1100, plant: ['fN', 'fF'],
    pa: on({ hip: [94, 76], torso: -25, head: -20, armN: [90, 90], armF: [90, 90], legN: [70, 100], legF: [70, 100] }),
    pb: on({ hip: [94, 76], torso: -25, head: -20, armN: [195, 95], armF: [195, 95], legN: [70, 100], legF: [70, 100] }) },
  { names: ['pull up', 'pullup', 'chin up', 'chinup', 'lat pulldown', 'pulldown', 'pull down', 'hang', 'dead hang'], accent: 'sh', hold: 700, travel: 1200, floor: false, props: BAR, plant: ['hN', 'hF'],
    pa: { hip: [100, 88], torso: -90, head: -90, armN: [-90, -90], armF: [-90, -90], legN: [95, 100], legF: [95, 100] },
    pb: { hip: [100, 64], torso: -90, head: -90, armN: [-15, -160], armF: [-15, -160], legN: [95, 100], legF: [95, 100] } },
  { names: ['bench press', 'bench', 'chest press', 'dumbbell press', 'db press', 'floor press', 'dumbbell bench'], accent: 'sh', hold: 600, travel: 1100, props: BENCH, supine: true,
    pa: { hip: [92, 100], torso: 0, head: 0, armN: [115, 300], armF: [115, 300], legN: [180, 90], legF: [180, 90] },
    pb: { hip: [92, 100], torso: 0, head: 0, armN: [270, 270], armF: [270, 270], legN: [180, 90], legF: [180, 90] } },
  { names: ['overhead press', 'shoulder press', 'military press', 'ohp', 'press overhead', 'push press'], accent: 'sh', hold: 600, travel: 1100,
    pa: P(STAND, { armN: [80, -80], armF: [80, -80] }), pb: P(STAND, { armN: [-90, -90], armF: [-90, -90] }) },

  // ---- Tai chi: slow, soft knees, weight shifting from foot to foot
  { names: ['commencing form', 'tai chi opening', 'opening form', 'closing form', 'tai chi closing', 'commencement'], accent: 'sh', hold: 600, travel: 2600, plant: ['fN', 'fF'],
    pa: P(STAND, { armN: [96, 84], armF: [92, 82] }),
    pb: on({ hip: [100, 80], torso: -90, head: -90, bend: 0, armN: [12, 4], armF: [8, 2], legN: [80, 100], legF: [80, 100] }) },
  { names: ['wave hands like clouds', 'cloud hands', 'clouds', 'wave hands'], accent: 'sh', hold: 300, travel: 2400, plant: ['fN', 'fF'],
    pa: on({ hip: [94, 78], torso: -88, head: -84, bend: 0, armN: [30, -70], armF: [80, 20], legN: [72, 98], legF: [104, 110] }),
    pb: on({ hip: [106, 78], torso: -92, head: -96, bend: 0, armN: [80, 20], armF: [30, -70], legN: [72, 98], legF: [104, 110] }) },
  { names: ['brush knee', 'brush knee and push', 'brush knee twist step'], accent: 'hip', hold: 400, travel: 2400, plant: ['fN', 'fF'],
    pa: on({ hip: [94, 80], torso: -90, head: -88, bend: 0, armN: [100, 60], armF: [120, -30], legN: [58, 104], legF: [108, 114] }),
    pb: on({ hip: [104, 82], torso: -86, head: -86, bend: 0, armN: [80, 76], armF: [-4, -6], legN: [52, 112], legF: [112, 118] }) },
  { names: ['part the wild horses mane', 'wild horses mane', 'part the horses mane', 'horses mane'], accent: 'sh', hold: 400, travel: 2400, plant: ['fN', 'fF'],
    pa: on({ hip: [94, 80], torso: -90, head: -88, bend: 0, armN: [60, -60], armF: [96, 30], legN: [58, 104], legF: [108, 114] }),
    pb: on({ hip: [104, 82], torso: -86, head: -82, bend: 0, armN: [-20, -24], armF: [118, 84], legN: [52, 112], legF: [112, 118] }) },

  // ---- In the water: a front crawl seen side-on, and floating on the back
  { names: ['swimming', 'swim', 'front crawl', 'freestyle', 'laps', 'gentle laps', 'lap swimming', 'aqua jogging'], accent: 'sh', hold: 80, travel: 1000, floor: false, props: [[14, 106, 186, 106]], feet: 'point',
    pa: { hip: [88, 110], torso: -4, head: -2, bend: 0, armN: [-12, -14], armF: [112, 114], legN: [182, 182], legF: [174, 178] },
    pb: { hip: [88, 110], torso: -4, head: 4, bend: 0, armN: [112, 114], armF: [-12, -14], legN: [174, 178], legF: [182, 182] } },
  { names: ['float and stretch', 'back float', 'floating', 'float'], accent: 'mid', hold: 1400, travel: 2400, floor: false, props: [[14, 106, 186, 106]], supine: true,
    pa: { hip: [92, 108], torso: 0, head: -4, bend: 0, armN: [-6, -4], armF: [-6, -4], legN: [180, 180], legF: [180, 180] },
    pb: { hip: [92, 109], torso: 0, head: -4, bend: -2, armN: [-14, -10], armF: [-14, -10], legN: [186, 186], legF: [174, 174] } },
];
