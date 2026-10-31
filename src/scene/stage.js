import * as THREE from 'three';
import { LOOP, LANES, CANAL, BRIDGE, clamp, lerp, smooth, win, bell, hash, keyed } from '../config.js';
import { Track } from './track.js';
import { buildPerson, setPose } from './peopleModel-street.js';
import { STAND, walkPose, mixPose } from './poses.js';
import { buildBike, BIKE, riderPose } from './bike.js';
import { updateBridge } from './bridge.js';
import { updateWake, updateDucks } from './effects.js';
import { contactShadow } from './detail.js';
import { TABLES, makeGlass, makeBasket, makeBall, makeTray, makeBag, makePhone } from './terrace.js';

/**
 * The beat sheet and every actor as a function of t.
 *
 *  0.0  bikes cross, the waiter brings the first round
 * 10.0  keeper: red lights   11.0–12.6 booms down   12.7 late cyclist brakes
 * 13.0  keeper: lift         13.2–18.2 leaf rises   20.7 mast under the beams
 * 26.0  keeper: lower        26–31 leaf down        31.6–33 booms up
 * 33.1  the late one goes first, the queue follows  34.5–40 quiet seam
 */
const TAU = Math.PI * 2;
const wrap = (t, t0 = 0) => (((t - t0) % LOOP) + LOOP) % LOOP;
const STRIDE = 1.03; // metres per full walk phase at amp 0.32
const BLEND = 0.3;
const mix3 = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
const lerpAngle = (a, b, k) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * k;
const _v = new THREE.Vector3();
const _w = new THREE.Vector3();
const _q = new THREE.Quaternion();

// ---------------------------------------------------------------- schedules
export const SCHED = {
  lift: keyed([[0, 0], [13.0, 0], [18.2, BRIDGE.maxLift], [26.0, BRIDGE.maxLift], [31.0, 0], [LOOP, 0]]),
  boom: keyed([[0, 0], [11.0, 0], [12.6, 1], [31.6, 1], [33.0, 0], [LOOP, 0]]),
  lights: (t) => (t >= 10.0 && t < 33.6 ? 1 : 0),
  bow: keyed([[0, -13.6], [8, -6.4], [13, -2.8], [18, -0.4], [20.7, 3.7], [24, 8.3], [27, 12.3], [34, 21.5], [LOOP, 28.0]]),
  door: (t) => bell(t, 1.9, 3.3, 0.45) + bell(t, 7.9, 8.9, 0.45) + bell(t, 23.9, 25.3, 0.45) + bell(t, 27.8, 28.9, 0.45),
};

// ---------------------------------------------------------------- tracks
const T = {
  crossAway: new Track([[14.8, LANES.quayWest], [4.6, LANES.quayWest], [3.0, 6.2], [2.3, 5.4], [2.1, 4.4], [2.1, -0.9], [1.7, -2.1], [0.6, LANES.streetWest], [-1.5, LANES.streetWest], [-14.8, LANES.streetWest]]),
  crossToward: new Track([[14.8, LANES.streetWest], [3.2, LANES.streetWest], [1.6, -2.3], [0.95, -1.3], [0.9, -0.2], [0.9, 4.6], [1.1, 5.6], [1.8, 6.5], [3.2, LANES.quayEast], [5.0, LANES.quayEast], [14.8, LANES.quayEast]]),
  streetEast: new Track([[-14.8, LANES.streetEast], [14.8, LANES.streetEast]]),
  streetWest: new Track([[14.8, LANES.streetWest], [-14.8, LANES.streetWest]]),
  quayWest: new Track([[14.8, LANES.quayWest], [-14.8, LANES.quayWest]]),
  quayEast: new Track([[-14.8, LANES.quayEast], [14.8, LANES.quayEast]]),
  walk: new Track([[14.8, LANES.walk], [-14.8, LANES.walk]]),
  out1: new Track([[-5.5, -5.3], [-5.5, -4.75], [-5.85, -4.35], [-5.95, -4.05]]),
  between: new Track([[-5.95, -4.05], [-5.6, -3.95], [-5.3, -4.05]]),
  back2: new Track([[-5.3, -4.05], [-5.45, -4.6], [-5.5, -5.3]]),
  back1: new Track([[-5.95, -4.05], [-5.6, -4.6], [-5.5, -5.3]]),
};

function distWhere(track, pred) {
  for (const p of track.pts) if (pred(p)) return p.dist;
  return track.length;
}
const STOP_A = distWhere(T.crossAway, (p) => p.x < 3.3 && p.z < 6.55);
// wait on the street lane, a bike length short of the turn, so the crate clears the boom
const STOP_B = distWhere(T.crossToward, (p) => p.x < 2.7);

