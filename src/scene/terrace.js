import * as THREE from 'three';
import { box, cyl, sph, tor, rod, ico, group } from './util.js';
import { contactShadow } from './detail.js';

/** Café terrace on the back pavement, and the hand props the cast passes around. */
export const TABLES = [
  { x: -6.6, z: -4.05 },
  { x: -4.6, z: -4.05 },
];

function table(scene, M, x, z) {
  const g = group(scene, x, 0, z, 'table');
  cyl(g, 0.38, 0.38, 0.035, M.white, 0, 0.72, 0, { seg: 20 });
  tor(g, 0.37, 0.018, M.steelDark, 0, 0.705, 0, { rot: [Math.PI / 2, 0, 0], seg: 24 });
  cyl(g, 0.035, 0.045, 0.68, M.steelDark, 0, 0.36, 0, { seg: 10 });
  cyl(g, 0.24, 0.26, 0.03, M.steelDark, 0, 0.015, 0, { seg: 16 });
  cyl(g, 0.05, 0.05, 0.02, M.glassPale, 0.08, 0.75, -0.18, { seg: 10 }); // ashtray
  contactShadow(g, 0, 0, 0, 1.0, 0.4);
  return g;
}

function chair(scene, M, x, z, yaw) {
  const g = group(scene, x, 0, z, 'chair');
  g.rotation.y = yaw;
  // seat with a deep apron: the seated pelvis mesh sinks into it, unseen
  box(g, 0.42, 0.16, 0.42, M.wood2, 0, 0.34, 0);
  box(g, 0.44, 0.03, 0.44, M.wood1, 0, 0.43, 0);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) cyl(g, 0.018, 0.018, 0.27, M.steelDark, sx * 0.18, 0.135, sz * 0.18, { seg: 6 });
  for (const sx of [-1, 1]) box(g, 0.03, 0.45, 0.03, M.wood2, sx * 0.19, 0.66, -0.2, { rot: [-0.1, 0, 0] });
  box(g, 0.4, 0.09, 0.025, M.wood2, 0, 0.84, -0.215);
  box(g, 0.4, 0.06, 0.025, M.wood2, 0, 0.66, -0.2);
  contactShadow(g, 0, 0, 0, 0.6, 0.4);
  return g;
}

function planter(scene, M, x, z) {
  box(scene, 0.9, 0.5, 0.4, M.wood4, x, 0.25, z);
  box(scene, 0.96, 0.06, 0.46, M.wood5, x, 0.52, z);
  for (let i = 0; i < 4; i++) ico(scene, 0.2, i % 2 ? M.leaf2 : M.leaf1, x - 0.3 + i * 0.2, 0.68, z + (i % 2 ? 0.06 : -0.06), { detail: 0 });
  for (let i = 0; i < 5; i++) ico(scene, 0.06, [M.red, M.yellow, M.pink][i % 3], x - 0.32 + i * 0.16, 0.86, z + (i % 2 ? 0.08 : -0.05), { detail: 0 });
}

function menuBoard(scene, M, x, z, yaw) {
  const g = group(scene, x, 0, z, 'menu');
  g.rotation.y = yaw;
  for (const s of [-1, 1]) {
    box(g, 0.5, 0.8, 0.03, M.wood4, 0, 0.42, s * 0.16, { rot: [s * 0.35, 0, 0] });
    box(g, 0.42, 0.62, 0.012, M.ink, 0, 0.44, s * (0.16 + 0.02 * Math.cos(0.35)) + s * 0.01, { rot: [s * 0.35, 0, 0], cast: false });
  }
  // chalk lines
  for (let i = 0; i < 4; i++) box(g, 0.3 - (i % 2) * 0.1, 0.02, 0.01, M.white, -0.02, 0.62 - i * 0.1, 0.22 - (0.62 - i * 0.1 - 0.44) * 0.36, { rot: [0.35, 0, 0], cast: false });
  contactShadow(g, 0, 0, 0, 0.6, 0.4);
}

export function buildTerrace(scene, M) {
  for (const t of TABLES) table(scene, M, t.x, t.z);
  const chairs = [
    chair(scene, M, -6.95, -4.6, 0),
    chair(scene, M, -6.25, -4.6, 0),
    chair(scene, M, -7.2, -3.75, Math.PI / 2),
    chair(scene, M, -4.6, -4.6, 0),
    chair(scene, M, -4.05, -3.85, -Math.PI / 2),
  ];
  planter(scene, M, -8.0, -4.1);
  planter(scene, M, -2.95, -4.1);
  menuBoard(scene, M, -3.45, -4.72, 0.3);
  return { chairs };
}

