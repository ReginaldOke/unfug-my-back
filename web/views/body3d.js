// 3D pain map: drag to rotate, pinch or scroll to zoom, tap to mark a region.
// Loads web/assets/body.glb (or body.obj) if present; otherwise shows a built-in stand-in figure.
// Regions come from where the tap lands (lib/regions3d.js), so any standing human mesh works.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { h, vibrate } from '../lib/ui.js';
import { REGIONS, regionById } from '../lib/regions.js';
import { regionAt, regionAnchor, H } from '../lib/regions3d.js';

// Turn the loaded model so it faces +Z. The Free Pack male base mesh faces −Z, hence a half turn.
const MODEL_YAW = Math.PI;
const MODEL_URLS = ['assets/body.obj', 'assets/body.glb'];

export function webglAvailable() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch { return false; }
}

/** markers: array of { regionId, side, intensity, quality, modelPoint? }, mutated in place. */
export function Body3D({ markers, defaultIntensity = () => 5, onChange = () => {}, onAdd = () => {} }) {
  const canvas = h('canvas', { class: 'body3d-canvas', role: 'img', 'aria-label': '3D body. Drag to turn it, pinch to zoom, tap where it hurts.' });
  const label = h('div', { class: 'body3d-label', 'aria-live': 'polite' });
  const chips = h('div', { class: 'chips wrap center body3d-chips' });
  const stage = h('div', { class: 'body3d' }, canvas, label);
  const root = h('div', { class: 'body3d-wrap' }, stage, chips);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(28, 1, 0.05, 40);
  camera.position.set(0, 1.05, -4.4); // start behind the figure: it's a back pain app

  const controls = new OrbitControls(camera, canvas);
  controls.target.set(0, 0.95, 0);
  Object.assign(controls, {
    enablePan: false, enableDamping: true, dampingFactor: 0.08, rotateSpeed: 0.9, zoomSpeed: 0.9,
    minDistance: 1.3, maxDistance: 6, minPolarAngle: Math.PI * 0.22, maxPolarAngle: Math.PI * 0.78, zoomToCursor: true,
  });

  scene.add(new THREE.HemisphereLight(0xffffff, 0x1a1a1c, 1.4));
  const key = new THREE.DirectionalLight(0xffffff, 1.4);
  key.position.set(1.5, 3, 2);
  const keyBack = new THREE.DirectionalLight(0xffffff, 1.4);
  keyBack.position.set(-1.2, 2.5, -3);
  scene.add(key, keyBack);

  const skin = new THREE.MeshStandardMaterial({ color: 0x8a8a90, roughness: 0.75, metalness: 0 });

  const body = new THREE.Group(); // model space: feet at y=0, height H, facing +Z
  const markerGroup = new THREE.Group();
  body.add(markerGroup);
  scene.add(body);
  let meshes = [];
  let ready = false;

  loadModel(skin).then(model => {
    body.add(model);
    meshes = [];
    model.traverse(o => { if (o.isMesh) meshes.push(o); });
    ready = true;
    introStart = performance.now();
    drawMarkers();
  });

  // ---------- markers ----------
  const halo = haloTexture();
  function drawMarkers() {
    markerGroup.clear();
    for (const m of markers) {
      const p = m.modelPoint ? new THREE.Vector3(m.modelPoint.x, m.modelPoint.y, m.modelPoint.z) : anchorPoint(m.regionId);
      if (!p) continue;
      const color = new THREE.Color().setHSL(0.01, 1, 0.62 - m.intensity * 0.012);
      const core = new THREE.Mesh(new THREE.SphereGeometry(0.026, 20, 16), new THREE.MeshBasicMaterial({ color }));
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: halo, color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
      glow.scale.setScalar(0.22 + m.intensity * 0.012);
      core.position.copy(p);
      glow.position.copy(p);
      glow.userData.pulse = Math.random() * Math.PI * 2;
      markerGroup.add(core, glow);
    }
    chips.replaceChildren(...markers.map(m => h('button', {
      type: 'button', class: 'chip spot', 'aria-label': `Remove ${regionById[m.regionId].displayName}`,
      onclick: () => { removeRegion(m.regionId); },
    }, regionById[m.regionId].displayName, h('span', { 'aria-hidden': 'true' }, ' ✕'))));
  }

  /** Surface point for a region without a saved tap point: cast a ray at the region's anchor from outside. */
  function anchorPoint(regionId) {
    if (!meshes.length) return null;
    const a = regionAnchor(regionId);
    const z = a.back ? -3 : 3;
    const origin = body.localToWorld(new THREE.Vector3(a.fx * H, a.fy * H, z));
    const target = body.localToWorld(new THREE.Vector3(a.fx * H, a.fy * H, 0));
    const ray = new THREE.Raycaster(origin, target.sub(origin).normalize());
    const hit = ray.intersectObjects(meshes, false)[0];
    return hit ? body.worldToLocal(hit.point.clone()) : null;
  }

  function removeRegion(regionId) {
    const i = markers.findIndex(m => m.regionId === regionId);
    if (i < 0) return;
    markers.splice(i, 1);
    vibrate(6);
    drawMarkers();
    say(`Removed ${regionById[regionId].displayName.toLowerCase()}`);
    onChange(markers);
  }

  /** Front or back half: is the point nearer the body's back surface or its front, along this line? */
  function facingAt(p) {
    const surfaceZ = fromZ => {
      const origin = body.localToWorld(new THREE.Vector3(p.x, p.y, fromZ));
      const target = body.localToWorld(new THREE.Vector3(p.x, p.y, 0));
      const hit = new THREE.Raycaster(origin, target.sub(origin).normalize()).intersectObjects(meshes, false)[0];
      return hit ? body.worldToLocal(hit.point.clone()).z : null;
    };
    const front = surfaceZ(3), back = surfaceZ(-3);
    if (front == null || back == null || front - back < 0.02) return null;
    return p.z < (front + back) / 2 ? 'back' : 'front';
  }

  // ---------- tapping ----------
  const raycaster = new THREE.Raycaster();
  let down = null;
  canvas.addEventListener('pointerdown', e => { down = { x: e.clientX, y: e.clientY, t: performance.now() }; });
  canvas.addEventListener('pointerup', e => {
    if (!down || !ready) return;
    const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
    const quick = performance.now() - down.t < 450;
    down = null;
    if (moved < 8 && quick) pick(e);
  });

  function pick(e) {
    const r = canvas.getBoundingClientRect();
    raycaster.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), camera);
    const hit = raycaster.intersectObjects(meshes, false)[0];
    if (!hit) return;
    const point = body.worldToLocal(hit.point.clone());
    const normal = hit.face.normal.clone().transformDirection(hit.object.matrixWorld)
      .applyQuaternion(body.quaternion.clone().invert());
    const regionId = regionAt(point, normal, H, facingAt(point));
    if (markers.some(m => m.regionId === regionId)) return removeRegion(regionId);
    markers.push({
      regionId, side: regionById[regionId].side, intensity: defaultIntensity(), quality: 'ache',
      modelPoint: { x: +point.x.toFixed(4), y: +point.y.toFixed(4), z: +point.z.toFixed(4) },
    });
    vibrate(8);
    drawMarkers();
    say(regionById[regionId].displayName);
    onChange(markers);
    onAdd(regionId);
  }

  let sayTimer;
  function say(text) {
    label.textContent = text;
    label.classList.add('show');
    clearTimeout(sayTimer);
    sayTimer = setTimeout(() => label.classList.remove('show'), 1600);
  }

  // ---------- sizing & loop ----------
  const resize = () => {
    const { width, height } = stage.getBoundingClientRect();
    if (!width || !height) return;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  };
  const ro = new ResizeObserver(resize);
  ro.observe(stage);

  let introStart = null;
  let wasConnected = false;
  const clock = new THREE.Clock();
  renderer.setAnimationLoop(() => {
    if (root.isConnected) wasConnected = true;
    else if (wasConnected) return dispose();
    const t = clock.getElapsedTime();
    // Entrance: the figure turns in and settles
    if (introStart != null) {
      const k = Math.min(1, (performance.now() - introStart) / 1100);
      const ease = 1 - Math.pow(1 - k, 3);
      body.rotation.y = (1 - ease) * -0.9;
      body.scale.setScalar(0.92 + 0.08 * ease);
      skin.opacity = ease;
      if (k === 1) introStart = null;
    }
    for (const s of markerGroup.children) if (s.isSprite) s.material.opacity = 0.65 + 0.35 * Math.sin(t * 3 + s.userData.pulse);
    controls.update();
    renderer.render(scene, camera);
  });
  skin.transparent = true;
  skin.opacity = 0;

  function dispose() {
    renderer.setAnimationLoop(null);
    ro.disconnect();
    controls.dispose();
    renderer.dispose();
  }

  root.setMarkers = arr => {
    markers.splice(0, markers.length, ...arr.map(({ regionId, side, intensity, quality, modelPoint }) => ({ regionId, side, intensity, quality, modelPoint: modelPoint ?? null })));
    drawMarkers();
    onChange(markers);
  };
  return root;
}

