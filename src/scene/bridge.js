import * as THREE from 'three';
import { BRIDGE, BARRIER } from '../config.js';
import { box, cyl, sph, rod, extrude, group } from './util.js';
import { contactShadow, haloPlane } from './detail.js';

/**
 * Dutch double-beam bascule bridge ("Hollandse ophaalbrug").
 *
 * The leaf hinges on the back quay. Two balance beams pivot on the portal posts
 * directly above the hinge, and vertical tie rods join each beam tip to the
 * leaf tip. Beam arm == leaf length, rod == pivot height, so the linkage is a
 * parallelogram: the beams turn through the same angle as the leaf and the rods
 * stay vertical. One angle drives the whole machine.
 */
const PIVOT_Y = BRIDGE.deckY + BRIDGE.portalH; // 4.25
const BEAM_X = [-0.55, 3.55];
const POST_X = [-0.3, 3.3];
const REAR_ARM = 3.0;

function leaf(parent, M) {
  const g = group(parent, BRIDGE.x0, BRIDGE.deckY, BRIDGE.hingeZ, 'leaf');
  const L = BRIDGE.len;
  // main girders and deck
  for (const x of [0.1, 2.9]) box(g, 0.2, 0.34, L, M.white, x, -0.13, L / 2);
  box(g, 3.0, 0.08, L, M.wood5, 1.5, -0.02, L / 2, { cast: false });
  for (let z = 0.15; z < L; z += 0.3) box(g, 2.6, 0.05, 0.24, (Math.round(z / 0.3) % 2 ? M.wood3 : M.wood4), 1.5, 0.03, z);
  // underside cross beams (seen when the leaf is up)
  for (let z = 0.5; z < L; z += 1.1) box(g, 2.8, 0.2, 0.16, M.slateDark, 1.5, -0.2, z);
  // railings: start 1.0 m from the hinge so the swung-back rail clears the boom
  for (const x of [0.06, 2.94]) {
    for (let z = 1.0; z <= L - 0.1; z += 0.86) box(g, 0.08, 0.75, 0.08, M.white, x, 0.4, z);
    box(g, 0.1, 0.08, L - 1.0, M.white, x, 0.78, 1.0 + (L - 1.0) / 2);
    box(g, 0.06, 0.06, L - 1.0, M.white, x, 0.42, 1.0 + (L - 1.0) / 2);
    // diagonal braces between posts
    for (let z = 1.0; z < L - 0.9; z += 0.86) rod(g, [x, 0.08, z], [x, 0.76, z + 0.86], 0.025, M.white);
  }
  // tip outriggers carrying the tie-rod eyes
  for (const bx of BEAM_X) {
    const x = bx - BRIDGE.x0;
    box(g, Math.abs(x - (x < 1.5 ? 0.1 : 2.9)) + 0.15, 0.16, 0.22, M.white, (x + (x < 1.5 ? 0.1 : 2.9)) / 2, -0.06, L - 0.15);
    cyl(g, 0.07, 0.07, 0.14, M.steelDark, x, 0.06, L - 0.15, { rot: [0, 0, Math.PI / 2], seg: 8 });
  }
  // story: a worn wheel track on the planks, and a lost glove on the rail
  box(g, 0.32, 0.012, L - 0.6, M.wood5, 2.1, 0.06, L / 2, { cast: false });
  box(g, 0.1, 0.05, 0.14, M.red, 2.94, 0.85, 3.1);
  return g;
}

function beam(parent, M, x) {
  const g = group(parent, x, PIVOT_Y, BRIDGE.hingeZ, 'beam');
  const L = BRIDGE.len;
  // tapered balance beam: front arm to the tie rod, rear arm to the ballast box
  extrude(g, [[-REAR_ARM, -0.2], [L + 0.1, -0.08], [L + 0.1, 0.08], [-REAR_ARM, 0.2]], 0.2, M.white, 0, 0, 0, { rot: [0, -Math.PI / 2, 0] });
  // ballast box with iron straps
  box(g, 0.5, 0.9, 1.2, M.slateDark, 0, -0.45, -REAR_ARM + 0.6);
  for (const dz of [-0.35, 0.35]) box(g, 0.54, 0.94, 0.06, M.steel, 0, -0.45, -REAR_ARM + 0.6 + dz);
  // black-painted tips and the pivot drum
  box(g, 0.22, 0.2, 0.4, M.ink, 0, 0, L - 0.1);
  cyl(g, 0.16, 0.16, 0.36, M.steelDark, 0, 0, 0, { rot: [0, 0, Math.PI / 2], seg: 12 });
  return g;
}

