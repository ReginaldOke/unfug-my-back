// The common gym and bodyweight moves for the routine player, in the angle format of figure-moves.js.
// Each pose is settled onto the floor (or a bar or bench) by `on`, so feet and hands touch down wherever
// the angles put them. Names list the usual ways people write each move; typos are caught by move-names.js.
import { body } from './figure-moves.js';

const FLOOR = 129;
const P = (base, patch) => ({ ...base, ...patch });
/** Moves the hip up or down so the lowest of the given joints rests at `y` (the floor by default). */
function on(pose, joints = ['fN', 'fF'], y = FLOOR) {
  const j = body(pose);
  const low = Math.max(...joints.map(k => j[k][1]));
  return { ...pose, hip: [pose.hip[0], pose.hip[1] + (y - low)] };
}
const swap = p => ({ ...p, armN: p.armF, armF: p.armN, legN: p.legF, legF: p.legN });

// Starting points
const STAND = { hip: [100, 76], torso: -90, head: -90, bend: 0, armN: [90, 90], armF: [90, 90], legN: [90, 90], legF: [90, 90] };
const SUPINE = { hip: [86, 120], torso: 0, head: 0, bend: 0, armN: [175, 175], armF: [175, 175], legN: [180, 180], legF: [180, 180] };
const SEATED = { hip: [96, 100], torso: -90, head: -90, bend: 0, armN: [80, 80], armF: [80, 80], legN: [0, 90], legF: [0, 90] };
const KNEEL = { hip: [100, 100], torso: -90, head: -90, bend: 0, armN: [90, 90], armF: [90, 90], legN: [90, 180], legF: [90, 180] };
const PUSH_TOP = on({ hip: [78, 100], torso: -14, head: -10, bend: 0, armN: [90, 90], armF: [90, 90], legN: [151, 151], legF: [151, 151] }, ['hN', 'fN']);
const PUSH_LOW = on({ hip: [78, 106], torso: -4, head: -2, bend: 0, armN: [150, 62], armF: [150, 62], legN: [157, 157], legF: [157, 157] }, ['hN', 'fN']);
const HANG = { hip: [100, 88], torso: -90, head: -90, bend: 0, armN: [-90, -90], armF: [-90, -90], legN: [92, 96], legF: [92, 96] };
const SQUAT = on({ hip: [92, 100], torso: -58, head: -70, bend: 0, armN: [5, 5], armF: [5, 5], legN: [12, 115], legF: [12, 115] });
const LUNGE = on({ hip: [96, 96], torso: -88, head: -88, bend: 0, armN: [92, 92], armF: [88, 88], legN: [10, 95], legF: [115, 168] });

// Props, as lines: a pull-up bar, a flat bench, an incline bench, a box, dip bars, a machine seat
const BAR = [[70, 16, 130, 16]];
const BENCH = [[64, 107, 142, 107], [72, 107, 72, 128], [134, 107, 134, 128]];
const INCLINE = [[78, 112, 138, 72], [96, 101, 96, 128]];
const BOX = [[118, 100, 168, 100], [118, 100, 118, 129], [168, 100, 168, 129]];
const DIP_BARS = [[86, 70, 124, 70]];
const SEAT = [[78, 104, 120, 104], [100, 104, 100, 129]];
const LOW_BAR = [[96, 72, 156, 72]];

// Lying on a flat bench, pressing: elbows bent to straight up
const benchPose = arms => ({ hip: [92, 100], torso: 0, head: 0, bend: 0, armN: arms, armF: arms, legN: [180, 90], legF: [180, 90] });
// On an incline, the same press angled up from the chest
const inclinePose = arms => ({ hip: [92, 104], torso: -34, head: -30, bend: 0, armN: arms, armF: arms, legN: [20, 95], legF: [20, 95] });