/** Distance schedule for a rider who brakes for the barrier and goes again. */
function stopSchedule(len, s) {
  const brakeDist = (s.vIn * s.brake) / 2;
  const tBrake = s.tStop - s.brake;
  const dBrake = s.d - brakeDist;
  const tEnter = tBrake - dBrake / s.vIn;
  const acc = 1.6;
  const dAcc = (s.vOut * acc) / 2;
  const tAcc = s.tGo + acc;
  const tExit = tAcc + (len - s.d - dAcc) / s.vOut;
  const f = keyed([[tEnter, 0], [tBrake, dBrake], [s.tStop, s.d], [s.tGo, s.d], [tAcc, s.d + dAcc], [tExit, len]]);
  return (t) => (t < tEnter || t > tExit ? -1 : f(t));
}

// ---------------------------------------------------------------- cast sheet
function costumes(M) {
  const c = M.cloth;
  return {
    P3: { top: M.teal, bottom: M.denim, hairIdx: 1 },
    P4: { top: M.orange, topStyle: 'puffer', sleeve: 'long', bottom: M.slate, hatType: 'beanie', hatMat: M.navy, skin: 4 },
    P1: { top: M.olive, topStyle: 'jacket', sleeve: 'long', bottom: M.black, hairStyle: 'long', hairIdx: 1, skin: 1 },
    P2: { top: M.purple, topStyle: 'hoodie', sleeve: 'long', hoodDown: true, bottom: M.denim, hairStyle: 'buzz', skin: 5 },
    L: { top: M.navy, topStyle: 'jacket', sleeve: 'long', bottom: M.slate, shoe: M.black, hairIdx: 2, skin: 0 },
    W1: { top: M.red, bottom: M.white, hairStyle: 'bun', hairIdx: 0, skin: 3 },
    W2: { top: M.denim, topStyle: 'hoodie', sleeve: 'long', hoodDown: true, backpack: M.red, bottom: M.black, hairIdx: 0, skin: 2 },
    P5: { top: M.yellow, topStyle: 'puffer', sleeve: 'long', bottom: M.slate, hatType: 'beanie', hatMat: M.red, skin: 1 },
    P7: { top: M.white, bottom: M.denim, hairStyle: 'long', hairIdx: 2, skin: 0 },
    P8: { top: M.red, topStyle: 'jacket', sleeve: 'long', bottom: M.slate, hatType: 'cap', hatMat: M.navy, skin: 4 },
    keeper: { top: M.navy, topStyle: 'jacket', sleeve: 'long', bottom: M.navy, hatType: 'cap', hatMat: M.navy, hatBand: M.yellow, hairIdx: 3, skin: 1 },
    skipper: { top: M.olive, topStyle: 'jacket', sleeve: 'long', bottom: M.black, hatType: 'beanie', hatMat: M.red, hairIdx: 0, skin: 2 },
    walker: { top: M.slate, topStyle: 'jacket', sleeve: 'long', bottom: M.slate, scarf: M.red, glasses: true, hairIdx: 3, skin: 1 },
    waiter: { top: M.white, bottom: M.black, apron: M.black, towel: M.white, hairIdx: 0, skin: 3 },
    G1: { top: M.denim, topStyle: 'jacket', sleeve: 'long', bottom: M.black, hairStyle: 'long', hairIdx: 2, skin: 0 },
    G2: { top: M.pink, bottom: M.white, hairStyle: 'bun', hairIdx: 1, skin: 2 },
    G3: { top: M.olive, bottom: M.denim, hairStyle: 'buzz', glasses: true, hairIdx: 0, skin: 4 },
  };
}

function person(parent, M, name, o, shadow = true) {
  const p = buildPerson(M, { ...o, skin: M.skinTones[o.skin ?? 2], hair: M.hair[o.hairIdx ?? 0] });
  p.group.name = name;
  parent.add(p.group);
  if (shadow) p.shadow = contactShadow(p.group, 0, 0, 0, 0.75, 0.55);
  return p;
}

function idle(t, ph, base = STAND) {
  const s = Math.sin(t * 1.4 + ph);
  const p = { ...base };
  p.torso = [base.torso[0] + 0.012 * s, 0.03 * Math.sin(t * 0.7 + ph), 0.012 * Math.sin(t * 0.9 + ph)];
  p.head = [0.02 * s, 0.14 * Math.sin(t * 0.45 + ph * 2.1), 0];
  return p;
}

const SEATED = {
  torso: [0.04, 0, 0],
  head: [0.05, 0, 0],
  shoulderL: [-0.35, 0, -0.14],
  shoulderR: [-0.35, 0, 0.14],
  elbowL: [-1.1, 0, 0],
  elbowR: [-1.1, 0, 0],
  wristL: [0, 0, 0],
  wristR: [0, 0, 0],
  hipL: [-1.25, 0, 0.12],
  hipR: [-1.25, 0, -0.12],
  kneeL: [0.75, 0, 0],
  kneeR: [0.75, 0, 0],
  ankleL: [0.5, 0, 0],
  ankleR: [0.5, 0, 0],
};
const SEAT_ROOT_Y = -0.31;

