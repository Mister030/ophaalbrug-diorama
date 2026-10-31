import * as THREE from 'three';
import { SLAB, CANAL, BRIDGE, STREET } from '../config.js';
import { box, cyl, sph, ico, tor, rod, extrude, group } from './util.js';
import { contactShadow } from './detail.js';

const { hx, hz, thick } = SLAB;
const FACADE_Z = STREET.walkFar; // -5.0, house fronts

// ---------------------------------------------------------------- ground ----

function ground(scene, M) {
  // Back block (houses side) and front block, each a full-depth slab piece so
  // the canal is a real cut with walls, not a decal.
  const backD = CANAL.zBack + hz;
  box(scene, hx * 2, thick, backD, M.stoneLight, 0, -thick / 2, -hz + backD / 2, { cast: false });
  const frontD = hz - CANAL.zFront;
  box(scene, hx * 2, thick, frontD, M.stoneLight, 0, -thick / 2, CANAL.zFront + frontD / 2, { cast: false });
  // Canal bed under the water, and the cut faces of the water at both slab ends.
  const cw = CANAL.zFront - CANAL.zBack;
  box(scene, hx * 2, thick + CANAL.floorY + 0.02, cw, M.soot, 0, (-thick + CANAL.floorY) / 2, (CANAL.zBack + CANAL.zFront) / 2, { cast: false });
  const waterCut = new THREE.MeshStandardMaterial({ color: 0x3d5a53, roughness: 0.6 });
  for (const s of [-1, 1]) {
    box(scene, 0.02, CANAL.waterY - CANAL.floorY, cw - 0.02, waterCut, s * (hx - 0.01), (CANAL.waterY + CANAL.floorY) / 2, (CANAL.zBack + CANAL.zFront) / 2, { cast: false });
  }

  // Back quay surfaces: kerbed edge strip, cobbled street, pavers, house strip.
  const top = 0.005;
  box(scene, hx * 2, 0.02, 0.4, M.kerb, 0, top, CANAL.zBack - 0.2, { cast: false });
  box(scene, hx * 2, 0.02, STREET.zNear - STREET.zFar, M.cobble, 0, top, (STREET.zNear + STREET.zFar) / 2, { cast: false });
  box(scene, hx * 2, 0.02, CANAL.zBack - 0.4 - STREET.zNear, M.stone, 0, top, (CANAL.zBack - 0.4 + STREET.zNear) / 2, { cast: false });
  box(scene, hx * 2, 0.02, STREET.zFar - FACADE_Z, M.stoneLight, 0, top, (STREET.zFar + FACADE_Z) / 2, { cast: false });
  box(scene, hx * 2, 0.06, 0.16, M.kerb, 0, 0.03, STREET.zFar, { cast: false });
  // Paver joints and street setts: wide enough to survive the snap (>= 0.085 m).
  for (let x = -hx + 1.3; x < hx; x += 2.6) {
    box(scene, 0.09, 0.012, STREET.zFar - FACADE_Z - 0.1, M.sand, x, 0.022, (STREET.zFar + FACADE_Z) / 2, { cast: false });
  }
  for (let x = -hx + 0.9; x < hx; x += 1.8) {
    box(scene, 0.09, 0.012, STREET.zNear - STREET.zFar, M.asphalt, x, 0.019, (STREET.zNear + STREET.zFar) / 2, { cast: false });
  }

  // Front quay: coping, pavement, red bike path along X.
  box(scene, hx * 2, 0.02, 0.35, M.kerb, 0, top, CANAL.zFront + 0.175, { cast: false });
  box(scene, hx * 2, 0.02, hz - CANAL.zFront - 0.35, M.stoneLight, 0, top, (CANAL.zFront + 0.35 + hz) / 2, { cast: false });
  box(scene, hx * 2, 0.024, 1.1, M.brick2, 0, 0.008, 6.65, { cast: false });
  box(scene, hx * 2, 0.026, 0.09, M.white, 0, 0.01, 6.1, { cast: false });
  box(scene, hx * 2, 0.026, 0.09, M.white, 0, 0.01, 7.2, { cast: false });
  for (let x = -hx + 1.3; x < hx; x += 2.6) {
    box(scene, 0.09, 0.012, 0.7, M.sand, x, 0.022, 5.7, { cast: false });
  }

  // Quay walls: brick faces down to the bed, with a stone coping lip.
  for (const [z, s] of [
    [CANAL.zBack, 1],
    [CANAL.zFront, -1],
  ]) {
    box(scene, hx * 2, -CANAL.floorY, 0.16, M.quayBrick, 0, CANAL.floorY / 2, z + s * 0.08, { cast: false });
    box(scene, hx * 2, 0.1, 0.24, M.stone, 0, -0.04, z + s * 0.1, { cast: false });
    // wet line + moss band just above the water
    box(scene, hx * 2, 0.12, 0.02, M.leaf3, 0, CANAL.waterY + 0.08, z + s * 0.17, { cast: false });
  }
}