// ---------- model ----------

async function loadModel(material) {
  for (const url of MODEL_URLS) {
    // Loaded directly (no existence check first) so the offline copy from the service worker is used
    try {
      const obj = url.endsWith('.glb')
        ? (await new (await import('three/addons/loaders/GLTFLoader.js')).GLTFLoader().loadAsync(url)).scene
        : await new (await import('three/addons/loaders/OBJLoader.js')).OBJLoader().loadAsync(url);
      obj.traverse(o => {
        if (!o.isMesh) return;
        o.material = material;
        if (!o.geometry.attributes.normal) o.geometry.computeVertexNormals();
      });
      return normalise(obj);
    } catch (e) {
      console.info(`No model at ${url}`, e?.message ?? e);
    }
  }
  return standInFigure(material);
}

/** Scale to height H, feet on y=0, centred, facing +Z (3ds Max exports are often Z-up). */
function normalise(obj) {
  const wrap = new THREE.Group();
  wrap.add(obj);
  let size = new THREE.Box3().setFromObject(obj).getSize(new THREE.Vector3());
  if (size.z > size.y * 1.2) obj.rotation.x = -Math.PI / 2;
  obj.rotation.y += MODEL_YAW;
  obj.updateMatrixWorld(true);
  size = new THREE.Box3().setFromObject(obj).getSize(new THREE.Vector3());
  obj.scale.multiplyScalar(H / size.y);
  obj.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(obj);
  const centre = box.getCenter(new THREE.Vector3());
  obj.position.set(-centre.x, -box.min.y, -centre.z);
  return wrap;
}