function portal(parent, M) {
  const g = group(parent, 0, 0, 0, 'portal');
  for (const x of POST_X) {
    box(g, 0.3, PIVOT_Y - 0.12, 0.3, M.white, x, (PIVOT_Y - 0.12) / 2, BRIDGE.hingeZ);
    box(g, 0.5, 0.35, 0.5, M.stone, x, 0.17, BRIDGE.hingeZ);
    // bearing block on top, carrying the beam pivot outboard
    const out = x < 1.5 ? -1 : 1;
    box(g, 0.5, 0.22, 0.34, M.steelDark, x + out * 0.12, PIVOT_Y - 0.12, BRIDGE.hingeZ);
    // raking strut back to the street, and an outboard knee brace
    rod(g, [x, 2.6, BRIDGE.hingeZ - 0.1], [x, 0.1, BRIDGE.hingeZ - 1.25], 0.07, M.white);
    rod(g, [x, 3.2, BRIDGE.hingeZ], [x + out * 0.9, 0.1, BRIDGE.hingeZ], 0.06, M.white);
  }
  // overhead tie between the posts, set back so the swung rails clear it
  box(g, POST_X[1] - POST_X[0] - 0.3, 0.18, 0.2, M.white, 1.5, 3.95, BRIDGE.hingeZ - 0.42);
  for (const s of [-1, 1]) rod(g, [1.5 + s * 1.65, 3.5, BRIDGE.hingeZ - 0.42], [1.5 + s * 1.1, 3.95, BRIDGE.hingeZ - 0.42], 0.05, M.white);
  // name board on the tie
  box(g, 1.3, 0.3, 0.06, M.navy, 1.5, 3.62, BRIDGE.hingeZ - 0.33);
  box(g, 1.0, 0.08, 0.02, M.white, 1.5, 3.62, BRIDGE.hingeZ - 0.29);
  // hinge sill and front landing stone
  box(g, 3.6, 0.12, 0.4, M.stone, 1.5, 0.0, BRIDGE.hingeZ - 0.2);
  box(g, 3.4, 0.14, 0.3, M.stone, 1.5, 0.0, BRIDGE.hingeZ + BRIDGE.len + 0.1);
  for (const x of [0.1, 2.9]) cyl(g, 0.14, 0.14, 0.3, M.steelDark, x, BRIDGE.deckY - 0.12, BRIDGE.hingeZ, { rot: [0, 0, Math.PI / 2], seg: 10 });
  return g;
}

function barrier(parent, M, px, pz, dir, face, len = 3.9) {
  // dir: +1 boom runs toward +X, -1 toward -X. face: +1 lamps face +Z.
  const g = group(parent, px, 0, pz, 'barrier');
  box(g, 0.34, 0.2, 0.34, M.stone, 0, 0.1, 0);
  box(g, 0.24, 1.0, 0.24, M.white, 0, 0.6, 0);
  box(g, 0.32, 0.36, 0.3, M.red, 0, 1.15, 0);
  const pivot = group(g, 0, 1.05, face * 0.2, 'boom');
  const segs = 6;
  for (let i = 0; i < segs; i++) {
    box(pivot, len / segs, 0.1, 0.07, i % 2 ? M.white : M.red, dir * (len / segs) * (i + 0.5), 0, 0);
  }
  box(pivot, 0.5, 0.26, 0.18, M.slateDark, -dir * 0.3, 0, 0); // counterweight
  // tip lamp
  const tip = box(pivot, 0.12, 0.12, 0.12, M.redLampOff, dir * (len - 0.06), 0.1, 0);
  // signal head: two red lamps + hood on a short mast beside the post
  const head = group(g, -dir * 0.05, 1.7, face * 0.05, 'signal');
  box(head, 0.12, 0.7, 0.12, M.steelDark, 0, -0.35, 0);
  box(head, 0.62, 0.3, 0.14, M.ink, 0, 0.1, 0);
  const lamps = [];
  for (const s of [-1, 1]) {
    const lamp = box(head, 0.18, 0.18, 0.05, M.redLampOff, s * 0.17, 0.1, face * 0.08);
    box(head, 0.22, 0.05, 0.14, M.ink, s * 0.17, 0.22, face * 0.12);
    const halo = haloPlane(head, 0.6, 0.6, '214,75,60', 0, s * 0.17, 0.1, face * 0.12, { rotation: [0, face > 0 ? 0 : Math.PI, 0] });
    lamps.push({ lamp, halo });
  }
  // bike stop line on the ground
  box(g, 3.2, 0.012, 0.12, M.white, dir * 1.9, 0.022, face * 0.55, { cast: false });
  contactShadow(g, 0, 0, 0, 0.7, 0.5);
  return { group: g, pivot, lamps, dir, tip };
}