// ----------------------------------------------------------------- water ----

function water(scene) {
  const w = hx * 2;
  const d = CANAL.zFront - CANAL.zBack;
  const geo = new THREE.PlaneGeometry(w, d, 24, 6);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const cols = new Float32Array(pos.count * 3);
  const mid = new THREE.Color(0x5d7d70);
  const edge = new THREE.Color(0x3d5a53);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const k = Math.abs(pos.getZ(i)) / (d / 2);
    c.copy(mid).lerp(edge, Math.pow(k, 2.2) * 0.8);
    cols.set([c.r, c.g, c.b], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  const mat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    vertexColors: true,
    roughness: 0.2,
    clearcoat: 0.6,
    clearcoatRoughness: 0.15,
    envMapIntensity: 0.5,
    transparent: true,
    opacity: 0.86,
    depthWrite: false,
  });
  const m = new THREE.Mesh(geo, mat);
  m.position.set(0, CANAL.waterY, (CANAL.zBack + CANAL.zFront) / 2);
  m.receiveShadow = true;
  m.renderOrder = 4;
  scene.add(m);
  return m;
}

// ---------------------------------------------------------------- houses ----

function windowUnit(p, M, x, y, w, h, opts = {}) {
  const z = FACADE_Z;
  const frame = opts.frame ?? M.white;
  const fw = 0.08;
  box(p, w, h, 0.02, opts.glass ?? M.glass, x, y, z + 0.012, { cast: false });
  // streak reflection, two diagonals' worth of light glass
  box(p, w * 0.22, h * 0.9, 0.012, M.glassLight, x - w * 0.18, y + 0.02, z + 0.026, { cast: false, rot: [0, 0, 0.18] });
  box(p, w + fw, fw, 0.07, frame, x, y + h / 2, z + 0.035);
  box(p, w + fw, fw, 0.07, frame, x, y - h / 2, z + 0.035);
  box(p, fw, h, 0.07, frame, x - w / 2, y, z + 0.035);
  box(p, fw, h, 0.07, frame, x + w / 2, y, z + 0.035);
  box(p, w, 0.06, 0.05, frame, x, y + h * 0.1, z + 0.03); // transom bar
  box(p, 0.05, h * 0.6, 0.05, frame, x, y - h * 0.2, z + 0.03); // mullion, lower sash
  box(p, w + 0.2, 0.07, 0.16, M.stone, x, y - h / 2 - 0.06, z + 0.07); // sill
  if (opts.lintel !== false) box(p, w + 0.22, 0.12, 0.05, opts.lintel ?? M.brickLight, x, y + h / 2 + 0.1, z + 0.02);
  if (opts.shutters) {
    for (const s of [-1, 1]) box(p, w * 0.45, h * 0.62, 0.04, opts.shutters, x + s * (w / 2 + w * 0.25 + 0.06), y - h * 0.18, z + 0.03);
  }
}

function hoistBeam(p, M, x, y) {
  box(p, 0.14, 0.14, 0.95, M.wood4, x, y, FACADE_Z + 0.45);
  box(p, 0.2, 0.22, 0.08, M.wood4, x, y + 0.02, FACADE_Z + 0.04);
  tor(p, 0.06, 0.018, M.steelDark, x, y - 0.14, FACADE_Z + 0.86, { seg: 10 });
  rod(p, [x, y - 0.2, FACADE_Z + 0.86], [x + 0.02, y - 1.1, FACADE_Z + 0.88], 0.022, M.wood2);
}