const CARRY_TRAY = {
  ...STAND,
  shoulderL: [-1.05, 0, -0.1],
  shoulderR: [-1.05, 0, 0.1],
  elbowL: [-1.45, 0, 0],
  elbowR: [-1.45, 0, 0],
  wristL: [-0.3, 0, 0],
  wristR: [-0.3, 0, 0],
};
const SERVE = {
  ...CARRY_TRAY,
  torso: [0.3, 0, 0],
  head: [0.25, 0, 0],
  shoulderL: [-1.0, 0, -0.1],
  elbowL: [-1.55, 0, 0],
  shoulderR: [-1.4, 0, 0.1],
  elbowR: [-0.15, 0, 0],
  wristR: [0, 0, 0],
};

// ---------------------------------------------------------------- riders
const RIDERS = [
  { id: 'P3', track: 'crossAway', t0: 1.0, v: 4.0 },
  { id: 'P4', track: 'crossToward', t0: 3.5, v: 4.2 },
  { id: 'P1', track: 'streetEast', t0: 2.0, v: 3.8 },
  { id: 'P2', track: 'quayWest', t0: 4.0, v: 3.6 },
  { id: 'L', track: 'crossAway', stop: { d: STOP_A, tStop: 12.7, tGo: 33.1, vIn: 5.5, brake: 0.8, vOut: 4.5 } },
  { id: 'W1', track: 'crossToward', stop: { d: STOP_B, tStop: 10.8, tGo: 33.5, vIn: 3.6, brake: 1.4, vOut: 3.8 }, bike: { crate: 'wood2' } },
  { id: 'W2', track: 'crossToward', stop: { d: STOP_B - 1.7, tStop: 11.7, tGo: 34.1, vIn: 3.4, brake: 1.4, vOut: 3.6 } },
  { id: 'P5', track: 'streetWest', t0: 34.5, v: 3.8 },
  { id: 'P7', track: 'crossAway', t0: 36.0, v: 4.5, bike: { basket: 'wood2' } },
  { id: 'P8', track: 'quayEast', t0: 36.5, v: 3.6 },
];

function makeRider(scene, M, C, spec) {
  const bikeOpts = {};
  if (spec.bike?.crate) bikeOpts.crate = M[spec.bike.crate];
  if (spec.bike?.basket) bikeOpts.basket = M[spec.bike.basket];
  bikeOpts.frame = [M.ink, M.slateDark, M.teal, M.red, M.navy][Math.floor(hash(spec.id.charCodeAt(0) + spec.id.length) * 5)];
  const bike = buildBike(M, bikeOpts);
  bike.group.name = `bike-${spec.id}`;
  scene.add(bike.group);
  const p = person(bike.body, M, `rider-${spec.id}`, C[spec.id], false);
  const track = T[spec.track];
  const dist = spec.stop ? stopSchedule(track.length, spec.stop) : (t) => spec.v * wrap(t, spec.t0);
  return { ...spec, bike, p, track, dist, ph: hash(spec.id.length * 7 + spec.id.charCodeAt(0)) * TAU };
}

function updateRider(r, t) {
  const len = r.track.length;
  const d = r.dist(t);
  const vis = d > 0.02 && d < len - 0.02;
  r.bike.group.visible = vis;
  if (!vis) return;
  const d1 = r.dist(t - 0.02);
  const d2 = r.dist(t + 0.02);
  let speed = (d2 - d1) / 0.04;
  if (!Number.isFinite(speed) || Math.abs(d2 - d1) > 1 || d1 < 0 || d2 < 0) speed = 0;
  speed = Math.max(0, speed);

  const a = r.track.at(d);
  const b = r.track.at(Math.min(len, d + 0.4));
  const dyaw = Math.atan2(Math.sin(b.yaw - a.yaw), Math.cos(b.yaw - a.yaw));
  const kappa = dyaw / 0.4;
  const lean = clamp((speed * speed * kappa) / 9.81, -0.32, 0.32);
  const down = 1 - smooth(clamp(speed / 0.7, 0, 1));

  r.bike.group.position.copy(a.pos);
  r.bike.group.rotation.y = a.yaw;
  r.bike.body.rotation.z = -lean + 0.1 * down;
  r.bike.steer.rotation.y = clamp(Math.atan(BIKE.wheelBase * kappa) * 0.8, -0.5, 0.5);
  for (const w of r.bike.wheels) w.rotation.x = d / BIKE.wheelR;
  const crankA = d / BIKE.wheelR / BIKE.gear;
  r.bike.crank.rotation.x = crankA;

  const { pose, root } = riderPose(crankA, down, lean * 0.3);
  // a little life while waiting: weight shift and a look around
  if (down > 0.5) {
    pose.torso = [pose.torso[0], 0.05 * Math.sin(t * 0.6 + r.ph), pose.torso[2] + 0.015 * Math.sin(t * 1.2 + r.ph)];
    pose.head = [pose.head[0], 0.25 * Math.sin(t * 0.4 + r.ph), 0];
  }
  if (r.extra) r.extra(pose, t);
  r.p.group.position.copy(root);
  setPose(r.p, pose);
}