/** Built-in stand-in: a smooth A-pose figure built from capsules, in the same proportions the region map uses. */
function standInFigure(material) {
  const g = new THREE.Group();
  const capsule = (r, len, x, y, z = 0, rotZ = 0, sx = 1, sz = 1) => {
    const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 12, 28), material);
    m.position.set(x, y, z);
    m.rotation.z = rotZ;
    m.scale.set(sx, 1, sz);
    g.add(m);
  };
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.105, 40, 32), material);
  head.position.set(0, 1.665, 0.01);
  head.scale.set(0.9, 1.12, 1);
  g.add(head);
  capsule(0.06, 0.08, 0, 1.5);                           // neck
  capsule(0.16, 0.36, 0, 1.2, 0, 0, 1.12, 0.66);         // chest and back
  capsule(0.15, 0.08, 0, 0.93, 0, 0, 1.1, 0.72);         // pelvis
  for (const s of [1, -1]) {
    capsule(0.05, 0.27, s * 0.235, 1.28, 0, s * 0.18);   // upper arm
    capsule(0.042, 0.25, s * 0.285, 0.98, 0.02, s * 0.1); // forearm
    capsule(0.078, 0.34, s * 0.095, 0.65, 0);             // thigh
    capsule(0.058, 0.33, s * 0.095, 0.27, -0.005);        // shin and calf
    const foot = new THREE.Mesh(new THREE.CapsuleGeometry(0.04, 0.13, 8, 16), material);
    foot.rotation.x = Math.PI / 2;
    foot.position.set(s * 0.095, 0.04, 0.06);
    foot.scale.set(1.1, 1, 0.8);
    g.add(foot);
  }
  return g;
}

function haloTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.25, 'rgba(255,255,255,0.55)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

/** Fallback where WebGL isn't available: the regions as a list of toggles. Same interface as Body3D. */
export function RegionList({ markers, defaultIntensity = () => 5, onChange = () => {}, onAdd = () => {} }) {
  const root = h('div', { class: 'chips wrap center region-list' });
  const render = () => root.replaceChildren(...REGIONS.map(r => {
    const on = markers.some(m => m.regionId === r.regionId);
    return h('button', {
      type: 'button', class: `chip${on ? ' on' : ''}`, 'aria-pressed': String(on),
      onclick: () => {
        const i = markers.findIndex(m => m.regionId === r.regionId);
        if (i >= 0) markers.splice(i, 1);
        else markers.push({ regionId: r.regionId, side: r.side, intensity: defaultIntensity(), quality: 'ache', modelPoint: null });
        render();
        onChange(markers);
        if (i < 0) onAdd(r.regionId);
      },
    }, r.displayName);
  }));
  root.setMarkers = arr => { markers.splice(0, markers.length, ...arr.map(m => ({ ...m }))); render(); onChange(markers); };
  render();
  return root;
}