function booth(parent, M) {
  const g = group(parent, -2.2, 0, 5.6, 'booth');
  const w = 1.5;
  const d = 1.0;
  box(g, w + 0.1, 0.12, d + 0.1, M.stone, 0, 0.06, 0);
  // lower walls (planked), corner posts, open glazing frames
  for (const [sx, sz, ww, dd] of [
    [0, -1, w, 0.06],
    [0, 1, w, 0.06],
    [-1, 0, 0.06, d],
    [1, 0, 0.06, d],
  ]) {
    box(g, ww, 0.95, dd, M.leaf3, (sx * w) / 2, 0.6, (sz * d) / 2);
    box(g, ww + 0.04, 0.07, dd + 0.04, M.white, (sx * w) / 2, 1.1, (sz * d) / 2);
  }
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(g, 0.08, 2.1, 0.08, M.white, (sx * w) / 2, 1.15, (sz * d) / 2);
  for (const sz of [-1, 1]) box(g, w, 0.07, 0.07, M.white, 0, 2.15, (sz * d) / 2);
  for (const sx of [-1, 1]) box(g, 0.07, 0.07, d, M.white, (sx * w) / 2, 2.15, 0);
  for (const sz of [-1, 1]) box(g, 0.04, 1.0, 0.04, M.white, 0, 1.65, (sz * d) / 2);
  // pitched roof with eaves
  extrude(g, [[-(w / 2 + 0.25), 0], [w / 2 + 0.25, 0], [0, 0.55]], d + 0.4, M.slateDark, 0, 2.2, 0);
  box(g, w + 0.55, 0.06, d + 0.44, M.white, 0, 2.2, 0);
  // control desk on the bridge side (+X): two buttons and a lever
  box(g, 0.35, 0.08, 0.9, M.wood3, 0.52, 1.05, 0);
  const btnRed = box(g, 0.08, 0.04, 0.08, M.red, 0.52, 1.11, -0.22);
  box(g, 0.08, 0.04, 0.08, M.leaf1, 0.52, 1.11, -0.02);
  box(g, 0.04, 0.2, 0.04, M.ink, 0.5, 1.18, 0.22, { rot: [0, 0, -0.3] });
  // story: a radio and a thermos on the canal-side sill
  box(g, 0.22, 0.12, 0.1, M.orange, -0.3, 1.2, -0.42);
  cyl(g, 0.04, 0.04, 0.22, M.blue, -0.1, 1.25, -0.42, { seg: 8 });
  contactShadow(g, 0, 0, 0, 2.2, 0.5);
  return { group: g, button: btnRed };
}

export function buildBridge(scene, M) {
  const root = group(scene, 0, 0, 0, 'bridge');
  portal(root, M);
  const leafG = leaf(root, M);
  const beams = BEAM_X.map((x) => beam(root, M, x));
  const rods = BEAM_X.map((x) => {
    const r = rod(root, [0, 0, 0], [0, 1, 0], 0.045, M.steelDark);
    r.userData.x = x;
    return r;
  });
  const front = barrier(root, M, 3.6, BARRIER.frontZ, -1, 1);
  const back = barrier(root, M, 4.15, BARRIER.backZ, -1, -1, 4.4);
  const hut = booth(root, M);
  return { root, leaf: leafG, beams, rods, barriers: [front, back], booth: hut };
}

const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const LUG_Z = BRIDGE.len - 0.15;

/**
 * lift: leaf angle in radians (0 shut). boom: 0 up .. 1 down. lights: 0/1.
 * The tie rods are solved from the two attachment points every frame, so the
 * linkage can be proven from numbers: the rods must stay vertical.
 */
export function updateBridge(br, lift, boom, lights, t) {
  br.leaf.rotation.x = -lift;
  for (const b of br.beams) b.rotation.x = -lift;
  br.root.updateMatrixWorld(true);
  br.rods.forEach((r, i) => {
    const x = r.userData.x;
    br.leaf.localToWorld(_a.set(x - BRIDGE.x0, 0.06, LUG_Z));
    br.beams[i].localToWorld(_b.set(0, -0.09, LUG_Z));
    r.position.copy(_a).add(_b).multiplyScalar(0.5);
    r.scale.set(1, _a.distanceTo(_b), 1);
    r.quaternion.setFromUnitVectors(UP, _b.sub(_a).normalize());
  });
  for (const bar of br.barriers) {
    // boom raised to ~84 degrees; lowered to horizontal
    bar.pivot.rotation.z = bar.dir * (1 - boom) * 1.47;
    bar.lamps.forEach((l, i) => {
      const on = lights > 0 && (Math.floor(t * 2.4) + i) % 2 === 0;
      l.lamp.material = on ? LAMP.on : LAMP.off;
      l.halo.material.opacity = on ? 0.55 : 0;
    });
    bar.tip.material = lights > 0 && Math.floor(t * 2.4) % 2 === 0 ? LAMP.on : LAMP.off;
  }
}

const UP = new THREE.Vector3(0, 1, 0);
const LAMP = { on: null, off: null };
export function setLampMaterials(on, off) {
  LAMP.on = on;
  LAMP.off = off;
}
