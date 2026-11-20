// A name for a routine from what's in it, for when it hasn't been given one: "Push", "Legs", "Hip and
// hamstring stretch", "Core", "Full body", "Push pull legs" for a split. Each move is sorted by what it
// works, then the name follows whatever most of the routine does. Pure, unit-tested in test/routine-name.test.js.
import { normName } from './move-names.js';

// What a move is, by the words in its name. The first that fits wins, so the more particular come first.
const KINDS = [
  ['calm', /\b(?:breath\w*|meditat\w*|body scan|relax\w*|mindful\w*)\b/],
  ['cardio', /\b(?:run|running|jog\w*|walk\w*|hike|hiking|cycl\w*|bike|biking|ride|swim\w*|rowing machine|erg|elliptical|stair\w*|skip\w*|jump rope|burpee|jumping jack|jack|high knee|sprint\w*|march\w*|shuttle|cardio|treadmill|aqua\w*|water walk\w*)\b/],
  ['rehab', /\b(?:mckenzie|pelvic tilt|press up|sphinx|nerve glide|nerve floss\w*|abdominal drawing|drawing in|chin tuck|cat camel|prone lying)\b/],
  ['stretch', /\b(?:stretch\w*|pose|cat|cow|child|pigeon|cobra|downward dog|down dog|upward dog|twist|thread the needle|open book|opener|mobility|foam roll\w*|roll out|rotation|circle\w*|figure 4|figure four|knee to chest|world.?s greatest|90 90|frog|butterfly|happy baby|sun salutation|warrior|triangle|lizard|cossack|wall angel|doorway|sleeper|pec stretch|scorpion|windmill|hang)\b/],
  ['core', /\b(?:plank\w*|dead bug|bird dog|crunch\w*|sit up|situp|hollow\w*|pallof|russian twist|leg raise|leg lower\w*|toe touch\w*|v up|flutter kick|ab|abs|core|mountain climber|bicycle|suitcase carry|farmer\w*|carry|superman|hundred|roll up|stir the pot|ab wheel|rollout|side bridge|woodchop\w*|anti rotation)\b/],
  ['pull', /\b(?:pull up|pullup|chin up|chinup|row|rows|pulldown|pull down|face pull|pull apart|curl|curls|shrug\w*|reverse fly|rear delt|lat\w*|muscle up|inverted row|y raise|t raise|iyt|ytw)\b/],
  ['push', /\b(?:bench|push up|pushup|press|dip|dips|tricep\w*|fly|flye|flies|lateral raise|front raise|skull crusher|pushdown|chest|arnold|pike)\b/],
  ['legs', /\b(?:squat\w*|lunge\w*|deadlift\w*|rdl|hinge|hip thrust\w*|bridge|glute\w*|calf|calves|step up|step down|leg press|leg curl|leg extension|split squat|clam\w*|abduct\w*|adduct\w*|hamstring curl|nordic\w*|good morning|swing|kettlebell swing|wall sit|pistol|thruster|clean|snatch|box jump|monster walk|band walk|fire hydrant|donkey kick|kickback\w*)\b/],
];
// Where a stretch is felt, for naming a stretching routine by its focus
const AREAS = [
  ['hip', /\b(?:hip\w*|pigeon|figure 4|figure four|90 90|frog|butterfly|lizard|glute\w*|piriformis|psoas|groin|adductor)\b/],
  ['hamstring', /\b(?:hamstring\w*|forward fold|toe touch\w*|seated forward)\b/],
  ['back', /\b(?:back|spine|spinal|cat|cow|cobra|sphinx|child|mckenzie|knee to chest|twist|lumbar|thoracic|open book|thread the needle|extension\w*)\b/],
  ['shoulder', /\b(?:shoulder\w*|pec|chest|doorway|sleeper|wall angel|lat\w*|arm circle\w*)\b/],
  ['neck', /\b(?:neck|chin tuck|trap\w*|cervical)\b/],
  ['calf', /\b(?:calf|calves|ankle\w*|achilles)\b/],
];

const kindOf = name => KINDS.find(([, re]) => re.test(normName(name)))?.[0] ?? null;
const share = (list, k) => list.filter(x => x === k).length / Math.max(1, list.length);
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
const AREA_WORD = { hip: 'hip', hamstring: 'hamstring', back: 'back', shoulder: 'shoulder', neck: 'neck', calf: 'calf' };

/** The areas most of the stretches work, as "hip and hamstring", or null when there's no clear focus. */
function focusOf(moves) {
  const counts = new Map();
  for (const m of moves) for (const [area, re] of AREAS) if (re.test(normName(m.name))) counts.set(area, (counts.get(area) ?? 0) + 1);
  const ranked = [...counts].sort((a, b) => b[1] - a[1]);
  if (!ranked.length || ranked[0][1] < Math.max(2, moves.length * 0.4)) return null;
  const top = ranked.filter(([, n]) => n >= moves.length * 0.4).slice(0, 2).map(([a]) => AREA_WORD[a]);
  return top.join(' and ');
}

