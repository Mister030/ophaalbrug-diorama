import * as THREE from 'three';
import { CANAL, SLAB, clamp, hash } from '../config.js';
import { group } from './util.js';

/**
 * Boat wake as a pure function of the boat's state: V arms off the bow, a
 * churned wash behind the stern and a few transverse ripples. Nothing
 * integrates dt, so ?t= freezes reproduce the played frame exactly.
 */
function canvasTex(w, h, paint) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, w, h);
  paint(ctx, w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const FOAM = '214, 232, 222';

function streakTex() {
  return canvasTex(256, 32, (ctx, w, h) => {
    // bright at the bow end (x = w), fading to nothing along the arm
    const g = ctx.createLinearGradient(w, 0, 0, 0);
    g.addColorStop(0, `rgba(${FOAM}, 0.95)`);
    g.addColorStop(0.5, `rgba(${FOAM}, 0.45)`);
    g.addColorStop(1, `rgba(${FOAM}, 0)`);
    ctx.fillStyle = g;
    ctx.fillRect(0, h * 0.3, w, h * 0.4);
    for (let i = 0; i < 40; i++) {
      const x = hash(i * 3.1) * w;
      const y = h * (0.25 + hash(i * 7.7) * 0.5);
      ctx.fillStyle = `rgba(${FOAM}, ${0.3 * (x / w)})`;
      ctx.fillRect(x, y, 4 + hash(i) * 8, 3);
    }
  });
}

function washTex() {
  return canvasTex(128, 128, (ctx, w, h) => {
    for (let i = 0; i < 70; i++) {
      const x = w * (0.1 + hash(i * 1.37) * 0.8);
      const y = h * (0.15 + hash(i * 2.11) * 0.7);
      const r = 4 + hash(i * 5.3) * 12;
      const fall = 1 - x / w; // densest near the stern (x = 0)
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(${FOAM}, ${0.55 * fall + 0.1})`);
      g.addColorStop(1, `rgba(${FOAM}, 0)`);
      ctx.fillStyle = g;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
  });
}

function rippleTex() {
  return canvasTex(128, 16, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, w, 0);
    g.addColorStop(0, `rgba(${FOAM}, 0)`);
    g.addColorStop(0.5, `rgba(${FOAM}, 0.7)`);
    g.addColorStop(1, `rgba(${FOAM}, 0)`);
    ctx.fillStyle = g;
    ctx.fillRect(0, h * 0.35, w, h * 0.3);
  });
}

function flat(parent, w, d, tex, order = 6) {
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
  const geo = new THREE.PlaneGeometry(w, d);
  geo.rotateX(-Math.PI / 2);
  const m = new THREE.Mesh(geo, mat);
  m.renderOrder = order;
  parent.add(m);
  return m;
}

export function buildWake(scene) {
  const g = group(scene, 0, CANAL.waterY + 0.012, CANAL.boatZ, 'wake');
  const streak = streakTex();
  const arms = [-1, 1].map((s) => {
    const pivot = group(g, 0, 0, 0);
    const m = flat(pivot, 7.5, 0.34, streak);
    m.position.x = -3.75; // plane spans 0 .. -7.5 behind the bow
    pivot.userData.side = s;
    return { pivot, m };
  });
  const wash = flat(g, 3.6, 2.2, washTex());
  const ripples = [];
  const rt = rippleTex();
  for (let i = 0; i < 5; i++) {
    const m = flat(g, 0.3, 2.6, rt, 5);
    m.rotation.y = 0;
    ripples.push(m);
  }
  const bowFoam = flat(g, 0.9, 1.6, washTex(), 7);
  return { group: g, arms, wash, ripples, bowFoam };
}

/** bowX: world x of the bow tip; speed in m/s; len: hull length. */
export function updateWake(w, t, bowX, speed, len) {
  const k = clamp(speed / 1.8, 0, 1);
  const edge = (x) => clamp((SLAB.hx + 0.4 - Math.abs(x)) / 1.2, 0, 1);
  w.group.position.x = bowX;
  w.group.visible = k > 0.02 && bowX > -SLAB.hx - 1 && bowX - len < SLAB.hx + 8;
  for (const a of w.arms) {
    const s = a.pivot.userData.side;
    a.pivot.position.set(-0.15, 0, s * 0.35);
    a.pivot.rotation.y = s * 0.33; // Kelvin-ish half angle, a touch wider
    a.m.material.opacity = 0.75 * k * edge(bowX - 2);
    a.m.scale.x = 0.6 + 0.4 * k;
  }
  w.wash.position.set(-len - 1.5, 0, 0);
  w.wash.material.opacity = 0.9 * k * edge(bowX - len - 1.5);
  w.wash.material.map.offset.x = (t * 0.35) % 1;
  w.ripples.forEach((r, i) => {
    const ph = ((t * speed * 0.6) / 1.4 + i / w.ripples.length) % 1;
    r.position.set(-len - 0.6 - ph * 6.5, 0, 0);
    r.scale.set(1, 1, 0.7 + ph * 1.2);
    r.material.opacity = 0.55 * k * (1 - ph) * edge(bowX - len - 0.6 - ph * 6.5);
  });
  w.bowFoam.position.set(0.05, 0, 0);
  w.bowFoam.material.opacity = 0.8 * k * edge(bowX);
}

/** Ducks paddling slow loops along the back quay. */
export function updateDucks(ducks, t) {
  ducks.forEach((d, i) => {
    const a = t * 0.2 + i * 0.55;
    const x = -6.6 + Math.cos(a) * 2.6;
    const z = 0.15 + Math.sin(a) * 0.35;
    const dx = -Math.sin(a) * 2.6;
    const dz = Math.cos(a) * 0.35;
    d.position.set(x, CANAL.waterY + Math.sin(t * 2.3 + i) * 0.01, z);
    d.rotation.y = Math.atan2(dx, dz);
    d.rotation.z = Math.sin(t * 3.1 + i * 2) * 0.05;
  });
}