function roof(p, M, x0, w, yBase, rh) {
  // Ridge runs back along -Z, as on a canal house: a prism behind the gable.
  const g = extrude(p, [[-w / 2, 0], [w / 2, 0], [0, rh]], 2.75, M.slate, x0 + w / 2, yBase, -6.65, { cast: true });
  box(p, 0.1, 0.08, 2.8, M.slateDark, x0 + w / 2, yBase + rh, -6.65);
  // one chimney on the slope
  box(p, 0.42, 1.0, 0.42, M.brick4, x0 + w * 0.7, yBase + rh * 0.55, -7.2);
  box(p, 0.5, 0.08, 0.5, M.stone, x0 + w * 0.7, yBase + rh * 0.55 + 0.52, -7.2);
  return g;
}

function gableStep(p, M, x0, w, y, mat) {
  const steps = 4;
  const sh = 0.55;
  let top = y;
  for (let i = 0; i < steps; i++) {
    const ww = w * (1 - i * 0.22);
    box(p, ww, sh, 0.32, mat, x0 + w / 2, y + i * sh + sh / 2, FACADE_Z - 0.16);
    box(p, ww + 0.08, 0.07, 0.4, M.stoneLight, x0 + w / 2, y + (i + 1) * sh, FACADE_Z - 0.15);
    top = y + (i + 1) * sh;
  }
  box(p, w * 0.22, 0.35, 0.32, mat, x0 + w / 2, top + 0.17, FACADE_Z - 0.16);
  sph(p, 0.12, M.stoneLight, x0 + w / 2, top + 0.45, FACADE_Z - 0.1);
  windowUnit(p, M, x0 + w / 2, y + 0.95, 0.5, 0.75, { lintel: false });
  hoistBeam(p, M, x0 + w / 2, top - 0.25);
  return { top, rh: steps * sh };
}

function gableNeck(p, M, x0, w, y, mat) {
  const nw = w * 0.42;
  const nh = 2.1;
  const cx = x0 + w / 2;
  box(p, nw, nh, 0.32, mat, cx, y + nh / 2, FACADE_Z - 0.16);
  // sandstone shoulder scrolls: quarter drums standing on the cornice
  for (const s of [-1, 1]) {
    const r = (w - nw) / 2;
    cyl(p, r, r, 0.3, M.stoneLight, cx + s * (nw / 2), y, FACADE_Z - 0.15, {
      rot: [Math.PI / 2, 0, 0],
      t0: s < 0 ? Math.PI : Math.PI / 2,
      tl: Math.PI / 2,
      seg: 10,
    });
    sph(p, 0.09, M.stoneLight, cx + s * (w / 2 - 0.12), y + 0.08, FACADE_Z + 0.02);
  }
  // crown: half-round pediment
  cyl(p, nw / 2 + 0.06, nw / 2 + 0.06, 0.34, M.stoneLight, cx, y + nh, FACADE_Z - 0.15, { rot: [Math.PI / 2, 0, 0], t0: -Math.PI / 2, tl: Math.PI, seg: 14 });
  box(p, nw + 0.16, 0.1, 0.42, M.stoneLight, cx, y + nh, FACADE_Z - 0.14);
  windowUnit(p, M, cx, y + 0.95, 0.5, 0.85, { lintel: false });
  hoistBeam(p, M, cx, y + nh - 0.32);
  return { top: y + nh + nw / 2, rh: nh };
}

