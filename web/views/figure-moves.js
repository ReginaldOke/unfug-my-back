// More moves for the routine player, described by angles rather than points so limbs keep their length
// as they move. A pose: hip position, torso angle (hip to shoulder), head angle, spine bend (+ arches,
// − rounds), and per limb [upper, lower] angles; near limbs face the viewer. Angles are degrees, 0 to
// the right, 90 down (screen space). The figure faces right; the floor is at y 128.

const LEN = { torso: 36, neck: 18, upper: 18, fore: 18, thigh: 27, shin: 27 };
const rad = d => (d * Math.PI) / 180;
const at = (p, deg, len) => [p[0] + Math.cos(rad(deg)) * len, p[1] + Math.sin(rad(deg)) * len];

/** Joint positions for a pose (the shape figure.js draws). */
export function body({ hip, torso = -90, head = torso, bend = 0, armN = [90, 90], armF = armN, legN = [90, 90], legF = legN }) {
  const sh = at(hip, torso, LEN.torso);
  const mid = at([(hip[0] + sh[0]) / 2, (hip[1] + sh[1]) / 2], torso + 90, bend);
  const eN = at(sh, armN[0], LEN.upper), eF = at(sh, armF[0], LEN.upper);
  const kN = at(hip, legN[0], LEN.thigh), kF = at(hip, legF[0], LEN.thigh);
  return {
    head: at(sh, head, LEN.neck), sh, mid, hip,
    eN, hN: at(eN, armN[1], LEN.fore), kN, fN: at(kN, legN[1], LEN.shin),
    eF, hF: at(eF, armF[1], LEN.fore), kF, fF: at(kF, legF[1], LEN.shin),
  };
}

/** Halfway (t) between two poses' numbers. */
export function lerpPose(a, b, t) {
  const mix = (x, y) => (Array.isArray(x) ? x.map((v, i) => mix(v, y[i])) : x + (y - x) * t);
  return Object.fromEntries(Object.keys(a).map(k => [k, mix(a[k], b[k] ?? a[k])]));
}

const P = (base, patch) => ({ ...base, ...patch });
// Starting positions
const STAND = { hip: [100, 76], torso: -90, head: -90, bend: 0, armN: [90, 90], armF: [90, 90], legN: [90, 90], legF: [90, 90] };
const HOOK = { hip: [92, 122], torso: 0, head: 0, bend: 0, armN: [180, 180], armF: [180, 180], legN: [-125, 100], legF: [-125, 100] }; // on the back, knees bent
const PRONE = { hip: [92, 122], torso: 0, head: 0, bend: 0, armN: [180, 180], armF: [180, 180], legN: [180, 180], legF: [180, 180] }; // face down
const QUAD = { hip: [80, 101], torso: -14, head: -14, bend: 0, armN: [90, 90], armF: [90, 90], legN: [90, 180], legF: [90, 180] }; // hands and knees
const PLANK_DOWN = { hip: [80, 124], torso: -23, head: -15, bend: 4, armN: [90, 0], armF: [90, 0], legN: [178, 180], legF: [178, 180] };
const PLANK_UP = { hip: [80, 112], torso: -3, head: -3, bend: 0, armN: [90, 0], armF: [90, 0], legN: [163, 163], legF: [163, 163] };
const STRIDE = { hip: [100, 76], torso: -88, head: -88, bend: 0, armN: [115, 100], armF: [65, 60], legN: [65, 95], legF: [115, 105] };
const swap = p => ({ ...p, armN: p.armF, armF: p.armN, legN: p.legF, legF: p.legN });

// The bar for pull-ups, and a bench for pressing
const BAR = [[70, 16, 130, 16]];
const BENCH = [[64, 107, 142, 107], [72, 107, 72, 128], [134, 107, 134, 128]];

