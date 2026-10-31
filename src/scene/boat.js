import * as THREE from 'three';
import { box, cyl, sph, tor, rod, extrude, group } from './util.js';
import { buildBike } from './bike.js';

/**
 * A tjalk: round-ended Dutch sailing barge, mast forward, leeboards, the big
 * barn-door rudder and a varnished stern cabin. Built facing +X with the
 * waterline at y 0. The mast is why the bridge has to open.
 */
export const BOAT = { len: 9.0, beam: 2.4, mastX: 2.3, mastH: 7.6, deckY: 0.55 };

const HALF = [
  [-4.5, 0.5],
  [-4.35, 0.9],
  [-3.9, 1.13],
  [-3.0, 1.2],
  [2.4, 1.2],
  [3.3, 1.12],
  [3.95, 0.88],
  [4.35, 0.5],
  [4.5, 0.0],
];
const OUTLINE = [...HALF, ...HALF.slice(0, -1).reverse().map(([x, z]) => [x, -z])].map(([x, z]) => [x, z]);

function hull(g, M) {
  // extrude the plan outline upward: shape Y -> world -Z, depth -> world Y
  const shell = extrude(g, OUTLINE, 0.95, M.leaf3, 0, 0.17, 0, { rot: [-Math.PI / 2, 0, 0], bevel: 0.05 });
  // green sheer strake + varnished rubbing strake + red boot-top at the waterline
  const band = (scale, h, y, mat) => {
    const m = extrude(g, OUTLINE.map(([x, z]) => [x * scale, z * scale]), h, mat, 0, y, 0, { rot: [-Math.PI / 2, 0, 0] });
    m.castShadow = false;
    return m;
  };
  band(1.012, 0.14, 0.56, M.white);
  band(1.02, 0.06, 0.44, M.wood2);
  band(1.008, 0.05, 0.03, M.red);
  // deck and coaming
  const deck = extrude(g, OUTLINE.map(([x, z]) => [x * 0.95, z * 0.9]), 0.04, M.wood1, 0, BOAT.deckY + 0.08, 0, { rot: [-Math.PI / 2, 0, 0] });
  deck.castShadow = false;
  for (let x = -3.4; x < 4.0; x += 0.35) box(g, 0.025, 0.012, 1.9, M.wood3, x, BOAT.deckY + 0.105, 0, { cast: false });
  // the curved stem rising at the bow, and a small sternpost
  rod(g, [4.42, 0.4, 0], [4.62, 1.05, 0], 0.07, M.wood3);
  sph(g, 0.09, M.wood3, 4.63, 1.08, 0, { seg: 8 });
  rod(g, [-4.48, 0.4, 0], [-4.55, 0.95, 0], 0.06, M.wood3);
  return shell;
}

function leeboard(g, M, side) {
  const pivot = group(g, 0.4, 0.7, side * 1.25, 'leeboard');
  extrude(pivot, [[0, 0], [0.32, -0.1], [0.55, -1.25], [0.25, -1.65], [-0.25, -1.65], [-0.55, -1.25], [-0.32, -0.1]], 0.06, M.wood2, 0, 0, 0, { curve: 6 });
  box(pivot, 0.08, 1.6, 0.075, M.wood4, 0, -0.85, side * 0.01);
  cyl(pivot, 0.07, 0.07, 0.12, M.steelDark, 0, 0, 0, { rot: [Math.PI / 2, 0, 0], seg: 8 });
  // hauled up: blade swung aft and lifted so it rides clear of the water
  pivot.rotation.set(side * 0.08, 0, -1.25);
  return pivot;
}