export const LIBRARY_MOVES = [
  // ---- Pushing
  { names: ['push up', 'pushup', 'press up', 'pressup', 'push ups', 'knee push up', 'wide push up', 'wide grip push up', 'diamond push up', 'close grip push up', 'tricep push up', 'incline push up', 'decline push up', 'archer push up', 'clap push up', 'plyo push up', 'hindu push up'], accent: 'sh', hold: 500,
    pa: PUSH_TOP, pb: PUSH_LOW },
  { names: ['pike push up', 'pike press', 'pike pushup'], accent: 'sh', hold: 500,
    pa: on({ hip: [80, 60], torso: 50, head: 58, bend: 0, armN: [90, 90], armF: [90, 90], legN: [128, 128], legF: [128, 128] }, ['hN', 'fN']),
    pb: on({ hip: [80, 66], torso: 40, head: 70, bend: 0, armN: [150, 70], armF: [150, 70], legN: [122, 122], legF: [122, 122] }, ['hN', 'fN']) },
  { names: ['handstand', 'handstand hold', 'wall handstand', 'handstand push up', 'hspu', 'handstand pushup'], accent: 'sh', hold: 900, floor: true,
    pa: on({ hip: [100, 56], torso: 90, head: 90, bend: 0, armN: [90, 90], armF: [90, 90], legN: [-90, -90], legF: [-90, -90] }, ['hN']),
    pb: on({ hip: [100, 66], torso: 90, head: 96, bend: 0, armN: [150, 40], armF: [150, 40], legN: [-90, -90], legF: [-90, -90] }, ['hN']) },
  { names: ['dip', 'dips', 'tricep dip', 'triceps dip', 'chest dip', 'parallel bar dip', 'bench dip', 'ring dip', 'bar dip'], accent: 'sh', hold: 500, floor: false, props: DIP_BARS,
    pa: on({ hip: [104, 80], torso: -84, head: -84, bend: 0, armN: [92, 92], armF: [92, 92], legN: [100, 150], legF: [100, 150] }, ['hN'], 70),
    pb: on({ hip: [100, 98], torso: -70, head: -70, bend: 0, armN: [160, 60], armF: [160, 60], legN: [100, 150], legF: [100, 150] }, ['hN'], 70) },
  { names: ['incline bench press', 'incline press', 'incline dumbbell press', 'incline db press', 'incline chest press', 'incline bench'], accent: 'sh', hold: 500, props: INCLINE,
    pa: inclinePose([110, -70]), pb: inclinePose([-62, -62]) },
  { names: ['decline bench press', 'decline press', 'decline dumbbell press', 'decline bench'], accent: 'sh', hold: 500, props: [[64, 98, 142, 112], [104, 105, 104, 128]],
    pa: { hip: [92, 96], torso: 10, head: 12, bend: 0, armN: [120, -70], armF: [120, -70], legN: [-170, 100], legF: [-170, 100] },
    pb: { hip: [92, 96], torso: 10, head: 12, bend: 0, armN: [-80, -80], armF: [-80, -80], legN: [-170, 100], legF: [-170, 100] } },
  { names: ['dumbbell fly', 'db fly', 'chest fly', 'pec fly', 'flye', 'dumbbell flye', 'incline fly', 'flat fly'], accent: 'sh', hold: 500, props: BENCH,
    pa: benchPose([-90, -90]), pb: { ...benchPose([150, 170]), armF: [30, 10] } },
  { names: ['cable crossover', 'cable fly', 'cable flye', 'crossover', 'cable chest fly', 'low to high fly', 'high to low fly'], accent: 'sh', hold: 500,
    pa: P(STAND, { torso: -76, head: -78, armN: [-150, -130], armF: [-150, -130], legN: [80, 95], legF: [100, 92] }),
    pb: P(STAND, { torso: -76, head: -78, armN: [40, 50], armF: [40, 50], legN: [80, 95], legF: [100, 92] }) },
  { names: ['pec deck', 'pec dec', 'machine fly', 'butterfly machine', 'chest fly machine', 'rear delt machine'], accent: 'sh', hold: 500, props: SEAT,
    pa: on(P(SEATED, { armN: [175, 100], armF: [175, 100] }), ['fN']), pb: on(P(SEATED, { armN: [-10, -60], armF: [-10, -60] }), ['fN']) },
  { names: ['skull crusher', 'skullcrusher', 'lying tricep extension', 'lying triceps extension', 'ez bar skull crusher'], accent: 'sh', hold: 500, props: BENCH,
    pa: benchPose([-100, -100]), pb: benchPose([-100, 25]) },
  { names: ['tricep pushdown', 'triceps pushdown', 'cable pushdown', 'rope pushdown', 'tricep pressdown', 'pushdown', 'pressdown'], accent: 'sh', hold: 400,
    pa: P(STAND, { torso: -84, head: -84, armN: [96, -20], armF: [96, -20] }), pb: P(STAND, { torso: -84, head: -84, armN: [96, 92], armF: [96, 92] }) },
  { names: ['overhead tricep extension', 'overhead triceps extension', 'overhead extension', 'french press', 'tricep extension', 'triceps extension'], accent: 'sh', hold: 400,
    pa: P(STAND, { armN: [-100, 120], armF: [-100, 120] }), pb: P(STAND, { armN: [-95, -92], armF: [-95, -92] }) },
  { names: ['tricep kickback', 'triceps kickback', 'dumbbell kickback', 'cable kickback'], accent: 'sh', hold: 400,
    pa: on({ hip: [96, 76], torso: -22, head: -18, bend: 0, armN: [172, 90], armF: [172, 90], legN: [72, 98], legF: [72, 98] }),
    pb: on({ hip: [96, 76], torso: -22, head: -18, bend: 0, armN: [172, 175], armF: [172, 175], legN: [72, 98], legF: [72, 98] }) },
  { names: ['arnold press', 'dumbbell shoulder press', 'seated shoulder press', 'db shoulder press', 'seated overhead press', 'landmine press'], accent: 'sh', hold: 500,
    pa: P(STAND, { armN: [70, -110], armF: [70, -110] }), pb: P(STAND, { armN: [-90, -90], armF: [-90, -90] }) },
  { names: ['lateral raise', 'side raise', 'dumbbell lateral raise', 'lat raise', 'side lateral raise', 'cable lateral raise', 'front raise', 'plate front raise', 'dumbbell front raise'], accent: 'sh', hold: 450,
    pa: P(STAND, { armN: [86, 88], armF: [94, 92] }), pb: P(STAND, { armN: [-4, -2], armF: [-8, -6] }) },
  { names: ['rear delt fly', 'reverse fly', 'rear fly', 'bent over fly', 'rear delt raise', 'reverse flye'], accent: 'sh', hold: 450,
    pa: on({ hip: [96, 76], torso: -18, head: -14, bend: 0, armN: [94, 92], armF: [94, 92], legN: [72, 98], legF: [72, 98] }),
    pb: on({ hip: [96, 76], torso: -18, head: -14, bend: 0, armN: [-168, -172], armF: [-168, -172], legN: [72, 98], legF: [72, 98] }) },
  { names: ['face pull', 'face pulls', 'cable face pull', 'band face pull', 'band pull apart', 'pull apart'], accent: 'sh', hold: 450,
    pa: P(STAND, { armN: [-6, -4], armF: [-6, -4] }), pb: P(STAND, { armN: [-24, -170], armF: [-24, -170] }) },
  { names: ['upright row', 'upright rows', 'cable upright row'], accent: 'sh', hold: 450,
    pa: P(STAND, { armN: [80, 100], armF: [80, 100] }), pb: P(STAND, { armN: [-14, 118], armF: [-14, 118] }) },
  { names: ['shrug', 'shrugs', 'barbell shrug', 'dumbbell shrug', 'trap shrug'], accent: 'sh', hold: 500,
    pa: P(STAND, { armN: [92, 92], armF: [92, 92] }), pb: P(STAND, { hip: [100, 72], head: -96, armN: [92, 92], armF: [92, 92], legN: [90, 82], legF: [90, 82] }) },

  // ---- Arms
  { names: ['bicep curl', 'biceps curl', 'curl', 'curls', 'dumbbell curl', 'barbell curl', 'ez bar curl', 'cable curl', 'hammer curl', 'preacher curl', 'concentration curl', 'incline curl', 'spider curl', 'zottman curl'], accent: 'sh', hold: 400,
    pa: P(STAND, { armN: [94, 92], armF: [94, 92] }), pb: P(STAND, { armN: [96, -72], armF: [96, -72] }) },

  // ---- Pulling
  { names: ['inverted row', 'australian pull up', 'australian row', 'bodyweight row', 'ring row', 'trx row', 'table row'], accent: 'sh', hold: 500, props: LOW_BAR,
    pa: { hip: [86, 108], torso: -20, head: -18, bend: 0, armN: [-58, -58], armF: [-58, -58], legN: [160, 160], legF: [160, 160] },
    pb: { hip: [86, 98], torso: -28, head: -24, bend: 0, armN: [150, -60], armF: [150, -60], legN: [164, 164], legF: [164, 164] } },
  { names: ['muscle up', 'muscleup', 'bar muscle up', 'ring muscle up'], accent: 'sh', hold: 500, floor: false, props: [[70, 60, 130, 60]],
    pa: { hip: [100, 132], torso: -90, head: -90, bend: 0, armN: [-90, -90], armF: [-90, -90], legN: [96, 100], legF: [96, 100] },
    pb: { hip: [100, 60], torso: -90, head: -90, bend: 0, armN: [92, 92], armF: [92, 92], legN: [96, 100], legF: [96, 100] } },
  { names: ['hanging leg raise', 'leg raise hanging', 'hanging knee raise', 'knee raise', 'knees to elbow', 'toes to bar', 'captain chair', 'captains chair'], accent: 'hip', hold: 600, floor: false, props: BAR,
    pa: HANG, pb: P(HANG, { legN: [-4, -4], legF: [-4, -4], bend: -4 }) },
  { names: ['front lever', 'tuck front lever', 'front lever raise'], accent: 'mid', hold: 1200, floor: false, props: [[70, 30, 130, 30]],
    pa: P(HANG, { hip: [100, 102] }), pb: { hip: [74, 64], torso: 0, head: 0, bend: 0, armN: [-75, -75], armF: [-75, -75], legN: [180, 180], legF: [180, 180] } },
  { names: ['back lever', 'tuck back lever', 'skin the cat'], accent: 'mid', hold: 1200, floor: false, props: [[70, 30, 130, 30]],
    pa: P(HANG, { hip: [100, 102] }), pb: { hip: [74, 66], torso: 0, head: 6, bend: 0, armN: [-105, -105], armF: [-105, -105], legN: [180, 180], legF: [180, 180] } },
  { names: ['planche', 'tuck planche', 'planche lean', 'pseudo planche'], accent: 'sh', hold: 1200,
    pa: on({ hip: [86, 100], torso: -14, head: -10, bend: 0, armN: [96, 96], armF: [96, 96], legN: [150, 150], legF: [150, 150] }, ['hN', 'fN']),
    pb: on({ hip: [78, 98], torso: 0, head: 0, bend: 0, armN: [104, 104], armF: [104, 104], legN: [180, 180], legF: [180, 180] }, ['hN']) },

  // ---- Legs
  { names: ['lunge', 'lunges', 'forward lunge', 'reverse lunge', 'walking lunge', 'alternating lunge', 'dumbbell lunge', 'barbell lunge', 'split squat', 'static lunge', 'jumping lunge', 'lunge jump', 'curtsy lunge'], accent: 'hip', hold: 500,
    pa: STAND, pb: LUNGE },
  { names: ['bulgarian split squat', 'bulgarian', 'rear foot elevated split squat', 'rfess', 'bss'], accent: 'hip', hold: 500, props: [[22, 100, 60, 100], [30, 100, 30, 129], [52, 100, 52, 129]],
    pa: on({ hip: [94, 76], torso: -88, head: -88, bend: 0, armN: [92, 92], armF: [88, 88], legN: [80, 98], legF: [130, 175] }, ['fN']),
    pb: on({ hip: [94, 96], torso: -84, head: -84, bend: 0, armN: [92, 92], armF: [88, 88], legN: [12, 96], legF: [110, 165] }, ['fN']) },
  { names: ['side lunge', 'lateral lunge', 'cossack squat', 'skater squat'], accent: 'hip', hold: 500,
    pa: STAND, pb: on({ hip: [94, 98], torso: -68, head: -74, bend: 0, armN: [10, 10], armF: [10, 10], legN: [24, 110], legF: [96, 96] }, ['fN']) },
  { names: ['pistol squat', 'pistol', 'single leg squat', 'one leg squat'], accent: 'hip', hold: 600,
    pa: on(P(STAND, { armN: [0, 0], armF: [0, 0], legF: [70, 80] }), ['fN']),
    pb: on({ hip: [86, 104], torso: -55, head: -66, bend: 0, armN: [0, 0], armF: [0, 0], legN: [10, 118], legF: [-2, -2] }, ['fN']) },
  { names: ['front squat', 'hack squat', 'zercher squat', 'safety bar squat', 'box squat'], accent: 'hip', hold: 500,
    pa: P(STAND, { armN: [-8, -170], armF: [-8, -170] }),
    pb: on({ hip: [94, 100], torso: -72, head: -80, bend: 0, armN: [-10, -170], armF: [-10, -170], legN: [8, 112], legF: [8, 112] }) },
  { names: ['jump squat', 'squat jump', 'jumping squat'], accent: 'hip', hold: 250, travel: 600,
    pa: SQUAT, pb: P(STAND, { hip: [100, 60], armN: [-70, -70], armF: [-70, -70] }) },
  { names: ['leg press', 'leg press machine', 'sled leg press', 'single leg press'], accent: 'hip', hold: 500, props: [[48, 128, 92, 90], [150, 40, 172, 64]],
    pa: { hip: [92, 108], torso: -128, head: -120, bend: 0, armN: [100, 100], armF: [100, 100], legN: [-30, 40], legF: [-30, 40] },
    pb: { hip: [92, 108], torso: -128, head: -120, bend: 0, armN: [100, 100], armF: [100, 100], legN: [-40, -40], legF: [-40, -40] } },
  { names: ['leg extension', 'leg extensions', 'quad extension', 'knee extension machine'], accent: 'kN', hold: 500, props: SEAT,
    pa: on(P(SEATED, { armN: [90, 90], armF: [90, 90] }), ['fN']), pb: { ...on(P(SEATED, { armN: [90, 90], armF: [90, 90] }), ['fN']), legN: [-4, -4], legF: [-4, -4] } },
  { names: ['leg curl', 'lying leg curl', 'hamstring curl', 'seated leg curl', 'prone leg curl'], accent: 'kN', hold: 500,
    pa: { hip: [86, 118], torso: 0, head: 0, bend: 0, armN: [150, 30], armF: [150, 30], legN: [180, 180], legF: [180, 180] },
    pb: { hip: [86, 118], torso: 0, head: 0, bend: 0, armN: [150, 30], armF: [150, 30], legN: [180, -70], legF: [180, -70] } },
  { names: ['nordic curl', 'nordic', 'nordics', 'natural leg curl', 'nordic hamstring curl'], accent: 'kN', hold: 400,
    pa: on({ hip: [100, 100], torso: -90, head: -90, bend: 0, armN: [80, 80], armF: [80, 80], legN: [90, 180], legF: [90, 180] }, ['kN']),
    pb: on({ hip: [117, 107], torso: -26, head: -22, bend: 0, armN: [60, 60], armF: [60, 60], legN: [130, 180], legF: [130, 180] }, ['kN']) },
  { names: ['hip thrust', 'hip thrusts', 'barbell hip thrust', 'glute thrust', 'single leg hip thrust', 'banded hip thrust'], accent: 'hip', hold: 600, props: [[118, 100, 152, 100], [122, 100, 122, 129], [148, 100, 148, 129]],
    pa: { hip: [100, 122], torso: -40, head: -30, bend: 0, armN: [20, 20], armF: [20, 20], legN: [-130, 95], legF: [-130, 95] },
    pb: { hip: [100, 104], torso: -10, head: -4, bend: 0, armN: [10, 10], armF: [10, 10], legN: [-170, 80], legF: [-170, 80] } },
  { names: ['calf raise', 'calf raises', 'standing calf raise', 'seated calf raise', 'heel raise', 'single leg calf raise'], accent: 'kN', hold: 500,
    pa: STAND, pb: P(STAND, { hip: [101, 70] }) },
  { names: ['step up', 'step ups', 'box step up', 'dumbbell step up'], accent: 'hip', hold: 500, props: BOX,
    pa: on({ hip: [104, 84], torso: -84, head: -84, bend: 0, armN: [92, 92], armF: [88, 88], legN: [-14, 104], legF: [96, 96] }, ['fF']),
    pb: { hip: [130, 46], torso: -90, head: -90, bend: 0, armN: [90, 90], armF: [90, 90], legN: [90, 90], legF: [100, 120] } },
  { names: ['box jump', 'box jumps', 'broad jump', 'tuck jump', 'tuck jumps', 'vertical jump'], accent: 'hip', hold: 300, travel: 650, props: BOX,
    pa: on({ hip: [92, 100], torso: -58, head: -70, bend: 0, armN: [150, 150], armF: [150, 150], legN: [12, 115], legF: [12, 115] }),
    pb: on({ hip: [140, 60], torso: -84, head: -86, bend: 0, armN: [-70, -70], armF: [-70, -70], legN: [40, 120], legF: [40, 120] }, ['fN'], 100) },

  // ---- Hinges and full body
  { names: ['back extension', 'hyperextension', 'hyper extension', '45 degree back extension', 'roman chair back extension', 'reverse hyper'], accent: 'mid', hold: 600, props: [[86, 96, 112, 84], [100, 90, 100, 129]],
    pa: { hip: [100, 88], torso: 62, head: 70, bend: 0, armN: [150, 150], armF: [150, 150], legN: [150, 150], legF: [150, 150] },
    pb: { hip: [100, 88], torso: -20, head: -18, bend: 0, armN: [170, 150], armF: [170, 150], legN: [150, 150], legF: [150, 150] } },
  { names: ['power clean', 'clean', 'hang clean', 'squat clean', 'dumbbell clean', 'kettlebell clean'], accent: 'hip', hold: 400,
    pa: on({ hip: [92, 80], torso: -42, head: -50, bend: 0, armN: [90, 90], armF: [90, 90], legN: [76, 104], legF: [76, 104] }),
    pb: P(STAND, { armN: [-8, -170], armF: [-8, -170] }) },
  { names: ['snatch', 'power snatch', 'dumbbell snatch', 'kettlebell snatch', 'hang snatch'], accent: 'sh', hold: 400,
    pa: on({ hip: [92, 80], torso: -42, head: -50, bend: 0, armN: [90, 90], armF: [90, 90], legN: [76, 104], legF: [76, 104] }),
    pb: P(STAND, { armN: [-96, -96], armF: [-96, -96] }) },
  { names: ['thruster', 'thrusters', 'clean and jerk', 'clean and press', 'wall ball', 'wall balls', 'squat press'], accent: 'hip', hold: 300,
    pa: on({ hip: [94, 100], torso: -72, head: -80, bend: 0, armN: [-10, -170], armF: [-10, -170], legN: [8, 112], legF: [8, 112] }),
    pb: P(STAND, { armN: [-92, -92], armF: [-92, -92] }) },
  { names: ['burpee', 'burpees', 'sprawl'], accent: 'mid', hold: 250, travel: 700,
    pa: P(STAND, { hip: [100, 66], armN: [-90, -90], armF: [-90, -90] }), pb: PUSH_TOP },
  { names: ['inchworm', 'inch worm', 'walkout', 'walk out'], accent: 'mid', hold: 600,
    pa: on({ hip: [86, 76], torso: 70, head: 80, bend: 0, armN: [90, 90], armF: [90, 90], legN: [96, 96], legF: [96, 96] }, ['hN', 'fN']),
    pb: PUSH_TOP },
  { names: ['mountain climber', 'mountain climbers', 'climber', 'cross body mountain climber'], accent: 'hip', hold: 60, travel: 380,
    pa: { ...PUSH_TOP, legN: [60, 150] }, pb: { ...PUSH_TOP, legF: [60, 150] } },
  { names: ['bear crawl walk', 'crab walk', 'reverse plank', 'tabletop', 'table top', 'reverse table top'], accent: 'hip', hold: 800,
    pa: on({ hip: [92, 116], torso: 0, head: -6, bend: 0, armN: [110, 110], armF: [110, 110], legN: [-170, 80], legF: [-170, 80] }, ['hN', 'fN']),
    pb: on({ hip: [92, 98], torso: 6, head: -4, bend: 0, armN: [116, 116], armF: [116, 116], legN: [-176, 86], legF: [-176, 86] }, ['hN', 'fN']) },

  // ---- Core
  { names: ['leg raise', 'leg raises', 'lying leg raise', 'straight leg raise', 'leg lift', 'leg lifts'], accent: 'hip', hold: 500,
    pa: SUPINE, pb: P(SUPINE, { legN: [-92, -92], legF: [-92, -92] }) },
  { names: ['reverse crunch', 'reverse crunches'], accent: 'hip', hold: 500,
    pa: P(SUPINE, { legN: [-120, 170], legF: [-120, 170] }), pb: P(SUPINE, { hip: [86, 114], legN: [-60, -170], legF: [-60, -170] }) },
  { names: ['v up', 'v ups', 'v sit up', 'jackknife', 'jack knife', 'pike up'], accent: 'mid', hold: 400,
    pa: P(SUPINE, { armN: [0, 0], armF: [0, 0] }), pb: P(SUPINE, { torso: -48, head: -44, armN: [-40, -40], armF: [-40, -40], legN: [-132, -132], legF: [-132, -132] }) },
  { names: ['hollow hold', 'hollow body hold', 'hollow body', 'hollow rock', 'hollow'], accent: 'mid', hold: 1200,
    pa: P(SUPINE, { torso: -10, head: -14, armN: [-8, -8], armF: [-8, -8], legN: [-170, -170], legF: [-170, -170] }),
    pb: P(SUPINE, { torso: -16, head: -20, armN: [-14, -14], armF: [-14, -14], legN: [-164, -164], legF: [-164, -164] }) },
  { names: ['flutter kick', 'flutter kicks', 'scissor kick', 'scissor kicks', 'scissors'], accent: 'hip', hold: 60, travel: 380,
    pa: P(SUPINE, { legN: [-166, -166], legF: [176, 176] }), pb: P(SUPINE, { legN: [176, 176], legF: [-166, -166] }) },
  { names: ['bicycle crunch', 'bicycle crunches', 'bicycle', 'bicycles'], accent: 'mid', hold: 120, travel: 520,
    pa: P(SUPINE, { torso: -16, head: -22, armN: [-150, 60], armF: [-150, 60], legN: [-50, 160], legF: [-176, -176] }),
    pb: P(SUPINE, { torso: -16, head: -22, armN: [-150, 60], armF: [-150, 60], legN: [-176, -176], legF: [-50, 160] }) },
  { names: ['russian twist', 'russian twists', 'seated twist', 'oblique twist'], accent: 'mid', hold: 120, travel: 520,
    pa: { hip: [96, 120], torso: -58, head: -60, bend: 0, armN: [10, -10], armF: [10, -10], legN: [-22, 40], legF: [-22, 40] },
    pb: { hip: [96, 120], torso: -58, head: -56, bend: 0, armN: [60, 30], armF: [60, 30], legN: [-22, 40], legF: [-22, 40] } },
  { names: ['l sit', 'lsit', 'l sit hold', 'v sit'], accent: 'mid', hold: 1400,
    pa: on({ hip: [98, 118], torso: -84, head: -84, bend: 0, armN: [92, 92], armF: [92, 92], legN: [2, 2], legF: [2, 2] }, ['hN']),
    pb: on({ hip: [98, 114], torso: -82, head: -82, bend: 0, armN: [94, 94], armF: [94, 94], legN: [-4, -4], legF: [-4, -4] }, ['hN']) },
  { names: ['dragon flag', 'dragon flags'], accent: 'mid', hold: 700, props: BENCH,
    pa: { hip: [96, 104], torso: 0, head: 0, bend: 0, armN: [-30, 10], armF: [-30, 10], legN: [180, 180], legF: [180, 180] },
    pb: { hip: [104, 82], torso: 42, head: 10, bend: 0, armN: [-30, 10], armF: [-30, 10], legN: [-138, -138], legF: [-138, -138] } },
  { names: ['ab wheel', 'ab rollout', 'ab roller', 'rollout', 'barbell rollout', 'ab wheel rollout'], accent: 'mid', hold: 500,
    pa: on({ hip: [92, 100], torso: -64, head: -62, bend: 0, armN: [72, 72], armF: [72, 72], legN: [90, 180], legF: [90, 180] }, ['kN', 'hN']),
    pb: on({ hip: [84, 104], torso: -16, head: -12, bend: 0, armN: [10, 10], armF: [10, 10], legN: [120, 180], legF: [120, 180] }, ['kN', 'hN']) },
  { names: ['cable crunch', 'kneeling cable crunch', 'rope crunch'], accent: 'mid', hold: 500,
    pa: on(P(KNEEL, { torso: -84, head: -84, armN: [-120, 60], armF: [-120, 60] }), ['kN']),
    pb: on(P(KNEEL, { torso: -14, head: 10, bend: -6, armN: [-30, 140], armF: [-30, 140] }), ['kN']) },

  // ---- Conditioning
  { names: ['jumping jack', 'jumping jacks', 'star jump', 'star jumps', 'jacks'], accent: 'mid', hold: 80, travel: 380,
    pa: STAND, pb: P(STAND, { hip: [100, 72], armN: [-110, -110], armF: [-70, -70], legN: [80, 80], legF: [100, 100] }) },
  { names: ['high knees', 'high knee', 'knee drive', 'a skip', 'running in place'], accent: 'hip', hold: 40, travel: 300,
    pa: on({ ...STAND, armN: [60, -60], armF: [120, 100], legN: [-2, 90], legF: [90, 90] }, ['fF']),
    pb: on({ ...STAND, armN: [120, 100], armF: [60, -60], legN: [90, 90], legF: [-2, 90] }, ['fN']) },
  { names: ['run', 'running', 'jog', 'jogging', 'sprint', 'sprints', 'treadmill', 'treadmill run'], accent: 'hip', hold: 40, travel: 360,
    pa: { hip: [100, 74], torso: -80, head: -84, bend: 0, armN: [60, -40], armF: [140, 120], legN: [40, 110], legF: [130, 160] },
    pb: { hip: [100, 74], torso: -80, head: -84, bend: 0, armN: [140, 120], armF: [60, -40], legN: [130, 160], legF: [40, 110] } },
  { names: ['skater', 'skaters', 'skater jump', 'skater hops', 'lateral bound'], accent: 'hip', hold: 120, travel: 450,
    pa: on({ hip: [96, 90], torso: -60, head: -66, bend: 0, armN: [140, 120], armF: [30, 20], legN: [30, 110], legF: [130, 150] }, ['fN']),
    pb: on({ hip: [104, 90], torso: -60, head: -66, bend: 0, armN: [30, 20], armF: [140, 120], legN: [130, 150], legF: [30, 110] }, ['fF']) },
  { names: ['jump rope', 'skipping', 'skipping rope', 'double unders', 'double under', 'rope skipping'], accent: 'kN', hold: 60, travel: 280,
    pa: P(STAND, { armN: [110, 30], armF: [110, 30] }), pb: P(STAND, { hip: [100, 68], armN: [110, 40], armF: [110, 40], legN: [96, 84], legF: [96, 84] }) },
  { names: ['rowing machine', 'rower', 'erg', 'ergometer', 'indoor rowing', 'rowing'], accent: 'mid', hold: 150, travel: 700, props: [[50, 124, 170, 124]],
    pa: { hip: [86, 116], torso: -64, head: -70, bend: 0, armN: [6, 4], armF: [6, 4], legN: [-40, 60], legF: [-40, 60] },
    pb: { hip: [86, 116], torso: -104, head: -100, bend: 0, armN: [110, -6], armF: [110, -6], legN: [-2, 4], legF: [-2, 4] } },
  { names: ['cycling', 'bike', 'stationary bike', 'exercise bike', 'spin', 'spin class', 'peloton', 'assault bike', 'air bike'], accent: 'kN', hold: 40, travel: 420, props: [[78, 72, 112, 72], [94, 72, 100, 129], [130, 52, 140, 52]],
    pa: { hip: [94, 68], torso: -42, head: -46, bend: 0, armN: [20, 50], armF: [20, 50], legN: [10, 100], legF: [80, 130] },
    pb: { hip: [94, 68], torso: -42, head: -46, bend: 0, armN: [20, 50], armF: [20, 50], legN: [80, 130], legF: [10, 100] } },
  { names: ['shadow boxing', 'boxing', 'punch', 'punches', 'heavy bag', 'bag work', 'jab'], accent: 'sh', hold: 80, travel: 320,
    pa: P(STAND, { torso: -86, armN: [60, -80], armF: [40, -90], legN: [76, 94], legF: [106, 96] }),
    pb: P(STAND, { torso: -84, armN: [0, 0], armF: [40, -90], legN: [76, 94], legF: [106, 96] }) },
];