function gableBell(p, M, x0, w, y, mat) {
  const h = 2.3;
  const pts = [];
  const n = 14;
  for (let i = 0; i <= n; i++) {
    const u = i / n; // 0 left foot .. 1 apex
    const xx = -w / 2 + (w / 2) * (1 - Math.pow(1 - u, 2.2)) * 0.82;
    const yy = h * Math.sin((u * Math.PI) / 2) * (0.62 + 0.38 * u);
    pts.push([xx, yy]);
  }
  const right = pts.slice(0, -1).reverse().map(([a, b]) => [-a, b]);
  extrude(p, [...pts, ...right], 0.3, mat, x0 + w / 2, y, FACADE_Z - 0.15);
  // stone trim follows the outline
  const trim = [...pts, ...right];
  for (let i = 0; i < trim.length - 1; i += 2) {
    const a = trim[i];
    const b = trim[i + 1];
    rod(p, [x0 + w / 2 + a[0], y + a[1], FACADE_Z + 0.01], [x0 + w / 2 + b[0], y + b[1], FACADE_Z + 0.01], 0.05, M.stoneLight, { cast: false });
  }
  sph(p, 0.14, M.stoneLight, x0 + w / 2, y + h + 0.1, FACADE_Z - 0.05);
  windowUnit(p, M, x0 + w / 2, y + 0.9, 0.55, 0.8, { lintel: false });
  hoistBeam(p, M, x0 + w / 2, y + h - 0.45);
  return { top: y + h, rh: h - 0.2 };
}

function gableCornice(p, M, x0, w, y) {
  // Lijstgevel: flat top with a heavy white cornice and a dormer for the hoist.
  box(p, w + 0.1, 0.28, 0.5, M.white, x0 + w / 2, y + 0.14, FACADE_Z + 0.04);
  box(p, w + 0.2, 0.08, 0.6, M.white, x0 + w / 2, y + 0.32, FACADE_Z + 0.06);
  for (let x = x0 + 0.2; x < x0 + w - 0.1; x += 0.3) box(p, 0.1, 0.1, 0.08, M.cream, x, y - 0.03, FACADE_Z + 0.03);
  const cx = x0 + w / 2;
  box(p, 1.1, 1.2, 0.8, M.white, cx, y + 0.95, FACADE_Z - 0.55);
  extrude(p, [[-0.68, 0], [0.68, 0], [0, 0.55]], 0.9, M.slateDark, cx, y + 1.55, FACADE_Z - 0.5);
  windowUnit({ add: (m) => { m.position.z -= 0.15; p.add(m); } }, M, cx, y + 0.95, 0.55, 0.7, { lintel: false });
  hoistBeam(p, M, cx, y + 1.42);
  return { top: y + 2.1, rh: 2.0 };
}

