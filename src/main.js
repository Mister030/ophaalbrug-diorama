import * as THREE from 'three';
import { PixelPost } from './core/post.js';
import { createMaterials, timeUniform } from './core/materials.js';
import { createCamera, updateCamera } from './scene/camera.js';
import { createLighting } from './scene/lighting.js';
import { buildSet } from './scene/set.js';
import { buildBridge, setLampMaterials } from './scene/bridge.js';
import { buildBoat } from './scene/boat.js';
import { buildWake } from './scene/effects.js';
import { buildTerrace } from './scene/terrace.js';
import { createStage } from './scene/stage.js';
import { SLAB, LOOP } from './config.js';

/**
 * De Ophaalbrug: an Amsterdam canal on a Saturday afternoon. A bascule bridge
 * opens for a sailing barge, one cyclist is a second too late, the queue
 * waits, the terrace watches, and after 40 seconds it all comes round again.
 * Everything is a pure function of t; ?t=12.7 freezes the frame.
 */
const canvas = document.getElementById('stage');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: true });
renderer.setPixelRatio(1);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
renderer.toneMapping = THREE.NoToneMapping;
renderer.localClippingEnabled = false;

const scene = new THREE.Scene();
scene.background = null;
const camera = createCamera();
const post = new PixelPost(renderer, 2000, 1.0);

const { hx, hz } = SLAB;
const CLIP = [
  new THREE.Plane(new THREE.Vector3(1, 0, 0), hx + 0.05),
  new THREE.Plane(new THREE.Vector3(-1, 0, 0), hx + 0.05),
  new THREE.Plane(new THREE.Vector3(0, 0, 1), hz + 0.05),
  new THREE.Plane(new THREE.Vector3(0, 0, -1), hz + 0.05),
];

createLighting(renderer, scene);
const M = createMaterials();
setLampMaterials(M.redLamp, M.redLampOff);

const set = buildSet(scene, M);
const bridge = buildBridge(scene, M);
const boat = buildBoat(scene, M);
const wake = buildWake(scene);
const terrace = buildTerrace(scene, M);
const stage = createStage(scene, M, { set, bridge, boat, wake, terrace });

function draw(T) {
  const t = ((T % LOOP) + LOOP) % LOOP;
  timeUniform.value = t;
  stage.update(t);
  post.render(scene, camera, CLIP);
}

function resize() {
  const rect = canvas.getBoundingClientRect();
  if (rect.width < 2 || rect.height < 2) return;
  updateCamera(camera, Math.max(0.3, rect.width / rect.height));
  post.setSize(rect.width, rect.height);
}
resize();
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 250));

const params = new URLSearchParams(location.search);
let frozen = params.has('t') ? parseFloat(params.get('t')) : null;
const startAt = params.has('from') ? parseFloat(params.get('from')) : 0;
if (params.has('dither')) post.uniforms.uDither.value = parseFloat(params.get('dither'));
let origin = performance.now() - startAt * 1000;

function tick(now) {
  if (frozen == null) draw((now - origin) / 1000);
  requestAnimationFrame(tick);
}

draw(frozen ?? startAt);
resize();
draw(frozen ?? startAt);
requestAnimationFrame(tick);

window.__diorama = {
  THREE,
  scene,
  camera,
  renderer,
  post,
  CLIP,
  LOOP,
  mats: M,
  bridge,
  boat,
  wake,
  set,
  cast: stage.cast,
  props: stage.props,
  sched: stage.sched,
  stops: stage.stops,
  freeze(t) {
    frozen = t;
    draw(t);
  },
  play() {
    origin = performance.now() - (frozen ?? 0) * 1000;
    frozen = null;
  },
  view(pos, target) {
    if (!pos) {
      resize();
      return;
    }
    camera.position.set(pos[0], pos[1], pos[2]);
    camera.lookAt(target[0], target[1], target[2]);
    camera.updateProjectionMatrix();
  },
};
// Audit contract for qa/audit.mjs: who moves, and where the paper starts.
window.__diorama.audit = {
  loop: LOOP,
  slab: { x0: -SLAB.hx, x1: SLAB.hx, z0: -SLAB.hz, z1: SLAB.hz, margin: 0.35 },
  movers: [
    { name: 'tjalk', group: boat.root, required: true, allowSpawn: true },
    ...Object.values(stage.cast.riders).map((r) => ({ name: `bike-${r.id}`, group: r.bike.group, required: false, allowSpawn: true })),
    { name: 'walker', group: stage.cast.walker.group, required: false, allowSpawn: true },
    { name: 'waiter', group: stage.cast.waiter.group, required: false, allowSpawn: true },
  ],
  emitters: [],
};
window.__dioramaReady = true;
