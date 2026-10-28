// Maps a tapped point on a standing human model to a body region (SPEC.md › 3D pain body map).
// Works for any human mesh, so the model doesn't need to be split into region meshes.
//
// Model space: Y up, feet at y = 0, height H, centred on x = 0 and z = 0, facing +Z.
// Facing +Z, the person's left side is +X.

export const H = 1.8;

const LEVELS = [['upper', 0.70], ['mid', 0.62], ['lower', 0.53]];

/** point: {x,y,z} in model space; normal: surface normal there (optional). Returns a regionId or null. */
export function regionAt(point, normal = null, height = H) {
  const fy = point.y / height, fx = point.x / height, ax = Math.abs(fx);
  const side = fx >= 0 ? 'left' : 'right';
  const back = normal ? normal.z < 0 : point.z < 0;
  const lateral = normal ? Math.abs(normal.x) > 0.75 : false;

  // Height bands are calibrated to the Free Pack male base mesh (web/assets/body.obj): neck at 87–91 %,
  // A-pose arms that reach down to about half height, knees around 25–31 %.
  if (fy > 0.905) return null;                                  // head
  if (fy > 0.81) return ax < 0.07 ? 'neck' : null;              // neck; shoulders have no region
  if (fy > 0.47 && ax > 0.115) return null;                     // arms
  if (fy >= 0.53) {
    if (!back && !lateral) return null;                         // chest and belly have no regions
    const level = LEVELS.find(([, min]) => fy >= min)[0];
    return `${level}_back_${ax < 0.03 ? 'centre' : side}`;
  }
  if (fy >= 0.45) {                                             // pelvis
    if (lateral) return `hip_${side}`;
    if (back) return `buttock_${side}`;
    return ax > 0.065 ? `hip_${side}` : `groin_${side}`;
  }
  if (fy >= 0.31) return `${back ? 'thigh_back' : 'thigh_front'}_${side}`;
  if (fy >= 0.25) return `knee_${side}`;
  if (fy >= 0.075) return `${back ? 'calf' : 'shin'}_${side}`;
  if (fy >= 0.04) return `ankle_${side}`;
  return `${(normal && normal.y < -0.5) || back ? 'sole' : 'foot_top'}_${side}`;
}

/** Approximate centre of each region as {fx, fy, back}, for placing markers that have no saved tap point. */
export function regionAnchor(regionId) {
  const m = regionId.match(/^(.*?)_(left|right|centre)$/);
  const [part, side] = m ? [m[1], m[2]] : [regionId, 'centre'];
  const sx = side === 'left' ? 1 : side === 'right' ? -1 : 0;
  const back = { upper_back: 0.75, mid_back: 0.66, lower_back: 0.575 };
  if (back[part] != null) return { fx: sx * 0.06, fy: back[part], back: true };
  const table = {
    neck: [0, 0.86, true], buttock: [0.045, 0.49, true], hip: [0.085, 0.5, false], groin: [0.03, 0.47, false],
    thigh_back: [0.055, 0.38, true], thigh_front: [0.055, 0.38, false], knee: [0.055, 0.28, false],
    calf: [0.055, 0.15, true], shin: [0.055, 0.15, false], ankle: [0.055, 0.057, true],
    foot_top: [0.055, 0.02, false], sole: [0.055, 0.01, true],
  };
  const [fx, fy, isBack] = table[part] ?? [0, 0.5, true];
  return { fx: sx * fx, fy, back: isBack };
}