function rigging(g, M) {
  const x = BOAT.mastX;
  const top = BOAT.deckY + BOAT.mastH;
  box(g, 0.3, 0.6, 0.3, M.leaf3, x, BOAT.deckY + 0.4, 0); // tabernacle
  cyl(g, 0.065, 0.1, BOAT.mastH, M.wood1, x, BOAT.deckY + BOAT.mastH / 2 + 0.1, 0, { seg: 10 });
  cyl(g, 0.07, 0.07, 0.5, M.white, x, top - 0.1, 0, { seg: 8 });
  // boom and gaff with the tan sail furled on them
  const boomY = BOAT.deckY + 1.55;
  rod(g, [x, boomY, 0], [x - 4.7, boomY + 0.2, 0], 0.05, M.wood3);
  for (let i = 0; i < 7; i++) {
    const u = i / 7;
    const r = 0.17 - Math.abs(u - 0.45) * 0.12;
    cyl(g, r, r, 0.66, i % 2 ? M.brick4 : M.brick3, x - 0.4 - u * 4.1, boomY + 0.2 + u * 0.18, 0, { rot: [0, 0, Math.PI / 2 - 0.04], seg: 8 });
    box(g, 0.05, r * 2 + 0.03, r * 2 + 0.03, M.cream, x - 0.75 - u * 4.1, boomY + 0.2 + u * 0.18, 0);
  }
  rod(g, [x, boomY + 0.45, 0], [x - 3.6, boomY + 0.65, 0], 0.04, M.wood3);
  // stays: forestay to the stem head, shrouds to the sides, topping lift
  rod(g, [x, top - 0.25, 0], [4.6, 1.05, 0], 0.022, M.ink, { cast: false });
  for (const s of [-1, 1]) rod(g, [x, top - 0.6, 0], [x - 0.4, BOAT.deckY + 0.2, s * 1.18], 0.02, M.ink, { cast: false });
  rod(g, [x, top - 0.1, 0], [x - 4.6, boomY + 0.3, 0], 0.016, M.ink, { cast: false });
  // masthead pennant (animated)
  const pennant = group(g, x, top + 0.05, 0, 'pennant');
  const segs = [];
  for (let i = 0; i < 4; i++) {
    const s = group(i === 0 ? pennant : segs[i - 1], i === 0 ? 0.04 : 0.28, 0, 0);
    box(s, 0.28, 0.16 - i * 0.03, 0.02, M.red, 0.14, -0.08, 0, { cast: false });
    segs.push(s);
  }
  return { pennant, segs };
}

function cabin(g, M) {
  // roef: varnished sides, white trim, round portholes, arched roof
  const x0 = -3.5;
  const x1 = -1.4;
  const cx = (x0 + x1) / 2;
  const L = x1 - x0;
  box(g, L, 0.72, 1.9, M.wood3, cx, BOAT.deckY + 0.46, 0);
  box(g, L + 0.06, 0.06, 1.96, M.white, cx, BOAT.deckY + 0.84, 0);
  // arched roof: a 2 m radius arc whose chord is the cabin width (sagitta 0.24)
  cyl(g, 2.0, 2.0, L + 0.08, M.wood1, cx, -0.39, 0, { rot: [0, 0, Math.PI / 2], t0: Math.PI / 2 - 0.5, tl: 1.0, seg: 12 });
  for (const s of [-1, 1]) {
    for (const px of [-3.0, -2.35, -1.8]) {
      tor(g, 0.11, 0.025, M.chrome, px, BOAT.deckY + 0.5, s * 0.96, { seg: 12 });
      cyl(g, 0.1, 0.1, 0.02, M.glass, px, BOAT.deckY + 0.5, s * 0.955, { rot: [Math.PI / 2, 0, 0], seg: 12 });
    }
  }
  // sliding hatch and doors aft
  box(g, 0.6, 0.1, 0.8, M.leaf3, x0 + 0.35, 1.66, 0);
  box(g, 0.05, 0.55, 0.7, M.leaf3, x0 - 0.01, BOAT.deckY + 0.42, 0);
  // story: geraniums on the roof and a life ring on the side
  for (let i = 0; i < 3; i++) {
    box(g, 0.32, 0.16, 0.2, M.brick1, -2.9 + i * 0.5, 1.63, 0.45);
    ico3(g, M, -2.9 + i * 0.5, 1.8, 0.45);
  }
  tor(g, 0.2, 0.05, M.white, -2.0, BOAT.deckY + 0.5, 0.99, { seg: 14 });
  for (let i = 0; i < 4; i++) box(g, 0.07, 0.11, 0.06, M.red, -2.0 + Math.cos((i * Math.PI) / 2) * 0.2, BOAT.deckY + 0.5 + Math.sin((i * Math.PI) / 2) * 0.2, 1.02);
}

