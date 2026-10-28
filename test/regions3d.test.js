import { test } from 'node:test';
import assert from 'node:assert/strict';
import { regionAt, regionAnchor, H } from '../web/lib/regions3d.js';
import { REGIONS } from '../web/lib/regions.js';

const at = (fx, fy, nz, extra = {}) => regionAt({ x: fx * H, y: fy * H, z: nz * 0.1 }, { x: 0, y: 0, z: nz, ...extra });

test('back of the torso maps to level and column; person’s left is +x', () => {
  assert.equal(at(0, 0.58, -1), 'lower_back_centre');
  assert.equal(at(0.06, 0.58, -1), 'lower_back_left');
  assert.equal(at(-0.06, 0.75, -1), 'upper_back_right');
  assert.equal(at(0.05, 0.66, -1), 'mid_back_left');
});

test('every tap lands somewhere: head, shoulders, arms, chest and belly have regions', () => {
  assert.equal(at(0, 0.95, -1), 'head');
  assert.equal(at(0.1, 0.84, -1), 'shoulder_left');
  assert.equal(at(-0.2, 0.71, 1), 'upper_arm_right');
  assert.equal(at(0.29, 0.62, -1), 'forearm_left');
  assert.equal(at(0.38, 0.52, 1), 'hand_left');
  assert.equal(at(0.06, 0.72, 1), 'chest_left');
  assert.equal(at(0, 0.6, 1), 'abdomen');
});

test('a grid of taps over the whole body never comes back empty', () => {
  for (let fy = 0; fy <= 1; fy += 0.02) {
    for (let fx = -0.4; fx <= 0.4; fx += 0.02) {
      for (const nz of [-1, 1]) assert.ok(at(fx, fy, nz), `no region at ${fx.toFixed(2)}, ${fy.toFixed(2)}`);
    }
  }
});

test('pelvis splits into buttocks, hips and groin', () => {
  assert.equal(at(0.04, 0.49, -1), 'buttock_left');
  assert.equal(at(-0.08, 0.49, 1), 'hip_right');
  assert.equal(at(0.02, 0.48, 1), 'groin_left');
  assert.equal(regionAt({ x: 0.15, y: 0.88, z: 0 }, { x: 1, y: 0, z: 0 }), 'hip_left');
});

test('legs map front and back by height', () => {
  assert.equal(at(-0.05, 0.37, -1), 'thigh_back_right');
  assert.equal(at(0.05, 0.37, 1), 'thigh_front_left');
  assert.equal(at(0.05, 0.28, 1), 'knee_left');
  assert.equal(at(0.05, 0.15, -1), 'calf_left');
  assert.equal(at(0.05, 0.15, 1), 'shin_left');
  assert.equal(at(0.05, 0.05, 1), 'ankle_left');
  assert.equal(at(0.05, 0.01, 1), 'foot_top_left');
  assert.equal(regionAt({ x: 0.09, y: 0.005, z: 0 }, { x: 0, y: -1, z: 0 }), 'sole_left');
});

test('every region has an anchor that maps back to itself', () => {
  for (const { regionId } of REGIONS) {
    const a = regionAnchor(regionId);
    const normal = regionId.startsWith('sole') ? { x: 0, y: -1, z: 0 } : { x: 0, y: 0, z: a.back ? -1 : 1 };
    assert.equal(regionAt({ x: a.fx * H, y: a.fy * H, z: 0 }, normal), regionId, regionId);
  }
});
