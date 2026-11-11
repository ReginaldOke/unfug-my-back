// Every animated move stays physically possible all the way through: nothing passes through the floor,
// no limb jumps between frames, and knees, elbows and hips only bend the way bodies bend.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ALL_MOVES, poseAt } from '../web/views/figure.js';
import { FLOOR } from '../web/views/figure-moves.js';

const deg = (a, b) => (Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI;
const wrap = a => ((a % 360) + 540) % 360 - 180;
const STEPS = 60;

export function problems(move) {
  const out = [];
  let prev = null;
  for (let i = 0; i <= STEPS; i++) {
    const p = poseAt(move, i / STEPS);
    const at = `at ${Math.round((i / STEPS) * 100)}%`;
    if (move.floor !== false) {
      for (const k of ['sh', 'mid', 'hip', 'eN', 'hN', 'kN', 'fN', 'eF', 'hF', 'kF', 'fF']) if (p[k][1] > FLOOR + 3) out.push(`${k} through the floor ${at}`);
      if (p.head[1] + 8.5 > FLOOR + 4) out.push(`head through the floor ${at}`);
    }
    if (prev) {
      const jump = Math.max(...Object.keys(p).filter(k => Array.isArray(p[k])).map(k => Math.hypot(p[k][0] - prev[k][0], p[k][1] - prev[k][1])));
      if (jump > 9) out.push(`jumps ${jump.toFixed(0)}px ${at}`);
    }
    prev = p;
    if (!move.pa || move.view) continue;
    const flip = move.supine ? -1 : 1;
    for (const side of ['N', 'F']) {
      const thigh = deg(p.hip, p[`k${side}`]), shin = deg(p[`k${side}`], p[`f${side}`]);
      const knee = wrap(shin - thigh) * flip;
      if (knee < -8 && knee > -172) out.push(`knee ${side} bends ${knee.toFixed(0)}° ${at}`);
      const upper = deg(p.sh, p[`e${side}`]), fore = deg(p[`e${side}`], p[`h${side}`]);
      const elbow = wrap(upper - fore) * flip;
      if (elbow < -8 && elbow > -172) out.push(`elbow ${side} bends ${elbow.toFixed(0)}° ${at}`);
      const down = deg(p.sh, p.hip);
      const hip = -wrap(thigh - down) * flip;
      if (hip < -64 || hip > 172) out.push(`hip ${side} at ${hip.toFixed(0)}° ${at}`);
    }
  }
  return [...new Set(out.map(x => x.replace(/ at \d+%$/, '')))];
}

test('every animated move bends only the way a body can, and stays above the floor', () => {
  const bad = ALL_MOVES.map(m => [m.names[0], problems(m)]).filter(([, p]) => p.length);
  assert.deepEqual(bad, []);
});