function ico3(g, M, x, y, z) {
  const m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.12, 0), M.leaf2);
  m.position.set(x, y, z);
  m.castShadow = true;
  g.add(m);
  for (let i = 0; i < 3; i++) {
    const f = new THREE.Mesh(new THREE.IcosahedronGeometry(0.05, 0), M.red);
    f.position.set(x - 0.07 + i * 0.07, y + 0.1, z + (i % 2 ? 0.04 : -0.03));
    g.add(f);
  }
}

function steering(g, M) {
  // barn-door rudder hung on the sternpost, and a curved tiller
  const r = group(g, -4.55, 0, 0, 'rudder');
  extrude(r, [[0, 0.95], [-0.25, 0.9], [-0.95, 0.15], [-0.95, -0.35], [0, -0.35]], 0.09, M.leaf3, 0, 0, 0);
  box(r, 0.04, 0.12, 0.1, M.white, -0.5, 0.45, 0);
  const tiller = group(g, -4.55, 0.95, 0, 'tiller');
  rod(tiller, [0, 0, 0], [0.55, 0.22, 0.12], 0.04, M.wood2);
  rod(tiller, [0.55, 0.22, 0.12], [0.95, 0.38, 0.32], 0.035, M.wood2);
  // stern flag, waving
  rod(g, [-4.62, 0.9, -0.3], [-4.75, 2.1, -0.3], 0.025, M.wood3);
  const flag = group(g, -4.74, 2.05, -0.3, 'flag');
  const cols = [];
  for (let i = 0; i < 4; i++) {
    const c = group(i === 0 ? flag : cols[i - 1], i === 0 ? -0.02 : -0.16, 0, 0);
    box(c, 0.16, 0.13, 0.02, M.red, -0.08, -0.065, 0, { cast: false });
    box(c, 0.16, 0.13, 0.02, M.white, -0.08, -0.195, 0, { cast: false });
    box(c, 0.16, 0.13, 0.02, M.blue, -0.08, -0.325, 0, { cast: false });
    cols.push(c);
  }
  return { tiller, flagCols: cols };
}

export function buildBoat(scene, M) {
  const root = group(scene, 0, 0, 0, 'tjalk');
  const g = group(root, 0, 0, 0, 'tjalkBody'); // pitches and rolls
  hull(g, M);
  leeboard(g, M, 1);
  leeboard(g, M, -1);
  const rig = rigging(g, M);
  cabin(g, M);
  const steer = steering(g, M);
  // hatches amidships
  for (let i = 0; i < 4; i++) box(g, 0.75, 0.16, 1.5, i % 2 ? M.wood4 : M.wood3, -0.95 + i * 0.8, BOAT.deckY + 0.18, 0);
  // fenders over the side
  for (const s of [-1, 1]) for (const x of [-2.5, 0, 2.6]) cyl(g, 0.08, 0.08, 0.32, M.white, x, 0.4, s * 1.24, { seg: 8 });
  // story: the skipper's bike lashed to the foredeck
  const bike = buildBike(M, { frame: M.teal });
  bike.group.position.set(3.4, BOAT.deckY + 0.1, -0.55);
  bike.group.rotation.set(0, Math.PI / 2, 0.06);
  bike.shadow.visible = false;
  g.add(bike.group);
  // anchor on the bow
  box(g, 0.08, 0.35, 0.3, M.ink, 4.3, BOAT.deckY + 0.2, 0.5, { rot: [0, 0, 0.4] });
  return { root, body: g, pennant: rig, steer };
}