// ---------------------------------------------------------------- props
/**
 * Hand props live in world space and follow a schedule of anchors. An anchor
 * is one of: { pos, yaw } | { hand, side, off } | { two: person, off } |
 * { on: object3d, local } | { hide: true }. Switching anchors blends for 0.3 s.
 */
function makeProps(scene, M) {
  const list = [];
  const add = (mesh, sched, extra = {}) => {
    scene.add(mesh);
    const p = { mesh, sched: sched.sort((x, y) => x.t - y.t), ...extra };
    list.push(p);
    return p;
  };
  return { list, add };
}

const anchorPos = (a, out, outYaw) => {
  if (a.pos) {
    out.set(a.pos[0], a.pos[1], a.pos[2]);
    return a.yaw ?? 0;
  }
  if (a.hand) {
    const j = a.hand.joints[a.side === 'L' ? 'wristL' : 'wristR'];
    j.getWorldPosition(out);
    a.hand.group.getWorldQuaternion(_q);
    _w.set(a.off?.[0] ?? 0, a.off?.[1] ?? 0, a.off?.[2] ?? 0).applyQuaternion(_q);
    out.add(_w);
    a.hand.group.getWorldDirection(_w);
    return Math.atan2(_w.x, _w.z) + (a.yawOff ?? 0);
  }
  if (a.two) {
    a.two.joints.wristL.getWorldPosition(out);
    a.two.joints.wristR.getWorldPosition(_v);
    out.add(_v).multiplyScalar(0.5);
    a.two.group.getWorldQuaternion(_q);
    _w.set(a.off?.[0] ?? 0, a.off?.[1] ?? 0, a.off?.[2] ?? 0).applyQuaternion(_q);
    out.add(_w);
    a.two.group.getWorldDirection(_w);
    return Math.atan2(_w.x, _w.z);
  }
  if (a.on) {
    out.set(a.local[0], a.local[1], a.local[2]);
    a.on.localToWorld(out);
    a.on.getWorldDirection(_w);
    return Math.atan2(_w.x, _w.z);
  }
  return 0;
};

function updateProps(props, t) {
  const pa = new THREE.Vector3();
  const pb = new THREE.Vector3();
  for (const p of props.list) {
    const s = p.sched;
    let i = s.length - 1;
    while (i > 0 && s[i].t > t) i--;
    const cur = s[i];
    if (cur.hide) {
      p.mesh.visible = false;
      continue;
    }
    p.mesh.visible = true;
    const yawA = anchorPos(cur, pa);
    let k = 1;
    const prev = i > 0 ? s[i - 1] : null;
    if (prev && !prev.hide && t - cur.t < BLEND) {
      k = smooth((t - cur.t) / BLEND);
      const yawB = anchorPos(prev, pb);
      pb.lerp(pa, k);
      // a small lift on the way, so a glass clears the table edge
      pb.y += Math.sin(k * Math.PI) * 0.06;
      p.mesh.position.copy(pb);
      p.mesh.rotation.y = lerpAngle(yawB, yawA, k);
    } else {
      p.mesh.position.copy(pa);
      p.mesh.rotation.y = yawA;
    }
    if (p.level) p.mesh.userData.setLevel(p.level(t));
    p.mesh.updateMatrixWorld(true);
  }
}

