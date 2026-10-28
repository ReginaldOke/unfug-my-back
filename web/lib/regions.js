// Body regions for the pain map (SPEC.md › 3D pain body map). The spec's minimum set (spine, pelvis, legs)
// plus head, shoulders, arms, chest and belly, so a tap anywhere on the body lands in a region.

const cap = s => s[0].toUpperCase() + s.slice(1);
const SIDES = ['left', 'right'];

const LEG_PARTS = [
  ['thigh_back', 'Back of thigh'], ['thigh_front', 'Front of thigh'], ['knee', 'Knee'], ['calf', 'Calf'],
  ['shin', 'Shin'], ['ankle', 'Ankle'], ['foot_top', 'Top of foot'], ['sole', 'Sole of foot'],
];
const ARM_PARTS = [['shoulder', 'Shoulder'], ['upper_arm', 'Upper arm'], ['forearm', 'Forearm'], ['hand', 'Hand']];

const sided = (parts, parentRegion) => parts.flatMap(([part, name]) => SIDES.map(side => ({
  regionId: `${part}_${side}`, displayName: `${name}, ${side}`, side, parentRegion: typeof parentRegion === 'function' ? parentRegion(side) : parentRegion,
})));

export const REGIONS = [
  { regionId: 'head', displayName: 'Head', side: 'centre', parentRegion: 'head' },
  { regionId: 'neck', displayName: 'Neck', side: 'centre', parentRegion: 'spine' },
  ...['upper', 'mid', 'lower'].flatMap(level => ['left', 'centre', 'right'].map(side => ({
    regionId: `${level}_back_${side}`, displayName: `${cap(level)} back, ${side}`, side, parentRegion: `${level}_back`,
  }))),
  ...sided([['chest', 'Chest']], 'front'),
  { regionId: 'abdomen', displayName: 'Belly', side: 'centre', parentRegion: 'front' },
  ...sided([['buttock', 'Buttock'], ['hip', 'Hip'], ['groin', 'Groin']], 'pelvis'),
  ...sided(ARM_PARTS, side => `arm_${side}`),
  ...sided(LEG_PARTS, side => `leg_${side}`),
];

export const regionById = Object.fromEntries(REGIONS.map(r => [r.regionId, r]));