// -------------------------------------------------------------- hand props

export function makeGlass(M) {
  const g = new THREE.Group();
  g.name = 'glass';
  const shell = cyl(g, 0.036, 0.03, 0.15, M.glassPale, 0, 0.075, 0, { seg: 10, cast: false });
  shell.material = shell.material.clone();
  shell.material.transparent = true;
  shell.material.opacity = 0.5;
  const beer = cyl(g, 0.03, 0.026, 1, M.beer, 0, 0, 0, { seg: 10, cast: false });
  const foam = cyl(g, 0.031, 0.031, 0.02, M.foam, 0, 0, 0, { seg: 10, cast: false });
  g.userData.setLevel = (k) => {
    const h = Math.max(0.003, 0.12 * k);
    beer.scale.y = h;
    beer.position.y = h / 2 + 0.005;
    foam.position.y = h + 0.015;
    foam.visible = k > 0.02;
  };
  g.userData.setLevel(1);
  return g;
}

export function makeBasket(M, balls = true) {
  const g = new THREE.Group();
  g.name = 'basket';
  box(g, 0.22, 0.04, 0.16, M.wood2, 0, 0.02, 0);
  for (const s of [-1, 1]) {
    box(g, 0.22, 0.05, 0.012, M.wood3, 0, 0.055, s * 0.075);
    box(g, 0.012, 0.05, 0.16, M.wood3, s * 0.105, 0.055, 0);
  }
  box(g, 0.19, 0.008, 0.13, M.white, 0, 0.045, 0, { cast: false });
  cyl(g, 0.018, 0.018, 0.03, M.yellow, 0.07, 0.065, 0.045, { seg: 8 }); // mustard
  g.userData.balls = [];
  g.userData.slots = [];
  if (balls) {
    for (let i = 0; i < 6; i++) {
      const x = -0.065 + (i % 3) * 0.055;
      const z = i < 3 ? -0.03 : 0.03;
      g.userData.slots.push([x, 0.072, z]);
    }
  } else {
    // eaten: crumpled paper and a used cocktail stick
    box(g, 0.08, 0.03, 0.06, M.white, -0.04, 0.065, 0.02, { rot: [0.3, 0.5, 0.2] });
    box(g, 0.06, 0.004, 0.004, M.wood1, 0.04, 0.052, -0.02, { rot: [0, 0.6, 0] });
  }
  return g;
}

export function makeBall(M) {
  const g = new THREE.Group();
  sph(g, 0.026, M.wood4, 0, 0, 0, { seg: 8, seg2: 6 });
  box(g, 0.004, 0.05, 0.004, M.wood1, 0.0, 0.03, 0, { cast: false });
  return g;
}

export function makeTray(M) {
  const g = new THREE.Group();
  g.name = 'tray';
  cyl(g, 0.23, 0.23, 0.015, M.steelDark, 0, 0.0075, 0, { seg: 20 });
  tor(g, 0.23, 0.012, M.steel, 0, 0.015, 0, { rot: [Math.PI / 2, 0, 0], seg: 24 });
  g.userData.slots = [
    [-0.1, 0.015, 0.0],
    [0.1, 0.015, 0.0],
  ];
  return g;
}

export function makeBag(M) {
  const g = new THREE.Group();
  box(g, 0.26, 0.32, 0.12, M.wood1, 0, -0.2, 0);
  box(g, 0.26, 0.03, 0.12, M.wood2, 0, -0.05, 0);
  rod(g, [-0.08, -0.04, 0], [0, 0.0, 0], 0.008, M.wood4);
  rod(g, [0.08, -0.04, 0], [0, 0.0, 0], 0.008, M.wood4);
  // story: a baguette sticking out
  cyl(g, 0.03, 0.025, 0.4, M.wood1, 0.05, -0.02, 0, { rot: [0, 0, -0.25], seg: 8 });
  return g;
}

export function makePhone(M) {
  const g = new THREE.Group();
  box(g, 0.07, 0.14, 0.01, M.ink, 0, 0, 0, { cast: false });
  box(g, 0.06, 0.12, 0.004, M.glassLight, 0, 0, 0.006, { cast: false });
  return g;
}