export const MORE_MOVES = [
  { names: ['child pose', 'childs pose', 'balasana', 'extended child pose', 'rest pose', 'wide child pose'], accent: 'mid', hold: 1600,
    pa: QUAD, pb: { hip: [62, 112], torso: 15, head: 20, bend: -6, armN: [5, 0], armF: [5, 0], legN: [30, 180], legF: [30, 180] } },
  { names: ['glute bridge', 'bridge', 'hip bridge', 'pelvic bridge', 'hip lift', 'hip raise', 'single leg bridge', 'bridging'], accent: 'hip', hold: 1200,
    pa: HOOK, pb: P(HOOK, { hip: [97, 108], torso: 24, head: 4, legN: [-160, 95], legF: [-160, 95] }) },
  { names: ['dead bug', 'deadbug', 'dying bug'], accent: 'mid', hold: 900,
    pa: P(HOOK, { armN: [-90, -90], armF: [-90, -90], legN: [-90, 180], legF: [-90, 180] }),
    pb: P(HOOK, { armN: [-8, -4], armF: [-90, -90], legN: [-90, 180], legF: [178, 178] }) },
  { names: ['plank', 'front plank', 'forearm plank', 'elbow plank', 'plank hold', 'high plank', 'low plank'], accent: 'mid', hold: 1600,
    pa: PLANK_DOWN, pb: PLANK_UP },
  { names: ['side plank', 'side bridge', 'sideplank', 'copenhagen plank', 'side plank hold'], accent: 'hip', hold: 1600,
    pa: P(PLANK_DOWN, { armF: [180, 180] }), pb: P(PLANK_UP, { armF: [-90, -90] }) },
  { names: ['curl up', 'mcgill curl up', 'mcgill curl', 'modified curl up', 'partial crunch', 'crunch', 'sit up', 'situp', 'ab curl'], accent: 'mid', hold: 900,
    pa: P(HOOK, { legF: [180, 180] }), pb: P(HOOK, { legF: [180, 180], torso: -12, head: -18 }) },
  { names: ['knee to chest', 'single knee to chest', 'one knee to chest', 'knee hug', 'knee to chest stretch'], accent: 'hip', hold: 1500,
    pa: HOOK, pb: P(HOOK, { legN: [-40, 150], armN: [-125, -170] }) },
  { names: ['double knee to chest', 'knees to chest', 'both knees to chest', 'double knee hug', 'apanasana'], accent: 'hip', hold: 1500,
    pa: HOOK, pb: P(HOOK, { legN: [-40, 150], legF: [-40, 150], armN: [-125, -170], armF: [-125, -170] }) },
  { names: ['lower trunk rotation', 'trunk rotation', 'knee rock', 'knee rocks', 'windscreen wiper', 'windshield wiper', 'knee drop', 'supine twist', 'lumbar rotation'], accent: 'mid', hold: 900,
    pa: HOOK, pb: P(HOOK, { legN: [-150, 150], legF: [-140, 125], bend: 2 }) },
  { names: ['pelvic tilt', 'posterior pelvic tilt', 'pelvic tuck', 'pelvic rock', 'pelvic clock'], accent: 'hip', hold: 800,
    pa: P(HOOK, { bend: 6 }), pb: P(HOOK, { bend: -5, hip: [92, 123], torso: -1 }) },
  { names: ['figure 4', 'figure four', 'piriformis', 'piriformis stretch', 'figure 4 stretch', 'supine pigeon', 'reclined pigeon', 'glute stretch'], accent: 'hip', hold: 1500,
    pa: P(HOOK, { legN: [-80, 167] }), pb: P(HOOK, { legF: [-70, 180], legN: [-40, 175], armN: [-110, -160], armF: [-110, -160] }) },
  { names: ['prone press up', 'press up', 'mckenzie press up', 'mckenzie', 'extension in lying', 'prone extension', 'push up extension'], accent: 'mid', hold: 1300,
    pa: P(PRONE, { armN: [-100, 80], armF: [-100, 80] }), pb: P(PRONE, { torso: -45, head: -40, bend: 8, armN: [62, 58], armF: [62, 58] }) },
  { names: ['sphinx', 'sphinx pose', 'prone on elbows', 'prone prop', 'elbow prop', 'sphinx stretch'], accent: 'mid', hold: 1600,
    pa: P(PRONE, { armN: [10, 0], armF: [10, 0] }), pb: P(PRONE, { torso: -23, head: -20, bend: 5, armN: [90, 0], armF: [90, 0] }) },
  { names: ['superman', 'superman hold', 'prone superman', 'swimmer', 'flying superman', 'back raise'], accent: 'mid', hold: 1000,
    pa: P(PRONE, { armN: [0, 0], armF: [0, 0] }),
    pb: P(PRONE, { torso: -8, head: -12, bend: 5, armN: [-12, -14], armF: [-12, -14], legN: [172, 172], legF: [172, 172] }) },
  { names: ['standing back extension', 'standing extension', 'standing back bend', 'standing backbend', 'back bend', 'backbend', 'extension in standing', 'standing arch'], accent: 'mid', hold: 1200,
    pa: P(STAND, { armN: [110, 74], armF: [110, 74] }),
    pb: { hip: [105, 76], torso: -108, head: -118, bend: 7, armN: [118, 80], armF: [118, 80], legN: [95, 95], legF: [95, 95] } },
  { names: ['forward fold', 'forward bend', 'toe touch', 'touch toes', 'standing forward bend', 'ragdoll', 'rag doll', 'uttanasana'], accent: 'hip', hold: 1500,
    pa: STAND, pb: { hip: [92, 76], torso: 60, head: 80, bend: -8, armN: [75, 160], armF: [75, 160], legN: [81.6, 81.6], legF: [81.6, 81.6] } },
  { names: ['wall sit', 'wall squat', 'wall sits'], accent: 'hip', hold: 1800,
    pa: { hip: [96, 76], torso: -92, head: -92, armN: [90, 90], armF: [90, 90], legN: [72, 85], legF: [72, 85] },
    pb: { hip: [86, 103], torso: -90, head: -90, armN: [90, 90], armF: [90, 90], legN: [0, 90], legF: [0, 90] } },
  { names: ['thread the needle', 'thread needle', 'quadruped rotation', 'needle threader'], accent: 'sh', hold: 1300,
    pa: QUAD, pb: P(QUAD, { torso: -10, head: 40, bend: -2, armN: [120, 160] }) },
  { names: ['clamshell', 'clam shell', 'clam', 'side lying clam'], accent: 'hip', hold: 800,
    pa: { hip: [88, 118], torso: 0, head: -5, armN: [180, 180], armF: [0, 0], legN: [165, 185], legF: [165, 185] },
    pb: { hip: [88, 118], torso: 0, head: -5, armN: [180, 180], armF: [0, 0], legN: [-160, 150], legF: [165, 185] } },
  { names: ['seated forward bend', 'sit and reach', 'seated hamstring stretch', 'seated toe touch', 'seated forward fold', 'paschimottanasana', 'long sit stretch'], accent: 'hip', hold: 1500,
    pa: { hip: [80, 122], torso: -90, head: -90, armN: [90, 90], armF: [90, 90], legN: [0, 0], legF: [0, 0] },
    pb: { hip: [80, 122], torso: -25, head: -15, bend: -6, armN: [5, 5], armF: [5, 5], legN: [0, 0], legF: [0, 0] } },
  { names: ['pigeon', 'pigeon pose', 'pigeon stretch', 'sleeping pigeon', 'kapotasana'], accent: 'hip', hold: 1600,
    pa: QUAD, pb: { hip: [84, 116], torso: -50, head: -55, bend: 0, armN: [80, 80], armF: [80, 80], legN: [15, 180], legF: [175, 180] } },
  { names: ['donkey kick', 'quadruped hip extension', 'glute kickback', 'kickback', 'quadruped kickback', 'hip extension'], accent: 'hip', hold: 800,
    pa: QUAD, pb: P(QUAD, { legN: [-170, -90] }) },
  { names: ['fire hydrant', 'quadruped hip abduction', 'hydrant'], accent: 'hip', hold: 800,
    pa: QUAD, pb: P(QUAD, { legN: [150, 180] }) },
  { names: ['bear plank', 'bear hold', 'bear crawl', 'quadruped hover', 'bear'], accent: 'mid', hold: 1400,
    pa: QUAD, pb: P(QUAD, { hip: [80, 95], torso: -4, legN: [90, 167], legF: [90, 167] }) },
  { names: ['good morning', 'goodmorning'], accent: 'hip', hold: 700,
    pa: P(STAND, { armN: [-35, -160], armF: [-35, -160] }),
    pb: { hip: [95, 76], torso: -12, head: -5, bend: 0, armN: [10, -110], armF: [10, -110], legN: [82, 96], legF: [82, 96] } },
  { names: ['wall angel', 'overhead reach', 'arm raise', 'lat stretch', 'wall slide', 'shoulder flexion', 'reach up', 'y raise', 'overhead stretch'], accent: 'sh', hold: 1000,
    pa: STAND, pb: P(STAND, { armN: [-95, -92], armF: [-95, -92], bend: 3 }) },
  { names: ['chin tuck', 'neck retraction', 'cervical retraction', 'double chin'], accent: 'head', hold: 1000,
    pa: P(STAND, { head: -76 }), pb: P(STAND, { head: -102 }) },
  { names: ['walk', 'walking', 'brisk walk', 'march', 'marching', 'march in place', 'hike', 'stroll'], accent: 'hip', hold: 80, travel: 650,
    pa: STRIDE, pb: swap(STRIDE) },
  { names: ['farmer carry', 'farmers carry', 'farmer walk', 'farmers walk', 'suitcase carry', 'loaded carry', 'carry'], accent: 'mid', hold: 80, travel: 750,
    pa: P(STRIDE, { armN: [92, 90], armF: [88, 90] }), pb: P(swap(STRIDE), { armN: [88, 90], armF: [92, 90] }) },
  { names: ['pallof press', 'pallof', 'anti rotation press', 'band press out', 'cable press out'], accent: 'mid', hold: 1200,
    pa: { hip: [98, 78], torso: -90, head: -90, armN: [100, -10], armF: [100, -10], legN: [78, 102], legF: [78, 102] },
    pb: { hip: [98, 78], torso: -90, head: -90, armN: [-5, -3], armF: [-5, -3], legN: [78, 102], legF: [78, 102] } },
  { names: ['bent over row', 'bentover row', 'barbell row', 'dumbbell row', 'db row', 'row', 'single arm row', 'one arm row', 'cable row', 'seated row'], accent: 'sh', hold: 600,
    pa: { hip: [94, 76], torso: -25, head: -20, armN: [90, 90], armF: [90, 90], legN: [70, 100], legF: [70, 100] },
    pb: { hip: [94, 76], torso: -25, head: -20, armN: [-165, 95], armF: [-165, 95], legN: [70, 100], legF: [70, 100] } },
  { names: ['pull up', 'pullup', 'chin up', 'chinup', 'lat pulldown', 'pulldown', 'pull down', 'hang', 'dead hang'], accent: 'sh', hold: 700, floor: false, props: BAR,
    pa: { hip: [100, 88], torso: -90, head: -90, armN: [-90, -90], armF: [-90, -90], legN: [95, 100], legF: [95, 100] },
    pb: { hip: [100, 66], torso: -90, head: -90, armN: [-15, -160], armF: [-15, -160], legN: [95, 100], legF: [95, 100] } },
  { names: ['bench press', 'bench', 'chest press', 'dumbbell press', 'db press', 'floor press', 'dumbbell bench'], accent: 'sh', hold: 600, props: BENCH,
    pa: { hip: [92, 100], torso: 0, head: 0, armN: [115, -60], armF: [115, -60], legN: [180, 90], legF: [180, 90] },
    pb: { hip: [92, 100], torso: 0, head: 0, armN: [-90, -90], armF: [-90, -90], legN: [180, 90], legF: [180, 90] } },
  { names: ['overhead press', 'shoulder press', 'military press', 'ohp', 'press overhead', 'push press'], accent: 'sh', hold: 600,
    pa: P(STAND, { armN: [80, -80], armF: [80, -80] }), pb: P(STAND, { armN: [-90, -90], armF: [-90, -90] }) },
];
