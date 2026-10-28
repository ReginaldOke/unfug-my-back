// Body regions (SPEC.md › 3D pain body map) and the 2D chart geometry that stands in for the 3D model.

const cap = s => s[0].toUpperCase() + s.slice(1);
const SIDES = ['left', 'right'];

const LEG_PARTS = [
  ['thigh_back', 'Back of thigh'], ['thigh_front', 'Front of thigh'], ['knee', 'Knee'], ['calf', 'Calf'],
  ['shin', 'Shin'], ['ankle', 'Ankle'], ['foot_top', 'Top of foot'], ['sole', 'Sole of foot'],
];

export const REGIONS = [
  { regionId: 'neck', displayName: 'Neck', side: 'centre', parentRegion: 'spine' },
  ...['upper', 'mid', 'lower'].flatMap(level => ['left', 'centre', 'right'].map(side => ({
    regionId: `${level}_back_${side}`, displayName: `${cap(level)} back, ${side}`, side, parentRegion: `${level}_back`,
  }))),
  ...['buttock', 'hip', 'groin'].flatMap(part => SIDES.map(side => ({
    regionId: `${part}_${side}`, displayName: `${cap(part)}, ${side}`, side, parentRegion: 'pelvis',
  }))),
  ...LEG_PARTS.flatMap(([part, name]) => SIDES.map(side => ({
    regionId: `${part}_${side}`, displayName: `${name}, ${side}`, side, parentRegion: `leg_${side}`,
  }))),
];

export const regionById = Object.fromEntries(REGIONS.map(r => [r.regionId, r]));

// Geometry in a 200 × 450 viewBox.
// Back view: you see the person from behind, so their left side is on your left.
// Front view: they face you, so their right side is on your left.
function legs(view) {
  const [onLeft, onRight] = view === 'front' ? ['right', 'left'] : ['left', 'right'];
  const parts = view === 'front'
    ? [['thigh_front', 234, 84], ['knee', 318, 26], ['shin', 344, 60], ['ankle', 404, 12], ['foot_top', 416, 16]]
    : [['thigh_back', 240, 78], ['calf', 344, 60], ['ankle', 404, 12], ['sole', 416, 16]];
  return parts.flatMap(([p, y, h]) => [
    { id: `${p}_${onLeft}`, x: 63, y, w: 34, h },
    { id: `${p}_${onRight}`, x: 103, y, w: 34, h },
  ]);
}

const backTorso = [['upper', 64, 46], ['mid', 110, 44], ['lower', 154, 40]].flatMap(([lvl, y, h]) =>
  [['left', 60, 26], ['centre', 86, 28], ['right', 114, 26]].map(([side, x, w]) => ({ id: `${lvl}_back_${side}`, x, y, w, h })));

const NECK = { id: 'neck', x: 89, y: 46, w: 22, h: 16 };

export const SHAPES = {
  back: [NECK, ...backTorso,
    { id: 'buttock_left', x: 60, y: 194, w: 40, h: 44 }, { id: 'buttock_right', x: 100, y: 194, w: 40, h: 44 },
    ...legs('back')],
  front: [NECK,
    { id: 'hip_right', x: 58, y: 190, w: 22, h: 40 }, { id: 'groin_right', x: 80, y: 198, w: 20, h: 34 },
    { id: 'groin_left', x: 100, y: 198, w: 20, h: 34 }, { id: 'hip_left', x: 120, y: 190, w: 22, h: 40 },
    ...legs('front')],
};

export const SILHOUETTE = [
  { type: 'circle', attrs: { cx: 100, cy: 26, r: 19 } },
  { type: 'rect', attrs: { x: 58, y: 60, width: 84, height: 178, rx: 22 } },
  { type: 'rect', attrs: { x: 36, y: 66, width: 19, height: 150, rx: 9.5 } },
  { type: 'rect', attrs: { x: 145, y: 66, width: 19, height: 150, rx: 9.5 } },
  { type: 'rect', attrs: { x: 62, y: 226, width: 36, height: 208, rx: 14 } },
  { type: 'rect', attrs: { x: 102, y: 226, width: 36, height: 208, rx: 14 } },
];