function house(scene, M, spec) {
  const { x0, w, h, gable, mat } = spec;
  const g = group(scene, 0, 0, 0, `house-${spec.id}`);
  const cx = x0 + w / 2;
  const depth = hz + FACADE_Z; // 3.0
  box(g, w - 0.02, h, depth, mat, cx, h / 2, FACADE_Z - depth / 2);
  // plinth, floor bands
  box(g, w, 0.45, 0.08, M.stone, cx, 0.225, FACADE_Z + 0.04);
  const floors = [3.0, 5.5, 8.0].filter((f) => f < h - 0.4);
  for (const f of floors) box(g, w, 0.09, 0.06, spec.band ?? M.stoneLight, cx, f, FACADE_Z + 0.03);
  // party-wall pilasters keep neighbours from merging into one block
  for (const s of [-1, 1]) box(g, 0.12, h, 0.05, spec.pilaster ?? M.brickDark, cx + s * (w / 2 - 0.06), h / 2, FACADE_Z + 0.025);

  // upper windows
  const cols = spec.cols ?? (w > 4 ? 3 : 2);
  const ww = cols === 3 ? 0.78 : 0.85;
  for (let fi = 0; fi < floors.length; fi++) {
    const y0 = floors[fi] + 1.15;
    if (y0 + 0.9 > h) continue;
    for (let c = 0; c < cols; c++) {
      const x = x0 + (w * (c + 0.5)) / cols;
      windowUnit(g, M, x, y0, ww, 1.45, { frame: spec.frame, shutters: spec.shutters && fi === 0 ? spec.shutters : null });
    }
  }

  // ground floor: door with stoop + one or two windows (shopfront for the café)
  if (spec.cafe) cafeFront(g, M, x0, w);
  else {
    const dx = x0 + w * (spec.doorLeft ? 0.28 : 0.72);
    const door = spec.door ?? M.leaf3;
    box(g, 1.0, 2.2, 0.1, M.white, dx, 1.55, FACADE_Z + 0.05);
    box(g, 0.82, 1.75, 0.06, door, dx, 1.33, FACADE_Z + 0.09);
    box(g, 0.82, 0.32, 0.03, M.glass, dx, 2.42, FACADE_Z + 0.1);
    box(g, 0.06, 0.06, 0.05, M.yellow, dx + 0.28, 1.3, FACADE_Z + 0.13); // brass knob
    box(g, 1.2, 0.17, 0.5, M.stone, dx, 0.085, FACADE_Z + 0.25); // stoop
    box(g, 1.2, 0.17, 0.3, M.stone, dx, 0.255, FACADE_Z + 0.15);
    const wx = x0 + w * (spec.doorLeft ? 0.7 : 0.3);
    windowUnit(g, M, wx, 1.75, w > 4 ? 1.5 : 1.1, 1.6, { frame: spec.frame });
    // geveltuin: a bench-planter with geraniums by the door
    box(g, 0.9, 0.35, 0.3, M.wood3, wx, 0.175, FACADE_Z + 0.2);
    for (let i = 0; i < 4; i++) ico(g, 0.13, i % 2 ? M.red : M.leaf2, wx - 0.33 + i * 0.22, 0.42, FACADE_Z + 0.2, { detail: 0 });
  }

  const yTop = h;
  let res;
  if (gable === 'step') res = gableStep(g, M, x0, w, yTop, mat);
  else if (gable === 'neck') res = gableNeck(g, M, x0, w, yTop, mat);
  else if (gable === 'bell') res = gableBell(g, M, x0, w, yTop, mat);
  else res = gableCornice(g, M, x0, w, yTop);
  roof(g, M, x0, w, yTop - 0.05, Math.min(res.rh + 0.2, 2.4));
  // cornice band under the gable
  if (gable !== 'cornice') box(g, w + 0.06, 0.16, 0.14, M.stoneLight, cx, yTop, FACADE_Z + 0.05);
  return g;
}

function cafeFront(g, M, x0, w) {
  const z = FACADE_Z;
  const frame = M.leaf3;
  const cx = x0 + w / 2;
  // glazed shopfront: warm interior behind dark glass
  box(g, w - 0.4, 2.3, 0.04, M.wood3, cx, 1.65, z - 0.25, { cast: false }); // back wall glow
  box(g, w - 0.4, 0.06, 0.04, M.yellow, cx, 2.55, z - 0.2, { cast: false });
  box(g, w - 0.3, 2.4, 0.02, M.glass, cx, 1.65, z + 0.01, { cast: false });
  for (const xx of [x0 + 0.15, x0 + w * 0.36, x0 + w * 0.64, x0 + w - 0.15]) box(g, 0.12, 2.5, 0.1, frame, xx, 1.65, z + 0.05);
  box(g, w, 0.14, 0.12, frame, cx, 2.9, z + 0.06);
  box(g, w, 0.5, 0.12, frame, cx, 0.25, z + 0.06);
  // door (opened by the waiter; pivot at the jamb)
  const door = group(g, cx - 0.5, 0, z + 0.06, 'cafeDoor');
  box(door, 1.0, 2.25, 0.06, frame, 0.5, 1.13, 0);
  box(door, 0.7, 1.4, 0.03, M.glass, 0.5, 1.35, 0.03, { cast: false });
  box(door, 0.06, 0.4, 0.06, M.yellow, 0.88, 1.15, 0.05);
  // sign board with gilt letter blocks
  box(g, w * 0.7, 0.42, 0.08, M.leaf3, cx, 3.3, z + 0.05);
  for (let i = 0; i < 4; i++) {
    const lx = cx - 0.6 + i * 0.4;
    box(g, 0.24, 0.24, 0.03, M.yellow, lx, 3.3, z + 0.1);
    box(g, 0.14, 0.12, 0.035, M.leaf3, lx + (i === 1 ? 0 : 0.05), 3.3 + (i === 2 ? 0.04 : 0), z + 0.11);
  }
  // striped awning on two iron arms
  const aw = group(g, cx, 2.95, z + 0.05, 'awning');
  const stripes = 9;
  for (let i = 0; i < stripes; i++) {
    const sw = (w - 0.3) / stripes;
    box(aw, sw, 0.04, 1.35, i % 2 ? M.white : M.red, -(w - 0.3) / 2 + sw * (i + 0.5), -0.3, 0.62, { rot: [0.45, 0, 0] });
    box(aw, sw, 0.22, 0.03, i % 2 ? M.white : M.red, -(w - 0.3) / 2 + sw * (i + 0.5), -0.68, 1.25);
  }
  for (const s of [-1, 1]) rod(aw, [s * (w / 2 - 0.25), 0, 0.02], [s * (w / 2 - 0.25), -0.6, 1.23], 0.025, M.steelDark);
  // wall lamps
  for (const s of [-1, 1]) {
    box(g, 0.08, 0.3, 0.12, M.steelDark, cx + s * (w / 2 - 0.25), 3.3, z + 0.06);
    box(g, 0.16, 0.22, 0.16, M.lampOn, cx + s * (w / 2 - 0.25), 3.35, z + 0.2);
  }
}