// ---------------------------------------------------------------- stage
export function createStage(scene, M, world) {
  const C = costumes(M);
  const { set, bridge, boat, wake, terrace } = world;
  const cast = {};

  // riders
  const riders = RIDERS.map((s) => makeRider(scene, M, C, s));
  cast.riders = Object.fromEntries(riders.map((r) => [r.id, r]));
  cast.riders.L.extra = (pose, t) => {
    const k = bell(t, 13.4, 15.6, 0.45);
    if (k <= 0) return;
    pose.shoulderL = mix3(pose.shoulderL, [-2.7, 0, -0.5], k);
    pose.shoulderR = mix3(pose.shoulderR, [-2.7, 0, 0.5], k);
    pose.elbowL = mix3(pose.elbowL, [-0.7, 0, 0], k);
    pose.elbowR = mix3(pose.elbowR, [-0.7, 0, 0], k);
    pose.head = mix3(pose.head, [-0.35, 0, 0], k);
    pose.torso = mix3(pose.torso, [-0.05, 0, 0], k);
  };

  // keeper, in the booth facing the bridge (+X)
  const booth = bridge.booth.group;
  const keeper = person(scene, M, 'keeper', C.keeper);
  keeper.group.position.set(booth.position.x + 0.0, 0.12, booth.position.z);
  keeper.group.rotation.y = Math.PI / 2;
  cast.keeper = keeper;

  // skipper at the tiller, parented to the hull so he pitches with it
  const skipper = person(boat.body, M, 'skipper', C.skipper, false);
  skipper.group.position.set(-3.62, 0.63, 0.67);
  skipper.group.rotation.y = Math.PI / 2;
  cast.skipper = skipper;

  // walker on the front pavement, with a shopping bag
  const walker = person(scene, M, 'walker', C.walker);
  const walkF = keyed([[0, 0], [7.5, 9.4], [18, 9.4], [34.2, T.walk.length]]);
  cast.walker = walker;

  // waiter and guests
  const waiter = person(scene, M, 'waiter', C.waiter);
  cast.waiter = waiter;
  const guests = [
    { p: person(scene, M, 'G1', C.G1, false), x: -6.95, z: -4.6, side: 'R', sips: [9.5, 30.0], ph: 0.4 },
    { p: person(scene, M, 'G2', C.G2, false), x: -6.25, z: -4.6, side: 'L', sips: [15.0, 36.0], ph: 2.3 },
    { p: person(scene, M, 'G3', C.G3, false), x: -4.6, z: -4.6, side: 'R', sips: [12.0, 32.0], ph: 4.1, phone: true },
  ];
  for (const g of guests) {
    g.p.group.position.set(g.x, SEAT_ROOT_Y, g.z);
    g.p.group.rotation.y = 0;
  }
  cast.guests = guests;

  // ---- hand props and their schedules
  const props = makeProps(scene, M);
  const tray = props.add(makeTray(M), [
    { t: 0, hide: true },
    { t: 2.0, two: waiter, off: [0, 0.05, 0.14] },
    { t: 3.6, hand: waiter, side: 'L', off: [0.1, 0.06, 0.12] },
    { t: 4.95, two: waiter, off: [0, 0.05, 0.14] },
    { t: 5.8, hand: waiter, side: 'L', off: [0.1, 0.06, 0.12] },
    { t: 6.9, two: waiter, off: [0, 0.05, 0.14] },
    { t: 8.5, hide: true },
    { t: 24.0, two: waiter, off: [0, 0.05, 0.14] },
    { t: 25.55, hand: waiter, side: 'L', off: [0.1, 0.06, 0.12] },
    { t: 26.7, two: waiter, off: [0, 0.05, 0.14] },
    { t: 28.4, hide: true },
  ]);
  const trayMesh = tray.mesh;
  const slot = (i) => ({ on: trayMesh, local: trayMesh.userData.slots[i] });
  const spot = (x, z) => ({ pos: [x, 0.7375, z] });
  const hand = (g, off = [0, -0.03, 0.07]) => ({ hand: g.p, side: g.side, off });
  const T1 = TABLES[0];
  const T2 = TABLES[1];
  const G1S = spot(T1.x - 0.3, T1.z - 0.15);
  const G2S = spot(T1.x + 0.3, T1.z - 0.15);
  const G3S = spot(T2.x + 0.15, T2.z - 0.15);
  const [g1, g2, g3] = guests;
  const sipSched = (g, home) => {
    const s = [{ t: 0, ...home }];
    for (const ts of g.sips) {
      s.push({ t: ts + 0.4, ...hand(g) });
      s.push({ t: ts + 2.0, ...home });
    }
    return s;
  };
  // G1 nurses one glass all afternoon
  props.add(makeGlass(M), sipSched(g1, G1S), { level: () => 0.45 });
  // G2: empty glass goes back on the tray, a full one arrives; drains to the seam
  props.add(makeGlass(M), [{ t: 0, ...G2S }, { t: 4.5, hand: waiter, side: 'R', off: [0, -0.03, 0.07] }, { t: 4.85, ...slot(0) }, { t: 8.5, hide: true }], { level: () => 0.05 });
  props.add(makeGlass(M), [{ t: 0, hide: true }, { t: 2.0, ...slot(0) }, { t: 3.95, hand: waiter, side: 'R', off: [0, -0.03, 0.07] }, { t: 4.3, ...G2S }, ...sipSched(g2, G2S).slice(1)], {
    level: (t) => (t < 4.3 ? 1 : 1 - 0.95 * win(t, 4.3, 39.6)),
  });
  // G3: same swap at table two
  props.add(makeGlass(M), [{ t: 0, ...G3S }, { t: 6.55, hand: waiter, side: 'R', off: [0, -0.03, 0.07] }, { t: 6.9, ...slot(0) }, { t: 8.5, hide: true }], { level: () => 0.05 });
  props.add(makeGlass(M), [{ t: 0, hide: true }, { t: 2.0, ...slot(1) }, { t: 6.1, hand: waiter, side: 'R', off: [0, -0.03, 0.07] }, { t: 6.45, ...G3S }, ...sipSched(g3, G3S).slice(1)], {
    level: (t) => (t < 6.45 ? 1 : 1 - 0.95 * win(t, 6.45, 39.6)),
  });
  // bitterballen: an eaten basket sits there until the waiter swaps it for a full one
  const BASKET_SPOT = { pos: [T1.x + 0.02, 0.7375, T1.z + 0.12], yaw: 0.2 };
  props.add(makeBasket(M, false), [{ t: 0, ...BASKET_SPOT }, { t: 25.6, hand: waiter, side: 'R', off: [0, -0.02, 0.08] }, { t: 25.95, ...slot(1) }, { t: 28.4, hide: true }]);
  const basket = props.add(makeBasket(M, true), [{ t: 0, hide: true }, { t: 24.0, ...slot(0) }, { t: 26.1, hand: waiter, side: 'R', off: [0, -0.02, 0.08] }, { t: 26.45, ...BASKET_SPOT }]);
  const EATS = [];
  for (let i = 0; i < 6; i++) {
    const g = i % 2 ? g1 : g2;
    const te = 27.6 + i * 1.9;
    EATS.push({ g, te });
    props.add(makeBall(M), [{ t: 0, hide: true }, { t: 24.0, on: basket.mesh, local: basket.mesh.userData.slots[i] }, { t: te + 0.5, ...hand(g, [0, -0.01, 0.07]) }, { t: te + 1.05, hide: true }]);
  }
  // the walker's bag, G3's phone
  props.add(makeBag(M), [{ t: 0, hand: walker, side: 'R', off: [0.04, -0.03, 0.02] }]);
  props.add(makePhone(M), [{ t: 0, hand: g3.p, side: 'L', off: [0, 0.04, 0.09], yawOff: 0 }]);

  // ---- waiter segments
  const WSEG = [
    { t0: 2.2, t1: 3.45, track: T.out1 },
    { t0: 3.45, t1: 5.0, stand: [-5.95, -4.05], yaw: -Math.PI / 2, serve: [3.6, 4.95] },
    { t0: 5.0, t1: 5.6, track: T.between },
    { t0: 5.6, t1: 7.0, stand: [-5.3, -4.05], yaw: Math.PI / 2, serve: [5.8, 6.95] },
    { t0: 7.0, t1: 8.35, track: T.back2 },
    { t0: 24.2, t1: 25.45, track: T.out1 },
    { t0: 25.45, t1: 26.8, stand: [-5.95, -4.05], yaw: -Math.PI / 2, serve: [25.55, 26.6] },
    { t0: 26.8, t1: 28.15, track: T.back1 },
  ];
  const segEndYaw = (seg) => (seg.track ? seg.track.at(seg.track.length).yaw : seg.yaw);

  function updateWaiter(t) {
    const out = (t >= 2.0 && t < 8.5) || (t >= 24.0 && t < 28.4);
    if (!out) {
      waiter.group.position.set(-5.5, 0.015, -5.45);
      waiter.group.rotation.y = 0;
      setPose(waiter, idle(t, 1.0, CARRY_TRAY));
      return;
    }
    let i = WSEG.findIndex((s) => t >= s.t0 && t < s.t1);
    if (i < 0) i = t < 12 ? (t < 2.2 ? 0 : 4) : t < 24.2 ? 5 : 7;
    const seg = WSEG[i];
    const prevYaw = i > 0 ? segEndYaw(WSEG[i - 1]) : Math.PI;
    let pos;
    let yaw;
    let pose;
    if (seg.track) {
      const u = smooth(win(t, seg.t0, seg.t1));
      const d = seg.track.length * u;
      const a = seg.track.at(d);
      pos = a.pos;
      yaw = a.yaw;
      const speed = (seg.track.length * 6 * u * (1 - u)) / (seg.t1 - seg.t0);
      const k = smooth(clamp(speed / 0.5, 0, 1));
      const wp = walkPose((d / STRIDE) * TAU, { amp: 0.3, armAmp: 0.1 });
      // both hands stay on the tray while walking
      wp.shoulderL = CARRY_TRAY.shoulderL;
      wp.shoulderR = CARRY_TRAY.shoulderR;
      wp.elbowL = CARRY_TRAY.elbowL;
      wp.elbowR = CARRY_TRAY.elbowR;
      wp.wristL = CARRY_TRAY.wristL;
      wp.wristR = CARRY_TRAY.wristR;
      pose = mixPose(CARRY_TRAY, wp, k);
      if (t - seg.t0 < 0.35) yaw = lerpAngle(prevYaw, yaw, smooth((t - seg.t0) / 0.35));
    } else {
      pos = _v.set(seg.stand[0], 0, seg.stand[1]);
      yaw = lerpAngle(prevYaw, seg.yaw, smooth(win(t, seg.t0, seg.t0 + 0.4)));
      const k = seg.serve ? bell(t, seg.serve[0], seg.serve[1], 0.4) : 0;
      pose = mixPose(idle(t, 1.0, CARRY_TRAY), SERVE, k);
    }
    waiter.group.position.set(pos.x, 0.015, pos.z);
    waiter.group.rotation.y = yaw;
    setPose(waiter, pose);
  }

  function updateGuests(t) {
    for (const g of guests) {
      const pose = idle(t, g.ph, SEATED);
      pose.torso = [pose.torso[0] + 0.02 * Math.sin(t * 1.1 + g.ph), pose.torso[1] * 2.5, pose.torso[2]];
      pose.head = [pose.head[0] + 0.06 * Math.sin(t * 0.33 + g.ph * 3), pose.head[1] * 1.8 + 0.1 * Math.sin(t * 0.9 + g.ph), 0.03 * Math.sin(t * 0.5 + g.ph)];
      // a nod and a raised hand for the waiter when he serves this table
      const served = g === g3 ? bell(t, 5.7, 6.9, 0.35) : bell(t, 3.5, 4.9, 0.35) + bell(t, 25.5, 26.6, 0.35);
      if (served > 0) {
        const dir = g === g3 ? -1 : 1; // waiter stands at +X of table one, -X of table two
        pose.head = mix3(pose.head, [0.12 + 0.05 * Math.sin(t * 7), 0.7 * dir, 0], served);
        const arm = g === g1 ? 'R' : 'L';
        const sg = arm === 'R' ? 1 : -1;
        pose[`shoulder${arm}`] = mix3(pose[`shoulder${arm}`], [-0.55, 0, sg * 0.2], served);
        pose[`elbow${arm}`] = mix3(pose[`elbow${arm}`], [-1.6, 0, 0], served);
      }
      // watching the bridge (it is off to their right, +X)
      const watch = bell(t, 12.2, 32.5, 1.2);
      pose.head = [pose.head[0] - 0.05 * watch, pose.head[1] + 0.75 * watch, 0];
      pose.torso = [pose.torso[0], pose.torso[1] + 0.18 * watch, pose.torso[2]];
      const S = g.side;
      const O = S === 'R' ? 'L' : 'R';
      const sgn = S === 'R' ? 1 : -1;
      // phone in the other hand
      if (g.phone) {
        pose[`shoulder${O}`] = [-0.85, 0, -sgn * 0.25];
        pose[`elbow${O}`] = [-1.95, 0, 0];
        pose.head = [0.38 - 0.3 * watch, pose.head[1] * 0.4 - sgn * 0.15, 0];
      }
      // sip: reach, lift to the mouth, put back
      for (const ts of g.sips) {
        const reach = bell(t, ts, ts + 0.8, 0.3);
        const lift = bell(t, ts + 0.7, ts + 1.9, 0.35);
        if (reach <= 0 && lift <= 0) continue;
        const base = [pose[`shoulder${S}`], pose[`elbow${S}`]];
        let sh = mix3(base[0], [-1.0, 0, sgn * 0.1], reach);
        let el = mix3(base[1], [-0.55, 0, 0], reach);
        sh = mix3(sh, [-0.95, 0, -sgn * 0.3], lift);
        el = mix3(el, [-2.1, 0, 0], lift);
        pose[`shoulder${S}`] = sh;
        pose[`elbow${S}`] = el;
        pose.torso = mix3(pose.torso, [0.25, pose.torso[1], 0], reach * (1 - lift));
        pose.head = mix3(pose.head, [-0.25, pose.head[1] * 0.3, 0], lift);
      }
      // eating a bitterbal from the shared basket
      for (const e of EATS) {
        if (e.g !== g) continue;
        const reach = bell(t, e.te, e.te + 0.9, 0.35);
        const mouth = bell(t, e.te + 0.6, e.te + 1.6, 0.35);
        if (reach <= 0 && mouth <= 0) continue;
        const toward = g === g1 ? 1 : -1; // basket is at +X for G1, -X for G2
        const arm = toward > 0 ? 'R' : 'L';
        let sh = mix3(pose[`shoulder${arm}`], [-1.2, 0, toward * 0.35], reach);
        let el = mix3(pose[`elbow${arm}`], [-0.4, 0, 0], reach);
        sh = mix3(sh, [-0.95, 0, -toward * 0.28], mouth);
        el = mix3(el, [-2.1, 0, 0], mouth);
        pose[`shoulder${arm}`] = sh;
        pose[`elbow${arm}`] = el;
        pose.torso = mix3(pose.torso, [0.4, toward * 0.25, 0], reach * (1 - mouth));
        pose.head = mix3(pose.head, [-0.2, 0, 0], mouth);
      }
      setPose(g.p, pose);
    }
  }

  function updateKeeper(t) {
    const pose = idle(t, 0.7);
    const press = bell(t, 10.0, 10.9, 0.3) + bell(t, 13.0, 13.9, 0.3) + bell(t, 26.0, 26.9, 0.3) + bell(t, 31.6, 32.5, 0.3);
    const look = bell(t, 17.5, 25.5, 1.0); // follows the barge
    const wave = bell(t, 21.0, 22.8, 0.35);
    pose.head = [0.3 * press - 0.05 * look, 0.8 * look * (1 - press) + 0.6 * wave, 0];
    pose.torso = mix3(pose.torso, [0.3, 0.08, 0], press);
    pose.shoulderR = mix3(pose.shoulderR, [-1.15, 0, 0.05], press);
    pose.elbowR = mix3(pose.elbowR, [-0.35, 0, 0], press);
    if (wave > 0) {
      pose.shoulderR = mix3(pose.shoulderR, [-2.5, 0, 0.7], wave);
      pose.elbowR = mix3(pose.elbowR, [-0.5 + 0.3 * Math.sin(t * 9), 0, 0.25 * Math.sin(t * 9)], wave);
    }
    setPose(keeper, pose);
  }

  function updateSkipper(t) {
    const pose = idle(t, 3.3);
    // tiller hand (R is at -Z here, where the tiller is)
    pose.shoulderR = [0.15, 0, 0.3];
    pose.elbowR = [-0.15, 0, 0];
    const up = bell(t, 14.0, 19.5, 1.0); // watching the leaf rise
    const wave = bell(t, 20.5, 22.4, 0.35);
    pose.head = [-0.35 * up, -0.8 * wave + 0.2 * up, 0];
    if (wave > 0) {
      pose.shoulderL = mix3(pose.shoulderL, [-2.5, 0, -0.7], wave);
      pose.elbowL = mix3(pose.elbowL, [-0.5 + 0.3 * Math.sin(t * 9 + 1), 0, -0.25 * Math.sin(t * 9 + 1)], wave);
    }
    setPose(skipper, pose);
  }

  function updateWalker(t) {
    const tl = wrap(t, 13.0);
    const d = walkF(tl);
    const vis = d > 0.02 && d < T.walk.length - 0.02;
    walker.group.visible = vis;
    if (!vis) return;
    const a = T.walk.at(d);
    const speed = Math.max(0, (walkF(tl + 0.02) - walkF(tl - 0.02)) / 0.04);
    const k = smooth(clamp(speed / 0.4, 0, 1));
    const wp = walkPose((d / STRIDE) * TAU, { amp: 0.3, carry: true });
    const ip = idle(t, 2.0);
    ip.shoulderR = [0.1, 0, 0.12];
    ip.elbowR = [-0.14, 0, 0];
    // watching the canal: it is on his left (-Z while heading -X)
    const watch = bell(tl, 5.5, 18.5, 0.8);
    ip.head = [0.12 * watch, -0.95 * watch + ip.head[1] * (1 - watch), 0];
    ip.torso = [ip.torso[0], -0.2 * watch, ip.torso[2]];
    const pose = mixPose(ip, wp, k);
    walker.group.position.set(a.pos.x, 0.015, a.pos.z);
    walker.group.rotation.y = a.yaw;
    setPose(walker, pose);
  }

  function updateBoat(t) {
    const bow = SCHED.bow(t);
    const speed = (SCHED.bow(t + 0.02) - SCHED.bow(t - 0.02)) / 0.04;
    boat.root.position.set(bow - 4.5, CANAL.waterY, CANAL.boatZ);
    boat.root.visible = bow > -13.6 + 0.01 && bow - 9 < 14.5;
    boat.body.rotation.z = Math.sin(t * 0.9) * 0.012;
    boat.body.rotation.x = Math.sin(t * 1.4 + 0.5) * 0.02;
    boat.body.position.y = Math.sin(t * 1.1) * 0.02;
    boat.steer.tiller.rotation.y = Math.sin(t * 0.7) * 0.04;
    boat.steer.flagCols.forEach((c, i) => (c.rotation.y = Math.sin(t * 5.5 + i * 0.9) * 0.22 + 0.05));
    boat.pennant.segs.forEach((s, i) => (s.rotation.y = Math.sin(t * 6.2 + i * 1.1) * 0.3 - 0.1));
    updateWake(wake, t, bow, Math.abs(speed), 9);
  }

  function updateSet(t) {
    set.trees.forEach((tr, i) => {
      const c = tr.userData.crown;
      c.rotation.z = Math.sin(t * 0.8 + i * 1.7) * 0.02;
      c.rotation.x = Math.sin(t * 0.6 + i * 2.3) * 0.015;
    });
    // the moored sloop rides the barge's wash as it passes
    const bow = SCHED.bow(t);
    const near = 1 - clamp(Math.abs(bow - 4.5 + 7.6) / 7.5, 0, 1);
    set.sloop.position.y = CANAL.waterY + Math.sin(t * 1.3) * 0.02 + Math.sin(t * 2.6) * 0.06 * near;
    set.sloop.rotation.x = Math.sin(t * 1.7) * 0.01 + Math.sin(t * 2.9) * 0.05 * near;
    set.sloop.rotation.z = Math.sin(t * 1.1 + 1) * 0.008;
    updateDucks(set.ducks, t);
    const door = scene.getObjectByName('cafeDoor');
    if (door) door.rotation.y = -1.3 * clamp(SCHED.door(t), 0, 1);
  }

  function update(t) {
    updateBridge(bridge, SCHED.lift(t), SCHED.boom(t), SCHED.lights(t), t);
    updateBoat(t);
    updateSet(t);
    for (const r of riders) updateRider(r, t);
    updateKeeper(t);
    updateSkipper(t);
    updateWalker(t);
    updateWaiter(t);
    updateGuests(t);
    scene.updateMatrixWorld(true);
    updateProps(props, t);
  }

  return { update, cast, props: props.list, sched: SCHED, tracks: T, stops: { STOP_A, STOP_B } };
}