/** A name for one routine's moves ([{ name, dose?, extra? }]), or null when there's nothing to go on. */
export function nameForMoves(moves) {
  const list = (moves ?? []).filter(m => m?.name?.trim());
  if (!list.length) return null;
  if (list.length === 1) return cap(list[0].name.trim());
  const kinds = list.map(m => kindOf(m.name));
  const known = kinds.filter(Boolean);
  if (!known.length) return null;
  const of = k => share(known, k);
  const strength = known.filter(k => ['push', 'pull', 'legs'].includes(k));
  const st = k => share(strength, k);

  if (of('calm') >= 0.6) return list.some(m => /breath/i.test(m.name)) ? 'Breathing' : 'Relaxation';
  if (of('cardio') >= 0.6) {
    const cardio = list.filter((m, i) => kinds[i] === 'cardio').map(m => normName(m.name));
    if (cardio.every(n => /walk|march|hike/.test(n))) return 'Walking';
    if (cardio.every(n => /run|jog|sprint/.test(n))) return 'Running';
    if (cardio.every(n => /swim|aqua|water/.test(n))) return 'Swimming';
    if (cardio.every(n => /cycl|bike|ride/.test(n))) return 'Cycling';
    return 'Cardio';
  }
  if (of('rehab') >= 0.4 && of('rehab') + of('stretch') >= 0.7) return /mckenzie|press up|sphinx|prone/i.test(list.map(m => m.name).join(' ')) && of('rehab') >= 0.6 ? 'McKenzie extensions' : 'Back care';
  if (of('stretch') + of('rehab') >= 0.65) {
    const focus = focusOf(list);
    // Moving through a range (circles, rotations, cat-cow) rather than holding a stretch
    const moving = list.filter(m => /mobility|circle|rotation|open book|cat|world.?s greatest|thread|swing|roll/i.test(m.name)).length;
    const word = list.filter(m => /pose|salutation|warrior|triangle/i.test(m.name)).length >= list.length * 0.5 ? 'yoga' : moving >= list.length * 0.5 ? 'mobility' : 'stretch';
    if (focus) return cap(`${focus} ${word}`);
    return word === 'yoga' ? 'Yoga' : word === 'mobility' ? 'Mobility' : 'Stretches';
  }
  if (of('core') >= 0.6) return 'Core';
  if (strength.length >= known.length * 0.5) {
    const weighted = list.some(m => /\d\s*(?:kg|lb)/i.test(m.extra ?? ''));
    if (st('push') >= 0.7) return 'Push';
    if (st('pull') >= 0.7) return 'Pull';
    if (st('legs') >= 0.7) return of('core') >= 0.25 ? 'Legs and core' : 'Legs';
    if (st('legs') <= 0.15) return 'Upper body';
    if (st('legs') >= 0.6) return 'Lower body';
    return weighted ? 'Full body strength' : 'Full body';
  }
  if (of('core') >= 0.35 && of('stretch') >= 0.25) return 'Core and mobility';
  if (of('stretch') >= 0.3 && strength.length) return 'Strength and mobility';
  if (of('core') >= 0.4) return 'Core';
  return null;
}

/**
 * A name for a routine with several variations: the split when the days say what it is ("Push pull
 * legs", "Upper lower"), else what all the days have in common.
 */
export function nameForSplit(days) {
  const names = days.map(d => d.name ?? nameForMoves(d.items) ?? '').map(n => normName(n));
  const has = w => names.some(n => n.split(' ').includes(w) || n === w);
  if (has('push') && has('pull') && (has('leg') || has('legs'))) return 'Push pull legs';
  if (has('push') && has('pull')) return 'Push pull';
  if (has('upper') && has('lower')) return 'Upper lower';
  const all = nameForMoves(days.flatMap(d => d.items));
  return all ? (/^(?:full body|upper body|lower body|push|pull|legs|core)/i.test(all) ? `${all} plan`.replace(/ strength plan$/, ' strength') : all) : null;
}

/** Variation names for any without one: what each is ("Push", "Legs") when that tells them apart, else A, B, C as the app names new variations. */
export function nameDays(days) {
  const guesses = days.map(d => d.name ?? nameForMoves(d.items));
  const unique = guesses.every((g, i) => g && guesses.indexOf(g) === i);
  return days.map((d, i) => d.name ?? (unique ? guesses[i] : i < 26 ? String.fromCharCode(65 + i) : `Variation ${i + 1}`));
}

/** Makes a name new among `taken` ("Legs" → "Legs 2"). */
export function freshName(name, taken) {
  const used = new Set(taken.map(t => t.trim().toLowerCase()));
  if (!used.has(name.toLowerCase())) return name;
  let n = 2;
  while (used.has(`${name} ${n}`.toLowerCase())) n++;
  return `${name} ${n}`;
}