// ----------------------------------------------------------------- trees ----

function tree(scene, M, x, z, s = 1, seed = 0) {
  const g = group(scene, x, 0, z, 'tree');
  cyl(g, 0.12 * s, 0.2 * s, 3.2 * s, M.bark, 0, 1.6 * s, 0);
  rod(g, [0, 2.4 * s, 0], [0.7 * s, 3.6 * s, 0.25 * s], 0.08 * s, M.bark);
  rod(g, [0, 2.6 * s, 0], [-0.6 * s, 3.8 * s, -0.3 * s], 0.08 * s, M.bark);
  // tree grate + kerb
  box(g, 0.9, 0.04, 0.9, M.steelDark, 0, 0.02, 0, { cast: false });
  const crown = group(g, 0, 3.0 * s, 0, 'crown');
  const blobs = [
    [0, 1.3, 0, 1.25],
    [0.85, 1.0, 0.3, 0.95],
    [-0.8, 1.05, -0.2, 1.0],
    [0.3, 0.7, -0.75, 0.9],
    [-0.3, 0.75, 0.8, 0.9],
    [0.2, 1.95, 0.15, 0.8],
    [-0.55, 1.7, 0.4, 0.7],
  ];
  blobs.forEach(([bx, by, bz, r], i) => {
    const mat = [M.leaf1, M.leaf2, M.leaf3, M.leafLight][(i + seed) % 4];
    ico(crown, r * s, mat, bx * s, by * s, bz * s, { detail: 1 });
  });
  contactShadow(g, 0, 0, 0, 3.4 * s, 0.25);
  g.userData.crown = crown;
  g.userData.seed = seed;
  return g;
}

// ----------------------------------------------------------------- props ----

/** Amsterdammertje: the cast-iron bollard with three St Andrew's crosses. */
function bollard(p, M, x, z) {
  cyl(p, 0.07, 0.085, 0.78, M.brickDark, x, 0.39, z, { seg: 10 });
  sph(p, 0.075, M.brickDark, x, 0.8, z, { seg: 8 });
  for (let i = 0; i < 3; i++) {
    box(p, 0.12, 0.022, 0.015, M.white, x, 0.38 + i * 0.12, z + 0.075, { rot: [0, 0, 0.7], cast: false });
    box(p, 0.12, 0.022, 0.015, M.white, x, 0.38 + i * 0.12, z + 0.075, { rot: [0, 0, -0.7], cast: false });
  }
}

function lantern(p, M, x, z) {
  const g = group(p, x, 0, z, 'lantern');
  cyl(g, 0.16, 0.2, 0.5, M.steelDark, 0, 0.25, 0);
  cyl(g, 0.06, 0.09, 3.0, M.steelDark, 0, 1.9, 0);
  tor(g, 0.1, 0.025, M.steelDark, 0, 1.2, 0, { rot: [Math.PI / 2, 0, 0] });
  cyl(g, 0.22, 0.12, 0.5, M.glassPale, 0, 3.65, 0, { seg: 6 });
  cyl(g, 0.06, 0.06, 0.32, M.lampOn, 0, 3.62, 0, { seg: 6 });
  cyl(g, 0.02, 0.3, 0.2, M.steelDark, 0, 4.0, 0, { seg: 6 });
  sph(g, 0.05, M.steelDark, 0, 4.15, 0, { seg: 6 });
  contactShadow(g, 0, 0, 0, 0.8, 0.5);
}

function bench(p, M, x, z, yaw) {
  const g = group(p, x, 0, z, 'bench');
  g.rotation.y = yaw;
  for (const s of [-1, 1]) {
    box(g, 0.08, 0.42, 0.5, M.steelDark, s * 0.8, 0.21, 0);
    box(g, 0.08, 0.5, 0.08, M.steelDark, s * 0.8, 0.65, -0.24, { rot: [-0.18, 0, 0] });
  }
  for (let i = 0; i < 3; i++) box(g, 1.8, 0.05, 0.14, M.wood2, 0, 0.44, -0.16 + i * 0.16);
  for (let i = 0; i < 2; i++) box(g, 1.8, 0.12, 0.04, M.wood2, 0, 0.62 + i * 0.17, -0.27, { rot: [-0.18, 0, 0] });
  // story: a forgotten paper bag of fries on the seat
  box(g, 0.14, 0.18, 0.1, M.white, 0.45, 0.56, 0.05);
  box(g, 0.1, 0.08, 0.06, M.yellow, 0.45, 0.68, 0.05);
  contactShadow(g, 0, 0, 0, 2.2, 0.45);
}

function planter(p, M, x, z) {
  box(p, 0.7, 0.45, 0.7, M.wood4, x, 0.225, z);
  box(p, 0.76, 0.06, 0.76, M.wood5, x, 0.46, z);
  ico(p, 0.32, M.leaf2, x, 0.68, z, { detail: 0 });
  for (let i = 0; i < 5; i++) ico(p, 0.09, M.pink, x - 0.2 + (i % 3) * 0.2, 0.86 + (i > 2 ? 0.05 : 0), z - 0.12 + Math.floor(i / 3) * 0.24, { detail: 0 });
}

/** A small open sloop moored at the front quay; it bobs. */
function sloop(scene, M) {
  const g = group(scene, -7.6, CANAL.waterY, 4.3, 'sloop');
  const len = 3.6;
  const half = [
    [-len / 2, 0.55],
    [-len / 2 + 0.25, 0.65],
    [len / 2 - 0.9, 0.65],
    [len / 2 - 0.3, 0.45],
    [len / 2, 0.0],
  ];
  const outline = [...half, ...half.slice(0, -1).reverse().map(([a, b]) => [a, -b])];
  // hull: outer shell extruded downward, open top read via a darker floor inset
  const hull = extrude(g, outline.map(([a, b]) => [a, b * 0.9]), 0.42, M.blue, 0, 0.05, 0, { rot: [Math.PI / 2, 0, 0], bevel: 0.04 });
  hull.position.y = 0.1;
  box(g, len - 1.0, 0.04, 0.9, M.wood2, -0.25, 0.22, 0, { cast: false });
  box(g, len - 0.6, 0.06, 0.05, M.wood3, -0.1, 0.33, 0.56);
  box(g, len - 0.6, 0.06, 0.05, M.wood3, -0.1, 0.33, -0.56);
  for (const xx of [-0.9, 0.2]) box(g, 0.25, 0.06, 1.05, M.wood3, xx, 0.3, 0);
  // story: a cooler box and an outboard motor
  box(g, 0.4, 0.28, 0.3, M.white, -0.35, 0.38, 0.2);
  box(g, 0.42, 0.06, 0.32, M.blue, -0.35, 0.54, 0.2);
  box(g, 0.22, 0.38, 0.22, M.ink, -len / 2 - 0.1, 0.42, 0);
  box(g, 0.06, 0.45, 0.06, M.ink, -len / 2 - 0.12, 0.05, 0);
  // mooring lines to the bollards
  rod(scene, [-9.8, 0.6, 5.15], [-9.3, CANAL.waterY + 0.4, 4.4], 0.025, M.cream);
  rod(scene, [-5.6, 0.6, 5.15], [-5.9, CANAL.waterY + 0.4, 4.4], 0.025, M.cream);
  return g;
}

function ducks(scene, M) {
  const list = [];
  for (let i = 0; i < 2; i++) {
    const g = group(scene, 0, CANAL.waterY, 0, `duck-${i}`);
    const male = i === 0;
    sph(g, 0.16, male ? M.stone : M.wood3, 0, 0.08, 0, { scale: [0.8, 0.62, 1.25] });
    sph(g, 0.08, male ? M.leaf3 : M.wood4, 0, 0.24, 0.14);
    box(g, 0.05, 0.03, 0.09, M.orange, 0, 0.22, 0.24);
    box(g, 0.08, 0.06, 0.08, male ? M.ink : M.wood4, 0, 0.14, -0.2, { rot: [0.5, 0, 0] });
    if (male) box(g, 0.16, 0.02, 0.02, M.white, 0, 0.19, 0.14);
    list.push(g);
  }
  return list;
}

// ---------------------------------------------------------------- export ----

export const HOUSES = [
  { id: 0, x0: -12.0, w: 4.2, h: 7.9, gable: 'step', mat: 'brick3', frame: 'white', shutters: 'leaf3' },
  { id: 1, x0: -7.8, w: 4.6, h: 7.3, gable: 'neck', mat: 'brick2', cafe: true },
  { id: 2, x0: -3.2, w: 3.6, h: 8.5, gable: 'bell', mat: 'brick4', doorLeft: true, door: 'navy' },
  { id: 3, x0: 0.4, w: 4.0, h: 7.6, gable: 'cornice', mat: 'plaster', band: 'stone', pilaster: 'sand', door: 'ink' },
  { id: 4, x0: 4.4, w: 3.4, h: 8.1, gable: 'step', mat: 'brick1', door: 'redDark' },
  { id: 5, x0: 7.8, w: 4.2, h: 7.0, gable: 'neck', mat: 'brickDark', doorLeft: true, door: 'leaf3', shutters: 'red' },
];

export function buildSet(scene, M) {
  ground(scene, M);
  const waterMesh = water(scene);

  for (const spec of HOUSES) {
    const s = { ...spec, mat: M[spec.mat], frame: M[spec.frame ?? 'white'], door: spec.door ? M[spec.door] : undefined };
    if (spec.shutters) s.shutters = M[spec.shutters];
    if (spec.band) s.band = M[spec.band];
    if (spec.pilaster) s.pilaster = M[spec.pilaster];
    house(scene, M, s);
  }

  const trees = [tree(scene, M, -10.0, 7.55, 1.15, 0), tree(scene, M, 9.6, 7.55, 1.0, 2), tree(scene, M, -9.4, -1.0, 0.9, 1), tree(scene, M, 6.2, -1.0, 0.85, 3)];

  // Amsterdammertjes along both quays, leaving the bridge heads clear.
  const clear = (x) => x > BRIDGE.x0 - 1.2 && x < BRIDGE.x1 + 1.6;
  for (let x = -11.2; x < 11.8; x += 1.4) {
    if (!clear(x) && (x < -3.1 || x > -1.3)) bollard(scene, M, x, 5.15);
    if (!clear(x) && Math.abs(x + 9.4) > 0.6 && Math.abs(x - 6.2) > 0.6) bollard(scene, M, x, -0.85);
  }
  lantern(scene, M, -3.9, 5.6);
  lantern(scene, M, -2.2, -0.85);
  lantern(scene, M, 10.6, -0.85);
  bench(scene, M, -6.4, 7.6, Math.PI);
  planter(scene, M, -0.2, 7.6);
  planter(scene, M, -10.4, -4.3);

  const boat = sloop(scene, M);
  const duckList = ducks(scene, M);
  return { water: waterMesh, trees, sloop: boat, ducks: duckList };
}
